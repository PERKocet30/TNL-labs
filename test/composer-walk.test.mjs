/* POST WALKTHROUGH v1.0 — 2026-11-05. "Make the post composer walk you through the posting process like
   Instagram and the onboarding process or the product listing" — your work → where it belongs (a lab,
   #tags) → caption & details. Runs the real #tag rules from app/compose/composer-walk.js. */
import { readFileSync } from "node:fs";
let pass = 0, fail = 0;
const t = (n, ok) => { ok ? pass++ : fail++; console.log("  " + (ok ? "✓" : "✗") + "  " + n); };
const R = (f) => readFileSync(new URL("../" + f, import.meta.url), "utf8");
const w = R("src/app/compose/composer-walk.js"), comp = R("src/app/compose/composer.js"), back = R("src/app/nav/back.js"),
  mo = R("src/app/nav/motion.js"), q = R("src/app/compose/queue.js"), order = R("src/app/order.mjs"), css = R("src/app/styles/compose.css");

console.log("\nTHE STEPS");
t("three steps: your work → where it belongs → caption & details", /const PCW_STEPS=\["media","place","details"\]/.test(w));
t("loaded right after the composer", order.indexOf('"compose/composer.js"') < order.indexOf('"compose/composer-walk.js"'));
t("steps 1–2 take over a new post; Edit info keeps its one page", comp.includes('if(!c.edit&&pcwStep(c)!=="details")return pcwHTML(c,media);') && /pcwStep=c=>c&&!c\.edit/.test(w));
t("the head: Cancel on the first step, Back after; N / 3; Post only on the last", /i\?\{id:"pcwback",back:true\}:\{id:"pccancel",label:"Cancel"\}/.test(w) && /last\?\{id:"pcgo",label:c\.busy\?"Posting…":"Post"/.test(w) && /\$\{i\+1\} \/ \$\{PCW_STEPS\.length\}/.test(w));
t("a progress bar, the listing walkthrough's", /sw-prog pcw-prog/.test(w));
t("Next sits at the bottom, a big button; off on step 1 until there's work", /<button class="gx-btn" id="pcwnext" \$\{has\?"":"disabled"\}>Next<\/button>/.test(w));
t("no picture? words or a song skip ahead", w.includes('id="pcwwords">No picture — just words or a song'));
t("the phone's back goes a step back", back.includes("else if(PCOMPOSE&&pcwBack()){navRearm(d);return}") && /function pcwBack\(\)/.test(w));
t("each step is a screen: Next moves forward, Back back (motion)", mo.includes('return "compose:"+pcwStep(PCOMPOSE)') && mo.includes("2+Math.max(0,PCW_STEPS.indexOf(pcwStep(PCOMPOSE)))"));
t("a restored draft opens on its details", q.includes('draftId:it.d.id,idx:0,step:"details"'));
t("step 3 on a phone shows the work as a thumbnail beside the caption", comp.includes('<div class="pc-cap">${pceThumb(c)}') && /@media\(max-width:1023px\)\{\.pc-det \.pc-media\{display:none\}\}/.test(css));
t("…except while tagging people on it", comp.includes('" pcw-details"+(c.tagMode?"":" pc-det")'));

console.log("\nWHERE IT BELONGS");
t("one tap picks its lab — your labs first, each with what it's for; tap again takes it out", /labsOrdered\(\)\.map/.test(w) && /LAB_ID\[l\.id\]\|\|\{\}\)\.for/.test(w) && /if\(pcwLabId\(c\)===l\.id\)c\.ch=null/.test(w) && /const h=labHome\(l\);c\.ch=\{id:h\.id,label:l\.name,lab:l\.name\}/.test(w));
t("#tags people use in that lab, one tap each (a shimmer while they load)", /papi\.tags\(lab,""\)/.test(w) && /pcw-sk/.test(w));
t("…or your own", w.includes('id="pcwtagq" placeholder="Add your own"'));
t("skippable — it stays on your profile", w.includes('id="pcwskip">Skip — just my profile'));
t("never explains the ranking", !/showroom|rank|feature|boost/i.test(w.slice(w.indexOf("function pcwHTML"))));

console.log("\n#TAGS GO IN THE CAPTION — the real rules");
const grab = (name) => w.slice(w.indexOf(name), w.indexOf("\n", w.indexOf(name)));
const env = new Function("PC_CAP_MAX", "toast", grab("const PCW_TAG_RE") + "\n" + grab("const pcwTags") + "\n" + w.slice(w.indexOf("function pcwToggleTag"), w.indexOf("\nfunction pcwHead")) + "\nreturn {pcwTags,pcwToggleTag};");
let toasted = ""; const T = env(2200, (m) => (toasted = m));
const c = { body: "" };
T.pcwToggleTag(c, "Painting"); t("a #tag into an empty caption", c.body === "#painting");
T.pcwToggleTag(c, "#oil"); t("the next one joins the line", c.body === "#painting #oil");
c.body = "Train journey\n#collage"; T.pcwToggleTag(c, "art"); t("after a caption, on the #tag line", c.body === "Train journey\n#collage #art");
c.body = "Train journey"; T.pcwToggleTag(c, "art"); t("after words, a blank line then the #tag", c.body === "Train journey\n\n#art");
T.pcwToggleTag(c, "ART"); t("tapping it again takes it out", c.body === "Train journey");
c.body = "my #art piece"; T.pcwToggleTag(c, "art"); t("…from the middle of the caption too", c.body === "my piece");
T.pcwToggleTag(c, "a"); t("too short says so", /2–30/.test(toasted));
c.body = Array.from({ length: 10 }, (_, i) => "#tag" + i).join(" "); toasted = ""; T.pcwToggleTag(c, "more"); t("ten is the most", /Up to 10/.test(toasted) && !c.body.includes("#more"));
t("read the way the labs read them (not inside a link)", T.pcwTags("see https://x.com/#frag and #real").join() === "real");

console.log(`\n  ${pass} passed, ${fail} failed`);
if (fail) process.exit(1);
