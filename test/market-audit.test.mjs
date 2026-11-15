// The Market's holes from the code audit (2026-11-15), closed before the first sale: an accepted offer is the price
// for one piece and never more than the listing asks now; a suspended seller sells nothing; a listing a mod took
// down stays down; a listing's photos are LABS uploads; a price that isn't a number is refused.
// Runs the real server with no Stripe key (orders are written, no money moves).
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { mkdirSync, rmSync } from "node:fs";
import { spawn } from "node:child_process";
const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const DATA = join(ROOT, "test/.tmp/market-audit");
rmSync(DATA, { recursive: true, force: true }); mkdirSync(join(DATA, "uploads"), { recursive: true });
process.env.TNL_DATA = DATA;
let pass = 0, fail = 0;
const t = (n, ok) => { ok ? pass++ : fail++; console.log("  " + (ok ? "✓" : "✗") + "  " + n); };
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

const { db } = await import("../src/db.js");
const now = Date.now();
const mk = (u, admin = 0) => { const id = Number(db.prepare(`INSERT INTO users (username, display_name, email, password_hash, created_at, email_verified, is_admin, avatar_url) VALUES (?,?,?,?,?,1,?,'/uploads/a.jpg')`).run(u, u, u + "@x.test", "x", now - 30 * 86400000, admin).lastInsertRowid);
  db.prepare(`INSERT INTO sessions (token, user_id, created_at) VALUES (?,?,?)`).run("tok-" + u, id, now); return id; };
const boss = mk("boss", 1), seller = mk("seller"), bad = mk("bad"), ann = mk("ann"), bo = mk("bo"), cy = mk("cy");
const L = (who, title, price, qty = 5) => Number(db.prepare(`INSERT INTO listings (seller_id,title,price_cents,shipping_cents,images,quantity,variants,kind,accepts_offers,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,1,?,?)`)
  .run(who, title, price, 500, '["/uploads/a.jpg"]', qty, "[]", "physical", now, now).lastInsertRowid);
const tee = L(seller, "Tee", 8000), cap = L(seller, "Cap", 3000), fake = L(bad, "Fake", 9000), gone = L(seller, "Gone", 2000);
const offer = (lid, who, cents) => db.prepare(`INSERT INTO offers (listing_id, buyer_id, amount_cents, status, created_at) VALUES (?,?,?,'accepted',?)`).run(lid, who, cents, now);
offer(tee, ann, 5000); offer(tee, bo, 5000); offer(tee, cy, 5000);
db.close();

const PORT = 19240 + (process.pid % 30), B = `http://127.0.0.1:${PORT}`;
const srv = spawn(process.execPath, ["--experimental-sqlite", "src/server.js"], { cwd: ROOT, stdio: ["ignore", "pipe", "pipe"], env: { ...process.env,
  PORT: String(PORT), TNL_DATA: DATA, STRIPE_SECRET_KEY: "", RESEND_API_KEY: "", TNL_NO_WATCH: "1", NUDGE_TICK_MS: "3600000" } });
let log = ""; srv.stdout.on("data", (d) => log += d); srv.stderr.on("data", (d) => log += d);
for (let i = 0; i < 100 && !/listening/.test(log); i++) await wait(100);
const call = async (who, path, body, method) => { const r = await fetch(B + path, { method: method || (body ? "POST" : "GET"), headers: { "Content-Type": "application/json", ...(who ? { Authorization: "Bearer tok-" + who } : {}) }, body: body ? JSON.stringify(body) : undefined }); return { s: r.status, j: await r.json().catch(() => ({})) }; };
const { DatabaseSync } = await import("node:sqlite");
const sql = (fn) => { const r = new DatabaseSync(join(DATA, "tnl.db")); try { return fn(r); } finally { r.close(); } };
const lastOrder = (who) => sql((r) => r.prepare(`SELECT * FROM orders WHERE buyer_id = ? ORDER BY id DESC LIMIT 1`).get(who));

