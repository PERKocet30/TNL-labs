/* ================================================================
   BACK · v2.1 — 2026-10-12 (v2.1: a playlist is a screen too) ("make sure the app is easily navigable —
   back buttons and everything need to move through all sections")
   One trail of screens, the way Instagram keeps it. Every screen you open
   — a post, a profile, a lab, a #tag, a listing, your orders, an event,
   notifications, search, another tab, a picture full size — is a step on
   it, and every way of going back walks the same trail: the phone's back
   and swipe-back, the app's ‹ and ✕. Profile → post → their friend's
   profile → back, back, back lands exactly where you started.

   How: render() calls navTrack() first. When what's on screen changes it
   remembers the screen you left (navSnap) and adds a history entry that
   knows its place on the trail (state.nav). Back restores that screen.
   Closing something with the app's own ‹ / ✕ lands on the screen one step
   up, so it is a back too — the entry goes with it, and the phone's back
   never has to be pressed twice. Nothing has to call pushView to be on
   the trail; only the sign-up door, the post maker and Edit profile still
   do (they own their back: a draft asks first, the door steps back).
================================================================ */
let HISTINIT=false, POPPING=false;
let NAVS=[], NAVD=0, NAVPREV=null, NAVSWALLOW=0;
function navSnap(){return {TAB,PROFILE,PTAB,POSTOPEN,NOTIFOPEN,SEARCHOPEN,LAB,ROOMOPEN,LABVIEW,LABTAG,TAGVIEW,
  MKTVIEW,MKTONE,MKTOFFERS,MKTSELLER,MKTSIMILAR,ORDTAB,EVSLUG,EVENTER,EVSHARE,REVIEWING,PFTOP,MUSVIEW,PLIST,LB:!!LIGHTBOX,PK:!!PICKER}}
/* What makes one screen a different screen. Switching Work/Talk inside a
   lab, or a listing's details arriving, is the same screen. */
function navKey(s){return [s.TAB,s.PROFILE&&s.PROFILE.user?s.PROFILE.user.username:"",s.POSTOPEN?s.POSTOPEN.id:"",
  s.NOTIFOPEN?1:"",s.SEARCHOPEN?1:"",
  s.TAB==="labs"?(s.TAGVIEW?"#"+s.TAGVIEW.tag:s.LAB&&s.ROOMOPEN?s.LAB.id+(s.PLIST?":pl"+s.PLIST.id:""):""):"",
  s.TAB==="market"||s.TAB==="buying"?s.MKTVIEW+(s.MKTVIEW==="detail"?":"+(s.MKTONE?s.MKTONE.id:"*"):""):"",
  s.TAB==="event"?s.EVSLUG:"",s.EVENTER?1:"",s.EVSHARE?1:"",s.REVIEWING?1:"",s.LB?1:"",s.PK?1:""].map(String)}
/* "detail:*" is a listing still loading — the same screen as the one it becomes. */
const navSame=(a,b)=>a.every((v,i)=>v===b[i]||(/:\*$/.test(v)||/:\*$/.test(b[i]))&&v.split(":")[0]===b[i].split(":")[0]);
const navUrl=s=>s.POSTOPEN?"/":s.PROFILE&&s.PROFILE.user?"/u/"+s.PROFILE.user.username
  :(s.TAB==="market"&&s.MKTVIEW==="detail"&&s.MKTONE)?"/m/"+s.MKTONE.id:"/";
function navEntry(s){NAVS[NAVD]=s;NAVS.length=NAVD+1;NAVD++;
  try{history.pushState({nav:NAVD},"",navUrl(navSnap()))}catch(e){/* some in-app browsers block this */}}
/* Going back is asynchronous and pushing isn't: closing one menu and
   opening the next in the same tap would push before the back lands. So
   backs gather into one history.go(-n) on the next tick, and anything
   opened meanwhile waits (NAVWAIT) until it has landed. */
