/* ---- state ---- */
// LAB=null means you're standing outside looking at the labs, not in one
let TAB="showroom", LAB=null, CH=LABS[0].channels[0], ROOMOPEN=false, POSTS=[], PROFILE=null, TOASTT=null;
/* Showroom renders straight into the DOM; keep the post objects too, so a
   card's share/like can find its post. Without this, a Showroom share falls
   through to the "not published work" branch and hides every share option. */
let SRPOSTS=[];
let PTAB="work", EDITING=false, EDITROLE="", PENDIMG=null, LIGHTBOX=null, VERIFYURL=null;
let PROFLISTINGS=null;
let PCOMPOSE=null;
let FEEDAT={}, SRAT=0;  // freshness stamps — render() must not hammer the network on every tap
/* ── SENTRY (client) ─────────────────────────────────────────────────
   When a member's phone breaks, the error reports itself with a stack —
   no more debugging from dark screen recordings. DSNs are public by design. */
const SENTRY_DSN="https://dd32635170e2123131bb2583d08e2aed@o4511775840468992.ingest.us.sentry.io/4511775846957056";
const _sentSeen=new Set();
function sentryClient(msg,stack,where){
  try{
    if(_sentSeen.size>=8||_sentSeen.has(msg))return;_sentSeen.add(msg);
    const m=/^https:\/\/([a-f0-9]+)@([^/]+)\/(\d+)$/.exec(SENTRY_DSN);if(!m)return;
    const ev={timestamp:Date.now()/1000,platform:"javascript",level:"error",
      tags:{where:where||"web",user:(typeof ME!=="undefined"&&ME)?ME.username:"guest"},
      request:{url:location.href},
      exception:{values:[{type:"Error",value:String(msg).slice(0,500)}]},
      extra:{stack:String(stack||"").slice(0,4000),ua:navigator.userAgent}};
    const env=JSON.stringify({dsn:SENTRY_DSN,sent_at:new Date().toISOString()})+"\n"+
      JSON.stringify({type:"event"})+"\n"+JSON.stringify(ev)+"\n";
    const url=`https://${m[2]}/api/${m[3]}/envelope/`;
    if(navigator.sendBeacon)navigator.sendBeacon(url,new Blob([env],{type:"application/x-sentry-envelope"}));
    else fetch(url,{method:"POST",body:env,keepalive:true}).catch(()=>{});
    /* Mirror into the app's own intake so the admin Health tab sees member-
       phone errors too — one dashboard, both worlds. */
    try{fetch(API+"/api/client-error",{method:"POST",headers:{"Content-Type":"application/json"},credentials:"include",
      body:JSON.stringify({message:String(msg).slice(0,300),detail:String(stack||"").slice(0,1200),path:location.pathname}),keepalive:true}).catch(()=>{})}catch(e){}
  }catch(e){}
}
window.addEventListener("error",e=>sentryClient(e.message,e.error&&e.error.stack,"error"));
window.addEventListener("unhandledrejection",e=>{const r=e.reason||{};sentryClient(r.message||String(r),r.stack,"promise")});      // profile-first composer: {body,imgs:[{url,thumb,w,h}],busy}   // a profile's active market listings (lazy-loaded when the SHOP tab opens)
let CLIMB=false, CLIMBOPENRUNG=0; // THE CLIMB — the one screen where the whole progression system is legible
/* Discord-style: several files at once. Each posts separately. */
let QUEUE=[];
/* Add-to-home-screen. Two completely different worlds:
   - Android/Chrome fires `beforeinstallprompt` and lets us trigger a real
     install dialog. We catch and defer it.
   - iOS Safari has NO API. The only way onto the home screen is Share →
     Add to Home Screen, by hand. So on iOS we can only SHOW people how.
   Either way: never nag. Once dismissed, it stays gone. */
let INSTALLEVT=null, INSTALLCARD=false;
let EBAR=0, OPENTRACK="", PITCHSEL=0, DRAFTS=null;
/* Overwritten by /api/levels on boot. Declared here with a sane default so
   that a failed call — or an offline start — can't take the app down. */
let SITE={};   // headline, tagline, announcement, feature switches — set by /api/levels
let ACCENTS={lab:{name:"Lab",hex:"#98FC68"}};
let EDITACCENT=null;
/* Repaints the app in someone's colour. Every green thing in the CSS reads
   var(--green), so this one line is the whole theme.
   Defensive on purpose: it runs at boot, at login, on every profile open —
   if it throws, nothing renders at all. */
