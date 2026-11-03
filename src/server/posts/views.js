/* ================================================================
   VIEWS v1.0 — 2026-11-03. "Count 'viewed it, kept scrolling' as a signal."
   Until now a piece only scored when someone acted on it, and most members
   look without acting. The app now says which pieces were on screen
   (app/showroom/views.js: a card most of the way in view for a moment, or
   a post opened), in batches: POST /api/views { ids }.
     post_views  one row per piece, per viewer, per day (UTC). The viewer is
                 "u:<id>" signed in, else "d:<device>" (the phone's random
                 mark, X-Device — the same mark the tournament uses). No
                 time, no place, no page. Rows older than the ranking's
                 window are dropped daily.
   The ranking (server/posts/rank.js) reads: how many different people saw a
   piece (never its author), and which pieces a viewer has already seen on
   two different days.
================================================================ */
db.exec(`CREATE TABLE IF NOT EXISTS post_views (post_id INTEGER NOT NULL, viewer TEXT NOT NULL, day INTEGER NOT NULL, PRIMARY KEY (post_id, viewer, day));
CREATE INDEX IF NOT EXISTS idx_post_views_post ON post_views(post_id);
CREATE INDEX IF NOT EXISTS idx_post_views_viewer ON post_views(viewer)`);
const VIEW_DAY_MS = 86400000, VIEW_KEEP_DAYS = 150;
const viewerKey = (req) => (req.user ? "u:" + req.user.id : (deviceOf(req) ? "d:" + deviceOf(req) : ""));
const viewAdd = db.prepare(`INSERT OR IGNORE INTO post_views (post_id, viewer, day) VALUES (?, ?, ?)`);
const viewPostOk = db.prepare(`SELECT 1 FROM posts WHERE id = ?`);
app.post("/api/views", maybeAuth, rateLimit({ max: 90, windowMs: 60000 }), (req, res) => {
  const key = viewerKey(req);
  const ids = [...new Set((Array.isArray(req.body?.ids) ? req.body.ids : []).map(Number).filter((n) => Number.isInteger(n) && n > 0))].slice(0, 40);
  if (!key || !ids.length) return res.json({ ok: true, n: 0 });
  const day = Math.floor(Date.now() / VIEW_DAY_MS);
  let n = 0;
  for (const id of ids) if (viewPostOk.get(id)) n += viewAdd.run(id, key, day).changes;
  res.json({ ok: true, n });
});
/* old rows go: the ranking only looks back 120 days */
function viewsPrune(now = Date.now()) { return db.prepare(`DELETE FROM post_views WHERE day < ?`).run(Math.floor(now / VIEW_DAY_MS) - VIEW_KEEP_DAYS).changes; }
if (!process.env.TNL_NO_WATCH) { setTimeout(() => { try { viewsPrune(); } catch (e) {} }, 60000).unref?.(); setInterval(() => { try { viewsPrune(); } catch (e) {} }, VIEW_DAY_MS).unref?.(); }
