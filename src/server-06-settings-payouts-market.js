/* ---- settings. Change the app without a deploy. ---- */
app.get("/api/admin/settings", auth, admin, (req, res) => {
  res.json({ settings: allSettings(), defaults: SETTING_DEFAULTS });
});

app.patch("/api/admin/settings", auth, admin, (req, res) => {
  const patch = req.body || {};
  const changed = [];
  for (const [k, v] of Object.entries(patch)) {
    if (setSetting(k, v, req.user.id)) changed.push(k);
  }
  if (changed.length) console.log(`[admin] @${req.user.username} changed: ${changed.join(", ")}`);
  res.json({ ok: true, changed, settings: allSettings() });
});

/* The dashboard page. Gated in the browser too, but the real gate is every
   endpoint above — the page is inert without a valid admin token. */
app.get("/admin", (_req, res) => res.sendFile(join(__dirname, "..", "public", "admin.html")));

/* ================================================================
   MARKET — peer-to-peer listings. Anyone verified can sell.
================================================================ */
const CATEGORIES = ["Tops", "Bottoms", "Outerwear", "Footwear", "Accessories", "Headwear", "Bags", "Jewellery", "Art / Prints", "Other"];
const CONDITIONS = ["Deadstock", "Like New", "Good", "Worn", "Distressed"];
/* Loops are listings with kind='loop'. They inherit offers, saves, reviews,
   search and the fee ladder for free — no parallel system to maintain. What
   differs: they deliver instantly, they can be free, and there's nothing to
   ship. */
/* What producers actually sell, in their words. Deliberately different from
   the studio's SLOTS: a slot is where one sound goes on a track, this is
   what someone puts a price on. "Drum Kit" is 40 slots in one listing. */
const LOOP_CATEGORIES = [
  "Loop", "Drum Kit", "One Shot", "Sample Pack",
  "808 Pack", "Melody Loop", "Acapella", "Stem", "MIDI", "Preset",
];
const KEYS = ["C","C#","D","D#","E","F","F#","G","G#","A","A#","B",
  "Cm","C#m","Dm","D#m","Em","Fm","F#m","Gm","G#m","Am","A#m","Bm"];

/* Same N+1 problem the feed had: two queries per listing. Batched. */
function listingSidecar(rows, viewerId) {
  const ids = rows.map((r) => r.id);
  const counts = new Map(), mine = new Set();
  if (!ids.length) return { counts, mine };
  const holes = ids.map(() => "?").join(",");
  for (const r of db.prepare(
    `SELECT listing_id, COUNT(*) n FROM listing_likes WHERE listing_id IN (${holes}) GROUP BY listing_id`
  ).all(...ids)) counts.set(r.listing_id, r.n);
  if (viewerId) {
    for (const r of db.prepare(
      `SELECT listing_id FROM listing_likes WHERE user_id = ? AND listing_id IN (${holes})`
    ).all(viewerId, ...ids)) mine.add(r.listing_id);
  }
  return { counts, mine };
}
function shapeListings(rows, viewerId) {
  const side = listingSidecar(rows, viewerId);
  return rows.map((r) => shapeListing(r, viewerId, side));
}

function shapeListing(r, viewerId, side) {
  let images = [];
  try { images = JSON.parse(r.images || "[]"); } catch {}
  return {
    id: r.id,
    title: r.title,
    description: r.description,
    price: r.price_cents,
    shipping: r.shipping_cents,
    currency: r.currency,
    category: r.category,
    brand: r.brand,
    size: r.size,
    condition: r.condition,
    colour: r.colour,
    images,
    shipsFrom: r.ships_from,
    kind: r.kind || "physical",
    audioUrl: r.audio_url || null,
    bpm: r.bpm || null,
    musicalKey: r.musical_key || "",
    stems: !!r.stems,
    downloads: r.downloads || 0,
    isFree: (r.price_cents || 0) === 0,
    acceptsOffers: !!r.accepts_offers,
    quantity: r.quantity ?? 1,
    status: r.status,
    views: r.views,
    createdAt: r.created_at,
    likeCount: side ? (side.counts.get(r.id) || 0)
      : db.prepare(`SELECT COUNT(*) n FROM listing_likes WHERE listing_id = ?`).get(r.id).n,
    likedByMe: side ? side.mine.has(r.id)
      : (viewerId ? !!db.prepare(`SELECT 1 FROM listing_likes WHERE listing_id = ? AND user_id = ?`).get(r.id, viewerId) : false),
    seller: {
      username: r.seller_username,
      displayName: r.seller_name,
      avatarUrl: r.seller_avatar || "",
      rep: r.seller_rep,
      level: levelFor(r.seller_rep || 0).id,
    },
  };
}

