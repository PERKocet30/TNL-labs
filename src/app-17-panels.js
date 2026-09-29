/* Every [data-u] on screen becomes a tappable profile link. This has to be
   callable from ANY code path that injects HTML — search results, feeds,
   comments, the DM list. It used to live inside wireFeed() only, which is
   why searching for someone and tapping their name did nothing: the search
   panel repaints itself and never called wireFeed. */
function wireProfileLinks(root){
  (root||document).querySelectorAll("[data-u]").forEach(el=>{
    if(el.dataset.uBound)return;          // don't stack listeners on repaint
    el.dataset.uBound="1";
    el.onclick=e=>{e.stopPropagation();openProfile(el.dataset.u)};
  });
}

function wirePanels(){
  wireProfileLinks();
  // notifications
  const npb=$("#npbg");if(npb)npb.onclick=e=>{if(e.target===npb){NOTIFOPEN=false;render()}};
  const npx=$("#npx");if(npx)npx.onclick=()=>{NOTIFOPEN=false;render()};
  document.querySelectorAll("[data-nopen]").forEach(el=>el.onclick=async()=>{
    NOTIFOPEN=false;const id=+el.dataset.nopen;
    OPENCOMMENTS=id;try{COMMENTS=(await api.comments(id)).comments}catch(e){}
    TAB="showroom";render()});

  // dms → the messages layer (app-10-chat-*.js); a DM notification opens the chat
  document.querySelectorAll("[data-ndm]").forEach(el=>el.onclick=()=>{NOTIFOPEN=false;render();openDM(el.dataset.ndm)});

  // search
  const sbg=$("#sbg");if(sbg)sbg.onclick=e=>{if(e.target===sbg){SEARCHOPEN=false;render()}};
  const sx=$("#sx");if(sx)sx.onclick=()=>{SEARCHOPEN=false;render()};
  const sq=$("#sq");if(sq){let t=null;sq.oninput=()=>{
    SEARCHQ=sq.value;clearTimeout(t);
    if(!SEARCHQ.trim()&&!SEARCHROLE){SEARCHRES=null;SEARCHING=false;return renderSearchOnly()}
    SEARCHING=true;renderSearchOnly();
    t=setTimeout(async()=>{
      const mine=SEARCHQ;
      try{const r=await api.search(SEARCHQ,SEARCHROLE);
        if(mine!==SEARCHQ)return;            // a newer keystroke won
        SEARCHRES=r;SEARCHING=false;renderSearchOnly();
      }catch(e){SEARCHING=false;renderSearchOnly()}
    },250)}}
  document.querySelectorAll("[data-sr]").forEach(b=>b.onclick=async()=>{
    SEARCHROLE=SEARCHROLE===b.dataset.sr?"":b.dataset.sr;
    SEARCHING=true;renderSearchOnly();
    try{SEARCHRES=await api.search(SEARCHQ,SEARCHROLE)}catch(e){}
    SEARCHING=false;renderSearchOnly()});
}
function renderSearchOnly(){
  const c=document.querySelector("#sbg .sheetc");if(!c)return;
  const val=$("#sq")?.value||"";
  c.innerHTML=searchPanelHTML().replace(/^<div class="sheet" id="sbg"><div class="sheetc">/,"").replace(/<\/div><\/div>$/,"");
  const sq=$("#sq");if(sq){sq.value=val;sq.focus();sq.setSelectionRange(val.length,val.length)}
  wirePanels();
}
/* openDM → app-10-chat-3-wire.js (messaging v2) */
let PENDFILE=null, PENDPREP=null, UPPROG=null, UPLOADXHR=null;

/* The Studio is 80KB+ and most visits never open it, so it no longer blocks
   the first paint: it loads in the background after boot, or on first use. */
let STUDIOLOAD=null;
function ensureStudio(){
  if(window.TNLStudio)return Promise.resolve();
  if(!STUDIOLOAD)STUDIOLOAD=new Promise((ok,no)=>{
    const s=document.createElement("script");s.src="/studio.js";
    s.onload=ok;s.onerror=()=>{STUDIOLOAD=null;no(new Error("studio didn't load"))};
    document.head.appendChild(s)});
  return STUDIOLOAD;
}
function withStudio(fn){ensureStudio().then(fn,()=>toast("Couldn't load the Studio — check your connection"))}

function mountStudio(){
  const el=$("#studiomount");
  if(!el)return;
  if(!window.TNLStudio)return withStudio(()=>{if($("#studiomount"))mountStudio()});
  TNLStudio.mount(el,{
    api,
    toast,
    onPublish:()=>{TAB="labs";LAB=LABS.find(l=>l.id==="culture");CH=LAB.channels.find(c=>c.id==="beats");ROOMOPEN=true;render()},
    uploadAudio:async(blob)=>{
      const up=await uploadStream(blob);   // streamed — a kit file can be big
      return up.url;
    },
    // metadata only — never the audio. see studio_events in db.js.
    event:(kind,d)=>{ if(!ME)return;
      req("/api/studio/event",{method:"POST",body:{kind,...d}}).catch(()=>{}) },
  });
}

/* Autoplay, the way a feed should do it: muted when it scrolls into view,
   paused the moment it leaves. Muted is not a style choice — browsers block
   autoplay WITH sound, so an unmuted autoplay simply never starts.

   One observer, rebuilt each render (the DOM is replaced wholesale), and
   disconnected first so observers don't pile up on every repaint. */
let VOBS=null;
/* Carousels. CSS scroll-snap does the swiping — no library, no drag maths,
   and it inherits momentum scrolling for free. This just keeps the dots and
   the counter honest about where you are. */
