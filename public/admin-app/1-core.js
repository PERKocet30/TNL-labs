/* LABS admin v4.1 — 2026-10-28 (charts: readable dates and numbers, round scale); v4.0 — 2026-10-20. "Make it more like Shopify's admin, with
   graphs; one tailored for mobile and one for computer; compare against
   Instagram analytics." Ten sections named by what you manage — Home ·
   Orders · Listings · Sellers · Members · Content · Events · Analytics ·
   Settings · Health — a sidebar on a computer, a bottom bar on a phone,
   and one frame on every page: title, date range, numbers with their
   share, line charts with last period behind (lineHTML), the table.
   v3.2 — 2026-10-15. Core: state, API, helpers, charts, shell.
   v3.0: the whole admin dashboard to one standard — a side menu
   on a computer, search any member from the top bar, and shared page pieces
   (pageHead, card, subTabs) every section is built from. v3.1: no top-bar
   search on People, which has its own.
   v2.3 — 2026-10-11 (signed out: Log in comes straight back here).
   Today (what needs you, the tournament, how people take part), People,
   Labs (every post by lab and #tag), Tournament, Market, System. Every number here comes from an admin-only endpoint; the
   server checks, not this page. */
const API = location.origin;
let TOKEN = null; try { TOKEN = localStorage.getItem("tnl-token"); } catch (e) {}
let ME = null, TAB = "home", RANGE = 30, D = {}, TOASTT = null;
/* the sections, in groups (the sidebar shows the groups; the phone's bar shows the first four and More) */
const TABS = [["home", "Home"], ["orders", "Orders"], ["listings", "Listings"], ["sellers", "Sellers"],
  ["people", "Members"], ["content", "Content"], ["events", "Events"], ["instagram", "Instagram"], ["analytics", "Analytics"], ["health", "Health"], ["systems", "Systems"], ["settings", "Settings"]];
const GROUPS = [["Run", ["home", "orders", "listings", "sellers"]], ["People & content", ["people", "content", "events", "instagram"]], ["Understand", ["analytics", "health", "systems"]], ["Set up", ["settings"]]];
const PHONE_BAR = ["home", "orders", "people", "content"];
/* old links and old data-go targets still land somewhere sensible */
const OLD_TABS = { today: "home", market: "orders", system: "settings" };
try { const h = OLD_TABS[location.hash.slice(1)] || location.hash.slice(1); if (TABS.some(([k]) => k === h)) TAB = h; RANGE = +localStorage.getItem("tnl-admin-range") || 30; } catch (e) {}
let MORE = false;   // the phone's More sheet

const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const money = (c) => "$" + ((c || 0) / 100).toLocaleString(undefined, { minimumFractionDigits: (c || 0) % 100 ? 2 : 0, maximumFractionDigits: 2 });
const num = (n) => (n || 0).toLocaleString();
const ago = (t) => { if (!t) return "never"; const s = (Date.now() - t) / 1000;
  if (s < 60) return "now"; if (s < 3600) return Math.floor(s / 60) + "m"; if (s < 86400) return Math.floor(s / 3600) + "h";
  if (s < 86400 * 30) return Math.floor(s / 86400) + "d"; return new Date(t).toLocaleDateString([], { month: "short", day: "numeric" }); };
const av = (u, cls = "") => u && u.avatarUrl ? `<img class="av ${cls}" src="${esc(u.avatarUrl)}" alt="">`
  : `<span class="av ${cls}">${esc(((u && (u.displayName || u.username)) || "?").slice(0, 2).toUpperCase())}</span>`;

