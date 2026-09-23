/* door.js — the vial.
 *
 * Upgrades the ENTER THE LAB door with a lab vial that fills as the app
 * settles. Runs as a separate file so index.html needs one line, not a
 * rewrite.
 *
 * It does NOT own the door. enterHTML() still builds it and wireEnter()
 * still wires it. This finds #enterOv after it lands and decorates it.
 *
 * THE TAP IS NEVER BLOCKED. 073 made this door the audio unlock — the
 * click on #enterBtn is the gesture that lets the browser start sound.
 * So the button is never disabled and never removed. The vial fades it
 * in, but a tap at t=0 works exactly as it did before. Every failure
 * path here leaves a plain working door behind.
 */
(function () {
  "use strict";

  var FILL_MS = 2100;     // first visit: the full pour
  var QUICK_MS = 420;     // repeat visit: snap it
  var W = 744, H = 160, SKEW = 96;
  var STEPS = ["Initializing", "Loading the labs", "Reading the network", "Ready"];
  var done = false;

  var CSS = [
    ".enter-vial{width:min(78vw,340px);margin:2px 0 -4px;display:block}",
    ".enter-cap{font:10.5px/1 'IBM Plex Mono',ui-monospace,monospace;",
    "letter-spacing:.22em;text-transform:uppercase;color:rgba(255,255,255,.5);",
    "min-height:12px;transition:opacity .3s ease}",
    /* The button starts faded, not disabled — see the header note. */
    ".enter-c.vialed .enter-b{opacity:0;transform:translateY(6px);",
    "transition:opacity .45s ease,transform .45s ease}",
    ".enter-c.vialed.ready .enter-b{opacity:1;transform:none}",
    "@media (prefers-reduced-motion:reduce){",
    ".enter-c.vialed .enter-b{opacity:1;transform:none;transition:none}}"
  ].join("");

  function styles() {
    if (document.getElementById("doorVialCSS")) return;
    var s = document.createElement("style");
    s.id = "doorVialCSS";
    s.textContent = CSS;
    (document.head || document.documentElement).appendChild(s);
  }

  function svg() {
    return '<svg class="enter-vial" id="enterVial" viewBox="0 0 744 160" ' +
      'aria-hidden="true" focusable="false">' +
      '<defs>' +
        '<clipPath id="vialClip"><rect x="6" y="6" width="732" height="148" rx="74"/></clipPath>' +
        '<linearGradient id="vialSheen" x1="0" y1="0" x2="0" y2="1">' +
          '<stop offset="0" stop-color="#fff" stop-opacity=".30"/>' +
          '<stop offset=".22" stop-color="#fff" stop-opacity=".05"/>' +
          '<stop offset=".78" stop-color="#000" stop-opacity=".12"/>' +
          '<stop offset="1" stop-color="#fff" stop-opacity=".16"/>' +
        '</linearGradient>' +
      '</defs>' +
      '<g clip-path="url(#vialClip)">' +
        '<rect x="6" y="6" width="732" height="148" fill="#242422"/>' +
        '<rect id="vialBody" x="0" y="0" width="0" height="160" fill="#489D35"/>' +
        '<polygon id="vialEdge" points="0,0 0,0 0,0" fill="#489D35"/>' +
        '<rect x="6" y="6" width="732" height="148" fill="url(#vialSheen)"/>' +
      '</g>' +
      '<rect x="6" y="6" width="732" height="148" rx="74" fill="none" stroke="#6a6a64" stroke-width="5"/>' +
      '<rect x="18" y="18" width="708" height="124" rx="62" fill="none" stroke="#fff" stroke-opacity=".12" stroke-width="2"/>' +
    '</svg>';
  }

  function upgrade(ov) {
    if (done) return;
    var c = ov.querySelector("#enterC");
    var btn = ov.querySelector("#enterBtn");
    if (!c || !btn || c.classList.contains("vialed")) return;
    done = true;

    styles();

    var wrap = document.createElement("div");
    wrap.style.cssText = "display:flex;flex-direction:column;align-items:center;gap:14px;width:100%";
    wrap.innerHTML = svg() + '<div class="enter-cap" id="enterCap">' + STEPS[0] + "</div>";
    c.insertBefore(wrap, btn);
    c.classList.add("vialed");

    var body = wrap.querySelector("#vialBody");
    var edge = wrap.querySelector("#vialEdge");
    var cap = wrap.querySelector("#enterCap");

    function reveal() {
      c.classList.add("ready");
      if (cap) cap.style.opacity = "0";
    }
    /* Last resort. If rAF never fires — backgrounded tab, throttled
       timer, anything — the button still turns up. */
    setTimeout(reveal, FILL_MS + 900);

    function draw(p) {
      var x = -SKEW + p * (W + SKEW * 2);
      body.setAttribute("width", Math.max(0, x));
      edge.setAttribute("points",
        x + ",0 " + (x + SKEW) + ",0 " + x + "," + H + " " + (x - 2) + "," + H);
    }

    var seen = false;
    try { seen = !!localStorage.getItem("tnl-intro-seen"); } catch (e) {}
    var reduced = false;
    try {
      reduced = window.matchMedia("(prefers-reduced-motion:reduce)").matches;
    } catch (e) {}

    var dur = (seen || reduced) ? QUICK_MS : FILL_MS;
    var t0 = null;

    function frame(ts) {
      if (t0 === null) t0 = ts;
      var t = Math.min(1, (ts - t0) / dur);
      var p = 1 - Math.pow(1 - t, 2.4);
      draw(p);
      if (cap && !seen) {
        var s = STEPS[Math.min(STEPS.length - 1, Math.floor(p * STEPS.length))];
        if (cap.textContent !== s) cap.textContent = s;
      }
      if (t < 1) requestAnimationFrame(frame);
      else reveal();
    }

    draw(0);
    if (seen && cap) cap.textContent = "";
    requestAnimationFrame(frame);
  }

  function look() {
    var ov = document.getElementById("enterOv");
    if (ov) upgrade(ov);
    return !!ov;
  }

  /* The door may already be on screen by the time this file runs, or it
     may arrive a tick later from render(). Cover both, then stop looking. */
  try {
    if (!look() && typeof MutationObserver === "function") {
      var mo = new MutationObserver(function () {
        if (look()) mo.disconnect();
      });
      mo.observe(document.documentElement, { childList: true, subtree: true });
      setTimeout(function () { try { mo.disconnect(); } catch (e) {} }, 15000);
    }
  } catch (e) {
    /* A broken vial must never cost the door. Swallow and leave it plain. */
  }
})();
