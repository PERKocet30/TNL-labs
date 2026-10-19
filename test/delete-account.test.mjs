// Deleting an account (2026-10-19): "make sure I can delete the account I
// created to test" — "just focus on admin". An admin deletes a member from
// /admin; everything that hangs off the account goes with it. Accounts with
// Market orders are kept (records), and admins can't be deleted this way.
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { rmSync, mkdirSync } from "node:fs";
import bcrypt from "bcryptjs";
const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const DATA = join(ROOT, "test/.tmp/delete-account");
rmSync(DATA, { recursive: true, force: true }); mkdirSync(DATA, { recursive: true });
process.env.TNL_DATA = DATA;
const { db } = await import(join(ROOT, "src/db.js"));
let pass = 0, fail = 0;
const t = (n, ok) => { ok ? pass++ : fail++; console.log("  " + (ok ? "✓" : "✗") + "  " + n); };
const now = Date.now(), hash = bcrypt.hashSync("violet-kiln-27", 4);
const mk = (u, admin = 0) => { const id = Number(db.prepare(`INSERT INTO users (username, display_name, email, password_hash, created_at, email_verified, is_admin) VALUES (?,?,?,?,?,1,?)`).run(u, u, u + "@x.test", hash, now, admin).lastInsertRowid);
  db.prepare(`INSERT INTO sessions (token, user_id, created_at) VALUES (?,?,?)`).run("tok-" + u, id, now); return id; };
const ana = mk("ana"), ben = mk("ben"), cy = mk("cy"), boss = mk("boss", 1), dee = mk("dee");
const post = Number(db.prepare(`INSERT INTO posts (author_id, channel, body, is_work, created_at) VALUES (?, 'general', 'ana piece', 1, ?)`).run(ana, now).lastInsertRowid);
db.prepare(`INSERT INTO posts (author_id, channel, body, is_work, created_at) VALUES (?, 'general', 'ben piece', 1, ?)`).run(ben, now);
db.prepare(`INSERT INTO comments (post_id, author_id, body, created_at) VALUES (?, ?, 'nice', ?)`).run(post, ben, now);
db.prepare(`INSERT INTO follows (follower_id, followee_id, created_at) VALUES (?,?,?)`).run(ana, ben, now);
db.prepare(`INSERT INTO follows (follower_id, followee_id, created_at) VALUES (?,?,?)`).run(ben, ana, now);
const listing = Number(db.prepare(`INSERT INTO listings (seller_id, title, price_cents, created_at, updated_at) VALUES (?, 'tee', 2000, ?, ?)`).run(ben, now, now).lastInsertRowid);
db.prepare(`INSERT INTO orders (listing_id, buyer_id, seller_id, amount_cents, status, created_at, updated_at) VALUES (?,?,?,2000,'complete',?,?)`).run(listing, cy, ben, now, now);
db.close();
const PORT = 8899, B = `http://localhost:${PORT}`;
const srv = spawn(process.execPath, ["--experimental-sqlite", "--no-warnings", "src/server.runtime.js"], {
  cwd: ROOT, env: { ...process.env, TNL_DATA: DATA, PORT: String(PORT), STRIPE_SECRET_KEY: "", TNL_NO_VIDEO_FIX: "1", TNL_NO_WATCH: "1" }, stdio: "ignore" });
const call = async (who, path, method = "GET", body) => { const r = await fetch(B + path, { method, headers: { "Content-Type": "application/json", ...(who ? { Authorization: "Bearer tok-" + who } : {}) }, body: body ? JSON.stringify(body) : undefined });
  return { s: r.status, j: await r.json().catch(() => ({})) }; };
try {
  for (let i = 0; i < 100; i++) { try { if ((await fetch(B + "/api/health")).ok) break; } catch {} await new Promise((r) => setTimeout(r, 100)); }
  console.log("\nADMIN");
  t("a member can't use the admin route", (await call("cy", "/api/admin/members/ben", "DELETE")).s === 403);
  t("an admin can't delete an admin", (await call("boss", "/api/admin/members/boss", "DELETE")).s === 400);
  t("…or someone with orders", (await call("boss", "/api/admin/members/ben", "DELETE")).s === 409);
  const x = await call("boss", "/api/admin/members/cy", "DELETE");
  t("an admin can't delete cy either while cy has an order as a buyer", x.s === 409);
  t("…or a name that isn't there", (await call("boss", "/api/admin/members/nobody", "DELETE")).s === 404);
  const y = await call("boss", "/api/admin/members/ana", "DELETE");
  t("an admin deletes a member", y.s === 200 && (await call("ana", "/api/me")).s === 401 && (await call(null, "/api/users/ana")).s === 404);
  t("their work is gone from the Showroom", !(await call(null, "/api/feed/showroom")).j.posts.some((p) => p.body === "ana piece"));
  t("the people they followed are left whole", (await call(null, "/api/users/ben")).s === 200);
} finally { srv.kill(); }
const { DatabaseSync } = await import("node:sqlite");
const db2 = new DatabaseSync(join(DATA, "tnl.db"));
console.log("\nTHE DATABASE");
t("no rows left behind for the deleted account", ["posts WHERE author_id", "follows WHERE follower_id", "follows WHERE followee_id", "sessions WHERE user_id"].every((w) => db2.prepare(`SELECT COUNT(*) n FROM ${w} = ?`).get(ana).n === 0));
t("everyone else is untouched", db2.prepare(`SELECT COUNT(*) n FROM users`).get().n === 4);
t("the admin's delete is in the admin log", db2.prepare(`SELECT COUNT(*) n FROM admin_log WHERE action = 'delete account' AND target = 'ana'`).get().n === 1);
console.log(`\n  ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
