/* ================================================================
   THE PRODUCT FEED FOR INSTAGRAM v1.0 — 2026-10-20. "Link the app to Meta
   so I can tag my product on Instagram like Shopify." Meta's Commerce
   Manager reads a catalog from a web address on a schedule
   (Catalog → Data sources → Data feed → Scheduled feed):
     GET /feeds/meta.csv
   One row per product — per size/colour when it has them, grouped
   (item_group_id) the way Shopify sends them. Only what LABS itself sells:
   physical listings by an admin (Meta wants the account that tags to be
   the seller), never other members' listings and never beats. Sold-out
   stays in as "out of stock" so a tagged post never breaks; removed
   leaves. Price, picture and link are the listing page's own (/m/:id), so
   Meta's checks that feed and page agree pass. test/meta-feed.test.mjs.
================================================================ */
const FEED_COLS = ["id", "item_group_id", "title", "description", "availability", "quantity_to_sell_on_facebook", "condition", "price", "sale_price",
  "link", "image_link", "additional_image_link", "brand", "size", "color", "google_product_category"];
const feedCell = (v) => `"${String(v ?? "").replace(/[\r\n\t]+/g, " ").replace(/"/g, '""').trim()}"`;
const feedMoney = (cents, cur) => `${(cents / 100).toFixed(2)} ${cur || "USD"}`;
/* Meta's own words for what a piece is in: the clothing ones, else Apparel & Accessories. */
const FEED_CAT = { Tops: "Apparel & Accessories > Clothing > Shirts & Tops", Bottoms: "Apparel & Accessories > Clothing > Pants",
  Outerwear: "Apparel & Accessories > Clothing > Outerwear", "Dresses & skirts": "Apparel & Accessories > Clothing > Dresses",
  Sets: "Apparel & Accessories > Clothing", Footwear: "Apparel & Accessories > Shoes", Headwear: "Apparel & Accessories > Clothing Accessories > Hats",
  Bags: "Apparel & Accessories > Handbags, Wallets & Cases", Jewellery: "Apparel & Accessories > Jewelry",
  "Art / Prints": "Home & Garden > Decor > Artwork > Posters, Prints, & Visual Artwork", "Original art": "Home & Garden > Decor > Artwork",
  Photography: "Home & Garden > Decor > Artwork > Posters, Prints, & Visual Artwork", "Sculpture & objects": "Home & Garden > Decor > Artwork > Sculptures & Statues" };

function metaFeedRows(base) {
  const ls = db.prepare(`SELECT l.* FROM listings l JOIN users u ON u.id = l.seller_id
    WHERE u.is_admin = 1 AND COALESCE(u.suspended, 0) = 0 AND l.status IN ('active', 'sold') AND COALESCE(l.kind, 'physical') = 'physical'
    ORDER BY l.created_at DESC LIMIT 2000`).all();
  const rows = [];
  for (const l of ls) {
    let imgs = []; try { imgs = JSON.parse(l.images || "[]").filter((u) => typeof u === "string" && u.startsWith("/uploads/")); } catch {}
    if (!imgs.length) continue;   // Meta refuses a product without a picture
    const abs = (u) => base + u, link = `${base}/m/${l.id}`;
    const onSale = l.compare_cents && l.compare_cents > l.price_cents;
    const one = {
      title: l.title.slice(0, 200), description: (l.description || l.title).slice(0, 5000),
      condition: ["New", "Deadstock"].includes(l.condition) ? "new" : "used",
      price: feedMoney(onSale ? l.compare_cents : l.price_cents, l.currency), sale_price: onSale ? feedMoney(l.price_cents, l.currency) : "",
      link, image_link: abs(imgs[0]), additional_image_link: imgs.slice(1, 10).map(abs).join(","),
      brand: l.brand || "LABS", google_product_category: FEED_CAT[l.category] || "Apparel & Accessories",
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
