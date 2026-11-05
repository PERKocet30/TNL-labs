/* LABS admin — the models at the front v1.2, 2026-11-04 ("this interactive dashboard is way better and should be front of the
   admin dashboard, like Echo's to-do and Members and Analytics" — of the Systems map). Two spinning models on the 3D ring
   (2-ring.js), each the first card of its page:
     · Echo Home's to-do (todoCardHTML): LABS in the middle, every section of the dashboard round it — red, with how many,
       when something in it needs you — and every service LABS runs on round those. Tap one: what needs you there, and Open.
       The full queue (Review / Open / say hi) stays under it.
     · Analytics' member's path (pathCardHTML): the LABS Blueprint's organisation (sheet A-0) — Arrive · Join · See · Make ·
       Respond · Earn · Trade · Talk round LABS, each with its number for the date range (red when something there needs
       you), the outside services and the foundations round those. Tap one: its numbers against the range before, its
       needs, what it leans on, and Open.
   v1.1 was a flat card on Echo Home and v1.0 its own section (the Network); both gone. Data: GET /api/admin/network
   (server/admin/network), loaded with Echo Home and with Analytics. */
const NW = { pick: "", todo: "" };
/* what leans on what — the Blueprint's lines, shown as "Leans on" / "Feeds" */
const NW_LINKS = [["o:meta", "arrive"], ["o:cloudflare", "arrive"], ["o:google", "arrive"], ["o:resend", "join"], ["o:stripe", "trade"], ["o:resend", "talk"], ["o:claude", "talk"],
  ["o:railway", "b:labs"], ["o:github", "b:labs"], ["o:connector", "b:labs"], ["b:trust", "join"], ["b:trust", "respond"], ["b:members", "see"], ["b:labs", "see"], ["b:data", "earn"]];
const NW_OPEN = { health: "Health", settings: "Settings", market: "Market", echohome: "Echo", instagram: "Instagram", systems: "Systems", content: "Content", people: "Members", events: "Events", knowledge: "Knowledge", echo: "Help desk", analytics: "Analytics" };
async function nwLoad() { try { D.network = await req(`/api/admin/network?days=${RANGE}`); } catch (e) { D.network = null; } }   // with Echo Home's and Analytics' loaders
const nwStages = () => (D.network && D.network.stages) || [];
const nwSections = () => (D.network && D.network.sections) || [];
const nwAll = () => { const N = D.network || {}; return [...(N.outside || []).map((x) => ({ ...x, key: "o:" + x.id })), ...(N.base || []).map((x) => ({ ...x, key: "b:" + x.id, name: x.id === "labs" ? "Server" : x.name }))]; };
const nwFind = (k) => nwStages().find((s) => s.id === k) || nwAll().find((s) => s.key === k);
const nwFmt = (s, v) => (s.money ? money(v) : num(v));
const nwShort = (v, isMoney) => { const x = isMoney ? v / 100 : v, s = x >= 1e6 ? (x / 1e6).toFixed(1).replace(/\.0$/, "") + "m" : x >= 1e4 ? Math.round(x / 1e3) + "k" : x >= 1e3 ? (x / 1e3).toFixed(1).replace(/\.0$/, "") + "k" : String(Math.round(x)); return (isMoney ? "$" : "") + s; };
const NW_STATE = { on: ["on", "working"], warn: ["warn", "needs a look"], wait: ["wait", "in motion"], off: ["", "not connected"] };
function nwDelta(s) {
  if (!s.before && !s.value) return `<span class="nwp-d">—</span>`;
  if (!s.before) return `<span class="nwp-d up">new</span>`;
  const p = Math.round(((s.value - s.before) / s.before) * 100);
  return `<span class="nwp-d ${p > 0 ? "up" : p < 0 ? "down" : ""}">${p > 0 ? "+" : ""}${p}%</span>`;
}
const nwLinked = (k) => NW_LINKS.filter(([a, b]) => a === k || b === k).map(([a, b]) => (a === k ? b : a));
const nwFacts = (x) => (x.facts || []).length ? `<dl class="sm-facts">${x.facts.map(([a, v]) => `<div><dt>${esc(a)}</dt><dd>${esc(typeof v === "number" ? num(v) : v)}</dd></div>`).join("")}</dl>` : "";
/* a service, read out */
const nwServiceHTML = (x, links = "") => `<div class="sm-ph"><b>${esc(x.name)}</b><span class="tag ${NW_STATE[x.state][0]}">${NW_STATE[x.state][1]}</span></div>
  <span class="dim">${esc(x.does)}</span><span>${esc(x.line)}</span>${nwFacts(x)}${links}
  ${x.go ? `<button class="btn ghost sm" data-nwgo="${esc(x.go)}">Open ${esc(NW_OPEN[x.go] || "it")} →</button>` : ""}`;

