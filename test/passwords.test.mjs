// Passwords (2026-10-19): "passwords should be more complicated". A new
// password — joining or a reset — needs 8+ characters, a letter and a number,
// and can't be a well-known one or the member's own name. The server decides,
// whatever the screen let through.
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { rmSync, mkdirSync } from "node:fs";
const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const DATA = join(ROOT, "test/.tmp/passwords");
rmSync(DATA, { recursive: true, force: true }); mkdirSync(DATA, { recursive: true });
process.env.TNL_DATA = DATA;
const { db } = await import(join(ROOT, "src/db.js"));
let pass = 0, fail = 0;
const t = (n, ok) => { ok ? pass++ : fail++; console.log("  " + (ok ? "✓" : "✗") + "  " + n); };
const now = Date.now();
const uid = Number(db.prepare(`INSERT INTO users (username, display_name, email, password_hash, created_at, email_verified) VALUES ('ana','Ana','ana.reyes@x.test','x',?,1)`).run(now).lastInsertRowid);
for (const k of ["r1", "r2", "r3"]) db.prepare(`INSERT INTO reset_tokens (token, user_id, expires_at, created_at) VALUES (?,?,?,?)`).run(k, uid, now + 3600000, now);
const PORT = 8898, B = `http://localhost:${PORT}`;
const srv = spawn(process.execPath, ["--experimental-sqlite", "--no-warnings", "src/server.runtime.js"], {
  cwd: ROOT, env: { ...process.env, TNL_DATA: DATA, PORT: String(PORT), STRIPE_SECRET_KEY: "", TNL_NO_VIDEO_FIX: "1", TNL_NO_WATCH: "1" }, stdio: "ignore" });
const post = async (path, body) => { const r = await fetch(B + path, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }); return { s: r.status, j: await r.json().catch(() => ({})) }; };
const join_ = (password) => post("/api/auth/register", { username: "newbie", displayName: "New", email: "newbie@x.test", roles: ["Painter"], password });
try {
  for (let i = 0; i < 100; i++) { try { if ((await fetch(B + "/api/health")).ok) break; } catch {} await new Promise((r) => setTimeout(r, 100)); }
  console.log("\nJOINING");
  const a = await join_("abc123");
  t("too short is refused, saying why", a.s === 400 && /8 characters/.test(a.j.error));
  const b = await join_("password1");
  t("a well-known password is refused", b.s === 400 && /too common/.test(b.j.error));
  const c = await join_("newbie2024");
  t("their own username in it is refused", c.s === 400 && /username or email/.test(c.j.error));
  const d = await join_("violet-kiln-27");
  t("a good one joins", d.s === 200 && !!d.j.token);
  console.log("\nA RESET");
  t("letters only is refused", (await post("/api/auth/reset", { token: "r1", password: "onlyletters" })).s === 400);
  t("their email name in it is refused", /username or email/.test((await post("/api/auth/reset", { token: "r2", password: "anareyes99" })).j.error || ""));
  t("a good one is set", (await post("/api/auth/reset", { token: "r3", password: "quiet-harbor-41" })).s === 200);
} finally { srv.kill(); }
console.log(`\n  ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
