/* MESSAGES v2.0 — 2026-09-29. What the inbox and chat screen do. */
const CHATDRAFTS={};
let CHATSTICK=true;   // reading the newest message? then late-loading media keeps you there
const isMine=x=>!!(x&&x.from&&ME&&x.from.username===ME.username);

/* ---- opening and closing ---- */
function openMessages(){
  if(guest())return needAccount("Join to message people.");
  DMOPENPANEL=true;CHAT=null;CHATSHEET=null;CMENU=null;paintLayer();loadInbox();
}
async function loadInbox(){
  try{INBOX=await capi.inbox();DMUNREAD=INBOX.unreadTotal;paintBadges();
    if(INBOXTAB==="requests"&&!INBOX.requests.length&&!INBOX.threads.length)INBOXTAB="chats";
    if(DMOPENPANEL&&!CHAT&&!CHATSHEET)paintLayer()}catch(e){}
}
/* Any "Message" button in the app lands here. A chat is only created once
   something is sent, so opening one never leaves an empty thread behind. */
async function openDM(username){
  if(guest())return needAccount("Join to message people.");
  const fromPanel=DMOPENPANEL;
  DMOPENPANEL=true;PROFILE=null;CHATSHEET=null;CMENU=null;
  CHAT={id:null,to:username,other:null,messages:null,direct:!fromPanel,draft:CHATDRAFTS["u:"+username]||""};
  render();paintLayer();
  try{const r=await capi.withUser(username);
    if(!CHAT||CHAT.to!==username)return;
    if(r.chatId)return loadChat(r.chatId);
    CHAT.other=r.other;CHAT.messages=[];CHAT.hasMore=false;paintLayer();
  }catch(e){toast(e.message);closeMessages()}
}
function openChat(id){
  CHAT={id,messages:null,draft:CHATDRAFTS[id]||""};paintLayer();loadChat(id);
}
async function loadChat(id){
  try{const d=await capi.chat(id);
    if(!CHAT||(CHAT.id&&CHAT.id!==id))return;
    Object.assign(CHAT,{id,meta:d.chat,messages:d.messages,hasMore:d.hasMore,unseen:0,stick:true});
    if(!CHAT.draft)CHAT.draft=CHATDRAFTS[id]||"";
    if(INBOX){const r=[...INBOX.threads,...INBOX.requests].find(t=>t.id===id);if(r&&r.unread){r.unread=0;DMUNREAD=INBOX.threads.filter(t=>!t.muted).reduce((n,t)=>n+t.unread,0);paintBadges()}}
    paintLayer();
  }catch(e){toast(e.message);if(CHAT&&CHAT.id===id){CHAT=null;paintLayer();loadInbox()}}
}
async function loadOlder(){
  const c=CHAT;if(!c||!c.hasMore||c.loadingMore||!c.messages.length)return;
  c.loadingMore=true;
  try{const d=await capi.chat(c.id,c.messages[0].id);if(CHAT!==c)return;
    const f=$("#cxfeed"),h0=f?f.scrollHeight-f.scrollTop:0;
    c.messages=[...d.messages,...c.messages];c.hasMore=d.hasMore;c.loadingMore=false;
    paintFeed({keepFromBottom:h0});
  }catch(e){c.loadingMore=false}
}
function leaveChat(){
  if(RECORD)stopRecord(false);
  if(CHAT&&CHAT.direct)return closeMessages();
  CHAT=null;paintLayer();loadInbox();
}
function closeMessages(){
  if(RECORD)stopRecord(false);
  DMOPENPANEL=false;CHAT=null;CHATSHEET=null;CMENU=null;paintLayer();
}
/* Back button / swipe-back: innermost first. Returns false when nothing of
   ours was open, so the app's own history handling carries on. */
function chatPop(){
  if(CHATZOOM){CHATZOOM=null;paintLayer();return true}
  if(CMENU){closeMenu();return true}
  if(CHATSHEET){CHATSHEET=null;paintLayer();return true}
  if(CHAT){leaveChat();return true}
  if(DMOPENPANEL){closeMessages();return true}
  return false;
}

