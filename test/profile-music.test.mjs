// Music on the profile v1.1 (2026-10-09): the music a member uploads has its
// own Music tab on their profile — a song list, not tiles in the visual grid.
// v1.2 (2026-10-10): a pinned song, a /s/:id song link that previews in
// Instagram DMs, and their merch under the music. Runs the real server on a
// throwaway database; checks the profile carries the tracks (newest first,
// with covers), only that member's, for guests too — and that the app
// draws a cover tile, falls back to the title without one, and plays it as
// a post's sound (on screen only).
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { mkdirSync, rmSync, readFileSync } from "node:fs";
import { spawn } from "node:child_process";
const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const DATA = join(ROOT, "test/.tmp/profile-music");
rmSync(DATA, { recursive: true, force: true }); mkdirSync(join(DATA, "uploads"), { recursive: true });
process.env.TNL_DATA = DATA;
let pass = 0, fail = 0;
const t = (n, ok) => { ok ? pass++ : fail++; console.log("  " + (ok ? "✓" : "✗") + "  " + n); };

const { db } = await import("../src/db.js");
const now = Date.now(), D = 86400000;
const mk = (u) => { const id = Number(db.prepare(`INSERT INTO users (username, display_name, email, password_hash, created_at, email_verified) VALUES (?,?,?,?,?,1)`).run(u, u.toUpperCase(), u + "@x.test", "x", now - 30 * D).lastInsertRowid);
  db.prepare(`INSERT INTO sessions (token, user_id, created_at) VALUES (?,?,?)`).run("tok-" + u, id, now); return id; };
const sky = mk("sky"), ben = mk("ben");
const tr = (who, title, art, ago) => Number(db.prepare(`INSERT INTO tracks (user_id, title, url, artwork_url, duration_ms, created_at) VALUES (?,?,?,?,?,?)`)
  .run(who, title, "/uploads/" + title.replace(/\W/g, "") + ".mp3", art, 180000, now - ago).lastInsertRowid);
const older = tr(sky, "Night Drive", "/uploads/cover1.jpg", 3 * D), newer = tr(sky, "No Cover Yet", "", 1 * D);
const bens = tr(ben, "Not Sky's", "/uploads/cover2.jpg", D);
const gone = mk("gone"); const goneSong = tr(gone, "Hidden", "", D); db.prepare(`UPDATE users SET suspended = 1 WHERE id = ?`).run(gone);
db.prepare(`INSERT INTO posts (author_id, channel, body, is_work, image_url, created_at) VALUES (?,?,?,1,?,?)`).run(sky, "profile", "a piece", "/uploads/p.jpg", now - 2 * D);
db.close();

const PORT = 18650 + (process.pid % 40);
const srv = spawn(process.execPath, ["--experimental-sqlite", "src/server.js"], { cwd: ROOT, env: { ...process.env, PORT: String(PORT), TNL_DATA: DATA }, stdio: ["ignore", "pipe", "pipe"] });
let log = ""; srv.stdout.on("data", (d) => log += d); srv.stderr.on("data", (d) => log += d);
for (let i = 0; i < 100 && !/listening/.test(log); i++) await new Promise((r) => setTimeout(r, 100));
const call = async (who, path, body) => { const r = await fetch(`http://127.0.0.1:${PORT}` + path, { method: body ? "POST" : "GET", headers: { "Content-Type": "application/json", ...(who ? { Authorization: "Bearer tok-" + who } : {}) }, body: body ? JSON.stringify(body) : undefined }); return { s: r.status, j: await r.json().catch(() => ({})) }; };
const page = async (path) => { const r = await fetch(`http://127.0.0.1:${PORT}` + path, { headers: { "User-Agent": "facebookexternalhit/1.1" } }); return { s: r.status, html: await r.text() }; };
const meta = (html, k) => { const m = new RegExp(`<meta (?:property|name)="${k}" content="([^"]*)"`).exec(html); return m && m[1]; };

