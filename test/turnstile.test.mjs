// Cloudflare Turnstile at Join (2026-10-30). "Let's optimize Cloudflare": an email
// join must carry a token Cloudflare accepts, when the keys are set. A stand-in for
// Cloudflare's check runs here: "good" passes, anything else fails, "down" drops the
// connection (Cloudflare unreachable → the join goes through, never a closed door).
import { spawn } from "node:child_process";
import { createServer } from "node:http";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { rmSync, mkdirSync } from "node:fs";
const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const DATA = join(ROOT, "test/.tmp/turnstile");
rmSync(DATA, { recursive: true, force: true }); mkdirSync(DATA, { recursive: true });
let pass = 0, fail = 0;
const t = (n, ok) => { ok ? pass++ : fail++; console.log("  " + (ok ? "✓" : "✗") + "  " + n); };

const asked = [];
const cf = createServer((req, res) => {
  let b = ""; req.on("data", (c) => b += c); req.on("end", () => {
    const f = new URLSearchParams(b); asked.push(Object.fromEntries(f));
    if (f.get("response") === "down") return req.socket.destroy();
    res.setHeader("content-type", "application/json");
    res.end(JSON.stringify(f.get("response") === "good" && f.get("secret") === "sekret" ? { success: true } : { success: false, "error-codes": ["invalid-input-response"] }));
  });
}).listen(0);
const CF = `http://127.0.0.1:${cf.address().port}/siteverify`;

const PORT = 19700 + (process.pid % 200);
const srv = spawn(process.execPath, ["--experimental-sqlite", "src/server.js"], { cwd: ROOT, env: { ...process.env, PORT: String(PORT), TNL_DATA: DATA, PUBLIC_URL: `http://127.0.0.1:${PORT}`,
  TURNSTILE_SITE_KEY: "0xSITE", TURNSTILE_SECRET: "sekret", TURNSTILE_VERIFY_URL: CF }, stdio: ["ignore", "pipe", "pipe"] });
let log = ""; srv.stdout.on("data", (d) => log += d); srv.stderr.on("data", (d) => log += d);
for (let i = 0; i < 100 && !/listening/.test(log); i++) await new Promise((r) => setTimeout(r, 100));
const B = `http://127.0.0.1:${PORT}`;
let n = 0;
const join_ = async (extra) => { n++; const r = await fetch(B + "/api/auth/register", { method: "POST", headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ username: "maker" + n, displayName: "Maker " + n, email: `maker${n}@labs-test.org`, password: "violet-orbit-lantern-77", roles: ["Painter"], ...extra }) });
  return { status: r.status, body: await r.json().catch(() => ({})) }; };

try {
  const lv = await (await fetch(B + "/api/levels")).json();
  t("the app is told the site key (never the secret)", lv.site?.turnstile === "0xSITE" && !JSON.stringify(lv).includes("sekret"));
  const none = await join_({});
  t("an email join with no token is turned away, asking to try again", none.status === 400 && none.body.human === true && asked.length === 0);
  const bad = await join_({ turnstile: "forged" });
  t("a token Cloudflare refuses is turned away", bad.status === 400 && bad.body.human === true);
  const good = await join_({ turnstile: "good" });
  t("a token Cloudflare accepts makes the account", good.status === 200 && !!good.body.token);
  t("…checked with the secret and the visitor's address", asked.some((a) => a.response === "good" && a.secret === "sekret" && "remoteip" in a));
  const down = await join_({ turnstile: "down" });
  t("Cloudflare unreachable: the join still goes through", down.status === 200 && !!down.body.token);
  const before = asked.length;
  const oa = await join_({ oauth: "not-a-real-ticket" });
  t("Google / Apple / Facebook joins skip the check (their own expiry answers, not ours)", oa.status === 410 && asked.length === before);
  /* the browser safety headers that ride with every answer (server/core/headers) */
  const h = await fetch(B + "/", { headers: { "X-Forwarded-Proto": "https" } });
  t("over https: HSTS for a year, this host only", h.headers.get("strict-transport-security") === "max-age=31536000");
  t("no type sniffing, and other sites only see our name", h.headers.get("x-content-type-options") === "nosniff" && h.headers.get("referrer-policy") === "strict-origin-when-cross-origin");
  t("plain http (a laptop, tests) gets no HSTS", !(await fetch(B + "/api/levels")).headers.get("strict-transport-security"));
} catch (e) { t("threw: " + e.message, false); }
srv.kill(); cf.close();
console.log(`\n${pass} passed, ${fail} failed`);
if (fail) { console.log(log.slice(-2000)); process.exit(1); }
