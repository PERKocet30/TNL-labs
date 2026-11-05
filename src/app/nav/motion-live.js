/* MOTION · LIVE v1.0 — 2026-11-05. "Include this in the design language for the whole app, then
   standardize everything to be more dynamic and interactive." The sign-up's motion, made the app's
   (styles: app/styles/motion.css, "ARRIVE · ANSWER · LAND"). Three rules, applied to every screen
   without each screen knowing:
     ARRIVE  a screen that moves in brings its parts in one after another (motion.css, on the
             mv-fwd / mv-back / mv-fade the screen already gets); the same when loading gives way
             to the real thing — mvLanded() marks the repaint where the shimmer left
     ANSWER  a tap that turns something on pops it (a title, a like, a follow, a tab, a colour) —
             mvAnswer() looks under the finger after the repaint, so it works through a re-render
     LAND    a number that changed from what you did bumps (likes, comments, followers, a cart,
             a badge) — mvCounts() compares the counts near your tap before and after
   Transform and opacity only, never with reduced motion. render() calls mvLanded() after mvAfter(). */
const MVL={skel:false,counts:null,at:0};
const MV_COUNT_SEL=".px-likers,.lb-t,.igact-n,.pstat b,.badge,.gx-count,.rcount,[data-count]";
/* loading gave way to the real thing: the parts arrive */
function mvLanded(){
  const c=document.querySelector("#app .content");if(!c)return;
  const has=!!c.querySelector(".sk-list,.sk-card,.sk-tile,.skel");
  if(MVL.skel&&!has&&!mvReduced()){c.classList.add("mv-land");setTimeout(()=>c.classList.remove("mv-land"),700)}
  MVL.skel=has;
}
/* a tap: remember the counts near it; after the repaint, pop what turned on and bump what changed */
document.addEventListener("click",e=>{
  if(mvReduced()||!e.isTrusted)return;
  const t=e.target&&e.target.closest?e.target.closest("button,[role=button],.chip,.igact,.pe-dot,.navb,[data-tab],[data-like],[data-fol],[data-follow]"):null;
  if(!t)return;
  const x=e.clientX,y=e.clientY,near=t.closest(".sr-card,.post,.pstats,.gx-body,.ld,.cx-in,.content")||document;
  const before=new Map([...near.querySelectorAll(MV_COUNT_SEL)].map(n=>[mvCountKey(n),n.textContent]));
  const check=(tries)=>{
    const el=document.elementFromPoint(x,y),ctl=el&&el.closest?el.closest("button,[role=button],.chip,.igact,.pe-dot,.navb,[data-tab]"):null;
    if(ctl&&!ctl.classList.contains("mv-pop")&&(ctl.classList.contains("on")||ctl.classList.contains("liked")||ctl.getAttribute("aria-pressed")==="true"||ctl.classList.contains("active")))mvPop(ctl);
    for(const n of near.querySelectorAll(MV_COUNT_SEL)){const k=mvCountKey(n),was=before.get(k);if(was!=null&&was!==n.textContent&&!n.classList.contains("mv-bump")){mvBump(n);before.set(k,n.textContent)}}
    if(tries>0)setTimeout(()=>check(tries-1),120);
  };
  setTimeout(()=>check(3),40);
},true);
const mvCountKey=(n)=>(n.id||"")+"|"+(n.className||"")+"|"+((n.closest("[data-pid],[data-like],[data-comments],[data-share],.pstat,#dmBtn,#notifBtn")||{}).outerHTML||"").slice(0,80);
function mvPop(el){el.classList.remove("mv-pop");void el.offsetWidth;el.classList.add("mv-pop");el.addEventListener("animationend",()=>el.classList.remove("mv-pop"),{once:true})}
function mvBump(el){el.classList.remove("mv-bump");void el.offsetWidth;el.classList.add("mv-bump");el.addEventListener("animationend",()=>el.classList.remove("mv-bump"),{once:true})}
