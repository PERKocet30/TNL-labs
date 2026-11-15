/* LABS admin — FIND v1.1 — 2026-11-15 (v1.1: Analytics' tabs follow the member's path — Now · Arrive · Join · Use · Make · Stay · Trade). v1.0 — 2026-11-15 ("the search bar should let you find anything in the dashboard").
   The bar at the top found members only. It finds, in this order:
     · Go to — a page, a tab, a card, a switch or a number, from the dashboard's own map (FIND_MAP, below;
       nothing is asked of the server for these, so they answer as you type);
     · Members — the route it always used (/api/admin/people);
     · Listings, Orders, Work, Tournaments, Knowledge — /api/admin/find (server/admin/find.js; the owner's).
   A result opens the page it lives on, on its tab, already narrowed to it. Enter opens the first; Esc clears.
   It never searches messages, the Instagram inbox, emails or addresses.
   A new page, tab, card or switch gets a line in FIND_MAP (test/find.test.mjs checks the pages and tabs). */
let GQ = "", FIND_ASKED = false;
/* [what you'd type, where it is, the section, how to get to its tab, other words for it] */
const FIND_MAP = [
  ["Echo", "Echo Home", "echohome", null, "ask talk voice brief needs you to-do queue"],
  ["Home", "The full Home", "home", null, "today overview numbers top work"],
  ["Systems", "Systems", "systems", null, "railway github deploy google search shopping instagram facebook connectors keys services map weekly report email me this"],
  ["Market", "Market", "market", null, "shop store"],
  ["Orders", "Market", "orders", null, "sales paid shipped to ship refunds"],
  ["Listings", "Market", "listings", null, "live sold saved no one's looking"],
  ["Sellers", "Market", "sellers", null, "stripe payouts can sell stuck in setup walkthrough short signup"],
  ["Members", "Members", "people", null, "people accounts globe countries suspended verified rep levels export csv broadcast"],
  ["Content", "Content", "content", null, "posts work reports flagged take down"],
  ["Events", "Events", "events", null, "tournament votes entries voters spam judges results"],
  ["Instagram", "Instagram", "instagram", null, "inbox dms"],
  ["Knowledge", "Knowledge", "knowledge", null, "creed voice decisions glossary policies playbooks plan export"],
  ["Help desk", "Help desk", "echo", null, "questions members asked echo handed to you teach answers"],
  ["Analytics", "Analytics", "analytics", null, "numbers stats charts member's path"],
  ["Health", "Health", "health", null, "errors glitches rage taps database storage uploads backups unused files server sentry"],
  ["Settings", "Settings", "settings", () => { SYSTAB = "settings"; }, "switches"],
  ["Backups & email", "Settings", "settings", () => { SYSTAB = "data"; }, "backup download code resend test email"],
  ["Admin log", "Settings", "settings", () => { SYSTAB = "log"; }, "history changes who did what"],
  // Analytics, by tab and card
  ["Now", "Analytics", "analytics", () => { ATAB = "now"; }, "live realtime who's here right now today"],
  ["Arrive", "Analytics", "analytics", () => { ATAB = "arrive"; }, "visits visitors sources traffic acquisition where from"],
  ["Join", "Analytics", "analytics", () => { ATAB = "join"; }, "joining reach funnel conversion sign up"],
  ["Use", "Analytics", "analytics", () => { ATAB = "use"; }, "took part opened the app screens engagement active behaviour"],
  ["Make", "Analytics", "analytics", () => { ATAB = "make"; }, "work content posts feedback votes tags"],
  ["Stay", "Analytics", "analytics", () => { ATAB = "stay"; }, "retention came back cohorts churn"],
  ["Trade", "Analytics", "analytics", () => { ATAB = "trade"; }, "market commerce sales orders fees average order revenue"],
  ["Where from", "Analytics › Arrive", "analytics", () => { ATAB = "arrive"; }, "sources referrer instagram google direct traffic"],
  ["Campaigns", "Analytics › Arrive", "analytics", () => { ATAB = "arrive"; }, "utm tag on the link story ads"],
  ["The link they came in on", "Analytics › Arrive", "analytics", () => { ATAB = "arrive"; }, "landing page tournament link post link profile link"],
  ["Phone or computer", "Analytics › Arrive", "analytics", () => { ATAB = "arrive"; }, "devices iphone android mac"],
  ["Countries", "Analytics › Arrive", "analytics", () => { ATAB = "arrive"; }, "where in the world geography"],
  ["From joining to a sale", "Analytics › Join", "analytics", () => { ATAB = "join"; }, "funnel"],
  ["Where new members stop", "Analytics › Join", "analytics", () => { ATAB = "join"; }, "drop off never posted only looked voted"],
  ["Ways in", "Analytics › Join", "analytics", () => { ATAB = "join"; }, "which doors bring members who post"],
  ["Screens", "Analytics › Use", "analytics", () => { ATAB = "use"; }, "pages views time on screen exits back outs"],
  ["Where they go next", "Analytics › Use", "analytics", () => { ATAB = "use"; }, "paths routes moves"],
  ["Where visits end", "Analytics › Use", "analytics", () => { ATAB = "use"; }, "dead ends exits leave"],
  ["Started and not finished", "Analytics › Use", "analytics", () => { ATAB = "use"; }, "flows abandoned gave up post listing checkout"],
  ["Taps that did nothing", "Analytics › Use", "analytics", () => { ATAB = "use"; }, "dead taps rage taps hammered"],
  ["When they're on the app", "Analytics › Use", "analytics", () => { ATAB = "use"; }, "hours time of day"],
  ["What they make", "Analytics › Make", "analytics", () => { ATAB = "make"; }, "roles"],
  ["Posted in which lab", "Analytics › Make", "analytics", () => { ATAB = "make"; }, "labs"],
  ["Posts by lab", "Analytics › Make", "analytics", () => { ATAB = "make"; }, "labs"],
  ["How members take part", "Analytics › Make", "analytics", () => { ATAB = "make"; }, "taking part group chats"],
  ["#tags people are using", "Analytics › Make", "analytics", () => { ATAB = "make"; }, "hashtags trending"],
  ["Do new members stay?", "Analytics › Stay", "analytics", () => { ATAB = "stay"; }, "retention cohorts back next day after a week never posted gone quiet"],
  ["What the ones who stayed did on day one", "Analytics › Stay", "analytics", () => { ATAB = "stay"; }, "first day"],
  ["By seller", "Analytics › Trade", "analytics", () => { ATAB = "trade"; }, "top sellers"],
  ["Any dates", "The date range on every page", "analytics", () => { RPICK = true; }, "custom date range period calendar from to"],
  ["What the numbers mean", "Analytics", "analytics", null, "dictionary definitions meaning"],
  ["Studio stats", "Analytics", "studio", null, "beat maker sounds"],
  ["Echo open to everyone", "Help desk", "echo", null, "switch members help admins only"],
  // the switches
  ...[["Signups open", "invite only join closed"], ["Guests can look around", "guest access"], ["Skip email confirmation", "auto verify"], ["Google", "sign in with"], ["Apple", "sign in with"], ["Facebook", "sign in with"],
    ["Market", "buying selling on off"], ["Studio", "beat maker on off"], ["Loop market", "loops"], ["Offer distribution", "distro music core"], ["Weekly reminders", "nudge email"], ["Banner across the app", "announcement"]]
    .map(([l, k]) => [l, "Settings › Switches", "settings", () => { SYSTAB = "settings"; }, k + " switch setting toggle"]),
];
/* a number from the dictionary opens the Analytics tab that shows it */
const FIND_NUM = { visits: "arrive", visitors: "arrive", newVisitors: "arrive", bounce: "arrive", source: "arrive", members: "join", joined: "join", confirmed: "join", opened: "use", tookPart: "use", cameBack: "stay", posted: "join", work: "make", feedback: "make", votes: "make", collabs: "make", messages: "use", orders: "trade", sales: "trade", fees: "trade", period: "arrive" };
function findLocal(term) {
  const words = term.toLowerCase().split(/\s+/).filter(Boolean), open = (k) => TABS.some(([t]) => t === (OLD_TABS[k] || k)) || k === "studio";
  const nums = (D.measures || []).filter((m) => FIND_NUM[m.id]).map((m) => [m.name, "A number · " + m.says, "analytics", () => { ATAB = FIND_NUM[m.id]; }, ""]);
  const hit = (r) => { const hay = (r[0] + " " + r[1] + " " + r[4]).toLowerCase(); return words.every((w) => hay.includes(w)); };
  const rank = (r) => (r[0].toLowerCase().startsWith(words[0]) ? 0 : r[0].toLowerCase().includes(words[0]) ? 1 : 2);
  return [...FIND_MAP, ...nums].filter((r) => open(r[2]) && hit(r)).sort((a, b) => rank(a) - rank(b)).slice(0, 6);
}
const FIND_OPEN = {
  listing: (r) => { LQ = r.title; LSTAT = "all"; go("listings"); },
  order: (r) => { OSTAT = "all"; go("orders"); },
  work: (r) => { CQ = r.text === "A piece" || r.text === "A post" ? "@" + r.username : r.text.slice(0, 40); CLAB = ""; CTAG = ""; CKIND = ""; D.posts = null; go("content"); },
  event: (r) => { EVID = r.id; EVFORM = null; D.event = null; go("events"); },
  know: (r) => { KNOWQ = r.title; KNOWKIND = ""; KNOWARCH = false; go("knowledge"); },
};
function wireSearch() {
  const q = $("#gq"), box = $("#gres"); if (!q) return;
  let t, n = 0, acts = [];
  const show = (html) => { box.innerHTML = html; box.hidden = !html; };
  const row = (i, main, sub, lead = "", more = "") => `<button class="li" data-gi="${i}"${more}>${lead}<span class="b"><b>${main}</b><span>${sub}</span></span></button>`;
  const draw = (term, loc, people, f) => {
    acts = []; const add = (fn) => acts.push(fn) - 1, sec = (name, rows) => (rows.length ? `<div class="gsec">${name}</div>${rows.join("")}` : "");
    const html = sec("Go to", loc.map((r) => row(add(() => { r[3] && r[3](); go(r[2]); }), esc(r[0]), esc(r[1]))))
      + sec("Members", (people || []).slice(0, 5).map((u) => row(add(() => openPerson(u.username)), esc(u.displayName), `@${esc(u.username)} · #${u.id}${u.email ? " · " + esc(u.email) : ""}`, av(u), ` data-gp="${esc(u.username)}"`))
        .concat((people || []).length > 5 ? [`<button class="gall" data-gi="${add(() => { PQ = term; go("people"); })}">See all ${people.length} in Members ${I.chev}</button>`] : []))
      + (f ? sec("Listings", f.listings.map((r) => row(add(() => FIND_OPEN.listing(r)), esc(r.title), `${money(r.price)} · @${esc(r.seller)} · ${esc(r.status)}`)))
        + sec("Orders", f.orders.map((r) => row(add(() => FIND_OPEN.order(r)), `#${r.id} · ${esc(r.title)}`, `${money(r.amount)} · @${esc(r.buyer)} from @${esc(r.seller)} · ${esc(r.status)}`)))
        + sec("Work", f.work.map((r) => row(add(() => FIND_OPEN.work(r)), esc(r.text), `@${esc(r.username)}`)))
        + sec("Tournaments", f.events.map((r) => row(add(() => FIND_OPEN.event(r)), esc(r.title), "Events")))
        + sec("Knowledge", f.knowledge.map((r) => row(add(() => FIND_OPEN.know(r)), esc(r.title), esc(r.kind)))) : "");
    show(html || `<div class="empty">Nothing in the dashboard matches “${esc(term)}”.</div>`);
    $$("[data-gi]", box).forEach((b) => b.onmousedown = (e) => { e.preventDefault(); pick(+b.dataset.gi); });
  };
  const pick = (i) => { const fn = acts[i]; if (!fn) return; GQ = ""; q.value = ""; show(""); q.blur(); fn(); };
  q.oninput = () => { GQ = q.value; clearTimeout(t); const term = GQ.trim(); if (!term) return show("");
    if (!D.measures && !FIND_ASKED) { FIND_ASKED = true; req("/api/admin/measures").then((r) => { D.measures = r.measures; }).catch(() => {}); }   // the numbers, wherever you search from
    const me = ++n, loc = findLocal(term); draw(term, loc, null, null);   // the dashboard's own map answers at once
    t = setTimeout(async () => {
      const [p, f] = await Promise.all([req("/api/admin/people?q=" + encodeURIComponent(term)).catch(() => null),
        term.length > 1 && ACCESS === "owner" ? req("/api/admin/find?q=" + encodeURIComponent(term)).catch(() => null) : null]);
      if (me === n && $("#gq") === q) draw(term, loc, p && p.people, f);
    }, 180); };
  q.onfocus = () => { if (GQ.trim() && box.hidden) q.oninput(); };
  q.onkeydown = (e) => { if (e.key === "Enter" && acts.length) pick(0); if (e.key === "Escape") { GQ = ""; q.value = ""; show(""); q.blur(); } };
  q.onblur = () => setTimeout(() => show(""), 120);
}
