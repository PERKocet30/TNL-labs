// MOTION v1.0 (2026-11-05): "Include this in the design language for the whole app, then standardize
// everything to be more dynamic and interactive." Three rules — ARRIVE, ANSWER, LAND — in one place
// (app/nav/motion-live.js + app/styles/motion.css), applied to every screen without the screens knowing.
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { readFileSync, readdirSync, statSync } from "node:fs";
const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
let pass = 0, fail = 0;
const t = (n, ok) => { ok ? pass++ : fail++; console.log("  " + (ok ? "✓" : "✗") + "  " + n); };
const css = readFileSync(join(ROOT, "src/app/styles/motion.css"), "utf8"), live = readFileSync(join(ROOT, "src/app/nav/motion-live.js"), "utf8");
const rules = css.slice(css.indexOf("/* ── ARRIVE · ANSWER · LAND"), css.indexOf("/* ── SIGN-UP IN MOTION"));
console.log("\nTHE RULES, IN ONE PLACE");
t("the tokens: a press, a move, an arrival, a step — and one curve", /--mv-fast:\.14s;--mv-base:\.28s;--mv-slow:\.42s;--mv-step:\.05s/.test(css) && css.includes("--mv-ease:cubic-bezier"));
t("ARRIVE: a screen that moved in (fwd, back, fade) or just landed brings its scroller's first blocks in, a step apart", ["mv-fwd", "mv-back", "mv-fade", "mv-land"].every((c) => rules.includes(`.content.${c}>.scroll>*`)) && rules.includes("calc(var(--mvd,0s) + var(--mv-step) * 4)"));
t("…cards, posts, lab cards, profile sections and rows too; overlays' rows; the chat's parts", [".sr-card", ".post", ".lcard", ".pf-sec", ".nrow", ".sheet.mv-in .sheetc>*", ".pick.mv-in .pickrow", ".po-ov.mv-in .po-body>*", ".cx-in.mv-tf>*>*"].every((s) => rules.includes(s)));
t("…but nothing below the first screenful waits (what you scroll to is never blank)", rules.includes(".content .sr-card:nth-child(n+9)") && rules.includes("{animation:none}"));
t("…and the shimmer keeps shimmering", rules.includes(".content.mv-fwd .sk-list") && /\.sk-list\{animation:none\}/.test(rules));
t("ANSWER: a tap that turned something on pops (.mv-pop); LAND: a number that changed bumps (.mv-bump)", rules.includes(".mv-pop{animation:mvPopIn") && rules.includes(".mv-bump{animation:mvBump"));
t("transform and opacity only — nothing in the rules moves the layout", !/(width|height|top|left|margin|padding)\s*:/.test(rules.split("@media (prefers-reduced-motion:no-preference){")[1].replace(/@keyframes[^\n]*/g, "")));
t("none of it with reduced motion", rules.includes("@media (prefers-reduced-motion:no-preference){") && live.includes("if(mvReduced()||!e.isTrusted)return;"));
console.log("\nAPPLIED EVERYWHERE, WITHOUT THE SCREENS KNOWING");
t("render() marks the repaint where loading gave way to the real thing", readFileSync(join(ROOT, "src/app/nav/render-nav.js"), "utf8").includes("mvAfter(mvb);mvLanded();") && live.includes('c.classList.add("mv-land")'));
t("after a tap, what's under the finger that turned on pops — through a re-render", live.includes("document.elementFromPoint(x,y)") && live.includes('ctl.classList.contains("on")') && live.includes("mvPop(ctl)"));
t("the counts near a tap are compared before and after, and bump when they changed", live.includes("const before=new Map(") && live.includes("was!==n.textContent") && live.includes("mvBump(n)"));
t("the sign-up rides on the same keyframes and tokens (no second set)", !css.includes("gxRise") && !css.includes("gxPick") && css.includes(".gx-body.gx-in>*,.gx-body.gx-in .gx-mid>*{animation:mvRise") && readFileSync(join(ROOT, "src/app/gate/logic.js"), "utf8").includes("function gxBump(el){if(el)mvBump(el)}"));
const order = readFileSync(join(ROOT, "src/app/order.mjs"), "utf8");
t("motion-live sits right after motion", order.indexOf('"nav/motion-live.js"') > order.indexOf('"nav/motion.js"') && order.indexOf('"nav/motion-live.js"') - order.indexOf('"nav/motion.js"') < 120);
const files = []; const walk = (d) => { for (const f of readdirSync(d)) { const p = join(d, f); statSync(p).isDirectory() ? walk(p) : (p.endsWith(".js") || p.endsWith(".css")) && files.push(p); } }; walk(join(ROOT, "src/app"));
const strays = files.filter((f) => !/styles\/motion\.css$|nav\/motion/.test(f)).map((f) => [f.slice(ROOT.length + 1), readFileSync(f, "utf8")]).filter(([, s]) => /@keyframes\s+(mvRise|mvPopIn|mvBump|mvFwd|mvBack)\b/.test(s));
t("no screen defines its own copy of the rules' keyframes", strays.length === 0);
console.log(`\n  ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
