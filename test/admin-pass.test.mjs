// Admin pass (2026-10-11): "If you're logged in already you shouldn't have
// to log in again." The watch emails' Open Admin carries a one-time pass:
// one use, 24 hours, admins only, stored hashed, and only the page's own
// script redeems it — a mail scanner opening the link can't use it up.
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { rmSync, mkdirSync, readFileSync } from "node:fs";
import { createHash, randomBytes } from "node:crypto";
import { DatabaseSync } from "node:sqlite";
const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const DATA = join(ROOT, "test/.tmp/admin-pass");
rmSync(DATA, { recursive: true, force: true }); mkdirSync(DATA, { recursive: true });
let pass = 0, fail = 0;
const t = (n, ok) => { ok ? pass++ : fail++; console.log("  " + (ok ? "✓" : "✗") + "  " + n); };
const sha = (s) => createHash("sha256").update(s).digest("hex");

console.log("\nTHE LINK IN THE EMAIL");
{
  const mem = new DatabaseSync(":memory:");
  mem.exec(`CREATE TABLE users (id INTEGER PRIMARY KEY, email TEXT, is_admin INTEGER, suspended INTEGER)`);
  mem.prepare(`INSERT INTO users VALUES (1, 'Boss@Example.com', 1, 0), (2, 'member@example.com', 0, 0), (3, 'gone@example.com', 1, 1)`).run();
  const src = readFileSync(join(ROOT, "src/server-10-watch-pass.js"), "utf8");
  const app = { get() {}, post() {} };
  process.env.PUBLIC_URL = "https://labs.example\n";
  const link = new Function("db", "app", "lookPage", "lookEyebrow", "rateLimit", "q", "createHash", "randomBytes", src + "\nreturn adminPassLink;")(mem, app, null, null, () => null, null, createHash, randomBytes);
  const l1 = link("boss@example.com", 1000), tok = /\?t=([0-9a-f]{48})#system$/.exec(l1);
  t("an email to the admin carries a pass, to Admin → System", l1.startsWith("https://labs.example/admin/pass?t=") && !!tok);
  const row = tok && mem.prepare(`SELECT * FROM admin_passes WHERE hash = ?`).get(sha(tok[1]));
  t("only its SHA-256 is kept, for a day", !!row && row.user_id === 1 && row.expires_at === 1000 + 86400000 && !mem.prepare(`SELECT 1 FROM admin_passes WHERE hash = ?`).get(tok[1]));
  t("each email gets its own", link("boss@example.com", 2000) !== l1);
  t("not an admin → plain Admin link, no pass", link("member@example.com") === "https://labs.example/admin#system");
  t("a suspended admin → no pass", link("gone@example.com") === "https://labs.example/admin#system");
  link("boss@example.com", 1000 + 86400000 + 1);
  t("old passes are swept when a new one is made", !mem.prepare(`SELECT 1 FROM admin_passes WHERE hash = ?`).get(sha(tok[1])));
  delete process.env.PUBLIC_URL;
  t("the watch emails use it", readFileSync(join(ROOT, "src/server-10-watch.js"), "utf8").includes("adminPassLink(watchTo)"));
}

console.log("\nOPENING IT");
process.env.TNL_DATA = DATA;
const { db } = await import(join(ROOT, "src/db.js"));
const now = Date.now();
const U = (name, admin) => Number(db.prepare(`INSERT INTO users (username, display_name, email, password_hash, created_at, email_verified, is_admin) VALUES (?,?,?,?,?,1,?)`)
  .run(name, name, name + "@x.com", "h", now, admin).lastInsertRowid);
const boss = U("boss", 1), member = U("member", 0);
const P = (uid, exp) => { const tk = randomBytes(24).toString("hex"); db.prepare(`INSERT INTO admin_passes (hash, user_id, expires_at, created_at) VALUES (?,?,?,?)`).run(sha(tk), uid, exp, now); return tk; };
const PORT = 8871, B = `http://localhost:${PORT}`;
const srv = spawn(process.execPath, ["--experimental-sqlite", "--no-warnings", "src/server.runtime.js"], {
  cwd: ROOT, env: { ...process.env, TNL_DATA: DATA, PORT: String(PORT), STRIPE_SECRET_KEY: "", TNL_NO_VIDEO_FIX: "1", TNL_NO_WATCH: "1" }, stdio: "ignore" });
try {
  for (let i = 0; i < 100; i++) { try { if ((await fetch(B + "/api/health")).ok) break; } catch {} await new Promise((r) => setTimeout(r, 100)); }
  const redeem = async (tk) => { const r = await fetch(B + "/api/auth/admin-pass", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ t: tk }) }); return { status: r.status, ...(await r.json()) }; };
  const good = P(boss, now + 3600000);
  const page = await fetch(B + "/admin/pass?t=" + good);
  const html = await page.text();
  t("the link opens a page that redeems it with its own script", page.status === 200 && html.includes("/api/auth/admin-pass") && page.headers.get("cache-control") === "no-store");
  t("opening the link alone (a mail scanner) doesn't use it up", !!db.prepare(`SELECT 1 FROM admin_passes WHERE hash = ?`).get(sha(good)));
  const r1 = await redeem(good);
  const me = r1.token && await (await fetch(B + "/api/me", { headers: { Authorization: "Bearer " + r1.token } })).json();
  t("redeemed: a session for the admin — signed in, no password", r1.status === 200 && me && me.user && me.user.username === "boss" && me.user.isAdmin === true);
  t("it works once", (await redeem(good)).status === 400);
  const old = P(boss, now - 1000);
  const r2 = await redeem(old);
  t("a pass over a day old doesn't work, and is gone", r2.status === 400 && /more than a day old/.test(r2.error) && !db.prepare(`SELECT 1 FROM admin_passes WHERE hash = ?`).get(sha(old)));
  const lost = P(member, now + 3600000);
  t("a pass for someone who isn't an admin (any more) signs nobody in", (await redeem(lost)).status === 403);
  t("a made-up pass doesn't work", (await redeem("0".repeat(48))).status === 400 && (await redeem("")).status === 400);
  const inj = await (await fetch(B + "/admin/pass?t=" + encodeURIComponent("</script><script>alert(1)</script>"))).text();
  t("whatever is in the link can't break out of the page's script", !inj.includes("</script><script>alert(1)"));
} finally { srv.kill(); }
console.log(`\n  ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
