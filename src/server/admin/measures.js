/* ================================================================
   THE DICTIONARY v1.0 — 2026-11-15. "Improve the admin dashboard to meet
   Google level analytics. From the data collection to how it's organised,
   categorised and worded." The first step: one meaning for every number.
   The dashboard said 7 active where another card said 277, counted
   suspended accounts in some totals and not others, and added shipping
   to sales in one place and left it out in the next.
   Every number the admin, the Monday email, Echo and the connector read
   is made from the pieces here, and MEASURES is the wording for each —
   the name on the card and one line saying exactly what it counts
   (GET /api/admin/measures; the Analytics page prints it).
   A new number gets a line here first. test/measures.test.mjs fails when
   a route goes back to counting on its own.
   Counts only — nothing here reads a message, an email or a place.
================================================================ */
const M_DAY = 86400000;
const M_PAID = `('paid','shipped','complete')`;
/* A member is someone who joined and isn't suspended (spam accounts aren't members). */
const M_MEMBER = `COALESCE(suspended, 0) = 0`;
const M_IS_MEMBER = `(SELECT id FROM users WHERE ${M_MEMBER})`;
/* Took part: did something other people can see or feel. (u, t) rows. */
const M_ACT = `
  SELECT author_id u, created_at t FROM posts
  UNION ALL SELECT author_id, created_at FROM comments
  UNION ALL SELECT user_id, created_at FROM likes
  UNION ALL SELECT user_id, created_at FROM reactions
  UNION ALL SELECT follower_id, created_at FROM follows
  UNION ALL SELECT sender_id, created_at FROM dm_messages WHERE kind = 'msg'
  UNION ALL SELECT voter_id, created_at FROM event_votes
  UNION ALL SELECT user_id, created_at FROM event_entries`;
/* Sales are what buyers paid for the pieces — the price the fee is taken on, never shipping. */
const M_SALE = `amount_cents`;

const MEASURES = [
  { id: "members", name: "Members", says: "Everyone who joined. Suspended accounts aren't counted." },
  { id: "joined", name: "Joined", says: "New members in the period." },
  { id: "confirmed", name: "Email confirmed", says: "Members who confirmed their email. LABS can reach them without Instagram." },
  { id: "opened", name: "Opened the app", says: "Members who used LABS signed in, on at least one day in the period. Counted since 29 Oct." },
  { id: "tookPart", name: "Took part", says: "Members who did something: posted, gave feedback, liked, reacted, followed, messaged, voted or entered." },
  { id: "cameBack", name: "Came back", says: "Opened the app or did anything, a day or more after joining." },
  { id: "posted", name: "Posted", says: "Members who posted anything, work or talk." },
  { id: "work", name: "Work posted", says: "Pieces of work posted. Talk in a lab isn't work." },
  { id: "feedback", name: "Feedback", says: "Likes, comments and reactions on what people posted." },
  { id: "messages", name: "Messages", says: "Messages members sent each other. Counted, never read." },
  { id: "votes", name: "Tournament votes", says: "Votes cast in the app." },
  { id: "collabs", name: "Collabs", says: "Collabs the other person accepted." },
  { id: "orders", name: "Orders", says: "Orders that were paid for." },
  { id: "sales", name: "Sales", says: "What buyers paid for the pieces, before shipping." },
  { id: "fees", name: "Fees earned", says: "LABS's share of each sale." },
  { id: "period", name: "The period", says: "The last 7, 30 or 90 days, counted from midnight your time, today included. Each is compared with the same number of days before it." },
];

const mOne = (sql, ...p) => { try { return db.prepare(sql).get(...p)?.n ?? 0; } catch (e) { return 0; } };
const mDayOf = (t) => Math.floor(t / M_DAY);
/* Each takes a window (from, to] in ms; leave it out for all time. */
const M = {
  members: () => mOne(`SELECT COUNT(*) n FROM users WHERE ${M_MEMBER}`),
  confirmed: () => mOne(`SELECT COUNT(*) n FROM users WHERE email_verified = 1 AND ${M_MEMBER}`),
  joined: (a = 0, b = Date.now()) => mOne(`SELECT COUNT(*) n FROM users WHERE ${M_MEMBER} AND created_at > ? AND created_at <= ?`, a, b),
  opened: (a = 0, b = Date.now()) => mOne(`SELECT COUNT(DISTINCT user_id) n FROM member_days WHERE day >= ? AND day <= ? AND user_id IN ${M_IS_MEMBER}`, mDayOf(a), mDayOf(b)),
  tookPart: (a = 0, b = Date.now()) => mOne(`SELECT COUNT(DISTINCT u) n FROM (${M_ACT}) WHERE t > ? AND t <= ? AND u IN ${M_IS_MEMBER}`, a, b),
  posted: (a = 0, b = Date.now()) => mOne(`SELECT COUNT(DISTINCT author_id) n FROM posts WHERE created_at > ? AND created_at <= ? AND author_id IN ${M_IS_MEMBER}`, a, b),
  work: (a = 0, b = Date.now()) => mOne(`SELECT COUNT(*) n FROM posts WHERE is_work = 1 AND created_at > ? AND created_at <= ?`, a, b),
  feedback: (a = 0, b = Date.now()) => mOne(`SELECT (SELECT COUNT(*) FROM comments WHERE created_at > ?1 AND created_at <= ?2)
    + (SELECT COUNT(*) FROM likes WHERE created_at > ?1 AND created_at <= ?2)
    + (SELECT COUNT(*) FROM reactions WHERE created_at > ?1 AND created_at <= ?2) n`, a, b),
  messages: (a = 0, b = Date.now()) => mOne(`SELECT COUNT(*) n FROM dm_messages WHERE kind = 'msg' AND created_at > ? AND created_at <= ?`, a, b),
  votes: (a = 0, b = Date.now()) => mOne(`SELECT COUNT(*) n FROM event_votes WHERE created_at > ? AND created_at <= ?`, a, b),
  collabs: (a = 0, b = Date.now()) => mOne(`SELECT COUNT(*) n FROM collaborators WHERE status = 'accepted' AND created_at > ? AND created_at <= ?`, a, b),
  orders: (a = 0, b = Date.now()) => mOne(`SELECT COUNT(*) n FROM orders WHERE status IN ${M_PAID} AND created_at > ? AND created_at <= ?`, a, b),
  sales: (a = 0, b = Date.now()) => mOne(`SELECT COALESCE(SUM(${M_SALE}), 0) n FROM orders WHERE status IN ${M_PAID} AND created_at > ? AND created_at <= ?`, a, b),
};

/* The period: `days` days back from the admin's local midnight, today included,
   and the same length before it. tz is Date#getTimezoneOffset (minutes). */
function mWindow(q = {}, now = Date.now(), allowed = [7, 30, 90]) {
  const asked = Math.round(Number(q.days) || 0);
  const days = allowed ? (allowed.includes(asked) ? asked : 30) : Math.max(1, Math.min(365, asked || 30));
  const tz = Math.max(-840, Math.min(840, Number(q.tz) || 0)) * 60000;
  const start = Math.floor((now - tz) / M_DAY) * M_DAY + tz - (days - 1) * M_DAY;
  return { days, tz, start, prevStart: start - days * M_DAY };
}

app.get("/api/admin/measures", auth, admin, (req, res) => res.json({ measures: MEASURES }));
