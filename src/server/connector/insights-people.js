/* ================================================================
   LABS CONNECTOR · insights (people)  v1.0 — 2026-10-29
   Grok, reading the connector: "The gaps are mainly the drop-off points,
   marketplace behaviour, and what happens after someone votes or posts
   once." Two admin GET routes, read-only, answered from what LABS already
   keeps (plus the visit days from server/trust/visits):
   · insights/conversion — where new members stop (never posted, posted
     once then went quiet, voted but never entered), how long to a first
     post / vote / collab, and which ways in bring people who post.
   · insights/retention — who's back after 1, 7 and 30 days, what the
     ones who stayed did on their first day, which labs and kinds of work
     keep people.
   Counts and usernames only — no emails, places or messages. Market,
   collabs, tournament and tech: server/connector/insights-shop.js.
================================================================ */
const INS_D = 86400000;
const insWindow = (req) => [7, 30, 90, 365].includes(Number(req.query.days)) ? Number(req.query.days) : 90;
const insPct = (a, b) => (b ? Math.round((a / b) * 100) : 0);
const insMedianHours = (xs) => { if (!xs.length) return null; const s = [...xs].sort((a, b) => a - b); return Math.round((s[s.length >> 1] / 3600000) * 10) / 10; };
/* Everything a member does that means they were here. A visit day counts at the end of its day. */
const INS_ACT = `SELECT author_id u, created_at at, 'post' k FROM posts UNION ALL SELECT user_id, created_at, 'like' FROM likes
  UNION ALL SELECT author_id, created_at, 'comment' FROM comments UNION ALL SELECT follower_id, created_at, 'follow' FROM follows
  UNION ALL SELECT voter_id, created_at, 'vote' FROM event_votes UNION ALL SELECT user_id, created_at, 'enter' FROM event_entries
  UNION ALL SELECT user_id, viewed_at, 'shop' FROM listing_views UNION ALL SELECT user_id, created_at, 'shop' FROM listing_likes
  UNION ALL SELECT buyer_id, created_at, 'buy' FROM orders UNION ALL SELECT user_id, at, 'listen' FROM track_plays WHERE user_id IS NOT NULL
  UNION ALL SELECT user_id, day * 86400000 + 86399999, 'open' FROM member_days`;
/* uid → { joined, username, kinds: { post: { n, day1, first, last } … }, last } for everyone who joined after `since` */
function insPeople(since) {
  const people = new Map(db.prepare(`SELECT id, username, created_at FROM users WHERE created_at > ? AND COALESCE(suspended, 0) = 0`).all(since)
    .map((u) => [u.id, { id: u.id, username: u.username, joined: u.created_at, kinds: {}, last: 0 }]));
  for (const r of db.prepare(`SELECT a.u, a.k, COUNT(*) n, SUM(a.at <= x.created_at + ${INS_D}) day1, MIN(a.at) first, MAX(a.at) last
      FROM (${INS_ACT}) a JOIN users x ON x.id = a.u WHERE x.created_at > ? GROUP BY a.u, a.k`).all(since)) {
    const p = people.get(r.u); if (!p) continue;
    p.kinds[r.k] = { n: r.n, day1: r.day1, first: r.first, last: r.last };
    if (r.last > p.last) p.last = r.last;
  }
  return people;
}
const insBack = (p, days) => p.last >= p.joined + days * INS_D;
/* Where a member came in, from what join_signals kept (since 2026-10-26). */
function insWayIn(j) {
  if (!j) return null;
  const ref = j.referrer || "", land = j.landing || "", dev = j.device || "";
  const from = /Instagram/.test(dev) || /instagram\.com/.test(ref) ? "Instagram" : /Facebook/.test(dev) || /facebook\.com/.test(ref) ? "Facebook"
    : /TikTok/.test(dev) || /tiktok\.com/.test(ref) ? "TikTok" : /google\./.test(ref) ? "Google" : ref && !/tnllabs\.com/.test(ref) ? "Another site" : "Direct";
  const page = /[?&]e=|^\/e\//.test(land) ? "a tournament link" : /[?&]p=|^\/p\//.test(land) ? "a post link" : /[?&]u=|^\/u\//.test(land) ? "a profile link"
    : /^\/s\//.test(land) ? "a song link" : "the front door";
  return `${from} → ${page}${j.via && j.via !== "email" ? ` (joined with ${j.via})` : ""}`;
}
function insKind(p) { return p.video_url ? "video" : p.audio_track_id || p.beat_json ? "music" : p.image_url || (p.images && p.images !== "[]") ? "picture" : "words"; }

