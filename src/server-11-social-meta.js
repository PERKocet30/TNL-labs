/* ================================================================
   SOCIAL GRAPH — follow / unfollow / profile
================================================================ */
app.post("/api/users/:username/follow", auth, (req, res) => {
  const target = q.userByName.get(req.params.username);
  if (!target) return res.status(404).json({ error: "no such user" });
  if (target.id === req.user.id) return res.status(400).json({ error: "cannot follow yourself" });
  const already = q.followExists.get(req.user.id, target.id);
  if (already) { q.unfollow.run(req.user.id, target.id); return res.json({ following: false }); }
  q.follow.run(req.user.id, target.id, Date.now());
  notify(target.id, req.user.id, "follow", null, "followed you");
  res.json({ following: true });
});

/* Edit your own profile — bio, link, display name, role. */
app.patch("/api/me", auth, (req, res) => {
  const { displayName, bio, link, roles, accent } = req.body || {};
  let roleList = null;
  if (Array.isArray(roles)) {
    roleList = roles.filter((r) => typeof r === "string" && r.trim()).slice(0, 5).map((r) => r.slice(0, 40));
  }
  const next = {
    displayName: (displayName ?? req.user.display_name).toString().slice(0, 40).trim() || req.user.display_name,
    bio: (bio ?? req.user.bio).toString().slice(0, 300),
    link: (link ?? req.user.link).toString().slice(0, 200).trim(),
    roles: roleList ?? JSON.parse(req.user.roles || "[]"),
  };
  const nextAccent = (accent && ACCENTS[accent]) ? accent : (req.user.accent || "lab");
  db.prepare(`UPDATE users SET display_name = ?, bio = ?, link = ?, roles = ?, role = ?, accent = ? WHERE id = ?`)
    .run(next.displayName, next.bio, next.link, JSON.stringify(next.roles),
         next.roles[0] || req.user.role, nextAccent, req.user.id);
  res.json({ user: publicUser(q.userById.get(req.user.id)) });
});

/* Full profile = the portfolio. Everything they've published, plus the
   stats that make standing legible: work, validation received, collabs. */
app.get("/api/users/:username", maybeAuth, (req, res) => {
  const u = q.userByName.get(req.params.username);
  if (!u) return res.status(404).json({ error: "no such user" });
  const posts = shapePosts(feedRows({ authorId: u.id, viewerId: req.user?.id, limit: 40, workOnly: true }));

  // work they collaborated ON (someone else's post they accepted)
  const collabRows = db.prepare(`
    SELECT p.*, au.username AS author_username, au.display_name AS author_name,
           au.role AS author_role, au.avatar_url AS author_avatar, au.accent AS author_accent, au.rep AS author_rep,
      (SELECT COUNT(*) FROM likes l WHERE l.post_id = p.id) AS like_count,
      (SELECT COUNT(*) FROM posts s WHERE s.shared_from = p.id) AS share_count,
      (SELECT COUNT(*) FROM likes l WHERE l.post_id = p.id AND l.user_id = ?) AS liked_by_me
    FROM collaborators c
    JOIN posts p ON p.id = c.post_id
    JOIN users au ON au.id = p.author_id
    WHERE c.user_id = ? AND c.status = 'accepted' AND p.author_id != ?
    ORDER BY p.created_at DESC LIMIT 100`).all(req.user?.id || 0, u.id, u.id);

  const likesReceived = db.prepare(
    `SELECT COUNT(*) n FROM likes l JOIN posts p ON p.id = l.post_id WHERE p.author_id = ?`
  ).get(u.id).n;
  const collabCount = db.prepare(
    `SELECT COUNT(*) n FROM collaborators WHERE user_id = ? AND status = 'accepted'`
  ).get(u.id).n;

  res.json({
    user: publicUser(u),
    followers: q.followerCount.get(u.id).n,
    following: db.prepare(`SELECT COUNT(*) n FROM follows WHERE follower_id = ?`).get(u.id).n,
    youFollow: req.user ? !!q.followExists.get(req.user.id, u.id) : false,
    stats: { posts: posts.length, likesReceived, collabs: collabCount },
    posts,
    collabs: shapePosts(collabRows),
  });
});

/* Following feed — posts from people you follow (plus your own). */
app.get("/api/feed/following", auth, (req, res) => {
  const ids = q.followingIds.all(req.user.id).map((r) => r.followee_id);
  ids.push(req.user.id);
  const placeholders = ids.map(() => "?").join(",");
  const sql = `
    SELECT p.*, u.username AS author_username, u.display_name AS author_name, u.role AS author_role,
      u.avatar_url AS author_avatar, u.accent AS author_accent, u.rep AS author_rep,
      (SELECT COUNT(*) FROM likes l WHERE l.post_id = p.id) AS like_count,
      (SELECT COUNT(*) FROM posts s WHERE s.shared_from = p.id) AS share_count,
      (SELECT COUNT(*) FROM likes l WHERE l.post_id = p.id AND l.user_id = ?) AS liked_by_me
    FROM posts p JOIN users u ON u.id = p.author_id
    WHERE p.author_id IN (${placeholders})
    ORDER BY p.created_at DESC LIMIT 60`;
  const rows = db.prepare(sql).all(req.user.id, ...ids);
  res.json({ posts: shapePosts(rows) });
});

