/* LABS admin — Events v1.9, 2026-10-27 (v1.9: the showcase pictures, every piece in one; v1.8: entries go into a lab, named as the app names it; v1.7: a cover picture for shared links, or TNL's card; v1.6: the shared page header, events listed in a card; v1.5: the scoreboard picture buttons wait for voting instead of opening a dead page; v1.4: "Link to send people" up top —
   tnllabs.com/tournament for the one on now, with Copy).
   Events v1.3, 2026-10-12 (the Tournament tab; v1.2: named for it;
   v1.3: the "entries are open" email to every member — its switch, a
   preview to yourself, and how far the sending has got).
   Events v1.1, 2026-10-07. Set up and run events (the
   tournament): dates, format, judges, the live tallies members never see,
   disqualifying, and "End this phase now". The server enforces all of it.
   v1.1: the Poll format (votes a day + a live scoreboard), and the
   Instagram kit — scoreboard pictures to post, each entry's vote link. */
let EVID = null, EVFORM = null;
LOADERS.events = async () => {
  D.events = await req("/api/admin/events");
  if (EVID) D.event = await req("/api/admin/events/" + EVID);
  if (EVID) D.evcheck = await req("/api/admin/events/" + EVID + "/vote-check").catch(() => null);   // 3-person-signals.js
  if (EVID && typeof LOADERS.spam === "function") await LOADERS.spam();   // 8-events2-spam.js
};
const EVPH = { upcoming: "Not open yet", submit: "Entries open", qualify: "Voting", round: "Round", final: "Final", results: "Results" };
const phName = (p) => (p.phase === "round" ? "Round " + p.round : EVPH[p.phase] || p.phase);
const when = (t) => (t ? new Date(t).toLocaleString([], { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }) : "—");
const toLocal = (t) => { const d = new Date(t || Date.now()); d.setMinutes(d.getMinutes() - d.getTimezoneOffset()); return d.toISOString().slice(0, 16); };

VIEWS.events = () => {
  if (EVFORM) return evFormHTML();
  if (EVID) return D.event ? evDetailHTML(D.event) : `<div class="empty">Loading…</div>`;
  const L = D.events?.events;
  if (!L) return `<div class="empty">Loading…</div>`;
  return `${pageHead("Events", `Your tournament lives here. Members see it on the Showroom and at tnllabs.com/e/your-link. Votes only count in the app — Instagram is for reach: each event's Instagram kit has the scoreboard to post and every entry's vote link.`, `<button class="btn fill" id="evnew">New event</button>`)}
    <h2 class="sec">Events <span class="mono">${L.length} in all</span></h2>
    <div class="list">${L.length ? L.map((e) => `<button class="li" data-ev="${e.id}"><div class="b"><b>${esc(e.title)}${e.published ? "" : `<span class="tag">draft</span>`}</b>
      <span>/e/${esc(e.slug)} · ${e.format} · ${e.entries} entr${e.entries === 1 ? "y" : "ies"}</span></div><div class="r">${phName(e.phase)}</div>${I.chev}</button>`).join("")
      : `<div class="empty">No events yet.</div>`}</div>`;
};

