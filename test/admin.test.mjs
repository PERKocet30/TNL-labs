// Admin v2.0 (2026-09-29): boots the real server on a throwaway database and
// checks the dashboard's numbers, the people tools, the audit log, and that
// none of it answers anyone but an admin.
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { mkdirSync, rmSync } from "node:fs";
import { spawn } from "node:child_process";
const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const DATA = join(ROOT, "test/.tmp/admin");
rmSync(DATA, { recursive: true, force: true }); mkdirSync(DATA, { recursive: true });
process.env.TNL_DATA = DATA;
let pass = 0, fail = 0;
const t = (n, ok) => { ok ? pass++ : fail++; console.log("  " + (ok ? "✓" : "✗") + "  " + n); };

const { db } = await import("../src/db.js");
const now = Date.now(), D = 86400000;
const mk = (u, { admin = 0, age = 60 } = {}) => {
  const id = Number(db.prepare(`INSERT INTO users (username, display_name, email, password_hash, created_at, email_verified) VALUES (?,?,?,?,?,1)`)
    .run(u, u.toUpperCase(), u + "@x.test", "x", now - age * D).lastInsertRowid);
  if (admin) db.prepare(`UPDATE users SET is_admin = 1 WHERE id = ?`).run(id);
  db.prepare(`INSERT INTO sessions (token, user_id, created_at) VALUES (?,?,?)`).run("tok-" + u, id, now);
  return id;
};
const U = { boss: mk("boss", { admin: 1 }), ana: mk("ana"), ben: mk("ben"), cam: mk("cam", { age: 2 }), dee: mk("dee", { age: 40 }) };
const post = (who, ch, ago, work = 0) => Number(db.prepare(`INSERT INTO posts (author_id, channel, body, is_work, created_at) VALUES (?,?,?,?,?)`)
  .run(U[who], ch, "post by " + who, work, now - ago).lastInsertRowid);
const p1 = post("ana", "general", 2 * D, 1), p2 = post("ben", "music", 3 * D), p3 = post("dee", "general", 35 * D);
post("ana", "general", 40 * D);
db.prepare(`INSERT INTO likes (post_id, user_id, created_at) VALUES (?,?,?)`).run(p1, U.ben, now - D);
db.prepare(`INSERT INTO collaborators (post_id, user_id, status, created_at) VALUES (?,?,?,?)`).run(p1, U.ben, "accepted", now - D);
db.close();

