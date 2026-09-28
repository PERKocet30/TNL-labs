const EMPTY={
  "general":["Say what you make.","Post one line about what you're working on. Someone here does the thing you need."],
  "collab-posts":["Looking for someone?","Say what you're building and what you're missing. That's how collabs start."],
  "graphic-design":["Post a piece.","Finished, half-done, or a bad first draft. This room is for the work.","＋ Post your work"],
  "photography":["Drop a shot.","Raw or edited. Tap ＋ to add one."],
  "clothing-design":["Show a design.","Sketch, mockup, or the real thing."],
  "clothing-drops":["What's releasing?","Post the drop before it goes live."],
  "beats":["Make something.","Open the Studio, build a loop, hit publish. Someone here writes to it."],
  "tracks":["Finished songs from the network. Press play.","Upload it here and it's in the library."],
  "anime-chat":["Start the discourse.","Anime is half the design language here. Say what's moving you."],
  "manga":["Post a panel.","Art, paneling, a page that made you stop. Bring the reference."],
  "anime-news":["What's dropping?","Seasons, announcements, releases worth the network's time."],
  "anime-ideas":["Half-formed is fine.","AKATSUKI started as idea-sharing. Post the thought before it's finished."],
  "archive":["Post a reference.","Scans, screenshots, the images everything else gets built from. No caption needed."],
  "finance":["Talk money.","Rates, invoices, what you should be charging. Nobody here got taught this."],
  "magazine":["Write something.","A feature, a review, a rant about the scene. Long is fine."],
  "news":["What's happening?","Drops, shows, moves. Keep the network current."],
  "coding":["Show what you're building.","A site, an app, a tool. Screenshot or link it."],
  "opportunities":["What do you need?","A gig, a brief, a person. Say it plainly and someone answers."],
  "anime-chat":["Start the argument.","Best arc, worst ending, the frame you can't stop thinking about."],
  "anime-news":["What dropped?","Seasons, trailers, announcements."],
  "manga":["Post the panel.","The page that made you want to draw. Or the one you drew."],
};
function emptyHTML(ch){
  const e=EMPTY[ch.id]||["Nothing here yet.","Be the first — post something real."];
  return `<div class="empty estate">
    <div class="eh">${esc(e[0])}</div>
    <div class="ep">${esc(e[1])}</div>
    ${e[2]?`<button class="btn green" id="epost">${esc(e[2])}</button>`:""}
  </div>`;
}
function renderRoomFeed(){const f=$("#feed");if(!f)return;
  /* Work gets the card, talk gets the row. */
  f.innerHTML=POSTS.length?POSTS.map((p,i)=>isCard(p)?postHTML(p):msgRowHTML(p,POSTS[i-1])).join(""):emptyHTML(CH);
  wireFeed();
  const ep=$("#epost");if(ep)ep.onclick=()=>$("#filein")?.click();}

const money=c=>"$"+(c/100).toFixed(2);

async function loadTracks(){
  try{TRACKS=(await api.tracks(TRKQ)).tracks}catch(e){TRACKS=[]}
  if(TAB==="labs"&&CH.library)render();
}

const mmss=ms=>{const s=Math.round((ms||0)/1000);return s?Math.floor(s/60)+":"+String(s%60).padStart(2,"0"):""};

function trackRowHTML(t){
  const on=NOWPLAYING&&NOWPLAYING.id===t.id;
  return `<div class="trk ${on?"on":""}" data-trk="${t.id}">
    <button class="trk-play" data-trkplay="${t.id}">${on&&AUDIO&&!AUDIO.paused?"❚❚":"▶︎"}</button>
    <div class="trk-art">${t.artworkUrl?`<img src="${esc(t.artworkUrl)}" alt="" loading="lazy">`:""}</div>
    <div class="trk-meta">
      <div class="trk-t">${esc(t.title)}</div>
      <div class="mono dim trk-by" data-u="${esc(t.by.username)}">@${esc(t.by.username)}${t.durationMs?" · "+mmss(t.durationMs):""}${t.plays?" · "+t.plays+" plays":""}</div>
    </div>
    ${t.by.username===myName()?`<button class="trk-e" data-trkedit="${t.id}">Edit</button><button class="trk-x" data-trkdel="${t.id}" aria-label="Close"><svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="square" stroke-linejoin="miter" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg></button>`:""}
  </div>`;
}

