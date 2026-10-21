// VERIFY NUDGE v1.0 — 2026-10-19: "email everyone who hasn't confirmed their
// email to confirm it." Admin only; everyone unconfirmed (not suspended, with
// an address) gets a fresh link once; nobody twice in a day.
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { mkdirSync, rmSync, readFileSync } from "node:fs";
const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const TMP = join(ROOT, "test", ".tmp", "verify-nudge");
rmSync(TMP, { recursive: true, force: true }); mkdirSync(TMP, { recursive: true });
process.env.TNL_DATA = TMP;
const { db } = await import(join(ROOT, "src/db.js"));
let pass = 0, fail = 0;
const t = (n, ok) => { ok ? pass++ : fail++; console.log("  " + (ok ? "✓" : "✗") + "  " + n); };
const now = Date.now();
const U = (n, ver, susp = 0, email = n + "@x.test") => Number(db.prepare(`INSERT INTO users (username,display_name,email,role,password_hash,email_verified,suspended,created_at) VALUES (?,?,?,?,?,?,?,?)`).run(n, n, email, "Model", "h", ver, susp, now).lastInsertRowid);
U("done", 1); U("ana", 0); U("ben", 0); U("gone", 0, 1); U("noemail", 0, 0, "");
const src = readFileSync(join(ROOT, "src/server-05-admin-verify-nudge.js"), "utf8").replace("const NUDGE_GAP_MS = 600;", "const NUDGE_GAP_MS = 1;");
const routes = {}, sentTo = [];
let MAIL = true;
const make = () => new Function("app", "auth", "admin", "db", "issueVerification", "getMail", src.replace(/MAIL_ENABLED/g, "getMail()"))(
  { post: (p, ...h) => { routes[p] = h; } }, "AUTH", "ADMIN", db, async (u) => { sentTo.push(u.username); return { sent: true }; }, () => MAIL);
make();
const route = routes["/api/admin/members/remind-unverified"];
const call = async () => { let out, code = 200; await route.at(-1)({ user: { id: 1 } }, { json: (x) => { out = x; }, status: (c) => { code = c; return { json: (x) => { out = x; } }; } }); return { out, code }; };
const settle = () => new Promise((r) => setTimeout(r, 60));

console.log("\nADMIN ONLY");
t("behind a signed-in admin, on the server", route[0] === "AUTH" && route[1] === "ADMIN");

console.log("\nWHO GETS IT");
let r = await call(); await settle();
t("everyone unconfirmed with an address, and nobody else", r.out.sending === 2 && sentTo.sort().join() === "ana,ben");
t("not the suspended, not the confirmed, not an empty address", !sentTo.includes("gone") && !sentTo.includes("done") && !sentTo.includes("noemail"));
t("each is marked when they were sent it", db.prepare(`SELECT COUNT(*) n FROM users WHERE verify_nudged_at IS NOT NULL`).get().n === 2);
r = await call(); await settle();
t("pressing again the same day sends nobody anything", r.out.sending === 0 && sentTo.length === 2);
db.prepare(`UPDATE users SET verify_nudged_at = ? WHERE username = 'ana'`).run(now - 25 * 3600000);
r = await call(); await settle();
t("a day later, they can get one more", r.out.sending === 1 && sentTo.filter((x) => x === "ana").length === 2);
MAIL = false;
r = await call();
t("email not set up: says so, sends nothing", r.code === 400 && /Email isn't set up/.test(r.out.error));

console.log("\nIN THE ADMIN");
const adm = readFileSync(join(ROOT, "public/admin-app/6-settings.js"), "utf8");
t("System → Email has the button, with a confirm step", adm.includes('id="nudgeall"') && adm.includes("/api/admin/members/remind-unverified") && adm.includes('confirmIt("Email a new confirm link?"'));
t("the admin page loads the new script", readFileSync(join(ROOT, "public/admin.html"), "utf8").includes("6-settings.js?v=4.0"));
t("it's the sign-up email with a fresh link (issueVerification)", src.includes("await issueVerification(u, req)"));
console.log(`\n  ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
