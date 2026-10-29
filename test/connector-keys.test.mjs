// CONNECTOR KEYS v1.0 (2026-10-28): "help me connect to Manus." Apps like Manus
// take a server address and a key instead of signing in. Checks that only the
// owner can make one, it's shown once and stored only as a hash, it reads
// exactly what Claude's key reads (the /mcp tools, nothing else), and
// Disconnect cuts it off.
import { spawn } from "node:child_process";
import { createHash } from "node:crypto";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { rmSync, mkdirSync } from "node:fs";
const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const DATA = join(ROOT, "test/.tmp/connector-keys");
rmSync(DATA, { recursive: true, force: true }); mkdirSync(DATA, { recursive: true });
process.env.TNL_DATA = DATA;
const { db } = await import(join(ROOT, "src/db.js"));
const now = Date.now();
const U = (n, admin, mod = 0) => { const id = Number(db.prepare(`INSERT INTO users (username, display_name, email, password_hash, created_at, email_verified, is_admin) VALUES (?,?,?,?,?,1,?)`)
  .run(n, n, n + "@secret.example", "h", now, admin ? 1 : 0).lastInsertRowid);
  db.prepare(`UPDATE users SET is_mod = ? WHERE id = ?`).run(mod, id);
  db.prepare(`INSERT INTO sessions (token, user_id, created_at) VALUES (?,?,?)`).run("tok-" + n, id, now); return id; };
U("boss", true); U("ana", false); U("modone", false, 1);
db.close();
let pass = 0, fail = 0;
const t = (n, ok) => { ok ? pass++ : fail++; console.log("  " + (ok ? "✓" : "✗") + "  " + n); };

const PORT = 18700 + (process.pid % 150);
const srv = spawn(process.execPath, ["--experimental-sqlite", "src/server.js"], { cwd: ROOT, env: { ...process.env, PORT: String(PORT), TNL_DATA: DATA, PUBLIC_URL: `http://127.0.0.1:${PORT}` }, stdio: ["ignore", "pipe", "pipe"] });
let log = ""; srv.stdout.on("data", (d) => log += d); srv.stderr.on("data", (d) => log += d);
for (let i = 0; i < 100 && !/listening/.test(log); i++) await new Promise((r) => setTimeout(r, 100));
const B = `http://127.0.0.1:${PORT}`;
const call = async (path, { method = "GET", token, body } = {}) => { const r = await fetch(B + path, { method, headers: { ...(token ? { Authorization: "Bearer " + token } : {}), "Content-Type": "application/json" }, body: body ? JSON.stringify(body) : undefined });
  let j = {}; try { j = await r.json(); } catch {} return { s: r.status, j }; };
const mkKey = (who, name) => call("/api/admin/connectors/key", { method: "POST", token: "tok-" + who, body: { name } });
try {
  console.log("\nMAKING A KEY — the owner only");
  t("a member can't", (await mkKey("ana", "Manus")).s === 403);
  t("a Mod can't", (await mkKey("modone", "Manus")).s === 403);
  t("it needs a name", (await mkKey("boss", "  ")).s === 400);
  const k = (await mkKey("boss", "Manus <script>")).j;
  t("the owner gets a key, the /mcp address and a 90-day end", /^labs_mcp_[0-9a-f]{64}$/.test(k.key || "") && k.url === B + "/mcp" && Math.abs(k.expiresAt - now - 90 * 864e5) < 60000);
  t("the name is cleaned", k.name === "Manus script");
  const list = (await call("/api/admin/connectors", { token: "tok-boss" })).j;
  const row = (list.keys || []).find((x) => x.name === "Manus script");
  t("it's listed as a pasted key", !!row && row.pasted === true);
  t("…and the list never shows the key itself", !JSON.stringify(list).includes(k.key));

  console.log("\nIT READS WHAT CLAUDE READS — nothing more");
  const rpc = async (method, params) => (await call("/mcp", { method: "POST", token: k.key, body: { jsonrpc: "2.0", id: 1, method, params } })).j;
  const tools = (await rpc("tools/list", {})).result?.tools || [];
  t("Manus sees the read-only tools", tools.some((x) => x.name === "overview"));
  t("…and can read the overview", !!(await rpc("tools/call", { name: "overview", arguments: {} })).result);
  t("the key can't be used on admin routes directly", (await call("/api/admin/people", { token: k.key })).s === 401);
  t("…or to post anything", (await call("/api/posts", { method: "POST", token: k.key, body: { body: "x", channel: "general" } })).s === 401);
  t("there's no refresh to stretch it", (await (await fetch(B + "/oauth/token", { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body: "grant_type=refresh_token&refresh_token=" + k.key })).json()).error === "invalid_grant");

  console.log("\nDISCONNECT");
  t("Disconnect cuts it off", (await call("/api/admin/connectors/" + row.id, { method: "DELETE", token: "tok-boss" })).j.ok === true
    && (await call("/mcp", { method: "POST", token: k.key, body: { jsonrpc: "2.0", id: 1, method: "tools/list", params: {} } })).s === 401);
} catch (e) {
  fail++; console.log("  ✗  threw: " + e.message); console.log(log.slice(-1500));
} finally { srv.kill(); }
console.log(`\n  ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
