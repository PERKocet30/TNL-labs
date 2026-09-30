/* MESSAGES v2.0 — 2026-09-29. The inbox and the chat screen (markup). */
const chatTitle=c=>c.isGroup?(c.title||c.people.filter(p=>p.username!==myName()).map(p=>(p.displayName||p.username).split(" ")[0]).join(", ")||"Group")
  :((c.other&&(c.other.displayName||c.other.username))||"");
const groupAvHTML=ps=>`<span class="c-gav">${(ps||[]).slice(0,2).map(p=>avHTML(p,"sm")).join("")}</span>`;
const chatOther=()=>CHAT&&CHAT.meta&&!CHAT.meta.isGroup?CHAT.meta.people.find(p=>p.username!==myName()):null;

function dmScreenHTML(){return `<div class="cx" id="cx"><div class="cx-in">${CHAT?threadHTML():inboxHTML()}</div></div>`}

function inboxHTML(){
  const I=INBOX, list=!I?null:INBOXTAB==="requests"?I.requests:I.threads;
  return `<header class="cx-h">
      <button class="cx-ib" id="cxclose" aria-label="Close">${CI.back}</button>
      <h2>Messages</h2>
      <button class="cx-ib" id="cxnew" aria-label="New message">${CI.compose}</button>
    </header>
    <div class="cx-tabs" role="tablist">
      <button class="${INBOXTAB==="chats"?"on":""}" data-itab="chats" role="tab">Chats</button>
      <button class="${INBOXTAB==="requests"?"on":""}" data-itab="requests" role="tab">Requests${I&&I.requestCount?`<b>${I.requestCount}</b>`:""}</button>
    </div>
    <div class="cx-list">${!I?`${skel()}`:!list.length
      ?(INBOXTAB==="requests"?`<div class="cx-empty"><b>No requests</b><span>Messages from people you don't follow land here first.</span></div>`
        :`<div class="cx-empty"><b>No messages yet</b><span>Start a chat with someone you want to make something with.</span><button class="btn" id="cxnew2">New message</button></div>`)
      :list.map(inboxRowHTML).join("")}
      ${I&&INBOXTAB==="chats"?`<button class="cx-set" id="cxactive"><span>Show activity status</span><i class="c-sw ${I.showActive?"on":""}"></i></button>`:""}
    </div>`}

function inboxRowHTML(c){
  const L=c.last;
  const line=!L?(c.isGroup?"Group made":""):L.kind==="system"?L.body
    :(L.mine?"You: ":c.isGroup&&L.from?L.from.split(" ")[0]+": ":"")+L.body;
  return `<button class="cx-row ${c.unread?"unread":""}" data-chat="${c.id}">
    <span class="cx-av">${c.isGroup?groupAvHTML(c.people):avHTML(c.other)}${!c.isGroup&&c.other.active?`<i class="cx-on" aria-label="Active now"></i>`:""}</span>
    <span class="cx-rb"><b>${esc(chatTitle(c))}</b><span class="cx-rs"><span>${esc(line)}</span>${L?`<span class="cx-rt">· ${agoShort(L.createdAt)}</span>`:""}</span></span>
    ${c.muted?`<span class="cx-mu" aria-label="Muted">${CI.mute}</span>`:""}${c.unread?`<i class="cx-dot" aria-label="${c.unread} unread"></i>`:""}
  </button>`}

function threadHTML(){
  const c=CHAT,m=c.meta,o=chatOther()||c.other;
  const sub=!m?(o?"@"+o.username:""):m.isGroup?m.people.length+" people":(activeLine(o)||(o?"@"+o.username:""));
  return `<header class="cx-h cx-th">
      <button class="cx-ib" id="cxback" aria-label="Back">${CI.back}</button>
      <button class="cx-who" id="cxwho">${m&&m.isGroup?groupAvHTML(m.people.filter(p=>p.username!==myName())):`<span class="cx-av">${avHTML(o,"sm")}${o&&o.active?`<i class="cx-on"></i>`:""}</span>`}
        <span><b>${esc(m?chatTitle(m):(o&&o.displayName)||"")}</b><span class="mono">${esc(sub)}</span></span></button>
      ${c.id?`<button class="cx-ib" id="cxinfo" aria-label="Chat details">${CI.info}</button>`:""}
    </header>
    <div class="cx-feed" id="cxfeed">${chatFeedHTML()}</div>
    <button class="c-jump" id="cxjump" aria-label="Jump to latest" ${c.unseen?"":"hidden"}>${CI.down}${c.unseen?`<b>${c.unseen}</b>`:""}</button>
    ${m&&m.request?`<div class="cx-req"><b>${esc(chatTitle(m))} wants to message you</b>
      <span>They won't see that you've read it until you accept.</span>
      <div><button class="btn ghost" id="cxdecl">Delete</button>${m.isGroup?"":`<button class="btn ghost" id="cxblock">Block</button>`}<button class="btn" id="cxacc">Accept</button></div></div>`:""}
    <div class="c-foot" id="cxfoot">${chatComposerHTML()}</div>`}

const sameRun=(a,b)=>!!(a&&b&&a.kind!=="system"&&b.kind!=="system"&&a.from&&b.from&&a.from.username===b.from.username
  &&Math.abs(b.createdAt-a.createdAt)<180000&&!newDay(a,b));
const bigGap=(a,b)=>newDay(a,b)||(b.createdAt-a.createdAt>3600000);

function chatFeedHTML(){
  const c=CHAT;
  if(!c.messages)return `${skel()}`;
  const m=c.meta,o=chatOther()||c.other,msgs=c.messages;
  let h=c.hasMore?`<div class="c-more" id="cxmore">${c.loadingMore?"Loading…":""}</div>`:"";
  if(!c.hasMore&&o&&!(m&&m.isGroup))h+=`<div class="cx-hello">${avHTML(o,"lg")}<b>${esc(o.displayName||o.username)}</b><span class="mono">@${esc(o.username)}</span><button class="btn ghost sm" data-cxprof="${esc(o.username)}">View profile</button></div>`;
  let lastMine=-1;for(let i=msgs.length-1;i>=0;i--)if(msgs[i].from&&msgs[i].from.username===myName()&&msgs[i].kind!=="system"){lastMine=i;break}
  msgs.forEach((x,i)=>{const prev=msgs[i-1];
    if(!prev||bigGap(prev,x))h+=`<div class="c-day"><span>${esc(dayLabel(x.createdAt))} ${esc(clock(x.createdAt))}</span></div>`;
    h+=x.kind==="system"?`<div class="c-sys">${esc(x.body)}</div>`:bubbleHTML(x,prev,msgs[i+1],i===lastMine);
  });
  return h+`<div id="cxtyping">${c.id?typingHTML(typingNames("dm:"+c.id)):""}</div>`;
}

function seenLine(x){
  if(x.pending)return "Sending…";
  if(x.failed)return `Didn't send · <button class="c-retry" data-cretry="${x.id}">Retry</button>`;
  const m=CHAT.meta;if(!m)return "Sent";
  const seen=m.people.filter(p=>p.username!==myName()&&p.readAt&&p.readAt>=x.createdAt);
  if(!seen.length)return "Sent";
  if(!m.isGroup)return "Seen";
  return "Seen by "+(seen.length>3?seen.length:seen.map(p=>(p.displayName||p.username).split(" ")[0]).join(", "));
}

