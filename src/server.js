import express from "express";
import cors from "cors";
import bcrypt from "bcryptjs";
import { randomBytes } from "node:crypto";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { db, awardRep, revokeRep, levelFor, LEVELS } from "./db.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const app = express();
app.use(cors());
app.use(express.json({ limit: "1mb" }));
app.use(express.static(join(__dirname, "..", "public")));

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
    `INSERT INTO posts (author_id, channel, body, beat_json, image_url, shared_from, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`
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
};

/* Feed query builder — returns posts enriched with author, counts, and
   whether the current viewer liked them. */
function feedRows({ channel, authorId, viewerId, limit = 50 }) {
  const where = [];
  const params = {};
  if (channel) { where.push(`p.channel = $channel`); params.channel = channel; }
  if (authorId) { where.push(`p.author_id = $authorId`); params.authorId = authorId; }
  const whereSql = where.length ? "WHERE " + where.join(" AND ") : "";
  const sql = `
    SELECT
      p.id, p.channel, p.body, p.beat_json, p.image_url, p.shared_from, p.created_at,
      u.username AS author_username, u.display_name AS author_name, u.role AS author_role, u.rep AS author_rep,
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

function shapePost(row) {
  return {
    id: row.id,
    channel: row.channel,
    body: row.body,
    beat: row.beat_json ? JSON.parse(row.beat_json) : null,
    imageUrl: row.image_url || null,
    sharedFrom: row.shared_from || null,
    createdAt: row.created_at,
    author: {
      username: row.author_username,
      displayName: row.author_name,
      role: row.author_role,
      rep: row.author_rep,
      level: levelFor(row.author_rep).id,
    },
    likeCount: row.like_count,
    shareCount: row.share_count,
    likedByMe: !!row.liked_by_me,
    collaborators: q.collabsForPost.all(row.id),
  };
}

function publicUser(u) {
  return {
    username: u.username,
    displayName: u.display_name,
    email: u.email,
    role: u.role,
    rep: u.rep,
    bio: u.bio || "",
    link: u.link || "",
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

app.post("/api/auth/register", async (req, res) => {
  const { username, displayName, email, role, password } = req.body || {};
  if (!/^[a-z0-9._]{2,20}$/.test(username || "")) return res.status(400).json({ error: "bad username" });
  if (!displayName?.trim()) return res.status(400).json({ error: "display name required" });
  if (!/^\S+@\S+\.\S+$/.test(email || "")) return res.status(400).json({ error: "bad email" });
  if (!password || password.length < 6) return res.status(400).json({ error: "password too short" });
  if (q.userByName.get(username)) return res.status(409).json({ error: "username taken" });

  const hash = await bcrypt.hash(password, 10);
  const info = q.createUser.run(username, displayName.trim(), email.trim(), role || "Member", hash, Date.now());
  const user = q.userById.get(info.lastInsertRowid);
  const token = randomBytes(24).toString("hex");
  q.createSession.run(token, user.id, Date.now());
  res.json({ token, user: publicUser(user) });
});

app.post("/api/auth/login", async (req, res) => {
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

/* ================================================================
   POSTS & FEED
================================================================ */
app.get("/api/feed", maybeAuth, (req, res) => {
  const rows = feedRows({ channel: req.query.channel, viewerId: req.user?.id });
  res.json({ posts: rows.map(shapePost) });
});

app.post("/api/posts", auth, (req, res) => {
  const { channel, body, beat, imageUrl } = req.body || {};
  if (!body?.trim() && !beat && !imageUrl) return res.status(400).json({ error: "empty post" });
  const info = q.createPost.run(
    req.user.id, channel || "general", (body || "").trim(),
    beat ? JSON.stringify(beat) : null, imageUrl || null, null, Date.now()
  );
  const row = feedRows({ authorId: req.user.id, viewerId: req.user.id, limit: 1 })
    .find((r) => r.id === Number(info.lastInsertRowid));
  const post = shapePost(row);
  broadcast("post", post);
  res.json({ post });
});

/* Like / unlike — toggling. Liking someone else's post awards THEM rep. */
app.post("/api/posts/:id/like", auth, (req, res) => {
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
    if (post.author_id !== req.user.id) awardRep(post.author_id, "like_received", post.id);
    liked = true;
  }
  broadcast("like", { postId: post.id, liked });
  res.json({ liked });
});

/* Share — reposts an existing post into a channel. Awards the ORIGINAL author rep. */
app.post("/api/posts/:id/share", auth, (req, res) => {
  const original = q.postById.get(Number(req.params.id));
  if (!original) return res.status(404).json({ error: "no post" });
  const target = (req.body?.channel || original.channel).trim();
  const info = q.createPost.run(
    req.user.id, target, req.body?.comment?.trim() || "",
    original.beat_json, original.image_url, original.id, Date.now()
  );
  if (original.author_id !== req.user.id) awardRep(original.author_id, "share_received", original.id);
  const row = feedRows({ authorId: req.user.id, viewerId: req.user.id, limit: 1 })
    .find((r) => r.id === Number(info.lastInsertRowid));
  const post = shapePost(row);
  broadcast("post", post);
  res.json({ post });
});

/* ================================================================
   COLLABORATION — two-sided. Invite, then the invitee accepts.
   On accept, BOTH parties earn rep. This is the cross-lab engine.
================================================================ */
app.post("/api/posts/:id/collab", auth, (req, res) => {
  const post = q.postById.get(Number(req.params.id));
  if (!post) return res.status(404).json({ error: "no post" });
  if (post.author_id !== req.user.id) return res.status(403).json({ error: "only the author can invite" });
  const invitee = q.userByName.get(req.body?.username || "");
  if (!invitee) return res.status(404).json({ error: "no such user" });
  if (invitee.id === req.user.id) return res.status(400).json({ error: "cannot collab with yourself" });
  q.addCollab.run(post.id, invitee.id, Date.now());
  broadcast("collab-invite", { postId: post.id, username: invitee.username });
  res.json({ ok: true, status: "pending" });
});

app.post("/api/posts/:id/collab/accept", auth, (req, res) => {
  const post = q.postById.get(Number(req.params.id));
  if (!post) return res.status(404).json({ error: "no post" });
  const row = q.collabRow.get(post.id, req.user.id);
  if (!row) return res.status(404).json({ error: "no invite for you" });
  if (row.status === "accepted") return res.json({ ok: true, status: "accepted" });
  q.acceptCollab.run(post.id, req.user.id);
  // both sides earn rep for a confirmed collaboration
  awardRep(req.user.id, "collab_accepted", post.id);
  if (post.author_id !== req.user.id) awardRep(post.author_id, "collab_accepted", post.id);
  broadcast("collab-accepted", { postId: post.id, username: req.user.username });
  res.json({ ok: true, status: "accepted" });
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
  res.json({ following: true });
});

/* Edit your own profile — bio, link, display name, role. */
app.patch("/api/me", auth, (req, res) => {
  const { displayName, bio, link, role } = req.body || {};
  const next = {
    displayName: (displayName ?? req.user.display_name).toString().slice(0, 40).trim() || req.user.display_name,
    bio: (bio ?? req.user.bio).toString().slice(0, 300),
    link: (link ?? req.user.link).toString().slice(0, 200).trim(),
    role: (role ?? req.user.role).toString().slice(0, 40),
  };
  db.prepare(`UPDATE users SET display_name = ?, bio = ?, link = ?, role = ? WHERE id = ?`)
    .run(next.displayName, next.bio, next.link, next.role, req.user.id);
  res.json({ user: publicUser(q.userById.get(req.user.id)) });
});

/* Full profile = the portfolio. Everything they've published, plus the
   stats that make standing legible: work, validation received, collabs. */
app.get("/api/users/:username", maybeAuth, (req, res) => {
  const u = q.userByName.get(req.params.username);
  if (!u) return res.status(404).json({ error: "no such user" });
  const posts = feedRows({ authorId: u.id, viewerId: req.user?.id, limit: 200 }).map(shapePost);

  // work they collaborated ON (someone else's post they accepted)
  const collabRows = db.prepare(`
    SELECT p.*, au.username AS author_username, au.display_name AS author_name,
           au.role AS author_role, au.rep AS author_rep,
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
    collabs: collabRows.map(shapePost),
  });
});

