/* ================================================================
   LABS CONNECTOR · tools  v1.2 — 2026-11-04 (knowledge_add / knowledge_edit: Claude and Grok write to Knowledge, the one exception to read-only). v1.1 — 2026-11-04 (knowledge, read). v1.0 — 2026-10-27
   /mcp speaks MCP (JSON-RPC over HTTP, stateless) so Claude can read the
   admin dashboard like it reads GitHub or Railway. Each tool is one of
   the admin GET routes, fetched in-process with the connector key, then
   scrubbed: no emails, addresses, IPs, admin notes or keys ever leave,
   whatever a route returns. Messages (DMs, the Instagram inbox) have no
   tool at all. The one exception to read-only (2026-11-04): two tools
   write Knowledge entries and nothing else (MCP_WRITE_TOOLS, below).
   Sign-in and keys: server/connector/oauth.js.
================================================================ */
const MCP_VERSIONS = ["2025-06-18", "2025-03-26", "2024-11-05"];
const mcpDays = { type: "integer", enum: [7, 30, 90], description: "Window in days (7, 30 or 90). Default 30." };
const mcpTz = { type: "integer", description: "Minutes east of UTC for day boundaries, e.g. -240 for New York in summer. Default 0." };
/* name → what it reads. `path` may be a function of the arguments. */
const MCP_TOOLS = [
  ["overview", "The big picture: members, active now, work posted, confirmed collabs, orders, fees earned, verified, rep — this week vs before.", {}, "overview"],
  ["pulse", "Day-by-day pulse of the app for a window: joins, posts, likes, collabs, orders, and what moved.", { days: mcpDays, tz: mcpTz }, (a) => `pulse?days=${a.days || 30}&tz=${a.tz || 0}`],
  ["series", "Daily series for charts (joins, posts, likes, orders…) over a window, with the window before for comparison.", { days: mcpDays, tz: mcpTz }, (a) => `series?days=${a.days || 30}&tz=${a.tz || 0}`],
  ["funnel", "Sign-up funnel: joined → verified → posted → collab → sold, with percentages.", {}, "funnel"],
  ["retention", "Retention: who came back by week since joining.", {}, "retention"],
  ["audience", "Who the members are: roles, when they're online, where they came from.", { days: mcpDays, tz: mcpTz }, (a) => `audience?days=${a.days || 30}&tz=${a.tz || 0}`],
  ["direction", "Which labs and kinds of work are growing or fading over the window.", { days: mcpDays, tz: mcpTz }, (a) => `direction?days=${a.days || 30}&tz=${a.tz || 0}`],
  ["top_work", "The pieces that earned the most reaction over the window.", { days: mcpDays, tz: mcpTz }, (a) => `topwork?days=${a.days || 30}&tz=${a.tz || 0}`],
  ["members", "Members list (usernames, level, rep, posts, sales, joined, last active). Filter: all, new, silent, quiet, sellers, tournament, admins, suspended, unverified. Search by username or display name.",
    { q: { type: "string", description: "Search text" }, filter: { type: "string", description: "all · new · silent · quiet · sellers · tournament · admins · suspended · unverified" }, all: { type: "boolean", description: "Every member, not just the first 300" } },
    (a) => `people?q=${encodeURIComponent(a.q || "")}&filter=${encodeURIComponent(a.filter || "all")}${a.all ? "&all=1" : ""}`],
  ["member", "One member's public profile, stats, rep history and sales — never their email, address or admin notes.", { username: { type: "string" } }, (a) => `people/${mcpName(a.username)}`],
  ["member_signals", "One member's activity signals: streaks, sessions, what they do most.", { username: { type: "string" } }, (a) => `people/${mcpName(a.username)}/signals`],
  ["content", "Content totals: posts, work, by lab and channel, media kinds.", {}, "content"],
  ["posts", "Recent posts, filterable by lab or channel, searchable.", { q: { type: "string" }, lab: { type: "string" }, channel: { type: "string" } },
    (a) => `posts?q=${encodeURIComponent(a.q || "")}&lab=${encodeURIComponent(a.lab || "")}&channel=${encodeURIComponent(a.channel || "")}`],
  ["reports", "Open member reports (who reported what, and why) and blocks.", {}, "reports"],
  ["orders", "The last 80 orders: title, buyer and seller usernames, amount, fee, status, tracking.", {}, "orders"],
  ["market", "Market totals: listings, sales, revenue, fees, by category.", {}, "market"],
  ["sellers", "Sellers: who sells, Stripe readiness, sales and fee level.", {}, "sellers"],
  ["listings", "Listings: live, sold out, by seller, views and likes.", {}, "listings"],
  ["events", "Tournaments: every event, stage, entries and deadlines.", {}, "events"],
  ["event", "One tournament in detail (stage, entries, tallies where the stage allows).", { id: { type: "integer" } }, (a) => `events/${Math.max(0, Number(a.id) || 0)}`],
  ["health", "Server health: uptime, memory, database size, queue, mail and payments status.", {}, "health"],
  ["errors", "Recent server and client errors with counts.", {}, "errors"],
  ["glitches", "Layout glitches reported by the app (jumps, overlaps) by screen.", {}, "glitches"],
  ["admin_log", "What admins changed recently (action and target; details kept private).", {}, "log"],
  ["nudge", "Who's due a nudge email and why.", {}, "nudge"],
  ["systems", "Railway and GitHub: what's live, building, and waiting for a Push.", { fresh: { type: "boolean", description: "Skip the cache" } }, (a) => `systems${a.fresh ? "?fresh=1" : ""}`],
  ["systems_google", "Google Search Console and Merchant Center: clicks, impressions, indexed pages, feed status.", { fresh: { type: "boolean" } }, (a) => `systems/google${a.fresh ? "?fresh=1" : ""}`],
  ["systems_meta", "Instagram and Facebook numbers: followers, reach, best posts, when followers are online, shop status. Never inbox messages.", { fresh: { type: "boolean" } }, (a) => `systems/meta${a.fresh ? "?fresh=1" : ""}`],
  ["studio", "Studio (beat maker) usage.", {}, "studio"],
  ["knowledge", "What LABS knows about itself (server/knowledge, 2026-11-04): the creed, how LABS talks, settled decisions, the glossary, notes, sheets. Read this before writing anything in LABS's voice. Filter by kind (creed · voice · decision · glossary · note · sheet) or search.",
    { kind: { type: "string", description: "creed · voice · decision · glossary · note · sheet" }, q: { type: "string", description: "Search text" } },
    (a) => `knowledge?kind=${encodeURIComponent(a.kind || "")}&q=${encodeURIComponent(a.q || "")}`],
];
/* The write tools (2026-11-04, "build a knowledge database from my conversations with you and
   Grok"): the one exception to a read-only connector. Claude or Grok can add or edit a Knowledge
   entry — the creed, a decision and its reason, a word for the glossary, a policy in human words,
   a question and its answer — and nothing else: never members, orders, settings or posts, never
   put away or delete. Each write names its app (knowledge.source = claude · grok), keeps the version
   before (knowledge_history), is written to admin_log with the admin whose key it is, and counts
   against MCP_WRITES_PER_HOUR. Jorge sees and edits everything in Admin → Knowledge; Echo answers
   from it the moment it's saved. */
