/* ================================================================
   MODERATION — block, report, admin removal.
================================================================ */
app.post("/api/users/:username/block", auth, (req, res) => {
  const target = q.userByName.get(req.params.username);
  if (!target) return res.status(404).json({ error: "no such user" });
  if (target.id === req.user.id) return res.status(400).json({ error: "can't block yourself" });
  const existing = db.prepare(`SELECT 1 FROM blocks WHERE blocker_id = ? AND blocked_id = ?`).get(req.user.id, target.id);
  if (existing) {
    db.prepare(`DELETE FROM blocks WHERE blocker_id = ? AND blocked_id = ?`).run(req.user.id, target.id);
    return res.json({ blocked: false });
  }
  db.prepare(`INSERT INTO blocks (blocker_id, blocked_id, created_at) VALUES (?,?,?)`).run(req.user.id, target.id, Date.now());
  // blocking also severs the follow graph both ways
  db.prepare(`DELETE FROM follows WHERE (follower_id = ? AND followee_id = ?) OR (follower_id = ? AND followee_id = ?)`)
    .run(req.user.id, target.id, target.id, req.user.id);
  res.json({ blocked: true });
});

app.post("/api/report", auth, rateLimit({ max: 10, windowMs: 3600000, key: "user" }), (req, res) => {
  const { postId, username, reason } = req.body || {};
  const target = username ? q.userByName.get(username) : null;
  db.prepare(`INSERT INTO reports (reporter_id, post_id, user_id, reason, created_at) VALUES (?,?,?,?,?)`)
    .run(req.user.id, postId || null, target?.id || null, (reason || "").toString().slice(0, 300), Date.now());
  res.json({ ok: true });
});

function admin(req, res, next) {
  if (!req.user.is_admin) return res.status(403).json({ error: "admins only" });
  next();
}

/* ================================================================
   ADMIN DASHBOARD
   The numbers here measure THIS model, not a generic app. Follower count
   never tells you whether the flywheel is turning — confirmed collabs do.
   Every query sits behind admin(), enforced server-side. Hiding a button
   in the UI is not access control.
================================================================ */
const DAY = 86400000;

app.get("/api/admin/overview", auth, admin, (req, res) => {
  const now = Date.now();
  const since = (d) => now - d * DAY;
  const one = (sql, ...p) => db.prepare(sql).get(...p)?.n ?? 0;

  const feeRows = db.prepare(`
    SELECT o.amount_cents, u.rep FROM orders o JOIN users u ON u.id = o.seller_id
    WHERE o.status IN ('paid','shipped','complete')`).all();
  const earned = feeRows.reduce((s, r) => s + Math.round(r.amount_cents * (feeForRep(r.rep) / 100)), 0);

  const levels = LEVELS.map((l, i) => ({
    level: l.id, name: l.name,
    n: i < LEVELS.length - 1
      ? one(`SELECT COUNT(*) n FROM users WHERE rep >= ? AND rep < ?`, l.at, LEVELS[i + 1].at)
      : one(`SELECT COUNT(*) n FROM users WHERE rep >= ?`, l.at),
  }));

  const daily = [];
  for (let i = 13; i >= 0; i--) {
    const from = now - (i + 1) * DAY, to = now - i * DAY;
    daily.push({
      d: new Date(to).toISOString().slice(5, 10),
      posts: one(`SELECT COUNT(*) n FROM posts WHERE created_at > ? AND created_at <= ?`, from, to),
      joins: one(`SELECT COUNT(*) n FROM users WHERE created_at > ? AND created_at <= ?`, from, to),
    });
  }

  res.json({
    members: one(`SELECT COUNT(*) n FROM users`),
    verified: one(`SELECT COUNT(*) n FROM users WHERE email_verified = 1`),
    newWeek: one(`SELECT COUNT(*) n FROM users WHERE created_at > ?`, since(7)),
    active: one(`SELECT COUNT(DISTINCT author_id) n FROM posts WHERE created_at > ?`, since(7)),
    activeMonth: one(`SELECT COUNT(DISTINCT author_id) n FROM posts WHERE created_at > ?`, since(30)),
    posts: one(`SELECT COUNT(*) n FROM posts`),
    work: one(`SELECT COUNT(*) n FROM posts WHERE is_work = 1`),
    workWeek: one(`SELECT COUNT(*) n FROM posts WHERE is_work = 1 AND created_at > ?`, since(7)),
    // the flywheel metric — if this is zero, nothing else matters
    collabs: one(`SELECT COUNT(*) n FROM collaborators WHERE status = 'accepted'`),
    collabsWeek: one(`SELECT COUNT(*) n FROM collaborators WHERE status = 'accepted' AND created_at > ?`, since(7)),
    pendingCollabs: one(`SELECT COUNT(*) n FROM collaborators WHERE status = 'pending'`),
    shares: one(`SELECT COUNT(*) n FROM posts WHERE shared_from IS NOT NULL`),
    crossLab: one(`SELECT COUNT(*) n FROM posts s JOIN posts o ON o.id = s.shared_from WHERE s.channel != o.channel`),
    listings: one(`SELECT COUNT(*) n FROM listings WHERE status = 'active'`),
    sold: one(`SELECT COUNT(*) n FROM orders WHERE status IN ('paid','shipped','complete')`),
    gmv: db.prepare(`SELECT COALESCE(SUM(amount_cents + shipping_cents),0) n FROM orders WHERE status IN ('paid','shipped','complete')`).get().n,
    earned,
    openReports: one(`SELECT COUNT(*) n FROM reports WHERE handled_at IS NULL`),
    dms: one(`SELECT COUNT(*) n FROM dm_messages`),
    beats: one(`SELECT COUNT(*) n FROM beat_projects`),
    levels, daily,
    paymentsOn: PAYMENTS_ENABLED,
    mailOn: MAIL_ENABLED,
  });
});

