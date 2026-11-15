/* ================================================================
   VISITS v1.0 — 2026-11-15. "Improve the admin dashboard to meet Google
   level analytics. From the data collection…" LABS knew which screens
   opened, but not that twelve screens were one person's one sitting, how
   long it lasted, or where it came from — and a campaign tag on a link was
   never read. This is the missing unit: the visit.
     visits   one row a sitting: the app's random visit id, the viewer
              ("u:<id>" | "d:<device>", as ui_events), when it started and
              was last heard from, how many screens, where it came from
              (source · medium · campaign), the kind of link it landed on,
              phone or computer, the device family, the country, whether
              LABS had seen this viewer before, and the member — once
              signed in — so a visit that ends in a Join can be counted.
   The app sends its visit with every batch of screen signals (POST /api/ui,
   { visit: { id, ref, land, wide } } — app/ui-signals/signals.js); a new
   visit starts after 30 minutes away.
   What is NOT kept: the network address, the full link (only what kind of
   link, and its campaign tags), the site's page (only the site), anything
   typed. Rows go after 400 days.
     GET /api/admin/visits   visits, visitors, new, left straight away,
                             length — by day, source, campaign, link,
                             device, country; filter by source, device,
                             new or returning; any dates (the dictionary's period)
     GET /api/admin/now      who's here in the last 5 and 30 minutes
   Admins only, counts only. test/visits.test.mjs
================================================================ */
db.exec(`CREATE TABLE IF NOT EXISTS visits (
  id TEXT PRIMARY KEY, viewer TEXT NOT NULL, user_id INTEGER, day INTEGER NOT NULL, started_at INTEGER NOT NULL, last_at INTEGER NOT NULL,
  screens INTEGER NOT NULL DEFAULT 0, source TEXT NOT NULL DEFAULT 'Direct', medium TEXT NOT NULL DEFAULT 'none', campaign TEXT NOT NULL DEFAULT '',
  landing TEXT NOT NULL DEFAULT '', wide INTEGER NOT NULL DEFAULT 0, device TEXT NOT NULL DEFAULT '', country TEXT NOT NULL DEFAULT '', fresh INTEGER NOT NULL DEFAULT 0);
CREATE INDEX IF NOT EXISTS idx_visits_started ON visits(started_at);
CREATE INDEX IF NOT EXISTS idx_visits_viewer ON visits(viewer, started_at);
CREATE INDEX IF NOT EXISTS idx_visits_last ON visits(last_at)`);
const VISIT_KEEP_DAYS = 400, VISIT_MAX_ROWS = 1000000, VISIT_GAP_MS = 30 * 60000, VISIT_DAY = 86400000;

/* ---- where from: one reading of a link and a referrer, for visits and for joins (insWayIn) ---- */
const SRC_TAGS = { ig: "Instagram", instagram: "Instagram", fb: "Facebook", facebook: "Facebook", meta: "Facebook", tiktok: "TikTok", tt: "TikTok", x: "X", twitter: "X", yt: "YouTube", youtube: "YouTube",
  google: "Google", email: "Email", mail: "Email", newsletter: "Email", resend: "Email", whatsapp: "WhatsApp", wa: "WhatsApp", sms: "Text message", qr: "QR code", reddit: "Reddit", discord: "Discord", pinterest: "Pinterest", linkedin: "LinkedIn" };
