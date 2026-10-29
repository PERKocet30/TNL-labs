/* LABS admin · Systems · Connected apps v1.1 — 2026-10-28 (Create a key: for apps that take a pasted key — Manus. Shown once). v1.0 — 2026-10-27. Part 4: the LABS connector (server-12-mcp-*.js) — the
   address to add in Claude, which keys are connected, and the button that cuts one off. Rendered under
   Meta by 7-systems.js. Read only on Claude's side; this card is the only place a key is managed. */
LOADERS.systemsConnectors = async () => { D.sysConn = await req("/api/admin/connectors"); };
function sysConnectorsHTML() {
  const C = D.sysConn;
  const head = `<h2 class="sec">Connected apps <span class="mono">read only · never messages</span></h2>`;
  if (!C) return `${head}<div class="panel"><div class="empty">Loading…</div></div>`;
  if (C.error) return `${head}<div class="panel">${sysErr(C.error)}</div>`;
  const keys = C.keys || [];
  return `${head}<div class="panel">
    <div class="set"><div class="t"><b>Add LABS to Claude</b><span>In Claude: Settings → Connectors → Add custom connector → paste <span class="mono">${esc(C.url)}</span>. Claude sends you back here to allow it, signed in as the admin.</span></div></div>
    <div class="set" style="margin-top:8px"><div class="t"><b>Add LABS to another app (Manus)</b><span>For apps that ask for a server address and a key. Name it after the app and create a key — it's shown once, lasts 90 days and reads exactly what Claude does.</span></div></div>
    ${SYSNEWKEY ? `<div class="set" style="margin-top:8px;display:block"><div class="t"><b>${esc(SYSNEWKEY.name)} key — copy it now, it won't be shown again</b>
      <span style="display:block;margin-top:4px">Server URL: <span class="mono">${esc(SYSNEWKEY.url)}</span></span><span style="display:block;margin-top:4px">Header name: <span class="mono">Authorization</span></span><span style="display:block;margin-top:4px">Header value: <span class="mono" style="word-break:break-all">Bearer ${esc(SYSNEWKEY.key)}</span></span></div>
      <div class="row wrapx" style="gap:6px;margin-top:8px"><button class="btn sm" data-copykey="url">Copy URL</button><button class="btn sm" data-copykey="val">Copy key value</button><button class="btn ghost sm" data-copykey="done">Done</button></div></div>`
    : `<div class="row" style="gap:6px;margin-top:8px"><input class="in" id="keyname" maxlength="40" placeholder="App name, e.g. Manus" style="flex:1"><button class="btn sm" id="mkkey">Create a key</button></div>`}
    <div class="set" style="margin-top:8px"><div class="t"><b>What it can read</b><span>Numbers, orders, reports, members' public stats, tournaments, systems. Never messages, emails, addresses or your notes — those have no tool.</span></div></div>
    ${keys.length ? `<div class="list" style="margin-top:8px">${keys.map((k) => `<div class="li"><span class="b"><b style="font-weight:500;font-size:13px">${esc(k.name)} · @${esc(k.by)}</b>
      <span>${k.pasted ? "pasted key" : "connected"} ${ago(k.createdAt)} ago · ${k.lastUsedAt ? `last read ${ago(k.lastUsedAt)} ago · ${num(k.calls)} reads` : "not used yet"} · ${k.pasted ? "works" : "renews itself"} until ${new Date(k.expiresAt).toLocaleDateString()}</span></span>
      <button class="btn ghost sm" data-revoke="${k.id}">Disconnect</button></div>`).join("")}</div>` : `<div class="empty" style="margin-top:8px">Nothing connected yet.</div>`}
  </div>`;
}
let SYSNEWKEY = null;   // a key just made — kept only on this page, only until Done
const sysConnWire = () => {
  const mk = $("#mkkey"); if (mk) mk.onclick = async () => { const name = ($("#keyname").value || "").trim(); if (!name) return toast("Name it after the app, e.g. Manus");
    mk.disabled = true; try { SYSNEWKEY = await req("/api/admin/connectors/key", { method: "POST", body: { name } }); await LOADERS.systemsConnectors(); paint(); } catch (e) { toast(e.message); mk.disabled = false; } };
  $$("[data-copykey]").forEach((b) => b.onclick = async () => { const w = b.dataset.copykey;
    if (w === "done") { SYSNEWKEY = null; return paint(); }
    const v = w === "url" ? SYSNEWKEY.url : "Bearer " + SYSNEWKEY.key; try { await navigator.clipboard.writeText(v); toast("Copied"); } catch (e) { toast(v); } });
  $$("[data-revoke]").forEach((b) => b.onclick = async () => { if (!confirm("Disconnect this key? That app will lose access.")) return; b.disabled = true;
  try { await req("/api/admin/connectors/" + b.dataset.revoke, { method: "DELETE" }); toast("Disconnected"); D.sysConn = null; await LOADERS.systemsConnectors(); paint(); } catch (e) { toast(e.message); b.disabled = false; } });
};
