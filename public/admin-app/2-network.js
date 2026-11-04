/* LABS admin — the Network v1.0, 2026-11-04 ("I don't see the interactive admin dashboard network. Make the whole admin
   dashboard interactive" — "use the organization" of the LABS Blueprint, not its look). Its own section, in the phone's bar.
   LABS the way the Blueprint (sheet A-0) reads it: a member's path, left to right — Arrive · Join · See · Make · Respond ·
   Earn · Trade · Talk — each stage with its number for the date range, the change from the range before, and what needs
   you there; across the top, the outside world each stage leans on; underneath, the foundations. Traffic moves along the
   path; tap anything to light up what it connects to, read its numbers, and open the page that runs it.
   Data: GET /api/admin/network (server/admin/network). LABS's own look — palette colours, cards, Helvetica. The lines are a
   canvas laid over the cards; it moves unless reduced motion is on, and stops when the Network isn't on screen. */
const NW = { pick: "", raf: 0 };
/* what leans on what — the Blueprint's lines, between the cards on this page */
const NW_LINKS = [["o:meta", "arrive"], ["o:cloudflare", "arrive"], ["o:google", "arrive"], ["o:resend", "join"], ["o:stripe", "trade"], ["o:resend", "talk"], ["o:claude", "talk"],
  ["o:railway", "b:labs"], ["o:github", "b:labs"], ["o:connector", "b:labs"], ["b:trust", "join"], ["b:trust", "respond"], ["b:members", "see"], ["b:labs", "see"], ["b:data", "earn"]];
