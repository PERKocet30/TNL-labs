/* LABS admin v4.2 — 2026-11-15 ("streamline everything … how it's organised, categorised and
   worded"): every label is LABS's own word with one meaning — Took part, Opened the app, Joined,
   Came back (it said Active, New, Signed up for the same things) — the tabs are Members · Joining ·
   Market · Work, and What the numbers mean prints the dictionary (server/admin/measures.js) under
   every tab. v4.1 — 2026-11-09 ("get rid of any data that isn't useful and track
   what is"): "Do new members stay?" is who came back (it was who's still
   posting, 1% of a week that half came back from), with the real never-posted
   and gone-quiet counts (the lists behind them stop at 20); Reach shows where
   new members stop and which ways in bring people who stay — both were only
   Echo's to read — in place of "Not tracked yet" and a made-up "Posted first
   work". v4.0 — 2026-10-20. Analytics, in one place: Members (active,
   new, retention, who they are — by what they make, by lab, by hour),
   Reach (the funnel from sign-up to sale; sign-ups by source when the tags
   land), Commerce (sales, fees, by seller), Content (posts by lab, how
   people take part). The date range drives every chart. Studio stats are
   a page of their own (9-studio.js). */
let ATAB = "members";
const ATABS = [["members", "Members"], ["reach", "Joining"], ["commerce", "Market"], ["content", "Work"]];
const insDays = () => (RANGE <= 7 ? 7 : RANGE <= 30 ? 30 : 90);   // the insight windows: members who joined in the last 7, 30 or 90 days
LOADERS.analytics = async () => {
  const q = pulseURL();
  const [p, d, sr, au, fu, re, m, ir, ic] = await Promise.all([req(q), req(q.replace("/pulse", "/direction")), req(q.replace("/pulse", "/series")), req(q.replace("/pulse", "/audience")),
    req("/api/admin/funnel"), req("/api/admin/retention"), req("/api/admin/market"), req("/api/admin/insights/retention?days=" + insDays()), req("/api/admin/insights/conversion?days=" + insDays()), nwLoad(),
    D.measures ? null : req("/api/admin/measures").then((r) => { D.measures = r.measures; }).catch(() => {})]);   // nwLoad: the member's path at the front (2-network.js)
  Object.assign(D, { pulse: p, dir: d, series: sr, audience: au, funnel: fu, retention: re, market: m, insRet: ir, insConv: ic });
};
VIEWS.analytics = () => {
  const p = D.pulse, d = D.dir, S = D.series, A = D.audience, F = D.funnel, R = D.retention, m = D.market, IR = D.insRet, IC = D.insConv;
  if (!p || !d || !S || !A || !F || !R || !m || !IR || !IC) return askel();
  const step = (name) => (IC.steps.find((x) => x.step.startsWith(name)) || { members: 0, pct: 0 });
  const wk = (w) => (w === 0 ? "This week" : w === 1 ? "Last week" : `${w} weeks ago`);
  const pc = (n) => (n == null ? `<span class="dim">too soon</span>` : n + "%");
  const DO = IC.dropOffs;
  const labels = dayLabels(S.start, S.days), n = p.now, b = p.before;
  const chart = (title, key, fmt = num, sub = "") => card(title, `<div class="body">${lineHTML(S.series[key], S.prev[key], { labels, fmt, h: 190 })}<div class="leg"><span><i></i>Last ${S.days} days</span><span><i class="pv"></i>The ${S.days} before</span></div></div>`, sub);
  const hour = (h) => (h % 12 || 12) + (h < 12 ? "am" : "pm");
  const tabs = {
    members: () => `<div class="grid g2 g4">
      ${kpiHTML("Took part", num(n.active), { now: n.active, before: b.active, share: `${pct(n.active, A.members)} of ${num(A.members)} · ${num(A.active30)} in 30 days`, series: S.series.active })}
      ${kpiHTML("Opened the app", num(n.opened), { now: n.opened, before: b.opened, share: `${pct(n.opened, A.members)} of members` })}
      ${kpiHTML("Joined", num(n.signups), { now: n.signups, before: b.signups, share: `${num(A.members)} members in all`, series: S.series.signups })}
      ${kpiHTML("Email confirmed", num(A.verified), { share: `${pct(A.verified, A.members)} reachable without Instagram` })}</div>
      <div class="two">${chart("Took part, by day", "active")}${chart("Joined, by day", "signups")}</div>
      <div class="two">${card("What they make", `<div class="body">${A.byRole.length ? breakHTML(A.byRole.map((r) => ({ label: r.role, n: r.n }))) : `<div class="empty">No roles picked yet.</div>`}</div>`, "roles members picked")}
        ${card("Posted in which lab", `<div class="body">${breakHTML(A.byLab.map((l) => ({ label: l.name, n: l.people })))}</div>`, "members who posted there this period")}</div>
      <div class="two">${card("When they're on the app", `<div class="body">${barsHTML(A.hours, { labels: A.hours.map((_, h) => hour(h)), h: 110 })}</div>`, "activity by hour, your time")}
        ${card("Do new members stay?", `<div class="body"><table class="tbl"><thead><tr><th>Joined</th><th class="num">Members</th><th class="num">Back next day</th><th class="num">Back after a week</th></tr></thead><tbody>${IR.byJoinWeek.filter((c) => c.joined).map((c) => `<tr><td>${wk(c.joinedWeeksAgo)}</td><td class="num">${num(c.joined)}</td><td class="num">${pc(c.back1)}</td><td class="num">${pc(c.back7)}</td></tr>`).join("") || `<tr><td colspan="4" class="dim">No one joined in this period.</td></tr>`}</tbody></table>
          <p class="mono" style="margin-top:8px">${num(R.neverPosted)} never posted · ${num(R.goneQuiet)} gone quiet (14+ days) · see Members for who</p></div>`, "came back = opened the app or did anything, by the week they joined")}</div>`,
    reach: () => `<div class="grid g2 g4">
      ${kpiHTML("Members", num(A.members), { share: `${num(A.verified)} with email confirmed` })}
      ${kpiHTML("Joined", num(n.signups), { now: n.signups, before: b.signups })}
      ${kpiHTML("Came back", IR.cameBack.after7Days.eligible ? IR.cameBack.after7Days.pct + "%" : "—", { share: IR.cameBack.after7Days.eligible ? `${num(IR.cameBack.after7Days.cameBack)} of the ${num(IR.cameBack.after7Days.eligible)} who joined a week or more ago` : "too soon to say" })}
      ${kpiHTML("Posted", num(step("Posted").members), { share: `${step("Posted").pct}% of the ${num(IC.joined)} who joined in ${IC.windowDays} days` })}</div>
      ${card("From joining to a sale", `<div class="body">${funnelHTML(F.steps)}</div>`, "members, all time")}
      ${card("Where new members stop", `<div class="body"><table class="tbl"><thead><tr><th>They…</th><th class="num">Members</th><th class="num">Of those who joined</th></tr></thead><tbody>${[["Never posted", DO.neverPosted.members], ["Joined and only looked", DO.joinedAndOnlyLooked.members], ["Voted, never posted", DO.votedButNeverPosted.members], ["Voted, never entered", DO.votedButNeverEntered.members], ["Posted once, then went quiet", DO.postedOnceThenQuiet.members]].map(([l, v]) => `<tr><td>${l}</td><td class="num">${num(v)}</td><td class="num">${pct(v, IC.joined)}</td></tr>`).join("")}</tbody></table></div>`, `of the ${num(IC.joined)} who joined in ${IC.windowDays} days`)}
      ${card("Ways in", `<div class="body">${IC.waysIn.length ? `<table class="tbl"><thead><tr><th>Came from</th><th class="num">Joined</th><th class="num">Voted</th><th class="num">Posted</th><th class="num">Came back</th></tr></thead><tbody>${IC.waysIn.slice(0, 8).map((w) => `<tr><td>${esc(w.wayIn)}</td><td class="num">${num(w.joined)}</td><td class="num">${w.votedPct}%</td><td class="num">${w.postedPct}%</td><td class="num">${w.cameBackPct}%</td></tr>`).join("")}</tbody></table>` : `<div class="empty">No one joined in this period.</div>`}</div>`, "which ways in bring members who vote, post and come back · noted from 26 Oct")}`,
    commerce: () => `<div class="grid g2 g4">
      ${kpiHTML("Sales", money(sum(S.series.gmv)), { now: sum(S.series.gmv), before: sum(S.prev.gmv), fmt: money, series: S.series.gmv })}
      ${kpiHTML("Orders", num(sum(S.series.orders)), { now: sum(S.series.orders), before: sum(S.prev.orders), series: S.series.orders })}
      ${kpiHTML("Fees earned", money(S.fees.now), { now: S.fees.now, before: S.fees.before, fmt: money, share: `${money(m.revenue)} all time` })}
      ${kpiHTML("Average order", money(m.aov), { share: `${num(m.active)} listings live · ${m.connected} can sell` })}</div>
      <div class="two">${chart("Sales, by day", "gmv", money)}${chart("Orders, by day", "orders")}</div>
      ${card("By seller", `<div class="body">${m.topSellers.length ? breakHTML(m.topSellers.map((s) => ({ label: "@" + s.username, n: s.gross })), money) : `<div class="empty">No sales yet.</div>`}</div>`, "sales, all time")}`,
    content: () => `<div class="grid g2 g4">
      ${kpiHTML("Work posted", num(n.work), { now: n.work, before: b.work, series: S.series.work })}
      ${kpiHTML("Everything posted", num(n.posts), { now: n.posts, before: b.posts, share: `${num(n.posts - n.work)} talk`, series: S.series.posts })}
      ${kpiHTML("Feedback", num(n.feedback), { now: n.feedback, before: b.feedback, share: "likes, comments, reactions" })}
      ${kpiHTML("Tournament votes", num(d.votes.now), { now: d.votes.now, before: d.votes.before, series: S.series.votes })}</div>
      <div class="two">${chart("Work posted, by day", "work")}${chart("Votes, by day", "votes")}</div>
      <div class="two">${card("Posts by lab", `<div class="body">${breakHTML(d.labs.map((l) => ({ label: l.name, n: l.work + l.talk })))}</div>`, "this period")}
        ${card("How members take part", `<div class="body">${partHTML(d.takingPart)}</div>`, "members, all time")}</div>
      ${card("#tags people are using", `<div class="body">${d.tags.length ? `<div class="tgs">${d.tags.map((t) => `<button class="chip tg" data-tagf="${esc(t.tag)}">#${esc(t.tag)} <span>${t.count}</span></button>`).join("")}</div>` : `<div class="empty">No #tags in this period.</div>`}</div>`)}
      <p style="margin-top:12px"><button class="btn ghost sm" data-go="studio">Studio stats ${I.chev}</button></p>`,
  };
  return `${pageHead("Analytics", "How LABS is doing, in numbers", rangeHTML())}${pathCardHTML()}${subTabs(ATABS, ATAB, "data-atab")}<div style="margin-top:14px">${tabs[ATAB]()}</div>${meansHTML()}`;
};
/* the dictionary, printed: each number's name and the one line saying what it counts */
const meansHTML = () => (D.measures && D.measures.length ? `<div style="margin-top:14px">${card("What the numbers mean", `<div class="body"><table class="tbl"><tbody>${D.measures.map((m) => `<tr><td style="white-space:nowrap;vertical-align:top"><b>${esc(m.name)}</b></td><td>${esc(m.says)}</td></tr>`).join("")}</tbody></table></div>`, "one meaning each, everywhere in the admin")}</div>` : "");
WIRES.analytics = () => {
  pathWire();   // the member's path, a spinning model at the front (2026-11-04)
  $$("[data-atab]").forEach((b) => b.onclick = () => { ATAB = b.dataset.atab; paint(); scrollTo(0, 0); });
  $$("[data-tagf]").forEach((b) => b.onclick = () => { CTAG = b.dataset.tagf; CLAB = ""; CKIND = ""; CQ = ""; D.posts = null; go("content"); });
  $$("[data-welcome]").forEach((b) => b.onclick = () => go("home"));
};
