// The sign-in holes from the code audit (2026-11-15), closed: changing an account's email takes its password and
// tells the old address; capitals don't make a second account on the same address; a display name can't carry a
// paragraph into the confirm email; a suspended account is nobody on the look-around routes; and the owner's admin
// rights only go to an address its owner confirmed. Runs the real server; mail goes to a stand-in on localhost.
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { mkdirSync, rmSync } from "node:fs";
import { spawn } from "node:child_process";
import { createServer } from "node:http";
import bcrypt from "bcryptjs";
const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const DATA = join(ROOT, "test/.tmp/signin-audit");
rmSync(DATA, { recursive: true, force: true }); mkdirSync(join(DATA, "uploads"), { recursive: true });
process.env.TNL_DATA = DATA;
let pass = 0, fail = 0;
const t = (n, ok) => { ok ? pass++ : fail++; console.log("  " + (ok ? "✓" : "✗") + "  " + n); };
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

const SENT = [];
const fake = createServer((req, res) => { let b = ""; req.on("data", (d) => b += d); req.on("end", () => {
  SENT.push(JSON.parse(b)); res.writeHead(200, { "Content-Type": "application/json" }); res.end(`{"id":"e${SENT.length}"}`); }); });
await new Promise((r) => fake.listen(0, "127.0.0.1", r));

const { db } = await import("../src/db.js");
const now = Date.now(), hash = bcrypt.hashSync("violet-kiln-27", 4);
const mk = (u, email, verified = 1) => { const id = Number(db.prepare(`INSERT INTO users (username, display_name, email, password_hash, created_at, email_verified) VALUES (?,?,?,?,?,?)`).run(u, u, email, hash, now - 30 * 86400000, verified).lastInsertRowid);
  db.prepare(`INSERT INTO sessions (token, user_id, created_at) VALUES (?,?,?)`).run("tok-" + u, id, now); return id; };
const boss = mk("boss", "boss@x.test"); db.prepare(`UPDATE users SET is_admin = 1 WHERE id = ?`).run(boss);
const ana = mk("ana", "Ana.Real@gmail.com");
db.prepare(`INSERT INTO sessions (token, user_id, created_at) VALUES ('tok-ana-other', ?, ?)`).run(ana, now);
db.prepare(`INSERT INTO reset_tokens (token, user_id, expires_at, created_at) VALUES ('ana-reset', ?, ?, ?)`).run(ana, now + 3600000, now);
const old = mk("old", "zz9@hilmail.dpdns.org");           // on a throwaway address: the one place the app offers a change
const imp = mk("imp", "Owner@labs-owner.test", 0);        // typed the owner's address in, never confirmed it
const sus = mk("sus", "sus@x.test"); db.prepare(`UPDATE users SET suspended = 1 WHERE id = ?`).run(sus);
db.prepare(`INSERT INTO posts (author_id, channel, body, is_work, created_at) VALUES (?, 'general', 'private talk', 0, ?)`).run(ana, now);
db.close();

const PORT = 19180 + (process.pid % 30), B = `http://127.0.0.1:${PORT}`;
const srv = spawn(process.execPath, ["--experimental-sqlite", "src/server.js"], { cwd: ROOT, stdio: ["ignore", "pipe", "pipe"], env: { ...process.env,
  PORT: String(PORT), TNL_DATA: DATA, RESEND_API_KEY: "re_test", MAIL_FROM: "LABS <noreply@tnllabs.com>", SUPPORT_EMAIL: "support@tnllabs.com",
  RESEND_API_BASE: `http://127.0.0.1:${fake.address().port}`, ADMIN_EMAIL: "owner@labs-owner.test", TNL_NO_WATCH: "1", NUDGE_TICK_MS: "3600000", PUBLIC_URL: "https://labs.tnllabs.com" } });
