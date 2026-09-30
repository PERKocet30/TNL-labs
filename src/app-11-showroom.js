function showroomHTML(){return `<div class="scroll" id="showroom">
  ${guest()?`<section class="whatis"><p class="wi-tag">Social media by creatives, for creatives.</p></section>`:""}

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
        <div class="dim sr-role">${esc(p.author.role.charAt(0).toUpperCase()+p.author.role.slice(1))}</div>${musChipHTML(p)}</div>
      </div>
    </div>
    ${(p.images&&p.images.length>1)?`<div class="caro" data-caro="s${p.id}">
      <div class="caro-t">${p.images.map(im=>`<img class="caro-i" src="${esc(im.thumb||im.url)}" data-u="${esc(p.author.username)}" alt="" loading="lazy" decoding="async">`).join("")}</div>
      <div class="caro-d">${p.images.map((_,i)=>`<span class="${i===0?"on":""}"></span>`).join("")}</div>
      <span class="caro-n mono">1/${p.images.length}</span>
    </div>`
    :p.imageUrl?`<img class="sr-img" src="${esc(p.thumbUrl||p.imageUrl)}" alt="work by ${esc(p.author.displayName)}" loading="lazy" decoding="async"
      ${p.mediaW?`width="${p.mediaW}" height="${p.mediaH}" style="aspect-ratio:${p.mediaW}/${p.mediaH}"`:""}
      data-u="${esc(p.author.username)}">`
      :p.videoUrl?`<div class="vwrap">
        <video class="sr-img" src="${esc(p.videoUrl)}" muted loop playsinline preload="none" data-auto></video>
        <button class="vmute" data-vmute aria-label="Sound">${DI.soundOff}</button>
      </div>`
      :`<div class="sr-beat"><button class="circle" style="width:34px;height:34px;font-size:12px" data-beatplay='${esc(JSON.stringify(p.beat))}' aria-label="Play">${DI.play}</button>
         <div><div class="sr-beatname">${esc(p.beat?.name||"untitled loop")}</div><div class="mono dim">${p.beat?.bpm||120} BPM${p.beat?.remixOf?` · from @${esc(p.beat.remixOf.username||"?")}`:" · LOOP"}</div></div>${studioOn()?`<button class="act" data-remix="${p.id}" style="margin-left:auto">${IC_REMIX_SM} Remix</button>`:""}</div>`}
    <div class="sr-meta">
      <div class="sr-acts">
        <button class="igact ${p.likedByMe?"on":""}" data-like="${p.id}" aria-label="Like">${IG_HEART}<span class="igact-n">${p.likeCount||""}</span></button>
        <button class="igact" data-comments="${p.id}" aria-label="Comment">${IG_COMMENT}</button>
        <button class="igact" data-share="${p.id}" aria-label="Send">${IG_SEND}<span class="igact-n">${p.shareCount||""}</span></button>
        ${p.author.username===myName()?`<button class="igact" data-collab="${p.id}" aria-label="Invite a collaborator" title="Invite a collaborator">${IG_COLLAB}</button>`:""}
        ${p.collaborators.find(c=>c.username===myName()&&c.status==="pending")?`<button class="igpill" data-accept="${p.id}">Accept collab</button>`:""}
      </div>
      ${accepted.length?`<div class="sr-collab">${IG_COLLAB_SM} Built with ${accepted.map(c=>esc(c.display_name||c.username)).join(" + ")}</div>`:""}
      ${p.body?`<div class="sr-body"><b>${esc(p.author.username)}</b> ${rich(p.body)}</div>`:""}
      ${p.commentCount&&OPENCOMMENTS!==p.id?`<button class="ig-viewc" data-comments="${p.id}">View all ${p.commentCount} comment${p.commentCount==1?"":"s"}</button>`:""}
      ${OPENCOMMENTS===p.id?commentsHTML(p):""}
    </div>
  </div>`}

/* Kept between paints: render() rebuilds the page, and the row used to
   vanish until the next fetch. */
