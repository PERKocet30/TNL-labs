// SECURITY v1.1 — 2026-10-28 (loops are gone: 1 and 4 now check that).
// v1.0 — 2026-10-27. The five holes from the security review, each
// with a check that fails on the old code:
// 1. a beat post could carry code in its BPM and run it in every viewer's app
// 2. "forgot password" handed the reset link to whoever asked when mail failed
// 3. an unpaid order could be marked shipped / received (= counted as paid)
// 4. a paid loop's file went to everyone who looked at the listing
// 5. rate limits believed a CF-Connecting-IP header anyone can type
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { mkdirSync, rmSync, readFileSync, readdirSync, existsSync } from "node:fs";
import { BlockList, isIP } from "node:net";
const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const TMP = join(ROOT, "test", ".tmp", "security");
rmSync(TMP, { recursive: true, force: true }); mkdirSync(TMP, { recursive: true });
process.env.TNL_DATA = TMP;
const { db } = await import(join(ROOT, "src/db.js"));
let pass = 0, fail = 0;
const t = (n, ok) => { ok ? pass++ : fail++; console.log("  " + (ok ? "✓" : "✗") + "  " + n); };
const read = (f) => readFileSync(join(ROOT, "src", f), "utf8");

// The guard part, run on its own (its one import is handed in).
const buckets = new Map();
const guardSrc = read("server/core/guard.js").replace(/^import .*$/m, "");
const loadGuard = (env) => new Function("BlockList", "isIP", "db", "buckets", "process",
  guardSrc + "\nreturn { clientIp, rateLimitBy, mailLinkOk, canShip, canReceive, loopAudio };")(
  BlockList, isIP, db, buckets, { env });
const G = loadGuard({});

console.log("\n1 · NO BEATS IN, NONE OUT (loops are gone, 2026-10-28)");
const feed = read("server/auth/auth-feed.js"), boot = read("server/core/boot.js");
t("a beat in a new post is ignored", /const beat = null;/.test(feed) && !/beat: rawBeat|cleanBeat/.test(feed));
t("old posts never send their beat", /^\s*beat: null,/m.test(boot) && !/JSON\.parse\(row\.beat_json\)/.test(boot));
const { APP: APP_PARTS } = await import("../src/app/order.mjs"), { SERVER: SERVER_PARTS } = await import("../src/server/order.mjs");
const beatUi = [...APP_PARTS.map((f) => "app/" + f), ...SERVER_PARTS.map((f) => "server/" + f), "db.js", "mail.js", "pay.js", "palette.js"]
  .filter((f) => /sr-beat|beatmsg|work-beat|untitled loop|BPM beat|made in the LABS studio/.test(read(f)));
t("no screen or page draws a loop card", beatUi.length === 0 || (console.log("     still in: " + beatUi.join(", ")), false));
t("the Showroom only shows work with a picture or video (both feeds)", /\(!workOnly \|\| r\.image_url \|\| r\.video_url\)/.test(feed)
  && /!hidden\.has\(r\.author_username\) && \(r\.image_url \|\| r\.video_url\)/.test(read("server/posts/collabs-showroom.js")));
t("a card with no media shows its words, not a player", /<div class="sr-txt">\$\{esc\(p\.body\|\|""\)\}<\/div>/.test(read("app/showroom/showroom.js")));

console.log("\n2 · A RESET LINK NEVER GOES TO WHOEVER ASKED");
t("no mail set up, on a laptop → the link is shown (for testing)", G.mailLinkOk({ sent: false, reason: "no_key" }) === true);
t("Resend over its daily limit → not shown", G.mailLinkOk({ sent: false, error: "rate limited by Resend" }) === false);
t("Resend down → not shown", G.mailLinkOk({ sent: false, error: "fetch failed" }) === false);
t("sent → not shown", G.mailLinkOk({ sent: true }) === false);
const live = loadGuard({ RAILWAY_ENVIRONMENT_NAME: "production" });
t("on Railway, never — even with no mail key", live.mailLinkOk({ sent: false, reason: "no_key" }) === false);
const forgot = read("server/uploads/upload-dm-notifications.js");
t("forgot password answers like 'no such account' unless the link may be shown",
  /res\.json\(mailLinkOk\(mail\) \? \{ ok: true, resetUrl: url \} : \{ ok: true \}\)/.test(forgot) && !/resetUrl: mail\.sent \? undefined/.test(forgot));
