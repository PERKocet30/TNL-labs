function showroomHTML(){return `<div class="scroll" id="showroom">
  <div class="sr-newwrap"><button class="sr-new" id="sr-new"${SRNEW?"":" hidden"}><svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="square" stroke-linejoin="miter" aria-hidden="true"><path d="M12 19V5M6 11l6-6 6 6"/></svg>New work</button></div>
  ${guest()?`<section class="whatis"><p class="wi-tag">Social media by creatives, for creatives.</p></section>`:""}
  <div id="ev-bannerwrap">${eventBannerHTML()}</div>

  <div class="sr-builders" id="sr-builders">${srBuildersHTML()}</div>

  <div class="sr-grid" id="sr-grid">${SRPOSTS.length?SRPOSTS.map(srCardHTML).join(""):skel("cards")}</div>
</div>`}

function srCardHTML(p){
  const accepted=p.collaborators.filter(c=>c.status==="accepted");
  return `<div class="sr-card">
    <div class="sr-head">
      <div class="sr-who" data-u="${esc(p.author.username)}">
        ${avHTML(p.author,"sm")}
        <div><div class="sr-name">${esc(p.author.displayName)}<span class="lvl">L${p.author.level}</span></div>
        <div class="dim sr-role">${p.location?esc(p.location):esc(p.author.role.charAt(0).toUpperCase()+p.author.role.slice(1))}</div>${pxWithHTML(p)}${musChipHTML(p)}</div>
      </div>
    </div>
    ${(p.images&&p.images.length>1)?`<div class="caro" data-caro="s${p.id}">
      <div class="caro-t">${p.images.map(im=>`<img class="caro-i" ${imgAttrs(im)} data-u="${esc(p.author.username)}" alt="" loading="lazy" decoding="async" style="aspect-ratio:${im.w&&im.h?im.w+"/"+im.h:"4/5"}">`).join("")}</div>
      <div class="caro-d">${p.images.map((_,i)=>`<span class="${i===0?"on":""}"></span>`).join("")}</div>
      <span class="caro-n mono">1/${p.images.length}</span>
    </div>`
    :p.imageUrl?`<img class="sr-img" ${imgAttrs(pxImgs(p)[0])} alt="work by ${esc(p.author.displayName)}" loading="lazy" decoding="async"
      ${p.mediaW?`width="${p.mediaW}" height="${p.mediaH}" style="aspect-ratio:${p.mediaW}/${p.mediaH}"`:""}
      data-u="${esc(p.author.username)}">`
      :p.videoUrl?`<div class="vwrap">
        ${pxVideo(p,"sr-img")}
      </div>`
      :`<div class="sr-beat"><button class="circle" style="width:34px;height:34px;font-size:12px" data-beatplay='${esc(JSON.stringify(p.beat))}' aria-label="Play">${DI.play}</button>
         <div><div class="sr-beatname">${esc(p.beat?.name||"untitled loop")}</div><div class="mono dim">${p.beat?.bpm||120} BPM${p.beat?.remixOf?` · from @${esc(p.beat.remixOf.username||"?")}`:" · LOOP"}</div></div>${studioOn()?`<button class="act" data-remix="${p.id}" style="margin-left:auto">${IC_REMIX_SM} Remix</button>`:""}</div>`}
    ${pxShopHTML(p)}
    <div class="sr-meta">
      <div class="sr-acts">
        <button class="igact ${p.likedByMe?"on":""}" data-like="${p.id}" aria-label="Like">${IG_HEART}<span class="igact-n">${p.likeCount||""}</span></button>
        <button class="igact" data-comments="${p.id}" aria-label="Comment"${p.commentsOff?" hidden":""}>${IG_COMMENT}</button>
        <button class="igact" data-share="${p.id}" aria-label="Send">${IG_SEND}<span class="igact-n">${p.shareCount||""}</span></button>
        ${p.author.username===myName()?`<button class="igact" data-collab="${p.id}" aria-label="Invite a collaborator" title="Invite a collaborator">${IG_COLLAB}</button>`:""}
        ${p.collaborators.find(c=>c.username===myName()&&c.status==="pending")?`<button class="igpill" data-accept="${p.id}">Accept collab</button>`:""}
      </div>
      ${accepted.length?`<div class="sr-collab">${IG_COLLAB_SM} Built with ${accepted.map(c=>esc(c.display_name||c.username)).join(" + ")}</div>`:""}
      ${p.body?`<div class="sr-body"><b>${esc(p.author.username)}</b> ${rich(p.body)}</div>`:""}
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
      ${x.avatar_url?`<img class="av" src="${esc(x.avatar_url)}" alt="">`:`<div class="av">${esc(x.display_name.slice(0,2).toUpperCase())}</div>`}
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
  const have=new Set(SRPOSTS.map(p=>p.id));
  if(fresh.some(p=>!have.has(p.id))){SRNEW=fresh;const b=$("#sr-new");if(b)b.hidden=false}
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
  if(!force && SRAT && Date.now()-SRAT<8000 && SRPOSTS.length) return; // grid paints from cache
  SRAT=Date.now();
  try{
    const [d,b]=await Promise.all([api.showroom(),api.builders()]);
    const fresh=d.posts||[];
    const g=$("#sr-grid"), shown=!!(g&&SRPOSTS.length&&g.querySelector(".sr-card"));
    if(shown)srMerge(fresh);   // on screen: never reshuffle
    else{SRPOSTS=fresh;srPaint()}
    srBuilders(b.builders||[],!shown);
  }catch(e){/* offline */}
}

/* The labs index — v3 2026-10-09: one list, nothing twice. Each genre is a
   card: the latest piece made there, its name, one line on what it is, and
   its #hashtags — tap one to land on that work. */
function labsGridHTML(){
  if(!LABTAGS)loadLabTags();
  const A=LABACT||{byChannel:{},art:{},unread:{}};
  const st=l=>{let unread=0,art=null;
    for(const c of l.channels){unread+=A.unread[c.id]||0;const a=A.art[c.id];if(a&&(!art||a.at>art.at))art=a}
    return {unread,art}};
  return `<div class="scroll">
    <div class="lx-head"><h2 class="page-h">Labs</h2>
      <p class="lx-sub">Pick a genre. Tag your work so people find it.</p></div>
    <div class="lx-list" id="lxlist">${LABS.map(l=>{const id=LAB_ID[l.id]||{for:"",ic:""},x=st(l),tags=labTagList(l.id).slice(0,3);
      return `<div class="lx" role="button" tabindex="0" data-lab="${l.id}">
        <span class="lx-media${x.art?"":" bare"}">${x.art?`<img src="${esc(x.art.url)}" alt="" loading="lazy">`:`<span class="lx-ic">${id.ic}</span>`}</span>
        <span class="lx-body">
          <span class="lx-name"><span class="lg">//</span> ${esc(l.name)}${x.unread?`<span class="lx-new">${x.unread>9?"9+":x.unread} new</span>`:""}</span>
          <span class="lx-for">${esc(id.for)}</span>
          ${tags.length?`<span class="lx-tags">${tags.map(t=>`<button class="lx-tag" data-labtag="${l.id}" data-t="${esc(t)}">#${esc(t)}</button>`).join("")}</span>`:""}
        </span>
        <span class="lx-go" aria-hidden="true"><svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="square" stroke-linejoin="miter"><path d="M9 5l7 7-7 7"/></svg></span>
      </div>`}).join("")}</div>
  </div>`;
}