function tracksHTML(){
  return `<div class="scroll" id="trkscroll">
    <div class="trk-head">
      <input class="in trk-q" id="trkq" placeholder="Search tracks or artists…" value="${esc(TRKQ)}">
      <button class="trk-up" id="trkupbtn">${TRKUP?"Uploading…":"＋ Upload"}</button>
      <button class="trk-up trk-fromvid" id="trkvidbtn">${TRKEXT?"Extracting…":"♫ From video"}</button>
    </div>
    ${TRKVIDS?vidPickHTML():""}
    <input type="file" id="trkfile" accept="audio/*,.mp3,.m4a,.wav,.aac,.aiff,.aif,.flac,.ogg" hidden>
    <div class="trk-list">${
      !TRACKS?`<div class="empty">Loading…</div>`
      :!TRACKS.length?`<div class="empty">No tracks yet.<br><br>Upload the first one.</div>`
      :TRACKS.map(trackRowHTML).join("")}</div>
  </div>`;
}

/* One audio element for the whole app, parked outside #app so a repaint
   can't interrupt playback. Built on first use — no element for people who
   never open the library, and nothing constructed at parse time. */
let AUDIO=null, PLAYERBAR=null;
function audioEl(){
  if(AUDIO)return AUDIO;
  AUDIO=new Audio();
  AUDIO.preload="none";
  const sync=()=>{paintPlayer();if(TAB==="labs"&&CH.library)render()};
  AUDIO.addEventListener("play",sync);
  AUDIO.addEventListener("pause",sync);
  AUDIO.addEventListener("ended",sync);
  return AUDIO;
}
function paintPlayer(){
  if(!PLAYERBAR){
    PLAYERBAR=document.createElement("div");
    PLAYERBAR.className="nowbar";
    document.body.appendChild(PLAYERBAR);
    PLAYERBAR.onclick=e=>{
      if(e.target.closest("[data-nowtoggle]")){const a=audioEl();a.paused?a.play():a.pause();return}
      if(e.target.closest("[data-nowclose]")){if(AUDIO){AUDIO.pause();AUDIO.removeAttribute("src")}NOWPLAYING=null;paintPlayer();
        if(TAB==="labs"&&CH.library)render();}
    };
  }
  /* The file-banner look belongs to MUSIC LAB, where the file is the subject.
     Everywhere else the header credit is the control — Instagram has no
     global player at all. */
  const inLab=TAB==="labs"&&CH&&CH.library;
  if(!NOWPLAYING||!inLab){PLAYERBAR.style.display="none";return}
  PLAYERBAR.style.display="flex";
  PLAYERBAR.innerHTML=`<button class="now-pp" data-nowtoggle>${(!AUDIO||AUDIO.paused)?"▶︎":"❚❚"}</button>
    <div class="now-meta"><div class="now-t">${esc(NOWPLAYING.title)}</div>
    <div class="mono dim">@${esc(NOWPLAYING.by.username)}</div></div>
    <button class="now-x" data-nowclose aria-label="Close"><svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="square" stroke-linejoin="miter" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg></button>`;
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
    toast(n==="NotAllowedError"?"Tap once more to allow sound"
      :"Couldn't play that one — "+(n||"unknown"));});
  /* A play means someone chose to listen. Scrolling past isn't choosing, so
     autoplay passes silent and the counter stays honest. */
  if(!silent)api.trackPlay(t.id).catch(()=>{});
  paintPlayer();
}

function vidPickHTML(){
  return `<div class="trk-vids">${
    !TRKVIDS.length?`<div class="empty">No videos on your profile yet.<br><br>Post one first, then pull the audio.</div>`
    :TRKVIDS.map(v=>`<div class="trk-vid" data-vidpick="${esc(v.videoUrl)}">
      <div class="trk-vart">${v.thumbUrl?`<img src="${esc(v.thumbUrl)}" alt="" loading="lazy">`:"🎬"}</div>
      <div class="trk-vmeta">${esc((v.body||"").slice(0,60))||"Video"}</div>
    </div>`).join("")}</div>`;
}

