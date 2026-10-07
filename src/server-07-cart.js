/* ---- THE BAG · 2026-09-30 ----
   Several items from one seller, one payment, shipping combined (the
   dearest item's shipping — what one parcel costs). Each item is still
   its own order row, so shipping, reviews and rep work per item exactly
   as before; the rows share cart_id (the lead order's id) and the lead
   carries the shipping. Paid and settled only through the same bound
   checks as a single buy: the session must name the lead, and the
   amount must equal the whole group. */
function orderGroup(order) {
  if (!order?.cart_id) return order ? [order] : [];
  return db.prepare(`SELECT * FROM orders WHERE cart_id = ? ORDER BY id`).all(order.cart_id);
}
const groupTotal = (g) => g.reduce((n, o) => n + o.amount_cents + (o.shipping_cents || 0), 0);
/* A paid session is only good for the group it was made for. */
function sessionFits(order, out) {
  const g = orderGroup(order);
  const lead = order.cart_id || order.id;
  return out.paid && String(out.orderId || "") === String(lead) && Number(out.amount) === groupTotal(g) ? g : null;
}

app.post("/api/cart/checkout", auth, verified, rateLimit({ max: 20, windowMs: 3600000, key: "user" }), async (req, res) => {
  const want = Array.isArray(req.body?.items) ? req.body.items.slice(0, 20) : [];
  if (!want.length) return res.status(400).json({ error: "Your bag is empty" });
  const lines = [], seen = new Set();
  for (const w of want) {
    const l = db.prepare(`SELECT * FROM listings WHERE id = ?`).get(Number(w?.listingId));
    if (!l) return res.status(400).json({ error: "Something in your bag is gone" });
    const key = l.id + ":" + (w.variant || "");
    if (seen.has(key)) continue;
    seen.add(key);
    if (l.status !== "active") return res.status(400).json({ error: `"${l.title}" has sold`, listingId: l.id });
    if (l.kind === "loop") return res.status(400).json({ error: "Loops check out on their own" });
    if (l.seller_id === req.user.id) return res.status(400).json({ error: "can't buy your own listing" });
    if (lines.length && l.seller_id !== lines[0].l.seller_id) return res.status(400).json({ error: "One seller per checkout" });
    const v = pickVariant(l, w.variant);
    if (v?.error) return res.status(400).json({ error: `${l.title}: ${v.error}`, listingId: l.id });
    // Two lines of the same size can't take more than there is.
    const same = lines.filter((x) => x.l.id === l.id && (x.v?.id || "") === (v?.id || "")).length;
    if (!v && same >= (l.quantity ?? 1)) continue;
    const offer = db.prepare(`SELECT amount_cents FROM offers WHERE listing_id=? AND buyer_id=? AND status='accepted' ORDER BY created_at DESC LIMIT 1`).get(l.id, req.user.id);
    lines.push({ l, v, amount: offer ? offer.amount_cents : l.price_cents });
  }
  if (!lines.length) return res.status(400).json({ error: "Nothing in your bag is left to buy" });
  const seller = q.userById.get(lines[0].l.seller_id);
  if (PAYMENTS_ENABLED && (!seller?.stripe_account || !seller.stripe_ready)) {
    notify(seller.id, req.user.id, "sale", null, "Someone tried to check out your items — finish your payout setup so you can sell them");
    return res.status(409).json({ error: "This seller hasn't finished setting up payments yet. We've let them know.", sellerNotConnected: true });
  }
  const ship = Math.max(...lines.map((x) => x.l.shipping_cents || 0));
  const now = Date.now(), ids = [];
  const ins = db.prepare(`INSERT INTO orders (listing_id, buyer_id, seller_id, amount_cents, shipping_cents, variant_id, variant, created_at, updated_at)
    VALUES (?,?,?,?,?,?,?,?,?)`);
  db.exec("BEGIN");
  try {
    lines.forEach((x, i) => ids.push(Number(ins.run(x.l.id, req.user.id, seller.id, x.amount, i ? 0 : ship,
      x.v?.id || "", variantLabel(x.v), now, now).lastInsertRowid)));
    db.prepare(`UPDATE orders SET cart_id = ? WHERE id IN (${ids.map(() => "?").join(",")})`).run(ids[0], ...ids);
    db.exec("COMMIT");
  } catch (e) { db.exec("ROLLBACK"); throw e; }
  const lead = ids[0], drop = () => db.prepare(`DELETE FROM orders WHERE cart_id = ?`).run(lead);

  if (PAYMENTS_ENABLED) {
    const base = baseUrl(req);
    const out = await createCheckout({
      orderId: lead, title: "", amountCents: lines.reduce((n, x) => n + x.amount, 0), shippingCents: ship,
      items: lines.map((x) => ({ title: x.v ? `${x.l.title} — ${variantLabel(x.v)}` : x.l.title, amountCents: x.amount })),
      currency: (lines[0].l.currency || "usd").toLowerCase(),
      successUrl: `${base}/api/market/checkout/done?session_id={CHECKOUT_SESSION_ID}&o=${lead}`,
      cancelUrl: `${base}/?checkout=cancelled`,
      buyerEmail: req.user.email, sellerAccount: seller.stripe_account,
      feePct: feeForRep(seller.rep), collectShipping: true,
    });
    if (out.error) { drop(); return checkoutFailed(res, out, seller.id, req.user.id, `${lines.length} item${lines.length > 1 ? "s" : ""}`); }
    db.prepare(`UPDATE orders SET payment_ref = ? WHERE cart_id = ?`).run(out.id, lead);
    return res.json({ orderId: lead, checkoutUrl: out.url });
  }
  // No card payments: reserve everything and let them settle up (no rep — see the single buy).
  for (const x of lines) takeStock(x.l.id, x.v?.id);
  notify(seller.id, req.user.id, "sale", null, `bought ${lines.length} item${lines.length > 1 ? "s" : ""}: ${lines.map((x) => x.l.title + (x.v ? ` (${variantLabel(x.v)})` : "")).join(", ").slice(0, 160)} — arrange payment & shipping`);
  res.json({ orderId: lead, arrange: true, count: lines.length });
});

