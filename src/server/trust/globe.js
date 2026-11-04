/* ================================================================
   WHERE MEMBERS ARE v1.0 — 2026-11-04. "A 3D graphic showing where everyone
   in the world is logging into LABS from would be cool." The admin's globe
   (People → admin-app/3-globe.js) reads this.
   · GET /api/admin/globe?days=30 — per country: how many members are
     there (the country of each member's latest join, sign-in or vote,
     from server/trust/signals — Cloudflare's country for the network, no
     GPS, nobody is asked), how many were seen there in the window and in
     the last day, and when city headers are on, the top cities.
   Counts only — no names, no networks. Admin-only, on the server; it
   isn't a connector tool (the connector drops country on purpose).
   A member who hasn't joined, signed in or voted since signals began
   (2026-10-26) has no place yet: they're counted as "not placed".
================================================================ */
app.get("/api/admin/globe", auth, admin, (req, res) => {
  const days = Math.max(1, Math.min(365, Math.round(Number(req.query.days) || 30))), now = Date.now();
  const since = now - days * 86400000, today = now - 86400000;
  const by = new Map(), row = (c) => by.get(c) || by.set(c, { c, members: 0, active: 0, today: 0, cities: new Map() }).get(c);
  /* each member's latest place with a country (SQLite returns the row the MAX came from) */
  for (const r of db.prepare(`SELECT s.country, s.city FROM (SELECT user_id, country, city, MAX(at) at FROM member_signals WHERE country != '' GROUP BY user_id) s
      JOIN users u ON u.id = s.user_id`).all()) {
    const g = row(r.country); g.members++; if (r.city) g.cities.set(r.city, (g.cities.get(r.city) || 0) + 1);
  }
  for (const r of db.prepare(`SELECT country, COUNT(DISTINCT user_id) n FROM member_signals WHERE country != '' AND at >= ? GROUP BY country`).all(since)) row(r.country).active = r.n;
  for (const r of db.prepare(`SELECT country, COUNT(DISTINCT user_id) n FROM member_signals WHERE country != '' AND at >= ? GROUP BY country`).all(today)) row(r.country).today = r.n;
  const countries = [...by.values()].map((g) => ({ c: g.c, members: g.members, active: g.active, today: g.today,
    cities: [...g.cities].sort((a, b) => b[1] - a[1]).slice(0, 3) })).sort((a, b) => b.members - a.members || b.active - a.active);
  const total = db.prepare(`SELECT COUNT(*) n FROM users`).get().n, placed = countries.reduce((a, g) => a + g.members, 0);
  res.json({ days, total, placed, countries });
});
