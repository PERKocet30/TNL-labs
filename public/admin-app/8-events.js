/* TNL LABS admin — Events v1.2, 2026-10-09 (the Tournament tab; v1.2: named for it).
   Events v1.1, 2026-10-07. Set up and run events (the
   tournament): dates, format, judges, the live tallies members never see,
   disqualifying, and "End this phase now". The server enforces all of it.
   v1.1: the Poll format (votes a day + a live scoreboard), and the
   Instagram kit — scoreboard pictures to post, each entry's vote link. */
let EVID = null, EVFORM = null;
LOADERS.events = async () => {
  D.events = await req("/api/admin/events");
  if (EVID) D.event = await req("/api/admin/events/" + EVID);
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
  return `<div class="row sp"><h1 style="font-size:22px">Tournament</h1><button class="btn fill" id="evnew">New event</button></div>
    <p class="dim" style="margin:8px 0 14px;font-size:13px">Your tournament lives here. Members see it on the Showroom and at labs.tnllabs.com/e/your-link. Votes only count in the app — Instagram is for reach: each event's Instagram kit has the scoreboard to post and every entry's vote link.</p>
    <div class="list">${L.length ? L.map((e) => `<button class="li" data-ev="${e.id}"><div class="b"><b>${esc(e.title)}${e.published ? "" : `<span class="tag">draft</span>`}</b>
      <span>/e/${esc(e.slug)} · ${e.format} · ${e.entries} entr${e.entries === 1 ? "y" : "ies"}</span></div><div class="r">${phName(e.phase)}</div>${I.chev}</button>`).join("")
      : `<div class="empty">No events yet.</div>`}</div>`;
};

function evFormHTML() {
  const f = EVFORM, p = f.plan || {};
  const field = (k, label, v, attrs = "") => `<label class="fld"><span>${label}</span><input class="in" data-f="${k}" value="${esc(v ?? "")}" ${attrs}></label>`;
  const sel = (k, label, v, opts) => `<label class="fld"><span>${label}</span><select class="sel" data-f="${k}">${opts.map(([val, t]) => `<option value="${val}" ${String(v) === String(val) ? "selected" : ""}>${t}</option>`).join("")}</select></label>`;
  const locked = f.locked;
  return `<div class="row sp"><h1 style="font-size:22px">${f.id ? "Edit event" : "New event"}</h1><button class="btn ghost sm" id="evcancel">Cancel</button></div>
  <div class="panel evf" style="margin-top:14px">
    ${field("title", "Title", f.title, 'placeholder="TNL Poster Tournament"')}
    ${f.id ? "" : field("slug", "Link name", f.slug, 'placeholder="poster-tournament" autocapitalize="none"')}
    <label class="fld"><span>The brief</span><textarea class="in" data-f="brief" rows="4" placeholder="What should people make?">${esc(f.brief || "")}</textarea></label>
    ${field("prize", "Prize", f.prize, 'placeholder="e.g. $500 cash — leave empty until decided"')}
    ${sel("channel", "Entries post into", f.channel || "graphic-design", [["graphic-design", "// Visual · graphic-design"], ["photography", "// Visual · photography"], ["clothing-design", "// Fashion · clothing-design"], ["general", "// General · general"]])}
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
  </div></div>
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
  <h1 style="font-size:22px;margin-top:14px">${esc(e.title)} ${e.published ? `<span class="tag on">live</span>` : `<span class="tag">draft</span>`}</h1>
  <p class="dim" style="font-size:13px;margin-top:4px">${e.format === "bracket" ? `Bracket of up to ${e.bracketSize}` : e.format === "poll" ? `Poll · ${e.picks} vote${e.picks === 1 ? "" : "s"} a day · board freezes ${e.freezeHours}h before each close · top ${e.finalists} to the final` : `Simple · top ${e.finalists} to the final`}${e.format === "poll" ? "" : ` · ${e.picks} picks`} · final ${e.judgeWeight ? e.judgeWeight + "% judges" : "votes only"}${e.requireVerified ? " · confirmed emails" : ""}${e.minAccountDays ? ` · voters ${e.minAccountDays}+ days old` : ""} · ${d.voters} people have voted${e.prize ? " · " + esc(e.prize) : ""}</p>
  ${e.format === "poll" ? `<h2 class="sec">Instagram <span class="mono">every link leads back to the app — only votes there count</span></h2>
  <div class="panel"><div class="row wrapx" style="gap:6px">
    <a class="btn ghost sm" href="/e/${esc(e.slug)}/board" target="_blank">Scoreboard page</a>
    <a class="btn ghost sm" href="/e/${esc(e.slug)}/board.jpg?t=${Date.now()}" target="_blank">Scoreboard post (1080×1350)</a>
    <a class="btn ghost sm" href="/e/${esc(e.slug)}/board.jpg?size=story&t=${Date.now()}" target="_blank">Scoreboard Story (1080×1920)</a>
    <button class="btn ghost sm" data-evcopy="${esc(location.origin + "/e/" + e.slug)}">Copy event link</button></div>
    <p class="dim" style="font-size:12px;margin-top:10px">Post the scoreboard daily with a link sticker to the event. Entrants get their own Story card and vote link in the app (Share to Instagram); theirs are below too.</p></div>` : ""}
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

WIRES.events = () => {
  const reload = async () => { await LOADERS.events(); paint(); };
  const on = (s, fn) => { const el = $(s); if (el) el.onclick = fn; };
  on("#evnew", () => { EVFORM = { format: "poll", bracketSize: 16, finalists: 5, picks: 1, judgeWeight: 0, minAccountDays: 0, freezeHours: 24, requireVerified: true, published: false, plan: { opensAt: Date.now() + 14 * 864e5, submitDays: 14, voteDays: 7, roundDays: 2, finalDays: 3 } }; paint(); });
  $$("[data-evcopy]").forEach((b) => b.onclick = async () => { try { await navigator.clipboard.writeText(b.dataset.evcopy); toast("Link copied"); } catch { toast("Couldn't copy"); } });
  $$("[data-ev]").forEach((b) => b.onclick = async () => { EVID = +b.dataset.ev; D.event = null; paint(); await reload(); });
  on("#evback", () => { EVID = null; D.event = null; paint(); });
  on("#evcancel", () => { EVFORM = null; paint(); });
  on("#evedit", () => { const e = D.event.event; EVFORM = { ...e, plan: e.plan, locked: !!e.state.qualified }; paint(); });
  on("#evsave", async () => {
    const f = EVFORM, b = {};
    $$("[data-f]").forEach((el) => { b[el.dataset.f] = el.type === "checkbox" ? el.checked : el.value; });
    if (b.opensAt) b.opensAt = new Date(b.opensAt).getTime();
    if (f.locked) for (const k of ["format", "bracketSize", "finalists", "opensAt", "submitDays", "voteDays", "roundDays", "finalDays"]) delete b[k];
    const r = await act(() => (f.id ? req("/api/admin/events/" + f.id, { method: "PATCH", body: b }) : req("/api/admin/events", { method: "POST", body: b })), "Saved");
    if (r) { EVFORM = null; EVID = r.event.id; D.event = r; await reload(); }
  });
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
