// Results mail + winner card v1.0 (2026-11-05): "Make sure everybody who
// voted gets an email saying the tournament is over and announce the
// winner. Thank everyone and let them know the next tournament will be a
// music one." … "Then build me a graphic to post on Instagram announcing
// the winner." Runs the real server against a stand-in for Resend on
// localhost; nothing leaves the machine. The pieces are test patterns.
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { mkdirSync, rmSync, readFileSync, writeFileSync } from "node:fs";
import { spawn, execFileSync } from "node:child_process";
import { createServer } from "node:http";
import { createRequire } from "node:module";
const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const DATA = join(ROOT, "test/.tmp/event-results");
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

/* the pieces: flat test patterns, never anyone's work */
const FF = createRequire(import.meta.url)("ffmpeg-static");
const art = (name, src) => execFileSync(FF, ["-loglevel", "error", "-y", "-f", "lavfi", "-i", src, "-frames:v", "1", join(DATA, "uploads", name)]);
art("win.jpg", "testsrc2=s=1200x1500"); art("two.jpg", "smptebars=s=1080x1080"); art("three.jpg", "color=c=0x334455:s=900x1200");

const { db } = await import("../src/db.js");
const now = Date.now(), D = 86400000;
const mk = (u, { admin = 0, verified = 1, name } = {}) => {
  const id = Number(db.prepare(`INSERT INTO users (username, display_name, email, password_hash, created_at, email_verified) VALUES (?,?,?,?,?,?)`)
    .run(u, name || u.toUpperCase(), u + "@x.test", "x", now - 30 * D, verified).lastInsertRowid);
  if (admin) db.prepare(`UPDATE users SET is_admin = 1 WHERE id = ?`).run(id);
  db.prepare(`INSERT INTO sessions (token, user_id, created_at) VALUES (?,?,?)`).run("tok-" + u, id, now);
  return id;
};
const U = {};
U.boss = mk("boss", { admin: 1 });
U.win = mk("winner.one", { name: "Win One" }); U.two = mk("second.one", { name: "Two" }); U.three = mk("third.one", { name: "Three" });
for (const v of ["ana", "ben", "cy", "dee"]) U[v] = mk(v);
U.quiet = mk("quiet"); db.prepare(`UPDATE users SET mail_off = 1 WHERE id = ?`).run(U.quiet);
U.unv = mk("unv", { verified: 0 });
U.sus = mk("sus"); db.prepare(`UPDATE users SET suspended = 1 WHERE id = ?`).run(U.sus);
U.none = mk("didnt.vote");
const post = (uid, img) => Number(db.prepare(`INSERT INTO posts (author_id, channel, image_url, is_work, created_at) VALUES (?,?,?,1,?)`).run(uid, "graphic-design", "/uploads/" + img, now - 10 * D).lastInsertRowid);
const P = { win: post(U.win, "win.jpg"), two: post(U.two, "two.jpg"), three: post(U.three, "three.jpg") };
db.close();

const PORT = 18930 + (process.pid % 30);
const srv = spawn(process.execPath, ["--experimental-sqlite", "src/server.js"], { cwd: ROOT, stdio: ["ignore", "pipe", "pipe"], env: { ...process.env,
  PORT: String(PORT), TNL_DATA: DATA, RESEND_API_KEY: "re_test", MAIL_FROM: "LABS <noreply@tnllabs.com>", SUPPORT_EMAIL: "support@tnllabs.com",
  RESEND_API_BASE: `http://127.0.0.1:${fake.address().port}`, EVENT_MAIL_PER_DAY: "50", EVENT_RESULTS_MAIL_PER_DAY: "4", EVENT_MAIL_GAP_MS: "0", PUBLIC_URL: "https://tnllabs.com" } });
