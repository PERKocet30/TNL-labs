app.get("/api/market/:id/downloads", auth, (req, res) => {
  const l = db.prepare(`SELECT * FROM listings WHERE id = ?`).get(Number(req.params.id));
  if (!l) return res.status(404).json({ error: "no listing" });
  if (l.seller_id !== req.user.id && !req.user.is_admin) return res.status(403).json({ error: "not yours" });
  const rows = db.prepare(`
    SELECT u.username, u.display_name, u.avatar_url, u.role, d.created_at
    FROM loop_downloads d JOIN users u ON u.id = d.user_id
    WHERE d.listing_id = ? ORDER BY d.created_at DESC LIMIT 50`).all(l.id);
  res.json({ downloads: rows.map((r) => ({
    username: r.username, displayName: r.display_name, avatarUrl: r.avatar_url || "",
    role: r.role, at: r.created_at,
  })) });
});

/* What's actually happening in each lab.

   A list of hashtags is a menu. A room with the last thing made in it,
   and who's in there, is a place. This is the difference — and it's the
   only reason the grid is worth building. */
app.get("/api/labs", auth, (req, res) => {
  const now = Date.now();
  const day = now - 86400000;
  const week = now - 7 * 86400000;

  const rows = db.prepare(`
    SELECT p.channel,
           COUNT(*) AS total,
           SUM(CASE WHEN p.created_at > ? THEN 1 ELSE 0 END) AS today,
           SUM(CASE WHEN p.created_at > ? THEN 1 ELSE 0 END) AS week,
           MAX(p.created_at) AS last_at
    FROM posts p GROUP BY p.channel`).all(day, week);
  const byChannel = {};
  for (const r of rows) byChannel[r.channel] = r;

  // the most recent image in each channel — this is what makes it a place
  const art = {};
  for (const r of db.prepare(`
    SELECT p.channel, p.thumb_url, p.image_url, p.created_at, u.username, u.display_name
    FROM posts p JOIN users u ON u.id = p.author_id
    WHERE p.image_url IS NOT NULL
    ORDER BY p.created_at DESC`).all()) {
    if (!art[r.channel]) art[r.channel] = {
      url: r.thumb_url || r.image_url,
      by: r.display_name, username: r.username, at: r.created_at,
    };
  }

  // who's been in there this week
  const people = {};
  for (const r of db.prepare(`
    SELECT DISTINCT p.channel, u.username, u.display_name, u.avatar_url
    FROM posts p JOIN users u ON u.id = p.author_id
    WHERE p.created_at > ? ORDER BY p.created_at DESC`).all(week)) {
    (people[r.channel] = people[r.channel] || []).push({
      username: r.username, displayName: r.display_name, avatarUrl: r.avatar_url || "",
    });
  }

  // unread, per channel, for this person
  const unread = {};
  for (const r of db.prepare(`
    SELECT p.channel, COUNT(*) n FROM posts p
    LEFT JOIN channel_reads cr ON cr.user_id = ? AND cr.channel = p.channel
    WHERE p.author_id != ? AND p.created_at > COALESCE(cr.last_read_at, 0)
    GROUP BY p.channel`).all(req.user.id, req.user.id)) unread[r.channel] = r.n;

  res.json({ byChannel, art, people, unread });
});

