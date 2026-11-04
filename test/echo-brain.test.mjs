// ECHO · the brain v1.0 (2026-11-04): Echo for the founder — a model that reasons,
// the connector's tools as its eyes, Knowledge as its memory. A stand-in for
// Claude listens at ANTHROPIC_API_BASE and plays a script, so the test checks
// what LABS sends and does: only admins reach the brain (members still get the
// matcher, and nobody does without a key); the system prompt carries Knowledge;
// a tool the model asks for is run as the asking admin and its scrubbed result
// goes back; a knowledge_add from the model lands in Knowledge as "echo" and in
// the admin log; the conversation is kept and replayed; Start fresh puts it away;
// a failure answers in plain words and leaves no dangling tool call behind.
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { mkdirSync, rmSync } from "node:fs";
import { spawn } from "node:child_process";
import { createServer } from "node:http";
const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const DATA = join(ROOT, "test/.tmp/echo-brain");
rmSync(DATA, { recursive: true, force: true }); mkdirSync(DATA, { recursive: true });
process.env.TNL_DATA = DATA; process.env.TNL_NO_WATCH = "1";
let pass = 0, fail = 0;
const t = (n, ok) => { ok ? pass++ : fail++; console.log("  " + (ok ? "✓" : "✗") + "  " + n); };

const { db } = await import("../src/db.js");
const now = Date.now();
const ins = db.prepare("INSERT INTO users (username,display_name,email,role,roles,password_hash,email_verified,created_at,is_admin,rep) VALUES (?,?,?,?,?,?,1,?,?,?)");
const admin = Number(ins.run("jorge", "Jorge F", "jorge@x.test", "Designer", '["Designer"]', "x", now, 1, 150).lastInsertRowid);
const ana = Number(ins.run("ana", "Ana", "ana@x.test", "Producer", '["Producer"]', "x", now, 0, 0).lastInsertRowid);
for (const [tok, id] of [["tok-admin", admin], ["tok-ana", ana]]) db.prepare("INSERT INTO sessions (token,user_id,created_at) VALUES (?,?,?)").run(tok, id, now);

/* ---- the stand-in for Claude: records every request, answers from a script ---- */
const seen = [];
let script = [];
let mode = "ok";
const claude = createServer((req, res) => {
  let body = ""; req.on("data", (d) => body += d); req.on("end", () => {
    const j = JSON.parse(body || "{}"); seen.push({ headers: req.headers, body: j });
    if (mode === "401" || (mode === "401-after-tool" && j.messages.at(-1).content[0] && j.messages.at(-1).content[0].type === "tool_result")) { res.writeHead(401, { "content-type": "application/json" }); return res.end(JSON.stringify({ error: { type: "authentication_error", message: "invalid x-api-key" } })); }
    const next = script.shift() || { stop_reason: "end_turn", content: [{ type: "text", text: "(script ran out)" }] };
    res.writeHead(200, { "content-type": "application/json" });
    res.end(JSON.stringify({ id: "msg_" + seen.length, type: "message", role: "assistant", model: j.model, usage: { input_tokens: 10, output_tokens: 20 }, ...next }));
  });
});
await new Promise((r) => claude.listen(0, "127.0.0.1", r));
const CLAUDE = `http://127.0.0.1:${claude.address().port}`;

const PORT = 18600 + (process.pid % 200);
const boot = (env) => {
  const srv = spawn(process.execPath, ["--experimental-sqlite", "src/server.js"], { cwd: ROOT, env: { ...process.env, PORT: String(PORT), TNL_DATA: DATA, TNL_NO_WATCH: "1", ...env }, stdio: ["ignore", "pipe", "pipe"] });
  srv.log = ""; srv.stdout.on("data", (d) => srv.log += d); srv.stderr.on("data", (d) => srv.log += d);
  return srv;
};
const ready = async (srv) => { for (let i = 0; i < 150 && !/listening/.test(srv.log); i++) await new Promise((r) => setTimeout(r, 100)); };
const stop = (srv) => new Promise((r) => { srv.on("exit", r); srv.kill(); });
const call = async (tok, method, path, body) => {
  const r = await fetch(`http://127.0.0.1:${PORT}${path}`, { method, headers: { "content-type": "application/json", ...(tok ? { authorization: "Bearer " + tok } : {}) }, body: body ? JSON.stringify(body) : undefined });
  return { s: r.status, j: await r.json().catch(() => ({})) };
};
const ask = async (tok, q) => (await call(tok, "POST", "/api/echo/ask", { q })).j.turn;

