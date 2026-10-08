/* ================================================================
   HISTORY
   Everything lived in memory, so the back button (and iOS swipe-back)
   exited the whole app instead of closing a sheet. That's the single most
   jarring thing about using this on a phone.
   Anything that feels like "a screen" pushes state; back pops it.
================================================================ */
let HISTINIT=false, POPPING=false;
function pushView(kind, val){
  if(POPPING)return;
  const st={kind,val,tab:TAB};
  try{history.pushState(st,"", kind==="profile"?("/u/"+val):kind==="listing"?("/m/"+val):location.pathname);}
  catch(e){/* some in-app browsers block this */}
}
function initHistory(){
  if(HISTINIT)return; HISTINIT=true;
  try{history.replaceState({kind:"root",tab:TAB},"",location.pathname)}catch(e){}
  window.addEventListener("popstate",async()=>{
    if(chatPopstate())return;   // messages, menus and chat sheets handle their own back
    POPPING=true;
    // close whatever's on top, innermost first — same order a person expects
    if(LIGHTBOX){LIGHTBOX=null}
    else if(PICKER){PICKER=null}
    else if(GATE){if(!gateBack())gateClose()}
    else if(EDITING){if(EDITPF&&EDITPF.sub){EDITPF.sub=null;POPPING=false;pushView("profile");render();return}EDITING=false;EDITPF=null;if(ME)applyAccent(ME.accentHex)}
    else if(PCOMPOSE){
      /* Back can't be cancelled once it has fired, so a dirty draft puts its
         history entry back and then asks. "Keep writing" leaves you exactly
         where you were. Discarding costs one redundant entry — a far cheaper
         bug than losing what someone typed. */
      if(pcDirty()||PCOMPOSE.busy){
        POPPING=false; pushView("compose");
        if(await pcLeave())render();
        return;
      }
      PCOMPOSE=null;
    }
    else if(PROFILE){PROFILE=null}
    else if(NOTIFOPEN){NOTIFOPEN=false}
    else if(SEARCHOPEN){SEARCHOPEN=false}
    else if(OPENCOMMENTS){OPENCOMMENTS=null}
    else if(EVENTER){EVENTER=null}
    else if(EVSHARE){EVSHARE=null}
    else if(TAB==="market"&&MKTVIEW==="edit"){MKTEDIT=null;SELLFORM=null;SELLIMGS=[];SELLAUDIO=null;SELLAUDIONAME="";MKTVIEW="detail"}
    else if(TAB==="market"&&MKTVIEW!=="browse"){MKTVIEW="browse";MKTONE=null}
    else if(TAB==="labs"&&(LAB||ROOMOPEN)){ROOMOPEN=false;LAB=null;loadLabs()}
    else if(TAB!=="showroom"){TAB="showroom"}
    else{POPPING=false;return}   // at the root — let the browser leave
    render();
    POPPING=false;
  });
}

/* COMPUTER LAYOUT v1.0 — 2026-09-29. From 1024px wide the top bar and the
   bottom nav move into one left sidebar (styles: app-05-styles-wide.css).
   Phones get exactly the markup they always had. Crossing the line (a window
   resized, a tablet rotated) repaints into the other layout. */
