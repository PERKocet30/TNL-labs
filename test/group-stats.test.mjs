// GROUP CHATS, COUNTED v1.0 (2026-11-03): "Has anyone besides me made group chats?"
// Runs the real groupChatStats() (lifted from src/server/admin/pulse-labs.js) against a
// throwaway database: groups started by members (not admins), the people in them, the ones
// with a real message this week — and nothing but counts ever leaves it.
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { mkdirSync, rmSync, readFileSync } from "node:fs";
const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const DATA = join(ROOT, "test/.tmp/group-stats");
rmSync(DATA, { recursive: true, force: true }); mkdirSync(DATA, { recursive: true });
process.env.TNL_DATA = DATA;
let pass = 0, fail = 0;
const t = (n, ok) => { ok ? pass++ : fail++; console.log("  " + (ok ? "✓" : "✗") + "  " + n); };

const { db } = await import("../src/db.js");
// the group shape server/messages/core.js migrates to (db.js still has the old two-person table)
db.exec(`DROP TABLE dm_messages; DROP TABLE dm_threads;
  CREATE TABLE dm_threads (id INTEGER PRIMARY KEY AUTOINCREMENT, is_group INTEGER NOT NULL DEFAULT 0, title TEXT, created_by INTEGER, updated_at INTEGER, created_at INTEGER);
  CREATE TABLE dm_members (thread_id INTEGER, user_id INTEGER, accepted INTEGER DEFAULT 1, last_read_at INTEGER DEFAULT 0, cleared_at INTEGER DEFAULT 0, joined_at INTEGER, left_at INTEGER, PRIMARY KEY (thread_id, user_id));
  CREATE TABLE dm_messages (id INTEGER PRIMARY KEY AUTOINCREMENT, thread_id INTEGER, sender_id INTEGER, body TEXT DEFAULT '', kind TEXT NOT NULL DEFAULT 'msg', deleted_at INTEGER, created_at INTEGER)`);
const src = readFileSync(join(ROOT, "src/server/admin/pulse-labs.js"), "utf8");
const fn = src.slice(src.indexOf("function groupChatStats("), src.indexOf('app.get("/api/admin/direction"'));
const groupChatStats = new Function("db", fn + "\nreturn groupChatStats;")(db);

const now = Date.now(), D = 86400000;
const u = {};
for (const n of ["boss", "ana", "ben", "cam", "dee", "eli"]) u[n] = Number(db.prepare(`INSERT INTO users (username, display_name, email, password_hash, created_at) VALUES (?,?,?,?,?)`).run(n, n, n + "@x.test", "x", now - 30 * D).lastInsertRowid);
db.prepare(`UPDATE users SET is_admin = 1 WHERE id = ?`).run(u.boss);
const group = (by, people, title = "secret plans") => {
  const id = Number(db.prepare(`INSERT INTO dm_threads (is_group, title, created_by, updated_at, created_at) VALUES (1,?,?,?,?)`).run(title, u[by], now, now).lastInsertRowid);
  for (const p of [by, ...people]) db.prepare(`INSERT INTO dm_members (thread_id, user_id, joined_at) VALUES (?,?,?)`).run(id, u[p], now);
  db.prepare(`INSERT INTO dm_messages (thread_id, sender_id, body, kind, created_at) VALUES (?,?,?,?,?)`).run(id, u[by], by + " made the group", "system", now);
  return id;
};
const say = (g, who, ago = 0, kind = "msg") => db.prepare(`INSERT INTO dm_messages (thread_id, sender_id, body, kind, created_at) VALUES (?,?,?,?,?)`).run(g, u[who], "hey", kind, now - ago);

console.log("\nONLY YOURS SO FAR");
group("boss", ["ana", "ben"]);
db.prepare(`INSERT INTO dm_threads (is_group, created_by, updated_at, created_at) VALUES (0,?,?,?)`).run(u.ana, now, now);   // a one-to-one chat
let g = groupChatStats(now);
t("an admin's group counts in all, never as a member's", g.all === 1 && g.byMembers === 0 && g.startedBy === 0 && g.people === 0);
t("a one-to-one chat is not a group", g.all === 1);

console.log("\nMEMBERS START THEIR OWN");
const g1 = group("ana", ["ben", "cam"]), g2 = group("ana", ["dee"]), g3 = group("cam", ["ana", "eli"]);
g = groupChatStats(now);
t("groups started by members, and by how many different members", g.byMembers === 3 && g.startedBy === 2 && g.all === 4);
t("each person in them counted once, however many groups they're in", g.people === 5);
db.prepare(`UPDATE dm_members SET left_at = ? WHERE thread_id = ? AND user_id = ?`).run(now, g2, u.dee);
t("someone who left isn't counted as in them", groupChatStats(now).people === 4);

console.log("\nACTIVE THIS WEEK MEANS A REAL MESSAGE");
t("a group with only its 'made the group' line isn't active", groupChatStats(now).activeWeek === 0);
say(g1, "ben"); say(g3, "eli", 10 * D);
t("a message this week makes it active; one from ten days ago doesn't", groupChatStats(now).activeWeek === 1);
say(g2, "ana", 0, "system");
db.prepare(`INSERT INTO dm_messages (thread_id, sender_id, body, kind, deleted_at, created_at) VALUES (?,?,?,?,?,?)`).run(g3, u.cam, "oops", "msg", now, now);
t("a system line or a deleted message doesn't count as activity", groupChatStats(now).activeWeek === 1);

console.log("\nCOUNTS ONLY");
const out = JSON.stringify(groupChatStats(now));
t("only numbers leave: no titles, names or messages", Object.values(groupChatStats(now)).every((v) => Number.isInteger(v)) && !/secret|ana|ben|hey/.test(out));
const home = readFileSync(join(ROOT, "public/admin-app/2-home.js"), "utf8"), dash = readFileSync(join(ROOT, "src/server/admin/dashboard.js"), "utf8");
t("Admin home shows it under How people take part; the overview (and the connector) carry it", /groupsHTML\(tp\.groups\)/.test(home) && /groups: groupChatStats\(now\)/.test(dash) && /groups: groupChatStats\(\),/.test(src));

console.log(`\n  ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
