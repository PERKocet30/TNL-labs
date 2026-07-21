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
      drive: 0,        // saturation. an 808 without drive is a sine wave.
      duck: 0,         // sidechain — how hard the kick ducks this track
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
      master: { vol: 0.9, reverb: 0.25, delay: 0.22, delayTime: 0.375, loudness: 0.75 },
      tracks: [
        newTrack("kick", "KICK", "drum", "kick"),
        newTrack("snare", "SNARE", "drum", "snare"),
        newTrack("hat", "HAT", "drum", "hat", { reverb: 0.05 }),
        newTrack("clap", "CLAP", "drum", "clap", { reverb: 0.18 }),
        newTrack("perc", "PERC", "drum", "perc", { reverb: 0.15 }),
        newTrack("bass", "808", "melodic", "bass", { release: 0.55, octave: -1, drive: 0.35 }),
        newTrack("lead", "LEAD", "melodic", "synth", { wave: "sawtooth", cutoff: 2600, reverb: 0.3, delay: 0.28, release: 0.25 }),
        newTrack("keys", "KEYS", "melodic", "synth", { wave: "triangle", cutoff: 4000, reverb: 0.4, delay: 0.15, release: 0.5, vol: 0.6, duck: 0.5 }),
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

    /* ── THE MASTER CHAIN ──────────────────────────────────────────────
       A real Discord beat measures around −8 dBFS RMS, peaked at 0. The old
       chain here ceilinged near −6.5 dBFS PEAK, which lands about −18 RMS —
       ten decibels down. Next to anything else in the channel it didn't
       sound different, it sounded WEAK. Loudness isn't vanity; quiet is
       read as amateur before anyone hears a single sound.

       It also compressed and never made the gain back up, which is damage
       with no benefit.

       Signal flow: HPF → glue → drive into limiter → ceiling.
    ───────────────────────────────────────────────────────────────────── */

    // 1. Rumble below 25Hz is inaudible and eats headroom you could spend
    //    on the 808. Every mastering chain starts here.
    const hpf = ctx.createBiquadFilter();
    hpf.type = "highpass"; hpf.frequency.value = 25; hpf.Q.value = 0.7;

    // 2. Glue. Slow, gentle, ~2dB — makes separate hits feel like one record.
    const glue = ctx.createDynamicsCompressor();
    glue.threshold.value = -18;
    glue.knee.value = 12;          // soft — this should never be audible
    glue.ratio.value = 2;
    glue.attack.value = 0.02;      // slow enough to let transients through
    glue.release.value = 0.25;

    // 3. Drive INTO the limiter. This is where loudness actually comes from —
    //    you push level in and the ceiling holds it. Scaled by the master
    //    "loudness" control so it stays the producer's call.
    const push = ctx.createGain();
    const loud = proj.master.loudness ?? 0.75;
    push.gain.value = 1 + loud * 3.2;     // up to ~+12dB into the limiter

    // 4. The ceiling. Hard ratio, fast attack — a true brickwall, not a
    //    compressor pretending. Knee 0 so nothing sneaks over.
    const limiter = ctx.createDynamicsCompressor();
    limiter.threshold.value = -1.0;
    limiter.knee.value = 0;
    limiter.ratio.value = 20;
    limiter.attack.value = 0.001;
    limiter.release.value = 0.06;   // fast enough to stay dense, slow enough not to distort

    // 5. Final trim so we sit just under 0 and never actually clip.
    const ceiling = ctx.createGain();
    ceiling.gain.value = 0.94;

    out.connect(hpf); hpf.connect(glue); glue.connect(push);
    push.connect(limiter); limiter.connect(ceiling);
    ceiling.connect(ctx.destination);

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

      /* Saturation. An 808 is a sine wave — without drive it disappears on
         phone speakers, which is where most of this gets heard. tanh is the
         cheap, musical curve; hard clipping sounds like a bug. */
      let head = input;
      if (t.drive > 0) {
        const shaper = ctx.createWaveShaper();
        const amt = 1 + t.drive * 12;
        const curve = new Float32Array(1024);
        for (let i = 0; i < 1024; i++) {
          const x = (i / 512) - 1;
          curve[i] = Math.tanh(x * amt) / Math.tanh(amt);
        }
        shaper.curve = curve;
        shaper.oversample = "2x";        // stops drive turning into aliasing fizz
        const makeup = ctx.createGain();
        makeup.gain.value = 1 / (1 + t.drive * 0.5);   // drive shouldn't mean "louder"
        input.connect(shaper); shaper.connect(makeup);
        head = makeup;
      }

      const filter = ctx.createBiquadFilter();
      filter.type = "lowpass";
      filter.frequency.value = t.cutoff;
      filter.Q.value = t.reso;

      const panner = ctx.createStereoPanner ? ctx.createStereoPanner() : null;
      if (panner) panner.pan.value = t.pan;

      /* Sidechain. Every kick hit yanks this down and lets it breathe back —
         that pump IS the genre. A real compressor keyed off the kick would be
         "correct", but Web Audio has no sidechain input, and automating a
         gain node is what everyone actually does. It also sounds better:
         you get to choose the shape. */
      const duck = ctx.createGain(); duck.gain.value = 1;

      const audible = anySolo ? t.solo : !t.mute;
      const gain = ctx.createGain();
      gain.gain.value = (opts.soloTrack ? (opts.soloTrack === t.id ? 1 : 0) : (audible ? 1 : 0)) * t.vol;

      head.connect(filter);
      const tail = panner ? (filter.connect(panner), panner) : filter;
      tail.connect(duck);
      duck.connect(gain);
      gain.connect(out);

      const rs = ctx.createGain(); rs.gain.value = t.reverb;
      const ds = ctx.createGain(); ds.gain.value = t.delay;
      gain.connect(rs); rs.connect(reverb);
      gain.connect(ds); ds.connect(delay);

      strips[t.id] = { input, filter, gain, panner, duck, voices: {} };
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
  function playVoice(ctx, dest, track, when, vel, midi, buffers, opts) {
    const started = [];
    const g0 = ctx.createGain();
    g0.gain.value = vel;
    g0.connect(dest);

    const V = track.voice, variant = track.variant | 0;

    if (V === "kick") {
      /* A real kick is LAYERED: a click you hear on a phone speaker, and a
         body you feel. One sine with a pitch envelope is a 909 — fine in
         1983, thin next to anything in the Discord.
         [startHz, endHz, pitchDrop, decay, clickAmt] */
      const spec = [[150, 45, 0.11, 0.40, 0.5], [220, 55, 0.06, 0.22, 0.8], [110, 32, 0.18, 0.62, 0.25]][variant]
        || [150, 45, 0.11, 0.40, 0.5];

      // BODY — the part you feel
      const o = ctx.createOscillator(), g = ctx.createGain();
      o.type = "sine";
      o.frequency.setValueAtTime(spec[0], when);
      o.frequency.exponentialRampToValueAtTime(spec[1], when + spec[2]);
      adsr(g.gain, when, 1, 0.002, spec[3]);
      // a touch of saturation gives harmonics, so the kick survives being
      // played on a phone with no bass response at all
      const sat = ctx.createWaveShaper();
      const curve = new Float32Array(257);
      for (let i = 0; i < 257; i++) { const x = i / 128 - 1; curve[i] = Math.tanh(x * 1.8); }
      sat.curve = curve;
      o.connect(sat); sat.connect(g); g.connect(g0);
      o.start(when); o.stop(when + spec[3] + 0.05); started.push(o);

      // CLICK — the part you hear. 6ms of filtered noise; this is what makes
      // a kick cut through instead of turning to mud.
      if (spec[4] > 0) {
        const n = ctx.createBufferSource(); n.buffer = noiseBuffer(ctx, 0.02);
        const hp = ctx.createBiquadFilter(); hp.type = "highpass"; hp.frequency.value = 1200;
        const cg = ctx.createGain();
        adsr(cg.gain, when, spec[4] * 0.55, 0.0005, 0.006);
        n.connect(hp); hp.connect(cg); cg.connect(g0);
        n.start(when); started.push(n);
      }
    } else if (V === "snare") {
      /* Three layers, same as a real one: NOISE (the body), TONE (the pitch
         that stops it sounding like a hiss), and CRACK (the transient that
         makes it hit). Ours had two and no crack. */
      const spec = [[1800, 0.18, 0.7], [3000, 0.07, 0.5], [1200, 0.26, 0.85]][variant] || [1800, 0.18, 0.7];

      const n = ctx.createBufferSource(); n.buffer = noiseBuffer(ctx, spec[1] + 0.05);
      const f = ctx.createBiquadFilter(); f.type = "bandpass"; f.frequency.value = spec[0]; f.Q.value = 0.8;
      const g = ctx.createGain(); adsr(g.gain, when, spec[2], 0.001, spec[1]);
      n.connect(f); f.connect(g); g.connect(g0); n.start(when); started.push(n);

      // CRACK — 4ms of top end. Cheap, and it's the difference between a
      // snare and a "pfft".
      const c = ctx.createBufferSource(); c.buffer = noiseBuffer(ctx, 0.015);
      const chp = ctx.createBiquadFilter(); chp.type = "highpass"; chp.frequency.value = 5000;
      const cg = ctx.createGain(); adsr(cg.gain, when, 0.4, 0.0004, 0.004);
      c.connect(chp); chp.connect(cg); cg.connect(g0); c.start(when); started.push(c);

      if (variant !== 1) {
        // TONE — two detuned bodies, because one is a beep
        for (const [fr, amt] of [[190, 0.45], [330, 0.2]]) {
          const o = ctx.createOscillator(), og = ctx.createGain();
          o.type = "triangle"; o.frequency.setValueAtTime(fr * 1.15, when);
          o.frequency.exponentialRampToValueAtTime(fr, when + 0.03);
          adsr(og.gain, when, amt, 0.001, 0.1);
          o.connect(og); og.connect(g0); o.start(when); o.stop(when + 0.14); started.push(o);
        }
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
      /* The 808.

         A glide is not a retrigger with a pitch envelope — it's the SAME
         oscillator bending to a new note while it's still ringing. That
         distinction is the whole sound. So when a note slides, we reuse the
         voice that's already sounding and ramp its frequency; when it
         doesn't, we start fresh with the click transient.

         `voice` is the live oscillator+gain for this track, if any. */
      const f = midiToFreq(midi);
      const glide = opts && opts.slide && opts.voice && opts.voice.o;
      const dur = (opts && opts.dur) || track.release;

      if (glide) {
        const { o, g } = opts.voice;
        // exponential, because pitch is logarithmic — a linear ramp sounds wrong
        o.frequency.cancelScheduledValues(when);
        o.frequency.setValueAtTime(o.frequency.value, when);
        o.frequency.exponentialRampToValueAtTime(Math.max(20, f), when + 0.06);
        // hold it open; don't re-attack
        g.gain.cancelScheduledValues(when);
        g.gain.setValueAtTime(g.gain.value, when);
        g.gain.setValueAtTime(vel * 0.95, when);
        g.gain.exponentialRampToValueAtTime(0.0001, when + dur);
        try { o.stop(when + dur + 0.08); } catch (e) {}
        return { started, voice: opts.voice };
      }

      const o = ctx.createOscillator(), g = ctx.createGain();
      o.type = "sine";
      o.frequency.setValueAtTime(f * 2.6, when);          // the click
      o.frequency.exponentialRampToValueAtTime(f, when + 0.05);
      adsr(g.gain, when, 0.95, 0.004, dur);
      const sat = ctx.createWaveShaper();
      const curve = new Float32Array(257);
      for (let i = 0; i < 257; i++) { const x = i / 128 - 1; curve[i] = Math.tanh(x * 2.2); }
      sat.curve = curve;
      o.connect(sat); sat.connect(g); g.connect(g0);
      o.start(when); o.stop(when + dur + 0.08); started.push(o);
      return { started, voice: { o, g } };
    } else if (V === "synth") {
      const f = midiToFreq(midi);
      const g = ctx.createGain();
      const dur = (opts && opts.dur) || track.release;
      adsr(g.gain, when, 0.5, track.attack, dur);
      // two detuned oscillators = width without a chorus
      [-6, 6].forEach((cents) => {
        const o = ctx.createOscillator();
        o.type = track.wave; o.frequency.value = f; o.detune.value = cents;
        o.connect(g); o.start(when); o.stop(when + dur + 0.1); started.push(o);
      });
      g.connect(g0);
    } else if (V === "sampler") {
      const buf = buffers && buffers[track.id];
      if (!buf) return { started, voice: null };
      const s = ctx.createBufferSource();
      s.buffer = buf;
      s.playbackRate.value = Math.pow(2, (midi - 60) / 12);
      const g = ctx.createGain();
      g.gain.setValueAtTime(1, when);
      s.connect(g); g.connect(g0); s.start(when); started.push(s);
    }
    return { started, voice: null };
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
    const sd = stepDur(proj);

    // Swing: push the off-beats late. This is what stops it sounding like a
    // drum machine from 1983.
    let swung = when;
    if (proj.swing > 0 && i % 2 === 1) swung += sd * (proj.swing / 100) * 0.5;

    const kickHits = !!(proj.tracks.find((t) => t.voice === "kick")?.steps[idx]);

    for (const t of proj.tracks) {
      const cell = t.steps[idx];
      const strip = graph.strips[t.id];
      if (!strip) continue;

      /* Sidechain fires on the kick, not on this track's own notes — duck
         everything that asked for it, whether or not it's currently playing.
         Scheduled, so it works identically in an offline render. */
      if (kickHits && t.duck > 0 && t.voice !== "kick") {
        const d = strip.duck.gain;
        const floor = Math.max(0.02, 1 - t.duck);
        d.cancelScheduledValues(swung);
        d.setValueAtTime(1, swung);
        d.linearRampToValueAtTime(floor, swung + 0.012);      // yank down fast
        d.exponentialRampToValueAtTime(1, swung + 0.012 + 0.09 + t.duck * 0.14); // breathe back
      }

      if (!cell) continue;

      let at = swung;
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

      // note length, in steps -> seconds. minus a hair so repeats retrigger.
      const len = Math.max(1, cell.len || 1);
      const dur = t.kind === "melodic" ? Math.max(0.08, len * sd - 0.01) : undefined;

      const notes = t.kind === "melodic" ? (cell.n && cell.n.length ? cell.n : [60]) : [60];
      let started = [];
      for (const midi of notes) {
        const r = playVoice(ctx, strip.input, t, at, vel, midi + t.octave * 12, buffers, {
          dur,
          slide: !!cell.slide,
          voice: strip.voices ? strip.voices[t.id] : null,
        });
        const list = r && r.started ? r.started : (Array.isArray(r) ? r : []);
        started = started.concat(list);
        // remember the live voice so a following slide can bend it
        if (strip.voices) strip.voices[t.id] = (r && r.voice) || null;
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
    const total = stepDur(proj) * STEPS * bars + 2.5; // tail for reverb + limiter release
    const ctx = new OfflineAudioContext(2, Math.ceil(rate * total), rate);
    const graph = buildGraph(ctx, proj, { soloTrack });
    const chokes = {};
    // buildGraph gives every strip a fresh `voices` map, so slides render
    // exactly as they sound live — the export IS what you heard.
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
    sounds: null,        // the producer's uploaded library
    soundsOpen: false,
    soundTarget: null,   // which track we're picking a sound for
    uploading: false,
    noteEdit: null,     // {trackId, idx, midi} — the long-pressed note
    soundTab: "mine",   // mine | library
    library: null,
    librarySlot: "",
    slotLabels: {},
    slotTrack: {},
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
    if (!S._played) { S._played = true; track_("play"); }
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
  async function preview(beat) {
    if (previewing) { stopPreview(); return; }
    const p = migrate(beat && (beat.proj || beat.data) ? (beat.proj || beat.data) : beat);
    const saved = S.proj, savedBuffers = S.buffers, savedPlaying = S.playing;
    if (savedPlaying) stop();
    /* The previewed beat gets its OWN buffer table. Track ids collide across
       projects (everyone's kick is t1), so sharing S.buffers would splice the
       listener's takes into someone else's beat — and before this, sampler
       tracks in a previewed beat simply never sounded at all. */
    S.proj = p; S.buffers = {};
    previewing = true;
    try { await loadBuffers(p); } catch (e) {}
    if (!previewing) { S.proj = saved; S.buffers = savedBuffers; return; } // stopped mid-load
    play(false);
    const ms = stepDur(p) * STEPS * Math.max(1, p.bars) * 1000 * 2 + 400;
    previewTimer = setTimeout(() => { stopPreview(); }, ms);
    window.__tnlRestore = () => { S.proj = saved; S.buffers = savedBuffers; };
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
      // old beats predate the master chain — give them the new default
      p.master = Object.assign(newProject().master, raw.master || {});
      if (p.master.loudness === undefined) p.master.loudness = 0.75;
      /* Old beats predate drive/duck/len/slide. Object.assign over a fresh
         track gives every missing field its default, so a beat published
         last week still plays — just without the new tricks. */
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

  /* Tells the app how the studio is being used. Metadata only — which
     built-in voice got thrown away, what got published at what BPM. Never
     the audio. Fire-and-forget: a metrics call must never be able to break
     the instrument it's measuring. */
  function track_(kind, d) {
    try { if (S.opts.event) S.opts.event(kind, d || {}); } catch (e) {}
  }

  /* ================================================================
     THE PRODUCER'S OWN SOUNDS
     Everything here is synthesised, which is why it opens instantly — and
     exactly why a producer with a kit they already love couldn't use it.
     Upload once, drop onto any track, in any project. The `sampler` voice
     that mic takes already use does the playback; this just feeds it files.
  ================================================================ */
  async function loadLibrary() {
    if (!S.opts.api) return;
    try { S.library = await S.opts.api.library(S.librarySlot);
      if (S.library.slotLabels) S.slotLabels = S.library.slotLabels;
      paint(); }
    catch (e) { S.library = { bySlot: {}, count: 0, contributors: 0 }; paint(); }
  }

  /* Someone gave this to the network. Using it tells them so, and earns them
     rep — that's the point of the library, not the file. */
  async function useLibrarySound(sample) {
    const t = track(S.sel);
    if (!t) return;
    try {
      const d = await S.opts.api.useLibrary(sample.id);
      snapshot();
      if (t.voice !== "sampler") track_("voice_replaced", { voice: t.voice });
      t.voice = "sampler";
      t.sampleUrl = d.url || sample.url;
      t.sampleName = sample.name + " — " + sample.by.displayName;
      const res = await fetch(t.sampleUrl);
      S.buffers[t.id] = await audio().decodeAudioData(await res.arrayBuffer());
      toast(t.name + " → " + sample.name + " (" + sample.by.displayName + " knows)");
      S.soundsOpen = false; paint();
    } catch (e) { toast(e.message); }
  }

  async function shareSound(id, on) {
    try {
      await S.opts.api.shareSample(id, on);
      const s2 = (S.sounds || []).find((x) => x.id === id);
      if (s2) s2.shared = on;
      toast(on ? "In the library — you'll be credited" : "Taken out of the library");
      paint();
    } catch (e) { toast(e.message); }
  }

  async function loadSounds() {
    if (!S.opts.api) return;
    try { const d = await S.opts.api.samples(); S.sounds = d.samples;
      if (d.slotLabels) S.slotLabels = d.slotLabels;
      if (d.slotTrack) S.slotTrack = d.slotTrack;
      paint(); }
    catch (e) { S.sounds = []; paint(); }
  }

  /* Measures a decoded buffer. Runs in the browser, on audio that's already
     in memory because we just decoded it to play. Returns numbers, nothing
     else — the file never goes anywhere it wasn't already going. */
  function measure(buf) {
    const d = buf.getChannelData(0);
    const sr = buf.sampleRate;
    let peak = 0, sum = 0;
    for (let i = 0; i < d.length; i++) { const a = Math.abs(d[i]); if (a > peak) peak = a; sum += d[i] * d[i]; }
    const rms = Math.sqrt(sum / d.length);
    if (peak < 0.0001) return null;

    // decay: how long until it drops 40dB off its peak
    const floor = peak * 0.01;
    let decay = d.length;
    for (let i = d.length - 1; i >= 0; i--) { if (Math.abs(d[i]) > floor) { decay = i; break; } }

    /* Fundamental via autocorrelation over the first 60ms. Crude, but for a
       kick or an 808 — which is what matters here — it's reliable. */
    const win = Math.min(Math.floor(sr * 0.06), d.length);
    let bestLag = 0, bestCorr = 0;
    const minLag = Math.floor(sr / 800), maxLag = Math.floor(sr / 25);
    for (let lag = minLag; lag < Math.min(maxLag, win); lag++) {
      let c = 0;
      for (let i = 0; i < win - lag; i += 2) c += d[i] * d[i + lag];
      if (c > bestCorr) { bestCorr = c; bestLag = lag; }
    }
    const fundamental = bestLag && bestCorr > 0.01 ? sr / bestLag : null;

    /* Spectral centroid — "brightness". A zero-crossing proxy: cheap, and
       it separates a kick from a hat, which is all we need. */
    let zc = 0;
    for (let i = 1; i < d.length; i++) if ((d[i - 1] < 0) !== (d[i] < 0)) zc++;
    const centroid = (zc / 2) * (sr / d.length);

    return {
      fundamental: fundamental ? Math.round(fundamental * 10) / 10 : null,
      decayMs: Math.round((decay / sr) * 1000),
      peakDb: Math.round(20 * Math.log10(peak) * 10) / 10,
      rmsDb: Math.round(20 * Math.log10(Math.max(rms, 1e-6)) * 10) / 10,
      centroid: Math.round(centroid),
      durationMs: Math.round((d.length / sr) * 1000),
    };
  }

  /* A producer's kit is named, not tagged: "808 Mafia Kick 03.wav",
     "OH_open.wav", "vox chop C.wav". Sorting 40 files by hand is the thing
     that makes someone close the app, so read the name.

     Order matters — "open hat" must beat "hat", "808" must beat "kick"
     even though plenty of 808 files say "808 kick". */
  const slotLabel = (k) => S.slotLabels[k] || k;

  function guessSlot(name) {
    let n = name.toLowerCase().replace(/[_\-.]+/g, " ");

    /* Strip brand names FIRST. "808 Mafia Kick" is a kick by 808 Mafia —
       one of the most common filenames in trap — and skipping the rule
       isn't enough, because the next one still sees "808". Remove it. */
    n = n.replace(/808 ?mafia|808 ?melo|metro ?boomin|southside/g, " ");

    const rules = [
      [/\bopen ?hat|\boh\b|ohat/, "openhat"],
      [/\b808\b|\bsub ?bass|\bsub\b/, "808"],
      [/\bkick|\bbd\b|bass ?drum/, "kick"],
      [/\bsnare|\bsd\b|\bsnr\b/, "snare"],
      [/\bclap|\bclp\b|\bcp\b/, "clap"],
      [/\bsnap|finger/, "snap"],
      [/\bhat|\bhh\b|\bch\b|hi ?hat/, "hat"],
      [/\brim ?shot|\brim\b/, "rim"],
      [/\btom\b|floor ?tom/, "tom"],
      [/\bcrash|\bcym|\bride\b|splash/, "crash"],
      [/\bperc|shaker|conga|bongo|cowbell|tamb|triangle|woodblock/, "perc"],
      [/\bvox\b|vocal|\bchop|adlib|\bad ?lib/, "vocal"],
      [/\briser|\bfx\b|sweep|impact|downlifter|uplifter|whoosh|reverse/, "fx"],
      [/\bmelody|\bloop\b|\bmel\b|piano|guitar|pluck|pad\b|bell/, "melody"],
      [/\bbass\b/, "bass"],
    ];
    for (const [re, slot] of rules) if (re.test(n)) return slot;
    return "other";
  }

  async function uploadSound(file, slot) {
    if (!S.opts.uploadAudio) return toast("Can't upload right now");
    if (!/^audio\//.test(file.type) && !/\.(wav|mp3|m4a|ogg|aiff?|flac)$/i.test(file.name)) {
      return toast("Audio files only — wav, mp3, m4a");
    }
    if (file.size > 20 * 1024 * 1024) return toast("That sound's too big — 20MB max");
    S.uploading = true; paint();
    try {
      const url = await S.opts.uploadAudio(file);
      const name = file.name.replace(/\.[^.]+$/, "").slice(0, 60);
      const added = await S.opts.api.addSample({ name, url, slot: slot || "other", kit: "", bytes: file.size });

      /* We're about to decode it anyway to play it. While it's decoded,
         measure the shape and send the numbers — that's how the built-in
         sounds get better. The audio itself doesn't go anywhere. */
      try {
        const res = await fetch(url);
        const buf = await audio().decodeAudioData(await res.arrayBuffer());
        const shape = measure(buf);
        if (shape && added && added.id) await S.opts.api.sampleShape(added.id, shape);
      } catch (e) { /* measuring is a nice-to-have; never block the upload */ }

      await loadSounds();
      toast('"' + name + '" added to your sounds');
    } catch (e) { toast(e.message); }
    S.uploading = false; paint();
  }

  /* Put a sound on a track. The track stops synthesising and starts playing
     the file — that's the whole feature. */
  async function useSound(trackId, sample) {
    // A producer dropping an open hat expects it on the hat track. Guessing
    // right is the difference between a tool and a form.
    const suggested = S.slotTrack[sample.slot];
    if (suggested && suggested !== trackId && track(suggested)) trackId = suggested;
    const t = track(trackId);
    if (!t) return;
    snapshot();
    /* This is the honest one. They heard my kick, didn't like it, and
       loaded their own. Record WHICH voice — that's the fix list. */
    if (t.voice !== "sampler") track_("voice_replaced", { voice: t.voice });
    t.voice = "sampler";
    t.sampleUrl = sample.url;
    t.sampleName = sample.name;
    try {
      const res = await fetch(sample.url);
      S.buffers[trackId] = await audio().decodeAudioData(await res.arrayBuffer());
      toast(t.name + " → " + sample.name);
    } catch (e) { toast("Couldn't load that sound"); }
    S.soundsOpen = false; S.soundTarget = null;
    paint();
  }

  /* Back to the built-in synth voice. */
  function resetVoice(trackId) {
    const t = track(trackId);
    if (!t) return;
    snapshot();
    const orig = newProject().tracks.find((x) => x.id === trackId);
    t.voice = orig ? orig.voice : "kick";
    t.sampleUrl = ""; t.sampleName = "";
    delete S.buffers[trackId];
    toast(t.name + " → built-in");
    paint();
  }

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
          <button class="st-ic ${S.soundsOpen ? "on" : ""}" data-sounds title="Your sounds">◈</button>
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
          <span class="mono dim">PAT</span>
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
            <span class="mono st-tk">${t.sampleUrl ? "◈" : t.kind === "melodic" ? "♪" : "▣"}</span>
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
      ${S.soundsOpen ? soundsView() : ""}
      ${S.noteEdit ? noteEditView() : ""}
    </div>`;
  }

  /* Long-press a note. FL gives you a right-click menu here; on a phone
     long-press is the only gesture that doesn't fight with tap-to-place.
     This is where length and slide live — the two things that turn a step
     sequencer into an instrument. */
  function noteEditView() {
    if (!S.noteEdit) return "";
    const { trackId, idx } = S.noteEdit;
    const t = track(trackId);
    const cell = t && t.steps[idx];
    if (!cell) return "";
    const melodic = t.kind === "melodic";
    const maxLen = STEPS * Math.max(1, S.proj.bars) - (idx % STEPS);
    return `<div class="st-noteedit" id="nebg"><div class="st-nec">
      <div class="st-neh">
        <div><b>${esc(t.name)}</b><div class="mono dim">STEP ${(idx % STEPS) + 1}${melodic && cell.n ? " · " + cell.n.map(m => NOTES[m % 12] + (Math.floor(m / 12) - 1)).join(" ") : ""}</div></div>
        <button class="st-ic" data-nex>✕</button>
      </div>

      <div class="mono dim st-nel">VELOCITY</div>
      <div class="st-vrow">${[1, 2, 3].map(v => `<button class="st-chip ${(cell.v || 2) === v ? "on" : ""}" data-nev="${v}">${["", "soft", "mid", "hard"][v]}</button>`).join("")}</div>

      ${melodic ? `
        <div class="mono dim st-nel">LENGTH — ${cell.len || 1} step${(cell.len || 1) === 1 ? "" : "s"}</div>
        <div class="st-lrow">
          <button class="st-ic" data-nelen="-1">−</button>
          <input type="range" min="1" max="${Math.min(16, maxLen)}" value="${cell.len || 1}" data-nelenr>
          <button class="st-ic" data-nelen="1">+</button>
        </div>
        <div class="st-lpre">${[1, 2, 4, 8, 16].filter(n => n <= maxLen).map(n =>
          `<button class="st-chip sm ${(cell.len || 1) === n ? "on" : ""}" data-nelenset="${n}">${n === 1 ? "1/16" : n === 2 ? "1/8" : n === 4 ? "1/4" : n === 8 ? "1/2" : "1 bar"}</button>`).join("")}</div>

        ${t.voice === "bass" || t.voice === "synth" ? `
          <div class="mono dim st-nel">SLIDE</div>
          <button class="st-slide ${cell.slide ? "on" : ""}" data-neslide>
            <span class="st-sglyph">${cell.slide ? "↝" : "↧"}</span>
            <div><b>${cell.slide ? "Glides from the note before" : "Retriggers"}</b>
            <div class="mono dim">${cell.slide
              ? "Same voice bends to this pitch — the 808 slide."
              : "Tap to glide instead of restarting. Needs a note before it."}</div></div>
          </button>` : ""}
      ` : ""}

      <button class="st-btn" data-nedel>Delete this note</button>
    </div></div>`;
  }

  function soundsView() {
    const t = selTrack();
    return `<div class="st-sounds">
      <div class="st-sh">
        <div><b>Sounds</b>
        <div class="mono dim">Drop any sound on ${esc(t ? t.name : "a track")}. It replaces the built-in.</div></div>
        <button class="st-ic" data-soundsx>✕</button>
      </div>
      <div class="st-stabs">
        <button class="st-chip ${S.soundTab === "mine" ? "on" : ""}" data-stab="mine">Yours${S.sounds ? " " + S.sounds.length : ""}</button>
        <button class="st-chip ${S.soundTab === "library" ? "on" : ""}" data-stab="library">◈ The library${S.library ? " " + S.library.count : ""}</button>
      </div>
      ${S.soundTab === "library" ? libraryView() : mySoundsView()}
    </div>`;
  }

  /* The library. Sounds producers CHOSE to give the network — every one
     credited, and every use tells them. */
  function libraryView() {
    const L = S.library;
    if (!L) return `<div class="st-hint mono dim" style="margin-top:12px">Loading…</div>`;
    const t = selTrack();
    const slots = Object.keys(L.bySlot);
    if (!L.count) return `<div class="st-hint mono dim" style="margin-top:12px;line-height:1.7">
      NOTHING IN THE LIBRARY YET.<br><br>
      IT FILLS UP WHEN PRODUCERS SHARE THEIR SOUNDS. SHARE ONE OF YOURS AND
      YOU'RE THE FIRST — YOU GET CREDITED EVERY TIME SOMEONE BUILDS WITH IT.
    </div>`;
    return `
      <div class="st-lslots">
        <button class="st-chip sm ${!S.librarySlot ? "on" : ""}" data-lslot="">All</button>
        ${(L.slots || []).filter((x) => L.bySlot[x]).map((x) =>
          `<button class="st-chip sm ${S.librarySlot === x ? "on" : ""}" data-lslot="${x}">${esc(slotLabel(x))}</button>`).join("")}
      </div>
      <div class="mono dim st-lmeta">${L.count} SOUNDS FROM ${L.contributors} PRODUCER${L.contributors === 1 ? "" : "S"}</div>
      ${slots.map((slot) => `
        <div class="st-kit">
          <div class="mono dim st-kitname">${esc(slotLabel(slot).toUpperCase())}</div>
          ${L.bySlot[slot].map((x) => `<div class="st-snd">
            <button class="st-sp" data-lprev="${x.id}" title="Hear it">▶</button>
            <div class="st-sn2">${esc(x.name)}
              <div class="mono dim">by ${esc(x.by.displayName)}${x.uses ? " · " + x.uses + " building with it" : ""}${x.fundamental ? " · " + Math.round(x.fundamental) + "Hz" : ""}</div>
            </div>
            <button class="st-use" data-luse="${x.id}">→ ${esc(t ? t.name : "TRACK")}</button>
          </div>`).join("")}
        </div>`).join("")}
    `;
  }

  function mySoundsView() {
    const t = selTrack();
    const byKit = {};
    for (const s2 of (S.sounds || [])) (byKit[s2.kit || "Your sounds"] = byKit[s2.kit || "Your sounds"] || []).push(s2);
    return `
      <input type="file" id="stsoundin" accept="audio/*,.wav,.mp3,.m4a,.aiff,.aif,.flac" hidden multiple>
      <button class="st-btn ${S.uploading ? "" : "green"}" data-soundadd ${S.uploading ? "disabled" : ""}>
        ${S.uploading ? "Uploading…" : "＋ Upload sounds"}</button>
      <div class="st-privacy mono">
        YOUR SOUNDS STAY YOURS. WE MEASURE THE SHAPE — PITCH, LENGTH, BRIGHTNESS —
        TO FIX THE BUILT-IN SOUNDS. NEVER THE AUDIO, NEVER YOUR MUSIC, NEVER SHARED
        UNLESS YOU SHARE IT.
      </div>
      ${S.sounds === null ? `<div class="st-hint mono dim" style="margin-top:12px">Loading…</div>`
        : !S.sounds.length ? `<div class="st-hint mono dim" style="margin-top:12px;line-height:1.7">
            NOTHING YET. UPLOAD A KICK, A SNARE, A WHOLE KIT — WAV, MP3, AIFF.<br>
            THEY STAY IN YOUR ACCOUNT AND WORK IN EVERY PROJECT.</div>`
        : Object.entries(byKit).map(([kit, list]) => `
          <div class="st-kit">
            <div class="mono dim st-kitname">${esc(kit).toUpperCase()}</div>
            ${list.map((s2) => `<div class="st-snd">
              <button class="st-sp" data-sprev="${s2.id}" title="Hear it">▶</button>
              <div class="st-sn2">${esc(s2.name)}
                <div class="mono dim">${esc(slotLabel(s2.slot))}${s2.uses ? " · " + s2.uses + " building with it" : ""}</div>
              </div>
              <button class="st-share ${s2.shared ? "on" : ""}" data-sshare="${s2.id}"
                title="${s2.shared ? "In the library" : "Give it to the network"}">◈</button>
              <button class="st-use" data-suse="${s2.id}">→ ${esc(t ? t.name : "TRACK")}</button>
              <button class="st-ic" data-sdel="${s2.id}" title="Delete">✕</button>
            </div>`).join("")}
          </div>`).join("")}
      ${(S.sounds || []).some((x) => x.shared) ? `<div class="st-privacy mono" style="border-color:color-mix(in srgb, var(--green) 40%, transparent);color:var(--green)">
        ◈ = IN THE LIBRARY. YOU'RE CREDITED EVERY TIME SOMEONE BUILDS WITH IT,
        AND YOU EARN STANDING WHEN THEY DO.
      </div>` : `<div class="st-privacy mono">
        TAP ◈ TO GIVE A SOUND TO THE NETWORK. YOU KEEP IT, YOU GET CREDITED,
        AND YOU EARN STANDING EVERY TIME SOMEONE BUILDS WITH IT.
      </div>`}
      ${t && t.sampleUrl ? `<button class="st-btn" data-sreset style="margin-top:10px">
        Reset ${esc(t.name)} to the built-in sound</button>` : ""}
    `;
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
                return `<button class="st-c g${Math.floor(i/4)%2} ${c ? "on v" + (c.v || 2) : ""} ${i % 4 === 0 ? "bt" : ""}"
                  data-cell="${tr.id}:${idx}" data-step="${i}"></button>`;
              }).join("")}
            </div>
          </div>`).join("")}
      </div>
      <div class="st-hint mono dim">TAP = ON · AGAIN = LOUDER · HOLD = EDIT${DRUM_KITS[t.voice] ? " · SOUND ↓" : ""}</div>
      ${DRUM_KITS[t.voice] ? `<div class="st-vars">
        ${t.sampleUrl
          ? `<span class="st-custom mono">◈ ${esc(t.sampleName || "your sound")}</span>
             <button class="st-chip" data-sreset>use built-in</button>`
          : DRUM_KITS[t.voice].map((n, i) => `<button class="st-chip ${t.variant === i ? "on" : ""}" data-var="${i}">${n}</button>`).join("")
            + `<button class="st-chip" data-sounds>◈ your sounds…</button>`}
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
              /* A note longer than one step has to LOOK longer, or the
                 length control is invisible and nobody finds it. Steps a
                 held note covers get a "tail" class. */
              let tail = false;
              if (!on) {
                for (let b = 1; b <= 16 && i - b >= 0; b++) {
                  const p = t.steps[S.editBar * STEPS + i - b];
                  if (p && p.n && p.n.includes(m) && (p.len || 1) > b) { tail = true; break; }
                  if (p && p.n && p.n.includes(m)) break;
                }
              }
              return `<button class="st-c g${Math.floor(i/4)%2} ${on ? "on v" + (c.v || 2) : ""} ${tail ? "tail" : ""} ${i % 4 === 0 ? "bt" : ""} ${on && c.slide ? "slide" : ""}"
                data-note="${t.id}:${idx}:${m}" data-step="${i}">${on && c.slide ? "↝" : ""}</button>`;
            }).join("")}
          </div>
        </div>`).join("")}
      </div>
      ${t.voice === "synth" ? `<div class="st-vars">
        ${SYNTH_WAVES.map((w) => `<button class="st-chip ${t.wave === w ? "on" : ""}" data-wave="${w}">${w}</button>`).join("")}
      </div>` : ""}
      <div class="st-hint mono dim">SCALE LOCKED · TAP = NOTE · HOLD = LENGTH &amp; SLIDE</div>
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
      <label class="st-f">DRIVE<input type="range" min="0" max="100" value="${Math.round(t.drive * 100)}" data-drv><b>${Math.round(t.drive * 100)}</b></label>
      ${t.voice !== "kick" ? `<label class="st-f">DUCK<input type="range" min="0" max="100" value="${Math.round(t.duck * 100)}" data-duck><b>${Math.round(t.duck * 100)}</b></label>
      ${t.duck > 0 ? `<div class="st-hint mono" style="color:var(--green);margin:-4px 0 8px">↓ THE KICK PUMPS THIS ${Math.round(t.duck * 100)}%</div>` : ""}` : ""}
      <label class="st-f">REVERB<input type="range" min="0" max="100" value="${Math.round(t.reverb * 100)}" data-rev><b>${Math.round(t.reverb * 100)}</b></label>
      <label class="st-f">DELAY<input type="range" min="0" max="100" value="${Math.round(t.delay * 100)}" data-del><b>${Math.round(t.delay * 100)}</b></label>
      ${t.kind === "melodic" ? `
      <label class="st-f">ATTACK<input type="range" min="1" max="500" value="${Math.round(t.attack * 1000)}" data-atk><b>${Math.round(t.attack * 1000)}ms</b></label>
      <label class="st-f">RELEASE<input type="range" min="30" max="2000" value="${Math.round(t.release * 1000)}" data-rel><b>${Math.round(t.release * 1000)}ms</b></label>
      <label class="st-f">OCTAVE<input type="range" min="-2" max="2" step="1" value="${t.octave}" data-toct><b>${t.octave > 0 ? "+" : ""}${t.octave}</b></label>` : ""}
      <div class="mono dim" style="margin-top:14px">MASTER</div>
      <label class="st-f">LOUDNESS<input type="range" min="0" max="100" value="${Math.round((S.proj.master.loudness ?? 0.75) * 100)}" data-mloud><b>${Math.round((S.proj.master.loudness ?? 0.75) * 100)}</b></label>
      <div class="st-hint mono dim" style="margin:-4px 0 8px;line-height:1.6">
        ${(() => {
          /* Real targets, measured off actual beats — not vibes. There is no
             single "right" loudness: a dense trap beat wants to be crushed,
             a melodic one is ruined by the same treatment. */
          const l = S.proj.master.loudness ?? 0.75;
          if (l >= 0.85) return "CRUSHED · ≈-8 RMS — AS LOUD AS A DENSE TRAP MASTER.<br>NOTHING BREATHES. THAT'S THE POINT, IF THAT'S THE POINT.";
          if (l >= 0.6) return "MASTERED · ≈-10 RMS — SITS WITH ANYTHING IN THE CHANNEL.";
          if (l >= 0.35) return "OPEN · ≈-13 RMS — KEEPS THE DYNAMICS. MELODIC BEATS LIVE HERE.";
          return "QUIET · WILL SOUND SMALL NEXT TO EVERYTHING ELSE.";
        })()}
      </div>
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
    on("[data-sounds]", "click", () => {
      S.soundsOpen = !S.soundsOpen;
      if (S.soundsOpen && S.sounds === null) loadSounds();
      if (S.soundsOpen && S.soundTab === "library" && !S.library) loadLibrary();
      paint();
    });
    on("[data-stab]", "click", (e) => {
      S.soundTab = e.currentTarget.dataset.stab;
      if (S.soundTab === "library" && !S.library) loadLibrary();
      paint();
    });
    on("[data-lslot]", "click", (e) => { S.librarySlot = e.currentTarget.dataset.lslot; loadLibrary(); });
    on("[data-sshare]", "click", async (e) => {
      const id = +e.currentTarget.dataset.sshare;
      const s2 = (S.sounds || []).find((x) => x.id === id);
      if (!s2) return;
      if (!s2.shared && !(await uiConfirm('Give "' + s2.name + '" to the library?', "Anyone in TNL can build with it — you're credited every time and earn standing when someone uses it. Take it back whenever.", { okLabel: "Share it" }))) return;
      shareSound(id, !s2.shared);
    });
    on("[data-luse]", "click", (e) => {
      const id = +e.currentTarget.dataset.luse;
      let found = null;
      for (const list of Object.values(S.library?.bySlot || {})) { const x = list.find((y) => y.id === id); if (x) found = x; }
      if (found) useLibrarySound(found);
    });
    on("[data-lprev]", "click", async (e) => {
      const id = +e.currentTarget.dataset.lprev;
      let found = null;
      for (const list of Object.values(S.library?.bySlot || {})) { const x = list.find((y) => y.id === id); if (x) found = x; }
      if (!found) return;
      try {
        const c = audio();
        const res = await fetch(found.url);
        const buf = await c.decodeAudioData(await res.arrayBuffer());
        const src = c.createBufferSource(); src.buffer = buf;
        const g = c.createGain(); g.gain.value = 0.9;
        src.connect(g); g.connect(c.destination); src.start();
      } catch (err) { toast("Couldn't play that"); }
    });
    const sx = $("[data-soundsx]"); if (sx) sx.onclick = () => { S.soundsOpen = false; paint(); };
    const sadd = $("[data-soundadd]"); if (sadd) sadd.onclick = () => $("#stsoundin").click();
    const sin = $("#stsoundin");
    if (sin) sin.onchange = async () => {
      const files = [...(sin.files || [])]; sin.value = "";
      // Guess the slot from the filename — a producer's kit is named
      // "808 kick.wav", not tagged. Saves them sorting 10 files by hand.
      for (const f of files) {
        await uploadSound(f, guessSlot(f.name));
      }
    };
    on("[data-sprev]", "click", async (e) => {
      const s2 = (S.sounds || []).find((x) => String(x.id) === e.currentTarget.dataset.sprev);
      if (!s2) return;
      try {
        const c = audio();
        const res = await fetch(s2.url);
        const buf = await c.decodeAudioData(await res.arrayBuffer());
        const src = c.createBufferSource(); src.buffer = buf;
        const g = c.createGain(); g.gain.value = 0.9;
        src.connect(g); g.connect(c.destination); src.start();
      } catch (err) { toast("Couldn't play that"); }
    });
    on("[data-suse]", "click", (e) => {
      const s2 = (S.sounds || []).find((x) => String(x.id) === e.currentTarget.dataset.suse);
      if (s2) useSound(S.sel, s2);
    });
    on("[data-sdel]", "click", async (e) => {
      const id = e.currentTarget.dataset.sdel;
      try { await S.opts.api.delSample(id); S.sounds = S.sounds.filter((x) => String(x.id) !== id); paint(); }
      catch (err) { toast(err.message); }
    });
    on("[data-sreset]", "click", () => resetVoice(S.sel));

    /* ---- note editor ---- */
    const neb = $("#nebg"); if (neb) neb.onclick = (e) => { if (e.target === neb) { S.noteEdit = null; paint(); } };
    const nex = $("[data-nex]"); if (nex) nex.onclick = () => { S.noteEdit = null; paint(); };
    const ne = () => { const { trackId, idx } = S.noteEdit || {}; const t = track(trackId); return t && t.steps[idx]; };
    on("[data-nev]", "click", (e) => { const c = ne(); if (!c) return; snapshot(); c.v = +e.currentTarget.dataset.nev; paint(); });
    on("[data-nelen]", "click", (e) => {
      const c = ne(); if (!c) return; snapshot();
      c.len = Math.max(1, Math.min(16, (c.len || 1) + +e.currentTarget.dataset.nelen)); paint();
    });
    on("[data-nelenset]", "click", (e) => { const c = ne(); if (!c) return; snapshot(); c.len = +e.currentTarget.dataset.nelenset; paint(); });
    const ner = $("[data-nelenr]"); if (ner) ner.oninput = () => { const c = ne(); if (!c) return; c.len = +ner.value; paint(); };
    const nes = $("[data-neslide]"); if (nes) nes.onclick = () => {
      const c = ne(); if (!c) return; snapshot(); c.slide = !c.slide;
      if (c.slide && !S.playing) previewHit(track(S.noteEdit.trackId), (c.n && c.n[0]) || 60);
      paint();
    };
    const ned = $("[data-nedel]"); if (ned) ned.onclick = () => {
      const { trackId, idx } = S.noteEdit; const t = track(trackId);
      snapshot(); t.steps[idx] = null; S.noteEdit = null; paint();
    };
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
      // long-press: open the editor, don't just wipe it. Delete is in there.
      const t = track(tid);
      if (t && t.steps[idx]) { S.noteEdit = { trackId: tid, idx }; paint(); }
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
      const t = track(tid);
      if (t && t.steps[idx]) { S.noteEdit = { trackId: tid, idx, midi: m }; paint(); }
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
      ["[data-drv]", (t, v) => t.drive = +v / 100], ["[data-duck]", (t, v) => t.duck = +v / 100],
      ["[data-rev]", (t, v) => t.reverb = +v / 100], ["[data-del]", (t, v) => t.delay = +v / 100],
      ["[data-atk]", (t, v) => t.attack = +v / 1000], ["[data-rel]", (t, v) => t.release = +v / 1000],
      ["[data-toct]", (t, v) => t.octave = +v]];
    for (const [sel, set] of fx) {
      const el = $(sel);
      if (el) el.oninput = () => { set(selTrack(), el.value); rebuildIfPlaying(); paintFxLabels(); };
    }
    const ml = $("[data-mloud]"); if (ml) ml.oninput = () => {
      S.proj.master.loudness = +ml.value / 100; rebuildIfPlaying(); paint();
    };
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
    set("[data-drv]", Math.round(t.drive * 100));
    set("[data-duck]", Math.round(t.duck * 100));
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
      track_("save", { bpm: S.proj.bpm, key: NOTES[S.proj.key] + " " + S.proj.scale });
      toast("Draft saved");
    } catch (e) { toast(e.message); }
    S.saving = false; paint();
  }
  async function toggleDrafts() {
    if (S.drafts) { S.drafts = null; return paint(); }
    try { S.drafts = (await S.opts.api.beats()).projects; paint(); } catch (e) { toast(e.message); }
  }
  /* Open someone's published beat as YOUR project — the remix. Mirrors
     loadDraft's revival exactly; lineage rides on the project. */
  async function loadRemix(beatObj, meta) {
    try {
      S.proj = migrate(beatObj.data || {});
      delete S.proj.id;
      S.proj.name = (beatObj.name || "untitled") + " (remix)";
      S.proj.remixOf = meta || null;
      S.buffers = {}; await loadBuffers(S.proj);
      S.drafts = null; S.editBar = 0; S.sel = S.proj.tracks[0].id; stop();
      toast("Remixing @" + ((meta && meta.username) || "them") + " — make it yours");
      paint();
    } catch (e) { toast(e.message); }
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
        beat: { name: S.proj.name || "untitled loop", bpm: S.proj.bpm, data: strip(S.proj), remixOf: S.proj.remixOf || undefined },
      });
      track_("publish", { bpm: S.proj.bpm, key: NOTES[S.proj.key] + " " + S.proj.scale,
        detail: S.proj.tracks.filter(t => t.sampleUrl).length + " custom sounds" });
      toast("Published to #beats");
      if (S.opts.onPublish) S.opts.onPublish();
    } catch (e) { toast(e.message); }
  }

  async function exportMenu() {
    if (!hasNotes()) return toast("Nothing to export yet");
    const stems = await uiConfirm("Export your beat", "Stems give you one WAV per track.", { okLabel: "Separate stems", cancelLabel: "Single mixdown" });
    stop();
    track_("export", { bpm: S.proj.bpm, detail: stems ? "stems" : "mixdown" });
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
    loadRemix,
    mount(el, opts) {
      S.el = el; S.opts = opts || {};
      if (!S.proj.tracks) S.proj = newProject();
      if (!S._opened) { S._opened = true; track_("open"); }
      paint();
    },
    unmount() { stop(); S.el = null; },
    /* FL muscle memory lives on the keyboard. */
    _keys: document.addEventListener("keydown", (e) => {
      if (!S.el) return;                                          // studio not mounted
      const t = e.target, tag = t && t.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || (t && t.isContentEditable)) return;
      if (e.code === "Space") { e.preventDefault(); const b = S.el.querySelector("[data-play]"); if (b) b.click(); }
      else if ((e.ctrlKey || e.metaKey) && !e.shiftKey && e.key.toLowerCase() === "z") { e.preventDefault(); doUndo(); }
      else if ((e.ctrlKey || e.metaKey) && (e.key.toLowerCase() === "y" || (e.shiftKey && e.key.toLowerCase() === "z"))) { e.preventDefault(); doRedo(); }
    }),
    preview, stopPreview,
    isPlaying: () => S.playing || previewing,
    newProject, migrate,
  };
})();
