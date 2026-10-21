/* LABS admin v4.0 — 2026-10-20. Home: what needs you first (the work queue), then
   this period's numbers with their share, the activity line with last period behind,
   the pieces that did best, the tournament, the labs. v3.1 — 2026-10-14 (page header; the chart's choices sit in its card). Today, for the app's direction: labs
   are places (genres explained by #tags), the tournament is the centre,
   Instagram brings people in and the app is where they take part.
   What needs you → the tournament → how it's going → how people take part
   → the labs and their #tags. Numbers: /api/admin/pulse + /api/admin/direction. */
let METRIC = "active";
const METRICS = [["active", "Active members"], ["work", "Work posted"], ["votes", "Votes"], ["signups", "New members"], ["gmv", "Sales"]];
const WAYS = { build: "build", talk: "talk", feedback: "learn", compete: "compete", collab: "collaborate", sell: "sell" };

LOADERS.home = async () => {
  const q = pulseURL();
  const [p, d, sr, tw] = await Promise.all([req(q), req(q.replace("/pulse", "/direction")), req(q.replace("/pulse", "/series")), req(q.replace("/pulse", "/topwork"))]);
  D.pulse = p; D.dir = d; D.series = sr; D.topwork = tw.work;
};
VIEWS.today = () => VIEWS.home();
VIEWS.home = () => {
  const p = D.pulse, d = D.dir, S = D.series;
  if (!p || !d || !S) return `<div class="empty">Loading…</div>`;
  const n = p.now, b = p.before, labels = dayLabels(p.start, p.days), M = p.totals.members;
  const needs = [...p.inbox, ...d.needs];
  const today = new Date().toLocaleDateString([], { weekday: "long", month: "short", day: "numeric" });
  const work = D.topwork || [];
  return `
  ${pageHead("Home", `${today} · what needs you, then the last ${p.days} days`, rangeHTML())}
  ${card(`Needs you`, `<div class="body"><div class="q">${needs.length ? needs.map(queueHTML).join("") : `<div class="clear">${I.check} Nothing waiting. Go make something.</div>`}</div></div>`, needs.length ? `${needs.length} thing${needs.length === 1 ? "" : "s"}` : "")}
  <div class="grid g2 g4" style="margin-top:12px">
    ${kpiHTML("Active members", num(n.active), { now: n.active, before: b.active, share: `${pct(n.active, M)} of ${num(M)} members`, series: S.series.active })}
    ${kpiHTML("New members", num(n.signups), { now: n.signups, before: b.signups, share: `${num(p.seen)} opened the app`, series: S.series.signups })}
    ${kpiHTML("Work posted", num(n.work), { now: n.work, before: b.work, share: `${num(n.feedback)} likes, comments and reactions`, series: S.series.work })}
    ${kpiHTML("Sales", money(n.gmv), { now: n.gmv, before: b.gmv, fmt: money, share: `${n.orders} order${n.orders === 1 ? "" : "s"} · ${money(S.fees.now)} in fees`, series: S.series.gmv })}
  </div>
  <div class="two" style="margin-top:12px">
    <div>${card(`<span class="row wrapx" style="gap:6px">${METRICS.map(([k, l]) => `<button class="pill sm ${METRIC === k ? "on" : ""}" data-metric="${k}">${l}</button>`).join("")}</span>`,
      `<div class="body">${lineHTML(S.series[METRIC === "votes" ? "votes" : METRIC === "gmv" ? "gmv" : METRIC], S.prev[METRIC], { labels, fmt: METRIC === "gmv" ? money : num })}
       <div class="leg"><span><i></i>Last ${p.days} days</span><span><i class="pv"></i>The ${p.days} before</span><a data-go="analytics" style="margin-left:auto;text-decoration:underline;cursor:pointer">Analytics ${I.chev}</a></div></div>`)}
      ${card("Top work this period", `<div class="body">${work.length ? `<div class="tw">${work.map((w) => `<a href="/p/${w.id}" target="_blank"><div class="im">${w.img ? `<img src="${esc(w.img)}" alt="" loading="lazy">` : ""}</div>
        <div class="tn"><b>@${esc(w.user.username)}</b> · ${w.likes}♥ ${w.comments}💬${w.shares ? " " + w.shares + "↗" : ""}</div></a>`).join("")}</div>` : `<div class="empty">No work posted in this period.</div>`}</div>`, "likes, comments, shares")}
    </div>
    <div>
      ${card("The tournament", tourHTML(d.tournament).replace('class="panel tour"', 'class="body tour"'), "votes only count in the app")}
      ${card("Labs this period", `<div class="body">${labsHTML(d.labs)}</div>`, "tap for the posts")}
      ${card("How people take part", `<div class="body">${partHTML(d.takingPart)}</div>`, "members, all time")}
    </div>
  </div>`;
};
const labTitle = (id) => (id === "profile" ? "profiles" : "// " + ((D.dir && D.dir.labs.find((l) => l.id === id)) || { name: id }).name);
const leftText = (ms) => (ms < 3600000 ? Math.max(1, Math.round(ms / 60000)) + "m" : ms < 2 * 86400000 ? Math.round(ms / 3600000) + "h" : Math.round(ms / 86400000) + " days");
/* one line of the queue: a count in a circle, what it is, where to act */
function queueHTML(it) {
  const go = it.go === "market" ? "orders" : it.go === "system" ? (it.kind === "unverified" ? "settings" : "health") : it.go === "today" ? "home" : it.go;
  const n = it.n != null ? it.n : (it.kind === "tournament" ? "!" : "•");
  return `<div class="qi ${it.level || "mid"}"><div class="qn">${esc(String(n))}</div><div class="qt"><b>${esc(it.text)}</b>${it.people && it.people.length ? `<span>${it.people.slice(0, 6).map((u) => "@" + esc(u)).join(", ")}${it.people.length > 6 ? " +" + (it.people.length - 6) : ""}</span>` : ""}</div>
    ${it.event ? `<button class="btn ghost sm" data-ev-open="${it.event}">Open ${I.chev}</button>` : go ? `<button class="btn ghost sm" data-go="${esc(go)}">${go === "content" ? "Review" : "Open"} ${I.chev}</button>` : ""}</div>`;
}
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

WIRES.home = () => {
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
