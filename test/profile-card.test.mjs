// Profile card v1.0 (2026-09-29): a shared profile previews the portfolio.
// Runs the real code from src/server-10-profile-card.js against a throwaway
// database and upload folder. Builds a real card when an ffmpeg is around.
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { mkdirSync, rmSync, readFileSync, writeFileSync, existsSync, readdirSync, rename, rm } from "node:fs";
import { createHash } from "node:crypto";
import { execFile, execFileSync } from "node:child_process";
const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const DATA = join(ROOT, "test/.tmp/profile-card");
rmSync(DATA, { recursive: true, force: true }); mkdirSync(join(DATA, "uploads"), { recursive: true });
process.env.TNL_DATA = DATA;
let pass = 0, fail = 0;
const t = (n, ok) => { ok ? pass++ : fail++; console.log("  " + (ok ? "✓" : "✗") + "  " + n); };

const { db, DATA_DIR } = await import("../src/db.js");
let FFMPEG = null;
try { FFMPEG = (await import("ffmpeg-static")).default || null; } catch {}
if (!FFMPEG) try { execFileSync("ffmpeg", ["-version"], { stdio: "ignore" }); FFMPEG = "ffmpeg"; } catch {}

const src = readFileSync(join(ROOT, "src/server-10-profile-card.js"), "utf8").replace(/app\.get\([\s\S]*$/, "");
const UPLOAD_DIR = join(DATA, "uploads");
const C = new Function("db", "join", "existsSync", "mkdirSync", "readdirSync", "rename", "rm", "createHash", "execFile", "DATA_DIR", "UPLOAD_DIR", "__dirname", "FFMPEG",
  src + "\nreturn { cardShape, cardFile, profileCardTiles, profileCardArgs, buildProfileCard, profileCardMeta, CARD };")(
  db, join, existsSync, mkdirSync, readdirSync, rename, rm, createHash, execFile, DATA_DIR, UPLOAD_DIR, join(ROOT, "src"), FFMPEG);

const now = Date.now();
const uid = Number(db.prepare(`INSERT INTO users (username, display_name, email, password_hash, created_at) VALUES ('maker','Maker','m@x.test','x',?)`).run(now).lastInsertRowid);
let n = 0;
const piece = (opts = {}) => {
  const name = `p${++n}.jpg`;
  if (FFMPEG) execFileSync(FFMPEG, ["-v", "error", "-y", "-f", "lavfi", "-i", `color=c=0x${(n * 1234567 % 0xFFFFFF).toString(16).padStart(6, "0")}:s=600x800`, "-frames:v", "1", join(UPLOAD_DIR, name)]);
  else writeFileSync(join(UPLOAD_DIR, name), "x");
  return Number(db.prepare(`INSERT INTO posts (author_id, channel, body, is_work, image_url, shared_from, created_at) VALUES (?,?,?,?,?,?,?)`)
    .run(uid, "general", "w", opts.work ?? 1, opts.url ?? "/uploads/" + name, opts.shared ?? null, now + n).lastInsertRowid);
};

console.log("\nTHE GRID FITS THE WORK");
t("1 piece: no grid (the page uses that piece)", C.cardShape(1) === null);
t("2 → 2 across, 3 → 3 across", String(C.cardShape(2)) === "2,1" && String(C.cardShape(3)) === "3,1");
t("4–5 → 2×2, 6–7 → 3×2, 8+ → 4×2", String(C.cardShape(5)) === "2,2" && String(C.cardShape(7)) === "3,2" && String(C.cardShape(20)) === "4,2");

console.log("\nONLY REAL, PUBLISHED WORK");
piece();
t("one piece: no card", C.profileCardTiles(uid) === null);
piece({ work: 0 }); piece({ shared: 1 }); piece({ url: "/uploads/../../etc/passwd" }); piece({ url: "https://elsewhere.test/a.jpg" }); piece({ url: "/uploads/gone.jpg" });
t("chat posts, reshares, outside links, missing files and ../ paths are skipped", C.profileCardTiles(uid) === null);
t("cardFile never leaves the uploads folder", C.cardFile("/uploads/../x") === null && C.cardFile("/etc/passwd") === null && C.cardFile("/uploads/a/b.jpg") === null);
piece(); piece();
let card = C.profileCardTiles(uid);
t("three pieces: a 3-across card", card && String(card.shape) === "3,1" && card.tiles.length === 3);
const h1 = card.hash;
piece();
card = C.profileCardTiles(uid);
t("new work changes the card's address, so previews refresh", card.hash !== h1 && String(card.shape) === "2,2");
for (let i = 0; i < 6; i++) piece();
card = C.profileCardTiles(uid);
t("never more than 8 pieces", card.tiles.length === 8 && String(card.shape) === "4,2");

console.log("\nTHE LAYOUT");
const args = C.profileCardArgs(card, "/tmp/out.jpg"), graph = args[args.indexOf("-filter_complex") + 1];
const spots = [...graph.matchAll(/overlay=(\d+):(\d+)\[c\d+\]/g)].map((m) => [+m[1], +m[2]]);
t("8 tiles laid in a 4×2 grid inside 1200×630", spots.length === 8 && spots.every(([x, y]) => x < 1200 && y < 630) && new Set(spots.map((s) => s[0])).size === 4 && new Set(spots.map((s) => s[1])).size === 2);
t("each tile fills its cell (crop, not letterbox)", (graph.match(/force_original_aspect_ratio=increase,crop=/g) || []).length === 8);
t("the TNL mark sits bottom-left", /overlay=18:548\[out\]/.test(graph) && args.includes("[out]"));
t("Paper behind the gutters", graph.startsWith("color=c=0xF7F1F1:s=1200x630"));

console.log("\nTHE PAGE");
const page = readFileSync(join(ROOT, "src/server-10-collabs-beats-showroom.js"), "utf8");
t("the profile page's preview uses the card when there is one", /const card = profileCardMeta\(u\.id/.test(page) && /ogImage = card \? card\.url/.test(page));
t("…and says it's 1200×630", /ogW = card \? card\.w/.test(page) && C.CARD.w === 1200 && C.CARD.h === 630);

if (FFMPEG) {
  console.log("\nA REAL CARD");
  const file = await C.buildProfileCard(uid, card);
  const jpg = readFileSync(file);
  let i = 2, w = 0, h = 0;
  while (i < jpg.length) { const m = jpg[i + 1], len = jpg.readUInt16BE(i + 2); if (m >= 0xC0 && m <= 0xC2) { h = jpg.readUInt16BE(i + 5); w = jpg.readUInt16BE(i + 7); break; } i += 2 + len; }
  t("ffmpeg builds a 1200×630 JPEG", w === 1200 && h === 630);
  t("asking again reuses the saved card", (await C.buildProfileCard(uid, card)) === file);
  piece(); const next = C.profileCardTiles(uid); await C.buildProfileCard(uid, next); await new Promise((r) => setTimeout(r, 150));
  t("a newer card replaces the old one on the volume", readdirSync(join(DATA_DIR, "og")).filter((f) => f.startsWith(`u${uid}-`) && !f.includes(".tmp")).length === 1);
  execFileSync(FFMPEG, ["-v", "error", "-y", "-f", "lavfi", "-i", "testsrc=s=640x360:d=3", "-pix_fmt", "yuv420p", join(UPLOAD_DIR, "v.mp4")]);
  db.prepare(`INSERT INTO posts (author_id, channel, body, is_work, video_url, created_at) VALUES (?,?,?,?,?,?)`).run(uid, "general", "v", 1, "/uploads/v.mp4", now + 999);
  const withVideo = C.profileCardTiles(uid);
  t("a video with no thumbnail gives a frame of itself", withVideo.tiles[0].video === true);
  const vf = await C.buildProfileCard(uid, withVideo);
  t("…and the card still builds", existsSync(vf));
} else console.log("\n  (no ffmpeg here — skipped building a real card)");

console.log(`\n  ${pass} passed, ${fail} failed`);
