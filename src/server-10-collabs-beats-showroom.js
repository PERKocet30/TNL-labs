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
    return res.status(404).send(lookNotFound("This portfolio doesn't exist."));
  }
  const posts = shapePosts(feedRows({ authorId: u.id, viewerId: 0, limit: 60, workOnly: true }));
  const likes = db.prepare(`SELECT COUNT(*) n FROM likes l JOIN posts p ON p.id=l.post_id WHERE p.author_id=?`).get(u.id).n;
  const collabs = db.prepare(`SELECT COUNT(*) n FROM collaborators WHERE user_id=? AND status='accepted'`).get(u.id).n;
  const lvl = levelFor(u.rep);
  const K = kindFor(u.roles, u.role);
  const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

  const work = posts.map((p) => {
    const w = p.collaborators.filter((c) => c.status === "accepted").map((c) => esc(c.display_name || c.username));
    return `<div class="card">
      <div class="cap">${p.beat ? "Beat" : p.videoUrl ? "Video" : p.imageUrl ? "Image" : "Post"} · #${esc(p.channel)}</div>
      ${p.imageUrl ? `<img class="media" src="${esc(p.imageUrl)}" alt="" loading="lazy">` : ""}
      ${p.videoUrl ? `<video class="media" src="${esc(p.videoUrl)}" controls playsinline preload="metadata"></video>` : ""}
      ${p.body ? `<div class="body">${esc(p.body)}</div>` : ""}
      ${p.beat ? `<div class="body"><b>${esc(p.beat.name || "untitled loop")}</b> <span class="cap">${p.beat.bpm} BPM</span></div>` : ""}
      <div class="cap meta">${lookCount(p.likeCount, "like")} · ${lookCount(p.shareCount, "share")}${w.length ? ` · <span class="mk">//</span> with ${w.join(", ")}` : ""}</div>
    </div>`;
  }).join("");

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
  /* v2 (2026-09-29): two or more pieces → the portfolio grid
     (server-10-profile-card.js). One piece, or no ffmpeg → that piece. */
  const card = profileCardMeta(u.id, baseUrl(req), u.username);
  const ogImage = card ? card.url : abs(hero && hero.imageUrl) || abs(u.avatar_url) || `${baseUrl(req)}/icon-512.png`;
  const ogW = card ? card.w : (hero && hero.mediaW) || 512;
  const ogH = card ? card.h : (hero && hero.mediaH) || 512;

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
  const roleChips = (() => { let rs = []; try { rs = JSON.parse(u.roles || "[]"); } catch {} if (!rs.length && u.role) rs = [u.role]; return rs; })();
  res.send(lookPage({
    title: `${esc(u.display_name)} — TNL LABS`,
    head: `<link rel="canonical" href="${esc(canonical)}">

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

<meta name="description" content="${esc(ogDesc)}">`,
    body: `
${lookEyebrow(K.tag)}
<div class="who" style="margin-top:0">
  ${u.avatar_url ? `<img class="av" src="${esc(u.avatar_url)}" alt="">` : `<div class="av">${esc(u.display_name.slice(0, 2).toUpperCase())}</div>`}
  <div><div class="name">${esc(u.display_name)}</div><div class="cap">@${esc(u.username)} · L${lvl.id} ${esc(lvl.name)}</div></div>
</div>
${roleChips.length ? `<div class="chips">${roleChips.map((r) => `<span class="chip">${esc(r)}</span>`).join("")}</div>` : ""}
${u.bio ? `<p class="bio">${esc(u.bio)}</p>` : ""}
${u.link ? `<a class="cap" href="${/^https?:\/\//.test(u.link) ? esc(u.link) : "https://" + esc(u.link)}" target="_blank" rel="noreferrer nofollow">${esc(u.link.replace(/^https?:\/\//, ""))}</a>` : ""}
<div class="stats">
  <div><b>${posts.length}</b><span class="cap">${esc(K.work.charAt(0) + K.work.slice(1).toLowerCase())}</span></div>
  <div><b>${likes}</b><span class="cap">Likes</span></div>
  <div><b>${collabs}</b><span class="cap">Collabs</span></div>
</div>
${work || `<div class="cap empty">Nothing published yet.</div>`}
<a class="btn block" href="/">Build with ${esc(u.display_name)} — enter the lab</a>`,
  }));
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
   SHOWROOM — the front page: published work, ranked by rankShowroom()
   (server-10-rank.js). Builders — rankBuilders(), same file.
================================================================ */
app.get("/api/feed/showroom", maybeAuth, (req, res) => {
  const order = rankShowroom(req.user?.id || 0, 60);
  const pos = new Map(order.map((id, i) => [id, i]));
  const rows = feedRows({ ids: order, viewerId: req.user?.id, limit: 60 }).sort((a, b) => pos.get(a.id) - pos.get(b.id));
  const hidden = req.user ? blockedIds(req.user.id) : new Set();
  res.json({ posts: shapePosts(rows.filter((r) => !hidden.has(r.author_username))) });
});

/* Who's building. Names and faces only — it isn't a scoreboard. */
app.get("/api/builders", maybeAuth, (req, res) => {
  const ids = rankBuilders(req.user?.id || 0, 12);
  if (!ids.length) return res.json({ builders: [] });
  const users = new Map(db.prepare(`SELECT id, username, display_name, role, avatar_url FROM users WHERE id IN (${ids.map(Number).join(",")})`)
    .all().map((u) => [u.id, u]));
  const hidden = req.user ? blockedIds(req.user.id) : new Set();
  res.json({ builders: ids.map((id) => users.get(id)).filter((u) => u && !hidden.has(u.username))
    .map((u) => ({ username: u.username, display_name: u.display_name, role: u.role, avatar_url: u.avatar_url || "" })) });
});

