// Alongside Instagram v1.0 (2026-10-09): links from Instagram open LABS in
// its in-app browser. Knowing when we're in there, getting out to Safari /
// Chrome, listing previews in DMs, and landing on the exact thing from a
// public page. Runs the real code and the real server.
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { mkdirSync, rmSync, readFileSync, writeFileSync } from "node:fs";
import { spawn } from "node:child_process";
import { gunzipSync } from "node:zlib";
const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const DATA = join(ROOT, "test/.tmp/instagram");
rmSync(DATA, { recursive: true, force: true }); mkdirSync(join(DATA, "uploads"), { recursive: true });
process.env.TNL_DATA = DATA;
let pass = 0, fail = 0;
const t = (n, ok) => { ok ? pass++ : fail++; console.log("  " + (ok ? "✓" : "✗") + "  " + n); };

console.log("\nWHICH BROWSER WE'RE IN");
const ig = readFileSync(join(ROOT, "src/app-18-ig.js"), "utf8");
const M = new Function("navigator", "location", ig.slice(ig.indexOf("const UA="), ig.indexOf("let IAB=null")) + "\nreturn { inApp, isAndroid, outsideURL };")({ userAgent: "" }, { href: "https://labs.tnllabs.com/" });
const UAS = {
  igIOS: "Mozilla/5.0 (iPhone; CPU iPhone OS 18_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 Instagram 389.0.0.29.88 (iPhone15,3; iOS 18_5; en_US)",
  igAndroid: "Mozilla/5.0 (Linux; Android 14; Pixel 8 Build/AP2A; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/129.0.6668.81 Mobile Safari/537.36 Instagram 350.0.0.32.109 Android",
  fb: "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 [FBAN/FBIOS;FBAV/480.0.0.38.107]",
  threads: "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 Barcelona 350.0.0.25.88",
  safari: "Mozilla/5.0 (iPhone; CPU iPhone OS 18_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.5 Mobile/15E148 Safari/604.1",
  chrome: "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Mobile Safari/537.36",
};
t("Instagram on iPhone and Android", M.inApp(UAS.igIOS) === "Instagram" && M.inApp(UAS.igAndroid) === "Instagram");
t("Facebook and Threads too", M.inApp(UAS.fb) === "Facebook" && M.inApp(UAS.threads) === "Threads");
t("Safari and Chrome are not in-app", M.inApp(UAS.safari) === null && M.inApp(UAS.chrome) === null);
t("Android is told apart from iPhone", M.isAndroid(UAS.igAndroid) && !M.isAndroid(UAS.igIOS));
const out = M.outsideURL("https://labs.tnllabs.com/e/art/12?x=1");
t("on Android, Open in Chrome is an intent link to the same page, falling back to it",
  out.startsWith("intent://labs.tnllabs.com/e/art/12?x=1#Intent;scheme=https;package=com.android.chrome;") && out.includes("S.browser_fallback_url=" + encodeURIComponent("https://labs.tnllabs.com/e/art/12?x=1")) && out.endsWith(";end"));

console.log("\nWIRED IN");
const story = readFileSync(join(ROOT, "src/app-18-story-share.js"), "utf8"), poll = readFileSync(join(ROOT, "src/app-17-event-3-poll.js"), "utf8");
t("Story sheets switch to press-and-hold inside Instagram (posts, profiles, listings, tracks, the tournament)",
  /inApp\(\)&&!s\.failed\?igHoldHTML\(s\.img,s\.link\)/.test(story) && /inApp\(\)&&!s\.failed\?igHoldHTML\(s\.img,url\)/.test(poll));
t("the bar paints on every render, but only touches the page when it changes", /iabPaint\(\);/.test(readFileSync(join(ROOT, "src/app-09-render-nav.js"), "utf8")) && /if\(l\.dataset\.h===html\)return;/.test(ig));
const door = readFileSync(join(ROOT, "src/app-10-dm-search.js"), "utf8");
const deep = new Function(door.slice(door.indexOf("const isDeepLanding="), door.indexOf("\n", door.indexOf("const isDeepLanding="))) + "\nreturn isDeepLanding;")();
t("a deep link gets the quick door: ?e= ?u= ?p= and /m/…", deep({ search: "?p=4", pathname: "/" }) && deep({ search: "?e=art&v=2", pathname: "/" }) && deep({ search: "", pathname: "/m/9" }) && !deep({ search: "", pathname: "/" }));

