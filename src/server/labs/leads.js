/* ================================================================
   LAB LEADS v1.1 — 2026-10-28 (a new Lead is emailed). v1.0 — 2026-10-28. "A lab lead under mod. Leaders of a
   specific scene … they're quality control."
   A Lead runs one or more labs (PLACES ids: hq, pharmacy, culture,
   fashion, akatsuki, casino, tna). Inside those labs only, and only in the
   app, they:
     - pin and unpin work in the lab's Talk (POST /api/posts/:id/pin)
     - take down posts (DELETE /api/labs/posts/:id) and comments
       (DELETE /api/comments/:id) that don't meet the bar
   Never the owner's, a Mod's or another Lead's. No /admin, no numbers, no
   rep, no emails. Every takedown is in the admin log under their name and
   the author is told which lab removed it.
   The owner and Mods appoint Leads (POST /api/admin/members/:username/lead,
   listed in MOD_MAY). The owner and Mods can already do all of this in
   every lab. Being a Lead is public: profiles carry `leads`, and each
   lab's Work says who leads it.
   Uses PLACES / LAB_OF (server/labs/places.js) at request time only.
================================================================ */
db.exec(`CREATE TABLE IF NOT EXISTS lab_leads (
  user_id      INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  lab          TEXT NOT NULL,
  appointed_by INTEGER,
  created_at   INTEGER NOT NULL,
  PRIMARY KEY (user_id, lab)
)`);

/* the labs someone leads, in PLACES order */
function leadsOf(userId) {
  if (!userId) return [];
  const mine = new Set(db.prepare(`SELECT lab FROM lab_leads WHERE user_id = ?`).all(userId).map((r) => r.lab));
  return Object.keys(PLACES).filter((l) => mine.has(l));
}
/* who leads a lab — only accounts in good standing */
function leadsFor(lab) {
  return db.prepare(`SELECT u.username, u.display_name FROM lab_leads l JOIN users u ON u.id = l.user_id
    WHERE l.lab = ? AND u.suspended = 0 ORDER BY l.created_at`).all(lab).map((u) => ({ username: u.username, displayName: u.display_name }));
}
const isLeadAnywhere = (userId) => !!db.prepare(`SELECT 1 FROM lab_leads WHERE user_id = ? LIMIT 1`).get(userId);

/* Can this user curate this post's lab? The owner and Mods: any lab post.
   A Lead: posts in a lab they lead. Profile posts aren't in a lab. */
function curatesPost(user, post) {
  if (!user || !post || !post.channel || post.channel === "profile") return false;
  if (user.is_admin || user.is_mod) return true;
  const lab = LAB_OF[post.channel];
  return !!lab && !!db.prepare(`SELECT 1 FROM lab_leads WHERE user_id = ? AND lab = ?`).get(user.id, lab);
}
/* Taking something down also needs its author to be fair game: a Lead
   can't remove the owner's, a Mod's or another Lead's; a Mod can't remove
   the owner's or another Mod's (as in /admin). The owner can remove anything. */
function mayTakeDown(user, post, authorId) {
  if (!curatesPost(user, post)) return false;
  if (user.is_admin || authorId === user.id) return true;
  const a = q.userById.get(authorId);
  if (!a) return true;
  if (a.is_admin || a.is_mod) return false;
  return !!user.is_mod || !isLeadAnywhere(a.id);
}

/* gate for the pin route (replaces admin-only, server/core/live.js) */
function curator(req, res, next) {
  const post = q.postById.get(Number(req.params.id));
  if (!post) return res.status(404).json({ error: "no post" });
  if (!curatesPost(req.user, post)) return res.status(403).json({ error: "Only this lab's lead can do that." });
  next();
}

app.delete("/api/labs/posts/:id", auth, (req, res) => {
  const post = q.postById.get(Number(req.params.id));
  if (!post) return res.status(404).json({ error: "no post" });
  if (!curatesPost(req.user, post)) return res.status(403).json({ error: "Only this lab's lead can do that." });
  if (!mayTakeDown(req.user, post, post.author_id)) return res.status(403).json({ error: "Leads can't take down posts from the owner, a Mod or another Lead." });
  const lab = LAB_OF[post.channel];
  db.prepare(`DELETE FROM posts WHERE id = ?`).run(post.id);
  db.prepare(`DELETE FROM reactions WHERE kind = 'post' AND target_id = ?`).run(post.id);
  db.prepare(`DELETE FROM channel_pins WHERE post_id = ?`).run(post.id);
  broadcast("post-delete", { id: post.id });
  if (post.author_id !== req.user.id) {
    notify(post.author_id, req.user.id, "removed", null, `Your post in // ${LAB_NAME[lab] || "a lab"} was taken down by its lead`);
    auditAdmin(req, `lead took down a post in ${lab}`);
  }
  res.json({ ok: true });
});

app.get("/api/labs/:lab/leads", auth, (req, res) => {
  if (!PLACES[req.params.lab]) return res.status(404).json({ error: "No such lab." });
  res.json({ leads: leadsFor(req.params.lab) });
});

/* the owner or a Mod makes / removes a Lead for one lab */
app.post("/api/admin/members/:username/lead", auth, admin, (req, res) => {
  const t = q.userByName.get(req.params.username);
  if (!t) return res.status(404).json({ error: "no such user" });
  const lab = String(req.body?.lab || "");
  if (!PLACES[lab]) return res.status(400).json({ error: "Pick a lab." });
  if (t.is_admin || t.is_mod) return res.status(400).json({ error: "The owner and Mods already curate every lab." });
  const on = !!req.body?.on;
  if (on && t.suspended) return res.status(400).json({ error: "Restore their account before making them a Lead." });
  if (on) { const added = db.prepare(`INSERT OR IGNORE INTO lab_leads (user_id, lab, appointed_by, created_at) VALUES (?,?,?,?)`).run(t.id, lab, req.user.id, Date.now()).changes;
    if (added) mailRole(req, t, "lead", lab); }   // emailed once, when it's new (server/admin/mods.js)
  else db.prepare(`DELETE FROM lab_leads WHERE user_id = ? AND lab = ?`).run(t.id, lab);
  res.json({ ok: true, leads: leadsOf(t.id) });
});
