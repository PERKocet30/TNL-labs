// THE DICTIONARY v1.0 — 2026-11-15: "improve the admin dashboard to meet Google level analytics … how it's
// organised, categorised and worded". One meaning for every number (src/server/admin/measures.js) and one name
// for every screen (SCREENS in src/server/ui-signals/signals.js). These fail when a page goes back to counting on
// its own: a suspended account in a total, shipping in sales, two numbers called active, a second name for a screen.
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { rmSync, mkdirSync, readFileSync } from "node:fs";
const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const DATA = join(ROOT, "test/.tmp/measures");
rmSync(DATA, { recursive: true, force: true }); mkdirSync(DATA, { recursive: true });
process.env.TNL_DATA = DATA;
const { db } = await import(join(ROOT, "src/db.js"));
let pass = 0, fail = 0;
const t = (n, ok) => { ok ? pass++ : fail++; console.log("  " + (ok ? "✓" : "✗") + "  " + n); };
const read = (p) => readFileSync(join(ROOT, p), "utf8");
const now = Date.now(), H = 3600000, D = 86400000;
const mk = (u, { admin = 0, suspended = 0, at = now - H, verified = 1 } = {}) => {
  const id = Number(db.prepare(`INSERT INTO users (username, display_name, email, password_hash, created_at, email_verified, is_admin, suspended) VALUES (?,?,?,?,?,?,?,?)`)
    .run(u, u, u + "@x.test", "x", at, verified, admin, suspended).lastInsertRowid);
  db.prepare(`INSERT INTO sessions (token, user_id, created_at) VALUES (?,?,?)`).run("tok-" + u, id, now); return id; };
/* boss (admin) · ana posts work · ben follows ana (took part, never posted) · cy only joined · spam is suspended, and posted */
const boss = mk("boss", { admin: 1, at: now - 40 * D }), ana = mk("ana"), ben = mk("ben"), cy = mk("cy", { verified: 0 }), spam = mk("spam", { suspended: 1 });
const post = (who, work = 1) => Number(db.prepare(`INSERT INTO posts (author_id, channel, body, image_url, is_work, created_at) VALUES (?,?,?,?,?,?)`).run(who, "graphic-design", "piece", "/uploads/x.png", work, now - 1000).lastInsertRowid);
const piece = post(ana); post(spam);
db.prepare(`INSERT INTO follows (follower_id, followee_id, created_at) VALUES (?,?,?)`).run(ben, ana, now - 1000);
db.prepare(`INSERT INTO likes (user_id, post_id, created_at) VALUES (?,?,?)`).run(ben, piece, now - 1000);
db.prepare(`INSERT INTO comments (post_id, author_id, body, created_at) VALUES (?,?,?,?)`).run(piece, boss, "strong", now - 1000);
const listing = Number(db.prepare(`INSERT INTO listings (seller_id, title, price_cents, created_at, updated_at) VALUES (?,?,?,?,?)`).run(ana, "Print", 2000, now - 1000, now - 1000).lastInsertRowid);
db.prepare(`INSERT INTO orders (listing_id, buyer_id, seller_id, amount_cents, shipping_cents, status, created_at, updated_at) VALUES (?,?,?,?,?,?,?,?)`).run(listing, ben, ana, 2000, 500, "paid", now - 1000, now - 1000);
db.close();

const PORT = 8947;
const srv = spawn(process.execPath, ["--experimental-sqlite", "--no-warnings", "src/server.runtime.js"], {
  cwd: ROOT, stdio: "ignore", env: { ...process.env, TNL_DATA: DATA, PORT: String(PORT), TNL_NO_VIDEO_FIX: "1", TNL_NO_WATCH: "1", PUBLIC_URL: `http://localhost:${PORT}`, STRIPE_SECRET_KEY: "", RESEND_API_KEY: "" } });
