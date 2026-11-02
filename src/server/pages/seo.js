/* ================================================================
   SEARCH · v1.1 — 2026-10-15 (each lab's /l/ page is listed).
   v1.0 — 2026-10-13 ("Optimize the app SEO").
   - /sitemap.xml: every public page, so Google can find them — the
     tournament, members with published work, published work, songs,
     listings for sale, the policy pages. Never a suspended member, chat,
     a removed or sold-out thing, or anything behind a sign-in.
   - ldJson(): structured data (schema.org JSON-LD) for the public pages,
     so results can show what a page is — an artist, a piece, a song, a
     product with its price, an event with its dates. The public pages
     call it (server-07 /p, server-10 /u and /e, server-12 /s and /m).
   robots.txt (public/) points here and still turns AI crawlers away.
================================================================ */
/* JSON-LD inside <script>: "<" escaped so no text can close the tag. */
function ldJson(obj) {
  return `<script type="application/ld+json">${JSON.stringify(obj).replace(/</g, "\\u003c")}</script>`;
}
const isoDay = (t) => new Date(t).toISOString().slice(0, 10);
const ldPerson = (u, base) => ({ "@type": "Person", name: u.display_name || u.displayName || u.username, alternateName: "@" + u.username,
  url: `${base}${profileHref(u.username)}` });

app.get("/sitemap.xml", (req, res) => {
  const base = baseUrl(req), urls = [];
  const add = (loc, lastmod, priority) => urls.push({ loc: base + loc, lastmod: lastmod ? isoDay(lastmod) : null, priority });
  add("/", Date.now(), "1.0");
  for (const e of db.prepare(`SELECT slug, updated_at FROM events WHERE published = 1 ORDER BY id DESC`).all()) add(`/e/${e.slug}`, e.updated_at, "0.9");
  for (const id of Object.keys(LAB_PITCH)) add(`/l/${LAB_SLUG[id]}`, null, "0.8");   // each lab's page (server/labs/pages.js, 2026-10-15)
  for (const u of db.prepare(`SELECT u.username, MAX(p.created_at) t FROM users u JOIN posts p ON p.author_id = u.id AND p.is_work = 1
      WHERE COALESCE(u.suspended, 0) = 0 GROUP BY u.id ORDER BY t DESC LIMIT 5000`).all()) add(profileHref(u.username), u.t, "0.8");
  for (const p of db.prepare(`SELECT p.id, COALESCE(p.edited_at, p.created_at) t FROM posts p JOIN users u ON u.id = p.author_id
      WHERE p.is_work = 1 AND COALESCE(u.suspended, 0) = 0 ORDER BY p.id DESC LIMIT 20000`).all()) add(`/p/${p.id}`, p.t, "0.6");
  for (const t of db.prepare(`SELECT t.id, t.created_at FROM tracks t JOIN users u ON u.id = t.user_id
      WHERE COALESCE(u.suspended, 0) = 0 ORDER BY t.id DESC LIMIT 10000`).all()) add(`/s/${t.id}`, t.created_at, "0.6");
  for (const l of db.prepare(`SELECT l.id, l.updated_at FROM listings l JOIN users u ON u.id = l.seller_id
      WHERE l.status = 'active' AND COALESCE(u.suspended, 0) = 0 ORDER BY l.id DESC LIMIT 10000`).all()) add(`/m/${l.id}`, l.updated_at, "0.7");
  for (const page of ["/policies", "/terms", "/privacy", "/contact"]) add(page, null, "0.2");
  const x = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;");
  res.set({ "Content-Type": "application/xml; charset=utf-8", "Cache-Control": "public, max-age=3600" });
  res.send(`<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n`
    + urls.map((u) => `<url><loc>${x(u.loc)}</loc>${u.lastmod ? `<lastmod>${u.lastmod}</lastmod>` : ""}<priority>${u.priority}</priority></url>`).join("\n")
    + `\n</urlset>\n`);
});
