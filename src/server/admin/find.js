/* ================================================================
   ADMIN · FIND v1.0 — 2026-11-15. "The search bar should let you find
   anything in the dashboard." The bar at the top of /admin found members
   only. It now finds a page, a tab, a card, a switch and a number on its
   own (admin-app/1-find.js knows the dashboard's own map), members through
   the route it always used, and through this one:
     GET /api/admin/find?q=   (the owner only — not on a Mod's list)
   listings, orders, work, tournaments and Knowledge — a handful of each,
   enough to recognise and open.
   What it never searches: messages, the Instagram inbox, emails, addresses,
   admin notes. An order answers to its number, its listing or a username,
   never to a buyer's name or street.
================================================================ */
app.get("/api/admin/find", auth, admin, rateLimit({ max: 90, windowMs: 60000, key: "user" }), (req, res) => {
  const q = String(req.query.q || "").replace(/\s+/g, " ").trim().slice(0, 60);
  const none = { q, listings: [], orders: [], work: [], events: [], knowledge: [] };
  if (q.length < 2) return res.json(none);
  const like = "%" + q.replace(/^[@#]/, "").replace(/[\\%_]/g, "\\$&") + "%";
  const num = /^#?\d{1,9}$/.test(q) ? Number(q.replace("#", "")) : -1;
  const all = (sql, ...p) => { try { return db.prepare(sql).all(...p); } catch (e) { return []; } };
  const clip = (s, n = 70) => String(s || "").replace(/\s+/g, " ").trim().slice(0, n);
  res.json({ q,
    listings: all(`SELECT l.id, l.title, l.price_cents, l.status, u.username seller FROM listings l JOIN users u ON u.id = l.seller_id
      WHERE l.title LIKE ?1 ESCAPE '\\' OR u.username LIKE ?1 ESCAPE '\\' OR l.id = ?2 ORDER BY l.id DESC LIMIT 5`, like, num)
      .map((l) => ({ id: l.id, title: clip(l.title), price: l.price_cents, status: l.status, seller: l.seller })),
    orders: all(`SELECT o.id, o.amount_cents, o.status, l.title, b.username buyer, s.username seller FROM orders o JOIN listings l ON l.id = o.listing_id
      JOIN users b ON b.id = o.buyer_id JOIN users s ON s.id = o.seller_id
      WHERE o.id = ?2 OR l.title LIKE ?1 ESCAPE '\\' OR b.username LIKE ?1 ESCAPE '\\' OR s.username LIKE ?1 ESCAPE '\\' ORDER BY o.id DESC LIMIT 5`, like, num)
      .map((o) => ({ id: o.id, title: clip(o.title), amount: o.amount_cents, status: o.status, buyer: o.buyer, seller: o.seller })),
    work: all(`SELECT p.id, p.body, p.is_work, u.username FROM posts p JOIN users u ON u.id = p.author_id
      WHERE (p.body LIKE ?1 ESCAPE '\\' OR p.id = ?2) AND COALESCE(u.suspended, 0) = 0 ORDER BY p.id DESC LIMIT 5`, like, num)
      .map((p) => ({ id: p.id, text: clip(p.body) || (p.is_work ? "A piece" : "A post"), username: p.username })),
    events: all(`SELECT id, title, slug FROM events WHERE title LIKE ?1 ESCAPE '\\' OR slug LIKE ?1 ESCAPE '\\' ORDER BY id DESC LIMIT 4`, like)
      .map((e) => ({ id: e.id, title: clip(e.title) })),
    knowledge: all(`SELECT id, kind, title FROM knowledge WHERE archived = 0 AND (title LIKE ?1 ESCAPE '\\' OR tags LIKE ?1 ESCAPE '\\' OR body LIKE ?1 ESCAPE '\\')
      ORDER BY (title LIKE ?1 ESCAPE '\\') DESC, (tags LIKE ?1 ESCAPE '\\') DESC, updated_at DESC LIMIT 4`, like)
      .map((k) => ({ id: k.id, kind: k.kind, title: clip(k.title) })),
  });
});
