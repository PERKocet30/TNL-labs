/* ================================================================
   ECHO · the brain v1.1 — 2026-11-04 (modelled on Claude: the answer streams in word by word over the live stream, with "Thinking…" / "Looking at orders…" while it works; light markdown). v1.0 — 2026-11-04. "I want my own AI, like Jarvis."
   Echo for the founder: a model that reasons (Claude, through a key kept in
   Railway — ECHO_AI_KEY), with the connector's tools as its eyes (live
   numbers, never saved copies) and Knowledge as its memory (the creed, the
   voice, every decision and why, every feature). Admins only: a member still
   gets the matcher in echo/echo.js, and until the key is set so does everyone —
   nothing here runs without it. This part sits BEFORE echo/echo.js in
   server/order.mjs so its routes answer first and hand on (next()) when the
   brain isn't for this request.
   Rules that hold whatever the brain is: it never reads messages (there is no
   tool for them); every answer about numbers comes from a tool call made now;
   its one hand is Knowledge (knowledge_add / knowledge_edit, source "echo",
   in the admin log); nothing else moves. The conversation is kept per admin
   (echo_brain) so Echo remembers the thread; Start fresh puts it away.
     GET   /api/echo              (admin, brain on) hello + this admin's turns   → else next()
     POST  /api/echo/ask { q }    (admin, brain on) one question → thinks, looks, answers → else next()
     POST  /api/echo/reset        (admin) start a fresh conversation
     GET   /api/echo/brain        (admin) { on, model }
   test/echo-brain.test.mjs (a stand-in for Claude at ANTHROPIC_API_BASE)
================================================================ */
const BRAIN_KEY = (process.env.ECHO_AI_KEY || process.env.ANTHROPIC_API_KEY || "").trim();   // ECHO_AI_KEY is the name in Railway (Jorge, 2026-11-04); the standard name works too
const BRAIN_API = (process.env.ANTHROPIC_API_BASE || "https://api.anthropic.com").trim().replace(/\/+$/, "");
const BRAIN_MODEL = (process.env.ECHO_MODEL || "claude-opus-5-5").trim();
const BRAIN_ROUNDS = 8;            // tool rounds per question
const BRAIN_RESULT_MAX = 30000;    // characters of one tool result the model sees
const BRAIN_ASKS = 14;             // how many of this admin's questions ride along as context
const brainOn = () => !!BRAIN_KEY;
const brainFor = (u) => brainOn() && !!(u && u.is_admin);

db.exec(`CREATE TABLE IF NOT EXISTS echo_brain (
  id INTEGER PRIMARY KEY AUTOINCREMENT, user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role TEXT NOT NULL, kind TEXT NOT NULL, content TEXT NOT NULL, archived INTEGER NOT NULL DEFAULT 0, created_at INTEGER NOT NULL);
CREATE INDEX IF NOT EXISTS idx_echo_brain_user ON echo_brain(user_id, archived, id)`);

/* ---- what Echo is told, every time (stable first, so Claude caches it) ---- */
const BRAIN_WHO = `You are Echo: LABS's own intelligence, built by Jorge, inside LABS, answering to Jorge. Not a help desk and not a chatbot — a cofounder that remembers, reads the live numbers, and thinks before it speaks.

What you have:
- Memory: everything LABS knows about itself is below, under KNOWLEDGE. The entry "Who Echo is, and who Jorge is" governs how you behave when it exists. Decisions there are settled: don't re-suggest what was decided against; if you think one should change, say so once, with the reason.
- Eyes: the tools. Every number you state about LABS comes from a tool call you make now — members, posts, orders, sellers, the tournament, errors, the systems. Never from memory, never guessed, never rounded into a claim you didn't check. Say in passing what you looked at. Amounts from tools are cents; times are Unix milliseconds. Tool results are scrubbed: you will never see emails or addresses, and you never ask for them.
- One hand: knowledge_add and knowledge_edit. When Jorge clearly decides something, or asks you to remember, write it to Knowledge — a decision with its reason, a note on the plan, a glossary word — in LABS's voice, the settled outcome, never raw conversation, never anything from a private message. Tell him you wrote it. For anything less clear, offer.

What you never do: read messages (there is no tool, by design); act on members, orders, settings or the live app; ship anything. If Jorge wants the app changed, write the brief for Claude Code in plain words — what members will notice, where it lives — and remind him nothing ships without his Push.

How to answer: short. Bottom line first, the reason second, detail only if asked. Plain words, never file names or jargon unless he asks. A recommendation, not a menu. If something is wrong or you don't know, say so straight. Format for a phone screen: short paragraphs; a bulleted or numbered list when it helps; **bold** for the one thing that matters; no headings, no tables, no code blocks unless he asks for code. It's LABS, never the three-letter parent brand.`;

