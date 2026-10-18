// Soft v1.0 (2026-10-18): "I don't like the sharp boxy design language … profiles
// should reflect what color style they choose around profile pic." Cards round,
// photo grids stay square, and every avatar wears its member's colour as a ring.
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { readFileSync } from "node:fs";
const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
let pass = 0, fail = 0;
const t = (n, ok) => { ok ? pass++ : fail++; console.log("  " + (ok ? "✓" : "✗") + "  " + n); };
const read = (p) => readFileSync(join(ROOT, p), "utf8");

const html = read("public/index.html");
const css = html.split("<style>")[1].split("</style>")[0];
const soft = read("src/app-05-styles-soft.css");

console.log("\nSOFT, NOT BOXY");
t("three radii, defined once", /:root\{--rad:16px;--rad-m:12px;--rad-s:8px\}/.test(soft));
t("the soft part is in the app", css.includes(":root{--rad:16px;--rad-m:12px;--rad-s:8px}"));
const rounded = (sel, v) => new RegExp("(^|[,}\\n])\\s*[^{}]*" + sel.replace(/[.]/g, "\\.") + "[^{}]*\\{[^}]*border-radius:var\\(--" + v + "\\)").test(soft);
for (const s of [".ev-banner", ".bcard", ".lx", ".ev-invite", ".post", ".ui-card", ".c-post", ".pf-card"]) t(`${s} is a soft card`, rounded(s, "rad"));
for (const s of [".ev-th", ".msg-i", ".post-img", ".lx-media"]) t(`${s} pictures round a little`, rounded(s, "rad-m"));
for (const s of [".trk-art", ".ordimg", ".pc-th"]) t(`${s} thumbnails round a little less`, rounded(s, "rad-s"));
t("the phone feed stays edge to edge (Showroom cards round only from 601px)", /@media\(min-width:601px\)\{\.sr-card\{border-radius:var\(--rad\)\}\}/.test(soft) && !/(^|[,}\n])\s*\.sr-card\s*\{[^}]*--rad/.test(soft.replace(/@media\(min-width:601px\)\{[^}]*\}\}/, "")));
t("photo grids stay square (lab Work, the archive, profile grids)", !/\.pl-tile|\.archcard|\.cell\b|\.work\b/.test(soft));
t("no colours typed here (they live in src/palette.js)", !/#[0-9a-f]{3,8}\b/i.test(soft.replace(/\/\*[\s\S]*?\*\//g, "")));

console.log("\nYOUR COLOUR AROUND YOUR PICTURE");
const app07 = read("src/app-07-theme-labs-api.js");
const [avRing, avHTML] = new Function("esc", app07.slice(app07.indexOf("const avRing="), app07.indexOf("\n", app07.indexOf("const avHTML=")) + 1) + "\nreturn [avRing, avHTML];")((s) => String(s));
t("a member with a colour gets the ring, in their colour", /class="av sm ring" style="--ring:#FF5A1F"/.test(avHTML({ avatarUrl: "/u.jpg", displayName: "ana", accentHex: "#FF5A1F" }, "sm")));
t("no colour, no ring (and the letters still show)", avHTML({ displayName: "ben" }) === '<div class="av ">BE</div>');
t("only a real #rrggbb goes into the style — nothing else can be injected", avRing({ accentHex: 'red;"><img src=x onerror=alert(1)>' })[0] === "" && avRing({ accentHex: "#12345" })[0] === "");
t("the ring: a gap in the background colour, then theirs", /\.av\.ring\{border-color:transparent;box-shadow:0 0 0 2px var\(--bg\),0 0 0 4px var\(--ring\)\}/.test(soft));
t("Who's building shows the person big, in their colour", /\.bcard \.av\{width:56px;height:56px/.test(soft) && read("src/app-11-showroom.js").includes("avHTML({avatarUrl:x.avatar_url,displayName:x.display_name,accentHex:x.accentHex})"));
t("…and the server sends each builder's colour", read("src/server-10-collabs-beats-showroom.js").includes("accentHex: accentHex(u.accent) }))"));
t("a profile picture wears the owner's colour, not the viewer's", read("src/app-15-profile.js").includes('class="pav pig-av"${avRing(u)[1]}') && /\.pav\{border:0;box-shadow:0 0 0 3px var\(--bg\),0 0 0 6px var\(--ring,var\(--accent-fill\)\)\}/.test(soft));

console.log(`\n  ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
