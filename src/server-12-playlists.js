/* ================================================================
   PLAYLISTS v1.0 — 2026-10-12 ("make the music lab function more like
   Spotify — you listen to music and build your own playlist while in the
   lab"). Your playlists are yours: only you see them, only you change
   them. A playlist holds songs from the Music lab's library, in the order
   you added them; a song that's deleted, or whose artist is suspended,
   drops out of it.
     GET    /api/playlists                 yours, newest first, with covers
     POST   /api/playlists                 {name, trackId?} — a new one
     GET    /api/playlists/:id             it, with its songs
     PATCH  /api/playlists/:id             {name}
     DELETE /api/playlists/:id
     POST   /api/playlists/:id/tracks      {trackId} — add (once)
     DELETE /api/playlists/:id/tracks/:tid — take out
================================================================ */
db.exec(`CREATE TABLE IF NOT EXISTS playlists (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL)`);
db.exec(`CREATE INDEX IF NOT EXISTS idx_playlists_user ON playlists(user_id, updated_at DESC)`);
db.exec(`CREATE TABLE IF NOT EXISTS playlist_tracks (
  playlist_id INTEGER NOT NULL REFERENCES playlists(id) ON DELETE CASCADE,
  track_id INTEGER NOT NULL REFERENCES tracks(id) ON DELETE CASCADE,
  position INTEGER NOT NULL,
  added_at INTEGER NOT NULL,
  PRIMARY KEY (playlist_id, track_id))`);
db.exec(`CREATE INDEX IF NOT EXISTS idx_playlist_tracks_track ON playlist_tracks(track_id)`);

const PL_MAX = 100, PL_SONGS = 500;
const plName = (v) => String(v ?? "").replace(/\s+/g, " ").trim().slice(0, 60);
const plMine = (id, userId) => db.prepare(`SELECT * FROM playlists WHERE id = ? AND user_id = ?`).get(Number(id) || 0, userId);
/* The songs that still play: the track is there and its artist isn't suspended. */
const PL_SONGS_SQL = `SELECT t.*, u.username, u.display_name, u.avatar_url, u.rep, pt.added_at
  FROM playlist_tracks pt JOIN tracks t ON t.id = pt.track_id JOIN users u ON u.id = t.user_id
  WHERE pt.playlist_id = ? AND COALESCE(u.suspended, 0) = 0 ORDER BY pt.position`;
function shapePlaylist(p, withSongs) {
  const songs = db.prepare(PL_SONGS_SQL).all(p.id);
  const out = {
    id: p.id, name: p.name, createdAt: p.created_at, updatedAt: p.updated_at,
    count: songs.length, durationMs: songs.reduce((n, s) => n + (s.duration_ms || 0), 0),
    /* up to four covers, for the 2×2 the way Spotify makes one */
    covers: [...new Set(songs.map((s) => s.artwork_url).filter(Boolean))].slice(0, 4),
    trackIds: songs.map((s) => s.id),
  };
  if (withSongs) out.tracks = songs.map(shapeTrack);
  return out;
}

app.get("/api/playlists", auth, (req, res) => {
  const rows = db.prepare(`SELECT * FROM playlists WHERE user_id = ? ORDER BY updated_at DESC, id DESC`).all(req.user.id);
  res.json({ playlists: rows.map((p) => shapePlaylist(p, false)) });
});

app.post("/api/playlists", auth, rateLimit({ max: 30, windowMs: 3600000, key: "user" }), (req, res) => {
  const name = plName(req.body?.name);
  if (!name) return res.status(400).json({ error: "Give it a name." });
  const have = db.prepare(`SELECT COUNT(*) n FROM playlists WHERE user_id = ?`).get(req.user.id).n;
  if (have >= PL_MAX) return res.status(400).json({ error: `That's ${PL_MAX} playlists — delete one first.` });
  const tid = req.body?.trackId == null ? null : Number(req.body.trackId);
  if (tid !== null && !db.prepare(`SELECT 1 FROM tracks WHERE id = ?`).get(tid)) return res.status(404).json({ error: "That song isn't here any more." });
  const now = Date.now();
  const id = Number(db.prepare(`INSERT INTO playlists (user_id, name, created_at, updated_at) VALUES (?, ?, ?, ?)`).run(req.user.id, name, now, now).lastInsertRowid);
  if (tid !== null) db.prepare(`INSERT INTO playlist_tracks (playlist_id, track_id, position, added_at) VALUES (?, ?, 0, ?)`).run(id, tid, now);
  res.json({ playlist: shapePlaylist(plMine(id, req.user.id), true) });
});

app.get("/api/playlists/:id", auth, (req, res) => {
  const p = plMine(req.params.id, req.user.id);
  if (!p) return res.status(404).json({ error: "No such playlist." });
  res.json({ playlist: shapePlaylist(p, true) });
});

app.patch("/api/playlists/:id", auth, (req, res) => {
  const p = plMine(req.params.id, req.user.id);
  if (!p) return res.status(404).json({ error: "No such playlist." });
  const name = plName(req.body?.name);
  if (!name) return res.status(400).json({ error: "Give it a name." });
  db.prepare(`UPDATE playlists SET name = ?, updated_at = ? WHERE id = ?`).run(name, Date.now(), p.id);
  res.json({ playlist: shapePlaylist(plMine(p.id, req.user.id), true) });
});

app.delete("/api/playlists/:id", auth, (req, res) => {
  const p = plMine(req.params.id, req.user.id);
  if (!p) return res.status(404).json({ error: "No such playlist." });
  db.prepare(`DELETE FROM playlists WHERE id = ?`).run(p.id);
  res.json({ ok: true });
});

app.post("/api/playlists/:id/tracks", auth, rateLimit({ max: 600, windowMs: 3600000, key: "user" }), (req, res) => {
  const p = plMine(req.params.id, req.user.id);
  if (!p) return res.status(404).json({ error: "No such playlist." });
  const tid = Number(req.body?.trackId);
  if (!Number.isInteger(tid) || !db.prepare(`SELECT 1 FROM tracks WHERE id = ?`).get(tid)) return res.status(404).json({ error: "That song isn't here any more." });
  if (db.prepare(`SELECT 1 FROM playlist_tracks WHERE playlist_id = ? AND track_id = ?`).get(p.id, tid))
    return res.json({ playlist: shapePlaylist(p, false), already: true });
  const n = db.prepare(`SELECT COUNT(*) n, COALESCE(MAX(position), -1) m FROM playlist_tracks WHERE playlist_id = ?`).get(p.id);
  if (n.n >= PL_SONGS) return res.status(400).json({ error: `A playlist holds ${PL_SONGS} songs.` });
  const now = Date.now();
  db.prepare(`INSERT INTO playlist_tracks (playlist_id, track_id, position, added_at) VALUES (?, ?, ?, ?)`).run(p.id, tid, n.m + 1, now);
  db.prepare(`UPDATE playlists SET updated_at = ? WHERE id = ?`).run(now, p.id);
  res.json({ playlist: shapePlaylist(plMine(p.id, req.user.id), false) });
});

app.delete("/api/playlists/:id/tracks/:tid", auth, (req, res) => {
  const p = plMine(req.params.id, req.user.id);
  if (!p) return res.status(404).json({ error: "No such playlist." });
  db.prepare(`DELETE FROM playlist_tracks WHERE playlist_id = ? AND track_id = ?`).run(p.id, Number(req.params.tid) || 0);
  db.prepare(`UPDATE playlists SET updated_at = ? WHERE id = ?`).run(Date.now(), p.id);
  res.json({ playlist: shapePlaylist(plMine(p.id, req.user.id), false) });
});
