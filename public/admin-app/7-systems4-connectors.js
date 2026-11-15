/* LABS admin · Systems · Connected apps v1.4 — 2026-11-15 (when an app's connection was refused in the last day, the card says when, why and which address it brought). v1.3 — 2026-11-14 (Add LABS to Gemini: the same access as Claude and Grok. Google's sign-in address is shared by every app on its platform, so the owner opens the door for ten minutes and the first Gemini to connect is the one that's kept; Forget Gemini ends its access). v1.2 — 2026-11-04 (Claude and Grok write Knowledge). v1.1 — 2026-10-28 (Create a key: for apps that take a pasted key — Manus. Shown once). v1.0 — 2026-10-27. Part 4: the LABS connector (server/connector/*.js) — the
   address to add in Claude, which keys are connected, and the button that cuts one off. Rendered under
   Meta by 7-systems.js. Read only on Claude's side; this card is the only place a key is managed. */
LOADERS.systemsConnectors = async () => { D.sysConn = await req("/api/admin/connectors"); };
function sysConnectorsHTML() {
  const C = D.sysConn;
  const head = `<h2 class="sec">Connected apps <span class="mono">reads the dashboard · writes Knowledge only · never messages</span></h2>`;
  if (!C) return `${head}<div class="panel">${askel("rows")}</div>`;
  if (C.error) return `${head}<div class="panel">${sysErr(C.error)}</div>`;
  const keys = C.keys || [], G = C.gemini || { openUntil: null, pinned: 0 };
  return `${head}<div class="panel">
    <div class="set"><div class="t"><b>Add LABS to Claude</b><span>In Claude: Settings → Connectors → Add custom connector → paste <span class="mono">${esc(C.url)}</span>. Claude sends you back here to allow it, signed in as the admin.</span></div></div>
    <div class="set" style="margin-top:8px"><div class="t"><b>Add LABS to Grok</b><span>On grok.com: Connectors → New Connector → Custom → paste <span class="mono">${esc(C.url)}</span>. Grok sends you back here to allow it, signed in as the admin — the same tools as Claude.</span></div></div>
    <div class="set" style="margin-top:8px;display:block"><div class="t"><b>Add LABS to Gemini</b><span>The same tools as Claude and Grok. Google's sign-in address is shared by every app built on its platform, so LABS only lets Gemini in when you say so: open the door, then within ten minutes, in Gemini: Settings → Connected apps → Custom apps → add one → paste <span class="mono">${esc(C.url)}</span>. Gemini sends you back here to allow it. The first Gemini to connect is the one LABS keeps.</span></div>
      <div class="row wrapx" style="gap:6px;margin-top:8px;align-items:center">${G.openUntil ? `<span class="tag on">Open until ${new Date(G.openUntil).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })} — connect in Gemini now</span>` : `<button class="btn sm" id="gmopen">${G.pinned ? "Open the door again" : "Open the door for 10 minutes"}</button>`}
        ${G.pinned ? `<span class="dim" style="font-size:12px">Gemini is known here.</span><button class="btn ghost sm" id="gmforget">Forget Gemini</button>` : ""}</div>
      ${C.lastRefusal ? `<p class="dim" style="font-size:12px;margin-top:8px;word-break:break-all">Last refused ${ago(C.lastRefusal.at)} ago — ${esc(C.lastRefusal.why)}${C.lastRefusal.uris.length ? `: ${C.lastRefusal.uris.map(esc).join(", ")}` : ""}</p>` : ""}</div>
    <div class="set" style="margin-top:8px"><div class="t"><b>Add LABS to another app (Manus)</b><span>For apps that ask for a server address and a key. Name it after the app and create a key — it's shown once, lasts 90 days and reads exactly what Claude does.</span></div></div>
    ${SYSNEWKEY ? `<div class="set" style="margin-top:8px;display:block"><div class="t"><b>${esc(SYSNEWKEY.name)} key — copy it now, it won't be shown again</b>
      <span style="display:block;margin-top:4px">Server URL: <span class="mono">${esc(SYSNEWKEY.url)}</span></span><span style="display:block;margin-top:4px">Header name: <span class="mono">Authorization</span></span><span style="display:block;margin-top:4px">Header value: <span class="mono" style="word-break:break-all">Bearer ${esc(SYSNEWKEY.key)}</span></span></div>
      <div class="row wrapx" style="gap:6px;margin-top:8px"><button class="btn sm" data-copykey="url">Copy URL</button><button class="btn sm" data-copykey="val">Copy key value</button><button class="btn ghost sm" data-copykey="done">Done</button></div></div>`
    : `<div class="row" style="gap:6px;margin-top:8px"><input class="in" id="keyname" maxlength="40" placeholder="App name, e.g. Manus" style="flex:1"><button class="btn sm" id="mkkey">Create a key</button></div>`}
    <div class="set" style="margin-top:8px"><div class="t"><b>What it can read</b><span>Numbers, orders, reports, members' public stats, tournaments, systems, and Knowledge. Never messages, emails, addresses or your notes — those have no tool.</span></div></div>
    <div class="set" style="margin-top:8px"><div class="t"><b>What it can write</b><span>Knowledge entries only (2026-11-04): ask Claude, Grok or Gemini to "save what we decided to LABS" and it adds a decision, a glossary word, a policy or a question with its answer. Each one says who wrote it, keeps the version before, is in the admin log, and is live in Echo at once. Nothing else can be written, nothing can be put away or deleted from there; at most 60 writes an hour.</span></div></div>
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
  const go = $("#gmopen"); if (go) go.onclick = async () => { go.disabled = true; try { await req("/api/admin/connectors/gemini/open", { method: "POST" }); toast("Open for ten minutes — connect in Gemini now"); await LOADERS.systemsConnectors(); paint(); } catch (e) { toast(e.message); go.disabled = false; } };
  const gf = $("#gmforget"); if (gf) gf.onclick = async () => { if (!confirm("Forget Gemini? It loses access, and has to be added again from the start.")) return; gf.disabled = true;
    try { await req("/api/admin/connectors/gemini", { method: "DELETE" }); toast("Gemini forgotten"); await LOADERS.systemsConnectors(); paint(); } catch (e) { toast(e.message); gf.disabled = false; } };
  $$("[data-revoke]").forEach((b) => b.onclick = async () => { if (!confirm("Disconnect this key? That app will lose access.")) return; b.disabled = true;
  try { await req("/api/admin/connectors/" + b.dataset.revoke, { method: "DELETE" }); toast("Disconnected"); D.sysConn = null; await LOADERS.systemsConnectors(); paint(); } catch (e) { toast(e.message); b.disabled = false; } });
};
