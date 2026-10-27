// LABS connector (2026-10-27): Claude reads the admin dashboard through /mcp.
// "Full access to my admin dashboard, read only, besides members' messages and
// things that might violate member privacy." These checks pin that down: the
// sign-in only works for an admin and only for Claude's callback, a key opens
// GET on the allowed admin routes and nothing else, nothing personal comes out,
// and a key can be cut off from Admin → Systems.
import { spawn } from "node:child_process";
import { createHash } from "node:crypto";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { rmSync, mkdirSync } from "node:fs";
const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const DATA = join(ROOT, "test/.tmp/connector");
rmSync(DATA, { recursive: true, force: true }); mkdirSync(DATA, { recursive: true });
process.env.TNL_DATA = DATA;
const { db } = await import(join(ROOT, "src/db.js"));
const now = Date.now();
const U = (n, admin) => { const id = Number(db.prepare(`INSERT INTO users (username, display_name, email, password_hash, created_at, email_verified, is_admin) VALUES (?,?,?,?,?,1,?)`).run(n, n, n + "@secret.example", "h", now, admin ? 1 : 0).lastInsertRowid);
  db.prepare(`INSERT INTO sessions (token, user_id, created_at) VALUES (?,?,?)`).run("tok-" + n, id, now); return id; };
const boss = U("boss", true), ana = U("ana", false);
db.exec(`CREATE TABLE IF NOT EXISTS admin_notes (user_id INTEGER PRIMARY KEY, body TEXT NOT NULL DEFAULT '', updated_by INTEGER, updated_at INTEGER NOT NULL)`);
db.prepare(`INSERT INTO admin_notes (user_id, body, updated_by, updated_at) VALUES (?,?,?,?)`).run(ana, "PRIVATE NOTE about ana", boss, now);
db.close();
let pass = 0, fail = 0;
const t = (n, ok) => { ok ? pass++ : fail++; console.log("  " + (ok ? "✓" : "✗") + "  " + n); };

const PORT = 18900 + (process.pid % 200);
const srv = spawn(process.execPath, ["--experimental-sqlite", "src/server.js"], { cwd: ROOT, env: { ...process.env, PORT: String(PORT), TNL_DATA: DATA, PUBLIC_URL: `http://127.0.0.1:${PORT}` }, stdio: ["ignore", "pipe", "pipe"] });
let log = ""; srv.stdout.on("data", (d) => log += d); srv.stderr.on("data", (d) => log += d);
for (let i = 0; i < 100 && !/listening/.test(log); i++) await new Promise((r) => setTimeout(r, 100));
const B = `http://127.0.0.1:${PORT}`;
const call = (path, { method = "GET", token, body, form } = {}) => fetch(B + path, { method, redirect: "manual",
  headers: { ...(token ? { Authorization: "Bearer " + token } : {}), "Content-Type": form ? "application/x-www-form-urlencoded" : "application/json" },
  body: body ? (form ? new URLSearchParams(body).toString() : JSON.stringify(body)) : undefined });
const CB = "https://claude.ai/api/mcp/auth_callback";

