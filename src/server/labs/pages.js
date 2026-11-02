/* ================================================================
   LAB PAGES v1.3 — 2026-10-27 (Fashion's line covers modeling and styling). v1.2 — 2026-10-15 (v1.2: each lab's link shows its own card, /l/:slug/card.jpg). v1.1 (links name the lab: /l/visual, /l/music; old /l/<id> links forward).
   v1.0 — 2026-10-15. "Every lab to have a share button with
   captions that describe what to do inside each lab… a brief explanation
   I can send to people."
   /l/:slug is what a lab's Share sends: the lab's name, what to do there
   (LAB_PITCH — the same lines head each lab in the app, LAB_PITCH in
   app/labs/places.js; test/lab-share.test.mjs checks they match), its
   #tags and a few pieces of recent work, and one button. "Join and
   step in" opens /?l=<slug>: members land in the lab, everyone else joins
   first and then lands in it. The link preview (Instagram DMs, texts)
   carries the same caption. Listed in /sitemap.xml (server/pages/seo.js).
================================================================ */
const LAB_PITCH = {
  hq: "Say hi, show what you're working on and find people to make things with.",
  pharmacy: "Upload your art: painting, drawing, design, photography, film and edits. Get seen and get feedback.",
  culture: "Upload your songs and beats, build playlists, and get ears on your works in progress.",
  fashion: "Post your designs, styling and modeling: fits, shoots, finished pieces and what's dropping next.",
  akatsuki: "Share your anime and manga art, panels and ideas, and talk about what you're watching.",
  casino: "Post what's happening: news, features, and promos for your next release.",
  tna: "Find gigs and open calls, talk rates and money, and show the sites and apps you build.",
};

/* Links name the lab (v1.1, 2026-10-15: "rename links to match the
   direction of the app"): /l/visual, /l/music… Ids never change — these
   are only the names in links. A link made before this, /l/<id>, is
   forwarded to the new one. LAB_SLUG in app/labs/places.js matches. */
const LAB_SLUG = { hq: "general", pharmacy: "visual", culture: "music", fashion: "fashion", akatsuki: "anime", casino: "news", tna: "business" };
const LAB_BY_SLUG = Object.fromEntries(Object.entries(LAB_SLUG).map(([id, s]) => [s, id]));

