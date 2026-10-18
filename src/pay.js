/* ================================================================
   PAYMENTS v2.0 — 2026-10-18 — Stripe Standard Connect, over the plain HTTP API.
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

async function stripe(path, { method = "POST", body, account, version } = {}) {
  const headers = { Authorization: `Bearer ${KEY}` };
  if (account) headers["Stripe-Account"] = account;   // act as the connected account
  if (version) headers["Stripe-Version"] = version;   // just this request (only its url and id are read)
  if (body) headers["Content-Type"] = "application/x-www-form-urlencoded";
  const res = await fetch(`https://api.stripe.com/v1/${path}`, {
    method, headers, body: body ? formEncode(body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const msg = data?.error?.message || `stripe ${res.status}`;
    console.error("[stripe]", path, msg);
    return { error: msg };
  }
  return data;
}

/* ---------------- seller onboarding ---------------- */

/** Create a Standard connected account for a seller. */
export async function createSellerAccount(email) {
  if (!KEY) return { error: "payments not configured" };
  const out = await stripe("accounts", { body: { type: "standard", email } });
  if (out.error) return out;
  return { id: out.id };
}

/** A one-time link that walks the seller through Stripe's onboarding. */
export async function onboardingLink(accountId, refreshUrl, returnUrl) {
  if (!KEY) return { error: "payments not configured" };
  const out = await stripe("account_links", {
    body: { account: accountId, refresh_url: refreshUrl, return_url: returnUrl, type: "account_onboarding" },
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

/** Standard connected accounts have their OWN full Stripe dashboard and sign in
 *  there directly with their own credentials. Stripe's login_links API is
 *  Express-only and errors on Standard accounts ("does not have access to the
 *  Express Dashboard"), so we just point sellers at the dashboard to log in. */
export async function loginLink(accountId) {
  return { url: "https://dashboard.stripe.com" };
}

/* ---------------- checkout ---------------- */

/* Ways to pay that take days to clear. The order would sit "processing"
   while the buyer waits, so Checkout leaves them out. */
export const SLOW_METHODS = ["us_bank_account", "acss_debit", "sepa_debit", "bacs_debit", "au_becs_debit",
  "boleto", "oxxo", "konbini", "customer_balance", "multibanco", "pay_by_bank", "pix"];

/**
 * Direct charge on the SELLER's account, with our commission taken as
 * application_fee_amount. The seller pays Stripe's processing fee out
 * of their side — that's what makes Standard free for the platform.
 */
export async function createCheckout({
  orderId, title, amountCents, shippingCents, currency = "usd",
  successUrl, cancelUrl, buyerEmail, sellerAccount, feePct, collectShipping = false,
  items = null,   // a bag: [{ title, amountCents }] — amountCents is then their sum
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
      // commission on the item only — we don't skim postage
      payment_intent_data: { application_fee_amount: platformFee(amountCents, feePct) },
  });
  /* First ask: the seller's own payment methods, without the slow ones.
     Second ask, only if Stripe refuses the first: cards outright. Left to
     the automatic choice alone, a seller with nothing switched on for the
     currency got "No valid payment method types" and nobody could buy
     (first live checkout, 2026-10-07). Cards cover Apple Pay and Google Pay. */
  let out = await stripe("checkout/sessions", { account: sellerAccount, body: body({ excluded_payment_method_types: SLOW_METHODS }),
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