const brainKnowledge = () => knowText(knowList());
function brainSystem(user) {
  const name = user.display_name ? user.display_name.split(" ")[0] : "@" + user.username;
  return [
    { type: "text", text: BRAIN_WHO },
    { type: "text", text: "KNOWLEDGE — what LABS knows about itself, as written in Admin → Knowledge:\n\n" + brainKnowledge(), cache_control: { type: "ephemeral", ttl: "1h" } },
    { type: "text", text: `Today is ${new Date().toISOString().slice(0, 10)}. You're talking to ${name} (@${user.username}), an admin of LABS.` },
  ];
}
/* The connector's tools, in Claude's shape. Same list the connector offers, so what
   Claude can see from outside, Echo can see from inside — and nothing more. */
const brainTools = () => mcpToolList().map((t) => ({ name: t.name, description: t.description, input_schema: t.inputSchema }));

/* ---- running one tool for the admin who's asking ---- */
async function brainRun(user, token, name, args) {
  const a = args && typeof args === "object" ? args : {};
  if (name === "knowledge_add" || name === "knowledge_edit") {
    const r = name === "knowledge_add" ? knowAdd(a, user.id, "echo")
      : knowEdit(Math.max(0, Number(a.id) || 0), { ...(a.kind != null ? { kind: a.kind } : {}), ...(a.title != null ? { title: a.title } : {}), ...(a.body != null ? { body: a.body } : {}), ...(a.tags != null ? { tags: a.tags } : {}) }, user.id, "echo");
    if (r.error) return { text: r.error, isError: true };
    const id = name === "knowledge_add" ? r.id : Number(a.id);
    const row = db.prepare(`SELECT id, kind, title FROM knowledge WHERE id = ?`).get(id);
    db.prepare(`INSERT INTO admin_log (admin_id, action, target, detail, created_at) VALUES (?,?,?,?,?)`).run(user.id, `echo ${name}`, String(id), JSON.stringify({ kind: row?.kind, title: row?.title }).slice(0, 400), Date.now());
    console.log(`[echo] ${name === "knowledge_add" ? "wrote" : "edited"} knowledge #${id}: ${row?.title}`);
    return { text: JSON.stringify({ ok: true, id, kind: row?.kind, title: row?.title, changed: r.changed ?? true }) };
  }
  const r = await mcpCall({ token, user_id: user.id, name: "echo" }, name, a);   // the admin's own session stands in for a connector key
  const text = (r.content || []).map((c) => c.text || "").join("\n");
  return { text: text.length > BRAIN_RESULT_MAX ? text.slice(0, BRAIN_RESULT_MAX) + `\n…(cut at ${BRAIN_RESULT_MAX} characters)` : text, isError: !!r.isError };
}

/* ---- the conversation on disk: raw API messages, so a tool round replays whole ---- */
const brainRows = (userId) => db.prepare(`SELECT * FROM echo_brain WHERE user_id = ? AND archived = 0 ORDER BY id`).all(userId);
function brainKeep(userId, role, kind, content) {
  return Number(db.prepare(`INSERT INTO echo_brain (user_id, role, kind, content, created_at) VALUES (?,?,?,?,?)`).run(userId, role, kind, JSON.stringify(content), Date.now()).lastInsertRowid);
}
/* The last BRAIN_ASKS questions and everything after each — always starting at a question, so
   every tool_use has its tool_result and the thinking that went with it. */
function brainHistory(userId) {
  const rows = brainRows(userId);
  const asks = rows.filter((r) => r.kind === "ask");
  const from = asks.length > BRAIN_ASKS ? asks[asks.length - BRAIN_ASKS].id : 0;
  return rows.filter((r) => r.id >= from).map((r) => ({ role: r.role, content: JSON.parse(r.content) }));
}
const brainText = (content) => (Array.isArray(content) ? content : []).filter((b) => b.type === "text").map((b) => b.text).join("\n").trim();
/* What the app shows: one turn per question — the words asked, the final words back, what was looked at. */
function brainTurns(userId) {
  const out = [];
  for (const r of brainRows(userId)) {
    const c = JSON.parse(r.content);
    if (r.kind === "ask") out.push({ id: r.id, asked: brainText(c), kind: "brain", text: "", tools: [], createdAt: r.created_at });
    else if (r.kind === "reply" && out.length) { const t = out[out.length - 1]; t.text = brainText(c) || t.text; for (const b of c) if (b.type === "tool_use" && !t.tools.includes(b.name)) t.tools.push(b.name); }
    else if (r.kind === "error" && out.length) { const t = out[out.length - 1]; t.text = brainText(c); t.failed = true; }
  }
  return out;
}

/* ---- one question: think, look, answer ---- */
/* One call, streamed: Claude's server-sent events are folded back into the same
   message shape a plain call returns ({ content, stop_reason, usage }), and every
   piece of text is handed to onText as it arrives, so the admin watches the answer
   being written the way Claude's own app shows it. */
