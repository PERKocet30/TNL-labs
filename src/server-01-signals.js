/* ================================================================
   REAL PEOPLE OR BOTS v1.1 — 2026-10-27 (address from clientIp, server-01-guard); v1.0 — 2026-10-26. "I don't trust all these new
   accounts. I want to collect more data on them to make sure they're
   real accounts, not bots." (The tournament's voting opened that day.)

   What's written down, and when — for admins only, never shown to
   members or on a public page:
   · joining (POST /api/auth/register): the network they joined from (a
     salted hash of the IP — two accounts on one network get the same
     hash, the address itself isn't kept), where it is — country, and city and
     region when Cloudflare's visitor location headers are on — the time
     zone the phone's own clock is set to (a mismatch hints at a VPN),
     the phone/browser, how they joined (email, Google, Apple, Facebook),
     the first link that brought this browser to LABS and where from (an
     Instagram vote link names the entry), and how many seconds Join took.
   · logging in (password, or Google / Apple / Facebook) and voting
     (POST /api/events/:slug/vote): network, country and device again —
     each vote with the entry it was for.
   It's a middleware that watches those requests finish (status 200), so
   the routes themselves don't change.
   Admin reads it two ways: a member's record (Overview → "How they
   joined", with the accounts that share a network with them) and a
   tournament's vote check (server-11-signals-admin). One home network or
   a phone carrier can put strangers on one address, so "shares a
   network" is a reason to look, not proof.
================================================================ */
db.exec(`CREATE TABLE IF NOT EXISTS signal_salt (id INTEGER PRIMARY KEY CHECK (id = 1), salt TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS join_signals (
  user_id INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  net TEXT NOT NULL DEFAULT '', country TEXT NOT NULL DEFAULT '', city TEXT NOT NULL DEFAULT '', region TEXT NOT NULL DEFAULT '', tz TEXT NOT NULL DEFAULT '',
  device TEXT NOT NULL DEFAULT '', ua TEXT NOT NULL DEFAULT '',
  via TEXT NOT NULL DEFAULT 'email', landing TEXT NOT NULL DEFAULT '', referrer TEXT NOT NULL DEFAULT '',
  first_seen INTEGER, join_secs INTEGER, created_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS member_signals (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  kind TEXT NOT NULL, net TEXT NOT NULL DEFAULT '', country TEXT NOT NULL DEFAULT '', city TEXT NOT NULL DEFAULT '', region TEXT NOT NULL DEFAULT '', tz TEXT NOT NULL DEFAULT '',
  device TEXT NOT NULL DEFAULT '',
  event_id INTEGER, entry_id INTEGER, at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_member_signals_user ON member_signals(user_id, at);
CREATE INDEX IF NOT EXISTS idx_member_signals_net ON member_signals(net);
CREATE INDEX IF NOT EXISTS idx_member_signals_event ON member_signals(event_id, entry_id);
CREATE INDEX IF NOT EXISTS idx_join_signals_net ON join_signals(net);`);

const SIG_SALT = (() => {
  const r = db.prepare(`SELECT salt FROM signal_salt WHERE id = 1`).get();
  if (r) return r.salt;
  const s = randomBytes(32).toString("hex");
  db.prepare(`INSERT INTO signal_salt (id, salt) VALUES (1, ?)`).run(s);
  return s;
})();
/* Cloudflare's CF-Connecting-IP is the only address header it guarantees (see rateLimit, server-01-boot). */
const sigIp = (req) => clientIp(req);
const sigNet = (req) => { const ip = sigIp(req); return ip ? createHmac("sha256", SIG_SALT).update(ip).digest("hex").slice(0, 16) : ""; };
const sigCountry = (req) => { const c = String(req.get("cf-ipcountry") || "").toUpperCase(); return /^[A-Z]{2}$/.test(c) && c !== "XX" ? c : ""; };
/* City and region come from Cloudflare's "Add visitor location headers" (Rules → Settings → Managed Transforms);
   without it they're empty. The phone's time zone comes from the app itself (X-TZ, app-07 req). No GPS: nobody is asked for their location. */
