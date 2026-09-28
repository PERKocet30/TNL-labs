/* ── THE ARCHIVE ─────────────────────────────────────────────────────
   //.JPEG PHARMACY has 226 people posting reference and every image
   scrolls into the void within a day. Nobody can find it again. This is
   the one thing a group chat physically cannot do.
─────────────────────────────────────────────────────────────────────── */
function archiveHTML(){
  const A=ARCHIVE;
  const pinBoard=SITE.pinterestBoard;
  return `<div class="scroll" id="archscroll">
    <div class="archbar">
      <input class="in archq" id="archq" placeholder="Search the archive…" value="${esc(ARCHFILT.q||"")}">
      <button class="btn ghost sm" id="myboards">◫ Moodboards${BOARDS?" "+BOARDS.length:""}</button>
    </div>

    <div class="pastebar">
      <input class="in" id="pastein" placeholder="Paste a Pinterest / are.na / any link…">
      <button class="btn sm ${PASTING?"":"green"}" id="pastego" ${PASTING?"disabled":""}>${PASTING?"…":"Pull"}</button>
    </div>
    ${PASTED?`<div class="pasted">
      <img src="${esc(PASTED.image)}" alt="">
      <div class="pasted-i">
        <div class="pasted-t">${esc(PASTED.title||"Untitled")}</div>
        <div class="mono dim">↗ ${esc(PASTED.site||"")}${PASTED.licence?" · "+esc(PASTED.licence):""}</div>
      </div>
      <button class="btn green sm" id="pastesave">Pull in</button>
      <button class="x" id="pastex" aria-label="Close"><svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="square" stroke-linejoin="miter" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg></button>
    </div>`:""}
    ${PASTEERR?`<div class="pasteerr mono"><b>${esc(PASTEERR.error)}</b>${PASTEERR.detail?`<br>${esc(PASTEERR.detail)}`:""}</div>`:""}

    ${pinBoard?`<div class="fchips archchips">
      <button class="chip sm ${ARCHSRC==="tnl"?"on":""}" data-asrc="tnl">◫ The archive</button>
      <button class="chip sm ${ARCHSRC==="pin"?"on":""}" data-asrc="pin">📌 Pinterest</button>
    </div>`:""}

    ${(ARCHSRC==="pin"&&pinBoard)?`
      <div class="pinembed">
        <a data-pin-do="embedBoard" data-pin-board-width="400" data-pin-scale-height="1200" data-pin-scale-width="80"
           href="${esc(pinBoard)}"></a>
        <div class="mono dim pinnote">Pinterest's own embed. Open a pin there, copy the link, paste it above to pull it in.</div>
      </div>`
    :`
      <div class="fchips archchips">
        ${[["","Everything"],["saved","Most saved"],["liked","Most liked"]].map(([v,l])=>
          `<button class="chip sm ${(ARCHFILT.sort||"")===v?"on":""}" data-asort="${v}">${l}</button>`).join("")}
        ${((A&&A.channels)||[]).map(c=>`<button class="chip sm ${ARCHFILT.channel===c?"on":""}" data-ach="${esc(c)}">#${esc(c)}</button>`).join("")}
        ${(ARCHFILT.q||ARCHFILT.channel||ARCHFILT.sort)?`<button class="clearf mono" id="archclear">✕ CLEAR</button>`:""}
      </div>
      ${!A?`<div class="empty">Loading…</div>`
        :!A.images.length?`<div class="empty">
          ${ARCHFILT.q?`Nothing matches "${esc(ARCHFILT.q)}".`
            :`The archive is empty.<br><br>Every image published to a lab lands here — searchable, forever.`}
        </div>`
        :`<div class="archgrid">${A.images.map(x=>`
          <button class="archcard" data-aopen="${x.id}" style="${(x.w&&x.h)?`grid-row-end:span ${Math.max(12,Math.min(34,Math.round((x.h/x.w)*20)))}`:""}">
            <img src="${esc(x.url)}" alt="" loading="lazy">
            <div class="archover">
              <span class="archby mono">${esc(x.by.displayName)}</span>
              <span class="archsave ${x.savedByMe?"on":""}" data-asave="${x.id}">${x.savedByMe?"◫":"＋"}</span>
            </div>
            ${x.saves?`<span class="archn mono">${x.saves}</span>`:""}
          </button>`).join("")}</div>`}
    `}
  </div>`;
}

