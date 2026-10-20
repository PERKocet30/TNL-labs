// The product feed for Instagram (2026-10-20): "link the app to Meta so I can
// tag my product on Instagram like Shopify". Commerce Manager reads
// /feeds/meta.csv; only LABS's own physical pieces, priced and pictured as on
// their pages.
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { rmSync, mkdirSync } from "node:fs";
const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const DATA = join(ROOT, "test/.tmp/meta-feed");
rmSync(DATA, { recursive: true, force: true }); mkdirSync(DATA, { recursive: true });
process.env.TNL_DATA = DATA;
const { db } = await import(join(ROOT, "src/db.js"));
let pass = 0, fail = 0;
const t = (n, ok) => { ok ? pass++ : fail++; console.log("  " + (ok ? "✓" : "✗") + "  " + n); };
const now = Date.now();
const mk = (u, admin) => Number(db.prepare(`INSERT INTO users (username, display_name, email, password_hash, created_at, email_verified, is_admin) VALUES (?,?,?,?,?,1,?)`).run(u, u, u + "@x.test", "x", now, admin).lastInsertRowid);
const boss = mk("boss", 1), ana = mk("ana", 0);
const L = (seller, title, o = {}) => Number(db.prepare(`INSERT INTO listings (seller_id, title, description, price_cents, category, brand, condition, colour, images, status, quantity, variants, kind, compare_cents, created_at, updated_at)
  VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`).run(seller, title, o.desc ?? "Heavyweight tee, \"boxy\" fit.\nScreen printed.", o.price ?? 4500, o.cat ?? "Tops", o.brand ?? "TNL", o.cond ?? "New", o.colour ?? "Black",
  JSON.stringify(o.imgs ?? ["/uploads/a.jpg", "/uploads/b.jpg"]), o.status ?? "active", o.qty ?? 1, JSON.stringify(o.variants ?? []), o.kind ?? "physical", o.compare ?? null, now, now).lastInsertRowid);
const tee = L(boss, "Drop 01 Tee", { variants: [{ id: "s1", size: "M", colour: "", qty: 3 }, { id: "s2", size: "L", colour: "", qty: 0 }] });
const print = L(boss, "Poster", { cat: "Art / Prints", cond: "Like New", brand: "", qty: 2, compare: 6000, price: 4000, colour: "" });
const gone = L(boss, "Sold hoodie", { status: "sold", qty: 0 });
L(boss, "Removed cap", { status: "removed" });
L(boss, "Beat pack", { kind: "loop" });
L(boss, "No picture", { imgs: [] });
L(ana, "Ana's jacket");
db.close();
const PORT = 8903, B = `http://localhost:${PORT}`;
const srv = spawn(process.execPath, ["--experimental-sqlite", "--no-warnings", "src/server.runtime.js"], {
  cwd: ROOT, stdio: "ignore", env: { ...process.env, TNL_DATA: DATA, PORT: String(PORT), STRIPE_SECRET_KEY: "", TNL_NO_VIDEO_FIX: "1", TNL_NO_WATCH: "1", PUBLIC_URL: "https://tnllabs.com" } });
/* a small CSV reader: quoted cells, doubled quotes */
const parse = (s) => s.trim().split("\n").map((line) => { const out = []; let cur = "", q = false;
  for (let i = 0; i < line.length; i++) { const c = line[i]; if (q) { if (c === '"' && line[i + 1] === '"') { cur += '"'; i++; } else if (c === '"') q = false; else cur += c; } else if (c === '"') q = true; else if (c === ",") { out.push(cur); cur = ""; } else cur += c; }
  out.push(cur); return out; });
try {
  for (let i = 0; i < 100; i++) { try { if ((await fetch(B + "/api/health")).ok) break; } catch {} await new Promise((r) => setTimeout(r, 100)); }
  const r = await fetch(B + "/feeds/meta.csv"), body = await r.text(), [head, ...rows] = parse(body);
  const rec = rows.map((x) => Object.fromEntries(head.map((h, i) => [h, x[i]])));
  const by = (id) => rec.find((x) => x.id === id) || {};
  console.log("\nTHE FEED");
  t("a CSV anyone (Meta) can read", r.status === 200 && /text\/csv/.test(r.headers.get("content-type")));
  t("Meta's columns, in a header row", ["id", "title", "description", "availability", "condition", "price", "link", "image_link", "brand"].every((c) => head.includes(c)));
  t("only LABS's own physical pieces with a picture: no member's, no beats, nothing removed", rec.length === 4 && !body.includes("Ana's jacket") && !body.includes("Beat pack") && !body.includes("Removed cap") && !body.includes("No picture"));
  console.log("\nA PIECE WITH SIZES");
  t("one row per size, grouped like Shopify's", by(`labs-${tee}-s1`).item_group_id === `labs-${tee}` && by(`labs-${tee}-s2`).item_group_id === `labs-${tee}` && by(`labs-${tee}-s1`).size === "M");
  t("each size's own stock", by(`labs-${tee}-s1`).availability === "in stock" && by(`labs-${tee}-s1`).quantity_to_sell_on_facebook === "3" && by(`labs-${tee}-s2`).availability === "out of stock");
  t("price, link and pictures as on its page", by(`labs-${tee}-s1`).price === "45.00 USD" && by(`labs-${tee}-s1`).link === `https://tnllabs.com/m/${tee}`
    && by(`labs-${tee}-s1`).image_link === "https://tnllabs.com/uploads/a.jpg" && by(`labs-${tee}-s1`).additional_image_link === "https://tnllabs.com/uploads/b.jpg");
  t("quotes and line breaks in a description can't break the file", by(`labs-${tee}-s1`).description === 'Heavyweight tee, "boxy" fit. Screen printed.');
  t("New is new; its brand as set", by(`labs-${tee}-s1`).condition === "new" && by(`labs-${tee}-s1`).brand === "TNL");
  console.log("\nOTHERS");
  t("a price drop shows as a sale (was / now)", by(`labs-${print}`).price === "60.00 USD" && by(`labs-${print}`).sale_price === "40.00 USD");
  t("worn condition is used; no brand set says LABS; prints are artwork", by(`labs-${print}`).condition === "used" && by(`labs-${print}`).brand === "LABS" && /Artwork/.test(by(`labs-${print}`).google_product_category));
  t("sold out stays in, as out of stock, so a tagged post never breaks", by(`labs-${gone}`).availability === "out of stock" && by(`labs-${gone}`).quantity_to_sell_on_facebook === "0");
} finally { srv.kill(); }
console.log(`\n  ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
