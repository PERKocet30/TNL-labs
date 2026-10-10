function workCardHTML(p, collab, K, pinned) {
  K = K || KIND;
  const accepted = p.collaborators.filter(c => c.status === "accepted");
  const kind = p.beat ? "BEAT" : p.videoUrl ? "VIDEO" : p.imageUrl ? "IMAGE" : "POST";
  /* A tile is an index, not the work. Image plus an indicator that there is more
     inside — author, sound, actions, caption and comments all belong to the
     expanded card the tile opens (021's overlay). Keeps the profile a scannable
     grid instead of a second feed. */
  const many = p.images && p.images.length > 1;
  return `<div class="work" data-openpost="${p.id}">
    ${p.beat ? `<div class="work-beat"><button class="circle" style="width:28px;height:28px;font-size:12px" data-beatplay='${esc(JSON.stringify(p.beat))}' aria-label="Play">${DI.play}</button><span class="nm">${esc(p.beat.name || "untitled loop")}</span><span class="mono dim">${p.beat.bpm}BPM</span></div>`
      : (many || p.imageUrl) ? `<img class="work-img" src="${esc(imgSmall(pxImgs(p)[0]))}" alt="work" loading="lazy" decoding="async">`
      /* NOT a <video>. With preload="none" and no poster the element renders
         empty AND, on iOS, swallows the tap instead of letting it bubble to
         .work[data-openpost] — so the tile looked blank and could not be
         opened at all. A tile only ever needs to look like something and be
         tappable; the real player lives in the expanded post. Replace with a
         plain div until videos get real poster frames generated at upload. */
      : p.videoUrl ? (p.thumbUrl && p.thumbUrl !== p.imageUrl ? `<img class="work-img" src="${esc(p.thumbUrl)}" alt="video" loading="lazy" decoding="async">` : `<div class="work-vid" aria-label="Video"></div>`)
      : `<div class="work-body">${esc(p.body || "—")}</div>`}
    ${pinned ? `<span class="work-ind work-pin" aria-label="Pinned">${PF_PIN}</span>` : many ? `<span class="work-ind" aria-label="${p.images.length} photos">${DI.stack}</span>`
      : p.videoUrl ? `<span class="work-ind" aria-label="Video">${DI.video}</span>` : ""}
  </div>`;
}

/* ── Music on the profile (v2.3 · 2026-10-10) ─────────────────────────
   Songs aren't pictures, so they have their own Music tab (v2.2), like an
   artist page on Spotify — Play, then the songs, each with its cover,
   plays and length. v2.3 adds what an artist page has:
     - a pinned song at the top (⋯ → Pin to top, on your own page)
     - ⋯ → Share song: a /s/:id link that previews right in an Instagram DM
     - Merch: the artist's Market listings under their music
   Tap a song to play it, again to pause; when one ends the next one down
   plays. It's a post's kind of sound (MUSAUTOID = "trk<id>"): it plays
   while the list is on screen and stops when you leave it.
   A /s/:id page's "Open in the app" lands here with that song picked out
   (PFSONG). Server: server-12-music.js. Styles: app-05-styles-music.css. */
