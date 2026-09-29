import express from "express";
import zlib from "node:zlib";
import cors from "cors";
import bcrypt from "bcryptjs";
import { randomBytes, createHash } from "node:crypto";
import { crc32 as zlibCrc32 } from "node:zlib";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { writeFileSync, readFileSync, mkdirSync, existsSync, createWriteStream, rename, rm, statSync, readdirSync, rmSync } from "node:fs";
import { execFile } from "node:child_process";

/* ffmpeg, for pulling the audio out of a video. Resolved from the
   ffmpeg-static package rather than the image: build config (nixpacks.toml)
   was silently ignored by the builder and produced a green deploy with no
   binary. A dependency can't be skipped that way.
   Dynamic import inside try/catch on purpose — a resolution failure must
   not take the whole server down over one feature. FFMPEG stays null and
   the extract route answers 503. */
let FFMPEG = null;
try { FFMPEG = (await import("ffmpeg-static")).default || null; } catch { FFMPEG = null; }
import { db, awardRep, revokeRep, levelFor, LEVELS, DATA_DIR, notify, ensureAdmin, feeForRep, FEE_BY_LEVEL, ACCENTS, accentHex,
         setting, settingBool, setSetting, allSettings, SETTING_DEFAULTS, logError, backupTo, studioEvent } from "./db.js";
import { sendVerifyEmail, sendResetEmail, sendAlertEmail, MAIL_ENABLED, MAIL_TEST_SENDER } from "./mail.js";
import { PALETTE, paletteCss, accentVars, inkFor } from "./palette.js";
import { createCheckout, verifySession, PAYMENTS_ENABLED, platformFee,
         createSellerAccount, onboardingLink, accountStatus, loginLink } from "./pay.js";

const __dirname = dirname(fileURLToPath(import.meta.url));

/* Uploads live beside the database on the same persistent volume. */
const UPLOAD_DIR = join(DATA_DIR, "uploads");
if (!existsSync(UPLOAD_DIR)) mkdirSync(UPLOAD_DIR, { recursive: true });

/* ================================================================
   RATE LIMITING — in-memory sliding window. Keeps one person from
   spamming the feed or brute-forcing a password. Resets on restart,
   which is fine at this scale; move to Redis if you outgrow one box.
================================================================ */
const buckets = new Map();
function rateLimit({ max, windowMs, key = "ip" }) {
  return (req, res, next) => {
    /* Cloudflare puts the real visitor in CF-Connecting-IP. It's the only
       one CF guarantees and strips from client-supplied headers, so it
       can't be spoofed the way X-Forwarded-For can. */
    const ip = req.get("cf-connecting-ip") || req.ip;
    const who = key === "user" && req.user ? `u${req.user.id}` : ip;
    const id = `${req.route?.path || req.path}:${who}`;
    const now = Date.now();
    const hits = (buckets.get(id) || []).filter((t) => now - t < windowMs);
    if (hits.length >= max) {
      const retry = Math.ceil((windowMs - (now - hits[0])) / 1000);
      res.set("Retry-After", String(retry));
      return res.status(429).json({ error: `Slow down — try again in ${retry}s` });
    }
    hits.push(now);
    buckets.set(id, hits);
    next();
  };
}
// keep the map from growing forever
setInterval(() => {
  const now = Date.now();
  for (const [k, v] of buckets) {
    const fresh = v.filter((t) => now - t < 3600000);
    if (fresh.length) buckets.set(k, fresh); else buckets.delete(k);
  }
}, 600000).unref?.();

const app = express();

/* ── BEHIND CLOUDFLARE ───────────────────────────────────────────────
   Cloudflare (and Railway) proxy every request, so req.ip becomes THEIR
   IP, not the visitor's. Left unfixed, that silently breaks:

     • rate limiting — everyone shares one "IP". The register limit is
       5/hour, so the 6th person to sign up EVER gets blocked, and it
       looks like a bug in your app, not a config.
     • baseUrl — req.protocol reads "http" behind a proxy, so every
       verification link and OG image URL would go out as http://.

   `trust proxy` tells Express to read X-Forwarded-For / -Proto instead.
   The hop count is 2: Cloudflare → Railway → us. Trusting blindly (true)
   would let anyone spoof their IP by sending the header themselves. */
