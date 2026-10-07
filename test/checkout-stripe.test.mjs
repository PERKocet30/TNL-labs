// The checkout request asks Stripe for cards outright (2026-10-07: the first
// live checkout failed — "No valid payment method types"), and a setup
// problem on the seller's account is flagged so the seller is told.
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { readFileSync } from "node:fs";
const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
let pass = 0, fail = 0;
const t = (n, ok) => { ok ? pass++ : fail++; console.log("  " + (ok ? "✓" : "✗") + "  " + n); };
process.env.STRIPE_SECRET_KEY = "sk_test_x";
let sent = null, reply = { id: "cs_1", url: "https://checkout.stripe.com/x" }, ok = true;
globalThis.fetch = async (url, o) => { sent = { url, headers: o.headers, body: decodeURIComponent(o.body || "") }; return { ok, status: ok ? 200 : 400, json: async () => reply }; };
const pay = await import(join(ROOT, "src/pay.js"));
const base = { orderId: 7, title: "Tee — M", amountCents: 5000, shippingCents: 800, successUrl: "https://x/done", cancelUrl: "https://x/no", buyerEmail: "b@x.com", sellerAccount: "acct_1", feePct: 4, collectShipping: true };

console.log("\nCHECKOUT REQUEST");
let r = await pay.createCheckout(base);
t("asks for cards outright", sent.body.includes("payment_method_types[0]=card"));
t("on the seller's account", sent.headers["Stripe-Account"] === "acct_1");
t("item + shipping lines, fee on the item only", sent.body.includes("line_items[0][price_data][unit_amount]=5000") && sent.body.includes("line_items[1][price_data][unit_amount]=800") && sent.body.includes("application_fee_amount]=200"));
t("returns the session", r.url === "https://checkout.stripe.com/x" && r.id === "cs_1");
r = await pay.createCheckout({ ...base, items: [{ title: "A", amountCents: 1000 }, { title: "B", amountCents: 2000 }], amountCents: 3000 });
t("a bag: one line per item, fee on their sum", sent.body.includes("line_items[1][price_data][product_data][name]=B") && sent.body.includes("application_fee_amount]=120"));

console.log("\nWHEN STRIPE SAYS NO");
ok = false; reply = { error: { message: "No valid payment method types for this Checkout Session. Please ensure that you have activated payment methods…" } };
r = await pay.createCheckout(base);
t("a seller-setup problem is flagged", r.error && r.setup === true);
reply = { error: { message: "An error occurred with our connection to Stripe." } };
r = await pay.createCheckout(base);
t("anything else isn't", r.error && r.setup === false);

console.log("\nWIRED IN");
const rt = readFileSync(join(ROOT, "src/server.runtime.js"), "utf8");
t("single buy and bag both use checkoutFailed", rt.includes('return checkoutFailed(res, out, l.seller_id, req.user.id') && rt.includes("drop(); return checkoutFailed(res, out, seller.id"));
t("buyers never see Stripe's raw wording", !/res\.status\(502\)\.json\(\{ error: out\.error \}\)/.test(rt));
t("the seller is told where to fix it", rt.includes("Settings → Payment methods and turn on Cards"));
console.log(`\n  ${pass} passed, ${fail} failed`);
