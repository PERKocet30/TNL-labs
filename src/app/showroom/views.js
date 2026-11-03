/* VIEWS v1.0 — 2026-11-03. "Seen it" is a signal now (server/posts/rank.js v3.0).
   A Showroom card that's most of the way on screen for a moment, or a post
   opened, is a view: queued, sent in a batch (POST /api/views) every few
   seconds and when the page goes away. Nothing is shown; nothing waits on it.
   One mark per piece per session here, one per person per day on the server. */
function viewMark(id){
  id=Number(id);if(!id||VSEEN.has(id))return;
  VSEEN.add(id);VQUEUE.push(id);
  if(VQUEUE.length>=20)viewFlush();
  else if(!VTIMER)VTIMER=setTimeout(viewFlush,4000);
}
function viewFlush(){
  if(VTIMER){clearTimeout(VTIMER);VTIMER=null}
  if(!VQUEUE.length)return;
  const ids=VQUEUE.splice(0,40);
  req("/api/views",{method:"POST",body:{ids}}).catch(()=>{});
  if(VQUEUE.length)VTIMER=setTimeout(viewFlush,1000);
}
/* the page is going away: send what's left without waiting */
function viewFlushNow(){
  if(VTIMER){clearTimeout(VTIMER);VTIMER=null}
  if(!VQUEUE.length)return;
  const ids=VQUEUE.splice(0,40),h={"Content-Type":"application/json"};
  if(TOKEN)h.Authorization="Bearer "+TOKEN;const dv=devId();if(dv)h["X-Device"]=dv;
  try{fetch(API+"/api/views",{method:"POST",headers:h,body:JSON.stringify({ids}),keepalive:true}).catch(()=>{})}catch(e){}
}
/* watch the Showroom's cards: half on screen for 1.5s counts */
function viewObserver(){
  if(VWOBS!==null)return VWOBS;
  if(!("IntersectionObserver" in window))return (VWOBS=false);
  const timers=new Map();
  VWOBS=new IntersectionObserver(es=>{
    for(const e of es){
      const id=e.target.dataset.pid;
      if(e.isIntersecting&&e.intersectionRatio>=0.5){if(!timers.has(id))timers.set(id,setTimeout(()=>{timers.delete(id);viewMark(id);VWOBS.unobserve(e.target)},1500))}
      else if(timers.has(id)){clearTimeout(timers.get(id));timers.delete(id)}
    }
  },{threshold:[0.5]});
  addEventListener("pagehide",viewFlushNow);
  addEventListener("visibilitychange",()=>{if(document.visibilityState==="hidden")viewFlushNow()});
  return VWOBS;
}
function wireViews(){
  const ob=viewObserver();if(!ob)return;
  document.querySelectorAll(".sr-card[data-pid]").forEach(c=>{if(!c.dataset.vw){c.dataset.vw="1";if(!VSEEN.has(Number(c.dataset.pid)))ob.observe(c)}});
  if(POSTOPEN&&POSTOPEN.id)viewMark(POSTOPEN.id);
}