app.get("/api/admin/members", auth, admin, (req, res) => {
  const term = (req.query.q || "").toString().toLowerCase();
  const where = term ? `WHERE LOWER(u.username) LIKE ? OR LOWER(u.display_name) LIKE ? OR LOWER(u.email) LIKE ?` : "";
  const rows = db.prepare(`
    SELECT u.id, u.username, u.display_name, u.email, u.avatar_url, u.role, u.roles, u.rep,
           u.email_verified, u.published, u.is_admin, u.stripe_ready, u.suspended, u.created_at,
      (SELECT COUNT(*) FROM posts p WHERE p.author_id = u.id) AS posts,
      (SELECT COUNT(*) FROM posts p WHERE p.author_id = u.id AND p.is_work = 1) AS work,
      (SELECT COUNT(*) FROM collaborators c WHERE c.user_id = u.id AND c.status='accepted') AS collabs,
      (SELECT COUNT(*) FROM likes l JOIN posts p ON p.id = l.post_id WHERE p.author_id = u.id) AS likes,
      (SELECT MAX(created_at) FROM posts p WHERE p.author_id = u.id) AS last_post
    FROM users u ${where}
    ORDER BY u.rep DESC, u.created_at DESC LIMIT 200`)
    .all(...(term ? [`%${term}%`, `%${term}%`, `%${term}%`] : []));
  res.json({
    members: rows.map((r) => ({
      id: r.id, username: r.username, displayName: r.display_name, email: r.email,
      avatarUrl: r.avatar_url || "", role: r.role,
      roles: (() => { try { return JSON.parse(r.roles || "[]"); } catch { return []; } })(),
      rep: r.rep, level: levelFor(r.rep).id, levelName: levelFor(r.rep).name, fee: feeForRep(r.rep),
      verified: !!r.email_verified, published: !!r.published, isAdmin: !!r.is_admin, payouts: !!r.stripe_ready,
      suspended: !!r.suspended,
      posts: r.posts, work: r.work, collabs: r.collabs, likes: r.likes,
      lastPost: r.last_post, joined: r.created_at,
    })),
  });
});

/* Manual rep — the "feature" award from the model, auditable like the rest. */
app.post("/api/admin/members/:username/feature", auth, admin, (req, res) => {
  const u = q.userByName.get(req.params.username);
  if (!u) return res.status(404).json({ error: "no such user" });
  awardRep(u.id, "feature", null);
  notify(u.id, req.user.id, "feature", null, "featured your work");
  res.json({ ok: true, rep: q.userById.get(u.id).rep });
});

app.post("/api/admin/members/:username/verify", auth, admin, (req, res) => {
  const u = q.userByName.get(req.params.username);
  if (!u) return res.status(404).json({ error: "no such user" });
  db.prepare(`UPDATE users SET email_verified = 1 WHERE id = ?`).run(u.id);
  res.json({ ok: true });
});

