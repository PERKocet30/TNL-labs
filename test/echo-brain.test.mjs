// ECHO · the brain v1.0 (2026-11-04): Echo for the founder — a model that reasons,
// the connector's tools as its eyes, Knowledge as its memory. A stand-in for
// Claude listens at ANTHROPIC_API_BASE and plays a script, so the test checks
// what LABS sends and does: only admins reach the brain (members still get the
// matcher, and nobody does without a key); the system prompt carries Knowledge;
// a tool the model asks for is run as the asking admin and its scrubbed result
// goes back; a knowledge_add from the model lands in Knowledge as "echo" and in
// the admin log; the conversation is kept and replayed; Start fresh puts it away;
// a failure answers in plain words and leaves no dangling tool call behind.
// v1.2 (2026-11-04, "I like option 2" → "Invalid signature in thinking block"): the stand-in
// now seals its reasoning to the instructions it was written under and refuses a
// mismatch the way the real API does, so a Knowledge write mid-conversation is checked.
// v1.3 (2026-11-04): the model switch — three to pick from, admins only, the next
// message uses it, every answer says which one wrote it.
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { mkdirSync, rmSync } from "node:fs";
import { spawn } from "node:child_process";
import { createServer } from "node:http";
import { createHash } from "node:crypto";
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
let drops = 0;   // how many times the stand-in dropped stale reasoning because it was asked to
const seal = (j) => "sig:" + createHash("sha256").update(JSON.stringify(j.system) + JSON.stringify(j.tools)).digest("hex").slice(0, 16);
const BINDING = "messages.1.content.0: Invalid `signature` in `thinking` block. The block is bound to a different conversation. Remove the block, or set `thinking.block_binding.prefix_mismatch_behavior` to \"drop_block\".";
const claude = createServer((req, res) => {
  let body = ""; req.on("data", (d) => body += d); req.on("end", () => {
    const j = JSON.parse(body || "{}"); seen.push({ headers: req.headers, body: j });
    /* the binding check, as the real API runs it: reasoning sealed to other instructions is refused, unless the request asks to drop it */
    const stale = (j.messages || []).some((m) => Array.isArray(m.content) && m.content.some((b) => b.type === "thinking" && b.signature !== seal(j)));
    const dropOk = j.thinking && j.thinking.block_binding && j.thinking.block_binding.prefix_mismatch_behavior === "drop_block" && req.headers["anthropic-beta"] === "thinking-binding-controls-2026-08-01";
    if (stale && (!dropOk || mode === "refuse-binding")) { res.writeHead(400, { "content-type": "application/json" }); return res.end(JSON.stringify({ type: "error", error: { type: "invalid_request_error", message: BINDING } })); }
    if (stale) drops++;
    if (mode === "500") { res.writeHead(500, { "content-type": "application/json" }); return res.end(JSON.stringify({ type: "error", error: { type: "api_error", message: "Internal server error" } })); }
    if (mode === "401" || (mode === "401-after-tool" && j.messages.at(-1).content[0] && j.messages.at(-1).content[0].type === "tool_result")) { res.writeHead(401, { "content-type": "application/json" }); return res.end(JSON.stringify({ error: { type: "authentication_error", message: "invalid x-api-key" } })); }
    const next = script.shift() || { stop_reason: "end_turn", content: [{ type: "text", text: "(script ran out)" }] };
    /* streamed, the way Claude answers: text in two pieces, tool input as partial JSON */
    res.writeHead(200, { "content-type": "text/event-stream" });
    const ev = (type, d) => res.write(`event: ${type}\ndata: ${JSON.stringify({ type, ...d })}\n\n`);
    ev("message_start", { message: { id: "msg_" + seen.length, role: "assistant", model: j.model, usage: { input_tokens: 10 } } });
    const content = [{ type: "thinking" }, ...next.content];   // every reply starts with sealed reasoning, as Opus 5.5's do
    content.forEach((b, index) => {
      if (b.type === "thinking") { ev("content_block_start", { index, content_block: { type: "thinking", thinking: "", signature: "" } }); ev("content_block_delta", { index, delta: { type: "signature_delta", signature: seal(j) } }); ev("content_block_stop", { index }); return; }
      if (b.type === "text") { ev("content_block_start", { index, content_block: { type: "text", text: "" } }); const cut = Math.ceil(b.text.length / 2); ev("content_block_delta", { index, delta: { type: "text_delta", text: b.text.slice(0, cut) } }); ev("content_block_delta", { index, delta: { type: "text_delta", text: b.text.slice(cut) } }); }
      else { ev("content_block_start", { index, content_block: { type: "tool_use", id: b.id, name: b.name, input: {} } }); const js = JSON.stringify(b.input || {}); ev("content_block_delta", { index, delta: { type: "input_json_delta", partial_json: js.slice(0, 5) } }); ev("content_block_delta", { index, delta: { type: "input_json_delta", partial_json: js.slice(5) } }); }
      ev("content_block_stop", { index });
    });
    ev("message_delta", { delta: { stop_reason: next.stop_reason }, usage: { output_tokens: 20 } });
    ev("message_stop", {}); res.end();
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
  t("Claude got the key, the model, streaming on, and no beta surprises", r1.headers["x-api-key"] === "sk-ant-test" && r1.headers["anthropic-version"] === "2023-06-01" && r1.body.model === "claude-opus-5-5" && r1.body.max_tokens === 8192 && r1.body.stream === true);
  t("…and the safety net: the binding beta, and \"drop stale reasoning, don't refuse\"", r1.headers["anthropic-beta"] === "thinking-binding-controls-2026-08-01" && r1.body.thinking.type === "adaptive" && r1.body.thinking.block_binding.prefix_mismatch_behavior === "drop_block");
  const sys = r1.body.system;
  t("the system prompt: who Echo is, then Knowledge (cached), then who's asking — and no date in it (a new day must not change it)", Array.isArray(sys) && sys.length === 3 && /You are Echo/.test(sys[0].text) && /KNOWLEDGE/.test(sys[1].text) && sys[1].cache_control && sys[1].cache_control.ttl === "1h" && /@jorge/.test(sys[2].text) && !/20\d\d/.test(sys[2].text));
  t("Knowledge rides along as written: the creed and the features", /take over/.test(sys[1].text) && /### The Showroom/.test(sys[1].text) && /### Rep only comes from other people/.test(sys[1].text));
  const names = r1.body.tools.map((x) => x.name);
  t("the tools are the connector's: overview, members, orders, events, knowledge, knowledge_add — and nothing for messages", names.includes("overview") && names.includes("members") && names.includes("orders") && names.includes("events") && names.includes("knowledge") && names.includes("knowledge_add") && !names.some((n) => /^(messages?|dms?|inbox|groups?)$/.test(n)));
  t("tools carry a JSON schema in Claude's shape", r1.body.tools.every((x) => x.input_schema && x.input_schema.type === "object" && x.description));
  t("the first request is just the question, with today's date riding on it", r1.body.messages.length === 1 && r1.body.messages[0].role === "user" && r1.body.messages[0].content[0].text === "how are we doing?" && /^\(Today is \w+day, /.test((r1.body.messages[0].content[1] || {}).text || ""));
  const back = r2.body.messages;
  t("the second request replays the tool call, its sealed reasoning, and brings its result", back.length === 3 && back[1].role === "assistant" && back[1].content[0].type === "thinking" && back[1].content[0].signature === seal(r1.body) && back[1].content.some((b) => b.type === "tool_use") && back[2].content[0].type === "tool_result" && back[2].content[0].tool_use_id === "tu_1");
  const result = JSON.parse(back[2].content[0].content);
  t("…the result is the real overview, run as the admin: member counts, no emails", result && typeof result === "object" && !JSON.stringify(result).includes("@x.test") && JSON.stringify(result).length > 20);
  t("the instructions are kept once, then the question, then Claude's replies stored whole (reasoning, text, tool_use)", db.prepare("SELECT kind FROM echo_brain WHERE user_id = ? ORDER BY id").all(admin).map((r) => r.kind).join() === "system,ask,reply,result,reply");
  t("coming back, the question shows as asked (the date is for Claude only)", (await call("tok-admin", "GET", "/api/echo")).j.turns[0].asked === "how are we doing?");

  console.log("\nTHE HAND — a decision written to Knowledge, logged, as Echo");
  script = [
    { stop_reason: "tool_use", content: [{ type: "tool_use", id: "tu_2", name: "knowledge_add", input: { kind: "decision", title: "Echo answers in plain text", body: "Chat bubbles, no markdown. Reason: the app renders text, not documents.", tags: "echo voice" } }] },
    { stop_reason: "end_turn", content: [{ type: "text", text: "Written down." }] },
  ];
  const a2 = await ask("tok-admin", "remember: plain text only");
  const row = db.prepare("SELECT * FROM knowledge WHERE title = 'Echo answers in plain text'").get();
  t("the entry exists (its input arrived as partial JSON and was put back together), source echo, written by the admin who asked", row && row.source === "echo" && row.kind === "decision" && row.created_by === admin && /Reason:/.test(row.body));
  t("the tool result told Claude the id and title", /\"ok\":true/.test(seen[3].body.messages.at(-1).content[0].content) && new RegExp(`"id":${row.id}`).test(seen[3].body.messages.at(-1).content[0].content));
  t("the admin log has it", !!db.prepare("SELECT 1 FROM admin_log WHERE action = 'echo knowledge_add' AND target = ? AND admin_id = ?").get(String(row.id), admin));
  t("the turn says what it did", a2.tools.join() === "knowledge_add" && /Written down/.test(a2.text));
  t("Admin → Knowledge lists it, and it's in the next system prompt", (await call("tok-admin", "GET", "/api/admin/knowledge?q=plain+text")).j.entries.some((e) => e.id === row.id));

  console.log("\nTHE BUG OF 2026-11-04 — a Knowledge write, then \"I like option 2\"");
  script = [{ stop_reason: "end_turn", content: [{ type: "text", text: "Still here." }] }];
  const dropsBefore = drops;
  const a5 = await ask("tok-admin", "I like option 2");
  const r5 = seen[4].body;
  t("the next message after a Knowledge write is answered, not refused", a5 && a5.text === "Still here." && !a5.failed);
  t("…because the instructions are the same, byte for byte, as when the conversation began", JSON.stringify(r5.system) === JSON.stringify(seen[0].body.system));
  t("…so nothing had to be dropped: every bit of earlier reasoning still counts", drops === dropsBefore && r5.messages.filter((m) => m.role === "assistant" && m.content[0].type === "thinking").length === 4);

  console.log("\nMEMORY OF THE THREAD — replayed, then put away");
  t("the third question carries the whole conversation: both earlier asks, tool rounds whole", r5.messages.filter((m) => m.role === "user" && m.content[0].type === "text").length === 3 && r5.messages.some((m) => m.content.some((b) => b.type === "tool_result" && b.tool_use_id === "tu_2")));
  t("…Knowledge written mid-conversation waits for the next conversation's instructions (Echo wrote it, so it knows)", !/### Echo answers in plain text/.test(r5.system[1].text));

  console.log("\nHEALING — a conversation from before this fix, and a refusal anyway");
  db.prepare("UPDATE echo_brain SET archived = 1 WHERE user_id = ? AND kind = 'system'").run(admin);   // as if the thread began before the freeze existed
  script = [{ stop_reason: "end_turn", content: [{ type: "text", text: "Healed." }] }];
  const dropsHeal = drops;
  const h1 = await ask("tok-admin", "still with me?");
  t("an old conversation's next message gets fresh instructions (with today's Knowledge) and an answer", h1.text === "Healed." && /### Echo answers in plain text/.test(seen.at(-1).body.system[1].text));
  t("…the stale reasoning was dropped by the API, as asked, instead of refusing", drops > dropsHeal);
  t("…and from then on the instructions hold still again", (script = [{ stop_reason: "end_turn", content: [{ type: "text", text: "Steady." }] }], (await ask("tok-admin", "and now?")).text === "Steady.") && JSON.stringify(seen.at(-1).body.system) === JSON.stringify(seen.at(-2).body.system));
  db.prepare("UPDATE echo_brain SET archived = 1 WHERE user_id = ? AND kind = 'system'").run(admin);
  mode = "refuse-binding";
  script = [{ stop_reason: "end_turn", content: [{ type: "text", text: "Answered without the old reasoning." }] }];
  const nSeen = seen.length;
  const h2 = await ask("tok-admin", "one more");
  mode = "ok";
  t("if Claude refuses old reasoning anyway, Echo asks once more without it — and answers", h2.text === "Answered without the old reasoning." && !h2.failed && seen.length === nSeen + 2);
  t("…the retry carried every word and tool call but no old reasoning", seen.at(-1).body.messages.every((m) => !Array.isArray(m.content) || !m.content.some((b) => b.type === "thinking")) && seen.at(-1).body.messages.some((m) => m.content.some && m.content.some((b) => b.type === "tool_use")));
  t("…and nothing stored was changed: the reasoning is still on disk", db.prepare("SELECT COUNT(*) n FROM echo_brain WHERE user_id = ? AND kind = 'reply' AND content LIKE '%\"thinking\"%'").get(admin).n >= 4);
  const turns = (await call("tok-admin", "GET", "/api/echo")).j.turns;
  t("coming back, every turn with its words and what was looked at", turns.length === 6 && turns[0].tools.join() === "overview" && turns[1].tools.join() === "knowledge_add" && /Still here/.test(turns[2].text) && turns[2].asked === "I like option 2");
  const fresh = await call("tok-admin", "POST", "/api/echo/reset");
  t("Start fresh puts the thread away (rows kept, not deleted)", fresh.j.ok && fresh.j.putAway >= 10 && (await call("tok-admin", "GET", "/api/echo")).j.turns.length === 0 && db.prepare("SELECT COUNT(*) n FROM echo_brain WHERE user_id = ?").get(admin).n >= 6);
  script = [{ stop_reason: "end_turn", content: [{ type: "text", text: "Fresh." }] }];
  await ask("tok-admin", "hi again");
  t("…the next question starts clean, with fresh instructions that now carry what was written", seen.at(-1).body.messages.length === 1 && /### Echo answers in plain text/.test(seen.at(-1).body.system[1].text) && db.prepare("SELECT 1 FROM knowledge WHERE id = ?").get(row.id));

  console.log("\nWHICH CLAUDE — pick a model from the composer; the next message uses it");
  const hm = (await call("tok-admin", "GET", "/api/echo")).j;
  t("the hello carries the model and the three to pick from, each with a line", hm.model === "claude-opus-5-5" && hm.models.length === 3 && hm.models.map((m) => m.id).join() === "claude-opus-5-5,claude-sonnet-5-5,claude-fable-5-1" && hm.models.every((m) => m.name && m.short && m.line));
  t("a member can't switch it; a made-up model is refused", (await call("tok-ana", "POST", "/api/echo/model", { model: "claude-sonnet-5-5" })).s === 403 && (await call("tok-admin", "POST", "/api/echo/model", { model: "gpt-9" })).s === 400 && (await call("tok-admin", "POST", "/api/echo/model", {})).s === 400);
  const sw = await call("tok-admin", "POST", "/api/echo/model", { model: "claude-sonnet-5-5" });
  t("the admin switches to Sonnet: saved as the echoModel setting", sw.s === 200 && sw.j.model === "claude-sonnet-5-5" && sw.j.name === "Claude Sonnet 5.5" && db.prepare("SELECT value FROM settings WHERE key = 'echoModel'").get().value === "claude-sonnet-5-5");
  script = [{ stop_reason: "end_turn", content: [{ type: "text", text: "Quick one." }] }];
  const a6 = await ask("tok-admin", "quick: how many members?");
  t("the next message goes to Sonnet, with the same frozen instructions", seen.at(-1).body.model === "claude-sonnet-5-5" && JSON.stringify(seen.at(-1).body.system) === JSON.stringify(seen.at(-2).body.system));
  t("…and the turn says who answered; the earlier ones still say Opus", a6.model === "Sonnet 5.5" && (await call("tok-admin", "GET", "/api/echo")).j.turns[0].model === "Opus 5.5");
  t("/api/echo/brain reports the picked model", (await call("tok-admin", "GET", "/api/echo/brain")).j.model === "claude-sonnet-5-5");
  await call("tok-admin", "POST", "/api/echo/model", { model: "claude-fable-5-1" });
  script = [{ stop_reason: "end_turn", content: [{ type: "text", text: "Deep one." }] }];
  const a7 = await ask("tok-admin", "what should I build this quarter?");
  t("Fable too: same request shape (adaptive thinking, the binding safety net), the turn says Fable", seen.at(-1).body.model === "claude-fable-5-1" && seen.at(-1).body.thinking.type === "adaptive" && seen.at(-1).body.thinking.block_binding.prefix_mismatch_behavior === "drop_block" && a7.model === "Fable 5.1");
  await call("tok-admin", "POST", "/api/echo/model", { model: "claude-opus-5-5" });

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
  mode = "500"; const a11 = await ask("tok-admin", "hello?"); mode = "ok";
  t("Claude failing on its side reads as plain words, never raw API text, and lands in the errors log", a11.failed && a11.text === "Claude had a problem on its side. Ask again in a moment." && !!db.prepare("SELECT 1 FROM error_log WHERE kind = 'echo'").get());
  t("an empty question is refused; a long one is kept to 4000", (await call("tok-admin", "POST", "/api/echo/ask", { q: "  " })).s === 400);
  t("nothing says the other brand", !/TNL/.test(seen[0].body.system[0].text));
} finally { await stop(srv); claude.close(); }

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
