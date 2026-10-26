/* JSON bodies (moved out of server-01-boot on 2026-10-26: that part is full).
   Real media does NOT come through here — it streams to disk via
   /api/upload/stream. This limit only covers small base64 payloads
   (avatars, beat audio), and stays low on purpose: anything parsed as
   JSON is held in RAM in full. Meta signs its webhook deliveries over the
   raw bytes, so that one route keeps them (server-12-instagram-inbox). */
app.use(express.json({ limit: "12mb", verify: (req, _res, buf) => { if (req.path === "/api/instagram/webhook") req.rawBody = buf; } })); // only the small base64 route uses this now
