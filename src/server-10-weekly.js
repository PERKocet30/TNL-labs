/* ================================================================
   THE WEEK · v1.0 — 2026-10-26. "A weekly report of all the data we
   collect, to improve the app. A simple email is fine."
   Every Monday morning (13:00 UTC, like the daily digest) the admin gets
   one email: last week against the week before, in plain lines —
     the people    new members, who confirmed, who finished their page,
                   who posted, who came back; where new people stop
     the work      posts by lab, likes, comments, saves, collabs accepted,
                   plays, messages
     the market    new pieces, views, bag adds (offers), sales and the money,
                   pieces looked at a lot but not bought
     the tournament  entries and votes, if one is open
     reach         Google Search and Shopping, Instagram and Facebook
                   (the Systems readers, when their keys are set)
     how it felt   errors and glitches, the worst spot
     what to do    the few moves the numbers point at (ours + Google's +
                   Meta's), in Jorge's words
   Counts and patterns only — never a member's name.
     GET  /api/admin/weekly        the report as lines (admins)
     POST /api/admin/weekly/send   email it now to the signed-in admin
   Sent once per week (alert_log 'weekly'); the first run after this ships
   sends right away so the first report doesn't wait a week.
   test/weekly.test.mjs.
================================================================ */
const WK = 7 * 86400000, WK_PAID = `('paid','shipped','complete')`;
const wkN = (sql, ...p) => Number(db.prepare(sql).get(...p)?.n) || 0;
const wkPct = (a, b) => (b ? Math.round(((a - b) / b) * 100) : a ? null : 0);
const wkCmp = (a, b) => { const c = wkPct(a, b); return c === null ? "new" : c === 0 ? "same as the week before" : `${c > 0 ? "up" : "down"} ${Math.abs(c)}%`; };
const wkMoney = (c) => "$" + (Math.round(c / 100)).toLocaleString();
const wkS = (n, w) => `${n.toLocaleString()} ${n === 1 ? w : /[^aeiou]y$/.test(w) ? w.slice(0, -1) + "ies" : w.endsWith("h") ? w + "es" : w + "s"}`;

