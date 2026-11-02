
/* ================================================================
   MUSIC · THE ARTIST PAGE v1.1 — 2026-10-11 (+ the Music lab's cover); v1.0 2026-10-10
   What an artist page needs that a profile's Music tab didn't have:
     - a pinned song, at the top of the list (POST /api/me/pinned-track)
     - a song link that looks right in an Instagram DM: /s/:id is a public
       page with the cover, the title and who made it, a player, and
       "Open in the app" → /?u=<artist>&s=<id>, which lands on their
       Music tab with that song picked out.
   The Music lab's cover (2026-10-11): the song played most this week, below.
   v1.2 — 2026-10-29: Trending — "a trending music section for music being
   used in the labs": GET /api/tracks/trending, at the bottom of this file.
================================================================ */
app.post("/api/me/pinned-track", auth, (req, res) => {
  const raw = req.body?.trackId;
  const id = raw == null || raw === "" ? null : Number(raw);
  if (id !== null) {
    if (!Number.isInteger(id) || !db.prepare(`SELECT 1 FROM tracks WHERE id = ? AND user_id = ?`).get(id, req.user.id))
      return res.status(404).json({ error: "That's not one of your songs." });
  }
  db.prepare(`UPDATE users SET pinned_track = ? WHERE id = ?`).run(id, req.user.id);
  res.json({ pinnedTrack: id });
});

app.get("/s/:id", (req, res) => {
  const row = db.prepare(`SELECT t.*, u.username, u.display_name, u.avatar_url, u.rep, u.accent, u.role AS user_role, u.suspended
    FROM tracks t JOIN users u ON u.id = t.user_id WHERE t.id = ?`).get(Number(req.params.id) || 0);
  if (!row || row.suspended) return res.status(404).send(lookNotFound("This song isn't here any more."));
  const t = shapeTrack(row), e = lookEsc, base = baseUrl(req);
  const abs = (p) => (p ? (/^https?:/.test(p) ? p : base + p) : null);
  const len = t.durationMs ? `${Math.floor(t.durationMs / 60000)}:${String(Math.round(t.durationMs / 1000) % 60).padStart(2, "0")}` : "";
  const title = `${t.title} — ${row.display_name}`;
  const desc = [`A song by @${row.username} on LABS`, len, t.plays ? lookCount(t.plays, "play") : null].filter(Boolean).join(" · ");
  const img = abs(t.artworkUrl) || abs(row.avatar_url) || `${base}/labs-logo.png`;
  const url = `${base}/s/${t.id}`;
  res.send(lookPage({
    title: e(title),
    accent: accentHex(row.accent),
    head: `<link rel="canonical" href="${e(url)}">
<meta property="og:type" content="music.song">
<meta property="og:site_name" content="LABS">
<meta property="og:url" content="${e(url)}">
<meta property="og:title" content="${e(title)}">
<meta property="og:description" content="${e(desc)}">
<meta property="og:image" content="${e(img)}">
<meta property="og:image:secure_url" content="${e(img)}">
<meta property="og:image:alt" content="${e(t.title)} — cover">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="${e(title)}">
<meta name="twitter:description" content="${e(desc)}">
<meta name="twitter:image" content="${e(img)}">
<meta name="description" content="${e(desc)}">
${ldJson({ "@context": "https://schema.org", "@type": "MusicRecording", name: t.title, url, image: img, datePublished: new Date(row.created_at).toISOString(),
  ...(t.durationMs ? { duration: `PT${Math.floor(t.durationMs / 60000)}M${Math.round(t.durationMs / 1000) % 60}S` } : {}),
  byArtist: { ...ldPerson(row, base), "@type": "MusicGroup" } })}`,
    body: `
${t.artworkUrl ? `<img class="media" src="${e(t.artworkUrl)}" alt="${e(t.title)} — cover" style="aspect-ratio:1/1;object-fit:cover;max-height:none">` : ""}
<h1 style="margin:14px 0 4px;font-size:24px;line-height:28px">${e(t.title)}</h1>
<a class="who" href="${e(profileHref(row.username))}" style="margin-bottom:14px">
  ${row.avatar_url ? `<img class="av ring" src="${e(abs(row.avatar_url))}" alt="">` : `<div class="av ring">${e(row.display_name.slice(0, 2).toUpperCase())}</div>`}
  <div><div class="name">${e(row.display_name)}</div><div class="cap">@${e(row.username)}${row.user_role ? " · " + e(row.user_role) : ""}</div></div>
</a>
<audio controls preload="none" src="${e(t.url)}" style="width:100%;margin:0 0 10px"></audio>
<div class="cap meta">${[len, lookCount(t.plays, "play")].filter(Boolean).join(" · ")}</div>
<a class="btn block acc" href="/?u=${encodeURIComponent(row.username)}&amp;s=${t.id}">Open in the app</a>
<p class="cap" style="margin-top:14px;text-align:center"><a href="/">See what else is being made</a></p>`,
  }));
});

