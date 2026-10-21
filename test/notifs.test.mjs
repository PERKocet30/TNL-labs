// Notifications (2026-10-12): "When someone likes your work
// it doesn't take you directly to the post" → "Notifications should work like
// Instagram." Rows carry the picture of what they're about and where they
// lead; likes on one post group; new followers get Follow back.
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { rmSync, mkdirSync, readFileSync } from "node:fs";
const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const DATA = join(ROOT, "test/.tmp/notifs");
rmSync(DATA, { recursive: true, force: true }); mkdirSync(DATA, { recursive: true });
process.env.TNL_DATA = DATA;
const { db, notify } = await import(join(ROOT, "src/db.js"));
const now = Date.now();
const U = (n) => { const id = Number(db.prepare(`INSERT INTO users (username, display_name, email, password_hash, created_at, email_verified) VALUES (?,?,?,?,?,1)`)
  .run(n, n[0].toUpperCase() + n.slice(1), n + "@x.com", "h", now).lastInsertRowid); db.prepare(`INSERT INTO sessions (token, user_id, created_at) VALUES (?,?,?)`).run("tok-" + n, id, now); return id; };
const me = U("me"), a = U("ana"), b = U("ben"), c = U("cy");
const post = Number(db.prepare(`INSERT INTO posts (author_id, channel, body, image_url, thumb_url, is_work, created_at) VALUES (?, 'general', 'piece', '/uploads/p.jpg', '/uploads/p-t.jpg', 1, ?)`).run(me, now).lastInsertRowid);
const listing = Number(db.prepare(`INSERT INTO listings (seller_id, title, price_cents, images, created_at, updated_at) VALUES (?, 'Tee', 4000, '["/uploads/tee.jpg"]', ?, ?)`).run(me, now, now).lastInsertRowid);
for (const who of [a, b, c]) notify(me, who, "like", post, "");
notify(me, a, "follow", null, "followed you");
notify(me, b, "listing_like", null, `liked "Tee"`, listing);
notify(me, c, "comment", post, "LEST GO!!");

let pass = 0, fail = 0;
const t = (n, ok) => { ok ? pass++ : fail++; console.log("  " + (ok ? "✓" : "✗") + "  " + n); };
const PORT = 8868, B = `http://localhost:${PORT}`;
const srv = spawn(process.execPath, ["--experimental-sqlite", "--no-warnings", "src/server.runtime.js"], {
  cwd: ROOT, env: { ...process.env, TNL_DATA: DATA, PORT: String(PORT), STRIPE_SECRET_KEY: "", TNL_NO_VIDEO_FIX: "1", TNL_NO_WATCH: "1" }, stdio: "ignore" });
const get = async () => (await (await fetch(B + "/api/notifications", { headers: { Authorization: "Bearer tok-me" } })).json()).notifications;
try {
  for (let i = 0; i < 100; i++) { try { if ((await fetch(B + "/api/health")).ok) break; } catch {} await new Promise((r) => setTimeout(r, 100)); }
  console.log("\nWHAT THE SERVER SENDS");
  let N = await get();
  const like = N.find((n) => n.kind === "like"), ll = N.find((n) => n.kind === "listing_like"), fol = N.find((n) => n.kind === "follow");
  t("a like carries the post and its picture", like && like.postId === post && like.thumb === "/uploads/p-t.jpg");
  t("a shop like carries the listing and its first photo", ll && ll.listingId === listing && ll.thumb === "/uploads/tee.jpg");
  t("a new follower says whether you follow back", fol && fol.actor.youFollow === false);
  await fetch(`${B}/api/users/ana/follow`, { method: "POST", headers: { Authorization: "Bearer tok-me" } });
  N = await get();
  t("…and after Follow back, that you do", N.find((n) => n.kind === "follow").actor.youFollow === true);

  console.log("\nHOW THE APP SHOWS THEM");
  const src = readFileSync(join(ROOT, "src/app-17-notifs.js"), "utf8");
  const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[ch]));
  const avHTML = (u) => `<i class="av">${u.displayName}</i>`;
  const screenHead = (o) => `<div class="sh"><h2>${o.title}</h2></div>`;   // the kit's head (app-08-kit.js), 2026-10-20
  const K = new Function("esc", "avHTML", "DI", "skel", "NOTIFS", "screenHead", src + "\nreturn {nfRows, nfRowHTML, nfText, notifPanelHTML};")(esc, avHTML, { x: "x" }, () => "", N, screenHead);
  const rows = K.nfRows(N);
  const likes = rows.filter((r) => r.n.kind === "like");
  t("three likes on one post are one row", likes.length === 1 && likes[0].people.length === 3);
  const html = K.notifPanelHTML();
  t("…\"Cy, Ben and 1 other liked your post.\"", /<b data-u="cy">Cy<\/b>, <b data-u="ben">Ben<\/b> and 1 other liked your post\./.test(html));
  t("rows sit under sections", /<div class="nf-sec">New<\/div>/.test(html));
  t("the post's picture is on the right of the like", html.includes('<img class="nf-th" src="/uploads/p-t.jpg"'));
  t("a comment shows what they said", html.includes("commented: LEST GO!!"));
  t("a shop like reads as a sentence, never a code", html.includes('liked &quot;Tee&quot;.') && !html.includes("listing_like"));
  t("a follower you follow back shows Following", html.includes(">Following</button>"));
  t("times are short (now / 3m / 2h / 4d / 1w)", /<span class="nf-ago">now<\/span>/.test(html));
} finally { srv.kill(); }
console.log(`\n  ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
