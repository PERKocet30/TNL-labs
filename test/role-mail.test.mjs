// ROLE MAIL v1.0 (2026-10-28): "anytime someone is made an admin or lab leader
// they're emailed." Boots the real server (no email key, so sends are logged)
// and checks a new Mod and a new Lead each get one email — not on removal,
// not twice — plus what the emails say.
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { mkdirSync, rmSync } from "node:fs";
import { spawn } from "node:child_process";
const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const DATA = join(ROOT, "test/.tmp/role-mail");
rmSync(DATA, { recursive: true, force: true }); mkdirSync(DATA, { recursive: true });
process.env.TNL_DATA = DATA;
let pass = 0, fail = 0;
const t = (n, ok) => { ok ? pass++ : fail++; console.log("  " + (ok ? "✓" : "✗") + "  " + n); };

console.log("\nWHAT THE EMAILS SAY");
const { roleEmail, roleSubject } = await import("../src/mail.js");
const m = roleEmail({ name: "Ana", role: "mod", by: "boss", url: "https://labs.example/admin" });
t("Mod: says who made them a Mod, links to Admin", /@boss made you a Mod/.test(m.text) && /Open Admin: https:\/\/labs\.example\/admin/.test(m.text));
t("Mod: says changes are logged", /logged with your name/.test(m.text));
const l = roleEmail({ name: "Ana", role: "lead", lab: "Fashion", by: "boss", url: "https://labs.example/?l=fashion" });
t("Lead: names the lab and links into it", /You lead \/\/ Fashion/.test(l.text) && /https:\/\/labs\.example\/\?l=fashion/.test(l.text));
t("Lead: explains pin and take down", /Pin and Take down/.test(l.text));
t("subjects", roleSubject("mod") === "You're a Mod on LABS" && roleSubject("lead", "Music") === "You lead // Music — LABS");
t("the html escapes and carries the title", /You lead \/\/ Fashion/.test(l.html));

const { db } = await import("../src/db.js");
const now = Date.now();
const mk = (u, admin = 0) => {
  const id = Number(db.prepare(`INSERT INTO users (username, display_name, email, password_hash, created_at, email_verified) VALUES (?,?,?,?,?,1)`)
    .run(u, u.toUpperCase(), u + "@x.test", "x", now, ).lastInsertRowid);
  db.prepare(`UPDATE users SET is_admin = ? WHERE id = ?`).run(admin, id);
  db.prepare(`INSERT INTO sessions (token, user_id, created_at) VALUES (?,?,?)`).run("tok-" + u, id, now);
};
mk("boss", 1); mk("ana"); mk("lea");
db.close();

const PORT = 18100 + (process.pid % 200);
const srv = spawn(process.execPath, ["--experimental-sqlite", "src/server.js"], { cwd: ROOT, env: { ...process.env, PORT: String(PORT), TNL_DATA: DATA, RESEND_API_KEY: "" }, stdio: ["ignore", "pipe", "pipe"] });
let log = ""; srv.stdout.on("data", (d) => log += d); srv.stderr.on("data", (d) => log += d);
for (let i = 0; i < 100 && !/listening/.test(log); i++) await new Promise((r) => setTimeout(r, 100));
const call = async (who, method, path, body) => {
  const r = await fetch(`http://127.0.0.1:${PORT}` + path, { method, headers: { "Content-Type": "application/json", Authorization: "Bearer tok-" + who }, body: body ? JSON.stringify(body) : undefined });
  let j = {}; try { j = await r.json(); } catch {}
  return { s: r.status, j };
};
const settle = () => new Promise((r) => setTimeout(r, 400));
const count = (re) => (log.match(re) || []).length;
try {
  console.log("\nSENT WHEN IT HAPPENS");
  await call("boss", "POST", "/api/admin/members/ana/mod", { on: true }); await settle();
  t("making ana a Mod emails ana", count(/You're a Mod on LABS — role email to ana@x\.test/g) === 1);
  await call("boss", "POST", "/api/admin/members/ana/mod", { on: true }); await settle();
  t("…once — doing it again doesn't send another", count(/You're a Mod on LABS — role email to ana@x\.test/g) === 1);
  await call("ana", "POST", "/api/admin/members/lea/lead", { lab: "fashion", on: true }); await settle();
  t("a Mod making lea Lead of // Fashion emails lea", count(/You lead \/\/ Fashion — LABS — role email to lea@x\.test/g) === 1);
  await call("ana", "POST", "/api/admin/members/lea/lead", { lab: "fashion", on: true }); await settle();
  t("…once", count(/You lead \/\/ Fashion — LABS — role email to lea@x\.test/g) === 1);
  await call("boss", "POST", "/api/admin/members/lea/lead", { lab: "culture", on: true }); await settle();
  t("a second lab is its own email", count(/You lead \/\/ Music — LABS — role email to lea@x\.test/g) === 1);
  const before = count(/role email to/g);
  await call("boss", "POST", "/api/admin/members/lea/lead", { lab: "culture", on: false });
  await call("boss", "POST", "/api/admin/members/ana/mod", { on: false }); await settle();
  t("removing a role sends nothing", count(/role email to/g) === before);
  t("a refused appointment sends nothing", (await call("lea", "POST", "/api/admin/members/ana/mod", { on: true })).s === 403 && count(/role email to/g) === before);
} catch (e) {
  fail++; console.log("  ✗  threw: " + e.message); console.log(log.slice(-1500));
} finally { srv.kill(); }
console.log(`\n  ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
