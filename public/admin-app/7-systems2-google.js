/* LABS admin · Systems · Google v1.1 — 2026-10-26 (v1.1: the one-time Link to Merchant Center). v1.0 — 2026-10-26. Part 2: how people find LABS on Google Search and how the
   market's pieces do on Google Shopping, with the moves that get more of both (server-10-admin-systems2-google.js).
   Rendered under the Railway/GitHub cards by 7-systems.js. */
LOADERS.systemsGoogle = async () => { D.sysGoogle = await req("/api/admin/systems/google" + (D.systemsFresh ? "?fresh=1" : "")); };
const ggNum = (n) => num(n), ggChg = (c) => c == null ? "" : `<i class="${c > 0 ? "up" : c < 0 ? "dn" : ""}">${c > 0 ? "+" : ""}${c}% vs the 28 days before</i>`;
const ggRowsHTML = (rows, label, right, link) => rows.length ? `<div class="list">${rows.map((r) => `<${link && link(r) ? `a href="${esc(link(r))}" target="_blank" rel="noopener"` : "div"} class="li">
    <span class="b"><b style="font-weight:500;font-size:13px">${esc(label(r))}</b></span><span class="r">${right(r)}</span></${link && link(r) ? "a" : "div"}>`).join("")}</div>` : `<div class="empty">Nothing yet.</div>`;
const GG_TODO = { sitemap: "Search", search: "Search", page: "A page", shopping: "Shopping" };

