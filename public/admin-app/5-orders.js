/* LABS admin v4.0 — 2026-10-20. Orders: is money moving, is anything stuck.
   Numbers up top with change vs the period before, status tabs with counts,
   a table on a computer that becomes cards with one action on a phone, and
   sales per day with the period before behind. Split from Market (v2.2:
   "Test order…" voids a test, its rep taken back; money is refunded in Stripe). */
let OSTAT = "all";
LOADERS.orders = async () => {
  const [m, o, s] = await Promise.all([req("/api/admin/market"), req("/api/admin/orders"), req(pulseURL().replace("/pulse", "/series"))]);
  D.market = m; D.orders = o.orders; D.series = s;
};
const STATUS = { pending: "Awaiting payment", paid: "Paid — ship it", shipped: "Shipped", complete: "Delivered", cancelled: "Cancelled", void: "Test (voided)" };
const stDot = (o) => o.status === "paid" ? (Date.now() - o.createdAt > 3 * 86400000 ? "bad" : "warn") : ["shipped", "complete"].includes(o.status) ? "ok" : "off";
VIEWS.orders = () => {
  const m = D.market, O = D.orders, S = D.series;
  if (!m || !O || !S) return `<div class="empty">Loading…</div>`;
  const labels = dayLabels(S.start, S.days), now = sum(S.series.orders), before = sum(S.prev.orders), gmv = sum(S.series.gmv), gmvB = sum(S.prev.gmv);
  const rows = O.filter((o) => OSTAT === "all" ? o.status !== "void" : o.status === OSTAT);
  const count = (s) => O.filter((o) => s === "all" ? o.status !== "void" : o.status === s).length;
  const row = (o) => `<tr><td class="cb"><input type="checkbox" data-sel="${o.id}"></td><td>#${o.id}</td><td>${esc(o.title)}</td>
    <td><button data-person="${esc(o.buyer)}">@${esc(o.buyer)}</button></td><td><button data-person="${esc(o.seller)}">@${esc(o.seller)}</button></td>
    <td class="num">${money(o.amount + o.shipping)}</td><td class="num dim">${o.paid ? money(o.fee) + ` <span class="dim">${o.feePct}%</span>` : "—"}</td>
    <td><span class="st ${stDot(o)}"><i></i>${esc(STATUS[o.status] || o.status)}</span>${o.tracking ? `<div class="mono">${esc(o.tracking)}</div>` : ""}</td>
    <td class="num dim">${ago(o.createdAt)}</td><td>${o.status === "void" ? "" : `<button class="btn ghost sm" data-voidorder="${o.id}" data-paid="${o.paid ? 1 : 0}">Test order…</button>`}</td></tr>`;
  const cardRow = (o) => `<div class="c2"><div class="c2b"><b>#${o.id} · ${esc(o.title)}</b><span>@${esc(o.buyer)} → @${esc(o.seller)} · ${money(o.amount + o.shipping)} · ${ago(o.createdAt)}</span>
    <span class="st ${stDot(o)}"><i></i>${esc(STATUS[o.status] || o.status)}</span></div>${o.status === "void" ? "" : `<button class="btn ghost sm c2a" data-voidorder="${o.id}" data-paid="${o.paid ? 1 : 0}">Test…</button>`}</div>`;
  return `
  ${pageHead("Orders", "Every order · is money moving, is anything stuck", rangeHTML())}
  <div class="grid g2 g4">
    ${kpiHTML("Orders", num(now), { now, before, share: `${num(m.orders)} all time`, series: S.series.orders })}
    ${kpiHTML("Sales", money(gmv), { now: gmv, before: gmvB, fmt: money, share: `${money(m.aov)} average order`, series: S.series.gmv })}
    ${kpiHTML("Fees earned", money(S.fees.now), { now: S.fees.now, before: S.fees.before, fmt: money, share: `${money(m.revenue)} all time` })}
    ${kpiHTML("To ship", num(m.unshipped), { share: m.unshipped ? "paid, waiting on the seller" : "nothing waiting", line: m.reviews ? `<div class="s">${m.reviews} review${m.reviews === 1 ? "" : "s"} · ${m.avgRating.toFixed(1)} avg</div>` : "" })}
  </div>
  ${card("Orders", `${subTabs([["all", `All <em>${count("all")}</em>`], ["paid", `Paid, ship it <em>${count("paid")}</em>`], ["shipped", `Shipped <em>${count("shipped")}</em>`], ["complete", `Delivered <em>${count("complete")}</em>`],
      ["pending", `Awaiting payment <em>${count("pending")}</em>`], ["cancelled", `Cancelled <em>${count("cancelled")}</em>`], ["void", `Test <em>${count("void")}</em>`]], OSTAT, "data-os")}
    <div class="body toc">${!rows.length ? `<div class="empty">No orders here.</div>` : `<div class="scroll"><table class="tbl"><thead><tr><th class="cb"></th><th>Order</th><th>Item</th><th>Buyer</th><th>Seller</th><th class="num">Total</th><th class="num">Fee</th><th>Status</th><th class="num">When</th><th></th></tr></thead>
      <tbody>${rows.map(row).join("")}</tbody></table></div><div class="cards2">${rows.map(cardRow).join("")}</div>`}</div>`, `${O.length} most recent`)}
  ${card("Sales per day", `<div class="body">${lineHTML(S.series.gmv, S.prev.gmv, { labels, fmt: money, h: 180 })}<div class="leg"><span><i></i>Last ${S.days} days</span><span><i class="pv"></i>The ${S.days} before</span></div></div>`)}`;
};
WIRES.orders = () => {
  $$("[data-os]").forEach((b) => b.onclick = () => { OSTAT = b.dataset.os; paint(); });
  $$("[data-voidorder]").forEach((b) => b.onclick = async () => {
    const paid = b.dataset.paid === "1";
    if (!(await confirmIt("Mark this as a test order?", "It comes off both people's orders and every sales number, and the rep it gave is taken back. A bag goes together."
      + (paid ? " Money isn't refunded here — if a real payment went through, refund it in Stripe." : ""), { ok: "It was a test", danger: true }))) return;
    await act(() => req("/api/admin/orders/" + b.dataset.voidorder + "/void", { method: "POST" }), "Marked as a test"); load();
  });
};
VIEWS.market = () => VIEWS.orders();
