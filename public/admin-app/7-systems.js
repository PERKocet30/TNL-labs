/* LABS admin · Systems v1.4 — 2026-10-27 (v1.4: Claude connector, 7-systems4-connectors.js; v1.3: This week — the Monday email, and a button to send it now; v1.2: Meta, 7-systems3-meta.js; v1.1: Google, 7-systems2-google.js). v1.0 — 2026-10-26. The services LABS runs on, read-only, in one place
   (server/admin/systems.js). Part 1: Railway (what's live, what's building, what failed) and
   GitHub (what's waiting for a Push, what went in lately, did the live check pass). Each card says
   plainly when its key isn't set yet; RAILWAY.md says where the keys go. */
LOADERS.systems = async () => { await Promise.all([(async () => { D.systems = await req("/api/admin/systems" + (D.systemsFresh ? "?fresh=1" : "")); })(),
  (async () => { D.weekly = await req("/api/admin/weekly").catch(() => null); })(),
  typeof LOADERS.systemsGoogle === "function" ? LOADERS.systemsGoogle().catch(() => { D.sysGoogle = { on: true, error: "Couldn't load." }; }) : null,
  typeof LOADERS.systemsMeta === "function" ? LOADERS.systemsMeta().catch(() => { D.sysMeta = { on: true, error: "Couldn't load." }; }) : null,
  typeof LOADERS.systemsConnectors === "function" ? LOADERS.systemsConnectors().catch(() => { D.sysConn = { error: "Couldn't load." }; }) : null]); D.systemsFresh = false; };
const SYS_STATUS = { SUCCESS: ["on", "live"], BUILDING: ["wait", "building"], DEPLOYING: ["wait", "going live"], INITIALIZING: ["wait", "starting"],
  QUEUED: ["wait", "queued"], WAITING: ["wait", "waiting"], FAILED: ["warn", "failed"], CRASHED: ["warn", "crashed"], REMOVED: ["", "replaced"],
  SKIPPED: ["", "skipped"], SLEEPING: ["", "asleep"], NEEDS_APPROVAL: ["wait", "needs approval"] };
const sysTag = (st) => { const [cls, word] = SYS_STATUS[st] || ["", String(st || "").toLowerCase()]; return `<span class="tag ${cls}">${esc(word)}</span>`; };
const SYS_CHECK = { green: ["on", "checks passed"], red: ["warn", "checks failed"], running: ["wait", "checks running"], none: ["", "no checks yet"] };
const sysCheck = (c) => { const [cls, word] = SYS_CHECK[c] || SYS_CHECK.none; return `<span class="tag ${cls}">${word}</span>`; };
const sysOff = (what, key) => `<div class="empty">${what} isn't connected yet. Put <span class="mono">${key}</span> in Railway → Variables (RAILWAY.md says how).</div>`;
const sysErr = (e) => `<div class="empty"><span class="tag warn">couldn't read</span> ${esc(e)}</div>`;

