// Admin · Systems · Google (2026-10-26): how people find LABS on Google Search
// and how the market's pieces do on Google Shopping, read with one service
// account, and the moves that get more of both. Runs against a pretend Google
// that checks the signed token the way Google does; the key never reaches the page.
import { spawn } from "node:child_process";
import { createServer } from "node:http";
import { generateKeyPairSync, createVerify } from "node:crypto";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { rmSync, mkdirSync, readFileSync } from "node:fs";
const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const DATA = join(ROOT, "test/.tmp/admin-systems-google");
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

/* a service account key, like the JSON Google hands out */
const { publicKey, privateKey } = generateKeyPairSync("rsa", { modulusLength: 2048 });
const KEY = { type: "service_account", client_email: "labs-admin@labs-123.iam.gserviceaccount.com", private_key: privateKey.export({ type: "pkcs8", format: "pem" }), token_uri: "x" };
const seen = { tokenOk: null, scope: "", bearer: null, calls: 0, bodies: [] };
const day = (d) => new Date(now - d * 86400000).toISOString().slice(0, 10);
const fake = createServer((req, res) => {
  let body = ""; req.on("data", (d) => body += d); req.on("end", () => {
    seen.calls++;
    const json = (code, obj) => { res.writeHead(code, { "Content-Type": "application/json" }); res.end(JSON.stringify(obj)); };
    if (req.url === "/token") {
      const p = new URLSearchParams(body), [h, c, s] = String(p.get("assertion") || "").split(".");
      const claims = JSON.parse(Buffer.from(c, "base64url").toString());
      seen.tokenOk = createVerify("RSA-SHA256").update(`${h}.${c}`).verify(publicKey, Buffer.from(s, "base64url")) && claims.iss === KEY.client_email && claims.exp > claims.iat;
      seen.scope = claims.scope;
      if (!seen.tokenOk) return json(400, { error: "invalid_grant", error_description: "Invalid JWT Signature." });
      return json(200, { access_token: "ya29.secret-token", expires_in: 3600 });
    }
    seen.bearer = req.headers.authorization;
    if (seen.bearer !== "Bearer ya29.secret-token") return json(401, { error: { message: "Invalid Credentials" } });
    const u = req.url;
    if (u.includes("/searchAnalytics/query")) {
      const q = JSON.parse(body); seen.bodies.push(q);
      const dims = q.dimensions || [], prev = q.startDate < day(30);
      if (!dims.length) return json(200, { rows: [prev ? { clicks: 40, impressions: 2000, ctr: 0.02, position: 14.2 } : { clicks: 60, impressions: 3000, ctr: 0.02, position: 12.4 }] });
      if (dims[0] === "date") return json(200, { rows: Array.from({ length: 28 }, (_, i) => ({ keys: [day(29 - i)], clicks: i % 3, impressions: 100 + i })) });
      if (dims[0] === "query") return json(200, { rows: [
        { keys: ["tnl labs"], clicks: 30, impressions: 200, ctr: 0.15, position: 1.2 },
        { keys: ["labs art tournament"], clicks: 9, impressions: 400, ctr: 0.0225, position: 8.7 },
        { keys: ["dmv streetwear brands"], clicks: 1, impressions: 900, ctr: 0.001, position: 15.1 },
        { keys: ["tiny"], clicks: 0, impressions: 4, ctr: 0, position: 9 }] });
      if (dims[0] === "page") return json(200, { rows: [
        { keys: ["https://tnllabs.com/"], clicks: 25, impressions: 300, ctr: 0.083, position: 3 },
        { keys: ["https://tnllabs.com/e/art-tournament"], clicks: 2, impressions: 600, ctr: 0.0033, position: 9 },
        { keys: ["https://evil.example/phish"], clicks: 1, impressions: 80, ctr: 0.0125, position: 20 },
        { keys: ["https://tnllabs.com//evil.example/x"], clicks: 1, impressions: 70, ctr: 0.01, position: 20 },
        { clicks: 9, impressions: 9 }] });
      if (dims[0] === "device") return json(200, { rows: [{ keys: ["MOBILE"], clicks: 50, impressions: 2500 }, { keys: ["DESKTOP"], clicks: 10, impressions: 500 }] });
      if (dims[0] === "country") return json(200, { rows: [{ keys: ["usa"], clicks: 55, impressions: 2800 }, { keys: ["gbr"], clicks: 5, impressions: 200 }] });
    }
    if (u.includes("/sitemaps")) return json(200, { sitemap: [{ path: "https://tnllabs.com/sitemap.xml", lastDownloaded: new Date(now - 3600000).toISOString(), errors: "0", warnings: "0", isPending: false, contents: [{ type: "web", submitted: "212", indexed: "67" }] }] });
    if (u.includes("/products/v1/accounts/413920275/products")) return json(200, { products: [
      { offerId: "labs-5", productAttributes: { title: "Drop 01 Tee" }, productStatus: { destinationStatuses: [{ reportingContext: "FREE_LISTINGS", approvedCountries: ["US"] }, { reportingContext: "SHOPPING_ADS", disapprovedCountries: ["US"] }], itemLevelIssues: [] } },
      { offerId: "labs-7-s1", productAttributes: { title: "Camo Shiesty" }, productStatus: { destinationStatuses: [{ reportingContext: "FREE_LISTINGS", disapprovedCountries: ["US"] }],
        itemLevelIssues: [{ code: "image_link_broken", severity: "DISAPPROVED", resolution: "MERCHANT_ACTION", attribute: "image_link", reportingContext: "FREE_LISTINGS", description: "Invalid image", detail: "The picture couldn't be loaded" }] } },
      { offerId: "labs-7-s2", productAttributes: { title: "Camo Shiesty" }, productStatus: { destinationStatuses: [{ reportingContext: "FREE_LISTINGS", disapprovedCountries: ["US"] }],
        itemLevelIssues: [{ code: "image_link_broken", severity: "DISAPPROVED", resolution: "MERCHANT_ACTION", attribute: "image_link", reportingContext: "FREE_LISTINGS", description: "Invalid image", detail: "The picture couldn't be loaded" }] } },
      { offerId: "labs-9", productAttributes: { title: "Poster" }, productStatus: { destinationStatuses: [{ reportingContext: "FREE_LISTINGS", pendingCountries: ["US"] }],
        itemLevelIssues: [{ code: "pending_initial_policy_review", severity: "NOT_IMPACTED", resolution: "PENDING_PROCESSING", reportingContext: "FREE_LISTINGS", description: "Pending initial review" }] } }] });
    if (u.includes("/developerRegistration:registerGcp")) { seen.register = { url: u, body: JSON.parse(body || "{}") };
      return seen.registerAdmin ? json(200, { name: "accounts/413920275/developerRegistration", gcpIds: ["1055774819971"] }) : json(403, { error: { message: "The caller does not have permission" } }); }
    if (u.includes("/products/v1/accounts/2/")) return json(403, { error: { message: "GCP project with id labs-123 and number 1055774819971 is not registered with the merchant account. Please follow these steps https://developers.google.com/merchant/api/guides/quickstart/registration" } });
    if (u.includes("/products/v1/accounts/")) return json(403, { error: { message: "The caller does not have permission" } });
    json(404, { error: { message: "nope" } });
  });
});
await new Promise((r) => fake.listen(0, r));
const FAKE = `http://localhost:${fake.address().port}`;
const PORT = 8919, B = `http://localhost:${PORT}`;
const env = { ...process.env, TNL_DATA: DATA, PORT: String(PORT), STRIPE_SECRET_KEY: "", TNL_NO_VIDEO_FIX: "1", TNL_NO_WATCH: "1",
  GOOGLE_SERVICE_ACCOUNT: JSON.stringify(KEY), GOOGLE_OAUTH_TOKEN_URL: FAKE + "/token", GOOGLE_GSC_API_URL: FAKE, GOOGLE_MERCHANT_API_URL: FAKE, MERCHANT_ID: "413920275" };
