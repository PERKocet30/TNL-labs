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
    json(200, { candidates: [{ content: { parts: [{ text: "- Voting feels stuck on the tournament page.\n" }, { text: "- The Showroom is slow to open for some." }] } }] });
  });
});
await new Promise((r) => fake.listen(0, r));
const PORT = 8931, B = `http://localhost:${PORT}`;
const env = { ...process.env, TNL_DATA: DATA, PORT: String(PORT), STRIPE_SECRET_KEY: "", TNL_NO_VIDEO_FIX: "1", TNL_NO_WATCH: "1",
  GEMINI_API_KEY: "AIza-secret", GEMINI_API_URL: `http://localhost:${fake.address().port}/v1beta`, GEMINI_MODEL: "" };
const start = (extra = {}) => spawn(process.execPath, ["--experimental-sqlite", "--no-warnings", "src/server.runtime.js"], { cwd: ROOT, env: { ...env, ...extra }, stdio: "ignore" });
const ready = async () => { for (let i = 0; i < 100; i++) { try { if ((await fetch(B + "/api/health")).ok) return; } catch {} await new Promise((r) => setTimeout(r, 100)); } };
const call = async (path, who, method = "GET") => { const r = await fetch(B + path, { method, headers: who ? { authorization: "Bearer tok-" + who } : {} }); return { s: r.status, j: await r.json().catch(() => ({})) }; };

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
  for (const [m, p] of [["GET", "/api/admin/assist"], ["GET", "/api/admin/assist/health"], ["POST", "/api/admin/assist/health"]]) {
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

  console.log("\nTHE PAGE");
  const page = readFileSync(join(ROOT, "public/admin-app/7-systems7-assist.js"), "utf8"), html = readFileSync(join(ROOT, "public/admin.html"), "utf8"), code = page.replace(/\/\*[\s\S]*?\*\//g, "");
  t("its own script, after the Health page it sits on", /7-systems5-health\.js[\s\S]*7-systems7-assist\.js/.test(html));
  t("Chrome's built-in AI first — only when it's ready on this computer — then Gemini", code.includes('self.LanguageModel.availability() === "available"') && code.includes('self.Summarizer.availability() === "available"') && code.indexOf("asRunLocal(d)") < code.indexOf('req("/api/admin/assist/health", { method: "POST" })'));
  t("it says where the summary is made, and what goes to Google", page.includes("nothing leaves it") && page.includes("the week's error list goes to Google") && page.includes("An iPhone needs the second"));
  t("the page never talks to Google itself, and holds no key", !/googleapis|generativelanguage|AIza|x-goog/.test(page));
  t("no new dependency: the server calls Google with fetch", !/google|genai/i.test(readFileSync(join(ROOT, "package.json"), "utf8")));
} finally { srv.kill(); fake.close(); }
console.log(`\n  ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
