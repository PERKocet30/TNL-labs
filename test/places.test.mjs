// Places v1.1 (2026-10-09): labs are places — one per genre — with Work
// and Talk, and #hashtags instead of sub-channels; each genre is explained
// on the labs list by its #tags. Runs the real
// server. Old posts keep their channel as a tag; nothing is rewritten.
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { mkdirSync, rmSync, readFileSync, writeFileSync } from "node:fs";
import { spawn } from "node:child_process";
const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const DATA = join(ROOT, "test/.tmp/places");
rmSync(DATA, { recursive: true, force: true }); mkdirSync(join(DATA, "uploads"), { recursive: true });
process.env.TNL_DATA = DATA;
let pass = 0, fail = 0;
const t = (n, ok) => { ok ? pass++ : fail++; console.log("  " + (ok ? "✓" : "✗") + "  " + n); };

// the app's labs, as the app defines them
const app07 = readFileSync(join(ROOT, "src/app-07-theme-labs-api.js"), "utf8");
const appPlaces = readFileSync(join(ROOT, "src/app-11-places.js"), "utf8");
const LABS = new Function(app07.slice(app07.indexOf("const LABS = ["), app07.indexOf("];", app07.indexOf("const LABS = [")) + 2) + "\nreturn LABS;")();
const LAB_HOME = new Function(appPlaces.slice(appPlaces.indexOf("const LAB_HOME="), appPlaces.indexOf(";", appPlaces.indexOf("const LAB_HOME=")) + 1) + "\nreturn LAB_HOME;")();

const { db } = await import("../src/db.js");
const now = Date.now(), D = 86400000, H = 3600000;
const mk = (u) => { const id = Number(db.prepare(`INSERT INTO users (username, display_name, email, password_hash, created_at, email_verified) VALUES (?,?,?,?,?,1)`).run(u, u.toUpperCase(), u + "@x.test", "x", now - 60 * D).lastInsertRowid);
  db.prepare(`INSERT INTO sessions (token, user_id, created_at) VALUES (?,?,?)`).run("tok-" + u, id, now); return id; };
const ana = mk("ana"), ben = mk("ben"), cam = mk("cam"); mk("dee");
const post = (author, channel, body, { work = 0, ago = 0, img = null } = {}) => Number(db.prepare(
  `INSERT INTO posts (author_id, channel, body, is_work, image_url, created_at) VALUES (?,?,?,?,?,?)`).run(author, channel, body, work, img, now - ago).lastInsertRowid);
writeFileSync(join(DATA, "uploads", "a.jpg"), "x");
// before this version: posts in the old sub-channels
const oldPhoto = post(ana, "photography", "golden hour", { work: 1, ago: 3 * D, img: "/uploads/a.jpg" });
const oldGd = post(ben, "graphic-design", "new poster #poster", { work: 1, ago: 2 * D, img: "/uploads/a.jpg" });
const oldTalk = post(cam, "creators", "hey all", { ago: 2 * D });
const oldCollab = post(ben, "collab-posts", "need a photographer for a shoot", { ago: 5 * D });
const oldFeedback = post(cam, "feedback", "thoughts on this mix?", { ago: 20 * D });
const tricky = post(cam, "creators", "see https://x.com/#frag and it&#39;s fine #ok_tag #a", { ago: 1 * D });
for (const u of [ben, cam]) db.prepare(`INSERT INTO likes (post_id, user_id, created_at) VALUES (?,?,?)`).run(oldGd, u, now - D);
db.close();

const PORT = 18900 + (process.pid % 90);
const srv = spawn(process.execPath, ["--experimental-sqlite", "src/server.js"], { cwd: ROOT, env: { ...process.env, PORT: String(PORT), TNL_DATA: DATA }, stdio: ["ignore", "pipe", "pipe"] });
let log = ""; srv.stdout.on("data", (d) => log += d); srv.stderr.on("data", (d) => log += d);
for (let i = 0; i < 100 && !/listening/.test(log); i++) await new Promise((r) => setTimeout(r, 100));
const call = async (who, method, path, body) => {
  const r = await fetch(`http://127.0.0.1:${PORT}` + path, { method, headers: { "Content-Type": "application/json", ...(who ? { Authorization: "Bearer tok-" + who } : {}) }, body: body ? JSON.stringify(body) : undefined });
  let j = {}; try { j = await r.json(); } catch {} return { s: r.status, j };
};
const ids = (posts) => posts.map((p) => p.id);

