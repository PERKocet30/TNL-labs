// Event mail v1.0 (2026-10-12): when a published tournament opens for entries,
// every member with a confirmed email gets one email — once, at a pace the
// Resend free plan allows, picking up where it stopped, with a working
// unsubscribe. Runs the real server against a stand-in for Resend on
// localhost; nothing leaves the machine.
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { mkdirSync, rmSync, readFileSync } from "node:fs";
import { spawn } from "node:child_process";
import { createServer } from "node:http";
const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const DATA = join(ROOT, "test/.tmp/event-mail");
rmSync(DATA, { recursive: true, force: true }); mkdirSync(join(DATA, "uploads"), { recursive: true });
process.env.TNL_DATA = DATA;
let pass = 0, fail = 0;
const t = (n, ok) => { ok ? pass++ : fail++; console.log("  " + (ok ? "✓" : "✗") + "  " + n); };
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

// the stand-in for Resend: records every email; can be told to fail
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

const PORT = 18900 + (process.pid % 60);
const srv = spawn(process.execPath, ["--experimental-sqlite", "src/server.js"], { cwd: ROOT, stdio: ["ignore", "pipe", "pipe"], env: { ...process.env,
  PORT: String(PORT), TNL_DATA: DATA, RESEND_API_KEY: "re_test", MAIL_FROM: "TNL LABS <noreply@tnllabs.com>",
  RESEND_API_BASE: `http://127.0.0.1:${fake.address().port}`, EVENT_MAIL_PER_DAY: "3", EVENT_MAIL_GAP_MS: "0", PUBLIC_URL: "https://labs.tnllabs.com" } });
let log = ""; srv.stdout.on("data", (d) => log += d); srv.stderr.on("data", (d) => log += d);
for (let i = 0; i < 100 && !/listening/.test(log); i++) await wait(100);
const call = async (who, path, body, method) => { const r = await fetch(`http://127.0.0.1:${PORT}` + path, { method: method || (body ? "POST" : "GET"), headers: { "Content-Type": "application/json", ...(who ? { Authorization: "Bearer tok-" + who } : {}) }, body: body ? JSON.stringify(body) : undefined }); return { s: r.status, j: await r.json().catch(() => ({})) }; };
const page = async (path, method = "GET") => { const r = await fetch(`http://127.0.0.1:${PORT}` + path, { method }); return { s: r.status, html: await r.text() }; };
const until = async (fn, ms = 4000) => { for (let i = 0; i < ms / 50 && !fn(); i++) await wait(50); };
const ev = (slug, extra = {}) => call("boss", "/api/admin/events", { slug, title: "The Art Tournament · Vol. 1", format: "poll", brief: "Make something about where you come from.\n\nSecond paragraph stays out.",
  prize: "$500 and a feature", opensAt: now + 3 * D, submitDays: 14, voteDays: 7, finalDays: 3, published: true, ...extra });