const srcWord = (s, n = 40) => String(s || "").toLowerCase().replace(/[^a-z0-9 ._-]/g, "").trim().slice(0, n);
/* what kind of link: the same words the admin's Ways in has always used */
function landingKind(land) {
  land = String(land || "");
  return /[?&]e=|^\/e\//.test(land) ? "a tournament link" : /[?&]p=|^\/p\//.test(land) ? "a post link" : /[?&]u=|^\/u\//.test(land) ? "a profile link"
    : /^\/s\//.test(land) ? "a song link" : /[?&]l=|^\/l\//.test(land) ? "a listing link" : /^\/(shop|market)\b/.test(land) ? "the shop" : "the front door";
}
/* { source, medium, campaign } from the referrer, the landing link and the device line (sigDevice) */
function srcOf({ referrer = "", landing = "", device = "" } = {}) {
  let tag = "", med = "", camp = "";
  try { const u = new URL(String(landing).slice(0, 600), "https://labs.local"); tag = srcWord(u.searchParams.get("utm_source")); med = srcWord(u.searchParams.get("utm_medium"), 24); camp = srcWord(u.searchParams.get("utm_campaign"), 60); } catch (e) {}
  const ref = String(referrer || "").toLowerCase().replace(/^https?:\/\//, ""), host = ref.split("/")[0].replace(/^(www|m|l|lm|mobile)\./, "");
  if (tag) return { source: Object.hasOwn(SRC_TAGS, tag) ? SRC_TAGS[tag] : tag, medium: med || "tagged link", campaign: camp };
  const social = /Instagram/.test(device) || /(^|\.)instagram\.com$/.test(host) ? "Instagram" : /Facebook/.test(device) || /(^|\.)(facebook|fb)\.com$/.test(host) ? "Facebook"
    : /TikTok/.test(device) || /(^|\.)tiktok\.com$/.test(host) ? "TikTok" : /^(t\.co|x\.com|twitter\.com)$/.test(host) ? "X" : /(^|\.)(youtube\.com|youtu\.be)$/.test(host) ? "YouTube"
    : /Snapchat/.test(device) ? "Snapchat" : /(^|\.)reddit\.com$/.test(host) ? "Reddit" : /(^|\.)pinterest\.[a-z.]+$/.test(host) ? "Pinterest" : /(^|\.)linkedin\.com$/.test(host) || host === "lnkd.in" ? "LinkedIn" : "";
  if (social) return { source: social, medium: "social", campaign: camp };
  if (/(^|\.)google\.[a-z.]+$/.test(host)) return { source: "Google", medium: "search", campaign: camp };
  if (/(^|\.)(bing\.com|duckduckgo\.com|search\.yahoo\.com|yandex\.[a-z]+|ecosia\.org|search\.brave\.com)$/.test(host)) return { source: host.split(".").slice(-2, -1)[0].replace(/^./, (c) => c.toUpperCase()), medium: "search", campaign: camp };
  if (/(^|\.)(mail\.google\.com|outlook\.[a-z.]+|mail\.yahoo\.com|proton\.me)$/.test(host)) return { source: "Email", medium: "email", campaign: camp };
  if (host && !/(^|\.)tnllabs\.com$/.test(host) && !/^localhost(:\d+)?$/.test(host)) return { source: srcWord(host, 60) || "Another site", medium: "another site", campaign: camp };
  return { source: "Direct", medium: "none", campaign: camp };
}
const visitFamily = (device) => String(device || "").split(" · ")[0] || "";

/* ---- writing: one touch per batch of screen signals ---- */
const visitGet = db.prepare(`SELECT viewer, user_id, last_at FROM visits WHERE id = ?`);
const visitNew = db.prepare(`INSERT OR IGNORE INTO visits (id, viewer, user_id, day, started_at, last_at, screens, source, medium, campaign, landing, wide, device, country, fresh) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`);
const visitMore = db.prepare(`UPDATE visits SET last_at = ?, screens = screens + ?, user_id = COALESCE(user_id, ?), viewer = ? WHERE id = ?`);
const visitSeenBefore = db.prepare(`SELECT (EXISTS (SELECT 1 FROM visits WHERE viewer = ?1) OR EXISTS (SELECT 1 FROM ui_events WHERE viewer = ?1 AND created_at < ?2)) n`);
let visitWrites = 0;
function visitTouch(req, viewer, v, views, now = Date.now()) {
  if (!viewer || !v || typeof v !== "object") return false;
  const id = String(v.id || "").toLowerCase();
  if (!/^[a-f0-9]{16,32}$/.test(id)) return false;
  views = Math.max(0, Math.min(60, Math.round(views) || 0));
  const uid = req.user ? req.user.id : null, row = visitGet.get(id);
  if (row) {
    /* the same sitting: the same viewer, or the device it was before it signed in. Anyone else's id is ignored. */
    const dev = deviceOf(req) ? "d:" + deviceOf(req) : "";
    if (row.viewer !== viewer && row.viewer !== dev && !(uid && row.user_id === uid)) return false;
    visitMore.run(now, views, uid, uid ? "u:" + uid : row.viewer, id);
    return true;
  }
  const ua = String(req.get("user-agent") || "").slice(0, 400), device = sigDevice(ua);
  if (/automated/.test(device)) return false;   // a script isn't a visit
  const land = sigLanding(v.land), s = srcOf({ referrer: sigReferrer(v.ref), landing: land, device });
  const fresh = visitSeenBefore.get(viewer, now - VISIT_GAP_MS).n ? 0 : 1;
  visitNew.run(id, viewer, uid, Math.floor(now / VISIT_DAY), now, now, views, s.source, s.medium, s.campaign, landingKind(land), v.wide ? 1 : 0, visitFamily(device), sigCountry(req), fresh);
  if (++visitWrites >= 2000) { visitWrites = 0; visitPrune(now); }
  return true;
}
function visitPrune(now = Date.now()) {
  const n = db.prepare(`DELETE FROM visits WHERE started_at < ?`).run(now - VISIT_KEEP_DAYS * VISIT_DAY).changes;
  db.prepare(`DELETE FROM visits WHERE rowid <= (SELECT rowid FROM visits ORDER BY rowid DESC LIMIT 1 OFFSET ?)`).run(VISIT_MAX_ROWS);
  return n;
}
if (!process.env.TNL_NO_WATCH) setInterval(() => { try { visitPrune(); } catch (e) {} }, VISIT_DAY).unref?.();

/* ---- reading ---- */
const visitMedian = (xs) => { if (!xs.length) return 0; const a = [...xs].sort((x, y) => x - y); return a[a.length >> 1]; };
function visitStats(rows) {
  const viewers = new Set(rows.map((r) => r.viewer)), bounced = rows.filter((r) => r.screens <= 1).length;
  return { visits: rows.length, visitors: viewers.size, fresh: new Set(rows.filter((r) => r.fresh).map((r) => r.viewer)).size,
    bounce: rows.length ? Math.round((bounced / rows.length) * 100) : 0, screens: rows.length ? Math.round((rows.reduce((s, r) => s + r.screens, 0) / rows.length) * 10) / 10 : 0,
    secs: Math.round(visitMedian(rows.filter((r) => r.screens > 1).map((r) => r.last_at - r.started_at)) / 1000), joined: rows.filter((r) => r.joined).length };
}
/* the filters the admin can set: a source, phone or computer, new or returning */
function visitRows(a, b, f = {}) {
  const where = [`v.started_at > ?`, `v.started_at <= ?`], p = [a, b];
  if (f.source) { where.push(`v.source = ?`); p.push(String(f.source).slice(0, 60)); }
  if (f.device === "phone" || f.device === "computer") where.push(`v.wide = ${f.device === "computer" ? 1 : 0}`);
  if (f.who === "new" || f.who === "back") where.push(`v.fresh = ${f.who === "new" ? 1 : 0}`);
  /* joined: the member joined during this very visit (a minute's grace before it, for the clock) */
  return db.prepare(`SELECT v.viewer, v.started_at, v.last_at, v.screens, v.source, v.medium, v.campaign, v.landing, v.wide, v.device, v.country, v.fresh,
    (u.id IS NOT NULL AND u.created_at >= v.started_at - 60000 AND u.created_at <= v.last_at + 60000 AND COALESCE(u.suspended, 0) = 0) joined
    FROM visits v LEFT JOIN users u ON u.id = v.user_id WHERE ${where.join(" AND ")}`).all(...p);
}
function visitReport(q, now = Date.now()) {
  const { days, start, end, prevStart } = mWindow(q, now, null);
  const f = { source: q.source ? String(q.source) : "", device: String(q.device || ""), who: String(q.who || "") };
  const rows = visitRows(start, end, f), before = visitRows(prevStart, start, f);
  const by = (keyOf, limit = 12) => { const m = new Map(); for (const r of rows) { const k = keyOf(r); if (!k) continue; if (!m.has(k)) m.set(k, []); m.get(k).push(r); }
    return [...m].map(([name, rs]) => ({ name, ...visitStats(rs) })).sort((x, y) => y.visits - x.visits).slice(0, limit); };
  const series = (rs, from) => { const v = new Array(days).fill(0), who = Array.from({ length: days }, () => new Set());
    for (const r of rs) { const d = Math.floor((r.started_at - from) / VISIT_DAY); if (d >= 0 && d < days) { v[d]++; who[d].add(r.viewer); } }
    return { visits: v, visitors: who.map((s) => s.size) }; };
  const all = db.prepare(`SELECT source, COUNT(*) n FROM visits WHERE started_at > ? AND started_at <= ? GROUP BY source ORDER BY n DESC LIMIT 30`).all(start, end);
  return { days, start, end, prevStart, filter: f, since: db.prepare(`SELECT MIN(started_at) t FROM visits`).get().t || null,
    now: visitStats(rows), before: visitStats(before), series: series(rows, start), prev: series(before, prevStart),
    sources: all.map((r) => r.source),
    bySource: by((r) => r.source).map((s) => ({ ...s, medium: (rows.find((r) => r.source === s.name) || {}).medium || "" })),
    byCampaign: by((r) => r.campaign), byLanding: by((r) => r.landing), byDevice: by((r) => (r.wide ? "Computer" : "Phone") + (r.device ? " · " + r.device : "")),
    byCountry: by((r) => r.country, 15) };
}
app.get("/api/admin/visits", auth, admin, (req, res) => res.json(visitReport(req.query)));

/* who's here: heard from in the last 5 minutes (a screen signal, or a signed-in member's "still here"), and the half hour behind it */
app.get("/api/admin/now", auth, admin, (req, res) => {
  const now = Date.now(), m5 = now - 5 * 60000, m30 = now - 30 * 60000;
  /* from visits, not raw signals: a script isn't a visit, and a guest who signs in is one person */
  const here = new Set(db.prepare(`SELECT DISTINCT viewer FROM visits WHERE last_at > ?`).all(m5).map((r) => r.viewer));
  try { for (const r of db.prepare(`SELECT user_id FROM member_time WHERE last_at > ?`).all(m5)) here.add("u:" + r.user_id); } catch (e) {}
  const minutes = new Array(30).fill(0);
  for (const r of db.prepare(`SELECT CAST((created_at - ?1) / 60000 AS INTEGER) m, COUNT(DISTINCT viewer) n FROM ui_events WHERE created_at > ?1 GROUP BY m`).all(m30)) if (r.m >= 0 && r.m < 30) minutes[r.m] = r.n;
  const screens = db.prepare(`SELECT screen, COUNT(DISTINCT viewer) people FROM ui_events WHERE kind = 'view' AND created_at > ? GROUP BY screen ORDER BY people DESC LIMIT 8`).all(m30)
    .map((r) => ({ screen: r.screen, name: screenName(r.screen), people: r.people }));
  const live = db.prepare(`SELECT source, COUNT(DISTINCT viewer) people FROM visits WHERE last_at > ? GROUP BY source ORDER BY people DESC LIMIT 6`).all(m30);
  const { start } = mWindow({ days: 1, tz: req.query.tz }, now, null);   // today, from the admin's midnight
  res.json({ at: now, here: here.size, members: [...here].filter((v) => v.startsWith("u:")).length, minutes, screens, sources: live.map((r) => ({ name: r.source, people: r.people })),
    today: { visits: mOne(`SELECT COUNT(*) n FROM visits WHERE started_at > ?`, start), visitors: mOne(`SELECT COUNT(DISTINCT viewer) n FROM visits WHERE started_at > ?`, start),
      joined: M.joined(start, now), tookPart: M.tookPart(start, now), work: M.work(start, now), sales: M.sales(start, now) } });
});
