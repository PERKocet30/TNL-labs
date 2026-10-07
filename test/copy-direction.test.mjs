// Copy direction (2026-10-07): build a culture of collaboration, don't lecture it.
// The app never explains its algorithm or tells people that collabs are the
// point. Collab stays something you can do (invite, accept, "Built with"),
// not something the copy keeps pushing. This guards against the old lines
// creeping back in.
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { readFileSync, readdirSync } from "node:fs";
const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
let pass = 0, fail = 0;
const t = (n, ok) => { ok ? pass++ : fail++; console.log("  " + (ok ? "✓" : "✗") + "  " + n); };

const files = [
  ...readdirSync(join(ROOT, "src")).filter((f) => /^(app|server)-.*\.(js|html)$/.test(f)).map((f) => join("src", f)),
  "src/mail.js", "public/studio.js",
];
const all = files.map((f) => [f, readFileSync(join(ROOT, f), "utf8")]);
// Only user-facing text: drop comments so notes for developers can still say anything.
const strip = (s) => s.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "").replace(/<!--[\s\S]*?-->/g, "");
const banned = [
  [/collabs? rank highest/i, "says collabs rank highest"],
  [/the algorithm/i, "explains the algorithm"],
  [/collabs start/i, "says this is where collabs start"],
  [/that's a collab/i, "tells people what counts as a collab"],
  [/TWO-SIDED/, "uses internal jargon (TWO-SIDED)"],
  [/how collaborators find you/i, "frames sign-up around collaborators"],
  [/Loops become collabs/i, "Beat Lab blurb pushes collabs"],
  [/community backs you/i, "explains the fee ladder in the link preview"],
  [/Build with \$\{/, "public profile button says Build with"],
];
console.log("\nCOPY — NO COLLAB LECTURES, NO ALGORITHM TALK");
for (const [re, label] of banned) {
  const hits = all.filter(([, s]) => re.test(strip(s))).map(([f]) => f);
  t(`nothing ${label}${hits.length ? " — found in " + hits.join(", ") : ""}`, !hits.length);
}

const head = readFileSync(join(ROOT, "src/app-01-head.html"), "utf8");
console.log("\nCOPY — LINK PREVIEW");
t("link preview leads with the positioning line", head.includes('og:description" content="Social media by creatives, for creatives.'));

console.log("\nCOPY — COLLAB IS STILL THERE TO USE");
const app = all.filter(([f]) => f.includes("app-")).map(([, s]) => s).join("\n");
t("invite a collaborator still exists", app.includes('title:"Invite a collaborator"'));
t("accept collab still exists", app.includes("Accept collab"));
t("Built with credit still shows on Showroom posts", app.includes("Built with ${accepted.map("));

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