function weeklyApp(now) {
  const a = now - WK, b = now - 2 * WK;
  const both = (sql) => [wkN(sql, a, now), wkN(sql, b, a)];
  const joined = both(`SELECT COUNT(*) n FROM users WHERE created_at >= ? AND created_at < ?`);
  const confirmed = wkN(`SELECT COUNT(*) n FROM users WHERE created_at >= ? AND created_at < ? AND email_verified = 1`, a, now);
  const finished = wkN(`SELECT COUNT(*) n FROM users WHERE created_at >= ? AND created_at < ? AND COALESCE(avatar_url,'') <> '' AND COALESCE(bio,'') <> ''`, a, now);
  const firstPost = wkN(`SELECT COUNT(DISTINCT u.id) n FROM users u JOIN posts p ON p.author_id = u.id WHERE u.created_at >= ? AND u.created_at < ?`, a, now);
  const posted = both(`SELECT COUNT(DISTINCT author_id) n FROM posts WHERE created_at >= ? AND created_at < ?`);
  /* came back: members who joined the week before last and did something (post, like, comment, follow) last week */
  const cohort = wkN(`SELECT COUNT(*) n FROM users WHERE created_at >= ? AND created_at < ?`, b, a);
  const back = cohort ? wkN(`SELECT COUNT(DISTINCT u.id) n FROM users u WHERE u.created_at >= ? AND u.created_at < ? AND (
      EXISTS (SELECT 1 FROM posts p WHERE p.author_id = u.id AND p.created_at >= ?) OR EXISTS (SELECT 1 FROM likes l WHERE l.user_id = u.id AND l.created_at >= ?)
      OR EXISTS (SELECT 1 FROM comments c WHERE c.author_id = u.id AND c.created_at >= ?) OR EXISTS (SELECT 1 FROM follows f WHERE f.follower_id = u.id AND f.created_at >= ?))`, b, a, a, a, a, a) : 0;
  const posts = both(`SELECT COUNT(*) n FROM posts WHERE created_at >= ? AND created_at < ?`);
  const perLab = {};   // channels roll up to their lab, named like the pulse page (server-10-pulse-labs)
  for (const r of db.prepare(`SELECT channel, COUNT(*) n FROM posts WHERE created_at >= ? AND created_at < ? GROUP BY channel`).all(a, now)) { const l = labName(r.channel) || "elsewhere"; perLab[l] = (perLab[l] || 0) + r.n; }
  const byLab = Object.entries(perLab).map(([lab, n]) => ({ lab: lab.toLowerCase(), n })).sort((x, y) => y.n - x.n).slice(0, 6);
  const likes = both(`SELECT COUNT(*) n FROM likes WHERE created_at >= ? AND created_at < ?`);
  const comments = both(`SELECT COUNT(*) n FROM comments WHERE created_at >= ? AND created_at < ?`);
  const follows = both(`SELECT COUNT(*) n FROM follows WHERE created_at >= ? AND created_at < ?`);
  const collabs = wkN(`SELECT COUNT(*) n FROM collaborators WHERE status = 'accepted' AND created_at >= ? AND created_at < ?`, a, now);
  const plays = both(`SELECT COUNT(*) n FROM track_plays WHERE at >= ? AND at < ?`);
  const dms = both(`SELECT COUNT(*) n FROM dm_messages WHERE created_at >= ? AND created_at < ?`);
  const listings = both(`SELECT COUNT(*) n FROM listings WHERE created_at >= ? AND created_at < ?`);
  const views = both(`SELECT COUNT(*) n FROM listing_views WHERE viewed_at >= ? AND viewed_at < ?`);
  const offers = both(`SELECT COUNT(*) n FROM offers WHERE created_at >= ? AND created_at < ?`);
  const sales = both(`SELECT COUNT(*) n FROM orders WHERE status IN ${WK_PAID} AND created_at >= ? AND created_at < ?`);
  const gross = [wkN(`SELECT COALESCE(SUM(amount_cents),0) n FROM orders WHERE status IN ${WK_PAID} AND created_at >= ? AND created_at < ?`, a, now),
    wkN(`SELECT COALESCE(SUM(amount_cents),0) n FROM orders WHERE status IN ${WK_PAID} AND created_at >= ? AND created_at < ?`, b, a)];
  const lookedNotBought = db.prepare(`SELECT l.id, l.title, COUNT(v.user_id) n FROM listings l JOIN listing_views v ON v.listing_id = l.id AND v.viewed_at >= ?
    WHERE l.status = 'active' AND NOT EXISTS (SELECT 1 FROM orders o WHERE o.listing_id = l.id AND o.created_at >= ?) GROUP BY l.id HAVING n >= 5 ORDER BY n DESC LIMIT 3`).all(a, a);
  const ev = db.prepare(`SELECT id, title, slug FROM events WHERE published = 1 ORDER BY id DESC LIMIT 1`).get();
  const event = ev ? { title: ev.title, entries: wkN(`SELECT COUNT(*) n FROM event_entries WHERE event_id = ? AND created_at >= ?`, ev.id, a),
    votes: wkN(`SELECT COUNT(*) n FROM event_votes WHERE event_id = ? AND created_at >= ?`, ev.id, a),
    voters: wkN(`SELECT COUNT(DISTINCT voter_id) n FROM event_votes WHERE event_id = ? AND created_at >= ?`, ev.id, a) } : null;
  const errors = both(`SELECT COUNT(*) n FROM error_log WHERE created_at >= ? AND created_at < ?`);
  const glitches = both(`SELECT COUNT(*) n FROM glitch_events WHERE created_at >= ? AND created_at < ?`);
  const worst = typeof worstSpots === "function" ? worstSpots(a, null, 2) : [];
  const topErr = db.prepare(`SELECT message, COUNT(*) n FROM error_log WHERE created_at >= ? GROUP BY message ORDER BY n DESC LIMIT 1`).get(a);
  return { joined, confirmed, finished, firstPost, posted, cohort, back, posts, byLab, likes, comments, follows, collabs, plays, dms,
    listings, views, offers, sales, gross, lookedNotBought: lookedNotBought.map((l) => ({ id: l.id, title: String(l.title).slice(0, 60), n: l.n })),
    event, errors, glitches, worst, topErr: topErr ? { message: String(topErr.message || "").slice(0, 100), n: topErr.n } : null };
}

