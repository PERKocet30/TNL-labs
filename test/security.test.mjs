// SECURITY v1.0 — 2026-10-27. The five holes from the security review, each
// with a check that fails on the old code:
// 1. a beat post could carry code in its BPM and run it in every viewer's app
// 2. "forgot password" handed the reset link to whoever asked when mail failed
// 3. an unpaid order could be marked shipped / received (= counted as paid)
// 4. a paid loop's file went to everyone who looked at the listing
// 5. rate limits believed a CF-Connecting-IP header anyone can type
import { fileURLToPath } from "node:url";
import { dirname, join, resolve } from "node:path";
import { mkdirSync, rmSync, readFileSync, readdirSync } from "node:fs";
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
const guardSrc = read("server-01-guard.js").replace(/^import .*$/m, "");
const loadGuard = (env) => new Function("BlockList", "isIP", "db", "buckets", "process", "pathResolve",
  guardSrc + "\nreturn { clientIp, rateLimitBy, cleanBeat, mailLinkOk, canShip, canReceive, loopAudio };")(
  BlockList, isIP, db, buckets, { env }, resolve);
const G = loadGuard({});

console.log("\n1 · BEATS CARRY A NUMBER, NOT CODE");
const evil = "<img src=x onerror=alert(1)>";
let b = G.cleanBeat({ name: "x", bpm: evil, data: { tracks: [] }, remixOf: { postId: "7", username: "kenzuu", name: "og", extra: evil }, script: evil });
t("a BPM that isn't a number becomes 120", b.bpm === 120);
t("anything outside { name, bpm, data, remixOf } is dropped", !("script" in b) && !("extra" in b.remixOf));
t("the remix link keeps a numeric post id", b.remixOf.postId === 7 && b.remixOf.username === "kenzuu");
t("a real BPM survives", G.cleanBeat({ bpm: 140 }).bpm === 140 && G.cleanBeat({ bpm: "92.4" }).bpm === 92);
t("out-of-range BPM is reset", G.cleanBeat({ bpm: 9999 }).bpm === 120 && G.cleanBeat({ bpm: -5 }).bpm === 120);
t("names are capped at 60", G.cleanBeat({ name: "a".repeat(500) }).name.length === 60);
t("not an object → no beat", G.cleanBeat("hi") === null && G.cleanBeat([1]) === null && G.cleanBeat(null) === null);
const feed = read("server-02-auth-feed.js"), boot = read("server-01-boot.js");
t("posting cleans the beat before it's saved", /const beat = cleanBeat\(rawBeat\)/.test(feed));
t("reading cleans it too, so older posts are safe", /cleanBeat\(JSON\.parse\(row\.beat_json\)\)/.test(boot));
const raw = readdirSync(join(ROOT, "src")).filter((f) => /\.(js|html)$/.test(f)).filter((f) => /\$\{p\.beat\??\.bpm\}|\$\{p\.beat\??\.bpm\|\|/.test(read(f)));
t("no page prints a BPM without Number()", raw.length === 0 || (console.log("     raw in: " + raw.join(", ")), false));

console.log("\n2 · A RESET LINK NEVER GOES TO WHOEVER ASKED");
t("no mail set up, on a laptop → the link is shown (for testing)", G.mailLinkOk({ sent: false, reason: "no_key" }) === true);
t("Resend over its daily limit → not shown", G.mailLinkOk({ sent: false, error: "rate limited by Resend" }) === false);
t("Resend down → not shown", G.mailLinkOk({ sent: false, error: "fetch failed" }) === false);
t("sent → not shown", G.mailLinkOk({ sent: true }) === false);
const live = loadGuard({ RAILWAY_ENVIRONMENT_NAME: "production" });
t("on Railway, never — even with no mail key", live.mailLinkOk({ sent: false, reason: "no_key" }) === false);
const forgot = read("server-03-upload-dm-notifications.js");
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
const orders = read("server-07-orders-sharing.js");
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
t("the seller's button only shows when shipping is allowed", /canShip: canShip\(r\)/.test(orders) && /ORDTAB==="selling"&&o\.canShip/.test(read("app-14-detail-sell.js")));
t("the test-order guard is untouched (order-void suite)", (orders.match(/if \(o\.status === "void"\) return res\.status\(400\)/g) || []).length === 2);

console.log("\n4 · A PAID LOOP'S FILE ONLY REACHES ITS BUYERS");
const L = (price) => db.prepare(`SELECT * FROM listings WHERE id=?`).get(Number(db.prepare(`INSERT INTO listings (seller_id,title,price_cents,images,kind,audio_url,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?)`).run(seller, "loop", price, "[]", "loop", "/uploads/k-1.wav", now, now).lastInsertRowid));
const paidLoop = L(500), freeLoop = L(0);
t("a stranger gets the preview, not the file", G.loopAudio(paidLoop, stranger).audioUrl === null && G.loopAudio(paidLoop, stranger).previewUrl === `/api/market/${paidLoop.id}/preview.mp3`);
t("a guest too", G.loopAudio(paidLoop, undefined).audioUrl === null);
t("the seller gets the file", G.loopAudio(paidLoop, seller).audioUrl === "/uploads/k-1.wav");
t("an admin gets the file", G.loopAudio(paidLoop, boss).audioUrl === "/uploads/k-1.wav");
db.prepare(`INSERT INTO orders (listing_id,buyer_id,seller_id,amount_cents,shipping_cents,status,payment_ref,created_at,updated_at) VALUES (?,?,?,500,0,'pending','cs_l',?,?)`).run(paidLoop.id, buyer, seller, now, now);
t("an unpaid order doesn't unlock it", G.loopAudio(paidLoop, buyer).audioUrl === null);
db.prepare(`UPDATE orders SET status='paid' WHERE listing_id=?`).run(paidLoop.id);
t("a paid one does", G.loopAudio(paidLoop, buyer).audioUrl === "/uploads/k-1.wav");
t("free loops: the file for everyone, as before", G.loopAudio(freeLoop, undefined).audioUrl === "/uploads/k-1.wav");
t("listings use it", /\.\.\.loopAudio\(r, viewerId\)/.test(read("server-06-settings-payouts-market.js")) && !/audioUrl: r\.audio_url/.test(read("server-06-settings-payouts-market.js")));
const pv = read("server-08-loop-preview.js");
t("the preview is cut by ffmpeg with an argument list (no shell)", /execFile\(FFMPEG, \[/.test(pv) && !/exec\(/.test(pv));
t("…from a checked upload name only", /\^\\\/uploads\\\/\(\[A-Za-z0-9\._-\]\+\)\$/.test(pv));
t("the player falls back to the preview", /l\.audioUrl\|\|l\.previewUrl/.test(read("app-13-tracks-player.js")));

console.log("\n5 · RATE LIMITS KNOW WHO'S REALLY ASKING");
const req = (h, sock = "10.0.0.5") => ({ get: (k) => h[k.toLowerCase()], socket: { remoteAddress: sock } });
t("straight to Railway with a made-up CF header → the real address", G.clientIp(req({ "cf-connecting-ip": "6.6.6.6", "x-real-ip": "203.0.113.9" })) === "203.0.113.9");
t("through Cloudflare (IPv4) → the visitor Cloudflare names", G.clientIp(req({ "cf-connecting-ip": "198.51.100.7", "x-real-ip": "104.16.3.4" })) === "198.51.100.7");
t("through Cloudflare (IPv6) → the same", G.clientIp(req({ "cf-connecting-ip": "198.51.100.7", "x-real-ip": "2606:4700::1" })) === "198.51.100.7");
t("no X-Real-IP: the last hop Railway added wins over a typed one", G.clientIp(req({ "cf-connecting-ip": "6.6.6.6", "x-forwarded-for": "1.1.1.1, 203.0.113.9" })) === "203.0.113.9");
t("a laptop / the tests: the header is believed", G.clientIp(req({ "cf-connecting-ip": "10.9.0.1" }, "::ffff:127.0.0.1")) === "10.9.0.1");
t("garbage in the CF header is ignored", G.clientIp(req({ "cf-connecting-ip": "<script>", "x-real-ip": "104.16.3.4" })) === "104.16.3.4");
t("the rate limiter and the bot signals both use it", /const ip = clientIp\(req\)/.test(boot) && /const sigIp = \(req\) => clientIp\(req\)/.test(read("server-01-signals.js")));
const lim = G.rateLimitBy((r) => r.body.identifier, { max: 10, windowMs: 60000 });
const tryAs = (who) => { let code = 0; lim({ body: { identifier: who }, path: "/api/auth/login" }, { set: () => {}, status: (c) => { code = c; return { json: () => {} }; } }, () => { code = 200; }); return code; };
const codes = Array.from({ length: 11 }, () => tryAs("Jorge"));
t("one account: 10 tries, then wait — whatever address they come from", codes.slice(0, 10).every((c) => c === 200) && codes[10] === 429);
t("…case doesn't dodge it", tryAs("JORGE") === 429);
t("…other accounts aren't affected", tryAs("kenzuu") === 200);
t("login uses it", /api\/auth\/login", rateLimit\([^)]*\),\s*rateLimitBy\(/.test(feed));

console.log(`\n  ${pass} passed, ${fail} failed`);