app.set("trust proxy", 2);

/* Every admin change is written down (admin_log, server-10-admin.js). */
app.use("/api/admin", (req, res, next) => {
  if (req.method !== "GET") res.on("finish", () => { if (res.statusCode < 400 && req.user?.is_admin) auditAdmin(req); });
  next();
});

/* Belt and braces: mark every API response private and uncacheable.

   Cloudflare won't cache JSON by default — but "Cache Everything" is one
   page rule away, and if it were ever switched on, /api/me would get
   cached and served to the next person. One account, everyone's session.
   That's the worst bug this app could have, and it wouldn't be a code bug.

   Explicit beats default when the downside is that bad. */
app.use("/api", (req, res, next) => {
  res.set("Cache-Control", "private, no-store, max-age=0");
  next();
});
app.use(cors());
/* Real media does NOT come through here — it streams to disk via
   /api/upload/stream. This limit only covers small base64 payloads
   (avatars, beat audio), and stays low on purpose: anything parsed as
   JSON is held in RAM in full. */
app.use(express.json({ limit: "12mb" })); // only the small base64 route uses this now
/* The app shell must NEVER be edge-cached. index.html changes every deploy;
   a copy cached at Cloudflare means people keep getting the old build no
   matter what you push, and redeploying doesn't fix it. The service worker
   already taught us this the hard way.
   Images and fonts are safe to cache — HTML is not. */
/* ── COMPRESSION ─────────────────────────────────────────────────────
   Nothing here shipped compressed before: a 280KB app shell and JSON feeds
   full of beat patterns went over the wire raw. Gzip cuts these 70-80%.
   Built on node:zlib — no new dependency. /api/stream (SSE) must never be
   buffered or encoded, so it's excluded; images stream elsewhere untouched. */
app.use((req, res, next) => {
  if (req.path === "/api/stream") return next();
  if (!/\bgzip\b/.test(req.headers["accept-encoding"] || "")) return next();
  const send = res.send.bind(res);
  res.send = (body) => {
    try {
      if (res.headersSent || res.get("Content-Encoding")) return send(body);
      const buf = Buffer.isBuffer(body) ? body
        : Buffer.from(typeof body === "string" ? body : JSON.stringify(body));
      /* Express types a string as text/html inside the REAL send — which now
         runs after us. We gzip first and pass a Buffer, and Express types a
         bare Buffer as application/octet-stream: the verify page (and every
         other HTML string ≥1KB) downloaded as a file named after the route.
         Set the type a string would have gotten before deciding anything. */
      let ct = res.get("Content-Type") || "";
      if (!ct && typeof body === "string") { res.set("Content-Type", "text/html; charset=utf-8"); ct = "text/html"; }
      if (buf.length < 1024) return send(body);
      if (ct && !/json|text|javascript|svg|html|css/i.test(ct)) return send(body);
      const gz = zlib.gzipSync(buf, { level: 6 });
      res.set("Content-Encoding", "gzip");
      res.set("Vary", "Accept-Encoding");
      res.removeHeader("Content-Length");
      return send(gz);
    } catch (e) { return send(body); }
  };
  next();
});

