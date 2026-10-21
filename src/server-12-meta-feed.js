/* ================================================================
   THE PRODUCT FEED FOR INSTAGRAM v1.2 — 2026-10-21. "Link the app to Meta
   so I can tag my product on Instagram like Shopify." Meta's Commerce
   Manager reads a catalog from a web address on a schedule
   (Catalog → Data sources → Data feed → Scheduled feed):
     GET /feeds/meta.csv
   One row per product — per size/colour when it has them, grouped
   (item_group_id) the way Shopify sends them. Physical pieces only (never
   beats): everything an admin lists, plus any member's listing its seller
   switched on — "Show in the LABS Instagram shop" on the sell form
   (2026-10-20: "what if I want other people to be able to tag what they
   list"). It's theirs to turn on and off: POST /api/market/:id/ig-shop. Sold-out
   stays in as "out of stock" so a tagged post never breaks; removed
   leaves. Price, picture and link are the listing page's own (/m/:id), so
   Meta's checks that feed and page agree pass. test/meta-feed.test.mjs.
   v1.1 (2026-10-21): the shop's checkout URL. Tapping Checkout on a tagged
   post sends people to /checkout?products=labs-5:1,labs-7-ab12:1 (Meta's
   format: our feed ids, then quantity); that lands in the LABS bag with
   those pieces in it (?bag=, app-17-bag.js), where checkout is per seller.
   v1.2 (2026-10-21): no emoji in what Meta shows — its shop draws them as
   broken boxes ("Sashiko Hoodie🪡"). The listing in the app keeps them.
================================================================ */
const FEED_COLS = ["id", "item_group_id", "title", "description", "availability", "quantity_to_sell_on_facebook", "condition", "price", "sale_price",
  "link", "image_link", "additional_image_link", "brand", "size", "color", "google_product_category"];
const feedCell = (v) => `"${String(v ?? "").replace(/[\r\n\t]+/g, " ").replace(/"/g, '""').trim()}"`;
const feedPlain = (v) => String(v ?? "").replace(/[\p{Extended_Pictographic}\u{1F1E6}-\u{1F1FF}\u{1F3FB}-\u{1F3FF}\uFE0E\uFE0F\u200D\u20E3]/gu, "").replace(/[ \t]{2,}/g, " ").trim();
const feedMoney = (cents, cur) => `${(cents / 100).toFixed(2)} ${cur || "USD"}`;
/* Meta's own words for what a piece is in: the clothing ones, else Apparel & Accessories. */
const FEED_CAT = { Tops: "Apparel & Accessories > Clothing > Shirts & Tops", Bottoms: "Apparel & Accessories > Clothing > Pants",
  Outerwear: "Apparel & Accessories > Clothing > Outerwear", "Dresses & skirts": "Apparel & Accessories > Clothing > Dresses",
  Sets: "Apparel & Accessories > Clothing", Footwear: "Apparel & Accessories > Shoes", Headwear: "Apparel & Accessories > Clothing Accessories > Hats",
  Bags: "Apparel & Accessories > Handbags, Wallets & Cases", Jewellery: "Apparel & Accessories > Jewelry",
  "Art / Prints": "Home & Garden > Decor > Artwork > Posters, Prints, & Visual Artwork", "Original art": "Home & Garden > Decor > Artwork",
  Photography: "Home & Garden > Decor > Artwork > Posters, Prints, & Visual Artwork", "Sculpture & objects": "Home & Garden > Decor > Artwork > Sculptures & Statues" };

