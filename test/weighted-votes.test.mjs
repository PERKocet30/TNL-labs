// Weighted votes v1.0 (2026-11-14): with `weighted` on, a tournament vote
// counts by the voter's level when they cast it (VOTE_WEIGHT in db.js).
// Checks: the tallies and the poll scoreboard add the weights, the weight is
// fixed when the vote is cast, events with it off still count 1 each, a vote
// taken off as spam and put back keeps its weight, and the rules say so.
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { spawn } from "node:child_process";
const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const DATA = join(ROOT, "test/.tmp/weighted-votes");
rmSync(DATA, { recursive: true, force: true }); mkdirSync(join(DATA, "uploads"), { recursive: true });
process.env.TNL_DATA = DATA;
let pass = 0, fail = 0;
const t = (n, ok) => { ok ? pass++ : fail++; console.log("  " + (ok ? "✓" : "✗") + "  " + n); };

const { db, VOTE_WEIGHT, LEVELS, voteWeightFor } = await import("../src/db.js");
const now = Date.now(), D = 86400000;
const mk = (u, rep = 0, admin = 0) => {
  const id = Number(db.prepare(`INSERT INTO users (username, display_name, email, password_hash, created_at, email_verified, avatar_url, rep) VALUES (?,?,?,?,?,?,?,?)`)
    .run(u, u.toUpperCase(), u + "@x.test", "x", now - 60 * D, 1, "/uploads/av-" + u + ".jpg", rep).lastInsertRowid);
  if (admin) db.prepare(`UPDATE users SET is_admin = 1 WHERE id = ?`).run(id);
  db.prepare(`INSERT INTO sessions (token, user_id, created_at) VALUES (?,?,?)`).run("tok-" + u, id, now);
  return id;
};
console.log("\nTHE WEIGHTS");
t("one weight for every level, rising, Entry counts 1", LEVELS.every((l) => VOTE_WEIGHT[l.id] > 0) && VOTE_WEIGHT[1] === 1
  && LEVELS.every((l, i) => !i || VOTE_WEIGHT[l.id] > VOTE_WEIGHT[LEVELS[i - 1].id]));
t("the top level counts 100, not 5", VOTE_WEIGHT[LEVELS[LEVELS.length - 1].id] === 100);
t("weight follows rep", voteWeightFor(0) === 1 && voteWeightFor(LEVELS[2].at) === VOTE_WEIGHT[3] && voteWeightFor(99999) === 100);

mk("boss", 0, 1);
const LV = Object.fromEntries(LEVELS.map((l) => [l.id, l.at]));
mk("ent1", 0); mk("ent2", 0); mk("ent3", 0);              // entrants
mk("newm", 0); mk("ver", LV[2]); mk("lead", LV[5]);       // voters: 1, 5, 100
for (let i = 0; i < 6; i++) writeFileSync(join(DATA, "uploads", `w${i}.jpg`), "x");
db.close();

const PORT = 19100 + (process.pid % 200);
const srv = spawn(process.execPath, ["--experimental-sqlite", "src/server.js"], { cwd: ROOT, env: { ...process.env, PORT: String(PORT), TNL_DATA: DATA }, stdio: ["ignore", "pipe", "pipe"] });
let log = ""; srv.stdout.on("data", (d) => log += d); srv.stderr.on("data", (d) => log += d);
for (let i = 0; i < 100 && !/listening/.test(log); i++) await new Promise((r) => setTimeout(r, 100));
const call = async (who, method, path, body) => {
  const r = await fetch(`http://127.0.0.1:${PORT}` + path, { method, headers: { "Content-Type": "application/json", ...(who ? { Authorization: "Bearer tok-" + who } : {}) }, body: body ? JSON.stringify(body) : undefined });
  let j = {}, text = ""; try { text = await r.text(); j = JSON.parse(text); } catch {}
  return { s: r.status, j, text };
};
const plan = { opensAt: now - 1000, submitDays: 1, voteDays: 3, finalDays: 2 };
const make = (slug, weighted) => call("boss", "POST", "/api/admin/events", { slug, title: slug, format: "poll", picks: 1, finalists: 2, judgeWeight: 0, minAccountDays: 0, freezeHours: 0, published: true, weighted, ...plan });
const tally = async (id, entry) => (await call("boss", "GET", `/api/admin/events/${id}`)).j.entries.find((e) => e.id === entry).votes.qualify.votes;

