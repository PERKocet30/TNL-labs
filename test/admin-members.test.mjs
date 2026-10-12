// The member database (2026-10-12): "The admin dashboard should include a
// database of all members and account information." Admins only, every
// member, account details — and never a password, a session or a Stripe id.
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { rmSync, mkdirSync, readFileSync } from "node:fs";
const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const DATA = join(ROOT, "test/.tmp/admin-members");
rmSync(DATA, { recursive: true, force: true }); mkdirSync(DATA, { recursive: true });
process.env.TNL_DATA = DATA;
const { db } = await import(join(ROOT, "src/db.js"));
const now = Date.now();
const U = (n, o = {}) => { const id = Number(db.prepare(`INSERT INTO users (username, display_name, email, password_hash, created_at, email_verified, is_admin, pronouns, links, stripe_account) VALUES (?,?,?,?,?,?,?,?,?,?)`)
  .run(n, o.name || n, n + "@x.com", "HASH-" + n, now - (o.ago || 0), o.verified ?? 1, o.admin ? 1 : 0, o.pronouns || "", JSON.stringify(o.links || []), o.stripe || "").lastInsertRowid);
  db.prepare(`INSERT INTO sessions (token, user_id, created_at) VALUES (?,?,?)`).run("tok-" + n, id, now); return id; };
U("boss", { admin: true });
U("ana", { pronouns: "she/her", links: [{ url: "https://ana.studio" }], stripe: "acct_SECRET123", verified: 0 });
U("evil", { name: "=HYPERLINK(\"http://bad\",\"x\")" });
const many = db.prepare(`INSERT INTO users (username, display_name, email, password_hash, created_at, email_verified) VALUES (?,?,?,?,?,1)`);
for (let i = 0; i < 330; i++) many.run("m" + i, "Member " + i, `m${i}@x.com`, "h", now - i * 1000);

let pass = 0, fail = 0;
const t = (n, ok) => { ok ? pass++ : fail++; console.log("  " + (ok ? "✓" : "✗") + "  " + n); };
const PORT = 8872, B = `http://localhost:${PORT}`;
const srv = spawn(process.execPath, ["--experimental-sqlite", "--no-warnings", "src/server.runtime.js"], {
  cwd: ROOT, env: { ...process.env, TNL_DATA: DATA, PORT: String(PORT), STRIPE_SECRET_KEY: "", TNL_NO_VIDEO_FIX: "1", TNL_NO_WATCH: "1" }, stdio: "ignore" });
const get = (path, who) => fetch(B + path, { headers: who ? { authorization: "Bearer tok-" + who } : {} });
try {
  for (let i = 0; i < 100; i++) { try { if ((await fetch(B + "/api/health")).ok) break; } catch {} await new Promise((r) => setTimeout(r, 100)); }
  console.log("\nADMINS ONLY");
  t("signed out: no file", (await get("/api/admin/members.csv")).status === 401);
  t("a member: no file", (await get("/api/admin/members.csv", "ana")).status === 403);
  t("a member: no list", (await get("/api/admin/people?all=1", "ana")).status === 403);

  console.log("\nTHE DATABASE VIEW");
  const all = await (await get("/api/admin/people?all=1", "boss")).json();
  t("every member, not the first 300", all.people.length === 333 && all.total === 333);
  t("the list view still stops at 300", (await (await get("/api/admin/people", "boss")).json()).people.length === 300);
  const one = await (await get("/api/admin/people/ana", "boss")).json();
  t("a person's account: email, pronouns, links, member no., payouts started", one.person.email === "ana@x.com" && one.person.pronouns === "she/her"
    && one.person.links[0].url === "https://ana.studio" && Number.isInteger(one.person.id) && one.person.stripeConnected === true && one.person.payouts === false);
  const raw = JSON.stringify(one);
  t("…never the password, a session or the Stripe account id", !/HASH-|tok-ana|acct_SECRET/.test(raw));

  console.log("\nDOWNLOAD CSV");
  const r = await get("/api/admin/members.csv", "boss");
  const csv = await r.text();
  t("a spreadsheet file, named for today, not cached", r.status === 200 && /text\/csv/.test(r.headers.get("content-type")) && /tnl-labs-members-\d{4}-\d\d-\d\d\.csv/.test(r.headers.get("content-disposition")) && /no-store/.test(r.headers.get("cache-control")));
  const lines = csv.replace(/^﻿/, "").split("\r\n");
  t("a header and one row per member", lines.length === 334 && lines[0].startsWith("member_id,username,display_name,email,email_confirmed"));
  const ana = lines.find((l) => l.includes(",ana,"));
  t("account information in the row", ana && ana.includes("ana@x.com") && ana.includes(",no,") && ana.includes("she/her") && ana.includes("https://ana.studio") && ana.includes(",started,"));
  t("never a password hash, a session token or a Stripe id", !/HASH-|tok-|acct_SECRET|password/i.test(csv));
  t("a name that looks like a formula stays words", csv.includes(`"'=HYPERLINK(""http://bad"",""x"")"`));
  const log = db.prepare(`SELECT action FROM admin_log ORDER BY id DESC LIMIT 1`).get();
  t("every download is in the admin log", log && /downloaded the member database \(333 members\)/.test(log.action));

  console.log("\nIN /admin");
  const js = readFileSync(join(ROOT, "public/admin-app/3-people.js"), "utf8");
  t("People has List | Database, Download CSV, and an Account section", js.includes('data-pview="db"') && js.includes('id="pcsv"') && js.includes('<h2 class="sec">Account</h2>'));
} finally { srv.kill(); }
console.log(`\n  ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
