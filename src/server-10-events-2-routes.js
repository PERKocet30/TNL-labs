
/* ================================================================
   EVENTS v1.1 — 2026-10-07. What members see and do: the event page,
   entering, voting, judging, and the public /e/:slug pages.
   Vote counts never leave the server while a stage is open — except in a
   poll, where the scoreboard IS the point: it shows live, then freezes for
   the last `freeze_hours` so the end stays a surprise. A round's numbers
   show once it's decided; the full breakdown once results are in.
================================================================ */
const EV_STAGE = (p) => (p.phase === "qualify" ? "qualify" : p.phase === "round" ? "r" + p.round : p.phase === "final" ? "final" : null);
const evJudges = (evId) => db.prepare(`SELECT u.id, u.username, u.display_name, u.avatar_url FROM event_judges j JOIN users u ON u.id = j.user_id WHERE j.event_id = ?`).all(evId);

function evEntryShape(e) {
  const p = q.postById.get(e.post_id), u = q.userById.get(e.user_id);
  if (!p || !u) return null;
  return { id: e.id, postId: p.id, imageUrl: p.image_url, thumbUrl: p.thumb_url || p.image_url, w: p.media_w, h: p.media_h,
    caption: p.body, seed: e.seed ?? null, dq: !!e.dq_reason,
    author: { username: u.username, displayName: u.display_name, avatarUrl: u.avatar_url } };
}

/* A fixed shuffle per viewer: nobody gets top-of-the-list advantage, and the
   order doesn't jump around on refresh. */
const evShuffle = (list, salt) => list.slice().sort((a, b) => ((Math.imul(a.id ^ salt, 2654435761) >>> 0) - (Math.imul(b.id ^ salt, 2654435761) >>> 0)));

/* Who may vote on what, right now. null = yes; otherwise the reason. */
function evVoteBlock(ev, user, stage, entryId) {
  if (!user) return "Sign in to vote.";
  if (ev.require_verified && !user.email_verified) return "Confirm your email to vote — the link is in your inbox.";
  const days = Math.max(0, ev.min_account_days || 0);
  if (Date.now() - user.created_at < days * EV_DAY) return `Accounts need to be ${days} day${days === 1 ? "" : "s"} old to vote.`;
  if (stage === "final" && evJudges(ev.id).some((j) => j.id === user.id)) return "Judges score the final instead of voting.";
  if (entryId != null) {
    const e = db.prepare(`SELECT * FROM event_entries WHERE id = ? AND event_id = ?`).get(entryId, ev.id);
    if (!e || e.dq_reason) return "That piece isn't in this round.";
    if (e.user_id === user.id) return "You can't vote for your own piece.";
  }
  return null;
}

/* The entries in play for a stage: qualify → everyone; round N → its
   undecided matchups; final → the finalists. */
function evInPlay(ev, stage) {
  const st = evJSON(ev.state, {});
  if (stage === "qualify") return { ids: new Set(liveEntries(ev.id).map((e) => e.id)) };
  if (stage === "final") return { ids: new Set((st.finalists || []).filter((id) => !isDQ(id))) };
  if (stage && stage[0] === "r") {
    const ms = db.prepare(`SELECT * FROM event_matchups WHERE event_id = ? AND round = ? AND winner_entry IS NULL`).all(ev.id, Number(stage.slice(1)));
    const slotOf = new Map(); for (const m of ms) { slotOf.set(m.a_entry, m.slot); slotOf.set(m.b_entry, m.slot); }
    return { ids: new Set(slotOf.keys()), slotOf };
  }
  return { ids: new Set() };
}

/* The poll's scoreboard for a stage: everyone in play, ranked by votes
   (ties share a place), and how far each moved in the last 24 hours.
   In the last `freeze_hours` it stops at the moment the freeze began. */
function evBoard(ev, stage, cur, now = Date.now()) {
  if (ev.format !== "poll" || !["qualify", "final"].includes(stage)) return null;
  const freezeAt = cur.end - Math.max(0, ev.freeze_hours || 0) * 3600000;
  const frozen = ev.freeze_hours > 0 && now >= freezeAt;
  const cut = frozen ? freezeAt : now;
  const ids = [...evInPlay(ev, stage).ids];
  const count = (before) => {
    const m = new Map(ids.map((id) => [id, 0]));
    for (const r of db.prepare(`SELECT entry_id, COUNT(*) n FROM event_votes WHERE event_id = ? AND stage = ? AND created_at <= ? GROUP BY entry_id`).all(ev.id, stage, before))
      if (m.has(r.entry_id)) m.set(r.entry_id, r.n);
    return m;
  };
  const place = (m) => { const out = new Map(); for (const id of ids) out.set(id, 1 + ids.filter((x) => m.get(x) > m.get(id)).length); return out; };
  const nowC = count(cut), was = count(cut - EV_DAY), rank = place(nowC), prev = place(was);
  const started = cut - EV_DAY >= cur.start;   // no "moved" on day one: everyone started at 0
  const rows = ids.map((id) => ({ entryId: id, votes: nowC.get(id), rank: rank.get(id), move: started ? prev.get(id) - rank.get(id) : 0 }))
    .sort((a, b) => a.rank - b.rank || a.entryId - b.entryId);
  return { frozen, freezeAt, asOf: cut, total: rows.reduce((s, r) => s + r.votes, 0), rows };
}

