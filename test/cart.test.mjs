// The bag (2026-09-30): several items from one seller, one payment,
// shipping combined; the paid session must match the whole group. Plus
// price drops.
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { mkdirSync, rmSync, readFileSync } from "node:fs";
import { randomBytes } from "node:crypto";
const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const TMP = join(ROOT, "test", ".tmp", "cart");
rmSync(TMP, { recursive: true, force: true });
mkdirSync(TMP, { recursive: true });
process.env.TNL_DATA = TMP;
const { db } = await import(ROOT + "/src/db.js");
let pass = 0, fail = 0;
const t = (n, ok) => { ok ? pass++ : fail++; console.log("  " + (ok ? "✓" : "✗") + "  " + n); };

const now = Date.now();
const U = (n, ready = 0) => Number(db.prepare(`INSERT INTO users (username,display_name,email,role,password_hash,email_verified,stripe_account,stripe_ready,rep,created_at) VALUES (?,?,?,?,?,1,?,?,0,?)`)
  .run(n, n, n + "@x.com", "Model", "h", ready ? "acct_" + n : "", ready, now).lastInsertRowid);
const seller = U("seller", 1), other = U("other", 1), buyer = U("buyer");
const L = (sid, title, price, ship, variants = [], qty = 1, kind = "physical") => Number(db.prepare(
  `INSERT INTO listings (seller_id,title,price_cents,shipping_cents,images,quantity,variants,kind,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?)`)
  .run(sid, title, price, ship, '["/u/a.jpg"]', qty, JSON.stringify(variants), kind, now, now).lastInsertRowid);
const tee = L(seller, "Tee", 5000, 800, [{ id: "m", size: "M", colour: "", qty: 2 }, { id: "l", size: "L", colour: "", qty: 0 }], 2);
const cap = L(seller, "Cap", 3000, 1200);
const mug = L(other, "Mug", 2000, 500);
const loop = L(seller, "Loop", 1000, 0, [], 1, "loop");

const q = { userById: db.prepare(`SELECT * FROM users WHERE id = ?`) };
const told = [], routes = {};
let PAYMENTS_ENABLED = false, lastCheckout = null;
const stock = readFileSync(join(ROOT, "src/server-06-market-stock.js"), "utf8");
const cart = readFileSync(join(ROOT, "src/server-07-cart.js"), "utf8");
const LISTING_SELECT = `SELECT l.*, u.username AS seller_username FROM listings l JOIN users u ON u.id = l.seller_id`;
const X = new Function("db", "randomBytes", "q", "notify", "app", "auth", "verified", "maybeAuth", "rateLimit", "baseUrl", "feeForRep", "createCheckout", "LISTING_SELECT", "shapeListings", "getPay",
  stock + "\n" + cart.replace(/PAYMENTS_ENABLED/g, "getPay()") + "\nreturn {orderGroup,sessionFits,groupTotal,priceChanged,priceDrop,takeStock};")(
  db, randomBytes, q, (...a) => told.push(a),
  { post: (p, ...h) => { routes["POST " + p] = h.at(-1); }, get: (p, ...h) => { routes["GET " + p] = h.at(-1); } },
  null, null, null, () => null, () => "https://x", () => 10,
  async (o) => { lastCheckout = o; return { url: "https://stripe/x", id: "cs_" + o.orderId }; }, LISTING_SELECT, (r) => r, () => PAYMENTS_ENABLED);
const checkout = async (items, user = buyer) => { let out, code = 200;
  await routes["POST /api/cart/checkout"]({ body: { items }, user: q.userById.get(user) },
    { json: (o) => (out = o), status: (s) => { code = s; return { json: (o) => (out = o) }; } });
  return { code, out }; };
const orders = (cartId) => db.prepare(`SELECT * FROM orders WHERE cart_id = ? ORDER BY id`).all(cartId);

console.log("\nWHAT CAN GO IN ONE CHECKOUT");
t("one seller per checkout", /One seller/.test((await checkout([{ listingId: tee, variant: "m" }, { listingId: mug }])).out.error));
t("a size is needed", /Pick a size/.test((await checkout([{ listingId: tee }])).out.error));
t("a sold-out size is refused", /sold out/.test((await checkout([{ listingId: tee, variant: "l" }])).out.error));
t("loops check out on their own", /Loops/.test((await checkout([{ listingId: loop }])).out.error));
t("not your own things", /own listing/.test((await checkout([{ listingId: cap }], seller)).out.error));
t("an empty bag is refused", (await checkout([])).code === 400);
t("nothing was written by the refusals", db.prepare(`SELECT COUNT(*) n FROM orders`).get().n === 0);

console.log("\nPAID CHECKOUT (card payments on)");
PAYMENTS_ENABLED = true;
let r = await checkout([{ listingId: tee, variant: "m" }, { listingId: cap }, { listingId: cap }]);
const lead = r.out.orderId, g = orders(lead);
t("one row per item; the repeat of a one-off is dropped", g.length === 2 && g.every((o) => o.cart_id === lead));
t("combined shipping = the dearest one, on the lead only", g[0].shipping_cents === 1200 && g[1].shipping_cents === 0);
t("each row keeps its own price and size", g[0].amount_cents === 5000 && g[0].variant === "M" && g[1].amount_cents === 3000);
t("Stripe gets both items, the combined shipping, and the lead id", lastCheckout.items.length === 2 && lastCheckout.items[0].title === "Tee — M"
  && lastCheckout.amountCents === 8000 && lastCheckout.shippingCents === 1200 && lastCheckout.orderId === lead && lastCheckout.collectShipping === true);