let srv = boot({ ECHO_AI_KEY: "", ANTHROPIC_API_KEY: "", ANTHROPIC_API_BASE: CLAUDE });
await ready(srv);
try {
  console.log("\nNO KEY — nothing changes");
  const h0 = await call("tok-admin", "GET", "/api/echo");
  t("without a key the admin gets the matcher, not the brain", h0.s === 200 && !h0.j.brain && /LABS's help/.test(h0.j.hello));
  t("/api/echo/brain says off", (await call("tok-admin", "GET", "/api/echo/brain")).j.on === false);
  t("…and the stand-in was never called", seen.length === 0);
} finally { await stop(srv); }

srv = boot({ ECHO_AI_KEY: "sk-ant-test", ANTHROPIC_API_KEY: "", ANTHROPIC_API_BASE: CLAUDE, ECHO_MODEL: "claude-opus-5-5" });
await ready(srv);
try {
  console.log("\nWHO GETS THE BRAIN — admins; a member still gets the matcher");
  t("signed out → 401", (await call(null, "GET", "/api/echo")).s === 401);
  t("a member → 403 while Echo is admins-only (the matcher's rule, untouched)", (await call("tok-ana", "GET", "/api/echo")).s === 403);
  await call("tok-admin", "PATCH", "/api/admin/settings", { echoOpen: "1" });
  const ha = await call("tok-ana", "GET", "/api/echo");
  t("…opened to everyone, a member gets the matcher: no brain, LABS help", ha.s === 200 && !ha.j.brain && /LABS's help/.test(ha.j.hello));
  const am = await ask("tok-ana", "how much do you take from a sale?");
  t("…and a member's question is matched, never sent to Claude", am && am.kind === "answer" && am.faqId && seen.length === 0);
  t("a member can't start fresh or read the brain's status", (await call("tok-ana", "POST", "/api/echo/reset")).s === 403 && (await call("tok-ana", "GET", "/api/echo/brain")).s === 403);
  const h = await call("tok-admin", "GET", "/api/echo");
  t("the admin gets the brain: hello by first name, LABS's own, starters, no turns yet", h.s === 200 && h.j.brain === true && /^Jorge — I'm Echo/.test(h.j.hello) && h.j.sub === "LABS's own" && h.j.starters.length === 4 && h.j.turns.length === 0);
  t("/api/echo/brain says on, with the model", (await call("tok-admin", "GET", "/api/echo/brain")).j.on === true && (await call("tok-admin", "GET", "/api/echo/brain")).j.model === "claude-opus-5-5");

  console.log("\nONE QUESTION — think, look through a tool, answer");
  script = [
    { stop_reason: "tool_use", content: [{ type: "text", text: "Let me look." }, { type: "tool_use", id: "tu_1", name: "overview", input: {} }] },
    { stop_reason: "end_turn", content: [{ type: "text", text: "Two members so far, both this week. Quiet, but it's day one." }] },
  ];
  const a1 = await ask("tok-admin", "how are we doing?");
  t("the turn: kind brain, the final words, what it looked at", a1 && a1.kind === "brain" && /Two members/.test(a1.text) && a1.tools.join() === "overview" && !a1.failed);
  const r1 = seen[0], r2 = seen[1];
  t("Claude got the key, the model, and no beta surprises", r1.headers["x-api-key"] === "sk-ant-test" && r1.headers["anthropic-version"] === "2023-06-01" && r1.body.model === "claude-opus-5-5" && r1.body.max_tokens === 4096);
  const sys = r1.body.system;
  t("the system prompt: who Echo is, then Knowledge (cached), then today and who's asking", Array.isArray(sys) && sys.length === 3 && /You are Echo/.test(sys[0].text) && /KNOWLEDGE/.test(sys[1].text) && sys[1].cache_control && sys[1].cache_control.ttl === "1h" && /@jorge/.test(sys[2].text));
  t("Knowledge rides along as written: the creed and the features", /take over/.test(sys[1].text) && /### The Showroom/.test(sys[1].text) && /### Rep only comes from other people/.test(sys[1].text));
  const names = r1.body.tools.map((x) => x.name);
  t("the tools are the connector's: overview, members, orders, events, knowledge, knowledge_add — and nothing for messages", names.includes("overview") && names.includes("members") && names.includes("orders") && names.includes("events") && names.includes("knowledge") && names.includes("knowledge_add") && !names.some((n) => /^(messages?|dms?|inbox|groups?)$/.test(n)));
  t("tools carry a JSON schema in Claude's shape", r1.body.tools.every((x) => x.input_schema && x.input_schema.type === "object" && x.description));
  t("the first request is just the question", r1.body.messages.length === 1 && r1.body.messages[0].role === "user" && r1.body.messages[0].content[0].text === "how are we doing?");
  const back = r2.body.messages;
  t("the second request replays the tool call and brings its result", back.length === 3 && back[1].role === "assistant" && back[1].content[1].type === "tool_use" && back[2].content[0].type === "tool_result" && back[2].content[0].tool_use_id === "tu_1");
  const result = JSON.parse(back[2].content[0].content);
  t("…the result is the real overview, run as the admin: member counts, no emails", result && typeof result === "object" && !JSON.stringify(result).includes("@x.test") && JSON.stringify(result).length > 20);
  t("Claude's reply is stored whole (text and tool_use), the question too", db.prepare("SELECT kind FROM echo_brain WHERE user_id = ? ORDER BY id").all(admin).map((r) => r.kind).join() === "ask,reply,result,reply");

  console.log("\nTHE HAND — a decision written to Knowledge, logged, as Echo");
  script = [
    { stop_reason: "tool_use", content: [{ type: "tool_use", id: "tu_2", name: "knowledge_add", input: { kind: "decision", title: "Echo answers in plain text", body: "Chat bubbles, no markdown. Reason: the app renders text, not documents.", tags: "echo voice" } }] },
    { stop_reason: "end_turn", content: [{ type: "text", text: "Written down." }] },
  ];
  const a2 = await ask("tok-admin", "remember: plain text only");
  const row = db.prepare("SELECT * FROM knowledge WHERE title = 'Echo answers in plain text'").get();
  t("the entry exists, source echo, written by the admin who asked", row && row.source === "echo" && row.kind === "decision" && row.created_by === admin && /Reason:/.test(row.body));
  t("the tool result told Claude the id and title", /\"ok\":true/.test(seen[3].body.messages.at(-1).content[0].content) && new RegExp(`"id":${row.id}`).test(seen[3].body.messages.at(-1).content[0].content));
  t("the admin log has it", !!db.prepare("SELECT 1 FROM admin_log WHERE action = 'echo knowledge_add' AND target = ? AND admin_id = ?").get(String(row.id), admin));
  t("the turn says what it did", a2.tools.join() === "knowledge_add" && /Written down/.test(a2.text));
  t("Admin → Knowledge lists it, and it's in the next system prompt", (await call("tok-admin", "GET", "/api/admin/knowledge?q=plain+text")).j.entries.some((e) => e.id === row.id));

  console.log("\nMEMORY OF THE THREAD — replayed, then put away");
  script = [{ stop_reason: "end_turn", content: [{ type: "text", text: "Still here." }] }];
  await ask("tok-admin", "you there?");
  const r5 = seen[4].body;
  t("the third question carries the whole conversation: both earlier asks, tool rounds whole", r5.messages.filter((m) => m.role === "user" && m.content[0].type === "text").length === 3 && r5.messages.some((m) => m.content.some((b) => b.type === "tool_result" && b.tool_use_id === "tu_2")));
  t("…and the new Knowledge entry is in that system prompt", /### Echo answers in plain text/.test(r5.system[1].text));
  const turns = (await call("tok-admin", "GET", "/api/echo")).j.turns;
  t("coming back, three turns with their words and what was looked at", turns.length === 3 && turns[0].tools.join() === "overview" && turns[1].tools.join() === "knowledge_add" && /Still here/.test(turns[2].text));
  const fresh = await call("tok-admin", "POST", "/api/echo/reset");
  t("Start fresh puts the thread away (rows kept, not deleted)", fresh.j.ok && fresh.j.putAway >= 6 && (await call("tok-admin", "GET", "/api/echo")).j.turns.length === 0 && db.prepare("SELECT COUNT(*) n FROM echo_brain WHERE user_id = ?").get(admin).n >= 6);
  script = [{ stop_reason: "end_turn", content: [{ type: "text", text: "Fresh." }] }];
  await ask("tok-admin", "hi again");
  t("…the next question starts clean, Knowledge intact", seen.at(-1).body.messages.length === 1 && db.prepare("SELECT 1 FROM knowledge WHERE id = ?").get(row.id));

  console.log("\nWHEN CLAUDE FAILS — plain words, nothing dangling");
  script = [{ stop_reason: "tool_use", content: [{ type: "tool_use", id: "tu_9", name: "overview", input: {} }] }];
  const seenBefore = seen.length;
  mode = "401-after-tool";
  const a9 = await ask("tok-admin", "numbers?");
  t("a bad key answers in plain words and marks the turn failed", a9.failed === true && /key in Railway/.test(a9.text) && seen.length === seenBefore + 2);
  mode = "ok"; script = [{ stop_reason: "end_turn", content: [{ type: "text", text: "Back." }] }];
  const a10 = await ask("tok-admin", "ok now?");
  const replay = seen.at(-1).body.messages;
  const uses = replay.flatMap((m) => m.role === "assistant" ? m.content.filter((b) => b.type === "tool_use").map((b) => b.id) : []);
  const results = replay.flatMap((m) => m.role === "user" ? m.content.filter((b) => b.type === "tool_result").map((b) => b.tool_use_id) : []);
  t("the next question replays whole: every tool call has its result, and the failure rides as Echo's own words", a10.text === "Back." && uses.length && uses.every((id) => results.includes(id)) && replay.some((m) => m.role === "assistant" && m.content.some((b) => b.type === "text" && /key in Railway/.test(b.text))));
  t("an empty question is refused; a long one is kept to 4000", (await call("tok-admin", "POST", "/api/echo/ask", { q: "  " })).s === 400);
  t("nothing says the other brand", !/TNL/.test(seen[0].body.system[0].text));
} finally { await stop(srv); claude.close(); }

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