let PFSONG=null;
const trkOn=t=>MUSAUTOID==="trk"+t.id&&NOWPLAYING&&NOWPLAYING.id===t.id&&AUDIO&&!AUDIO.paused;
/* The songs in the order they show: the pinned one first, then newest. */
function profileSongs(){
  const T=PROFILE&&PROFILE.tracks||[], pin=PROFILE&&PROFILE.pinnedTrack;
  const p=pin&&T.find(t=>t.id===pin);
  return p?[p,...T.filter(t=>t!==p)]:T;
}
function musicTabHTML(mine){
  const T=profileSongs(), pin=PROFILE.pinnedTrack;
  if(!T.length)return `<div class="empty">${mine?"Your music lives here. Upload a song from + Post → Add music, or in // Music.":"No music yet."}</div>`;
  const plays=T.reduce((n,t)=>n+(t.plays||0),0), cur=T.find(trkOn), L=(PROFLISTINGS||[]).filter(l=>l.status!=="sold").slice(0,8);
  return `<div class="pmus">
    <div class="pmus-top"><button class="pmus-play" data-pftrk="${(cur||T[0]).id}" aria-label="${cur?"Pause":"Play"}">${cur?DI.pause:DI.play}</button>
      <span class="pmus-sum"><b>${T.length} song${T.length===1?"":"s"}</b><span>${plays.toLocaleString()} play${plays===1?"":"s"}</span></span></div>
    <div class="pmus-list" role="list">${T.map((t,i)=>{const on=trkOn(t),pinned=t.id===pin;
      return `<div class="pmus-row${on?" on":""}${PFSONG===t.id?" hl":""}" role="button" tabindex="0" data-pftrk="${t.id}" data-trkown="trk${t.id}" aria-label="${on?"Pause":"Play"} ${esc(t.title)}">
        <span class="pmus-n">${on?UI_IC.music:pinned?PF_PIN:i+1-(pin&&T[0].id===pin?1:0)}</span>
        <span class="pmus-art">${t.artworkUrl?`<img src="${esc(t.artworkUrl)}" alt="" loading="lazy" decoding="async">`:UI_IC.music}</span>
        <span class="pmus-t"><b>${esc(t.title)}</b><span>${pinned?"Pinned · ":""}${(t.plays||0).toLocaleString()} play${t.plays===1?"":"s"}</span></span>
        <span class="pmus-d">${mmss(t.durationMs)}</span>
        <button class="pmus-more" data-pftrkmore="${t.id}" aria-label="More for ${esc(t.title)}">${DI.more}</button></div>`}).join("")}</div>
    ${L.length?`<div class="pmus-merch"><div class="pmus-h"><b>Merch</b><button data-ptab="shop">See all</button></div>
      <div class="pmus-mrow">${L.map(mktCardHTML).join("")}</div></div>`:""}
  </div>`;
}
/* After a song ends on a profile: the next one down, if there is one. */
function nextProfileTrack(){
  const T=profileSongs(), i=T.findIndex(t=>"trk"+t.id===MUSAUTOID);
  return i>=0&&i<T.length-1?T[i+1]:null;
}
const songLink=t=>location.origin+"/s/"+t.id;
const SONG_PIN=di('<path d="M9 4h6l-1 6 3 3H7l3-3zM12 13v7"/>',18);   // drawn, so the picker shows it
function songMenu(t){
  const mine=PROFILE&&PROFILE.user.username===myName(), pinned=PROFILE&&PROFILE.pinnedTrack===t.id;
  openPicker({title:t.title,items:[
    {label:"Share song",sub:"A link that shows the cover and plays — Instagram DMs included",icon:DI.out,act:"share"},
    ...(mine?[{label:pinned?"Unpin":"Pin to top",sub:pinned?"Back in with the rest":"First on your Music tab",icon:SONG_PIN,act:"pin"}]:[])],
    onPick:async it=>{
      if(it.act==="share")return shareMenu({title:t.title+" — @"+(t.by&&t.by.username||""),link:songLink(t)});
      try{const d=await req("/api/me/pinned-track",{method:"POST",body:{trackId:pinned?null:t.id}});
        if(PROFILE){PROFILE.pinnedTrack=d.pinnedTrack;PROFCACHE.delete(PROFILE.user.username)}
        toast(pinned?"Unpinned":"Pinned to the top");render()}catch(e){toast(e.message)}}});
}
(function wireProfileMusic(){
  /* capture phase, like the post music chips — before anything else takes the tap */
  document.addEventListener("click",e=>{
    const m=e.target.closest("[data-pftrkmore]"), b=m||e.target.closest("[data-pftrk]");if(!b)return;
    const id=m?m.dataset.pftrkmore:b.dataset.pftrk;
    const t=(PROFILE&&PROFILE.tracks||[]).find(x=>String(x.id)===id);if(!t)return;
    e.stopPropagation();e.preventDefault();
    if(m)return songMenu(t);
    MUSOK=true;MUSAUTOID="trk"+t.id;PFSONG=null;
    playTrack(t);render();
  },true);
})();

