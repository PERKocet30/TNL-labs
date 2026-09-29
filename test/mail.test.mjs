// Mail v1.0 (2026-09-29): every email the app sends is in the design language.
// Renders the real templates from src/mail.js — nothing is sent.
import { verifyEmail, resetEmail, renderEmail } from "../src/mail.js";
let pass = 0, fail = 0;
const t = (n, ok) => { ok ? pass++ : fail++; console.log("  " + (ok ? "✓" : "✗") + "  " + n); };

const url = "https://labs.tnllabs.com/api/auth/verify?token=abc123&x=1";
const v = verifyEmail("Ana Reyes", url), r = resetEmail("Ana Reyes", "https://labs.tnllabs.com/reset?token=def456");

console.log("\nTHE DESIGN LANGUAGE");
for (const [n, e] of [["verify", v], ["reset", r]]) {
  const h = e.html;
  t(`${n}: Paper by default (#F7F1F1, ink #000)`, /<body[^>]*background:#F7F1F1/.test(h) && /color:#000000/.test(h));
  t(`${n}: dark mode for mail apps that support it`, /prefers-color-scheme: dark/.test(h) && /\.bg \{ background:#000000/.test(h));
  t(`${n}: Helvetica Neue, never monospace`, /'Helvetica Neue',Helvetica,Archivo/.test(h) && !/monospace/.test(h));
  t(`${n}: the action is an inverted pill`, /class="btn"[^>]*border-radius:999px[^>]*background:#000000;color:#F7F1F1/.test(h));
  t(`${n}: the card is square`, /class="card" style="[^"]*"/.test(h) && !/class="card" style="[^"]*border-radius/.test(h));
  t(`${n}: // eyebrow, Reagent only on the mark`, /<span class="mk"[^>]*>\/\/<\/span>/.test(h) && (h.match(/#98FC68/g) || []).length === 1);
  t(`${n}: no emoji`, !/[\u{1F300}-\u{1FAFF}]|&#129514;/u.test(h));
  t(`${n}: style attributes aren't broken by quotes`, !/style="[^"]*font-family:"/.test(h));
  t(`${n}: a plain-text version with the link`, e.text.includes("https://labs.tnllabs.com/") && e.text.includes("LABS ®"));
}

console.log("\nSAFE");
const x = renderEmail({ eyebrow: "Test", title: "Hi", lines: ['<script>alert(1)</script>'], cta: "Go", url: 'https://x.test/?a="b"&c=1', note: "n" });
t("names and text are escaped", !/<script>/.test(x.html) && /&lt;script&gt;/.test(x.html));
t("the link is escaped inside href", /href="https:\/\/x\.test\/\?a=&quot;b&quot;&amp;c=1"/.test(x.html));
t("verify says 24 hours, reset says 1 hour", /24 hours/.test(v.html) && /1 hour/.test(r.html));
t("the logo comes from the link's own site", v.html.includes('src="https://labs.tnllabs.com/icon-512.png"'));

console.log(`\n  ${pass} passed, ${fail} failed`);
