/* ================================================================
   LAB PAGES v1.0 — 2026-10-15. "Every lab to have a share button with
   captions that describe what to do inside each lab… a brief explanation
   I can send to people."
   /l/:id is what a lab's Share sends: the lab's name, what to do there
   (LAB_PITCH — the same lines head each lab in the app, LAB_PITCH in
   app-11-places.js; test/lab-share.test.mjs checks they match), its
   #tags and a few pieces of recent work, and one button. "Join and
   step in" opens /?l=<id>: members land in the lab, everyone else joins
   first and then lands in it. The link preview (Instagram DMs, texts)
   carries the same caption. Listed in /sitemap.xml (server-12-seo.js).
================================================================ */
const LAB_PITCH = {
  hq: "The main floor. Say hi, show what you're working on and find people to make things with.",
  pharmacy: "Upload your art: painting, drawing, design, photography, film and edits. Get seen and get feedback.",
  culture: "Upload your songs and beats, build playlists, and get ears on your works in progress.",
  fashion: "Post your designs and drops: concepts, finished pieces and what's releasing next.",
  akatsuki: "Share your anime and manga art, panels and ideas, and talk about what you're watching.",
  casino: "Post what's happening in the scene: news, features, and promos for your next release.",
  tna: "Find gigs and open calls, talk rates and money, and build the sites and apps the culture runs on.",
};

app.get("/l/:id", (req, res) => {
  const id = String(req.params.id || ""), P = PLACES[id];
  if (!P || !LAB_PITCH[id]) return res.status(404).send(lookNotFound("This lab doesn't exist."));
  const e = lookEsc, base = baseUrl(req), name = LAB_NAME[id], url = `${base}/l/${id}`;
  const abs = (p) => (p ? (/^https?:/.test(p) ? p : base + p) : null);
  /* recent finished work with a picture, from members in good standing */
  const work = db.prepare(`SELECT p.id, COALESCE(p.thumb_url, p.image_url) img FROM posts p JOIN users u ON u.id = p.author_id
    WHERE p.channel IN (${inList(P.channels)}) AND p.is_work = 1 AND COALESCE(u.suspended, 0) = 0 AND COALESCE(p.thumb_url, p.image_url) IS NOT NULL
    ORDER BY p.created_at DESC LIMIT 6`).all();
  const title = `// ${name} on TNL LABS`, desc = LAB_PITCH[id];
  const img = abs(work[0] && work[0].img) || `${base}/og-cover-v3-2026-09-23.jpg`;
  res.set("Cache-Control", "public, max-age=300");
  res.send(lookPage({
    title: e(title),
    head: `<link rel="canonical" href="${e(url)}">
<meta property="og:type" content="website">
<meta property="og:site_name" content="TNL LABS">
<meta property="og:url" content="${e(url)}">
<meta property="og:title" content="${e(title)}">
<meta property="og:description" content="${e(desc)}">
<meta property="og:image" content="${e(img)}">
<meta property="og:image:secure_url" content="${e(img)}">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="${e(title)}">
<meta name="twitter:description" content="${e(desc)}">
<meta name="twitter:image" content="${e(img)}">
<meta name="description" content="${e(desc)}">
${ldJson({ "@context": "https://schema.org", "@type": "CollectionPage", name: title, url, description: desc, isPartOf: { "@type": "WebSite", name: "TNL LABS", url: base } })}`,
    body: `${lookEyebrow("Lab")}<h1>// ${e(name)}</h1>
<p class="p" style="margin:0 0 14px">${e(desc)}</p>
<div class="chips" style="margin:0 0 16px">${GENRE_TAGS[id].map((t) => `<span class="chip">#${e(t)}</span>`).join("")}</div>
${work.length ? `<div style="display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:4px;margin:0 0 18px">${work.map((w) =>
  `<a href="/p/${w.id}" style="display:block;aspect-ratio:1/1;overflow:hidden;background:var(--line)"><img src="${e(abs(w.img))}" alt="" loading="lazy" style="width:100%;height:100%;object-fit:cover;display:block"></a>`).join("")}</div>` : ""}
<a class="btn block acc" href="/?l=${e(id)}">Join and step into // ${e(name)}</a>
<p class="cap" style="margin-top:12px">Already a member? The same button opens the lab.</p>`,
  }));
});
