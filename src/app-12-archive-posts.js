/* v2026-10-27: the lab message box keeps line breaks (a growing box, like DMs). v2026-10-21: the archive is a browse, not a search (no box — pictures aren't labelled); the lab head's Share is Invite. v2026-10-20: the head comes from the screen kit */
/* ── THE ARCHIVE ─────────────────────────────────────────────────────
   //.JPEG PHARMACY has 226 people posting reference and every image
   scrolls into the void within a day. Nobody can find it again. This is
   the one thing a group chat physically cannot do.
─────────────────────────────────────────────────────────────────────── */
function archiveHTML(){
  /* Moodboards came out 2026-10-11 ("simplify"): no boards button, no
     paste-a-link, no embedded boards, no + on the images. The boards and what's
     on them are kept in the database, untouched. */
  const A=ARCHIVE;
  return `<div class="scroll" id="archscroll">
    <div class="fchips archchips">
      ${[["","Newest"],["saved","Most saved"],["liked","Most liked"]].map(([v,l])=>
        `<button class="chip sm ${(ARCHFILT.sort||"")===v?"on":""}" data-asort="${v}">${l}</button>`).join("")}
    </div>
    ${!A?`${skel()}`
      :!A.images.length?`<div class="empty">
        The archive is empty.<br><br>Every picture posted to this lab lands here, forever.
      </div>`
      :`<div class="archgrid">${A.images.map(x=>`
        <button class="archcard" data-aopen="${x.id}" style="${(x.w&&x.h)?`grid-row-end:span ${Math.max(12,Math.min(34,Math.round((x.h/x.w)*20)))}`:""}">
          <img src="${esc(x.url)}" alt="" loading="lazy">
          <div class="archover"><span class="archby mono">${esc(x.by.displayName)}</span></div>
        </button>`).join("")}</div>`}
  </div>`;
}