/* Stripe wouldn't open checkout. A setup problem on the seller's Stripe
   account (no payment methods switched on) is the seller's to fix — tell
   them, and tell the buyer plainly; Stripe's own wording goes to the log. */
function checkoutFailed(res, out, sellerId, buyerId, what) {
  if (out.setup) {
    notify(sellerId, buyerId, "sale", null,
      `Someone tried to buy ${what}, but your Stripe account can't take cards yet — in Stripe, open Settings → Payment methods and turn on Cards`);
    return res.status(409).json({ error: "This seller's card payments aren't switched on yet. We've told them — nothing was charged.", sellerNotConnected: true });
  }
  return res.status(502).json({ error: "Checkout couldn't open just now — nothing was charged. Try again in a minute." });
}

/* Your shop at a glance: what's live, what's owed a parcel, what it made. */
app.get("/api/shop/stats", auth, (req, res) => {
  const one = (sql, ...a) => db.prepare(sql).get(...a);
  const me = req.user.id, month = Date.now() - 30 * 86400000;
  const paid = `status IN ('paid','shipped','complete')`;
  const gross = one(`SELECT COALESCE(SUM(amount_cents),0) n FROM orders WHERE seller_id=? AND ${paid}`, me).n;
  const fee = feeForRep(req.user.rep);
  res.json({
    active: one(`SELECT COUNT(*) n FROM listings WHERE seller_id=? AND status='active'`, me).n,
    views: one(`SELECT COALESCE(SUM(views),0) n FROM listings WHERE seller_id=? AND status='active'`, me).n,
    saves: one(`SELECT COUNT(*) n FROM listing_likes ll JOIN listings l ON l.id=ll.listing_id WHERE l.seller_id=? AND l.status='active'`, me).n,
    toShip: one(`SELECT COUNT(*) n FROM orders WHERE seller_id=? AND status IN ('pending','paid') AND (status='paid' OR payment_ref IS NULL OR payment_ref='')`, me).n,
    sold: one(`SELECT COUNT(*) n FROM orders WHERE seller_id=? AND ${paid}`, me).n,
    gross, net: Math.round(gross * (1 - fee / 100)), feePct: fee,
    month: one(`SELECT COALESCE(SUM(amount_cents),0) n FROM orders WHERE seller_id=? AND ${paid} AND created_at>?`, me, month).n,
  });
});

/* The bag lives on the phone; this checks it against the shop — what's
   still for sale, at what price, in which sizes. */
app.post("/api/cart/check", maybeAuth, (req, res) => {
  const ids = (Array.isArray(req.body?.ids) ? req.body.ids : []).map(Number).filter(Number.isInteger).slice(0, 40);
  if (!ids.length) return res.json({ listings: [] });
  const rows = db.prepare(`${LISTING_SELECT} WHERE l.id IN (${ids.map(() => "?").join(",")})`).all(...ids);
  res.json({ listings: shapeListings(rows, req.user?.id) });
});
