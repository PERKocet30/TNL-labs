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
const V = new Function("money", "esc", pv.slice(0, pv.indexOf("function pvHTML(")) + pv.slice(pv.indexOf("function sellCompareHTML("), pv.indexOf("function pvRefreshEarn(")) +
  "\nreturn {pvSync, pvOut, pvTotal, sellCompareHint, sellKeepCents};")((c) => "$" + (c / 100).toFixed(2), (s) => String(s));

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
const S = new Function("db", "notify", stock + "\nreturn {setCompare, priceDrop};")(db, () => {});
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

console.log("\nWIRED IN");
const srv = read("src/server-06-settings-payouts-market.js"), mk = read("src/app-17-market.js");
t("create and edit both save it (not on sounds)", srv.includes("if (!isLoop) setCompare(Number(info.lastInsertRowid), body.compareAt, cents)") && srv.includes("if (!isLoop) setCompare(l.id, req.body?.compareAt, next.price_cents)"));
t("the listing says when it's the seller's own sale", srv.includes("compareAt: r.compare_cents || null, sale: r.compare_cents > r.price_cents") && read("src/app-13-tracks-player.js").includes('l.sale?"Sale":"Price drop"'));
t("an edit sends it, and the form opens with it", mk.includes("compareAt:isLoop?undefined:(body.compareAt||0)") && mk.includes('compareAt:l.compareAt?(l.compareAt/100).toFixed(2):""'));
t("publishing sends the rows, without never-sold zeros or the option lists", mk.includes("pvOut(SELLFORM.variants)") && mk.includes("delete body.optSizes;delete body.optColours;"));
console.log(`\n  ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