/* Static shell, pre-gzipped once at boot. index.html alone is ~280KB raw. */
const GZ_TYPES = { ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".css": "text/css; charset=utf-8", ".svg": "image/svg+xml" };
const PUB = join(__dirname, "..", "public");
for (const name of readdirSync(PUB)) {
  const ext = name.slice(name.lastIndexOf("."));
  if (!GZ_TYPES[ext]) continue;
  try {
    const src = join(PUB, name), gz = src + ".gz";
    if (!existsSync(gz) || statSync(gz).mtimeMs < statSync(src).mtimeMs)
      writeFileSync(gz, zlib.gzipSync(readFileSync(src), { level: 9 }));
  } catch (e) {}
}
app.use((req, res, next) => {
  if (req.method !== "GET") return next();
  if (!/\bgzip\b/.test(req.headers["accept-encoding"] || "")) return next();
  let p = req.path === "/" ? "/index.html" : req.path;
  const ext = p.slice(p.lastIndexOf("."));
  if (!GZ_TYPES[ext]) return next();
  const gz = join(PUB, p.slice(1) + ".gz");
  if (!existsSync(gz)) return next();
  res.set("Content-Type", GZ_TYPES[ext]);
  res.set("Content-Encoding", "gzip");
  res.set("Vary", "Accept-Encoding");
  res.set("Cache-Control", ext === ".html" ? "public, max-age=0, must-revalidate" : "public, max-age=86400");
  res.sendFile(gz);
});

app.use(express.static(join(__dirname, "..", "public"), {
  setHeaders: (res, path) => {
    if (/\.(html|webmanifest)$/.test(path) || path.endsWith("sw.js")) {
      res.set("Cache-Control", "public, max-age=0, must-revalidate");
    } else if (/\.(png|jpg|jpeg|svg|woff2?|ico)$/.test(path)) {
      res.set("Cache-Control", "public, max-age=86400");
    }
  },
}));
/* ── WHAT CLOUDFLARE SHOULD AND SHOULDN'T CACHE ──────────────────────
   Getting this backwards is how you serve a broken build to everyone for
   a week and can't fix it by redeploying. */

/* Uploads are immutable — the filename contains a hash, so a given URL's
   bytes never change. Cache them forever, at the edge. This is the whole
   win: your artists' images get served from Cloudflare's network instead
   of a single Railway box in US-West, and the egress is free. */
app.use("/uploads", express.static(UPLOAD_DIR, {
  maxAge: "365d",
  immutable: true,
  setHeaders: (res) => {
    res.set("Cache-Control", "public, max-age=31536000, immutable");
    res.set("Access-Control-Allow-Origin", "*");   // so previews can fetch them
  },
}));

/* ── SENTRY ──────────────────────────────────────────────────────────
   Errors report themselves instead of arriving as screenshots. Zero new
   dependencies — a DSN is just an HTTP address, so this posts Sentry's
   envelope format with plain fetch. No DSN configured = silent no-op. */
const SENTRY_DSN = process.env.SENTRY_DSN || "https://dd32635170e2123131bb2583d08e2aed@o4511775840468992.ingest.us.sentry.io/4511775846957056";
const SENTRY = (() => {
  const m = /^https:\/\/([a-f0-9]+)@([^/]+)\/(\d+)$/.exec(SENTRY_DSN || "");
  return m ? { key: m[1], host: m[2], project: m[3] } : null;
})();
let _sentryCount = 0, _sentryWindow = 0;
function sentryReport(err, where) {
  try {
    if (!SENTRY) return;
    const now = Date.now();                       // crash loops must not burn the quota
    if (now - _sentryWindow > 60000) { _sentryWindow = now; _sentryCount = 0; }
    if (++_sentryCount > 20) return;
    const event = {
      timestamp: now / 1000, platform: "node", level: "error",
      server_name: "tnl-labs-railway", tags: { where: where || "server" },
      exception: { values: [{ type: err?.name || "Error", value: String(err?.message || err).slice(0, 500) }] },
      extra: { stack: String(err?.stack || "").slice(0, 4000) },
    };
    const envelope =
      JSON.stringify({ dsn: SENTRY_DSN, sent_at: new Date().toISOString() }) + "\n" +
      JSON.stringify({ type: "event" }) + "\n" + JSON.stringify(event) + "\n";
    fetch(`https://${SENTRY.host}/api/${SENTRY.project}/envelope/`, {
      method: "POST", headers: { "Content-Type": "application/x-sentry-envelope" }, body: envelope,
    }).catch(() => {});
    /* Same event, straight into the admin's Health tab — one place to look. */
    try { logError("server", event.exception.values[0].value, event.extra.stack.slice(0, 1500), where || "", ""); } catch (e) {}
  } catch (e) {}
}
process.on("uncaughtException", (e) => { sentryReport(e, "uncaught"); console.error(e); });
process.on("unhandledRejection", (e) => { sentryReport(e, "rejection"); });