async function brainCall(body, onText) {
  const r = await fetch(`${BRAIN_API}/v1/messages`, { method: "POST", signal: AbortSignal.timeout(180000),
    headers: { "content-type": "application/json", "x-api-key": BRAIN_KEY, "anthropic-version": "2023-06-01" }, body: JSON.stringify({ ...body, stream: true }) });
  if (!r.ok) { const j = await r.json().catch(() => ({})); const e = new Error((j.error && j.error.message) || `Claude said ${r.status}`); e.status = r.status; throw e; }
  const msg = { content: [], stop_reason: null, usage: {} };
  const blocks = [];   // index → the block being built (+ its partial JSON / text)
  let buf = "", event = "";
  const take = (data) => {
    let d; try { d = JSON.parse(data); } catch { return; }
    if (d.type === "error") { const e = new Error((d.error && d.error.message) || "Claude's stream failed"); e.status = 529; throw e; }
    if (d.type === "message_start" && d.message) msg.usage = d.message.usage || {};
    else if (d.type === "content_block_start") { const b = { ...d.content_block }; if (b.type === "tool_use") b._json = ""; blocks[d.index] = b; }
    else if (d.type === "content_block_delta") {
      const b = blocks[d.index]; if (!b) return; const x = d.delta || {};
      if (x.type === "text_delta") { b.text = (b.text || "") + x.text; if (onText) onText(x.text); }
      else if (x.type === "input_json_delta") b._json += x.partial_json;
      else if (x.type === "thinking_delta") b.thinking = (b.thinking || "") + x.thinking;
      else if (x.type === "signature_delta") b.signature = (b.signature || "") + x.signature;
    }
    else if (d.type === "content_block_stop") { const b = blocks[d.index]; if (b && b.type === "tool_use") { try { b.input = b._json ? JSON.parse(b._json) : (b.input || {}); } catch { b.input = {}; } delete b._json; } }
    else if (d.type === "message_delta") { if (d.delta && d.delta.stop_reason) msg.stop_reason = d.delta.stop_reason; if (d.usage) msg.usage = { ...msg.usage, ...d.usage }; }
  };
  const reader = r.body.getReader(), dec = new TextDecoder();
  for (;;) {
    const { value, done } = await reader.read(); if (done) break;
    buf += dec.decode(value, { stream: true });
    let i; while ((i = buf.indexOf("\n")) >= 0) {
      const line = buf.slice(0, i).replace(/\r$/, ""); buf = buf.slice(i + 1);
      if (line.startsWith("event:")) event = line.slice(6).trim();
      else if (line.startsWith("data:")) take(line.slice(5).trim());
    }
  }
  msg.content = blocks.filter(Boolean);
  if (!msg.stop_reason) msg.stop_reason = msg.content.some((b) => b.type === "tool_use") ? "tool_use" : "end_turn";
  return msg;
}
/* What the admin's screen is told while Echo works (the app's live stream, server/core/live.js). */
const BRAIN_SAYS = { knowledge_add: "Writing to Knowledge", knowledge_edit: "Editing Knowledge", knowledge: "Reading Knowledge", overview: "Looking at the big picture", members: "Looking at members", member: "Looking at a member", orders: "Looking at orders", sellers: "Looking at sellers", listings: "Looking at listings", market: "Looking at the Market", events: "Looking at the tournament", event: "Looking at the tournament", posts: "Looking at posts", errors: "Looking at errors", health: "Checking the server", systems: "Checking Railway and GitHub" };
const brainTell = (userId, data) => { try { sendTo([userId], "echo", data); } catch {} };
const BRAIN_SORRY = { 401: "The key in Railway isn't working — Claude turned it away. Check ECHO_AI_KEY in Railway → Variables.", 402: "Claude's account is out of credit. Top it up at console.anthropic.com → Billing.", 429: "Claude is busy right now. Give it a minute and ask again.", 529: "Claude is overloaded right now. Give it a minute and ask again." };
async function brainAsk(user, token, q) {
  const asked = String(q || "").trim().slice(0, 4000);
  if (!asked) return null;
  const askId = brainKeep(user.id, "user", "ask", [{ type: "text", text: asked }]);
  const system = brainSystem(user), tools = brainTools();
  const messages = brainHistory(user.id);
  let used = 0;
  let pending = "", flush = null;
  const onText = (t) => { pending += t; if (!flush) flush = setTimeout(() => { brainTell(user.id, { kind: "text", askId, text: pending }); pending = ""; flush = null; }, 90); };
  brainTell(user.id, { kind: "status", askId, text: "Thinking" });
  try {
    for (let round = 0; round <= BRAIN_ROUNDS; round++) {
      const res = await brainCall({ model: BRAIN_MODEL, max_tokens: 4096, system, tools, messages }, onText);
      if (flush) { clearTimeout(flush); flush = null; } if (pending) { brainTell(user.id, { kind: "text", askId, text: pending }); pending = ""; }
      used += (res.usage && res.usage.output_tokens) || 0;
      brainKeep(user.id, "assistant", "reply", res.content);
      messages.push({ role: "assistant", content: res.content });
      if (res.stop_reason !== "tool_use") {
        if (res.stop_reason === "refusal") brainKeep(user.id, "assistant", "error", [{ type: "text", text: "Claude wouldn't answer that one." }]);
        else if (res.stop_reason === "max_tokens" && !brainText(res.content)) brainKeep(user.id, "assistant", "error", [{ type: "text", text: "That answer ran too long — ask for a shorter one." }]);
        break;
      }
      const calls = res.content.filter((b) => b.type === "tool_use");
      brainTell(user.id, { kind: "status", askId, text: calls.map((b) => BRAIN_SAYS[b.name] || "Looking at " + b.name.replace(/_/g, " ")).filter((v, i, a) => a.indexOf(v) === i).join(" · ") });
      const results = await Promise.all(calls.map(async (b) => {
        const r = await brainRun(user, token, b.name, b.input).catch((e) => ({ text: e.message, isError: true }));
        return { type: "tool_result", tool_use_id: b.id, content: r.text, ...(r.isError ? { is_error: true } : {}) };
      }));
      brainKeep(user.id, "user", "result", results);
      messages.push({ role: "user", content: results });
      if (round === BRAIN_ROUNDS) brainKeep(user.id, "assistant", "error", [{ type: "text", text: "I looked at a lot and lost the thread — ask me that in two parts." }]);
    }
  } catch (e) {
    const text = BRAIN_SORRY[e.status] || (e.name === "TimeoutError" ? "Claude took too long. Ask again." : `Couldn't reach Claude: ${e.message}`);
    console.error("[echo] brain:", e.status || "", e.message, e.cause ? "— " + e.cause.message : "");
    /* an unanswered question must not leave a dangling tool_use for the next replay */
    const rows = brainRows(user.id); const last = rows[rows.length - 1];
    if (last && last.kind === "reply" && JSON.parse(last.content).some((b) => b.type === "tool_use")) db.prepare(`UPDATE echo_brain SET archived = 1 WHERE id = ?`).run(last.id);
    brainKeep(user.id, "assistant", "error", [{ type: "text", text }]);
  }
  if (flush) { clearTimeout(flush); flush = null; }
  const turn = brainTurns(user.id).find((t) => t.id === askId);
  brainTell(user.id, { kind: "done", askId });
  return { ...turn, outputTokens: used };
}