/* Moodboards. The Pinterest mechanic — except saving someone's image TELLS
   them and credits them. Pinterest can't do that; it doesn't know who
   anyone is. */
function boardsHTML(){
  if(BOARDONE)return boardOneHTML();
  return `<div class="sheet" id="bbg"><div class="sheetc">
    <div class="sheeth"><div><h2>What you're pulling</h2></div>
      <button class="x" id="bx" aria-label="Close"><svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="square" stroke-linejoin="miter" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg></button></div>
    <p class="mono dim" style="line-height:1.7;margin-bottom:14px">Reference, pulled from the archive. Whoever made it gets told you took it — that's how a collab starts.</p>
    <div class="mbrow">
      <input class="in" id="bnew" placeholder="New moodboard — 'Y2K refs', 'FW25'…" maxlength="60">
      <button class="btn green sm" id="bmake">＋</button>
    </div>
    ${!BOARDS?`<div class="empty">Loading…</div>`
      :!BOARDS.length?`<div class="empty">No moodboards yet.<br><br>Make one, then pull anything out of the archive into it.</div>`
      :`<div class="mbgrid">${BOARDS.map(b=>`<button class="mbcard" data-bopen="${b.id}">
        ${b.cover?`<img src="${esc(b.cover)}" alt="" loading="lazy">`:`<div class="mbempty">◫</div>`}
        <div class="mbname">${esc(b.name)}</div>
        <div class="mono dim">${b.count} ${b.count===1?"image":"images"}${b.isPublic?"":" · private"}</div>
      </button>`).join("")}</div>`}
  </div></div>`;
}

function boardOneHTML(){
  const b=BOARDONE;
  return `<div class="sheet" id="bbg"><div class="sheetc">
    <div class="sheeth"><div>
      <button class="backb2" id="bback">← Moodboards</button>
      <h2 style="margin-top:6px">${esc(b.board.name)}</h2>
      <div class="mono dim">${b.pins.length} ${b.pins.length===1?"image":"images"} · by ${esc(b.board.by.displayName)}</div>
    </div><button class="x" id="bx" aria-label="Close"><svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="square" stroke-linejoin="miter" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg></button></div>
    ${!b.pins.length?`<div class="empty">Nothing pulled yet.<br><br>Go to the archive and tap ＋ on anything.</div>`
      :`<div class="archgrid">${b.pins.map(p=>`<div class="archcard">
        <img src="${esc(p.url||"")}" alt="" loading="lazy">
        <div class="archover">
          <span class="archby mono">${p.by?esc(p.by.displayName):esc(p.srcSite||"link")}</span>
          ${b.board.mine?`<span class="archsave" data-unpin="${p.id}">✕</span>`:""}
        </div>
        ${p.srcUrl?`<a class="archsrc mono" href="${esc(p.srcUrl)}" target="_blank" rel="noopener">↗ ${esc(p.srcSite||"source")}</a>`:""}
      </div>`).join("")}</div>`}
    ${b.board.mine?`<button class="btn ghost wide" id="bdel" style="margin-top:14px">Delete this moodboard</button>`:""}
  </div></div>`;
}

async function loadArchive(){
  const p=new URLSearchParams();
  for(const [k,v] of Object.entries(ARCHFILT)) if(v)p.set(k,v);
  ARCHIVE=null;render();
  try{ARCHIVE=await api.archive(p.toString())}catch(e){ARCHIVE={images:[],channels:[]}}
  render();
}
async function loadBoards(){
  if(!ME)return;
  try{BOARDS=(await api.boards()).boards}catch(e){BOARDS=[]}
  render();
}

