/* SHOWROOM + LABS INDEX · 2026-10-20: the Labs head comes from the screen kit (app-08-kit.js) */
function showroomHTML(){return `<div class="scroll" id="showroom">
  <div class="sr-newwrap"><button class="sr-new" id="sr-new"${SRNEW?"":" hidden"}><svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="square" stroke-linejoin="miter" aria-hidden="true"><path d="M12 19V5M6 11l6-6 6 6"/></svg>New work</button></div>
  ${guest()?`<section class="whatis"><h1 class="wi-tag">Social media by creatives, for creatives.</h1></section>`:""}
  <div id="ev-bannerwrap">${eventBannerHTML()}</div>
  <div id="gs-slot">${gsHTML()}</div>

  <div class="sr-builders" id="sr-builders">${srBuildersHTML()}</div>

  ${galBarHTML()}
  <div class="sr-gridwrap">${galNavHTML()}<div class="sr-grid${galOn()?" sr-wall":""}" id="sr-grid">${SRPOSTS.length?SRPOSTS.map(srCardHTML).join(""):skel("cards")}</div></div>
</div>`}

/* SHOWROOM CARD v1.1 — 2026-10-14: the first card's picture loads right away
   (it's the first thing anyone sees); every other picture waits until it's near. */
function srCardHTML(p,i){
  const ld=i===0?'loading="eager" fetchpriority="high"':'loading="lazy"';
  return `<div class="sr-card">
    <div class="sr-head">
      <div class="sr-who" data-u="${esc(p.author.username)}">
        ${avHTML(p.author,"sm")}
        <div class="post-hw"><div class="post-names sr-name">${pxNames(p)}</div>${pxSub(p)}</div>
      </div>
    </div>
    <div class="post-media">${pxTagBtn(p)}
    ${(p.images&&p.images.length>1)?`<div class="caro" data-caro="s${p.id}">
      <div class="caro-t" style="aspect-ratio:${caroRatio(p.images)}">${p.images.map((im,k)=>`<img class="caro-i" ${imgAttrs(im)} data-u="${esc(p.author.username)}" alt="" ${k===0?ld:'loading="lazy"'} decoding="async">`).join("")}</div>
      <div class="caro-d">${p.images.map((_,i)=>`<span class="${i===0?"on":""}"></span>`).join("")}</div>
      <span class="caro-n mono">1/${p.images.length}</span>
    </div>`
    :p.imageUrl?`<img class="sr-img" ${imgAttrs(pxImgs(p)[0])} alt="work by ${esc(p.author.displayName)}" ${ld} decoding="async"
      ${p.mediaW?`width="${p.mediaW}" height="${p.mediaH}" style="aspect-ratio:${p.mediaW}/${p.mediaH}"`:""}
      data-u="${esc(p.author.username)}">`
      :p.videoUrl?`<div class="vwrap">
        ${pxVideo(p,"sr-img")}
      </div>`
      :`<div class="sr-beat"><button class="circle" style="width:34px;height:34px;font-size:12px" data-beatplay='${esc(JSON.stringify(p.beat))}' aria-label="Play">${DI.play}</button>
         <div><div class="sr-beatname">${esc(p.beat?.name||"untitled loop")}</div><div class="mono dim">${p.beat?.bpm||120} BPM${p.beat?.remixOf?` · from @${esc(p.beat.remixOf.username||"?")}`:" · LOOP"}</div></div>${studioOn()?`<button class="act" data-remix="${p.id}" style="margin-left:auto">${IC_REMIX_SM} Remix</button>`:""}</div>`}
    </div>
    ${pxShopHTML(p)}
    <div class="sr-meta">
      <div class="sr-acts">
        <button class="igact ${p.likedByMe?"on":""}" data-like="${p.id}" aria-label="Like">${IG_HEART}<span class="igact-n">${pxLikeN(p)}</span></button>
        <button class="igact" data-comments="${p.id}" aria-label="Comment"${p.commentsOff?" hidden":""}>${IG_COMMENT}<span class="igact-n">${p.commentCount||""}</span></button>
        <button class="igact" data-share="${p.id}" aria-label="Send">${IG_SEND}<span class="igact-n">${p.shareCount||""}</span></button>
        ${p.author.username===myName()?`<button class="igact" data-collab="${p.id}" aria-label="Invite a collaborator" title="Invite a collaborator">${IG_COLLAB}</button>`:""}
        ${p.collaborators.find(c=>c.username===myName()&&c.status==="pending")?`<button class="igpill" data-accept="${p.id}">Accept collab</button>`:""}
      </div>
      ${p.body?`<div class="sr-body"><b data-u="${esc(p.author.username)}">${esc(p.author.username)}</b> ${capHTML(p.body)}</div>`:""}
      <div class="post-when">${igAgo(p.createdAt)}${p.editedAt?" · Edited":""}</div>
      <div class="cslot" data-cslot="${p.id}">${cslotHTML(p)}</div>
    </div>
  </div>`}

