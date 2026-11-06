// Big videos v1.0 (2026-11-05): "I waited 5 minutes to upload my video only for it to say my
// video was too big" → like Meta, LABS takes a big video and keeps its own 1080p copy.
// The real server, small generated test videos, and lowered thresholds (TNL_VIDEO_*_MB).
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { mkdirSync, rmSync, readFileSync, statSync } from "node:fs";
import { spawn, execFileSync, spawnSync } from "node:child_process";
import { createRequire } from "node:module";
const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const DATA = join(ROOT, "test/.tmp/big-video"), SRC = join(DATA, "src");
rmSync(DATA, { recursive: true, force: true }); mkdirSync(SRC, { recursive: true });
process.env.TNL_DATA = DATA;
let pass = 0, fail = 0;
const t = (n, ok) => { ok ? pass++ : fail++; console.log("  " + (ok ? "✓" : "✗") + "  " + n); };
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const FF = createRequire(import.meta.url)("ffmpeg-static");
/* test patterns only: a "4K" landscape clip, a portrait one tagged HDR, and a small one */
const mk = (name, args) => { execFileSync(FF, ["-loglevel", "error", "-y", ...args, join(SRC, name)]); return join(SRC, name); };
const wide = mk("wide.mp4", ["-f", "lavfi", "-i", "testsrc2=s=3840x2160:r=30:d=2", "-f", "lavfi", "-i", "sine=d=2", "-c:v", "libx264", "-preset", "ultrafast", "-qp", "8", "-c:a", "aac", "-shortest"]);
const tall = mk("tall.mov", ["-f", "lavfi", "-i", "testsrc2=s=2160x3840:r=60:d=1", "-c:v", "libx264", "-preset", "ultrafast", "-qp", "8", "-color_primaries", "bt2020", "-color_trc", "arib-std-b67", "-colorspace", "bt2020nc"]);
const small = mk("small.mp4", ["-f", "lavfi", "-i", "testsrc2=s=640x360:r=30:d=1", "-c:v", "libx264", "-preset", "ultrafast"]);
const size = (p) => statSync(p).size;
const probe = (p) => { const s = spawnSync(FF, ["-hide_banner", "-i", p], { encoding: "utf8" }).stderr; const v = s.match(/Video: (\w+)[^\n]*?, (\d+)x(\d+)/); return v ? { codec: v[1], w: +v[2], h: +v[3], fps: +(s.match(/([\d.]+) fps/) || [])[1], hdr: /arib-std-b67|smpte2084/.test(s) } : null; };

const { db } = await import("../src/db.js");
const uid = Number(db.prepare(`INSERT INTO users (username, display_name, email, password_hash, created_at, email_verified) VALUES ('vid','Vid','vid@x.test','x',?,1)`).run(Date.now()).lastInsertRowid);
db.prepare(`INSERT INTO sessions (token, user_id, created_at) VALUES ('tok-vid', ?, ?)`).run(uid, Date.now());
db.close();

const keepMB = Math.max(1, Math.floor(Math.min(size(wide), size(tall)) / 1048576) - 1);
const boot = async (env) => {
  const PORT = 18960 + Math.floor(Math.random() * 30);
  const srv = spawn(process.execPath, ["--experimental-sqlite", "src/server.js"], { cwd: ROOT, stdio: ["ignore", "pipe", "pipe"], env: { ...process.env, PORT: String(PORT), TNL_DATA: DATA, TNL_NO_VIDEO_FIX: "1", ...env } });
  let log = ""; srv.stdout.on("data", (d) => log += d); srv.stderr.on("data", (d) => log += d);
  for (let i = 0; i < 100 && !/listening/.test(log); i++) await wait(100);
  return { srv, log: () => log, up: async (file) => { const r = await fetch(`http://127.0.0.1:${PORT}/api/upload/stream`, { method: "POST", headers: { Authorization: "Bearer tok-vid", "Content-Type": "application/octet-stream" }, body: readFileSync(file) }); return { s: r.status, j: await r.json().catch(() => ({})) }; } };
};

