/* MESSAGES v2.0 — 2026-09-29. The live stream.
   The server only streams to a signed-in member, so the app trades its
   token for a one-use ticket first (EventSource can't send headers). If
   the stream drops it reconnects with a fresh ticket, backing off. */
let es=null, ESTRY=0, ESTIMER=null;
async function startStream(){
  if(es){es.close();es=null}
  clearTimeout(ESTIMER);
  if(!ME)return;
  let ticket;
  try{ticket=(await capi.ticket()).ticket}catch(e){return retryStream()}
  es=new EventSource(API+"/api/stream?ticket="+encodeURIComponent(ticket));
  es.addEventListener("hello",()=>{ESTRY=0});
  // A ticket works once, so the browser's own reconnect would be refused — re-ticket instead.
  es.onerror=()=>{if(es){es.close();es=null}retryStream()};
  const on=(t,fn)=>es.addEventListener(t,e=>{try{fn(JSON.parse(e.data))}catch(x){}});
  const refresh=()=>{if(!ME)return;if(TAB==="labs")loadFeed(true);if(TAB==="showroom")loadShowroom(true)};
  on("comment",d=>{if(OPENCOMMENTS===d.postId)api.comments(d.postId).then(r=>{if(OPENCOMMENTS===d.postId){COMMENTS=r.comments;paintComments()}})});
  on("like",d=>{if(d&&d.postId!=null&&!LIKING[String(d.postId)]&&typeof d.likeCount==="number")setLike(String(d.postId),null,d.likeCount)});
  ["collab-invite","collab-accepted"].forEach(t=>on(t,refresh));
  on("post",p=>{if(TAB==="labs"&&CH&&p.channel===CH.id){clearTyping("lab:"+CH.id,p.author&&p.author.username);loadFeed(true)}
    else if(TAB==="showroom")loadShowroom(true);
    if(p.author&&p.author.username!==myName())loadUnreads()});
  on("post-edit",p=>{const i=(POSTS||[]).findIndex(x=>x.id===p.id);if(i>=0){POSTS[i]=p;renderRoomFeed()}else refresh()});
  on("post-delete",d=>{if((POSTS||[]).some(x=>x.id===d.id)){POSTS=POSTS.filter(x=>x.id!==d.id);LABPINS=LABPINS.filter(x=>x.id!==d.id);renderRoomFeed()}});
  on("post-react",d=>{const p=(POSTS||[]).find(x=>x.id===d.id);if(p){p.reactions=d.reactions;paintRoomRow(p)}});
  on("pins",d=>{if(TAB==="labs"&&CH&&CH.id===d.channel)loadFeed(true)});
  on("typing",onTyping);
  on("chat",onChatEvent);
  on("chat-update",onChatUpdate);
  on("chat-read",d=>{if(CHAT&&CHAT.id===d.chatId&&CHAT.meta){const p=CHAT.meta.people.find(x=>x.username===d.username);if(p){p.readAt=d.at;paintFeed()}}});
  on("chat-meta",d=>{if(CHAT&&CHAT.id===d.chatId)loadChat(d.chatId);else if(DMOPENPANEL&&!CHAT)loadInbox();else refreshBadges()});
  on("presence",d=>{
    if(INBOX)for(const t of [...INBOX.threads,...INBOX.requests])if(t.other&&t.other.username===d.username&&"active" in t.other){t.other.active=d.active;t.other.lastSeenAt=d.at}
    const o=chatOther();if(o&&o.username===d.username&&"active" in o){o.active=d.active;o.lastSeenAt=d.at}
    if(DMOPENPANEL&&!CHATSHEET&&!CMENU){if(CHAT){const h=$(".cx-th .cx-who .mono");if(h&&o)h.textContent=activeLine(o)||"@"+o.username;
      const dot=$(".cx-th .cx-av");if(dot&&o){const i=dot.querySelector(".cx-on");if(o.active&&!i)dot.insertAdjacentHTML("beforeend",'<i class="cx-on"></i>');if(!o.active&&i)i.remove()}}
      else paintLayer()}
  });
}
function retryStream(){
  clearTimeout(ESTIMER);if(!ME)return;
  const wait=Math.min(30000,1000*Math.pow(2,ESTRY++))+Math.random()*500;
  ESTIMER=setTimeout(startStream,wait);
}
// Back from the background: phones kill idle connections, so check.
document.addEventListener("visibilitychange",()=>{if(document.visibilityState==="visible"&&ME&&!es)startStream()});

function onChatEvent(d){
  const m=d.message;
  if(CHAT&&CHAT.id===d.chatId&&CHAT.messages){
    if(CHAT.messages.some(x=>x.id===m.id))return;
    if(isMine(m)){
      // our own send, arriving live before the POST answered: take the temp's place
      const t=CHAT.messages.find(x=>x.pending&&String(x.id).startsWith("t")&&x.body===m.body&&!!x.audioUrl===!!m.audioUrl);
      if(t){CHAT.messages=CHAT.messages.map(x=>x===t?m:x);return paintFeed()}
    }
    CHAT.messages.push(m);
    const f=$("#cxfeed"),atBottom=f&&f.scrollHeight-f.scrollTop-f.clientHeight<80;
    if(!isMine(m)&&!atBottom)CHAT.unseen=(CHAT.unseen||0)+1;
    if(m.from)clearTyping("dm:"+d.chatId,m.from.username);
    paintFeed();
    if(!isMine(m)&&document.visibilityState==="visible")capi.read(CHAT.id).catch(()=>{});
    return;
  }
  if(!isMine(m)){if(DMOPENPANEL&&!CHAT)loadInbox();else refreshBadges()}
}
function onChatUpdate(d){
  if(!CHAT||CHAT.id!==d.chatId||!CHAT.messages)return;
  if(d.deleted)CHAT.messages=CHAT.messages.filter(x=>x.id!==d.id);
  else if(d.message){const i=CHAT.messages.findIndex(x=>x.id===d.message.id);if(i>=0)CHAT.messages[i]=d.message}
  else if(d.reactions){const x=findMsg(d.id);if(x)x.reactions=d.reactions}
  paintFeed();
}

/* Typing: dots for 6 seconds after the last keystroke we hear about. */
function onTyping(d){
  if(d.username===myName())return;
  (TYPING[d.chat]=TYPING[d.chat]||{})[d.username]={name:(d.displayName||d.username).split(" ")[0],until:Date.now()+6000};
  paintTyping(d.chat);
  setTimeout(()=>paintTyping(d.chat),6100);
}
function clearTyping(chat,u){if(TYPING[chat]&&u){delete TYPING[chat][u];paintTyping(chat)}}
function paintTyping(chat){
  if(CHAT&&"dm:"+CHAT.id===chat){const el=$("#cxtyping");if(el){const f=$("#cxfeed"),b=f&&f.scrollHeight-f.scrollTop-f.clientHeight<80;
    el.innerHTML=typingHTML(typingNames(chat));if(b)f.scrollTop=f.scrollHeight}}
  if(TAB==="labs"&&CH&&"lab:"+CH.id===chat){const el=$("#lrtyping");if(el)el.innerHTML=typingHTML(typingNames(chat))}
}
