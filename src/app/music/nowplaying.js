/* ================================================================
   NOW PLAYING · v1.0 — 2026-10-12. "When you click a song the whole song
   menu comes up."
   Tap a song (in the library or a playlist), or the bar at the bottom, and
   the song fills the screen: its cover over its own colours, the title and
   artist, ⊕ to a playlist, a scrubber, shuffle · back · play · next ·
   repeat, the song's …, and what's up next. ⌄, swipe down or back closes
   it (it's a screen on the back trail: app/nav/back, NOWFULL); the music
   carries on in the bar.
   Its own layer outside #app, like the bar, so a repaint never touches it;
   paintPlayer() paints both, paintProgress() moves both scrubbers.
================================================================ */
let NOWFULL=false, NPFEL=null, REPEAT="off", PLQORIG=null;   // REPEAT: off → all → one
const NPF_DOWN=di('<path d="M6 9l6 6 6-6"/>',24);
const NPF_REP=di('<path d="M4 12V8h14M15 5l3 3-3 3M20 12v4H6M9 19l-3-3 3-3"/>',22);
function npfFrom(){
  const p=PLQID&&(PLISTS||[]).find(x=>x.id===PLQID);
  return p?{k:"PLAYING FROM PLAYLIST",n:p.name}:{k:"PLAYING FROM",n:"// Music"};
}
/* Up next: what plays after this one, in order (repeat all wraps round). */
function npfNext(){
  const i=qIndex();if(i<0)return [];
  let n=PLAYQ.slice(i+1);
  if(REPEAT==="all")n=n.concat(PLAYQ.slice(0,i));
  return n.slice(0,20);
}
function openNowFull(){if(!NOWPLAYING||MUSAUTOID!=null)return;NOWFULL=true;render();paintPlayer()}
function closeNowFull(){if(!NOWFULL)return;NOWFULL=false;render();paintPlayer()}
/* Shuffle for whatever's playing: what's left after this song moves into a
   new order; off puts the list back the way it was. */
function npfShuffle(){
  PLSHUF=!PLSHUF;
  const now=NOWPLAYING;
  if(now&&PLAYQ.length>1){
    if(PLSHUF){PLQORIG=PLAYQ.slice();PLAYQ=[now,...plShuffle(PLAYQ.filter(t=>t.id!==now.id))]}
    else if(PLQORIG){PLAYQ=PLQORIG;PLQORIG=null}
  }
  toast(PLSHUF?"Shuffle on":"Shuffle off");paintPlayer();if(TAB==="labs"&&CH.library)render();
}
function npfRepeat(){REPEAT=REPEAT==="off"?"all":REPEAT==="all"?"one":"off";
  toast(REPEAT==="off"?"Repeat off":REPEAT==="all"?"Repeating the list":"Repeating this song");paintPlayer()}