const PORT = 18500 + (process.pid % 200);
const srv = spawn(process.execPath, ["--experimental-sqlite", "src/server.js"], { cwd: ROOT, env: { ...process.env, PORT: String(PORT), TNL_DATA: DATA }, stdio: ["ignore", "pipe", "pipe"] });
let log = ""; srv.stdout.on("data", (d) => log += d); srv.stderr.on("data", (d) => log += d);
for (let i = 0; i < 100 && !/listening/.test(log); i++) await new Promise((r) => setTimeout(r, 100));
const call = async (who, method, path, body) => {
  const r = await fetch(`http://127.0.0.1:${PORT}` + path, { method, headers: { "Content-Type": "application/json", ...(who ? { Authorization: "Bearer tok-" + who } : {}) }, body: body ? JSON.stringify(body) : undefined });
  let j = {}; try { j = await r.json(); } catch {}
  return { s: r.status, j };
};
try {
  console.log("\nADMINS ONLY — enforced on the server");
  for (const path of ["/api/admin/pulse", "/api/admin/people", "/api/admin/people/ana", "/api/admin/posts", "/api/admin/log"])
    t("a member gets 403 on " + path, (await call("ana", "GET", path)).s === 403);
  t("a member can't write a note", (await call("ana", "POST", "/api/admin/people/ben/note", { body: "x" })).s === 403);
  t("a member can't sign someone out", (await call("ana", "POST", "/api/admin/people/ben/signout")).s === 403);
  t("signed out → 401", (await call(null, "GET", "/api/admin/pulse")).s === 401);

  console.log("\nPULSE — the numbers, against the period before");
  const p = (await call("boss", "GET", "/api/admin/pulse?days=7&tz=240")).j;
  t("7-day window, 7 daily buckets", p.days === 7 && p.series.posts.length === 7);
  t("posts this week: 2 (last week: 0)", p.now.posts === 2 && p.before.posts === 0);
  t("signups this week: cam", p.now.signups === 1);
  t("active this week: ana, ben (posting / liking)", p.now.active === 2);
  t("collabs confirmed this week: 1", p.now.collabs === 1);
  t("posts per day add up", p.series.posts.reduce((a, b) => a + b, 0) === 2);
  const loop = Object.fromEntries(p.loop.map((s) => [s.label, s]));
  t("loop: 5 joined → 3 posted → 1 got feedback", loop.Joined.n === 5 && loop.Posted.n === 3 && loop["Got feedback"].n === 1);
  t("posted but no feedback yet: ben and dee", loop["Got feedback"].stuck.map((x) => x.username).sort().join() === "ben,dee");
  t("joined but never posted: boss and cam", loop.Posted.stuck.map((x) => x.username).sort().join() === "boss,cam");
  t("labs this week: general and music", p.labs.map((l) => l.channel).sort().join() === "general,music");
  t("needs you: cam is new and hasn't posted", p.inbox.some((i) => i.kind === "welcome" && i.people.includes("cam")));
  t("needs you: no backup yet", p.inbox.some((i) => i.kind === "backup"));
  t("a nonsense range falls back to 30 days", (await call("boss", "GET", "/api/admin/pulse?days=999")).j.days === 30);

  console.log("\nPEOPLE — find, filter, act");
  const ppl = async (qs) => (await call("boss", "GET", "/api/admin/people" + qs)).j.people.map((x) => x.username);
  t("new this week: cam", (await ppl("?filter=new")).join() === "cam");
  t("never posted: boss and cam", (await ppl("?filter=silent")).sort().join() === "boss,cam");
  t("gone quiet 14+ days: dee", (await ppl("?filter=quiet")).join() === "dee");
  t("search by name", (await ppl("?q=BE")).join() === "ben");
  t("sort by last active: ana or ben first", ["ana", "ben"].includes((await ppl("?sort=active"))[0]));
  const d = (await call("boss", "GET", "/api/admin/people/ana")).j;
  t("detail: posts, feedback received, collabs", d.stats.posts === 2 && d.stats.likesGot === 1 && d.stats.collabs === 0 && d.posts.length === 2);
  t("private note saves", (await call("boss", "POST", "/api/admin/people/ana/note", { body: "met at the pop-up" })).j.ok
    && (await call("boss", "GET", "/api/admin/people/ana")).j.note.body === "met at the pop-up");
  t("…and shows in the list", (await call("boss", "GET", "/api/admin/people?q=ana")).j.people[0].note === true);
  t("sign out everywhere ends their sessions", (await call("boss", "POST", "/api/admin/people/ben/signout")).j.sessions === 1
    && (await call("ben", "GET", "/api/me")).s === 401);

  console.log("\nREP ADJUSTMENTS — logged, and actually applied");
  const r = await call("boss", "POST", "/api/admin/members/ana/rep", { delta: 25, reason: "ran the workshop" });
  t("grant +25 works (it used to 500 after moving rep)", r.s === 200 && r.j.rep === 25);
  const ev = (await call("boss", "GET", "/api/admin/people/ana")).j.rep[0];
  t("…with a rep_events row for the exact amount", ev.kind === "admin_grant" && ev.amount === 25);
  await call("boss", "POST", "/api/admin/members/ana/rep", { delta: -100 });
  const ev2 = (await call("boss", "GET", "/api/admin/people/ana")).j;
  t("a deduction stops at 0 and logs what it actually took", ev2.person.rep === 0 && ev2.rep[0].amount === -25);

  console.log("\nAUDIT LOG — every admin change, written down");
  const lg = (await call("boss", "GET", "/api/admin/log")).j.log;
  t("notes, sign-outs and rep changes are logged, newest first", lg.length >= 4 && /rep$/.test(lg[0].action) && lg[0].by === "boss");
  t("the reason travels with it", lg.some((x) => x.detail.includes("ran the workshop")));
  t("reads aren't logged", !lg.some((x) => x.action.startsWith("GET")));
  t("refused attempts aren't logged as changes", !lg.some((x) => x.target === "ben" && /note/.test(x.action)));

  console.log("\nCONTENT");
  const c = (await call("boss", "GET", "/api/admin/posts?channel=general")).j;
  t("filter by lab", c.posts.length === 3 && c.posts.every((x) => x.channel === "general"));
  t("channels listed with counts", c.channels.find((x) => x.channel === "general").n === 3);
  t("search by text or author", (await call("boss", "GET", "/api/admin/posts?q=ben")).j.posts.length === 1);
} catch (e) {
  fail++; console.log("  ✗  threw: " + e.message); console.log(log.slice(-1500));
} finally { srv.kill(); }
console.log(`\n  ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