const LISTING_SELECT = `
  SELECT l.*, u.username AS seller_username, u.display_name AS seller_name,
         u.avatar_url AS seller_avatar, u.accent AS seller_accent, u.rep AS seller_rep
  FROM listings l JOIN users u ON u.id = l.seller_id`;

app.get("/api/market/meta", maybeAuth, (req, res) => {
  const sizes = db.prepare(`SELECT DISTINCT size FROM listings WHERE status='active' AND size != '' ORDER BY size`).all().map((r) => r.size);
  const brands = db.prepare(`SELECT brand, COUNT(*) n FROM listings WHERE status='active' AND brand != '' GROUP BY brand ORDER BY n DESC LIMIT 20`).all().map((r) => r.brand);
  res.json({
    categories: CATEGORIES, conditions: CONDITIONS, sizes, brands,
    loopCategories: LOOP_CATEGORIES, keys: KEYS,
    paymentsEnabled: PAYMENTS_ENABLED,
    feePct: req.user ? feeForRep(req.user.rep) : FEE_BY_LEVEL[1],
    feeLadder: LEVELS.map((l) => ({ level: l.id, name: l.name, at: l.at, fee: FEE_BY_LEVEL[l.id] })),
  });
});

/* ---- seller payouts (Stripe Standard Connect) ----
   The seller owns the Stripe account; we never hold their money. */
app.post("/api/market/connect", auth, verified, async (req, res) => {
  if (!PAYMENTS_ENABLED) return res.status(400).json({ error: "payments aren't switched on yet" });
  let acct = req.user.stripe_account;
  if (!acct) {
    const made = await createSellerAccount(req.user.email);
    if (made.error) return res.status(502).json({ error: made.error });
    acct = made.id;
    db.prepare(`UPDATE users SET stripe_account = ? WHERE id = ?`).run(acct, req.user.id);
  }
  const base = baseUrl(req);
  const link = await onboardingLink(acct, `${base}/?connect=refresh`, `${base}/?connect=done`);
  if (link.error) return res.status(502).json({ error: link.error });
  res.json({ url: link.url });
});

app.get("/api/market/connect/done", auth, async (req, res) => {
  // Stripe sends them back here; confirm with the API rather than assuming.
  if (req.user.stripe_account) {
    const st = await accountStatus(req.user.stripe_account);
    db.prepare(`UPDATE users SET stripe_ready = ? WHERE id = ?`).run(st.ready ? 1 : 0, req.user.id);
  }
  res.redirect("/?connect=done");
});

app.get("/api/market/connect/status", auth, async (req, res) => {
  if (!req.user.stripe_account) return res.json({ connected: false, ready: false });
  const st = await accountStatus(req.user.stripe_account);
  db.prepare(`UPDATE users SET stripe_ready = ? WHERE id = ?`).run(st.ready ? 1 : 0, req.user.id);
  res.json({ connected: true, ...st });
});

app.get("/api/market/connect/dashboard", auth, async (req, res) => {
  if (!req.user.stripe_account) return res.status(400).json({ error: "not connected" });
  const l = await loginLink(req.user.stripe_account);
  if (l.error) return res.status(502).json({ error: l.error });
  res.json({ url: l.url });
});