try {
  console.log("\nONE MAP, APP AND SERVER");
  const pl = (await call(null, "GET", "/api/places")).j.places;
  t("every app lab is a server place, with the same channels", LABS.every((l) => pl[l.id] && JSON.stringify(pl[l.id].channels) === JSON.stringify(l.channels.map((c) => c.id))) && Object.keys(pl).length === LABS.length);
  t("each lab's home channel matches, and is one of its own channels", LABS.every((l) => pl[l.id].home === LAB_HOME[l.id] && pl[l.id].channels.includes(LAB_HOME[l.id])));
  t("no home is a tool (archive, tracks, beats)", LABS.every((l) => { const c = l.channels.find((x) => x.id === LAB_HOME[l.id]); return c && !c.archive && !c.library && !c.beatlab; }));

  console.log("\nNEW POSTS GO HOME, AND #TAG THEMSELVES");
  let r = await call("ana", "POST", "/api/posts", { channel: "creators", body: "first piece in the new Visual #Poster #typography", isWork: true, imageUrl: "/uploads/a.jpg" });
  const fresh = r.j.post?.id;
  t("a post to the home channel works", r.s === 200 && fresh);

  console.log("\nTALK: ONE CONVERSATION PER LAB");
  r = await call("dee", "GET", "/api/labs/pharmacy/feed");
  t("Visual's Talk merges every old channel (creators, photography, graphic design)", r.s === 200 && [oldTalk, oldPhoto, oldGd, fresh].every((id) => ids(r.j.posts).includes(id)));
  t("…and nothing from other labs", !ids(r.j.posts).includes(oldCollab) && !ids(r.j.posts).includes(oldFeedback));
  t("pins come from the home channel", r.j.home === "creators" && Array.isArray(r.j.pins));
  t("labs are for members", (await call(null, "GET", "/api/labs/pharmacy/feed")).s === 401);
  t("an unknown lab is a 404", (await call("dee", "GET", "/api/labs/nope/feed")).s === 404);

  console.log("\nWORK: THE GRID, AND #TAGS");
  r = await call("dee", "GET", "/api/labs/pharmacy/work");
  t("Work is the pieces, not the talk", [oldPhoto, oldGd, fresh].every((id) => ids(r.j.posts).includes(id)) && !ids(r.j.posts).includes(oldTalk));
  const tagsOf = (id) => r.j.posts.find((p) => p.id === id)?.tags || [];
  t("an old post carries its channel as a tag (#photography)", tagsOf(oldPhoto).includes("photography"));
  t("…plus any it wrote itself (#poster + #graphicdesign)", tagsOf(oldGd).includes("poster") && tagsOf(oldGd).includes("graphicdesign"));
  t("a new post gets only the tags it wrote, lowercased — not its channel's", JSON.stringify(tagsOf(fresh).sort()) === JSON.stringify(["poster", "typography"]));
  t("Work's tag pills skip the plain room names (#creators)", !r.j.tags.some((x) => x.tag === "creators"));
  t("the lab's tags are listed, most used first", r.j.tags[0].count === 2 && r.j.tags.some((x) => x.tag === "poster" && x.count === 2));
  r = await call("dee", "GET", "/api/labs/pharmacy/work?tag=photography");
  t("?tag=photography → just that", JSON.stringify(ids(r.j.posts)) === JSON.stringify([oldPhoto]));
  r = await call("dee", "GET", "/api/labs/pharmacy/work?tag=photo");
  t("#photo isn't #photography", r.j.posts.length === 0);
  r = await call("dee", "GET", "/api/labs/pharmacy/work?tag=%23POSTER");
  t("tags are case- and #-insensitive", ids(r.j.posts).includes(fresh) && ids(r.j.posts).includes(oldGd));
  const all = (await call("dee", "GET", "/api/labs/pharmacy/feed")).j.posts;
  const tr = all.find((p) => p.id === tricky)?.tags || [];
  t("a # inside a link or an &#39; isn't a tag; one letter is too short", JSON.stringify(tr) === JSON.stringify(["ok_tag", "creators"]));

  console.log("\nEACH GENRE, EXPLAINED BY ITS #TAGS (v1.1)");
  await call("ben", "POST", "/api/posts", { channel: "general", body: "anyone want to make a zine? #zine", isWork: false });
  r = await call("dee", "GET", "/api/labs/tags");
  t("every lab has tags for the labs list", r.s === 200 && LABS.every((l) => Array.isArray(r.j.tags[l.id]) && r.j.tags[l.id].length >= 3));
  t("a genre's own tags come first (Visual: #graphicdesign #photography #film)", JSON.stringify(r.j.tags.pharmacy.slice(0, 3)) === JSON.stringify(["graphicdesign", "photography", "film"]));
  t("then what people actually use there (#poster in Visual, #zine in General)", r.j.tags.pharmacy.includes("poster") && r.j.tags.hq.includes("zine"));
  t("old room names that say nothing (#creators, #chat) aren't shown as a genre's tags", !r.j.tags.pharmacy.includes("creators") && !r.j.tags.culture.includes("chat"));
  t("an empty lab still says what it's for (Fashion)", JSON.stringify(r.j.tags.fashion.slice(0, 3)) === JSON.stringify(["streetwear", "clothingdesign", "drops"]));
  t("for members, like the labs", (await call(null, "GET", "/api/labs/tags")).s === 401);
  t("Open and Pulse are gone for now", (await call("dee", "GET", "/api/labs/pharmacy/open")).s === 404 && (await call("dee", "GET", "/api/labs/pharmacy/pulse")).s === 404);

  console.log("\nA #TAG ACROSS EVERY LAB");
  r = await call("dee", "GET", "/api/tags/poster");
  t("#poster: the work, with which labs it's in", r.j.count === 2 && ids(r.j.posts).includes(fresh) && r.j.labs.pharmacy === 2);
  r = await call("dee", "GET", "/api/tags/feedback");
  t("an old room's name works as a tag across labs (#feedback in Music) — talk shows too, after any work", r.j.count === 1 && r.j.labs.culture === 1 && ids(r.j.posts).includes(oldFeedback));
  t("a bad tag is refused", (await call("dee", "GET", "/api/tags/%23")).s === 400);
  r = await call("dee", "GET", "/api/tags?lab=pharmacy&q=po");
  t("suggestions while typing: #po → #poster", r.j.tags[0].tag === "poster");
} catch (e) {
  fail++; console.log("  ✗  threw: " + e.message); console.log(log.slice(-1500));
} finally { srv.kill(); }
console.log(`\n  ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
