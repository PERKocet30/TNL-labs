/* ---- buying ---- */
app.post("/api/market/:id/buy", auth, verified, async (req, res) => {
  const l = db.prepare(`SELECT * FROM listings WHERE id = ?`).get(Number(req.params.id));
  if (!l) return res.status(404).json({ error: "no listing" });
  if (l.status !== "active") return res.status(400).json({ error: "already sold" });
  if (l.seller_id === req.user.id) return res.status(400).json({ error: "can't buy your own listing" });
  const isLoop = l.kind === "loop";
  const { name, address } = req.body || {};
  // Shipping addresses for physical items are collected by Stripe Checkout now
  // (Depop-style) and saved back on payment — so we don't demand them up front.
  // Loops ship nowhere.

  // an accepted offer beats the sticker price
  const accepted = db.prepare(`SELECT * FROM offers WHERE listing_id=? AND buyer_id=? AND status='accepted' ORDER BY created_at DESC LIMIT 1`)
    .get(l.id, req.user.id);
  const amount = accepted ? accepted.amount_cents : l.price_cents;

  /* Check we can actually route the money BEFORE writing an order row.
     Doing it after leaves orphaned orders every time someone bumps into
     an unconfigured seller. */
  const seller = q.userById.get(l.seller_id);
  if (PAYMENTS_ENABLED && (!seller?.stripe_account || !seller.stripe_ready)) {
    /* Don't hand this off to a DM. Every sale goes through the platform or
       it doesn't happen — that's the only way the commission exists, and
       the only way the buyer has any protection. Tell the seller instead. */
    notify(l.seller_id, req.user.id, "sale", null,
      `Someone tried to buy "${l.title}" — finish your payout setup so you can actually sell it`);
    return res.status(409).json({
      error: "This seller hasn't finished setting up payments yet. We've let them know — check back shortly.",
      sellerNotConnected: true,
    });
  }

  const now = Date.now();
  const info = db.prepare(`
    INSERT INTO orders (listing_id, buyer_id, seller_id, amount_cents, shipping_cents, ship_name, ship_address, created_at, updated_at)
    VALUES (?,?,?,?,?,?,?,?,?)`).run(l.id, req.user.id, l.seller_id, amount, l.shipping_cents,
    isLoop ? "" : (name || "").trim().slice(0, 80),
    isLoop ? "" : (address || "").trim().slice(0, 300), now, now);
  const orderId = Number(info.lastInsertRowid);

  if (PAYMENTS_ENABLED) {
    const base = baseUrl(req);
    const out = await createCheckout({
      orderId, title: l.title, amountCents: amount, shippingCents: l.shipping_cents,
      currency: (l.currency || "usd").toLowerCase(),
      successUrl: `${base}/api/market/checkout/done?session_id={CHECKOUT_SESSION_ID}&o=${orderId}`,
      cancelUrl: `${base}/?checkout=cancelled`,
      buyerEmail: req.user.email,
      sellerAccount: seller.stripe_account,
      feePct: feeForRep(seller.rep),   // their level sets their rate
      collectShipping: !isLoop,        // Stripe collects the address for physical goods
    });
    if (out.error) {
      db.prepare(`DELETE FROM orders WHERE id = ?`).run(orderId); // don't leave a ghost
      return res.status(502).json({ error: out.error });
    }
    db.prepare(`UPDATE orders SET payment_ref = ? WHERE id = ?`).run(out.id, orderId);
    return res.json({ orderId, checkoutUrl: out.url });
  }

  // No payment provider configured: reserve the item and let them settle up.
  // NOTE: no rep is awarded here, deliberately. Nothing verifiable happened —
  // two friends could "buy" from each other all day for free. Rep needs
  // evidence, and in arrange mode there is none. Once Stripe is on, a sale
  // costs real money to fake, so it earns rep.
  const arrLeft = Math.max(0, (l.quantity ?? 1) - 1);
  if (arrLeft === 0) db.prepare(`UPDATE listings SET quantity=0, status='sold', sold_at=?, updated_at=? WHERE id=?`).run(now, now, l.id);
  else db.prepare(`UPDATE listings SET quantity=?, updated_at=? WHERE id=?`).run(arrLeft, now, l.id);
  notify(l.seller_id, req.user.id, "sale", null, `bought "${l.title}" — arrange payment & shipping`);
  res.json({ orderId, arrange: true });
});

