// Which part of the song plays (2026-10-25): a post with music keeps a start
// point; the server keeps it inside the song, hands it back with the post,
// and a share of the post keeps the same part. Runs the real server.
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { rmSync, mkdirSync, readFileSync } from "node:fs";
const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const DATA = join(ROOT, "test/.tmp/song-part");
rmSync(DATA, { recursive: true, force: true }); mkdirSync(join(DATA, "uploads"), { recursive: true });
process.env.TNL_DATA = DATA;
const { db } = await import(join(ROOT, "src/db.js"));
let pass = 0, fail = 0;
const t = (n, ok) => { ok ? pass++ : fail++; console.log("  " + (ok ? "✓" : "✗") + "  " + n); };
const now = Date.now();
const mk = (u) => { const id = Number(db.prepare(`INSERT INTO users (username, display_name, email, password_hash, created_at, email_verified) VALUES (?,?,?,?,?,1)`).run(u, u, u + "@x.test", "x", now).lastInsertRowid);
  db.prepare(`INSERT INTO sessions (token, user_id, created_at) VALUES (?,?,?)`).run("tok-" + u, id, now); return id; };
const ana = mk("ana"); mk("ben");
const song = Number(db.prepare(`INSERT INTO tracks (user_id, title, url, duration_ms, created_at) VALUES (?, 'Three minutes', '/uploads/s.mp3', 180000, ?)`).run(ana, now).lastInsertRowid);
const blank = Number(db.prepare(`INSERT INTO tracks (user_id, title, url, duration_ms, created_at) VALUES (?, 'No length known', '/uploads/n.mp3', 0, ?)`).run(ana, now).lastInsertRowid);
db.close();
const PORT = 18990 + (process.pid % 9), B = `http://localhost:${PORT}`;
const srv = spawn(process.execPath, ["--experimental-sqlite", "--no-warnings", "src/server.runtime.js"], {
  cwd: ROOT, stdio: "ignore", env: { ...process.env, TNL_DATA: DATA, PORT: String(PORT), STRIPE_SECRET_KEY: "", TNL_NO_VIDEO_FIX: "1", TNL_NO_WATCH: "1" } });
const api = async (who, path, body, method) => { const r = await fetch(B + path, { method: method || (body ? "POST" : "GET"), headers: { "Content-Type": "application/json", Authorization: "Bearer tok-" + who }, body: body ? JSON.stringify(body) : undefined }); return { s: r.status, j: await r.json().catch(() => ({})) }; };
try {
  for (let i = 0; i < 100; i++) { try { if ((await fetch(B + "/api/health")).ok) break; } catch {} await new Promise((r) => setTimeout(r, 100)); }
  const post = (body, extra) => api("ana", "/api/posts", { channel: "profile", body, isWork: true, audioTrackId: song, ...extra });
  console.log("\nTHE START POINT");
  const a = (await post("From the chorus", { audioStart: 42000 })).j;
  t("a post keeps where its song starts", a.post && a.post.audioStart === 42000 && a.post.audioTrack && a.post.audioTrack.id === song);
  const b = (await post("Top", {})).j;
  t("no start given: the top of the song", b.post && b.post.audioStart === 0);
  const c = (await post("Too far", { audioStart: 999999 })).j;
  t("past the end: pulled back so a second is left to play", c.post && c.post.audioStart === 179000);
  const d = (await post("Backwards", { audioStart: -5000 })).j;
  t("before the start: the top", d.post && d.post.audioStart === 0);
  const e = (await post("Words only", { audioTrackId: undefined, audioStart: 30000 })).j;
  t("no song: no start", e.post && e.post.audioStart === 0 && !e.post.audioTrack);
  const f = (await post("Unknown length", { audioTrackId: blank, audioStart: 30000 })).j;
  t("a song whose length isn't known keeps the start as given", f.post && f.post.audioStart === 30000);
  console.log("\nIT COMES BACK WITH THE POST, AND A SHARE KEEPS IT");
  const feed = (await api("ben", "/api/feed?channel=profile")).j;
  const mine = (await api("ben", "/api/users/ana")).j;
  const seen = (feed.posts || []).concat(mine.posts || []).find((p) => p.id === a.post.id);
  t("the feed says where the song starts", !!seen && seen.audioStart === 42000);
  const sh = (await api("ben", `/api/posts/${a.post.id}/share`, { channel: "profile" })).j;
  const copy = sh.post || sh;
  t("a share of it plays the same part", copy && copy.audioStart === 42000 && copy.audioTrack && copy.audioTrack.id === song);
  console.log("\nTHE APP PLAYS FROM THERE");
  const media = readFileSync(join(ROOT, "src/app/media/media.js"), "utf8"), player = readFileSync(join(ROOT, "src/app/music/player.js"), "utf8"), q = readFileSync(join(ROOT, "src/app/compose/queue.js"), "utf8");
  t("the chip and the feed's autoplay start the song at the post's point", media.includes("playTrack(p.audioTrack,false,p.audioStart)") && media.includes("playTrack(p.audioTrack,true,p.audioStart)") && media.includes("a.currentTime=(p.audioStart||0)/1000;"));
  t("the player seeks there once the song is known", player.includes("function playTrack(t,silent,startMs)") && player.includes('a.addEventListener("loadedmetadata",seek,{once:true})'));
  t("the post maker sends it, and drafts keep it", q.includes("audioStart:c.track?(c.musStart||0):undefined") && /PD_KEEP=\[[^\]]*"musStart"/.test(q));
} finally { srv.kill(); }
console.log(`\n  ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
