/* ================================================================
   MESSAGES v2.0 — routes. 2026-09-29
   Inbox, one chat, one message. Groups, forwarding and mute are in
   server-10-dm-groups.js; the helpers these use are in server-10-dm-core.js.
================================================================ */
/* ---- inbox ---- */
app.get(["/api/chats", "/api/dm"], auth, (req, res) => res.json(inboxFor(req.user)));

/* Is there already a chat with this person? Never creates one — a chat
   exists once someone says something. */
app.get("/api/chats/with/:username", auth, (req, res) => {
  const other = q.userByName.get(req.params.username);
  if (!other) return res.status(404).json({ error: "no such user" });
  if (isBlocked(req.user.id, other.id)) return res.status(403).json({ error: "unavailable" });
  const [lo, hi] = req.user.id < other.id ? [req.user.id, other.id] : [other.id, req.user.id];
  const t = DM.pair.get(lo, hi);
  res.json({ chatId: t && DM.member.get(t.id, req.user.id) ? t.id : null,
    other: { ...person(other), role: other.role, level: levelFor(other.rep).id } });
});

/* Start (or continue) a one-on-one by username. /api/dm/:username is the
   pre-v2 address, kept so an open tab still sends after a deploy. */
app.post(["/api/chats/with/:username", "/api/dm/:username"], auth, verified,
  rateLimit({ max: 40, windowMs: 60000, key: "user" }), (req, res) => {
  const other = q.userByName.get(req.params.username);
  if (!other) return res.status(404).json({ error: "no such user" });
  if (other.id === req.user.id) return res.status(400).json({ error: "can't message yourself" });
  if (isBlocked(req.user.id, other.id)) return res.status(403).json({ error: "unavailable" });
  const m = readMessage(req.body);
  if (m.error) return res.status(400).json({ error: m.error });
  const t = threadFor(req.user.id, other.id);
  replyInChat(m, t);
  res.json({ ok: true, chatId: t.id, message: dmSend(t, req.user, m) });
});

/* ---- one chat ---- */
app.get("/api/chats/:id", auth, (req, res) => {
  const c = chatOr404(req, res); if (!c) return;
  const before = Number(req.query.before) || 0;
  const rows = db.prepare(`
    SELECT * FROM dm_messages WHERE thread_id = ? AND created_at > ? AND deleted_at IS NULL ${before ? "AND id < ?" : ""}
    ORDER BY id DESC LIMIT 51`).all(...[c.t.id, c.mine.cleared_at || 0, ...(before ? [before] : [])]);
  const hasMore = rows.length > 50;
  const hidden = c.t.is_group ? blockedIds(req.user.id) : new Set();
  const page = shapeMessages(rows.slice(0, 50).reverse()).filter((m) => !hidden.has(m.from?.username));
  if (!before) markRead(c.t, c.mine, req.user);
  res.json({ chat: chatMeta(c.t, req.user, c.mine), messages: page, hasMore });
});

app.post("/api/chats/:id/messages", auth, verified, rateLimit({ max: 40, windowMs: 60000, key: "user" }), (req, res) => {
  const c = chatOr404(req, res); if (!c) return;
  const m = readMessage(req.body);
  if (m.error) return res.status(400).json({ error: m.error });
  replyInChat(m, c.t);
  res.json({ message: dmSend(c.t, req.user, m) });
});

app.post("/api/chats/:id/read", auth, (req, res) => {
  const c = chatOr404(req, res); if (!c) return;
  markRead(c.t, c.mine, req.user);
  res.json({ ok: true });
});

app.post("/api/chats/:id/accept", auth, (req, res) => {
  const c = chatOr404(req, res); if (!c) return;
  DM.accept.run(c.t.id, req.user.id);
  sendTo([req.user.id], "chat-meta", { chatId: c.t.id });
  res.json({ ok: true });
});

/* Delete chat — for you only. Also how a request is declined: the other
   person isn't told, and anything they send later knocks again. */
app.post("/api/chats/:id/clear", auth, (req, res) => {
  const c = chatOr404(req, res); if (!c) return;
  const now = Date.now();
  db.prepare(`UPDATE dm_members SET cleared_at = ?, last_read_at = ? WHERE thread_id = ? AND user_id = ?`)
    .run(now, now, c.t.id, req.user.id);
  sendTo([req.user.id], "chat-meta", { chatId: c.t.id });
  res.json({ ok: true });
});