app.get("/api/market", maybeAuth, (req, res) => {
  const { category, size, condition, brand, q: term, sort, seller, max, min, kind, key, bpm, free } = req.query;
  const where = [`l.status = 'active'`];
  const params = [];
  if (kind) { where.push(`l.kind = ?`); params.push(kind); }
  if (key) { where.push(`l.musical_key = ?`); params.push(key); }
  if (free === "1") where.push(`l.price_cents = 0`);
  if (bpm) { const b = Number(bpm); where.push(`l.bpm BETWEEN ? AND ?`); params.push(b - 5, b + 5); }
  if (category) { where.push(`l.category = ?`); params.push(category); }
  if (size) { where.push(`l.size = ?`); params.push(size); }
  if (condition) { where.push(`l.condition = ?`); params.push(condition); }
  if (brand) { where.push(`l.brand LIKE ?`); params.push(`%${brand}%`); }
  if (seller) { where.push(`u.username = ?`); params.push(seller); }
  if (min) { where.push(`l.price_cents >= ?`); params.push(Math.round(Number(min) * 100)); }
  if (max) { where.push(`l.price_cents <= ?`); params.push(Math.round(Number(max) * 100)); }
  if (term) { where.push(`(l.title LIKE ? OR l.description LIKE ? OR l.brand LIKE ?)`); const t = `%${term}%`; params.push(t, t, t); }
  const order = sort === "low" ? `l.price_cents ASC` : sort === "high" ? `l.price_cents DESC`
    : sort === "liked" ? `(SELECT COUNT(*) FROM listing_likes ll WHERE ll.listing_id = l.id) DESC` : `l.created_at DESC`;
  const rows = db.prepare(`${LISTING_SELECT} WHERE ${where.join(" AND ")} ORDER BY ${order} LIMIT 60`).all(...params);
  const hidden = req.user ? blockedIds(req.user.id) : new Set();
  res.json({ listings: shapeListings(rows.filter((r) => !hidden.has(r.seller_username)), req.user?.id) });
});

app.get("/api/market/:id", maybeAuth, (req, res) => {
  const r = db.prepare(`${LISTING_SELECT} WHERE l.id = ?`).get(Number(req.params.id));
  if (!r) return res.status(404).json({ error: "no listing" });
  if (!req.user || req.user.id !== r.seller_id) {
    db.prepare(`UPDATE listings SET views = views + 1 WHERE id = ?`).run(r.id);
    if (req.user) db.prepare(
      `INSERT INTO listing_views (listing_id, user_id, viewed_at) VALUES (?,?,?)
       ON CONFLICT(listing_id, user_id) DO UPDATE SET viewed_at = excluded.viewed_at`
    ).run(r.id, req.user.id, Date.now());
  }
  const offers = req.user && (req.user.id === r.seller_id)
    ? db.prepare(`SELECT o.*, u.username, u.display_name FROM offers o JOIN users u ON u.id = o.buyer_id
                  WHERE o.listing_id = ? AND o.status = 'pending' ORDER BY o.amount_cents DESC`).all(r.id)
    : req.user
      ? db.prepare(`SELECT * FROM offers WHERE listing_id = ? AND buyer_id = ? ORDER BY created_at DESC LIMIT 5`).all(r.id, req.user.id)
      : [];
  /* Same category, similar price, still for sale. The cheapest useful
     version of "you might also like" — no ML, just relevance. */
  const similar = db.prepare(`${LISTING_SELECT}
    WHERE l.status='active' AND l.id != ? AND l.category = ?
      AND l.price_cents BETWEEN ? AND ?
    ORDER BY ABS(l.price_cents - ?) ASC LIMIT 6`)
    .all(r.id, r.category, Math.round(r.price_cents * 0.4), Math.round(r.price_cents * 2.2), r.price_cents);
  res.json({
    listing: shapeListing(r, req.user?.id),
    offers,
    seller: sellerStats(r.seller_id),
    similar: shapeListings(similar, req.user?.id),
  });
});

