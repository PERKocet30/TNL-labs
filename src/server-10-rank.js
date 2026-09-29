/* ================================================================
   RANKING v2.0 — 2026-09-29. The Showroom and "Who's building".

   On the surface this reads like any good feed: fresh work, work people
   respond to, a mix of people, a bit more of who you follow. Nothing in
   the app explains it and nothing needs to.

   Underneath, the basis stays the same as it always was:
   - Only what OTHER people do counts. Your own likes, comments and shares
     on your own work are ignored.
   - A response from someone with standing (rep, earned from others) weighs
     a little more than one from a brand-new account — capped, so a few
     established members can't decide the page alone.
   - Work made together gets a lift — a confirmed collab counts like a
     couple of extra people responding. It no longer dominates (v1 gave a
     collab 30 points against 6 for a like), which let one collab sit on
     top for weeks.
   - Someone's first few pieces get a small start, so new members are seen.
   - One person can't fill the page: each extra piece of theirs in the same
     page is dampened.
   Tune the numbers here; nothing else depends on them.
================================================================ */
const RANK = {
  windowDays: 120,        // candidates: work from the last 120 days…
  candidates: 400,        // …at most this many
  standingCap: 2.5,       // max weight of one person's response
  collabLift: 1.5,        // per accepted collaborator, up to 3
  commentExtra: 0.5,      // a comment says more than a like
  newCreatorLift: 1,      // for someone's first 3 published pieces
  gravity: 1.35,          // how fast age pulls work down
  ageOffsetH: 3,
  followBoost: 1.3,       // you follow the author
  seenDamp: 0.45,         // you've already responded to it
  ownDamp: 0.8,           // your own work, in your own feed
  repeatDamp: 0.55,       // each extra piece by the same person on the page
};

/* How much one person's response counts, from their standing. */
const standingWeight = (rep) => Math.min(RANK.standingCap, 1 + 0.5 * Math.log2(1 + Math.max(0, rep || 0) / 40));

/* Engagement quality per post: who responded (not how often), weighted. */
function responseQuality(postIds) {
  const q = new Map(postIds.map((id) => [id, 0]));
  if (!postIds.length) return q;
  const holes = postIds.map(() => "?").join(",");
  // one row per (post, person) who liked, commented, reacted, saved or shared it — never the author
  const rows = db.prepare(`
    SELECT r.post_id, r.user_id, MAX(r.comment) comment, u.rep FROM (
      SELECT l.post_id, l.user_id, 0 comment FROM likes l WHERE l.post_id IN (${holes})
      UNION ALL SELECT c.post_id, c.author_id, 1 FROM comments c WHERE c.post_id IN (${holes})
      UNION ALL SELECT x.target_id, x.user_id, 0 FROM reactions x WHERE x.kind = 'post' AND x.target_id IN (${holes})
      UNION ALL SELECT pn.post_id, b.user_id, 0 FROM pins pn JOIN boards b ON b.id = pn.board_id WHERE pn.post_id IN (${holes})
      UNION ALL SELECT s.shared_from, s.author_id, 0 FROM posts s WHERE s.shared_from IN (${holes})
    ) r
    JOIN posts p ON p.id = r.post_id AND p.author_id != r.user_id
    JOIN users u ON u.id = r.user_id AND u.suspended = 0
    GROUP BY r.post_id, r.user_id`).all(...postIds, ...postIds, ...postIds, ...postIds, ...postIds);
  for (const r of rows) q.set(r.post_id, q.get(r.post_id) + standingWeight(r.rep) + (r.comment ? RANK.commentExtra : 0));
  for (const c of db.prepare(`SELECT post_id, COUNT(*) n FROM collaborators WHERE status = 'accepted' AND post_id IN (${holes}) GROUP BY post_id`).all(...postIds))
    q.set(c.post_id, q.get(c.post_id) + RANK.collabLift * Math.min(3, c.n));
  return q;
}