/* Express's own body-parser errors are ugly and unhandled by default.
   Turn "PayloadTooLargeError" into something a person can act on. */
app.use((err, req, res, next) => {
  if (err?.type === "entity.too.large") {
    return res.status(413).json({ error: "That file's too big — 25MB max for video, 8MB for images" });
  }
  if (err?.type === "entity.parse.failed") {
    return res.status(400).json({ error: "bad request body" });
  }
  next(err);
});

/* ================================================================
   PREPARED STATEMENTS
================================================================ */
const q = {
  userByName: db.prepare(`SELECT * FROM users WHERE username = ?`),
  userById: db.prepare(`SELECT * FROM users WHERE id = ?`),
  createUser: db.prepare(
    /* published = 1 explicitly, not left to the column default: databases
       created before 059 have DEFAULT 0 baked in and SQLite has no ALTER
       COLUMN. Without this a new member's /u/ page 404s on the share link
       they were just handed — the one moment it matters most. */
    `INSERT INTO users (username, display_name, email, role, password_hash, published, created_at)
     VALUES (?, ?, ?, ?, ?, 1, ?)`
  ),
  createSession: db.prepare(`INSERT INTO sessions (token, user_id, created_at) VALUES (?, ?, ?)`),
  sessionByToken: db.prepare(`SELECT * FROM sessions WHERE token = ?`),
  deleteSession: db.prepare(`DELETE FROM sessions WHERE token = ?`),

  createPost: db.prepare(
    `INSERT INTO posts (author_id, channel, body, beat_json, image_url, video_url, thumb_url, media_w, media_h, is_work, shared_from, images, audio_track_id, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ),
  postById: db.prepare(`SELECT * FROM posts WHERE id = ?`),

  like: db.prepare(`INSERT OR IGNORE INTO likes (post_id, user_id, created_at) VALUES (?, ?, ?)`),
  unlike: db.prepare(`DELETE FROM likes WHERE post_id = ? AND user_id = ?`),
  likeExists: db.prepare(`SELECT 1 FROM likes WHERE post_id = ? AND user_id = ?`),

  addCollab: db.prepare(
    `INSERT OR IGNORE INTO collaborators (post_id, user_id, status, created_at) VALUES (?, ?, 'pending', ?)`
  ),
  acceptCollab: db.prepare(`UPDATE collaborators SET status = 'accepted' WHERE post_id = ? AND user_id = ?`),
  collabRow: db.prepare(`SELECT * FROM collaborators WHERE post_id = ? AND user_id = ?`),

  follow: db.prepare(`INSERT OR IGNORE INTO follows (follower_id, followee_id, created_at) VALUES (?, ?, ?)`),
  unfollow: db.prepare(`DELETE FROM follows WHERE follower_id = ? AND followee_id = ?`),
  followExists: db.prepare(`SELECT 1 FROM follows WHERE follower_id = ? AND followee_id = ?`),
  followerCount: db.prepare(`SELECT COUNT(*) n FROM follows WHERE followee_id = ?`),
  followingIds: db.prepare(`SELECT followee_id FROM follows WHERE follower_id = ?`),

  makeVerifyToken: db.prepare(`INSERT INTO verify_tokens (token, user_id, expires_at, created_at) VALUES (?, ?, ?, ?)`),
  verifyToken: db.prepare(`SELECT * FROM verify_tokens WHERE token = ?`),
  clearVerifyTokens: db.prepare(`DELETE FROM verify_tokens WHERE user_id = ?`),
  markVerified: db.prepare(`UPDATE users SET email_verified = 1 WHERE id = ?`),
};

/* Feed query builder — returns posts enriched with author, counts, and
   whether the current viewer liked them. */
function feedRows({ channel, authorId, viewerId, limit = 50, workOnly = false, postId = null, ids = null }) {
  const where = [];
  const params = {};
  if (postId) { where.push(`p.id = $postId`); params.postId = postId; }
  if (ids) { where.push(ids.length ? `p.id IN (${ids.map((id) => Number(id)).join(",")})` : `0`); }
  if (channel) { where.push(`p.channel = $channel`); params.channel = channel; }
  if (authorId) { where.push(`p.author_id = $authorId`); params.authorId = authorId; }
  if (workOnly) where.push(`p.is_work = 1`);
  const whereSql = where.length ? "WHERE " + where.join(" AND ") : "";
  const sql = `
    SELECT
      p.id, p.channel, p.body, p.beat_json, p.image_url, p.video_url, p.thumb_url, p.media_w, p.media_h, p.is_work, p.edited_at, p.shared_from, p.created_at, p.audio_track_id,
      p.images, p.reply_to, p.link_json,
      tr.title AS track_title, tr.url AS track_url, tr.artwork_url AS track_art, tr.duration_ms AS track_dur, tu.username AS track_by,
      u.username AS author_username, u.display_name AS author_name, u.role AS author_role,
      u.avatar_url AS author_avatar, u.accent AS author_accent, u.rep AS author_rep,
      (SELECT COUNT(*) FROM likes  l WHERE l.post_id = p.id) AS like_count,
      (SELECT COUNT(*) FROM posts  s WHERE s.shared_from = p.id) AS share_count,
      (SELECT COUNT(*) FROM likes  l WHERE l.post_id = p.id AND l.user_id = $viewer) AS liked_by_me
    FROM posts p
    JOIN users u ON u.id = p.author_id
    LEFT JOIN tracks tr ON tr.id = p.audio_track_id
    LEFT JOIN users tu ON tu.id = tr.user_id
    ${whereSql}
    ORDER BY p.created_at DESC
    LIMIT $limit`;
  params.viewer = viewerId || 0;
  params.limit = limit;
  return db.prepare(sql).all(params);
}

/* Shaping a post used to fire two extra queries EACH — a 60-post profile
   meant 120 round trips, with a fresh db.prepare() compiled every time.
   Now a whole page gets its comment counts and collaborators in two
   queries, mapped up front. This was the profile-load slowness. */
const cntOne = db.prepare(`SELECT COUNT(*) n FROM comments WHERE post_id = ?`);
const collabOne = db.prepare(
  `SELECT c.status, u.username, u.display_name FROM collaborators c
   JOIN users u ON u.id = c.user_id WHERE c.post_id = ?`
);

function sidecar(rows) {
  const ids = rows.map((r) => r.id);
  const comments = new Map(), collabs = new Map();
  if (!ids.length) return { comments, collabs };
  const holes = ids.map(() => "?").join(",");
  for (const r of db.prepare(
    `SELECT post_id, COUNT(*) n FROM comments WHERE post_id IN (${holes}) GROUP BY post_id`
  ).all(...ids)) comments.set(r.post_id, r.n);
  for (const r of db.prepare(
    `SELECT c.post_id, c.status, u.username, u.display_name FROM collaborators c
     JOIN users u ON u.id = c.user_id WHERE c.post_id IN (${holes})`
  ).all(...ids)) {
    if (!collabs.has(r.post_id)) collabs.set(r.post_id, []);
    collabs.get(r.post_id).push({ status: r.status, username: r.username, display_name: r.display_name });
  }
  // Reactions and reply quotes for lab chat — server-10-live.js.
  return { comments, collabs, chat: chatSidecar(rows) };
}

/** Shape a whole page in 2 queries. Prefer this over rows. */
/* One place decides what a track looks like to the client. */
function shapeTrack(r) {
  return {
    id: r.id, title: r.title, url: r.url,
    artworkUrl: r.artwork_url || "", description: r.description || "",
    durationMs: r.duration_ms || 0, plays: r.plays || 0, createdAt: r.created_at,
    by: {
      username: r.username, displayName: r.display_name,
      avatarUrl: r.avatar_url || "", rep: r.rep,
    },
  };
}

function shapePosts(rows) {
  const side = sidecar(rows);
  return rows.map((r) => shapePost(r, side));
}

function shapePost(row, side) {
  const chat = side?.chat || chatSidecar([row]);
  return {
    id: row.id,
    channel: row.channel,
    body: row.body,
    beat: row.beat_json ? JSON.parse(row.beat_json) : null,
    imageUrl: row.image_url || null,
    thumbUrl: row.thumb_url || row.image_url || null,
    mediaW: row.media_w || null,
    mediaH: row.media_h || null,
    /* The rest of the gallery, if there is one. Null for every post ever
       made before this existed — the client falls back to imageUrl. */
    images: (() => { try { return row.images ? JSON.parse(row.images) : null; } catch { return null; } })(),
    videoUrl: row.video_url || null,
    /* The sound credit — Instagram model. Null when no music, or when the
       track was later deleted (LEFT JOIN finds nothing). */
    audioTrack: row.track_url ? { id: row.audio_track_id, title: row.track_title, url: row.track_url,
      artworkUrl: row.track_art || "", durationMs: row.track_dur || 0, by: { username: row.track_by } } : null,
    isWork: !!row.is_work,
    /* Lab chat: the message this one answers, emoji reactions, and the
       preview card for a pasted link. */
    replyTo: row.reply_to ? (chat.replies.get(row.reply_to) || { id: row.reply_to, deleted: true, text: "Original message deleted" }) : null,
    reactions: chat.reactions.get(row.id) || [],
    link: (() => { try { return row.link_json ? JSON.parse(row.link_json) : null; } catch { return null; } })(),
    editedAt: row.edited_at || null,
    sharedFrom: row.shared_from || null,
    createdAt: row.created_at,
    author: {
      username: row.author_username,
      displayName: row.author_name,
      role: row.author_role,
      avatarUrl: row.author_avatar || "",
      accent: row.author_accent || "#98FC68",
      rep: row.author_rep,
      level: levelFor(row.author_rep).id,
      accentHex: accentHex(row.author_accent),
    },
    likeCount: row.like_count,
    shareCount: row.share_count,
    commentCount: side ? (side.comments.get(row.id) || 0) : (cntOne.get(row.id)?.n || 0),
    likedByMe: !!row.liked_by_me,
    collaborators: side ? (side.collabs.get(row.id) || []) : collabOne.all(row.id),
  };
}

function publicUser(u) {
  return {
    username: u.username,
    displayName: u.display_name,
    email: u.email,
    role: u.role,
    roles: (() => { try { const r = JSON.parse(u.roles || "[]"); return r.length ? r : (u.role ? [u.role] : []); } catch { return u.role ? [u.role] : []; } })(),
    avatarUrl: u.avatar_url || "",
    accent: u.accent || "#98FC68",
    rep: u.rep,
    bio: u.bio || "",
    link: u.link || "",
    emailVerified: !!u.email_verified,
    published: !!u.published,
    isAdmin: !!u.is_admin,
    accent: u.accent || "lab",
    accentHex: accentHex(u.accent),
    payoutsReady: !!u.stripe_ready,
    hasStripe: !!u.stripe_account,
    createdAt: u.created_at,
    level: levelFor(u.rep).id,
    levelName: levelFor(u.rep).name,
  };
}

/* REALTIME (Server-Sent Events) moved to server-10-live.js in messaging v2:
   the stream is now signed in, and private events go only to the people
   they're for. */