/* drawn icons — same geometry as the app */
const di = (d, s = 16, fill = "none") => `<svg class="di" viewBox="0 0 24 24" width="${s}" height="${s}" fill="${fill}" stroke="currentColor" stroke-width="2" stroke-linecap="square" stroke-linejoin="miter" aria-hidden="true">${d}</svg>`;
const I = {
  check: di('<path d="M5 12l5 5 9-10"/>'), x: di('<path d="M6 6l12 12M18 6L6 18"/>', 18), out: di('<path d="M8 16L16 8M9.5 8H16v6.5"/>', 14),
  msg: di('<path d="M4 5h16v11H9l-5 4z"/>', 14), pin: di('<path d="M9 4h6l-1 6 3 3H7l3-3zM12 13v7"/>', 14), trash: di('<path d="M5 7h14M10 7V4h4v3M7 7l1 13h8l1-13"/>', 14),
  down: di('<path d="M12 4v12M6 11l6 6 6-6M5 20h14"/>', 14), sun: di('<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M2 12h2M20 12h2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>', 16),
  moon: di('<path d="M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5z"/>', 16), chev: di('<path d="M9 5l7 7-7 7"/>', 14),
};
/* the side menu's icons, one per section */
const NAVI = {
  home: di('<path d="M4 11l8-7 8 7v9h-5v-6H9v6H4z"/>', 18),
  orders: di('<path d="M4 7h16v13H4zM8 7V4h8v3M4 12h16"/>', 18), listings: di('<path d="M4 4h16v16H4zM4 14l5-5 4 4 3-3 4 4M15 8h.01"/>', 18),
  sellers: di('<path d="M5 8h14l-1 12H6zM9 8V6a3 3 0 0 1 6 0v2M12 11v6M9.5 14h5"/>', 18),
  analytics: di('<path d="M4 20V10M10 20V4M16 20v-8M22 20H2"/>', 18), health: di('<path d="M3 12h4l2-6 4 12 2-6h6"/>', 18),
  systems: di('<path d="M4 5h16v6H4zM4 13h16v6H4zM8 8h.01M8 16h.01"/>', 18),
  settings: di('<circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3M4.9 4.9l2.1 2.1M17 17l2.1 2.1M4.9 19.1L7 17M17 7l2.1-2.1"/>', 18),
  more: di('<path d="M4 7h16M4 12h16M4 17h16"/>', 18),
  instagram: di('<rect x="4" y="4" width="16" height="16" rx="4"/><circle cx="12" cy="12" r="3.5"/><path d="M16.5 7.5h.01"/>', 18),
  people: di('<circle cx="9" cy="8" r="3.5"/><path d="M3 20c0-3.5 2.7-6 6-6s6 2.5 6 6M16 4.5a3.5 3.5 0 0 1 0 7M18 14c2 .7 3 2.8 3 6"/>', 18),
  content: di('<path d="M4 4h7v7H4zM13 4h7v7h-7zM4 13h7v7H4zM13 13h7v7h-7z"/>', 18), events: di('<path d="M7 4h10v5a5 5 0 0 1-10 0zM7 6H4v2a3 3 0 0 0 3 3M17 6h3v2a3 3 0 0 1-3 3M12 14v3M8 20h8M10 17h4v3h-4z"/>', 18),
};

async function req(path, opts = {}) {
  const r = await fetch(API + path, { method: opts.method || "GET",
    headers: { "Content-Type": "application/json", ...(TOKEN ? { Authorization: "Bearer " + TOKEN } : {}) },
    body: opts.body ? JSON.stringify(opts.body) : undefined });
  const d = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(d.error || "HTTP " + r.status);
  return d;
}
function toast(m) { TOASTT = m; paintToast(); clearTimeout(toast.t); toast.t = setTimeout(() => { TOASTT = null; paintToast(); }, 2400); }
function paintToast() { let el = $(".toast"); if (!TOASTT) { if (el) el.remove(); return; }
  if (!el) { el = document.createElement("div"); el.className = "toast"; document.body.appendChild(el); } el.textContent = TOASTT; }

