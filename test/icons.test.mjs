// Drawn icons v1.0 (2026-09-29): no emoji or glyphs standing in for icons.
// iOS paints them as colour emoji that ignore the theme; every control
// draws its icon with the same 2px square-cap geometry instead.
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { readFileSync, readdirSync } from "node:fs";
const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
let pass = 0, fail = 0;
const t = (n, ok) => { ok ? pass++ : fail++; console.log("  " + (ok ? "✓" : "✗") + "  " + n); };
const GLYPHS = /[✎🗑🔇🔊▶❚⧉✉↗＋♫★✕🔒◫⚐]/u;
console.log("\nNO GLYPH ICONS IN THE APP");
for (const f of readdirSync(join(ROOT, "src")).filter((f) => /^app-.*\.js$/.test(f)).sort()) {
  // comments may talk about glyphs; code may not (block comments blanked, line numbers kept)
  const code = readFileSync(join(ROOT, "src", f), "utf8").replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, " "));
  const hits = code.split("\n").map((l, i) => [i + 1, l]).filter(([, l]) => GLYPHS.test(l.replace(/(^|[^:"'`])\/\/.*$/, "$1")));
  t(f + (hits.length ? "  → line " + hits.map((h) => h[0]).join(", ") : ""), !hits.length);
}
const icons = readFileSync(join(ROOT, "src/app-07-icons.js"), "utf8");
console.log("\nTHE DRAWN SET");
t("2px stroke, square caps, mitred joins, currentColor", /stroke-width="2" stroke-linecap="square" stroke-linejoin="miter"/.test(icons) && /stroke="currentColor"/.test(icons));
t("posts get one … menu, not a pencil and a bin", readFileSync(join(ROOT, "src/app-12-archive-posts.js"), "utf8").includes('data-pmore="${p.id}"'));
t("lab rows lost the ↗ open-arrow (it's in the hold menu)", !readFileSync(join(ROOT, "src/app-10-chat-6-labs.js"), "utf8").includes('class="msg-open"'));
t("stars are ink — green stays the one accent", !/#FBBF24/.test(readFileSync(join(ROOT, "src/app-05-styles-icons.css"), "utf8")) && /\.star\{color:var\(--tx\)/.test(readFileSync(join(ROOT, "src/app-05-styles-icons.css"), "utf8")));
console.log(`\n  ${pass} passed, ${fail} failed`);