function evPublic(ev, viewer) {
  tickEvent(ev);
  const sched = evJSON(ev.schedule, []), st = evJSON(ev.state, {}), cur = phaseAt(sched), stage = EV_STAGE(cur);
  const judges = evJudges(ev.id), isJudge = !!viewer && judges.some((j) => j.id === viewer.id);
  const all = db.prepare(`SELECT * FROM event_entries WHERE event_id = ? ORDER BY created_at`).all(ev.id);
  const shaped = new Map(all.map((e) => [e.id, evEntryShape(e)]).filter(([, s]) => s));
  const mine = viewer ? all.find((e) => e.user_id === viewer.id) : null;
  const myVotes = viewer && stage ? evMyVotes(ev, stage, viewer.id) : [];
  const myScores = {};
  if (isJudge) for (const r of db.prepare(`SELECT entry_id, score FROM event_scores WHERE event_id = ? AND judge_id = ?`).all(ev.id, viewer.id)) myScores[r.entry_id] = r.score;
  const showResults = cur.phase === "results" && st.results;

  let bracket = null;
  if (ev.format === "bracket" && st.size > 2) {
    const R = roundsBefore(st.size), rounds = [];
    for (let r = 1; r <= R; r++) {
      const ms = db.prepare(`SELECT * FROM event_matchups WHERE event_id = ? AND round = ? ORDER BY slot`).all(ev.id, r);
      if (!ms.length) { rounds.push({ round: r, matchups: [] }); continue; }
      const v = ms.some((m) => m.winner_entry) ? votesFor(ev.id, "r" + r) : null;
      rounds.push({ round: r, matchups: ms.map((m) => {
        const a = v?.get(m.a_entry) || 0, b = v?.get(m.b_entry) || 0;
        return { slot: m.slot, a: m.a_entry, b: m.b_entry, winner: m.winner_entry || null,
          aPct: m.winner_entry && a + b ? Math.round(100 * a / (a + b)) : null, bPct: m.winner_entry && a + b ? Math.round(100 * b / (a + b)) : null };
      }) });
    }
    bracket = { size: st.size, rounds };
  }
  return {
    event: { slug: ev.slug, title: ev.title, brief: ev.brief, prize: ev.prize, coverUrl: ev.cover_url, channel: ev.channel,
      format: ev.format, picks: ev.picks, judgeWeight: ev.judge_weight, minAccountDays: ev.min_account_days,
      freezeHours: ev.freeze_hours, requireVerified: !!ev.require_verified,
      bracketSize: ev.bracket_size, finalistsCount: ev.finalists,
      schedule: sched, phase: cur, stage, void: !!st.void, entryCount: [...shaped.values()].filter((e) => !e.dq).length,
      judges: judges.map((j) => ({ username: j.username, displayName: j.display_name, avatarUrl: j.avatar_url })) },
    me: { signedIn: !!viewer, isJudge, entry: mine ? shaped.get(mine.id) || null : null, myVotes, myScores,
      voteBlock: stage ? evVoteBlock(ev, viewer, stage, null) : null },
    entries: evShuffle([...shaped.values()].filter((e) => !e.dq), (viewer?.id || 0) ^ ev.id),
    inPlay: stage ? [...evInPlay(ev, stage).ids] : [],
    bracket,
    board: stage ? evBoard(ev, stage, cur) : null,
    finalists: st.finalists || null,
    results: showResults ? { winner: st.results.winner, ranking: st.results.ranking.map((r) => ({ entryId: r.entryId, judgeAvg: r.judgeAvg,
      judgePct: Math.round(r.judgeShare * 100), votePct: Math.round(r.voteShare * 100), score: Math.round(r.score * 1000) / 10 })) } : null,
  };
}

