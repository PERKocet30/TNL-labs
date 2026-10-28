// The watch, minus the noise (2026-10-19). The 19 Oct digest counted 6
// errors that were all "Script error." (a browser hiding someone else's
// crash — Instagram's in-app browser, an extension) and 23 "slow screens"
// that were background checks on a locked or pocketed phone: the server had
// answered them in milliseconds. Neither should reach the count.
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { rmSync, mkdirSync, readFileSync } from "node:fs";
const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const DATA = join(ROOT, "test/.tmp/watch-signal");
rmSync(DATA, { recursive: true, force: true }); mkdirSync(DATA, { recursive: true });
let pass = 0, fail = 0;
const t = (n, ok) => { ok ? pass++ : fail++; console.log("  " + (ok ? "✓" : "✗") + "  " + n); };

console.log("\nSLOW SCREENS ONLY COUNT WHILE SOMEONE IS LOOKING");
const src = readFileSync(join(ROOT, "src/app-19-glitch.js"), "utf8");
let clock = 1_000_000, reports = [];
const listeners = {};
const doc = { hidden: false, addEventListener: (k, f) => { (listeners[k] = listeners[k] || []).push(f); } };
const flip = (hidden) => { doc.hidden = hidden; for (const f of listeners.visibilitychange || []) f(); };
let answer = null;   // the "network": resolves when the test says so
let FAIL_NEXT = false;
const win = { fetch: (u) => FAIL_NEXT ? (FAIL_NEXT = false, Promise.reject(new TypeError("Load failed"))) : u.includes("/api/glitch") ? Promise.resolve({ status: 200 }) : new Promise((r) => { answer = () => r({ status: 200 }); }) };
const run = new Function("window", "document", "Date", "setTimeout", "clearTimeout", "PerformanceObserver",
  "GATE", "PCOMPOSE", "TRKEDIT", "CHAT", "DMOPENPANEL", "POSTOPEN", "PROFILE", "TAB", "API", "TOKEN", "isWide", "MV_MEDIA", "navigator",
  src.replace(/^function glitch\(kind,detail\)\{/m, "function glitch(kind,detail){__seen(kind,detail);") + "\nreturn null;");
globalThis.__seen = (k, d) => reports.push(k + " " + d);
run(win, doc, { now: () => clock }, () => 0, () => {}, undefined,
  null, null, null, null, null, null, null, "showroom", "", "", () => false, "x", { onLine: true });
const call = async (path, during) => { const p = win.fetch(path); const begun = clock; await during?.(); clock = begun + 9000; answer(); await p; };
reports = [];
await call("/api/feed/showroom");
t("a call that took 9s with the screen on is a slow screen", reports.length === 1 && /slow_screen \/api\/feed\/showroom 9\.0s/.test(reports[0]));
reports = [];
await call("/api/auth/status"); await call("/api/notifications"); await call("/api/unreads");
t("…but not the app's own background checks (nobody is waiting on them)", reports.length === 0);
reports = [];
globalThis.location = { origin: "https://tnllabs.com" };
{ const p = win.fetch("https://o123.ingest.sentry.io/api/456/envelope/", { method: "GET" }); const begun = clock; clock = begun + 9000; answer(); await p; }
FAIL_NEXT = true; await win.fetch("https://o123.ingest.sentry.io/api/456/envelope/", { method: "POST" }).catch(() => {});
FAIL_NEXT = true; await win.fetch("https://tnllabs.com/api/posts/1/like", { method: "POST" }).catch(() => {});
t("another site's /api/ (Sentry's error reports) is never a slow screen or a failed save", reports.length === 1 && /action_failed POST \/api\/posts/.test(reports[0]));
reports = [];
await call("/api/dm", async () => { flip(true); clock += 4000; flip(false); });
t("…but not if the phone locked or switched apps while it waited", reports.length === 0);
reports = [];
flip(true); clock += 60000; flip(false); clock += 500;   // the phone wakes, and half a second later…
await call("/api/dm/:name");
t("…nor right as the screen wakes (the network is coming back)", reports.length === 0);
clock += 5000; reports = [];
await call("/api/feed");
t("once awake, slow is slow again", reports.length === 1);

console.log("\n\"SCRIPT ERROR.\" ISN'T OURS");
const ui = readFileSync(join(ROOT, "src/app-08-state-ui.js"), "utf8");
t("the app doesn't report it (to Sentry or to us)", /Script error\\\.\?\$\/i\.test\(String\(e\.message\|\|""\)\)&&!e\.error\)return/.test(ui));

const PORT = 8883, B = `http://localhost:${PORT}`;
process.env.TNL_DATA = DATA;
const srv = spawn(process.execPath, ["--experimental-sqlite", "--no-warnings", "src/server.runtime.js"], {
  cwd: ROOT, env: { ...process.env, TNL_DATA: DATA, PORT: String(PORT), STRIPE_SECRET_KEY: "", TNL_NO_VIDEO_FIX: "1", TNL_NO_WATCH: "1" }, stdio: "ignore" });
try {
  for (let i = 0; i < 100; i++) { try { if ((await fetch(B + "/api/health")).ok) break; } catch {} await new Promise((r) => setTimeout(r, 100)); }
  const post = (message) => fetch(B + "/api/client-error", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ message, path: "/" }) });
  await post("Script error."); await post("Script error"); await post("TypeError: real problem");
  const { db } = await import(join(ROOT, "src/db.js"));
  const rows = db.prepare(`SELECT message FROM error_log WHERE kind = 'client'`).all().map((r) => r.message);
  t("phones still on the old app: the server drops it too", !rows.some((m) => /^Script error/i.test(m)));
  t("a real crash is still logged", rows.includes("TypeError: real problem"));
} finally { srv.kill(); }
console.log(`\n  ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
