// SELL WALKTHROUGH v1.0 (2026-11-03): a new listing is a run of short screens, one question each,
// shaped by the answers. Runs the real step logic (lifted from the built page) with the real
// taxonomy, and checks the wiring: new listings walk, edits and sounds keep the full form.
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { readFileSync } from "node:fs";
const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
let pass = 0, fail = 0;
const t = (n, ok) => { ok ? pass++ : fail++; console.log("  " + (ok ? "✓" : "✗") + "  " + n); };
const page = readFileSync(join(ROOT, "public/index.html"), "utf8");
const walk = readFileSync(join(ROOT, "src/app/market/sell-walk.js"), "utf8");
const tax = readFileSync(join(ROOT, "src/server/market/taxonomy.js"), "utf8");
const META = new Function(tax.slice(0, tax.indexOf("/* Keep only the details")) + "\nreturn TAXONOMY_META;")();
const fn = (name) => { const i = page.indexOf("function " + name + "("); const j = page.indexOf("\nfunction ", i + 1); return page.slice(i, j); };
const cut = (from, to) => page.slice(page.indexOf(from), page.indexOf(to, page.indexOf(from)));

/* the walk's logic, with the specs helpers and the who's-selling list it leans on */
const W = new Function("MKTMETA", "SELLFORM", "SELLIMGS", "ME",
  cut("const SELLTYPES=", "function sellTypeHTML(") + cut("const TAX=()=>", "function catPickHTML(") + cut("const PV_SIZES=", "function pvSync(")
  + cut("const SW_STEPS=", "function swGo(") + "\nreturn { swSteps, swStep, SW_WHO, SW_STEPS, swDept, swWho };")({ taxonomy: META }, null, [], null);
const keys = (f) => W.swSteps(f).map(([k]) => k).join();

console.log("\nTHE STEPS FOLLOW THE ANSWERS");
t("nine steps for a brand's tee: what, which kind, who, photos, words, stock, details, price, review", keys({ category: "Tops", sellType: "brand", hasVariants: true }) === "what,kind,who,photos,words,stock,details,price,review");
t("a department with one kind (Footwear, Music) skips 'which kind'", keys({ category: "Footwear", sellType: "brand" }) === "what,who,photos,words,stock,details,price,review" && !keys({ category: "Physical music", sellType: "brand" }).includes("kind"));
t("before a department is picked, the kind step counts (so 1 / 9 doesn't become 2 / 8)", keys({}).includes("kind"));
t("a vintage piece still has a size step (its one size)", keys({ category: "Tops", sellType: "vintage" }).includes("stock"));
t("an original painting has no size or stock to ask about", keys({ category: "Original art", sellType: "custom" }) === "what,kind,who,photos,words,details,price,review");
t("…nor does a one-off zine; a one-off ring still has its size, a one-off record its format", !keys({ category: "Zines & books", sellType: "custom" }).includes("stock") && keys({ category: "Rings", sellType: "custom" }).includes("stock") && keys({ category: "Physical music", sellType: "custom" }).includes("stock"));
t("prints (an edition) do: sizes × stock", keys({ category: "Art / Prints", sellType: "brand", hasVariants: true }).includes("stock"));
t("a one-of-one sculpture: no sizes either", !keys({ category: "Sculpture & objects", sellType: "custom" }).includes("stock"));
t("the first step is where a new form starts; an unknown step falls back to the first", W.swStep({}) === "what" && W.swStep({ _step: "nope" }) === "what");
t("a draft picks up at its step — unless that step no longer applies", W.swStep({ _step: "price", category: "Tops" }) === "price" && W.swStep({ _step: "stock", category: "Original art", sellType: "custom" }) === "what");
t("every step has a question written for it", W.SW_STEPS.every(([, q]) => q.length > 3) && W.SW_STEPS.map(([, q]) => q).join(" | ") === "What are you selling? | Which kind? | Who's selling it? | Photos | Tell people about it | Size & stock | Details | Price & shipping | Ready to list");