function labsHTML(){
  if(guest())return `<div class="scroll"><div class="wall">
    <div class="wall-ic">🧪</div>
    <div class="mono dim">MEMBERS ONLY</div>
    <h2 class="wall-h">This is the workshop.</h2>
    <p class="wall-p">The same seven rooms you already know — PHARMACY, AKATSUKI, CASINO, FASHION LAB — except here the work is searchable, the collabs are recorded, and you can sell from them.<br><br>The Showroom shows you what came out. The labs are where it happened.</p>
    <div class="wall-labs">${LABS.map(l=>`<span class="wall-lab">${esc(labMark(l.name))}</span>`).join("")}</div>
    <div class="wall-cta"><button class="btn green" id="joinBtn3">Join the workshop</button>
      <button class="btn ghost" id="loginBtn3">Sign in</button></div>
  </div></div>`;

  /* The grid. You're standing outside the labs looking at which one to walk
     into — each showing the last thing made in it and who's been in there.
     A hashtag list is a menu; this is a building. */
  if(!LAB)return labsGridHTML();

  return `<div class="labs-wrap ${ROOMOPEN?"roomopen":""}">
  <aside class="rail">
    <button class="railback" id="labback">← All labs</button>
    <div class="railtitle">
      <span class="railglyph">${(LAB_ID[LAB.id]||{}).glyph||"//"}</span>
      <div><b>${esc(LAB.name)}</b>
      <div class="mono dim">${esc((LAB_ID[LAB.id]||{}).for||"")}</div></div>
    </div>
    ${LAB.id==="culture"?`<button class="railtool" id="openstudio">
      <span class="railtool-ic">${UI_IC.music}</span>
      <span><b>THE STUDIO</b><br><span class="mono dim">Make a beat right here</span></span>
    </button>`:""}
    ${LAB.channels.map(c=>{const locked=c.gate&&levelFor(myRep()).id<c.gate;
      const n=UNREADS[c.id]||0;
      return `<button class="railc ${CH.id===c.id?"on":""} ${n?"unread":""}" data-ch="${c.id}">${locked?UI_IC.lock:"#"} ${c.label}${n?`<span class="cbadge">${n>9?"9+":n}</span>`:""}</button>`}).join("")}
  </aside>
  <section class="room">
    <div class="roomh"><button class="backb" id="backb" aria-label="Back"><svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="square" stroke-linejoin="miter" aria-hidden="true"><path d="M15 5l-7 7 7 7"/></svg></button><span class="roomlab mono">${esc(labMark(LAB.name))}</span> #${esc(CH.label)} <span class="desc">${esc(CH.desc)}</span></div>
    ${CH.archive?archiveHTML():CH.library?tracksHTML():`
    ${CH.beatlab?`<div id="studiomount"></div>`:""}
    ${(CH.gate&&levelFor(myRep()).id<CH.gate)?`<div class="empty">${UI_IC.lock} #${esc(CH.label)} unlocks at ${LEVELS.find(l=>l.id===CH.gate).name}</div>`
      :`<div class="feed" id="feed"><div class="empty">Loading…</div></div>
    ${QUEUE.length?`<div class="attach-bar">
      <div class="qgrid">${QUEUE.map((q,i)=>`
        <div class="qcard ${q.state}">
          ${q.kind==="video"?`<div class="vthumb">▶︎</div>`:`<img src="${esc(q.preview)}" alt="">`}
          ${q.state==="up"?`<div class="qbar"><div class="qfill" style="width:${q.pct||0}%"></div></div>`:""}
          ${q.state==="err"?`<div class="qerr mono">!</div>`:""}
          <button class="qx" data-qdrop="${i}" aria-label="Close"><svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="square" stroke-linejoin="miter" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg></button>
        </div>`).join("")}
        ${QUEUE.length<10?`<button class="qadd" id="qmore">＋</button>`:""}
      </div>
      <div class="attach-info">
        <span class="mono dim">${(()=>{
          const im=QUEUE.filter(q=>q.kind==="image").length, vd=QUEUE.filter(q=>q.kind==="video").length;
          if(im>1&&!vd)return im+" IMAGES · ONE POST";
          if(im&&vd)return im+" IMAGE"+(im>1?"S":"")+" + "+vd+" VIDEO"+(vd>1?"S":"");
          if(vd>1)return vd+" VIDEOS · ONE POST EACH";
          return QUEUE.length+" FILE"+(QUEUE.length===1?"":"S");
        })()}</span>
      </div>
      <button class="attach-x" id="dropimg" title="Clear all" aria-label="Close"><svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="square" stroke-linejoin="miter" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg></button></div>`:""}
    ${MENTIONS?`<div class="mlist">${MENTIONS.map((u,i)=>`<button class="mrow" data-mpick="${i}">
      ${avHTML(u,"sm")}<div><b>${esc(u.displayName)}</b> <span class="mono dim">@${esc(u.username)}</span></div>
    </button>`).join("")}</div>`:""}
    <div class="composer">
      <input type="file" id="filein" accept="image/*,video/*" multiple hidden>
      <button class="attach" id="attachb" title="Attach image or video">+</button>
      <input class="in" id="draft" placeholder="${EDITID?"Edit your message…":"Message #"+esc(CH.label)}">
      ${EDITID?`<button class="send ghostsend" id="canceledit" aria-label="Close"><svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="square" stroke-linejoin="miter" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg></button>`:""}
      <button class="send" id="sendb" aria-label="Send">${EDITID?"✓":UI_IC.arrow}</button>
    </div>`}
`}
  </section>
</div>`}

