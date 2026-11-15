// A sign-in ends after 90 days without use (2026-11-15, the audit: sign-ins never expired). Use keeps it alive; the
// day the rule arrived every existing sign-in started a fresh 90 days. Runs the real server.
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { mkdirSync, rmSync } from "node:fs";
import { spawn } from "node:child_process";
const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const DATA = join(ROOT, "test/.tmp/session-expiry");
rmSync(DATA, { recursive: true, force: true }); mkdirSync(join(DATA, "uploads"), { recursive: true });
process.env.TNL_DATA = DATA;
let pass = 0, fail = 0;
const t = (n, ok) => { ok ? pass++ : fail++; console.log("  " + (ok ? "✓" : "✗") + "  " + n); };
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

const { db } = await import("../src/db.js");
const now = Date.now(), D = 86400000;
const id = Number(db.prepare(`INSERT INTO users (username, display_name, email, password_hash, created_at, email_verified) VALUES ('ana','Ana','ana@x.test','x',?,1)`).run(now - 400 * D).lastInsertRowid);
/* a sign-in from before the rule: made 300 days ago, no "last used" on record */
db.prepare(`INSERT INTO sessions (token, user_id, created_at) VALUES ('tok-old', ?, ?)`).run(id, now - 300 * D);
db.close();

const PORT = 19360 + (process.pid % 30), B = `http://127.0.0.1:${PORT}`;
const boot = async () => { const srv = spawn(process.execPath, ["--experimental-sqlite", "src/server.js"], { cwd: ROOT, stdio: ["ignore", "pipe", "pipe"], env: { ...process.env, PORT: String(PORT), TNL_DATA: DATA, STRIPE_SECRET_KEY: "", RESEND_API_KEY: "", TNL_NO_WATCH: "1", NUDGE_TICK_MS: "3600000" } });
  let log = ""; srv.stdout.on("data", (d) => log += d); srv.stderr.on("data", (d) => log += d);
  for (let i = 0; i < 100 && !/listening/.test(log); i++) await wait(100); return srv; };
const me = async (tok) => (await fetch(B + "/api/me", { headers: { Authorization: "Bearer " + tok } })).status;
const { DatabaseSync } = await import("node:sqlite");
const sql = (fn) => { const r = new DatabaseSync(join(DATA, "tnl.db")); try { return fn(r); } finally { r.close(); } };
const row = (tok) => sql((r) => r.prepare(`SELECT * FROM sessions WHERE token = ?`).get(tok));

let srv = await boot();
try {
  console.log("\nTHE DAY THE RULE ARRIVES");
  t("a sign-in from long before the rule still works — everyone starts a fresh 90 days", await me("tok-old") === 200 && Math.abs(row("tok-old").last_used_at - Date.now()) < 60000);

  console.log("\nAFTER THAT");
  sql((r) => { for (const [tok, days] of [["tok-89", 89], ["tok-91", 91], ["tok-2", 2]]) r.prepare(`INSERT INTO sessions (token, user_id, created_at, last_used_at) VALUES (?,?,?,?)`).run(tok, id, now - 200 * D, now - days * D); });
  t("unused for 89 days: still signed in", await me("tok-89") === 200);
  t("…and using it starts the 90 days again", Math.abs(row("tok-89").last_used_at - Date.now()) < 60000);
  t("unused for 91 days: signed out, and the sign-in is gone", await me("tok-91") === 401 && !row("tok-91"));
  const before = row("tok-2").last_used_at; await me("tok-2");
  t("used two days ago: signed in, noted as used today", row("tok-2").last_used_at > before);
  const b2 = row("tok-2").last_used_at; await me("tok-2");
  t("…and not written again on every request (once a day is enough)", row("tok-2").last_used_at === b2);
  t("the look-around routes follow the same rule", await (async () => { sql((r) => r.prepare(`INSERT INTO sessions (token, user_id, created_at, last_used_at) VALUES ('tok-stale', ?, ?, ?)`).run(id, now - 200 * D, now - 120 * D)); await fetch(B + "/api/market", { headers: { Authorization: "Bearer tok-stale" } }); return !row("tok-stale"); })());

  console.log("\nTIDYING");
  sql((r) => r.prepare(`INSERT INTO sessions (token, user_id, created_at, last_used_at) VALUES ('tok-dust', ?, ?, ?)`).run(id, now - 300 * D, now - 150 * D));
  srv.kill(); await wait(300); srv = await boot();
  t("a restart clears sign-ins unused for over 90 days, and keeps the rest", !row("tok-dust") && !!row("tok-89") && !!row("tok-old"));
} finally { srv.kill(); }
console.log(`\n  ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
