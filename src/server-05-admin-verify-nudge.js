/* ── CONFIRM-YOUR-EMAIL NUDGE v1.0 — 2026-10-19 ────────────────────────
   "I need to email everyone who hasn't confirmed their email to confirm it."
   Admin → System → Data → Email: one button. Everyone who hasn't confirmed
   (not suspended, has an address) gets a fresh confirm link — the same
   email as at sign-up, a new 24-hour link (issueVerification, server-02).
   Nobody gets it twice in a day, however often the button is pressed.
   Sent one at a time, a little apart, after the answer goes back, so
   Resend's rate limit is never hit and the admin page doesn't wait.
   Admin only, on the server; written to the admin log like every change. */
const NUDGE_GAP_MS = 600;
let NUDGING = false;
const nudgeTargets = (now) => db.prepare(`SELECT * FROM users
  WHERE email_verified = 0 AND suspended = 0 AND email IS NOT NULL AND email != ''
    AND (verify_nudged_at IS NULL OR verify_nudged_at < ?) ORDER BY created_at`).all(now - 86400000);

app.post("/api/admin/members/remind-unverified", auth, admin, async (req, res) => {
  if (!MAIL_ENABLED) return res.status(400).json({ error: "Email isn't set up (RESEND_API_KEY in Railway)." });
  if (NUDGING) return res.status(409).json({ error: "Already sending — give it a minute." });
  const now = Date.now(), list = nudgeTargets(now);
  // marked first, so a second press (or a restart mid-run) can't double-send
  const mark = db.prepare(`UPDATE users SET verify_nudged_at = ? WHERE id = ?`);
  for (const u of list) mark.run(now, u.id);
  res.json({ ok: true, sending: list.length });
  if (!list.length) return;
  NUDGING = true;
  let sent = 0, failed = 0;
  try {
    for (const u of list) {
      try { const r = await issueVerification(u, req); r && r.sent ? sent++ : failed++; } catch (e) { failed++; }
      await new Promise((r) => setTimeout(r, NUDGE_GAP_MS));
    }
  } finally {
    NUDGING = false;
    console.log(`[mail] confirm reminders: ${sent} sent, ${failed} failed of ${list.length}`);
  }
});
