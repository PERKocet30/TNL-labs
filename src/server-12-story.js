
/* ================================================================
   ANYTHING ON LABS, AS AN INSTAGRAM STORY · v2 — 2026-10-11 (bold: see SC). "Make it so I
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
const SC = { w: 1080, h: 1920, pad: 72, top: 250, by: 420, bh: 1000 };
/* v2 (2026-10-11, "this is pretty bland"): the work's own colours fill the
   Story — itself, blurred and dimmed, edge to edge — and the piece sits
   large on top with a shadow. Who made it (their photo and name), the
   song if it has one, how many in the series, then the tag in their
   colour, the mark and the link — all in white. A text post is its words
   on their colour; a profile, its four pieces over the first one, blurred. */
const SCK = { ink: ffc(PALETTE.dark.tx), ink2: ffc(PALETTE.dark.dim), shade: ffc(PALETTE.dark.bg) };

/* c: { prefix, head, sub, art?, bg?, avatar?, tiles?, quote?, cover?, lead?, music?, count?, tag, handle, url, accent } */
function storyCard(c) {
  const hash = createHash("sha1").update(JSON.stringify([7, c])).digest("hex").slice(0, 12);
  const make = (out, dir) => {
    const W = SC.w, H = SC.h, P = SC.pad, g = evGraph(W, H), t = evAss(dir, W, H), bw = W - 2 * P, by = SC.by, bh = SC.bh;
    const acc = ffc(c.accent), onAcc = ffc(onAccent(c.accent));
    /* the ground: the work itself, blurred edge to edge and dimmed — or their colour, or black */
    const ground = c.bg || c.art || (c.tiles || [])[0];
    if (ground) {
      const i = g.input(ground);
      g.f.push(`[${i}:v]scale=${W / 4}:${H / 4}:force_original_aspect_ratio=increase,crop=${W / 4}:${H / 4},boxblur=18:3,scale=${W}:${H},eq=brightness=-0.22:saturation=1.25,vignette=PI/4,setsar=1,format=rgb24[gnd]`);
      g.lay("gnd", 0, 0);
    } else g.box(c.cover || c.quote ? acc : SCK.shade, W, H, 0, 0);
    /* white on the work; on their colour, whatever reads on it */
    const onCol = !ground && (c.cover || c.quote), ink = onCol ? onAcc : SCK.ink, ink2 = onCol || ground ? ink : SCK.ink2;   // grey doesn't read on bright work
    /* who: their photo, their name, what they do */
    let hx = P;
    if (c.avatar) {
      const i = g.input(c.avatar);
      g.f.push(`[${i}:v]scale=96:96:force_original_aspect_ratio=increase,crop=96:96,setsar=1,format=rgb24[av]`);
      g.lay("av", P, SC.top); hx = P + 120;
    }
    t.at(c.head, hx, SC.top + (c.avatar ? 0 : 0), 64, true, ink);
    if (c.sub) t.at(c.sub, hx, SC.top + 76, 28, false, ink2);
    let below = by + bh;
    if (c.art) {
      /* the piece, whole and as large as the frame allows, on a soft shadow */
      const i = g.input(c.art);
      g.f.push(`[${i}:v]scale=${bw}:${bh}:force_original_aspect_ratio=decrease,setsar=1,format=rgb24,split=2[art][sh0]`,
        `[sh0]drawbox=c=black:t=fill,format=rgba,colorchannelmixer=aa=0.45,boxblur=12:2[sh]`);
      g.lay("sh", `${P}+(${bw}-w)/2+10`, `${by}+(${bh}-h)/2+18`);
      g.lay("art", `${P}+(${bw}-w)/2`, `${by}+(${bh}-h)/2`);
      if (c.count > 1) { g.box(`${SCK.shade}@0.6`, 96, 52, W - P - 112, by + 16); t.at(`1/${c.count}`, W - P - 64, by + 42, 26, true, SCK.ink, 5); }
    } else if (c.tiles) {
      (c.lead || []).forEach((l, k) => t.at(l, P, by + k * 50, 38, false, SCK.ink));
      const gap = 12, gy = by + (c.lead || []).length * 50 + (c.lead && c.lead.length ? 36 : 0);
      const rows = Math.max(1, Math.ceil(c.tiles.length / 2)), s = Math.min(Math.floor((bw - gap) / 2), Math.floor((by + bh - gy - (rows - 1) * gap) / rows));
      c.tiles.forEach((f, k) => {
        const x = P + (k % 2) * (s + gap), y = gy + Math.floor(k / 2) * (s + gap), i = g.input(f);
        g.f.push(`[${i}:v]scale=${s}:${s}:force_original_aspect_ratio=increase,crop=${s}:${s},setsar=1,format=rgb24[t${k}]`);
        g.lay(`t${k}`, x, y);
      });
      if (!c.tiles.length) g.box(`${SCK.shade}@0.4`, bw, s, P, gy);
    } else {
      /* words only: big, on their colour */
      const fs = c.cover ? 104 : 76, lh = c.cover ? 116 : 92, q = c.quote || [];
      q.forEach((l, k) => t.at(l, P, by + bh / 2 - (q.length * lh) / 2 + k * lh, fs, true, onAcc));
    }
    /* the song, if there is one — the way Instagram credits audio */
    if (c.music) { t.at("MUSIC", P, below + 30, 24, true, ink2); t.at(c.music, P + 112, below + 26, 32, true, ink); below += 64; }
    const tw = Math.round(c.tag.length * 25 + 72), ty = below + 40;
    g.box(onCol ? SCK.shade : acc, tw, 84, P, ty);
    t.at(c.tag, P + tw / 2, ty + 42, 38, true, onCol ? SCK.ink : onAcc, 5);
    if (c.handle) t.at(c.handle, W - P, ty + 42, 40, true, ink, 6);
    /* the mark — white on the work, its own black where that reads better */
    if (existsSync(CARD_MARK)) {
      const m = g.input(CARD_MARK), white = ink === SCK.ink;
      g.f.push(`[${m}:v]scale=56:56,${white ? "negate," : ""}format=rgba,colorkey=${white ? "0x000000" : "0xFFFFFF"}:0.3:0.2[mk2]`);
      g.lay("mk2", P, H - 200);
    }
    t.at("LABS ®", P + 70, H - 172, 34, true, ink, 4);
    t.at(c.url, W - P, H - 172, 28, false, ink2, 6);
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
  const tr = p.audio_track_id && db.prepare(`SELECT t.title, u.username FROM tracks t JOIN users u ON u.id = t.user_id WHERE t.id = ?`).get(p.audio_track_id);
  let count = 0; try { count = JSON.parse(p.images || "[]").length; } catch {}
  return storyCard({ prefix: `p${p.id}-story`, head: evUpper(u.display_name || u.username, 22), sub: userRole(u), art, quote, avatar: cardFile(u.avatar_url),
    music: tr ? evUpper(tr.title, 30) + "  ·  @" + tr.username : null, count,
    tag: p.video_url ? "WATCH ON LABS" : art ? "SEE IT ON LABS" : "READ IT ON LABS", handle: "@" + u.username,
    url: `${evHost(base)}/p/${p.id}`, accent: accentHex(u.accent) });
}
function profileStory(u, base) {
  if (!u || u.suspended) return null;
  const tiles = profileCardTiles(u).tiles.map((x) => x.file).slice(0, 4);
  return storyCard({ prefix: `u${u.id}-story`, head: evUpper(u.display_name || u.username, 22), sub: userRole(u), tiles, avatar: cardFile(u.avatar_url),
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
  return storyCard({ prefix: `m${l.id}-story`, head: evUpper(l.title, 22), avatar: cardFile(u.avatar_url), sub: [price, l.status === "sold" ? "SOLD" : evUpper(l.condition || "", 16)].filter(Boolean).join(" · "),
    art, tag: l.status === "sold" ? "SEE IT ON LABS" : "SHOP ON LABS", handle: "@" + u.username,
    url: `${evHost(base)}/m/${l.id}`, accent: accentHex(u.accent) });
}
function trackStory(tr, base) {
  const u = tr && q.userById.get(tr.user_id);
  if (!u || u.suspended) return null;
  const art = cardFile(tr.artwork_url) || cardFile(u.avatar_url);
  const mm = tr.duration_ms ? ` · ${Math.floor(tr.duration_ms / 60000)}:${String(Math.round(tr.duration_ms / 1000) % 60).padStart(2, "0")}` : "";
  return storyCard({ prefix: `tr${tr.id}-story`, head: evUpper(tr.title, 22), avatar: cardFile(u.avatar_url), sub: evUpper((u.display_name || u.username) + mm, 34),
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
