// FIND v1.0 — 2026-11-15: "The search bar should let you find anything in the dashboard."
// GET /api/admin/find — listings, orders, work, tournaments and Knowledge by a word, a username or a number; the
// owner only; never a message, an email or an address. The bar's own map (admin-app/1-find.js) covers every page and tab.
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { rmSync, mkdirSync, readFileSync } from "node:fs";
const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const DATA = join(ROOT, "test/.tmp/find");
rmSync(DATA, { recursive: true, force: true }); mkdirSync(DATA, { recursive: true });
process.env.TNL_DATA = DATA;
const { db } = await import(join(ROOT, "src/db.js"));
let pass = 0, fail = 0;
const t = (n, ok) => { ok ? pass++ : fail++; console.log("  " + (ok ? "✓" : "✗") + "  " + n); };
const now = Date.now();
const mk = (u, { admin = 0, mod = 0, suspended = 0 } = {}) => { const id = Number(db.prepare(`INSERT INTO users (username, display_name, email, password_hash, created_at, email_verified, is_admin, suspended) VALUES (?,?,?,?,?,1,?,?)`)
  .run(u, u, u + "@secret.test", "x", now, admin, suspended).lastInsertRowid); db.prepare(`INSERT INTO sessions (token, user_id, created_at) VALUES (?,?,?)`).run("tok-" + u, id, now); return id; };
const boss = mk("boss", { admin: 1 }), ana = mk("ana"), ben = mk("ben"), spam = mk("spam", { suspended: 1 });
const post = (who, body) => Number(db.prepare(`INSERT INTO posts (author_id, channel, body, image_url, is_work, created_at) VALUES (?,?,?,?,1,?)`).run(who, "graphic-design", body, "/uploads/x.png", now).lastInsertRowid);
const piece = post(ana, "Cobalt study, 100% ink #study"); post(spam, "cobalt pills cheap");
const listing = Number(db.prepare(`INSERT INTO listings (seller_id, title, price_cents, created_at, updated_at) VALUES (?,?,?,?,?)`).run(ana, "Cobalt print", 2000, now, now).lastInsertRowid);
const order = Number(db.prepare(`INSERT INTO orders (listing_id, buyer_id, seller_id, amount_cents, shipping_cents, status, ship_name, ship_address, created_at, updated_at) VALUES (?,?,?,?,?,?,?,?,?,?)`)
  .run(listing, ben, ana, 2000, 500, "paid", "Benjamin Cobaltson", "9 Cobalt Lane", now, now).lastInsertRowid);
db.close();

const PORT = 8951;
const srv = spawn(process.execPath, ["--experimental-sqlite", "--no-warnings", "src/server.runtime.js"], {
  cwd: ROOT, stdio: "ignore", env: { ...process.env, TNL_DATA: DATA, PORT: String(PORT), TNL_NO_VIDEO_FIX: "1", TNL_NO_WATCH: "1", PUBLIC_URL: `http://localhost:${PORT}`, STRIPE_SECRET_KEY: "", RESEND_API_KEY: "" } });
