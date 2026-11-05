/* PROFILE v2026-11-05b: tournament badges as achievement emblems (crest + star, crown for Champion), tap → the event. v2026-11-05: tournament badges under the name. v2026-10-28: a Lab Lead's profile says which labs they lead (tap → the lab). v2026-10-20: the head comes from the screen kit (app/core/kit.js); Follow is the black main action */
function workCardHTML(p, collab, K, pinned) {
  K = K || KIND;
  const accepted = p.collaborators.filter(c => c.status === "accepted");
  const kind = p.videoUrl ? "VIDEO" : p.imageUrl ? "IMAGE" : "POST";
  /* A tile is an index, not the work. Image plus an indicator that there is more
     inside — author, sound, actions, caption and comments all belong to the
     expanded card the tile opens (021's overlay). Keeps the profile a scannable
     grid instead of a second feed. */
  const many = p.images && p.images.length > 1;
  return `<div class="work" data-openpost="${p.id}">
    ${(many || p.imageUrl) ? `<img class="work-img" src="${esc(imgSmall(pxImgs(p)[0]))}" alt="work" loading="lazy" decoding="async">`
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
   Songs aren't pictures, so they have their own Music tab (v2.2), an
   artist page — Play, then the songs, each with its cover,
   plays and length. v2.3 adds what an artist page has:
     - a pinned song at the top (⋯ → Pin to top, on your own page)
     - ⋯ → Share song: a /s/:id link that previews right in an Instagram DM
     (Merch under the music came out 2026-10-11 — their Shop tab has it.)
   Tap a song to play it, again to pause; when one ends the next one down
   plays. It's a post's kind of sound (MUSAUTOID = "trk<id>"): it plays
   while the list is on screen and stops when you leave it.
   A /s/:id page's "Open in the app" lands here with that song picked out
   (PFSONG). Server: server/music/music.js. Styles: app/styles/music.css. */
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
  const plays=T.reduce((n,t)=>n+(t.plays||0),0), cur=T.find(trkOn);
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
      if(it.act==="share")return shareMenu({title:t.title+" — @"+(t.by&&t.by.username||""),link:songLink(t),story:`/tr/${t.id}/story.jpg`});
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
   Username up top with ＋ and ≡ (yours) or
   ⋯ (theirs); photo and three numbers you can open (posts, followers,
   following); name, pronouns and level as a quiet pill; what you make; bio
   with @mentions; links; "Followed by …"; two buttons; four tabs — work,
   shop, collabs (Tagged came out 2026-10-18: "no need for tag section"). Pinned work first. The level ladder, the rate
   maths, Block/Report, Admin and Log out all moved off the page: into the
   ≡ / ⋯ menus and one compact Levels sheet. */
const PF_PIN=`<svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor" aria-hidden="true"><path d="M15 3l6 6-3 1-4 4 1 5-2 2-4-4-5 5-1-1 5-5-4-4 2-2 5 1 4-4z"/></svg>`;
function sheetHTML(){const u=PROFILE.user,l=levelFor(u.rep);
  const mine=u.username===myName();
  const st=PROFILE.stats||{posts:0,likesReceived:0,collabs:0};
  if(EDITING&&mine)return editProfileHTML();
  const K=kindOf(u), ld=PROFILE.loading;
  const acc=inkFor(accFill(u.accentHex||"#98FC68"));   // never bypass the theme correction
  /* Your own profile is the page; anyone else's stays a peek (sheet). */
  const pins=(u.pinned||[]).map(Number);
  const pinnedFirst=list=>[...pins.map(id=>list.find(p=>Number(p.id)===id)).filter(Boolean),...list.filter(p=>!pins.includes(Number(p.id)))];
  const list=PTAB==="collabs"?PROFILE.collabs:pinnedFirst(PROFILE.posts);
  const links=u.links&&u.links.length?u.links:(u.link?[{title:"",url:/^https?:\/\//.test(u.link)?u.link:"https://"+u.link}]:[]);
  const linkTxt=x=>x.title||x.url.replace(/^https?:\/\/(www\.)?/,"").replace(/\/$/,"");
  const fb=PROFILE.followedBy;
  const num=(n,label,attr)=>`<${attr?`button ${attr}`:"div"} class="pstat"><b>${ld?"—":n}</b><span>${label}</span></${attr?"button":"div"}>`;
  return `<div class="sheet ${mine?"astab":""}" id="sheetbg"><div class="sheetc pig" style="--green:${acc}">
  ${screenHead({back:mine?null:{id:"sheetx",label:"Close"},title:u.username,actions:mine?[ld?"":`<button class="ib" id="profpost" aria-label="New post">${UI_IC.plusSq}</button>`,`<button class="ib" id="profmenu" aria-label="Settings">${PF_MENU}</button>`]
    :[`<button class="ib" id="profmore" aria-label="More">${DI.more}</button>`]})}

  <div class="pig-head">
    ${u.avatarUrl?`<img class="pav pig-av"${avRing(u)[1]} src="${esc(u.avatarUrl)}" alt="">`:`<div class="pav pig-av"${avRing(u)[1]}>${esc(u.displayName.slice(0,2).toUpperCase())}</div>`}
    <div class="pstats pig-stats ${ld?"sk":""}">
      ${num(st.posts,esc(K.work.toLowerCase()))}
      ${num(PROFILE.followers,"followers",`data-flist="followers"`)}
      ${num(PROFILE.following??0,"following",`data-flist="following"`)}
    </div>
  </div>

  <div class="pig-name"><span class="pname">${esc(u.displayName)}</span>${u.pronouns?`<span class="pig-pro">${esc(u.pronouns)}</span>`:""}<button class="pig-lvl" id="lvlpill" title="${esc(l.name)}">L${l.id}</button></div>
  <div class="pig-cat">${(u.roles&&u.roles.length?u.roles:[u.role]).filter(Boolean).map(r=>esc(r)).join(" · ")}</div>
  ${(u.leads||[]).length?`<div class="pig-lead">Lead · ${u.leads.map(id=>{const lb=LABS.find(x=>x.id===id);return lb?`<button data-pflab="${esc(id)}">${esc(labMark(lb.name))}</button>`:""}).join(" ")}</div>`:""}
  ${pfBadgesHTML(PROFILE.badges)}
  ${u.bio?`<div class="pbio">${rich(u.bio)}</div>`:""}
  ${links.length?`<div class="plinks"><a class="plink" href="${esc(links[0].url)}" target="_blank" rel="noreferrer nofollow">${UI_IC.link}${esc(linkTxt(links[0]))}</a>${links.length>1?`<button class="plink-more" id="pflinks">and ${links.length-1} more</button>`:""}</div>`:""}
  ${fb?`<div class="pfb">Followed by ${fb.names.map(n=>`<b data-u="${esc(n)}">${esc(n)}</b>`).join(", ")}${fb.count>fb.names.length?` and ${fb.count-fb.names.length} other${fb.count-fb.names.length>1?"s":""}`:""}</div>`:""}

  <div class="pactions">
    ${ld?`<div class="skelbtn"></div>`:mine?`<button class="btn ghost" id="editb">Edit profile</button>
      <button class="btn ghost" id="shareprof" data-share-u="${esc(u.username)}">Share profile</button>`
      :`<button class="btn ${PROFILE.youFollow?"ghost":""}" id="followb">${PROFILE.youFollow?"Following":"Follow"}</button>
        <button class="btn ghost" id="msgb">Message</button>`}
  </div>

  <div class="ptabs" role="tablist">
    <button class="ptab ${PTAB==="work"?"on":""}" data-ptab="work" role="tab" aria-selected="${PTAB==="work"}" aria-label="${esc(K.work.charAt(0)+K.work.slice(1).toLowerCase())} ${st.posts}">${UI_IC.tabGrid}</button>
    ${(PROFILE.tracks||[]).length||mine?`<button class="ptab ${PTAB==="music"?"on":""}" data-ptab="music" role="tab" aria-selected="${PTAB==="music"}" aria-label="Music ${(PROFILE.tracks||[]).length}">${UI_IC.music}</button>`:""}
    <button class="ptab ${PTAB==="shop"?"on":""}" data-ptab="shop" role="tab" aria-selected="${PTAB==="shop"}" aria-label="Shop">${UI_IC.tabShop}</button>
    <button class="ptab ${PTAB==="collabs"?"on":""}" data-ptab="collabs" role="tab" aria-selected="${PTAB==="collabs"}" aria-label="Collabs ${PROFILE.collabs.length}">${UI_IC.tabCollab}</button>
  </div>

  ${PTAB==="music"&&!ld?musicTabHTML(mine)
  :PTAB==="shop"?`<div class="mkt-grid" style="padding:14px 0 30px">${PROFLISTINGS===null?`${skel("tiles")}`:PROFLISTINGS.length?PROFLISTINGS.map(mktCardHTML).join(""):`<div class="empty">${mine?"Nothing listed yet. Head to Market → Sell to put something up.":"Not selling anything right now."}</div>`}</div>`
  :ld?`<div class="worklist asgrid">${[0,1,2].map(()=>`<div class="work skel"><div class="skelbar"></div></div>`).join("")}</div>`
  :list.length?`<div class="worklist ${K.grid?"asgrid":""}">${list.map(p=>workCardHTML(p,PTAB==="collabs",K,PTAB==="work"&&pins.includes(Number(p.id)))).join("")}</div>`
  :`<div class="empty">${PTAB==="collabs"?"No collabs yet.":mine?K.empty+" Hit + Post and it lands here.":esc(K.empty)}</div>`}
</div></div>`}

/* Tournament badges (2026-11-05, v2 "more of a badge like video games"):
   an achievement shelf under the name. Each badge is an emblem — a crest
   with a star, a crown, a laurel wreath, light rays and a glint for the
   Champion (the prestige one), a smaller wreath for a Finalist; an OG ribbon on every badge from the
   first tournament ever, so its Entrants hold something rare too — with the place and the
   tournament under it. Champion wears the Lab green, Finalist is solid,
   Entrant an outline. Best place first; the shelf scrolls sideways when
   it's long. A tap opens the event (the app-wide data-evopen handler,
   app/events/wire.js). Colours come from the theme (profile2.css). */
const PF_BADGE_NAME={champion:"Champion",finalist:"Finalist",entrant:"Entrant"};
function pfEmblem(tier,og){
  const c=tier==="champion",f=tier==="finalist";
  return `<svg class="bd-em" viewBox="0 0 88 84" aria-hidden="true">
    ${c?`<g class="bd-rays"><line x1="44.0" y1="20.0" x2="44.0" y2="-2.0"/><line x1="54.0" y1="22.7" x2="65.0" y2="3.6"/><line x1="61.3" y1="30.0" x2="80.4" y2="19.0"/><line x1="64.0" y1="40.0" x2="86.0" y2="40.0"/><line x1="61.3" y1="50.0" x2="80.4" y2="61.0"/><line x1="54.0" y1="57.3" x2="65.0" y2="76.4"/><line x1="44.0" y1="60.0" x2="44.0" y2="82.0"/><line x1="34.0" y1="57.3" x2="23.0" y2="76.4"/><line x1="26.7" y1="50.0" x2="7.6" y2="61.0"/><line x1="24.0" y1="40.0" x2="2.0" y2="40.0"/><line x1="26.7" y1="30.0" x2="7.6" y2="19.0"/><line x1="34.0" y1="22.7" x2="23.0" y2="3.6"/></g>`:""}
    ${c?`<g class="bd-laurel"><ellipse cx="28.4" cy="79.5" rx="3" ry="6.5" transform="rotate(-10 28.4 79.5)"/><ellipse cx="18.2" cy="72.5" rx="3" ry="6.5" transform="rotate(9 18.2 72.5)"/><ellipse cx="10.9" cy="62.6" rx="3" ry="6.5" transform="rotate(28 10.9 62.6)"/><ellipse cx="7.3" cy="50.8" rx="3" ry="6.5" transform="rotate(48 7.3 50.8)"/><ellipse cx="7.8" cy="38.5" rx="3" ry="6.5" transform="rotate(67 7.8 38.5)"/><ellipse cx="12.2" cy="27.0" rx="3" ry="6.5" transform="rotate(86 12.2 27.0)"/><ellipse cx="20.2" cy="17.7" rx="3" ry="6.5" transform="rotate(105 20.2 17.7)"/><ellipse cx="59.6" cy="79.5" rx="3" ry="6.5" transform="rotate(10 59.6 79.5)"/><ellipse cx="69.8" cy="72.5" rx="3" ry="6.5" transform="rotate(-9 69.8 72.5)"/><ellipse cx="77.1" cy="62.6" rx="3" ry="6.5" transform="rotate(-28 77.1 62.6)"/><ellipse cx="80.7" cy="50.8" rx="3" ry="6.5" transform="rotate(-48 80.7 50.8)"/><ellipse cx="80.2" cy="38.5" rx="3" ry="6.5" transform="rotate(-67 80.2 38.5)"/><ellipse cx="75.8" cy="27.0" rx="3" ry="6.5" transform="rotate(-86 75.8 27.0)"/><ellipse cx="67.8" cy="17.7" rx="3" ry="6.5" transform="rotate(-105 67.8 17.7)"/></g>`:f?`<g class="bd-laurel"><ellipse cx="28.4" cy="79.5" rx="3" ry="6.5" transform="rotate(-10 28.4 79.5)"/><ellipse cx="16.4" cy="70.6" rx="3" ry="6.5" transform="rotate(13 16.4 70.6)"/><ellipse cx="8.9" cy="57.6" rx="3" ry="6.5" transform="rotate(37 8.9 57.6)"/><ellipse cx="7.1" cy="42.8" rx="3" ry="6.5" transform="rotate(60 7.1 42.8)"/><ellipse cx="59.6" cy="79.5" rx="3" ry="6.5" transform="rotate(10 59.6 79.5)"/><ellipse cx="71.6" cy="70.6" rx="3" ry="6.5" transform="rotate(-13 71.6 70.6)"/><ellipse cx="79.1" cy="57.6" rx="3" ry="6.5" transform="rotate(-37 79.1 57.6)"/><ellipse cx="80.9" cy="42.8" rx="3" ry="6.5" transform="rotate(-60 80.9 42.8)"/></g>`:""}
    <g transform="translate(12 10)">
    ${c?`<path class="bd-crown" d="M19 15 L21 3 L27 9 L32 1 L37 9 L43 3 L45 15 Z"/>`:""}
    <path class="bd-shield" d="M32 10 L56 18 V38 C56 53 45 63 32 68 C19 63 8 53 8 38 V18 Z"/>
    <path class="bd-rim" d="M32 15 L51 21.5 V38 C51 50 42.5 58 32 62.5 C21.5 58 13 50 13 38 V21.5 Z"/>
    <polygon class="bd-star" points="32.0,26.0 34.9,34.0 43.4,34.3 36.8,39.5 39.1,47.7 32.0,43.0 24.9,47.7 27.2,39.5 20.6,34.3 29.1,34.0"/>
    ${og?`<path class="bd-ribbon" d="M2 51 H62 L58 57 L62 63 H2 L6 57 Z"/><text class="bd-og" x="32" y="60" text-anchor="middle">OG</text>`:""}
    </g>
    ${c?`<path class="bd-glint" d="M66 6 L67.6 10.4 L72 12 L67.6 13.6 L66 18 L64.4 13.6 L60 12 L64.4 10.4 Z"/>`:""}
  </svg>`;
}
function pfBadgesHTML(list){
  if(!list||!list.length)return"";
  return `<div class="pig-badges" role="list">${list.map(b=>{const n=PF_BADGE_NAME[b.tier]||"";
    return `<button class="pbadge t-${esc(b.tier)}${b.og?" is-og":""}" role="listitem" data-evopen="${esc(b.slug)}" aria-label="${b.og?"OG · ":""}${esc(n)} · ${esc(b.title)}">${pfEmblem(b.tier,b.og)}<b>${esc(n)}</b><span>${esc(b.title)}</span></button>`}).join("")}</div>`;
}

/* ---- wiring ---- */