function bubbleHTML(x,prev,next,isLastMine){
  const mine=x.from&&x.from.username===myName(), group=CHAT.meta&&CHAT.meta.isGroup;
  const first=!sameRun(prev,x), last=!sameRun(x,next);
  const media=x.imageUrl?`<img class="c-img" src="${esc(x.imageUrl)}" alt="" loading="lazy" data-czoom="${esc(x.imageUrl)}">`
    :x.videoUrl?`<video class="c-vid" src="${esc(x.videoUrl)}" playsinline controls preload="metadata"></video>`
    :x.audioUrl?voiceHTML(x.audioUrl,x.audioMs):"";
  const post=!x.post?"":x.post.gone?`<div class="c-post gone mono">Post unavailable</div>`
    :`<button class="c-post" data-cpost="${x.post.id}">${x.post.imageUrl?`<img src="${esc(x.post.imageUrl)}" alt="" loading="lazy">`:""}
      <span class="c-postb"><span class="c-posth">${avHTML(x.post.author,"xs")}<b>${esc(x.post.author.displayName||x.post.author.username)}</b></span>${x.post.body?`<span class="c-postt">${esc(x.post.body)}</span>`:""}</span></button>`;
  const text=x.body?`<div class="c-b">${rich(x.body)}${linkPrevHTML(x.link)}</div>`:"";
  return `<div class="c-m ${mine?"me":"them"} ${first?"first":""} ${last?"last":""} ${x.pending?"pending":""} ${x.failed?"failed":""}" data-mid="${x.id}">
    ${!mine&&group?`<span class="c-mav">${last?`<span data-cxprof="${esc(x.from.username)}">${avHTML(x.from,"xs")}</span>`:""}</span>`:""}
    <div class="c-col">
      ${!mine&&group&&first?`<span class="c-who">${esc(x.from.displayName||x.from.username)}</span>`:""}
      ${x.forwarded?`<span class="c-fw">${CI.fwd}Forwarded</span>`:""}
      ${quoteHTML(x.replyTo)}
      <div class="c-bw">${media}${post}${text}</div>
      ${reactsHTML(x.reactions,"dm:"+x.id)}
      ${x.editedAt?`<span class="c-meta">Edited</span>`:""}
      ${isLastMine||x.failed?`<span class="c-meta c-seen">${seenLine(x)}</span>`:""}
    </div>
  </div>`}

