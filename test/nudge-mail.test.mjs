// The weekly reminder v1.0 (2026-10-23): a member whose page has gaps gets one
// tailored email a week — never twice in a week, never more than NUDGE_MAX,
// never once the page is done, never to the unconfirmed, suspended or
// unsubscribed, never in the first days. Runs the real server against a
// stand-in for Resend on localhost; nothing leaves the machine.
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { mkdirSync, rmSync } from "node:fs";
import { spawn } from "node:child_process";
import { createServer } from "node:http";
const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const DATA = join(ROOT, "test/.tmp/nudge-mail");
rmSync(DATA, { recursive: true, force: true }); mkdirSync(join(DATA, "uploads"), { recursive: true });
process.env.TNL_DATA = DATA;
let pass = 0, fail = 0;
const t = (n, ok) => { ok ? pass++ : fail++; console.log("  " + (ok ? "✓" : "✗") + "  " + n); };
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

const SENT = []; let FAIL = 0;
const fake = createServer((req, res) => {
  let b = ""; req.on("data", (d) => b += d); req.on("end", () => {
    if (FAIL) { res.writeHead(FAIL, { "Content-Type": "application/json" }); return res.end('{"message":"nope"}'); }
    SENT.push({ auth: req.headers.authorization, ...JSON.parse(b) });
    res.writeHead(200, { "Content-Type": "application/json" }); res.end(`{"id":"e${SENT.length}"}`);
  });
});
await new Promise((r) => fake.listen(0, "127.0.0.1", r));

const { db } = await import("../src/db.js");
const now = Date.now(), D = 86400000;
let order = 0;
const mk = (u, { admin = 0, verified = 1, roles = [], joined = 30, done = [] } = {}) => {
  const id = Number(db.prepare(`INSERT INTO users (username, display_name, email, password_hash, created_at, email_verified, roles, avatar_url, bio, accent) VALUES (?,?,?,?,?,?,?,?,?,?)`)
    .run(u, u[0].toUpperCase() + u.slice(1), u + "@x.test", "x", now - joined * D + order++ * 1000, verified, JSON.stringify(roles),
      done.includes("photo") ? "/uploads/a.jpg" : "", done.includes("bio") ? "Makes things" : "", done.includes("colour") ? "mint" : "lab").lastInsertRowid);
  if (admin) db.prepare(`UPDATE users SET is_admin = 1 WHERE id = ?`).run(id);
  db.prepare(`INSERT INTO sessions (token, user_id, created_at) VALUES (?,?,?)`).run("tok-" + u, id, now);
  if (done.includes("piece")) db.prepare(`INSERT INTO posts (author_id, channel, body, is_work, created_at) VALUES (?, 'general', 'x', 1, ?)`).run(id, now);
  if (done.includes("music")) db.prepare(`INSERT INTO tracks (user_id, title, url, created_at) VALUES (?, 'Loop', '/uploads/l.mp3', ?)`).run(id, now);
  return id;
};
const ALL = ["photo", "bio", "colour", "piece"];
const boss = mk("boss", { admin: 1, done: ALL });
const ana = mk("ana", { roles: ["Producer"] });
const ben = mk("ben", { done: ALL });
const cy = mk("cy", { done: ["photo", "bio", "piece"] });
const dee = mk("dee", { joined: 0 });
const eve = mk("eve", { roles: ["Fashion Designer"], done: ALL });
const fay = mk("fay", { done: ["photo", "colour", "piece"] });
mk("unv", { verified: 0 }); db.prepare(`UPDATE users SET suspended = 1 WHERE id = ?`).run(mk("sus")); db.prepare(`UPDATE users SET mail_off = 1 WHERE id = ?`).run(mk("quiet"));
// three follows for the finished ones (boss, ben, cy, eve, fay)
for (const who of [boss, ben, cy, eve, fay]) for (const f of [ana, dee, boss, ben].filter((x) => x !== who).slice(0, 3)) db.prepare(`INSERT INTO follows (follower_id, followee_id, created_at) VALUES (?,?,?)`).run(who, f, now);
db.close();