const start = (extra = {}) => spawn(process.execPath, ["--experimental-sqlite", "--no-warnings", "src/server.runtime.js"], { cwd: ROOT, env: { ...env, ...extra }, stdio: "ignore" });
const ready = async () => { for (let i = 0; i < 100; i++) { try { if ((await fetch(B + "/api/health")).ok) return; } catch {} await new Promise((r) => setTimeout(r, 100)); } };
const get = (path, who) => fetch(B + path, { headers: who ? { authorization: "Bearer tok-" + who } : {} });
let srv = start();
try {
  await ready();
  console.log("\nADMINS ONLY");
  t("signed out: nothing", (await get("/api/admin/systems/google")).status === 401);
  t("a member: nothing", (await get("/api/admin/systems/google", "ana")).status === 403);

  console.log("\nTHE SERVICE ACCOUNT");
  const r = await get("/api/admin/systems/google", "boss"), G = await r.json(), raw = JSON.stringify(G);
  t("signs a token Google can verify, for Search Console (read) and Merchant Center", r.status === 200 && seen.tokenOk === true && /webmasters\.readonly/.test(seen.scope) && /auth\/content/.test(seen.scope));
  t("then reads with that token", seen.bearer === "Bearer ya29.secret-token");
  t("the key and the token never reach the page", !raw.includes("PRIVATE KEY") && !raw.includes("ya29") && G.account === KEY.client_email);

  console.log("\nGOOGLE SEARCH");
  const S = G.search;
  t("28 days against the 28 before, ending two days ago", S.totals.clicks === 60 && S.totals.prev.clicks === 40 && S.totals.change.clicks === 50 && S.range.endDate === day(2) && S.range.startDate === day(29));
  t("a line per day, the searches and the pages", S.days.length === 28 && S.queries[0].query === "tnl labs" && S.pages[0].path === "/");
  t("close to page 1: seen a lot, ranked 5–20, biggest first; the tiny one left out", S.closeToTop.map((x) => x.query).join("|") === "dmv streetwear brands|labs art tournament");
  t("shown a lot, rarely clicked: the tournament page", S.lowClicks.length === 1 && S.lowClicks[0].path === "/e/art-tournament");
  t("a page off tnllabs.com gets no link (text only) — nor a //host path that would leave the site; a row with no key is skipped",
    S.pages.filter((p) => /evil/.test(p.url)).every((p) => p.path === "") && S.pages.length === 4);
  t("phones vs computers, countries, and the sitemap Google has", S.devices[0].device === "mobile" && S.countries[0].country === "USA" && S.sitemaps[0].submitted === 212 && S.sitemaps[0].errors === 0);

  console.log("\nGOOGLE SHOPPING");
  const P = G.shopping;
  t("every piece's state on free listings (ads don't count)", P.total === 4 && P.counts.live === 1 && P.counts.notShown === 2 && P.counts.pending === 1);
  t("problems grouped by fix, naming the pieces, linking to their page", P.issues[0].code === "image_link_broken" && P.issues[0].count === 2 && P.issues[0].fixBy === "you"
    && P.issues[0].pieces[0].path === "/m/7" && P.issues[0].severity === "DISAPPROVED");
  t("the worst first", P.issues.map((g) => g.severity).join("|") === "DISAPPROVED|NOT_IMPACTED");

  console.log("\nWHAT TO DO NEXT");
  const todo = G.todo.map((x) => x.text).join("\n");
  t("the searches just off page 1, in Jorge's words", /"dmv streetwear brands" was seen 900 times but ranks around 15/.test(todo));
  t("the page that shows up but isn't clicked", /\/e\/art-tournament shows up a lot/.test(todo) && G.todo.find((x) => x.kind === "page").path === "/e/art-tournament");
  t("the pieces Google isn't showing, and why", /2 pieces aren't on Google Shopping: Invalid image — The picture couldn't be loaded/.test(todo));
  t("no sitemap nag when Google has one", !/submit sitemap/.test(todo));

  console.log("\nCACHED");
  const calls = seen.calls;
  t("a second look within ten minutes doesn't ask Google again", (await (await get("/api/admin/systems/google", "boss")).json()).cached === true && seen.calls === calls);

  console.log("\nWHEN THE KEY IS MISSING OR WRONG");
  srv.kill(); await new Promise((r) => setTimeout(r, 300));
  srv = start({ GOOGLE_SERVICE_ACCOUNT: "" }); await ready();
  t("no key: says it's off", (await (await get("/api/admin/systems/google", "boss")).json()).on === false);
  srv.kill(); await new Promise((r) => setTimeout(r, 300));
  srv = start({ GOOGLE_SERVICE_ACCOUNT: "not json at all" }); await ready();
  const bad = await (await get("/api/admin/systems/google", "boss")).json();
  t("a pasted key that isn't one: one plain line", bad.on === true && /isn't a service account's JSON key/.test(bad.error));
  srv.kill(); await new Promise((r) => setTimeout(r, 300));
  srv = start({ GOOGLE_SERVICE_ACCOUNT: JSON.stringify({ ...KEY, private_key: KEY.private_key.replace(/A/g, "B") }) }); await ready();
  const bad2 = await (await get("/api/admin/systems/google", "boss")).json();
  t("a damaged key: Google refuses, said plainly, nothing leaks", bad2.on === true && /couldn't be read|didn't accept/.test(bad2.error) && !JSON.stringify(bad2).includes("PRIVATE KEY"));
  srv.kill(); await new Promise((r) => setTimeout(r, 300));
  srv = start({ MERCHANT_ID: "1" }); await ready();
  const nomc = await (await get("/api/admin/systems/google", "boss")).json();
  t("Merchant Center refusing is one line on that card; Search still comes", /no access/.test(nomc.shopping.error) && nomc.search.totals.clicks === 60);

  console.log("\nLINKING THE PROJECT TO MERCHANT CENTER (ONCE)");
  srv.kill(); await new Promise((r) => setTimeout(r, 300));
  srv = start({ MERCHANT_ID: "2" }); await ready();
  const unreg = await (await get("/api/admin/systems/google", "boss")).json();
  t("Google's 'not registered' comes through so the page can offer the Link", /not registered with the merchant account/.test(unreg.shopping.error));
  const post = (who) => fetch(B + "/api/admin/systems/google/register", { method: "POST", headers: { authorization: "Bearer tok-" + who } });
  t("only admins can link", (await post("ana")).status === 403);
  const noAdmin = await post("boss"), na = await noAdmin.json();
  t("while the service account isn't Admin there: says exactly what to do", noAdmin.status === 400 && /Admin in Merchant Center/.test(na.error));
  t("…and asks Google for this account, with the admin's own email as the developer", seen.register.url.includes("/accounts/v1/accounts/2/developerRegistration:registerGcp") && seen.register.body.developerEmail === "boss@x.com");
  seen.registerAdmin = true;
  const ok = await post("boss");
  t("once it's Admin: linked", ok.status === 200 && (await ok.json()).ok === true);

  console.log("\nTHE PAGE");
  const page = readFileSync(join(ROOT, "public/admin-app/7-systems2-google.js"), "utf8"), html = readFileSync(join(ROOT, "public/admin.html"), "utf8");
  t("its own script, loaded after Systems", /7-systems\.js.*\n.*7-systems2-google\.js/.test(html));
  t("says plainly when the key isn't set", /GOOGLE_SERVICE_ACCOUNT/.test(page));
  t("the to-do list comes first", page.indexOf("To get more reach") < page.indexOf("Google Search <"));
} finally { srv.kill(); fake.close(); }
console.log(`\n  ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
