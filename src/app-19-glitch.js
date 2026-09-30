/* GLITCH SIGNALS v1.0 — 2026-09-29
   Crashes already go to /api/client-error. This catches what doesn't crash
   but feels broken, and tells the admin page (server-10-glitch.js):
     rage_tap       the same control tapped 3+ times within ~1s
     layout_jump    the screen moved on its own while someone read (Chrome/Android;
                    iOS Safari doesn't expose layout shifts)
     slow_screen    an /api GET that took over 3s
     action_failed  a save the server couldn't do (5xx) or never got (network)
   Quiet by design: one report per kind and spot every 30s, sent in batches,
   never the content of a post or message. */
const GL={q:[],seen:{},timer:null};
function glPlace(){
  if(GATE)return "sign-up";if(PCOMPOSE)return "post creator";if(TRKEDIT)return "track edit";
  if(CHAT)return "chat";if(DMOPENPANEL)return "messages";if(POSTOPEN)return "opened post";
  if(PROFILE)return MYPAGE()?"my profile":"a profile";
  if(TAB==="labs")return ROOMOPEN&&LAB&&CH?"lab "+LAB.name+" / "+(CH.label||CH.id):"labs";
  return TAB||"app";
}
function glitch(kind,detail){
  const place=glPlace(),key=kind+"|"+place+"|"+detail,now=Date.now();
  if(GL.seen[key]&&now-GL.seen[key]<30000)return;
  GL.seen[key]=now;
  if(GL.q.length>=20)return;
  GL.q.push({kind,place,detail:String(detail||"").slice(0,240)});
  clearTimeout(GL.timer);GL.timer=setTimeout(glFlush,4000);
}
const GLFETCH=window.fetch.bind(window);
function glFlush(){
  if(!GL.q.length)return;
  const events=GL.q.splice(0,10);
  try{GLFETCH(API+"/api/glitch",{method:"POST",keepalive:true,
    headers:Object.assign({"Content-Type":"application/json"},TOKEN?{Authorization:"Bearer "+TOKEN}:{}),
    body:JSON.stringify({events,device:isWide()?"computer":"phone"})}).catch(()=>{})}catch(e){}
  if(GL.q.length)GL.timer=setTimeout(glFlush,4000);
}
document.addEventListener("visibilitychange",()=>{if(document.hidden)glFlush()});

/* rage taps: the SAME button, still on screen, tapped 3 times in ~1s. If the
   app answered by moving on (a new screen, a repaint), it's a new button and
   the count starts again: Next, Next, Next through sign-up is not rage. */
function glTarget(el){
  const b=el&&el.closest&&el.closest("button,a,[role=button],[data-like],[data-share],[data-trkplay],[data-lab],.sr-card img");
  if(!b||b.closest("#studiomount"))return null;
  if(b.matches("[data-nownext],[data-nowprev],[data-nowseek],.now-seek"))return null;   // skipping tracks fast is normal
  if(b.matches(MV_MEDIA))return null;   // a post's picture: double-tap is how you like it (app-09-motion)
  return b;
}
const glName=b=>{const k=b.dataset?Object.keys(b.dataset)[0]:null;
  return (b.id?"#"+b.id:k?"["+k.replace(/[A-Z]/g,c=>"-"+c.toLowerCase())+"]":String(b.getAttribute("aria-label")||b.className||b.tagName)).slice(0,48)};
let GLRT={el:null,n:0,t0:0};
document.addEventListener("pointerdown",e=>{
  const b=glTarget(e.target);if(!b)return;
  const now=Date.now();
  if(GLRT.el===b&&b.isConnected&&now-GLRT.t0<1200)GLRT.n++;else GLRT={el:b,n:1,t0:now};
  if(GLRT.n===3)glitch("rage_tap",glName(b));
},true);

/* layout jumps nobody asked for (hadRecentInput = the person caused it) */
try{
  new PerformanceObserver(list=>{for(const e of list.getEntries()){
    if(e.hadRecentInput||e.value<0.1)continue;
    const n=((e.sources||[])[0]||{}).node;
    const what=n&&n.nodeType===1?(n.id?"#"+n.id:"."+String(n.className||n.tagName).split(" ")[0]):"page";
    glitch("layout_jump",what+" moved "+e.value.toFixed(2));
  }}).observe({type:"layout-shift",buffered:false});
}catch(e){/* no layout-shift API here (iOS) */}

/* slow screens and failed saves, from every /api call the app makes */
const glPath=u=>String(u).replace(/^https?:\/\/[^/]+/,"").split("?")[0]
  .replace(/\/(users|dm|sellers|u)\/[^/]+/,"/$1/:name").replace(/\/\d+(?=\/|$)/g,"/:id");
window.fetch=async function(input,init){
  const url=typeof input==="string"?input:(input&&input.url)||"";
  const m=String((init&&init.method)||"GET").toUpperCase();
  const watch=/\/api\//.test(url)&&!/\/api\/(stream|glitch|client-error|upload)/.test(url);
  const t=Date.now();
  try{
    const r=await GLFETCH(input,init);
    if(watch){
      const took=Date.now()-t;
      if(m==="GET"&&took>3000)glitch("slow_screen",glPath(url)+" "+(took/1000).toFixed(1)+"s");
      if(m!=="GET"&&r.status>=500)glitch("action_failed",m+" "+glPath(url)+" → "+r.status);
    }
    return r;
  }catch(e){
    if(watch&&m!=="GET"&&navigator.onLine!==false)glitch("action_failed",m+" "+glPath(url)+" → no answer");
    throw e;
  }
};
