// ADMIN · ASSIST v1.0 (2026-11-14): "I want to build Chrome and Gemini into my admin dashboard."
// What's wrong this week, in plain words, on Admin → Health — by Chrome's built-in AI when the
// browser has it (nothing leaves the computer), by Gemini otherwise. Runs against a pretend Google:
// the key stays on the server, and what goes out is counts and short lines — never a member.
import { spawn } from "node:child_process";
import { createServer } from "node:http";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { rmSync, mkdirSync, readFileSync } from "node:fs";
const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const DATA = join(ROOT, "test/.tmp/assist");
rmSync(DATA, { recursive: true, force: true }); mkdirSync(DATA, { recursive: true });
process.env.TNL_DATA = DATA;
let pass = 0, fail = 0;
const t = (n, ok) => { ok ? pass++ : fail++; console.log("  " + (ok ? "✓" : "✗") + "  " + n); };

const seen = { calls: [], mode: "ok" };
const fake = createServer((req, res) => {
  let body = ""; req.on("data", (c) => body += c); req.on("end", () => {
    seen.calls.push({ url: req.url, key: req.headers["x-goog-api-key"], body });
    const json = (code, o) => { res.writeHead(code, { "Content-Type": "application/json" }); res.end(JSON.stringify(o)); };
    if (req.headers["x-goog-api-key"] !== "AIza-secret") return json(400, { error: { message: "API key not valid. Please pass a valid API key.", code: 400 } });
    if (seen.mode === "busy") return json(429, { error: { message: "Resource has been exhausted", code: 429 } });
    if (!/\/models\/gemini-2\.5-flash:generateContent$/.test(req.url)) return json(404, { error: { message: "models/x is not found", code: 404 } });
    const sent = JSON.parse(body || "{}");
    if (/from Echo/.test(sent.systemInstruction?.parts?.[0]?.text || "")) {   // Echo asking (v1.1)
      if (sent.tools && seen.mode === "nosearch") return json(400, { error: { message: "Search grounding is not supported for this model", code: 400 } });
      return json(200, { candidates: [{ content: { parts: [{ text: sent.tools ? "Reels are reaching more than photos this month." : "A second opinion: ship the smaller fix first." }] },
        ...(sent.tools ? { groundingMetadata: { groundingChunks: [{ web: { uri: "https://example.org/report", title: "A report" } }, { web: { uri: "javascript:alert(1)", title: "bad" } }] } } : {}) }] }); }
    json(200, { candidates: [{ content: { parts: [{ text: "- Voting feels stuck on the tournament page.\n" }, { text: "- The Showroom is slow to open for some." }] } }] });
  });
});
await new Promise((r) => fake.listen(0, r));
/* a stand-in for Claude (Echo's brain): plays a script, streamed the way Claude answers, and records what it was sent */
const brain = { seen: [], script: [] };
const claude = createServer((req, res) => { let body = ""; req.on("data", (c) => body += c); req.on("end", () => {
  const j = JSON.parse(body || "{}"); brain.seen.push(j);
  const next = brain.script.shift() || { stop_reason: "end_turn", content: [{ type: "text", text: "(script ran out)" }] };
  res.writeHead(200, { "content-type": "text/event-stream" });
  const ev = (type, d) => res.write(`event: ${type}\ndata: ${JSON.stringify({ type, ...d })}\n\n`);
  ev("message_start", { message: { id: "msg_" + brain.seen.length, role: "assistant", model: j.model, usage: { input_tokens: 10 } } });
  next.content.forEach((b, index) => {
    if (b.type === "text") { ev("content_block_start", { index, content_block: { type: "text", text: "" } }); ev("content_block_delta", { index, delta: { type: "text_delta", text: b.text } }); }
    else { ev("content_block_start", { index, content_block: { type: b.type, id: b.id, name: b.name, input: {} } }); ev("content_block_delta", { index, delta: { type: "input_json_delta", partial_json: JSON.stringify(b.input || {}) } }); }
    ev("content_block_stop", { index }); });
  ev("message_delta", { delta: { stop_reason: next.stop_reason }, usage: { output_tokens: 20 } }); ev("message_stop", {}); res.end(); }); });
