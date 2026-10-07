/* ================================================================
   MESSAGES v2.0 — 2026-09-29
   One-on-one and group chats: requests from people you don't follow,
   replies, reactions, edit and unsend, photo / video / voice notes,
   link previews, forwarding, mute, "delete chat". Live delivery
   (typing, seen, presence) is server-10-live.js; link previews are
   fetched by server-10-links.js.

   Who sees what:
   - A chat is its member rows (dm_members). Every route checks
     membership first. A thread id on its own opens nothing.
   - Someone you don't follow lands in Requests: no notification, no
     badge, no "Seen", no typing dots, until you accept or reply.
   - "Delete chat" is per person (cleared_at). It hides history for you
     and never touches anyone else's copy.
================================================================ */
(function migrateMessaging() {
  const colsOf = (t) => db.prepare(`PRAGMA table_info("${t}")`).all().map((c) => c.name);
  const addCols = (t, defs) => {
    const have = new Set(colsOf(t));
    for (const [c, d] of defs) if (!have.has(c)) db.exec(`ALTER TABLE ${t} ADD COLUMN ${c} ${d}`);
  };

  if (!colsOf("dm_threads").includes("is_group")) {
    /* dm_threads was built for pairs: two NOT NULL ids and UNIQUE(a_id, b_id).
       A group has no pair, so the table is rebuilt with SQLite's documented
       procedure (sqlite.org/lang_altertable.html#otheralter). Ids are kept,
       so every message still points at its thread. One transaction: it all
       lands or none of it does. A backup is taken first. */
    const n = db.prepare(`SELECT COUNT(*) n FROM dm_threads`).get().n;
    if (n) {
      try { console.log(`[messages] backup before migrating: ${makeBackup("pre-messaging-v2").name}`); }
      catch (e) { console.error("[messages] pre-migration backup FAILED (migrating anyway, in one transaction):", e.message); }
    }
    const fkWas = db.prepare(`PRAGMA foreign_keys`).get().foreign_keys;
    db.exec(`PRAGMA foreign_keys = OFF`);
    try {
      db.exec(`BEGIN IMMEDIATE`);
      try {
        db.exec(`CREATE TABLE dm_threads_v2 (
          id         INTEGER PRIMARY KEY AUTOINCREMENT,
          a_id       INTEGER REFERENCES users(id) ON DELETE CASCADE,
          b_id       INTEGER REFERENCES users(id) ON DELETE CASCADE,
          is_group   INTEGER NOT NULL DEFAULT 0,
          title      TEXT,
          created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
          updated_at INTEGER NOT NULL,
          created_at INTEGER NOT NULL
        )`);
        db.exec(`INSERT INTO dm_threads_v2 (id, a_id, b_id, is_group, updated_at, created_at)
                 SELECT id, a_id, b_id, 0, updated_at, created_at FROM dm_threads`);
        db.exec(`DROP TABLE dm_threads`);
        db.exec(`ALTER TABLE dm_threads_v2 RENAME TO dm_threads`);
        db.exec(`CREATE UNIQUE INDEX IF NOT EXISTS idx_dm_pair ON dm_threads(a_id, b_id) WHERE is_group = 0`);
        const after = db.prepare(`SELECT COUNT(*) n FROM dm_threads`).get().n;
        if (after !== n) throw new Error(`thread count changed ${n} → ${after}`);
        const bad = db.prepare(`PRAGMA foreign_key_check`).all();
        if (bad.length) throw new Error(`foreign key check: ${JSON.stringify(bad.slice(0, 3))}`);
        db.exec(`COMMIT`);
        console.log(`[messages] dm_threads rebuilt for groups (${n} chats kept)`);
      } catch (e) { db.exec(`ROLLBACK`); throw e; }
    } finally { db.exec(`PRAGMA foreign_keys = ${fkWas ? "ON" : "OFF"}`); }
  }

  addCols("dm_messages", [
    ["reply_to", "INTEGER"], ["video_url", "TEXT"], ["audio_url", "TEXT"], ["audio_ms", "INTEGER"],
    ["post_id", "INTEGER"], ["link_json", "TEXT"], ["forwarded", "INTEGER NOT NULL DEFAULT 0"],
    ["kind", "TEXT NOT NULL DEFAULT 'msg'"], ["edited_at", "INTEGER"], ["deleted_at", "INTEGER"],
  ]);
  addCols("posts", [["reply_to", "INTEGER"], ["link_json", "TEXT"]]);
  addCols("users", [["last_seen_at", "INTEGER"], ["show_active", "INTEGER NOT NULL DEFAULT 1"]]);

  db.exec(`
    CREATE TABLE IF NOT EXISTS dm_members (
      thread_id    INTEGER NOT NULL REFERENCES dm_threads(id) ON DELETE CASCADE,
      user_id      INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      accepted     INTEGER NOT NULL DEFAULT 1,
      last_read_at INTEGER NOT NULL DEFAULT 0,
      cleared_at   INTEGER NOT NULL DEFAULT 0,
      joined_at    INTEGER NOT NULL,
      left_at      INTEGER,
      PRIMARY KEY (thread_id, user_id)
    );
    CREATE INDEX IF NOT EXISTS idx_dm_members_user ON dm_members(user_id);
    CREATE INDEX IF NOT EXISTS idx_dm_post ON dm_messages(post_id) WHERE post_id IS NOT NULL; -- ranking counts sends
    CREATE TABLE IF NOT EXISTS reactions (
      kind       TEXT NOT NULL,
      target_id  INTEGER NOT NULL,
      user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      emoji      TEXT NOT NULL,
      created_at INTEGER NOT NULL,
      PRIMARY KEY (kind, target_id, user_id)
    );
    CREATE TABLE IF NOT EXISTS chat_mutes (
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      chat    TEXT NOT NULL,
      until   INTEGER NOT NULL,
      PRIMARY KEY (user_id, chat)
    );
    CREATE TABLE IF NOT EXISTS channel_pins (
      channel    TEXT NOT NULL,
      post_id    INTEGER NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
      pinned_by  INTEGER REFERENCES users(id) ON DELETE SET NULL,
      created_at INTEGER NOT NULL,
      PRIMARY KEY (channel, post_id)
    );
  `);

  /* Every chat that existed before members did: both people are in, both
     accepted (nobody's old conversation becomes a request), and "read up
     to" is the newest message from the other person already marked read. */
  for (const side of ["a_id", "b_id"]) {
    db.exec(`INSERT OR IGNORE INTO dm_members (thread_id, user_id, accepted, last_read_at, joined_at)
      SELECT t.id, t.${side}, 1,
        COALESCE((SELECT MAX(m.created_at) FROM dm_messages m
                  WHERE m.thread_id = t.id AND m.sender_id != t.${side} AND m.read_at IS NOT NULL), 0),
        t.created_at
      FROM dm_threads t
      WHERE t.is_group = 0 AND t.${side} IS NOT NULL
        AND NOT EXISTS (SELECT 1 FROM dm_members x WHERE x.thread_id = t.id AND x.user_id = t.${side})`);
  }
})();

