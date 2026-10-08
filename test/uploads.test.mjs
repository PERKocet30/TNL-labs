// Uploads survive (2026-10-08): a video "failed" on a phone right as a
// deploy restarted the server. A deploy now lets uploads in flight finish,
// a whole upload gets 30 minutes not 5, and the app retries a dropped
// connection (and a 502–504 from a restart) before giving up — reporting
// why to Admin → Glitches when it does.
import { spawn } from "node:child_process";
import { request } from "node:http";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { rmSync, mkdirSync, readFileSync } from "node:fs";
const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const DATA = join(ROOT, "test/.tmp/uploads");
rmSync(DATA, { recursive: true, force: true }); mkdirSync(DATA, { recursive: true });
process.env.TNL_DATA = DATA;
const { db } = await import(join(ROOT, "src/db.js"));
const now = Date.now();
const uid = Number(db.prepare(`INSERT INTO users (username, display_name, email, password_hash, created_at, email_verified) VALUES (?,?,?,?,?,1)`).run("up", "Up", "up@x.com", "h", now).lastInsertRowid);
db.prepare(`INSERT INTO sessions (token, user_id, created_at) VALUES (?,?,?)`).run("tok-up", uid, now);
let pass = 0, fail = 0;
const t = (n, ok) => { ok ? pass++ : fail++; console.log("  " + (ok ? "✓" : "✗") + "  " + n); };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const boot = async (port) => {
  const p = spawn(process.execPath, ["--experimental-sqlite", "--no-warnings", "src/server.runtime.js"], {
    cwd: ROOT, env: { ...process.env, TNL_DATA: DATA, PORT: String(port), STRIPE_SECRET_KEY: "" }, stdio: process.env.DBG ? "inherit" : "ignore" });
  p.exited = new Promise((r) => p.on("exit", (code) => r(code)));
  for (let i = 0; i < 100; i++) { try { if ((await fetch(`http://127.0.0.1:${port}/api/health`)).ok) break; } catch {} await sleep(100); }
  return p;
};

