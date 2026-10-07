
/* ================================================================
   EVENTS v1.1 — 2026-10-07. Running an event (admin only, enforced
   here) and its public pages: /e/:slug and /e/:slug/rules.
   Admins see the live tallies members never do, including how many
   votes came from brand-new accounts: the usual sign of someone
   stuffing the box.
================================================================ */
const EV_FIELDS = ["title", "brief", "rules", "prize", "cover_url", "channel", "format", "bracket_size", "finalists", "judge_weight", "picks", "min_account_days", "freeze_hours", "require_verified", "published"];

function evClean(b, ev = {}) {
  const o = {};
  const str = (k, max) => { if (b[k] !== undefined) o[k] = String(b[k] ?? "").trim().slice(0, max); };
  const int = (k, lo, hi) => { if (b[k] !== undefined) o[k] = Math.min(hi, Math.max(lo, Math.round(Number(b[k]) || 0))); };
  str("title", 120); str("brief", 4000); str("rules", 20000); str("prize", 200); str("channel", 60);
  if (b.coverUrl !== undefined) o.cover_url = /^\/uploads\/[A-Za-z0-9._-]+$/.test(b.coverUrl || "") ? b.coverUrl : null;
  if (b.format !== undefined) o.format = ["simple", "poll"].includes(b.format) ? b.format : "bracket";
  if (b.bracketSize !== undefined) o.bracket_size = [4, 8, 16, 32, 64].includes(Number(b.bracketSize)) ? Number(b.bracketSize) : 16;
  int("finalists", 2, 20); int("judgeWeight", 0, 100); int("picks", 1, 10); int("minAccountDays", 0, 60);
  if (o.judgeWeight !== undefined) { o.judge_weight = o.judgeWeight; delete o.judgeWeight; }
  if (o.minAccountDays !== undefined) { o.min_account_days = o.minAccountDays; delete o.minAccountDays; }
  if (b.freezeHours !== undefined) o.freeze_hours = Math.min(72, Math.max(0, Math.round(Number(b.freezeHours) || 0)));
  if (b.requireVerified !== undefined) o.require_verified = b.requireVerified ? 1 : 0;
  if (b.published !== undefined) o.published = b.published ? 1 : 0;
  return o;
}
const evPlan = (b, old = {}) => {
  const p = { ...old };
  for (const k of ["submitDays", "voteDays", "roundDays", "finalDays"]) if (b[k] !== undefined) p[k] = Math.min(60, Math.max(0.01, Number(b[k]) || 0));
  if (b.opensAt !== undefined) p.opensAt = Number(new Date(b.opensAt)) || Number(b.opensAt) || p.opensAt || Date.now();
  return p;
};

function evAdminView(ev) {
  tickEvent(ev);
  const st = evJSON(ev.state, {}), sched = evJSON(ev.schedule, []);
  const entries = db.prepare(`SELECT * FROM event_entries WHERE event_id = ? ORDER BY created_at`).all(ev.id);
  const tally = (stage) => {
    const m = new Map();
    for (const r of db.prepare(`SELECT v.entry_id, COUNT(*) n, SUM(CASE WHEN v.created_at - u.created_at < ? THEN 1 ELSE 0 END) fresh
      FROM event_votes v JOIN users u ON u.id = v.voter_id WHERE v.event_id = ? AND v.stage = ? GROUP BY v.entry_id`).all(14 * EV_DAY, ev.id, stage))
      m.set(r.entry_id, { votes: r.n, fresh: r.fresh });
    return m;
  };
  const stages = ["qualify", ...Array.from({ length: roundsBefore(st.size || ev.bracket_size) }, (_, i) => "r" + (i + 1)), "final"];
  const t = Object.fromEntries(stages.map((s) => [s, tally(s)]));
  const scores = db.prepare(`SELECT s.entry_id, u.username, s.score FROM event_scores s JOIN users u ON u.id = s.judge_id WHERE s.event_id = ?`).all(ev.id);
  return {
    event: { id: ev.id, slug: ev.slug, title: ev.title, brief: ev.brief, rules: ev.rules, prize: ev.prize, coverUrl: ev.cover_url, channel: ev.channel,
      format: ev.format, bracketSize: ev.bracket_size, finalists: ev.finalists, judgeWeight: ev.judge_weight, picks: ev.picks,
      minAccountDays: ev.min_account_days, freezeHours: ev.freeze_hours, requireVerified: !!ev.require_verified, published: !!ev.published, plan: evJSON(ev.plan, {}), schedule: sched, phase: phaseAt(sched), state: st },
    judges: evJudges(ev.id).map((j) => ({ username: j.username, displayName: j.display_name })),
    entries: entries.map((e) => ({ ...evEntryShape(e), userId: e.user_id, dqReason: e.dq_reason,
      votes: Object.fromEntries(stages.map((s) => [s, t[s].get(e.id) || { votes: 0, fresh: 0 }])),
      scores: scores.filter((s) => s.entry_id === e.id).map((s) => ({ judge: s.username, score: s.score })) })),
    matchups: db.prepare(`SELECT round, slot, a_entry a, b_entry b, winner_entry winner FROM event_matchups WHERE event_id = ? ORDER BY round, slot`).all(ev.id),
    voters: db.prepare(`SELECT COUNT(DISTINCT voter_id) n FROM event_votes WHERE event_id = ?`).get(ev.id).n,
    board: evBoard(ev, EV_STAGE(phaseAt(sched)), phaseAt(sched)),
  };
}

