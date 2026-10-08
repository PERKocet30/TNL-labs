
/* ================================================================
   OLD VIDEOS, FIXED · 2026-10-08. Videos uploaded before uploads were
   rewritten index-first (server-03) start slowly on a phone (an iPhone
   .mov keeps its index at the end) and have no cover. Once per boot, a
   minute after start, this walks every posted video, one at a time:
     - index at the end → a copy with it first, under a NEW name (streams
       copied, not re-encoded), and the posts pointing at it move to the
       copy. The original stays on disk — a DM or an old link may still
       point at it, and a browser may hold it cached as immutable.
     - no cover → one from 1s in, set only where the post has none.
   Already-fixed videos cost a few header reads, so later boots do nothing.
================================================================ */
/* Walk the top-level boxes: is the index (moov) before the media (mdat)? */
function moovFirst(path) {
  let fd;
  try {
    fd = openSync(path, "r");
    const size = fstatSync(fd).size, h = Buffer.alloc(16);
    for (let at = 0, n = 0; at + 8 <= size && n < 64; n++) {
      readSync(fd, h, 0, 16, at);
      let len = h.readUInt32BE(0); const type = h.toString("latin1", 4, 8);
      if (type === "moov") return true;
      if (type === "mdat") return false;
      if (len === 1) len = Number(h.readBigUInt64BE(8));
      if (len === 0) return false;
      if (len < 8) return true;            // not a box we understand: leave it be
      at += len;
    }
    return true;
  } catch { return true; } finally { if (fd !== undefined) try { closeSync(fd); } catch {} }
}
const ffRun = (args) => new Promise((ok) => execFile(FFMPEG, args, { timeout: 300000, maxBuffer: 1024 * 1024 }, (err) => ok(!err)));

async function fixOldVideos() {
  if (!FFMPEG) return;
  let moved = 0, covered = 0;
  const urls = db.prepare(`SELECT DISTINCT video_url u FROM posts WHERE video_url LIKE '/uploads/%'`).all().map((r) => r.u);
  for (let url of urls) {
    const name = url.slice("/uploads/".length);
    if (!/^[A-Za-z0-9._-]+$/.test(name)) continue;
    const src = join(UPLOAD_DIR, name), ext = (name.match(/\.(mov|mp4|m4v)$/i) || [])[1];
    if (!existsSync(src)) continue;
    if (ext && !moovFirst(src)) {
      const fixed = name.replace(/\.[^.]+$/, "") + "-fs." + ext.toLowerCase();
      const dst = join(UPLOAD_DIR, fixed);
      if (existsSync(dst) || await ffRun(["-nostdin", "-y", "-i", src, "-map", "0", "-c", "copy", "-movflags", "+faststart",
        "-f", ext.toLowerCase() === "mov" ? "mov" : "mp4", dst])) {
        db.prepare(`UPDATE posts SET video_url = ? WHERE video_url = ?`).run(`/uploads/${fixed}`, url);
        url = `/uploads/${fixed}`; moved++;
      } else rmSync(dst, { force: true });
    }
    const bare = db.prepare(`SELECT COUNT(*) n FROM posts WHERE video_url = ? AND (thumb_url IS NULL OR thumb_url = '')`).get(url).n;
    if (bare) {
      const poster = await new Promise((ok) => videoPoster(url.slice("/uploads/".length), ok));
      if (poster) { db.prepare(`UPDATE posts SET thumb_url = ? WHERE video_url = ? AND (thumb_url IS NULL OR thumb_url = '')`).run(poster, url); covered++; }
    }
  }
  if (moved || covered) console.log(`[videos] old uploads fixed — ${moved} made quick to start, ${covered} given a cover`);
  // …and every posted video without a feed copy gets one, one at a time.
  for (const r of db.prepare(`SELECT DISTINCT video_url u FROM posts WHERE video_url LIKE '/uploads/%' ORDER BY id DESC`).all()) queueFeedVideo(r.u);
}
if (!process.env.TNL_NO_VIDEO_FIX) setTimeout(() => fixOldVideos().catch((e) => console.error("[videos]", e.message)), Number(process.env.TNL_VIDEO_FIX_DELAY_MS || 60000)).unref();

