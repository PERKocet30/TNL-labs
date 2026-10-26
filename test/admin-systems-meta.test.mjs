// Admin · Systems · Meta (2026-10-26): Instagram and Facebook in the Systems page,
// read with one system-user token, and the moves that get more reach. Runs
// against a pretend Meta Graph API; the token never reaches the page.
import { spawn } from "node:child_process";
import { createServer } from "node:http";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { rmSync, mkdirSync, readFileSync } from "node:fs";
const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const DATA = join(ROOT, "test/.tmp/admin-systems-meta");
rmSync(DATA, { recursive: true, force: true }); mkdirSync(DATA, { recursive: true });
process.env.TNL_DATA = DATA;
const { db } = await import(join(ROOT, "src/db.js"));
const now = Date.now();
const U = (n, admin) => { const id = Number(db.prepare(`INSERT INTO users (username, display_name, email, password_hash, created_at, email_verified, is_admin) VALUES (?,?,?,?,?,1,?)`).run(n, n, n + "@x.com", "h", now, admin ? 1 : 0).lastInsertRowid);
  db.prepare(`INSERT INTO sessions (token, user_id, created_at) VALUES (?,?,?)`).run("tok-" + n, id, now); };
U("boss", true); U("ana", false);
db.close();
let pass = 0, fail = 0;
const t = (n, ok) => { ok ? pass++ : fail++; console.log("  " + (ok ? "✓" : "✗") + "  " + n); };