app.get("/api/market/checkout/done", async (req, res) => {
  const sid = String(req.query.session_id || "");
  const order = db.prepare(`SELECT * FROM orders WHERE id = ?`).get(Number(req.query.o || 0));
  if (!order) return res.redirect("/?checkout=failed");
  const seller = q.userById.get(order.seller_id);
  const out = await verifySession(sid, seller?.stripe_account);
  if (!out.paid) return res.redirect("/?checkout=failed");
  /* Bind the session to THIS order. "Paid" only proves money moved on the
     seller's account — not that it moved for the order named in the query
     string. This route is unauthenticated and order ids are sequential,
     so without these checks one cheap paid session could confirm any
     pending order on the same seller: it flips to paid, rep is awarded,
     the listing marks sold, and no matching money exists. The session
     carries the order id it was created for and the total actually
     charged — assert both before touching anything. */
  if (String(out.orderId || "") !== String(order.id)) return res.redirect("/?checkout=failed");
  const expectedCents = order.amount_cents + (order.shipping_cents || 0);
  if (Number(out.amount) !== expectedCents) return res.redirect("/?checkout=failed");
  settlePaidOrder(order, out);
  res.redirect("/?checkout=paid");
});

/* Settle one verified-paid order. Shared by the checkout redirect above
   and the reconciler below — one definition, so the two paths can't
   drift. Re-reads status at the moment of settling: the caller's row
   may be stale, and this is what makes a double-settle impossible. */
function settlePaidOrder(order, out) {
  const cur = db.prepare(`SELECT status FROM orders WHERE id=?`).get(order.id);
  if (!cur || cur.status !== "pending") return;
  db.prepare(`UPDATE orders SET status='paid', updated_at=? WHERE id=?`).run(Date.now(), order.id);
  if (out.ship) db.prepare(`UPDATE orders SET ship_name=?, ship_address=? WHERE id=?`)
    .run((out.ship.name || "").slice(0, 80), (out.ship.address || "").slice(0, 300), order.id);
  const l = db.prepare(`SELECT * FROM listings WHERE id=?`).get(order.listing_id);
  if (l && l.status === "active") {
    /* One unit sold. The listing only closes when stock runs out. */
    const left = Math.max(0, (l.quantity ?? 1) - 1);
    if (left === 0) db.prepare(`UPDATE listings SET quantity=0, status='sold', sold_at=?, updated_at=? WHERE id=?`).run(Date.now(), Date.now(), l.id);
    else db.prepare(`UPDATE listings SET quantity=?, updated_at=? WHERE id=?`).run(left, Date.now(), l.id);
  } else if (l) {
    /* Stock isn't reserved at checkout, so two buyers can pay for the
       last unit. The money is real either way — the order still settles
       below — but the seller is told plainly so they refund one from
       their Stripe dashboard instead of shipping air. */
    notify(order.seller_id, order.buyer_id, "sale", null,
      `OVERSOLD: "${l.title}" was already sold out when this payment landed — refund it from your Stripe dashboard`);
  }
  // A sale is validation with money behind it — the hardest signal to fake.
  awardRep(order.seller_id, "sale_made", order.id);
  notify(order.seller_id, order.buyer_id, "sale", null, `paid for "${l?.title || "your listing"}" — ship it`);
}

/* The redirect was the ONLY confirmation path. A buyer who pays and
   never lands back — closed tab, dead connection, a transient Stripe
   error on verify — leaves the seller with real money, the order stuck
   'pending', and the listing still active and sellable twice. So:
   whenever someone opens their orders, their stale pending checkouts
   are re-verified against Stripe and settled through the same guarded
   path as the redirect, with the same order-id and amount binding.
   Bounded on purpose: ≥5 min old, ≤5 per load, re-checked at most once
   per 5 min (updated_at doubles as the last-checked stamp), and after
   25h — past any Checkout session's lifetime — an unpaid one is marked
   cancelled so it is never asked about again. The listing was never
   marked sold on this path, so cancelling reverts nothing. */
