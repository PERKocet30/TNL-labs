/* ---- POST EXTRAS · 2026-09-30 ----
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
  return { tags: Array.isArray(x.tags) ? x.tags : [], location: x.location || "", commentsOff: !!x.commentsOff, products,
    video: x.video || null };
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
  const any = tags.length || location || off || products.length || video;
  return { extras: any ? JSON.stringify({ tags, location, commentsOff: off, products, ...(video ? { video } : {}) }) : null, tagIds: ids };
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
