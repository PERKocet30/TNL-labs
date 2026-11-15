/* LABS admin — Analytics · Now, Arrive, Join v1.0 — 2026-11-15 (the member's path, 9-analytics.js).
   Now: who's here (GET /api/admin/now, refreshed every 20s while it's in front).
   Arrive: visits and where each came from (GET /api/admin/visits) — the numbers Google Analytics would show,
   from LABS's own count: no outside tracker. Filters: a source, phone or computer, new or returning.
   Join: the path from joining to a sale, where new members stop, and which ways in bring people who stay. */
ATABV.now = () => {
  const n = D.now; if (!n) return aOwner;
  const t = n.today, mins = n.minutes.map((_, i) => (i === 29 ? "now" : i % 10 === 0 ? `${30 - i}m ago` : ""));
  return `<div class="grid g2 g4">
    ${kpiHTML("Here now", num(n.here), { share: `${num(n.members)} signed in · the last 5 minutes` })}
    ${kpiHTML("Visits today", num(t.visits), { share: `${num(t.visitors)} visitor${t.visitors === 1 ? "" : "s"}` })}
    ${kpiHTML("Joined today", num(t.joined), { share: `${num(t.tookPart)} took part` })}
    ${kpiHTML("Work posted today", num(t.work), { share: `${money(t.sales)} in sales` })}</div>
    ${card("The last half hour", `<div class="body">${barsHTML(n.minutes, { labels: mins, h: 110 })}</div>`, "people in the app, minute by minute")}
    <div class="two">${card("Where they are", `<div class="body">${n.screens.length ? breakHTML(n.screens.map((s) => ({ label: s.name, n: s.people }))) : `<div class="empty">Nobody in the last half hour.</div>`}</div>`, "screens, the last 30 minutes")}
      ${card("Where they came from", `<div class="body">${n.sources.length ? breakHTML(n.sources.map((s) => ({ label: s.name, n: s.people }))) : `<div class="empty">Nobody in the last half hour.</div>`}</div>`, "the last 30 minutes")}</div>`;
};

ATABV.arrive = () => {
  const v = D.visits; if (!v) return aOwner;
  const n = v.now, b = v.before, on = AF.source || AF.device || AF.who, labels = dayLabels(v.start, v.days);
  const opt = (val, label, cur) => `<option value="${esc(val)}"${cur === val ? " selected" : ""}>${esc(label)}</option>`;
  const filters = `<div class="afil"><select class="in" data-af="source" aria-label="Where from">${opt("", "Every source", AF.source)}${v.sources.map((s) => opt(s, s, AF.source)).join("")}</select>
    <select class="in" data-af="device" aria-label="Phone or computer">${opt("", "Phone and computer", AF.device)}${opt("phone", "Phone", AF.device)}${opt("computer", "Computer", AF.device)}</select>
    <select class="in" data-af="who" aria-label="New or returning">${opt("", "New and returning", AF.who)}${opt("new", "New visitors", AF.who)}${opt("back", "Returning visitors", AF.who)}</select>
    ${on ? `<button class="btn ghost sm" id="afclear">Clear</button>` : ""}</div>`;
  const since = v.since && v.since > v.start ? `<p class="mono" style="margin:8px 2px 0">Visits are counted from ${new Date(v.since).toLocaleDateString([], { month: "short", day: "numeric" })}. Before that, LABS didn't keep them.</p>` : "";
  const table = (name, col, rows, withJoin = true) => { const head = [col, "Visits", "Visitors", "New", "Left straight away", "Screens a visit", ...(withJoin ? ["Joined"] : [])];
    const data = rows.map((r) => [r.name, r.visits, r.visitors, r.fresh, r.bounce + "%", r.screens, ...(withJoin ? [r.joined] : [])]);
    return card(name, `<div class="body">${aTbl(head, data.map((r) => [esc(r[0]), ...r.slice(1).map((x) => (typeof x === "number" ? num(x) : x))]), "No visits in this period.")}</div>`, csvBtn(name, head, data)); };
  return `${filters}<div class="grid g2 g4" style="margin-top:10px">
    ${kpiHTML("Visits", num(n.visits), { now: n.visits, before: b.visits, share: `${n.screens} screens a visit`, series: v.series.visits })}
    ${kpiHTML("Visitors", num(n.visitors), { now: n.visitors, before: b.visitors, share: `${num(n.fresh)} new · ${num(Math.max(0, n.visitors - n.fresh))} returning`, series: v.series.visitors })}
    ${kpiHTML("Left straight away", n.bounce + "%", { share: `saw one screen and went · ${b.visits ? b.bounce + "% before" : "nothing to compare yet"}` })}
    ${kpiHTML("A visit lasts", aSecs(n.secs), { share: `the middle visit · ${num(n.joined)} ended in a Join` })}</div>${since}
    ${card("Visits, by day", `<div class="body">${lineHTML(v.series.visits, v.prev.visits, { labels, h: 190 })}<div class="leg"><span><i></i>${RFROM ? "These days" : "Last " + v.days + " days"}</span><span><i class="pv"></i>The ${v.days} before</span></div></div>`,
      csvBtn("Visits by day", ["Day", "Visits", "Visitors"], labels.map((l, i) => [l, v.series.visits[i], v.series.visitors[i]])))}
    ${table("Where from", "Source", v.bySource)}
    <div class="two">${table("Campaigns", "Tag on the link", v.byCampaign)}${table("The link they came in on", "Link", v.byLanding)}</div>
    <div class="two">${table("Phone or computer", "Device", v.byDevice, false)}${table("Countries", "Country", v.byCountry, false)}</div>
    <p class="mono" style="margin-top:10px">A campaign shows when a link carries a tag: tnllabs.com/?utm_source=ig&amp;utm_campaign=music-open</p>`;
};

