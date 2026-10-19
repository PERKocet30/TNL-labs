// Listing editor v2 (2026-09-28): a plain product form.
// v3 (2026-10-18, "match Shopify standards"): Photos, Pricing with a compare-at
// price and what you keep after every fee, Size & stock as options, pickers.
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { readFileSync } from "node:fs";
const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
let pass = 0, fail = 0;
const t = (n, ok) => { ok ? pass++ : fail++; console.log("  " + (ok ? "✓" : "✗") + "  " + n); };
const src = readFileSync(join(ROOT, "public/index.html"), "utf8");
const fn = (name) => { const i = src.indexOf("function " + name + "("); const j = src.indexOf("\nfunction ", i + 1); return src.slice(i, j); };

console.log("\nLISTING EDITOR — SECTIONS");
const sell = fn("sellHTML") + fn("pvHTML");   // Inventory (sizes & colours) is its own part since 2026-09-30
for (const s of ["Photos", "Pricing", "Shipping", "Details", "Status"]) t("has a " + s + " card", sell.includes(`<div class="pf-sec">${s}</div>`));
t("has a Size & stock card (just Size for a single piece)", sell.includes('<div class="pf-sec">${one?"Size":"Size &amp; stock"}</div>'));
t("one Publish / Save button", sell.includes('id="s-post">${MKTEDIT?"Save":"Publish"}'));
t("sound listings keep their own section", sell.includes('<div class="pf-sec">Sound</div>'));
t("photos: up to 8, several at once", sell.includes("SELLIMGS.length<8") && sell.includes('accept="image/*" multiple'));

console.log("\nLESS EXPLANATION");
t("no competitor pitch anywhere in the app", !/DEPOP TAKES/i.test(src));
const upl = src.slice(src.indexOf('const sf=$("#sfile");if(sf)sf.onchange'), src.indexOf('/* Tap a photo to make it the cover'));
t("no email-confirm block on listing photos (accounts are full access)", upl.length > 50 && !/emailVerified/.test(upl));

console.log("\nFORM STATE");
t("typing is saved as you go (background renders can't wipe it)", /\.pf input:not\(\[type=file\]\),\.pf textarea,\.pf select"\)\.forEach\(el=>\{\s*el\.addEventListener\("input",stashSell\)/.test(src));
t("free shipping saves as no shipping charge", src.includes('SELLFORM.shipping=($("#s-freeship")&&$("#s-freeship").checked)?"":g("#s-ship")'));
t("edit sends status", src.includes('if(SELLFORM.status==="sold"||SELLFORM.status==="active")eb.status=SELLFORM.status;'));

console.log("\nYOU EARN — runs the real function");
const earn = (price, fee, kind, shipping = "") => new Function("MKTMETA", "SELLFORM", "SELLKIND", "money",
  fn("sellKeepCents") + fn("sellEarnHTML") + "; return sellEarnHTML();")({ feePct: fee }, { price, shipping }, kind, (c) => "$" + (c / 100).toFixed(2));
t("$85 at 6% → you'll get about $77.14 (TNL fee and the card fee both out)", earn("85", 6, "physical").includes("<b>$77.14</b>"));
t("$100 at 10% → about $86.80", earn("100", 10, "physical").includes("<b>$86.80</b>"));
t("$65 + $8 shipping at 4% → about $67.98, shipping counted (TNL takes nothing on postage)", earn("65", 4, "physical", "8").includes("<b>$67.98</b>") && earn("65", 4, "physical", "8").includes("with shipping"));
// 2026-10-18 "fees… subtle and discrete… the last thing you see before you finish listing"
t("the fee isn't spelled out — it's folded away until asked", /^<details class="pf-why"><summary>You'll get about <b>\$77\.14<\/b><\/summary><span>After the 6% LABS fee and the card fee/.test(earn("85", 6, "physical")));
t("an admin (0%): no LABS fee taken or mentioned", earn("100", 0, "physical").includes("<b>$96.80</b>") && !earn("100", 0, "physical").includes("LABS") && earn("100", 0, "physical").includes("After the card fee"));
t("no price yet → nothing at all", earn("", 6, "physical") === "");
t("it sits above Publish, not under the price", sell.includes('<div class="pf-bar"><div class="pf-keep" id="s-earn">${sellEarnHTML()}</div><button class="gx-btn" id="s-post">') && !sell.includes('<div class="pf-hint" id="s-earn">'));
t("no Rates link in the form, no rate banner on your orders, no \"keep %\" on levels", !sell.includes("rateladder") && !src.includes("function rateHTML(") && !/keep \$\{keep\(/.test(src) && !src.includes("your fee drops as your rep grows"));
t("\"Ships from\" is gone from the form", !sell.includes('id="s-from"'));
t("category and condition are pickers, not walls of chips", sell.includes("catPickHTML(f)") && sell.includes('pick("s-cond"') && !sell.includes('"data-scond"'));
t("the category's own details are asked for in Details", sell.includes("${specFieldsHTML(f)}"));
t("free sound → says free", earn("0", 6, "loop").startsWith("Free"));

console.log(`\n  ${pass} passed, ${fail} failed`);