/* The post row is drawn, not typed: 2px strokes, square ends, the same
   geometry as the nav. Drawn icons also sidestep the old iOS problem where
   the heart character was painted as a fixed-red emoji and ignored `color`.

   The heart ships both states (.ho outline, .hf filled); .igact.on swaps
   them in CSS, so the like handler still only touches the class and the
   count -- neither render site had to change. */
const IG_HEART=`<i class="igi igi-h" aria-hidden="true"><svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="square" stroke-linejoin="miter" aria-hidden="true" class="ho"><path d="M12 20.5l-7.2-7.4a4.6 4.6 0 0 1 6.5-6.5l.7.7.7-.7a4.6 4.6 0 0 1 6.5 6.5z"/></svg><svg viewBox="0 0 24 24" width="24" height="24" fill="currentColor" stroke="currentColor" stroke-width="2" stroke-linecap="square" stroke-linejoin="miter" aria-hidden="true" class="hf"><path d="M12 20.5l-7.2-7.4a4.6 4.6 0 0 1 6.5-6.5l.7.7.7-.7a4.6 4.6 0 0 1 6.5 6.5z"/></svg></i>`;
const IG_COMMENT=`<i class="igi" aria-hidden="true"><svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="square" stroke-linejoin="miter" aria-hidden="true"><path d="M4 5h16v11H9l-5 4z"/></svg></i>`;
const IG_SEND=`<i class="igi" aria-hidden="true"><svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="square" stroke-linejoin="miter" aria-hidden="true"><path d="M12 4v11M7.5 8.5L12 4l4.5 4.5M5 14v6h14v-6"/></svg></i>`;
const IG_COLLAB=`<i class="igi" aria-hidden="true"><svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="square" stroke-linejoin="miter" aria-hidden="true"><circle cx="9" cy="12" r="5"/><circle cx="15" cy="12" r="5"/></svg></i>`;
const IG_FLAG=`<i class="igi" aria-hidden="true"><svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="square" stroke-linejoin="miter" aria-hidden="true"><path d="M6 21V4h11l-2 4 2 4H6"/></svg></i>`;
const MK_HEART=on=>`<svg viewBox="0 0 24 24" width="14" height="14" fill="${on?"currentColor":"none"}" stroke="currentColor" stroke-width="2.2" stroke-linecap="square" stroke-linejoin="miter" aria-hidden="true"><path d="M12 20.5l-7.2-7.4a4.6 4.6 0 0 1 6.5-6.5l.7.7.7-.7a4.6 4.6 0 0 1 6.5 6.5z"/></svg>`;
const IG_COLLAB_SM=`<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.4" aria-hidden="true"><circle cx="9" cy="12" r="5"/><circle cx="15" cy="12" r="5"/></svg>`;
const IC_REMIX_SM=`<svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="square" stroke-linejoin="miter" aria-hidden="true"><path d="M19 12a7 7 0 1 1-2-4.9M19 4v4h-4"/></svg>`;


/* A lab message. Talk is a row: who, what, and the reference — no action
   bar, no collab invite, no inline comments, because none of that belongs in
   a sentence. Work still renders as the full card, and is_work is already the
   field that decides what reaches the Showroom, so one flag now means one
   thing in both places. Consecutive posts from the same person inside five
   minutes drop the header and group, the way every chat client does. */