function wireTracks(){
  const q=$("#trkq");
  if(q){let d=null;q.oninput=()=>{TRKQ=q.value;clearTimeout(d);d=setTimeout(loadTracks,300)}}
  const b=$("#trkupbtn");if(b)b.onclick=()=>$("#trkfile")?.click();
  const vb=$("#trkvidbtn");
  if(vb)vb.onclick=async()=>{
    if(TRKEXT)return;
    if(TRKVIDS){TRKVIDS=null;render();return}
    try{TRKVIDS=(await api.myVideos()).videos;render()}
    catch(e){toast(e.message||"Couldn't load your videos")}
  };
  document.querySelectorAll("[data-vidpick]").forEach(el=>el.onclick=async()=>{
    if(TRKEXT)return;
    const videoUrl=el.dataset.vidpick;
    const title=prompt("Track name","");
    if(!title||!title.trim())return;
    TRKEXT=true;render();
    try{
      const ex=await api.extractAudio({videoUrl});
      let durationMs=0;
      try{
        durationMs=await new Promise(res=>{
          const a=new Audio();a.preload="metadata";
          a.onloadedmetadata=()=>res(Math.round((a.duration||0)*1000));
          a.onerror=()=>res(0);a.src=ex.url;
        });
      }catch(e){}
      await api.addTrack({title:title.trim(),url:ex.url,durationMs,bytes:ex.bytes||0});
      TRKEXT=false;TRKVIDS=null;await loadTracks();toast("Pulled it.");
    }catch(e){TRKEXT=false;render();toast(e.message||"Extraction failed")}
  });
  const f=$("#trkfile");
  if(f)f.onchange=async()=>{
    const file=f.files&&f.files[0];f.value="";
    if(!file)return;
    const isAud=/^audio\//.test(file.type)||/\.(mp3|m4a|wav|aac|aiff|aif|flac|ogg)$/i.test(file.name);
    if(!isAud)return toast("Audio files only");
    if(file.size>100*1024*1024)return toast("Over 100MB — trim it down");
    /* No prompt() on the way in — the file lands, then the edit sheet opens
       pre-filled so it gets a real name and a cover in one pass. */
    const title=file.name.replace(/\.[a-z0-9]+$/i,"")||"Untitled";
    TRKUP=true;render();
    try{
      const up=await uploadStream(file);
      let durationMs=0;
      try{
        durationMs=await new Promise(res=>{
          const a=new Audio();a.preload="metadata";
          a.onloadedmetadata=()=>res(Math.round((a.duration||0)*1000));
          a.onerror=()=>res(0);a.src=up.url;
        });
      }catch(e){}
      const made=await api.addTrack({title:title.trim(),url:up.url,durationMs,bytes:file.size});
      TRKUP=false;await loadTracks();
      if(made&&made.track)TRKEDIT={id:made.track.id,title:made.track.title,artworkUrl:made.track.artworkUrl||"",busy:false,fresh:true};
      render();
    }catch(e){TRKUP=false;render();toast(e.message||"Upload failed")}
  };
  document.querySelectorAll("[data-trkplay]").forEach(el=>el.onclick=ev=>{
    ev.stopPropagation();
    const t=(TRACKS||[]).find(x=>String(x.id)===el.dataset.trkplay);
    if(t){MUSAUTOID=null;playTrack(t)}   // lab playback belongs to no post
  });
  document.querySelectorAll("[data-trkedit]").forEach(el=>el.onclick=ev=>{
    ev.stopPropagation();
    const t=(TRACKS||[]).find(x=>String(x.id)===el.dataset.trkedit);
    if(t)TRKEDIT={id:t.id,title:t.title,artworkUrl:t.artworkUrl||"",busy:false,fresh:false};
    render();
  });
  document.querySelectorAll("[data-trkdel]").forEach(el=>el.onclick=async ev=>{
    ev.stopPropagation();
    if(!confirm("Delete this track?"))return;
    try{await api.delTrack(el.dataset.trkdel);
      if(NOWPLAYING&&String(NOWPLAYING.id)===el.dataset.trkdel){if(AUDIO)AUDIO.pause();NOWPLAYING=null;paintPlayer()}
      await loadTracks()}catch(e){toast(e.message)}
  });
}

