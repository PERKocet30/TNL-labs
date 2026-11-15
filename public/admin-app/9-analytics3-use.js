/* LABS admin — Analytics · Use, Make, Stay, Trade v1.0 — 2026-11-15 (the member's path, 9-analytics.js).
   Use shows what only Echo could read before: every screen (views, people, time on it, where people leave,
   taps that did nothing), where people go next, and what they start and don't finish — server/ui-signals.
   Make, Stay and Trade are the numbers the old Work, Members and Market tabs held, each under its question. */
const AFLOW = { post: "A post", "pick:post": "Picking pictures for a post", "pick:song": "Picking a song", sell: "A listing", checkout: "A checkout", enter: "A tournament entry", offer: "An offer", collab: "A collab invite", group: "A group chat" };
const ATAPPED = { img: "a picture", name: "a name", text: "words", card: "a card" };
ATABV.use = () => {
  const p = D.pulse, S = D.series, A = D.audience; if (!p || !S || !A) return aOwner;
  const n = p.now, b = p.before, V = D.visits, SC = D.uiScreens, PA = D.uiPaths, FL = D.uiFlows, TP = D.uiTaps;
  const hour = (h) => (h % 12 || 12) + (h < 12 ? "am" : "pm");
  const scrHead = ["Screen", "Views", "People", "Time on it", "Left the app here", "Backed out", "Taps that did nothing"];
  const scr = SC ? SC.screens.map((s) => [s.name, s.views, s.people, s.medianSeconds + "s", `${s.exits} (${s.exitRate}%)`, s.backOuts, s.deadTaps]) : [];
  const flowHead = ["They started", "Started", "Finished", "Gave up", "Finish rate"];
  const flows = FL ? FL.flows.filter((f) => f.started).map((f) => [AFLOW[f.flow] || f.flow, f.started, f.done, f.abandoned, f.finishRate + "%"]) : [];
  const days = Math.min(90, RANGE);
  return `<div class="grid g2 g4">
    ${kpiHTML("Took part", num(n.active), { now: n.active, before: b.active, share: `${pct(n.active, A.members)} of ${num(A.members)} · ${num(A.active30)} in 30 days`, series: S.series.active })}
    ${kpiHTML("Opened the app", num(n.opened), { now: n.opened, before: b.opened, share: `${pct(n.opened, A.members)} of members` })}
    ${kpiHTML("Screens a visit", V ? String(V.now.screens) : "—", { share: V ? `${num(V.now.visits)} visits` : "for the owner" })}
    ${kpiHTML("A visit lasts", V ? aSecs(V.now.secs) : "—", { share: V ? "the middle visit" : "for the owner" })}</div>
    <div class="two">${aChart(S, "Took part, by day", "active")}${card("When they're on the app", `<div class="body">${barsHTML(A.hours, { labels: A.hours.map((_, h) => hour(h)), h: 190 })}</div>`, "taking part, by hour, your time")}</div>
    ${card("Screens", `<div class="body">${SC ? aTbl(scrHead, scr.slice(0, 20).map((r) => [esc(r[0]), ...r.slice(1).map((x) => (typeof x === "number" ? num(x) : x))]), "No screens opened in this period.") : aOwner}</div>`,
      `the last ${days} days ` + csvBtn("Screens", scrHead, scr))}
    <div class="two">${card("Where they go next", `<div class="body">${PA ? aTbl(["From", "To", "Times"], PA.next.slice(0, 12).map((x) => [aScreen(x.from), aScreen(x.to), num(x.n)]), "Not enough moves yet.") : aOwner}</div>`, "the most common moves")}
      ${card("Where visits end", `<div class="body">${PA ? aTbl(["Screen", "Views", "Left the app here"], PA.deadEnds.map((x) => [aScreen(x.screen), num(x.views), `${num(x.exits)} (${x.exitRate}%)`]), "No screen loses 4 in 10 of its visits.") : aOwner}</div>`, "screens where 4 in 10 or more leave")}</div>
    <div class="two">${card("Started and not finished", `<div class="body">${FL ? aTbl(flowHead, flows.map((r) => [esc(r[0]), ...r.slice(1).map((x) => (typeof x === "number" ? num(x) : x))]), "Nothing started in this period.") : aOwner}</div>`, csvBtn("Started and not finished", flowHead, flows))}
      ${card("Taps that did nothing", `<div class="body">${TP ? aTbl(["Screen", "They tapped", "Times", "People"], TP.deadTaps.slice(0, 10).map((x) => [aScreen(x.screen), ATAPPED[x.role] || esc(x.role), num(x.n), num(x.people)]), "None in this period.") : aOwner}
        ${TP && TP.rageTaps.length ? `<p class="mono" style="margin-top:8px">Hammered: ${TP.rageTaps.slice(0, 4).map((x) => `${aScreen(x.screen)} · ${esc(x.what)} ×${x.n}`).join(" · ")}</p>` : ""}</div>`, "something looked tappable and wasn't")}</div>`;
};

