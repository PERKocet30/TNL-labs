/* THE PLAYER v2.0 — 2026-09-29
   One audio element for the whole app, parked outside #app so a repaint
   can't interrupt playback. Built on first use — no element for people who
   never press play, and nothing constructed at parse time.

   Music lab playback is a real player now: the bar follows you through the
   whole app (Showroom, labs, profiles), with previous / next, a seek bar and
   the time, and it moves on to the next track when one ends. The queue is
   the list you pressed play from. A post's sound belongs to its post
   (MUSAUTOID, app-18-media.js) and never gets the bar. */
let AUDIO=null, PLAYERBAR=null, PLAYQ=[];
function audioEl(){
  if(AUDIO)return AUDIO;
  AUDIO=new Audio();
  AUDIO.preload="none";
  const sync=()=>{paintPlayer();if(TAB==="labs"&&CH.library)render()};
  AUDIO.addEventListener("play",sync);
  AUDIO.addEventListener("pause",sync);
  AUDIO.addEventListener("ended",()=>{if(MUSAUTOID==null&&nextTrack())return;sync()});
  AUDIO.addEventListener("timeupdate",paintProgress);
  AUDIO.addEventListener("loadedmetadata",paintProgress);
  return AUDIO;
}

function qIndex(){return NOWPLAYING?PLAYQ.findIndex(x=>x.id===NOWPLAYING.id):-1}
function nextTrack(){
  const i=qIndex();
  if(i<0||i>=PLAYQ.length-1)return false;
  playTrack(PLAYQ[i+1]);return true;
}
/* Like every player: back restarts the song unless you're in its first seconds. */
function prevTrack(){
  const a=audioEl(), i=qIndex();
  if(a.currentTime>3||i<=0){a.currentTime=0;if(a.paused)a.play().catch(()=>{});paintProgress();return}
  playTrack(PLAYQ[i-1]);
}

/* The bar steps aside for the door, the post composer and chats — each has
   its own bottom edge that the bar would sit on. */
function barVisible(){return !!NOWPLAYING&&MUSAUTOID==null&&!GATE&&!PCOMPOSE&&!CHAT&&!DMOPENPANEL}

const nowClock=s=>{s=Math.max(0,Math.floor(s||0));return Math.floor(s/60)+":"+String(s%60).padStart(2,"0")};

function paintPlayer(){
  if(!PLAYERBAR){
    PLAYERBAR=document.createElement("div");
    PLAYERBAR.className="nowbar";
    document.body.appendChild(PLAYERBAR);
    PLAYERBAR.onclick=e=>{
      const a=audioEl();
      if(e.target.closest("[data-nowtoggle]")){a.paused?a.play().catch(()=>{}):a.pause();return}
      if(e.target.closest("[data-nownext]")){nextTrack();return}
      if(e.target.closest("[data-nowprev]")){prevTrack();return}
      const seek=e.target.closest("[data-nowseek]");
      if(seek){
        if(a.duration&&isFinite(a.duration)){const r=seek.getBoundingClientRect();
          a.currentTime=Math.max(0,Math.min(1,(e.clientX-r.left)/r.width))*a.duration;paintProgress()}
        return}
      if(e.target.closest("[data-nowclose]")){a.pause();a.removeAttribute("src");NOWPLAYING=null;PLAYQ=[];paintPlayer();
        if(TAB==="labs"&&CH.library)render();}
    };
  }
  const show=barVisible();
  document.body.classList.toggle("has-now",show);
  if(!show){PLAYERBAR.style.display="none";return}
  PLAYERBAR.style.display="block";
  const t=NOWPLAYING, i=qIndex();
  PLAYERBAR.innerHTML=`<div class="now-seek" data-nowseek><div class="now-fill"></div></div>
    <div class="now-row">
      <div class="now-art">${t.artworkUrl?`<img src="${esc(t.artworkUrl)}" alt="">`:DI.music}</div>
      <div class="now-meta"><div class="now-t">${esc(t.title)}</div>
        <div class="mono dim now-by">@${esc(t.by.username)} <span class="now-time"></span></div></div>
      <button class="now-sk" data-nowprev aria-label="Previous">${DI.prev}</button>
      <button class="now-pp" data-nowtoggle aria-label="Play or pause">${(!AUDIO||AUDIO.paused)?DI.play:DI.pause}</button>
      <button class="now-sk" data-nownext aria-label="Next"${i<0||i>=PLAYQ.length-1?" disabled":""}>${DI.next}</button>
      <button class="now-x" data-nowclose aria-label="Close">${DI.x}</button>
    </div>`;
  paintProgress();
  lockScreen();
}
/* Runs on every timeupdate, so it only touches the two moving parts. */
function paintProgress(){
  if(!PLAYERBAR||!AUDIO||PLAYERBAR.style.display==="none")return;
  const d=AUDIO.duration, c=AUDIO.currentTime||0, ok=d&&isFinite(d);
  const f=PLAYERBAR.querySelector(".now-fill");if(f)f.style.width=(ok?Math.min(100,c/d*100):0)+"%";
  const tm=PLAYERBAR.querySelector(".now-time");if(tm)tm.textContent="· "+nowClock(c)+(ok?" / "+nowClock(d):"");
}
/* Phone lock screen and headphone buttons: title, artist, cover, and the
   same play / pause / next / previous as the bar. */
function lockScreen(){
  const ms=navigator.mediaSession;
  if(!ms||!NOWPLAYING||typeof MediaMetadata==="undefined")return;
  try{
    const t=NOWPLAYING;
    ms.metadata=new MediaMetadata({title:t.title,artist:"@"+t.by.username,album:"TNL LABS",
      artwork:t.artworkUrl?[{src:new URL(t.artworkUrl,location.origin).href}]:[]});
    ms.setActionHandler("play",()=>audioEl().play().catch(()=>{}));
    ms.setActionHandler("pause",()=>audioEl().pause());
    ms.setActionHandler("nexttrack",()=>{nextTrack()});
    ms.setActionHandler("previoustrack",()=>prevTrack());
  }catch(e){}
}

function playTrack(t,silent){
  const a=audioEl();
  /* Same track already loaded: this is a toggle, not a new play. The promise
     used to be dropped on the floor here, so an iOS refusal looked identical
     to a dead button. */
  if(NOWPLAYING&&NOWPLAYING.id===t.id){
    if(a.paused){const pr=a.play();if(pr&&pr.catch)pr.catch(err=>{if(!silent)toast(err&&err.name==="NotAllowedError"?"Tap once more to allow sound":"Couldn't play that one")})}
    else a.pause();
    return}
  NOWPLAYING=t; a.src=t.url;
  a.play().catch(err=>{if(silent)return;
    /* Name the refusal. iOS rejects play() for exactly three reasons and
       they need three different fixes: NotAllowedError = gesture credit
       (tap again), NotSupportedError = the source itself failed (a server
       or URL problem), AbortError = a new load interrupted this one. A
       blank "couldn't play" hides which one we're debugging. */
    const n=err&&err.name;
    if(n==="AbortError")return;   // skipping fast: the next load interrupted this one
    toast(n==="NotAllowedError"?"Tap once more to allow sound"
      :"Couldn't play that one — "+(n||"unknown"));});
  /* A play means someone chose to listen. Scrolling past isn't choosing, so
     autoplay passes silent and the counter stays honest. */
  if(!silent)api.trackPlay(t.id).catch(()=>{});
  paintPlayer();
}
