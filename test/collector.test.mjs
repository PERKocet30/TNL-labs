// Collector v1.0 (2026-10-26): "add more options for regular people, like
// connoisseur for people who just enjoy art, and tailor the onboarding
// depending on the labels the member chooses. I hate seeing all these
// accounts without a picture." One extra kind of member — Collector — and
// a joining path, Get started list, reminder email, profile and weekly
// report that read what kind of member someone is. Real server, a stand-in
// for Resend on localhost; nothing leaves the machine.
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { mkdirSync, rmSync, readFileSync } from "node:fs";
import { spawn } from "node:child_process";
import { createServer } from "node:http";
const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const DATA = join(ROOT, "test/.tmp/collector");
rmSync(DATA, { recursive: true, force: true }); mkdirSync(join(DATA, "uploads"), { recursive: true });
process.env.TNL_DATA = DATA;
let pass = 0, fail = 0;
const t = (n, ok) => { ok ? pass++ : fail++; console.log("  " + (ok ? "✓" : "✗") + "  " + n); };
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const read = (f) => readFileSync(join(ROOT, f), "utf8");

const SENT = [];
const fake = createServer((req, res) => {
  let b = ""; req.on("data", (d) => b += d); req.on("end", () => {
    SENT.push(JSON.parse(b)); res.writeHead(200, { "Content-Type": "application/json" }); res.end(`{"id":"e${SENT.length}"}`);
  });
});
await new Promise((r) => fake.listen(0, "127.0.0.1", r));

const { db } = await import("../src/db.js");
const now = Date.now(), D = 86400000;
let order = 0;
const mk = (u, { admin = 0, roles = [], joined = 30, photo = false, bio = "", accent = "lab" } = {}) => {
  const id = Number(db.prepare(`INSERT INTO users (username, display_name, email, password_hash, created_at, email_verified, roles, avatar_url, bio, accent) VALUES (?,?,?,?,?,1,?,?,?,?)`)
    .run(u, u[0].toUpperCase() + u.slice(1), u + "@x.test", "x", now - joined * D + order++ * 1000, JSON.stringify(roles), photo ? "/uploads/a.jpg" : "", bio, accent).lastInsertRowid);
  if (admin) db.prepare(`UPDATE users SET is_admin = 1 WHERE id = ?`).run(id);
  db.prepare(`INSERT INTO sessions (token, user_id, created_at) VALUES (?,?,?)`).run("tok-" + u, id, now);
  return id;
};
const boss = mk("boss", { admin: 1, roles: ["Painter"], photo: true, bio: "x", accent: "mint" });
const col = mk("col", { roles: ["Collector"], photo: true });          // a collector with a photo, no line yet
const art = mk("art", { roles: ["Illustrator"], photo: true, bio: "Draws", accent: "mint" });
mk("newcol", { roles: ["Collector"], joined: 2 });                      // joined this week, for the report
mk("newmk", { roles: ["Producer"], joined: 3 });
for (const f of [boss, art]) db.prepare(`INSERT INTO follows (follower_id, followee_id, created_at) VALUES (?,?,?)`).run(col, f, now);
const post = Number(db.prepare(`INSERT INTO posts (author_id, channel, body, is_work, created_at) VALUES (?, 'general', 'x', 1, ?)`).run(art, now).lastInsertRowid);
db.prepare(`INSERT INTO likes (post_id, user_id, created_at) VALUES (?,?,?)`).run(post, col, now);
db.close();

const PORT = 18930 + (process.pid % 30);
const srv = spawn(process.execPath, ["--experimental-sqlite", "src/server.js"], { cwd: ROOT, stdio: ["ignore", "pipe", "pipe"], env: { ...process.env,
  PORT: String(PORT), TNL_DATA: DATA, RESEND_API_KEY: "re_test", MAIL_FROM: "LABS <noreply@tnllabs.com>", SUPPORT_EMAIL: "support@tnllabs.com",
  RESEND_API_BASE: `http://127.0.0.1:${fake.address().port}`, NUDGE_TICK_MS: "300", NUDGE_EVERY_MS: "60000", NUDGE_PER_DAY: "20", NUDGE_GAP_MS: "0",
  TNL_NO_WATCH: "1", ADMIN_EMAIL: "", PUBLIC_URL: "https://tnllabs.com" } });