const MEDIA_RE = /^\/uploads\/[A-Za-z0-9._-]+$/;
const mediaUrl = (v) => (typeof v === "string" && MEDIA_RE.test(v) ? v : null);
const EMOJI = ["❤️", "😂", "😮", "😢", "🔥", "👏"];
const GROUP_MAX = 32;
const EDIT_WINDOW = 15 * 60000;

const DM = {
  pair: db.prepare(`SELECT * FROM dm_threads WHERE is_group = 0 AND a_id = ? AND b_id = ?`),
  thread: db.prepare(`SELECT * FROM dm_threads WHERE id = ?`),
  member: db.prepare(`SELECT * FROM dm_members WHERE thread_id = ? AND user_id = ? AND left_at IS NULL`),
  memberAny: db.prepare(`SELECT * FROM dm_members WHERE thread_id = ? AND user_id = ?`),
  members: db.prepare(`
    SELECT m.*, u.username, u.display_name, u.avatar_url, u.role, u.last_seen_at, u.show_active
    FROM dm_members m JOIN users u ON u.id = m.user_id
    WHERE m.thread_id = ? AND m.left_at IS NULL ORDER BY m.joined_at, m.user_id`),
  addMember: db.prepare(`
    INSERT INTO dm_members (thread_id, user_id, accepted, last_read_at, cleared_at, joined_at) VALUES (?,?,?,?,?,?)
    ON CONFLICT(thread_id, user_id) DO UPDATE SET left_at = NULL, accepted = excluded.accepted,
      last_read_at = excluded.last_read_at, cleared_at = excluded.cleared_at, joined_at = excluded.joined_at`),
  insMsg: db.prepare(`
    INSERT INTO dm_messages (thread_id, sender_id, body, image_url, video_url, audio_url, audio_ms, reply_to, post_id, forwarded, kind, created_at)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`),
  touch: db.prepare(`UPDATE dm_threads SET updated_at = ? WHERE id = ?`),
  msg: db.prepare(`SELECT * FROM dm_messages WHERE id = ?`),
  read: db.prepare(`UPDATE dm_members SET last_read_at = MAX(last_read_at, ?) WHERE thread_id = ? AND user_id = ?`),
  // Kept so the pre-v2 code still reads correctly if a deploy is ever rolled back.
  readCompat: db.prepare(`UPDATE dm_messages SET read_at = ? WHERE thread_id = ? AND sender_id != ? AND read_at IS NULL`),
  accept: db.prepare(`UPDATE dm_members SET accepted = 1 WHERE thread_id = ? AND user_id = ?`),
  last: db.prepare(`
    SELECT * FROM dm_messages WHERE thread_id = ? AND created_at > ? AND deleted_at IS NULL
    ORDER BY id DESC LIMIT 1`),
  unread: db.prepare(`
    SELECT COUNT(*) n FROM dm_messages WHERE thread_id = ? AND sender_id != ? AND created_at > ?
      AND deleted_at IS NULL AND kind = 'msg'`),
  mutes: db.prepare(`SELECT chat FROM chat_mutes WHERE user_id = ? AND until > ?`),
};

