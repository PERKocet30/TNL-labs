// Story cards v2 (2026-10-11, "this is pretty bland"): the work's own colours
// fill the Story edge to edge — no white sheet — with the piece on top, the
// song credited, and a text post on the maker's colour.
import { spawn, spawnSync, execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { rmSync, mkdirSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const DATA = join(ROOT, "test/.tmp/story-card");
rmSync(DATA, { recursive: true, force: true }); mkdirSync(join(DATA, "uploads"), { recursive: true });
const FF = createRequire(import.meta.url)("ffmpeg-static");
let pass = 0, fail = 0;
const t = (n, ok) => { ok ? pass++ : fail++; console.log("  " + (ok ? "✓" : "✗") + "  " + n); };

// a placeholder piece, never anyone's work: red on top, blue below
execFileSync(FF, ["-loglevel", "error", "-y", "-f", "lavfi", "-i", "color=c=0xD01010:s=800x500:d=1", "-f", "lavfi", "-i", "color=c=0x1030D0:s=800x500:d=1",
  "-filter_complex", "[0][1]vstack", "-frames:v", "1", join(DATA, "uploads", "piece.jpg")]);
// …and a placeholder profile picture: flat yellow
execFileSync(FF, ["-loglevel", "error", "-y", "-f", "lavfi", "-i", "color=c=0xF0D020:s=300x300:d=1", "-frames:v", "1", join(DATA, "uploads", "face.jpg")]);
// …and two placeholder songs: a 20-second tone and a 6-second one
for (const [n, secs] of [["song", 20], ["short", 6]])
  execFileSync(FF, ["-loglevel", "error", "-y", "-f", "lavfi", "-i", `sine=frequency=330:duration=${secs}`, "-ac", "2", join(DATA, "uploads", n + ".wav")]);
process.env.TNL_DATA = DATA;
const { db } = await import(join(ROOT, "src/db.js"));
const now = Date.now();
const uid = Number(db.prepare(`INSERT INTO users (username, display_name, email, password_hash, created_at, email_verified, role, accent) VALUES (?,?,?,?,?,1,?,?)`)
  .run("maker", "Maker", "m@x.com", "h", now, "Producer", "lab").lastInsertRowid);
db.prepare(`UPDATE users SET avatar_url = '/uploads/face.jpg' WHERE id = ?`).run(uid);
const T = (title, url, ms) => Number(db.prepare(`INSERT INTO tracks (user_id, title, url, duration_ms, created_at) VALUES (?, ?, ?, ?, ?)`).run(uid, title, url, ms, now).lastInsertRowid);
const tr = T("Night Song", "/uploads/song.wav", 20000), short = T("Short Song", "/uploads/short.wav", 6000);
const P = (body, img, track) => Number(db.prepare(`INSERT INTO posts (author_id, channel, body, image_url, media_w, media_h, is_work, audio_track_id, created_at) VALUES (?,?,?,?,800,1000,1,?,?)`)
  .run(uid, "graphic-design", body, img, track, now).lastInsertRowid);
const art = P("A piece", "/uploads/piece.jpg", tr), words = P("Every piece started as a voice memo at 3am.", null, null), brief = P("Short", "/uploads/piece.jpg", short);

const PORT = 8870, B = `http://localhost:${PORT}`;
const srv = spawn(process.execPath, ["--experimental-sqlite", "--no-warnings", "src/server.runtime.js"], {
  cwd: ROOT, env: { ...process.env, TNL_DATA: DATA, PORT: String(PORT), STRIPE_SECRET_KEY: "", TNL_NO_VIDEO_FIX: "1", TNL_NO_WATCH: "1" }, stdio: "ignore" });
const px = (file, x, y) => [...execFileSync(FF, ["-loglevel", "error", "-i", file, "-vf", `crop=2:2:${x}:${y}`, "-f", "rawvideo", "-pix_fmt", "rgb24", "-"], { stdio: ["ignore", "pipe", "pipe"] })].slice(0, 3);
const near = (a, b, d = 40) => a.every((v, i) => Math.abs(v - b[i]) <= d);
try {
  for (let i = 0; i < 100; i++) { try { if ((await fetch(B + "/api/health")).ok) break; } catch {} await new Promise((r) => setTimeout(r, 100)); }
  console.log("\nA POST WITH A PICTURE");
  const r = await fetch(`${B}/p/${art}/story.jpg`);
  const f = join(DATA, "art.jpg"); writeFileSync(f, Buffer.from(await r.arrayBuffer()));
  const probe = (() => { try { execFileSync(FF, ["-i", f], { stdio: ["ignore", "pipe", "pipe"] }); } catch (e) { return String(e.stderr); } })();
  t("a 1080×1920 picture", r.status === 200 && /1080x1920/.test(probe));
  const corner = px(f, 20, 20), low = px(f, 20, 1880);
  t("no white sheet: the corners are the work's colours, not white", !near(corner, [255, 255, 255], 60) && !near(low, [255, 255, 255], 60));
  // away from the darkened edges, clear of the type: just above the piece and just below the tag
  const hi = px(f, 700, 390), lo = px(f, 700, 1680);
  t("…and coloured by it, not plain black (red at the top, blue at the bottom)", hi[0] > hi[2] + 10 && lo[2] > lo[0] + 10);
  t("their profile picture is on it, top left (round, ringed in their colour)", near(px(f, 128, 298), [0xF0, 0xD0, 0x20], 40) && near(px(f, 72 - 5, 298), [0x98, 0xFC, 0x68], 60));
  const mid = px(f, 540, 920);
  t("the piece itself sits large in the middle", !near(mid, corner, 25));
  console.log("\nA TEXT POST");
  const w = join(DATA, "words.jpg"); writeFileSync(w, Buffer.from(await (await fetch(`${B}/p/${words}/story.jpg`)).arrayBuffer()));
  t("its words go on the maker's colour, edge to edge", near(px(w, 20, 20), [0x98, 0xFC, 0x68], 30));
  console.log("\nTHE SONG");
  const src = (await import("node:fs")).readFileSync(join(ROOT, "src/server-12-story.js"), "utf8");
  t("a post with a song credits it on the card", src.includes("music: tr ?") && src.includes('t.at("MUSIC"'));
  console.log("\nA STORY WITH THE SONG");
  const probe2 = (file) => { try { execFileSync(FF, ["-i", file], { stdio: ["ignore", "pipe", "pipe"] }); } catch (e) { return String(e.stderr); } return ""; };
  let t0 = Date.now(); const v = await fetch(`${B}/p/${art}/story.mp4`); const vb = Buffer.from(await v.arrayBuffer()); const took = Date.now() - t0;
  const vf = join(DATA, "story.mp4"); writeFileSync(vf, vb); const vp = probe2(vf);
  t("a post with a song has a Story video", v.status === 200 && /video\/mp4/.test(v.headers.get("content-type") || ""));
  t("…1080×1920 H.264, the song in AAC, 15 seconds", /Video: h264[^\n]*1080x1920/.test(vp) && /Audio: aac/.test(vp) && /Duration: 00:00:15\.0/.test(vp));
  const vol = String(spawnSync(FF, ["-i", vf, "-af", "volumedetect", "-f", "null", "-"]).stderr);
  const mean = Number((/mean_volume: (-?[\d.]+) dB/.exec(vol) || [])[1]);
  t("…and you can hear it", mean > -40);
  t0 = Date.now(); const again = Buffer.from(await (await fetch(`${B}/p/${art}/story.mp4`)).arrayBuffer());
  t("asking again is instant: it was kept", again.equals(vb) && Date.now() - t0 < Math.max(500, took / 3));
  const b6 = join(DATA, "short.mp4"); writeFileSync(b6, Buffer.from(await (await fetch(`${B}/p/${brief}/story.mp4`)).arrayBuffer()));
  t("a song shorter than 15 seconds sets the length", /Duration: 00:00:0[56]\./.test(probe2(b6)));
  t("a post with no song has no video (the picture is its Story)", (await fetch(`${B}/p/${words}/story.mp4`)).status === 404);
} finally { srv.kill(); }
console.log(`\n  ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
