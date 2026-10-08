
/* ================================================================
   ANYTHING ON LABS, AS AN INSTAGRAM STORY · 2026-10-08. "Make it so I
   can share … to IG stories — for anything on the app." 1080×1920 cards:
     /p/:id/story.jpg      a post — the work whole (a video's cover) over a
                           blurred fill of itself; a text post as a quote
     /u/:name/story.jpg    a profile — name, role, bio, four recent pieces
     /m/:id/story.jpg      a listing — the photo, title, price
     /tr/:id/story.jpg     a track — the artwork, title, who made it
   (the tournament has its own, server-10-events-4-cards). One layout:
   a heading, the picture, a tag in the maker's colour with their handle,
   the TNL mark and the link — drawn with the event cards' kit (ffmpeg +
   Archivo, palette colours, one build at a time, cached under og/ by a
   hash of what's drawn). Nothing that matters sits in Instagram's top or
   bottom ~250px. The app shares them from every share menu (Instagram
   Story → the phone's sheet, with the link copied for a Link sticker).
================================================================ */
const SC = { w: 1080, h: 1920, pad: 72, top: 250, by: 410, bh: 1000 };

/* c: { prefix, head, sub, art?, tiles?, quote?, cover?, lead?, tag, handle, url, accent } */
function storyCard(c) {
  const hash = createHash("sha1").update(JSON.stringify([4, c])).digest("hex").slice(0, 12);
  const make = (out, dir) => {
    const W = SC.w, H = SC.h, P = SC.pad, g = evGraph(W, H), t = evAss(dir, W, H), bw = W - 2 * P, by = SC.by, bh = SC.bh;
    t.at(c.head, P, SC.top, 64, true, CARD.ink);
    if (c.sub) t.at(c.sub, P, SC.top + 80, 32, true, CARD.ink2);
    if (c.art) {
      // the piece whole, over a blurred fill of itself — wide or tall, the frame is full
      const i = g.input(c.art);
      g.f.push(`[${i}:v]split=2[a1][a2]`,
        `[a1]scale=${bw}:${bh}:force_original_aspect_ratio=increase,crop=${bw}:${bh},boxblur=36:3,eq=brightness=-0.06,setsar=1,format=rgb24[fill]`,
        `[a2]scale=${bw}:${bh}:force_original_aspect_ratio=decrease,setsar=1,format=rgb24[art]`);
      g.lay("fill", P, by);
      g.lay("art", `${P}+(${bw}-w)/2`, `${by}+(${bh}-h)/2`);
    } else if (c.tiles) {
      // a profile: the bio, then up to four pieces, two across, as big as the space allows
      (c.lead || []).forEach((l, k) => t.at(l, P, by + k * 52, 40, false, CARD.ink));
      const gap = 12, gy = by + (c.lead || []).length * 52 + (c.lead && c.lead.length ? 40 : 0);
      const rows = Math.max(1, Math.ceil(c.tiles.length / 2)), s = Math.min(Math.floor((bw - gap) / 2), Math.floor((by + bh - gy - (rows - 1) * gap) / rows));
      c.tiles.forEach((f, k) => {
        const x = P + (k % 2) * (s + gap), y = gy + Math.floor(k / 2) * (s + gap), i = g.input(f);
        g.f.push(`[${i}:v]scale=${s}:${s}:force_original_aspect_ratio=increase,crop=${s}:${s},setsar=1,format=rgb24[t${k}]`);
        g.lay(`t${k}`, x, y);
      });
      if (!c.tiles.length) g.box(CARD.el, bw, s, P, gy);
    } else {
      // words only: a quote on the grey ground — or, for a track with no artwork, a cover in the maker's colour
      const cover = !!c.cover, fs = cover ? 96 : 64, lh = cover ? 108 : 80;
      g.box(cover ? ffc(c.accent) : CARD.el, bw, bh, P, by);
      (c.quote || []).forEach((l, k, a) => t.at(l, P + 56, by + bh / 2 - (a.length * lh) / 2 + k * lh, fs, true, cover ? ffc(onAccent(c.accent)) : CARD.ink));
    }
    const tw = Math.round(c.tag.length * 23 + 64), ty = by + bh + 44;
    g.box(ffc(c.accent), tw, 76, P, ty);
    t.at(c.tag, P + tw / 2, ty + 38, 36, true, ffc(onAccent(c.accent)), 5);
    if (c.handle) t.at(c.handle, W - P, ty + 38, 40, true, CARD.ink, 6);
    evMark(g, t, P, H - 200);
    t.at(c.url, W - P, H - 172, 28, false, CARD.ink2, 6);
    g.filter(t.write());
    return g.out(out);
  };
  return { hash, prefix: c.prefix, make };
}
const userRole = (u) => { let r = []; try { r = JSON.parse(u.roles || "[]"); } catch {} return evUpper(String(r[0] || u.role || ""), 30); };

