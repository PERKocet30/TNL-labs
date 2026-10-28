/* ── LOOP PREVIEW · v1.0 · 2026-10-27 ─────────────────────────────────
   A paid loop's own file only goes to the people who bought it (loopAudio,
   server-01-guard). Everyone else hears this: the first 30 seconds, mono,
   96k MP3. Enough to judge it, not the file you'd make a track with.
   Made once with ffmpeg and kept beside the uploads; a new file on the
   listing gets a new name, so an old preview is never served for it. */
const PREVIEW_DIR = join(DATA_DIR, "previews");
app.get("/api/market/:id/preview.mp3", rateLimit({ max: 120, windowMs: 60000 }), (req, res) => {
  const l = db.prepare(`SELECT id, kind, status, audio_url FROM listings WHERE id = ?`).get(Number(req.params.id));
  const name = String(l?.audio_url || "").match(/^\/uploads\/([A-Za-z0-9._-]+)$/)?.[1];
  if (!l || l.kind !== "loop" || l.status !== "active" || !name || !existsSync(join(UPLOAD_DIR, name)))
    return res.status(404).json({ error: "no preview" });
  const out = pathResolve(PREVIEW_DIR, `loop-${l.id}-${createHash("sha256").update(name).digest("hex").slice(0, 12)}.mp3`);
  const send = () => res.type("audio/mpeg").sendFile(out);
  if (existsSync(out)) return send();
  if (!FFMPEG) return res.status(503).json({ error: "preview isn't available right now" });
  mkdirSync(PREVIEW_DIR, { recursive: true });
  const tmp = `${out}.${randomBytes(4).toString("hex")}.part`;
  const fail = () => { rm(tmp, { force: true }, () => {}); if (!res.headersSent) res.status(500).json({ error: "couldn't make a preview" }); };
  execFile(FFMPEG, ["-nostdin", "-y", "-i", join(UPLOAD_DIR, name), "-t", "30", "-vn", "-ac", "1", "-b:a", "96k", "-f", "mp3", tmp],
    { timeout: 60000, maxBuffer: 1024 * 1024 }, (err) => {
      if (err || !existsSync(tmp)) return fail();
      rename(tmp, out, (e) => (e ? fail() : send()));
    });
});
