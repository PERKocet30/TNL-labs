
/* ================================================================
   PLACES v1.2 — 2026-10-09. Labs are places, one per genre — not
   Discord servers full of channels. Inside each lab (v1.1: just two):
     Work   everything made here, a grid — filter by #tag
     Talk   one conversation (the lab's home channel; the old channels'
            history is merged in)
   and on the labs list, each genre's #tags (/api/labs/tags).

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

app.get("/api/places", (_req, res) => res.json({ places: PLACES }));

/* Talk: one conversation per lab — every channel's history, newest 50.
   Pins: the newest three pinned anywhere in the lab (v1.2 — a post pinned
   from /admin in an old channel used to vanish; pins are kept per channel). */
app.get("/api/labs/:lab/feed", auth, (req, res) => {
  const P = placeOr404(req, res); if (!P) return;
  const ids = db.prepare(`SELECT id FROM posts WHERE channel IN (${inList(P.channels)}) ORDER BY created_at DESC LIMIT 50`).all().map((r) => r.id);
  const hidden = blockedIds(req.user.id);
  const pinIds = db.prepare(`SELECT post_id FROM channel_pins WHERE channel IN (${inList(P.channels)}) ORDER BY created_at DESC LIMIT 3`).all().map((r) => r.post_id);
  const pins = shapePosts(pinIds.map((id) => feedRows({ postId: id, limit: 1 })[0]).filter(Boolean));
  res.json({ lab: req.params.lab, home: P.home, posts: placePosts(ids, req), pins: pins.filter((p) => !hidden.has(p.author.username)) });
});

/* Work: everything made here, optionally one #tag; plus the lab's tags. */
app.get("/api/labs/:lab/work", auth, (req, res) => {
  const P = placeOr404(req, res); if (!P) return;
  const tag = cleanTag(req.query.tag);
  const ids = tag
    ? tagCandidates(tag, P.channels, { workOnly: true, limit: 120 }).map((r) => r.id)
    : db.prepare(`SELECT id FROM posts WHERE channel IN (${inList(P.channels)}) AND is_work = 1 ORDER BY created_at DESC LIMIT 120`).all().map((r) => r.id);
  const recent = db.prepare(`SELECT body, channel, created_at FROM posts WHERE channel IN (${inList(P.channels)}) ORDER BY created_at DESC LIMIT 400`).all();
  res.json({ lab: req.params.lab, tag: tag || null, posts: placePosts(ids, req), tags: topTags(recent, 16).filter((t) => !PLAIN_TAGS.has(t.tag)) });
});

/* The labs list: each genre explained by its #tags — its own first (so a
   new or quiet lab still says what it's for), then what people use most
   there. Generic room names don't count as tags here. (v1.1, 2026-10-09) */
const GENRE_TAGS = {
  hq: ["collab", "intro", "wip"], pharmacy: ["graphicdesign", "photography", "film"], culture: ["beats", "feedback", "tracks"],
  fashion: ["streetwear", "clothingdesign", "drops"], akatsuki: ["manga", "anime", "ideas"], casino: ["news", "magazine", "promos"],
  tna: ["opportunities", "coding", "finance"],
};
const PLAIN_TAGS = new Set(["chat", "general", "creators"]);
app.get("/api/labs/tags", auth, (_req, res) => {
  const tags = {};
  for (const [lab, P] of Object.entries(PLACES)) {
    const rows = db.prepare(`SELECT body, channel, created_at FROM posts WHERE channel IN (${inList(P.channels)}) ORDER BY created_at DESC LIMIT 400`).all();
    const used = topTags(rows, 20).map((t) => t.tag).filter((t) => !PLAIN_TAGS.has(t));
    tags[lab] = [...new Set([...GENRE_TAGS[lab], ...used])].slice(0, 8);
  }
  res.json({ tags });
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