app.post("/api/market", auth, verified, rateLimit({ max: 15, windowMs: 3600000, key: "user" }), (req, res) => {
  const body = req.body || {};
  const isLoop = body.kind === "loop";
  const cents = Math.round(Number(body.price) * 100) || 0;
  const free = isLoop && cents === 0;

  /* Payouts first — but ONLY if money is involved. A producer giving a loop
     away shouldn't have to hand Stripe their bank details first; that would
     kill the exact behaviour we most want. Free loops list with nothing. */
  if (!settingBool("marketOpen")) return res.status(403).json({ error: "The market's closed right now." });
  const minRep = Number(setting("minRepToSell")) || 0;
  if (req.user.rep < minRep) {
    return res.status(403).json({ error: `You need ${minRep} rep to sell — post work and let people back it first.` });
  }
  if (PAYMENTS_ENABLED && !free && !req.user.stripe_ready) {
    return res.status(403).json({
      error: isLoop
        ? "Set up payouts to sell loops — or set the price to 0 and give it away free"
        : "Set up payouts before you list — it takes a minute and it's how you get paid",
      needsPayouts: true,
    });
  }

  const { title, description, price, shipping, category, brand, size, condition, colour, images, shipsFrom, acceptsOffers,
          audioUrl, bpm, musicalKey, stems, quantity } = body;
  if (!title?.trim()) return res.status(400).json({ error: "title required" });

  if (isLoop) {
    if (!audioUrl || !String(audioUrl).startsWith("/uploads/")) {
      return res.status(400).json({ error: "upload the audio first" });
    }
    if (cents !== 0 && cents < 100) return res.status(400).json({ error: "either free, or at least $1" });
  } else {
    if (!Number.isFinite(cents) || cents < 100) return res.status(400).json({ error: "price must be at least 1.00" });
  }
  if (cents > 5000000) return res.status(400).json({ error: "price too high" });

  const imgs = Array.isArray(images) ? images.filter((i) => typeof i === "string").slice(0, 8) : [];
  // A loop is heard, not seen — artwork is optional.
  if (!isLoop && !imgs.length) return res.status(400).json({ error: "add at least one photo" });

  const cat = isLoop
    ? (LOOP_CATEGORIES.includes(category) ? category : "Loop")
    : (CATEGORIES.includes(category) ? category : "Other");
  const shipCents = isLoop ? 0 : Math.max(0, Math.round(Number(shipping || 0) * 100));
  const now = Date.now();
  const info = db.prepare(`
    INSERT INTO listings (seller_id, title, description, price_cents, shipping_cents, category, brand, size, condition, colour, images, ships_from, accepts_offers, kind, audio_url, bpm, musical_key, stems, quantity, created_at, updated_at)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`).run(
    req.user.id, title.trim().slice(0, 120), (description || "").slice(0, 2000), cents, shipCents,
    cat, (brand || "").slice(0, 60), (size || "").slice(0, 20),
    isLoop ? "" : (CONDITIONS.includes(condition) ? condition : "Good"), (colour || "").slice(0, 30),
    JSON.stringify(imgs), isLoop ? "" : (shipsFrom || "").slice(0, 60),
    (isLoop && free) ? 0 : (acceptsOffers === false ? 0 : 1),
    isLoop ? "loop" : "physical",
    isLoop ? audioUrl : null,
    isLoop ? (Number(bpm) || null) : null,
    isLoop && KEYS.includes(musicalKey) ? musicalKey : "",
    isLoop && stems ? 1 : 0,
    isLoop ? 1 : Math.min(500, Math.max(1, Math.round(Number(quantity)) || 1)),
    now, now);
  res.json({ id: Number(info.lastInsertRowid) });
});

