/* ================================================================
   ADMIN v2.0 — 2026-09-29. What the dashboard runs on.
   - /api/admin/pulse: the numbers that matter for a date range, each
     against the range before it, plus daily series, the collab loop
     with who's stuck at each step, lab activity, and "needs you".
   - /api/admin/people: members to filter, sort and act on, with a
     private note per person and "sign out everywhere".
   - /api/admin/posts: content to moderate, filterable.
   - /api/admin/log: every admin change, written down (auditAdmin, hooked
     in server-01 for all /api/admin writes).
   Every route is behind auth + admin(), checked here on the server.
================================================================ */
db.exec(`
  CREATE TABLE IF NOT EXISTS admin_log (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    admin_id   INTEGER REFERENCES users(id) ON DELETE SET NULL,
    action     TEXT NOT NULL,
    target     TEXT NOT NULL DEFAULT '',
    detail     TEXT NOT NULL DEFAULT '',
    created_at INTEGER NOT NULL
  );
  CREATE INDEX IF NOT EXISTS idx_admin_log ON admin_log(created_at);
  CREATE TABLE IF NOT EXISTS admin_notes (
    user_id    INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    body       TEXT NOT NULL DEFAULT '',
    updated_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
    updated_at INTEGER NOT NULL
  );
`);

/* Written after a successful admin write. Passwords, tokens and keys never
   reach the log; long values are cut. */
function auditAdmin(req, action) {
  try {
    const body = req.body && typeof req.body === "object" ? { ...req.body } : {};
    for (const k of Object.keys(body)) if (/pass|token|secret|key/i.test(k)) body[k] = "•••";
    const path = String(req.originalUrl || "").split("?")[0];
    db.prepare(`INSERT INTO admin_log (admin_id, action, target, detail, created_at) VALUES (?,?,?,?,?)`).run(
      req.user?.id ?? null, (action || `${req.method} ${path}`).slice(0, 120),
      String(req.params?.username || req.params?.id || req.params?.name || "").slice(0, 80),
      JSON.stringify(body).slice(0, 400), Date.now());
  } catch (e) { console.error("[admin-log]", e.message); }
}

const ADAY = 86400000;
const PAID = `('paid','shipped','complete')`;
const aone = (sql, ...p) => db.prepare(sql).get(...p)?.n ?? 0;
/* Doing anything counts as active: posting, feedback, a like or reaction,
   a message. Opening the app only counts from messaging v2 on (last_seen_at). */
const ACTIVITY = `
  SELECT author_id u, created_at t FROM posts
  UNION ALL SELECT author_id, created_at FROM comments
  UNION ALL SELECT user_id, created_at FROM likes
  UNION ALL SELECT user_id, created_at FROM reactions
  UNION ALL SELECT sender_id, created_at FROM dm_messages WHERE kind = 'msg'`;
const feeOf = (o) => Math.round(o.amount_cents * (feeForRep(o.seller_rep) / 100));

function windowStats(a, b) {
  const orders = db.prepare(`SELECT o.amount_cents, o.shipping_cents, u.rep seller_rep FROM orders o JOIN users u ON u.id = o.seller_id
    WHERE o.status IN ${PAID} AND o.created_at > ? AND o.created_at <= ?`).all(a, b);
  return {
    signups: aone(`SELECT COUNT(*) n FROM users WHERE created_at > ? AND created_at <= ?`, a, b),
    active: aone(`SELECT COUNT(DISTINCT u) n FROM (${ACTIVITY}) WHERE t > ? AND t <= ?`, a, b),
    posts: aone(`SELECT COUNT(*) n FROM posts WHERE created_at > ? AND created_at <= ?`, a, b),
    work: aone(`SELECT COUNT(*) n FROM posts WHERE is_work = 1 AND created_at > ? AND created_at <= ?`, a, b),
    feedback: aone(`SELECT (SELECT COUNT(*) FROM comments WHERE created_at > ?1 AND created_at <= ?2)
      + (SELECT COUNT(*) FROM likes WHERE created_at > ?1 AND created_at <= ?2)
      + (SELECT COUNT(*) FROM reactions WHERE created_at > ?1 AND created_at <= ?2) n`, a, b),
    messages: aone(`SELECT COUNT(*) n FROM dm_messages WHERE kind = 'msg' AND created_at > ? AND created_at <= ?`, a, b),
    collabs: aone(`SELECT COUNT(*) n FROM collaborators WHERE status = 'accepted' AND created_at > ? AND created_at <= ?`, a, b),
    orders: orders.length,
    gmv: orders.reduce((s, o) => s + o.amount_cents + o.shipping_cents, 0),
    commission: orders.reduce((s, o) => s + feeOf(o), 0),
  };
}

