// Vote mail v1.0 (2026-10-26): "voting begins at 3 PM — email everyone at
// 9 AM." The morning a tournament's vote opens, every member with a
// confirmed email gets one email with the real start time from the event's
// schedule — once, never after voting has started. Runs the real server
// against a stand-in for Resend on localhost; nothing leaves the machine.
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { mkdirSync, rmSync, readFileSync } from "node:fs";
import { spawn } from "node:child_process";
import { createServer } from "node:http";
const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const DATA = join(ROOT, "test/.tmp/event-vote-mail");
rmSync(DATA, { recursive: true, force: true }); mkdirSync(join(DATA, "uploads"), { recursive: true });
process.env.TNL_DATA = DATA;
let pass = 0, fail = 0;
const t = (n, ok) => { ok ? pass++ : fail++; console.log("  " + (ok ? "✓" : "✗") + "  " + n); };
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

const SENT = [];
const fake = createServer((req, res) => {
  let b = ""; req.on("data", (d) => b += d); req.on("end", () => {
    SENT.push(JSON.parse(b)); res.writeHead(200, { "Content-Type": "application/json" }); res.end(`{"id":"e${SENT.length}"}`);
  });
});
await new Promise((r) => fake.listen(0, "127.0.0.1", r));

const { db } = await import("../src/db.js");
const now = Date.now(), D = 86400000, MIN = 60000;
const mk = (u, { admin = 0, verified = 1 } = {}) => {
  const id = Number(db.prepare(`INSERT INTO users (username, display_name, email, password_hash, created_at, email_verified) VALUES (?,?,?,?,?,?)`)
    .run(u, u.toUpperCase(), u + "@x.test", "x", now - 30 * D, verified).lastInsertRowid);
  if (admin) db.prepare(`UPDATE users SET is_admin = 1 WHERE id = ?`).run(id);
  db.prepare(`INSERT INTO sessions (token, user_id, created_at) VALUES (?,?,?)`).run("tok-" + u, id, now);
  return id;
};
mk("boss", { admin: 1 }); for (const m of ["ana", "ben", "cy", "dee"]) mk(m);
mk("unv", { verified: 0 });
db.prepare(`UPDATE users SET suspended = 1 WHERE id = ?`).run(mk("sus"));
db.prepare(`UPDATE users SET mail_off = 1 WHERE id = ?`).run(mk("quiet"));
db.close();

const PORT = 18960 + (process.pid % 30);
const srv = spawn(process.execPath, ["--experimental-sqlite", "src/server.js"], { cwd: ROOT, stdio: ["ignore", "pipe", "pipe"], env: { ...process.env,
  PORT: String(PORT), TNL_DATA: DATA, RESEND_API_KEY: "re_test", MAIL_FROM: "LABS <noreply@tnllabs.com>", SUPPORT_EMAIL: "support@tnllabs.com",
  RESEND_API_BASE: `http://127.0.0.1:${fake.address().port}`, EVENT_MAIL_PER_DAY: "20", EVENT_MAIL_GAP_MS: "0", EVENT_VOTE_MAIL_HOUR: "0", PUBLIC_URL: "https://tnllabs.com" } });
let log = ""; srv.stdout.on("data", (d) => log += d); srv.stderr.on("data", (d) => log += d);
for (let i = 0; i < 100 && !/listening/.test(log); i++) await wait(100);
const call = async (who, path, body, method) => { const r = await fetch(`http://127.0.0.1:${PORT}` + path, { method: method || (body ? "POST" : "GET"), headers: { "Content-Type": "application/json", ...(who ? { Authorization: "Bearer tok-" + who } : {}) }, body: body ? JSON.stringify(body) : undefined }); return { s: r.status, j: await r.json().catch(() => ({})) }; };
const until = async (fn, ms = 8000) => { for (let i = 0; i < ms / 50 && !fn(); i++) await wait(50); };
// entries close (= voting opens) `inMs` from now; poll, a vote a day
const ev = (slug, inMs, extra = {}) => call("boss", "/api/admin/events", { slug, title: "LABS ART TOURNAMENT", format: "poll", brief: "Make something.",
  opensAt: now - 14 * D + inMs, submitDays: 14, voteDays: 7, finalDays: 3, published: true, mailOnOpen: true, ...extra });
