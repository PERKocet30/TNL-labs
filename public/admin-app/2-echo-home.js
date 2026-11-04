/* LABS admin — Echo Home v1.4, 2026-11-04 ("make Echo interactive, like speaking with a virtual AI": the Talk button opens 2-echo-voice.js; the live stream feeds it so Echo speaks while it writes). v1.3, 2026-11-04 ("I don't like having to scroll all the way down — it should be a module I can scroll in, with a button to the bottom, like Claude"): on a phone the conversation is its own scroll box sized to the screen, the composer pinned under it, a ↓ to the latest when you've scrolled up; Needs you sits right below. v1.2 — 2026-11-04 ("my message keeps getting deleted": a send that fails no longer throws the question away — the page asks the server whether it arrived and shows the answer when it does, or says it didn't with the words back in the box; coming back to the page re-reads the conversation — 2-echo-home2.js). v1.1 — 2026-11-04 (everything Messages has: photos and PDFs, the mic, the speaker, the model picker, copy — 2-echo-home2.js). v1.0, 2026-11-04. "A simplified admin dashboard integrated
   with Echo so it can help me manage everything." The admin opens here: Echo on the
   left — the same brain, memory and hands as Messages → Echo (server/echo), answers
   streamed over the app's live stream — and, on a computer, what needs you and
   today's four numbers on the right. On opening, once a day, Echo gives the brief
   (what moved, what needs you, what it would do first); "Brief me" asks any time.
   The twelve sections stay one tap away. Without ECHO_AI_KEY the page says so and
   still shows the queue. */
