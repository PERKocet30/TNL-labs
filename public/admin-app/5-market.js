/* TNL LABS admin v2.0 — 2026-09-29. Market: is money moving, and is anything stuck. */
let OSTAT = "all";
LOADERS.market = async () => {
  const [m, o] = await Promise.all([req("/api/admin/market"), req("/api/admin/orders")]);
  D.market = m; D.orders = o.orders;
};
const STATUS = { pending: "Awaiting payment", paid: "Paid — ship it", shipped: "Shipped", complete: "Delivered", cancelled: "Cancelled" };

VIEWS.market = () => {
  const m = D.market, O = D.orders;
  if (!m) return `<div class="empty">Loading…</div>`;
  const labels = m.daily.map((x) => x.d);
  const rows = (O || []).filter((o) => OSTAT === "all" || o.status === OSTAT);
  const k = (label, v, sub) => `<div class="kpi"><div class="k">${label}</div><div class="v">${v}</div><div class="d">${sub}</div></div>`;
  return `
  <h1 style="font-size:22px">Market</h1>
  <div class="grid g2 g4" style="margin-top:14px">
    ${k("Sales, all time", money(m.gmv), `${m.orders} order${m.orders === 1 ? "" : "s"} · ${money(m.aov)} average`)}
    ${k("Commission (est.)", money(m.revenue), "tiered by seller level")}
    ${k("Listed now", num(m.active), `${m.sellers} seller${m.sellers === 1 ? "" : "s"} · ${m.connected} with payouts on`)}
    ${k("To ship", num(m.unshipped), m.reviews ? `${m.reviews} review${m.reviews === 1 ? "" : "s"} · ${m.avgRating.toFixed(1)} avg` : "no reviews yet")}
  </div>
  <h2 class="sec">Sales per day <span class="mono">last 14 days</span></h2>
  <div class="chart">${barsHTML(m.daily.map((x) => x.gmv), { labels, fmt: money, h: 120 })}</div>

  <h2 class="sec">Orders</h2>
  <div class="filters" style="margin-bottom:8px">${["all", "paid", "shipped", "complete", "pending", "cancelled"].map((s) =>
    `<button class="pill sm ${OSTAT === s ? "on" : ""}" data-os="${s}">${s === "all" ? "All" : STATUS[s]}${s !== "all" ? ` <span class="dim">${(O || []).filter((o) => o.status === s).length}</span>` : ""}</button>`).join("")}</div>
  <div class="panel scroll">${!O ? `<div class="empty">Loading…</div>` : !rows.length ? `<div class="empty">No orders here.</div>` : `<table class="tbl">
    <thead><tr><th>Item</th><th>Seller</th><th>Buyer</th><th class="num">Total</th><th class="num">Fee</th><th>Status</th><th class="num">When</th></tr></thead>
    <tbody>${rows.map((o) => `<tr><td>${esc(o.title)}</td>
      <td><button data-person="${esc(o.seller)}">@${esc(o.seller)}</button></td><td><button data-person="${esc(o.buyer)}">@${esc(o.buyer)}</button></td>
      <td class="num">${money(o.amount + o.shipping)}</td><td class="num dim">${o.paid ? money(o.fee) + ` <span class="dim">${o.feePct}%</span>` : "—"}</td>
      <td>${o.status === "paid" && Date.now() - o.createdAt > 3 * 86400000 ? `<span class="tag warn">${esc(STATUS[o.status])}</span>` : esc(STATUS[o.status] || o.status)}${o.tracking ? `<div class="mono">${esc(o.tracking)}</div>` : ""}</td>
      <td class="num dim">${ago(o.createdAt)}</td></tr>`).join("")}</tbody></table>`}</div>

  <div class="split">
    <div><h2 class="sec">Top sellers</h2>
      <div class="list">${m.topSellers.length ? m.topSellers.map((s) => `<button class="li" data-person="${esc(s.username)}">${av({ displayName: s.display_name, avatarUrl: s.avatar_url })}
        <span class="b"><b>${esc(s.display_name)}</b><span>@${esc(s.username)} · ${s.sales} sale${s.sales === 1 ? "" : "s"}</span></span><span class="r">${money(s.gross)}</span></button>`).join("") : `<div class="empty">No sales yet.</div>`}</div></div>
    <div><h2 class="sec">Listings nobody looks at <span class="mono">up 2+ weeks</span></h2>
      <div class="list">${m.stale.length ? m.stale.map((l) => `<div class="li"><span class="b"><b>${esc(l.title)}</b><span>@${esc(l.username)} · ${money(l.price_cents)} · ${l.views} view${l.views === 1 ? "" : "s"} · up ${ago(l.created_at)}</span></span>
        <a class="btn ghost sm" href="/m/${l.id}" target="_blank">${I.out}</a><button class="btn danger sm" data-dellist="${l.id}" aria-label="Remove listing">${I.trash}</button></div>`).join("") : `<div class="empty">Nothing stale.</div>`}</div></div>
  </div>`;
};

WIRES.market = () => {
  $$("[data-os]").forEach((b) => b.onclick = () => { OSTAT = b.dataset.os; paint(); });
  $$("[data-dellist]").forEach((b) => b.onclick = async () => {
    if (!(await confirmIt("Remove this listing?", "It comes down from the Market and the seller is told.", { ok: "Remove", danger: true }))) return;
    await act(() => req("/api/admin/listings/" + b.dataset.dellist, { method: "DELETE" }), "Removed"); load();
  });
};
