
/* ================================================================
   EVENTS v1.1 — 2026-10-07. The engine behind TNL's events. The first
   is the graphic design / art tournament.

   An event runs on a schedule of phases:
     submit  → members enter one piece each (a real post, in the event's lab)
     qualify → members pick favourites (up to `picks`); counts stay hidden
     round N → BRACKET format only: head-to-head matchups, one pick each
     final   → judges' scores + member votes decide (judge_weight %)
     results → winner, finalists, the full breakdown

   Three formats, picked per event (the community chooses):
     bracket — qualify → top 16 (or the largest power of two there is) →
               head-to-head rounds → the last two meet in the final
     simple  — open vote → top `finalists` → the final
     poll    — simple, run like a poll: `picks` votes a DAY (they add up,
               resetting at midnight Eastern) and a live public scoreboard,
               frozen for the last `freeze_hours` of each stage. What the
               community asked for. Instagram sends people in; every vote
               is counted here.

   tickEvent() is the whole state machine. It is idempotent and runs on
   every read and once a minute, so phases close on time with nobody
   watching. Nothing is decided from the client.
================================================================ */
db.exec(`
CREATE TABLE IF NOT EXISTS events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  slug TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL,
  brief TEXT NOT NULL DEFAULT '',
  rules TEXT NOT NULL DEFAULT '',
  prize TEXT NOT NULL DEFAULT '',
  cover_url TEXT,
  channel TEXT NOT NULL DEFAULT 'graphic-design',
  format TEXT NOT NULL DEFAULT 'bracket',
  bracket_size INTEGER NOT NULL DEFAULT 16,
  finalists INTEGER NOT NULL DEFAULT 8,
  judge_weight INTEGER NOT NULL DEFAULT 50,
  picks INTEGER NOT NULL DEFAULT 3,
  min_account_days INTEGER NOT NULL DEFAULT 3,
  freeze_hours INTEGER NOT NULL DEFAULT 24,
  require_verified INTEGER NOT NULL DEFAULT 1,
  plan TEXT NOT NULL DEFAULT '{}',
  schedule TEXT NOT NULL DEFAULT '[]',
  state TEXT NOT NULL DEFAULT '{}',
  published INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS event_entries (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  event_id INTEGER NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  post_id INTEGER NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  seed INTEGER,
  dq_reason TEXT,
  created_at INTEGER NOT NULL,
  UNIQUE (event_id, user_id)
);
CREATE TABLE IF NOT EXISTS event_votes (
  event_id INTEGER NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  stage TEXT NOT NULL,
  matchup INTEGER NOT NULL DEFAULT 0,  -- the slot in a round; the day (yyyymmdd, Eastern) in a poll
  entry_id INTEGER NOT NULL REFERENCES event_entries(id) ON DELETE CASCADE,
  voter_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at INTEGER NOT NULL,
  PRIMARY KEY (event_id, stage, matchup, voter_id, entry_id)
);
CREATE INDEX IF NOT EXISTS idx_event_votes ON event_votes(event_id, stage, entry_id);
CREATE TABLE IF NOT EXISTS event_judges (
  event_id INTEGER NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  PRIMARY KEY (event_id, user_id)
);
CREATE TABLE IF NOT EXISTS event_scores (
  event_id INTEGER NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  entry_id INTEGER NOT NULL REFERENCES event_entries(id) ON DELETE CASCADE,
  judge_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  score INTEGER NOT NULL,
  created_at INTEGER NOT NULL,
  PRIMARY KEY (event_id, entry_id, judge_id)
);
CREATE TABLE IF NOT EXISTS event_matchups (
  event_id INTEGER NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  round INTEGER NOT NULL,
  slot INTEGER NOT NULL,
  a_entry INTEGER,
  b_entry INTEGER,
  winner_entry INTEGER,
  PRIMARY KEY (event_id, round, slot)
);
`);

const EV_DAY = 86400000;
/* A poll's voting day: 20261120 — the calendar date in New York, so
   "resets at midnight" means midnight for the people running it. */
