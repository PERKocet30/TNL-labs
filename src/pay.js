/* ================================================================
   PAYMENTS v3.1 — 2026-10-19 — Stripe Connect, over the plain HTTP API.
   v3.1: Express with Stripe keeping the risk ("Stripe-managed risk"), asked
   for first. Then the seller pays their own card fee as on Standard (kind
   "express_stripe": no card fee in our cut, pay-later stays on) and LABS
   covers nobody's refunds. If Stripe won't do that for this platform, it's
   v3.0's Express (kind "express": LABS pays the card fee and carries the
   risk), and failing that Standard.
   v3.0: Express for new sellers. "Setting up an account to sell is really
   complicated" — Standard is Stripe's full business signup (an authenticator
   app, a website, a business description, support details, a statement
   descriptor). New sellers now get Stripe's short signup (name, birthday,
   last 4 of SSN, bank, a text code): LABS fills in the rest — their LABS
   page as the website, their name on buyers' statements — and Stripe only
   asks what's due now. The money moves the same way (a direct charge on
   the seller's account), but for these accounts LABS pays Stripe's card
   fee and is on the hook if a seller can't cover a refund. So:
     · the application fee = commission + the card fee, and the seller nets
       exactly what they did on Standard (what the listing form promises);
     · buy-now-pay-later is left out for them (Stripe charges ~6% for it,
       which the card-fee estimate wouldn't cover);
     · sellers who already finished Standard keep it. Until Stripe → Connect
       has Express switched on (the platform profile's loss acknowledgement),
       creating one fails and we quietly make a Standard account instead —
       selling never stops.
   v2.0: more ways to pay. Checkout shows whatever the seller has switched
   on in their own Stripe (Apple Pay and Google Pay ride on cards; Cash App
   Pay, Klarna, Link…), minus the ones that take days to clear. If Stripe
   refuses that, it falls back to cards — the 2026-10-07 fix — so a seller
   with nothing switched on can still sell. verifySession also says when a
   payment is still clearing, so nobody is told it failed.

   HOW THIS MODEL WORKS (and why it's the free one):
   Each seller connects their OWN Stripe account. We create the charge
   ON that account (a "direct charge") and take a cut via
   application_fee_amount. Stripe bills the SELLER for processing and
   pays them out directly — so Stripe charges the platform nothing for
   Connect itself: no $2/month per account, no payout fees. Stripe also
   owns their KYC, 1099s and payouts, which keeps you out of money
   transmission territory. That's the whole point of Standard.

   Set to switch payments on:
     STRIPE_SECRET_KEY=sk_test_… (or sk_live_…)
     PLATFORM_FEE_PCT=10          (your commission %, default 10)
     PUBLIC_URL=https://your-app.up.railway.app

   Without a key everything still works — orders are created and buyer
   and seller settle up directly. Nothing pretends to charge anyone.
================================================================ */

const KEY = process.env.STRIPE_SECRET_KEY || "";
export const PAYMENTS_ENABLED = !!KEY;

/* The fee is no longer one flat number — it's set by the seller's level,
   so this just clamps whatever the caller worked out. See FEE_BY_LEVEL
   in db.js for the ladder. */
export function platformFee(amountCents, pct) {
  const p = Math.min(30, Math.max(0, Number(pct ?? 10)));
  return Math.round(amountCents * (p / 100));
}

function formEncode(obj, prefix = "", out = []) {
  for (const [k, v] of Object.entries(obj)) {
    if (v === undefined || v === null) continue;
    const key = prefix ? `${prefix}[${k}]` : k;
    if (typeof v === "object" && !Array.isArray(v)) formEncode(v, key, out);
    else if (Array.isArray(v)) v.forEach((item, i) => {
      if (typeof item === "object") formEncode(item, `${key}[${i}]`, out);
      else out.push(`${encodeURIComponent(`${key}[${i}]`)}=${encodeURIComponent(item)}`);
    });
    else out.push(`${encodeURIComponent(key)}=${encodeURIComponent(v)}`);
  }
  return out.join("&");
}

/** One call to Stripe's HTTP API. → the JSON Stripe answered, or { error } when it refused.
 *  @param {string} path
 *  @param {{ method?: string, body?: any, account?: string, version?: string }} [o]
 *  @returns {Promise<any>} */
async function stripe(path, { method = "POST", body, account, version } = {}) {
  const headers = { Authorization: `Bearer ${KEY}` };
  if (account) headers["Stripe-Account"] = account;   // act as the connected account
  if (version) headers["Stripe-Version"] = version;   // just this request (only its url and id are read)
  if (body) headers["Content-Type"] = "application/x-www-form-urlencoded";
  const res = await fetch(`https://api.stripe.com/v1/${path}`, {
    method, headers, body: body ? formEncode(body) : undefined,
  });
  /** @type {any} */
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const msg = data?.error?.message || `stripe ${res.status}`;
    console.error("[stripe]", path, msg);
    return { error: msg };
  }
  return data;
}