/* ── PROFILE v2 · 2026-10-07 ───────────────────────────────────────────
   Instagram's shape, TNL's look. Username up top with ＋ and ≡ (yours) or
   ⋯ (theirs); photo and three numbers you can open (posts, followers,
   following); name, pronouns and level as a quiet pill; what you make; bio
   with @mentions; links; "Followed by …"; two buttons; four tabs — work,
   shop, collabs, tagged. Pinned work first. The level ladder, the rate
   maths, Block/Report, Admin and Log out all moved off the page: into the
   ≡ / ⋯ menus and one compact Levels sheet. */
const PF_PIN=`<svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor" aria-hidden="true"><path d="M15 3l6 6-3 1-4 4 1 5-2 2-4-4-5 5-1-1 5-5-4-4 2-2 5 1 4-4z"/></svg>`;
function sheetHTML(){const u=PROFILE.user,l=levelFor(u.rep);
  const mine=u.username===myName();
  const st=PROFILE.stats||{posts:0,likesReceived:0,collabs:0};
  if(EDITING&&mine)return editProfileHTML();
  const K=kindOf(u), ld=PROFILE.loading;
  const acc=inkFor(u.accentHex||"#98FC68");   // never bypass the theme correction
  /* Your own profile is the page; anyone else's stays a peek (sheet). */
  const pins=(u.pinned||[]).map(Number);
  const pinnedFirst=list=>[...pins.map(id=>list.find(p=>Number(p.id)===id)).filter(Boolean),...list.filter(p=>!pins.includes(Number(p.id)))];
  const list=PTAB==="collabs"?PROFILE.collabs:PTAB==="tagged"?(PROFTAGGED||[]):pinnedFirst(PROFILE.posts);
  const links=u.links&&u.links.length?u.links:(u.link?[{title:"",url:/^https?:\/\//.test(u.link)?u.link:"https://"+u.link}]:[]);
  const linkTxt=x=>x.title||x.url.replace(/^https?:\/\/(www\.)?/,"").replace(/\/$/,"");
  const fb=PROFILE.followedBy;
  const num=(n,label,attr)=>`<${attr?`button ${attr}`:"div"} class="pstat"><b>${ld?"—":n}</b><span>${label}</span></${attr?"button":"div"}>`;
  return `<div class="sheet ${mine?"astab":""}" id="sheetbg"><div class="sheetc pig" style="--green:${acc}">
  <div class="sheeth pig-top"><div class="pig-user">${esc(u.username)}</div>
    <div class="pig-topr">${mine?`${ld?"":`<button class="pig-plus" id="profpost" aria-label="New post">${UI_IC.plusSq}</button>`}<button class="pig-plus" id="profmenu" aria-label="Settings">${PF_MENU}</button>`
      :`<button class="pig-plus" id="profmore" aria-label="More">${DI.more}</button><button class="x" id="sheetx" aria-label="Close"><svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="square" stroke-linejoin="miter" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg></button>`}</div></div>

  <div class="pig-head">
    ${u.avatarUrl?`<img class="pav pig-av" src="${esc(u.avatarUrl)}" alt="">`:`<div class="pav pig-av">${esc(u.displayName.slice(0,2).toUpperCase())}</div>`}
    <div class="pstats pig-stats ${ld?"sk":""}">
      ${num(st.posts,esc(K.work.toLowerCase()))}
      ${num(PROFILE.followers,"followers",`data-flist="followers"`)}
      ${num(PROFILE.following??0,"following",`data-flist="following"`)}
    </div>
  </div>

  <div class="pig-name"><span class="pname">${esc(u.displayName)}</span>${u.pronouns?`<span class="pig-pro">${esc(u.pronouns)}</span>`:""}<button class="pig-lvl" id="lvlpill" title="${esc(l.name)}">L${l.id}</button></div>
  <div class="pig-cat">${(u.roles&&u.roles.length?u.roles:[u.role]).filter(Boolean).map(r=>esc(r)).join(" · ")}</div>
  ${u.bio?`<div class="pbio">${rich(u.bio)}</div>`:""}
  ${links.length?`<div class="plinks"><a class="plink" href="${esc(links[0].url)}" target="_blank" rel="noreferrer nofollow">${UI_IC.link}${esc(linkTxt(links[0]))}</a>${links.length>1?`<button class="plink-more" id="pflinks">and ${links.length-1} more</button>`:""}</div>`:""}
  ${fb?`<div class="pfb">Followed by ${fb.names.map(n=>`<b data-u="${esc(n)}">${esc(n)}</b>`).join(", ")}${fb.count>fb.names.length?` and ${fb.count-fb.names.length} other${fb.count-fb.names.length>1?"s":""}`:""}</div>`:""}

  <div class="pactions">
    ${ld?`<div class="skelbtn"></div>`:mine?`<button class="btn ghost" id="editb">Edit profile</button>
      <button class="btn ghost" id="shareprof" data-share-u="${esc(u.username)}">Share profile</button>`
      :`<button class="btn ${PROFILE.youFollow?"ghost":"green"}" id="followb">${PROFILE.youFollow?"Following":"Follow"}</button>
        <button class="btn ghost" id="msgb">Message</button>`}
  </div>

  <div class="ptabs" role="tablist">
    <button class="ptab ${PTAB==="work"?"on":""}" data-ptab="work" role="tab" aria-selected="${PTAB==="work"}" aria-label="${esc(K.work.charAt(0)+K.work.slice(1).toLowerCase())} ${st.posts}">${UI_IC.tabGrid}</button>
    ${(PROFILE.tracks||[]).length||mine?`<button class="ptab ${PTAB==="music"?"on":""}" data-ptab="music" role="tab" aria-selected="${PTAB==="music"}" aria-label="Music ${(PROFILE.tracks||[]).length}">${UI_IC.music}</button>`:""}
    <button class="ptab ${PTAB==="shop"?"on":""}" data-ptab="shop" role="tab" aria-selected="${PTAB==="shop"}" aria-label="Shop">${UI_IC.tabShop}</button>
    <button class="ptab ${PTAB==="collabs"?"on":""}" data-ptab="collabs" role="tab" aria-selected="${PTAB==="collabs"}" aria-label="Collabs ${PROFILE.collabs.length}">${UI_IC.tabCollab}</button>
    <button class="ptab ${PTAB==="tagged"?"on":""}" data-ptab="tagged" role="tab" aria-selected="${PTAB==="tagged"}" aria-label="Tagged">${PF_TAGGED}</button>
  </div>

  ${PTAB==="music"&&!ld?musicTabHTML(mine)
  :PTAB==="shop"?`<div class="mkt-grid" style="padding:14px 0 30px">${PROFLISTINGS===null?`${skel("tiles")}`:PROFLISTINGS.length?PROFLISTINGS.map(mktCardHTML).join(""):`<div class="empty">${mine?"Nothing listed yet. Head to Market → Sell to put something up.":"Not selling anything right now."}</div>`}</div>`
  :ld||(PTAB==="tagged"&&PROFTAGGED===null)?`<div class="worklist asgrid">${[0,1,2].map(()=>`<div class="work skel"><div class="skelbar"></div></div>`).join("")}</div>`
  :list.length?`<div class="worklist ${K.grid||PTAB==="tagged"?"asgrid":""}">${list.map(p=>workCardHTML(p,PTAB==="collabs",K,PTAB==="work"&&pins.includes(Number(p.id)))).join("")}</div>`
  :`<div class="empty">${PTAB==="collabs"?"No collabs yet.":PTAB==="tagged"?(mine?"When people tag you in their work, it shows up here.":"No tagged posts yet."):mine?K.empty+" Hit + Post and it lands here.":esc(K.empty)}</div>`}
</div></div>`}

/* ---- wiring ---- */
