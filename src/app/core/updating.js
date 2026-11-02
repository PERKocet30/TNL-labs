/* ── UPDATING · v1.0 · 2026-10-28 ────────────────────────────────────
   "Why is the app so slow." The server answers in milliseconds; what people
   feel is each release. The database lives on a Railway volume, and a volume
   can't be on two copies of the app at once, so for ~20s per release nothing
   answers: Railway holds every request 15s, then says 502. People saw a
   frozen screen, then an error.
   Now, through req() (app/core/theme-labs-api): a request that finds the app
   restarting (no answer, or 502/503/504 from Railway) shows a quiet
   "LABS is updating" pill and tries again — 1.5s, 3s, 4.5s, then every 5s,
   for up to a minute — and the screen carries on as if nothing happened.
   Reads (GET) also give up waiting after 8s and try again, instead of
   hanging for Railway's 15. A change (POST, PATCH…) is only retried on a
   502/503/504 — Railway couldn't reach the app, so it never arrived. One
   that got no answer at all may have landed, so it isn't sent twice. */
const UPD = { el: null, n: 0 };
function updShow(on) {
  if (on) {
    UPD.n++;
    if (UPD.el) return;
    UPD.el = document.createElement("div");
    UPD.el.className = "upd"; UPD.el.setAttribute("role", "status");
    UPD.el.textContent = "LABS is updating — one moment…";
    document.body.appendChild(UPD.el);
  } else if (UPD.n && --UPD.n === 0 && UPD.el) { UPD.el.remove(); UPD.el = null; }
}
const updWait = (ms) => new Promise((r) => setTimeout(r, ms));
async function reqFetch(url, init) {
  const get = (init.method || "GET") === "GET";
  let shown = false;
  try {
    for (let i = 0, t0 = Date.now(); ; i++) {
      let r = null, err = null;
      const ctl = get ? new AbortController() : null;
      const timer = ctl ? setTimeout(() => ctl.abort(), 8000) : 0;
      try { r = await fetch(url, ctl ? { ...init, signal: ctl.signal } : init); }
      catch (e) { err = e; }
      finally { clearTimeout(timer); }
      if (err && !get) throw err;   // may have arrived — never send a change twice
      const restarting = !!err || r.status === 502 || r.status === 503 || r.status === 504;
      if (!restarting) return r;
      if (Date.now() - t0 > 60000 || navigator.onLine === false) { if (err) throw err; return r; }
      if (!shown) { shown = true; updShow(true); }
      await updWait(Math.min(1500 * (i + 1), 5000));
    }
  } finally { if (shown) updShow(false); }
}
