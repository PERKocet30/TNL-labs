/* LABS admin — Echo v1.0, 2026-11-04. Echo is the help desk inside Messages
   (server/echo). This page is where you teach it: what people asked that it
   couldn't answer (teach one in a tap), how its answers are rated, every
   answer it knows (edit, switch off, forget what it learned), the
   conversations handed to a person, and the switch that opens Echo to
   everyone — it's admins-only until then. */
let ECHOTEACH = null, ECHOEDIT = null, ECHOQ = "";
LOADERS.echo = async () => { D.echo = await req("/api/admin/echo?days=" + RANGE); };
const echoWhen = (t) => (t ? new Date(t).toLocaleString([], { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }) : "");
VIEWS.echo = () => {
  const d = D.echo;
  if (!d) return `${pageHead("Echo", "The help desk inside Messages. Teach it here.")}<div class="empty">Loading…</div>`;
  const n = d.numbers, pc = (a, b) => (b ? Math.round((a / b) * 100) + "%" : "—");
  const open = d.handoffs.filter((h) => h.status === "open");
  const sw = `<div class="set" style="border:0;padding:0"><div class="t"><b>Open to everyone</b><span>${d.open ? "Every member sees Echo at the top of Messages." : "Admins only, while you perfect it. Members don't see it."}</span></div>
    <button class="sw ${d.open ? "on" : ""}" id="echoopen" role="switch" aria-checked="${d.open}" aria-label="Open Echo to everyone"></button></div>`;
  const form = (f, title, go, cancel) => `<div class="panel echo-form"><h3 style="margin:0 0 8px">${title}</h3>
    <label class="l" for="ef-q">The question, as a member would ask it</label><input class="in" id="ef-q" maxlength="200" value="${esc(f.question || "")}" placeholder="e.g. How long does shipping take?">
    <label class="l" for="ef-a">Echo's answer</label><textarea class="in" id="ef-a" maxlength="2000" placeholder="Plain words. Say what to do and where to tap.">${esc(f.answer || "")}</textarea>
    <label class="l" for="ef-k">Other words people use for it (optional)</label><input class="in" id="ef-k" maxlength="400" value="${esc(f.keywords || "")}" placeholder="e.g. delivery post mail arrive">
    <div class="row wrapx" style="gap:8px;margin-top:10px"><select class="sel" id="ef-t"><option value="">Topic…</option>${d.topics.map((t) => `<option ${f.topic === t ? "selected" : ""}>${t}</option>`).join("")}</select>
      <select class="sel" id="ef-x" title="Add the member's own account under the answer">${d.actions.map((a) => `<option value="${a}" ${f.action === a ? "selected" : ""}>${a ? "+ their " + a : "No account lookup"}</option>`).join("")}</select></div>
    <div class="row" style="gap:8px;margin-top:12px"><button class="btn sm" id="${go}">${f.id ? "Save" : "Teach Echo"}</button><button class="btn ghost sm" id="${cancel}">Cancel</button>${f.id && f.learned ? `<button class="btn ghost sm" id="ef-forget" title="${esc(f.learned)}">Forget learned words</button>` : ""}${f.id ? `<button class="btn ghost sm" id="ef-del" style="margin-left:auto;color:var(--red)">Delete</button>` : ""}</div></div>`;
  const missed = d.missed.length ? `<div class="list">${d.missed.map((m, i) => `<div class="li"><div class="b"><b>${esc(m.asked)}</b><span>${m.n > 1 ? `asked ${m.n} times · ` : ""}${m.why === "unhelpful" ? "answered, thumbs down" : m.why === "maybe" ? "wasn't sure" : "didn't know"} · ${ago(m.last)}</span></div>
      <button class="btn ghost sm" data-echoteach="${i}">Teach</button></div>`).join("")}</div>` : `<div class="empty">Nothing missed in this period. Echo answered everything it was asked${n.asked ? "" : " — well, nobody asked yet"}.</div>`;
  const faqs = d.faq.filter((f) => !ECHOQ || (f.question + " " + f.answer + " " + f.keywords + " " + f.topic).toLowerCase().includes(ECHOQ.toLowerCase()));
  const know = `<div class="row sp wrapx" style="gap:8px;margin:0 0 8px"><input class="in" id="echoq" placeholder="Search what Echo knows" value="${esc(ECHOQ)}" style="max-width:320px"><button class="btn sm" id="echonew">Teach something new</button></div>
    ${ECHOEDIT && !ECHOEDIT.id ? form(ECHOEDIT, "Teach Echo", "ef-go", "ef-x2") : ""}
    <div class="list">${faqs.map((f) => ECHOEDIT && ECHOEDIT.id === f.id ? form(ECHOEDIT, "Edit", "ef-go", "ef-x2") : `<div class="li ${f.enabled ? "" : "dim"}"><div class="b"><b>${esc(f.question)}${f.topic ? `<span class="tag">${esc(f.topic)}</span>` : ""}${f.action ? `<span class="tag on">+ ${esc(f.action)}</span>` : ""}${f.enabled ? "" : `<span class="tag warn">off</span>`}${f.source === "taught" ? `<span class="tag">taught</span>` : ""}</b>
      <span>${esc(f.answer).slice(0, 140)}${f.answer.length > 140 ? "…" : ""}</span>${f.learned ? `<span class="mono" style="font-size:11px">learned: ${esc(f.learned)}</span>` : ""}</div>
      <div class="r"><span class="mono">${f.asked ? `${f.asked} asked · ${f.liked}👍 ${f.disliked}👎` : "not asked yet"}</span></div><button class="btn ghost sm" data-echoedit="${f.id}">Edit</button></div>`).join("") || `<div class="empty">Nothing matches.</div>`}</div>`;
  const hand = d.handoffs.length ? `<div class="list">${d.handoffs.map((h) => `<div class="li"><div class="b"><b>@${esc(h.username)} <span class="mono">${esc(h.email)}</span>${h.status === "open" ? `<span class="tag on">open</span>` : `<span class="tag">done</span>`}</b>
      ${h.note ? `<span><i>${esc(h.note)}</i></span>` : ""}<pre class="mono" style="white-space:pre-wrap;font-size:11.5px;margin:4px 0 0;color:var(--tx2)">${esc(h.transcript)}</pre><span class="mono">${echoWhen(h.created_at)}</span></div>
      ${h.status === "open" ? `<div class="row" style="gap:6px"><a class="btn ghost sm" href="mailto:${esc(h.email)}?subject=${encodeURIComponent("Your LABS question")}">Reply ${I.out}</a><button class="btn ghost sm" data-echodone="${h.id}">Done</button></div>` : ""}</div>`).join("")}</div>` : `<div class="empty">Nobody has asked for a person yet.</div>`;
  return `${pageHead("Echo", "The help desk inside Messages. Answers from what it's been taught, looks up the asking member's own account, learns from thumbs and from what people pick, and hands the rest to you.")}
    <div class="panel" style="margin-bottom:14px">${sw}</div>
    <div class="stats">${[["Questions", num(n.asked)], ["People", num(n.people)], ["Answered", pc(n.answered, n.asked)], ["Rated helpful", pc(n.liked, n.rated)]].map(([l, v]) => `<div><b>${v}</b><span>${l}</span></div>`).join("")}</div>
    <h2 class="sec">What it missed <span class="mono">${d.missed.length ? d.missed.length + " to teach" : ""}</span></h2>${ECHOTEACH ? form(ECHOTEACH, "Teach Echo this one", "ef-go", "ef-x2") : ""}${missed}
    <h2 class="sec" style="margin-top:18px">Handed to a person <span class="mono">${open.length ? open.length + " open" : ""}</span></h2>${hand}
    <h2 class="sec" style="margin-top:18px">What Echo knows <span class="mono">${d.faq.length} answers</span></h2>${know}`;
};
WIRES.echo = () => {
  const d = D.echo; if (!d) return;
  const sw = $("#echoopen"); if (sw) sw.onclick = async () => {
    if (!d.open && !(await confirmIt("Open Echo to everyone?", "Every member will see Echo at the top of Messages. You can switch it back any time.", { ok: "Open it" }))) return;
    await act(() => req("/api/admin/settings", { method: "PATCH", body: { echoOpen: d.open ? "0" : "1" } }), d.open ? "Echo is admins-only again" : "Echo is open to everyone"); load();
  };
  $$("[data-echoteach]").forEach((b) => b.onclick = () => { ECHOEDIT = null; ECHOTEACH = { question: d.missed[+b.dataset.echoteach].asked }; paint(); $("#ef-a")?.focus(); });
  const nw = $("#echonew"); if (nw) nw.onclick = () => { ECHOTEACH = null; ECHOEDIT = { question: "", answer: "" }; paint(); $("#ef-q")?.focus(); };
  $$("[data-echoedit]").forEach((b) => b.onclick = () => { ECHOTEACH = null; ECHOEDIT = { ...d.faq.find((f) => f.id === +b.dataset.echoedit) }; paint(); });
  const q = $("#echoq"); if (q) q.oninput = () => { ECHOQ = q.value; paint(); const q2 = $("#echoq"); if (q2) { q2.focus(); q2.setSelectionRange(q2.value.length, q2.value.length); } };
  const read = () => ({ question: $("#ef-q").value.trim(), answer: $("#ef-a").value.trim(), keywords: $("#ef-k").value.trim(), topic: $("#ef-t").value, action: $("#ef-x").value });
  const go = $("#ef-go"); if (go) go.onclick = async () => {
    const f = read(); if (!f.question || !f.answer) return toast("A question and an answer, please");
    const id = ECHOEDIT && ECHOEDIT.id;
    const r = await act(() => req(id ? "/api/admin/echo/faq/" + id : "/api/admin/echo/faq", { method: id ? "PATCH" : "POST", body: f }), id ? "Saved — Echo answers with it now" : "Taught — Echo answers with it now");
    if (r) { ECHOTEACH = null; ECHOEDIT = null; load(); }
  };
  const x = $("#ef-x2"); if (x) x.onclick = () => { ECHOTEACH = null; ECHOEDIT = null; paint(); };
  const fg = $("#ef-forget"); if (fg) fg.onclick = async () => { await act(() => req("/api/admin/echo/faq/" + ECHOEDIT.id, { method: "PATCH", body: { forget: true } }), "Forgotten"); ECHOEDIT = null; load(); };
  const del = $("#ef-del"); if (del) del.onclick = async () => {
    const f = ECHOEDIT;
    if (f.source === "built-in") { await act(() => req("/api/admin/echo/faq/" + f.id, { method: "PATCH", body: { enabled: !f.enabled } }), f.enabled ? "Switched off — Echo won't use it" : "Switched on"); ECHOEDIT = null; return load(); }
    if (!(await confirmIt("Delete this answer?", "Echo forgets it and what it learned about it.", { ok: "Delete", danger: true }))) return;
    await act(() => req("/api/admin/echo/faq/" + f.id, { method: "DELETE" }), "Deleted"); ECHOEDIT = null; load();
  };
  $$("[data-echodone]").forEach((b) => b.onclick = async () => { await act(() => req("/api/admin/echo/handoffs/" + b.dataset.echodone + "/done", { method: "POST" }), "Marked done"); load(); });
};