/* The collab loop, person by person. Each step counts everyone who has done
   it; `stuck` = did the step before, not this one — the people to nudge. */
function loopSteps() {
  const set = (sql) => new Set(db.prepare(sql).all().map((r) => r.u));
  const live = set(`SELECT id u FROM users WHERE suspended = 0`);
  const steps = [
    ["Joined", live],
    ["Posted", set(`SELECT DISTINCT author_id u FROM posts`)],
    ["Got feedback", set(`SELECT DISTINCT p.author_id u FROM posts p WHERE EXISTS (SELECT 1 FROM likes l WHERE l.post_id = p.id AND l.user_id != p.author_id)
      OR EXISTS (SELECT 1 FROM comments c WHERE c.post_id = p.id AND c.author_id != p.author_id)
      OR EXISTS (SELECT 1 FROM reactions x WHERE x.kind = 'post' AND x.target_id = p.id AND x.user_id != p.author_id)`)],
    ["Messaged someone", set(`SELECT DISTINCT sender_id u FROM dm_messages WHERE kind = 'msg'`)],
    ["In a collab", set(`SELECT user_id u FROM collaborators UNION SELECT p.author_id FROM collaborators c JOIN posts p ON p.id = c.post_id`)],
    ["Collab confirmed", set(`SELECT user_id u FROM collaborators WHERE status = 'accepted' UNION SELECT p.author_id FROM collaborators c JOIN posts p ON p.id = c.post_id WHERE c.status = 'accepted'`)],
    ["Sold something", set(`SELECT DISTINCT seller_id u FROM orders WHERE status IN ${PAID}`)],
  ].map(([label, ids]) => ({ label, ids: new Set([...ids].filter((u) => live.has(u))) }));
  const names = new Map(db.prepare(`SELECT id, username, display_name, avatar_url FROM users`).all().map((u) => [u.id, u]));
  return steps.map((st, i) => {
    const stuck = i ? [...steps[i - 1].ids].filter((u) => !st.ids.has(u)) : [];
    return { label: st.label, n: st.ids.size, stuckCount: stuck.length,
      stuck: stuck.slice(0, 40).map((u) => { const x = names.get(u); return x ? { username: x.username, displayName: x.display_name, avatarUrl: x.avatar_url || "" } : null; }).filter(Boolean) };
  });
}

