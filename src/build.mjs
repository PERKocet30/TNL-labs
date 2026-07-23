/* build.mjs — applies src/patches/*.mjs at boot, then the app runs.
   WHY: the monoliths (server.js 196KB, index.html 282KB) are too large to
   retransmit through the GitHub connector Claude deploys from, so changes
   ship as small exact-match patches instead.
   - Hunks targeting src/server.js are applied to a COPY written to
     src/server.runtime.js (server.js stays pristine; package.json runs
     the runtime file).
   - Hunks targeting any other file (e.g. public/index.html) are applied
     IN PLACE in the container — deterministic, rebuilt from pristine on
     every deploy.
   Each hunk must match its expected count EXACTLY or the build fails hard;
   a failed build crashes the deploy and Railway keeps the previous
   deployment serving. To consolidate later: upload flattened files, empty
   the patches dir. */
import { readFileSync, writeFileSync, readdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { execFileSync } from "node:child_process";

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, "..");
const args = process.argv.slice(2);
const arg = (k, d) => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : d; };
const serverIn = arg("--in", join(here, "server.js"));
const serverOut = arg("--out", join(here, "server.runtime.js"));
const rootDir = arg("--root", root);

const files = readdirSync(join(here, "patches")).filter(f => f.endsWith(".mjs")).sort();
const texts = {};   // path -> current text
const load = (rel) => texts[rel] ?? (texts[rel] = readFileSync(rel === "src/server.js" ? serverIn : join(rootDir, rel), "utf8"));

for (const f of files) {
  const hunks = (await import(pathToFileURL(join(here, "patches", f)).href)).default;
  for (const [i, h] of hunks.entries()) {
    const rel = h.file || "src/server.js";
    const want = h.count || 1;
    let src = load(rel);
    const n = src.split(h.find).length - 1;
    if (n !== want) { console.error(`[build] ${f} hunk ${i} (${rel}): expected ${want} match(es), found ${n}`); process.exit(1); }
    texts[rel] = src.split(h.find).join(h.replace);
  }
  console.log(`[build] applied ${f} (${hunks.length} hunks)`);
}
for (const [rel, txt] of Object.entries(texts)) {
  const out = rel === "src/server.js" ? serverOut : join(rootDir, rel);
  writeFileSync(out, txt);
  console.log(`[build] wrote ${out} (${txt.length} bytes)`);
}
if (!texts["src/server.js"]) { writeFileSync(serverOut, readFileSync(serverIn, "utf8")); console.log(`[build] wrote ${serverOut} (passthrough)`); }

/* ffmpeg probe. Logged, never fatal: a missing binary breaks audio
   extraction only, and crashing the boot over one feature would take the
   whole app down. The extract route checks again and fails loud there. */
try {
  const v = execFileSync("ffmpeg", ["-version"], { encoding: "utf8" }).split("\n")[0];
  console.log(`[build] ffmpeg  ${v}`);
} catch {
  console.log("[build] ffmpeg  MISSING — audio extraction unavailable");
}
