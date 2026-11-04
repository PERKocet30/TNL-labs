/* ================================================================
   UI SIGNALS v1.0 — 2026-11-04. "Think of all data that can help improve
   the user interface. Make sure Echo can access all of this."
   How people move through the app, as counts: which screens open and in
   what order, where they leave, what they tap that does nothing, what they
   start and don't finish, what loads slowly or doesn't load. The app sends
   them in batches (app/ui-signals/signals.js → POST /api/ui); Echo and the
   connector read them through the tools in ui-signals/tools.js.
   Counts and patterns only, by design: never a message, a title, a price,
   anything typed into a form. A search with no results keeps up to three
   counted words. Rows go after 90 days — a signal, not an archive.
     ui_events   viewer "u:<id>" | "d:<device>" · kind · screen · prev · ms · day
     POST /api/ui { events: [{ kind, screen, prev, ms }] }   ≤ 60 a batch
   Kinds (anything else is dropped):
     view      a screen opened — screen, prev = the screen before, ms = time on it
     exit      the app hidden or closed — screen = the last one
     back      backed out of a screen (‹, ✕, the phone's back)
     tab       a bottom tab / sidebar tap — screen = the tab
     tap       a tap that did nothing — prev = img · name · text · card
     double    the same change sent twice within 2s — screen = where
     flow      a multi-step thing — screen = post · sell · checkout · enter · offer · collab · group, prev = start · done · abandon
     empty     an empty state shown — prev = what they did next: left · acted · stayed
     search_miss   a search with no results — prev = up to 3 counted words
     load      ms until a screen had its data
     media_fail    a picture or sound that didn't load — prev = img · audio · video
     upload_fail   prev = big · type · net
     feature   first use of a feature that day — screen = studio · collab · offer · group · enter · sell · dm · playlist
     profile   once a session — screen = width bucket, prev = dark|light (+rm reduced motion, +lt larger text)
   test/ui-signals.test.mjs
================================================================ */
db.exec(`CREATE TABLE IF NOT EXISTS ui_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT, viewer TEXT NOT NULL, kind TEXT NOT NULL, screen TEXT NOT NULL DEFAULT '',
  prev TEXT NOT NULL DEFAULT '', ms INTEGER NOT NULL DEFAULT 0, day INTEGER NOT NULL, created_at INTEGER NOT NULL);
CREATE INDEX IF NOT EXISTS idx_ui_events_kind ON ui_events(kind, created_at);
CREATE INDEX IF NOT EXISTS idx_ui_events_screen ON ui_events(screen, created_at);
CREATE UNIQUE INDEX IF NOT EXISTS idx_ui_events_once ON ui_events(viewer, kind, screen, day) WHERE kind IN ('feature', 'profile')`);
const UI_KINDS = ["view", "exit", "back", "tab", "tap", "double", "flow", "empty", "search_miss", "load", "media_fail", "upload_fail", "feature", "profile"];
const UI_WORDS = { tap: ["img", "name", "text", "card"], flow: ["start", "done", "abandon"], empty: ["left", "acted", "stayed"], media_fail: ["img", "audio", "video"], upload_fail: ["big", "type", "net"] };
const UI_KEEP_DAYS = 90, UI_MAX_ROWS = 400000, UI_DAY = 86400000;
const uiIns = db.prepare(`INSERT OR IGNORE INTO ui_events (viewer, kind, screen, prev, ms, day, created_at) VALUES (?,?,?,?,?,?,?)`);
/* a screen or flow name: short, plain, no free text */
const uiName = (s, n = 40) => String(s == null ? "" : s).toLowerCase().replace(/[^a-z0-9 :#_/-]/g, "").trim().slice(0, n);
/* a search miss keeps three counted words at most — never the sentence */
const uiWords = (s) => String(s || "").toLowerCase().replace(/[^a-z0-9 ]/g, " ").split(/\s+/).filter((w) => w.length > 1).slice(0, 3).join(" ");
function uiLog(viewer, e, now = Date.now()) {
  if (!viewer || !e || typeof e !== "object" || !UI_KINDS.includes(e.kind)) return false;
  const screen = uiName(e.screen);
  let prev = uiName(e.prev, 40);
  if (UI_WORDS[e.kind]) prev = UI_WORDS[e.kind].includes(prev) ? prev : "";
  else if (e.kind === "search_miss") prev = uiWords(e.prev);
  else if (e.kind === "profile") prev = String(e.prev || "").split(/[ ,]+/).filter((w) => ["dark", "light", "rm", "lt"].includes(w)).join(" ");
  const ms = Math.min(60000, Math.max(0, Math.round(Number(e.ms) || 0)));
  return uiIns.run(viewer, e.kind, screen, prev, ms, Math.floor(now / UI_DAY), now).changes > 0;
}
const uiViewer = (req) => (req.user ? "u:" + req.user.id : (deviceOf(req) ? "d:" + deviceOf(req) : ""));
app.post("/api/ui", maybeAuth, rateLimit({ max: 60, windowMs: 60000 }), (req, res) => {
  const viewer = uiViewer(req);
  const list = Array.isArray(req.body?.events) ? req.body.events.slice(0, 60) : [];
  if (!viewer || !list.length) return res.json({ ok: true, n: 0 });
  let n = 0;
  const now = Date.now();
  db.exec("BEGIN");
  try { for (const e of list) if (uiLog(viewer, e, now)) n++; db.exec("COMMIT"); }
  catch (e) { try { db.exec("ROLLBACK"); } catch (_) {} return res.status(500).json({ error: "couldn't save" }); }
  if ((uiWrites += n) >= 5000) { uiWrites = 0; uiPrune(); }
  res.json({ ok: true, n });
});
let uiWrites = 0;
function uiPrune(now = Date.now()) {
  const n = db.prepare(`DELETE FROM ui_events WHERE created_at < ?`).run(now - UI_KEEP_DAYS * UI_DAY).changes;
  db.prepare(`DELETE FROM ui_events WHERE id <= (SELECT id FROM ui_events ORDER BY id DESC LIMIT 1 OFFSET ?)`).run(UI_MAX_ROWS);
  return n;
}
if (!process.env.TNL_NO_WATCH) { setTimeout(() => { try { uiPrune(); } catch (e) {} }, 90000).unref?.(); setInterval(() => { try { uiPrune(); } catch (e) {} }, UI_DAY).unref?.(); }

/* ---- what the admin (and Echo) reads: counts only, never a viewer ---- */
const uiDays = (q) => Math.min(90, Math.max(1, Number(q.days) || 7));
const uiSince = (days, now = Date.now()) => now - days * UI_DAY;
const uiNew = (since) => `(viewer LIKE 'u:%' AND CAST(SUBSTR(viewer, 3) AS INTEGER) IN (SELECT id FROM users WHERE created_at > ${since} - 7 * ${UI_DAY}))`;
const median = (xs) => { if (!xs.length) return 0; const a = [...xs].sort((x, y) => x - y); return a[Math.floor(a.length / 2)]; };
const pct = (xs, p) => { if (!xs.length) return 0; const a = [...xs].sort((x, y) => x - y); return a[Math.min(a.length - 1, Math.floor(a.length * p))]; };

/* screens: views, who (new vs returning), time on screen, exits and back-outs */
function uiScreens(days, now = Date.now()) {
  const since = uiSince(days, now);
  const views = db.prepare(`SELECT screen, COUNT(*) views, COUNT(DISTINCT viewer) people, SUM(${uiNew(since)}) newcomers FROM ui_events WHERE kind = 'view' AND created_at > ? GROUP BY screen ORDER BY views DESC LIMIT 60`).all(since);
  const onScreen = new Map();   // time on a screen = the ms the next view carries for it (prev)
  for (const r of db.prepare(`SELECT prev screen, ms FROM ui_events WHERE kind = 'view' AND prev != '' AND ms > 0 AND created_at > ?`).all(since)) { if (!onScreen.has(r.screen)) onScreen.set(r.screen, []); onScreen.get(r.screen).push(r.ms); }
  const count = (kind) => new Map(db.prepare(`SELECT screen, COUNT(*) n FROM ui_events WHERE kind = ? AND created_at > ? GROUP BY screen`).all(kind, since).map((r) => [r.screen, r.n]));
  const exits = count("exit"), backs = count("back"), taps = count("tap");
  return { days, screens: views.map((r) => ({ screen: r.screen, views: r.views, people: r.people, newcomers: r.newcomers, medianSeconds: Math.round(median(onScreen.get(r.screen) || []) / 100) / 10,
    exits: exits.get(r.screen) || 0, exitRate: Math.round(100 * (exits.get(r.screen) || 0) / r.views), backOuts: backs.get(r.screen) || 0, deadTaps: taps.get(r.screen) || 0 })) };
}
/* paths: where people go next, the common three-step routes, and the dead ends */
function uiPaths(days, now = Date.now()) {
  const since = uiSince(days, now);
  const pairs = db.prepare(`SELECT prev, screen, COUNT(*) n FROM ui_events WHERE kind = 'view' AND prev != '' AND prev != screen AND created_at > ? GROUP BY prev, screen ORDER BY n DESC LIMIT 30`).all(since).map((r) => ({ from: r.prev, to: r.screen, n: r.n }));
  const routes = new Map();
  const byViewer = new Map();
  for (const r of db.prepare(`SELECT viewer, screen, created_at FROM ui_events WHERE kind = 'view' AND created_at > ? ORDER BY viewer, id`).all(since)) {
    const l = byViewer.get(r.viewer) || []; l.push(r); byViewer.set(r.viewer, l);
  }
  for (const l of byViewer.values()) for (let i = 2; i < l.length; i++) {
    if (l[i].created_at - l[i - 2].created_at > 10 * 60000) continue;   // one sitting
    const k = [l[i - 2].screen, l[i - 1].screen, l[i].screen]; if (k[0] === k[1] || k[1] === k[2]) continue;
    routes.set(k.join(" → "), (routes.get(k.join(" → ")) || 0) + 1);
  }
  const top = [...routes.entries()].sort((a, b) => b[1] - a[1]).slice(0, 10).map(([route, n]) => ({ route, n }));
  const deadEnds = db.prepare(`SELECT v.screen, v.n views, COALESCE(x.n, 0) exits FROM (SELECT screen, COUNT(*) n FROM ui_events WHERE kind = 'view' AND created_at > ? GROUP BY screen) v
    LEFT JOIN (SELECT screen, COUNT(*) n FROM ui_events WHERE kind = 'exit' AND created_at > ? GROUP BY screen) x ON x.screen = v.screen WHERE v.n >= 20 AND COALESCE(x.n, 0) * 100 >= v.n * 40 ORDER BY exits DESC LIMIT 15`).all(since, since)
    .map((r) => ({ screen: r.screen, views: r.views, exits: r.exits, exitRate: Math.round(100 * r.exits / r.views) }));
  const tabs = db.prepare(`SELECT screen tab, COUNT(*) taps, COUNT(DISTINCT viewer) people FROM ui_events WHERE kind = 'tab' AND created_at > ? GROUP BY screen ORDER BY taps DESC`).all(since);
  return { days, next: pairs, routes: top, deadEnds, tabs };
}
/* taps: rage taps (from the glitch watcher), taps that did nothing, and double sends */
function uiTaps(days, now = Date.now()) {
  const since = uiSince(days, now);
  const rage = db.prepare(`SELECT place screen, detail what, COUNT(*) n FROM glitch_events WHERE kind = 'rage_tap' AND created_at > ? GROUP BY place, detail ORDER BY n DESC LIMIT 20`).all(since);
  const dead = db.prepare(`SELECT screen, prev role, COUNT(*) n, COUNT(DISTINCT viewer) people FROM ui_events WHERE kind = 'tap' AND created_at > ? GROUP BY screen, prev ORDER BY n DESC LIMIT 30`).all(since);
  const doubles = db.prepare(`SELECT screen, COUNT(*) n FROM ui_events WHERE kind = 'double' AND created_at > ? GROUP BY screen ORDER BY n DESC LIMIT 20`).all(since);
  return { days, rageTaps: rage, deadTaps: dead, doubleSends: doubles };
}
/* flows: started, finished, abandoned — plus the funnels that already exist */
function uiFlows(days, now = Date.now()) {
  const since = uiSince(days, now);
  const rows = db.prepare(`SELECT screen flow, prev stage, COUNT(*) n, COUNT(DISTINCT viewer) people FROM ui_events WHERE kind = 'flow' AND created_at > ? GROUP BY screen, prev`).all(since);
  const flows = new Map();
  for (const r of rows) { const f = flows.get(r.flow) || { flow: r.flow, started: 0, done: 0, abandoned: 0, people: 0 }; if (r.stage === "start") { f.started = r.n; f.people = r.people; } else if (r.stage === "done") f.done = r.n; else if (r.stage === "abandon") f.abandoned = r.n; flows.set(r.flow, f); }
  const list = [...flows.values()].map((f) => ({ ...f, finishRate: f.started ? Math.round(100 * f.done / f.started) : 0 })).sort((a, b) => b.started - a.started);
  return { days, flows: list, note: "The sign-up funnel is the funnel tool; the sell walkthrough's steps are sellers.learned." };
}
/* empties and search misses */
function uiEmpties(days, now = Date.now()) {
  const since = uiSince(days, now);
  const empties = db.prepare(`SELECT screen, COUNT(*) seen, SUM(prev = 'left') AS "left", SUM(prev = 'acted') AS acted, SUM(prev = 'stayed') AS stayed FROM ui_events WHERE kind = 'empty' AND created_at > ? GROUP BY screen ORDER BY seen DESC LIMIT 30`).all(since);
  const misses = db.prepare(`SELECT prev words, COUNT(*) n FROM ui_events WHERE kind = 'search_miss' AND prev != '' AND created_at > ? GROUP BY prev ORDER BY n DESC LIMIT 30`).all(since);
  const missTotal = db.prepare(`SELECT COUNT(*) n FROM ui_events WHERE kind = 'search_miss' AND created_at > ?`).get(since).n;
  return { days, empties, searchMisses: { total: missTotal, words: misses } };
}
/* speed: how long screens take, and what doesn't load */
function uiSpeed(days, now = Date.now()) {
  const since = uiSince(days, now);
  const by = new Map();
  for (const r of db.prepare(`SELECT screen, ms FROM ui_events WHERE kind = 'load' AND created_at > ?`).all(since)) { if (!by.has(r.screen)) by.set(r.screen, []); by.get(r.screen).push(r.ms); }
  const loads = [...by.entries()].map(([screen, xs]) => ({ screen, n: xs.length, p50ms: pct(xs, 0.5), p90ms: pct(xs, 0.9), over3s: xs.filter((x) => x > 3000).length })).sort((a, b) => b.p90ms - a.p90ms).slice(0, 40);
  const mediaFails = db.prepare(`SELECT screen, prev what, COUNT(*) n FROM ui_events WHERE kind = 'media_fail' AND created_at > ? GROUP BY screen, prev ORDER BY n DESC LIMIT 20`).all(since);
  const uploadFails = db.prepare(`SELECT prev why, COUNT(*) n FROM ui_events WHERE kind = 'upload_fail' AND created_at > ? GROUP BY prev ORDER BY n DESC`).all(since);
  const slow = db.prepare(`SELECT place screen, COUNT(*) n FROM glitch_events WHERE kind = 'slow_screen' AND created_at > ? GROUP BY place ORDER BY n DESC LIMIT 15`).all(since);
  return { days, loads, mediaFails, uploadFails, slowScreens: slow };
}
/* devices: screen widths, dark or light, reduced motion, larger text */
function uiDevices(days, now = Date.now()) {
  const since = uiSince(days, now);
  const rows = db.prepare(`SELECT screen width, prev look, COUNT(*) n FROM ui_events WHERE kind = 'profile' AND created_at > ? GROUP BY screen, prev`).all(since);
  const widths = new Map(), total = rows.reduce((s, r) => s + r.n, 0);
  let dark = 0, light = 0, rm = 0, lt = 0;
  for (const r of rows) { widths.set(r.width, (widths.get(r.width) || 0) + r.n); if (/dark/.test(r.look)) dark += r.n; if (/light/.test(r.look)) light += r.n; if (/\brm\b/.test(r.look)) rm += r.n; if (/\blt\b/.test(r.look)) lt += r.n; }
  const share = (n) => (total ? Math.round(100 * n / total) : 0);
  return { days, sessions: total, widths: [...widths.entries()].map(([width, n]) => ({ width, n, pct: share(n) })).sort((a, b) => b.n - a.n), dark: { n: dark, pct: share(dark) }, light: { n: light, pct: share(light) }, reducedMotion: { n: rm, pct: share(rm) }, largerText: { n: lt, pct: share(lt) },
    note: "Browser and the Instagram in-app share are in the audience tool." };
}
/* features: who has ever used each, how long it took them, who never has */
function uiFeatures(days, now = Date.now()) {
  const since = uiSince(days, now);
  const members = db.prepare(`SELECT COUNT(*) n FROM users WHERE created_at < ?`).get(now).n;
  const rows = db.prepare(`SELECT e.screen feature, COUNT(DISTINCT e.viewer) members, MIN(e.created_at) first FROM ui_events e WHERE e.kind = 'feature' AND e.viewer LIKE 'u:%' AND e.created_at > ? GROUP BY e.screen ORDER BY members DESC`).all(since);
  const out = rows.map((r) => {
    const firsts = db.prepare(`SELECT MIN(e.created_at) - u.created_at d FROM ui_events e JOIN users u ON u.id = CAST(SUBSTR(e.viewer, 3) AS INTEGER) WHERE e.kind = 'feature' AND e.screen = ? AND e.viewer LIKE 'u:%' AND e.created_at > ? GROUP BY e.viewer`).all(r.feature, since).map((x) => Math.max(0, x.d));
    return { feature: r.feature, members: r.members, pctOfMembers: members ? Math.round(100 * r.members / members) : 0, never: Math.max(0, members - r.members), medianDaysToFirstUse: Math.round(median(firsts) / UI_DAY * 10) / 10 };
  });
  return { days, members, features: out };
}
for (const [path, fn] of [["screens", uiScreens], ["paths", uiPaths], ["taps", uiTaps], ["flows", uiFlows], ["empties", uiEmpties], ["speed", uiSpeed], ["devices", uiDevices], ["features", uiFeatures]])
  app.get("/api/admin/ui/" + path, auth, admin, (req, res) => res.json(fn(uiDays(req.query))));
