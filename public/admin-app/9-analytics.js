/* LABS admin v5.0 — 2026-11-15 ("improve the admin dashboard to meet Google level analytics — from the data
   collection to how it's organised, categorised and worded. Streamline everything."): Analytics follows the
   member's path, one question a tab —
     Now     who's here?                 the last 5 and 30 minutes, today so far
     Arrive  where do people come from?  visits, visitors, sources, campaigns, links, devices, countries (filters)
     Join    do visitors become members? joined, the path to a sale, where new members stop, ways in
     Use     what do they do?            took part, opened the app, screens, where they go next, what they don't finish
     Make    do they post?               work, feedback, votes, labs, #tags
     Stay    do they come back?          back after a day, a week, a month — by the week they joined
     Trade   does it earn?               sales, orders, fees, by seller
   Arrive and Use were Echo's alone to read until now (server/ui-signals). Any dates (1-range.js); most
   tables download as a spreadsheet. The tabs are drawn in 9-analytics2-arrive.js (Now · Arrive · Join) and
   9-analytics3-use.js (Use · Make · Stay · Trade); this file is the shell, the loaders and the shared pieces.
   v4.2 — 2026-11-15 (LABS's own words, What the numbers mean). v4.0 — 2026-10-20. */
let ATAB = "arrive", AF = { source: "", device: "", who: "" }, ANOWT = null;
const ATABS = [["now", "Now"], ["arrive", "Arrive"], ["join", "Join"], ["use", "Use"], ["make", "Make"], ["stay", "Stay"], ["trade", "Trade"]];
const ASAYS = { now: "Who's here?", arrive: "Where do people come from?", join: "Do visitors become members?", use: "What do they do?", make: "Do they post?", stay: "Do they come back?", trade: "Does it earn?" };
const AOLD = { members: "use", reach: "join", commerce: "trade", content: "make" };   // the tabs' names before the path
const insDays = () => (RANGE <= 7 ? 7 : RANGE <= 30 ? 30 : 90);   // the insight windows: members who joined in the last 7, 30 or 90 days
const uiDaysQ = () => "?days=" + Math.max(1, Math.min(90, RANGE));
/* what each tab reads; a route a Mod can't open comes back empty and its cards say so */
const ANEED = {
  now: { now: () => "/api/admin/now?tz=" + new Date().getTimezoneOffset() },
  arrive: { visits: () => `/api/admin/visits?${rangeQ()}&source=${encodeURIComponent(AF.source)}&device=${AF.device}&who=${AF.who}` },
  join: { pulse: pulseURL, audience: () => pulseURL().replace("/pulse", "/audience"), funnel: () => "/api/admin/funnel", insConv: () => "/api/admin/insights/conversion?days=" + insDays(), insRet: () => "/api/admin/insights/retention?days=" + insDays() },
  use: { pulse: pulseURL, series: () => pulseURL().replace("/pulse", "/series"), audience: () => pulseURL().replace("/pulse", "/audience"), visits: () => `/api/admin/visits?${rangeQ()}`,
    uiScreens: () => "/api/admin/ui/screens" + uiDaysQ(), uiPaths: () => "/api/admin/ui/paths" + uiDaysQ(), uiFlows: () => "/api/admin/ui/flows" + uiDaysQ(), uiTaps: () => "/api/admin/ui/taps" + uiDaysQ() },
  make: { pulse: pulseURL, series: () => pulseURL().replace("/pulse", "/series"), dir: () => pulseURL().replace("/pulse", "/direction"), audience: () => pulseURL().replace("/pulse", "/audience") },
  stay: { insRet: () => "/api/admin/insights/retention?days=" + insDays(), retention: () => "/api/admin/retention" },
  trade: { series: () => pulseURL().replace("/pulse", "/series"), market: () => "/api/admin/market" },
};
LOADERS.analytics = async () => {
  if (AOLD[ATAB]) ATAB = AOLD[ATAB];
  const tab = ATAB, need = Object.entries(ANEED[tab]);
  const got = await Promise.all([...need.map(([, url]) => req(url()).catch(() => false)), D.network ? null : nwLoad(),
    D.measures ? null : req("/api/admin/measures").then((r) => { D.measures = r.measures; }).catch(() => {})]);
  need.forEach(([k], i) => { D[k] = got[i]; });
  D.aready = tab;
};
/* shared pieces */
const aTbl = (head, rows, empty = "Nothing in this period.") => (rows.length ? `<table class="tbl"><thead><tr>${head.map((h, i) => `<th${i ? ' class="num"' : ""}>${h}</th>`).join("")}</tr></thead><tbody>${rows.map((r) => `<tr>${r.map((c, i) => `<td${i ? ' class="num"' : ""}>${c}</td>`).join("")}</tr>`).join("")}</tbody></table>` : `<div class="empty">${empty}</div>`);
const aOwner = `<div class="empty">This one is for the owner.</div>`;
const aSecs = (s) => (s >= 60 ? `${Math.floor(s / 60)}m ${String(s % 60).padStart(2, "0")}s` : `${s || 0}s`);
const aChart = (S, title, key, fmt = num, sub = "") => card(title, `<div class="body">${lineHTML(S.series[key], S.prev[key], { labels: dayLabels(S.start, S.days), fmt, h: 190 })}<div class="leg"><span><i></i>${RFROM ? "These days" : "Last " + S.days + " days"}</span><span><i class="pv"></i>The ${S.days} before</span></div></div>`, sub);
const aScreen = (s) => { const hit = D.uiScreens && D.uiScreens.screens && D.uiScreens.screens.find((x) => x.screen === s); return esc(hit ? hit.name : s); };
/* the dictionary, printed: each number's name and the one line saying what it counts */
const meansHTML = () => (D.measures && D.measures.length ? `<div style="margin-top:14px">${card("What the numbers mean", `<div class="body"><table class="tbl"><tbody>${D.measures.map((m) => `<tr><td style="white-space:nowrap;vertical-align:top"><b>${esc(m.name)}</b></td><td>${esc(m.says)}</td></tr>`).join("")}</tbody></table></div>`, "one meaning each, everywhere in the admin")}</div>` : "");
VIEWS.analytics = () => {
  if (AOLD[ATAB]) ATAB = AOLD[ATAB];
  const keys = Object.keys(ANEED[ATAB]), ready = keys.every((k) => D[k] !== undefined && D[k] !== null);
  const head = `${pageHead("Analytics", "How LABS is doing, along a member's path", ATAB === "now" ? "" : rangeHTML())}${pathCardHTML()}${subTabs(ATABS, ATAB, "data-atab")}<p class="dim aq">${ASAYS[ATAB]}</p>`;
  return `${head}<div style="margin-top:10px">${ready ? ATABV[ATAB]() : askel()}</div>${ready ? meansHTML() : ""}`;
};
const ATABV = {};   // each tab's drawing: 9-analytics2-arrive.js, 9-analytics3-use.js
WIRES.analytics = () => {
  pathWire();   // the member's path, a spinning model at the front (2026-11-04)
  $$("[data-atab]").forEach((b) => b.onclick = () => { ATAB = b.dataset.atab; for (const k of Object.keys(ANEED[ATAB])) if (D[k] === false) D[k] = null; paint(); scrollTo(0, 0); load(); });
  $$("[data-tagf]").forEach((b) => b.onclick = () => { CTAG = b.dataset.tagf; CLAB = ""; CKIND = ""; CQ = ""; D.posts = null; go("content"); });
  $$("[data-af]").forEach((s) => s.onchange = () => { AF[s.dataset.af] = s.value; load(); });
  const clr = $("#afclear"); if (clr) clr.onclick = () => { AF = { source: "", device: "", who: "" }; load(); };
  /* Now keeps itself fresh while it's the tab in front */
  clearTimeout(ANOWT); if (ATAB === "now") ANOWT = setTimeout(() => { if (TAB === "analytics" && ATAB === "now" && document.visibilityState === "visible" && !$(".scrim,.modal")) load(); }, 20000);
};
