/* ADMIN · MOTION v1.0 — 2026-11-05. "Including the admin dashboard": the design language's motion
   (ARRIVE · ANSWER · LAND, app/styles/motion.css) in /admin, and loading as a shimmer, never "Loading…".
   paint() rebuilds the page, so this looks at what changed between two paints (1-core.js calls
   admMvBefore() / admMvAfter()):
     ARRIVE  a new section, sub-tab or record: its parts rise one after another; when the shimmer gives
             way to the real numbers they arrive the same way; the phone's More sheet comes up from below
     ANSWER  a tap that turns something on (a tab, a switch, a range) pops it — looked for under the finger
             after the repaint
     LAND    a number that changed on the page you're on (a refresh, an approval) bumps
   The once-a-minute refresh of Home moves nothing but the numbers that changed. Transform and opacity only
   (admin-app/motion.css); with reduced motion, none of it. */
const AMV = { key: null, skel: false, more: false, cls: "", at: 0, nums: [] };
const AMV_MS = 650, AMV_NUM = ".kpi .v,.stats b,.card .v,.nv b,.bb b";
const admReduced = () => { try { return matchMedia("(prefers-reduced-motion: reduce)").matches; } catch (e) { return false; } };
/* the shimmer that stands in for a page (or, "rows", for a card) until its data comes */
function askel(kind) {
  const rows = `<div class="ask-p">${'<div class="ask-r"><i class="ask-av"></i><span><i class="ask-b" style="width:58%"></i><i class="ask-b" style="width:34%"></i></span></div>'.repeat(4)}</div>`;
  return `<div class="ask" aria-busy="true" aria-label="Loading">${kind === "rows" ? "" : '<div class="ask-k"><i></i><i></i><i></i></div>'}${rows}</div>`;
}
const admNumKey = (n, i) => i + "|" + ((n.closest(".kpi,.card,.stats div,.nv,.bb") || n).querySelector(".k,span") || {}).textContent;
function admMvBefore() {
  const app = $("#app");
  return { key: AMV.key, skel: AMV.skel, more: AMV.more,
    nums: app ? [...app.querySelectorAll(AMV_NUM)].map((n, i) => [admNumKey(n, i), n.textContent]) : [] };
}
function admMvAfter(b) {
  const m = $("#main"); if (!m) return;
  const key = TAB + "|" + SUBTAB + "|" + ((m.querySelector("h1") || {}).textContent || ""), sk = !!m.querySelector(".ask");
  if (!admReduced()) {
    const add = (el, cls, at) => { const t = Date.now() - at; if (!el || t >= AMV_MS) return; el.classList.add(cls); if (t > 0) el.style.setProperty("--mvd", (-t) + "ms"); };
    if (key !== b.key) { AMV.cls = "mv-in"; AMV.at = Date.now(); add(m, AMV.cls, AMV.at); }
    else if (b.skel && !sk) { AMV.cls = "mv-land"; AMV.at = Date.now(); add(m, AMV.cls, AMV.at); }
    else if (AMV.cls) add(m, AMV.cls, AMV.at);   // a repaint mid-arrival carries it on instead of snapping
    if (MORE && !b.more) { const s = $(".msheet"); if (s) s.classList.add("mv-in"); }
    if (key === b.key) { const was = new Map(b.nums);
      [...$("#app").querySelectorAll(AMV_NUM)].forEach((n, i) => { const k = admNumKey(n, i); if (was.has(k) && was.get(k) !== n.textContent) admBump(n); }); }
  }
  AMV.key = key; AMV.skel = sk; AMV.more = MORE;
}
function admPop(el) { el.classList.remove("mv-pop"); void el.offsetWidth; el.classList.add("mv-pop"); el.addEventListener("animationend", () => el.classList.remove("mv-pop"), { once: true }); }
function admBump(el) { el.classList.remove("mv-bump"); void el.offsetWidth; el.classList.add("mv-bump"); el.addEventListener("animationend", () => el.classList.remove("mv-bump"), { once: true }); }
/* ANSWER: after the repaint, whatever is under the finger and now on pops */
document.addEventListener("click", (e) => {
  if (admReduced() || !e.isTrusted) return;
  const sel = "button,[role=button],[role=tab],.chip,.sw";
  if (!(e.target && e.target.closest && e.target.closest(sel))) return;
  const x = e.clientX, y = e.clientY;
  setTimeout(() => { const el = document.elementFromPoint(x, y), c = el && el.closest ? el.closest(sel) : null;
    if (c && !c.classList.contains("mv-pop") && (c.classList.contains("on") || c.getAttribute("aria-selected") === "true" || c.getAttribute("aria-pressed") === "true" || c.getAttribute("aria-current") === "page")) admPop(c); }, 40);
}, true);
