// MODS v1.0 (2026-10-28): the tier below the owner. Boots the real server on a
// throwaway database and checks what a Mod can see and do, what stays
// owner-only, that a Mod can never touch the owner or another Mod, and that
// only the owner can make a Mod.
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { mkdirSync, rmSync, readdirSync, readFileSync } from "node:fs";
import { spawn } from "node:child_process";
const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const DATA = join(ROOT, "test/.tmp/mods");
rmSync(DATA, { recursive: true, force: true }); mkdirSync(DATA, { recursive: true });
process.env.TNL_DATA = DATA;
let pass = 0, fail = 0;
const t = (n, ok) => { ok ? pass++ : fail++; console.log("  " + (ok ? "✓" : "✗") + "  " + n); };

console.log("\nEVERY MOD ROUTE IS A REAL ROUTE (no typos letting nothing through, or the wrong thing)");
const src = readdirSync(join(ROOT, "src")).filter((f) => /^server-.*\.js$/.test(f)).map((f) => readFileSync(join(ROOT, "src", f), "utf8")).join("\n");
const real = new Set([...src.matchAll(/app\.(get|post|patch|delete|put)\("(\/api\/admin[^"]*)"/g)].map((m) => m[1].toUpperCase() + " " + m[2]));
const modSrc = readFileSync(join(ROOT, "src/server-04-admin-0-mods.js"), "utf8");
const listed = [...modSrc.slice(modSrc.indexOf("MOD_MAY"), modSrc.indexOf("]);")).matchAll(/"((?:GET|POST|PATCH|DELETE) \/api\/admin[^"]*)"/g)].map((m) => m[1]);
const missing = listed.filter((r) => !real.has(r));
t(`all ${listed.length} listed routes exist${missing.length ? " — missing: " + missing.join(", ") : ""}`, listed.length > 30 && !missing.length);
for (const r of ["GET /api/admin/backups", "GET /api/admin/settings", "PATCH /api/admin/settings", "GET /api/admin/connectors", "GET /api/admin/instagram",
  "GET /api/admin/systems", "POST /api/admin/broadcast", "DELETE /api/admin/members/:username", "POST /api/admin/orders/:id/void",
  "POST /api/admin/people/:username/note", "POST /api/admin/members/:username/mod", "GET /api/admin/log", "GET /api/admin/members.csv"])
  t("owner-only: " + r, !listed.includes(r));

const { db } = await import("../src/db.js");
const now = Date.now(), D = 86400000;
const mk = (u, { admin = 0, mod = 0 } = {}) => {
  const id = Number(db.prepare(`INSERT INTO users (username, display_name, email, password_hash, created_at, email_verified) VALUES (?,?,?,?,?,1)`)
    .run(u, u.toUpperCase(), u + "@x.test", "x", now - 60 * D).lastInsertRowid);
  db.prepare(`UPDATE users SET is_admin = ?, is_mod = ? WHERE id = ?`).run(admin, mod, id);
  db.prepare(`INSERT INTO sessions (token, user_id, created_at) VALUES (?,?,?)`).run("tok-" + u, id, now);
  return id;
};
const U = { boss: mk("boss", { admin: 1 }), embers: mk("embers", { mod: 1 }), ace: mk("ace"), ana: mk("ana"), ben: mk("ben") };
const post = (who) => Number(db.prepare(`INSERT INTO posts (author_id, channel, body, is_work, created_at) VALUES (?,?,?,0,?)`).run(U[who], "general", "by " + who, now).lastInsertRowid);
const P = { ana: post("ana"), boss: post("boss"), embers: post("embers"), ben: post("ben") };
const L = { boss: Number(db.prepare(`INSERT INTO listings (seller_id, title, price_cents, status, created_at, updated_at) VALUES (?,?,?,?,?,?)`).run(U.boss, "tee", 4000, "active", now, now).lastInsertRowid) };
db.close();

const PORT = 18700 + (process.pid % 200);
const srv = spawn(process.execPath, ["--experimental-sqlite", "src/server.js"], { cwd: ROOT, env: { ...process.env, PORT: String(PORT), TNL_DATA: DATA }, stdio: ["ignore", "pipe", "pipe"] });
let log = ""; srv.stdout.on("data", (d) => log += d); srv.stderr.on("data", (d) => log += d);
for (let i = 0; i < 100 && !/listening/.test(log); i++) await new Promise((r) => setTimeout(r, 100));
const call = async (who, method, path, body) => {
  const r = await fetch(`http://127.0.0.1:${PORT}` + path, { method, headers: { "Content-Type": "application/json", ...(who ? { Authorization: "Bearer tok-" + who } : {}) }, body: body ? JSON.stringify(body) : undefined });
  let j = {}; try { j = await r.json(); } catch {}
  return { s: r.status, j };
};
try {
  await call("boss", "POST", "/api/admin/people/ana/note", { body: "owner's private note" });
  console.log("\nMAKING A MOD — the owner only");
  t("a member can't make themselves a Mod", (await call("ace", "POST", "/api/admin/members/ace/mod", { on: true })).s === 403);
  t("a Mod can't make another Mod", (await call("embers", "POST", "/api/admin/members/ace/mod", { on: true })).s === 403);
  t("a member sees no admin data", (await call("ace", "GET", "/api/admin/pulse?days=7")).s === 403);
  t("the owner makes ace a Mod", (await call("boss", "POST", "/api/admin/members/ace/mod", { on: true })).j.isMod === true);
  t("…and now ace can see the dashboard", (await call("ace", "GET", "/api/admin/pulse?days=7")).s === 200);
  t("the owner can't be made a Mod", (await call("boss", "POST", "/api/admin/members/boss/mod", { on: true })).s === 400);
  t("who's looking: owner / mod", (await call("boss", "GET", "/api/admin/me")).j.access === "owner" && (await call("ace", "GET", "/api/admin/me")).j.access === "mod");

  console.log("\nA MOD SEES THE DATA");
  for (const p of ["/api/admin/overview", "/api/admin/people", "/api/admin/orders", "/api/admin/reports", "/api/admin/events", "/api/admin/health", "/api/admin/sellers"])
    t("200 on " + p, (await call("embers", "GET", p)).s === 200);
  const rec = (await call("embers", "GET", "/api/admin/people/ana")).j;
  t("member record with email", rec.person && rec.person.email === "ana@x.test");
  t("…but not the owner's private note", rec.note === null);
  t("the owner still sees the note", (await call("boss", "GET", "/api/admin/people/ana")).j.note.body === "owner's private note");
  t("record says who's a Mod", (await call("boss", "GET", "/api/admin/people/embers")).j.person.isMod === true);

  console.log("\nOWNER-ONLY STAYS OWNER-ONLY");
  for (const [m, p, b] of [["GET", "/api/admin/backups"], ["GET", "/api/admin/settings"], ["PATCH", "/api/admin/settings", {}], ["GET", "/api/admin/connectors"],
    ["GET", "/api/admin/instagram"], ["GET", "/api/admin/systems"], ["GET", "/api/admin/log"], ["GET", "/api/admin/members.csv"],
    ["POST", "/api/admin/people/ana/note", { body: "x" }], ["POST", "/api/admin/people/ana/signout"], ["DELETE", "/api/admin/members/ana"], ["POST", "/api/admin/broadcast", { text: "x" }]]) {
    const r = await call("embers", m, p, b);
    t(`403 on ${m} ${p}`, r.s === 403 && /owner/i.test(r.j.error || ""));
  }

  console.log("\nA MOD MODERATES AND ADJUSTS MEMBERS");
  t("adjusts a member's rep", (await call("embers", "POST", "/api/admin/members/ana/rep", { delta: 5, reason: "workshop" })).s === 200);
  t("suspends and restores a member", (await call("embers", "POST", "/api/admin/members/ben/suspend", { suspended: true })).s === 200
    && (await call("embers", "POST", "/api/admin/members/ben/suspend", { suspended: false })).s === 200);
  t("takes down a member's post", (await call("embers", "DELETE", "/api/admin/posts/" + P.ana)).s === 200);

  console.log("\nA MOD CAN'T TOUCH THE OWNER OR ANOTHER MOD");
  t("can't change the owner's rep", (await call("embers", "POST", "/api/admin/members/boss/rep", { delta: -5, reason: "x" })).s === 403);
  t("can't suspend the owner", (await call("embers", "POST", "/api/admin/members/boss/suspend", { suspended: true })).s === 403);
  t("can't suspend another Mod", (await call("embers", "POST", "/api/admin/members/ace/suspend", { suspended: true })).s === 403);
  t("can't take down the owner's post", (await call("ace", "DELETE", "/api/admin/posts/" + P.boss)).s === 403);
  t("can't take down another Mod's post", (await call("ace", "DELETE", "/api/admin/posts/" + P.embers)).s === 403);
  t("can't take down the owner's listing", (await call("embers", "DELETE", "/api/admin/listings/" + L.boss)).s === 403);
  const sp = (await call("embers", "POST", "/api/admin/spam/remove", { usernames: ["ace"] })).j;
  t("spam removal skips other Mods", sp.accounts === 0 && sp.skipped.includes("ace"));
  t("the owner can still suspend a Mod", (await call("boss", "POST", "/api/admin/members/ace/suspend", { suspended: true })).s === 200);
  await call("boss", "POST", "/api/admin/members/ace/suspend", { suspended: false });

  console.log("\nEVENTS — a Mod can't publish (it emails every member)");
  const ev = await call("embers", "POST", "/api/admin/events", { title: "Cup", published: true });
  t("publishing on create is refused", ev.s === 403 && /publish/i.test(ev.j.error || ""));

  console.log("\nEVERY MOD CHANGE IS LOGGED WITH THEIR NAME");
  const lg = (await call("boss", "GET", "/api/admin/log")).j;
  const rows = JSON.stringify(lg);
  t("the rep change and the takedown are in the admin log", /members\/ana\/rep/.test(rows) && /posts\//.test(rows) && /embers/.test(rows));

  console.log("\nREMOVING A MOD");
  t("the owner removes ace's Mod", (await call("boss", "POST", "/api/admin/members/ace/mod", { on: false })).j.isMod === false);
  t("…and ace is back to no admin access", [401, 403].includes((await call("ace", "GET", "/api/admin/pulse?days=7")).s)   // 401: the suspension above signed ace out
    && (await call("boss", "GET", "/api/admin/people/ace")).j.person.isMod === false);
  t("embers (still a Mod) loses access once removed", (await call("boss", "POST", "/api/admin/members/embers/mod", { on: false })).j.isMod === false
    && (await call("embers", "GET", "/api/admin/pulse?days=7")).s === 403);
  t("Mods sell at the normal fee (only the owner sells at 0%)", (await call("boss", "GET", "/api/admin/people/embers")).j.person.fee > 0);
} catch (e) {
  fail++; console.log("  ✗  threw: " + e.message); console.log(log.slice(-1500));
} finally { srv.kill(); }
console.log(`\n  ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
