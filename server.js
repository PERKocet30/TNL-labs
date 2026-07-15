import express from "express";
import cors from "cors";
import bcrypt from "bcryptjs";
import { randomBytes } from "node:crypto";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { writeFileSync, mkdirSync, existsSync } from "node:fs";
import { db, awardRep, revokeRep, levelFor, LEVELS, DATA_DIR } from "./db.js";
import { sendVerifyEmail, MAIL_ENABLED } from "./mail.js";

const __dirname = dirname(fileURLToPath(import.meta.url));

/* Uploads live beside the database on the same persistent volume. */
const UPLOAD_DIR = join(DATA_DIR, "uploads");
if (!existsSync(UPLOAD_DIR)) mkdirSync(UPLOAD_DIR, { recursive: true });

const app = express();
app.use(cors());
app.use(express.json({ limit: "12mb" })); // images arrive as base64 in the body
app.use(express.static(join(__dirname, "..", "public")));
app.use("/uploads", express.static(UPLOAD_DIR, { maxAge: "365d" }));

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

  makeVerifyToken: db.prepare(`INSERT INTO verify_tokens (token, user_id, expires_at, created_at) VALUES (?, ?, ?, ?)`),
  verifyToken: db.prepare(`SELECT * FROM verify_tokens WHERE token = ?`),
  clearVerifyTokens: db.prepare(`DELETE FROM verify_tokens WHERE user_id = ?`),
  markVerified: db.prepare(`UPDATE users SET email_verified = 1 WHERE id = ?`),
  setPublished: db.prepare(`UPDATE users SET published = ? WHERE id = ?`),
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
    emailVerified: !!u.email_verified,
    published: !!u.published,
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

app.post("/api/auth/register", async (req, res) => {
  const { username, displayName, email, role, password } = req.body || {};
  if (!/^[a-z0-9._]{2,20}$/.test(username || "")) return res.status(400).json({ error: "bad username" });
  if (!displayName?.trim()) return res.status(400).json({ error: "display name required" });
  if (!/^\S+@\S+\.\S+$/.test(email || "")) return res.status(400).json({ error: "bad email" });
  if (!password || password.length < 6) return res.status(400).json({ error: "password too short" });
  if (q.userByName.get(username)) return res.status(409).json({ error: "username taken" });
  if (db.prepare(`SELECT 1 FROM users WHERE email = ?`).get(email.trim()))
    return res.status(409).json({ error: "email already registered" });

  const hash = await bcrypt.hash(password, 10);
  const info = q.createUser.run(username, displayName.trim(), email.trim(), role || "Member", hash, Date.now());
  const user = q.userById.get(info.lastInsertRowid);
  const token = randomBytes(24).toString("hex");
  q.createSession.run(token, user.id, Date.now());
  const mail = await issueVerification(user, req);
  res.json({ token, user: publicUser(user), mailSent: mail.sent, verifyUrl: mail.url });
});

/* Click-through from the email. Renders a small page, not JSON. */
app.get("/api/auth/verify", (req, res) => {
  const row = q.verifyToken.get(String(req.query.token || ""));
  const page = (title, msg, ok) => `<!doctype html><meta name="viewport" content="width=device-width,initial-scale=1">
<body style="margin:0;background:#000;color:#fff;font-family:Helvetica,Arial,sans-serif;display:flex;align-items:center;justify-content:center;height:100vh;text-align:center">
<div style="max-width:340px;padding:24px">
  <div style="color:#22C55E;font-family:monospace;font-size:11px;letter-spacing:.16em">TNLLABS &#129514;</div>
  <h1 style="font-size:24px;margin:14px 0 8px;text-transform:uppercase">${title}</h1>
  <p style="color:#8A8A8A;font-size:14px;line-height:1.6">${msg}</p>
  ${ok ? `<a href="/" style="display:inline-block;margin-top:18px;background:#fff;color:#000;text-decoration:none;font-weight:700;padding:12px 20px;border-radius:9px">Open the app</a>` : ""}
</div></body>`;
  if (!row) return res.status(400).send(page("Invalid link", "That verification link isn't recognised. Request a new one from the app.", false));
  if (row.expires_at < Date.now()) {
    return res.status(400).send(page("Link expired", "Verification links last 24 hours. Request a new one from the app.", false));
  }
  q.markVerified.run(row.user_id);
  q.clearVerifyTokens.run(row.user_id);
  res.send(page("Email confirmed", "You're verified. Your account is live and your work can be published.", true));
});