const evAdminRow = (req, res) => {
  const ev = db.prepare(`SELECT * FROM events WHERE id = ?`).get(Number(req.params.id));
  if (!ev) res.status(404).json({ error: "No such event." });
  return ev;
};

app.get("/api/admin/events", auth, admin, (_req, res) => {
  res.json({ events: db.prepare(`SELECT * FROM events ORDER BY id DESC`).all().map((e) => {
    tickEvent(e);
    return { id: e.id, slug: e.slug, title: e.title, published: !!e.published, format: e.format,
      phase: phaseAt(evJSON(e.schedule, [])), entries: db.prepare(`SELECT COUNT(*) n FROM event_entries WHERE event_id = ?`).get(e.id).n };
  }) });
});

app.post("/api/admin/events", auth, admin, (req, res) => {
  const b = req.body || {};
  const slug = String(b.slug || "").toLowerCase().trim();
  if (!/^[a-z0-9][a-z0-9-]{2,39}$/.test(slug)) return res.status(400).json({ error: "The link name needs 3–40 letters, numbers or dashes." });
  if (evRow(slug)) return res.status(409).json({ error: "That link name is taken." });
  const f = evClean(b);
  if (!f.title) return res.status(400).json({ error: "Give the event a title." });
  // a poll starts the way the community asked: a vote a day, any confirmed account
  if (f.format === "poll") { if (f.picks === undefined) f.picks = 1; if (f.min_account_days === undefined) f.min_account_days = 0; }
  const now = Date.now(), plan = evPlan(b);
  const ev = { format: f.format || "bracket", bracket_size: f.bracket_size || 16 };
  const info = db.prepare(`INSERT INTO events (slug, title, created_at, updated_at) VALUES (?,?,?,?)`).run(slug, f.title, now, now);
  const row = evRow(Number(info.lastInsertRowid));
  evSave(row, { ...f, plan: JSON.stringify(plan), schedule: JSON.stringify(buildSchedule({ ...row, ...ev }, plan)) });
  res.json(evAdminView(row));
});

app.get("/api/admin/events/:id", auth, admin, (req, res) => { const ev = evAdminRow(req, res); if (ev) res.json(evAdminView(ev)); });

app.patch("/api/admin/events/:id", auth, admin, (req, res) => {
  const ev = evAdminRow(req, res); if (!ev) return;
  tickEvent(ev);
  const st = evJSON(ev.state, {}), b = req.body || {}, f = evClean(b);
  const shapeKeys = ["format", "bracket_size", "finalists"];
  const planKeys = ["opensAt", "submitDays", "voteDays", "roundDays", "finalDays"];
  // once the vote has closed the shape is set: the bracket exists
  if (st.qualified && (shapeKeys.some((k) => f[k] !== undefined && f[k] !== ev[k]) || planKeys.some((k) => b[k] !== undefined)))
    return res.status(400).json({ error: "The format and dates are locked once voting closes. Use \"End this phase now\" to move things along." });
  const fields = { ...f };
  if (planKeys.some((k) => b[k] !== undefined) || shapeKeys.some((k) => f[k] !== undefined)) {
    const plan = evPlan(b, evJSON(ev.plan, {}));
    fields.plan = JSON.stringify(plan);
    fields.schedule = JSON.stringify(buildSchedule({ ...ev, ...f }, plan));
  }
  if (Object.keys(fields).length) evSave(ev, fields);
  res.json(evAdminView(ev));
});

app.post("/api/admin/events/:id/advance", auth, admin, (req, res) => {
  const ev = evAdminRow(req, res); if (!ev) return;
  tickEvent(ev);
  evSave(ev, { schedule: JSON.stringify(advanceSchedule(evJSON(ev.schedule, []))) });
  res.json(evAdminView(tickEvent(ev)));
});

