// Profile v2 (2026-10-07): links, pronouns, pinned posts, followers /
// following lists, the Tagged tab, "Followed by …".
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { mkdirSync, rmSync, readFileSync } from "node:fs";
const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const TMP = join(ROOT, "test", ".tmp", "profile-v2");
rmSync(TMP, { recursive: true, force: true });
mkdirSync(TMP, { recursive: true });
process.env.TNL_DATA = TMP;
const { db } = await import(ROOT + "/src/db.js");
let pass = 0, fail = 0;
const t = (n, ok) => { ok ? pass++ : fail++; console.log("  " + (ok ? "✓" : "✗") + "  " + n); };

const now = Date.now();
const U = (n, susp = 0) => Number(db.prepare(`INSERT INTO users (username,display_name,email,role,password_hash,email_verified,suspended,created_at) VALUES (?,?,?,?,?,1,?,?)`).run(n, n.toUpperCase(), n + "@x.com", "Model", "h", susp, now).lastInsertRowid);
const me = U("me"), amy = U("amy"), bob = U("bob"), cat = U("cat"), gone = U("gone", 1);
const follow = (a, b, at = now) => db.prepare(`INSERT INTO follows (follower_id,followee_id,created_at) VALUES (?,?,?)`).run(a, b, at);
const q = {
  userByName: db.prepare(`SELECT * FROM users WHERE username = ?`), userById: db.prepare(`SELECT * FROM users WHERE id = ?`),
  postById: db.prepare(`SELECT * FROM posts WHERE id = ?`), followExists: db.prepare(`SELECT 1 FROM follows WHERE follower_id = ? AND followee_id = ?`),
};
const blocks = new Set();
const routes = {};
const part = readFileSync(join(ROOT, "src/server-11-profile.js"), "utf8");
const P = new Function("db", "q", "app", "auth", "maybeAuth", "blockedIds", "feedRows", "shapePosts",
  part + "\nreturn {cleanLinks,profileExtras,followedBy};")(db, q,
  { get: (p, ...h) => { routes["GET " + p] = h.at(-1); }, post: (p, ...h) => { routes["POST " + p] = h.at(-1); } }, null, null,
  (id) => new Set([...blocks].filter((k) => k.startsWith(id + ":")).map((k) => k.split(":")[1])),
  ({ ids }) => ids.map((id) => ({ ...q.postById.get(id), author_username: q.userById.get(q.postById.get(id).author_id).username })),
  (rows) => rows.map((r) => ({ id: r.id, by: r.author_username })));
const call = async (key, { params = {}, user = null, body = {} } = {}) => { let out, code = 200;
  await routes[key]({ params, user: user && q.userById.get(user), body }, { json: (o) => (out = o), status: (s) => { code = s; return { json: (o) => (out = o) }; } });
  return { code, out }; };

console.log("\nLINKS");
const L = P.cleanLinks([{ title: "Spotify", url: "open.spotify.com/artist/x" }, { url: "javascript:alert(1)" }, { url: "data:text/html,x" },
  { url: "http://ok.com" }, { url: "nohost" }, { url: "a.co" }, { url: "b.co" }, { url: "c.co" }, { url: "d.co" }]);
t("https added; javascript:, data: and junk dropped", L[0].url === "https://open.spotify.com/artist/x" && !L.some((x) => /javascript|data:|nohost/.test(x.url)));
t("titles kept, at most 5", L[0].title === "Spotify" && L.length === 5);
t("an old single link still shows", P.profileExtras({ link: "tnllabs.com", links: "[]" }).links[0].url === "https://tnllabs.com/");
t("pronouns and pins shape cleanly", JSON.stringify(P.profileExtras({ pronouns: "she/her", links: "[]", pinned: '[3,"4",5,6]' })) === JSON.stringify({ pronouns: "she/her", links: [], pinned: [3, 4, 5] }));

