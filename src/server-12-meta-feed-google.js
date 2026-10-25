/* ================================================================
   THE PRODUCT FEED FOR GOOGLE v1.0 — 2026-10-25. "How we better
   integrate google" → free listings in Google Shopping. Merchant Center
   reads a file from a web address once a day
   (Products → Add products → Add from a file → link):
     GET /feeds/google.csv
   The same pieces as the Instagram shop feed (server-12-meta-feed.js):
   LABS's own physical pieces, plus a member's piece only when its
   seller switched it on. Same rows, same prices, pictures and links as the
   listing page, so Google's check that feed and page agree passes.
   What Google asks for on top:
     - clothing sold in the US needs gender and age group; we say
       unisex / adult (the sell form doesn't ask, and most pieces are);
     - handmade and one-off pieces have no barcode → identifier_exists no;
     - no quantity column (that one is Meta's own).
   test/google-feed.test.mjs.
================================================================ */
const GFEED_COLS = ["id", "item_group_id", "title", "description", "availability", "condition", "price", "sale_price",
  "link", "image_link", "additional_image_link", "brand", "size", "color", "gender", "age_group", "identifier_exists", "google_product_category"];
app.get("/feeds/google.csv", rateLimit({ max: 60, windowMs: 60000 }), (req, res) => {
  const rows = metaFeedRows(baseUrl(req)).map((r) => {
    const wear = /^Apparel & Accessories/.test(r.google_product_category);
    return { ...r, gender: wear ? "unisex" : "", age_group: wear ? "adult" : "", identifier_exists: "no" };
  });
  res.set("Content-Type", "text/csv; charset=utf-8");
  res.set("Cache-Control", "public, max-age=300");
  res.send([GFEED_COLS.join(","), ...rows.map((r) => GFEED_COLS.map((c) => feedCell(r[c])).join(","))].join("\n") + "\n");
});
