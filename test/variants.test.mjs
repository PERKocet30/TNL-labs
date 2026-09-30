// Sizes and colours on one listing (2026-09-30): each has its own stock,
// the buyer must pick one, the right one goes down, the listing closes at
// zero, and a sold-out size can't be bought.
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { mkdirSync, rmSync, readFileSync } from "node:fs";
import { randomBytes } from "node:crypto";
const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const TMP = join(ROOT, "test", ".tmp", "variants");
rmSync(TMP, { recursive: true, force: true });
mkdirSync(TMP, { recursive: true });
process.env.TNL_DATA = TMP;
const { db } = await import(ROOT + "/src/db.js");
let pass = 0, fail = 0;
const t = (n, ok) => { ok ? pass++ : fail++; console.log("  " + (ok ? "✓" : "✗") + "  " + n); };

const part = readFileSync(join(ROOT, "src/server-06-market-stock.js"), "utf8");
const S = new Function("db", "randomBytes", part + "\nreturn {variantLabel,parseVariants,stockOf,cleanVariants,pickVariant,takeStock,SIZE_MATCH};")(db, randomBytes);

const now = Date.now();
const seller = Number(db.prepare(`INSERT INTO users (username,display_name,email,role,password_hash,email_verified,created_at) VALUES ('s','S','s@x.com','Model','h',1,?)`).run(now).lastInsertRowid);
const L = (variants, qty = 1) => Number(db.prepare(`INSERT INTO listings (seller_id,title,price_cents,images,quantity,variants,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?)`)
  .run(seller, "Tee", 5000, '["/u/a.jpg"]', qty, JSON.stringify(variants), now, now).lastInsertRowid);
const get = (id) => db.prepare(`SELECT * FROM listings WHERE id=?`).get(id);

console.log("\nCLEANING WHAT THE SELLER SENDS");
const c = S.cleanVariants([{ size: " M ", colour: "Black", qty: 3 }, { size: "m", colour: "black", qty: 9 }, { size: "", colour: "", qty: 4 },
  { size: "L", qty: -2 }, { id: "keepme", size: "XL", qty: 9999 }, "junk"]);
t("blank rows and repeats dropped, sizes trimmed", c.length === 3 && c[0].size === "M");
t("stock clamped to 0–500", c[1].qty === 0 && c[2].qty === 500);
t("an existing id is kept, new rows get one", c[2].id === "keepme" && c[0].id && c[0].id !== c[1].id);
t("not a list → none", S.cleanVariants("S,M").length === 0 && S.cleanVariants(null).length === 0);
t("label reads like a shop", S.variantLabel({ size: "M", colour: "Black" }) === "M / Black" && S.variantLabel({ size: "M", colour: "" }) === "M");

console.log("\nPICKING");
const vs = [{ id: "s1", size: "S", colour: "", qty: 0 }, { id: "m1", size: "M", colour: "", qty: 2 }, { id: "l1", size: "L", colour: "", qty: 1 }];
const lid = L(vs, 3);
t("no pick on a listing with sizes → asked to pick", S.pickVariant(get(lid), "").error === "Pick a size first");
t("a made-up id → asked to pick", S.pickVariant(get(lid), "nope").error === "Pick a size first");
t("a sold-out size → refused, by name", S.pickVariant(get(lid), "s1").error === "S is sold out");
t("an in-stock size → that one", S.pickVariant(get(lid), "m1").id === "m1");
const plain = L([], 2);
t("a listing without sizes needs no pick", S.pickVariant(get(plain), undefined) === null);

console.log("\nSTOCK GOES DOWN ON THE RIGHT ONE");
t("buy an M", S.takeStock(lid, "m1") === true);
let row = get(lid), v = S.parseVariants(row);
t("M 2 → 1, the others untouched", v.find((x) => x.id === "m1").qty === 1 && v.find((x) => x.id === "l1").qty === 1);
t("total left follows", row.quantity === 2 && row.status === "active");
t("buy the last L", S.takeStock(lid, "l1") === true);
t("a sold-out size can't be taken (oversold is reported)", S.takeStock(lid, "l1") === false && S.takeStock(lid, "s1") === false);
t("buy the last M", S.takeStock(lid, "m1") === true);
row = get(lid);
t("all sizes gone → listing sold", row.quantity === 0 && row.status === "sold" && row.sold_at > 0);
t("nothing more comes out of a sold listing", S.takeStock(lid, "m1") === false);
t("plain listing: 2 → 1 → sold", S.takeStock(plain) && get(plain).quantity === 1 && S.takeStock(plain) && get(plain).status === "sold");

console.log("\nSEARCH BY SIZE");
const lx = L([{ id: "a", size: "XL", colour: "", qty: 1 }, { id: "b", size: "XS", colour: "", qty: 0 }], 1);
const find = (size) => db.prepare(`SELECT l.id FROM listings l WHERE l.status='active' AND ${S.SIZE_MATCH}`).all(size, size).map((r) => r.id);
t("finds a listing by one of its sizes", find("XL").includes(lx));
t("a sold-out size doesn't match", !find("XS").includes(lx));

console.log("\nWIRED INTO THE SERVER");
const rt = readFileSync(join(ROOT, "src/server.runtime.js"), "utf8");
const buy = rt.slice(rt.indexOf('app.post("/api/market/:id/buy"'), rt.indexOf('app.get("/api/market/checkout/done"'));
t("buy checks the pick before any order is written", buy.indexOf("pickVariant") > 0 && buy.indexOf("pickVariant") < buy.indexOf("INSERT INTO orders"));
t("the order remembers the size", /variant_id, variant/.test(buy));
t("checkout names the size", buy.includes("${l.title} — ${vLabel}"));
const settle = rt.slice(rt.indexOf("function settlePaidOrder"), rt.indexOf("async function reconcileOrders"));
t("a paid order takes stock from the size it was for", settle.includes("takeStock(l.id, order.variant_id)"));
t("no stock maths left anywhere else", (rt.match(/quantity \?\? 1\) - 1/g) || []).length === 1);

console.log(`\n  ${pass} passed, ${fail} failed`);