console.log("\nFOLLOWERS / FOLLOWING");
follow(amy, me, now - 3); follow(bob, me, now - 2); follow(gone, me, now - 1); follow(me, amy); follow(me, bob);
let r = await call("GET /api/users/:username/followers", { params: { username: "me" }, user: amy });
t("newest first, suspended accounts hidden", r.out.people.map((x) => x.username).join() === "bob,amy");
t("says who you follow and who you are", r.out.people.find((x) => x.username === "amy").isYou && !r.out.people.find((x) => x.username === "bob").youFollow);
blocks.add(amy + ":bob");
r = await call("GET /api/users/:username/followers", { params: { username: "me" }, user: amy });
t("someone you've blocked isn't listed", !r.out.people.some((x) => x.username === "bob"));
r = await call("GET /api/users/:username/following", { params: { username: "me" } });
t("following works signed out", r.out.people.length === 2);
t("an unknown member → 404", (await call("GET /api/users/:username/following", { params: { username: "nope" } })).code === 404);

console.log("\nFOLLOWED BY");
follow(amy, cat); follow(bob, cat); follow(me, cat);
const fb = P.followedBy(me, cat);
t("people you follow who follow them", fb && fb.count === 2 && fb.names.length === 2 && fb.names.every((n) => ["amy", "bob"].includes(n)));
t("nothing on your own profile or signed out", P.followedBy(me, me) === null && P.followedBy(null, cat) === null);

console.log("\nPINS");
const post = (a) => Number(db.prepare(`INSERT INTO posts (author_id,channel,body,created_at) VALUES (?,?,?,?)`).run(a, "profile", "x", now).lastInsertRowid);
const [p1, p2, p3, p4] = [post(me), post(me), post(me), post(me)], theirs = post(amy);
for (const id of [p1, p2, p3]) await call("POST /api/me/pins", { user: me, body: { postId: id } });
t("newest pin first", JSON.parse(q.userById.get(me).pinned).join() === [p3, p2, p1].join());
t("a 4th is refused", (await call("POST /api/me/pins", { user: me, body: { postId: p4 } })).code === 400);
t("someone else's post can't be pinned", (await call("POST /api/me/pins", { user: me, body: { postId: theirs } })).code === 404);
r = await call("POST /api/me/pins", { user: me, body: { postId: p2, pin: false } });
t("unpin", r.out.pinned.join() === [p3, p1].join());
db.prepare(`DELETE FROM posts WHERE id = ?`).run(p1);
r = await call("POST /api/me/pins", { user: me, body: { postId: p4 } });
t("a deleted post drops out of the pins", r.out.pinned.join() === [p4, p3].join());

console.log("\nTAGGED");
const tagged = Number(db.prepare(`INSERT INTO posts (author_id,channel,body,extras,created_at) VALUES (?,?,?,?,?)`).run(amy, "profile", "with me", JSON.stringify({ tags: ["me", "bob"] }), now).lastInsertRowid);
db.prepare(`INSERT INTO posts (author_id,channel,body,extras,created_at) VALUES (?,?,?,?,?)`).run(bob, "profile", "not me", JSON.stringify({ tags: ["memento"] }), now);
r = await call("GET /api/users/:username/tagged", { params: { username: "me" } });
t("posts you're tagged in (exact name, not a prefix)", r.out.posts.length === 1 && r.out.posts[0].id === tagged);
r = await call("GET /api/users/:username/tagged", { params: { username: "me" }, user: bob });
t("hides authors you've blocked", r.out.posts.length === 1);
blocks.add(bob + ":amy");
r = await call("GET /api/users/:username/tagged", { params: { username: "me" }, user: bob });
t("…once blocked, gone", r.out.posts.length === 0);

console.log("\nWIRED IN");
const rt = readFileSync(join(ROOT, "src/server.runtime.js"), "utf8");
t("every user shape carries pronouns, links, pins", rt.includes("...profileExtras(u),"));
t("PATCH /api/me cleans links and pronouns", rt.includes("const ls = cleanLinks(links)") && rt.includes("next.pronouns ="));
t("profiles carry followedBy", rt.includes("followedBy: followedBy(req.user?.id, u.id)"));
console.log(`\n  ${pass} passed, ${fail} failed`);