const at = (ms) => new Date(ms).toLocaleTimeString("en-US", { timeZone: "America/New_York", hour: "numeric", minute: "2-digit" }).replace(":00", "") + " ET";
const votes = () => SENT.filter((m) => /voting opens/.test(m.subject));

try {
  console.log("\nTHE MORNING VOTING OPENS → EVERY MEMBER, ONCE");
  const start = now + 3 * MIN;
  const a = (await ev("art", 3 * MIN)).j;
  const later = (await ev("tomorrow", D)).j;            // votes open tomorrow: not today's email
  await ev("open", -5 * MIN);                           // voting already open: too late for "opens today"
  await ev("quiet", 3 * MIN, { mailOnOpen: false });    // switched off
  await until(() => votes().length >= 5); await wait(1500);
  const V = votes();
  t("5 emails: confirmed, not suspended, not unsubscribed", V.length === 5 && V.map((m) => m.to[0]).sort().join() === "ana@x.test,ben@x.test,boss@x.test,cy@x.test,dee@x.test");
  t("all for the event voting opens on today — not tomorrow's, not one already open, not one switched off", V.every((m) => m.html.includes("?e=art\"")));
  t("subject has the real start time from the schedule", V[0].subject === `LABS ART TOURNAMENT: voting opens today at ${at(start)}`);
  const ana = V.find((m) => m.to[0] === "ana@x.test");
  t("addressed to them, with the time", ana.html.includes(`ANA, voting opens today at ${at(start)}.`));
  t("how many pieces are in, and the vote-a-day rule", /0 pieces are in\. Pick your favourites — one vote a day, resetting at midnight ET\./.test(ana.text));
  t("votes only count in the app", ana.text.includes("Votes only count in the LABS app, not on Instagram."));
  t("See the entries opens the tournament in the app", ana.html.includes('href="https://tnllabs.com/?e=art"') && ana.text.includes("See the entries"));
  const unsub = /https:\/\/tnllabs\.com\/mail\/off\?k=([a-f0-9]{36})/.exec(ana.html);
  t("an unsubscribe link and the one-click headers", !!unsub && ana.headers?.["List-Unsubscribe"] === `<${unsub[0]}>`);
  t("never a TNL in it", !/TNL/.test(ana.subject + ana.text));
  await wait(1500);
  t("nobody gets it twice", votes().length === 5);

  console.log("\nADMIN");
  const s = (await call("boss", `/api/admin/events/${a.event.id}/vote-mail`)).j;
  t("admin sees when voting opens, what it'll say, and that it's done", s.voteStartsAt === start && s.at === at(start) && s.sent === 5 && !!s.doneAt && s.audience === 5);
  const s2 = (await call("boss", `/api/admin/events/${later.event.id}/vote-mail`)).j;
  t("tomorrow's: not due yet, nothing sent", s2.due === false && s2.sent === 0);
  t("a member can't see it", (await call("ana", `/api/admin/events/${a.event.id}/vote-mail`)).s === 403);
  t("a member can't send a preview", (await call("ana", `/api/admin/events/${a.event.id}/vote-mail-preview`, {})).s === 403);
  const n = SENT.length, p = await call("boss", `/api/admin/events/${a.event.id}/vote-mail-preview`, {});
  await until(() => SENT.length > n);
  t("the admin's preview goes only to the admin", p.s === 200 && SENT.length === n + 1 && SENT[n].to[0] === "boss@x.test" && SENT[n].subject.startsWith("[Preview] LABS ART TOURNAMENT: voting opens today at"));

  console.log("\nSOURCE");
  const src = readFileSync(join(ROOT, "src/server/events/votemail.js"), "utf8");
  t("never after voting has started", /if \(!start \|\| now >= start\) return false;/.test(src));
  t("9 AM Eastern unless told otherwise", /EVENT_VOTE_MAIL_HOUR \?\? 9/.test(src));
} finally { srv.kill(); fake.close(); }
console.log(`\n  ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
