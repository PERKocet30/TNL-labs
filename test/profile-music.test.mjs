// Music on the profile v1.1 (2026-10-09): the music a member uploads has its
// own Music tab on their profile — a song list, not tiles in the visual grid. Runs the real server on a
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
tr(ben, "Not Sky's", "/uploads/cover2.jpg", D);
db.prepare(`INSERT INTO posts (author_id, channel, body, is_work, image_url, created_at) VALUES (?,?,?,1,?,?)`).run(sky, "profile", "a piece", "/uploads/p.jpg", now - 2 * D);
db.close();

const PORT = 18650 + (process.pid % 40);
const srv = spawn(process.execPath, ["--experimental-sqlite", "src/server.js"], { cwd: ROOT, env: { ...process.env, PORT: String(PORT), TNL_DATA: DATA }, stdio: ["ignore", "pipe", "pipe"] });
let log = ""; srv.stdout.on("data", (d) => log += d); srv.stderr.on("data", (d) => log += d);
for (let i = 0; i < 100 && !/listening/.test(log); i++) await new Promise((r) => setTimeout(r, 100));
const call = async (who, path) => { const r = await fetch(`http://127.0.0.1:${PORT}` + path, { headers: who ? { Authorization: "Bearer tok-" + who } : {} }); return { s: r.status, j: await r.json().catch(() => ({})) }; };

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

  console.log("\nTHE APP DRAWS IT — ITS OWN MUSIC TAB, NOT THE VISUAL GRID (v1.1)");
  const app = readFileSync(join(ROOT, "public/index.html"), "utf8");
  t("songs are not tiles in the grid any more", !app.includes("withTracks(") && !app.includes("work-trk") && app.includes("(PROFTAGGED||[]):pinnedFirst(PROFILE.posts);"));
  t("a Music tab, shown when they have songs (or it's yours)", app.includes(`\${(PROFILE.tracks||[]).length||mine?\`<button class="ptab \${PTAB==="music"?"on":""}" data-ptab="music"`));
  t("a song list: number, cover, title, plays, length", app.includes('<span class="pmus-art">${t.artworkUrl?`<img src="${esc(t.artworkUrl)}"') && app.includes('<span class="pmus-d">${mmss(t.durationMs)}</span>'));
  t("Play at the top", app.includes('<button class="pmus-play" data-pftrk="${(cur||T[0]).id}"'));
  t("the posts number counts posts only", app.includes("${num(st.posts,esc(K.work.toLowerCase()))}"));
  t("a song plays as a post's sound (stops when the list leaves the screen)", app.includes(`MUSOK=true;MUSAUTOID="trk"+t.id;`) && app.includes('!!document.querySelector(`[data-trkown="${MUSAUTOID}"]`)'));
  t("…and when one ends, the next one down plays", app.includes("const n=nextProfileTrack();if(n){MUSAUTOID=\"trk\"+n.id;playTrack(n,true)"));
} catch (e) {
  fail++; console.log("  ✗  threw: " + e.message); console.log(log.slice(-1500));
} finally { srv.kill(); }
console.log(`\n  ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