function marketHTML(){
  if(MKTVIEW==="sell"||MKTVIEW==="edit")return sellHTML();
  if(MKTVIEW==="orders")return ordersHTML();
  if(MKTVIEW==="saved")return savedHTML();
  if(MKTVIEW==="detail")return detailHTML();
  const afCount=[MKTFILT.size,MKTFILT.condition,MKTFILT.range,MKTFILT.kind,(MKTFILT.sort&&MKTFILT.sort!=="new")?MKTFILT.sort:""].filter(Boolean).length;
  return `<div class="scroll" id="mktscroll">
    <div class="shop-head">
      <div class="shop-top">
        <h2 class="shop-h">Market</h2>
        <button class="shop-sell" data-mv="sell">Sell</button>
      </div>
      <div class="shop-search">
        <label class="shop-qwrap">${UI_IC.search}<input class="in shop-q" id="mktq" aria-label="Search the market" placeholder="Search items, brands…" value="${esc(MKTFILT.q||"")}"></label>
        <button class="shop-filt ${MKTFILTOPEN?"on":""}" id="mktfiltbtn">Filters${afCount?` · ${afCount}`:""}</button>
      </div>
      <div class="shop-cats fchips">
        <button class="chip ${!MKTFILT.category?"on":""}" data-cat="">All</button>
        ${MKTMETA.categories.map(c=>`<button class="chip ${MKTFILT.category===c?"on":""}" data-cat="${esc(c)}">${esc(c)}</button>`).join("")}
      </div>
      ${MKTFILTOPEN?`<div class="shop-adv">
        ${(MKTMETA.sizes&&MKTMETA.sizes.length)?`<div class="fchips">
          <span class="dim shop-flabel">Size</span>
          <button class="chip sm ${!MKTFILT.size?"on":""}" data-size="">Any</button>
          ${MKTMETA.sizes.map(z=>`<button class="chip sm ${MKTFILT.size===z?"on":""}" data-size="${esc(z)}">${esc(z)}</button>`).join("")}
        </div>`:""}
        <div class="fchips">
          <span class="dim shop-flabel">Condition</span>
          <button class="chip sm ${!MKTFILT.condition?"on":""}" data-cond="">Any</button>
          ${(MKTMETA.conditions||[]).map(c=>`<button class="chip sm ${MKTFILT.condition===c?"on":""}" data-cond="${esc(c)}">${esc(c)}</button>`).join("")}
        </div>
        <div class="fchips">
          <span class="dim shop-flabel">Price</span>
          ${[["","Any"],["0-25","Under $25"],["25-50","$25–50"],["50-100","$50–100"],["100-","$100+"]].map(([v,l])=>
            `<button class="chip sm ${(MKTFILT.range||"")===v?"on":""}" data-range="${v}">${l}</button>`).join("")}
        </div>
        <div class="fchips">
          <span class="dim shop-flabel">Show</span>
          <button class="chip sm ${!MKTFILT.kind?"on":""}" data-mkind="">Everything</button>
          <button class="chip sm ${MKTFILT.kind==="physical"?"on":""}" data-mkind="physical">Physical</button>
        </div>
        <div class="fchips">
          <span class="dim shop-flabel">Sort</span>
          ${[["new","Newest"],["low","Price ↑"],["high","Price ↓"],["liked","Most saved"]].map(([v,l])=>
            `<button class="chip sm ${(MKTFILT.sort||"new")===v?"on":""}" data-sort="${v}">${l}</button>`).join("")}
        </div>
        ${(MKTFILT.category||MKTFILT.size||MKTFILT.condition||MKTFILT.range||MKTFILT.q||MKTFILT.kind||(MKTFILT.sort&&MKTFILT.sort!=="new"))?
          `<button class="clearf" id="clearfilt">Clear all</button>`:""}
      </div>`:""}
      <div class="shop-links">
        <button class="shop-link" data-mv="saved">${MK_HEART(false)} Saved</button>
        <button class="shop-link" data-mv="orders">My orders</button>
      </div>
    </div>
    <div class="mkt-grid" id="mktgrid">${!MKT?`<div class="empty">Loading…</div>`
      :!MKT.length?`<div class="empty">Nothing listed yet.</div>`
      :MKT.map(mktCardHTML).join("")}</div>
  </div>`}

