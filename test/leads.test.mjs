// LAB LEADS v1.0 (2026-10-28): quality control for one scene. Boots the real
// server on a throwaway database and checks who can appoint a Lead, that a
// Lead pins and takes down only inside the labs they lead, never the owner's,
// a Mod's or another Lead's work, and that it shows publicly.
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { mkdirSync, rmSync } from "node:fs";
import { spawn } from "node:child_process";
const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const DATA = join(ROOT, "test/.tmp/leads");
rmSync(DATA, { recursive: true, force: true }); mkdirSync(DATA, { recursive: true });
process.env.TNL_DATA = DATA;
let pass = 0, fail = 0;
const t = (n, ok) => { ok ? pass++ : fail++; console.log("  " + (ok ? "✓" : "✗") + "  " + n); };

const { db } = await import("../src/db.js");
const now = Date.now(), D = 86400000;
const mk = (u, { admin = 0, mod = 0 } = {}) => {
  const id = Number(db.prepare(`INSERT INTO users (username, display_name, email, password_hash, created_at, email_verified) VALUES (?,?,?,?,?,1)`)
    .run(u, u.toUpperCase(), u + "@x.test", "x", now - 60 * D).lastInsertRowid);
  db.prepare(`UPDATE users SET is_admin = ?, is_mod = ? WHERE id = ?`).run(admin, mod, id);
  db.prepare(`INSERT INTO sessions (token, user_id, created_at) VALUES (?,?,?)`).run("tok-" + u, id, now);
  return id;
};
const U = { boss: mk("boss", { admin: 1 }), embers: mk("embers", { mod: 1 }), lea: mk("lea"), fay: mk("fay"), ana: mk("ana"), ben: mk("ben") };
let n = 0;
const post = (who, ch) => Number(db.prepare(`INSERT INTO posts (author_id, channel, body, is_work, created_at) VALUES (?,?,?,1,?)`).run(U[who], ch, "by " + who, now - (++n) * 1000).lastInsertRowid);
const P = { anaMusic: post("ana", "music-chat"), anaMusic2: post("ana", "tracks"), benMusic: post("ben", "music-chat"), anaFashion: post("ana", "clothing-design"),
  bossMusic: post("boss", "music-chat"), modMusic: post("embers", "music-chat"), fayMusic: post("fay", "music-chat"), anaProfile: post("ana", "profile") };
const cm = (who, postId) => Number(db.prepare(`INSERT INTO comments (post_id, author_id, body, created_at) VALUES (?,?,?,?)`).run(postId, U[who], "c by " + who, now).lastInsertRowid);
const C = { ana: cm("ana", P.benMusic), mod: cm("embers", P.benMusic), anaFashion: cm("ana", P.anaFashion) };
db.close();

