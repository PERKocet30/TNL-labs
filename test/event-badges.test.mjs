// Event badges v1.0 (2026-11-05): "Finals badge is a good idea." A member's
// profile carries Champion / Finalist / Entrant for each tournament whose
// results are locked — read from the event's own results, never stored.
// Runs the real server; boots once to build the tables, once to read.
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { mkdirSync, rmSync } from "node:fs";
import { spawn } from "node:child_process";
const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const DATA = join(ROOT, "test/.tmp/event-badges");
rmSync(DATA, { recursive: true, force: true }); mkdirSync(join(DATA, "uploads"), { recursive: true });
process.env.TNL_DATA = DATA;
let pass = 0, fail = 0;
const t = (n, ok) => { ok ? pass++ : fail++; console.log("  " + (ok ? "✓" : "✗") + "  " + n); };
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const PORT = 18960 + (process.pid % 30);

async function boot() {
  const srv = spawn(process.execPath, ["--experimental-sqlite", "src/server.js"], { cwd: ROOT, stdio: ["ignore", "pipe", "pipe"],
    env: { ...process.env, PORT: String(PORT), TNL_DATA: DATA } });
  let log = ""; srv.stdout.on("data", (d) => log += d); srv.stderr.on("data", (d) => log += d);
  for (let i = 0; i < 150 && !/listening/.test(log); i++) await wait(100);
  if (!/listening/.test(log)) { console.log(log); throw new Error("server did not start"); }
  return srv;
}
const stop = async (srv) => { srv.kill(); await new Promise((r) => srv.once("exit", r)); };

// 1. let the server build every table, then stop it
await stop(await boot());

// 2. the world: one finished tournament, one still running, one void, one unpublished
const { db } = await import("../src/db.js");
const now = Date.now(), D = 86400000;
const mk = (u) => Number(db.prepare(`INSERT INTO users (username, display_name, email, password_hash, created_at, email_verified) VALUES (?,?,?,?,?,1)`)
  .run(u, u.toUpperCase(), u + "@x.test", "x", now - 30 * D).lastInsertRowid);
const U = { champ: mk("champ"), fin: mk("fin"), ent: mk("ent"), dq: mk("dq"), none: mk("none") };
const post = (uid) => Number(db.prepare(`INSERT INTO posts (author_id, channel, image_url, is_work, created_at) VALUES (?,?,?,1,?)`)
  .run(uid, "graphic-design", "/uploads/x.jpg", now - 10 * D).lastInsertRowid);
const done = [{ phase: "submit", start: now - 9 * D, end: now - 8 * D }, { phase: "qualify", start: now - 8 * D, end: now - 3 * D },
  { phase: "final", start: now - 3 * D, end: now - D }, { phase: "results", start: now - D, end: null }];
const ev = (slug, title, published, state, sched = done) => Number(db.prepare(`INSERT INTO events (slug, title, format, published, schedule, state, created_at, updated_at) VALUES (?,?,?,?,?,?,?,?)`)
  .run(slug, title, "poll", published, JSON.stringify(sched), JSON.stringify(state), now - 9 * D, now).lastInsertRowid);
const entry = (evId, uid, dq = null) => Number(db.prepare(`INSERT INTO event_entries (event_id, user_id, post_id, dq_reason, created_at) VALUES (?,?,?,?,?)`)
  .run(evId, uid, post(uid), dq, now - 9 * D).lastInsertRowid);

// the finished one: entries first, then its locked results
const E1 = ev("art-one", "LABS ART TOURNAMENT", 1, {});
const e1 = { champ: entry(E1, U.champ), fin: entry(E1, U.fin), ent: entry(E1, U.ent), dq: entry(E1, U.dq, "rules") };
db.prepare(`UPDATE events SET state = ? WHERE id = ?`).run(JSON.stringify({
  finalists: [e1.champ, e1.fin], results: { winner: e1.champ, ranking: [{ entryId: e1.champ }, { entryId: e1.fin }], at: now - D } }), E1);
// still voting: the final runs into tomorrow, no results yet → no badge
const E2 = ev("music-one", "MUSIC TOURNAMENT", 1, { finalists: [] }, [{ phase: "submit", start: now - 2 * D, end: now + 5 * D },
  { phase: "qualify", start: now + 5 * D, end: now + 7 * D }, { phase: "final", start: now + 7 * D, end: now + 9 * D }, { phase: "results", start: now + 9 * D, end: null }]);
entry(E2, U.champ);
// void → nothing; unpublished → nothing
const E3 = ev("void-one", "VOID", 1, { void: true, results: { winner: null, ranking: [] } }); entry(E3, U.ent);
const E4 = ev("hidden-one", "HIDDEN", 0, {}); const h = entry(E4, U.none);
db.prepare(`UPDATE events SET state = ? WHERE id = ?`).run(JSON.stringify({ finalists: [h], results: { winner: h, ranking: [{ entryId: h }] } }), E4);
db.close();

// 3. read the profiles
const srv = await boot();
const badges = async (u) => (await (await fetch(`http://127.0.0.1:${PORT}/api/users/${u}`)).json()).badges;
try {
  const c = await badges("champ");
  t("the winner is Champion", c.length === 1 && c[0].tier === "champion" && c[0].slug === "art-one" && c[0].title === "LABS ART TOURNAMENT");
  t("a running tournament gives no badge yet", !c.some((b) => b.slug === "music-one"));
  const f = await badges("fin");
  t("a finalist is Finalist", f.length === 1 && f[0].tier === "finalist");
  const e = await badges("ent");
  t("an entrant is Entrant", e.length === 1 && e[0].tier === "entrant");
  t("a void tournament gives no badge", !e.some((b) => b.slug === "void-one"));
  t("a disqualified entry gives no badge", (await badges("dq")).length === 0);
  t("an unpublished tournament gives no badge", (await badges("none")).length === 0);
  t("only slug, title, tier and og leave the server", Object.keys(c[0]).sort().join() === "og,slug,tier,title");
  t("every badge from the first tournament is OG — entrants too", c[0].og === true && f[0].og === true && e[0].og === true);
} finally { await stop(srv); }

// 4. the app draws them under the name and taps open the event
const { readFileSync } = await import("node:fs");
const prof = readFileSync(join(ROOT, "src/app/profile/profile.js"), "utf8");
t("the profile draws the badge row", /\$\{pfBadgesHTML\(PROFILE\.badges\)\}/.test(prof));
t("a badge opens its event", /data-evopen="\$\{esc\(b\.slug\)\}"/.test(prof));
t("badge colours come from theme tokens only", !/#[0-9a-f]{3,6}\b/i.test(readFileSync(join(ROOT, "src/app/styles/profile2.css"), "utf8").split("Tournament badges")[1]));

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
