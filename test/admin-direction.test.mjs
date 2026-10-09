// Admin · the direction v1.0 (2026-10-09): /admin's Today now runs on the
// app's direction — labs as places (genres + #tags), the tournament at the
// centre, and how people take part. Boots the real server on a throwaway
// database; checks the numbers, the moderation filters by lab and #tag,
// that pins from an old channel show in the lab, and that none of it
// answers anyone but an admin.
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { mkdirSync, rmSync, readFileSync, writeFileSync } from "node:fs";
import { spawn } from "node:child_process";
const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const DATA = join(ROOT, "test/.tmp/admin-direction");
rmSync(DATA, { recursive: true, force: true }); mkdirSync(join(DATA, "uploads"), { recursive: true });
process.env.TNL_DATA = DATA;
for (let i = 0; i < 3; i++) writeFileSync(join(DATA, "uploads", `e${i}.jpg`), "x");
let pass = 0, fail = 0;
const t = (n, ok) => { ok ? pass++ : fail++; console.log("  " + (ok ? "✓" : "✗") + "  " + n); };

// the lab names, as the app shows them, and as the admin server names them
const app07 = readFileSync(join(ROOT, "src/app-07-theme-labs-api.js"), "utf8");
const LABS = new Function(app07.slice(app07.indexOf("const LABS = ["), app07.indexOf("];", app07.indexOf("const LABS = [")) + 2) + "\nreturn LABS;")();
const part = readFileSync(join(ROOT, "src/server-10-pulse-labs.js"), "utf8");
const LAB_NAME = new Function(part.slice(part.indexOf("const LAB_NAME ="), part.indexOf(";", part.indexOf("const LAB_NAME =")) + 1) + "\nreturn LAB_NAME;")();

const { db } = await import("../src/db.js");
const now = Date.now(), D = 86400000;
const mk = (u, { admin = 0, suspended = 0 } = {}) => {
  const id = Number(db.prepare(`INSERT INTO users (username, display_name, email, password_hash, created_at, email_verified) VALUES (?,?,?,?,?,1)`)
    .run(u, u.toUpperCase(), u + "@x.test", "x", now - 60 * D).lastInsertRowid);
  db.prepare(`UPDATE users SET is_admin = ?, suspended = ? WHERE id = ?`).run(admin, suspended, id);
  db.prepare(`INSERT INTO sessions (token, user_id, created_at) VALUES (?,?,?)`).run("tok-" + u, id, now);
  return id;
};
const U = { boss: mk("boss", { admin: 1 }), ana: mk("ana"), ben: mk("ben"), cam: mk("cam"), dee: mk("dee"), eve: mk("eve"), sus: mk("sus", { suspended: 1 }) };
const post = (who, ch, body, ago, work = 0) => Number(db.prepare(`INSERT INTO posts (author_id, channel, body, is_work, image_url, created_at) VALUES (?,?,?,?,?,?)`)
  .run(U[who], ch, body, work, work ? "/uploads/e0.jpg" : null, now - ago).lastInsertRowid);
// made before this boot, so the old channels' names ride along as #tags
const anaPoster = post("ana", "creators", "new piece #poster #typography", 1 * D, 1);
const benPhoto = post("ben", "photography", "golden hour", 2 * D, 1);
post("ben", "music-chat", "who's got #feedback for me", 1 * D);
const camProfile = post("cam", "profile", "#poster at home", 1 * D, 1);
post("dee", "general", "old hello", 40 * D);
db.prepare(`INSERT INTO comments (post_id, author_id, body, created_at) VALUES (?,?,?,?)`).run(anaPoster, U.dee, "love the type", now - D);
db.close();

const PORT = 18700 + (process.pid % 150);
const srv = spawn(process.execPath, ["--experimental-sqlite", "src/server.js"], { cwd: ROOT, env: { ...process.env, PORT: String(PORT), TNL_DATA: DATA }, stdio: ["ignore", "pipe", "pipe"] });
let log = ""; srv.stdout.on("data", (d) => log += d); srv.stderr.on("data", (d) => log += d);
for (let i = 0; i < 100 && !/listening/.test(log); i++) await new Promise((r) => setTimeout(r, 100));
const call = async (who, method, path, body) => {
  const r = await fetch(`http://127.0.0.1:${PORT}` + path, { method, headers: { "Content-Type": "application/json", ...(who ? { Authorization: "Bearer tok-" + who } : {}) }, body: body ? JSON.stringify(body) : undefined });
  let j = {}; try { j = await r.json(); } catch {}
  return { s: r.status, j };
};
const dir = async () => (await call("boss", "GET", "/api/admin/direction?days=7&tz=240")).j;

