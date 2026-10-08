
/* ================================================================
   A POST, AS AN INSTAGRAM STORY · 2026-10-08. "Make it so I can share
   a post off the app to IG Stories." /p/:id/story.jpg is a 1080×1920
   card of the work — the piece whole (a video's cover), who made it, in
   their colour, the TNL mark and the post's link — drawn by the same kit
   as the event cards (ffmpeg + Archivo, palette colours, one build at a
   time, cached on the volume under og/ by a hash of what's drawn).
   Nothing that matters sits in Instagram's top or bottom ~250px. The app
   shares it to the phone's sheet (Instagram → Story) with the link
   copied for a Link sticker. Published work only, like /p/:id.
================================================================ */
function postStory(p, base) {
  const u = p && q.userById.get(p.author_id);
  const art = p && (cardFile(p.image_url) || cardFile(p.thumb_url));
  if (!u || !art) return null;
  let roles = []; try { roles = JSON.parse(u.roles || "[]"); } catch {}
  const accent = accentHex(u.accent);
  const text = { name: evUpper(u.display_name || u.username, 26), role: evUpper((roles[0] || u.role || "").toString(), 30),
    handle: "@" + u.username, tag: p.video_url ? "WATCH ON LABS" : "SEE IT ON LABS", url: `${evHost(base)}/p/${p.id}` };
  const hash = createHash("sha1").update(JSON.stringify([2, art, text, accent])).digest("hex").slice(0, 12);
  const make = (out, dir) => {
    const W = EVC.w, H = 1920, P = EVC.pad, g = evGraph(W, H), t = evAss(dir, W, H);
    t.at(text.name, P, 250, 64, true, CARD.ink);
    if (text.role) t.at(text.role, P, 330, 32, true, CARD.ink2);
    const bw = W - 2 * P, bh = 1000, by = 410;
    // the piece whole, over a blurred fill of itself — a wide video or a tall print both fill the frame
    const i = g.input(art);
    g.f.push(`[${i}:v]split=2[a1][a2]`,
      `[a1]scale=${bw}:${bh}:force_original_aspect_ratio=increase,crop=${bw}:${bh},boxblur=36:3,eq=brightness=-0.06,setsar=1,format=rgb24[fill]`,
      `[a2]scale=${bw}:${bh}:force_original_aspect_ratio=decrease,setsar=1,format=rgb24[art]`);
    g.lay("fill", P, by);
    g.lay("art", `${P}+(${bw}-w)/2`, `${by}+(${bh}-h)/2`);
    const tw = Math.round(text.tag.length * 23 + 64), ty = by + bh + 44;
    g.box(ffc(accent), tw, 76, P, ty);
    t.at(text.tag, P + tw / 2, ty + 38, 36, true, ffc(onAccent(accent)), 5);
    t.at(text.handle, W - P, ty + 38, 40, true, CARD.ink, 6);
    evMark(g, t, P, H - 200);
    t.at(text.url, W - P, H - 172, 28, false, CARD.ink2, 6);
    g.filter(t.write());
    return g.out(out);
  };
  return { hash, prefix: `p${p.id}-story`, make };
}
app.get("/p/:id/story.jpg", rateLimit({ max: 60, windowMs: 60000 }), (req, res) => {
  const p = q.postById.get(Number(req.params.id) || 0);
  if (!p || !p.is_work || p.deleted_at) return res.status(404).end();
  evSendCard(res, postStory(p, baseUrl(req)), p.image_url || p.thumb_url || null);
});
