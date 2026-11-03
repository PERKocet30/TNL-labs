// SELL WALK · WHAT WE LEARN v1.0 (2026-11-03): each screen of the sell walkthrough a seller
// reaches is a row — the step and the answers so far, never the words, price or photos — so
// the admin sees who lists (by type and department) and how far people get. Runs the real
// sellWalkLog() / sellWalkStats() (lifted from src/server/market/sell-walk.js) with the real
// taxonomy against a throwaway database.
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { mkdirSync, rmSync, readFileSync } from "node:fs";
const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const DATA = join(ROOT, "test/.tmp/sell-walk-learn");
rmSync(DATA, { recursive: true, force: true }); mkdirSync(DATA, { recursive: true });
process.env.TNL_DATA = DATA; process.env.TNL_NO_WATCH = "1";
let pass = 0, fail = 0;
const t = (n, ok) => { ok ? pass++ : fail++; console.log("  " + (ok ? "✓" : "✗") + "  " + n); };

const { db } = await import("../src/db.js");
const tax = readFileSync(join(ROOT, "src/server/market/taxonomy.js"), "utf8");
const { TAX_CATS } = new Function(tax.slice(0, tax.indexOf("/* Keep only the details")) + "\nreturn { TAX_CATS };")();
const src = readFileSync(join(ROOT, "src/server/market/sell-walk.js"), "utf8");
const routes = {};
const S = new Function("db", "app", "auth", "rateLimit", "TAX_CATS", "process", src + "\nreturn { sellWalkLog, sellWalkStats, sellWalkPrune, WALK_STEPS };")(db, { post: (p, ...h) => routes[p] = h.at(-1) }, null, () => null, TAX_CATS, { env: { TNL_NO_WATCH: "1" } });
const now = Date.now(), D = 86400000;
const u = {};
for (const n of ["ana", "ben", "cam"]) u[n] = Number(db.prepare(`INSERT INTO users (username, display_name, email, password_hash, created_at) VALUES (?,?,?,?,?)`).run(n, n, n + "@x.test", "x", now - 30 * D).lastInsertRowid);
const listing = (who, category, sellType) => db.prepare(`INSERT INTO listings (seller_id, title, price_cents, category, sell_type, status, kind, images, created_at, updated_at) VALUES (?,?,?,?,?,'active','item','[]',?,?)`).run(u[who], "x", 1000, category, sellType, now, now);
const W = (i) => "a1b2c3d4e5f6a7b" + i;
const log = (who, walk, step, extra = {}) => S.sellWalkLog(u[who], { walk, step, ...extra });

console.log("\nONE ROW PER STEP PER WALK — METADATA ONLY");
t("a step reached is kept, with the answers so far", log("ana", W(1), "what") && log("ana", W(1), "who", { category: "Tops" }) && db.prepare(`SELECT COUNT(*) n FROM sell_walk`).get().n === 2);
t("the department comes from the category, so it can't disagree", db.prepare(`SELECT dept FROM sell_walk WHERE step = 'who'`).get().dept === "Clothing");
t("the same step again is not a second row", !log("ana", W(1), "who", { category: "Tops" }) && db.prepare(`SELECT COUNT(*) n FROM sell_walk`).get().n === 2);
t("a made-up step or walk id is dropped", !log("ana", W(1), "title") && !log("ana", "nope!", "what") && !log("ana", "", "what"));
t("a seller type that isn't one of the three is kept as not said", (log("ana", W(1), "photos", { sellType: "wholesaler", category: "Tops" }), db.prepare(`SELECT sell_type FROM sell_walk WHERE step = 'photos'`).get().sell_type === ""));
t("nothing but the step and the answers is stored: no title, price, words or photos", db.prepare(`PRAGMA table_info(sell_walk)`).all().map((c) => c.name).join() === "id,user_id,walk,step,dept,category,sell_type,listing_id,created_at");
t("'listed' can't be sent by the app — only listing logs it", (() => { let out; routes["/api/market/walk"]({ user: { id: u.ana }, body: { walk: W(1), step: "listed" } }, { status: (c) => ({ json: (j) => out = { c, j } }), json: (j) => out = { c: 200, j } }); return out.c === 400; })());
t("…the route logs a real step", (() => { let out; routes["/api/market/walk"]({ user: { id: u.ana }, body: { walk: W(1), step: "words", category: "Tops", sellType: "brand" } }, { status: () => ({ json: () => {} }), json: (j) => out = j }); return out.ok === true; })());

