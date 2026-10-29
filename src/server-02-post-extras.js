/* ---- POST EXTRAS · v1.2 2026-10-29 (v1.2: editing a post from the post maker changes all of it but the
   pictures — editPostFull, below). v1.1 2026-10-21 (Instagram-level composer: people tagged ON the
   picture — pins at x,y on image i — alt text, and a hidden like count) · 2026-09-30 ----
   What the post creator adds beyond the work: people tagged (up to 20,
   real members who haven't blocked you — they get told), a place (text,
   60 chars), comments off, and products from your own shop. Stored as
   one JSON column, posts.extras. */
function readExtras(row) {
  try { const x = JSON.parse(row?.extras || "null"); return x && typeof x === "object" ? x : {}; } catch { return {}; }
}
/* Shoppable posts: up to 5 of the author's own listings, shown under the
   work with their live price and whether they've sold. */
const productQ = db.prepare(`SELECT id, title, price_cents, images, status FROM listings WHERE id = ?`);
function postExtras(row) {
  const x = readExtras(row);
  const products = (Array.isArray(x.products) ? x.products : []).map((id) => productQ.get(id)).filter((l) => l && l.status !== "removed")
    .map((l) => ({ id: l.id, title: l.title, price: l.price_cents, sold: l.status !== "active",
      image: (() => { try { return JSON.parse(l.images || "[]")[0] || ""; } catch { return ""; } })() }));
  return { tags: Array.isArray(x.tags) ? x.tags : [], pins: Array.isArray(x.pins) ? x.pins : [], alt: x.alt || "", hideLikes: !!x.hideLikes,
    location: x.location || "", commentsOff: !!x.commentsOff, products, video: x.video || null };
}
const commentsOff = (post) => !!readExtras(post).commentsOff;

/* Clean what the creator sent. Tags must be members; you can't tag
   yourself, and nobody on either side of a block. */
function cleanExtras(body, authorId) {
  const names = Array.isArray(body?.tags) ? body.tags : [];
  const tags = [], ids = [];
  for (const n of names.slice(0, 20)) {
    const u = q.userByName.get(String(n || "").toLowerCase().replace(/^@/, "").slice(0, 30));
    if (!u || u.id === authorId || u.suspended || isBlocked(u.id, authorId) || tags.includes(u.username)) continue;
    tags.push(u.username); ids.push(u.id);
  }
  const location = String(body?.location || "").replace(/\s+/g, " ").trim().slice(0, 60);
  const off = body?.commentsOff === true;
  // Only your own shop, only what's for sale.
  const own = db.prepare(`SELECT id FROM listings WHERE id = ? AND seller_id = ? AND status = 'active'`);
  const products = [...new Set((Array.isArray(body?.products) ? body.products : []).slice(0, 10).map(Number))]
    .filter((id) => Number.isInteger(id) && own.get(id, authorId)).slice(0, 5);
  const video = cleanVideoEdit(body?.video);
  /* pins: where on the picture each tagged person is — {username, x, y, i}, 0..1 on image i; only people in tags */
  const pins = (Array.isArray(body?.pins) ? body.pins : []).slice(0, 20).map((q) => ({
    username: String(q?.username || "").toLowerCase().replace(/^@/, ""), x: Math.round(Math.min(1, Math.max(0, Number(q?.x) || 0)) * 1000) / 1000,
    y: Math.round(Math.min(1, Math.max(0, Number(q?.y) || 0)) * 1000) / 1000, i: Math.max(0, Math.min(9, Number(q?.i) | 0)) }))
    .filter((q) => tags.includes(q.username));
  const alt = String(body?.alt || "").replace(/\s+/g, " ").trim().slice(0, 200);
  const hideLikes = body?.hideLikes === true;
  const any = tags.length || location || off || products.length || video || alt || hideLikes;
  return { extras: any ? JSON.stringify({ tags, location, commentsOff: off, products, ...(pins.length ? { pins } : {}), ...(alt ? { alt } : {}), ...(hideLikes ? { hideLikes } : {}), ...(video ? { video } : {}) }) : null, tagIds: ids };
}

