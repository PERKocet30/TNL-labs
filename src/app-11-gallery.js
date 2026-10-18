/* ================================================================
   SHOWROOM GALLERY v1.0 — 2026-10-18. "I want it to feel like a virtual
   showroom." On a computer the Showroom is a wall you walk along: one
   piece large in the middle under the spotlight, its neighbours smaller
   and dimmed at either side. ← → keys, the ‹ › buttons, the wheel or a
   trackpad, or a click on a neighbour move you along. The piece in the
   spotlight is the only one whose song plays (musBand, used by the post
   music observer in app-18-media.js) — two songs never fight.
   Gallery | Grid switches to the two-across grid (remembered). Phones
   keep the feed as it is. Styles: app-05-styles-wide.css.
================================================================ */
let SRVIEW="gallery", GALI=0, GALRAF=0, GALWHEEL=0, GALCLICK=false;
try{SRVIEW=localStorage.getItem("tnl-srview")==="grid"?"grid":"gallery"}catch(e){}
const galOn=()=>typeof isWide==="function"&&isWide()&&SRVIEW==="gallery";

/* the band a post's song plays in: the middle of the screen; on a computer's
   Showroom the gallery's spotlight, or nothing in the grid (two across, the
   middle would sit on two posts — tap ▶ on the song there) */
function musBand(){
  if(!(typeof isWide==="function"&&isWide())||TAB!=="showroom"||POSTOPEN||PROFILE||PCOMPOSE)return "-40% 0px -40% 0px";
  return SRVIEW==="gallery"?"-40% -44% -40% -44%":"-40% -60% -40% -60%";
}

function galBarHTML(){
  if(!(typeof isWide==="function"&&isWide()))return "";
  return `<div class="gal-bar"><span class="mono">${SRVIEW==="gallery"?"Walk through the work · ← →":"Everything, two across"}</span>
    <div class="gal-seg" role="group" aria-label="View"><button class="${SRVIEW==="gallery"?"on":""}" data-srview="gallery">Gallery</button><button class="${SRVIEW==="grid"?"on":""}" data-srview="grid">Grid</button></div></div>`;
}
const galNavHTML=()=>galOn()?`<button class="gal-nav prev" id="galprev" aria-label="Previous piece">${DI.back||"‹"}</button><button class="gal-nav next" id="galnext" aria-label="Next piece"><svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="square" stroke-linejoin="miter" aria-hidden="true"><path d="M9 5l7 7-7 7"/></svg></button>`:"";

const galCards=()=>{const g=$("#sr-grid");return g?[...g.querySelectorAll(".sr-card")]:[]};
/* the piece nearest the middle of the wall is in the spotlight */
function galSpot(){
  const g=$("#sr-grid");if(!g||!galOn())return;
  const r=g.getBoundingClientRect(),mid=r.left+r.width/2,cs=galCards();
  let best=null,bd=1e9;
  for(const c of cs){const cr=c.getBoundingClientRect(),d=Math.abs(cr.left+cr.width/2-mid);if(d<bd){bd=d;best=c}}
  cs.forEach(c=>c.classList.toggle("on",c===best));
  if(best)GALI=cs.indexOf(best);
  const p=$("#galprev"),n=$("#galnext");if(p)p.disabled=GALI<=0;if(n)n.disabled=GALI>=cs.length-1;
}
function galGo(i,instant){
  const g=$("#sr-grid"),cs=galCards();if(!g||!cs.length)return;
  i=Math.max(0,Math.min(cs.length-1,i));const c=cs[i];
  g.scrollTo({left:c.offsetLeft-(g.clientWidth-c.offsetWidth)/2,behavior:instant||mvReduced()?"auto":"smooth"});
  GALI=i;
  if(!instant)g.scrollIntoView({block:"nearest",behavior:mvReduced()?"auto":"smooth"});   // walking along brings the wall fully into view
}
function galWire(){
  document.querySelectorAll("[data-srview]").forEach(b=>b.onclick=()=>{
    if(SRVIEW===b.dataset.srview)return;SRVIEW=b.dataset.srview;try{localStorage.setItem("tnl-srview",SRVIEW)}catch(e){}render()});
  const g=$("#sr-grid");if(!g||!galOn())return;
  g.onscroll=()=>{cancelAnimationFrame(GALRAF);GALRAF=requestAnimationFrame(galSpot)};
  /* a mouse wheel turns into one step along the wall per flick */
  g.onwheel=e=>{if(Math.abs(e.deltaY)<=Math.abs(e.deltaX))return;e.preventDefault();
    const now=Date.now();if(now-GALWHEEL<380)return;GALWHEEL=now;galGo(GALI+(e.deltaY>0?1:-1))};
  const pv=$("#galprev"),nx=$("#galnext");
  if(pv)pv.onclick=()=>galGo(GALI-1);if(nx)nx.onclick=()=>galGo(GALI+1);
  if(!GALCLICK){GALCLICK=true;   // a click on a neighbour brings it into the spotlight, nothing else
    document.addEventListener("click",e=>{if(!galOn())return;const c=e.target.closest&&e.target.closest("#sr-grid .sr-card");
      if(c&&!c.classList.contains("on")){e.preventDefault();e.stopPropagation();galGo(galCards().indexOf(c))}},true)}
  galGo(GALI,true);galSpot();
}
document.addEventListener("keydown",e=>{
  if(!galOn()||TAB!=="showroom"||POSTOPEN||PROFILE||PCOMPOSE||PICKER||GATE||DMOPENPANEL||SEARCHOPEN||NOTIFOPEN)return;
  const t=e.target;if(t&&(t.isContentEditable||/^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName)))return;
  if(e.key==="ArrowRight"){e.preventDefault();galGo(GALI+1)}else if(e.key==="ArrowLeft"){e.preventDefault();galGo(GALI-1)}
});