/* ---- meta ---- */
app.get("/api/levels", (_req, res) => res.json({
  levels: LEVELS, accents: ACCENTS,
  site: {
    headline: setting("headline"),
    tagline: setting("tagline"),
    announcement: setting("announcement"),
    signupsOpen: settingBool("signupsOpen"),
    pinterestBoard: setting("pinterestBoard") || null,
    distro: settingBool("distroOn") ? {
      level: Number(setting("distroLevel")) || 4,
      levelName: (LEVELS.find((l) => l.id === (Number(setting("distroLevel")) || 4)) || {}).name || "Core",
      at: (LEVELS.find((l) => l.id === (Number(setting("distroLevel")) || 4)) || {}).at ?? 280,
      blurb: setting("distroBlurb"),
    } : null,
    guestAccess: settingBool("guestAccess"),
    marketOpen: settingBool("marketOpen"),
    studioOpen: settingBool("studioOpen"),
    loopsOpen: settingBool("loopsOpen"),
  },
}));
app.get("/api/health", (_req, res) => res.json({ ok: true, time: Date.now() }));

const PORT = process.env.PORT || 8787;
/* Anything that escapes a route lands here. Previously it 500'd silently
   and you'd never know it happened. */
app.use((err, req, res, _next) => {
  logError("server", err.message || "unknown", (err.stack || "").slice(0, 1500), req.path, req.user?.username || "");
  sentryReport(err, req.method + " " + req.path);
  console.error("[500]", req.method, req.path, "—", err.message);
  if (!res.headersSent) res.status(500).json({ error: "Something broke on our end. It's been logged." });
});

/* Daily snapshot. Runs an hour after boot, then every 24h — deliberately
   not at boot, because a crash-loop would otherwise spend your disk. */
setTimeout(() => {
  try { const b = makeBackup("auto"); console.log(`[backup] ${b.name} (${(b.bytes/1024).toFixed(0)}KB)`); }
  catch (e) { console.error("[backup] failed:", e.message); }
  setInterval(() => {
    try { const b = makeBackup("auto"); console.log(`[backup] ${b.name} (${(b.bytes/1024).toFixed(0)}KB)`); }
    catch (e) { logError("server", "auto backup failed", e.message); }
  }, 24 * 3600 * 1000);
}, 3600 * 1000);

app.listen(PORT, () => {
  /* A deploy log that only says "started" tells you nothing. This says what
     is actually switched on — so you can see at a glance whether the thing
     you just set in Railway took effect.
     Wrapped in try/catch on purpose: this is a LOG. If a query in here ever
     throws, it would take down a server that had already bound the port —
     killing the app to print a banner is a terrible trade. */
  try {
    const admins = db.prepare(`SELECT username FROM users WHERE is_admin = 1`).all().map((u) => "@" + u.username);
    const users = db.prepare(`SELECT COUNT(*) n FROM users`).get().n;
    const posts = db.prepare(`SELECT COUNT(*) n FROM posts`).get().n;
    const collabs = db.prepare(`SELECT COUNT(*) n FROM collaborators WHERE status='accepted'`).get().n;
    const ok = (b) => (b ? "on " : "OFF");
    console.log(`
┌─ TNL LABS ─────────────────────────────────
│ listening   :${PORT}
│ data        ${DATA_DIR}${process.env.TNL_DATA ? "" : "   ⚠ NOT a volume — data dies on redeploy"}
│ public url  ${process.env.PUBLIC_URL || "(unset — verification links will be wrong)"}
│ email       ${ok(MAIL_ENABLED)}${!MAIL_ENABLED ? "  ⚠ links shown on screen instead of sent" : MAIL_TEST_SENDER ? "  ⚠ TEST SENDER — only YOUR inbox gets mail" : ""}
│ payments    ${ok(PAYMENTS_ENABLED)}${PAYMENTS_ENABLED ? "" : "  ⚠ buyers arrange payment directly"}
│ admin       ${admins.length ? admins.join(", ") : "(none)"}
│ in the lab  ${users} member${users === 1 ? "" : "s"} · ${posts} post${posts === 1 ? "" : "s"} · ${collabs} confirmed collab${collabs === 1 ? "" : "s"}
└────────────────────────────────────────────`);
  } catch (e) {
    console.log(`TNL LABS listening on :${PORT} (banner failed: ${e.message})`);
  }
});

/* Last line of defence. An unhandled rejection anywhere — a Stripe call, a
   Resend call, a stray await — would otherwise take the whole process down
   and log everyone out. Log it and keep serving. */
process.on("unhandledRejection", (e) => console.error("[unhandled rejection]", e?.message || e));
process.on("uncaughtException", (e) => console.error("[uncaught]", e?.message || e));
