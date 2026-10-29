// Post creator v2 (2026-09-28).
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
t("large swipeable preview with a counter", html.includes('id="pctrack"') && html.includes('id="pccount"'));
t("thumbnail strip with remove and add", html.includes('class="pc-strip"') && html.includes("data-pcrm") && html.includes('class="pc-th pc-add"'));
t("drag a thumbnail to reorder (2026-09-30)", src.includes("function pcDragWire(c)") && wire.includes("pcDragWire(c);") && html.includes('data-pci="${i}"'));
t("a photo still uploading holds its place in the strip, with a spinner (2026-10-25)", html.includes('${im.busy?`<span class="spin"></span>`') && src.includes("const im={busy:true,thumb:local,url:local,local};c.imgs.push(im)"));
t("rows: invite collaborators, add music — and no \"Share to a lab\" (2026-10-21: Share is for sending out)",
  html.includes("Invite collaborators") && html.includes("Add music") && !html.includes("Share to a lab"));
// 2026-10-21 "make sharing into labs and posting on profiles cohesive": every post lives on your
// profile; a lab is where you also show it. The row says so, and the button says Post.
t("a Posting-to row: Your profile fixed, + Add a lab, the lab as a chip you can take out",
  html.includes('class="pc-to"') && html.includes("Your profile") && html.includes("Add a lab") && html.includes("data-pclabrm") && html.includes('id="pclab"'));
t("the main button says Post, not Share", html.includes('label:c.busy?"Posting…":"Post"') && !html.includes('"Sharing…"'));
t("the lab picker is called Add a lab and says it stays on your profile", wire.includes('title:"Add a lab"') && wire.includes("stays on your profile") && !wire.includes("Profile only"));
// 2026-10-21 "Instagram level": tag people on the picture, Preview, Also share to your Story, Advanced settings (app-18-composer-ig.js)
const ig = readFileSync(join(ROOT, "src/app-18-composer-ig.js"), "utf8");
t("Tag people places them on the picture (pins drawn on the slide; the tap lands on the drawn picture, not the letterbox)", wire.includes("pcTagStart(c)") && html.includes("pcPinsHTML(c,i)") && ig.includes("function pcDrawn(img)") && ig.includes("tapped the letterbox"));
t("Preview, Also share to your Story, Advanced settings rows", html.includes("pcIgRowsHTML(c)") && ig.includes('id="pcprev"') && ig.includes('id="pcstory"') && ig.includes('id="pcadv"'));
t("Advanced: comments, hide like count, alt text (200)", ig.includes('id="pccoff"') && ig.includes('id="pchide"') && ig.includes('id="pcalt"') && ig.includes('maxlength="200"'));
t("the preview is the Showroom's own card", ig.includes("srCardHTML(PCPREV,0)"));
t("the post carries pins, alt and hideLikes; the Story sheet opens after if asked", readFileSync(join(ROOT, "src/app-18-post-queue.js"), "utf8").includes("...pcIgExtras(c)") && readFileSync(join(ROOT, "src/app-18-post-queue.js"), "utf8").includes("pcAfterPosted(c,pid)"));
t("a caption counter near the 2,200 limit", html.includes('maxlength="${PC_CAP_MAX}"') && ig.includes("PC_CAP_MAX=2200"));
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
t("10 photos max, one video that stands alone", wire.includes("pcAddPhotos(c,rest)") && fn("pcAddPhotos").includes("const room=10-c.imgs.length;") && wire.includes('toast("Video posts stand alone")'));
t("uploads run two at a time and land into their own place; a cancelled drag reorders nothing (2026-10-25)", src.includes("const PC_UP_AT_ONCE=2;") && fn("pcAddPhotos").includes("delete im.busy;Object.assign(im,up)") && fn("pcDragWire").includes("th.onpointercancel=()=>{clearTimeout(hold);if(!d)return;const was=d;d=null;if(was.on)drop()}"));
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