function postStory(p, base) {
  const u = p && q.userById.get(p.author_id);
  if (!u || u.suspended) return null;
  const art = cardFile(p.image_url) || cardFile(p.thumb_url);
  const quote = art ? null : cardWrap(p.body || "", 25, 9);
  if (!art && !(quote && quote.length)) return null;
  return storyCard({ prefix: `p${p.id}-story`, head: evUpper(u.display_name || u.username, 26), sub: userRole(u), art, quote,
    tag: p.video_url ? "WATCH ON LABS" : art ? "SEE IT ON LABS" : "READ IT ON LABS", handle: "@" + u.username,
    url: `${evHost(base)}/p/${p.id}`, accent: accentHex(u.accent) });
}
function profileStory(u, base) {
  if (!u || u.suspended) return null;
  const tiles = profileCardTiles(u).tiles.map((x) => x.file).slice(0, 4);
  return storyCard({ prefix: `u${u.id}-story`, head: evUpper(u.display_name || u.username, 26), sub: userRole(u), tiles,
    lead: cardWrap(u.bio || "", 40, 3), tag: "SEE MY WORK ON LABS", handle: "@" + u.username,
    url: evHost(base) + profileHref(u.username), accent: accentHex(u.accent) });
}
function listingStory(l, base) {
  const u = l && q.userById.get(l.seller_id);
  if (!u || u.suspended || l.status === "removed") return null;
  let first = null; try { first = JSON.parse(l.images || "[]")[0]; } catch {}
  const art = cardFile(first);
  if (!art) return null;
  const price = "$" + (l.price_cents / 100).toFixed(l.price_cents % 100 ? 2 : 0);
  return storyCard({ prefix: `m${l.id}-story`, head: evUpper(l.title, 26), sub: [price, l.status === "sold" ? "SOLD" : evUpper(l.condition || "", 16)].filter(Boolean).join(" · "),
    art, tag: l.status === "sold" ? "SEE IT ON LABS" : "SHOP ON LABS", handle: "@" + u.username,
    url: `${evHost(base)}/m/${l.id}`, accent: accentHex(u.accent) });
}
function trackStory(tr, base) {
  const u = tr && q.userById.get(tr.user_id);
  if (!u || u.suspended) return null;
  const art = cardFile(tr.artwork_url) || cardFile(u.avatar_url);
  const mm = tr.duration_ms ? ` · ${Math.floor(tr.duration_ms / 60000)}:${String(Math.round(tr.duration_ms / 1000) % 60).padStart(2, "0")}` : "";
  return storyCard({ prefix: `tr${tr.id}-story`, head: evUpper(tr.title, 26), sub: evUpper((u.display_name || u.username) + mm, 34),
    art, quote: art ? null : cardWrap(evUpper(tr.title, 60), 14, 5), cover: !art, tag: "LISTEN ON LABS", handle: "@" + u.username,
    url: evHost(base) + profileHref(u.username), accent: accentHex(u.accent) });
}

const storyLimit = rateLimit({ max: 60, windowMs: 60000 });
app.get("/p/:id/story.jpg", storyLimit, (req, res) => {
  const p = q.postById.get(Number(req.params.id) || 0);
  if (!p || !p.is_work) return res.status(404).end();
  evSendCard(res, postStory(p, baseUrl(req)), p.image_url || p.thumb_url || null);
});
app.get("/u/:username/story.jpg", storyLimit, (req, res) => {
  evSendCard(res, profileStory(userByLooseName(req.params.username), baseUrl(req)), null);
});
app.get("/m/:id/story.jpg", storyLimit, (req, res) => {
  evSendCard(res, listingStory(db.prepare(`SELECT * FROM listings WHERE id = ?`).get(Number(req.params.id) || 0), baseUrl(req)), null);
});
app.get("/tr/:id/story.jpg", storyLimit, (req, res) => {
  evSendCard(res, trackStory(db.prepare(`SELECT * FROM tracks WHERE id = ?`).get(Number(req.params.id) || 0), baseUrl(req)), null);
});
