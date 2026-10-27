// Sign-in switches (2026-10-26): "Hide the login for now… no way to turn it off on the app?"
// Admin → Settings → Sign in with: Google / Apple / Facebook. Off hides that button and
// refuses its sign-in, even with its keys in Railway; on brings it back.
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { mkdirSync, rmSync, readFileSync } from "node:fs";
import { spawn } from "node:child_process";
const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const DATA = join(ROOT, "test/.tmp/signin-switch");
rmSync(DATA, { recursive: true, force: true }); mkdirSync(join(DATA, "uploads"), { recursive: true });
process.env.TNL_DATA = DATA;
let pass = 0, fail = 0;
const t = (n, ok) => { ok ? pass++ : fail++; console.log("  " + (ok ? "✓" : "✗") + "  " + n); };
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const { db } = await import("../src/db.js");
const now = Date.now();
for (const [u, adm] of [["boss", 1], ["ana", 0]]) {
  const id = Number(db.prepare(`INSERT INTO users (username, display_name, email, password_hash, created_at, email_verified, is_admin) VALUES (?,?,?,?,?,1,?)`).run(u, u, u + "@x.test", "x", now, adm).lastInsertRowid);
  db.prepare(`INSERT INTO sessions (token, user_id, created_at) VALUES (?,?,?)`).run("tok-" + u, id, now);
}
db.close();
const PORT = 18990 + (process.pid % 9);
const srv = spawn(process.execPath, ["--experimental-sqlite", "src/server.js"], { cwd: ROOT, stdio: ["ignore", "pipe", "pipe"], env: { ...process.env,
  PORT: String(PORT), TNL_DATA: DATA, TNL_NO_WATCH: "1", RESEND_API_KEY: "", STRIPE_SECRET_KEY: "",
  FACEBOOK_APP_ID: "fb-id", FACEBOOK_APP_SECRET: "fb-secret", GOOGLE_CLIENT_ID: "g-id", GOOGLE_CLIENT_SECRET: "g-secret", APPLE_SERVICES_ID: "" } });
let log = ""; srv.stdout.on("data", (d) => log += d); srv.stderr.on("data", (d) => log += d);
for (let i = 0; i < 100 && !/listening/.test(log); i++) await wait(100);
const B = `http://127.0.0.1:${PORT}`;
const call = async (who, path, body, method) => { const r = await fetch(B + path, { method: method || (body ? "POST" : "GET"), redirect: "manual", headers: { "Content-Type": "application/json", ...(who ? { Authorization: "Bearer tok-" + who } : {}) }, body: body ? JSON.stringify(body) : undefined }); return { s: r.status, loc: r.headers.get("location") || "", j: await r.json().catch(() => ({})) }; };
const site = async () => (await call(null, "/api/levels")).j.site?.oauth || {};
try {
  let o = await site();
  t("out of the box: Google on, Facebook off (until the Meta app is published), Apple without a key hidden", o.google === true && o.facebook === false && o.apple === false);
  await call("boss", "/api/admin/settings", { signinFacebook: "1" }, "PATCH");
  t("admin turns Facebook on: it shows", (await site()).facebook === true);
  t("a member can't flip it", (await call("ana", "/api/admin/settings", { signinFacebook: "0" }, "PATCH")).s === 403 && (await site()).facebook === true);
  await call("boss", "/api/admin/settings", { signinFacebook: "0" }, "PATCH");
  o = await site();
  t("admin turns Facebook off: its button goes, Google stays", o.facebook === false && o.google === true);
  const st = await call(null, "/api/auth/oauth/facebook/start?mode=join&b=" + "a".repeat(32));
  t("…and Facebook's sign-in is refused, not just hidden", st.s === 303 && /oauth_error=off/.test(st.loc));
  await call("boss", "/api/admin/settings", { signinFacebook: "1" }, "PATCH");
  t("on again: back", (await site()).facebook === true);
  const ui = readFileSync(join(ROOT, "public/admin-app/6-settings.js"), "utf8");
  t("Settings shows a switch for each", /tog\("signinGoogle"/.test(ui) && /tog\("signinApple"/.test(ui) && /tog\("signinFacebook"/.test(ui));
} finally { srv.kill(); }
console.log(`\n  ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
