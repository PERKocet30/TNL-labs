/* ================================================================
   THE WEEKLY REMINDER v1.0 — 2026-10-23. "An update that automatically
   sends you emails to finish making your account: no profile pic, it
   tells you; a producer with no music, it reminds you to upload; never
   picked a colour, it asks you to. Tailored. Not spam — weekly."

   Who: a member with a confirmed email, not suspended, not unsubscribed,
   who joined at least NUDGE_MIN_AGE_DAYS ago (3: a new member has the
   welcome email and the Get started list in front of them already), and
   whose page still has a gap.
   What: the gaps, in the order they matter (photo, music for a music
   role, first piece, bio, colour, 3 follows, a listing for a fashion
   role), as one email: the first gap is the headline and the button, the
   rest are a line. The words are in mail.js (NUDGE_ITEMS).
   When: once every NUDGE_EVERY_DAYS (7) per member, at most REMIND_MAX (4)
   in all, at most REMIND_PER_DAY (40) a UTC day across everyone (Resend's
   free plan is 100 a day, shared with sign-ups and tournament mail).
   Never: once the page is done — nudge_mail remembers, nobody is told
   twice about a gap they've closed. The admin switch (Settings →
   Email → "Weekly reminders", nudgeMail) stops it; each email has the
   unsubscribe link and one-click headers (mail_off, shared with the
   tournament email, server-10-events-6-mail).
   The button: /?login=1&next=/?start=<gap> — signed in, the app opens
   that step (app-11-getstarted startGo); signed out, log in first.
================================================================ */
db.exec(`CREATE TABLE IF NOT EXISTS nudge_mail (
  user_id INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  sent INTEGER NOT NULL DEFAULT 0,
  last_at INTEGER,
  last_items TEXT NOT NULL DEFAULT '',
  last_error TEXT
)`);

const REMIND_EVERY_MS = Math.max(60000, Number(process.env.NUDGE_EVERY_MS) || Number(process.env.NUDGE_EVERY_DAYS || 7) * 86400000);
const REMIND_MIN_AGE_MS = Math.max(0, Number(process.env.NUDGE_MIN_AGE_MS ?? Number(process.env.NUDGE_MIN_AGE_DAYS || 3) * 86400000));
const REMIND_MAX = Math.max(1, Number(process.env.NUDGE_MAX) || 4);
const REMIND_PER_DAY = Math.max(1, Number(process.env.NUDGE_PER_DAY) || 40);
const REMIND_GAP_MS = Math.max(0, Number(process.env.NUDGE_GAP_MS ?? 250));
const REMIND_TICK_MS = Math.max(200, Number(process.env.NUDGE_TICK_MS) || 600000);
const REMIND_WHO = `FROM users u LEFT JOIN nudge_mail n ON n.user_id = u.id
  WHERE u.email_verified = 1 AND u.suspended = 0 AND u.mail_off = 0 AND u.email LIKE '%_@_%' AND u.created_at <= ?
    AND COALESCE(n.sent, 0) < ? AND (n.last_at IS NULL OR n.last_at <= ?)`;
const nudgeWhoArgs = (now = Date.now()) => [now - REMIND_MIN_AGE_MS, REMIND_MAX, now - REMIND_EVERY_MS];
const nudgeDayStart = (now = Date.now()) => now - (now % 86400000);   // Resend's day ends at midnight UTC
const nudgeSentToday = (now = Date.now()) => db.prepare(`SELECT COUNT(*) n FROM nudge_mail WHERE last_at >= ? AND last_items != ''`).get(nudgeDayStart(now)).n;   // real sends; a page marked done isn't one
const REMIND_MUSIC = new Set(["Producer", "Beatmaker", "Lyricist / Singer", "Rapper", "DJ", "Audio Engineer", "Musician"]);
const REMIND_FASHION = new Set(["Fashion Designer", "Stylist", "Tailor", "Sneaker Customizer"]);

/* The gaps on one member's page, first the one that matters most. The
   same seven things as the Get started list (app-11-getstarted) where
   the server can see them, plus the role-shaped ones. */
function nudgeGaps(u) {
  let roles = []; try { roles = JSON.parse(u.roles || "[]"); } catch {}
  if (!roles.length && u.role && u.role !== "Member") roles = [u.role];
  const n = (sql) => db.prepare(sql).get(u.id)?.n ?? 0;
  const role = roles.find((r) => REMIND_MUSIC.has(r)) || roles.find((r) => REMIND_FASHION.has(r)) || roles[0] || "";
  const items = [];
  if (!u.avatar_url) items.push("photo");
  if (roles.some((r) => REMIND_MUSIC.has(r)) && !n(`SELECT COUNT(*) n FROM tracks WHERE user_id = ?`)) items.push("music");
  if (!n(`SELECT COUNT(*) n FROM posts WHERE author_id = ? AND is_work = 1`)) items.push("piece");
  if (!String(u.bio || "").trim()) items.push("bio");
  if (!u.accent || u.accent === "lab") items.push("colour");
  if (n(`SELECT COUNT(*) n FROM follows WHERE follower_id = ?`) < 3) items.push("follow");
  if (roles.some((r) => REMIND_FASHION.has(r)) && !n(`SELECT COUNT(*) n FROM listings WHERE seller_id = ? AND status != 'removed'`)) items.push("market");
  const total = 7, done = total - items.filter((k) => !["music", "market"].includes(k)).length;   // the list's own seven
  return { items, role, done: Math.max(0, Math.min(total, done)), total };
}

