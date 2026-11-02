// MARKET SHARE v1.0 — 2026-10-20. "The market should have a description
// like labs do as well and a share button." One line under the Market's
// name says what it's for; Share sends that line and /shop, whose link
// preview (Instagram DMs, texts) carries the same words and opens the
// Market for anyone.
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { rmSync, mkdirSync, readFileSync } from "node:fs";
const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const DATA = join(ROOT, "test/.tmp/market-share");
rmSync(DATA, { recursive: true, force: true }); mkdirSync(DATA, { recursive: true });
let pass = 0, fail = 0;
const t = (n, ok) => { ok ? pass++ : fail++; console.log("  " + (ok ? "✓" : "✗") + "  " + n); };
const part = (f) => readFileSync(join(ROOT, "src", f), "utf8");
const pitch = (src) => (/const MARKET_PITCH\s*=\s*"([^"]+)"/.exec(src) || [])[1];

console.log("\nTHE LINE");
const appPitch = pitch(part("app/market/share.js")), srvPitch = pitch(part("server/pages/policies.js"));
t("the Market says what it's for", !!appPitch && appPitch.length < 140);
t("…in the same words the link preview uses", appPitch === srvPitch);
t("it sits under the Market's name", part("app/music/tracks.js").includes('title:"Market",sub:MARKET_PITCH'));

console.log("\nSHARE");
t("a Share button beside the bag", part("app/music/tracks.js").includes('id="mktshare" aria-label="Share the Market"') && part("app/market/market.js").includes("msh.onclick=shareMarket"));
// shareMarket, run against a pretend phone
const src = part("app/market/share.js");
const run = (nav, sink) => new Function("navigator", "location", "toast", "uiPrompt", src + "\nreturn shareMarket;")(nav, { origin: "https://tnllabs.com" }, sink.toast, sink.prompt);
let shared = null;
await run({ share: async (d) => { shared = d; } }, {})();
t("with a share sheet: the line and the /shop link", shared && shared.url === "https://tnllabs.com/shop" && shared.text.includes(appPitch) && shared.title === "LABS Market");
let copied = null, told = null;
await run({ clipboard: { writeText: async (s) => { copied = s; } } }, { toast: (m) => (told = m) })();
t("no share sheet (Instagram's browser): the caption and link are copied", copied && copied.includes(appPitch) && copied.endsWith("https://tnllabs.com/shop") && /Copied/.test(told));
let shown = null;
await run({ clipboard: { writeText: async () => { throw new Error("no"); } } }, { prompt: async (_m, o) => { shown = o.value; } })();
t("…and if copying is blocked, it's shown to copy by hand", shown && shown.includes("https://tnllabs.com/shop"));

console.log("\nTHE LINK");
const PORT = 8885, B = `http://localhost:${PORT}`;
const srv = spawn(process.execPath, ["--experimental-sqlite", "--no-warnings", "src/server.runtime.js"], {
  cwd: ROOT, env: { ...process.env, TNL_DATA: DATA, PORT: String(PORT), STRIPE_SECRET_KEY: "", PUBLIC_URL: "https://tnllabs.com", TNL_NO_VIDEO_FIX: "1", TNL_NO_WATCH: "1" }, stdio: "ignore" });
try {
  for (let i = 0; i < 100; i++) { try { if ((await fetch(B + "/api/health")).ok) break; } catch {} await new Promise((r) => setTimeout(r, 100)); }
  const r = await fetch(B + "/shop"), h = await r.text();
  const meta = (k) => (new RegExp(`(?:property|name)="${k}" content="([^"]*)"`).exec(h) || [])[1];
  t("/shop opens the app for anyone", r.status === 200 && h.includes('path==="/shop"'));
  t("its preview is the Market's: title, line and address", meta("og:title") === "LABS Market" && meta("og:description") === appPitch && meta("twitter:description") === appPitch && meta("og:url") === "https://tnllabs.com/shop" && /<title>LABS Market<\/title>/.test(h));
  const home = await (await fetch(B + "/")).text();
  t("the front door keeps its own preview", /og:title" content="LABS[^"]*Social media by creatives/.test(home) && !/og:title" content="LABS Market/.test(home));
} finally { srv.kill(); }
console.log(`\n  ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
