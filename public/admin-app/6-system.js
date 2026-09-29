/* TNL LABS admin v2.0 — 2026-09-29. System: switches, safety nets, and the log of who changed what. */
let MAILRESULT = null;
LOADERS.system = async () => {
  const [health, settings, backups, errors, maillog, log, glitches] = await Promise.all(["/api/admin/health", "/api/admin/settings", "/api/admin/backups",
    "/api/admin/errors", "/api/admin/mail-log", "/api/admin/log", "/api/admin/glitches"].map((u) => req(u).catch(() => null)));
  Object.assign(D, { health, settings, backups, errors, maillog, log, glitches });
};
const mb = (b) => ((b || 0) / 1048576).toFixed(1) + " MB";
const ACTIONS = [[/\/rep$/, "Adjusted rep"], [/\/feature$/, "Featured"], [/\/verify$/, "Confirmed email"], [/\/suspend$/, "Suspended / restored"],
  [/\/note$/, "Wrote a note"], [/\/signout$/, "Signed out everywhere"], [/broadcast/, "Messaged a group"], [/DELETE .*posts/, "Deleted a post"],
  [/DELETE .*listings/, "Removed a listing"], [/reports\/.*handle/, "Handled a report"], [/settings/, "Changed settings"], [/cleanup/, "Cleaned up files"],
  [/POST .*backups/, "Made a backup"], [/DELETE .*backups/, "Deleted a backup"], [/errors/, "Cleared the error log"], [/test-email/, "Sent a test email"],
  [/^pin post/, "Pinned a post"], [/^unpin post/, "Unpinned a post"]];
const actionName = (a) => (ACTIONS.find(([re]) => re.test(a)) || [0, a])[1];

