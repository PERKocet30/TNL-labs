/* ================================================================
   LABS CONNECTOR · songs  v1.1 — 2026-10-28
   "Add this song from the labs to the video at this specific time." To
   cut a member's song into a LABS reel, an authorized MCP client needs the audio file. Songs
   already play from public /uploads/ addresses (the same link every
   member's player uses), so this hands over that address and nothing
   more: title, who made it, length, plays, the cover and the audio link.
   Admin-only, read-only, through the connector like every other tool.
   test/connector.test.mjs
================================================================ */
app.get("/api/admin/songs", auth, admin, (req, res) => {
  const id = Number(req.query.id) || 0, q = String(req.query.q || "").trim().slice(0, 60);
  const base = baseUrl(req), abs = (u) => (u && u.startsWith("/") ? base + u : u || "");
  const rows = id
    ? db.prepare(`SELECT t.*, u.username FROM tracks t JOIN users u ON u.id = t.user_id WHERE t.id = ?`).all(id)
    : db.prepare(`SELECT t.*, u.username FROM tracks t JOIN users u ON u.id = t.user_id
        WHERE (? = '' OR t.title LIKE ? OR u.username LIKE ?) ORDER BY t.created_at DESC LIMIT 40`).all(q, `%${q}%`, `%${q}%`);
  res.json({ songs: rows.map((t) => ({ id: t.id, title: t.title, by: t.username, durationMs: t.duration_ms || 0, plays: t.plays || 0,
    page: `${base}/s/${t.id}`, audio: abs(t.url), cover: abs(t.artwork_url), createdAt: t.created_at })) });
});
MCP_PATHS.add("songs");
MCP_TOOLS.push(["songs", "Songs in the Music lab: id, title, who made it, length, plays, its page, cover and audio file link — to cut a member's song into LABS content. Look one up by id (the number in tnllabs.com/s/13) or search by title or username.",
  { id: { type: "integer", description: "The song's number, as in tnllabs.com/s/13" }, q: { type: "string", description: "Search title or username" } },
  (a) => `songs?id=${Math.max(0, Number(a.id) || 0)}&q=${encodeURIComponent(a.q || "")}`]);
