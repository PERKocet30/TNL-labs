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
 * no logo at all. This carries its own white monogram (256px, from the
 * brand art) and puts it on top of the door every time.
 */
(function () {
  "use strict";

  var FILL_MS = 2100;     // first visit: the full pour
  var QUICK_MS = 420;     // repeat visit: snap it
  var W = 744, H = 160, SKEW = 96;
  var STEPS = ["Initializing", "Loading the labs", "Reading the network", "Ready"];
  var done = false;
  var MARK = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAQAAAAEABAMAAACuXLVVAAAAMFBMVEX///////////////////////////////////////////////////////////////9Or7hAAAAAEHRSTlMAESIzRFVmd4iZqrvM3e7/dpUBFQAADNFJREFUeNrtXXuMXFUZ/907M93dlshMWR+1rU6XtvYhzfQhFql1RdRCKd1CJLEVugGNgaItiERFaaUa8UUXIdQ/xLZowBjpLqWQGFhmtRjAhO5WLY+U7m6otECXmUmQ2k5n7vWPcx/nvs/rbmPS75/ZnbnnnN985/t+5zvf3Psd4KyclTMsmnDDwuJCoaPDBMzh4erhwfEFoC350qKOGdQbRn/lqf7R8dLarBv3m0ExxrZfPS5zduGfqmaEGH+/IZ/2+LMfNGPl1etThZD5ftVMEOP5z6Y3/opBk0EaP0pJCZlfmIzySimV2S+bzNK4Xv34S0dMDjHuV+1860xOeTKvkgm1DfeFvV2tmhqAQiHsw5cvH1UGQL/jrsB77zw9eHi4WtUArdBxfselCwNXvHKZKm7WfuDX72vbL/FpWJv53f6AMxQVjf8Nn4G9cENoz/oXfuOjqZfVEMJXvL2+EONis30QXlKB4GJPl8e/lY9fqp7xXL5Xfvy5Hu0/mTit+k0eJfxKdvwJNP+M3cpEmbQSjE2S/F8WoPjML2lW7pQCcKcAtwHaOmoaTubVGCAfu19EIXhWwgDcboz7ONcuCoGwGei97vh38Tae4yI4LRoeXOuOL+BNFIKDYuO3ukr8nUj7eW77e4WWgF5ZM1rpToLIsrRMntHdOfwXf+OcM4WnhB1Zu8cxoi7uxhtVUJlLpCd5m7Y52vuhDJO2ON3sErXAZyElVzh2yDeRU+UNwPomO+ye/srVbFDcePzGbK/nDR5X/LgN+3H5iGa+3dc/ORaBEUUTAADaNquzZpG5twuk1zHPmsqtAkcB/1YT16+yVVDitICGol22XuZTgeMCj6na2n7YsQKmyydZl9fVJTpsWvsL19U71e3uW3no0KbvUyrzC7Yr9nAsg1tUArC/1X+TL82yX8ojm61uuxOvXJCGAlwV/CfRB8spWAClgkRPbFPvAt6O+9iAKuQAn3cnxGbZqmISDPJbfIg5zZop9QpwGP4fvq/s/XcreTla87f+Gtdgf6wF3zOv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";

  var CSS = [
    ".enter-vial{width:min(78vw,340px);margin:2px 0 -4px;display:block}",
    ".enter-cap{font:12px/1 'Helvetica Neue',Helvetica,Archivo,Arial,sans-serif;",
    "letter-spacing:0;color:#9A9392;",
    "min-height:12px;transition:opacity .3s ease}",
    /* The button starts faded, not disabled -- see the header note. */
    ".enter-c.vialed .enter-b{opacity:0;transform:translateY(6px);",
    "transition:opacity .45s ease,transform .45s ease}",
    ".enter-c.vialed.ready .enter-b{opacity:1;transform:none}",
    ".enter-c.vialed .enter-m{height:auto;width:min(32vw,128px);display:block;"
    + "margin:0 auto 6px;filter:none}",
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

    var m = c.querySelector(".enter-m");
    if (!m) {
      m = document.createElement("img");
      m.className = "enter-m";
      m.alt = "TNL";
      c.insertBefore(m, c.firstChild);
    }
    m.src = MARK;

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
    /* Last resort. If rAF never fires -- backgrounded tab, throttled
       timer, anything -- the button still turns up. */
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