let ACCENTHEX = "#98FC68";
function inkFor(hex){
  if(!/^#[0-9a-fA-F]{6}$/.test(hex))return hex;
  const light = THEME==="light";
  const p=h=>[1,3,5].map(i=>parseInt(h.slice(i,i+2),16));
  const lum=c=>{const v=c.map(x=>{x/=255;return x<=.03928?x/12.92:Math.pow((x+.055)/1.055,2.4)});
    return .2126*v[0]+.7152*v[1]+.0722*v[2]};
  const ok=c=>(light?.86/(lum(c)+.05):(lum(c)+.05)/.05)>=4.5;   // .86 = darkest paper surface, not white
  const base=p(hex); let c=base;
  if(light){ for(let k=1;k>.05&&!ok(c);k-=.02) c=base.map(v=>v*k); }
  else     { for(let k=0;k<=1&&!ok(c);k+=.02) c=base.map(v=>v+(255-v)*k); }
  return "#"+c.map(v=>Math.round(v).toString(16).padStart(2,"0")).join("");
}
function onAccent(hex){
  /* Text that sits ON an accent fill. Reagent gets its own printed ink. */
  if(!/^#[0-9a-fA-F]{6}$/.test(hex))return "#152C09";
  const v=[1,3,5].map(i=>{let x=parseInt(hex.slice(i,i+2),16)/255;
    return x<=.03928?x/12.92:Math.pow((x+.055)/1.055,2.4)});
  return (.2126*v[0]+.7152*v[1]+.0722*v[2])>.3?"#152C09":"#FFFFFF";
}
function applyAccent(hex){
  try{
    ACCENTHEX = hex || "#98FC68";
    document.documentElement.style.setProperty("--green", inkFor(ACCENTHEX));
    document.documentElement.style.setProperty("--accent-fill", ACCENTHEX);
    document.documentElement.style.setProperty("--on-accent", onAccent(ACCENTHEX));
  }catch(e){/* never worth taking the app down over a colour */}
}
let PENDVID=null, PENDKIND=null, EDITID=null, EDITROLES=[];
/* A post is a post because of what it IS, not because someone ticked a
   box before sending it. Media, a beat, a track, or a post sent in from
   outside renders as a card; plain talk renders as a chat line. The lab
   composer no longer has a say, so nothing in a lab can promote itself
   out of the lab. */
const isCard=p=>!!(p&&(p.imageUrl||p.videoUrl||(p.images&&p.images.length)||p.beat||p.audioTrack||p.audioTrackId||p.sharedFrom));
let TRACKS=null, TRKQ="", TRKUP=false, NOWPLAYING=null;
/* The edit sheet doubles as the naming step on the way in: the upload lands,
   the sheet opens pre-filled, and the same sheet reopens from the row later. */
let TRKEDIT=null;   // {id,title,artworkUrl,busy,fresh}
/* The post a grid tile opens into. Holds the post object, not an id, so the
   overlay paints instantly from what the profile already loaded. */
let POSTOPEN=null;
let TRKVIDS=null, TRKEXT=false;
let NOTIFS=null, UNREAD=0, DMUNREAD=0, SEARCHQ="", SEARCHROLE="", SEARCHRES=null;
let OPENCOMMENTS=null, COMMENTS=[], CEDIT=null;
let NOTIFOPEN=false, DMOPENPANEL=false, SEARCHOPEN=false;
let SEARCHING=false, UNREADS={}, PICKER=null, MENTIONS=null, MENTIONQ="";
let LABACT=null;   // per-lab life: what got made, who was in, what's unread
/* The archive. 226 people have been posting reference into the PHARMACY
   for months and none of it can be found again — this is the fix. */
let ARCHIVE=null, ARCHFILT={}, BOARDS=null, BOARDONE=null, BOARDSOPEN=false, ARCHT=null;
let PASTING=false, PASTED=null, PASTEERR=null, ARCHSRC="tnl";
/* Guest mode: you can see the Showroom, the Market and anyone's portfolio
   without an account. The labs are members-only — that's where people
   actually talk, and it isn't a marketing surface. */
let GATE=null;                       // null = browsing, "join"/"login" = the door
const guest=()=>!ME;
/* The door. Its real job is not decoration: a deliberate tap is the ONLY
   thing iOS accepts as permission to start audio, so ENTER is where sound
   gets unlocked for the session. 023 primes a silent WAV on "first tap
   anywhere" precisely because there was no door to hang this on.
   Guests only, once per browser session, and every exit path is guarded. */
let ENTER = false;
/* The door is the audio unlock, so it stands on EVERY page load. MUSOK and
   MUSPRIMED live in memory and reset with the page, which means a reload
   needs a fresh gesture — and the old sessionStorage suppression hid the
   door on exactly those loads, leaving music armed nowhere. The intro VIDEO
   is the thing that should only happen once; the tap is cheap and it is the
   whole reason autoplay can work at all. (Note ME is still null this early —
   refreshMe() is async — so the old !ME test never distinguished a member
   from a guest anyway.) */
ENTER = true;
const myName=()=>ME?ME.username:null;
/* Your own profile is a section of the app, so it renders in the .content
   slot ABOVE the nav. Anyone else you peek at stays an overlay after it. */
const MYPAGE=()=>!!(PROFILE&&ME&&PROFILE.user&&PROFILE.user.username===ME.username);
/* A draft in progress owns the screen. Every exit — nav tap, back gesture,
   Cancel — funnels through pcLeave() so there is exactly ONE definition of
   what is safe to throw away. Dirty is derived, never a flag: a flag has to
   be set on every input path and the one you forget is the one that eats
   somebody's post. */
const pcDirty=()=>!!(PCOMPOSE&&((PCOMPOSE.body||"").trim()||PCOMPOSE.imgs.length||PCOMPOSE.vid||PCOMPOSE.vidbusy||PCOMPOSE.upN||PCOMPOSE.track||(PCOMPOSE.collabs&&PCOMPOSE.collabs.length)||PCOMPOSE.ch
  ||(PCOMPOSE.tags&&PCOMPOSE.tags.length)||PCOMPOSE.location||(PCOMPOSE.products&&PCOMPOSE.products.length)));
/* pcLeave (Cancel / back: save a draft, discard, keep editing) lives in app-18-post-queue.js. */
const myRep=()=>ME?ME.rep:0;
function needAccount(why){
  pushView("gate");
  GATE="join"; GATEWHY=why||"";
  render();
}
let GATEWHY="";
let MKT=null, MKTMETA={categories:[],conditions:[],paymentsEnabled:false}, MKTFILT={}, MKTVIEW="browse";
let MKTONE=null, MKTOFFERS=[], SELLFORM=null, SELLIMGS=[], ORDERS=null, ORDTAB="buying", SELLUP=false, MKTFILTOPEN=false;
/* MKTEDIT holds the id of the listing being edited, or null when the seller
   is listing something new. The edit screen IS the sell form — same fields,
   same validation, same muscle memory. A separate edit form would drift
   from the sell form within two patches. */
let MKTEDIT=null;
let MKTSELLER=null, MKTSIMILAR=[], SAVED=null, REVIEWING=null, REVSTARS=5;
let SELLKIND="physical", SELLAUDIO=null, SELLAUDIONAME="";
const $=sel=>document.querySelector(sel);
/* A message on its own layer. It used to repaint the whole app twice (on
   and off) — every "Saved" rebuilt the page under your thumb. */
let TOASTH=0;
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

/* Modern in-app dialogs — no native prompt()/confirm()/alert() anywhere. These
   render a styled overlay and resolve a Promise, so async handlers can await them. */
function uiModal({title,body,fields,okLabel="Confirm",cancelLabel="Cancel",danger=false,okOnly=false}){
  return new Promise(resolve=>{
    const ov=document.createElement("div");ov.className="ui-ov";
    ov.innerHTML=`<div class="ui-card" role="dialog" aria-modal="true">
      <div class="ui-title">${esc(title||"")}</div>
      ${body?`<div class="ui-body">${esc(body)}</div>`:""}
      ${(fields||[]).map((f,i)=>`<input class="ui-in" data-uif="${i}" type="${f.type||"text"}" inputmode="${f.inputmode||"text"}" placeholder="${esc(f.placeholder||"")}" value="${esc(f.value||"")}">`).join("")}
      <div class="ui-btns">
        ${okOnly?"":`<button class="ui-btn ui-cancel">${esc(cancelLabel)}</button>`}
        <button class="ui-btn ui-ok ${danger?"ui-danger":""}">${esc(okLabel)}</button>
      </div></div>`;
    document.body.appendChild(ov);
    const ins=[...ov.querySelectorAll("[data-uif]")];
    /* Focus lands inside, so Escape / Enter work on a computer even with no field. */
    setTimeout(()=>{if(ins[0]){ins[0].focus();ins[0].select&&ins[0].select()}else ov.querySelector(".ui-ok").focus({preventScroll:true})},50);
    const done=v=>{ov.remove();resolve(v)};
    ov.querySelector(".ui-cancel")?.addEventListener("click",()=>done(okOnly?true:null));
    ov.querySelector(".ui-ok").addEventListener("click",()=>done(ins.length?ins.map(i=>i.value):true));
    ov.addEventListener("click",e=>{if(e.target===ov)done(okOnly?true:null)});
    ov.addEventListener("keydown",e=>{if(e.key==="Escape")done(okOnly?true:null);if(e.key==="Enter"&&ins.length<=1){e.preventDefault();ov.querySelector(".ui-ok").click()}});
  });
}
const uiConfirm=(title,body,o={})=>uiModal({title,body,okLabel:o.okLabel||"Confirm",cancelLabel:o.cancelLabel||"Cancel",danger:!!o.danger}).then(v=>v===true);
const uiAlert=(title,body)=>uiModal({title,body,okOnly:true,okLabel:"OK"});
const uiPrompt=(title,o={})=>uiModal({title,body:o.body,fields:[{placeholder:o.placeholder,value:o.value,type:o.type,inputmode:o.inputmode}],okLabel:o.okLabel||"Done",cancelLabel:o.cancelLabel||"Cancel"}).then(v=>Array.isArray(v)?v[0]:null);

/* Ask AFTER a win, never on arrival. Someone who just posted their first
   thing has felt the value — that's when "keep this on your phone" makes
   sense. Cold-open prompts are why everyone reflexively dismisses them. */
function maybeOfferInstall(){
  const st=installState();
  if(st!=="ios"&&st!=="android")return;
  if(INSTALLCARD)return;
  // only after they've done something real, and only once ever
  try{if(localStorage.getItem("tnl_install_dismissed"))return}catch(e){}
  INSTALLCARD=true;render();
}

function installCardHTML(){
  if(!INSTALLCARD)return "";
  const st=installState();
  if(st==="ios"){
    /* iOS has no install API. The honest thing is to show the exact taps,
       because there's no button we can press for them. */
    return `<div class="installc"><div class="installc-in">
      <button class="installc-x" data-installx aria-label="Close"><svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="square" stroke-linejoin="miter" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg></button>
      <div class="installc-h"><img src="/icon-white-512.png" alt=""><div>
        <b>Keep TNL on your home screen</b>
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
      <div class="installc-h"><img src="/icon-white-512.png" alt=""><div>
        <b>Add TNL to your home screen</b>
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
      img.onload=()=>resolve({img,dataUrl:fr.result});
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
  return loadImage(file).then(({img,dataUrl})=>{
    if(file.type==="image/gif"&&file.size<4*1024*1024)return dataUrl;
    return resize(img,maxDim,quality).data;
  });
}

function dataUrlToBlob(d){
  const [meta,b64]=d.split(",");
  const mime=(/data:([^;]+)/.exec(meta)||[])[1]||"application/octet-stream";
  const bin=atob(b64); const arr=new Uint8Array(bin.length);
  for(let i=0;i<bin.length;i++)arr[i]=bin.charCodeAt(i);
  return new Blob([arr],{type:mime});
}


/* ---- live updates: app-10-chat-5-live.js (messaging v2) ---- */

/* ---- data ---- */
async function loadFeed(force){
  if(guest())return;
  /* Every render() used to refire this — a like cost 2+ round trips and the
     app crawled on phone networks. Fresh-enough data now short-circuits;
     posting, deleting, and live SSE events pass force=true. */
  /* …but a render() still has to repaint the room it just emptied. */
  if(!force && FEEDAT[CH.id] && Date.now()-FEEDAT[CH.id]<8000){if(POSTSCH===CH.id)renderRoomFeed();return}
  FEEDAT[CH.id]=Date.now();
  const ch=CH.id;
  try{const d=await api.feed(ch);if(!CH||CH.id!==ch)return;POSTS=d.posts;LABPINS=d.pins||[];renderRoomFeed()}catch(e){/* not fatal */}
  // opening a channel clears its dot
  if(UNREADS[CH.id]){delete UNREADS[CH.id];paintUnreads()}
  try{await api.readChannel(CH.id)}catch(e){}
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
