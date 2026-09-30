/* MOTION v1.0 — 2026-09-30
   What makes the app feel like it moves instead of flipping between still
   pictures. render() calls mvBefore() / mvAfter() around every repaint; the
   chat layer calls mvLayer(). Styles: app-05-styles-motion.css.

     · every screen keeps its scroll place: back from a profile, a post or
       another tab lands where you were (not at the top)
     · screens move: deeper slides in from the right, back from the left,
       tab to tab fades
     · overlays come in: drawers from the side, sheets from the bottom, the
       opened post, the photo viewer, messages, the toast
     · tap the tab you're on → glide to the top
     · double-tap a post's picture → like it, with a heart
     · pictures fade in instead of popping; loading is a shimmer, not text

   Only transform and opacity move, so nothing here can shift the layout
   (the glitch watcher would call that a screen jump). Reduced motion turns
   all of it off. */
const MV={key:"",depth:0,tab:"",scrolls:{},over:{},overAt:{},layer:{},cAt:0,cCls:""};
const MV_MS=400;   // longest arrival; a repaint inside this carries the move on
const mvReduced=()=>{try{return matchMedia("(prefers-reduced-motion: reduce)").matches}catch(e){return false}};

/* What the main area shows. An overlay (another person's profile, a post, a
   sheet) is not a new screen: the feed under it keeps its place. */
function mvKey(){
  if(PCOMPOSE)return "compose";
  if(MYPAGE())return "me";
  return [TAB,TAB==="labs"?[ROOMOPEN,LAB&&LAB.id,CH&&CH.id].join("/"):"",TAB==="market"?MKTVIEW:""].join("|");
}
function mvDepth(){
  if(PCOMPOSE)return 2;
  if(TAB==="labs"&&ROOMOPEN&&!MYPAGE())return 1;
  if(TAB==="market"&&MKTVIEW&&MKTVIEW!=="browse"&&!MYPAGE())return 1;
  return 0;
}
const mvTop=()=>(PCOMPOSE?"compose":MYPAGE()?"me":TAB)+"";

/* Before the repaint: remember where every scroller on this screen is. */
function mvBefore(app){
  const saved=[...app.querySelectorAll(".content [id], .content .sheet")].filter(e=>e.scrollTop>0)
    .map(e=>[e.id||".sheet",e.scrollTop]);
  if(MV.key)MV.scrolls[MV.key]=saved;
  return {prevKey:MV.key,prevDepth:MV.depth,prevTop:MV.tab};
}
/* After: put the place back, and move whatever just changed. */
function mvAfter(b){
  const key=mvKey(),depth=mvDepth(),top=mvTop(),same=key===b.prevKey;
  for(const [id,y] of (MV.scrolls[key]||[])){
    // lab rooms and chats keep their own stick-to-the-newest scrolling
    if(!same&&(id==="feed"||id==="cxfeed"))continue;
    const e=id===".sheet"?document.querySelector(".content .sheet"):document.getElementById(id);
    if(e)e.scrollTop=y;
  }
  MV.key=key;MV.depth=depth;MV.tab=top;
  const anim=!mvReduced()&&b.prevKey;
  /* A repaint in the middle of a move (data arriving a beat after you
     tapped) would restart it or snap it into place. Carry it on instead:
     same class, started as far back as the move has already run. */
  const carry=(el,cls,at)=>{const t=Date.now()-at;if(!el||t>=MV_MS)return;
    el.classList.add(cls);if(t>0)el.style.setProperty("--mvd",(-t)+"ms")};
  const c=document.querySelector("#app .content");
  if(anim&&!same){
    MV.cCls=depth>b.prevDepth?"mv-fwd":depth<b.prevDepth?"mv-back":"mv-fade";MV.cAt=Date.now();
    carry(c,MV.cCls,MV.cAt);
  }else if(anim&&MV.cCls)carry(c,MV.cCls,MV.cAt);
  /* overlays: animate in only on the repaint that opened them */
  const O=[
    [".sheet:not(.astab)",PROFILE&&!MYPAGE()?"p":""],["#npbg",NOTIFOPEN?"n":""],["#sbg",SEARCHOPEN?"s":""],
    ["#bbg",BOARDSOPEN?"b":""],["#revbg",REVIEWING?"r":""],[".pick",PICKER?"k:"+(PICKER.title||""):""],
    [".po-ov",POSTOPEN?"o:"+POSTOPEN.id:""],[".lightbox",LIGHTBOX||""],["#trkeov",TRKEDIT?"t":""],
    [".climb",CLIMB?"c":""]];   // the toast animates itself (toast())
  for(const [sel,k] of O){
    if(k&&MV.over[sel]!==k)MV.overAt[sel]=Date.now();
    if(k&&!mvReduced())carry(document.querySelector("#app "+sel),"mv-in",MV.overAt[sel]||0);
    MV.over[sel]=k;
  }
}
/* The chat layer paints itself (paintLayer); same idea there. */
function mvLayer(){
  const dm=DMOPENPANEL?"1":"",th=DMOPENPANEL&&CHAT?"1":"";
  if(dm&&!MV.layer.dm)MV.layer.at=Date.now(),MV.layer.cls="in";
  else if(dm&&th!==MV.layer.th)MV.layer.at=Date.now(),MV.layer.cls=th?"tf":"tb";
  const t=Date.now()-(MV.layer.at||0);
  if(dm&&!mvReduced()&&t<MV_MS){   // the chat repaints often (typing, arrivals): carry the move on
    const cx=document.querySelector("#chatlayer .cx"),inn=cx&&cx.querySelector(".cx-in");
    const el=MV.layer.cls==="in"?cx:inn;
    if(el){el.classList.add(MV.layer.cls==="in"?"mv-in":"mv-"+MV.layer.cls);if(t>0)el.style.setProperty("--mvd",(-t)+"ms")}
  }
  MV.layer.dm=dm;MV.layer.th=th;
}