/* ---- painting without losing your place ---- */
function chatKeep(){
  const f=$("#cxfeed"),d=$("#cxdraft");
  return {f:!!f,top:f?f.scrollTop:0,bottom:f?f.scrollHeight-f.scrollTop-f.clientHeight<80:true,
    focus:d&&document.activeElement===d,sel:d?d.selectionStart:0};
}
function chatRestore(k){
  const f=$("#cxfeed");
  if(f){if(!k.f||k.bottom||(CHAT&&CHAT.stick)){f.scrollTop=f.scrollHeight;CHATSTICK=true;if(CHAT)CHAT.stick=false}else f.scrollTop=k.top}
  const d=$("#cxdraft");if(d){fitDraft(d);if(k.focus){d.focus();try{d.setSelectionRange(k.sel,k.sel)}catch(e){}}}
}
function paintFeed(o={}){
  const f=$("#cxfeed");if(!f||!CHAT)return;
  const atBottom=f.scrollHeight-f.scrollTop-f.clientHeight<80;
  f.innerHTML=chatFeedHTML();wireFeedLayer(f);
  if(o.keepFromBottom!=null)f.scrollTop=f.scrollHeight-o.keepFromBottom;
  else if(atBottom||o.bottom){f.scrollTop=f.scrollHeight;CHAT.unseen=0;CHATSTICK=true}
  paintJump();
}
function paintFoot(){const el=$("#cxfoot");if(!el||!CHAT)return;el.innerHTML=chatComposerHTML();wireComposer();const d=$("#cxdraft");if(d)fitDraft(d)}
function paintJump(){const j=$("#cxjump"),f=$("#cxfeed");if(!j||!f)return;
  const far=f.scrollHeight-f.scrollTop-f.clientHeight>240;
  j.hidden=!far&&!CHAT.unseen;j.innerHTML=CI.down+(CHAT.unseen?`<b>${CHAT.unseen}</b>`:"")}
const fitDraft=d=>{d.style.height="auto";d.style.height=Math.min(d.scrollHeight,120)+"px"};

/* ---- wiring ---- */
function wireLayer(){
  const L=chatLayer(),on=(id,fn)=>{const el=L.querySelector("#"+id);if(el)el.onclick=fn};
  on("cxclose",()=>closeMessages());
  on("cxback",()=>leaveChat());
  on("cxnew",()=>openPeopleSheet("new"));on("cxnew2",()=>openPeopleSheet("new"));
  on("cxactive",async()=>{try{const r=await capi.activity(!INBOX.showActive);INBOX.showActive=r.showActive;paintLayer();
    toast(r.showActive?"People you chat with can see when you're active":"Activity status off — you won't see others' either")}catch(e){toast(e.message)}});
  L.querySelectorAll("[data-itab]").forEach(b=>b.onclick=()=>{INBOXTAB=b.dataset.itab;paintLayer()});
  L.querySelectorAll("[data-chat]").forEach(b=>b.onclick=()=>openChat(+b.dataset.chat));
  on("cxinfo",()=>{if(CHAT&&CHAT.meta){CHATSHEET={kind:"info"};paintLayer()}});
  on("cxwho",()=>{const m=CHAT&&CHAT.meta;if(m&&m.isGroup){CHATSHEET={kind:"info"};paintLayer()}
    else{const o=chatOther()||CHAT.other;if(o)goProfile(o.username)}});
  on("cxacc",async()=>{try{await capi.accept(CHAT.id);CHAT.meta.request=false;INBOXTAB="chats";await loadChat(CHAT.id)}catch(e){toast(e.message)}});
  on("cxdecl",()=>clearChat(true));
  on("cxblock",()=>blockOther());
  on("czoom",()=>{CHATZOOM=null;paintLayer()});
  const f=L.querySelector("#cxfeed");
  if(f){wireFeedLayer(f);
    f.onscroll=()=>{if(f.scrollTop<120)loadOlder();CHATSTICK=f.scrollHeight-f.scrollTop-f.clientHeight<80;
      if(CHAT&&CHAT.unseen&&f.scrollHeight-f.scrollTop-f.clientHeight<80)CHAT.unseen=0;paintJump()}}
  on("cxjump",()=>{const f2=$("#cxfeed");if(f2)f2.scrollTo({top:f2.scrollHeight,behavior:"smooth"});CHAT.unseen=0;paintJump()});
  wireComposer();
  if(CHATSHEET)wireChatSheet();
  if(CMENU)wireMenu();
}
function goProfile(u){closeMessages();openProfile(u)}