const PORT = 18960 + (process.pid % 30);
const srv = spawn(process.execPath, ["--experimental-sqlite", "src/server.js"], { cwd: ROOT, stdio: ["ignore", "pipe", "pipe"], env: { ...process.env,
  PORT: String(PORT), TNL_DATA: DATA, RESEND_API_KEY: "re_test", MAIL_FROM: "LABS <noreply@tnllabs.com>", SUPPORT_EMAIL: "support@tnllabs.com",
  RESEND_API_BASE: `http://127.0.0.1:${fake.address().port}`, NUDGE_TICK_MS: "300", NUDGE_EVERY_MS: "60000", NUDGE_PER_DAY: "3", NUDGE_MAX: "2", NUDGE_GAP_MS: "0",
  PUBLIC_URL: "https://labs.tnllabs.com" } });
let log = ""; srv.stdout.on("data", (d) => log += d); srv.stderr.on("data", (d) => log += d);
for (let i = 0; i < 100 && !/listening/.test(log); i++) await wait(100);
const call = async (who, path, body, method) => { const r = await fetch(`http://127.0.0.1:${PORT}` + path, { method: method || (body ? "POST" : "GET"), headers: { "Content-Type": "application/json", ...(who ? { Authorization: "Bearer tok-" + who } : {}) }, body: body ? JSON.stringify(body) : undefined }); return { s: r.status, j: await r.json().catch(() => ({})) }; };
const until = async (fn, ms = 4000) => { for (let i = 0; i < ms / 50 && !fn(); i++) await wait(50); };
const to = (m) => m.to[0].replace("@x.test", "");
const { DatabaseSync } = await import("node:sqlite");
const raw = () => new DatabaseSync(join(DATA, "tnl.db"));
const ago = (days, who = null) => { const r = raw(); r.prepare(`UPDATE nudge_mail SET last_at = ?${who ? " WHERE user_id = " + who : ""}`).run(now - days * D); r.close(); };

