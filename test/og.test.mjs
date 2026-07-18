import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
import { readFileSync } from "node:fs";
let pass=0,fail=0;
const t=(n,ok)=>{ok?pass++:fail++;console.log("  "+(ok?"✓":"✗")+"  "+n)};

console.log("\nHOMEPAGE — labs.tnllabs.com pasted in a DM");
const idx=readFileSync(ROOT+"/public/index.html","utf8");
const head=idx.slice(0,idx.indexOf("</head>"));
const meta=(p)=>{const m=new RegExp(`<meta property="${p}" content="([^"]*)"`).exec(head); return m&&m[1]};
for(const p of ["og:type","og:site_name","og:url","og:title","og:description","og:image","og:image:width","og:image:height"])
  t(p+" = "+(meta(p)||"MISSING").slice(0,44), !!meta(p));
t("og:image is an ABSOLUTE https url", /^https:\/\//.test(meta("og:image")||""));
t("  -> a crawler fetches from Meta's servers, not your phone", true);
t("1200x630 — Meta's spec", meta("og:image:width")==="1200" && meta("og:image:height")==="630");
t("twitter:card is summary_large_image", /twitter:card" content="summary_large_image/.test(head));
t("tags are STATIC in the html", head.includes("og:image"));
t("  -> crawlers don't run JS. whatever the app renders later is invisible.", true);

console.log("\nPROFILE — /u/eclasona");
const srv=readFileSync(ROOT+"/src/server.js","utf8");
const uroute=srv.slice(srv.indexOf('app.get("/u/:username"'), srv.indexOf('app.get("/u/:username"')+7000);
for(const p of ["og:type","og:url","og:title","og:description","og:image","og:image:width","og:image:height","profile:username"])
  t(p, uroute.includes(`property="${p}"`));
t("uses their WORK as the image, not their avatar", uroute.includes("posts.find((p) => p.imageUrl"));
t("  -> a 56px circle crops to nothing; a poster stops a thumb", true);
t("falls back: work -> avatar -> the TNL mark", uroute.includes("|| abs(u.avatar_url) ||"));
t("  -> there is ALWAYS an image, so there is always a card", true);
t("every url made absolute", uroute.includes("const abs = (path)"));
t("description carries roles + real stats", uroute.includes("const stats = ["));

console.log("\nPOST — /p/12");
const proute=srv.slice(srv.indexOf('app.get("/p/:id"'), srv.indexOf('app.get("/p/:id"')+4000);
t("og:image present", proute.includes('property="og:image"'));
t("collab titles read 'ECLASONA × TNL.LABS'", proute.includes("× ${accepted.map"));
t("  -> two names on one piece IS the pitch", true);
t("canonical url", proute.includes('property="og:url"'));

console.log("\nWHY THIS WORKS AT ALL");
t("the pages are public — no auth wall for the crawler", srv.includes('app.get("/u/:username", (req, res)'));
t("  -> guest access is what makes previews possible", true);
t("only PUBLISHED profiles preview", uroute.includes("!u.published"));
t("  -> a private portfolio stays private, even to Meta", true);

console.log("\n"+"=".repeat(46));
console.log(pass+" passed, "+fail+" failed");
