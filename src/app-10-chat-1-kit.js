/* ================================================================
   MESSAGES v2.0 — 2026-09-29. One chat kit for labs and DMs.
   Parts: 1-kit (this: state, API, shared pieces, the hold menu),
   2-dm (inbox + chat screens), 3-wire (DM behaviour, voice notes,
   sheets), 4-live (the private live stream, lab rooms as chat).

   The messages screen paints into its own layer (#chatlayer) instead
   of going through render(): render() rebuilds the whole app on every
   toast, and a chat can't lose its scroll position or half-typed
   message every time something else happens.
================================================================ */
const REACTS=["❤️","😂","😮","😢","🔥","👏"];
let INBOX=null, INBOXTAB="chats", CHAT=null, CHATSHEET=null, CMENU=null, TYPING={}, LABREPLY=null, LABPINS=[], LABMUTED=new Set(), RECORD=null, CHATZOOM=null;

const capi={
  inbox:()=>req("/api/chats"),
  withUser:u=>req("/api/chats/with/"+encodeURIComponent(u)),
  sendTo:(u,b)=>req("/api/chats/with/"+encodeURIComponent(u),{method:"POST",body:b}),
  chat:(id,before)=>req("/api/chats/"+id+(before?"?before="+before:"")),
  send:(id,b)=>req("/api/chats/"+id+"/messages",{method:"POST",body:b}),
  read:id=>req("/api/chats/"+id+"/read",{method:"POST"}),
  accept:id=>req("/api/chats/"+id+"/accept",{method:"POST"}),
  clear:id=>req("/api/chats/"+id+"/clear",{method:"POST"}),
  edit:(m,body)=>req("/api/chats/m/"+m,{method:"PATCH",body:{body}}),
  unsend:m=>req("/api/chats/m/"+m,{method:"DELETE"}),
  react:(m,emoji)=>req("/api/chats/m/"+m+"/react",{method:"POST",body:{emoji}}),
  group:(usernames,title)=>req("/api/chats",{method:"POST",body:{usernames,title}}),
  rename:(id,title)=>req("/api/chats/"+id,{method:"PATCH",body:{title}}),
  add:(id,usernames)=>req("/api/chats/"+id+"/members",{method:"POST",body:{usernames}}),
  remove:(id,u)=>req("/api/chats/"+id+"/members/"+encodeURIComponent(u),{method:"DELETE"}),
  forward:b=>req("/api/chats/forward",{method:"POST",body:b}),
  mute:(chat,hours)=>req("/api/chats/mute",{method:"POST",body:{chat,hours}}),
  activity:show=>req("/api/chats/activity",{method:"POST",body:{show}}),
  typing:chat=>req("/api/typing",{method:"POST",body:{chat}}),
  postReact:(id,emoji)=>req("/api/posts/"+id+"/react",{method:"POST",body:{emoji}}),
  pin:(id,pinned)=>req("/api/posts/"+id+"/pin",{method:"POST",body:{pinned}}),
  ticket:()=>req("/api/stream/ticket",{method:"POST"}),
};