function chatComposerHTML(){
  const c=CHAT;
  if(RECORD)return `<div class="c-rec">
    <button class="cx-ib" id="recx" aria-label="Delete recording">${CI.trash}</button>
    <span class="c-recdot"></span><span class="mono" id="rect">${mmss(RECORD.ms)||"0:00"}</span><span class="c-recl">Recording</span>
    <button class="send" id="recsend" aria-label="Send voice note">${CI.send}</button></div>`;
  const bar=c.edit?{t:"Editing message",s:c.edit.body}
    :c.reply?{t:"Replying to "+(c.reply.from&&c.reply.from.username===myName()?"yourself":(c.reply.from&&(c.reply.from.displayName||c.reply.from.username))||""),s:c.reply.body||(c.reply.audioUrl?"Voice message":c.reply.videoUrl?"Video":c.reply.imageUrl?"Photo":c.reply.post?"Post":"")}:null;
  const has=(c.draft||"").trim()||c.att;
  return `${bar?`<div class="c-bar"><span><b>${esc(bar.t)}</b>${esc(bar.s||"")}</span><button class="cx-ib" id="cxbarx" aria-label="Cancel">${CI.x}</button></div>`:""}
    ${c.att?`<div class="c-att">${c.att.kind==="video"?`<video src="${esc(c.att.preview)}" muted playsinline></video>`:`<img src="${esc(c.att.preview)}" alt="">`}
      ${c.att.pct!=null?`<span class="c-attp"><i style="width:${Math.round(c.att.pct*100)}%"></i></span>`:""}
      <button class="cx-ib" id="cxattx" aria-label="Remove">${CI.x}</button></div>`:""}
    <div class="composer c-comp">
      <input type="file" id="cxfile" accept="image/*,video/*" hidden>
      ${c.edit?"":`<button class="attach" id="cxatt" aria-label="Photo or video">${CI.img}</button>`}
      <textarea class="in c-in" id="cxdraft" rows="1" placeholder="Message…" enterkeyhint="send">${esc(c.draft||"")}</textarea>
      <button class="send" id="cxsend" aria-label="Send" ${has||c.edit?"":"hidden"}>${c.edit?CI.check:CI.send}</button>
      ${c.edit?"":`<button class="attach c-micb" id="cxmic" aria-label="Record voice note" ${has?"hidden":""}>${CI.mic}</button>`}
    </div>`}

/* ---- sheets: new message, forward, add people, details, mute ---- */
function personRowHTML(p,on){return `<button class="cx-pick ${on?"on":""}" data-cxpick="${esc(p.username)}">${avHTML(p,"sm")}
  <span><b>${esc(p.displayName||p.username)}</b><span class="mono">@${esc(p.username)}</span></span><i class="c-tick">${on?CI.check:""}</i></button>`}

