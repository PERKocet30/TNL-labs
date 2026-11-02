/* ================================================================
   MESSAGES v2.0 — groups, forwarding, mute. 2026-09-29
   A group is a chat with a title and up to 32 people. Anyone in it can
   add people and rename it; the person who made it can remove people;
   anyone can leave. Changes are posted into the chat as system lines,
   so nobody is added or removed silently.
================================================================ */
function namesToUsers(list, me) {
  const names = [...new Set((Array.isArray(list) ? list : []).map((n) => String(n || "").trim().toLowerCase()).filter(Boolean))];
  return names.slice(0, GROUP_MAX).map((n) => q.userByName.get(n))
    .filter((u) => u && u.id !== me.id && !u.suspended && !isBlocked(me.id, u.id));
}
const nameOf = (u) => u.display_name || u.username;
const listNames = (us) => us.length <= 3 ? us.map(nameOf).join(", ") : `${us.slice(0, 2).map(nameOf).join(", ")} and ${us.length - 2} others`;

function groupOr404(req, res) {
  const c = chatOr404(req, res); if (!c) return null;
  if (!c.t.is_group) { res.status(400).json({ error: "not a group" }); return null; }
  if (!c.mine.accepted) { res.status(403).json({ error: "accept the chat first" }); return null; }
  return c;
}

app.post("/api/chats", auth, verified, rateLimit({ max: 12, windowMs: 3600000, key: "user" }), (req, res) => {
  const people = namesToUsers(req.body?.usernames, req.user).slice(0, GROUP_MAX - 1);
  if (people.length < 2) return res.status(400).json({ error: "Pick at least two people" });
  const title = (req.body?.title || "").toString().trim().slice(0, 60);
  const now = Date.now();
  const info = db.prepare(`INSERT INTO dm_threads (is_group, title, created_by, updated_at, created_at) VALUES (1,?,?,?,?)`)
    .run(title || null, req.user.id, now, now);
  const t = DM.thread.get(Number(info.lastInsertRowid));
  DM.addMember.run(t.id, req.user.id, 1, now, 0, now);
  for (const u of people) DM.addMember.run(t.id, u.id, welcomes(u.id, req.user.id) ? 1 : 0, 0, 0, now);
  systemLine(t, req.user, `${nameOf(req.user)} made the group`);
  res.json({ chatId: t.id });
});

app.patch("/api/chats/:id", auth, (req, res) => {
  const c = groupOr404(req, res); if (!c) return;
  const title = (req.body?.title || "").toString().trim().slice(0, 60);
  if (title === (c.t.title || "")) return res.json({ ok: true });
  db.prepare(`UPDATE dm_threads SET title = ? WHERE id = ?`).run(title || null, c.t.id);
  systemLine(c.t, req.user, title ? `${nameOf(req.user)} named the group “${title}”` : `${nameOf(req.user)} removed the group name`);
  sendTo(chatPeople(c.t), "chat-meta", { chatId: c.t.id });
  res.json({ ok: true });
});

app.post("/api/chats/:id/members", auth, verified, rateLimit({ max: 30, windowMs: 3600000, key: "user" }), (req, res) => {
  const c = groupOr404(req, res); if (!c) return;
  const inNow = new Set(chatPeople(c.t));
  const room = GROUP_MAX - inNow.size;
  const adds = namesToUsers(req.body?.usernames, req.user).filter((u) => !inNow.has(u.id)).slice(0, Math.max(0, room));
  if (!adds.length) return res.status(400).json({ error: room <= 0 ? `Groups hold ${GROUP_MAX} people` : "No one new to add" });
  const now = Date.now();
  // New people start from now — they don't get the history before they joined.
  for (const u of adds) DM.addMember.run(c.t.id, u.id, welcomes(u.id, req.user.id) ? 1 : 0, 0, now - 1, now);
  systemLine(c.t, req.user, `${nameOf(req.user)} added ${listNames(adds)}`);
  sendTo(chatPeople(c.t), "chat-meta", { chatId: c.t.id });
  res.json({ ok: true, added: adds.length });
});

