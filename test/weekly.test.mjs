// The week (2026-10-26): "a weekly report of all the data we collect, to
// improve the app — a simple email is fine." Last week against the week
// before, in plain lines; counts and patterns, never a member's name.
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { rmSync, mkdirSync, readFileSync } from "node:fs";
const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const DATA = join(ROOT, "test/.tmp/weekly");
rmSync(DATA, { recursive: true, force: true }); mkdirSync(DATA, { recursive: true });
process.env.TNL_DATA = DATA;
const { db } = await import(join(ROOT, "src/db.js"));
const now = Date.now(), D = 86400000;
const U = (n, ago, o = {}) => { const id = Number(db.prepare(`INSERT INTO users (username, display_name, email, password_hash, created_at, email_verified, is_admin, avatar_url, bio) VALUES (?,?,?,?,?,?,?,?,?)`)
  .run(n, n, n + "@x.com", "h", now - ago, o.verified ?? 1, o.admin ? 1 : 0, o.avatar || "", o.bio || "").lastInsertRowid);
  if (o.admin) db.prepare(`INSERT INTO sessions (token, user_id, created_at) VALUES (?,?,?)`).run("tok-" + n, id, now); return id; };
const boss = U("boss", 60 * D, { admin: true, avatar: "/uploads/a.jpg", bio: "runs it" });
db.prepare(`INSERT INTO sessions (token, user_id, created_at) VALUES ('tok-ana', ?, ?)`).run(U("ana", 30 * D), now);
/* last week: 4 joined — 3 confirmed, 1 finished the page, 1 posted */
const n1 = U("new1", 2 * D, { avatar: "/uploads/n.jpg", bio: "hi" }), n2 = U("new2", 3 * D), n3 = U("new3", 4 * D); U("new4", 5 * D, { verified: 0 });
/* the week before: 2 joined — one came back last week */
const o1 = U("old1", 10 * D), o2 = U("old2", 11 * D);
const P = (who, ago, ch = "tracks") => Number(db.prepare(`INSERT INTO posts (author_id, body, channel, created_at) VALUES (?,?,?,?)`).run(who, "Secret caption by " + who, ch, now - ago).lastInsertRowid);
const p1 = P(n1, 1 * D), p2 = P(boss, 2 * D, "photography"), p3 = P(boss, 3 * D); P(boss, 9 * D); P(boss, 10 * D); P(boss, 11 * D);
db.prepare(`INSERT INTO likes (post_id, user_id, created_at) VALUES (?,?,?)`).run(p1, o1, now - 2 * D);   // old1 came back
db.prepare(`INSERT INTO likes (post_id, user_id, created_at) VALUES (?,?,?)`).run(p2, n2, now - 1 * D);
db.prepare(`INSERT INTO comments (post_id, author_id, body, created_at) VALUES (?,?,?,?)`).run(p1, n3, "nice", now - 1 * D);
db.prepare(`INSERT INTO follows (follower_id, followee_id, created_at) VALUES (?,?,?)`).run(n2, boss, now - 1 * D);
db.prepare(`INSERT INTO collaborators (post_id, user_id, status, created_at) VALUES (?,?,?,?)`).run(p2, n1, "accepted", now - 1 * D);
db.prepare(`INSERT INTO collaborators (post_id, user_id, status, created_at) VALUES (?,?,?,?)`).run(p3, n2, "pending", now - 1 * D);
/* the market: a piece looked at a lot and not bought, one sale this week, none the week before */
const L = (title, ago) => Number(db.prepare(`INSERT INTO listings (seller_id, title, description, price_cents, images, status, created_at, updated_at) VALUES (?,?,?,?,?,?,?,?)`).run(boss, title, "", 4500, '["/uploads/t.jpg"]', "active", now - ago, now - ago).lastInsertRowid);
const tee = L("Drop 01 Tee", 2 * D), hood = L("Sashiko Hoodie", 20 * D);
for (const u of [n1, n2, n3, o1, o2, boss]) db.prepare(`INSERT INTO listing_views (listing_id, user_id, viewed_at) VALUES (?,?,?)`).run(hood, u, now - 2 * D);
db.prepare(`INSERT INTO listing_views (listing_id, user_id, viewed_at) VALUES (?,?,?)`).run(tee, n1, now - 1 * D);
db.prepare(`INSERT INTO orders (listing_id, buyer_id, seller_id, amount_cents, shipping_cents, status, created_at, updated_at) VALUES (?,?,?,?,?,?,?,?)`).run(tee, n1, boss, 4500, 800, "paid", now - 1 * D, now - 1 * D);
db.prepare(`INSERT INTO error_log (kind, message, path, created_at) VALUES (?,?,?,?)`).run("server", "boom at /api/x", "/api/x", now - 1 * D);
db.exec(`CREATE TABLE IF NOT EXISTS glitch_events (id INTEGER PRIMARY KEY AUTOINCREMENT, kind TEXT NOT NULL, place TEXT NOT NULL DEFAULT '', detail TEXT NOT NULL DEFAULT '', device TEXT NOT NULL DEFAULT '', username TEXT NOT NULL DEFAULT '', created_at INTEGER NOT NULL)`);   // the server makes it at boot (server-10-glitch.js); here it's seeded first
for (let i = 0; i < 3; i++) db.prepare(`INSERT INTO glitch_events (kind, place, detail, created_at) VALUES (?,?,?,?)`).run("rage_tap", "showroom", "#post", now - 1 * D);
db.close();
let pass = 0, fail = 0;
const t = (n, ok) => { ok ? pass++ : fail++; console.log("  " + (ok ? "✓" : "✗") + "  " + n); };
const PORT = 8921, B = `http://localhost:${PORT}`;
const srv = spawn(process.execPath, ["--experimental-sqlite", "--no-warnings", "src/server.runtime.js"], { cwd: ROOT, stdio: "ignore",
  env: { ...process.env, TNL_DATA: DATA, PORT: String(PORT), STRIPE_SECRET_KEY: "", TNL_NO_VIDEO_FIX: "1", TNL_NO_WATCH: "1", RESEND_API_KEY: "", ADMIN_EMAIL: "boss@x.com",
    GOOGLE_SERVICE_ACCOUNT: "", META_ACCESS_TOKEN: "" } });
