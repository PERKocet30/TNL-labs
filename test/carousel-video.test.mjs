// A video in a carousel (2026-10-30). "I tried uploading a carousel with a video in
// the middle of it and it didn't work." A post's slides can be photos and videos;
// a video slide keeps its still (for grids and previews) and gets its light feed
// copy; a lone video slide is a video post; only our own uploads are taken.
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { rmSync, mkdirSync } from "node:fs";
import { DatabaseSync } from "node:sqlite";
const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const DATA = join(ROOT, "test/.tmp/carousel-video");
rmSync(DATA, { recursive: true, force: true }); mkdirSync(DATA, { recursive: true });
let pass = 0, fail = 0;
const t = (n, ok) => { ok ? pass++ : fail++; console.log("  " + (ok ? "✓" : "✗") + "  " + n); };
const PORT = 19500 + (process.pid % 200);
const srv = spawn(process.execPath, ["--experimental-sqlite", "src/server.js"], { cwd: ROOT, env: { ...process.env, PORT: String(PORT), TNL_DATA: DATA, PUBLIC_URL: `http://127.0.0.1:${PORT}`, TNL_NO_VIDEO_FIX: "1" }, stdio: ["ignore", "pipe", "pipe"] });
let log = ""; srv.stdout.on("data", (d) => log += d); srv.stderr.on("data", (d) => log += d);
for (let i = 0; i < 100 && !/listening/.test(log); i++) await new Promise((r) => setTimeout(r, 100));
const B = `http://127.0.0.1:${PORT}`;
const db = new DatabaseSync(join(DATA, "tnl.db"));
const now = Date.now();
db.prepare(`INSERT INTO users (username, display_name, email, password_hash, created_at, email_verified, avatar_url) VALUES ('ana','Ana','ana@x.example','h',?,1,'/uploads/p.jpg')`).run(now - 30 * 86400000);
db.prepare(`INSERT INTO sessions (token, user_id, created_at) VALUES ('tok-ana', 1, ?)`).run(now);
const post = async (body) => (await fetch(B + "/api/posts", { method: "POST", headers: { Authorization: "Bearer tok-ana", "Content-Type": "application/json" }, body: JSON.stringify({ channel: "profile", isWork: true, ...body }) })).json();

try {
  const a = await post({ body: "mixed", images: [{ url: "/uploads/a.jpg", w: 800, h: 1000 }, { url: "/uploads/v-poster.jpg", thumb: "/uploads/v-poster.jpg", video: "/uploads/v.mp4", w: 1080, h: 1920 }, { url: "/uploads/b.jpg", w: 800, h: 1000 }] });
  const im = a.post?.images || [];
  t("a carousel keeps a video slide in the middle, in order", im.length === 3 && !im[0].video && im[1].video === "/uploads/v.mp4" && !im[2].video);
  t("…the video slide keeps its still as its picture, and says what to play", im[1].url === "/uploads/v-poster.jpg" && im[1].play === "/uploads/v.mp4");
  t("…the post's own picture is the first slide, and it's not a video post", a.post.imageUrl === "/uploads/a.jpg" && !a.post.videoUrl);
  const again = await (await fetch(B + "/api/users/ana", { headers: { Authorization: "Bearer tok-ana" } })).json();
  t("…and reads the same from the profile", again.posts.find((x) => x.id === a.post.id)?.images?.[1]?.play === "/uploads/v.mp4");
  const b = await post({ body: "just the video", images: [{ url: "/uploads/w-poster.jpg", video: "/uploads/w.mp4", w: 720, h: 1280 }] });
  t("one video slide left on its own is a video post, its still the cover", b.post?.videoUrl === "/uploads/w.mp4" && b.post.thumbUrl === "/uploads/w-poster.jpg" && !b.post.imageUrl && b.post.mediaW === 720);
  const c = await post({ body: "sneaky", images: [{ url: "/uploads/a.jpg" }, { url: "/uploads/c.jpg", video: "https://evil.example/x.mp4" }] });
  t("a video that isn't one of our uploads is dropped (the slide stays a picture)", (c.post?.images || []).every((g) => !g.video));
} catch (e) { t("threw: " + e.message, false); }
srv.kill();
console.log(`\n${pass} passed, ${fail} failed`);
if (fail) { console.log(log.slice(-2000)); process.exit(1); }
