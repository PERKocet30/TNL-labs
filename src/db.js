import { DatabaseSync } from "node:sqlite";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { mkdirSync, existsSync } from "node:fs";

const __dirname = dirname(fileURLToPath(import.meta.url));

/* DATA DURABILITY — this is the setting that decides whether accounts
   and posts survive a redeploy. On Railway/Render, mount a volume and
   set TNL_DATA to its path; the database and uploads both live there. */
export const DATA_DIR = process.env.TNL_DATA || join(__dirname, "..");
if (!existsSync(DATA_DIR)) mkdirSync(DATA_DIR, { recursive: true });
const DB_PATH = process.env.TNL_DB || join(DATA_DIR, "tnl.db");

export const db = new DatabaseSync(DB_PATH);
console.log("[db] using", DB_PATH);

/* ----------------------------------------------------------------
   Schema. Rep is DERIVED from rep_events (an append-only audit log)
   and denormalized onto users.rep for fast reads. This keeps the
   progression system honest — every point is traceable to a real,
   validated action, never to raw posting volume.
---------------------------------------------------------------- */
db.exec(`
PRAGMA journal_mode = WAL;
PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS users (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  username     TEXT NOT NULL UNIQUE,
  display_name TEXT NOT NULL,
  email        TEXT NOT NULL UNIQUE,
  role         TEXT NOT NULL DEFAULT 'Member',
  roles        TEXT NOT NULL DEFAULT '[]',
  avatar_url   TEXT NOT NULL DEFAULT '',
  password_hash TEXT NOT NULL,
  rep          INTEGER NOT NULL DEFAULT 0,
  bio          TEXT NOT NULL DEFAULT '',
  link         TEXT NOT NULL DEFAULT '',
  email_verified INTEGER NOT NULL DEFAULT 0,
  published    INTEGER NOT NULL DEFAULT 0,
  created_at   INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS verify_tokens (
  token      TEXT PRIMARY KEY,
  user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expires_at INTEGER NOT NULL,
  created_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS sessions (
  token      TEXT PRIMARY KEY,
  user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS posts (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  author_id   INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  channel     TEXT NOT NULL DEFAULT 'general',
  body        TEXT NOT NULL DEFAULT '',
  beat_json   TEXT,                 -- serialized Beat Lab pattern, if any
  image_url   TEXT,                 -- optional attached work
  video_url   TEXT,                 -- optional attached video
  is_work     INTEGER NOT NULL DEFAULT 0,  -- 1 = published to portfolio/showroom
  edited_at   INTEGER,              -- set when the author edits the body
  shared_from INTEGER REFERENCES posts(id) ON DELETE SET NULL, -- if this is a reshare
  created_at  INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS likes (
  post_id    INTEGER NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at INTEGER NOT NULL,
  PRIMARY KEY (post_id, user_id)
);

CREATE TABLE IF NOT EXISTS collaborators (
  post_id    INTEGER NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  status     TEXT NOT NULL DEFAULT 'pending',  -- pending | accepted
  created_at INTEGER NOT NULL,
  PRIMARY KEY (post_id, user_id)
);

CREATE TABLE IF NOT EXISTS follows (
  follower_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  followee_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at  INTEGER NOT NULL,
  PRIMARY KEY (follower_id, followee_id)
);

CREATE TABLE IF NOT EXISTS rep_events (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  kind       TEXT NOT NULL,        -- like_received | share_received | collab_accepted | feature
  amount     INTEGER NOT NULL,
  source_id  INTEGER,              -- e.g. post id or actor id, for auditing
  created_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS beat_projects (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name       TEXT NOT NULL DEFAULT 'untitled',
  data       TEXT NOT NULL,
  updated_at INTEGER NOT NULL,
  created_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_beats_user ON beat_projects(user_id, updated_at);

CREATE TABLE IF NOT EXISTS comments (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  post_id    INTEGER NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  author_id  INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  body       TEXT NOT NULL,
  edited_at  INTEGER,
  created_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_comments_post ON comments(post_id, created_at);

CREATE TABLE IF NOT EXISTS notifications (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  actor_id   INTEGER REFERENCES users(id) ON DELETE CASCADE,
  kind       TEXT NOT NULL,          -- like | comment | collab_invite | collab_accept | follow | dm
  post_id    INTEGER REFERENCES posts(id) ON DELETE CASCADE,
  body       TEXT NOT NULL DEFAULT '',
  read_at    INTEGER,
  created_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_notifs ON notifications(user_id, created_at);

CREATE TABLE IF NOT EXISTS dm_threads (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  a_id       INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  b_id       INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  updated_at INTEGER NOT NULL,
  created_at INTEGER NOT NULL,
  UNIQUE(a_id, b_id)
);

CREATE TABLE IF NOT EXISTS dm_messages (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  thread_id  INTEGER NOT NULL REFERENCES dm_threads(id) ON DELETE CASCADE,
  sender_id  INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  body       TEXT NOT NULL DEFAULT '',
  image_url  TEXT,
  read_at    INTEGER,
  created_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_dm ON dm_messages(thread_id, created_at);

CREATE TABLE IF NOT EXISTS blocks (
  blocker_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  blocked_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at INTEGER NOT NULL,
  PRIMARY KEY (blocker_id, blocked_id)
);

CREATE TABLE IF NOT EXISTS reports (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  reporter_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  post_id    INTEGER REFERENCES posts(id) ON DELETE CASCADE,
  user_id    INTEGER REFERENCES users(id) ON DELETE CASCADE,
  reason     TEXT NOT NULL DEFAULT '',
  handled_at INTEGER,
  created_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS reset_tokens (
  token      TEXT PRIMARY KEY,
  user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expires_at INTEGER NOT NULL,
  created_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS listings (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  seller_id   INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title       TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  price_cents INTEGER NOT NULL,
  currency    TEXT NOT NULL DEFAULT 'USD',
  category    TEXT NOT NULL DEFAULT 'Other',
  brand       TEXT NOT NULL DEFAULT '',
  size        TEXT NOT NULL DEFAULT '',
  condition   TEXT NOT NULL DEFAULT 'Good',
  colour      TEXT NOT NULL DEFAULT '',
  images      TEXT NOT NULL DEFAULT '[]',
  ships_from  TEXT NOT NULL DEFAULT '',
  shipping_cents INTEGER NOT NULL DEFAULT 0,
  accepts_offers INTEGER NOT NULL DEFAULT 1,
  status      TEXT NOT NULL DEFAULT 'active',   -- active | sold | removed
  views       INTEGER NOT NULL DEFAULT 0,
  created_at  INTEGER NOT NULL,
  updated_at  INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_listings ON listings(status, created_at);
CREATE INDEX IF NOT EXISTS idx_listings_seller ON listings(seller_id, created_at);

CREATE TABLE IF NOT EXISTS listing_likes (
  listing_id INTEGER NOT NULL REFERENCES listings(id) ON DELETE CASCADE,
  user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at INTEGER NOT NULL,
  PRIMARY KEY (listing_id, user_id)
);

CREATE TABLE IF NOT EXISTS offers (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  listing_id  INTEGER NOT NULL REFERENCES listings(id) ON DELETE CASCADE,
  buyer_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  amount_cents INTEGER NOT NULL,
  status      TEXT NOT NULL DEFAULT 'pending',  -- pending | accepted | declined | withdrawn
  created_at  INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_offers ON offers(listing_id, created_at);

CREATE TABLE IF NOT EXISTS orders (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  listing_id  INTEGER NOT NULL REFERENCES listings(id) ON DELETE CASCADE,
  buyer_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  seller_id   INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  amount_cents INTEGER NOT NULL,
  shipping_cents INTEGER NOT NULL DEFAULT 0,
  status      TEXT NOT NULL DEFAULT 'pending',  -- pending | paid | shipped | complete | cancelled
  payment_ref TEXT,                              -- stripe session id, when used
  ship_name   TEXT NOT NULL DEFAULT '',
  ship_address TEXT NOT NULL DEFAULT '',
  tracking    TEXT NOT NULL DEFAULT '',
  created_at  INTEGER NOT NULL,
  updated_at  INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_orders_buyer ON orders(buyer_id, created_at);
CREATE INDEX IF NOT EXISTS idx_orders_seller ON orders(seller_id, created_at);

CREATE INDEX IF NOT EXISTS idx_posts_channel ON posts(channel, created_at);
CREATE INDEX IF NOT EXISTS idx_posts_author  ON posts(author_id, created_at);
CREATE INDEX IF NOT EXISTS idx_rep_user      ON rep_events(user_id, created_at);
`);

