// Post creator v2 (2026-09-28): Instagram / Facebook grade, TNL look.
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { readFileSync } from "node:fs";
const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
let pass = 0, fail = 0;
const t = (n, ok) => { ok ? pass++ : fail++; console.log("  " + (ok ? "✓" : "✗") + "  " + n); };
const src = readFileSync(join(ROOT, "public/index.html"), "utf8");
const fn = (name) => { const i = src.indexOf("function " + name + "("); const j = src.indexOf("\nfunction ", i + 1); return i < 0 ? "" : src.slice(i, j); };
const html = fn("pcomposeHTML"), wire = fn("wirePCompose");

console.log("\nPOST CREATOR — LAYOUT");
t("large swipeable preview with a counter", html.includes('class="pc-track" id="pctrack"') && html.includes('id="pccount"'));
t("thumbnail strip with remove and add", html.includes('class="pc-strip"') && html.includes("data-pcrm") && html.includes('class="pc-th pc-add"'));
t("drag a thumbnail to reorder (2026-09-30)", src.includes("function pcDragWire(c)") && wire.includes("pcDragWire(c);") && html.includes('data-pci="${i}"'));
t("a spinner tile per photo still uploading", html.includes("Array.from({length:c.upN||0}"));
t("three rows: invite collaborators, add music, share to a lab",
  html.includes("Invite collaborators") && html.includes("Add music") && html.includes("Share to a lab"));
t("no explanation note under the caption", !html.includes("pcmp-note") && !/Showroom, where collabs rank highest/.test(src));

console.log("\nPOST CREATOR — BEHAVIOUR");
t("posts to the profile unless a lab is picked", src.includes('channel:c.ch?c.ch.id:"profile"'));
t("collaborator invites go out after the post exists", /const pid=d&&d\.post&&d\.post\.id;\s*if\(pid\)for\(const u of c\.collabs\|\|\[\]\)\{try\{await api\.invite\(pid,u\.username\)/.test(src));
t("at most 5 collaborators", wire.includes("c.collabs.length>=5"));
// 2026-10-09: upload a song from here; with no photos its cover is the post's picture
t("Add music offers Upload a song (audio files), through the library's own upload", html.includes('id="pcmusfile" accept="${TRACK_ACCEPT}"') && wire.includes("const t=await uploadTrackFile(file);") && src.includes("async function uploadTrackFile(file)"));
t("…then the name-and-cover sheet opens for it", wire.includes("TRKEDIT={id:t.id,title:t.title,artworkUrl:\"\",busy:false,fresh:true}"));
t("no photos + a song with a cover → the cover is the picture, and it can be shared", src.includes("const pcCover=c=>!c.imgs.length&&!c.upN&&!c.vid&&!c.vidbusy&&c.track&&c.track.artworkUrl") && src.includes("cov?[{url:cov,thumb:cov,"));
// 2026-10-08: labs are places — the picker lists the genres, each posting to its home channel
t("lab picker lists the places (each lab's home channel), not sub-channels — your labs first", wire.includes("for(const l of labsOrdered()){const ch=labHome(l);"));
t("# in the caption suggests tags people already use", wire.includes("papi.tags(") && wire.includes("data-pctag"));
t("@ in the caption asks the server for people", wire.includes("api.mentionable(m[2])"));
t("10 photos max, one video that stands alone", wire.includes("const room=10-c.imgs.length-(c.upN||0);") && wire.includes('toast("Video posts stand alone")'));
t("an in-progress upload, invite or lab choice counts as a draft", /const pcDirty=\(\)=>[^\n]*PCOMPOSE\.upN[^\n]*PCOMPOSE\.collabs[^\n]*PCOMPOSE\.ch/.test(src));

console.log("\nSHARE BUTTON — runs the real rule");
const pcCover = new Function("return " + src.slice(src.indexOf("const pcCover=") + 14, src.indexOf("||\"\";", src.indexOf("const pcCover=")) + 4))();
const pcCan = new Function("pcCover", "return " + src.slice(src.indexOf("const pcCan=") + 12, src.indexOf(";\n", src.indexOf("const pcCan="))))(pcCover);
t("empty → disabled", !pcCan({ body: "", imgs: [] }));
t("caption only → enabled", pcCan({ body: "hi", imgs: [] }));
t("photos → enabled", pcCan({ body: "", imgs: [{}] }));
t("while photos upload → can share (it posts when they land)", pcCan({ body: "", imgs: [], upN: 1 }));
t("while video uploads → can share (it posts when it lands)", pcCan({ body: "", imgs: [], vid: null, vidbusy: true }));
t("while sharing → disabled", !pcCan({ body: "hi", imgs: [], busy: true }));
t("just a song with a cover → enabled (the cover is the picture)", pcCan({ body: "", imgs: [], track: { artworkUrl: "/uploads/c.jpg" } }));
t("just a song without a cover → still needs a caption or photos", !pcCan({ body: "", imgs: [], track: { artworkUrl: "" } }));
t("while the song uploads → disabled", !pcCan({ body: "hi", imgs: [], musup: true }));

console.log(`\n  ${pass} passed, ${fail} failed`);
