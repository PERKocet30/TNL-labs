// The reminder for someone who has never posted (2026-11-15, the fix list's number 4): ONE email, from their
// second day — not the weekly run, which stays for members who have posted (673 had gone out, 16 came back).
// Runs the real server against a stand-in for Resend on localhost; nothing leaves the machine.
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { mkdirSync, rmSync } from "node:fs";
import { spawn } from "node:child_process";
import { createServer } from "node:http";
const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const DATA = join(ROOT, "test/.tmp/nudge-never");
rmSync(DATA, { recursive: true, force: true }); mkdirSync(join(DATA, "uploads"), { recursive: true });
process.env.TNL_DATA = DATA;
let pass = 0, fail = 0;
const t = (n, ok) => { ok ? pass++ : fail++; console.log("  " + (ok ? "✓" : "✗") + "  " + n); };
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

const SENT = [];
const fake = createServer((req, res) => { let b = ""; req.on("data", (d) => b += d); req.on("end", () => {
  SENT.push(JSON.parse(b)); res.writeHead(200, { "Content-Type": "application/json" }); res.end(`{"id":"e${SENT.length}"}`); }); });
await new Promise((r) => fake.listen(0, "127.0.0.1", r));

const { db } = await import("../src/db.js");
const now = Date.now(), D = 86400000;
let order = 0;
const mk = (u, joinedDays, posted, admin = 0) => {
  const id = Number(db.prepare(`INSERT INTO users (username, display_name, email, password_hash, created_at, email_verified, roles, avatar_url, bio, accent) VALUES (?,?,?,?,?,1,'[]','','','lab')`)
    .run(u, u, u + "@x.test", "x", now - joinedDays * D + order++ * 1000).lastInsertRowid);
  if (admin) db.prepare(`UPDATE users SET is_admin = 1 WHERE id = ?`).run(id);
  db.prepare(`INSERT INTO sessions (token, user_id, created_at) VALUES (?,?,?)`).run("tok-" + u, id, now);
  if (posted) db.prepare(`INSERT INTO posts (author_id, channel, body, is_work, created_at) VALUES (?, 'general', 'x', 1, ?)`).run(id, now);
  return id;
};
mk("boss", 60, 1, 1);
const nova = mk("nova", 1, 0);     // never posted, first day: not yet
const noa = mk("noa", 2.5, 0);     // never posted, second day: one
const pia = mk("pia", 2.5, 1);     // posted, second day: the weekly run starts on day 3
const pat = mk("pat", 10, 1);      // posted, ten days in: the weekly run
db.close();

const PORT = 19060 + (process.pid % 30);
const srv = spawn(process.execPath, ["--experimental-sqlite", "src/server.js"], { cwd: ROOT, stdio: ["ignore", "pipe", "pipe"], env: { ...process.env,
  PORT: String(PORT), TNL_DATA: DATA, RESEND_API_KEY: "re_test", MAIL_FROM: "LABS <noreply@tnllabs.com>", SUPPORT_EMAIL: "support@tnllabs.com",
  RESEND_API_BASE: `http://127.0.0.1:${fake.address().port}`, NUDGE_TICK_MS: "300", NUDGE_EVERY_MS: "60000", NUDGE_PER_DAY: "20", NUDGE_GAP_MS: "0",
  PUBLIC_URL: "https://labs.tnllabs.com" } });
let log = ""; srv.stdout.on("data", (d) => log += d); srv.stderr.on("data", (d) => log += d);
for (let i = 0; i < 100 && !/listening/.test(log); i++) await wait(100);
const { DatabaseSync } = await import("node:sqlite");
const raw = () => new DatabaseSync(join(DATA, "tnl.db"));
const to = (m) => m.to[0].replace("@x.test", "");
const sent = (who) => SENT.filter((m) => to(m) === who).length;
const ago = (days) => { const r = raw(); r.prepare(`UPDATE nudge_mail SET last_at = ?`).run(now - days * D); r.close(); };

try {
  console.log("\nNEVER POSTED: ONE REMINDER, FROM DAY 2");
  await wait(1500);
  t("never posted, second day: one reminder", sent("noa") === 1);
  t("never posted, first day: none yet", sent("nova") === 0);
  t("posted, second day: none yet — the weekly run starts on day 3", sent("pia") === 0);
  t("posted, ten days in: the weekly run", sent("pat") === 1);
  const st = await (await fetch(`http://127.0.0.1:${PORT}/api/admin/nudge`, { headers: { Authorization: "Bearer tok-boss" } })).json();
  t("Admin is told the rule: one, from day 2", st.neverPosted && st.neverPosted.max === 1 && st.neverPosted.fromDay === 2);

  console.log("\nA WEEK ON");
  ago(8); { const r = raw(); r.prepare(`UPDATE users SET created_at = created_at - ? WHERE id = ?`).run(D, nova); r.close(); }
  await wait(1500);
  t("never posted: still only the one", sent("noa") === 1);
  t("the one who was new reaches day 2: their one", sent("nova") === 1);
  t("posted: the next of the weekly run", sent("pat") === 2);
  ago(8); await wait(1200);
  t("…and never posted stays at one, however long", sent("noa") === 1 && sent("nova") === 1);
} finally { srv.kill(); fake.close(); if (fail) console.log("\n--- server log ---\n" + log.split("\n").filter((l) => /nudge|mail|rror/.test(l)).slice(-20).join("\n")); }
console.log(`\n  ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