function wireFeedLayer(f){
  f.querySelectorAll("[data-cxprof]").forEach(el=>el.onclick=e=>{e.stopPropagation();goProfile(el.dataset.cxprof)});
  f.querySelectorAll("[data-czoom]").forEach(el=>el.onclick=()=>{CHATZOOM=el.dataset.czoom;paintLayer()});
  f.querySelectorAll("[data-vn]").forEach(el=>el.querySelector(".c-vnp").onclick=e=>{e.stopPropagation();playVoice(el)});
  f.querySelectorAll("[data-cpost]").forEach(el=>el.onclick=()=>openPostById(+el.dataset.cpost));
  f.querySelectorAll("[data-jump]").forEach(el=>el.onclick=()=>jumpTo(f,el.dataset.jump));
  f.querySelectorAll("[data-rx]").forEach(b=>b.onclick=e=>{e.stopPropagation();reactTo(b.dataset.rxt,b.dataset.rx)});
  f.querySelectorAll("[data-cretry]").forEach(b=>b.onclick=()=>retrySend(b.dataset.cretry));
  f.querySelectorAll("[data-mid] .mention[data-u]").forEach(el=>el.onclick=e=>{e.stopPropagation();goProfile(el.dataset.u)});
  bindMsgGestures(f,".c-m:not(.pending):not(.failed)",{
    hold:el=>dmMenu(el.dataset.mid),
    swipe:el=>{const x=findMsg(el.dataset.mid);if(x){CHAT.reply=x;CHAT.edit=null;paintFoot();$("#cxdraft")?.focus()}},
    dbl:el=>reactTo("dm:"+el.dataset.mid,"❤️",true)});
  f.querySelectorAll("img,video").forEach(m=>{if(m.complete||m.readyState>0)return;
    m.addEventListener(m.tagName==="IMG"?"load":"loadedmetadata",()=>{if(CHATSTICK)f.scrollTop=f.scrollHeight},{once:true})});
  paintVoice();
}
function jumpTo(f,id){const el=f.querySelector(`[data-mid="${CSS.escape(String(id))}"],[data-post-row="${CSS.escape(String(id))}"]`);
  if(!el)return toast("That message is further back");
  el.scrollIntoView({block:"center",behavior:"smooth"});el.classList.add("flash");setTimeout(()=>el.classList.remove("flash"),1200)}
const findMsg=id=>CHAT&&CHAT.messages&&CHAT.messages.find(x=>String(x.id)===String(id));
async function openPostById(id){
  closeMessages();
  const p=(POSTS||[]).find(x=>x.id===id)||(SRPOSTS||[]).find(x=>x.id===id);
  if(p){POSTOPEN=p;OPENCOMMENTS=id;COMMENTS=[];render();try{COMMENTS=(await api.comments(id)).comments;render()}catch(e){}return}
  /* Not on screen (a ?p= link from Instagram): fetch just that post. */
  try{const d=await req("/api/posts/"+encodeURIComponent(id));if(d&&d.post)return openPost(d.post)}catch(e){toast(e.message||"Couldn't open that post")}
}