await new Promise((r) => claude.listen(0, "127.0.0.1", r));
const PORT = 8931, B = `http://localhost:${PORT}`;
const env = { ...process.env, TNL_DATA: DATA, PORT: String(PORT), STRIPE_SECRET_KEY: "", TNL_NO_VIDEO_FIX: "1", TNL_NO_WATCH: "1",
  GEMINI_API_KEY: "AIza-secret", GEMINI_API_URL: `http://localhost:${fake.address().port}/v1beta`, GEMINI_MODEL: "" };
const start = (extra = {}) => spawn(process.execPath, ["--experimental-sqlite", "--no-warnings", "src/server.runtime.js"], { cwd: ROOT, env: { ...env, ...extra }, stdio: "ignore" });
const ready = async () => { for (let i = 0; i < 100; i++) { try { if ((await fetch(B + "/api/health")).ok) return; } catch {} await new Promise((r) => setTimeout(r, 100)); } };
const call = async (path, who, method = "GET", body) => { const r = await fetch(B + path, { method, headers: { ...(who ? { authorization: "Bearer tok-" + who } : {}), ...(body ? { "content-type": "application/json" } : {}) }, body: body ? JSON.stringify(body) : undefined }); return { s: r.status, j: await r.json().catch(() => ({})) }; };
const note = async () => ((await call("/api/admin/knowledge?kind=note", "boss")).j.entries || []).find((e) => e.key === "health-weeks");

/* boot once so every table exists, then put a week of trouble in */
let srv = start(); await ready(); srv.kill(); await new Promise((r) => setTimeout(r, 300));
{ const { DatabaseSync } = await import("node:sqlite"); const db = new DatabaseSync(join(DATA, "tnl.db")); const now = Date.now();
  const U = (n, admin, mod) => { const id = Number(db.prepare(`INSERT INTO users (username, display_name, email, password_hash, created_at, email_verified, is_admin) VALUES (?,?,?,?,?,1,?)`).run(n, n, n + "@x.com", "h", now, admin ? 1 : 0).lastInsertRowid);
    db.prepare(`INSERT INTO sessions (token, user_id, created_at) VALUES (?,?,?)`).run("tok-" + n, id, now); return id; };
  U("boss", true); U("ana", false);
  const err = db.prepare(`INSERT INTO error_log (kind, message, detail, path, username, created_at) VALUES (?,?,?,?,?,?)`);
  for (let i = 0; i < 3; i++) err.run("client", "Cannot read properties of undefined (reading 'images')", "", "/", "ana", now - 3600000);
  err.run("mail", "couldn't send to jorge.private@example.com for @ana.paints", "", "", "", now - 7200000);
  err.run("client", "TypeError: undefined is not an object (evaluating 'window.ethereum.selectedAddress = undefined')", "", "/", "", now - 7200000);   // a wallet extension's, not ours
  err.run("foreign", "Java object is gone", "", "/", "", now - 7200000);
  err.run("client", "an old one", "", "/", "", now - 9 * 86400000);
  const gl = db.prepare(`INSERT INTO glitch_events (kind, place, detail, device, username, created_at) VALUES (?,?,?,?,?,?)`);
  for (const u of ["ana", "ben", "ben"]) gl.run("rage_tap", "event", "[evpick]", "phone", u, now - 3600000);
  db.prepare(`INSERT INTO slow_requests (route, method, ms, status, at) VALUES ('/api/feed/showroom','GET',3400,200,?), ('/api/feed/showroom','GET',2600,502,?)`).run(now - 1000, now - 2000);
  db.close(); }