app.get("/api/admin/pulse", auth, admin, (req, res) => {
  const days = [7, 30, 90].includes(Number(req.query.days)) ? Number(req.query.days) : 30;
  const tz = Math.max(-840, Math.min(840, Number(req.query.tz) || 0)) * 60000;   // Date#getTimezoneOffset, in ms
  const now = Date.now();
  // day buckets start at the admin's local midnight, `days` days back including today
  const localMidnight = Math.floor((now - tz) / ADAY) * ADAY + tz;
  const start = localMidnight - (days - 1) * ADAY;
  const prevStart = start - days * ADAY;

  const bucket = (sql, ...p) => {
    const out = new Array(days).fill(0);
    for (const r of db.prepare(sql).all(start, ...p)) if (r.d >= 0 && r.d < days) out[r.d] = r.n;
    return out;
  };
  const dayExpr = `CAST((created_at - ?1) / ${ADAY} AS INTEGER)`;
  const series = {
    signups: bucket(`SELECT ${dayExpr} d, COUNT(*) n FROM users WHERE created_at >= ?1 GROUP BY d`),
    active: bucket(`SELECT CAST((t - ?1) / ${ADAY} AS INTEGER) d, COUNT(DISTINCT u) n FROM (${ACTIVITY}) WHERE t >= ?1 GROUP BY d`),
    posts: bucket(`SELECT ${dayExpr} d, COUNT(*) n FROM posts WHERE created_at >= ?1 GROUP BY d`),
    messages: bucket(`SELECT ${dayExpr} d, COUNT(*) n FROM dm_messages WHERE kind = 'msg' AND created_at >= ?1 GROUP BY d`),
    gmv: bucket(`SELECT ${dayExpr} d, SUM(amount_cents + shipping_cents) n FROM orders WHERE status IN ${PAID} AND created_at >= ?1 GROUP BY d`),
  };

  const labs = db.prepare(`
    SELECT channel, COUNT(*) posts, COUNT(DISTINCT author_id) people, MAX(created_at) last
    FROM posts WHERE created_at >= ? AND channel != 'profile' GROUP BY channel ORDER BY posts DESC`).all(start);
  const top = db.prepare(`
    SELECT u.username, u.display_name, u.avatar_url, COUNT(*) n
    FROM (${ACTIVITY}) a JOIN users u ON u.id = a.u WHERE a.t >= ? GROUP BY a.u ORDER BY n DESC LIMIT 6`).all(start);

  res.json({
    days, start,
    now: windowStats(start, now), before: windowStats(prevStart, start),
    seen: aone(`SELECT COUNT(*) n FROM users WHERE last_seen_at >= ?`, start),
    totals: {
      members: aone(`SELECT COUNT(*) n FROM users`),
      collabs: aone(`SELECT COUNT(*) n FROM collaborators WHERE status = 'accepted'`),
      gmv: aone(`SELECT COALESCE(SUM(amount_cents + shipping_cents), 0) n FROM orders WHERE status IN ${PAID}`),
    },
    series, loop: loopSteps(),
    labs: labs.map((l) => ({ channel: l.channel, posts: l.posts, people: l.people, last: l.last })),
    top: top.map((t) => ({ username: t.username, displayName: t.display_name, avatarUrl: t.avatar_url || "", n: t.n })),
    inbox: inboxItems(now),
  });
});

/* What's waiting on you, most urgent first. Each item says where to act. */
function inboxItems(now) {
  const items = [];
  const reports = aone(`SELECT COUNT(*) n FROM reports WHERE handled_at IS NULL`);
  if (reports) items.push({ kind: "reports", level: "high", n: reports, text: `${reports} open report${reports === 1 ? "" : "s"}`, go: "content" });
  const unshipped = db.prepare(`SELECT o.id, l.title, s.username seller, o.created_at FROM orders o JOIN listings l ON l.id = o.listing_id
    JOIN users s ON s.id = o.seller_id WHERE o.status = 'paid' AND o.created_at < ? ORDER BY o.created_at LIMIT 5`).all(now - 3 * ADAY);
  if (unshipped.length) items.push({ kind: "unshipped", level: "high", n: unshipped.length,
    text: `${unshipped.length} paid order${unshipped.length === 1 ? "" : "s"} not shipped after 3 days`, go: "market",
    people: unshipped.map((o) => o.seller) });
  const lastBackup = (() => { try { return Math.max(0, ...readdirSync(join(DATA_DIR, "backups")).filter((f) => f.endsWith(".db"))
    .map((f) => statSync(join(DATA_DIR, "backups", f)).mtimeMs)); } catch { return 0; } })();
  if (now - lastBackup > 36 * 3600000) items.push({ kind: "backup", level: "high", text: lastBackup ? "No backup in 36 hours" : "No backups yet", go: "system" });
  const errors = aone(`SELECT COUNT(*) n FROM error_log WHERE created_at > ?`, now - ADAY);
  if (errors) items.push({ kind: "errors", level: errors > 20 ? "high" : "mid", n: errors, text: `${errors} error${errors === 1 ? "" : "s"} in the last 24h`, go: "system" });
  const pending = aone(`SELECT COUNT(*) n FROM collaborators WHERE status = 'pending' AND created_at < ?`, now - 3 * ADAY);
  if (pending) items.push({ kind: "collabs", level: "mid", n: pending, text: `${pending} collab invite${pending === 1 ? "" : "s"} waiting 3+ days`, go: "people" });
  const fresh = db.prepare(`SELECT username, display_name, avatar_url FROM users u WHERE created_at > ? AND suspended = 0
    AND NOT EXISTS (SELECT 1 FROM posts p WHERE p.author_id = u.id) ORDER BY created_at DESC LIMIT 12`).all(now - 7 * ADAY);
  if (fresh.length) items.push({ kind: "welcome", level: "mid", n: fresh.length, text: `${fresh.length} new member${fresh.length === 1 ? "" : "s"} haven't posted yet — say hi`,
    people: fresh.map((u) => u.username), go: "people" });
  const unverified = aone(`SELECT COUNT(*) n FROM users WHERE email_verified = 0 AND created_at < ?`, now - ADAY);
  if (unverified) items.push({ kind: "unverified", level: "low", n: unverified, text: `${unverified} member${unverified === 1 ? "" : "s"} never confirmed their email`, go: "system" });
  return items;
}

