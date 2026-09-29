/* TNL LABS admin v2.0 — 2026-09-29. Today: what needs you, then how it's going. */
let METRIC = "active";
const METRICS = [["active", "Active members"], ["posts", "Posts"], ["messages", "Messages"], ["signups", "New members"], ["gmv", "Sales"]];

LOADERS.today = async () => { D.pulse = await req(pulseURL()); };

VIEWS.today = () => {
  const p = D.pulse;
  if (!p) return `<div class="empty">Loading…</div>`;
  const n = p.now, b = p.before, s = p.series, labels = dayLabels(p.start, p.days);
  const kpi = (k, v, before, spark, fmt = num, sub) => `<div class="kpi"><div class="k">${k}</div><div class="v">${fmt(v)}</div>
    ${sub || delta(v, before, fmt)}${spark ? sparkHTML(spark) : ""}</div>`;
  return `
  <div class="row sp wrapx"><h1 style="font-size:22px">Today</h1>
    <div class="filters">${[7, 30, 90].map((d) => `<button class="pill sm ${RANGE === d ? "on" : ""}" data-range="${d}">${d} days</button>`).join("")}</div></div>

  <h2 class="sec">Needs you</h2>
  <div class="panel needs">${p.inbox.length ? p.inbox.map(needHTML).join("") : `<div class="clear">${I.check} Nothing waiting. Go make something.</div>`}</div>

  <h2 class="sec">Last ${p.days} days <span class="mono">compared with the ${p.days} before</span></h2>
  <div class="grid g2 g4">
    ${kpi("Active members", n.active, b.active, s.active, num)}
    ${kpi("New members", n.signups, b.signups, s.signups)}
    ${kpi("Posts", n.posts, b.posts, s.posts)}
    ${kpi("Messages", n.messages, b.messages, s.messages)}
    ${kpi("Feedback given", n.feedback, b.feedback, null, num, `<span class="d">likes, comments and reactions · ${deltaText(n.feedback, b.feedback)}</span>`)}
    ${kpi("Collabs confirmed", n.collabs, b.collabs, null, num, `<span class="d">${num(p.totals.collabs)} all time · ${deltaText(n.collabs, b.collabs)}</span>`)}
    ${kpi("Sales", n.gmv, b.gmv, s.gmv, money, `<span class="d">${n.orders} order${n.orders === 1 ? "" : "s"} · ${deltaText(n.gmv, b.gmv, money)}</span>`)}
    ${kpi("Commission (est.)", n.commission, b.commission, null, money)}
  </div>
  <p class="mono" style="margin-top:8px">${num(p.seen)} of ${num(p.totals.members)} members opened the app in this period (counted since Sep 29) · active = posted, gave feedback, reacted or messaged</p>

  <div class="split">
    <div>
      <h2 class="sec">Every day</h2>
      <div class="filters" style="margin-bottom:8px">${METRICS.map(([k, l]) => `<button class="pill sm ${METRIC === k ? "on" : ""}" data-metric="${k}">${l}</button>`).join("")}</div>
      <div class="chart">${barsHTML(s[METRIC], { labels, fmt: METRIC === "gmv" ? money : num })}</div>

      <h2 class="sec">The collab loop <span class="mono">members, all time</span></h2>
      <div class="panel">${loopHTML(p.loop)}</div>
    </div>
    <div>
      <h2 class="sec">Labs</h2>
      <div class="panel">${p.labs.length ? `<table class="tbl"><thead><tr><th>Lab</th><th class="num">Posts</th><th class="num">People</th><th class="num">Last</th></tr></thead>
        <tbody>${p.labs.map((l) => `<tr><td>${esc(chName(l.channel))}</td><td class="num">${l.posts}</td><td class="num">${l.people}</td><td class="num dim">${ago(l.last)}</td></tr>`).join("")}</tbody></table>`
        : `<div class="empty">No lab posts in this period.</div>`}</div>

      <h2 class="sec">Most active</h2>
      <div class="list">${p.top.length ? p.top.map((u) => `<button class="li" data-person="${esc(u.username)}">${av(u)}
        <span class="b"><b>${esc(u.displayName || u.username)}</b><span>@${esc(u.username)}</span></span><span class="r">${u.n} actions</span></button>`).join("")
        : `<div class="empty">Nobody yet.</div>`}</div>
    </div>
  </div>`;
};

function needHTML(it) {
  const ppl = it.people && it.people.length ? `<div class="ppl">${it.people.slice(0, 12).map((u) =>
    `<button class="chip" data-person="${esc(u)}"><span class="av">${esc(u.slice(0, 2).toUpperCase())}</span>@${esc(u)}</button>`).join("")}</div>` : "";
  const cta = it.kind === "welcome" ? `<button class="btn sm ghost" data-welcome="${esc(it.people.join(","))}">${I.msg} Say hi</button>`
    : `<button class="btn sm ghost" data-go="${it.go}">Open ${I.chev}</button>`;
  return `<div class="need ${it.level}"><span class="dot"></span><div class="t">${esc(it.text)}${ppl}</div>${cta}</div>`;
}

/* The loop the business runs on. Each bar is everyone who's done that step;
   under it, who did the step before but not this one — the people to nudge. */
function loopHTML(steps) {
  const top = Math.max(1, steps[0].n);
  return `<div class="loop">${steps.map((st, i) => `
    <div class="step"><span>${esc(st.label)}</span><span class="tr"><i style="width:${Math.round((st.n / top) * 100)}%"></i></span><span class="n">${st.n}</span></div>
    ${st.stuckCount ? `<div class="stuck">${st.stuckCount} did “${esc(steps[i - 1].label.toLowerCase())}” but not this:
      ${st.stuck.slice(0, 8).map((u) => `<button class="chip" data-person="${esc(u.username)}">${av(u)}@${esc(u.username)}</button>`).join("")}${st.stuckCount > 8 ? ` +${st.stuckCount - 8}` : ""}</div>` : ""}`).join("")}
  </div>`;
}

WIRES.today = () => {
  $$("[data-range]").forEach((b) => b.onclick = () => { RANGE = +b.dataset.range; try { localStorage.setItem("tnl-admin-range", RANGE); } catch (e) {} D.pulse = null; paint(); load(); });
  $$("[data-metric]").forEach((b) => b.onclick = () => { METRIC = b.dataset.metric; paint(); });
  $$("[data-welcome]").forEach((b) => b.onclick = async () => {
    const who = b.dataset.welcome.split(",");
    const text = await promptIt(`Say hi to ${who.length} new member${who.length === 1 ? "" : "s"}`, { multi: true, ok: "Send",
      body: "Lands as a DM from you, one chat each.", value: "Welcome to the lab — glad you're here. What are you working on right now?" });
    if (!text || !text.trim()) return;
    let sent = 0;
    for (const u of who) { try { await req("/api/chats/with/" + encodeURIComponent(u), { method: "POST", body: { body: text.trim() } }); sent++; } catch (e) {} }
    toast(`Sent to ${sent} of ${who.length}`);
  });
};