const person = (u) => u ? { username: u.username, displayName: u.display_name, avatarUrl: u.avatar_url || "" } : null;
function mutesFor(userId) { return new Set(DM.mutes.all(userId, Date.now()).map((r) => r.chat)); }
const isMuted = (userId, chat) => !!db.prepare(`SELECT 1 FROM chat_mutes WHERE user_id = ? AND chat = ? AND until > ?`).get(userId, chat, Date.now());

/* You hear from people you follow straight away; everyone else knocks
   first. Messages from the team (admins) always arrive. */
function welcomes(toId, fromId) {
  if (q.followExists.get(toId, fromId)) return true;
  return !!q.userById.get(fromId)?.is_admin;
}

/* The one-on-one chat between two people, made on first use. aId is the
   person starting it — they're in; bId is in, or in Requests. */
function threadFor(aId, bId) {
  const [lo, hi] = aId < bId ? [aId, bId] : [bId, aId];
  let t = DM.pair.get(lo, hi);
  const now = Date.now();
  if (!t) {
    const info = db.prepare(`INSERT INTO dm_threads (a_id, b_id, is_group, created_by, updated_at, created_at) VALUES (?,?,0,?,?,?)`)
      .run(lo, hi, aId, now, now);
    t = DM.thread.get(Number(info.lastInsertRowid));
  }
  if (!DM.memberAny.get(t.id, aId)) DM.addMember.run(t.id, aId, 1, now, 0, now);
  if (!DM.memberAny.get(t.id, bId)) DM.addMember.run(t.id, bId, welcomes(bId, aId) ? 1 : 0, 0, 0, now);
  return t;
}

/* What a message says in one line — inbox previews, reply quotes, notifications. */
function msgLine(r) {
  if (!r) return "";
  if (r.deleted_at) return "Unsent";
  if (r.body) return r.body;
  if (r.audio_url) return "Voice message";
  if (r.video_url) return "Video";
  if (r.image_url) return "Photo";
  if (r.post_id) return "Shared a post";
  return "";
}

/* A page of messages in a handful of queries, whatever its size. The shape
   is the same for every viewer, so one copy can be pushed to a whole chat;
   the client works out "mine" from the username. */