const find = async (q, tok = "tok-boss") => { const r = await fetch(`http://localhost:${PORT}/api/admin/find?q=${encodeURIComponent(q)}`, { headers: tok ? { Authorization: "Bearer " + tok } : {} }); const text = await r.text(); let j = {}; try { j = JSON.parse(text); } catch {} return { s: r.status, j, text }; };
try {
  for (let i = 0; i < 100; i++) { try { if ((await fetch(`http://localhost:${PORT}/api/health`)).ok) break; } catch {} await new Promise((r) => setTimeout(r, 100)); }
  console.log("\nWHO MAY SEARCH");
  t("signed out: 401 · a member: 403", (await find("cobalt", "")).s === 401 && (await find("cobalt", "tok-ana")).s === 403);
  t("it isn't on a Mod's list: the owner only", !/admin\/find/.test(readFileSync(join(ROOT, "src/server/admin/mods.js"), "utf8")));

  console.log("\nWHAT IT FINDS");
  const r = await find("cobalt"), j = r.j;
  t("an admin: 200, in five groups", r.s === 200 && ["listings", "orders", "work", "events", "knowledge"].every((k) => Array.isArray(j[k])));
  t("a listing by its title, with its price, seller and state", j.listings.length === 1 && j.listings[0].id === listing && j.listings[0].price === 2000 && j.listings[0].seller === "ana");
  t("an order by what was bought", j.orders.length === 1 && j.orders[0].id === order && j.orders[0].buyer === "ben" && j.orders[0].amount === 2000);
  t("a piece by its words — and never a suspended account's", j.work.length === 1 && j.work[0].id === piece && j.work[0].username === "ana");
  t("an order by its number, with or without the #", (await find("#" + order)).j.orders[0]?.id === order && (await find(String(order).padStart(2, "0"))).j.orders.some((o) => o.id === order));
  t("orders and listings by a username, @ or not", (await find("@ben")).j.orders.length === 1 && (await find("ana")).j.listings.length === 1);
  const k = await find("rep only comes");
  t("Knowledge by its title", k.j.knowledge.some((e) => /Rep only comes from other people/.test(e.title) && e.kind === "decision"));
  t("one letter finds nothing; a % or _ is a character, not a wildcard", (await find("c")).j.listings.length === 0 && (await find("%")).j.listings.length === 0 && (await find("100%")).j.work.length === 1 && (await find("1_0")).j.work.length === 0);

  console.log("\nWHAT IT NEVER SEARCHES OR SHOWS");
  t("no email, no name on the parcel, no street — in any answer", !/secret\.test|Cobaltson|Cobalt Lane/.test(r.text + (await find("ben")).text));
  t("a buyer's name or street finds nothing", (await find("Cobaltson")).j.orders.length === 0 && (await find("Cobalt Lane")).j.orders.length === 0);
  const src = readFileSync(join(ROOT, "src/server/admin/find.js"), "utf8").replace(/\/\*[\s\S]*?\*\//g, "");
  t("the route reads no message, inbox or note table", !/dm_messages|dm_threads|group_|ig_messages|admin_notes|ship_name|ship_address|\bemail\b/.test(src));
} finally { srv.kill(); }

console.log("\nTHE BAR'S OWN MAP");
const R = (p) => readFileSync(join(ROOT, p), "utf8");
const find1 = R("public/admin-app/1-find.js"), core = R("public/admin-app/1-core.js"), html = R("public/admin.html");
const map = find1.slice(find1.indexOf("const FIND_MAP = ["), find1.indexOf("const FIND_NUM"));
const tabs = [...core.slice(core.indexOf("const TABS = ["), core.indexOf("const GROUPS")).matchAll(/\["([a-z]+)", "([^"]+)"\]/g)].map((m) => m[1]);
t("every section of the dashboard is in it", tabs.length >= 14 && tabs.every((k) => new RegExp(`", "${k}", `).test(map)));
const subs = (file, name) => [...R(file).match(new RegExp(`const ${name} = \\[(.*)\\];`))[1].matchAll(/\["([a-z]+)", "([^"]+)"\]/g)].map((m) => m[2]);
t("every Analytics and Settings tab is in it, by the name on the tab", [...subs("public/admin-app/9-analytics.js", "ATABS"), ...subs("public/admin-app/6-settings.js", "SYSTABS").slice(1)].every((l) => map.includes(`["${l}", `)));
t("a number opens the tab that shows it — and that tab exists", (() => { const tabs = subs("public/admin-app/9-analytics.js", "ATABS").map((l) => l.toLowerCase()); return [...find1.match(/const FIND_NUM = \{(.*)\};/)[1].matchAll(/: "([a-z]+)"/g)].every((m) => tabs.includes(m[1])); })());
t("every switch in Settings is in it", [...R("public/admin-app/6-settings.js").matchAll(/tog\("[a-zA-Z]+", "([^"]+)"/g)].every((m) => map.includes(`["${m[1]}", `)));
t("the numbers come from the dictionary", /D\.measures/.test(find1) && /FIND_NUM/.test(find1));
t("the bar says what it does, and loads after the core", core.includes('placeholder="Search LABS"') && !core.includes("function wireSearch") && html.indexOf("1-core.js") < html.indexOf("1-range.js") && html.indexOf("1-range.js") < html.indexOf("1-find.js") && html.indexOf("1-find.js") < html.indexOf("1-motion.js"));
t("members, then the rest from /api/admin/find — the owner's only", find1.includes("/api/admin/people?q=") && /ACCESS === "owner" \? req\("\/api\/admin\/find\?q="/.test(find1));
t("what a result shows is escaped", !/\$\{r\.(title|text|seller|buyer|username|kind|status)\}/.test(find1));

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