try {
  console.log("\nAN ACCEPTED OFFER");
  const b1 = await call("ann", `/api/market/${tee}/buy`, {});
  t("the offer is the price for that piece ($50 on an $80 tee)", b1.s === 200 && lastOrder(ann).amount_cents === 5000);
  const again = await call("ann", `/api/market/${tee}/buy`, {});
  t("the offer buys one piece: the next one is at the listing's price", again.s === 200 && lastOrder(ann).amount_cents === 8000 && sql((r) => r.prepare(`SELECT status FROM offers WHERE listing_id = ? AND buyer_id = ?`).get(tee, ann)).status === "used");
  sql((r) => r.prepare(`UPDATE listings SET price_cents = 4000 WHERE id = ?`).run(tee));
  const b2 = await call("bo", `/api/market/${tee}/buy`, {});
  t("the seller lowers the price under the offer: the buyer pays the lower price, never more than it asks", b2.s === 200 && lastOrder(bo).amount_cents === 4000);
  sql((r) => { r.prepare(`UPDATE listings SET price_cents = 8000 WHERE id = ?`).run(tee); r.prepare(`DELETE FROM orders`).run(); });
  const bag = await call("cy", "/api/cart/checkout", { items: [{ listingId: tee }, { listingId: cap }] });
  const rows = sql((r) => r.prepare(`SELECT listing_id, amount_cents FROM orders WHERE buyer_id = ? ORDER BY id`).all(cy));
  t("in a bag the offer prices its own piece only", bag.s === 200 && rows.length === 2 && rows.find((x) => x.listing_id === tee).amount_cents === 5000 && rows.find((x) => x.listing_id === cap).amount_cents === 3000);

  console.log("\nA SUSPENDED SELLER");
  t("before: their piece is in the Market", (await call(null, "/api/market")).j.listings.some((l) => l.id === fake));
  await call("boss", `/api/admin/users/${bad}/suspend`, { on: true });
  sql((r) => r.prepare(`UPDATE users SET suspended = 1 WHERE id = ?`).run(bad));
  t("suspended: their pieces leave the Market", !(await call(null, "/api/market")).j.listings.some((l) => l.id === fake));
  const sb = await call("ann", `/api/market/${fake}/buy`, {});
  t("…and can't be bought by a link to them", sb.s === 409 && !sql((r) => r.prepare(`SELECT 1 FROM orders WHERE listing_id = ?`).get(fake)));
  t("…nor from a bag", (await call("ann", "/api/cart/checkout", { items: [{ listingId: fake }] })).s === 409);

  console.log("\nA LISTING A MOD TOOK DOWN");
  const down = await call("boss", `/api/admin/listings/${gone}`, null, "DELETE");
  t("the admin takes it down", down.s === 200 && sql((r) => r.prepare(`SELECT status, taken_down FROM listings WHERE id = ?`).get(gone)).taken_down === 1);
  const up = await call("seller", `/api/market/${gone}`, { status: "active" }, "PATCH");
  const fake2 = sql((r) => Number(r.prepare(`INSERT INTO listings (seller_id,title,price_cents,shipping_cents,images,quantity,variants,kind,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?)`).run(seller, "Also gone", 2000, 0, '["/uploads/a.jpg"]', 1, "[]", "physical", Date.now(), Date.now()).lastInsertRowid));
  await call("boss", `/api/market/${fake2}`, null, "DELETE");
  await call("seller", `/api/market/${fake2}`, { status: "active" }, "PATCH");
  t("…whichever way the admin removed it", sql((r) => r.prepare(`SELECT status, taken_down FROM listings WHERE id = ?`).get(fake2)).status === "removed");
  t("the seller can't put it back on sale", sql((r) => r.prepare(`SELECT status FROM listings WHERE id = ?`).get(gone)).status === "removed" && !(await call(null, "/api/market")).j.listings.some((l) => l.id === gone));
  const own = await call("seller", `/api/market/${cap}`, { status: "sold" }, "PATCH");
  const back = await call("seller", `/api/market/${cap}`, { status: "active" }, "PATCH");
  t("their own Mark sold / Relist still works", own.s === 200 && back.s === 200 && sql((r) => r.prepare(`SELECT status FROM listings WHERE id = ?`).get(cap)).status === "active");

  console.log("\nPHOTOS AND PRICES");
  const ext = await call("seller", `/api/market/${cap}`, { images: ["https://elsewhere.example/x.png"] }, "PATCH");
  t("a listing's photos are LABS uploads: a picture on another site is refused", ext.s === 400 && sql((r) => r.prepare(`SELECT images FROM listings WHERE id = ?`).get(cap)).images === '["/uploads/a.jpg"]');
  const mix = await call("seller", `/api/market/${cap}`, { images: ["/uploads/b.jpg", "https://elsewhere.example/x.png", "/uploads/../secret"] }, "PATCH");
  t("…and only the uploads are kept from a mixed list", mix.s === 200 && sql((r) => r.prepare(`SELECT images FROM listings WHERE id = ?`).get(cap)).images === '["/uploads/b.jpg"]');
  t("a price that isn't a number is refused", (await call("seller", `/api/market/${cap}`, { price: "lots" }, "PATCH")).s === 400 && sql((r) => r.prepare(`SELECT price_cents FROM listings WHERE id = ?`).get(cap)).price_cents === 3000);
  t("…and so is one over the cap a new listing has", (await call("seller", `/api/market/${cap}`, { price: 60000 }, "PATCH")).s === 400);
} finally { srv.kill(); if (fail) console.log("\n--- server log ---\n" + log.split("\n").slice(-25).join("\n")); }
console.log(`\n  ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