try {
  /* discovery */
  const meta = await (await call("/.well-known/oauth-authorization-server")).json();
  t("discovery names the sign-in, token and registration doors", meta.authorization_endpoint === B + "/oauth/authorize" && meta.token_endpoint === B + "/oauth/token" && meta.registration_endpoint === B + "/oauth/register");
  t("discovery asks for PKCE S256", (meta.code_challenge_methods_supported || []).includes("S256"));
  const pr = await (await call("/.well-known/oauth-protected-resource/mcp")).json();
  t("the resource points back at this server", pr.resource === B + "/mcp" && pr.authorization_servers[0] === B);

  /* registration */
  const bad = await call("/oauth/register", { method: "POST", body: { client_name: "Evil", redirect_uris: ["https://evil.example/cb"] } });
  t("a client with a non-Claude callback is refused", bad.status === 400);
  const reg = await (await call("/oauth/register", { method: "POST", body: { client_name: "Claude", redirect_uris: [CB] } })).json();
  t("Claude's callback registers", /^labs_client_/.test(reg.client_id || ""));

  /* authorize + approve */
  const verifier = "v".repeat(50), challenge = createHash("sha256").update(verifier).digest("base64url");
  const authQ = `client_id=${reg.client_id}&redirect_uri=${encodeURIComponent(CB)}&state=xyz&code_challenge=${challenge}&code_challenge_method=S256&response_type=code`;
  const page = await call("/oauth/authorize?" + authQ);
  t("the allow page opens for a known client", page.status === 200 && /Allow/.test(await page.text()));
  t("the allow page refuses a client with the wrong callback", (await call(`/oauth/authorize?client_id=${reg.client_id}&redirect_uri=${encodeURIComponent("https://evil.example/cb")}&code_challenge=${challenge}&code_challenge_method=S256&response_type=code`)).status === 400);
  const approveBody = { client_id: reg.client_id, redirect_uri: CB, state: "xyz", code_challenge: challenge };
  t("a member can't approve", (await call("/oauth/approve", { method: "POST", token: "tok-ana", body: approveBody })).status === 403);
  t("nobody signed in can't approve", (await call("/oauth/approve", { method: "POST", body: approveBody })).status === 401);
  const ap = await (await call("/oauth/approve", { method: "POST", token: "tok-boss", body: approveBody })).json();
  const red = new URL(ap.redirect || "https://x/");
  t("the admin's approval sends Claude back with a code and the state", red.origin + red.pathname === CB && /^labs_code_/.test(red.searchParams.get("code") || "") && red.searchParams.get("state") === "xyz");

  /* token */
  const code = red.searchParams.get("code");
  const wrong = await call("/oauth/token", { method: "POST", form: true, body: { grant_type: "authorization_code", code, client_id: reg.client_id, redirect_uri: CB, code_verifier: "not-the-verifier" } });
  t("the wrong PKCE verifier gets no key", wrong.status === 400);
  t("…and burns the code", (await call("/oauth/token", { method: "POST", form: true, body: { grant_type: "authorization_code", code, client_id: reg.client_id, redirect_uri: CB, code_verifier: verifier } })).status === 400);
  const ap2 = await (await call("/oauth/approve", { method: "POST", token: "tok-boss", body: approveBody })).json();
  const code2 = new URL(ap2.redirect).searchParams.get("code");
  const tok = await (await call("/oauth/token", { method: "POST", form: true, body: { grant_type: "authorization_code", code: code2, client_id: reg.client_id, redirect_uri: CB, code_verifier: verifier } })).json();
  t("the right verifier gets a key and a refresh key", /^labs_mcp_[0-9a-f]{64}$/.test(tok.access_token || "") && /^labs_refresh_/.test(tok.refresh_token || ""));
  const KEY = tok.access_token;

  /* /mcp */
  const noauth = await call("/mcp", { method: "POST", body: { jsonrpc: "2.0", id: 1, method: "initialize", params: {} } });
  t("/mcp without a key says 401 and where to sign in", noauth.status === 401 && /resource_metadata=/.test(noauth.headers.get("www-authenticate") || ""));
  const rpc = async (method, params, id = 1) => (await (await call("/mcp", { method: "POST", token: KEY, body: { jsonrpc: "2.0", id, method, params } })).json());
  const init = await rpc("initialize", { protocolVersion: "2025-06-18", capabilities: {}, clientInfo: { name: "test", version: "0" } });
  t("initialize answers with the protocol version and the LABS name", init.result?.protocolVersion === "2025-06-18" && init.result?.serverInfo?.name === "LABS");
  t("a notification gets 202 and no body", (await call("/mcp", { method: "POST", token: KEY, body: { jsonrpc: "2.0", method: "notifications/initialized" } })).status === 202);
  const tools = (await rpc("tools/list", {})).result?.tools || [];
  const names = tools.map((x) => x.name);
  t("tools cover the dashboard (overview, members, orders, reports, events, systems…)", ["overview", "members", "member", "orders", "reports", "events", "systems", "systems_meta", "health"].every((n) => names.includes(n)));
  t("no tool reads messages, mail, backups, settings or the source", !names.some((n) => /message|(^|_)dms?(_|$)|inbox|thread|mail|backup|setting|source|csv|vote/i.test(n)));
  t("every tool says it is read only", tools.every((x) => x.annotations?.readOnlyHint === true));
  const ov = await rpc("tools/call", { name: "overview", arguments: {} });
  const ovj = JSON.parse(ov.result?.content?.[0]?.text || "{}");
  t("overview reads live numbers", !ov.result?.isError && Object.keys(ovj).length > 3);
  const mem = await rpc("tools/call", { name: "member", arguments: { username: "@ana" } });
  const memText = mem.result?.content?.[0]?.text || "";
  t("member returns ana's public stats", !mem.result?.isError && /"username":"ana"/.test(memText));
  t("…without her email", !/secret\.example|"email"/.test(memText));
  t("…or the admin's note about her", !/PRIVATE NOTE/.test(memText));
  const people = await rpc("tools/call", { name: "members", arguments: { q: "ana" } });
  t("members list never carries an email", !/secret\.example|"email"/.test(people.result?.content?.[0]?.text || ""));
  const dm = await rpc("tools/call", { name: "instagram", arguments: {} });
  t("asking for a tool that doesn't exist is an error, not a leak", dm.result?.isError === true);
  const badName = await rpc("tools/call", { name: "member", arguments: { username: "../../etc" } });
  t("a username that isn't one is refused", badName.result?.isError === true);
  const alog = await rpc("tools/call", { name: "admin_log", arguments: {} });
  t("the admin log comes without what was typed", !/"detail"/.test(alog.result?.content?.[0]?.text || ""));
  t("GET /mcp doesn't stream", (await call("/mcp", { token: KEY })).status === 405);

  /* the key is not a session */
  t("a key can't read /api/me", (await call("/api/me", { token: KEY })).status === 401);
  t("a key can't open a member's messages", (await call("/api/admin/instagram", { token: KEY })).status === 401);
  t("a key can't read the mail log, backups or settings", (await Promise.all(["/api/admin/mail-log", "/api/admin/backups", "/api/admin/settings", "/api/admin/members.csv"].map((p) => call(p, { token: KEY })))).every((r) => r.status === 401));
  t("a key can't change anything", (await call("/api/admin/connectors/1", { method: "DELETE", token: KEY })).status === 401 && (await call("/api/admin/members/ana/suspend", { method: "POST", token: KEY })).status === 401);
  t("a key can open an allowed admin route directly", (await call("/api/admin/overview", { token: KEY })).status === 200);

  /* refresh rotates; revoke cuts off */
  const re = await (await call("/oauth/token", { method: "POST", form: true, body: { grant_type: "refresh_token", refresh_token: tok.refresh_token, client_id: reg.client_id } })).json();
  t("refresh hands out a new key", /^labs_mcp_/.test(re.access_token || "") && re.access_token !== KEY);
  t("…and the old key stops working", (await call("/mcp", { method: "POST", token: KEY, body: { jsonrpc: "2.0", id: 9, method: "ping" } })).status === 401);
  t("…and the old refresh key is spent", (await call("/oauth/token", { method: "POST", form: true, body: { grant_type: "refresh_token", refresh_token: tok.refresh_token } })).status === 400);
  const list = await (await call("/api/admin/connectors", { token: "tok-boss" })).json();
  t("Admin → Systems lists the connected key with the address to paste", list.url === B + "/mcp" && list.keys.length === 1 && list.keys[0].by === "boss");
  t("a member can't see the keys", (await call("/api/admin/connectors", { token: "tok-ana" })).status === 403);
  const rv = await (await call("/api/admin/connectors/" + list.keys[0].id, { method: "DELETE", token: "tok-boss" })).json();
  t("the admin can disconnect it", rv.ok === true);
  t("…and the new key is dead too", (await call("/mcp", { method: "POST", token: re.access_token, body: { jsonrpc: "2.0", id: 10, method: "ping" } })).status === 401);
} catch (e) { t("no exception: " + e.message, false); console.log(log.slice(-800)); }
srv.kill();
console.log(`\n${pass} passed, ${fail} failed`);
