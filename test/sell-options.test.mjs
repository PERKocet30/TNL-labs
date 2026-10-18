// SELL OPTIONS v1.0 — 2026-10-18 ("the market lister needs to match Shopify
// standards"): sizes × colours make the rows (stock kept as options change),
// never-sold rows left at 0 aren't saved, and the seller's own compare-at
// ("was") price shows only while it's above the price.
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { mkdirSync, rmSync, readFileSync } from "node:fs";
const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const TMP = join(ROOT, "test", ".tmp", "sell-options");
rmSync(TMP, { recursive: true, force: true }); mkdirSync(TMP, { recursive: true });
process.env.TNL_DATA = TMP;
let pass = 0, fail = 0;
const t = (n, ok) => { ok ? pass++ : fail++; console.log("  " + (ok ? "✓" : "✗") + "  " + n); };
const read = (f) => readFileSync(join(ROOT, f), "utf8");
const pv = read("src/app-14-sell-variants.js");
const V = new Function("money", "esc", "sellSizes", pv.slice(0, pv.indexOf("function pvHTML(")) + pv.slice(pv.indexOf("function sellCompareHTML("), pv.indexOf("function pvRefreshEarn(")) +
  "\nreturn {pvSync, pvOut, pvTotal, sellCompareHint, sellKeepCents};")((c) => "$" + (c / 100).toFixed(2), (s) => String(s), (f) => f.sizes || ["XS", "S", "M", "L", "XL", "XXL"]);

console.log("\nOPTIONS → ROWS");
let f = { optSizes: ["L", "S", "M"], optColours: [] };
V.pvSync(f);
t("sizes make one row each, in size order", f.variants.map((v) => v.size).join() === "S,M,L" && f.variants.every((v) => v.qty === 1));
f.variants[1].qty = 4; f.optColours = ["Black", "Washed blue"]; V.pvSync(f);
t("adding colours makes every size × colour", f.variants.length === 6 && f.variants.map((v) => v.size + " " + v.colour).join() === "S Black,S Washed blue,M Black,M Washed blue,L Black,L Washed blue");
f = { variants: [{ id: "a1", size: "M", colour: "Black", qty: 4 }, { id: "a2", size: "S", colour: "Black", qty: 0 }] };
V.pvSync(f);
t("a saved listing opens with its options worked out", f.optSizes.join() === "S,M" && f.optColours.join() === "Black");
t("…keeping each row's stock and id", f.variants.find((v) => v.size === "M").qty === 4 && f.variants.find((v) => v.size === "M").id === "a1");
f.optColours.push("white"); V.pvSync(f);
t("a new colour doesn't disturb stock already set (case doesn't matter)", f.variants.find((v) => v.size === "M" && v.colour === "Black").qty === 4 && f.variants.length === 4);
f.optSizes = ["M"]; V.pvSync(f);
t("removing a size drops its rows", f.variants.every((v) => v.size === "M"));
f = { optSizes: ["One size"], optColours: [] }; V.pvSync(f);
t("a size of your own works too", f.variants.length === 1 && f.variants[0].size === "One size");
f = { optSizes: ["10", "8.5", "12"], optColours: [], sizes: ["5", "6", "7", "8", "8.5", "9", "9.5", "10", "10.5", "11", "12", "13"] }; V.pvSync(f);
t("shoe sizes sort as shoe sizes", f.variants.map((v) => v.size).join() === "8.5,10,12");
f = { optSizes: [], optColours: [] }; V.pvSync(f);
t("no options, no rows (and it says what to do)", f.variants.length === 0 && V.pvTotal(f.variants) === "Pick a size or add a colour");

console.log("\nWHAT GETS SAVED");
const out = V.pvOut([{ id: "", size: "S", colour: "", qty: 0 }, { id: "x", size: "M", colour: "", qty: 0 }, { id: "", size: "L", colour: "", qty: 2 }, { id: "", size: "", colour: "", qty: 3 }]);
t("a never-sold row left at 0 isn't saved; a sold-out one stays (crossed out)", out.map((v) => v.size).join() === "M,L");

console.log("\nCOMPARE-AT PRICE");
t("above the price: shows the sale", /<s>\$80\.00<\/s> <b>\$65\.00<\/b> — 19% off/.test(V.sellCompareHint({ price: "65", compareAt: "80" })));
t("not above the price: says why it won't show", /has to be above the price/.test(V.sellCompareHint({ price: "65", compareAt: "60" })));
t("empty: nothing", V.sellCompareHint({ price: "65" }) === "");

