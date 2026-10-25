// Get started (2026-10-18, onboarding): a new member's list needs two of
// their own numbers — pieces posted and people followed. Theirs only.
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { rmSync, mkdirSync, readFileSync } from "node:fs";
const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const DATA = join(ROOT, "test/.tmp/getstarted");
rmSync(DATA, { recursive: true, force: true }); mkdirSync(DATA, { recursive: true });
process.env.TNL_DATA = DATA;
const { db } = await import(join(ROOT, "src/db.js"));
let pass = 0, fail = 0;
const t = (n, ok) => { ok ? pass++ : fail++; console.log("  " + (ok ? "✓" : "✗") + "  " + n); };
const now = Date.now();
const mk = (u) => { const id = Number(db.prepare(`INSERT INTO users (username, display_name, email, password_hash, created_at, email_verified) VALUES (?,?,?,?,?,1)`).run(u, u, u + "@x.test", "x", now).lastInsertRowid);
  db.prepare(`INSERT INTO sessions (token, user_id, created_at) VALUES (?,?,?)`).run("tok-" + u, id, now); return id; };
const ana = mk("ana"), ben = mk("ben"), cy = mk("cy");
db.prepare(`INSERT INTO posts (author_id, channel, body, is_work, created_at) VALUES (?, 'general', 'a piece', 1, ?)`).run(ana, now);
db.prepare(`INSERT INTO posts (author_id, channel, body, is_work, created_at) VALUES (?, 'general', 'just talk', 0, ?)`).run(ana, now);
db.prepare(`INSERT INTO posts (author_id, channel, body, is_work, created_at) VALUES (?, 'general', 'bens', 1, ?)`).run(ben, now);
for (const x of [ben, cy]) db.prepare(`INSERT INTO follows (follower_id, followee_id, created_at) VALUES (?,?,?)`).run(ana, x, now);
const PORT = 8897, B = `http://localhost:${PORT}`;
const srv = spawn(process.execPath, ["--experimental-sqlite", "--no-warnings", "src/server.runtime.js"], {
  cwd: ROOT, env: { ...process.env, TNL_DATA: DATA, PORT: String(PORT), STRIPE_SECRET_KEY: "", TNL_NO_VIDEO_FIX: "1", TNL_NO_WATCH: "1" }, stdio: "ignore" });
try {
  for (let i = 0; i < 100; i++) { try { if ((await fetch(B + "/api/health")).ok) break; } catch {} await new Promise((r) => setTimeout(r, 100)); }
  console.log("\nGET STARTED");
  t("signed out: nothing", (await fetch(B + "/api/me/start")).status === 401);
  const a = await (await fetch(B + "/api/me/start", { headers: { Authorization: "Bearer tok-ana" } })).json();
  t("counts their finished pieces (not talk posts) and who they follow", a.posts === 1 && a.following === 2);
  const c = await (await fetch(B + "/api/me/start", { headers: { Authorization: "Bearer tok-cy" } })).json();
  t("someone new starts at zero", c.posts === 0 && c.following === 0);
  const app = readFileSync(join(ROOT, "public/index.html"), "utf8");
  t("the walkthrough covers the Showroom, labs, posting, Market, profile, messages and notifications", ["The Showroom", "The labs", "Post your work", "The Market", "Your profile", "Messages", "Notifications"].every((h) => app.includes(`h:"${h}"`)));
  t("…and never explains rep, levels or rates", !/h:"Rep and levels"|Market fee/.test(app.slice(app.indexOf("const TOUR="), app.indexOf("function tourHTML"))));
  t("≡ on your profile reopens it", app.includes('label:"How LABS works",run:openTour'));
  { const tour = app.slice(app.indexOf("const TOUR="), app.indexOf("function tourHTML"));
    t("the Market card only promises what's for sale — clothing, art and prints, not beats (2026-10-25)", tour.includes("Buy and sell what creatives make: clothing, art and prints.") && !/beats/i.test(tour)); }
} finally { srv.kill(); }
console.log(`\n  ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
