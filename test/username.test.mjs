// GET /api/auth/username — the live check in the sign-up flow (2026-09-28).
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { readFileSync } from "node:fs";
import { DatabaseSync } from "node:sqlite";
const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
let pass = 0, fail = 0;
const t = (n, ok) => { ok ? pass++ : fail++; console.log("  " + (ok ? "✓" : "✗") + "  " + n); };
const src = readFileSync(join(ROOT, "src/server.runtime.js"), "utf8");
const a = src.indexOf('app.get("/api/auth/username"'), b = src.indexOf('app.post("/api/auth/register"');
const db = new DatabaseSync(":memory:");
db.exec("CREATE TABLE users(id INTEGER PRIMARY KEY, username TEXT UNIQUE)");
for (const u of ["noor", "noor_", "kai"]) db.prepare("INSERT INTO users(username) VALUES (?)").run(u);
const q = { userByName: db.prepare("SELECT * FROM users WHERE username = ?") };
let h; new Function("app", "q", "rateLimit", src.slice(a, b))({ get: (p, rl, fn) => { h = fn; } }, q, () => null);
const call = (u) => { let out; h({ query: { u } }, { json: (o) => (out = o) }); return out; };

console.log("\nUSERNAME CHECK");
t("route exists and is rate-limited", a > 0 && /app\.get\("\/api\/auth\/username", rateLimit\(/.test(src));
let r = call("newname"); t("free name → available", r.available && r.valid);
r = call("NOOR"); t("taken name (any case) → not available", !r.available && r.valid);
t("suggestions are free, valid, at most 3", r.suggestions.length >= 1 && r.suggestions.length <= 3
  && r.suggestions.every((s) => /^[a-z0-9._]{2,20}$/.test(s) && !q.userByName.get(s)));
t("skips a suggestion that is taken (noor_)", !r.suggestions.includes("noor_"));
t("too short → invalid", !call("a").valid);
t("bad characters → invalid", !call("bad name!").valid);
t("same rule as register", src.includes('/^[a-z0-9._]{2,20}$/.test(username || "")'));
console.log(`\n  ${pass} passed, ${fail} failed`);