function npfHTML(){
  const t=NOWPLAYING,f=npfFrom(),live=AUDIO&&!AUDIO.paused,added=inAnyPl(t.id),next=npfNext();
  return `<div class="npf-bg"${t.artworkUrl?` style="background-image:url('${esc(t.artworkUrl)}')"`:""}></div>
  <div class="npf-in">
    <div class="npf-top" data-npfdrag>
      <button class="npf-ib" data-npfclose aria-label="Close">${NPF_DOWN}</button>
      <div class="npf-from"><span>${f.k}</span><b>${esc(f.n)}</b></div>
      <button class="npf-ib" data-npfmore aria-label="More">${DI.more}</button>
    </div>
    <div class="npf-art" data-npfdrag>${t.artworkUrl?`<img src="${esc(t.artworkUrl)}" alt="">`:DI.music}</div>
    <div class="npf-meta">
      <div class="npf-mt"><b class="npf-t">${esc(t.title)}</b><button class="npf-by" data-npfartist>@${esc(t.by.username)}</button></div>
      <button class="npf-ib npf-add${added?" on":""}" data-nowadd aria-label="${added?"In a playlist — add to another":"Add to a playlist"}">${added?PL_DONE:PL_ADD}</button>
    </div>
    <div class="npf-seek" data-npfseek><div class="npf-track"><div class="npf-fill"></div><div class="npf-knob"></div></div></div>
    <div class="npf-times"><span class="npf-cur">0:00</span><span class="npf-dur"></span></div>
    <div class="npf-ctl">
      <button class="npf-ib npf-tog${PLSHUF?" on":""}" data-npfshuf aria-label="Shuffle" aria-pressed="${PLSHUF}">${PL_SHUF}</button>
      <button class="npf-ib npf-sk" data-nowprev aria-label="Previous">${DI.prev}</button>
      <button class="npf-pp" data-nowtoggle aria-label="${live?"Pause":"Play"}">${live?DI.pause:DI.play}</button>
      <button class="npf-ib npf-sk" data-nownext aria-label="Next"${next.length?"":" disabled"}>${DI.next}</button>
      <button class="npf-ib npf-tog${REPEAT!=="off"?" on":""}" data-npfrep aria-label="Repeat: ${REPEAT}">${NPF_REP}${REPEAT==="one"?`<i class="npf-one">1</i>`:""}</button>
    </div>
    ${next.length?`<div class="npf-next"><div class="npf-nh">Up next</div>
      ${next.map(x=>`<button class="npf-row" data-npfjump="${x.id}"><span class="npf-ra">${x.artworkUrl?`<img src="${esc(x.artworkUrl)}" alt="" loading="lazy">`:DI.music}</span>
        <span class="npf-rm"><b>${esc(x.title)}</b><span>@${esc(x.by.username)}</span></span></button>`).join("")}</div>`:""}
  </div>`;
}
function paintFull(){
  const show=NOWFULL&&!!NOWPLAYING&&MUSAUTOID==null&&musicHere();
  if(!show){if(NPFEL){NPFEL.remove();NPFEL=null}document.body.classList.remove("npf-on");return}
  if(!NPFEL){
    NPFEL=document.createElement("div");NPFEL.className="npf";NPFEL.setAttribute("role","dialog");NPFEL.setAttribute("aria-label","Now playing");
    document.body.appendChild(NPFEL);npfWire(NPFEL);
  }
  document.body.classList.add("npf-on");
  const sc=NPFEL.querySelector(".npf-in"),y=sc?sc.scrollTop:0;
  NPFEL.innerHTML=npfHTML();
  const s2=NPFEL.querySelector(".npf-in");if(s2)s2.scrollTop=y;
  npfProgress();
}
function npfProgress(){
  if(!NPFEL||!AUDIO)return;
  const d=AUDIO.duration,c=AUDIO.currentTime||0,ok=d&&isFinite(d),pc=ok?Math.min(100,c/d*100):0;
  const f=NPFEL.querySelector(".npf-fill");if(f)f.style.width=pc+"%";
  const k=NPFEL.querySelector(".npf-knob");if(k)k.style.left=pc+"%";
  const a=NPFEL.querySelector(".npf-cur");if(a)a.textContent=nowClock(c);
  const b=NPFEL.querySelector(".npf-dur");if(b)b.textContent=ok?"-"+nowClock(d-c):"";
}
function npfWire(el){
  el.addEventListener("click",e=>{
    const a=audioEl(),h=s=>e.target.closest(s);
    if(h("[data-npfclose]"))return closeNowFull();
    if(h("[data-nowtoggle]")){a.paused?a.play().catch(()=>{}):a.pause();return}
    if(h("[data-nownext]")){nextTrack();return}
    if(h("[data-nowprev]")){prevTrack();return}
    if(h("[data-nowadd]")){addToPlaylist(NOWPLAYING);return}
    if(h("[data-npfshuf]"))return npfShuffle();
    if(h("[data-npfrep]"))return npfRepeat();
    if(h("[data-npfmore]"))return trackMenu(NOWPLAYING,"now");
    if(h("[data-npfartist]"))return openProfile(NOWPLAYING.by.username);   // back comes here again
    const j=h("[data-npfjump]");if(j){const t=PLAYQ.find(x=>String(x.id)===j.dataset.npfjump);if(t)playTrack(t);return}
  });
  /* the scrubber: tap or drag */
  let drag=false;
  const seekTo=x=>{const s=el.querySelector("[data-npfseek]"),a=audioEl();if(!s||!a.duration||!isFinite(a.duration))return;
    const r=s.getBoundingClientRect();a.currentTime=Math.max(0,Math.min(1,(x-r.left)/r.width))*a.duration;npfProgress()};
  el.addEventListener("pointerdown",e=>{if(e.target.closest("[data-npfseek]")){drag=true;seekTo(e.clientX);e.preventDefault()}});
  el.addEventListener("pointermove",e=>{if(drag)seekTo(e.clientX)});
  window.addEventListener("pointerup",()=>{drag=false});
  /* swipe down on the cover or the top to close */
  let y0=null,dy=0;
  el.addEventListener("touchstart",e=>{if(!e.target.closest("[data-npfdrag]")||e.target.closest("button"))return;y0=e.touches[0].clientY;dy=0},{passive:true});
  el.addEventListener("touchmove",e=>{if(y0==null)return;dy=Math.max(0,e.touches[0].clientY-y0);el.style.transform=`translateY(${dy}px)`},{passive:true});
  el.addEventListener("touchend",()=>{if(y0==null)return;y0=null;el.style.transform="";if(dy>110)closeNowFull()});
}