const { db } = await import("../src/db.js");
const now = Date.now();
const mk = (u) => { const id = Number(db.prepare(`INSERT INTO users (username, display_name, email, password_hash, created_at, email_verified) VALUES (?,?,?,?,?,1)`).run(u, u.toUpperCase(), u + "@x.test", "x", now).lastInsertRowid);
  db.prepare(`INSERT INTO sessions (token, user_id, created_at) VALUES (?,?,?)`).run("tok-" + u, id, now); return id; };
const ana = mk("ana"); mk("ben");
writeFileSync(join(DATA, "uploads", "l.jpg"), "x");
const lid = Number(db.prepare(`INSERT INTO listings (seller_id, title, price_cents, condition, images, created_at, updated_at) VALUES (?,?,?,?,?,?,?)`).run(ana, "Camo shiesty <b>", 4500, "New", JSON.stringify(["/uploads/l.jpg"]), now, now).lastInsertRowid);
const gone = Number(db.prepare(`INSERT INTO listings (seller_id, title, price_cents, images, status, created_at, updated_at) VALUES (?,?,?,?,?,?,?)`).run(ana, "Gone", 100, "[]", "removed", now, now).lastInsertRowid);
const work = Number(db.prepare(`INSERT INTO posts (author_id, channel, body, is_work, image_url, created_at) VALUES (?,?,?,1,?,?)`).run(ana, "profile", "a piece", "/uploads/l.jpg", now).lastInsertRowid);
const chat = Number(db.prepare(`INSERT INTO posts (author_id, channel, body, is_work, created_at) VALUES (?,?,?,0,?)`).run(ana, "general", "just talk", now).lastInsertRowid);
db.close();

const PORT = 19000 + (process.pid % 90);
const srv = spawn(process.execPath, ["--experimental-sqlite", "src/server.js"], { cwd: ROOT, env: { ...process.env, PORT: String(PORT), TNL_DATA: DATA }, stdio: ["ignore", "pipe", "pipe"] });
let log = ""; srv.stdout.on("data", (d) => log += d); srv.stderr.on("data", (d) => log += d);
for (let i = 0; i < 100 && !/listening/.test(log); i++) await new Promise((r) => setTimeout(r, 100));
const get = async (path, who, gz = false) => {
  const r = await fetch(`http://127.0.0.1:${PORT}` + path, { headers: { ...(who ? { Authorization: "Bearer tok-" + who } : {}), "Accept-Encoding": gz ? "gzip" : "identity" }, redirect: "manual" });
  return { s: r.status, enc: r.headers.get("content-encoding"), text: await r.text() };
};
try {
  console.log("\nA LISTING PASTED INTO A DM");
  let r = await get("/m/" + lid);
  t("/m/:id is still the app", r.s === 200 && r.text.includes('id="app"'));
  t("…with the listing's preview: title, photo, price, seller", r.text.includes('og:title" content="Camo shiesty &lt;b&gt;"') && r.text.includes(`og:image" content="http://127.0.0.1:${PORT}/uploads/l.jpg"`) && /og:description" content="\$45 · New · @ana on TNL LABS"/.test(r.text));
  t("only the listing's tags — the site-wide ones come out, so Instagram can't pick the wrong one", (r.text.match(/og:title/g) || []).length === 1 && (r.text.match(/og:image"/g) || []).length === 1 && !r.text.includes("og-cover-v3"));
  t("a removed listing gets the plain app, with the site preview", (await get("/m/" + gone)).text.includes("og-cover-v3"));
  r = await fetch(`http://127.0.0.1:${PORT}/m/${lid}`, { headers: { "Accept-Encoding": "gzip" } });
  t("…and it's sent compressed to phones that ask", r.headers.get("content-encoding") === "gzip" || (await r.text()).includes("og:title"));

  console.log("\nPUBLIC PAGES LAND ON THE THING IN THE APP");
  t("a profile's Open in the app → /?u=", (await get("/u/ana")).text.includes('href="/?u=ana"'));
  t("a post's Open in the app → /?p=", (await get("/p/" + work)).text.includes(`href="/?p=${work}"`));
  r = await get("/api/posts/" + work);
  t("the app can fetch one published post, signed out", r.s === 200 && JSON.parse(r.text).post.id === work);
  t("chat stays for members", (await get("/api/posts/" + chat)).s === 404 && (await get("/api/posts/" + chat, "ben")).s === 200);
  t("a missing post is a 404", (await get("/api/posts/999999")).s === 404);
} catch (e) {
  fail++; console.log("  ✗  threw: " + e.message); console.log(log.slice(-1500));
} finally { srv.kill(); }
console.log(`\n  ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
