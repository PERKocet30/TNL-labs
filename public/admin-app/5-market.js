/* LABS admin — Market v1.0, 2026-11-04 ("there's better ways to organize this"). One section for the shop:
   Orders · Listings · Sellers as tabs, each the page it was (5-orders, 5-listings, 5-sellers). An old
   #orders / #listings / #sellers link, or a data-go to one, opens that tab (SUBTAB, 1-core). */
let MKT = "orders";
const MKT_TABS = [["orders", "Orders"], ["listings", "Listings"], ["sellers", "Sellers"]];
const mktPick = () => { if (MKT_TABS.some(([k]) => k === SUBTAB)) MKT = SUBTAB; };
LOADERS.market = async () => { mktPick(); await LOADERS[MKT](); };
VIEWS.market = () => { mktPick(); return `<div class="mkt-tabs">${subTabs(MKT_TABS, MKT, "data-mkt")}</div>${VIEWS[MKT]()}`; };
WIRES.market = () => {
  $$("[data-mkt]").forEach((b) => b.onclick = () => { MKT = SUBTAB = b.dataset.mkt; try { history.replaceState(null, "", "#" + MKT); } catch (e) {} paint(); load(); });
  WIRES[MKT]?.();
};
