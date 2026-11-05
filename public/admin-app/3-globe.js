/* LABS admin — the globe v1.0, 2026-11-04. "A 3D graphic showing where everyone in the world is logging into LABS from
   would be cool." On top of People: a dotted Earth you can spin, a green dot on each country members are in (bigger with
   more people, pulsing when someone was there in the last day), and the list beside it. Tap a dot or a row to go there.
   Data: GET /api/admin/globe (server/trust/globe — the country of each member's latest join, sign-in or vote; counts only).
   Map: 3-globe-data.js (GLOBE_LAND, GLOBE_AT). Drawn on a canvas by hand, no library; every colour is read from the
   palette's variables. Spins on its own unless reduced motion is on; the loop stops when People isn't on screen. */
const GL = { rot: null, to: null, vel: 0, drag: null, idle: 0, pick: "", raf: 0, dots: null, pulse: 0, dirty: true };
const glReduce = () => matchMedia("(prefers-reduced-motion: reduce)").matches;
const glName = (c) => { try { return new Intl.DisplayNames(["en"], { type: "region" }).of(c) || c; } catch (e) { return c; } };
const glRad = Math.PI / 180;

/* the land as points spread evenly over the sphere (a Fibonacci spiral), kept where the 1° grid says land */
function glDots() {
  if (GL.dots) return GL.dots;
  const raw = atob(GLOBE_LAND), land = (lat, lon) => { const r = Math.min(179, Math.floor(90 - lat)), c = Math.min(359, Math.floor(lon + 180)), i = r * 360 + c; return (raw.charCodeAt(i >> 3) >> (7 - (i & 7))) & 1; };
  const N = 15000, out = [], gold = Math.PI * (3 - Math.sqrt(5));
  for (let i = 0; i < N; i++) {
    const y = 1 - (2 * i + 1) / N, lat = Math.asin(y) / glRad, lon = ((((i * gold) / glRad) % 360) + 540) % 360 - 180;
    if (land(lat, lon)) out.push([Math.sin(lat * glRad), Math.cos(lat * glRad), lon * glRad]);
  }
  return (GL.dots = out);
}
async function globeLoad() {
  if (D.globe && D.globe.days === RANGE && !D.globe.error) return;
  try { D.globe = await req(`/api/admin/globe?days=${RANGE}`); } catch (e) { D.globe = { error: e.message, countries: [] }; }
}
const glPlaced = () => (D.globe?.countries || []).filter((g) => GLOBE_AT[g.c]);
function glPickHTML() {
  const g = (D.globe?.countries || []).find((x) => x.c === GL.pick);
  if (!g) return `<span class="dim">Drag to spin · tap a dot</span>`;
  return `<b>${esc(glName(g.c))}</b><span>${num(g.members)} member${g.members === 1 ? "" : "s"} · ${num(g.active)} seen in ${RANGE} days${g.today ? ` · <em>${num(g.today)} today</em>` : ""}</span>${g.cities.length ? `<span class="dim">${g.cities.map(([c, n]) => `${esc(c)} ${n}`).join(" · ")}</span>` : ""}`;
}
function globeHTML() {
  const d = D.globe;
  if (!d) return `<section class="rc gl"><div class="gl-b"><div class="gl-ph"></div></div></section>`;
  if (d.error) return "";
  const top = d.countries.slice(0, 8), most = Math.max(1, ...top.map((g) => g.members));
  return `<section class="rc gl" id="globe"><header><h3>Where members are</h3><span class="mono">${num(d.placed)} of ${num(d.total)} placed</span></header>
    <div class="gl-b"><div class="gl-w"><canvas id="glcv" role="img" aria-label="A globe of where members sign in from"></canvas></div>
    <div class="gl-side"><div class="gl-pick" id="glpick">${glPickHTML()}</div>
    ${top.length ? `<ol class="gl-list">${top.map((g) => `<li><button data-glc="${esc(g.c)}" class="${g.c === GL.pick ? "on" : ""}"><span class="gl-n">${esc(glName(g.c))}</span><span class="gl-bar"><i style="width:${Math.max(4, Math.round((g.members / most) * 100))}%"></i></span><span class="mono">${num(g.members)}</span></button></li>`).join("")}</ol>`
      : `<p class="dim gl-none">No places yet. A member's country is noted when they join, sign in or vote.</p>`}
    <p class="dim gl-note">A member's latest join, sign-in or vote, by the network's country.${d.total > d.placed ? ` ${num(d.total - d.placed)} haven't been placed yet.` : ""}</p></div></div></section>`;
}
function glGo(c) {
  const at = GLOBE_AT[c]; GL.pick = c; GL.idle = performance.now(); GL.vel = 0;
  if (at) { GL.to = { lon: at[1], lat: Math.max(-50, Math.min(50, at[0])), from: { ...GL.rot }, t0: performance.now() }; if (glReduce()) { GL.rot = { lon: GL.to.lon, lat: GL.to.lat }; GL.to = null; } }
  const p = $("#glpick"); if (p) p.innerHTML = glPickHTML();
  $$("[data-glc]").forEach((b) => b.classList.toggle("on", b.dataset.glc === c)); GL.dirty = true;
}
function globeWire() {
  const cv = $("#glcv"); if (!cv) return;
  if (!GL.rot) { const first = glPlaced()[0], at = first && GLOBE_AT[first.c]; GL.rot = at ? { lon: at[1] - 20, lat: Math.max(-40, Math.min(40, at[0])) } : { lon: -40, lat: 20 }; }
  $$("[data-glc]").forEach((b) => b.onclick = () => glGo(b.dataset.glc));
  cv.onpointerdown = (e) => { GL.drag = { x: e.clientX, y: e.clientY, x0: e.clientX, y0: e.clientY, t: performance.now(), moved: false }; GL.to = null; GL.vel = 0; try { cv.setPointerCapture(e.pointerId); } catch (x) {} };
  cv.onpointermove = (e) => {
    const g = GL.drag; if (!g) return; const R = cv.clientWidth * 0.42, dx = e.clientX - g.x, dy = e.clientY - g.y, dt = Math.max(1, performance.now() - g.t);
    if (Math.abs(e.clientX - g.x0) + Math.abs(e.clientY - g.y0) > 5) g.moved = true;
    GL.rot.lon -= (dx / R) / glRad; GL.rot.lat = Math.max(-60, Math.min(60, GL.rot.lat + (e.pointerType === "touch" ? 0 : (dy / R) / glRad)));
    GL.vel = -((dx / R) / glRad) / dt; g.x = e.clientX; g.y = e.clientY; g.t = performance.now(); GL.dirty = true;
  };
  cv.onpointerup = (e) => { const g = GL.drag; GL.drag = null; GL.idle = performance.now(); if (g && !g.moved) glTap(cv, e); };
  cv.onpointercancel = () => { GL.drag = null; GL.idle = performance.now(); };
  GL.dirty = true; if (!GL.raf) GL.raf = requestAnimationFrame(glFrame);
}
/* where a country sits on screen now, or null when it's round the back */
function glProject(lat, lon, cx, cy, R) {
  const p = lat * glRad, l = (lon - GL.rot.lon) * glRad, p0 = GL.rot.lat * glRad;
  const z = Math.sin(p0) * Math.sin(p) + Math.cos(p0) * Math.cos(p) * Math.cos(l);
  return { x: cx + R * Math.cos(p) * Math.sin(l), y: cy - R * (Math.cos(p0) * Math.sin(p) - Math.sin(p0) * Math.cos(p) * Math.cos(l)), z };
}
function glTap(cv, e) {
  const b = cv.getBoundingClientRect(), x = e.clientX - b.left, y = e.clientY - b.top, w = cv.clientWidth, R = w * 0.42;
  let best = null, bd = 26;
  for (const g of glPlaced()) { const [lat, lon] = GLOBE_AT[g.c], p = glProject(lat, lon, w / 2, w / 2, R); if (p.z <= 0) continue; const d = Math.hypot(p.x - x, p.y - y); if (d < bd) { bd = d; best = g.c; } }
  if (best) glGo(best);
}
function glFrame(now) {
  const cv = $("#glcv");
  if (!cv || !cv.isConnected || TAB !== "people") { GL.raf = 0; return; }
  GL.raf = requestAnimationFrame(glFrame);
  const reduce = glReduce(), w = cv.clientWidth; if (!w) return;
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  if (cv.width !== Math.round(w * dpr)) { cv.width = Math.round(w * dpr); cv.height = Math.round(w * dpr); GL.dirty = true; }
  const dt = Math.min(64, now - (GL.last || now)); GL.last = now;
  if (GL.to) { const k = Math.min(1, (now - GL.to.t0) / 700), e = 1 - Math.pow(1 - k, 3), dl = ((GL.to.lon - GL.to.from.lon + 540) % 360) - 180;
    GL.rot = { lon: GL.to.from.lon + dl * e, lat: GL.to.from.lat + (GL.to.lat - GL.to.from.lat) * e }; GL.dirty = true; if (k >= 1) GL.to = null; }
  else if (!GL.drag && !reduce) {
    if (Math.abs(GL.vel) > 0.001) { GL.rot.lon += GL.vel * dt; GL.vel *= Math.pow(0.94, dt / 16); GL.dirty = true; }
    else if (now - GL.idle > 2500) { GL.rot.lon -= dt * 0.006; GL.dirty = true; }
  }
  const live = !reduce && glPlaced().some((g) => g.today); if (live) GL.dirty = true;
  if (!GL.dirty) return; GL.dirty = false;
  const c = cv.getContext("2d"), cs = getComputedStyle(document.documentElement), col = (v) => cs.getPropertyValue(v).trim();
  const tx = col("--tx"), acc = col("--accent-fill"), line = col("--line"), el = col("--el");
  const W = cv.width, R = W * 0.42, cx = W / 2, cy = W / 2, light = document.documentElement.dataset.theme !== "dark";
  c.setTransform(1, 0, 0, 1, 0, 0); c.clearRect(0, 0, W, W);
  /* a soft glow behind, the sea, the rim */
  const halo = c.createRadialGradient(cx, cy, R * 0.9, cx, cy, R * 1.18); halo.addColorStop(0, acc); halo.addColorStop(1, "transparent");
  c.globalAlpha = light ? 0.1 : 0.16; c.fillStyle = halo; c.beginPath(); c.arc(cx, cy, R * 1.18, 0, 7); c.fill();
  c.globalAlpha = 1; c.fillStyle = el; c.beginPath(); c.arc(cx, cy, R, 0, 7); c.fill();
  c.strokeStyle = line; c.lineWidth = dpr; c.stroke();
  /* land, in four shades by how far round it is */
  const s0 = Math.sin(GL.rot.lat * glRad), c0 = Math.cos(GL.rot.lat * glRad), l0 = GL.rot.lon * glRad, ds = 1.25 * dpr * (W / dpr / 340 + 0.4);
  const buckets = [[], [], [], []];
  for (const [sp, cp, l] of glDots()) {
    const dl = l - l0, cl = Math.cos(dl), z = s0 * sp + c0 * cp * cl; if (z <= 0.02) continue;
    buckets[Math.min(3, Math.floor(z * 4))].push(cx + R * cp * Math.sin(dl), cy - R * (c0 * sp - s0 * cp * cl));
  }
  c.fillStyle = tx;
  buckets.forEach((b, i) => { c.globalAlpha = light ? 0.2 + i * 0.14 : 0.12 + i * 0.1; c.beginPath(); for (let k = 0; k < b.length; k += 2) c.rect(b[k] - ds / 2, b[k + 1] - ds / 2, ds, ds); c.fill(); });
  /* members: a dot per country, bigger with more; a ring that breathes when someone was there today */
  const pts = glPlaced().map((g) => ({ g, p: glProject(GLOBE_AT[g.c][0], GLOBE_AT[g.c][1], cx, cy, R) })).filter((o) => o.p.z > 0).sort((a, b) => a.p.z - b.p.z);
  const t = (now % 2200) / 2200;
  for (const { g, p } of pts) {
    const r = (3 + Math.min(14, Math.sqrt(g.members) * 2.4)) * dpr * (W / dpr / 340 + 0.3) * 0.8, a = 0.45 + 0.55 * p.z;
    if (g.today) { const rr = reduce ? r * 1.8 : r * (1.2 + t * 1.6); c.globalAlpha = a * (reduce ? 0.5 : 1 - t); c.strokeStyle = acc; c.lineWidth = 1.5 * dpr; c.beginPath(); c.arc(p.x, p.y, rr, 0, 7); c.stroke(); }
    c.globalAlpha = a * 0.28; c.fillStyle = acc; c.beginPath(); c.arc(p.x, p.y, r * 1.7, 0, 7); c.fill();
    c.globalAlpha = a; c.beginPath(); c.arc(p.x, p.y, r, 0, 7); c.fill();
    if (light) { c.globalAlpha = a * 0.35; c.strokeStyle = tx; c.lineWidth = dpr; c.stroke(); }   // green on white needs an edge
    if (g.c === GL.pick) { c.globalAlpha = 1; c.strokeStyle = tx; c.lineWidth = 2 * dpr; c.beginPath(); c.arc(p.x, p.y, r + 3 * dpr, 0, 7); c.stroke(); }
  }
  c.globalAlpha = 1;
}
