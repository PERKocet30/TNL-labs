// Profile card v2.0 (2026-09-29): a shared profile previews like Instagram's —
// picture, name, bio and the work.
// Runs the real code from src/server-10-profile-card.js against a throwaway
// database and upload folder. Builds a real card when an ffmpeg is around —
// set FFMPEG_TEST_BIN to try a specific build (production's is npm's
// ffmpeg-static 5.3 = ffmpeg 7.0.2, which has libass but no drawtext).
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
let FFMPEG = process.env.FFMPEG_TEST_BIN || null;
if (!FFMPEG) try { FFMPEG = (await import("ffmpeg-static")).default || null; } catch {}
if (!FFMPEG) try { execFileSync("ffmpeg", ["-version"], { stdio: "ignore" }); FFMPEG = "ffmpeg"; } catch {}

const src = readFileSync(join(ROOT, "src/server-10-profile-card.js"), "utf8").replace(/app\.get\([\s\S]*$/, "");
const UPLOAD_DIR = join(DATA, "uploads");
const errors = [];
const C = new Function("db", "join", "dirname", "existsSync", "mkdirSync", "readdirSync", "writeFileSync", "rename", "rm", "createHash", "execFile", "logError", "DATA_DIR", "UPLOAD_DIR", "__dirname", "FFMPEG",
  src + "\nreturn { cardShape, cardFile, cardWrap, cardClean, profileCardTiles, profileCardArgs, buildProfileCard, profileCardMeta, CARD };")(
  db, join, dirname, existsSync, mkdirSync, readdirSync, writeFileSync, rename, rm, createHash, execFile, (...a) => errors.push(a), DATA_DIR, UPLOAD_DIR, join(ROOT, "src"), FFMPEG);

const now = Date.now();
const uid = Number(db.prepare(`INSERT INTO users (username, display_name, email, password_hash, bio, created_at) VALUES ('maker','Maker Name 🎧','m@x.test','x',?,?)`)
  .run("Producer out of Queens 🎧 Making loops for anyone who needs one. Collabs open, DM me with your idea and a reference track.", now).lastInsertRowid);
const U = () => db.prepare(`SELECT * FROM users WHERE id = ?`).get(uid);
let n = 0;
const img = (name, spec) => { if (FFMPEG) execFileSync(FFMPEG, ["-v", "error", "-y", "-f", "lavfi", "-i", spec, "-frames:v", "1", join(UPLOAD_DIR, name)]); else writeFileSync(join(UPLOAD_DIR, name), "x"); };
const piece = (opts = {}) => {
  const name = `p${++n}.jpg`;
  img(name, `color=c=0x${(n * 1234567 % 0xFFFFFF).toString(16).padStart(6, "0")}:s=600x800`);
  return Number(db.prepare(`INSERT INTO posts (author_id, channel, body, is_work, image_url, shared_from, created_at) VALUES (?,?,?,?,?,?,?)`)
    .run(uid, "general", "w", opts.work ?? 1, opts.url ?? "/uploads/" + name, opts.shared ?? null, now + n).lastInsertRowid);
};

console.log("\nWHO THEY ARE, LIKE INSTAGRAM");
let card = C.profileCardTiles(U());
t("name, @username and bio are on the card", card.text.name === "Maker Name" && card.text.handle === "@maker" && card.text.bio.length > 0);
t("emoji are taken out (the font has none — they'd be boxes)", !/🎧/.test(card.text.name + card.text.bio.join(" ")));
t("the bio wraps and stops at 4 lines with an ellipsis", card.text.bio.length === 4 && card.text.bio.every((l) => l.length <= 28) && card.text.bio[3].endsWith("…"));
t("a short bio stays whole", String(C.cardWrap("Tailor. NYC.", 27, 4)) === "Tailor. NYC.");
t("no picture: their initials instead", card.avatar === null && card.text.initials === "MA");
t("how much they've made", card.text.stats === "0 pieces");
t("no work yet still gets a card (the mark fills the grid)", card.shape === null && card.tiles.length === 0);

console.log("\nTHE WORK");
t("grid by how much there is: 1, 2, 3 across, then 2×2, then 3×2", String(C.cardShape(1)) === "1,1" && String(C.cardShape(3)) === "3,1" && String(C.cardShape(5)) === "2,2" && String(C.cardShape(9)) === "3,2");
piece({ work: 0 }); piece({ shared: 1 }); piece({ url: "/uploads/../../etc/passwd" }); piece({ url: "https://elsewhere.test/a.jpg" }); piece({ url: "/uploads/gone.jpg" });
t("chat posts, reshares, outside links, missing files and ../ paths never reach the grid", C.profileCardTiles(U()).tiles.length === 0);
t("cardFile never leaves the uploads folder", C.cardFile("/uploads/../x") === null && C.cardFile("/etc/passwd") === null && C.cardFile("/uploads/a/b.jpg") === null);
piece(); piece(); piece();
card = C.profileCardTiles(U());
t("three pieces: three across", String(card.shape) === "3,1" && card.tiles.length === 3);
const h1 = card.hash;
piece();
t("new work → new card address, so previews refresh", C.profileCardTiles(U()).hash !== h1);
const h2 = C.profileCardTiles(U()).hash;
db.prepare(`UPDATE users SET bio = 'Tailor.' WHERE id = ?`).run(uid);
t("an edited bio → new card address too", C.profileCardTiles(U()).hash !== h2);
img("face.jpg", "color=c=0x98FC68:s=400x400");
db.prepare(`UPDATE users SET avatar_url = '/uploads/face.jpg' WHERE id = ?`).run(uid);
card = C.profileCardTiles(U());
t("…and a new profile picture", card.avatar && card.avatar.endsWith("face.jpg"));
for (let i = 0; i < 6; i++) piece();
card = C.profileCardTiles(U());
t("never more than 6 pieces, 3×2", card.tiles.length === 6 && String(card.shape) === "3,2");

console.log("\nTHE LAYOUT");
const dir = join(DATA, "t"); mkdirSync(dir, { recursive: true });
const args = C.profileCardArgs(card, "/tmp/out.jpg", dir), graph = args[args.indexOf("-filter_complex") + 1];
const tiles = [...graph.matchAll(/\[t\d+\]overlay=(\d+):(\d+)/g)].map((m) => [+m[1], +m[2]]);
t("the grid sits right of the panel, inside 1200×630", tiles.length === 6 && tiles.every(([x, y]) => x >= 440 && x < 1200 && y < 630));
t("each piece fills its cell (crop, not letterbox)", (graph.match(/force_original_aspect_ratio=increase,crop=/g) || []).length >= 6);
t("the picture is a circle", /\[av\]overlay=48:56/.test(graph) && /hypot\(/.test(graph));
const ass = readFileSync(join(dir, "card.ass"), "utf8");
t("name, handle, bio, stats and LABS ® are drawn in Archivo by libass", /\bass=filename='[^']*card\.ass':fontsdir='[^']*assets\/fonts'/.test(graph) && /Style: Card,Archivo,/.test(ass) && ["Maker Name", "@maker", "Tailor.", "pieces", "LABS ®"].every((x) => ass.includes(x)));
t("no drawtext — production's ffmpeg doesn't have it", !/drawtext/.test(graph));
t("text goes in a file, never into the filter string", !graph.includes("Tailor"));
const tricky = C.profileCardArgs({ ...card, text: { ...card.text, bio: ["{\\\\b1\\\\fs90}big \\\\N break"] } }, "/tmp/out.jpg", dir);
const trickyAss = readFileSync(join(dir, "card.ass"), "utf8").split("\n").find((l) => l.includes("big"));
t("a bio can't restyle the card (no { } or \\ reach libass)", trickyAss && !/\}big|\{\\\\b1\\\\fs90|\\\\N break/.test(trickyAss.slice(trickyAss.indexOf("}") + 1)));
t("ASS colours are BGR (#5E5856 → &H56585E&)", ass.includes("\\c&H56585E&"));
const bare = C.profileCardArgs(card, "/tmp/out.jpg", null), bareGraph = bare[bare.indexOf("-filter_complex") + 1];
t("the fallback build is the grid alone, full width", !/drawtext/.test(bareGraph) && /\[t0\]overlay=0:0/.test(bareGraph));
t("the fonts ship with the app, with their licence", existsSync(join(ROOT, "assets/fonts/Archivo-Bold.ttf")) && existsSync(join(ROOT, "assets/fonts/Archivo-Regular.ttf")) && existsSync(join(ROOT, "assets/fonts/OFL-Archivo.txt")));

console.log("\nTHE PAGE");
const page = readFileSync(join(ROOT, "src/server-10-collabs-beats-showroom.js"), "utf8");
t("the profile page's preview is the card", /const card = profileCardMeta\(u, baseUrl\(req\)\)/.test(page) && /ogImage = card \? card\.url/.test(page));
t("…and says it's 1200×630", /ogW = card \? card\.w/.test(page) && C.CARD.w === 1200 && C.CARD.h === 630);

if (FFMPEG) {
  console.log("\nA REAL CARD");
  const size = (file) => { const jpg = readFileSync(file); let i = 2; while (i < jpg.length) { const m = jpg[i + 1], len = jpg.readUInt16BE(i + 2); if (m >= 0xC0 && m <= 0xC2) return [jpg.readUInt16BE(i + 7), jpg.readUInt16BE(i + 5)]; i += 2 + len; } return [0, 0]; };
  const file = await C.buildProfileCard(uid, card);
  t("ffmpeg builds a 1200×630 JPEG with text" + (errors.length ? " — " + JSON.stringify(errors).slice(0, 300) : ""), String(size(file)) === "1200,630" && !errors.length);
  t("asking again reuses the saved card", (await C.buildProfileCard(uid, card)) === file);
  piece(); await C.buildProfileCard(uid, C.profileCardTiles(U()));
  t("a newer card replaces the old one, and no temp files are left", readdirSync(join(DATA_DIR, "og")).filter((f) => f.startsWith(`u${uid}-`)).length === 1 && !readdirSync(join(DATA_DIR, "og")).some((f) => f.startsWith("tmp-")));
  execFileSync(FFMPEG, ["-v", "error", "-y", "-f", "lavfi", "-i", "testsrc=s=640x360:d=3", "-pix_fmt", "yuv420p", join(UPLOAD_DIR, "v.mp4")]);
  db.prepare(`INSERT INTO posts (author_id, channel, body, is_work, video_url, created_at) VALUES (?,?,?,?,?,?)`).run(uid, "general", "v", 1, "/uploads/v.mp4", now + 999);
  const withVideo = C.profileCardTiles(U());
  t("a video with no thumbnail gives a frame of itself", withVideo.tiles[0].video === true && existsSync(await C.buildProfileCard(uid, withVideo)));
  const other = Number(db.prepare(`INSERT INTO users (username, display_name, email, password_hash, created_at) VALUES ('fresh','Fresh','f@x.test','x',?)`).run(now).lastInsertRowid);
  const empty = C.profileCardTiles(db.prepare(`SELECT * FROM users WHERE id = ?`).get(other));
  t("someone brand new (no picture, no work) still gets a card", String(size(await C.buildProfileCard(other, empty))) === "1200,630");
} else console.log("\n  (no ffmpeg here — skipped building real cards)");

console.log(`\n  ${pass} passed, ${fail} failed`);