/* The Showroom, for one viewer (0 = signed out). Returns post ids in order. */
function rankShowroom(viewerId = 0, limit = 60) {
  const now = Date.now();
  const cands = db.prepare(`
    SELECT p.id, p.author_id, p.created_at,
      (SELECT COUNT(*) FROM posts e WHERE e.author_id = p.author_id AND e.is_work = 1 AND e.created_at <= p.created_at) nth
    FROM posts p JOIN users u ON u.id = p.author_id
    WHERE p.is_work = 1 AND p.shared_from IS NULL AND u.suspended = 0 AND p.created_at > ?
    ORDER BY p.created_at DESC LIMIT ?`).all(now - RANK.windowDays * 86400000, RANK.candidates);
  // a quiet stretch shouldn't leave the page empty: fall back to the newest work of any age
  if (cands.length < limit) {
    const have = new Set(cands.map((c) => c.id));
    for (const r of db.prepare(`SELECT p.id, p.author_id, p.created_at, 99 nth FROM posts p JOIN users u ON u.id = p.author_id
        WHERE p.is_work = 1 AND p.shared_from IS NULL AND u.suspended = 0 ORDER BY p.created_at DESC LIMIT ?`).all(limit * 2))
      if (!have.has(r.id)) cands.push(r);
  }
  const quality = responseQuality(cands.map((c) => c.id));
  const follows = viewerId ? new Set(db.prepare(`SELECT followee_id FROM follows WHERE follower_id = ?`).all(viewerId).map((r) => r.followee_id)) : new Set();
  const seen = viewerId ? new Set(db.prepare(`SELECT post_id FROM likes WHERE user_id = ? UNION SELECT post_id FROM comments WHERE author_id = ?`)
    .all(viewerId, viewerId).map((r) => r.post_id)) : new Set();
  const scored = cands.map((c) => {
    let s = (1 + quality.get(c.id) + (c.nth <= 3 ? RANK.newCreatorLift : 0))
      / Math.pow(Math.max(0, now - c.created_at) / 3600000 + RANK.ageOffsetH, RANK.gravity);
    if (follows.has(c.author_id)) s *= RANK.followBoost;
    if (seen.has(c.id)) s *= RANK.seenDamp;
    if (c.author_id === viewerId) s *= RANK.ownDamp;
    return { id: c.id, author: c.author_id, s };
  }).sort((a, b) => b.s - a.s);
  // variety: take the best, dampen that person's next piece, repeat
  const out = [], shown = new Map(), pool = scored.slice();
  while (out.length < limit && pool.length) {
    let best = 0, bestS = -1;
    for (let i = 0; i < pool.length; i++) {
      const v = pool[i].s * Math.pow(RANK.repeatDamp, shown.get(pool[i].author) || 0);
      if (v > bestS) { bestS = v; best = i; }
    }
    const [pick] = pool.splice(best, 1);
    out.push(pick.id); shown.set(pick.author, (shown.get(pick.author) || 0) + 1);
  }
  return out;
}

/* "Who's building": people making things lately that others respond to.
   Not a leaderboard — no numbers shown, and the viewer never sees themself. */
function rankBuilders(viewerId = 0, limit = 12) {
  const now = Date.now(), since = now - 30 * 86400000;
  const recent = db.prepare(`SELECT p.id, p.author_id, p.created_at FROM posts p JOIN users u ON u.id = p.author_id
    WHERE p.is_work = 1 AND p.shared_from IS NULL AND u.suspended = 0 AND p.created_at > ?`).all(since);
  const quality = responseQuality(recent.map((r) => r.id));
  const by = new Map();
  for (const r of recent) {
    const b = by.get(r.author_id) || { q: 0, last: 0, n: 0 };
    b.q += quality.get(r.id); b.n++; b.last = Math.max(b.last, r.created_at);
    by.set(r.author_id, b);
  }
  const ranked = [...by.entries()].filter(([id]) => id !== viewerId)
    .map(([id, b]) => ({ id, s: (1 + b.q + Math.min(3, b.n)) / Math.pow((now - b.last) / 86400000 + 2, 0.8) }))
    .sort((a, b) => b.s - a.s).slice(0, limit).map((x) => x.id);
  // a quiet month: fill the row with whoever posted work most recently
  if (ranked.length < limit) for (const r of db.prepare(`SELECT p.author_id id, MAX(p.created_at) t FROM posts p JOIN users u ON u.id = p.author_id
      WHERE p.is_work = 1 AND u.suspended = 0 GROUP BY p.author_id ORDER BY t DESC LIMIT ?`).all(limit * 2)) {
    if (ranked.length >= limit) break;
    if (r.id !== viewerId && !ranked.includes(r.id)) ranked.push(r.id);
  }
  return ranked;
}
