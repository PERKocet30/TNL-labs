/* ================================================================
   ADMIN v4 · 2026-10-20. The rebuilt admin (public/admin-app) reads
   these on top of the routes it already had. "Make it more like
   Shopify's admin, with graphs; compare against Instagram analytics."
     GET /api/admin/series    every day series, this window AND the one
                              before it (so a chart can show last period
                              faint behind), plus votes
     GET /api/admin/topwork   the pieces that did best this window
     GET /api/admin/audience  members by what they make, by lab, by hour
     GET /api/admin/sellers   who can sell: Stripe kind, ready, stuck
   Admin-only on the server, like every /api/admin route.
================================================================ */
app.get("/api/admin/series", auth, admin, (req, res) => {
  const now = Date.now(), { days, start, prevStart } = adminWindow(req.query, now);
  const bucket = (sql, from) => {
    const out = new Array(days).fill(0);
    for (const r of db.prepare(sql).all(from)) if (r.d >= 0 && r.d < days) out[r.d] = r.n;
    return out;
  };
  const dayExpr = `CAST((created_at - ?1) / ${ADAY} AS INTEGER)`;
  const Q = {
    signups: `SELECT ${dayExpr} d, COUNT(*) n FROM users WHERE created_at >= ?1 GROUP BY d`,
    active: `SELECT CAST((t - ?1) / ${ADAY} AS INTEGER) d, COUNT(DISTINCT u) n FROM (${ACTIVITY}) WHERE t >= ?1 GROUP BY d`,
    work: `SELECT ${dayExpr} d, COUNT(*) n FROM posts WHERE is_work = 1 AND created_at >= ?1 GROUP BY d`,
    posts: `SELECT ${dayExpr} d, COUNT(*) n FROM posts WHERE created_at >= ?1 GROUP BY d`,
    votes: `SELECT ${dayExpr} d, COUNT(*) n FROM event_votes WHERE created_at >= ?1 GROUP BY d`,
    orders: `SELECT ${dayExpr} d, COUNT(*) n FROM orders WHERE status IN ${PAID} AND created_at >= ?1 GROUP BY d`,
    gmv: `SELECT ${dayExpr} d, SUM(amount_cents + shipping_cents) n FROM orders WHERE status IN ${PAID} AND created_at >= ?1 GROUP BY d`,
  };
  const series = {}, prev = {};
  for (const [k, sql] of Object.entries(Q)) { series[k] = bucket(sql, start); prev[k] = bucket(sql, prevStart).slice(0, days); }
  /* a day in the previous window that's past `start` belongs to this window; cut it */
  const cut = (arr) => arr.map((v, i) => (prevStart + i * ADAY >= start ? 0 : v));
  for (const k of Object.keys(prev)) prev[k] = cut(prev[k]);
  const fees = (a, b) => db.prepare(`SELECT o.amount_cents, u.rep seller_rep, u.is_admin seller_admin FROM orders o JOIN users u ON u.id = o.seller_id
    WHERE o.status IN ${PAID} AND o.created_at > ? AND o.created_at <= ?`).all(a, b).reduce((s, o) => s + feeOf(o), 0);
  res.json({ days, start, prevStart, series, prev, members: aone(`SELECT COUNT(*) n FROM users`),
    fees: { now: fees(start, now), before: fees(prevStart, start) } });
});

/* The pieces that did best this window: likes + comments + shares, with the maker. */
app.get("/api/admin/topwork", auth, admin, (req, res) => {
  const { start } = adminWindow(req.query);
  const rows = db.prepare(`SELECT p.id, p.body, p.channel, COALESCE(p.thumb_url, p.image_url) img, p.created_at, u.username, u.display_name, u.avatar_url,
      (SELECT COUNT(*) FROM likes l WHERE l.post_id = p.id) likes,
      (SELECT COUNT(*) FROM comments c WHERE c.post_id = p.id) comments,
      (SELECT COUNT(*) FROM posts s WHERE s.shared_from = p.id) shares
    FROM posts p JOIN users u ON u.id = p.author_id
    WHERE p.is_work = 1 AND p.created_at >= ? AND COALESCE(u.suspended, 0) = 0
    ORDER BY likes * 1 + comments * 2 + shares * 3 DESC, p.created_at DESC LIMIT 6`).all(start);
  res.json({ work: rows.map((r) => ({ id: r.id, text: String(r.body || "").slice(0, 60), lab: LAB_OF[r.channel] ? LAB_NAME[LAB_OF[r.channel]] : "Profile", img: r.img,
    user: { username: r.username, displayName: r.display_name, avatarUrl: r.avatar_url || "" }, likes: r.likes, comments: r.comments, shares: r.shares, createdAt: r.created_at })) });
});

