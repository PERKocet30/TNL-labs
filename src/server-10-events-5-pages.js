
/* ================================================================
   EVENT PAGES v1.0 — 2026-10-07. The two links that go on Instagram.

     /e/:slug/board   the scoreboard, for anyone, no account needed
     /e/:slug/:entry  one piece. Its link preview is the piece itself;
                      "Vote" opens it in the app (/?e=slug&v=entry),
                      where the vote is counted.

   Both are plain pages (server-01-look.js) so they open fast inside
   Instagram's browser. Neither shows a count the app wouldn't.
================================================================ */
const evAbs = (base, u) => (/^https?:/.test(u) ? u : base + u);
const evOg = (base, { title, desc, img, url }) => `<meta property="og:type" content="website"><meta property="og:site_name" content="TNL LABS">
<meta property="og:title" content="${lookEsc(title)}"><meta property="og:description" content="${lookEsc(desc)}">
<meta property="og:image" content="${lookEsc(evAbs(base, img))}"><meta property="og:url" content="${lookEsc(base + url)}">
<meta name="twitter:card" content="summary_large_image"><meta name="description" content="${lookEsc(desc)}">`;
const EV_PAGE_CSS = `<style>.row{display:grid;grid-template-columns:40px 56px 1fr auto;gap:12px;align-items:center;padding:10px 0;border-bottom:1px solid var(--line);color:var(--tx);text-decoration:none}
.row .n{font-weight:700;font-variant-numeric:tabular-nums}.row img,.row .ph{width:56px;height:56px;object-fit:cover;background:var(--el);display:block}
.row .v{text-align:right;font-weight:700;font-variant-numeric:tabular-nums}.row .mv{display:block;font-size:12px;line-height:16px;font-weight:400;color:var(--dim)}
.tag{display:inline-block;padding:6px 12px;border-radius:999px;background:var(--fill);color:var(--on-fill);font-size:12px;line-height:16px;font-weight:700;letter-spacing:.06em}</style>`;

app.get("/e/:slug/board", (req, res) => {
  const ev = evPublished(req.params.slug);
  if (!ev) return res.status(404).send(lookNotFound("This event doesn't exist."));
  tickEvent(ev);
  const cur = phaseAt(evJSON(ev.schedule, [])), stage = EV_STAGE(cur), board = stage ? evBoard(ev, stage, cur) : null;
  const base = baseUrl(req), esc = lookEsc;
  const rows = (board?.rows || []).map((r) => {
    const e = db.prepare(`SELECT * FROM event_entries WHERE id = ?`).get(r.entryId);
    const p = e && q.postById.get(e.post_id), u = e && q.userById.get(e.user_id);
    if (!p || !u) return "";
    const mv = r.move > 0 ? `up ${r.move}` : r.move < 0 ? `down ${-r.move}` : "";
    return `<a class="row" href="/e/${esc(ev.slug)}/${r.entryId}"><span class="n">#${r.rank}</span>
<img src="${esc(p.thumb_url || p.image_url)}" alt="" loading="lazy"><span><b>@${esc(u.username)}</b></span>
<span class="v">${r.votes}<span class="mv">${mv || "&nbsp;"}</span></span></a>`;
  }).join("");
  const when = board ? new Date(board.asOf).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit", timeZone: "America/New_York" }) : "";
  const note = !board ? (ev.format === "poll" ? (cur.phase === "results" ? "Voting's closed — the results are in the app." : "The scoreboard goes live when voting opens.") : "This event keeps its counts secret until each stage ends.")
    : board.frozen ? `Frozen at ${when} ET. Votes still count — the last ${ev.freeze_hours} hours stay secret until the results.` : `Live · ${when} ET · ${lookCount(board.total, "vote")}`;
  res.set("Cache-Control", "no-store");
  res.send(lookPage({
    title: `Scoreboard — ${esc(ev.title)} — TNL LABS`,
    head: evOg(base, { title: `${ev.title} — scoreboard`, desc: note, img: ev.cover_url || "/icon-512.png", url: `/e/${ev.slug}/board` }) + EV_PAGE_CSS,
    body: `${lookEyebrow(ev.title)}<h1>${stage === "final" ? "The final" : "Scoreboard"}</h1>
<p class="cap" style="margin:0 0 12px">${esc(note)}</p>${rows}
<a class="btn block acc" href="/?e=${encodeURIComponent(ev.slug)}">Vote in the app</a>
<p class="cap" style="margin-top:14px"><a href="/e/${esc(ev.slug)}">About the event</a> · <a href="/e/${esc(ev.slug)}/rules">Official rules</a></p>`,
  }));
});

app.get("/e/:slug/:entry", (req, res, next) => {
  if (!/^\d+$/.test(req.params.entry)) return next();
  const ev = evPublished(req.params.slug);
  if (!ev) return res.status(404).send(lookNotFound("This event doesn't exist."));
  const e = db.prepare(`SELECT * FROM event_entries WHERE id = ? AND event_id = ? AND dq_reason IS NULL`).get(Number(req.params.entry), ev.id);
  const p = e && q.postById.get(e.post_id), u = e && q.userById.get(e.user_id);
  if (!p || !u) return res.status(404).send(lookNotFound("That piece isn't in this event."));
  const s = evStanding(ev, e), base = baseUrl(req), esc = lookEsc;
  const name = u.display_name || u.username;
  const desc = [s.tag.charAt(0) + s.tag.slice(1).toLowerCase(), ev.title, s.voting ? "Tap to vote on TNL LABS" : ""].filter(Boolean).join(" · ");
  res.set("Cache-Control", "no-store");
  res.send(lookPage({
    title: `${esc(name)} — ${esc(ev.title)} — TNL LABS`, accent: accentHex(u.accent),
    head: evOg(base, { title: `${s.voting ? "Vote for " : ""}@${u.username} — ${ev.title}`, desc, img: p.image_url, url: `/e/${ev.slug}/${e.id}` }) + EV_PAGE_CSS,
    body: `${lookEyebrow(ev.title)}<h1>${esc(s.head)}</h1>
<img class="media" src="${esc(p.image_url)}" alt="" style="max-height:none;object-fit:contain">
<a class="who" href="/u/${esc(u.username)}" style="margin:16px 0 10px">${u.avatar_url ? `<img class="av ring" src="${esc(u.avatar_url)}" alt="">` : `<span class="av ring">${esc(name.slice(0, 2).toUpperCase())}</span>`}
<span><span class="name">${esc(name)}</span><br><span class="cap">@${esc(u.username)}</span></span></a>
<span class="tag">${esc(s.tag)}</span>${p.body ? `<p class="body">${esc(p.body)}</p>` : ""}
<a class="btn block acc" href="/?e=${encodeURIComponent(ev.slug)}&amp;v=${e.id}">${s.voting ? "Vote in the app" : "Open in the app"}</a>
<p class="cap" style="margin-top:14px">${s.board ? `<a href="/e/${esc(ev.slug)}/board">Scoreboard</a> · ` : ""}<a href="/e/${esc(ev.slug)}">About the event</a> · <a href="/e/${esc(ev.slug)}/rules">Official rules</a></p>`,
  }));
});
