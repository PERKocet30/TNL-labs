// SLOW PAGES + QUIET ANSWERS v1.0 — 2026-11-14. From the audit of 2026-11-14:
// 1. a link to a page built for it could hold the whole server up for minutes
//    while its preview was read (the old patterns ran across the whole page)
// 2. signing in and "forgot password" answered faster for an address with no
//    account than for one with — the wait said which emails are members
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { readFileSync } from "node:fs";
const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const read = (f) => readFileSync(join(ROOT, "src", f), "utf8");
let pass = 0, fail = 0;
const t = (n, ok) => { ok ? pass++ : fail++; console.log("  " + (ok ? "✓" : "✗") + "  " + n); };

// previewFor, run on its own with the fetch handed in.
const links = read("server/posts/links.js");
const body = links.slice(links.indexOf("const unescapeHtml"), links.indexOf("/* Previews happen after"));
let page = "";
const { previewFor } = new Function("safeGet", body + "\nreturn { previewFor };")(async (url) => ({ url, type: "text/html", body: page }));
const look = async (html) => { page = html; const at = Date.now(); const p = await previewFor("https://example.com/a"); return { p, ms: Date.now() - at }; };

console.log("\n1 · AN ORDINARY PAGE STILL GETS ITS CARD");
let { p } = await look(`<html><head><title>Plain &amp; simple</title>
<meta property="og:title" content="A piece"><meta content="Words about it" property="og:description">
<meta name='twitter:image' content='/pic.jpg'><meta property="og:site_name" content="Example"></head>`);
t("title, either order of the tag's parts, either kind of quote", p.title === "A piece" && p.description === "Words about it" && p.site === "Example");
t("the picture, made a full https address", p.image === "https://example.com/pic.jpg");
({ p } = await look(`<HEAD><TITLE lang="en">Only a title &amp; more</TITLE><META NAME="description" CONTENT="Told plainly"></HEAD>`));
t("no og tags → the page's own title and description, capitals or not", p.title === "Only a title & more" && p.description === "Told plainly");
({ p } = await look(`<meta property="og:title" content="First"><meta property="og:title" content="Second"><meta property="og:image" content="http://x.test/a.jpg">`));
t("the first of a repeated tag wins; a picture that isn't https is left out", p.title === "First" && p.image === null);
({ p } = await look("not a page at all"));
t("nothing to read → an empty card, no error", p.title === "" && p.image === null);

console.log("\n2 · A PAGE BUILT TO BE SLOW ISN'T");
const cap = (s) => s.slice(0, 120000);   // what safeGet lets through
const traps = {
  "one endless tag of content=": "<meta " + "content='a' ".repeat(10000),
  "thousands of half-right tags": "<meta content='a' ".repeat(6700),
  "thousands of names, no content": "<meta " + "name='og:image' ".repeat(7500),
  "thousands of unclosed titles": "<title ".repeat(17000),
  "one endless run of spaces": "<meta property" + " ".repeat(119000) + "=",
};
for (const [name, html] of Object.entries(traps)) {
  const { ms } = await look(cap(html));
  t(`${name}: ${ms}ms`, ms < 400);
}
t("no pattern is built per tag name or run across the whole page", !/new RegExp\(/.test(body) && !/\/<title\[\^>\]\*>/.test(body) && /function metaTags\(html\)/.test(body));

console.log("\n3 · THE WAIT DOESN'T SAY WHO HAS AN ACCOUNT");
const feed = read("server/auth/auth-feed.js"), forgot = read("server/uploads/upload-dm-notifications.js");
t("signing in as nobody still checks a password", /if \(!candidates\.length\) await bcrypt\.compare\(password, NOBODY_HASH\);/.test(feed)
  && /const NOBODY_HASH = bcrypt\.hashSync\(randomBytes\(24\)/.test(feed));
const fg = forgot.slice(forgot.indexOf(`app.post("/api/auth/forgot"`), forgot.indexOf(`app.get("/reset"`));
t("on the live site, forgot password answers before the email is sent", fg.indexOf("if (ON_RAILWAY) { res.json({ ok: true });") > 0
  && fg.indexOf("if (ON_RAILWAY) { res.json({ ok: true });") < fg.indexOf("await sendResetEmail("));
t("…and a failed send can't crash anything", /sendResetEmail\(user\.email, user\.display_name, url\)\.catch\(/.test(fg));

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
