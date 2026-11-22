// ECHO · Gemini as the brain v1.0 (2026-11-22, "Gemini in the model picker"): a fourth pick
// under Echo's composer, there only while GEMINI_API_KEY is set. A stand-in for Google listens
// at GEMINI_API_URL and a stand-in for Claude at ANTHROPIC_API_BASE, so the test checks what
// LABS sends each of them: the pick is offered only with the key and only to admins; picked,
// Google gets Echo's instructions, the same tools (hands included, the web through Google
// Search, no ask_gemini) and the conversation so far in its own shape — without Claude's
// sealed reasoning; a lookup Gemini asks for is run as the asking admin and goes back with
// Google's seal and id; a hand is still only a card; switching back, Claude gets the thread
// without anything of Google's on it; a failure answers in plain words and the next question works.
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { mkdirSync, rmSync } from "node:fs";
import { spawn } from "node:child_process";
import { createServer } from "node:http";
const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const DATA = join(ROOT, "test/.tmp/echo-gemini");
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

/* ---- the stand-in for Google: the brain's calls are streamed from a script; a grounded search is one plain answer ---- */
const G = { seen: [], script: [], mode: "ok", searches: [] };
const google = createServer((req, res) => {
  let body = ""; req.on("data", (d) => body += d); req.on("end", () => {
    const j = JSON.parse(body || "{}");
    const json = (code, o) => { res.writeHead(code, { "content-type": "application/json" }); res.end(JSON.stringify(o)); };
    if (req.headers["x-goog-api-key"] !== "AIza-secret") return json(400, { error: { message: "API key not valid. Please pass a valid API key." } });
    if (/:generateContent$/.test(req.url)) { G.searches.push({ url: req.url, body: j }); return json(200, { candidates: [{ content: { parts: [{ text: "Reels are reaching more than photos this month." }] }, groundingMetadata: { groundingChunks: [{ web: { uri: "https://example.org/report", title: "A report" } }] } }] }); }
    G.seen.push({ url: req.url, headers: req.headers, body: j });
    if (G.mode === "busy-once") { G.mode = "ok"; G.seen.pop(); G.waits = (G.waits || 0) + 1; return json(429, { error: { message: "You exceeded your current quota", details: [{ "@type": "type.googleapis.com/google.rpc.RetryInfo", retryDelay: "1s" }] } }); }
    if (G.mode === "busy") return json(429, { error: { message: "Resource has been exhausted" } });
    if (!/\/models\/gemini-4-hydrogen:streamGenerateContent\?alt=sse$/.test(req.url)) return json(404, { error: { message: "models/x is not found" } });
    if (G.mode === "nothink" && j.generationConfig.thinkingConfig) return json(400, { error: { message: 'Invalid JSON payload received. Unknown name "thinkingConfig" at \'generation_config\'' } });
    res.writeHead(200, { "content-type": "text/event-stream" });
    const ev = (o) => res.write(`data: ${JSON.stringify(o)}\r\n\r\n`);
    if (G.mode === "silent") { res.write(": ok\n\n"); return; }   // Google takes the question and never says a word
    if (G.mode === "safety") { ev({ candidates: [{ finishReason: "SAFETY" }] }); return res.end(); }
    const parts = G.script.shift() || [{ text: "(script ran out)" }];
    ev({ candidates: [{ content: { role: "model", parts: [{ text: "pondering…", thought: true }] } }] });   // a thought summary: never part of the answer
    for (const p of parts) {   // text in two pieces, the way it streams; a lookup whole
      if (p.text && !p.functionCall) { const cut = Math.ceil(p.text.length / 2); ev({ candidates: [{ content: { role: "model", parts: [{ text: p.text.slice(0, cut) }] } }] }); ev({ candidates: [{ content: { role: "model", parts: [{ text: p.text.slice(cut) }] } }] }); }
      else ev({ candidates: [{ content: { role: "model", parts: [p] } }] });
    }
    ev({ candidates: [{ content: { role: "model", parts: [] }, finishReason: "STOP" }], usageMetadata: { candidatesTokenCount: 12, thoughtsTokenCount: 30 } });
    res.end();
  });
});
await new Promise((r) => google.listen(0, "127.0.0.1", r));

