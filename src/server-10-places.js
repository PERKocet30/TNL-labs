
/* ================================================================
   PLACES v1.0 — 2026-10-08. Labs are places, one per genre — not
   Discord servers full of channels. Inside each lab:
     Work   everything made here, a grid — filter by #tag
     Talk   one conversation (the lab's home channel; the old channels'
            history is merged in)
     Open   what you can join right now: events, #collab calls, gigs
     Pulse  what's rising this week, the tags, who's active

   Sub-channels are gone from the app, not from the data: every channel
   id stays exactly as stored (CLAUDE.md: ids never change). New posts go
   to the lab's home channel. People tag their own work with #hashtags in
   the caption. Posts made before this version carry their old channel's
   name as a tag (#photography, #feedback…), worked out when read — no
   post is rewritten. PLACES must match LABS in app-07-theme-labs-api.js
   and LAB_HOME in app-11-places.js (test/places.test.mjs checks).
================================================================ */
const PLACES = {
  hq:       { home: "general",         channels: ["general", "collab-posts"] },
  pharmacy: { home: "creators",        channels: ["creators", "graphic-design", "photography", "cinematography", "video-editing", "archive"] },
  culture:  { home: "music-chat",      channels: ["tracks", "feedback", "music-chat", "beats"] },
  fashion:  { home: "clothing-design", channels: ["clothing-design", "clothing-drops"] },
  akatsuki: { home: "anime-chat",      channels: ["anime-chat", "manga", "anime-news", "anime-ideas"] },
  casino:   { home: "news",            channels: ["magazine", "news", "promos"] },
  tna:      { home: "opportunities",   channels: ["opportunities", "coding", "finance"] },
};
/* The old channel → the tag its posts carry. */
const CHANNEL_TAG = {
  "general": "general", "collab-posts": "collab", "creators": "creators", "graphic-design": "graphicdesign",
  "photography": "photography", "cinematography": "cinematography", "video-editing": "videoediting",
  "tracks": "tracks", "feedback": "feedback", "music-chat": "chat", "beats": "beats",
  "clothing-design": "clothingdesign", "clothing-drops": "drops", "anime-chat": "chat", "manga": "manga",
  "anime-news": "animenews", "anime-ideas": "ideas", "magazine": "magazine", "news": "news", "promos": "promos",
  "opportunities": "opportunities", "coding": "coding", "finance": "finance",
};
/* Tags that mean "join me / hire me" — they fill a lab's Open tab. */
const CALL_TAGS = new Set(["collab", "opencall", "lookingfor", "gig", "gigs", "hiring", "opportunities", "brief", "commission", "commissions"]);
const LAB_OF = Object.fromEntries(Object.entries(PLACES).flatMap(([lab, p]) => p.channels.map((c) => [c, lab])));

/* When the old channels stopped being rooms. Set once, on the first boot
   of this version; posts from before it carry their channel's tag. */
db.exec(`CREATE TABLE IF NOT EXISTS place_meta (key TEXT PRIMARY KEY, value TEXT NOT NULL)`);
db.prepare(`INSERT OR IGNORE INTO place_meta (key, value) VALUES ('cutover', ?)`).run(String(Date.now()));
const PLACE_CUTOVER = Number(db.prepare(`SELECT value FROM place_meta WHERE key = 'cutover'`).get().value);

/* #tags in a caption: letters, numbers, underscore, 2–30 long. Not inside
   a link (…/#x) or an HTML entity (&#39;). Lowercase, deduped. */
