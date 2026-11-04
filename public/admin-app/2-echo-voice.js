/* LABS admin — Echo Home · Talk v1.0, 2026-11-04 ("make Echo interactive too, like speaking with a virtual AI"). The Talk
   button over the box opens a full screen conversation by voice: an orb that moves with you and with Echo, your words
   as you say them, Echo's sentence as it says it. You talk; a pause sends it (the same /api/echo/ask as typing — ehAsk);
   Echo speaks each sentence as soon as it's written (the live stream feeds evText), then listens again — hands free.
   Tap the orb to cut in, or to send before the pause; the mic button pauses listening; End (or Esc) closes it and the
   conversation is all there, in writing, behind it. A card Echo makes still waits for your tap — Talk never confirms
   anything. The phone's own speech recognition and voices: nothing new leaves the phone but the words you send,
   which is what typing sends. The screen is kept awake while it's open. */
const EV = { open: false, state: "", rec: null, heard: "", interim: "", silT: 0, sending: false, said: 0, final: false, pending: 0, energy: 0, raf: 0, wake: null, muted: false, restarts: 0 };
const evCan = () => ehCanDictate() && "speechSynthesis" in window && typeof SpeechSynthesisUtterance === "function";
const EV_WORD = { listening: "Listening", thinking: "Thinking", speaking: "Echo", idle: "Paused · tap to talk" };
/* the voice: the one picked on this device, else the most natural one the phone has in your language */
function evVoices() { try { const lang = (navigator.language || "en-US").slice(0, 2).toLowerCase(); return speechSynthesis.getVoices().filter((v) => String(v.lang || "").slice(0, 2).toLowerCase() === lang); } catch (e) { return []; } }
function evVoice() {
  const vs = evVoices(); let want = ""; try { want = localStorage.getItem("tnl-echo-voice-name") || ""; } catch (e) {}
  return vs.find((v) => v.name === want) || vs.find((v) => /natural|premium|enhanced|neural/i.test(v.name)) || vs.find((v) => /google (us|uk) english|samantha|ava|zoe|daniel|serena|karen|moira/i.test(v.name)) || vs.find((v) => v.default) || vs[0] || null;
}
const evVoiceOpts = () => { const cur = evVoice(); return evVoices().map((v) => `<option value="${esc(v.name)}" ${cur && cur.name === v.name ? "selected" : ""}>${esc(v.name.replace(/\s*\(.*\)$/, ""))}</option>`).join(""); };

