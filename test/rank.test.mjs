// Ranking v3.0 (2026-11-03; v2.0 2026-09-29): the Showroom and "Who's building". Runs the real
// ranking code (lifted from src/server/posts/rank.js) against a throwaway database.
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { mkdirSync, rmSync, readFileSync } from "node:fs";
const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const DATA = join(ROOT, "test/.tmp/rank");
rmSync(DATA, { recursive: true, force: true }); mkdirSync(DATA, { recursive: true });
process.env.TNL_DATA = DATA;
let pass = 0, fail = 0;
const t = (n, ok) => { ok ? pass++ : fail++; console.log("  " + (ok ? "✓" : "✗") + "  " + n); };

const { db } = await import("../src/db.js");
for (const c of ["post_id INTEGER", "deleted_at INTEGER"]) try { db.exec(`ALTER TABLE dm_messages ADD COLUMN ${c}`); } catch {}
db.exec(`CREATE TABLE IF NOT EXISTS reactions (kind TEXT, target_id INTEGER, user_id INTEGER, emoji TEXT, created_at INTEGER, PRIMARY KEY (kind, target_id, user_id))`);
db.exec(`CREATE TABLE IF NOT EXISTS post_views (post_id INTEGER NOT NULL, viewer TEXT NOT NULL, day INTEGER NOT NULL, PRIMARY KEY (post_id, viewer, day))`);
const src = readFileSync(join(ROOT, "src/server/posts/rank.js"), "utf8");
/* the lab maps the server has (server/labs/places.js), as the ranking sees them */
const places = readFileSync(join(ROOT, "src/server/labs/places.js"), "utf8");
const { LAB_OF, ROLE_LABS } = new Function(places.slice(places.indexOf("const PLACES = {"), places.indexOf("};", places.indexOf("const ROLE_LABS = {")) + 2) + "\nreturn { LAB_OF, ROLE_LABS };")();
const R = new Function("db", "LAB_OF", "ROLE_LABS", src + "\nreturn { rankShowroom, rankBuilders, standingWeight, RANK, rankTagLift, freshRep, labAffinity };")(db, LAB_OF, ROLE_LABS);
const now = Date.now(), H = 3600000, D = 24 * H;
const users = {};
const mk = (u, rep = 0, suspended = 0) => (users[u] = Number(db.prepare(`INSERT INTO users (username, display_name, email, password_hash, rep, suspended, created_at) VALUES (?,?,?,?,?,?,?)`)
  .run(u, u, u + "@x.test", "x", rep, suspended, now - 200 * D).lastInsertRowid));
const post = (who, ago, work = 1) => Number(db.prepare(`INSERT INTO posts (author_id, channel, body, is_work, created_at) VALUES (?,?,?,?,?)`).run(users[who], "general", who, work, now - ago).lastInsertRowid);
const like = (p, who) => db.prepare(`INSERT OR IGNORE INTO likes (post_id, user_id, created_at) VALUES (?,?,?)`).run(p, users[who], now);
const comment = (p, who) => db.prepare(`INSERT INTO comments (post_id, author_id, body, created_at) VALUES (?,?,?,?)`).run(p, users[who], "nice", now);
const collab = (p, who) => db.prepare(`INSERT INTO collaborators (post_id, user_id, status, created_at) VALUES (?,?,'accepted',?)`).run(p, users[who], now);
let tid = 0;
const thread = () => tid || (tid = Number(db.prepare(`INSERT INTO dm_threads (a_id, b_id, updated_at, created_at) VALUES (?,?,?,?)`).run(users.fan1, users.fan2, now, now).lastInsertRowid));
const send = (p, who, deleted = null) => db.prepare(`INSERT INTO dm_messages (thread_id, sender_id, body, post_id, deleted_at, created_at) VALUES (?,?,'',?,?,?)`).run(thread(), users[who], p, deleted, now);
const clear = () => { for (const x of ["likes", "comments", "collaborators", "dm_messages", "posts", "follows", "post_views", "rep_events"]) db.exec(`DELETE FROM ${x}`); };
const postIn = (who, ago, channel) => Number(db.prepare(`INSERT INTO posts (author_id, channel, body, is_work, created_at) VALUES (?,?,?,?,?)`).run(users[who], channel, who, 1, now - ago).lastInsertRowid);
const day = Math.floor(now / 86400000);
const view = (p, who, d = 0) => db.prepare(`INSERT OR IGNORE INTO post_views (post_id, viewer, day) VALUES (?,?,?)`).run(p, typeof who === "string" && !(who in users) ? who : "u:" + users[who], day - d);
const repAt = (who, amount, ago) => db.prepare(`INSERT INTO rep_events (user_id, kind, amount, source_id, created_at) VALUES (?,?,?,?,?)`).run(users[who], "like_received", amount, 0, now - ago);
const order = (viewer = 0) => R.rankShowroom(viewer ? users[viewer] : 0, 60);
for (const u of ["vet", "vet2", "fan1", "fan2", "fan3", "big", "newbie", "viewer"]) mk(u, u === "big" ? 600 : u.startsWith("vet") ? 200 : 0);
mk("banned", 0, 1);
// the veterans already have older work, so they're past the new-creator lift
for (let i = 0; i < 4; i++) { post("vet", 300 * D); post("vet2", 300 * D); }

