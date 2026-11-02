/* ================================================================
   ADMIN · SYSTEMS · GOOGLE v1.1 — 2026-10-26 (v1.1: a one-time "Link to Merchant Center" — POST /api/admin/systems/google/register). v1.0 — 2026-10-26. Part 2 of "integrate our admin
   dashboard with Google…", "fully integrated to maximize reach": how people
   find LABS on Google Search, and how the market's pieces do on Google
   Shopping — with the moves that would get more of both.
     GET /api/admin/systems/google   (admins only)
   One Google service account reads both, read-only (RAILWAY.md):
     GOOGLE_SERVICE_ACCOUNT  the service account's JSON key, pasted whole
                             (or base64 of it)
     GSC_SITE                the Search Console property, default
                             sc-domain:tnllabs.com (URL-prefix properties:
                             https://tnllabs.com/)
     MERCHANT_ID             the Merchant Center account, default 413920275
   The service account is added as a user in Search Console (Restricted)
   and in Merchant Center (Standard / read). Its key signs a short JWT here
   (node:crypto, no library) that Google trades for a one-hour token; the key
   and the token never leave the server.
   What comes back, 28 days against the 28 before:
     search  — clicks, impressions, CTR, position and their change; a line
               per day; top searches and pages; "close to page 1" searches
               (seen a lot, ranked 5–20); pages seen a lot but rarely
               clicked (their title/description is the fix); phone vs
               computer; countries; the sitemaps Google has.
     shopping — every piece's state on free listings (live, pending, not
               shown) and the problems grouped by fix, each naming the
               pieces it holds back (linking to their /m/ page).
     todo    — the few things to do next, worded for Jorge, from the above.
   Cached 10 minutes (30 s floor on Look again), 10 looks a minute per admin.
   test/admin-systems-google.test.mjs runs it against a pretend Google.
================================================================ */
const GG_ENV = (k, d = "") => (process.env[k] || "").trim() || d;
const GG = {
  tokenUrl: () => GG_ENV("GOOGLE_OAUTH_TOKEN_URL", "https://oauth2.googleapis.com/token"),
  gscUrl: () => GG_ENV("GOOGLE_GSC_API_URL", "https://searchconsole.googleapis.com"),
  merchantUrl: () => GG_ENV("GOOGLE_MERCHANT_API_URL", "https://merchantapi.googleapis.com"),
  site: () => GG_ENV("GSC_SITE", "sc-domain:tnllabs.com"),
  merchant: () => GG_ENV("MERCHANT_ID", "413920275").replace(/\D/g, ""),
};
const GG_SCOPES = "https://www.googleapis.com/auth/webmasters.readonly https://www.googleapis.com/auth/content";
const GG_CACHE = { at: 0, body: null }, GG_TOKEN = { value: "", exp: 0, key: "" };
const ggLine = (s) => String(s || "").split("\n")[0].trim().slice(0, 200);
/* The key, as pasted: JSON, or base64 of JSON. Only the three fields we need are kept. */
function ggKey() {
  let raw = GG_ENV("GOOGLE_SERVICE_ACCOUNT");
  if (!raw) return null;
  if (!raw.startsWith("{")) { try { raw = Buffer.from(raw, "base64").toString("utf8"); } catch { return { bad: true }; } }
  try {
    const k = JSON.parse(raw);
    if (!k.client_email || !k.private_key) return { bad: true };
    return { email: String(k.client_email), pem: String(k.private_key).replace(/\\n/g, "\n"), tokenUri: k.token_uri || "" };
  } catch { return { bad: true }; }
}
const ggB64 = (b) => Buffer.from(b).toString("base64").replace(/=+$/, "").replace(/\+/g, "-").replace(/\//g, "_");
/* A one-hour Google token for the service account, kept until five minutes before it runs out. */
async function ggToken(key) {
  const now = Math.floor(Date.now() / 1000);
  if (GG_TOKEN.value && GG_TOKEN.key === key.email && GG_TOKEN.exp - 300 > now) return GG_TOKEN.value;
  const aud = GG.tokenUrl();
  const head = ggB64(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const claims = ggB64(JSON.stringify({ iss: key.email, scope: GG_SCOPES, aud, iat: now, exp: now + 3600 }));
  let sig;
  try { sig = ggB64(cryptoSign("RSA-SHA256", Buffer.from(`${head}.${claims}`), key.pem)); }
  catch { throw new Error("The service account's private key couldn't be read — paste the whole JSON key again."); }
  const r = await fetch(aud, { method: "POST", signal: AbortSignal.timeout(10000), headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer", assertion: `${head}.${claims}.${sig}` }) });
  const j = await r.json().catch(() => ({}));
  if (!r.ok || !j.access_token) throw new Error(`Google didn't accept the service account (${ggLine(j.error_description || j.error || r.status)}).`);
  Object.assign(GG_TOKEN, { value: j.access_token, exp: now + (Number(j.expires_in) || 3600), key: key.email });
  return j.access_token;
}
async function ggFetch(token, url, body, ms = 12000) {
  const r = await fetch(url, { method: body ? "POST" : "GET", signal: AbortSignal.timeout(ms),
    headers: { Authorization: `Bearer ${token}`, ...(body ? { "Content-Type": "application/json" } : {}) }, ...(body ? { body: JSON.stringify(body) } : {}) });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) {
    const msg = ggLine(j.error?.message || `answered ${r.status}`);
    const e = new Error(r.status === 403 ? `Google says no access (${msg}). Is the service account added as a user there?` : r.status === 404 ? `Google can't find it (${msg}).` : msg);
    e.status = r.status; throw e;
  }
  return j;
}
const ggDay = (d) => new Date(d).toISOString().slice(0, 10);
const ggPct = (a, b) => (b ? Math.round(((a - b) / b) * 1000) / 10 : null);
const ggRound = (n, p = 1) => Math.round((Number(n) || 0) * 10 ** p) / 10 ** p;
/* A page on tnllabs.com, as a path the admin can open; anything else stays as Google gave it, shown as text only. */
const ggPath = (u) => { try { const x = new URL(u); return /(^|\.)tnllabs\.com$/.test(x.hostname) && /^\/(?![\/\\])/.test(x.pathname) ? x.pathname + x.search : ""; } catch { return ""; } };   // one slash: "//evil.com" would leave the site

async function ggSearch(token) {
  const site = GG.site(), base = `${GG.gscUrl()}/webmasters/v3/sites/${encodeURIComponent(site)}`;
  /* Search data runs about two days behind: the window ends two days ago. */
  const end = Date.now() - 2 * 86400000, D28 = 28 * 86400000;
  const cur = { startDate: ggDay(end - D28 + 86400000), endDate: ggDay(end) }, prev = { startDate: ggDay(end - 2 * D28 + 86400000), endDate: ggDay(end - D28) };
  const q = (range, dims, rowLimit = 25, extra = {}) => ggFetch(token, `${base}/searchAnalytics/query`, { ...range, dimensions: dims, rowLimit, dataState: "all", ...extra });
  const [tot, totPrev, days, queries, pages, devices, countries, maps] = await Promise.all([
    q(cur, [], 1), q(prev, [], 1), q(cur, ["date"], 40), q(cur, ["query"], 250), q(cur, ["page"], 100), q(cur, ["device"], 5), q(cur, ["country"], 6),
    ggFetch(token, `${base}/sitemaps`).catch(() => ({ sitemap: [] })) ]);
  const t = (tot.rows || [])[0] || {}, p = (totPrev.rows || [])[0] || {};
  const row = (r) => ({ clicks: r.clicks || 0, impressions: r.impressions || 0, ctr: ggRound((r.ctr || 0) * 100), position: ggRound(r.position || 0) });
  const key0 = (r) => String((r.keys || [])[0] || "");
  const Q = (queries.rows || []).filter((r) => key0(r)).map((r) => ({ query: key0(r).slice(0, 120), ...row(r) }));
  const P = (pages.rows || []).filter((r) => key0(r)).map((r) => ({ url: key0(r).slice(0, 300), path: ggPath(key0(r)), ...row(r) }));
  return {
    site, range: cur,
    totals: { ...row(t), prev: row(p), change: { clicks: ggPct(t.clicks || 0, p.clicks || 0), impressions: ggPct(t.impressions || 0, p.impressions || 0) } },
    days: (days.rows || []).filter((r) => key0(r)).map((r) => ({ day: key0(r), clicks: r.clicks || 0, impressions: r.impressions || 0 })),
    queries: Q.slice(0, 25), pages: P.slice(0, 15),
    /* the reach moves: searches already seen, just off page 1; pages seen a lot but rarely chosen */
    closeToTop: Q.filter((x) => x.position >= 5 && x.position <= 20 && x.impressions >= 10).sort((a, b) => b.impressions - a.impressions).slice(0, 10),
    lowClicks: P.filter((x) => x.path && x.impressions >= 50 && x.ctr < 2).sort((a, b) => b.impressions - a.impressions).slice(0, 8),
    devices: (devices.rows || []).filter((r) => key0(r)).map((r) => ({ device: key0(r).toLowerCase(), clicks: r.clicks || 0, impressions: r.impressions || 0 })),
    countries: (countries.rows || []).filter((r) => key0(r)).map((r) => ({ country: key0(r).toUpperCase().slice(0, 3), clicks: r.clicks || 0, impressions: r.impressions || 0 })),
    sitemaps: (maps.sitemap || []).map((m) => ({ path: String(m.path || "").slice(0, 200), lastDownloaded: Date.parse(m.lastDownloaded || "") || null,
      errors: Number(m.errors) || 0, warnings: Number(m.warnings) || 0, pending: !!m.isPending,
      submitted: (m.contents || []).reduce((n, c) => n + (Number(c.submitted) || 0), 0) })),
  };
}

/* Free listings first: that's where LABS shows up without paying. */
function ggState(st) {
  const ds = st?.destinationStatuses || [];
  const free = ds.filter((d) => /FREE_LISTINGS/i.test(d.reportingContext || "")), use = free.length ? free : ds;
  if (use.some((d) => (d.disapprovedCountries || []).length)) return "notShown";
  if (use.some((d) => (d.approvedCountries || []).length)) return "live";
  return "pending";
}
async function ggShopping(token) {
  const id = GG.merchant();
  if (!id) return { error: "MERCHANT_ID isn't a number." };
  const products = [];
  let page = "";
  for (let i = 0; i < 4; i++) {   // up to 1,000 pieces
    const j = await ggFetch(token, `${GG.merchantUrl()}/products/v1/accounts/${id}/products?pageSize=250${page ? "&pageToken=" + encodeURIComponent(page) : ""}`, null, 6000);
    products.push(...(j.products || []));
    if (!j.nextPageToken) break; page = j.nextPageToken;
  }
  const counts = { live: 0, pending: 0, notShown: 0 }, issues = new Map();
  for (const p of products) {
    const st = ggState(p.productStatus); counts[st]++;
    const offer = String(p.offerId || ""), m = /^labs-(\d+)/.exec(offer);
    const piece = { title: String(p.productAttributes?.title || p.attributes?.title || offer).slice(0, 120), offerId: offer.slice(0, 60), path: m ? `/m/${m[1]}` : "" };
    for (const is of p.productStatus?.itemLevelIssues || []) {
      if (is.reportingContext && !/FREE_LISTINGS/i.test(is.reportingContext) && issues.has(is.code)) continue;
      const k = String(is.code || is.description || "issue");
      const g = issues.get(k) || { code: k.slice(0, 80), severity: ["DISAPPROVED", "DEMOTED", "NOT_IMPACTED"].includes(String(is.severity || "").toUpperCase()) ? String(is.severity).toUpperCase() : "", description: ggLine(is.description), detail: ggLine(is.detail),
        attribute: String(is.attribute || "").slice(0, 60), fixBy: is.resolution === "MERCHANT_ACTION" ? "you" : is.resolution ? "google" : "", pieces: [] };
      if (!g.pieces.some((x) => x.offerId === piece.offerId)) g.pieces.push(piece);
      issues.set(k, g);
    }
  }
  const order = { DISAPPROVED: 0, DEMOTED: 1, NOT_IMPACTED: 2 };
  const list = [...issues.values()].map((g) => ({ ...g, count: g.pieces.length, pieces: g.pieces.slice(0, 6) }))
    .sort((a, b) => (order[a.severity] ?? 3) - (order[b.severity] ?? 3) || b.count - a.count).slice(0, 12);
  return { merchantId: id, total: products.length, counts, issues: list };
}

/* The few things worth doing next, in plain words. */
function ggTodo(search, shop) {
  const out = [];
  if (search && !search.error) {
    if (!search.sitemaps.length) out.push({ kind: "sitemap", text: "Google has no sitemap for LABS. In Search Console → Sitemaps, submit sitemap.xml." });
    else if (search.sitemaps.some((m) => m.errors)) out.push({ kind: "sitemap", text: "Google found errors in the sitemap. Open Search Console → Sitemaps to see which." });
    for (const x of search.closeToTop.slice(0, 3)) out.push({ kind: "search", text: `"${x.query}" was seen ${x.impressions} times but ranks around ${Math.round(x.position)}. A post, listing or lab with those words in its title could move it onto page 1.` });
    for (const x of search.lowClicks.slice(0, 2)) out.push({ kind: "page", path: x.path, text: `${x.path || x.url} shows up a lot (${x.impressions} times) but only ${x.ctr}% click. Its title and first line are what people see — make them say what it is.` });
  }
  if (shop && !shop.error) {
    const fix = shop.issues.filter((g) => g.fixBy === "you" && g.severity === "DISAPPROVED");
    for (const g of fix.slice(0, 3)) out.push({ kind: "shopping", text: `${g.count} piece${g.count === 1 ? " isn't" : "s aren't"} on Google Shopping: ${g.description}${g.detail ? " — " + g.detail : ""}` });
    if (shop.total === 0) out.push({ kind: "shopping", text: "Merchant Center has no pieces yet. Products → Add products → link https://tnllabs.com/feeds/google.csv, daily." });
  }
  return out.slice(0, 8);
}

app.get("/api/admin/systems/google", auth, admin, rateLimit({ max: 10, windowMs: 60000, key: "user" }), async (req, res) => {
  const now = Date.now();
  if (GG_CACHE.body && now - GG_CACHE.at < (req.query.fresh ? 30000 : 600000)) return res.json({ ...GG_CACHE.body, cached: true });
  const key = ggKey();
  if (!key) return res.json({ on: false });
  if (key.bad) return res.json({ on: true, error: "GOOGLE_SERVICE_ACCOUNT isn't a service account's JSON key. Paste the whole file again." });
  let token;
  try { token = await ggToken(key); }
  catch (e) { return res.json({ on: true, account: key.email, error: /abort|timeout/i.test(e.message) ? "Google didn't answer in time." : ggLine(e.message) }); }
  const wrap = (p) => p.catch((e) => ({ error: /abort|timeout/i.test(e.message) ? "Google didn't answer in time." : ggLine(e.message) }));
  const [search, shopping] = await Promise.all([wrap(ggSearch(token)), wrap(ggShopping(token))]);
  GG_CACHE.at = now;
  GG_CACHE.body = { on: true, at: now, account: key.email, search, shopping, todo: ggTodo(search, shopping) };
  res.json(GG_CACHE.body);
});

/* Link the Cloud project to Merchant Center, once (v1.1, 2026-10-26). The Merchant API answers "GCP project … is not
   registered with the merchant account" until the project is registered, and Google only takes that from an account
   with Admin in Merchant Center: give the service account Admin, tap the button, then set it back to Standard.
   Nothing from the page goes to Google but the tap; the developer email is the admin's own, from their account. */
app.post("/api/admin/systems/google/register", auth, admin, rateLimit({ max: 5, windowMs: 600000, key: "user" }), async (req, res) => {
  const key = ggKey();
  if (!key || key.bad) return res.status(400).json({ error: "The Google key isn't set." });
  const id = GG.merchant();
  if (!id) return res.status(400).json({ error: "MERCHANT_ID isn't a number." });
  try {
    const token = await ggToken(key);
    const email = /^[^@\s]+@(gmail\.com|googlemail\.com|[a-z0-9.-]+\.[a-z]{2,})$/i.test(String(req.user.email || "")) && !/gserviceaccount\.com$/i.test(req.user.email) ? req.user.email : "";
    await ggFetch(token, `${GG.merchantUrl()}/accounts/v1/accounts/${id}/developerRegistration:registerGcp`, email ? { developerEmail: email } : {});
    GG_CACHE.body = null; GG_CACHE.at = 0;
    res.json({ ok: true });
  } catch (e) {
    const m = ggLine(e.message);
    res.status(400).json({ error: e.status === 403 || /permission|admin/i.test(m) ? "Google needs the service account to be an Admin in Merchant Center for this one step. Set it to Admin, tap again, then set it back." : m });
  }
});
