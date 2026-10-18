// ORDER SETTLE v1.0 — 2026-10-18 ("seamless payments"). A buyer who pays and
// never comes back (closed tab, Instagram's browser) still gets their order
// settled — in the background, every 5 minutes, through the same guarded
// path as the checkout return. After paying, the buyer lands on that
// order (?checkout=paid&o=); a payment still clearing isn't called failed.
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { mkdirSync, rmSync, readFileSync } from "node:fs";
import { randomBytes } from "node:crypto";
const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const TMP = join(ROOT, "test", ".tmp", "order-settle");
rmSync(TMP, { recursive: true, force: true }); mkdirSync(TMP, { recursive: true });
process.env.TNL_DATA = TMP;
const { db } = await import(ROOT + "/src/db.js");
let pass = 0, fail = 0;
const t = (n, ok) => { ok ? pass++ : fail++; console.log("  " + (ok ? "✓" : "✗") + "  " + n); };

const now = Date.now();
const U = (n, ready = 0) => Number(db.prepare(`INSERT INTO users (username,display_name,email,role,password_hash,email_verified,stripe_account,stripe_ready,rep,created_at) VALUES (?,?,?,?,?,1,?,?,0,?)`)
  .run(n, n, n + "@x.com", "Model", "h", ready ? "acct_" + n : "", ready, now).lastInsertRowid);
const seller = U("seller", 1), buyer = U("buyer");
const L = (title, price, ship, qty = 1) => Number(db.prepare(
  `INSERT INTO listings (seller_id,title,price_cents,shipping_cents,images,quantity,variants,kind,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?)`)
  .run(seller, title, price, ship, '["/u/a.jpg"]', qty, "[]", "physical", now, now).lastInsertRowid);
const O = (lid, amt, ship, ref, ageMin, checkedMin = ageMin) => Number(db.prepare(
  `INSERT INTO orders (listing_id,buyer_id,seller_id,amount_cents,shipping_cents,payment_ref,status,created_at,updated_at) VALUES (?,?,?,?,?,?,'pending',?,?)`)
  .run(lid, buyer, seller, amt, ship, ref, now - ageMin * 60000, now - checkedMin * 60000).lastInsertRowid);

// Stripe, as the server would see it: session id → what verifySession says
const SESS = {}, asked = [];
const verifySession = async (sid) => { asked.push(sid); return SESS[sid] || { paid: false, clearing: false }; };
const q = { userById: db.prepare(`SELECT * FROM users WHERE id = ?`) };
const told = [], rep = [], routes = {}, timers = [];
const read = (f) => readFileSync(join(ROOT, "src", f), "utf8");
const os = read("server-07-orders-sharing.js");
const part = os.slice(os.indexOf('app.get("/api/market/checkout/done"'), os.indexOf("\n", os.indexOf("setInterval(() => { reconcileAll()")) + 1);
const X = new Function("db", "randomBytes", "q", "notify", "app", "auth", "verified", "maybeAuth", "rateLimit", "baseUrl", "feeForRep",
  "createCheckout", "verifySession", "awardRep", "LISTING_SELECT", "shapeListings", "PAYMENTS_ENABLED", "setInterval",
  read("server-06-market-stock.js") + "\n" + read("server-07-cart.js") + "\n" + part + "\nreturn {reconcileAll, reconcileOrders, settlePaidOrder};")(
  db, randomBytes, q, (...a) => told.push(a),
  { post: (p, ...h) => { routes["POST " + p] = h.at(-1); }, get: (p, ...h) => { routes["GET " + p] = h.at(-1); } },
  null, null, null, () => null, () => "https://x", () => 10, async () => ({}), verifySession,
  (...a) => rep.push(a), "", (r) => r, true, (fn, ms) => { timers.push({ fn, ms }); return { unref() {} }; });

const status = (id) => db.prepare(`SELECT status FROM orders WHERE id=?`).get(id).status;
const tee = L("Tee", 5000, 800, 3), cap = L("Cap", 3000, 0, 1);