function chatSheetHTML(){
  const s=CHATSHEET;
  const head=(t,btn)=>`<header class="cs-h"><button class="cx-ib" id="csx" aria-label="Close">${CI.x}</button><b>${esc(t)}</b>${btn||"<span></span>"}</header>`;
  let body="";
  if(s.kind==="new"||s.kind==="fwd"||s.kind==="add"){
    const picked=s.picked||[];
    const title=s.kind==="new"?"New message":s.kind==="add"?"Add people":"Send to";
    const cta=s.kind==="new"?(picked.length>1?"Create group":"Chat"):s.kind==="add"?"Add":"Send";
    const recent=s.kind==="fwd"&&!s.q&&INBOX?INBOX.threads.slice(0,12):[];
    body=head(title,`<button class="btn sm" id="csgo" ${picked.length||(s.chats||[]).length?"":"disabled"}>${esc(cta)}</button>`)+`
      <div class="cs-body">
        <input class="in" id="csq" placeholder="Search" value="${esc(s.q||"")}" autocomplete="off">
        ${picked.length?`<div class="cs-chips">${picked.map(p=>`<button class="cs-chip" data-cxunpick="${esc(p.username)}">${esc(p.displayName||p.username)} ${CI.x}</button>`).join("")}</div>`:""}
        ${s.kind==="new"&&picked.length>1?`<input class="in" id="cstitle" placeholder="Group name (optional)" maxlength="60" value="${esc(s.title||"")}">`:""}
        ${s.kind==="fwd"?`<input class="in" id="csnote" placeholder="Add a message" maxlength="1000" value="${esc(s.note||"")}">`:""}
        ${recent.length?`<div class="mono cs-l">Recent</div>${recent.map(c=>`<button class="cx-pick ${(s.chats||[]).includes(c.id)?"on":""}" data-cxchat="${c.id}">
          ${c.isGroup?groupAvHTML(c.people):avHTML(c.other,"sm")}<span><b>${esc(chatTitle(c))}</b>${c.isGroup?`<span class="mono">${c.count} people</span>`:`<span class="mono">@${esc(c.other.username)}</span>`}</span>
          <i class="c-tick">${(s.chats||[]).includes(c.id)?CI.check:""}</i></button>`).join("")}<div class="mono cs-l">People</div>`:""}
        ${!s.results?`${skel()}`:s.results.filter(p=>!(s.exclude||[]).includes(p.username)).map(p=>personRowHTML(p,picked.some(x=>x.username===p.username))).join("")||`<div class="empty">No one found</div>`}
      </div>`;
  } else if(s.kind==="info"){
    const m=CHAT.meta,o=chatOther(),maker=m.createdBy===myName();
    body=head(m.isGroup?"Group":"Details")+`<div class="cs-body">
      ${m.isGroup?`<div class="cs-row"><input class="in" id="csrename" maxlength="60" placeholder="Name this group" value="${esc(m.title||"")}"><button class="btn sm" id="csrenamego">Save</button></div>
        <div class="mono cs-l">${m.people.length} people</div>
        ${m.people.map(p=>`<div class="cx-pick"><span data-cxprof="${esc(p.username)}">${avHTML(p,"sm")}</span><span><b>${esc(p.displayName||p.username)}${p.username===myName()?" (you)":""}</b><span class="mono">@${esc(p.username)}${p.username===m.createdBy?" · made the group":""}</span></span>
          ${maker&&p.username!==myName()?`<button class="btn ghost sm" data-csrm="${esc(p.username)}">Remove</button>`:""}</div>`).join("")}
        <button class="cs-a" id="csadd">${CI.people}<span>Add people</span></button>`
      :`<div class="cs-who" data-cxprof="${esc(o.username)}">${avHTML(o,"lg")}<b>${esc(o.displayName||o.username)}</b><span class="mono">@${esc(o.username)}</span></div>`}
      <button class="cs-a" id="csmute">${CI.mute}<span>${m.muted?"Unmute":"Mute messages"}</span></button>
      ${m.isGroup?`<button class="cs-a danger" id="csleave">${CI.back}<span>Leave group</span></button>`
        :`<button class="cs-a danger" id="csblock">${CI.x}<span>Block @${esc(o.username)}</span></button>`}
      <button class="cs-a danger" id="csclear">${CI.trash}<span>Delete chat</span></button>
    </div>`;
  } else if(s.kind==="mute"){
    body=head(s.muted?"Muted":"Mute")+`<div class="cs-body">
      ${s.muted?`<button class="cs-a" data-csmute="0">${CI.mute}<span>Unmute</span></button>`:""}
      ${[[1,"For 1 hour"],[8,"For 8 hours"],[168,"For 1 week"],[-1,"Until I change it"]].map(([h,l])=>`<button class="cs-a" data-csmute="${h}"><span>${l}</span></button>`).join("")}
      <p class="cs-note">Muted chats don't notify you or count toward the badge.</p></div>`;
  }
  return `<div class="cs-bg" id="csbg"><div class="cs" role="dialog" aria-modal="true">${body}</div></div>`}
