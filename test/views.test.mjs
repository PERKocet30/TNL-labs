// VIEWS v1.0 (2026-11-03): "seen it" is a signal. POST /api/views takes a batch of
// post ids from the app and keeps one row per piece, per viewer, per day — a
// member by id, a stranger by their device mark, nobody without either.
// Runs the real server against a throwaway database.
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { mkdirSync, rmSync, readFileSync } from "node:fs";
import { spawn } from "node:child_process";
const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const DATA = join(ROOT, "test/.tmp/views");
rmSync(DATA, { recursive: true, force: true }); mkdirSync(join(DATA, "uploads"), { recursive: true });
process.env.TNL_DATA = DATA;
let pass = 0, fail = 0;
const t = (n, ok) => { ok ? pass++ : fail++; console.log("  " + (ok ? "✓" : "✗") + "  " + n); };

const { db } = await import("../src/db.js");
const now = Date.now(), D = 86400000;
const mk = (u) => { const id = Number(db.prepare(`INSERT INTO users (username, display_name, email, password_hash, created_at, email_verified) VALUES (?,?,?,?,?,1)`).run(u, u, u + "@x.test", "x", now - 60 * D).lastInsertRowid);
  db.prepare(`INSERT INTO sessions (token, user_id, created_at) VALUES (?,?,?)`).run("tok-" + u, id, now); return id; };
const ana = mk("ana"), ben = mk("ben");
const post = (author, body) => Number(db.prepare(`INSERT INTO posts (author_id, channel, body, is_work, image_url, created_at) VALUES (?,?,?,1,'/uploads/a.jpg',?)`).run(author, "creators", body, now - D).lastInsertRowid);
const p1 = post(ana, "one"), p2 = post(ana, "two"), p3 = post(ben, "three");
db.close();

const PORT = 18990 + (process.pid % 9);
const srv = spawn(process.execPath, ["--experimental-sqlite", "src/server.js"], { cwd: ROOT, env: { ...process.env, PORT: String(PORT), TNL_DATA: DATA }, stdio: ["ignore", "pipe", "pipe"] });
let log = ""; srv.stdout.on("data", (d) => log += d); srv.stderr.on("data", (d) => log += d);
for (let i = 0; i < 100 && !/listening/.test(log); i++) await new Promise((r) => setTimeout(r, 100));
const call = async (who, body, device) => {
  const r = await fetch(`http://127.0.0.1:${PORT}/api/views`, { method: "POST", headers: { "Content-Type": "application/json", ...(who ? { Authorization: "Bearer tok-" + who } : {}), ...(device ? { "X-Device": device } : {}) }, body: JSON.stringify(body) });
  let j = {}; try { j = await r.json(); } catch {} return { s: r.status, j };
};
const { DatabaseSync } = await import("node:sqlite");
const rows = () => { const d = new DatabaseSync(join(DATA, "tnl.db"), { readOnly: true }); const r = d.prepare(`SELECT post_id, viewer, day FROM post_views ORDER BY post_id, viewer`).all(); d.close(); return r; };
const DEV = "0123456789abcdef";

try {
  console.log("\nONE ROW PER PIECE, PER VIEWER, PER DAY");
  let r = await call("ben", { ids: [p1, p2] });
  t("a member's views are kept under their id", r.s === 200 && r.j.n === 2 && rows().length === 2 && rows().every((x) => x.viewer === "u:" + ben));
  r = await call("ben", { ids: [p1, p2, p1] });
  t("seeing it again today adds nothing", r.j.n === 0 && rows().length === 2);
  r = await call(null, { ids: [p1] }, DEV);
  t("a stranger's view is kept under their device mark", r.j.n === 1 && rows().some((x) => x.viewer === "d:" + DEV));
  r = await call(null, { ids: [p1] });
  t("no account and no device mark: nothing is kept", r.s === 200 && r.j.n === 0 && rows().length === 3);
  r = await call(null, { ids: [p1] }, "not-a-mark");
  t("a made-up device mark is nothing too", r.j.n === 0 && rows().length === 3);

  console.log("\nTHE AUTHOR, JUNK AND SIZE");
  r = await call("ana", { ids: [p1] });
  t("the author's own look is stored but never counted (the ranking skips 'u:author')", r.j.n === 1 && rows().some((x) => x.viewer === "u:" + ana));
  r = await call("ben", { ids: [999999, "abc", -1, 0, 1.5, null] });
  t("ids that aren't posts, or aren't ids, are dropped", r.s === 200 && r.j.n === 0);
  r = await call("ben", { ids: Array.from({ length: 100 }, (_, i) => i + 1) });
  t("a batch is capped at 40 ids", r.s === 200 && r.j.n <= 40);
  r = await call("ben", { nope: 1 });
  t("no ids: fine, nothing happens", r.s === 200 && r.j.n === 0);
  t("the day is a UTC day number, no time of day", rows().every((x) => x.day === Math.floor(Date.now() / D)));
  t("nothing else is stored: no page, no place, no time", rows().every((x) => Object.keys(x).join() === "post_id,viewer,day"));

  console.log("\nTHE APP SENDS THEM");
  const views = readFileSync(join(ROOT, "src/app/showroom/views.js"), "utf8"), boot = readFileSync(join(ROOT, "src/app/feed/feed-boot.js"), "utf8");
  t("a Showroom card most of the way on screen for a moment is a view", /IntersectionObserver/.test(views) && /intersectionRatio>=0\.5/.test(views) && /1500\)/.test(views));
  t("views go in batches, and what's left goes when the page hides (keepalive)", /setTimeout\(viewFlush,4000\)/.test(views) && /keepalive:true/.test(views) && /pagehide/.test(views));
  t("the feed wires it after every repaint; each card carries its post id", /wireViews\(\)/.test(boot) && /data-pid="\$\{p\.id\}"/.test(readFileSync(join(ROOT, "src/app/showroom/showroom.js"), "utf8")));
  t("the opened post is a view too", /POSTOPEN&&POSTOPEN\.id\)viewMark\(POSTOPEN\.id\)/.test(views));
  t("nothing is shown to the member: no count, no 'seen'", !/innerHTML|textContent|toast\(/.test(views));
} finally { srv.kill(); }

console.log(`\n  ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