/* ── A copy made for the feed (2026-10-08) ─────────────────────────────
   An iPhone records 1080p at up to 60fps, ~3–10 Mbps. On a phone signal
   that arrives slower than it plays, so a feed video sat as a grey box
   (Jorge's 56MB "Black clover", seconds per range request). Instagram
   plays a lighter copy; so do we: 720p, 30fps, ~1.3 Mbps, index first.
   Made in the background after a post goes up, one at a time (ffmpeg is
   CPU-bound; ~1.5 min for a 2.5-min clip). The original is never touched
   — it stays the post's videoUrl (downloads, "use this sound"); players
   use videoPlayUrl. A video already that light is played as it is. */
db.exec(`CREATE TABLE IF NOT EXISTS video_feed (src TEXT PRIMARY KEY, feed TEXT NOT NULL, created_at INTEGER NOT NULL)`);
var VIDEO_FEED = new Map(db.prepare(`SELECT src, feed FROM video_feed`).all().map((r) => [r.src, r.feed]));
function videoPlayUrl(src) { return (src && VIDEO_FEED && VIDEO_FEED.get(src)) || src || null; }

const FEED_Q = [];
let FEED_BUSY = false;
function queueFeedVideo(url) {
  if (!FFMPEG || !url || !url.startsWith("/uploads/") || VIDEO_FEED.has(url) || FEED_Q.includes(url)) return;
  FEED_Q.push(url); feedNext();
}
const ffProbe = (path) => new Promise((ok) => execFile(FFMPEG, ["-hide_banner", "-i", path], { timeout: 30000, maxBuffer: 1024 * 1024 }, (_e, _o, err) => {
  const s = String(err || ""), v = s.match(/Video: (\w+)[^\n]*?, (\d{2,5})x(\d{2,5})/), fps = s.match(/([\d.]+) fps/), br = s.match(/bitrate: (\d+) kb\/s/);
  ok(v ? { codec: v[1], w: +v[2], h: +v[3], fps: fps ? +fps[1] : 30, kbps: br ? +br[1] : 0 } : null);
}));
async function feedNext() {
  if (FEED_BUSY || !FEED_Q.length) return;
  FEED_BUSY = true;
  const url = FEED_Q.shift(), name = url.slice("/uploads/".length);
  try {
    const src = join(UPLOAD_DIR, name);
    const info = /^[A-Za-z0-9._-]+$/.test(name) && existsSync(src) ? await ffProbe(src) : null;
    if (info) {
      const light = info.codec === "h264" && Math.min(info.w, info.h) <= 720 && info.fps <= 31 && info.kbps && info.kbps <= 2200 && /\.mp4$/i.test(name);
      const feed = light ? null : name.replace(/\.[^.]+$/, "") + "-feed.mp4";
      const portrait = info.h > info.w;
      const t0 = Date.now();
      if (light || await ffRun(["-nostdin", "-y", "-i", src, "-map", "0:v:0", "-map", "0:a:0?",
        "-vf", `${portrait ? "scale=-2:'min(1280,ih)'" : "scale='min(1280,iw)':-2"},fps=30`,
        "-c:v", "libx264", "-preset", "veryfast", "-crf", "26", "-maxrate", "1800k", "-bufsize", "3600k", "-profile:v", "high", "-pix_fmt", "yuv420p",
        "-c:a", "aac", "-b:a", "96k", "-movflags", "+faststart", "-threads", "2", join(UPLOAD_DIR, feed)])) {
        const out = feed ? `/uploads/${feed}` : url;
        db.prepare(`INSERT OR REPLACE INTO video_feed (src, feed, created_at) VALUES (?, ?, ?)`).run(url, out, Date.now());
        VIDEO_FEED.set(url, out);
        if (feed) console.log(`[videos] feed copy of ${name} ready in ${Math.round((Date.now() - t0) / 1000)}s`);
      } else rmSync(join(UPLOAD_DIR, feed), { force: true });
    }
  } catch (e) { console.error("[videos] feed copy", e.message); }
  FEED_BUSY = false;
  setTimeout(feedNext, 2000).unref();
}
