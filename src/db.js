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

CREATE TABLE IF NOT EXISTS channel_reads (
  user_id      INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  channel      TEXT NOT NULL,
  last_read_at INTEGER NOT NULL,
  PRIMARY KEY (user_id, channel)
);

/* A marketplace without reviews is a leap of faith. Depop and eBay both
   live on this: it's the only reason a stranger buys from a stranger.
   One review per order, only after delivery is confirmed, so it can't be
   faked without a real paid transaction behind it. */
CREATE TABLE IF NOT EXISTS reviews (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  order_id   INTEGER NOT NULL UNIQUE REFERENCES orders(id) ON DELETE CASCADE,
  seller_id  INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  buyer_id   INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  stars      INTEGER NOT NULL,
  body       TEXT NOT NULL DEFAULT '',
  created_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_reviews_seller ON reviews(seller_id, created_at);

/* "Recently viewed" and "X views" both need this, and it's how we'd ever
   know which listings get looked at but never bought. */
CREATE TABLE IF NOT EXISTS listing_views (
  listing_id INTEGER NOT NULL REFERENCES listings(id) ON DELETE CASCADE,
  user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  viewed_at  INTEGER NOT NULL,
  PRIMARY KEY (listing_id, user_id)
);
CREATE INDEX IF NOT EXISTS idx_views_user ON listing_views(user_id, viewed_at);

/* A producer's own sounds. The Studio synthesises everything, which is
   great for opening instantly and useless if you have a kit you actually
   like. Uploaded once, droppable onto any track, in any project. */
CREATE TABLE IF NOT EXISTS samples (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name       TEXT NOT NULL,
  url        TEXT NOT NULL,
  kit        TEXT NOT NULL DEFAULT '',      -- optional grouping: "808 Mafia", "my kit"
  slot       TEXT NOT NULL DEFAULT '',      -- kick | snare | hat | clap | perc | bass | other
  bytes      INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_samples_user ON samples(user_id, created_at);

/* Who used whose sound. This is what makes the library a network instead of
   a folder: a producer can see that 12 people built with their kick, and
   those 12 people know whose kick it was.

   One row per person per sample — using the same kick in ten beats is one
   endorsement, not ten. Same rule as likes. */
CREATE TABLE IF NOT EXISTS sample_uses (
  sample_id  INTEGER NOT NULL REFERENCES samples(id) ON DELETE CASCADE,
  user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at INTEGER NOT NULL,
  PRIMARY KEY (sample_id, user_id)
);
CREATE INDEX IF NOT EXISTS idx_uses_sample ON sample_uses(sample_id);

/* Downloads of free loops. Not for rep — it's farmable — but a producer
   deserves to know their loop got used, and it's the seed of a collab. */
CREATE TABLE IF NOT EXISTS loop_downloads (
  listing_id INTEGER NOT NULL REFERENCES listings(id) ON DELETE CASCADE,
  user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at INTEGER NOT NULL,
  PRIMARY KEY (listing_id, user_id)
);

/* Things you should be able to change without me and without a deploy.
   Everything here was hardcoded — the tagline, whether signups are open,
   the commission floor. That meant every copy tweak was a code change,
   which is exactly the dependency you don't want. */
CREATE TABLE IF NOT EXISTS settings (
  key        TEXT PRIMARY KEY,
  value      TEXT NOT NULL,
  updated_at INTEGER NOT NULL,
  updated_by INTEGER
);

/* Right now you find out something's broken when a member tells you — which
   means most breakage is invisible and you only hear about the loud ones.
   This is a black box recorder: the last N failures, what request caused
   them, and who hit it. */
CREATE TABLE IF NOT EXISTS error_log (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  kind       TEXT NOT NULL,            -- server | client | mail | pay
  message    TEXT NOT NULL,
  detail     TEXT NOT NULL DEFAULT '',
  path       TEXT NOT NULL DEFAULT '',
  username   TEXT NOT NULL DEFAULT '',
  created_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_errors_time ON error_log(created_at);

/* What the studio learns from being used.

   METADATA ONLY. Never the audio, never any analysis of what someone's
   music sounds like — a producer's kit is their work, and they didn't
   agree to it being mined. What's fair game is HOW the tool gets used:
   which built-in sounds people throw away, what formats they bring, where
   they give up.

   The most valuable row in here is the "voice_replaced" event: when
   someone swaps my kick
   for their own, that's a producer telling me my kick is bad by voting
   with their own file. No survey gets you that. */
CREATE TABLE IF NOT EXISTS studio_events (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id    INTEGER REFERENCES users(id) ON DELETE SET NULL,
  kind       TEXT NOT NULL,        -- open|play|save|publish|export|sample_upload|voice_replaced|abandon
  voice      TEXT NOT NULL DEFAULT '',   -- which built-in voice, when relevant
  fmt        TEXT NOT NULL DEFAULT '',   -- wav|mp3|aiff|m4a…
  bytes      INTEGER NOT NULL DEFAULT 0,
  bpm        INTEGER,
  musical_key TEXT NOT NULL DEFAULT '',
  detail     TEXT NOT NULL DEFAULT '',
  created_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_studio_kind ON studio_events(kind, created_at);
CREATE INDEX IF NOT EXISTS idx_studio_user ON studio_events(user_id, created_at);

/* The SHAPE of what producers upload — never the audio.

   The browser already decodes every sample to play it. While it's decoded
   we measure it: fundamental, decay, brightness, peak. Only those numbers
   come back here. The file itself is theirs and stays theirs.

   Why it's worth having: if every kick producers upload lands at ~58Hz with
   a 340ms decay, and my synth kick runs 150→45Hz over 400ms, that's not an
   opinion about my kick being wrong — it's a measurement. This table is the
   spec for the built-in sounds.

   Disclosed in the studio. A quiet version of this would be mining. */
CREATE TABLE IF NOT EXISTS sample_shape (
  sample_id   INTEGER PRIMARY KEY REFERENCES samples(id) ON DELETE CASCADE,
  slot        TEXT NOT NULL DEFAULT '',
  fundamental REAL,      -- Hz — where the pitch actually sits
  decay_ms    INTEGER,   -- how long until it's gone
  peak_db     REAL,      -- how hot they print it
  rms_db      REAL,
  centroid    REAL,      -- Hz — brightness. a kick's is low, a hat's is high
  duration_ms INTEGER,
  created_at  INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_shape_slot ON sample_shape(slot);

/* ================================================================
   BOARDS
   //.JPEG PHARMACY has 226 people posting reference and every image
   scrolls into the void within a day. The archive that already exists is
   unusable — you can't search it, you can't collect it, and nobody knows
   who found what.

   A board is a named collection. Two kinds of pin:
     • TNL work — the real value. Saving someone's image TELLS them and
       credits them. That's the loop a Pinterest board can't have.
     • an external link — stored as a URL with attribution, NEVER rehosted.
       You get curation without becoming a piracy host.
================================================================ */
CREATE TABLE IF NOT EXISTS boards (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name       TEXT NOT NULL,
  note       TEXT NOT NULL DEFAULT '',
  is_public  INTEGER NOT NULL DEFAULT 1,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_boards_user ON boards(user_id, updated_at);

CREATE TABLE IF NOT EXISTS pins (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  board_id   INTEGER NOT NULL REFERENCES boards(id) ON DELETE CASCADE,
  user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  post_id    INTEGER REFERENCES posts(id) ON DELETE CASCADE,  -- a TNL piece
  src_url    TEXT NOT NULL DEFAULT '',   -- or an external link. never rehosted.
  src_site   TEXT NOT NULL DEFAULT '',   -- where it came from, always shown
  img_url    TEXT NOT NULL DEFAULT '',   -- the external image, hotlinked
  note       TEXT NOT NULL DEFAULT '',
  created_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_pins_board ON pins(board_id, created_at);
CREATE INDEX IF NOT EXISTS idx_pins_post ON pins(post_id);

CREATE INDEX IF NOT EXISTS idx_posts_channel ON posts(channel, created_at);
/* These back the hot paths: every feed counts likes per post, every
   profile pulls a person's work, every load resolves a session token. */
CREATE INDEX IF NOT EXISTS idx_likes_post ON likes(post_id);
CREATE INDEX IF NOT EXISTS idx_likes_user ON likes(user_id);
CREATE INDEX IF NOT EXISTS idx_posts_shared ON posts(shared_from);
CREATE INDEX IF NOT EXISTS idx_posts_work ON posts(is_work, created_at);
CREATE INDEX IF NOT EXISTS idx_collab_user ON collaborators(user_id, status);
CREATE INDEX IF NOT EXISTS idx_collab_post ON collaborators(post_id);
CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_follows_followee ON follows(followee_id);
CREATE INDEX IF NOT EXISTS idx_notifs_unread ON notifications(user_id, read_at);
CREATE INDEX IF NOT EXISTS idx_dm_unread ON dm_messages(thread_id, sender_id, read_at);
CREATE INDEX IF NOT EXISTS idx_llikes_listing ON listing_likes(listing_id);
CREATE INDEX IF NOT EXISTS idx_users_rep ON users(rep);
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
/* Thumbnails + intrinsic size. Without width/height the browser can't
   reserve space, so the feed jumps while you scroll. */
if (!pcols.includes("thumb_url")) db.exec(`ALTER TABLE posts ADD COLUMN thumb_url TEXT`);
if (!pcols.includes("media_w")) db.exec(`ALTER TABLE posts ADD COLUMN media_w INTEGER`);
if (!pcols.includes("media_h")) db.exec(`ALTER TABLE posts ADD COLUMN media_h INTEGER`);
if (!pcols.includes("is_work")) {
  db.exec(`ALTER TABLE posts ADD COLUMN is_work INTEGER NOT NULL DEFAULT 0`);
  // everything with media that already existed was, in effect, published work
  const n = db.prepare(`UPDATE posts SET is_work = 1 WHERE image_url IS NOT NULL OR beat_json IS NOT NULL`).run().changes;
  if (n) console.log(`[db] marked ${n} existing media post(s) as portfolio work`);
}

if (!cols.includes("stripe_account")) db.exec(`ALTER TABLE users ADD COLUMN stripe_account TEXT NOT NULL DEFAULT ''`);
/* Everyone gets black. The accent is theirs. Green is the flask, so it's
   the default — but a fashion designer's page has no reason to look like
   a producer's. Stored as a key, never a raw hex from the client. */
if (!cols.includes("accent")) db.exec(`ALTER TABLE users ADD COLUMN accent TEXT NOT NULL DEFAULT 'lab'`);
if (!cols.includes("stripe_ready")) db.exec(`ALTER TABLE users ADD COLUMN stripe_ready INTEGER NOT NULL DEFAULT 0`);
if (!cols.includes("is_admin")) db.exec(`ALTER TABLE users ADD COLUMN is_admin INTEGER NOT NULL DEFAULT 0`);
/* Suspension, not deletion. Deleting a member cascades their work out of
   everyone else's collabs and threads — that punishes the wrong people. */
if (!cols.includes("suspended")) db.exec(`ALTER TABLE users ADD COLUMN suspended INTEGER NOT NULL DEFAULT 0`);

const lcols = db.prepare(`PRAGMA table_info(listings)`).all().map((c) => c.name);
if (!lcols.includes("sold_at")) db.exec(`ALTER TABLE listings ADD COLUMN sold_at INTEGER`);

const scols = db.prepare(`PRAGMA table_info(samples)`).all().map((c) => c.name);
/* Opt-in, off by default. A sound only enters the library because someone
   decided to put it there. */
if (!scols.includes("shared")) db.exec(`ALTER TABLE samples ADD COLUMN shared INTEGER NOT NULL DEFAULT 0`);
if (!scols.includes("uses")) db.exec(`ALTER TABLE samples ADD COLUMN uses INTEGER NOT NULL DEFAULT 0`);
/* Loops are listings too — same offers, likes, saves, reviews. They just
   deliver instantly instead of shipping, and can be free. */
if (!lcols.includes("kind")) db.exec(`ALTER TABLE listings ADD COLUMN kind TEXT NOT NULL DEFAULT 'physical'`);
if (!lcols.includes("audio_url")) db.exec(`ALTER TABLE listings ADD COLUMN audio_url TEXT`);
if (!lcols.includes("bpm")) db.exec(`ALTER TABLE listings ADD COLUMN bpm INTEGER`);
if (!lcols.includes("musical_key")) db.exec(`ALTER TABLE listings ADD COLUMN musical_key TEXT NOT NULL DEFAULT ''`);
if (!lcols.includes("stems")) db.exec(`ALTER TABLE listings ADD COLUMN stems INTEGER NOT NULL DEFAULT 0`);
if (!lcols.includes("downloads")) db.exec(`ALTER TABLE listings ADD COLUMN downloads INTEGER NOT NULL DEFAULT 0`);

/* Studio telemetry. Never throws — a metrics call must never be able to
   take down the thing it's measuring. */
const insStudio = db.prepare(
  `INSERT INTO studio_events (user_id, kind, voice, fmt, bytes, bpm, musical_key, detail, created_at)
   VALUES (?,?,?,?,?,?,?,?,?)`
);
export function studioEvent(userId, kind, d = {}) {
  try {
    insStudio.run(userId || null, String(kind).slice(0, 24),
      String(d.voice || "").slice(0, 20), String(d.fmt || "").slice(0, 10),
      Number(d.bytes) || 0, d.bpm != null ? Number(d.bpm) : null,
      String(d.key || "").slice(0, 6), String(d.detail || "").slice(0, 200), Date.now());
    // bounded — this is a signal, not an archive
    db.prepare(`DELETE FROM studio_events WHERE id NOT IN (SELECT id FROM studio_events ORDER BY created_at DESC LIMIT 20000)`).run();
  } catch (e) { /* swallow */ }
}

/* ================================================================
   ERRORS + BACKUPS
   The two things that make this survivable without me nearby.
================================================================ */
const insErr = db.prepare(
  `INSERT INTO error_log (kind, message, detail, path, username, created_at) VALUES (?,?,?,?,?,?)`
);
/** Never throws. An error logger that can throw is worse than none. */
export function logError(kind, message, detail = "", path = "", username = "") {
  try {
    insErr.run(String(kind).slice(0, 20), String(message || "").slice(0, 500),
      String(detail || "").slice(0, 2000), String(path || "").slice(0, 200),
      String(username || "").slice(0, 40), Date.now());
    // keep it bounded — this is a black box, not an archive
    db.prepare(`DELETE FROM error_log WHERE id NOT IN (SELECT id FROM error_log ORDER BY created_at DESC LIMIT 500)`).run();
  } catch (e) { /* swallow */ }
}

/* SQLite's own atomic snapshot. Copying the file while it's being written
   gives you a corrupt backup that looks fine until you need it — VACUUM INTO
   is the only safe way to do this on a live database. */
export function backupTo(path) {
  db.prepare(`VACUUM INTO ?`).run(path);
  return path;
}

/* ================================================================
   SETTINGS
   Defaults live in code; overrides live in the database. That way a fresh
   install works with no setup, and you can change your mind at 2am without
   asking me for a deploy.
================================================================ */
export const SETTING_DEFAULTS = {
  tagline:        "Artists, designers, musicians, entrepreneurs. Creatives don't just meet here — they multiply.",
  headline:       "Cultivators.",
  signupsOpen:    "1",     // "0" locks the door — invite-only
  guestAccess:    "1",     // "0" hides everything behind the wall
  marketOpen:     "1",     // "0" hides the Market entirely
  studioOpen:     "1",
  loopsOpen:      "1",
  minRepToSell:   "0",     // gate selling behind standing if it gets messy
  autoVerify:     "0",     // "1" skips email verification — use if mail breaks
  announcement:   "",      // a banner across the top of the app

  /* A Pinterest board embedded in the PHARMACY. Their widget, their
     content, their liability — we render an iframe and nothing else.
     There is no way to SEARCH Pinterest (they killed that API years ago),
     but you can bring a board in whole. */
  pinterestBoard: "",      // e.g. https://www.pinterest.com/tnl/refs/

  /* Distribution. A real promise with a real cost, so it's a setting: you
     can move the bar or turn it off without asking anyone.
     Tied to a LEVEL, not a vibe — "top contributors" is meaningless until
     it's a number other people awarded you. */
  distroOn:       "1",     // "0" hides the offer entirely
  distroLevel:    "4",     // the level that earns it. 4 = Core (280 rep)
  distroBlurb:    "TNL covers the distribution. You keep your masters and 100% of your royalties.",
};

const getSetting = db.prepare(`SELECT value FROM settings WHERE key = ?`);
const putSetting = db.prepare(
  `INSERT INTO settings (key, value, updated_at, updated_by) VALUES (?,?,?,?)
   ON CONFLICT(key) DO UPDATE SET value=excluded.value, updated_at=excluded.updated_at, updated_by=excluded.updated_by`
);
export function setting(key) {
  const row = getSetting.get(key);
  return row ? row.value : (SETTING_DEFAULTS[key] ?? "");
}
export function settingBool(key) { return setting(key) === "1"; }
export function setSetting(key, value, byUserId) {
  if (!(key in SETTING_DEFAULTS)) return false;
  putSetting.run(key, String(value).slice(0, 2000), Date.now(), byUserId || null);
  return true;
}
export function allSettings() {
  const out = { ...SETTING_DEFAULTS };
  for (const r of db.prepare(`SELECT key, value FROM settings`).all()) {
    if (r.key in out) out[r.key] = r.value;
  }
  return out;
}

/** The founder needs moderation powers. Runs on every boot so it works on
 *  a fresh install too, not just on migration. No-op once an admin exists.
 *
 *  Set ADMIN_EMAIL to claim the account by email — that's deliberately not
 *  a hardcoded password. A password in source is a password in the repo,
 *  and anyone who reads it owns your admin account. Sign up normally with
 *  that address and you're promoted automatically, on this boot or the
 *  moment you register. */
const ADMIN_EMAIL = (process.env.ADMIN_EMAIL || "").trim().toLowerCase();

export function ensureAdmin() {
  if (ADMIN_EMAIL) {
    const owner = db.prepare(`SELECT id, username, is_admin FROM users WHERE LOWER(email) = ?`).get(ADMIN_EMAIL);
    if (owner && !owner.is_admin) {
      db.prepare(`UPDATE users SET is_admin = 1 WHERE id = ?`).run(owner.id);
      console.log(`[db] @${owner.username} promoted to admin (ADMIN_EMAIL)`);
    }
    if (owner) return; // the named owner is the admin; don't also promote user #1
  }
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
/** Award a notification. Never throws: a notification is a side effect,
 *  and it must never take down the action that triggered it. If a post
 *  is deleted mid-flight the FK fails — that's a log line, not a 500. */
export function notify(userId, actorId, kind, postId = null, body = "") {
  if (!userId || userId === actorId) return null;
  try {
    const info = insNotif.run(userId, actorId, kind, postId, body, Date.now());
    return Number(info.lastInsertRowid);
  } catch (e) {
    console.error("[notify] skipped:", kind, e.message);
    return null;
  }
}

/* ---- rep rules — the ONLY ways rep is created ----
   Every single one requires SOMEONE ELSE to act. Nothing here can be
   farmed alone, which is the whole point: listing earns nothing,
   because listing is free and proves nothing. Selling earns, because
   a buyer chose it. Delivering earns, because they confirmed it. */
/* Accents. Named, not free-form hex — otherwise someone picks #000000 and
   their profile is unreadable, or slips something into a style attribute.
   Each of these is legible on the black background. */
export const ACCENTS = {
  lab:    { name: "Lab",    hex: "#22C55E" },   // the flask. the default.
  heat:   { name: "Heat",   hex: "#FF5A1F" },
  blood:  { name: "Blood",  hex: "#EF4444" },
  bloom:  { name: "Bloom",  hex: "#EC4899" },
  violet: { name: "Violet", hex: "#A855F7" },
  ice:    { name: "Ice",    hex: "#38BDF8" },
  gold:   { name: "Gold",   hex: "#FBBF24" },
  bone:   { name: "Bone",   hex: "#E7E1D2" },
};
export const accentHex = (key) => (ACCENTS[key] || ACCENTS.lab).hex;

export const REP = {
  like_received: 6,     // someone validated your work
  share_received: 3,    // your work was worth re-circulating
  collab_accepted: 20,  // a confirmed, two-sided collaboration
  sale_made: 15,        // someone paid for your work
  delivery_confirmed: 10, // and the buyer confirmed you delivered
  feature: 40,          // founder/mod feature (manual)
  sound_used: 4,        // someone built with a sound you gave the library
  pinned: 3,            // someone saved your work to their board
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

/* Commission by level. Depop is ~10% flat forever. Here it falls as the
   community vouches for you — the loyalty system paying out in money
   rather than badges.

   This can't be farmed, and that's the point: rep only comes from other
   people acting (likes, shares, accepted collabs, and now completed
   sales). Listing costs nothing and proves nothing, so it earns nothing.
   A lower rate means you were validated, not that you posted more junk. */
export const FEE_BY_LEVEL = { 1: 10, 2: 8, 3: 6, 4: 4, 5: 2 };
export function feeForRep(rep) {
  return FEE_BY_LEVEL[levelFor(rep).id] ?? 10;
}