const TAG_RE = /(^|[^\w&#/])#([a-z0-9_]{2,30})(?![\w])/gi;
function bodyTags(body) {
  const out = new Set();
  for (const m of String(body || "").replace(/https?:\/\/\S+/g, " ").matchAll(TAG_RE)) out.add(m[2].toLowerCase());
  return [...out];
}
function rowTags(row) {
  const t = bodyTags(row.body);
  const old = (row.created_at ?? row.createdAt) < PLACE_CUTOVER ? CHANNEL_TAG[row.channel] : null;
  if (old && !t.includes(old)) t.push(old);
  return t;
}
const cleanTag = (s) => String(s || "").replace(/^#/, "").toLowerCase().replace(/[^a-z0-9_]/g, "").slice(0, 30);
const placeOr404 = (req, res) => { const p = PLACES[req.params.lab]; if (!p) res.status(404).json({ error: "No such lab." }); return p; };
const inList = (arr) => arr.map((c) => `'${c.replace(/'/g, "")}'`).join(",");

/* Candidate rows for a tag: the caption mentions it, or the post is from
   before the cutover in a channel that carries it. rowTags() then checks
   the exact word (#photo isn't #photography). */
function tagCandidates(tag, channels, { workOnly = false, since = 0, limit = 400 } = {}) {
  const fromCh = Object.entries(CHANNEL_TAG).filter(([c, t]) => t === tag && (!channels || channels.includes(c))).map(([c]) => c);
  const where = [`(p.body LIKE ? ${fromCh.length ? `OR (p.channel IN (${inList(fromCh)}) AND p.created_at < ${PLACE_CUTOVER})` : ""})`];
  if (channels) where.push(`p.channel IN (${inList(channels)})`);
  if (workOnly) where.push(`p.is_work = 1`);
  if (since) where.push(`p.created_at >= ${Number(since)}`);
  return db.prepare(`SELECT p.id, p.body, p.channel, p.created_at, p.is_work FROM posts p WHERE ${where.join(" AND ")} ORDER BY p.created_at DESC LIMIT ${limit}`)
    .all(`%#${tag}%`).filter((r) => rowTags(r).includes(tag));
}

/* Posts by id, shaped like every other feed, with their tags, in the order
   given, minus anyone the viewer has blocked. */
function placePosts(ids, req) {
  if (!ids.length) return [];
  const hidden = req.user ? blockedIds(req.user.id) : new Set();
  const rows = feedRows({ ids, viewerId: req.user?.id, limit: ids.length }).filter((r) => !hidden.has(r.author_username));
  const byId = new Map(rows.map((r) => [r.id, r]));
  const at = new Map(ids.map((id, i) => [Number(id), i]));   // keep the order asked for (rising is by score)
  return shapePosts(rows).map((p) => ({ ...p, tags: rowTags(byId.get(p.id) || p) })).sort((a, b) => at.get(a.id) - at.get(b.id));
}

/* The most used tags among some posts. */
function topTags(rows, n = 12) {
  const c = new Map();
  for (const r of rows) for (const t of rowTags(r)) c.set(t, (c.get(t) || 0) + 1);
  return [...c].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).slice(0, n).map(([tag, count]) => ({ tag, count }));
}

app.get("/api/places", (_req, res) => res.json({ places: PLACES, callTags: [...CALL_TAGS] }));

/* Talk: one conversation per lab — every channel's history, newest 50.
   Pins are the home channel's. */
app.get("/api/labs/:lab/feed", auth, (req, res) => {
  const P = placeOr404(req, res); if (!P) return;
  const ids = db.prepare(`SELECT id FROM posts WHERE channel IN (${inList(P.channels)}) ORDER BY created_at DESC LIMIT 50`).all().map((r) => r.id);
  const hidden = blockedIds(req.user.id);
  res.json({ lab: req.params.lab, home: P.home, posts: placePosts(ids, req), pins: pinsFor(P.home).filter((p) => !hidden.has(p.author.username)) });
});

/* Work: everything made here, optionally one #tag; plus the lab's tags. */
app.get("/api/labs/:lab/work", auth, (req, res) => {
  const P = placeOr404(req, res); if (!P) return;
  const tag = cleanTag(req.query.tag);
  const ids = tag
    ? tagCandidates(tag, P.channels, { workOnly: true, limit: 120 }).map((r) => r.id)
    : db.prepare(`SELECT id FROM posts WHERE channel IN (${inList(P.channels)}) AND is_work = 1 ORDER BY created_at DESC LIMIT 120`).all().map((r) => r.id);
  const recent = db.prepare(`SELECT body, channel, created_at FROM posts WHERE channel IN (${inList(P.channels)}) ORDER BY created_at DESC LIMIT 400`).all();
  res.json({ lab: req.params.lab, tag: tag || null, posts: placePosts(ids, req), tags: topTags(recent) });
});

/* Open: what you can join right now — live events in this lab, and calls
   (#collab, #gig, #opportunities…) from the last 45 days. */
app.get("/api/labs/:lab/open", auth, (req, res) => {
  const P = placeOr404(req, res); if (!P) return;
  const events = db.prepare(`SELECT * FROM events WHERE published = 1 AND channel IN (${inList(P.channels)}) ORDER BY id DESC LIMIT 10`).all()
    .map((e) => { tickEvent(e); const ph = phaseAt(evJSON(e.schedule, []));
      return evJSON(e.state, {}).void || ph.phase === "results" ? null : { slug: e.slug, title: e.title, coverUrl: e.cover_url, prize: e.prize, phase: ph.phase, end: ph.end }; })
    .filter(Boolean);
  const since = Date.now() - 45 * 86400000;
  const rows = db.prepare(`SELECT id, body, channel, created_at FROM posts WHERE channel IN (${inList(P.channels)}) AND created_at >= ? ORDER BY created_at DESC LIMIT 600`).all(since);
  const calls = rows.filter((r) => rowTags(r).some((t) => CALL_TAGS.has(t))).slice(0, 30).map((r) => r.id);
  res.json({ lab: req.params.lab, events, calls: placePosts(calls, req) });
});

/* Pulse: the lab this week — what's rising, the tags, who's making. */
app.get("/api/labs/:lab/pulse", auth, (req, res) => {
  const P = placeOr404(req, res); if (!P) return;
  const D = 86400000, now = Date.now(), wk = now - 7 * D, prev = now - 14 * D, chs = inList(P.channels);
  const week = (from, to) => db.prepare(`SELECT COUNT(*) posts, SUM(is_work) pieces, COUNT(DISTINCT author_id) people FROM posts WHERE channel IN (${chs}) AND created_at >= ? AND created_at < ?`).get(from, to);
  const tw = week(wk, now + 1), lw = week(prev, wk);
  const rising = db.prepare(`SELECT p.id,
      (SELECT COUNT(*) FROM likes l WHERE l.post_id = p.id) * 2 + (SELECT COUNT(*) FROM posts s WHERE s.shared_from = p.id) * 3
      + (SELECT COUNT(*) FROM comments c WHERE c.post_id = p.id) AS score
    FROM posts p WHERE p.channel IN (${chs}) AND p.is_work = 1 AND p.created_at >= ? ORDER BY score DESC, p.created_at DESC LIMIT 6`).all(wk).map((r) => r.id);
  const people = db.prepare(`SELECT u.username, u.display_name, u.avatar_url, u.accent, COUNT(*) n FROM posts p JOIN users u ON u.id = p.author_id
    WHERE p.channel IN (${chs}) AND p.created_at >= ? GROUP BY u.id ORDER BY n DESC, MAX(p.created_at) DESC LIMIT 8`).all(wk)
    .map((u) => ({ username: u.username, displayName: u.display_name, avatarUrl: u.avatar_url, posts: u.n }));
  const recent = db.prepare(`SELECT body, channel, created_at FROM posts WHERE channel IN (${chs}) AND created_at >= ?`).all(wk);
  const n = (r) => ({ posts: r.posts || 0, pieces: r.pieces || 0, people: r.people || 0 });
  res.json({ lab: req.params.lab, thisWeek: n(tw), lastWeek: n(lw), rising: placePosts(rising, req), tags: topTags(recent, 10), people });
});

/* A #tag across every lab: the work that carries it first, then the talk. */
app.get("/api/tags/:tag", auth, (req, res) => {
  const tag = cleanTag(req.params.tag);
  if (tag.length < 2) return res.status(400).json({ error: "That isn't a tag." });
  const all = tagCandidates(tag, null, { limit: 600 });
  const work = [...all.filter((r) => r.is_work), ...all.filter((r) => !r.is_work)].slice(0, 120);
  const labs = {};
  for (const r of all) { const l = LAB_OF[r.channel]; if (l) labs[l] = (labs[l] || 0) + 1; }
  res.json({ tag, count: all.length, labs, posts: placePosts(work.map((r) => r.id), req) });
});

/* Tags people use, for suggestions while writing a caption. */
app.get("/api/tags", auth, (req, res) => {
  const P = PLACES[req.query.lab] || null;
  const rows = db.prepare(`SELECT body, channel, created_at FROM posts ${P ? `WHERE channel IN (${inList(P.channels)})` : ""} ORDER BY created_at DESC LIMIT 800`).all();
  const q = cleanTag(req.query.q);
  res.json({ tags: topTags(rows, 40).filter((t) => !q || t.tag.startsWith(q)).slice(0, 12) });
});