db.exec(`CREATE TABLE IF NOT EXISTS ig_shop (listing_id INTEGER PRIMARY KEY REFERENCES listings(id) ON DELETE CASCADE, created_at INTEGER NOT NULL)`);
function metaFeedRows(base) {
  const ls = db.prepare(`SELECT l.*, u.display_name AS seller_name, u.is_admin AS by_admin FROM listings l JOIN users u ON u.id = l.seller_id
    WHERE (u.is_admin = 1 OR l.id IN (SELECT listing_id FROM ig_shop)) AND COALESCE(u.suspended, 0) = 0 AND l.status IN ('active', 'sold') AND COALESCE(l.kind, 'physical') = 'physical'
    ORDER BY l.created_at DESC LIMIT 2000`).all();
  const rows = [];
  for (const l of ls) {
    let imgs = []; try { imgs = JSON.parse(l.images || "[]").filter((u) => typeof u === "string" && u.startsWith("/uploads/")); } catch {}
    if (!imgs.length) continue;   // Meta refuses a product without a picture
    const abs = (u) => base + u, link = `${base}/m/${l.id}`;
    const onSale = l.compare_cents && l.compare_cents > l.price_cents;
    const one = {
      title: (feedPlain(l.title) || "Untitled").slice(0, 200), description: (feedPlain(l.description) || feedPlain(l.title) || "Untitled").slice(0, 5000),
      condition: ["New", "Deadstock"].includes(l.condition) ? "new" : "used",
      price: feedMoney(onSale ? l.compare_cents : l.price_cents, l.currency), sale_price: onSale ? feedMoney(l.price_cents, l.currency) : "",
      link, image_link: abs(imgs[0]), additional_image_link: imgs.slice(1, 10).map(abs).join(","),
      brand: l.brand || (l.by_admin ? "LABS" : l.seller_name) || "LABS", google_product_category: FEED_CAT[l.category] || "Apparel & Accessories",
    };
    const vs = parseVariants(l);
    if (!vs.length) {
      const qty = l.status === "active" ? Math.max(0, l.quantity ?? 1) : 0;
      rows.push({ ...one, id: `labs-${l.id}`, item_group_id: "", availability: qty > 0 ? "in stock" : "out of stock", quantity_to_sell_on_facebook: qty,
        size: l.size || "", color: l.colour || "" });
    } else for (const v of vs) {
      const qty = l.status === "active" ? Math.max(0, v.qty || 0) : 0;
      rows.push({ ...one, id: `labs-${l.id}-${v.id}`, item_group_id: `labs-${l.id}`, availability: qty > 0 ? "in stock" : "out of stock",
        quantity_to_sell_on_facebook: qty, size: v.size || "", color: v.colour || l.colour || "" });
    }
  }
  return rows;
}

app.get("/feeds/meta.csv", rateLimit({ max: 60, windowMs: 60000 }), (req, res) => {
  const rows = metaFeedRows(baseUrl(req));
  res.set("Content-Type", "text/csv; charset=utf-8");
  res.set("Cache-Control", "public, max-age=300");
  res.send([FEED_COLS.join(","), ...rows.map((r) => FEED_COLS.map((c) => feedCell(r[c])).join(","))].join("\n") + "\n");
});

/* The seller's switch. Only physical pieces; only the seller (or an admin) can flip it. */
function igShopListing(req, res) {
  const l = db.prepare(`SELECT id, seller_id, kind FROM listings WHERE id = ?`).get(Number(req.params.id) || 0);
  if (!l) { res.status(404).json({ error: "No such listing." }); return null; }
  if (l.seller_id !== req.user.id && !req.user.is_admin) { res.status(403).json({ error: "Not your listing." }); return null; }
  return l;
}
app.get("/api/market/:id/ig-shop", auth, (req, res) => {
  const l = igShopListing(req, res); if (!l) return;
  res.json({ on: !!db.prepare(`SELECT 1 FROM ig_shop WHERE listing_id = ?`).get(l.id) });
});
app.post("/api/market/:id/ig-shop", auth, (req, res) => {
  const l = igShopListing(req, res); if (!l) return;
  if ((l.kind || "physical") !== "physical") return res.status(400).json({ error: "Only physical pieces can be tagged on Instagram." });
  if (req.body?.on) db.prepare(`INSERT OR IGNORE INTO ig_shop (listing_id, created_at) VALUES (?, ?)`).run(l.id, Date.now());
  else db.prepare(`DELETE FROM ig_shop WHERE listing_id = ?`).run(l.id);
  res.json({ on: !!req.body?.on });
});

/* The shop's checkout URL: Meta's ids → the bag. Only our own ids pass on. */
app.get("/checkout", (req, res) => {
  const ids = String(req.query.products || "").split(",").map((t) => t.split(":")[0].trim())
    .filter((t) => /^labs-\d+(-[a-z0-9]+)?$/i.test(t)).slice(0, 40);
  res.redirect(302, "/?bag=" + encodeURIComponent(ids.join(",")));
});