const postB = (who, ago, body) => Number(db.prepare(`INSERT INTO posts (author_id, channel, body, is_work, created_at) VALUES (?,?,?,?,?)`).run(users[who], "general", body, 1, now - ago).lastInsertRowid);

console.log("\n#HASHTAGS LIFT A PIECE (v2.1, 2026-10-29)");
clear(); for (let i = 0; i < 4; i++) { post("vet", 300 * D); post("vet2", 300 * D); }
let tg = postB("vet", 5 * H, "new poster #graphicdesign #poster"), un = postB("vet2", 5 * H, "new poster");
t("a piece with #hashtags sits above the same piece without", order().indexOf(tg) < order().indexOf(un));
t("a little for each tag, up to three", R.rankTagLift("#a1 #b2") === 2 * R.RANK.tagLift && R.rankTagLift("#a1 #b2 #c3 #d4 #e5") === 3 * R.RANK.tagLift);
t("the same tag twice counts once; tags inside a link don't count", R.rankTagLift("#art #ART https://x.co/#nope") === R.RANK.tagLift);
t("stuffing a caption with tags earns nothing", R.rankTagLift(Array.from({ length: 11 }, (_, i) => "#tag" + i).join(" ")) === 0);
like(un, "fan1"); like(un, "fan2");
t("…and two people responding still beat three tags — the work has to land", order().indexOf(un) < order().indexOf(tg));

console.log("\nONLY OTHER PEOPLE COUNT");
clear(); for (let i = 0; i < 4; i++) { post("vet", 300 * D); post("vet2", 300 * D); }
let a = post("vet", 5 * H), b = post("vet2", 5 * H);
like(a, "vet"); comment(a, "vet"); comment(a, "vet");
t("your own likes and comments on your work move nothing", Math.abs(order().indexOf(a) - order().indexOf(b)) <= 1 && R.standingWeight(0) === 1);
like(b, "fan1");
t("one like from someone else does", order().indexOf(b) < order().indexOf(a));

console.log("\nSENDS SAY THE MOST");
clear(); for (let i = 0; i < 4; i++) { post("vet", 300 * D); post("vet2", 300 * D); }
a = post("vet", 4 * H); b = post("vet2", 5 * H);
like(a, "fan1"); like(b, "fan2"); send(b, "fan2");
t("sending a piece to someone counts on top of liking it", order().indexOf(b) < order().indexOf(a));
clear(); for (let i = 0; i < 4; i++) { post("vet", 300 * D); post("vet2", 300 * D); }
a = post("vet", 5 * H); b = post("vet2", 5 * H);
comment(a, "fan1"); send(b, "fan2");
t("…and a little more than a comment", order().indexOf(b) < order().indexOf(a));
clear(); for (let i = 0; i < 4; i++) { post("vet", 300 * D); post("vet2", 300 * D); }
a = post("vet", 5 * H); b = post("vet2", 5 * H);
send(a, "fan2"); send(a, "fan2"); send(a, "fan2"); send(b, "fan1"); like(b, "fan3");
t("sending it again and again is still one person", order().indexOf(b) < order().indexOf(a));
clear(); for (let i = 0; i < 4; i++) { post("vet", 300 * D); post("vet2", 300 * D); }
a = post("vet", 5 * H); b = post("vet2", 5 * H);
send(a, "vet"); send(b, "fan1", now);
t("sending your own work, or an unsent message, moves nothing", Math.abs(order().indexOf(a) - order().indexOf(b)) <= 1);

console.log("\nSTANDING WEIGHS — A LITTLE, AND CAPPED");
t("a response from someone established counts more", R.standingWeight(600) > R.standingWeight(0));
t("…but never more than 2.5 people", R.standingWeight(1e9) === 2.5);
clear(); for (let i = 0; i < 4; i++) { post("vet", 300 * D); post("vet2", 300 * D); }
a = post("vet", 5 * H); b = post("vet2", 5 * H);
like(a, "big"); like(b, "fan1"); like(b, "fan2"); like(b, "fan3");
t("three ordinary people beat one big name", order().indexOf(b) < order().indexOf(a));

