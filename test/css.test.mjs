import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { readFileSync } from "node:fs";
const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
let pass = 0, fail = 0;
const t = (n, ok) => { ok ? pass++ : fail++; console.log("  " + (ok ? "✓" : "✗") + "  " + n); };

const src = readFileSync(join(ROOT, "public/index.html"), "utf8");
const css = src.split("<style>")[1].split("</style>")[0];

console.log("\nCSS STRUCTURE");
t("braces balance", (css.match(/\{/g) || []).length === (css.match(/\}/g) || []).length);
t("--green defined at :root (from src/palette.js)", /--green:\s*var\(--acc-l,#[0-9A-Fa-f]{6}\)/.test(css));
t("  not circular (--green:var(--green) kills every green thing)", !/--green:\s*var\(--green\)/.test(css));

console.log("\nCLASS COLLISIONS — two features, one name, later one wins silently");
/* .bcard belonged to the Showroom's builder cards. Reusing it for moodboards
   applied aspect-ratio:4/3 to every avatar and stretched them into ellipses.
   Nothing errors — it just looks broken, which is the worst kind. */
const OWNED = {
  ".bcard": "showroom builder cards",
  ".brow": "showroom builder row",
  ".bname": "showroom builder name",
  ".av": "avatars, everywhere",
  ".cell": "the studio grid",
};
for (const [cls, owner] of Object.entries(OWNED)) {
  // a full re-definition (not a modifier like `.bcard .av` or `.bcard:hover`)
  const re = new RegExp("(?:^|\\})\\s*" + cls.replace(".", "\\.") + "\\s*\\{([^}]*)\\}", "g");
  const bodies = [...css.matchAll(re)].map((m) => m[1]);
  const layoutClash = bodies.filter((b) => /aspect-ratio|width:\s*100%|grid-template/.test(b));
  t(`${cls} (${owner}) — no layout override`, layoutClash.length <= 1);
}

console.log("\nAVATARS STAY ROUND");
const av = /(?:^|\})\s*\.av\s*\{([^}]*)\}/.exec(css);
t(".av is a fixed square", /width:\s*\d+px/.test(av[1]) && /height:\s*\d+px/.test(av[1]));
t("  border-radius:50%", /border-radius:\s*50%/.test(av[1]));
t("  nothing gives it an aspect-ratio", !/\.bcard img\s*\{[^}]*aspect-ratio/.test(css));
t("  -> that's what turned them into ellipses", true);

console.log("\nMOODBOARDS ARE GONE (2026-10-11)");
for (const c of [".mbcard", ".mbgrid", ".mbrow", ".mbname", ".mbempty", ".pastebar", ".archsave"])
  t(c + " is gone", !css.includes(c + "{") && !css.includes(c + " ") && !css.includes(c + ","));
t("and don't touch .bcard", !/\.bcard img\s*\{/.test(css));

console.log("\nONE POST AT A TIME, LIKE INSTAGRAM (2026-11-10)");
{ const bare = css.replace(/\/\*[\s\S]*?\*\//g, ""), cols = [...bare.matchAll(/\.sr-grid(?:\.sr-wall)?\{[^}]*columns:\s*([^;}]+)/g)].map((m) => m[1].trim());
  t("the Showroom is one column at every width below the computer's gallery — never two posts side by side", cols.length > 0 && cols.every((c) => c === "1" || c === "auto"));
  t("  a phone on its side or a tablet gets a centred column, not the full width", /@media\(min-width:601px\)\{\.sr-grid\{max-width:min\(560px,max\(360px,100vh\)\);margin-left:auto;margin-right:auto\}\}/.test(bare)); }

console.log("\n" + "=".repeat(46));
console.log(pass + " passed, " + fail + " failed");
