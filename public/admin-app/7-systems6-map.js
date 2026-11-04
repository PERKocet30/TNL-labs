/* LABS admin — the systems map v1.0, 2026-11-04. "Can we do the same type of interactive model for the system networks…
   all the networks that run the app." On top of Health → Systems: LABS in the middle, every service it runs on around it
   on a ring you can spin, with traffic moving along the lines. Each service wears its state — green working, red needs
   a look, an outline when something's in motion, grey not connected. Tap one (or its row) for what it does, a few facts
   and the page to open. Data: GET /api/admin/systems/map (server/admin/systems-map), with Railway and GitHub from the
   Systems page's own read (D.systems). Drawn on a canvas by hand, colours from the palette; loaded after
   7-systems5-health, it puts itself on top of VIEWS/WIRES/LOADERS.systems. Like the globe: spins on its own unless
   reduced motion is on, and stops when the map isn't on screen. */
const SM = { yaw: 0.35, pitch: 0.55, vel: 0, drag: null, idle: 0, pick: "", raf: 0, dirty: true, hit: [] };
/* round the ring, neighbours next to each other: members → Cloudflare, GitHub → Railway → the database */
const SM_RING = ["members", "cloudflare", "google", "meta", "connector", "claude", "resend", "stripe", "github", "railway", "data"];
const SM_LINK = { members: "cloudflare", cloudflare: "labs", github: "railway", railway: "labs" };   // the rest link to LABS
const SM_IN = new Set(["members", "cloudflare", "connector", "github", "railway"]);   // traffic flows in to LABS; the rest, out
const SM_WORD = { on: "working", warn: "needs a look", wait: "in motion", off: "not connected" };
const SM_TAG = { on: "on", warn: "warn", wait: "wait", off: "" };