console.log("\nIN THE BACKGROUND");
t("a background check is scheduled every 5 minutes", timers.length === 1 && timers[0].ms === 300000);
const paidGone = O(tee, 5000, 800, "cs_paid", 10);
SESS.cs_paid = { paid: true, orderId: String(paidGone), amount: 5800, ship: { name: "B", address: "1 St" } };
const fresh = O(tee, 5000, 800, "cs_fresh", 2);           // still on Stripe's page
SESS.cs_fresh = { paid: true, orderId: String(fresh), amount: 5800 };
const abandoned = O(cap, 3000, 0, "cs_gone", 26 * 60);    // never paid, a day old
const clearing = O(cap, 3000, 0, "cs_clear", 26 * 60);    // a bank payment, a day in
SESS.cs_clear = { paid: false, clearing: true };
const wrong = O(cap, 3000, 0, "cs_wrong", 10);            // a paid session that isn't this order's
SESS.cs_wrong = { paid: true, orderId: "999", amount: 3000 };
await timers[0].fn(); await new Promise((r) => setTimeout(r, 50));
t("paid and never came back: settled without anyone opening orders", status(paidGone) === "paid");
t("…the seller is told to ship and earns the sale's rep", told.some((a) => a[0] === seller && /ship it/.test(a[4])) && rep.some((a) => a[0] === seller && a[1] === "sale_made"));
t("…the address the buyer gave Stripe is kept", db.prepare(`SELECT ship_address FROM orders WHERE id=?`).get(paidGone).ship_address === "1 St");
t("…one unit leaves the stock", db.prepare(`SELECT quantity FROM listings WHERE id=?`).get(tee).quantity === 2);
t("someone still on Stripe's page isn't asked about yet (5-minute grace)", status(fresh) === "pending" && !asked.includes("cs_fresh"));
t("unpaid past a checkout's life: cancelled", status(abandoned) === "cancelled");
t("still clearing a day later: kept (bank payments take days)", status(clearing) === "pending");
t("a paid session that names another order changes nothing", status(wrong) === "pending");
asked.length = 0; await timers[0].fn();
t("each order is asked about at most every 5 minutes", !asked.includes("cs_clear") && !asked.includes("cs_wrong"));
t("settling twice is impossible", rep.filter((a) => a[2] === paidGone).length === 1);

console.log("\nTHE WAY BACK FROM STRIPE");
const back = O(cap, 3000, 0, "cs_back", 1);
SESS.cs_back = { paid: true, orderId: String(back), amount: 3000 };
let to = null; const res = { redirect: (u) => { to = u; } };
await routes["GET /api/market/checkout/done"]({ query: { session_id: "cs_back", o: String(back) } }, res);
t("paid: lands on that order's confirmation", to === `/?checkout=paid&o=${back}` && status(back) === "paid");
const slow = O(tee, 5000, 800, "cs_slow", 1);
SESS.cs_slow = { paid: false, clearing: true };
await routes["GET /api/market/checkout/done"]({ query: { session_id: "cs_slow", o: String(slow) } }, res);
t("still clearing: says processing, not failed", to === `/?checkout=processing&o=${slow}` && status(slow) === "pending");
await routes["GET /api/market/checkout/done"]({ query: { session_id: "cs_nope", o: String(slow) } }, res);
t("not paid: failed", to === "/?checkout=failed");

console.log("\nIN THE APP");
const app = read("app-17-order-done.js"), boot = read("app-19-feed-boot.js"), router = read("app-13-tracks-player.js");
t("the return opens Order confirmed for that order", boot.includes('if(p.get("o"))orderDoneOpen(p.get("o"),st)') && router.includes('if(MKTVIEW==="confirmed")return orderDoneHTML();'));
t("it shows what was bought, the total, where it's going and what's next", ["Subtotal", "Shipping", "Total", "Shipping to", "What happens next", "View order", "Keep shopping"].every((w) => app.includes(w)));
t("a bag shows every item (orders carry their bag id)", app.includes("o.cart===DONEID") && os.includes("cart: r.cart_id || r.id"));
t("clearing has its own words", app.includes("Payment processing"));
console.log(`\n  ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