function evFormHTML() {
  const f = EVFORM, p = f.plan || {};
  const field = (k, label, v, attrs = "") => `<label class="fld"><span>${label}</span><input class="in" data-f="${k}" value="${esc(v ?? "")}" ${attrs}></label>`;
  const sel = (k, label, v, opts) => `<label class="fld"><span>${label}</span><select class="sel" data-f="${k}">${opts.map(([val, t]) => `<option value="${val}" ${String(v) === String(val) ? "selected" : ""}>${t}</option>`).join("")}</select></label>`;
  const locked = f.locked;
  return `${pageHead(f.id ? "Edit event" : "New event", "Title, format, dates and rules. Nothing goes live until you publish it.", `<button class="btn ghost sm" id="evcancel">Cancel</button>`)}
  <h2 class="sec">Basics</h2>
  <div class="panel evf">
    ${field("title", "Title", f.title, 'placeholder="LABS Poster Tournament"')}
    ${f.id ? "" : field("slug", "Link name", f.slug, 'placeholder="poster-tournament" autocapitalize="none"')}
    <label class="fld"><span>The brief</span><textarea class="in" data-f="brief" rows="4" placeholder="What should people make?">${esc(f.brief || "")}</textarea></label>
    ${field("prize", "Prize", f.prize, 'placeholder="e.g. $500 cash — leave empty until decided"')}
    <div class="fld"><span>Cover picture: what a shared link shows in DMs and texts (a square works best). Leave it empty and LABS draws one with the name, prize and dates.</span>
      <input type="hidden" data-f="coverUrl" id="evcovurl" value="${esc(f.coverUrl || "")}">
      <div class="row wrapx" style="gap:12px;align-items:center"><img id="evcovimg" alt="" style="width:160px;aspect-ratio:1/1;object-fit:cover;background:var(--el);border:1px solid var(--line)" src="${esc(f.coverUrl || (f.id && f.published ? `/e/${f.slug}/card.jpg` : ""))}" ${f.coverUrl || (f.id && f.published) ? "" : "hidden"}>
        <div class="row wrapx" style="gap:6px"><label class="btn ghost sm">${f.coverUrl ? "Change picture" : "Choose a picture"}<input type="file" id="evcov" accept="image/*" hidden></label>
          <button class="btn ghost sm" id="evcovx" ${f.coverUrl ? "" : "hidden"}>Use the LABS card</button></div></div></div>
    ${sel("channel", "Entries go into", f.channel || "graphic-design", [["graphic-design", "// Visual"], ["photography", "// Visual · tagged #photography"], ["clothing-design", "// Fashion"], ["general", "// General"]])}
  </div>
  <h2 class="sec">Format ${locked ? `<span class="mono">locked — voting has closed</span>` : ""}</h2>
  <div class="panel evf">
    ${sel("format", "Format", f.format || "poll", [["poll", "Poll — votes every day, live scoreboard, top finalists to a final"], ["bracket", "Bracket — vote, head-to-head rounds, judged final"], ["simple", "Simple — open vote, judged final"]])}
    <div class="grid g2">
      ${sel("bracketSize", "Bracket (largest)", f.bracketSize || 16, [[4, "4"], [8, "8"], [16, "16"], [32, "32"]])}
      ${field("finalists", "Finalists (poll, simple)", f.finalists ?? 8, 'type="number" min="2" max="20"')}
      ${field("picks", "Votes per member (poll: per day)", f.picks ?? 1, 'type="number" min="1" max="10"')}
      ${field("judgeWeight", "Judges' share of the final, % (0 = votes only)", f.judgeWeight ?? 50, 'type="number" min="0" max="100"')}
      ${field("minAccountDays", "Accounts must be this many days old to vote", f.minAccountDays ?? 0, 'type="number" min="0" max="60"')}
      ${field("freezeHours", "Poll: freeze the scoreboard for the last … hours", f.freezeHours ?? 24, 'type="number" min="0" max="72"')}
    </div>
    <label class="row" style="margin-top:12px;font-size:14px"><input type="checkbox" data-f="requireVerified" ${f.requireVerified !== false ? "checked" : ""}> Voters need a confirmed email (recommended — it stops throwaway accounts)</label>
    <label class="row" style="margin-top:8px;font-size:14px"><input type="checkbox" data-f="requireAvatar" ${f.requireAvatar !== false ? "checked" : ""}> Voters need a profile photo (a face or a mark behind every vote)</label>
    <div>
    </div>
  </div>
  <h2 class="sec">Dates</h2>
  <div class="panel evf"><div class="grid g2">
    ${field("opensAt", "Entries open", toLocal(p.opensAt), 'type="datetime-local"')}
    ${field("submitDays", "Entry period, days", p.submitDays ?? 14, 'type="number" step="0.5" min="0.5"')}
    ${field("voteDays", "Vote, days", p.voteDays ?? 3, 'type="number" step="0.5" min="0.5"')}
    ${field("roundDays", "Each bracket round, days", p.roundDays ?? 2, 'type="number" step="0.5" min="0.5"')}
    ${field("finalDays", "Final, days", p.finalDays ?? 3, 'type="number" step="0.5" min="0.5"')}
  </div>
    <label class="row" style="margin-top:12px;font-size:14px"><input type="checkbox" data-f="mailOnOpen" ${p.mailOnOpen !== false ? "checked" : ""}> Email every member when entries open</label></div>
  <h2 class="sec">Rules</h2>
  <div class="panel evf"><label class="fld"><span>Leave empty to use the draft rules, which fill in your dates, format and prize. Have a lawyer read what goes live.</span>
    <textarea class="in" data-f="rules" rows="6">${esc(f.rules || "")}</textarea></label>
    <label class="row" style="margin-top:12px;font-size:14px"><input type="checkbox" data-f="published" ${f.published ? "checked" : ""}> Published — members can see it</label>
  </div>
  <div class="row" style="margin:16px 0 40px"><button class="btn fill" id="evsave">${f.id ? "Save" : "Create event"}</button></div>`;
}

