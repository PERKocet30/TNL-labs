/* TNL LABS admin v3.0 — 2026-10-09. Labs: reports first, then every post —
   by lab (genre), #tag, work or talk. Labs are places now; the old channels
   only live on as the #tags their posts carry. */
let CLAB = "", CTAG = "", CKIND = "", CQ = "";
LOADERS.content = async () => {
  const [posts, reports] = await Promise.all([
    req(`/api/admin/posts?lab=${encodeURIComponent(CLAB)}&tag=${encodeURIComponent(CTAG)}&kind=${CKIND}&q=${encodeURIComponent(CQ)}`),
    req("/api/admin/reports"),
  ]);
  D.posts = posts; D.reports = reports.reports;
};

VIEWS.content = () => {
  const P = D.posts, R = D.reports;
  return `
  <div class="row sp wrapx"><h1 style="font-size:22px">Labs</h1><span class="mono">every post, by lab and #tag</span></div>
  ${R && R.length ? `<h2 class="sec">Reports <span class="mono">${R.length} open</span></h2>${R.map(reportHTML).join("")}` : ""}
  <h2 class="sec">Posts</h2>
  <div class="row wrapx" style="gap:8px;margin-bottom:8px"><input class="in" id="cq" placeholder="Search text or @username" value="${esc(CQ)}" autocomplete="off" style="flex:2;min-width:180px">
    <input class="in" id="ctag" placeholder="#tag" value="${CTAG ? "#" + esc(CTAG) : ""}" autocomplete="off" autocapitalize="off" style="flex:1;min-width:110px"></div>
  <div class="row wrapx" style="gap:8px;margin-bottom:12px">
    <div class="filters">${[["", "All"], ["work", "Work"], ["talk", "Talk"], ["reported", "Reported"]].map(([k, l]) => `<button class="pill sm ${CKIND === k ? "on" : ""}" data-ck="${k}">${l}</button>`).join("")}</div>
    <select class="sel" id="clab" aria-label="Lab"><option value="">Every lab and profile</option>${(P ? P.labs : []).map((l) => `<option value="${l.id}" ${CLAB === l.id ? "selected" : ""}>${l.id === "profile" ? "Profiles" : "// " + esc(l.name)} (${l.n})</option>`).join("")}</select>
    ${CTAG ? `<button class="chip tg on" data-ctagx>#${esc(CTAG)} ${I.x}</button>` : ""}
  </div>
  ${!P ? `<div class="empty">Loading…</div>` : !P.posts.length ? `<div class="empty">No posts match.</div>` : `<div class="posts">${P.posts.map(postCardHTML).join("")}</div>`}`;
};

const whereLine = (x) => (x.labName && x.labName !== "Profile" ? "// " + x.labName : "Profile") + " · " + (x.isWork ? "work" : "talk");
function postCardHTML(x) {
  return `<div class="pc">
    <div class="im">${x.thumbUrl ? `<img src="${esc(x.thumbUrl)}" alt="" loading="lazy">` : `<p>${esc(x.body || (x.video ? "Video" : x.beat ? "Beat" : "Post"))}</p>`}</div>
    <div class="meta"><span class="row" style="gap:6px"><button data-person="${esc(x.author.username)}"><b>@${esc(x.author.username)}</b></button>${x.pinned ? `<span class="tag on">pinned</span>` : ""}${x.reports ? `<span class="tag warn">${x.reports} report${x.reports === 1 ? "" : "s"}</span>` : ""}</span>
      <span class="dim">${esc(whereLine(x))} · ${ago(x.createdAt)} · ${x.likes} like${x.likes === 1 ? "" : "s"} · ${x.comments} comment${x.comments === 1 ? "" : "s"}</span>
      ${x.thumbUrl && x.body ? `<span class="dim" style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(x.body)}</span>` : ""}
      ${x.tags && x.tags.length ? `<span class="tgs">${x.tags.slice(0, 6).map((t) => `<button class="htg" data-tagf="${esc(t)}">#${esc(t)}</button>`).join(" ")}</span>` : ""}</div>
    <div class="acts">
      ${x.channel !== "profile" ? `<button class="btn ghost sm" data-pin="${x.id}:${x.pinned ? 0 : 1}">${I.pin} ${x.pinned ? "Unpin" : "Pin"}</button>` : ""}
      <button class="btn danger sm" data-del="${x.id}" aria-label="Delete post">${I.trash}</button>
    </div></div>`;
}
function reportHTML(r) {
  return `<div class="report">
    ${r.post_img ? `<img src="${esc(r.post_img)}" alt="" style="width:64px;height:64px;object-fit:cover;flex-shrink:0">` : ""}
    <div style="flex:1;min-width:0"><b>${esc(r.reason || "Reported")}</b>
      <div class="dim" style="font-size:12.5px;margin:3px 0 8px">${r.reported ? `about <button data-person="${esc(r.reported)}"><b>@${esc(r.reported)}</b></button> · ` : ""}by @${esc(r.reporter || "?")} · ${ago(r.created_at)}${r.post_lab ? " · " + esc(r.post_lab === "Profile" ? "Profile" : "// " + r.post_lab) : ""}</div>
      ${r.post_body ? `<div style="font-size:13px;margin-bottom:8px">“${esc(r.post_body.slice(0, 220))}”</div>` : ""}
      <div class="acts">${r.post_id ? `<button class="btn danger sm" data-del="${r.post_id}" data-rep="${r.id}">Remove post</button>` : ""}
        ${r.reported ? `<button class="btn ghost sm" data-person="${esc(r.reported)}">Open @${esc(r.reported)}</button>` : ""}
        <button class="btn ghost sm" data-dismiss="${r.id}">Dismiss</button></div>
    </div></div>`;
}

WIRES.content = () => {
  const q = $("#cq"); if (q) { let t; q.oninput = () => { CQ = q.value; clearTimeout(t); t = setTimeout(async () => { await load(); const f = $("#cq"); if (f) { f.focus(); f.setSelectionRange(f.value.length, f.value.length); } }, 250); }; }
  $$("[data-ck]").forEach((b) => b.onclick = () => { CKIND = b.dataset.ck; D.posts = null; paint(); load(); });
  const c = $("#clab"); if (c) c.onchange = () => { CLAB = c.value; load(); };
  const tg = $("#ctag"); if (tg) tg.onchange = () => { CTAG = tg.value.replace(/^#/, "").toLowerCase().replace(/[^a-z0-9_]/g, "").slice(0, 30); D.posts = null; paint(); load(); };
  $$("[data-tagf]").forEach((b) => b.onclick = () => { CTAG = b.dataset.tagf; D.posts = null; paint(); load(); scrollTo(0, 0); });
  const tx = $("[data-ctagx]"); if (tx) tx.onclick = () => { CTAG = ""; D.posts = null; paint(); load(); };
  $$("[data-del]").forEach((b) => b.onclick = async () => {
    if (!(await confirmIt("Delete this post?", "It's removed for everyone. The author isn't told automatically.", { ok: "Delete", danger: true }))) return;
    const ok = await act(() => req("/api/admin/posts/" + b.dataset.del, { method: "DELETE" }), "Deleted");
    if (ok && b.dataset.rep) await act(() => req("/api/admin/reports/" + b.dataset.rep + "/handle", { method: "POST" }));
    load();
  });
  $$("[data-dismiss]").forEach((b) => b.onclick = async () => { await act(() => req("/api/admin/reports/" + b.dataset.dismiss + "/handle", { method: "POST" }), "Dismissed"); D.pulse = null; load(); });
  $$("[data-pin]").forEach((b) => b.onclick = async () => {
    const [id, on] = b.dataset.pin.split(":");
    await act(() => req("/api/posts/" + id + "/pin", { method: "POST", body: { pinned: on === "1" } }), on === "1" ? "Pinned at the top of its lab" : "Unpinned");
    load();
  });
};