let S = await boot({ TNL_VIDEO_KEEP_MB: String(keepMB), TNL_VIDEO_MAX_MB: "400", TNL_VIDEO_SPARE_MB: "1" });
try {
  console.log("\nA BIG VIDEO IS TAKEN, AND LABS KEEPS A 1080p COPY");
  const a = await S.up(wide), fa = a.j.url && join(DATA, "uploads", a.j.url.slice(9)), pa = fa && probe(fa);
  t("a 4K landscape video over the keep line uploads", a.s === 200 && a.j.kind === "video" && a.j.shrunk === true);
  t("…saved as a 1080p H.264 MP4", /\.mp4$/.test(a.j.url) && pa && pa.codec === "h264" && pa.w === 1920 && pa.h === 1080);
  t("…smaller than it came in, and the bytes say what's on disk", a.j.bytes === size(fa) && a.j.bytes < size(wide));
  t("…with a cover", /-poster\.jpg$/.test(a.j.poster || ""));
  t("…and nothing half-made left behind", !require_parts());
  const b = await S.up(tall), pb = b.j.url && probe(join(DATA, "uploads", b.j.url.slice(9)));
  t("a portrait HDR 60fps video: 1080×1920, still 60fps, colours toned to normal (not HDR any more)", b.s === 200 && b.j.shrunk && pb && pb.w === 1080 && pb.h === 1920 && Math.round(pb.fps) === 60 && !pb.hdr);
  const c = await S.up(small);
  t("a video under the keep line is kept as it came (no shrink)", c.s === 200 && !c.j.shrunk && c.j.bytes === size(small));
} finally { S.srv.kill(); }
function require_parts() { try { return (execFileSync("ls", ["-a", join(DATA, "uploads")]).toString().match(/\.part-/) || null); } catch { return null; } }

console.log("\nTOO BIG, OR NO ROOM — SAID AT ONCE");
S = await boot({ TNL_VIDEO_MAX_MB: "1" });
try {
  const d = await S.up(wide);
  t("over the most LABS takes: 413 before the upload, in GB", d.s === 413 && /GB max/.test(d.j.error || ""));
} finally { S.srv.kill(); }
S = await boot({ TNL_VIDEO_SPARE_MB: String(10 * 1024 * 1024) });   // pretend the disk is nearly full
try {
  const e = await S.up(wide);
  t("no room on the disk: says so at once (507), nothing saved", e.s === 507 && /short on space/.test(e.j.error || ""));
} finally { S.srv.kill(); }

console.log("\nSOURCE");
const app = readFileSync(join(ROOT, "src/app/media/upload.js"), "utf8"), mix = readFileSync(join(ROOT, "src/app/compose/post-mixed.js"), "utf8");
t("the app takes videos up to 2GB everywhere (no 650MB left)", /VID_MAX=2048\*1024\*1024/.test(app) && !/650\*1024\*1024/.test(mix + readFileSync(join(ROOT, "src/app/core/wire.js"), "utf8")));
t("a too-big video says its size and what to do", app.includes("LABS takes up to 2GB. Trim it in Photos (Edit), or record at 1080p"));
t("the bar says the size, and after 100% that a big one is being made 1080p", mix.includes('"Making it 1080p for LABS… a big video takes a minute or two"') && mix.includes('" of "+vidMB({size})'));
t("the server keeps the original only when making it smaller failed", readFileSync(join(ROOT, "src/server/uploads/upload-dm-notifications.js"), "utf8").includes("if (!ok) return videoFaststart(tmp, type.ext, land);   // never worse than before"));
console.log(`\n  ${pass} passed, ${fail} failed`);
if (fail) console.log(S.log().split("\n").slice(-15).join("\n"));
process.exit(fail ? 1 : 0);