function evOpen() {
  if (!evCan()) return toast("Talking needs Safari or Chrome");
  if (EV.open || !ehOn()) return;
  if (EH.rec) { try { EH.rec.stop(); } catch (e) {} }
  Object.assign(EV, { open: true, muted: false, sending: false, said: 0, final: true, pending: 0, energy: 0, restarts: 0 });
  const el = document.createElement("div"); el.className = "ev"; el.id = "ev"; el.setAttribute("role", "dialog"); el.setAttribute("aria-label", "Talking with Echo");
  el.innerHTML = `<div class="ev-top"><select class="eh-model ev-voice" id="evvoice" aria-label="Echo's voice">${evVoiceOpts()}</select><button class="ev-x" id="evx" aria-label="End">${I.x}</button></div>
    <button class="ev-orb" id="evorb" aria-label="Talk"><canvas id="evcv"></canvas></button>
    <div class="ev-state" id="evstate"></div><div class="ev-sub" id="evsub"></div>
    <div class="ev-bar"><button class="ev-b" id="evmute" aria-label="Pause listening">${di('<rect x="9" y="3" width="6" height="11"/><path d="M5 11a7 7 0 0 0 14 0M12 18v3"/>', 22)}</button><button class="ev-b end" id="evend">End</button></div>`;
  document.body.appendChild(el); document.body.classList.add("ev-on");
  requestAnimationFrame(() => el.classList.add("ev-in"));
  $("#evx").onclick = $("#evend").onclick = () => evClose();
  $("#evorb").onclick = () => evTap();
  $("#evmute").onclick = () => { EV.muted = !EV.muted; $("#evmute").classList.toggle("off", EV.muted); if (EV.muted) { evStopRec(); evSet("idle", ""); } else evListen(); };
  $("#evvoice").onchange = (e) => { try { localStorage.setItem("tnl-echo-voice-name", e.target.value); } catch (x) {} };
  const fillVoices = () => { const s = $("#evvoice"); if (s) { s.innerHTML = evVoiceOpts(); s.hidden = !s.options.length; } };   // no voices yet (or none): no empty picker
  fillVoices(); try { speechSynthesis.onvoiceschanged = fillVoices; } catch (e) {}
  try { navigator.wakeLock && navigator.wakeLock.request("screen").then((w) => { EV.wake = w; }, () => {}); } catch (e) {}
  EV.raf = requestAnimationFrame(evFrame);
  /* a first word from Echo, inside your tap — a phone only lets a page speak after a tap */
  const first = String((ME && (ME.display_name || ME.displayName || ME.username)) || "").split(" ")[0];
  EV.final = true; evSpeak(first ? `Hey ${first}. I'm listening.` : "I'm listening.");
}
function evClose() {
  if (!EV.open) return; EV.open = false; evStopRec(); clearTimeout(EV.silT);
  try { speechSynthesis.cancel(); } catch (e) {} EV.pending = 0;
  try { EV.wake && EV.wake.release(); } catch (e) {} EV.wake = null;
  cancelAnimationFrame(EV.raf); EV.raf = 0;
  const el = $("#ev"); if (el) el.remove(); document.body.classList.remove("ev-on");
  if (EH.draft) ehPaintFoot();
}
function evSet(state, sub) {
  EV.state = state; const s = $("#evstate"), o = $("#evorb"), t = $("#evsub");
  if (s) s.textContent = EV_WORD[state] || ""; if (o) { o.dataset.state = state; o.setAttribute("aria-label", state === "speaking" ? "Cut in" : state === "listening" ? "Send now" : "Talk"); }
  if (t && sub !== undefined) t.textContent = sub;
}
function evStopRec() { const r = EV.rec; EV.rec = null; if (r) { try { r.onend = null; r.stop(); } catch (e) {} } }
/* listening: words as you say them; a pause of 1.4s after you've said something sends it */
function evListen() {
  if (!EV.open || EV.muted || EV.sending) return;
  evStopRec(); EV.heard = ""; EV.interim = ""; evSet("listening", "");
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition, rec = new SR();
  rec.lang = navigator.language || "en-US"; rec.interimResults = true; rec.continuous = true;
  rec.onresult = (e) => {
    let interim = ""; for (let i = e.resultIndex; i < e.results.length; i++) { const r = e.results[i]; if (r.isFinal) EV.heard += r[0].transcript + " "; else interim += r[0].transcript; }
    EV.interim = interim; EV.energy = Math.min(1, EV.energy + 0.45); EV.restarts = 0;
    const said = (EV.heard + interim).replace(/\s+/g, " ").trim(); evSet("listening", said);
    clearTimeout(EV.silT); if (said) EV.silT = setTimeout(evDone, 1400);
  };
  rec.onerror = (e) => { if (e.error === "not-allowed" || e.error === "service-not-allowed") { EV.muted = true; evStopRec(); evSet("idle", "Allow the microphone for this site, then tap the orb."); } };
  rec.onend = () => { if (EV.rec !== rec) return; EV.rec = null;
    if ((EV.heard + EV.interim).trim()) return evDone();
    if (EV.open && !EV.muted && EV.state === "listening" && EV.restarts++ < 8) setTimeout(evListen, 250); else if (EV.open) evSet("idle", ""); };
  try { rec.start(); EV.rec = rec; } catch (e) { evSet("idle", "Can't listen right now"); }
}
async function evDone() {
  clearTimeout(EV.silT); const q = (EV.heard + EV.interim).replace(/\s+/g, " ").trim(); evStopRec();
  if (!q || !EV.open || EV.sending) return;
  EV.sending = true; EV.said = 0; EV.final = false; EV.pending = 0; evSet("thinking", q);
  for (let i = 0; EH.busy && i < 120; i++) await new Promise((r) => setTimeout(r, 500));   // a question already on its way finishes first
  const before = EH.data.turns.length; await ehAsk(q); EV.sending = false;
  if (!EV.open) return;
  const t = EH.data.turns.slice(before).reverse().find((x) => !x.pending) || EH.data.turns[EH.data.turns.length - 1];
  if (!t || (t.asked !== q && !t.failed)) { EV.final = true; return evSpeak("Sorry, I lost that. Say it again?"); }
  const cards = (t.proposals || []).filter((p) => p.status === "pending").length;
  evText((t.text || "") + (cards ? `\n\nI've put ${cards === 1 ? "a card" : cards + " cards"} on screen for you to confirm.` : ""), true);
}
/* speaking: each finished sentence goes to the voice as soon as it's written; the rest when the answer is done */
function evText(text, final) {
  if (!EV.open || (!EV.sending && !final)) return;
  const rest = String(text || "").slice(EV.said); let cut = rest.length;
  if (!final) { const m = [...rest.matchAll(/[.!?…:](?=\s)|\n/g)].pop(); if (!m) return; cut = m.index + 1; }
  const chunk = rest.slice(0, cut); EV.said += chunk.length; if (final) EV.final = true;
  const words = ehPlain(chunk);
  if (words) for (const s of words.split(/(?<=[.!?…])\s+|\n+/).map((x) => x.trim()).filter(Boolean)) evSpeak(s);
  else if (final && !EV.pending) evAfter();
}
function evSpeak(s) {
  const u = new SpeechSynthesisUtterance(s.slice(0, 600)), v = evVoice(); if (v) u.voice = v; u.lang = (v && v.lang) || navigator.language || "en-US"; u.rate = 1.04;
  u.onstart = () => evSet("speaking", s);
  u.onboundary = () => { EV.energy = Math.min(1, EV.energy + 0.35); };
  u.onend = u.onerror = () => { EV.pending = Math.max(0, EV.pending - 1); if (!EV.pending && EV.final) evAfter(); };
  EV.pending++; try { speechSynthesis.speak(u); } catch (e) { EV.pending--; }
}
function evAfter() { if (EV.open && !EV.sending && !EV.pending) setTimeout(() => { if (EV.open && !EV.sending && !EV.pending) evListen(); }, 350); }
/* the orb: cut in while Echo talks, send now while you talk, start again when paused */
function evTap() {
  if (EV.state === "speaking") { EV.final = true; EV.pending = 0; try { speechSynthesis.cancel(); } catch (e) {} if (!EV.sending) evListen(); }
  else if (EV.state === "listening") { if ((EV.heard + EV.interim).trim()) evDone(); }
  else if (EV.state === "idle") { EV.muted = false; const m = $("#evmute"); if (m) m.classList.remove("off"); evListen(); }
}
document.addEventListener("keydown", (e) => { if (e.key === "Escape" && EV.open) evClose(); });
document.addEventListener("visibilitychange", () => { if (document.visibilityState === "hidden" && EV.open) { evStopRec(); try { speechSynthesis.cancel(); } catch (e) {} EV.pending = 0; EV.final = true; evSet("idle", ""); } });