/* ---------------- seller onboarding ---------------- */

/* What a buyer sees on their card statement: LABS and the seller, so nobody
   disputes a charge they don't recognise. 5–22 characters, letters needed,
   none of < > \\ ' " *. */
export function statementName(username) {
  const u = String(username || "").toUpperCase().replace(/[^A-Z0-9 .-]/g, "");
  return ("LABS " + u).trim().slice(0, 22);
}
/* Express: Stripe's short signup. The platform pays the card fee and covers
   losses; Stripe still checks who they are. Everything LABS already knows is
   filled in before the first link (after it, Stripe won't let us). */
const expressBody = ({ email, username, profileUrl }, stripeRisk) => ({
  controller: { stripe_dashboard: { type: "express" }, requirement_collection: "stripe",
    ...(stripeRisk ? { fees: { payer: "account" }, losses: { payments: "stripe" } }       // Stripe carries it, seller pays Stripe
                   : { fees: { payer: "application" }, losses: { payments: "application" } }) },
  country: "US", email, business_type: "individual",
  capabilities: { card_payments: { requested: true }, transfers: { requested: true } },
  business_profile: { url: profileUrl, product_description: "Sells their own work (clothing, art, music) on LABS, a marketplace for creatives." },
  settings: { payments: { statement_descriptor: statementName(username) } },
});

/** Either Express: the short signup and the payouts page. Only plain
 *  "express" has LABS paying the card fee (platformPaysStripe). */
export const isExpress = (kind) => String(kind || "").startsWith("express");

/** Make a seller's Stripe account: Express if the platform has it switched on,
 *  else Standard (with their LABS page filled in as the website). → { id, kind } */
/** @param {{ email?: string, username?: string, profileUrl?: string, expressOnly?: boolean }} [o] */
export async function createSellerAccount({ email, username, profileUrl, expressOnly = false } = {}) {
  if (!KEY) return { error: "payments not configured" };
  const sm = await stripe("accounts", { body: expressBody({ email, username, profileUrl }, true) });
  if (!sm.error) return { id: sm.id, kind: "express_stripe" };
  const ex = await stripe("accounts", { body: expressBody({ email, username, profileUrl }, false) });
  if (!ex.error) return { id: ex.id, kind: "express" };
  if (expressOnly) return ex;
  const out = await stripe("accounts", { body: { type: "standard", email, business_profile: profileUrl ? { url: profileUrl } : undefined } });
  if (out.error) return out;
  return { id: out.id, kind: "standard" };
}

/** A one-time link that walks the seller through Stripe's onboarding. On
 *  Express it asks only what's due now; the rest waits until it's needed. */
export async function onboardingLink(accountId, refreshUrl, returnUrl, kind) {
  if (!KEY) return { error: "payments not configured" };
  const out = await stripe("account_links", {
    body: { account: accountId, refresh_url: refreshUrl, return_url: returnUrl, type: "account_onboarding",
      ...(isExpress(kind) ? { collection_options: { fields: "currently_due", future_requirements: "omit" } } : {}) },
  });
  if (out.error) return out;
  return { url: out.url };
}

/** Has Stripe actually cleared them to take money yet? */
export async function accountStatus(accountId) {
  if (!KEY) return { ready: false };
  const out = await stripe(`accounts/${encodeURIComponent(accountId)}`, { method: "GET" });
  if (out.error) return { ready: false, error: out.error };
  return {
    ready: !!out.charges_enabled,
    payoutsEnabled: !!out.payouts_enabled,
    detailsSubmitted: !!out.details_submitted,
    needs: out.requirements?.currently_due || [],
  };
}

/** Express sellers get a one-time link into their payouts page (Stripe texts
 *  them a code). Standard sellers sign in to their own full Stripe dashboard —
 *  login_links errors on those ("does not have access to the Express Dashboard"). */
export async function loginLink(accountId, kind) {
  if (!isExpress(kind)) return { url: "https://dashboard.stripe.com" };
  if (!KEY) return { error: "payments not configured" };
  const out = await stripe(`accounts/${encodeURIComponent(accountId)}/login_links`, {});
  if (out.error) return out;
  return { url: out.url };
}

/* ---------------- checkout ---------------- */

/* Ways to pay that take days to clear. The order would sit "processing"
   while the buyer waits, so Checkout leaves them out. */
export const SLOW_METHODS = ["us_bank_account", "acss_debit", "sepa_debit", "bacs_debit", "au_becs_debit",
  "boleto", "oxxo", "konbini", "customer_balance", "multibanco", "pay_by_bank", "pix"];
/* Pay-later costs ~6%: fine when the seller pays Stripe (Standard), not
   when LABS does on a card-fee estimate (Express). */