try {
  console.log("\nNOTHING BEFORE ENTRIES OPEN");
  const a = (await ev("art-vol1")).j;
  t("a new event emails members by default", a.mail?.on === true);
  t("admin sees who it'll go to: confirmed, not suspended, not unsubscribed", a.mail.audience === 5);
  t("…and that 5 is more than 3 a day, so two days", a.mail.perDay === 3);
  await wait(400);
  t("not open yet: nothing sent", SENT.length === 0);

  console.log("\nENTRIES OPEN → EVERY MEMBER, AT THE DAY'S PACE");
  await call("boss", `/api/admin/events/${a.event.id}/advance`, {});
  await until(() => SENT.length >= 3); await wait(300);
  t("the first 3 go out (the day's share)", SENT.length === 3);
  const to = SENT.map((m) => m.to[0]);
  t("to members in order, never twice", to.join() === "boss@x.test,ana@x.test,ben@x.test");
  const m0 = SENT[1];
  t("from the real sender, with the key", m0.from === "TNL LABS <noreply@tnllabs.com>" && m0.auth === "Bearer re_test");
  t("subject says entries are open", m0.subject === "The Art Tournament · Vol. 1: entries are open");
  t("it's addressed to them and has the first paragraph of the brief", m0.html.includes("ANA, entries are open.") && m0.html.includes("Make something about where you come from.") && !m0.html.includes("Second paragraph"));
  t("the prize and the closing date", m0.html.includes("Prize: $500 and a feature") && /Entries close [A-Z][a-z]+ \d+, 20\d\d\./.test(m0.text));
  t("Enter now opens the event in the app", m0.html.includes('href="https://labs.tnllabs.com/?e=art-vol1"'));
  const unsub = /https:\/\/labs\.tnllabs\.com\/mail\/off\?k=([a-f0-9]{36})/.exec(m0.html);
  t("an unsubscribe link in the email…", !!unsub && m0.text.includes(unsub[0]));
  t("…and the one-click headers mail apps turn into a button", m0.headers?.["List-Unsubscribe"] === `<${unsub[0]}>` && m0.headers?.["List-Unsubscribe-Post"] === "List-Unsubscribe=One-Click");
  const s1 = (await call("boss", `/api/admin/events/${a.event.id}`)).j.mail;
  t("admin sees it sending: 3 sent, 2 to go", s1.sent === 3 && s1.left === 2 && !s1.doneAt);

  console.log("\nA PROBLEM AT RESEND STOPS IT; NOBODY IS SKIPPED");
  const { DatabaseSync } = await import("node:sqlite");
  const raw = new DatabaseSync(join(DATA, "tnl.db"));
  raw.prepare(`UPDATE event_mail SET day = '2000-01-01' WHERE event_id = ?`).run(a.event.id);   // a new day
  FAIL = 429;
  await call("boss", `/api/admin/events/${a.event.id}`, { brief: "Make something about where you come from." }, "PATCH"); await wait(400);
  const s2 = (await call("boss", `/api/admin/events/${a.event.id}`)).j.mail;
  t("rate limited: it stops and says why", s2.sent === 3 && /rate limited/.test(s2.lastError || ""));
  FAIL = 0;
  await call("boss", `/api/admin/events/${a.event.id}`, { prize: "$500 and a feature" }, "PATCH");
  await until(() => SENT.length >= 5); await wait(300);
  t("the next day it finishes the rest, from where it stopped", SENT.slice(3).map((m) => m.to[0]).join() === "cy@x.test,dee@x.test");
  t("never the unconfirmed, suspended or unsubscribed", !SENT.some((m) => /unv@|sus@|quiet@/.test(m.to[0])));
  const s3 = (await call("boss", `/api/admin/events/${a.event.id}`)).j.mail;
  t("admin sees it done: sent to 5", s3.sent === 5 && !!s3.doneAt && s3.left === 0 && !s3.lastError);
  await call("boss", `/api/admin/events/${a.event.id}`, { prize: "$500" }, "PATCH"); await wait(400);
  t("saving again later sends nothing more", SENT.length === 5);

  console.log("\nTHE SWITCHES");
  const b = (await ev("quiet-one", { mailOnOpen: false })).j;
  t("switched off: admin sees it off", b.mail.on === false);
  await call("boss", `/api/admin/events/${b.event.id}/advance`, {}); await wait(400);
  t("…and opening it sends nothing", SENT.length === 5);
  const c = (await ev("draft-one", { published: false })).j;
  await call("boss", `/api/admin/events/${c.event.id}/advance`, {}); await wait(400);
  t("a draft (unpublished) event sends nothing", SENT.length === 5);
  await ev("late-one", { opensAt: now - 20 * D }); await wait(400);
  t("entries already closed: it isn't sent late", SENT.length === 5);

  console.log("\nA PREVIEW, FOR ADMINS ONLY");
  const before = SENT.length;
  t("members can't send one", (await call("ana", `/api/admin/events/${a.event.id}/mail-preview`, {})).s === 403);
  const pv = await call("boss", `/api/admin/events/${a.event.id}/mail-preview`, {});
  t("the admin gets one copy, marked Preview", pv.j.to === "boss@x.test" && SENT.length === before + 1 && SENT.at(-1).subject.startsWith("[Preview] "));

  console.log("\nUNSUBSCRIBE");
  const k = unsub[1], off = () => raw.prepare(`SELECT mail_off FROM users WHERE username = 'ana'`).get().mail_off;
  const g = await page(`/mail/off?k=${k}`);
  t("opening the link shows a button and changes nothing (link checkers open every link)", g.s === 200 && g.html.includes(`action="/mail/off?k=${k}"`) && off() === 0);
  const pOff = await page(`/mail/off?k=${k}`, "POST");
  t("the button (or the mail app's one-click) unsubscribes them", pOff.s === 200 && /unsubscribed/.test(pOff.html) && off() === 1);
  t("…and they can turn it back on", (await page(`/mail/on?k=${k}`, "POST")).s === 200 && off() === 0);
  t("a made-up key does nothing", (await page("/mail/off?k=" + "0".repeat(36), "POST")).s === 404 && (await page("/mail/off?k=nope")).s === 404);
  raw.close();

  console.log("\nWHERE IT LIVES");
  const src = readFileSync(join(ROOT, "src/server-10-events-6-mail.js"), "utf8");
  t("at most 80 a day unless told otherwise (Resend's free plan stops at 100)", /EVENT_MAIL_PER_DAY\) \|\| 80/.test(src));
  t("never on Resend's test sender", /const evmReady = \(\) => MAIL_ENABLED && !MAIL_TEST_SENDER;/.test(src));
  const adm = readFileSync(join(ROOT, "public/admin-app/8-events.js"), "utf8");
  t("admin: the switch, the status and the preview button", adm.includes('data-f="mailOnOpen"') && adm.includes("function evMailHTML(") && adm.includes('id="evmprev"'));
} catch (e) {
  fail++; console.log("  ✗  threw: " + e.stack); console.log(log.slice(-2000));
} finally { srv.kill(); fake.close(); }
console.log(`\n  ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
