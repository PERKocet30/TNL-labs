/* ================================================================
   BIG VIDEOS v1.0 — 2026-11-05. "I waited 5 minutes to upload my video
   only for it to say my video was too big" → "How does Meta do it?" →
   "Copy". A 2-minute iPhone video (4K, often converted on the way out of
   Photos) is 0.7–1.5GB; LABS stopped at 650MB, and the volume is 5GB with
   every original kept. Like Meta, LABS keeps its own copy, not the giant
   original: a video over VIDEO_KEEP is made 1080p (H.264, high quality,
   up to 60fps, HDR toned to normal colour so it isn't washed out) and only
   that copy is kept. Under VIDEO_KEEP nothing changes.
     VIDEO_MAX   what an upload may be (2GB)
     VIDEO_KEEP  above this, it's made 1080p before it's saved (650MB)
     videoRoom() is there disk for one this big right now? (the upload
                 route asks before it starts, so a full disk says so at
                 once instead of after the upload)
   One shrink at a time (ffmpeg is CPU-bound and shares the box with the
   app); a second waits its turn. A shrink that fails leaves the upload as
   it was — never worse than before.
================================================================ */
const MB_ = 1024 * 1024, envMB = (k, d) => (Number(process.env[k]) > 0 ? Number(process.env[k]) : d) * MB_;   // the env names are for tests
const VIDEO_MAX = envMB("TNL_VIDEO_MAX_MB", 2048);
const VIDEO_KEEP = envMB("TNL_VIDEO_KEEP_MB", 650);
const VIDEO_ROOM_SPARE = envMB("TNL_VIDEO_SPARE_MB", 1024);   // always leave this much free on the volume

/* Free bytes on the volume, or Infinity when the system won't say. */
function videoFree() {
  try { const s = statfsSync(UPLOAD_DIR); return Number(s.bavail) * Number(s.bsize); } catch { return Infinity; }
}
/* Room for an upload of `bytes`: the file itself, its 1080p copy while it's made (at most as big), and the spare. */
const videoRoom = (bytes) => videoFree() >= (bytes > VIDEO_KEEP ? bytes * 2 : bytes) + VIDEO_ROOM_SPARE;

let SHRINKING = Promise.resolve();
/* Make `src` (any phone video) a 1080p MP4 at `out`. Resolves true when `out` is ready. */
function videoShrink(src, out) {
  const run = SHRINKING.then(() => new Promise((ok) => {
    if (!FFMPEG) return ok(false);
    execFile(FFMPEG, ["-hide_banner", "-i", src], { timeout: 30000, maxBuffer: 1024 * 1024 }, (_e, _o, err) => {
      const s = String(err || ""), v = s.match(/Video: [^\n]*?, (\d{2,5})x(\d{2,5})/), fps = Number((s.match(/([\d.]+) fps/) || [])[1] || 30);
      const rot = /rotate\s*:\s*-?(90|270)|rotation of -?90/.test(s);
      const w = v ? +v[1] : 1920, h = v ? +v[2] : 1080, portrait = rot ? w > h : h > w;
      const hdr = /arib-std-b67|smpte2084/.test(s);
      const vf = [
        ...(hdr ? ["zscale=t=linear:npl=100", "format=gbrpf32le", "zscale=p=bt709", "tonemap=tonemap=hable:desat=0", "zscale=t=bt709:m=bt709:r=tv"] : []),
        portrait ? "scale=-2:'min(1920,ih)'" : "scale='min(1920,iw)':-2",
        ...(fps > 61 ? ["fps=60"] : []), "format=yuv420p"].join(",");
      execFile(FFMPEG, ["-nostdin", "-y", "-i", src, "-map", "0:v:0", "-map", "0:a:0?", "-vf", vf,
        "-c:v", "libx264", "-preset", "veryfast", "-crf", "21", "-maxrate", "8000k", "-bufsize", "16000k", "-profile:v", "high",
        "-color_primaries", "bt709", "-color_trc", "bt709", "-colorspace", "bt709",
        "-c:a", "aac", "-b:a", "160k", "-ar", "48000", "-movflags", "+faststart", "-threads", "4", "-f", "mp4", out],
        { timeout: 25 * 60 * 1000, maxBuffer: 4 * 1024 * 1024 }, (e) => {
          if (e) { console.error("[videos] couldn't make a big video smaller:", String(e.message).slice(0, 200)); rm(out, { force: true }, () => {}); return ok(false); }
          ok(existsSync(out));
        });
    });
  }));
  SHRINKING = run.catch(() => {});
  return run;
}
