/* AN OPENED POST LEADS ON — 2026-11-15, the fix list's number 3 (app/posts/post-next.js). */
import { readFileSync } from "node:fs";
let pass = 0, fail = 0;
const t = (n, ok) => { ok ? pass++ : fail++; console.log("  " + (ok ? "✓" : "✗") + "  " + n); };
const R = (f) => readFileSync(new URL("../" + f, import.meta.url), "utf8");
const w = R("src/app/posts/post-next.js"), media = R("src/app/media/media.js"), order = R("src/app/order.mjs"), state = R("src/app/state/state.js");

console.log("\nUNDER AN OPENED POST");
t("the opened post draws it and wires it", media.includes("${poNextHTML(p)}</div>") && media.includes("poWire();"));
t("it's in the app, after the opened post's own part", order.indexOf('"posts/post-next.js"') > order.indexOf('"media/media.js"'));
t("its lab, one tap into the lab", w.includes('data-polab="${esc(lab.id)}"') && /openLab\(b\.dataset\.polab\)/.test(w));
t("More from @artist — their other work, up to six, three across; a shimmer while it comes", w.includes("More from @${esc(p.author.username)}") && /\.slice\(0,6\)/.test(w) && w.includes("sk-img po-mt"));
t("…asked once per artist and kept (POMORE, in the register)", /POMORE\[u\]=null;api\.profile\(u\)/.test(w) && /^let POMORE=\{\};/m.test(state));
t("…and landing repaints only that part, never the post under the reader", /function poPaint\(\)\{const el=document\.getElementById\("ponext"\)/.test(w) && w.includes("el.outerHTML=poNextHTML(p)"));
t("Next piece — the one after it in the list it was opened from", w.includes("<b>Next piece</b>") && /function poStep\(p,dir\)/.test(w));
t("a sideways swipe goes next or back — not on a carousel or a video, which swipe themselves", w.includes('!e.target.closest(".caro,.vwrap,video,input,textarea")') && /Math\.abs\(dx\)>70&&Math\.abs\(dx\)>2\*Math\.abs\(dy\)/.test(w));
t("nothing here decides an order or explains the ranking", !/rank|score|boost/i.test(w.replace(/rank\.js's/g, "")));

console.log(`\n  ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
