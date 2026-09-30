/* MESSAGES v2.0 — 2026-09-29. Lab rooms as chat.
   Oldest at the top, newest by the composer, the way every chat reads.
   Hold a message for reactions, reply, copy, send, edit, pin (admins),
   delete. Swipe right to reply, double-tap for ❤️. Pinned messages sit
   under the channel tabs; typing shows above the composer. */
let LABDRAFT="", POSTSCH=null, PINIDX=0, ROOMSTICK=true, ROOMSEEN=null, LABUNSEEN=0;

function roomRowsHTML(){
  const list=[...POSTS].sort((a,b)=>a.createdAt-b.createdAt);
  return list.map((p,i)=>{const prev=list[i-1];
    return (!prev||bigGap(prev,p)?`<div class="c-day"><span>${esc(dayLabel(p.createdAt))} ${esc(clock(p.createdAt))}</span></div>`:"")+roomRowHTML(p,prev)}).join("");
}
function roomRowHTML(p,prev){
  return isCard(p)
    ?`<div class="c-row card" data-post-row="${p.id}">${quoteHTML(p.replyTo)}${postHTML(p)}${reactsHTML(p.reactions,"post:"+p.id)}</div>`
    :`<div class="c-row" data-post-row="${p.id}">${msgRowHTML(p,prev)}</div>`;
}
/* Talk is a row, not a card. Consecutive messages from one person inside
   five minutes drop the header and group, the way every chat client does. */