app.get("/api/admin/content", auth, admin, (req, res) => {
  const rows = db.prepare(`
    SELECT p.id, p.channel, p.body, p.image_url, p.thumb_url, p.video_url, p.beat_json, p.is_work, p.created_at,
           u.username, u.display_name, u.avatar_url,
      (SELECT COUNT(*) FROM likes l WHERE l.post_id = p.id) AS likes,
      (SELECT COUNT(*) FROM comments c WHERE c.post_id = p.id) AS comments,
      (SELECT COUNT(*) FROM collaborators c WHERE c.post_id = p.id AND c.status='accepted') AS collabs
    FROM posts p JOIN users u ON u.id = p.author_id
    ORDER BY p.created_at DESC LIMIT 60`).all();
  res.json({
    posts: rows.map((r) => ({
      id: r.id, channel: r.channel, body: r.body,
      thumbUrl: r.thumb_url || r.image_url, videoUrl: r.video_url, isBeat: !!r.beat_json,
      isWork: !!r.is_work, createdAt: r.created_at,
      author: { username: r.username, displayName: r.display_name, avatarUrl: r.avatar_url || "" },
      likes: r.likes, comments: r.comments, collabs: r.collabs,
    })),
  });
});

app.get("/api/admin/orders", auth, admin, (req, res) => {
  const rows = db.prepare(`
    SELECT o.*, l.title, b.username AS buyer, s.username AS seller, s.rep AS seller_rep
    FROM orders o
    JOIN listings l ON l.id = o.listing_id
    JOIN users b ON b.id = o.buyer_id
    JOIN users s ON s.id = o.seller_id
    ORDER BY o.created_at DESC LIMIT 80`).all();
  res.json({
    orders: rows.map((r) => ({
      id: r.id, title: r.title, buyer: r.buyer, seller: r.seller,
      amount: r.amount_cents, shipping: r.shipping_cents,
      fee: Math.round(r.amount_cents * (feeForRep(r.seller_rep) / 100)),
      feePct: feeForRep(r.seller_rep),
      status: r.status, tracking: r.tracking, paid: ["paid","shipped","complete"].includes(r.status), createdAt: r.created_at,
    })),
  });
});

app.get("/api/admin/reports", auth, admin, (req, res) => {
  const rows = db.prepare(`
    SELECT r.*, ru.username AS reporter, tu.username AS reported,
           p.body AS post_body, p.channel AS post_channel, p.image_url AS post_img
    FROM reports r
    LEFT JOIN users ru ON ru.id = r.reporter_id
    LEFT JOIN users tu ON tu.id = r.user_id
    LEFT JOIN posts p ON p.id = r.post_id
    WHERE r.handled_at IS NULL ORDER BY r.created_at DESC LIMIT 50`).all();
  res.json({ reports: rows });
});

app.post("/api/admin/reports/:id/handle", auth, admin, (req, res) => {
  db.prepare(`UPDATE reports SET handled_at = ? WHERE id = ?`).run(Date.now(), Number(req.params.id));
  res.json({ ok: true });
});

app.delete("/api/admin/posts/:id", auth, admin, (req, res) => {
  db.prepare(`DELETE FROM posts WHERE id = ?`).run(Number(req.params.id));
  db.prepare(`DELETE FROM reactions WHERE kind = 'post' AND target_id = ?`).run(Number(req.params.id));
  broadcast("post-delete", { id: Number(req.params.id) });
  res.json({ ok: true });
});


/* ---- the funnel. Where people fall out is the only growth question. ---- */
app.get("/api/admin/funnel", auth, admin, (req, res) => {
  const one = (sql, ...p) => db.prepare(sql).get(...p)?.n ?? 0;
  const members = one(`SELECT COUNT(*) n FROM users`);
  const verified = one(`SELECT COUNT(*) n FROM users WHERE email_verified = 1`);
  const posted = one(`SELECT COUNT(DISTINCT author_id) n FROM posts`);
  const published = one(`SELECT COUNT(DISTINCT author_id) n FROM posts WHERE is_work = 1`);
  const collabed = one(`SELECT COUNT(DISTINCT user_id) n FROM collaborators WHERE status='accepted'`);
  const listed = one(`SELECT COUNT(DISTINCT seller_id) n FROM listings`);
  const sold = one(`SELECT COUNT(DISTINCT seller_id) n FROM orders WHERE status IN ('paid','shipped','complete')`);
  const pct = (n) => (members ? Math.round((n / members) * 100) : 0);
  res.json({
    steps: [
      { label: "Signed up", n: members, pct: 100 },
      { label: "Verified email", n: verified, pct: pct(verified) },
      { label: "Posted anything", n: posted, pct: pct(posted) },
      { label: "Published work", n: published, pct: pct(published) },
      { label: "Confirmed a collab", n: collabed, pct: pct(collabed) },
      { label: "Listed an item", n: listed, pct: pct(listed) },
      { label: "Sold something", n: sold, pct: pct(sold) },
    ],
  });
});

