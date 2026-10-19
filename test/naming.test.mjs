// NAMING v1.0 — 2026-10-18: "Everything in the app should reference LABS not
// TNL. TNL is a separate brand." Nothing a member, a buyer, a link preview,
// an email or the admin shows says "TNL" — the app, its pages and its mail
// are LABS. (Code names like TNL_DATA, TNLStudio, the tnllabs.com domain and
// @handles aren't words anyone reads, so they're left alone; so are comments.)
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { readFileSync, readdirSync } from "node:fs";
const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
let pass = 0, fail = 0;
const t = (n, ok) => { ok ? pass++ : fail++; console.log("  " + (ok ? "✓" : "✗") + "  " + n); };
const strip = (s) => s.replace(/\/\*[\s\S]*?\*\//g, "").replace(/<!--[\s\S]*?-->/g, "").split("\n").map((l) => /^\s*\/\//.test(l) ? "" : l.replace(/(^|[^:"'`\\])\/\/[^"'`]*$/, "$1")).join("\n");
const WORD = /(?<![\w.@/-])TNL(?![\w])/g;
const files = [
  ...readdirSync(join(ROOT, "src")).filter((f) => /^(app|server)-/.test(f) && !f.includes("runtime")).map((f) => "src/" + f),
  "src/mail.js", ...readdirSync(join(ROOT, "public/admin-app")).map((f) => "public/admin-app/" + f),
  "public/admin.html", "public/studio.js", "public/door.js", "public/manifest.webmanifest",
];
const hits = [];
for (const f of files) {
  const lines = strip(readFileSync(join(ROOT, f), "utf8")).split("\n");
  lines.forEach((l, i) => { if (WORD.test(l)) hits.push(`${f}:${i + 1}: ${l.trim().slice(0, 100)}`); WORD.lastIndex = 0; });
}
console.log("\nTHE APP IS LABS");
t("no \"TNL\" anywhere members, buyers, previews, emails or admin read", hits.length === 0);
hits.slice(0, 10).forEach((h) => console.log("       " + h));
t("not \"TNL LABS\" either", files.every((f) => !strip(readFileSync(join(ROOT, f), "utf8")).includes("TNL LABS")));
const head = readFileSync(join(ROOT, "src/app-01-head.html"), "utf8");
t("the page title and link previews say LABS", head.includes("<title>LABS 🧪") && head.includes('content="LABS 🧪'));
t("installed on a phone it's called LABS", JSON.parse(readFileSync(join(ROOT, "public/manifest.webmanifest"), "utf8")).name === "LABS");
t("emails come from LABS by default", readFileSync(join(ROOT, "src/mail.js"), "utf8").includes('process.env.MAIL_FROM || "LABS <'));
console.log(`\n  ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