const WIDEQ=typeof window!=="undefined"&&window.matchMedia?window.matchMedia("(min-width:1024px)"):null;
const isWide=()=>!!(WIDEQ&&WIDEQ.matches);
if(WIDEQ&&WIDEQ.addEventListener)WIDEQ.addEventListener("change",()=>{render();paintPlayer()});
function render(){
  const app=$("#app");
  // Guests see the app. Only the explicit door shows the sign-up form.
  if(GATE){app.innerHTML=gateHTML();wireGate();return}
  GFLOW=null; // the gate closed from somewhere else — next open starts fresh
  /* A repaint rebuilds every scroller. mvBefore/mvAfter (app-09-motion.js)
     remember each screen's place — same screen, or coming back to it — and
     move what changed. */
  const mvb=mvBefore(app);
  const vk=vKeep(app);   // videos carry on through the repaint (app-18-media)
  const W=isWide();
  document.body.classList.toggle("wide",W);
  app.innerHTML=`
    ${W?`<aside class="side">${topHTML()}${navHTML()}</aside>`:topHTML()}
    ${SITE.announcement?`<div class="announce">${rich(SITE.announcement)}</div>`:""}
    ${(ME&&!ME.emailVerified)?`<div class="verifybar">
      <span>Check <b>${esc(ME.email)}</b> to confirm your account. You can look around meanwhile.</span>
      <button class="vb-btn" id="resendb">Resend</button>
      ${VERIFYURL?`<a class="vb-btn" href="${esc(VERIFYURL)}" target="_blank">Open link</a>`:""}
    </div>`:""}
    <div class="content">${PCOMPOSE?pcomposeHTML():MYPAGE()?sheetHTML():TAB==="showroom"?showroomHTML():TAB==="labs"?labsHTML():TAB==="market"?marketHTML():TAB==="event"?eventHTML():studioHTML()}</div>
    ${W?"":navHTML()}
    ${(PROFILE&&!MYPAGE())?sheetHTML():""}
    ${NOTIFOPEN?notifPanelHTML():""}
    ${SEARCHOPEN?searchPanelHTML():""}
    ${PICKER?pickerHTML():""}
    ${BOARDSOPEN?boardsHTML():""}
    ${REVIEWING?reviewHTML():""}
    ${CLIMB?climbHTML():""}
    ${TRKEDIT?trkEditHTML():""}
    ${POSTOPEN?postOpenHTML():""}
    ${LIGHTBOX?`<div class="lightbox" id="lb"><img src="${esc(LIGHTBOX)}" alt="full size"></div>`:""}
    ${installCardHTML()}
    ${ENTER?enterHTML():""}`;
  vRestore(app,vk);
  mvAfter(mvb);
  wire();
  wireEnter();
  if(TAB==="labs")loadFeed();
  if(TAB==="showroom")loadShowroom();
  if(TAB==="market"&&MKTVIEW==="browse"&&!MKT)loadMarket();
  if(TAB==="studio"||(TAB==="labs"&&CH.beatlab))setTimeout(mountStudio,0);
  if(TAB==="labs"&&CH.library&&!TRACKS)loadTracks();
}
function topHTML(){
  if(guest())return `
  <div class="top">
    <div class="brand"><img class="mark" src="data:image/png;base64,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" alt="TNL"><span class="bt">LABS</span> <span class="fl">🧪</span></div>
    <div class="topact">
      <button class="ib" id="searchBtn" aria-label="Search">${UI_IC.search}</button>
      ${/* The only theme switch lived in Edit profile, behind an account. A
            visitor arriving from a DM had no way to change it — the landing
            followed prefers-color-scheme and then stayed put. The existing
            [data-theme-set] delegate wires this for free. */""}
      <button class="ib" data-theme-set="${THEME==="light"?"dark":"light"}"
        aria-label="${THEME==="light"?"Switch to night":"Switch to day"}">${THEME==="light"?UI_IC.moon:UI_IC.sun}</button>
      <button class="btn sm ghost" id="loginBtn">Sign in</button>
      <button class="btn sm green" id="joinBtn">Join</button>
    </div>
  </div>`;
  const l=levelFor(ME.rep);return `
  <div class="top">
    <div class="brand"><img class="mark" src="data:image/png;base64,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" alt="TNL"><span class="bt">LABS</span> <span class="fl">🧪</span></div>
    <div class="topact">
      <button class="ib" id="searchBtn" aria-label="Search">${UI_IC.search}</button>
      ${/* Glyphs, matching the nav and the lab list. Kept SEMANTIC rather than
            purely geometric: the top bar has no text labels under it, so an
            abstract mark here would be an unlabelled mystery button. \uFE0E forces
            text presentation so iOS draws them as type, not colour emoji. */""}
      ${/* Night/Day for members too — it used to live only in Edit profile. */""}<button class="ib" data-theme-set="${THEME==="light"?"dark":"light"}" aria-label="${THEME==="light"?"Switch to night":"Switch to day"}">${THEME==="light"?UI_IC.moon:UI_IC.sun}</button>
      <button class="ib gly" id="dmBtn" aria-label="Messages">${UI_IC.dm}${DMUNREAD?`<span class="badge">${DMUNREAD>9?"9+":DMUNREAD}</span>`:""}</button>
      <button class="ib gly" id="notifBtn" aria-label="Notifications">${UI_IC.bell}${UNREAD?`<span class="badge">${UNREAD>9?"9+":UNREAD}</span>`:""}</button>
    </div>
  </div>`}

