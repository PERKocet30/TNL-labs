/* LABS admin — Echo Home, the composer's tools v1.2, 2026-11-04 (ehPlain, shared with Talk — 2-echo-voice.js). v1.1, 2026-11-04 (a send that fails is recovered from the server, or said plainly with the words back — ehRecover; the page re-reads the conversation when it comes back into view — ehRefresh; failures land in the errors log — ehReport). v1.0, 2026-11-04 ("Echo is more limited in the admin
   dashboard than in my messages"). What Messages → Echo has, here too: photos and PDFs on a message
   (shrunk in the browser, POST /api/echo/attach, thumbnails over the box), dictation with the mic (the
   browser's own speech recognition), answers read aloud (the speaker, remembered on this device), the
   model picker (one select, the setting every admin shares), copy under an answer. Used by 2-echo-home.js. */
const ehCanDictate = () => !!(window.SpeechRecognition || window.webkitSpeechRecognition);
const ehVoiceOn = () => { try { return localStorage.getItem("tnl-echo-voice") === "1"; } catch (e) { return false; } };
/* a photo shrunk to 1568px on its long side, as the phone does; a PDF as it is */
function ehShrink(file) {
  return new Promise((ok, no) => {
    const fr = new FileReader(); fr.onerror = no;
    fr.onload = () => { if (!/^image\//.test(file.type) || file.type === "image/gif") return ok(fr.result);
      const img = new Image(); img.onerror = no;
      img.onload = () => { let w = img.naturalWidth, h = img.naturalHeight; const m = 1568; if (w > m || h > m) { const s = Math.min(m / w, m / h); w = Math.round(w * s); h = Math.round(h * s); }
        const c = document.createElement("canvas"); c.width = w; c.height = h; c.getContext("2d").drawImage(img, 0, 0, w, h); ok(c.toDataURL("image/jpeg", .85)); };
      img.src = fr.result; };
    fr.readAsDataURL(file);
  });
}
async function ehAttach(files) {
  EH.att = EH.att || [];
  for (const file of files.slice(0, 4 - EH.att.length)) {
    const pdf = file.type === "application/pdf" || /\.pdf$/i.test(file.name);
    if (!pdf && !/^image\//.test(file.type)) { toast("A photo or a PDF"); continue; }
    if (pdf && file.size > 8 * 1024 * 1024) { toast("That PDF is over 8MB"); continue; }
    const a = { kind: pdf ? "pdf" : "image", name: file.name, preview: "", url: "" }; EH.att.push(a); ehPaintFoot();
    try { const data = await ehShrink(file); if (!pdf) a.preview = data; ehPaintFoot();
      const up = await req("/api/echo/attach", { method: "POST", body: { data, name: file.name } }); a.url = up.url; a.kind = up.kind === "pdf" ? "pdf" : "image"; }
    catch (e) { EH.att = EH.att.filter((x) => x !== a); toast(e.message || "Couldn’t attach that"); }
    ehPaintFoot();
  }
}
const ehAttHTML = () => (EH.att || []).length ? `<div class="eh-att">${EH.att.map((a, i) => `<span class="eh-atti ${a.url ? "" : "up"}">${a.kind === "pdf" ? `<i>${NAVI.knowledge}</i>` : `<img src="${esc(a.preview || a.url)}" alt="">`}<button class="eh-attx" data-ehattx="${i}" aria-label="Remove">${I.x}</button></span>`).join("")}</div>` : "";
const ehFilesHTML = (files) => (files || []).length ? `<div class="eh-qf">${files.map((f) => f.kind === "pdf" ? `<a class="eh-pdf" href="${esc(f.url)}" target="_blank" rel="noreferrer">${NAVI.knowledge}<span>${esc(f.name || "PDF")}</span></a>` : `<img src="${esc(f.url)}" alt="" loading="lazy">`).join("")}</div>` : "";
/* dictation: the browser's own speech recognition fills the box; nothing leaves but the words you send */
function ehDictate() {
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition; if (!SR) return;
  if (EH.rec) { try { EH.rec.stop(); } catch (e) {} return; }
  const rec = new SR(); rec.lang = navigator.language || "en-US"; rec.interimResults = true; rec.continuous = true;
  const base = EH.draft ? EH.draft.replace(/\s+$/, "") + " " : ""; let finals = "";
  rec.onresult = (e) => { let interim = ""; for (let i = e.resultIndex; i < e.results.length; i++) { const r = e.results[i]; if (r.isFinal) finals += r[0].transcript + " "; else interim += r[0].transcript; }
    EH.draft = (base + finals + interim).replace(/\s+/g, " ").trimStart(); const d = $("#ehdraft"); if (d) { d.value = EH.draft; d.dispatchEvent(new Event("input")); } };
  rec.onerror = (e) => { if (e.error === "not-allowed") toast("Allow the microphone in your browser"); };
  rec.onend = () => { EH.rec = null; EH.listening = false; ehPaintFoot(); };
  try { rec.start(); EH.rec = rec; EH.listening = true; ehPaintFoot(); } catch (e) { toast("Can’t listen right now"); }
}
/* an answer as words to say: no markdown, a link is "a link" (2-echo-voice.js uses it too) */
const ehPlain = (text) => String(text || "").replace(/\*\*|`|^#+\s*/gm, "").replace(/^\s*[-*•]\s+/gm, "").replace(/https?:\/\/\S+/g, "a link").trim();
/* read aloud, when the speaker is on — and not while Talk is open: Talk speaks for itself */
function ehSay(text) {
  if (!ehVoiceOn() || !("speechSynthesis" in window) || (typeof EV !== "undefined" && EV.open)) return;
  const plain = ehPlain(text); if (!plain) return;
  try { speechSynthesis.cancel(); const u = new SpeechSynthesisUtterance(plain.slice(0, 3000)); u.lang = navigator.language || "en-US"; u.rate = 1.02; speechSynthesis.speak(u); } catch (e) {}
}
function ehVoiceToggle() {
  const on = !ehVoiceOn(); try { localStorage.setItem("tnl-echo-voice", on ? "1" : "0"); } catch (e) {}
  if (!on) { try { speechSynthesis.cancel(); } catch (e) {} }
  toast(on ? "Echo will read answers aloud" : "Echo is quiet"); paint();
  if (on) { const last = [...EH.data.turns].reverse().find((t) => t.text && !t.failed); if (last) ehSay(last.text); }
}
async function ehPickModel(id) {
  if (!id || id === EH.data.model) return;
  try { const r = await req("/api/echo/model", { method: "POST", body: { model: id } }); EH.data.model = r.model; toast(r.name + " from your next message"); } catch (e) { toast(e.message); ehPaintFoot(); }
}
function ehCopy(id) { const t = EH.data.turns.find((x) => String(x.id) === String(id)); if (!t) return; navigator.clipboard && navigator.clipboard.writeText(t.text || "").then(() => toast("Copied"), () => toast("Couldn’t copy")); }

/* A send that failed (the phone dropped the line, a network blip): before calling it lost, ask the server.
   The question may have arrived and Echo may still be answering — then wait for it; if it never arrived,
   say so in the conversation and put the words back in the box. Never just make them disappear. */
async function ehRecover({ q, brief, att, known, seq, err }) {
  const findNew = (turns) => [...turns].reverse().find((t) => !known.has(String(t.id)) && (brief ? t.label === "brief" : t.asked === q));
  const pending = () => EH.data.turns.find((x) => x.pending);
  const stale = () => seq !== EH.seq;
  for (let i = 0; i < 45; i++) {   // ~3 minutes, the longest Echo takes
    await new Promise((r) => setTimeout(r, i ? 4000 : 1200));
    if (stale()) return;
    let d; try { d = await req("/api/echo"); } catch (e) { continue; }
    const t = findNew(d.turns || []);
    if (!t) { if (i >= 3) break; continue; }   // not on the server after ~13s: it never arrived
    if (t.text || t.failed) { EH.data.turns = d.turns; if (brief) EH.data.briefToday = true; if (t.text && !t.failed) ehSay(t.text); return; }
    const p = pending(); if (p) { p.status = "Still working on it"; const w = $(`[data-ehturn="${p.id}"] .eh-work span`); if (w) w.textContent = p.status; }
  }
  if (stale()) return;
  const i = EH.data.turns.findIndex((x) => x.pending); if (i >= 0) EH.data.turns.splice(i, 1);
  const why = /load failed|failed to fetch|network/i.test(String(err && err.message)) ? "the connection dropped" : String((err && err.message) || "something went wrong").replace(/\.$/, "");
  EH.data.turns.push({ id: "f" + Date.now(), asked: q, label: brief ? "brief" : "", files: att.filter((a) => a.url).map((a) => ({ url: a.url, kind: a.kind, name: a.name })), kind: "brain", text: brief ? `The brief didn’t come through (${why}). Tap Brief me to try again.` : `That didn’t reach Echo (${why}). Your words are back in the box — send them again.`, failed: true, tools: [], proposals: [] });
  if (!brief && !EH.draft.trim()) { EH.draft = q; EH.att = att; }
}
/* Back on the page (the phone was locked, or Echo answered in Messages): read the conversation again. */
async function ehRefresh() {
  if (!ehOn() || EH.busy || TAB !== "echohome") return;
  try { const d = await req("/api/echo"); if (EH.busy || !d.brain) return;
    const before = JSON.stringify(EH.data.turns.map((t) => [t.id, t.text, (t.proposals || []).map((p) => p.status)]));
    const keepLocal = EH.data.turns.filter((t) => String(t.id).startsWith("f"));   // a failed send stays on screen until the next one
    EH.data.turns = [...d.turns, ...keepLocal]; EH.data.model = d.model;
    if (JSON.stringify(EH.data.turns.map((t) => [t.id, t.text, (t.proposals || []).map((p) => p.status)])) !== before) ehPaintFeed();
    const sel = $("#ehmodel"); if (sel && sel.value !== d.model) sel.value = d.model;
  } catch (e) {}
}
document.addEventListener("visibilitychange", () => { if (document.visibilityState === "visible") ehRefresh(); });
/* What went wrong goes to Health → errors, so the next "it didn't respond" has a reason on record. */
function ehReport(e, brief) {
  try { fetch(API + "/api/client-error", { method: "POST", headers: { "Content-Type": "application/json", ...(TOKEN ? { Authorization: "Bearer " + TOKEN } : {}) },
    body: JSON.stringify({ message: `Echo Home: ${brief ? "the brief" : "a question"} didn't come back — ${String((e && e.message) || e).slice(0, 200)}`, detail: `online=${navigator.onLine} visible=${document.visibilityState}`, path: "/admin" }), keepalive: true }).catch(() => {}); } catch (x) {}
}
