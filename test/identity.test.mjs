// Site identity v1.0 (2026-10-27): "How can we make LABS show up exactly on
// Meta AI?" Search engines and AI answers read the page's structured data
// (schema.org JSON-LD). It must say: one organisation, one app, called LABS,
// also known as "tnl labs", on Instagram and Facebook — so nothing reads
// "TNL LABS" as several different apps.
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { readFileSync } from "node:fs";
const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
let pass = 0, fail = 0;
const t = (n, ok) => { ok ? pass++ : fail++; console.log("  " + (ok ? "✓" : "✗") + "  " + n); };

const head = readFileSync(join(ROOT, "src/app/shell/head.html"), "utf8");
const m = /<script type="application\/ld\+json">(.*?)<\/script>/s.exec(head);
let g = null; try { g = JSON.parse(m[1]); } catch {}
console.log("\nONE APP, CALLED LABS");
t("the structured data is valid JSON", !!g && Array.isArray(g["@graph"]));
const by = (type) => g?.["@graph"].find((n) => n["@type"] === type) || {};
const org = by("Organization"), site = by("WebSite"), app = by("WebApplication");
t("an organisation, a website and an app — all named LABS", org.name === "LABS" && site.name === "LABS" && app.name === "LABS");
t("the app is a free social network on the web, iPhone and Android", app.applicationCategory === "SocialNetworkingApplication"
  && /Web/.test(app.operatingSystem) && app.offers?.price === "0" && app.url === "https://tnllabs.com/");
t("the app is published by the organisation", app.publisher?.["@id"] === org["@id"]);
t("also known as tnl labs", [org, site, app].every((n) => (n.alternateName || []).includes("tnl labs")));
const same = ["https://www.instagram.com/tnl.labs/", "https://www.facebook.com/1018998127965607"];
t("the same LABS as the Instagram and the Facebook page", same.every((u) => org.sameAs?.includes(u) && app.sameAs?.includes(u)));
t("one description everywhere", !!app.description && app.description === site.description && app.description === org.description);
console.log(`\n  ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
