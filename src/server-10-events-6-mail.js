/* ================================================================
   EVENT MAIL v1.0 — 2026-10-12. When a published tournament opens for
   entries, every member gets one email saying so.

   Who: members with a confirmed email, not suspended, not unsubscribed.
   When: the minute the event's entry phase starts (on its own schedule,
   or straight away when an admin opens it early), and only while entries
   are still open — never for an event that's already past that.
   Once: progress lives in event_mail (the last member mailed), so a
   deploy or restart mid-send picks up where it stopped and nobody gets
   it twice.
   Pace: Resend's free plan stops at 100 emails a day (verification and
   password resets come out of the same 100), so this sends at most
   EVENT_MAIL_PER_DAY (default 80) a UTC day and carries on the next day.
   Off switch: Admin → Tournament → Edit → "Email every member when
   entries open" (on by default). Each email has an unsubscribe link and
   the one-click List-Unsubscribe headers mail apps show as a button.
   Nothing goes out while email isn't set up, or on Resend's test
   sender (it would only reach the account owner).
================================================================ */
db.exec(`CREATE TABLE IF NOT EXISTS event_mail (
  event_id INTEGER PRIMARY KEY REFERENCES events(id) ON DELETE CASCADE,
  started_at INTEGER NOT NULL,
  last_user_id INTEGER NOT NULL DEFAULT 0,
  sent INTEGER NOT NULL DEFAULT 0,
  failed INTEGER NOT NULL DEFAULT 0,
  day TEXT NOT NULL DEFAULT '',
  day_sent INTEGER NOT NULL DEFAULT 0,
  last_error TEXT,
  done_at INTEGER
)`);

