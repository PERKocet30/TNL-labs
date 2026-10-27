/* ================================================================
   LABS CONNECTOR · sign-in  v1.0 — 2026-10-27
   Claude (and any other MCP client) reads the admin dashboard through
   /mcp (server-12-mcp-2-tools.js). This part is the key cabinet:

     • OAuth 2.1 the way claude.ai expects it — discovery, dynamic client
       registration, authorize (a LABS page the admin approves while
       signed in), token with PKCE, refresh. No outside service, no new
       dependency: node:crypto and SQLite.
     • Connector keys are their own thing (mcp_tokens), never a member
       session. A key opens GET on the allowed admin routes and nothing
       else — mcpSession() refuses every other method and path, so even
       a leaked key can't post, delete, pay or read a message.
     • Only an admin can approve; Admin → Systems lists every key and
       can revoke it.

   Jorge's ask (2026-10-26): "full access to my admin dashboard, read
   only, besides members' messages and things that might violate member
   privacy." The read-only part lives here; the privacy part lives in the
   tool list and the scrub in part 2.
================================================================ */
db.exec(`
  CREATE TABLE IF NOT EXISTS mcp_clients (
    id            TEXT PRIMARY KEY,
    name          TEXT NOT NULL DEFAULT '',
    redirect_uris TEXT NOT NULL DEFAULT '[]',
    created_at    INTEGER NOT NULL
  );
  CREATE TABLE IF NOT EXISTS mcp_codes (
    code         TEXT PRIMARY KEY,
    client_id    TEXT NOT NULL,
    user_id      INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    redirect_uri TEXT NOT NULL,
    challenge    TEXT NOT NULL,
    expires_at   INTEGER NOT NULL
  );
  CREATE TABLE IF NOT EXISTS mcp_tokens (
    id           INTEGER PRIMARY KEY AUTOINCREMENT,
    hash         TEXT NOT NULL UNIQUE,
    refresh_hash TEXT NOT NULL UNIQUE,
    user_id      INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    client_id    TEXT NOT NULL,
    name         TEXT NOT NULL DEFAULT '',
    created_at   INTEGER NOT NULL,
    expires_at   INTEGER NOT NULL,
    last_used_at INTEGER,
    calls        INTEGER NOT NULL DEFAULT 0,
    revoked      INTEGER NOT NULL DEFAULT 0
  );
`);

const MCP_TOKEN_TTL = 30 * 86400000;      // a key lives 30 days, then the refresh key makes a new one
const MCP_REFRESH_TTL = 90 * 86400000;    // the refresh key itself lives 90 days
const MCP_CODE_TTL = 10 * 60000;          // an approval code must be exchanged within 10 minutes
const mcpHash = (s) => createHash("sha256").update(String(s)).digest("hex");
const mcpRandom = (pre) => pre + randomBytes(32).toString("hex");
/* Only Claude's own callback hosts may receive a code. Anyone else can register a
   client, but their redirect would never be accepted, so the registration is inert. */
const mcpRedirectOk = (u) => { try { const x = new URL(u); return x.protocol === "https:" && ["claude.ai", "claude.com"].includes(x.hostname) && x.pathname === "/api/mcp/auth_callback"; } catch (e) { return false; } };
const mcpLimit = rateLimit({ max: 30, windowMs: 600000 });

/* The admin GET routes a connector key may open. Everything that could expose a
   person — messages, emails, mail log, backups, source, settings, CSV export, the
   vote-check with voter identities — is simply not on the list. */
const MCP_PATHS = new Set(["overview", "pulse", "series", "funnel", "retention", "audience", "direction", "topwork", "people", "content", "posts",
  "reports", "orders", "market", "sellers", "listings", "events", "health", "errors", "glitches", "log", "nudge", "systems", "systems/google", "systems/meta", "studio"]);
