/* ================================================================
   LABS CONNECTOR · insights (shop, collabs, tournament, tech)  v1.0 — 2026-10-29
   The rest of what Grok asked for (people: server/connector/insights-people.js):
   · insights/market — looked at and saved vs bought, checkouts never
     paid, the listings people look at but don't buy, and sellers who
     connected Stripe vs sellers who listed.
   · insights/collabs — invites sent, accepted, ignored (no "decline" in
     LABS: an invite just waits), how long a yes takes, and whether people
     post more after a collab or it's one-off.
   · insights/tournament — voters who also entered vs only voted, whether
     a day's voters come back for the next, and entries that got votes but
     no follow, comment or collab invite after.
   · insights/tech — errors in the last 24 hours, marked when they come
     from someone else's code (Instagram's browser, a wallet extension),
     and slow or failed requests (server/trust/visits).
   Then every insight joins the connector's tools. Admin-only, read-only.
================================================================ */
const INS_SOLD = `status IN ('paid','shipped','complete')`;

app.get("/api/admin/insights/market", auth, admin, (req, res) => {
  const rows = db.prepare(`SELECT l.id, l.title, l.category, l.price_cents, l.status, l.views, u.username seller,
      (SELECT COUNT(*) FROM listing_views v WHERE v.listing_id = l.id) viewers, (SELECT COUNT(*) FROM listing_likes k WHERE k.listing_id = l.id) saves,
      (SELECT COUNT(*) FROM offers o WHERE o.listing_id = l.id) offers, (SELECT COUNT(*) FROM orders o WHERE o.listing_id = l.id AND o.status = 'pending') unpaid,
      (SELECT COUNT(*) FROM orders o WHERE o.listing_id = l.id AND o.${INS_SOLD}) sold
    FROM listings l JOIN users u ON u.id = l.seller_id WHERE l.status != 'removed'`).all();
  const sum = (k) => rows.reduce((s, r) => s + (r[k] || 0), 0);
  const one = (sql) => db.prepare(sql).get().n;
  const shoppers = { looked: one(`SELECT COUNT(DISTINCT user_id) n FROM listing_views`), saved: one(`SELECT COUNT(DISTINCT user_id) n FROM listing_likes`),
    offered: one(`SELECT COUNT(DISTINCT buyer_id) n FROM offers`), bought: one(`SELECT COUNT(DISTINCT buyer_id) n FROM orders WHERE ${INS_SOLD}`) };
  const cats = new Map();
  for (const r of rows) { const c = cats.get(r.category) || { category: r.category, listings: 0, viewers: 0, saves: 0, sold: 0 };
    c.listings++; c.viewers += r.viewers; c.saves += r.saves; c.sold += r.sold; cats.set(r.category, c); }
  const sellers = db.prepare(`SELECT u.username, u.stripe_account != '' connected, u.stripe_ready ready, u.stripe_kind kind,
      (SELECT COUNT(*) FROM listings l WHERE l.seller_id = u.id AND l.status != 'removed') listed,
      (SELECT COUNT(*) FROM orders o WHERE o.seller_id = u.id AND o.${INS_SOLD}) sold
    FROM users u WHERE u.stripe_account != '' OR EXISTS (SELECT 1 FROM listings l WHERE l.seller_id = u.id AND l.status != 'removed')`).all();
  const n = (f) => sellers.filter(f).length, who = (f) => sellers.filter(f).map((s) => s.username).slice(0, 25);
  res.json({
    totals: { listings: rows.length, live: rows.filter((r) => r.status === "active").length, pageViews: sum("views"), viewers: sum("viewers"), saves: sum("saves"),
      offers: sum("offers"), checkoutsNotPaid: sum("unpaid"), sold: sum("sold") },
    shoppers: { ...shoppers, savedButNeverBought: one(`SELECT COUNT(DISTINCT k.user_id) n FROM listing_likes k WHERE NOT EXISTS (SELECT 1 FROM orders o WHERE o.buyer_id = k.user_id AND o.${INS_SOLD})`) },
    lookedAtNotBought: rows.filter((r) => !r.sold && r.status === "active").sort((a, b) => b.viewers + 3 * b.saves - (a.viewers + 3 * a.saves)).slice(0, 15)
      .map(({ id, title, seller, category, price_cents, viewers, saves, offers, unpaid }) => ({ id, title, seller, category, priceCents: price_cents, viewers, saves, offers, checkoutsNotPaid: unpaid })),
    byCategory: [...cats.values()].sort((a, b) => b.viewers - a.viewers),
    sellers: { connectedStripe: n((s) => s.connected), stripeReady: n((s) => s.ready), listedSomething: n((s) => s.listed > 0), sold: n((s) => s.sold > 0),
      connectedNeverListed: { members: n((s) => s.connected && !s.listed), who: who((s) => s.connected && !s.listed) },
      listedButCantBePaid: { members: n((s) => s.listed && !s.ready), who: who((s) => s.listed && !s.ready), meaning: "has listings but Stripe isn't finished, so checkout can't pay them" },
      byKind: Object.fromEntries(["express_stripe", "express", "standard"].map((k) => [k, n((s) => s.connected && (s.kind || "standard") === k)])) },
    readMe: ["Viewers = different signed-in members who opened the listing; page views include everyone.", "Checkouts not paid = an order started that never went through."],
  });
});

