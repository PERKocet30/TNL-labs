// THE SYSTEMS MAP v1.0 — 2026-11-04: "Can we do the same type of interactive model for the system networks… all the
// networks that run the app." GET /api/admin/systems/map — every service with a state (on · warn · wait · off), a line,
// facts and the page to open, from what LABS knows on its own. Admins only; never a key; no outside calls.
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { rmSync, mkdirSync } from "node:fs";
const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const DATA = join(ROOT, "test/.tmp/systems-map");
rmSync(DATA, { recursive: true, force: true }); mkdirSync(DATA, { recursive: true });
process.env.TNL_DATA = DATA;
const { db } = await import(join(ROOT, "src/db.js"));
let pass = 0, fail = 0;
const t = (n, ok) => { ok ? pass++ : fail++; console.log("  " + (ok ? "✓" : "✗") + "  " + n); };
const now = Date.now();
const mk = (u, admin = 0) => { const id = Number(db.prepare(`INSERT INTO users (username, display_name, email, password_hash, created_at, email_verified, is_admin) VALUES (?,?,?,?,?,1,?)`)
  .run(u, u, u + "@x.test", "x", now, admin).lastInsertRowid); db.prepare(`INSERT INTO sessions (token, user_id, created_at) VALUES (?,?,?)`).run("tok-" + u, id, now); return id; };
mk("boss", 1); mk("ana");
db.close();

const KEYS = { STRIPE_SECRET_KEY: "sk_test_SECRETSTRIPE", RESEND_API_KEY: "re_SECRETRESEND", ECHO_AI_KEY: "sk-ant-SECRETCLAUDE" };
async function boot(port, env) {
  const srv = spawn(process.execPath, ["--experimental-sqlite", "--no-warnings", "src/server.runtime.js"], {
    cwd: ROOT, stdio: "ignore", env: { ...process.env, TNL_DATA: DATA, PORT: String(port), TNL_NO_VIDEO_FIX: "1", TNL_NO_WATCH: "1", PUBLIC_URL: `http://localhost:${port}`,
      STRIPE_SECRET_KEY: "", RESEND_API_KEY: "", ECHO_AI_KEY: "", ANTHROPIC_API_KEY: "", GOOGLE_SERVICE_ACCOUNT: "", META_ACCESS_TOKEN: "", ...env } });
  for (let i = 0; i < 100; i++) { try { if ((await fetch(`http://localhost:${port}/api/health`)).ok) break; } catch {} await new Promise((r) => setTimeout(r, 100)); }
  return srv;
}
const get = async (port, tok, headers = {}) => { const r = await fetch(`http://localhost:${port}/api/admin/systems/map`, { headers: { ...(tok ? { Authorization: "Bearer " + tok } : {}), ...headers } });
  return { s: r.status, text: await r.text() }; };
const nodes = (text) => Object.fromEntries(JSON.parse(text).nodes.map((n) => [n.id, n]));

let srv = await boot(8931, {});
try {
  console.log("\nWHO MAY SEE IT");
  t("signed out: 401", (await get(8931)).s === 401);
  t("a member: 403", (await get(8931, "tok-ana")).s === 403);
  const r = await get(8931, "tok-boss"); t("an admin: 200", r.s === 200);

  console.log("\nNO KEYS SET");
  const N = nodes(r.text);
  t("every service is on the map", ["labs", "members", "cloudflare", "railway", "data", "github", "stripe", "resend", "claude", "connector", "google", "meta"].every((id) => N[id]));
  t("Stripe, Resend, Claude, Google and Instagram say not connected, and where the key goes", ["stripe", "resend", "claude", "google", "meta"].every((id) => N[id].state === "off")
    && /STRIPE_SECRET_KEY/.test(N.stripe.line) && /RESEND_API_KEY/.test(N.resend.line) && /ECHO_AI_KEY/.test(N.claude.line));
  t("not through Cloudflare: off", N.cloudflare.state === "off");
  t("through Cloudflare (cf-ray): on", nodes((await get(8931, "tok-boss", { "cf-ray": "8abc-LAX" })).text).cloudflare.state === "on");
  t("LABS itself is working", N.labs.state === "on");
  t("every node has a line, what it does and its facts", Object.values(N).every((n) => n.name && n.does && n.line && Array.isArray(n.facts)));
} finally { srv.kill(); }

/* keys set, and trouble in the logs */
const { DatabaseSync } = await import("node:sqlite"); const w = new DatabaseSync(join(DATA, "tnl.db"));
const err = (kind, ago) => w.prepare(`INSERT INTO error_log (kind, message, created_at) VALUES (?,?,?)`).run(kind, "boom", now - ago);
err("pay", 3600000); err("mail", 7200000); err("mail", 2 * 86400000);                 // one old email failure, outside the day
for (let i = 0; i < 3; i++) err("server", 60000 * (i + 1));                            // three server errors in the hour
w.close();
srv = await boot(8932, KEYS);
try {
  console.log("\nKEYS SET, TROUBLE IN THE LOGS");
  const r = await get(8932, "tok-boss"), N = nodes(r.text);
  t("a payment error today: Stripe needs a look", N.stripe.state === "warn" && /1 payment error today/.test(N.stripe.line));
  t("an email failed today: Resend needs a look (yesterday's doesn't count)", N.resend.state === "warn" && /1 email failed today/.test(N.resend.line));
  t("three server errors in the hour: LABS needs a look", N.labs.state === "warn" && /3 server errors/.test(N.labs.line));
  t("Claude's key set: on", N.claude.state === "on");
  t("never a key in the answer", !/SECRETSTRIPE|SECRETRESEND|SECRETCLAUDE|sk_test|re_SECRET|sk-ant/.test(r.text));
  t("each service names the page to open", ["stripe", "resend", "claude", "meta"].every((id) => typeof N[id].go === "string" && N[id].go));
} finally { srv.kill(); }

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
