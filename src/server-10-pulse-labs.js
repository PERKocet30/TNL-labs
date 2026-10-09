
/* ================================================================
   ADMIN · THE DIRECTION v1.0 — 2026-10-09. What /admin's Today runs on
   now that labs are places and the tournament is the centre:
     - each lab (genre): work, talk, who's there, its #tags this period
     - the #tags people are using, across every lab
     - the tournament: where it stands, entries, voters, votes
     - how people take part (build, talk, feedback, the tournament,
       collabs, selling) and who hasn't yet
     - what needs you about the tournament (a draft, a phase ending)
   Votes only ever count in the app; Instagram is for reach. Admin-only,
   checked here on the server. Uses PLACES / rowTags from
   server-10-places.js and the events engine (tickEvent, phaseAt).
================================================================ */
/* Display names, as the app shows them (LABS in app-07-theme-labs-api.js —
   test/admin-direction.test.mjs checks they match). */
const LAB_NAME = { hq: "General", pharmacy: "Visual", culture: "Music", fashion: "Fashion", akatsuki: "Anime", casino: "News", tna: "Business" };
const labName = (ch) => (ch === "profile" ? "Profile" : LAB_NAME[LAB_OF[ch]] || "");
const LAB_CHANNELS = Object.values(PLACES).flatMap((p) => p.channels);

/* The same window /api/admin/pulse uses: `days` days back from the
   admin's local midnight, and the same length before it. */
function adminWindow(q, now = Date.now()) {
  const days = [7, 30, 90].includes(Number(q.days)) ? Number(q.days) : 30;
  const tz = Math.max(-840, Math.min(840, Number(q.tz) || 0)) * 60000;
  const start = Math.floor((now - tz) / ADAY) * ADAY + tz - (days - 1) * ADAY;
  return { days, start, prevStart: start - days * ADAY };
}

/* The tournament to show: the live published one, else a draft being
   set up, else the last one that ran. */
const TPH = { upcoming: "Opens", submit: "Entries", qualify: "Voting", final: "The final", results: "Results" };
function tournamentNow(now) {
  const all = db.prepare(`SELECT * FROM events ORDER BY id DESC`).all().map((e) => { tickEvent(e); return { e, ph: phaseAt(evJSON(e.schedule, []), now) }; });
  const pick = all.find((x) => x.e.published && x.ph.phase !== "results") || all.find((x) => !x.e.published) || all[0];
  if (!pick) return null;
  const { e, ph } = pick, n = (sql, ...p) => db.prepare(sql).get(e.id, ...p).n;
  return {
    id: e.id, slug: e.slug, title: e.title, format: e.format, published: !!e.published, prize: e.prize || "",
    phase: { phase: ph.phase, round: ph.round || null, start: ph.start ?? null, end: ph.end ?? null },
    entries: n(`SELECT COUNT(*) n FROM event_entries WHERE event_id = ? AND dq_reason IS NULL`),
    voters: n(`SELECT COUNT(DISTINCT voter_id) n FROM event_votes WHERE event_id = ?`),
    votes: n(`SELECT COUNT(*) n FROM event_votes WHERE event_id = ?`),
    votesDay: n(`SELECT COUNT(*) n FROM event_votes WHERE event_id = ? AND created_at > ?`, now - ADAY),
  };
}
function tournamentNeeds(T, now) {
  if (!T) return [{ kind: "tournament", level: "low", text: "No tournament set up yet", go: "events" }];
  if (!T.published) return [{ kind: "tournament", level: "mid", text: `“${T.title}” is still a draft — members can't see it`, go: "events", event: T.id }];
  const p = T.phase, left = p.end ? p.end - now : Infinity;
  if (!["submit", "qualify", "round", "final"].includes(p.phase) || left > 48 * 3600000) return [];
  const h = left < 3600000 ? Math.max(1, Math.round(left / 60000)) + "m" : Math.round(left / 3600000) + "h";
  const text = p.phase === "submit" ? `Entries close in ${h} — ${T.entries} so far. Remind the chats on Instagram`
    : `${p.phase === "round" ? "Round " + p.round : TPH[p.phase]} ends in ${h} — post the scoreboard to Instagram`;
  return [{ kind: "tournament", level: "mid", text, go: "events", event: T.id }];
}