try {
  console.log("\nA WEIGHTED POLL");
  let r = await make("music", true);
  const evId = r.j.event?.id;
  t("an admin turns weighted votes on for an event", r.s === 200 && r.j.event.weighted === true);
  for (const [u, i] of [["ent1", 0], ["ent2", 1], ["ent3", 2]])
    await call(u, "POST", "/api/events/music/enter", { imageUrl: `/uploads/w${i}.jpg`, caption: "x", agree: true });
  await call("boss", "POST", `/api/admin/events/${evId}/advance`);
  const ents = (await call("newm", "GET", "/api/events/music")).j.entries;
  const by = Object.fromEntries(ents.map((e) => [e.author.username, e.id]));
  // three new members (1 each) back ent1; one Leadership member (100) backs ent2; a Verified (5) backs ent3
  r = await call("newm", "POST", "/api/events/music/vote", { entryId: by.ent1 });
  t("a vote goes in as normal", r.s === 200);
  await call("ent2", "POST", "/api/events/music/vote", { entryId: by.ent1 });
  await call("ent3", "POST", "/api/events/music/vote", { entryId: by.ent1 });
  await call("lead", "POST", "/api/events/music/vote", { entryId: by.ent2 });
  r = await call("ver", "POST", "/api/events/music/vote", { entryId: by.ent3 });
  const row = (id) => r.j.board?.rows?.find((x) => x.entryId === id);
  t("the scoreboard adds the weights: 3 new members = 3, one Leadership = 100, one Verified = 5",
    row(by.ent1)?.votes === 3 && row(by.ent2)?.votes === 100 && row(by.ent3)?.votes === 5);
  t("…so the most-contributing member's pick leads", row(by.ent2)?.rank === 1);
  t("admins' live tally adds them too", (await tally(evId, by.ent2)) === 100 && (await tally(evId, by.ent1)) === 3);

  console.log("\nTHE WEIGHT IS SET WHEN THE VOTE IS CAST");
  const d2 = new (await import("node:sqlite")).DatabaseSync(join(DATA, "tnl.db"));
  d2.prepare(`UPDATE users SET rep = 0 WHERE username = 'lead'`).run();
  t("a level change later doesn't rewrite a vote already cast", (await tally(evId, by.ent2)) === 100);

  console.log("\nSPAM: OFF AND BACK ON");
  r = await call("boss", "POST", "/api/admin/spam/remove", { usernames: ["ver"] });
  t("removing an account as spam takes its weighted vote off", r.s === 200 && (await tally(evId, by.ent3)) === 0);
  r = await call("boss", "POST", "/api/admin/spam/restore", { usernames: ["ver"] });
  t("restoring it puts the vote back at its weight", r.s === 200 && (await tally(evId, by.ent3)) === 5);

  console.log("\nTHE RULES SAY SO");
  const rules = await (await fetch(`http://127.0.0.1:${PORT}/e/music/rules`)).text();
  t("the rules page explains weighted votes and the numbers", /weighted by level/.test(rules) && /Leadership 100/.test(rules));

  console.log("\nOFF BY DEFAULT ON THE SERVER");
  r = await make("plain", undefined);
  const plainId = r.j.event?.id;
  t("an event made without the switch isn't weighted", r.j.event?.weighted === false);
  d2.prepare(`UPDATE users SET rep = ? WHERE username = 'lead'`).run(LV[5]);
  for (const [u, i] of [["ent1", 3], ["ent2", 4]]) await call(u, "POST", "/api/events/plain/enter", { imageUrl: `/uploads/w${i}.jpg`, caption: "x", agree: true });
  await call("boss", "POST", `/api/admin/events/${plainId}/advance`);
  const pe = (await call("newm", "GET", "/api/events/plain")).j.entries;
  const pb = Object.fromEntries(pe.map((e) => [e.author.username, e.id]));
  await call("lead", "POST", "/api/events/plain/vote", { entryId: pb.ent1 });
  t("there, a Leadership vote counts 1", (await tally(plainId, pb.ent1)) === 1);
  t("…and its rules don't mention weighting", !/weighted by level/.test(await (await fetch(`http://127.0.0.1:${PORT}/e/plain/rules`)).text()));
  d2.close();
} catch (e) { fail++; console.log("  ✗  crashed: " + e.stack); console.log(log.slice(-2000)); }
srv.kill();
console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
