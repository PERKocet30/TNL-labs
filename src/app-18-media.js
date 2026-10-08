/* MEDIA — photos, video, post sound. v1.1 2026-09-29: post sound plays only while its post is on screen. */
function wireInstall(){
  const x=$("[data-installx]");if(x)x.onclick=dismissInstall;
  const go=$("[data-installgo]");if(go)go.onclick=doInstall;
}
/* CAROUSELS v2.0 — 2026-09-30.
   The counter and dots follow your finger: they update on every frame of
   the swipe and switch at the halfway point (they used to wait until the
   scroll had fully stopped, which on an iPhone's momentum scroll is long
   after the next slide is already showing).
   Where a carousel starts is ours, not the browser's: slide 1 when it first
   appears (or you open a post), the slide you were on when a live refresh
   rebuilds the screen. The position is put back as images load until you
   touch it, so a re-layout can't leave it on a random slide. */
const CAROIDX=new Map();   // key → slide, for the screen you're on
let CAROVIEW="";
function caroKey(c){return (c.closest("#poov")?"po:":"")+c.dataset.caro}
function wireCaros(){
  const view=MV.key+"|"+(PROFILE&&!MYPAGE()&&PROFILE.user?PROFILE.user.username:"")+"|"+(POSTOPEN?POSTOPEN.id:"");   // screen (app-09-motion) + any profile/post on top
  if(view!==CAROVIEW){CAROVIEW=view;CAROIDX.clear()}   // a new screen starts every carousel at 1
  document.querySelectorAll("[data-caro]").forEach(c=>{
    const track=c.querySelector(".caro-t");
    const dots=[...c.querySelectorAll(".caro-d span")];
    const num=c.querySelector(".caro-n");
    if(!track||c.dataset.caroBound)return;
    c.dataset.caroBound="1";
    const key=caroKey(c), n=dots.length||track.children.length;
    let idx=Math.min(CAROIDX.get(key)||0,Math.max(0,n-1)), touched=false, raf=0;
    const show=i=>{
      if(i===idx&&c.dataset.caroShown)return;
      idx=i;c.dataset.caroShown="1";CAROIDX.set(key,i);
      dots.forEach((d,j)=>d.classList.toggle("on",j===i));
      if(num)num.textContent=(i+1)+"/"+n;
    };
    const place=()=>{const w=track.clientWidth;if(w&&Math.abs(track.scrollLeft-idx*w)>1)track.scrollLeft=idx*w};
    c.dataset.caroShown="";show(idx);
    requestAnimationFrame(place);
    // images arriving can re-lay the track out; hold the slide until a finger moves it
    track.querySelectorAll("img").forEach(im=>{if(!im.complete)im.addEventListener("load",()=>{if(!touched)place()},{once:true})});
    const hands=()=>{touched=true};
    track.addEventListener("pointerdown",hands,{passive:true});
    track.addEventListener("touchstart",hands,{passive:true});
    track.addEventListener("wheel",hands,{passive:true});
    track.onscroll=()=>{
      if(raf)return;
      raf=requestAnimationFrame(()=>{raf=0;
        const w=track.clientWidth;if(!w)return;
        if(!touched){place();return}   // nobody's swiping: that was the layout moving, not you
        show(Math.max(0,Math.min(n-1,Math.round(track.scrollLeft/w))));
      });
    };
  });
}