function msgRowHTML(p,prev){
  const grouped=!!(prev&&!isCard(prev)&&prev.author.username===p.author.username
    &&Math.abs(p.createdAt-prev.createdAt)<300000);
  const imgs=(p.images&&p.images.length)?p.images:(p.imageUrl?[{url:p.imageUrl,thumb:p.thumbUrl}]:[]);
  return `<div class="msg ${grouped?"msg-g":""} ${p.pending?"pending":""}">
    <div class="msg-a">${grouped?"":avHTML(p.author)}</div>
    <div class="msg-c">
      ${grouped?"":`<div class="msg-h"><span class="msg-by" data-u="${esc(p.author.username)}">${esc(p.author.displayName)}</span><span class="msg-t mono">${timeAgo(p.createdAt)}</span></div>`}
      ${p.body?`<div class="msg-b">${rich(p.body)}</div>`:""}
      ${imgs.length?`<div class="msg-m">${imgs.slice(0,4).map(im=>`<img class="msg-i" src="${esc(im.thumb||im.url)}" data-u="${esc(p.author.username)}" alt="" loading="lazy" decoding="async">`).join("")}</div>`:""}
      ${p.videoUrl?`<div class="msg-m"><video class="msg-v" src="${esc(p.videoUrl)}" preload="none" playsinline muted controls></video></div>`:""}
      ${musChipHTML(p)}
      <button class="msg-open" data-openpost="${p.id}">OPEN ↗</button>
    </div>
  </div>`;
}