async function reconcileOrders(userId) {
  const now = Date.now();
  const stale = db.prepare(`
    SELECT * FROM orders
    WHERE status='pending' AND payment_ref IS NOT NULL AND payment_ref != ''
      AND (buyer_id = ? OR seller_id = ?) AND updated_at < ?
    ORDER BY created_at DESC LIMIT 5`).all(userId, userId, now - 300000);
  for (const order of stale) {
    db.prepare(`UPDATE orders SET updated_at=? WHERE id=?`).run(now, order.id);
    const seller = q.userById.get(order.seller_id);
    const out = await verifySession(order.payment_ref, seller?.stripe_account);
    const expectedCents = order.amount_cents + (order.shipping_cents || 0);
    if (out.paid && String(out.orderId || "") === String(order.id) && Number(out.amount) === expectedCents) {
      settlePaidOrder(order, out);
    } else if (now - order.created_at > 90000000) {
      db.prepare(`UPDATE orders SET status='cancelled', updated_at=? WHERE id=?`).run(now, order.id);
    }
  }
}

app.get("/api/orders", auth, async (req, res) => {
  await reconcileOrders(req.user.id).catch(() => {});
  const reviewed = new Set(db.prepare(`SELECT order_id FROM reviews WHERE buyer_id = ?`).all(req.user.id).map((x) => x.order_id));
  const shape = (r) => ({
    id: r.id, amount: r.amount_cents, shipping: r.shipping_cents, status: r.status,
    paid: ["paid","shipped","complete"].includes(r.status), reviewed: reviewed.has(r.id),
    tracking: r.tracking, shipName: r.ship_name, shipAddress: r.ship_address, createdAt: r.created_at,
    listing: { id: r.listing_id, title: r.title, images: (() => { try { return JSON.parse(r.images || "[]"); } catch { return []; } })() },
    other: { username: r.other_username, displayName: r.other_name, avatarUrl: r.other_avatar || "" },
  });
  const buying = db.prepare(`
    SELECT o.*, l.title, l.images, u.username AS other_username, u.display_name AS other_name, u.avatar_url AS other_avatar
    FROM orders o JOIN listings l ON l.id = o.listing_id JOIN users u ON u.id = o.seller_id
    WHERE o.buyer_id = ? ORDER BY o.created_at DESC LIMIT 40`).all(req.user.id);
  const selling = db.prepare(`
    SELECT o.*, l.title, l.images, u.username AS other_username, u.display_name AS other_name, u.avatar_url AS other_avatar
    FROM orders o JOIN listings l ON l.id = o.listing_id JOIN users u ON u.id = o.buyer_id
    WHERE o.seller_id = ? ORDER BY o.created_at DESC LIMIT 40`).all(req.user.id);
  res.json({ buying: buying.map(shape), selling: selling.map(shape) });
});

app.post("/api/orders/:id/ship", auth, (req, res) => {
  const o = db.prepare(`SELECT * FROM orders WHERE id = ?`).get(Number(req.params.id));
  if (!o) return res.status(404).json({ error: "no order" });
  if (o.seller_id !== req.user.id) return res.status(403).json({ error: "not your sale" });
  const tracking = (req.body?.tracking || "").toString().slice(0, 80);
  db.prepare(`UPDATE orders SET status='shipped', tracking=?, updated_at=? WHERE id=?`).run(tracking, Date.now(), o.id);
  notify(o.buyer_id, req.user.id, "shipped", null, tracking ? `shipped your order — ${tracking}` : "shipped your order");
  res.json({ ok: true });
});

app.post("/api/orders/:id/received", auth, (req, res) => {
  const o = db.prepare(`SELECT * FROM orders WHERE id = ?`).get(Number(req.params.id));
  if (!o) return res.status(404).json({ error: "no order" });
  if (o.buyer_id !== req.user.id) return res.status(403).json({ error: "not your order" });
  // Only pay rep for deliveries on orders that were actually PAID. An
  // arrange-mode order is two people clicking buttons — no evidence, no rep.
  if (o.status !== "complete" && (o.status === "shipped" || o.status === "paid") && o.payment_ref) {
    awardRep(o.seller_id, "delivery_confirmed", o.id);
  }
  db.prepare(`UPDATE orders SET status='complete', updated_at=? WHERE id=?`).run(Date.now(), o.id);
  notify(o.seller_id, req.user.id, "order_complete", null, "confirmed delivery");
  res.json({ ok: true });
});