app.patch("/api/market/:id", auth, (req, res) => {
  const l = db.prepare(`SELECT * FROM listings WHERE id = ?`).get(Number(req.params.id));
  if (!l) return res.status(404).json({ error: "no listing" });
  if (l.seller_id !== req.user.id) return res.status(403).json({ error: "not yours" });
  const { title, description, price, status, shipping, quantity, images,
          brand, size, condition, colour, category, shipsFrom, acceptsOffers,
          bpm, musicalKey, stems } = req.body || {};
  const isLoop = l.kind === "loop";
  let imgs = null;
  if (images !== undefined) {
    imgs = Array.isArray(images) ? images.filter((i) => typeof i === "string").slice(0, 8) : [];
    if (!isLoop && !imgs.length) return res.status(400).json({ error: "keep at least one photo" });
  }
  const next = {
    title: (title ?? l.title).toString().slice(0, 120),
    description: (description ?? l.description).toString().slice(0, 2000),
    price_cents: price !== undefined ? Math.round(Number(price) * 100) : l.price_cents,
    shipping_cents: shipping !== undefined ? Math.max(0, Math.round(Number(shipping) * 100)) : l.shipping_cents,
    status: ["active", "sold", "removed"].includes(status) ? status : l.status,
    /* Restock: quantity edits are how a brand adds a second run. Loops
       stay single — changing their semantics is a decision, not a
       side-effect of an edit route. */
    quantity: (!isLoop && quantity !== undefined) ? Math.min(500, Math.max(0, Math.round(Number(quantity)) || 0)) : (l.quantity ?? 1),
    images: imgs !== null ? JSON.stringify(imgs) : l.images,
    brand: (brand ?? l.brand ?? "").toString().slice(0, 60),
    size: (size ?? l.size ?? "").toString().slice(0, 20),
    condition: condition !== undefined ? (CONDITIONS.includes(condition) ? condition : l.condition) : l.condition,
    colour: (colour ?? l.colour ?? "").toString().slice(0, 30),
    category: category !== undefined ? (CATEGORIES.includes(category) || LOOP_CATEGORIES.includes(category) ? category : l.category) : l.category,
    ships_from: (shipsFrom ?? l.ships_from ?? "").toString().slice(0, 60),
    accepts_offers: acceptsOffers !== undefined ? (acceptsOffers ? 1 : 0) : l.accepts_offers,
    /* A producer mistypes the BPM once and it is wrong forever otherwise.
       Physical listings have no loop metadata to change. */
    bpm: (isLoop && bpm !== undefined) ? (Number(bpm) || null) : l.bpm,
    musical_key: (isLoop && musicalKey !== undefined) ? (KEYS.includes(musicalKey) ? musicalKey : l.musical_key) : l.musical_key,
    stems: (isLoop && stems !== undefined) ? (stems ? 1 : 0) : l.stems,
  };
  /* Free loops are legal (price 0) — the old unconditional check made
     them permanently uneditable. */
  if (next.price_cents < 100 && !(isLoop && next.price_cents === 0)) return res.status(400).json({ error: "price too low" });
  db.prepare(`UPDATE listings SET title=?, description=?, price_cents=?, shipping_cents=?, status=?, quantity=?, images=?, brand=?, size=?, condition=?, colour=?, category=?, ships_from=?, accepts_offers=?, bpm=?, musical_key=?, stems=?, updated_at=? WHERE id=?`)
    .run(next.title, next.description, next.price_cents, next.shipping_cents, next.status, next.quantity, next.images,
         next.brand, next.size, next.condition, next.colour, next.category, next.ships_from, next.accepts_offers,
         next.bpm, next.musical_key, next.stems, Date.now(), l.id);
  res.json({ ok: true });
});

app.delete("/api/market/:id", auth, (req, res) => {
  const l = db.prepare(`SELECT * FROM listings WHERE id = ?`).get(Number(req.params.id));
  if (!l) return res.status(404).json({ error: "no listing" });
  if (l.seller_id !== req.user.id && !req.user.is_admin) return res.status(403).json({ error: "not yours" });
  db.prepare(`UPDATE listings SET status = 'removed', updated_at = ? WHERE id = ?`).run(Date.now(), l.id);
  res.json({ ok: true });
});