const { db } = await import(join(ROOT, "src/db.js"));
const stock = read("src/server-06-market-stock.js");
const S = new Function("db", "notify", stock + "\nreturn {setCompare, priceDrop, setSellType};")(db, () => {});
const now = Date.now();
const uid = Number(db.prepare(`INSERT INTO users (username,display_name,email,role,password_hash,created_at) VALUES ('s','s','s@x','Model','h',?)`).run(now).lastInsertRowid);
const lid = Number(db.prepare(`INSERT INTO listings (seller_id,title,price_cents,images,created_at,updated_at) VALUES (?,?,?,?,?,?)`).run(uid, "Tee", 6500, "[]", now, now).lastInsertRowid);
const row = () => db.prepare(`SELECT * FROM listings WHERE id=?`).get(lid);
S.setCompare(lid, "80", 6500);
t("saved in cents, and it's the listing's \"was\" price", row().compare_cents === 8000 && S.priceDrop(row()) === 8000);
S.setCompare(lid, "50", 6500);
t("a compare-at under the price is cleared", row().compare_cents === null && S.priceDrop(row()) === null);
S.setCompare(lid, "80", 6500); S.setCompare(lid, undefined, 6500);
t("an edit that doesn't mention it leaves it alone", row().compare_cents === 8000);
db.prepare(`UPDATE listings SET price_cents=9000 WHERE id=?`).run(lid);
t("raise the price past it and the sale stops showing", S.priceDrop(row()) === null);
S.setCompare(lid, "0", 9000);
t("0 clears it", row().compare_cents === null);

console.log("\nCATEGORIES AND THEIR DETAILS");
const tax = read("src/server-06-market-taxonomy.js");
const X = new Function("db", tax + "\nreturn {TAX_CATS, TAXONOMY_META, cleanSpecs, setSpecs, specRows, SIZE_SETS};")(db);
const old = ["Tops", "Bottoms", "Outerwear", "Footwear", "Accessories", "Headwear", "Bags", "Jewellery", "Art / Prints", "Other"];
t("every category listings already use is still there (values never change)", old.every((c) => X.TAX_CATS.has(c)));
t("new ones: Dresses & skirts, Sets, Original art, Photography, Sculpture & objects", ["Dresses & skirts", "Sets", "Original art", "Photography", "Sculpture & objects"].every((c) => X.TAX_CATS.has(c)));
t("grouped into Clothing, Footwear, Accessories, Art, Other", X.TAXONOMY_META.departments.map((d) => d.name).join() === "Clothing,Footwear,Accessories,Art,Other");
t("\"Art / Prints\" reads as Prints", X.TAXONOMY_META.categories["Art / Prints"].label === "Prints");
t("size buttons follow the category: shoes, waists, print sizes, rings", X.TAXONOMY_META.categories.Footwear.sizes.includes("10.5") && X.TAXONOMY_META.categories.Bottoms.sizes.includes("32")
  && X.TAXONOMY_META.categories["Art / Prints"].sizes.includes("18×24") && X.TAXONOMY_META.categories.Jewellery.sizes.includes("7") && !X.TAXONOMY_META.categories["Original art"].sizes.length);
t("every detail a category asks for is defined", [...X.TAX_CATS.values()].every((c) => c.specs.every((k) => X.TAXONOMY_META.specs[k])));
const sp = X.cleanSpecs({ fit: "Oversized", material: " 100% cotton ", ptp: "22 in", medium: "Oil", signed: true, junk: "x" }, "Tops");
t("only the category's own details are kept, trimmed", JSON.stringify(sp) === JSON.stringify({ fit: "Oversized", material: "100% cotton", ptp: "22 in" }));
t("a pick that isn't on the list is dropped", !X.cleanSpecs({ fit: "Gigantic" }, "Tops").fit);
t("yes/no details save as Yes, or not at all", JSON.stringify(X.cleanSpecs({ signed: true, framed: false, edition: "Limited edition", edsize: "25" }, "Art / Prints")) === JSON.stringify({ edition: "Limited edition", edsize: "25", signed: "Yes" }));
t("long text is cut to 80", X.cleanSpecs({ material: "x".repeat(200) }, "Bags").material.length === 80);
db.prepare(`UPDATE listings SET category='Original art' WHERE id=?`).run(lid);
X.setSpecs(lid, { medium: "Acrylic", dims: "24 × 36 in", year: "2026", framed: true }, "Original art");
t("the listing page gets them as plain rows, in the category's order", JSON.stringify(X.specRows(row())) === JSON.stringify([["Medium", "Acrylic"], ["Dimensions", "24 × 36 in"], ["Year made", "2026"], ["Framed", "Yes"]]));
X.setSpecs(lid, undefined, "Original art");
t("an edit that doesn't send them leaves them alone", X.specRows(row()).length === 4);
const meta = read("src/server-06-settings-payouts-market.js");
t("the server's categories ARE the taxonomy's, and the app is sent it", meta.includes("const CATEGORIES = [...TAX_CATS.keys()];") && meta.includes("taxonomy: TAXONOMY_META"));
t("create and edit save the details for the listing's category", meta.includes("setSpecs(Number(info.lastInsertRowid), body.specs, cat)") && meta.includes("setSpecs(l.id, req.body?.specs, next.category)"));

