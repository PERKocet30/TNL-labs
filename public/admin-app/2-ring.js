/* LABS admin — the 3D ring v1.0, 2026-11-04 ("this interactive dashboard is way better and should be front of the admin
   dashboard, like Echo's to-do, Members and Analytics" — said of the Systems map). One engine for the spinning models at the
   front of the pages: something in the middle, an inner ring of big nodes (a number inside, red when it needs you), an outer
   ring of small ones (green working, red needs a look, an outline in motion, grey off), traffic moving along the lines.
   Drag to spin; tap a node (or its row) and it comes round to the front. Used by Echo Home (the to-do: every section and
   service, 2-echo-home.js) and Analytics (the member's path, 9-analytics.js); the Systems map (7-systems6-map.js) and the
   globe (3-globe.js) are its older siblings. Drawn by hand on a canvas, palette colours only; spins on its own unless
   reduced motion is on, and stops when its canvas leaves the page.
     ringHTML(id)            the canvas, in a square-ish frame
     ringMount(id, opts)     opts: { center, inner(), outer(), pick(), onPick(key) } — nodes are { key, name, value?, state }
     ringAim(id, key)        turn the ring so that node is in front */
const RINGS = {};
const ringHTML = (id) => `<div class="gl-w rg-w"><canvas id="${id}" role="img" aria-label="A model you can spin: tap a node"></canvas></div>`;
function ringMount(id, opts) {
  const cv = $("#" + id); if (!cv) return;
  const R = RINGS[id] || (RINGS[id] = { yaw: 0.25, pitch: 0.82, vel: 0, drag: null, idle: 0, to: null, hit: [], raf: 0, aimed: false });
  R.opts = opts;
  if (!R.aimed && opts.pick()) { R.aimed = true; const f = ringFront(id, opts.pick()); if (f !== null) R.yaw = f; }
  cv.onpointerdown = (e) => { R.drag = { x: e.clientX, y: e.clientY, x0: e.clientX, y0: e.clientY, t: performance.now(), moved: false }; R.to = null; R.vel = 0; try { cv.setPointerCapture(e.pointerId); } catch (x) {} };
  cv.onpointermove = (e) => {
    const g = R.drag; if (!g) return; const w = cv.clientWidth, dx = e.clientX - g.x, dy = e.clientY - g.y, dt = Math.max(1, performance.now() - g.t);
    if (Math.abs(e.clientX - g.x0) + Math.abs(e.clientY - g.y0) > 5) g.moved = true;
    R.yaw += (dx / w) * 3; if (e.pointerType !== "touch") R.pitch = Math.max(0.3, Math.min(1.1, R.pitch + (dy / w) * 2));
    R.vel = ((dx / w) * 3) / dt; g.x = e.clientX; g.y = e.clientY; g.t = performance.now();
  };
  cv.onpointerup = (e) => { const g = R.drag; R.drag = null; R.idle = performance.now(); if (g && !g.moved) { const b = cv.getBoundingClientRect(), x = e.clientX - b.left, y = e.clientY - b.top;
    const hit = R.hit.filter((h) => Math.hypot(h.x - x, h.y - y) < h.r + 12).sort((a, c) => c.z - a.z)[0]; if (hit) opts.onPick(hit.key); } };
  cv.onpointercancel = () => { R.drag = null; R.idle = performance.now(); };
  if (!R.raf) R.raf = requestAnimationFrame((t) => ringFrame(id, t));
}
/* the yaw that brings a node round to the front, the short way */
function ringFront(id, key) {
  const R = RINGS[id]; if (!R || !R.opts) return null;
  const inn = R.opts.inner(), out = R.opts.outer(); let a;
  const i = inn.findIndex((x) => x.key === key), j = out.findIndex((x) => x.key === key);
  if (i >= 0) a = (i / inn.length) * Math.PI * 2; else if (j >= 0) a = (j / out.length) * Math.PI * 2 + Math.PI / out.length; else return null;
  let d = (Math.PI / 2 - a - R.yaw) % (Math.PI * 2); if (d > Math.PI) d -= Math.PI * 2; if (d < -Math.PI) d += Math.PI * 2; return R.yaw + d;
}
function ringAim(id, key) {
  const R = RINGS[id], f = ringFront(id, key); if (!R || f === null) return; R.idle = performance.now();
  if (matchMedia("(prefers-reduced-motion: reduce)").matches) R.yaw = f; else R.to = { yaw: f, from: R.yaw, t0: performance.now() };
}
function ringFrame(id, now) {
  const R = RINGS[id], cv = $("#" + id);
  if (!R || !cv || !cv.isConnected) { if (R) R.raf = 0; return; }
  R.raf = requestAnimationFrame((t) => ringFrame(id, t));
  const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches, w = cv.clientWidth, h = cv.clientHeight; if (!w || !h) return;
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  if (cv.width !== Math.round(w * dpr) || cv.height !== Math.round(h * dpr)) { cv.width = Math.round(w * dpr); cv.height = Math.round(h * dpr); }
  const dt = Math.min(64, now - (R.last || now)); R.last = now;
  const pick = R.opts.pick();
  if (R.to) { const k = Math.min(1, (now - R.to.t0) / 650), e = 1 - Math.pow(1 - k, 3); R.yaw = R.to.from + (R.to.yaw - R.to.from) * e; if (k >= 1) R.to = null; }
  else if (!R.drag && !reduce) { if (Math.abs(R.vel) > 0.00002) { R.yaw += R.vel * dt; R.vel *= Math.pow(0.93, dt / 16); } else if (!pick && now - R.idle > 2500) R.yaw += dt * 0.0001; }
  const inn = R.opts.inner(), out = R.opts.outer(); if (!inn.length && !out.length) return;
  const c = cv.getContext("2d"), cs = getComputedStyle(document.documentElement), col = (v) => cs.getPropertyValue(v).trim();
  const C = { on: col("--accent-fill"), warn: col("--red"), wait: col("--tx"), off: col("--dim"), tx: col("--tx"), dim: col("--dim"), card: col("--card"), el: col("--el"), line: col("--line2"), onAcc: col("--on-accent") };
  const W = cv.width, H = cv.height, cx = W / 2, cy = H * 0.5, Rr = Math.min(W * 0.37, H * 0.6), f = Rr * 4.2, u = Math.min(w, h * 1.3) / 400;
  c.setTransform(1, 0, 0, 1, 0, 0); c.clearRect(0, 0, W, H);
  const P = (x, y, z) => { const a = Math.cos(R.yaw), b = Math.sin(R.yaw), x1 = x * a - z * b, z1 = x * b + z * a, cp = Math.cos(R.pitch), sp = Math.sin(R.pitch);
    const y2 = y * cp + z1 * sp, z2 = z1 * cp - y * sp, s = f / (f - z2); return { x: cx + x1 * s, y: cy + y2 * s, z: z2, s }; };
  const pos = { "": P(0, 0, 0) }, r1 = out.length ? Rr * 0.58 : Rr * 0.85;
  inn.forEach((s, i) => { const a = (i / inn.length) * Math.PI * 2; pos[s.key] = P(Math.cos(a) * r1, -Rr * 0.04, Math.sin(a) * r1); });
  out.forEach((s, i) => { const a = (i / out.length) * Math.PI * 2 + Math.PI / out.length; pos[s.key] = P(Math.cos(a) * Rr, Rr * 0.06, Math.sin(a) * Rr); });
  const orbit = (r, y) => { c.globalAlpha = 0.45; c.strokeStyle = C.line; c.lineWidth = dpr; c.beginPath(); for (let k = 0; k <= 72; k++) { const a = (k / 72) * Math.PI * 2, p = P(Math.cos(a) * r, y, Math.sin(a) * r); k ? c.lineTo(p.x, p.y) : c.moveTo(p.x, p.y); } c.stroke(); };
  orbit(r1, -Rr * 0.04); if (out.length) orbit(Rr, Rr * 0.06);
  /* lines to the middle, then the traffic on them */
  const lines = [...inn.map((s) => ({ a: pos[s.key], st: s.state, main: true })), ...out.map((s) => ({ a: pos[s.key], st: s.state, main: false }))], mid = pos[""];
  for (const L of lines) { c.globalAlpha = L.st === "off" ? 0.25 : L.main ? 0.5 : 0.28; c.strokeStyle = C[L.st] || C.on; c.lineWidth = (L.main ? 1.5 : 1) * dpr; c.setLineDash(L.st === "off" ? [3 * dpr, 5 * dpr] : []); c.beginPath(); c.moveTo(L.a.x, L.a.y); c.lineTo(mid.x, mid.y); c.stroke(); }
  c.setLineDash([]);
  if (!reduce) lines.forEach((L, i) => { if (L.st === "off") return; for (let j = 0; j < (L.main ? 2 : 1); j++) { const t = (now * (L.main ? 0.0003 : 0.0002) + j / 2 + i * 0.173) % 1, tt = i % 2 ? t : 1 - t;
    c.globalAlpha = Math.sin(t * Math.PI) * (L.main ? 1 : 0.7); c.fillStyle = C[L.st] || C.on; c.beginPath(); c.arc(L.a.x + (mid.x - L.a.x) * tt, L.a.y + (mid.y - L.a.y) * tt, (L.main ? 2.4 : 1.8) * dpr, 0, 7); c.fill(); } });
  /* nodes, back to front */
  const draw = [{ key: "", kind: "core" }, ...inn.map((n) => ({ key: n.key, kind: "in", n })), ...out.map((n) => ({ key: n.key, kind: "out", n }))].map((d) => ({ ...d, p: pos[d.key] })).sort((a, b) => a.p.z - b.p.z);
  R.hit = []; c.textAlign = "center";
  const font = (wgt, px) => `${wgt} ${Math.round(px)}px Helvetica, Arial, sans-serif`;
  for (const { key, kind, n, p } of draw) {
    const depth = Math.max(0.4, Math.min(1, 0.72 + p.z / (Rr * 2))), picked = pick === key;
    if (kind === "core") { const r = 26 * u * dpr * p.s, g = c.createRadialGradient(p.x, p.y, r * 0.5, p.x, p.y, r * 2.4); g.addColorStop(0, C.on); g.addColorStop(1, "transparent");
      c.globalAlpha = 0.3; c.fillStyle = g; c.beginPath(); c.arc(p.x, p.y, r * 2.4, 0, 7); c.fill(); c.globalAlpha = 1; c.fillStyle = C.on; c.beginPath(); c.arc(p.x, p.y, r, 0, 7); c.fill();
      c.fillStyle = C.onAcc; c.font = font(700, r * 0.5); c.textBaseline = "middle"; c.fillText(R.opts.center || "LABS", p.x, p.y); continue; }
    if (kind === "in") {
      const r = 15 * u * dpr * p.s, hot = n.state === "warn";
      c.globalAlpha = (hot ? 0.24 : 0.14) * depth; c.fillStyle = C[n.state] || C.on; c.beginPath(); c.arc(p.x, p.y, r * 1.75, 0, 7); c.fill();
      c.globalAlpha = depth; c.fillStyle = C.card; c.beginPath(); c.arc(p.x, p.y, r, 0, 7); c.fill();
      c.lineWidth = (picked ? 3 : 2) * dpr; c.strokeStyle = picked ? C.tx : C[n.state] || C.on; c.stroke();
      if (n.value !== undefined && n.value !== null) { const v = String(n.value); c.fillStyle = C.tx; c.font = font(700, r * (v.length > 4 ? 0.5 : v.length > 3 ? 0.6 : 0.78)); c.textBaseline = "middle"; c.fillText(v, p.x, p.y + r * 0.04); }
      else { c.fillStyle = C[n.state] || C.on; c.beginPath(); c.arc(p.x, p.y, r * 0.38, 0, 7); c.fill(); }
      c.globalAlpha = Math.max(0.55, depth); c.fillStyle = C.tx; c.font = font(picked ? 700 : 600, 11 * u * dpr * Math.min(1.1, p.s)); c.textBaseline = "top"; c.fillText(n.name, p.x, p.y + r + 3 * dpr);
      R.hit.push({ key, x: p.x / dpr, y: p.y / dpr, r: r / dpr, z: p.z }); continue; }
    const r = 8 * u * dpr * p.s, st = n.state;
    c.globalAlpha = depth * (st === "off" ? 0.6 : 1); c.fillStyle = st === "off" ? C.el : st === "wait" ? C.card : C[st] || C.on; c.beginPath(); c.arc(p.x, p.y, r, 0, 7); c.fill();
    c.lineWidth = (picked ? 2.5 : 1.5) * dpr; c.strokeStyle = picked ? C.tx : C[st] || C.on; c.stroke();
    if (p.z > -Rr * 0.2 || picked) { c.globalAlpha = Math.max(0.45, depth) * (st === "off" ? 0.75 : 1); c.fillStyle = st === "off" ? C.dim : C.tx; c.font = font(picked ? 700 : 400, 10 * u * dpr * Math.min(1.1, p.s)); c.textBaseline = "top"; c.fillText(n.name, p.x, p.y + r + 3 * dpr); }
    R.hit.push({ key, x: p.x / dpr, y: p.y / dpr, r: r / dpr, z: p.z });
  }
  c.globalAlpha = 1; c.textBaseline = "alphabetic";
}
