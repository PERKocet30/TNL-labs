/* ================================================================
   GET STARTED v1.0 — 2026-10-18 (onboarding). The two things a new
   member's Get started list (app/gate/getstarted.js) can't know on its own:
   how many pieces they've posted and how many people they follow. Their
   own numbers only, so it's signed in and tells nobody anything new.
================================================================ */
app.get("/api/me/start", auth, (req, res) => {
  const n = (sql) => db.prepare(sql).get(req.user.id)?.n ?? 0;
  res.json({
    posts: n(`SELECT COUNT(*) n FROM posts WHERE author_id = ? AND is_work = 1`),
    following: n(`SELECT COUNT(*) n FROM follows WHERE follower_id = ?`),
  });
});
