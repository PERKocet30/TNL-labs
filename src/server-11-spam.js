/* ================================================================
   SPAM CHECK v1.1 — 2026-10-28 (a Mod can't remove the owner or another Mod). v1.0 — 2026-10-27. "Any account with multiple linked
   accounts needs to be deleted and their vote disregarded. Spam
   accounts… I'll manually do. I don't like my member count being filled
   with bots." Admin-only, enforced here.

   · GET  /api/admin/events/:id/spam — the tournament's voters, grouped:
     accounts are linked when they voted from the same phone (event_votes
     .device, from Oct 27) or signed up / signed in / voted from the same
     network (member_signals, from Oct 26). Each group comes with plain
     reasons to look: same phone, same network, joined minutes apart,
     nobody posted, no photos, throwaway emails — and who they voted for.
     A home or a phone carrier can link real people too, so nothing
     happens on its own: the admin looks and decides.
   · POST /api/admin/spam/remove { usernames } — those accounts are
     suspended (signed out, can't sign in, out of the member count) and
     every tournament vote they cast is taken off the scoreboard. The
     votes are kept aside in removed_votes, so…
   · POST /api/admin/spam/restore { usernames } — …a mistake is one tap:
     the account comes back and so do its votes.
   Suspended, not deleted: deleting would wipe a person's posts and
   history for good, and LABS doesn't erase member data from code.
   test/spam.test.mjs
================================================================ */
db.exec(`CREATE TABLE IF NOT EXISTS removed_votes (
  event_id INTEGER NOT NULL, stage TEXT NOT NULL, matchup INTEGER NOT NULL DEFAULT 0, entry_id INTEGER NOT NULL,
  voter_id INTEGER NOT NULL, created_at INTEGER NOT NULL, device TEXT NOT NULL DEFAULT '',
  removed_at INTEGER NOT NULL, removed_by INTEGER
)`);
try { db.exec(`ALTER TABLE users ADD COLUMN spam_at INTEGER`); } catch {}   // when an admin removed it as spam (null: never)

const SPAM_NEAR_MS = 2 * 3600000;   // "joined within … of each other" counts inside two hours
function spamGroups(evId) {
  const voters = db.prepare(`SELECT DISTINCT voter_id id FROM event_votes WHERE event_id = ?`).all(evId).map((r) => r.id);
  const removed = db.prepare(`SELECT DISTINCT voter_id id FROM removed_votes WHERE event_id = ?`).all(evId).map((r) => r.id);
  const ids = [...new Set([...voters, ...removed])];
  if (!ids.length) return [];
  const IN = ids.map(() => "?").join(",");
  /* union-find: one group per set of linked accounts */
  const up = new Map(ids.map((i) => [i, i]));
  const find = (x) => { while (up.get(x) !== x) { up.set(x, up.get(up.get(x))); x = up.get(x); } return x; };
  const join = (a, b) => { const ra = find(a), rb = find(b); if (ra !== rb) up.set(ra, rb); };
  const why = new Map();   // root → Set of link kinds, filled after grouping
  const links = [];
  const byKey = (rows, kind) => { const m = new Map(); for (const r of rows) { if (!r.k) continue; const s = m.get(r.k) || new Set(); s.add(r.u); m.set(r.k, s); }
    for (const s of m.values()) if (s.size > 1) { const a = [...s]; for (let i = 1; i < a.length; i++) { join(a[0], a[i]); links.push([a[0], a[i], kind]); } } };
  byKey(db.prepare(`SELECT device k, voter_id u FROM event_votes WHERE event_id = ? AND device != '' UNION SELECT device k, voter_id u FROM removed_votes WHERE event_id = ? AND device != ''`).all(evId, evId), "phone");
  let nets = [];
  try { nets = db.prepare(`SELECT DISTINCT net k, user_id u FROM member_signals WHERE net != '' AND user_id IN (${IN})`).all(...ids); } catch {}   // server-01-signals
  byKey(nets, "network");
  for (const [a, , kind] of links) { const r = find(a); const s = why.get(r) || new Set(); s.add(kind); why.set(r, s); }
  const groups = new Map();
  for (const i of ids) { const r = find(i); if (!groups.has(r)) groups.set(r, []); groups.get(r).push(i); }
  const user = db.prepare(`SELECT u.id, u.username, u.display_name, u.email, u.avatar_url, u.created_at, u.email_verified, u.is_admin, u.suspended, u.spam_at,
      (SELECT COUNT(*) FROM posts p WHERE p.author_id = u.id) posts FROM users u WHERE u.id = ?`);
  const votesOf = db.prepare(`SELECT v.entry_id, COUNT(*) n, uu.username author FROM event_votes v JOIN event_entries e ON e.id = v.entry_id JOIN users uu ON uu.id = e.user_id
    WHERE v.event_id = ? AND v.voter_id = ? GROUP BY v.entry_id`);
  const removedOf = db.prepare(`SELECT COUNT(*) n FROM removed_votes WHERE event_id = ? AND voter_id = ?`);
  const out = [];
  for (const [root, members] of groups) {
    if (members.length < 2) continue;
    const people = members.map((id) => { const u = user.get(id); if (!u) return null;
      const v = votesOf.all(evId, id);
      return { username: u.username, displayName: u.display_name, email: u.email, avatarUrl: u.avatar_url || "", joined: u.created_at, verified: !!u.email_verified,
        isAdmin: !!u.is_admin, removed: !!u.spam_at && !!u.suspended, posts: u.posts, throwaway: typeof emailThrowaway === "function" && emailThrowaway(u.email),
        votes: v.reduce((s, x) => s + x.n, 0) + (u.spam_at ? removedOf.get(evId, id).n : 0), votedFor: v.map((x) => x.author) }; }).filter(Boolean);
    const kinds = why.get(root) || new Set();
    const joins = people.map((p) => p.joined).sort((a, b) => a - b), span = joins.at(-1) - joins[0];
    const reasons = [];
    if (kinds.has("phone")) reasons.push("Same phone");
    if (kinds.has("network")) reasons.push("Same network");
    if (span < SPAM_NEAR_MS) reasons.push(`Joined within ${span < 3600000 ? Math.max(1, Math.round(span / 60000)) + " min" : Math.round(span / 3600000) + " h"} of each other`);
    if (people.every((p) => !p.posts)) reasons.push("None of them has posted");
    if (people.every((p) => !p.avatarUrl)) reasons.push("No photos");
    const tw = people.filter((p) => p.throwaway).length; if (tw) reasons.push(`${tw} throwaway email${tw === 1 ? "" : "s"}`);
    const tally = {}; for (const p of people) for (const a of p.votedFor) tally[a] = (tally[a] || 0) + 1;
    out.push({ id: "g" + root, size: people.length, reasons, votedFor: Object.entries(tally).sort((a, b) => b[1] - a[1]).map(([author, n]) => ({ author, n })),
      people: people.sort((a, b) => a.joined - b.joined), removed: people.filter((p) => p.removed).length });
  }
  /* the strongest first: more reasons, then bigger */
  return out.sort((a, b) => b.reasons.length - a.reasons.length || b.size - a.size);
}

