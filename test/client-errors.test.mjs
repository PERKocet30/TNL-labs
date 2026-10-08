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
console.log(`\n  ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