/* Following feed — posts from people you follow (plus your own). */
app.get("/api/feed/following", auth, (req, res) => {
  const ids = q.followingIds.all(req.user.id).map((r) => r.followee_id);
  ids.push(req.user.id);
  const placeholders = ids.map(() => "?").join(",");
  const sql = `
    SELECT p.*, u.username AS author_username, u.display_name AS author_name, u.role AS author_role, u.rep AS author_rep,
      (SELECT COUNT(*) FROM likes l WHERE l.post_id = p.id) AS like_count,
      (SELECT COUNT(*) FROM posts s WHERE s.shared_from = p.id) AS share_count,
      (SELECT COUNT(*) FROM likes l WHERE l.post_id = p.id AND l.user_id = ?) AS liked_by_me
    FROM posts p JOIN users u ON u.id = p.author_id
    WHERE p.author_id IN (${placeholders})
    ORDER BY p.created_at DESC LIMIT 60`;
  const rows = db.prepare(sql).all(req.user.id, ...ids);
  res.json({ posts: rows.map(shapePost) });
});

/* ---- meta ---- */
app.get("/api/levels", (_req, res) => res.json({ levels: LEVELS }));
app.get("/api/health", (_req, res) => res.json({ ok: true, time: Date.now() }));

const PORT = process.env.PORT || 8787;
app.listen(PORT, () => console.log(`TNL social backend on http://localhost:${PORT}`));