/* Reach, from the Systems readers — each only when its key is set, each failure one line. */
async function weeklyReach() {
  const out = { google: null, meta: null };
  try {
    const key = typeof ggKey === "function" ? ggKey() : null;
    if (key && !key.bad) { const tok = await ggToken(key); const [s, p] = await Promise.all([ggSearch(tok).catch((e) => ({ error: e.message })), ggShopping(tok).catch((e) => ({ error: e.message }))]);
      out.google = { search: s, shopping: p, todo: ggTodo(s, p) }; }
  } catch (e) { out.google = { error: String(e.message || "").slice(0, 120) }; }
  try {
    if (typeof MT === "object" && MT.token()) { const who = await mtWho();
      const [ig, fb, shop] = await Promise.all([mtInstagram(who.ig).catch((e) => ({ error: e.message })), mtFacebook(who.page).catch((e) => ({ error: e.message })), MT.catalog() ? mtShop(MT.catalog()).catch((e) => ({ error: e.message })) : null]);
      out.meta = { instagram: ig, facebook: fb, shop, todo: mtTodo(ig, fb, shop) }; }
  } catch (e) { out.meta = { error: String(e.message || "").slice(0, 120) }; }
  return out;
}

/* The report, as lines Jorge reads in two minutes. */
function weeklyLines(A, R) {
  const L = [], H = (t) => L.push(`— ${t.toUpperCase()} —`);
  H("the people");
  L.push(`${wkS(A.joined[0], "new member")} (${wkCmp(A.joined[0], A.joined[1])}). ${A.confirmed} confirmed their email, ${A.finished} finished their page, ${A.firstPost} posted something.`);
  if (A.joined[0]) {
    const stop = A.joined[0] - A.confirmed > A.confirmed - A.finished && A.joined[0] - A.confirmed > A.finished - A.firstPost ? "confirming their email" : A.confirmed - A.finished >= A.finished - A.firstPost ? "finishing their page (a photo and a line)" : "making a first post";
    L.push(`Where new people stop most: ${stop}.`);
  }
  if (A.cohort) L.push(`Of the ${A.cohort} who joined the week before, ${A.back} came back and did something (${Math.round((A.back / A.cohort) * 100)}%).`);
  L.push(`${A.posted[0]} members posted (${wkCmp(A.posted[0], A.posted[1])}).`);
  H("the work");
  L.push(`${wkS(A.posts[0], "post")} (${wkCmp(A.posts[0], A.posts[1])})${A.byLab.length ? ": " + A.byLab.map((l) => `${l.n} in ${l.lab}`).join(", ") : ""}.`);
  L.push(`${A.likes[0]} likes, ${A.comments[0]} comments, ${A.follows[0]} follows, ${A.collabs} collabs accepted, ${A.plays[0]} plays, ${A.dms[0]} messages.`);
  const quiet = A.byLab.length && A.byLab.length < 4 ? "Labs with nothing new this week are the ones to seed — one post from a general each wakes them up." : "";
  if (quiet) L.push(quiet);
  H("the market");
  L.push(`${wkS(A.listings[0], "new piece")}, ${wkS(A.views[0], "view")} (${wkCmp(A.views[0], A.views[1])}), ${wkS(A.offers[0], "offer")}, ${wkS(A.sales[0], "sale")} for ${wkMoney(A.gross[0])} (${wkCmp(A.gross[0], A.gross[1])}).`);
  for (const l of A.lookedNotBought) L.push(`Looked at ${l.n} times, not bought: "${l.title}" — the price, the photos or the size note is the fix.`);
  if (A.event) { H("the tournament"); L.push(`${A.event.title}: ${wkS(A.event.entries, "new entry")}, ${A.event.votes} votes from ${A.event.voters} people this week.`); }
  H("reach");
  const G = R.google, M = R.meta;
  if (!G) L.push("Google: not connected.");
  else if (G.error) L.push(`Google: couldn't read (${G.error}).`);
  else {
    const s = G.search, p = G.shopping;
    if (s && !s.error) L.push(`Google Search: ${s.totals.clicks} clicks from ${s.totals.impressions.toLocaleString()} times shown (clicks ${s.totals.change.clicks == null ? "new" : (s.totals.change.clicks >= 0 ? "up " : "down ") + Math.abs(s.totals.change.clicks) + "%"}), average spot ${s.totals.position || "—"}.${s.closeToTop[0] ? ` Closest to page 1: "${s.closeToTop[0].query}" (spot ${Math.round(s.closeToTop[0].position)}).` : ""}`);
    else L.push(`Google Search: couldn't read (${s?.error || "?"}).`);
    if (p && !p.error) L.push(`Google Shopping: ${p.counts.live} of ${p.total} pieces showing, ${p.counts.pending} waiting, ${p.counts.notShown} not shown.`);
    else L.push(`Google Shopping: couldn't read (${p?.error || "?"}).`);
  }
  if (!M) L.push("Instagram and Facebook: not connected.");
  else if (M.error) L.push(`Meta: couldn't read (${M.error}).`);
  else {
    const ig = M.instagram, fb = M.facebook, sh = M.shop;
    if (ig && !ig.error) { const t = ig.totals || {}; L.push(`Instagram @${ig.username}: ${ig.followers.toLocaleString()} followers (${ig.netFollowers >= 0 ? "+" : ""}${ig.netFollowers} in 28 days), reached ${(t.reach || 0).toLocaleString()} (${t.reachChange == null ? "new" : (t.reachChange >= 0 ? "up " : "down ") + Math.abs(t.reachChange) + "%"}), ${t.linkTaps || 0} link taps.${ig.posts && ig.posts[0] ? ` Best post: "${ig.posts[0].caption || ig.posts[0].kind}" reached ${ig.posts[0].reach.toLocaleString()}.` : ""}`); }
    else L.push(`Instagram: couldn't read (${ig?.error || "?"}).`);
    if (fb && !fb.error) L.push(`Facebook: ${fb.followers} followers, reached ${fb.reach.toLocaleString()} in 28 days.`);
    if (sh && !sh.error) L.push(`Instagram shop: ${sh.counts.approved} pieces can be tagged, ${sh.counts.rejected} rejected.`);
  }
  H("how it felt");
  L.push(`${wkS(A.errors[0], "error")} (${wkCmp(A.errors[0], A.errors[1])}), ${wkS(A.glitches[0], "glitch")} (${wkCmp(A.glitches[0], A.glitches[1])}).${A.topErr ? ` Most often: ${A.topErr.n}× ${A.topErr.message}.` : ""}`);
  for (const [i, w] of A.worst.entries()) L.push(`${i ? "Next worst" : "Worst spot"}: ${w.n}× ${w.kind.replace(/_/g, " ")} at ${w.place}${w.detail ? " — " + w.detail : ""}.`);
  H("what to do this week");
  const todo = [];
  if (A.joined[0] && A.finished < A.confirmed / 2) todo.push("Half of new members never finish their page. Shorten it: a photo and one line, the rest later.");
  if (A.views[0] >= 20 && !A.sales[0]) todo.push("People are looking at pieces but nobody bought. Check the prices against what sells on Instagram, and that shipping isn't a surprise at checkout.");
  if (A.posts[0] && A.posted[0] <= 3) todo.push("A few people make most of the posts. Ask the generals to each bring one member in this week.");
  if (A.event && A.event.votes && A.event.voters && A.event.votes / A.event.voters < 2) todo.push("Voters vote once and don't come back. A daily Story with the live board brings them back for their next vote.");
  for (const t of (G && G.todo) || []) todo.push(t.text);
  for (const t of (M && M.todo) || []) todo.push(t.text);
  if (A.glitches[0] > 20 && A.worst[0]) todo.push(`Fix ${A.worst[0].place} first — it's where the app felt broken most.`);
  if (!todo.length) todo.push("Nothing's on fire. Post, sell, and bring people in.");
  for (const t of todo.slice(0, 7)) L.push(`• ${t}`);
  return L;
}