/* Kept between paints: render() rebuilds the page, and the row used to
   vanish until the next fetch. */
let SRB=[], SRBLOADED=false;
function srBuildersHTML(){
  /* Until the list has arrived, hold its exact space with placeholder cards
     built from the same parts, so the feed below doesn't drop ~150px when
     the real strip lands (it did, on every first load). */
  if(!SRBLOADED)return `<div class="mono sr-feedhead" style="padding-left:0"><span>Who's building</span></div>
    <div class="brow" aria-hidden="true">${[0,1,2].map(()=>`<div class="bcard"><div class="av sk-shim"></div><div class="bname">&nbsp;</div><div class="mono dim">&nbsp;</div></div>`).join("")}</div>`;
  if(!SRB.length)return "";
  return `<div class="mono sr-feedhead" style="padding-left:0"><span>Who's building</span></div>
    <div class="brow">${SRB.map(x=>`<button class="bcard" data-u="${esc(x.username)}">
      ${avHTML({avatarUrl:x.avatar_url,displayName:x.display_name,accentHex:x.accentHex})}
      <div class="bname">${esc(x.display_name)}</div>
      <div class="mono dim">${esc((x.role||"").charAt(0).toUpperCase()+(x.role||"").slice(1))}</div>
    </button>`).join("")}</div>`}
/* SCROLL-SAFE REFRESH — 2026-09-30. The Showroom re-ranks on every fetch
   (age, and work you've responded to sinks), and this used to rebuild the
   whole grid in the new order every time anything repainted — the page
   reshuffled under your thumb mid-scroll. Once the grid is on screen it now
   keeps its order: numbers update in place, a post that's gone is dropped,
   and genuinely new work waits behind the "New work" pill. Tapping it takes
   the fresh order and glides to the top. */
let SRNEW=null, SRBNEXT=null;
/* "Who's building" sits above the feed: if it appears or disappears under a
   reader, everything below jumps by its height. So a background refresh
   only swaps the people in it when the strip stays the same size; a change
   in size waits for the next full refresh (the New work pill, a first paint). */
