/* ================================================================
   RANKING v3.0 — 2026-11-03. v2.1 — 2026-10-29 (#hashtags lift a piece —
   "people who use hashtags get better exposure in our showroom because it
   helps define the uploads"). v2.0 — 2026-09-29. The Showroom and "Who's building".

   v3.0 adds five things, all tuned in RANK below:
   - Views are a signal. Most people look without acting, and until now that
     said nothing. A piece that many saw and few responded to is quieter than
     one that few saw and most responded to: the response RATE (people who
     responded ÷ people who saw it, as if at least viewFloor had seen it, so a
     piece three people saw isn't judged on three) lifts the piece up to
     viewLift. Views come from the app
     (server/posts/views.js, one per person per day, never the author).
     Seeing a piece on two different days and never responding dampens it for
     you, like having responded to it does — you've had your look.
   - Your labs lean. What you make (your roles → ROLE_LABS) and what you've
     responded to and looked at lately say which labs are yours; work from
     those labs scores up to labBoost more for you. Everything else stays at 1,
     so a lean is never a wall — a painter still sees music.
   - Gravity by lab. Music keeps longer than a news post: each lab can set how
     fast age pulls its work down (gravityByLab, lower = keeps longer), the
     rest use gravity. Age is measured against ageOffsetH so every lab starts
     at the same height — a lab's gravity changes how it fades, not where it
     begins.
   - A clique can't carry a piece. A person who responds to most of the
     same author's pieces on the page is a friend, not an audience: their
     response still counts, at cliqueDamp. (Standing already caps any one
     person; this caps the same few people, over and over.)
   - Standing fades, gently. Rep is forever (levels, fees, the profile all read
     users.rep); only the WEIGHT of your response here reads rep_events and
     counts points older than repFreshDays at repOldWeight. Someone active now
     weighs what they've earned; someone who left a year ago weighs half.

   On the surface this reads like any good feed: fresh work, work people
   respond to, a mix of people, a bit more of who you follow. Nothing in
   the app explains it and nothing needs to.

   Underneath, the basis stays the same as it always was:
   - Only what OTHER people do counts. Your own likes, comments and shares
     on your own work are ignored.
   - A response from someone with standing (rep, earned from others) weighs
     a little more than one from a brand-new account — capped, so a few
     established members can't decide the page alone.
   - Sending a piece to someone in a DM says the most: you put your name
     to it, to one person (Instagram calls sends its strongest signal for
     reaching new people). It counts a little more than a comment.
   - Work made together gets a lift — a confirmed collab counts like a
     couple of extra people responding. It no longer dominates (v1 gave a
     collab 30 points against 6 for a like), which let one collab sit on
     top for weeks.
   - Someone's first few pieces get a small start, so new members are seen.
   - One person can't fill the page: each extra piece of theirs in the same
     page is dampened.
   - A piece tagged with #hashtags says what it is, so it gets a lift: a
     little for each tag, up to three. Stuffing a caption with tags earns
     nothing (more than ten and the lift is gone), and it's never worth
     more than a few people responding — the work still has to land.
   Tune the numbers here; nothing else depends on them.
================================================================ */
const RANK = {
  windowDays: 120,        // candidates: work from the last 120 days…
  candidates: 400,        // …at most this many
  standingCap: 2.5,       // max weight of one person's response
  collabLift: 1.5,        // per accepted collaborator, up to 3
  commentExtra: 0.5,      // a comment says more than a like
  sendExtra: 0.75,        // sending it to someone in a DM says more still
  newCreatorLift: 1,      // for someone's first 3 published pieces
  gravity: 1.35,          // how fast age pulls work down
  ageOffsetH: 3,
  followBoost: 1.3,       // you follow the author
  seenDamp: 0.4,          // you've already responded to it (0.45 before v3.0; the view lift made one like heavier)
  ownDamp: 0.8,           // your own work, in your own feed
  repeatDamp: 0.55,       // each extra piece by the same person on the page
  tagLift: 0.4,           // per #hashtag on the piece…
  tagMax: 3,              // …counting up to three
  tagSpam: 10,            // more than this many tags: no lift at all
  /* v3.0 */
  viewLift: 1,            // a piece everyone who saw it responded to: × (1 + viewLift)
  rateFull: 0.25,         // a response rate this high (1 in 4) earns the whole lift
  viewFloor: 20,          // the rate is judged as if at least this many had seen it
  viewedDamp: 0.7,        // you've looked at it on two different days and left it
  labBoost: 0.5,          // a lab that's wholly yours: × (1 + labBoost); others stay at 1
  affinityDays: 90,       // what you responded to and looked at lately, this far back
  gravityByLab: { culture: 1.15, pharmacy: 1.25, fashion: 1.25, casino: 1.6 },  // a lab's own gravity — lower keeps longer (else gravity)
  cliqueMin: 3,           // an author with at least this many pieces on the page…
  cliqueShare: 0.6,       // …and one person responding to this share of them…
  cliqueDamp: 0.5,        // …counts that person at this weight on each
  repFreshDays: 180,      // rep earned within this long counts in full for standing…
  repOldWeight: 0.5,      // …older rep counts this much (levels and fees never change)
};
/* #tags in a caption, the way the labs read them (bodyTags in server/labs/places.js): 2–30 letters, numbers
   or _, not inside a link or an HTML entity, each counted once. Kept here so the ranking stands alone. */