app.post("/api/admin/events/:id/judges", auth, admin, (req, res) => {
  const ev = evAdminRow(req, res); if (!ev) return;
  const u = q.userByName.get(String(req.body?.username || "").replace(/^@/, "").trim());
  if (!u) return res.status(404).json({ error: "No member with that username." });
  if (req.body?.remove) db.prepare(`DELETE FROM event_judges WHERE event_id = ? AND user_id = ?`).run(ev.id, u.id);
  else {
    if (db.prepare(`SELECT 1 FROM event_entries WHERE event_id = ? AND user_id = ?`).get(ev.id, u.id))
      return res.status(400).json({ error: "They've entered this event, so they can't judge it." });
    db.prepare(`INSERT OR IGNORE INTO event_judges (event_id, user_id) VALUES (?,?)`).run(ev.id, u.id);
    notify(u.id, req.user.id, "event", null, `${ev.title}: you're a judge. You'll score the finalists in the final.`);
  }
  res.json(evAdminView(ev));
});

app.post("/api/admin/events/:id/entries/:entryId/dq", auth, admin, (req, res) => {
  const ev = evAdminRow(req, res); if (!ev) return;
  const reason = req.body?.reason ? String(req.body.reason).slice(0, 300) : null;
  const e = db.prepare(`SELECT * FROM event_entries WHERE id = ? AND event_id = ?`).get(Number(req.params.entryId), ev.id);
  if (!e) return res.status(404).json({ error: "No such entry." });
  db.prepare(`UPDATE event_entries SET dq_reason = ? WHERE id = ?`).run(reason, e.id);
  if (reason) notify(e.user_id, req.user.id, "event", e.post_id, `${ev.title}: your entry was removed. ${reason}`.slice(0, 240));
  res.json(evAdminView(ev));
});

app.delete("/api/admin/events/:id", auth, admin, (req, res) => {
  const ev = evAdminRow(req, res); if (!ev) return;
  if (db.prepare(`SELECT 1 FROM event_entries WHERE event_id = ?`).get(ev.id)) return res.status(400).json({ error: "It has entries. Unpublish it instead." });
  db.prepare(`DELETE FROM events WHERE id = ?`).run(ev.id);
  res.json({ ok: true });
});

/* ---- public pages ---- */
const evDate = (t) => (t ? new Date(t).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric", timeZone: "America/New_York" }) : "TBA");

/* A plain-language starting point. Admins replace it in Events → Rules;
   have a lawyer read whatever goes live. */
function evDefaultRules(ev) {
  const s = evJSON(ev.schedule, []), at = (ph) => s.find((p) => p.phase === ph) || {};
  const final = at("final");
  return [
    `${ev.title} — Official Rules`,
    `NO PURCHASE OR PAYMENT NECESSARY TO ENTER OR WIN. A purchase will not improve your chances. This is a contest of skill; chance plays no part in picking the winner.`,
    `Sponsor. TNL LABS ("TNL"), labs.tnllabs.com.`,
    `Who can enter. You must be 18 or older and have a TNL LABS account. TNL staff, this event's judges and their households can't enter. Void where prohibited.`,
    `Dates. Entries open ${evDate(at("submit").start)} and close ${evDate(at("submit").end)}. Voting runs until the final, which ends ${evDate(final.end)}. Times are US Eastern.`,
    `How to enter. Post one piece through the event page in the app. One entry per person; you can withdraw and replace it until entries close.`,
    `Your entry must be your own original work, made by you. Don't include anyone else's artwork, photos, logos or trademarks unless you have the right to use them. Entries that break these rules, the TNL community guidelines or the law will be removed.`,
    `How the winner is picked. ${ev.format === "bracket"
      ? `Members vote for their favourites to set a bracket. Head-to-head rounds follow, decided by member votes (a tie goes to the higher seed). The last two meet in the final.`
      : ev.format === "poll"
      ? `Members vote in the app: ${ev.picks === 1 ? "one vote" : ev.picks + " votes"} a day, resetting at midnight Eastern, on a public scoreboard${ev.freeze_hours ? ` that freezes for the last ${ev.freeze_hours} hours of each stage` : ""}. Votes on Instagram or anywhere else don't count. The top ${ev.finalists} go to the final.`
      : `Members vote for their favourites; the top ${ev.finalists} go to the final.`} ${ev.judge_weight > 0
      ? `In the final, judges score each finalist from 1 to 10 for originality, craft and response to the brief. The winner is decided ${ev.judge_weight}% by the judges' scores and ${100 - ev.judge_weight}% by member votes.`
      : `In the final, members vote again and the most votes wins.`}`,
    `Fair voting. One account per person.${ev.require_verified ? " You need a confirmed email to vote." : ""}${ev.min_account_days ? ` Accounts must be at least ${ev.min_account_days} days old to vote.` : ""} You can't vote for yourself. TNL may remove votes, and disqualify entries, that come from fake, bought or coordinated accounts.`,
    `Prize. ${ev.prize ? ev.prize : "The prize will be announced before entries open."} The winner will be contacted through the app within 7 days of the final and must reply within 14 days, or a runner-up may be named instead. The prize can't be transferred. The winner is responsible for any taxes, and TNL may ask for tax forms (such as a W-9) where the law requires.`,
    `Your work stays yours. You keep all rights to your entry. By entering, you let TNL show your entry, your name and your username in the app and in promotion of this event, without further payment.`,
    `General. TNL may change, pause or cancel the event if something outside its control affects it, and will tell entrants in the app. By entering you agree to these rules and to TNL's decisions, which are final.`,
  ].join("\n\n");
}

