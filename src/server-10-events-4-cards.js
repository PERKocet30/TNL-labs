
/* ================================================================
   EVENT CARDS v1.0 — 2026-10-07. The pictures that take the tournament
   to Instagram and bring people back to vote here.

     /e/:slug/:entry/story.jpg   an entrant's Story: their piece, "Vote for
                                 my piece", where they stand on the board
                                 and their vote link. 1080×1920.
     /e/:slug/board.jpg          TNL's scoreboard post, top 5.
                                 ?size=story → 1080×1920, else 1080×1350.

   Same kit as the profile card (server-10-profile-card.js): ffmpeg-static,
   Archivo drawn by libass, colours from src/palette.js, one build at a
   time, kept on the volume under og/ and named by a hash of everything
   drawn — a new rank is a new file. Instagram covers the top ~250px and
   bottom ~250px of a Story, so nothing that matters goes there.
================================================================ */
const EVC = { version: 1, w: 1080, pad: 72 };

/* An ASS script of positioned lines. at(text, x, y, size, bold, colour, align) */
function evAss(dir, w, h) {
  const lines = [];
  const at = (s, x, y, size, bold, color, an = 7) =>
    lines.push(`Dialogue: 0,0:00:00.00,0:00:10.00,Card,,0,0,0,,{\\an${an}\\pos(${x},${y})\\fs${size}\\b${bold ? 1 : 0}\\c${assColor(color)}}${assText(s)}`);
  const write = () => {
    const file = join(dir, "card.ass");
    writeFileSync(file, ["[Script Info]", "ScriptType: v4.00+", `PlayResX: ${w}`, `PlayResY: ${h}`, "WrapStyle: 2", "ScaledBorderAndShadow: yes", "",
      "[V4+ Styles]",
      "Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding",
      "Style: Card,Archivo,24,&H00000000,&H00000000,&H00000000,&H00000000,0,0,0,0,100,100,0,0,1,0,0,7,0,0,0,1", "",
      "[Events]", "Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text", ...lines, ""].join("\n"));
    return `ass=filename='${fpath(file)}':fontsdir='${fpath(dirname(CARD_FONT.bold))}'`;
  };
  return { at, write };
}

/* A filter graph built up one layer at a time. */
function evGraph(w, h) {
  const args = ["-nostdin", "-y", "-loglevel", "error"], f = [`color=c=${CARD.bg}:s=${w}x${h}:d=1[c0]`];
  let last = "c0", n = 0, k = 0;
  const g = {
    args, f,
    input: (file) => { args.push("-i", file); return k++; },
    lay: (label, x, y) => { f.push(`[${last}][${label}]overlay=${x}:${y}[s${++n}]`); last = `s${n}`; },
    box: (color, bw, bh, x, y) => { const l = `b${n}x${f.length}`; f.push(`color=c=${color}:s=${bw}x${bh}:d=1[${l}]`); g.lay(l, x, y); },
    filter: (expr) => { f.push(`[${last}]${expr}[s${++n}]`); last = `s${n}`; },
    out: (file) => [...args, "-filter_complex", f.join(";"), "-map", `[${last}]`, "-frames:v", "1", "-q:v", "3", file],
  };
  return g;
}
/* The TNL mark and "LABS ®", bottom-left. */
function evMark(g, t, x, y) {
  if (!existsSync(CARD_MARK)) return;
  const i = g.input(CARD_MARK); g.f.push(`[${i}:v]scale=56:56[mk]`); g.lay("mk", x, y);
  t.at("LABS ®", x + 70, y + 28, 34, true, CARD.ink, 4);
}
const evUpper = (s, max) => { const c = cardClean(s).toUpperCase(); return c.length > max ? c.slice(0, max - 1) + "…" : c; };
const evHost = (base) => base.replace(/^https?:\/\//, "");

/* One card at a time (shared with the profile cards), never the same twice at once. */
function evCardBuild(prefix, hash, makeArgs) {
  const name = `${prefix}-${hash}.jpg`, out = join(CARD_DIR, name);
  if (existsSync(out)) return Promise.resolve(out);
  if (CARD_BUILDS.has(out)) return CARD_BUILDS.get(out);
  const job = (CARD_CHAIN = CARD_CHAIN.catch(() => {}).then(async () => {
    if (!FFMPEG) throw new Error("no ffmpeg");
    const dir = join(CARD_DIR, `tmp-${prefix}-${hash}`);
    mkdirSync(dir, { recursive: true });
    const tmp = join(dir, "card.jpg");
    try {
      await runFfmpeg(makeArgs(tmp, dir));
      if (!existsSync(tmp)) throw new Error("no output");
      await new Promise((ok, no) => rename(tmp, out, (e) => (e ? no(e) : ok())));
      await Promise.all(readdirSync(CARD_DIR).filter((f) => f.startsWith(prefix + "-") && f !== name).map(cardRm));
      return out;
    } finally { await cardRm(dir.slice(CARD_DIR.length + 1)); }
  }));
  CARD_BUILDS.set(out, job);
  job.finally(() => CARD_BUILDS.delete(out)).catch(() => {});
  return job;
}

/* Where an entry stands, in words for a card or a page. */
function evStanding(ev, e) {
  tickEvent(ev);
  const sched = evJSON(ev.schedule, []), cur = phaseAt(sched), stage = EV_STAGE(cur), st = evJSON(ev.state, {});
  const board = stage ? evBoard(ev, stage, cur) : null, row = board?.rows.find((r) => r.entryId === e.id) || null;
  const inPlay = stage ? evInPlay(ev, stage).ids.has(e.id) : false;
  const day = (t) => new Date(t).toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "America/New_York" }).toUpperCase();
  const q0 = sched.find((p) => p.phase === "qualify");
  let head = "Vote for my piece", tag = "VOTING IS OPEN", voting = true;
  if (cur.phase === "upcoming" || cur.phase === "submit") { head = "I'm in."; tag = q0 ? `VOTING OPENS ${day(q0.start)}` : "ENTRIES ARE OPEN"; voting = false; }
  else if (cur.phase === "results") {
    const i = (st.results?.ranking || []).findIndex((r) => r.entryId === e.id);
    head = i === 0 ? "I won." : "The results are in"; tag = i === 0 ? "WINNER" : i > 0 ? `#${i + 1} IN THE FINAL` : "SEE THE WINNER"; voting = false;
  } else if (!inPlay) { head = "See who's leading"; tag = "VOTE NOW"; }
  else if (row) tag = `#${row.rank} ${stage === "final" ? "IN THE FINAL" : "ON THE BOARD"}${board.frozen ? " · BOARD FROZEN" : ""}`;
  else if (stage === "final") tag = "IN THE FINAL";
  return { head, tag, voting, row, board, cur, stage };
}