const NW_RANGES = [7, 30, 90];
LOADERS.network = async () => { D.network = await req(`/api/admin/network?days=${RANGE}`); };
const nwStages = () => (D.network && D.network.stages) || [];
const nwAll = () => { const N = D.network || {}; return [...(N.outside || []).map((x) => ({ ...x, key: "o:" + x.id })), ...(N.base || []).map((x) => ({ ...x, key: "b:" + x.id }))]; };
const nwFind = (k) => nwStages().find((s) => s.id === k) || nwAll().find((s) => s.key === k);
const nwFmt = (s, v) => (s.money ? money(v) : num(v));
function nwDelta(s) {
  if (!s.before && !s.value) return `<span class="nwp-d">—</span>`;
  if (!s.before) return `<span class="nwp-d up">new</span>`;
  const p = Math.round(((s.value - s.before) / s.before) * 100);
  return `<span class="nwp-d ${p > 0 ? "up" : p < 0 ? "down" : ""}">${p > 0 ? "+" : ""}${p}%</span>`;
}
const nwLinked = (k) => NW_LINKS.filter(([a, b]) => a === k || b === k).map(([a, b]) => (a === k ? b : a));
function nwChip(x) { return `<button class="nwp-chip ${x.key === NW.pick ? "on" : ""}" data-nwk="${esc(x.key)}"><i class="sm-dot ${x.state}"></i>${esc(x.name)}</button>`; }
function nwDetailHTML() {
  const k = NW.pick, x = nwFind(k);
  if (!x) {
    const n = nwStages().reduce((a, s) => a + s.needs.length, 0);
    return `<h3>How to read it</h3><p class="dim">A member's path, left to right: they arrive (mostly from Instagram), join, see the Showroom and the labs, make work, other people respond, they earn standing, trade in the Market and talk. Across the top, what each stage leans on outside LABS; underneath, the foundations. ${n ? `<b>${n} thing${n === 1 ? "" : "s"} need${n === 1 ? "s" : ""} you</b> — the stages with a red dot.` : "Nothing needs you right now."} Tap any card.</p>`;
  }
  const links = nwLinked(k).map(nwFind).filter(Boolean).map((y) => `<button class="nwp-chip" data-nwk="${esc(y.id && !y.key ? y.id : y.key)}">${y.key ? `<i class="sm-dot ${y.state}"></i>` : ""}${esc(y.name)}</button>`).join("");
  const facts = (x.facts || []).length ? `<dl class="sm-facts">${x.facts.map(([a, v]) => `<div><dt>${esc(a)}</dt><dd>${esc(typeof v === "number" ? num(v) : v)}</dd></div>`).join("")}</dl>` : "";
  if (!x.key) {
    const i = nwStages().indexOf(x);
    return `<div class="sm-ph"><span class="nwp-no">${String(i + 1).padStart(2, "0")}</span><h3>${esc(x.name)}</h3>${x.needs.length ? `<span class="tag warn">needs you</span>` : ""}</div><p class="dim">${esc(x.says)}</p>
      <div class="nw-big"><b>${esc(nwFmt(x, x.value))}</b><span>${esc(x.label)} · ${RANGE} days</span>${nwDelta(x)}</div><p class="dim nwp-was">${esc(nwFmt(x, x.before))} in the ${RANGE} days before</p>
      ${x.needs.length ? `<ul class="nw-needs">${x.needs.map((n) => `<li>${esc(n.text)}</li>`).join("")}</ul>` : ""}${facts}
      ${links ? `<div class="nwp-links"><span class="dim">Leans on</span>${links}</div>` : ""}
      <button class="btn ghost sm" data-nwgo="${esc(x.go)}">Open ${esc(x.goName)} →</button>`;
  }
  return `<div class="sm-ph"><h3>${esc(x.name)}</h3><span class="tag ${{ on: "on", warn: "warn", wait: "wait" }[x.state] || ""}">${{ on: "working", warn: "needs a look", wait: "in motion", off: "not connected" }[x.state]}</span></div>
    <p class="dim">${esc(x.does)}</p><p>${esc(x.line)}</p>${facts}${links ? `<div class="nwp-links"><span class="dim">Feeds</span>${links}</div>` : ""}
    ${x.go ? `<button class="btn ghost sm" data-nwgo="${esc(x.go)}">Open ${esc({ health: "Health", settings: "Settings", market: "Market", echohome: "Echo", instagram: "Instagram", systems: "Systems", content: "Content" }[x.go] || "it")} →</button>` : ""}`;
}
VIEWS.network = () => {
  const N = D.network, seg = `<div class="seg" role="group" aria-label="Date range">${NW_RANGES.map((d) => `<button class="${RANGE === d ? "on" : ""}" data-nwr="${d}">${d} days</button>`).join("")}</div>`;
  const head = pageHead("Network", "LABS as a member's path — arrive, join, see, make, respond, earn, trade, talk — with what it leans on. Tap any card.", seg);
  if (!N) return `${head}<section class="rc nwp"><div class="nwp-ph"></div></section>`;
  const tile = (s, i) => `<li><button class="nwp-st ${s.id === NW.pick ? "on" : ""} ${s.needs.length ? "hot" : ""}" data-nwk="${s.id}">
    <span class="nwp-no">${String(i + 1).padStart(2, "0")}</span><b class="nwp-nm">${esc(s.name)}</b>
    <span class="nwp-v">${esc(nwFmt(s, s.value))}</span><span class="nwp-l">${esc(s.label)}</span>${nwDelta(s)}</button></li>`;
  return `${head}<section class="rc nwp" id="nwp"><canvas class="nwp-cv" id="nwcv" aria-hidden="true"></canvas>
    <div class="nwp-band"><span class="nwp-bl">Outside the app</span><div class="nwp-row">${(N.outside || []).map((x) => nwChip({ ...x, key: "o:" + x.id })).join("")}</div></div>
    <div class="nwp-band"><span class="nwp-bl">A member's path</span><ol class="nwp-path">${nwStages().map(tile).join("")}</ol></div>
    <div class="nwp-band"><span class="nwp-bl">Foundations</span><div class="nwp-row">${(N.base || []).map((x) => nwChip({ ...x, key: "b:" + x.id })).join("")}</div></div></section>
    <section class="rc nwp-det" id="nwdet">${nwDetailHTML()}</section>`;
};
function nwSelect(k) {
  NW.pick = NW.pick === k ? "" : k;
  $$("[data-nwk]").forEach((b) => b.classList.toggle("on", b.dataset.nwk === NW.pick && !b.closest("#nwdet")));
  const d = $("#nwdet"); if (d) { d.innerHTML = nwDetailHTML(); nwWireDetail(); }
  NW.dirty = true;
}
function nwWireDetail() {
  $$("#nwdet [data-nwk]").forEach((b) => b.onclick = () => { nwSelect(b.dataset.nwk); if (innerWidth < 1024) $("#nwp").scrollIntoView({ block: "start", behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth" }); });
  $$("[data-nwgo]").forEach((b) => b.onclick = () => go(b.dataset.nwgo));
}
WIRES.network = () => {
  $$("#nwp [data-nwk]").forEach((b) => b.onclick = () => nwSelect(b.dataset.nwk));
  $$("[data-nwr]").forEach((b) => b.onclick = () => { RANGE = +b.dataset.nwr; try { localStorage.setItem("tnl-admin-range", RANGE); } catch (e) {} D.network = null; paint(); load(); });
  nwWireDetail(); NW.dirty = true;
  if ($("#nwcv") && !NW.raf) NW.raf = requestAnimationFrame(nwFrame);
};
/* the lines between the cards: the path, heavy and moving; what leans on what, quiet — lit up when one end is picked */
function nwFrame(now) {
  const cv = $("#nwcv"), box = $("#nwp");
  if (!cv || !box || !cv.isConnected || TAB !== "network") { NW.raf = 0; return; }
  NW.raf = requestAnimationFrame(nwFrame);
  const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const br = box.getBoundingClientRect(), dpr = Math.min(2, window.devicePixelRatio || 1);
  if (cv.width !== Math.round(br.width * dpr) || cv.height !== Math.round(br.height * dpr)) { cv.width = Math.round(br.width * dpr); cv.height = Math.round(br.height * dpr); NW.dirty = true; }
  if (reduce && !NW.dirty) return; NW.dirty = false;
  const at = (k) => { const el = box.querySelector(`[data-nwk="${CSS.escape(k)}"]`); if (!el) return null; const r = el.getBoundingClientRect(); return { x: (r.left - br.left) * dpr, y: (r.top - br.top) * dpr, w: r.width * dpr, h: r.height * dpr }; };
  const c = cv.getContext("2d"), cs = getComputedStyle(document.documentElement), col = (v) => cs.getPropertyValue(v).trim();
  const acc = col("--accent-fill"), line = col("--line2"), red = col("--red"), tx = col("--tx");
  c.setTransform(1, 0, 0, 1, 0, 0); c.clearRect(0, 0, cv.width, cv.height);
  const pick = NW.pick, lit = new Set(pick ? [pick, ...nwLinked(pick)] : []);
  /* edge points: leave one card and enter the other on the facing sides */
  const ends = (A, B) => {
    const ac = { x: A.x + A.w / 2, y: A.y + A.h / 2 }, bc = { x: B.x + B.w / 2, y: B.y + B.h / 2 };
    if (Math.abs(ac.y - bc.y) < Math.min(A.h, B.h) / 2) return ac.x < bc.x ? [{ x: A.x + A.w, y: ac.y }, { x: B.x, y: bc.y }] : [{ x: A.x, y: ac.y }, { x: B.x + B.w, y: bc.y }];
    return ac.y < bc.y ? [{ x: ac.x, y: A.y + A.h }, { x: bc.x, y: B.y }] : [{ x: ac.x, y: A.y }, { x: bc.x, y: B.y + B.h }];
  };
  const curve = (p, q) => { const my = (p.y + q.y) / 2; c.beginPath(); c.moveTo(p.x, p.y); if (Math.abs(p.y - q.y) < 2) c.lineTo(q.x, q.y); else c.bezierCurveTo(p.x, my, q.x, my, q.x, q.y); };
  const pt = (p, q, t) => { if (Math.abs(p.y - q.y) < 2) return { x: p.x + (q.x - p.x) * t, y: p.y };
    const my = (p.y + q.y) / 2, u = 1 - t; return { x: u * u * u * p.x + 3 * u * u * t * p.x + 3 * u * t * t * q.x + t * t * t * q.x, y: u * u * u * p.y + 3 * u * u * t * my + 3 * u * t * t * my + t * t * t * q.y }; };
  /* what leans on what */
  for (const [a, b] of NW_LINKS) {
    const A = at(a), B = at(b); if (!A || !B) continue;
    const on = pick && (a === pick || b === pick), sv = nwFind(a), warn = sv && (sv.state === "warn"), off = sv && sv.state === "off";
    c.globalAlpha = pick ? (on ? 0.9 : 0.08) : 0.35; c.strokeStyle = warn ? red : on ? tx : line; c.lineWidth = (on ? 1.6 : 1) * dpr; c.setLineDash(off ? [3 * dpr, 4 * dpr] : []);
    const [p, q] = ends(A, B); curve(p, q); c.stroke();
    if (on && !reduce && !off) { const t = ((now / 1400) % 1); const d = pt(p, q, t); c.globalAlpha = Math.sin(t * Math.PI); c.fillStyle = warn ? red : tx; c.beginPath(); c.arc(d.x, d.y, 2.2 * dpr, 0, 7); c.fill(); }
  }
  c.setLineDash([]);
  /* the path */
  const st = nwStages();
  for (let i = 0; i + 1 < st.length; i++) {
    const A = at(st[i].id), B = at(st[i + 1].id); if (!A || !B) continue;
    const [p, q] = ends(A, B), on = !pick || lit.has(st[i].id) || lit.has(st[i + 1].id) || pick === st[i].id;
    c.globalAlpha = on ? 0.95 : 0.25; c.strokeStyle = acc; c.lineWidth = 3 * dpr; curve(p, q); c.stroke();
    if (reduce) continue;
    const busy = Math.min(3, 1 + Math.floor(Math.log10(1 + (st[i].value || 0))));   // more traffic, more dots
    for (let j = 0; j < busy; j++) { const t = ((now / 1800) + j / busy + i * 0.13) % 1, d = pt(p, q, t); c.globalAlpha = (on ? 1 : 0.3) * Math.sin(t * Math.PI); c.fillStyle = acc; c.beginPath(); c.arc(d.x, d.y, 3 * dpr, 0, 7); c.fill(); }
  }
  c.globalAlpha = 1;
}
