/* TNL LABS admin v3.0 — 2026-10-09. Today, for the app's direction: labs
   are places (genres explained by #tags), the tournament is the centre,
   Instagram brings people in and the app is where they take part.
   What needs you → the tournament → how it's going → how people take part
   → the labs and their #tags. Numbers: /api/admin/pulse + /api/admin/direction. */
let METRIC = "active";
const METRICS = [["active", "Active members"], ["work", "Work posted"], ["votes", "Tournament votes"], ["signups", "New members"], ["gmv", "Sales"]];
const WAYS = { build: "build", talk: "talk", feedback: "learn", compete: "compete", collab: "collaborate", sell: "sell" };

LOADERS.today = async () => {
  const [p, d] = await Promise.all([req(pulseURL()), req(pulseURL().replace("/pulse", "/direction"))]);
  D.pulse = p; D.dir = d;
};

VIEWS.today = () => {
  const p = D.pulse, d = D.dir;
  if (!p || !d) return `<div class="empty">Loading…</div>`;
  const n = p.now, b = p.before, s = { ...p.series, votes: d.series.votes }, labels = dayLabels(p.start, p.days);
  const kpi = (k, v, before, spark, fmt = num, sub) => `<div class="kpi"><div class="k">${k}</div><div class="v">${fmt(v)}</div>
    ${sub || delta(v, before, fmt)}${spark ? sparkHTML(spark) : ""}</div>`;
  const needs = [...p.inbox, ...d.needs];
  return `
  <div class="row sp wrapx"><h1 style="font-size:22px">Today</h1>
    <div class="filters">${[7, 30, 90].map((x) => `<button class="pill sm ${RANGE === x ? "on" : ""}" data-range="${x}">${x} days</button>`).join("")}</div></div>

  <h2 class="sec">Needs you</h2>
  <div class="panel needs">${needs.length ? needs.map(needHTML).join("") : `<div class="clear">${I.check} Nothing waiting. Go make something.</div>`}</div>

  <h2 class="sec">The tournament <span class="mono">votes only count in the app</span></h2>
  ${tourHTML(d.tournament)}

  <h2 class="sec">Last ${p.days} days <span class="mono">compared with the ${p.days} before</span></h2>
  <div class="grid g2 g4">
    ${kpi("Active members", n.active, b.active, s.active)}
    ${kpi("New members", n.signups, b.signups, s.signups)}
    ${kpi("Work posted", n.work, b.work, s.work)}
    ${kpi("Tournament votes", d.votes.now, d.votes.before, s.votes)}
    ${kpi("Feedback given", n.feedback, b.feedback, null, num, `<span class="d">likes, comments and reactions · ${deltaText(n.feedback, b.feedback)}</span>`)}
    ${kpi("Collabs confirmed", n.collabs, b.collabs, null, num, `<span class="d">${num(p.totals.collabs)} all time · ${deltaText(n.collabs, b.collabs)}</span>`)}
    ${kpi("Sales", n.gmv, b.gmv, s.gmv, money, `<span class="d">${n.orders} order${n.orders === 1 ? "" : "s"} · ${deltaText(n.gmv, b.gmv, money)}</span>`)}
    ${kpi("Commission (est.)", n.commission, b.commission, null, money)}
  </div>
  <p class="mono" style="margin-top:8px">${num(p.seen)} of ${num(p.totals.members)} members opened the app in this period (counted since Sep 29) · active = posted, gave feedback, reacted, voted or messaged</p>

  <div class="split">
    <div>
      <h2 class="sec">Every day</h2>
      <div class="filters" style="margin-bottom:8px">${METRICS.map(([k, l]) => `<button class="pill sm ${METRIC === k ? "on" : ""}" data-metric="${k}">${l}</button>`).join("")}</div>
      <div class="chart">${barsHTML(s[METRIC] || [], { labels, fmt: METRIC === "gmv" ? money : num })}</div>

      <h2 class="sec">How people take part <span class="mono">members, all time</span></h2>
      <div class="panel">${partHTML(d.takingPart)}</div>
    </div>
    <div>
      <h2 class="sec">Labs <span class="mono">this period · tap for the posts</span></h2>
      <div class="panel">${labsHTML(d.labs)}</div>

      <h2 class="sec">#tags people are using</h2>
      <div class="panel">${d.tags.length ? `<div class="tgs">${d.tags.map((t) => `<button class="chip tg" data-tagf="${esc(t.tag)}" title="${esc(t.labs.map(labTitle).join(", "))}">#${esc(t.tag)} <span>${t.count}</span></button>`).join("")}</div>`
        : `<div class="empty">No #tags in this period yet.</div>`}</div>

      <h2 class="sec">Most active</h2>
      <div class="list">${p.top.length ? p.top.map((u) => `<button class="li" data-person="${esc(u.username)}">${av(u)}
        <span class="b"><b>${esc(u.displayName || u.username)}</b><span>@${esc(u.username)}</span></span><span class="r">${u.n} actions</span></button>`).join("")
        : `<div class="empty">Nobody yet.</div>`}</div>
    </div>
  </div>`;
};

const labTitle = (id) => (id === "profile" ? "profiles" : "// " + ((D.dir && D.dir.labs.find((l) => l.id === id)) || { name: id }).name);
const leftText = (ms) => (ms < 3600000 ? Math.max(1, Math.round(ms / 60000)) + "m" : ms < 2 * 86400000 ? Math.round(ms / 3600000) + "h" : Math.round(ms / 86400000) + " days");

function tourHTML(T) {
  if (!T) return `<div class="panel"><div class="clear">No tournament yet. <button class="btn sm" data-go="events">Set one up ${I.chev}</button></div></div>`;
  const ph = T.phase, left = ph.end ? ph.end - Date.now() : null;
  const stage = ph.phase === "upcoming" ? (ph.end ? "Opens in " + leftText(ph.end - Date.now()) : "Not scheduled")
    : ph.phase === "results" ? "Finished" : `${phName(ph)}${left > 0 ? " · ends in " + leftText(left) : ""}`;
  const pub = T.slug ? `/e/${encodeURIComponent(T.slug)}${T.format === "poll" ? "/board" : ""}` : "";
  return `<div class="panel tour">
    <div class="row sp wrapx" style="gap:10px"><div style="min-width:0"><b style="font-size:16px">${esc(T.title)}</b>${T.published ? "" : `<span class="tag">draft</span>`}
      <div class="dim" style="font-size:13px;margin-top:2px">${esc(stage)}${T.prize ? " · prize: " + esc(T.prize) : ""}</div></div>
      <div class="row" style="gap:6px">${T.published && pub ? `<a class="btn ghost sm" href="${pub}" target="_blank">${T.format === "poll" ? "Scoreboard" : "Event page"} ${I.out}</a>` : ""}
        <button class="btn sm" data-ev-open="${T.id}">Run it ${I.chev}</button></div></div>
    <div class="stats">
      <div><b>${num(T.entries)}</b><span>entries</span></div><div><b>${num(T.voters)}</b><span>people voted</span></div>
      <div><b>${num(T.votesDay)}</b><span>votes in 24h · ${num(T.votes)} total</span></div>
    </div>
    <p class="mono" style="margin:0">Instagram is for reach — post the scoreboard and each entry's vote link from Run it → Instagram.</p>
  </div>`;
}

/* Each way to take part: how many members have done it. Under it, who
   joined and hasn't done any of them yet — the people to say hi to. */
function partHTML(tp) {
  const top = Math.max(1, tp.members);
  return `<div class="loop part">${tp.ways.map((w) => `
    <div class="step"><span>${esc(w.label)} <i class="mono">${WAYS[w.key] || ""}</i></span><span class="tr"><i style="width:${Math.round((w.n / top) * 100)}%"></i></span><span class="n">${w.n}</span></div>`).join("")}
    <p class="mono" style="margin:2px 0 0">${num(tp.members)} members · ${Math.round(((tp.members - tp.notYet.n) / top) * 100)}% have taken part</p>
    ${tp.notYet.n ? `<div class="stuck">${tp.notYet.n} haven't taken part yet:
      ${tp.notYet.people.slice(0, 8).map((u) => `<button class="chip" data-person="${esc(u.username)}">${av(u)}@${esc(u.username)}</button>`).join("")}${tp.notYet.n > 8 ? ` +${tp.notYet.n - 8}` : ""}
      <div style="margin-top:8px"><button class="btn sm ghost" data-welcome="${esc(tp.notYet.people.slice(0, 12).map((u) => u.username).join(","))}">${I.msg} Say hi to ${Math.min(12, tp.notYet.n)}</button></div></div>` : ""}
  </div>`;
}

function labsHTML(labs) {
  if (!labs.some((l) => l.work + l.talk)) return `<div class="empty">No lab posts in this period.</div>`;
  return `<table class="tbl"><thead><tr><th>Lab</th><th class="num">Work</th><th class="num">Talk</th><th class="num">People</th></tr></thead>
    <tbody>${labs.map((l) => `<tr class="clk" data-labf="${l.id}"><td><b>${l.id === "profile" ? "Profiles" : "// " + esc(l.name)}</b>
      ${l.tags.length ? `<div class="dim" style="font-size:12px">${l.tags.map((t) => "#" + esc(t.tag)).join(" ")}</div>` : ""}</td>
      <td class="num">${l.work}</td><td class="num">${l.talk}</td><td class="num">${l.people}</td></tr>`).join("")}</tbody></table>`;
}

function needHTML(it) {
  const ppl = it.people && it.people.length ? `<div class="ppl">${it.people.slice(0, 12).map((u) =>
    `<button class="chip" data-person="${esc(u)}"><span class="av">${esc(u.slice(0, 2).toUpperCase())}</span>@${esc(u)}</button>`).join("")}</div>` : "";
  const cta = it.kind === "welcome" ? `<button class="btn sm ghost" data-welcome="${esc(it.people.join(","))}">${I.msg} Say hi</button>`
    : it.event ? `<button class="btn sm ghost" data-ev-open="${it.event}">Open ${I.chev}</button>`
    : `<button class="btn sm ghost" data-go="${it.go}">Open ${I.chev}</button>`;
  return `<div class="need ${it.level}"><span class="dot"></span><div class="t">${esc(it.text)}${ppl}</div>${cta}</div>`;
}

WIRES.today = () => {
  $$("[data-range]").forEach((b) => b.onclick = () => { RANGE = +b.dataset.range; try { localStorage.setItem("tnl-admin-range", RANGE); } catch (e) {} D.pulse = null; paint(); load(); });
  $$("[data-metric]").forEach((b) => b.onclick = () => { METRIC = b.dataset.metric; paint(); });
  $$("[data-ev-open]").forEach((b) => b.onclick = () => { EVID = +b.dataset.evOpen; EVFORM = null; D.event = null; go("events"); });
  $$("[data-labf]").forEach((r) => r.onclick = () => { CLAB = r.dataset.labf; CTAG = ""; CKIND = ""; CQ = ""; D.posts = null; go("content"); });
  $$("[data-tagf]").forEach((b) => b.onclick = () => { CTAG = b.dataset.tagf; CLAB = ""; CKIND = ""; CQ = ""; D.posts = null; go("content"); });
  $$("[data-welcome]").forEach((b) => b.onclick = async () => {
    const who = b.dataset.welcome.split(",");
    const text = await promptIt(`Say hi to ${who.length} member${who.length === 1 ? "" : "s"}`, { multi: true, ok: "Send",
      body: "Lands as a DM from you, one chat each.", value: "Welcome to the lab — glad you're here. What are you working on right now? Post it in your lab with a #tag, and the tournament's on if you want in." });
    if (!text || !text.trim()) return;
    let sent = 0;
    for (const u of who) { try { await req("/api/chats/with/" + encodeURIComponent(u), { method: "POST", body: { body: text.trim() } }); sent++; } catch (e) {} }
    toast(`Sent to ${sent} of ${who.length}`);
  });
};