function notifPanelHTML(){
  const label=n=>({like:"liked your work",comment:"commented",collab_invite:"wants to collab",collab_accept:"accepted your collab",follow:"followed you",share:"shared your work",dm:"messaged you",reply:"replied to you",mention:"mentioned you",tag:"tagged you in a post",price_drop:"dropped a price you saved"})[n.kind]||n.kind;
  return `<div class="sheet" id="npbg"><div class="sheetc">
    <div class="sheeth"><div><h2>Notifications</h2></div><button class="x" id="npx" aria-label="Close"><svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="square" stroke-linejoin="miter" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg></button></div>
    ${!NOTIFS?`${skel()}`:!NOTIFS.length?`<div class="empty">Nothing yet.<br>Post work and it starts here.</div>`:
      NOTIFS.map(n=>`<div class="nrow ${n.read?"":"unread"}" ${n.kind==="event"?`data-nev="1"`:n.kind==="dm"&&n.actor?`data-ndm="${esc(n.actor.username)}"`:n.postId?`data-nopen="${n.postId}"`:n.actor?`data-u="${esc(n.actor.username)}"`:""}>
        ${n.actor?avHTML({displayName:n.actor.displayName,avatarUrl:n.actor.avatarUrl},"sm"):`<div class="av sm">·</div>`}
        <div class="nbody"><b>${n.kind==="event"?"// Event":esc(n.actor?n.actor.displayName:"Someone")}</b> ${n.kind==="event"?"":label(n)}
        ${n.body?`<div class="nsnip">${esc(n.body)}</div>`:""}
        <div class="mono dim">${timeAgo(n.createdAt)}</div></div>
        ${n.read?"":`<span class="ndot"></span>`}
      </div>`).join("")}
  </div></div>`}

async function openProfile(username){
  // Open the sheet on the same tick as the tap. Waiting for the network
  // before showing anything is what made this feel broken.
  pushView("profile",username);
  SEARCHOPEN=false; NOTIFOPEN=false; if(DMOPENPANEL)closeMessages();
  PTAB="work"; EDITING=false; EDITPF=null; PROFLISTINGS=null; PROFTAGGED=null; PROFTAGLOAD=null;
  const cached=PROFCACHE.get(username);
  PROFILE=cached||{loading:true,user:{username,displayName:username,avatarUrl:"",role:"",roles:[],rep:0,bio:"",link:"",createdAt:Date.now()},
    followers:0,following:0,youFollow:false,stats:{posts:0,likesReceived:0,collabs:0},posts:[],collabs:[]};
  render();
  try{
    const d=await api.profile(username);
    PROFCACHE.set(username,d);
    if(PROFILE&&PROFILE.user.username===username){PROFILE=d;render()}
  }catch(e){
    if(PROFILE&&PROFILE.user.username===username){PROFILE=null;render();toast(e.message)}
  }
}
const PROFCACHE=new Map();

function pickerHTML(){
  if(!PICKER)return "";
  const P=PICKER;
  return `<div class="pick" id="pickbg"><div class="pickc">
    <div class="pickh"><div><div class="mono dim">${esc(P.eyebrow||"")}</div><h2>${esc(P.title)}</h2></div>
      <button class="x" id="pickx" aria-label="Close"><svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="square" stroke-linejoin="miter" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg></button></div>
    ${P.note?`<div class="mono dim picknote">${esc(P.note)}</div>`:""}
    ${P.search?`<input class="in" id="pickq" placeholder="${esc(P.search)}" value="${esc(P.q||"")}">`:""}
    <div class="picklist">
      ${P.loading?`${skel()}`
      :P.items.length?P.items.map((it,i)=>`<button class="pickrow" data-pick="${i}">
        ${it.avatar!==undefined?avHTML({displayName:it.label,avatarUrl:it.avatar},"sm"):`<span class="pickic${it.icon==="//"?" mk":""}">${/^<svg class="di"/.test(it.icon||"")?it.icon:esc(it.icon||"#")}</span>`}
        <div class="pickbody"><b>${esc(it.label)}</b>${it.sub?`<div class="mono dim">${esc(it.sub)}</div>`:""}</div>
      </button>`).join(""):`<div class="empty">${esc(P.empty||"Nothing here.")}</div>`}
    </div>
  </div></div>`}

function openPicker(cfg){pushView("picker");PICKER=Object.assign({items:[]},cfg);render();}
function closePicker(){PICKER=null;render();}

