/* ================================================================
   LIVE — 2026-09-29 v2.0. Server-Sent Events, typing, presence,
   lab reactions and pins.

   The stream used to be open to anyone and every event went to every
   connection — including who was messaging whom. Now:
   - you sign in to the stream: the app trades its token for a one-use
     ticket (EventSource can't send headers), valid for 60 seconds;
   - private events (messages, reads, typing in a DM, presence) go only
     to the people in that chat — sendTo();
   - public events (a new lab post, a like) go to signed-in members only
     — broadcast();
   - every minute, connections whose session was signed out or suspended
     are closed.
================================================================ */
const streamTickets = new Map();          // ticket → { userId, token, exp }
const clients = new Map();                // res → { userId, token }
const onlineCount = new Map();            // userId → open connections

function write(res, event, data) {
  try { res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`); } catch {}
}
function broadcast(event, data) {
  for (const res of clients.keys()) write(res, event, data);
}
function sendTo(userIds, event, data) {
  const to = new Set(userIds);
  if (!to.size) return;
  for (const [res, c] of clients) if (to.has(c.userId)) write(res, event, data);
}
function isOnline(userId) { return (onlineCount.get(userId) || 0) > 0; }

const touchSeen = (userId) => db.prepare(`UPDATE users SET last_seen_at = ? WHERE id = ?`).run(Date.now(), userId);

/* Tell the people you have an accepted one-on-one with that you came
   online or went quiet. Nobody else, and nothing if either side has
   "Show activity" off. */
function presenceChanged(userId, active) {
  const u = q.userById.get(userId);
  if (!u || !u.show_active) return;
  const to = db.prepare(`
    SELECT DISTINCT o.user_id FROM dm_members me
    JOIN dm_threads t ON t.id = me.thread_id AND t.is_group = 0
    JOIN dm_members o ON o.thread_id = t.id AND o.user_id != me.user_id
    JOIN users ou ON ou.id = o.user_id AND ou.show_active = 1
    WHERE me.user_id = ? AND me.accepted = 1 AND o.accepted = 1 AND me.left_at IS NULL AND o.left_at IS NULL`)
    .all(userId).map((r) => r.user_id).filter((id) => !isBlocked(userId, id));
  sendTo(to, "presence", { username: u.username, active, at: Date.now() });
}

app.post("/api/stream/ticket", auth, (req, res) => {
  const now = Date.now();
  for (const [k, v] of streamTickets) if (v.exp < now) streamTickets.delete(k);
  const ticket = randomBytes(24).toString("hex");
  streamTickets.set(ticket, { userId: req.user.id, token: req.token, exp: now + 60000 });
  res.json({ ticket });
});

app.get("/api/stream", (req, res) => {
  const key = String(req.query.ticket || "");
  const tk = streamTickets.get(key);
  streamTickets.delete(key);
  const user = tk && tk.exp > Date.now() && q.sessionByToken.get(tk.token) ? q.userById.get(tk.userId) : null;
  if (!user || user.suspended) return res.status(401).json({ error: "sign in to listen" });
  res.set({
    "Content-Type": "text/event-stream",
    /* no-transform stops Cloudflare "optimising" the stream.
       X-Accel-Buffering is the standard way to tell a proxy not to buffer —
       without it, realtime events arrive in a clump minutes later, or never
       arrive at all. */
    "Cache-Control": "no-cache, no-transform",
    Connection: "keep-alive",
    "X-Accel-Buffering": "no",
  });
  res.flushHeaders?.();
  res.write(`event: hello\ndata: {"ok":true}\n\n`);
  clients.set(res, { userId: user.id, token: tk.token });
  const n = (onlineCount.get(user.id) || 0) + 1;
  onlineCount.set(user.id, n);
  touchSeen(user.id);
  if (n === 1) presenceChanged(user.id, true);
  // A comment line every 25s keeps proxies from closing a quiet stream.
  const ping = setInterval(() => { try { res.write(`: ping\n\n`); } catch {} }, 25000);
  req.on("close", () => {
    clearInterval(ping);
    if (!clients.delete(res)) return;
    const left = (onlineCount.get(user.id) || 1) - 1;
    if (left > 0) return onlineCount.set(user.id, left);
    onlineCount.delete(user.id);
    touchSeen(user.id);
    // A reload or a flaky connection shouldn't flicker you offline.
    setTimeout(() => { if (!isOnline(user.id)) presenceChanged(user.id, false); }, 20000).unref?.();
  });
});

/* Signed out or suspended since connecting? The stream closes. Everyone
   still connected gets "last seen" moved on. */
setInterval(() => {
  const seen = new Set();
  for (const [res, c] of clients) {
    const s = q.sessionByToken.get(c.token);
    const u = s && q.userById.get(c.userId);
    if (!u || u.suspended) { try { res.end(); } catch {} continue; }
    if (!seen.has(c.userId)) { seen.add(c.userId); touchSeen(c.userId); }
  }
}, 60000).unref?.();

/* Typing dots. DMs: only to the others in an accepted chat. Labs: to
   members, and the app shows them only in that room. */
app.post("/api/typing", auth, rateLimit({ max: 40, windowMs: 60000, key: "user" }), (req, res) => {
  const chat = String(req.body?.chat || "");
  const who = { chat, username: req.user.username, displayName: req.user.display_name || req.user.username };
  const m = /^dm:(\d+)$/.exec(chat);
  if (m) {
    const t = DM.thread.get(Number(m[1]));
    const mine = t && DM.member.get(t.id, req.user.id);
    if (mine && mine.accepted)
      sendTo(DM.members.all(t.id).filter((p) => p.accepted && p.user_id !== req.user.id).map((p) => p.user_id), "typing", who);
  } else if (/^lab:[a-z0-9-]{1,40}$/.test(chat)) {
    for (const [r, c] of clients) if (c.userId !== req.user.id) write(r, "typing", who);
  } else return res.status(400).json({ error: "unknown chat" });
  res.json({ ok: true });
});

/* ---- labs ---- */
/* Reactions and reply quotes for a page of lab posts, in two queries. */
function chatSidecar(rows) {
  const reactions = new Map(), replies = new Map();
  const ids = rows.map((r) => r.id);
  if (!ids.length) return { reactions, replies };
  const holes = (a) => a.map(() => "?").join(",");
  for (const r of db.prepare(`SELECT x.target_id, x.emoji, u.username FROM reactions x JOIN users u ON u.id = x.user_id
      WHERE x.kind = 'post' AND x.target_id IN (${holes(ids)}) ORDER BY x.created_at`).all(...ids)) {
    if (!reactions.has(r.target_id)) reactions.set(r.target_id, []);
    reactions.get(r.target_id).push({ emoji: r.emoji, username: r.username });
  }
  const rids = [...new Set(rows.map((r) => r.reply_to).filter(Boolean))];
  if (rids.length) for (const p of db.prepare(`
      SELECT p.id, p.body, p.image_url, p.thumb_url, p.video_url, p.beat_json, p.audio_track_id, u.username, u.display_name
      FROM posts p JOIN users u ON u.id = p.author_id WHERE p.id IN (${holes(rids)})`).all(...rids)) {
    replies.set(p.id, {
      id: p.id, from: p.username, displayName: p.display_name || p.username,
      text: (p.body || (p.video_url ? "Video" : p.image_url ? "Photo" : p.beat_json ? "Beat" : p.audio_track_id ? "Music" : "")).slice(0, 140),
      thumb: p.thumb_url || p.image_url || null,
    });
  }
  return { reactions, replies };
}

app.post("/api/posts/:id/react", auth, verified, rateLimit({ max: 60, windowMs: 60000, key: "user" }), (req, res) => {
  const post = q.postById.get(Number(req.params.id));
  if (!post) return res.status(404).json({ error: "no post" });
  if (isBlocked(req.user.id, post.author_id)) return res.status(403).json({ error: "unavailable" });
  const emoji = req.body?.emoji || null;
  if (emoji && !EMOJI.includes(emoji)) return res.status(400).json({ error: "unknown reaction" });
  const reactions = react("post", post.id, req.user.id, emoji);
  broadcast("post-react", { id: post.id, channel: post.channel, reactions });
  res.json({ reactions });
});

/* Pins: up to 3 per lab, newest first. Admins only — checked here, not
   just hidden in the app. */
function pinsFor(channel) {
  const ids = db.prepare(`SELECT post_id FROM channel_pins WHERE channel = ? ORDER BY created_at DESC LIMIT 3`).all(channel).map((r) => r.post_id);
  const rows = ids.map((id) => feedRows({ postId: id, limit: 1 })[0]).filter(Boolean);
  return shapePosts(rows);
}

app.post("/api/posts/:id/pin", auth, admin, (req, res) => {
  const post = q.postById.get(Number(req.params.id));
  if (!post) return res.status(404).json({ error: "no post" });
  if (!post.channel || post.channel === "profile") return res.status(400).json({ error: "Only lab posts can be pinned" });
  if (req.body?.pinned === false) {
    db.prepare(`DELETE FROM channel_pins WHERE channel = ? AND post_id = ?`).run(post.channel, post.id);
  } else {
    db.prepare(`INSERT INTO channel_pins (channel, post_id, pinned_by, created_at) VALUES (?,?,?,?)
      ON CONFLICT(channel, post_id) DO UPDATE SET created_at = excluded.created_at`).run(post.channel, post.id, req.user.id, Date.now());
    db.prepare(`DELETE FROM channel_pins WHERE channel = ? AND post_id NOT IN
      (SELECT post_id FROM channel_pins WHERE channel = ? ORDER BY created_at DESC LIMIT 3)`).run(post.channel, post.channel);
  }
  broadcast("pins", { channel: post.channel });
  res.json({ pins: pinsFor(post.channel) });
});