/* one modal for confirm and prompt — resolves true/false, or the text */
function modal({ title, body = "", ok = "OK", danger = false, field = null }) {
  return new Promise((done) => {
    const L = $("#layer"), el = document.createElement("div"); el.className = "modal";
    el.innerHTML = `<div class="box" role="dialog" aria-modal="true"><b>${esc(title)}</b>${body ? `<p>${esc(body)}</p>` : ""}
      ${field ? (field.multi ? `<textarea class="in" rows="3" placeholder="${esc(field.placeholder || "")}">${esc(field.value || "")}</textarea>`
        : `<input class="in" type="${field.type || "text"}" inputmode="${field.inputmode || "text"}" placeholder="${esc(field.placeholder || "")}" value="${esc(field.value || "")}">`) : ""}
      <div class="row"><button class="btn ghost sm" data-no>Cancel</button><button class="btn sm ${danger ? "danger" : ""}" data-ok>${esc(ok)}</button></div></div>`;
    L.appendChild(el);
    const f = $(".in", el); if (f) setTimeout(() => f.focus(), 30);
    const end = (v) => { el.remove(); done(v); };
    $("[data-no]", el).onclick = () => end(field ? null : false);
    $("[data-ok]", el).onclick = () => end(field ? f.value : true);
    el.onclick = (e) => { if (e.target === el) end(field ? null : false); };
    el.onkeydown = (e) => { if (e.key === "Escape") end(field ? null : false); if (e.key === "Enter" && field && !field.multi) end(f.value); };
  });
}
const confirmIt = (title, body, o = {}) => modal({ title, body, ok: o.ok || "Confirm", danger: !!o.danger });
const promptIt = (title, o = {}) => modal({ title, body: o.body || "", ok: o.ok || "Save", field: o });
const act = async (fn, okMsg) => { try { const r = await fn(); if (okMsg) toast(typeof okMsg === "function" ? okMsg(r) : okMsg); return r; } catch (e) { toast(e.message); return null; } };

/* ---- charts: one series each, ink bars, today in reagent, hover to read ---- */
function barsHTML(values, { labels = [], fmt = num, h = 150 } = {}) {
  const max = Math.max(1, ...values);
  return `<div class="plot" style="height:${h}px" data-plot>${values.map((v, i) =>
    `<span class="b ${i === values.length - 1 ? "last" : ""}" data-tip="${esc((labels[i] || "") + " · " + fmt(v))}"><i style="height:${Math.max(v ? 3 : 0, Math.round((v / max) * 100))}%"></i></span>`).join("")}</div>
    <div class="axis"><span>${esc(labels[0] || "")}</span><span>${esc(labels[Math.floor(labels.length / 2)] || "")}</span><span>${esc(labels[labels.length - 1] || "")}</span></div>
    <div class="tip" hidden></div>`;
}
const sparkHTML = (values) => { const max = Math.max(1, ...values); return `<div class="spark" aria-hidden="true">${values.slice(-30).map((v) => `<i style="height:${Math.max(4, Math.round((v / max) * 100))}%"></i>`).join("")}</div>`; };
/* A line chart in the app's hand: this period in ink, the one before faint
   behind, the last point in reagent, three gridlines, dates underneath.
   Plain SVG — no library. values/prev: numbers per day.
   v2 2026-10-28: the dates and numbers are real text over the drawing, not
   inside it — inside, they shrank to ~6px on a phone and the last date hung
   off the edge ("Oct 2" for Oct 28). Five evenly spaced dates, first and
   last kept inside the frame; the scale is a round number (0 · 50 · 100). */
const niceMax = (v) => { const p = 10 ** Math.floor(Math.log10(Math.max(1, v))), m = v / p;
  return (m <= 1 ? 1 : m <= 2 ? 2 : m <= 2.5 ? 2.5 : m <= 5 ? 5 : 10) * p; };