let log = ""; srv.stdout.on("data", (d) => log += d); srv.stderr.on("data", (d) => log += d);
for (let i = 0; i < 100 && !/listening/.test(log); i++) await wait(100);
const call = async (who, path, body, method) => { const r = await fetch(`http://127.0.0.1:${PORT}` + path, { method: method || (body ? "POST" : "GET"), headers: { "Content-Type": "application/json", ...(who ? { Authorization: "Bearer tok-" + who } : {}) }, body: body ? JSON.stringify(body) : undefined }); return { s: r.status, j: await r.json().catch(() => ({})) }; };
const until = async (fn, ms = 5000) => { for (let i = 0; i < ms / 50 && !fn(); i++) await wait(50); };

try {
  console.log("\nJOINING AS A COLLECTOR");
  const reg = await call(null, "/api/auth/register", { displayName: "Fan", username: "fan.one", email: "fan@x.test", password: "Gallery2026x", roles: ["Collector"] });
  t("an account can be made as a Collector", reg.s === 200 && JSON.stringify(reg.j.user?.roles) === '["Collector"]');
  const app = read("src/app-07-theme-labs-api.js"), kind = read("src/app-11-gate-kind.js"), scr = read("src/app-11-gate-screens.js"), lg = read("src/app-11-gate-logic.js");
  t("Collector is a role, with labs to land in", /const ROLES = \[\s*"Collector"/.test(app) && /"Collector":\["pharmacy","culture","fashion"\]/.test(read("src/app-11-places.js")));
  t("its own door above 'what you make', never mixed in with the chips", scr.includes("${collectorCardHTML(coll)}") && scr.includes("ROLES.filter(r=>r!==COLLECTOR)") && /f\.roles=f\.roles\.includes\(COLLECTOR\)\?\[\]:\[COLLECTOR\]/.test(lg));
  t("the photo step has no Skip", /G\.step!=="welcome"&&G\.step!=="photo"\?/.test(scr));
  t("the photo and bio steps speak to the kind of member", scr.includes("kindCopy().photo") && scr.includes("kc.bioH") && /bioH:"What kind of work do you love\?"/.test(kind));
  t("a member is a maker as soon as they pick something they make", /if\(r\.length&&r\.every\(x=>x===COLLECTOR\)\)return "collector";/.test(kind));

  console.log("\nGET STARTED FOLLOWS THE KIND");
  const st = (await call("col", "/api/me/start")).j;
  t("the numbers for every kind's steps: follows, likes, tracks, listings", st.following === 2 && st.likes === 1 && st.tracks === 0 && st.listings === 0 && st.posts === 0);
  const gs = read("src/app-11-getstarted.js");
  t("a collector likes pieces and follows artists instead of posting", gs.includes('t:"Like 3 pieces you love"') && gs.includes('coll?"Follow 3 artists"') && gs.includes("if(!coll)it.push({k:\"post\""));
  t("music gets a first track, fashion a first listing", gs.includes('t:"Upload your first track"') && gs.includes('t:"List a piece in the Market"'));
  t("no photo brings the list back, whenever they joined, three days after it's closed", /const gsNoPic=\(\)=>!!\(ME&&!ME\.avatarUrl&&Date\.now\(\)-gsOffAt\(\)>GS_NOPIC_MS\)/.test(gs) && /GS_NOPIC_MS=3\*864e5/.test(gs)
    && read("src/app-19-feed-boot.js").includes("if(ME&&gsWant())await gsLoad(true);"));

  console.log("\nTHE WEEKLY REMINDER, FOR A COLLECTOR");
  await until(() => SENT.some((m) => m.to[0] === "col@x.test"));
  const c = SENT.find((m) => m.to[0] === "col@x.test");
  t("a collector is asked what they love, not what they make", c && c.subject === "Say what you love — LABS");
  t("…of their own six, and never told to post a piece", c && c.text.includes("Col, your page is 2 of 6 done.") && !/post your first piece|Post a piece/i.test(c.text));
  t("…and to like pieces they love", c && /like 3 pieces you love/i.test(c.text));
  await until(() => SENT.some((m) => m.to[0] === "art@x.test"));
  const a = SENT.find((m) => m.to[0] === "art@x.test");
  t("a maker still gets the maker's list (posted already, so: follow 3 people)", a && a.subject === "Follow 3 people — LABS" && !/love/i.test(a.subject));

  console.log("\nTHE WEEKLY REPORT");
  const w = (await call("boss", "/api/admin/weekly")).j;
  t("new collectors and makers counted apart", w.lines.some((l) => /Of them, 2 joined as collectors \(here for the art\) and 1 as maker\./.test(l)));

  console.log("\nTHE PROFILE");
  t("an empty collector page says what they're here for", read("src/app-15-profile.js").includes("Here for the art: a Collector on LABS."));
} finally { srv.kill(); fake.close(); }
console.log(`\n  ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