function shapeMessages(rows) {
  if (!rows.length) return [];
  const holes = (a) => a.map(() => "?").join(",");
  const ids = rows.map((r) => r.id);
  const reacts = new Map();
  for (const r of db.prepare(`SELECT x.target_id, x.emoji, u.username FROM reactions x JOIN users u ON u.id = x.user_id
      WHERE x.kind = 'dm' AND x.target_id IN (${holes(ids)}) ORDER BY x.created_at`).all(...ids)) {
    if (!reacts.has(r.target_id)) reacts.set(r.target_id, []);
    reacts.get(r.target_id).push({ emoji: r.emoji, username: r.username });
  }
  const replyIds = [...new Set(rows.map((r) => r.reply_to).filter(Boolean))];
  const quoted = new Map(replyIds.length ? db.prepare(`SELECT * FROM dm_messages WHERE id IN (${holes(replyIds)})`)
    .all(...replyIds).map((r) => [r.id, r]) : []);
  const userIds = [...new Set([...rows.map((r) => r.sender_id), ...[...quoted.values()].map((r) => r.sender_id)])];
  const users = new Map(db.prepare(`SELECT id, username, display_name, avatar_url FROM users WHERE id IN (${holes(userIds)})`)
    .all(...userIds).map((u) => [u.id, u]));
  const postIds = [...new Set(rows.map((r) => r.post_id).filter(Boolean))];
  const posts = new Map(postIds.length ? db.prepare(`
      SELECT p.id, p.body, p.image_url, p.thumb_url, p.video_url, p.is_work, p.channel, u.username, u.display_name, u.avatar_url
      FROM posts p JOIN users u ON u.id = p.author_id WHERE p.id IN (${holes(postIds)})`).all(...postIds)
    .map((p) => [p.id, p]) : []);
  return rows.map((r) => {
    const qd = r.reply_to ? quoted.get(r.reply_to) : null;
    const p = r.post_id ? posts.get(r.post_id) : null;
    let link = null; try { link = r.link_json ? JSON.parse(r.link_json) : null; } catch {}
    return {
      id: r.id, chatId: r.thread_id, kind: r.kind || "msg",
      from: person(users.get(r.sender_id)),
      body: r.body || "",
      imageUrl: r.image_url || null, videoUrl: r.video_url || null,
      audioUrl: r.audio_url || null, audioMs: r.audio_ms || null,
      replyTo: r.reply_to ? (qd && qd.thread_id === r.thread_id
        ? { id: qd.id, from: users.get(qd.sender_id)?.username || "", text: msgLine(qd).slice(0, 140),
            thumb: qd.deleted_at ? null : qd.image_url || null, deleted: !!qd.deleted_at }
        : { id: r.reply_to, from: "", text: "Unsent", deleted: true }) : null,
      post: r.post_id ? (p ? { id: p.id, body: (p.body || "").slice(0, 200), imageUrl: p.thumb_url || p.image_url || null,
        video: !!p.video_url, isWork: !!p.is_work, channel: p.channel, author: person(p) } : { id: r.post_id, gone: true }) : null,
      link, reactions: reacts.get(r.id) || [],
      forwarded: !!r.forwarded, editedAt: r.edited_at || null, createdAt: r.created_at,
    };
  });
}

/* Every message goes through here — chats, forwards, shared posts and the
   admin broadcast — so notifications, requests and live delivery can't
   drift apart between routes. */
function dmSend(t, sender, m) {
  const now = Date.now();
  const kind = m.kind || "msg";
  const info = DM.insMsg.run(t.id, sender.id, (m.body || "").slice(0, 4000), m.imageUrl || null, m.videoUrl || null,
    m.audioUrl || null, m.audioMs ?? null, m.replyTo || null, m.postId || null, m.forwarded ? 1 : 0, kind, now);
  DM.touch.run(now, t.id);
  if (kind === "msg") { DM.read.run(now, t.id, sender.id); DM.accept.run(t.id, sender.id); }
  const row = DM.msg.get(Number(info.lastInsertRowid));
  const shaped = shapeMessages([row])[0];
  const people = DM.members.all(t.id);
  if (kind === "msg" && !t.is_group) {
    for (const p of people) {
      if (p.user_id !== sender.id && p.accepted && !isMuted(p.user_id, "dm:" + t.id))
        notify(p.user_id, sender.id, "dm", m.postId || null, msgLine(row).slice(0, 80));
    }
  }
  sendTo(people.map((p) => p.user_id), "chat", { chatId: t.id, message: shaped });
  if (kind === "msg" && row.body && !row.image_url && !row.video_url && !row.audio_url && !row.post_id)
    previewLater("dm", row.id, row.body);
  return shaped;
}
const systemLine = (t, actor, body) => dmSend(t, actor, { body, kind: "system" });

/* A message as the client sent it. Media must be a file uploaded here —
   anything else is refused rather than quietly dropped. */
function readMessage(b = {}) {
  const body = (b.body ?? "").toString().trim().slice(0, 4000);
  const imageUrl = mediaUrl(b.imageUrl), videoUrl = mediaUrl(b.videoUrl), audioUrl = mediaUrl(b.audioUrl);
  if ((b.imageUrl && !imageUrl) || (b.videoUrl && !videoUrl) || (b.audioUrl && !audioUrl))
    return { error: "media must be uploaded first" };
  if (!body && !imageUrl && !videoUrl && !audioUrl) return { error: "empty message" };
  const audioMs = audioUrl ? Math.max(0, Math.min(Math.round(Number(b.audioMs) || 0), 15 * 60000)) : null;
  return { body, imageUrl, videoUrl, audioUrl, audioMs, replyTo: Number(b.replyTo) || null };
}

