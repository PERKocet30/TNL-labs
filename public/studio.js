/* ================================================================
   TNL STUDIO — a real studio, sized for a phone.

   Design rules, because "FL but simple" is a knife-edge:
   • Everything is SYNTHESISED, not sampled. No 40MB of wavs to
     download before you can make a sound. Opens instantly.
   • ONE graph builder used by both live playback and offline
     rendering, so what you export is exactly what you heard.
   • Scale lock, so someone who can't play piano still can't play a
     wrong note.
   • Humanize is seeded per (track, step) — so stems always line up.
     Random humanize would make every stem render drift apart.
================================================================ */

(function () {
  "use strict";

  /* ---------------- theory ---------------- */
  const NOTES = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];
  const SCALES = {
    "Minor": [0, 2, 3, 5, 7, 8, 10],
    "Major": [0, 2, 4, 5, 7, 9, 11],
    "Dorian": [0, 2, 3, 5, 7, 9, 10],
    "Phrygian": [0, 1, 3, 5, 7, 8, 10],
    "Minor Pent": [0, 3, 5, 7, 10],
    "Major Pent": [0, 2, 4, 7, 9],
    "Chromatic": [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11],
  };
  const STEPS = 16, BARS = 4;
  const midiToFreq = (m) => 440 * Math.pow(2, (m - 69) / 12);

  /* Build the ladder of notes a piano roll shows: only in-key ones. */
  function scaleNotes(rootPc, scaleName, lowOct, octaves) {
    const iv = SCALES[scaleName] || SCALES.Minor;
    const out = [];
    for (let o = 0; o < octaves; o++) {
      for (const s of iv) out.push((lowOct + o) * 12 + rootPc + s);
    }
    out.push((lowOct + octaves) * 12 + rootPc);
    return out.reverse(); // high notes on top, like a real piano roll
  }

  /* Deterministic noise so stems line up. */
  function seeded(a) {
    return function () {
      a |= 0; a = (a + 0x6D2B79F5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  /* ---------------- track defaults ---------------- */
  const DRUM_KITS = {
    kick: ["808", "Punch", "Sub"],
    snare: ["Classic", "Rim", "Trap"],
    hat: ["Closed", "Open", "Tight"],
    clap: ["Clap", "Snap"],
    perc: ["Tom", "Block", "Cowbell"],
  };
  const SYNTH_WAVES = ["sine", "triangle", "sawtooth", "square"];

  function newTrack(id, name, kind, voice, extra) {
    return Object.assign({
      id, name, kind, voice,
      vol: 0.8, pan: 0, mute: false, solo: false,
      variant: 0,
      cutoff: 20000, reso: 0.7,
      reverb: 0, delay: 0,
      attack: 0.005, release: 0.35,
      wave: "sawtooth",
      octave: 0,
      sampleUrl: "", sampleName: "",
      steps: Array(STEPS * BARS).fill(null),
    }, extra || {});
  }

  function newProject() {
    return {
      v: 2,
      name: "",
      bpm: 140,
      swing: 0,
      humanize: 0,
      bars: 1,
      key: 0,
      scale: "Minor",
      master: { vol: 0.9, reverb: 0.25, delay: 0.22, delayTime: 0.375 },
      tracks: [
        newTrack("kick", "KICK", "drum", "kick"),
        newTrack("snare", "SNARE", "drum", "snare"),
        newTrack("hat", "HAT", "drum", "hat", { reverb: 0.05 }),
        newTrack("clap", "CLAP", "drum", "clap", { reverb: 0.18 }),
        newTrack("perc", "PERC", "drum", "perc", { reverb: 0.15 }),
        newTrack("bass", "808", "melodic", "bass", { release: 0.55, octave: -1 }),
        newTrack("lead", "LEAD", "melodic", "synth", { wave: "sawtooth", cutoff: 2600, reverb: 0.3, delay: 0.28, release: 0.25 }),
        newTrack("keys", "KEYS", "melodic", "synth", { wave: "triangle", cutoff: 4000, reverb: 0.4, delay: 0.15, release: 0.5, vol: 0.6 }),
      ],
    };
  }

  /* ================================================================
     GRAPH — built identically for live and offline. This is the bit
     that guarantees the export sounds like the app.
  ================================================================ */
  function makeReverbIR(ctx, seconds, decay) {
    const rate = ctx.sampleRate;
    const len = Math.max(1, Math.floor(rate * seconds));
    const buf = ctx.createBuffer(2, len, rate);
    for (let c = 0; c < 2; c++) {
      const d = buf.getChannelData(c);
      for (let i = 0; i < len; i++) {
        d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, decay);
      }
    }
    return buf;
  }

  function buildGraph(ctx, proj, opts) {
    opts = opts || {};
    const out = ctx.createGain();
    out.gain.value = proj.master.vol;

    // master limiter — stops a stacked mix from clipping into mud
    const limiter = ctx.createDynamicsCompressor();
    limiter.threshold.value = -6;
    limiter.knee.value = 6;
    limiter.ratio.value = 12;
    limiter.attack.value = 0.003;
    limiter.release.value = 0.18;
    out.connect(limiter);
    limiter.connect(ctx.destination);

    // shared FX buses
    const reverb = ctx.createConvolver();
    reverb.buffer = makeReverbIR(ctx, 1.8, 2.6);
    const revGain = ctx.createGain();
    revGain.gain.value = proj.master.reverb;
    reverb.connect(revGain); revGain.connect(out);

    const delay = ctx.createDelay(2);
    delay.delayTime.value = (60 / proj.bpm) * (proj.master.delayTime || 0.375);
    const fb = ctx.createGain(); fb.gain.value = 0.34;
    const dampen = ctx.createBiquadFilter();
    dampen.type = "lowpass"; dampen.frequency.value = 2400;
    const delGain = ctx.createGain(); delGain.gain.value = proj.master.delay;
    delay.connect(dampen); dampen.connect(fb); fb.connect(delay);
    delay.connect(delGain); delGain.connect(out);

    const strips = {};
    const anySolo = proj.tracks.some((t) => t.solo);
    for (const t of proj.tracks) {
      const input = ctx.createGain(); input.gain.value = 1;

      const filter = ctx.createBiquadFilter();
      filter.type = "lowpass";
      filter.frequency.value = t.cutoff;
      filter.Q.value = t.reso;

      const panner = ctx.createStereoPanner ? ctx.createStereoPanner() : null;
      if (panner) panner.pan.value = t.pan;

      const audible = anySolo ? t.solo : !t.mute;
      const gain = ctx.createGain();
      gain.gain.value = (opts.soloTrack ? (opts.soloTrack === t.id ? 1 : 0) : (audible ? 1 : 0)) * t.vol;

      input.connect(filter);
      const tail = panner ? (filter.connect(panner), panner) : filter;
      tail.connect(gain);
      gain.connect(out);

      const rs = ctx.createGain(); rs.gain.value = t.reverb;
      const ds = ctx.createGain(); ds.gain.value = t.delay;
      gain.connect(rs); rs.connect(reverb);
      gain.connect(ds); ds.connect(delay);

      strips[t.id] = { input, filter, gain, panner };
    }
    return { out, strips };
  }

  /* ================================================================
     VOICES — all synthesis, no samples.
  ================================================================ */
  function noiseBuffer(ctx, len) {
    const b = ctx.createBuffer(1, Math.max(1, Math.floor(ctx.sampleRate * len)), ctx.sampleRate);
    const d = b.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    return b;
  }
  function adsr(param, when, peak, a, r) {
    param.setValueAtTime(0.0001, when);
    param.linearRampToValueAtTime(peak, when + Math.max(0.001, a));
    param.exponentialRampToValueAtTime(0.0001, when + Math.max(a + 0.02, r));
  }

  /* Returns any sources started, so choke groups can stop them. */
  function playVoice(ctx, dest, track, when, vel, midi, buffers) {
    const started = [];
    const g0 = ctx.createGain();
    g0.gain.value = vel;
    g0.connect(dest);

    const V = track.voice, variant = track.variant | 0;

    if (V === "kick") {
      const spec = [[150, 45, 0.11, 0.34], [220, 55, 0.06, 0.2], [110, 32, 0.18, 0.55]][variant] || [150, 45, 0.11, 0.34];
      const o = ctx.createOscillator(), g = ctx.createGain();
      o.frequency.setValueAtTime(spec[0], when);
      o.frequency.exponentialRampToValueAtTime(spec[1], when + spec[2]);
      adsr(g.gain, when, 1, 0.002, spec[3]);
      o.connect(g); g.connect(g0);
      o.start(when); o.stop(when + spec[3] + 0.05); started.push(o);
    } else if (V === "snare") {
      const spec = [[1800, 0.18, 0.7], [3000, 0.07, 0.5], [1200, 0.26, 0.85]][variant] || [1800, 0.18, 0.7];
      const n = ctx.createBufferSource(); n.buffer = noiseBuffer(ctx, spec[1]);
      const f = ctx.createBiquadFilter(); f.type = "bandpass"; f.frequency.value = spec[0]; f.Q.value = 0.9;
      const g = ctx.createGain(); adsr(g.gain, when, spec[2], 0.001, spec[1]);
      n.connect(f); f.connect(g); g.connect(g0); n.start(when); started.push(n);
      if (variant !== 1) {
        const o = ctx.createOscillator(), og = ctx.createGain();
        o.type = "triangle"; o.frequency.value = 190;
        adsr(og.gain, when, 0.5, 0.001, 0.1);
        o.connect(og); og.connect(g0); o.start(when); o.stop(when + 0.14); started.push(o);
      }
    } else if (V === "hat") {
      const spec = [[9000, 0.05], [8000, 0.3], [11000, 0.028]][variant] || [9000, 0.05];
      const n = ctx.createBufferSource(); n.buffer = noiseBuffer(ctx, spec[1]);
      const f = ctx.createBiquadFilter(); f.type = "highpass"; f.frequency.value = spec[0];
      const g = ctx.createGain(); adsr(g.gain, when, 0.4, 0.001, spec[1]);
      n.connect(f); f.connect(g); g.connect(g0); n.start(when); started.push(n);
    } else if (V === "clap") {
      const spread = variant === 1 ? [0, 0.008] : [0, 0.01, 0.02, 0.032];
      spread.forEach((off, i) => {
        const n = ctx.createBufferSource(); n.buffer = noiseBuffer(ctx, 0.2);
        const f = ctx.createBiquadFilter(); f.type = "bandpass"; f.frequency.value = 1100; f.Q.value = 1.5;
        const g = ctx.createGain();
        const last = i === spread.length - 1;
        adsr(g.gain, when + off, last ? 0.7 : 0.3, 0.001, last ? 0.2 : 0.03);
        n.connect(f); f.connect(g); g.connect(g0); n.start(when + off); started.push(n);
      });
    } else if (V === "perc") {
      if (variant === 2) {
        [540, 800].forEach((fr) => {
          const o = ctx.createOscillator(), g = ctx.createGain();
          o.type = "square"; o.frequency.value = fr;
          adsr(g.gain, when, 0.28, 0.001, 0.12);
          o.connect(g); g.connect(g0); o.start(when); o.stop(when + 0.16); started.push(o);
        });
      } else if (variant === 1) {
        const o = ctx.createOscillator(), g = ctx.createGain();
        o.type = "square"; o.frequency.setValueAtTime(1100, when);
        adsr(g.gain, when, 0.3, 0.001, 0.05);
        o.connect(g); g.connect(g0); o.start(when); o.stop(when + 0.08); started.push(o);
      } else {
        const o = ctx.createOscillator(), g = ctx.createGain();
        o.type = "sine"; o.frequency.setValueAtTime(260, when);
        o.frequency.exponentialRampToValueAtTime(110, when + 0.22);
        adsr(g.gain, when, 0.7, 0.002, 0.28);
        o.connect(g); g.connect(g0); o.start(when); o.stop(when + 0.32); started.push(o);
      }
    } else if (V === "bass") {
      // 808: pitched sine, click transient, saturated
      const f = midiToFreq(midi);
      const o = ctx.createOscillator(), g = ctx.createGain();
      o.type = "sine";
      o.frequency.setValueAtTime(f * 2.6, when);
      o.frequency.exponentialRampToValueAtTime(f, when + 0.05);
      adsr(g.gain, when, 0.95, 0.004, track.release);
      const sat = ctx.createWaveShaper();
      const curve = new Float32Array(257);
      for (let i = 0; i < 257; i++) { const x = i / 128 - 1; curve[i] = Math.tanh(x * 2.2); }
      sat.curve = curve;
      o.connect(sat); sat.connect(g); g.connect(g0);
      o.start(when); o.stop(when + track.release + 0.08); started.push(o);
    } else if (V === "synth") {
      const f = midiToFreq(midi);
      const g = ctx.createGain();
      adsr(g.gain, when, 0.5, track.attack, track.release);
      // two detuned oscillators = width without a chorus
      [-6, 6].forEach((cents) => {
        const o = ctx.createOscillator();
        o.type = track.wave; o.frequency.value = f; o.detune.value = cents;
        o.connect(g); o.start(when); o.stop(when + track.release + 0.1); started.push(o);
      });
      g.connect(g0);
    } else if (V === "sampler") {
      const buf = buffers && buffers[track.id];
      if (!buf) return started;
      const s = ctx.createBufferSource();
      s.buffer = buf;
      s.playbackRate.value = Math.pow(2, (midi - 60) / 12);
      const g = ctx.createGain();
      g.gain.setValueAtTime(1, when);
      s.connect(g); g.connect(g0); s.start(when); started.push(s);
    }
    return started;
  }

  /* Which tracks silence each other (open hat vs closed hat). */
  const CHOKE = { hat: "hats" };

  /* ================================================================
     SCHEDULING — shared by live and offline.
  ================================================================ */
  function stepDur(proj) { return 60 / proj.bpm / 4; }

  function scheduleStep(ctx, graph, proj, absStep, when, buffers, chokes) {
    const bar = Math.floor(absStep / STEPS) % Math.max(1, proj.bars);
    const i = absStep % STEPS;
    const idx = bar * STEPS + i;
    const rnd = seeded(idx * 7919);

    for (const t of proj.tracks) {
      const cell = t.steps[idx];
      if (!cell) continue;
      const strip = graph.strips[t.id];
      if (!strip) continue;

      let at = when;
      if (proj.humanize > 0) {
        at += (rnd() * 2 - 1) * 0.012 * proj.humanize;
        if (at < ctx.currentTime) at = ctx.currentTime;
      }
      let vel = [0, 0.4, 0.7, 1][cell.v || 2];
      if (proj.humanize > 0) vel = Math.max(0.05, Math.min(1, vel + (rnd() * 2 - 1) * 0.09 * proj.humanize));

      const group = CHOKE[t.voice];
      if (group && chokes) {
        (chokes[group] || []).forEach((s) => { try { s.stop(at); } catch (e) {} });
        chokes[group] = [];
      }

      const notes = t.kind === "melodic" ? (cell.n && cell.n.length ? cell.n : [60]) : [60];
      let started = [];
      for (const midi of notes) {
        started = started.concat(playVoice(ctx, strip.input, t, at, vel, midi + t.octave * 12, buffers));
      }
      if (group && chokes) chokes[group] = (chokes[group] || []).concat(started);
    }
  }

  /* ================================================================
     WAV — writer adapted from the one you wrote; the header maths
     checked out, so no reason to reinvent it.
  ================================================================ */
  function bufferToWav(audioBuffer) {
    const numChan = audioBuffer.numberOfChannels;
    const length = audioBuffer.length * numChan * 2 + 44;
    const buffer = new ArrayBuffer(length);
    const view = new DataView(buffer);
    let pos = 0;
    const u32 = (d) => { view.setUint32(pos, d, true); pos += 4; };
    const u16 = (d) => { view.setUint16(pos, d, true); pos += 2; };
    u32(0x46464952); u32(length - 8); u32(0x45564157);
    u32(0x20746d66); u32(16); u16(1); u16(numChan);
    u32(audioBuffer.sampleRate);
    u32(audioBuffer.sampleRate * 2 * numChan);
    u16(numChan * 2); u16(16);
    u32(0x61746164); u32(length - pos - 4);
    const chans = [];
    for (let i = 0; i < numChan; i++) chans.push(audioBuffer.getChannelData(i));
    let offset = 0;
    while (pos < length) {
      for (let i = 0; i < numChan; i++) {
        let s = Math.max(-1, Math.min(1, chans[i][offset]));
        view.setInt16(pos, s < 0 ? s * 0x8000 : s * 0x7fff, true);
        pos += 2;
      }
      offset++;
    }
    return new Blob([buffer], { type: "audio/wav" });
  }

  async function renderProject(proj, buffers, soloTrack) {
    const rate = 44100;
    const bars = Math.max(1, proj.bars);
    const total = stepDur(proj) * STEPS * bars + 2.5; // tail for reverb/release
    const ctx = new OfflineAudioContext(2, Math.ceil(rate * total), rate);
    const graph = buildGraph(ctx, proj, { soloTrack });
    const chokes = {};
    for (let s = 0; s < STEPS * bars; s++) {
      scheduleStep(ctx, graph, proj, s, s * stepDur(proj) + 0.05, buffers, chokes);
    }
    const rendered = await ctx.startRendering();
    return bufferToWav(rendered);
  }

  function download(blob, name) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = name;
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  /* ================================================================
     STUDIO — state + UI
  ================================================================ */
  let ctx = null;
  function audio() {
    if (!ctx) ctx = new (window.AudioContext || window.webkitAudioContext)();
    if (ctx.state === "suspended") ctx.resume();
    return ctx;
  }

  const S = {
    proj: newProject(),
    buffers: {},        // trackId -> AudioBuffer (recorded audio)
    el: null,
    opts: {},
    playing: false,
    absStep: 0,
    curStep: -1,
    timer: null,
    nextTime: 0,
    graph: null,
    chokes: {},
    sel: "kick",        // selected track
    view: "seq",        // seq | mix | fx
    editBar: 0,
    octave: 3,
    undo: [], redo: [],
    metro: false,
    recording: false,
    rec: null,
    drafts: null,
    saving: false,
  };

  const $ = (sel) => S.el ? S.el.querySelector(sel) : null;
  const esc = (s) => String(s == null ? "" : s).replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

  function snapshot() {
    S.undo.push(JSON.stringify(S.proj));
    if (S.undo.length > 60) S.undo.shift();
    S.redo.length = 0;
  }
  function doUndo() {
    if (!S.undo.length) return;
    S.redo.push(JSON.stringify(S.proj));
    S.proj = JSON.parse(S.undo.pop());
    paint();
  }
  function doRedo() {
    if (!S.redo.length) return;
    S.undo.push(JSON.stringify(S.proj));
    S.proj = JSON.parse(S.redo.pop());
    paint();
  }

  const track = (id) => S.proj.tracks.find((t) => t.id === id);
  const selTrack = () => track(S.sel) || S.proj.tracks[0];

  /* ---------------- transport ---------------- */
  function scheduler() {
    const c = audio();
    while (S.nextTime < c.currentTime + 0.1) {
      const bars = Math.max(1, S.proj.bars);
      const abs = S.absStep % (STEPS * bars);
      scheduleStep(c, S.graph, S.proj, abs, S.nextTime, S.buffers, S.chokes);
      if (S.metro) clickAt(c, S.nextTime, abs % 4 === 0, abs % STEPS === 0);
      const painted = abs, at = S.nextTime;
      setTimeout(() => { S.curStep = painted; paintPlayhead(); }, Math.max(0, (at - c.currentTime) * 1000));
      S.nextTime += stepDur(S.proj);
      S.absStep++;
    }
    S.timer = setTimeout(scheduler, 25);
  }
  function clickAt(c, when, beat, bar) {
    if (!beat) return;
    const o = c.createOscillator(), g = c.createGain();
    o.frequency.value = bar ? 1600 : 1000;
    g.gain.setValueAtTime(0.12, when);
    g.gain.exponentialRampToValueAtTime(0.0001, when + 0.04);
    o.connect(g); g.connect(c.destination);
    o.start(when); o.stop(when + 0.05);
  }
  function play(countIn) {
    if (S.playing) return;
    const c = audio();
    S.graph = buildGraph(c, S.proj);
    S.chokes = {};
    S.playing = true;
    S.absStep = 0;
    S.nextTime = c.currentTime + 0.08 + (countIn ? (60 / S.proj.bpm) * 4 : 0);
    if (countIn) for (let i = 0; i < 4; i++) clickAt(c, c.currentTime + 0.08 + (60 / S.proj.bpm) * i, true, i === 0);
    scheduler();
    paintTransport();
  }
  function stop() {
    S.playing = false; S.curStep = -1;
    if (S.timer) clearTimeout(S.timer);
    paintPlayhead(); paintTransport();
  }
  function rebuildIfPlaying() { if (S.playing) { const c = audio(); S.graph = buildGraph(c, S.proj); } }

  /* ---------------- preview (published beats) ---------------- */
  let previewing = false, previewTimer = null;
  function preview(beat) {
    if (previewing) { stopPreview(); return; }
    const p = migrate(beat && (beat.proj || beat.data) ? (beat.proj || beat.data) : beat);
    const saved = S.proj, savedPlaying = S.playing;
    if (savedPlaying) stop();
    S.proj = p;
    previewing = true;
    play(false);
    const ms = stepDur(p) * STEPS * Math.max(1, p.bars) * 1000 * 2 + 400;
    previewTimer = setTimeout(() => { stopPreview(); S.proj = saved; }, ms);
    window.__tnlRestore = () => { S.proj = saved; };
  }
  function stopPreview() {
    previewing = false; stop();
    if (previewTimer) clearTimeout(previewTimer);
    if (window.__tnlRestore) { window.__tnlRestore(); window.__tnlRestore = null; }
  }

  /* ---------------- format migration ---------------- */
  function migrate(raw) {
    if (!raw) return newProject();
    if (raw.v === 2 && Array.isArray(raw.tracks)) {
      const p = newProject();
      Object.assign(p, raw);
      p.master = Object.assign(newProject().master, raw.master || {});
      p.tracks = raw.tracks.map((t) => Object.assign(newTrack(t.id, t.name, t.kind, t.voice), t));
      return p;
    }
    // v1: { bars:[{kick:[cell]}], bpm, swing, chain, mix, key }
    const p = newProject();
    p.bpm = raw.bpm || 140;
    p.swing = raw.swing || 0;
    p.bars = raw.chain || 1;
    p.key = raw.key || 0;
    p.name = raw.name || "";
    const map = { kick: "kick", snare: "snare", hat: "hat", clap: "clap", eight: "bass", bass: "bass" };
    (raw.bars || []).forEach((bar, bi) => {
      if (bi >= BARS) return;
      for (const [oldId, arr] of Object.entries(bar || {})) {
        const tid = map[oldId]; if (!tid || !Array.isArray(arr)) continue;
        const t = p.tracks.find((x) => x.id === tid); if (!t) continue;
        arr.forEach((cell, i) => {
          if (!cell) return;
          const idx = bi * STEPS + i;
          t.steps[idx] = tid === "bass"
            ? { v: cell.v || 2, n: [36 + (cell.n || 0)] }
            : { v: cell.v || 2 };
        });
      }
      if (raw.mix) for (const [oldId, m] of Object.entries(raw.mix)) {
        const t = p.tracks.find((x) => x.id === (map[oldId] || oldId));
        if (t && m) { t.vol = m.vol != null ? m.vol : t.vol; t.mute = !!m.mute; t.solo = !!m.solo; t.variant = m.variant | 0; }
      }
    });
    return p;
  }

  /* ---------------- recording ---------------- */
  async function startRec() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: false },
      });
      const mr = new MediaRecorder(stream);
      const chunks = [];
      mr.ondataavailable = (e) => { if (e.data.size) chunks.push(e.data); };
      mr.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        const blob = new Blob(chunks, { type: mr.mimeType || "audio/webm" });
        await addTake(blob);
      };
      mr.start();
      S.rec = mr; S.recording = true;
      paint();
      if (!S.playing) play(true);
    } catch (e) {
      toast("Mic blocked — allow microphone access");
    }
  }
  function stopRec() {
    if (S.rec && S.rec.state !== "inactive") S.rec.stop();
    S.recording = false;
    paint();
  }
  async function addTake(blob) {
    const c = audio();
    const buf = await c.decodeAudioData(await blob.arrayBuffer());
    const n = S.proj.tracks.filter((t) => t.voice === "sampler").length + 1;
    const id = "take" + Date.now().toString(36);
    snapshot();
    const t = newTrack(id, "TAKE " + n, "melodic", "sampler", { reverb: 0.2, vol: 0.9 });
    t.steps[0] = { v: 3, n: [60] };
    S.proj.tracks.push(t);
    S.buffers[id] = buf;
    S.sel = id;
    paint();
    toast("Take added — it triggers on step 1");
    // persist it so the take survives a reload
    if (S.opts.uploadAudio) {
      try {
        const url = await S.opts.uploadAudio(blob);
        t.sampleUrl = url;
      } catch (e) { /* stays session-only */ }
    }
  }
  async function loadBuffers(proj) {
    for (const t of proj.tracks) {
      if (t.voice === "sampler" && t.sampleUrl && !S.buffers[t.id]) {
        try {
          const res = await fetch(t.sampleUrl);
          S.buffers[t.id] = await audio().decodeAudioData(await res.arrayBuffer());
        } catch (e) { /* missing take */ }
      }
    }
  }

  function toast(m) { if (S.opts.toast) S.opts.toast(m); }

  /* ================================================================
     UI
  ================================================================ */
  function paint() {
    if (!S.el) return;
    S.el.innerHTML = shell();
    wire();
    paintPlayhead();
  }

  function shell() {
    const p = S.proj;
    return `
    <div class="st">
      <div class="st-bar">
        <button class="st-play ${S.playing ? "on" : ""}" data-play>${S.playing ? "■" : "▶"}</button>
        <button class="st-rec ${S.recording ? "on" : ""}" data-rec title="Record from mic">●</button>
        <input class="st-name" data-name placeholder="untitled beat" value="${esc(p.name)}" maxlength="40">
        <div class="st-knobs">
          <label>BPM<input type="range" min="60" max="200" value="${p.bpm}" data-bpm><b>${p.bpm}</b></label>
          <label>SWING<input type="range" min="0" max="100" value="${p.swing}" data-swing><b>${p.swing}</b></label>
          <label>FEEL<input type="range" min="0" max="100" value="${p.humanize}" data-hum><b>${p.humanize}</b></label>
        </div>
        <div class="st-mini">
          <button class="st-ic ${S.metro ? "on" : ""}" data-metro title="Metronome">◷</button>
          <button class="st-ic" data-undo title="Undo" ${S.undo.length ? "" : "disabled"}>↺</button>
          <button class="st-ic" data-redo title="Redo" ${S.redo.length ? "" : "disabled"}>↻</button>
        </div>
      </div>

      <div class="st-bar2">
        <div class="st-bars">
          <span class="mono dim">BARS</span>
          ${[1, 2, 3, 4].map((n) => `<button class="st-b ${p.bars === n ? "on" : ""}" data-bars="${n}">${n}</button>`).join("")}
        </div>
        <div class="st-bars">
          <span class="mono dim">EDIT</span>
          ${Array.from({ length: p.bars }, (_, i) => `<button class="st-b ${S.editBar === i ? "on" : ""}" data-editbar="${i}">${i + 1}</button>`).join("")}
          <button class="st-ic" data-copybar title="Copy bar to next">⧉</button>
        </div>
        <div class="st-bars">
          <span class="mono dim">KEY</span>
          <select data-key>${NOTES.map((n, i) => `<option value="${i}" ${p.key === i ? "selected" : ""}>${n}</option>`).join("")}</select>
          <select data-scale>${Object.keys(SCALES).map((k) => `<option ${p.scale === k ? "selected" : ""}>${k}</option>`).join("")}</select>
        </div>
        <div class="st-views">
          ${["seq", "mix", "fx"].map((v) => `<button class="st-v ${S.view === v ? "on" : ""}" data-view="${v}">${v.toUpperCase()}</button>`).join("")}
        </div>
      </div>

      <div class="st-tracks">
        ${p.tracks.map((t) => {
          const anySolo = p.tracks.some((x) => x.solo);
          const dim = anySolo ? !t.solo : t.mute;
          return `<button class="st-t ${S.sel === t.id ? "on" : ""} ${dim ? "dim" : ""}" data-sel="${t.id}">
            <span class="st-tn">${esc(t.name)}</span>
            <span class="mono st-tk">${t.kind === "melodic" ? "♪" : "▣"}</span>
          </button>`;
        }).join("")}
      </div>

      ${S.view === "seq" ? seqView() : S.view === "mix" ? mixView() : fxView()}

      <div class="st-foot">
        <button class="st-btn" data-save>${S.saving ? "Saving…" : "Save draft"}</button>
        <button class="st-btn" data-drafts>Drafts</button>
        <button class="st-btn" data-export>Export WAV</button>
        <button class="st-btn green" data-publish>Publish to #beats</button>
      </div>
      ${S.drafts ? draftsView() : ""}
    </div>`;
  }

  function draftsView() {
    return `<div class="st-drafts">
      ${S.drafts.length ? S.drafts.map((d) => `<div class="st-draft">
        <button class="st-dn" data-load="${d.id}">${esc(d.name || "untitled")}</button>
        <span class="mono dim">${new Date(d.updated_at).toLocaleDateString()}</span>
        <button class="st-ic" data-deldraft="${d.id}">✕</button>
      </div>`).join("") : `<div class="mono dim" style="padding:8px">No drafts yet.</div>`}
    </div>`;
  }

  function seqView() {
    const t = selTrack();
    if (!t) return "";
    if (t.kind === "melodic") return rollView(t);
    return `<div class="st-seq">
      <div class="st-grid">
        ${S.proj.tracks.filter((x) => x.kind === "drum").map((tr) => `
          <div class="st-row ${S.sel === tr.id ? "sel" : ""}">
            <button class="st-rl" data-sel="${tr.id}">${esc(tr.name)}</button>
            <div class="st-cells">
              ${Array.from({ length: STEPS }, (_, i) => {
                const idx = S.editBar * STEPS + i;
                const c = tr.steps[idx];
                return `<button class="st-c ${c ? "on v" + (c.v || 2) : ""} ${i % 4 === 0 ? "bt" : ""}"
                  data-cell="${tr.id}:${idx}" data-step="${i}"></button>`;
              }).join("")}
            </div>
          </div>`).join("")}
      </div>
      <div class="st-hint mono dim">TAP = ON · AGAIN = LOUDER · HOLD = CLEAR${DRUM_KITS[t.voice] ? " · SOUND ↓" : ""}</div>
      ${DRUM_KITS[t.voice] ? `<div class="st-vars">
        ${DRUM_KITS[t.voice].map((n, i) => `<button class="st-chip ${t.variant === i ? "on" : ""}" data-var="${i}">${n}</button>`).join("")}
      </div>` : ""}
    </div>`;
  }

  function rollView(t) {
    const rows = scaleNotes(S.proj.key, S.proj.scale, S.octave, 2);
    return `<div class="st-seq">
      <div class="st-rollhead">
        <span class="mono dim">${esc(t.name)} · ${NOTES[S.proj.key]} ${esc(S.proj.scale)}</span>
        <div class="st-oct">
          <button class="st-ic" data-oct="-1">−</button>
          <span class="mono">OCT ${S.octave}</span>
          <button class="st-ic" data-oct="1">+</button>
        </div>
      </div>
      <div class="st-roll">
        ${rows.map((m) => `<div class="st-rr">
          <span class="st-key ${NOTES[m % 12].includes("#") ? "blk" : ""}">${NOTES[m % 12]}${Math.floor(m / 12) - 1}</span>
          <div class="st-cells">
            ${Array.from({ length: STEPS }, (_, i) => {
              const idx = S.editBar * STEPS + i;
              const c = t.steps[idx];
              const on = c && c.n && c.n.includes(m);
              return `<button class="st-c ${on ? "on v" + (c.v || 2) : ""} ${i % 4 === 0 ? "bt" : ""}"
                data-note="${t.id}:${idx}:${m}" data-step="${i}"></button>`;
            }).join("")}
          </div>
        </div>`).join("")}
      </div>
      ${t.voice === "synth" ? `<div class="st-vars">
        ${SYNTH_WAVES.map((w) => `<button class="st-chip ${t.wave === w ? "on" : ""}" data-wave="${w}">${w}</button>`).join("")}
      </div>` : ""}
      <div class="st-hint mono dim">SCALE LOCKED — EVERY NOTE HERE IS IN KEY</div>
    </div>`;
  }

  function mixView() {
    return `<div class="st-mix">
      ${S.proj.tracks.map((t) => `<div class="st-strip">
        <div class="st-sn">${esc(t.name)}</div>
        <input class="st-fader" type="range" min="0" max="100" value="${Math.round(t.vol * 100)}" data-vol="${t.id}" orient="vertical">
        <div class="st-pan"><input type="range" min="-100" max="100" value="${Math.round(t.pan * 100)}" data-pan="${t.id}"><span class="mono dim">${t.pan === 0 ? "C" : (t.pan < 0 ? "L" : "R") + Math.abs(Math.round(t.pan * 100))}</span></div>
        <div class="st-ms">
          <button class="st-mb ${t.mute ? "on" : ""}" data-mute="${t.id}">M</button>
          <button class="st-mb ${t.solo ? "on" : ""}" data-solo="${t.id}">S</button>
        </div>
      </div>`).join("")}
      <div class="st-strip st-master">
        <div class="st-sn">MASTER</div>
        <input class="st-fader" type="range" min="0" max="100" value="${Math.round(S.proj.master.vol * 100)}" data-mvol orient="vertical">
        <div class="mono dim">OUT</div>
      </div>
    </div>`;
  }

  function fxView() {
    const t = selTrack();
    return `<div class="st-fx">
      <div class="mono dim">${esc(t.name)} — CHANNEL FX</div>
      <label class="st-f">FILTER<input type="range" min="200" max="20000" step="100" value="${t.cutoff}" data-cut><b>${t.cutoff >= 20000 ? "OPEN" : (t.cutoff / 1000).toFixed(1) + "k"}</b></label>
      <label class="st-f">RESO<input type="range" min="0.5" max="14" step="0.1" value="${t.reso}" data-res><b>${t.reso.toFixed(1)}</b></label>
      <label class="st-f">REVERB<input type="range" min="0" max="100" value="${Math.round(t.reverb * 100)}" data-rev><b>${Math.round(t.reverb * 100)}</b></label>
      <label class="st-f">DELAY<input type="range" min="0" max="100" value="${Math.round(t.delay * 100)}" data-del><b>${Math.round(t.delay * 100)}</b></label>
      ${t.kind === "melodic" ? `
      <label class="st-f">ATTACK<input type="range" min="1" max="500" value="${Math.round(t.attack * 1000)}" data-atk><b>${Math.round(t.attack * 1000)}ms</b></label>
      <label class="st-f">RELEASE<input type="range" min="30" max="2000" value="${Math.round(t.release * 1000)}" data-rel><b>${Math.round(t.release * 1000)}ms</b></label>
      <label class="st-f">OCTAVE<input type="range" min="-2" max="2" step="1" value="${t.octave}" data-toct><b>${t.octave > 0 ? "+" : ""}${t.octave}</b></label>` : ""}
      <div class="mono dim" style="margin-top:14px">MASTER</div>
      <label class="st-f">REVERB<input type="range" min="0" max="100" value="${Math.round(S.proj.master.reverb * 100)}" data-mrev><b>${Math.round(S.proj.master.reverb * 100)}</b></label>
      <label class="st-f">DELAY<input type="range" min="0" max="100" value="${Math.round(S.proj.master.delay * 100)}" data-mdel><b>${Math.round(S.proj.master.delay * 100)}</b></label>
      ${t.voice === "sampler" ? `<button class="st-btn" data-deltrack="${t.id}" style="margin-top:14px">Delete this take</button>` : ""}
    </div>`;
  }

  function paintPlayhead() {
    if (!S.el) return;
    const local = S.curStep % STEPS;
    const bar = Math.floor(S.curStep / STEPS);
    const show = S.playing && bar === S.editBar;
    S.el.querySelectorAll(".st-c").forEach((c) => {
      c.classList.toggle("now", show && +c.dataset.step === local);
    });
  }
  function paintTransport() {
    if (!S.el) return;
    const b = $("[data-play]");
    if (b) { b.textContent = S.playing ? "■" : "▶"; b.classList.toggle("on", S.playing); }
  }

  /* ---------------- wiring ---------------- */
  function wire() {
    const on = (sel, ev, fn) => S.el.querySelectorAll(sel).forEach((e) => e.addEventListener(ev, fn));

    $("[data-play]").onclick = () => (S.playing ? stop() : play(false));
    $("[data-rec]").onclick = () => (S.recording ? stopRec() : startRec());
    $("[data-metro]").onclick = () => { S.metro = !S.metro; paint(); };
    $("[data-undo]").onclick = doUndo;
    $("[data-redo]").onclick = doRedo;

    const nm = $("[data-name]"); if (nm) nm.oninput = () => { S.proj.name = nm.value; };
    const bpm = $("[data-bpm]"); if (bpm) bpm.oninput = () => {
      S.proj.bpm = +bpm.value; bpm.nextElementSibling.textContent = S.proj.bpm; rebuildIfPlaying();
    };
    const sw = $("[data-swing]"); if (sw) sw.oninput = () => { S.proj.swing = +sw.value; sw.nextElementSibling.textContent = S.proj.swing; };
    const hm = $("[data-hum]"); if (hm) hm.oninput = () => { S.proj.humanize = +hm.value; hm.nextElementSibling.textContent = S.proj.humanize; };

    on("[data-bars]", "click", (e) => { snapshot(); S.proj.bars = +e.currentTarget.dataset.bars; if (S.editBar >= S.proj.bars) S.editBar = 0; paint(); });
    on("[data-editbar]", "click", (e) => { S.editBar = +e.currentTarget.dataset.editbar; paint(); });
    const cb = $("[data-copybar]"); if (cb) cb.onclick = () => {
      snapshot();
      const next = (S.editBar + 1) % BARS;
      for (const t of S.proj.tracks) {
        for (let i = 0; i < STEPS; i++) {
          const src = t.steps[S.editBar * STEPS + i];
          t.steps[next * STEPS + i] = src ? JSON.parse(JSON.stringify(src)) : null;
        }
      }
      if (S.proj.bars < next + 1) S.proj.bars = next + 1;
      S.editBar = next; toast("Bar copied"); paint();
    };
    const kk = $("[data-key]"); if (kk) kk.onchange = () => { S.proj.key = +kk.value; paint(); };
    const sc = $("[data-scale]"); if (sc) sc.onchange = () => { S.proj.scale = sc.value; paint(); };
    on("[data-view]", "click", (e) => { S.view = e.currentTarget.dataset.view; paint(); });
    on("[data-sel]", "click", (e) => { S.sel = e.currentTarget.dataset.sel; paint(); });
    on("[data-oct]", "click", (e) => { S.octave = Math.max(0, Math.min(7, S.octave + +e.currentTarget.dataset.oct)); paint(); });

    /* drum cells — tap cycles velocity, hold clears */
    on(".st-c[data-cell]", "pointerdown", (e) => holdCell(e, (tid, idx) => {
      const t = track(tid); snapshot(); t.steps[idx] = null; paint();
    }, (tid, idx) => {
      const t = track(tid); snapshot();
      const c = t.steps[idx];
      if (!c) t.steps[idx] = { v: 2 };
      else if (c.v < 3) c.v++;
      else t.steps[idx] = null;
      previewHit(t, 60);
      paint();
    }));

    /* piano roll cells */
    on(".st-c[data-note]", "pointerdown", (e) => holdNote(e, (tid, idx, m) => {
      const t = track(tid); snapshot();
      const c = t.steps[idx];
      if (c && c.n) { c.n = c.n.filter((x) => x !== m); if (!c.n.length) t.steps[idx] = null; }
      paint();
    }, (tid, idx, m) => {
      const t = track(tid); snapshot();
      let c = t.steps[idx];
      if (!c) { t.steps[idx] = { v: 2, n: [m] }; }
      else if (!c.n.includes(m)) c.n.push(m);
      else if (c.v < 3) c.v++;
      else { c.n = c.n.filter((x) => x !== m); if (!c.n.length) t.steps[idx] = null; }
      previewHit(t, m);
      paint();
    }));

    on("[data-var]", "click", (e) => { snapshot(); selTrack().variant = +e.currentTarget.dataset.var; previewHit(selTrack(), 60); paint(); });
    on("[data-wave]", "click", (e) => { snapshot(); selTrack().wave = e.currentTarget.dataset.wave; previewHit(selTrack(), 60); paint(); });

    /* mixer */
    on("[data-vol]", "input", (e) => { track(e.currentTarget.dataset.vol).vol = +e.currentTarget.value / 100; rebuildIfPlaying(); });
    on("[data-pan]", "input", (e) => {
      const t = track(e.currentTarget.dataset.pan); t.pan = +e.currentTarget.value / 100;
      const lab = e.currentTarget.nextElementSibling;
      if (lab) lab.textContent = t.pan === 0 ? "C" : (t.pan < 0 ? "L" : "R") + Math.abs(Math.round(t.pan * 100));
      rebuildIfPlaying();
    });
    on("[data-mute]", "click", (e) => { const t = track(e.currentTarget.dataset.mute); t.mute = !t.mute; rebuildIfPlaying(); paint(); });
    on("[data-solo]", "click", (e) => { const t = track(e.currentTarget.dataset.solo); t.solo = !t.solo; rebuildIfPlaying(); paint(); });
    const mv = $("[data-mvol]"); if (mv) mv.oninput = () => { S.proj.master.vol = +mv.value / 100; rebuildIfPlaying(); };

    /* fx */
    const fx = [["[data-cut]", (t, v) => t.cutoff = +v], ["[data-res]", (t, v) => t.reso = +v],
      ["[data-rev]", (t, v) => t.reverb = +v / 100], ["[data-del]", (t, v) => t.delay = +v / 100],
      ["[data-atk]", (t, v) => t.attack = +v / 1000], ["[data-rel]", (t, v) => t.release = +v / 1000],
      ["[data-toct]", (t, v) => t.octave = +v]];
    for (const [sel, set] of fx) {
      const el = $(sel);
      if (el) el.oninput = () => { set(selTrack(), el.value); rebuildIfPlaying(); paintFxLabels(); };
    }
    const mr = $("[data-mrev]"); if (mr) mr.oninput = () => { S.proj.master.reverb = +mr.value / 100; rebuildIfPlaying(); paintFxLabels(); };
    const md = $("[data-mdel]"); if (md) md.oninput = () => { S.proj.master.delay = +md.value / 100; rebuildIfPlaying(); paintFxLabels(); };
    on("[data-deltrack]", "click", (e) => {
      snapshot();
      const id = e.currentTarget.dataset.deltrack;
      S.proj.tracks = S.proj.tracks.filter((t) => t.id !== id);
      delete S.buffers[id];
      S.sel = S.proj.tracks[0].id; paint();
    });

    /* footer */
    $("[data-save]").onclick = save;
    $("[data-drafts]").onclick = toggleDrafts;
    $("[data-export]").onclick = exportMenu;
    $("[data-publish]").onclick = publish;
    on("[data-load]", "click", (e) => loadDraft(e.currentTarget.dataset.load));
    on("[data-deldraft]", "click", (e) => delDraft(e.currentTarget.dataset.deldraft));
  }

  function paintFxLabels() {
    const t = selTrack();
    const set = (sel, v) => { const e = $(sel); if (e && e.nextElementSibling) e.nextElementSibling.textContent = v; };
    set("[data-cut]", t.cutoff >= 20000 ? "OPEN" : (t.cutoff / 1000).toFixed(1) + "k");
    set("[data-res]", t.reso.toFixed(1));
    set("[data-rev]", Math.round(t.reverb * 100));
    set("[data-del]", Math.round(t.delay * 100));
    set("[data-atk]", Math.round(t.attack * 1000) + "ms");
    set("[data-rel]", Math.round(t.release * 1000) + "ms");
    set("[data-toct]", (t.octave > 0 ? "+" : "") + t.octave);
    set("[data-mrev]", Math.round(S.proj.master.reverb * 100));
    set("[data-mdel]", Math.round(S.proj.master.delay * 100));
  }

  /* hold-to-clear, tap-to-toggle */
  function holdCell(e, onHold, onTap) {
    const el = e.currentTarget;
    const [tid, idx] = el.dataset.cell.split(":");
    let held = false;
    const timer = setTimeout(() => { held = true; onHold(tid, +idx); }, 420);
    const up = () => { clearTimeout(timer); if (!held) onTap(tid, +idx); cleanup(); };
    const cancel = () => { clearTimeout(timer); cleanup(); };
    const cleanup = () => { el.removeEventListener("pointerup", up); el.removeEventListener("pointerleave", cancel); };
    el.addEventListener("pointerup", up); el.addEventListener("pointerleave", cancel);
  }
  function holdNote(e, onHold, onTap) {
    const el = e.currentTarget;
    const [tid, idx, m] = el.dataset.note.split(":");
    let held = false;
    const timer = setTimeout(() => { held = true; onHold(tid, +idx, +m); }, 420);
    const up = () => { clearTimeout(timer); if (!held) onTap(tid, +idx, +m); cleanup(); };
    const cancel = () => { clearTimeout(timer); cleanup(); };
    const cleanup = () => { el.removeEventListener("pointerup", up); el.removeEventListener("pointerleave", cancel); };
    el.addEventListener("pointerup", up); el.addEventListener("pointerleave", cancel);
  }

  /* audition a sound when you place it — you should hear what you drew */
  function previewHit(t, midi) {
    if (S.playing) return;
    const c = audio();
    const g = buildGraph(c, S.proj, { soloTrack: t.id });
    playVoice(c, g.strips[t.id].input, t, c.currentTime + 0.01, 0.8, midi + t.octave * 12, S.buffers);
  }

  /* ---------------- persistence ---------------- */
  const strip = (p) => { const { id, ...rest } = p; return rest; };

  async function save() {
    if (!S.opts.api) return;
    S.saving = true; paint();
    try {
      const d = await S.opts.api.saveBeat({ id: S.proj.id, name: S.proj.name || "untitled", data: strip(S.proj) });
      S.proj.id = d.id;
      toast("Draft saved");
    } catch (e) { toast(e.message); }
    S.saving = false; paint();
  }
  async function toggleDrafts() {
    if (S.drafts) { S.drafts = null; return paint(); }
    try { S.drafts = (await S.opts.api.beats()).projects; paint(); } catch (e) { toast(e.message); }
  }
  async function loadDraft(id) {
    try {
      const d = await S.opts.api.beat(id);
      S.proj = migrate(d.project.data);
      S.proj.id = d.project.id; S.proj.name = d.project.name;
      S.buffers = {}; await loadBuffers(S.proj);
      S.drafts = null; S.editBar = 0; S.sel = S.proj.tracks[0].id; stop();
      toast("Loaded"); paint();
    } catch (e) { toast(e.message); }
  }
  async function delDraft(id) {
    try { await S.opts.api.delBeat(id); S.drafts = S.drafts.filter((d) => String(d.id) !== String(id)); paint(); }
    catch (e) { toast(e.message); }
  }
  function hasNotes() {
    return S.proj.tracks.some((t) => t.steps.slice(0, S.proj.bars * STEPS).some(Boolean));
  }
  async function publish() {
    if (!hasNotes()) return toast("Empty beat — put some notes down");
    stop();
    try {
      await S.opts.api.post({
        channel: "beats", body: "",
        beat: { name: S.proj.name || "untitled loop", bpm: S.proj.bpm, data: strip(S.proj) },
      });
      toast("Published to #beats");
      if (S.opts.onPublish) S.opts.onPublish();
    } catch (e) { toast(e.message); }
  }

  async function exportMenu() {
    if (!hasNotes()) return toast("Nothing to export yet");
    const stems = confirm("OK = separate stems (one WAV per track)\nCancel = single mixdown");
    stop();
    toast("Rendering…");
    const base = (S.proj.name || "tnl-beat").replace(/[^a-z0-9]+/gi, "-").toLowerCase();
    try {
      if (stems) {
        for (const t of S.proj.tracks) {
          if (!t.steps.slice(0, S.proj.bars * STEPS).some(Boolean)) continue;
          const blob = await renderProject(S.proj, S.buffers, t.id);
          download(blob, `${base}-${t.name.toLowerCase()}.wav`);
        }
        toast("Stems exported");
      } else {
        const blob = await renderProject(S.proj, S.buffers, null);
        download(blob, `${base}.wav`);
        toast("Mixdown exported");
      }
    } catch (e) { toast("Export failed: " + e.message); }
  }

  /* ---------------- public ---------------- */
  window.TNLStudio = {
    mount(el, opts) {
      S.el = el; S.opts = opts || {};
      if (!S.proj.tracks) S.proj = newProject();
      paint();
    },
    unmount() { stop(); S.el = null; },
    preview, stopPreview,
    isPlaying: () => S.playing || previewing,
    newProject, migrate,
  };
})();
