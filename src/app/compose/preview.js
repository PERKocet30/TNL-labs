/* ── LISTEN BEFORE YOU PICK · v1.1 · 2026-10-25 ─────────────────────────
   v1.1: which part of the song plays (pcPartHTML / pcPartWire, below) —
   the preview starts there too.
   "You should be able to listen to a song before you pick it for a post."
   Add music: ▶ on a song plays it (tap again to stop);
   the row picks it. The picked song's ▶ plays and pauses too. Its own
   audio element — the lab player is paused while you're posting
   (musicScope), and this mustn't fight it. Stops when you pick another
   song, take the music off, or close the post maker. */
const pcPvOn=id=>!!(PCPV&&PCPV.id===id&&!PCPV.a.paused);
function pcPrevBtn(t){const on=pcPvOn(t.id);
  return `<button type="button" class="pcmus-pp${on?" on":""}" data-pcprev="${t.id}" aria-label="${on?"Stop":"Listen to"} ${esc(t.title)}">${on?DI.pause:DI.play}</button>`}
function pcPrevPaint(){
  document.querySelectorAll("[data-pcprev]").forEach(b=>{const on=pcPvOn(Number(b.dataset.pcprev));
    b.classList.toggle("on",on);b.innerHTML=on?DI.pause:DI.play;b.setAttribute("aria-label",(on?"Stop":"Listen to")+" this song")});
  const mp=document.querySelector("[data-pcmusplay]");
  if(mp&&PCOMPOSE&&PCOMPOSE.track){const on=pcPvOn(PCOMPOSE.track.id);mp.innerHTML=on?DI.pause:DI.play;mp.setAttribute("aria-label",on?"Pause":"Play")}
}
function pcPrevToggle(t,startMs){
  if(!t)return;
  if(PCPV&&PCPV.id===t.id){if(PCPV.a.paused){if(startMs!=null&&Math.abs(PCPV.a.currentTime*1000-(PCPV.at||0))>50000)PCPV.a.currentTime=startMs/1000;PCPV.a.play().catch(()=>{})}else PCPV.a.pause();return}
  pcPrevStop();soundOn();
  const a=new Audio(t.url);a.preload="auto";
  if(startMs>0){a.addEventListener("loadedmetadata",()=>{try{a.currentTime=startMs/1000}catch(e){}},{once:true});try{a.currentTime=startMs/1000}catch(e){}}
  PCPV={id:t.id,a,at:startMs||0};
  ["play","pause","ended"].forEach(e=>a.addEventListener(e,pcPrevPaint));
  a.play().catch(err=>{if(err&&err.name==="NotAllowedError")toast("Tap once more to allow sound");else if(err&&err.name!=="AbortError")toast("Couldn't play that one")});
  pcPrevPaint();
}
function pcPrevStop(){if(!PCPV)return;try{PCPV.a.pause();PCPV.a.removeAttribute("src");PCPV.a.load()}catch(e){}PCPV=null;pcPrevPaint()}
/* one listener for every ▶ — the search repaints rows without rewiring */
document.addEventListener("click",e=>{const b=e.target.closest("[data-pcprev]");if(!b||!PCOMPOSE)return;
  e.stopPropagation();const id=Number(b.dataset.pcprev);
  pcPrevToggle((PCOMPOSE.list||[]).find(t=>t.id===id)||(PCOMPOSE.track&&PCOMPOSE.track.id===id?PCOMPOSE.track:null))},true);

/* ── WHICH PART OF THE SONG · 2026-10-25 ──────────────────────────────────
   "You should be able to select what part the song plays." Under the picked
   song: a bar for the whole song with a 15-second window on it. Drag the
   window to the part you want; the times say where it is; ▶ plays from
   there. The feed plays the post's song from that point, and the Story
   video takes its 15 seconds from there (audio_start on the post). */
const PC_PART_MS=15000;
const pcMmss=ms=>{const s=Math.max(0,Math.round(ms/1000));return Math.floor(s/60)+":"+String(s%60).padStart(2,"0")};
function pcPartHTML(c){
  const t=c.track,dur=t&&t.durationMs||0;if(!t||dur<=PC_PART_MS+1000)return "";   // a short song plays whole
  const st=Math.max(0,Math.min(c.musStart||0,dur-PC_PART_MS)),w=PC_PART_MS/dur*100,l=st/dur*100;
  return `<div class="pc-part" id="pcpart" data-dur="${dur}">
    <div class="pc-part-l"><span>Plays from</span><b id="pcpartt">${pcMmss(st)} – ${pcMmss(st+PC_PART_MS)}</b></div>
    <div class="pc-part-bar" id="pcpartbar"><div class="pc-part-win" id="pcpartwin" style="left:${l.toFixed(3)}%;width:${w.toFixed(3)}%" role="slider" aria-label="Which part of the song plays" aria-valuemin="0" aria-valuemax="${Math.round((dur-PC_PART_MS)/1000)}" aria-valuenow="${Math.round(st/1000)}" tabindex="0"></div></div>
  </div>`;
}
function pcPartWire(c){
  const bar=document.getElementById("pcpartbar"),win=document.getElementById("pcpartwin"),tt=document.getElementById("pcpartt");if(!bar||!win)return;
  const dur=Number(bar.parentElement.dataset.dur)||0,maxSt=Math.max(0,dur-PC_PART_MS);
  const put=(ms,done)=>{ms=Math.max(0,Math.min(maxSt,Math.round(ms/500)*500));c.musStart=ms;
    win.style.left=(ms/dur*100).toFixed(3)+"%";win.setAttribute("aria-valuenow",String(Math.round(ms/1000)));
    if(tt)tt.textContent=pcMmss(ms)+" – "+pcMmss(ms+PC_PART_MS);
    if(done&&PCPV&&PCPV.id===c.track.id){PCPV.at=ms;try{PCPV.a.currentTime=ms/1000}catch(e){}}};
  const atX=x=>{const r=bar.getBoundingClientRect();return (x-r.left)/Math.max(1,r.width)*dur-PC_PART_MS/2};
  let drag=null;
  bar.onpointerdown=e=>{e.preventDefault();drag={id:e.pointerId};try{bar.setPointerCapture(e.pointerId)}catch(x){}put(atX(e.clientX))};
  bar.onpointermove=e=>{if(!drag)return;e.preventDefault();put(atX(e.clientX))};
  bar.onpointerup=bar.onpointercancel=e=>{if(!drag)return;drag=null;put(c.musStart||0,true)};
  win.onkeydown=e=>{const d=e.key==="ArrowLeft"?-1000:e.key==="ArrowRight"?1000:0;if(!d)return;e.preventDefault();put((c.musStart||0)+d,true)};
}