console.log("\nWHO'S SELLING, IN THE DEPARTMENT'S WORDS");
t("art asks: an original, prints or an edition, pre-owned art (the same three answers underneath)", W.SW_WHO.Art.map(([k]) => k).join() === "custom,brand,vintage" && W.SW_WHO.Art.map(([, l]) => l).join(" | ") === "An original | Prints or an edition | Pre-owned art");
t("'other' asks in plain words: made by me (one / several), pre-owned", W.SW_WHO.Other.map(([k]) => k).sort().join() === "brand,custom,vintage");
t("clothing keeps My brand / Vintage / One of one; footwear and accessories read the same way", W.SW_WHO.Clothing[0][1] === "My brand" && W.swWho({ _dept: "Footwear" }) === W.SW_WHO.Clothing && W.swWho({ _dept: "Accessories" }) === W.SW_WHO.Clothing);
t("a jeweller is asked about a line, a one of one or pre-owned — never 'sizes and colours'", W.SW_WHO.Jewellery.map(([, l]) => l).join(" | ") === "My line | One of one | Pre-owned" && !JSON.stringify(W.SW_WHO.Jewellery).includes("colour"));
t("music asks about a release, a record you're passing on, or a one-off; paper about your designs", W.SW_WHO.Music[0][1] === "My release" && W.SW_WHO["Paper & print"][0][1] === "My designs");
t("every department has its wording, and every card maps to a real seller type", META.departments.every((d) => W.swWho({ _dept: d.name })) && Object.values(W.SW_WHO).flat().every(([k]) => ["brand", "vintage", "custom"].includes(k)) && Object.values(W.SW_WHO).every((l) => l.map(([k]) => k).sort().join() === "brand,custom,vintage"));

console.log("\nWIRED IN");
const sell = fn("sellHTML");
t("a new listing (not an edit, not a sound) is the walkthrough", sell.includes("if(!loop&&!MKTEDIT)return sellWalkHTML(f);"));
t("…after the payouts gate, so nobody walks eight steps to be told to set up payouts", sell.indexOf("pf-gate") < sell.indexOf("return sellWalkHTML(f)"));
t("editing keeps the full form: every section still there", ["Photos", "Pricing", "Shipping", "Details", "Status"].every((s) => sell.includes(`<div class="pf-sec">${s}</div>`)));
t("the walk's screens reuse the form's field ids, so stashSell and the draft work unchanged", ['id="s-title"', 'id="s-desc"', 'id="s-price"', 'id="s-ship"', 'id="s-freeship"', 'id="s-offers"', 'id="s-ig"', 'id="sfile"', 'pick("s-cond"', 'id="s-brand"', "pvHTML(f)", "specFieldsHTML(f)", "sellCompareHTML(f)"].every((x) => walk.includes(x)));
t("the step lives on the form, so a draft resumes where it left off", walk.includes("SELLFORM._step=step;sdSave()") && readFileSync(join(ROOT, "src/app/market/bag.js"), "utf8").includes("SELLFORM=d.f;"));
t("a new form no longer starts on Tops — the walk asks", !readFileSync(join(ROOT, "src/app/market/market.js"), "utf8").includes('SELLFORM={category:"Tops"'));
t("Next checks the step: a photo, a title, stock on a size, a price of at least $1", /Add at least one photo/.test(walk) && /Give it a title/.test(walk) && /Add stock to at least one size/.test(walk) && /Price must be at least \$1/.test(walk));
t("details can be skipped; nothing else can", (walk.match(/sw-skip/g) || []).length >= 2 && walk.includes('step==="details"?`<button type="button" class="sw-skip"'));
t("the review's rows lead back to their step", walk.includes('data-swgo="${step}"') && walk.includes('[data-swgo]').valueOf());
t("the review ends in the same Publish the form uses, with what you'll get above it", walk.includes('id="s-earn">${sellEarnHTML()}</div><button class="gx-btn" id="s-post">Publish</button>'));
t("one department with one kind picks it for you and goes to who's selling; otherwise which kind", walk.includes("f.category=d&&d.categories.length===1?d.categories[0]:") && walk.includes('swGo(f.category?"who":"kind")'));
t("the later screens take their words from the kind: sizes or formats, colour or finish or design", /sellOpt\(f\)/.test(walk) && /sellSizeWord\(f\)/.test(walk) && /sellOpt\(f\)/.test(readFileSync(join(ROOT, "src/app/market/sell-variants.js"), "utf8")));
t("the walk's handlers are wired after the form's, so its who-cards move a step on", readFileSync(join(ROOT, "src/app/market/market.js"), "utf8").includes("wireSellVariants();wireSellWalk();"));
t("no fee rate on any step but the last (what you'll get, folded)", !/\d+% (LABS )?fee/.test(walk.replace(/sellEarnHTML\(\)/g, "")));

console.log(`\n  ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