/* ---- retention. Are the same people still here, or is it churn? ---- */
app.get("/api/admin/retention", auth, admin, (req, res) => {
  const now = Date.now(), D = 86400000;
  const cohorts = [];
  for (let w = 3; w >= 0; w--) {
    const from = now - (w + 1) * 7 * D, to = now - w * 7 * D;
    const joined = db.prepare(`SELECT id FROM users WHERE created_at > ? AND created_at <= ?`).all(from, to);
    const stillActive = joined.filter((u) =>
      db.prepare(`SELECT 1 FROM posts WHERE author_id = ? AND created_at > ?`).get(u.id, now - 7 * D)
    ).length;
    cohorts.push({
      week: w === 0 ? "This week" : w === 1 ? "Last week" : `${w} weeks ago`,
      joined: joined.length,
      stillPosting: stillActive,
      pct: joined.length ? Math.round((stillActive / joined.length) * 100) : 0,
    });
  }
  // silent members — signed up, never posted
  const silent = db.prepare(`
    SELECT u.username, u.display_name, u.created_at,
      (SELECT COUNT(*) FROM posts p WHERE p.author_id = u.id) AS posts
    FROM users u WHERE (SELECT COUNT(*) FROM posts p WHERE p.author_id = u.id) = 0
    ORDER BY u.created_at DESC LIMIT 20`).all();
  // who's gone quiet — used to post, hasn't in 14 days
  const quiet = db.prepare(`
    SELECT u.username, u.display_name,
      (SELECT MAX(created_at) FROM posts p WHERE p.author_id = u.id) AS last_post,
      (SELECT COUNT(*) FROM posts p WHERE p.author_id = u.id) AS posts
    FROM users u
    WHERE posts > 0 AND last_post < ?
    ORDER BY last_post DESC LIMIT 20`).all(now - 14 * D);
  res.json({ cohorts, silent, quiet });
});

/* ---- the market, as a business ---- */
app.get("/api/admin/market", auth, admin, (req, res) => {
  const now = Date.now(), D = 86400000;
  const one = (sql, ...p) => db.prepare(sql).get(...p)?.n ?? 0;
  const paidOrders = db.prepare(`
    SELECT o.*, u.rep AS seller_rep FROM orders o JOIN users u ON u.id = o.seller_id
    WHERE o.status IN ('paid','shipped','complete')`).all();
  const rev = paidOrders.reduce((s, o) => s + Math.round(o.amount_cents * (feeForRep(o.seller_rep) / 100)), 0);

  const daily = [];
  for (let i = 13; i >= 0; i--) {
    const from = now - (i + 1) * D, to = now - i * D;
    const rows = paidOrders.filter((o) => o.created_at > from && o.created_at <= to);
    daily.push({
      d: new Date(to).toISOString().slice(5, 10),
      gmv: rows.reduce((s, o) => s + o.amount_cents + o.shipping_cents, 0),
      fee: rows.reduce((s, o) => s + Math.round(o.amount_cents * (feeForRep(o.seller_rep) / 100)), 0),
      n: rows.length,
    });
  }
  const topSellers = db.prepare(`
    SELECT u.username, u.display_name, u.avatar_url, u.rep,
      COUNT(o.id) AS sales,
      COALESCE(SUM(o.amount_cents),0) AS gross
    FROM orders o JOIN users u ON u.id = o.seller_id
    WHERE o.status IN ('paid','shipped','complete')
    GROUP BY o.seller_id ORDER BY gross DESC LIMIT 10`).all();
  const stale = db.prepare(`
    SELECT l.id, l.title, l.price_cents, l.views, l.created_at, u.username
    FROM listings l JOIN users u ON u.id = l.seller_id
    WHERE l.status='active' AND l.created_at < ?
    ORDER BY l.views ASC LIMIT 10`).all(now - 14 * D);

  res.json({
    gmv: paidOrders.reduce((s, o) => s + o.amount_cents + o.shipping_cents, 0),
    revenue: rev,
    orders: paidOrders.length,
    aov: paidOrders.length ? Math.round(paidOrders.reduce((s, o) => s + o.amount_cents + o.shipping_cents, 0) / paidOrders.length) : 0,
    active: one(`SELECT COUNT(*) n FROM listings WHERE status='active'`),
    sold: one(`SELECT COUNT(*) n FROM listings WHERE status='sold'`),
    sellers: one(`SELECT COUNT(DISTINCT seller_id) n FROM listings`),
    connected: one(`SELECT COUNT(*) n FROM users WHERE stripe_ready = 1`),
    unshipped: one(`SELECT COUNT(*) n FROM orders WHERE status = 'paid'`),
    avgRating: db.prepare(`SELECT COALESCE(AVG(stars),0) n FROM reviews`).get().n,
    reviews: one(`SELECT COUNT(*) n FROM reviews`),
    daily, topSellers, stale,
  });
});

