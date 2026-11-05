/* ADMIN DESIGN v1.0 — 2026-11-05. "Including the admin dashboard": /admin keeps the design language
   too — loading shimmers (never "Loading…"), every colour from the palette, soft corners, and the
   motion rules (ARRIVE · ANSWER · LAND) in admin-app/1-motion.js + admin-app/motion.css. */
import { readFileSync, readdirSync } from "node:fs";
import { PALETTE, paletteCss } from "../src/palette.js";
let pass = 0, fail = 0;
const t = (name, ok) => { if (ok) pass++; else { fail++; console.log("FAIL", name); } };
const R = (f) => readFileSync(new URL("../" + f, import.meta.url), "utf8");
const noCom = (s) => s.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
const dir = "public/admin-app/", files = readdirSync(new URL("../" + dir, import.meta.url));
const js = files.filter((f) => f.endsWith(".js")).map((f) => [f, noCom(R(dir + f))]);
const css = files.filter((f) => f.endsWith(".css")).map((f) => [f, noCom(R(dir + f))]);
const html = R("public/admin.html");
const loading = js.filter(([, s]) => /Loading(…|\.\.\.| [a-z]+…)/.test(s.replace(/aria-label="Loading"/g, ""))).map(([f]) => f);
t("no \"Loading…\" anywhere in /admin (" + loading.join(", ") + ")", !loading.length && !/>Loading/.test(html));
t("the sections that wait show the shimmer", js.filter(([, s]) => /askel\(/.test(s)).length >= 18);
const hex = css.filter(([, s]) => /#[0-9a-fA-F]{3,8}\b/.test(s)).map(([f]) => f);
t("no hand-typed colour in the admin's CSS (" + hex.join(", ") + ")", !hex.length);
t("warn lives in the palette, both themes, and reaches /palette.css", PALETTE.light.warn && PALETTE.dark.warn && paletteCss().includes("--warn:"));
const ui = R(dir + "ui.css");
t("the status dot and trend arrow use the palette", /\.st\.warn i\{background:var\(--warn\)\}/.test(ui) && /i\.up\{color:var\(--green\)\}/.test(ui));
t("soft corners on the nav rows, notes and thumbnails", !/border-radius:10px/.test(ui) && /\.rep,\.warnbox\{border-radius:var\(--rad-m\)\}/.test(ui));
const mjs = R(dir + "1-motion.js"), mcss = R(dir + "motion.css"), core = R(dir + "1-core.js");
t("admin.html loads the motion after the core and its CSS", html.indexOf("1-core.js") < html.indexOf("1-motion.js") && html.indexOf("1-motion.js") < html.indexOf("1-mods.js") && html.includes("/admin-app/motion.css"));
t("paint() hands every repaint to the motion", /const mvb = admMvBefore\(\)/.test(core) && /admMvAfter\(mvb\);\n\}/.test(core));
t("the same tokens as the app", ["--mv-fast:.14s", "--mv-base:.28s", "--mv-slow:.42s", "--mv-step:.05s", "--mv-ease:cubic-bezier(.2,.8,.2,1)"].every((k) => mcss.includes(k)) && R("src/app/styles/motion.css").includes("--mv-ease:cubic-bezier(.2,.8,.2,1)"));
const live = mcss.slice(mcss.indexOf("prefers-reduced-motion:no-preference"));
t("all of the motion is behind reduced motion", mcss.indexOf("prefers-reduced-motion:no-preference") > 0 && !/animation:(?!none)/.test(mcss.slice(0, mcss.indexOf("@media (prefers-reduced-motion"))) && /admReduced\(\)/.test(mjs));
t("ARRIVE: a section's parts and its first cards rise in turn", /#main\.mv-in>\*/.test(live) && /#main>\*:nth-child\(2\)/.test(live) && /:is\(\.kpi,\.rc,\.card\):nth-child\(n\+9\)\{animation:none\}/.test(live));
t("ARRIVE: the More sheet, a confirm and a toast come in", /\.msheet\.mv-in\{animation:amvUp/.test(live) && /\.modal \.box\{animation:amvRise/.test(live) && /\.toast\{animation:amvToast/.test(live));
t("ANSWER: taps press, what turns on pops", /:active\{transform:scale\(\.97\)\}/.test(live) && /\.mv-pop\{animation:amvPop/.test(live) && /addEventListener\("click"/.test(mjs));
t("LAND: a number that changed bumps, only on the page you're on", /\.mv-bump\{animation:amvBump/.test(live) && /if \(key === b\.key\)[\s\S]{0,200}admBump/.test(mjs));
t("the minute's refresh doesn't re-run an arrival (same key, no shimmer)", /if \(key !== b\.key\)[\s\S]{0,120}else if \(b\.skel && !sk\)/.test(mjs));
const kf = [...mcss.matchAll(/@keyframes (amv\w+)\{([\s\S]*?\})\}/g)].filter(([, n]) => n !== "amvShim");
t("transform and opacity only", kf.length >= 6 && kf.every(([, , b]) => !/(?:^|[{;])\s*(?!transform|opacity)[a-z-]+:/.test(b.replace(/\d+%\{/g, "{"))));
t("1-motion.js stays small", mjs.length < 24 * 1024);
console.log(`${pass} passed, ${fail} failed`);
if (fail) process.exit(1);
