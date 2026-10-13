// Links (2026-10-13): "Make sure all links work." Visits every public page
// on a test copy — home, the tournament (page, rules, scoreboard), a
// profile, a piece, a song, a listing, the policy pages — and
// follows every link, picture and preview image on them. None may be dead.
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { rmSync, mkdirSync, writeFileSync, readFileSync } from "node:fs";
const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const DATA = join(ROOT, "test/.tmp/links");
rmSync(DATA, { recursive: true, force: true }); mkdirSync(join(DATA, "uploads"), { recursive: true });
// placeholder files, so the pictures the pages point at exist
const png = readFileSync(join(ROOT, "public/icon-512.png"));
for (const f of ["work.jpg", "cover.jpg", "tee.jpg", "av.jpg"]) writeFileSync(join(DATA, "uploads", f), png);
writeFileSync(join(DATA, "uploads", "song.mp3"), Buffer.alloc(2048));
process.env.TNL_DATA = DATA;
const { db } = await import(join(ROOT, "src/db.js"));
const now = Date.now();
const uid = Number(db.prepare(`INSERT INTO users (username, display_name, email, password_hash, created_at, email_verified, avatar_url, bio) VALUES ('artist','Ana','a@x.com','h',?,1,'/uploads/av.jpg','I paint')`).run(now).lastInsertRowid);
const post = Number(db.prepare(`INSERT INTO posts (author_id, channel, body, is_work, image_url, media_w, media_h, created_at) VALUES (?,?,?,1,'/uploads/work.jpg',512,512,?)`).run(uid, "graphic-design", "A piece #art", now).lastInsertRowid);
const song = Number(db.prepare(`INSERT INTO tracks (user_id, title, url, artwork_url, duration_ms, created_at) VALUES (?,?,'/uploads/song.mp3','/uploads/cover.jpg',120000,?)`).run(uid, "Night Song", now).lastInsertRowid);
const tee = Number(db.prepare(`INSERT INTO listings (seller_id, title, description, price_cents, images, status, created_at, updated_at) VALUES (?,?,?,4500,'["/uploads/tee.jpg"]','active',?,?)`).run(uid, "Tee", "Cotton", now, now).lastInsertRowid);

let pass = 0, fail = 0;
const t = (n, ok) => { ok ? pass++ : fail++; console.log("  " + (ok ? "✓" : "✗") + "  " + n); };
const PORT = 8877, B = `http://localhost:${PORT}`;
const srv = spawn(process.execPath, ["--experimental-sqlite", "--no-warnings", "src/server.runtime.js"], {
  cwd: ROOT, env: { ...process.env, TNL_DATA: DATA, PORT: String(PORT), STRIPE_SECRET_KEY: "", TNL_NO_VIDEO_FIX: "1", TNL_NO_WATCH: "1" }, stdio: "ignore" });
try {
  for (let i = 0; i < 100; i++) { try { if ((await fetch(B + "/api/health")).ok) break; } catch {} await new Promise((r) => setTimeout(r, 100)); }
  // the event tables are made when the server starts
  db.prepare(`INSERT INTO events (slug, title, brief, prize, published, format, schedule, created_at, updated_at) VALUES ('cup','Cup','Enter','$100',1,'poll',?,?,?)`)
    .run(JSON.stringify([{ phase: "submit", start: now - 1000, end: now + 86400000 }, { phase: "qualify", start: now + 86400000, end: now + 2 * 86400000 }, { phase: "results", start: now + 2 * 86400000, end: null }]), now, now);

  console.log("\nEVERY LINK ON EVERY PUBLIC PAGE");
  const seeds = ["/", "/tournament", "/e/cup", "/e/cup/rules", "/e/cup/board", "/u/artist", `/p/${post}`, `/s/${song}`, `/m/${tee}`, "/shop", "/policies", "/terms", "/privacy", "/contact", "/robots.txt", "/manifest.webmanifest"];
  const seen = new Map(), bad = [], q = seeds.map((u) => [u, "(start)"]);
  let pages = 0;
  while (q.length && seen.size < 400) {
    const [url, from] = q.shift(); if (seen.has(url)) continue;
    const r = await fetch(B + url); seen.set(url, r.status);
    if (r.status >= 400) { bad.push(`${r.status} ${url} ← ${from}`); continue; }
    const ct = r.headers.get("content-type") || "";
    if (!/text\/html|xml/.test(ct)) { await r.arrayBuffer(); continue; }
    pages++;
    const h = await r.text();
    const found = [...h.matchAll(/(?:<a [^>]*href|<link [^>]*href|<img [^>]*src|<audio [^>]*src|<video [^>]*src|property="og:image" content)="([^"]+)"/g), ...h.matchAll(/<loc>([^<]+)<\/loc>/g)];
    for (const m of found) {
      const raw = m[1].replace(/&amp;/g, "&").split(" ")[0];
      if (/^(mailto:|tel:|javascript:|data:|#)/.test(raw) || raw.includes("${")) continue;   // links the app builds as it runs
      let u; try { u = new URL(raw, B + url); } catch { continue; }
      if (u.origin !== B && !u.href.startsWith("https://labs.tnllabs.com")) continue;
      const path = u.pathname + u.search;
      if (path.startsWith("/api/")) continue;
      if (!seen.has(path)) q.push([path, url]);
    }
  }
  t(`${seen.size} links on ${pages} pages, none dead` + (bad.length ? ":\n       " + bad.join("\n       ") : ""), bad.length === 0 && pages >= 12);

  console.log("\nTHE SCOREBOARD PICTURE BEFORE VOTING");
  const r = await fetch(B + "/e/cup/board.jpg"), h = await r.text();
  t("says it's made once voting opens — not a blank page", r.status === 404 && /text\/html/.test(r.headers.get("content-type") || "") && /once voting opens/.test(h));
  const adm = readFileSync(join(ROOT, "public/admin-app/8-events.js"), "utf8");
  t("…and Admin's buttons wait for voting instead of opening it", /stage \? `<a class="btn ghost sm" href="\/e\/\$\{esc\(e\.slug\)\}\/board\.jpg/.test(adm) && adm.includes("ready when voting opens"));
} finally { srv.kill(); }
console.log(`\n  ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
