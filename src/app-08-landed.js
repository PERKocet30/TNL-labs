/* first link + Join's time, sent with Join, admins only (server-01-signals) */
(function(){try{if(!localStorage.getItem("tnl-landed"))localStorage.setItem("tnl-landed",JSON.stringify({l:(location.pathname+location.search).slice(0,300),r:(document.referrer||"").slice(0,300),t:Date.now()}))}catch(e){}})();
function landedSrc(G){let s={};try{s=JSON.parse(localStorage.getItem("tnl-landed")||"{}")||{}}catch(e){}
  return {landing:s.l||"",referrer:s.r||"",firstSeen:s.t||0,joinSecs:G&&G.t0?Math.round((Date.now()-G.t0)/1000):null}}
