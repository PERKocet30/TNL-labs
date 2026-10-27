// Mail v1.2 (2026-10-12; v1.1 2026-09-29): every email the app sends is in the design language.
// Renders the real templates from src/mail.js — nothing is sent.
import { verifyEmail, resetEmail, alertEmail, renderEmail, eventOpenEmail, nudgeEmail, nudgeSubject, NUDGE_ITEMS } from "../src/mail.js";
import { readFileSync, readdirSync } from "node:fs";
let pass = 0, fail = 0;
const t = (n, ok) => { ok ? pass++ : fail++; console.log("  " + (ok ? "✓" : "✗") + "  " + n); };

const url = "https://labs.tnllabs.com/api/auth/verify?token=abc123&x=1";
const v = verifyEmail("Ana Reyes", url), r = resetEmail("Ana Reyes", "https://labs.tnllabs.com/reset?token=def456");
const w = alertEmail("Yesterday on TNL LABS", ["0 new members · 7 posts.", "Errors: none."], "https://labs.tnllabs.com/admin#system");
const nu = nudgeEmail({ name: "Ana", items: ["photo", "music", "colour"], role: "Producer", done: 4, total: 7, url: "https://labs.tnllabs.com/?login=1&next=%2F%3Fstart%3Dphoto", unsub: "https://labs.tnllabs.com/mail/off?k=abc" });
const ev = eventOpenEmail({ name: "Ana", title: "The Art Tournament", brief: "Make something.", prize: "$500", closes: "November 30, 2026", url: "https://labs.tnllabs.com/?e=art", unsub: "https://labs.tnllabs.com/mail/off?k=abc" });

console.log("\nTHE DESIGN LANGUAGE");
for (const [n, e] of [["verify", v], ["reset", r], ["watch alert", w], ["tournament open (v2.1)", ev], ["weekly reminder (v2.2)", nu]]) {
  const h = e.html;
  t(`${n}: white by default (#FFFFFF, ink #000)`, /<body[^>]*background:#FFFFFF/.test(h) && /color:#000000/.test(h));
  t(`${n}: dark mode for mail apps that support it`, /prefers-color-scheme: dark/.test(h) && /\.bg \{ background:#000000/.test(h));
  t(`${n}: Helvetica Neue, never monospace`, /'Helvetica Neue',Helvetica,Archivo/.test(h) && !/monospace/.test(h));
  t(`${n}: the action is an inverted pill`, /class="btn"[^>]*border-radius:999px[^>]*background:#000000;color:#FFFFFF/.test(h));
  t(`${n}: the card is square`, /class="card" style="[^"]*"/.test(h) && !/class="card" style="[^"]*border-radius/.test(h));
  t(`${n}: // eyebrow, Reagent only on the mark`, /<span class="mk"[^>]*>\/\/<\/span>/.test(h) && (h.match(/#98FC68/g) || []).length === 1);
  t(`${n}: no emoji`, !/[\u{1F300}-\u{1FAFF}]|&#129514;/u.test(h));
  t(`${n}: style attributes aren't broken by quotes`, !/style="[^"]*font-family:"/.test(h));
  t(`${n}: a plain-text version with the link`, e.text.includes("https://labs.tnllabs.com/") && e.text.includes("LABS ®"));
}

t("tournament: an unsubscribe link, in the email and the text", ev.html.includes('href="https://labs.tnllabs.com/mail/off?k=abc"') && ev.text.includes("Unsubscribe from LABS emails: https://labs.tnllabs.com/mail/off?k=abc"));
console.log("\nTHE WEEKLY REMINDER");
t("the first gap is the headline, the button and the subject", nu.html.includes(">Add a profile photo</h1>") && nu.html.includes(">Add a photo</a>") && nudgeSubject("photo") === "Add a profile photo — LABS");
t("it says how far along the page is", nu.html.includes("Ana, your page is 4 of 7 done."));
t("the first gap's line is the one in the email", nu.text.includes("People follow faces.") && !nu.text.includes("Your page says Producer"));
t("the other gaps are one line", nu.text.includes("Also still open: upload your music, pick your colour."));
t("one a week at most, none once it's done — said in the email", nu.text.includes("One of these a week at most, and none once your page is done."));
t("the button opens that step, through log in", nu.html.includes('href="https://labs.tnllabs.com/?login=1&amp;next=%2F%3Fstart%3Dphoto"'));
t("music first for a producer: the role line", nudgeEmail({ name: "Ana", items: ["music"], role: "DJ", done: 6, total: 7, url: "https://x.test/", unsub: "https://x.test/u" }).text.includes("Your page says DJ, but there's no music on it yet. One track is enough to start."));
t("every gap has words", Object.values(NUDGE_ITEMS).every((i) => i.title && i.line && i.cta));
t("account emails have no unsubscribe (they always go)", !/Unsubscribe/.test(v.html + r.html));

console.log("\nSAFE");
const x = renderEmail({ eyebrow: "Test", title: "Hi", lines: ['<script>alert(1)</script>'], cta: "Go", url: 'https://x.test/?a="b"&c=1', note: "n" });
t("names and text are escaped", !/<script>/.test(x.html) && /&lt;script&gt;/.test(x.html));
t("the link is escaped inside href", /href="https:\/\/x\.test\/\?a=&quot;b&quot;&amp;c=1"/.test(x.html));
t("verify says 24 hours, reset says 1 hour", /24 hours/.test(v.html) && /1 hour/.test(r.html));
t("the logo comes from the link's own site", v.html.includes('src="https://labs.tnllabs.com/icon-white-512.png?v=2"'));

console.log("\nNO OLD STYLE LEFT ANYWHERE THE SERVER BUILDS HTML");
const src = (f) => readFileSync(new URL("../src/" + f, import.meta.url), "utf8");
const serverParts = readdirSync(new URL("../src/", import.meta.url)).filter((f) => /^server-\d.*\.js$/.test(f));
const old = serverParts.filter((f) => /font-family:monospace|TNLLABS &#129514;|border-radius:9px/.test(src(f)));
t("no monospace, emoji wordmark or old buttons in any server part" + (old.length ? " (" + old.join(", ") + ")" : ""), !old.length);
t("mail.js has none either", !/font-family:monospace|&#129514;|border-radius:9px|#0A0A0A/.test(src("mail.js")));
t("every alert goes through the shared layout", /send\(to, subject, alertEmail\(/.test(src("mail.js")));
const pages = serverParts.filter((f) => /<!doctype html>/i.test(src(f)) && f !== "server-01-look.js");
t("no server page builds its own <!doctype> — they all use lookPage()" + (pages.length ? " (" + pages.join(", ") + ")" : ""), !pages.length);
t("the app's crash screen follows the theme", !/color:#fff|monospace/.test(src("app-06-body.html").slice(0, 4000)));

console.log(`\n  ${pass} passed, ${fail} failed`);