/* ---- one message ---- */
function ownMessage(req, res) {
  const row = DM.msg.get(Number(req.params.mid));
  const t = row && DM.thread.get(row.thread_id);
  const mine = t && DM.member.get(t.id, req.user.id);
  if (!row || !mine || row.deleted_at || row.kind !== "msg" || row.created_at <= (mine.cleared_at || 0)) {
    res.status(404).json({ error: "no message" }); return null;
  }
  return { row, t, mine };
}

app.patch("/api/chats/m/:mid", auth, (req, res) => {
  const c = ownMessage(req, res); if (!c) return;
  if (c.row.sender_id !== req.user.id) return res.status(403).json({ error: "not yours" });
  if (Date.now() - c.row.created_at > EDIT_WINDOW) return res.status(403).json({ error: "Messages can be edited for 15 minutes" });
  const body = (req.body?.body ?? "").toString().trim().slice(0, 4000);
  if (!body && !c.row.image_url && !c.row.video_url && !c.row.audio_url && !c.row.post_id) return res.status(400).json({ error: "empty message" });
  db.prepare(`UPDATE dm_messages SET body = ?, edited_at = ?, link_json = NULL WHERE id = ?`).run(body, Date.now(), c.row.id);
  const message = shapeMessages([DM.msg.get(c.row.id)])[0];
  sendTo(chatPeople(c.t), "chat-update", { chatId: c.t.id, message });
  if (body && !c.row.image_url && !c.row.video_url && !c.row.audio_url && !c.row.post_id) previewLater("dm", c.row.id, body);
  res.json({ message });
});

/* Unsend: gone for everyone. The text and media links are wiped from the
   row, not just hidden; the files become orphans for Cleanup. */
app.delete("/api/chats/m/:mid", auth, (req, res) => {
  const c = ownMessage(req, res); if (!c) return;
  if (c.row.sender_id !== req.user.id) return res.status(403).json({ error: "not yours" });
  db.prepare(`UPDATE dm_messages SET deleted_at = ?, body = '', image_url = NULL, video_url = NULL, audio_url = NULL,
    link_json = NULL, post_id = NULL WHERE id = ?`).run(Date.now(), c.row.id);
  db.prepare(`DELETE FROM reactions WHERE kind = 'dm' AND target_id = ?`).run(c.row.id);
  sendTo(chatPeople(c.t), "chat-update", { chatId: c.t.id, id: c.row.id, deleted: true });
  res.json({ ok: true });
});

/* One reaction per person per message. The same emoji again takes it off. */
function react(kind, targetId, userId, emoji) {
  const cur = db.prepare(`SELECT emoji FROM reactions WHERE kind = ? AND target_id = ? AND user_id = ?`).get(kind, targetId, userId);
  if (!emoji || cur?.emoji === emoji) db.prepare(`DELETE FROM reactions WHERE kind = ? AND target_id = ? AND user_id = ?`).run(kind, targetId, userId);
  else db.prepare(`INSERT INTO reactions (kind, target_id, user_id, emoji, created_at) VALUES (?,?,?,?,?)
    ON CONFLICT(kind, target_id, user_id) DO UPDATE SET emoji = excluded.emoji, created_at = excluded.created_at`)
    .run(kind, targetId, userId, emoji, Date.now());
  return db.prepare(`SELECT x.emoji, u.username FROM reactions x JOIN users u ON u.id = x.user_id
    WHERE x.kind = ? AND x.target_id = ? ORDER BY x.created_at`).all(kind, targetId).map((r) => ({ emoji: r.emoji, username: r.username }));
}

app.post("/api/chats/m/:mid/react", auth, verified, rateLimit({ max: 60, windowMs: 60000, key: "user" }), (req, res) => {
  const c = ownMessage(req, res); if (!c) return;
  const emoji = req.body?.emoji || null;
  if (emoji && !EMOJI.includes(emoji)) return res.status(400).json({ error: "unknown reaction" });
  const reactions = react("dm", c.row.id, req.user.id, emoji);
  sendTo(chatPeople(c.t), "chat-update", { chatId: c.t.id, id: c.row.id, reactions });
  res.json({ reactions });
});