console.log("\nA DEPLOY DURING AN UPLOAD");
let srv = await boot(8875);
const PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 13, 0x49, 0x48, 0x44, 0x52]);
const body = Buffer.concat([PNG, Buffer.alloc(200000, 1)]);
const result = new Promise((resolve) => {
  const r = request({ host: "127.0.0.1", port: 8875, path: "/api/upload/stream", method: "POST",
    headers: { Authorization: "Bearer tok-up", "Content-Type": "application/octet-stream", "Content-Length": body.length } }, (res) => {
    let d = ""; res.on("data", (c) => (d += c)); res.on("end", () => resolve({ status: res.statusCode, body: d }));
  });
  r.on("error", (e) => resolve({ status: 0, body: e.message }));
  (async () => { for (let i = 0; i < body.length; i += 20000) { r.write(body.subarray(i, i + 20000)); await sleep(150); } r.end(); })();
});
await sleep(400);
srv.kill("SIGTERM");
await sleep(300);
t("the old server is still up while an upload is coming in", srv.exitCode === null);
const res = await result;
t("…and the upload finishes", res.status === 200 && /"url":"\/uploads\//.test(res.body));
const code = await Promise.race([srv.exited, sleep(3000).then(() => "still running")]);
t("then it exits cleanly", code === 0);

console.log("\nA VIDEO SHOWS UP AT ONCE");
{
  const { execFileSync } = await import("node:child_process");
  const FF = (await import("ffmpeg-static")).default;
  const clip = join(DATA, "phone.mov");
  execFileSync(FF, ["-hide_banner", "-loglevel", "error", "-y", "-f", "lavfi", "-i", "testsrc=size=320x240:rate=25:duration=2", "-f", "lavfi", "-i", "sine=frequency=440:duration=2",
    "-c:v", "libx264", "-pix_fmt", "yuv420p", "-c:a", "aac", "-shortest", "-f", "mov", clip]);
  const raw = readFileSync(clip);
  t("(the test clip has its index at the end, like an iPhone's)", raw.indexOf("moov") > raw.indexOf("mdat"));
  srv = await boot(8877);
  const up = await (await fetch("http://127.0.0.1:8877/api/upload/stream", { method: "POST", headers: { Authorization: "Bearer tok-up", "Content-Type": "application/octet-stream" }, body: raw })).json();
  const saved = readFileSync(join(DATA, up.url.replace(/^\//, "")));
  t("it's kept as a .mov video", up.kind === "video" && up.url.endsWith(".mov"));
  t("the index now comes first, so a phone can start at once", saved.indexOf("moov") >= 0 && saved.indexOf("moov") < saved.indexOf("mdat"));
  const probe = (f) => { try { execFileSync(FF, ["-hide_banner", "-i", f]); } catch (e) { return String(e.stderr).match(/Stream #.*/g).map((x) => x.replace(/\[0x\w+\]|\(default\)|\d+ kb\/s,? ?/g, "").trim()).join(" | "); } };
  t("same streams, copied not re-encoded", probe(clip) === probe(join(DATA, up.url.replace(/^\//, ""))));
  const poster = up.poster && readFileSync(join(DATA, up.poster.replace(/^\//, "")));
  t("a cover image comes back with it", !!poster && poster[0] === 0xff && poster[1] === 0xd8);
  const img = await (await fetch("http://127.0.0.1:8877/api/upload/stream", { method: "POST", headers: { Authorization: "Bearer tok-up", "Content-Type": "application/octet-stream" }, body })).json();
  t("a photo upload is untouched (no cover)", img.kind === "image" && !("poster" in img));

  /* A post with a video gets a light copy for the feed, in the background. */
  const post = await (await fetch("http://127.0.0.1:8877/api/posts", { method: "POST", headers: { Authorization: "Bearer tok-up", "Content-Type": "application/json" },
    body: JSON.stringify({ channel: "profile", body: "clip", isWork: true, videoUrl: up.url, thumbUrl: up.poster }) })).json();
  let row = null;
  for (let i = 0; i < 100 && !row; i++) { row = db.prepare(`SELECT feed FROM video_feed WHERE src = ?`).get(up.url); if (!row) await sleep(100); }
  t("posting a video queues a light feed copy", !!row && /-feed\.mp4$/.test(row.feed));
  const feedFile = row && join(DATA, row.feed.replace(/^\//, ""));
  const fp = feedFile ? probe(feedFile) : "";
  t("…H.264 at most 720p, 30fps, index first", /h264/.test(fp) && /30 fps/.test(fp) && readFileSync(feedFile).indexOf("moov") < readFileSync(feedFile).indexOf("mdat"));
  const pid = post.post?.id || post.id;
  const sp = (await (await fetch("http://127.0.0.1:8877/api/users/up", { headers: { Authorization: "Bearer tok-up" } })).json()).posts.find((x) => x.id === pid) || {};
  t("players get the copy; the original stays the post's video", sp.videoPlayUrl === row?.feed && sp.videoUrl === up.url);
  srv.kill(); await srv.exited;
}

console.log("\nOLD VIDEOS, FIXED ON BOOT");
{
  const { execFileSync } = await import("node:child_process");
  const { copyFileSync, existsSync } = await import("node:fs");
  const up = join(DATA, "uploads"); mkdirSync(up, { recursive: true });
  copyFileSync(join(DATA, "phone.mov"), join(up, "old-1.mov"));
  copyFileSync(join(DATA, "phone.mov"), join(up, "old-2.mov"));
  const P = (v, th) => Number(db.prepare(`INSERT INTO posts (author_id, channel, body, video_url, thumb_url, is_work, created_at) VALUES (?,?,?,?,?,1,?)`).run(uid, "profile", "v", v, th, now).lastInsertRowid);
  const a = P("/uploads/old-1.mov", null), a2 = P("/uploads/old-1.mov", null), b = P("/uploads/old-2.mov", "/uploads/mine.jpg");
  const p = spawn(process.execPath, ["--experimental-sqlite", "--no-warnings", "src/server.runtime.js"], {
    cwd: ROOT, env: { ...process.env, TNL_DATA: DATA, PORT: "8878", STRIPE_SECRET_KEY: "", TNL_VIDEO_FIX_DELAY_MS: "200" }, stdio: "ignore" });
  const row = (id) => db.prepare(`SELECT video_url, thumb_url FROM posts WHERE id = ?`).get(id);
  for (let i = 0; i < 80 && !(row(a).thumb_url && row(b).video_url !== "/uploads/old-2.mov"); i++) await sleep(100);
  p.kill(); await new Promise((r) => p.on("exit", r));
  const A = row(a), A2 = row(a2), B = row(b);
  const fixed = readFileSync(join(DATA, A.video_url.replace(/^\//, "")));
  t("an old iPhone video moves to a copy with its index first", A.video_url === "/uploads/old-1-fs.mov" && fixed.indexOf("moov") < fixed.indexOf("mdat"));
  t("every post using it moves with it", A2.video_url === A.video_url);
  t("the original stays on disk (DMs and old links)", existsSync(join(up, "old-1.mov")));
  t("a video with no cover gets one", /^\/uploads\/old-1-fs-poster\.jpg$/.test(A.thumb_url || ""));
  t("a cover someone picked is never replaced", B.thumb_url === "/uploads/mine.jpg" && B.video_url === "/uploads/old-2-fs.mov");
}

srv = await boot(8876);
const t0 = Date.now(); srv.kill("SIGTERM");
const code2 = await Promise.race([srv.exited, sleep(3000).then(() => "still running")]);
t("with nothing in flight it stops at once (deploys aren't slower)", code2 === 0 && Date.now() - t0 < 1500);

const rt = readFileSync(join(ROOT, "src/server.runtime.js"), "utf8");
t("a whole upload gets 30 minutes, not Node's 5", rt.includes("server.requestTimeout = 30 * 60 * 1000"));
t("the alert's Open Admin link is trimmed", rt.includes('process.env.PUBLIC_URL || "https://labs.tnllabs.com").trim()'));

console.log("\nTHE APP RETRIES A DROPPED UPLOAD");
const src = readFileSync(join(ROOT, "src/app-08-upload.js"), "utf8");
const run = (plan) => {
  const log = { toasts: [], glitches: [], sends: 0, progress: [] };
  class XHR { constructor() { this.upload = {}; } open() {} setRequestHeader() {}
    send() { const step = plan[log.sends++] ?? plan.at(-1);
      setTimeout(() => { if (step === "net") return this.onerror(); this.status = step; this.responseText = step === 200 ? '{"url":"/uploads/v.mp4","kind":"video"}' : '{"error":"nope"}'; this.onload(); }, 1); } }
  const fakeTimeout = (fn) => setTimeout(fn, 1);
  const api = new Function("XMLHttpRequest", "API", "TOKEN", "toast", "glitch", "navigator", "setTimeout", "UPLOADXHR", "req",
    src + "\nreturn {uploadStream};")(XHR, "", "t", (m) => log.toasts.push(m), (k, d) => log.glitches.push(k + " " + d), { onLine: true }, fakeTimeout, null, null);
  return { log, go: () => api.uploadStream({ size: 50 * 1048576 }, (p) => log.progress.push(p)) };
};
let r1 = run(["net", 200]); let out = await r1.go();
t("a dropped connection is retried and the upload lands", out.url === "/uploads/v.mp4" && r1.log.sends === 2 && r1.log.toasts.some((m) => /retrying/.test(m)));
r1 = run([502, 503, 200]); out = await r1.go();
t("a 502/503 while the server restarts is retried too (twice)", out.url === "/uploads/v.mp4" && r1.log.sends === 3);
r1 = run(["net", "net", "net"]); let err = await r1.go().catch((e) => e);
t("after two retries it gives up with the reason", err.message.includes("check your connection") && r1.log.sends === 3);
t("…and reports size, time and reason to Glitches", r1.log.glitches.length === 1 && /action_failed upload 50\.0MB → Upload failed — check your connection after \d+s \(3 tries\)/.test(r1.log.glitches[0]));
r1 = run([413]); err = await r1.go().catch((e) => e);
t("a real refusal (too big) isn't retried", r1.log.sends === 1 && err.message === "nope");
console.log(`\n  ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
