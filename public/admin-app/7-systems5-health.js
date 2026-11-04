/* LABS admin — Health · Systems v1.0, 2026-11-04 ("there's better ways to organize this"). One section
   under the hood: Health (6-settings' health tab) and Systems (7-systems) as tabs. An old #systems link,
   or a data-go="systems", opens that tab (SUBTAB, 1-core). Loaded after 7-systems4, so it takes over
   LOADERS/VIEWS/WIRES.health from 6-settings. */
let HS = "health";
const HS_TABS = [["health", "Health"], ["systems", "Systems"]];
const hsPick = () => { if (HS_TABS.some(([k]) => k === SUBTAB)) HS = SUBTAB; };
const hsLoad0 = LOADERS.health;
LOADERS.health = async () => { hsPick(); await (HS === "systems" ? LOADERS.systems() : hsLoad0()); };
VIEWS.health = () => { hsPick(); return `<div class="mkt-tabs">${subTabs(HS_TABS, HS, "data-hs")}</div>${HS === "systems" ? VIEWS.systems() : VIEWS.settings("health")}`; };
WIRES.health = () => {
  $$("[data-hs]").forEach((b) => b.onclick = () => { HS = SUBTAB = b.dataset.hs; try { history.replaceState(null, "", "#" + HS); } catch (e) {} paint(); load(); });
  HS === "systems" ? WIRES.systems?.() : WIRES.settings?.();
};