app.get("/api/admin/insights/collabs", auth, admin, (req, res) => {
  const now = Date.now(), D = 86400000;
  const rows = db.prepare(`SELECT c.post_id, c.user_id, c.status, c.created_at, p.author_id, a.username author, b.username invitee,
      (SELECT MIN(r.created_at) FROM rep_events r WHERE r.kind = 'collab_accepted' AND r.user_id = c.user_id AND r.source_id = c.post_id) accepted_at
    FROM collaborators c JOIN posts p ON p.id = c.post_id JOIN users a ON a.id = p.author_id JOIN users b ON b.id = c.user_id`).all();
  const acc = rows.filter((r) => r.status === "accepted"), pend = rows.filter((r) => r.status !== "accepted");
  const waits = acc.filter((r) => r.accepted_at).map((r) => r.accepted_at - r.created_at).filter((x) => x >= 0);
  /* after a collab: posts in the 30 days after the yes vs the 30 before, both sides */
  const postsIn = db.prepare(`SELECT COUNT(*) n FROM posts WHERE author_id = ? AND created_at > ? AND created_at <= ? AND id != ?`);
  let before = 0, after = 0, counted = 0;
  for (const r of acc) { const t = r.accepted_at || r.created_at; if (t > now - 30 * D) continue; counted++;
    for (const u of [r.user_id, r.author_id]) { before += postsIn.get(u, t - 30 * D, t, r.post_id).n; after += postsIn.get(u, t, t + 30 * D, r.post_id).n; } }
  const pairs = new Map(); for (const r of acc) { const k = [r.author, r.invitee].sort().join(" + "); pairs.set(k, (pairs.get(k) || 0) + 1); }
  const people = new Set(acc.flatMap((r) => [r.user_id, r.author_id]));
  const again = [...people].filter((u) => acc.filter((r) => r.user_id === u || r.author_id === u).length > 1).length;
  const inviters = new Map(); for (const r of rows) { const g = inviters.get(r.author) || { username: r.author, sent: 0, accepted: 0 }; g.sent++; if (r.status === "accepted") g.accepted++; inviters.set(r.author, g); }
  res.json({
    invites: { sent: rows.length, accepted: acc.length, acceptedPct: rows.length ? Math.round((acc.length / rows.length) * 100) : 0,
      waiting: pend.length, ignoredOver7Days: pend.filter((r) => r.created_at < now - 7 * D).length, waitingUnder7Days: pend.filter((r) => r.created_at >= now - 7 * D).length,
      medianHoursToYes: insMedianHours(waits) },
    whereInvitesDie: pend.filter((r) => r.created_at < now - 7 * D).sort((a, b) => b.created_at - a.created_at).slice(0, 20)
      .map((r) => ({ from: r.author, to: r.invitee, postId: r.post_id, daysWaiting: Math.floor((now - r.created_at) / D) })),
    afterACollab: { collabsOlderThan30Days: counted, postsIn30DaysBefore: before, postsIn30DaysAfter: after, meaning: "both people's other posts, summed" },
    oneOffOrRepeat: { membersInACollab: people.size, inMoreThanOne: again, pairsWhoCollabedAgain: [...pairs].filter(([, n]) => n > 1).map(([pair, n]) => ({ pair, collabs: n })) },
    topInviters: [...inviters.values()].sort((a, b) => b.sent - a.sent).slice(0, 15),
    readMe: ["LABS has no decline button: an invite is accepted or it waits. 'Ignored' = waiting over 7 days.", "A collab is complete once accepted — the work is already posted."],
  });
});