/* ---- the stand-in for Claude: every reply starts with sealed reasoning, as the real ones do ---- */
const C = { seen: [], script: [] };
const claude = createServer((req, res) => {
  let body = ""; req.on("data", (d) => body += d); req.on("end", () => {
    const j = JSON.parse(body || "{}"); C.seen.push(j);
    const next = C.script.shift() || { stop_reason: "end_turn", content: [{ type: "text", text: "(script ran out)" }] };
    res.writeHead(200, { "content-type": "text/event-stream" });
    const ev = (type, d) => res.write(`event: ${type}\ndata: ${JSON.stringify({ type, ...d })}\n\n`);
    ev("message_start", { message: { id: "msg_" + C.seen.length, role: "assistant", model: j.model, usage: { input_tokens: 10 } } });
    [{ type: "thinking" }, ...next.content].forEach((b, index) => {
      if (b.type === "thinking") { ev("content_block_start", { index, content_block: { type: "thinking", thinking: "", signature: "" } }); ev("content_block_delta", { index, delta: { type: "thinking_delta", thinking: "CLAUDE-PRIVATE-REASONING" } }); ev("content_block_delta", { index, delta: { type: "signature_delta", signature: "CLAUDE-SEAL" } }); }
      else if (b.type === "text") { ev("content_block_start", { index, content_block: { type: "text", text: "" } }); ev("content_block_delta", { index, delta: { type: "text_delta", text: b.text } }); }
      else { ev("content_block_start", { index, content_block: { type: b.type, id: b.id, name: b.name, input: {} } }); ev("content_block_delta", { index, delta: { type: "input_json_delta", partial_json: JSON.stringify(b.input || {}) } }); }
      ev("content_block_stop", { index });
    });
    ev("message_delta", { delta: { stop_reason: next.stop_reason }, usage: { output_tokens: 20 } }); ev("message_stop", {}); res.end();
  });
});
await new Promise((r) => claude.listen(0, "127.0.0.1", r));

const PORT = 18820 + (process.pid % 150);
const boot = (env) => {
  const srv = spawn(process.execPath, ["--experimental-sqlite", "src/server.js"], { cwd: ROOT, env: { ...process.env, PORT: String(PORT), TNL_DATA: DATA, TNL_NO_WATCH: "1", ECHO_AI_KEY: "sk-ant-test", ANTHROPIC_API_KEY: "", ANTHROPIC_API_BASE: `http://127.0.0.1:${claude.address().port}`, ECHO_MODEL: "claude-opus-5-5", ECHO_HOLD_MS: "150",
    GEMINI_API_KEY: "AIza-secret", GEMINI_API_URL: `http://127.0.0.1:${google.address().port}/v1beta`, GEMINI_MODEL: "", ECHO_GEMINI_MODEL: "", ECHO_GEMINI_QUIET_MS: "600", ...env }, stdio: ["ignore", "pipe", "pipe"] });
  srv.log = ""; srv.stdout.on("data", (d) => srv.log += d); srv.stderr.on("data", (d) => srv.log += d);
  return srv;
};
const ready = async (srv) => { for (let i = 0; i < 150 && !/listening/.test(srv.log); i++) await new Promise((r) => setTimeout(r, 100)); };
const stop = (srv) => new Promise((r) => { srv.on("exit", r); srv.kill(); });
const call = async (tok, method, path, body) => {
  const r = await fetch(`http://127.0.0.1:${PORT}${path}`, { method, headers: { "content-type": "application/json", ...(tok ? { authorization: "Bearer " + tok } : {}) }, body: body ? JSON.stringify(body) : undefined });
  return { s: r.status, j: await r.json().catch(() => ({})) };
};
const ask = async (q) => (await call("tok-admin", "POST", "/api/echo/ask", { q })).j.turn;
const GEM = "gemini-4-hydrogen";