const sigClean = (s, n) => { s = String(s || ""); try { s = decodeURIComponent(escape(s)); } catch {} return s.replace(/[^\p{L}\p{N} .,'()-]/gu, "").trim().slice(0, n); };
const sigPlace = (req) => {
  const tz = String(req.get("x-tz") || "");
  return { city: sigClean(req.get("cf-ipcity"), 60), region: sigClean(req.get("cf-region"), 60), tz: /^[A-Za-z]+(\/[A-Za-z0-9_+-]+){1,2}$/.test(tz) && tz.length <= 40 ? tz : "" };
};
/* "iPhone · Instagram app", "Android · Samsung Internet", "Mac · Chrome" — enough to tell people apart at a glance. */
function sigDevice(ua) {
  ua = String(ua || "");
  if (!ua) return "";
  const os = /iPhone/.test(ua) ? "iPhone" : /iPad/.test(ua) ? "iPad" : /Android/.test(ua) ? "Android" : /Macintosh|Mac OS X/.test(ua) ? "Mac" : /Windows/.test(ua) ? "Windows" : /CrOS/.test(ua) ? "Chromebook" : /Linux/.test(ua) ? "Linux" : "Other";
  const app = /Instagram/.test(ua) ? "Instagram app" : /FBAN|FBAV|FB_IAB/.test(ua) ? "Facebook app" : /musical_ly|TikTok|BytedanceWebview/i.test(ua) ? "TikTok app"
    : /Snapchat/.test(ua) ? "Snapchat app" : /SamsungBrowser/.test(ua) ? "Samsung Internet" : /EdgA?\//.test(ua) ? "Edge" : /Firefox|FxiOS/.test(ua) ? "Firefox"
    : /CriOS|Chrome\//.test(ua) ? "Chrome" : /Safari\//.test(ua) ? "Safari" : "";
  const bot = /HeadlessChrome|PhantomJS|Puppeteer|Playwright|python-requests|curl\/|wget|node-fetch|axios|Go-http-client|okhttp/i.test(ua) ? " · automated" : "";
  return (app ? `${os} · ${app}` : os) + bot;
}
/* The first link: our own path and query, without one-use codes; where from: a site, not its query. */
const SIG_DROP = /^(signin|signup|b|token|code|state|verify|reset|key|t)$/i;
function sigLanding(s) {
  try { const u = new URL(String(s || "").slice(0, 600), "https://labs.local");
    for (const k of [...u.searchParams.keys()]) if (SIG_DROP.test(k)) u.searchParams.delete(k);
    return (u.pathname + (u.search || "")).slice(0, 300); } catch { return ""; }
}
function sigReferrer(s) {
  try { const u = new URL(String(s || "").slice(0, 600)); return /^https?:$/.test(u.protocol) ? (u.host + u.pathname).slice(0, 200) : ""; } catch { return ""; }
}

const sigLog = db.prepare(`INSERT INTO member_signals (user_id, kind, net, country, city, region, tz, device, event_id, entry_id, at) VALUES (?,?,?,?,?,?,?,?,?,?,?)`);
const sigRecent = db.prepare(`SELECT 1 FROM member_signals WHERE user_id = ? AND kind = ? AND net = ? AND at > ? LIMIT 1`);
function sigRecord(req, body) {
  const p = req.path, now = Date.now(), net = sigNet(req), country = sigCountry(req), pl = sigPlace(req), ua = String(req.get("user-agent") || "").slice(0, 400), device = sigDevice(ua);
  if (p === "/api/auth/register") {
    const u = body?.user?.username && q.userByName.get(body.user.username);
    if (!u) return;
    const src = req.body?.src && typeof req.body.src === "object" ? req.body.src : {};
    const via = req.body?.oauth ? (db.prepare(`SELECT provider FROM user_identities WHERE user_id = ? LIMIT 1`).get(u.id)?.provider || "oauth") : "email";
    const secs = Number(src.joinSecs), first = Number(src.firstSeen);
    db.prepare(`INSERT OR IGNORE INTO join_signals (user_id, net, country, city, region, tz, device, ua, via, landing, referrer, first_seen, join_secs, created_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)`)
      .run(u.id, net, country, pl.city, pl.region, pl.tz, device, ua, via, sigLanding(src.landing), sigReferrer(src.referrer),
        Number.isFinite(first) && first > 1.5e12 && first <= now ? Math.round(first) : null, Number.isFinite(secs) && secs >= 0 && secs < 864000 ? Math.round(secs) : null, now);
    sigLog.run(u.id, "join", net, country, pl.city, pl.region, pl.tz, device, null, null, now);
    return;
  }
  if (p === "/api/auth/login" || p === "/api/auth/oauth/claim") {
    const u = body?.token && body?.user?.username && q.userByName.get(body.user.username);
    if (!u || sigRecent.get(u.id, "login", net, now - 6 * 3600000)) return;   // one line per network every few hours is plenty
    sigLog.run(u.id, "login", net, country, pl.city, pl.region, pl.tz, device, null, null, now);
    return;
  }
  const m = p.match(/^\/api\/events\/([^/]+)\/vote$/);
  if (m && req.user && req.body?.on !== false) {
    const ev = db.prepare(`SELECT id FROM events WHERE slug = ?`).get(m[1]), entry = Number(req.body?.entryId);
    if (ev && Number.isFinite(entry)) sigLog.run(req.user.id, "vote", net, country, pl.city, pl.region, pl.tz, device, ev.id, entry, now);
  }
}
app.use((req, res, next) => {
  if (req.method !== "POST" || !/^\/api\/(auth\/(register|login|oauth\/claim)|events\/[^/]+\/vote)$/.test(req.path)) return next();
  let seen = null;
  const json = res.json.bind(res);
  res.json = (b) => { seen = b; return json(b); };
  res.on("finish", () => { if (res.statusCode === 200) { try { sigRecord(req, seen); } catch (e) { console.error("[signals]", e.message); } } });
  next();
});