let log = ""; srv.stdout.on("data", (d) => log += d); srv.stderr.on("data", (d) => log += d);
for (let i = 0; i < 100 && !/listening/.test(log); i++) await wait(100);
const call = async (who, path, body) => { const r = await fetch(`http://127.0.0.1:${PORT}` + path, { method: body ? "POST" : "GET", headers: { "Content-Type": "application/json", ...(who ? { Authorization: "Bearer tok-" + who } : {}) }, body: body ? JSON.stringify(body) : undefined }); return { s: r.status, j: await r.clone().json().catch(() => ({})), r }; };
const until = async (fn, ms = 10000) => { for (let i = 0; i < ms / 50 && !fn(); i++) await wait(50); };
const results = () => SENT.filter((m) => /the winner is/.test(m.subject) && !m.subject.startsWith("[Preview]"));
const png = (b) => ({ png: b.slice(1, 4).toString() === "PNG", w: b.readUInt32BE(16), h: b.readUInt32BE(20) });

try {
  /* two tournaments: one finished (with entries, votes and results), one still taking entries */
  const mkEv = async (slug) => (await call("boss", "/api/admin/events", { slug, title: "LABS ART TOURNAMENT", format: "poll", brief: "Make something.", prize: "$100",
    opensAt: now - D, submitDays: 14, voteDays: 7, finalDays: 3, published: true, mailOnOpen: true })).j.event;
  const done = await mkEv("art-tournament"), live = await mkEv("still-open");
  const { DatabaseSync } = await import("node:sqlite");
  const w = new DatabaseSync(join(DATA, "tnl.db"));
  const entry = (uid, pid) => Number(w.prepare(`INSERT INTO event_entries (event_id, user_id, post_id, created_at) VALUES (?,?,?,?)`).run(done.id, uid, pid, now - 20 * D).lastInsertRowid);
  const E = { win: entry(U.win, P.win), two: entry(U.two, P.two), three: entry(U.three, P.three) };
  const vote = (voter, e, stage = "final") => w.prepare(`INSERT INTO event_votes (event_id, stage, matchup, entry_id, voter_id, created_at) VALUES (?,?,?,?,?,?)`).run(done.id, stage, 20261104, e, voter, now - D);
  for (const v of ["boss", "ana", "ben", "quiet", "unv", "sus"]) vote(U[v], E.win);
  vote(U.cy, E.two); vote(U.dee, E.three, "qualify");   // a vote in any stage counts
  const past = (k) => now - k * D;
  w.prepare(`UPDATE events SET schedule = ?, state = ? WHERE id = ?`).run(
    JSON.stringify([{ phase: "submit", start: past(30), end: past(16) }, { phase: "qualify", start: past(16), end: past(9) }, { phase: "final", start: past(9), end: now - 60000 }, { phase: "results", start: now - 60000, end: null }]),
    JSON.stringify({ submitClosed: true, qualified: true, finalists: [E.win, E.two, E.three], results: { winner: E.win, ranking: [{ entryId: E.win }, { entryId: E.two }, { entryId: E.three }], at: now - 60000 } }),
    done.id);
  w.close();

  console.log("\nTHE TOURNAMENT'S OVER → EVERYONE WHO VOTED, ONCE, AT A PACE");
  await until(() => results().length >= 4); await wait(2500);
  const R = results(), to = R.map((m) => m.to[0]).sort();
  t("4 sent today — the day's share — to voters only", R.length === 4 && to.every((x) => ["ana@x.test", "ben@x.test", "boss@x.test", "cy@x.test", "dee@x.test"].includes(x)));
  t("never to someone who didn't vote, unsubscribed, unconfirmed or suspended", !to.some((x) => /didnt|quiet|unv|sus|one@/.test(x)));
  t("the subject names the winner", R[0].subject === "LABS ART TOURNAMENT: the winner is Win One");
  const ana = R.find((m) => m.to[0] === "ana@x.test") || R[0];
  t("it's over, and thank you for voting", /, the LABS ART TOURNAMENT is over\. Thank you for voting\./.test(ana.text));
  t("the winner, with their handle and the prize", ana.text.includes("Win One (@winner.one) won the $100 prize."));
  t("second and third", ana.text.includes("Second, Two (@second.one). Third, Three (@third.one)."));
  t("thanks everyone", ana.text.includes("Thank you to everyone who entered, voted and shared."));
  t("the next tournament is for music", ana.text.includes("The next tournament is for music."));
  t("See the results opens the tournament in the app", ana.html.includes('href="https://tnllabs.com/?e=art-tournament"') && ana.text.includes("See the results"));
  const unsub = /https:\/\/tnllabs\.com\/mail\/off\?k=([a-f0-9]{36})/.exec(ana.html);
  t("an unsubscribe link and the one-click headers", !!unsub && ana.headers?.["List-Unsubscribe"] === `<${unsub[0]}>`);
  t("never a TNL in it", !/TNL/.test(ana.subject + ana.text));
  t("nothing for the tournament still taking entries", !SENT.some((m) => /the winner is/.test(m.subject) && m.html.includes("still-open")));

  console.log("\nADMIN");
  const s = (await call("boss", `/api/admin/events/${done.id}/results-mail`)).j;
  t("admin sees who it goes to, how far it's got, and the pace", s.audience === 5 && s.sent === 4 && s.left === 1 && s.perDay === 4 && s.winner === "winner.one" && s.next === "music" && !s.doneAt);
  const full = (await call("boss", `/api/admin/events/${done.id}`)).j;
  t("…in the tournament's admin view too (what the connector reads)", full.resultsMail?.sent === 4);
  t("a member can't see it or send a preview", (await call("ana", `/api/admin/events/${done.id}/results-mail`)).s === 403 && (await call("ana", `/api/admin/events/${done.id}/results-mail-preview`, {})).s === 403);
  const n = SENT.length, p = await call("boss", `/api/admin/events/${done.id}/results-mail-preview`, {});
  await until(() => SENT.length > n);
  t("the admin's preview goes only to the admin", p.s === 200 && SENT.length === n + 1 && SENT[n].to[0] === "boss@x.test" && SENT[n].subject.startsWith("[Preview] LABS ART TOURNAMENT: the winner is"));
  t("no preview before there's a winner", (await call("boss", `/api/admin/events/${live.id}/results-mail-preview`, {})).s === 400);

  console.log("\nTHE WINNER'S GRAPHIC");
  const card = await call(null, "/e/art-tournament/winner.png");
  const b = Buffer.from(await card.r.arrayBuffer()), d = png(b);
  t("the feed post: a 1080×1350 PNG", card.s === 200 && d.png && d.w === 1080 && d.h === 1350);
  const st = await call(null, "/e/art-tournament/winner.png?size=story"), sb = Buffer.from(await st.r.arrayBuffer()), sd = png(sb);
  t("the Story: 1080×1920", st.s === 200 && sd.png && sd.w === 1080 && sd.h === 1920);
  const early = await call(null, "/e/still-open/winner.png");
  t("before the results it says so, not a blank page", early.s === 404 && /ready once the results are in/.test(await early.r.text()));
  if (process.env.SHOTS) { writeFileSync(join(process.env.SHOTS, "winner-post.png"), b); writeFileSync(join(process.env.SHOTS, "winner-story.png"), sb);
    writeFileSync(join(process.env.SHOTS, "results-email.html"), ana.html); }

  console.log("\nSOURCE");
  const src = readFileSync(join(ROOT, "src/server/events/resultmail.js"), "utf8");
  t("below the other emails' pace by default (sign-ups share the 100 a day)", /EVENT_RESULTS_MAIL_PER_DAY\) \|\| 50/.test(src));
  t("never for a void event, and only for a week after", src.includes("if (st.void || !st.results?.winner) return false;") && /EVR_DAYS = 7/.test(src));
} finally { srv.kill(); fake.close(); }
if (fail) console.log(log.split("\n").filter((l) => /error|results/i.test(l)).slice(-10).join("\n"));
console.log(`\n  ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