function evEntryStory(ev, e, base) {
  const p = q.postById.get(e.post_id), u = q.userById.get(e.user_id);
  const art = cardFile(p?.image_url) || cardFile(p?.thumb_url);
  if (!u || !art) return null;
  const s = evStanding(ev, e), accent = accentHex(u.accent);
  const text = { eye: evUpper(ev.title, 34), head: s.head, handle: "@" + u.username, tag: s.tag,
    cta: s.voting ? "Tap the link to vote" : "", url: `${evHost(base)}/e/${ev.slug}/${e.id}` };
  const hash = createHash("sha1").update(JSON.stringify([EVC.version, art, text, accent])).digest("hex").slice(0, 12);
  const make = (out, dir) => {
    const W = EVC.w, H = 1920, P = EVC.pad, g = evGraph(W, H), t = evAss(dir, W, H);
    t.at(text.eye, P, 250, 34, true, CARD.ink2);
    t.at(text.head, P, 296, 84, true, CARD.ink);
    // the piece, whole, on a grey ground
    const bw = W - 2 * P, bh = 940, by = 420;
    g.box(CARD.el, bw, bh, P, by);
    const i = g.input(art);
    g.f.push(`[${i}:v]scale=${bw}:${bh}:force_original_aspect_ratio=decrease,setsar=1,format=rgb24[art]`);
    g.lay("art", `${P}+(${bw}-w)/2`, `${by}+(${bh}-h)/2`);
    t.at(text.handle, P, by + bh + 36, 56, true, CARD.ink);
    // where they stand, in their colour
    const tw = Math.round(text.tag.length * 23 + 64), ty = by + bh + 124;
    g.box(ffc(accent), Math.min(bw, tw), 76, P, ty);
    t.at(text.tag, P + Math.min(bw, tw) / 2, ty + 38, 36, true, ffc(onAccent(accent)), 5);
    if (text.cta) t.at(text.cta, P, ty + 116, 38, false, CARD.ink2);
    evMark(g, t, P, H - 200);
    t.at(text.url, W - P, H - 172, 28, false, CARD.ink2, 6);
    g.filter(t.write());
    return g.out(out);
  };
  return { hash, prefix: `ev${ev.id}-e${e.id}`, make };
}