app.get("/e/:slug", (req, res) => {
  const ev = evRow(req.params.slug);
  if (!ev || !ev.published) return res.status(404).send(lookNotFound("This event doesn't exist."));
  tickEvent(ev);
  const s = evJSON(ev.schedule, []), p = phaseAt(s), st = evJSON(ev.state, {});
  const esc = lookEsc, base = baseUrl(req);
  const label = { upcoming: `Entries open ${evDate(s[0]?.start)}`, submit: `Entries close ${evDate(p.end)}`, qualify: "Voting is open", round: `Round ${p.round} is on`, final: "The final is on", results: "Results are in" }[p.phase];
  const winner = st.results?.winner ? db.prepare(`SELECT p.image_url FROM event_entries e JOIN posts p ON p.id = e.post_id WHERE e.id = ?`).get(st.results.winner) : null;
  const img = winner?.image_url || ev.cover_url || "/icon-512.png";
  const abs = (u) => (/^https?:/.test(u) ? u : base + u);
  const desc = [label, ev.prize, ev.brief.slice(0, 140)].filter(Boolean).join(" · ");
  res.send(lookPage({
    title: `${esc(ev.title)} — TNL LABS`,
    head: `<meta property="og:type" content="website"><meta property="og:site_name" content="TNL LABS">
<meta property="og:title" content="${esc(ev.title)}"><meta property="og:description" content="${esc(desc)}">
<meta property="og:image" content="${esc(abs(img))}"><meta property="og:url" content="${esc(base + "/e/" + ev.slug)}">
<meta name="twitter:card" content="summary_large_image"><meta name="description" content="${esc(desc)}">`,
    body: `${lookEyebrow("Event")}<h1>${esc(ev.title)}</h1>
<p class="cap" style="margin:0 0 16px">${esc(label)}${ev.prize ? " · " + esc(ev.prize) : ""}</p>
${ev.cover_url ? `<img class="media" src="${esc(ev.cover_url)}" alt="" style="margin:0 0 16px">` : ""}
${ev.brief ? `<p class="body" style="margin:0 0 8px">${esc(ev.brief)}</p>` : ""}
<a class="btn block acc" href="/?e=${encodeURIComponent(ev.slug)}">${p.phase === "submit" ? "Enter in the app" : p.phase === "results" ? "See the results" : "Open in the app"}</a>
<p class="cap" style="margin-top:14px"><a href="/e/${esc(ev.slug)}/rules">Official rules</a></p>`,
  }));
});

app.get("/e/:slug/rules", (req, res) => {
  const ev = evRow(req.params.slug);
  if (!ev || !ev.published) return res.status(404).send(lookNotFound("This event doesn't exist."));
  const text = (ev.rules || evDefaultRules(ev)).split(/\n{2,}/);
  res.send(lookPage({
    title: `Rules — ${lookEsc(ev.title)} — TNL LABS`,
    body: `${lookEyebrow("Official rules")}<h1>${lookEsc(ev.title)}</h1>${text.slice(ev.rules ? 0 : 1).map((t) => `<p class="body" style="margin:0 0 14px">${lookEsc(t)}</p>`).join("")}
<a class="btn" href="/e/${lookEsc(ev.slug)}">Back to the event</a>`,
  }));
});
app.get("/api/events/:slug/rules", (req, res) => {
  const ev = evRow(req.params.slug);
  if (!ev || !ev.published) return res.status(404).json({ error: "No such event." });
  res.json({ rules: ev.rules || evDefaultRules(ev) });
});