export const PAY_LATER = ["klarna", "affirm", "afterpay_clearpay", "zip"];
/* Stripe's US card price, which LABS pays for Express sellers and passes on
   inside the application fee — so they keep what the listing form says. */
export const cardFee = (cents) => Math.round(cents * 0.029) + 30;

/**
 * Direct charge on the SELLER's account, with our commission taken as
 * application_fee_amount. A Standard seller pays Stripe's processing fee
 * out of their side (that's what makes Standard free for the platform); for
 * an Express seller LABS pays it, so the fee carries it (platformPaysStripe).
 */
export async function createCheckout({
  orderId, title, amountCents, shippingCents, currency = "usd",
  successUrl, cancelUrl, buyerEmail, sellerAccount, feePct, collectShipping = false,
  items = null,   // a bag: [{ title, amountCents }] — amountCents is then their sum
  platformPaysStripe = false,   // an Express seller: LABS pays the card fee, so it rides in the fee
}) {
  if (!KEY) return { error: "payments not configured" };
  if (!sellerAccount) return { error: "seller hasn't connected payouts yet" };

  const line_items = (items || [{ title, amountCents }]).map((it) => ({
    quantity: 1,
    price_data: { currency, unit_amount: it.amountCents, product_data: { name: String(it.title).slice(0, 120) } },
  }));
  if (shippingCents > 0) {
    line_items.push({
      quantity: 1,
      price_data: { currency, unit_amount: shippingCents, product_data: { name: "Shipping" } },
    });
  }

  /* Our commission is on the item only. For an Express seller Stripe bills LABS
     for the card fee on the whole charge (shipping too), so that's added on. */
  const appFee = Math.min(amountCents + (shippingCents || 0) - 1,
    platformFee(amountCents, feePct) + (platformPaysStripe ? cardFee(amountCents + (shippingCents || 0)) : 0));
  const body = (methods) => ({
      mode: "payment",
      ...methods,
      success_url: successUrl,
      cancel_url: cancelUrl,
      client_reference_id: String(orderId),
      customer_email: buyerEmail || undefined,
      metadata: { order_id: String(orderId) },
      line_items,
      // Let Stripe collect + validate the shipping address on its
      // hosted page. No more prompt() dialogs. Digital loops skip this.
      ...(collectShipping ? { shipping_address_collection: { allowed_countries: ["US","CA","GB","NL","DE","FR","IE","ES","IT","PT","BE","AU","NZ"] } } : {}),
      // commission on the item only — we don't skim postage; none at all for an admin (0%)
      ...(appFee > 0 ? { payment_intent_data: { application_fee_amount: appFee } } : {}),
  });
  const skip = platformPaysStripe ? [...SLOW_METHODS, ...PAY_LATER] : SLOW_METHODS;
  /* First ask: the seller's own payment methods, without the slow ones.
     Second ask, only if Stripe refuses the first: cards outright. Left to
     the automatic choice alone, a seller with nothing switched on for the
     currency got "No valid payment method types" and nobody could buy
     (first live checkout, 2026-10-07). Cards cover Apple Pay and Google Pay. */
  let out = await stripe("checkout/sessions", { account: sellerAccount, body: body({ excluded_payment_method_types: skip }),
    version: "2025-09-30.clover" });   // the first API version that can leave methods out
  if (out.error) out = await stripe("checkout/sessions", { account: sellerAccount, body: body({ payment_method_types: ["card"] }) });
  if (out.error) return { error: out.error, setup: /payment method|capabilit|activate|not enabled|charges_enabled/i.test(out.error) };
  return { url: out.url, id: out.id };
}

/** Confirm payment server-side. Never trust the browser redirect. */
export async function verifySession(sessionId, sellerAccount) {
  if (!KEY) return { paid: false };
  const out = await stripe(`checkout/sessions/${encodeURIComponent(sessionId)}`, {
    method: "GET", account: sellerAccount,
  });
  if (out.error) return { paid: false };
  // Pull the address the buyer entered on Stripe's checkout page, so the seller
  // knows where to ship without us ever prompting for it.
  const sd = out.shipping_details || out.collected_information?.shipping_details || null;
  /** @type {null | { name: string, address: string }} */
  let ship = null;
  if (sd?.address) {
    const a = sd.address;
    ship = {
      name: sd.name || "",
      address: [a.line1, a.line2, a.city, [a.state, a.postal_code].filter(Boolean).join(" "), a.country].filter(Boolean).join(", "),
    };
  }
  return { paid: out.payment_status === "paid", orderId: out.metadata?.order_id, amount: out.amount_total, ship,
    // finished on Stripe's side but the money hasn't cleared yet — not a failure
    clearing: out.status === "complete" && out.payment_status === "unpaid" };
}
