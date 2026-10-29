// Honest accounts v1.0 (2026-10-27): "I don't want to hurt real people joining
// the app. But I need to stop fake accounts from being possible." No throwaway
// emails at sign-up; one vote per phone per piece per day in the tournament.
// Real server; nothing leaves the machine.
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { mkdirSync, rmSync, writeFileSync, readFileSync } from "node:fs";
import { spawn } from "node:child_process";
const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const DATA = join(ROOT, "test/.tmp/honest");
rmSync(DATA, { recursive: true, force: true }); mkdirSync(join(DATA, "uploads"), { recursive: true });
process.env.TNL_DATA = DATA;
let pass = 0, fail = 0;
const t = (n, ok) => { ok ? pass++ : fail++; console.log("  " + (ok ? "✓" : "✗") + "  " + n); };
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const { db } = await import("../src/db.js");
const now = Date.now(), D = 86400000;
const mk = (u, { admin = 0 } = {}) => {
  const id = Number(db.prepare(`INSERT INTO users (username, display_name, email, password_hash, created_at, email_verified, avatar_url) VALUES (?,?,?,?,?,1,'/uploads/av.jpg')`).run(u, u, u + "@x.test", "x", now - 30 * D).lastInsertRowid);
  if (admin) db.prepare(`UPDATE users SET is_admin = 1 WHERE id = ?`).run(id);
  db.prepare(`INSERT INTO sessions (token, user_id, created_at) VALUES (?,?,?)`).run("tok-" + u, id, now);
  return id;
};
mk("boss", { admin: 1 }); for (const m of ["art", "ana", "ben", "cy", "dee"]) mk(m);
const old = mk("old"); db.prepare(`UPDATE users SET email = 'zz9@hilmail.dpdns.org' WHERE id = ?`).run(old);   // joined before the rule, on a throwaway
writeFileSync(join(DATA, "uploads", "e0.jpg"), "x");
db.close();
const PORT = 18880 + (process.pid % 40);
const srv = spawn(process.execPath, ["--experimental-sqlite", "src/server.js"], { cwd: ROOT, stdio: ["ignore", "pipe", "pipe"],
  env: { ...process.env, PORT: String(PORT), TNL_DATA: DATA, TNL_NO_WATCH: "1", RESEND_API_KEY: "", STRIPE_SECRET_KEY: "", TNL_BLOCK_EMAIL_DOMAINS: "junk.example" } });
