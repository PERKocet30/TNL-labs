/* ================================================================
   LABS CONNECTOR · tools  v1.0 — 2026-10-27
   /mcp speaks MCP (JSON-RPC over HTTP, stateless) so Claude can read the
   admin dashboard like it reads GitHub or Railway. Each tool is one of
   the admin GET routes, fetched in-process with the connector key, then
   scrubbed: no emails, addresses, IPs, admin notes or keys ever leave,
   whatever a route returns. Messages (DMs, the Instagram inbox) have no
   tool at all. Sign-in and keys: server-12-mcp-1-oauth.js.
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
];
const mcpName = (u) => { const s = String(u || "").trim().toLowerCase().replace(/^@/, ""); if (!/^[a-z0-9._]{2,20}$/.test(s)) throw new Error("That doesn't look like a username."); return s; };
const mcpToolList = () => MCP_TOOLS.map(([name, description, props]) => ({ name, description, inputSchema: { type: "object", properties: props, additionalProperties: false },
  annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false } }));

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
  const tool = MCP_TOOLS.find((t) => t[0] === name);
  if (!tool) return { content: [{ type: "text", text: `No tool called ${name}.` }], isError: true };
  const a = args && typeof args === "object" ? args : {};
  let path;
  try { path = typeof tool[3] === "function" ? tool[3](a) : tool[3]; } catch (e) { return { content: [{ type: "text", text: e.message }], isError: true }; }
  const r = await fetch(`http://127.0.0.1:${PORT}/api/admin/${path}`, { headers: { Authorization: "Bearer " + key.token, Accept: "application/json" }, signal: AbortSignal.timeout(25000) });
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
            instructions: "Read-only view of the LABS admin dashboard. Numbers, orders, reports, members' public stats, systems. Never messages, emails, addresses or admin notes — those have no tool. Amounts are cents. Times are Unix ms." });
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
