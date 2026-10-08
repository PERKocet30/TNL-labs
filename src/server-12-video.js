
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
}
if (!process.env.TNL_NO_VIDEO_FIX) setTimeout(() => fixOldVideos().catch((e) => console.error("[videos]", e.message)), Number(process.env.TNL_VIDEO_FIX_DELAY_MS || 60000)).unref();