t("confirm-email links follow the same rule", /url: mailLinkOk\(result\) \? url : undefined/.test(feed));
t("forgot password is also limited per email address", /api\/auth\/forgot", rateLimit\([^)]*\), rateLimitBy\(/.test(forgot));

console.log("\n3 · AN ORDER MOVES ONLY AFTER IT'S PAID");
t("paid → can ship", G.canShip({ status: "paid", payment_ref: "cs_1" }));
t("Stripe order still waiting for money → can't ship", !G.canShip({ status: "pending", payment_ref: "cs_1" }));
t("arrange-mode (no Stripe) → seller can ship", G.canShip({ status: "pending", payment_ref: "" }) && G.canShip({ status: "pending", payment_ref: null }));
t("cancelled / void / complete → can't ship", !G.canShip({ status: "cancelled" }) && !G.canShip({ status: "void" }) && !G.canShip({ status: "complete" }));
t("received only after paid or shipped", G.canReceive({ status: "shipped" }) && G.canReceive({ status: "paid" }) && !G.canReceive({ status: "pending" }) && !G.canReceive({ status: "cancelled" }));

// The real /ship and /received handlers, run against the database.
const now = Date.now();
const U = (n, admin = 0) => Number(db.prepare(`INSERT INTO users (username,display_name,email,role,password_hash,email_verified,rep,is_admin,created_at) VALUES (?,?,?,?,?,1,0,?,?)`).run(n, n, n + "@x.test", "Model", "h", admin, now).lastInsertRowid);
const seller = U("seller"), buyer = U("buyer"), stranger = U("stranger"), boss = U("boss", 1);
const lid = Number(db.prepare(`INSERT INTO listings (seller_id,title,price_cents,images,created_at,updated_at) VALUES (?,?,?,?,?,?)`).run(seller, "Tee", 2000, "[]", now, now).lastInsertRowid);
const O = (status, ref) => Number(db.prepare(`INSERT INTO orders (listing_id,buyer_id,seller_id,amount_cents,shipping_cents,status,payment_ref,created_at,updated_at) VALUES (?,?,?,2000,0,?,?,?,?)`).run(lid, buyer, seller, status, ref, now, now).lastInsertRowid);
const orders = read("server/orders/orders-sharing.js");
const from = orders.indexOf(`app.post("/api/orders/:id/ship"`), to = orders.indexOf("\n});\n", orders.indexOf(`app.post("/api/orders/:id/received"`)) + 5;
const routes = {}, rep = [];
new Function("app", "auth", "db", "notify", "awardRep", "canShip", "canReceive", orders.slice(from, to))(
  { post: (p, ...h) => { routes[p] = h.at(-1); } }, null, db, () => {}, (...a) => rep.push(a), G.canShip, G.canReceive);
const hit = (path, id, uid) => { let code = 200, out; routes[path]({ params: { id: String(id) }, user: { id: uid }, body: {} },
  { status: (c) => { code = c; return { json: (x) => { out = x; } }; }, json: (x) => { out = x; } }); return { code, out }; };
const st = (id) => db.prepare(`SELECT status FROM orders WHERE id=?`).get(id).status;
const unpaid = O("pending", "cs_unpaid");
t("buyer can't mark an unpaid order received", hit("/api/orders/:id/received", unpaid, buyer).code === 400 && st(unpaid) === "pending");
t("seller can't mark an unpaid order shipped", hit("/api/orders/:id/ship", unpaid, seller).code === 400 && st(unpaid) === "pending");
t("…so no free rep either", rep.length === 0);
const paid = O("paid", "cs_paid");
t("a paid order ships", hit("/api/orders/:id/ship", paid, seller).code === 200 && st(paid) === "shipped");
t("and is received", hit("/api/orders/:id/received", paid, buyer).code === 200 && st(paid) === "complete" && rep.some((a) => a[1] === "delivery_confirmed"));
t("receiving twice is harmless", hit("/api/orders/:id/received", paid, buyer).code === 200 && rep.filter((a) => a[1] === "delivery_confirmed").length === 1);
const arrange = O("pending", "");
t("arrange-mode still works: ship, then received", hit("/api/orders/:id/ship", arrange, seller).code === 200 && hit("/api/orders/:id/received", arrange, buyer).code === 200 && st(arrange) === "complete");
t("someone else's order: still refused", hit("/api/orders/:id/ship", O("paid", "cs_2"), stranger).code === 403);
t("the seller's button only shows when shipping is allowed", /canShip: canShip\(r\)/.test(orders) && /ORDTAB==="selling"&&o\.canShip/.test(read("app/market/detail-sell.js")));
t("the test-order guard is untouched (order-void suite)", (orders.match(/if \(o\.status === "void"\) return res\.status\(400\)/g) || []).length === 2);

console.log("\n4 · NO LOOPS IN THE MARKET (2026-10-28)");
const L = (price) => db.prepare(`SELECT * FROM listings WHERE id=?`).get(Number(db.prepare(`INSERT INTO listings (seller_id,title,price_cents,images,kind,audio_url,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?)`).run(seller, "loop", price, "[]", "loop", "/uploads/k-1.wav", now, now).lastInsertRowid));
const paidLoop = L(500), freeLoop = L(0);
t("an old loop's file goes to nobody", G.loopAudio(paidLoop).audioUrl === null && G.loopAudio(freeLoop).audioUrl === null);
t("other listings keep their file", G.loopAudio({ kind: "physical", audio_url: "/uploads/x.mp3" }).audioUrl === "/uploads/x.mp3");
const mk = read("server/admin/settings-payouts-market.js");
t("a new loop listing is refused", /if \(body\.kind === "loop"\) return res\.status\(400\)/.test(mk));
t("the market never lists one", /`l\.kind != 'loop'`/.test(mk));
t("and a loop's own page is gone", /if \(!r \|\| r\.kind === "loop"\) return res\.status\(404\)/.test(mk));
t("listings use loopAudio", /\.\.\.loopAudio\(r, viewerId\)/.test(mk) && !/audioUrl: r\.audio_url/.test(mk));
t("the preview route is gone", !existsSync(join(ROOT, "src/server/posts/loop-preview.js")) && !/\/api\/loops\/[^"]*preview/.test(readFileSync(join(ROOT, "src/server.runtime.js"), "utf8")));

console.log("\n5 · RATE LIMITS KNOW WHO'S REALLY ASKING");
const req = (h, sock = "10.0.0.5") => ({ get: (k) => h[k.toLowerCase()], socket: { remoteAddress: sock } });
t("straight to Railway with a made-up CF header → the real address", G.clientIp(req({ "cf-connecting-ip": "6.6.6.6", "x-real-ip": "203.0.113.9" })) === "203.0.113.9");
t("through Cloudflare (IPv4) → the visitor Cloudflare names", G.clientIp(req({ "cf-connecting-ip": "198.51.100.7", "x-real-ip": "104.16.3.4" })) === "198.51.100.7");
t("through Cloudflare (IPv6) → the same", G.clientIp(req({ "cf-connecting-ip": "198.51.100.7", "x-real-ip": "2606:4700::1" })) === "198.51.100.7");
t("no X-Real-IP: the last hop Railway added wins over a typed one", G.clientIp(req({ "cf-connecting-ip": "6.6.6.6", "x-forwarded-for": "1.1.1.1, 203.0.113.9" })) === "203.0.113.9");
t("a laptop / the tests: the header is believed", G.clientIp(req({ "cf-connecting-ip": "10.9.0.1" }, "::ffff:127.0.0.1")) === "10.9.0.1");
t("a typed CF header is capped (it's only ever a lookup key)", G.clientIp(req({ "cf-connecting-ip": "x".repeat(500) }, "127.0.0.1")).length === 64);
t("the rate limiter and the bot signals both use it", /const ip = clientIp\(req\)/.test(boot) && /const sigIp = \(req\) => clientIp\(req\)/.test(read("server/trust/signals.js")));
const lim = G.rateLimitBy((r) => r.body.identifier, { max: 10, windowMs: 60000 });
const tryAs = (who) => { let code = 0; lim({ body: { identifier: who }, path: "/api/auth/login" }, { set: () => {}, status: (c) => { code = c; return { json: () => {} }; } }, () => { code = 200; }); return code; };
const codes = Array.from({ length: 11 }, () => tryAs("Jorge"));
t("one account: 10 tries, then wait — whatever address they come from", codes.slice(0, 10).every((c) => c === 200) && codes[10] === 429);
t("…case doesn't dodge it", tryAs("JORGE") === 429);
t("…other accounts aren't affected", tryAs("kenzuu") === 200);
t("login uses it", /api\/auth\/login", rateLimit\([^)]*\),\s*rateLimitBy\(/.test(feed));

console.log(`\n  ${pass} passed, ${fail} failed`);