ATABV.make = () => {
  const p = D.pulse, S = D.series, d = D.dir, A = D.audience; if (!p || !S || !d || !A) return aOwner;
  const n = p.now, b = p.before;
  return `<div class="grid g2 g4">
    ${kpiHTML("Work posted", num(n.work), { now: n.work, before: b.work, series: S.series.work })}
    ${kpiHTML("Everything posted", num(n.posts), { now: n.posts, before: b.posts, share: `${num(n.posts - n.work)} talk`, series: S.series.posts })}
    ${kpiHTML("Feedback", num(n.feedback), { now: n.feedback, before: b.feedback, share: "likes, comments, reactions" })}
    ${kpiHTML("Tournament votes", num(d.votes.now), { now: d.votes.now, before: d.votes.before, series: S.series.votes })}</div>
    <div class="two">${aChart(S, "Work posted, by day", "work", num, csvBtn("Work and votes by day", ["Day", "Work posted", "Everything posted", "Votes"], dayLabels(S.start, S.days).map((l, i) => [l, S.series.work[i], S.series.posts[i], S.series.votes[i]])))}${aChart(S, "Votes, by day", "votes")}</div>
    <div class="two">${card("Posts by lab", `<div class="body">${breakHTML(d.labs.map((l) => ({ label: l.name, n: l.work + l.talk })))}</div>`, "this period")}
      ${card("Posted in which lab", `<div class="body">${breakHTML(A.byLab.map((l) => ({ label: l.name, n: l.people })))}</div>`, "members who posted there this period")}</div>
    <div class="two">${card("What they make", `<div class="body">${A.byRole.length ? breakHTML(A.byRole.map((r) => ({ label: r.role, n: r.n }))) : `<div class="empty">No roles picked yet.</div>`}</div>`, "roles members picked")}
      ${card("How members take part", `<div class="body">${partHTML(d.takingPart)}</div>`, "members, all time")}</div>
    ${card("#tags people are using", `<div class="body">${d.tags.length ? `<div class="tgs">${d.tags.map((t) => `<button class="chip tg" data-tagf="${esc(t.tag)}">#${esc(t.tag)} <span>${t.count}</span></button>`).join("")}</div>` : `<div class="empty">No #tags in this period.</div>`}</div>`)}
    <p style="margin-top:12px"><button class="btn ghost sm" data-go="studio">Studio stats ${I.chev}</button></p>`;
};

ATABV.stay = () => {
  const IR = D.insRet, R = D.retention; if (!IR || !R) return aOwner;
  const wk = (w) => (w === 0 ? "This week" : w === 1 ? "Last week" : `${w} weeks ago`), pc = (x) => (x == null ? `<span class="dim">too soon</span>` : x + "%");
  const B = IR.cameBack, back = (x, when) => kpiHTML("Back after " + when, x.eligible ? x.pct + "%" : "—", { share: x.eligible ? `${num(x.cameBack)} of ${num(x.eligible)} who joined that long ago` : "too soon to say" });
  const weeks = IR.byJoinWeek.filter((c) => c.joined), head = ["Joined", "Members", "Back next day", "Back after a week"];
  const FD = IR.firstDay, DID = [["post", "Posted"], ["like", "Liked"], ["comment", "Gave feedback"], ["follow", "Followed someone"], ["vote", "Voted"], ["enter", "Entered the tournament"], ["shop", "Looked at the Market"], ["listen", "Played a song"]];
  return `<div class="grid g2 g4">${back(B.after1Day, "a day")}${back(B.after7Days, "a week")}${back(B.after30Days, "a month")}
    ${kpiHTML("Never posted", num(R.neverPosted), { share: `${num(R.goneQuiet)} gone quiet (14+ days) · see Members for who` })}</div>
    ${card("Do new members stay?", `<div class="body">${aTbl(head, weeks.map((c) => [wk(c.joinedWeeksAgo), num(c.joined), pc(c.back1), pc(c.back7)]), "No one joined in this period.")}</div>`,
      "by the week they joined " + csvBtn("Do new members stay", head, weeks.map((c) => [wk(c.joinedWeeksAgo), c.joined, c.back1 == null ? "" : c.back1 + "%", c.back7 == null ? "" : c.back7 + "%"])))}
    ${card("What the ones who stayed did on day one", `<div class="body">${FD && (FD.stayedAWeek.members || FD.didnt.members) ? aTbl(["On their first day they…", `Stayed a week (${num(FD.stayedAWeek.members)})`, `Didn't (${num(FD.didnt.members)})`],
      DID.map(([k, l]) => [l, (FD.stayedAWeek.did[k] || 0) + "%", (FD.didnt.did[k] || 0) + "%"])) : `<div class="empty">Too soon to say.</div>`}</div>`, "members who joined a week or more ago")}`;
};

ATABV.trade = () => {
  const S = D.series, m = D.market; if (!S || !m) return aOwner;
  const labels = dayLabels(S.start, S.days);
  return `<div class="grid g2 g4">
    ${kpiHTML("Sales", money(sum(S.series.gmv)), { now: sum(S.series.gmv), before: sum(S.prev.gmv), fmt: money, series: S.series.gmv })}
    ${kpiHTML("Orders", num(sum(S.series.orders)), { now: sum(S.series.orders), before: sum(S.prev.orders), series: S.series.orders })}
    ${kpiHTML("Fees earned", money(S.fees.now), { now: S.fees.now, before: S.fees.before, fmt: money, share: `${money(m.revenue)} all time` })}
    ${kpiHTML("Average order", money(m.aov), { share: `${num(m.active)} listings live · ${m.connected} can sell` })}</div>
    <div class="two">${aChart(S, "Sales, by day", "gmv", money, csvBtn("Sales by day", ["Day", "Sales ($)", "Orders"], labels.map((l, i) => [l, (S.series.gmv[i] || 0) / 100, S.series.orders[i]])))}${aChart(S, "Orders, by day", "orders")}</div>
    ${card("By seller", `<div class="body">${m.topSellers.length ? breakHTML(m.topSellers.map((s) => ({ label: "@" + s.username, n: s.gross })), money) : `<div class="empty">No sales yet.</div>`}</div>`, "sales, all time")}`;
};