function postHTML(p){const mine=p.author.username===myName();
  const myPending=p.collaborators.find(c=>c.username===myName()&&c.status==="pending");
  return `<div class="post ${p.pending?"pending":""} ${p.failed?"failed":""}">
  ${p.pending?`<div class="mono sending">${UPPROG!==null&&UPPROG<1?`UPLOADING ${Math.round(UPPROG*100)}%`:"SENDING…"}</div>${UPPROG!==null&&UPPROG<1?`<div class="uptrack"><div class="upbar" id="upbar" style="width:${Math.round(UPPROG*100)}%"></div></div>`:""}`:""}
  ${p.failed?`<div class="failbar"><span>Didn't send.</span><button class="retryb" data-retry="${p.id}">Retry</button><button class="retryb ghost" data-discard="${p.id}">Discard</button></div>`:""}
  ${p.sharedFrom?`<div class="shared-tag">${IC_REMIX_SM} Shared</div>`:""}
  <div class="post-h">${avHTML(p.author)}
    <div><span class="post-by" data-u="${esc(p.author.username)}">${esc(p.author.displayName)}</span><span class="lvl">L${p.author.level}</span>
    <div class="post-meta">${esc(p.author.role.toUpperCase())} · ${new Date(p.createdAt).toLocaleTimeString([], {hour:"numeric",minute:"2-digit"})}${p.editedAt?" · EDITED":""}</div>${musChipHTML(p)}</div>
    ${mine?`<div class="post-menu"><button class="pm" data-edit="${p.id}">✎</button><button class="pm" data-delpost="${p.id}">🗑</button></div>`:""}
  </div>
  ${p.body?`<div class="post-body">${rich(p.body)}</div>`:""}
  ${(!p.imageUrl&&!p.videoUrl&&!p.beat&&firstUrl(p.body))?linkCard(firstUrl(p.body)):""}
  ${(p.images&&p.images.length>1)?(p.isWork
    /* A published series is a carousel — you swipe it and see each frame
       whole, the way it was made. Chat is a grid: four refs dropped
       mid-sentence are one glance, not a slideshow. */
    ?`<div class="caro" data-caro="${p.id}">
      <div class="caro-t">${p.images.map(im=>`<img class="caro-i" src="${esc(im.thumb||im.url)}" data-u="${esc(p.author.username)}" alt="" loading="lazy" decoding="async">`).join("")}</div>
      <div class="caro-d">${p.images.map((_,i)=>`<span class="${i===0?"on":""}"></span>`).join("")}</div>
      <span class="caro-n mono">1/${p.images.length}</span>
    </div>`
    :`<div class="gal g${Math.min(4,p.images.length)}">
    ${p.images.slice(0,4).map((im,i)=>`<img class="gimg" src="${esc(im.thumb||im.url)}" alt="" loading="lazy" decoding="async"
      data-u="${esc(p.author.username)}">${(i===3&&p.images.length>4)?`<span class="galn mono">+${p.images.length-4}</span>`:""}`).join("")}
  </div>`)
  :p.imageUrl?`<img class="post-img" src="${esc(p.thumbUrl||p.imageUrl)}" alt="attached work" loading="lazy" decoding="async"
    ${p.mediaW?`width="${p.mediaW}" height="${p.mediaH}" style="aspect-ratio:${p.mediaW}/${p.mediaH}"`:""}
    data-u="${esc(p.author.username)}">`:""}
  ${p.videoUrl?`<div class="vwrap">
    <video class="post-vid" src="${esc(p.videoUrl)}" muted loop playsinline preload="none" data-auto
      ${p.mediaW?`style="aspect-ratio:${p.mediaW}/${p.mediaH}"`:""}></video>
    <button class="vmute" data-vmute aria-label="Sound">🔇</button>
  </div>`:""}
  ${p.beat?`<div class="beatmsg"><button class="circle" style="width:30px;height:30px;font-size:11px" data-beatplay='${esc(JSON.stringify(p.beat))}'>▶︎</button><div><div class="nm">${esc(p.beat.name||"untitled loop")}</div><div class="mono dim">${p.beat.bpm} BPM${p.beat.remixOf?` · from @${esc(p.beat.remixOf.username||"?")}`:""}</div></div><button class="act" data-remix="${p.id}" style="margin-left:auto">${IC_REMIX_SM} Remix</button></div>`:""}
  ${p.collaborators.length?`<div class="collab-row">${p.collaborators.map(c=>`<span class="ctag ${c.status==="accepted"?"acc":""}">${c.status==="accepted"?"✓":"…"} ${esc(c.display_name||c.username)}</span>`).join("")}</div>`:""}
  <div class="post-acts">
    <button class="igact ${p.likedByMe?"on":""}" data-like="${p.id}" aria-label="Like">${IG_HEART}<span class="igact-n">${p.likeCount||""}</span></button>
    <button class="igact" data-comments="${p.id}" aria-label="Comment">${IG_COMMENT}</button>
    <button class="igact" data-share="${p.id}" aria-label="Send">${IG_SEND}<span class="igact-n">${p.shareCount||""}</span></button>
    ${mine?`<button class="igact" data-collab="${p.id}" aria-label="Invite a collaborator" title="Invite a collaborator">${IG_COLLAB}</button>`:""}
    ${myPending?`<button class="igpill" data-accept="${p.id}">Accept collab</button>`:""}
    ${!mine?`<button class="igact igflag" data-report="${p.id}" aria-label="Report" title="Report">${IG_FLAG}</button>`:""}
  </div>
  ${p.commentCount&&OPENCOMMENTS!==p.id?`<button class="ig-viewc" data-comments="${p.id}">View all ${p.commentCount} comment${p.commentCount==1?"":"s"}</button>`:""}
  ${OPENCOMMENTS===p.id?commentsHTML(p):""}
  </div>`}

function commentsHTML(p){return `<div class="cwrap">
  ${COMMENTS.map(c=>`<div class="crow ${c.pending?"pending":""}">
    ${avHTML(c.author,"sm")}
    <div class="cbody">
      <span class="cby" data-u="${esc(c.author.username)}">${esc(c.author.displayName)}</span>
      <span class="mono dim">${timeAgo(c.createdAt)}${c.editedAt?" · EDITED":""}</span>
      <div class="ctext">${rich(c.body)}</div>
    </div>
    ${!guest()&&(c.author.username===myName()||p.author.username===myName())?`<div class="post-menu">
      ${c.author.username===myName()?`<button class="pm" data-cedit="${c.id}">✎</button>`:""}
      <button class="pm" data-cdel="${c.id}">🗑</button></div>`:""}
  </div>`).join("")}
  ${guest()
    ?`<button class="cjoin" id="cjoinb">Join to give feedback — it's where collabs start</button>`
    :`<div class="cform">
      <input class="in" id="cdraft" placeholder="${CEDIT?"Edit comment…":"Add feedback…"}" value="${CEDIT?esc(COMMENTS.find(x=>x.id===CEDIT)?.body||""):""}">
      <button class="send" id="csend" aria-label="Send">${CEDIT?"✓":UI_IC.arrow}</button>
      ${CEDIT?`<button class="send ghostsend" id="ccancel" aria-label="Close"><svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="square" stroke-linejoin="miter" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg></button>`:""}
    </div>`}
</div>`}