/* ================================================================
   THE ARCHIVE
   Every image ever posted, searchable. This is the thing a group chat
   physically cannot do: 226 people have been posting reference into the
   PHARMACY for months and none of it can be found again.
================================================================ */
app.get("/api/archive", maybeAuth, (req, res) => {
  const { q: term, channel, by, sort } = req.query;
  const where = [`p.image_url IS NOT NULL`];
  const params = [];
  /* Chat images stay in chat. The archive is published work — otherwise
     a photo someone dropped mid-conversation becomes a public asset they
     never agreed to. */
  where.push(`p.is_work = 1`);
  if (channel) { where.push(`p.channel = ?`); params.push(channel); }
  if (by) { where.push(`u.username = ?`); params.push(by); }
  if (term) { where.push(`(p.body LIKE ? OR u.display_name LIKE ? OR p.channel LIKE ?)`); params.push(`%${term}%`, `%${term}%`, `%${term}%`); }

  const order = sort === "saved" ? `pin_count DESC, p.created_at DESC`
    : sort === "liked" ? `like_count DESC, p.created_at DESC`
    : `p.created_at DESC`;

  const rows = db.prepare(`
    SELECT p.id, p.channel, p.body, p.image_url, p.thumb_url, p.media_w, p.media_h, p.created_at,
           u.username, u.display_name, u.avatar_url,
           (SELECT COUNT(*) FROM likes l WHERE l.post_id = p.id) AS like_count,
           (SELECT COUNT(*) FROM pins pn WHERE pn.post_id = p.id) AS pin_count,
           ${req.user ? `(SELECT COUNT(*) FROM pins pn WHERE pn.post_id = p.id AND pn.user_id = ${Number(req.user.id)})` : "0"} AS pinned_by_me
    FROM posts p JOIN users u ON u.id = p.author_id
    WHERE ${where.join(" AND ")}
    ORDER BY ${order} LIMIT 100`).all(...params);

  res.json({
    images: rows.map((r) => ({
      id: r.id, channel: r.channel, body: r.body,
      url: r.thumb_url || r.image_url, full: r.image_url,
      w: r.media_w, h: r.media_h, createdAt: r.created_at,
      by: { username: r.username, displayName: r.display_name, avatarUrl: r.avatar_url || "" },
      likes: r.like_count, saves: r.pin_count, savedByMe: !!r.pinned_by_me,
    })),
    channels: db.prepare(`SELECT DISTINCT channel FROM posts WHERE image_url IS NOT NULL AND is_work = 1`).all().map((r) => r.channel),
  });
});

/* ---- boards ---- */
app.get("/api/boards", auth, (req, res) => {
  const mine = db.prepare(`
    SELECT b.*, (SELECT COUNT(*) FROM pins p WHERE p.board_id = b.id) AS n,
      (SELECT COALESCE(po.thumb_url, po.image_url) FROM pins p LEFT JOIN posts po ON po.id = p.post_id
       WHERE p.board_id = b.id AND po.image_url IS NOT NULL ORDER BY p.created_at DESC LIMIT 1) AS cover,
      (SELECT p.img_url FROM pins p WHERE p.board_id = b.id AND p.img_url != '' ORDER BY p.created_at DESC LIMIT 1) AS cover_ext
    FROM boards b WHERE b.user_id = ? ORDER BY b.updated_at DESC`).all(req.user.id);
  res.json({ boards: mine.map((b) => ({
    id: b.id, name: b.name, note: b.note, isPublic: !!b.is_public,
    count: b.n, cover: b.cover || b.cover_ext || null, updatedAt: b.updated_at,
  })) });
});

app.post("/api/boards", auth, verified, rateLimit({ max: 20, windowMs: 3600000, key: "user" }), (req, res) => {
  const name = (req.body?.name || "").toString().trim().slice(0, 60);
  if (!name) return res.status(400).json({ error: "name it" });
  const now = Date.now();
  const info = db.prepare(`INSERT INTO boards (user_id, name, note, is_public, created_at, updated_at) VALUES (?,?,?,?,?,?)`)
    .run(req.user.id, name, (req.body?.note || "").toString().slice(0, 200),
      req.body?.isPublic === false ? 0 : 1, now, now);
  res.json({ id: Number(info.lastInsertRowid) });
});

app.get("/api/boards/:id", maybeAuth, (req, res) => {
  const b = db.prepare(`SELECT b.*, u.username, u.display_name, u.avatar_url FROM boards b JOIN users u ON u.id = b.user_id WHERE b.id = ?`)
    .get(Number(req.params.id));
  if (!b) return res.status(404).json({ error: "no board" });
  if (!b.is_public && b.user_id !== req.user?.id) return res.status(403).json({ error: "private" });
  const pins = db.prepare(`
    SELECT p.*, po.image_url, po.thumb_url, po.media_w, po.media_h, po.body AS post_body, po.channel,
           u.username, u.display_name, u.avatar_url
    FROM pins p
    LEFT JOIN posts po ON po.id = p.post_id
    LEFT JOIN users u ON u.id = po.author_id
    WHERE p.board_id = ? ORDER BY p.created_at DESC`).all(b.id);
  res.json({
    board: { id: b.id, name: b.name, note: b.note, isPublic: !!b.is_public,
      by: { username: b.username, displayName: b.display_name, avatarUrl: b.avatar_url || "" },
      mine: b.user_id === req.user?.id },
    pins: pins.map((p) => ({
      id: p.id, note: p.note, createdAt: p.created_at,
      postId: p.post_id,
      url: p.post_id ? (p.thumb_url || p.image_url) : p.img_url,
      w: p.media_w, h: p.media_h,
      body: p.post_body, channel: p.channel,
      by: p.username ? { username: p.username, displayName: p.display_name, avatarUrl: p.avatar_url || "" } : null,
      srcUrl: p.src_url || null, srcSite: p.src_site || null,   // always shown, always linked
    })),
  });
});