/* Leave (yourself) or remove (someone else — the group's maker only). */
app.delete("/api/chats/:id/members/:username", auth, (req, res) => {
  const c = chatOr404(req, res); if (!c) return;
  if (!c.t.is_group) return res.status(400).json({ error: "not a group" });
  const who = q.userByName.get(req.params.username);
  const row = who && DM.member.get(c.t.id, who.id);
  if (!row) return res.status(404).json({ error: "not in this group" });
  const self = who.id === req.user.id;
  if (!self && c.t.created_by !== req.user.id) return res.status(403).json({ error: "Only the group's maker can remove people" });
  const before = chatPeople(c.t);
  db.prepare(`UPDATE dm_members SET left_at = ? WHERE thread_id = ? AND user_id = ?`).run(Date.now(), c.t.id, who.id);
  if (self && c.t.created_by === who.id) {
    // The maker left: the longest-standing member takes over removing people.
    const next = DM.members.all(c.t.id).find((p) => p.accepted);
    db.prepare(`UPDATE dm_threads SET created_by = ? WHERE id = ?`).run(next ? next.user_id : null, c.t.id);
  }
  systemLine(c.t, req.user, self ? `${nameOf(req.user)} left` : `${nameOf(req.user)} removed ${nameOf(who)}`);
  sendTo(before, "chat-meta", { chatId: c.t.id });
  res.json({ ok: true });
});

/* Forward a message, or send a post, to up to 10 chats or people at once. */
app.post("/api/chats/forward", auth, verified, rateLimit({ max: 30, windowMs: 60000, key: "user" }), (req, res) => {
  const b = req.body || {};
  let payload = null;
  if (b.messageId) {
    const row = DM.msg.get(Number(b.messageId));
    const mine = row && DM.member.get(row.thread_id, req.user.id);
    if (!row || !mine || row.deleted_at || row.kind !== "msg" || row.created_at <= (mine.cleared_at || 0))
      return res.status(404).json({ error: "no message" });
    payload = { body: row.body, imageUrl: row.image_url, videoUrl: row.video_url, audioUrl: row.audio_url,
      audioMs: row.audio_ms, postId: row.post_id, forwarded: true };
  } else if (b.postId) {
    const post = q.postById.get(Number(b.postId));
    if (!post) return res.status(404).json({ error: "no post" });
    payload = { body: "", postId: post.id };
  } else return res.status(400).json({ error: "nothing to send" });

  const note = (b.note || "").toString().trim().slice(0, 1000);
  const targets = new Map();
  for (const id of (Array.isArray(b.chatIds) ? b.chatIds : []).slice(0, 10)) {
    const t = DM.thread.get(Number(id));
    const mine = t && DM.member.get(t.id, req.user.id);
    if (!mine) continue;
    if (!t.is_group) {
      const other = DM.members.all(t.id).find((p) => p.user_id !== req.user.id);
      if (!other || isBlocked(req.user.id, other.user_id)) continue;
    }
    targets.set(t.id, t);
  }
  for (const u of namesToUsers(b.usernames, req.user).slice(0, 10)) {
    if (targets.size >= 10) break;
    const t = threadFor(req.user.id, u.id);
    targets.set(t.id, t);
  }
  if (!targets.size) return res.status(400).json({ error: "Pick someone to send to" });
  for (const t of targets.values()) {
    dmSend(t, req.user, payload);
    if (note) dmSend(t, req.user, { body: note });
  }
  res.json({ ok: true, sent: targets.size });
});

/* Mute a chat or a lab: 1 hour, 8 hours, a week, or until you unmute
   (hours = -1). hours = 0 unmutes. Muted chats never notify and don't
   count toward badges; they still show as unread when you look. */
app.post("/api/chats/mute", auth, (req, res) => {
  const chat = (req.body?.chat || "").toString();
  const m = /^dm:(\d+)$/.exec(chat);
  if (m ? !DM.member.get(Number(m[1]), req.user.id) : !/^lab:[a-z0-9-]{1,40}$/.test(chat))
    return res.status(400).json({ error: "unknown chat" });
  const hours = Number(req.body?.hours);
  if (!hours) db.prepare(`DELETE FROM chat_mutes WHERE user_id = ? AND chat = ?`).run(req.user.id, chat);
  else {
    const until = hours < 0 ? 8.64e15 : Date.now() + Math.min(hours, 24 * 365) * 3600000;
    db.prepare(`INSERT INTO chat_mutes (user_id, chat, until) VALUES (?,?,?)
      ON CONFLICT(user_id, chat) DO UPDATE SET until = excluded.until`).run(req.user.id, chat, until);
  }
  res.json({ ok: true, muted: [...mutesFor(req.user.id)] });
});

/* Show activity: off means nobody sees when you're active — and you don't
   see anyone else's either. Same trade Instagram makes. */
app.post("/api/chats/activity", auth, (req, res) => {
  const on = req.body?.show ? 1 : 0;
  db.prepare(`UPDATE users SET show_active = ? WHERE id = ?`).run(on, req.user.id);
  res.json({ ok: true, showActive: !!on });
});