const nudgeReady = () => MAIL_ENABLED && !MAIL_TEST_SENDER && settingBool("nudgeMail");
function nudgeMailFor(u, gaps) {
  const base = evmBase(), top = gaps.items[0];
  const url = `${base}/?login=1&next=${encodeURIComponent(`/?start=${top}`)}`;
  return { subject: nudgeSubject(top), unsub: evmUnsub(u),
    mail: nudgeEmail({ name: u.display_name || u.username, items: gaps.items, role: gaps.role, done: gaps.done, total: gaps.total, url, unsub: evmUnsub(u) }) };
}

let REMIND_RUNNING = false;
async function nudgeRun(now = Date.now()) {
  if (REMIND_RUNNING || !nudgeReady()) return;
  REMIND_RUNNING = true;
  try {
    let today = nudgeSentToday(now);
    for (;;) {
      if (today >= REMIND_PER_DAY || !nudgeReady()) break;
      const u = db.prepare(`SELECT u.id, u.email, u.username, u.display_name, u.mail_key, u.roles, u.role, u.avatar_url, u.bio, u.accent, u.created_at, n.sent ${REMIND_WHO}
        AND NOT EXISTS (SELECT 1 FROM nudge_mail x WHERE x.user_id = u.id AND x.last_at >= ?) ORDER BY n.last_at IS NOT NULL, u.created_at LIMIT 1`)
        .get(...nudgeWhoArgs(now), nudgeDayStart(now));
      if (!u) break;
      const gaps = nudgeGaps(u);
      if (!gaps.items.length) {   // their page is done: remember, so they're never asked again
        db.prepare(`INSERT INTO nudge_mail (user_id, sent, last_at, last_items) VALUES (?, ?, ?, '') ON CONFLICT(user_id) DO UPDATE SET sent = ?, last_at = excluded.last_at, last_items = ''`).run(u.id, REMIND_MAX, now, REMIND_MAX);
        continue;
      }
      const { subject, mail, unsub } = nudgeMailFor(u, gaps);
      const r = await sendNudgeEmail(u.email, subject, mail, unsub);
      // the whole send is in trouble (network, rate limit, Resend down, key wrong): stop, try again next tick
      if (!r.sent && (!r.status || r.status === 429 || r.status >= 500 || r.status === 401 || r.status === 403)) {
        db.prepare(`INSERT INTO nudge_mail (user_id, last_error) VALUES (?, ?) ON CONFLICT(user_id) DO UPDATE SET last_error = excluded.last_error`).run(u.id, String(r.error || "not sent").slice(0, 300));
        console.error("[nudge] stopped:", r.error); break;
      }
      db.prepare(`INSERT INTO nudge_mail (user_id, sent, last_at, last_items, last_error) VALUES (?, 1, ?, ?, ?)
        ON CONFLICT(user_id) DO UPDATE SET sent = sent + 1, last_at = excluded.last_at, last_items = excluded.last_items, last_error = excluded.last_error`)
        .run(u.id, now, gaps.items.join(","), r.sent ? null : String(r.error || "").slice(0, 300));
      today++;
      if (REMIND_GAP_MS) await new Promise((ok) => setTimeout(ok, REMIND_GAP_MS));
    }
  } catch (e) { console.error("[nudge]", e.message); }
  finally { REMIND_RUNNING = false; }
}
setInterval(() => nudgeRun(), REMIND_TICK_MS).unref?.();
setTimeout(() => nudgeRun(), Math.min(REMIND_TICK_MS, 15000)).unref?.();   // and soon after boot

/* What Admin → Settings → Email shows. */
app.get("/api/admin/nudge", auth, admin, (req, res) => {
  const now = Date.now();
  res.json({
    on: settingBool("nudgeMail"), ready: nudgeReady(), mailOn: MAIL_ENABLED, testSender: MAIL_TEST_SENDER,
    everyDays: Math.round(REMIND_EVERY_MS / 86400000), max: REMIND_MAX, perDay: REMIND_PER_DAY,
    due: db.prepare(`SELECT COUNT(*) n ${REMIND_WHO}`).get(...nudgeWhoArgs(now)).n,
    sentToday: nudgeSentToday(now), sentWeek: db.prepare(`SELECT COUNT(*) n FROM nudge_mail WHERE last_at >= ? AND last_items != ''`).get(now - 7 * 86400000).n,
    sentTotal: db.prepare(`SELECT COALESCE(SUM(sent), 0) n FROM nudge_mail WHERE last_items != ''`).get().n,
    lastError: db.prepare(`SELECT last_error FROM nudge_mail WHERE last_error IS NOT NULL ORDER BY last_at DESC LIMIT 1`).get()?.last_error || null,
  });
});
/* The admin's own copy: their real gaps if they have any, else every gap, so the email can be seen. */
app.post("/api/admin/nudge/preview", auth, admin, rateLimit({ max: 10, windowMs: 600000, key: "user" }), async (req, res) => {
  if (!MAIL_ENABLED) return res.status(400).json({ error: "Email isn't set up yet (RESEND_API_KEY in Railway → Variables)." });
  const me = db.prepare(`SELECT * FROM users WHERE id = ?`).get(req.user.id);
  let gaps = nudgeGaps(me);
  if (!gaps.items.length) gaps = { items: Object.keys(NUDGE_ITEMS), role: gaps.role || "Producer", done: 0, total: 7 };
  const { subject, mail, unsub } = nudgeMailFor(me, gaps);
  const r = await sendNudgeEmail(me.email, "[Preview] " + subject, mail, unsub);
  if (!r.sent) return res.status(502).json({ error: r.error || "It didn't send." });
  res.json({ ok: true, to: me.email, items: gaps.items });
});
