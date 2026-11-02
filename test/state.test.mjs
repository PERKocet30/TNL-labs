// SHARED STATE v1.0 (2026-10-31): the app's top-level `let`s all live in
// src/app/state/state.js, the register, which loads first. This keeps it that
// way: no shared state hiding in a feature file, nothing in the register that
// runs code at load, and the register first in the build.
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { readFileSync } from "node:fs";
const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
let pass = 0, fail = 0;
const t = (n, ok) => { ok ? pass++ : fail++; console.log("  " + (ok ? "✓" : "✗") + "  " + n); };
const { APP } = await import("../src/app/order.mjs");
const read = (f) => readFileSync(join(ROOT, "src/app", f), "utf8");
const strip = (s) => s.replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, " ")).replace(/^\s*\/\/.*$/gm, "")
  .replace(/`(?:\\[\s\S]|\$\{[^}]*\}|[^`\\])*`/g, (m) => m.replace(/[^\n]/g, " "));

const js = APP.filter((f) => f.endsWith(".js"));
t("the register is the first script", js[0] === "state/state.js");
const stray = js.filter((f) => f !== "state/state.js" && /^let\s/m.test(strip(read(f))));
t("no top-level let outside the register" + (stray.length ? " — found in " + stray.join(", ") : ""), stray.length === 0);
const reg = strip(read("state/state.js"));
const names = [...reg.matchAll(/^let\s+([^;]+);/gm)].flatMap((m) => m[1].split(",").map((x) => x.trim().split("=")[0].trim()));
t("the register holds the app's state (100+ names, each declared once)", names.length >= 100 && new Set(names).size === names.length);
t("every line of the register is a let (nothing runs at load but reading storage)", reg.split("\n").every((l) => !l.trim() || /^let\s/.test(l)));
t("the register reads only storage, never the page or the network", !/document\.|fetch\(|render\(|addEventListener/.test(reg.replace(/\/\/.*$/gm, "")));
t("CH starts null here and is set beside LABS, the only place that knows the channels", /CH=null/.test(reg) && /^CH=LABS\[0\]\.channels\[0\];/m.test(strip(read("core/theme-labs-api.js"))));
t("THEME is declared before the script that applies it on load", js.indexOf("state/state.js") < js.indexOf("core/theme-labs-api.js") && /applyTheme\(THEME\)/.test(read("core/theme-labs-api.js")));
t("each group names the file that owns it", (read("state/state.js").match(/^\/\/ [a-z-]+\/[a-z-]+\.js$/gm) || []).length >= 30);

console.log(`\n  ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
