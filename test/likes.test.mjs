// POST /api/posts/:id/like — likes v2 (2026-09-29): the client sends the state
// it wants, so quick taps can't cross; the count comes back; rep moves once.
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { readFileSync } from "node:fs";
import { DatabaseSync } from "node:sqlite";
const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
let pass = 0, fail = 0;
const t = (n, ok) => { ok ? pass++ : fail++; console.log("  " + (ok ? "✓" : "✗") + "  " + n); };
const src = readFileSync(join(ROOT, "src/server.runtime.js"), "utf8");
const a = src.indexOf("const likeCountQ"), b = src.indexOf('app.post("/api/posts/:id/share"');

const db = new DatabaseSync(":memory:");
db.exec(`CREATE TABLE posts(id INTEGER PRIMARY KEY, author_id INTEGER);
  CREATE TABLE likes(post_id INTEGER, user_id INTEGER, created_at INTEGER, PRIMARY KEY(post_id, user_id));
  INSERT INTO posts VALUES (1, 7);`);
const q = {
  postById: db.prepare("SELECT * FROM posts WHERE id = ?"),
  like: db.prepare("INSERT OR IGNORE INTO likes (post_id, user_id, created_at) VALUES (?, ?, ?)"),
  unlike: db.prepare("DELETE FROM likes WHERE post_id = ? AND user_id = ?"),
  likeExists: db.prepare("SELECT 1 FROM likes WHERE post_id = ? AND user_id = ?"),
};
const rep = [], sent = [];
let h;
new Function("app", "db", "q", "auth", "verified", "awardRep", "revokeRep", "notify", "broadcast", src.slice(a, b))(
  { post: (p, _a, _v, fn) => { h = fn; } }, db, q, null, null,
  (u, k) => rep.push("+" + k), (u, k) => rep.push("-" + k), () => {}, (e, d) => sent.push([e, d]));
const call = (userId, body) => { let out; h({ params: { id: "1" }, user: { id: userId }, body }, { json: (o) => (out = o), status: () => ({ json: (o) => (out = o) }) }); return out; };

console.log("\nLIKES");
t("route found in the built server", a > 0 && b > a && typeof h === "function");
let r = call(2, { liked: true });
t("like → liked, count 1", r.liked === true && r.likeCount === 1);
t("author earns rep once", rep.join() === "+like_received");
r = call(2, { liked: true });
t("same state again is a no-op (two quick taps can't double-like)", r.liked === true && r.likeCount === 1 && rep.length === 1);
t("no broadcast when nothing changed", sent.length === 1);
t("broadcast carries only the post and the new count", JSON.stringify(sent[0]) === JSON.stringify(["like", { postId: 1, likeCount: 1 }]));
r = call(3, { liked: true });
t("second person → count 2", r.likeCount === 2);
r = call(2, { liked: false });
t("unlike → not liked, count 1, rep taken back", r.liked === false && r.likeCount === 1 && rep.at(-1) === "-like_received");
r = call(2, { liked: false });
t("unlike again is a no-op", r.likeCount === 1 && rep.length === 3);
r = call(2);
t("no body still toggles (older clients)", r.liked === true && r.likeCount === 2);
r = call(7, { liked: true });
t("liking your own work earns no rep", r.likeCount === 3 && rep.length === 4);

const app = readFileSync(join(ROOT, "public/index.html"), "utf8");
console.log("\nTHE BUTTON");
t("client sends the state it wants", app.includes('body:typeof liked==="boolean"?{liked}:undefined'));
t("someone else's like updates the number in place — no feed reload", app.includes('on("like",d=>') && !/\["like","collab-invite"/.test(app));
console.log(`\n  ${pass} passed, ${fail} failed`);
