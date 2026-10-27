/* door.js -- the vial.
 *
 * Upgrades the ENTER THE LAB door with a lab vial that fills as the app
 * settles. Runs as a separate file so index.html needs one line, not a
 * rewrite.
 *
 * It does NOT own the door. enterHTML() still builds it and wireEnter()
 * still wires it. This finds #enterOv after it lands and decorates it.
 *
 * THE TAP IS NEVER BLOCKED. 073 made this door the audio unlock -- the
 * click on #enterBtn is the gesture that lets the browser start sound.
 * So the button is never disabled and never removed. The vial fades it
 * in, but a tap at t=0 works exactly as it did before. Every failure
 * path here leaves a plain working door behind.
 *
 * THE MARK. enterHTML() copies the logo from the header's .mark, but the
 * header hasn't rendered on first load, so the door usually arrived with
 * no logo at all. This carries its own white mark (the labs' //, the
 * LABS logo since 2026-10-27) and puts it on top of the door every time.
 */
(function () {
  "use strict";

  var FILL_MS = 2100;     // first visit: the full pour
  var QUICK_MS = 420;     // repeat visit: snap it
  var STEPS = ["Initializing", "Loading the labs", "Reading the network", "Ready"];
  var done = false;
  var MARK = "data:image/svg+xml,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20viewBox%3D%220%200%2096%2096%22%3E%3Cpath%20d%3D%22M39.5%2014h10.8L37.4%2082H26.6zM58.6%2014h10.8L56.5%2082H45.7z%22%20fill%3D%22white%22%2F%3E%3C%2Fsvg%3E";

  var CSS = [
    ".enter-vial{width:min(56vw,220px);height:4px;border-radius:999px;background:#E6E6E6;overflow:hidden;margin:4px 0 0;display:block}",
    ".enter-vial i{display:block;width:100%;height:100%;background:#98FC68;border-radius:inherit;transform-origin:0 50%;transform:scaleX(0)}",
    ".enter-cap{font:12px/1 'Helvetica Neue',Helvetica,Archivo,Arial,sans-serif;",
    "letter-spacing:.02em;color:#5C5C5C;",
    "min-height:12px;transition:opacity .3s ease}",
    /* The button starts faded, not disabled -- see the header note. */
    ".enter-c.vialed .enter-b{opacity:0;transform:translateY(6px);",
    "transition:opacity .45s ease,transform .45s ease}",
    ".enter-c.vialed.ready .enter-b{opacity:1;transform:none}",
    ".enter-c.vialed .enter-m{height:auto;width:min(32vw,128px);display:block;"
    + "margin:0 auto 6px;filter:invert(1)}",
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

  /* The bar. Paper-flat: a 4px track in the palette's line grey (#E6E6E6)
     that fills in reagent green (#98FC68, the one accent). No glass, no
     sheen, no slant. */
  function svg() {
    return '<div class="enter-vial" id="enterVial" aria-hidden="true"><i id="vialBody"></i></div>';
  }

  function upgrade(ov) {
    if (done) return;
    var c = ov.querySelector("#enterC");
    var btn = ov.querySelector("#enterBtn");
    if (!c || !btn || c.classList.contains("vialed")) return;
    done = true;

    styles();

    var m = c.querySelector(".enter-m");
    if (!m) {
      m = document.createElement("img");
      m.className = "enter-m";
      m.alt = "LABS";
      c.insertBefore(m, c.firstChild);
    }
    m.src = MARK;

    var wrap = document.createElement("div");
    wrap.style.cssText = "display:flex;flex-direction:column;align-items:center;gap:12px;width:100%";
    wrap.innerHTML = svg() + '<div class="enter-cap" id="enterCap">' + STEPS[0] + "</div>";
    c.insertBefore(wrap, btn);
    c.classList.add("vialed");

    var body = wrap.querySelector("#vialBody");
    var cap = wrap.querySelector("#enterCap");

    function reveal() {
      c.classList.add("ready");
      if (cap) cap.style.opacity = "0";
    }
    /* Last resort. If rAF never fires -- backgrounded tab, throttled
       timer, anything -- the button still turns up. */
    setTimeout(reveal, FILL_MS + 900);

    function draw(p) {
      if (body) body.style.transform = "scaleX(" + Math.max(0, Math.min(1, p)) + ")";
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