/* Drawn icons — 2px stroke, square caps, same geometry as the nav. */
const ci=(d,s=20,fill="none")=>`<svg viewBox="0 0 24 24" width="${s}" height="${s}" fill="${fill}" stroke="currentColor" stroke-width="2" stroke-linecap="square" stroke-linejoin="miter" aria-hidden="true">${d}</svg>`;
const CI={
  back:ci('<path d="M15 5l-7 7 7 7"/>',22), x:ci('<path d="M6 6l12 12M18 6L6 18"/>',18),
  reply:ci('<path d="M9 7l-5 5 5 5M4 12h10a6 6 0 0 1 6 6v1"/>'), fwd:ci('<path d="M15 7l5 5-5 5M20 12H10a6 6 0 0 0-6 6v1"/>'),
  copy:ci('<rect x="8" y="8" width="12" height="12"/><path d="M16 8V4H4v12h4"/>'), edit:ci('<path d="M4 20h4L19 9l-4-4L4 16zM13 7l4 4"/>'),
  trash:ci('<path d="M5 7h14M10 7V4h4v3M7 7l1 13h8l1-13"/>'), pin:ci('<path d="M9 4h6l-1 6 3 3H7l3-3zM12 13v7"/>'),
  mic:ci('<rect x="9" y="3" width="6" height="11"/><path d="M5 11a7 7 0 0 0 14 0M12 18v3"/>',20), info:ci('<circle cx="12" cy="12" r="9"/><path d="M12 11v6M12 7v1"/>',22),
  compose:ci('<path d="M4 20h16M15 4l4 4-9 9H6v-4z"/>',22), down:ci('<path d="M12 5v13M6 12l6 6 6-6"/>',18),
  mute:ci('<path d="M6 16v-5a6 6 0 0 1 9.5-4.9M18 11v5l1.5 2H9M10 21h4M4 4l16 16"/>',14),
  play:ci('<path d="M8 5v14l11-7z"/>',16,"currentColor"), pause:ci('<path d="M8 5v14M16 5v14"/>',16),
  img:ci('<rect x="4" y="5" width="16" height="14"/><path d="M4 16l5-5 4 4 2-2 5 5"/>',20), people:ci('<circle cx="9" cy="8" r="3.5"/><path d="M3 20a6 6 0 0 1 12 0M16 4.5a3.5 3.5 0 0 1 0 7M17 14a6 6 0 0 1 4 6"/>',20),
  open:ci('<path d="M8 16L16 8M9.5 8H16v6.5"/>'),
  send:UI_IC.arrow, check:ci('<path d="M5 12l5 5 9-10"/>',16),
};

/* ---- time ---- */
const clock=t=>new Date(t).toLocaleTimeString([],{hour:"numeric",minute:"2-digit"});
function dayLabel(t){
  const d=new Date(t),n=new Date(),day=x=>new Date(x.getFullYear(),x.getMonth(),x.getDate()).getTime();
  const k=Math.round((day(n)-day(d))/864e5);
  if(k<1)return "Today"; if(k<2)return "Yesterday";
  if(k<7)return d.toLocaleDateString([],{weekday:"long"});
  return d.toLocaleDateString([],{day:"numeric",month:"short",year:d.getFullYear()===n.getFullYear()?undefined:"numeric"});
}
const newDay=(a,b)=>!a||new Date(a.createdAt).toDateString()!==new Date(b.createdAt).toDateString();
const dayHTML=t=>`<div class="c-day"><span>${esc(dayLabel(t))}</span></div>`;
function agoShort(t){const s=(Date.now()-t)/1000;
  if(s<60)return "now";if(s<3600)return Math.floor(s/60)+"m";if(s<86400)return Math.floor(s/3600)+"h";
  if(s<604800)return Math.floor(s/86400)+"d";return Math.floor(s/604800)+"w"}
const activeLine=o=>!o?"":o.active?"Active now":o.lastSeenAt?"Active "+agoShort(o.lastSeenAt)+" ago":"";