let srv = boot({}); await ready(srv);
try {
  console.log("\nTHE PICK — there with the key, admins only");
  const h = (await call("tok-admin", "GET", "/api/echo")).j;
  t("Echo's models: the three Claudes, then Gemini by its plain name", h.models.length === 4 && h.models[3].id === GEM && h.models[3].name === "Gemini 4 Hydrogen" && /Google/.test(h.models[3].line) && h.model === "claude-opus-5-5");
  t("a member can't pick it", (await call("tok-ana", "POST", "/api/echo/model", { model: GEM })).s === 403);

  /* a conversation that starts with Claude, so the switch is checked mid-thread */
  C.script = [{ stop_reason: "tool_use", content: [{ type: "text", text: "Let me look." }, { type: "tool_use", id: "toolu_c1", name: "overview", input: {} }] }, { stop_reason: "end_turn", content: [{ type: "text", text: "Two members so far." }] }];
  const a0 = await ask("how are we doing?");
  t("Claude answers first, as before", a0 && /Two members/.test(a0.text) && a0.model === "Opus 5.5" && G.seen.length === 0);

  const pick = await call("tok-admin", "POST", "/api/echo/model", { model: GEM });
  t("the admin picks Gemini: the next message uses it", pick.s === 200 && pick.j.model === GEM && pick.j.name === "Gemini 4 Hydrogen" && (await call("tok-admin", "GET", "/api/echo")).j.model === GEM);

  console.log("\nGEMINI ANSWERS AS ECHO — same instructions, same eyes, the thread kept");
  G.script = [[{ text: "Let me check posts." }, { functionCall: { name: "posts", args: {}, id: "call_1" }, thoughtSignature: "GOOGLE-SEAL-1" }], [{ text: "Nothing posted yet. Quiet day." }]];
  const c0 = C.seen.length, a1 = await ask("and posts?");
  t("the turn: Gemini's words, what it looked at, and which one wrote it", a1 && a1.kind === "brain" && a1.text === "Nothing posted yet. Quiet day." && a1.tools.join() === "posts" && a1.model === "Gemini 4 Hydrogen" && !a1.failed && !/pondering/.test(JSON.stringify(a1)));
  t("Claude wasn't called for it", C.seen.length === c0);
  const r1 = G.seen[0], r2 = G.seen[1];
  t("Google got the key in a header — never in the address — and the model, streamed", G.seen.length === 2 && r1.headers["x-goog-api-key"] === "AIza-secret" && !/AIza/.test(r1.url) && r1.url.endsWith(`/models/${GEM}:streamGenerateContent?alt=sse`));
  const sys = r1.body.systemInstruction.parts[0].text;
  t("Echo's own instructions, with Knowledge — the ones this conversation began under", /You are Echo/.test(sys) && /KNOWLEDGE/.test(sys) && /@jorge/.test(sys));
  const decl = r1.body.tools[0].functionDeclarations, names = decl.map((d) => d.name);
  t("the same eyes and hands, the web through Google Search — and no ask_gemini, nothing for messages", ["overview", "members", "orders", "knowledge", "knowledge_add", "feature_member", "web_search"].every((n) => names.includes(n)) && !names.includes("ask_gemini") && !names.some((n) => /^(dm|messages?|inbox)/.test(n)));
  t("every tool carries its JSON schema and a description", decl.every((d) => d.description && d.parametersJsonSchema && d.parametersJsonSchema.type === "object"));
  const k1 = r1.body.contents, flat = JSON.stringify(r1.body);
  t("the conversation so far, in Google's shape: turns alternate, Claude's lookup and its result ride along", k1.map((c) => c.role).join() === "user,model,user,model,user" && k1[1].parts.some((p) => p.functionCall && p.functionCall.name === "overview") && k1[2].parts[0].functionResponse.name === "overview" && typeof k1[2].parts[0].functionResponse.response.result === "string" && /Two members/.test(k1[3].parts[0].text) && k1[4].parts[0].text === "and posts?");
  t("…without Claude's sealed reasoning, and no emails", !/CLAUDE-PRIVATE-REASONING|CLAUDE-SEAL|thinking/.test(JSON.stringify(k1)) && !flat.includes("@x.test"));
  const k2 = r2.body.contents, mine = k2.at(-2).parts.find((p) => p.functionCall), back = k2.at(-1).parts[0].functionResponse;
  t("Gemini's lookup goes back with Google's seal and id, exactly as they came", k2.at(-2).role === "model" && mine.functionCall.name === "posts" && mine.functionCall.id === "call_1" && mine.thoughtSignature === "GOOGLE-SEAL-1");
  t("…and its result: run as the admin, named and matched to the call", k2.at(-1).role === "user" && back.name === "posts" && back.id === "call_1" && typeof back.response.result === "string" && back.response.result.length > 1);
  t("kept on disk in the one shape: question, reply, result, reply — the reply says Gemini wrote it", db.prepare("SELECT kind, model FROM echo_brain WHERE user_id = ? AND kind != 'system' ORDER BY id DESC LIMIT 4").all(admin).reverse().map((r) => r.kind + ":" + r.model).join() === `ask:,reply:${GEM},result:,reply:${GEM}`);

  console.log("\nHANDS AND THE WEB");
  G.script = [[{ functionCall: { name: "feature_member", args: { username: "@Ana", why: "Her poster carried the week." } }, thoughtSignature: "GOOGLE-SEAL-2" }], [{ text: "I've set up a card to feature Ana." }]];
  const rep0 = db.prepare("SELECT rep FROM users WHERE id = ?").get(ana).rep, a2 = await ask("feature ana");
  t("a hand from Gemini is still only a card with Confirm — nothing moved", a2 && a2.proposals.length === 1 && /Feature @ana/.test(a2.proposals[0].title) && db.prepare("SELECT rep FROM users WHERE id = ?").get(ana).rep === rep0 && !a2.tools.includes("feature_member"));
  G.script = [[{ functionCall: { name: "web_search", args: { query: "What kind of Instagram post reaches most this month? (for jorge@example.com)" } }, thoughtSignature: "GOOGLE-SEAL-3" }], [{ text: "Reels, says the web." }]];
  const a3 = await ask("what reaches most on Instagram?");
  const sq = G.searches.at(-1), sback = JSON.stringify(G.seen.at(-1).body.contents.at(-1));
  t("the web goes through Google Search: only the question, emails out, the answer back with its source", a3 && /Reels/.test(a3.text) && a3.tools.includes("web_search") && G.searches.length === 1 && sq.body.contents[0].parts[0].text === "What kind of Instagram post reaches most this month? (for [email])" && JSON.stringify(sq.body.tools) === '[{"google_search":{}}]' && /Reels are reaching more/.test(sback) && /example\.org\/report/.test(sback));
  t("…and it's in the admin log", !!db.prepare("SELECT 1 FROM admin_log WHERE action = 'echo ask_gemini' AND admin_id = ?").get(admin));

  console.log("\nWHEN GOOGLE SAYS NO — plain words, and the next question works");
  G.mode = "busy";
  const b1 = await ask("still there?");
  t("the key's limit used up: one plain line that says how to carry on", b1 && b1.failed && /limit for this key is used up/.test(b1.text) && /pick another/.test(b1.text));
  G.mode = "safety";
  const b2 = await ask("hm?");
  t("Gemini won't answer: says so, as Gemini", b2 && b2.failed && b2.text === "Gemini wouldn't answer that one.");
  /* v1.1, "It doesn't seem to be working": the first real question sat on Thinking for three minutes */
  t("Gemini is asked to think lightly and to stream its thinking", G.seen[0].body.generationConfig.thinkingConfig.thinkingLevel === "low" && G.seen[0].body.generationConfig.thinkingConfig.includeThoughts === true);
  G.mode = "silent"; const s0 = Date.now(), b5 = await ask("anyone there?");
  t("Google goes quiet: given up on after the quiet limit, not three minutes — and said plainly", b5 && b5.failed && /went quiet/.test(b5.text) && /pick another/.test(b5.text) && Date.now() - s0 < 5000);
  G.mode = "nothink"; G.script = [[{ text: "Here without the settings." }]];
  const n0 = G.seen.length, b6 = await ask("and now?");
  t("a model that won't take the thinking settings is asked again without them", b6 && b6.text === "Here without the settings." && G.seen.length === n0 + 2 && !G.seen.at(-1).body.generationConfig.thinkingConfig);
  G.mode = "ok"; const before = G.seen.length;
  /* a lookup, then Google fails on the way back: the half-finished lookup must not ride on the next question */
  G.script = [[{ functionCall: { name: "overview", args: {} }, thoughtSignature: "GOOGLE-SEAL-4" }]];
  const flip = setInterval(() => { if (G.seen.length === before + 1) { G.mode = "busy"; clearInterval(flip); } }, 5);
  const b3 = await ask("overview please"); clearInterval(flip); G.mode = "ok";
  t("a failure after a lookup: said plainly", b3 && b3.failed && /limit/.test(b3.text));
  G.script = [[{ text: "Back. All good." }]];
  const b4 = await ask("try again");
  const roles = G.seen.at(-1).body.contents.map((c) => c.role), calls = JSON.stringify(G.seen.at(-1).body.contents).match(/"functionCall"/g).length, resps = JSON.stringify(G.seen.at(-1).body.contents).match(/"functionResponse"/g).length;
  t("…and the next question goes through: turns still alternate, every lookup has its result", b4 && /Back\. All good\./.test(b4.text) && !b4.failed && roles.every((r, i) => i === 0 || r !== roles[i - 1]) && roles[0] === "user" && calls === resps);

  console.log("\nA FREE KEY — what Gemini is sent stays small, and a short limit is waited out (v1.2)");
  G.mode = "busy-once"; G.script = [[{ text: "Waited, then answered." }]];
  const w0 = Date.now(), b7 = await ask("one more");
  t("Google says the limit clears in a second: Echo waits and asks again instead of failing", b7 && b7.text === "Waited, then answered." && !b7.failed && G.waits === 1 && Date.now() - w0 >= 1000);
  /* a long thread from before: eight questions, each with a big lookup and a photo — as Claude would have left it */
  { const big = "x".repeat(20000), put = db.prepare("INSERT INTO echo_brain (user_id, role, kind, content, model, label, created_at) VALUES (?,?,?,?,?,'',?)");
    for (let i = 0; i < 8; i++) { put.run(admin, "user", "ask", JSON.stringify([{ type: "text", text: "old question " + i }, { type: "image", source: { type: "base64", media_type: "image/png", data: "QUJD".repeat(5000) } }]), "", Date.now());
      put.run(admin, "assistant", "reply", JSON.stringify([{ type: "tool_use", id: "toolu_old" + i, name: "members", input: {} }]), "claude-opus-5-5", Date.now());
      put.run(admin, "user", "result", JSON.stringify([{ type: "tool_result", tool_use_id: "toolu_old" + i, content: big }]), "", Date.now());
      put.run(admin, "assistant", "reply", JSON.stringify([{ type: "text", text: "old answer " + i }]), "claude-opus-5-5", Date.now()); } }
  G.script = [[{ text: "Short and sweet." }]];
  const b8 = await ask("what now?"), sent = G.seen.at(-1).body, sflat = JSON.stringify(sent.contents);
  t("Gemini gets the last six questions, not the whole thread", b8 && b8.text === "Short and sweet." && !/old question 2"/.test(sflat) && /old question 3/.test(sflat) && /old question 7/.test(sflat) && sent.contents.at(-1).parts[0].text === "what now?");
  t("…earlier lookups cut short and earlier photos left out — a megabyte doesn't ride on every call", !sflat.includes("x".repeat(1600)) && /cut short/.test(sflat) && !/inlineData/.test(sflat) && /a photo was attached here/.test(sflat) && sflat.length < 40000);
  t("…and every lookup still has its result, turns still alternate", sflat.match(/"functionCall"/g).length === sflat.match(/"functionResponse"/g).length && sent.contents.every((c, i) => i === 0 ? c.role === "user" : c.role !== sent.contents[i - 1].role));

  console.log("\nBACK TO CLAUDE — the thread kept, nothing of Google's on it");
  t("pick Opus again", (await call("tok-admin", "POST", "/api/echo/model", { model: "claude-opus-5-5" })).s === 200);
  C.script = [{ stop_reason: "end_turn", content: [{ type: "text", text: "Picking up where Gemini left it." }] }];
  const g0 = G.seen.length, a4 = await ask("carry on");
  const cm = C.seen.at(-1).messages, cflat = JSON.stringify(cm), uses = cm.flatMap((m) => m.content).filter((b) => b.type === "tool_use"), results = cm.flatMap((m) => m.content).filter((b) => b.type === "tool_result");
  t("Claude still gets the whole thread — nothing was cut on disk", /old question 0/.test(JSON.stringify(C.seen.at(-1).messages)) && JSON.stringify(C.seen.at(-1).messages).includes("x".repeat(20000)));
  t("Claude answers, Google isn't called", a4 && /Picking up/.test(a4.text) && a4.model === "Opus 5.5" && G.seen.length === g0);
  t("Claude gets Gemini's words and lookups as plain blocks — no seal, no Google id", /Nothing posted yet/.test(cflat) && uses.some((b) => b.name === "posts") && !/gsig|gid|GOOGLE-SEAL|call_1/.test(cflat) && uses.every((b) => /^[a-zA-Z0-9_-]{1,64}$/.test(b.id)));
  t("…every lookup still has its result, and no empty text", uses.every((u) => results.some((r) => r.tool_use_id === u.id)) && cm.flatMap((m) => m.content).every((b) => b.type !== "text" || b.text.length > 0));
  await call("tok-admin", "POST", "/api/echo/model", { model: GEM });
} finally { await stop(srv); }

srv = boot({ GEMINI_API_KEY: "" }); await ready(srv);
try {
  console.log("\nNO GEMINI KEY — nothing of it shows");
  const h = (await call("tok-admin", "GET", "/api/echo")).j;
  t("the picker is the three Claudes; a pick left on Gemini falls back to the default", h.models.length === 3 && !h.models.some((m) => /gemini/.test(m.id)) && h.model === "claude-opus-5-5");
  t("Gemini can't be picked", (await call("tok-admin", "POST", "/api/echo/model", { model: GEM })).s === 400);
  C.script = [{ stop_reason: "end_turn", content: [{ type: "text", text: "Here." }] }];
  const g0 = G.seen.length, a = await ask("hello");
  t("a question goes to Claude, never to Google", a && a.text === "Here." && G.seen.length === g0 && C.seen.at(-1).model === "claude-opus-5-5");
  t("an old answer still says Gemini wrote it", (await call("tok-admin", "GET", "/api/echo")).j.turns.some((x) => x.model === "Gemini 4 Hydrogen"));
} finally { await stop(srv); google.close(); claude.close(); }

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
