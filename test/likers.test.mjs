// Who liked it, and who voted (2026-10-30). "I need an update where you can see
// who liked your post, and where I can see who voted for you specifically and
// keeps voting." Then: "I still can't see who liked other people's post." Anyone
// signed in sees a post's likers (unless its maker hid them); the admin
// sees each tournament piece's voters and the regulars — members never do.
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { rmSync, mkdirSync } from "node:fs";
import { DatabaseSync } from "node:sqlite";
const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const DATA = join(ROOT, "test/.tmp/likers");
rmSync(DATA, { recursive: true, force: true }); mkdirSync(DATA, { recursive: true });
let pass = 0, fail = 0;
const t = (n, ok) => { ok ? pass++ : fail++; console.log("  " + (ok ? "✓" : "✗") + "  " + n); };
const PORT = 19300 + (process.pid % 200);
const srv = spawn(process.execPath, ["--experimental-sqlite", "src/server.js"], { cwd: ROOT, env: { ...process.env, PORT: String(PORT), TNL_DATA: DATA, PUBLIC_URL: `http://127.0.0.1:${PORT}` }, stdio: ["ignore", "pipe", "pipe"] });
let log = ""; srv.stdout.on("data", (d) => log += d); srv.stderr.on("data", (d) => log += d);
for (let i = 0; i < 100 && !/listening/.test(log); i++) await new Promise((r) => setTimeout(r, 100));
const B = `http://127.0.0.1:${PORT}`;
const db = new DatabaseSync(join(DATA, "tnl.db"));
const now = Date.now(), D = 86400000;
const U = (n, o = {}) => { const id = Number(db.prepare(`INSERT INTO users (username, display_name, email, password_hash, created_at, email_verified, is_admin, avatar_url, suspended) VALUES (?,?,?,?,?,1,?,?,?)`)
  .run(n, n.toUpperCase(), n + "@x.example", "h", now - 30 * D, o.admin ? 1 : 0, o.photo === false ? "" : "/uploads/p.jpg", o.suspended ? 1 : 0).lastInsertRowid);
  db.prepare(`INSERT INTO sessions (token, user_id, created_at) VALUES (?,?,?)`).run("tok-" + n, id, now); return id; };
const boss = U("boss", { admin: true }), ana = U("ana"), ben = U("ben"), cat = U("cat", { photo: false }), dee = U("dee"), sus = U("sus", { suspended: true });
const post = Number(db.prepare(`INSERT INTO posts (author_id, channel, body, image_url, created_at) VALUES (?,?,?,?,?)`).run(ana, "photography", "work", "/uploads/x.jpg", now - 5 * D).lastInsertRowid);
db.prepare(`INSERT INTO collaborators (post_id, user_id, status, created_at) VALUES (?,?,'accepted',?)`).run(post, dee, now - 5 * D);
for (const [u, at] of [[ben, now - 3 * D], [cat, now - D], [sus, now - 2 * D]]) db.prepare(`INSERT INTO likes (post_id, user_id, created_at) VALUES (?,?,?)`).run(post, u, at);
/* the tournament: ana and ben entered; cat voted for ana all three days, dee once, boss on days 2 and 3 for ben */
const ev = Number(db.prepare(`INSERT INTO events (slug, title, published, format, created_at, updated_at) VALUES ('cup','Cup',1,'poll',?,?)`).run(now - 10 * D, now).lastInsertRowid);
const entry = (u) => Number(db.prepare(`INSERT INTO event_entries (event_id, user_id, post_id, created_at) VALUES (?,?,?,?)`).run(ev, u, post, now - 9 * D).lastInsertRowid);
const eA = entry(ana), eB = entry(ben);
const vote = (u, day, e) => db.prepare(`INSERT INTO event_votes (event_id, stage, matchup, entry_id, voter_id, created_at) VALUES (?,?,?,?,?,?)`).run(ev, "vote", 20261020 + day, e, u, now - (4 - day) * D);
vote(cat, 1, eA); vote(cat, 2, eA); vote(cat, 3, eA); vote(dee, 1, eA); vote(boss, 2, eB); vote(boss, 3, eB);
const get = (path, tok) => fetch(B + path, { headers: { Authorization: "Bearer " + tok } });

try {
  const r = await get(`/api/posts/${post}/likers`, "tok-ana");
  const d = await r.json();
  t("the maker sees who liked it, newest first", r.status === 200 && d.likers.map((x) => x.username).join(",") === "cat,ben");
  t("…with names and photos, never emails", d.likers[1].displayName === "BEN" && d.likers[1].avatarUrl && !JSON.stringify(d).includes("@x.example"));
  t("a suspended account isn't listed", !d.likers.some((x) => x.username === "sus"));
  t("someone credited on the work sees it too", (await get(`/api/posts/${post}/likers`, "tok-dee")).status === 200);
  t("an admin sees it", (await get(`/api/posts/${post}/likers`, "tok-boss")).status === 200);
  const other = await get(`/api/posts/${post}/likers`, "tok-ben");
  t("anyone signed in sees who liked someone else's post", other.status === 200 && (await other.json()).likers.length === 2);
  db.prepare(`INSERT INTO blocks (blocker_id, blocked_id, created_at) VALUES (?,?,?)`).run(cat, dee, now);
  const blk = await (await get(`/api/posts/${post}/likers`, "tok-dee")).json();
  t("someone you've a block with isn't listed for you", blk.likers.map((x) => x.username).join(",") === "ben");
  db.prepare(`INSERT INTO blocks (blocker_id, blocked_id, created_at) VALUES (?,?,?)`).run(ana, cat, now);
  t("a post whose maker blocked you doesn't open", (await get(`/api/posts/${post}/likers`, "tok-cat")).status === 403);
  db.prepare(`UPDATE posts SET extras = ? WHERE id = ?`).run(JSON.stringify({ hideLikes: true }), post);
  t("hidden likes: nobody else sees them", (await get(`/api/posts/${post}/likers`, "tok-ben")).status === 403);
  t("hidden likes: the maker and someone credited still do", (await get(`/api/posts/${post}/likers`, "tok-ana")).status === 200 && (await get(`/api/posts/${post}/likers`, "tok-dee")).status === 200);
  t("signed out is turned away", (await fetch(B + `/api/posts/${post}/likers`)).status === 401);

  const vr = await get(`/api/admin/events/${ev}/voters`, "tok-boss"), v = await vr.json();
  const a = v.entries.find((e) => e.author === "ana"), b = v.entries.find((e) => e.author === "ben");
  t("the admin sees who voted for each piece", vr.status === 200 && v.rounds === 3 && a.voters.map((x) => x.username).join(",") === "cat,dee" && b.voters[0].username === "boss");
  t("cat, back every day since day one, is a regular; dee isn't", a.voters[0].regular === true && a.voters[0].rounds === 3 && a.voters[1].regular === false && a.regulars === 1);
  t("boss, every day since a first vote on day two, is a regular", b.voters[0].regular === true);
  t("a missing photo shows", a.voters[0].photo === false);
  t("members can't see who voted, even for their own piece", (await get(`/api/admin/events/${ev}/voters`, "tok-ana")).status === 403);
} catch (e) { t("threw: " + e.message, false); }
srv.kill();
console.log(`\n${pass} passed, ${fail} failed`);
if (fail) { console.log(log.slice(-2000)); process.exit(1); }
