/* ================================================================
   SHOWROOM GALLERY v1.1 — 2026-10-18. "I want it to feel like a virtual
   showroom." On a computer the Showroom is a wall you walk along: one
   piece large in the middle under the spotlight, its neighbours smaller
   and dimmed at either side. ← → keys, the ‹ › buttons, the wheel or a
   trackpad, or a click on a neighbour move you along. The piece in the
   spotlight is the only one whose song plays (musBand, used by the post
   music observer in app-18-media.js) — two songs never fight.
   v1.1 (same day): "take the grid off computers completely" — the
   gallery is the computer's only Showroom; and "while scrolling it
   glitches and swipes through multiple" — one swipe or wheel flick is
   one step, however long the trackpad keeps coasting. Phones keep the
   feed as it is. Styles: app-05-styles-wide.css.
================================================================ */
let GALI=0, GALRAF=0, GALCLICK=false, GALSTEER=0, GALLAST=0, GALACC=0, GALLOCK=false;
const galOn=()=>typeof isWide==="function"&&isWide();

/* the band a post's song plays in: the middle of the screen; on a
   computer's Showroom, the gallery's spotlight */
function musBand(){
  if(!galOn()||TAB!=="showroom"||POSTOPEN||PROFILE||PCOMPOSE)return "-40% 0px -40% 0px";
  return "-40% -44% -40% -44%";
}

const galBarHTML=()=>galOn()?`<div class="gal-bar"><span class="mono">Walk through the work · ← →</span></div>`:"";
const galNavHTML=()=>galOn()?`<button class="gal-nav prev" id="galprev" aria-label="Previous piece">${DI.back||"‹"}</button><button class="gal-nav next" id="galnext" aria-label="Next piece"><svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="square" stroke-linejoin="miter" aria-hidden="true"><path d="M9 5l7 7-7 7"/></svg></button>`:"";

const galCards=()=>{const g=$("#sr-grid");return g?[...g.querySelectorAll(".sr-card")]:[]};
/* the piece in the spotlight: the one we're walking to, or (after a swipe
   on a touch screen) the one nearest the middle of the wall */
function galSpot(){
  const g=$("#sr-grid");if(!g||!galOn())return;
  const cs=galCards();
  if(Date.now()>GALSTEER){
    const r=g.getBoundingClientRect(),mid=r.left+r.width/2;let bd=1e9;
    cs.forEach((c,k)=>{const cr=c.getBoundingClientRect(),d=Math.abs(cr.left+cr.width/2-mid);if(d<bd){bd=d;GALI=k}});
  }
  cs.forEach((c,k)=>c.classList.toggle("on",k===GALI));
  const p=$("#galprev"),n=$("#galnext");if(p)p.disabled=GALI<=0;if(n)n.disabled=GALI>=cs.length-1;
}
function galGo(i,instant){
  const g=$("#sr-grid"),cs=galCards();if(!g||!cs.length)return;
  i=Math.max(0,Math.min(cs.length-1,i));const c=cs[i];
  GALI=i;GALSTEER=Date.now()+(instant?0:700);   // while it glides there, the target keeps the spotlight
  g.scrollTo({left:c.offsetLeft-(g.clientWidth-c.offsetWidth)/2,behavior:instant||mvReduced()?"auto":"smooth"});
  galSpot();
  if(!instant)g.scrollIntoView({block:"nearest",behavior:mvReduced()?"auto":"smooth"});   // walking along brings the wall fully into view
}
/* one gesture, one step: a trackpad swipe keeps sending wheel events while
   it coasts, so a step locks until the events stop for a moment */
function galWheel(e){
  e.preventDefault();
  const now=Date.now();if(now-GALLAST>220){GALACC=0;GALLOCK=false}GALLAST=now;
  if(GALLOCK)return;
  const k=e.deltaMode===1?40:e.deltaMode===2?800:1;
  GALACC+=(Math.abs(e.deltaX)>Math.abs(e.deltaY)?e.deltaX:e.deltaY)*k;
  if(Math.abs(GALACC)>=30){GALLOCK=true;galGo(GALI+(GALACC>0?1:-1))}
}
function galWire(){
  const g=$("#sr-grid");if(!g||!galOn())return;
  g.onscroll=()=>{cancelAnimationFrame(GALRAF);GALRAF=requestAnimationFrame(galSpot)};
  g.onwheel=galWheel;
  const pv=$("#galprev"),nx=$("#galnext");
  if(pv)pv.onclick=()=>galGo(GALI-1);if(nx)nx.onclick=()=>galGo(GALI+1);
  if(!GALCLICK){GALCLICK=true;   // a click on a neighbour brings it into the spotlight, nothing else
    document.addEventListener("click",e=>{if(!galOn())return;const c=e.target.closest&&e.target.closest("#sr-grid .sr-card");
      if(c&&!c.classList.contains("on")){e.preventDefault();e.stopPropagation();galGo(galCards().indexOf(c))}},true)}
  galGo(GALI,true);
}
document.addEventListener("keydown",e=>{
  if(!galOn()||TAB!=="showroom"||POSTOPEN||PROFILE||PCOMPOSE||PICKER||GATE||DMOPENPANEL||SEARCHOPEN||NOTIFOPEN||e.repeat)return;
  const t=e.target;if(t&&(t.isContentEditable||/^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName)))return;
  if(e.key==="ArrowRight"){e.preventDefault();galGo(GALI+1)}else if(e.key==="ArrowLeft"){e.preventDefault();galGo(GALI-1)}
});