console.log("\nFRESH, THEN GOOD");
clear(); for (let i = 0; i < 4; i++) { post("vet", 300 * D); post("vet2", 300 * D); }
a = post("vet", 30 * H); b = post("vet2", 2 * H);
t("same response, newer first", order().indexOf(b) < order().indexOf(a));
const old = post("vet", 4 * D); like(old, "fan1"); like(old, "fan2");
const fresh = post("vet2", 3 * H); like(fresh, "fan3");
t("a strong post fades over days", order().indexOf(fresh) < order().indexOf(old));

console.log("\nCOLLABS LIFT, THEY DON'T DOMINATE");
clear(); for (let i = 0; i < 4; i++) { post("vet", 300 * D); post("vet2", 300 * D); }
a = post("vet", 6 * H); b = post("vet2", 6 * H); collab(a, "fan1");
t("work made together sits above the same work alone", order().indexOf(a) < order().indexOf(b));
const c3 = post("vet", 3 * D); collab(c3, "fan2");
const f2 = post("vet2", 4 * H); like(f2, "fan3"); like(f2, "fan1");
t("…but a days-old collab doesn't sit on top of fresh, liked work", order().indexOf(f2) < order().indexOf(c3));

console.log("\nNEW PEOPLE GET SEEN");
clear(); for (let i = 0; i < 4; i++) { post("vet", 300 * D); post("vet2", 300 * D); }
a = post("newbie", 8 * H); b = post("vet", 8 * H);
t("someone's first piece gets a start", order().indexOf(a) < order().indexOf(b));

console.log("\nVARIETY");
clear();
const vets = []; for (let i = 0; i < 6; i++) { const p = post("vet", (i + 1) * H); like(p, "fan1"); like(p, "fan2"); vets.push(p); }
for (let i = 0; i < 3; i++) { const p = post("vet2", (i + 2) * H); like(p, "fan3"); }
const top4 = order().slice(0, 4).map((id) => db.prepare(`SELECT author_id FROM posts WHERE id = ?`).get(id).author_id);
t("one busy person doesn't fill the top of the page", top4.filter((x) => x === users.vet).length <= 2);
t("everyone's work still appears", order().length === 9);

console.log("\nFOR YOU");
clear(); for (let i = 0; i < 4; i++) { post("vet", 300 * D); post("vet2", 300 * D); }
a = post("vet", 5 * H); b = post("vet2", 5 * H);
db.prepare(`INSERT INTO follows (follower_id, followee_id, created_at) VALUES (?,?,?)`).run(users.viewer, users.vet2, now);
t("people you follow come up a little", order("viewer").indexOf(b) < order("viewer").indexOf(a));
db.exec(`DELETE FROM follows`); like(b, "viewer");
t("work you've already liked steps back for you", order("viewer").indexOf(a) < order("viewer").indexOf(b));
t("…not for everyone else", order().indexOf(b) < order().indexOf(a));
const banned = post("banned", 1 * H);
t("suspended accounts don't appear", !order().includes(banned));

console.log("\nVIEWS ARE A SIGNAL (v3.0, 2026-11-03)");
clear(); for (let i = 0; i < 4; i++) { post("vet", 300 * D); post("vet2", 300 * D); }
a = post("vet", 5 * H); b = post("vet2", 5 * H);
like(a, "fan1"); like(b, "fan1");
for (let i = 0; i < 60; i++) view(a, "d:" + i.toString(16).padStart(16, "0"));
t("one like out of sixty views is quieter than one like out of a few", order().indexOf(b) < order().indexOf(a));
for (let i = 0; i < 60; i++) view(a, "u:" + users.vet);
for (let i = 0; i < 60; i++) view(b, "u:" + users.vet2, i);
t("the author looking at their own piece, even sixty days running, is not a view", order().indexOf(b) < order().indexOf(a));
clear(); for (let i = 0; i < 4; i++) { post("vet", 300 * D); post("vet2", 300 * D); }
a = post("vet", 5 * H); b = post("vet2", 5 * H); like(a, "fan1"); like(b, "fan1");
t("a piece a few people have seen is judged as if twenty had: no edge over one nobody saw", Math.abs(order().indexOf(a) - order().indexOf(b)) <= 1);
view(b, "viewer", 0); view(b, "viewer", 1);
t("a piece you looked at on two days and left steps back for you", order("viewer").indexOf(a) < order("viewer").indexOf(b));
t("…not for everyone else", Math.abs(order().indexOf(a) - order().indexOf(b)) <= 1);
clear(); for (let i = 0; i < 4; i++) { post("vet", 300 * D); post("vet2", 300 * D); }
a = post("vet", 5 * H); b = post("vet2", 5 * H); like(a, "fan1"); like(b, "fan1"); view(b, "viewer", 0);
t("one look is not two: a piece seen once stays where it was", Math.abs(order("viewer").indexOf(a) - order("viewer").indexOf(b)) <= 1);

