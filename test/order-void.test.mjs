// ORDER VOID v1.0 — 2026-10-18 ("these sales never happen, only testing"):
// an admin marks a test order; it leaves both people's lists and every number,
// its rep is taken back through the log, and nobody else can do it.
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { mkdirSync, rmSync, readFileSync } from "node:fs";
const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const TMP = join(ROOT, "test", ".tmp", "order-void");
rmSync(TMP, { recursive: true, force: true }); mkdirSync(TMP, { recursive: true });
process.env.TNL_DATA = TMP;
const { db, awardRep, revokeRep } = await import(join(ROOT, "src/db.js"));
let pass = 0, fail = 0;
const t = (n, ok) => { ok ? pass++ : fail++; console.log("  " + (ok ? "✓" : "✗") + "  " + n); };
const read = (f) => readFileSync(join(ROOT, "src", f), "utf8");
const now = Date.now();
const U = (n) => Number(db.prepare(`INSERT INTO users (username,display_name,email,role,password_hash,email_verified,rep,created_at) VALUES (?,?,?,?,?,1,0,?)`).run(n, n, n + "@x", "Model", "h", now).lastInsertRowid);
const seller = U("jorge"), buyer = U("jorge2");
const lid = Number(db.prepare(`INSERT INTO listings (seller_id,title,price_cents,images,created_at,updated_at) VALUES (?,?,?,?,?,?)`).run(seller, "Iron man suit", 100, "[]", now, now).lastInsertRowid);
const O = (status, ref = "cs_x", cart = null) => Number(db.prepare(`INSERT INTO orders (listing_id,buyer_id,seller_id,amount_cents,shipping_cents,status,payment_ref,cart_id,created_at,updated_at) VALUES (?,?,?,100,0,?,?,?,?,?)`).run(lid, buyer, seller, status, ref, cart, now, now).lastInsertRowid);
const a = O("complete"); awardRep(seller, "sale_made", a); awardRep(seller, "delivery_confirmed", a);
db.prepare(`INSERT INTO reviews (order_id,seller_id,buyer_id,stars,body,created_at) VALUES (?,?,?,5,'great',?)`).run(a, seller, buyer, now);
const b1 = O("shipped"); db.prepare(`UPDATE orders SET cart_id=? WHERE id=?`).run(b1, b1); const b2 = O("shipped", "cs_x", b1);
awardRep(seller, "sale_made", b1); awardRep(seller, "sale_made", b2);
const keep = O("paid"); awardRep(seller, "sale_made", keep);
const rep = () => db.prepare(`SELECT rep FROM users WHERE id=?`).get(seller).rep;
const before = rep();

const routes = {};
const src = read("server-07-orders-void.js");
new Function("app", "auth", "admin", "db", "revokeRep", src)({ post: (p, ...h) => { routes[p] = h; } }, "AUTH", "ADMIN", db, revokeRep);
const route = routes["/api/admin/orders/:id/void"];
const call = async (id) => { let out; await route.at(-1)({ params: { id: String(id) } }, { json: (x) => { out = x; }, status: () => ({ json: (x) => { out = x; } }) }); return out; };

console.log("\nADMIN ONLY");
t("the route needs a signed-in admin (checked on the server)", route[0] === "AUTH" && route[1] === "ADMIN");

console.log("\nVOIDING A TEST ORDER");
let r = await call(a);
const st = (id) => db.prepare(`SELECT status FROM orders WHERE id=?`).get(id).status;
t("the order is marked a test", r.ok && st(a) === "void");
t("its rep is taken back — through the log, not erased", rep() === before - 25 && db.prepare(`SELECT COUNT(*) n FROM rep_events WHERE source_id=? AND amount<0`).get(a).n === 2);
t("its review goes too", !db.prepare(`SELECT 1 FROM reviews WHERE order_id=?`).get(a));
r = await call(a);
t("voiding twice takes nothing more", rep() === before - 25);
r = await call(b2);
t("a bag goes together", st(b1) === "void" && st(b2) === "void" && r.voided === 2 && rep() === before - 55);
t("other orders are untouched", st(keep) === "paid");
t("says when a real payment was involved (refund it in Stripe)", r.wasPaid === true);
t("an unknown order is a 404", (await call(9999)).error === "no order");

console.log("\nOFF THE LISTS AND NUMBERS");
const os = read("server-07-orders-sharing.js");
t("both people's order lists leave it out", (os.match(/AND o\.status != 'void'/g) || []).length === 2);
t("it can't be marked shipped or received", (os.match(/if \(o\.status === "void"\) return res\.status\(400\)/g) || []).length === 2);
t("sales numbers only ever count paid / shipped / delivered", read("server-07-cart.js").includes("const paid = `status IN ('paid','shipped','complete')`"));
const adm = readFileSync(join(ROOT, "public/admin-app/5-orders.js"), "utf8");
t("admin: Test order… on each order, with a filter for voided ones", adm.includes("data-voidorder") && adm.includes('void: "Test (voided)"') && readFileSync(join(ROOT, "public/admin.html"), "utf8").includes("5-orders.js?v=4.0"));
console.log(`\n  ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
