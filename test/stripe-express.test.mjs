// STRIPE EXPRESS v1.0 — 2026-10-19. "Setting up an account to sell is
// really complicated." New sellers get Stripe's short signup (Express):
// LABS fills in what it knows, Stripe asks only what's due now. LABS then
// pays the card fee for them, so it rides inside the application fee and
// the seller keeps what the listing form promised. Sellers who finished
// the long (Standard) signup keep it; anyone stuck halfway starts again the
// short way. If Stripe hasn't switched Express on for the platform yet,
// nothing breaks: new sellers get Standard as before.
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { mkdirSync, rmSync, readFileSync } from "node:fs";
const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const TMP = join(ROOT, "test", ".tmp", "stripe-express");
rmSync(TMP, { recursive: true, force: true }); mkdirSync(TMP, { recursive: true });
process.env.TNL_DATA = TMP;
process.env.STRIPE_SECRET_KEY = "sk_test_x";
let pass = 0, fail = 0;
const t = (n, ok) => { ok ? pass++ : fail++; console.log("  " + (ok ? "✓" : "✗") + "  " + n); };

/* A pretend Stripe: answers by path; `refuseExpress` plays a platform that
   hasn't switched Express on; `acctState` is what GET /accounts/:id says. */
let calls = [], refuseExpress = false, acctState = {}, nextId = 1;
globalThis.fetch = async (url, o) => {
  const path = String(url).replace("https://api.stripe.com/v1/", ""), body = decodeURIComponent(o.body || "");
  calls.push({ path, body, method: o.method, headers: o.headers });
  const ok = (j) => ({ ok: true, status: 200, json: async () => j });
  const no = (m) => ({ ok: false, status: 400, json: async () => ({ error: { message: m } }) });
  if (path === "accounts" && body.includes("controller[")) return refuseExpress ? no("Please review the responsibilities of managing losses for connected accounts") : ok({ id: "acct_ex" + nextId++ });
  if (path === "accounts") return ok({ id: "acct_std" + nextId++ });
  if (path === "account_links") return ok({ url: "https://connect.stripe.com/setup/x" });
  if (/^accounts\/[^/]+\/login_links$/.test(path)) return ok({ url: "https://connect.stripe.com/express/login/x" });
  if (/^accounts\/[^/]+$/.test(path)) return ok(acctState[path.split("/")[1]] || {});
  if (path === "checkout/sessions") return ok({ id: "cs_1", url: "https://checkout.stripe.com/x" });
  return no("unexpected " + path);
};
const pay = await import(join(ROOT, "src/pay.js"));

console.log("\nTHE SHORT SIGNUP");
calls = [];
let r = await pay.createSellerAccount({ email: "m@x.com", username: "bymauriciofuentes", profileUrl: "https://tnllabs.com/u/bymauriciofuentes" });
let b = calls[0].body;
t("a new seller gets Express", r.kind === "express" && r.id.startsWith("acct_ex") && calls.length === 1);
t("…the Express dashboard, Stripe checking who they are", b.includes("controller[stripe_dashboard][type]=express") && b.includes("controller[requirement_collection]=stripe"));
t("…LABS pays the card fee and covers losses (that's what Express is)", b.includes("controller[fees][payer]=application") && b.includes("controller[losses][payments]=application"));
t("…their LABS page is the website (no 'your website' screen)", b.includes("business_profile[url]=https://tnllabs.com/u/bymauriciofuentes") && b.includes("business_profile[product_description]="));
t("…an individual in the US, cards and payouts asked for", b.includes("business_type=individual") && b.includes("country=US") && b.includes("capabilities[card_payments][requested]=true") && b.includes("capabilities[transfers][requested]=true"));
t("…and buyers' statements say LABS and who they bought from", b.includes("settings[payments][statement_descriptor]=LABS BYMAURICIOFUENTES"));
t("the statement name fits Stripe's rules (5–22 characters, letters, no odd symbols)",
  pay.statementName("bymauriciofuentes").length <= 22 && pay.statementName("ab") === "LABS AB" && pay.statementName("o'neil*<x>") === "LABS ONEILX" && pay.statementName("a_very_long_username_indeed").length === 22);
