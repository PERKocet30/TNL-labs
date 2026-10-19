/* ================================================================
   DELETING AN ACCOUNT v1.0 — 2026-10-19. "Make sure I can delete the
   account I created to test." Then: "Just focus on admin." Members still
   email us to close an account (/privacy); an admin does it here:
     DELETE /api/admin/members/:username   (never another admin, never yourself)
   Deleting removes the member and everything that hangs off them — work,
   comments, likes, follows, messages, sessions — through the database's
   own ON DELETE rules (PRAGMA foreign_keys = ON in db.js); a few
   "who did it" columns (admin log, group creator, pins) go blank instead.
   An account with Market orders can't be deleted here: the law wants
   those records kept (/privacy); suspend it instead. Files the
   account uploaded are left for Admin → System → Cleanup.
   test/delete-account.test.mjs.
================================================================ */
function accountOrders(id) {
  return db.prepare(`SELECT COUNT(*) n FROM orders WHERE buyer_id = ? OR seller_id = ?`).get(id, id).n;
}
function deleteAccount(id) {
  db.prepare(`DELETE FROM users WHERE id = ?`).run(id);
  console.log(`[account] deleted user ${id}`);
}

app.delete("/api/admin/members/:username", auth, admin, (req, res) => {
  const u = q.userByName.get(String(req.params.username || "").toLowerCase());
  if (!u) return res.status(404).json({ error: "No such member." });
  if (u.id === req.user.id || u.is_admin) return res.status(400).json({ error: "Admins can't be deleted here." });
  const n = accountOrders(u.id);
  if (n) return res.status(409).json({ error: `@${u.username} has ${n} Market order${n === 1 ? "" : "s"}, kept for records. Suspend the account instead.` });
  deleteAccount(u.id);
  auditAdmin(req, "delete account");
  res.json({ ok: true });
});
