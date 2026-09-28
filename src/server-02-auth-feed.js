/* ================================================================
   AUTH
================================================================ */
/* Checked on EVERY authenticated request. A suspension that only removes
   sessions is worthless the moment they log back in. */
function auth(req, res, next) {
  const header = req.get("authorization") || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : null;
  if (!token) return res.status(401).json({ error: "no token" });
  const s = q.sessionByToken.get(token);
  if (!s) return res.status(401).json({ error: "invalid token" });
  req.user = q.userById.get(s.user_id);
  req.token = token;
  if (!req.user) return res.status(401).json({ error: "user gone" });
  /* Checked on EVERY request, not just at login. A suspension that only
     kills existing sessions is undone the moment they sign back in. */
  if (req.user.suspended) {
    db.prepare(`DELETE FROM sessions WHERE user_id = ?`).run(req.user.id);
    return res.status(403).json({ error: "This account is suspended.", suspended: true });
  }
  next();
}
// optional auth: attaches req.user if a valid token is present, else continues
function maybeAuth(req, _res, next) {
  const header = req.get("authorization") || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : null;
  if (token) {
    const s = q.sessionByToken.get(token);
    if (s) req.user = q.userById.get(s.user_id);
  }
  next();
}

function baseUrl(req) {
  let u = (process.env.PUBLIC_URL || "").trim();
  if (u) {
    if (!/^https?:\/\//i.test(u)) u = "https://" + u; // tolerate a pasted host with no scheme
    return u.replace(/\/+$/, "");                       // and a stray trailing slash
  }
  return `${req.protocol}://${req.get("host")}`;
}

async function issueVerification(user, req) {
  q.clearVerifyTokens.run(user.id);
  const token = randomBytes(24).toString("hex");
  const ttl = Date.now() + 24 * 60 * 60 * 1000;
  q.makeVerifyToken.run(token, user.id, ttl, Date.now());
  const url = `${baseUrl(req)}/api/auth/verify?token=${token}`;
  const result = await sendVerifyEmail(user.email, user.display_name, url);
  // If mail isn't configured, hand the link back so the flow is still testable.
  return { ...result, url: result.sent ? undefined : url };
}

app.post("/api/auth/register", rateLimit({ max: 5, windowMs: 3600000 }), async (req, res) => {
  // The door can be closed from the dashboard.
  if (!settingBool("signupsOpen")) {
    return res.status(403).json({ error: "TNL LABS is invite-only right now." });
  }
  const { username, displayName, email, role, roles, password } = req.body || {};
  const roleList = Array.isArray(roles) ? roles.filter(r=>typeof r==="string"&&r.trim()).slice(0,5) : (role ? [role] : []);
  if (!/^[a-z0-9._]{2,20}$/.test(username || "")) return res.status(400).json({ error: "bad username" });
  if (!displayName?.trim()) return res.status(400).json({ error: "display name required" });
  if (!/^\S+@\S+\.\S+$/.test(email || "")) return res.status(400).json({ error: "bad email" });
  if (!password || password.length < 6) return res.status(400).json({ error: "password too short" });
  if (q.userByName.get(username)) return res.status(409).json({ error: "username taken" });
  if (db.prepare(`SELECT 1 FROM users WHERE email = ?`).get(email.trim()))
    return res.status(409).json({ error: "email already registered" });

  const hash = await bcrypt.hash(password, 10);
  const info = q.createUser.run(username, displayName.trim(), email.trim(), roleList[0] || "Member", hash, Date.now());
  db.prepare(`UPDATE users SET roles = ? WHERE id = ?`).run(JSON.stringify(roleList), info.lastInsertRowid);
  const user = q.userById.get(info.lastInsertRowid);
  const token = randomBytes(24).toString("hex");
  q.createSession.run(token, user.id, Date.now());
  ensureAdmin(); // the very first signup becomes the founder/admin
  const fresh = q.userById.get(user.id);
  /* If email is broken, this is the switch that stops it costing you
     members. Flip it in the dashboard; people are verified on arrival. */
  if (settingBool("autoVerify")) {
    q.markVerified.run(user.id);
    const done = q.userById.get(user.id);
    console.log(`[auth] @${done.username} auto-verified (autoVerify is on)`);
    return res.json({ token, user: publicUser(done), mailSent: false, autoVerified: true });
  }
  const mail = await issueVerification(fresh, req);
  res.json({ token, user: publicUser(fresh), mailSent: mail.sent, verifyUrl: mail.url });
});

/* Click-through from the email. A real page, not JSON — this is often the
   first thing a new member sees, so it shouldn't look like an API error. */
app.get("/api/auth/verify", (req, res) => {
  const row = q.verifyToken.get(String(req.query.token || ""));
  const page = (title, msg, state) => `<!doctype html><html><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${title} — TNL LABS</title></head>
<body style="margin:0;background:#000;color:#fff;font-family:Helvetica,Arial,sans-serif;display:flex;align-items:center;justify-content:center;min-height:100vh;text-align:center;padding:24px">
<div style="max-width:360px">
  <div style="color:#98FC68;font-family:monospace;font-size:11px;letter-spacing:.16em">TNLLABS &#129514;</div>
  <div style="font-size:44px;margin:18px 0 6px">${state === "ok" ? "&#10003;" : "&#9888;"}</div>
  <h1 style="font-size:24px;margin:8px 0;text-transform:uppercase;letter-spacing:-.5px">${title}</h1>
  <p style="color:#8A8A8A;font-size:14px;line-height:1.65;margin:0 0 22px">${msg}</p>
  <a href="/" style="display:inline-block;background:${state === "ok" ? "#98FC68" : "#fff"};color:#000;text-decoration:none;font-weight:700;font-size:14px;padding:13px 24px;border-radius:9px">
    ${state === "ok" ? "Enter the lab" : "Back to TNL LABS"}</a>
  ${state === "expired" ? `<p style="color:#5A5A5A;font-size:12px;margin-top:18px;line-height:1.6">Sign in and hit <b style="color:#8A8A8A">Resend</b> on the banner at the top — a new link takes a second.</p>` : ""}
</div>
${state === "ok" ? `<script>setTimeout(()=>location.href="/",2500)</script>` : ""}
</body></html>`;

  if (!row) {
    // Either a bad link, or one that already worked — those look identical
    // once the token is consumed, so don't accuse anyone of anything.
    return res.status(400).send(page("Link already used",
      "This link's been used or it isn't valid any more. If you already verified, you're good — just sign in.", "used"));
  }
  if (row.expires_at < Date.now()) {
    return res.status(400).send(page("Link expired", "Verification links last 24 hours.", "expired"));
  }
  q.markVerified.run(row.user_id);
  q.clearVerifyTokens.run(row.user_id);
  const u = q.userById.get(row.user_id);
  console.log(`[auth] @${u?.username} verified`);
  res.send(page("You're in", "Email confirmed. Your account's live — post work, collab, and sell.", "ok"));
});

/* Resend, with a real cooldown. Without one, an impatient person taps five
   times, sends five links, and the first four stop working — which reads
   as "the app is broken". */
app.post("/api/auth/resend", auth, rateLimit({ max: 4, windowMs: 900000, key: "user" }), async (req, res) => {
  if (req.user.email_verified) return res.json({ ok: true, already: true });
  const last = db.prepare(`SELECT created_at FROM verify_tokens WHERE user_id = ? ORDER BY created_at DESC LIMIT 1`)
    .get(req.user.id);
  if (last && Date.now() - last.created_at < 60000) {
    const wait = Math.ceil((60000 - (Date.now() - last.created_at)) / 1000);
    return res.status(429).json({ error: `Just sent one — check your inbox, or try again in ${wait}s` });
  }
  const mail = await issueVerification(req.user, req);
  res.json({ ok: true, mailSent: mail.sent, verifyUrl: mail.url, email: req.user.email });
});

/* Lets the app notice you verified in another tab without a reload. */
app.get("/api/auth/status", auth, (req, res) => {
  res.json({ verified: !!req.user.email_verified, email: req.user.email });
});

/* Emails are stored as typed, so look them up case-insensitively.
   Exact match first; older rows could differ only by case. */
function usersByEmail(email) {
  const e = String(email || "").trim();
  if (!e) return [];
  const exact = db.prepare(`SELECT * FROM users WHERE email = ?`).get(e);
  if (exact) return [exact];
  return db.prepare(`SELECT * FROM users WHERE LOWER(TRIM(email)) = ? ORDER BY id`).all(e.toLowerCase());
}

/* Sign in with a username or an email. Usernames can't contain "@"
   (see register), so anything shaped like an address is an email;
   a leading "@" on a handle is just how people type it. */
app.post("/api/auth/login", rateLimit({ max: 8, windowMs: 900000 }), async (req, res) => {
  const body = req.body || {};
  const id = String(body.identifier ?? body.username ?? "").trim();
  const password = String(body.password || "");
  let candidates = [];
  if (/^[^@\s]+@[^@\s]+$/.test(id)) {
    candidates = usersByEmail(id);
  } else {
    const name = id.replace(/^@/, "");
    const u = q.userByName.get(name) || q.userByName.get(name.toLowerCase());
    if (u) candidates = [u];
  }
  let user = null;
  for (const c of candidates) {
    if (await bcrypt.compare(password, c.password_hash)) { user = c; break; }
  }
  if (!user) return res.status(401).json({ error: "Username or email and password don't match." });
  const token = randomBytes(24).toString("hex");
  q.createSession.run(token, user.id, Date.now());
  res.json({ token, user: publicUser(user) });
});

app.post("/api/auth/logout", auth, (req, res) => {
  q.deleteSession.run(req.token);
  res.json({ ok: true });
});

app.get("/api/me", auth, (req, res) => res.json({ user: publicUser(req.user) }));

// Look around unverified; contribute only once the email is confirmed.
/* An account is full access. Confirmation mail still goes out and still
   works, it just doesn't hold anyone at the door — links get disabled when
   a message lands in spam, which stranded the first outside signup.
   Money is unaffected: listing and buying need Stripe onboarding. */
function verified(req, res, next) {
  next();
}

/* ================================================================
   POSTS & FEED
================================================================ */
/* The Showroom feed — work across every lab, newest first. `work=1`
   returns only posts carrying actual output (an image or a beat), so
   the front page is a portfolio wall, not chatter. */
/* The line between the storefront and the workshop.
   PUBLIC: the Showroom, the Market, profiles, search — the things that
   explain what TNL is to someone who's never heard of it.
   MEMBERS ONLY: the labs. That's where people actually talk, and it's not
   a marketing surface. You get in by joining. */
app.get("/api/feed", auth, (req, res) => {
  const workOnly = req.query.work === "1";
  const rows = feedRows({
    channel: req.query.channel,
    viewerId: req.user?.id,
    workOnly,
    limit: workOnly ? 120 : 50,
  });
  const hidden = req.user ? blockedIds(req.user.id) : new Set();
  res.json({ posts: shapePosts(rows.filter((r) => !hidden.has(r.author_username))) });
});

app.post("/api/posts", auth, verified, rateLimit({ max: 20, windowMs: 60000, key: "user" }), (req, res) => {
  const { channel, body, beat, imageUrl, videoUrl, thumbUrl, mediaW, mediaH, isWork, images, audioTrackId } = req.body || {};

  /* Music rides on the post — the id must point at a real library track
     (Instagram model: pick a sound from the catalog, never a raw file). */
  const atid = (() => { const n = Number(audioTrackId);
    if (!Number.isInteger(n) || n <= 0) return null;
    return db.prepare(`SELECT id FROM tracks WHERE id = ?`).get(n) ? n : null; })();

  /* Several images, one post. Most lab chat is exactly this: someone drops
     four refs mid-sentence and it's ONE thought, not four posts.
     image_url stays the first one, so old posts, link previews and OG tags
     keep working with no special-casing anywhere. */
  const gallery = Array.isArray(images)
    ? images.filter((i) => i && typeof i.url === "string" && i.url.startsWith("/uploads/")).slice(0, 10)
      .map((i) => ({
        url: i.url,
        thumb: typeof i.thumb === "string" && i.thumb.startsWith("/uploads/") ? i.thumb : i.url,
        w: Number(i.w) || null, h: Number(i.h) || null,
      }))
    : [];
  const first = gallery[0];

  if (!body?.trim() && !beat && !imageUrl && !videoUrl && !first) return res.status(400).json({ error: "empty post" });
  // Beats are always work. Chat media is only work if the author says so.
  const work = beat ? 1 : (isWork ? 1 : 0);
  const info = q.createPost.run(
    req.user.id, channel || "general", (body || "").trim(),
    beat ? JSON.stringify(beat) : null,
    (first ? first.url : imageUrl) || null, videoUrl || null,
    (first ? first.thumb : thumbUrl) || null,
    Number(first ? first.w : mediaW) || null, Number(first ? first.h : mediaH) || null,
    work, null,
    gallery.length > 1 ? JSON.stringify(gallery) : null,   // 1 image isn't a gallery
    atid,
    Date.now()
  );
  const row = feedRows({ authorId: req.user.id, viewerId: req.user.id, limit: 1 })
    .find((r) => r.id === Number(info.lastInsertRowid));
  const post = shapePost(row);
  notifyMentions(post.body, req.user.id, post.id, "mention");
  /* BandLab move, TNL economy: publishing a remix credits the original.
     Rep uses the existing share_received kind — a remix IS your work
     re-circulating. Self-remixes earn nothing. */
  if (beat?.remixOf?.postId) {
    const op = db.prepare(`SELECT author_id FROM posts WHERE id = ?`).get(Number(beat.remixOf.postId));
    if (op && op.author_id !== req.user.id) {
      awardRep(op.author_id, "share_received", post.id);
      notify(op.author_id, req.user.id, "share", post.id, `remixed "${(beat.remixOf.name || "your loop").slice(0, 60)}" — the loop travels`);
    }
  }
  broadcast("post", post);
  res.json({ post });
});

/* Like / unlike — toggling. Liking someone else's post awards THEM rep. */
app.post("/api/posts/:id/like", auth, verified, (req, res) => {
  const post = q.postById.get(Number(req.params.id));
  if (!post) return res.status(404).json({ error: "no post" });
  const already = q.likeExists.get(post.id, req.user.id);
  let liked;
  if (already) {
    q.unlike.run(post.id, req.user.id);
    if (post.author_id !== req.user.id) revokeRep(post.author_id, "like_received", post.id);
    liked = false;
  } else {
    q.like.run(post.id, req.user.id, Date.now());
    if (post.author_id !== req.user.id) { awardRep(post.author_id, "like_received", post.id); notify(post.author_id, req.user.id, "like", post.id); }
    liked = true;
  }
  broadcast("like", { postId: post.id, liked });
  res.json({ liked });
});

/* Share — reposts an existing post into a channel. Awards the ORIGINAL author rep. */
app.post("/api/posts/:id/share", auth, verified, (req, res) => {
  const original = q.postById.get(Number(req.params.id));
  if (!original) return res.status(404).json({ error: "no post" });
  const target = (req.body?.channel || original.channel).trim();
  const info = q.createPost.run(
    req.user.id, target, req.body?.comment?.trim() || "",
    original.beat_json, original.image_url, original.video_url,
    original.thumb_url, original.media_w, original.media_h, 0, original.id,
    original.images,   // a shared series is still a series
    original.audio_track_id,   // and it keeps its sound
    Date.now()
  );
  if (original.author_id !== req.user.id) { awardRep(original.author_id, "share_received", original.id); notify(original.author_id, req.user.id, "share", original.id); }
  const row = feedRows({ authorId: req.user.id, viewerId: req.user.id, limit: 1 })
    .find((r) => r.id === Number(info.lastInsertRowid));
  const post = shapePost(row);
  broadcast("post", post);
  res.json({ post });
});

/* ================================================================
   IMAGE UPLOAD
   The browser compresses/resizes before sending, so we receive a
   modest base64 data URL. We validate by MAGIC BYTES rather than by
   trusting the declared mime type, then write a random filename —
   never anything derived from user input.
================================================================ */