/* Migrations — safe to run on an existing database. SQLite has no
   "ADD COLUMN IF NOT EXISTS", so we check the table info first. */
const cols = db.prepare(`PRAGMA table_info(users)`).all().map((c) => c.name);
if (!cols.includes("bio")) db.exec(`ALTER TABLE users ADD COLUMN bio TEXT NOT NULL DEFAULT ''`);
if (!cols.includes("link")) db.exec(`ALTER TABLE users ADD COLUMN link TEXT NOT NULL DEFAULT ''`);
if (!cols.includes("email_verified")) {
  db.exec(`ALTER TABLE users ADD COLUMN email_verified INTEGER NOT NULL DEFAULT 0`);
  // Grandfather anyone who signed up before verification existed — locking
  // out current members to introduce a new rule would be hostile.
  const n = db.prepare(`SELECT COUNT(*) n FROM users`).get().n;
  if (n > 0) {
    db.exec(`UPDATE users SET email_verified = 1`);
    console.log(`[db] grandfathered ${n} existing account(s) as verified`);
  }
}
if (!cols.includes("published")) db.exec(`ALTER TABLE users ADD COLUMN published INTEGER NOT NULL DEFAULT 0`);
if (!cols.includes("avatar_url")) db.exec(`ALTER TABLE users ADD COLUMN avatar_url TEXT NOT NULL DEFAULT ''`);
if (!cols.includes("roles")) {
  db.exec(`ALTER TABLE users ADD COLUMN roles TEXT NOT NULL DEFAULT '[]'`);
  // carry each member's single role into the new multi-role field
  const rows = db.prepare(`SELECT id, role FROM users`).all();
  const set = db.prepare(`UPDATE users SET roles = ? WHERE id = ?`);
  for (const r of rows) set.run(JSON.stringify(r.role ? [r.role] : []), r.id);
  if (rows.length) console.log(`[db] migrated ${rows.length} member role(s) to multi-role`);
}