function sysGoogleHTML() {
  const G = D.sysGoogle;
  if (!G) return `<h2 class="sec">Google</h2><div class="panel"><div class="empty">Loading…</div></div>`;
  if (!G.on) return `<h2 class="sec">Google <span class="mono">Search · Shopping</span></h2><div class="panel">${sysOff("Google", "GOOGLE_SERVICE_ACCOUNT")}</div>`;
  if (G.error) return `<h2 class="sec">Google <span class="mono">${esc(G.account || "")}</span></h2><div class="panel">${sysErr(G.error)}</div>`;
  const S = G.search, P = G.shopping;
  const todo = G.todo && G.todo.length ? `<h2 class="sec">To get more reach <span class="mono">from the numbers below</span></h2><div class="panel"><div class="list">${G.todo.map((t) => `<div class="li">
      <span class="b"><b style="font-weight:500;font-size:13px;white-space:normal">${esc(t.text)}</b><span>${esc(GG_TODO[t.kind] || "")}${t.path ? ` · <a href="${esc(t.path)}" target="_blank" rel="noopener">open it</a>` : ""}</span></span></div>`).join("")}</div></div>` : "";
  const search = () => {
    if (!S || S.error) return `<div class="panel">${sysErr(S ? S.error : "No answer.")}</div>`;
    const T = S.totals, days = S.days || [];
    return `<div class="grid g2 g4">
      ${kpiHTML("Clicks from Google", ggNum(T.clicks), { share: ggChg(T.change.clicks) })}
      ${kpiHTML("Times LABS showed up", ggNum(T.impressions), { share: ggChg(T.change.impressions) })}
      ${kpiHTML("Clicked when shown", T.ctr + "%", { share: `was ${T.prev.ctr}%` })}
      ${kpiHTML("Average spot on the page", T.position ? String(T.position) : "—", { share: T.prev.position ? `was ${T.prev.position}` : "" })}
    </div>
    <div class="panel">${days.length > 1 ? lineHTML(days.map((d) => d.clicks), null, { labels: days.map((d) => d.day.slice(5)), h: 160 }) : `<div class="empty">Not enough days yet.</div>`}
      <p class="dim" style="margin:8px 0 0;font-size:12px">Clicks a day, ${esc(S.range.startDate)} → ${esc(S.range.endDate)} (Google runs two days behind).</p></div>
    <div class="split">
      <div><h2 class="sec">What people searched <span class="mono">clicks · shown</span></h2><div class="panel">${ggRowsHTML(S.queries.slice(0, 12), (r) => r.query, (r) => `${ggNum(r.clicks)} · ${ggNum(r.impressions)}`)}</div>
        <h2 class="sec">Close to page 1 <span class="mono">seen a lot, ranked 5–20</span></h2><div class="panel">${ggRowsHTML(S.closeToTop, (r) => r.query, (r) => `spot ${Math.round(r.position)} · seen ${ggNum(r.impressions)}`)}</div></div>
      <div><h2 class="sec">Pages Google sends people to <span class="mono">clicks · shown</span></h2><div class="panel">${ggRowsHTML(S.pages.slice(0, 12), (r) => r.path || r.url, (r) => `${ggNum(r.clicks)} · ${ggNum(r.impressions)}`, (r) => r.path)}</div>
        <h2 class="sec">Shown a lot, rarely clicked <span class="mono">the title is the fix</span></h2><div class="panel">${ggRowsHTML(S.lowClicks, (r) => r.path || r.url, (r) => `${r.ctr}% of ${ggNum(r.impressions)}`, (r) => r.path)}</div>
        <h2 class="sec">Where from</h2><div class="panel">${breakHTML([...S.devices.map((d) => ({ label: d.device === "mobile" ? "Phones" : d.device === "desktop" ? "Computers" : d.device, n: d.clicks })),
          ...S.countries.slice(0, 4).map((c) => ({ label: c.country, n: c.clicks }))])}</div>
        <h2 class="sec">Sitemaps Google has</h2><div class="panel">${S.sitemaps.length ? `<div class="list">${S.sitemaps.map((m) => `<div class="li"><span class="b"><b style="font-weight:500;font-size:13px">${esc(m.path)}</b>
          <span>${m.submitted ? ggNum(m.submitted) + " pages · " : ""}${m.lastDownloaded ? "read " + ago(m.lastDownloaded) + " ago" : "not read yet"}</span></span>${m.errors ? `<span class="tag warn">${m.errors} errors</span>` : m.pending ? `<span class="tag wait">pending</span>` : `<span class="tag on">ok</span>`}</div>`).join("")}</div>` : `<div class="empty">None. In Search Console → Sitemaps, submit sitemap.xml.</div>`}</div></div>
    </div>`;
  };
  const shopping = () => {
    if (P && P.error && /not registered with the merchant account/i.test(P.error)) return `<div class="panel"><div class="set"><div class="t"><b>One step left: link this Google project to Merchant Center</b>
      <span>Google only takes it from an Admin. In Merchant Center → Access and services, set ${esc(G.account || "the service account")} to <b>Admin</b>, tap Link, then set it back to Standard.</span></div>
      <button class="btn sm" id="ggreg">Link</button></div></div>`;
    if (!P || P.error) return `<div class="panel">${sysErr(P ? P.error : "No answer.")}</div>`;
    const c = P.counts, sev = { DISAPPROVED: ["warn", "not shown"], DEMOTED: ["wait", "shown less"], NOT_IMPACTED: ["", "note"] };
    return `<div class="grid g2 g3">
      ${kpiHTML("On Google Shopping", ggNum(c.live), { share: `of ${ggNum(P.total)} pieces` })}
      ${kpiHTML("Waiting for Google", ggNum(c.pending), { share: "usually 1–3 days" })}
      ${kpiHTML("Not shown", ggNum(c.notShown), { share: c.notShown ? "fix below" : "nothing to fix" })}
    </div>
    <h2 class="sec">What's holding pieces back <span class="mono">grouped by fix</span></h2>
    <div class="panel">${P.issues.length ? `<div class="list">${P.issues.map((g) => { const [cls, word] = sev[g.severity] || ["", "note"];
      return `<div class="li" style="align-items:flex-start"><span class="b"><b style="font-weight:500;font-size:13px;white-space:normal">${esc(g.description)}${g.detail ? ` — <span style="font-weight:400">${esc(g.detail)}</span>` : ""}</b>
        <span style="white-space:normal">${g.count} piece${g.count === 1 ? "" : "s"}${g.attribute ? ` · ${esc(g.attribute)}` : ""} · ${g.fixBy === "you" ? "fix it in the listing" : g.fixBy === "google" ? "Google's side" : ""}: ${g.pieces.map((p) => p.path ? `<a href="${esc(p.path)}" target="_blank" rel="noopener">${esc(p.title)}</a>` : esc(p.title)).join(", ")}${g.count > g.pieces.length ? "…" : ""}</span></span><span class="tag ${cls}">${word}</span></div>`; }).join("")}</div>`
      : `<div class="empty">${P.total ? "Every piece is clean." : "No pieces in Merchant Center yet — link the feed under Products."}</div>`}</div>`;
  };
  return `${todo}
  <h2 class="sec">Google Search <span class="mono">${esc(S && S.site || "")} · last 28 days</span></h2>${search()}
  <h2 class="sec">Google Shopping <span class="mono">Merchant Center ${esc(P && P.merchantId || "")} · free listings</span></h2>${shopping()}
  <p class="dim" style="font-size:12px;margin:10px 0 0">Read as ${esc(G.account || "")}${G.cached ? " · numbers from the last ten minutes" : ""}.</p>`;
}

const ggWire = () => { const b = $("#ggreg"); if (b) b.onclick = async () => { b.disabled = true;
  try { await req("/api/admin/systems/google/register", { method: "POST" }); toast("Linked — reading Merchant Center"); D.systemsFresh = true; D.sysGoogle = null; paint(); load(); }
  catch (e) { toast(e.message); b.disabled = false; } }; };