app.get("/api/admin/insights/conversion", auth, admin, (req, res) => {
  const days = insWindow(req), now = Date.now(), people = insPeople(now - days * INS_D), all = [...people.values()];
  const has = (p, k) => (p.kinds[k]?.n || 0) > 0;
  const posted = all.filter((p) => has(p, "post")), voted = all.filter((p) => has(p, "vote")), entered = all.filter((p) => has(p, "enter"));
  const once = posted.filter((p) => p.kinds.post.n === 1), onceQuiet = once.filter((p) => p.last < now - 14 * INS_D);
  const votedOnly = voted.filter((p) => !has(p, "enter")), votedNoPost = voted.filter((p) => !has(p, "post"));
  const lookedOnly = all.filter((p) => !has(p, "post") && !has(p, "vote") && !has(p, "like") && !has(p, "comment") && !has(p, "follow"));
  /* first collab: the rep line written when a collab is accepted (either side) */
  const collab = new Map(db.prepare(`SELECT user_id, MIN(created_at) at FROM rep_events WHERE kind = 'collab_accepted' GROUP BY user_id`).all().map((r) => [r.user_id, r.at]));
  const ttf = (pick) => { const xs = all.map((p) => { const t = pick(p); return t ? t - p.joined : null; }).filter((x) => x != null && x >= 0); return { members: xs.length, medianHours: insMedianHours(xs) }; };
  const ways = new Map();
  const sig = new Map(db.prepare(`SELECT user_id, referrer, landing, device, via FROM join_signals WHERE created_at > ?`).all(now - days * INS_D).map((j) => [j.user_id, j]));
  for (const p of all) {
    const w = insWayIn(sig.get(p.id)); if (!w) continue;
    const g = ways.get(w) || { wayIn: w, joined: 0, posted: 0, voted: 0, entered: 0, cameBack: 0 };
    g.joined++; if (has(p, "post")) g.posted++; if (has(p, "vote")) g.voted++; if (has(p, "enter")) g.entered++; if (insBack(p, 1)) g.cameBack++;
    ways.set(w, g);
  }
  const names = (xs) => xs.sort((a, b) => b.joined - a.joined).slice(0, 25).map((p) => p.username);
  res.json({
    windowDays: days, joined: all.length,
    steps: [["Joined", all.length], ["Did anything (liked, followed, commented, voted or posted)", all.length - lookedOnly.length], ["Voted in a tournament", voted.length],
      ["Posted", posted.length], ["Posted more than once", posted.length - once.length], ["Entered a tournament", entered.length], ["In a confirmed collab", all.filter((p) => collab.has(p.id)).length]]
      .map(([step, n]) => ({ step, members: n, pct: insPct(n, all.length) })),
    dropOffs: {
      joinedAndOnlyLooked: { members: lookedOnly.length, recent: names(lookedOnly) },
      neverPosted: { members: all.length - posted.length },
      postedOnceThenQuiet: { members: onceQuiet.length, of: once.length, meaning: "one post, then nothing at all for 14+ days", recent: names(onceQuiet) },
      votedButNeverEntered: { members: votedOnly.length, of: voted.length },
      votedButNeverPosted: { members: votedNoPost.length, of: voted.length, recent: names(votedNoPost) },
    },
    timeToFirst: { post: ttf((p) => p.kinds.post?.first), vote: ttf((p) => p.kinds.vote?.first), like: ttf((p) => p.kinds.like?.first),
      follow: ttf((p) => p.kinds.follow?.first), collab: ttf((p) => collab.get(p.id)) },
    waysIn: [...ways.values()].map((g) => ({ ...g, postedPct: insPct(g.posted, g.joined), votedPct: insPct(g.voted, g.joined), cameBackPct: insPct(g.cameBack, g.joined) }))
      .sort((a, b) => b.joined - a.joined),
    readMe: ["Ways in are known for members who joined from 2026-10-26 (when LABS started noting them).", "Collab time is to the first accepted collab, either side."],
  });
});