const EVM_PER_DAY = Math.max(1, Math.round(Number(process.env.EVENT_MAIL_PER_DAY) || 80));
const EVM_GAP_MS = Math.max(0, Number(process.env.EVENT_MAIL_GAP_MS ?? 250)); // Resend allows 10 a second
const EVM_WHO = `FROM users WHERE email_verified = 1 AND suspended = 0 AND mail_off = 0 AND email LIKE '%_@_%'`;
const evmDay = (t = Date.now()) => new Date(t).toISOString().slice(0, 10); // Resend's day ends at midnight UTC
const evmRow = (id) => db.prepare(`SELECT * FROM event_mail WHERE event_id = ?`).get(id);
const evmBase = () => {
  let u = (process.env.PUBLIC_URL || "https://tnllabs.com").trim();
  if (!/^https?:\/\//i.test(u)) u = "https://" + u;
  return u.replace(/\/+$/, "");
};
const evmReady = () => MAIL_ENABLED && !MAIL_TEST_SENDER;

/* Their unsubscribe secret, made the first time they're sent one. */
function evmKey(u) {
  if (u.mail_key) return u.mail_key;
  db.prepare(`UPDATE users SET mail_key = ? WHERE id = ? AND mail_key IS NULL`).run(randomBytes(18).toString("hex"), u.id);
  return db.prepare(`SELECT mail_key FROM users WHERE id = ?`).get(u.id).mail_key;
}
const evmUnsub = (u) => `${evmBase()}/mail/off?k=${evmKey(u)}`;

/* The first paragraph of the brief, cut at a word near 280 characters. */
function evmBrief(s) {
  const p = String(s || "").trim().split(/\n\s*\n/)[0].replace(/\s+/g, " ");
  return p.length <= 280 ? p : p.slice(0, 280).replace(/\s+\S*$/, "") + "…";
}

function evmEmail(ev, u) {
  const sub = evJSON(ev.schedule, []).find((p) => p.phase === "submit") || {};
  return eventOpenEmail({
    name: u.display_name || u.username, title: ev.title, brief: evmBrief(ev.brief), prize: ev.prize,
    closes: evDate(sub.end), url: `${evmBase()}/?e=${encodeURIComponent(ev.slug)}`, unsub: evmUnsub(u),
  });
}

/* Should this event's email be going out right now? */
function evmDue(ev, now = Date.now()) {
  if (!ev || !ev.published || evJSON(ev.plan, {}).mailOnOpen === false) return false;
  return phaseAt(evJSON(ev.schedule, []), now).phase === "submit";
}

const EVM_RUNNING = new Set();
async function evmRun(evId) {
  if (EVM_RUNNING.has(evId) || !evmReady()) return;
  const ev = evRow(Number(evId));
  if (!evmDue(tickEvent(ev)) || evmRow(ev.id)?.done_at) return;
  EVM_RUNNING.add(ev.id);
  try {
    db.prepare(`INSERT OR IGNORE INTO event_mail (event_id, started_at) VALUES (?,?)`).run(ev.id, Date.now());
    for (;;) {
      const m = evmRow(ev.id), day = evmDay();
      if ((m.day === day ? m.day_sent : 0) >= EVM_PER_DAY) break;           // today's share is used; tomorrow
      const fresh = evRow(ev.id);
      if (!evmDue(fresh)) break;                                           // unpublished, switched off or closed
      const u = db.prepare(`SELECT id, email, username, display_name, mail_key ${EVM_WHO} AND id > ? ORDER BY id LIMIT 1`).get(m.last_user_id);
      if (!u) { db.prepare(`UPDATE event_mail SET done_at = ? WHERE event_id = ?`).run(Date.now(), ev.id); break; }
      const unsub = evmUnsub(u);
      const r = await sendEventOpenEmail(u.email, eventOpenSubject(fresh.title), evmEmail(fresh, u), unsub);
      // the whole send is in trouble (network, rate limit, Resend down, key wrong): stop, try them again next minute
      if (!r.sent && (!r.status || r.status === 429 || r.status >= 500 || r.status === 401 || r.status === 403)) {
        db.prepare(`UPDATE event_mail SET last_error = ? WHERE event_id = ?`).run(String(r.error || "not sent").slice(0, 300), ev.id);
        break;
      }
      db.prepare(`UPDATE event_mail SET last_user_id = ?, sent = sent + ?, failed = failed + ?, day_sent = CASE WHEN day = ? THEN day_sent + 1 ELSE 1 END, day = ?, last_error = ? WHERE event_id = ?`)
        .run(u.id, r.sent ? 1 : 0, r.sent ? 0 : 1, day, day, r.sent ? null : String(r.error || "").slice(0, 300), ev.id);
      if (EVM_GAP_MS) await new Promise((ok) => setTimeout(ok, EVM_GAP_MS));
    }
  } catch (e) { console.error("[events] mail:", e.message); }
  finally { EVM_RUNNING.delete(ev.id); }
}

/* What Admin → Tournament shows about it. */
function evmStatus(ev) {
  const m = evmRow(ev.id);
  return {
    on: evJSON(ev.plan, {}).mailOnOpen !== false, ready: evmReady(), mailOn: MAIL_ENABLED, testSender: MAIL_TEST_SENDER,
    audience: db.prepare(`SELECT COUNT(*) n ${EVM_WHO}`).get().n, perDay: EVM_PER_DAY,
    startedAt: m?.started_at || null, doneAt: m?.done_at || null, sent: m?.sent || 0, failed: m?.failed || 0,
    left: m && !m.done_at ? db.prepare(`SELECT COUNT(*) n ${EVM_WHO} AND id > ?`).get(m.last_user_id).n : 0,
    lastError: m?.last_error || null,
  };
}

/* Every minute, beside the event clock, and straight after an admin
   opens an event early or switches it on. */
setInterval(() => {
  try { for (const e of db.prepare(`SELECT id FROM events WHERE published = 1`).all()) evmRun(e.id); }
  catch (e) { console.error("[events] mail tick:", e.message); }
}, 60000).unref?.();
const evmSoon = (id) => setImmediate(() => evmRun(id));

/* The admin's own copy, to see it before members do. */
app.post("/api/admin/events/:id/mail-preview", auth, admin, async (req, res) => {
  const ev = evAdminRow(req, res); if (!ev) return;
  if (!MAIL_ENABLED) return res.status(400).json({ error: "Email isn't set up yet (RESEND_API_KEY in Railway → Variables)." });
  const me = db.prepare(`SELECT id, email, username, display_name, mail_key FROM users WHERE id = ?`).get(req.user.id);
  const r = await sendEventOpenEmail(me.email, "[Preview] " + eventOpenSubject(ev.title), evmEmail(ev, me), evmUnsub(me));
  if (!r.sent) return res.status(502).json({ error: r.error || "It didn't send." });
  res.json({ ok: true, to: me.email });
});

/* ---- unsubscribe ----
   The link in the email opens a page with a button (link checkers in
   work inboxes open every link, so opening it changes nothing). Mail
   apps' own Unsubscribe button POSTs straight to it (RFC 8058). */
const evmByKey = (k) => (/^[a-f0-9]{36}$/.test(String(k || "")) ? db.prepare(`SELECT id, mail_off FROM users WHERE mail_key = ?`).get(String(k)) : null);
const evmPage = (k, off, done) => lookPage({
  title: "Tournament emails — LABS", center: true,
  body: `${lookEyebrow("Email")}<h1>${off ? (done ? "You're unsubscribed" : "You're already unsubscribed") : (done ? "You're back on the list" : "Unsubscribe?")}</h1>
<p class="p">${off ? "You won't get emails about tournaments. Emails about your account, like password resets, still come." : done ? "You'll get an email when the next tournament opens." : "You'll stop getting an email when a tournament opens. Emails about your account still come."}</p>
<form method="post" action="/mail/${off ? "on" : "off"}?k=${lookEsc(k)}"><button class="btn block${off ? "" : " acc"}" type="submit">${off ? "Turn them back on" : "Unsubscribe"}</button></form>`,
});
app.get("/mail/off", (req, res) => {
  const u = evmByKey(req.query.k);
  if (!u) return res.status(404).send(lookNotFound("This unsubscribe link doesn't work."));
  res.set("Cache-Control", "no-store").send(evmPage(req.query.k, !!u.mail_off, false));
});
for (const [path, off] of [["/mail/off", 1], ["/mail/on", 0]]) app.post(path, (req, res) => {
  const u = evmByKey(req.query.k);
  if (!u) return res.status(404).send(lookNotFound("This unsubscribe link doesn't work."));
  db.prepare(`UPDATE users SET mail_off = ? WHERE id = ?`).run(off, u.id);
  res.set("Cache-Control", "no-store").send(evmPage(req.query.k, !!off, true));
});
