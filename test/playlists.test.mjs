// Playlists (2026-10-12): "you listen to music and build your own playlist
// while in the lab."
// Yours only; a song goes in once; deleted songs and suspended artists drop out.
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { rmSync, mkdirSync, readFileSync } from "node:fs";
const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const DATA = join(ROOT, "test/.tmp/playlists");
rmSync(DATA, { recursive: true, force: true }); mkdirSync(DATA, { recursive: true });
process.env.TNL_DATA = DATA;
const { db } = await import(join(ROOT, "src/db.js"));
const now = Date.now();
const U = (n) => { const id = Number(db.prepare(`INSERT INTO users (username, display_name, email, password_hash, created_at, email_verified) VALUES (?,?,?,?,?,1)`)
  .run(n, n, n + "@x.com", "h", now).lastInsertRowid); db.prepare(`INSERT INTO sessions (token, user_id, created_at) VALUES (?,?,?)`).run("tok-" + n, id, now); return id; };
const me = U("me"), other = U("other"), artist = U("artist");
const T = (u, title, art) => Number(db.prepare(`INSERT INTO tracks (user_id, title, url, artwork_url, duration_ms, created_at) VALUES (?,?,?,?,?,?)`)
  .run(u, title, "/uploads/" + title + ".mp3", art, 180000, now).lastInsertRowid);
const a = T(artist, "a", "/uploads/a.jpg"), b = T(artist, "b", "/uploads/b.jpg"), c = T(other, "c", "/uploads/c.jpg"), d = T(artist, "d", "/uploads/d.jpg"), e = T(other, "e", "");

let pass = 0, fail = 0;
const t = (n, ok) => { ok ? pass++ : fail++; console.log("  " + (ok ? "✓" : "✗") + "  " + n); };
const PORT = 8871, B = `http://localhost:${PORT}`;
const srv = spawn(process.execPath, ["--experimental-sqlite", "--no-warnings", "src/server.runtime.js"], {
  cwd: ROOT, env: { ...process.env, TNL_DATA: DATA, PORT: String(PORT), STRIPE_SECRET_KEY: "", TNL_NO_VIDEO_FIX: "1", TNL_NO_WATCH: "1" }, stdio: "ignore" });
const call = async (who, method, path, body) => {
  const r = await fetch(B + path, { method, headers: { "content-type": "application/json", authorization: "Bearer tok-" + who }, body: body ? JSON.stringify(body) : undefined });
  return { status: r.status, ...(await r.json().catch(() => ({}))) };
};
try {
  for (let i = 0; i < 100; i++) { try { if ((await fetch(B + "/api/health")).ok) break; } catch {} await new Promise((r) => setTimeout(r, 100)); }
  console.log("\nMAKING ONE WHILE YOU LISTEN");
  let r = await call("me", "POST", "/api/playlists", { name: "  Late   night  ", trackId: a });
  const pl = r.playlist;
  t("a new playlist can start with the song that's playing", r.status === 200 && pl.name === "Late night" && pl.count === 1 && pl.tracks[0].id === a);
  t("no name, no playlist", (await call("me", "POST", "/api/playlists", { name: "   " })).status === 400);
  for (const x of [b, c, d, e]) r = await call("me", "POST", `/api/playlists/${pl.id}/tracks`, { trackId: x });
  t("songs go in the order you add them", r.playlist.trackIds.join() === [a, b, c, d, e].join());
  r = await call("me", "POST", `/api/playlists/${pl.id}/tracks`, { trackId: b });
  t("…and a song goes in once", r.already === true && r.playlist.count === 5);
  t("its length adds up (5 × 3 min)", r.playlist.durationMs === 5 * 180000);
  t("its cover is four songs' covers", JSON.stringify(r.playlist.covers) === JSON.stringify(["/uploads/a.jpg", "/uploads/b.jpg", "/uploads/c.jpg", "/uploads/d.jpg"]));
  t("a song that isn't there can't go in", (await call("me", "POST", `/api/playlists/${pl.id}/tracks`, { trackId: 9999 })).status === 404);

  console.log("\nYOURS ONLY");
  t("someone else can't open it", (await call("other", "GET", `/api/playlists/${pl.id}`)).status === 404);
  t("…or add to it", (await call("other", "POST", `/api/playlists/${pl.id}/tracks`, { trackId: c })).status === 404);
  t("…or rename it", (await call("other", "PATCH", `/api/playlists/${pl.id}`, { name: "mine now" })).status === 404);
  t("…or delete it", (await call("other", "DELETE", `/api/playlists/${pl.id}`)).status === 404);
  t("…and it isn't in their list", (await call("other", "GET", "/api/playlists")).playlists.length === 0);
  t("signed out: nothing", (await fetch(B + "/api/playlists")).status === 401);

  console.log("\nCHANGING IT");
  r = await call("me", "DELETE", `/api/playlists/${pl.id}/tracks/${c}`);
  t("a song comes out", r.playlist.count === 4 && !r.playlist.trackIds.includes(c));
  r = await call("me", "PATCH", `/api/playlists/${pl.id}`, { name: "Drive" });
  t("it can be renamed", r.playlist.name === "Drive");
  db.prepare(`DELETE FROM tracks WHERE id = ?`).run(d);
  r = await call("me", "GET", `/api/playlists/${pl.id}`);
  t("a deleted song drops out", r.playlist.count === 3 && !r.playlist.trackIds.includes(d));
  db.prepare(`UPDATE users SET suspended = 1 WHERE id = ?`).run(artist);
  r = await call("me", "GET", `/api/playlists/${pl.id}`);
  t("a suspended artist's songs aren't played from it", r.playlist.trackIds.join() === String(e));
  db.prepare(`UPDATE users SET suspended = 0 WHERE id = ?`).run(artist);
  t("deleting it leaves the songs in the library", (await call("me", "DELETE", `/api/playlists/${pl.id}`)).ok === true
    && (await call("me", "GET", "/api/playlists")).playlists.length === 0 && db.prepare(`SELECT COUNT(*) n FROM tracks`).get().n === 4);

  console.log("\nIN THE LAB");
  const app = readFileSync(join(ROOT, "public/index.html"), "utf8");
  t("every song has ⊕ Add to a playlist, and the bar has it for what's playing", app.includes('data-trkadd="${t.id}"') && app.includes("data-nowadd"));
  t("the library has Songs | Playlists", app.includes('data-musv="playlists"'));
} finally { srv.kill(); }
console.log(`\n  ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
