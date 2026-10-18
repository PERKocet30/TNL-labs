// The address (2026-10-18): "switch everything to tnllabs.com". The app moves
// from labs.tnllabs.com to tnllabs.com once Railway has CANONICAL_HOST.
// Old links forward, open apps keep working, and members stay signed in
// (a one-use code carries the sign-in across). Nothing moves without the variable.
import { spawn } from "node:child_process";
import { request } from "node:http";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { rmSync, mkdirSync } from "node:fs";
const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const DATA = join(ROOT, "test/.tmp/address");
rmSync(DATA, { recursive: true, force: true }); mkdirSync(DATA, { recursive: true });
process.env.TNL_DATA = DATA;
const { db } = await import(join(ROOT, "src/db.js"));
let pass = 0, fail = 0;
const t = (n, ok) => { ok ? pass++ : fail++; console.log("  " + (ok ? "✓" : "✗") + "  " + n); };
const now = Date.now();
const uid = Number(db.prepare(`INSERT INTO users (username, display_name, email, password_hash, created_at, email_verified) VALUES ('ana','Ana','ana@x.test','x',?,1)`).run(now).lastInsertRowid);
db.prepare(`INSERT INTO sessions (token, user_id, created_at) VALUES ('tok-ana', ?, ?)`).run(uid, now);
const boot = (port, canon) => spawn(process.execPath, ["--experimental-sqlite", "--no-warnings", "src/server.runtime.js"], {
  cwd: ROOT, env: { ...process.env, TNL_DATA: DATA, PORT: String(port), STRIPE_SECRET_KEY: "", TNL_NO_VIDEO_FIX: "1", TNL_NO_WATCH: "1", CANONICAL_HOST: canon }, stdio: "ignore" });
/* node's http lets a test say which address it asked for (fetch won't set Host) */
const ask = (port, path, { host = "labs.tnllabs.com", method = "GET", body, token } = {}) => new Promise((ok, no) => {
  const data = body ? JSON.stringify(body) : null;
  const r = request({ host: "127.0.0.1", port, path, method, headers: { Host: host, ...(data ? { "Content-Type": "application/json", "Content-Length": Buffer.byteLength(data) } : {}), ...(token ? { Authorization: "Bearer " + token } : {}) } }, (res) => {
    let s = ""; res.on("data", (d) => (s += d)); res.on("end", () => { let j = null; try { j = JSON.parse(s); } catch {} ok({ s: res.statusCode, to: res.headers.location, j }); });
  });
  r.on("error", no); if (data) r.write(data); r.end();
});
const up = async (port) => { for (let i = 0; i < 100; i++) { try { if ((await ask(port, "/api/health", { host: "127.0.0.1" })).s === 200) return; } catch {} await new Promise((r) => setTimeout(r, 100)); } };

/* one at a time: two servers migrating the same database at once can trip each other */
const off = boot(8895, "");
await up(8895);
console.log("\nBEFORE THE SWITCH (no CANONICAL_HOST)");
t("an old link stays where it is", (await ask(8895, "/u/ana")).s === 200);
t("the app doesn't try to move", (await ask(8895, "/api/auth/handoff", { method: "POST", body: { next: "/" }, token: "tok-ana" })).j?.url === null);
off.kill(); await new Promise((r) => off.once("exit", r));

const on = boot(8896, "https://tnllabs.com/");
try {
  await up(8896);
  console.log("\nOLD LINKS FORWARD");
  const r = await ask(8896, "/u/ana?x=1");
  t("a profile link on the old address forwards to the same page on the new one", r.s === 301 && r.to === "https://tnllabs.com/u/ana?x=1");
  t("…and so does the tournament", (await ask(8896, "/tournament")).to === "https://tnllabs.com/tournament");
  t("www forwards too", (await ask(8896, "/p/1", { host: "www.tnllabs.com" })).to === "https://tnllabs.com/p/1");
  t("the new address itself doesn't forward", (await ask(8896, "/u/ana", { host: "tnllabs.com" })).s === 200);

  console.log("\nOPEN APPS KEEP WORKING");
  t("the app shell still loads on the old address (it moves itself, carrying the sign-in)", (await ask(8896, "/")).s === 200);
  t("the API still answers there", (await ask(8896, "/api/me", { token: "tok-ana" })).s === 200);
  t("it says where home is", (await ask(8896, "/api/address")).j?.canonical === "tnllabs.com");

  console.log("\nSTILL SIGNED IN");
  const g = await ask(8896, "/api/auth/handoff", { method: "POST", body: { next: "/?u=ana" } });
  t("a guest just goes to the new address", g.j?.url === "https://tnllabs.com/?u=ana");
  const h = await ask(8896, "/api/auth/handoff", { method: "POST", body: { next: "/?u=ana" }, token: "tok-ana" });
  const m = /^https:\/\/tnllabs\.com\/\?u=ana&handoff=([0-9a-f]{48})$/.exec(h.j?.url || "");
  t("a member gets the new address with a one-use code", !!m);
  const c = await ask(8896, "/api/auth/handoff/claim", { host: "tnllabs.com", method: "POST", body: { code: m && m[1] } });
  t("the new address trades it for a sign-in", c.s === 200 && !!c.j?.token);
  const me = await ask(8896, "/api/me", { host: "tnllabs.com", token: c.j?.token });
  t("…as the same member", me.s === 200 && me.j?.user?.username === "ana");
  t("the code works once", (await ask(8896, "/api/auth/handoff/claim", { method: "POST", body: { code: m && m[1] } })).s === 400);
  t("a made-up code gets nothing", (await ask(8896, "/api/auth/handoff/claim", { method: "POST", body: { code: "f".repeat(48) } })).s === 400);

  console.log("\nONLY EVER HOME");
  for (const next of ["//evil.example/x", "https://evil.example/", "/\\evil.example", "javascript:alert(1)"]) {
    const x = await ask(8896, "/api/auth/handoff", { method: "POST", body: { next }, token: "tok-ana" });
    t(`"${next}" can't send anyone off-site`, /^https:\/\/tnllabs\.com\/\?handoff=/.test(x.j?.url || ""));
  }
} finally { on.kill(); }
console.log(`\n  ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
