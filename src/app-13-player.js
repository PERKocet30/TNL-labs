/* THE PLAYER v2.2 — 2026-10-09 (v2.1 — 2026-09-29; v2.2: a profile's Music tab repaints on play / pause, and plays on to the next song)
   One audio element for the whole app, parked outside #app so a repaint
   can't interrupt playback. Built on first use — no element for people who
   never press play, and nothing constructed at parse time.

   Two kinds of sound, two rules (v2.1):
   - Lab playback (Music → Tracks) is a real player — previous / next, a
     seek bar, the time, next track when one ends; the queue is the list you
     pressed play from — and it stays in the labs. Step out (Showroom,
     Market, a profile, a chat, a drawer) and it pauses and the bar goes;
     come back and the bar is there, paused, where you left it.
   - A post's sound (MUSAUTOID, app-18-media.js) plays anywhere, but only
     while you're looking at the post: it autoplays when the post is centred
     and stops when you scroll off it, leave the page, or open a chat or
     drawer over it. It never gets the bar. */
let AUDIO=null, PLAYERBAR=null, PLAYQ=[];
function audioEl(){
  if(AUDIO)return AUDIO;
  AUDIO=new Audio();
  AUDIO.preload="none";
  /* a profile's music tile shows play / pause too (2026-10-09) */
  const sync=()=>{paintPlayer();if((TAB==="labs"&&CH.library)||String(MUSAUTOID).startsWith("trk"))render()};
  AUDIO.addEventListener("play",sync);
  AUDIO.addEventListener("pause",sync);
  AUDIO.addEventListener("ended",()=>{if(MUSAUTOID==null&&nextTrack())return;
    /* a profile's Music tab plays on down the list (2026-10-09) */
    if(String(MUSAUTOID).startsWith("trk")){const n=nextProfileTrack();if(n){MUSAUTOID="trk"+n.id;playTrack(n,true);render();return}}
    sync()});
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

/* Where the lab player may play: the labs, with nothing laid over them. */
function musicHere(){return TAB==="labs"&&!PROFILE&&!GATE&&!PCOMPOSE&&!DMOPENPANEL&&!NOTIFOPEN&&!SEARCHOPEN&&!BOARDSOPEN&&!REVIEWING}
/* Where a post's sound may play: any screen where you can see the post —
   not under a chat, a drawer, the door or an editor. */
function postSoundHere(){return !GATE&&!PCOMPOSE&&!TRKEDIT&&!DMOPENPANEL&&!NOTIFOPEN&&!BOARDSOPEN&&!REVIEWING}
/* Runs on every paint (wire(), the chat layer, play/pause events), so no
   route can skip it — the lock screen and headphone buttons included: a play
   from there lands here and is paused again. The silent unlock (a data: URI,
   app-18) is left alone — pausing it mid-play would undo the iOS unlock. */
function musicScope(){
  if(!AUDIO)return;
  const live=!AUDIO.paused&&!(AUDIO.getAttribute("src")||"").startsWith("data:");
  if(MUSAUTOID!=null){
    if(postSoundHere())return;
    if(live)AUDIO.pause();
    MUSAUTOID=null;NOWPLAYING=null;   // dropped: it autoplays again when you're back on the post
    return}
  if(musicHere())return;
  if(live)AUDIO.pause();
  const ms=navigator.mediaSession;if(ms)try{ms.metadata=null}catch(e){}
}
/* The bar steps aside for the door and the full-screen editors (post
   composer, track edit), which have their own bottom edge. */
function barVisible(){return !!NOWPLAYING&&MUSAUTOID==null&&musicHere()&&!TRKEDIT}
/* Over a chat or a drawer there's no nav underneath, so the bar docks to the
   bottom edge and the screen above makes room for it. */
function barDocked(){return !!(DMOPENPANEL||NOTIFOPEN||SEARCHOPEN||BOARDSOPEN||REVIEWING||(PROFILE&&!MYPAGE()))}

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
  musicScope();
  const show=barVisible();
  document.body.classList.toggle("has-now",show);
  document.body.classList.toggle("now-dock",show&&barDocked());
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
    ms.setActionHandler("play",()=>{if(musicHere())audioEl().play().catch(()=>{})});
    ms.setActionHandler("pause",()=>audioEl().pause());
    ms.setActionHandler("nexttrack",()=>{nextTrack()});
    ms.setActionHandler("previoustrack",()=>prevTrack());
  }catch(e){}
}

/* Sound you chose is playback, not background noise (2026-10-08). Left to
   itself iOS can file a page's sound as "ambient", which the silent switch
   mutes: Control Center showed LABS playing and nothing came out (Jorge's
   recording, switch on). Saying "playback" makes it play like a music app. */
function soundOn(){try{const s=navigator.audioSession;if(s&&s.type!=="playback")s.type="playback"}catch(e){}}
function playTrack(t,silent){
  const a=audioEl();soundOn();
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
