/* TOP BAR v1.1 — 2026-10-20: search · messages · bell, no emoji; day/night lives in the profile menu */
/* HISTORY → app-09-nav.js (one trail of screens, 2026-10-12) */
/* COMPUTER LAYOUT v1.0 — 2026-09-29. From 1024px wide the top bar and the
   bottom nav move into one left sidebar (styles: app-05-styles-wide.css).
   Phones get exactly the markup they always had. Crossing the line (a window
   resized, a tablet rotated) repaints into the other layout. */
const WIDEQ=typeof window!=="undefined"&&window.matchMedia?window.matchMedia("(min-width:1024px)"):null;
const isWide=()=>!!(WIDEQ&&WIDEQ.matches);
if(WIDEQ&&WIDEQ.addEventListener)WIDEQ.addEventListener("change",()=>{render();paintPlayer()});
function render(){
  navTrack();   // every screen change joins the back trail (app-09-nav.js)
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
    ${(ME&&ME.fixEmail)?`<div class="verifybar"><span>Your email is a temporary inbox. Add a real one to post, vote and like.</span>
      <input class="vb-in" id="fixemail" type="email" placeholder="you@email.com" autocomplete="email"><button class="vb-btn" id="fixemailb">Save</button></div>`
    :(ME&&!ME.emailVerified)?`<div class="verifybar">
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
    ${REVIEWING?reviewHTML():""}
    ${CLIMB?climbHTML():""}
    ${TRKEDIT?trkEditHTML():""}
    ${POSTOPEN&&!(PFTOP&&PROFILE)?postOpenHTML():""}
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
    <div class="brand"><img class="mark wm" src="/labs-wordmark.png" alt="LABS"></div>
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
    <div class="brand"><img class="mark wm" src="/labs-wordmark.png" alt="LABS"></div>
    <div class="topact">
      <button class="ib" id="searchBtn" aria-label="Search">${UI_IC.search}</button>
      ${/* Glyphs, matching the nav and the lab list. Kept SEMANTIC rather than
            purely geometric: the top bar has no text labels under it, so an
            abstract mark here would be an unlabelled mystery button. \uFE0E forces
            text presentation so iOS draws them as type, not colour emoji. */""}
      ${/* Day/night lives in the profile menu (one kit, 2026-10-20): the top bar is search · messages · bell. */""}
      <button class="ib gly" id="dmBtn" aria-label="Messages">${UI_IC.dm}${DMUNREAD?`<span class="badge">${DMUNREAD>9?"9+":DMUNREAD}</span>`:""}</button>
      <button class="ib gly" id="notifBtn" aria-label="Notifications">${UI_IC.bell}${UNREAD?`<span class="badge">${UNREAD>9?"9+":UNREAD}</span>`:""}</button>
    </div>
  </div>`}

/* notifPanelHTML: app-17-notifs.js (2026-10-12) */
async function openProfile(username){
  // Open the sheet on the same tick as the tap. Waiting for the network
  // before showing anything is what made this feel broken.
  pushView("profile",username);
  SEARCHOPEN=false; NOTIFOPEN=false; if(DMOPENPANEL)closeMessages();
  PTAB="work"; EDITING=false; EDITPF=null; PROFLISTINGS=null;
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
        ${it.avatar!==undefined?avHTML(it.person||{displayName:it.label,avatarUrl:it.avatar},"sm"):`<span class="pickic${it.icon==="//"?" mk":""}">${/^<svg class="di"/.test(it.icon||"")?it.icon:esc(it.icon||"#")}</span>`}
        <div class="pickbody"><b>${esc(it.label)}</b>${it.sub?`<div class="mono dim">${esc(it.sub)}</div>`:""}</div>
      </button>`).join(""):`<div class="empty">${esc(P.empty||"Nothing here.")}</div>`}
    </div>
  </div></div>`}

function openPicker(cfg){pushView("picker");PICKER=Object.assign({items:[]},cfg);render();}
function closePicker(){PICKER=null;render();}

