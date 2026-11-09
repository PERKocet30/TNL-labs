/* UI SIGNALS v1.1 — 2026-11-09 ("get rid of any data that isn't useful and
   track what is"): the load timer is gone (it read 0ms — a slow screen is
   the glitch watcher's to tell), and a post that Share sent on its way is a
   post finished: the creator closes before the post goes (compose/queue), so
   every one used to count as abandoned.
   v1.0 — 2026-11-04. "Think of all data that can help improve the
   user interface. Make sure Echo can access all of this."
   Quietly, from members' own phones, how the app is used — as counts the
   admin and Echo read (server/ui-signals): which screens open and in what
   order, where the app gets closed, backs, tabs, taps that did nothing, the
   same change sent twice, things started and not finished, empty screens,
   searches that found nothing, pictures that didn't
   load, uploads that failed, the first use of a feature, and once a session
   what the app is being looked at on. Never a word anyone typed, never a
   title, a price or a message — a search miss keeps three counted words.
   render() and paintLayer() call uiTick() last; back.js calls uiBack().
   Batched (POST /api/ui) every 10s and when the page goes away; nothing
   waits on it and nothing on screen changes. */
const UI={screen:"",at:0,q:[],timer:null,renders:0,fetches:0,flow:null,flowDone:false,empty:null,postWait:0,exited:false,misses:{},sent:{}};
const UI_FLOWS={"compose":"post","market:sell":"sell","event:enter":"enter"};
const UI_CONTROLS="button,a,input,select,textarea,label,summary,video,audio,[role=button],[contenteditable],[tabindex]";
/* a plain name for what's on screen — no ids, no names, no titles */
function uiScreen(){
  if(GATE)return "sign-up";
  if(ECHOOPEN)return "echo";
  if(CHAT)return "chat";
  if(DMOPENPANEL)return "messages";
  if(PCOMPOSE)return "compose";
  if(TRKEDIT)return "track edit";
  if(EDITING)return "edit profile";
  if(EVENTER)return "event:enter";
  if(NOWFULL)return "now playing";
  if(LIGHTBOX)return "picture";
  if(NOTIFOPEN)return "notifications";
  if(SEARCHOPEN)return "search";
  if(POSTOPEN&&!(PFTOP&&PROFILE))return "post";
  if(PROFILE)return MYPAGE()?"my profile":"profile";
  if(TAB==="labs"){if(TAGVIEW)return "tag";if(PLIST)return "playlist";if(ROOMOPEN&&LAB)return "lab:"+LAB.id+"/"+(LABVIEW||"work");return "labs"}
  if(TAB==="market"){const v=MKTVIEW||"browse";return v==="browse"?"market":"market:"+v}
  return TAB||"app";
}
function uiPush(kind,screen,prev,ms){
  UI.q.push({kind,screen:String(screen||"").slice(0,40),prev:String(prev||"").slice(0,60),ms:Math.round(ms||0)});
  if(UI.q.length>=40)uiFlush();else if(!UI.timer)UI.timer=setTimeout(uiFlush,10000);
}
function uiFlush(now){
  if(UI.timer){clearTimeout(UI.timer);UI.timer=null}
  if(!UI.q.length)return;
  const events=UI.q.splice(0,60),h={"Content-Type":"application/json"};
  if(TOKEN)h.Authorization="Bearer "+TOKEN;const dv=devId();if(dv)h["X-Device"]=dv;
  try{UIFETCH(API+"/api/ui",{method:"POST",headers:h,body:JSON.stringify({events}),keepalive:!!now}).catch(()=>{})}catch(e){}
  if(UI.q.length)UI.timer=setTimeout(uiFlush,now?0:1000);
}
/* every repaint: did the screen change? */
function uiTick(){
  UI.renders++;
  let s;try{s=uiScreen()}catch(e){return}
  const now=Date.now();
  if(s===UI.screen)return;
  const prev=UI.screen,ms=prev?now-UI.at:0;
  uiEmptyLeave(prev,ms,"moved");
  uiPush("view",s,prev,ms);
  /* flows: started here, finished (a success below) or not */
  const f=UI_FLOWS[s];
  if(UI.flow&&UI.flow!==f){
    if(UI.flow==="post"&&!UI.flowDone&&uiPostQueued())UI.postWait++;   // Share closed the creator; the post itself is still on its way — done when it lands
    else uiPush("flow",UI.flow,UI.flowDone?"done":"abandon");
    UI.flow=null}
  if(f&&UI.flow!==f){UI.flow=f;UI.flowDone=false;uiPush("flow",f,"start")}
  if(s==="studio")uiFeature("studio");if(s==="playlist")uiFeature("playlist");
  if(s==="market:confirmed")uiPush("flow","checkout","done");
  UI.screen=s;UI.at=now;
  setTimeout(uiEmptyCheck,50);
}
/* compose/queue: a post Share has sent on its way (waiting on its photos, or posting) */
function uiPostQueued(){try{return PQ.some(c=>c.queued&&!c.dead&&c.state!=="done"&&c.state!=="failed")}catch(e){return false}}
/* an empty screen, and what happened next */
function uiEmptyCheck(){
  if(UI.empty||!document.querySelector("#app .content .empty, #chatlayer .empty"))return;
  UI.empty={screen:UI.screen,at:Date.now(),acted:false};
}
function uiEmptyLeave(screen,ms,how){
  const e=UI.empty;if(!e)return;UI.empty=null;
  if(e.screen!==screen)return;
  uiPush("empty",screen,how==="exit"?"left":e.acted?"acted":ms>8000?"stayed":"left");
}
/* back.js: a ‹, ✕ or the phone's back left this screen */
function uiBack(){if(UI.screen)uiPush("back",UI.screen,"",Date.now()-UI.at)}
/* a feature's first use today (the server keeps one a day) */
function uiFeature(name){if(UI.sent[name])return;UI.sent[name]=1;uiPush("feature",name)}
/* taps: a tab, or a tap that did nothing */
document.addEventListener("click",e=>{
  const t=e.target;if(!t||!t.closest)return;
  const tab=t.closest("[data-tab]");if(tab)uiPush("tab",tab.dataset.tab);
  let el=t,control=!!t.closest(UI_CONTROLS);
  for(let i=0;!control&&el&&i<6;i++,el=el.parentElement){if(el.onclick||[...el.attributes||[]].some(a=>a.name.startsWith("data-")))control=true}
  if(UI.empty&&UI.empty.screen===UI.screen&&control)UI.empty.acted=true;
  if(control)return;
  const role=t.tagName==="IMG"?"img":/^(H1|H2|H3|B|STRONG)$/.test(t.tagName)||/\b(name|handle|user)\b/.test(t.className||"")?"name":t.closest(".card,.sr-card,.pcard,.lcard")?"card":"text";
  const r=UI.renders,f=UI.fetches,s=UI.screen;
  setTimeout(()=>{if(UI.renders===r&&UI.fetches===f&&UI.screen===s)uiPush("tap",s,role)},500);
},true);
/* the page goes away: where from, and send what's left */
function uiExit(){
  if(UI.exited)return;UI.exited=true;
  uiEmptyLeave(UI.screen,Date.now()-UI.at,"exit");
  if(UI.screen)uiPush("exit",UI.screen,"",Date.now()-UI.at);
  uiFlush(true);
}
addEventListener("pagehide",uiExit);
addEventListener("visibilitychange",()=>{if(document.visibilityState==="hidden")uiExit();else UI.exited=false});
/* a picture or sound that didn't load */
addEventListener("error",e=>{const t=e.target;if(!t||!t.tagName||!/^(IMG|AUDIO|VIDEO)$/.test(t.tagName)||navigator.onLine===false)return;uiPush("media_fail",UI.screen,t.tagName.toLowerCase())},true);
/* once a session: what it's looked at on */
function uiProfile(){
  const w=innerWidth,bucket=w>=1024?"wide":w<360?"<360":w<=400?"360-400":w<=430?"400-430":">430";
  const look=[document.documentElement.getAttribute("data-theme")==="light"?"light":"dark"];
  try{if(matchMedia("(prefers-reduced-motion: reduce)").matches)look.push("rm")}catch(e){}
  try{if(parseFloat(getComputedStyle(document.documentElement).fontSize)>17)look.push("lt")}catch(e){}
  uiPush("profile",bucket,look.join(" "));
}
setTimeout(uiProfile,1500);
/* changes sent: the same one twice, a flow finished, a feature used, an upload that failed, a search that found nothing */
const UIFETCH=window.fetch.bind(window);
window.fetch=function(url,init){
  const u=String(url||""),m=(init&&init.method||"GET").toUpperCase(),p=u.replace(API,"").split("?")[0];
  if(!p.startsWith("/api/")||p==="/api/ui"||p==="/api/glitch"||p==="/api/views")return UIFETCH(url,init);
  UI.fetches++;
  const now=Date.now();
  if(m!=="GET"){
    const k=m+" "+p+" "+String(init&&init.body||"").length;
    if(UI.last&&UI.last.k===k&&now-UI.last.at<2000)uiPush("double",UI.screen);
    UI.last={k,at:now};
  }
  const r=UIFETCH(url,init);
  r.then(res=>{
    if(res.status>=502&&res.status<=504)UI.last=null;   // the app retries those itself (core/updating) — not a member sending twice
    if(m==="GET"){if(p==="/api/search"&&res.ok){const q=(u.split("?")[1]||"").split("&").map(x=>x.split("=")).find(x=>x[0]==="q");const qs=q?decodeURIComponent(q[1]||"").trim():"";
      if(qs.length>=2&&!UI.misses[qs])res.clone().json().then(d=>{if(d&&!(d.people||[]).length&&!(d.posts||[]).length){UI.misses[qs]=1;uiPush("search_miss","search",qs)}}).catch(()=>{})}
      return}
    if(p.startsWith("/api/upload")){if(!res.ok)uiPush("upload_fail",UI.screen,res.status===413?"big":res.status===415||res.status===400?"type":"net");return}
    if(!res.ok)return;
    if(m==="POST"&&p==="/api/posts"){if(UI.flow==="post")UI.flowDone=true;else if(UI.postWait>0){UI.postWait--;uiPush("flow","post","done")}}
    else if(m==="POST"&&p==="/api/market"){UI.flowDone=UI.flow==="sell"||UI.flowDone;uiFeature("sell")}
    else if(/^\/api\/market\/\d+\/buy$/.test(p)){uiPush("flow","checkout","start")}   // off to Stripe; "confirmed" on the way back is done
    else if(/^\/api\/events\/[^/]+\/enter$/.test(p)){UI.flowDone=UI.flow==="enter"||UI.flowDone;uiFeature("enter")}
    else if(/^\/api\/market\/\d+\/offer$/.test(p)){uiPush("flow","offer","done");uiFeature("offer")}
    else if(/^\/api\/posts\/\d+\/collab$/.test(p)){uiPush("flow","collab","done");uiFeature("collab")}
    else if(p==="/api/chats"){const b=String(init&&init.body||"");if(/"members":\[[^\]]*,/.test(b)){uiPush("flow","group","done");uiFeature("group")}}
    else if(/^\/api\/chats\/\d+\/messages$/.test(p))uiFeature("dm");
    else if(p==="/api/playlists")uiFeature("playlist");
  },()=>{if(p.startsWith("/api/upload"))uiPush("upload_fail",UI.screen,"net")});
  return r;
};