const dayText = (l) => /^\d\d-\d\d$/.test(l) ? new Date(2000, +l.slice(0, 2) - 1, +l.slice(3)).toLocaleDateString([], { month: "short", day: "numeric" }) : String(l ?? "");
function lineHTML(values, prev, { labels = [], fmt = num, h = 200 } = {}) {
  const W = 600, P = { l: 0, r: 0, t: 10, b: 4 }, n = Math.max(2, values.length);
  const mx = niceMax(Math.max(1, ...values, ...(prev || [])));
  const px = (i) => P.l + i * ((W - P.l - P.r) / (n - 1)), py = (v) => h - P.b - (v / mx) * (h - P.t - P.b);
  const pc = (x, of) => (x / of * 100).toFixed(2) + "%";
  const pl = (s) => s.map((v, i) => `${px(i).toFixed(1)},${py(v).toFixed(1)}`).join(" ");
  const grid = [0, .5, 1].map((f) => `<line x1="0" x2="${W}" y1="${py(mx * f).toFixed(1)}" y2="${py(mx * f).toFixed(1)}" class="gl"/>`).join("");
  const ys = [0, .5, 1].map((f) => `<span style="top:${pc(py(mx * f), h)}">${esc(fmt(mx * f))}</span>`).join("");
  const k = Math.min(n, [5, 4, 3].find((c) => (n - 1) % (c - 1) === 0) || 5), at = [...new Set(Array.from({ length: k }, (_, j) => Math.round(j * (n - 1) / (k - 1))))];   // evenly spaced, never two side by side
  const xs = labels.length ? at.map((i, j) => `<span class="${j === 0 ? "a0" : j === at.length - 1 ? "a1" : ""}" style="left:${pc(px(i), W)}">${esc(dayText(labels[i]))}</span>`).join("") : "";
  const dots = values.map((v, i) => `<circle cx="${px(i).toFixed(1)}" cy="${py(v).toFixed(1)}" r="9" class="hit" data-tip="${esc(dayText(labels[i] || "") + " · " + fmt(v) + (prev && prev[i] != null ? " (before: " + fmt(prev[i]) + ")" : ""))}"/>`).join("");
  return `<div class="line" data-plot><div class="lyx" style="height:${h}px">${ys}</div><div class="lpl"><div class="lsv"><svg viewBox="0 0 ${W} ${h}" preserveAspectRatio="none" style="height:${h}px">${grid}
    ${prev && prev.length ? `<polyline points="${pl(prev)}" class="pv"/>` : ""}<polyline points="${pl(values)}" class="nw"/>${dots}</svg>
    <i class="ldot" style="left:${pc(px(n - 1), W)};top:${pc(py(values[n - 1] || 0), h)}"></i></div><div class="lxx">${xs}</div></div><div class="tip" hidden></div></div>`;
}
/* horizontal bars with a label and a number each — a breakdown (by lab, by role, by source) */
const breakHTML = (rows, fmt = num) => { const mx = Math.max(1, ...rows.map((r) => r.n));
  return `<div class="brk">${rows.map((r) => `<div class="br"><span class="bl">${esc(r.label)}</span><span class="bt"><i style="width:${Math.round((r.n / mx) * 100)}%"></i></span><span class="bn">${fmt(r.n)}</span></div>`).join("")}</div>`; };
/* a funnel: each step as a share of the first */
const funnelHTML = (steps) => `<div class="fun">${steps.map((s, i) => `<div class="fs"><span class="fl">${esc(s.label)}</span><span class="fb"><i style="width:${Math.max(2, Math.round((s.n / Math.max(1, steps[0].n)) * 100))}%"></i></span><span class="fn">${num(s.n)}<em>${i ? Math.round((s.n / Math.max(1, steps[0].n)) * 100) + "%" : ""}</em></span></div>`).join("")}</div>`;
/* a headline number: label, value, change vs the period before, a second line that says the share or source, a sparkline */
function kpiHTML(label, value, { now = null, before = null, fmt = num, share = "", series = null, line = null } = {}) {
  let d = "";
  if (now != null && before != null) { const diff = now - before, up = diff > 0, flat = diff === 0;
    d = `<i class="${flat ? "" : up ? "up" : "dn"}">${flat ? "same as" : (up ? "+" : "−") + fmt(Math.abs(diff)) + " vs"} the ${RANGE} days before</i>`; }
  return `<div class="kpi"><div class="k">${esc(label)}</div><div class="v">${value}</div>${d ? `<div class="d">${d}</div>` : ""}${share ? `<div class="s">${share}</div>` : ""}
    ${series ? sparkLine(series) : ""}${line || ""}</div>`;
}
const sparkLine = (a) => { const w = 120, h = 26, mx = Math.max(1, ...a), n = Math.max(2, a.length);
  return `<svg class="spk" viewBox="0 0 ${w} ${h}" preserveAspectRatio="none" aria-hidden="true"><polyline points="${a.map((v, i) => `${(i * (w / (n - 1))).toFixed(1)},${(h - 2 - (v / mx) * (h - 5)).toFixed(1)}`).join(" ")}"/></svg>`; };
