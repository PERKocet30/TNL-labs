import express from "express";
import cors from "cors";
import bcrypt from "bcryptjs";
import { randomBytes } from "node:crypto";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { writeFileSync, mkdirSync, existsSync, createWriteStream, rename, rm } from "node:fs";
import { db, awardRep, revokeRep, levelFor, LEVELS, DATA_DIR, notify, ensureAdmin, feeForRep, FEE_BY_LEVEL } from "./db.js";
import { sendVerifyEmail, sendResetEmail, MAIL_ENABLED } from "./mail.js";
import { createCheckout, verifySession, PAYMENTS_ENABLED, platformFee,
         createSellerAccount, onboardingLink, accountStatus, loginLink } from "./pay.js";

const __dirname = dirname(fileURLToPath(import.meta.url));

/* Uploads live beside the database on the same persistent volume. */
const UPLOAD_DIR = join(DATA_DIR, "uploads");
if (!existsSync(UPLOAD_DIR)) mkdirSync(UPLOAD_DIR, { recursive: true });

/* ================================================================
   RATE LIMITING — in-memory sliding window. Keeps one person from
   spamming the feed or brute-forcing a password. Resets on restart,
   which is fine at this scale; move to Redis if you outgrow one box.
================================================================ */
const buckets = new Map();
function rateLimit({ max, windowMs, key = "ip" }) {
  return (req, res, next) => {
    const who = key === "user" && req.user ? `u${req.user.id}` : req.ip;
    const id = `${req.route?.path || req.path}:${who}`;
    const now = Date.now();
    const hits = (buckets.get(id) || []).filter((t) => now - t < windowMs);
    if (hits.length >= max) {
      const retry = Math.ceil((windowMs - (now - hits[0])) / 1000);
      res.set("Retry-After", String(retry));
      return res.status(429).json({ error: `Slow down — try again in ${retry}s` });
    }
    hits.push(now);
    buckets.set(id, hits);
    next();
  };
}
// keep the map from growing forever
setInterval(() => {
  const now = Date.now();
  for (const [k, v] of buckets) {
    const fresh = v.filter((t) => now - t < 3600000);
    if (fresh.length) buckets.set(k, fresh); else buckets.delete(k);
  }
}, 600000).unref?.();

const app = express();
app.use(cors());
/* Real media does NOT come through here — it streams to disk via
   /api/upload/stream. This limit only covers small base64 payloads
   (avatars, beat audio), and stays low on purpose: anything parsed as
   JSON is held in RAM in full. */
app.use(express.json({ limit: "12mb" })); // only the small base64 route uses this now
app.use(express.static(join(__dirname, "..", "public")));
app.use("/uploads", express.static(UPLOAD_DIR, { maxAge: "365d" }));

/* Express's own body-parser errors are ugly and unhandled by default.
   Turn "PayloadTooLargeError" into something a person can act on. */
app.use((err, req, res, next) => {
  if (err?.type === "entity.too.large") {
    return res.status(413).json({ error: "That file's too big — 25MB max for video, 8MB for images" });
  }
  if (err?.type === "entity.parse.failed") {
    return res.status(400).json({ error: "bad request body" });
  }
  next(err);
});