/* ---- reactions (DM messages and lab posts share this) ---- */
async function reactTo(target,emoji,onlyAdd){
  const [kind,id]=target.split(":");
  const list=kind==="dm"?findMsg(id):(POSTS||[]).find(p=>String(p.id)===id);
  if(!list)return;
  const cur=(list.reactions||[]).find(r=>r.username===myName());
  if(onlyAdd&&cur&&cur.emoji===emoji)return;
  // optimistic — the server's answer replaces it a moment later
  list.reactions=(list.reactions||[]).filter(r=>r.username!==myName());
  if(!cur||cur.emoji!==emoji)list.reactions.push({emoji,username:myName()});
  kind==="dm"?paintFeed():paintRoomRow(list);
  try{const r=kind==="dm"?await capi.react(id,emoji):await capi.postReact(id,emoji);list.reactions=r.reactions;kind==="dm"?paintFeed():paintRoomRow(list)}
  catch(e){toast(e.message)}
}

/* ---- the hold menu for a DM ---- */
function dmMenu(id){
  const x=findMsg(id);if(!x||!CHAT.id)return;
  const mine=isMine(x),acts=[];
  acts.push({icon:CI.reply,label:"Reply",run:()=>{CHAT.reply=x;CHAT.edit=null;paintFoot();$("#cxdraft")?.focus()}});
  if(x.body)acts.push({icon:CI.copy,label:"Copy",run:()=>copyText(x.body)});
  acts.push({icon:CI.fwd,label:"Forward",run:()=>openPeopleSheet("fwd",{messageId:x.id})});
  if(mine&&x.body&&Date.now()-x.createdAt<15*60000)acts.push({icon:CI.edit,label:"Edit",run:()=>{CHAT.edit=x;CHAT.reply=null;CHAT.draft=x.body;paintFoot();const d=$("#cxdraft");if(d){d.focus();d.setSelectionRange(d.value.length,d.value.length)}}});
  if(mine)acts.push({icon:CI.trash,label:"Unsend",danger:true,run:async()=>{
    if(!(await uiConfirm("Unsend message?","It's removed for everyone in the chat.",{okLabel:"Unsend",danger:true})))return;
    try{await capi.unsend(x.id);CHAT.messages=CHAT.messages.filter(m=>m!==x);paintFeed()}catch(e){toast(e.message)}}});
  const me=(x.reactions||[]).find(r=>r.username===myName());
  openMenu({react:true,mine:me&&me.emoji,preview:(x.body||"").slice(0,120)+" · "+clock(x.createdAt),actions:acts,onReact:e=>reactTo("dm:"+x.id,e)});
}
function wireMenu(){
  const L=chatLayer(),bg=L.querySelector("#cmbg");if(!bg)return;
  bg.onclick=e=>{if(e.target===bg)closeMenu()};
  L.querySelectorAll("[data-cme]").forEach(b=>b.onclick=()=>{const m=CMENU;closeMenu();m.onReact(b.dataset.cme)});
  L.querySelectorAll("[data-cma]").forEach(b=>b.onclick=()=>{const a=CMENU.actions[+b.dataset.cma];closeMenu();a.run()});
}