/* ── The Music lab's cover · 2026-10-11 ─────────────────────────────
   "The music lab cover should become whatever song cover is being played
   the most in the app." Every press of play is logged (track_plays), and
   the Music lab's card in the labs list wears the cover of the song with
   the most listeners this week — each person counted once a day, and
   never the artist playing their own song (the same rule as rep). No plays
   this week: the most-played song of all time. Songs without a cover, or
   by a suspended account, are skipped. */
db.exec(`CREATE TABLE IF NOT EXISTS track_plays (track_id INTEGER NOT NULL, user_id INTEGER, at INTEGER NOT NULL)`);
db.exec(`CREATE INDEX IF NOT EXISTS idx_track_plays_at ON track_plays(at)`);
function logTrackPlay(trackId, userId, now = Date.now()) {
  db.prepare(`INSERT INTO track_plays (track_id, user_id, at) VALUES (?, ?, ?)`).run(trackId, userId || null, now);
  if (Math.random() < 0.01) db.prepare(`DELETE FROM track_plays WHERE at < ?`).run(now - 60 * 86400000);   // a week is all it reads
}
function musicLabCover(now = Date.now()) {
  const cols = `t.id, t.title, t.artwork_url, u.username, u.display_name`;
  const ok = `t.artwork_url LIKE '/uploads/%' AND COALESCE(u.suspended, 0) = 0`;
  const r = db.prepare(`SELECT ${cols}, COUNT(DISTINCT p.user_id || ':' || (p.at / 86400000)) n FROM track_plays p
      JOIN tracks t ON t.id = p.track_id JOIN users u ON u.id = t.user_id
      WHERE p.at >= ? AND p.user_id IS NOT NULL AND p.user_id != t.user_id AND ${ok}
      GROUP BY t.id ORDER BY n DESC, MAX(p.at) DESC LIMIT 1`).get(now - 7 * 86400000)
    || db.prepare(`SELECT ${cols}, t.plays n FROM tracks t JOIN users u ON u.id = t.user_id
      WHERE t.plays > 0 AND ${ok} ORDER BY t.plays DESC, t.created_at DESC LIMIT 1`).get();
  return r ? { url: r.artwork_url, title: r.title, by: r.display_name || r.username, username: r.username, trackId: r.id, at: now } : null;
}

/* ---- TRENDING v1.0 — 2026-10-29 ------------------------------------
   "There should be a trending music section for music being used in the labs."
   The songs members put on their posts lately ("Add music" in the post maker):
   the more different people using a song in the last 14 days, the higher; then
   how many posts; then a nudge from this week's plays. A song only trends once
   someone has used it. Suspended accounts' posts and songs don't count; a repost
   isn't a use. Top 5 for the Music lab's Songs tab (app/music/tracks.js). */
const TREND = { days: 14, limit: 5, perUser: 2, perPost: 1, perPlay: 0.05 };
function trendingTracks(now = Date.now()) {
  const since = now - TREND.days * 86400000, week = now - 7 * 86400000;
  return db.prepare(`
    SELECT t.id, t.title, t.url, t.artwork_url, t.description, t.duration_ms, t.plays, t.created_at,
           u.username, u.display_name, u.avatar_url, u.rep,
           COUNT(p.id) uses, COUNT(DISTINCT p.author_id) users, MAX(p.created_at) lastUse,
           (SELECT COUNT(*) FROM track_plays tp WHERE tp.track_id = t.id AND tp.at > ?) plays7
    FROM posts p
    JOIN tracks t ON t.id = p.audio_track_id
    JOIN users u ON u.id = t.user_id AND u.suspended = 0
    JOIN users a ON a.id = p.author_id AND a.suspended = 0
    WHERE p.audio_track_id IS NOT NULL AND p.shared_from IS NULL AND p.created_at > ?
    GROUP BY t.id
    ORDER BY (? * users + ? * uses + ? * plays7) DESC, lastUse DESC
    LIMIT ?`).all(week, since, TREND.perUser, TREND.perPost, TREND.perPlay, TREND.limit)
    .map((r) => ({ ...shapeTrack(r), uses: r.uses }));
}
app.get("/api/tracks/trending", auth, (req, res) => res.json({ tracks: trendingTracks() }));
