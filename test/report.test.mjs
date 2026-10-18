// The morning report (2026-10-18): "the daily check fails at actually
// checking anything since it doesn't have access to a lot". One locked,
// read-only answer the check reads with a key: counts and the shape of
// problems, never a member's name, email or words.
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { rmSync, mkdirSync } from "node:fs";
const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const DATA = join(ROOT, "test/.tmp/report");
rmSync(DATA, { recursive: true, force: true }); mkdirSync(DATA, { recursive: true });
process.env.TNL_DATA = DATA;
const { db, logError } = await import(join(ROOT, "src/db.js"));
const now = Date.now(), DAY = 86400000, KEY = "k".repeat(20) + "-report-key-for-tests-0123456789";
let pass = 0, fail = 0;
const t = (n, ok) => { ok ? pass++ : fail++; console.log("  " + (ok ? "✓" : "✗") + "  " + n); };
const boot = (port, key) => spawn(process.execPath, ["--experimental-sqlite", "--no-warnings", "src/server.runtime.js"], {
  cwd: ROOT, env: { ...process.env, TNL_DATA: DATA, PORT: String(port), STRIPE_SECRET_KEY: "", TNL_NO_VIDEO_FIX: "1", TNL_NO_WATCH: "1", TNL_REPORT_KEY: key }, stdio: "ignore" });
const up = async (B) => { for (let i = 0; i < 100; i++) { try { if ((await fetch(B + "/api/health")).ok) return; } catch {} await new Promise((r) => setTimeout(r, 100)); } };
const U = (name, at) => db.prepare(`INSERT INTO users (username, display_name, email, password_hash, created_at, email_verified) VALUES (?,?,?,?,?,1)`)
  .run(name, name, `${name}@example.com`, "x", at);

/* one at a time: two servers migrating the same database at once can trip each other */
const off = boot(8893, "");
await up("http://localhost:8893");
const r0 = await fetch("http://localhost:8893/api/report/daily", { headers: { authorization: "Bearer " + KEY } });
off.kill(); await new Promise((r) => off.once("exit", r));
const on = boot(8894, KEY);
try {
  await up("http://localhost:8894");
  U("newbie", now - 3600000); U("newbie2", now - 7200000); U("olduser", now - DAY - 3600000);
  logError("server", "SQLITE_BUSY: database is locked for secret.person@gmail.com", "stack…", "/api/posts/123", "newbie");
  logError("server", "SQLITE_BUSY: database is locked for secret.person@gmail.com", "stack…", "/api/posts/456", "newbie2");
  logError("pay", "Stripe said no", "", "/api/checkout", "olduser");
  db.prepare(`INSERT INTO glitch_events (kind, place, detail, device, username, created_at) VALUES ('rage_tap','showroom','[like]','phone','newbie',?)`).run(now - 1000);

  console.log("\nLOCKED");
  t("with no key set in Railway the report doesn't exist", r0.status === 404);
  const B = "http://localhost:8894/api/report/daily";
  t("no key: not allowed", (await fetch(B)).status === 401);
  t("a wrong key: not allowed", (await fetch(B, { headers: { authorization: "Bearer " + KEY.slice(0, -1) + "x" } })).status === 401);
  t("the key in the address doesn't work (it would land in logs)", (await fetch(B + "?key=" + KEY)).status === 401);
  const r = await fetch(B, { headers: { authorization: "Bearer " + KEY } });
  t("the right key: the report", r.status === 200 && /json/.test(r.headers.get("content-type")));
  t("never cached", /no-store/.test(r.headers.get("cache-control") || ""));
  const j = await r.json(), text = JSON.stringify(j);

  console.log("\nWHAT IT SAYS");
  t("sign-ups today and the day before", j.activity.signups.today === 2 && j.activity.signups.dayBefore === 1);
  t("errors in the last day, grouped by what went wrong", j.errors.last24h === 3 && j.errors.top.some((e) => /SQLITE_BUSY/.test(e.message) && e.times === 2 && e.people === 2));
  t("…with ids in paths folded together", j.errors.top.some((e) => e.path === "/api/posts/:id"));
  t("payment problems counted", j.payments.errors24h === 1);
  t("glitches members hit", j.glitches.last24h === 1 && j.glitches.hotspots[0].place === "showroom");
  t("backups and disk are reported", "newestHoursAgo" in j.backup && (j.disk === null || typeof j.disk.freeMB === "number"));

  console.log("\nNOTHING PERSONAL");
  t("no email addresses, even one inside an error message", !/@example\.com|secret\.person|@gmail/.test(text) && text.includes("[email]"));
  t("no usernames", !/newbie|olduser/.test(text));
} finally { on.kill(); }
console.log(`\n  ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