app.get("/api/admin/events/:id/spam", auth, admin, (req, res) => {
  const ev = db.prepare(`SELECT id FROM events WHERE id = ?`).get(Number(req.params.id) || 0);
  if (!ev) return res.status(404).json({ error: "No such event." });
  const groups = spamGroups(ev.id);
  res.json({ groups, accounts: groups.reduce((s, g) => s + g.size, 0), phonesSince: "2026-10-27", networksSince: "2026-10-26" });
});

const spamNames = (b) => [...new Set((Array.isArray(b?.usernames) ? b.usernames : []).map((u) => String(u || "").trim().toLowerCase()).filter(Boolean))].slice(0, 200);
app.post("/api/admin/spam/remove", auth, admin, rateLimit({ max: 60, windowMs: 60000, key: "user" }), (req, res) => {
  const names = spamNames(req.body); if (!names.length) return res.status(400).json({ error: "Pick who to remove." });
  const now = Date.now(); let accounts = 0, votes = 0; const skipped = [];
  db.exec("BEGIN");
  try {
    for (const n of names) {
      const u = q.userByName.get(n);
      if (!u) continue;
      if (u.is_admin || u.id === req.user.id || (u.is_mod && !req.user.is_admin)) { skipped.push(n); continue; }
      const moved = db.prepare(`INSERT INTO removed_votes (event_id, stage, matchup, entry_id, voter_id, created_at, device, removed_at, removed_by)
        SELECT event_id, stage, matchup, entry_id, voter_id, created_at, COALESCE(device, ''), ?, ? FROM event_votes WHERE voter_id = ?`).run(now, req.user.id, u.id).changes;
      db.prepare(`DELETE FROM event_votes WHERE voter_id = ?`).run(u.id);
      db.prepare(`UPDATE users SET suspended = 1, spam_at = ? WHERE id = ?`).run(now, u.id);
      db.prepare(`DELETE FROM sessions WHERE user_id = ?`).run(u.id);
      accounts++; votes += moved;
    }
    db.exec("COMMIT");
  } catch (e) { db.exec("ROLLBACK"); throw e; }
  console.log(`[admin] @${req.user.username} removed ${accounts} account(s) as spam, ${votes} vote(s) taken off`);
  res.json({ ok: true, accounts, votes, skipped });
});
app.post("/api/admin/spam/restore", auth, admin, rateLimit({ max: 60, windowMs: 60000, key: "user" }), (req, res) => {
  const names = spamNames(req.body); if (!names.length) return res.status(400).json({ error: "Pick who to restore." });
  let accounts = 0, votes = 0;
  db.exec("BEGIN");
  try {
    for (const n of names) {
      const u = q.userByName.get(n);
      if (!u || !u.spam_at) continue;
      votes += db.prepare(`INSERT OR IGNORE INTO event_votes (event_id, stage, matchup, entry_id, voter_id, created_at, device)
        SELECT event_id, stage, matchup, entry_id, voter_id, created_at, device FROM removed_votes WHERE voter_id = ?`).run(u.id).changes;
      db.prepare(`DELETE FROM removed_votes WHERE voter_id = ?`).run(u.id);
      db.prepare(`UPDATE users SET suspended = 0, spam_at = NULL WHERE id = ?`).run(u.id);
      accounts++;
    }
    db.exec("COMMIT");
  } catch (e) { db.exec("ROLLBACK"); throw e; }
  console.log(`[admin] @${req.user.username} restored ${accounts} account(s), ${votes} vote(s) back`);
  res.json({ ok: true, accounts, votes });
});