const evDayKey = (t = Date.now()) => Number(new Date(t).toLocaleDateString("en-CA", { timeZone: "America/New_York" }).replace(/-/g, ""));
const evJSON = (s, d) => { try { return JSON.parse(s); } catch { return d; } };
const evRow = (idOrSlug) => typeof idOrSlug === "number"
  ? db.prepare(`SELECT * FROM events WHERE id = ?`).get(idOrSlug)
  : db.prepare(`SELECT * FROM events WHERE slug = ?`).get(String(idOrSlug || "").toLowerCase());
const evSave = (ev, fields) => {
  const keys = Object.keys(fields);
  db.prepare(`UPDATE events SET ${keys.map((k) => k + " = ?").join(", ")}, updated_at = ? WHERE id = ?`)
    .run(...keys.map((k) => fields[k]), Date.now(), ev.id);
  Object.assign(ev, fields);
};

/* How many head-to-head rounds come before the final, for a bracket of n. */
const roundsBefore = (n) => Math.max(0, Math.round(Math.log2(n)) - 1);
/* The largest power of two ≤ n (min 2). 11 entries → an 8-bracket. */
const pow2Floor = (n) => (n < 2 ? 0 : 2 ** Math.floor(Math.log2(n)));
/* Standard seeding: 1 meets the lowest seed, and 1 and 2 can only meet in the final. */
function seedOrder(n) {
  let s = [1];
  while (s.length < n) { const m = s.length * 2 + 1; s = s.flatMap((x) => [x, m - x]); }
  return s;
}

/* The schedule from the plan: { opensAt, submitDays, voteDays, roundDays, finalDays }.
   `size` is the bracket actually used (known once the vote closes). */
const evLen = (days, dflt) => Math.max(0.01, Number(days ?? dflt) || dflt) * EV_DAY;
function scheduleTail(ev, plan, size, t) {
  const out = [];
  if (ev.format === "bracket") for (let r = 1; r <= roundsBefore(size || ev.bracket_size); r++) {
    const len = evLen(plan.roundDays, 2); out.push({ phase: "round", round: r, start: t, end: t + len }); t += len;
  }
  const fl = evLen(plan.finalDays, 3);
  out.push({ phase: "final", start: t, end: t + fl }, { phase: "results", start: t + fl, end: null });
  return out;
}
function buildSchedule(ev, plan, size) {
  let t = Number(plan.opensAt) || Date.now();
  const sub = evLen(plan.submitDays, 14), vote = evLen(plan.voteDays, ev.format === "bracket" ? 3 : 7);
  return [{ phase: "submit", start: t, end: t + sub }, { phase: "qualify", start: t + sub, end: t + sub + vote },
    ...scheduleTail(ev, plan, size, t + sub + vote)];
}

/* Where an event is at time t. */
function phaseAt(sched, t = Date.now()) {
  if (!sched.length || t < sched[0].start) return { phase: "upcoming", start: null, end: sched[0]?.start ?? null };
  for (const p of sched) if (t >= p.start && (p.end == null || t < p.end)) return p;
  return sched[sched.length - 1];
}

/* "End this phase now": it ends at t, and every later phase moves earlier
   by the time saved. Before the event opens, it opens now. */
function advanceSchedule(sched, t = Date.now()) {
  const cur = phaseAt(sched, t);
  if (cur.phase === "results") return sched;
  const boundary = cur.phase === "upcoming" ? sched[0].start : cur.end;
  const delta = boundary - t;
  return sched.map((p) => {
    if (p === cur) return { ...p, end: t };
    if (p.start >= boundary) return { ...p, start: p.start - delta, end: p.end == null ? null : p.end - delta };
    return p;
  });
}

const liveEntries = (evId) => db.prepare(`SELECT * FROM event_entries WHERE event_id = ? AND dq_reason IS NULL ORDER BY created_at`).all(evId);
const votesFor = (evId, stage) => {
  const m = new Map();
  for (const r of db.prepare(`SELECT entry_id, COUNT(*) n FROM event_votes WHERE event_id = ? AND stage = ? GROUP BY entry_id`).all(evId, stage)) m.set(r.entry_id, r.n);
  return m;
};
const isDQ = (entryId) => !!db.prepare(`SELECT dq_reason FROM event_entries WHERE id = ?`).get(entryId)?.dq_reason;
const entryOwner = (entryId) => db.prepare(`SELECT user_id FROM event_entries WHERE id = ?`).get(entryId)?.user_id;

