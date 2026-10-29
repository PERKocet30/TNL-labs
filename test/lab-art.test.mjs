// LAB PICTURE v1.0 (2026-10-29): "I just posted a reel to the Business lab but the icon for the lab
// isn't changing." The labs list wears the newest picture made in each lab; a video counts by its
// cover. Boots the real server on a throwaway database and reads /api/labs.
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { mkdirSync, rmSync } from "node:fs";
import { spawn } from "node:child_process";
const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const DATA = join(ROOT, "test/.tmp/lab-art");
rmSync(DATA, { recursive: true, force: true }); mkdirSync(DATA, { recursive: true });
process.env.TNL_DATA = DATA;
let pass = 0, fail = 0;
const t = (n, ok) => { ok ? pass++ : fail++; console.log("  " + (ok ? "✓" : "✗") + "  " + n); };

const { db } = await import("../src/db.js");
const now = Date.now();
const me = Number(db.prepare(`INSERT INTO users (username, display_name, email, password_hash, created_at, email_verified) VALUES (?,?,?,?,?,1)`)
  .run("ana", "Ana", "ana@x.test", "x", now - 864e5).lastInsertRowid);
db.prepare(`INSERT INTO sessions (token, user_id, created_at) VALUES (?,?,?)`).run("tok-ana", me, now);
const post = (ch, ago, { image = null, video = null, thumb = null } = {}) => db.prepare(
  `INSERT INTO posts (author_id, channel, body, image_url, video_url, thumb_url, created_at) VALUES (?,?,?,?,?,?,?)`)
  .run(me, ch, "x", image, video, thumb, now - ago);
post("opportunities", 60000, { image: "/uploads/old.jpg" });
post("opportunities", 1000, { video: "/uploads/reel.mp4", thumb: "/uploads/reel-poster.jpg" });   // the reel, newer
post("visual-chat", 1000, { video: "/uploads/nocover.mp4" });                                      // a video with no cover yet
post("visual-chat", 60000, { image: "/uploads/art.jpg" });
db.close();

const PORT = 18500 + (process.pid % 200);
const srv = spawn(process.execPath, ["--experimental-sqlite", "src/server.js"], { cwd: ROOT, env: { ...process.env, PORT: String(PORT), TNL_DATA: DATA }, stdio: ["ignore", "pipe", "pipe"] });
let log = ""; srv.stdout.on("data", (d) => log += d); srv.stderr.on("data", (d) => log += d);
for (let i = 0; i < 100 && !/listening/.test(log); i++) await new Promise((r) => setTimeout(r, 100));
try {
  const r = await fetch(`http://127.0.0.1:${PORT}/api/labs`, { headers: { Authorization: "Bearer tok-ana" } });
  const j = await r.json();
  t("a reel's cover becomes the lab's picture when it's the newest", j.art?.opportunities?.url === "/uploads/reel-poster.jpg");
  t("a video with no cover yet doesn't blank the picture", j.art?.["visual-chat"]?.url === "/uploads/art.jpg");
} catch (e) {
  fail++; console.log("  ✗  threw: " + e.message); console.log(log.slice(-1500));
} finally { srv.kill(); }
console.log(`\n  ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
