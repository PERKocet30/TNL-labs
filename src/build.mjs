/* build.mjs — applies src/patches/*.mjs to src/server.js and writes
   src/server.runtime.js, which is what actually runs (see package.json).
   WHY: server.js is a 196KB monolith too large to retransmit through the
   GitHub connector Claude deploys from, so fixes ship as small exact-match
   patches instead. Each hunk must match EXACTLY ONCE or this build fails
   hard — a failed build crashes the deploy and Railway keeps the previous
   deployment serving. To consolidate later: upload a flattened server.js,
   empty the patches dir, and point package.json back at src/server.js. */
import { readFileSync, writeFileSync, readdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const args = process.argv.slice(2);
const arg = (k, d) => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : d; };
const inPath = arg("--in", join(here, "server.js"));
const outPath = arg("--out", join(here, "server.runtime.js"));

let src = readFileSync(inPath, "utf8");
const dir = join(here, "patches");
const files = readdirSync(dir).filter(f => f.endsWith(".mjs")).sort();
for (const f of files) {
  const hunks = (await import(pathToFileURL(join(dir, f)).href)).default;
  for (const [i, h] of hunks.entries()) {
    const n = src.split(h.find).length - 1;
    if (n !== 1) { console.error(`[build] ${f} hunk ${i}: expected exactly 1 match, found ${n}`); process.exit(1); }
    src = src.replace(h.find, h.replace);
  }
  console.log(`[build] applied ${f} (${hunks.length} hunks)`);
}
writeFileSync(outPath, src);
console.log(`[build] wrote ${outPath} (${src.length} bytes)`);
