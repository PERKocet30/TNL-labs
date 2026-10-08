/* ================================================================
   PROFILE v2 · 2026-10-07 — what Instagram-era profiles have that ours
   didn't: pronouns, several links, pinned posts, followers / following
   you can open, a Tagged tab, and "Followed by …" on someone else's page.
================================================================ */
function jsonList(s) { try { const a = JSON.parse(s || "[]"); return Array.isArray(a) ? a : []; } catch { return []; } }

/* Links: http(s) only (a javascript: link in a bio is an attack), up to 5. */
function cleanLinks(list) {
  const out = [];
  for (const x of (Array.isArray(list) ? list : []).slice(0, 20)) {
    if (out.length === 5) break;
    let url = String(x?.url ?? x ?? "").trim().slice(0, 200);
    if (!url) continue;
    if (!/^https?:\/\//i.test(url)) url = "https://" + url;
    try { const u = new URL(url); if (!/^https?:$/.test(u.protocol) || !u.hostname.includes(".")) continue; url = u.href; } catch { continue; }
    out.push({ title: String(x?.title ?? "").trim().slice(0, 40), url });
  }
  return out;
}

/* The extra public fields on every user shape (publicUser spreads this). */
function profileExtras(u) {
  let links = jsonList(u.links);
  if (!links.length && u.link) links = cleanLinks([{ url: u.link }]);   // the old single link
  return { pronouns: u.pronouns || "", links, pinned: jsonList(u.pinned).map(Number).filter(Number.isInteger).slice(0, 3) };
}

/* Followers / following, newest first, without anyone blocked either way. */
function followList(req, res, dir) {
  const u = q.userByName.get(req.params.username);
  if (!u) return res.status(404).json({ error: "no such user" });
  const rows = db.prepare(dir === "followers"
    ? `SELECT x.* FROM follows f JOIN users x ON x.id = f.follower_id WHERE f.followee_id = ? AND x.suspended = 0 ORDER BY f.created_at DESC LIMIT 300`
    : `SELECT x.* FROM follows f JOIN users x ON x.id = f.followee_id WHERE f.follower_id = ? AND x.suspended = 0 ORDER BY f.created_at DESC LIMIT 300`).all(u.id);
  const me = req.user?.id;
  const hidden = me ? blockedIds(me) : new Set();
  res.json({ people: rows.filter((x) => !hidden.has(x.username)).map((x) => ({
    username: x.username, displayName: x.display_name, avatarUrl: x.avatar_url || "", role: x.role || "",
    youFollow: me ? !!q.followExists.get(me, x.id) : false, isYou: x.id === me,
  })) });
}
app.get("/api/users/:username/followers", maybeAuth, (req, res) => followList(req, res, "followers"));
app.get("/api/users/:username/following", maybeAuth, (req, res) => followList(req, res, "following"));

/* Posts this member is tagged in (posts.extras.tags, from the post creator). */
app.get("/api/users/:username/tagged", maybeAuth, (req, res) => {
  const u = q.userByName.get(req.params.username);
  if (!u) return res.status(404).json({ error: "no such user" });
  const ids = db.prepare(`SELECT p.id FROM posts p WHERE p.extras IS NOT NULL AND EXISTS
    (SELECT 1 FROM json_each(p.extras, '$.tags') t WHERE t.value = ?) ORDER BY p.created_at DESC LIMIT 60`).all(u.username).map((r) => r.id);
  const hidden = req.user ? blockedIds(req.user.id) : new Set();
  const rows = ids.length ? feedRows({ ids, viewerId: req.user?.id, limit: 60 }) : [];
  res.json({ posts: shapePosts(rows.filter((r) => !hidden.has(r.author_username))) });
});

/* Pin up to three of your own posts to the top of your grid. */
app.post("/api/me/pins", auth, (req, res) => {
  const id = Number(req.body?.postId);
  const post = q.postById.get(id);
  if (!post || post.author_id !== req.user.id) return res.status(404).json({ error: "not your post" });
  let pins = jsonList(req.user.pinned).map(Number).filter((x) => x !== id && q.postById.get(x));
  if (req.body?.pin !== false) {
    if (pins.length >= 3) return res.status(400).json({ error: "You can pin up to 3 posts" });
    pins = [id, ...pins];
  }
  db.prepare(`UPDATE users SET pinned = ? WHERE id = ?`).run(JSON.stringify(pins), req.user.id);
  res.json({ pinned: pins });
});

/* "Followed by a and b and 3 others" — people YOU follow who follow them. */
function followedBy(viewerId, uid) {
  if (!viewerId || viewerId === uid) return null;
  const rows = db.prepare(`SELECT x.username FROM follows mine JOIN follows theirs ON theirs.follower_id = mine.followee_id
    JOIN users x ON x.id = mine.followee_id WHERE mine.follower_id = ? AND theirs.followee_id = ? ORDER BY theirs.created_at DESC`).all(viewerId, uid);
  return rows.length ? { names: rows.slice(0, 2).map((r) => r.username), count: rows.length } : null;
}

/* ── Usernames that end in "." (2026-10-08) ─────────────────────────
   "xstart." is a fine name, but Instagram, iMessage and most link
   finders read a final "." as the end of the sentence and drop it, so
   a shared /u/xstart. opened as /u/xstart — "Not found". Links we make
   spell the dot as %2E (decoded back to "." before routing), and a name
   arriving without its trailing dots still finds its one owner. New
   usernames can't end in "." any more. */
function profileHref(name) {
  return "/u/" + encodeURIComponent(name).replace(/\.+$/, (m) => "%2E".repeat(m.length));
}
function userByLooseName(name) {
  const n = String(name || "");
  const exact = q.userByName.get(n);
  if (exact) return exact;
  const bare = n.replace(/\.+$/, "");
  if (!bare) return null;
  const rows = db.prepare(`SELECT * FROM users WHERE username LIKE ? ESCAPE '\\' AND rtrim(username, '.') = ? LIMIT 2`)
    .all(bare.replace(/[\\%_]/g, (c) => "\\" + c) + "%", bare);
  return rows.length === 1 ? rows[0] : null;
}