let log = ""; srv.stdout.on("data", (d) => log += d); srv.stderr.on("data", (d) => log += d);
for (let i = 0; i < 100 && !/listening/.test(log); i++) await wait(100);
const call = async (who, path, body) => { const r = await fetch(B + path, { method: body ? "POST" : "GET", headers: { "Content-Type": "application/json", ...(who ? { Authorization: "Bearer " + who } : {}) }, body: body ? JSON.stringify(body) : undefined }); return { s: r.status, j: await r.json().catch(() => ({})) }; };
const { DatabaseSync } = await import("node:sqlite");
const one = (sql, ...a) => { const r = new DatabaseSync(join(DATA, "tnl.db")); const x = r.prepare(sql).get(...a); r.close(); return x; };

try {
  console.log("\nCHANGING AN ACCOUNT'S EMAIL");
  const no = await call("tok-ana", "/api/auth/email", { email: "taker@gmail.com" });
  t("off a real address with no password: refused, and nothing changes", no.s === 403 && no.j.needPassword === true && one(`SELECT email FROM users WHERE id = ?`, ana).email === "Ana.Real@gmail.com");
  t("a wrong password: refused", (await call("tok-ana", "/api/auth/email", { email: "taker@gmail.com", password: "nope-nope-11" })).s === 403);
  const yes = await call("tok-ana", "/api/auth/email", { email: "ana.new@gmail.com", password: "violet-kiln-27" });
  t("with the password: changed, waiting to be confirmed", yes.s === 200 && one(`SELECT email, email_verified v FROM users WHERE id = ?`, ana).email === "ana.new@gmail.com" && one(`SELECT email_verified v FROM users WHERE id = ?`, ana).v === 0);
  t("…this phone stays signed in; every other device is signed out", (await call("tok-ana", "/api/me")).s === 200 && (await call("tok-ana-other", "/api/me")).s === 401);
  t("…an open reset link stops working", one(`SELECT COUNT(*) n FROM reset_tokens WHERE token = 'ana-reset'`).n === 0);
  await wait(400);
  const note = SENT.find((m) => m.to[0] === "Ana.Real@gmail.com");
  t("…and the old address is told, with what to do if it wasn't them", !!note && /Your LABS email was changed/.test(note.subject) && /reply to this email/i.test(note.text) && !note.text.includes("ana.new@gmail.com"));
  const fix = await call("tok-old", "/api/auth/email", { email: "Old.Real@gmail.com" });
  t("replacing a throwaway address (the one place the app offers it) needs no password, as before", fix.s === 200 && fix.j.email === "Old.Real@gmail.com");
  t("…and no notice goes to the throwaway inbox", !SENT.some((m) => /hilmail/.test(m.to[0])));

  console.log("\nJOINING");
  const cap = await call(null, "/api/auth/register", { username: "copycat", displayName: "Copy", email: "BOSS@X.TEST", password: "violet-orbit-lantern-77", roles: ["Painter"] });
  t("the same address in other capitals can't make a second account", cap.s === 409 && one(`SELECT COUNT(*) n FROM users WHERE LOWER(email) = 'boss@x.test'`).n === 1);
  const long = await call(null, "/api/auth/register", { username: "longname", displayName: "L".repeat(300), email: "longname@labs-test.org", password: "violet-orbit-lantern-77", roles: ["Painter"] });
  t("a display name is kept to 40 characters, as Edit profile keeps it", long.s === 200 && one(`SELECT LENGTH(display_name) n FROM users WHERE username = 'longname'`).n === 40);

  console.log("\nA SUSPENDED ACCOUNT, AND THE OWNER'S RIGHTS");
  const feed = await call("tok-sus", "/api/posts/1");
  t("a suspended account's key is nobody on the look-around routes (a signed-in-only post stays hidden)", feed.s === 404);
  t("an account that typed the owner's address in without confirming it is not made admin", one(`SELECT is_admin a FROM users WHERE id = ?`, imp).a === 0 && (await call("tok-imp", "/api/admin/health")).s === 403);
  t("…and the real admin is untouched", one(`SELECT is_admin a FROM users WHERE id = ?`, boss).a === 1);
} finally { srv.kill(); fake.close(); if (fail) console.log("\n--- server log ---\n" + log.split("\n").slice(-25).join("\n")); }
console.log(`\n  ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