const MCP_WRITES_PER_HOUR = 60;
const mcpKindDesc = () => Object.entries(KNOW_KINDS).map(([k, n]) => `${k} (${n})`).join(" · ");
const MCP_WRITE_TOOLS = [
  ["knowledge_add", "Write something LABS should remember, in plain words, in LABS's voice: a decision and its reason, a glossary word, a policy as a person would say it, a real question and the right answer, a note on the plan. Not raw conversation — the settled outcome. Never anything from a private message, and never a member's email or address. It is live in Echo at once and Jorge can edit it in Admin → Knowledge.",
    { kind: { type: "string", description: "One of: " + "KINDS" }, title: { type: "string", description: "A short title, 160 characters at most" }, body: { type: "string", description: "The words, up to 20000 characters" }, tags: { type: "string", description: "A few words, space-separated (optional)" } }, ["kind", "title", "body"]],
  ["knowledge_edit", "Change an existing Knowledge entry (find its id with the knowledge tool). Only the fields you pass change; the version before is kept. Entries can't be deleted or put away from here — only in Admin → Knowledge.",
    { id: { type: "integer" }, kind: { type: "string", description: "One of: " + "KINDS" }, title: { type: "string" }, body: { type: "string" }, tags: { type: "string" } }, ["id"]],
];
const mcpWriteList = () => MCP_WRITE_TOOLS.map(([name, description, props, required]) => ({ name, description,
  inputSchema: { type: "object", properties: JSON.parse(JSON.stringify(props).replaceAll("KINDS", mcpKindDesc())), required, additionalProperties: false },
  annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: name === "knowledge_edit", openWorldHint: false } }));