async function smLoad() { try { D.sysMap = await req("/api/admin/systems/map"); } catch (e) { D.sysMap = { error: e.message }; } }
/* Railway and GitHub from the Systems page's own read */
function smNodes() {
  const M = D.sysMap; if (!M || !M.nodes) return [];
  const S = D.systems, nodes = M.nodes.map((x) => ({ ...x, facts: [...(x.facts || [])] })), by = Object.fromEntries(nodes.map((x) => [x.id, x]));
  const R = S && S.railway, G = S && S.github, L = S && S.live;
  if (by.railway && R) {
    const rw = by.railway;
    if (!R.on) rw.line = "Hosting LABS · add RAILWAY_PROJECT_TOKEN to see deploys";
    else if (R.error) rw.line = "Hosting LABS · couldn't read its deploys";
    else if (R.failed) { rw.state = "warn"; rw.line = `The last deploy ${R.failed.status === "CRASHED" ? "crashed" : "failed"} — the site stays on the one before`; }
    else if (R.busy) { rw.state = "wait"; rw.line = "A new version is going live"; }
    else rw.line = `Live${L && L.commit ? " · version " + L.commit : ""}`;
    if (L) rw.facts.push(["Live version", L.commit || "—"]);
    if (R.on && R.deploys && R.deploys[0]) rw.facts.push(["Last deploy", `${String(R.deploys[0].status || "").toLowerCase()}${R.deploys[0].at ? " · " + ago(R.deploys[0].at) + " ago" : ""}`]);
  }
  if (by.github && G) {
    const gh = by.github;
    if (!G.on) { gh.state = "off"; gh.line = "No key — GITHUB_TOKEN in Railway"; }
    else if (G.error) { gh.state = "warn"; gh.line = G.error; }
    else {
      const red = (G.prs || []).filter((p) => p.checks === "red").length, c = G.deployCheck, bad = c && c.status === "completed" && c.conclusion && c.conclusion !== "success";
      const wait = (G.prs || []).length;
      gh.state = red || bad ? "warn" : "on";
      gh.line = bad ? "The live-site check failed after the last merge" : red ? `${red} change${red === 1 ? "" : "s"} with failing tests` : wait ? `${wait} change${wait === 1 ? "" : "s"} waiting for a Push` : "Nothing waiting";
      gh.facts.push(["Waiting for a Push", wait], ["Last merged", G.merges && G.merges[0] ? `#${G.merges[0].number} · ${ago(G.merges[0].mergedAt)} ago` : "—"]);
    }
  }
  return nodes;
}
const smFind = (id) => smNodes().find((x) => x.id === id);
function smPickHTML() {
  const x = smFind(SM.pick);
  if (!x) return `<span class="dim">Drag to spin · tap a service</span>`;
  return `<div class="sm-ph"><b>${esc(x.name)}</b><span class="tag ${SM_TAG[x.state]}">${SM_WORD[x.state]}</span></div><span class="dim">${esc(x.does)}</span><span>${esc(x.line)}</span>
    ${x.facts.length ? `<dl class="sm-facts">${x.facts.map(([k, v]) => `<div><dt>${esc(k)}</dt><dd>${esc(typeof v === "number" ? num(v) : v)}</dd></div>`).join("")}</dl>` : ""}
    ${x.go && x.go !== "systems" ? `<button class="btn ghost sm" data-smgo="${esc(x.go)}">Open ${esc({ health: "Health", settings: "Settings", market: "Market", echohome: "Echo", instagram: "Instagram" }[x.go] || x.go)} →</button>` : ""}`;
}
function smHTML() {
  const M = D.sysMap;
  if (!M) return `<section class="rc gl sm"><div class="gl-b"><div class="gl-ph"></div></div></section>`;
  if (M.error) return "";
  const nodes = smNodes(), cnt = (s) => nodes.filter((x) => x.state === s).length;
  if (!SM.pick) { const w = nodes.find((x) => x.state === "warn"); if (w) SM.pick = w.id; }
  const order = [...nodes].sort((a, b) => ["warn", "wait", "on", "off"].indexOf(a.state) - ["warn", "wait", "on", "off"].indexOf(b.state));
  return `<section class="rc gl sm" id="sysmap"><header><h3>How LABS is connected</h3><span class="mono">${cnt("on")} working${cnt("warn") ? ` · ${cnt("warn")} need a look` : ""}${cnt("wait") ? ` · ${cnt("wait")} in motion` : ""}${cnt("off") ? ` · ${cnt("off")} not connected` : ""}</span></header>
    <div class="gl-b"><div class="gl-w sm-w"><canvas id="smcv" role="img" aria-label="A map of the services LABS runs on"></canvas></div>
    <div class="gl-side"><div class="gl-pick sm-pick" id="smpick">${smPickHTML()}</div>
    <ol class="gl-list sm-list">${order.map((x) => `<li><button data-smn="${esc(x.id)}" class="${x.id === SM.pick ? "on" : ""}"><span class="sm-dot ${x.state}"></span><span class="gl-n">${esc(x.name)}</span><span class="dim sm-l">${esc(x.line)}</span></button></li>`).join("")}</ol></div></div></section>`;
}
function smGo(id) {
  SM.pick = SM.pick === id ? "" : id; SM.dirty = true; SM.idle = performance.now();
  const p = $("#smpick"); if (p) { p.innerHTML = smPickHTML(); smWirePick(); }
  $$("[data-smn]").forEach((b) => b.classList.toggle("on", b.dataset.smn === SM.pick));
  /* turn the ring so the picked one comes to the front */
  const i = SM_RING.indexOf(SM.pick); if (i >= 0 && !matchMedia("(prefers-reduced-motion: reduce)").matches) SM.to = { yaw: smFront(i), from: SM.yaw, t0: performance.now() };
  else if (i >= 0) SM.yaw = smFront(i);
}
/* the yaw that puts ring slot i nearest the viewer, the shortest way round */
function smFront(i) { const want = Math.PI / 2 - (i / SM_RING.length) * Math.PI * 2; let d = (want - SM.yaw) % (Math.PI * 2); if (d > Math.PI) d -= Math.PI * 2; if (d < -Math.PI) d += Math.PI * 2; return SM.yaw + d; }
function smWirePick() { $$("[data-smgo]").forEach((b) => b.onclick = () => go(b.dataset.smgo)); }
function smWire() {
  const cv = $("#smcv"); if (!cv) return;
  $$("[data-smn]").forEach((b) => b.onclick = () => smGo(b.dataset.smn)); smWirePick();
  if (!SM.aimed && SM.pick) { SM.aimed = true; const i = SM_RING.indexOf(SM.pick); if (i >= 0) SM.yaw = smFront(i); }   // what needs a look starts at the front
  cv.onpointerdown = (e) => { SM.drag = { x: e.clientX, y: e.clientY, x0: e.clientX, y0: e.clientY, t: performance.now(), moved: false }; SM.to = null; SM.vel = 0; try { cv.setPointerCapture(e.pointerId); } catch (x) {} };
  cv.onpointermove = (e) => {
    const g = SM.drag; if (!g) return; const w = cv.clientWidth, dx = e.clientX - g.x, dy = e.clientY - g.y, dt = Math.max(1, performance.now() - g.t);
    if (Math.abs(e.clientX - g.x0) + Math.abs(e.clientY - g.y0) > 5) g.moved = true;
    SM.yaw += (dx / w) * 3; if (e.pointerType !== "touch") SM.pitch = Math.max(0.12, Math.min(0.9, SM.pitch + (dy / w) * 2));
    SM.vel = ((dx / w) * 3) / dt; g.x = e.clientX; g.y = e.clientY; g.t = performance.now(); SM.dirty = true;
  };
  cv.onpointerup = (e) => { const g = SM.drag; SM.drag = null; SM.idle = performance.now(); if (g && !g.moved) { const b = cv.getBoundingClientRect(), x = e.clientX - b.left, y = e.clientY - b.top;
    const hit = SM.hit.filter((h) => Math.hypot(h.x - x, h.y - y) < h.r + 12).sort((a, c) => c.z - a.z)[0]; if (hit) smGo(hit.id); } };
  cv.onpointercancel = () => { SM.drag = null; SM.idle = performance.now(); };
  SM.dirty = true; if (!SM.raf) SM.raf = requestAnimationFrame(smFrame);
}
function smFrame(now) {
  const cv = $("#smcv");
  if (!cv || !cv.isConnected) { SM.raf = 0; return; }
  SM.raf = requestAnimationFrame(smFrame);
  const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches, w = cv.clientWidth, h = cv.clientHeight; if (!w || !h) return;
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  if (cv.width !== Math.round(w * dpr) || cv.height !== Math.round(h * dpr)) { cv.width = Math.round(w * dpr); cv.height = Math.round(h * dpr); SM.dirty = true; }
  const dt = Math.min(64, now - (SM.last || now)); SM.last = now;
  if (SM.to) { const k = Math.min(1, (now - SM.to.t0) / 650), e = 1 - Math.pow(1 - k, 3); SM.yaw = SM.to.from + (SM.to.yaw - SM.to.from) * e; SM.dirty = true; if (k >= 1) SM.to = null; }
  else if (!SM.drag && !reduce) {
    if (Math.abs(SM.vel) > 0.00002) { SM.yaw += SM.vel * dt; SM.vel *= Math.pow(0.93, dt / 16); SM.dirty = true; }
    else if (!SM.pick && now - SM.idle > 2500) { SM.yaw += dt * 0.00012; SM.dirty = true; }
  }
  if (!reduce) SM.dirty = true;   // the traffic is always moving
  if (!SM.dirty) return; SM.dirty = false;
  const nodes = smNodes(); if (!nodes.length) return;
  const by = Object.fromEntries(nodes.map((x) => [x.id, x]));
  const c = cv.getContext("2d"), cs = getComputedStyle(document.documentElement), col = (v) => cs.getPropertyValue(v).trim();
  const C = { on: col("--accent-fill"), warn: col("--red"), wait: col("--tx"), off: col("--dim"), tx: col("--tx"), dim: col("--dim"), card: col("--card"), el: col("--el"), line: col("--line2"), onAcc: col("--on-accent") };
  const W = cv.width, Hh = cv.height, cx = W / 2, cy = Hh * 0.44, Rr = Math.min(W * 0.34, Hh * 0.56), f = Rr * 4.2, u = Math.min(w, h * 1.3) / 400;   // in CSS pixels; dpr is applied where sizes are drawn
  c.setTransform(1, 0, 0, 1, 0, 0); c.clearRect(0, 0, W, Hh);
  /* 3D: the ring in the x–z plane, turned by yaw, tipped towards you by pitch, then perspective */
  const P = (x, y, z) => { const cyw = Math.cos(SM.yaw), syw = Math.sin(SM.yaw), x1 = x * cyw - z * syw, z1 = x * syw + z * cyw;
    const cp = Math.cos(SM.pitch), sp = Math.sin(SM.pitch), y2 = y * cp + z1 * sp, z2 = z1 * cp - y * sp, s = f / (f - z2); return { x: cx + x1 * s, y: cy + y2 * s, z: z2, s }; };
  const pos = { labs: P(0, 0, 0) };
  SM_RING.forEach((id, i) => { const a = (i / SM_RING.length) * Math.PI * 2; pos[id] = P(Math.cos(a) * Rr, (i % 2 ? -1 : 1) * Rr * 0.07, Math.sin(a) * Rr); });
  /* the floor ring */
  c.globalAlpha = 0.5; c.strokeStyle = C.line; c.lineWidth = dpr; c.beginPath();
  for (let k = 0; k <= 64; k++) { const a = (k / 64) * Math.PI * 2, p = P(Math.cos(a) * Rr, 0, Math.sin(a) * Rr); k ? c.lineTo(p.x, p.y) : c.moveTo(p.x, p.y); } c.stroke();
  /* the lines, then the traffic on them */
  const links = SM_RING.filter((id) => by[id]).map((id) => ({ id, from: pos[id], to: pos[SM_LINK[id] || "labs"], st: by[id].state }));
  for (const L of links) {
    c.globalAlpha = L.st === "off" ? 0.35 : 0.55; c.strokeStyle = C[L.st]; c.lineWidth = (L.st === "warn" ? 2 : 1.3) * dpr;
    c.setLineDash(L.st === "off" ? [4 * dpr, 5 * dpr] : []); c.beginPath(); c.moveTo(L.from.x, L.from.y); c.lineTo(L.to.x, L.to.y); c.stroke();
  }
  c.setLineDash([]);
  if (!reduce) for (const L of links) {
    if (L.st === "off") continue;
    const k = L.st === "wait" ? 1 : 3, sp = L.st === "wait" ? 0.00018 : 0.00034;
    for (let j = 0; j < k; j++) {
      let t = (now * sp + j / k + (SM_RING.indexOf(L.id) * 0.137)) % 1; if (!SM_IN.has(L.id)) t = 1 - t;
      const x = L.from.x + (L.to.x - L.from.x) * t, y = L.from.y + (L.to.y - L.from.y) * t, a = Math.sin(t * Math.PI);
      c.globalAlpha = a; c.fillStyle = C[L.st]; c.beginPath(); c.arc(x, y, 2.4 * dpr, 0, 7); c.fill();
    }
  }
  /* the services, back to front; LABS in the middle among them */
  const draw = [...SM_RING.filter((id) => by[id]).map((id) => ({ id, p: pos[id], n: by[id] })), { id: "labs", p: pos.labs, n: by.labs }].sort((a, b) => a.p.z - b.p.z);
  SM.hit = [];
  c.textAlign = "center"; c.textBaseline = "top";
  for (const { id, p, n } of draw) {
    if (!n) continue;
    const core = id === "labs", r = (core ? 30 : 15) * u * dpr * p.s, depth = Math.max(0.45, Math.min(1, 0.75 + p.z / (Rr * 2))), st = n.state, picked = SM.pick === id;
    if (st !== "off" && !core) { c.globalAlpha = 0.18 * depth; c.fillStyle = C[st]; c.beginPath(); c.arc(p.x, p.y, r * 1.7, 0, 7); c.fill(); }
    if (core) { const g = c.createRadialGradient(p.x, p.y, r * 0.6, p.x, p.y, r * 2.2); g.addColorStop(0, C[st]); g.addColorStop(1, "transparent"); c.globalAlpha = 0.28; c.fillStyle = g; c.beginPath(); c.arc(p.x, p.y, r * 2.2, 0, 7); c.fill(); }
    c.globalAlpha = depth; c.fillStyle = core ? C.on : st === "off" ? C.el : C.card; c.beginPath(); c.arc(p.x, p.y, r, 0, 7); c.fill();
    c.lineWidth = (picked ? 3 : 2) * dpr; c.strokeStyle = picked ? C.tx : core ? C[st] : C[st]; c.globalAlpha = st === "off" ? depth * 0.6 : depth; c.stroke();
    if (st === "on" && !core) { c.globalAlpha = depth; c.fillStyle = C.on; c.beginPath(); c.arc(p.x, p.y, r * 0.38, 0, 7); c.fill(); }
    if (st === "warn" && !core) { c.globalAlpha = depth; c.fillStyle = C.warn; c.font = `700 ${Math.round(r * 1.1)}px Helvetica, Arial, sans-serif`; c.textBaseline = "middle"; c.fillText("!", p.x, p.y + r * 0.05); c.textBaseline = "top"; }
    if (core) { c.globalAlpha = 1; c.fillStyle = C.onAcc; c.font = `700 ${Math.round(r * 0.5)}px Helvetica, Arial, sans-serif`; c.textBaseline = "middle"; c.fillText("LABS", p.x, p.y); c.textBaseline = "top"; }
    else { c.globalAlpha = Math.max(0.5, depth); c.fillStyle = st === "off" ? C.dim : C.tx; c.font = `${picked ? 700 : 500} ${Math.round(11.5 * u * dpr * Math.min(1.1, p.s))}px Helvetica, Arial, sans-serif`; c.fillText(n.name, p.x, p.y + r + 5 * dpr); }
    SM.hit.push({ id, x: p.x / dpr, y: p.y / dpr, r: r / dpr, z: p.z });
  }
  c.globalAlpha = 1;
}

/* on top of Health → Systems */
const smLoad0 = LOADERS.systems, smView0 = VIEWS.systems, smWire0 = WIRES.systems;
LOADERS.systems = async () => { await Promise.all([smLoad0(), smLoad()]); };
VIEWS.systems = () => smHTML() + smView0();
WIRES.systems = () => { smWire0 && smWire0(); smWire(); };
