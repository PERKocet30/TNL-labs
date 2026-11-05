/* ================================================================
   WINNER CARD v1.0 — 2026-11-05. "Build me a graphic to post on
   Instagram announcing the winner."

     /e/:slug/winner.png              the feed post, 1080×1350
     /e/:slug/winner.png?size=story   the Story, 1080×1920

   The winning piece, whole, over itself blurred; THE WINNER, their
   picture and @handle, the prize; and — when the tournament has one —
   what's next (EVR_NEXT, events/resultmail.js) in Lab green. Ready once
   the results are in; before that it says so. Same kit as the other
   tournament cards (events/cards.js): ffmpeg, Archivo by libass,
   colours from src/palette.js, PNG so Instagram's squeeze is the only one.
   Story: Instagram covers the top and bottom ~250px, so nothing goes there.
================================================================ */
function evWinnerCard(ev, size, base) {
  tickEvent(ev);
  const st = evJSON(ev.state, {}), win = st.results?.winner;
  if (st.void || !win) return null;
  const e = db.prepare(`SELECT * FROM event_entries WHERE id = ?`).get(win);
  const p = e && q.postById.get(e.post_id), u = e && q.userById.get(e.user_id);
  const art = cardFile(p?.image_url) || cardFile(p?.thumb_url);
  if (!u || !art) return null;
  const story = size === "story", next = EVR_NEXT[ev.slug] || "";
  const text = { eye: "// " + evUpper(ev.title, 30), head: "THE WINNER", name: evUpper(u.display_name || u.username, 22), handle: "@" + u.username,
    prize: ev.prize ? evUpper(ev.prize + " prize", 20) : "", next: next ? `NEXT: // ${next.toUpperCase()} TOURNAMENT` : "", url: `${evHost(base)}/e/${ev.slug}` };
  const av = cardFile(u.avatar_url);
  const hash = createHash("sha1").update(JSON.stringify([EVC.version, "win1", size, text, art, av])).digest("hex").slice(0, 12);
  const make = (out, dir) => {
    const W = EVC.w, H = story ? 1920 : 1350, P = EVC.pad, g = evGraph(W, H), t = evAss(dir, W, H);
    const ink = SCK.ink, up = ffc(accentHex("lab")), top = story ? 260 : 72;
    /* the piece over itself, blurred edge to edge */
    const i = g.input(art);
    g.f.push(`[${i}:v]split=2[wa][wb]`);
    g.f.push(`[wa]scale=${W / 4}:${H / 4}:force_original_aspect_ratio=increase,crop=${W / 4}:${H / 4},boxblur=18:3,scale=${W}:${H},eq=brightness=-0.32:saturation=1.25,vignette=PI/4,setsar=1,format=rgb24[gnd]`);
    g.lay("gnd", 0, 0);
    t.at(text.eye, P, top, 32, true, up);
    t.at(text.head, P, top + 44, 104, true, ink);
    /* the piece, whole, centred in its space */
    const boxY = top + 190, boxH = story ? 900 : 700, boxW = W - 2 * P;
    g.f.push(`[wb]scale=${boxW}:${boxH}:force_original_aspect_ratio=decrease,setsar=1,format=rgb24[wp]`);
    g.lay("wp", "(W-w)/2", `${boxY}+(${boxH}-h)/2`);
    /* who: their picture, round, their name and @handle; the prize on the right */
    const A = 88, ay = boxY + boxH + 44, tx = P + A + 24;
    const round = `format=rgba,geq=r='r(X,Y)':g='g(X,Y)':b='b(X,Y)':a='if(lte(hypot(X-${A - 0.5},Y-${A - 0.5}),${A}),255,0)',scale=${A}:${A}`;
    if (av) { const k = g.input(av); g.f.push(`[${k}:v]scale=${A * 2}:${A * 2}:force_original_aspect_ratio=increase,crop=${A * 2}:${A * 2},setsar=1,${round}[wav]`); }
    else { g.f.push(`color=c=${SCK.el}:s=${A * 2}x${A * 2}:d=1,${round}[wav]`); t.at(u.username.slice(0, 2).toUpperCase(), P + A / 2, ay + A / 2, 30, true, ink, 5); }
    g.lay("wav", P, ay);
    t.at(text.name, tx, ay + A / 2 - 4, 48, true, ink, 1);
    t.at(text.handle, tx, ay + A / 2 + 6, 32, false, ink, 7);
    if (text.prize) t.at(text.prize, W - P, ay + A / 2, 40, true, ink, 6);
    /* what's next, as a tag in Lab green; the logo and the link under it */
    if (text.next) { const cy = story ? H - 400 : H - 196, cw = Math.min(W - 2 * P, Math.round(text.next.length * 21 + 72));
      g.box(up, cw, 84, P, cy);
      t.at(text.next, P + cw / 2, cy + 42, 34, true, ffc(onAccent(accentHex("lab"))), 5); }
    const mY = story ? H - 290 : H - 92;
    t.at(text.url, W - P, mY + 28, 28, false, ink, 6);
    evMarkWhite(g, t, P, mY);
    g.filter(t.write());
    return g.out(out);
  };
  return { hash, prefix: `ev${ev.id}-w${story ? "s" : "p"}`, make, ext: "png" };
}
app.get("/e/:slug/winner.png", rateLimit({ max: 60, windowMs: 60000 }), (req, res) => {
  const ev = evPublished(req.params.slug); if (!ev) return res.status(404).end();
  const card = evWinnerCard(ev, req.query.size === "story" ? "story" : "post", baseUrl(req));
  if (!card) return res.status(404).send(lookNotFound("The winner's picture is ready once the results are in."));
  evSendCard(res, card, null);
});
