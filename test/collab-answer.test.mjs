// A collab invite gets an answer (2026-11-15, the fix list's number 5): "Not this time" for the person invited, and
// one nudge — a notification and an email — for an invite left waiting two days. Runs the real server against a
// stand-in for Resend on localhost; nothing leaves the machine.
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { mkdirSync, rmSync } from "node:fs";
import { spawn } from "node:child_process";
import { createServer } from "node:http";
const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const DATA = join(ROOT, "test/.tmp/collab-answer");
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
const mk = (u, extra = {}) => {
  const id = Number(db.prepare(`INSERT INTO users (username, display_name, email, password_hash, created_at, email_verified, avatar_url) VALUES (?,?,?,?,?,1,'/uploads/a.jpg')`)
    .run(u, u[0].toUpperCase() + u.slice(1), u + "@x.test", "x", now - 30 * D).lastInsertRowid);
  if (extra.mailOff) db.prepare(`UPDATE users SET mail_off = 1 WHERE id = ?`).run(id);
  db.prepare(`INSERT INTO sessions (token, user_id, created_at) VALUES (?,?,?)`).run("tok-" + u, id, now);
  return id;
};
const ana = mk("ana"), ben = mk("ben"), cy = mk("cy"), dee = mk("dee", { mailOff: true });
const post = (who, body) => Number(db.prepare(`INSERT INTO posts (author_id, channel, body, is_work, created_at) VALUES (?, 'profile', ?, 1, ?)`).run(who, body, now).lastInsertRowid);
const p1 = post(ana, "Night study in blue"), p2 = post(ana, "Train journey");
db.close();

const PORT = 19120 + (process.pid % 30);
const srv = spawn(process.execPath, ["--experimental-sqlite", "src/server.js"], { cwd: ROOT, stdio: ["ignore", "pipe", "pipe"], env: { ...process.env,
  PORT: String(PORT), TNL_DATA: DATA, RESEND_API_KEY: "re_test", MAIL_FROM: "LABS <noreply@tnllabs.com>", SUPPORT_EMAIL: "support@tnllabs.com",
  RESEND_API_BASE: `http://127.0.0.1:${fake.address().port}`, COLLAB_NUDGE_TICK_MS: "300", NUDGE_TICK_MS: "3600000", TNL_NO_WATCH: "1",
  PUBLIC_URL: "https://labs.tnllabs.com" } });
let log = ""; srv.stdout.on("data", (d) => log += d); srv.stderr.on("data", (d) => log += d);
for (let i = 0; i < 100 && !/listening/.test(log); i++) await wait(100);
const call = async (who, path, body) => { const r = await fetch(`http://127.0.0.1:${PORT}` + path, { method: body ? "POST" : "GET", headers: { "Content-Type": "application/json", Authorization: "Bearer tok-" + who }, body: body ? JSON.stringify(body) : undefined }); return { s: r.status, j: await r.json().catch(() => ({})) }; };
const { DatabaseSync } = await import("node:sqlite");
const raw = () => new DatabaseSync(join(DATA, "tnl.db"));
const notes = (id) => { const r = raw(); const n = r.prepare(`SELECT kind, body, post_id, read_at FROM notifications WHERE user_id = ? ORDER BY id`).all(id); r.close(); return n; };
const collab = (pid, uid) => { const r = raw(); const c = r.prepare(`SELECT * FROM collaborators WHERE post_id = ? AND user_id = ?`).get(pid, uid); r.close(); return c; };

try {
  console.log("\nTHE INVITE SAYS WHOSE POST IT IS");
  await call("ana", `/api/posts/${p1}/collab`, { username: "ben" });
  t("ben is told ana invited him to collab on HER post (it used to say 'your work')", notes(ben).some((n) => n.kind === "collab_invite" && n.body === "invited you to collab on their post"));

  console.log("\nNOT THIS TIME");
  t("only the person invited can decline", (await call("cy", `/api/posts/${p1}/collab/decline`, {})).s === 404);
  const d1 = await call("ben", `/api/posts/${p1}/collab/decline`, {});
  t("ben declines: the invite is gone", d1.s === 200 && d1.j.status === "declined" && !collab(p1, ben));
  t("…the invite is marked read for him", notes(ben).filter((n) => n.kind === "collab_invite").every((n) => n.read_at));
  t("…and ana is told kindly", notes(ana).some((n) => n.kind === "collab_decline" && n.body === "passed on this one"));
  t("declining twice: nothing waiting", (await call("ben", `/api/posts/${p1}/collab/decline`, {})).s === 404);
  t("no rep moves on a decline", (() => { const r = raw(); const n = r.prepare(`SELECT COUNT(*) n FROM rep_events WHERE kind = 'collab_accepted'`).get().n; r.close(); return n === 0; })());
  await call("ana", `/api/posts/${p1}/collab`, { username: "ben" });
  t("ana can invite him again later", collab(p1, ben)?.status === "pending");
  await call("ben", `/api/posts/${p1}/collab/accept`, {});
  t("an accepted collab can't be declined (it's no longer an invite)", (await call("ben", `/api/posts/${p1}/collab/decline`, {})).s === 404 && collab(p1, ben)?.status === "accepted");

  console.log("\nONE NUDGE FOR AN INVITE LEFT WAITING");
  await call("ana", `/api/posts/${p2}/collab`, { username: "cy" });
  await call("ana", `/api/posts/${p2}/collab`, { username: "dee" });
  await wait(900);
  t("a fresh invite isn't nudged", !notes(cy).some((n) => n.kind === "collab_nudge") && SENT.length === 0);
  { const r = raw(); r.prepare(`UPDATE collaborators SET created_at = ? WHERE post_id = ?`).run(now - 3 * D, p2); r.close(); }
  for (let i = 0; i < 40 && !notes(cy).some((n) => n.kind === "collab_nudge"); i++) await wait(100);
  await wait(500);
  t("two days on: cy gets one nudge in the app", notes(cy).filter((n) => n.kind === "collab_nudge").length === 1);
  const m = SENT.find((x) => x.to[0] === "cy@x.test");
  t("…and one email with the piece's words and a button to it", !!m && /Ana is waiting on your collab/.test(m.subject) && m.text.includes("Train journey") && m.html.includes("https://labs.tnllabs.com/?p=" + p2));
  t("…with the unsubscribe headers", !!m && /mail\/off\?k=/.test(m.headers?.["List-Unsubscribe"] || ""));
  t("dee (email off) gets the app's nudge, never an email", notes(dee).some((n) => n.kind === "collab_nudge") && !SENT.some((x) => x.to[0] === "dee@x.test"));
  await wait(900);
  t("once per invite: no second nudge, no second email", notes(cy).filter((n) => n.kind === "collab_nudge").length === 1 && SENT.filter((x) => x.to[0] === "cy@x.test").length === 1);
  t("an accepted collab is never nudged", !notes(ben).some((n) => n.kind === "collab_nudge"));
} finally { srv.kill(); fake.close(); if (fail) console.log("\n--- server log ---\n" + log.split("\n").filter((l) => /collab|mail|rror/.test(l)).slice(-20).join("\n")); }
console.log(`\n  ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