let EH = { data: null, draft: "", busy: false, es: null, briefAsked: false, stick: true };
const ehOn = () => !!(EH.data && EH.data.brain);
LOADERS.echohome = async () => {
  const [echo] = await Promise.all([req("/api/echo").catch((e) => ({ error: e.message })), LOADERS.home()]);
  EH.data = echo; EH.stick = true;
  if (ehOn() && !echo.briefToday && !EH.briefAsked) { EH.briefAsked = true; setTimeout(() => ehBrief(), 300); }
  ehStream();
};
VIEWS.echohome = () => {
  const p = D.pulse, d = D.dir, S = D.series, E = EH.data;
  const today = new Date().toLocaleDateString([], { weekday: "long", month: "short", day: "numeric" });
  const needs = p && d ? [...p.inbox, ...d.needs] : [];
  const side = !p || !S ? `<div class="empty">Loading…</div>` : `
    ${card("Needs you", `<div class="body"><div class="q">${needs.length ? needs.map(queueHTML).join("") : `<div class="clear">${I.check} Nothing waiting.</div>`}</div></div>`, needs.length ? String(needs.length) : "")}
    <div class="grid g2" style="margin-top:12px">
      ${kpiHTML("Active members", num(p.now.active), { now: p.now.active, before: p.before.active, series: S.series.active })}
      ${kpiHTML("New members", num(p.now.signups), { now: p.now.signups, before: p.before.signups, series: S.series.signups })}
      ${kpiHTML("Work posted", num(p.now.work), { now: p.now.work, before: p.before.work, series: S.series.work })}
      ${kpiHTML("Sales", money(p.now.gmv), { now: p.now.gmv, before: p.before.gmv, fmt: money, series: S.series.gmv })}
    </div>
    <div class="row" style="margin-top:12px;justify-content:flex-end"><button class="btn ghost sm" data-go="home">The full Home ${I.chev}</button></div>`;
  const head = pageHead("Echo", `${today} · LABS's own`, ehOn() ? `${"speechSynthesis" in window ? `<button class="btn ghost sm ${ehVoiceOn() ? "on" : ""}" id="ehvoice" aria-pressed="${ehVoiceOn()}">${ehVoiceOn() ? "Reading aloud" : "Read aloud"}</button>` : ""}<button class="btn ghost sm" id="ehbrief" ${EH.busy ? "disabled" : ""}>Brief me</button><button class="btn ghost sm" id="ehfresh" ${EH.busy ? "disabled" : ""}>New conversation</button>` : "");
  return `${head}<div class="eh"><section class="rc eh-chat"><div class="eh-fw"><div class="eh-feed" id="ehfeed">${ehFeedHTML()}</div><button class="eh-down" id="ehdown" aria-label="To the latest">${di('<path d="M12 5v14M6 13l6 6 6-6"/>', 18)}</button></div>${ehOn() ? `<div class="eh-foot" id="ehfoot">${ehComposerHTML()}</div>` : ""}</section><aside class="eh-side">${side}</aside></div>`;
};
function ehFeedHTML() {
  const E = EH.data;
  if (!E) return `<div class="empty">Loading…</div>`;
  if (E.error) return `<div class="empty">${esc(E.error)}</div>`;
  if (!E.brain) return `<div class="eh-off"><b>Echo isn't awake here yet.</b><p>Add <code>ECHO_AI_KEY</code> in Railway → Variables (a Claude API key from console.anthropic.com) and Echo becomes LABS's own intelligence: it reads the numbers, remembers every decision, and sets up actions for you to confirm. Members' Echo (the help desk) is under <a data-go="echo">Help desk</a>.</p></div>`;
  let h = `<div class="eh-hello"><div class="eh-mark">${NAVI.echo}</div><div>${esc(E.hello)}</div></div>`;
  if (!E.turns.length && E.starters && E.starters.length) h += `<div class="eh-chips">${E.starters.map((s) => `<button class="pill sm" data-ehask="${esc(s.question)}">${esc(s.question)}</button>`).join("")}</div>`;
  for (const t of E.turns) h += ehTurnHTML(t);
  return h;
}
function ehTurnHTML(t) {
  const q = t.label === "brief" ? `<div class="eh-q brief"><span class="mono">Brief</span></div>` : `<div class="eh-q"><div class="eh-qb">${ehFilesHTML(t.files)}${esc(t.asked)}</div></div>`;
  const saw = (t.tools || []).filter((x) => !/^knowledge_(add|edit)$|^web_search$/.test(x)), wrote = (t.tools || []).some((x) => /^knowledge_(add|edit)$/.test(x)), web = (t.tools || []).includes("web_search");
  const bits = [saw.length ? "Looked at " + saw.map((x) => esc(x.replace(/_/g, " "))).join(", ") : "", web ? "Searched the web" : "", wrote ? "Wrote to Knowledge" : "", t.model ? esc(t.model) : ""].filter(Boolean);
  const foot = t.pending ? `<div class="eh-work"><i></i><span>${esc(t.status || "Thinking")}</span></div>` : `<div class="eh-ft"><span>${bits.join(" · ")}</span>${t.text && !t.failed ? `<button class="eh-copy" data-ehcopy="${t.id}" aria-label="Copy">${di('<rect x="8" y="8" width="12" height="12"/><path d="M16 8V4H4v12h4"/>', 15)}</button>` : ""}</div>`;
  const cards = (t.proposals || []).map(ehCardHTML).join("");
  return `${q}<div class="eh-a ${t.failed ? "failed" : ""} ${t.pending ? "pending" : ""}" data-ehturn="${t.id}"><div class="eh-mark sm">${NAVI.echo}</div><div class="eh-ab"><div class="eh-text">${ehMd(t.text || "")}</div><div class="eh-cards">${cards}</div>${foot}</div></div>`;
}
function ehCardHTML(p) {
  const st = p.status;
  const tail = st === "pending" ? `<div class="row" style="gap:8px;margin-top:6px"><button class="btn sm" data-ehok="${p.id}">Confirm</button><button class="btn ghost sm" data-ehno="${p.id}">Not now</button></div>`
    : `<div class="eh-cs">${st === "confirmed" ? "Done" : st === "declined" ? "Not now" : "Didn’t work"}${p.result ? ` · ${esc(p.result)}` : ""}</div>`;
  return `<div class="eh-card ${st}" data-ehcard="${p.id}"><b>${esc(p.title)}</b>${p.why ? `<span>${esc(p.why)}</span>` : ""}${tail}</div>`;
}
/* light markdown, escaped first — the same shape the app renders */
function ehMd(t) {
  const lines = String(t || "").replace(/\r/g, "").split("\n"); let h = "", list = null, para = [];
  const inline = (x) => esc(x).replace(/\*\*([^*]+)\*\*/g, "<b>$1</b>").replace(/`([^`]+)`/g, "<code>$1</code>").replace(/@([a-z0-9._]{2,20})/gi, (m, u) => `<a data-person="${esc(u.toLowerCase())}">@${esc(u)}</a>`);
  const flushP = () => { if (para.length) { h += `<p>${inline(para.join(" "))}</p>`; para = []; } }, flushL = () => { if (list) { h += `</${list}>`; list = null; } };
  for (const raw of lines) { const l = raw.trimEnd(); const b = /^\s*[-*•]\s+(.*)$/.exec(l), n = /^\s*\d+[.)]\s+(.*)$/.exec(l), hd = /^#{1,4}\s+(.*)$/.exec(l);
    if (b || n) { flushP(); const want = b ? "ul" : "ol"; if (list !== want) { flushL(); list = want; h += `<${want}>`; } h += `<li>${inline((b || n)[1])}</li>`; continue; }
    flushL(); if (!l.trim()) { flushP(); continue; } if (hd) { flushP(); h += `<p><b>${inline(hd[1])}</b></p>`; continue; } para.push(l.trim()); }
  flushP(); flushL(); return h;
}
function ehComposerHTML() {
  const E = EH.data, att = EH.att || [];
  const ready = (EH.draft.trim() || att.some((a) => a.url)) && !att.some((a) => !a.url) && !EH.busy;
  const models = (E && E.models || []).map((m) => `<option value="${esc(m.id)}" ${m.id === E.model ? "selected" : ""}>${esc(m.name)}</option>`).join("");
  return `<div class="eh-box ${EH.busy ? "busy" : ""}">${ehAttHTML()}<textarea id="ehdraft" rows="1" placeholder="${EH.listening ? "Listening…" : "Talk to Echo"}">${esc(EH.draft)}</textarea>
    <div class="eh-boxr"><span class="eh-tools"><input type="file" id="ehfile" accept="image/*,application/pdf" multiple hidden><button class="eh-ib" id="ehphoto" aria-label="Add a photo or PDF">${NAVI.listings}</button>${ehCanDictate() ? `<button class="eh-ib ${EH.listening ? "live" : ""}" id="ehmic" aria-label="${EH.listening ? "Stop listening" : "Speak"}">${di('<rect x="9" y="3" width="6" height="11"/><path d="M5 11a7 7 0 0 0 14 0M12 18v3"/>', 18)}</button>` : ""}<select class="eh-model" id="ehmodel" aria-label="Which Claude answers">${models}</select></span>${typeof evCan === "function" && evCan() ? `<button class="eh-talk" id="ehtalk" aria-label="Talk with Echo">${di('<path d="M4 10v4M8 7v10M12 4v16M16 7v10M20 10v4"/>', 16)}Talk</button>` : ""}<button class="eh-send" id="ehsend" aria-label="Send" ${ready ? "" : "disabled"}>${I.chev}</button></div></div>`;
}
function ehPaintFeed() { const f = $("#ehfeed"); if (!f) return; f.innerHTML = ehFeedHTML(); ehWireFeed(f); f.scrollTop = f.scrollHeight; ehDownShow(); }
/* the ↓ to the latest, as in Claude: shown once you've scrolled up past a screen's worth of the conversation */
function ehDownShow() { const f = $("#ehfeed"), b = $("#ehdown"); if (!f || !b) return; b.classList.toggle("on", f.scrollHeight - f.scrollTop - f.clientHeight > 240); }
function ehWireScroll() { const f = $("#ehfeed"), b = $("#ehdown"); if (!f || !b) return; f.onscroll = ehDownShow; b.onclick = () => f.scrollTo({ top: f.scrollHeight, behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth" }); ehDownShow(); }
function ehPaintFoot() { const f = $("#ehfoot"); if (!f) return; const d = $("#ehdraft"), had = d && document.activeElement === d; f.innerHTML = ehComposerHTML(); ehWireFoot(f); if (had) { const d2 = $("#ehdraft"); if (d2) { d2.focus(); d2.setSelectionRange(d2.value.length, d2.value.length); } } }
async function ehAsk(q, brief = false) {
  q = (q || "").trim(); const att = (EH.att || []).filter((a) => a.url);
  if (EH.busy || !ehOn() || (!q && !brief && !att.length)) return;
  if ((EH.att || []).some((a) => !a.url)) return toast("Still uploading…");
  if (EH.rec) { try { EH.rec.stop(); } catch (e) {} }
  const known = new Set(EH.data.turns.map((t) => String(t.id))), keepAtt = (EH.att || []).slice(), seq = (EH.seq = (EH.seq || 0) + 1);
  EH.draft = ""; EH.att = []; EH.busy = true;
  EH.data.turns.push({ id: "p" + Date.now(), asked: q, files: att.map((a) => ({ url: a.url, kind: a.kind, name: a.name })), label: brief ? "brief" : "", kind: "brain", pending: true, status: "Thinking", text: "", tools: [], proposals: [] });
  ehPaintFeed(); ehPaintFoot(); $$("#ehbrief,#ehfresh").forEach((b) => b.disabled = true);
  const drop = () => { const i = EH.data.turns.findIndex((x) => x.pending); if (i >= 0) EH.data.turns.splice(i, 1); };
  try { const r = brief ? await req("/api/echo/brief", { method: "POST", body: {} }) : await req("/api/echo/ask", { method: "POST", body: { q, files: att.map((a) => ({ url: a.url, name: a.name })) } });
    if (!r || !r.turn) throw new Error((r && r.error) || "No answer came back");
    if (seq !== EH.seq) return;   // a recovery already showed this one
    drop(); EH.data.turns.push(r.turn); if (brief) EH.data.briefToday = true; if (r.turn.text && !r.turn.failed) ehSay(r.turn.text); }
  catch (e) { if (seq !== EH.seq) return; ehReport(e, brief); await ehRecover({ q, brief, att: keepAtt, known, seq, err: e }); }
  if (seq !== EH.seq) return;
  EH.busy = false; ehPaintFeed(); ehPaintFoot(); $$("#ehbrief,#ehfresh").forEach((b) => b.disabled = false);
}
const ehBrief = () => ehAsk("", true);
async function ehDecide(id, yes) {
  const card = $(`[data-ehcard="${id}"]`); if (card) card.style.opacity = ".5";
  try { const r = await req(`/api/echo/proposals/${id}/${yes ? "confirm" : "decline"}`, { method: "POST", body: {} }); ehCardUpdate(r.proposal); if (yes) toast(r.ok ? "Done" : "Didn’t work"); D.pulse = null; }
  catch (e) { if (card) card.style.opacity = ""; toast(e.message); }
}
function ehCardUpdate(p) {
  if (!p || !EH.data) return;
  for (const t of EH.data.turns) { const i = (t.proposals || []).findIndex((x) => x.id === p.id); if (i >= 0) { t.proposals[i] = p; break; } }
  const card = $(`[data-ehcard="${p.id}"]`); if (card) { card.outerHTML = ehCardHTML(p); const f = $("#ehfeed"); if (f) ehWireFeed(f); }
}
/* the live stream: Echo's answer as it's written, what it's looking at, a card decided elsewhere */
async function ehStream() {
  if (EH.es || !ehOn()) return;
  let ticket; try { ticket = (await req("/api/stream/ticket", { method: "POST", body: {} })).ticket; } catch (e) { return; }
  const es = new EventSource(API + "/api/stream?ticket=" + encodeURIComponent(ticket)); EH.es = es;
  es.addEventListener("echo", (e) => { let d; try { d = JSON.parse(e.data); } catch (x) { return; } ehLive(d); });
  es.onerror = () => { es.close(); EH.es = null; if (TAB === "echohome") setTimeout(ehStream, 5000); };
}
function ehLive(d) {
  if (!EH.data || !EH.data.turns) return;
  if (d.kind === "proposal") return ehCardUpdate(d.proposal);
  const t = EH.data.turns.find((x) => x.pending); if (!t) return;
  const w = $(`[data-ehturn="${t.id}"] .eh-work span`);
  if (d.kind === "text") { t.text = (t.text || "") + d.text; t.status = "Writing"; const n = $(`[data-ehturn="${t.id}"] .eh-text`); if (n) n.innerHTML = ehMd(t.text); if (w) w.textContent = "Writing"; if (typeof evText === "function") evText(t.text, false); }
  else if (d.kind === "status") { t.status = d.text; if (w) w.textContent = d.text; }
  const f = $("#ehfeed"); if (f && f.scrollHeight - f.scrollTop - f.clientHeight < 200) f.scrollTop = f.scrollHeight; ehDownShow();
}
function ehWireFeed(f) {
  $$("[data-ehask]", f).forEach((b) => b.onclick = () => ehAsk(b.dataset.ehask));
  $$("[data-ehok]", f).forEach((b) => b.onclick = () => ehDecide(+b.dataset.ehok, true));
  $$("[data-ehno]", f).forEach((b) => b.onclick = () => ehDecide(+b.dataset.ehno, false));
  $$("[data-person]", f).forEach((el) => el.onclick = () => openPerson(el.dataset.person));
  $$("[data-go]", f).forEach((el) => el.onclick = () => go(el.dataset.go));
  $$("[data-ehcopy]", f).forEach((b) => b.onclick = () => ehCopy(b.dataset.ehcopy));
}
function ehWireFoot(F) {
  const d = $("#ehdraft", F);
  if (d) { const fit = () => { d.style.height = "auto"; d.style.height = Math.min(160, d.scrollHeight) + "px"; }; fit();
    d.oninput = () => { EH.draft = d.value; fit(); const s = $("#ehsend"); if (s) s.disabled = (!d.value.trim() && !(EH.att || []).some((a) => a.url)) || EH.busy; };
    d.onkeydown = (e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); ehAsk(d.value); } }; }
  const s = $("#ehsend", F); if (s) s.onclick = () => ehAsk(EH.draft);
  const fi = $("#ehfile", F), ph = $("#ehphoto", F); if (ph && fi) { ph.onclick = () => fi.click(); fi.onchange = () => { const files = [...(fi.files || [])]; fi.value = ""; if (files.length) ehAttach(files); }; }   // copy the list first: clearing the input empties it
  const mic = $("#ehmic", F); if (mic) mic.onclick = () => ehDictate();
  const talk = $("#ehtalk", F); if (talk) talk.onclick = () => evOpen();
  const sel = $("#ehmodel", F); if (sel) sel.onchange = () => ehPickModel(sel.value);
  $$("[data-ehattx]", F).forEach((b) => b.onclick = () => { EH.att.splice(+b.dataset.ehattx, 1); ehPaintFoot(); });
}
WIRES.echohome = () => {
  const f = $("#ehfeed"); if (f) { ehWireFeed(f); if (EH.stick) { f.scrollTop = f.scrollHeight; EH.stick = false; } }
  ehWireScroll();
  const F = $("#ehfoot"); if (F) ehWireFoot(F);
  const b = $("#ehbrief"); if (b) b.onclick = () => ehBrief();
  const v = $("#ehvoice"); if (v) v.onclick = () => ehVoiceToggle();
  const n = $("#ehfresh"); if (n) n.onclick = async () => { if (!(await modal({ title: "New conversation?", body: "This one is put away, with any cards still waiting. Echo keeps everything it wrote in Knowledge.", ok: "New conversation" }))) return;
    try { speechSynthesis.cancel(); } catch (e) {} EH.att = [];
    try { await req("/api/echo/reset", { method: "POST", body: {} }); EH.data.turns = []; ehPaintFeed(); ehPaintFoot(); } catch (e) { toast(e.message); } };
};
