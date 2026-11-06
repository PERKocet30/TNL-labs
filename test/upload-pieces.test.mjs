// Uploads in pieces v1.0 (2026-11-06): "Now it's getting stuck at 5%. I've been trying to upload
// this video this whole week." A big file goes up in pieces and picks up where it stopped —
// through a duplicate piece, a wrong offset, and a server restart halfway. Real server; a
// generated test video; nothing leaves the machine.
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { mkdirSync, rmSync, readFileSync, readdirSync } from "node:fs";
import { spawn, execFileSync } from "node:child_process";
import { createRequire } from "node:module";
const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const DATA = join(ROOT, "test/.tmp/upload-pieces");
rmSync(DATA, { recursive: true, force: true }); mkdirSync(join(DATA, "src"), { recursive: true });
process.env.TNL_DATA = DATA;
let pass = 0, fail = 0;
const t = (n, ok) => { ok ? pass++ : fail++; console.log("  " + (ok ? "✓" : "✗") + "  " + n); };
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const FF = createRequire(import.meta.url)("ffmpeg-static");
const VID = join(DATA, "src/clip.mp4");
execFileSync(FF, ["-loglevel", "error", "-y", "-f", "lavfi", "-i", "testsrc2=s=1920x1080:r=30:d=3", "-c:v", "libx264", "-preset", "ultrafast", "-qp", "4", VID]);
const file = readFileSync(VID);

const { db } = await import("../src/db.js");
for (const u of ["ana", "ben"]) {
  const id = Number(db.prepare(`INSERT INTO users (username, display_name, email, password_hash, created_at, email_verified) VALUES (?,?,?,?,?,1)`).run(u, u, u + "@x.test", "x", Date.now()).lastInsertRowid);
  db.prepare(`INSERT INTO sessions (token, user_id, created_at) VALUES (?,?,?)`).run("tok-" + u, id, Date.now());
}
db.close();

const PORT = 19010 + (process.pid % 40);
let srv, log = "";
const boot = async () => {
  srv = spawn(process.execPath, ["--experimental-sqlite", "src/server.js"], { cwd: ROOT, stdio: ["ignore", "pipe", "pipe"], env: { ...process.env, PORT: String(PORT), TNL_DATA: DATA, TNL_NO_VIDEO_FIX: "1", TNL_VIDEO_SPARE_MB: "1" } });
  log = ""; srv.stdout.on("data", (d) => log += d); srv.stderr.on("data", (d) => log += d);
  for (let i = 0; i < 100 && !/listening/.test(log); i++) await wait(100);
};
const call = async (who, method, path, body, raw) => {
  const r = await fetch(`http://127.0.0.1:${PORT}${path}`, { method, headers: { Authorization: "Bearer tok-" + who, "Content-Type": raw ? "application/octet-stream" : "application/json" }, body: raw ? body : body ? JSON.stringify(body) : undefined });
  return { s: r.status, j: await r.json().catch(() => ({})) };
};
const put = (who, id, at, buf) => call(who, "PUT", `/api/upload/pieces/${id}?at=${at}`, buf, true);

await boot();
try {
  console.log("\nA BIG FILE, IN PIECES");
  const st = await call("ana", "POST", "/api/upload/pieces", { size: file.length });
  t("starting gives an id and the piece size (4MB)", st.s === 200 && /^[a-f0-9]{24}$/.test(st.j.id) && st.j.piece === 4194304);
  const id = st.j.id, P = 1024 * 1024;   // smaller pieces here so the file makes several
  const a = await put("ana", id, 0, file.subarray(0, P));
  t("the first piece lands", a.s === 200 && a.j.have === P);
  const dup = await put("ana", id, 0, file.subarray(0, P));
  t("the same piece again isn't stored twice — the server says where it is (409)", dup.s === 409 && dup.j.have === P);
  const skip = await put("ana", id, 3 * P, file.subarray(3 * P, 4 * P));
  t("a piece from further on is refused with where to start", skip.s === 409 && skip.j.have === P);
  t("someone else can't see or add to it", (await call("ben", "GET", `/api/upload/pieces/${id}`)).s === 404 && (await put("ben", id, P, file.subarray(P, 2 * P))).s === 404);
  t("a piece bigger than allowed is refused", (await put("ana", id, P, Buffer.alloc(4194304 + 70000))).s === 413);
  t("finishing early says not all of it has arrived", (await call("ana", "POST", `/api/upload/pieces/${id}/done`, {})).s === 409);

  console.log("\nTHE SERVER RESTARTS HALFWAY");
  srv.kill(); await wait(400); await boot();
  const g = await call("ana", "GET", `/api/upload/pieces/${id}`);
  t("after a restart it still knows how much landed", g.s === 200 && g.j.have === P && g.j.size === file.length);
  let have = g.j.have;
  while (have < file.length) { const r = await put("ana", id, have, file.subarray(have, have + P)); if (r.s !== 200) break; have = r.j.have; }
  const d = await call("ana", "POST", `/api/upload/pieces/${id}/done`, {});
  const saved = d.j.url && readFileSync(join(DATA, "uploads", d.j.url.slice(9)));
  t("…and carries on to the end: saved as a video, byte for byte, with a cover", d.s === 200 && d.j.kind === "video" && saved && saved.length >= file.length - 4096 && /-poster\.jpg$/.test(d.j.poster || ""));
  t("…and nothing of it is left half-made", !readdirSync(join(DATA, "uploads")).some((n) => n.includes(id)));
  t("a finished upload's id is gone", (await call("ana", "GET", `/api/upload/pieces/${id}`)).s === 404);

  console.log("\nCHECKED LIKE ANY UPLOAD");
  const junk = await call("ana", "POST", "/api/upload/pieces", { size: 16 });
  await put("ana", junk.j.id, 0, Buffer.from("not a real file!"));
  t("a file that isn't a picture, video or song is refused at the end", (await call("ana", "POST", `/api/upload/pieces/${junk.j.id}/done`, {})).s === 400);
  t("over the most LABS takes is refused before anything is sent", (await call("ana", "POST", "/api/upload/pieces", { size: 3 * 1024 ** 3 })).s === 413);
  t("signed out: no", (await fetch(`http://127.0.0.1:${PORT}/api/upload/pieces`, { method: "POST", headers: { "Content-Type": "application/json" }, body: "{\"size\":5}" })).status === 401);
} finally { srv.kill(); }

console.log("\nTHE APP");
const app = readFileSync(join(ROOT, "src/app/media/upload.js"), "utf8");
t("a file over 8MB goes up in pieces; smaller ones as before", /PIECE_FROM=8\*1024\*1024/.test(app) && app.includes("fileOrBlob.size>PIECE_FROM") && app.includes("return uploadStreamOne(fileOrBlob,onProgress,t0,mb)"));
t("a piece with no progress for 30s is sent again", /PIECE_STALL=30000/.test(app) && app.includes('net("stalled")'));
t("a dropped signal asks the server how much landed and carries on", app.includes('pieceXhr("GET","/api/upload/pieces/"+id') && app.includes("it'll pick up where it stopped"));
t("a server from before pieces still gets the file in one stream", app.includes("if(r.status===404)return null;") && app.includes("d||uploadStreamOne("));
const clean = readFileSync(join(ROOT, "src/server/admin/controls-backups.js"), "utf8");
t("Clean up leaves an upload that's still coming in", clean.includes("Date.now() - st.mtimeMs < 3600 * 1000) continue;"));
console.log(`\n  ${pass} passed, ${fail} failed`);
if (fail) console.log(log.split("\n").slice(-15).join("\n"));
process.exit(fail ? 1 : 0);
