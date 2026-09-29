// Glitch signals (2026-09-29): POST /api/glitch keeps only known kinds, small,
// at most 10 a call; GET /api/admin/glitches sums them for the admin page.
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { readFileSync } from "node:fs";
import { DatabaseSync } from "node:sqlite";
const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
let pass = 0, fail = 0;
const t = (n, ok) => { ok ? pass++ : fail++; console.log("  " + (ok ? "✓" : "✗") + "  " + n); };
const src = readFileSync(join(ROOT, "src/server-10-glitch.js"), "utf8");
const db = new DatabaseSync(":memory:");
const routes = {};
const reg = (m) => (path, ...fns) => { routes[m + " " + path] = fns.at(-1); };
new Function("app", "db", "maybeAuth", "auth", "admin", "rateLimit", src)(
  { post: reg("POST"), get: reg("GET") }, db, null, null, null, () => null);
const call = (key, req) => { let out; routes[key](req, { json: (o) => (out = o) }); return out; };

console.log("\nGLITCH SIGNALS");
t("both routes exist, admin read is behind auth + admin", !!routes["POST /api/glitch"] && !!routes["GET /api/admin/glitches"]
  && /app\.get\("\/api\/admin\/glitches", auth, admin,/.test(src) && /app\.post\("\/api\/glitch", maybeAuth, rateLimit\(/.test(src));
let r = call("POST /api/glitch", { user: { username: "noor" }, body: { device: "phone", events: [
  { kind: "rage_tap", place: "showroom", detail: "[like]" },
  { kind: "made_up", place: "x", detail: "y" },
  { kind: "layout_jump", place: "labs", detail: "x".repeat(1000) },
  null] } });
t("keeps known kinds only", r.saved === 2);
const rows = db.prepare("SELECT * FROM glitch_events ORDER BY id").all();
t("stores who, where and which device", rows[0].username === "noor" && rows[0].place === "showroom" && rows[0].device === "phone");
t("detail is clipped", rows[1].detail.length === 240);
r = call("POST /api/glitch", { body: { device: "tablet?", events: Array.from({ length: 25 }, () => ({ kind: "slow_screen", place: "a", detail: "b" })) } });
t("at most 10 a call; unknown device reads as phone; guests allowed", r.saved === 10 && db.prepare("SELECT device, username FROM glitch_events ORDER BY id DESC").get().device === "phone");
const g = call("GET /api/admin/glitches", {});
t("summary counts the last 24h", g.last24h === 12);
t("hotspots group by kind, place and detail", g.hotspots[0].kind === "slow_screen" && g.hotspots[0].n === 10);
t("people counts distinct signed-in members", g.hotspots.find((h) => h.kind === "rage_tap").people === 1);
t("recent is newest first", g.recent[0].kind === "slow_screen" && g.recent.length <= 25);
console.log(`\n  ${pass} passed, ${fail} failed`);
