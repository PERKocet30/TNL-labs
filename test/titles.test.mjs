// TITLES v1.0 (2026-11-05): "Add more titles that include all the fine arts … that correspond to the
// current labs." What you make (ROLES) — every title leads to a lab (ROLE_LABS, app + server the same),
// every lab has titles that lead to it first, and sign-up groups them by lab with a search.
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { readFileSync } from "node:fs";
const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
let pass = 0, fail = 0;
const t = (n, ok) => { ok ? pass++ : fail++; console.log("  " + (ok ? "✓" : "✗") + "  " + n); };
const cut = (s, from, to) => s.slice(s.indexOf(from), s.indexOf(to, s.indexOf(from)) + to.length);
const api = readFileSync(join(ROOT, "src/app/core/theme-labs-api.js"), "utf8");
const ROLES = new Function(cut(api, "const ROLES = [", "];") + "\nreturn ROLES;")();
const LABS = new Function(cut(api, "const LABS = [", "];") + "\nreturn LABS;")();
const RL = new Function(cut(readFileSync(join(ROOT, "src/app/labs/places.js"), "utf8"), "const ROLE_LABS={", "};") + "\nreturn ROLE_LABS;")();
const SRL = new Function(cut(readFileSync(join(ROOT, "src/server/labs/places.js"), "utf8"), "const ROLE_LABS = {", "};") + "\nreturn ROLE_LABS;")();
const KIND = readFileSync(join(ROOT, "src/server/posts/collabs-showroom.js"), "utf8");
t("120 titles, none twice", ROLES.length >= 120 && new Set(ROLES).size === ROLES.length);
t("every title leads to a lab — and the server's map is the same", ROLES.every((r) => (RL[r] || []).length) && JSON.stringify(RL) === JSON.stringify(SRL));
t("every lab has titles that lead to it first", LABS.every((l) => ROLES.some((r) => RL[r][0] === l.id)));
const first = (r) => RL[r][0];
t("the fine arts lead to Visual", ["Fine Artist", "Watercolorist", "Ceramicist", "Calligrapher", "Installation Artist", "Glass Artist", "Street Artist", "Sketch Artist", "Architect"].every((r) => first(r) === "pharmacy"));
t("performers to Music, writers to News, makers of what you wear to Fashion", ["Composer", "Dancer", "Choreographer", "Vocalist"].every((r) => first(r) === "culture") && ["Poet", "Author", "Playwright", "Editor", "Critic"].every((r) => first(r) === "casino") && ["Jewelry Designer", "Makeup Artist", "Textile Artist"].every((r) => first(r) === "fashion"));
t("…anime to Anime, the business of art to Business, collectors to General", ["Comic Artist", "Webtoon Artist", "VTuber"].every((r) => first(r) === "akatsuki") && ["Investor", "Gallerist", "Art Dealer"].every((r) => first(r) === "tna") && first("Collector") === "hq");
t("every new title has a profile kind on the server", ["Fine Artist", "Composer", "Poet", "Webtoon Artist", "Makeup Artist", "Investor", "Collector"].every((r) => KIND.includes(`"${r}": "`)));
const scr = readFileSync(join(ROOT, "src/app/gate/screens.js"), "utf8"), logic = readFileSync(join(ROOT, "src/app/gate/logic.js"), "utf8");
t("sign-up groups the titles under each lab (General last), with a search", scr.includes("${gxRolesHTML(f)}") && scr.includes('<div class="gx-rlab">// ${esc(l.name)}</div>') && scr.includes('LABS.filter(l=>l.id==="hq")') && scr.includes('id="gxrq"'));
t("the search hides by the start of a word, keeps what you chose, never repaints", logic.includes('const rq=$("#gxrq");if(rq)rq.oninput=') && logic.includes("w.startsWith(q)") && logic.includes('b.classList.contains("on")') && !/rq\.oninput=[^\n]*render\(\)/.test(logic));

console.log("\nSIGN-UP IN MOTION (2026-11-05: 'make the onboarding more interactive so it's not so static. Motion.')");
const mo = readFileSync(join(ROOT, "src/app/styles/motion.css"), "utf8"), gx = mo.slice(mo.indexOf("SIGN-UP IN MOTION"));
const page = readFileSync(join(ROOT, "public/index.html"), "utf8");
t("a new step moves in — forward from the right, back from the left — once; a repaint of the same step doesn't", scr.includes("const fresh=key!==was") && scr.includes('${fresh?" gx-in"+(back?" gx-back":""):""}') && readFileSync(join(ROOT, "src/app/state/state.js"), "utf8").includes('let GXPAINTED=""'));
t("the parts arrive one after another; titles cascade in lab by lab; the newest progress bar fills", gx.includes(".gx-body.gx-in>*:nth-child(2)") && gx.includes("calc(.12s + var(--g,0) * .07s)") && gx.includes(".gx-prog i.now") && scr.includes('${k===i?" now":""}'));
t("what you pick pops, the count bumps, your colour ring pops, your photo lands, the welcome bursts", gx.includes(".gx-roles .chip.on") && logic.includes("gxBump(c)") && logic.includes("gxBump(t)") && gx.includes("gxLand") && scr.includes('class="gx-burst"'));
t("transform and opacity only, and none of it with reduced motion", !/(width|height|top|left|margin|padding)\s*:/.test(gx.split("@media (prefers-reduced-motion:no-preference){")[1].replace(/@keyframes[^\n]*/g, "")) && gx.includes("@media (prefers-reduced-motion:no-preference){"));
console.log(`\n  ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
