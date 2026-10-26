/* LABS admin — Instagram v1.0, 2026-10-26. The messages people send
   @tnl.labs on Instagram, read here (server-12-instagram-inbox): who
   wrote, what, when, and which are new. Read only — a reply opens the
   conversation in Instagram itself. Connect once (Instagram's own
   sign-in); LABS keeps the key on the server and checks for new messages
   every few minutes. */
let IGCONV = null;
LOADERS.instagram = async () => {
  D.instagram = await req("/api/admin/instagram");
  D.igthread = IGCONV ? await req("/api/admin/instagram/thread/" + encodeURIComponent(IGCONV)).catch(() => null) : null;
};
const igWhen = (t) => (t ? new Date(t).toLocaleString([], { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }) : "");
const igDay = (t) => (t ? new Date(t).toLocaleDateString([], { month: "long", day: "numeric", year: "numeric" }) : "");

VIEWS.instagram = () => {
  const d = D.instagram;
  if (!d) return `${pageHead("Instagram", "Messages sent to the LABS account on Instagram.")}<div class="empty">Loading…</div>`;
  if (IGCONV) return igThreadHTML(d);
  const who = d.username ? "@" + esc(d.username) : "the LABS account";
  const actions = d.connected
    ? `<div class="row wrapx" style="gap:6px"><button class="btn ghost sm" id="igsync">Check now</button>${d.unread ? `<button class="btn ghost sm" id="igseen">Mark all read</button>` : ""}</div>`
    : d.ready ? `<button class="btn sm" id="igconnect">Connect Instagram</button>` : "";
  const status = d.connected ? `<div class="panel igst"><div><b>Connected as @${esc(d.username)}</b>
      <p class="dim">Checked ${d.syncedAt ? igWhen(d.syncedAt) : "not yet"} · looks every ${d.pollMinutes} min · key good until ${igDay(d.expiresAt)}, renewed on its own while it's used.</p>
      ${d.lastError ? `<p class="warnl">Instagram said: ${esc(d.lastError)}</p>` : ""}</div>
      <button class="btn ghost sm" id="igoff">Disconnect</button></div>` : "";
  const L = d.conversations || [];
  const list = !d.connected ? "" : `<h2 class="sec">Conversations <span class="mono">${L.length ? L.length + " · " + (d.unread ? d.unread + " new" : "nothing new") : ""}</span></h2>
    <div class="list">${L.length ? L.map((c) => `<button class="li" data-igc="${esc(c.id)}"><div class="b"><b>@${esc(c.username || "someone")}${c.unread ? `<span class="tag on">${c.unread} new</span>` : ""}</b>
      <span>${c.last ? `${c.last.mine ? "You: " : ""}${esc(c.last.text || (c.last.attachments ? "📎 attachment" : "…")).slice(0, 90)}` : "No messages yet"}</span></div>
      <div class="r">${igWhen(c.updatedAt)}</div>${I.chev}</button>`).join("")
      : `<div class="empty">No conversations yet. ${d.syncedAt ? "Instagram shows the last 30 days of requests and every open chat." : "The first check runs within a minute."}</div>`}</div>`;
  return `${pageHead("Instagram", `Messages people send ${who} on Instagram, read here. Replies happen in Instagram — each conversation has a button for that.`, actions)}
    ${status}${list}${igSetupHTML(d)}`;
};
function igSetupHTML(d) {
  const row = (label, v) => `<div class="igrow"><span class="dim">${label}</span><code class="mono" id="${label.replace(/\W/g, "").toLowerCase()}">${esc(v)}</code><button class="btn ghost sm" data-igcopy="${esc(v)}">Copy</button></div>`;
  return `<h2 class="sec" style="margin-top:18px">${d.connected ? "Setup, for reference" : "Setup"}</h2><div class="panel">
    ${d.ready ? "" : `<p class="warnl">Not set up yet. In Railway → Variables add <code>IG_APP_ID</code> and <code>IG_APP_SECRET</code> from your Meta app (App settings → Basic). The app reboots and this page changes.</p>`}
    <p class="dim" style="margin-bottom:10px">In your Meta app, under <b>Instagram → API setup with Instagram login</b>: add the LABS account under <b>Generate access tokens</b> (that's what lets it read messages without Meta's review), and paste these three values where it asks.</p>
    ${row("Redirect URI", d.webhook.redirect)}${row("Callback URL", d.webhook.url)}${row("Verify token", d.webhook.verifyToken || "(set IG_APP_SECRET first)")}
    <p class="dim" style="margin-top:10px">Webhooks (messages arriving the second they're sent) only start once Meta marks the app Live with Advanced Access. Until then LABS checks every ${d.pollMinutes} minutes, which works from day one.</p></div>`;
}
function igThreadHTML(d) {
  const t = D.igthread;
  const back = `<button class="btn ghost sm" id="igback">${I.chev} All conversations</button>`;
  if (!t) return `${pageHead("Instagram", "", back)}<div class="empty">Loading…</div>`;
  const open = t.username ? `<a class="btn sm" href="https://ig.me/m/${encodeURIComponent(t.username)}" target="_blank" rel="noopener">Reply in Instagram ${I.out}</a>` : "";
  let day = "";
  const rows = t.messages.map((m) => {
    const dd = igDay(m.created_at), sep = dd !== day ? `<div class="igday mono">${dd}</div>` : ""; day = dd;
    const atts = m.attachments.map((a) => a.type === "image" ? `<a href="${esc(a.url)}" target="_blank" rel="noopener"><img src="${esc(a.url)}" alt="" loading="lazy"></a>`
      : `<a class="igfile" href="${esc(a.url)}" target="_blank" rel="noopener">${esc(a.type)} ${I.out}</a>`).join("");
    return `${sep}<div class="igm ${m.mine ? "me" : ""}"><div class="bub">${m.text ? `<p>${esc(m.text)}</p>` : ""}${atts}</div><span class="mono">${m.mine ? "You" : "@" + esc(m.from_username || t.username || "them")} · ${igWhen(m.created_at)}</span></div>`;
  }).join("");
  return `${pageHead("@" + esc(t.username || "someone"), `${t.messages.length} message${t.messages.length === 1 ? "" : "s"} · read only here`, `<div class="row wrapx" style="gap:6px">${back}${open}</div>`)}
    <div class="igthread">${rows || `<div class="empty">Nothing here yet.</div>`}</div>
    <p class="dim" style="margin-top:12px">Instagram only hands over the 20 newest messages of a conversation; anything older stays in the Instagram app.</p>`;
}