function evDetailHTML(d) {
  const e = d.event, S = e.schedule, st = e.state, E = d.entries;
  const byId = new Map(E.map((x) => [x.id, x]));
  const name = (id) => { const x = byId.get(id); return x ? "@" + esc(x.author.username) : "—"; };
  const stage = e.phase.phase === "qualify" ? "qualify" : e.phase.phase === "round" ? "r" + e.phase.round : e.phase.phase === "final" ? "final" : null;
  const vcell = (x, s) => { const v = x.votes[s] || { votes: 0, fresh: 0 }; return `${v.votes}${v.fresh ? ` <span class="tag warn" title="votes from accounts under 14 days old">${v.fresh} new</span>` : ""}`; };
  const ranking = st.results?.ranking || [];
  return `<div class="row sp wrapx"><button class="btn ghost sm" id="evback">${I.chev} All events</button>
    <div class="row" style="gap:6px"><a class="btn ghost sm" href="/e/${esc(e.slug)}" target="_blank">Page</a><a class="btn ghost sm" href="/e/${esc(e.slug)}/rules" target="_blank">Rules</a><button class="btn ghost sm" id="evedit">Edit</button></div></div>
  <div class="pg-hd" style="margin-top:16px"><div><h1>${esc(e.title)} ${e.published ? `<span class="tag on">live</span>` : `<span class="tag">draft</span>`}</h1></div></div>
  <p class="dim" style="font-size:13px;margin-top:4px">${e.format === "bracket" ? `Bracket of up to ${e.bracketSize}` : e.format === "poll" ? `Poll · ${e.picks} vote${e.picks === 1 ? "" : "s"} a day · board freezes ${e.freezeHours}h before each close · top ${e.finalists} to the final` : `Simple · top ${e.finalists} to the final`}${e.format === "poll" ? "" : ` · ${e.picks} picks`} · final ${e.judgeWeight ? e.judgeWeight + "% judges" : "votes only"}${e.requireVerified ? " · confirmed emails" : ""}${e.minAccountDays ? ` · voters ${e.minAccountDays}+ days old` : ""} · ${d.voters} people have voted${e.prize ? " · " + esc(e.prize) : ""}</p>
  ${evLinkHTML(e)}
  ${evCheckHTML()}${typeof spamHTML === "function" ? spamHTML() : ""}
  ${e.format === "poll" ? `<h2 class="sec">Instagram <span class="mono">every link leads back to the app — only votes there count</span></h2>
  <div class="panel"><div class="row wrapx" style="gap:6px">
    <a class="btn ghost sm" href="/e/${esc(e.slug)}/board" target="_blank">Scoreboard page</a>
    ${stage ? `<a class="btn ghost sm" href="/e/${esc(e.slug)}/board.jpg?t=${Date.now()}" target="_blank">Scoreboard post (1080×1350)</a>
    <a class="btn ghost sm" href="/e/${esc(e.slug)}/board.jpg?size=story&t=${Date.now()}" target="_blank">Scoreboard Story (1080×1920)</a>`
    : `<button class="btn ghost sm" disabled title="The scoreboard pictures are made from votes">Scoreboard pictures — ready when voting opens</button>`}
    <a class="btn ghost sm" href="/e/${esc(e.slug)}/showcase.png?t=${Date.now()}" target="_blank">Showcase post (1080×1350)</a>
    <a class="btn ghost sm" href="/e/${esc(e.slug)}/showcase.png?size=story&t=${Date.now()}" target="_blank">Showcase Story (1080×1920)</a>
    <button class="btn ghost sm" data-evcopy="${esc(location.origin + "/e/" + e.slug)}">Copy event link</button></div>
    <p class="dim" style="font-size:12px;margin-top:10px">Post the scoreboard daily with a link sticker to the event. Entrants get their own Story card and vote link in the app (Share to Instagram); theirs are below too.</p></div>` : ""}
  ${evMailHTML(d.mail, e)}
  ${st.void ? `<div class="panel" style="margin-top:12px">Called off: fewer than two entries when entries closed.</div>` : ""}

  <h2 class="sec">Now: ${phName(e.phase)} <span class="mono">${e.phase.end ? "until " + when(e.phase.end) : ""}</span></h2>
  <div class="panel"><div class="list">${S.map((p) => `<div class="li"><div class="b"><b>${phName(p)}</b><span>${when(p.start)} → ${p.end ? when(p.end) : "—"}</span></div>
    <div class="r">${p === S.find((x) => x.start === e.phase.start && x.phase === e.phase.phase) ? `<span class="tag on">now</span>` : ""}</div></div>`).join("")}</div>
    ${e.phase.phase !== "results" ? `<button class="btn ghost sm" id="evadv" style="margin-top:12px">End this phase now</button>` : ""}</div>

  <h2 class="sec">Judges <span class="mono">they score the final, 1–10</span></h2>
  <div class="panel"><div class="row wrapx" style="gap:6px">${d.judges.map((j) => `<span class="pill">@${esc(j.username)} <button data-unjudge="${esc(j.username)}" aria-label="Remove">${I.x}</button></span>`).join("") || `<span class="dim">None yet.</span>`}
    <button class="btn ghost sm" id="evjudge">Add a judge</button></div></div>

  ${ranking.length ? `<h2 class="sec">Results</h2><div class="panel"><table class="tbl"><tr><th>#</th><th>Piece</th><th class="num">Judges avg</th><th class="num">Votes</th><th class="num">Score</th></tr>
    ${ranking.map((r, i) => `<tr><td>${i + 1}</td><td>${name(r.entryId)}</td><td class="num">${r.judgeAvg}</td><td class="num">${r.votes}</td><td class="num">${(r.score * 100).toFixed(1)}</td></tr>`).join("")}</table></div>` : ""}

  ${d.matchups.length ? `<h2 class="sec">Bracket</h2><div class="panel">${[...new Set(d.matchups.map((m) => m.round))].map((r) => `<b style="font-size:13px">Round ${r}</b>
    <table class="tbl" style="margin:6px 0 12px">${d.matchups.filter((m) => m.round === r).map((m) => `<tr><td>${name(m.a)} <span class="dim">${byId.get(m.a)?.votes["r" + r]?.votes ?? 0}</span></td><td class="dim">vs</td>
      <td>${name(m.b)} <span class="dim">${byId.get(m.b)?.votes["r" + r]?.votes ?? 0}</span></td><td>${m.winner ? `<span class="tag on">${name(m.winner)}</span>` : ""}</td></tr>`).join("")}</table>`).join("")}</div>` : ""}

  <h2 class="sec">Entries <span class="mono">${E.filter((x) => !x.dqReason).length} in · counts are admin-only</span></h2>
  <div class="panel" style="overflow-x:auto"><table class="tbl"><tr><th>Piece</th><th>By</th><th class="num">Seed</th><th class="num">Vote</th>${stage && stage !== "qualify" ? `<th class="num">Now</th>` : ""}<th>Judges</th><th></th></tr>
    ${E.map((x) => `<tr style="${x.dqReason ? "opacity:.5" : ""}"><td><a href="${esc(x.imageUrl)}" target="_blank"><img src="${esc(x.thumbUrl)}" alt="" style="width:44px;height:44px;object-fit:cover;display:block"></a></td>
      <td>@${esc(x.author.username)}${x.dqReason ? `<div class="dim" style="font-size:11px">DQ: ${esc(x.dqReason)}</div>` : ""}</td>
      <td class="num">${x.seed ?? "—"}</td><td class="num">${vcell(x, "qualify")}</td>${stage && stage !== "qualify" ? `<td class="num">${vcell(x, stage)}</td>` : ""}
      <td>${x.scores.map((s) => `${esc(s.judge)}: ${s.score}`).join(", ") || "—"}${x.dqReason ? "" : `<div style="white-space:nowrap;margin-top:4px"><button class="btn ghost sm" data-evcopy="${esc(location.origin + "/e/" + e.slug + "/" + x.id)}">Vote link</button> <a class="btn ghost sm" href="/e/${esc(e.slug)}/${x.id}/story.jpg?t=${Date.now()}" target="_blank">Story</a></div>`}</td>
      <td>${x.dqReason ? `<button class="btn ghost sm" data-undq="${x.id}">Reinstate</button>` : `<button class="btn danger sm" data-dq="${x.id}">Disqualify</button>`}</td></tr>`).join("") || `<tr><td colspan="7" class="dim">No entries yet.</td></tr>`}</table></div>
  <div style="height:40px"></div>`;
}