function mcpPathAllowed(path) {
  const p = String(path || "").split("?")[0].replace(/^\/api\/admin\//, "");
  if (MCP_PATHS.has(p)) return true;
  return /^people\/[a-z0-9._]{2,20}(\/signals)?$/.test(p) || /^events\/\d+$/.test(p);
}

/* Called by auth() when a bearer token isn't a member session. A connector key
   stands in for its admin on GET + allowed admin paths only. */
function mcpSession(token, req) {
  if (!/^labs_mcp_[0-9a-f]{64}$/.test(token || "")) return null;
  if (req.method !== "GET" || !mcpPathAllowed(req.path)) return null;
  const t = db.prepare(`SELECT * FROM mcp_tokens WHERE hash = ? AND revoked = 0 AND expires_at > ?`).get(mcpHash(token), Date.now());
  if (!t) return null;
  req.mcp = t.id;
  return { user_id: t.user_id, token };
}
/* The key behind a /mcp call, or null. Counts the use. */
function mcpKeyFor(req) {
  const header = req.get("authorization") || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : "";
  if (!/^labs_mcp_[0-9a-f]{64}$/.test(token)) return null;
  const t = db.prepare(`SELECT t.*, u.is_admin, u.suspended FROM mcp_tokens t JOIN users u ON u.id = t.user_id WHERE t.hash = ? AND t.revoked = 0 AND t.expires_at > ?`).get(mcpHash(token), Date.now());
  if (!t || !t.is_admin || t.suspended) return null;
  db.prepare(`UPDATE mcp_tokens SET last_used_at = ?, calls = calls + 1 WHERE id = ?`).run(Date.now(), t.id);
  return { ...t, token };
}

/* ---- discovery: how a client finds the sign-in ---- */
function mcpMeta(req) {
  const b = baseUrl(req);
  return { issuer: b, authorization_endpoint: b + "/oauth/authorize", token_endpoint: b + "/oauth/token", registration_endpoint: b + "/oauth/register",
    response_types_supported: ["code"], grant_types_supported: ["authorization_code", "refresh_token"], code_challenge_methods_supported: ["S256"],
    token_endpoint_auth_methods_supported: ["none", "client_secret_post"], scopes_supported: ["admin:read"] };
}
app.get("/.well-known/oauth-authorization-server", (req, res) => res.json(mcpMeta(req)));
app.get("/.well-known/oauth-authorization-server/mcp", (req, res) => res.json(mcpMeta(req)));
app.get(["/.well-known/oauth-protected-resource", "/.well-known/oauth-protected-resource/mcp"], (req, res) => {
  const b = baseUrl(req);
  res.json({ resource: b + "/mcp", authorization_servers: [b], scopes_supported: ["admin:read"], bearer_methods_supported: ["header"] });
});

/* ---- dynamic client registration ---- */
app.post("/oauth/register", mcpLimit, (req, res) => {
  const b = req.body || {};
  const uris = Array.isArray(b.redirect_uris) ? b.redirect_uris.map(String).slice(0, 5) : [];
  if (!uris.length || !uris.every(mcpRedirectOk)) return res.status(400).json({ error: "invalid_redirect_uri", error_description: "Only Claude's callback is accepted." });
  const id = mcpRandom("labs_client_");
  const name = String(b.client_name || "Claude").slice(0, 60);
  db.prepare(`INSERT INTO mcp_clients (id, name, redirect_uris, created_at) VALUES (?,?,?,?)`).run(id, name, JSON.stringify(uris), Date.now());
  res.status(201).json({ client_id: id, client_name: name, redirect_uris: uris, token_endpoint_auth_method: "none",
    grant_types: ["authorization_code", "refresh_token"], response_types: ["code"] });
});

/* ---- authorize: a LABS page; the admin, already signed in, taps Allow ---- */
app.get("/oauth/authorize", mcpLimit, (req, res) => {
  const { client_id, redirect_uri, state = "", code_challenge, code_challenge_method, response_type } = req.query;
  const client = db.prepare(`SELECT * FROM mcp_clients WHERE id = ?`).get(String(client_id || ""));
  const uris = client ? JSON.parse(client.redirect_uris) : [];
  const bad = !client ? "Unknown app." : !uris.includes(String(redirect_uri)) ? "That app's callback doesn't match." :
    response_type !== "code" ? "Only the code flow is supported." : code_challenge_method !== "S256" || !/^[A-Za-z0-9_-]{43,128}$/.test(String(code_challenge || "")) ? "PKCE (S256) is required." : "";
  if (bad) return res.status(400).send(lookPage({ title: "Can't connect — LABS", center: true, body: `${lookEyebrow("Connect")}<h1>Can't connect</h1><p class="p">${lookEsc(bad)}</p>` }));
  const params = { client_id: String(client_id), redirect_uri: String(redirect_uri), state: String(state).slice(0, 500), code_challenge: String(code_challenge) };
  res.send(lookPage({ title: "Connect — LABS", center: true, body: `${lookEyebrow("Connect")}
<h1>Let ${lookEsc(client.name)} read the admin dashboard?</h1>
<p class="p">Read only. Numbers, orders, reports, systems. Never messages, emails or anything that could expose a member. You can disconnect it any time in Admin → Systems.</p>
<div id="who" class="p"></div>
<p><button id="ok" class="btn" hidden>Allow</button> <a id="in" class="btn" href="/admin" hidden>Sign in to LABS first</a></p>
<script>
(function(){var P=${JSON.stringify(params)};var tok=null;try{tok=localStorage.getItem("tnl-token")}catch(e){}
var ok=document.getElementById("ok"),inn=document.getElementById("in"),who=document.getElementById("who");
if(!tok){inn.hidden=false;who.textContent="Sign in to LABS as the admin in this browser, then come back to this page.";return}
fetch("/api/me",{headers:{Authorization:"Bearer "+tok}}).then(function(r){return r.ok?r.json():null}).then(function(d){var me=d&&d.user;
if(!me||!me.isAdmin){inn.hidden=false;who.textContent="This needs the admin account.";return}
who.textContent="Signed in as @"+me.username+".";ok.hidden=false;
ok.onclick=function(){ok.disabled=true;fetch("/oauth/approve",{method:"POST",headers:{"Content-Type":"application/json",Authorization:"Bearer "+tok},body:JSON.stringify(P)})
.then(function(r){return r.json()}).then(function(d){if(d.redirect)location.href=d.redirect;else{who.textContent=d.error||"Something went wrong.";ok.disabled=false}})}})
.catch(function(){inn.hidden=false;who.textContent="Couldn't check who's signed in."})})();
</script>` }));
});
app.post("/oauth/approve", auth, admin, mcpLimit, (req, res) => {
  const { client_id, redirect_uri, state = "", code_challenge } = req.body || {};
  const client = db.prepare(`SELECT * FROM mcp_clients WHERE id = ?`).get(String(client_id || ""));
  if (!client || !JSON.parse(client.redirect_uris).includes(String(redirect_uri))) return res.status(400).json({ error: "That app isn't known." });
  if (!/^[A-Za-z0-9_-]{43,128}$/.test(String(code_challenge || ""))) return res.status(400).json({ error: "PKCE is required." });
  const code = mcpRandom("labs_code_");
  db.prepare(`DELETE FROM mcp_codes WHERE expires_at < ?`).run(Date.now());
  db.prepare(`INSERT INTO mcp_codes (code, client_id, user_id, redirect_uri, challenge, expires_at) VALUES (?,?,?,?,?,?)`)
    .run(code, client.id, req.user.id, String(redirect_uri), String(code_challenge), Date.now() + MCP_CODE_TTL);
  const u = new URL(String(redirect_uri)); u.searchParams.set("code", code); if (state) u.searchParams.set("state", String(state).slice(0, 500));
  res.json({ redirect: u.toString() });
});

/* ---- token: code → key (with PKCE), refresh → new key ---- */
function mcpIssue(userId, clientId, name) {
  const access = mcpRandom("labs_mcp_"), refresh = mcpRandom("labs_refresh_"), now = Date.now();
  db.prepare(`INSERT INTO mcp_tokens (hash, refresh_hash, user_id, client_id, name, created_at, expires_at) VALUES (?,?,?,?,?,?,?)`)
    .run(mcpHash(access), mcpHash(refresh), userId, clientId, name, now, now + MCP_TOKEN_TTL);
  return { access_token: access, token_type: "Bearer", expires_in: Math.floor(MCP_TOKEN_TTL / 1000), refresh_token: refresh, scope: "admin:read" };
}
app.post("/oauth/token", mcpLimit, express.urlencoded({ extended: false, limit: "20kb" }), (req, res) => {
  const b = req.body || {};
  const fail = (code, desc) => res.status(400).json({ error: code, error_description: desc });
  if (b.grant_type === "authorization_code") {
    const row = db.prepare(`SELECT * FROM mcp_codes WHERE code = ?`).get(String(b.code || ""));
    if (row) db.prepare(`DELETE FROM mcp_codes WHERE code = ?`).run(row.code);     // one use, success or not
    if (!row || row.expires_at < Date.now()) return fail("invalid_grant", "That code is gone. Try connecting again.");
    if (row.client_id !== String(b.client_id || "") || row.redirect_uri !== String(b.redirect_uri || row.redirect_uri)) return fail("invalid_grant", "Client mismatch.");
    const verifier = String(b.code_verifier || "");
    if (createHash("sha256").update(verifier).digest("base64url") !== row.challenge) return fail("invalid_grant", "PKCE check failed.");
    const client = db.prepare(`SELECT name FROM mcp_clients WHERE id = ?`).get(row.client_id);
    return res.json(mcpIssue(row.user_id, row.client_id, client?.name || "Claude"));
  }
  if (b.grant_type === "refresh_token") {
    const old = db.prepare(`SELECT * FROM mcp_tokens WHERE refresh_hash = ? AND revoked = 0`).get(mcpHash(String(b.refresh_token || "")));
    if (!old || old.created_at + MCP_REFRESH_TTL < Date.now()) return fail("invalid_grant", "That refresh key is gone. Connect again.");
    if (b.client_id && String(b.client_id) !== old.client_id) return fail("invalid_grant", "Client mismatch.");
    db.prepare(`UPDATE mcp_tokens SET revoked = 1 WHERE id = ?`).run(old.id);
    return res.json(mcpIssue(old.user_id, old.client_id, old.name));
  }
  fail("unsupported_grant_type", "Use authorization_code or refresh_token.");
});

/* ---- Admin → Systems: the keys, and the door to shut ---- */
app.get("/api/admin/connectors", auth, admin, (req, res) => {
  const rows = db.prepare(`SELECT t.id, t.name, t.created_at, t.expires_at, t.last_used_at, t.calls, u.username FROM mcp_tokens t JOIN users u ON u.id = t.user_id
    WHERE t.revoked = 0 AND t.expires_at > ? ORDER BY t.created_at DESC LIMIT 20`).all(Date.now());
  res.json({ url: baseUrl(req) + "/mcp", keys: rows.map((r) => ({ id: r.id, name: r.name, by: r.username, createdAt: r.created_at, expiresAt: r.expires_at, lastUsedAt: r.last_used_at, calls: r.calls })) });
});
app.delete("/api/admin/connectors/:id", auth, admin, (req, res) => {
  const r = db.prepare(`UPDATE mcp_tokens SET revoked = 1 WHERE id = ?`).run(Number(req.params.id));
  res.json({ ok: r.changes > 0 });
});
