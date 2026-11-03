/* ================================================================
   SELL WALK · what we learn v1.0 — 2026-11-03. "You ask the questions to
   learn what type of seller they are and what they do."
   The sell walkthrough (app/market/sell-walk.js) asks one question a
   screen. Each screen a seller reaches is a row here, so the admin can see
   who's listing (brand · vintage · one of one, by department) and how far
   people get before they stop — by seller type. Metadata only: the step
   name and the answers so far (department, category, who's selling), tied
   to a walk id the app makes for each new listing. No title, price, words
   or photos; the listing itself has those once it's published. Rows go
   after 180 days: this is a signal, not an archive.
     POST /api/market/walk { walk, step, dept, category, sellType }
     sell_walk rows, once per step per walk (the app sends each once)
     the create route logs "listed" with the walk id (admin/settings-payouts-market)
================================================================ */
db.exec(`CREATE TABLE IF NOT EXISTS sell_walk (
  id INTEGER PRIMARY KEY AUTOINCREMENT, user_id INTEGER REFERENCES users(id) ON DELETE SET NULL, walk TEXT NOT NULL,
  step TEXT NOT NULL, dept TEXT NOT NULL DEFAULT '', category TEXT NOT NULL DEFAULT '', sell_type TEXT NOT NULL DEFAULT '',
  listing_id INTEGER, created_at INTEGER NOT NULL, UNIQUE (walk, step));
CREATE INDEX IF NOT EXISTS idx_sell_walk_at ON sell_walk(created_at)`);
const WALK_STEPS = ["what", "who", "photos", "words", "stock", "details", "details:skip", "price", "review", "listed"];
const WALK_TYPES = ["brand", "vintage", "custom"];
const walkIns = db.prepare(`INSERT OR IGNORE INTO sell_walk (user_id, walk, step, dept, category, sell_type, listing_id, created_at) VALUES (?,?,?,?,?,?,?,?)`);
const walkClean = (s, max) => String(s || "").trim().slice(0, max);
function sellWalkLog(userId, b, listingId = null) {
  const walk = walkClean(b.walk, 32), step = walkClean(b.step, 16);
  if (!/^[a-f0-9]{8,32}$/.test(walk) || !WALK_STEPS.includes(step)) return false;
  const category = walkClean(b.category, 40), dept = (TAX_CATS.get(category) || {}).dept || walkClean(b.dept, 20);
  const sellType = WALK_TYPES.includes(b.sellType) ? b.sellType : "";
  return walkIns.run(userId, walk, step, dept, category, sellType, listingId, Date.now()).changes > 0;
}
app.post("/api/market/walk", auth, rateLimit({ max: 60, windowMs: 60000, key: "user" }), (req, res) => {
  const b = req.body || {};
  if (b.step === "listed") return res.status(400).json({ error: "listed is logged by listing" });
  res.json({ ok: sellWalkLog(req.user.id, b) });
});
function sellWalkPrune(now = Date.now()) { return db.prepare(`DELETE FROM sell_walk WHERE created_at < ?`).run(now - 180 * 86400000).changes; }
if (!process.env.TNL_NO_WATCH) setInterval(() => { try { sellWalkPrune(); } catch (e) {} }, 86400000).unref?.();

/* For Admin → Sellers (and the connector's `sellers`): counts only, never a name.
   - whoLists: sellers and live listings by type and by department (from the listings themselves)
   - walk: in the window, how many walks reached each step — in all, and by seller type once it's known */
function sellWalkStats(days = 30, now = Date.now()) {
  const since = now - days * 86400000;
  const byType = db.prepare(`SELECT COALESCE(NULLIF(sell_type, ''), 'unsaid') k, COUNT(DISTINCT seller_id) sellers, COUNT(*) listings FROM listings WHERE status = 'active' AND kind != 'loop' GROUP BY k`).all();
  const deptRows = db.prepare(`SELECT category, seller_id FROM listings WHERE status = 'active' AND kind != 'loop'`).all();
  const byDept = new Map();
  for (const r of deptRows) { const d = (TAX_CATS.get(r.category) || {}).dept || "Other"; const g = byDept.get(d) || { k: d, sellers: new Set(), listings: 0 }; g.sellers.add(r.seller_id); g.listings++; byDept.set(d, g); }
  const rows = db.prepare(`SELECT walk, step, sell_type FROM sell_walk WHERE created_at > ?`).all(since);
  const typeOf = new Map();   // a walk's seller type: the latest answer it gave
  for (const r of rows) if (r.sell_type) typeOf.set(r.walk, r.sell_type);
  const reached = (step, type) => new Set(rows.filter((r) => r.step === step && (!type || typeOf.get(r.walk) === type)).map((r) => r.walk)).size;
  const steps = WALK_STEPS.filter((s) => s !== "details:skip").map((s) => ({ step: s, n: reached(s), ...Object.fromEntries(WALK_TYPES.map((t) => [t, reached(s, t)])) }));
  const walks = new Set(rows.map((r) => r.walk)).size, listed = reached("listed");
  return {
    days, whoLists: { byType: byType.map((r) => ({ k: r.k, sellers: r.sellers, listings: r.listings })), byDept: [...byDept.values()].map((g) => ({ k: g.k, sellers: g.sellers.size, listings: g.listings })).sort((a, b) => b.listings - a.listings) },
    walk: { walks, listed, skippedDetails: reached("details:skip"), steps, byType: WALK_TYPES.map((t) => ({ k: t, walks: new Set(rows.filter((r) => typeOf.get(r.walk) === t).map((r) => r.walk)).size, listed: reached("listed", t) })) },
  };
}
