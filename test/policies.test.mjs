// The public policy pages Stripe reviews before trusting the Market with
// cards (2026-10-07): they exist without signing in, link to each other,
// show a support inbox, read the fee from FEE_BY_LEVEL, and the app
// points buyers and new members at them.
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { rmSync, mkdirSync, readFileSync } from "node:fs";
const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const DATA = join(ROOT, "test/.tmp/policies");
rmSync(DATA, { recursive: true, force: true }); mkdirSync(DATA, { recursive: true });
const PORT = 8873, BASE = `http://localhost:${PORT}`;
let pass = 0, fail = 0;
const t = (n, ok) => { ok ? pass++ : fail++; console.log("  " + (ok ? "✓" : "✗") + "  " + n); };
const srv = spawn(process.execPath, ["--experimental-sqlite", "--no-warnings", "src/server.runtime.js"], {
  cwd: ROOT, env: { ...process.env, TNL_DATA: DATA, PORT: String(PORT), SUPPORT_EMAIL: "help@example.com", STRIPE_SECRET_KEY: "" }, stdio: "ignore" });
try {
  for (let i = 0; i < 100; i++) { try { if ((await fetch(BASE + "/api/health")).ok) break; } catch {} await new Promise((r) => setTimeout(r, 100)); }
  const get = async (p) => { const r = await fetch(BASE + p); return { status: r.status, html: await r.text() }; };
  const fees = /FEE_BY_LEVEL = \{([^}]+)\}/.exec(readFileSync(join(ROOT, "src/db.js"), "utf8"));
  const FEE_BY_LEVEL = fees && Object.fromEntries(fees[1].split(",").map((x) => x.split(":").map(Number)));

  console.log("\nPUBLIC POLICY PAGES");
  for (const [p, must] of [["/terms", "seller of the item"], ["/privacy", "never sell your data"], ["/policies", "14 days"], ["/contact", "within 2 business days"]]) {
    const r = await get(p);
    t(`${p} is public and says "${must}"`, r.status === 200 && r.html.includes(must));
    t(`${p} shows the support inbox and links every policy`, r.html.includes("help@example.com") && ["/terms", "/privacy", "/policies", "/contact", "/shop"].every((h) => r.html.includes(`href="${h}"`)));
  }
  const terms = (await get("/terms")).html;
  /* v1.1 (2026-10-29): the policies say what the app does now */
  const priv = (await get("/privacy")).html;
  for (const [what, page, txt] of [["signing in with Google, Apple or Facebook", priv, "sign in with Google, Apple or Facebook"], ["the phone's voting code", priv, "random code on your phone"],
    ["event and reminder emails, with unsubscribe", priv, "one-tap unsubscribe"], ["Anthropic as a processor", priv, "Anthropic"], ["Meta and Google shop feeds only by choice", priv, "chose to show there"],
    ["no AI training", terms, "No AI training"], ["featuring work, with credit and a way out", terms, "always with credit to you"], ["no throwaway emails", terms, "throwaway inboxes"],
    ["one vote per phone and the new-account wait", terms, "each phone votes once per piece per day"], ["the card fee by account type", terms, "Stripe's card processing fee"],
    ["no selling accounts", terms, "don't sell, buy or hand over accounts"], ["no bots or impersonation", terms, "no accounts run by bots or scripts"], ["no bought likes, follows or votes", terms, "buying or trading likes, follows, votes or rep"],
    ["asking us to look again", terms, "we'll look at it again"], ["deleting what came from signing in", priv, "came from signing in with Google, Apple or Facebook"]])
    t(`policies cover ${what}`, page.includes(txt));
  t("dated October 29, 2026", priv.includes("Last updated October 29, 2026"));
  if (FEE_BY_LEVEL) { const v = Object.values(FEE_BY_LEVEL); t("the fee range comes from FEE_BY_LEVEL", terms.includes(`${Math.min(...v)}–${Math.max(...v)}%`)); }
  t("shipping countries match checkout's", (await get("/policies")).html.includes("Canada, the UK"));
  const shop = await get("/shop");
  t("/shop opens the app for anyone", shop.status === 200 && shop.html.includes('path==="/shop"'));
  t("shared post 404s wear the footer too", (await get("/p/999999")).html.includes('class="foot"'));

  console.log("\nTHE APP POINTS AT THEM");
  const app = readFileSync(join(ROOT, "public/index.html"), "utf8");
  t("listings say who sells and link the policy", app.includes("Sold by @${esc(l.seller.username)}") && app.includes('href="/policies"'));
  t("sign-up agrees to the terms", app.includes("By creating an account you agree to the"));
  t("the Market's foot links all four", ['/policies', '/terms', '/privacy', '/contact'].every((h) => app.includes(`<a href="${h}" target="_blank"`)));
  t("settings menu reaches them", app.includes('"Terms, privacy & help"'));
  t("no 'Paid through TNL' box — the seller line says it quietly", !app.includes('class="dtrust"') && !app.includes("Paid through TNL") && app.includes("Checkout by Stripe"));
} finally { srv.kill(); }
console.log(`\n  ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