/* How people take part, person by person (everyone not suspended). */
function takingPart() {
  const set = (sql) => new Set(db.prepare(sql).all().map((r) => r.u));
  const live = set(`SELECT id u FROM users WHERE suspended = 0`);
  const ways = [
    ["build", "Posted work", set(`SELECT DISTINCT author_id u FROM posts WHERE is_work = 1`)],
    ["talk", "Talked in a lab", set(`SELECT DISTINCT author_id u FROM posts WHERE is_work = 0 AND channel IN (${inList(LAB_CHANNELS)})`)],
    ["feedback", "Gave feedback", set(`SELECT c.author_id u FROM comments c JOIN posts p ON p.id = c.post_id WHERE c.author_id != p.author_id
      UNION SELECT l.user_id FROM likes l JOIN posts p ON p.id = l.post_id WHERE l.user_id != p.author_id
      UNION SELECT x.user_id FROM reactions x JOIN posts p ON p.id = x.target_id WHERE x.kind = 'post' AND x.user_id != p.author_id`)],
    ["compete", "In the tournament", set(`SELECT user_id u FROM event_entries UNION SELECT voter_id FROM event_votes`)],
    ["collab", "Collab confirmed", set(`SELECT user_id u FROM collaborators WHERE status = 'accepted' UNION SELECT p.author_id FROM collaborators c JOIN posts p ON p.id = c.post_id WHERE c.status = 'accepted'`)],
    ["sell", "Sold something", set(`SELECT DISTINCT seller_id u FROM orders WHERE status IN ${PAID}`)],
  ];
  const any = new Set(ways.flatMap(([, , s]) => [...s]));
  const notYet = db.prepare(`SELECT id, username, display_name, avatar_url FROM users WHERE suspended = 0 ORDER BY created_at DESC`).all().filter((u) => !any.has(u.id));
  return {
    members: live.size,
    ways: ways.map(([key, label, s]) => ({ key, label, n: [...s].filter((u) => live.has(u)).length })),
    notYet: { n: notYet.length, people: notYet.slice(0, 40).map((u) => ({ username: u.username, displayName: u.display_name, avatarUrl: u.avatar_url || "" })) },
  };
}

app.get("/api/admin/direction", auth, admin, (req, res) => {
  const now = Date.now(), { days, start, prevStart } = adminWindow(req.query, now);
  const rows = db.prepare(`SELECT channel, author_id, is_work, body, created_at FROM posts WHERE created_at >= ?`).all(start);

  // each lab this period, in the app's order; work posted on profiles last
  const groups = [...Object.keys(PLACES), "profile"].map((id) => ({ id, rows: rows.filter((r) => (id === "profile" ? r.channel === "profile" : LAB_OF[r.channel] === id)) }));
  const labs = groups.map(({ id, rows: rs }) => ({
    id, name: id === "profile" ? "Profiles" : LAB_NAME[id],
    work: rs.filter((r) => r.is_work).length, talk: rs.filter((r) => !r.is_work).length,
    people: new Set(rs.map((r) => r.author_id)).size, last: rs.reduce((m, r) => Math.max(m, r.created_at), 0) || null,
    tags: topTags(rs, 8).filter((t) => !PLAIN_TAGS.has(t.tag)).slice(0, 4),
  }));

  // the #tags people are using, everywhere, and which labs they're in
  const where = new Map();
  for (const r of rows) for (const t of rowTags(r)) { if (!where.has(t)) where.set(t, new Set()); where.get(t).add(LAB_OF[r.channel] || "profile"); }
  const tags = topTags(rows, 30).filter((t) => !PLAIN_TAGS.has(t.tag)).slice(0, 12).map((t) => ({ ...t, labs: [...where.get(t.tag)] }));

  const votesIn = (a, b) => aone(`SELECT COUNT(*) n FROM event_votes WHERE created_at > ? AND created_at <= ?`, a, b);
  const votes = new Array(days).fill(0);
  for (const r of db.prepare(`SELECT CAST((created_at - ?1) / ${ADAY} AS INTEGER) d, COUNT(*) n FROM event_votes WHERE created_at >= ?1 GROUP BY d`).all(start))
    if (r.d >= 0 && r.d < days) votes[r.d] = r.n;

  const T = tournamentNow(now);
  res.json({
    days, start, labs, tags, tournament: T, needs: tournamentNeeds(T, now), takingPart: takingPart(),
    votes: { now: votesIn(start, now), before: votesIn(prevStart, start) }, series: { votes },
  });
});
