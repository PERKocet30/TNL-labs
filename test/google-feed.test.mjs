// The product feed for Google (2026-10-25): free listings in Google Shopping.
// Merchant Center reads /feeds/google.csv — the same pieces as the Instagram
// shop feed, plus what Google asks for on top (gender, age group, no barcode).
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { rmSync, mkdirSync } from "node:fs";
const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const DATA = join(ROOT, "test/.tmp/google-feed");
rmSync(DATA, { recursive: true, force: true }); mkdirSync(DATA, { recursive: true });
process.env.TNL_DATA = DATA;
const { db } = await import(join(ROOT, "src/db.js"));
let pass = 0, fail = 0;
const t = (n, ok) => { ok ? pass++ : fail++; console.log("  " + (ok ? "✓" : "✗") + "  " + n); };
const now = Date.now();
const mk = (u, admin) => { const id = Number(db.prepare(`INSERT INTO users (username, display_name, email, password_hash, created_at, email_verified, is_admin) VALUES (?,?,?,?,?,1,?)`).run(u, u === "ana" ? "Ana Reyes" : u, u + "@x.test", "x", now, admin).lastInsertRowid);
  db.prepare(`INSERT INTO sessions (token, user_id, created_at) VALUES (?,?,?)`).run("tok-" + u, id, now); return id; };
const boss = mk("boss", 1), ana = mk("ana", 0); mk("cy", 0);
const L = (seller, title, o = {}) => Number(db.prepare(`INSERT INTO listings (seller_id, title, description, price_cents, category, brand, condition, colour, images, status, quantity, variants, kind, compare_cents, created_at, updated_at)
  VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`).run(seller, title, o.desc ?? "Heavyweight tee, \"boxy\" fit.\nScreen printed.", o.price ?? 4500, o.cat ?? "Tops", o.brand ?? "TNL", o.cond ?? "New", o.colour ?? "Black",
  JSON.stringify(o.imgs ?? ["/uploads/a.jpg", "/uploads/b.jpg"]), o.status ?? "active", o.qty ?? 1, JSON.stringify(o.variants ?? []), o.kind ?? "physical", o.compare ?? null, now, now).lastInsertRowid);
const tee = L(boss, "Drop 01 Tee", { variants: [{ id: "s1", size: "M", colour: "", qty: 3 }, { id: "s2", size: "L", colour: "", qty: 0 }] });
const print = L(boss, "Poster", { cat: "Art / Prints", cond: "Like New", brand: "", qty: 2, compare: 6000, price: 4000, colour: "" });
const gone = L(boss, "Sold hoodie", { status: "sold", qty: 0 });
const emo = L(boss, "Camo Shiesty🪖 ✌🏽", { desc: "Sashiko 🪡 stitched ❤️‍🔥", qty: 1 });
L(boss, "Removed cap", { status: "removed" });
L(boss, "Beat pack", { kind: "loop" });
L(boss, "No picture", { imgs: [] });
const jacket = L(ana, "Ana's jacket", { brand: "" }), anaBeat = L(ana, "Ana's beat", { kind: "loop" });
db.close();
const PORT = 8917, B = `http://localhost:${PORT}`;
const srv = spawn(process.execPath, ["--experimental-sqlite", "--no-warnings", "src/server.runtime.js"], {
  cwd: ROOT, stdio: "ignore", env: { ...process.env, TNL_DATA: DATA, PORT: String(PORT), STRIPE_SECRET_KEY: "", TNL_NO_VIDEO_FIX: "1", TNL_NO_WATCH: "1", PUBLIC_URL: "https://tnllabs.com" } });
/* a small CSV reader: quoted cells, doubled quotes */
const parse = (s) => s.trim().split("\n").map((line) => { const out = []; let cur = "", q = false;
  for (let i = 0; i < line.length; i++) { const c = line[i]; if (q) { if (c === '"' && line[i + 1] === '"') { cur += '"'; i++; } else if (c === '"') q = false; else cur += c; } else if (c === '"') q = true; else if (c === ",") { out.push(cur); cur = ""; } else cur += c; }
  out.push(cur); return out; });
try {
  for (let i = 0; i < 100; i++) { try { if ((await fetch(B + "/api/health")).ok) break; } catch {} await new Promise((r) => setTimeout(r, 100)); }
  const r = await fetch(B + "/feeds/google.csv"), body = await r.text(), [head, ...rows] = parse(body);
  const rec = rows.map((x) => Object.fromEntries(head.map((h, i) => [h, x[i]])));
  const by = (id) => rec.find((x) => x.id === id) || {};
  const meta = await (await fetch(B + "/feeds/meta.csv")).text(), metaIds = parse(meta).slice(1).map((x) => x[0]).sort();
  console.log("\nTHE FEED");
  t("a CSV Google can read", r.status === 200 && /text\/csv/.test(r.headers.get("content-type")));
  t("Google's columns, in a header row", ["id", "title", "description", "link", "image_link", "availability", "price", "condition", "brand", "gender", "age_group", "identifier_exists"].every((c) => head.includes(c)));
  t("no Meta-only column", !head.includes("quantity_to_sell_on_facebook"));
  t("the same pieces as the Instagram shop: no beats, nothing removed, a member's only when switched on", JSON.stringify(rec.map((x) => x.id).sort()) === JSON.stringify(metaIds)
    && rec.length === 5 && !body.includes("Ana's jacket") && !body.includes("Beat pack") && !body.includes("Removed cap") && !body.includes("No picture"));
  console.log("\nWHAT GOOGLE ASKS FOR");
  t("clothing says unisex / adult", by(`labs-${tee}-s1`).gender === "unisex" && by(`labs-${tee}-s1`).age_group === "adult");
  t("art doesn't get a gender", by(`labs-${print}`).gender === "" && by(`labs-${print}`).age_group === "");
  t("no barcode on one-off pieces", rec.every((x) => x.identifier_exists === "no"));
  console.log("\nAS ON THE PAGE");
  t("sizes grouped, each with its own stock", by(`labs-${tee}-s1`).item_group_id === `labs-${tee}` && by(`labs-${tee}-s1`).availability === "in stock" && by(`labs-${tee}-s2`).availability === "out of stock");
  t("price, link and pictures as on its page", by(`labs-${tee}-s1`).price === "45.00 USD" && by(`labs-${tee}-s1`).link === `https://tnllabs.com/m/${tee}`
    && by(`labs-${tee}-s1`).image_link === "https://tnllabs.com/uploads/a.jpg");
  t("a price drop shows as a sale", by(`labs-${print}`).price === "60.00 USD" && by(`labs-${print}`).sale_price === "40.00 USD");
  t("sold out stays in, as out of stock", by(`labs-${gone}`).availability === "out of stock");
  t("no emoji", by(`labs-${emo}`).title === "Camo Shiesty");
  t("robots.txt lets Google read the feed", !/Disallow: \/feeds/.test(await (await fetch(B + "/robots.txt")).text()));
} finally { srv.kill(); }
console.log(`\n  ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