const pcols = db.prepare(`PRAGMA table_info(posts)`).all().map((c) => c.name);
if (!pcols.includes("video_url")) db.exec(`ALTER TABLE posts ADD COLUMN video_url TEXT`);
if (!pcols.includes("edited_at")) db.exec(`ALTER TABLE posts ADD COLUMN edited_at INTEGER`);
if (!pcols.includes("is_work")) {
  db.exec(`ALTER TABLE posts ADD COLUMN is_work INTEGER NOT NULL DEFAULT 0`);
  // everything with media that already existed was, in effect, published work
  const n = db.prepare(`UPDATE posts SET is_work = 1 WHERE image_url IS NOT NULL OR beat_json IS NOT NULL`).run().changes;
  if (n) console.log(`[db] marked ${n} existing media post(s) as portfolio work`);
}

if (!cols.includes("stripe_account")) db.exec(`ALTER TABLE users ADD COLUMN stripe_account TEXT NOT NULL DEFAULT ''`);
if (!cols.includes("stripe_ready")) db.exec(`ALTER TABLE users ADD COLUMN stripe_ready INTEGER NOT NULL DEFAULT 0`);
if (!cols.includes("is_admin")) db.exec(`ALTER TABLE users ADD COLUMN is_admin INTEGER NOT NULL DEFAULT 0`);

/** The founder needs moderation powers. Runs on every boot so it works on
 *  a fresh install too, not just on migration. No-op once an admin exists. */
export function ensureAdmin() {
  const has = db.prepare(`SELECT COUNT(*) n FROM users WHERE is_admin = 1`).get().n;
  if (has) return;
  const first = db.prepare(`SELECT id, username FROM users ORDER BY id LIMIT 1`).get();
  if (!first) return; // no accounts yet — runs again after the first signup
  db.prepare(`UPDATE users SET is_admin = 1 WHERE id = ?`).run(first.id);
  console.log(`[db] @${first.username} promoted to admin (first account)`);
}
ensureAdmin();

/* ---- notifications ---- */
const insNotif = db.prepare(
  `INSERT INTO notifications (user_id, actor_id, kind, post_id, body, created_at) VALUES (?, ?, ?, ?, ?, ?)`
);
/** Never notify someone about their own action. Returns the row id or null. */
export function notify(userId, actorId, kind, postId = null, body = "") {
  if (!userId || userId === actorId) return null;
  const info = insNotif.run(userId, actorId, kind, postId, body, Date.now());
  return Number(info.lastInsertRowid);
}

/* ---- rep rules — the ONLY ways rep is created ---- */
export const REP = {
  like_received: 6,     // someone validated your work
  share_received: 3,    // your work was worth re-circulating
  collab_accepted: 20,  // a confirmed, two-sided collaboration
  feature: 40,          // founder/mod feature (manual)
};

const insertRepEvent = db.prepare(
  `INSERT INTO rep_events (user_id, kind, amount, source_id, created_at) VALUES (?, ?, ?, ?, ?)`
);
const bumpRep = db.prepare(`UPDATE users SET rep = rep + ? WHERE id = ?`);

/** Award rep to a user, recording an auditable event. Never awards to self-actions. */
export function awardRep(userId, kind, sourceId = null) {
  const amount = REP[kind];
  if (!amount) throw new Error("unknown rep kind: " + kind);
  const now = Date.now();
  insertRepEvent.run(userId, kind, amount, sourceId, now);
  bumpRep.run(amount, userId);
  return amount;
}

/** Remove a previously-awarded rep event (e.g. an unlike). */
export function revokeRep(userId, kind, sourceId = null) {
  const amount = REP[kind];
  if (!amount) return 0;
  const now = Date.now();
  insertRepEvent.run(userId, kind, -amount, sourceId, now);
  bumpRep.run(-amount, userId);
  return -amount;
}

/* ---- progression ladder — rep maps to levels ---- */
export const LEVELS = [
  { id: 1, name: "Entry", at: 0 },
  { id: 2, name: "Verified", at: 40 },
  { id: 3, name: "Collaborator", at: 120 },
  { id: 4, name: "Core", at: 280 },
  { id: 5, name: "Leadership", at: 560 },
];
export function levelFor(rep) {
  return LEVELS.reduce((a, l) => (rep >= l.at ? l : a), LEVELS[0]);
}
