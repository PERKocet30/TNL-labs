// Trending music v1.0 (2026-10-29): "a trending music section for music being
// used in the labs." GET /api/tracks/trending lists the songs members put on
// their posts lately — more different people first — and the Music lab shows
// them above All songs. Runs the real server against a throwaway database.
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { mkdirSync, rmSync, readFileSync } from "node:fs";
import { spawn } from "node:child_process";
const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const DATA = join(ROOT, "test/.tmp/trending");
rmSync(DATA, { recursive: true, force: true }); mkdirSync(join(DATA, "uploads"), { recursive: true });
process.env.TNL_DATA = DATA;
let pass = 0, fail = 0;
const t = (n, ok) => { ok ? pass++ : fail++; console.log("  " + (ok ? "✓" : "✗") + "  " + n); };
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

const { db } = await import("../src/db.js");
const now = Date.now(), D = 86400000;
const U = {};
const mk = (u, suspended = 0) => { U[u] = Number(db.prepare(`INSERT INTO users (username, display_name, email, password_hash, created_at, email_verified, suspended) VALUES (?,?,?,?,?,1,?)`)
  .run(u, u, u + "@x.test", "x", now - 60 * D, suspended).lastInsertRowid);
  db.prepare(`INSERT INTO sessions (token, user_id, created_at) VALUES (?,?,?)`).run("tok-" + u, U[u], now); };
for (const u of ["ana", "ben", "cy", "dee", "eve", "fay"]) mk(u);
mk("bot", 1);
const song = (who, title) => Number(db.prepare(`INSERT INTO tracks (user_id, title, url, duration_ms, created_at) VALUES (?,?,?,?,?)`).run(U[who], title, "/uploads/" + title + ".mp3", 120000, now - 30 * D).lastInsertRowid);
const use = (who, track, ago = D, shared = null) => db.prepare(`INSERT INTO posts (author_id, channel, body, image_url, is_work, audio_track_id, shared_from, created_at) VALUES (?,?,?,?,1,?,?,?)`)
  .run(U[who], "creators", "with a song", "/uploads/x.jpg", track, shared, now - ago).lastInsertRowid;
const wide = song("ana", "Wide"), busy = song("ben", "Busy"), old = song("cy", "Old"), never = song("dee", "Never"), botsong = song("cy", "Botted");
use("cy", wide); use("dee", wide); use("eve", wide); use("fay", wide);         // 4 people
use("ben", busy); use("ben", busy); use("ben", busy); use("ben", busy);          // 1 person, 4 posts
use("fay", old, 20 * D); use("eve", old, 20 * D); use("dee", old, 20 * D);      // used, but weeks ago
for (let i = 0; i < 6; i++) use("bot", botsong);                                 // a suspended account
const orig = use("fay", busy); use("ana", wide, D, orig);                         // a repost isn't a use
db.close();

const PORT = 18990 + (process.pid % 20);
const srv = spawn(process.execPath, ["--experimental-sqlite", "src/server.js"], { cwd: ROOT, stdio: ["ignore", "pipe", "pipe"], env: { ...process.env, PORT: String(PORT), TNL_DATA: DATA, TNL_NO_VIDEO_FIX: "1" } });
let log = ""; srv.stdout.on("data", (d) => log += d); srv.stderr.on("data", (d) => log += d);
for (let i = 0; i < 100 && !/listening/.test(log); i++) await wait(100);
const get = async (path, who) => { const r = await fetch(`http://127.0.0.1:${PORT}` + path, { headers: who ? { Authorization: "Bearer tok-" + who } : {} }); return { s: r.status, j: await r.json().catch(() => ({})) }; };

try {
  console.log("\nTRENDING: SONGS USED IN POSTS LATELY");
  const r = await get("/api/tracks/trending", "fay");
  const titles = (r.j.tracks || []).map((x) => x.title);
  t("lists songs used in posts", r.s === 200 && titles.includes("Wide") && titles.includes("Busy"));
  t("more different people beats more posts by one person", titles.indexOf("Wide") === 0 && titles.indexOf("Busy") === 1);
  t("each comes with how many posts use it", r.j.tracks[0].uses === 4 && r.j.tracks[1].uses === 5);
  t("…and plays like any other song (url, cover, who made it)", !!r.j.tracks[0].url && r.j.tracks[0].by.username === "ana");
  t("a song nobody has used doesn't trend", !titles.includes("Never"));
  t("weeks-old use has faded out", !titles.includes("Old"));
  t("suspended accounts' posts don't count", !titles.includes("Botted"));
  t("five at most", titles.length <= 5);
  t("signed out: not available", (await get("/api/tracks/trending")).s === 401);

  console.log("\nTHE MUSIC LAB");
  const app = readFileSync(join(ROOT, "src/app/music/tracks.js"), "utf8");
  t("Trending sits above All songs, not while searching", /!TRKQ&&TRACKS&&TRENDING&&TRENDING\.length\?`<div class="lx-sec trk-sec">Trending/.test(app) && app.includes("All songs"));
  t("rows say how many posts use the song", app.includes('" · used in "+t.uses'));
  t("a tap in Trending plays through Trending", /ctx==="trend"&&TRENDING\?TRENDING\.slice\(\)/.test(readFileSync(join(ROOT, "src/app/music/playlists.js"), "utf8")));
} catch (e) { t("no exception: " + e.message, false); console.log(log.slice(-800)); }
finally { srv.kill(); }
console.log(`\n  ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
