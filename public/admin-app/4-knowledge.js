/* LABS admin — Knowledge v1.2, 2026-11-04 (Echo wrote this). v1.1, 2026-11-04 (more kinds; who wrote it: Claude, Grok, an app). v1.0, 2026-11-04. What LABS knows about itself
   (server/knowledge): the creed, how LABS talks, settled decisions, the
   glossary, notes, the blueprint sheets. LABS owns the memory; Claude
   only updates it. Everything here can be read, edited and put back the
   way it was: each entry keeps its earlier versions with who and when.
   Export gives any model the same text. */
let KNOWKIND = "", KNOWQ = "", KNOWEDIT = null, KNOWHIST = null, KNOWARCH = false;
LOADERS.knowledge = async () => {
  D.knowledge = await req(`/api/admin/knowledge?kind=${encodeURIComponent(KNOWKIND)}&q=${encodeURIComponent(KNOWQ)}${KNOWARCH ? "&archived=1" : ""}`);
  D.knowhist = KNOWHIST ? await req(`/api/admin/knowledge/${KNOWHIST}/history`).catch(() => null) : null;
};
const knowWhen = (t) => (t ? new Date(t).toLocaleString([], { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" }) : "");
VIEWS.knowledge = () => {
  const d = D.knowledge;
  const head = pageHead("Knowledge", "What LABS knows about itself — the creed, how it talks, what's decided, the words. Kept here, not in a chat. Any model reads the export.",
    `<div class="row wrapx" style="gap:6px"><a class="btn ghost sm" href="/api/admin/knowledge/export?format=text" target="_blank" rel="noopener" id="knowtext">Export as text ${I.out}</a><a class="btn ghost sm" href="/api/admin/knowledge/export" target="_blank" rel="noopener">JSON ${I.out}</a><button class="btn sm" id="knownew">Add</button></div>`);
  if (!d) return `${head}${askel()}`;
  const K = d.kinds;
  const chips = `<div class="row wrapx" style="gap:6px;margin:0 0 10px"><button class="btn ghost sm ${!KNOWKIND ? "on" : ""}" data-knowkind="">All</button>${Object.entries(K).map(([k, n]) => `<button class="btn ghost sm ${KNOWKIND === k ? "on" : ""}" data-knowkind="${k}">${n}</button>`).join("")}
    <input class="in" id="knowq" placeholder="Search" value="${esc(KNOWQ)}" style="max-width:240px;margin-left:auto"><button class="btn ghost sm ${KNOWARCH ? "on" : ""}" id="knowarch" title="Entries put away">Archive</button></div>`;
  const form = (f) => `<div class="panel" style="margin:8px 0 12px"><h3 style="margin:0 0 8px">${f.id ? "Edit" : "Add to what LABS knows"}</h3>
    <div class="row wrapx" style="gap:8px"><select class="sel" id="kf-kind">${Object.entries(K).map(([k, n]) => `<option value="${k}" ${f.kind === k ? "selected" : ""}>${n}</option>`).join("")}</select>
      <input class="in" id="kf-title" maxlength="160" value="${esc(f.title || "")}" placeholder="Title" style="flex:1;min-width:200px"></div>
    <label class="l" for="kf-body">The words</label><textarea class="in" id="kf-body" maxlength="20000" style="min-height:140px" placeholder="Plain words. This is what a model reads.">${esc(f.body || "")}</textarea>
    <label class="l" for="kf-tags">Tags (optional)</label><input class="in" id="kf-tags" maxlength="200" value="${esc(f.tags || "")}" placeholder="e.g. rep levels">
    <div class="row wrapx" style="gap:8px;margin-top:12px"><button class="btn sm" id="kf-go">${f.id ? "Save" : "Add"}</button><button class="btn ghost sm" id="kf-x">Cancel</button>
      ${f.id ? `<button class="btn ghost sm" id="kf-hist">History</button><button class="btn ghost sm" id="kf-arch" style="margin-left:auto">${f.archived ? "Bring back" : "Put away"}</button>` : ""}</div></div>`;
  const hist = (e) => { const h = D.knowhist; if (!h) return askel("rows");
    return `<div class="panel" style="margin:0 0 12px"><div class="row sp"><h3 style="margin:0">Earlier versions of “${esc(e.title)}”</h3><button class="btn ghost sm" id="kh-x">Close</button></div>
      ${h.history.length ? h.history.map((v) => `<div class="set" style="align-items:flex-start"><div class="t" style="flex:1"><b>${esc(v.title)} <span class="tag">${esc(K[v.kind] || v.kind)}</span></b><span style="white-space:pre-wrap">${esc(v.body)}</span><span class="mono">${v.by ? "by @" + esc(v.by) + " · " : ""}${knowWhen(v.at)}</span></div><button class="btn ghost sm" data-knowrestore="${v.version}" data-entry="${e.id}">Restore</button></div>`).join("")
      : `<div class="empty">This is the only version so far.</div>`}</div>`; };
  const groups = Object.entries(K).map(([k, n]) => [k, n, d.entries.filter((e) => e.kind === k)]).filter(([, , es]) => es.length);
  const list = groups.length ? groups.map(([k, n, es]) => `<h2 class="sec">${n} <span class="mono">${es.length}</span></h2><div class="list">${es.map((e) => KNOWEDIT && KNOWEDIT.id === e.id ? form(KNOWEDIT) + (KNOWHIST === e.id ? hist(e) : "")
    : `<div class="li" style="align-items:flex-start"><div class="b"><b>${esc(e.title)}${e.source === "claude" ? `<span class="tag on">Claude wrote this</span>` : e.source === "grok" ? `<span class="tag on">Grok wrote this</span>` : e.source === "connector" ? `<span class="tag on">an app wrote this</span>` : e.source === "echo" ? `<span class="tag on">Echo wrote this</span>` : ""}${e.archived ? `<span class="tag warn">put away</span>` : ""}</b>
      <span style="white-space:pre-wrap;color:var(--tx)">${esc(e.body)}</span>
      <span class="mono">${e.tags ? esc(e.tags) + " · " : ""}${e.updatedBy ? "by @" + esc(e.updatedBy).replace("@LABS", "LABS") + " · " : ""}${knowWhen(e.updatedAt)}</span></div>
      <button class="btn ghost sm" data-knowedit="${e.id}">Edit</button></div>`).join("")}</div>`).join("")
    : `<div class="empty">${KNOWQ ? "Nothing matches." : KNOWARCH ? "Nothing put away." : "Nothing here yet — tap Add."}</div>`;
  return `${head}${chips}${KNOWEDIT && !KNOWEDIT.id ? form(KNOWEDIT) : ""}${list}
    <p class="dim" style="margin-top:16px;font-size:12.5px">Claude and Grok can add and edit here through the connector (Systems → Connected apps) when you ask them to — each entry says who wrote it, keeps the version before, and is in the admin log. They can't put anything away or delete. Not the raw data — members, posts and orders already live in LABS. This is the layer on top: what it means, what's decided, how LABS talks. Messages are never part of it.</p>`;
};
WIRES.knowledge = () => {
  const d = D.knowledge; if (!d) return;
  $$("[data-knowkind]").forEach((b) => b.onclick = () => { KNOWKIND = b.dataset.knowkind; KNOWEDIT = null; load(); });
  const q = $("#knowq"); if (q) { q.onchange = () => { KNOWQ = q.value.trim(); load(); }; q.onkeydown = (e) => { if (e.key === "Enter") { KNOWQ = q.value.trim(); load(); } }; }
  const ar = $("#knowarch"); if (ar) ar.onclick = () => { KNOWARCH = !KNOWARCH; KNOWEDIT = null; load(); };
  const nw = $("#knownew"); if (nw) nw.onclick = () => { KNOWEDIT = { kind: KNOWKIND || "note", title: "", body: "", tags: "" }; KNOWHIST = null; paint(); $("#kf-title")?.focus(); };
  $$("[data-knowedit]").forEach((b) => b.onclick = () => { KNOWEDIT = { ...d.entries.find((e) => e.id === +b.dataset.knowedit) }; KNOWHIST = null; paint(); });
  const read = () => ({ kind: $("#kf-kind").value, title: $("#kf-title").value.trim(), body: $("#kf-body").value.trim(), tags: $("#kf-tags").value.trim() });
  const go = $("#kf-go"); if (go) go.onclick = async () => {
    const f = read(); if (!f.title || !f.body) return toast("A title and the words, please");
    const id = KNOWEDIT && KNOWEDIT.id;
    const r = await act(() => req(id ? "/api/admin/knowledge/" + id : "/api/admin/knowledge", { method: id ? "PATCH" : "POST", body: f }), id ? "Saved — the version before is kept" : "Added");
    if (r) { KNOWEDIT = null; KNOWHIST = null; load(); }
  };
  const x = $("#kf-x"); if (x) x.onclick = () => { KNOWEDIT = null; KNOWHIST = null; paint(); };
  const hb = $("#kf-hist"); if (hb) hb.onclick = () => { KNOWHIST = KNOWEDIT.id; load(); };
  const hx = $("#kh-x"); if (hx) hx.onclick = () => { KNOWHIST = null; paint(); };
  const arc = $("#kf-arch"); if (arc) arc.onclick = async () => {
    const f = KNOWEDIT;
    if (!f.archived && !(await confirmIt("Put this away?", "It leaves the export and what models read. You can bring it back from Archive.", { ok: "Put away" }))) return;
    await act(() => req("/api/admin/knowledge/" + f.id, { method: "PATCH", body: { archived: !f.archived } }), f.archived ? "Brought back" : "Put away"); KNOWEDIT = null; load();
  };
  $$("[data-knowrestore]").forEach((b) => b.onclick = async () => {
    await act(() => req(`/api/admin/knowledge/${b.dataset.entry}/restore/${b.dataset.knowrestore}`, { method: "POST" }), "Restored — today's version is kept too"); KNOWEDIT = null; KNOWHIST = null; load();
  });
};
