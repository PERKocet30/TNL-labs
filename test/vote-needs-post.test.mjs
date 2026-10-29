// VOTERS MUST HAVE POSTED v1.0 (2026-10-29): "voters must have done something on
// LABS first." Real server; checks a new event has it on, an account with no
// post of its own can't vote (and is told plainly), one post (an entry counts)
// is enough, the admin can switch it off, and the rules text says so.
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { spawn } from "node:child_process";
const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const DATA = join(ROOT, "test/.tmp/vote-needs-post");
rmSync(DATA, { recursive: true, force: true }); mkdirSync(join(DATA, "uploads"), { recursive: true });
process.env.TNL_DATA = DATA;
let pass = 0, fail = 0;
const t = (n, ok) => { ok ? pass++ : fail++; console.log("  " + (ok ? "✓" : "✗") + "  " + n); };
const { db } = await import("../src/db.js");
const now = Date.now(), D = 86400000;
const mk = (u, admin = 0) => {
  const id = Number(db.prepare(`INSERT INTO users (username, display_name, email, password_hash, created_at, email_verified, avatar_url) VALUES (?,?,?,?,?,1,'/uploads/av.jpg')`).run(u, u, u + "@x.test", "x", now - 30 * D).lastInsertRowid);
  if (admin) db.prepare(`UPDATE users SET is_admin = 1 WHERE id = ?`).run(id);
  db.prepare(`INSERT INTO sessions (token, user_id, created_at) VALUES (?,?,?)`).run("tok-" + u, id, now);
  return id;
};
mk("boss", 1); mk("art"); mk("lurker"); const poster = mk("poster");
db.prepare(`INSERT INTO posts (author_id, channel, body, is_work, created_at) VALUES (?,?,?,1,?)`).run(poster, "profile", "my piece", now - D);
writeFileSync(join(DATA, "uploads", "e0.jpg"), "x");
db.close();
const PORT = 18840 + (process.pid % 40);
const srv = spawn(process.execPath, ["--experimental-sqlite", "src/server.js"], { cwd: ROOT, stdio: ["ignore", "pipe", "pipe"],
  env: { ...process.env, PORT: String(PORT), TNL_DATA: DATA, TNL_NO_WATCH: "1", RESEND_API_KEY: "", STRIPE_SECRET_KEY: "", EV_NEW_VOTE_WAIT_MS: "0" } });
let log = ""; srv.stdout.on("data", (d) => log += d); srv.stderr.on("data", (d) => log += d);
for (let i = 0; i < 100 && !/listening/.test(log); i++) await new Promise((r) => setTimeout(r, 100));
const B = `http://127.0.0.1:${PORT}`;
const call = async (who, path, body, method) => {
  const r = await fetch(B + path, { method: method || (body ? "POST" : "GET"), headers: { "Content-Type": "application/json", ...(who ? { Authorization: "Bearer tok-" + who } : {}) }, body: body ? JSON.stringify(body) : undefined });
  return { s: r.status, j: await r.json().catch(() => ({})) };
};
try {
  console.log("\nA NEW EVENT ASKS FOR A POST");
  const ev = (await call("boss", "/api/admin/events", { slug: "art", title: "Art", brief: "x", format: "poll", picks: 1, minAccountDays: 0, opensAt: now - D, submitDays: 14, voteDays: 7, finalDays: 3, published: true, mailOnOpen: false })).j;
  t("on by default for a new event", ev.event?.requirePost === true);
  const en = (await call("art", "/api/events/art/enter", { imageUrl: "/uploads/e0.jpg", caption: "mine", agree: true })).j;
  const entryId = (en.entries || en.event?.entries || [])[0]?.id || en.myEntry?.id;
  await call("boss", `/api/admin/events/${ev.event.id}/advance`, {});
  const pub = (await call("lurker", "/api/events/art")).j;
  t("members see the rule", pub.event?.requirePost === true);

  console.log("\nWHO CAN VOTE");
  const no = await call("lurker", "/api/events/art/vote", { entryId, on: true });
  t("no post of their own → refused, plainly", no.s === 403 && no.j.error === "Post something of your own on LABS to vote.");
  t("one post is enough", (await call("poster", "/api/events/art/vote", { entryId, on: true })).s === 200);
  const rules = (await call("lurker", "/api/events/art/rules")).j;
  t("the official rules say so", /posted something of your own on LABS/.test(JSON.stringify(rules)));

  console.log("\nTHE ADMIN CAN SWITCH IT OFF");
  t("switched off", (await call("boss", `/api/admin/events/${ev.event.id}`, { requirePost: false }, "PATCH")).j.event?.requirePost === false);
  t("…and the lurker can vote", (await call("lurker", "/api/events/art/vote", { entryId, on: true })).s === 200);
} catch (e) {
  fail++; console.log("  ✗  threw: " + e.message); console.log(log.slice(-1500));
} finally { srv.kill(); }
console.log(`\n  ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