const pct = (a, b) => b ? Math.round((a / b) * 100) + "%" : "—";
const sum = (a) => (a || []).reduce((s, v) => s + (v || 0), 0);
/* the range picker every page with time on it shows */
const rangeHTML = () => `<div class="seg" role="group" aria-label="Date range">${[7, 30, 90].map((d) => `<button class="${RANGE === d ? "on" : ""}" data-range="${d}">${d} days</button>`).join("")}</div>`;
function wireTips(root = document) {
  $$("[data-plot]", root).forEach((p) => {
    const tip = p.parentElement.querySelector(".tip"); if (!tip) return;
    const show = (b) => { const r = b.getBoundingClientRect(), pr = p.parentElement.getBoundingClientRect();
      tip.textContent = b.dataset.tip; tip.hidden = false; tip.style.left = (r.left - pr.left + r.width / 2) + "px"; tip.style.top = (r.top - pr.top - 4) + "px"; };
    $$(".b, .hit", p).forEach((b) => { b.onmouseenter = () => show(b); b.ontouchstart = () => show(b); });
    p.onmouseleave = () => { tip.hidden = true; };
  });
}
function dayLabels(start, days) {
  return Array.from({ length: days }, (_, i) => new Date(start + i * 86400000 + 3600000).toLocaleDateString([], { month: "short", day: "numeric" }));
}
/* "+12 vs 28 before" — a change, stated plainly; no colour judgment */
function deltaText(now, before, fmt = num) {
  if (!before && !now) return "none either period";
  const diff = now - before;
  return `<b>${diff > 0 ? "+" : diff < 0 ? "−" : "±"}${fmt(Math.abs(diff))}</b> vs ${fmt(before)} before`;
}
const delta = (now, before, fmt = num) => `<span class="d">${deltaText(now, before, fmt)}</span>`;