/* ---- Analytics: the member's path ---- */
function nwDetailHTML() {
  const k = NW.pick, x = nwFind(k);
  if (!x) return `<b>A member's path</b><span class="dim">How the LABS Blueprint reads the app: they arrive (mostly from Instagram), join, see the Showroom and the labs, make work, other people respond, they earn standing, trade and talk — with the services outside and the foundations underneath. Drag to spin · tap one.</span>`;
  const links = nwLinked(k).map(nwFind).filter(Boolean).map((y) => `<button class="nwp-chip" data-nwk="${esc(y.key || y.id)}">${y.key ? `<i class="sm-dot ${y.state}"></i>` : ""}${esc(y.name)}</button>`).join("");
  if (x.key) return nwServiceHTML(x, links ? `<div class="nwp-links"><span class="dim">Feeds</span>${links}</div>` : "");
  const i = nwStages().indexOf(x);
  return `<div class="sm-ph"><span class="nwp-no">${String(i + 1).padStart(2, "0")}</span><b>${esc(x.name)}</b>${x.needs.length ? `<span class="tag warn">needs you</span>` : ""}</div><span class="dim">${esc(x.says)}</span>
    <div class="nw-big"><b>${esc(nwFmt(x, x.value))}</b><span>${esc(x.label)} · ${RANGE} days</span>${nwDelta(x)}</div><span class="dim nwp-was">${esc(nwFmt(x, x.before))} in the ${RANGE} days before</span>
    ${x.needs.length ? `<ul class="nw-needs">${x.needs.map((n) => `<li>${esc(n.text)}</li>`).join("")}</ul>` : ""}${nwFacts(x)}
    ${links ? `<div class="nwp-links"><span class="dim">Leans on</span>${links}</div>` : ""}
    <button class="btn ghost sm" data-nwgo="${esc(x.go)}">Open ${esc(x.goName)} →</button>`;
}
function pathCardHTML() {
  if (!D.network) return "";
  const row = (key, dot, name, line) => `<li><button data-nwk="${esc(key)}" class="${key === NW.pick ? "on" : ""}"><span class="sm-dot ${dot}"></span><span class="gl-n">${esc(name)}</span><span class="dim sm-l">${esc(line)}</span></button></li>`;
  return `<section class="rc gl sm rg" id="pathcard"><header><h3>A member's path</h3><span class="mono">the last ${RANGE} days · tap one</span></header>
    <div class="gl-b">${ringHTML("pathcv")}<div class="gl-side"><div class="gl-pick sm-pick" id="pathpick">${nwDetailHTML()}</div>
    <ol class="gl-list sm-list">${nwStages().map((s, i) => row(s.id, s.needs.length ? "warn" : "on", `${String(i + 1).padStart(2, "0")} ${s.name}`, `${nwFmt(s, s.value)} ${s.label}`)).join("")}</ol></div></div></section>`;
}
function nwSelect(k) {
  NW.pick = NW.pick === k ? "" : k;
  const d = $("#pathpick"); if (d) { d.innerHTML = nwDetailHTML(); nwWirePick(); }
  $$("#pathcard .sm-list [data-nwk]").forEach((b) => b.classList.toggle("on", b.dataset.nwk === NW.pick));
  if (NW.pick) ringAim("pathcv", NW.pick);
}
function nwWirePick() {
  $$("#pathpick [data-nwk]").forEach((b) => b.onclick = () => nwSelect(b.dataset.nwk));
  $$("#pathpick [data-nwgo]").forEach((b) => b.onclick = () => go(b.dataset.nwgo));
}
function pathWire() {   // from WIRES.analytics
  if (!$("#pathcv")) return;
  $$("#pathcard .sm-list [data-nwk]").forEach((b) => b.onclick = () => nwSelect(b.dataset.nwk)); nwWirePick();
  ringMount("pathcv", { center: "LABS", pick: () => NW.pick, onPick: nwSelect,
    inner: () => nwStages().map((s) => ({ key: s.id, name: s.name, value: nwShort(s.value, s.money), state: s.needs.length ? "warn" : "on" })),
    outer: () => nwAll().map((s) => ({ key: s.key, name: s.name, state: s.state })) });
}