try {
  console.log("\nADMINS ONLY — enforced on the server");
  t("a member gets 403", (await call("ana", "GET", "/api/admin/direction")).s === 403);
  t("signed out → 401", (await call(null, "GET", "/api/admin/direction")).s === 401);
  t("the admin's lab names match the app's", LABS.every((l) => LAB_NAME[l.id] === l.name) && Object.keys(LAB_NAME).length === LABS.length);

  console.log("\nTHE TOURNAMENT — front and centre");
  let d = await dir();
  t("none yet → it says so, under Needs you", d.tournament === null && d.needs.some((n) => n.kind === "tournament" && /No tournament/.test(n.text)));
  const plan = { opensAt: now - 1000, submitDays: 1, voteDays: 1, finalDays: 1 };
  const ev = (await call("boss", "POST", "/api/admin/events", { slug: "art-poll", title: "Art Tournament", format: "poll", prize: "TBD", ...plan })).j.event;
  d = await dir();
  t("a draft → “still a draft — members can't see it”", d.tournament.id === ev.id && !d.tournament.published && d.needs.some((n) => /still a draft/.test(n.text) && n.event === ev.id));
  await call("boss", "PATCH", `/api/admin/events/${ev.id}`, { published: true });
  t("published, entries open", (await dir()).tournament.phase.phase === "submit");
  await call("ana", "POST", "/api/events/art-poll/enter", { imageUrl: "/uploads/e1.jpg", caption: "my entry", agree: true });
  await call("cam", "POST", "/api/events/art-poll/enter", { imageUrl: "/uploads/e2.jpg", caption: "mine", agree: true });
  d = await dir();
  t("entries closing within 48h → remind the chats on Instagram", d.needs.some((n) => /Entries close in \d+h — 2 so far/.test(n.text) && /Instagram/.test(n.text)));
  await call("boss", "POST", `/api/admin/events/${ev.id}/advance`);
  const entries = (await call("boss", "GET", `/api/admin/events/${ev.id}`)).j.entries;
  const entryOf = (who) => entries.find((e) => e.userId === U[who]).id;
  t("ben votes", (await call("ben", "POST", "/api/events/art-poll/vote", { entryId: entryOf("ana"), on: true })).s === 200);
  await call("dee", "POST", "/api/events/art-poll/vote", { entryId: entryOf("cam"), on: true });
  d = await dir();
  const T = d.tournament;
  t("voting, with its numbers: 2 entries, 2 voters, 2 votes today", T.phase.phase === "qualify" && T.entries === 2 && T.voters === 2 && T.votes === 2 && T.votesDay === 2);
  t("voting ends within 48h → post the scoreboard to Instagram", d.needs.some((n) => /Voting ends in \d+h — post the scoreboard to Instagram/.test(n.text) && n.event === ev.id));
  t("tournament votes this period: 2, and per day", d.votes.now === 2 && d.votes.before === 0 && d.series.votes.length === 7 && d.series.votes.reduce((a, b) => a + b, 0) === 2);
  t("a vote counts as being active", (await call("boss", "GET", "/api/admin/pulse?days=7")).j.now.active >= 4);

  console.log("\nLABS — genres, by their #tags");
  const lab = Object.fromEntries(d.labs.map((l) => [l.id, l]));
  t("every lab is listed, in the app's order, then Profiles", d.labs.map((l) => l.id).join() === LABS.map((l) => l.id).join() + ",profile");
  t("Visual: ana's and ben's pieces + the 2 entries, nothing to talk", lab.pharmacy.work === 4 && lab.pharmacy.talk === 0 && lab.pharmacy.people === 3);
  t("…its #tags this week: #poster #typography #photography (not #creators)", ["poster", "typography", "photography"].every((x) => lab.pharmacy.tags.some((y) => y.tag === x)) && !lab.pharmacy.tags.some((y) => y.tag === "creators"));
  t("Music: ben's talk, tagged #feedback (not #chat)", lab.culture.talk === 1 && lab.culture.tags.map((x) => x.tag).join() === "feedback");
  t("General: dee's post is older than the window", lab.hq.work + lab.hq.talk === 0);
  t("Profiles: cam's piece", lab.profile.work === 1);
  const poster = d.tags.find((x) => x.tag === "poster");
  t("#poster is trending, in Visual and on profiles", d.tags[0].tag === "poster" && poster.count === 2 && poster.labs.sort().join() === "pharmacy,profile");
  t("plain room names aren't trending tags", !d.tags.some((x) => ["creators", "chat", "general"].includes(x.tag)));

  console.log("\nHOW PEOPLE TAKE PART — all time");
  const tp = d.takingPart, way = Object.fromEntries(tp.ways.map((w) => [w.key, w.n]));
  t("6 members (the suspended one doesn't count)", tp.members === 6);
  t("build 3 · talk 2 · feedback 1 · tournament 4 · collab 0 · sell 0", way.build === 3 && way.talk === 2 && way.feedback === 1 && way.compete === 4 && way.collab === 0 && way.sell === 0);
  t("not taking part yet: boss and eve — the people to say hi to", tp.notYet.n === 2 && tp.notYet.people.map((x) => x.username).sort().join() === "boss,eve");

  console.log("\nMODERATION — by lab and #tag");
  const posts = async (qs) => (await call("boss", "GET", "/api/admin/posts" + qs)).j;
  let c = await posts("?lab=pharmacy");
  t("?lab=pharmacy: every Visual post, old channels included", c.posts.length === 4 && c.posts.every((x) => x.labName === "Visual"));
  t("…each with its #tags", c.posts.find((x) => x.id === anaPoster).tags.includes("typography") && c.posts.find((x) => x.id === benPhoto).tags.includes("photography"));
  t("labs listed with counts", c.labs.find((x) => x.id === "pharmacy").n === 4 && c.labs.find((x) => x.id === "profile").n === 1);
  c = await posts("?tag=poster");
  t("?tag=poster: ana's and cam's, across labs", c.posts.map((x) => x.id).sort((a, b) => a - b).join() === [anaPoster, camProfile].join());
  t("?tag=%23Photography: old channel posts, case-insensitive", (await posts("?tag=%23Photography")).posts.map((x) => x.id).join() === String(benPhoto));
  t("?lab=profile&tag=poster: just cam's", (await posts("?lab=profile&tag=poster")).posts.map((x) => x.id).join() === String(camProfile));
  t("a tag nobody used: nothing", (await posts("?tag=zzz")).posts.length === 0);

  console.log("\nPEOPLE — who's in the tournament");
  const ppl = (await call("boss", "GET", "/api/admin/people?filter=tournament")).j.people.map((x) => x.username).sort().join();
  t("filter: entered or voted", ppl === "ana,ben,cam,dee");
  const pa = (await call("boss", "GET", "/api/admin/people/ana")).j, pb = (await call("boss", "GET", "/api/admin/people/ben")).j;
  t("detail: ana entered; ben voted once", pa.stats.entered === 1 && pa.stats.votes === 0 && pb.stats.votes === 1 && pb.stats.entered === 0);
  t("their posts say which lab", pa.posts.every((x) => x.labName === "Visual"));

  console.log("\nPINS — from any channel in the lab");
  t("pin ben's #photography piece from /admin", (await call("boss", "POST", `/api/posts/${benPhoto}/pin`, { pinned: true })).s === 200);
  t("…it shows at the top of Visual's Talk (it used to vanish)", (await call("dee", "GET", "/api/labs/pharmacy/feed")).j.pins.some((p) => p.id === benPhoto));
  t("…and not in another lab", !(await call("dee", "GET", "/api/labs/culture/feed")).j.pins.some((p) => p.id === benPhoto));
} catch (e) {
  fail++; console.log("  ✗  threw: " + e.message); console.log(log.slice(-1500));
} finally { srv.kill(); }
console.log(`\n  ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
