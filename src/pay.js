/* ================================================================
   PAYMENTS — Stripe Standard Connect, over the plain HTTP API.

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

async function stripe(path, { method = "POST", body, account } = {}) {
  const headers = { Authorization: `Bearer ${KEY}` };
  if (account) headers["Stripe-Account"] = account;   // act as the connected account
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

/** Link to their own Stripe dashboard (Standard accounts have a full one). */
export async function loginLink(accountId) {
  if (!KEY) return { error: "payments not configured" };
  const out = await stripe(`accounts/${encodeURIComponent(accountId)}/login_links`, { body: {} });
  if (out.error) return out;
  return { url: out.url };
}

/* ---------------- checkout ---------------- */

/**
 * Direct charge on the SELLER's account, with our commission taken as
 * application_fee_amount. The seller pays Stripe's processing fee out
 * of their side — that's what makes Standard free for the platform.
 */
export async function createCheckout({
  orderId, title, amountCents, shippingCents, currency = "usd",
  successUrl, cancelUrl, buyerEmail, sellerAccount, feePct,
}) {
  if (!KEY) return { error: "payments not configured" };
  if (!sellerAccount) return { error: "seller hasn't connected payouts yet" };

  const line_items = [{
    quantity: 1,
    price_data: { currency, unit_amount: amountCents, product_data: { name: title.slice(0, 120) } },
  }];
  if (shippingCents > 0) {
    line_items.push({
      quantity: 1,
      price_data: { currency, unit_amount: shippingCents, product_data: { name: "Shipping" } },
    });
  }

  const out = await stripe("checkout/sessions", {
    account: sellerAccount, // charge lives on the seller's account
    body: {
      mode: "payment",
      success_url: successUrl,
      cancel_url: cancelUrl,
      client_reference_id: String(orderId),
      customer_email: buyerEmail || undefined,
      metadata: { order_id: String(orderId) },
      line_items,
      // commission on the item only — we don't skim postage
      payment_intent_data: { application_fee_amount: platformFee(amountCents, feePct) },
    },
  });
  if (out.error) return out;
  return { url: out.url, id: out.id };
}

/** Confirm payment server-side. Never trust the browser redirect. */
export async function verifySession(sessionId, sellerAccount) {
  if (!KEY) return { paid: false };
  const out = await stripe(`checkout/sessions/${encodeURIComponent(sessionId)}`, {
    method: "GET", account: sellerAccount,
  });
  if (out.error) return { paid: false };
  return { paid: out.payment_status === "paid", orderId: out.metadata?.order_id, amount: out.amount_total };
}