/* Who the members are, the way Instagram's Audience page would say it:
   by what they make, which lab they're active in, and what hour they're on. */
app.get("/api/admin/audience", auth, admin, (req, res) => {
  const now = Date.now(), { start } = adminWindow(req.query, now);
  const tz = Math.max(-840, Math.min(840, Number(req.query.tz) || 0)) * 60000;
  const roles = {};
  for (const u of db.prepare(`SELECT roles FROM users WHERE suspended = 0`).all())
    for (const r of jsonList(u.roles)) roles[r] = (roles[r] || 0) + 1;
  const byRole = Object.entries(roles).sort((a, b) => b[1] - a[1]).slice(0, 10).map(([role, n]) => ({ role, n }));
  const byLab = Object.keys(PLACES).map((id) => ({ id, name: LAB_NAME[id],
    people: aone(`SELECT COUNT(DISTINCT author_id) n FROM posts WHERE created_at >= ? AND channel IN (${inList(PLACES[id].channels)})`, start) }));
  const hours = new Array(24).fill(0);
  for (const r of db.prepare(`SELECT CAST(((t - ?1) % ${ADAY}) / 3600000 AS INTEGER) h, COUNT(*) n FROM (${ACTIVITY}) WHERE t >= ?2 GROUP BY h`).all(tz, start))
    if (r.h >= 0 && r.h < 24) hours[r.h] = r.n;
  const verified = aone(`SELECT COUNT(*) n FROM users WHERE email_verified = 1`), members = aone(`SELECT COUNT(*) n FROM users`);
  const sellers = aone(`SELECT COUNT(*) n FROM users WHERE stripe_ready = 1`);
  res.json({ byRole, byLab, hours, members, verified, sellers,
    active30: aone(`SELECT COUNT(DISTINCT u) n FROM (${ACTIVITY}) WHERE t >= ?`, now - 30 * ADAY) });
});

/* Who can sell, and who's stuck. kind: express_stripe · express · standard. */
app.get("/api/admin/sellers", auth, admin, (req, res) => {
  const rows = db.prepare(`SELECT u.id, u.username, u.display_name, u.avatar_url, u.stripe_account, u.stripe_kind, u.stripe_ready, u.is_admin, u.rep, u.created_at,
      (SELECT COUNT(*) FROM listings l WHERE l.seller_id = u.id AND l.status = 'active') listings,
      (SELECT COUNT(*) FROM orders o WHERE o.seller_id = u.id AND o.status IN ${PAID}) sales,
      (SELECT COALESCE(SUM(o.amount_cents), 0) FROM orders o WHERE o.seller_id = u.id AND o.status IN ${PAID}) gross
    FROM users u WHERE u.stripe_account != '' OR EXISTS (SELECT 1 FROM listings l WHERE l.seller_id = u.id)
    ORDER BY u.stripe_ready DESC, gross DESC, u.created_at DESC`).all();
  res.json({ sellers: rows.map((r) => ({ id: r.id, username: r.username, displayName: r.display_name, avatarUrl: r.avatar_url || "", isAdmin: !!r.is_admin, rep: r.rep,
    kind: r.stripe_account ? (r.stripe_kind || "standard") : "", ready: !!r.stripe_ready, started: !!r.stripe_account,
    fee: feeForSeller(r.rep, r.is_admin), listings: r.listings, sales: r.sales, gross: r.gross, joined: r.created_at })) });
});

/* Every listing, for the Listings page: what's for sale, by whom, stock, views, sales. */
app.get("/api/admin/listings", auth, admin, (req, res) => {
  const rows = db.prepare(`SELECT l.id, l.title, l.price_cents, l.quantity, l.status, l.kind, l.sell_type, l.images, l.views, l.created_at, l.updated_at, u.username,
      (SELECT COUNT(*) FROM orders o WHERE o.listing_id = l.id AND o.status IN ${PAID}) sales,
      (SELECT COUNT(*) FROM listing_likes s WHERE s.listing_id = l.id) saves
    FROM listings l JOIN users u ON u.id = l.seller_id ORDER BY l.created_at DESC LIMIT 300`).all();
  res.json({ listings: rows.map((r) => { let img = ""; try { img = (JSON.parse(r.images || "[]")[0]) || ""; } catch {}
    return { id: r.id, title: r.title, price: r.price_cents, qty: r.quantity, status: r.status, kind: r.kind, sellType: r.sell_type || "", img, views: r.views || 0, seller: r.username,
      sales: r.sales, saves: r.saves, createdAt: r.created_at, updatedAt: r.updated_at }; }) });
});