/* ---- people ---- */
const PEOPLE_SORT = { joined: "u.created_at DESC", rep: "u.rep DESC", posts: "posts DESC", sales: "gross DESC" };
app.get("/api/admin/people", auth, admin, (req, res) => {
  const now = Date.now();
  const term = (req.query.q || "").toString().toLowerCase().slice(0, 60);
  const filter = String(req.query.filter || "all");
  const where = [], params = [];
  if (term) { where.push(`(LOWER(u.username) LIKE ? OR LOWER(u.display_name) LIKE ? OR LOWER(u.email) LIKE ?)`); params.push(`%${term}%`, `%${term}%`, `%${term}%`); }
  const F = {
    new: [`u.created_at > ?`, [now - 7 * ADAY]],
    silent: [`posts = 0`, []],
    quiet: [`posts > 0`, []],   // + no activity in 14 days, applied below
    sellers: [`listings > 0`, []],
    admins: [`u.is_admin = 1`, []],
    suspended: [`u.suspended = 1`, []],
    unverified: [`u.email_verified = 0`, []],
  }[filter];
  const rows = db.prepare(`
    SELECT * FROM (
      SELECT u.id, u.username, u.display_name, u.email, u.avatar_url, u.role, u.rep, u.email_verified, u.is_admin,
             u.suspended, u.stripe_ready, u.created_at, u.last_seen_at,
        (SELECT COUNT(*) FROM posts p WHERE p.author_id = u.id) posts,
        (SELECT COUNT(*) FROM listings l WHERE l.seller_id = u.id) listings,
        (SELECT COUNT(*) FROM collaborators c WHERE c.user_id = u.id AND c.status = 'accepted') collabs,
        (SELECT COUNT(*) FROM follows f WHERE f.followee_id = u.id) followers,
        (SELECT COALESCE(SUM(o.amount_cents), 0) FROM orders o WHERE o.seller_id = u.id AND o.status IN ${PAID}) gross,
        (SELECT 1 FROM admin_notes n WHERE n.user_id = u.id AND n.body != '') has_note
      FROM users u ${where.length ? "WHERE " + where.join(" AND ") : ""}
    ) u ${F ? "WHERE " + F[0] : ""}
    ORDER BY ${req.query.sort === "active" ? PEOPLE_SORT.joined : PEOPLE_SORT[req.query.sort] || PEOPLE_SORT.joined} LIMIT 500`).all(...params, ...(F ? F[1] : []));
  // last activity for everyone in one pass, not one scan per person
  const last = new Map(db.prepare(`SELECT u, MAX(t) t FROM (${ACTIVITY}) GROUP BY u`).all().map((r) => [r.u, r.t]));
  for (const r of rows) r.last_active = last.get(r.id) || null;
  let list = rows;
  if (filter === "quiet") list = list.filter((r) => (r.last_active || 0) < now - 14 * ADAY);
  if (req.query.sort === "active") list = [...list].sort((a, b) => (b.last_active || 0) - (a.last_active || 0));
  res.json({ people: list.slice(0, 300).map((r) => ({
    username: r.username, displayName: r.display_name, email: r.email, avatarUrl: r.avatar_url || "", role: r.role,
    rep: r.rep, level: levelFor(r.rep).id, levelName: levelFor(r.rep).name,
    verified: !!r.email_verified, isAdmin: !!r.is_admin, suspended: !!r.suspended, payouts: !!r.stripe_ready,
    joined: r.created_at, lastSeen: r.last_seen_at || null, lastActive: r.last_active || null,
    posts: r.posts, listings: r.listings, collabs: r.collabs, followers: r.followers, gross: r.gross, note: !!r.has_note,
  })) });
});

