// SCIENTIST v2 — 2026-10-11. The live checks, run against a local copy of
// the app: green on a copy that has members and work, red (with the reason)
// on an empty one — the "volume came up empty" day it exists to catch — and
// it never writes a row while it looks.
import { spawn, execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { rmSync, mkdirSync, writeFileSync, readFileSync } from "node:fs";
import ffmpeg from "ffmpeg-static";
const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const FULL = join(ROOT, "test/.tmp/scientist-full"), EMPTY = join(ROOT, "test/.tmp/scientist-empty");
for (const d of [FULL, EMPTY]) { rmSync(d, { recursive: true, force: true }); mkdirSync(join(d, "uploads"), { recursive: true }); }

/* A copy with someone in it: one member, one piece of work with a real
   image (a flat test pattern), and last night's backup. */
process.env.TNL_DATA = FULL;
const { db } = await import(join(ROOT, "src/db.js"));
const now = Date.now();
execFileSync(ffmpeg, ["-v", "error", "-f", "lavfi", "-i", "color=c=gray:s=600x600", "-frames:v", "1", join(FULL, "uploads/piece.jpg")]);
const uid = Number(db.prepare(`INSERT INTO users (username, display_name, email, password_hash, created_at, email_verified, published) VALUES (?,?,?,?,?,1,1)`)
  .run("maker", "Maker", "m@x.com", "h", now).lastInsertRowid);
const post = Number(db.prepare(`INSERT INTO posts (author_id, channel, body, is_work, image_url, created_at) VALUES (?,?,?,1,?,?)`)
  .run(uid, "profile", "a piece", "/uploads/piece.jpg", now).lastInsertRowid);
mkdirSync(join(FULL, "backups"), { recursive: true });
writeFileSync(join(FULL, "backups/tnl-last-night-auto.db"), "x");
const TABLES = ["users", "posts", "sessions", "rep_events", "likes", "comments", "notifications"];
const counts = () => TABLES.map((t) => { try { return db.prepare(`SELECT COUNT(*) n FROM ${t}`).get().n; } catch { return -1; } }).join(",");
const before = counts();

let pass = 0, fail = 0;
const t = (n, ok) => { ok ? pass++ : fail++; console.log("  " + (ok ? "✓" : "✗") + "  " + n); };

async function boot(data, port) {
  const srv = spawn(process.execPath, ["--experimental-sqlite", "--no-warnings", "src/server.runtime.js"], {
    cwd: ROOT, env: { ...process.env, TNL_DATA: data, PORT: String(port), STRIPE_SECRET_KEY: "", TNL_NO_VIDEO_FIX: "1" }, stdio: "ignore" });
  for (let i = 0; i < 100; i++) { try { if ((await fetch(`http://localhost:${port}/api/health`)).ok) break; } catch {} await new Promise((r) => setTimeout(r, 100)); }
  return srv;
}
const scientist = (port) => new Promise((ok) => {
  const p = spawn(process.execPath, ["scripts/scientist.mjs"], { cwd: ROOT, env: { ...process.env, BASE: `http://localhost:${port}`, SCIENTIST_TOO_SLOW: "20000" } });
  let out = ""; p.stdout.on("data", (d) => out += d); p.stderr.on("data", (d) => out += d);
  p.on("close", (code) => ok({ code, out }));
});

const full = await boot(FULL, 8891), empty = await boot(EMPTY, 8892);
try {
  console.log("\nA COPY WITH MEMBERS AND WORK");
  const h = await (await fetch("http://localhost:8891/api/health")).json();
  t("health still says ok and which version", h.ok === true && "commit" in h);
  t("…and now what's behind it: db, members, volume, uploads, backup", h.checks?.db && h.checks.members && h.checks.volume && h.checks.uploads && h.checks.backup);
  t("…as yes/no only — nothing a stranger can count", Object.values(h.checks).every((v) => typeof v === "boolean"));
  const r = await scientist(8891);
  if (r.code !== 0) console.log(r.out.split("\n").filter((l) => l.startsWith("FAIL")).join("\n"));
  t("the scientist comes back all green", r.code === 0);
  for (const [what, line] of [
    ["the shell's scripts compile", "PASS  app shell loads as HTML"],
    ["the database, members and backup are there", "PASS  health responds"],
    ["admin stays locked", "PASS  admin stays locked: /api/admin/members"],
    ["/api/me is not cached", "PASS  signed out, /api/me says no"],
    ["a profile previews, with its image", "PASS  a profile page previews: preview image loads"],
    ["a post previews", "PASS  a post page previews"],
    ["the profile card renders", "PASS  the profile card renders"],
    ["the service worker can update", "PASS  service worker"],
  ]) t(`  checked: ${what}`, r.out.includes(line));
  t("it wrote nothing while it looked", counts() === before);

  console.log("\nAN EMPTY COPY — the volume didn't mount");
  const e = await scientist(8892);
  t("the scientist fails", e.code === 1);
  t("…and says there are no members", e.out.includes("no members — this is an empty database"));
  t("…and that the front page is empty", e.out.includes("the front page is empty"));
  t("…and that there's no backup", e.out.includes("no backup in the last 36 hours"));
  t("…and still checks what it can (shell, admin lock)", e.out.includes("PASS  app shell loads as HTML") && e.out.includes("PASS  admin stays locked: /api/admin/overview"));

  console.log("\nREAD-ONLY BY CONSTRUCTION");
  const src = readFileSync(join(ROOT, "scripts/scientist.mjs"), "utf8");
  t("no POST, PUT, PATCH or DELETE anywhere in it", !/method\s*:|["'](POST|PUT|PATCH|DELETE)["']/.test(src));
  t("no sign-in, no token, no cookie", !/authorization|cookie|Bearer/i.test(src));
  const wf = readFileSync(join(ROOT, ".github/workflows/after-deploy.yml"), "utf8");
  t("it runs on GitHub every day, so a red run emails someone", /schedule:\s*\n\s*- cron:/.test(wf));
} finally { full.kill(); empty.kill(); }
console.log(`\n  ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
