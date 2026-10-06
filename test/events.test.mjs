// Events v1.0 (2026-10-06): a whole tournament against the real server.
// Bracket and simple formats, every voting rule, judging, results, and
// that vote counts never leak while a stage is open.
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { spawn } from "node:child_process";
const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const DATA = join(ROOT, "test/.tmp/events");
rmSync(DATA, { recursive: true, force: true }); mkdirSync(join(DATA, "uploads"), { recursive: true });
process.env.TNL_DATA = DATA;
let pass = 0, fail = 0;
const t = (n, ok) => { ok ? pass++ : fail++; console.log("  " + (ok ? "✓" : "✗") + "  " + n); };

const { db } = await import("../src/db.js");
const now = Date.now(), D = 86400000;
const mk = (u, { admin = 0, age = 60 } = {}) => {
  const id = Number(db.prepare(`INSERT INTO users (username, display_name, email, password_hash, created_at, email_verified) VALUES (?,?,?,?,?,1)`)
    .run(u, u.toUpperCase(), u + "@x.test", "x", now - age * D).lastInsertRowid);
  if (admin) db.prepare(`UPDATE users SET is_admin = 1 WHERE id = ?`).run(id);
  db.prepare(`INSERT INTO sessions (token, user_id, created_at) VALUES (?,?,?)`).run("tok-" + u, id, now);
  return id;
};
const MEMBERS = "abcdefghijkl".split("");
mk("boss", { admin: 1 }); mk("judge"); mk("newbie", { age: 1 });
for (const m of MEMBERS) mk(m);
for (let i = 0; i < 14; i++) writeFileSync(join(DATA, "uploads", `e${i}.jpg`), "x");
db.close();

const PORT = 18700 + (process.pid % 200);
const srv = spawn(process.execPath, ["--experimental-sqlite", "src/server.js"], { cwd: ROOT, env: { ...process.env, PORT: String(PORT), TNL_DATA: DATA }, stdio: ["ignore", "pipe", "pipe"] });
let log = ""; srv.stdout.on("data", (d) => log += d); srv.stderr.on("data", (d) => log += d);
for (let i = 0; i < 100 && !/listening/.test(log); i++) await new Promise((r) => setTimeout(r, 100));
const call = async (who, method, path, body) => {
  const r = await fetch(`http://127.0.0.1:${PORT}` + path, { method, headers: { "Content-Type": "application/json", ...(who ? { Authorization: "Bearer tok-" + who } : {}) }, body: body ? JSON.stringify(body) : undefined });
  let j = {}, text = ""; try { text = await r.text(); j = JSON.parse(text); } catch {}
  return { s: r.status, j, text };
};
const enter = (who, i, extra = {}) => call(who, "POST", "/api/events/poster/enter", { imageUrl: `/uploads/e${i}.jpg`, caption: "piece by " + who, agree: true, ...extra });
const vote = (who, entryId, on = true, slug = "poster") => call(who, "POST", `/api/events/${slug}/vote`, { entryId, on });
const view = (who, slug = "poster") => call(who, "GET", "/api/events/" + slug).then((r) => r.j);

