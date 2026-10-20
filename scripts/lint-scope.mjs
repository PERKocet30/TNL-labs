// LINT (quality week, 2026-10-20). The 59 app parts are joined into one
// file and share one scope, so a `const X` in two parts is a crash on boot,
// and a `function f` declared twice silently keeps the last one. No linter
// is a dependency of this app, so this does the one check that matters:
// every top-level name (const/let/class/function) is declared once across
// the app parts, and once across the server parts. Runs in `npm test`.
import { readdirSync, readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
const SRC = join(dirname(fileURLToPath(import.meta.url)), "..", "src");
const groups = { app: /^app-\d+.*\.js$/, server: /^server-\d+.*\.js$/ };
const strip = (s) => s.replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, " ")).replace(/^\s*\/\/.*$/gm, "")
  .replace(/`(?:\\[\s\S]|\$\{[^}]*\}|[^`\\])*`/g, (m) => m.replace(/[^\n]/g, " "));   // comments and template strings carry no declarations
let bad = 0;
for (const [g, re] of Object.entries(groups)) {
  const seen = new Map();
  for (const f of readdirSync(SRC).filter((n) => re.test(n)).sort()) {
    const src = strip(readFileSync(join(SRC, f), "utf8"));
    for (const m of src.matchAll(/^(?:export\s+)?(?:async\s+)?(?:const|let|var|class|function)\s+([A-Za-z_$][\w$]*)/gm)) {
      const name = m[1], where = seen.get(name);
      if (where && where !== f) { console.log(`  ✗  ${g}: "${name}" is declared in both ${where} and ${f}`); bad++; }
      else seen.set(name, f);
    }
    for (const m of src.matchAll(/^(?:export\s+)?(?:const|let|var)\s*\{([^}]*)\}\s*=/gm))
      for (const n of m[1].split(",").map((x) => x.split(":").pop().split("=")[0].trim()).filter(Boolean)) {
        const where = seen.get(n);
        if (where && where !== f) { console.log(`  ✗  ${g}: "${n}" is declared in both ${where} and ${f}`); bad++; } else seen.set(n, f);
      }
  }
}
console.log(bad ? `\n  ${bad} name clash${bad > 1 ? "es" : ""} — a part declares a name another part already has` : "  ✓  every top-level name is declared once (app parts, server parts)");
process.exit(bad ? 1 : 0);