ATABV.join = () => {
  const p = D.pulse, A = D.audience, F = D.funnel, IC = D.insConv, IR = D.insRet; if (!p || !A || !F || !IC || !IR) return aOwner;
  const n = p.now, b = p.before, DO = IC.dropOffs, back = IR.cameBack.after7Days;
  const step = (name) => (IC.steps.find((x) => x.step.startsWith(name)) || { members: 0, pct: 0 });
  const stops = [["Never posted", DO.neverPosted.members], ["Joined and only looked", DO.joinedAndOnlyLooked.members], ["Voted, never posted", DO.votedButNeverPosted.members], ["Voted, never entered", DO.votedButNeverEntered.members], ["Posted once, then went quiet", DO.postedOnceThenQuiet.members]];
  const waysHead = ["Came from", "Joined", "Voted", "Posted", "Came back"];
  return `<div class="grid g2 g4">
    ${kpiHTML("Joined", num(n.signups), { now: n.signups, before: b.signups, share: `${num(A.members)} members in all` })}
    ${kpiHTML("Email confirmed", num(A.verified), { share: `${pct(A.verified, A.members)} reachable without Instagram` })}
    ${kpiHTML("Posted", num(step("Posted").members), { share: `${step("Posted").pct}% of the ${num(IC.joined)} who joined in ${IC.windowDays} days` })}
    ${kpiHTML("Came back", back.eligible ? back.pct + "%" : "—", { share: back.eligible ? `${num(back.cameBack)} of the ${num(back.eligible)} who joined a week or more ago` : "too soon to say" })}</div>
    ${card("From joining to a sale", `<div class="body">${funnelHTML(F.steps)}</div>`, "members, all time " + csvBtn("From joining to a sale", ["Step", "Members", "Share"], F.steps.map((s) => [s.label, s.n, s.pct + "%"])))}
    ${card("Where new members stop", `<div class="body">${aTbl(["They…", "Members", "Of those who joined"], stops.map(([l, v]) => [l, num(v), pct(v, IC.joined)]))}</div>`, `of the ${num(IC.joined)} who joined in ${IC.windowDays} days`)}
    ${card("Ways in", `<div class="body">${aTbl(waysHead, IC.waysIn.slice(0, 10).map((w) => [esc(w.wayIn), num(w.joined), w.votedPct + "%", w.postedPct + "%", w.cameBackPct + "%"]), "No one joined in this period.")}</div>`,
      "which ways in bring members who vote, post and come back " + csvBtn("Ways in", waysHead, IC.waysIn.map((w) => [w.wayIn, w.joined, w.votedPct + "%", w.postedPct + "%", w.cameBackPct + "%"])))}`;
};