/* Rank by votes; ties go to whoever entered first. */
function rankByVotes(evId, stage, entries) {
  const v = votesFor(evId, stage);
  return entries.slice().sort((a, b) => (v.get(b.id) || 0) - (v.get(a.id) || 0) || a.created_at - b.created_at);
}

function evNotify(userId, ev, body, postId = null) {
  notify(userId, null, "event", postId, `${ev.title}: ${body}`.slice(0, 240));
}

/* Decide one head-to-head. DQ'd loses; more votes wins; a tie goes to the better seed. */
function decideMatchup(ev, m, stage) {
  const seed = (id) => db.prepare(`SELECT seed FROM event_entries WHERE id = ?`).get(id)?.seed ?? 999;
  const a = m.a_entry, b = m.b_entry;
  let w;
  if (!b || isDQ(b)) w = a; else if (!a || isDQ(a)) w = b;
  else {
    const v = votesFor(ev.id, stage), va = v.get(a) || 0, vb = v.get(b) || 0;
    w = va > vb ? a : vb > va ? b : (seed(a) <= seed(b) ? a : b);
  }
  db.prepare(`UPDATE event_matchups SET winner_entry = ? WHERE event_id = ? AND round = ? AND slot = ?`).run(w, ev.id, m.round, m.slot);
  return w;
}

/* The final: judges' share of the points + members' share of the votes. */
function finalScores(ev, finalists) {
  const ids = finalists.filter((id) => !isDQ(id));
  const votes = votesFor(ev.id, "final");
  const totalVotes = ids.reduce((s, id) => s + (votes.get(id) || 0), 0);
  const avg = new Map(ids.map((id) => {
    const r = db.prepare(`SELECT AVG(score) a, COUNT(*) n FROM event_scores WHERE event_id = ? AND entry_id = ?`).get(ev.id, id);
    return [id, { avg: r.n ? r.a : 0, n: r.n }];
  }));
  const totalAvg = ids.reduce((s, id) => s + avg.get(id).avg, 0);
  const anyJudges = ids.some((id) => avg.get(id).n > 0);
  let w = Math.min(100, Math.max(0, ev.judge_weight)) / 100;
  if (!anyJudges) w = 0; else if (!totalVotes) w = 1;   // only one side showed up: it decides
  const rows = ids.map((id) => {
    const judgeShare = totalAvg ? avg.get(id).avg / totalAvg : 0;
    const voteShare = totalVotes ? (votes.get(id) || 0) / totalVotes : 0;
    return { entryId: id, judgeAvg: Math.round(avg.get(id).avg * 10) / 10, judges: avg.get(id).n,
      votes: votes.get(id) || 0, judgeShare, voteShare, score: w * judgeShare + (1 - w) * voteShare };
  });
  return rows.sort((a, b) => b.score - a.score || b.judgeAvg - a.judgeAvg || b.votes - a.votes || a.entryId - b.entryId);
}