/* Your votes in this stage. In a poll, today's — yesterday's are spent. */
const evMyVotes = (ev, stage, uid) => (ev.format === "poll"
  ? db.prepare(`SELECT entry_id FROM event_votes WHERE event_id = ? AND stage = ? AND voter_id = ? AND matchup = ?`).all(ev.id, stage, uid, evDayKey())
  : db.prepare(`SELECT entry_id FROM event_votes WHERE event_id = ? AND stage = ? AND voter_id = ?`).all(ev.id, stage, uid)).map((r) => r.entry_id);

/* The live one for the Showroom banner, then upcoming, then the latest finished. */
function evCurrent() {
  const rows = db.prepare(`SELECT * FROM events WHERE published = 1 ORDER BY id DESC`).all().map((e) => tickEvent(e));
  const ph = (e) => phaseAt(evJSON(e.schedule, []));
  return rows.find((e) => !["upcoming", "results"].includes(ph(e).phase)) || rows.find((e) => ph(e).phase === "upcoming")
    || rows.find((e) => ph(e).phase === "results" && Date.now() - (ph(e).start || 0) < 14 * EV_DAY) || null;
}

const evOr404 = (req, res) => {
  const ev = evRow(req.params.slug);
  if (!ev || (!ev.published && !req.user?.is_admin)) { res.status(404).json({ error: "No such event." }); return null; }
  return ev;
};

app.get("/api/events", maybeAuth, (req, res) => {
  const cur = evCurrent();
  const list = db.prepare(`SELECT * FROM events WHERE published = 1 ORDER BY id DESC LIMIT 20`).all().map((e) => {
    const p = phaseAt(evJSON(tickEvent(e).schedule, []));
    return { slug: e.slug, title: e.title, coverUrl: e.cover_url, phase: p.phase, round: p.round || null, end: p.end };
  });
  res.json({ current: cur ? list.find((x) => x.slug === cur.slug) : null, events: list });
});

app.get("/api/events/:slug", maybeAuth, (req, res) => {
  const ev = evOr404(req, res); if (!ev) return;
  res.json(evPublic(ev, req.user || null));
});

app.post("/api/events/:slug/enter", auth, rateLimit({ max: 10, windowMs: 600000, key: "user" }), (req, res) => {
  const ev = evOr404(req, res); if (!ev) return;
  tickEvent(ev);
  if (phaseAt(evJSON(ev.schedule, [])).phase !== "submit") return res.status(400).json({ error: "Entries aren't open right now." });
  if (evJudges(ev.id).some((j) => j.id === req.user.id)) return res.status(403).json({ error: "Judges can't enter their own event." });
  if (db.prepare(`SELECT 1 FROM event_entries WHERE event_id = ? AND user_id = ?`).get(ev.id, req.user.id))
    return res.status(409).json({ error: "You've already entered. Withdraw it first to swap in a different piece." });
  const b = req.body || {};
  if (b.agree !== true) return res.status(400).json({ error: "Please agree to the rules first." });
  const up = (v) => (typeof v === "string" && /^\/uploads\/[A-Za-z0-9._-]+$/.test(v) ? v : null);
  const imageUrl = up(b.imageUrl), thumbUrl = up(b.thumbUrl) || imageUrl;
  if (!imageUrl) return res.status(400).json({ error: "Add your piece." });
  const caption = String(b.caption || "").trim().slice(0, 500);
  const now = Date.now();
  const info = q.createPost.run(req.user.id, ev.channel || "general", caption, null, imageUrl, null, thumbUrl,
    Number(b.w) || null, Number(b.h) || null, 1, null, null, null, now);
  const postId = Number(info.lastInsertRowid);
  db.prepare(`INSERT INTO event_entries (event_id, user_id, post_id, created_at) VALUES (?,?,?,?)`).run(ev.id, req.user.id, postId, now);
  const row = feedRows({ authorId: req.user.id, viewerId: req.user.id, limit: 1 }).find((r) => r.id === postId);
  if (row) broadcast("post", shapePost(row));
  res.json(evPublic(ev, req.user));
});

app.delete("/api/events/:slug/entry", auth, (req, res) => {
  const ev = evOr404(req, res); if (!ev) return;
  tickEvent(ev);
  if (phaseAt(evJSON(ev.schedule, [])).phase !== "submit") return res.status(400).json({ error: "Entries are locked once voting starts." });
  // the post stays — it's their work; it just isn't in the event any more
  db.prepare(`DELETE FROM event_entries WHERE event_id = ? AND user_id = ?`).run(ev.id, req.user.id);
  res.json(evPublic(ev, req.user));
});

