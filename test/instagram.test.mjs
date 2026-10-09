// LABS alongside Instagram (2026-10-09): a shop link pasted in an Instagram
// DM previews as the piece — photo, title, price, seller — not the generic
// LABS cover; and inside Instagram's own browser the app offers Safari for
// the things that can't happen there.
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { rmSync, mkdirSync, readFileSync } from "node:fs";
const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const DATA = join(ROOT, "test/.tmp/instagram");
rmSync(DATA, { recursive: true, force: true }); mkdirSync(DATA, { recursive: true });
process.env.TNL_DATA = DATA;
const { db } = await import(join(ROOT, "src/db.js"));
const now = Date.now();
const uid = Number(db.prepare(`INSERT INTO users (username, display_name, email, password_hash, created_at, email_verified) VALUES (?,?,?,?,?,1)`).run("seller", "Seller", "s@x.com", "h", now).lastInsertRowid);
const L = (title, cents, status, images) => Number(db.prepare(`INSERT INTO listings (seller_id, title, description, price_cents, size, condition, images, status, created_at, updated_at) VALUES (?,?,?,?,?,?,?,?,?,?)`)
  .run(uid, title, "Heavy cotton, boxy fit", cents, "L", "Like new", JSON.stringify(images), status, now, now).lastInsertRowid);
const tee = L(`Camo "Shiesty" tee`, 4500, "active", ["/uploads/tee.jpg"]), gone = L("Gone", 1000, "removed", ["/uploads/g.jpg"]), sold = L("Hoodie", 8050, "sold", ["/uploads/h.jpg"]);

const PORT = 8872, BASE = `http://localhost:${PORT}`;
let pass = 0, fail = 0;
const t = (n, ok) => { ok ? pass++ : fail++; console.log("  " + (ok ? "✓" : "✗") + "  " + n); };
const srv = spawn(process.execPath, ["--experimental-sqlite", "--no-warnings", "src/server.runtime.js"], {
  cwd: ROOT, env: { ...process.env, TNL_DATA: DATA, PORT: String(PORT), STRIPE_SECRET_KEY: "", TNL_NO_VIDEO_FIX: "1" }, stdio: "ignore" });
try {
  for (let i = 0; i < 100; i++) { try { if ((await fetch(BASE + "/api/health")).ok) break; } catch {} await new Promise((r) => setTimeout(r, 100)); }
  const get = async (p) => { const r = await fetch(BASE + p, { headers: { "User-Agent": "facebookexternalhit/1.1" } }); return { status: r.status, html: await r.text() }; };
  const meta = (html, k) => { const m = new RegExp(`<meta (?:property|name)="${k}" content="([^"]*)"`).exec(html); return m && m[1]; };
  const count = (html, k) => html.split(`"${k}"`).length - 1;

  console.log("\nA SHOP LINK IN AN INSTAGRAM DM");
  const r = await get(`/m/${tee}`);
  t("the listing link opens the app", r.status === 200 && r.html.includes('id="app"'));
  t("its preview is the piece: title and price", meta(r.html, "og:title") === "Camo &quot;Shiesty&quot; tee — $45");
  t("…its photo, as a full address", meta(r.html, "og:image") === `${BASE}/uploads/tee.jpg`);
  t("…who sells it, the size and condition", /Sold by @seller on TNL LABS · L · Like new/.test(meta(r.html, "og:description") || ""));
  t("…a product, priced, in stock, at its own address", meta(r.html, "og:type") === "product" && meta(r.html, "product:price:amount") === "45.00"
    && meta(r.html, "product:availability") === "in stock" && meta(r.html, "og:url") === `${BASE}/m/${tee}`);
  t("one preview, not the LABS cover as well", count(r.html, "og:title") === 1 && count(r.html, "og:image") === 1 && !r.html.includes("og-cover-v3-2026-09-23.jpg\">\n<meta property=\"og:image:secure"));
  t("the tab says what it is", /<title>Camo &quot;Shiesty&quot; tee — \$45 — LABS<\/title>/.test(r.html) && (r.html.match(/<title>/g) || []).length === 1);
  const s = await get(`/m/${sold}`);
  t("a sold piece says so, with cents", meta(s.html, "og:title") === "Hoodie — $80.50 · Sold" && meta(s.html, "product:availability") === "out of stock");
  const g = await get(`/m/${gone}`);
  t("a removed listing gives nothing away (the plain LABS preview)", meta(g.html, "og:title") === "LABS 🧪 — Cultivators" && !g.html.includes("Gone"));
  t("a listing that never existed still opens the app", (await get("/m/99999")).html.includes('id="app"'));

  console.log("\nINSIDE INSTAGRAM'S BROWSER");
  const app = readFileSync(join(ROOT, "public/index.html"), "utf8");
  t("the app knows Instagram's, Facebook's and TikTok's browsers", app.includes("/Instagram/.test(u)") && app.includes("FBAN|FBAV") && app.includes("BytedanceWebview"));
  t("one tap opens Safari on an iPhone, the browser on Android", app.includes('"x-safari-"+url') && app.includes("#Intent;scheme=https;"));
  t("if Instagram blocks that, it shows the taps that always work", app.includes("Open in ${onIOS()?\"external browser\":\"Chrome\"}"));
  t("the home-screen card becomes Open in Safari there", app.includes('if(st==="inapp")return inappCardHTML();'));
} finally { srv.kill(); }
console.log(`\n  ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
