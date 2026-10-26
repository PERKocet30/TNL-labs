/* ================================================================
   ADMIN · SYSTEMS · META v1.0 — 2026-10-26. Part 3 of "integrate our admin
   dashboard with …": Instagram and Facebook, read-only, in the Systems page —
   and the moves that get more reach from them.
     GET /api/admin/systems/meta   (admins only)
   One Meta token reads it all (RAILWAY.md):
     META_ACCESS_TOKEN  a system-user token from Business Manager (doesn't
                        expire), with instagram_basic, instagram_manage_insights,
                        pages_read_engagement, pages_show_list, catalog_management
     META_PAGE_ID       optional — the Facebook Page; found from the token if blank
     META_IG_USER_ID    optional — the Instagram account; found from the Page if blank
     META_CATALOG_ID    optional — the shop catalog; the Shopping card is left out if blank
   The token never leaves the server; the page gets numbers and names.
   What comes back, 28 days against the 28 before:
     instagram — followers (and net change), reach, profile views, link taps,
                 accounts engaged, a line per day; the last 30 posts with reach,
                 saves, shares, likes, comments, and which kind of post reaches
                 most; the stories up right now; where followers are (country,
                 city, age); when they're online (best hours to post)
     facebook  — the Page's followers and daily reach
     shop      — the catalog's pieces and which are rejected, with why
     todo      — the few things to do next, in Jorge's words
   Cached 10 minutes (30 s floor on Look again), 10 looks a minute per admin.
   test/admin-systems-meta.test.mjs runs it against a pretend Meta.
================================================================ */
const MT_ENV = (k, d = "") => (process.env[k] || "").trim() || d;
const MT = { token: () => MT_ENV("META_ACCESS_TOKEN"), url: () => MT_ENV("META_GRAPH_URL", "https://graph.facebook.com/v21.0"),
  page: () => MT_ENV("META_PAGE_ID").replace(/\D/g, ""), ig: () => MT_ENV("META_IG_USER_ID").replace(/\D/g, ""), catalog: () => MT_ENV("META_CATALOG_ID").replace(/\D/g, "") };
