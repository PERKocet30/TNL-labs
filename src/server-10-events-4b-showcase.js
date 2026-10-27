
/* ================================================================
   EVENT SHOWCASE v1.0 — 2026-10-27. "A graphic of the whole tournament
   showcase": every piece in the event, in one picture, for Instagram.

     /e/:slug/showcase.png             the feed post, 1080×1350
     /e/:slug/showcase.png?size=story  the Story, 1080×1920

   Every entry still in (none disqualified), in the order they came in —
   never by votes, so the picture can't tip the vote and works while the
   board is frozen. Each piece square, its @handle under it, over the
   first piece blurred (the Story cards' look), the prize and the stage on
   top, the call in Lab green, the // LABS logo. Drawn with the event
   cards' kit (server-10-events-4-cards): ffmpeg + Archivo by libass,
   palette colours, one build at a time, cached under og/ by a hash of
   what's drawn, so a new entry is a new picture. Lossless PNG like the
   Story cards. Sits before 5-pages so /e/:slug/:entry never catches it.
================================================================ */
const EVS = { version: 1, gap: 16, label: 44, maxCols: 8, max: 40 };

/* The grid that fits: the fewest columns whose rows fit the height. */
function evShowGrid(n, w, h, gap = EVS.gap, label = EVS.label) {
  for (let cols = 1; cols <= EVS.maxCols; cols++) {
    const tile = Math.floor((w - (cols - 1) * gap) / cols), rows = Math.ceil(n / cols);
    if (rows * (tile + label) + (rows - 1) * gap <= h) return { cols, rows, tile };
  }
  const cols = EVS.maxCols, rows = Math.ceil(n / cols);
  return { cols, rows, tile: Math.max(40, Math.floor(Math.min((w - (cols - 1) * gap) / cols, (h - (rows - 1) * gap) / rows - label))) };
}

function evShowcaseCard(ev, size, base) {
  const story = size === "story";
  const entries = db.prepare(`SELECT * FROM event_entries WHERE event_id = ? AND dq_reason IS NULL ORDER BY id`).all(ev.id);
  const pieces = entries.map((e) => {
    const p = q.postById.get(e.post_id), u = q.userById.get(e.user_id);
    return { file: cardFile(p?.thumb_url) || cardFile(p?.image_url), handle: u ? "@" + u.username : "" };
  }).filter((x) => x.file).slice(0, EVS.max);
  if (!pieces.length) return null;
  const st = evStageLine(ev), n = pieces.length;
  const text = { eye: evUpper(ev.title, 34), head: "The showcase",
    sub: `${n} ${n === 1 ? "artist" : "artists"}${ev.prize ? " · " + cardClean(ev.prize) + " prize" : ""}`, line: st.line,
    cta: `${st.cta} ${evHost(base)}/tournament` };
  const hash = createHash("sha1").update(JSON.stringify([EVS.version, EVC.version, size, pieces, text])).digest("hex").slice(0, 12);
  const make = (out, dir) => {
    const W = EVC.w, H = story ? 1920 : 1350, P = EVC.pad, g = evGraph(W, H), t = evAss(dir, W, H);
    const ink = SCK.ink, up = ffc(accentHex("lab"));
    /* Instagram covers a Story's top and bottom ~250px: nothing that matters there */
    const top = story ? 250 : 72, gy0 = top + 290, cy = H - (story ? 360 : 220);   // the call and logo where the scoreboard cards put them
    const i0 = g.input(pieces[0].file);
    const gw = Math.round(W / 4), gh = Math.round(H / 4);   // whole pixels: 1350 / 4 isn't
    g.f.push(`[${i0}:v]scale=${gw}:${gh}:force_original_aspect_ratio=increase,crop=${gw}:${gh},boxblur=18:3,scale=${W}:${H},eq=brightness=-0.32:saturation=1.25,vignette=PI/4,setsar=1,format=rgb24[gnd]`);
    g.lay("gnd", 0, 0);
    t.at(text.eye, P, top, 34, true, ink);
    t.at(text.head, P, top + 46, 96, true, ink);
    t.at(text.sub, P, top + 170, 34, true, ink);
    t.at(text.line, P, top + 220, 30, false, ink);
    const area = { w: W - 2 * P, h: cy - 30 - gy0 }, { cols, rows, tile } = evShowGrid(n, area.w, area.h);
    /* the grid sits in the middle of its space; a short last row is centred */
    const gridH = rows * (tile + EVS.label) + (rows - 1) * EVS.gap, gy = gy0 + Math.max(0, Math.floor((area.h - gridH) / 2));
    const rowX = (row) => { const k = Math.min(cols, n - row * cols); return P + Math.floor((area.w - (k * tile + (k - 1) * EVS.gap)) / 2); };
    const fs = Math.max(16, Math.min(24, Math.round(tile / 8.7))), chars = Math.max(6, Math.floor(tile / (fs * 0.56)));
    pieces.forEach((pc, i) => {
      const col = i % cols, row = Math.floor(i / cols), x = rowX(row) + col * (tile + EVS.gap), y = gy + row * (tile + EVS.label + EVS.gap);
      const k = g.input(pc.file);
      g.f.push(`[${k}:v]scale=${tile}:${tile}:force_original_aspect_ratio=increase,crop=${tile}:${tile},setsar=1,format=rgb24[w${i}]`);
      g.lay(`w${i}`, x, y);
      const h = pc.handle.length > chars ? pc.handle.slice(0, chars - 1) + "…" : pc.handle;
      t.at(h, x, y + tile + 10, fs, true, ink);
    });
    /* the call in Lab green, as a tag — like every card's */
    const cw = Math.min(W - 2 * P, Math.round(text.cta.length * 21 + 72));
    g.box(up, cw, 84, P, cy);
    t.at(text.cta, P + cw / 2, cy + 42, 34, true, ffc(onAccent(accentHex("lab"))), 5);
    evMarkWhite(g, t, P, H - (story ? 200 : 120));
    g.filter(t.write());
    return g.out(out);
  };
  return { hash, prefix: `ev${ev.id}-s${story ? "s" : "p"}`, make, ext: "png" };
}

app.get("/e/:slug/showcase.png", rateLimit({ max: 60, windowMs: 60000 }), (req, res) => {
  const ev = evPublished(req.params.slug); if (!ev) return res.status(404).end();
  const card = evShowcaseCard(ev, req.query.size === "story" ? "story" : "post", baseUrl(req));
  if (!card) return res.status(404).send(lookNotFound("The showcase is made from the entries — it's ready once the first piece is in."));
  evSendCard(res, card, null);
});