/* ---- composer ---- */
let TYPINGSENT=0;
function wireComposer(){
  const L=chatLayer(),d=L.querySelector("#cxdraft");
  if(d){
    d.oninput=()=>{CHAT.draft=d.value;CHATDRAFTS[CHAT.id||"u:"+CHAT.to]=d.value;fitDraft(d);
      const has=!!(d.value.trim()||CHAT.att||CHAT.edit),s=$("#cxsend"),m=$("#cxmic");
      if(s)s.hidden=!has;if(m)m.hidden=has;
      if(CHAT.id&&d.value&&Date.now()-TYPINGSENT>3000){TYPINGSENT=Date.now();capi.typing("dm:"+CHAT.id).catch(()=>{})}};
    d.onkeydown=e=>{if(e.key==="Enter"&&!e.shiftKey&&!e.isComposing&&window.matchMedia("(hover:hover)").matches){e.preventDefault();chatSend()}
      if(e.key==="Escape"&&(CHAT.reply||CHAT.edit)){CHAT.reply=null;if(CHAT.edit){CHAT.edit=null;CHAT.draft=""}paintFoot()}};
  }
  const on=(id,fn)=>{const el=L.querySelector("#"+id);if(el)el.onclick=fn};
  on("cxsend",()=>chatSend());
  on("cxbarx",()=>{if(CHAT.edit){CHAT.edit=null;CHAT.draft=""}CHAT.reply=null;paintFoot()});
  on("cxatt",()=>L.querySelector("#cxfile").click());
  on("cxattx",()=>{CHAT.att=null;paintFoot()});
  on("cxmic",()=>startRecord());
  on("recx",()=>stopRecord(false));
  on("recsend",()=>stopRecord(true));
  const fi=L.querySelector("#cxfile");
  if(fi)fi.onchange=async()=>{const file=fi.files&&fi.files[0];fi.value="";if(file)attachFile(file)};
}
async function attachFile(file){
  const c=CHAT,video=/^video\//.test(file.type);
  try{
    const prep=video?null:await compressImage(file);
    const blob=video?file:dataUrlToBlob(prep);
    const att={kind:video?"video":"image",preview:video?URL.createObjectURL(file):prep,pct:0};
    att.upload=uploadStream(blob,p=>{att.pct=p;const bar=document.querySelector(".c-attp i");if(bar)bar.style.width=Math.round(p*100)+"%"})
      .then(up=>{att.pct=null;att.url=up.url;att.upKind=up.kind;if(CHAT===c&&c.att===att)paintFoot();return up});
    att.upload.catch(e=>{if(c.att===att){c.att=null;paintFoot()}toast(e.message)});
    c.att=att;paintFoot();
  }catch(e){toast(e.message)}
}

async function chatSend(){
  const c=CHAT;if(!c)return;
  const body=(c.draft||"").trim();
  if(c.edit){
    const x=c.edit;
    try{const r=await capi.edit(x.id,body);Object.assign(x,r.message);c.edit=null;c.draft="";CHATDRAFTS[c.id]="";paintFeed();paintFoot()}catch(e){toast(e.message)}
    return;
  }
  if(!body&&!c.att)return;
  const att=c.att,reply=c.reply;
  const temp={id:"t"+Date.now(),kind:"msg",from:{username:ME.username,displayName:ME.displayName,avatarUrl:ME.avatarUrl},body,
    imageUrl:att&&att.kind==="image"?att.preview:null,videoUrl:att&&att.kind==="video"?att.preview:null,
    replyTo:reply?{id:reply.id,from:reply.from.username,text:(reply.body||"").slice(0,140)}:null,reactions:[],createdAt:Date.now(),pending:true};
  c.messages=[...(c.messages||[]),temp];c.draft="";c.reply=null;c.att=null;CHATDRAFTS[c.id||"u:"+c.to]="";
  paintFoot();paintFeed({bottom:true});$("#cxdraft")?.focus();
  const payload={body,replyTo:reply?reply.id:undefined};
  temp.retry={payload,att};
  await deliver(c,temp);
}
async function deliver(c,temp){
  const {payload,att}=temp.retry;
  try{
    if(att){const up=await att.upload;if(up.kind==="video"||att.kind==="video")payload.videoUrl=up.url;else payload.imageUrl=up.url}
    const r=c.id?await capi.send(c.id,payload):await capi.sendTo(c.to,payload);
    if(!c.id&&r.chatId){c.id=r.chatId;CHATDRAFTS["u:"+c.to]="";loadChat(r.chatId);return}
    settleMessage(c,temp,r.message);
  }catch(e){temp.pending=false;temp.failed=true;if(CHAT===c)paintFeed();toast(e.message)}
}
function retrySend(id){const c=CHAT,t=findMsg(id);if(!t||!t.retry)return;t.failed=false;t.pending=true;paintFeed();deliver(c,t)}
/* The live stream can deliver our own message before the POST answers — keep one copy. */
function settleMessage(c,temp,msg){
  if(!c.messages)return;
  if(c.messages.some(x=>x.id===msg.id))c.messages=c.messages.filter(x=>x!==temp);
  else c.messages=c.messages.map(x=>x===temp?msg:x);
  if(CHAT===c)paintFeed();
}

