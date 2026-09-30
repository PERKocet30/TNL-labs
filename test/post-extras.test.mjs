// Post extras (2026-09-30): people tagged, a place, comments off.
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { mkdirSync, rmSync, readFileSync } from "node:fs";
const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const TMP = join(ROOT, "test", ".tmp", "post-extras");
rmSync(TMP, { recursive: true, force: true });
mkdirSync(TMP, { recursive: true });
process.env.TNL_DATA = TMP;
const { db } = await import(ROOT + "/src/db.js");
let pass = 0, fail = 0;
const t = (n, ok) => { ok ? pass++ : fail++; console.log("  " + (ok ? "✓" : "✗") + "  " + n); };

const now = Date.now();
const U = (n, extra = "") => Number(db.prepare(`INSERT INTO users (username,display_name,email,role,password_hash,email_verified,created_at${extra ? ",suspended" : ""}) VALUES (?,?,?,?,?,1,?${extra ? ",1" : ""})`)
  .run(n, n, n + "@x.com", "Model", "h", now).lastInsertRowid);
const me = U("me"), amy = U("amy"), bob = U("bob"), gone = U("gone", "s"), blocker = U("blocker");
const q = { userByName: db.prepare(`SELECT * FROM users WHERE username = ?`), postById: db.prepare(`SELECT * FROM posts WHERE id = ?`) };
const blocks = new Set([blocker + ":" + me]);
const told = [], routes = {};
const part = readFileSync(join(ROOT, "src/server-02-post-extras.js"), "utf8");
const X = new Function("db", "q", "isBlocked", "notify", "app", "auth",
  part + "\nreturn {postExtras,cleanExtras,applyExtras,commentsOff};")(db, q,
  (a, b) => blocks.has(a + ":" + b) || blocks.has(b + ":" + a), (...a) => told.push(a),
  { post: (path, _a, fn) => { routes[path] = fn; } }, null);
const post = () => Number(db.prepare(`INSERT INTO posts (author_id,channel,body,created_at) VALUES (?,?,?,?)`).run(me, "profile", "hi", now).lastInsertRowid);

console.log("\nTAGS");
const c = X.cleanExtras({ tags: ["amy", "@Bob", "amy", "me", "nobody", "gone", "blocker"], location: "  Brooklyn,   NY  ", commentsOff: true }, me);
const x = JSON.parse(c.extras);
t("real members only, once each, @ and case forgiven", x.tags.join() === "amy,bob");
t("not yourself, not suspended, not across a block", !x.tags.includes("me") && !x.tags.includes("gone") && !x.tags.includes("blocker"));
t("place tidied", x.location === "Brooklyn, NY");
t("comments off only when asked with true", x.commentsOff === true && !JSON.parse(X.cleanExtras({ location: "x", commentsOff: "yes" }, me).extras).commentsOff);
t("nothing asked → nothing stored", X.cleanExtras({}, me).extras === null);
t("at most 20 tags looked at", X.cleanExtras({ tags: Array(50).fill("amy") }, me).tagIds.length === 1);

console.log("\nON A POST");
const pid = post();
X.applyExtras(pid, { tags: ["amy", "bob"], location: "Studio B", commentsOff: true }, me);
const row = q.postById.get(pid), shaped = X.postExtras(row);
t("saved and shaped", shaped.tags.join() === "amy,bob" && shaped.location === "Studio B" && shaped.commentsOff === true);
t("each tagged person is told, once", told.filter((a) => a[2] === "tag" && a[3] === pid).map((a) => a[0]).sort().join() === [amy, bob].sort().join());
t("commentsOff() reads the row", X.commentsOff(row) === true);
t("an old post (no extras) shapes clean", JSON.stringify(X.postExtras({})) === JSON.stringify({ tags: [], location: "", commentsOff: false, products: [] }));
t("junk in the column doesn't throw", X.postExtras({ extras: "{nope" }).tags.length === 0);

console.log("\nSHOPPABLE POSTS");
const Lst = (sid, title, status = "active") => Number(db.prepare(`INSERT INTO listings (seller_id,title,price_cents,images,status,created_at,updated_at) VALUES (?,?,?,?,?,?,?)`)
  .run(sid, title, 4000, '["/uploads/t.jpg"]', status, now, now).lastInsertRowid);
const mineA = Lst(me, "Tee"), mineB = Lst(me, "Cap"), gone2 = Lst(me, "Old", "removed"), theirs = Lst(amy, "Amy's");
const px = JSON.parse(X.cleanExtras({ products: [mineA, String(mineB), mineA, theirs, gone2, 99999, "x"] }, me).extras).products;
t("only your own, for-sale listings, once each", px.join() === [mineA, mineB].join());
t("at most 5", JSON.parse(X.cleanExtras({ products: [mineA, mineB, Lst(me, "3"), Lst(me, "4"), Lst(me, "5"), Lst(me, "6")] }, me).extras).products.length === 5);
const pp = X.postExtras({ extras: JSON.stringify({ products: [mineA, mineB] }) }).products;
t("shaped with title, live price and first photo", pp[0].title === "Tee" && pp[0].price === 4000 && pp[0].image === "/uploads/t.jpg" && pp[0].sold === false);
db.prepare(`UPDATE listings SET status='sold' WHERE id=?`).run(mineB);
db.prepare(`UPDATE listings SET status='removed' WHERE id=?`).run(mineA);
const pp2 = X.postExtras({ extras: JSON.stringify({ products: [mineA, mineB] }) }).products;
t("a sold one says sold; a deleted one disappears", pp2.length === 1 && pp2[0].id === mineB && pp2[0].sold === true);

console.log("\nCOMMENTS ON / OFF LATER");
const call = (userId, body) => { let out, code = 200; routes["/api/posts/:id/comments-off"]({ params: { id: String(pid) }, user: { id: userId }, body },
  { json: (o) => (out = o), status: (s) => { code = s; return { json: (o) => (out = o) }; } }); return { code, out }; };
t("someone else can't switch them", call(amy, { off: false }).code === 403);
t("the author can turn them back on", call(me, { off: false }).out.commentsOff === false && !X.commentsOff(q.postById.get(pid)));
t("…and the tags and place survive", X.postExtras(q.postById.get(pid)).tags.length === 2 && X.postExtras(q.postById.get(pid)).location === "Studio B");

console.log("\nWIRED IN");
const rt = readFileSync(join(ROOT, "src/server.runtime.js"), "utf8");
t("new posts save their extras", rt.includes("applyExtras(Number(info.lastInsertRowid), req.body, req.user.id)"));
t("the comment route refuses when they're off", /if \(commentsOff\(post\)\) return res\.status\(403\)/.test(rt));
t("every shaped post carries them", rt.includes("...postExtras(row),") && rt.includes("p.link_json, p.extras,"));
console.log(`\n  ${pass} passed, ${fail} failed`);