VIEWS.systems = () => {
  const S = D.systems;
  if (!S) return `<div class="empty">Loading…</div>`;
  const L = S.live, R = S.railway, G = S.github;
  const up = `${Math.floor(L.uptimeS / 3600)}h ${Math.floor((L.uptimeS % 3600) / 60)}m`;
  /* the one line at the top: which version is serving, and is anything in motion */
  let headline, headTag;
  if (R.on && R.failed) { headline = `The last deploy ${R.failed.status === "CRASHED" ? "crashed" : "failed"} — the site is still on the version before it.`; headTag = `<span class="tag warn">needs a look</span>`; }
  else if (R.on && R.busy) { headline = `A new version is ${SYS_STATUS[R.busy.status][1]}${R.busy.commit ? ` (${R.busy.commit})` : ""}. The site stays on ${L.commit || "the current version"} until it's done.`; headTag = `<span class="tag wait">in motion</span>`; }
  else if (R.on && R.behind) { headline = `Railway's newest deploy is ${R.current.commit} but this server is still running ${L.commit}. A restart should fix it.`; headTag = `<span class="tag warn">mismatch</span>`; }
  else { headline = `Serving ${L.commit ? `version ${L.commit}` : "the current version"}, up ${up}.`; headTag = `<span class="tag on">steady</span>`; }

  const railway = () => {
    if (!R.on) return sysOff("Railway", "RAILWAY_PROJECT_TOKEN");
    if (R.error) return sysErr(R.error);
    if (!R.deploys.length) return `<div class="empty">No deploys yet.</div>`;
    return `<div class="list">${R.deploys.map((d) => `<div class="li"><span class="b"><b style="font-weight:500;font-size:13px">${esc(d.message || "(no message)")}</b>
      <span>${d.commit ? `<i class="mono">${esc(d.commit)}</i> · ` : ""}${d.at ? ago(d.at) + " ago" : ""}</span></span>${sysTag(d.status)}</div>`).join("")}</div>`;
  };
  const prs = () => {
    if (!G.on) return sysOff("GitHub", "GITHUB_TOKEN");
    if (G.error) return sysErr(G.error);
    if (!G.prs.length) return `<div class="empty">Nothing waiting. Everything that was built is in.</div>`;
    return `<div class="list">${G.prs.map((p) => `<a class="li" href="${esc(p.url)}" target="_blank" rel="noopener"><span class="b"><b style="font-weight:500;font-size:13px">#${p.number} ${esc(p.title)}</b>
      <span><i class="mono">${esc(p.branch)}</i> · updated ${ago(p.updatedAt)} ago${p.draft ? " · draft" : ""}</span></span>${sysCheck(p.checks)}</a>`).join("")}</div>`;
  };
  const merges = () => {
    if (!G.on || G.error) return "";
    if (!G.merges.length) return `<div class="empty">Nothing merged yet.</div>`;
    return `<div class="list">${G.merges.map((m) => `<a class="li" href="${esc(m.url)}" target="_blank" rel="noopener"><span class="b"><b style="font-weight:500;font-size:13px">#${m.number} ${esc(m.title)}</b>
      <span><i class="mono">${esc(m.sha)}</i> · merged ${ago(m.mergedAt)} ago</span></span>${m.live ? `<span class="tag on">this is live</span>` : ""}</a>`).join("")}</div>`;
  };
  const check = () => {
    const c = G.on && G.deployCheck; if (!c) return "";
    const ok = c.status === "completed" && c.conclusion === "success", bad = c.status === "completed" && c.conclusion && c.conclusion !== "success";
    return `<div class="set"><div class="t"><b>Live-site check after the last merge</b><span>GitHub opens tnllabs.com after each merge and waits for the new version${c.sha ? ` · ${esc(c.sha)}` : ""} · ${ago(c.at)} ago</span></div>
      <a class="tag ${ok ? "on" : bad ? "warn" : "wait"}" href="${esc(c.url)}" target="_blank" rel="noopener">${ok ? "passed" : bad ? "failed" : "running"}</a></div>`;
  };
  /* the week, as the Monday email reads it (server/admin/weekly.js, 2026-10-26) */
  const W = D.weekly;
  const week = () => !W ? "" : `<h2 class="sec">This week <span class="mono">${esc(W.week.from)} → ${esc(W.week.to)} · the Monday email${W.lastSentAt ? " · last sent " + ago(W.lastSentAt) + " ago" : ""}</span></h2>
    <div class="panel"><div class="list">${W.lines.map((l) => l.startsWith("— ") ? `<div class="li" style="padding-top:14px"><span class="b"><b class="mono" style="font-size:11px;letter-spacing:.08em;color:var(--dim)">${esc(l.replace(/^— | —$/g, ""))}</b></span></div>`
      : `<div class="li"><span class="b"><b style="font-weight:${l.startsWith("•") ? 600 : 400};font-size:13px;white-space:normal">${esc(l)}</b></span></div>`).join("")}</div>
    <div class="set" style="margin-top:8px"><div class="t"><span>Sent every Monday morning to the admin address.</span></div><button class="btn ghost sm" id="wkmail">Email me this now</button></div></div>`;
  return `${pageHead("Systems", "What LABS runs on, read-only: what's live, what's waiting for a Push, how people find LABS on Google and Instagram",
    `<div class="row wrapx" style="gap:6px">${headTag}<button class="btn ghost sm" id="sysfresh">Look again</button></div>`)}
  <div class="panel" style="margin-bottom:14px"><div class="set"><div class="t"><b>${esc(headline)}</b><span>Node ${esc(L.node)}${S.cached ? " · numbers from the last minute" : ""}</span></div></div>${check()}</div>
  ${week()}
  <div class="split">
    <div><h2 class="sec">Railway <span class="mono">deploys, newest first</span></h2><div class="panel">${railway()}</div></div>
    <div><h2 class="sec">Waiting for a Push <span class="mono">open pull requests</span></h2><div class="panel">${prs()}</div>
      ${G.on && !G.error ? `<h2 class="sec">Went in lately <span class="mono">merged</span></h2><div class="panel">${merges()}</div>` : ""}</div>
  </div>
  ${typeof sysGoogleHTML === "function" ? sysGoogleHTML() : ""}
  ${typeof sysMetaHTML === "function" ? sysMetaHTML() : ""}
  ${typeof sysConnectorsHTML === "function" ? sysConnectorsHTML() : ""}`;
};
WIRES.systems = () => { const b = $("#sysfresh"); if (b) b.onclick = () => { D.systemsFresh = true; D.systems = null; paint(); load(); }; if (typeof ggWire === "function") ggWire(); if (typeof sysConnWire === "function") sysConnWire();
  const m = $("#wkmail"); if (m) m.onclick = async () => { m.disabled = true; try { const r = await req("/api/admin/weekly/send", { method: "POST" }); toast(r.sent ? "Sent — check your inbox" : r.reason === "no_key" ? "Email isn't set up on this server" : "Couldn't send"); } catch (e) { toast(e.message); } m.disabled = false; }; };
