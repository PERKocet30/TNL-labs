/* LABS admin — Echo Home, the composer's tools v1.0, 2026-11-04 ("Echo is more limited in the admin
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
/* read aloud, when the speaker is on */
function ehSay(text) {
  if (!ehVoiceOn() || !("speechSynthesis" in window)) return;
  const plain = String(text || "").replace(/\*\*|`|^#+\s*/gm, "").replace(/^\s*[-*•]\s+/gm, "").replace(/https?:\/\/\S+/g, "a link").trim(); if (!plain) return;
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