/* ---- shell ---- */
function paint() {
  const app = $("#app");
  /* Signed out. An email's Open Admin lands in the phone's browser, which
     doesn't share the home-screen app's sign-in (iOS keeps them apart) —
     so Log in opens the app's log-in straight away and comes back here. */
  if (!ME) { const back = "/?login=1&next=" + encodeURIComponent("/admin" + location.hash);
    app.innerHTML = `<div class="gate"><div><div class="brand"><img class="bwm" src="/labs-wordmark-ink.png" alt="LABS"> Admin</div>
    <h1>Admins only</h1><p>${TOKEN ? "This account isn't an admin. Log in with one and you'll come straight back here."
      : "This browser isn't signed in — LABS on your home screen keeps its own sign-in, so email links open here signed out. Log in once and it'll remember you."}</p><a class="btn" id="adminlogin" href="${esc(back)}">Log in</a></div></div>`; return; }
  const n = (k) => (D.pulse && k === "home" && D.pulse.inbox.length) || (D.pulse && k === "content" && (D.pulse.inbox.find((i) => i.kind === "reports") || {}).n) || (k === "instagram" && D.instagram?.unread) || 0;
  const badge = (k) => n(k) ? `<b>${n(k)}</b>` : "";
  /* keep the field you're typing in (and where the cursor is) through a repaint */
  const fo = document.activeElement && document.activeElement.id && app.contains(document.activeElement) ? document.activeElement : null;
  const foId = fo && fo.id, foSel = fo && "selectionStart" in fo ? [fo.selectionStart, fo.selectionEnd] : null;
  const name = (k) => (TABS.find(([id]) => id === k) || [k, k === "studio" ? "Studio" : "More"])[1];
  const item = (k, cls) => `<button class="${cls} ${TAB === k ? "on" : ""}" data-tab="${k}" ${TAB === k ? 'aria-current="page"' : ""}>${NAVI[k] || ""}<span>${name(k)}</span>${badge(k)}</button>`;
  const side = GROUPS.map(([g, ks]) => `<div class="grp">${g}</div>${ks.map((k) => item(k, "nv")).join("")}`).join("");
  const inBar = PHONE_BAR.includes(TAB);
  const bar = PHONE_BAR.map((k) => item(k, "bb")).join("") + `<button class="bb ${!inBar || MORE ? "on" : ""}" data-more>${NAVI.more}<span>${!inBar && !MORE ? name(TAB) : "More"}</span></button>`;
  const theme = `<button class="ib thm" aria-label="Switch theme">${document.documentElement.dataset.theme === "dark" ? I.sun : I.moon}</button>`;
  app.innerHTML = `<div class="shell">
    <aside class="side" aria-label="Admin sections"><div class="brand"><img class="bwm" src="/labs-wordmark-ink.png" alt="LABS"> Admin</div><nav class="side-nav">${side}</nav>
      <div class="side-ft"><span class="mono">Signed in as @${esc(ME.username)}</span><div class="row">${theme}<a class="btn ghost sm" href="/">Open the app ${I.out}</a></div></div></aside>
    <div class="mainc"><header class="top"><div class="bar1"><div class="brand ph"><img class="bwm" src="/labs-wordmark-ink.png" alt="LABS"> Admin</div>
      ${TAB === "people" ? "" : `<div class="gsrch" role="search">${di('<circle cx="11" cy="11" r="6"/><path d="M20 20l-4.5-4.5"/>', 16)}<input id="gq" placeholder="Search members" value="${esc(GQ)}" autocomplete="off" aria-label="Search members"><div class="gres" id="gres" hidden></div></div>`}
      <span class="ph">${theme}</span></div></header>
    <main class="wrap" id="main">${VIEWS[TAB]()}</main>
    <nav class="bbar" aria-label="Admin sections">${bar}</nav>
    ${MORE ? `<div class="scrim ms" data-more-x></div><div class="msheet"><div class="grp">All sections</div>${TABS.map(([k]) => item(k, "mi")).join("")}<a class="mi" href="/">${I.out}<span>Open the app</span></a></div>` : ""}</div></div>`;
  $$("[data-more]").forEach((b) => b.onclick = () => { MORE = !MORE; paint(); });
  $$("[data-more-x]").forEach((b) => b.onclick = () => { MORE = false; paint(); });
  $$("[data-range]").forEach((b) => b.onclick = () => { RANGE = +b.dataset.range; try { localStorage.setItem("tnl-admin-range", RANGE); } catch (e) {} D.pulse = null; D.series = null; D.direction = null; D.topwork = null; D.audience = null; load(); });
  $$("[data-tab]").forEach((b) => b.onclick = () => go(b.dataset.tab));
  $$(".thm").forEach((t) => t.onclick = () => { const th = document.documentElement.dataset.theme === "dark" ? "light" : "dark";
    document.documentElement.dataset.theme = th; try { localStorage.setItem("tnl-theme", th); } catch (e) {} paint(); });
  WIRES[TAB]?.(); wireTips(); wireCommon(); wireSearch();
  if (foId) { const f = document.getElementById(foId); if (f) { f.focus(); if (foSel) try { f.setSelectionRange(...foSel); } catch (e) {} } }
}