// A reply can only quote a live message from the same chat.
function replyInChat(m, t) {
  const r = m.replyTo && DM.msg.get(m.replyTo);
  if (!r || r.thread_id !== t.id || r.deleted_at) m.replyTo = null;
}

/* Presence is shown only between people with an accepted chat, and only
   when both have "Show activity" on — hide yours and you don't see theirs. */
function activeOf(viewer, u) {
  if (!u || !viewer.show_active || !u.show_active) return null;
  const on = isOnline(u.user_id ?? u.id);
  return { active: on || (u.last_seen_at && Date.now() - u.last_seen_at < 3 * 60000) || false, lastSeenAt: on ? Date.now() : (u.last_seen_at || null) };
}

function inboxFor(me) {
  const rows = db.prepare(`
    SELECT t.id, t.is_group, t.title, t.updated_at, t.created_by, m.accepted, m.last_read_at, m.cleared_at
    FROM dm_members m JOIN dm_threads t ON t.id = m.thread_id
    WHERE m.user_id = ? AND m.left_at IS NULL ORDER BY t.updated_at DESC LIMIT 100`).all(me.id);
  const hidden = blockedIds(me.id), muted = mutesFor(me.id);
  const chats = [], requests = [];
  for (const r of rows) {
    const people = DM.members.all(r.id).filter((p) => p.user_id !== me.id);
    const other = r.is_group ? null : people[0];
    if (!r.is_group && (!other || hidden.has(other.username))) continue;
    const since = r.cleared_at || 0;
    const last = DM.last.get(r.id, since);
    if (!last && !r.is_group) continue;
    const from = last ? people.find((p) => p.user_id === last.sender_id) : null;
    const item = {
      id: r.id, isGroup: !!r.is_group, title: r.title || "",
      other: other ? { ...person(other), role: other.role, ...(r.accepted && other.accepted ? activeOf(me, other) : {}) } : null,
      people: people.slice(0, 3).map(person), count: people.length + 1,
      last: last ? { body: msgLine(last).slice(0, 120), mine: last.sender_id === me.id, kind: last.kind,
        from: from ? from.display_name || from.username : "", createdAt: last.created_at } : null,
      unread: DM.unread.get(r.id, me.id, Math.max(r.last_read_at, since)).n,
      muted: muted.has("dm:" + r.id), updatedAt: r.updated_at,
    };
    (r.accepted ? chats : requests).push(item);
  }
  return {
    threads: chats, requests, requestCount: requests.length,
    unreadTotal: chats.filter((c) => !c.muted).reduce((n, c) => n + c.unread, 0),
    showActive: !!me.show_active,
  };
}

function chatMeta(t, me, mine) {
  const people = DM.members.all(t.id);
  const others = people.filter((p) => p.user_id !== me.id);
  const creator = people.find((p) => p.user_id === t.created_by);
  return {
    id: t.id, isGroup: !!t.is_group, title: t.title || "",
    createdBy: creator ? creator.username : null,
    request: !mine.accepted, muted: isMuted(me.id, "dm:" + t.id),
    people: people.map((p) => ({
      ...person(p), role: p.role,
      // "Seen" only travels between people who've both accepted the chat.
      readAt: mine.accepted && p.accepted ? p.last_read_at : null,
      ...(!t.is_group && p.user_id !== me.id && mine.accepted && p.accepted ? activeOf(me, p) : {}),
    })),
    other: t.is_group ? null : person(others[0]),
  };
}

/* Membership, or nothing. The same 404 whether the chat doesn't exist or
   isn't yours — an id tells a stranger nothing. */
function chatOr404(req, res) {
  const t = DM.thread.get(Number(req.params.id));
  const mine = t && DM.member.get(t.id, req.user.id);
  if (!mine) { res.status(404).json({ error: "no chat" }); return null; }
  if (!t.is_group) {
    const other = DM.members.all(t.id).find((p) => p.user_id !== req.user.id);
    if (other && isBlocked(req.user.id, other.user_id)) { res.status(403).json({ error: "unavailable" }); return null; }
  }
  return { t, mine };
}

function chatPeople(t) { return DM.members.all(t.id).map((p) => p.user_id); }

function markRead(t, mine, user) {
  const now = Date.now();
  DM.read.run(now, t.id, user.id);
  if (!t.is_group) DM.readCompat.run(now, t.id, user.id);
  if (mine.accepted) sendTo(DM.members.all(t.id).filter((p) => p.accepted).map((p) => p.user_id), "chat-read",
    { chatId: t.id, username: user.username, at: now });
}