VIEWS.system = () => {
  const h = D.health, g = D.settings && D.settings.settings;
  if (!h || !g) return `<div class="empty">Loading…</div>`;
  const tog = (k, label, desc) => `<div class="set"><div class="t"><b>${esc(label)}</b><span>${desc}</span></div>
    <button class="sw ${g[k] === "1" ? "on" : ""}" data-tog="${k}" role="switch" aria-checked="${g[k] === "1"}" aria-label="${esc(label)}"></button></div>`;
  const ok = (on, yes, no) => `<span class="tag ${on ? "on" : "warn"}">${on ? yes : no}</span>`;
  const unver = D.maillog ? D.maillog.members.filter((m) => !m.verified) : [];
  const E = D.errors, G = D.glitches;
  const GNAME = { rage_tap: "rage taps", layout_jump: "screen jumps", slow_screen: "slow screens", action_failed: "failed saves" };
  const GWHY = { rage_tap: "tapped 3+ times fast — it didn't seem to respond", layout_jump: "the screen moved while they read",
    slow_screen: "took over 3 seconds to load", action_failed: "the server couldn't save it" };
  return `
  <h1 style="font-size:22px">System</h1>
  <div class="row wrapx" style="gap:6px;margin:12px 0">${ok(h.onVolume, "Data on the volume", "Data NOT on a volume")}${ok(h.mail, "Email on", "Email off")}
    ${ok(h.payments, "Payments on", "Payments off")}${ok(h.publicUrl, "Public URL set", "Public URL unset")}</div>
  <div class="grid g2 g4">
    <div class="kpi"><div class="k">Database</div><div class="v">${mb(h.dbBytes)}</div><div class="d">${h.sessions} signed-in sessions</div></div>
    <div class="kpi"><div class="k">Uploads</div><div class="v">${mb(h.uploadBytes)}</div><div class="d">${num(h.uploadCount)} files · ${h.orphans} unused</div></div>
    <div class="kpi"><div class="k">Errors, 24h</div><div class="v">${E ? E.last24h : "—"}</div><div class="d">${E && E.byKind.length ? E.byKind.map((k) => k.n + " " + k.kind).join(" · ") : "all quiet"}</div></div>
    <div class="kpi"><div class="k">Glitches, 24h</div><div class="v">${G ? G.last24h : "—"}</div><div class="d">${G && G.byKind.some((k) => k.day) ? G.byKind.filter((k) => k.day).map((k) => k.day + " " + (GNAME[k.kind] || k.kind)).join(" · ") : "feels smooth"}</div></div>
    <div class="kpi"><div class="k">Server</div><div class="v">${h.memMB} MB</div><div class="d">up ${Math.floor(h.uptimeS / 3600)}h ${Math.floor((h.uptimeS % 3600) / 60)}m · Node ${esc(h.node)}</div></div>
  </div>

  <div class="split">
  <div>
  <h2 class="sec">Who can get in</h2>
  <div class="panel">${tog("signupsOpen", "Signups open", "Off makes TNL invite-only.")}${tog("guestAccess", "Guests can look around", "The Showroom, Market and profiles without an account.")}
    ${tog("autoVerify", "Skip email confirmation", "Only while email is broken — anyone could sign up with an address they don't own.")}</div>
  <h2 class="sec">What's open</h2>
  <div class="panel">${tog("marketOpen", "Market", "Buying and selling.")}${tog("studioOpen", "Studio", "The beat maker.")}${tog("loopsOpen", "Loop market", "Producers selling sounds.")}
    <div class="set"><div class="t"><b>Rep needed to sell</b><span>0 lets anyone list.</span></div><input class="in" id="minrep" type="number" min="0" max="1000" value="${esc(g.minRepToSell)}" style="width:90px"></div>
    ${tog("distroOn", "Offer distribution", "Reach the level below and TNL puts your music out. It costs real money per artist.")}
    ${g.distroOn === "1" ? `<div class="set"><div class="t"><b>Level that earns it</b></div><select class="sel" id="distrolvl">${[[2, "Verified"], [3, "Collaborator"], [4, "Core"], [5, "Leadership"]]
      .map(([v, l]) => `<option value="${v}" ${String(g.distroLevel) === String(v) ? "selected" : ""}>${l}</option>`).join("")}</select></div>
      <label class="l" for="distroblurb">The terms, in one line</label><input class="in" id="distroblurb" maxlength="200" value="${esc(g.distroBlurb)}">` : ""}</div>
  <h2 class="sec">What people see first</h2>
  <div class="panel">
    <label class="l" for="announce" style="margin-top:0">Banner across the app — blank hides it</label><input class="in" id="announce" maxlength="200" value="${esc(g.announcement)}" placeholder="e.g. Drop this Friday.">
    <label class="l" for="headline">Landing headline</label><input class="in" id="headline" maxlength="60" value="${esc(g.headline)}">
    <label class="l" for="tagline">Landing tagline</label><textarea class="in" id="tagline" rows="2" maxlength="300">${esc(g.tagline)}</textarea>
    <label class="l" for="pinboard">Pinterest board in the archive — blank hides it</label><input class="in" id="pinboard" value="${esc(g.pinterestBoard || "")}" placeholder="https://www.pinterest.com/…">
    <button class="btn" id="savetext" style="margin-top:12px">Save</button></div>
  </div>
  <div>
  <h2 class="sec">Backups</h2>
  <div class="panel"><div class="row sp"><span class="dim" style="font-size:13px">Daily, 7 kept, on the same volume — download one now and then.</span><button class="btn sm" id="backup">Back up now</button></div>
    ${D.backups && D.backups.backups.length ? `<div class="list" style="margin-top:10px">${D.backups.backups.map((b) => `<div class="li"><span class="b"><b style="font-size:12.5px">${esc(b.name)}</b><span>${(b.bytes / 1024).toFixed(0)} KB · ${ago(b.at)} ago</span></span>
      <button class="btn ghost sm" data-dl="${esc(b.name)}" aria-label="Download">${I.down}</button></div>`).join("")}</div>` : `<div class="empty">No backups yet.</div>`}
    <button class="btn ghost sm" id="dlsource" style="margin-top:10px">${I.down} Download the app's code</button></div>
  <h2 class="sec">Email</h2>
  <div class="panel"><div class="row"><input class="in" id="testto" placeholder="Send a test to… (blank = you)"><button class="btn sm" id="testmail">Test</button></div>
    ${MAILRESULT ? `<div class="${MAILRESULT.ok ? "" : "warnbox"}" style="font-size:12.5px;margin-top:8px">${MAILRESULT.ok ? I.check + " Resend accepted it" : "Resend rejected it"} · to ${esc(MAILRESULT.to || "")} ${MAILRESULT.error ? "· " + esc(MAILRESULT.error) : ""}</div>` : ""}
    ${unver.length ? `<label class="l">${unver.length} waiting to confirm their email</label><div class="list">${unver.slice(0, 12).map((m) => `<div class="li"><span class="b"><b>@${esc(m.username)}</b><span>${esc(m.email)} · joined ${ago(m.joined)} ago</span></span>
      <button class="btn ghost sm" data-verify="${esc(m.username)}">Confirm</button></div>`).join("")}</div>` : ""}</div>
  <h2 class="sec">Unused files</h2>
  <div class="panel"><div class="row sp"><span class="dim" style="font-size:13px">${h.orphans ? `${h.orphans} files (${mb(h.orphanBytes)}) nothing points at — unsent photos, replaced avatars, abandoned uploads.` : "Nothing to clean."}</span>
    ${h.orphans ? `<button class="btn ghost sm" id="cleanup">Clean up</button>` : ""}</div></div>
  <h2 class="sec">Glitches <span class="mono">what felt broken this week, from members' own screens</span></h2>
  <div class="panel">${G && G.hotspots.length ? `<div class="list">${G.hotspots.map((g) => `<div class="li"><span class="b"><b style="font-weight:500;font-size:13px">${g.n}× ${esc(GNAME[g.kind] || g.kind)} · ${esc(g.place)}</b>
      <span>${esc(g.detail || "")}${g.detail ? " — " : ""}${esc(GWHY[g.kind] || "")} · ${g.people} ${g.people === 1 ? "person" : "people"} · last ${ago(g.last)} ago</span></span></div>`).join("")}</div>`
    : `<div class="empty">Nothing felt broken this week.</div>`}</div>
  <h2 class="sec">Errors <a class="mono" href="https://tnl-labs.sentry.io/issues/" target="_blank" style="margin-left:auto">Sentry ${I.out}</a></h2>
  <div class="panel">${E && E.errors.length ? `<div class="list">${E.errors.slice(0, 12).map((e) => `<div class="li"><span class="b"><b style="font-weight:500;font-size:13px">${esc(e.message)}</b>
      <span>${esc(e.kind)} · ${esc(e.path || "—")}${e.username ? " · @" + esc(e.username) : ""} · ${ago(e.created_at)} ago</span></span></div>`).join("")}</div>
    <button class="btn ghost sm" id="clearerrors" style="margin-top:8px">Clear the log</button>` : `<div class="empty">Nothing logged.</div>`}</div>
  </div></div>

  <h2 class="sec">Admin log <span class="mono">every change made from here, newest first</span></h2>
  <div class="panel scroll">${D.log && D.log.log.length ? `<table class="tbl"><thead><tr><th>Who</th><th>What</th><th>About</th><th>Detail</th><th class="num">When</th></tr></thead>
    <tbody>${D.log.log.slice(0, 60).map((l) => `<tr><td>@${esc(l.by || "?")}</td><td>${esc(actionName(l.action))}</td><td>${l.target ? esc(l.target) : "—"}</td>
      <td class="dim" style="max-width:260px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="${esc(l.detail)}">${l.detail && l.detail !== "{}" ? esc(l.detail) : ""}</td><td class="num dim">${ago(l.at)}</td></tr>`).join("")}</tbody></table>`
    : `<div class="empty">Nothing yet — changes you make will show here.</div>`}</div>`;
};