/* ---- search any member from any page (the bar at the top) ---- */
let GQ = "";
function wireSearch() {
  const q = $("#gq"), box = $("#gres"); if (!q) return;
  let t, n = 0;
  const show = (html) => { box.innerHTML = html; box.hidden = !html; };
  q.oninput = () => { GQ = q.value; clearTimeout(t); const term = GQ.trim(); if (!term) return show("");
    t = setTimeout(async () => { const me = ++n;
      try { const r = await req("/api/admin/people?q=" + encodeURIComponent(term)); if (me !== n) return;
        show(r.people.length ? r.people.slice(0, 8).map((u) => `<button class="li" data-gp="${esc(u.username)}">${av(u)}<span class="b"><b>${esc(u.displayName)}</b><span>@${esc(u.username)} · #${u.id}${u.email ? " · " + esc(u.email) : ""}</span></span></button>`).join("")
          + (r.people.length > 8 ? `<button class="gall" data-gall>See all ${r.people.length} in People ${I.chev}</button>` : "") : `<div class="empty">No member matches “${esc(term)}”.</div>`);
        $$("[data-gp]", box).forEach((b) => b.onmousedown = (e) => { e.preventDefault(); show(""); openPerson(b.dataset.gp); });
        const all = $("[data-gall]", box); if (all) all.onmousedown = (e) => { e.preventDefault(); seeAll(); };
      } catch (e) {} }, 180); };
  const seeAll = () => { PQ = GQ.trim(); GQ = ""; show(""); go("people"); };
  q.onkeydown = (e) => { if (e.key === "Enter" && GQ.trim()) seeAll(); if (e.key === "Escape") { GQ = ""; q.value = ""; show(""); q.blur(); } };
  q.onblur = () => setTimeout(() => show(""), 120);
}

/* ---- the pieces every page is built from ---- */
/* a page's title, one line on what it's for, and its main actions */
const pageHead = (title, desc, actions = "") => `<div class="pg-hd"><div><h1>${title}</h1>${desc ? `<p class="dim">${desc}</p>` : ""}</div>${actions ? `<div class="pg-act">${actions}</div>` : ""}</div>`;
/* a titled card */
const card = (title, body, sub = "") => `<section class="rc"><header><h3>${title}</h3>${sub ? `<span class="mono">${sub}</span>` : ""}</header>${body}</section>`;
/* tabs inside a page */
const subTabs = (list, on, attr) => `<nav class="utabs" role="tablist">${list.map(([k, l]) => `<button role="tab" aria-selected="${on === k}" class="${on === k ? "on" : ""}" ${attr}="${k}">${l}</button>`).join("")}</nav>`;
function go(tab) { TAB = OLD_TABS[tab] || tab; MORE = false; try { history.replaceState(null, "", "#" + tab); } catch (e) {} paint(); scrollTo(0, 0); load(); }
/* a typed or followed #hash (and back/forward) opens that section too */
addEventListener("hashchange", () => { const h = OLD_TABS[location.hash.slice(1)] || location.hash.slice(1); if (h !== TAB && TABS.some(([k]) => k === h)) go(h); });
/* things any view can carry: open a person, message someone in the app */
function wireCommon() {
  $$("[data-person]").forEach((el) => el.onclick = (e) => { e.stopPropagation(); openPerson(el.dataset.person); });
  $$("[data-dm]").forEach((el) => el.onclick = (e) => { e.stopPropagation(); window.open("/?dm=" + encodeURIComponent(el.dataset.dm), "_blank"); });
  $$("[data-go]").forEach((el) => el.onclick = () => go(el.dataset.go));
}
const VIEWS = {}, WIRES = {}, LOADERS = {};
async function load() {
  try { await (LOADERS[TAB] || (() => {}))(); if (!D.pulse && TAB !== "home") D.pulse = await req(pulseURL()); paint(); }
  catch (e) { if (/admins only|token|401|403/i.test(e.message)) { ME = null; paint(); } else toast(e.message); }
}
const pulseURL = () => `/api/admin/pulse?days=${RANGE}&tz=${new Date().getTimezoneOffset()}`;

async function boot() {
  if (!TOKEN) return paint();
  try { const d = await req("/api/me"); ME = d.user && d.user.isAdmin ? d.user : null; } catch (e) { ME = null; }
  paint(); if (!ME) return;
  load();
  setInterval(() => { if (TAB === "home" && document.visibilityState === "visible" && !$(".scrim,.modal")) load(); }, 60000);
}
