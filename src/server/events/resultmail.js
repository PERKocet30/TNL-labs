/* ================================================================
   RESULTS MAIL v1.0 — 2026-11-05. "Make sure everybody who voted gets
   an email saying the tournament is over and announce the winner. Thank
   everyone and let them know the next tournament will be a music one."

   Who: everyone who voted in the tournament (any stage), with a
   confirmed email, not suspended, not unsubscribed — the same rules as
   the other tournament emails (server/events/mail.js).
   When: once the results are in (tickEvent has written st.results with
   a winner), for EVR_DAYS after that, never for a void event.
   What: the winner (and second and third), a thank-you, what's next
   (EVR_NEXT, said only when it's set for this event) and a button to
   the results. The winner is read from the results at send time.
   Pace: EVENT_RESULTS_MAIL_PER_DAY a UTC day (default 50), below the
   other emails' 80, because sign-up and password emails share Resend's
   100 a day. A Resend refusal (429, 5xx, key) stops the run; the next
   minute tries again. Progress in event_result_mail, so a restart picks
   up where it stopped and nobody gets it twice.
   Off: the same "Email every member" switch (plan.mailOnOpen = false).
================================================================ */
db.exec(`CREATE TABLE IF NOT EXISTS event_result_mail (
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

const EVR_PER_DAY = Math.max(1, Math.round(Number(process.env.EVENT_RESULTS_MAIL_PER_DAY) || 50));
const EVR_DAYS = 7;
/* What's next, by the tournament it follows. Said in that tournament's results email only. */
const EVR_NEXT = { "art-tournament": "music" };
const EVR_WHO = `${EVM_WHO} AND id IN (SELECT DISTINCT voter_id FROM event_votes WHERE event_id = ?)`;
const evrRow = (id) => db.prepare(`SELECT * FROM event_result_mail WHERE event_id = ?`).get(id);

/* The finalists in order, each with the name to call them by. */
function evrPodium(ev) {
  const st = evJSON(ev.state, {});
  return (st.results?.ranking || []).map((r) => {
    const e = db.prepare(`SELECT * FROM event_entries WHERE id = ?`).get(r.entryId), u = e && q.userById.get(e.user_id);
    return u ? { entryId: r.entryId, username: u.username, name: u.display_name || u.username } : null;
  }).filter(Boolean);
}

/* Should the results email be going out right now? */
function evrDue(ev, now = Date.now()) {
  if (!ev || !ev.published || evJSON(ev.plan, {}).mailOnOpen === false) return false;
  const st = evJSON(ev.state, {});
  if (st.void || !st.results?.winner) return false;
  return now < (st.results.at || now) + EVR_DAYS * 86400000;
}

async function evrEmail(ev, u) {
  const { resultsEmail } = await import("./mail.js");
  const top = evrPodium(ev);
  return resultsEmail({
    name: u.display_name || u.username, title: ev.title, winner: top[0], second: top[1], third: top[2], prize: ev.prize,
    next: EVR_NEXT[ev.slug] || "", url: `${evmBase()}/?e=${encodeURIComponent(ev.slug)}`, unsub: evmUnsub(u),
  });
}
async function evrSubject(ev) {
  const { resultsSubject } = await import("./mail.js");
  return resultsSubject(ev.title, evrPodium(ev)[0]?.name || "");
}

const EVR_RUNNING = new Set();
async function evrRun(evId) {
  if (EVR_RUNNING.has(evId) || !evmReady()) return;
  const ev = evRow(Number(evId));
  if (!evrDue(tickEvent(ev)) || evrRow(ev.id)?.done_at) return;
  EVR_RUNNING.add(ev.id);
  try {
    db.prepare(`INSERT OR IGNORE INTO event_result_mail (event_id, started_at) VALUES (?,?)`).run(ev.id, Date.now());
    for (;;) {
      const m = evrRow(ev.id), day = evmDay();
      if ((m.day === day ? m.day_sent : 0) >= EVR_PER_DAY) break;          // today's share is used; tomorrow
      const fresh = evRow(ev.id);
      if (!evrDue(fresh)) break;                                          // switched off, unpublished, or too long ago
      const u = db.prepare(`SELECT id, email, username, display_name, mail_key ${EVR_WHO} AND id > ? ORDER BY id LIMIT 1`).get(ev.id, m.last_user_id);
      if (!u) { db.prepare(`UPDATE event_result_mail SET done_at = ? WHERE event_id = ?`).run(Date.now(), ev.id); break; }
      const r = await sendEventOpenEmail(u.email, await evrSubject(fresh), await evrEmail(fresh, u), evmUnsub(u));
      if (!r.sent && (!r.status || r.status === 429 || r.status >= 500 || r.status === 401 || r.status === 403)) {
        db.prepare(`UPDATE event_result_mail SET last_error = ? WHERE event_id = ?`).run(String(r.error || "not sent").slice(0, 300), ev.id);
        break;
      }
      db.prepare(`UPDATE event_result_mail SET last_user_id = ?, sent = sent + ?, failed = failed + ?, day_sent = CASE WHEN day = ? THEN day_sent + 1 ELSE 1 END, day = ?, last_error = ? WHERE event_id = ?`)
        .run(u.id, r.sent ? 1 : 0, r.sent ? 0 : 1, day, day, r.sent ? null : String(r.error || "").slice(0, 300), ev.id);
      if (EVM_GAP_MS) await new Promise((ok) => setTimeout(ok, EVM_GAP_MS));
    }
    const m = evrRow(ev.id);
    if (m.done_at) console.log(`[events] results mail for ${ev.slug}: ${m.sent} sent, ${m.failed} failed`);
  } catch (e) { console.error("[events] results mail:", e.message); }
  finally { EVR_RUNNING.delete(ev.id); }
}

/* What the tournament's admin view (and the connector) shows about it. */
function evrStatus(ev) {
  const m = evrRow(ev.id), audience = db.prepare(`SELECT COUNT(*) n ${EVR_WHO}`).get(ev.id).n;
  return {
    due: evrDue(ev), ready: evmReady(), audience, perDay: EVR_PER_DAY, winner: evrPodium(ev)[0]?.username || null, next: EVR_NEXT[ev.slug] || null,
    startedAt: m?.started_at || null, doneAt: m?.done_at || null, sent: m?.sent || 0, failed: m?.failed || 0,
    left: m && !m.done_at ? db.prepare(`SELECT COUNT(*) n ${EVR_WHO} AND id > ?`).get(ev.id, m.last_user_id).n : m ? 0 : audience,
    lastError: m?.last_error || null,
  };
}

setInterval(() => {
  try { for (const e of db.prepare(`SELECT id FROM events WHERE published = 1`).all()) evrRun(e.id); }
  catch (e) { console.error("[events] results mail tick:", e.message); }
}, 60000).unref?.();
setTimeout(() => { try { for (const e of db.prepare(`SELECT id FROM events WHERE published = 1`).all()) evrRun(e.id); }
  catch (err) { console.error("[events] results mail:", err.message); } }, 6000).unref?.();

/* Admin: where it stands, and their own copy first. */
app.get("/api/admin/events/:id/results-mail", auth, admin, (req, res) => {
  const ev = evAdminRow(req, res); if (!ev) return;
  res.json(evrStatus(tickEvent(ev)));
});
app.post("/api/admin/events/:id/results-mail-preview", auth, admin, async (req, res) => {
  const ev = evAdminRow(req, res); if (!ev) return;
  if (!MAIL_ENABLED) return res.status(400).json({ error: "Email isn't set up yet (RESEND_API_KEY in Railway → Variables)." });
  if (!evrPodium(tickEvent(ev)).length) return res.status(400).json({ error: "There's no winner yet." });
  const me = db.prepare(`SELECT id, email, username, display_name, mail_key FROM users WHERE id = ?`).get(req.user.id);
  const r = await sendEventOpenEmail(me.email, "[Preview] " + await evrSubject(ev), await evrEmail(ev, me), evmUnsub(me));
  if (!r.sent) return res.status(502).json({ error: r.error || "It didn't send." });
  res.json({ ok: true, to: me.email });
});
