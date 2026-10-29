// UPDATING v1.0 — 2026-10-28 ("why is the app so slow"): each release leaves
// the app unanswerable for ~20s (the volume can't be on two copies at once)
// and Railway holds requests 15s, then 502. req() now rides it out quietly.
// Also ADMIN CHARTS v2 — 2026-10-28 ("it continues from October back to oct 2"):
// the last date hung off the chart and the text was ~6px on a phone.
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { readFileSync } from "node:fs";
const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const read = (f) => readFileSync(join(ROOT, f), "utf8");
let pass = 0, fail = 0;
const t = (n, ok) => { ok ? pass++ : fail++; console.log("  " + (ok ? "✓" : "✗") + "  " + n); };

/* the part, run against a pretend network */
function load(script) {
  const body = { kids: [], appendChild(e) { this.kids.push(e); e.remove = () => { this.kids = this.kids.filter((k) => k !== e); }; } };
  const doc = { body, createElement: () => ({ setAttribute() {} }) };
  const calls = [], seen = { banner: 0 };
  const fakeFetch = async (url, init) => {
    calls.push(init.method || "GET");
    if (body.kids.length) seen.banner++;
    const step = script.shift();
    if (step === "lost") throw new TypeError("Load failed");
    return { status: step, ok: step < 400 };
  };
  const quick = (f) => { Promise.resolve().then(f); return 1; };
  const R = new Function("fetch", "document", "setTimeout", "clearTimeout", "navigator", "AbortController",
    read("src/app-07-updating.js") + "\nreturn { reqFetch };")(fakeFetch, doc, quick, () => {}, { onLine: true }, class { constructor() { this.signal = {}; } abort() {} });
  return { R, calls, body, seen };
}

console.log("\nA RELEASE IS RIDDEN OUT, NOT SHOWN AS AN ERROR");
let x = load([502, 502, 200]);
let r = await x.R.reqFetch("/api/feed/showroom", { method: "GET" });
t("a read during a release tries again until the app is back", r.status === 200 && x.calls.length === 3);
t("…showing 'LABS is updating' while it waits", x.seen.banner === 2);
t("…and the pill goes when it's back", x.body.kids.length === 0);
x = load(["lost", 200]);
r = await x.R.reqFetch("/api/me", {});
t("no answer at all on a read: try again too", r.status === 200 && x.calls.length === 2);
x = load([502, 201]);
r = await x.R.reqFetch("/api/posts", { method: "POST" });
t("a change Railway couldn't deliver (502) is sent again", r.status === 201 && x.calls.length === 2);
x = load(["lost", 201]);
let threw = false; try { await x.R.reqFetch("/api/posts", { method: "POST" }); } catch (e) { threw = true; }
t("a change with no answer is NOT sent twice (it may have landed)", threw && x.calls.length === 1);
x = load([404]);
r = await x.R.reqFetch("/api/users/nobody", {});
t("ordinary answers pass straight through (404)", r.status === 404 && x.calls.length === 1 && x.seen.banner === 0);
x = load([500]);
r = await x.R.reqFetch("/api/x", {});
t("…a real server error isn't retried (500)", r.status === 500 && x.calls.length === 1);
const api = read("src/app-07-theme-labs-api.js");
t("every app request goes through it", /const r=await reqFetch\(API\+path,/.test(api) && !/await fetch\(API\+path/.test(api));
const css = read("src/app-05-styles-updating.css");
t("the pill uses the palette, no typed colours", /var\(--tx\)/.test(css) && !/#[0-9a-f]{3,8}\b/i.test(css));

console.log("\nADMIN CHARTS READ LIKE A REAL DASHBOARD");
const core = read("public/admin-app/1-core.js");
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const num = (n) => Math.round(n).toLocaleString();
const chart = core.slice(core.indexOf("const niceMax"), core.indexOf("/* horizontal bars with a label"));
const C = new Function("esc", "num", chart + "\nreturn { lineHTML, niceMax, dayText };")(esc, num);
const days = Array.from({ length: 30 }, (_, i) => new Date(Date.UTC(2026, 8, 29 + i, 12)).toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" }));
const vals = days.map((_, i) => (i === 28 ? 87 : i === 29 ? 40 : i % 3));
const h = C.lineHTML(vals, vals.map(() => 0), { labels: days, h: 190 });
const xs = [...h.matchAll(/<div class="lxx">([\s\S]*?)<\/div>/g)][0][1];
const xl = [...xs.matchAll(/<span class="([^"]*)" style="left:([\d.]+)%">([^<]*)<\/span>/g)].map((m) => ({ cls: m[1], left: +m[2], text: m[3] }));
t("the last date is the whole date (Oct 28), not cut to 'Oct 2'", xl.at(-1).text === "Oct 28");
t("…and sits inside the frame (right-aligned at the edge)", xl.at(-1).cls === "a1" && xl.at(-1).left <= 100 && xl[0].cls === "a0" && xl[0].text === "Sep 29");
t("five evenly spaced dates, none side by side", xl.length === 5 && xl.slice(1).every((d, i) => d.left - xl[i].left > 20));
t("dates and numbers are real text, not squeezed into the drawing", !/<text/.test(h) && /class="lyx"/.test(h));
t("the scale is a round number: 87 → 100", C.niceMax(87) === 100 && C.niceMax(40) === 50 && C.niceMax(3) === 5 && C.niceMax(1200) === 2000);
const ys = [...h.matchAll(/<div class="lyx"[^>]*>([\s\S]*?)<\/div>/g)][0][1];
t("…marked 0 · 50 · 100", /<span[^>]*>0<\/span>/.test(ys) && />50</.test(ys) && />100</.test(ys));
const short = C.lineHTML([3, 5, 2, 8, 4, 9, 12], null, { labels: ["10-22", "10-23", "10-24", "10-25", "10-26", "10-27", "10-28"], h: 160 });
const sl = [...short.matchAll(/style="left:[\d.]+%">([^<]*)</g)].map((m) => m[1]);
t("a week: four dates, no collision, written as words (Oct 22, not 10-22)", sl.length === 4 && sl[0] === "Oct 22" && sl.at(-1) === "Oct 28");
t("the last point is a round dot, not stretched with the drawing", /<i class="ldot"/.test(h) && !/class="end"/.test(h));
const html = read("public/admin.html");
t("phones pick up the new chart (cache-busted)", /1-core\.js\?v=4\.5"/.test(html) && /ui\.css\?v=2\.([4-9]|\d{2})"/.test(html));

console.log(`\n  ${pass} passed, ${fail} failed`);