app.delete("/api/boards/:id", auth, (req, res) => {
  db.prepare(`DELETE FROM boards WHERE id = ? AND user_id = ?`).run(Number(req.params.id), req.user.id);
  res.json({ ok: true });
});

/* Pin a TNL piece. This is the one that matters: the person who made it
   gets told, and earns for it. Pinterest can't do that — it doesn't know
   who anyone is. */
app.post("/api/boards/:id/pin", auth, verified, rateLimit({ max: 120, windowMs: 3600000, key: "user" }), (req, res) => {
  const b = db.prepare(`SELECT * FROM boards WHERE id = ? AND user_id = ?`).get(Number(req.params.id), req.user.id);
  if (!b) return res.status(404).json({ error: "not your board" });

  const { postId, srcUrl, imgUrl, note } = req.body || {};
  const now = Date.now();

  if (postId) {
    const post = db.prepare(`SELECT * FROM posts WHERE id = ? AND is_work = 1`).get(Number(postId));
    if (!post) return res.status(404).json({ error: "no such work" });
    if (db.prepare(`SELECT 1 FROM pins WHERE board_id = ? AND post_id = ?`).get(b.id, post.id)) {
      return res.status(409).json({ error: "already on this board" });
    }
    db.prepare(`INSERT INTO pins (board_id, user_id, post_id, note, created_at) VALUES (?,?,?,?,?)`)
      .run(b.id, req.user.id, post.id, (note || "").toString().slice(0, 200), now);
    db.prepare(`UPDATE boards SET updated_at = ? WHERE id = ?`).run(now, b.id);

    /* Once per person per piece — saving the same image to five boards is
       one endorsement, not five. Same rule as likes. */
    if (post.author_id !== req.user.id) {
      const already = db.prepare(`SELECT COUNT(*) n FROM pins p JOIN boards bo ON bo.id = p.board_id
        WHERE p.post_id = ? AND bo.user_id = ?`).get(post.id, req.user.id).n;
      if (already === 1) {
        awardRep(post.author_id, "pinned", post.id);
        notify(post.author_id, req.user.id, "pin", post.id, `saved your work to "${b.name}"`);
      }
    }
    return res.json({ ok: true });
  }

  /* An external reference. We store the LINK and the source — we do not
     rehost the file. The image is hotlinked and credited. If it disappears
     from its home, it disappears from here; that's correct. It isn't ours. */
  if (!srcUrl || !/^https?:\/\//i.test(srcUrl)) return res.status(400).json({ error: "need a real link" });
  let site = "";
  try { site = new URL(srcUrl).hostname.replace(/^www\./, ""); } catch { return res.status(400).json({ error: "bad link" }); }
  db.prepare(`INSERT INTO pins (board_id, user_id, src_url, src_site, img_url, note, created_at) VALUES (?,?,?,?,?,?,?)`)
    .run(b.id, req.user.id, srcUrl.slice(0, 500), site.slice(0, 80),
      (imgUrl && /^https?:\/\//i.test(imgUrl) ? imgUrl.slice(0, 500) : srcUrl.slice(0, 500)),
      (note || "").toString().slice(0, 200), now);
  db.prepare(`UPDATE boards SET updated_at = ? WHERE id = ?`).run(now, b.id);
  res.json({ ok: true, site });
});

app.delete("/api/pins/:id", auth, (req, res) => {
  const p = db.prepare(`SELECT p.* FROM pins p JOIN boards b ON b.id = p.board_id WHERE p.id = ? AND b.user_id = ?`)
    .get(Number(req.params.id), req.user.id);
  if (!p) return res.status(404).json({ error: "not yours" });
  db.prepare(`DELETE FROM pins WHERE id = ?`).run(p.id);
  res.json({ ok: true });
});

/* Who saved your work, and onto what. A curator saving your piece into
   "Fall/Winter refs" is telling you something a like never could. */
app.get("/api/posts/:id/saves", auth, (req, res) => {
  const post = db.prepare(`SELECT * FROM posts WHERE id = ?`).get(Number(req.params.id));
  if (!post) return res.status(404).json({ error: "no post" });
  if (post.author_id !== req.user.id && !req.user.is_admin) return res.status(403).json({ error: "not yours" });
  const rows = db.prepare(`
    SELECT b.name AS board, b.id AS board_id, b.is_public, u.username, u.display_name, u.avatar_url, p.created_at
    FROM pins p JOIN boards b ON b.id = p.board_id JOIN users u ON u.id = b.user_id
    WHERE p.post_id = ? ORDER BY p.created_at DESC LIMIT 50`).all(post.id);
  res.json({ saves: rows.filter((r) => r.is_public).map((r) => ({
    board: r.board, boardId: r.board_id, at: r.created_at,
    by: { username: r.username, displayName: r.display_name, avatarUrl: r.avatar_url || "" },
  })) });
});

/* Paste a link, get the image. We fetch the page's OG tags server-side and
   return the image URL — the file stays where it lives, we never rehost it.

   Instagram won't work, and that's Meta's decision, not a bug here: their
   CDN URLs are signed and expire, and instagram.com serves crawlers a login
   wall. The official route (oEmbed) needs a Facebook App and app review.
   Everything else on the web — are.na, Tumblr, blogs, direct image links —
   works fine. */
const UNFURL_TIMEOUT = 6000;
app.post("/api/unfurl", auth, verified, rateLimit({ max: 40, windowMs: 600000, key: "user" }), async (req, res) => {
  const url = (req.body?.url || "").toString().trim();
  if (!/^https?:\/\//i.test(url)) return res.status(400).json({ error: "need a real link" });

  let host = "";
  try { host = new URL(url).hostname.replace(/^www\./, ""); }
  catch { return res.status(400).json({ error: "bad link" }); }

  /* SSRF guard. Without this, someone pastes http://localhost:8787/api/admin/…
     or an AWS metadata URL and the server fetches it for them, from inside
     the network, with whatever access it has. This is the bug that turns a
     nice feature into a breach. */
  if (/^(localhost|127\.|0\.|10\.|172\.(1[6-9]|2\d|3[01])\.|192\.168\.|169\.254\.|\[?::1)/i.test(host)) {
    return res.status(400).json({ error: "no" });
  }

  // A direct image link needs no fetching — it's already the answer.
  if (/\.(jpe?g|png|gif|webp|avif)(\?|$)/i.test(url)) {
    return res.json({ image: url, title: "", site: host, url });
  }

  /* Pinterest works, and it's worth saying why it differs from Instagram:
     i.pinimg.com URLs are unsigned, don't expire, and their pin pages
     serve og:image to anyone. They want the link spread. Meta doesn't. */
  if (/^(www\.)?instagram\.com$|^instagr\.am$/i.test(host)) {
    return res.status(422).json({
      error: "Instagram blocks this",
      detail: "Their image URLs are signed and expire, and they serve crawlers a login wall. Screenshot it and upload, or use the are.na/Tumblr source if there is one.",
      site: host,
    });
  }

  try {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), UNFURL_TIMEOUT);
    const r = await fetch(url, {
      signal: ctrl.signal,
      redirect: "follow",
      headers: {
        // identify honestly. a fake browser UA is how you get blocked properly.
        "User-Agent": "TNLLabsBot/1.0 (+https://labs.tnllabs.com)",
        Accept: "text/html,application/xhtml+xml",
      },
    });
    clearTimeout(timer);
    if (!r.ok) return res.status(422).json({ error: `${host} returned ${r.status}`, site: host });

    // Read the head only — no reason to pull a 5MB page for 4 tags.
    const reader = r.body.getReader();
    let html = "", got = 0;
    while (got < 120000) {
      const { done, value } = await reader.read();
      if (done) break;
      html += Buffer.from(value).toString("utf8");
      got += value.length;
      if (/<\/head>/i.test(html)) break;
    }
    try { reader.cancel(); } catch {}

    const meta = (prop) => {
      const m = new RegExp(`<meta[^>]+(?:property|name)=["']${prop}["'][^>]+content=["']([^"']+)["']`, "i").exec(html)
        || new RegExp(`<meta[^>]+content=["']([^"']+)["'][^>]+(?:property|name)=["']${prop}["']`, "i").exec(html);
      return m ? m[1] : null;
    };
    let image = meta("og:image") || meta("twitter:image") || meta("og:image:url");
    if (image && !/^https?:\/\//i.test(image)) {
      try { image = new URL(image, url).href; } catch { image = null; }
    }
    const title = meta("og:title") || (/<title>([^<]+)<\/title>/i.exec(html) || [, ""])[1];

    if (!image) return res.status(422).json({ error: `${host} doesn't share an image`, site: host, title: title || "" });
    res.json({ image, title: (title || "").slice(0, 140), site: host, url });
  } catch (e) {
    const why = e.name === "AbortError" ? `${host} took too long` : `couldn't reach ${host}`;
    res.status(422).json({ error: why, site: host });
  }
});

/* ================================================================
   SOURCING
   Search the web for reference without becoming a piracy host.

   Two sources, both free, both legal by construction:
     • are.na — the archive platform your people already use. Public API,
       no key. Searching and linking back is what it's for; we send them
       traffic. The aesthetic is a direct match for the PHARMACY.
     • Openverse — Creative Commons' own index, 700M+ images, every result
       carries its licence. Built to solve exactly this problem.

   Google Images and scraping stay off the table: that's Pinterest's game
   and Pinterest has a legal team.

   We return LINKS. Nothing is rehosted, everything is credited, and the
   source is always one tap away.
================================================================ */
app.get("/api/source", auth, verified, rateLimit({ max: 60, windowMs: 600000, key: "user" }), async (req, res) => {
  const term = (req.query.q || "").toString().trim().slice(0, 80);
  const from = (req.query.from || "arena").toString();
  if (!term) return res.json({ results: [], source: from });

  const timeout = (ms) => { const c = new AbortController(); setTimeout(() => c.abort(), ms); return c.signal; };
  const UA = { "User-Agent": "TNLLabsBot/1.0 (+https://labs.tnllabs.com)" };

  try {
    if (from === "arena") {
      const r = await fetch(`https://api.are.na/v2/search/blocks?q=${encodeURIComponent(term)}&per=40`,
        { signal: timeout(7000), headers: UA });
      if (!r.ok) return res.status(502).json({ error: `are.na returned ${r.status}`, results: [] });
      const d = await r.json();
      const results = (d.blocks || [])
        .filter((b) => b.image && (b.image.large || b.image.display))
        .map((b) => ({
          id: "arena-" + b.id,
          img: (b.image.display || b.image.large || {}).url,
          full: (b.image.large || b.image.display || {}).url,
          title: (b.title || "").slice(0, 100),
          by: b.user ? b.user.full_name : "",
          src: `https://www.are.na/block/${b.id}`,
          site: "are.na",
          licence: "",
        }));
      return res.json({ results, source: "arena" });
    }

    if (from === "openverse") {
      const r = await fetch(
        `https://api.openverse.org/v1/images/?q=${encodeURIComponent(term)}&page_size=40&mature=false`,
        { signal: timeout(7000), headers: UA });
      if (!r.ok) return res.status(502).json({ error: `openverse returned ${r.status}`, results: [] });
      const d = await r.json();
      const results = (d.results || []).map((x) => ({
        id: "ov-" + x.id,
        img: x.thumbnail || x.url,
        full: x.url,
        title: (x.title || "").slice(0, 100),
        by: x.creator || "",
        src: x.foreign_landing_url || x.url,
        site: (x.source || "openverse"),
        /* The licence is the whole point of Openverse. Showing it isn't
           decoration — it's what makes using the image safe. */
        licence: (x.license || "").toUpperCase() + (x.license_version ? " " + x.license_version : ""),
      }));
      return res.json({ results, source: "openverse" });
    }

    res.status(400).json({ error: "unknown source" });
  } catch (e) {
    const why = e.name === "AbortError" ? "that took too long" : "couldn't reach it";
    res.status(502).json({ error: why, results: [] });
  }
});

