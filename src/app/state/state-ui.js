/* ---- state ---- */
/* Showroom renders straight into the DOM; keep the post objects too, so a
   card's share/like can find its post. Without this, a Showroom share falls
   through to the "not published work" branch and hides every share option. */
/* ── SENTRY (client) ─────────────────────────────────────────────────
   When a member's phone breaks, the error reports itself with a stack —
   no more debugging from dark screen recordings. DSNs are public by design. */
const SENTRY_DSN="https://dd32635170e2123131bb2583d08e2aed@o4511775840468992.ingest.us.sentry.io/4511775846957056";
/* Only phones on the real site report to Sentry (2026-10-08) — test browsers
   on localhost were adding noise. The admin Health mirror still gets all. */
const SENTRY_ON=!/^(localhost|127\.|0\.0\.0\.0|\[|10\.|192\.168\.)/.test(location.hostname);
const _sentSeen=new Set();
function sentryClient(msg,stack,where){
  try{
    if(_sentSeen.size>=8||_sentSeen.has(msg))return;_sentSeen.add(msg);
    const m=SENTRY_ON&&/^https:\/\/([a-f0-9]+)@([^/]+)\/(\d+)$/.exec(SENTRY_DSN);
    const ev={timestamp:Date.now()/1000,platform:"javascript",level:"error",
      tags:{where:where||"web",user:(typeof ME!=="undefined"&&ME)?ME.username:"guest"},
      request:{url:location.href},
      exception:{values:[{type:"Error",value:String(msg).slice(0,500)}]},
      extra:{stack:String(stack||"").slice(0,4000),ua:navigator.userAgent}};
    const env=JSON.stringify({dsn:SENTRY_DSN,sent_at:new Date().toISOString()})+"\n"+
      JSON.stringify({type:"event"})+"\n"+JSON.stringify(ev)+"\n";
    if(m){const url=`https://${m[2]}/api/${m[3]}/envelope/`;
    /* No cookies, plain text: sendBeacon always sends credentials, and Sentry's
       ingest answers "*" to CORS, so the browser refused every report (2026-10-08). */
    fetch(url,{method:"POST",body:env,keepalive:true,credentials:"omit",mode:"cors",headers:{"Content-Type":"text/plain;charset=UTF-8"}}).catch(()=>{})}
    /* Mirror into the app's own intake so the admin Health tab sees member-
       phone errors too — one dashboard, both worlds. */
    try{fetch(API+"/api/client-error",{method:"POST",headers:{"Content-Type":"application/json"},credentials:"include",
      body:JSON.stringify({message:String(msg).slice(0,300),detail:String(stack||"").slice(0,1200),path:location.pathname}),keepalive:true}).catch(()=>{})}catch(e){}
  }catch(e){}
}
window.addEventListener("error",e=>{if(e.target&&e.target!==window)return;   // a missing <img>/<video>, not a crash
  if(/ResizeObserver loop/i.test(String(e.message||"")))return;              // Chrome's harmless layout warning
  if(/^Script error\.?$/i.test(String(e.message||""))&&!e.error)return;      // someone else's script (Instagram's browser, an extension): the browser hides what broke, so there's nothing to fix
  sentryClient(e.message,e.error&&e.error.stack,"error")});
window.addEventListener("unhandledrejection",e=>{const r=e.reason||{};sentryClient(r.message||String(r),r.stack,"promise")});      // profile-first composer: {body,imgs:[{url,thumb,w,h}],busy}   // a profile's active market listings (lazy-loaded when the SHOP tab opens)
/* Add-to-home-screen. Two completely different worlds:
   - Android/Chrome fires `beforeinstallprompt` and lets us trigger a real
     install dialog. We catch and defer it.
   - iOS Safari has NO API. The only way onto the home screen is Share →
     Add to Home Screen, by hand. So on iOS we can only SHOW people how.
   Either way: never nag. Once dismissed, it stays gone. */
/* Overwritten by /api/levels on boot. Declared here with a sane default so
   that a failed call — or an offline start — can't take the app down. */
/* Repaints the app in someone's colour. Every green thing in the CSS reads
   var(--green), so this one line is the whole theme.
   Defensive on purpose: it runs at boot, at login, on every profile open —
   if it throws, nothing renders at all. */
/* The same maths as inkFor() in src/palette.js (v2, 2026-10-14): darker or
   lighter in OKLCH until it reads, so lime stays green and gold stays gold. */
function inkFor(hex){
  if(!/^#[0-9a-fA-F]{6}$/.test(hex))return hex;
  const light=THEME==="light";
  const lin=x=>{x/=255;return x<=.04045?x/12.92:Math.pow((x+.055)/1.055,2.4)};
  const gam=x=>(x<=.0031308?12.92*x:1.055*Math.pow(x,1/2.4)-.055)*255;
  const [r,g,b]=[1,3,5].map(i=>lin(parseInt(hex.slice(i,i+2),16)));
  const l_=Math.cbrt(.4122214708*r+.5363325363*g+.0514459929*b),m_=Math.cbrt(.2119034982*r+.6806995451*g+.1073969566*b),s_=Math.cbrt(.0883024619*r+.2817188376*g+.6299787005*b);
  const L=.2104542553*l_+.793617785*m_-.0040720468*s_,A=1.9779984951*l_-2.428592205*m_+.4505937099*s_,B=.0259040371*l_+.7827717662*m_-.808675766*s_;
  const back=(L2,k)=>{const l=(L2+.3963377774*A*k+.2158037573*B*k)**3,m=(L2-.1055613458*A*k-.0638541728*B*k)**3,q=(L2-.0894841775*A*k-1.291485548*B*k)**3;
    return [4.0767416621*l-3.3077115913*m+.2309699292*q,-1.2684380046*l+2.6097574011*m-.3413193965*q,-.0041960863*l-.7034186147*m+1.707614701*q]};
  const at=L2=>{let k=1,c=back(L2,k);while(k>0&&c.some(v=>v<0||v>1)){k-=.02;c=back(L2,k)}return c.map(v=>Math.min(1,Math.max(0,v)))};
  const Y=c=>.2126*c[0]+.7152*c[1]+.0722*c[2];
  const ok=c=>(light?.86/(Y(c)+.05):(Y(c)+.05)/.05)>=4.5;   // .86 = darkest paper surface, not white
  let c=[r,g,b];
  if(ok(c))return hex.toUpperCase();
  for(let L2=L;L2>0&&L2<1&&!ok(c);L2+=light?-.005:.005)c=at(L2);
  return "#"+c.map(v=>Math.round(gam(v)).toString(16).padStart(2,"0")).join("").toUpperCase();
}
function onAccent(hex){
  /* Text that sits ON an accent fill. Reagent gets its own printed ink. */
  if(!/^#[0-9a-fA-F]{6}$/.test(hex))return "#152C09";
  const v=[1,3,5].map(i=>{let x=parseInt(hex.slice(i,i+2),16)/255;
    return x<=.03928?x/12.92:Math.pow((x+.055)/1.055,2.4)});
  return (.2126*v[0]+.7152*v[1]+.0722*v[2])>.3?"#152C09":"#FFFFFF";
}
/* At night a colour with a night stand-in wears it (Black → white, palette.js
   accentFill): black buttons and rings on a black screen would vanish. */
function accFill(hex){if(THEME==="light")return hex;const a=Object.values(ACCENTS).find(x=>x.night&&x.hex.toLowerCase()===String(hex||"").toLowerCase());return a?a.night:hex}
function applyAccent(hex){
  try{
    ACCENTHEX = hex || "#98FC68";
    const f=accFill(ACCENTHEX);
    document.documentElement.style.setProperty("--green", inkFor(f));
    document.documentElement.style.setProperty("--accent-fill", f);
    document.documentElement.style.setProperty("--on-accent", onAccent(f));
  }catch(e){/* never worth taking the app down over a colour */}
}
/* A post is a post because of what it IS, not because someone ticked a
   box before sending it. Media, a beat, a track, or a post sent in from
   outside renders as a card; plain talk renders as a chat line. The lab
   composer no longer has a say, so nothing in a lab can promote itself
   out of the lab. */
const isCard=p=>!!(p&&(p.imageUrl||p.videoUrl||(p.images&&p.images.length)||p.beat||p.audioTrack||p.audioTrackId||p.sharedFrom));
/* The edit sheet doubles as the naming step on the way in: the upload lands,
   the sheet opens pre-filled, and the same sheet reopens from the row later. */
/* The post a grid tile opens into. Holds the post object, not an id, so the
   overlay paints instantly from what the profile already loaded. */
/* The archive. 226 people have been posting reference into the PHARMACY
   for months and none of it can be found again — this is the fix. */
/* Guest mode: you can see the Showroom, the Market and anyone's portfolio
   without an account. The labs are members-only — that's where people
   actually talk, and it isn't a marketing surface. */
const guest=()=>!ME;
/* The door. Its real job is not decoration: a deliberate tap is the ONLY
   thing iOS accepts as permission to start audio, so ENTER is where sound
   gets unlocked for the session. 023 primes a silent WAV on "first tap
   anywhere" precisely because there was no door to hang this on.
   Guests only, once per browser session, and every exit path is guarded. */
/* The door is the audio unlock, so it stands on EVERY page load. MUSOK and
   MUSPRIMED live in memory and reset with the page, which means a reload
   needs a fresh gesture — and the old sessionStorage suppression hid the
   door on exactly those loads, leaving music armed nowhere. The intro VIDEO
   is the thing that should only happen once; the tap is cheap and it is the
   whole reason autoplay can work at all. (Note ME is still null this early —
   refreshMe() is async — so the old !ME test never distinguished a member
   from a guest anyway.) */
/* Once per visit (2026-10-20): "having to go back to the enter the labs
   screen after you're already in the app" — back from /admin, a Stripe
   checkout or a reload. The door marks the tab (sessionStorage) when it's
   passed; a tab that's been through it goes straight in. Sound still
   unlocks on the first tap anywhere (primeAudio in app/media/media). A new
   tab or a fresh visit still gets the door. */
const enteredTab=()=>{try{return sessionStorage.getItem("tnl-in")==="1"}catch(e){return false}};
ENTER = !enteredTab();
const myName=()=>ME?ME.username:null;
/* Your own profile is a section of the app, so it renders in the .content
   slot ABOVE the nav. Anyone else you peek at stays an overlay after it. */
const MYPAGE=()=>!!(PROFILE&&ME&&PROFILE.user&&PROFILE.user.username===ME.username);
/* A draft in progress owns the screen. Every exit — nav tap, back gesture,
   Cancel — funnels through pcLeave() so there is exactly ONE definition of
   what is safe to throw away. Dirty is derived, never a flag: a flag has to
   be set on every input path and the one you forget is the one that eats
   somebody's post. */
const pcDirty=()=>!!(PCOMPOSE&&((PCOMPOSE.body||"").trim()||PCOMPOSE.imgs.length||PCOMPOSE.vid||PCOMPOSE.vidbusy||PCOMPOSE.upN||PCOMPOSE.track||(PCOMPOSE.collabs&&PCOMPOSE.collabs.length)||(PCOMPOSE.ch&&!PCOMPOSE.ch.auto)
  ||(PCOMPOSE.tags&&PCOMPOSE.tags.length)||PCOMPOSE.location||(PCOMPOSE.products&&PCOMPOSE.products.length)));
/* pcLeave (Cancel / back: save a draft, discard, keep editing) lives in app/compose/queue.js. */
const myRep=()=>ME?ME.rep:0;
function needAccount(why){
  pushView("gate");
  GATE="join"; GATEWHY=why||"";
  render();
}
/* MKTEDIT holds the id of the listing being edited, or null when the seller
   is listing something new. The edit screen IS the sell form — same fields,
   same validation, same muscle memory. A separate edit form would drift
   from the sell form within two patches. */
const $=sel=>document.querySelector(sel);
/* A message on its own layer. It used to repaint the whole app twice (on
   and off) — every "Saved" rebuilt the page under your thumb. */
function toast(t){
  TOASTT=t;clearTimeout(TOASTH);
  let el=document.getElementById("toastl");
  if(!el){el=document.createElement("div");el.id="toastl";document.body.appendChild(el)}
  el.innerHTML=`<div class="toast mv-in" role="status">${esc(t)}</div>`;
  TOASTH=setTimeout(()=>{TOASTT=null;el.innerHTML=""},2200);
}
/* A shareable profile link. A username ending in "." would lose the dot
   to Instagram / iMessage link finders, so it's spelled %2E. */
const profileLink=n=>location.origin+"/u/"+encodeURIComponent(n).replace(/\.+$/,m=>"%2E".repeat(m.length));

/* Ask AFTER a win, never on arrival. Someone who just posted their first
   thing has felt the value — that's when "keep this on your phone" makes
   sense. Cold-open prompts are why everyone reflexively dismisses them. */
function maybeOfferInstall(){
  const st=installState();
  if(st!=="ios"&&st!=="android"&&st!=="inapp")return;
  if(INSTALLCARD)return;
  // only after they've done something real, and only once ever
  try{if(localStorage.getItem("tnl_install_dismissed"))return}catch(e){}
  INSTALLCARD=true;render();
}

function installCardHTML(){
  if(!INSTALLCARD)return "";
  const st=installState();
  if(st==="inapp")return inappCardHTML();
  if(st==="ios"){
    /* iOS has no install API. The honest thing is to show the exact taps,
       because there's no button we can press for them. */
    return `<div class="installc"><div class="installc-in">
      <button class="installc-x" data-installx aria-label="Close"><svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="square" stroke-linejoin="miter" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg></button>
      <div class="installc-h"><img src="/icon-white-512.png?v=2" alt=""><div>
        <b>Keep LABS on your home screen</b>
        <span>Opens full-screen, like an app. No download.</span>
      </div></div>
      <ol class="installc-steps">
        <li>Tap <b>Share</b> <span class="ios-share">⎋</span> in Safari's bar</li>
        <li>Scroll and tap <b>Add to Home Screen</b></li>
        <li>Tap <b>Add</b> — done</li>
      </ol>
    </div></div>`;
  }
  if(st==="android"){
    return `<div class="installc"><div class="installc-in">
      <button class="installc-x" data-installx aria-label="Close"><svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="square" stroke-linejoin="miter" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg></button>
      <div class="installc-h"><img src="/icon-white-512.png?v=2" alt=""><div>
        <b>Add LABS to your home screen</b>
        <span>Opens full-screen, like an app. No download.</span>
      </div></div>
      <button class="btn green wide" data-installgo>Add to home screen</button>
    </div></div>`;
  }
  return "";
}

/* ADD TO HOME SCREEN — the detection + when-to-ask logic */
const onIOS=()=>/iphone|ipad|ipod/i.test(navigator.userAgent||"");
const isStandalone=()=>window.matchMedia?.("(display-mode: standalone)").matches || window.navigator.standalone===true;
function installState(){
  // already an app? nothing to do.
  if(isStandalone())return "installed";
  try{if(localStorage.getItem("tnl_installed"))return "installed"}catch(e){}
  try{if(localStorage.getItem("tnl_install_dismissed"))return "dismissed"}catch(e){}
  if(INAPP)return "inapp";          // inside Instagram: no home screen there — Safari first (app/instagram/inapp)
  if(onIOS())return "ios";          // can only show instructions
  if(INSTALLEVT)return "android";   // can fire a real prompt
  return "none";                    // desktop, or not eligible yet
}
function dismissInstall(){
  INSTALLCARD=false;
  try{localStorage.setItem("tnl_install_dismissed","1")}catch(e){}
  render();
}
async function doInstall(){
  if(INSTALLEVT){
    INSTALLEVT.prompt();
    const {outcome}=await INSTALLEVT.userChoice;
    INSTALLEVT=null;
    if(outcome==="accepted"){INSTALLCARD=false;render()}
    else dismissInstall();
  }
}

/* ---- images ----
   Phone photos are 5–12MB. Resize to max 1400px and re-encode as JPEG
   before upload so posting is fast and storage stays sane. */
/* Decode once, then emit whatever sizes we need. Returns dimensions so
   the feed can reserve space — an <img> with no width/height is what
   makes a feed jump around while it loads. */
function loadImage(file){
  return new Promise((resolve,reject)=>{
    if(!file.type.startsWith("image/"))return reject(new Error("Not an image"));
    const fr=new FileReader();
    fr.onerror=()=>reject(new Error("Couldn't read that file"));
    fr.onload=()=>{
      const img=new Image();
      img.onerror=()=>reject(new Error("Couldn't decode that image"));
      img.onload=async()=>{try{await img.decode()}catch(e){}imgWarm(img);resolve({img,dataUrl:fr.result})};   // decoded and drawn once before any copy (app/media/images)
      img.src=fr.result;
    };
    fr.readAsDataURL(file);
  });
}
function resize(img,maxDim,quality){
  let w=img.naturalWidth||img.width, h=img.naturalHeight||img.height;
  if(w>maxDim||h>maxDim){const s=Math.min(maxDim/w,maxDim/h);w=Math.round(w*s);h=Math.round(h*s)}
  const c=document.createElement("canvas");c.width=w;c.height=h;
  c.getContext("2d").drawImage(img,0,0,w,h);
  return {data:c.toDataURL("image/jpeg",quality),w,h};
}
/* Full-size for the lightbox + a small thumb for the feed. The feed used
   to download every full-res image at once — rough on cellular. */
async function prepImage(file,asWork){
  const {img,dataUrl}=await loadImage(file);
  const W=img.naturalWidth||img.width, H=img.naturalHeight||img.height;
  if(file.type==="image/gif"&&file.size<4*1024*1024)
    return {full:dataUrl,thumb:dataUrl,w:W,h:H,gif:true};
  const full=resize(img,asWork?2400:1600,asWork?.92:.85);
  const thumb=resize(img,700,.72);
  return {full:full.data,thumb:thumb.data,w:full.w,h:full.h};
}
function compressImage(file,maxDim=1400,quality=.82){
  return loadImage(file).then(async({img,dataUrl})=>{
    if(file.type==="image/gif"&&file.size<4*1024*1024)return dataUrl;
    let r=resize(img,maxDim,quality);
    for(let k=0;k<3&&await dataBlank(r.data);k++){await new Promise(z=>setTimeout(z,150));r=resize(img,maxDim,quality)}
    return r.data;
  });
}

function dataUrlToBlob(d){
  const [meta,b64]=d.split(",");
  const mime=(/data:([^;]+)/.exec(meta)||[])[1]||"application/octet-stream";
  const bin=atob(b64); const arr=new Uint8Array(bin.length);
  for(let i=0;i<bin.length;i++)arr[i]=bin.charCodeAt(i);
  return new Blob([arr],{type:mime});
}


/* ---- live updates: app/messages/live.js (messaging v2) ---- */

/* ---- data ---- */
async function loadFeed(force){
  if(guest())return;
  /* Every render() used to refire this — a like cost 2+ round trips and the
     app crawled on phone networks. Fresh-enough data now short-circuits;
     posting, deleting, and live SSE events pass force=true. */
  /* …but a render() still has to repaint the room it just emptied. */
  /* A lab's Talk is the whole lab: every old channel merged (app/labs/places). */
  if(TAB!=="labs"||!LAB||LABVIEW!=="talk")return;
  if(!force && FEEDAT[CH.id] && Date.now()-FEEDAT[CH.id]<8000){if(POSTSCH===CH.id)renderRoomFeed();return}
  FEEDAT[CH.id]=Date.now();
  const ch=CH.id, lab=LAB.id;
  try{const d=await papi.feed(lab);if(!CH||CH.id!==ch||LABVIEW!=="talk")return;POSTS=d.posts;LABPINS=d.pins||[];renderRoomFeed()}catch(e){/* not fatal */}
  // opening Talk clears the whole lab's dots
  const had=LAB.channels.map(c=>c.id).filter(c=>UNREADS[c]);
  if(had.length){had.forEach(c=>delete UNREADS[c]);paintUnreads()}
  for(const c of new Set([ch,...had]))try{await api.readChannel(c)}catch(e){}
}
function paintUnreads(){
  document.querySelectorAll("[data-ch]").forEach(el=>{
    const n=UNREADS[el.dataset.ch]||0;
    el.classList.toggle("unread",!!n);
    const b=el.querySelector(".cbadge");
    if(n&&!b){const sp=document.createElement("span");sp.className="cbadge";sp.textContent=n>9?"9+":n;el.appendChild(sp)}
    else if(n&&b)b.textContent=n>9?"9+":n;
    else if(!n&&b)b.remove();
  });
}
/* What's alive in each lab. Cheap, and it's the whole reason the grid is
   better than a list — a room with the last thing made in it is a place. */
async function loadLabs(){
  if(!ME)return;
  try{
    const next=await api.labs();
    /* Only replace once we actually have data. A hiccup that returns null
       or an empty shell must not wipe tiles that were alive a second ago —
       that's the "everything says empty — be first" bug. */
    if(next&&(next.byChannel||next.people||next.art)) LABACT=next;
    render();
  }catch(e){/* keep last-known — the grid stays lit, just not refreshed */}
}

async function loadUnreads(){
  if(!ME)return;
  try{const d=await api.unreads();LABMUTED=new Set((d.muted||[]).filter(k=>k.startsWith("lab:")));
    // a muted channel keeps its messages but loses its dot
    for(const k of LABMUTED)delete d.unreads[k.slice(4)];
    UNREADS=d.unreads;paintUnreads()}catch(e){}
}
async function refreshMe(){try{const d=await api.me();ME=d.user}catch(e){TOKEN=null;localStorage.removeItem("tnl-token")}}

/* ================================================================
   RENDERING
================================================================ */