const RANK_TAG_RE = /(^|[^\w&#/])#([a-z0-9_]{2,30})(?![\w])/gi;
function rankTagLift(body) {
  const tags = new Set();
  for (const m of String(body || "").replace(/https?:\/\/\S+/g, " ").matchAll(RANK_TAG_RE)) tags.add(m[2].toLowerCase());
  return tags.size > RANK.tagSpam ? 0 : RANK.tagLift * Math.min(RANK.tagMax, tags.size);
}

/* How much one person's response counts, from their standing. */
const standingWeight = (rep) => Math.min(RANK.standingCap, 1 + 0.5 * Math.log2(1 + Math.max(0, rep || 0) / 40));

/* Standing as it is NOW (v3.0): rep from the log, older points at repOldWeight. A member with no log
   (rep set before the log existed) keeps users.rep. Only this file reads it this way. */
function freshRep(userIds) {
  const rep = new Map();
  if (!userIds.length) return rep;
  const holes = userIds.map(() => "?").join(","), cut = Date.now() - RANK.repFreshDays * 86400000;
  for (const r of db.prepare(`SELECT user_id, SUM(CASE WHEN created_at > ? THEN amount ELSE amount * ? END) rep FROM rep_events WHERE user_id IN (${holes}) GROUP BY user_id`).all(cut, RANK.repOldWeight, ...userIds))
    rep.set(r.user_id, r.rep);
  return rep;
}

/* How many different people saw each piece (v3.0) — never its author. Empty before the first views arrive. */
function viewCounts(postIds) {
  const v = new Map(postIds.map((id) => [id, 0]));
  if (!postIds.length) return v;
  const holes = postIds.map(() => "?").join(",");
  for (const r of db.prepare(`SELECT w.post_id, COUNT(DISTINCT w.viewer) n FROM post_views w JOIN posts p ON p.id = w.post_id AND w.viewer != 'u:' || p.author_id
      WHERE w.post_id IN (${holes}) GROUP BY w.post_id`).all(...postIds)) v.set(r.post_id, r.n);
  return v;
}

/* Engagement quality per post: who responded (not how often), weighted. Also how many people
   (q.people, for the response rate). */
function responseQuality(postIds) {
  const q = new Map(postIds.map((id) => [id, 0]));
  q.people = new Map(postIds.map((id) => [id, 0]));
  if (!postIds.length) return q;
  const holes = postIds.map(() => "?").join(",");
  // one row per (post, person) who liked, commented, reacted, saved, shared or sent it — never the author
  const rows = db.prepare(`
    SELECT r.post_id, r.user_id, MAX(r.comment) comment, MAX(r.sent) sent, u.rep, p.author_id FROM (
      SELECT l.post_id, l.user_id, 0 comment, 0 sent FROM likes l WHERE l.post_id IN (${holes})
      UNION ALL SELECT c.post_id, c.author_id, 1, 0 FROM comments c WHERE c.post_id IN (${holes})
      UNION ALL SELECT x.target_id, x.user_id, 0, 0 FROM reactions x WHERE x.kind = 'post' AND x.target_id IN (${holes})
      UNION ALL SELECT pn.post_id, b.user_id, 0, 0 FROM pins pn JOIN boards b ON b.id = pn.board_id WHERE pn.post_id IN (${holes})
      UNION ALL SELECT s.shared_from, s.author_id, 0, 0 FROM posts s WHERE s.shared_from IN (${holes})
      UNION ALL SELECT m.post_id, m.sender_id, 0, 1 FROM dm_messages m WHERE m.post_id IN (${holes}) AND m.deleted_at IS NULL
    ) r
    JOIN posts p ON p.id = r.post_id AND p.author_id != r.user_id
    JOIN users u ON u.id = r.user_id AND u.suspended = 0
    GROUP BY r.post_id, r.user_id`).all(...postIds, ...postIds, ...postIds, ...postIds, ...postIds, ...postIds);
  const fresh = freshRep([...new Set(rows.map((r) => r.user_id))]);
  // the clique: how many of each author's pieces here one person responded to
  const byAuthor = new Map(), pair = new Map();
  for (const r of db.prepare(`SELECT author_id a, COUNT(*) n FROM posts WHERE id IN (${holes}) GROUP BY author_id`).all(...postIds)) byAuthor.set(r.a, r.n);
  for (const r of rows) { const k = r.author_id + ":" + r.user_id; pair.set(k, (pair.get(k) || 0) + 1); }
  for (const r of rows) {
    const n = byAuthor.get(r.author_id) || 0, clique = n >= RANK.cliqueMin && pair.get(r.author_id + ":" + r.user_id) / n >= RANK.cliqueShare;
    const w = (standingWeight(fresh.has(r.user_id) ? fresh.get(r.user_id) : r.rep) + (r.comment ? RANK.commentExtra : 0) + (r.sent ? RANK.sendExtra : 0)) * (clique ? RANK.cliqueDamp : 1);
    q.set(r.post_id, q.get(r.post_id) + w); q.people.set(r.post_id, q.people.get(r.post_id) + 1);
  }
  for (const c of db.prepare(`SELECT post_id, COUNT(*) n FROM collaborators WHERE status = 'accepted' AND post_id IN (${holes}) GROUP BY post_id`).all(...postIds))
    q.set(c.post_id, q.get(c.post_id) + RANK.collabLift * Math.min(3, c.n));
  return q;
}

/* Which lab a channel belongs to (LAB_OF, server/labs/places.js); '' for profile posts and when the map isn't loaded. */
const rankLabOf = (ch) => (typeof LAB_OF !== "undefined" && LAB_OF[ch]) || "";
const rankGravity = (lab) => RANK.gravityByLab[lab] || RANK.gravity;

/* Your labs (v3.0): a multiplier per lab for one viewer. Roles say what you make (the first role counts
   most, a role's second lab half); what you liked, commented on and looked at lately says what you
   come for. Each lab's share of that → 1 + labBoost × share. Labs you have nothing to do with stay at 1. */
function labAffinity(viewerId) {
  const score = {};
  if (!viewerId) return score;
  const u = db.prepare(`SELECT role, roles FROM users WHERE id = ?`).get(viewerId);
  let roles = []; try { roles = JSON.parse(u?.roles || "[]"); } catch (e) {}
  if (!roles.length && u?.role) roles = [u.role];
  const RL = typeof ROLE_LABS !== "undefined" ? ROLE_LABS : {};
  roles.slice(0, 5).forEach((r, i) => (RL[r] || []).forEach((lab, j) => { score[lab] = (score[lab] || 0) + (5 - i) * (j ? 0.5 : 1); }));
  const since = Date.now() - RANK.affinityDays * 86400000;
  const acts = db.prepare(`SELECT p.channel, COUNT(*) n FROM (
      SELECT post_id FROM likes WHERE user_id = ? AND created_at > ?
      UNION ALL SELECT post_id FROM comments WHERE author_id = ? AND created_at > ?
      UNION ALL SELECT post_id FROM post_views WHERE viewer = ? AND day > ?
    ) a JOIN posts p ON p.id = a.post_id WHERE p.author_id != ? GROUP BY p.channel`)
    .all(viewerId, since, viewerId, since, "u:" + viewerId, Math.floor(since / 86400000), viewerId);
  for (const r of acts) { const lab = rankLabOf(r.channel); if (lab) score[lab] = (score[lab] || 0) + r.n; }
  const total = Object.values(score).reduce((a, b) => a + b, 0), out = {};
  if (total > 0) for (const lab in score) out[lab] = 1 + RANK.labBoost * (score[lab] / total);
  return out;
}

/* The Showroom, for one viewer (0 = signed out). Returns post ids in order. */
function rankShowroom(viewerId = 0, limit = 60) {
  const now = Date.now();
  const cands = db.prepare(`
    SELECT p.id, p.author_id, p.created_at, p.body, p.channel,
      (SELECT COUNT(*) FROM posts e WHERE e.author_id = p.author_id AND e.is_work = 1 AND e.created_at <= p.created_at) nth
    FROM posts p JOIN users u ON u.id = p.author_id
    WHERE p.is_work = 1 AND p.shared_from IS NULL AND u.suspended = 0 AND p.created_at > ?
    ORDER BY p.created_at DESC LIMIT ?`).all(now - RANK.windowDays * 86400000, RANK.candidates);
  // a quiet stretch shouldn't leave the page empty: fall back to the newest work of any age
  if (cands.length < limit) {
    const have = new Set(cands.map((c) => c.id));
    for (const r of db.prepare(`SELECT p.id, p.author_id, p.created_at, p.body, p.channel, 99 nth FROM posts p JOIN users u ON u.id = p.author_id
        WHERE p.is_work = 1 AND p.shared_from IS NULL AND u.suspended = 0 ORDER BY p.created_at DESC LIMIT ?`).all(limit * 2))
      if (!have.has(r.id)) cands.push(r);
  }
  const quality = responseQuality(cands.map((c) => c.id)), views = viewCounts(cands.map((c) => c.id));
  const follows = viewerId ? new Set(db.prepare(`SELECT followee_id FROM follows WHERE follower_id = ?`).all(viewerId).map((r) => r.followee_id)) : new Set();
  const seen = viewerId ? new Set(db.prepare(`SELECT post_id FROM likes WHERE user_id = ? UNION SELECT post_id FROM comments WHERE author_id = ?`)
    .all(viewerId, viewerId).map((r) => r.post_id)) : new Set();
  // looked at on two different days, never responded (v3.0)
  const viewed = viewerId ? new Set(db.prepare(`SELECT post_id FROM post_views WHERE viewer = ? GROUP BY post_id HAVING COUNT(*) >= 2`).all("u:" + viewerId).map((r) => r.post_id)) : new Set();
  const affinity = labAffinity(viewerId);
  const scored = cands.map((c) => {
    const rate = quality.people.get(c.id) / Math.max(RANK.viewFloor, views.get(c.id));
    let s = (1 + quality.get(c.id) + (c.nth <= 3 ? RANK.newCreatorLift : 0) + rankTagLift(c.body))
      * (1 + RANK.viewLift * Math.min(1, rate / RANK.rateFull))
      / Math.pow((Math.max(0, now - c.created_at) / 3600000 + RANK.ageOffsetH) / RANK.ageOffsetH, rankGravity(rankLabOf(c.channel)));
    s *= affinity[rankLabOf(c.channel)] || 1;
    if (follows.has(c.author_id)) s *= RANK.followBoost;
    if (seen.has(c.id)) s *= RANK.seenDamp;
    else if (viewed.has(c.id)) s *= RANK.viewedDamp;
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