const get = (path, who, method = "GET") => fetch(B + path, { method, headers: who ? { authorization: "Bearer tok-" + who } : {} });
try {
  for (let i = 0; i < 100; i++) { try { if ((await fetch(B + "/api/health")).ok) break; } catch {} await new Promise((r) => setTimeout(r, 100)); }
  console.log("\nADMINS ONLY");
  t("signed out: nothing", (await get("/api/admin/weekly")).status === 401);
  t("a member: nothing", (await get("/api/admin/weekly", "ana")).status === 403);
  t("a member can't send it either", (await get("/api/admin/weekly/send", "ana", "POST")).status === 403);

  const r = await get("/api/admin/weekly", "boss"), W = await r.json(), txt = W.lines.join("\n");
  console.log("\nTHE PEOPLE");
  t("new members against the week before; who confirmed, finished, posted", /4 new members \(up 100%\)\. 3 confirmed their email, 1 finished their page, 1 posted something\./.test(txt));
  t("where new people stop most", /Where new people stop most: finishing their page/.test(txt));
  t("who came back from the week before", /Of the 2 who joined the week before, 1 came back and did something \(50%\)/.test(txt));
  console.log("\nTHE WORK");
  t("posts by lab, against the week before", /3 posts \(same as the week before\): 2 in music, 1 in visual/.test(txt));
  t("likes, comments, follows, collabs accepted (pending don't count)", /2 likes, 1 comments, 1 follows, 1 collabs accepted/.test(txt));
  console.log("\nTHE MARKET");
  t("pieces, views, sales and the money, against the week before", /1 new piece, 7 views \(new\), 0 offers, 1 sale for \$45 \(new\)/.test(txt));
  t("looked at a lot, not bought", /Looked at 6 times, not bought: "Sashiko Hoodie"/.test(txt));
  console.log("\nREACH AND HOW IT FELT");
  t("Google and Meta say not connected when their keys aren't set", /Google: not connected\./.test(txt) && /Instagram and Facebook: not connected\./.test(txt));
  t("errors and glitches, the worst spot", /1 error \(new\), 3 glitches \(new\)\. Most often: 1× boom at \/api\/x\./.test(txt) && /Worst spot: 3× rage tap at showroom/.test(txt));
  console.log("\nWHAT TO DO");
  t("the moves the numbers point at", /Half of new members never finish their page/.test(txt) && /A few people make most of the posts/.test(txt));
  console.log("\nNEVER A NAME");
  t("no member's name, email or caption in the report", !/new1|new2|ana@|boss@|Secret caption/.test(txt));
  t("a subject line with the week's three numbers", W.subject === "LABS this week: 4 joined · 3 posts · 1 sale" && W.week.from && W.week.to);

  console.log("\nSENDING");
  const s = await (await get("/api/admin/weekly/send", "boss", "POST")).json();
  t("send-now goes to the admin's own address; with no mail key it says so instead of failing", s.sent === false && s.reason === "no_key");
  const src = readFileSync(join(ROOT, "src/server-10-weekly.js"), "utf8"), mail = readFileSync(join(ROOT, "src/mail.js"), "utf8");
  t("the schedule: Monday 13:00 UTC, once a week, and the first run right away", /getUTCDay\(\) === 1 && d\.getUTCHours\(\) >= 13/.test(src) && /!prev \|\|/.test(src));
  t("the email uses the one LABS layout", /export function weeklyEmail/.test(mail) && /renderEmail\(/.test(mail.split("export function weeklyEmail")[1]));
  t("the page shows the week with a send-now button", /wkmail/.test(readFileSync(join(ROOT, "public/admin-app/7-systems.js"), "utf8")));
} finally { srv.kill(); }
console.log(`\n  ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