function mcpWrite(key, name, a) {
  const source = ["claude", "grok"].includes(String(key.name || "").toLowerCase()) ? key.name.toLowerCase() : "connector";
  const recent = db.prepare(`SELECT COUNT(*) n FROM admin_log WHERE admin_id = ? AND action LIKE 'connector knowledge%' AND created_at > ?`).get(key.user_id, Date.now() - 3600000).n;
  if (recent >= MCP_WRITES_PER_HOUR) return { content: [{ type: "text", text: `That's ${MCP_WRITES_PER_HOUR} writes in an hour — enough for now. Try again later.` }], isError: true };
  const r = name === "knowledge_add" ? knowAdd(a, key.user_id, source) : knowEdit(Math.max(0, Number(a.id) || 0), { ...(a.kind != null ? { kind: a.kind } : {}), ...(a.title != null ? { title: a.title } : {}), ...(a.body != null ? { body: a.body } : {}), ...(a.tags != null ? { tags: a.tags } : {}) }, key.user_id, source);
  if (r.error) return { content: [{ type: "text", text: r.error }], isError: true };
  const id = name === "knowledge_add" ? r.id : Number(a.id);
  const row = db.prepare(`SELECT id, kind, title FROM knowledge WHERE id = ?`).get(id);
  db.prepare(`INSERT INTO admin_log (admin_id, action, target, detail, created_at) VALUES (?,?,?,?,?)`).run(key.user_id, `connector ${name}`, String(id), JSON.stringify({ by: source, kind: row?.kind, title: row?.title }).slice(0, 400), Date.now());
  console.log(`[connector] ${source} ${name === "knowledge_add" ? "added" : "edited"} knowledge #${id}: ${row?.title}`);
  return { content: [{ type: "text", text: JSON.stringify({ ok: true, id, kind: row?.kind, title: row?.title, changed: r.changed ?? true, note: "Live in Echo now. Jorge can edit or put it away in Admin → Knowledge." }) }] };
}
const mcpName = (u) => { const s = String(u || "").trim().toLowerCase().replace(/^@/, ""); if (!/^[a-z0-9._]{2,20}$/.test(s)) throw new Error("That doesn't look like a username."); return s; };
const mcpToolList = () => [...MCP_TOOLS.map(([name, description, props]) => ({ name, description, inputSchema: { type: "object", properties: props, additionalProperties: false },
  annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false } })), ...mcpWriteList()];

/* Privacy scrub. Keys that name a person's private details are dropped wherever
   they sit; the admin log keeps action and target but not the detail. */
const MCP_DROP = /^(email|emails|buyerEmail|sellerEmail|phone|address|addr|street|street2|city|zip|postal|country|ip|ips|ua|userAgent|note|notes|adminNote|password|hash|token|tokens|secret|key|keys|stripeAccount|stripe_account)$/i;
function mcpScrub(v, depth = 0) {
  if (depth > 12 || v === null || typeof v !== "object") return v;
  if (Array.isArray(v)) return v.map((x) => mcpScrub(x, depth + 1));
  const out = {};
  for (const [k, x] of Object.entries(v)) { if (MCP_DROP.test(k) || /email|address|phone/i.test(k)) continue; out[k] = mcpScrub(x, depth + 1); }
  return out;
}

