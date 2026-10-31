/* ================================================================
   VOTE MAIL v1.0 — 2026-10-26. "Voting begins at 3 PM — email everyone
   at 9 AM." The morning a published tournament's vote opens, every
   member gets one email saying when.

   When: from EVENT_VOTE_MAIL_HOUR (default 9) Eastern on the day the
   vote stage ("qualify") starts, until it starts. The time in the email
   is read from the event's own schedule, so it can't say the wrong hour;
   if an admin moves the schedule the email follows. Nothing goes out
   once voting has started (a "starts at 3 PM" email after 3 PM is
   wrong), and nothing if the vote starts before that hour.
   Who, pace, once, off: the same as the entries-open email
   (server/events/mail.js) — confirmed, not suspended, not
   unsubscribed; at most EVENT_MAIL_PER_DAY a UTC day; progress in
   event_vote_mail so a restart picks up where it stopped; off with the
   same "Email every member" switch (plan.mailOnOpen = false).
================================================================ */
db.exec(`CREATE TABLE IF NOT EXISTS event_vote_mail (
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

const EVV_HOUR = Math.min(23, Math.max(0, Number(process.env.EVENT_VOTE_MAIL_HOUR ?? 9)));
const evvRow = (id) => db.prepare(`SELECT * FROM event_vote_mail WHERE event_id = ?`).get(id);
const evvHourET = (t) => Number(new Intl.DateTimeFormat("en-US", { timeZone: "America/New_York", hour: "numeric", hourCycle: "h23" }).format(new Date(t)));
/* "3 PM ET", "3:30 PM ET" */
const evvAt = (t) => new Date(t).toLocaleTimeString("en-US", { timeZone: "America/New_York", hour: "numeric", minute: "2-digit" }).replace(":00", "") + " ET";
const evvStart = (ev) => evJSON(ev.schedule, []).find((p) => p.phase === "qualify")?.start || null;

/* Should the "voting opens today" email be going out right now? */
function evvDue(ev, now = Date.now()) {
  if (!ev || !ev.published || evJSON(ev.plan, {}).mailOnOpen === false) return false;
  const start = evvStart(ev);
  if (!start || now >= start) return false;                       // no vote stage, or it's already open
  return evDayKey(start) === evDayKey(now) && evvHourET(now) >= EVV_HOUR;
}

async function evvEmail(ev, u) {
  const { voteOpenEmail } = await import("./mail.js");   // boot's mail import line is full (24KB)
  const start = evvStart(ev);
  return voteOpenEmail({
    name: u.display_name || u.username, title: ev.title, at: evvAt(start), entries: liveEntries(ev.id).length, picks: ev.picks,
    rules: ev.min_account_days ? `Accounts need to be ${ev.min_account_days} day${ev.min_account_days === 1 ? "" : "s"} old to vote.` : "",
    url: `${evmBase()}/?e=${encodeURIComponent(ev.slug)}`, unsub: evmUnsub(u),
  });
}

const EVV_RUNNING = new Set();
async function evvRun(evId) {
  if (EVV_RUNNING.has(evId) || !evmReady()) return;
  const ev = evRow(Number(evId));
  if (!evvDue(ev) || evvRow(ev.id)?.done_at) return;
  EVV_RUNNING.add(ev.id);
  try {
    const { voteOpenSubject } = await import("./mail.js");
    db.prepare(`INSERT OR IGNORE INTO event_vote_mail (event_id, started_at) VALUES (?,?)`).run(ev.id, Date.now());
    for (;;) {
      const m = evvRow(ev.id), day = evmDay();
      if ((m.day === day ? m.day_sent : 0) >= EVM_PER_DAY) break;
      const fresh = evRow(ev.id);
      if (!evvDue(fresh)) break;                                     // voting started, schedule moved, or switched off
      const u = db.prepare(`SELECT id, email, username, display_name, mail_key ${EVM_WHO} AND id > ? ORDER BY id LIMIT 1`).get(m.last_user_id);
      if (!u) { db.prepare(`UPDATE event_vote_mail SET done_at = ? WHERE event_id = ?`).run(Date.now(), ev.id); break; }
      const r = await sendEventOpenEmail(u.email, voteOpenSubject(fresh.title, evvAt(evvStart(fresh))), await evvEmail(fresh, u), evmUnsub(u));
      if (!r.sent && (!r.status || r.status === 429 || r.status >= 500 || r.status === 401 || r.status === 403)) {
        db.prepare(`UPDATE event_vote_mail SET last_error = ? WHERE event_id = ?`).run(String(r.error || "not sent").slice(0, 300), ev.id);
        break;
      }
      db.prepare(`UPDATE event_vote_mail SET last_user_id = ?, sent = sent + ?, failed = failed + ?, day_sent = CASE WHEN day = ? THEN day_sent + 1 ELSE 1 END, day = ?, last_error = ? WHERE event_id = ?`)
        .run(u.id, r.sent ? 1 : 0, r.sent ? 0 : 1, day, day, r.sent ? null : String(r.error || "").slice(0, 300), ev.id);
      if (EVM_GAP_MS) await new Promise((ok) => setTimeout(ok, EVM_GAP_MS));
    }
    const m = evvRow(ev.id);
    if (m.done_at) console.log(`[events] vote mail for ${ev.slug}: ${m.sent} sent, ${m.failed} failed`);
  } catch (e) { console.error("[events] vote mail:", e.message); }
  finally { EVV_RUNNING.delete(ev.id); }
}

setInterval(() => {
  try { for (const e of db.prepare(`SELECT id FROM events WHERE published = 1`).all()) evvRun(e.id); }
  catch (e) { console.error("[events] vote mail tick:", e.message); }
}, 60000).unref?.();
setTimeout(() => { try { for (const e of db.prepare(`SELECT id FROM events WHERE published = 1`).all()) {
  const ev = evRow(Number(e.id)), start = evvStart(ev), m = evvRow(ev.id);   // so the deploy log says what the email will say
  if (start && start > Date.now()) console.log(`[events] ${ev.slug}: voting opens ${new Date(start).toLocaleDateString("en-US", { timeZone: "America/New_York", weekday: "short", month: "short", day: "numeric" })} at ${evvAt(start)} · the email goes from ${EVV_HOUR}:00 ET that day${m?.done_at ? " (already sent)" : ""}`);
  evvRun(e.id);
} } catch (err) { console.error("[events] vote mail:", err.message); } }, 5000).unref?.();

/* Admin: where it stands, and their own copy first. */
app.get("/api/admin/events/:id/vote-mail", auth, admin, (req, res) => {
  const ev = evAdminRow(req, res); if (!ev) return;
  const m = evvRow(ev.id), start = evvStart(ev);
  res.json({ voteStartsAt: start, at: start ? evvAt(start) : null, sendsFrom: `${EVV_HOUR}:00 ET on the day voting opens`, due: evvDue(ev), ready: evmReady(),
    audience: db.prepare(`SELECT COUNT(*) n ${EVM_WHO}`).get().n, sent: m?.sent || 0, failed: m?.failed || 0, doneAt: m?.done_at || null, lastError: m?.last_error || null });
});
app.post("/api/admin/events/:id/vote-mail-preview", auth, admin, async (req, res) => {
  const ev = evAdminRow(req, res); if (!ev) return;
  if (!MAIL_ENABLED) return res.status(400).json({ error: "Email isn't set up yet (RESEND_API_KEY in Railway → Variables)." });
  if (!evvStart(ev)) return res.status(400).json({ error: "This event has no voting stage." });
  const { voteOpenSubject } = await import("./mail.js");
  const me = db.prepare(`SELECT id, email, username, display_name, mail_key FROM users WHERE id = ?`).get(req.user.id);
  const r = await sendEventOpenEmail(me.email, "[Preview] " + voteOpenSubject(ev.title, evvAt(evvStart(ev))), await evvEmail(ev, me), evmUnsub(me));
  if (!r.sent) return res.status(502).json({ error: r.error || "It didn't send." });
  res.json({ ok: true, to: me.email });
});
