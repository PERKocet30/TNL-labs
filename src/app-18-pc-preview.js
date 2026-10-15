/* ── LISTEN BEFORE YOU PICK · v1.0 · 2026-10-13 ─────────────────────────
   "You should be able to listen to a song before you pick it for a post."
   Add music: ▶ on a song plays it (tap again to stop);
   the row picks it. The picked song's ▶ plays and pauses too. Its own
   audio element — the lab player is paused while you're posting
   (musicScope), and this mustn't fight it. Stops when you pick another
   song, take the music off, or close the post maker. */
let PCPV=null;   // {id, a: Audio}
const pcPvOn=id=>!!(PCPV&&PCPV.id===id&&!PCPV.a.paused);
function pcPrevBtn(t){const on=pcPvOn(t.id);
  return `<button type="button" class="pcmus-pp${on?" on":""}" data-pcprev="${t.id}" aria-label="${on?"Stop":"Listen to"} ${esc(t.title)}">${on?DI.pause:DI.play}</button>`}
function pcPrevPaint(){
  document.querySelectorAll("[data-pcprev]").forEach(b=>{const on=pcPvOn(Number(b.dataset.pcprev));
    b.classList.toggle("on",on);b.innerHTML=on?DI.pause:DI.play;b.setAttribute("aria-label",(on?"Stop":"Listen to")+" this song")});
  const mp=document.querySelector("[data-pcmusplay]");
  if(mp&&PCOMPOSE&&PCOMPOSE.track){const on=pcPvOn(PCOMPOSE.track.id);mp.innerHTML=on?DI.pause:DI.play;mp.setAttribute("aria-label",on?"Pause":"Play")}
}
function pcPrevToggle(t){
  if(!t)return;
  if(PCPV&&PCPV.id===t.id){PCPV.a.paused?PCPV.a.play().catch(()=>{}):PCPV.a.pause();return}
  pcPrevStop();soundOn();
  const a=new Audio(t.url);a.preload="auto";
  PCPV={id:t.id,a};
  ["play","pause","ended"].forEach(e=>a.addEventListener(e,pcPrevPaint));
  a.play().catch(err=>{if(err&&err.name==="NotAllowedError")toast("Tap once more to allow sound");else if(err&&err.name!=="AbortError")toast("Couldn't play that one")});
  pcPrevPaint();
}
function pcPrevStop(){if(!PCPV)return;try{PCPV.a.pause();PCPV.a.removeAttribute("src");PCPV.a.load()}catch(e){}PCPV=null;pcPrevPaint()}
/* one listener for every ▶ — the search repaints rows without rewiring */
document.addEventListener("click",e=>{const b=e.target.closest("[data-pcprev]");if(!b||!PCOMPOSE)return;
  e.stopPropagation();const id=Number(b.dataset.pcprev);
  pcPrevToggle((PCOMPOSE.list||[]).find(t=>t.id===id)||(PCOMPOSE.track&&PCOMPOSE.track.id===id?PCOMPOSE.track:null))},true);