console.log("\nWHAT THE ADMIN LEARNS");
db.exec(`DELETE FROM sell_walk`);
// ana: a brand, all the way to listed. ben: vintage, stops at photos. cam: an original, skips details, lists.
for (const s of ["what", "who", "photos", "words", "stock", "details", "price", "review"]) log("ana", W(2), s, { category: "Tops", sellType: s === "what" ? "" : "brand" });
S.sellWalkLog(u.ana, { walk: W(2), step: "listed", category: "Tops", sellType: "brand" }, 1);
for (const s of ["what", "who", "photos"]) log("ben", W(3), s, { category: "Outerwear", sellType: s === "what" ? "" : "vintage" });
for (const s of ["what", "who", "photos", "words", "details", "details:skip", "price", "review"]) log("cam", W(4), s, { category: "Original art", sellType: s === "what" ? "" : "custom" });
S.sellWalkLog(u.cam, { walk: W(4), step: "listed", category: "Original art", sellType: "custom" }, 2);
listing("ana", "Tops", "brand"); listing("ana", "Outerwear", "brand"); listing("cam", "Original art", "custom"); listing("ben", "Tops", "");
let L = S.sellWalkStats(30, now);
const step = (k) => L.walk.steps.find((s) => s.step === k);
t("three walks started, two listed, one skipped Details", L.walk.walks === 3 && L.walk.listed === 2 && L.walk.skippedDetails === 1);
t("the funnel: everyone reached Photos, two reached Words, two listed", step("what").n === 3 && step("photos").n === 3 && step("words").n === 2 && step("listed").n === 2);
t("…and by seller type: the brand listed, the vintage seller stopped at Photos, the original listed", step("listed").brand === 1 && step("photos").vintage === 1 && step("words").vintage === 0 && step("listed").custom === 1);
t("a walk's type is known from the moment it's answered — the 'what' step counts under it too", step("what").brand === 1 && step("what").vintage === 1 && step("what").custom === 1);
t("by type: brand 1 of 1 listed, vintage 0 of 1, one of one 1 of 1", JSON.stringify(L.walk.byType) === JSON.stringify([{ k: "brand", walks: 1, listed: 1 }, { k: "vintage", walks: 1, listed: 0 }, { k: "custom", walks: 1, listed: 1 }]));
t("who lists, by type: brands 1 seller · 2 listings, one of one 1 · 1, not said 1 · 1", JSON.stringify(L.whoLists.byType.sort((a, b) => a.k.localeCompare(b.k))) === JSON.stringify([{ k: "brand", sellers: 1, listings: 2 }, { k: "custom", sellers: 1, listings: 1 }, { k: "unsaid", sellers: 1, listings: 1 }]));
t("who lists, by department: Clothing 2 sellers · 3 listings, Art 1 · 1", JSON.stringify(L.whoLists.byDept) === JSON.stringify([{ k: "Clothing", sellers: 2, listings: 3 }, { k: "Art", sellers: 1, listings: 1 }]));
t("counts only: no name, title or id of anyone leaves", !/ana|ben|cam/.test(JSON.stringify(L)) && !JSON.stringify(L).includes("user_id"));
t("the window holds: a week back sees nothing of walks before it", S.sellWalkStats(7, now + 10 * D).walk.walks === 0);
db.prepare(`UPDATE sell_walk SET created_at = ? WHERE walk = ?`).run(now - 200 * D, W(3));
t("rows older than 180 days are pruned — a signal, not an archive", S.sellWalkPrune(now) === 3 && S.sellWalkStats(90, now).walk.walks === 2);

console.log("\nWIRED IN");
const app = readFileSync(join(ROOT, "src/app/market/sell-walk.js"), "utf8"), mk = readFileSync(join(ROOT, "src/server/admin/settings-payouts-market.js"), "utf8"), v4 = readFileSync(join(ROOT, "src/server/admin/v4.js"), "utf8"), adm = readFileSync(join(ROOT, "public/admin-app/5-sellers.js"), "utf8");
t("the app tells each step once per walk, with the answers so far and nothing else", app.includes('body:{walk:f._walk,step,dept:f._dept||"",category:f.category||"",sellType:f.sellType||""}') && app.includes("if(f._told.includes(step))return;"));
t("skipping Details is told too", app.includes('swTell(SELLFORM,"details:skip")'));
t("listing logs the last step on the server, with the listing's id", mk.includes('step: "listed", category: cat, sellType: body.sellType }, Number(info.lastInsertRowid))'));
t("Admin → Sellers (and the connector's `sellers`) carry it; the page shows who lists and the funnel", v4.includes("learned: sellWalkStats(") && adm.includes('card("Who\'s listing"') && adm.includes("funnelHTML(steps)"));

console.log(`\n  ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
