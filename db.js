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
