/* ================================================================
   VISITS & SLOW REQUESTS v1.0 — 2026-10-29. "Who comes back after day 1,
   day 7, day 30" and "any slow pages or failed requests" (Grok, reading
   the connector). LABS only knew what people *did* — a post, a like, a
   vote — not that they opened the app and looked around.
   · member_days: one row per member per day (UTC) they used the app
     signed in. Written from auth() (server-02), once per member per day
     (a memory check skips the database after the first). Nothing else:
     no pages, no times, no place.
   · slow_requests: an /api request that took over 1.5 seconds or failed
     on our side (5xx) — the route with numbers swapped for :id, how long,
     the status. Kept 14 days. No one is named.
   Read by the connector's insights (server/connector/insights-*.js).
================================================================ */
db.exec(`CREATE TABLE IF NOT EXISTS member_days (user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE, day INTEGER NOT NULL, PRIMARY KEY (user_id, day));
CREATE INDEX IF NOT EXISTS idx_member_days_day ON member_days(day);
CREATE TABLE IF NOT EXISTS slow_requests (id INTEGER PRIMARY KEY AUTOINCREMENT, route TEXT NOT NULL, method TEXT NOT NULL, ms INTEGER NOT NULL, status INTEGER NOT NULL, at INTEGER NOT NULL);
CREATE INDEX IF NOT EXISTS idx_slow_requests_at ON slow_requests(at);`);

const DAY_MS = 86400000;
var visitSeen = new Set(), visitDay = 0, visitAdd = null;
function memberDay(userId, now = Date.now()) {
  const day = Math.floor(now / DAY_MS);
  if (day !== visitDay) { visitDay = day; visitSeen = new Set(); }
  if (visitSeen.has(userId)) return;
  visitSeen.add(userId);
  try { (visitAdd ||= db.prepare(`INSERT OR IGNORE INTO member_days (user_id, day) VALUES (?, ?)`)).run(userId, day); } catch (e) {}
}

/* /api/posts/123/like → /api/posts/:id/like; /api/people/sarah.b → /api/people/:name */
const slowRoute = (p) => String(p || "").slice(0, 120).replace(/\/\d+(?=\/|$)/g, "/:id")
  .replace(/^(\/api\/(?:people|users|u|profile)\/)[^/]+/, "$1:name").replace(/^(\/api\/events\/)(?!:id)[^/]+/, "$1:slug");
const slowLog = db.prepare(`INSERT INTO slow_requests (route, method, ms, status, at) VALUES (?,?,?,?,?)`);
app.use((req, res, next) => {
  /* the live feed stays open on purpose, and an upload takes as long as the file */
  if (!req.path.startsWith("/api/") || req.path === "/api/stream" || /upload/.test(req.path)) return next();
  const t0 = process.hrtime.bigint();
  res.on("finish", () => {
    const ms = Number((process.hrtime.bigint() - t0) / 1000000n);
    if (ms < 1500 && res.statusCode < 500) return;
    try {
      const now = Date.now();
      slowLog.run(slowRoute(req.path), req.method, ms, res.statusCode, now);
      if (Math.random() < 0.02) db.prepare(`DELETE FROM slow_requests WHERE at < ?`).run(now - 14 * DAY_MS);
    } catch (e) {}
  });
  next();
});