WIRES.system = () => {
  const save = async (body, msg = "Saved — live now") => { const d = await act(() => req("/api/admin/settings", { method: "PATCH", body }), msg); if (d) { D.settings.settings = d.settings; paint(); } };
  $$("[data-tog]").forEach((b) => b.onclick = async () => {
    const k = b.dataset.tog, on = D.settings.settings[k] === "1";
    if (k === "autoVerify" && !on && !(await confirmIt("Skip email confirmation?", "Anyone could sign up with an address they don't own. Only while email is broken.", { ok: "Turn on", danger: true }))) return;
    if (k === "signupsOpen" && on && !(await confirmIt("Close signups?", "Nobody new can join until you turn this back on.", { ok: "Close signups", danger: true }))) return;
    save({ [k]: on ? "0" : "1" }, "Changed — live now");
  });
  const mr = $("#minrep"); if (mr) mr.onchange = () => save({ minRepToSell: mr.value });
  const dl = $("#distrolvl"); if (dl) dl.onchange = () => save({ distroLevel: dl.value });
  const db_ = $("#distroblurb"); if (db_) db_.onchange = () => save({ distroBlurb: db_.value });
  const st = $("#savetext"); if (st) st.onclick = () => save({ announcement: $("#announce").value, headline: $("#headline").value, tagline: $("#tagline").value, pinterestBoard: $("#pinboard").value.trim() });
  const bk = $("#backup"); if (bk) bk.onclick = async () => { bk.disabled = true; await act(() => req("/api/admin/backups", { method: "POST" }), (d) => "Backed up — " + (d.bytes / 1024).toFixed(0) + " KB"); load(); };
  $$("[data-dl]").forEach((b) => b.onclick = () => download("/api/admin/backups/" + encodeURIComponent(b.dataset.dl), b.dataset.dl));
  const src = $("#dlsource"); if (src) src.onclick = () => download("/api/admin/source", "TNL-LABS.zip");
  const tm = $("#testmail"); if (tm) tm.onclick = async () => { tm.disabled = true;
    try { MAILRESULT = await req("/api/admin/test-email", { method: "POST", body: { to: $("#testto").value.trim() || undefined } }); }
    catch (e) { MAILRESULT = { ok: false, error: e.message }; } paint(); };
  $$("[data-verify]").forEach((b) => b.onclick = async () => { await act(() => req("/api/admin/members/" + encodeURIComponent(b.dataset.verify) + "/verify", { method: "POST" }), "Confirmed"); load(); });
  const cl = $("#cleanup"); if (cl) cl.onclick = async () => {
    if (!(await confirmIt("Delete unused files?", "Only files nothing in the database points at. Can't be undone.", { ok: "Delete", danger: true }))) return;
    await act(() => req("/api/admin/cleanup", { method: "POST" }), (d) => `Removed ${d.removed} files, freed ${mb(d.freed)}`); load();
  };
  const ce = $("#clearerrors"); if (ce) ce.onclick = async () => { if (!(await confirmIt("Clear the error log?", ""))) return; await act(() => req("/api/admin/errors", { method: "DELETE" }), "Cleared"); load(); };
};

/* authenticated downloads: the token has to ride along */
async function download(path, fallback) {
  toast("Preparing download…");
  try {
    const r = await fetch(API + path, { headers: { Authorization: "Bearer " + TOKEN } });
    if (!r.ok) throw new Error("HTTP " + r.status);
    const m = /filename="([^"]+)"/.exec(r.headers.get("content-disposition") || "");
    const u = URL.createObjectURL(await r.blob()), a = document.createElement("a");
    a.href = u; a.download = m ? m[1] : fallback; document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(u);
    toast("Downloaded — keep a copy off Railway");
  } catch (e) { toast("Download failed"); }
}