/* Run one tool: fetch the admin route in-process with the same key, scrub, return text. */
async function mcpCall(key, name, args) {
  if (MCP_WRITE_TOOLS.some((t) => t[0] === name)) return mcpWrite(key, name, args && typeof args === "object" ? args : {});
  const tool = MCP_TOOLS.find((t) => t[0] === name);
  if (!tool) return { content: [{ type: "text", text: `No tool called ${name}.` }], isError: true };
  const a = args && typeof args === "object" ? args : {};
  let path;
  try { path = typeof tool[3] === "function" ? tool[3](a) : tool[3]; } catch (e) { return { content: [{ type: "text", text: e.message }], isError: true }; }
  const r = await fetch(`http://127.0.0.1:${PORT}/api/admin/${path}`, { headers: { Authorization: "Bearer " + key.token, "X-LABS-MCP": MCP_INNER, Accept: "application/json" }, signal: AbortSignal.timeout(25000) });
  const body = await r.json().catch(() => ({ error: "not json" }));
  if (!r.ok) return { content: [{ type: "text", text: `LABS said ${r.status}: ${body.error || "no detail"}` }], isError: true };
  if (name === "admin_log" && Array.isArray(body.log)) body.log = body.log.map(({ detail, ...rest }) => rest);   // what was done, not what was typed
  return { content: [{ type: "text", text: JSON.stringify(mcpScrub(body)) }] };
}

/* ---- the endpoint ---- */
const mcpRpcLimit = rateLimit({ max: 240, windowMs: 60000 });
function mcpNoStore(res) { res.set("Cache-Control", "private, no-store"); res.set("MCP-Protocol-Version", MCP_VERSIONS[0]); }
function mcpUnauthorized(req, res) {
  mcpNoStore(res);
  res.set("WWW-Authenticate", `Bearer resource_metadata="${baseUrl(req)}/.well-known/oauth-protected-resource/mcp"`);
  res.status(401).json({ error: "unauthorized", error_description: "Connect LABS in Claude's connector settings." });
}
app.get("/mcp", (req, res) => { mcpNoStore(res); res.status(405).json({ error: "Use POST. This server doesn't stream." }); });
app.delete("/mcp", (req, res) => { mcpNoStore(res); res.status(204).end(); });
app.post("/mcp", mcpRpcLimit, async (req, res) => {
  const key = mcpKeyFor(req);
  if (!key) return mcpUnauthorized(req, res);
  mcpNoStore(res);
  const batch = Array.isArray(req.body);
  const msgs = batch ? req.body : [req.body];
  const out = [];
  for (const m of msgs) {
    if (!m || typeof m !== "object" || m.jsonrpc !== "2.0" || typeof m.method !== "string") { out.push({ jsonrpc: "2.0", id: m?.id ?? null, error: { code: -32600, message: "Invalid request" } }); continue; }
    if (m.id === undefined) continue;   // a notification (initialized, cancelled): nothing to answer
    const reply = (result) => out.push({ jsonrpc: "2.0", id: m.id, result });
    const err = (code, message) => out.push({ jsonrpc: "2.0", id: m.id, error: { code, message } });
    try {
      switch (m.method) {
        case "initialize": {
          const asked = m.params?.protocolVersion;
          reply({ protocolVersion: MCP_VERSIONS.includes(asked) ? asked : MCP_VERSIONS[0], capabilities: { tools: { listChanged: false } },
            serverInfo: { name: "LABS", version: "1.0" },
            instructions: "The LABS admin dashboard, read-only: numbers, orders, reports, members' public stats, systems, and what LABS knows about itself (knowledge). Never messages, emails, addresses or admin notes — those have no tool. The one place you can write is Knowledge (knowledge_add, knowledge_edit): settled decisions, glossary words, policies in plain words, real questions with the right answers — in LABS's voice, never raw conversation, never anything private. Amounts are cents. Times are Unix ms." });
          break;
        }
        case "ping": reply({}); break;
        case "tools/list": reply({ tools: mcpToolList() }); break;
        case "tools/call": {
          const name = String(m.params?.name || "");
          reply(await mcpCall(key, name, m.params?.arguments));
          break;
        }
        default: err(-32601, `Unknown method ${m.method}`);
      }
    } catch (e) { err(-32603, e.message || "error"); }
  }
  if (!out.length) return res.status(202).end();
  res.json(batch ? out : out[0]);
});