const get = async (path, tok = "tok-boss") => { const r = await fetch(`http://localhost:${PORT}/api/admin/${path}`, { headers: tok ? { Authorization: "Bearer " + tok } : {} }); return { s: r.status, j: await r.json().catch(() => ({})) }; };
try {
  for (let i = 0; i < 100; i++) { try { if ((await fetch(`http://localhost:${PORT}/api/health`)).ok) break; } catch {} await new Promise((r) => setTimeout(r, 100)); }
  /* ana and cy open the app (any signed-in request is a visit day); the suspended account can't */
  for (const u of ["ana", "cy"]) await fetch(`http://localhost:${PORT}/api/me`, { headers: { Authorization: "Bearer tok-" + u } });

  console.log("\nTHE DICTIONARY");
  t("signed out: 401 · a member: 403", (await get("measures", "")).s === 401 && (await get("measures", "tok-ana")).s === 403);
  const M = (await get("measures")).j.measures || [];
  t("every number has a name and one line saying what it counts", M.length >= 12 && M.every((m) => m.id && m.name && m.says && m.says.length < 200));
  t("it says members, never users; work, never content", !/\buser|\bcontent\b|engagement|sign.?up/i.test(JSON.stringify(M)));

  const q = "?days=7&tz=0";
  const [pulse, series, audience, overview, funnel, market, network, retention] = (await Promise.all(["pulse" + q, "series" + q, "audience" + q, "overview", "funnel", "market", "network" + q, "retention"].map((p) => get(p)))).map((r) => r.j);
  const stage = (id) => network.stages.find((s) => s.id === id);

  console.log("\nMEMBERS: one count, everywhere (a suspended account isn't one)");
  t("4 members on every page", [pulse.totals.members, series.members, audience.members, overview.members, funnel.steps[0].n].every((n) => n === 4)
    && stage("join").facts.find((f) => f[0] === "Members in all")[1] === 4 && network.sections.find((s) => s.id === "people").value === 4);
  t("joined this period: 3, the same on the pulse, its chart, the overview and the member's path", pulse.now.signups === 3 && series.series.signups.reduce((a, b) => a + b, 0) === 3 && overview.newWeek === 3 && stage("join").value === 3);
  t("the levels add up to the members", overview.levels.reduce((s, l) => s + l.n, 0) === overview.members);
  t("the path from joining to a sale counts members at every step", funnel.steps.find((s) => s.label === "Posted anything").n === 1 && funnel.steps[0].label === "Joined" && funnel.steps[1].label === "Confirmed email");
  t("never posted and the list behind it leave the suspended out", retention.neverPosted === 3 && !retention.silent.some((u) => u.username === "spam"));

  console.log("\nTOOK PART and OPENED THE APP: two numbers, two names");
  t("took part: ana posted, ben followed and liked, boss gave feedback — 3, on every page", pulse.now.active === 3 && overview.active === 3 && audience.active30 === 3 && series.series.active.reduce((a, b) => Math.max(a, b), 0) === 3);
  t("opened the app: boss, ana, cy — 3, on the pulse, the overview and the member's path", pulse.now.opened === 3 && pulse.seen === 3 && overview.openedWeek === 3 && stage("see").value === 3);

  console.log("\nSALES: the pieces, never shipping");
  t("$20 — on the pulse, its chart, the overview, the Market and the member's path", pulse.now.gmv === 2000 && series.series.gmv.reduce((a, b) => a + b, 0) === 2000 && overview.gmv === 2000 && market.gmv === 2000 && market.aov === 2000 && stage("trade").value === 2000
    && market.topSellers[0].gross === 2000);
  t("feedback is likes, comments and reactions on both pages", pulse.now.feedback === 2 && stage("respond").value === 2);

  console.log("\nONE PERIOD");
  t("the member's path starts where the pulse does", JSON.stringify(Object.keys(network)).length > 0 && network.days === 7 && pulse.days === 7);
  const src = (p) => read(p).replace(/\/\*[\s\S]*?\*\//g, "");
  t("the pulse, the series, the direction and the member's path all take the dictionary's period", /mWindow\(req\.query, now\)/.test(src("src/server/admin/admin.js")) && /mWindow\(req\.query, now\)/.test(src("src/server/admin/v4.js"))
    && /mWindow\(q, now\)/.test(src("src/server/admin/pulse-labs.js")) && /mWindow\(req\.query, now, null\)/.test(src("src/server/admin/network.js")));

  console.log("\nNO PAGE COUNTS ON ITS OWN");
  const pages = ["src/server/admin/admin.js", "src/server/admin/v4.js", "src/server/admin/dashboard.js", "src/server/admin/network.js"].map(src).join("\n");
  t("no admin page adds shipping to sales", !/amount_cents \+ (o\.)?shipping_cents/.test(pages.replace(/SELECT o\.amount_cents, o\.fee_cents, o\.shipping_cents/g, "")));
  t("no admin page counts every account as a member", !/COUNT\(\*\) n FROM users`\)/.test(pages));
  t("active has one list of what counts", /const ACTIVITY = M_ACT;/.test(pages) && !/last_seen_at >= \?/.test(pages));
  t("the dictionary runs before the pages that read it", (() => { const o = read("src/server/order.mjs"); return o.indexOf('"admin/measures.js"') > 0 && o.indexOf('"admin/measures.js"') < o.indexOf('"admin/dashboard.js"'); })());

  console.log("\nTHE WORDS ON THE DASHBOARD");
  const an = src("public/admin-app/9-analytics.js"), home = src("public/admin-app/2-home.js");
  t("Analytics says Took part, Opened the app, Joined, Came back", ["Took part", "Opened the app", "Joined", "Came back"].every((w) => an.includes(`kpiHTML("${w}"`)));
  t("…and no longer Active, New, Signed up, Commerce, Content or Reach", !/kpiHTML\("(Active|New|Signed up|Active in 30 days)"/.test(an) && !/"(Commerce|Content|Reach)"\]/.test(an) && !/sign-up to sale/.test(an));
  t("Home uses the same words", home.includes('kpiHTML("Took part"') && home.includes('kpiHTML("Joined"') && !/Active members|New members/.test(home));
  t("the page prints the dictionary", an.includes("meansHTML()") && an.includes("/api/admin/measures"));

  console.log("\nONE NAME PER SCREEN");
  const app = src("src/app/ui-signals/signals.js"), sig = read("src/server/ui-signals/signals.js");
  const fn = app.slice(app.indexOf("function uiScreen()"), app.indexOf("function uiPush("));
  const names = [...fn.matchAll(/return "([^"]+)"/g), ...fn.matchAll(/\?"([^"]+)":"([^"]+)"/g)].flatMap((m) => m.slice(1)).filter((n) => !n.endsWith(":") && n !== "browse");
  const reg = sig.slice(sig.indexOf("const SCREENS = {"), sig.indexOf("const SCREEN_WAS"));
  const has = (n) => new RegExp(`(^|[\\s{,])"?${n.replace(/[-:]/g, "\\$&")}"?: "`).test(reg);
  t("every screen the app names is in the register", names.length >= 15 && names.every(has));
  t("every tab and Market view is too", ["showroom", "labs", "market", "event", "music", "work", "shop", "collabs", "buying", "selling", "chats", "requests", "studio", "market:bag", "market:detail", "market:sell", "market:edit", "market:orders", "market:saved", "market:confirmed"].every(has));
  t("the glitch watcher uses the same names", /function glPlace\(\)\{return uiScreen\(\)\}/.test(src("src/app/core/glitch.js")) && !/post creator|opened post/.test(src("src/app/core/glitch.js")));
  const taps = (await get("ui/taps?days=7")).j, screens = (await get("ui/screens?days=7")).j;
  t("the reports answer", Array.isArray(taps.rageTaps) && Array.isArray(screens.screens));
} finally { srv.kill(); }

/* old rage taps are read under the one name; a screen has plain words */
process.env.TNL_NO_WATCH = "1";
const db2 = new (await import("node:sqlite")).DatabaseSync(join(DATA, "tnl.db"));
const file = db2.prepare(`SELECT name FROM sqlite_master WHERE name = 'glitch_events'`).get();
if (file) {
  db2.prepare(`INSERT INTO glitch_events (kind, place, detail, device, username, created_at) VALUES ('rage_tap', 'post creator', 'button Post', 'phone', 'ana', ?), ('rage_tap', 'lab Music / songs', 'button Play', 'phone', 'ana', ?), ('rage_tap', 'constructor', 'x', 'phone', 'ana', ?)`).run(now, now, now);
}
db2.close();
const srv2 = spawn(process.execPath, ["--experimental-sqlite", "--no-warnings", "src/server.runtime.js"], {
  cwd: ROOT, stdio: "ignore", env: { ...process.env, TNL_DATA: DATA, PORT: String(PORT + 1), TNL_NO_VIDEO_FIX: "1", TNL_NO_WATCH: "1", PUBLIC_URL: `http://localhost:${PORT + 1}`, STRIPE_SECRET_KEY: "", RESEND_API_KEY: "" } });
try {
  for (let i = 0; i < 100; i++) { try { if ((await fetch(`http://localhost:${PORT + 1}/api/health`)).ok) break; } catch {} await new Promise((r) => setTimeout(r, 100)); }
  const r = await (await fetch(`http://localhost:${PORT + 1}/api/admin/ui/taps?days=7`, { headers: { Authorization: "Bearer tok-boss" } })).json();
  const sc = (r.rageTaps || []).map((x) => x.screen);
  t("a rage tap filed as \"post creator\" is read as compose; \"lab Music / songs\" as lab:culture/work", !!file && sc.includes("compose") && sc.includes("lab:culture/work"));
  t("a made-up place stays the text it was, never something off the register's back", sc.includes("constructor") && sc.every((x) => typeof x === "string"));
} finally { srv2.kill(); }

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
