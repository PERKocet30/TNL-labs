/* LABS admin v4.0 — 2026-10-20. Analytics, in one place: Members (active,
   new, retention, who they are — by what they make, by lab, by hour),
   Reach (the funnel from sign-up to sale; sign-ups by source when the tags
   land), Commerce (sales, fees, by seller), Content (posts by lab, how
   people take part). The date range drives every chart. Studio stats are
   a page of their own (9-studio.js). */
let ATAB = "members";
const ATABS = [["members", "Members"], ["reach", "Reach"], ["commerce", "Commerce"], ["content", "Content"]];
LOADERS.analytics = async () => {
  const q = pulseURL();
  const [p, d, sr, au, fu, re, m] = await Promise.all([req(q), req(q.replace("/pulse", "/direction")), req(q.replace("/pulse", "/series")), req(q.replace("/pulse", "/audience")),
    req("/api/admin/funnel"), req("/api/admin/retention"), req("/api/admin/market")]);
  Object.assign(D, { pulse: p, dir: d, series: sr, audience: au, funnel: fu, retention: re, market: m });
};
VIEWS.analytics = () => {
  const p = D.pulse, d = D.dir, S = D.series, A = D.audience, F = D.funnel, R = D.retention, m = D.market;
  if (!p || !d || !S || !A || !F || !R || !m) return `<div class="empty">Loading…</div>`;
  const labels = dayLabels(S.start, S.days), n = p.now, b = p.before;
  const chart = (title, key, fmt = num, sub = "") => card(title, `<div class="body">${lineHTML(S.series[key], S.prev[key], { labels, fmt, h: 190 })}<div class="leg"><span><i></i>Last ${S.days} days</span><span><i class="pv"></i>The ${S.days} before</span></div></div>`, sub);
  const hour = (h) => (h % 12 || 12) + (h < 12 ? "am" : "pm");
  const tabs = {
    members: () => `<div class="grid g2 g4">
      ${kpiHTML("Active", num(n.active), { now: n.active, before: b.active, share: `${pct(n.active, A.members)} of ${num(A.members)}`, series: S.series.active })}
      ${kpiHTML("New", num(n.signups), { now: n.signups, before: b.signups, share: `${num(A.members)} members in all`, series: S.series.signups })}
      ${kpiHTML("Active in 30 days", num(A.active30), { share: `${pct(A.active30, A.members)} · the number to protect (≥50%)` })}
      ${kpiHTML("Email confirmed", num(A.verified), { share: `${pct(A.verified, A.members)} reachable without Instagram` })}</div>
      <div class="two">${chart("Active members, by day", "active")}${chart("New members, by day", "signups")}</div>
      <div class="two">${card("What they make", `<div class="body">${A.byRole.length ? breakHTML(A.byRole.map((r) => ({ label: r.role, n: r.n }))) : `<div class="empty">No roles picked yet.</div>`}</div>`, "roles members picked")}
        ${card("Active in which lab", `<div class="body">${breakHTML(A.byLab.map((l) => ({ label: l.name, n: l.people })))}</div>`, "people who posted there this period")}</div>
      <div class="two">${card("When they're on the app", `<div class="body">${barsHTML(A.hours, { labels: A.hours.map((_, h) => hour(h)), h: 110 })}</div>`, "activity by hour, your time")}
        ${card("Do new members stay?", `<div class="body"><table class="tbl"><thead><tr><th>Joined</th><th class="num">People</th><th class="num">Still posting</th></tr></thead><tbody>${R.cohorts.map((c) => `<tr><td>${esc(c.week)}</td><td class="num">${c.joined}</td><td class="num">${c.stillPosting} <span class="dim">${c.joined ? c.pct + "%" : ""}</span></td></tr>`).join("")}</tbody></table>
          <p class="mono" style="margin-top:8px">${R.silent.length} never posted · ${R.quiet.length} gone quiet (14+ days) · see Members for who</p></div>`, "by the week they joined")}</div>`,
    reach: () => `<div class="grid g2 g4">
      ${kpiHTML("Members", num(A.members), { share: `${num(A.verified)} with email confirmed` })}
      ${kpiHTML("Opened the app", num(p.seen), { share: `${pct(p.seen, A.members)} of members, this period` })}
      ${kpiHTML("Signed up", num(n.signups), { now: n.signups, before: b.signups })}
      ${kpiHTML("Posted first work", num(n.work ? Math.min(n.signups, n.work) : 0), { share: "new members who posted, this period" })}</div>
      ${card("From sign-up to sale", `<div class="body">${funnelHTML(F.steps)}</div>`, "members, all time")}
      ${card("Sign-ups by source", `<div class="body"><div class="empty">Not tracked yet. Source-tagged links (?src=ig-story, ig-bio, ig-chat, discord) are on the launch plan; this chart fills in once they ship.</div></div>`)}`,
    commerce: () => `<div class="grid g2 g4">
      ${kpiHTML("Sales", money(sum(S.series.gmv)), { now: sum(S.series.gmv), before: sum(S.prev.gmv), fmt: money, series: S.series.gmv })}
      ${kpiHTML("Orders", num(sum(S.series.orders)), { now: sum(S.series.orders), before: sum(S.prev.orders), series: S.series.orders })}
      ${kpiHTML("Fees earned", money(S.fees.now), { now: S.fees.now, before: S.fees.before, fmt: money, share: `${money(m.revenue)} all time` })}
      ${kpiHTML("Average order", money(m.aov), { share: `${num(m.active)} listings live · ${m.connected} can sell` })}</div>
      <div class="two">${chart("Sales, by day", "gmv", money)}${chart("Orders, by day", "orders")}</div>
      ${card("By seller", `<div class="body">${m.topSellers.length ? breakHTML(m.topSellers.map((s) => ({ label: "@" + s.username, n: s.gross })), money) : `<div class="empty">No sales yet.</div>`}</div>`, "gross, all time")}`,
    content: () => `<div class="grid g2 g4">
      ${kpiHTML("Work posted", num(n.work), { now: n.work, before: b.work, series: S.series.work })}
      ${kpiHTML("Everything posted", num(n.posts), { now: n.posts, before: b.posts, share: `${num(n.posts - n.work)} talk`, series: S.series.posts })}
      ${kpiHTML("Feedback", num(n.feedback), { now: n.feedback, before: b.feedback, share: "likes, comments, reactions" })}
      ${kpiHTML("Tournament votes", num(d.votes.now), { now: d.votes.now, before: d.votes.before, series: S.series.votes })}</div>
      <div class="two">${chart("Work posted, by day", "work")}${chart("Votes, by day", "votes")}</div>
      <div class="two">${card("Posts by lab", `<div class="body">${breakHTML(d.labs.map((l) => ({ label: l.name, n: l.work + l.talk })))}</div>`, "this period")}
        ${card("How people take part", `<div class="body">${partHTML(d.takingPart)}</div>`, "members, all time")}</div>
      ${card("#tags people are using", `<div class="body">${d.tags.length ? `<div class="tgs">${d.tags.map((t) => `<button class="chip tg" data-tagf="${esc(t.tag)}">#${esc(t.tag)} <span>${t.count}</span></button>`).join("")}</div>` : `<div class="empty">No #tags in this period.</div>`}</div>`)}
      <p style="margin-top:12px"><button class="btn ghost sm" data-go="studio">Studio stats ${I.chev}</button></p>`,
  };
  return `${pageHead("Analytics", "How LABS is doing, in numbers", rangeHTML())}${subTabs(ATABS, ATAB, "data-atab")}<div style="margin-top:14px">${tabs[ATAB]()}</div>`;
};
WIRES.analytics = () => {
  $$("[data-atab]").forEach((b) => b.onclick = () => { ATAB = b.dataset.atab; paint(); scrollTo(0, 0); });
  $$("[data-tagf]").forEach((b) => b.onclick = () => { CTAG = b.dataset.tagf; CLAB = ""; CKIND = ""; CQ = ""; D.posts = null; go("content"); });
  $$("[data-welcome]").forEach((b) => b.onclick = () => go("home"));
};
