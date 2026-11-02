/* LABS · are you a person? v1.0 — 2026-10-30. Loaded only when someone taps Join with an email
   (gxHuman, app/gate/logic). Cloudflare Turnstile, invisible unless Cloudflare isn't sure — then a
   small check at the bottom of the screen. Resolves with the token, or "" if it can't run; the server
   (server/trust/turnstile) decides. Never holds Join for more than a minute. */
window.labsHuman = (sitekey) => new Promise((ok) => {
  let id = null, over = false;
  const box = document.createElement("div");
  box.setAttribute("aria-live", "polite");
  box.style.cssText = "position:fixed;left:50%;bottom:calc(16px + env(safe-area-inset-bottom,0px));transform:translateX(-50%);z-index:2147483000";
  const done = (t) => { if (over) return; over = true; try { if (id != null) window.turnstile.remove(id); } catch (e) {} box.remove(); ok(t || ""); };
  document.body.appendChild(box);
  setTimeout(() => done(""), 60000);
  const go = () => { try { id = window.turnstile.render(box, { sitekey, appearance: "interaction-only", callback: done, "error-callback": () => done(""), "expired-callback": () => done("") }); } catch (e) { done(""); } };
  if (window.turnstile) return go();
  const s = document.createElement("script");
  s.src = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit"; s.async = true; s.onload = go; s.onerror = () => done("");
  document.head.appendChild(s);
});
