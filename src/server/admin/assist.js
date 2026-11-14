/* ================================================================
   ADMIN · ASSIST v1.0 — 2026-11-14. "I want to build Chrome and Gemini into
   my admin dashboard" — admin only. Two engines, one job to start with:
   what's wrong with the app this week, in plain words, on Admin → Health.

   · Chrome's built-in AI, when the browser the admin is open in has it
     (a computer's Chrome; never an iPhone). It runs on that computer:
     nothing leaves it. The page asks this part for the text and does the
     rest itself (public/admin-app/7-systems7-assist.js).
   · Gemini, Google's service, when it doesn't. Off until GEMINI_API_KEY is
     in Railway → Variables (RAILWAY.md). Called from here, never from the
     page, so the key stays on the server. No SDK — one fetch.
       GEMINI_MODEL    optional, default gemini-2.5-flash
       GEMINI_API_URL  optional, for tests

   What either engine is given, and nothing else: the week's errors (ours,
   not Instagram's or a wallet extension's), what felt broken on members'
   screens, and slow requests — as counts and short lines, with emails and
   @names taken out. Never a message, a post, a member's details or a key.
   What comes back is shown to the admin and kept nowhere.

     GET  /api/admin/assist          which engines there are
     GET  /api/admin/assist/health   the text + the instruction (for Chrome's AI)
     POST /api/admin/assist/health   the same, summarised by Gemini
   Owner only — a route a Mod isn't given (admin/mods.js) is the owner's.
   test/assist.test.mjs
================================================================ */
const AS_KEY = (process.env.GEMINI_API_KEY || "").trim();
const AS_MODEL = (process.env.GEMINI_MODEL || "gemini-2.5-flash").trim().replace(/[^a-zA-Z0-9._-]/g, "");
const AS_URL = (process.env.GEMINI_API_URL || "https://generativelanguage.googleapis.com/v1beta").trim().replace(/\/+$/, "");
const asOn = () => !!AS_KEY;
/* no one's email or @name goes out, and no line runs long */
const asClean = (s, n = 160) => String(s || "").replace(/[\w.+-]+@[\w-]+\.[\w.-]+/g, "[email]").replace(/(^|[^\w/])@[a-z0-9._]{2,30}/gi, "$1[member]").replace(/\s+/g, " ").trim().slice(0, n);
const AS_ASK = `You are helping the owner of LABS, a social app for creatives, who is not a programmer. Below is one week of what went wrong: errors, things that felt broken on members' screens, and slow requests. Say what is hurting members most, most important first, in plain words. At most six short lines, each starting with "- ". For each: what members experience, and where in the app. No code, no jargon, no advice about tools. If there is little or nothing wrong, say so in one line.`;

/* The week, as text: counts and short lines only. */
function asHealthText(now = Date.now()) {
  const since = now - 7 * 86400000, L = [];
  const errs = db.prepare(`SELECT kind, message, COUNT(*) n, MAX(created_at) last FROM error_log WHERE created_at > ? AND kind != 'foreign' GROUP BY kind, message ORDER BY n DESC LIMIT 40`).all(since)
    .filter((e) => !INS_NOT_OURS.test(e.message)).slice(0, 12);
  L.push(`ERRORS (${errs.reduce((s, e) => s + e.n, 0)} in 7 days)`);
  for (const e of errs) L.push(`${e.n}x [${asClean(e.kind, 12)}] ${asClean(e.message)}`);
  if (!errs.length) L.push("none");
  const gl = db.prepare(`SELECT kind, place, detail, COUNT(*) n, COUNT(DISTINCT NULLIF(username, '')) people FROM glitch_events WHERE created_at > ? GROUP BY kind, place, detail ORDER BY n DESC LIMIT 15`).all(since);
  L.push("", `FELT BROKEN ON MEMBERS' SCREENS (${gl.reduce((s, g) => s + g.n, 0)} in 7 days) — rage_tap: the same control hit again and again; action_failed: a tap that got no answer; layout_jump: the screen jumped; slow_screen: waited over 3 seconds`);
  for (const g of gl) L.push(`${g.n}x ${asClean(g.kind, 20)} at ${asClean(g.place, 40) || "?"}: ${asClean(g.detail, 80)}${g.people ? ` (${g.people} people)` : ""}`);
  if (!gl.length) L.push("none");
  const slow = db.prepare(`SELECT route, method, COUNT(*) n, ROUND(AVG(ms)) ms, SUM(status >= 500) failed FROM slow_requests WHERE at > ? GROUP BY route, method ORDER BY n DESC LIMIT 8`).all(since);
  L.push("", "SLOW OR FAILED REQUESTS (over 1.5 seconds)");
  for (const r of slow) L.push(`${r.n}x ${asClean(r.method, 8)} ${asClean(r.route, 60)} about ${Math.round(r.ms / 100) / 10}s${r.failed ? `, ${r.failed} failed` : ""}`);
  if (!slow.length) L.push("none");
  return { text: L.join("\n").slice(0, 6000), lines: errs.length + gl.length + slow.length };
}

/* One call to Gemini. The key rides in a header, never the address. */
async function asGemini(ask, text) {
  const r = await fetch(`${AS_URL}/models/${AS_MODEL}:generateContent`, { method: "POST", signal: AbortSignal.timeout(30000),
    headers: { "Content-Type": "application/json", "x-goog-api-key": AS_KEY },
    body: JSON.stringify({ systemInstruction: { parts: [{ text: ask }] }, contents: [{ role: "user", parts: [{ text }] }], generationConfig: { temperature: 0.2, maxOutputTokens: 700 } }) });
  const d = await r.json().catch(() => ({}));
  if (!r.ok || d.error) {
    const m = String(d.error?.message || "").slice(0, 200);
    const e = new Error(r.status === 400 && /api key/i.test(m) || r.status === 401 || r.status === 403 ? "Google turned the key away. Check GEMINI_API_KEY in Railway → Variables."
      : r.status === 404 ? `Google doesn't know the model "${AS_MODEL}". Set GEMINI_MODEL in Railway → Variables to one your key can use.`
      : r.status === 429 ? "Gemini's limit for this key is used up for now. Try again in a little while."
      : `Gemini didn't answer (${r.status}).`);
    e.status = r.status; throw e;
  }
  const out = (d.candidates?.[0]?.content?.parts || []).map((p) => p.text || "").join("").trim();
  if (!out) throw new Error("Gemini answered with nothing.");
  return out.slice(0, 4000);
}

app.get("/api/admin/assist", auth, admin, (req, res) => res.json({ gemini: asOn(), model: asOn() ? AS_MODEL : null }));
app.get("/api/admin/assist/health", auth, admin, rateLimit({ max: 20, windowMs: 600000, key: "user" }), (req, res) => res.json({ ...asHealthText(), ask: AS_ASK }));
app.post("/api/admin/assist/health", auth, admin, rateLimit({ max: 10, windowMs: 600000, key: "user" }), async (req, res) => {
  if (!asOn()) return res.status(400).json({ error: "Gemini isn't set up — add GEMINI_API_KEY in Railway → Variables." });
  const h = asHealthText();
  try { res.json({ summary: await asGemini(AS_ASK, h.text), engine: "gemini", model: AS_MODEL, lines: h.lines }); }
  catch (e) { console.error("[assist]", e.message); res.status(502).json({ error: /abort|timeout/i.test(e.message) ? "Gemini took too long to answer." : e.message }); }
});