/* Tap the tab you're already on → glide to the top (Instagram). Capture
   phase, so the tab's own handler (a repaint that keeps your place) doesn't
   run and undo the glide. Deeper screens (a lab room, a listing) keep their
   normal tab behaviour: back to the index. */
document.addEventListener("click",e=>{
  const b=e.target&&e.target.closest?e.target.closest("[data-tab]"):null;
  if(!b||b.closest(".pig-theme"))return;
  const t=b.dataset.tab;
  const here=(t==="profile"&&MYPAGE())||(t===TAB&&!PROFILE&&!PCOMPOSE&&mvDepth()===0&&t!=="post"&&t!=="profile");
  if(!here)return;
  const s=[...document.querySelectorAll("#app .content [id], #app .content .sheet, #app .content .scroll")].find(x=>x.scrollTop>0);
  if(!s)return;
  e.stopImmediatePropagation();e.preventDefault();
  s.scrollTo({top:0,behavior:mvReduced()?"auto":"smooth"});
},true);

/* Double-tap a post's picture to like it. A single tap still opens the
   artist's profile, a beat later (that's the wait for a second tap). Lab
   chat rows have their own double-tap (a ❤️ reaction) and no like button,
   so they're left alone. */
let MVDT={card:null,t:0,timer:null};
const MV_MEDIA=".sr-img,.caro-i,.post-img,.gimg";
document.addEventListener("click",e=>{
  const m=e.target&&e.target.closest?e.target.closest(MV_MEDIA):null;
  if(!m)return;
  const card=m.closest(".sr-card,.post");
  const like=card&&card.querySelector("[data-like]");
  if(!like)return;
  e.stopImmediatePropagation();e.preventDefault();
  const now=Date.now();
  if(MVDT.card===card&&now-MVDT.t<300){
    clearTimeout(MVDT.timer);MVDT={card:null,t:0,timer:null};
    mvHeart(m);
    if(!like.classList.contains("on"))like.click();
    return;
  }
  clearTimeout(MVDT.timer);
  MVDT={card,t:now,timer:setTimeout(()=>{MVDT.card=null;if(m.isConnected&&m.dataset.u)openProfile(m.dataset.u)},280)};
},true);
function mvHeart(over){
  const r=over.getBoundingClientRect(),h=document.createElement("div");
  h.className="mv-heart";h.setAttribute("aria-hidden","true");
  h.style.left=(r.left+r.width/2)+"px";h.style.top=(r.top+r.height/2)+"px";
  h.innerHTML='<svg viewBox="0 0 24 24" width="96" height="96"><path d="M12 21s-7.5-4.6-9.6-9.2C.9 8.4 3 4.5 6.9 4.5c2.1 0 3.6 1.1 5.1 3 1.5-1.9 3-3 5.1-3 3.9 0 6 3.9 4.5 7.3C19.5 16.4 12 21 12 21z" fill="#fff"/></svg>';
  document.body.appendChild(h);
  setTimeout(()=>h.remove(),mvReduced()?300:900);
}

/* Pictures fade in when they arrive instead of popping. Only ones still
   loading: a cached picture on a repaint is already there and must not
   flicker. Watches the whole page, so every feed, grid and chat gets it. */
function mvImgs(root){
  (root.querySelectorAll?root.querySelectorAll('img[loading="lazy"]'):[]).forEach(img=>{
    if(img.complete||img.classList.contains("mv-img"))return;
    img.classList.add("mv-img");
    const done=()=>img.classList.remove("mv-img");
    img.addEventListener("load",done,{once:true});img.addEventListener("error",done,{once:true});
  });
}
try{
  new MutationObserver(list=>{for(const r of list)for(const n of r.addedNodes)if(n.nodeType===1)mvImgs(n)})
    .observe(document.documentElement,{childList:true,subtree:true});
}catch(e){}

/* Loading, as a shimmer shaped like what's coming. */
function skel(kind){
  const bar=(w)=>`<i class="sk-bar" style="width:${w}%"></i>`;
  const row=`<div class="sk-row"><i class="sk-av"></i><div class="sk-lines">${bar(58)}${bar(34)}</div></div>`;
  if(kind==="cards")return [0,1,2,3].map(()=>`<div class="sk-card">${row}<i class="sk-img"></i></div>`).join("");
  if(kind==="tiles")return [0,1,2,3].map(()=>`<div class="sk-tile"><i class="sk-img"></i>${bar(70)}${bar(40)}</div>`).join("");
  return `<div class="sk-list" aria-label="Loading">${row}${row}${row}</div>`;
}