/* ---- Echo Home: the to-do ---- */
const tdFind = (k) => k.startsWith("s:") ? nwSections().find((s) => "s:" + s.id === k) : nwAll().find((s) => s.key === k);
function todoPickHTML() {
  const x = tdFind(NW.todo || "");
  if (!x) { const n = nwSections().reduce((a, s) => a + s.needs.length, 0); return `<b>${n ? `${n} thing${n === 1 ? "" : "s"} need${n === 1 ? "s" : ""} you` : "Nothing needs you"}</b><span class="dim">Every part of the dashboard round LABS — red where something's waiting. Drag to spin · tap one.</span>`; }
  if (x.key) return nwServiceHTML(x);
  return `<div class="sm-ph"><b>${esc(x.name)}</b>${x.needs.length ? `<span class="tag warn">needs you</span>` : `<span class="tag on">clear</span>`}</div><span class="dim">${esc(x.does)}</span>
    <div class="nw-big"><b>${esc(num(x.value))}</b><span>${esc(x.label)}</span></div>
    ${x.needs.length ? `<ul class="nw-needs">${x.needs.map((n) => `<li>${esc(n.text)}</li>`).join("")}</ul>` : ""}
    <button class="btn ghost sm" data-nwgo="${esc(x.id)}">Open ${esc(x.name)} →</button>`;
}
/* the Needs you card: the model on top, the full queue under it */
function todoCardHTML(needs) {
  const list = `<div class="q">${needs.length ? needs.map(queueHTML).join("") : `<div class="clear">${I.check} Nothing waiting.</div>`}</div>`;
  if (!D.network) return card("Needs you", `<div class="body">${list}</div>`, needs.length ? String(needs.length) : "");
  return `<section class="rc rg td" id="todocard"><header><h3>Needs you</h3><span class="mono">${needs.length || ""}</span></header>
    ${ringHTML("todocv")}<div class="gl-pick sm-pick td-pick" id="todopick">${todoPickHTML()}</div><div class="body">${list}</div></section>`;
}
function todoSelect(k) {
  NW.todo = NW.todo === k ? "" : k;
  const d = $("#todopick"); if (d) { d.innerHTML = todoPickHTML(); $$("#todopick [data-nwgo]").forEach((b) => b.onclick = () => go(b.dataset.nwgo)); }
  if (NW.todo) ringAim("todocv", NW.todo);
}
function todoWire() {   // from WIRES.echohome
  if (!$("#todocv")) return;
  $$("#todopick [data-nwgo]").forEach((b) => b.onclick = () => go(b.dataset.nwgo));
  ringMount("todocv", { center: "LABS", pick: () => NW.todo, onPick: todoSelect,
    inner: () => nwSections().map((s) => ({ key: "s:" + s.id, name: s.name, value: s.needs.length ? s.needs.length : nwShort(s.value), state: s.needs.length ? "warn" : "on" })),
    outer: () => nwAll().map((s) => ({ key: s.key, name: s.name, state: s.state })) });
}