try {
  console.log("\nSETTING IT UP (admin only)");
  const plan = { opensAt: now - 1000, submitDays: 1, voteDays: 1, roundDays: 1, finalDays: 1 };
  t("members can't create events", (await call("a", "POST", "/api/admin/events", { slug: "x-1", title: "x" })).s === 403);
  let r = await call("boss", "POST", "/api/admin/events", { slug: "poster", title: "Poster Tournament", brief: "A poster for the lab.", format: "bracket", bracketSize: 8, judgeWeight: 50, picks: 3, minAccountDays: 3, published: true, ...plan });
  const evId = r.j.event?.id;
  t("an admin creates a bracket event; it opens in the submit phase", r.s === 200 && r.j.event.phase.phase === "submit");
  t("its schedule: submit, vote, 2 rounds for an 8-bracket, final, results", r.j.event.schedule.map((p) => p.phase + (p.round || "")).join(",") === "submit,qualify,round1,round2,final,results");
  t("bad link names are refused", (await call("boss", "POST", "/api/admin/events", { slug: "No Spaces!", title: "x" })).s === 400);
  r = await call("boss", "POST", `/api/admin/events/${evId}/judges`, { username: "judge" });
  t("a judge is added", r.j.judges?.some((j) => j.username === "judge"));

  console.log("\nENTERING");
  t("judges can't enter their own event", (await enter("judge", 13)).s === 403);
  t("you have to agree to the rules", (await enter("a", 0, { agree: false })).s === 400);
  t("only images uploaded here", (await enter("a", 0, { imageUrl: "https://evil.test/x.jpg" })).s === 400);
  for (let i = 0; i < 10; i++) await enter(MEMBERS[i], i);
  t("one entry per person", (await enter("a", 11)).s === 409);
  r = await call("a", "DELETE", "/api/events/poster/entry");
  t("you can withdraw while entries are open…", r.s === 200 && r.j.me.entry === null);
  r = await enter("a", 12);
  t("…and swap in a different piece", r.s === 200 && r.j.me.entry?.imageUrl === "/uploads/e12.jpg");
  let v = await view("k");
  t("10 entries in the gallery, each a real post", v.entries.length === 10 && v.entries.every((e) => e.postId && e.author.username));
  t("voting isn't open during entries", (await vote("k", v.entries[0].id)).s === 400);
  t("the gallery order is shuffled per viewer, but stable", JSON.stringify((await view("k")).entries.map((e) => e.id)) === JSON.stringify(v.entries.map((e) => e.id)));

  console.log("\nTHE VOTE");
  await call("boss", "POST", `/api/admin/events/${evId}/advance`);
  v = await view("k");
  t("ending the phase early moves to the vote", v.event.phase.phase === "qualify");
  t("entries are locked once voting starts", (await enter("k", 11)).s === 400 && (await call("b", "DELETE", "/api/events/poster/entry")).s === 400);
  const byUser = Object.fromEntries(v.entries.map((e) => [e.author.username, e.id]));
  t("brand-new accounts can't vote", (await vote("newbie", byUser.b)).s === 403);
  t("you can't vote for yourself", (await vote("b", byUser.b)).s === 403);
  t("judges can vote before the final", (await vote("judge", byUser.c)).s === 200);
  // b gets 4 votes, c 3 (incl. judge), d 2, e…g 1 each
  for (const w of ["k", "l", "c", "d"]) await vote(w, byUser.b);
  for (const w of ["k", "l"]) await vote(w, byUser.c);
  await vote("k", byUser.d); await vote("e", byUser.d);
  t("three picks, then no more", (await vote("k", byUser.e)).s === 400);
  r = await vote("k", byUser.d, false);
  t("you can take a pick back", r.s === 200 && r.j.myVotes.length === 2);
  await vote("k", byUser.d);
  for (const [w, x] of [["f", "e"], ["g", "f"], ["h", "g"]]) await vote(w, byUser[x]);
  v = await view("l");
  t("members never see counts while a stage is open", !/"votes"|"aPct":\d/.test(JSON.stringify(v)) && v.me.myVotes.length === 2);
  let a = (await call("boss", "GET", `/api/admin/events/${evId}`)).j;
  t("admins see the live tally", a.entries.find((e) => e.id === byUser.b).votes.qualify.votes === 4);

  console.log("\nTHE BRACKET");
  await call("boss", "POST", `/api/admin/events/${evId}/advance`);
  v = await view("k");
  t("10 entries make an 8-bracket: round 1 has 4 matchups", v.event.phase.phase === "round" && v.event.phase.round === 1 && v.bracket.rounds[0].matchups.length === 4);
  a = (await call("boss", "GET", `/api/admin/events/${evId}`)).j;
  const seed = Object.fromEntries(a.entries.map((e) => [e.author.username, e.seed]));
  t("seeded by the vote: b first, c second, d third", seed.b === 1 && seed.c === 2 && seed.d === 3);
  const m0 = v.bracket.rounds[0].matchups;
  t("standard seeding: 1 plays 8, and 1 and 2 are in opposite halves", (() => { const s = (id) => a.entries.find((e) => e.id === id).seed;
    return m0.some((m) => [s(m.a), s(m.b)].sort().join() === "1,8") && m0.findIndex((m) => s(m.a) === 1 || s(m.b) === 1) < 2 && m0.findIndex((m) => s(m.a) === 2 || s(m.b) === 2) >= 2; })());
  t("the bottom two seeds are out", v.inPlay.length === 8);
  const mB = m0.find((m) => m.a === byUser.b || m.b === byUser.b), opp = mB.a === byUser.b ? mB.b : mB.a;
  // the underdog wins this one: 3 votes to 1 after a change of mind
  for (const w of ["k", "l", "judge"]) await vote(w, opp);
  // j and a are out of the bracket (seeds 9 and 10), so they can vote anywhere
  await vote("j", byUser.b); await vote("a", byUser.b); await vote("a", opp);
  t("one pick per matchup: changing it moves your vote", (await view("a")).me.myVotes.filter((x) => x === byUser.b || x === opp).join() === String(opp));
  t("no percentages while the round is open", (await view("k")).bracket.rounds[0].matchups.every((m) => m.aPct === null));
  await call("boss", "POST", `/api/admin/events/${evId}/advance`);
  v = await view("k");
  const done = v.bracket.rounds[0].matchups.find((m) => m.slot === mB.slot);
  t("an upset: the top seed is out, the votes decided it", done.winner === opp && (done.a === opp ? done.aPct : done.bPct) === 80);
  t("round 2 has the 4 winners", v.event.phase.round === 2 && v.bracket.rounds[1].matchups.length === 2);
  t("an untouched matchup goes to the better seed", v.bracket.rounds[0].matchups.every((m) => m.winner));
  await call("boss", "POST", `/api/admin/events/${evId}/advance`);
  v = await view("judge");
  t("the last two are in the final", v.event.phase.phase === "final" && v.finalists.length === 2);

  console.log("\nTHE FINAL");
  const [f1, f2] = v.finalists;
  t("judges score instead of voting", (await vote("judge", f1)).s === 403);
  t("scores run 1 to 10", (await call("judge", "POST", "/api/events/poster/score", { entryId: f1, score: 11 })).s === 400);
  t("members can't judge", (await call("k", "POST", "/api/events/poster/score", { entryId: f1, score: 9 })).s === 403);
  await call("judge", "POST", "/api/events/poster/score", { entryId: f1, score: 4 });
  await call("judge", "POST", "/api/events/poster/score", { entryId: f2, score: 6 });
  // members: f1 3 votes, f2 1 → votes 75/25; judges 40/60 → f1 57.5, f2 42.5
  const voters = ["k", "l", "newbie", "h", "i", "j", "a", "b", "c", "d", "e", "f", "g"];
  let n1 = 0, n2 = 0;
  for (const w of voters) { const own = v.entries.find((e) => e.author.username === w); if (own && (own.id === f1 || own.id === f2)) continue;
    if (n1 < 3) { if ((await vote(w, f1)).s === 200) n1++; } else if (n2 < 1) { if ((await vote(w, f2)).s === 200) n2++; } }
  await call("boss", "POST", `/api/admin/events/${evId}/advance`);
  v = await view("k");
  t("results: judges 50% + votes 50% decide", v.event.phase.phase === "results" && v.results.winner === f1 && v.results.ranking[0].score === 57.5 && v.results.ranking[1].score === 42.5);
  t("the breakdown shows both halves", v.results.ranking[0].judgePct === 40 && v.results.ranking[0].votePct === 75);

  console.log("\nPUBLIC PAGES");
  r = await call(null, "GET", "/e/poster");
  t("/e/poster: the event page, with a link preview", r.s === 200 && r.text.includes("Poster Tournament") && r.text.includes('og:title'));
  r = await call(null, "GET", "/e/poster/rules");
  t("/e/poster/rules: official rules, no purchase necessary", r.s === 200 && r.text.includes("NO PURCHASE OR PAYMENT NECESSARY") && r.text.includes("50% by the judges"));
  const cur = (await call(null, "GET", "/api/events")).j;
  t("/api/events lists it for the Showroom", cur.events.some((e) => e.slug === "poster"));

  console.log("\nSIMPLE FORMAT, AND A CANCELLED ONE");
  r = await call("boss", "POST", "/api/admin/events", { slug: "simple", title: "Simple", format: "simple", finalists: 2, published: true, ...plan });
  const sId = r.j.event.id;
  t("simple: submit, vote, final, results", r.j.event.schedule.map((p) => p.phase).join(",") === "submit,qualify,final,results");
  for (const [w, i] of [["k", 0], ["l", 1], ["h", 2]]) await call(w, "POST", "/api/events/simple/enter", { imageUrl: `/uploads/e${i}.jpg`, agree: true });
  await call("boss", "POST", `/api/admin/events/${sId}/advance`);
  const sv = await view("a", "simple"), su = Object.fromEntries(sv.entries.map((e) => [e.author.username, e.id]));
  await vote("a", su.h, true, "simple"); await vote("b", su.h, true, "simple"); await vote("c", su.l, true, "simple");
  await call("boss", "POST", `/api/admin/events/${sId}/advance`);
  const sf = await view("a", "simple");
  t("the top 2 by votes are the finalists", sf.event.phase.phase === "final" && sf.finalists.length === 2 && sf.finalists.includes(su.h) && sf.finalists.includes(su.l));
  r = await call("boss", "POST", "/api/admin/events", { slug: "lonely", title: "Lonely", published: true, ...plan });
  await call("k", "POST", "/api/events/lonely/enter", { imageUrl: "/uploads/e1.jpg", agree: true });
  await call("boss", "POST", `/api/admin/events/${r.j.event.id}/advance`);
  t("one entry when entries close: the event is called off, not run", (await view("k", "lonely")).event.void === true);

  console.log("\nDISQUALIFYING");
  r = await call("boss", "POST", `/api/admin/events/${sId}/entries/${su.h}/dq`, { reason: "Not original work." });
  t("a DQ'd finalist can't be voted for", [400, 403].includes((await vote("a", su.h, true, "simple")).s));
  t("…and leaves the gallery", !(await view("a", "simple")).entries.some((e) => e.id === su.h));
  t("members can't disqualify", (await call("a", "POST", `/api/admin/events/${sId}/entries/${su.l}/dq`, { reason: "x" })).s === 403);
} catch (e) {
  fail++; console.log("  ✗  threw: " + e.message); console.log(log.slice(-1500));
} finally { srv.kill(); }
console.log(`\n  ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
