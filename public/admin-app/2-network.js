/* LABS admin — the Network v1.0, 2026-11-04 ("I don't see the interactive admin dashboard network. Make the whole admin
   dashboard interactive."). Its own section, in the phone's bar: the whole dashboard as one model you can spin. LABS in
   the middle; round it every section with its live number — red when something in it needs you — and round those,
   every service LABS runs on (green working, red needs a look, an outline in motion, grey not connected). Traffic moves
   along the lines. Tap anything (or its row) for what it is, its numbers and what needs you, and Open goes there.
   Data: GET /api/admin/network (server/admin/network). Drawn by hand on a canvas, palette colours only; spins on its
   own unless reduced motion is on, and stops when the Network isn't on screen. */
const NW = { yaw: 0.2, pitch: 0.82, vel: 0, drag: null, idle: 0, pick: "", raf: 0, hit: [], to: null, aimed: false };
const NW_TAG = { on: "on", warn: "warn", wait: "wait", off: "" }, NW_WORD = { on: "working", warn: "needs a look", wait: "in motion", off: "not connected" };
const NW_OPEN = { people: "Members", market: "Market", content: "Content", events: "Events", instagram: "Instagram", knowledge: "Knowledge", echo: "Help desk", settings: "Settings", analytics: "Analytics", health: "Health", echohome: "Echo", systems: "Systems" };
LOADERS.network = async () => { D.network = await req("/api/admin/network"); };
const nwSec = () => (D.network && D.network.sections) || [];
/* the services; the server is "Server" here, so it isn't taken for LABS in the middle */
const nwSvc = () => ((D.network && D.network.services) || []).map((x) => (x.id === "labs" ? { ...x, name: "Server" } : x));
const nwFind = (id) => nwSec().find((x) => x.id === id) || nwSvc().find((x) => "s:" + x.id === id);
function nwPickHTML() {
  const x = nwFind(NW.pick);
  if (!x) { const n = nwSec().reduce((a, s) => a + s.needs.length, 0); return `<b>${n ? `${n} thing${n === 1 ? "" : "s"} need${n === 1 ? "s" : ""} you` : "Nothing needs you"}</b><span class="dim">Drag to spin · tap a section or a service</span>`; }
  if (NW.pick.startsWith("s:")) return `<div class="sm-ph"><b>${esc(x.name)}</b><span class="tag ${NW_TAG[x.state]}">${NW_WORD[x.state]}</span></div><span class="dim">${esc(x.does)}</span><span>${esc(x.line)}</span>
    ${x.facts.length ? `<dl class="sm-facts">${x.facts.map(([k, v]) => `<div><dt>${esc(k)}</dt><dd>${esc(typeof v === "number" ? num(v) : v)}</dd></div>`).join("")}</dl>` : ""}
    <button class="btn ghost sm" data-nwgo="${esc(x.go === "systems" ? "systems" : x.go)}">Open ${esc(NW_OPEN[x.go] || "it")} →</button>`;
  return `<div class="sm-ph"><b>${esc(x.name)}</b>${x.needs.length ? `<span class="tag warn">needs you</span>` : ""}</div><span class="dim">${esc(x.does)}</span>
    <div class="nw-big"><b>${esc(num(x.value))}</b><span>${esc(x.label)}</span></div>
    ${x.needs.length ? `<ul class="nw-needs">${x.needs.map((n) => `<li>${esc(n.text)}</li>`).join("")}</ul>` : ""}
    ${x.facts.length ? `<dl class="sm-facts">${x.facts.map(([k, v]) => `<div><dt>${esc(k)}</dt><dd>${esc(typeof v === "number" ? num(v) : v)}</dd></div>`).join("")}</dl>` : ""}
    <button class="btn ghost sm" data-nwgo="${esc(x.id)}">Open ${esc(x.name)} →</button>`;
}
VIEWS.network = () => {
  const N = D.network, head = pageHead("Network", "The whole dashboard as one model: every section and every service LABS runs on. Tap one to open it.");
  if (!N) return `${head}<section class="rc gl"><div class="gl-b"><div class="gl-ph"></div></div></section>`;
  const sec = [...nwSec()].sort((a, b) => b.needs.length - a.needs.length), svc = [...nwSvc()].sort((a, b) => ["warn", "wait", "on", "off"].indexOf(a.state) - ["warn", "wait", "on", "off"].indexOf(b.state));
  if (!NW.pick) { const s = sec.find((x) => x.needs.length); if (s) NW.pick = s.id; }
  const row = (id, dot, name, line) => `<li><button data-nwn="${esc(id)}" class="${id === NW.pick ? "on" : ""}"><span class="sm-dot ${dot}"></span><span class="gl-n">${esc(name)}</span><span class="dim sm-l">${esc(line)}</span></button></li>`;
  return `${head}<section class="rc gl sm nw" id="network"><div class="gl-b"><div class="gl-w nw-w"><canvas id="nwcv" role="img" aria-label="A model of the dashboard and the services LABS runs on"></canvas></div>
    <div class="gl-side"><div class="gl-pick sm-pick" id="nwpick">${nwPickHTML()}</div>
    <h4 class="nw-h">The dashboard</h4><ol class="gl-list sm-list">${sec.map((s) => row(s.id, s.needs.length ? "warn" : "on", s.name, s.needs.length ? s.needs[0].text : `${num(s.value)} ${s.label}`)).join("")}</ol>
    <h4 class="nw-h">Runs on</h4><ol class="gl-list sm-list">${svc.map((s) => row("s:" + s.id, s.state, s.name, s.line)).join("")}</ol></div></div></section>`;
};
function nwGo(id) {
  NW.pick = NW.pick === id ? "" : id; NW.idle = performance.now();
  const p = $("#nwpick"); if (p) { p.innerHTML = nwPickHTML(); nwWirePick(); }
  $$("[data-nwn]").forEach((b) => b.classList.toggle("on", b.dataset.nwn === NW.pick));
  const front = nwFront(NW.pick); if (front !== null) { if (matchMedia("(prefers-reduced-motion: reduce)").matches) NW.yaw = front; else NW.to = { yaw: front, from: NW.yaw, t0: performance.now() }; }
}
/* the yaw that brings a node round to the front, the short way */
function nwFront(id) {
  const sec = nwSec(), svc = nwSvc(); let a = null;
  const i = sec.findIndex((x) => x.id === id), j = svc.findIndex((x) => "s:" + x.id === id);
  if (i >= 0) a = (i / sec.length) * Math.PI * 2; else if (j >= 0) a = (j / svc.length) * Math.PI * 2 + Math.PI / svc.length; else return null;
  let d = (Math.PI / 2 - a - NW.yaw) % (Math.PI * 2); if (d > Math.PI) d -= Math.PI * 2; if (d < -Math.PI) d += Math.PI * 2; return NW.yaw + d;
}
function nwWirePick() { $$("[data-nwgo]").forEach((b) => b.onclick = () => go(b.dataset.nwgo)); }
WIRES.network = () => {
  const cv = $("#nwcv"); if (!cv) return;
  $$("[data-nwn]").forEach((b) => b.onclick = () => nwGo(b.dataset.nwn)); nwWirePick();
  if (!NW.aimed && NW.pick) { NW.aimed = true; const f = nwFront(NW.pick); if (f !== null) NW.yaw = f; }
  cv.onpointerdown = (e) => { NW.drag = { x: e.clientX, y: e.clientY, x0: e.clientX, y0: e.clientY, t: performance.now(), moved: false }; NW.to = null; NW.vel = 0; try { cv.setPointerCapture(e.pointerId); } catch (x) {} };
  cv.onpointermove = (e) => {
    const g = NW.drag; if (!g) return; const w = cv.clientWidth, dx = e.clientX - g.x, dy = e.clientY - g.y, dt = Math.max(1, performance.now() - g.t);
    if (Math.abs(e.clientX - g.x0) + Math.abs(e.clientY - g.y0) > 5) g.moved = true;
    NW.yaw += (dx / w) * 3; if (e.pointerType !== "touch") NW.pitch = Math.max(0.3, Math.min(1.1, NW.pitch + (dy / w) * 2));
    NW.vel = ((dx / w) * 3) / dt; g.x = e.clientX; g.y = e.clientY; g.t = performance.now();
  };
  cv.onpointerup = (e) => { const g = NW.drag; NW.drag = null; NW.idle = performance.now(); if (g && !g.moved) { const b = cv.getBoundingClientRect(), x = e.clientX - b.left, y = e.clientY - b.top;
    const hit = NW.hit.filter((h) => Math.hypot(h.x - x, h.y - y) < h.r + 12).sort((a, c) => c.z - a.z)[0]; if (hit) nwGo(hit.id); } };
  cv.onpointercancel = () => { NW.drag = null; NW.idle = performance.now(); };
  if (!NW.raf) NW.raf = requestAnimationFrame(nwFrame);
};
function nwFrame(now) {
  const cv = $("#nwcv"); if (!cv || !cv.isConnected || TAB !== "network") { NW.raf = 0; return; }
  NW.raf = requestAnimationFrame(nwFrame);
  const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches, w = cv.clientWidth, h = cv.clientHeight; if (!w || !h) return;
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  if (cv.width !== Math.round(w * dpr) || cv.height !== Math.round(h * dpr)) { cv.width = Math.round(w * dpr); cv.height = Math.round(h * dpr); }
  const dt = Math.min(64, now - (NW.last || now)); NW.last = now;
  if (NW.to) { const k = Math.min(1, (now - NW.to.t0) / 650), e = 1 - Math.pow(1 - k, 3); NW.yaw = NW.to.from + (NW.to.yaw - NW.to.from) * e; if (k >= 1) NW.to = null; }
  else if (!NW.drag && !reduce) { if (Math.abs(NW.vel) > 0.00002) { NW.yaw += NW.vel * dt; NW.vel *= Math.pow(0.93, dt / 16); } else if (!NW.pick && now - NW.idle > 2500) NW.yaw += dt * 0.0001; }
  const sec = nwSec(), svc = nwSvc(); if (!sec.length) return;
  const c = cv.getContext("2d"), cs = getComputedStyle(document.documentElement), col = (v) => cs.getPropertyValue(v).trim();
  const C = { on: col("--accent-fill"), warn: col("--red"), wait: col("--tx"), off: col("--dim"), tx: col("--tx"), dim: col("--dim"), card: col("--card"), el: col("--el"), line: col("--line2"), onAcc: col("--on-accent") };
  const W = cv.width, H = cv.height, cx = W / 2, cy = H * 0.5, Rr = Math.min(W * 0.37, H * 0.6), f = Rr * 4.2, u = Math.min(w, h * 1.3) / 400;
  c.setTransform(1, 0, 0, 1, 0, 0); c.clearRect(0, 0, W, H);
  const P = (x, y, z) => { const a = Math.cos(NW.yaw), b = Math.sin(NW.yaw), x1 = x * a - z * b, z1 = x * b + z * a, cp = Math.cos(NW.pitch), sp = Math.sin(NW.pitch);
    const y2 = y * cp + z1 * sp, z2 = z1 * cp - y * sp, s = f / (f - z2); return { x: cx + x1 * s, y: cy + y2 * s, z: z2, s }; };
  const pos = { labs: P(0, 0, 0) }, r1 = Rr * 0.58;
  sec.forEach((s, i) => { const a = (i / sec.length) * Math.PI * 2; pos[s.id] = P(Math.cos(a) * r1, -Rr * 0.04, Math.sin(a) * r1); });
  svc.forEach((s, i) => { const a = (i / svc.length) * Math.PI * 2 + Math.PI / svc.length; pos["s:" + s.id] = P(Math.cos(a) * Rr, Rr * 0.06, Math.sin(a) * Rr); });
  const orbit = (r, y) => { c.globalAlpha = 0.45; c.strokeStyle = C.line; c.lineWidth = dpr; c.beginPath(); for (let k = 0; k <= 72; k++) { const a = (k / 72) * Math.PI * 2, p = P(Math.cos(a) * r, y, Math.sin(a) * r); k ? c.lineTo(p.x, p.y) : c.moveTo(p.x, p.y); } c.stroke(); };
  orbit(r1, -Rr * 0.04); orbit(Rr, Rr * 0.06);
  /* lines: each section to LABS; each service to LABS, quieter */
  const lines = [...sec.map((s) => ({ id: s.id, a: pos[s.id], st: s.needs.length ? "warn" : "on", main: true })), ...svc.map((s) => ({ id: "s:" + s.id, a: pos["s:" + s.id], st: s.state, main: false }))];
  for (const L of lines) { c.globalAlpha = L.st === "off" ? 0.25 : L.main ? 0.5 : 0.28; c.strokeStyle = C[L.st]; c.lineWidth = (L.main ? 1.5 : 1) * dpr; c.setLineDash(L.st === "off" ? [3 * dpr, 5 * dpr] : []); c.beginPath(); c.moveTo(L.a.x, L.a.y); c.lineTo(pos.labs.x, pos.labs.y); c.stroke(); }
  c.setLineDash([]);
  if (!reduce) lines.forEach((L, i) => { if (L.st === "off") return; for (let j = 0; j < (L.main ? 2 : 1); j++) { const t = (now * (L.main ? 0.0003 : 0.0002) + j / 2 + i * 0.173) % 1, tt = i % 2 ? t : 1 - t;
    c.globalAlpha = Math.sin(t * Math.PI) * (L.main ? 1 : 0.7); c.fillStyle = C[L.st]; c.beginPath(); c.arc(L.a.x + (pos.labs.x - L.a.x) * tt, L.a.y + (pos.labs.y - L.a.y) * tt, (L.main ? 2.4 : 1.8) * dpr, 0, 7); c.fill(); } });
  /* nodes, back to front */
  const draw = [{ id: "labs", kind: "core" }, ...sec.map((s) => ({ id: s.id, kind: "sec", n: s })), ...svc.map((s) => ({ id: "s:" + s.id, kind: "svc", n: s }))].map((d) => ({ ...d, p: pos[d.id] })).sort((a, b) => a.p.z - b.p.z);
  NW.hit = []; c.textAlign = "center";
  const font = (wgt, px) => `${wgt} ${Math.round(px)}px Helvetica, Arial, sans-serif`;
  for (const { id, kind, n, p } of draw) {
    const depth = Math.max(0.4, Math.min(1, 0.72 + p.z / (Rr * 2))), picked = NW.pick === id;
    if (kind === "core") { const r = 26 * u * dpr * p.s, g = c.createRadialGradient(p.x, p.y, r * 0.5, p.x, p.y, r * 2.4); g.addColorStop(0, C.on); g.addColorStop(1, "transparent");
      c.globalAlpha = 0.3; c.fillStyle = g; c.beginPath(); c.arc(p.x, p.y, r * 2.4, 0, 7); c.fill(); c.globalAlpha = 1; c.fillStyle = C.on; c.beginPath(); c.arc(p.x, p.y, r, 0, 7); c.fill();
      c.fillStyle = C.onAcc; c.font = font(700, r * 0.5); c.textBaseline = "middle"; c.fillText("LABS", p.x, p.y); continue; }
    if (kind === "sec") {
      const r = 14 * u * dpr * p.s, hot = n.needs.length > 0;
      if (hot) { c.globalAlpha = 0.2 * depth; c.fillStyle = C.warn; c.beginPath(); c.arc(p.x, p.y, r * 1.7, 0, 7); c.fill(); }
      c.globalAlpha = depth; c.fillStyle = C.card; c.beginPath(); c.arc(p.x, p.y, r, 0, 7); c.fill();
      c.lineWidth = (picked ? 3 : 2) * dpr; c.strokeStyle = picked ? C.tx : hot ? C.warn : C.on; c.stroke();
      const v = n.value >= 10000 ? Math.round(n.value / 1000) + "k" : String(n.value);
      c.fillStyle = C.tx; c.font = font(700, r * (v.length > 3 ? 0.62 : 0.78)); c.textBaseline = "middle"; c.fillText(v, p.x, p.y + r * 0.04);
      if (hot) { c.fillStyle = C.warn; c.beginPath(); c.arc(p.x + r * 0.74, p.y - r * 0.74, r * 0.26, 0, 7); c.fill(); }
      c.globalAlpha = Math.max(0.55, depth); c.fillStyle = C.tx; c.font = font(picked ? 700 : 600, 11 * u * dpr * Math.min(1.1, p.s)); c.textBaseline = "top"; c.fillText(n.name, p.x, p.y + r + 3 * dpr);
      NW.hit.push({ id, x: p.x / dpr, y: p.y / dpr, r: r / dpr, z: p.z }); continue; }
    const r = 8 * u * dpr * p.s, st = n.state;
    c.globalAlpha = depth * (st === "off" ? 0.6 : 1); c.fillStyle = st === "off" ? C.el : st === "wait" ? C.card : C[st]; c.beginPath(); c.arc(p.x, p.y, r, 0, 7); c.fill();
    c.lineWidth = (picked ? 2.5 : 1.5) * dpr; c.strokeStyle = picked ? C.tx : C[st]; c.stroke();
    if (p.z > -Rr * 0.2 || picked) { c.globalAlpha = Math.max(0.45, depth) * (st === "off" ? 0.75 : 1); c.fillStyle = st === "off" ? C.dim : C.tx; c.font = font(picked ? 700 : 400, 10 * u * dpr * Math.min(1.1, p.s)); c.textBaseline = "top"; c.fillText(n.name, p.x, p.y + r + 3 * dpr); }
    NW.hit.push({ id, x: p.x / dpr, y: p.y / dpr, r: r / dpr, z: p.z });
  }
  c.globalAlpha = 1; c.textBaseline = "alphabetic";
}