calls = []; refuseExpress = true;
r = await pay.createSellerAccount({ email: "m@x.com", username: "m", profileUrl: "https://tnllabs.com/u/m" });
t("Express not switched on yet: a Standard account instead — selling never stops", r.kind === "standard" && calls.length === 2 && calls[1].body.includes("type=standard") && calls[1].body.includes("business_profile[url]=https://tnllabs.com/u/m"));
calls = [];
r = await pay.createSellerAccount({ email: "m@x.com", username: "m", expressOnly: true });
t("…unless only Express will do: then nothing is made (no spare accounts)", !!r.error && calls.length === 1);
refuseExpress = false;

calls = [];
await pay.onboardingLink("acct_ex1", "https://x/r", "https://x/d", "express");
t("Express asks only what's due now; the rest waits until it's needed", calls[0].body.includes("collection_options[fields]=currently_due") && calls[0].body.includes("collection_options[future_requirements]=omit"));
calls = [];
await pay.onboardingLink("acct_std1", "https://x/r", "https://x/d", "standard");
t("Standard's link is as it was", !calls[0].body.includes("collection_options"));

calls = [];
r = await pay.loginLink("acct_ex1", "express");
t("'Your payouts' opens their Express page with a one-time link", r.url === "https://connect.stripe.com/express/login/x" && calls[0].path === "accounts/acct_ex1/login_links");
calls = [];
r = await pay.loginLink("acct_std1", "");
t("…a Standard seller still signs in to their own Stripe", r.url === "https://dashboard.stripe.com" && calls.length === 0);

console.log("\nTHE SELLER KEEPS THE SAME");
const base = { orderId: 7, title: "Hoodie", amountCents: 5000, shippingCents: 800, successUrl: "https://x/d", cancelUrl: "https://x/n", sellerAccount: "acct_ex1", feePct: 4, collectShipping: true };
calls = []; await pay.createCheckout({ ...base, platformPaysStripe: true });
b = calls[0].body;
t("Express: the fee is the commission plus the card fee LABS now pays (4% of $50 + 2.9% of $58 + 30¢ = $3.98)", pay.cardFee(5800) === 198 && b.includes("application_fee_amount]=398"));
t("…so they net what Standard paid them ($58 − $2 − $1.98)", 5800 - 398 === 5800 - 200 - pay.cardFee(5800));
t("…pay-later is left out for them (it costs ~6%, not 2.9%)", b.includes("klarna") && b.includes("affirm") && b.includes("afterpay_clearpay"));
calls = []; await pay.createCheckout({ ...base, feePct: 0, platformPaysStripe: true });
t("an admin on Express: no commission, just the card fee", calls[0].body.includes("application_fee_amount]=198"));
calls = []; await pay.createCheckout({ ...base });
t("Standard is untouched: commission only, pay-later still offered", calls[0].body.includes("application_fee_amount]=200") && !calls[0].body.includes("klarna"));
calls = []; await pay.createCheckout({ ...base, amountCents: 20, shippingCents: 0, platformPaysStripe: true });
t("a tiny sale: the fee never reaches the whole charge", calls[0].body.includes("application_fee_amount]=19"));

console.log("\nSET UP PAYOUTS (the route)");
const { db } = await import(ROOT + "/src/db.js");
const now = Date.now();
const U = (n, acct = "", kind = "") => Number(db.prepare(`INSERT INTO users (username,display_name,email,role,password_hash,email_verified,stripe_account,stripe_kind,rep,created_at) VALUES (?,?,?,?,?,1,?,?,0,?)`)
  .run(n, n, n + "@x.com", "Model", "h", acct, kind, now).lastInsertRowid);
