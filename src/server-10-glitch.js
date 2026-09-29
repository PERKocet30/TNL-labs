/* ================================================================
   GLITCH SIGNALS v1.0 — 2026-09-29
   Crashes land in error_log. This is for the moments that don't crash but
   feel broken, reported quietly by members' own phones (app-19-glitch.js):
     rage_tap       the same control tapped 3+ times in a second
     layout_jump    the screen moved while someone was reading
     slow_screen    a screen's data took over 3 seconds to arrive
     action_failed  a like, post, message… the server refused or lost
   Kept 30 days. Admin → System → Glitches reads it; part 3 alerts on it.
================================================================ */
db.exec(`
CREATE TABLE IF NOT EXISTS glitch_events (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  kind       TEXT NOT NULL,
  place      TEXT NOT NULL DEFAULT '',
  detail     TEXT NOT NULL DEFAULT '',
  device     TEXT NOT NULL DEFAULT '',
  username   TEXT NOT NULL DEFAULT '',
  created_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_glitch_time ON glitch_events(created_at);
CREATE INDEX IF NOT EXISTS idx_glitch_kind ON glitch_events(kind, created_at);
`);
const GLITCH_KINDS = ["rage_tap", "layout_jump", "slow_screen", "action_failed"];
const insGlitch = db.prepare(`INSERT INTO glitch_events (kind, place, detail, device, username, created_at) VALUES (?, ?, ?, ?, ?, ?)`);
/* Anyone can report (guests too), so it stays bounded: 30 days, and never
   more than 50,000 rows however hard someone leans on it. */
const pruneGlitch = () => {
  db.prepare(`DELETE FROM glitch_events WHERE created_at < ?`).run(Date.now() - 30 * 86400000);
  db.prepare(`DELETE FROM glitch_events WHERE id <= (SELECT id FROM glitch_events ORDER BY id DESC LIMIT 1 OFFSET 50000)`).run();
};
pruneGlitch();
let glitchWrites = 0;

const clip = (v, n) => String(v == null ? "" : v).replace(/[\u0000-\u001f]/g, " ").slice(0, n);
app.post("/api/glitch", maybeAuth, rateLimit({ max: 30, windowMs: 60000 }), (req, res) => {
  const list = Array.isArray(req.body?.events) ? req.body.events.slice(0, 10) : [];
  const device = req.body?.device === "computer" ? "computer" : "phone";
  const now = Date.now();
  let n = 0;
  for (const e of list) {
    if (!e || !GLITCH_KINDS.includes(e.kind)) continue;
    insGlitch.run(e.kind, clip(e.place, 80), clip(e.detail, 240), device, clip(req.user?.username, 40), now);
    n++;
  }
  if ((glitchWrites += n) >= 1000) { glitchWrites = 0; pruneGlitch(); }
  res.json({ ok: true, saved: n });
});

/* What's felt broken lately: counts by kind and by where, and the latest few. */
app.get("/api/admin/glitches", auth, admin, (_req, res) => {
  const now = Date.now(), day = now - 86400000, week = now - 7 * 86400000;
  const byKind = db.prepare(`SELECT kind, SUM(created_at >= ?) AS day, COUNT(*) AS week FROM glitch_events
    WHERE created_at >= ? GROUP BY kind ORDER BY week DESC`).all(day, week);
  const hotspots = db.prepare(`SELECT kind, place, detail, COUNT(*) AS n, COUNT(DISTINCT NULLIF(username, '')) AS people, MAX(created_at) AS last
    FROM glitch_events WHERE created_at >= ? GROUP BY kind, place, detail ORDER BY n DESC LIMIT 15`).all(week);
  const recent = db.prepare(`SELECT kind, place, detail, device, username, created_at FROM glitch_events ORDER BY id DESC LIMIT 25`).all();
  res.json({ last24h: byKind.reduce((s, k) => s + (k.day || 0), 0), byKind, hotspots, recent });
});
