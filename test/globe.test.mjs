// THE GLOBE v1.0 — 2026-11-04: "A 3D graphic showing where everyone in the world is logging into LABS from."
// GET /api/admin/globe counts members by the country of their latest join, sign-in or vote — admins only,
// counts only (no names, no networks). And the map it's drawn on (public/admin-app/3-globe-data.js) is sane.
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { rmSync, mkdirSync, readFileSync } from "node:fs";
const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const DATA = join(ROOT, "test/.tmp/globe");
rmSync(DATA, { recursive: true, force: true }); mkdirSync(DATA, { recursive: true });
process.env.TNL_DATA = DATA;
const { db } = await import(join(ROOT, "src/db.js"));
let pass = 0, fail = 0;
const t = (n, ok) => { ok ? pass++ : fail++; console.log("  " + (ok ? "✓" : "✗") + "  " + n); };
const now = Date.now(), DAY = 86400000;
const mk = (u, admin = 0) => { const id = Number(db.prepare(`INSERT INTO users (username, display_name, email, password_hash, created_at, email_verified, is_admin) VALUES (?,?,?,?,?,1,?)`)
  .run(u, u, u + "@x.test", "x", now, admin).lastInsertRowid); db.prepare(`INSERT INTO sessions (token, user_id, created_at) VALUES (?,?,?)`).run("tok-" + u, id, now); return id; };
mk("boss", 1); const ana = mk("ana"), ben = mk("ben"), cy = mk("cy"), dee = mk("dee"); mk("eve");   // eve has no place
db.close();

const PORT = 8917, B = `http://localhost:${PORT}`;
const srv = spawn(process.execPath, ["--experimental-sqlite", "--no-warnings", "src/server.runtime.js"], {
  cwd: ROOT, stdio: "ignore", env: { ...process.env, TNL_DATA: DATA, PORT: String(PORT), STRIPE_SECRET_KEY: "", TNL_NO_VIDEO_FIX: "1", TNL_NO_WATCH: "1", PUBLIC_URL: B, RESEND_API_KEY: "" } });
const get = async (path, tok) => { const r = await fetch(B + path, { headers: tok ? { Authorization: "Bearer " + tok } : {} }); return { s: r.status, j: await r.json().catch(() => ({})) }; };
try {
  for (let i = 0; i < 100; i++) { try { if ((await fetch(B + "/api/health")).ok) break; } catch {} await new Promise((r) => setTimeout(r, 100)); }
  const { DatabaseSync } = await import("node:sqlite"); const w = new DatabaseSync(join(DATA, "tnl.db"));
  const sig = (u, kind, country, city, at) => w.prepare(`INSERT INTO member_signals (user_id, kind, net, country, city, at) VALUES (?,?,?,?,?,?)`).run(u, kind, "abcd1234", country, city, at);
  sig(ana, "join", "GB", "Leeds", now - 40 * DAY); sig(ana, "login", "US", "Atlanta", now - 2 * DAY);   // ana moved: counted in the US now
  sig(ben, "join", "US", "Atlanta", now - 3 * 3600000);                                                   // ben: the US, today
  sig(cy, "join", "NG", "Lagos", now - 10 * DAY); sig(cy, "vote", "", "", now - DAY / 2);                  // a vote with no country doesn't move cy
  sig(dee, "join", "GB", "", now - 50 * DAY);                                                              // dee: GB, not seen in 30 days
  w.close();

  console.log("\nWHO MAY SEE IT");
  t("signed out: 401", (await get("/api/admin/globe")).s === 401);
  t("a member: 403", (await get("/api/admin/globe", "tok-ana")).s === 403);
  const { s, j } = await get("/api/admin/globe?days=30", "tok-boss");
  t("an admin: 200", s === 200);

  console.log("\nTHE COUNTS");
  const by = Object.fromEntries((j.countries || []).map((g) => [g.c, g]));
  t("each member once, at their latest place: US 2, GB 1, NG 1", by.US?.members === 2 && by.GB?.members === 1 && by.NG?.members === 1);
  t("a signal with no country doesn't move anyone", by.NG?.members === 1 && !by[""]);
  t("seen in the window: US 2 (ana, ben), GB 0 (ana's GB join is 40 days old, dee's 50), NG 1", by.US?.active === 2 && by.GB?.active === 0 && by.NG?.active === 1);
  t("today: the US 1 (ben)", by.US?.today === 1 && by.NG?.today === 0);
  t("the biggest country comes first", j.countries[0]?.c === "US");
  t("placed 4 of 6 (eve and the admin have no place)", j.placed === 4 && j.total === 6);
  t("cities when Cloudflare sends them", JSON.stringify(by.US?.cities) === JSON.stringify([["Atlanta", 2]]));
  t("a wider window counts the older ones", (await get("/api/admin/globe?days=60", "tok-boss")).j.countries.find((g) => g.c === "GB")?.active === 2);
  t("counts only: no names, emails or networks in the answer", !/ana|ben|abcd1234|x\.test/.test(JSON.stringify(j)));
  t("days is kept between 1 and 365", (await get("/api/admin/globe?days=99999", "tok-boss")).j.days === 365 && (await get("/api/admin/globe?days=-4", "tok-boss")).j.days === 1);
} finally { srv.kill(); }

console.log("\nTHE MAP");
const src = readFileSync(join(ROOT, "public/admin-app/3-globe-data.js"), "utf8");
const bits = Buffer.from(src.match(/GLOBE_LAND = "([^"]+)"/)[1], "base64"), at = JSON.parse(src.match(/GLOBE_AT = (\{.*\});/)[1]);
const land = (lat, lon) => { const i = Math.floor(90 - lat) * 360 + Math.floor(lon + 180); return (bits[i >> 3] >> (7 - (i & 7))) & 1; };
t("a bit for every 1° cell", bits.length === 360 * 180 / 8);
t("land is land: Kansas, the Sahara, Siberia, Brazil", land(39, -98) && land(23, 10) && land(62, 100) && land(-10, -55));
t("sea is sea: mid-Pacific, mid-Atlantic, the Indian Ocean", !land(0, -150) && !land(30, -40) && !land(-20, 80));
t("every country centre is on the globe", Object.values(at).every(([la, lo]) => Math.abs(la) <= 90 && Math.abs(lo) <= 180));
const near = (c, la, lo) => at[c] && Math.abs(at[c][0] - la) < 6 && Math.abs(at[c][1] - lo) < 8;
t("centres sit where the countries are (US on the 48, France in Europe, Russia in Siberia, Fiji by the date line)",
  near("US", 39, -98) && near("FR", 46.5, 2.5) && near("RU", 61, 96) && near("FJ", -17.8, 178) && near("NG", 9.5, 8) && near("GB", 54, -2.5));
t("the countries members come from have a centre", ["US", "GB", "NG", "BR", "CA", "IN", "PH", "MX", "JP", "ZA", "KE", "SG", "XK"].every((c) => at[c]));
console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