try {
  console.log("\nTHE FIRST ROUND: ONLY PAGES WITH GAPS, IN ORDER, AT THE DAY'S PACE");
  await until(() => SENT.length >= 3); await wait(700);
  t("three go out (the day's share) — to the ones with gaps, in joining order", SENT.map(to).join() === "ana,cy,eve");
  const a = SENT[0];
  t("ana (a producer with nothing done): the photo first", a.subject === "Add a profile photo — LABS" && a.html.includes(">Add a profile photo</h1>") && a.text.includes("Ana, your page is 2 of 7 done."));
  t("…and every other gap named, music included", a.text.includes("Also still open: upload your music, post your first piece, say what you make, pick your colour, follow 3 people."));
  t("the button opens that step in the app, through log in", a.html.includes('href="https://labs.tnllabs.com/?login=1&amp;next=%2F%3Fstart%3Dphoto"'));
  t("from the real sender, replies to support", a.from === "LABS <noreply@tnllabs.com>" && a.reply_to === "support@tnllabs.com" && a.auth === "Bearer re_test");
  const unsub = /https:\/\/labs\.tnllabs\.com\/mail\/off\?k=([a-f0-9]{36})/.exec(a.html);
  t("an unsubscribe link and the one-click headers", !!unsub && a.headers?.["List-Unsubscribe"] === `<${unsub[0]}>` && a.headers?.["List-Unsubscribe-Post"] === "List-Unsubscribe=One-Click");
  const c = SENT[1];
  t("cy (only the colour missing): that one thing, 6 of 7, nothing else listed", c.subject === "Pick your colour — LABS" && c.text.includes("Cy, your page is 6 of 7 done.") && !c.text.includes("Also still open"));
  const e = SENT[2];
  t("eve (a fashion designer, page done, nothing listed): list a piece", e.subject === "List a piece in the Market — LABS" && e.text.includes("Your page says Fashion Designer.") && e.text.includes("7 of 7 done"));
  t("never the finished (boss, ben), the new (dee), the unconfirmed, suspended or unsubscribed", !SENT.some((m) => /boss|ben|dee|unv|sus|quiet/.test(to(m))));
  const st = (await call("boss", "/api/admin/nudge")).j;
  t("admin sees it: on, 3 today, 1 still due (fay, tomorrow)", st.on && st.ready && st.sentToday === 3 && st.due === 1 && st.max === 2 && st.perDay === 3);
  {
    const r = raw(); const b = r.prepare(`SELECT sent, last_items FROM nudge_mail WHERE user_id = ?`).get(ben); r.close();
    t("a finished page is remembered as done — never asked", b && b.sent === 2 && b.last_items === "");
  }

  console.log("\nTHE NEXT WEEK: THE ONE WHO WAITED FIRST, THEN A SECOND REMINDER, NEVER MORE THAN THE CAP");
  ago(2);   // a new day, and the week has passed
  await until(() => SENT.length >= 6); await wait(700);
  t("fay (who waited) first, then ana and cy again; eve waits for tomorrow", SENT.slice(3).map(to).join() === "fay,ana,cy");
  t("fay: say what you make", SENT[3].subject === "Say what you make — LABS");
  ago(2);
  await until(() => SENT.length >= 7); await wait(900);
  t("ana and cy have had their 2 (NUDGE_MAX): only eve and fay again", SENT.length === 8 && SENT.slice(6).map(to).join() === "eve,fay");

  console.log("\nA GAP CLOSED IS NEVER MENTIONED AGAIN; THE SWITCHES");
  { const r = raw(); r.prepare(`UPDATE users SET accent = 'mint' WHERE id = ?`).run(cy); r.prepare(`UPDATE nudge_mail SET sent = 0, last_at = ? WHERE user_id IN (?, ?)`).run(now - 2 * D, cy, fay); r.close(); }
  await wait(900);
  t("cy picked a colour: nothing more for cy; fay (a gap still) gets one", SENT.length === 9 && to(SENT[8]) === "fay");
  { const r = raw(); const c2 = r.prepare(`SELECT sent FROM nudge_mail WHERE user_id = ?`).get(cy); r.close(); t("…and cy is remembered as done", c2.sent === 2); }
  await call("boss", "/api/admin/settings", { nudgeMail: "0" }, "PATCH");
  ago(2, fay); { const r = raw(); r.prepare(`UPDATE nudge_mail SET sent = 0 WHERE user_id = ?`).run(fay); r.close(); }
  await wait(900);
  t("switched off in Admin: nothing goes out", SENT.length === 9 && (await call("boss", "/api/admin/nudge")).j.on === false);
  await call("boss", "/api/admin/settings", { nudgeMail: "1" }, "PATCH");
  await until(() => SENT.length >= 10); await wait(300);
  t("switched back on: it carries on", SENT.length === 10 && to(SENT[9]) === "fay");

  console.log("\nUNSUBSCRIBE AND A BAD DAY AT RESEND");
  const r1 = await fetch(`http://127.0.0.1:${PORT}/mail/off?k=${unsub[1]}`, { method: "POST" });
  t("ana's unsubscribe link works (one click, as the mail app does it)", r1.status === 200 && /unsubscribed/i.test(await r1.text()));
  { const r = raw(); r.prepare(`UPDATE nudge_mail SET sent = 0, last_at = ? WHERE user_id IN (?, ?)`).run(now - 2 * D, ana, eve); r.close(); }
  await until(() => SENT.length >= 11); await wait(700);
  t("…so ana gets no more; eve still does", SENT.length === 11 && to(SENT[10]) === "eve");
  FAIL = 429; ago(2, eve); { const r = raw(); r.prepare(`UPDATE nudge_mail SET sent = 0 WHERE user_id = ?`).run(eve); r.close(); }
  await wait(900);
  const st2 = (await call("boss", "/api/admin/nudge")).j;
  t("rate limited: it stops and says why; nobody is marked as sent", SENT.length === 11 && /rate limited/.test(st2.lastError || "") && st2.due >= 1);
  FAIL = 0;
  await until(() => SENT.length >= 12); await wait(300);
  t("next tick, it carries on", SENT.length === 12 && to(SENT[11]) === "eve");

  console.log("\nTHE ADMIN'S OWN COPY");
  const pv = (await call("boss", "/api/admin/nudge/preview", {})).j;
  await until(() => SENT.length >= 13);
  t("a finished admin gets the sample with every gap, marked as a preview", pv.ok && pv.items.length === 7 && SENT[12].subject.startsWith("[Preview] ") && to(SENT[12]) === "boss");
  t("members can't ask for it", (await call("ana", "/api/admin/nudge/preview", {})).s === 403 && (await call("ana", "/api/admin/nudge")).s === 403);
} finally { srv.kill(); fake.close(); if (fail || process.env.NUDGE_TEST_LOG) console.log("\n--- server log ---\n" + log.split("\n").filter((l) => /nudge|mail|Error|error/.test(l)).slice(-30).join("\n")); }
console.log(`\n  ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
