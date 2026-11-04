/* ── MARKET TAXONOMY v1.1 — 2026-11-03 (v1.0 2026-10-18) ──────────────
   "Professional options to categorize what people are selling so you can
   give them better options to describe and list what they're selling."
   v1.1 — "make the questions broad and narrower the more information you
   collect": nine broad departments, then the kind, and each kind says what
   to ask next — its size buttons (or none), what its second option is
   called (colour, finish, design…), and its details. Jewellery, paper and
   print, physical music and home goods have places of their own now; Other
   no longer offers clothing sizes. Old values are kept (never change).
   One source for both sides: the categories (grouped into departments),
   the size buttons each category offers, and the details (specs) a seller
   can fill in — fit and measurements for clothes, shoe sizes, metal and
   ring sizes, medium, edition and framing for art. The app gets it from
   /api/market/meta (taxonomy); the server only keeps specs it knows.
   Category VALUES never change once listings use them ("Art / Prints"
   stays the stored value — "Prints" is only its label). */
const SPECS = {
  fit: { label: "Fit", choice: ["Oversized", "Relaxed", "Regular", "Slim", "Cropped"] },
  bfit: { label: "Fit", choice: ["Baggy", "Relaxed", "Straight", "Slim", "Skinny", "Flared"] },
  material: { label: "Material", ph: "100% cotton, 400gsm" },
  ptp: { label: "Pit to pit", ph: "22 in" },
  length: { label: "Length", ph: "28 in" },
  waist: { label: "Waist", ph: "32 in" },
  inseam: { label: "Inseam", ph: "30 in" },
  care: { label: "Care", ph: "Cold wash, hang dry" },
  shoesys: { label: "Size system", choice: ["US men's", "US women's", "EU", "UK"] },
  box: { label: "Original box", yes: 1 },
  hatfit: { label: "Style", choice: ["Fitted", "Snapback", "Strapback", "Beanie", "Bucket", "Other"] },
  dims: { label: "Dimensions", ph: "14 × 10 × 4 in" },
  metal: { label: "Metal", choice: ["Sterling silver", "Solid gold", "Gold-plated", "Stainless steel", "Brass", "Other"] },
  stones: { label: "Stones", ph: "Optional" },
  chain: { label: "Chain length", ph: "20 in" },
  medium: { label: "Medium", choice: ["Oil", "Acrylic", "Watercolour", "Ink", "Spray paint", "Mixed media", "Digital", "Other"] },
  paper: { label: "Paper", ph: "Archival matte, 230gsm" },
  edition: { label: "Edition", choice: ["Original", "Limited edition", "Open edition"] },
  edsize: { label: "Edition size", ph: "25" },
  signed: { label: "Signed", yes: 1 },
  framed: { label: "Framed", yes: 1 },
  year: { label: "Year made", ph: "2026" },
  blen: { label: "Length", ph: "7 in" },
  finish: { label: "Finish", choice: ["Matte", "Gloss", "Holographic", "Die-cut", "Enamel", "Other"] },
  pages: { label: "Pages", ph: "32" },
  tracks: { label: "Tracks", ph: "12" },
  scent: { label: "Scent", ph: "Optional" },
};
const SIZE_SETS = {
  letters: ["XS", "S", "M", "L", "XL", "XXL"],
  waist: ["26", "28", "29", "30", "31", "32", "33", "34", "36", "38", "40"],
  shoes: ["5", "6", "7", "8", "8.5", "9", "9.5", "10", "10.5", "11", "12", "13"],
  hats: ["One size", "S/M", "L/XL", "7", "7 1/4", "7 1/2", "7 3/4"],
  rings: ["5", "6", "7", "8", "9", "10", "11"],
  prints: ["5×7", "8×10", "11×14", "12×16", "18×24", "24×36"],
  formats: ['12" vinyl', '7" vinyl', "Cassette", "CD"],
  none: [],
};
/* what a kind's second option is called, and what its size buttons are called (default: colour · Sizes) */
const OPT_WORD = { finish: ["finish", "Sizes"], design: ["design", "Sizes"], format: ["colour", "Formats"], none: ["colour", "Sizes"] };
// [department, hint, [[value, size set, specs, label?, option word?], …]]
const TAXONOMY = [
  ["Clothing", "Tops, bottoms, outerwear, sets", [
    ["Tops", "letters", ["fit", "material", "ptp", "length", "care"]],
    ["Bottoms", "waist", ["bfit", "material", "waist", "inseam", "care"]],
    ["Outerwear", "letters", ["fit", "material", "ptp", "length", "care"]],
    ["Dresses & skirts", "letters", ["fit", "material", "length", "care"]],
    ["Sets", "letters", ["fit", "material", "care"]]]],
  ["Footwear", "Sneakers, boots, sandals", [["Footwear", "shoes", ["shoesys", "material", "box"]]]],
  ["Accessories", "Hats, bags, belts, eyewear", [
    ["Headwear", "hats", ["hatfit", "material"]],
    ["Bags", "none", ["dims", "material"]],
    ["Accessories", "none", ["material", "dims"], "Other accessories"]]],
  ["Jewellery", "Rings, chains, earrings, bracelets", [
    ["Rings", "rings", ["metal", "stones"], null, "finish"],
    ["Necklaces", "none", ["metal", "stones", "chain"], null, "finish"],
    ["Earrings", "none", ["metal", "stones"], null, "finish"],
    ["Bracelets", "none", ["metal", "stones", "blen"], null, "finish"],
    ["Jewellery", "none", ["metal", "stones", "chain"], "Other jewellery", "finish"]]],
  ["Art", "Originals, prints, photography, objects", [
    ["Art / Prints", "prints", ["paper", "edition", "edsize", "signed", "framed"], "Prints", "finish"],
    ["Original art", "none", ["medium", "dims", "year", "signed", "framed"], null, "finish"],
    ["Photography", "prints", ["paper", "edition", "edsize", "signed", "framed"], null, "finish"],
    ["Sculpture & objects", "none", ["material", "dims", "year"], null, "finish"]]],
  ["Paper & print", "Stickers, pins, zines, posters", [
    ["Stickers & pins", "none", ["finish", "dims"], null, "design"],
    ["Zines & books", "none", ["pages", "dims", "edition", "edsize", "signed"], null, "finish"],
    ["Posters", "prints", ["paper", "signed"], null, "finish"]]],
  ["Music", "Vinyl, tapes, CDs", [["Physical music", "formats", ["tracks", "year", "signed"], "Vinyl, tape & CD", "format"]]],
  ["Home & objects", "Candles, ceramics, things for a room", [
    ["Home goods", "none", ["material", "dims", "scent"]],
    ["Collectibles & toys", "none", ["material", "dims", "year"]]]],
  ["Other", "Something that isn't on this list", [["Other", "none", ["material", "dims"]]]],
];
const TAX_CATS = new Map(TAXONOMY.flatMap(([dept, , cats]) => cats.map(([v, set, specs, label, opt]) => [v, { dept, set, specs, label: label || v, opt: OPT_WORD[opt || "none"] }])));
const TAXONOMY_META = {
  departments: TAXONOMY.map(([dept, hint, cats]) => ({ name: dept, hint, categories: cats.map(([v]) => v) })),
  categories: Object.fromEntries([...TAX_CATS].map(([v, c]) => [v, { label: c.label, sizes: SIZE_SETS[c.set], specs: c.specs, opt: c.opt[0], sizeWord: c.opt[1] }])),
  specs: SPECS,
};

/* Keep only the details this category has, as short plain strings. */
function cleanSpecs(raw, category) {
  const c = TAX_CATS.get(category), out = {};
  if (!c || !raw || typeof raw !== "object") return out;
  for (const k of c.specs) {
    const d = SPECS[k], v = raw[k];
    if (v === undefined || v === null || v === "" || v === false) continue;
    if (d.yes) { if (v === true || v === "Yes") out[k] = "Yes"; continue; }
    const s = String(v).trim().slice(0, 80);
    if (!s || (d.choice && !d.choice.includes(s))) continue;
    out[k] = s;
  }
  return out;
}
function setSpecs(id, raw, category) {
  if (raw === undefined) return;
  db.prepare(`UPDATE listings SET specs=? WHERE id=?`).run(JSON.stringify(cleanSpecs(raw, category)), id);
}
/* What a buyer reads: [["Fit","Oversized"],["Signed","Yes"]…], in the category's order. */
function specRows(r) {
  let s = {};
  try { s = JSON.parse(r.specs || "{}") || {}; } catch {}
  const c = TAX_CATS.get(r.category);
  return c ? c.specs.filter((k) => s[k]).map((k) => [SPECS[k].label, s[k]]) : [];
}