t("every row carries the session", g.every((o) => o.payment_ref === "cs_" + lead));
t("no stock taken before payment", JSON.parse(db.prepare(`SELECT variants FROM listings WHERE id=?`).get(tee).variants)[0].qty === 2);

console.log("\nA PAID SESSION ONLY SETTLES ITS OWN GROUP");
const lo = db.prepare(`SELECT * FROM orders WHERE id=?`).get(lead), second = g[1];
t("group total is items + shipping", X.groupTotal(X.orderGroup(lo)) === 9200);
t("right lead, right total → the whole group", X.sessionFits(lo, { paid: true, orderId: String(lead), amount: 9200 })?.length === 2);
t("reaching it from the second row still needs the lead's session", X.sessionFits(second, { paid: true, orderId: String(lead), amount: 9200 })?.length === 2);
t("a session for one item's price is refused", X.sessionFits(lo, { paid: true, orderId: String(lead), amount: 5000 }) === null);
t("a session naming the second row is refused", X.sessionFits(lo, { paid: true, orderId: String(second.id), amount: 9200 }) === null);
t("unpaid is refused", X.sessionFits(lo, { paid: false, orderId: String(lead), amount: 9200 }) === null);
const single = Number(db.prepare(`INSERT INTO orders (listing_id,buyer_id,seller_id,amount_cents,shipping_cents,created_at,updated_at) VALUES (?,?,?,?,?,?,?)`).run(mug, buyer, other, 2000, 500, now, now).lastInsertRowid);
const so = db.prepare(`SELECT * FROM orders WHERE id=?`).get(single);
t("a single order works exactly as before", X.sessionFits(so, { paid: true, orderId: String(single), amount: 2500 })?.length === 1 && X.sessionFits(so, { paid: true, orderId: String(single), amount: 2000 }) === null);

console.log("\nNO CARD PAYMENTS (arrange mode)");
PAYMENTS_ENABLED = false;
r = await checkout([{ listingId: tee, variant: "m" }, { listingId: cap }]);
t("reserved, not charged", r.out.arrange === true && r.out.count === 2);
t("stock comes off each item", JSON.parse(db.prepare(`SELECT variants FROM listings WHERE id=?`).get(tee).variants)[0].qty === 1 && db.prepare(`SELECT status FROM listings WHERE id=?`).get(cap).status === "sold");
t("the seller gets one message naming both", told.some((a) => a[0] === seller && /bought 2 items: Tee \(M\), Cap/.test(a[4])));
t("a sold item in the bag is named", /"Cap" has sold/.test((await checkout([{ listingId: cap }])).out.error));

console.log("\nPRICE DROPS");
db.prepare(`INSERT INTO listing_likes (listing_id,user_id,created_at) VALUES (?,?,?)`).run(mug, buyer, now);
const before = told.length;
let m = db.prepare(`SELECT * FROM listings WHERE id=?`).get(mug);
X.priceChanged(m, 1500, other);
db.prepare(`UPDATE listings SET price_cents=1500 WHERE id=?`).run(mug);
m = db.prepare(`SELECT * FROM listings WHERE id=?`).get(mug);
t("a cut tags it with the old price", X.priceDrop(m) === 2000);
t("everyone who saved it is told", told.slice(before).some((a) => a[0] === buyer && a[2] === "price_drop" && /now \$15\.00 \(was \$20\.00\)/.test(a[4])));
X.priceChanged(m, 1200, other); db.prepare(`UPDATE listings SET price_cents=1200 WHERE id=?`).run(mug);
m = db.prepare(`SELECT * FROM listings WHERE id=?`).get(mug);
t("a second cut keeps the original 'was'", X.priceDrop(m) === 2000);
X.priceChanged(m, 2500, other); db.prepare(`UPDATE listings SET price_cents=2500 WHERE id=?`).run(mug);
t("a rise clears the tag", X.priceDrop(db.prepare(`SELECT * FROM listings WHERE id=?`).get(mug)) === null);

console.log("\nWIRED IN");
const rt = readFileSync(join(ROOT, "src/server.runtime.js"), "utf8");
const done = rt.slice(rt.indexOf('app.get("/api/market/checkout/done"'), rt.indexOf("function settlePaidOrder"));
t("the checkout return settles through sessionFits", done.includes("const group = sessionFits(order, out)") && done.includes("for (const o of group) settlePaidOrder(o, out)"));
t("so does the reconciler", rt.slice(rt.indexOf("async function reconcileOrders")).includes("const group = sessionFits(order, out)"));
t("the old single-order amount check is gone (sessionFits covers it)", !done.includes("const expectedCents"));
t("/api/market/saved and /recent aren't swallowed by /api/market/:id", rt.includes('if (!/^\\d+$/.test(req.params.id)) return next();'));
t("editing a price runs priceChanged", rt.includes("priceChanged(l, next.price_cents, req.user.id)"));
console.log(`\n  ${pass} passed, ${fail} failed`);
