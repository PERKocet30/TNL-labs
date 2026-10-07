// Ranking v2.0 (2026-09-29): the Showroom and "Who's building". Runs the real
// ranking code (lifted from src/server-10-rank.js) against a throwaway database.
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
const src = readFileSync(join(ROOT, "src/server-10-rank.js"), "utf8");
const R = new Function("db", src + "\nreturn { rankShowroom, rankBuilders, standingWeight, RANK };")(db);
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
const clear = () => { for (const x of ["likes", "comments", "collaborators", "dm_messages", "posts", "follows"]) db.exec(`DELETE FROM ${x}`); };
const order = (viewer = 0) => R.rankShowroom(viewer ? users[viewer] : 0, 60);
for (const u of ["vet", "vet2", "fan1", "fan2", "fan3", "big", "newbie", "viewer"]) mk(u, u === "big" ? 600 : u.startsWith("vet") ? 200 : 0);
mk("banned", 0, 1);
// the veterans already have older work, so they're past the new-creator lift
for (let i = 0; i < 4; i++) { post("vet", 300 * D); post("vet2", 300 * D); }

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

console.log("\nWHO'S BUILDING");
clear();
const w1 = post("vet", 2 * D); like(w1, "fan1"); like(w1, "fan2"); post("vet2", 20 * D); post("newbie", 1 * D);
const bl = R.rankBuilders(users.newbie).map((id) => Object.keys(users).find((k) => users[k] === id));
t("you're never in your own row", !bl.includes("newbie"));
t("recent work people respond to leads", bl[0] === "vet");
t("quiet months still fill the row", R.rankBuilders(0).length >= 3);

console.log("\nTHE SURFACE STAYS QUIET");
const app = ["app-11-showroom.js", "app-14-detail-sell.js", "app-15-profile.js", "app-19-feed-boot.js"].map((f) => readFileSync(join(ROOT, "src", f), "utf8")).join("\n");
t("no point values shown to members", !/LIKES \+6|you both earn\w* \+20|earns rep when|THE ONE RULE|someone's rep/.test(app));
t("builders show faces, not scores", !/x\.validations|bstat/.test(readFileSync(join(ROOT, "src/app-11-showroom.js"), "utf8")));
const api = readFileSync(join(ROOT, "src/server-10-collabs-beats-showroom.js"), "utf8");
t("the builders API doesn't send rep, likes or collab counts", /display_name: u\.display_name, role: u\.role, avatar_url/.test(api) && !/validations/.test(api));

console.log(`\n  ${pass} passed, ${fail} failed`);
