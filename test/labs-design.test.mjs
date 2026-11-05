/* LABS DESIGN v1.0 — 2026-11-05. "Does the Labs reflect the design language" — what was missing,
   held: loading shimmers (never "Loading…"), a failure has a way forward, and the Labs move like
   the rest of the app (ARRIVE · LAND, app/styles/motion.css). */
import { readFileSync } from "node:fs";
let pass = 0, fail = 0;
const t = (name, ok) => { if (ok) pass++; else { fail++; console.log("FAIL", name); } };
const js = readFileSync(new URL("../src/app/labs/places.js", import.meta.url), "utf8");
const css = readFileSync(new URL("../src/app/styles/motion.css", import.meta.url), "utf8");
const code = js.replace(/\/\*[\s\S]*?\*\//g, "");
t("no \"Loading…\" text in the Labs", !/Loading(…|\.\.\.)/.test(code));
t("Older shimmers where the next tiles land", /pl-tile sk-img pl-more/.test(code) && !/plolder[^;]*textContent/.test(code));
t("a failure offers Try again", /data-plretry/.test(code.match(/const plErr=[^\n]*/)?.[0] || ""));
t("Try again is wired for a lab and for a #tag page", /\[data-plretry\][\s\S]{0,200}loadTag\(TAGVIEW\.tag\)[\s\S]{0,120}loadPlace\(\)/.test(code));
t("the #tag page loads through one function", /function loadTag\(t\)/.test(code) && /render\(\);\s*loadTag\(t\);/.test(code));
t("the work lands when the shimmer gives way", /function paintPlace[\s\S]{0,400}mv-land[\s\S]{0,80}mvReduced|function paintPlace[\s\S]{0,400}mvReduced\(\)[\s\S]{0,80}mv-land/.test(code));
const live = css.slice(css.indexOf("prefers-reduced-motion:no-preference"));
t("lab cards rise in turn", /\.content\.mv-fwd \.lx[,{]/.test(live) && /\.content \.lx:nth-child\(2\)/.test(live));
t("a lab's head, tabs and body come in in turn", /\.content\.mv-fwd \.room>\*/.test(live) && /\.content \.room>\*:nth-child\(2\)/.test(live));
t("the work's tiles rise, and on landing", /\.content\.mv-fwd \.pl-tile:not\(\.sk-img\)/.test(live) && /\.pl-body\.mv-land \.pl-tile/.test(live));
t("the shimmer itself never rises", !/\.mv-\w+ \.pl-tile[,{]/.test(live.replace(/\.pl-body\.mv-land \.pl-tile/g, "")));
t("below the fold nothing waits", /\.content \.pl-tile:nth-child\(n\+13\)[^{]*\{animation:none\}/.test(live.replace(/\n/g, "")) || /\.content \.lx:nth-child\(n\+10\),\.content \.pl-tile:nth-child\(n\+13\)\{animation:none\}/.test(live));
const lab = live.slice(live.indexOf("/* the Labs"), live.indexOf("/* past the first screenful"));
t("the Labs animate transform/opacity only (mvRise)", lab.length > 0 && !/animation:(?!mvRise|none)/.test(lab));
console.log(`${pass} passed, ${fail} failed`);
if (fail) process.exit(1);