let SRB=[];
function srBuildersHTML(){
  if(!SRB.length)return "";
  return `<div class="mono sr-feedhead" style="padding-left:0"><span>Who's building</span></div>
    <div class="brow">${SRB.map(x=>`<button class="bcard" data-u="${esc(x.username)}">
      ${x.avatar_url?`<img class="av" src="${esc(x.avatar_url)}" alt="">`:`<div class="av">${esc(x.display_name.slice(0,2).toUpperCase())}</div>`}
      <div class="bname">${esc(x.display_name)}</div>
      <div class="mono dim">${esc((x.role||"").charAt(0).toUpperCase()+(x.role||"").slice(1))}</div>
    </button>`).join("")}</div>`}
async function loadShowroom(force){
  if(!force && SRAT && Date.now()-SRAT<8000 && SRPOSTS.length) return; // grid paints from cache
  SRAT=Date.now();
  try{
    const [d,b]=await Promise.all([api.showroom(),api.builders()]);
    SRPOSTS=d.posts||[];
    const g=$("#sr-grid");
    if(g)g.innerHTML=d.posts.length?d.posts.map(srCardHTML).join("")
      :`<div class="empty">No work posted yet.<br><br>Be the first — post a piece and it lands here.</div>`;
    SRB=b.builders||[];
    const bb=$("#sr-builders");if(bb)bb.innerHTML=srBuildersHTML();
    wireFeed();
  }catch(e){/* offline */}
}

/* The lab index. One row per genre, numbered like a specimen shelf: the
   latest piece made there (or the genre's drawn mark), what's unread, who's
   been in this week. Readable on paper and in dark mode alike. */
function labsGridHTML(){
  const A=LABACT||{byChannel:{},art:{},people:{},unread:{}};
  const labStats=(l)=>{
    let today=0,week=0,unread=0,last=0,art=null,people=[];
    for(const c of l.channels){
      const b=A.byChannel[c.id];
      if(b){today+=b.today||0;week+=b.week||0;if(b.last_at>last)last=b.last_at}
      unread+=A.unread[c.id]||0;
      const a=A.art[c.id];
      if(a&&(!art||a.at>art.at))art=a;
      for(const p of (A.people[c.id]||[])) if(!people.find(x=>x.username===p.username))people.push(p);
    }
    return {today,week,unread,last,art,people};
  };
  const all=LABS.map(labStats);
  const weekTotal=all.reduce((n,st)=>n+st.week,0);
  return `<div class="scroll">
    <div class="lx-head">
      <h2 class="page-h">Labs</h2>
      <p class="lx-sub">${LABS.length} genres${weekTotal?` · ${weekTotal} posts this week`:""}</p>
    </div>
    <div class="lx-list">${LABS.map((l,i)=>{
      const id=LAB_ID[l.id]||{for:"",ic:""};
      const st=all[i];
      return `<button class="lx ${st.unread?"new":""}" data-lab="${l.id}">
        <span class="lx-media">${st.art?`<img src="${esc(st.art.url)}" alt="" loading="lazy">`:`<span class="lx-ic">${id.ic}</span>`}</span>
        <span class="lx-body">
          <span class="lx-top"><span class="lx-no">${String(i+1).padStart(2,"0")}</span>
            ${st.unread?`<span class="lx-new">${st.unread>9?"9+":st.unread} new</span>`
              :st.today?`<span class="lx-live"><i></i>Active today</span>`:""}</span>
          <span class="lx-name"><span class="lg">//</span> ${esc(l.name)}</span>
          <span class="lx-for">${esc(id.for)}</span>
          <span class="lx-foot">
            ${st.people.length?`<span class="lx-ppl">${st.people.slice(0,4).map(p=>
              p.avatarUrl?`<img src="${esc(p.avatarUrl)}" alt="">`
                :`<span>${esc(p.displayName.slice(0,1).toUpperCase())}</span>`).join("")}</span>`:""}
            <span class="lx-meta">${st.week?st.week+" this week"
              :st.last?"Last post "+timeAgo(st.last).toLowerCase()
              :"No posts yet"}</span>
          </span>
        </span>
        <span class="lx-go" aria-hidden="true"><svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="square" stroke-linejoin="miter"><path d="M9 5l7 7-7 7"/></svg></span>
      </button>`}).join("")}</div>
  </div>`;
}

