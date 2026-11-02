/* ASSEMBLE — rebuilds the two big files from their parts at boot.
   v2.1 · 2026-10-31 — a part's opening comment block stays out of the page (see TARGETS)
   v2.0 · 2026-10-31 — the flatten: parts live in feature folders and an explicit
   order (src/app/order.mjs, src/server/order.mjs) replaces filename sorting.
   v1.1 · 2026-09-29 — the app's colours come from src/palette.js

   public/index.html and the server were single files of 350KB and 215KB —
   too big to edit or push in one piece. They live in src/ as parts, grouped
   by what they do, small enough to open and review:

     src/app/<feature>/*.{html,css,js}   → public/index.html
     src/server/<feature>/*.js           → src/server.runtime.js  (what actually runs)

   Parts are joined in the order the manifest says, with nothing added between
   them, so the built file is byte-for-byte what the parts say — with two
   exceptions in the app: each part's opening comment block is left out (it's
   for developers), and the @palette marker in the app's CSS (a CSS comment) is replaced by
   the theme variables from src/palette.js, the single place every colour is
   defined. To change the app, edit the part — never the built file; it's
   regenerated on every boot and ignored by git. A file on disk that the
   manifest doesn't list, or a listed file that's missing, stops the boot:
   a part silently left out is worse than a loud failure.

   Run by hand:  node src/assemble.mjs   (tests do this first) */
import { readdirSync, readFileSync, writeFileSync, existsSync, statSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { paletteCss } from "./palette.js";
import { APP } from "./app/order.mjs";
import { SERVER } from "./server/order.mjs";

const SRC = dirname(fileURLToPath(import.meta.url));
const ROOT = join(SRC, "..");

export const TARGETS = [
  { name: "public/index.html", out: join(ROOT, "public", "index.html"), dir: join(SRC, "app"), order: APP, ext: /\.(html|css|js)$/,
    /* A part's opening comment block is its version history, written for whoever edits it. Members
       don't need to download it: it's left out of the page (v2.1, 2026-10-31 — 90 parts, ~49KB raw,
       ~12KB gzipped). Only the run of block comments at the very START of a .js or .css part goes,
       because a file boundary is the one place a comment can be dropped without parsing anything:
       everything after the first line of code stays byte for byte. */
    part: (f, text) => /\.(js|css)$/.test(f) ? text.replace(/^(\s*\/\*[\s\S]*?\*\/)+\s*/, "") : text,
    fill: (body) => {
      if (!body.includes("/*@palette*/")) throw new Error("[assemble] the app's CSS lost its /*@palette*/ marker — no colours");
      return body.replace("/*@palette*/", paletteCss());
    } },
  { name: "src/server.runtime.js", out: join(SRC, "server.runtime.js"), dir: join(SRC, "server"), order: SERVER, ext: /\.js$/ },
];

/* every part file under a group's folder, as "feature/name.ext" */
function onDisk(dir, ext) {
  const out = [];
  for (const feature of readdirSync(dir)) {
    const p = join(dir, feature);
    if (!statSync(p).isDirectory()) continue;
    for (const f of readdirSync(p)) if (ext.test(f)) out.push(feature + "/" + f);
  }
  return out.sort();
}

/* the parts of a target, in build order — and the check that the manifest and the disk agree */
export function partsFor(t) {
  const listed = t.order, disk = onDisk(t.dir, t.ext);
  const missing = listed.filter((f) => !disk.includes(f)), unlisted = disk.filter((f) => !listed.includes(f));
  const twice = listed.filter((f, i) => listed.indexOf(f) !== i);
  if (missing.length || unlisted.length || twice.length) {
    throw new Error(`[assemble] ${t.name}: ` + [
      missing.length && `listed but not on disk: ${missing.join(", ")}`,
      unlisted.length && `on disk but not in the order file: ${unlisted.join(", ")}`,
      twice.length && `listed twice: ${twice.join(", ")}`,
    ].filter(Boolean).join("; "));
  }
  return listed;
}

export function assemble({ quiet = false } = {}) {
  const built = {};
  for (const t of TARGETS) {
    const parts = partsFor(t);
    const joined = parts.map((f) => { const text = readFileSync(join(t.dir, f), "utf8"); return t.part ? t.part(f, text) : text; }).join("");
    const body = t.fill ? t.fill(joined) : joined;
    const same = existsSync(t.out) && readFileSync(t.out, "utf8") === body;
    if (!same) writeFileSync(t.out, body);
    built[t.name] = { parts: parts.length, bytes: Buffer.byteLength(body) };
    if (!quiet) console.log(`[assemble] ${t.name}: ${parts.length} parts, ${Buffer.byteLength(body)} bytes`);
  }
  return built;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) assemble();
