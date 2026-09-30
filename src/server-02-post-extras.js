/* ---- POST EXTRAS · 2026-09-30 ----
   What the post creator adds beyond the work: people tagged (up to 20,
   real members who haven't blocked you — they get told), a place (text,
   60 chars), and comments off. Stored as one JSON column, posts.extras. */
function readExtras(row) {
  try { const x = JSON.parse(row?.extras || "null"); return x && typeof x === "object" ? x : {}; } catch { return {}; }
}
function postExtras(row) {
  const x = readExtras(row);
  return { tags: Array.isArray(x.tags) ? x.tags : [], location: x.location || "", commentsOff: !!x.commentsOff };
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
  return { extras: tags.length || location || off ? JSON.stringify({ tags, location, commentsOff: off }) : null, tagIds: ids };
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
