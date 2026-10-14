// Palette v1.0 (2026-09-29): every colour comes from src/palette.js.
// Change a colour there and the app, /admin, server pages, emails and the
// share card all follow. This keeps it that way.
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { readFileSync, readdirSync } from "node:fs";
import { PALETTE, ACCENTS, accentHex, paletteCss, accentSet, accentVars, inkFor, onAccent } from "../src/palette.js";
const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const read = (f) => readFileSync(join(ROOT, f), "utf8");
let pass = 0, fail = 0;
const t = (n, ok) => { ok ? pass++ : fail++; console.log("  " + (ok ? "✓" : "✗") + "  " + n); };

console.log("\nONE PALETTE");
const keys = ["bg", "card", "el", "tx", "tx2", "dim", "line", "fgRgb", "scrim", "red", "err"];
t("day and night define the same colours", keys.every((k) => PALETTE.light[k] && PALETTE.dark[k]));
t("white, black and green", PALETTE.light.bg === "#FFFFFF" && PALETTE.light.tx === "#000000" && PALETTE.dark.bg === "#000000" && PALETTE.dark.tx === "#FFFFFF" && PALETTE.accent === "#98FC68");
t("member accents live here too, and db.js hands out the same ones", read("src/db.js").includes('export { ACCENTS, accentHex } from "./palette.js"') && accentHex("heat") === "#FF5A1F" && accentHex("nope") === "#98FC68" && Object.keys(ACCENTS).length === 11 && Object.values(ACCENTS).filter((a) => !a.legacy).length === 9);
const css = paletteCss();
t("the stylesheet has every variable the app uses", ["--bg", "--card", "--el", "--tx", "--tx2", "--dim", "--fg-rgb", "--line", "--line2", "--green", "--accent-fill", "--on-accent", "--fill", "--on-fill", "--scrim", "--red", "--err"].every((v) => css.includes(v + ":")));
t("day is the default; dark is picked by data-theme", /:root,\[data-theme="light"\]\{--bg:#FFFFFF/.test(css) && /\[data-theme="dark"\]\{--bg:#000000/.test(css));
t("a page can wear a member's accent (--acc…)", /--green:var\(--acc-l,/.test(css) && /--accent-fill:var\(--acc,/.test(css) && accentVars("#FF5A1F").startsWith("--acc:#FF5A1F;"));

console.log("\nNOBODY KEEPS THEIR OWN COLOURS");
const parts = readdirSync(join(ROOT, "src")).filter((f) => /^app-\d{2}-.*\.css$/.test(f));
const defines = (s) => /(^|[;{\s])--(bg|tx|dim|el|card|green|accent-fill)\s*:\s*#/m.test(s);
t("no app stylesheet defines theme colours" + parts.filter((f) => defines(read("src/" + f))).map((f) => " (" + f + ")").join(""), !parts.some((f) => defines(read("src/" + f))));
t("the app's CSS keeps the /*@palette*/ marker", read("src/app-02-styles-base.css").includes("/*@palette*/"));
t("the built app has the palette written in", read("public/index.html").includes(paletteCss()));
t("/admin takes /palette.css and defines none of its own", read("public/admin.html").includes('href="/palette.css"') && !defines(read("public/admin.html")));
t("server pages inline paletteCss() and define none of their own", /\$\{paletteCss\(\)\}/.test(read("src/server-01-look.js")) && !defines(read("src/server-01-look.js")) && /app\.get\("\/palette\.css"/.test(read("src/server-01-look.js")));
const mail = read("src/mail.js");
t("emails read PALETTE (no hand-typed theme hexes)", mail.includes('from "./palette.js"') && !/#(F7F1F1|FBF8F8|5C5C5C|E6E6E6|262626|9A9A9A|467430)/i.test(mail.replace(/\/\*[\s\S]*?\*\//g, "")));
t("the share card reads PALETTE", /bg: ffc\(PALETTE\.light\.bg\)/.test(read("src/server-10-profile-card.js")));
t("the app's browser bar colour follows --bg", /getPropertyValue\("--bg"\)/.test(read("src/app-07-theme-labs-api.js")));

console.log("\nTHE ACCENT MATHS MATCH THE APP'S");
const app = read("src/app-08-state-ui.js");
const grab = (name) => { const i = app.indexOf("function " + name + "("); let d = 0; for (let k = app.indexOf("{", i); k < app.length; k++) { if (app[k] === "{") d++; else if (app[k] === "}" && --d === 0) return app.slice(i, k + 1); } };
const clientInk = (theme) => new Function("THEME", grab("inkFor") + "\nreturn inkFor;")(theme);
const clientOn = new Function(grab("onAccent") + "\nreturn onAccent;")();
const same = Object.values(ACCENTS).every(({ hex }) =>
  clientInk("light")(hex).toLowerCase() === inkFor(hex, "light").toLowerCase()
  && clientInk("dark")(hex).toLowerCase() === inkFor(hex, "dark").toLowerCase()
  && clientOn(hex) === onAccent(hex));
t("inkFor / onAccent give the app's exact colours for every accent, day and night", same);
/* v2 (2026-10-14, "colors aren't matching up"): text in a member's colour is that colour, only darker — lime
   stays a green (#357607), not olive (#467430) — and every one reads at 4.5:1 on the day and night grounds. */
t("Lab green reads as a green on white (#357607), not olive", inkFor("#98FC68", "light") === "#357607" && accentSet("#98FC68").on === "#152C09");
const hsl = (h) => { const [r, g, b] = [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16) / 255), mx = Math.max(r, g, b), mn = Math.min(r, g, b), d = mx - mn;
  const hue = !d ? 0 : mx === r ? ((g - b) / d + 6) % 6 * 60 : mx === g ? ((b - r) / d + 2) * 60 : ((r - g) / d + 4) * 60; return { h: hue, s: d / (1 - Math.abs(mx + mn - 1) || 1) }; };
const Yl = (h) => { const v = [1, 3, 5].map((i) => { let x = parseInt(h.slice(i, i + 2), 16) / 255; return x <= 0.04045 ? x / 12.92 : Math.pow((x + 0.055) / 1.055, 2.4); }); return 0.2126 * v[0] + 0.7152 * v[1] + 0.0722 * v[2]; };
const offered = Object.values(ACCENTS).filter((a) => !a.legacy);
t("every offered colour's text reads at 4.5:1, day and night", offered.every((a) => 0.86 / (Yl(inkFor(a.hex, "light")) + 0.05) >= 4.5 && (Yl(inkFor(a.hex, "dark")) + 0.05) / 0.05 >= 4.5));
t("…and keeps its hue and richness (no muddy greys)", offered.every((a) => { const x = hsl(a.hex), y = hsl(inkFor(a.hex, "light")), dh = Math.min(Math.abs(x.h - y.h), 360 - Math.abs(x.h - y.h)); return dh < 20 && y.s > 0.6; }));

console.log(`\n  ${pass} passed, ${fail} failed`);
