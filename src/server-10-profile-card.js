
/* ================================================================
   PROFILE CARD v1.0 — 2026-09-29. The link preview for a shared
   profile shows the portfolio, not one post: a 1200×630 grid of the
   member's latest work, with the TNL mark in the corner.

   Built with the ffmpeg the server already ships (ffmpeg-static), on
   the first request, and kept on the volume under og/. The page asks
   for card.jpg?v=<hash of the pieces in it>, so when someone posts new
   work the URL changes and Instagram / iMessage fetch a fresh one
   instead of their cached copy. Nothing here can take the page down:
   no ffmpeg, too little work, or a failed build all fall back to the
   single-image preview the page used before.
================================================================ */
const CARD = { w: 1200, h: 630, gap: 6, bg: "0xF7F1F1", version: 1, mark: 64, pad: 18 };
const CARD_DIR = join(DATA_DIR, "og");

/* Grid shapes by how much work there is: [columns, rows]. */
const cardShape = (n) => (n >= 8 ? [4, 2] : n >= 6 ? [3, 2] : n >= 4 ? [2, 2] : n >= 3 ? [3, 1] : n >= 2 ? [2, 1] : null);

/* A file on our own disk for an /uploads/ URL — or null. Never follows
   anything else: a URL from the database is still not a path. */
function cardFile(url) {
  if (typeof url !== "string" || !url.startsWith("/uploads/")) return null;
  const name = url.slice(9).split(/[?#]/)[0];
  if (!name || name.includes("/") || name.includes("\\") || name.includes("..")) return null;
  const f = join(UPLOAD_DIR, name);
  return existsSync(f) ? f : null;
}

/* The pieces in someone's card: newest published work that has a picture
   (a photo, the first of a carousel, a video's thumbnail or, failing
   that, a frame of the video itself). */
function profileCardTiles(userId) {
  const rows = db.prepare(`SELECT id, image_url, images, thumb_url, video_url FROM posts
    WHERE author_id = ? AND is_work = 1 AND shared_from IS NULL ORDER BY created_at DESC LIMIT 40`).all(userId);
  const tiles = [];
  for (const r of rows) {
    let first = null;
    try { const im = r.images ? JSON.parse(r.images) : null; first = Array.isArray(im) && im.length ? (im[0].url || im[0]) : null; } catch {}
    const still = cardFile(r.image_url) || cardFile(first) || cardFile(r.thumb_url);
    const video = !still && cardFile(r.video_url);
    if (still) tiles.push({ id: r.id, file: still, video: false });
    else if (video) tiles.push({ id: r.id, file: video, video: true });
    if (tiles.length >= 8) break;
  }
  const shape = cardShape(tiles.length);
  if (!shape) return null;
  const use = tiles.slice(0, shape[0] * shape[1]);
  const hash = createHash("sha1").update(JSON.stringify([CARD.version, use.map((t) => t.file)])).digest("hex").slice(0, 12);
  return { tiles: use, shape, hash };
}

/* The ffmpeg filter graph: every piece cropped to fill its cell, laid on
   Paper with thin gutters, the mark bottom-left. Pure arithmetic, so it's
   tested without running ffmpeg. */
function profileCardArgs(card, out) {
  const [cols, rows] = card.shape, { w, h, gap } = CARD;
  const cw = Math.floor((w - gap * (cols - 1)) / cols), ch = Math.floor((h - gap * (rows - 1)) / rows);
  const args = ["-nostdin", "-y", "-loglevel", "error"];
  card.tiles.forEach((t) => args.push(...(t.video ? ["-ss", "1"] : []), "-i", t.file));
  const markFile = join(__dirname, "..", "public", "icon-512.png");
  const hasMark = existsSync(markFile);
  if (hasMark) args.push("-i", markFile);
  const f = [`color=c=${CARD.bg}:s=${w}x${h}:d=1[c0]`];
  card.tiles.forEach((_, i) => f.push(`[${i}:v]scale=${cw}:${ch}:force_original_aspect_ratio=increase,crop=${cw}:${ch},setsar=1,format=rgb24[t${i}]`));
  let last = "c0";
  card.tiles.forEach((_, i) => {
    const x = (i % cols) * (cw + gap), y = Math.floor(i / cols) * (ch + gap);
    f.push(`[${last}][t${i}]overlay=${x}:${y}[c${i + 1}]`);
    last = `c${i + 1}`;
  });
  if (hasMark) {
    f.push(`[${card.tiles.length}:v]scale=${CARD.mark}:${CARD.mark}[m]`);
    f.push(`[${last}][m]overlay=${CARD.pad}:${h - CARD.mark - CARD.pad}[out]`);
    last = "out";
  }
  args.push("-filter_complex", f.join(";"), "-map", `[${last}]`, "-frames:v", "1", "-q:v", "3", out);
  return args;
}

/* One build at a time, and never the same card twice at once — a link
   dropped in a 200-person chat is 200 crawlers asking together. */
const CARD_BUILDS = new Map();
let CARD_CHAIN = Promise.resolve();
function buildProfileCard(userId, card) {
  const out = join(CARD_DIR, `u${userId}-${card.hash}.jpg`);
  if (existsSync(out)) return Promise.resolve(out);
  if (CARD_BUILDS.has(out)) return CARD_BUILDS.get(out);
  const job = (CARD_CHAIN = CARD_CHAIN.catch(() => {}).then(() => new Promise((resolve, reject) => {
    if (!FFMPEG) return reject(new Error("no ffmpeg"));
    mkdirSync(CARD_DIR, { recursive: true });
    const tmp = out + ".tmp.jpg";
    execFile(FFMPEG, profileCardArgs(card, tmp), { timeout: 30000, maxBuffer: 1024 * 1024 }, (err, _o, stderr) => {
      if (err || !existsSync(tmp)) { rm(tmp, { force: true }, () => {}); return reject(new Error(String(stderr || err).slice(0, 300))); }
      rename(tmp, out, (e) => {
        if (e) return reject(e);
        // older cards for this person are dead weight on the volume
        for (const f of readdirSync(CARD_DIR)) if (f.startsWith(`u${userId}-`) && !f.startsWith(`u${userId}-${card.hash}`)) rm(join(CARD_DIR, f), { force: true }, () => {});
        resolve(out);
      });
    });
  })));
  CARD_BUILDS.set(out, job);
  job.finally(() => CARD_BUILDS.delete(out)).catch(() => {});
  return job;
}

/* For the profile page's <head>: the card's URL and size, or null. */
function profileCardMeta(userId, base, username) {
  if (!FFMPEG) return null;
  const card = profileCardTiles(userId);
  if (!card) return null;
  return { url: `${base}/u/${encodeURIComponent(username)}/card.jpg?v=${card.hash}`, w: CARD.w, h: CARD.h };
}

app.get("/u/:username/card.jpg", rateLimit({ max: 120, windowMs: 60000 }), async (req, res) => {
  const u = q.userByName.get(req.params.username);
  if (!u) return res.status(404).end();
  const card = profileCardTiles(u.id);
  const fallback = () => res.redirect(302, u.avatar_url || "/icon-512.png");
  if (!card || !FFMPEG) return fallback();
  try {
    const file = await buildProfileCard(u.id, card);
    res.set("Cache-Control", "public, max-age=86400, immutable");
    res.type("jpg").sendFile(file);
  } catch (e) {
    logError("card", e.message || "card build failed", "", req.path, "");
    fallback();
  }
});
