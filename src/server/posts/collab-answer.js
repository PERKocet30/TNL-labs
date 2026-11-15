/* ================================================================
   A COLLAB INVITE GETS AN ANSWER · v1.0 — 2026-11-15
   The fix list's number 5: "Collab invites get a decline button and a nudge
   that puts the piece in front of the invitee. 6 of 14 invites sat ignored
   over 7 days." Two things:
     · Not this time — POST /api/posts/:id/collab/decline. Only the person
       invited, only while it's pending. The invite goes; the author is told
       kindly ("passed on this one"), and can invite someone else.
     · One nudge — an invite still pending after COLLAB_NUDGE_AFTER (2 days)
       gets one notification ("is waiting on your answer") and, if email is on
       and the member hasn't switched it off, one email with the piece's words
       and a button to it (/?p=id, where Accept · Not this time are).
       Once per invite (collaborators.nudged_at), at most COLLAB_NUDGE_PER_RUN
       emails a run.
   Collabs still count only once the other person accepts (accept is in
   posts/collabs-showroom).
================================================================ */
try { db.exec(`ALTER TABLE collaborators ADD COLUMN nudged_at INTEGER`); } catch {}

app.post("/api/posts/:id/collab/decline", auth, (req, res) => {
  const post = q.postById.get(Number(req.params.id));
  if (!post) return res.status(404).json({ error: "no post" });
  const row = q.collabRow.get(post.id, req.user.id);
  if (!row || row.status !== "pending") return res.status(404).json({ error: "There's no invite waiting for you on this post." });
  db.prepare(`DELETE FROM collaborators WHERE post_id = ? AND user_id = ? AND status = 'pending'`).run(post.id, req.user.id);
  db.prepare(`UPDATE notifications SET read_at = COALESCE(read_at, ?) WHERE user_id = ? AND post_id = ? AND kind IN ('collab_invite','collab_nudge')`).run(Date.now(), req.user.id, post.id);
  notify(post.author_id, req.user.id, "collab_decline", post.id, "passed on this one");
  broadcast("collab-declined", { postId: post.id, username: req.user.username });
  res.json({ ok: true, status: "declined" });
});

const COLLAB_NUDGE_AFTER = Math.max(0, Number(process.env.COLLAB_NUDGE_AFTER_MS ?? 2 * 86400000));
const COLLAB_NUDGE_TICK = Math.max(200, Number(process.env.COLLAB_NUDGE_TICK_MS) || 30 * 60000);
const COLLAB_NUDGE_PER_RUN = Math.max(1, Number(process.env.COLLAB_NUDGE_PER_RUN) || 20);
let COLLAB_NUDGING = false;
async function collabNudgeRun(now = Date.now()) {
  if (COLLAB_NUDGING) return;
  COLLAB_NUDGING = true;
  try {
    const rows = db.prepare(`SELECT c.post_id, c.user_id, p.author_id, p.body,
        u.email, u.username, u.display_name, u.mail_key, u.email_verified, u.mail_off,
        a.username AS by_username, a.display_name AS by_name
      FROM collaborators c JOIN posts p ON p.id = c.post_id JOIN users u ON u.id = c.user_id JOIN users a ON a.id = p.author_id
      WHERE c.status = 'pending' AND c.nudged_at IS NULL AND c.created_at <= ? AND u.suspended = 0 AND a.suspended = 0
      ORDER BY c.created_at LIMIT ?`).all(now - COLLAB_NUDGE_AFTER, COLLAB_NUDGE_PER_RUN);
    for (const r of rows) {
      db.prepare(`UPDATE collaborators SET nudged_at = ? WHERE post_id = ? AND user_id = ?`).run(now, r.post_id, r.user_id);   // once, whatever happens next
      notify(r.user_id, r.author_id, "collab_nudge", r.post_id, "is waiting on your answer to their collab");
      if (!MAIL_ENABLED || MAIL_TEST_SENDER || !r.email_verified || r.mail_off || !/.+@.+/.test(r.email || "")) continue;
      const by = r.by_name || r.by_username, unsub = evmUnsub({ id: r.user_id, mail_key: r.mail_key });
      const subject = collabNudgeSubject(by);
      const mail = collabNudgeEmail({ name: r.display_name || r.username, by, byUsername: r.by_username, caption: String(r.body || "").slice(0, 280), url: `${evmBase()}/?p=${r.post_id}`, unsub });
      const out = await sendNudgeEmail(r.email, subject, mail, unsub);
      if (!out.sent) console.error("[collab nudge]", out.error);
    }
  } catch (e) { console.error("[collab nudge]", e.message); }
  finally { COLLAB_NUDGING = false; }
}
setInterval(() => collabNudgeRun(), COLLAB_NUDGE_TICK).unref?.();
setTimeout(() => collabNudgeRun(), Math.min(COLLAB_NUDGE_TICK, 20000)).unref?.();   // and soon after boot