app.get("/l/:slug", (req, res) => {
  const want = String(req.params.slug || "").toLowerCase();
  if (!LAB_BY_SLUG[want] && LAB_SLUG[want]) return res.redirect(301, `/l/${LAB_SLUG[want]}`);   // an old /l/<id> link
  const id = LAB_BY_SLUG[want], P = PLACES[id], slug = want;
  if (!P || !LAB_PITCH[id]) return res.status(404).send(lookNotFound("This lab doesn't exist."));
  const e = lookEsc, base = baseUrl(req), name = LAB_NAME[id], url = `${base}/l/${slug}`;
  const abs = (p) => (p ? (/^https?:/.test(p) ? p : base + p) : null);
  /* recent finished work with a picture, from members in good standing */
  const work = db.prepare(`SELECT p.id, COALESCE(p.thumb_url, p.image_url) img FROM posts p JOIN users u ON u.id = p.author_id
    WHERE p.channel IN (${inList(P.channels)}) AND p.is_work = 1 AND COALESCE(u.suspended, 0) = 0 AND COALESCE(p.thumb_url, p.image_url) IS NOT NULL
    ORDER BY p.created_at DESC LIMIT 6`).all();
  const title = `// ${name} on LABS`, desc = LAB_PITCH[id];
  /* the preview: this lab's own card (v1.2), new whenever its words or latest work change */
  const img = `${base}/l/${slug}/card.jpg?v=${labCard(id, base).hash.slice(0, 8)}`;
  res.set("Cache-Control", "public, max-age=300");
  res.send(lookPage({
    title: e(title),
    head: `<link rel="canonical" href="${e(url)}">
<meta property="og:type" content="website">
<meta property="og:site_name" content="LABS">
<meta property="og:url" content="${e(url)}">
<meta property="og:title" content="${e(title)}">
<meta property="og:description" content="${e(desc)}">
<meta property="og:image" content="${e(img)}">
<meta property="og:image:secure_url" content="${e(img)}">
<meta property="og:image:width" content="1080">
<meta property="og:image:height" content="1080">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="${e(title)}">
<meta name="twitter:description" content="${e(desc)}">
<meta name="twitter:image" content="${e(img)}">
<meta name="description" content="${e(desc)}">
${ldJson({ "@context": "https://schema.org", "@type": "CollectionPage", name: title, url, description: desc, isPartOf: { "@type": "WebSite", name: "LABS", url: base } })}`,
    body: `${lookEyebrow("Lab")}<h1>// ${e(name)}</h1>
<p class="p" style="margin:0 0 14px">${e(desc)}</p>
<div class="chips" style="margin:0 0 16px">${GENRE_TAGS[id].map((t) => `<span class="chip">#${e(t)}</span>`).join("")}</div>
${work.length ? `<div style="display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:4px;margin:0 0 18px">${work.map((w) =>
  `<a href="/p/${w.id}" style="display:block;aspect-ratio:1/1;overflow:hidden;background:var(--line)"><img src="${e(abs(w.img))}" alt="" loading="lazy" style="width:100%;height:100%;object-fit:cover;display:block"></a>`).join("")}</div>` : ""}
<a class="btn block acc" href="/?l=${e(slug)}">Join and step into // ${e(name)}</a>
<p class="cap" style="margin-top:12px">Already a member? The same button opens the lab.</p>`,
  }));
});

/* A lab's link card (v1.2, 2026-10-15: "automatic covers for all lab share
   links too"). Square like the tournament's (Instagram's previews crop to
   a square): // VISUAL, what to do there, its #tags and "Join at
   …/l/visual", over the lab's latest work blurred (or TNL black). Built
   once per wording and picture and kept, with the event cards' kit
   (server/events/cards.js). */
function labCard(id, base) {
  const slug = LAB_SLUG[id], W = 1080, H = 1080, P = 80;
  const last = db.prepare(`SELECT p.image_url, p.thumb_url FROM posts p JOIN users u ON u.id = p.author_id
    WHERE p.channel IN (${inList(PLACES[id].channels)}) AND p.is_work = 1 AND COALESCE(u.suspended, 0) = 0 AND COALESCE(p.image_url, p.thumb_url) IS NOT NULL
    ORDER BY p.created_at DESC LIMIT 1`).get();
  let ground = last ? cardFile(last.image_url) || cardFile(last.thumb_url) : null;
  if (!ground && id === "culture") {   // Music's work is its songs: the newest cover
    const tr = db.prepare(`SELECT t.artwork_url FROM tracks t JOIN users u ON u.id = t.user_id WHERE COALESCE(u.suspended, 0) = 0 AND t.artwork_url IS NOT NULL ORDER BY t.id DESC LIMIT 1`).get();
    ground = tr ? cardFile(tr.artwork_url) : null;
  }
  /* what to do here, broken between words into lines of up to 30 characters */
  const lines = [];
  for (const w of cardClean(LAB_PITCH[id]).split(" ")) { const l = lines.length - 1;
    if (l >= 0 && (lines[l] + " " + w).length <= 30) lines[l] += " " + w; else lines.push(w); }
  const text = { name: "// " + LAB_NAME[id].toUpperCase(), lines: lines.slice(0, 6), tags: GENRE_TAGS[id].slice(0, 4).map((t) => "#" + t).join("  "),
    cta: `Join at ${evHost(base)}/l/${slug}` };
  const hash = createHash("sha1").update(JSON.stringify([EVC.version, "lab1", text, ground])).digest("hex").slice(0, 12);
  const make = (out, dir) => {
    const g = evGraph(W, H), t = evAss(dir, W, H), ink = SCK.ink, up = ffc(accentHex("lab"));
    if (ground) { const i = g.input(ground);
      g.f.push(`[${i}:v]scale=${W / 4}:${H / 4}:force_original_aspect_ratio=increase,crop=${W / 4}:${H / 4},boxblur=14:3,scale=${W}:${H},eq=brightness=-0.4:saturation=1.2,vignette=PI/4,setsar=1,format=rgb24[gnd]`);
      g.lay("gnd", 0, 0); } else g.box(SCK.shade, W, H, 0, 0);
    t.at("LABS", P, 120, 34, true, up);
    t.at(text.name, P, 176, 128, true, ink);
    text.lines.forEach((l, i) => t.at(l, P, 360 + i * 58, 44, false, ink));
    t.at(text.tags, P, 380 + text.lines.length * 58, 34, true, up);
    const cw = Math.min(W - 2 * P, Math.round(text.cta.length * 20 + 64));
    g.box(up, cw, 84, P, H - 290);
    t.at(text.cta, P + cw / 2, H - 248, 33, true, ffc(onAccent(accentHex("lab"))), 5);
    evMarkWhite(g, t, P, H - 150);
    g.filter(t.write());
    return g.out(out);
  };
  return { hash, prefix: `lab-${id}`, make };
}
app.get("/l/:slug/card.jpg", rateLimit({ max: 120, windowMs: 60000 }), (req, res) => {
  const id = LAB_BY_SLUG[String(req.params.slug || "").toLowerCase()];
  if (!id) return res.status(404).end();
  evSendCard(res, labCard(id, baseUrl(req)), "/labs-og.png");
});