/* The video editor's choices (2026-10-08): a trim (ms), the original
   sound off, and a frame shape. Kept as instructions, never baked into
   the file — the upload stays the untouched original at full quality, and
   every player honours them. Null when nothing was changed. */
const VIDEO_RATIOS = ["1:1", "4:5", "9:16", "16:9"];
function cleanVideoEdit(v) {
  if (!v || typeof v !== "object") return null;
  const ms = (n) => (Number.isFinite(Number(n)) && Number(n) >= 0 ? Math.min(Math.round(Number(n)), 4 * 3600 * 1000) : 0);
  const start = ms(v.start), end = ms(v.end);
  const out = {};
  if (start) out.start = start;
  if (end && end - start >= 500) out.end = end;
  if (v.muted === true) out.muted = true;
  if (VIDEO_RATIOS.includes(v.ratio)) out.ratio = v.ratio;
  return Object.keys(out).length ? out : null;
}

/* Comments on or off later, from the post's own menu. Author only. */
app.post("/api/posts/:id/comments-off", auth, (req, res) => {
  const post = q.postById.get(Number(req.params.id));
  if (!post) return res.status(404).json({ error: "no post" });
  if (post.author_id !== req.user.id) return res.status(403).json({ error: "not your post" });
  const x = readExtras(post);
  x.commentsOff = req.body?.off === true;
  db.prepare(`UPDATE posts SET extras = ? WHERE id = ?`).run(JSON.stringify(x), post.id);
  res.json({ commentsOff: x.commentsOff });
});

/* After a post is made: save the extras and tell the people tagged. */
function applyExtras(postId, body, authorId) {
  const { extras, tagIds } = cleanExtras(body, authorId);
  if (!extras) return;
  db.prepare(`UPDATE posts SET extras = ? WHERE id = ?`).run(extras, postId);
  for (const id of tagIds) notify(id, authorId, "tag", postId, "");
}

/* ---- EDIT INFO v1.0 — 2026-10-29 ------------------------------------
   "Editing a post should bring up the post composer like Instagram." The
   post maker opens on the post (app-18-post-edit.js) and Done sends it all
   back with full: true — PATCH /api/posts/:id calls this. Like Instagram's
   Edit info, the pictures/video stay as they are; everything else can
   change: the lab it's shown in, the song (and which part), people tagged
   (and where on the picture), products, place, alt text, hidden likes and
   comments. The video editor's choices are kept. Only newly tagged people
   are told. */
function editPostFull(post, body, authorId) {
  const ch = String(body?.channel ?? post.channel ?? "profile");
  if (/^[a-z0-9-]{1,40}$/.test(ch) && ch !== post.channel) db.prepare(`UPDATE posts SET channel = ? WHERE id = ?`).run(ch, post.id);
  if ("audioTrackId" in (body || {})) {
    const n = Number(body.audioTrackId), t = Number.isInteger(n) && n > 0 ? db.prepare(`SELECT id, duration_ms FROM tracks WHERE id = ?`).get(n) : null;
    const max = t?.duration_ms ? Math.max(0, t.duration_ms - 1000) : Infinity;
    const start = t ? Math.max(0, Math.min(Math.round(Number(body.audioStart) || 0), max)) : 0;
    db.prepare(`UPDATE posts SET audio_track_id = ?, audio_start = ? WHERE id = ?`).run(t ? t.id : null, start, post.id);
  }
  const old = readExtras(post), before = new Set(Array.isArray(old.tags) ? old.tags : []);
  const { extras, tagIds } = cleanExtras(body, authorId);
  const x = extras ? JSON.parse(extras) : {};
  if (old.video) x.video = old.video;   // the media isn't edited here
  db.prepare(`UPDATE posts SET extras = ? WHERE id = ?`).run(Object.keys(x).length ? JSON.stringify(x) : null, post.id);
  const names = Array.isArray(x.tags) ? x.tags : [];
  tagIds.forEach((id, i) => { if (!before.has(names[i])) notify(id, authorId, "tag", post.id, ""); });
}