async function loadArchive(){
  const p=new URLSearchParams();
  for(const [k,v] of Object.entries(ARCHFILT)) if(v)p.set(k,v);
  ARCHIVE=null;render();
  try{ARCHIVE=await api.archive(p.toString())}catch(e){ARCHIVE={images:[],channels:[]}}
  render();
}
function labsHTML(){
  if(guest())return `<div class="scroll"><div class="wall">
    <div class="wall-mark">//</div>
    <h2 class="wall-h">Labs are for members.</h2>
    <p class="wall-p">Share process, get feedback and find collaborators by genre.</p>
    <div class="wall-labs">${LABS.map(l=>`<span class="wall-lab">${esc(labMark(l.name))}</span>`).join("")}</div>
    <div class="wall-cta"><button class="btn green" id="joinBtn3">Join</button>
      <button class="btn ghost" id="loginBtn3">Sign in</button></div>
  </div></div>`;

  /* Outside a lab: the index (or a #tag page). Inside: a place — one
     header, Work · Talk · Open · Pulse (app-11-places.js). Talk is the
     conversation below; the other tabs paint into #plbody. */
  if(!LAB)return TAGVIEW?tagHTML():labsGridHTML();
  const talk=LABVIEW==="talk";
  return `<div class="labs-wrap roomopen">
  <section class="room">
    ${screenHead({back:{id:"labback",label:"All labs"},mark:true,title:LAB.name,actions:[
      shareBtnHTML(`id="labshare" aria-label="Invite people to ${esc(LAB.name)}"`,"Invite"),
      LAB.id==="culture"&&studioOn()?`<button class="btn ghost sm" id="openstudio">${UI_IC.music}<span>Studio</span></button>`:"",
      talk?`<button class="ib lr-bell" id="lrbell" aria-label="Mute this lab">${UI_IC.bell}</button>`:""]})}
    ${placeTabsHTML()}
    ${talk?`<div id="lrpins"></div>`:""}
    ${!talk?`<div class="pl-body" id="plbody">${placeBodyHTML()}</div>`:`
    ${CH.beatlab?`<div id="studiomount"></div>`:""}
    ${(CH.gate&&levelFor(myRep()).id<CH.gate)?`<div class="empty">${UI_IC.lock} ${esc(chName(CH))} unlocks at ${LEVELS.find(l=>l.id===CH.gate).name}</div>`
      :`<div class="feed" id="feed">${skel()}</div>
    <button class="c-jump lr-jump" id="lrjump" aria-label="Jump to latest" hidden></button>
    <div id="lrtyping"></div><div id="lrbar"></div>
    ${QUEUE.length?`<div class="attach-bar">
      <div class="qgrid">${QUEUE.map((q,i)=>`
        <div class="qcard ${q.state}">
          ${q.kind==="video"?`<div class="vthumb">${DI.play}</div>`:`<img src="${esc(q.preview)}" alt="">`}
          ${q.state==="up"?`<div class="qbar"><div class="qfill" style="width:${q.pct||0}%"></div></div>`:""}
          ${q.state==="err"?`<div class="qerr mono">!</div>`:""}
          <button class="qx" data-qdrop="${i}" aria-label="Close"><svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="square" stroke-linejoin="miter" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg></button>
        </div>`).join("")}
        ${QUEUE.length<10?`<button class="qadd" id="qmore" aria-label="Add more">${DI.plus}</button>`:""}
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
      <button class="attach" id="attachb" title="Attach image or video" aria-label="Attach image or video">${UI_IC.plus}</button>
      <textarea class="in c-in" id="draft" rows="1" enterkeyhint="send" placeholder="${EDITID?"Edit your message…":"Message "+esc(labMark(LAB.name))}" autocomplete="off">${EDITID?"":esc(LABDRAFT)}</textarea>
      ${EDITID?`<button class="send ghostsend" id="canceledit" aria-label="Close"><svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="square" stroke-linejoin="miter" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg></button>`:""}
      <button class="send" id="sendb" aria-label="Send">${EDITID?DI.check:UI_IC.arrow}</button>
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
const IC_REMIX_SM=`<svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="square" stroke-linejoin="miter" aria-hidden="true"><path d="M19 12a7 7 0 1 1-2-4.9M19 4v4h-4"/></svg>`;


/* A lab message. Talk is a row: who, what, and the reference — no action
   bar, no collab invite, no inline comments, because none of that belongs in
   a sentence. Work still renders as the full card, and is_work is already the
   field that decides what reaches the Showroom, so one flag now means one
   thing in both places. Consecutive posts from the same person inside five
   minutes drop the header and group, the way every chat client does. */
/* msgRowHTML → app-10-chat-6-labs.js (messaging v2) */

/* POST v2 — 2026-10-12: who (and who it's built with),
   the song or the place; the work; the buttons with their counts; then
   "username caption", the time, the comments. A post with no picture is its
   words, so they stay on top. Helpers: app-12-post-extras.js. */
function postHTML(p){const mine=p.author.username===myName();
  const myPending=p.collaborators.find(c=>c.username===myName()&&c.status==="pending");
  const media=!!(p.imageUrl||p.videoUrl||(p.images&&p.images.length)||p.beat);
  const cap=!p.body?"":media?`<div class="post-cap"><b class="post-capu" data-u="${esc(p.author.username)}">${esc(p.author.username)}</b> ${capHTML(p.body)}</div>`:`<div class="post-body">${rich(p.body)}</div>`;
  return `<div class="post ${p.pending?"pending":""} ${p.failed?"failed":""}">
  ${p.pending?`<div class="mono sending">${UPPROG!==null&&UPPROG<1?`UPLOADING ${Math.round(UPPROG*100)}%`:"SENDING…"}</div>${UPPROG!==null&&UPPROG<1?`<div class="uptrack"><div class="upbar" id="upbar" style="width:${Math.round(UPPROG*100)}%"></div></div>`:""}`:""}
  ${p.failed?`<div class="failbar"><span>Didn't send.</span><button class="retryb" data-retry="${p.id}">Retry</button><button class="retryb ghost" data-discard="${p.id}">Discard</button></div>`:""}
  ${p.sharedFrom?`<div class="shared-tag">${IC_REMIX_SM} Shared</div>`:""}
  <div class="post-h">${avHTML(p.author)}
    <div class="post-hw"><div class="post-names">${pxNames(p)}</div>${pxSub(p)}</div>
    ${ME&&!p.pending&&!p.failed?`<div class="post-menu"><button class="pm pmore" data-pmore="${p.id}" aria-label="More">${DI.more}</button></div>`:""}
  </div>
  ${media?"":cap}
  ${(!p.imageUrl&&!p.videoUrl&&!p.beat&&firstUrl(p.body))?linkCard(firstUrl(p.body)):""}
  ${media?`<div class="post-media">`:""}
  ${(p.images&&p.images.length>1)?(p.isWork
    /* A published series is a carousel — you swipe it and see each frame
       whole, the way it was made. Chat is a grid: four refs dropped
       mid-sentence are one glance, not a slideshow. */
    ?`<div class="caro" data-caro="${p.id}">
      <div class="caro-t" style="aspect-ratio:${caroRatio(p.images)}">${p.images.map(im=>`<img class="caro-i" ${imgAttrs(im,CSLOTPO)} ${CSLOTPO?`data-zoom="${esc(im.url)}"`:`data-u="${esc(p.author.username)}"`} alt="" loading="lazy" decoding="async">`).join("")}</div>
      <div class="caro-d">${p.images.map((_,i)=>`<span class="${i===0?"on":""}"></span>`).join("")}</div>
      <span class="caro-n mono">1/${p.images.length}</span>
    </div>`
    :`<div class="gal g${Math.min(4,p.images.length)}">
    ${p.images.slice(0,4).map((im,i)=>`<img class="gimg" src="${esc(im.thumb||im.url)}" alt="" loading="lazy" decoding="async"
      data-u="${esc(p.author.username)}">${(i===3&&p.images.length>4)?`<span class="galn mono">+${p.images.length-4}</span>`:""}`).join("")}
  </div>`)
  :p.imageUrl?`<img class="post-img" ${imgAttrs(pxImgs(p)[0],CSLOTPO)} alt="attached work" loading="lazy" decoding="async"${CSLOTPO?` data-zoom="${esc(p.imageUrl)}"`:""}
    ${p.mediaW?`width="${p.mediaW}" height="${p.mediaH}" style="aspect-ratio:${p.mediaW}/${p.mediaH}"`:""}
    ${CSLOTPO?"":`data-u="${esc(p.author.username)}"`}>`:""}
  ${p.videoUrl?`<div class="vwrap">
    ${pxVideo(p,"post-vid")}
  </div>`:""}
  ${media?pxTagBtn(p)+`</div>`:""}
  ${pxShopHTML(p)}
  <div class="post-acts">
    <button class="igact ${p.likedByMe?"on":""}" data-like="${p.id}" aria-label="Like">${IG_HEART}<span class="igact-n">${pxLikeN(p)}</span></button>
    <button class="igact" data-comments="${p.id}" aria-label="Comment"${p.commentsOff?" hidden":""}>${IG_COMMENT}<span class="igact-n">${p.commentCount||""}</span></button>
    <button class="igact" data-share="${p.id}" aria-label="Send">${IG_SEND}<span class="igact-n">${p.shareCount||""}</span></button>
    ${mine?`<button class="igact" data-collab="${p.id}" aria-label="Invite a collaborator" title="Invite a collaborator">${IG_COLLAB}</button>`:""}
    ${myPending?`<button class="igpill" data-accept="${p.id}">Accept collab</button>`:""}
    ${!mine?`<button class="igact igflag" data-report="${p.id}" aria-label="Report" title="Report">${IG_FLAG}</button>`:""}
  </div>
  ${media?cap:""}
  ${p.pending||p.failed?"":`<div class="post-when">${igAgo(p.createdAt)}${p.editedAt?" · Edited":""}</div>`}
  <div class="cslot" data-cslot="${p.id}">${cslotHTML(p)}</div>
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
      ${c.author.username===myName()?`<button class="pm" data-cedit="${c.id}" aria-label="Edit">${DI.edit}</button>`:""}
      <button class="pm" data-cdel="${c.id}" aria-label="Delete">${DI.trash}</button></div>`:""}
  </div>`).join("")}
  ${guest()
    ?`<button class="cjoin" id="cjoinb">Join to comment</button>`
    :`${CEDIT?"":`<div class="c-quick">${["❤️","🙌","🔥","👏","😢","😍","😮","😂"].map(e=>`<button type="button" data-cq="${e}" aria-label="Add ${e}">${e}</button>`).join("")}</div>`}<div class="cform">
      <input class="in" id="cdraft" placeholder="${CEDIT?"Edit comment…":"Add a comment…"}" value="${CEDIT?esc(COMMENTS.find(x=>x.id===CEDIT)?.body||""):""}">
      <button class="send" id="csend" aria-label="Send">${CEDIT?DI.check:UI_IC.arrow}</button>
      ${CEDIT?`<button class="send ghostsend" id="ccancel" aria-label="Close"><svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="square" stroke-linejoin="miter" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg></button>`:""}
    </div>`}
</div>`}