/* ---- shared pieces: reactions, quotes, link cards, voice notes ---- */
function reactsHTML(list,target){
  if(!list||!list.length)return "";
  const g={};for(const r of list)(g[r.emoji]=g[r.emoji]||[]).push(r.username);
  return `<div class="c-rx">${Object.entries(g).map(([e,who])=>`<button class="c-rxp ${who.includes(myName())?"on":""}" data-rx="${e}" data-rxt="${target}" title="${esc(who.map(u=>"@"+u).join(", "))}">${e}${who.length>1?`<b>${who.length}</b>`:""}</button>`).join("")}</div>`;
}
function quoteHTML(r){
  if(!r)return "";
  if(r.deleted)return `<div class="c-q gone">${esc(r.text||"Original message unsent")}</div>`;
  const who=r.from===myName()?"You":(r.displayName||(r.from?"@"+r.from:""));
  return `<button class="c-q" data-jump="${r.id}">${r.thumb?`<img src="${esc(r.thumb)}" alt="">`:""}<span><b>${esc(who)}</b>${esc(r.text||"")}</span></button>`;
}
function linkPrevHTML(l){
  if(!l||(!l.title&&!l.image)||!/^https?:\/\//i.test(l.url||""))return "";   // web links only — never javascript:
  return `<a class="c-lp" href="${esc(l.url)}" target="_blank" rel="noreferrer nofollow">
    ${l.image?`<img src="${esc(l.image)}" alt="" loading="lazy" referrerpolicy="no-referrer">`:""}
    <span class="c-lpt"><span class="mono">${esc(l.site||"")}</span>${l.title?`<b>${esc(l.title)}</b>`:""}${l.description?`<i>${esc(l.description)}</i>`:""}</span></a>`;
}
/* A voice note's waveform is decoration seeded from the file name — the
   same message always draws the same shape. */
function voiceHTML(url,ms){
  let h=7;for(const c of url)h=(h*31+c.charCodeAt(0))>>>0;
  const bars=Array.from({length:26},(_,i)=>{h=(h*1103515245+12345)>>>0;return 25+(h%70)});
  return `<div class="c-vn" data-vn="${esc(url)}"><button class="c-vnp" aria-label="Play">${CI.play}</button>
    <span class="c-vnw">${bars.map(b=>`<i style="height:${b}%"></i>`).join("")}</span><span class="mono c-vnd">${mmss(ms)||"0:00"}</span></div>`;
}
const typingHTML=names=>!names.length?"":`<div class="c-typing"><span class="c-dots"><i></i><i></i><i></i></span><span class="mono">${esc(names.length>2?names.length+" people are typing":names.join(" and ")+(names.length>1?" are":" is")+" typing")}</span></div>`;
function typingNames(key){
  const t=TYPING[key]||{},now=Date.now();
  return Object.entries(t).filter(([u,v])=>v.until>now&&u!==myName()).map(([,v])=>v.name);
}

/* ---- one shared audio element for voice notes ---- */
let VNAUDIO=null, VNURL=null;
function playVoice(el){
  const url=el.dataset.vn;
  if(VNAUDIO&&VNURL===url&&!VNAUDIO.paused){VNAUDIO.pause();return}
  if(!VNAUDIO){VNAUDIO=new Audio();VNAUDIO.addEventListener("timeupdate",paintVoice);VNAUDIO.addEventListener("ended",paintVoice);VNAUDIO.addEventListener("pause",paintVoice);VNAUDIO.addEventListener("play",paintVoice)}
  if(VNURL!==url){VNAUDIO.src=url;VNURL=url}
  VNAUDIO.play().catch(()=>toast("Couldn't play that"));
}
function paintVoice(){
  document.querySelectorAll("[data-vn]").forEach(el=>{
    const on=el.dataset.vn===VNURL&&VNAUDIO&&!VNAUDIO.paused;
    el.classList.toggle("on",on);
    el.querySelector(".c-vnp").innerHTML=on?CI.pause:CI.play;
    const p=el.dataset.vn===VNURL&&VNAUDIO&&VNAUDIO.duration?VNAUDIO.currentTime/VNAUDIO.duration:0;
    el.querySelectorAll(".c-vnw i").forEach((b,i,a)=>b.classList.toggle("p",i<p*a.length));
    if(el.dataset.vn===VNURL&&VNAUDIO&&VNAUDIO.duration)el.querySelector(".c-vnd").textContent=mmss((on?VNAUDIO.currentTime:VNAUDIO.duration)*1000);
  });
}

/* ---- the layer everything chat paints into ---- */
function chatLayer(){
  let l=document.getElementById("chatlayer");
  if(!l){l=document.createElement("div");l.id="chatlayer";document.body.appendChild(l)}
  return l;
}
function paintLayer(){
  const l=chatLayer();
  const keep=chatKeep();
  l.innerHTML=(DMOPENPANEL?dmScreenHTML():"")+(CHATSHEET?chatSheetHTML():"")+(CMENU?cmenuHTML():"")
    +(CHATZOOM?`<div class="c-zoom" id="czoom"><img src="${esc(CHATZOOM)}" alt=""></div>`:"");
  document.body.classList.toggle("chat-on",!!DMOPENPANEL);
  paintPlayer();   // a chat covers the page: lab music and post sound pause (musicScope)
  wireLayer();
  chatRestore(keep);
  syncChatHistory();
}
/* Back / swipe-back. While anything chat is open we hold exactly one
   history entry: back closes the innermost thing (zoom, menu, sheet, chat,
   inbox) and re-arms if something is still open. Closing from a button
   consumes the entry quietly, so the app's own back handling never sees it. */
let CHATHIST=false, CHATSWALLOW=false;
const layerOpen=()=>!!(DMOPENPANEL||CHATSHEET||CMENU||CHATZOOM);
function syncChatHistory(){
  if(!CHATHIST&&layerOpen()){CHATHIST=true;try{history.pushState({kind:"chat",tab:TAB},"",location.pathname)}catch(e){}}
  else if(CHATHIST&&!layerOpen()){CHATHIST=false;CHATSWALLOW=true;history.back()}
}
function chatPopstate(){
  if(CHATSWALLOW){CHATSWALLOW=false;return true}
  if(CHATHIST){CHATHIST=false;chatPop();return true}
  return false;
}

/* ---- hold / swipe / double tap — one binder for DMs and labs ----
   Hold (or right-click) opens the menu. Swipe right replies. Double tap
   sends ❤️. Tapping links, buttons and media still does what it says. */
function bindMsgGestures(root,sel,{hold,swipe,dbl}){
  root.querySelectorAll(sel).forEach(el=>{
    if(el.dataset.gb)return;el.dataset.gb="1";
    let t=null,sx=0,sy=0,dx=0,moved=false,lastTap=0,held=false;
    const interactive=e=>e.target.closest("a,button,video,audio,input,textarea,.c-vn");
    el.addEventListener("touchstart",e=>{if(interactive(e))return;const p=e.touches[0];sx=p.clientX;sy=p.clientY;dx=0;moved=false;held=false;
      t=setTimeout(()=>{t=null;if(!moved){held=true;try{navigator.vibrate&&navigator.vibrate(8)}catch(x){};hold(el)}},430)},{passive:true});
    el.addEventListener("touchmove",e=>{const p=e.touches[0];dx=p.clientX-sx;const dy=p.clientY-sy;
      if(Math.abs(dx)>8||Math.abs(dy)>8){moved=true;clearTimeout(t)}
      if(swipe&&dx>0&&Math.abs(dy)<30){el.style.transform=`translateX(${Math.min(dx,72)}px)`;el.classList.toggle("sw",dx>56)}},{passive:true});
    el.addEventListener("touchend",e=>{clearTimeout(t);
      if(swipe&&el.classList.contains("sw"))swipe(el);
      el.style.transform="";el.classList.remove("sw");
      if(!moved&&!held&&dbl&&!interactive(e)){const n=Date.now();if(n-lastTap<300){lastTap=0;dbl(el)}else lastTap=n}});
    el.addEventListener("contextmenu",e=>{if(interactive(e)&&e.target.closest("a"))return;e.preventDefault();hold(el)});
    el.addEventListener("dblclick",e=>{if(!dbl||interactive(e)||("ontouchstart" in window))return;dbl(el)});
  });
}

/* ---- the hold menu ---- */
function cmenuHTML(){const m=CMENU;
  return `<div class="c-mbg" id="cmbg"><div class="c-menu" role="menu">
    ${m.preview?`<div class="c-mprev">${esc(m.preview)}</div>`:""}
    ${m.react?`<div class="c-mrx">${REACTS.map(e=>`<button class="${m.mine===e?"on":""}" data-cme="${e}" aria-label="React ${e}">${e}</button>`).join("")}</div>`:""}
    <div class="c-mlist">${m.actions.map((a,i)=>`<button class="c-ma ${a.danger?"danger":""}" data-cma="${i}" role="menuitem">${a.icon}<span>${esc(a.label)}</span></button>`).join("")}</div>
  </div></div>`}
function openMenu(m){CMENU=m;paintLayer()}
function closeMenu(){if(!CMENU)return;CMENU=null;paintLayer()}
async function copyText(t){try{await navigator.clipboard.writeText(t);toast("Copied")}catch(e){toast("Couldn't copy")}}
