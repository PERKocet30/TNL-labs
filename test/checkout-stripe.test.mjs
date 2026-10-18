// v2.0 (2026-10-18, "seamless payments"): checkout first offers the seller's
// own payment methods minus the slow ones; if Stripe refuses, it asks for
// cards outright (2026-10-07: the first live checkout failed — "No valid
// payment method types"). A setup problem is flagged so the seller is told.
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { readFileSync } from "node:fs";
const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
let pass = 0, fail = 0;
const t = (n, ok) => { ok ? pass++ : fail++; console.log("  " + (ok ? "✓" : "✗") + "  " + n); };
process.env.STRIPE_SECRET_KEY = "sk_test_x";
let sent = null, reply = { id: "cs_1", url: "https://checkout.stripe.com/x" }, ok = true, calls = [], failFirst = false;
globalThis.fetch = async (url, o) => { sent = { url, headers: o.headers, body: decodeURIComponent(o.body || "") }; calls.push(sent);
  const bad = !ok || (failFirst && calls.length === 1);
  return { ok: !bad, status: bad ? 400 : 200, json: async () => bad ? (ok ? { error: { message: "Received unknown parameter: excluded_payment_method_types" } } : reply) : reply }; };
const pay = await import(join(ROOT, "src/pay.js"));
const base = { orderId: 7, title: "Tee — M", amountCents: 5000, shippingCents: 800, successUrl: "https://x/done", cancelUrl: "https://x/no", buyerEmail: "b@x.com", sellerAccount: "acct_1", feePct: 4, collectShipping: true };

console.log("\nCHECKOUT REQUEST");
let r = await pay.createCheckout(base);
t("one request when Stripe says yes", calls.length === 1);
t("offers the seller's own ways to pay (no fixed list)", !sent.body.includes("payment_method_types[0]=") || sent.body.includes("excluded_payment_method_types[0]="));
t("…minus the slow ones (bank debits that take days)", sent.body.includes("excluded_payment_method_types[0]=us_bank_account") && pay.SLOW_METHODS.includes("sepa_debit") && !pay.SLOW_METHODS.includes("card") && !pay.SLOW_METHODS.includes("cashapp"));
t("asks on an API version that can leave methods out (that request only)", sent.headers["Stripe-Version"] === "2025-09-30.clover");
calls = []; failFirst = true;
r = await pay.createCheckout(base);
t("if Stripe refuses, it asks again for cards outright", calls.length === 2 && calls[1].body.includes("payment_method_types[0]=card") && !calls[1].headers["Stripe-Version"] && r.url === "https://checkout.stripe.com/x");
failFirst = false;
t("on the seller's account", sent.headers["Stripe-Account"] === "acct_1");
t("item + shipping lines, fee on the item only", sent.body.includes("line_items[0][price_data][unit_amount]=5000") && sent.body.includes("line_items[1][price_data][unit_amount]=800") && sent.body.includes("application_fee_amount]=200"));
t("returns the session", r.url === "https://checkout.stripe.com/x" && r.id === "cs_1");
r = await pay.createCheckout({ ...base, items: [{ title: "A", amountCents: 1000 }, { title: "B", amountCents: 2000 }], amountCents: 3000 });
t("a bag: one line per item, fee on their sum", sent.body.includes("line_items[1][price_data][product_data][name]=B") && sent.body.includes("application_fee_amount]=120"));

console.log("\nWHEN STRIPE SAYS NO");
ok = false; reply = { error: { message: "No valid payment method types for this Checkout Session. Please ensure that you have activated payment methods…" } };
calls = []; r = await pay.createCheckout(base);
t("both asks refused: the buyer gets an error, not a broken page", calls.length === 2 && !!r.error);
t("a seller-setup problem is flagged", r.error && r.setup === true);
reply = { error: { message: "An error occurred with our connection to Stripe." } };
r = await pay.createCheckout(base);
t("anything else isn't", r.error && r.setup === false);

console.log("\nSTILL CLEARING");
ok = true; reply = { status: "complete", payment_status: "unpaid", metadata: { order_id: "7" }, amount_total: 5800 };
let v = await pay.verifySession("cs_1", "acct_1");
t("finished but not yet cleared: not paid, but not a failure either", v.paid === false && v.clearing === true);
reply = { status: "complete", payment_status: "paid", metadata: { order_id: "7" }, amount_total: 5800 };
v = await pay.verifySession("cs_1", "acct_1");
t("paid is paid", v.paid === true && v.clearing === false);
reply = { status: "expired", payment_status: "unpaid" };
v = await pay.verifySession("cs_1", "acct_1");
t("an abandoned checkout is neither", v.paid === false && v.clearing === false);

console.log("\nWIRED IN");
const rt = readFileSync(join(ROOT, "src/server.runtime.js"), "utf8");
t("single buy and bag both use checkoutFailed", rt.includes('return checkoutFailed(res, out, l.seller_id, req.user.id') && rt.includes("drop(); return checkoutFailed(res, out, seller.id"));
t("buyers never see Stripe's raw wording", !/res\.status\(502\)\.json\(\{ error: out\.error \}\)/.test(rt));
t("the seller is told where to fix it", rt.includes("Settings → Payment methods and turn on Cards"));
console.log(`\n  ${pass} passed, ${fail} failed`);
