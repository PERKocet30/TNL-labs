/* ── STILL HERE · v1.0 · 2026-11-04 ── While the app is open and on screen, it tells the
   server "still here" every 30 seconds (POST /api/here, server/trust/visits). The server
   adds up the time; nothing else is sent. Hidden tab, closed app, signed out = no pings. */
setInterval(()=>{if(TOKEN&&document.visibilityState==="visible")req("/api/here",{method:"POST"}).catch(()=>{})},30000);
document.addEventListener("visibilitychange",()=>{if(TOKEN&&document.visibilityState==="visible")req("/api/here",{method:"POST"}).catch(()=>{})});