console.log("\nYOUR LABS LEAN (v3.0)");
clear(); for (let i = 0; i < 4; i++) { post("vet", 300 * D); post("vet2", 300 * D); }
const fit = postIn("vet", 5 * H, "clothing-design"), vis = postIn("vet2", 5 * H, "creators");
t("signed out, no lean at all", Object.keys(R.labAffinity(0)).length === 0);
db.prepare(`UPDATE users SET roles = ? WHERE id = ?`).run(JSON.stringify(["Fashion Designer"]), users.viewer);
t("a fashion designer's labs: Fashion, and only Fashion, above 1", R.labAffinity(users.viewer).fashion > 1 && R.labAffinity(users.viewer).pharmacy === undefined);
t("…so a fashion piece comes up for them; for someone with no lean the two sit together", order("viewer").indexOf(fit) < order("viewer").indexOf(vis) && Math.abs(order("fan1").indexOf(fit) - order("fan1").indexOf(vis)) <= 1);
like(vis, "fan2");
t("a lean is never a wall: one person liking the other piece still beats it", order("viewer").indexOf(vis) < order("viewer").indexOf(fit));
t("…at most 1 + labBoost, and a lab you have nothing to do with stays at 1", R.labAffinity(users.viewer).fashion <= 1 + R.RANK.labBoost + 1e-9 && (R.labAffinity(users.viewer).culture || 1) === 1);
const mus = postIn("vet", 6 * H, "beats");
db.prepare(`UPDATE users SET roles = '[]' WHERE id = ?`).run(users.viewer);
for (let i = 0; i < 5; i++) { const p = postIn("vet2", 40 * H + i * H, "creators"); like(p, "viewer"); }
t("what you've responded to lately counts even with no role: five visual likes → Visual leans", R.labAffinity(users.viewer).pharmacy > 1 && !R.labAffinity(users.viewer).culture);
view(mus, "viewer");
t("…and so does what you've looked at", R.labAffinity(users.viewer).culture > 1);
t("a role we don't know, or a profile post, changes nothing", (db.prepare(`UPDATE users SET roles = ? WHERE id = ?`).run(JSON.stringify(["Astronaut"]), users.fan3), Object.keys(R.labAffinity(users.fan3)).length === 0));

console.log("\nGRAVITY BY LAB (v3.0)");
clear(); for (let i = 0; i < 4; i++) { post("vet", 300 * D); post("vet2", 300 * D); }
const m2 = postIn("vet", 2 * D, "beats"), n2 = postIn("vet2", 2 * D, "news");
like(m2, "fan1"); like(n2, "fan1");
t("music keeps longer than a news post of the same age and response", order().indexOf(m2) < order().indexOf(n2));
t("each lab has its own gravity (lower keeps longer); the rest use the default", R.RANK.gravityByLab.culture < R.RANK.gravity && R.RANK.gravityByLab.casino > R.RANK.gravity && R.RANK.gravityByLab.hq === undefined);
const m0 = postIn("vet", 0, "beats"), n0 = postIn("vet2", 0, "news"); like(m0, "fan2"); like(n0, "fan2");
t("…but every lab starts at the same height: brand new, music and news sit together", Math.abs(order().indexOf(m0) - order().indexOf(n0)) <= 1);

console.log("\nA CLIQUE CAN'T CARRY A PIECE (v3.0)");
clear(); for (let i = 0; i < 4; i++) { post("vet", 300 * D); post("vet2", 300 * D); }
const cl = []; for (let i = 0; i < 4; i++) { const p = post("vet", 5 * H + i * H); like(p, "fan1"); cl.push(p); }
const solo = post("vet2", 5 * H); like(solo, "fan2");
t("one person liking every piece of one author counts at half on each", order().indexOf(solo) < order().indexOf(cl[0]));
clear(); for (let i = 0; i < 4; i++) { post("vet", 300 * D); post("vet2", 300 * D); }
a = post("vet", 5 * H); b = post("vet2", 5 * H); like(a, "fan1"); like(b, "fan2");
t("one like on one piece is not a clique", Math.abs(order().indexOf(a) - order().indexOf(b)) <= 1);