function wireVideos(){
  if(VOBS){VOBS.disconnect();VOBS=null}
  const vids=[...document.querySelectorAll("video[data-auto]")];
  if(!vids.length)return;

  VOBS=new IntersectionObserver((entries)=>{
    for(const e of entries){
      const v=e.target;
      if(e.isIntersecting&&e.intersectionRatio>0.55){
        const p=v.play();
        if(p&&p.catch)p.catch((err)=>{
          /* iOS refuses autoplay outright in Low Power Mode — no code can
             override that. Don't leave a dead black box: show a play button
             and let them start it by hand. */
          if(err&&err.name==="NotAllowedError"){
            const w=v.parentElement;
            if(w&&!w.querySelector(".vplay")){
              const b=document.createElement("button");
              b.className="vplay"; b.innerHTML=DI.play.replace(/width="16" height="16"/,'width="22" height="22"'); b.setAttribute("aria-label","Play");
              b.onclick=(ev)=>{ev.stopPropagation();v.play().then(()=>b.remove()).catch(()=>{})};
              w.appendChild(b);
            }
          }
        });
      }else{
        try{v.pause()}catch(err){}
      }
    }
  },{threshold:[0,0.55,1]});

  for(const v of vids){
    v.muted=true;                 // required, or autoplay is refused outright
    /* Without this iOS shows a black rectangle until you press play —
       #t=0.1 makes it decode one frame so there's something to look at. */
    if(v.src&&!/#t=/.test(v.src))v.src=v.src+"#t=0.1";
    VOBS.observe(v);
    /* A trimmed video loops inside its trim: back to the start at the end,
       and when the file's own loop comes round to 0. */
    if(v.dataset.vs||v.dataset.ve){const s=(+v.dataset.vs||0)/1000,e=v.dataset.ve?+v.dataset.ve/1000:Infinity;
      v.ontimeupdate=()=>{if(v.currentTime>=e-.05||v.currentTime<s-.3)v.currentTime=s}}
    v.onclick=()=>{
      if("vsilent" in v.dataset){if(v.paused)v.play().catch(()=>{});return}   // its author turned the sound off
      v.muted=!v.muted;
      const btn=v.parentElement&&v.parentElement.querySelector("[data-vmute]");
      if(btn)btn.innerHTML=v.muted?DI.soundOff:DI.soundOn;
      if(v.paused)v.play().catch(()=>{});
      if(!v.muted){ // only one thing makes noise at a time
        for(const o of vids) if(o!==v){o.muted=true;
          const b=o.parentElement&&o.parentElement.querySelector("[data-vmute]");
          if(b)b.innerHTML=DI.soundOff}
      }
    };
  }
  document.querySelectorAll("[data-vmute]").forEach(b=>b.onclick=(e)=>{
    e.stopPropagation();
    const v=b.parentElement.querySelector("video");
    if(v)v.onclick();
  });
}

/* The sound credit on a card — tap plays it through the global player and
   counts a play for the track's owner, exactly like the library rows. */
function musChipHTML(p){
  if(!p.audioTrack)return "";
  const on=NOWPLAYING&&NOWPLAYING.id===p.audioTrack.id&&AUDIO&&!AUDIO.paused;
  return `<button class="muschip" data-mustrack="${p.id}">${on?DI.pause:DI.music} <span class="muschip-t">${esc(p.audioTrack.title)}</span><span class="mono dim">· @${esc(p.audioTrack.by.username)}</span></button>`;
}
/* iOS will not start audio without a gesture, so autoplay stays off until the
   first deliberate chip tap unlocks it for the session. MUSMUTE is set when
   someone pauses on purpose — without it, the next scroll would restart the
   track they just silenced. MUSAUTOID marks a track that autoplay started, so
   scrolling away only stops music the reader didn't ask for. */
let MUSOK=false, MUSMUTE=null, MUSAUTOID=null, MOBS=null;
/* Post ids whose card has actually ENTERED the centre band. "Stops the
   instant it leaves" requires having been in — a Set, not element state,
   because render() rebuilds the DOM and the observer with it. */
let MUSBAND=new Set();
let MUSPRIMED=false;
/* A zero-length WAV. Playing it inside a real tap is what unlocks the audio
   element on iOS; nothing is audible. */
const SILENT="data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEARKwAAIhYAQACABAAZGF0YQAAAAA=";
/* One audio unlock for the whole app. iOS will not let script start sound
   until the element has played inside a real gesture; the first touch
   anywhere plays a zero-length WAV, and that unlock holds for the session.

   The old cleanup used setTimeout(...,0), which fired BEFORE the silent
   play() resolved and aborted it — and an aborted play does not unlock the
   element. MUSOK then reported "ready" while the element was still locked,
   so the next programmatic play() was refused. Whether that race was won
   depended on how fast the data URI decoded, which is exactly why it
   behaved differently in Safari, in the home-screen app, and on different
   days. Cleanup now waits on the promise, and the src is never removed:
   dropping the source can reset activation on WebKit.

   skipWire is for the intro door, which unlocks during its own tap but
   must not attach the feed observer while the overlay is still up. */
function primeAudio(skipWire){
  if(MUSPRIMED)return;MUSPRIMED=true;
  try{
    const a=audioEl();
    if(!a.getAttribute("src")){
      a.src=SILENT;
      const pr=a.play();
      const tidy=()=>{try{if((a.getAttribute("src")||"").startsWith("data:"))a.pause()}catch(e){}};
      if(pr&&pr.then)pr.then(tidy,()=>{}); else tidy();
    }
    MUSOK=true;
  }catch(e){}
  if(!skipWire)wireMusAuto();
}
let MUSDELEG=false;
(function wireMusChips(){
  if(MUSDELEG)return;MUSDELEG=true;
  /* One capture-phase delegate for every surface — stops the tap before a
     work card's data-openpost swallows it. */
  document.addEventListener("click",e=>{
    const b=e.target.closest("[data-mustrack]");if(!b)return;
    e.stopPropagation();e.preventDefault();
    const id=b.dataset.mustrack;
    const p=(POSTS||[]).find(x=>String(x.id)===id)
      ||(SRPOSTS||[]).find(x=>String(x.id)===id)
      ||(SEARCHRES&&SEARCHRES.posts||[]).find(x=>String(x.id)===id)
      ||(PROFILE&&[...PROFILE.posts,...PROFILE.collabs]||[]).find(x=>String(x.id)===id);
    if(p&&p.audioTrack){
      const a=audioEl();
      const stopping=NOWPLAYING&&NOWPLAYING.id===p.audioTrack.id&&!a.paused;
      MUSOK=true;                    // the gesture iOS was waiting for
      MUSMUTE=stopping?p.id:null;    // that POST stays silent; others still autoplay
      MUSAUTOID=p.id;                // this post owns the sound now — and it
                                     // still stops the instant the post leaves
      playTrack(p.audioTrack);
      /* Repaint so the glyph flips — a tap must always visibly do something,
         otherwise working and broken look the same. render() rewires, which
         covers wireMusAuto(). */
      render();
    }
  },true);

  /* iOS needs one gesture before it will let script start audio — but it does
     not need that gesture to be on a chip. Prime on the first touch anywhere,
     so scrolling into a post just works instead of depending on someone
     discovering the chip first. pointerdown fires before click, so the unlock
     is in place before any handler asks for sound; click stays as the
     fallback where pointer events are absent. */
  document.addEventListener("pointerdown",()=>primeAudio(),true);
  document.addEventListener("click",()=>primeAudio(),true);
})();

/* Tile → full post. Reuses postHTML wholesale rather than a second renderer:
   carousel, video, sound credit, actions and comments are all already built
   there and already wired document-wide by wireFeed(), so this stays one
   source of truth for what a post looks like. */
function postOpenHTML(){
  const p=(PROFILE&&[...PROFILE.posts,...PROFILE.collabs].find(x=>Number(x.id)===Number(POSTOPEN.id)))
    ||(POSTS||[]).find(x=>Number(x.id)===Number(POSTOPEN.id))
    ||POSTOPEN;
  return `<div class="po-ov" id="poov">
    <header class="po-top">
      <button class="po-x" id="poclose" aria-label="Close"><svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="square" stroke-linejoin="miter" aria-hidden="true"><path d="M15 5l-7 7 7 7"/></svg></button>
      <div class="po-ttl">Post</div><span class="po-sp"></span>
    </header>
    <div class="po-body">${(CSLOTPO=true,postHTML(p))}${(CSLOTPO=false,"")}</div>
  </div>`;
}
/* Any post currently in memory, wherever it came from. */
function postById(id){
  return (POSTS||[]).find(x=>String(x.id)===String(id))
    ||(SRPOSTS||[]).find(x=>String(x.id)===String(id))
    ||(SEARCHRES&&(SEARCHRES.posts||[]).find(x=>String(x.id)===String(id)))
    ||(PROFILE&&[...PROFILE.posts,...PROFILE.collabs].find(x=>String(x.id)===String(id)))
    ||null;
}

/* Music follows the post you're actually looking at. The rootMargin band means
   a chip only counts as in view once it reaches the middle fifth of the screen,
   so two half-visible posts can't fight over the speaker. Videos autoplay muted,
   so nothing here competes with them. */
function wireMusAuto(){
  if(MOBS){MOBS.disconnect();MOBS=null}
  if(!MUSOK)return;
  const chips=[...document.querySelectorAll("[data-mustrack]")];
  /* Nothing carries over: if the post that owns the sound is no longer on
     screen the sound stops with it. Chats and drawers laid over the page are
     handled by musicScope() (app-13-player.js). */
  if(MUSAUTOID!=null&&NOWPLAYING){
    const still=chips.some(c=>String(c.dataset.mustrack)===String(MUSAUTOID));
    if(!still){const a=audioEl();if(!a.paused)a.pause();MUSAUTOID=null;NOWPLAYING=null;paintPlayer();}   // and it doesn't resurface in the lab bar
  }
  if(!chips.length)return;
  /* Watch the CARD, not the chip. The chip is one line of text and 025 moved it
     into the header below the photo, so it crossed the centre band in a fraction
     of the time a tall image takes — music fired and un-fired, or never fired at
     all. The card overlapping the middle fifth is what "the post you are looking
     at" actually means. */
  const cards=[];
  for(const c of chips){
    const card=c.closest(".post,.sr-card")||c;
    card.dataset.muspost=c.dataset.mustrack;
    cards.push(card);
  }
  MOBS=new IntersectionObserver((entries)=>{
    for(const e of entries){
      const p=postById(e.target.dataset.muspost);
      if(!p||!p.audioTrack)continue;
      const a=audioEl();
      /* The rule: music starts the moment a post is centred, stops the instant
         it leaves, only one ever plays, and nothing carries over between posts.
         MUSAUTOID is the POST that owns the sound — keyed on the track, two
         posts sharing a song fought each other; keyed on the post, a repeat of
         the same song restarts from the top like a fresh post should. */
      if(e.isIntersecting){
        MUSBAND.add(String(p.id));
        /* You silenced THIS post — leave it silent, but any other post clears it. */
        if(MUSMUTE!=null&&String(MUSMUTE)===String(p.id))continue;
        MUSMUTE=null;
        if(MUSAUTOID===p.id&&NOWPLAYING&&NOWPLAYING.id===p.audioTrack.id&&!a.paused)continue;
        MUSAUTOID=p.id;
        if(NOWPLAYING&&NOWPLAYING.id===p.audioTrack.id){
          a.currentTime=0;
          const pr=a.play();if(pr&&pr.catch)pr.catch(()=>{});
          paintPlayer();
        }else playTrack(p.audioTrack,true);
      }else if(MUSAUTOID===p.id&&NOWPLAYING&&NOWPLAYING.id===p.audioTrack.id){
        /* "Stops the instant it LEAVES" — leaving requires having been in.
           Every render() rebuilds this observer, and its first pass reports
           current state for every card. A post tapped while sitting OUTSIDE
           the band (the guest landing pushes the first card below it) used
           to be "not intersecting" on that first pass and got paused mid-
           load — killing the tap's own play() with an AbortError. Now an
           exit only counts if this post actually entered the band first. */
        if(!MUSBAND.has(String(p.id)))continue;
        MUSBAND.delete(String(p.id));
        if(!a.paused)a.pause();
        paintPlayer();
      }
    }
  },{rootMargin:"-40% 0px -40% 0px",threshold:0});
  cards.forEach(c=>MOBS.observe(c));
}

function wirePostOpen(){
  const ov=$("#poov");if(!ov)return;
  const x=$("#poclose");if(x)x.onclick=()=>{POSTOPEN=null;OPENCOMMENTS=null;render()};
}

/* Name + cover, owner only. The server already scopes PATCH /api/tracks/:id to
   the owner, so this adds presentation, not a new trust surface. */
function trkEditHTML(){
  const e=TRKEDIT;
  return `<div class="pcmp-ov" id="trkeov"><div class="pcmp-sheet" role="dialog" aria-label="Edit track">
    <header class="pcmp-top">
      <button class="pcmp-x" id="trkecancel">${e.fresh?"Later":"Cancel"}</button>
      <div class="pcmp-ttl">${e.fresh?"Name your track":"Edit track"}</div>
      <button class="pcmp-share" id="trkesave" ${e.title.trim()&&!e.busy?"":"disabled"}>${e.busy?"Saving…":"Save"}</button>
    </header>
    <div class="pcmp-body">
      <div class="trke-row">
        <label class="trke-art">${e.artworkUrl?`<img src="${esc(e.artworkUrl)}" alt="">`:`<span>${DI.music}<br><small>Add cover</small></span>`}
          <input type="file" id="trkeart" accept="image/*" hidden></label>
        <div class="trke-fields">
          <input class="ui-in" id="trketitle" placeholder="Track name" value="${esc(e.title)}" maxlength="120">
          ${e.artworkUrl?`<button class="trke-rm" id="trkeartrm">Remove cover</button>`:""}
        </div>
      </div>
      <div class="pcmp-note">The name and cover are yours to change any time — they travel with the track everywhere it gets used.</div>
    </div>
  </div></div>`;
}
function wireTrkEdit(){
  const ov=$("#trkeov");if(!ov)return;
  const ti=$("#trketitle");if(ti)ti.oninput=()=>{
    TRKEDIT.title=ti.value;
    const s=$("#trkesave");if(s)s.disabled=!TRKEDIT.title.trim()||TRKEDIT.busy;
  };
  const af=$("#trkeart");if(af)af.onchange=async()=>{
    const file=af.files&&af.files[0];af.value="";
    if(!file)return;
    if(!/^image\//.test(file.type))return toast("Images only");
    try{const data=await compressImage(file,700,.85);const up=await api.upload(data);
      TRKEDIT.artworkUrl=up.url||"";render();}
    catch(err){toast(err.message||"Couldn't use that image")}
  };
  const rm=$("#trkeartrm");if(rm)rm.onclick=()=>{TRKEDIT.artworkUrl="";render()};
  const cc=$("#trkecancel");if(cc)cc.onclick=()=>{TRKEDIT=null;render()};
  ov.onclick=ev=>{if(ev.target===ov&&!TRKEDIT.busy){TRKEDIT=null;render()}};
  const sv=$("#trkesave");if(sv)sv.onclick=async()=>{
    if(TRKEDIT.busy||!TRKEDIT.title.trim())return;
    TRKEDIT.busy=true;render();
    try{
      await api.updateTrack(TRKEDIT.id,{title:TRKEDIT.title.trim(),artworkUrl:TRKEDIT.artworkUrl});
      TRKEDIT=null;await loadTracks();toast("Saved.");render();
    }catch(err){TRKEDIT.busy=false;render();toast(err.message||"Save failed")}
  };
}