/* ---- the routes: first in line, and they step aside unless the brain is for you ---- */
const brainHello = (user) => `${user.display_name ? user.display_name.split(" ")[0] : "Hey"} — I'm Echo. I know LABS, I can see the numbers as they are right now, and I remember what we've decided. What are we working on?`;
app.get("/api/echo", auth, (req, res, next) => {
  if (!brainFor(req.user)) return next();
  res.json({ name: "Echo", brain: true, model: BRAIN_MODEL, sub: "LABS's own", hello: brainHello(req.user), preview: false, topics: [], turns: brainTurns(req.user.id),
    starters: ["How are we doing this week?", "What should I build next, and why?", "Who's stuck setting up payouts?", "Write down what we decided today"].map((q, i) => ({ id: -1 - i, src: "brain", question: q })) });
});
const brainLimit = rateLimit({ max: 20, windowMs: 60000, key: "user" });   // counted only for the brain, so a member's questions to the matcher aren't
app.post("/api/echo/ask", auth, (req, res, next) => {
  if (!brainFor(req.user)) return next();
  brainLimit(req, res, async () => {
    const turn = await brainAsk(req.user, req.token, (req.body || {}).q).catch((e) => { console.error("[echo] brain:", e); return { id: 0, asked: "", kind: "brain", text: "Something broke on my side. Ask again.", tools: [], failed: true, createdAt: Date.now() }; });
    if (!turn) return res.status(400).json({ error: "Ask something" });
    res.json({ turn });
  });
});
app.post("/api/echo/reset", auth, admin, (req, res) => {
  const n = db.prepare(`UPDATE echo_brain SET archived = 1 WHERE user_id = ? AND archived = 0`).run(req.user.id).changes;
  res.json({ ok: true, putAway: n });
});
app.get("/api/echo/brain", auth, admin, (req, res) => res.json({ on: brainOn(), model: brainOn() ? BRAIN_MODEL : "", turns: brainOn() ? brainRows(req.user.id).filter((r) => r.kind === "ask").length : 0 }));
