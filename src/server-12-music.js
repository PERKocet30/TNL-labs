
/* ================================================================
   MUSIC · THE ARTIST PAGE v1.0 — 2026-10-10
   What Spotify gives an artist that a profile's Music tab didn't have:
     - a pinned song, at the top of the list (POST /api/me/pinned-track)
     - a song link that looks right in an Instagram DM: /s/:id is a public
       page with the cover, the title and who made it, a player, and
       "Open in the app" → /?u=<artist>&s=<id>, which lands on their
       Music tab with that song picked out.
   Merch under the music is the app's own Market (app-15-profile.js).
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
  const desc = [`A song by @${row.username} on TNL LABS`, len, t.plays ? lookCount(t.plays, "play") : null].filter(Boolean).join(" · ");
  const img = abs(t.artworkUrl) || abs(row.avatar_url) || `${base}/icon-white-512.png`;
  const url = `${base}/s/${t.id}`;
  res.send(lookPage({
    title: e(title),
    accent: accentHex(row.accent),
    head: `<link rel="canonical" href="${e(url)}">
<meta property="og:type" content="music.song">
<meta property="og:site_name" content="TNL LABS">
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
<meta name="description" content="${e(desc)}">`,
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
