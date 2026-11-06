/* ================================================================
   UPLOADS IN PIECES v1.0 — 2026-11-06. "Now it's getting stuck at 5%. I've
   been trying to upload this video this whole week now." A 121MB video went
   up as one long request; on a phone signal (in a car, between towers) that
   request can stall with no error, and a retry started again from 0%. Like
   Meta and YouTube, a big file now goes up in pieces: a piece that drops is
   sent again, and the upload picks up from the last piece that landed —
   after a dropped signal, a stalled request, or a deploy restarting the
   server.

     POST /api/upload/pieces            { size }  → { id, piece }
     PUT  /api/upload/pieces/:id?at=N   the next piece, raw bytes, from byte N → { have }
     GET  /api/upload/pieces/:id        how much has landed → { have, size }
     POST /api/upload/pieces/:id/done   all of it → the same answer as /api/upload/stream

   A piece must start where the last one ended (409 says where that is), so
   a piece sent twice is never stored twice. The file is checked the same way
   as a streamed one: its first bytes say what it is, and its kind's limit
   holds. What's in flight lives on the volume (.part-<id> and .part-<id>.json,
   who and how big), so a restart doesn't lose it; one left for a day is
   cleared away. An id is 24 random hex characters and belongs to the member
   who started it.
================================================================ */
const PIECE = 4 * 1024 * 1024;                 // what the app sends at a time
const PIECE_MAX = PIECE + 64 * 1024;           // a little slack; anything bigger is refused
const PIECE_TTL = 24 * 3600 * 1000;
const pieceFiles = (id) => ({ data: join(UPLOAD_DIR, `.part-${id}`), meta: join(UPLOAD_DIR, `.part-${id}.json`) });
const pieceHave = (id) => { try { return statSync(pieceFiles(id).data).size; } catch { return -1; } };
function pieceMeta(req, res) {
  const id = String(req.params.id || "");
  if (!/^[a-f0-9]{24}$/.test(id)) { res.status(404).json({ error: "That upload isn't here any more — try again" }); return null; }
  let m = null; try { m = JSON.parse(readFileSync(pieceFiles(id).meta, "utf8")); } catch {}
  if (!m || m.userId !== req.user.id || pieceHave(id) < 0) { res.status(404).json({ error: "That upload isn't here any more — try again" }); return null; }
  return { id, ...m };
}

app.post("/api/upload/pieces", auth, verified, rateLimit({ max: 120, windowMs: 300000, key: "user" }), (req, res) => {
  const size = Math.floor(Number(req.body?.size) || 0);
  if (!(size > 0)) return res.status(400).json({ error: "no file" });
  if (size > VIDEO_MAX) return res.status(413).json({ error: `That file's too big — ${VIDEO_MAX / 1073741824}GB max` });
  if (!videoRoom(size)) return res.status(507).json({ error: size > VIDEO_KEEP ? "LABS is short on space for a video this big right now — try a shorter one" : "LABS is short on space right now — try again later" });
  const id = randomBytes(12).toString("hex"), f = pieceFiles(id);
  try { writeFileSync(f.data, ""); writeFileSync(f.meta, JSON.stringify({ userId: req.user.id, size, at: Date.now() })); }
  catch { return res.status(500).json({ error: "couldn't start the upload" }); }
  res.json({ id, piece: PIECE });
});

app.get("/api/upload/pieces/:id", auth, (req, res) => {
  const m = pieceMeta(req, res); if (!m) return;
  res.json({ have: pieceHave(m.id), size: m.size });
});

/* 2GB in 4MB pieces is 512 of them, and a bad signal sends some twice. */
app.put("/api/upload/pieces/:id", auth, rateLimit({ max: 3000, windowMs: 300000, key: "user" }), (req, res) => {
  const m = pieceMeta(req, res); if (!m) return;
  const have = pieceHave(m.id), at = Number(req.query.at);
  if (at !== have) { req.resume(); return res.status(409).json({ have }); }   // not where we are: say where that is
  const declared = Number(req.get("content-length") || 0);
  if (declared > PIECE_MAX || have + declared > m.size) { req.resume(); return res.status(413).json({ error: "That piece is too big" }); }
  UPLOADS_IN_FLIGHT++;
  res.once("close", () => { UPLOADS_IN_FLIGHT--; });
  const chunks = []; let n = 0, over = false;
  req.on("data", (c) => { if (over) return; n += c.length; if (n > PIECE_MAX || have + n > m.size) { over = true; return; } chunks.push(c); });
  req.on("aborted", () => { over = true; });
  req.on("end", () => {
    if (over) return res.headersSent || res.status(413).json({ error: "That piece is too big" });
    if (pieceHave(m.id) !== have) return res.status(409).json({ have: pieceHave(m.id) });   // another copy of this piece landed first
    try { appendFileSync(pieceFiles(m.id).data, Buffer.concat(chunks)); }
    catch { return res.status(500).json({ error: "write failed" }); }
    res.json({ have: have + n });
  });
});

app.post("/api/upload/pieces/:id/done", auth, verified, (req, res) => {
  const m = pieceMeta(req, res); if (!m) return;
  const f = pieceFiles(m.id), have = pieceHave(m.id);
  if (have !== m.size) return res.status(409).json({ have, error: "Not all of it has arrived yet" });
  let head = Buffer.alloc(16);
  try { const fd = openSync(f.data, "r"); readSync(fd, head, 0, 16, 0); closeSync(fd); } catch {}
  const type = sniff(head);
  const drop = () => { rm(f.data, { force: true }, () => {}); rm(f.meta, { force: true }, () => {}); };
  if (!type) { drop(); return res.status(400).json({ error: "unsupported file type" }); }
  if (have > LIMITS[type.kind]) { drop(); return res.status(413).json({ error: `That ${type.kind} is too big — ${type.kind === "video" ? "2GB" : LIMITS[type.kind] / 1048576 + "MB"} max` }); }
  /* from here it's the same as a streamed upload; the .part file becomes the saved one */
  rm(f.meta, { force: true }, () => {});
  UPLOADS_IN_FLIGHT++;
  res.once("close", () => { UPLOADS_IN_FLIGHT--; });
  uploadLand(f.data, type, have, res);
});

/* Pieces nobody finished: cleared after a day. */
function piecesSweep() {
  try {
    for (const n of readdirSync(UPLOAD_DIR)) {
      const mt = /^\.part-([a-f0-9]{24})\.json$/.exec(n); if (!mt) continue;
      let at = 0; try { at = JSON.parse(readFileSync(join(UPLOAD_DIR, n), "utf8")).at || 0; } catch {}
      if (Date.now() - at > PIECE_TTL) { const f = pieceFiles(mt[1]); rmSync(f.data, { force: true }); rmSync(f.meta, { force: true }); }
    }
  } catch (e) { console.error("[uploads] pieces sweep:", e.message); }
}
setInterval(piecesSweep, 3600 * 1000).unref?.();
setTimeout(piecesSweep, 30000).unref?.();
