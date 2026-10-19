// The tournament's link preview (2026-10-15): a shared tournament link
// showed only the TNL logo. Now it shows the cover an admin picked, or a
// card TNL draws — the name, the prize and where it stands — that changes
// picture as the tournament moves on.
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { rmSync, mkdirSync, readFileSync } from "node:fs";
const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const DATA = join(ROOT, "test/.tmp/event-card");
rmSync(DATA, { recursive: true, force: true }); mkdirSync(DATA, { recursive: true });
process.env.TNL_DATA = DATA;
const { db } = await import(join(ROOT, "src/db.js"));
const now = Date.now(), DAY = 86400000;
let pass = 0, fail = 0;
const t = (n, ok) => { ok ? pass++ : fail++; console.log("  " + (ok ? "✓" : "✗") + "  " + n); };
const PORT = 8879, B = `http://localhost:${PORT}`;
const srv = spawn(process.execPath, ["--experimental-sqlite", "--no-warnings", "src/server.runtime.js"], {
  cwd: ROOT, env: { ...process.env, TNL_DATA: DATA, PORT: String(PORT), STRIPE_SECRET_KEY: "", TNL_NO_VIDEO_FIX: "1", TNL_NO_WATCH: "1" }, stdio: "ignore" });
const og = async (path) => { const h = await (await fetch(B + path)).text(); return { img: (/property="og:image" content="([^"]+)"/.exec(h) || [])[1] || "", w: (/og:image:width" content="(\d+)"/.exec(h) || [])[1] }; };
try {
  for (let i = 0; i < 100; i++) { try { if ((await fetch(B + "/api/health")).ok) break; } catch {} await new Promise((r) => setTimeout(r, 100)); }
  const sched = (s) => JSON.stringify(s);
  db.prepare(`INSERT INTO events (slug, title, brief, prize, published, format, schedule, created_at, updated_at) VALUES ('cup','LABS ART TOURNAMENT 🧪','Make a poster','$100',1,'poll',?,?,?)`)
    .run(sched([{ phase: "submit", start: now - 1000, end: now + 5 * DAY }, { phase: "qualify", start: now + 5 * DAY, end: now + 8 * DAY }, { phase: "results", start: now + 8 * DAY, end: null }]), now, now);
  db.prepare(`INSERT INTO events (slug, title, published, created_at, updated_at) VALUES ('draft',?,0,?,?)`).run("Draft", now, now);

  console.log("\nTHE PREVIEW PICTURE");
  const a = await og("/e/cup");
  t("no cover: the preview is the LABS card for this tournament, not the logo", /\/e\/cup\/card\.jpg\?v=[0-9a-f]{8}$/.test(a.img) && !a.img.includes("icon-512"));
  t("…square, because Instagram's previews are", a.w === "1080");
  const r = await fetch(B + "/e/cup/card.jpg");
  const buf = Buffer.from(await r.arrayBuffer());
  t("the card is a picture", r.status === 200 && /jpeg/.test(r.headers.get("content-type")) && buf[0] === 0xff && buf[1] === 0xd8);
  t("a draft has no card", (await fetch(B + "/e/draft/card.jpg")).status === 404);

  console.log("\nIT FOLLOWS THE TOURNAMENT");
  db.prepare(`UPDATE events SET schedule = ? WHERE slug = 'cup'`).run(sched([{ phase: "submit", start: now - 6 * DAY, end: now - DAY }, { phase: "qualify", start: now - DAY, end: now + 2 * DAY }, { phase: "results", start: now + 2 * DAY, end: null }]));
  const b = await og("/e/cup");
  t("voting opens: a new card (a new link, so previews refresh)", /card\.jpg\?v=/.test(b.img) && b.img !== a.img);
  t("the scoreboard page uses it too", /\/e\/cup\/card\.jpg\?v=/.test((await og("/e/cup/board")).img));

  console.log("\nA COVER YOU CHOSE");
  db.prepare(`UPDATE events SET cover_url = '/uploads/cover.jpg' WHERE slug = 'cup'`).run();
  const c = await og("/e/cup");
  t("wins over the card", /\/uploads\/cover\.jpg$/.test(c.img) && !c.w);
  const adm = readFileSync(join(ROOT, "public/admin-app/8-events.js"), "utf8");
  t("Admin → Tournament has a cover picture, and a way back to the LABS card", adm.includes('data-f="coverUrl"') && adm.includes('id="evcov"') && adm.includes("Use the LABS card") && /\/api\/upload/.test(adm));
} finally { srv.kill(); }
console.log(`\n  ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
