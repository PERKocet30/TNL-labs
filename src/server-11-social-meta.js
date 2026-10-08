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
  const { displayName, bio, link, roles, accent, pronouns, links } = req.body || {};
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
  /* Profile v2: several links (the first is also the old single `link`). */
  if (Array.isArray(links)) { const ls = cleanLinks(links); next.links = JSON.stringify(ls); next.link = ls[0] ? ls[0].url : ""; }
  else if (link !== undefined) next.links = JSON.stringify(cleanLinks(next.link ? [{ url: next.link }] : []));
  else next.links = req.user.links || "[]";
  next.pronouns = (pronouns ?? req.user.pronouns ?? "").toString().replace(/\s+/g, " ").trim().slice(0, 30);
  db.prepare(`UPDATE users SET display_name = ?, bio = ?, link = ?, roles = ?, role = ?, accent = ?, pronouns = ?, links = ? WHERE id = ?`)
    .run(next.displayName, next.bio, next.link, JSON.stringify(next.roles),
         next.roles[0] || req.user.role, nextAccent, next.pronouns, next.links, req.user.id);
  res.json({ user: publicUser(q.userById.get(req.user.id)) });
});

/* What anyone may see about a member. publicUser() is the account as its
   OWNER sees it (email, payouts, admin flag); this route is public — no
   sign-in needed — so until 2026-10-07 it handed every member's email to
   anyone who asked. Private fields only go to the member themself. */
const PRIVATE_FIELDS = ["email", "emailVerified", "payoutsReady", "hasStripe", "isAdmin", "published"];
function profileUser(u, viewer) {
  const pu = publicUser(u);
  if (!viewer || viewer.id !== u.id) for (const k of PRIVATE_FIELDS) delete pu[k];
  return pu;
}

/* Full profile = the portfolio. Everything they've published, plus the
   stats that make standing legible: work, validation received, collabs. */
app.get("/api/users/:username", maybeAuth, (req, res) => {
  const u = userByLooseName(req.params.username);
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
    user: profileUser(u, req.user),
    followers: q.followerCount.get(u.id).n,
    following: db.prepare(`SELECT COUNT(*) n FROM follows WHERE follower_id = ?`).get(u.id).n,
    youFollow: req.user ? !!q.followExists.get(req.user.id, u.id) : false,
    followedBy: followedBy(req.user?.id, u.id),
    stats: { posts: posts.length, likesReceived, collabs: collabCount },
    posts,
    collabs: shapePosts(collabRows),
  });
});

/* Following feed — posts from people you follow (plus your own). */

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
/* commit: which version is live (Railway sets this for GitHub deploys), so the
   after-deploy check knows when the new code is actually serving. */
app.get("/api/health", (_req, res) => res.json({ ok: true, time: Date.now(), commit: (process.env.RAILWAY_GIT_COMMIT_SHA || "").slice(0, 7) }));

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

const server = app.listen(PORT, () => {
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

/* A phone video over a weak signal can take longer than Node's default
   5 minutes to arrive; the upload route has its own size limits, so give
   a whole request 30. (2026-10-08) */
server.requestTimeout = 30 * 60 * 1000;

/* A deploy sends SIGTERM to the old server. Stop taking new connections,
   let uploads already coming in finish (Railway waits up to
   RAILWAY_DEPLOYMENT_DRAINING_SECONDS), then go. With nothing in flight
   this exits at once, so an ordinary deploy is no slower. */
process.on("SIGTERM", () => {
  console.log(`[shutdown] SIGTERM — ${UPLOADS_IN_FLIGHT} upload(s) still coming in`);
  server.close();
  server.closeIdleConnections?.();
  const wait = () => (UPLOADS_IN_FLIGHT > 0 ? setTimeout(wait, 250) : process.exit(0));
  wait();
});

/* Last line of defence. An unhandled rejection anywhere — a Stripe call, a
   Resend call, a stray await — would otherwise take the whole process down
   and log everyone out. Log it and keep serving. */
process.on("unhandledRejection", (e) => console.error("[unhandled rejection]", e?.message || e));
process.on("uncaughtException", (e) => console.error("[uncaught]", e?.message || e));
