// Listing editor v2 (2026-09-28): a Shopify-style product form.
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { readFileSync } from "node:fs";
const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
let pass = 0, fail = 0;
const t = (n, ok) => { ok ? pass++ : fail++; console.log("  " + (ok ? "✓" : "✗") + "  " + n); };
const src = readFileSync(join(ROOT, "public/index.html"), "utf8");
const fn = (name) => { const i = src.indexOf("function " + name + "("); const j = src.indexOf("\nfunction ", i + 1); return src.slice(i, j); };

console.log("\nLISTING EDITOR — SECTIONS");
const sell = fn("sellHTML");
for (const s of ["Media", "Pricing", "Inventory", "Shipping", "Details", "Status"]) t("has a " + s + " card", sell.includes(`<div class="pf-sec">${s}</div>`));
t("one Publish / Save button", sell.includes('id="s-post">${MKTEDIT?"Save":"Publish"}'));
t("sound listings keep their own section", sell.includes('<div class="pf-sec">Sound</div>'));
t("photos: up to 8, several at once", sell.includes("SELLIMGS.length<8") && sell.includes('accept="image/*" multiple'));

console.log("\nLESS EXPLANATION");
t("no Depop pitch anywhere in the app", !/DEPOP TAKES/i.test(src));
const upl = src.slice(src.indexOf('const sf=$("#sfile");if(sf)sf.onchange'), src.indexOf('/* Tap a photo to make it the cover'));
t("no email-confirm block on listing photos (accounts are full access)", upl.length > 50 && !/emailVerified/.test(upl));

console.log("\nFORM STATE");
t("typing is saved as you go (background renders can't wipe it)", /\.pf input:not\(\[type=file\]\),\.pf textarea,\.pf select"\)\.forEach\(el=>\{\s*el\.addEventListener\("input",stashSell\)/.test(src));
t("free shipping saves as no shipping charge", src.includes('SELLFORM.shipping=($("#s-freeship")&&$("#s-freeship").checked)?"":g("#s-ship")'));
t("edit sends status", src.includes('if(SELLFORM.status==="sold"||SELLFORM.status==="active")eb.status=SELLFORM.status;'));

console.log("\nYOU EARN — runs the real function");
const earn = (price, fee, kind) => new Function("MKTMETA", "SELLFORM", "SELLKIND", "money",
  fn("sellEarnHTML") + "; return sellEarnHTML();")({ feePct: fee }, { price }, kind, (c) => "$" + (c / 100).toFixed(2));
t("$85 at 6% → you earn $79.90", earn("85", 6, "physical").includes("<b>$79.90</b>"));
t("$100 at 10% → you earn $90.00", earn("100", 10, "physical").includes("<b>$90.00</b>"));
t("says card processing is not included", earn("85", 6, "physical").includes("before card processing"));
t("no price yet → shows the fee only", earn("", 6, "physical").startsWith("TNL fee 6%"));
t("free sound → says free", earn("0", 6, "loop").startsWith("Free"));

console.log(`\n  ${pass} passed, ${fail} failed`);