function mktCardHTML(l){
  if(l.kind==="loop")return `<button class="mcard loop" data-mopen="${l.id}">
    <div class="mloop">
      <div class="mloop-ic">${UI_IC.music}</div>
      ${l.isFree?`<span class="freetag">Free</span>`:""}
      ${l.bpm?`<span class="bpmtag mono">${l.bpm} BPM${l.musicalKey?" · "+esc(l.musicalKey):""}</span>`:""}
    </div>
    <div class="mbody">
      <div class="mtitle">${esc(l.title)}</div>
      <div class="mprice">${l.isFree?"Free":money(l.price)}</div>
      <div class="dim mloop-by">@${esc(l.seller.username)}</div>
    </div>
  </button>`;return `<div class="mcard" data-mopen="${l.id}">
  <div class="mimgwrap"><img class="mimg" src="${esc(l.images[0]||"")}" alt="${esc(l.title)}" loading="lazy">
    ${l.status==="sold"?`<div class="soldtag">SOLD</div>`:""}
    ${l.size?`<span class="msize">${esc(l.size)}</span>`:""}
    <button class="mlike ${l.likedByMe?"on":""}" data-mlike="${l.id}">${MK_HEART(l.likedByMe)}${l.likeCount?" "+l.likeCount:""}</button>
  </div>
  <div class="mbody">
    <div class="mprice">${money(l.price)}</div>
    <div class="mtitle">${esc(l.title)}</div>
  </div>
</div>`}

function loopDetailHTML(l){
  const mine=l.seller.username===myName();
  return `<div class="scroll" id="mktscroll">
    <div class="dnav"><button class="backb2" data-mv="browse">← Market</button>
      <button class="backb2" data-mshare="${l.id}">Share</button>
      ${mine?`<button class="backb2" data-medit="${l.id}">Edit</button>`:""}</div>
    <div class="dwrap">
      <div class="loopart ${l.images[0]?"":"noart"}">
        ${l.images[0]?`<img src="${esc(l.images[0])}" alt="">`:`<div class="loopglyph">♫</div>`}
        <button class="loopplay" id="loopplay" aria-label="Play">▶︎</button>
      </div>
      <audio id="loopaudio" src="${esc(l.audioUrl||"")}" preload="none"></audio>

      <div class="dhead">
        <div>
          <h2 class="dtitle">${esc(l.title)}</h2>
          <div class="mono dim">${esc(l.category)}${l.bpm?" · "+l.bpm+" BPM":""}${l.musicalKey?" · "+esc(l.musicalKey):""}${l.stems?" · STEMS":""}</div>
        </div>
        <div class="dprice">${l.isFree?`<span class="freebig">FREE</span>`:money(l.price)}</div>
      </div>

      ${l.description?`<p class="ddesc">${rich(l.description)}</p>`:""}

      <div class="dseller" data-u="${esc(l.seller.username)}">
        ${avHTML(l.seller,"sm")}
        <div style="flex:1;min-width:0">
          <div style="font-weight:900;font-size:13px">${esc(l.seller.displayName)}</div>
          <div class="mono dim">@${esc(l.seller.username)} · L${l.seller.level}</div>
          ${MKTSELLER&&MKTSELLER.rating!==null?`<div class="trust mono"><span class="star">★ ${MKTSELLER.rating.toFixed(1)}</span> <span class="dim">(${MKTSELLER.reviews})</span></div>`:""}
        </div>
        <span class="mono dim">${l.downloads||0} grabbed</span>
      </div>

      ${l.status==="active"?`
        ${mine?`<div class="mono dim" style="margin-top:14px">This is yours.${l.downloads?` <button class="st-link" id="whograbbed">See who's grabbed it →</button>`:""}</div>`
        :l.isFree?`
          <button class="btn green wide" data-grab="${l.id}">↓ Grab it — free</button>
          <div class="mono dim" style="margin-top:8px;line-height:1.6">${esc(l.seller.displayName)} gets told you took it. If you build something with it, tell them — that's a collab.</div>`
        :`
          <button class="btn green wide" data-buy="${l.id}">Buy — ${money(l.price)}</button>
          ${l.acceptsOffers?`<button class="btn ghost wide" data-offer="${l.id}">Make an offer</button>`:""}
          <div class="mono dim" style="margin-top:8px">Instant download. Nothing to ship.</div>`}
      `:`<div class="mono dim" style="margin-top:14px">No longer available.</div>`}

      ${MKTSIMILAR.length?`<div class="simwrap">
        <div class="mono dim sim-h">MORE LIKE THIS</div>
        <div class="simrow">${MKTSIMILAR.map(x=>`<button class="simcard" data-mopen="${x.id}">
          ${x.images[0]?`<img src="${esc(x.images[0])}" alt="">`:`<div class="simglyph">♫</div>`}
          <div class="simt">${esc(x.title)}</div>
          <div class="simp">${x.isFree?"Free":money(x.price)}</div>
        </button>`).join("")}</div>
      </div>`:""}
    </div>
  </div>`}

