/* LABS admin · Assist v1.1 — 2026-11-14 ("feed Echo"): a summary is remembered — it goes into Knowledge beside the week's counts ("What went wrong,
   week by week"), which Echo reads at the start of every conversation. Gemini's is kept by the server; Chrome's is sent there to keep (the lines only).
   v1.0 — 2026-11-14. "I want to build Chrome and Gemini into my admin dashboard." On Health: what's wrong with the
   app this week, in plain words. Two engines (server/admin/assist.js):
   · Chrome's built-in AI when this browser has it — the summary is made on this computer and nothing leaves it;
   · Gemini (Google) when it doesn't and GEMINI_API_KEY is set — the week's error list goes to Google, never a message or a member.
   Sits at the top of Health; wraps LOADERS/VIEWS/WIRES.health (6-settings, 7-systems5-health). */
const AS = { local: "", busy: false, out: "", engine: "", err: "" };
/* which of Chrome's own AIs this browser has ready: the Prompt API first, then the Summarizer; "" when neither (every iPhone) */
async function asDetect() {
  try { if (self.LanguageModel && await self.LanguageModel.availability() === "available") return (AS.local = "prompt"); } catch (e) {}
  try { if (self.Summarizer && await self.Summarizer.availability() === "available") return (AS.local = "summarizer"); } catch (e) {}
  return (AS.local = "");
}
async function asRunLocal(d) {
  if (AS.local === "prompt") { const s = await self.LanguageModel.create({ initialPrompts: [{ role: "system", content: d.ask }] });
    try { return await s.prompt(d.text); } finally { try { s.destroy(); } catch (e) {} } }
  const s = await self.Summarizer.create({ type: "key-points", format: "plain-text", length: "medium", sharedContext: d.ask });
  try { return await s.summarize(d.text); } finally { try { s.destroy(); } catch (e) {} }
}
async function asRun() {
  if (AS.busy) return;
  AS.busy = true; AS.err = ""; AS.out = ""; paint();
  try {
    let done = false;
    if (AS.local) { try { const d = await req("/api/admin/assist/health"); const out = String(await asRunLocal(d) || "").trim(); if (out) { AS.out = out; AS.engine = "chrome"; done = true; req("/api/admin/assist/health/keep", { method: "POST", body: { summary: out } }).catch(() => {}); } } catch (e) {} }   // Chrome's AI can refuse or run out of room: Gemini is the way on
    if (!done) { if (!(D.assist && D.assist.gemini)) throw new Error(AS.local ? "Chrome's AI couldn't do it this time, and Gemini isn't set up." : "No engine here yet.");
      const r = await req("/api/admin/assist/health", { method: "POST" }); AS.out = r.summary; AS.engine = "gemini"; }
  } catch (e) { AS.err = e.message || "It didn't work."; }
  AS.busy = false; paint();
}
function asCardHTML() {
  const g = !!(D.assist && D.assist.gemini), any = AS.local || g;
  const how = AS.local ? "Made on this computer by Chrome's built-in AI — nothing leaves it." + (g ? " Gemini steps in if Chrome can't." : "")
    : g ? "Made by Gemini (Google): the week's error list goes to Google — never a message, a post or a member."
    : "Not set up yet. Two ways: open the admin in Chrome on a computer that has Chrome's built-in AI, or add GEMINI_API_KEY in Railway → Variables (RAILWAY.md says how). An iPhone needs the second.";
  const lines = AS.out ? AS.out.split("\n").map((l) => l.replace(/^[-*•]\s*/, "").trim()).filter(Boolean) : [];
  return `<section class="rc ascard"><header><h3>What's wrong, in plain words</h3><span class="mono">${AS.engine === "chrome" ? "Chrome, on this computer" : AS.engine === "gemini" ? "Gemini" : "this week"}</span></header>
    <div class="body">${AS.busy ? askel("rows") : AS.err ? `<p class="warnl">${esc(AS.err)}</p>` : lines.length ? `<ul class="asl">${lines.map((l) => `<li>${esc(l)}</li>`).join("")}</ul>` : ""}
      <div class="row sp" style="margin-top:${AS.busy || AS.err || lines.length ? 12 : 0}px"><span class="dim" style="font-size:12px;line-height:1.5">${how}${lines.length ? " Echo remembers this: it's in Knowledge, week by week." : ""}</span>
        ${any ? `<button class="btn sm" id="asgo"${AS.busy ? " disabled" : ""}>${lines.length ? "Again" : "Summarise"}</button>` : ""}</div></div></section>`;
}
{ const load0 = LOADERS.health, view0 = VIEWS.health, wire0 = WIRES.health;
  LOADERS.health = async () => { await load0(); [D.assist] = await Promise.all([req("/api/admin/assist").catch(() => null), asDetect()]); };
  VIEWS.health = () => { const h = view0(); return D.health && D.assist !== undefined ? h.replace('<div class="systab">', asCardHTML() + '<div class="systab">') : h; };
  WIRES.health = () => { wire0(); const b = $("#asgo"); if (b) b.onclick = asRun; }; }