console.log("\nWHO'S SELLING");
const l2 = Number(db.prepare(`INSERT INTO listings (seller_id,title,price_cents,images,quantity,variants,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?)`)
  .run(uid, "Hoodie", 6500, "[]", 6, JSON.stringify([{ id: "a", size: "S", qty: 3 }, { id: "b", size: "M", qty: 3 }]), now, now).lastInsertRowid);
const r2 = () => db.prepare(`SELECT * FROM listings WHERE id=?`).get(l2);
S.setSellType(l2, "brand");
t("a brand keeps its sizes and stock", r2().sell_type === "brand" && r2().quantity === 6 && JSON.parse(r2().variants).length === 2);
S.setSellType(l2, "vintage");
t("vintage is saved as vintage", r2().sell_type === "vintage");
S.setSellType(l2, "custom");
t("one of one: stock held at 1, no sizes to pick — the \"1 of 1\" tag can't lie", r2().sell_type === "custom" && r2().quantity === 1 && r2().variants === "[]");
S.setSellType(l2, undefined);
t("an edit that doesn't say leaves it alone", r2().sell_type === "custom");
S.setSellType(l2, "dropshipper");
t("anything else is saved as not said", r2().sell_type === "");
const pvSrc = read("src/app-14-sell-variants.js");
let SELLFORM;
const TT = new Function("stashSell", "render", "ME", "box", pvSrc.slice(pvSrc.indexOf("const SELLTYPES="), pvSrc.indexOf("/* Read the form back")).replace(/SELLFORM/g, "box.f") + "\nreturn {sellTypeSet, sellTypeTag};")(() => {}, () => {}, { displayName: "TNL NYC" }, (SELLFORM = { f: { size: "M", colour: "Black", quantity: 3, condition: "Good", acceptsOffers: true } }));
TT.sellTypeSet("brand");
t("choosing My brand: sizes on (from the size already typed), New, offers off, the brand filled in", SELLFORM.f.hasVariants && SELLFORM.f.variants[0].size === "M" && SELLFORM.f.variants[0].qty === 3 && SELLFORM.f.condition === "New" && SELLFORM.f.acceptsOffers === false && SELLFORM.f.brand === "TNL NYC");
TT.sellTypeSet("vintage");
t("switching to Vintage: one piece, condition back to Good, offers left as they were", !SELLFORM.f.hasVariants && SELLFORM.f.quantity === 1 && SELLFORM.f.size === "M" && SELLFORM.f.condition === "Good" && SELLFORM.f.acceptsOffers === false);
TT.sellTypeSet("custom");
t("switching to One of one: New, no brand", SELLFORM.f.condition === "New" && SELLFORM.f.brand === "");
t("tags: Vintage, 1 of 1, nothing for a brand (its name shows instead)", TT.sellTypeTag({ sellType: "vintage" }) === "Vintage" && TT.sellTypeTag({ sellType: "custom" }) === "1 of 1" && TT.sellTypeTag({ sellType: "brand" }) === "");

console.log("\nWIRED IN");
t("create and edit both save who's selling; the Market filters by it", read("src/server-06-settings-payouts-market.js").includes("setSellType(Number(info.lastInsertRowid), body.sellType)") && read("src/server-06-settings-payouts-market.js").includes("setSellType(l.id, req.body?.sellType)") && read("src/server-06-settings-payouts-market.js").includes("where.push(`l.sell_type = ?`)"));
t("a brand's stock can be New", read("src/server-06-settings-payouts-market.js").includes('const CONDITIONS = ["New",'));
const srv = read("src/server-06-settings-payouts-market.js"), mk = read("src/app-17-market.js");
t("create and edit both save it (not on sounds)", srv.includes("if (!isLoop) { setCompare(Number(info.lastInsertRowid), body.compareAt, cents);") && srv.includes("if (!isLoop) { setCompare(l.id, req.body?.compareAt, next.price_cents);"));
t("the listing says when it's the seller's own sale", srv.includes("compareAt: r.compare_cents || null, sale: r.compare_cents > r.price_cents") && read("src/app-13-tracks-player.js").includes('l.sale?"Sale":"Price drop"'));
t("an edit sends it, and the form opens with it", mk.includes("compareAt:isLoop?undefined:(body.compareAt||0)") && mk.includes('compareAt:l.compareAt?(l.compareAt/100).toFixed(2):""'));
t("publishing sends the rows, without never-sold zeros or the option lists", mk.includes("pvOut(SELLFORM.variants)") && mk.includes("delete body.optSizes;delete body.optColours;"));
console.log(`\n  ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
