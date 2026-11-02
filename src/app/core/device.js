/* ── THIS PHONE · 2026-10-27 ── A random mark for this device, made once and kept, sent with
   every request as X-Device. The tournament counts one vote per phone per piece per day
   (server/trust/honest, server/events/routes); nothing else reads it. */
function devId(){try{let d=localStorage.getItem("tnl-dev");if(!/^[a-f0-9]{16,32}$/.test(d||"")){d=Array.from(crypto.getRandomValues(new Uint8Array(12)),b=>b.toString(16).padStart(2,"0")).join("");localStorage.setItem("tnl-dev",d)}return d}catch(e){return ""}}
