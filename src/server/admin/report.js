/* ================================================================
   MORNING REPORT v1.0 — 2026-10-18. "The daily check fails at actually
   checking anything since it doesn't have access to a lot." One locked,
   read-only answer the morning check reads instead of needing a way into
   Railway, Sentry or an admin login:
     GET /api/report/daily   Authorization: Bearer <TNL_REPORT_KEY>
   Counts and the shape of problems only — never a member's name, email,
   message or address. Error messages are clipped and have anything that
   looks like an email or a long token blanked out.
   Off unless Railway → Variables has TNL_REPORT_KEY (32+ characters): with
   no key the route doesn't exist (404). A wrong key is 401, compared in
   constant time, and the route is rate-limited. test/report.test.mjs.
================================================================ */
import { timingSafeEqual, createHash as reportHash } from "node:crypto";
import { statfsSync } from "node:fs";

const REPORT_KEY = String(process.env.TNL_REPORT_KEY || "");
const reportKeyOk = (h) => {
  const m = /^Bearer\s+(.+)$/i.exec(String(h || ""));
  if (!m || REPORT_KEY.length < 32) return false;
  const a = reportHash("sha256").update(m[1].trim()).digest(), b = reportHash("sha256").update(REPORT_KEY).digest();
  return timingSafeEqual(a, b);
};
/* what an error says, without anything personal that slipped into it */
const reportScrub = (s) => String(s || "")
  .replace(/[^\s@]+@[^\s@]+\.[a-z]{2,}/gi, "[email]")
  .replace(/\b[A-Za-z0-9_-]{24,}\b/g, "[token]")
  .replace(/[\u0000-\u001f]/g, " ").slice(0, 160);

app.get("/api/report/daily", rateLimit({ max: 20, windowMs: 60000 }), (req, res) => {
  if (REPORT_KEY.length < 32) return res.status(404).json({ error: "Not found" });
  res.set("Cache-Control", "no-store");
  if (!reportKeyOk(req.headers.authorization)) return res.status(401).json({ error: "Not allowed" });
  const now = Date.now(), H = 3600000, D = 24 * H, d1 = now - D, d2 = now - 2 * D;
  const n = (sql, ...p) => { try { return db.prepare(sql).get(...p)?.n ?? 0; } catch { return null; } };
  const two = (table) => ({ today: n(`SELECT COUNT(*) n FROM ${table} WHERE created_at >= ?`, d1),
    dayBefore: n(`SELECT COUNT(*) n FROM ${table} WHERE created_at >= ? AND created_at < ?`, d2, d1) });

  const errors = {
    last24h: n(`SELECT COUNT(*) n FROM error_log WHERE created_at >= ?`, d1),
    byKind: db.prepare(`SELECT kind, COUNT(*) n FROM error_log WHERE created_at >= ? GROUP BY kind ORDER BY n DESC`).all(d1),
    top: db.prepare(`SELECT kind, message, MAX(path) path, COUNT(*) n, COUNT(DISTINCT NULLIF(username, '')) people, MAX(created_at) last
      FROM error_log WHERE created_at >= ? GROUP BY kind, message ORDER BY n DESC LIMIT 8`).all(d1)
      .map((e) => ({ kind: e.kind, message: reportScrub(e.message), path: reportScrub(e.path).replace(/\/\d+/g, "/:id"), times: e.n, people: e.people, last: e.last })),
  };
  const glitches = {
    last24h: n(`SELECT COUNT(*) n FROM glitch_events WHERE created_at >= ?`, d1),
    byKind: db.prepare(`SELECT kind, COUNT(*) n FROM glitch_events WHERE created_at >= ? GROUP BY kind ORDER BY n DESC`).all(d1),
    hotspots: db.prepare(`SELECT kind, place, detail, COUNT(*) n, COUNT(DISTINCT NULLIF(username, '')) people FROM glitch_events
      WHERE created_at >= ? GROUP BY kind, place, detail ORDER BY n DESC LIMIT 8`).all(d1)
      .map((g) => ({ kind: g.kind, place: reportScrub(g.place), detail: reportScrub(g.detail), times: g.n, people: g.people })),
  };
  const activity = { signups: two("users"), posts: two("posts"), comments: two("comments"), messages: two("dm_messages"),
    members: n(`SELECT COUNT(*) n FROM users`), unhandledReports: n(`SELECT COUNT(*) n FROM reports WHERE handled_at IS NULL`) };

  let backup = { count: 0, newestHoursAgo: null };
  try {
    const fs = readdirSync(BACKUP_DIR).filter((f) => f.endsWith(".db")).map((f) => statSync(join(BACKUP_DIR, f)).mtimeMs);
    backup = { count: fs.length, newestHoursAgo: fs.length ? Math.round((now - Math.max(...fs)) / H * 10) / 10 : null };
  } catch {}
  let disk = null;
  try { const s = statfsSync(DATA_DIR); disk = { freeMB: Math.round(s.bavail * s.bsize / 1048576), usedPct: Math.round(100 - (s.bavail / s.blocks) * 100) }; } catch {}
  let dbMB = null;
  try { dbMB = Math.round(statSync(join(DATA_DIR, "tnl.db")).size / 1048576 * 10) / 10; } catch {}

  const payments = { enabled: !!PAYMENTS_ENABLED,
    errors24h: n(`SELECT COUNT(*) n FROM error_log WHERE kind = 'pay' AND created_at >= ?`, d1),
    ordersToday: n(`SELECT COUNT(*) n FROM orders WHERE created_at >= ?`, d1),
    stuckPending: n(`SELECT COUNT(*) n FROM orders WHERE status = 'pending' AND created_at < ?`, now - H) };

  res.json({
    at: now, commit: (process.env.RAILWAY_GIT_COMMIT_SHA || "").slice(0, 7), uptimeH: Math.round(process.uptime() / 360) / 10,
    memMB: Math.round(process.memoryUsage().rss / 1048576), onVolume: !!process.env.TNL_DATA, mail: !!MAIL_ENABLED,
    errors, glitches, activity, backup, disk, dbMB, payments,
  });
});