app.get("/api/admin/people/:username", auth, admin, (req, res) => {
  const u = q.userByName.get(req.params.username);
  if (!u) return res.status(404).json({ error: "no such user" });
  const id = u.id;
  const note = db.prepare(`SELECT n.body, n.updated_at, a.username by_name FROM admin_notes n LEFT JOIN users a ON a.id = n.updated_by WHERE n.user_id = ?`).get(id);
  res.json({
    person: {
      username: u.username, displayName: u.display_name, email: u.email, avatarUrl: u.avatar_url || "", role: u.role, bio: u.bio || "",
      rep: u.rep, level: levelFor(u.rep).id, levelName: levelFor(u.rep).name, fee: feeForRep(u.rep),
      verified: !!u.email_verified, isAdmin: !!u.is_admin, suspended: !!u.suspended, payouts: !!u.stripe_ready,
      joined: u.created_at, lastSeen: u.last_seen_at || null,
    },
    stats: {
      posts: aone(`SELECT COUNT(*) n FROM posts WHERE author_id = ?`, id),
      work: aone(`SELECT COUNT(*) n FROM posts WHERE author_id = ? AND is_work = 1`, id),
      likesGot: aone(`SELECT COUNT(*) n FROM likes l JOIN posts p ON p.id = l.post_id WHERE p.author_id = ? AND l.user_id != ?`, id, id),
      commentsGot: aone(`SELECT COUNT(*) n FROM comments c JOIN posts p ON p.id = c.post_id WHERE p.author_id = ? AND c.author_id != ?`, id, id),
      feedbackGiven: aone(`SELECT (SELECT COUNT(*) FROM comments WHERE author_id = ?1) + (SELECT COUNT(*) FROM likes WHERE user_id = ?1) n`, id),
      messages: aone(`SELECT COUNT(*) n FROM dm_messages WHERE sender_id = ? AND kind = 'msg'`, id),
      chats: aone(`SELECT COUNT(*) n FROM dm_members WHERE user_id = ? AND left_at IS NULL`, id),
      followers: aone(`SELECT COUNT(*) n FROM follows WHERE followee_id = ?`, id),
      following: aone(`SELECT COUNT(*) n FROM follows WHERE follower_id = ?`, id),
      collabs: aone(`SELECT COUNT(*) n FROM collaborators WHERE user_id = ? AND status = 'accepted'`, id),
      pendingCollabs: aone(`SELECT COUNT(*) n FROM collaborators WHERE user_id = ? AND status = 'pending'`, id),
      listings: aone(`SELECT COUNT(*) n FROM listings WHERE seller_id = ? AND status = 'active'`, id),
      sold: aone(`SELECT COUNT(*) n FROM orders WHERE seller_id = ? AND status IN ${PAID}`, id),
      gross: aone(`SELECT COALESCE(SUM(amount_cents), 0) n FROM orders WHERE seller_id = ? AND status IN ${PAID}`, id),
      bought: aone(`SELECT COUNT(*) n FROM orders WHERE buyer_id = ? AND status IN ${PAID}`, id),
      reportsAgainst: aone(`SELECT COUNT(*) n FROM reports r LEFT JOIN posts p ON p.id = r.post_id WHERE r.user_id = ? OR p.author_id = ?`, id, id),
      blockedBy: aone(`SELECT COUNT(*) n FROM blocks WHERE blocked_id = ?`, id),
      sessions: aone(`SELECT COUNT(*) n FROM sessions WHERE user_id = ?`, id),
    },
    posts: db.prepare(`SELECT p.id, p.channel, p.body, p.thumb_url, p.image_url, p.video_url, p.is_work, p.created_at,
      (SELECT COUNT(*) FROM likes l WHERE l.post_id = p.id) likes FROM posts p WHERE p.author_id = ? ORDER BY p.created_at DESC LIMIT 9`).all(id)
      .map((p) => ({ id: p.id, channel: p.channel, body: (p.body || "").slice(0, 160), thumbUrl: p.thumb_url || p.image_url || null,
        video: !!p.video_url, isWork: !!p.is_work, createdAt: p.created_at, likes: p.likes })),
    rep: db.prepare(`SELECT kind, amount, created_at FROM rep_events WHERE user_id = ? ORDER BY created_at DESC LIMIT 12`).all(id)
      .map((r) => ({ kind: r.kind, amount: r.amount, at: r.created_at })),
    note: note ? { body: note.body, at: note.updated_at, by: note.by_name || "" } : null,
  });
});

