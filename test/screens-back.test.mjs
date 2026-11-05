// EVERY SCREEN HAS A WAY BACK v1.0 (2026-11-04): "Sometimes I hit screens without a back button where the
// only way back is click Labs and loading back in." The screen kit's head (screenHead) is the one way a
// screen says where it is and how to leave; only the tab roots (Labs, Market) go without a back. A listing
// that's loading — or didn't load, like an old link to a sold item — keeps its Back; the Studio has one.
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { readFileSync, readdirSync, statSync } from "node:fs";
const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
let pass = 0, fail = 0;
const t = (n, ok) => { ok ? pass++ : fail++; console.log("  " + (ok ? "✓" : "✗") + "  " + n); };
const files = [];
const walk = (d) => { for (const f of readdirSync(d)) { const p = join(d, f); statSync(p).isDirectory() ? walk(p) : p.endsWith(".js") && files.push(p); } };
walk(join(ROOT, "src/app"));
const all = files.map((f) => [f.slice(ROOT.length + 1), readFileSync(f, "utf8")]);
const heads = all.flatMap(([f, s]) => [...s.matchAll(/screenHead\(\{(.{0,80})/g)].map((m) => [f, m[1]]));
const noBack = heads.filter(([, h]) => !h.startsWith("back:"));
t("every screen head has a Back — except the two tab roots, Labs and Market", noBack.length === 2 && noBack.every(([, h]) => /title:"Labs"|title:"Market",sub:MARKET_PITCH/.test(h)));
t("no screen uses the old head without a Back (the Studio did)", !all.some(([, s]) => s.includes('class="page-head"><h2>')));
const page = readFileSync(join(ROOT, "public/index.html"), "utf8");
const fn = (name) => { const a = page.indexOf("function " + name + "("); return page.slice(a, page.indexOf("\nfunction ", a + 1)); };
const det = fn("detailHTML");
t("a listing that's loading shows its Back above the placeholders", det.includes("if(!MKTONE)return `<div class=\"scroll\">${head}${skel()}</div>`"));
t("a listing that didn't load says why, with Back and Try again", det.includes("esc(MKTONE.error)") && det.includes("data-mretry") && page.includes('querySelectorAll("[data-mretry]").forEach(b=>b.onclick=()=>pxOpenListing(+b.dataset.mretry))'));
t("every way into a listing turns a failure into that, not a toast over placeholders", page.includes("}catch(x){mktFail(id,x)}") && page.includes("}catch(x){mktFail(el.dataset.mopen,x)}") && page.includes(`MKTONE={error:e.message||"That listing isn't available any more."`));
t("the Studio's Back goes back (or to the Culture lab it opens from)", fn("studioHTML").includes('back:{id:"studioback"') && page.includes('const sb=$("#studioback");if(sb)sb.onclick=()=>navBack(()=>{TAB="labs";try{openLab("culture")}catch(e){}})'));
console.log(`\n  ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