/* The link to send people: the tournament page, where Enter / Vote opens the app. */
function evLinkHTML(e) {
  const full = location.origin + (e.current ? "/tournament" : "/e/" + e.slug), show = full.replace(/^https?:\/\//, "");
  return `<h2 class="sec">Link to send people <span class="mono">bio · DMs · stories</span></h2>
  <div class="panel"><div class="row wrapx" style="gap:10px;align-items:center"><b style="font-size:16px;word-break:break-all">${esc(show)}</b>
    <button class="btn fill sm" data-evcopy="${esc(full)}">Copy link</button></div>
    <p class="dim" style="font-size:12px;margin-top:8px">${!e.published ? "It's a draft: publish it first, or the link says it doesn't exist."
      : e.current ? `It always opens the tournament that's on now, so it can stay in your bio. This one's own page: ${esc(location.host)}/e/${esc(e.slug)}.`
      : `Once this is the tournament that's on now, ${esc(location.host)}/tournament opens it too.`} People land on the tournament page; Enter and Vote take them into the app.</p></div>`;
}

/* The "entries are open" email: what will happen, or how far it's got. */
function evMailHTML(m, e) {
  if (!m) return "";
  const opens = e.schedule.find((p) => p.phase === "submit")?.start, n = (x) => x.toLocaleString();
  const days = Math.ceil(m.audience / m.perDay);
  const line = !m.on ? "Off. Members won't get an email when entries open."
    : m.doneAt ? `Sent to ${n(m.sent)} member${m.sent === 1 ? "" : "s"} · ${when(m.doneAt)}${m.failed ? ` · ${n(m.failed)} didn't go through` : ""}.`
    : m.startedAt ? `Sending: ${n(m.sent)} sent, ${n(m.left)} to go${m.left > m.perDay ? ` — up to ${m.perDay} a day, so it finishes in about ${Math.ceil(m.left / m.perDay)} days` : ""}.${m.failed ? ` ${n(m.failed)} didn't go through.` : ""}`
    : e.phase.phase === "upcoming" ? `Goes to ${n(m.audience)} member${m.audience === 1 ? "" : "s"} when entries open (${when(opens)}).${days > 1 ? ` That's more than ${m.perDay} a day, so it goes out over ${days} days.` : ""}`
    : e.phase.phase === "submit" ? (e.published ? "Starting within a minute." : "Goes out when you publish it, while entries are open.")
    : "Entries have closed, so it won't go out.";
  const warn = !m.on ? "" : !m.mailOn ? "Email isn't set up (RESEND_API_KEY in Railway → Variables), so nothing will go out."
    : m.testSender ? "MAIL_FROM is Resend's test sender, which only reaches your own inbox, so it won't go to members." : "";
  return `<h2 class="sec">Email <span class="mono">members with a confirmed email · each one can unsubscribe</span></h2>
  <div class="panel"><p style="font-size:14px">${esc(line)}</p>
    ${warn ? `<p style="font-size:13px;margin-top:8px"><span class="tag warn">check</span> ${esc(warn)}</p>` : ""}
    ${m.lastError && !m.doneAt ? `<p class="dim" style="font-size:12px;margin-top:8px">Last problem: ${esc(m.lastError)}</p>` : ""}
    <div class="row wrapx" style="gap:6px;margin-top:12px"><button class="btn ghost sm" id="evmprev">Send me a preview</button></div></div>`;
}

WIRES.events = () => {
  const reload = async () => { await LOADERS.events(); paint(); };
  const on = (s, fn) => { const el = $(s); if (el) el.onclick = fn; };
  on("#evnew", () => { EVFORM = { format: "poll", bracketSize: 16, finalists: 5, picks: 1, judgeWeight: 0, minAccountDays: 0, freezeHours: 24, requireVerified: true, requireAvatar: true, published: false, plan: { opensAt: Date.now() + 14 * 864e5, submitDays: 14, voteDays: 7, roundDays: 2, finalDays: 3, mailOnOpen: true } }; paint(); });
  $$("[data-evcopy]").forEach((b) => b.onclick = async () => { try { await navigator.clipboard.writeText(b.dataset.evcopy); toast("Link copied"); } catch { toast("Couldn't copy"); } });
  $$("[data-ev]").forEach((b) => b.onclick = async () => { EVID = +b.dataset.ev; D.event = null; paint(); await reload(); });
  on("#evback", () => { EVID = null; D.event = null; paint(); });
  if (typeof spamWire === "function") spamWire(reload);
  on("#evcancel", () => { EVFORM = null; paint(); });
  /* the cover: shrunk to 1600px wide in the browser, uploaded, then saved with the form (2026-10-15) */
  const cov = $("#evcov"), covUrl = $("#evcovurl"), covImg = $("#evcovimg"), covX = $("#evcovx");
  if (cov) cov.onchange = async () => {
    const file = cov.files && cov.files[0]; if (!file) return;
    toast("Uploading…");
    try {
      const bmp = await createImageBitmap(file), k = Math.min(1, 1600 / bmp.width), c = document.createElement("canvas");
      c.width = Math.round(bmp.width * k); c.height = Math.round(bmp.height * k); c.getContext("2d").drawImage(bmp, 0, 0, c.width, c.height);
      const r = await req("/api/upload", { method: "POST", body: { data: c.toDataURL("image/jpeg", 0.86) } });
      covUrl.value = r.url; covImg.src = r.url; covImg.hidden = false; covX.hidden = false; EVFORM.coverUrl = r.url;
      toast("Picture ready — Save to use it");
    } catch (e) { toast(e.message || "Couldn't upload that picture"); }
  };
  if (covX) covX.onclick = (e) => { e.preventDefault(); covUrl.value = ""; EVFORM.coverUrl = "";
    if (EVFORM.id && EVFORM.published) covImg.src = `/e/${EVFORM.slug}/card.jpg`; else covImg.hidden = true; covX.hidden = true; toast("The LABS card it is — Save to use it"); };
  on("#evedit", () => { const e = D.event.event; EVFORM = { ...e, plan: e.plan, locked: !!e.state.qualified }; paint(); });
  on("#evsave", async () => {
    const f = EVFORM, b = {};
    $$("[data-f]").forEach((el) => { b[el.dataset.f] = el.type === "checkbox" ? el.checked : el.value; });
    if (b.opensAt) b.opensAt = new Date(b.opensAt).getTime();
    if (f.locked) for (const k of ["format", "bracketSize", "finalists", "opensAt", "submitDays", "voteDays", "roundDays", "finalDays"]) delete b[k];
    const r = await act(() => (f.id ? req("/api/admin/events/" + f.id, { method: "PATCH", body: b }) : req("/api/admin/events", { method: "POST", body: b })), "Saved");
    if (r) { EVFORM = null; EVID = r.event.id; D.event = r; await reload(); }
  });
  on("#evmprev", () => act(() => req(`/api/admin/events/${EVID}/mail-preview`, { method: "POST" }), (r) => "Preview sent to " + r.to));
  on("#evadv", async () => {
    if (!(await confirmIt("End this phase now?", "The next phase starts immediately, and every later date moves earlier by the same amount.", { ok: "End it now", danger: true }))) return;
    const r = await act(() => req(`/api/admin/events/${EVID}/advance`, { method: "POST" }), "Moved on"); if (r) { D.event = r; paint(); }
  });
  on("#evjudge", async () => {
    const u = await promptIt("Add a judge", { placeholder: "username", body: "Judges can't enter this event. They score the finalists 1–10 in the final." });
    if (!u) return; const r = await act(() => req(`/api/admin/events/${EVID}/judges`, { method: "POST", body: { username: u } }), "Judge added"); if (r) { D.event = r; paint(); }
  });
  $$("[data-unjudge]").forEach((b) => b.onclick = async () => { const r = await act(() => req(`/api/admin/events/${EVID}/judges`, { method: "POST", body: { username: b.dataset.unjudge, remove: true } })); if (r) { D.event = r; paint(); } });
  $$("[data-dq]").forEach((b) => b.onclick = async () => {
    const why = await promptIt("Disqualify this entry?", { placeholder: "Reason — they'll see it", body: "It leaves the gallery, can't be voted for, and loses any matchup it's in.", ok: "Disqualify" });
    if (!why) return; const r = await act(() => req(`/api/admin/events/${EVID}/entries/${b.dataset.dq}/dq`, { method: "POST", body: { reason: why } }), "Disqualified"); if (r) { D.event = r; paint(); }
  });
  $$("[data-undq]").forEach((b) => b.onclick = async () => { const r = await act(() => req(`/api/admin/events/${EVID}/entries/${b.dataset.undq}/dq`, { method: "POST", body: { reason: null } }), "Reinstated"); if (r) { D.event = r; paint(); } });
};