/* ================================================================
   UNREADS — the dot next to a channel name. Without this nobody knows
   anything happened, so nobody comes back.
================================================================ */
app.get("/api/unreads", auth, (req, res) => {
  // Never counts your own posts — you know what you wrote.
  const rows = db.prepare(`
    SELECT p.channel, COUNT(*) n FROM posts p
    LEFT JOIN channel_reads r ON r.user_id = ? AND r.channel = p.channel
    WHERE p.author_id != ? AND p.created_at > COALESCE(r.last_read_at, 0)
    GROUP BY p.channel`).all(req.user.id, req.user.id);
  const out = {};
  for (const r of rows) out[r.channel] = r.n;
  res.json({ unreads: out, muted: [...mutesFor(req.user.id)] });
});

app.post("/api/channels/:channel/read", auth, (req, res) => {
  db.prepare(
    `INSERT INTO channel_reads (user_id, channel, last_read_at) VALUES (?,?,?)
     ON CONFLICT(user_id, channel) DO UPDATE SET last_read_at = excluded.last_read_at`
  ).run(req.user.id, String(req.params.channel).slice(0, 40), Date.now());
  res.json({ ok: true });
});

/* ================================================================
   MENTIONS — @someone is how a conversation becomes a collaboration.
================================================================ */
const MENTION_RE = /@([a-z0-9._]{2,20})/gi;
function notifyMentions(text, actorId, postId, kind) {
  if (!text) return;
  const seen = new Set();
  let m;
  MENTION_RE.lastIndex = 0;
  while ((m = MENTION_RE.exec(text))) {
    const name = m[1].toLowerCase();
    if (seen.has(name)) continue;
    seen.add(name);
    const u = q.userByName.get(name);
    if (u && u.id !== actorId) {
      notify(u.id, actorId, kind || "mention", postId, text.slice(0, 80));
    }
  }
}

/* People you can @ — used by the mention picker. */
app.get("/api/mentionable", auth, (req, res) => {
  const term = (req.query.q || "").toString().toLowerCase().slice(0, 20);
  const hidden = blockedIds(req.user.id);
  const rows = db.prepare(`
    SELECT username, display_name, avatar_url, role FROM users
    WHERE username != ? AND (? = '' OR username LIKE ? OR LOWER(display_name) LIKE ?)
    ORDER BY rep DESC LIMIT 8`).all(req.user.username, term, `${term}%`, `${term}%`);
  res.json({
    people: rows.filter((r) => !hidden.has(r.username)).map((r) => ({
      username: r.username, displayName: r.display_name, avatarUrl: r.avatar_url || "", role: r.role,
    })),
  });
});

/* ================================================================
   SHARING
   Three different things people mean by "share":
     1. send it to a person      -> lands in their DMs
     2. put it in another lab    -> the reshare we already had
     3. send it OUT of the app   -> needs a public page a stranger can open
   This is (1) and (3). Cross-lab reshare stays where it was.
================================================================ */
app.post("/api/posts/:id/send", auth, verified, rateLimit({ max: 20, windowMs: 60000, key: "user" }), (req, res) => {
  const post = q.postById.get(Number(req.params.id));
  if (!post) return res.status(404).json({ error: "no post" });
  // `to` is what the app used to send; the route only read `username`, so in-app sends 404'd.
  const to = q.userByName.get(req.body?.username || req.body?.to || "");
  if (!to) return res.status(404).json({ error: "no such user" });
  if (to.id === req.user.id) return res.status(400).json({ error: "that's you" });
  if (isBlocked(req.user.id, to.id)) return res.status(403).json({ error: "unavailable" });

  const note = (req.body?.note || "").toString().trim().slice(0, 500);

  /* The post travels as a card (messaging v2), the note as its own line. */
  const t = threadFor(req.user.id, to.id);
  dmSend(t, req.user, { body: "", postId: post.id });
  if (note) dmSend(t, req.user, { body: note });
  res.json({ ok: true, chatId: t.id });
});

/* A single post, open to anyone with the link. This is what makes sharing
   out of the app worth anything — otherwise you're sending people to a
   sign-up wall and they just leave. Server-rendered so it previews in
   iMessage, Discord, and IG DMs. */
