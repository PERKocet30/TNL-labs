// The phone's media cache is bounded (2026-10-08): it used to keep every
// picture ever scrolled past, forever, on phones short of storage.
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { readFileSync } from "node:fs";
const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const src = readFileSync(join(ROOT, "public/sw.js"), "utf8");
let pass = 0, fail = 0;
const t = (n, ok) => { ok ? pass++ : fail++; console.log("  " + (ok ? "✓" : "✗") + "  " + n); };
const boot = (free) => new Function("self", "caches", src + "\nreturn { mediaPut, MEDIA, MEDIA_MAX };")(
  { addEventListener() {}, navigator: { storage: { estimate: async () => ({ quota: 1e9, usage: 1e9 - free }) } } }, {});
const fakeCache = () => { const m = new Map(); return { m, put: async (k, v) => { m.delete(k); m.set(k, v); }, keys: async () => [...m.keys()], delete: async (k) => m.delete(k) }; };
const res = (bytes) => ({ headers: { get: (h) => (h === "content-length" ? String(bytes) : null) } });

console.log("\nTHE MEDIA CACHE");
let sw = boot(5e9), c = fakeCache();
t("a new cache name, so the old unbounded one is cleared", sw.MEDIA === "tnl-media-v3" && /k !== CACHE && k !== MEDIA/.test(src));
for (let i = 0; i < 100; i++) await sw.mediaPut(c, "/uploads/p" + i + ".jpg", res(200000));
t("at most 80 files, the oldest out first", c.m.size === sw.MEDIA_MAX && !c.m.has("/uploads/p0.jpg") && c.m.has("/uploads/p99.jpg"));
c = fakeCache(); await sw.mediaPut(c, "/uploads/big.jpg", res(3 * 1024 * 1024)); await sw.mediaPut(c, "/uploads/unknown.jpg", res(0));
t("nothing over 1MB, nothing of unknown size", c.m.size === 0);
sw = boot(50 * 1024 * 1024); c = fakeCache(); await sw.mediaPut(c, "/uploads/a.jpg", res(1000));
t("nothing at all when the phone is nearly full", c.m.size === 0);
t("ranged audio/video still bypasses the worker", /if \(e\.request\.headers\.get\("range"\)\) return;/.test(src));
console.log(`\n  ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
