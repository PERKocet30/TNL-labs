/* LABS admin · Systems · MCP connectors v1.1 — 2026-10-28. Part 4: the LABS connector (server-12-mcp-*.js) — the
   address to add in Manus or Claude, which keys are connected, and the button that cuts one off. Rendered under
   Meta by 7-systems.js. Read only in the MCP client; this card is the only place a key is managed. */
LOADERS.systemsConnectors = async () => { D.sysConn = await req("/api/admin/connectors"); };
function sysConnectorsHTML() {
  const C = D.sysConn;
  const head = `<h2 class="sec">MCP connectors <span class="mono">read only · never messages</span></h2>`;
  if (!C) return `${head}<div class="panel"><div class="empty">Loading…</div></div>`;
  if (C.error) return `${head}<div class="panel">${sysErr(C.error)}</div>`;
  const keys = C.keys || [];
  return `${head}<div class="panel">
    <div class="set"><div class="t"><b>Add LABS to Manus or Claude</b><span>In Manus, add a custom MCP server by URL; in Claude, use Settings → Connectors → Add custom connector. Paste <span class="mono">${esc(C.url)}</span>. LABS sends the signed-in admin here to approve access.</span></div></div>
    <div class="set" style="margin-top:8px"><div class="t"><b>What it can read</b><span>Numbers, orders, reports, members' public stats, tournaments, systems. Never messages, emails, addresses or your notes — those have no tool.</span></div></div>
    ${keys.length ? `<div class="list" style="margin-top:8px">${keys.map((k) => `<div class="li"><span class="b"><b style="font-weight:500;font-size:13px">${esc(k.name)} · @${esc(k.by)}</b>
      <span>connected ${ago(k.createdAt)} ago · ${k.lastUsedAt ? `last read ${ago(k.lastUsedAt)} ago · ${num(k.calls)} reads` : "not used yet"} · renews itself until ${new Date(k.expiresAt).toLocaleDateString()}</span></span>
      <button class="btn ghost sm" data-revoke="${k.id}">Disconnect</button></div>`).join("")}</div>` : `<div class="empty" style="margin-top:8px">Nothing connected yet.</div>`}
  </div>`;
}
const sysConnWire = () => { $$("[data-revoke]").forEach((b) => b.onclick = async () => { if (!confirm("Disconnect this key? Manus or Claude will have to connect again.")) return; b.disabled = true;
  try { await req("/api/admin/connectors/" + b.dataset.revoke, { method: "DELETE" }); toast("Disconnected"); D.sysConn = null; await LOADERS.systemsConnectors(); paint(); } catch (e) { toast(e.message); b.disabled = false; } }); };