let NAVGO=0, NAVBUSY=false, NAVWAIT=[];
/* A profile opened from an open post comes up on top of it (it used to
   open underneath — tapping the artist looked like nothing happened); a
   post opened from a profile goes on top of that. Whichever came last. */
let PFTOP=false, NAVPF="", NAVPO=null;
function navLayer(){
  const u=PROFILE&&PROFILE.user?PROFILE.user.username:"",po=POSTOPEN?POSTOPEN.id:null;
  if(!POPPING){if(!u||!po)PFTOP=false;else if(u!==NAVPF)PFTOP=true;else if(po!==NAVPO)PFTOP=false}
  NAVPF=u;NAVPO=po;
}
function navTrack(){
  navLayer();
  if(!HISTINIT||GATE||EDITING||PCOMPOSE)return;   // those keep their own entries
  const now=navSnap(),left=NAVPREV;
  NAVPREV=now;
  if(POPPING||!left)return;
  const k=navKey(now);
  if(navSame(k,navKey(left)))return;   // same screen: data arrived, an in-screen tab
  /* Closed with the app's own ‹ / ✕ — back to the screen one step up. */
  const w=NAVWAIT[NAVWAIT.length-1];
  if(w){if(navSame(k,navKey(w))){NAVWAIT.pop();return}}
  else if(NAVD>0&&navSame(k,navKey(NAVS[NAVD-1]))){NAVD--;NAVGO++;if(NAVGO===1&&!NAVBUSY)setTimeout(navFlush,0);return}
  if(NAVGO||NAVBUSY)NAVWAIT.push(left);else navEntry(left);
}
function navFlush(){if(!NAVGO)return;const n=NAVGO;NAVGO=0;NAVBUSY=true;NAVSWALLOW++;try{history.go(-n)}catch(e){NAVBUSY=false;NAVSWALLOW--}}
function navLanded(){NAVBUSY=false;if(NAVGO)return navFlush();const w=NAVWAIT;NAVWAIT=[];w.forEach(navEntry)}
/* The door, the post maker and Edit profile. Other kinds are on the trail already. */
function pushView(kind){if(POPPING||!HISTINIT||!/^(gate|compose|edit)$/.test(kind))return;if(NAVGO||NAVBUSY)NAVWAIT.push(navSnap());else navEntry(navSnap())}
/* Put back the entry a popstate just used (a draft that wants to stay). */
function navRearm(d){NAVD=d+1;try{history.pushState({nav:NAVD},"",location.pathname)}catch(e){}}
/* Back to a screen from the trail, and whatever it needs to show again. */
function navRestore(s){
  const wasTab=TAB,wasLab=LAB&&LAB.id,wasView=LABVIEW,wasPost=POSTOPEN&&POSTOPEN.id,wasEv=EVSLUG;
  TAB=s.TAB;PROFILE=s.PROFILE;PTAB=s.PTAB;POSTOPEN=s.POSTOPEN;OPENCOMMENTS=s.POSTOPEN?s.POSTOPEN.id:null;
  NOTIFOPEN=s.NOTIFOPEN;SEARCHOPEN=s.SEARCHOPEN;LAB=s.LAB;ROOMOPEN=s.ROOMOPEN;LABVIEW=s.LABVIEW;LABTAG=s.LABTAG;TAGVIEW=s.TAGVIEW;
  MKTVIEW=s.MKTVIEW;MKTONE=s.MKTONE;MKTOFFERS=s.MKTOFFERS;MKTSELLER=s.MKTSELLER;MKTSIMILAR=s.MKTSIMILAR;ORDTAB=s.ORDTAB;
  EVSLUG=s.EVSLUG;PFTOP=!!s.PFTOP;MUSVIEW=s.MUSVIEW||"songs";if((PLIST&&PLIST.id)!==(s.PLIST&&s.PLIST.id))PLADD=null;PLIST=s.PLIST;EVENTER=s.EVENTER;EVSHARE=s.EVSHARE;REVIEWING=s.REVIEWING;LIGHTBOX=null;PICKER=null;EDITING=false;EDITPF=null;
  if(MKTEDIT&&MKTVIEW!=="edit"){MKTEDIT=null;SELLFORM=null;SELLIMGS=[];SELLAUDIO=null;SELLAUDIONAME=""}
  if(wasTab==="studio"&&TAB!=="studio"&&window.TNLStudio)TNLStudio.unmount();
  if(TAB==="labs"&&LAB&&ROOMOPEN&&(wasTab!=="labs"||LAB.id!==wasLab||LABVIEW!==wasView)){placeCH();setTimeout(loadPlace,0)}
  else if(TAB==="labs"&&!LAB&&!TAGVIEW&&(wasLab||wasTab!=="labs"))loadLabs();
  if(TAB==="event"&&EVSLUG&&(EVSLUG!==wasEv||!EV))loadEvent();
  if(POSTOPEN&&POSTOPEN.id!==wasPost){const id=POSTOPEN.id;COMMENTS=[];
    api.comments(id).then(r=>{if(POSTOPEN&&POSTOPEN.id===id){COMMENTS=r.comments;render()}}).catch(()=>{})}
}
function initHistory(){
  if(HISTINIT)return; HISTINIT=true;
  const now=navSnap(),path=location.pathname+location.search;
  /* Opened on a post, a profile or a listing from a link: the Showroom goes
     underneath, so back lands in the app instead of leaving it. */
  const home=Object.assign({},now,{TAB:"showroom",PROFILE:null,POSTOPEN:null,NOTIFOPEN:false,SEARCHOPEN:false,LAB:null,ROOMOPEN:false,TAGVIEW:null,MKTVIEW:"browse",MKTONE:null,EVENTER:null,EVSHARE:null,REVIEWING:null,LB:false,PK:false});
  if(!navSame(navKey(now),navKey(home))){
    NAVS=[home];NAVD=1;
    try{history.replaceState({nav:0},"","/");history.pushState({nav:1},"",path)}catch(e){NAVS=[];NAVD=0}
  }else{try{history.replaceState({nav:0},"",path)}catch(e){}}
  NAVPREV=now;
  window.addEventListener("popstate",async e=>{
    if(chatPopstate())return;   // messages, menus and chat sheets hold their own one entry
    if(NAVSWALLOW){NAVSWALLOW--;navLanded();return}   // the app's ‹ / ✕ already went back
    const d=e.state&&typeof e.state.nav==="number"?e.state.nav:0;
    POPPING=true;let acted=false;
    try{
      if(GATE){if(gateBack()){render();return}gateClose();acted=true}
      else if(EDITING&&EDITPF&&EDITPF.sub){EDITPF.sub=null;navRearm(d);render();return}
      else if(EDITING){EDITING=false;EDITPF=null;if(ME)applyAccent(ME.accentHex);acted=true}
      else if(PCOMPOSE){
        /* Back can't be cancelled once it has fired, so a dirty draft puts its
           history entry back and then asks. "Keep writing" leaves you exactly
           where you were. */
        if(pcDirty()||PCOMPOSE.busy){navRearm(d);POPPING=false;if(await pcLeave())render();return}
        PCOMPOSE=null;acted=true;
      }
      const before=navKey(navSnap()),s=NAVS[d];
      NAVD=d;
      if(s)navRestore(s);
      else if(!acted&&d===0){LIGHTBOX=null;PICKER=null;POSTOPEN=null;PROFILE=null;NOTIFOPEN=false;SEARCHOPEN=false}
      render();NAVPREV=navSnap();
      /* Nothing moved: this entry was for something already closed. Keep going. */
      if(!acted&&d>0&&navSame(before,navKey(NAVPREV))){POPPING=false;try{history.back()}catch(x){}}
    }finally{POPPING=false}
  });
}
/* For the app's own back buttons: step back on the trail, or do `orElse`
   when there's nowhere to step back to. */
function navBack(orElse){if(NAVD>0){try{history.back();return}catch(e){}}if(orElse)orElse();render()}
