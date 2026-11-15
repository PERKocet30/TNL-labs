// Small breaks from the code audit (2026-11-15): a link with an @ in it stays a link; a listing priced $15 keeps its
// preview title; a suspended account is gone from its public page, the app, search and every feed.
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { mkdirSync, rmSync, readFileSync } from "node:fs";
import { spawn } from "node:child_process";
const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const DATA = join(ROOT, "test/.tmp/small-audit");
rmSync(DATA, { recursive: true, force: true }); mkdirSync(join(DATA, "uploads"), { recursive: true });
process.env.TNL_DATA = DATA;
let pass = 0, fail = 0;
const t = (n, ok) => { ok ? pass++ : fail++; console.log("  " + (ok ? "✓" : "✗") + "  " + n); };
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const R = (f) => readFileSync(join(ROOT, f), "utf8");

console.log("\nA LINK WITH AN @ IN IT — the real rich()");
const api = R("src/app/core/theme-labs-api.js");
const rich = new Function("esc", api.slice(api.indexOf("function rich(t){"), api.indexOf("\n}", api.indexOf("function rich(t){")) + 2) + "\nreturn rich;")(
  (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c])));
const yt = rich("my channel https://www.youtube.com/@jorge and thanks @ana #art");
t("a YouTube profile link stays one working link", yt.includes('href="https://www.youtube.com/@jorge"') && !/href="[^"]*<span/.test(yt));
t("…a mention and a #tag beside it still work", yt.includes('data-u="ana"') && yt.includes('data-tag="art"'));
t("a # inside a link isn't made a tag", !/data-tag="part"/.test(rich("see https://x.com/page #real https://y.com/a #part".replace(" #part", "#part"))) );
t("nothing typed can pose as the placeholder", !rich("\u00000\u0000 hi").includes("<a "));

const { db } = await import("../src/db.js");
const now = Date.now();
const mk = (u, sus = 0) => { const id = Number(db.prepare(`INSERT INTO users (username, display_name, email, password_hash, created_at, email_verified, suspended, bio, stripe_account, stripe_ready) VALUES (?,?,?,?,?,1,?,?,?,1)`).run(u, u, u + "@x.test", "x", now - 30 * 86400000, sus, "makes " + u, "acct_" + u).lastInsertRowid);
  db.prepare(`INSERT INTO sessions (token, user_id, created_at) VALUES (?,?,?)`).run("tok-" + u, id, now); return id; };
const ana = mk("ana"), spam = mk("spammer", 1);
const post = (who, body) => Number(db.prepare(`INSERT INTO posts (author_id, channel, body, image_url, thumb_url, is_work, created_at) VALUES (?, 'graphic-design', ?, '/uploads/a.jpg', '/uploads/a.jpg', 1, ?)`).run(who, body, now).lastInsertRowid);
const good = post(ana, "blue study"), bad = post(spam, "blue pills cheap");
const lid = Number(db.prepare(`INSERT INTO listings (seller_id,title,price_cents,shipping_cents,images,quantity,variants,kind,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?)`).run(ana, "Camo Hoodie", 1500, 0, '["/uploads/a.jpg"]', 1, "[]", "physical", now, now).lastInsertRowid);
db.close();

const PORT = 19300 + (process.pid % 30), B = `http://127.0.0.1:${PORT}`;
const srv = spawn(process.execPath, ["--experimental-sqlite", "src/server.js"], { cwd: ROOT, stdio: ["ignore", "pipe", "pipe"], env: { ...process.env,
  PORT: String(PORT), TNL_DATA: DATA, STRIPE_SECRET_KEY: "", RESEND_API_KEY: "", TNL_NO_WATCH: "1", NUDGE_TICK_MS: "3600000" } });
let log = ""; srv.stdout.on("data", (d) => log += d); srv.stderr.on("data", (d) => log += d);
for (let i = 0; i < 100 && !/listening/.test(log); i++) await wait(100);
const get = async (path, who) => { const r = await fetch(B + path, { headers: who ? { Authorization: "Bearer tok-" + who } : {} }); return { s: r.status, x: await r.text() }; };
const J = (r) => { try { return JSON.parse(r.x); } catch (e) { return {}; } };

try {
  console.log("\nA LISTING PRICED $15");
  const m = await get("/m/" + lid);
  const title = (m.x.match(/<title>([^<]*)<\/title>/) || [])[1] || "";
  t("its page's title is whole — the price isn't read as a code", m.s === 200 && /Camo Hoodie/.test(title) && /\$15/.test(m.x) && !/<title>[^<]*<meta/.test(m.x) && (m.x.match(/<meta charset="utf-8" \/>/g) || []).length === 1);

  console.log("\nA SUSPENDED ACCOUNT IS GONE");
  t("its public page: not found", (await get("/u/spammer")).s === 404 && (await get("/u/ana")).s === 200);
  t("its post's public page: gone", [404, 410].includes((await get("/p/" + bad)).s) && (await get("/p/" + good)).s === 200);
  t("in the app: its profile and its post aren't there", (await get("/api/users/spammer", "ana")).s === 404 && (await get("/api/posts/" + bad, "ana")).s === 404 && (await get("/api/posts/" + good, "ana")).s === 200);
  const s = J(await get("/api/search?q=blue", "ana")), sp = J(await get("/api/search?q=spammer", "ana"));
  t("search finds neither the account nor its posts", s.posts.some((p) => p.id === good) && !s.posts.some((p) => p.id === bad) && !sp.people.some((p) => p.username === "spammer"));
  const lab = J(await get("/api/feed?channel=graphic-design", "ana"));
  t("a lab's feed leaves its posts out", (lab.posts || []).some((p) => p.id === good) && !(lab.posts || []).some((p) => p.id === bad));
} finally { srv.kill(); if (fail) console.log("\n--- server log ---\n" + log.split("\n").slice(-20).join("\n")); }
console.log(`\n  ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