/* the orb: a soft shape in the accent that breathes while idle, ripples with your voice, swells with Echo's, and turns while it thinks */
function evFrame(now) {
  const cv = $("#evcv"); if (!EV.open || !cv) { EV.raf = 0; return; }
  EV.raf = requestAnimationFrame(evFrame);
  const w = cv.clientWidth; if (!w) return; const dpr = Math.min(2, window.devicePixelRatio || 1);
  if (cv.width !== Math.round(w * dpr)) { cv.width = cv.height = Math.round(w * dpr); }
  const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches, c = cv.getContext("2d"), cs = getComputedStyle(document.documentElement);
  const acc = cs.getPropertyValue("--accent-fill").trim(), tx = cs.getPropertyValue("--tx").trim(), W = cv.width, cx = W / 2, R = W * 0.3, t = now / 1000, st = EV.state;
  EV.energy *= 0.93; if (st === "speaking") EV.energy = Math.max(EV.energy, 0.25 + 0.15 * Math.sin(t * 7));
  const e = reduce ? 0 : EV.energy, amp = st === "idle" ? 0.02 : st === "thinking" ? 0.035 : 0.03 + e * 0.11;
  c.setTransform(1, 0, 0, 1, 0, 0); c.clearRect(0, 0, W, W);
  const halo = c.createRadialGradient(cx, cx, R * 0.6, cx, cx, R * 1.65); halo.addColorStop(0, acc); halo.addColorStop(1, "transparent");
  c.globalAlpha = (st === "idle" ? 0.12 : 0.22) + e * 0.2; c.fillStyle = halo; c.beginPath(); c.arc(cx, cx, R * 1.65, 0, 7); c.fill();
  const blob = (r, a, ph) => { c.beginPath(); for (let i = 0; i <= 96; i++) { const th = (i / 96) * Math.PI * 2;
    const k = reduce ? 1 : 1 + a * (Math.sin(th * 3 + t * 1.7 + ph) * 0.6 + Math.sin(th * 5 - t * 2.3 + ph) * 0.3 + Math.sin(th * 2 + t * 0.9) * 0.4);
    const x = cx + Math.cos(th) * r * k, y = cx + Math.sin(th) * r * k; i ? c.lineTo(x, y) : c.moveTo(x, y); } c.closePath(); };
  const s = 1 + (reduce ? 0 : st === "idle" ? 0.02 * Math.sin(t * 1.5) : e * 0.1);
  c.globalAlpha = 0.35; c.fillStyle = acc; blob(R * s * 1.08, amp * 1.4, 1.3); c.fill();
  const g = c.createRadialGradient(cx - R * 0.3, cx - R * 0.35, R * 0.1, cx, cx, R * 1.1); g.addColorStop(0, acc); g.addColorStop(1, acc);
  c.globalAlpha = st === "idle" ? 0.55 : 0.95; c.fillStyle = g; blob(R * s, amp, 0); c.fill();
  if (st === "thinking") { c.globalAlpha = 0.8; c.strokeStyle = tx; c.lineWidth = 2.5 * dpr; c.lineCap = "round"; const a0 = reduce ? 0 : t * 3.2;
    c.beginPath(); c.arc(cx, cx, R * 1.28, a0, a0 + 1.2); c.stroke(); c.beginPath(); c.arc(cx, cx, R * 1.28, a0 + Math.PI, a0 + Math.PI + 1.2); c.stroke(); }
  c.globalAlpha = 1;
}