const me = (id) => db.prepare(`SELECT * FROM users WHERE id=?`).get(id);
const src = readFileSync(join(ROOT, "src/server-06-settings-payouts-market.js"), "utf8");
const part = src.slice(src.indexOf("/* ---- seller payouts"), src.indexOf('app.get("/api/market", maybeAuth'));
const routes = {};
new Function("app", "auth", "verified", "db", "PAYMENTS_ENABLED", "baseUrl", "createSellerAccount", "onboardingLink", "accountStatus", "loginLink", part)(
  { post: (p, ...h) => { routes["POST " + p] = h.at(-1); }, get: (p, ...h) => { routes["GET " + p] = h.at(-1); } },
  null, null, db, true, () => "https://tnllabs.com", pay.createSellerAccount, pay.onboardingLink, pay.accountStatus, pay.loginLink);
const hit = async (k, uid) => { let out = null, code = 200; await routes[k]({ user: me(uid) }, { status(c) { code = c; return this; }, json(j) { out = j; } }); return { code, ...out }; };

let id = U("newbie"); calls = [];
r = await hit("POST /api/market/connect", id);
t("a new seller: an Express account, and straight into Stripe's short signup", me(id).stripe_kind === "express" && me(id).stripe_account.startsWith("acct_ex") && r.url && calls.some((c) => c.body.includes("collection_options[fields]=currently_due")));
t("…with their LABS page as the website", calls[0].body.includes("business_profile[url]=https://tnllabs.com/u/newbie"));
calls = []; r = await hit("POST /api/market/connect", id);
t("'Finish setup' later reuses it (no second account)", calls.filter((c) => c.path === "accounts").length === 0 && r.url);

id = U("halfway", "acct_old1", ""); acctState.acct_old1 = { charges_enabled: false, details_submitted: false };
calls = []; r = await hit("POST /api/market/connect", id);
t("stuck halfway through the long signup: starts again the short way", me(id).stripe_kind === "express" && me(id).stripe_account !== "acct_old1" && r.url);

id = U("finished", "acct_old2", ""); acctState.acct_old2 = { charges_enabled: true, details_submitted: true };
calls = []; r = await hit("POST /api/market/connect", id);
t("finished the long signup: keeps their account", me(id).stripe_account === "acct_old2" && !calls.some((c) => c.path === "accounts") && !calls.some((c) => c.body.includes("collection_options")));

id = U("waiting", "acct_old3", ""); acctState.acct_old3 = { charges_enabled: false, details_submitted: true };
calls = []; await hit("POST /api/market/connect", id);
t("submitted and waiting on Stripe's review: keeps it too", me(id).stripe_account === "acct_old3");

refuseExpress = true;
id = U("stuck2", "acct_old4", ""); acctState.acct_old4 = { charges_enabled: false, details_submitted: false };
calls = []; r = await hit("POST /api/market/connect", id);
t("stuck, and Express isn't on yet: carries on with theirs, no spare account made", me(id).stripe_account === "acct_old4" && calls.filter((c) => c.path === "accounts").length === 1 && r.url);
id = U("new2"); r = await hit("POST /api/market/connect", id);
t("new, and Express isn't on yet: Standard, as before", me(id).stripe_kind === "standard" && r.url);
refuseExpress = false;

id = U("ex", "acct_ex9", "express"); calls = [];
r = await hit("GET /api/market/connect/dashboard", id);
t("'Your payouts' for an Express seller: their one-time link", r.url === "https://connect.stripe.com/express/login/x");

console.log("\nWIRED IN");
const read = (f) => readFileSync(join(ROOT, "src", f), "utf8");
t("both checkouts (one item, a bag) tell pay.js who pays Stripe", read("server-07-orders-sharing.js").includes('platformPaysStripe: seller.stripe_kind === "express"') && read("server-07-cart.js").includes('platformPaysStripe: seller.stripe_kind === "express"'));
t("an Express seller who can't take cards yet is told to finish payouts, not to dig in Stripe settings", read("server-07-cart.js").includes("your payouts aren't finished yet"));
const sell = read("app-14-detail-sell.js");
t("the app says 'Set up payouts', not 'Connect Stripe'", !sell.includes("Connect Stripe") && sell.includes("Set up payouts") && sell.includes("Your payouts"));
console.log(`\n  ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
