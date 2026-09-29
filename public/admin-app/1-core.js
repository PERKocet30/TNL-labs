/* TNL LABS admin v2.0 — 2026-09-29. Core: state, API, helpers, charts, shell.
   Five places: Today (what needs you + how it's going), People, Content,
   Market, System. Every number here comes from an admin-only endpoint; the
   server checks, not this page. */
const API = location.origin;
let TOKEN = null; try { TOKEN = localStorage.getItem("tnl-token"); } catch (e) {}
let ME = null, TAB = "today", RANGE = 30, D = {}, TOASTT = null;
const TABS = [["today", "Today"], ["people", "People"], ["content", "Content"], ["market", "Market"], ["system", "System"]];
try { const h = location.hash.slice(1); if (TABS.some(([k]) => k === h)) TAB = h; RANGE = +localStorage.getItem("tnl-admin-range") || 30; } catch (e) {}

const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const money = (c) => "$" + ((c || 0) / 100).toLocaleString(undefined, { minimumFractionDigits: (c || 0) % 100 ? 2 : 0, maximumFractionDigits: 2 });
const num = (n) => (n || 0).toLocaleString();
const ago = (t) => { if (!t) return "never"; const s = (Date.now() - t) / 1000;
  if (s < 60) return "now"; if (s < 3600) return Math.floor(s / 60) + "m"; if (s < 86400) return Math.floor(s / 3600) + "h";
  if (s < 86400 * 30) return Math.floor(s / 86400) + "d"; return new Date(t).toLocaleDateString([], { month: "short", day: "numeric" }); };
const chName = (c) => { const t = String(c || "").replace(/-/g, " "); return t.charAt(0).toUpperCase() + t.slice(1); };
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
function wireTips(root = document) {
  $$("[data-plot]", root).forEach((p) => {
    const tip = p.parentElement.querySelector(".tip"); if (!tip) return;
    const show = (b) => { const r = b.getBoundingClientRect(), pr = p.parentElement.getBoundingClientRect();
      tip.textContent = b.dataset.tip; tip.hidden = false; tip.style.left = (r.left - pr.left + r.width / 2) + "px"; tip.style.top = (r.top - pr.top - 4) + "px"; };
    $$(".b", p).forEach((b) => { b.onmouseenter = () => show(b); b.ontouchstart = () => show(b); });
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
  if (!ME) { app.innerHTML = `<div class="gate"><div><div class="brand">TNL LABS <i>//</i> Admin</div>
    <h1>Admins only</h1><p>Sign in to the app with an admin account, then come back here.</p><a class="btn" href="/">Open the app</a></div></div>`; return; }
  const badge = (k) => k === "today" && D.pulse && D.pulse.inbox.length ? `<b>${D.pulse.inbox.length}</b>` : k === "content" && D.pulse ? ((D.pulse.inbox.find((i) => i.kind === "reports") || {}).n ? `<b>${D.pulse.inbox.find((i) => i.kind === "reports").n}</b>` : "") : "";
  app.innerHTML = `<header class="top"><div class="bar1"><div class="brand">TNL LABS <i>//</i> Admin</div>
      <button class="ib" id="theme" aria-label="Switch theme">${document.documentElement.dataset.theme === "dark" ? I.sun : I.moon}</button>
      <a class="btn ghost sm" href="/">App ${I.out}</a></div>
    <nav class="tabs">${TABS.map(([k, l]) => `<button class="pill ${TAB === k ? "on" : ""}" data-tab="${k}">${l}${badge(k)}</button>`).join("")}</nav></header>
    <main class="wrap" id="main">${VIEWS[TAB]()}</main>`;
  $$("[data-tab]").forEach((b) => b.onclick = () => go(b.dataset.tab));
  $("#theme").onclick = () => { const t = document.documentElement.dataset.theme === "dark" ? "light" : "dark";
    document.documentElement.dataset.theme = t; try { localStorage.setItem("tnl-theme", t); } catch (e) {} paint(); };
  WIRES[TAB]?.(); wireTips(); wireCommon();
}
function go(tab) { TAB = tab; try { history.replaceState(null, "", "#" + tab); } catch (e) {} paint(); scrollTo(0, 0); load(); }
/* things any view can carry: open a person, message someone in the app */
function wireCommon() {
  $$("[data-person]").forEach((el) => el.onclick = (e) => { e.stopPropagation(); openPerson(el.dataset.person); });
  $$("[data-dm]").forEach((el) => el.onclick = (e) => { e.stopPropagation(); window.open("/?dm=" + encodeURIComponent(el.dataset.dm), "_blank"); });
  $$("[data-go]").forEach((el) => el.onclick = () => go(el.dataset.go));
}
const VIEWS = {}, WIRES = {}, LOADERS = {};
async function load() {
  try { await (LOADERS[TAB] || (() => {}))(); if (!D.pulse && TAB !== "today") D.pulse = await req(pulseURL()); paint(); }
  catch (e) { if (/admins only|token|401|403/i.test(e.message)) { ME = null; paint(); } else toast(e.message); }
}
const pulseURL = () => `/api/admin/pulse?days=${RANGE}&tz=${new Date().getTimezoneOffset()}`;

async function boot() {
  if (!TOKEN) return paint();
  try { const d = await req("/api/me"); ME = d.user && d.user.isAdmin ? d.user : null; } catch (e) { ME = null; }
  paint(); if (!ME) return;
  load();
  setInterval(() => { if (TAB === "today" && document.visibilityState === "visible" && !$(".scrim,.modal")) load(); }, 60000);
}