app.post("/api/auth/resend", auth, async (req, res) => {
  if (req.user.email_verified) return res.json({ ok: true, already: true });
  const mail = await issueVerification(req.user, req);
  res.json({ ok: true, mailSent: mail.sent, verifyUrl: mail.url });
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
app.get("/api/feed", maybeAuth, (req, res) => {
  const workOnly = req.query.work === "1";
  const rows = feedRows({
    channel: req.query.channel,
    viewerId: req.user?.id,
    workOnly,
    limit: workOnly ? 120 : 50,
  });
  res.json({ posts: rows.map(shapePost) });
});

app.post("/api/posts", auth, verified, (req, res) => {
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
    if (post.author_id !== req.user.id) awardRep(post.author_id, "like_received", post.id);
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
   IMAGE UPLOAD
   The browser compresses/resizes before sending, so we receive a
   modest base64 data URL. We validate by MAGIC BYTES rather than by
   trusting the declared mime type, then write a random filename —
   never anything derived from user input.
================================================================ */
const MAGIC = [
  { ext: "jpg", bytes: [0xff, 0xd8, 0xff] },
  { ext: "png", bytes: [0x89, 0x50, 0x4e, 0x47] },
  { ext: "gif", bytes: [0x47, 0x49, 0x46, 0x38] },
  { ext: "webp", bytes: [0x52, 0x49, 0x46, 0x46] }, // RIFF....WEBP
];
function sniff(buf) {
  for (const m of MAGIC) {
    if (m.bytes.every((b, i) => buf[i] === b)) {
      if (m.ext === "webp" && buf.slice(8, 12).toString("ascii") !== "WEBP") continue;
      return m.ext;
    }
  }
  return null;
}

app.post("/api/upload", auth, verified, (req, res) => {
  const { data } = req.body || {};
  if (typeof data !== "string") return res.status(400).json({ error: "no image data" });
  const m = /^data:image\/[a-z+]+;base64,(.+)$/i.exec(data);
  if (!m) return res.status(400).json({ error: "not a base64 image" });

  let buf;
  try { buf = Buffer.from(m[1], "base64"); }
  catch { return res.status(400).json({ error: "bad encoding" }); }

  if (buf.length > 8 * 1024 * 1024) return res.status(413).json({ error: "image too large (8MB max)" });
  const ext = sniff(buf);
  if (!ext) return res.status(400).json({ error: "unsupported image type" });

  const name = `${Date.now()}-${randomBytes(8).toString("hex")}.${ext}`;
  writeFileSync(join(UPLOAD_DIR, name), buf);
  res.json({ url: `/uploads/${name}` });
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
  if (post.author_id !== req.user.id) awardRep(post.author_id, "collab_accepted", post.id);
  broadcast("collab-accepted", { postId: post.id, username: req.user.username });
  res.json({ ok: true, status: "accepted" });
});

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
  const posts = feedRows({ authorId: u.id, viewerId: 0, limit: 60 }).map(shapePost);
  const likes = db.prepare(`SELECT COUNT(*) n FROM likes l JOIN posts p ON p.id=l.post_id WHERE p.author_id=?`).get(u.id).n;
  const collabs = db.prepare(`SELECT COUNT(*) n FROM collaborators WHERE user_id=? AND status='accepted'`).get(u.id).n;
  const lvl = levelFor(u.rep);
  const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

  const work = posts.map((p) => `
    <div style="background:#141414;border:1px solid rgba(255,255,255,.12);border-radius:10px;padding:11px;margin-bottom:9px">
      <div style="color:#22C55E;font-family:monospace;font-size:9px;letter-spacing:.08em">${p.beat ? "BEAT" : p.imageUrl ? "IMAGE" : "POST"} · #${esc(p.channel)}</div>
      ${p.imageUrl ? `<img src="${esc(p.imageUrl)}" style="width:100%;max-height:300px;object-fit:cover;border-radius:7px;margin-top:7px" loading="lazy">` : ""}
      ${p.body ? `<div style="font-size:13px;line-height:1.5;color:#D6D2C8;margin-top:7px">${esc(p.body)}</div>` : ""}
      ${p.beat ? `<div style="font-size:12px;font-weight:700;margin-top:7px">♫ ${esc(p.beat.name || "untitled loop")} <span style="color:#8A8A8A;font-family:monospace;font-weight:400">${p.beat.bpm}BPM</span></div>` : ""}
      <div style="font-family:monospace;font-size:9px;color:#8A8A8A;margin-top:8px">🔥 ${p.likeCount} &nbsp; ↻ ${p.shareCount}${p.collaborators.filter((c) => c.status === "accepted").length ? ` &nbsp; <span style="color:#22C55E">✓ ${p.collaborators.filter((c) => c.status === "accepted").map((c) => esc(c.display_name || c.username)).join(", ")}</span>` : ""}</div>
    </div>`).join("");

  res.send(`<!doctype html><html><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(u.display_name)} — TNL LABS</title>
<meta property="og:title" content="${esc(u.display_name)} — TNL LABS">
<meta property="og:description" content="${esc(u.bio || u.role)}">
<meta name="description" content="${esc(u.bio || u.role)}">
</head>
<body style="margin:0;background:#000;color:#fff;font-family:Helvetica,Arial,sans-serif">
<div style="max-width:640px;margin:0 auto;padding:28px 18px 60px">
  <a href="/" style="color:#22C55E;font-family:monospace;font-size:11px;letter-spacing:.16em;text-decoration:none">TNLLABS &#129514;</a>
  <div style="display:flex;align-items:center;gap:13px;margin-top:22px">
    <div style="width:56px;height:56px;border-radius:50%;background:#141414;border:2px solid #22C55E;display:flex;align-items:center;justify-content:center;font-family:monospace">${esc(u.display_name.slice(0, 2).toUpperCase())}</div>
    <div><div style="font-size:20px;font-weight:900;text-transform:uppercase">${esc(u.display_name)}</div>
    <div style="font-family:monospace;font-size:10px;color:#8A8A8A;letter-spacing:.08em">@${esc(u.username)} · ${esc(u.role.toUpperCase())} · L${lvl.id} ${esc(lvl.name.toUpperCase())}</div></div>
  </div>
  ${u.bio ? `<p style="font-size:14px;line-height:1.6;color:#D6D2C8;margin:16px 0 8px;white-space:pre-wrap">${esc(u.bio)}</p>` : ""}
  ${u.link ? `<a href="${/^https?:\/\//.test(u.link) ? esc(u.link) : "https://" + esc(u.link)}" target="_blank" rel="noreferrer nofollow" style="color:#22C55E;font-family:monospace;font-size:11px;text-decoration:none">↗ ${esc(u.link.replace(/^https?:\/\//, ""))}</a>` : ""}
  <div style="display:flex;gap:8px;border-top:1px solid rgba(255,255,255,.12);border-bottom:1px solid rgba(255,255,255,.12);padding:14px 0;margin:16px 0 20px">
    <div style="flex:1"><b style="font-size:17px">${posts.length}</b><div style="font-family:monospace;font-size:9px;color:#8A8A8A">WORK</div></div>
    <div style="flex:1"><b style="font-size:17px">${likes}</b><div style="font-family:monospace;font-size:9px;color:#8A8A8A">🔥 RECEIVED</div></div>
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
           u.role AS author_role, u.rep AS author_rep,
      (SELECT COUNT(*) FROM likes l WHERE l.post_id = p.id) AS like_count,
      (SELECT COUNT(*) FROM posts s WHERE s.shared_from = p.id) AS share_count,
      (SELECT COUNT(*) FROM likes l WHERE l.post_id = p.id AND l.user_id = ?) AS liked_by_me,
      (SELECT COUNT(*) FROM collaborators c WHERE c.post_id = p.id AND c.status='accepted') AS collab_count
    FROM posts p
    JOIN users u ON u.id = p.author_id
    WHERE (p.image_url IS NOT NULL OR p.beat_json IS NOT NULL)
      AND p.shared_from IS NULL
    ORDER BY (
      (SELECT COUNT(*) FROM collaborators c WHERE c.post_id = p.id AND c.status='accepted') * 30 +
      (SELECT COUNT(*) FROM likes l WHERE l.post_id = p.id) * 6 +
      (SELECT COUNT(*) FROM posts s WHERE s.shared_from = p.id) * 3 -
      ((? - p.created_at) / 3600000.0) * 0.6
    ) DESC
    LIMIT 60`).all(req.user?.id || 0, Date.now());
  res.json({ posts: rows.map(shapePost) });
});

/* Builders — people whose work is being validated right now. */
app.get("/api/builders", (_req, res) => {
  const rows = db.prepare(`
    SELECT u.username, u.display_name, u.role, u.rep, u.published,
      (SELECT COUNT(*) FROM posts p WHERE p.author_id = u.id) AS posts,
      (SELECT COUNT(*) FROM collaborators c WHERE c.user_id = u.id AND c.status='accepted') AS collabs,
      (SELECT COUNT(*) FROM likes l JOIN posts p2 ON p2.id = l.post_id WHERE p2.author_id = u.id) AS validations
    FROM users u
    WHERE (SELECT COUNT(*) FROM posts p WHERE p.author_id = u.id) > 0
    ORDER BY (u.rep + (SELECT COUNT(*) FROM collaborators c WHERE c.user_id = u.id AND c.status='accepted') * 10) DESC
    LIMIT 12`).all();
  res.json({ builders: rows.map((r) => ({ ...r, level: levelFor(r.rep).id, levelName: levelFor(r.rep).name })) });
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