app.post("/api/market/:id/like", auth, (req, res) => {
  const l = db.prepare(`SELECT * FROM listings WHERE id = ?`).get(Number(req.params.id));
  if (!l) return res.status(404).json({ error: "no listing" });
  const has = db.prepare(`SELECT 1 FROM listing_likes WHERE listing_id = ? AND user_id = ?`).get(l.id, req.user.id);
  if (has) { db.prepare(`DELETE FROM listing_likes WHERE listing_id = ? AND user_id = ?`).run(l.id, req.user.id); return res.json({ liked: false }); }
  db.prepare(`INSERT INTO listing_likes (listing_id, user_id, created_at) VALUES (?,?,?)`).run(l.id, req.user.id, Date.now());
  notify(l.seller_id, req.user.id, "listing_like", null, `liked "${l.title}"`);
  res.json({ liked: true });
});

/* ---- offers ---- */
app.post("/api/market/:id/offer", auth, verified, rateLimit({ max: 20, windowMs: 3600000, key: "user" }), (req, res) => {
  const l = db.prepare(`SELECT * FROM listings WHERE id = ?`).get(Number(req.params.id));
  if (!l) return res.status(404).json({ error: "no listing" });
  if (l.status !== "active") return res.status(400).json({ error: "listing isn't available" });
  if (l.seller_id === req.user.id) return res.status(400).json({ error: "can't offer on your own listing" });
  if (!l.accepts_offers) return res.status(400).json({ error: "seller isn't taking offers" });
  const cents = Math.round(Number(req.body?.amount) * 100);
  if (!Number.isFinite(cents) || cents < 100) return res.status(400).json({ error: "offer too low" });
  if (cents > l.price_cents) return res.status(400).json({ error: "offer is above asking price — just buy it" });
  db.prepare(`UPDATE offers SET status='withdrawn' WHERE listing_id=? AND buyer_id=? AND status='pending'`).run(l.id, req.user.id);
  db.prepare(`INSERT INTO offers (listing_id, buyer_id, amount_cents, created_at) VALUES (?,?,?,?)`)
    .run(l.id, req.user.id, cents, Date.now());
  notify(l.seller_id, req.user.id, "offer", null, `offered $${(cents / 100).toFixed(2)} on "${l.title}"`);
  res.json({ ok: true });
});

app.post("/api/offers/:id/:action", auth, (req, res) => {
  const o = db.prepare(`SELECT * FROM offers WHERE id = ?`).get(Number(req.params.id));
  if (!o) return res.status(404).json({ error: "no offer" });
  const l = db.prepare(`SELECT * FROM listings WHERE id = ?`).get(o.listing_id);
  const action = req.params.action;
  if (action === "withdraw") {
    if (o.buyer_id !== req.user.id) return res.status(403).json({ error: "not yours" });
    db.prepare(`UPDATE offers SET status='withdrawn' WHERE id=?`).run(o.id);
    return res.json({ ok: true });
  }
  if (l.seller_id !== req.user.id) return res.status(403).json({ error: "not your listing" });
  if (action === "decline") {
    db.prepare(`UPDATE offers SET status='declined' WHERE id=?`).run(o.id);
    notify(o.buyer_id, req.user.id, "offer_declined", null, `declined your offer on "${l.title}"`);
    return res.json({ ok: true });
  }
  if (action === "accept") {
    db.prepare(`UPDATE offers SET status='accepted' WHERE id=?`).run(o.id);
    db.prepare(`UPDATE offers SET status='declined' WHERE listing_id=? AND id!=? AND status='pending'`).run(l.id, o.id);
    notify(o.buyer_id, req.user.id, "offer_accepted", null, `accepted your offer on "${l.title}" — go buy it`);
    return res.json({ ok: true });
  }
  res.status(400).json({ error: "unknown action" });
});

