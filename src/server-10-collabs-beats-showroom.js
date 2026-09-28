/* ================================================================
   COLLABORATION — two-sided. Invite, then the invitee accepts.
   On accept, BOTH parties earn rep. This is the cross-lab engine.
================================================================ */
app.post("/api/posts/:id/collab", auth, verified, (req, res) => {
  const post = q.postById.get(Number(req.params.id));
  if (!post) return res.status(404).json({ error: "no post" });
  if (post.author_id !== req.user.id) return res.status(403).json({ error: "only the author can invite" });
  const invitee = q.userByName.get(req.body?.username || "");
  if (!invitee) return res.status(404).json({ error: "no such user" });
  if (invitee.id === req.user.id) return res.status(400).json({ error: "cannot collab with yourself" });
  q.addCollab.run(post.id, invitee.id, Date.now());
  notify(invitee.id, req.user.id, "collab_invite", post.id, "wants to collab on your work");
  broadcast("collab-invite", { postId: post.id, username: invitee.username });
  res.json({ ok: true, status: "pending" });
});

app.post("/api/posts/:id/collab/accept", auth, verified, (req, res) => {
  const post = q.postById.get(Number(req.params.id));
  if (!post) return res.status(404).json({ error: "no post" });
  const row = q.collabRow.get(post.id, req.user.id);
  if (!row) return res.status(404).json({ error: "no invite for you" });
  if (row.status === "accepted") return res.json({ ok: true, status: "accepted" });
  q.acceptCollab.run(post.id, req.user.id);
  // both sides earn rep for a confirmed collaboration
  awardRep(req.user.id, "collab_accepted", post.id);
  if (post.author_id !== req.user.id) { awardRep(post.author_id, "collab_accepted", post.id); notify(post.author_id, req.user.id, "collab_accept", post.id, "accepted your collab"); }
  broadcast("collab-accepted", { postId: post.id, username: req.user.username });
  res.json({ ok: true, status: "accepted" });
});

/* Same role→identity map the app uses, so a public portfolio reads in the
   language of the trade rather than a generic "WORK". Kept in step with
   KINDS/ROLE_KIND in public/index.html. */
const KINDS = {
  visual:   { tag: "VISUAL",  work: "WORK",     blurb: "Visual work — posters, graphics, and the archive behind them." },
  lens:     { tag: "LENS",    work: "SHOTS",    blurb: "Photography and film." },
  fashion:  { tag: "FASHION", work: "PIECES",   blurb: "Garments, styling, and the material end of the network." },
  music:    { tag: "SOUND",   work: "TRACKS",   blurb: "Beats, records, and the people on them." },
  word:     { tag: "WORD",    work: "WRITING",  blurb: "Words, stories, and coverage of the scene." },
  build:    { tag: "BUILD",   work: "PROJECTS", blurb: "Sites, apps, and the interfaces the culture runs on." },
  business: { tag: "BUILDER", work: "VENTURES", blurb: "Building the thing behind the thing." },
  anime:    { tag: "ANIME",    work: "PANELS",   blurb: "Anime, manga, and the visual language it hands the rest of the network." },
};
const ROLE_KIND = {
  "Graphic Designer": "visual", "Illustrator": "visual", "3D Artist": "visual", "Motion Designer": "visual",
  "Animator": "visual", "Art Director": "visual", "Painter": "visual", "Sculptor": "visual",
  "Tattoo Artist": "visual", "Curator": "visual", "Manga Artist": "visual", "Character Designer": "visual",
  "Manga Artist": "anime", "Cosplayer": "anime", "AMV Editor": "anime",
  "Photographer": "lens", "Videographer": "lens", "Video Editor": "lens", "Cinematographer": "lens", "AMV Editor": "lens",
  "Fashion Designer": "fashion", "Stylist": "fashion", "Model": "fashion", "Tailor": "fashion", "Sneaker Customizer": "fashion", "Cosplayer": "fashion",
  "Producer": "music", "Beatmaker": "music", "Lyricist / Singer": "music", "Rapper": "music", "DJ": "music",
  "Audio Engineer": "music", "Musician": "music",
  "Writer": "word", "Copywriter": "word", "Journalist": "word", "Content Creator": "word", "Actor": "word",
  "Web Designer": "build", "Web Developer": "build", "App Developer": "build", "UI/UX Designer": "build", "Product Designer": "build",
  "Entrepreneur": "business", "Founder": "business", "Brand Strategist": "business", "Marketer": "business",
  "Manager": "business", "A&R": "business", "Photographer's Agent": "business", "Event Organizer": "business",
};
function kindFor(rolesJson, role) {
  let rs = [];
  try { rs = JSON.parse(rolesJson || "[]"); } catch {}
  if (!rs.length && role) rs = [role];
  return KINDS[ROLE_KIND[rs[0]] || "visual"] || KINDS.visual;
}