/* ---- voice notes ---- */
async function startRecord(){
  if(!navigator.mediaDevices||!navigator.mediaDevices.getUserMedia||!window.MediaRecorder)return toast("Voice notes aren't supported in this browser");
  try{
    const stream=await navigator.mediaDevices.getUserMedia({audio:true});
    const type=["audio/mp4","audio/webm;codecs=opus","audio/webm","audio/ogg;codecs=opus"].find(t=>MediaRecorder.isTypeSupported&&MediaRecorder.isTypeSupported(t));
    const rec=new MediaRecorder(stream,type?{mimeType:type}:undefined),chunks=[];
    rec.ondataavailable=e=>{if(e.data&&e.data.size)chunks.push(e.data)};
    RECORD={rec,stream,chunks,start:Date.now(),ms:0};
    RECORD.timer=setInterval(()=>{if(!RECORD)return;RECORD.ms=Date.now()-RECORD.start;const t=$("#rect");if(t)t.textContent=mmss(RECORD.ms)||"0:00";
      if(RECORD.ms>=5*60000)stopRecord(true)},250);
    rec.start(250);paintFoot();
  }catch(e){toast("Microphone is blocked — allow it for this site")}
}
function stopRecord(send){
  const R=RECORD;if(!R)return;clearInterval(R.timer);RECORD=null;
  const c=CHAT,ms=Date.now()-R.start;
  R.rec.onstop=()=>{R.stream.getTracks().forEach(t=>t.stop());
    if(!send||!c)return;
    if(ms<800)return toast("Hold on a little longer — that was too short");
    sendVoice(c,new Blob(R.chunks,{type:R.rec.mimeType||"audio/webm"}),ms)};
  try{R.rec.stop()}catch(e){R.stream.getTracks().forEach(t=>t.stop())}
  if(CHAT)paintFoot();
}
async function sendVoice(c,blob,ms){
  const temp={id:"t"+Date.now(),kind:"msg",from:{username:ME.username,displayName:ME.displayName},body:"",audioUrl:URL.createObjectURL(blob),audioMs:ms,reactions:[],createdAt:Date.now(),pending:true};
  c.messages=[...(c.messages||[]),temp];if(CHAT===c)paintFeed({bottom:true});
  try{const up=await uploadStream(blob);
    const payload={audioUrl:up.url,audioMs:ms,replyTo:c.reply?c.reply.id:undefined};c.reply=null;
    const r=c.id?await capi.send(c.id,payload):await capi.sendTo(c.to,payload);
    if(!c.id&&r.chatId){c.id=r.chatId;loadChat(r.chatId);return}
    settleMessage(c,temp,r.message);
  }catch(e){temp.pending=false;temp.failed=true;if(CHAT===c)paintFeed();toast(e.message)}
}

/* ---- details actions ---- */
async function clearChat(isRequest){
  if(!(await uiConfirm(isRequest?"Delete this request?":"Delete chat?",isRequest?"They won't be told.":"It's removed for you. Others in the chat keep their copy.",{okLabel:"Delete",danger:true})))return;
  try{await capi.clear(CHAT.id);CHATSHEET=null;CHAT=null;paintLayer();loadInbox()}catch(e){toast(e.message)}
}
async function blockOther(){
  const o=chatOther();if(!o)return;
  if(!(await uiConfirm("Block @"+o.username+"?","They can't message you or see your posts. They won't be told.",{okLabel:"Block",danger:true})))return;
  try{await api.block(o.username);toast("Blocked @"+o.username);CHATSHEET=null;CHAT=null;paintLayer();loadInbox()}catch(e){toast(e.message)}
}
