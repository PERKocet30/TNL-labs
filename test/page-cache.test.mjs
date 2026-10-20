// PAGE CACHE v1.0 — 2026-10-20 (quality week). The app page is ~680KB
// (~200KB gzipped) and used to be downloaded again on every visit. Now it
// carries an ETag: a phone that already has it asks "changed?" and gets a
// 304 — nothing — unless there's a new build. Budget: the compressed page
// stays under the line below, so weight can't creep back in unnoticed.
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { rmSync, mkdirSync, statSync } from "node:fs";
const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const DATA = join(ROOT, "test/.tmp/page-cache");
rmSync(DATA, { recursive: true, force: true }); mkdirSync(DATA, { recursive: true });
let pass = 0, fail = 0;
const t = (n, ok) => { ok ? pass++ : fail++; console.log("  " + (ok ? "✓" : "✗") + "  " + n); };
const PORT = 8886, B = `http://localhost:${PORT}`;
const srv = spawn(process.execPath, ["--experimental-sqlite", "--no-warnings", "src/server.runtime.js"], {
  cwd: ROOT, env: { ...process.env, TNL_DATA: DATA, PORT: String(PORT), STRIPE_SECRET_KEY: "", TNL_NO_VIDEO_FIX: "1", TNL_NO_WATCH: "1" }, stdio: "ignore" });
try {
  for (let i = 0; i < 100; i++) { try { if ((await fetch(B + "/api/health")).ok) break; } catch {} await new Promise((r) => setTimeout(r, 100)); }
  const gz = { "Accept-Encoding": "gzip" };
  const r1 = await fetch(B + "/", { headers: gz });
  const tag = r1.headers.get("etag");
  t("the page comes gzipped with an ETag", r1.status === 200 && r1.headers.get("content-encoding") === "gzip" && /^"[0-9a-f]{16}"$/.test(tag || ""));
  t("…and must-revalidate, so the browser asks every time but keeps the copy", /must-revalidate/.test(r1.headers.get("cache-control") || ""));
  const r2 = await fetch(B + "/", { headers: { ...gz, "If-None-Match": tag } });
  t("a phone that has it gets 304 — nothing downloaded", r2.status === 304 && (await r2.text()).length === 0);
  const r3 = await fetch(B + "/", { headers: { ...gz, "If-None-Match": '"stale0000000000"' } });
  t("a new build is a new tag: the old one gets the page again", r3.status === 200);
  const r4 = await fetch(B + "/sw.js", { headers: gz });
  t("the service worker carries one too", /^"[0-9a-f]{16}"$/.test(r4.headers.get("etag") || ""));

  console.log("\nBUDGET");
  const gzBytes = statSync(join(ROOT, "public/index.html.gz")).size;
  const LIMIT = 250 * 1024;   // today: ~240KB. Lower it as the page is split (quality plan, Oct 27).
  t(`the compressed page is under ${Math.round(LIMIT / 1024)}KB (${Math.round(gzBytes / 1024)}KB)`, gzBytes < LIMIT);
} finally { srv.kill(); }
console.log(`\n  ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