/* The state machine. Safe to call any time, as often as you like. */
function tickEvent(ev, now = Date.now()) {
  if (!ev) return ev;
  let sched = evJSON(ev.schedule, []), st = evJSON(ev.state, {});
  if (!sched.length) return ev;
  const ended = (phase, round) => { const p = sched.find((x) => x.phase === phase && (round == null || x.round === round)); return p && p.end != null && now >= p.end; };
  const save = () => evSave(ev, { schedule: JSON.stringify(sched), state: JSON.stringify(st) });
  let changed = false;

  // submissions closed: fewer than two entries means there's no contest
  if (ended("submit") && !st.submitClosed) {
    st.submitClosed = true; changed = true;
    if (liveEntries(ev.id).length < 2) { st.void = true; st.results = { winner: null, ranking: [] }; }
  }
  if (st.void) { if (changed) save(); return ev; }

  // the vote closed: seed the bracket, or pick the finalists
  if (ended("qualify") && !st.qualified) {
    const ranked = rankByVotes(ev.id, "qualify", liveEntries(ev.id));
    ranked.forEach((e, i) => db.prepare(`UPDATE event_entries SET seed = ? WHERE id = ?`).run(i + 1, e.id));
    if (ev.format === "bracket") {
      const size = Math.min(pow2Floor(ranked.length), pow2Floor(ev.bracket_size) || 2);
      const field = ranked.slice(0, size);
      st.size = size;
      // the schedule after the vote fits the bracket we actually have
      const q = sched.find((p) => p.phase === "qualify");
      sched = sched.slice(0, sched.indexOf(q) + 1).concat(scheduleTail(ev, evJSON(ev.plan, {}), size, q.end));
      if (size === 2) st.finalists = field.map((e) => e.id);
      else {
        const order = seedOrder(size);
        for (let s = 0; s < size / 2; s++)
          db.prepare(`INSERT OR REPLACE INTO event_matchups (event_id, round, slot, a_entry, b_entry) VALUES (?,?,?,?,?)`)
            .run(ev.id, 1, s, field[order[2 * s] - 1].id, field[order[2 * s + 1] - 1].id);
      }
      for (const e of ranked) evNotify(e.user_id, ev, field.includes(e) ? `you're in the bracket — seed ${e.seed} of ${size}.` : "you didn't make the bracket this time. Thank you for entering.", e.post_id);
    } else {
      const n = Math.max(2, Math.min(ev.finalists, ranked.length));
      st.finalists = ranked.slice(0, n).map((e) => e.id);
      for (const e of ranked) evNotify(e.user_id, ev, st.finalists.includes(e.id) ? "you're a finalist." : "you didn't make the final this time. Thank you for entering.", e.post_id);
    }
    st.qualified = true; changed = true;
  }

  // head-to-head rounds
  if (ev.format === "bracket" && st.size > 2) {
    const R = roundsBefore(st.size);
    for (let r = 1; r <= R; r++) {
      if (!ended("round", r)) break;
      const ms = db.prepare(`SELECT * FROM event_matchups WHERE event_id = ? AND round = ? ORDER BY slot`).all(ev.id, r);
      if (!ms.length || ms.every((m) => m.winner_entry)) continue;
      const winners = ms.map((m) => m.winner_entry || decideMatchup(ev, m, "r" + r));
      for (const m of ms) { const loser = m.a_entry === m.winner_entry ? m.b_entry : m.a_entry; const lo = entryOwner(loser); if (lo) evNotify(lo, ev, `out in round ${r}. Thank you for entering.`); }
      if (r < R) {
        for (let s = 0; s < winners.length / 2; s++)
          db.prepare(`INSERT OR REPLACE INTO event_matchups (event_id, round, slot, a_entry, b_entry) VALUES (?,?,?,?,?)`).run(ev.id, r + 1, s, winners[2 * s], winners[2 * s + 1]);
        for (const w of winners) { const o = entryOwner(w); if (o) evNotify(o, ev, `you won your round ${r} matchup. On to round ${r + 1}.`); }
      } else {
        st.finalists = winners;
        for (const w of winners) { const o = entryOwner(w); if (o) evNotify(o, ev, "you're in the final."); }
      }
      changed = true;
    }
  }

  // the final
  if (ended("final") && !st.results && st.finalists) {
    const ranking = finalScores(ev, st.finalists);
    st.results = { winner: ranking[0]?.entryId || null, ranking, at: now };
    ranking.forEach((r, i) => { const o = entryOwner(r.entryId); if (o) evNotify(o, ev, i === 0 ? "you won. Congratulations." : `you placed #${i + 1}.`); });
    changed = true;
  }
  if (changed) save();
  return ev;
}

/* Once a minute, so phases close even when nobody is looking. */
setInterval(() => {
  try { for (const ev of db.prepare(`SELECT * FROM events WHERE published = 1`).all()) tickEvent(ev); }
  catch (e) { console.error("[events] tick:", e.message); }
}, 60000).unref?.();
