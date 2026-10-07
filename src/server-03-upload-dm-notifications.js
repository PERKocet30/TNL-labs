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
  /* AIFF is Logic's native format — a Mac producer's kit is full of them,
     and rejecting it would make the sound library useless to half of them.
     FLAC turns up in sample packs. */
  if (buf.slice(0, 4).toString("ascii") === "FORM" && /^AIF[FC]$/.test(buf.slice(8, 12).toString("ascii"))) {
    return { ext: "aiff", kind: "audio" };
  }
  if (buf.slice(0, 4).toString("ascii") === "fLaC") return { ext: "flac", kind: "audio" };
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

/* 10 photos = 30 files now (original + feed + grid copies). */
app.post("/api/upload/stream", auth, verified, rateLimit({ max: 120, windowMs: 300000, key: "user" }), (req, res) => {
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
app.post("/api/me/avatar", auth, (req, res) => {
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
  db.prepare(`UPDATE posts SET body = ?, edited_at = ?, link_json = NULL WHERE id = ?`).run(body, Date.now(), post.id);
  const row = feedRows({ postId: post.id, viewerId: req.user.id, limit: 1 })[0];
  const shaped = shapePost(row);
  broadcast("post-edit", shaped);
  if (!post.image_url && !post.video_url && !post.beat_json) previewLater("post", post.id, body);
  res.json({ post: shaped });
});

app.delete("/api/posts/:id", auth, (req, res) => {
  const post = q.postById.get(Number(req.params.id));
  if (!post) return res.status(404).json({ error: "no post" });
  if (post.author_id !== req.user.id) return res.status(403).json({ error: "not your post" });
  db.prepare(`DELETE FROM posts WHERE id = ?`).run(post.id);
  db.prepare(`DELETE FROM reactions WHERE kind = 'post' AND target_id = ?`).run(post.id);
  broadcast("post-delete", { id: post.id });
  res.json({ ok: true });
});

/* /api/posts/:id/work removed in 063. A post is a post by origin (060);
   there is nothing to promote or demote, and leaving the endpoint up
   meant lab chat could still reach the Showroom via curl. */
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
  if (commentsOff(post)) return res.status(403).json({ error: "Comments are off on this post" });
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
   DIRECT MESSAGES — moved to server-10-dm-*.js in messaging v2
   (groups, requests, replies, reactions…). The block checks stay here:
   the whole app uses them.
================================================================ */
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

/* ================================================================
   PASSWORD RESET
================================================================ */
app.post("/api/auth/forgot", rateLimit({ max: 5, windowMs: 900000 }), async (req, res) => {
  const email = (req.body?.email || "").toString().trim();
  const user = usersByEmail(email)[0];
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
  res.send(lookPage({
    title: "New password — TNL LABS", center: true,
    body: `${lookEyebrow("Account")}
${lookIcon("lock")}
<h1>New password</h1>
<p class="p">At least 6 characters.</p>
<input class="in" id="p" type="password" placeholder="New password" autocomplete="new-password">
<div class="msg" id="m"></div>
<button class="btn block" id="go" style="margin-top:0">Set password</button>
<script>
document.getElementById("go").onclick=async()=>{
  const p=document.getElementById("p").value,m=document.getElementById("m");
  m.className="msg";
  if(p.length<6){m.textContent="At least 6 characters.";return}
  const r=await fetch("/api/auth/reset",{method:"POST",headers:{"Content-Type":"application/json"},
    body:JSON.stringify({token:${JSON.stringify(token).replace(/</g, "\\u003c")},password:p})});
  const d=await r.json();
  if(!r.ok){m.textContent=d.error||"That didn't work.";return}
  m.className="msg ok";m.textContent="Password updated. Taking you in…";
  setTimeout(()=>location.href="/",1200);
};
</script>`,
  }));
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
           u.avatar_url AS author_avatar, u.accent AS author_accent, u.rep AS author_rep,
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