app.post("/api/admin/people/:username/note", auth, admin, (req, res) => {
  const u = q.userByName.get(req.params.username);
  if (!u) return res.status(404).json({ error: "no such user" });
  const body = (req.body?.body ?? "").toString().slice(0, 2000);
  db.prepare(`INSERT INTO admin_notes (user_id, body, updated_by, updated_at) VALUES (?,?,?,?)
    ON CONFLICT(user_id) DO UPDATE SET body = excluded.body, updated_by = excluded.updated_by, updated_at = excluded.updated_at`)
    .run(u.id, body, req.user.id, Date.now());
  res.json({ ok: true });
});

/* Sign someone out on every device — for a lost phone or a shared login. */
app.post("/api/admin/people/:username/signout", auth, admin, (req, res) => {
  const u = q.userByName.get(req.params.username);
  if (!u) return res.status(404).json({ error: "no such user" });
  const n = db.prepare(`DELETE FROM sessions WHERE user_id = ?`).run(u.id).changes;
  res.json({ ok: true, sessions: n });
});

/* ---- content ---- */
app.get("/api/admin/posts", auth, admin, (req, res) => {
  const where = [], params = [];
  const ch = (req.query.channel || "").toString().slice(0, 40);
  const term = (req.query.q || "").toString().toLowerCase().slice(0, 60);
  if (ch) { where.push(`p.channel = ?`); params.push(ch); }
  if (term) { where.push(`(LOWER(p.body) LIKE ? OR LOWER(u.username) LIKE ?)`); params.push(`%${term}%`, `%${term}%`); }
  if (req.query.kind === "work") where.push(`p.is_work = 1`);
  if (req.query.kind === "talk") where.push(`p.is_work = 0`);
  if (req.query.kind === "reported") where.push(`EXISTS (SELECT 1 FROM reports r WHERE r.post_id = p.id AND r.handled_at IS NULL)`);
  const before = Number(req.query.before) || 0;
  if (before) { where.push(`p.created_at < ?`); params.push(before); }
  const rows = db.prepare(`
    SELECT p.id, p.channel, p.body, p.image_url, p.thumb_url, p.video_url, p.beat_json, p.is_work, p.created_at,
           u.username, u.display_name, u.avatar_url,
      (SELECT COUNT(*) FROM likes l WHERE l.post_id = p.id) likes,
      (SELECT COUNT(*) FROM comments c WHERE c.post_id = p.id) comments,
      (SELECT COUNT(*) FROM reports r WHERE r.post_id = p.id AND r.handled_at IS NULL) reports,
      (SELECT 1 FROM channel_pins cp WHERE cp.post_id = p.id) pinned
    FROM posts p JOIN users u ON u.id = p.author_id ${where.length ? "WHERE " + where.join(" AND ") : ""}
    ORDER BY p.created_at DESC LIMIT 60`).all(...params);
  const channels = db.prepare(`SELECT channel, COUNT(*) n FROM posts GROUP BY channel ORDER BY n DESC`).all();
  res.json({
    posts: rows.map((r) => ({ id: r.id, channel: r.channel, body: r.body, thumbUrl: r.thumb_url || r.image_url || null,
      video: !!r.video_url, beat: !!r.beat_json, isWork: !!r.is_work, createdAt: r.created_at, likes: r.likes, comments: r.comments,
      reports: r.reports, pinned: !!r.pinned,
      author: { username: r.username, displayName: r.display_name, avatarUrl: r.avatar_url || "" } })),
    channels,
  });
});

app.get("/api/admin/log", auth, admin, (req, res) => {
  const rows = db.prepare(`SELECT l.*, u.username FROM admin_log l LEFT JOIN users u ON u.id = l.admin_id ORDER BY l.id DESC LIMIT 150`).all();
  res.json({ log: rows.map((r) => ({ id: r.id, by: r.username || "", action: r.action, target: r.target, detail: r.detail, at: r.created_at })) });
});