function srBuilders(list,fresh){
  const bb=$("#sr-builders");
  if(fresh||!bb||(!!SRB.length)===(!!list.length)||!SRBLOADED){SRB=list;SRBLOADED=true;SRBNEXT=null;if(bb)bb.innerHTML=srBuildersHTML()}
  else SRBNEXT=list;
}
function srPaint(){
  const g=$("#sr-grid");if(!g)return;
  const vk=vKeep(g);
  g.innerHTML=SRPOSTS.length?SRPOSTS.map(srCardHTML).join("")
    :`<div class="empty">No work posted yet.<br><br>Be the first — post a piece and it lands here.</div>`;
  vRestore(g,vk);
  wireFeed();
}
function srMerge(fresh){
  const by=new Map(fresh.map(p=>[p.id,p]));
  for(const p of SRPOSTS)if(!by.has(p.id)){const b=document.querySelector('#sr-grid [data-like="'+p.id+'"]');const c=b&&b.closest(".sr-card");if(c)c.remove()}
  SRPOSTS=SRPOSTS.filter(p=>by.has(p.id)).map(p=>{
    const n=by.get(p.id);
    if(LIKING[String(p.id)]){n.likedByMe=p.likedByMe;n.likeCount=p.likeCount}   // a tap in flight wins
    return n;
  });
  for(const p of SRPOSTS){
    if(!LIKING[String(p.id)])setLike(String(p.id),!!p.likedByMe,p.likeCount||0);
    document.querySelectorAll('#sr-grid [data-share="'+p.id+'"] .igact-n').forEach(n=>{n.textContent=p.shareCount||""});
  }
  /* New work means newer than anything here (2026-10-18, "New work doesn't go away"): the
     Showroom is the top 60 by rank, and an older piece rising into it as ranks shift isn't new */
  const have=new Set(SRPOSTS.map(p=>p.id)),top=Math.max(0,...SRPOSTS.map(p=>Number(p.id)||0));
  if(fresh.some(p=>!have.has(p.id)&&Number(p.id)>top)){SRNEW=fresh;const b=$("#sr-new");if(b)b.hidden=false}
}
document.addEventListener("click",e=>{
  if(!(e.target&&e.target.closest&&e.target.closest("#sr-new")))return;
  if(SRNEW){SRPOSTS=SRNEW;SRNEW=null}
  const b=$("#sr-new");if(b)b.hidden=true;
  if(SRBNEXT)srBuilders(SRBNEXT,true);
  srPaint();
  const s=$("#showroom");if(s)s.scrollTo({top:0,behavior:mvReduced()?"auto":"smooth"});
});
async function loadShowroom(force){
  if(typeof gsFlag==="function"&&gsFlag("new"))gsLoad();   // a new member's Get started list (app-11-getstarted)
  if(!force && SRAT && Date.now()-SRAT<8000 && SRPOSTS.length) return; // grid paints from cache
  SRAT=Date.now();
  try{
    const [d,b]=await Promise.all([api.showroom(),api.builders()]);
    const fresh=d.posts||[];
    const g=$("#sr-grid"), shown=!!(g&&SRPOSTS.length&&g.querySelector(".sr-card"));
    if(shown)srMerge(fresh);   // on screen: never reshuffle
    else{SRPOSTS=fresh;SRNEW=null;const nb=$("#sr-new");if(nb)nb.hidden=true;srPaint()}   // a full paint has it all
    srBuilders(b.builders||[],!shown);
  }catch(e){/* offline */}
}

/* The labs index — v3.1 2026-10-11 (Music wears its most-played cover); v3 2026-10-09: one list, nothing twice. Each genre is a
   card: the latest piece made there, its name, one line on what it is, and
   its #hashtags — tap one to land on that work. */
function labsGridHTML(){
  if(!LABTAGS)loadLabTags();
  const A=LABACT||{byChannel:{},art:{},unread:{}};
  const st=l=>{let unread=0,art=null;
    for(const c of l.channels){unread+=A.unread[c.id]||0;const a=A.art[c.id];if(a&&(!art||a.at>art.at))art=a}
    if(A.labArt&&A.labArt[l.id])art=A.labArt[l.id];   // Music: the cover of the song played most this week (2026-10-11)
    return {unread,art}};
  /* your labs first (v1.2, 2026-10-09 — labsForMe in app-11-places.js) */
  const o=labsForMe();
  const card=l=>{const id=LAB_ID[l.id]||{for:"",ic:""},x=st(l),tags=labTagList(l.id).slice(0,3);
      return `<div class="lx" role="button" tabindex="0" data-lab="${l.id}">
        <span class="lx-media${x.art?"":" bare"}">${x.art?`<img src="${esc(x.art.url)}" alt="${x.art.title?esc("Most played: "+x.art.title):""}" loading="lazy">`:`<span class="lx-ic">${id.ic}</span>`}</span>
        <span class="lx-body">
          <span class="lx-name"><span class="lg">//</span> ${esc(l.name)}${x.unread?`<span class="lx-new">${x.unread>9?"9+":x.unread} new</span>`:""}</span>
          <span class="lx-for">${esc(id.for)}</span>
          ${tags.length?`<span class="lx-tags">${tags.map(t=>`<button class="lx-tag" data-labtag="${l.id}" data-t="${esc(t)}">#${esc(t)}</button>`).join("")}</span>`:""}
        </span>
        <span class="lx-go" aria-hidden="true"><svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="square" stroke-linejoin="miter"><path d="M9 5l7 7-7 7"/></svg></span>
      </div>`};
  return `<div class="scroll">
    ${screenHead({title:"Labs",sub:"Pick a genre. Tag your work so people find it."})}
    <div class="lx-list" id="lxlist">${o.mine.length?`<div class="lx-sec">For you <span>· from what you make</span></div>`:""}${o.mine.map(card).join("")}${o.mine.length&&o.rest.length?`<div class="lx-sec">More labs</div>`:""}${o.rest.map(card).join("")}</div>
  </div>`;
}