/* /api/me/publish removed in 064 — every profile is public. Signup writes
   published=1 (059) and /u/:name no longer reads the flag; the column
   remains only as history. */
/* Public, credential-free portfolio page. Server-rendered so it works
   in link previews and for people with no account. */
app.get("/u/:username", (req, res) => {
  const u = q.userByName.get(req.params.username);
  /* 064: every page is public — the only 404 is a name that doesn't exist. */
  if (!u) {
    return res.status(404).send(`<!doctype html><meta name="viewport" content="width=device-width,initial-scale=1">
<body style="margin:0;background:#000;color:#fff;font-family:Helvetica,Arial,sans-serif;display:flex;align-items:center;justify-content:center;height:100vh;text-align:center">
<div><div style="color:#98FC68;font-family:monospace;font-size:11px;letter-spacing:.16em">TNLLABS &#129514;</div>
<h1 style="text-transform:uppercase;font-size:22px;margin:14px 0 8px">Not found</h1>
<p style="color:#8A8A8A;font-size:14px">This portfolio is private or doesn't exist.</p>
<a href="/" style="display:inline-block;margin-top:16px;background:#fff;color:#000;text-decoration:none;font-weight:700;padding:12px 20px;border-radius:9px">Enter the lab</a></div></body>`);
  }
  const posts = shapePosts(feedRows({ authorId: u.id, viewerId: 0, limit: 60, workOnly: true }));
  const likes = db.prepare(`SELECT COUNT(*) n FROM likes l JOIN posts p ON p.id=l.post_id WHERE p.author_id=?`).get(u.id).n;
  const collabs = db.prepare(`SELECT COUNT(*) n FROM collaborators WHERE user_id=? AND status='accepted'`).get(u.id).n;
  const lvl = levelFor(u.rep);
  const K = kindFor(u.roles, u.role);
  const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

  const work = posts.map((p) => `
    <div style="background:#141414;border:1px solid rgba(255,255,255,.12);border-radius:10px;padding:11px;margin-bottom:9px">
      <div style="color:#98FC68;font-family:monospace;font-size:9px;letter-spacing:.08em">${p.beat ? "BEAT" : p.videoUrl ? "VIDEO" : p.imageUrl ? "IMAGE" : "POST"} · #${esc(p.channel)}</div>
      ${p.imageUrl ? `<img src="${esc(p.imageUrl)}" style="width:100%;max-height:300px;object-fit:cover;border-radius:7px;margin-top:7px" loading="lazy">` : ""}
      ${p.videoUrl ? `<video src="${esc(p.videoUrl)}" controls playsinline preload="metadata" style="width:100%;max-height:300px;border-radius:7px;margin-top:7px"></video>` : ""}
      ${p.body ? `<div style="font-size:13px;line-height:1.5;color:#D6D2C8;margin-top:7px">${esc(p.body)}</div>` : ""}
      ${p.beat ? `<div style="font-size:12px;font-weight:700;margin-top:7px">♫ ${esc(p.beat.name || "untitled loop")} <span style="color:#8A8A8A;font-family:monospace;font-weight:400">${p.beat.bpm}BPM</span></div>` : ""}
      <div style="font-family:monospace;font-size:9px;color:#8A8A8A;margin-top:8px">♥ ${p.likeCount} &nbsp; ↻ ${p.shareCount}${p.collaborators.filter((c) => c.status === "accepted").length ? ` &nbsp; <span style="color:#98FC68">✓ ${p.collaborators.filter((c) => c.status === "accepted").map((c) => esc(c.display_name || c.username)).join(", ")}</span>` : ""}</div>
    </div>`).join("");

  /* ── THE LINK PREVIEW ────────────────────────────────────────────────
     This page's real job is to look like something when it's pasted into
     an Instagram DM. 756 people live in those DMs — a bare blue link there
     is a wasted shot, and you only get one per person.

     What a crawler needs, and what was missing entirely:
       • og:image — absolute https, no auth. Without it there is NO card.
       • dimensions — Meta skips images it can't size before fetching.
       • og:url — canonical, or IG caches the wrong thing forever.
     Crawlers fetch from Meta's servers, not your phone, so every URL must
     be absolute. Guest access is what makes any of this possible. */
  const abs = (path) => (path ? (/^https?:/.test(path) ? path : `${baseUrl(req)}${path}`) : null);

  // The image IS the preview. Their best work beats their avatar every time:
  // a 56px circle crops to nothing, a poster stops a thumb.
  const hero = posts.find((p) => p.imageUrl && p.mediaW && p.mediaH) || posts.find((p) => p.imageUrl);
  const ogImage = abs(hero && hero.imageUrl) || abs(u.avatar_url) || `${baseUrl(req)}/icon-512.png`;
  const ogW = (hero && hero.mediaW) || 512;
  const ogH = (hero && hero.mediaH) || 512;

  const roles = (() => { try { return JSON.parse(u.roles || "[]"); } catch { return []; } })();
  const roleLine = roles.length ? roles.slice(0, 3).join(" · ") : u.role;
  // Earn the tap. "4 pieces · 1 collab" says who they are; a bio might say "🌸".
  const stats = [
    posts.length ? `${posts.length} ${posts.length === 1 ? "piece" : "pieces"}` : null,
    collabs ? `${collabs} collab${collabs === 1 ? "" : "s"}` : null,
    likes ? `${likes} ♥` : null,
  ].filter(Boolean).join(" · ");
  const ogDesc = [u.bio || K.blurb, roleLine, stats].filter(Boolean).join(" — ").slice(0, 200);
  const canonical = `${baseUrl(req)}/u/${encodeURIComponent(u.username)}`;

  /* Cache the profile page briefly at the edge. Long enough that a link
     dropped in a 226-person chat doesn't hammer Railway when everyone taps
     it at once; short enough that new work shows up. Crawlers get a fresh
     one because they hit it first. */
  res.set("Cache-Control", "public, max-age=60, s-maxage=300, stale-while-revalidate=600");
  res.send(`<!doctype html><html><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(u.display_name)} — TNL LABS</title>
<link rel="canonical" href="${esc(canonical)}">

<meta property="og:type" content="profile">
<meta property="og:site_name" content="TNL LABS">
<meta property="og:url" content="${esc(canonical)}">
<meta property="og:title" content="${esc(u.display_name)} — ${esc(roleLine)}">
<meta property="og:description" content="${esc(ogDesc)}">
<meta property="og:image" content="${esc(ogImage)}">
<meta property="og:image:secure_url" content="${esc(ogImage)}">
<meta property="og:image:width" content="${ogW}">
<meta property="og:image:height" content="${ogH}">
<meta property="og:image:alt" content="${esc(u.display_name)} on TNL LABS">
<meta property="profile:username" content="${esc(u.username)}">

<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="${esc(u.display_name)} — ${esc(roleLine)}">
<meta name="twitter:description" content="${esc(ogDesc)}">
<meta name="twitter:image" content="${esc(ogImage)}">

<meta name="description" content="${esc(ogDesc)}">
<meta name="theme-color" content="#000000">
</head>
<body style="margin:0;background:#000;color:#fff;font-family:Helvetica,Arial,sans-serif">
<div style="max-width:640px;margin:0 auto;padding:28px 18px 60px">
  <a href="/" style="color:#98FC68;font-family:monospace;font-size:11px;letter-spacing:.16em;text-decoration:none">TNLLABS &#129514;</a>
  <div style="font-family:monospace;font-size:9px;letter-spacing:.14em;color:#8A8A8A;margin-top:14px">${esc(K.tag)}</div>
  <div style="display:flex;align-items:center;gap:13px;margin-top:22px">
    ${u.avatar_url ? `<img src="${esc(u.avatar_url)}" style="width:56px;height:56px;border-radius:50%;object-fit:cover;border:2px solid #98FC68">` : `<div style="width:56px;height:56px;border-radius:50%;background:#141414;border:2px solid #98FC68;display:flex;align-items:center;justify-content:center;font-family:monospace">${esc(u.display_name.slice(0, 2).toUpperCase())}</div>`}
    <div><div style="font-size:20px;font-weight:900;text-transform:uppercase">${esc(u.display_name)}</div>
    <div style="font-family:monospace;font-size:10px;color:#8A8A8A;letter-spacing:.08em">@${esc(u.username)} · L${lvl.id} ${esc(lvl.name.toUpperCase())}</div></div>
  </div>
  <div style="display:flex;flex-wrap:wrap;gap:6px;margin-top:14px">${(() => { let rs = []; try { rs = JSON.parse(u.roles || "[]"); } catch {} if (!rs.length && u.role) rs = [u.role]; return rs.map((r) => `<span style="font-family:monospace;font-size:9px;letter-spacing:.06em;border:1px solid rgba(255,255,255,.2);border-radius:999px;padding:4px 9px;color:#D6D2C8">${esc(r.toUpperCase())}</span>`).join(""); })()}</div>
  ${u.bio ? `<p style="font-size:14px;line-height:1.6;color:#D6D2C8;margin:16px 0 8px;white-space:pre-wrap">${esc(u.bio)}</p>` : ""}
  ${u.link ? `<a href="${/^https?:\/\//.test(u.link) ? esc(u.link) : "https://" + esc(u.link)}" target="_blank" rel="noreferrer nofollow" style="color:#98FC68;font-family:monospace;font-size:11px;text-decoration:none">↗ ${esc(u.link.replace(/^https?:\/\//, ""))}</a>` : ""}
  <div style="display:flex;gap:8px;border-top:1px solid rgba(255,255,255,.12);border-bottom:1px solid rgba(255,255,255,.12);padding:14px 0;margin:16px 0 20px">
    <div style="flex:1"><b style="font-size:17px">${posts.length}</b><div style="font-family:monospace;font-size:9px;color:#8A8A8A">${esc(K.work)}</div></div>
    <div style="flex:1"><b style="font-size:17px">${likes}</b><div style="font-family:monospace;font-size:9px;color:#8A8A8A">LIKES</div></div>
    <div style="flex:1"><b style="font-size:17px">${collabs}</b><div style="font-family:monospace;font-size:9px;color:#8A8A8A">COLLABS</div></div>
  </div>
  ${work || `<div style="color:#8A8A8A;font-size:13px;text-align:center;padding:28px">Nothing published yet.</div>`}
  <a href="/" style="display:block;text-align:center;margin-top:26px;background:#fff;color:#000;text-decoration:none;font-weight:700;padding:13px;border-radius:9px">Build with ${esc(u.display_name)} — enter the lab</a>
</div></body></html>`);
});

/* ================================================================
   BEAT PROJECTS — the Studio's saved works-in-progress.
================================================================ */
app.get("/api/beats", auth, (req, res) => {
  const rows = db.prepare(
    `SELECT id, name, updated_at FROM beat_projects WHERE user_id = ? ORDER BY updated_at DESC LIMIT 50`
  ).all(req.user.id);
  res.json({ projects: rows });
});

app.get("/api/beats/:id", auth, (req, res) => {
  const row = db.prepare(`SELECT * FROM beat_projects WHERE id = ? AND user_id = ?`)
    .get(Number(req.params.id), req.user.id);
  if (!row) return res.status(404).json({ error: "not found" });
  res.json({ project: { id: row.id, name: row.name, data: JSON.parse(row.data), updatedAt: row.updated_at } });
});

app.post("/api/beats", auth, verified, (req, res) => {
  const { id, name, data } = req.body || {};
  if (!data) return res.status(400).json({ error: "no data" });
  const json = JSON.stringify(data);
  if (json.length > 400000) return res.status(413).json({ error: "project too large" });
  const now = Date.now();
  if (id) {
    const owned = db.prepare(`SELECT 1 FROM beat_projects WHERE id = ? AND user_id = ?`).get(id, req.user.id);
    if (!owned) return res.status(404).json({ error: "not found" });
    db.prepare(`UPDATE beat_projects SET name = ?, data = ?, updated_at = ? WHERE id = ?`)
      .run((name || "untitled").slice(0, 60), json, now, id);
    return res.json({ id, saved: true });
  }
  const info = db.prepare(`INSERT INTO beat_projects (user_id, name, data, updated_at, created_at) VALUES (?,?,?,?,?)`)
    .run(req.user.id, (name || "untitled").slice(0, 60), json, now, now);
  res.json({ id: Number(info.lastInsertRowid), saved: true });
});

app.delete("/api/beats/:id", auth, (req, res) => {
  db.prepare(`DELETE FROM beat_projects WHERE id = ? AND user_id = ?`).run(Number(req.params.id), req.user.id);
  res.json({ ok: true });
});

/* ================================================================
   SHOWROOM — the front page. Real work from people actually building.
   Only posts with something to SEE (an image or a beat), ranked by a
   collaboration-weighted score rather than raw recency or popularity:
     collab work > validated work > new work
   This is the algorithm the whole model rests on — it surfaces what
   got MADE TOGETHER, not what got the most attention.
================================================================ */
app.get("/api/feed/showroom", maybeAuth, (req, res) => {
  const rows = db.prepare(`
    SELECT p.*, u.username AS author_username, u.display_name AS author_name,
           u.role AS author_role, u.avatar_url AS author_avatar, u.accent AS author_accent, u.rep AS author_rep,
      (SELECT COUNT(*) FROM likes l WHERE l.post_id = p.id) AS like_count,
      (SELECT COUNT(*) FROM posts s WHERE s.shared_from = p.id) AS share_count,
      (SELECT COUNT(*) FROM likes l WHERE l.post_id = p.id AND l.user_id = ?) AS liked_by_me,
      (SELECT COUNT(*) FROM collaborators c WHERE c.post_id = p.id AND c.status='accepted') AS collab_count,
      tr.title AS track_title, tr.url AS track_url, tr.artwork_url AS track_art, tr.duration_ms AS track_dur, tu.username AS track_by
    FROM posts p
    JOIN users u ON u.id = p.author_id
    LEFT JOIN tracks tr ON tr.id = p.audio_track_id
    LEFT JOIN users tu ON tu.id = tr.user_id
    WHERE p.is_work = 1 AND p.shared_from IS NULL
    ORDER BY (
      (SELECT COUNT(*) FROM collaborators c WHERE c.post_id = p.id AND c.status='accepted') * 30 +
      (SELECT COUNT(*) FROM likes l WHERE l.post_id = p.id) * 6 +
      (SELECT COUNT(*) FROM posts s WHERE s.shared_from = p.id) * 3 -
      ((? - p.created_at) / 3600000.0) * 0.6
    ) DESC
    LIMIT 60`).all(req.user?.id || 0, Date.now());
  const hidden = req.user ? blockedIds(req.user.id) : new Set();
  res.json({ posts: shapePosts(rows.filter((r) => !hidden.has(r.author_username))) });
});

/* Builders — people whose work is being validated right now. */
app.get("/api/builders", maybeAuth, (req, res) => {
  const rows = db.prepare(`
    SELECT u.username, u.display_name, u.role, u.avatar_url, u.rep, u.published,
      (SELECT COUNT(*) FROM posts p WHERE p.author_id = u.id) AS posts,
      (SELECT COUNT(*) FROM collaborators c WHERE c.user_id = u.id AND c.status='accepted') AS collabs,
      (SELECT COUNT(*) FROM likes l JOIN posts p2 ON p2.id = l.post_id WHERE p2.author_id = u.id) AS validations
    FROM users u
    WHERE (SELECT COUNT(*) FROM posts p WHERE p.author_id = u.id) > 0
    ORDER BY (u.rep + (SELECT COUNT(*) FROM collaborators c WHERE c.user_id = u.id AND c.status='accepted') * 10) DESC
    LIMIT 12`).all();
  const hidden = req.user ? blockedIds(req.user.id) : new Set();
  res.json({ builders: rows.filter((r) => !hidden.has(r.username)).map((r) => ({ ...r, level: levelFor(r.rep).id, levelName: levelFor(r.rep).name })) });
});