const PORT = 18300 + (process.pid % 200);
const srv = spawn(process.execPath, ["--experimental-sqlite", "src/server.js"], { cwd: ROOT, env: { ...process.env, PORT: String(PORT), TNL_DATA: DATA }, stdio: ["ignore", "pipe", "pipe"] });
let log = ""; srv.stdout.on("data", (d) => log += d); srv.stderr.on("data", (d) => log += d);
for (let i = 0; i < 100 && !/listening/.test(log); i++) await new Promise((r) => setTimeout(r, 100));
const call = async (who, method, path, body) => {
  const r = await fetch(`http://127.0.0.1:${PORT}` + path, { method, headers: { "Content-Type": "application/json", ...(who ? { Authorization: "Bearer tok-" + who } : {}) }, body: body ? JSON.stringify(body) : undefined });
  let j = {}; try { j = await r.json(); } catch {}
  return { s: r.status, j };
};
const lead = (who, target, lab, on = true) => call(who, "POST", `/api/admin/members/${target}/lead`, { lab, on });
try {
  console.log("\nAPPOINTING — the owner and Mods");
  t("a member can't appoint a Lead", (await lead("ana", "lea", "culture")).s === 403);
  t("a Mod makes lea Lead of // Music", (await lead("embers", "lea", "culture")).j.leads?.join() === "culture");
  t("the owner makes fay Lead of // Music too", (await lead("boss", "fay", "culture")).j.leads?.join() === "culture");
  t("a Lead can't appoint a Lead", (await lead("lea", "ben", "culture")).s === 403);
  t("the owner and Mods can't be made Leads (they curate every lab)", (await lead("boss", "embers", "culture")).s !== 200);
  t("a made-up lab is refused", (await lead("boss", "ben", "nowhere")).s === 400);
  t("a Lead has no /admin", (await call("lea", "GET", "/api/admin/pulse?days=7")).s === 403 && (await call("lea", "GET", "/api/admin/people")).s === 403);

  console.log("\nIT SHOWS");
  const prof = (await call("ben", "GET", "/api/users/lea")).j.user;
  t("lea's profile says she leads // Music", prof.leads?.join() === "culture");
  t("…and Mod stays private to others", (await call("ben", "GET", "/api/users/embers")).j.user.isMod === undefined);
  t("a Mod's own /api/me knows they're a Mod", (await call("embers", "GET", "/api/me")).j.user.isMod === true);
  const work = (await call("ben", "GET", "/api/labs/culture/work")).j;
  t("// Music's Work says who leads it", work.leads?.map((u) => u.username).join() === "lea,fay");
  t("…and so does /api/labs/culture/leads (Music's library uses it)", (await call("ben", "GET", "/api/labs/culture/leads")).j.leads?.map((u) => u.username).join() === "lea,fay");
  t("// Fashion has no Lead yet", (await call("ben", "GET", "/api/labs/fashion/work")).j.leads?.length === 0);

  console.log("\nPINNING — only in their own lab");
  t("lea pins work in // Music", (await call("lea", "POST", `/api/posts/${P.anaMusic}/pin`, { pinned: true })).s === 200);
  t("lea can't pin in // Fashion", (await call("lea", "POST", `/api/posts/${P.anaFashion}/pin`, { pinned: true })).s === 403);
  t("a member can't pin", (await call("ben", "POST", `/api/posts/${P.anaMusic}/pin`, { pinned: false })).s === 403);
  t("a Mod pins in any lab", (await call("embers", "POST", `/api/posts/${P.anaFashion}/pin`, { pinned: true })).s === 200);

  console.log("\nTAKING DOWN — quality control in their lab");
  t("lea takes down a member's post in // Music (any of its rooms)", (await call("lea", "DELETE", `/api/labs/posts/${P.anaMusic2}`)).s === 200);
  const notes = (await call("ana", "GET", "/api/notifications")).j;
  t("…and ana is told which lab took it down", /Music.*lead/.test(JSON.stringify(notes)));
  t("lea can't take down in // Fashion", (await call("lea", "DELETE", `/api/labs/posts/${P.anaFashion}`)).s === 403);
  t("lea can't take down a profile post", (await call("lea", "DELETE", `/api/labs/posts/${P.anaProfile}`)).s === 403);
  t("lea can't take down the owner's post", (await call("lea", "DELETE", `/api/labs/posts/${P.bossMusic}`)).s === 403);
  t("lea can't take down a Mod's post", (await call("lea", "DELETE", `/api/labs/posts/${P.modMusic}`)).s === 403);
  t("lea can't take down another Lead's post", (await call("lea", "DELETE", `/api/labs/posts/${P.fayMusic}`)).s === 403);
  t("a member can't take down someone's post", (await call("ben", "DELETE", `/api/labs/posts/${P.anaMusic}`)).s === 403);
  t("a Mod can take down a Lead's post", (await call("embers", "DELETE", `/api/labs/posts/${P.fayMusic}`)).s === 200);
  t("a Mod can't take down the owner's post", (await call("embers", "DELETE", `/api/labs/posts/${P.bossMusic}`)).s === 403);
  t("lea removes a member's comment in // Music", (await call("lea", "DELETE", `/api/comments/${C.ana}`)).s === 200);
  t("…but not a Mod's comment", (await call("lea", "DELETE", `/api/comments/${C.mod}`)).s === 403);
  t("…nor a comment in // Fashion", (await call("lea", "DELETE", `/api/comments/${C.anaFashion}`)).s === 403);
  const lg = JSON.stringify((await call("boss", "GET", "/api/admin/log")).j);
  t("lea's takedown is in the admin log", /lead took down a post in culture/.test(lg));

  console.log("\nREMOVING A LEAD");
  t("the Mod removes lea as Lead", (await lead("embers", "lea", "culture", false)).j.leads?.length === 0);
  t("…and she can't take things down any more", (await call("lea", "DELETE", `/api/labs/posts/${P.anaMusic}`)).s === 403);
  t("…or pin", (await call("lea", "POST", `/api/posts/${P.benMusic}/pin`, { pinned: true })).s === 403);
} catch (e) {
  fail++; console.log("  ✗  threw: " + e.message); console.log(log.slice(-1500));
} finally { srv.kill(); }
console.log(`\n  ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