srv = start();
try {
  await ready();
  console.log("\nTHE OWNER ONLY");
  for (const [m, p] of [["GET", "/api/admin/assist"], ["GET", "/api/admin/assist/health"], ["POST", "/api/admin/assist/health"], ["POST", "/api/admin/assist/health/keep"]]) {
    t(`${m} ${p}: signed out 401, a member 403`, (await call(p, null, m)).s === 401 && (await call(p, "ana", m)).s === 403); }
  t("a Mod isn't given these routes — what a Mod isn't given is the owner's", !/assist/.test(readFileSync(join(ROOT, "src/server/admin/mods.js"), "utf8")));

  console.log("\nWHAT EITHER ENGINE IS GIVEN");
  const st = (await call("/api/admin/assist", "boss")).j;
  t("says Gemini is on, and which model — never the key", st.gemini === true && st.model === "gemini-2.5-flash" && !JSON.stringify(st).includes("AIza"));
  const h = (await call("/api/admin/assist/health", "boss")).j;
  t("the week's errors, counted, with the instruction for Chrome's AI", /ERRORS \(4 in 7 days\)/.test(h.text) && h.text.includes("3x [client] Cannot read properties of undefined (reading 'images')") && /not a programmer/.test(h.ask) && h.lines === 4);
  t("what felt broken, with how many people — and slow requests", h.text.includes("3x rage_tap at event: [evpick] (2 people)") && /2x GET \/api\/feed\/showroom about 3s, 1 failed/.test(h.text));
  t("no one's email or @name goes out", !/jorge\.private|example\.com|ana\.paints/.test(h.text) && h.text.includes("couldn't send to [email] for [member]"));
  t("errors that aren't LABS's (a wallet extension, Instagram's browser) and last month's stay out", !/ethereum|Java object|an old one/.test(h.text));
  t("no member, message or key in it", !/"username"|tok-|AIza|boss|\bben\b/.test(JSON.stringify(h)));

  console.log("\nGEMINI");
  const r = await call("/api/admin/assist/health", "boss", "POST"), c = seen.calls.at(-1);
  t("summarised by Gemini: the lines come back, and which engine", r.s === 200 && r.j.engine === "gemini" && r.j.model === "gemini-2.5-flash" && /^- Voting feels stuck[\s\S]*- The Showroom is slow/.test(r.j.summary));
  t("the key rides in a header — never in the address, never to the page", c.key === "AIza-secret" && !c.url.includes("AIza") && !JSON.stringify(r.j).includes("AIza"));
  const sent = JSON.parse(c.body);
  t("Google is sent the instruction and that text — nothing else", sent.contents.length === 1 && sent.contents[0].parts[0].text === h.text && /not a programmer/.test(sent.systemInstruction.parts[0].text) && Object.keys(sent).sort().join() === "contents,generationConfig,systemInstruction");
  console.log("\nECHO REMEMBERS (v1.1, \"feed Echo\") — one Knowledge entry, week by week");
  let n = await note();
  t("a summary is kept: \"What went wrong, week by week\" is in Knowledge, written by LABS", !!n && n.title === "What went wrong, week by week" && n.kind === "note" && n.source === "built-in");
  t("…with the plain words, which engine said them, and the week's counts beside them", /WEEK TO \d+ \w+ \d{4}/.test(n.body) && n.body.includes("In plain words (Gemini):\n- Voting feels stuck on the tournament page.\n- The Showroom is slow to open for some.") && /Counts: 3x error: Cannot read properties/.test(n.body) && n.body.includes("3x rage_tap at event: [evpick] (2 people)"));
  t("…and still no email, @name or member in it", !/jorge\.private|example\.com|ana\.paints|\bben\b/.test(n.body));
  const k1 = await call("/api/admin/assist/health/keep", "boss", "POST", { summary: "- People can't vote: write to me at someone@example.com\n\n* The feed is slow\n" + "x".repeat(900) });
  n = await note();
  t("a summary Chrome's AI made on the computer is kept the same way — the lines only, cleaned", k1.s === 200 && n.body.includes("In plain words (Chrome's AI):\n- People can't vote: write to me at [email]\n- The feed is slow") && !n.body.includes("x".repeat(300)) && !n.body.includes("Voting feels stuck"));
  t("nothing to keep is refused", (await call("/api/admin/assist/health/keep", "boss", "POST", { summary: "  " })).s === 400);
  t("one entry, edited — and the version before is kept, like every Knowledge change", ((await call("/api/admin/knowledge?kind=note", "boss")).j.entries || []).filter((e) => e.key === "health-weeks").length === 1 && ((await call("/api/admin/knowledge/" + n.id + "/history", "boss")).j.history || []).length >= 1);

  seen.mode = "busy";
  const busy = await call("/api/admin/assist/health", "boss", "POST");
  t("Gemini's limit used up: one plain line", busy.s === 502 && /limit for this key is used up/.test(busy.j.error));
  seen.mode = "ok";

  console.log("\nWHEN IT ISN'T SET UP, OR THE KEY OR MODEL IS WRONG");
  srv.kill(); await new Promise((r) => setTimeout(r, 300)); srv = start({ GEMINI_API_KEY: "" }); await ready();
  const n0 = seen.calls.length;
  t("no key: off, and a summary says how to turn it on — Google isn't called", (await call("/api/admin/assist", "boss")).j.gemini === false && /GEMINI_API_KEY in Railway/.test((await call("/api/admin/assist/health", "boss", "POST")).j.error) && seen.calls.length === n0);
  t("…the text is still there for Chrome's own AI", (await call("/api/admin/assist/health", "boss")).j.text.includes("ERRORS"));
  srv.kill(); await new Promise((r) => setTimeout(r, 300)); srv = start({ GEMINI_API_KEY: "AIza-old" }); await ready();
  const bad = await call("/api/admin/assist/health", "boss", "POST");
  t("a key Google turns away: says so, nothing leaks", bad.s === 502 && /turned the key away/.test(bad.j.error) && !JSON.stringify(bad.j).includes("AIza"));
  srv.kill(); await new Promise((r) => setTimeout(r, 300)); srv = start({ GEMINI_MODEL: "gemini-nope" }); await ready();
  t("a model Google doesn't know: says which, and where to change it", /doesn't know the model "gemini-nope"[\s\S]*GEMINI_MODEL/.test((await call("/api/admin/assist/health", "boss", "POST")).j.error));

  console.log("\nTHE WEEK THAT JUST ENDED IS WRITTEN ON ITS OWN");
  srv.kill(); await new Promise((r) => setTimeout(r, 300));
  { const { DatabaseSync } = await import("node:sqlite"); const db = new DatabaseSync(join(DATA, "tnl.db")); db.exec(`DELETE FROM assist_weeks`); db.close(); }
  srv = start({ TNL_NO_WATCH: "", ASSIST_FIRST_MS: "100", GEMINI_API_KEY: "" }); await ready(); await new Promise((r) => setTimeout(r, 900));
  const nw = await note();
  t("the first run writes last week's counts into the same entry — no engine, no key needed", !!nw && (nw.body.match(/WEEK TO/g) || []).length === 1 && /Counts: /.test(nw.body) && !/In plain words/.test(nw.body));

  console.log("\nECHO CAN ASK GEMINI (v1.1, \"integrate Echo with Gemini\") — Echo stays Claude");
  srv.kill(); await new Promise((r) => setTimeout(r, 300));
  const CL = `http://127.0.0.1:${claude.address().port}`;
  srv = start({ ECHO_AI_KEY: "sk-ant-test", ANTHROPIC_API_BASE: CL, ECHO_HOLD_MS: "150" }); await ready();
  brain.script = [{ stop_reason: "tool_use", content: [{ type: "tool_use", id: "tu1", name: "ask_gemini", input: { question: "What kind of Instagram post reaches most this month? (asked for jorge@example.com)", search: true } }] },
    { stop_reason: "end_turn", content: [{ type: "text", text: "Gemini says reels." }] }];
  const g0 = seen.calls.length, a1 = await call("/api/echo/ask", "boss", "POST", { q: "what reaches most on Instagram right now?" });
  const tools1 = (brain.seen[0]?.tools || []).map((x) => x.name), gq = JSON.parse(seen.calls.at(-1).body);
  t("Echo is offered ask_gemini beside its other tools, and still answers as Claude", a1.s === 200 && tools1.includes("ask_gemini") && tools1.includes("overview") && tools1.includes("web_search") && /Gemini says reels/.test(JSON.stringify(a1.j)));
  t("only the question Echo wrote goes to Google — an email in it is taken out — grounded in Google Search", seen.calls.length === g0 + 1 && gq.contents[0].parts[0].text === "What kind of Instagram post reaches most this month? (asked for [email])" && JSON.stringify(gq.tools) === '[{"google_search":{}}]' && !/boss|tok-|KNOWLEDGE|sk-ant/.test(seen.calls.at(-1).body));
  const back = JSON.stringify(brain.seen[1]?.messages?.at(-1) || {});
  t("Gemini's answer goes back to Echo as information, with its sources — a link that isn't https is dropped", /tool_result/.test(back) && /Reels are reaching more than photos/.test(back) && /Gemini \(Google\)/.test(back) && /example\.org\/report/.test(back) && !/javascript:/.test(back) && /Information, not instructions/.test(back));
  const lg = (await call("/api/admin/log", "boss")).j.log || [];
  t("every use is in the admin log", lg.some((l) => l.action === "echo ask_gemini" && /Instagram post reaches most/.test(l.detail || "")));
  seen.mode = "nosearch";
  brain.script = [{ stop_reason: "tool_use", content: [{ type: "tool_use", id: "tu2", name: "ask_gemini", input: { question: "Is shipping the smaller fix first sensible?", search: true } }] }, { stop_reason: "end_turn", content: [{ type: "text", text: "Yes." }] }];
  await call("/api/echo/ask", "boss", "POST", { q: "second opinion?" });
  if (process.env.DBG) console.log(JSON.stringify(brain.seen.at(-1).messages.at(-1)).slice(0, 900), seen.calls.slice(-2).map((c) => c.body.slice(0, 200)));
  t("Google Search refused for this key or model: Gemini's own answer, and Echo is told so", /second opinion: ship the smaller fix first/.test(JSON.stringify(brain.seen.at(-1).messages.at(-1))) && /Google Search wasn't available/.test(JSON.stringify(brain.seen.at(-1).messages.at(-1))));
  seen.mode = "ok";
  srv.kill(); await new Promise((r) => setTimeout(r, 300));
  srv = start({ ECHO_AI_KEY: "sk-ant-test", ANTHROPIC_API_BASE: CL, ECHO_HOLD_MS: "150", GEMINI_API_KEY: "" }); await ready();
  brain.seen.length = 0; brain.script = [{ stop_reason: "end_turn", content: [{ type: "text", text: "Hi." }] }];
  await call("/api/echo/ask", "boss", "POST", { q: "hello" });
  t("no Gemini key: the tool isn't offered at all", brain.seen.length === 1 && !(brain.seen[0].tools || []).some((x) => x.name === "ask_gemini"));
  t("a member can't reach any of it: Echo's brain is admins only", (await call("/api/echo/ask", "ana", "POST", { q: "ask gemini something" })).s === 403 && brain.seen.length === 1);

  console.log("\nTHE PAGE");
  const page = readFileSync(join(ROOT, "public/admin-app/7-systems7-assist.js"), "utf8"), html = readFileSync(join(ROOT, "public/admin.html"), "utf8"), code = page.replace(/\/\*[\s\S]*?\*\//g, "");
  t("its own script, after the Health page it sits on", /7-systems5-health\.js[\s\S]*7-systems7-assist\.js/.test(html));
  t("Chrome's built-in AI first — only when it's ready on this computer — then Gemini", code.includes('self.LanguageModel.availability() === "available"') && code.includes('self.Summarizer.availability() === "available"') && code.indexOf("asRunLocal(d)") < code.indexOf('req("/api/admin/assist/health", { method: "POST" })'));
  t("it says where the summary is made, and what goes to Google", page.includes("nothing leaves it") && page.includes("the week's error list goes to Google") && page.includes("An iPhone needs the second"));
  t("the page never talks to Google itself, and holds no key", !/googleapis|generativelanguage|AIza|x-goog/.test(page));
  t("no new dependency: the server calls Google with fetch", !/google|genai/i.test(readFileSync(join(ROOT, "package.json"), "utf8")));
  t("…and a summary made here is sent to be remembered; the card says Echo remembers it", code.includes('req("/api/admin/assist/health/keep", { method: "POST", body: { summary: out } })') && page.includes("Echo remembers this"));
} finally { srv.kill(); fake.close(); claude.close(); }
console.log(`\n  ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