function msgRowHTML(p,prev){
  const grouped=!!(prev&&!isCard(prev)&&prev.author.username===p.author.username
    &&Math.abs(p.createdAt-prev.createdAt)<300000&&!p.replyTo&&!bigGap(prev,p));
  const imgs=(p.images&&p.images.length)?p.images:(p.imageUrl?[{url:p.imageUrl,thumb:p.thumbUrl}]:[]);
  return `<div class="msg ${grouped?"msg-g":""} ${p.pending?"pending":""}">
    <div class="msg-a">${grouped?"":avHTML(p.author)}</div>
    <div class="msg-c">
      ${grouped?"":`<div class="msg-h"><span class="msg-by" data-u="${esc(p.author.username)}">${esc(p.author.displayName)}</span><span class="msg-t">${esc(clock(p.createdAt))}</span></div>`}
      ${quoteHTML(p.replyTo)}
      ${p.body?`<div class="msg-b">${rich(p.body)}</div>`:""}
      ${p.link?linkPrevHTML(p.link):""}
      ${imgs.length?`<div class="msg-m n${Math.min(imgs.length,4)}">${imgs.slice(0,4).map(im=>`<img class="msg-i" src="${esc(im.thumb||im.url)}" data-u="${esc(p.author.username)}" alt="" loading="lazy" decoding="async">`).join("")}</div>`:""}
      ${p.videoUrl?`<div class="msg-m"><video class="msg-v" src="${esc(p.videoUrl)}" preload="none" playsinline muted controls></video></div>`:""}
      ${musChipHTML(p)}
      ${reactsHTML(p.reactions,"post:"+p.id)}
      ${p.editedAt?`<span class="c-meta">Edited</span>`:""}
      ${p.failed?`<div class="failbar"><span>Didn't send.</span><button class="retryb" data-retry="${p.id}">Retry</button><button class="retryb ghost" data-discard="${p.id}">Discard</button></div>`:""}
    </div>
  </div>`;
}

function renderRoomFeed(){
  const f=$("#feed");if(!f)return;
  const first=f.dataset.ready!==CH.id;
  const stick=first||ROOMSTICK||f.scrollHeight-f.scrollTop-f.clientHeight<120, top=f.scrollTop;
  // count what arrived from others while you were reading further up
  const ids=new Set(POSTS.map(p=>p.id));
  if(!first&&ROOMSEEN&&!stick)LABUNSEEN+=POSTS.filter(p=>!ROOMSEEN.has(p.id)&&p.author.username!==myName()&&!p.pending).length;
  if(first||stick)LABUNSEEN=0;
  ROOMSEEN=ids;POSTSCH=CH.id;
  f.innerHTML=POSTS.length?roomRowsHTML():emptyHTML(CH);
  f.dataset.ready=CH.id;
  wireFeed();wireRoomChat(f);
  paintPins();paintLabBar();paintTyping("lab:"+CH.id);paintLabBell();   // before scrolling: they change the feed's height
  if(stick){f.scrollTop=f.scrollHeight;ROOMSTICK=true}else f.scrollTop=top;
  // late-loading images shouldn't leave you stranded above the newest message
  f.querySelectorAll("img").forEach(m=>{if(!m.complete)m.addEventListener("load",()=>{if(ROOMSTICK)f.scrollTop=f.scrollHeight},{once:true})});
  paintRoomJump();
  const ep=$("#epost");if(ep)ep.onclick=()=>$("#filein")?.click();
}
function paintRoomRow(p){
  const f=$("#feed"),el=f&&f.querySelector(`[data-post-row="${p.id}"]`);
  if(!el)return;
  const list=[...POSTS].sort((a,b)=>a.createdAt-b.createdAt),i=list.findIndex(x=>x.id===p.id);
  el.outerHTML=roomRowHTML(p,list[i-1]);
  wireFeed();wireRoomChat(f);
}
function paintRoomJump(){const j=$("#lrjump"),f=$("#feed");if(!j||!f)return;
  j.hidden=ROOMSTICK&&!LABUNSEEN;j.innerHTML=CI.down+(LABUNSEEN?`<b>${LABUNSEEN}</b>`:"")}

function wireRoomChat(f){
  if(!f.dataset.sc){f.dataset.sc="1";
    f.addEventListener("scroll",()=>{ROOMSTICK=f.scrollHeight-f.scrollTop-f.clientHeight<120;if(ROOMSTICK)LABUNSEEN=0;paintRoomJump()},{passive:true})}
  f.querySelectorAll("[data-rx]").forEach(b=>b.onclick=e=>{e.stopPropagation();reactTo(b.dataset.rxt,b.dataset.rx)});
  f.querySelectorAll("[data-jump]").forEach(el=>el.onclick=e=>{e.stopPropagation();jumpTo(f,el.dataset.jump)});
  bindMsgGestures(f,"[data-post-row]",{
    hold:el=>labMenu(el.dataset.postRow),
    swipe:el=>{const p=roomPost(el.dataset.postRow);if(p&&!p.pending){LABREPLY=p;paintLabBar();$("#draft")?.focus()}},
    dbl:el=>{const p=roomPost(el.dataset.postRow);if(p&&!p.pending)reactTo("post:"+p.id,"❤️",true)}});
  const d=$("#draft");
  if(d&&!d.dataset.cw){d.dataset.cw="1";let last=0;
    d.addEventListener("input",()=>{LABDRAFT=d.value;
      if(d.value&&Date.now()-last>3000&&CH&&!CH.archive){last=Date.now();capi.typing("lab:"+CH.id).catch(()=>{})}})}
  const j=$("#lrjump");if(j)j.onclick=()=>{f.scrollTo({top:f.scrollHeight,behavior:"smooth"});LABUNSEEN=0;ROOMSTICK=true;paintRoomJump()};
  const bell=$("#lrbell");if(bell)bell.onclick=()=>{const k="lab:"+CH.id;CHATSHEET={kind:"mute",chat:k,muted:LABMUTED.has(k)};paintLayer()};
}
const roomPost=id=>(POSTS||[]).find(x=>String(x.id)===String(id));

function paintLabBar(){
  const el=$("#lrbar");if(!el)return;
  const p=LABREPLY&&CH&&LABREPLY.channel===CH.id?LABREPLY:null;
  el.innerHTML=p?`<div class="c-bar"><span><b>Replying to ${esc(p.author.username===myName()?"yourself":p.author.displayName)}</b>${esc(p.body||(p.videoUrl?"Video":p.imageUrl?"Photo":"Post"))}</span><button class="cx-ib" id="lrbarx" aria-label="Cancel reply">${CI.x}</button></div>`:"";
  const x=$("#lrbarx");if(x)x.onclick=()=>{LABREPLY=null;paintLabBar()};
}
function paintLabBell(){const b=$("#lrbell");if(!b||!CH)return;const m=LABMUTED.has("lab:"+CH.id);
  b.classList.toggle("on",m);b.innerHTML=m?CI.mute.replace(/width="14" height="14"/,'width="18" height="18"'):UI_IC.bell;b.setAttribute("aria-label",m?"Muted — change":"Mute this channel")}

/* Pinned: the newest pin shows; tap to go to it, tap again for the next. */
function paintPins(){
  const el=$("#lrpins");if(!el)return;
  const pins=(LABPINS||[]).filter(p=>p.channel===CH.id);
  if(!pins.length){el.innerHTML="";return}
  const i=PINIDX%pins.length,p=pins[i];
  el.innerHTML=`<button class="lr-pin" id="lrpin">${CI.pin}<span><b>Pinned${pins.length>1?` · ${i+1} of ${pins.length}`:""}</b>${esc(p.body||(p.images||p.imageUrl?"Photo":p.videoUrl?"Video":"Post"))}</span></button>`;
  $("#lrpin").onclick=()=>{const f=$("#feed");
    if(f&&f.querySelector(`[data-post-row="${p.id}"]`))jumpTo(f,p.id);
    else{POSTOPEN=p;OPENCOMMENTS=p.id;COMMENTS=[];render();api.comments(p.id).then(r=>{COMMENTS=r.comments;render()}).catch(()=>{})}
    PINIDX++;setTimeout(paintPins,900)};
}

function labMenu(id){
  const p=roomPost(id);if(!p||p.pending||p.failed)return;
  const mine=p.author.username===myName(),admin=!!(ME&&ME.isAdmin),acts=[];
  const pinned=(LABPINS||[]).some(x=>x.id===p.id);
  acts.push({icon:CI.reply,label:"Reply",run:()=>{LABREPLY=p;paintLabBar();$("#draft")?.focus()}});
  if(p.body)acts.push({icon:CI.copy,label:"Copy",run:()=>copyText(p.body)});
  acts.push({icon:CI.fwd,label:"Send to…",run:()=>sendPostSheet(p.id)});
  acts.push({icon:CI.open,label:"Open with comments",run:()=>openPost(p)});
  if(mine)acts.push({icon:CI.edit,label:"Edit",run:()=>{EDITID=p.id;LABREPLY=null;render();const d=$("#draft");if(d){d.value=p.body||"";d.focus()}}});
  if(admin)acts.push({icon:CI.pin,label:pinned?"Unpin":"Pin",run:async()=>{
    try{const r=await capi.pin(p.id,!pinned);LABPINS=r.pins;PINIDX=0;paintPins();toast(pinned?"Unpinned":"Pinned for everyone in "+chName(CH))}catch(e){toast(e.message)}}});
  if(mine||admin)acts.push({icon:CI.trash,label:"Delete",danger:true,run:async()=>{
    if(!(await uiConfirm("Delete this message?",mine?"":"You're removing someone else's message as an admin.",{okLabel:"Delete",danger:true})))return;
    try{mine?await api.delPost(p.id):await req("/api/admin/posts/"+p.id,{method:"DELETE"});POSTS=POSTS.filter(x=>x.id!==p.id);renderRoomFeed()}catch(e){toast(e.message)}}});
  const me=(p.reactions||[]).find(r=>r.username===myName());
  openMenu({react:true,mine:me&&me.emoji,preview:(p.author.displayName+": "+(p.body||"")).slice(0,120)+" · "+clock(p.createdAt),actions:acts,onReact:e=>reactTo("post:"+p.id,e)});
}
const replyOf=p=>p?{id:p.id,from:p.author.username,displayName:p.author.displayName,text:(p.body||"").slice(0,140)}:null;

/* The "…" on a post, anywhere — Showroom, a profile, the post view, search.
   In a lab room it's the same menu as holding the message. */
function findAnyPost(id){id=Number(id);
  const all=[...(POSTS||[]),...(SRPOSTS||[]),...(POSTOPEN?[POSTOPEN]:[]),...(PROFILE?[...(PROFILE.posts||[]),...(PROFILE.collabs||[])]:[]),...(SEARCHRES?SEARCHRES.posts||[]:[])];
  return all.find(x=>x.id===id)}
async function openPost(p){POSTOPEN=p;OPENCOMMENTS=p.id;COMMENTS=[];render();try{COMMENTS=(await api.comments(p.id)).comments;render()}catch(e){}}
function postMenu(id){
  if(TAB==="labs"&&!POSTOPEN&&!PROFILE&&roomPost(id))return labMenu(id);
  const p=findAnyPost(id);if(!p||!ME)return;
  const mine=p.author.username===myName(),admin=!!ME.isAdmin,acts=[];
  if(p.body)acts.push({icon:CI.copy,label:"Copy text",run:()=>copyText(p.body)});
  acts.push({icon:CI.fwd,label:"Send to…",run:()=>sendPostSheet(p.id)});
  if(mine)acts.push({icon:CI.edit,label:"Edit caption",run:async()=>{
    const v=await uiPrompt("Edit caption",{value:p.body||"",okLabel:"Save"});if(v==null)return;
    try{const r=await api.editPost(p.id,v.trim());Object.assign(p,{body:r.post?r.post.body:v.trim(),editedAt:Date.now()});render();toast("Saved")}catch(e){toast(e.message)}}});
  /* Comments on/off after posting, like Instagram. The comment button and
     box go in place; nothing else repaints. */
  if(mine)acts.push({icon:IG_COMMENT,label:p.commentsOff?"Turn on commenting":"Turn off commenting",run:async()=>{
    try{const r=await req("/api/posts/"+p.id+"/comments-off",{method:"POST",body:{off:!p.commentsOff}});
      for(const x of likeCopies(p.id))x.commentsOff=r.commentsOff;
      if(OPENCOMMENTS===p.id)OPENCOMMENTS=null;
      pxPaintActs(p.id);paintComments();toast(r.commentsOff?"Comments off":"Comments on")}catch(e){toast(e.message)}}});
  if(mine||admin)acts.push({icon:CI.trash,label:"Delete",danger:true,run:async()=>{
    if(!(await uiConfirm("Delete this post?",mine?"":"You're removing someone else's post as an admin.",{okLabel:"Delete",danger:true})))return;
    try{mine?await api.delPost(p.id):await req("/api/admin/posts/"+p.id,{method:"DELETE"});
      const drop=a=>a&&a.filter(x=>x.id!==p.id);POSTS=drop(POSTS);SRPOSTS=drop(SRPOSTS)||[];
      if(PROFILE){PROFILE.posts=drop(PROFILE.posts);PROFILE.collabs=drop(PROFILE.collabs)}
      if(POSTOPEN&&POSTOPEN.id===p.id)POSTOPEN=null;render();toast("Deleted")}catch(e){toast(e.message)}}});
  openMenu({react:false,preview:(p.author.displayName+(p.body?": "+p.body:"")).slice(0,120),actions:acts});
}
