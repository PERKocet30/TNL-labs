/* ================================================================
   THE ADDRESS v1.0 — 2026-10-18. "Switch everything to tnllabs.com" —
   the app moves from labs.tnllabs.com to tnllabs.com (DNS on Cloudflare,
   which can point a bare domain at Railway; www forwards here too).
   Off until Railway → Variables has CANONICAL_HOST (tnllabs.com),
   so nothing changes before the new address works. Then:
     - a page on an old address (a shared /u/, /p/, /e/, /l/, /s/… link)
       answers 301 to the same path on the new one;
     - the app shell, its files, /uploads and /api still answer on the old
       address, so open tabs and installed home-screen apps keep working;
       the shell then moves itself (app/core/address.js);
     - a sign-in lives in each address's own storage, so moving would sign
       everyone out. POST /api/auth/handoff gives a signed-in member a
       one-use code good for 60 seconds, and the new address trades it for
       a fresh session (/api/auth/handoff/claim). The link only ever points
       at CANONICAL_HOST, with a path on this site — never anywhere else.
   test/address.test.mjs.
================================================================ */
const CANON = String(process.env.CANONICAL_HOST || "").trim().toLowerCase()
  .replace(/^https?:\/\//, "").replace(/[/?#].*$/, "");
const OLD_HOSTS = new Set(["labs.tnllabs.com", "tnllabs.com", "www.tnllabs.com"].filter((h) => h !== CANON));
const HANDOFF = new Map();   // code -> { uid, exp }
const handoffPath = (p) => { const s = String(p || "/"); return /^\/(?![/\\])/.test(s) && s.length <= 500 ? s : "/"; };

app.use((req, res, next) => {
  if (!CANON || !OLD_HOSTS.has(String(req.hostname || "").toLowerCase())) return next();
  if ((req.method !== "GET" && req.method !== "HEAD") || req.path.startsWith("/api/")) return next();
  res.redirect(301, `https://${CANON}${req.originalUrl}`);
});

app.get("/api/address", (_req, res) => res.json({ canonical: CANON || null }));

app.post("/api/auth/handoff", maybeAuth, rateLimit({ max: 20, windowMs: 60000 }), (req, res) => {
  if (!CANON) return res.json({ url: null });
  const path = handoffPath(req.body?.next);
  if (!req.user) return res.json({ url: `https://${CANON}${path}` });
  const now = Date.now();
  for (const [c, h] of HANDOFF) if (h.exp < now) HANDOFF.delete(c);
  const code = randomBytes(24).toString("hex");
  HANDOFF.set(code, { uid: req.user.id, exp: now + 60000 });
  res.json({ url: `https://${CANON}${path}${path.includes("?") ? "&" : "?"}handoff=${code}` });
});

app.post("/api/auth/handoff/claim", rateLimit({ max: 20, windowMs: 60000 }), (req, res) => {
  const code = String(req.body?.code || ""), h = HANDOFF.get(code);
  HANDOFF.delete(code);   // one use, whatever happens
  if (!h || h.exp < Date.now()) return res.status(400).json({ error: "That link has expired. Log in again." });
  const user = db.prepare(`SELECT id, suspended FROM users WHERE id = ?`).get(h.uid);
  if (!user || user.suspended) return res.status(400).json({ error: "That link has expired. Log in again." });
  const token = randomBytes(24).toString("hex");
  q.createSession.run(token, user.id, Date.now());
  res.json({ token });
});