/* ================================================================
   PREPARED STATEMENTS
================================================================ */
const q = {
  userByName: db.prepare(`SELECT * FROM users WHERE username = ?`),
  userById: db.prepare(`SELECT * FROM users WHERE id = ?`),
  createUser: db.prepare(
    `INSERT INTO users (username, display_name, email, role, password_hash, created_at)
     VALUES (?, ?, ?, ?, ?, ?)`
  ),
  createSession: db.prepare(`INSERT INTO sessions (token, user_id, created_at) VALUES (?, ?, ?)`),
  sessionByToken: db.prepare(`SELECT * FROM sessions WHERE token = ?`),
  deleteSession: db.prepare(`DELETE FROM sessions WHERE token = ?`),

  createPost: db.prepare(
    `INSERT INTO posts (author_id, channel, body, beat_json, image_url, video_url, thumb_url, media_w, media_h, is_work, shared_from, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ),
  postById: db.prepare(`SELECT * FROM posts WHERE id = ?`),

  like: db.prepare(`INSERT OR IGNORE INTO likes (post_id, user_id, created_at) VALUES (?, ?, ?)`),
  unlike: db.prepare(`DELETE FROM likes WHERE post_id = ? AND user_id = ?`),
  likeExists: db.prepare(`SELECT 1 FROM likes WHERE post_id = ? AND user_id = ?`),

  addCollab: db.prepare(
    `INSERT OR IGNORE INTO collaborators (post_id, user_id, status, created_at) VALUES (?, ?, 'pending', ?)`
  ),
  acceptCollab: db.prepare(`UPDATE collaborators SET status = 'accepted' WHERE post_id = ? AND user_id = ?`),
  collabRow: db.prepare(`SELECT * FROM collaborators WHERE post_id = ? AND user_id = ?`),
  collabsForPost: db.prepare(
    `SELECT c.status, u.username, u.display_name
     FROM collaborators c JOIN users u ON u.id = c.user_id WHERE c.post_id = ?`
  ),

  follow: db.prepare(`INSERT OR IGNORE INTO follows (follower_id, followee_id, created_at) VALUES (?, ?, ?)`),
  unfollow: db.prepare(`DELETE FROM follows WHERE follower_id = ? AND followee_id = ?`),
  followExists: db.prepare(`SELECT 1 FROM follows WHERE follower_id = ? AND followee_id = ?`),
  followerCount: db.prepare(`SELECT COUNT(*) n FROM follows WHERE followee_id = ?`),
  followingIds: db.prepare(`SELECT followee_id FROM follows WHERE follower_id = ?`),

  makeVerifyToken: db.prepare(`INSERT INTO verify_tokens (token, user_id, expires_at, created_at) VALUES (?, ?, ?, ?)`),
  verifyToken: db.prepare(`SELECT * FROM verify_tokens WHERE token = ?`),
  clearVerifyTokens: db.prepare(`DELETE FROM verify_tokens WHERE user_id = ?`),
  markVerified: db.prepare(`UPDATE users SET email_verified = 1 WHERE id = ?`),
  setPublished: db.prepare(`UPDATE users SET published = ? WHERE id = ?`),
};

/* Feed query builder — returns posts enriched with author, counts, and
   whether the current viewer liked them. */
function feedRows({ channel, authorId, viewerId, limit = 50, workOnly = false }) {
  const where = [];
  const params = {};
  if (channel) { where.push(`p.channel = $channel`); params.channel = channel; }
  if (authorId) { where.push(`p.author_id = $authorId`); params.authorId = authorId; }
  if (workOnly) where.push(`p.is_work = 1`);
  const whereSql = where.length ? "WHERE " + where.join(" AND ") : "";
  const sql = `
    SELECT
      p.id, p.channel, p.body, p.beat_json, p.image_url, p.video_url, p.thumb_url, p.media_w, p.media_h, p.is_work, p.edited_at, p.shared_from, p.created_at,
      u.username AS author_username, u.display_name AS author_name, u.role AS author_role,
      u.avatar_url AS author_avatar, u.rep AS author_rep,
      (SELECT COUNT(*) FROM likes  l WHERE l.post_id = p.id) AS like_count,
      (SELECT COUNT(*) FROM posts  s WHERE s.shared_from = p.id) AS share_count,
      (SELECT COUNT(*) FROM likes  l WHERE l.post_id = p.id AND l.user_id = $viewer) AS liked_by_me
    FROM posts p
    JOIN users u ON u.id = p.author_id
    ${whereSql}
    ORDER BY p.created_at DESC
    LIMIT $limit`;
  params.viewer = viewerId || 0;
  params.limit = limit;
  return db.prepare(sql).all(params);
}

/* Shaping a post used to fire two extra queries EACH — a 60-post profile
   meant 120 round trips, with a fresh db.prepare() compiled every time.
   Now a whole page gets its comment counts and collaborators in two
   queries, mapped up front. This was the profile-load slowness. */
const cntOne = db.prepare(`SELECT COUNT(*) n FROM comments WHERE post_id = ?`);
const collabOne = db.prepare(
  `SELECT c.status, u.username, u.display_name FROM collaborators c
   JOIN users u ON u.id = c.user_id WHERE c.post_id = ?`
);

function sidecar(rows) {
  const ids = rows.map((r) => r.id);
  const comments = new Map(), collabs = new Map();
  if (!ids.length) return { comments, collabs };
  const holes = ids.map(() => "?").join(",");
  for (const r of db.prepare(
    `SELECT post_id, COUNT(*) n FROM comments WHERE post_id IN (${holes}) GROUP BY post_id`
  ).all(...ids)) comments.set(r.post_id, r.n);
  for (const r of db.prepare(
    `SELECT c.post_id, c.status, u.username, u.display_name FROM collaborators c
     JOIN users u ON u.id = c.user_id WHERE c.post_id IN (${holes})`
  ).all(...ids)) {
    if (!collabs.has(r.post_id)) collabs.set(r.post_id, []);
    collabs.get(r.post_id).push({ status: r.status, username: r.username, display_name: r.display_name });
  }
  return { comments, collabs };
}

/** Shape a whole page in 2 queries. Prefer this over rows. */
function shapePosts(rows) {
  const side = sidecar(rows);
  return rows.map((r) => shapePost(r, side));
}

function shapePost(row, side) {
  return {
    id: row.id,
    channel: row.channel,
    body: row.body,
    beat: row.beat_json ? JSON.parse(row.beat_json) : null,
    imageUrl: row.image_url || null,
    thumbUrl: row.thumb_url || row.image_url || null,
    mediaW: row.media_w || null,
    mediaH: row.media_h || null,
    videoUrl: row.video_url || null,
    isWork: !!row.is_work,
    editedAt: row.edited_at || null,
    sharedFrom: row.shared_from || null,
    createdAt: row.created_at,
    author: {
      username: row.author_username,
      displayName: row.author_name,
      role: row.author_role,
      avatarUrl: row.author_avatar || "",
      rep: row.author_rep,
      level: levelFor(row.author_rep).id,
    },
    likeCount: row.like_count,
    shareCount: row.share_count,
    commentCount: side ? (side.comments.get(row.id) || 0) : (cntOne.get(row.id)?.n || 0),
    likedByMe: !!row.liked_by_me,
    collaborators: side ? (side.collabs.get(row.id) || []) : collabOne.all(row.id),
  };
}

function publicUser(u) {
  return {
    username: u.username,
    displayName: u.display_name,
    email: u.email,
    role: u.role,
    roles: (() => { try { const r = JSON.parse(u.roles || "[]"); return r.length ? r : (u.role ? [u.role] : []); } catch { return u.role ? [u.role] : []; } })(),
    avatarUrl: u.avatar_url || "",
    rep: u.rep,
    bio: u.bio || "",
    link: u.link || "",
    emailVerified: !!u.email_verified,
    published: !!u.published,
    isAdmin: !!u.is_admin,
    payoutsReady: !!u.stripe_ready,
    hasStripe: !!u.stripe_account,
    createdAt: u.created_at,
    level: levelFor(u.rep).id,
    levelName: levelFor(u.rep).name,
  };
}

/* ================================================================
   REALTIME — Server-Sent Events. Feeds subscribe and update live.
================================================================ */
const clients = new Set();
function broadcast(event, data) {
  const payload = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
  for (const res of clients) res.write(payload);
}

app.get("/api/stream", (req, res) => {
  res.set({
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache",
    Connection: "keep-alive",
  });
  res.flushHeaders?.();
  res.write(`event: hello\ndata: {"ok":true}\n\n`);
  clients.add(res);
  req.on("close", () => clients.delete(res));
});

/* ================================================================
   AUTH
================================================================ */
function auth(req, res, next) {
  const header = req.get("authorization") || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : null;
  if (!token) return res.status(401).json({ error: "no token" });
  const s = q.sessionByToken.get(token);
  if (!s) return res.status(401).json({ error: "invalid token" });
  req.user = q.userById.get(s.user_id);
  req.token = token;
  if (!req.user) return res.status(401).json({ error: "user gone" });
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
  return process.env.PUBLIC_URL || `${req.protocol}://${req.get("host")}`;
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
  <div style="color:#22C55E;font-family:monospace;font-size:11px;letter-spacing:.16em">TNLLABS &#129514;</div>
  <div style="font-size:44px;margin:18px 0 6px">${state === "ok" ? "&#10003;" : "&#9888;"}</div>
  <h1 style="font-size:24px;margin:8px 0;text-transform:uppercase;letter-spacing:-.5px">${title}</h1>
  <p style="color:#8A8A8A;font-size:14px;line-height:1.65;margin:0 0 22px">${msg}</p>
  <a href="/" style="display:inline-block;background:${state === "ok" ? "#22C55E" : "#fff"};color:#000;text-decoration:none;font-weight:700;font-size:14px;padding:13px 24px;border-radius:9px">
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

app.post("/api/auth/login", rateLimit({ max: 8, windowMs: 900000 }), async (req, res) => {
  const { username, password } = req.body || {};
  const user = q.userByName.get(username || "");
  if (!user) return res.status(401).json({ error: "no such user" });
  const ok = await bcrypt.compare(password || "", user.password_hash);
  if (!ok) return res.status(401).json({ error: "wrong password" });
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
function verified(req, res, next) {
  if (!req.user.email_verified) {
    return res.status(403).json({ error: "verify your email first", needsVerify: true });
  }
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
  const { channel, body, beat, imageUrl, videoUrl, thumbUrl, mediaW, mediaH, isWork } = req.body || {};
  if (!body?.trim() && !beat && !imageUrl && !videoUrl) return res.status(400).json({ error: "empty post" });
  // Beats are always work. Chat media is only work if the author says so.
  const work = beat ? 1 : (isWork ? 1 : 0);
  const info = q.createPost.run(
    req.user.id, channel || "general", (body || "").trim(),
    beat ? JSON.stringify(beat) : null, imageUrl || null, videoUrl || null,
    thumbUrl || null, Number(mediaW) || null, Number(mediaH) || null,
    work, null, Date.now()
  );
  const row = feedRows({ authorId: req.user.id, viewerId: req.user.id, limit: 1 })
    .find((r) => r.id === Number(info.lastInsertRowid));
  const post = shapePost(row);
  notifyMentions(post.body, req.user.id, post.id, "mention");
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
    original.thumb_url, original.media_w, original.media_h, 0, original.id, Date.now()
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
/* ================================================================
   UPLOAD
   Two paths, deliberately:

   /api/upload        — small stuff (avatars, beat audio) as base64 JSON.
                        Convenient, capped low, memory-safe.
   /api/upload/stream — everything real. The raw file is the request body
                        and gets piped to disk in chunks, so memory stays
                        FLAT no matter how big the file is. This is what
                        makes 650MB video possible at all: the old base64
                        path held ~1.5GB in RAM for a 650MB clip and would
                        take the container down.

   We still sniff magic bytes — but from the FIRST CHUNK, before we agree
   to write the rest. A liar gets one chunk, not a whole file.
================================================================ */
const MAGIC = [
  { ext: "jpg", kind: "image", bytes: [0xff, 0xd8, 0xff] },
  { ext: "png", kind: "image", bytes: [0x89, 0x50, 0x4e, 0x47] },
  { ext: "gif", kind: "image", bytes: [0x47, 0x49, 0x46, 0x38] },
  { ext: "webp", kind: "image", bytes: [0x52, 0x49, 0x46, 0x46] }, // RIFF....WEBP
];
function sniff(buf) {
  for (const m of MAGIC) {
    if (m.bytes.every((b, i) => buf[i] === b)) {
      if (m.ext === "webp" && buf.slice(8, 12).toString("ascii") !== "WEBP") continue;
      if (m.ext === "webp" && buf.slice(8, 12).toString("ascii") === "WAVE") continue;
      return m;
    }
  }
  if (buf.slice(0, 4).toString("ascii") === "RIFF" && buf.slice(8, 12).toString("ascii") === "WAVE") {
    return { ext: "wav", kind: "audio" };
  }
  if (buf.slice(0, 3).toString("ascii") === "ID3") return { ext: "mp3", kind: "audio" };
  if (buf[0] === 0xff && (buf[1] & 0xe0) === 0xe0) return { ext: "mp3", kind: "audio" };
  if (buf.slice(0, 4).toString("ascii") === "OggS") return { ext: "ogg", kind: "audio" };
  const brand = buf.slice(4, 8).toString("ascii");
  if (brand === "ftyp") {
    const sub = buf.slice(8, 12).toString("ascii");
    if (/^M4A/.test(sub)) return { ext: "m4a", kind: "audio" };
    if (/^(qt| )/.test(sub)) return { ext: "mov", kind: "video" };
    return { ext: "mp4", kind: "video" };
  }
  if (buf[0] === 0x1a && buf[1] === 0x45 && buf[2] === 0xdf && buf[3] === 0xa3) {
    return { ext: "webm", kind: "video" };
  }
  return null;
}

/* Instagram: 650MB Reels, 30MB photos. We match on video and beat them on
   images, because a designer's poster is the whole point here. */
const LIMITS = { image: 30 * 1024 * 1024, video: 650 * 1024 * 1024, audio: 100 * 1024 * 1024 };
const B64_LIMIT = 8 * 1024 * 1024; // the JSON path stays small on purpose

app.post("/api/upload/stream", auth, verified, rateLimit({ max: 40, windowMs: 300000, key: "user" }), (req, res) => {
  const declared = Number(req.get("content-length") || 0);
  if (declared > LIMITS.video) {
    return res.status(413).json({ error: `That file's too big — ${LIMITS.video / 1048576}MB max` });
  }

  const tmp = join(UPLOAD_DIR, `.part-${randomBytes(10).toString("hex")}`);
  const out = createWriteStream(tmp);
  let head = Buffer.alloc(0), type = null, written = 0, done = false;

  const fail = (code, msg) => {
    if (done) return; done = true;
    req.unpipe?.(out);
    out.destroy();
    rm(tmp, { force: true }, () => {});
    if (!res.headersSent) res.status(code).json({ error: msg });
    req.destroy();
  };

  req.on("data", (chunk) => {
    if (done) return;
    written += chunk.length;
    if (written > LIMITS.video) return fail(413, "file too big");

    // decide what this is from the first 16 bytes, then hold it to that limit
    if (!type) {
      head = Buffer.concat([head, chunk]);
      if (head.length < 16) return;
      type = sniff(head);
      if (!type) return fail(400, "unsupported file type");
      if (written > LIMITS[type.kind]) {
        return fail(413, `That ${type.kind} is too big — ${LIMITS[type.kind] / 1048576}MB max`);
      }
    } else if (written > LIMITS[type.kind]) {
      return fail(413, `That ${type.kind} is too big — ${LIMITS[type.kind] / 1048576}MB max`);
    }
  });

  req.pipe(out);

  req.on("aborted", () => fail(499, "upload cancelled"));
  out.on("error", () => fail(500, "write failed"));

  out.on("finish", () => {
    if (done) return;
    if (!type) { done = true; rm(tmp, { force: true }, () => {}); return res.status(400).json({ error: "empty file" }); }
    done = true;
    const name = `${Date.now()}-${randomBytes(8).toString("hex")}.${type.ext}`;
    rename(tmp, join(UPLOAD_DIR, name), (err) => {
      if (err) return res.status(500).json({ error: "couldn't save" });
      res.json({ url: `/uploads/${name}`, kind: type.kind, bytes: written });
    });
  });
});

app.post("/api/upload", auth, verified, rateLimit({ max: 30, windowMs: 300000, key: "user" }), (req, res) => {
  const { data } = req.body || {};
  if (typeof data !== "string") return res.status(400).json({ error: "no file data" });
  const m = /^data:(image|video|audio)\/[a-z0-9+.-]+;base64,(.+)$/i.exec(data);
  if (!m) return res.status(400).json({ error: "not a base64 image, video or audio file" });

  let buf;
  try { buf = Buffer.from(m[2], "base64"); }
  catch { return res.status(400).json({ error: "bad encoding" }); }

  const type = sniff(buf);
  if (!type) return res.status(400).json({ error: "unsupported file type" });
  if (buf.length > B64_LIMIT) {
    return res.status(413).json({ error: "too big for this route — use the streaming upload" });
  }

  const name = `${Date.now()}-${randomBytes(8).toString("hex")}.${type.ext}`;
  writeFileSync(join(UPLOAD_DIR, name), buf);
  res.json({ url: `/uploads/${name}`, kind: type.kind });
});

/* Profile picture — same validation, images only, kept square-ish by the client. */
app.post("/api/me/avatar", auth, verified, (req, res) => {
  const { data } = req.body || {};
  if (typeof data !== "string") return res.status(400).json({ error: "no image" });
  const m = /^data:image\/[a-z0-9+.-]+;base64,(.+)$/i.exec(data);
  if (!m) return res.status(400).json({ error: "not an image" });
  let buf;
  try { buf = Buffer.from(m[1], "base64"); } catch { return res.status(400).json({ error: "bad encoding" }); }
  const type = sniff(buf);
  if (!type || type.kind !== "image") return res.status(400).json({ error: "unsupported image type" });
  if (buf.length > 4 * 1024 * 1024) return res.status(413).json({ error: "avatar too large (4MB max)" });
  const name = `av-${req.user.id}-${randomBytes(6).toString("hex")}.${type.ext}`;
  writeFileSync(join(UPLOAD_DIR, name), buf);
  db.prepare(`UPDATE users SET avatar_url = ? WHERE id = ?`).run(`/uploads/${name}`, req.user.id);
  res.json({ user: publicUser(q.userById.get(req.user.id)) });
});

/* Edit your own message. Body only — you can't swap the media out from
   under people who already validated it. Marked as edited, like Discord. */
app.patch("/api/posts/:id", auth, (req, res) => {
  const post = q.postById.get(Number(req.params.id));
  if (!post) return res.status(404).json({ error: "no post" });
  if (post.author_id !== req.user.id) return res.status(403).json({ error: "not your post" });
  const body = (req.body?.body ?? "").toString().trim();
  if (!body && !post.image_url && !post.video_url && !post.beat_json) {
    return res.status(400).json({ error: "post can't be empty" });
  }
  db.prepare(`UPDATE posts SET body = ?, edited_at = ? WHERE id = ?`).run(body, Date.now(), post.id);
  const row = feedRows({ authorId: req.user.id, viewerId: req.user.id, limit: 200 }).find((r) => r.id === post.id);
  const shaped = shapePost(row);
  broadcast("post-edit", shaped);
  res.json({ post: shaped });
});

app.delete("/api/posts/:id", auth, (req, res) => {
  const post = q.postById.get(Number(req.params.id));
  if (!post) return res.status(404).json({ error: "no post" });
  if (post.author_id !== req.user.id) return res.status(403).json({ error: "not your post" });
  db.prepare(`DELETE FROM posts WHERE id = ?`).run(post.id);
  broadcast("post-delete", { id: post.id });
  res.json({ ok: true });
});

/* Promote a chat message to portfolio work (or take it back down). */
app.post("/api/posts/:id/work", auth, verified, (req, res) => {
  const post = q.postById.get(Number(req.params.id));
  if (!post) return res.status(404).json({ error: "no post" });
  if (post.author_id !== req.user.id) return res.status(403).json({ error: "not your post" });
  if (!post.image_url && !post.video_url && !post.beat_json) {
    return res.status(400).json({ error: "only work with media can go on your portfolio" });
  }
  const on = !!req.body?.isWork;
  db.prepare(`UPDATE posts SET is_work = ? WHERE id = ?`).run(on ? 1 : 0, post.id);
  res.json({ isWork: on });
});

/* ================================================================
   COMMENTS — where feedback lives. This is the workshop conversation.
================================================================ */
app.get("/api/posts/:id/comments", maybeAuth, (req, res) => {
  const rows = db.prepare(`
    SELECT c.id, c.body, c.created_at, c.edited_at,
           u.username, u.display_name, u.avatar_url, u.role, u.rep
    FROM comments c JOIN users u ON u.id = c.author_id
    WHERE c.post_id = ? ORDER BY c.created_at ASC LIMIT 200`).all(Number(req.params.id));
  const hidden = req.user ? blockedIds(req.user.id) : new Set();
  res.json({
    comments: rows.filter((r) => !hidden.has(r.username)).map((r) => ({
      id: r.id, body: r.body, createdAt: r.created_at, editedAt: r.edited_at,
      author: { username: r.username, displayName: r.display_name, avatarUrl: r.avatar_url || "", role: r.role, level: levelFor(r.rep).id },
    })),
  });
});

app.post("/api/posts/:id/comments", auth, verified, rateLimit({ max: 20, windowMs: 60000, key: "user" }), (req, res) => {
  const post = q.postById.get(Number(req.params.id));
  if (!post) return res.status(404).json({ error: "no post" });
  const body = (req.body?.body || "").toString().trim();
  if (!body) return res.status(400).json({ error: "empty comment" });
  if (body.length > 1000) return res.status(400).json({ error: "comment too long" });
  const info = db.prepare(`INSERT INTO comments (post_id, author_id, body, created_at) VALUES (?,?,?,?)`)
    .run(post.id, req.user.id, body, Date.now());
  notify(post.author_id, req.user.id, "comment", post.id, body.slice(0, 80));
  notifyMentions(body, req.user.id, post.id, "mention");
  broadcast("comment", { postId: post.id });
  res.json({ id: Number(info.lastInsertRowid) });
});

app.patch("/api/comments/:id", auth, (req, res) => {
  const c = db.prepare(`SELECT * FROM comments WHERE id = ?`).get(Number(req.params.id));
  if (!c) return res.status(404).json({ error: "no comment" });
  if (c.author_id !== req.user.id) return res.status(403).json({ error: "not yours" });
  const body = (req.body?.body || "").toString().trim();
  if (!body) return res.status(400).json({ error: "empty" });
  db.prepare(`UPDATE comments SET body = ?, edited_at = ? WHERE id = ?`).run(body, Date.now(), c.id);
  broadcast("comment", { postId: c.post_id });
  res.json({ ok: true });
});

app.delete("/api/comments/:id", auth, (req, res) => {
  const c = db.prepare(`SELECT * FROM comments WHERE id = ?`).get(Number(req.params.id));
  if (!c) return res.status(404).json({ error: "no comment" });
  const post = q.postById.get(c.post_id);
  const allowed = c.author_id === req.user.id || post?.author_id === req.user.id || req.user.is_admin;
  if (!allowed) return res.status(403).json({ error: "not yours" });
  db.prepare(`DELETE FROM comments WHERE id = ?`).run(c.id);
  broadcast("comment", { postId: c.post_id });
  res.json({ ok: true });
});

/* ================================================================
   NOTIFICATIONS
================================================================ */
app.get("/api/notifications", auth, (req, res) => {
  const rows = db.prepare(`
    SELECT n.id, n.kind, n.body, n.post_id, n.read_at, n.created_at,
           u.username, u.display_name, u.avatar_url
    FROM notifications n LEFT JOIN users u ON u.id = n.actor_id
    WHERE n.user_id = ? ORDER BY n.created_at DESC LIMIT 60`).all(req.user.id);
  const unread = db.prepare(`SELECT COUNT(*) n FROM notifications WHERE user_id = ? AND read_at IS NULL`).get(req.user.id).n;
  res.json({
    unread,
    notifications: rows.map((r) => ({
      id: r.id, kind: r.kind, body: r.body, postId: r.post_id, read: !!r.read_at, createdAt: r.created_at,
      actor: r.username ? { username: r.username, displayName: r.display_name, avatarUrl: r.avatar_url || "" } : null,
    })),
  });
});

app.post("/api/notifications/read", auth, (req, res) => {
  db.prepare(`UPDATE notifications SET read_at = ? WHERE user_id = ? AND read_at IS NULL`).run(Date.now(), req.user.id);
  res.json({ ok: true });
});

/* ================================================================
   DIRECT MESSAGES — one on one.
================================================================ */
function threadFor(aId, bId) {
  const [lo, hi] = aId < bId ? [aId, bId] : [bId, aId];
  let t = db.prepare(`SELECT * FROM dm_threads WHERE a_id = ? AND b_id = ?`).get(lo, hi);
  if (!t) {
    const now = Date.now();
    const info = db.prepare(`INSERT INTO dm_threads (a_id, b_id, updated_at, created_at) VALUES (?,?,?,?)`).run(lo, hi, now, now);
    t = db.prepare(`SELECT * FROM dm_threads WHERE id = ?`).get(info.lastInsertRowid);
  }
  return t;
}
function blockedIds(userId) {
  // usernames this person shouldn't see (they blocked, or were blocked by)
  const rows = db.prepare(`
    SELECT u.username FROM blocks b JOIN users u ON u.id = b.blocked_id WHERE b.blocker_id = ?
    UNION
    SELECT u.username FROM blocks b JOIN users u ON u.id = b.blocker_id WHERE b.blocked_id = ?`).all(userId, userId);
  return new Set(rows.map((r) => r.username));
}
function isBlocked(aId, bId) {
  return !!db.prepare(
    `SELECT 1 FROM blocks WHERE (blocker_id = ? AND blocked_id = ?) OR (blocker_id = ? AND blocked_id = ?)`
  ).get(aId, bId, bId, aId);
}

app.get("/api/dm", auth, (req, res) => {
  const rows = db.prepare(`
    SELECT t.id, t.updated_at,
      CASE WHEN t.a_id = ? THEN t.b_id ELSE t.a_id END AS other_id
    FROM dm_threads t WHERE t.a_id = ? OR t.b_id = ?
    ORDER BY t.updated_at DESC LIMIT 50`).all(req.user.id, req.user.id, req.user.id);
  const threads = rows.map((r) => {
    const o = q.userById.get(r.other_id);
    const last = db.prepare(`SELECT body, image_url, created_at, sender_id FROM dm_messages WHERE thread_id = ? ORDER BY created_at DESC LIMIT 1`).get(r.id);
    const unread = db.prepare(`SELECT COUNT(*) n FROM dm_messages WHERE thread_id = ? AND sender_id != ? AND read_at IS NULL`).get(r.id, req.user.id).n;
    return {
      id: r.id, unread,
      other: o ? { username: o.username, displayName: o.display_name, avatarUrl: o.avatar_url || "", role: o.role } : null,
      last: last ? { body: last.image_url && !last.body ? "📷 Photo" : last.body, createdAt: last.created_at, mine: last.sender_id === req.user.id } : null,
    };
  }).filter((t) => t.other);
  const unreadTotal = threads.reduce((n, t) => n + t.unread, 0);
  res.json({ threads, unreadTotal });
});

app.get("/api/dm/:username", auth, (req, res) => {
  const other = q.userByName.get(req.params.username);
  if (!other) return res.status(404).json({ error: "no such user" });
  if (isBlocked(req.user.id, other.id)) return res.status(403).json({ error: "unavailable" });
  const t = threadFor(req.user.id, other.id);
  const msgs = db.prepare(`SELECT * FROM dm_messages WHERE thread_id = ? ORDER BY created_at ASC LIMIT 200`).all(t.id);
  db.prepare(`UPDATE dm_messages SET read_at = ? WHERE thread_id = ? AND sender_id != ? AND read_at IS NULL`)
    .run(Date.now(), t.id, req.user.id);
  res.json({
    thread: t.id,
    other: { username: other.username, displayName: other.display_name, avatarUrl: other.avatar_url || "", role: other.role, rep: other.rep, level: levelFor(other.rep).id },
    messages: msgs.map((m) => ({ id: m.id, body: m.body, imageUrl: m.image_url, mine: m.sender_id === req.user.id, createdAt: m.created_at })),
  });
});

app.post("/api/dm/:username", auth, verified, rateLimit({ max: 30, windowMs: 60000, key: "user" }), (req, res) => {
  const other = q.userByName.get(req.params.username);
  if (!other) return res.status(404).json({ error: "no such user" });
  if (other.id === req.user.id) return res.status(400).json({ error: "can't message yourself" });
  if (isBlocked(req.user.id, other.id)) return res.status(403).json({ error: "unavailable" });
  const body = (req.body?.body || "").toString().trim();
  const imageUrl = req.body?.imageUrl || null;
  if (!body && !imageUrl) return res.status(400).json({ error: "empty message" });
  const t = threadFor(req.user.id, other.id);
  const now = Date.now();
  db.prepare(`INSERT INTO dm_messages (thread_id, sender_id, body, image_url, created_at) VALUES (?,?,?,?,?)`)
    .run(t.id, req.user.id, body.slice(0, 2000), imageUrl, now);
  db.prepare(`UPDATE dm_threads SET updated_at = ? WHERE id = ?`).run(now, t.id);
  notify(other.id, req.user.id, "dm", null, body.slice(0, 80) || "sent a photo");
  broadcast("dm", { to: other.username, from: req.user.username });
  res.json({ ok: true });
});

/* ================================================================
   PASSWORD RESET
================================================================ */
app.post("/api/auth/forgot", rateLimit({ max: 5, windowMs: 900000 }), async (req, res) => {
  const email = (req.body?.email || "").toString().trim();
  const user = db.prepare(`SELECT * FROM users WHERE email = ?`).get(email);
  // Always answer the same way — otherwise this endpoint tells strangers
  // which emails have accounts.
  if (!user) return res.json({ ok: true });
  db.prepare(`DELETE FROM reset_tokens WHERE user_id = ?`).run(user.id);
  const token = randomBytes(24).toString("hex");
  db.prepare(`INSERT INTO reset_tokens (token, user_id, expires_at, created_at) VALUES (?,?,?,?)`)
    .run(token, user.id, Date.now() + 3600000, Date.now());
  const url = `${baseUrl(req)}/reset?token=${token}`;
  const mail = await sendResetEmail(user.email, user.display_name, url);
  res.json({ ok: true, mailSent: mail.sent, resetUrl: mail.sent ? undefined : url });
});

app.get("/reset", (req, res) => {
  const token = String(req.query.token || "");
  res.send(`<!doctype html><meta name="viewport" content="width=device-width,initial-scale=1">
<body style="margin:0;background:#000;color:#fff;font-family:Helvetica,Arial,sans-serif;display:flex;align-items:center;justify-content:center;height:100vh">
<div style="max-width:340px;padding:24px;width:100%">
  <div style="color:#22C55E;font-family:monospace;font-size:11px;letter-spacing:.16em">TNLLABS &#129514;</div>
  <h1 style="font-size:24px;margin:14px 0 8px;text-transform:uppercase">New password</h1>
  <input id="p" type="password" placeholder="at least 6 characters" style="width:100%;box-sizing:border-box;background:#141414;border:1px solid rgba(255,255,255,.12);border-radius:9px;color:#fff;padding:12px;font-size:14px;margin:12px 0">
  <div id="m" style="color:#F87171;font-size:12px;min-height:18px"></div>
  <button id="go" style="width:100%;background:#fff;color:#000;border:none;border-radius:9px;padding:13px;font-weight:700;font-size:14px">Set password</button>
</div>
<script>
document.getElementById("go").onclick=async()=>{
  const p=document.getElementById("p").value,m=document.getElementById("m");
  if(p.length<6){m.textContent="At least 6 characters.";return}
  const r=await fetch("/api/auth/reset",{method:"POST",headers:{"Content-Type":"application/json"},
    body:JSON.stringify({token:${JSON.stringify(token)},password:p})});
  const d=await r.json();
  if(!r.ok){m.textContent=d.error||"That didn't work.";return}
  m.style.color="#22C55E";m.textContent="Password updated. Redirecting…";
  setTimeout(()=>location.href="/",1200);
};
</script></body>`);
});

app.post("/api/auth/reset", rateLimit({ max: 10, windowMs: 900000 }), async (req, res) => {
  const { token, password } = req.body || {};
  const row = db.prepare(`SELECT * FROM reset_tokens WHERE token = ?`).get(String(token || ""));
  if (!row) return res.status(400).json({ error: "invalid or used link" });
  if (row.expires_at < Date.now()) return res.status(400).json({ error: "link expired — request a new one" });
  if (!password || password.length < 6) return res.status(400).json({ error: "password too short" });
  const hash = await bcrypt.hash(password, 10);
  db.prepare(`UPDATE users SET password_hash = ? WHERE id = ?`).run(hash, row.user_id);
  db.prepare(`DELETE FROM reset_tokens WHERE user_id = ?`).run(row.user_id);
  // a reset should boot every existing session
  db.prepare(`DELETE FROM sessions WHERE user_id = ?`).run(row.user_id);
  res.json({ ok: true });
});

/* ================================================================
   SEARCH — people first, since the point is finding collaborators.
================================================================ */
app.get("/api/search", maybeAuth, (req, res) => {
  const term = (req.query.q || "").toString().trim().slice(0, 40);
  const role = (req.query.role || "").toString().trim();
  if (!term && !role) return res.json({ people: [], posts: [] });
  const hidden = req.user ? blockedIds(req.user.id) : new Set();
  const like = `%${term}%`;
  const people = db.prepare(`
    SELECT username, display_name, avatar_url, role, roles, rep, bio FROM users
    WHERE (? = '' OR display_name LIKE ? OR username LIKE ? OR bio LIKE ?)
      AND (? = '' OR roles LIKE ? OR role = ?)
    ORDER BY rep DESC LIMIT 24`).all(term, like, like, like, role, `%"${role}"%`, role);
  const posts = term ? db.prepare(`
    SELECT p.*, u.username AS author_username, u.display_name AS author_name, u.role AS author_role,
           u.avatar_url AS author_avatar, u.rep AS author_rep,
      (SELECT COUNT(*) FROM likes l WHERE l.post_id = p.id) AS like_count,
      (SELECT COUNT(*) FROM posts s WHERE s.shared_from = p.id) AS share_count,
      0 AS liked_by_me
    FROM posts p JOIN users u ON u.id = p.author_id
    WHERE p.is_work = 1 AND p.body LIKE ? ORDER BY p.created_at DESC LIMIT 20`).all(like) : [];
  res.json({
    people: people.filter((p) => !hidden.has(p.username)).map((p) => ({
      username: p.username, displayName: p.display_name, avatarUrl: p.avatar_url || "",
      role: p.role, roles: (() => { try { return JSON.parse(p.roles || "[]"); } catch { return [p.role]; } })(),
      rep: p.rep, level: levelFor(p.rep).id, bio: p.bio,
    })),
    posts: shapePosts(posts.filter((p) => !hidden.has(p.author_username))),
  });
});

/* ================================================================
   MODERATION — block, report, admin removal.
================================================================ */
app.post("/api/users/:username/block", auth, (req, res) => {
  const target = q.userByName.get(req.params.username);
  if (!target) return res.status(404).json({ error: "no such user" });
  if (target.id === req.user.id) return res.status(400).json({ error: "can't block yourself" });
  const existing = db.prepare(`SELECT 1 FROM blocks WHERE blocker_id = ? AND blocked_id = ?`).get(req.user.id, target.id);
  if (existing) {
    db.prepare(`DELETE FROM blocks WHERE blocker_id = ? AND blocked_id = ?`).run(req.user.id, target.id);
    return res.json({ blocked: false });
  }
  db.prepare(`INSERT INTO blocks (blocker_id, blocked_id, created_at) VALUES (?,?,?)`).run(req.user.id, target.id, Date.now());
  // blocking also severs the follow graph both ways
  db.prepare(`DELETE FROM follows WHERE (follower_id = ? AND followee_id = ?) OR (follower_id = ? AND followee_id = ?)`)
    .run(req.user.id, target.id, target.id, req.user.id);
  res.json({ blocked: true });
});

app.post("/api/report", auth, rateLimit({ max: 10, windowMs: 3600000, key: "user" }), (req, res) => {
  const { postId, username, reason } = req.body || {};
  const target = username ? q.userByName.get(username) : null;
  db.prepare(`INSERT INTO reports (reporter_id, post_id, user_id, reason, created_at) VALUES (?,?,?,?,?)`)
    .run(req.user.id, postId || null, target?.id || null, (reason || "").toString().slice(0, 300), Date.now());
  res.json({ ok: true });
});

function admin(req, res, next) {
  if (!req.user.is_admin) return res.status(403).json({ error: "admins only" });
  next();
}

/* ================================================================
   ADMIN DASHBOARD
   The numbers here measure THIS model, not a generic app. Follower count
   never tells you whether the flywheel is turning — confirmed collabs do.
   Every query sits behind admin(), enforced server-side. Hiding a button
   in the UI is not access control.
================================================================ */
const DAY = 86400000;

app.get("/api/admin/overview", auth, admin, (req, res) => {
  const now = Date.now();
  const since = (d) => now - d * DAY;
  const one = (sql, ...p) => db.prepare(sql).get(...p)?.n ?? 0;

  const feeRows = db.prepare(`
    SELECT o.amount_cents, u.rep FROM orders o JOIN users u ON u.id = o.seller_id
    WHERE o.status IN ('paid','shipped','complete')`).all();
  const earned = feeRows.reduce((s, r) => s + Math.round(r.amount_cents * (feeForRep(r.rep) / 100)), 0);

  const levels = LEVELS.map((l, i) => ({
    level: l.id, name: l.name,
    n: i < LEVELS.length - 1
      ? one(`SELECT COUNT(*) n FROM users WHERE rep >= ? AND rep < ?`, l.at, LEVELS[i + 1].at)
      : one(`SELECT COUNT(*) n FROM users WHERE rep >= ?`, l.at),
  }));

  const daily = [];
  for (let i = 13; i >= 0; i--) {
    const from = now - (i + 1) * DAY, to = now - i * DAY;
    daily.push({
      d: new Date(to).toISOString().slice(5, 10),
      posts: one(`SELECT COUNT(*) n FROM posts WHERE created_at > ? AND created_at <= ?`, from, to),
      joins: one(`SELECT COUNT(*) n FROM users WHERE created_at > ? AND created_at <= ?`, from, to),
    });
  }

  res.json({
    members: one(`SELECT COUNT(*) n FROM users`),
    verified: one(`SELECT COUNT(*) n FROM users WHERE email_verified = 1`),
    newWeek: one(`SELECT COUNT(*) n FROM users WHERE created_at > ?`, since(7)),
    active: one(`SELECT COUNT(DISTINCT author_id) n FROM posts WHERE created_at > ?`, since(7)),
    activeMonth: one(`SELECT COUNT(DISTINCT author_id) n FROM posts WHERE created_at > ?`, since(30)),
    posts: one(`SELECT COUNT(*) n FROM posts`),
    work: one(`SELECT COUNT(*) n FROM posts WHERE is_work = 1`),
    workWeek: one(`SELECT COUNT(*) n FROM posts WHERE is_work = 1 AND created_at > ?`, since(7)),
    // the flywheel metric — if this is zero, nothing else matters
    collabs: one(`SELECT COUNT(*) n FROM collaborators WHERE status = 'accepted'`),
    collabsWeek: one(`SELECT COUNT(*) n FROM collaborators WHERE status = 'accepted' AND created_at > ?`, since(7)),
    pendingCollabs: one(`SELECT COUNT(*) n FROM collaborators WHERE status = 'pending'`),
    shares: one(`SELECT COUNT(*) n FROM posts WHERE shared_from IS NOT NULL`),
    crossLab: one(`SELECT COUNT(*) n FROM posts s JOIN posts o ON o.id = s.shared_from WHERE s.channel != o.channel`),
    listings: one(`SELECT COUNT(*) n FROM listings WHERE status = 'active'`),
    sold: one(`SELECT COUNT(*) n FROM orders WHERE status IN ('paid','shipped','complete')`),
    gmv: db.prepare(`SELECT COALESCE(SUM(amount_cents + shipping_cents),0) n FROM orders WHERE status IN ('paid','shipped','complete')`).get().n,
    earned,
    openReports: one(`SELECT COUNT(*) n FROM reports WHERE handled_at IS NULL`),
    dms: one(`SELECT COUNT(*) n FROM dm_messages`),
    beats: one(`SELECT COUNT(*) n FROM beat_projects`),
    levels, daily,
    paymentsOn: PAYMENTS_ENABLED,
    mailOn: MAIL_ENABLED,
  });
});

app.get("/api/admin/members", auth, admin, (req, res) => {
  const term = (req.query.q || "").toString().toLowerCase();
  const where = term ? `WHERE LOWER(u.username) LIKE ? OR LOWER(u.display_name) LIKE ? OR LOWER(u.email) LIKE ?` : "";
  const rows = db.prepare(`
    SELECT u.id, u.username, u.display_name, u.email, u.avatar_url, u.role, u.roles, u.rep,
           u.email_verified, u.published, u.is_admin, u.stripe_ready, u.created_at,
      (SELECT COUNT(*) FROM posts p WHERE p.author_id = u.id) AS posts,
      (SELECT COUNT(*) FROM posts p WHERE p.author_id = u.id AND p.is_work = 1) AS work,
      (SELECT COUNT(*) FROM collaborators c WHERE c.user_id = u.id AND c.status='accepted') AS collabs,
      (SELECT COUNT(*) FROM likes l JOIN posts p ON p.id = l.post_id WHERE p.author_id = u.id) AS likes,
      (SELECT MAX(created_at) FROM posts p WHERE p.author_id = u.id) AS last_post
    FROM users u ${where}
    ORDER BY u.rep DESC, u.created_at DESC LIMIT 200`)
    .all(...(term ? [`%${term}%`, `%${term}%`, `%${term}%`] : []));
  res.json({
    members: rows.map((r) => ({
      id: r.id, username: r.username, displayName: r.display_name, email: r.email,
      avatarUrl: r.avatar_url || "", role: r.role,
      roles: (() => { try { return JSON.parse(r.roles || "[]"); } catch { return []; } })(),
      rep: r.rep, level: levelFor(r.rep).id, levelName: levelFor(r.rep).name, fee: feeForRep(r.rep),
      verified: !!r.email_verified, published: !!r.published, isAdmin: !!r.is_admin, payouts: !!r.stripe_ready,
      posts: r.posts, work: r.work, collabs: r.collabs, likes: r.likes,
      lastPost: r.last_post, joined: r.created_at,
    })),
  });
});

/* Manual rep — the "feature" award from the model, auditable like the rest. */
app.post("/api/admin/members/:username/feature", auth, admin, (req, res) => {
  const u = q.userByName.get(req.params.username);
  if (!u) return res.status(404).json({ error: "no such user" });
  awardRep(u.id, "feature", null);
  notify(u.id, req.user.id, "feature", null, "featured your work");
  res.json({ ok: true, rep: q.userById.get(u.id).rep });
});

app.post("/api/admin/members/:username/verify", auth, admin, (req, res) => {
  const u = q.userByName.get(req.params.username);
  if (!u) return res.status(404).json({ error: "no such user" });
  db.prepare(`UPDATE users SET email_verified = 1 WHERE id = ?`).run(u.id);
  res.json({ ok: true });
});

app.get("/api/admin/content", auth, admin, (req, res) => {
  const rows = db.prepare(`
    SELECT p.id, p.channel, p.body, p.image_url, p.thumb_url, p.video_url, p.beat_json, p.is_work, p.created_at,
           u.username, u.display_name, u.avatar_url,
      (SELECT COUNT(*) FROM likes l WHERE l.post_id = p.id) AS likes,
      (SELECT COUNT(*) FROM comments c WHERE c.post_id = p.id) AS comments,
      (SELECT COUNT(*) FROM collaborators c WHERE c.post_id = p.id AND c.status='accepted') AS collabs
    FROM posts p JOIN users u ON u.id = p.author_id
    ORDER BY p.created_at DESC LIMIT 60`).all();
  res.json({
    posts: rows.map((r) => ({
      id: r.id, channel: r.channel, body: r.body,
      thumbUrl: r.thumb_url || r.image_url, videoUrl: r.video_url, isBeat: !!r.beat_json,
      isWork: !!r.is_work, createdAt: r.created_at,
      author: { username: r.username, displayName: r.display_name, avatarUrl: r.avatar_url || "" },
      likes: r.likes, comments: r.comments, collabs: r.collabs,
    })),
  });
});

app.get("/api/admin/orders", auth, admin, (req, res) => {
  const rows = db.prepare(`
    SELECT o.*, l.title, b.username AS buyer, s.username AS seller, s.rep AS seller_rep
    FROM orders o
    JOIN listings l ON l.id = o.listing_id
    JOIN users b ON b.id = o.buyer_id
    JOIN users s ON s.id = o.seller_id
    ORDER BY o.created_at DESC LIMIT 80`).all();
  res.json({
    orders: rows.map((r) => ({
      id: r.id, title: r.title, buyer: r.buyer, seller: r.seller,
      amount: r.amount_cents, shipping: r.shipping_cents,
      fee: Math.round(r.amount_cents * (feeForRep(r.seller_rep) / 100)),
      feePct: feeForRep(r.seller_rep),
      status: r.status, tracking: r.tracking, paid: !!r.payment_ref, createdAt: r.created_at,
    })),
  });
});

app.get("/api/admin/reports", auth, admin, (req, res) => {
  const rows = db.prepare(`
    SELECT r.*, ru.username AS reporter, tu.username AS reported,
           p.body AS post_body, p.channel AS post_channel, p.image_url AS post_img
    FROM reports r
    LEFT JOIN users ru ON ru.id = r.reporter_id
    LEFT JOIN users tu ON tu.id = r.user_id
    LEFT JOIN posts p ON p.id = r.post_id
    WHERE r.handled_at IS NULL ORDER BY r.created_at DESC LIMIT 50`).all();
  res.json({ reports: rows });
});

app.post("/api/admin/reports/:id/handle", auth, admin, (req, res) => {
  db.prepare(`UPDATE reports SET handled_at = ? WHERE id = ?`).run(Date.now(), Number(req.params.id));
  res.json({ ok: true });
});

app.delete("/api/admin/posts/:id", auth, admin, (req, res) => {
  db.prepare(`DELETE FROM posts WHERE id = ?`).run(Number(req.params.id));
  broadcast("post-delete", { id: Number(req.params.id) });
  res.json({ ok: true });
});

/* The dashboard page. Gated in the browser too, but the real gate is every
   endpoint above — the page is inert without a valid admin token. */
app.get("/admin", (_req, res) => res.sendFile(join(__dirname, "..", "public", "admin.html")));

/* ================================================================
   MARKET — peer-to-peer listings. Anyone verified can sell.
================================================================ */
const CATEGORIES = ["Tops", "Bottoms", "Outerwear", "Footwear", "Accessories", "Headwear", "Bags", "Jewellery", "Art / Prints", "Other"];
const CONDITIONS = ["Deadstock", "Like New", "Good", "Worn", "Distressed"];

/* Same N+1 problem the feed had: two queries per listing. Batched. */
function listingSidecar(rows, viewerId) {
  const ids = rows.map((r) => r.id);
  const counts = new Map(), mine = new Set();
  if (!ids.length) return { counts, mine };
  const holes = ids.map(() => "?").join(",");
  for (const r of db.prepare(
    `SELECT listing_id, COUNT(*) n FROM listing_likes WHERE listing_id IN (${holes}) GROUP BY listing_id`
  ).all(...ids)) counts.set(r.listing_id, r.n);
  if (viewerId) {
    for (const r of db.prepare(
      `SELECT listing_id FROM listing_likes WHERE user_id = ? AND listing_id IN (${holes})`
    ).all(viewerId, ...ids)) mine.add(r.listing_id);
  }
  return { counts, mine };
}
function shapeListings(rows, viewerId) {
  const side = listingSidecar(rows, viewerId);
  return rows.map((r) => shapeListing(r, viewerId, side));
}

function shapeListing(r, viewerId, side) {
  let images = [];
  try { images = JSON.parse(r.images || "[]"); } catch {}
  return {
    id: r.id,
    title: r.title,
    description: r.description,
    price: r.price_cents,
    shipping: r.shipping_cents,
    currency: r.currency,
    category: r.category,
    brand: r.brand,
    size: r.size,
    condition: r.condition,
    colour: r.colour,
    images,
    shipsFrom: r.ships_from,
    acceptsOffers: !!r.accepts_offers,
    status: r.status,
    views: r.views,
    createdAt: r.created_at,
    likeCount: side ? (side.counts.get(r.id) || 0)
      : db.prepare(`SELECT COUNT(*) n FROM listing_likes WHERE listing_id = ?`).get(r.id).n,
    likedByMe: side ? side.mine.has(r.id)
      : (viewerId ? !!db.prepare(`SELECT 1 FROM listing_likes WHERE listing_id = ? AND user_id = ?`).get(r.id, viewerId) : false),
    seller: {
      username: r.seller_username,
      displayName: r.seller_name,
      avatarUrl: r.seller_avatar || "",
      rep: r.seller_rep,
      level: levelFor(r.seller_rep || 0).id,
    },
  };
}

const LISTING_SELECT = `
  SELECT l.*, u.username AS seller_username, u.display_name AS seller_name,
         u.avatar_url AS seller_avatar, u.rep AS seller_rep
  FROM listings l JOIN users u ON u.id = l.seller_id`;

app.get("/api/market/meta", maybeAuth, (req, res) => {
  res.json({
    categories: CATEGORIES, conditions: CONDITIONS, paymentsEnabled: PAYMENTS_ENABLED,
    feePct: req.user ? feeForRep(req.user.rep) : FEE_BY_LEVEL[1],
    feeLadder: LEVELS.map((l) => ({ level: l.id, name: l.name, at: l.at, fee: FEE_BY_LEVEL[l.id] })),
  });
});

/* ---- seller payouts (Stripe Standard Connect) ----
   The seller owns the Stripe account; we never hold their money. */
app.post("/api/market/connect", auth, verified, async (req, res) => {
  if (!PAYMENTS_ENABLED) return res.status(400).json({ error: "payments aren't switched on yet" });
  let acct = req.user.stripe_account;
  if (!acct) {
    const made = await createSellerAccount(req.user.email);
    if (made.error) return res.status(502).json({ error: made.error });
    acct = made.id;
    db.prepare(`UPDATE users SET stripe_account = ? WHERE id = ?`).run(acct, req.user.id);
  }
  const base = baseUrl(req);
  const link = await onboardingLink(acct, `${base}/?connect=refresh`, `${base}/api/market/connect/done`);
  if (link.error) return res.status(502).json({ error: link.error });
  res.json({ url: link.url });
});

app.get("/api/market/connect/done", auth, async (req, res) => {
  // Stripe sends them back here; confirm with the API rather than assuming.
  if (req.user.stripe_account) {
    const st = await accountStatus(req.user.stripe_account);
    db.prepare(`UPDATE users SET stripe_ready = ? WHERE id = ?`).run(st.ready ? 1 : 0, req.user.id);
  }
  res.redirect("/?connect=done");
});

app.get("/api/market/connect/status", auth, async (req, res) => {
  if (!req.user.stripe_account) return res.json({ connected: false, ready: false });
  const st = await accountStatus(req.user.stripe_account);
  db.prepare(`UPDATE users SET stripe_ready = ? WHERE id = ?`).run(st.ready ? 1 : 0, req.user.id);
  res.json({ connected: true, ...st });
});

app.get("/api/market/connect/dashboard", auth, async (req, res) => {
  if (!req.user.stripe_account) return res.status(400).json({ error: "not connected" });
  const l = await loginLink(req.user.stripe_account);
  if (l.error) return res.status(502).json({ error: l.error });
  res.json({ url: l.url });
});

app.get("/api/market", maybeAuth, (req, res) => {
  const { category, size, condition, brand, q: term, sort, seller, max, min } = req.query;
  const where = [`l.status = 'active'`];
  const params = [];
  if (category) { where.push(`l.category = ?`); params.push(category); }
  if (size) { where.push(`l.size = ?`); params.push(size); }
  if (condition) { where.push(`l.condition = ?`); params.push(condition); }
  if (brand) { where.push(`l.brand LIKE ?`); params.push(`%${brand}%`); }
  if (seller) { where.push(`u.username = ?`); params.push(seller); }
  if (min) { where.push(`l.price_cents >= ?`); params.push(Math.round(Number(min) * 100)); }
  if (max) { where.push(`l.price_cents <= ?`); params.push(Math.round(Number(max) * 100)); }
  if (term) { where.push(`(l.title LIKE ? OR l.description LIKE ? OR l.brand LIKE ?)`); const t = `%${term}%`; params.push(t, t, t); }
  const order = sort === "low" ? `l.price_cents ASC` : sort === "high" ? `l.price_cents DESC`
    : sort === "liked" ? `(SELECT COUNT(*) FROM listing_likes ll WHERE ll.listing_id = l.id) DESC` : `l.created_at DESC`;
  const rows = db.prepare(`${LISTING_SELECT} WHERE ${where.join(" AND ")} ORDER BY ${order} LIMIT 60`).all(...params);
  const hidden = req.user ? blockedIds(req.user.id) : new Set();
  res.json({ listings: shapeListings(rows.filter((r) => !hidden.has(r.seller_username)), req.user?.id) });
});

app.get("/api/market/:id", maybeAuth, (req, res) => {
  const r = db.prepare(`${LISTING_SELECT} WHERE l.id = ?`).get(Number(req.params.id));
  if (!r) return res.status(404).json({ error: "no listing" });
  if (!req.user || req.user.id !== r.seller_id) db.prepare(`UPDATE listings SET views = views + 1 WHERE id = ?`).run(r.id);
  const offers = req.user && (req.user.id === r.seller_id)
    ? db.prepare(`SELECT o.*, u.username, u.display_name FROM offers o JOIN users u ON u.id = o.buyer_id
                  WHERE o.listing_id = ? AND o.status = 'pending' ORDER BY o.amount_cents DESC`).all(r.id)
    : req.user
      ? db.prepare(`SELECT * FROM offers WHERE listing_id = ? AND buyer_id = ? ORDER BY created_at DESC LIMIT 5`).all(r.id, req.user.id)
      : [];
  res.json({ listing: shapeListing(r, req.user?.id), offers });
});

app.post("/api/market", auth, verified, rateLimit({ max: 15, windowMs: 3600000, key: "user" }), (req, res) => {
  const { title, description, price, shipping, category, brand, size, condition, colour, images, shipsFrom, acceptsOffers } = req.body || {};
  if (!title?.trim()) return res.status(400).json({ error: "title required" });
  const cents = Math.round(Number(price) * 100);
  if (!Number.isFinite(cents) || cents < 100) return res.status(400).json({ error: "price must be at least 1.00" });
  if (cents > 5000000) return res.status(400).json({ error: "price too high" });
  const imgs = Array.isArray(images) ? images.filter((i) => typeof i === "string").slice(0, 8) : [];
  if (!imgs.length) return res.status(400).json({ error: "add at least one photo" });
  const shipCents = Math.max(0, Math.round(Number(shipping || 0) * 100));
  const now = Date.now();
  const info = db.prepare(`
    INSERT INTO listings (seller_id, title, description, price_cents, shipping_cents, category, brand, size, condition, colour, images, ships_from, accepts_offers, created_at, updated_at)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`).run(
    req.user.id, title.trim().slice(0, 120), (description || "").slice(0, 2000), cents, shipCents,
    CATEGORIES.includes(category) ? category : "Other", (brand || "").slice(0, 60), (size || "").slice(0, 20),
    CONDITIONS.includes(condition) ? condition : "Good", (colour || "").slice(0, 30),
    JSON.stringify(imgs), (shipsFrom || "").slice(0, 60), acceptsOffers === false ? 0 : 1, now, now);
  res.json({ id: Number(info.lastInsertRowid) });
});

app.patch("/api/market/:id", auth, (req, res) => {
  const l = db.prepare(`SELECT * FROM listings WHERE id = ?`).get(Number(req.params.id));
  if (!l) return res.status(404).json({ error: "no listing" });
  if (l.seller_id !== req.user.id) return res.status(403).json({ error: "not yours" });
  const { title, description, price, status, shipping } = req.body || {};
  const next = {
    title: (title ?? l.title).toString().slice(0, 120),
    description: (description ?? l.description).toString().slice(0, 2000),
    price_cents: price !== undefined ? Math.round(Number(price) * 100) : l.price_cents,
    shipping_cents: shipping !== undefined ? Math.max(0, Math.round(Number(shipping) * 100)) : l.shipping_cents,
    status: ["active", "sold", "removed"].includes(status) ? status : l.status,
  };
  if (next.price_cents < 100) return res.status(400).json({ error: "price too low" });
  db.prepare(`UPDATE listings SET title=?, description=?, price_cents=?, shipping_cents=?, status=?, updated_at=? WHERE id=?`)
    .run(next.title, next.description, next.price_cents, next.shipping_cents, next.status, Date.now(), l.id);
  res.json({ ok: true });
});

app.delete("/api/market/:id", auth, (req, res) => {
  const l = db.prepare(`SELECT * FROM listings WHERE id = ?`).get(Number(req.params.id));
  if (!l) return res.status(404).json({ error: "no listing" });
  if (l.seller_id !== req.user.id && !req.user.is_admin) return res.status(403).json({ error: "not yours" });
  db.prepare(`UPDATE listings SET status = 'removed', updated_at = ? WHERE id = ?`).run(Date.now(), l.id);
  res.json({ ok: true });
});

app.post("/api/market/:id/like", auth, (req, res) => {
  const l = db.prepare(`SELECT * FROM listings WHERE id = ?`).get(Number(req.params.id));
  if (!l) return res.status(404).json({ error: "no listing" });
  const has = db.prepare(`SELECT 1 FROM listing_likes WHERE listing_id = ? AND user_id = ?`).get(l.id, req.user.id);
  if (has) { db.prepare(`DELETE FROM listing_likes WHERE listing_id = ? AND user_id = ?`).run(l.id, req.user.id); return res.json({ liked: false }); }
  db.prepare(`INSERT INTO listing_likes (listing_id, user_id, created_at) VALUES (?,?,?)`).run(l.id, req.user.id, Date.now());
  notify(l.seller_id, req.user.id, "listing_like", null, `liked "${l.title}"`);
  res.json({ liked: true });
});

/* ---- offers ---- */
app.post("/api/market/:id/offer", auth, verified, rateLimit({ max: 20, windowMs: 3600000, key: "user" }), (req, res) => {
  const l = db.prepare(`SELECT * FROM listings WHERE id = ?`).get(Number(req.params.id));
  if (!l) return res.status(404).json({ error: "no listing" });
  if (l.status !== "active") return res.status(400).json({ error: "listing isn't available" });
  if (l.seller_id === req.user.id) return res.status(400).json({ error: "can't offer on your own listing" });
  if (!l.accepts_offers) return res.status(400).json({ error: "seller isn't taking offers" });
  const cents = Math.round(Number(req.body?.amount) * 100);
  if (!Number.isFinite(cents) || cents < 100) return res.status(400).json({ error: "offer too low" });
  if (cents > l.price_cents) return res.status(400).json({ error: "offer is above asking price — just buy it" });
  db.prepare(`UPDATE offers SET status='withdrawn' WHERE listing_id=? AND buyer_id=? AND status='pending'`).run(l.id, req.user.id);
  db.prepare(`INSERT INTO offers (listing_id, buyer_id, amount_cents, created_at) VALUES (?,?,?,?)`)
    .run(l.id, req.user.id, cents, Date.now());
  notify(l.seller_id, req.user.id, "offer", null, `offered $${(cents / 100).toFixed(2)} on "${l.title}"`);
  res.json({ ok: true });
});

app.post("/api/offers/:id/:action", auth, (req, res) => {
  const o = db.prepare(`SELECT * FROM offers WHERE id = ?`).get(Number(req.params.id));
  if (!o) return res.status(404).json({ error: "no offer" });
  const l = db.prepare(`SELECT * FROM listings WHERE id = ?`).get(o.listing_id);
  const action = req.params.action;
  if (action === "withdraw") {
    if (o.buyer_id !== req.user.id) return res.status(403).json({ error: "not yours" });
    db.prepare(`UPDATE offers SET status='withdrawn' WHERE id=?`).run(o.id);
    return res.json({ ok: true });
  }
  if (l.seller_id !== req.user.id) return res.status(403).json({ error: "not your listing" });
  if (action === "decline") {
    db.prepare(`UPDATE offers SET status='declined' WHERE id=?`).run(o.id);
    notify(o.buyer_id, req.user.id, "offer_declined", null, `declined your offer on "${l.title}"`);
    return res.json({ ok: true });
  }
  if (action === "accept") {
    db.prepare(`UPDATE offers SET status='accepted' WHERE id=?`).run(o.id);
    db.prepare(`UPDATE offers SET status='declined' WHERE listing_id=? AND id!=? AND status='pending'`).run(l.id, o.id);
    notify(o.buyer_id, req.user.id, "offer_accepted", null, `accepted your offer on "${l.title}" — go buy it`);
    return res.json({ ok: true });
  }
  res.status(400).json({ error: "unknown action" });
});

/* ---- buying ---- */
app.post("/api/market/:id/buy", auth, verified, async (req, res) => {
  const l = db.prepare(`SELECT * FROM listings WHERE id = ?`).get(Number(req.params.id));
  if (!l) return res.status(404).json({ error: "no listing" });
  if (l.status !== "active") return res.status(400).json({ error: "already sold" });
  if (l.seller_id === req.user.id) return res.status(400).json({ error: "can't buy your own listing" });
  const { name, address } = req.body || {};
  if (!name?.trim() || !address?.trim()) return res.status(400).json({ error: "shipping name and address required" });

  // an accepted offer beats the sticker price
  const accepted = db.prepare(`SELECT * FROM offers WHERE listing_id=? AND buyer_id=? AND status='accepted' ORDER BY created_at DESC LIMIT 1`)
    .get(l.id, req.user.id);
  const amount = accepted ? accepted.amount_cents : l.price_cents;

  const now = Date.now();
  const info = db.prepare(`
    INSERT INTO orders (listing_id, buyer_id, seller_id, amount_cents, shipping_cents, ship_name, ship_address, created_at, updated_at)
    VALUES (?,?,?,?,?,?,?,?,?)`).run(l.id, req.user.id, l.seller_id, amount, l.shipping_cents,
    name.trim().slice(0, 80), address.trim().slice(0, 300), now, now);
  const orderId = Number(info.lastInsertRowid);

  if (PAYMENTS_ENABLED) {
    const seller = q.userById.get(l.seller_id);
    if (!seller?.stripe_account || !seller.stripe_ready) {
      // Don't take money we can't route. Fall back to arranging directly.
      db.prepare(`UPDATE listings SET status='sold', updated_at=? WHERE id=?`).run(now, l.id);
      notify(l.seller_id, req.user.id, "sale", null, `bought "${l.title}" — you haven't set up payouts, so arrange payment directly`);
      return res.json({ orderId, arrange: true, sellerNotConnected: true });
    }
    const base = baseUrl(req);
    const out = await createCheckout({
      orderId, title: l.title, amountCents: amount, shippingCents: l.shipping_cents,
      currency: (l.currency || "usd").toLowerCase(),
      successUrl: `${base}/api/market/checkout/done?session_id={CHECKOUT_SESSION_ID}&o=${orderId}`,
      cancelUrl: `${base}/?checkout=cancelled`,
      buyerEmail: req.user.email,
      sellerAccount: seller.stripe_account,
      feePct: feeForRep(seller.rep),   // their level sets their rate
    });
    if (out.error) return res.status(502).json({ error: out.error });
    db.prepare(`UPDATE orders SET payment_ref = ? WHERE id = ?`).run(out.id, orderId);
    return res.json({ orderId, checkoutUrl: out.url });
  }

  // No payment provider configured: reserve the item and let them settle up.
  // NOTE: no rep is awarded here, deliberately. Nothing verifiable happened —
  // two friends could "buy" from each other all day for free. Rep needs
  // evidence, and in arrange mode there is none. Once Stripe is on, a sale
  // costs real money to fake, so it earns rep.
  db.prepare(`UPDATE listings SET status='sold', updated_at=? WHERE id=?`).run(now, l.id);
  notify(l.seller_id, req.user.id, "sale", null, `bought "${l.title}" — arrange payment & shipping`);
  res.json({ orderId, arrange: true });
});

app.get("/api/market/checkout/done", async (req, res) => {
  const sid = String(req.query.session_id || "");
  const order = db.prepare(`SELECT * FROM orders WHERE id = ?`).get(Number(req.query.o || 0));
  if (!order) return res.redirect("/?checkout=failed");
  const seller = q.userById.get(order.seller_id);
  const out = await verifySession(sid, seller?.stripe_account);
  if (!out.paid) return res.redirect("/?checkout=failed");
  if (order.status === "pending") {
    db.prepare(`UPDATE orders SET status='paid', updated_at=? WHERE id=?`).run(Date.now(), order.id);
    db.prepare(`UPDATE listings SET status='sold', updated_at=? WHERE id=?`).run(Date.now(), order.listing_id);
    const l = db.prepare(`SELECT title FROM listings WHERE id=?`).get(order.listing_id);
    // A sale is validation with money behind it — the hardest signal to fake.
    awardRep(order.seller_id, "sale_made", order.id);
    notify(order.seller_id, order.buyer_id, "sale", null, `paid for "${l?.title || "your listing"}" — ship it`);
  }
  res.redirect("/?checkout=paid");
});

app.get("/api/orders", auth, (req, res) => {
  const shape = (r) => ({
    id: r.id, amount: r.amount_cents, shipping: r.shipping_cents, status: r.status,
    tracking: r.tracking, shipName: r.ship_name, shipAddress: r.ship_address, createdAt: r.created_at,
    listing: { id: r.listing_id, title: r.title, images: (() => { try { return JSON.parse(r.images || "[]"); } catch { return []; } })() },
    other: { username: r.other_username, displayName: r.other_name, avatarUrl: r.other_avatar || "" },
  });
  const buying = db.prepare(`
    SELECT o.*, l.title, l.images, u.username AS other_username, u.display_name AS other_name, u.avatar_url AS other_avatar
    FROM orders o JOIN listings l ON l.id = o.listing_id JOIN users u ON u.id = o.seller_id
    WHERE o.buyer_id = ? ORDER BY o.created_at DESC LIMIT 40`).all(req.user.id);
  const selling = db.prepare(`
    SELECT o.*, l.title, l.images, u.username AS other_username, u.display_name AS other_name, u.avatar_url AS other_avatar
    FROM orders o JOIN listings l ON l.id = o.listing_id JOIN users u ON u.id = o.buyer_id
    WHERE o.seller_id = ? ORDER BY o.created_at DESC LIMIT 40`).all(req.user.id);
  res.json({ buying: buying.map(shape), selling: selling.map(shape) });
});

app.post("/api/orders/:id/ship", auth, (req, res) => {
  const o = db.prepare(`SELECT * FROM orders WHERE id = ?`).get(Number(req.params.id));
  if (!o) return res.status(404).json({ error: "no order" });
  if (o.seller_id !== req.user.id) return res.status(403).json({ error: "not your sale" });
  const tracking = (req.body?.tracking || "").toString().slice(0, 80);
  db.prepare(`UPDATE orders SET status='shipped', tracking=?, updated_at=? WHERE id=?`).run(tracking, Date.now(), o.id);
  notify(o.buyer_id, req.user.id, "shipped", null, tracking ? `shipped your order — ${tracking}` : "shipped your order");
  res.json({ ok: true });
});

app.post("/api/orders/:id/received", auth, (req, res) => {
  const o = db.prepare(`SELECT * FROM orders WHERE id = ?`).get(Number(req.params.id));
  if (!o) return res.status(404).json({ error: "no order" });
  if (o.buyer_id !== req.user.id) return res.status(403).json({ error: "not your order" });
  // Only pay rep for deliveries on orders that were actually PAID. An
  // arrange-mode order is two people clicking buttons — no evidence, no rep.
  if (o.status !== "complete" && (o.status === "shipped" || o.status === "paid") && o.payment_ref) {
    awardRep(o.seller_id, "delivery_confirmed", o.id);
  }
  db.prepare(`UPDATE orders SET status='complete', updated_at=? WHERE id=?`).run(Date.now(), o.id);
  notify(o.seller_id, req.user.id, "order_complete", null, "confirmed delivery");
  res.json({ ok: true });
});

/* ================================================================
   UNREADS — the dot next to a channel name. Without this nobody knows
   anything happened, so nobody comes back.
================================================================ */
app.get("/api/unreads", auth, (req, res) => {
  // Never counts your own posts — you know what you wrote.
  const rows = db.prepare(`
    SELECT p.channel, COUNT(*) n FROM posts p
    LEFT JOIN channel_reads r ON r.user_id = ? AND r.channel = p.channel
    WHERE p.author_id != ? AND p.created_at > COALESCE(r.last_read_at, 0)
    GROUP BY p.channel`).all(req.user.id, req.user.id);
  const out = {};
  for (const r of rows) out[r.channel] = r.n;
  res.json({ unreads: out });
});

app.post("/api/channels/:channel/read", auth, (req, res) => {
  db.prepare(
    `INSERT INTO channel_reads (user_id, channel, last_read_at) VALUES (?,?,?)
     ON CONFLICT(user_id, channel) DO UPDATE SET last_read_at = excluded.last_read_at`
  ).run(req.user.id, String(req.params.channel).slice(0, 40), Date.now());
  res.json({ ok: true });
});

/* ================================================================
   MENTIONS — @someone is how a conversation becomes a collaboration.
================================================================ */
const MENTION_RE = /@([a-z0-9._]{2,20})/gi;
function notifyMentions(text, actorId, postId, kind) {
  if (!text) return;
  const seen = new Set();
  let m;
  MENTION_RE.lastIndex = 0;
  while ((m = MENTION_RE.exec(text))) {
    const name = m[1].toLowerCase();
    if (seen.has(name)) continue;
    seen.add(name);
    const u = q.userByName.get(name);
    if (u && u.id !== actorId) {
      notify(u.id, actorId, kind || "mention", postId, text.slice(0, 80));
    }
  }
}

/* People you can @ — used by the mention picker. */
app.get("/api/mentionable", auth, (req, res) => {
  const term = (req.query.q || "").toString().toLowerCase().slice(0, 20);
  const hidden = blockedIds(req.user.id);
  const rows = db.prepare(`
    SELECT username, display_name, avatar_url, role FROM users
    WHERE username != ? AND (? = '' OR username LIKE ? OR LOWER(display_name) LIKE ?)
    ORDER BY rep DESC LIMIT 8`).all(req.user.username, term, `${term}%`, `${term}%`);
  res.json({
    people: rows.filter((r) => !hidden.has(r.username)).map((r) => ({
      username: r.username, displayName: r.display_name, avatarUrl: r.avatar_url || "", role: r.role,
    })),
  });
});

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
  anime:    { tag: "AKATSUKI", work: "PANELS",   blurb: "Anime, manga, and the visual language it hands the rest of the network." },
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

/* ================================================================
   PUBLISH — a portfolio is private to the network until you publish
   it. Published profiles get a public URL anyone can open without an
   account: the anti-gatekeeper surface. Requires a verified email so
   published pages are always traceable to a real person.
================================================================ */
app.post("/api/me/publish", auth, (req, res) => {
  const on = !!req.body?.published;
  if (on && !req.user.email_verified) {
    return res.status(403).json({ error: "verify your email before publishing", needsVerify: true });
  }
  q.setPublished.run(on ? 1 : 0, req.user.id);
  const u = q.userById.get(req.user.id);
  res.json({ user: publicUser(u), publicUrl: on ? `${baseUrl(req)}/u/${u.username}` : null });
});

/* Public, credential-free portfolio page. Server-rendered so it works
   in link previews and for people with no account. */
app.get("/u/:username", (req, res) => {
  const u = q.userByName.get(req.params.username);
  if (!u || !u.published) {
    return res.status(404).send(`<!doctype html><meta name="viewport" content="width=device-width,initial-scale=1">
<body style="margin:0;background:#000;color:#fff;font-family:Helvetica,Arial,sans-serif;display:flex;align-items:center;justify-content:center;height:100vh;text-align:center">
<div><div style="color:#22C55E;font-family:monospace;font-size:11px;letter-spacing:.16em">TNLLABS &#129514;</div>
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
      <div style="color:#22C55E;font-family:monospace;font-size:9px;letter-spacing:.08em">${p.beat ? "BEAT" : p.videoUrl ? "VIDEO" : p.imageUrl ? "IMAGE" : "POST"} · #${esc(p.channel)}</div>
      ${p.imageUrl ? `<img src="${esc(p.imageUrl)}" style="width:100%;max-height:300px;object-fit:cover;border-radius:7px;margin-top:7px" loading="lazy">` : ""}
      ${p.videoUrl ? `<video src="${esc(p.videoUrl)}" controls playsinline preload="metadata" style="width:100%;max-height:300px;border-radius:7px;margin-top:7px"></video>` : ""}
      ${p.body ? `<div style="font-size:13px;line-height:1.5;color:#D6D2C8;margin-top:7px">${esc(p.body)}</div>` : ""}
      ${p.beat ? `<div style="font-size:12px;font-weight:700;margin-top:7px">♫ ${esc(p.beat.name || "untitled loop")} <span style="color:#8A8A8A;font-family:monospace;font-weight:400">${p.beat.bpm}BPM</span></div>` : ""}
      <div style="font-family:monospace;font-size:9px;color:#8A8A8A;margin-top:8px">♥ ${p.likeCount} &nbsp; ↻ ${p.shareCount}${p.collaborators.filter((c) => c.status === "accepted").length ? ` &nbsp; <span style="color:#22C55E">✓ ${p.collaborators.filter((c) => c.status === "accepted").map((c) => esc(c.display_name || c.username)).join(", ")}</span>` : ""}</div>
    </div>`).join("");

  res.send(`<!doctype html><html><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(u.display_name)} — TNL LABS</title>
<meta property="og:title" content="${esc(u.display_name)} — TNL LABS">
<meta property="og:description" content="${esc(u.bio || K.blurb)}">
<meta name="description" content="${esc(u.bio || K.blurb)}">
</head>
<body style="margin:0;background:#000;color:#fff;font-family:Helvetica,Arial,sans-serif">
<div style="max-width:640px;margin:0 auto;padding:28px 18px 60px">
  <a href="/" style="color:#22C55E;font-family:monospace;font-size:11px;letter-spacing:.16em;text-decoration:none">TNLLABS &#129514;</a>
  <div style="font-family:monospace;font-size:9px;letter-spacing:.14em;color:#8A8A8A;margin-top:14px">${esc(K.tag)}</div>
  <div style="display:flex;align-items:center;gap:13px;margin-top:22px">
    ${u.avatar_url ? `<img src="${esc(u.avatar_url)}" style="width:56px;height:56px;border-radius:50%;object-fit:cover;border:2px solid #22C55E">` : `<div style="width:56px;height:56px;border-radius:50%;background:#141414;border:2px solid #22C55E;display:flex;align-items:center;justify-content:center;font-family:monospace">${esc(u.display_name.slice(0, 2).toUpperCase())}</div>`}
    <div><div style="font-size:20px;font-weight:900;text-transform:uppercase">${esc(u.display_name)}</div>
    <div style="font-family:monospace;font-size:10px;color:#8A8A8A;letter-spacing:.08em">@${esc(u.username)} · L${lvl.id} ${esc(lvl.name.toUpperCase())}</div></div>
  </div>
  <div style="display:flex;flex-wrap:wrap;gap:6px;margin-top:14px">${(() => { let rs = []; try { rs = JSON.parse(u.roles || "[]"); } catch {} if (!rs.length && u.role) rs = [u.role]; return rs.map((r) => `<span style="font-family:monospace;font-size:9px;letter-spacing:.06em;border:1px solid rgba(255,255,255,.2);border-radius:999px;padding:4px 9px;color:#D6D2C8">${esc(r.toUpperCase())}</span>`).join(""); })()}</div>
  ${u.bio ? `<p style="font-size:14px;line-height:1.6;color:#D6D2C8;margin:16px 0 8px;white-space:pre-wrap">${esc(u.bio)}</p>` : ""}
  ${u.link ? `<a href="${/^https?:\/\//.test(u.link) ? esc(u.link) : "https://" + esc(u.link)}" target="_blank" rel="noreferrer nofollow" style="color:#22C55E;font-family:monospace;font-size:11px;text-decoration:none">↗ ${esc(u.link.replace(/^https?:\/\//, ""))}</a>` : ""}
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
           u.role AS author_role, u.avatar_url AS author_avatar, u.rep AS author_rep,
      (SELECT COUNT(*) FROM likes l WHERE l.post_id = p.id) AS like_count,
      (SELECT COUNT(*) FROM posts s WHERE s.shared_from = p.id) AS share_count,
      (SELECT COUNT(*) FROM likes l WHERE l.post_id = p.id AND l.user_id = ?) AS liked_by_me,
      (SELECT COUNT(*) FROM collaborators c WHERE c.post_id = p.id AND c.status='accepted') AS collab_count
    FROM posts p
    JOIN users u ON u.id = p.author_id
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
  const { displayName, bio, link, roles } = req.body || {};
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
  db.prepare(`UPDATE users SET display_name = ?, bio = ?, link = ?, roles = ?, role = ? WHERE id = ?`)
    .run(next.displayName, next.bio, next.link, JSON.stringify(next.roles),
         next.roles[0] || req.user.role, req.user.id);
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
           au.role AS author_role, au.avatar_url AS author_avatar, au.rep AS author_rep,
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
      u.avatar_url AS author_avatar, u.rep AS author_rep,
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
app.get("/api/levels", (_req, res) => res.json({ levels: LEVELS }));
app.get("/api/health", (_req, res) => res.json({ ok: true, time: Date.now() }));

const PORT = process.env.PORT || 8787;
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
│ email       ${ok(MAIL_ENABLED)}${MAIL_ENABLED ? "" : "  ⚠ links shown on screen instead of sent"}
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