async function weeklyReport(now = Date.now()) {
  const A = weeklyApp(now), R = await weeklyReach();
  const lines = weeklyLines(A, R);
  const subject = `LABS this week: ${A.joined[0]} joined · ${A.posts[0]} posts · ${A.sales[0]} sale${A.sales[0] === 1 ? "" : "s"}`;
  return { at: now, subject, lines, week: { from: new Date(now - WK).toISOString().slice(0, 10), to: new Date(now).toISOString().slice(0, 10) } };
}

const weeklyTo = () => (process.env.ADMIN_EMAIL || "").trim();
async function weeklySend(to, rep) {
  const { sendWeeklyEmail } = await import("./mail.js");   // boot's import line is full (24KB) — loaded here instead
  const r = await sendWeeklyEmail(to, rep.subject, rep.lines, adminLink().replace(/#.*$/, "#systems"));   // the week lives on Systems (#system is the old Settings alias)
  if (!r.sent && r.reason !== "no_key") logError("mail", "weekly report not sent: " + (r.error || "?"), rep.subject, "weekly", "");
  return r;
}
/* Monday 13:00 UTC, once; the first time this code runs it sends right away. */
async function weeklyTick(now) {
  const d = new Date(now), prev = db.prepare(`SELECT last_at FROM alert_log WHERE rule = 'weekly'`).get();
  const monday = d.getUTCDay() === 1 && d.getUTCHours() >= 13, due = !prev || (monday && now - prev.last_at > 6 * 86400000);
  if (!due || !weeklyTo()) return false;
  db.prepare(`INSERT INTO alert_log (rule, last_at) VALUES ('weekly', ?) ON CONFLICT(rule) DO UPDATE SET last_at = excluded.last_at`).run(now);
  await weeklySend(weeklyTo(), await weeklyReport(now));
  return true;
}
if (weeklyTo() && !process.env.TNL_NO_WATCH) {
  const tick = () => weeklyTick(Date.now()).catch((e) => console.error("[weekly]", e.message));
  setTimeout(tick, 90000).unref?.();
  setInterval(tick, 30 * 60000).unref?.();
}

app.get("/api/admin/weekly", auth, admin, rateLimit({ max: 6, windowMs: 60000, key: "user" }), async (req, res) => {
  const rep = await weeklyReport();
  const prev = db.prepare(`SELECT last_at FROM alert_log WHERE rule = 'weekly'`).get();
  res.json({ ...rep, lastSentAt: prev ? prev.last_at : null, to: weeklyTo() ? "the admin address" : null });
});
app.post("/api/admin/weekly/send", auth, admin, rateLimit({ max: 3, windowMs: 3600000, key: "user" }), async (req, res) => {
  const to = String(req.user.email || "").trim();
  if (!to) return res.status(400).json({ error: "Your account has no email." });
  const r = await weeklySend(to, await weeklyReport());
  res.json({ sent: !!r.sent, reason: r.reason || null });
});