const MT_CACHE = { at: 0, body: null };
const mtLine = (s) => String(s || "").split("\n")[0].trim().slice(0, 200);
const mtDay = (t) => new Date(t).toISOString().slice(0, 10);
const mtPct = (a, b) => (b ? Math.round(((a - b) / b) * 1000) / 10 : null);
/* a link the page may follow: Instagram's or Facebook's own, nothing else */
const mtUrl = (u) => /^https:\/\/(www\.)?(instagram\.com|facebook\.com)\//.test(String(u || "")) ? String(u).slice(0, 300) : "";
async function mtGet(path, params = {}) {
  const u = new URL(`${MT.url()}/${path}`);
  for (const [k, v] of Object.entries(params)) if (v !== undefined && v !== "") u.searchParams.set(k, String(v));
  u.searchParams.set("access_token", MT.token());
  const r = await fetch(u, { signal: AbortSignal.timeout(12000) });
  const j = await r.json().catch(() => ({}));
  if (!r.ok || j.error) {
    const e = j.error || {}, m = mtLine(e.message || `answered ${r.status}`);
    const err = new Error(e.code === 190 ? "Meta says the token is no longer valid — make a new system-user token." : /permission|\(#10\)|\(#200\)/i.test(m) ? `Meta says no permission (${m}). Does the token have the five permissions and the Page assigned?` : m);
    err.code = e.code; throw err;
  }
  return j;
}
const mtSum = (vals) => vals.reduce((n, v) => n + (Number(v) || 0), 0);
/* insights come back as [{name, values:[{value, end_time}]}] or (total_value) [{name, total_value:{value}}] */
const mtSeries = (ins, name) => (((ins.data || []).find((d) => d.name === name) || {}).values || []).map((v) => ({ day: mtDay(v.end_time), value: typeof v.value === "object" ? mtSum(Object.values(v.value || {})) : Number(v.value) || 0 }));
const mtTotal = (ins, name) => { const d = (ins.data || []).find((x) => x.name === name); return d ? Number(d.total_value?.value ?? mtSum((d.values || []).map((v) => v.value))) || 0 : 0; };

async function mtWho() {
  let page = MT.page(), ig = MT.ig(), pageName = "";
  if (!page) {
    const acc = await mtGet("me/accounts", { fields: "id,name,instagram_business_account", limit: 10 });
    const withIg = (acc.data || []).find((p) => p.instagram_business_account) || (acc.data || [])[0];
    if (!withIg) throw new Error("The token can't see any Facebook Page. In Business Manager, assign the LABS Page to the system user.");
    page = String(withIg.id); pageName = withIg.name || ""; if (!ig && withIg.instagram_business_account) ig = String(withIg.instagram_business_account.id);
  }
  if (!ig) { const p = await mtGet(page, { fields: "name,instagram_business_account" }); pageName = pageName || p.name || ""; ig = String(p.instagram_business_account?.id || ""); }
  if (!ig) throw new Error("That Page has no Instagram account connected. In Instagram → Settings → Linked accounts, connect the LABS Page.");
  return { page, pageName, ig };
}

async function mtInstagram(ig) {
  const now = Date.now(), D28 = 28 * 86400000, since = (t) => Math.floor(t / 1000);
  const cur = { since: since(now - D28), until: since(now) }, prev = { since: since(now - 2 * D28), until: since(now - D28) };
  const [acct, reachD, reachP, followD, tot, totP, media, stories, country, city, age, online] = await Promise.all([
    mtGet(ig, { fields: "username,name,followers_count,follows_count,media_count,profile_picture_url" }),
    mtGet(`${ig}/insights`, { metric: "reach", period: "day", ...cur }),
    mtGet(`${ig}/insights`, { metric: "reach", period: "day", ...prev }).catch(() => ({})),
    mtGet(`${ig}/insights`, { metric: "follower_count", period: "day", ...cur }).catch(() => ({})),
    mtGet(`${ig}/insights`, { metric: "profile_views,website_clicks,accounts_engaged,total_interactions", period: "day", metric_type: "total_value", ...cur }).catch(() => ({})),
    mtGet(`${ig}/insights`, { metric: "profile_views,website_clicks,accounts_engaged,total_interactions", period: "day", metric_type: "total_value", ...prev }).catch(() => ({})),
    mtGet(`${ig}/media`, { fields: "id,caption,media_type,media_product_type,timestamp,permalink,like_count,comments_count,insights.metric(reach,saved,shares)", limit: 30 }).catch(() => ({})),
    mtGet(`${ig}/stories`, { fields: "id,timestamp,media_type,permalink,insights.metric(reach,replies,navigation)" }).catch(() => ({})),
    mtGet(`${ig}/insights`, { metric: "follower_demographics", period: "lifetime", metric_type: "total_value", breakdown: "country" }).catch(() => ({})),
    mtGet(`${ig}/insights`, { metric: "follower_demographics", period: "lifetime", metric_type: "total_value", breakdown: "city" }).catch(() => ({})),
    mtGet(`${ig}/insights`, { metric: "follower_demographics", period: "lifetime", metric_type: "total_value", breakdown: "age" }).catch(() => ({})),
    mtGet(`${ig}/insights`, { metric: "online_followers", period: "lifetime" }).catch(() => ({})),
  ]);
  const days = mtSeries(reachD, "reach"), follow = mtSeries(followD, "follower_count");
  const reach = mtSum(days.map((d) => d.value)), reachBefore = mtSum(mtSeries(reachP, "reach").map((d) => d.value));
  const T = (k) => mtTotal(tot, k), TP = (k) => mtTotal(totP, k);
  const kind = (m) => m.media_product_type === "REELS" ? "reel" : m.media_type === "CAROUSEL_ALBUM" ? "carousel" : m.media_type === "VIDEO" ? "video" : "photo";
  const ins = (m, k) => { const d = ((m.insights || {}).data || []).find((x) => x.name === k); return d ? Number((d.values || [{}])[0].value) || 0 : 0; };
  const posts = (media.data || []).map((m) => ({ id: String(m.id), kind: kind(m), at: Date.parse(m.timestamp || "") || null, url: mtUrl(m.permalink),
    caption: mtLine(m.caption).slice(0, 90), likes: Number(m.like_count) || 0, comments: Number(m.comments_count) || 0, reach: ins(m, "reach"), saves: ins(m, "saved"), shares: ins(m, "shares") }));
  const byKind = {};
  for (const p of posts) { const b = byKind[p.kind] || (byKind[p.kind] = { kind: p.kind, n: 0, reach: 0, saves: 0 }); b.n++; b.reach += p.reach; b.saves += p.saves; }
  const kinds = Object.values(byKind).map((b) => ({ ...b, avgReach: Math.round(b.reach / b.n) })).sort((a, b) => b.avgReach - a.avgReach);
  const demo = (ins0) => { const d = (ins0.data || [])[0]; const res = d?.total_value?.breakdowns?.[0]?.results || []; return res.map((r) => ({ label: String((r.dimension_values || [])[0] || "").slice(0, 40), n: Number(r.value) || 0 })).sort((a, b) => b.n - a.n).slice(0, 6); };
  /* when followers are online: the lifetime metric gives hour → count for each of the last 7 days; sum them */
  const hours = {}; for (const v of ((online.data || [])[0] || {}).values || []) for (const [h, n] of Object.entries(v.value || {})) hours[h] = (hours[h] || 0) + (Number(n) || 0);
  const bestHours = Object.entries(hours).map(([h, n]) => ({ hour: Number(h), n })).sort((a, b) => b.n - a.n).slice(0, 3);
  return {
    username: String(acct.username || "").slice(0, 40), name: String(acct.name || "").slice(0, 60), followers: Number(acct.followers_count) || 0, following: Number(acct.follows_count) || 0, posts: Number(acct.media_count) || 0,
    netFollowers: mtSum(follow.map((d) => d.value)),
    totals: { reach, reachBefore, reachChange: mtPct(reach, reachBefore), profileViews: T("profile_views"), linkTaps: T("website_clicks"), engaged: T("accounts_engaged"), interactions: T("total_interactions"),
      before: { profileViews: TP("profile_views"), linkTaps: TP("website_clicks"), engaged: TP("accounts_engaged"), interactions: TP("total_interactions") } },
    days, recent: posts.slice(0, 30), top: [...posts].sort((a, b) => b.reach - a.reach).slice(0, 8), kinds,
    stories: (stories.data || []).map((s) => ({ id: String(s.id), at: Date.parse(s.timestamp || "") || null, url: mtUrl(s.permalink), reach: ins(s, "reach"), replies: ins(s, "replies") })),
    where: { countries: demo(country), cities: demo(city), ages: demo(age) }, bestHours,
  };
}
async function mtFacebook(page) {
  const now = Date.now(), since = Math.floor((now - 28 * 86400000) / 1000), until = Math.floor(now / 1000);
  const [p, ins] = await Promise.all([mtGet(page, { fields: "name,followers_count,fan_count,link" }), mtGet(`${page}/insights`, { metric: "page_impressions_unique", period: "day", since, until }).catch(() => ({}))]);
  const days = mtSeries(ins, "page_impressions_unique");
  return { name: String(p.name || "").slice(0, 60), followers: Number(p.followers_count ?? p.fan_count) || 0, url: mtUrl(p.link), reach: mtSum(days.map((d) => d.value)), days };
}
async function mtShop(catalog) {
  if (!catalog) return null;
  const [c, items] = await Promise.all([mtGet(catalog, { fields: "name,product_count" }), mtGet(`${catalog}/products`, { fields: "id,retailer_id,name,review_status,errors{title,description}", limit: 200 })]);
  const list = items.data || [], counts = { approved: 0, pending: 0, rejected: 0, outdated: 0 }, issues = new Map();
  for (const it of list) {
    const st = String(it.review_status || "").toLowerCase(); counts[st in counts ? st : "pending"]++;
    const m = /^labs-(\d+)/.exec(String(it.retailer_id || "")), piece = { title: String(it.name || it.retailer_id || "").slice(0, 120), path: m ? `/m/${m[1]}` : "" };
    for (const e of it.errors || []) { const k = mtLine(e.title) || "issue"; const g = issues.get(k) || { title: k.slice(0, 120), detail: mtLine(e.description), pieces: [] };
      if (!g.pieces.some((x) => x.title === piece.title)) g.pieces.push(piece); issues.set(k, g); }
  }
  return { name: String(c.name || "").slice(0, 60), total: Number(c.product_count) || list.length, counts,
    issues: [...issues.values()].map((g) => ({ ...g, count: g.pieces.length, pieces: g.pieces.slice(0, 6) })).sort((a, b) => b.count - a.count).slice(0, 10) };
}
function mtTodo(ig, fb, shop) {
  const out = [];
  if (ig && !ig.error) {
    if (ig.bestHours.length) { const h = (n) => `${((n + 11) % 12) + 1}${n < 12 ? "am" : "pm"}`; out.push({ kind: "instagram", text: `Followers are online most around ${ig.bestHours.map((x) => h(x.hour)).join(", ")}. Post then and the first hour gets more eyes.` }); }
    if (ig.kinds.length > 1) { const [a, b] = ig.kinds; if (a.avgReach > b.avgReach * 1.5) out.push({ kind: "instagram", text: `${a.kind === "reel" ? "Reels" : a.kind + "s"} reach about ${Math.round(a.avgReach / Math.max(1, b.avgReach))}× more than ${b.kind}s on this account (${a.avgReach.toLocaleString()} vs ${b.avgReach.toLocaleString()} people each). More of those.` }); }
    if (ig.totals.reach >= 500 && ig.totals.linkTaps < ig.totals.reach * 0.005) out.push({ kind: "instagram", text: `${ig.totals.reach.toLocaleString()} people were reached but only ${ig.totals.linkTaps} tapped the link in 28 days. Every post about a piece or the tournament should say "link in bio" and the Story should carry the link sticker.` });
    if (!ig.stories.length) out.push({ kind: "instagram", text: "No Story up right now. A Story a day keeps LABS at the front of the row — share a post from the app to make one in one tap." });
    const best = ig.top[0]; if (best && best.reach) out.push({ kind: "instagram", text: `The post that reached most lately (${best.reach.toLocaleString()} people): "${best.caption || best.kind}". Make the next one in that vein.`, url: best.url });
  }
  if (shop && !shop.error && shop.issues.length) for (const g of shop.issues.slice(0, 2)) out.push({ kind: "shop", text: `${g.count} piece${g.count === 1 ? " can't be" : "s can't be"} tagged on Instagram: ${g.title}${g.detail ? " — " + g.detail : ""}` });
  return out.slice(0, 7);
}

app.get("/api/admin/systems/meta", auth, admin, rateLimit({ max: 10, windowMs: 60000, key: "user" }), async (req, res) => {
  const now = Date.now();
  if (MT_CACHE.body && now - MT_CACHE.at < (req.query.fresh ? 30000 : 600000)) return res.json({ ...MT_CACHE.body, cached: true });
  if (!MT.token()) return res.json({ on: false });
  const wrap = (p) => p.catch((e) => ({ error: /abort|timeout/i.test(e.message) ? "Meta didn't answer in time." : mtLine(e.message) }));
  let who;
  try { who = await mtWho(); } catch (e) { return res.json({ on: true, error: /abort|timeout/i.test(e.message) ? "Meta didn't answer in time." : mtLine(e.message) }); }
  const [instagram, facebook, shop] = await Promise.all([wrap(mtInstagram(who.ig)), wrap(mtFacebook(who.page)), MT.catalog() ? wrap(mtShop(MT.catalog())) : Promise.resolve(null)]);
  MT_CACHE.at = now;
  MT_CACHE.body = { on: true, at: now, page: { id: who.page, name: who.pageName }, instagram, facebook, shop, todo: mtTodo(instagram, facebook, shop) };
  res.json(MT_CACHE.body);
});
