/* LABS admin — MODS v1.0 — 2026-10-28. Loads right after 1-core.js.
   Two kinds of admin: the owner (everything) and Mods (a tier below,
   server-04-admin-0-mods.js). This page only decides what to SHOW a Mod —
   the server is what actually stops them; hiding a button is not access
   control. A Mod sees Home · Orders · Listings · Sellers · Members ·
   Content · Events · Analytics. Instagram (the inbox), Health, Systems and
   Settings stay with the owner, as do exporting members, messaging a
   group, marking a test order, publishing an event, sign-out, delete and
   private notes. */
let ACCESS = "owner";   // "owner" | "mod" — 3-person.js reads it
const MOD_HIDE = ["instagram", "health", "systems", "settings"];

function asMod() {
  ACCESS = "mod";
  document.body.classList.add("is-mod");
  for (let i = TABS.length - 1; i >= 0; i--) if (MOD_HIDE.includes(TABS[i][0])) TABS.splice(i, 1);
  for (let i = GROUPS.length - 1; i >= 0; i--) { GROUPS[i][1] = GROUPS[i][1].filter((k) => !MOD_HIDE.includes(k)); if (!GROUPS[i][1].length) GROUPS.splice(i, 1); }
  if (MOD_HIDE.includes(TAB)) TAB = "home";
  /* Home's "needs you" items for backups, errors and email point at owner sections */
  const coreGo = window.go;
  window.go = (tab) => MOD_HIDE.includes(OLD_TABS[tab] || tab) ? toast("That one's for the owner.") : coreGo(tab);
}

/* replaces 1-core's boot(): the owner is told by /api/me, a Mod by /api/admin/me */
async function boot() {
  if (!TOKEN) return paint();
  try {
    const d = await req("/api/me"); const u = d && d.user;
    if (u && u.isAdmin) ME = u;
    else if (u) { const m = await req("/api/admin/me").catch(() => null); if (m && m.access === "mod") { ME = u; asMod(); } else ME = null; }
    else ME = null;
  } catch (e) { ME = null; }
  paint(); if (!ME) return;
  load();
  setInterval(() => { if (TAB === "home" && document.visibilityState === "visible" && !$(".scrim,.modal")) load(); }, 60000);
}

/* owner-only buttons on shared screens, out of a Mod's way */
(() => { const s = document.createElement("style");
  s.textContent = `body.is-mod #pcsv, body.is-mod details.more, body.is-mod [data-voidorder],
    body.is-mod label:has(> input[data-f="published"]) { display: none !important; }`;
  document.head.appendChild(s); })();