/* TNL's scoreboard: the top five, how many votes, who's moving. */
function evBoardCard(ev, size, base) {
  tickEvent(ev);
  const cur = phaseAt(evJSON(ev.schedule, [])), stage = EV_STAGE(cur), board = stage ? evBoard(ev, stage, cur) : null;
  if (!board || !board.rows.length) return null;
  const story = size === "story";
  const rows = board.rows.slice(0, 5).map((r) => {
    const e = db.prepare(`SELECT * FROM event_entries WHERE id = ?`).get(r.entryId);
    const p = e && q.postById.get(e.post_id), u = e && q.userById.get(e.user_id);
    return { rank: "#" + r.rank, handle: u ? "@" + (u.username.length > 20 ? u.username.slice(0, 19) + "…" : u.username) : "", votes: `${r.votes} ${r.votes === 1 ? "vote" : "votes"}`,
      move: r.move > 0 ? `up ${r.move}` : r.move < 0 ? `down ${-r.move}` : "", file: cardFile(p?.thumb_url) || cardFile(p?.image_url) };
  });
  const asOf = new Date(board.asOf).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit", timeZone: "America/New_York" });
  const text = { eye: evUpper(ev.title, 34), head: stage === "final" ? "The final" : "Scoreboard",
    sub: board.frozen ? `Frozen ${asOf} ET · the last ${ev.freeze_hours} hours are secret` : `Live · ${asOf} ET · ${board.total} ${board.total === 1 ? "vote" : "votes"}`,
    cta: `Vote at ${evHost(base)}/e/${ev.slug}` };
  const hash = createHash("sha1").update(JSON.stringify([EVC.version, size, rows, text])).digest("hex").slice(0, 12);
  const make = (out, dir) => {
    const W = EVC.w, H = story ? 1920 : 1350, P = EVC.pad, g = evGraph(W, H), t = evAss(dir, W, H);
    const top = story ? 250 : 72, y0 = story ? 560 : 360, step = story ? 200 : 172, th = story ? 168 : 148;
    t.at(text.eye, P, top, 34, true, CARD.ink2);
    t.at(text.head, P, top + 46, 96, true, CARD.ink);
    t.at(text.sub, P, top + 170, 30, false, CARD.ink2);
    rows.forEach((r, i) => {
      const y = y0 + i * step;
      t.at(r.rank, P, y + th / 2, 56, true, CARD.ink, 4);
      const x = P + 120;
      if (r.file) { const k = g.input(r.file); g.f.push(`[${k}:v]scale=${th}:${th}:force_original_aspect_ratio=increase,crop=${th}:${th},setsar=1,format=rgb24[t${i}]`); g.lay(`t${i}`, x, y); }
      else g.box(CARD.el, th, th, x, y);
      t.at(r.handle, x + th + 32, y + th / 2 - 6, 44, true, CARD.ink, 1);
      t.at(r.votes, x + th + 32, y + th / 2 + 4, 32, false, CARD.ink2, 7);
      if (r.move) t.at(r.move, W - P, y + th / 2, 32, true, r.move.startsWith("up") ? CARD.ink : CARD.ink2, 6);
    });
    t.at(text.cta, P, H - (story ? 330 : 190), 38, true, CARD.ink);
    evMark(g, t, P, H - (story ? 200 : 120));
    g.filter(t.write());
    return g.out(out);
  };
  return { hash, prefix: `ev${ev.id}-b${story ? "s" : "p"}`, make };
}

const evPublished = (slug) => { const ev = evRow(slug); return ev && ev.published ? ev : null; };
async function evSendCard(res, card, fallback) {
  if (!card) return res.status(404).end();
  if (!FFMPEG || !existsSync(CARD_FONT.bold)) return fallback ? res.redirect(302, fallback) : res.status(503).end();
  try {
    const file = await evCardBuild(card.prefix, card.hash, card.make);
    res.set("Cache-Control", "public, max-age=300");
    res.type("jpg").sendFile(file);
  } catch (e) {
    logError("card", "event card: " + (e.message || "failed"), "", res.req?.path || "", "");
    fallback ? res.redirect(302, fallback) : res.status(503).end();
  }
}

app.get("/e/:slug/board.jpg", rateLimit({ max: 60, windowMs: 60000 }), (req, res) => {
  const ev = evPublished(req.params.slug); if (!ev) return res.status(404).end();
  evSendCard(res, evBoardCard(ev, req.query.size === "story" ? "story" : "post", baseUrl(req)), null);
});
app.get("/e/:slug/:entry/story.jpg", rateLimit({ max: 60, windowMs: 60000 }), (req, res) => {
  const ev = evPublished(req.params.slug); if (!ev) return res.status(404).end();
  const e = db.prepare(`SELECT * FROM event_entries WHERE id = ? AND event_id = ? AND dq_reason IS NULL`).get(Number(req.params.entry) || 0, ev.id);
  if (!e) return res.status(404).end();
  const p = q.postById.get(e.post_id);
  evSendCard(res, evEntryStory(ev, e, baseUrl(req)), p?.image_url || null);
});
