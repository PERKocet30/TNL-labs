
/* ================================================================
   LABS ALONGSIDE INSTAGRAM · v1.0 — 2026-10-09
   A shop link pasted in an Instagram DM (or a Story link sticker, a bio)
   used to preview as the generic LABS cover: Instagram's crawler doesn't
   run JavaScript, so it only ever saw the app shell's tags. /m/:id now
   hands over the same app with the listing's own preview — its photo,
   title, price and who's selling — swapped into the head.
================================================================ */
let SHELL_HTML = null;
function shellHtml() {
  if (SHELL_HTML === null) { try { SHELL_HTML = readFileSync(join(__dirname, "..", "public", "index.html"), "utf8"); } catch (e) { SHELL_HTML = ""; } }
  return SHELL_HTML;
}
function listingPage(req, res) {
  const file = join(__dirname, "..", "public", "index.html");
  const l = db.prepare(`SELECT * FROM listings WHERE id = ?`).get(Number(req.params.id) || 0);
  const u = l && q.userById.get(l.seller_id);
  const html = shellHtml();
  if (!l || !u || u.suspended || l.status === "removed" || !html) return res.sendFile(file);
  let first = null; try { first = JSON.parse(l.images || "[]")[0]; } catch {}
  const base = baseUrl(req), abs = (p) => (p ? (/^https?:/.test(p) ? p : base + p) : null);
  const price = "$" + (l.price_cents / 100).toFixed(l.price_cents % 100 ? 2 : 0);
  const title = `${l.title} — ${price}${l.status === "sold" ? " · Sold" : ""}`;
  const desc = [`Sold by @${u.username} on TNL LABS`, l.size, l.condition, (l.description || "").slice(0, 120)].filter(Boolean).join(" · ").slice(0, 200);
  const img = abs(first) || `${base}/og-cover-v3-2026-09-23.jpg`, url = `${base}/m/${l.id}`, e = lookEsc;
  const tags = `<title>${e(title)} — LABS</title>
<link rel="canonical" href="${e(url)}">
<meta property="og:type" content="product">
<meta property="og:site_name" content="TNL LABS">
<meta property="og:url" content="${e(url)}">
<meta property="og:title" content="${e(title)}">
<meta property="og:description" content="${e(desc)}">
<meta property="og:image" content="${e(img)}">
<meta property="og:image:secure_url" content="${e(img)}">
<meta property="og:image:alt" content="${e(l.title)}">
<meta property="product:price:amount" content="${(l.price_cents / 100).toFixed(2)}">
<meta property="product:price:currency" content="${e(l.currency || "USD")}">
<meta property="product:availability" content="${l.status === "sold" ? "out of stock" : "in stock"}">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="${e(title)}">
<meta name="twitter:description" content="${e(desc)}">
<meta name="twitter:image" content="${e(img)}">
<meta name="description" content="${e(desc)}">
`;
  // the shell's own preview tags out, the listing's in — the app itself is untouched
  const out = html
    .replace(/<title>[^<]*<\/title>\n?/, "")
    .replace(/<meta (?:property="og:[^"]*"|name="twitter:[^"]*"|name="description")[^>]*>\n?/g, "")
    .replace(/(<meta charset="utf-8" \/>\n?)/, `$1${tags}`);
  res.set("Cache-Control", "public, max-age=0, must-revalidate");
  res.type("html").send(out);
}