app.get("/api/admin/insights/tournament", auth, admin, (req, res) => {
  const id = Number(req.query.id) || 0;
  const evs = id ? db.prepare(`SELECT id, title, slug, format FROM events WHERE id = ?`).all(id) : db.prepare(`SELECT id, title, slug, format FROM events ORDER BY id DESC LIMIT 3`).all();
  res.json({ events: evs.map((ev) => {
    const votes = db.prepare(`SELECT voter_id, stage, matchup, entry_id, created_at FROM event_votes WHERE event_id = ?`).all(ev.id);
    const entries = db.prepare(`SELECT e.id, e.user_id, e.post_id, u.username FROM event_entries e JOIN users u ON u.id = e.user_id WHERE e.event_id = ? AND e.dq_reason IS NULL`).all(ev.id);
    const entrants = new Set(entries.map((e) => e.user_id)), voters = new Set(votes.map((v) => v.voter_id));
    /* rounds in order: a poll's days, a bracket's stages */
    const roundOf = (v) => `${v.stage}:${v.matchup}`, firstAt = new Map();
    for (const v of votes) { const k = ev.format === "poll" ? roundOf(v) : v.stage; if (!firstAt.has(k) || v.created_at < firstAt.get(k)) firstAt.set(k, v.created_at); }
    const rounds = [...firstAt].sort((a, b) => a[1] - b[1]).map(([k]) => k);
    const byRound = rounds.map((k) => new Set(votes.filter((v) => (ev.format === "poll" ? roundOf(v) : v.stage) === k).map((v) => v.voter_id)));
    const flow = rounds.map((k, i) => { const later = new Set(byRound.slice(i + 1).flatMap((s) => [...s]));
      return { round: k, voters: byRound[i].size, new: [...byRound[i]].filter((u) => !byRound.slice(0, i).some((s) => s.has(u))).length,
        votedAgainLater: i < rounds.length - 1 ? [...byRound[i]].filter((u) => later.has(u)).length : null }; });
    const multi = [...voters].filter((u) => byRound.filter((s) => s.has(u)).length > 1).length;
    /* after the votes: did anyone follow, comment on or invite the artist? */
    const after = entries.map((e) => {
      const vs = votes.filter((v) => v.entry_id === e.id), t = vs.length ? Math.min(...vs.map((v) => v.created_at)) : null;
      const ask = (sql, ...a) => (t ? db.prepare(sql).get(...a).n : 0);
      return { entryId: e.id, artist: e.username, votes: vs.length, voters: new Set(vs.map((v) => v.voter_id)).size,
        newFollowers: ask(`SELECT COUNT(*) n FROM follows WHERE followee_id = ? AND created_at >= ?`, e.user_id, t),
        followersFromVoters: ask(`SELECT COUNT(*) n FROM follows f JOIN event_votes v ON v.voter_id = f.follower_id AND v.event_id = ? AND v.entry_id = ? WHERE f.followee_id = ? AND f.created_at >= ?`, ev.id, e.id, e.user_id, t),
        comments: ask(`SELECT COUNT(*) n FROM comments WHERE post_id = ? AND author_id != ? AND created_at >= ?`, e.post_id, e.user_id, t),
        collabInvites: ask(`SELECT COUNT(*) n FROM collaborators WHERE user_id = ? AND created_at >= ?`, e.user_id, t) };   // someone asked them
    }).sort((a, b) => b.votes - a.votes);
    return { id: ev.id, title: ev.title, format: ev.format, entrants: entrants.size, voters: voters.size,
      votersWhoAlsoEntered: [...voters].filter((u) => entrants.has(u)).length, onlyVoted: [...voters].filter((u) => !entrants.has(u)).length,
      votedInMoreThanOneRound: multi, rounds: flow,
      votesButNoOneReachedOut: after.filter((a) => a.votes && !a.newFollowers && !a.comments && !a.collabInvites).map((a) => ({ artist: a.artist, votes: a.votes })),
      entries: after };
  }), readMe: ["Reached out = a new follow, a comment on the entry, or a collab invite after its first vote. Messages aren't read or counted."] });
});

