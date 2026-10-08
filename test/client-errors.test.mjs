// Member-phone errors reach Sentry (2026-10-08): the reporter used
// sendBeacon, which always sends credentials, and Sentry's ingest answers
// "Access-Control-Allow-Origin: *" — so the browser refused every report.
// And Chrome's harmless "ResizeObserver loop" warning is neither a crash
// screen nor a report.
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { readFileSync } from "node:fs";
const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const app = readFileSync(join(ROOT, "public/index.html"), "utf8");
let pass = 0, fail = 0;
const t = (n, ok) => { ok ? pass++ : fail++; console.log("  " + (ok ? "✓" : "✗") + "  " + n); };
const rep = app.slice(app.indexOf("function sentryClient"), app.indexOf('window.addEventListener("unhandledrejection",e=>{const r=e.reason'));
console.log("\nCLIENT ERRORS");
t("reports go by fetch without cookies, as plain text (no preflight)", /credentials:"omit"/.test(rep) && /text\/plain/.test(rep) && !/navigator\.sendBeacon\(/.test(rep));
t("the ResizeObserver warning isn't reported", /ResizeObserver loop[^\n]*return/.test(rep));
t("…nor does it bring up the crash screen", /if\(\/ResizeObserver loop\/i\.test\(String\(e\.message\|\|""\)\)\) return;/.test(app));
// 2026-10-08: only the real site reports to Sentry; test browsers and dev
// servers used to fill it with noise. The admin Health mirror still gets all.
const boot = readFileSync(join(ROOT, "src/server-01-boot.js"), "utf8");
const sent = [], mirrored = [];
const run = (host) => { sent.length = 0; mirrored.length = 0;
  const f = new Function("location", "fetch", "API", "navigator", "window",
    app.slice(app.indexOf("const SENTRY_DSN="), app.indexOf("function sentryClient")) + rep + "\nreturn sentryClient;")(
    { hostname: host, href: "https://" + host + "/", pathname: "/" }, (u) => { (String(u).includes("sentry.io") ? sent : mirrored).push(u); return Promise.resolve(); }, "", { userAgent: "t" }, { addEventListener() {} });
  f("boom " + host, "stack", "error"); };
run("labs.tnllabs.com");
t("the live site reports to Sentry and to the admin Health log", sent.length === 1 && mirrored.length === 1);
run("localhost"); const local = [sent.length, mirrored.length];
run("127.0.0.1");
t("a test browser on localhost doesn't reach Sentry, but Health still logs it", local[0] === 0 && local[1] === 1 && sent.length === 0 && mirrored.length === 1);
t("the server reports only on Railway (or with SENTRY_DSN set on purpose)", /const SENTRY_LIVE = !!\(process\.env\.SENTRY_DSN \|\| process\.env\.RAILWAY_ENVIRONMENT_NAME/.test(boot) && /const SENTRY_DSN = SENTRY_LIVE \?/.test(boot));
console.log(`\n  ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
