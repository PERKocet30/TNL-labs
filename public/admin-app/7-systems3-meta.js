/* LABS admin · Systems · Meta v1.0 — 2026-10-26. Part 3: Instagram and Facebook in the Systems page, read-only,
   with the moves that get more reach (server/admin/systems-meta.js). Rendered under Google by 7-systems.js. */
LOADERS.systemsMeta = async () => { D.sysMeta = await req("/api/admin/systems/meta" + (D.systemsFresh ? "?fresh=1" : "")); };
const mtChg = (a, b) => { if (!b) return ""; const c = Math.round(((a - b) / b) * 1000) / 10; return `<i class="${c > 0 ? "up" : c < 0 ? "dn" : ""}">${c > 0 ? "+" : ""}${c}% vs the 28 days before</i>`; };
const MT_KIND = { reel: "Reel", carousel: "Carousel", video: "Video", photo: "Photo" };
const mtHour = (n) => `${((n + 11) % 12) + 1}${n < 12 ? "am" : "pm"}`;
const MT_TODO = { instagram: "Instagram", shop: "Instagram shop" };

function sysMetaHTML() {
  const M = D.sysMeta;
  if (!M) return `<h2 class="sec">Meta</h2><div class="panel"><div class="empty">Loading…</div></div>`;
  if (!M.on) return `<h2 class="sec">Meta <span class="mono">Instagram · Facebook</span></h2><div class="panel">${sysOff("Meta", "META_ACCESS_TOKEN")}</div>`;
  if (M.error) return `<h2 class="sec">Meta <span class="mono">Instagram · Facebook</span></h2><div class="panel">${sysErr(M.error)}</div>`;
  const I = M.instagram, F = M.facebook, S = M.shop;
  const todo = M.todo && M.todo.length ? `<h2 class="sec">To get more reach on Instagram <span class="mono">from the numbers below</span></h2><div class="panel"><div class="list">${M.todo.map((t) => `<div class="li">
      <span class="b"><b style="font-weight:500;font-size:13px;white-space:normal">${esc(t.text)}</b><span>${esc(MT_TODO[t.kind] || "")}${t.url ? ` · <a href="${esc(t.url)}" target="_blank" rel="noopener">open the post</a>` : ""}</span></span></div>`).join("")}</div></div>` : "";
  const ig = () => {
    if (!I || I.error) return `<div class="panel">${sysErr(I ? I.error : "No answer.")}</div>`;
    const T = I.totals, days = I.days || [];
    const post = (p) => `<${p.url ? `a href="${esc(p.url)}" target="_blank" rel="noopener"` : "div"} class="li"><span class="b"><b style="font-weight:500;font-size:13px">${esc(p.caption || MT_KIND[p.kind] || "Post")}</b>
      <span>${esc(MT_KIND[p.kind] || p.kind)} · ${p.at ? ago(p.at) + " ago" : ""} · ${num(p.likes)} likes · ${num(p.comments)} comments</span></span><span class="r">${num(p.reach)} reached<br>${num(p.saves)} saved · ${num(p.shares)} shared</span></${p.url ? "a" : "div"}>`;
    return `<div class="grid g2 g4">
      ${kpiHTML("Followers", num(I.followers), { share: I.netFollowers ? `<i class="${I.netFollowers > 0 ? "up" : "dn"}">${I.netFollowers > 0 ? "+" : ""}${num(I.netFollowers)} in 28 days</i>` : "" })}
      ${kpiHTML("People reached", num(T.reach), { share: mtChg(T.reach, T.reachBefore) })}
      ${kpiHTML("Profile views", num(T.profileViews), { share: mtChg(T.profileViews, T.before.profileViews) })}
      ${kpiHTML("Tapped the link", num(T.linkTaps), { share: mtChg(T.linkTaps, T.before.linkTaps) })}
    </div>
    <div class="panel">${days.length > 1 ? lineHTML(days.map((d) => d.value), null, { labels: days.map((d) => d.day.slice(5)), h: 160 }) : `<div class="empty">Not enough days yet.</div>`}
      <p class="dim" style="margin:8px 0 0;font-size:12px">People reached a day, last 28 days · ${num(T.engaged)} engaged · ${num(T.interactions)} likes, comments, saves and shares.</p></div>
    <div class="split">
      <div><h2 class="sec">Posts that reached most <span class="mono">last 30 posts</span></h2><div class="panel">${I.top.length ? `<div class="list">${I.top.map(post).join("")}</div>` : `<div class="empty">No posts yet.</div>`}</div>
        <h2 class="sec">What kind of post works <span class="mono">people reached, each</span></h2><div class="panel">${I.kinds.length ? breakHTML(I.kinds.map((k) => ({ label: `${MT_KIND[k.kind] || k.kind}s (${k.n})`, n: k.avgReach }))) : `<div class="empty">No posts yet.</div>`}</div></div>
      <div><h2 class="sec">Stories up now</h2><div class="panel">${I.stories.length ? `<div class="list">${I.stories.map((s) => `<${s.url ? `a href="${esc(s.url)}" target="_blank" rel="noopener"` : "div"} class="li"><span class="b"><b style="font-weight:500;font-size:13px">Story · ${s.at ? ago(s.at) + " ago" : ""}</b></span><span class="r">${num(s.reach)} reached · ${num(s.replies)} replies</span></${s.url ? "a" : "div"}>`).join("")}</div>` : `<div class="empty">None up right now.</div>`}</div>
        <h2 class="sec">When followers are online</h2><div class="panel">${I.bestHours.length ? `<div class="set"><div class="t"><b>${I.bestHours.map((h) => mtHour(h.hour)).join(" · ")}</b><span>the busiest hours this week — post then</span></div></div>` : `<div class="empty">Meta hasn't said yet (needs 100+ followers).</div>`}</div>
        <h2 class="sec">Where followers are</h2><div class="panel">${I.where.countries.length ? breakHTML(I.where.countries) : `<div class="empty">Meta hasn't said yet (needs 100+ followers).</div>`}
          ${I.where.cities.length ? `<p class="dim" style="font-size:12px;margin:10px 0 0">Cities: ${I.where.cities.map((c) => esc(c.label)).join(", ")}</p>` : ""}${I.where.ages.length ? `<p class="dim" style="font-size:12px;margin:6px 0 0">Ages: ${I.where.ages.map((a) => `${esc(a.label)} (${num(a.n)})`).join(", ")}</p>` : ""}</div></div>
    </div>`;
  };
  const fb = () => {
    if (!F || F.error) return `<div class="panel">${sysErr(F ? F.error : "No answer.")}</div>`;
    return `<div class="panel"><div class="set"><div class="t"><b>${esc(F.name || M.page.name || "Page")} · ${num(F.followers)} followers</b><span>${num(F.reach)} people reached in 28 days${F.url ? ` · <a href="${esc(F.url)}" target="_blank" rel="noopener">open the Page</a>` : ""}</span></div></div></div>`;
  };
  const shop = () => {
    if (!S) return "";
    if (S.error) return `<h2 class="sec">Instagram shop</h2><div class="panel">${sysErr(S.error)}</div>`;
    const c = S.counts;
    return `<h2 class="sec">Instagram shop <span class="mono">${esc(S.name)} · what can be tagged</span></h2><div class="grid g2 g3">
      ${kpiHTML("Can be tagged", num(c.approved), { share: `of ${num(S.total)} pieces` })}${kpiHTML("Waiting for Meta", num(c.pending), { share: "usually a day" })}${kpiHTML("Rejected", num(c.rejected + c.outdated), { share: c.rejected + c.outdated ? "fix below" : "nothing to fix" })}</div>
    ${S.issues.length ? `<div class="panel"><div class="list">${S.issues.map((g) => `<div class="li" style="align-items:flex-start"><span class="b"><b style="font-weight:500;font-size:13px;white-space:normal">${esc(g.title)}${g.detail ? ` — <span style="font-weight:400">${esc(g.detail)}</span>` : ""}</b>
      <span style="white-space:normal">${g.count} piece${g.count === 1 ? "" : "s"}: ${g.pieces.map((p) => p.path ? `<a href="${esc(p.path)}" target="_blank" rel="noopener">${esc(p.title)}</a>` : esc(p.title)).join(", ")}${g.count > g.pieces.length ? "…" : ""}</span></span><span class="tag warn">rejected</span></div>`).join("")}</div></div>` : ""}`;
  };
  return `${todo}
  <h2 class="sec">Instagram <span class="mono">${I && I.username ? "@" + esc(I.username) : ""} · last 28 days</span></h2>${ig()}
  <h2 class="sec">Facebook</h2>${fb()}
  ${shop()}`;
}