/* Errors raised by code that isn't LABS's: Instagram/Facebook's in-app browser, wallet extensions, cross-site scripts. */
const INS_NOT_OURS = /iabjs:\/\/|_META\.|IABInnerFrame|ethereum|webkit\.messageHandlers|chrome-extension:\/\/|Java object is gone|^Script error\.?$|standardSelectors/;
app.get("/api/admin/insights/tech", auth, admin, (req, res) => {
  const now = Date.now(), D = 86400000;
  const errs = db.prepare(`SELECT kind, message, detail, path, created_at FROM error_log WHERE created_at > ? ORDER BY created_at DESC`).all(now - 7 * D);
  const group = (xs) => { const m = new Map(); for (const e of xs) { const k = e.kind + "|" + e.message.slice(0, 160); const g = m.get(k) || { kind: e.kind, message: e.message.slice(0, 160), times: 0, last: 0, paths: new Set(),
      ours: !INS_NOT_OURS.test(e.message) && !INS_NOT_OURS.test(e.detail || "") }; g.times++; g.last = Math.max(g.last, e.created_at); g.paths.add(e.path); m.set(k, g); }
    return [...m.values()].map((g) => ({ ...g, paths: [...g.paths].slice(0, 5) })).sort((a, b) => b.last - a.last); };
  const slow = db.prepare(`SELECT route, method, COUNT(*) times, ROUND(AVG(ms)) avgMs, MAX(ms) maxMs, SUM(status >= 500) failed, MAX(at) last
    FROM slow_requests WHERE at > ? GROUP BY route, method ORDER BY times DESC LIMIT 25`).all(now - 7 * D);
  res.json({
    errorsLast24h: group(errs.filter((e) => e.created_at > now - D)), errorsLast7Days: group(errs),
    slowOrFailedLast7Days: slow,
    readMe: ["ours: false = raised by someone else's code running on the page (Instagram's or Facebook's in-app browser, a wallet extension) — nothing to fix in LABS.",
      "Slow = an /api request over 1.5 seconds; failed = our server answered 5xx. Noted from 2026-10-29."],
  });
});

for (const p of ["insights/conversion", "insights/retention", "insights/market", "insights/collabs", "insights/tournament", "insights/tech"]) MCP_PATHS.add(p);
const insDays = { type: "integer", enum: [7, 30, 90, 365], description: "Members who joined in the last N days (7, 30, 90 or 365). Default 90." };
MCP_TOOLS.push(
  ["insights_conversion", "Where new members drop off: joined and only looked, never posted, posted once then went quiet, voted but never entered or posted. Median hours from joining to first post, vote, like, follow and collab. Which ways in (Instagram tournament link, profile link, direct…) bring people who post, vote and come back.",
    { days: insDays }, (a) => `insights/conversion?days=${Number(a.days) || 90}`],
  ["insights_retention", "Who comes back after 1, 7 and 30 days; by join week; what the members who stayed a week did on their first day vs the ones who didn't; which lab and kind of work (picture, video, music, words) of a first post keeps people.",
    { days: insDays }, (a) => `insights/retention?days=${Number(a.days) || 90}`],
  ["insights_market", "Shop behaviour: listing viewers and saves vs offers, unpaid checkouts and sales; the listings looked at most but not bought; by category; sellers who connected Stripe vs listed vs can't be paid yet.", {}, "insights/market"],
  ["insights_collabs", "Collab invites sent, accepted and ignored (waiting 7+ days), median time to a yes, where invites die, whether both people post more in the 30 days after, and repeat collaborators.", {}, "insights/collabs"],
  ["insights_tournament", "For the latest tournaments (or one by id): voters who also entered vs only voted, each round's voters and how many voted again later, and per entry: votes, then new followers, comments and collab invites after — the entries no one reached out to.",
    { id: { type: "integer", description: "One event's id; default the last three" } }, (a) => `insights/tournament?id=${Math.max(0, Number(a.id) || 0)}`],
  ["insights_tech", "Errors in the last 24 hours and 7 days, grouped, each marked ours or not (Instagram's in-app browser and wallet extensions throw errors that aren't LABS's), and slow (over 1.5s) or failed (5xx) API requests by route.", {}, "insights/tech"],
);
