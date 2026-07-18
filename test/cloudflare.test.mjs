import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
import { readFileSync } from "node:fs";
const s = readFileSync(ROOT+"/src/server.js","utf8");
let pass=0,fail=0;
const t=(n,ok)=>{ok?pass++:fail++;console.log("  "+(ok?"✓":"✗")+"  "+n)};

console.log("\nBEHIND CLOUDFLARE");
t("trust proxy is set", /app\.set\("trust proxy"/.test(s));
t("  hop count, not `true` — `true` lets anyone spoof their IP", /trust proxy", 2\)/.test(s));
t("rate limiting reads CF-Connecting-IP", /cf-connecting-ip/.test(s));
t("  -> without this, everyone shares ONE ip", true);
console.log("     and the register limit is 5/hour, so the 6th person");
console.log("     to EVER sign up gets blocked. Silent, and looks like");
console.log("     a bug in your app.");

console.log("\nREALTIME SURVIVES THE PROXY");
t("SSE sets X-Accel-Buffering: no", /X-Accel-Buffering": "no"/.test(s));
t("SSE sets no-transform", /no-cache, no-transform/.test(s));
t("  -> proxies buffer by default. realtime stops being realtime.", true);

console.log("\nWHAT GETS CACHED");
t("uploads: immutable, 1 year", /max-age=31536000, immutable/.test(s));
t("  -> your artists' images served from CF's network, free egress", true);
t("html: must-revalidate", /max-age=0, must-revalidate/.test(s));
t("  -> a cached index.html is how you serve a broken build forever", true);
t("profile pages: 60s browser / 300s edge", /s-maxage=300/.test(s));
t("  -> a link in a 226-person chat won't hammer Railway", true);

console.log("\nTHE DANGEROUS ONE");
t("/api/* is private, no-store", /app\.use\("\/api", \(req, res, next\)/.test(s) && /private, no-store/.test(s));
t("  -> if 'Cache Everything' ever gets switched on in CF,", true);
t("     /api/me would be cached and served to the next person.", true);
t("     One account. Everyone's session. Not a code bug — a config one.", true);

console.log("\n" + "=".repeat(46));
console.log(pass + " passed, " + fail + " failed");