/* A shared listing link. The SPA reads /m/:id on boot and opens the
   listing (guests included — the Market is public); the server's only
   job is to hand over the app instead of a 404. */
app.get("/m/:id", (_req, res) => res.sendFile(join(__dirname, "..", "public", "index.html")));

app.get("/p/:id", (req, res) => {
  const rows = feedRows({ viewerId: 0, limit: 1, postId: Number(req.params.id) });
  const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const notFound = lookNotFound("This work isn't public, or it's been removed.");
  if (!rows.length) return res.status(404).send(notFound);
  const p = shapePost(rows[0]);
  // Only published work is shareable. Chat stays private, by design.
  if (!p.isWork) return res.status(404).send(notFound);

  const abs = (path) => (path ? (/^https?:/.test(path) ? path : `${baseUrl(req)}${path}`) : null);
  const img = abs(p.imageUrl) || abs(p.author.avatarUrl) || `${baseUrl(req)}/icon-512.png`;
  const accepted = p.collaborators.filter((c) => c.status === "accepted");
  const title = accepted.length
    ? `${p.author.displayName} × ${accepted.map((c) => c.display_name || c.username).join(" × ")}`
    : `${p.author.displayName} — TNL LABS`;
  /* A collab in the title is the whole pitch: this is what happens here.
     Two names on one piece is more interesting than either name alone. */
  const desc = [
    p.body ? p.body.slice(0, 120) : null,
    p.beat ? `${p.beat.bpm} BPM beat, made in the TNL studio` : null,
    `#${p.channel}`,
    p.likeCount ? `${p.likeCount} ♥` : null,
  ].filter(Boolean).join(" · ").slice(0, 200);
  const canonical = `${baseUrl(req)}/p/${p.id}`;

  const au = q.userByName.get(p.author.username);
  res.send(lookPage({
    title: esc(title),
    accent: accentHex(au && au.accent),   // the author's colour, as in the app
    head: `<link rel="canonical" href="${esc(canonical)}">
<meta property="og:type" content="article">
<meta property="og:site_name" content="TNL LABS">
<meta property="og:url" content="${esc(canonical)}">
<meta property="og:title" content="${esc(title)}">
<meta property="og:description" content="${esc(desc)}">
<meta property="og:image" content="${esc(img)}">
<meta property="og:image:secure_url" content="${esc(img)}">
<meta property="og:image:width" content="${p.mediaW || 512}">
<meta property="og:image:height" content="${p.mediaH || 512}">
<meta property="og:image:alt" content="${esc(title)}">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="${esc(title)}">
<meta name="twitter:description" content="${esc(desc)}">
<meta name="twitter:image" content="${esc(img)}">
<meta name="description" content="${esc(desc)}">`,
    body: `
<a class="who" href="/u/${esc(p.author.username)}">
  ${p.author.avatarUrl ? `<img class="av ring" src="${esc(abs(p.author.avatarUrl))}" alt="">` : `<div class="av ring">${esc(p.author.displayName.slice(0, 2).toUpperCase())}</div>`}
  <div><div class="name">${esc(p.author.displayName)}</div><div class="cap">@${esc(p.author.username)} · ${esc(p.author.role)}</div></div>
</a>
${p.body ? `<p class="body" style="margin:0 0 14px">${esc(p.body)}</p>` : ""}
${p.imageUrl ? `<img class="media" src="${esc(p.imageUrl)}" alt="" style="max-height:none">` : ""}
${p.videoUrl ? `<video class="media" src="${esc(p.videoUrl)}" controls playsinline></video>` : ""}
${p.beat ? `<div class="card"><b>${esc(p.beat.name || "untitled loop")}</b><div class="cap">${p.beat.bpm} BPM · made in the TNL studio</div></div>` : ""}
${accepted.length ? `<div class="cap meta"><span class="mk">//</span> Built with ${accepted.map((c) => esc(c.display_name || c.username)).join(" + ")}</div>` : ""}
<div class="cap meta">${lookCount(p.likeCount, "like")} · ${lookCount(p.shareCount, "share")} · #${esc(p.channel)}</div>
<a class="btn block acc" href="/">See what else is being made</a>`,
  }));
});