app.post("/api/events/:slug/vote", auth, rateLimit({ max: 120, windowMs: 60000, key: "user" }), (req, res) => {
  const ev = evOr404(req, res); if (!ev) return;
  tickEvent(ev);
  const stage = EV_STAGE(phaseAt(evJSON(ev.schedule, [])));
  if (!stage) return res.status(400).json({ error: "Voting isn't open right now." });
  const entryId = Number(req.body?.entryId), on = req.body?.on !== false;
  const block = evVoteBlock(ev, req.user, stage, entryId);
  if (block) return res.status(403).json({ error: block });
  const play = evInPlay(ev, stage);
  if (!play.ids.has(entryId)) return res.status(400).json({ error: "That piece isn't in this round." });
  const del = db.prepare(`DELETE FROM event_votes WHERE event_id = ? AND stage = ? AND voter_id = ? AND entry_id = ?`);
  const add = db.prepare(`INSERT OR IGNORE INTO event_votes (event_id, stage, matchup, entry_id, voter_id, created_at) VALUES (?,?,?,?,?,?)`);
  db.exec("BEGIN");
  try {
    if (ev.format === "poll") {
      // a poll: `picks` votes a day, they add up; today's can be taken back
      const day = evDayKey();
      if (!on) db.prepare(`DELETE FROM event_votes WHERE event_id = ? AND stage = ? AND matchup = ? AND voter_id = ? AND entry_id = ?`).run(ev.id, stage, day, req.user.id, entryId);
      else {
        const today = db.prepare(`SELECT entry_id FROM event_votes WHERE event_id = ? AND stage = ? AND matchup = ? AND voter_id = ?`).all(ev.id, stage, day, req.user.id).map((r) => r.entry_id);
        if (!today.includes(entryId)) {
          if (today.length >= ev.picks) { db.exec("ROLLBACK"); return res.status(400).json({ error: ev.picks === 1 ? "You've voted today. Come back tomorrow — it resets at midnight ET." : `You've used today's ${ev.picks} votes. They reset at midnight ET.` }); }
          add.run(ev.id, stage, day, entryId, req.user.id, Date.now());
        }
      }
    } else if (!on) del.run(ev.id, stage, req.user.id, entryId);
    else if (stage === "qualify") {
      const used = db.prepare(`SELECT COUNT(*) n FROM event_votes WHERE event_id = ? AND stage = ? AND voter_id = ?`).get(ev.id, stage, req.user.id).n;
      const already = db.prepare(`SELECT 1 FROM event_votes WHERE event_id = ? AND stage = ? AND voter_id = ? AND entry_id = ?`).get(ev.id, stage, req.user.id, entryId);
      if (!already && used >= ev.picks) { db.exec("ROLLBACK"); return res.status(400).json({ error: `You've used all ${ev.picks} picks. Take one back first.` }); }
      add.run(ev.id, stage, 0, entryId, req.user.id, Date.now());
    } else if (stage === "final") {
      db.prepare(`DELETE FROM event_votes WHERE event_id = ? AND stage = 'final' AND voter_id = ?`).run(ev.id, req.user.id);
      add.run(ev.id, stage, 0, entryId, req.user.id, Date.now());
    } else {
      const slot = play.slotOf.get(entryId);
      db.prepare(`DELETE FROM event_votes WHERE event_id = ? AND stage = ? AND voter_id = ? AND matchup = ?`).run(ev.id, stage, req.user.id, slot);
      add.run(ev.id, stage, slot, entryId, req.user.id, Date.now());
    }
    db.exec("COMMIT");
  } catch (e) { db.exec("ROLLBACK"); throw e; }
  const myVotes = evMyVotes(ev, stage, req.user.id);
  res.json({ ok: true, stage, myVotes, board: evBoard(ev, stage, phaseAt(evJSON(ev.schedule, []))) });
});

app.post("/api/events/:slug/score", auth, (req, res) => {
  const ev = evOr404(req, res); if (!ev) return;
  tickEvent(ev);
  if (phaseAt(evJSON(ev.schedule, [])).phase !== "final") return res.status(400).json({ error: "Judging happens in the final." });
  if (!evJudges(ev.id).some((j) => j.id === req.user.id)) return res.status(403).json({ error: "Only this event's judges can score." });
  const entryId = Number(req.body?.entryId), score = Math.round(Number(req.body?.score));
  if (!(score >= 1 && score <= 10)) return res.status(400).json({ error: "Scores run from 1 to 10." });
  if (!evInPlay(ev, "final").ids.has(entryId)) return res.status(400).json({ error: "That piece isn't a finalist." });
  db.prepare(`INSERT INTO event_scores (event_id, entry_id, judge_id, score, created_at) VALUES (?,?,?,?,?)
    ON CONFLICT(event_id, entry_id, judge_id) DO UPDATE SET score = excluded.score, created_at = excluded.created_at`).run(ev.id, entryId, req.user.id, score, Date.now());
  res.json({ ok: true, entryId, score });
});