console.log("\nSTANDING FADES, GENTLY (v3.0)");
clear(); for (let i = 0; i < 4; i++) { post("vet", 300 * D); post("vet2", 300 * D); }
repAt("fan1", 100, 10 * D); repAt("fan2", 100, 400 * D);
t("rep earned this year counts in full; a year-old point counts half", R.freshRep([users.fan1]).get(users.fan1) === 100 && R.freshRep([users.fan2]).get(users.fan2) === 50);
t("someone with no log keeps the rep on their profile", !R.freshRep([users.vet]).has(users.vet));
a = post("vet", 5 * H); b = post("vet2", 5 * H); like(a, "fan2"); like(b, "fan1");
t("the same standing, earned lately, weighs more", order().indexOf(b) < order().indexOf(a));
t("levels and fees never read this: users.rep is untouched", db.prepare(`SELECT rep FROM users WHERE id = ?`).get(users.fan2).rep === 0);

console.log("\nWHO'S BUILDING");
clear();
const w1 = post("vet", 2 * D); like(w1, "fan1"); like(w1, "fan2"); post("vet2", 20 * D); post("newbie", 1 * D);
const bl = R.rankBuilders(users.newbie).map((id) => Object.keys(users).find((k) => users[k] === id));
t("you're never in your own row", !bl.includes("newbie"));
t("recent work people respond to leads", bl[0] === "vet");
t("quiet months still fill the row", R.rankBuilders(0).length >= 3);

console.log("\nPLACED WORK RISES (v3.1, 2026-11-05)");
{
  clear();
  const both = Number(db.prepare(`INSERT INTO posts (author_id, channel, body, is_work, created_at) VALUES (?,?,?,?,?)`).run(users.vet, "creators", "train #collage", 1, now - 2 * H).lastInsertRowid);
  const lab = Number(db.prepare(`INSERT INTO posts (author_id, channel, body, is_work, created_at) VALUES (?,?,?,?,?)`).run(users.vet2, "creators", "train", 1, now - 2 * H).lastInsertRowid);
  const tag = Number(db.prepare(`INSERT INTO posts (author_id, channel, body, is_work, created_at) VALUES (?,?,?,?,?)`).run(users.big, "profile", "train #collage", 1, now - 2 * H).lastInsertRowid);
  const none = Number(db.prepare(`INSERT INTO posts (author_id, channel, body, is_work, created_at) VALUES (?,?,?,?,?)`).run(users.fan3, "profile", "train", 1, now - 2 * H).lastInsertRowid);
  const o = order();
  t("in a lab AND #tagged comes first", o[0] === both);
  t("a lab alone or a #tag alone sits above neither", o.indexOf(lab) < o.indexOf(none) && o.indexOf(tag) < o.indexOf(none));
  t("profile only, no #tag, comes last — but it's still there (a lift, not a wall)", o.indexOf(none) === o.length - 1 && o.includes(none));
  t("tag stuffing doesn't count as tagged", R.rankTagLift("#a1 #b2 #c3 #d4 #e5 #f6 #g7 #h8 #i9 #j10 #k11") === 0);
  for (const f of ["fan1", "fan2", "vet", "big", "newbie"]) like(none, f);
  comment(none, "fan1"); comment(none, "fan2");
  t("strong work that skipped both can still reach the top", order()[0] === none);
  t("the numbers live in RANK", R.RANK.placedHalf > R.RANK.unplaced && R.RANK.placedHalf < 1 && R.RANK.unplaced > 0);
}

console.log("\nTHE SURFACE STAYS QUIET");
const app = ["app/showroom/showroom.js", "app/market/detail-sell.js", "app/profile/profile.js", "app/feed/feed-boot.js"].map((f) => readFileSync(join(ROOT, "src", f), "utf8")).join("\n");
t("no point values shown to members", !/LIKES \+6|you both earn\w* \+20|earns rep when|THE ONE RULE|someone's rep/.test(app));
t("builders show faces, not scores", !/x\.validations|bstat/.test(readFileSync(join(ROOT, "src/app/showroom/showroom.js"), "utf8")));
const api = readFileSync(join(ROOT, "src/server/posts/collabs-showroom.js"), "utf8");
t("the builders API doesn't send rep, likes or collab counts", /display_name: u\.display_name, role: u\.role, avatar_url/.test(api) && !/validations/.test(api));

console.log(`\n  ${pass} passed, ${fail} failed`);
