// Soft v1.2 (2026-10-18; v1.2: posts square again, the Market gallery whole; v1.1: every screen and admin): "I don't like the sharp boxy design language … profiles
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
for (const s of [".ev-banner", ".bcard", ".lx", ".ev-invite", ".ui-card", ".c-post", ".pf-card"]) t(`${s} is a soft card`, rounded(s, "rad"));
for (const s of [".ev-th", ".msg-i", ".lx-media"]) t(`${s} pictures round a little`, rounded(s, "rad-m"));
for (const s of [".trk-art", ".ordimg", ".pc-th"]) t(`${s} thumbnails round a little less`, rounded(s, "rad-s"));
t("the phone feed stays edge to edge (Showroom cards round only from 601px)", /@media\(min-width:601px\)\{\.sr-card\{border-radius:var\(--rad\)\}\}/.test(soft) && !/(^|[,}\n])\s*\.sr-card\s*\{[^}]*--rad/.test(soft.replace(/@media\(min-width:601px\)\{[^}]*\}\}/, "")));
t("photo grids stay square (lab Work, the archive, profile grids)", !/\.pl-tile|\.archcard|\.cell\b|\.work\b/.test(soft));
// v1.2 (2026-10-18, "errors in market and post on profiles"): a post is a post; the Market gallery shows its whole photo
t("an opened post and its picture stay square", !/(^|[,\s])\.post(-img|-vid)?[,{\s]/.test(soft.replace(/\/\*[\s\S]*?\*\//g, "")));
t("the listing gallery isn't clipped to its box (that cut the photo short)", !/\.lgal\s*[,{][^}]*overflow:hidden/.test(soft) && !/\.lgal\{/.test(soft.replace(/\/\*[\s\S]*?\*\//g, "")));
t("no colours typed here (they live in src/palette.js)", !/#[0-9a-f]{3,8}\b/i.test(soft.replace(/\/\*[\s\S]*?\*\//g, "")));

// v1.1: "make sure everything matches the design language except the actual post"
for (const s of [".ev-drop", ".pc-pick", ".pf-add", ".pc"]) t(`${s} (where you add a picture, the post maker) is soft`, rounded(s, "rad"));
for (const s of [".mimgwrap", ".pl-cov.big"]) t(`${s} (Market pictures, a playlist cover) rounds a little`, rounded(s, "rad-m"));
t("the gallery's arrows are round buttons", /\.gal-nav\{border-radius:999px\}/.test(soft));
const ui = read("public/admin-app/ui.css");
t("admin: panels, cards, charts, lists and boxes round like the app", /\.panel,\.kpi,\.chart,\.card,\.box,\.list,\.menu-b\{border-radius:var\(--rad\)\}/.test(ui) && /\.stats,\.sum,\.pdb-wrap,\.pc\{border-radius:var\(--rad\);overflow:hidden\}/.test(ui));
t("admin: a titled card rounds as one piece", ui.includes("h2.sec:has(+ :is(.panel,.list,.chart)){border-radius:var(--rad) var(--rad) 0 0}") && ui.includes("h2.sec + :is(.panel,.list,.chart){border-radius:0 0 var(--rad) var(--rad)}"));
t("admin loads the new styles (?v=1.2)", read("public/admin.html").includes("/admin-app/ui.css?v=1.2"));

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

// …everywhere a member's picture shows, the server sends their colour with it
const srv = (f) => read("src/" + f);
t("comments, notifications and search carry the colour", /level: levelFor\(r\.rep\)\.id, accentHex: accentHex\(r\.accent\)/.test(srv("server-03-upload-dm-notifications.js"))
  && srv("server-03-upload-dm-notifications.js").includes("youFollow: !!r.you_follow, accentHex: accentHex(r.actor_accent)") && srv("server-03-upload-dm-notifications.js").includes('avatarUrl: p.avatar_url || "", accentHex: accentHex(p.accent)'));
t("messages carry it (and only when the row has it)", srv("server-10-dm-core.js").includes("...(u.accent !== undefined ? { accentHex: accentHex(u.accent) } : {})") && srv("server-10-dm-core.js").includes("u.last_seen_at, u.show_active, u.accent"));
t("sellers, @mentions, followers and tournament entrants carry it", srv("server-06-settings-payouts-market.js").includes("accentHex: accentHex(r.seller_accent)") && srv("server-07-orders-sharing.js").includes("role: r.role, accentHex: accentHex(r.accent)")
  && srv("server-11-profile.js").includes("accentHex: accentHex(x.accent)") && srv("server-10-events-2-routes.js").includes("avatarUrl: u.avatar_url, accentHex: accentHex(u.accent)"));

console.log(`\n  ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
