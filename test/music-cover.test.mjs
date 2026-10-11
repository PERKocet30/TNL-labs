// The Music lab's cover (2026-10-11): "should become whatever song cover is
// being played the most in the app." The labs list's Music card wears the
// cover of the song with the most listeners this week — a person counted
// once a day, never the artist on their own song; no cover, no contest;
// nothing this week → the most-played song of all time.
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { rmSync, mkdirSync, readFileSync } from "node:fs";
const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const DATA = join(ROOT, "test/.tmp/music-cover");
rmSync(DATA, { recursive: true, force: true }); mkdirSync(DATA, { recursive: true });
process.env.TNL_DATA = DATA;
const { db } = await import(join(ROOT, "src/db.js"));
const now = Date.now();
const U = (n) => { const id = Number(db.prepare(`INSERT INTO users (username, display_name, email, password_hash, created_at, email_verified) VALUES (?,?,?,?,?,1)`)
  .run(n, n, n + "@x.com", "h", now).lastInsertRowid); db.prepare(`INSERT INTO sessions (token, user_id, created_at) VALUES (?,?,?)`).run("tok-" + n, id, now); return id; };
const artA = U("arta"), artB = U("artb"), l1 = U("l1"), l2 = U("l2"), l3 = U("l3");
const T = (u, title, art, plays = 0) => Number(db.prepare(`INSERT INTO tracks (user_id, title, url, artwork_url, plays, created_at) VALUES (?,?,?,?,?,?)`)
  .run(u, title, "/uploads/" + title + ".mp3", art, plays, now).lastInsertRowid);
const x = T(artA, "x", "/uploads/x.jpg", 500), y = T(artB, "y", "/uploads/y.jpg", 2), z = T(artB, "z", "", 0);

const PORT = 8869, B = `http://localhost:${PORT}`;
let pass = 0, fail = 0;
const t = (n, ok) => { ok ? pass++ : fail++; console.log("  " + (ok ? "✓" : "✗") + "  " + n); };
const srv = spawn(process.execPath, ["--experimental-sqlite", "--no-warnings", "src/server.runtime.js"], {
  cwd: ROOT, env: { ...process.env, TNL_DATA: DATA, PORT: String(PORT), STRIPE_SECRET_KEY: "", TNL_NO_VIDEO_FIX: "1", TNL_NO_WATCH: "1" }, stdio: "ignore" });
const play = (tok, id) => fetch(`${B}/api/tracks/${id}/play`, { method: "POST", headers: { Authorization: "Bearer tok-" + tok } });
const cover = async () => (((await (await fetch(`${B}/api/labs`, { headers: { Authorization: "Bearer tok-l1" } })).json()).labArt) || {}).culture || null;
try {
  for (let i = 0; i < 100; i++) { try { if ((await fetch(B + "/api/health")).ok) break; } catch {} await new Promise((r) => setTimeout(r, 100)); }
  console.log("\nNOTHING PLAYED THIS WEEK");
  let c = await cover();
  t("the most-played song of all time wears it", c && c.trackId === x && c.url === "/uploads/x.jpg");

  console.log("\nTHIS WEEK'S MOST PLAYED");
  for (let i = 0; i < 9; i++) await play("arta", x);   // the artist on repeat
  for (let i = 0; i < 5; i++) await play("l1", x);     // one fan on repeat, same day
  await play("l1", y); await play("l2", y);            // two listeners
  for (let i = 0; i < 6; i++) await play("l3", z);     // the most plays, but no cover
  c = await cover();
  t("the song with the most listeners this week wears it, though another has 500 plays all-time", c && c.trackId === y && c.url === "/uploads/y.jpg");
  t("…with its title and artist", c && c.title === "y" && c.username === "artb");
  t("every play is logged with when it happened", db.prepare(`SELECT COUNT(*) n FROM track_plays`).get().n === 22);   // 9 + 5 + 2 + 6

  console.log("\nONLY THIS WEEK");
  for (const u of [l2, l3]) for (let d = 8; d < 12; d++)
    db.prepare(`INSERT INTO track_plays (track_id, user_id, at) VALUES (?,?,?)`).run(x, u, now - d * 86400000);
  t("older plays don't count", (await cover()).trackId === y);
  await play("l2", x); await play("l3", x);
  t("…and three listeners this week take it back", (await cover()).trackId === x);

  console.log("\nTHE CARD");
  const app = readFileSync(join(ROOT, "public/index.html"), "utf8");
  t("the labs list's Music card shows it", app.includes("if(A.labArt&&A.labArt[l.id])art=A.labArt[l.id];") && app.includes('"Most played: "+x.art.title'));
  db.prepare(`UPDATE users SET suspended = 1 WHERE id = ?`).run(artA);
  t("a suspended artist's cover is never shown", (await cover()).trackId === y);
} finally { srv.kill(); }
console.log(`\n  ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