WIRES.instagram = () => {
  $$("[data-igc]").forEach((b) => b.onclick = async () => { IGCONV = b.dataset.igc; D.igthread = null; paint(); await LOADERS.instagram(); paint(); });
  const bk = $("#igback"); if (bk) bk.onclick = async () => { IGCONV = null; await LOADERS.instagram(); paint(); };
  $$("[data-igcopy]").forEach((b) => b.onclick = async () => { try { await navigator.clipboard.writeText(b.dataset.igcopy); toast("Copied"); } catch (e) { toast("Couldn't copy — select it and copy"); } });
  const c = $("#igconnect"); if (c) c.onclick = async () => { try { const r = await req("/api/admin/instagram/connect"); location.href = r.url; } catch (e) { toast(e.message); } };
  const s = $("#igsync"); if (s) s.onclick = async () => { s.disabled = true; try { const r = await req("/api/admin/instagram/sync", { method: "POST" }); toast(r.fresh ? r.fresh + " new" : "Nothing new"); await LOADERS.instagram(); paint(); } catch (e) { toast(e.message); s.disabled = false; } };
  const sn = $("#igseen"); if (sn) sn.onclick = async () => { await req("/api/admin/instagram/seen", { method: "POST" }); await LOADERS.instagram(); paint(); };
  const off = $("#igoff"); if (off) off.onclick = async () => {
    if (!await modal({ title: "Disconnect Instagram?", body: "LABS forgets the key and every message it has read. Nothing changes on Instagram itself.", ok: "Disconnect", danger: true })) return;
    await req("/api/admin/instagram/disconnect", { method: "POST" }); await LOADERS.instagram(); paint();
  };
};
/* back from Instagram's sign-in: /admin?ig=ok or ?ig=<why not> */
try { const igq = new URLSearchParams(location.search).get("ig");
  if (igq) { history.replaceState(null, "", "/admin#instagram"); setTimeout(() => toast(igq === "ok" ? "Instagram connected" : igq), 600); } } catch (e) {}
