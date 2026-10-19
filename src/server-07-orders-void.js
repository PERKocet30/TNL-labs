/* ── VOID A TEST ORDER v1.0 — 2026-10-18 ────────────────────────────────
   "These sales never happen, only testing." An admin can mark an order
   (and the rest of its bag) as a test: it leaves both people's order lists,
   every sales number and the seller's reviews, and the rep the sale gave
   is taken back through the append-only log (revokeRep — nothing is
   erased). Money isn't touched: a real test payment is refunded from the
   seller's own Stripe dashboard. Admin only, checked here on the server,
   and written to the admin log like every admin change. */
app.post("/api/admin/orders/:id/void", auth, admin, (req, res) => {
  const o = db.prepare(`SELECT * FROM orders WHERE id = ?`).get(Number(req.params.id));
  if (!o) return res.status(404).json({ error: "no order" });
  const group = o.cart_id ? db.prepare(`SELECT * FROM orders WHERE cart_id = ?`).all(o.cart_id) : [o];
  const repGiven = db.prepare(`SELECT COALESCE(SUM(amount), 0) n FROM rep_events WHERE user_id = ? AND kind = ? AND source_id = ?`);
  let taken = 0;
  for (const g of group) {
    if (g.status === "void") continue;
    for (const kind of ["sale_made", "delivery_confirmed"]) {
      if (repGiven.get(g.seller_id, kind, g.id).n > 0) taken -= revokeRep(g.seller_id, kind, g.id);
    }
    db.prepare(`DELETE FROM reviews WHERE order_id = ?`).run(g.id);
    db.prepare(`UPDATE orders SET status = 'void', updated_at = ? WHERE id = ?`).run(Date.now(), g.id);
  }
  res.json({ ok: true, voided: group.length, repTaken: taken, wasPaid: !!o.payment_ref });
});
