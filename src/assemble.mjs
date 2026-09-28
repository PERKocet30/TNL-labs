/* ASSEMBLE — rebuilds the two big files from their parts at boot.
   v1.0 · 2026-09-28

   public/index.html and the server were single files of 350KB and 215KB —
   too big to edit or push in one piece. They now live in src/ as numbered
   parts, small enough to open, review and push one at a time:

     src/app-NN-*.{html,css,js}   → public/index.html
     src/server-NN-*.js           → src/server.runtime.js  (what actually runs)

   Parts are joined in filename order with nothing added between them, so the
   built file is byte-for-byte what the parts say. To change the app, edit the
   part — never the built file; it's regenerated on every boot and ignored
   by git.

   Run by hand:  node src/assemble.mjs   (tests do this first) */
import { readdirSync, readFileSync, writeFileSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const SRC = dirname(fileURLToPath(import.meta.url));
const ROOT = join(SRC, "..");

export const TARGETS = [
  { name: "public/index.html", out: join(ROOT, "public", "index.html"), re: /^app-\d{2}-[\w.-]+\.(html|css|js)$/ },
  { name: "src/server.runtime.js", out: join(SRC, "server.runtime.js"), re: /^server-\d{2}-[\w.-]+\.js$/ },
];

export function partsFor(re) {
  return readdirSync(SRC).filter((f) => re.test(f)).sort();
}

export function assemble({ quiet = false } = {}) {
  const built = {};
  for (const t of TARGETS) {
    const parts = partsFor(t.re);
    if (!parts.length) {
      // No parts yet (half-finished upload): keep whatever file is there.
      if (!existsSync(t.out)) throw new Error(`[assemble] no parts for ${t.name} and no existing file`);
      if (!quiet) console.log(`[assemble] ${t.name}: no parts, kept existing file`);
      continue;
    }
    const body = parts.map((f) => readFileSync(join(SRC, f), "utf8")).join("");
    const same = existsSync(t.out) && readFileSync(t.out, "utf8") === body;
    if (!same) writeFileSync(t.out, body);
    built[t.name] = { parts: parts.length, bytes: Buffer.byteLength(body) };
    if (!quiet) console.log(`[assemble] ${t.name}: ${parts.length} parts, ${Buffer.byteLength(body)} bytes`);
  }
  return built;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) assemble();