const seen = { tokens: new Set(), calls: 0, paths: [] };
const iso = (d) => new Date(now - d * 86400000).toISOString();
const dayVals = (f) => Array.from({ length: 28 }, (_, i) => ({ value: f(i), end_time: iso(27 - i) }));
const fake = createServer((req, res) => {
  seen.calls++;
  const u = new URL(req.url, "http://x"), p = u.pathname.replace(/^\/v21\.0\//, ""), q = Object.fromEntries(u.searchParams);
  seen.tokens.add(q.access_token); seen.paths.push(p + "?" + (q.metric || q.fields || ""));
  const json = (code, obj) => { res.writeHead(code, { "Content-Type": "application/json" }); res.end(JSON.stringify(obj)); };
  if (q.access_token !== "EAAB-secret") return json(400, { error: { message: "Invalid OAuth access token.", code: 190 } });
  const prev = q.since && Number(q.since) < Math.floor((now - 29 * 86400000) / 1000);
  if (p === "me/accounts") return json(200, { data: [{ id: "111", name: "LABS", instagram_business_account: { id: "222" } }] });
  if (p === "222" ) return json(200, { username: "tnl.labs", name: "LABS", followers_count: 4581, follows_count: 2566, media_count: 499 });
  if (p === "222/insights") {
    if (q.metric === "reach") return json(200, { data: [{ name: "reach", values: dayVals((i) => prev ? 100 : 200 + i) }] });
    if (q.metric === "follower_count") return json(200, { data: [{ name: "follower_count", values: dayVals((i) => (i % 2 ? 3 : -1)) }] });
    if (q.metric_type === "total_value" && /profile_views/.test(q.metric)) return json(200, { data: [{ name: "profile_views", total_value: { value: prev ? 300 : 500 } }, { name: "website_clicks", total_value: { value: prev ? 20 : 9 } }, { name: "accounts_engaged", total_value: { value: 900 } }, { name: "total_interactions", total_value: { value: 1500 } }] });
    if (q.metric === "follower_demographics" && q.breakdown === "country") return json(200, { data: [{ name: "follower_demographics", total_value: { breakdowns: [{ dimension_keys: ["country"], results: [{ dimension_values: ["US"], value: 3000 }, { dimension_values: ["GB"], value: 400 }, { dimension_values: ["SV"], value: 300 }] }] } }] });
    if (q.metric === "follower_demographics" && q.breakdown === "city") return json(200, { data: [{ name: "follower_demographics", total_value: { breakdowns: [{ results: [{ dimension_values: ["New York, New York"], value: 800 }, { dimension_values: ["Washington, District of Columbia"], value: 500 }] }] } }] });
    if (q.metric === "follower_demographics") return json(400, { error: { message: "Not enough data", code: 100 } });
    if (q.metric === "online_followers") return json(200, { data: [{ name: "online_followers", values: [{ value: { 9: 50, 13: 80, 20: 120, 21: 110, 3: 5 } }, { value: { 20: 100, 21: 130, 13: 70 } }] }] });
  }
  if (p === "222/media") return json(200, { data: [
    { id: "m1", caption: "LABS ART TOURNAMENT 🎨\nvote now", media_type: "IMAGE", media_product_type: "FEED", timestamp: iso(5), permalink: "https://www.instagram.com/p/abc/", like_count: 210, comments_count: 11, insights: { data: [{ name: "reach", values: [{ value: 1846 }] }, { name: "saved", values: [{ value: 40 }] }, { name: "shares", values: [{ value: 16 }] }] } },
    { id: "m2", caption: "Believe your own hype.", media_type: "VIDEO", media_product_type: "REELS", timestamp: iso(2), permalink: "https://www.instagram.com/reel/def/", like_count: 400, comments_count: 30, insights: { data: [{ name: "reach", values: [{ value: 6200 }] }, { name: "saved", values: [{ value: 90 }] }, { name: "shares", values: [{ value: 70 }] }] } },
    { id: "m3", caption: "", media_type: "CAROUSEL_ALBUM", media_product_type: "FEED", timestamp: iso(9), permalink: "javascript:alert(1)", like_count: 50, comments_count: 2, insights: { data: [{ name: "reach", values: [{ value: 900 }] }] } }] });
  if (p === "222/stories") return json(200, { data: [] });
  if (p === "111") return json(200, { name: "LABS", followers_count: 1200, link: "https://www.facebook.com/tnllabs" });
  if (p === "111/insights") return json(200, { data: [{ name: "page_impressions_unique", values: dayVals(() => 10) }] });
  if (p === "333") return json(200, { name: "LABS shop", product_count: 3 });
  if (p === "333/products") return json(200, { data: [{ id: "1", retailer_id: "labs-5", name: "Drop 01 Tee", review_status: "approved" }, { id: "2", retailer_id: "labs-7-s1", name: "Camo Shiesty", review_status: "rejected", errors: [{ title: "Image too small", description: "Images must be at least 500×500" }] },
    { id: "3", retailer_id: "labs-7-s2", name: "Camo Shiesty", review_status: "rejected", errors: [{ title: "Image too small", description: "Images must be at least 500×500" }] }] });
  json(404, { error: { message: "Unsupported get request.", code: 100 } });
});
await new Promise((r) => fake.listen(0, r));
const FAKE = `http://localhost:${fake.address().port}/v21.0`;
const PORT = 8920, B = `http://localhost:${PORT}`;
const env = { ...process.env, TNL_DATA: DATA, PORT: String(PORT), STRIPE_SECRET_KEY: "", TNL_NO_VIDEO_FIX: "1", TNL_NO_WATCH: "1",
  META_ACCESS_TOKEN: "EAAB-secret", META_GRAPH_URL: FAKE, META_CATALOG_ID: "333", META_PAGE_ID: "", META_IG_USER_ID: "" };
const start = (extra = {}) => spawn(process.execPath, ["--experimental-sqlite", "--no-warnings", "src/server.runtime.js"], { cwd: ROOT, env: { ...env, ...extra }, stdio: "ignore" });
const ready = async () => { for (let i = 0; i < 100; i++) { try { if ((await fetch(B + "/api/health")).ok) return; } catch {} await new Promise((r) => setTimeout(r, 100)); } };
const get = (path, who) => fetch(B + path, { headers: who ? { authorization: "Bearer tok-" + who } : {} });
let srv = start();
try {
  await ready();
  console.log("\nADMINS ONLY");
  t("signed out: nothing", (await get("/api/admin/systems/meta")).status === 401);
  t("a member: nothing", (await get("/api/admin/systems/meta", "ana")).status === 403);

  console.log("\nTHE TOKEN");
  const r = await get("/api/admin/systems/meta", "boss"), M = await r.json(), raw = JSON.stringify(M);
  t("reads with the token; finds the Page and the Instagram account from it", r.status === 200 && M.on && M.page.id === "111" && M.instagram.username === "tnl.labs");
  t("the token never reaches the page", !raw.includes("EAAB"));

  console.log("\nINSTAGRAM");
  const I = M.instagram, T = I.totals;
  t("followers, net change, reach over 28 days against the 28 before", I.followers === 4581 && I.netFollowers === 28 && T.reach === 28 * 200 + 378 && T.reachBefore === 2800 && T.reachChange > 100);
  t("profile views and link taps with their before", T.profileViews === 500 && T.before.profileViews === 300 && T.linkTaps === 9 && T.engaged === 900);
  t("a line per day", I.days.length === 28 && I.days[0].day < I.days[27].day);
  t("posts with reach, saves, shares; the reel on top", I.top[0].kind === "reel" && I.top[0].reach === 6200 && I.top[0].saves === 90 && I.top[1].caption === "LABS ART TOURNAMENT 🎨");
  t("which kind of post reaches most", I.kinds[0].kind === "reel" && I.kinds[0].avgReach === 6200 && I.kinds.length === 3);
  t("a post link that isn't Instagram's own is dropped", I.recent.find((p) => p.kind === "carousel").url === "" && I.top[0].url === "https://www.instagram.com/reel/def/");
  t("where followers are (country, city); ages missing is fine", I.where.countries[0].label === "US" && I.where.countries[0].n === 3000 && I.where.cities[0].label === "New York, New York" && I.where.ages.length === 0);
  t("when they're online: the busiest hours, summed across the week", I.bestHours.map((h) => h.hour).join(",") === "21,20,13");

  console.log("\nFACEBOOK AND THE SHOP");
  t("the Page: followers, reach, its link", M.facebook.name === "LABS" && M.facebook.followers === 1200 && M.facebook.reach === 280 && M.facebook.url === "https://www.facebook.com/tnllabs");
  t("the catalog: what can be tagged, what's rejected and why, naming the pieces with a link", M.shop.counts.approved === 1 && M.shop.counts.rejected === 2 && M.shop.issues[0].title === "Image too small" && M.shop.issues[0].count === 1 && M.shop.issues[0].pieces[0].path === "/m/7");

  console.log("\nWHAT TO DO NEXT");
  const todo = M.todo.map((x) => x.text).join("\n");
  t("the hours to post", /online most around 9pm, 8pm, 1pm/.test(todo));
  t("reels reach more — more of those", /Reels reach about \d+× more than/.test(todo));
  t("reached a lot, few link taps", /only 9 tapped the link/.test(todo));
  t("no Story up", /No Story up right now/.test(todo));
  t("the post that reached most, with its link", /reached most lately \(6,200 people\): "Believe your own hype\."/.test(todo) && M.todo.find((x) => /reached most/.test(x.text)).url === "https://www.instagram.com/reel/def/");
  t("the shop's rejections", /1 piece can't be tagged on Instagram: Image too small/.test(todo));

  console.log("\nCACHED");
  const calls = seen.calls;
  t("a second look within ten minutes doesn't ask Meta again", (await (await get("/api/admin/systems/meta", "boss")).json()).cached === true && seen.calls === calls);

  console.log("\nWHEN THE TOKEN IS MISSING OR DEAD");
  srv.kill(); await new Promise((r) => setTimeout(r, 300));
  srv = start({ META_ACCESS_TOKEN: "" }); await ready();
  t("no token: says it's off", (await (await get("/api/admin/systems/meta", "boss")).json()).on === false);
  srv.kill(); await new Promise((r) => setTimeout(r, 300));
  srv = start({ META_ACCESS_TOKEN: "EAAB-old" }); await ready();
  const dead = await (await get("/api/admin/systems/meta", "boss")).json();
  t("a dead token: one plain line, nothing leaks", dead.on === true && /no longer valid/.test(dead.error) && !JSON.stringify(dead).includes("EAAB"));
  srv.kill(); await new Promise((r) => setTimeout(r, 300));
  srv = start({ META_CATALOG_ID: "" }); await ready();
  t("no catalog id: the shop card is simply left out", (await (await get("/api/admin/systems/meta", "boss")).json()).shop === null);

  console.log("\nTHE PAGE");
  const page = readFileSync(join(ROOT, "public/admin-app/7-systems3-meta.js"), "utf8"), html = readFileSync(join(ROOT, "public/admin.html"), "utf8");
  t("its own script, after Google", /7-systems2-google\.js.*\n.*7-systems3-meta\.js/.test(html));
  t("says plainly when the token isn't set", /META_ACCESS_TOKEN/.test(page));
} finally { srv.kill(); fake.close(); }
console.log(`\n  ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
