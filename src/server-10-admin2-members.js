/* ================================================================
   ADMIN · THE MEMBER DATABASE v1.0 — 2026-10-12. "The admin dashboard
   should include a database of all members and account information."
   GET /api/admin/members.csv — every member, one row each, with their
   account information, to open in Excel / Google Sheets / Numbers.
   Admins only (auth + admin, on the server). Never in it: password
   hashes, session tokens, the Stripe account id. Each download is
   written to the admin log. Cells that a spreadsheet would read as a
   formula (= + - @) are written as text.
================================================================ */
function csvCell(v) {
  if (v === null || v === undefined) return "";
  let s = String(v);
  if (/^[=+\-@\t\r]/.test(s)) s = "'" + s;   // a name like "=HYPERLINK(…)" stays words
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}
const isoOrBlank = (t) => (t ? new Date(t).toISOString().replace(/\.\d+Z$/, "Z") : "");
const MEMBER_CSV_COLS = [
  ["member_id", (r) => r.id], ["username", (r) => r.username], ["display_name", (r) => r.display_name], ["email", (r) => r.email],
  ["email_confirmed", (r) => (r.email_verified ? "yes" : "no")], ["role", (r) => r.role], ["roles", (r) => jsonList(r.roles).join("; ")],
  ["pronouns", (r) => r.pronouns], ["links", (r) => profileExtras(r).links.map((l) => l.url || l).join(" ")], ["bio", (r) => r.bio],
  ["joined", (r) => isoOrBlank(r.created_at)], ["last_opened_app", (r) => isoOrBlank(r.last_seen_at)], ["last_active", (r) => isoOrBlank(r.last_active)],
  ["rep", (r) => r.rep], ["level", (r) => "L" + levelFor(r.rep).id + " " + levelFor(r.rep).name], ["commission_pct", (r) => feeForRep(r.rep)],
  ["posts", (r) => r.posts], ["published_work", (r) => r.work], ["followers", (r) => r.followers], ["following", (r) => r.following],
  ["collabs", (r) => r.collabs], ["listings", (r) => r.listings], ["sold", (r) => r.sold], ["gross_sales_usd", (r) => (r.gross / 100).toFixed(2)],
  ["bought", (r) => r.bought], ["payouts", (r) => (r.stripe_ready ? "on" : r.stripe_account ? "started" : "off")],
  ["devices_signed_in", (r) => r.sessions], ["admin", (r) => (r.is_admin ? "yes" : "no")], ["suspended", (r) => (r.suspended ? "yes" : "no")],
  ["admin_note", (r) => r.note || ""],
];
app.get("/api/admin/members.csv", auth, admin, (req, res) => {
  const rows = db.prepare(`
    SELECT u.id, u.username, u.display_name, u.email, u.email_verified, u.role, u.roles, u.pronouns, u.link, u.links, u.bio,
           u.created_at, u.last_seen_at, u.rep, u.stripe_ready, u.stripe_account, u.is_admin, u.suspended,
      (SELECT COUNT(*) FROM posts p WHERE p.author_id = u.id) posts,
      (SELECT COUNT(*) FROM posts p WHERE p.author_id = u.id AND p.is_work = 1) work,
      (SELECT COUNT(*) FROM follows f WHERE f.followee_id = u.id) followers,
      (SELECT COUNT(*) FROM follows f WHERE f.follower_id = u.id) following,
      (SELECT COUNT(*) FROM collaborators c WHERE c.user_id = u.id AND c.status = 'accepted') collabs,
      (SELECT COUNT(*) FROM listings l WHERE l.seller_id = u.id) listings,
      (SELECT COUNT(*) FROM orders o WHERE o.seller_id = u.id AND o.status IN ${PAID}) sold,
      (SELECT COALESCE(SUM(o.amount_cents), 0) FROM orders o WHERE o.seller_id = u.id AND o.status IN ${PAID}) gross,
      (SELECT COUNT(*) FROM orders o WHERE o.buyer_id = u.id AND o.status IN ${PAID}) bought,
      (SELECT COUNT(*) FROM sessions s WHERE s.user_id = u.id) sessions,
      (SELECT n.body FROM admin_notes n WHERE n.user_id = u.id) note
    FROM users u ORDER BY u.created_at ASC`).all();
  const last = new Map(db.prepare(`SELECT u, MAX(t) t FROM (${ACTIVITY}) GROUP BY u`).all().map((r) => [r.u, r.t]));
  for (const r of rows) r.last_active = last.get(r.id) || null;
  const csv = [MEMBER_CSV_COLS.map(([h]) => h).join(","), ...rows.map((r) => MEMBER_CSV_COLS.map(([, f]) => csvCell(f(r))).join(","))].join("\r\n");
  auditAdmin(req, `downloaded the member database (${rows.length} members)`);
  const day = new Date().toISOString().slice(0, 10);
  res.set({ "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename="tnl-labs-members-${day}.csv"`, "Cache-Control": "no-store" });
  res.send("﻿" + csv);   // the BOM keeps emoji and accents right in Excel
});