app.get("/api/admin/insights/retention", auth, admin, (req, res) => {
  const days = insWindow(req), now = Date.now(), all = [...insPeople(now - days * INS_D).values()];
  const back = (n) => { const el = all.filter((p) => p.joined <= now - n * INS_D), b = el.filter((p) => insBack(p, n)).length; return { eligible: el.length, cameBack: b, pct: insPct(b, el.length) }; };
  const weeks = [];
  for (let w = 0; w < Math.min(8, Math.ceil(days / 7)); w++) {
    const c = all.filter((p) => p.joined > now - (w + 1) * 7 * INS_D && p.joined <= now - w * 7 * INS_D);
    const r1 = c.filter((p) => p.joined <= now - INS_D), r7 = c.filter((p) => p.joined <= now - 7 * INS_D);
    weeks.push({ joinedWeeksAgo: w, joined: c.length, back1: insPct(r1.filter((p) => insBack(p, 1)).length, r1.length), back7: r7.length ? insPct(r7.filter((p) => insBack(p, 7)).length, r7.length) : null });
  }
  /* first day: the ones still around after a week vs the ones who weren't */
  const el7 = all.filter((p) => p.joined <= now - 7 * INS_D), stayed = el7.filter((p) => insBack(p, 7)), left = el7.filter((p) => !insBack(p, 7));
  const KINDS = ["post", "like", "comment", "follow", "vote", "enter", "shop", "listen"];
  const day1 = (xs) => Object.fromEntries(KINDS.map((k) => [k, insPct(xs.filter((p) => (p.kinds[k]?.day1 || 0) > 0).length, xs.length)]));
  const avg = (xs) => (xs.length ? Math.round((xs.reduce((s, p) => s + KINDS.reduce((t, k) => t + (p.kinds[k]?.day1 || 0), 0), 0) / xs.length) * 10) / 10 : 0);
  /* the lab and kind of their first post */
  const firsts = new Map(db.prepare(`SELECT p.author_id, p.channel, p.video_url, p.audio_track_id, p.beat_json, p.image_url, p.images FROM posts p
    JOIN (SELECT author_id, MIN(id) id FROM posts GROUP BY author_id) f ON f.id = p.id`).all().map((r) => [r.author_id, r]));
  const group = (keyOf) => { const m = new Map(); for (const p of el7) { const f = firsts.get(p.id); if (!f) continue; const k = keyOf(f);
    const g = m.get(k) || { members: 0, stayed: 0 }; g.members++; if (insBack(p, 7)) g.stayed++; m.set(k, g); }
    return [...m].map(([k, g]) => ({ group: k, ...g, stayedPct: insPct(g.stayed, g.members) })).sort((a, b) => b.members - a.members); };
  const labName = { hq: "General", pharmacy: "Visual", culture: "Music", fashion: "Fashion", akatsuki: "Anime", casino: "News", tna: "Business" };
  res.json({
    windowDays: days, joined: all.length,
    cameBack: { after1Day: back(1), after7Days: back(7), after30Days: back(30) },
    byJoinWeek: weeks,
    firstDay: { stayedAWeek: { members: stayed.length, did: day1(stayed), avgActions: avg(stayed) }, didnt: { members: left.length, did: day1(left), avgActions: avg(left) },
      meaning: "% of each group who did that on their first day (24 hours after joining)" },
    byFirstPostLab: group((f) => labName[LAB_OF[f.channel]] || f.channel),
    byFirstPostKind: group(insKind),
    readMe: ["Came back = did anything after that many days: opened the app signed in (noted from 2026-10-29), posted, liked, commented, followed, voted, entered, shopped or listened.",
      "Before 2026-10-29 a visit with no action wasn't noted, so older 'came back' numbers are a floor."],
  });
});