try {
  console.log("\nTHE PROFILE CARRIES THEIR MUSIC");
  const p = (await call("ben", "/api/users/sky")).j;
  t("sky's two tracks, newest first", p.tracks.map((x) => x.id).join() === [newer, older].join());
  t("…not ben's", !p.tracks.some((x) => x.title === "Not Sky's"));
  t("each with its cover (or none), title, length and who made it", p.tracks[1].artworkUrl === "/uploads/cover1.jpg" && p.tracks[0].artworkUrl === ""
    && p.tracks[1].durationMs === 180000 && p.tracks[1].by.username === "sky" && typeof p.tracks[1].url === "string");
  t("the posts are still there too", p.posts.length === 1);
  t("guests see it too, like the rest of the profile", (await call(null, "/api/users/sky")).j.tracks.length === 2);
  t("no music: an empty list, not missing", Array.isArray((await call(null, "/api/users/ben")).j.tracks));

  console.log("\nA PINNED SONG (v1.2)");
  t("no pin yet", p.pinnedTrack === null);
  t("pin one of your own songs", (await call("sky", "/api/me/pinned-track", { trackId: older })).j.pinnedTrack === older && (await call(null, "/api/users/sky")).j.pinnedTrack === older);
  t("…not someone else's", (await call("sky", "/api/me/pinned-track", { trackId: bens })).s === 404 && (await call(null, "/api/users/sky")).j.pinnedTrack === older);
  t("signed out can't pin", (await call(null, "/api/me/pinned-track", { trackId: older })).s === 401);
  t("unpin", (await call("sky", "/api/me/pinned-track", { trackId: null })).j.pinnedTrack === null && (await call(null, "/api/users/sky")).j.pinnedTrack === null);
  await call("sky", "/api/me/pinned-track", { trackId: older });

  console.log("\nA SONG LINK THAT LOOKS RIGHT IN AN INSTAGRAM DM (v1.2)");
  const sp = await page(`/s/${older}`);
  t("/s/:id is a page", sp.s === 200);
  t("its preview: the song and who made it, as a song", meta(sp.html, "og:title") === "Night Drive — SKY" && meta(sp.html, "og:type") === "music.song" && /A song by @sky on TNL LABS · 3:00/.test(meta(sp.html, "og:description") || ""));
  t("…the cover, as a full address", /^http:\/\/[^/]+\/uploads\/cover1\.jpg$/.test(meta(sp.html, "og:image") || ""));
  t("it plays right there", sp.html.includes('<audio controls preload="none" src="/uploads/NightDrive.mp3"'));
  t("Open in the app → their Music tab, this song", sp.html.includes(`href="/?u=sky&amp;s=${older}"`));
  t("no cover: their photo or the LABS icon instead", /icon-white-512\.png|\/uploads\//.test(meta((await page(`/s/${newer}`)).html, "og:image") || ""));
  t("a missing song, or a suspended member's: not found", (await page("/s/999999")).s === 404 && (await page(`/s/${goneSong}`)).s === 404);

  console.log("\nTHE APP DRAWS IT — ITS OWN MUSIC TAB, NOT THE VISUAL GRID (v1.1)");
  const app = readFileSync(join(ROOT, "public/index.html"), "utf8");
  t("songs are not tiles in the grid any more", !app.includes("withTracks(") && !app.includes("work-trk") && app.includes("(PROFTAGGED||[]):pinnedFirst(PROFILE.posts);"));
  t("a Music tab, shown when they have songs (or it's yours)", app.includes(`\${(PROFILE.tracks||[]).length||mine?\`<button class="ptab \${PTAB==="music"?"on":""}" data-ptab="music"`));
  t("a song list: number, cover, title, plays, length", app.includes('<span class="pmus-art">${t.artworkUrl?`<img src="${esc(t.artworkUrl)}"') && app.includes('<span class="pmus-d">${mmss(t.durationMs)}</span>'));
  t("Play at the top", app.includes('<button class="pmus-play" data-pftrk="${(cur||T[0]).id}"'));
  t("the posts number counts posts only", app.includes("${num(st.posts,esc(K.work.toLowerCase()))}"));
  t("a song plays as a post's sound (stops when the list leaves the screen)", app.includes(`MUSOK=true;MUSAUTOID="trk"+t.id;`) && app.includes('!!document.querySelector(`[data-trkown="${MUSAUTOID}"]`)'));
  t("…and when one ends, the next one down plays", app.includes("const n=nextProfileTrack();if(n){MUSAUTOID=\"trk\"+n.id;playTrack(n,true)"));
  t("the pinned song shows first, marked Pinned (v1.2)", app.includes("return p?[p,...T.filter(t=>t!==p)]:T;") && app.includes('${pinned?"Pinned · ":""}'));
  t("⋯ on a song: Share song (its /s/ link), and Pin to top on your own", app.includes('const songLink=t=>location.origin+"/s/"+t.id;') && app.includes('label:pinned?"Unpin":"Pin to top"'));
  t("their merch from the Market under the music, See all → Shop", app.includes('<div class="pmus-merch"><div class="pmus-h"><b>Merch</b><button data-ptab="shop">See all</button>'));
  t("a song link lands on their Music tab with the song picked out", app.includes('openProfile(mu?mu[1]:qu);if(qsong){PTAB="music";PFSONG=qsong}') && app.includes('${PFSONG===t.id?" hl":""}'));
} catch (e) {
  fail++; console.log("  ✗  threw: " + e.message); console.log(log.slice(-1500));
} finally { srv.kill(); }
console.log(`\n  ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
