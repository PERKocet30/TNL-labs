// Story cards v2 (2026-10-11, "this is pretty bland"): the work's own colours
// fill the Story edge to edge — no white sheet — with the piece on top, the
// song credited, and a text post on the maker's colour.
import { spawn, execFileSync } from "node:child_process";
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

// a placeholder piece: a red-to-blue test pattern, never anyone's work
execFileSync(FF, ["-loglevel", "error", "-y", "-f", "lavfi", "-i", "gradients=s=800x1000:c0=0xD01010:c1=0x1030D0:x0=0:y0=0:x1=800:y1=1000:d=1", "-frames:v", "1", join(DATA, "uploads", "piece.jpg")]);
process.env.TNL_DATA = DATA;
const { db } = await import(join(ROOT, "src/db.js"));
const now = Date.now();
const uid = Number(db.prepare(`INSERT INTO users (username, display_name, email, password_hash, created_at, email_verified, role, accent) VALUES (?,?,?,?,?,1,?,?)`)
  .run("maker", "Maker", "m@x.com", "h", now, "Producer", "lab").lastInsertRowid);
const tr = Number(db.prepare(`INSERT INTO tracks (user_id, title, url, created_at) VALUES (?, 'Night Song', '/uploads/none.wav', ?)`).run(uid, now).lastInsertRowid);
const P = (body, img, track) => Number(db.prepare(`INSERT INTO posts (author_id, channel, body, image_url, media_w, media_h, is_work, audio_track_id, created_at) VALUES (?,?,?,?,800,1000,1,?,?)`)
  .run(uid, "graphic-design", body, img, track, now).lastInsertRowid);
const art = P("A piece", "/uploads/piece.jpg", tr), words = P("Every piece started as a voice memo at 3am.", null, null);

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
  t("…and coloured by it, not plain black (red at the top, blue at the bottom)", corner[0] > corner[2] && low[2] > low[0]);
  const mid = px(f, 540, 920);
  t("the piece itself sits large in the middle", !near(mid, corner, 25));
  console.log("\nA TEXT POST");
  const w = join(DATA, "words.jpg"); writeFileSync(w, Buffer.from(await (await fetch(`${B}/p/${words}/story.jpg`)).arrayBuffer()));
  t("its words go on the maker's colour, edge to edge", near(px(w, 20, 20), [0x98, 0xFC, 0x68], 30));
  console.log("\nTHE SONG");
  const src = (await import("node:fs")).readFileSync(join(ROOT, "src/server-12-story.js"), "utf8");
  t("a post with a song credits it on the card", src.includes("music: tr ?") && src.includes('t.at("MUSIC"'));
} finally { srv.kill(); }
console.log(`\n  ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