let log = ""; srv.stdout.on("data", (d) => log += d); srv.stderr.on("data", (d) => log += d);
for (let i = 0; i < 100 && !/listening/.test(log); i++) await wait(100);
const B = `http://127.0.0.1:${PORT}`;
const call = async (who, path, body, { device, method } = {}) => {
  const r = await fetch(B + path, { method: method || (body ? "POST" : "GET"), headers: { "Content-Type": "application/json", ...(who ? { Authorization: "Bearer tok-" + who } : {}), ...(device ? { "X-Device": device } : {}) }, body: body ? JSON.stringify(body) : undefined });
  return { s: r.status, j: await r.json().catch(() => ({})) };
};
const join_ = (u, email) => call(null, "/api/auth/register", { username: u, displayName: u, email, password: "Gallery2026x", roles: ["Painter"] });
try {
  console.log("\nNO THROWAWAY EMAILS");
  t("a real address joins", (await join_("real1", "real.person@gmail.com")).s === 200);
  t("a known throwaway service is refused, plainly", (await join_("fake1", "x@mailinator.com")).j.error === "Use a real email address — temporary inboxes can't join.");
  t("…and anything under one (last night's *.dpdns.org inboxes)", (await join_("fake2", "jfu5wb48px99@hilmail.dpdns.org")).s === 400);
  t("TNL_BLOCK_EMAIL_DOMAINS adds more without a deploy", (await join_("fake4", "a@junk.example")).s === 400);
  t("a real address at an unusual domain is fine", (await join_("real2", "ana@btopenworld.com")).s === 200);

  console.log("\nONE VOTE PER PHONE");
  const ev = (await call("boss", "/api/admin/events", { slug: "art", title: "Art", brief: "x", format: "poll", picks: 1, minAccountDays: 0, opensAt: now - D, submitDays: 14, voteDays: 7, finalDays: 3, published: true, mailOnOpen: false })).j;
  const en = (await call("art", "/api/events/art/enter", { imageUrl: "/uploads/e0.jpg", caption: "mine", agree: true })).j;
  const entryId = (en.entries || en.event?.entries || [])[0]?.id || en.myEntry?.id;
  t("an entry is in", !!entryId);
  await call("boss", `/api/admin/events/${ev.event.id}/advance`, {});   // entries close, voting opens
  const vote = (who, device) => call(who, "/api/events/art/vote", { entryId, on: true }, { device });
  const PHONE = "a1b2c3d4e5f60718a9b0c1d2";
  t("ana votes from her phone", (await vote("ana", PHONE)).s === 200);
  const r2 = await vote("ben", PHONE);
  t("ben, a second account on the same phone, can't vote for that piece today", r2.s === 403 && r2.j.error === "This phone already voted for this piece today. One vote per phone.");
  t("ben on his own phone: fine", (await vote("ben", "ffffffffffffffff")).s === 200);
  t("cy with no phone mark (an old page): still counted", (await vote("cy", "")).s === 200);
  const sb = (await call("dee", "/api/events/art")).j;
  const total = JSON.stringify(sb).match(/"votes":(\d+)/g) || [];
  t("the scoreboard counts 3, not 4", total.some((m) => m === '"votes":3'));
  t("taking a vote back from the same phone is allowed (it's hers)", (await call("ana", "/api/events/art/vote", { entryId, on: false }, { device: PHONE })).s === 200);
  const src = readFileSync(join(ROOT, "src/server-01-honest.js"), "utf8"), app = readFileSync(join(ROOT, "src/app-07-theme-labs-api.js"), "utf8");
  t("the app sends its mark with every request", /h\["X-Device"\]=dv/.test(app) && /tnl-dev/.test(readFileSync(join(ROOT, "src/app-07-device.js"), "utf8")));
  t("a mark is random hex, nothing about the person", /\^\[a-f0-9\]\{16,32\}\$/.test(src));
  const fn = new Function("process", src + "\nreturn emailThrowaway;")({ env: {} });
  t("the check itself: capitals, spaces and deep subdomains don't get around it", fn("  A@MAILINATOR.COM ") && fn("a@sub.deep.dpdns.org") && !fn("ana@gmail.com") && !fn("x@notmailinator.com"));

  console.log("\nACCOUNTS ALREADY ON A THROWAWAY: UPDATE FIRST");
  const me = (await call("old", "/api/me")).j.user;
  t("the app is told the email needs fixing", me.fixEmail === true);
  t("they can still look", (await call("old", "/api/events/art")).s === 200);
  const v = await vote("old", "0123456789abcdef");
  t("…but not vote, like or post until it's fixed, and the app is told why", v.s === 403 && v.j.fixEmail === true && /real email/.test(v.j.error));
  t("another throwaway isn't accepted as the fix", (await call("old", "/api/auth/email", { email: "zz@mailinator.com" })).s === 400);
  t("someone else's email isn't", (await call("old", "/api/auth/email", { email: "ana@x.test" })).s === 409);
  const fix = await call("old", "/api/auth/email", { email: "Old.Real@gmail.com" });
  t("a real one is saved and a confirmation goes to the new inbox", fix.s === 200 && fix.j.email === "Old.Real@gmail.com" && !!fix.j.verifyUrl);
  const me2 = (await call("old", "/api/me")).j.user;
  t("nothing left to fix; the new address waits to be confirmed", me2.fixEmail === false && me2.email === "Old.Real@gmail.com" && me2.emailVerified === false);
  t("…and the vote goes through once confirmed", (await (async () => { await fetch(fix.j.verifyUrl); return vote("old", "0123456789abcdef"); })()).s === 200);

  console.log("\nNEW ACCOUNTS WAIT 5 MINUTES (WHILE THEY SET UP)");
  { const { DatabaseSync } = await import("node:sqlite"); const w = new DatabaseSync(join(DATA, "tnl.db"));   // joined this second (sign-up's 5-an-hour is used up above)
    const id = Number(w.prepare(`INSERT INTO users (username, display_name, email, password_hash, created_at, email_verified, avatar_url) VALUES ('fresh1','fresh1','fresh.person@gmail.com','x',?,1,'/uploads/av.jpg')`).run(Date.now()).lastInsertRowid);
    w.prepare(`INSERT INTO sessions (token, user_id, created_at) VALUES ('tok-fresh1', ?, ?)`).run(id, Date.now()); w.close(); }
  const fresh = { s: 200, j: { token: "tok-fresh1" } };
  const r5 = await fetch(B + "/api/events/art/vote", { method: "POST", headers: { "Content-Type": "application/json", Authorization: "Bearer " + fresh.j.token, "X-Device": "abcdefabcdefabcdefab" }, body: JSON.stringify({ entryId, on: true }) });
  const j5 = await r5.json();
  t("a brand-new account can't vote yet, and is just told to finish its account", fresh.s === 200 && r5.status === 403 && j5.error === "Finish setting up your account to vote.");
  { const { DatabaseSync } = await import("node:sqlite"); const w = new DatabaseSync(join(DATA, "tnl.db")); w.prepare(`UPDATE users SET created_at = created_at - 301000, email_verified = 1 WHERE username = 'fresh1'`).run(); w.close(); }
  const r6 = await fetch(B + "/api/events/art/vote", { method: "POST", headers: { "Content-Type": "application/json", Authorization: "Bearer " + fresh.j.token, "X-Device": "abcdefabcdefabcdefab" }, body: JSON.stringify({ entryId, on: true }) });
  t("five minutes on, the vote goes through", r6.status === 200);

  console.log("\nA LONGER WAIT BY THE COUNTRY AN ACCOUNT JOINED FROM (2026-10-29)");
  const newcomer = async (u, country, minsAgo) => { const { DatabaseSync } = await import("node:sqlite"); const w = new DatabaseSync(join(DATA, "tnl.db"));
    const id = Number(w.prepare(`INSERT INTO users (username, display_name, email, password_hash, created_at, email_verified, avatar_url) VALUES (?,?,?,?,?,1,'/uploads/av.jpg')`).run(u, u, u + ".person@gmail.com", "x", Date.now() - minsAgo * 60000).lastInsertRowid);
    w.prepare(`INSERT INTO sessions (token, user_id, created_at) VALUES (?, ?, ?)`).run("tok-" + u, id, Date.now());
    w.prepare(`INSERT INTO join_signals (user_id, country, created_at) VALUES (?,?,?)`).run(id, country, Date.now()); w.close(); };
  const voteAs = async (u, dev) => { const r = await fetch(B + "/api/events/art/vote", { method: "POST", headers: { "Content-Type": "application/json", Authorization: "Bearer tok-" + u, "X-Device": dev }, body: JSON.stringify({ entryId, on: true }) }); return { s: r.status, j: await r.json() }; };
  await newcomer("india6", "IN", 6); await newcomer("us6", "US", 6); await newcomer("india11", "IN", 11); await newcomer("india7", "IN", 7);
  const i6 = await voteAs("india6", "1111111111111111aaaa");
  t("joined from India 6 minutes ago: still waiting, with the same words as everyone", i6.s === 403 && i6.j.error === "Finish setting up your account to vote.");
  t("joined from the US 6 minutes ago: votes", (await voteAs("us6", "2222222222222222bbbb")).s === 200);
  t("joined from India 11 minutes ago: votes", (await voteAs("india11", "3333333333333333cccc")).s === 200);
  { const { DatabaseSync } = await import("node:sqlite"); const w = new DatabaseSync(join(DATA, "tnl.db"));
    w.prepare(`INSERT INTO settings (key, value, updated_at) VALUES ('voteWaitCountries', '', ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value`).run(Date.now()); w.close(); }
  t("Admin clears the list: back to everyone's 5 minutes", (await voteAs("india7", "4444444444444444dddd")).s === 200);
} finally { srv.kill(); }
console.log(`\n  ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
