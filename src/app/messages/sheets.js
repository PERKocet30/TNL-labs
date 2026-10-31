/* MESSAGES v2.0 — 2026-09-29. Sheets: new message / group, forward,
   add people, chat details, mute. */
async function openPeopleSheet(kind,extra={}){
  const exclude=kind==="add"&&CHAT&&CHAT.meta?CHAT.meta.people.map(p=>p.username):[];
  CHATSHEET={kind,q:"",picked:[],chats:[],results:null,exclude,...extra};
  paintLayer();
  if(kind==="fwd"&&!INBOX)loadInbox().then(()=>{if(CHATSHEET&&CHATSHEET.kind==="fwd")paintLayer()});
  searchPeople("");
}
let PSEQ=0;
async function searchPeople(q){
  const s=CHATSHEET,n=++PSEQ;
  try{const r=await api.mentionable(q);if(CHATSHEET!==s||n!==PSEQ)return;s.results=r.people;paintSheetKeep()}catch(e){}
}
function paintSheetKeep(){
  const q=$("#csq"),focus=q&&document.activeElement===q,pos=q?q.selectionStart:0;
  paintLayer();
  const q2=$("#csq");if(q2&&focus){q2.focus();try{q2.setSelectionRange(pos,pos)}catch(e){}}
}
function closeSheet(){if(CHATSHEET){CHATSHEET=null;paintLayer()}}

function wireChatSheet(){
  const L=chatLayer(),s=CHATSHEET,on=(id,fn)=>{const el=L.querySelector("#"+id);if(el)el.onclick=fn};
  const bg=L.querySelector("#csbg");if(bg)bg.onclick=e=>{if(e.target===bg)closeSheet()};
  on("csx",closeSheet);
  const q=L.querySelector("#csq");
  if(q){let t=null;q.oninput=()=>{s.q=q.value;clearTimeout(t);t=setTimeout(()=>searchPeople(s.q.trim()),180)}}
  const keep=(id,k)=>{const el=L.querySelector("#"+id);if(el)el.oninput=()=>{s[k]=el.value}};
  keep("cstitle","title");keep("csnote","note");
  L.querySelectorAll("[data-cxpick]").forEach(b=>b.onclick=()=>{
    const u=b.dataset.cxpick,p=(s.results||[]).find(x=>x.username===u);
    if(s.picked.some(x=>x.username===u))s.picked=s.picked.filter(x=>x.username!==u);
    else if(p){if(s.picked.length+s.chats.length>=(s.kind==="fwd"?10:31))return toast("That's the most at once");s.picked.push(p)}
    paintSheetKeep()});
  L.querySelectorAll("[data-cxunpick]").forEach(b=>b.onclick=()=>{s.picked=s.picked.filter(x=>x.username!==b.dataset.cxunpick);paintSheetKeep()});
  L.querySelectorAll("[data-cxchat]").forEach(b=>b.onclick=()=>{const id=+b.dataset.cxchat;
    s.chats=s.chats.includes(id)?s.chats.filter(x=>x!==id):[...s.chats,id];paintSheetKeep()});
  on("csgo",()=>sheetGo());
  // details
  on("csrenamego",async()=>{const v=$("#csrename").value.trim();
    try{await capi.rename(CHAT.id,v);closeSheet();loadChat(CHAT.id)}catch(e){toast(e.message)}});
  L.querySelectorAll("[data-csrm]").forEach(b=>b.onclick=async()=>{const u=b.dataset.csrm;
    if(!(await uiConfirm("Remove @"+u+"?","They'll leave the group and stop getting its messages.",{okLabel:"Remove",danger:true})))return;
    try{await capi.remove(CHAT.id,u);await loadChat(CHAT.id);CHATSHEET={kind:"info"};paintLayer()}catch(e){toast(e.message)}});
  L.querySelectorAll(".cs [data-cxprof]").forEach(el=>el.onclick=()=>goProfile(el.dataset.cxprof));
  on("csadd",()=>{CHATSHEET=null;paintLayer();openPeopleSheet("add")});
  on("csmute",()=>{CHATSHEET={kind:"mute",chat:"dm:"+CHAT.id,muted:CHAT.meta.muted};paintLayer()});
  on("csleave",async()=>{
    if(!(await uiConfirm("Leave group?","You'll stop getting its messages. Someone in it can add you back.",{okLabel:"Leave",danger:true})))return;
    try{await capi.remove(CHAT.id,myName());CHATSHEET=null;CHAT=null;paintLayer();loadInbox()}catch(e){toast(e.message)}});
  on("csblock",()=>blockOther());
  on("csclear",()=>clearChat(false));
  L.querySelectorAll("[data-csmute]").forEach(b=>b.onclick=async()=>{
    const h=+b.dataset.csmute,chat=s.chat;
    try{const r=await capi.mute(chat,h);
      if(chat.startsWith("lab:")){LABMUTED=new Set(r.muted.filter(x=>x.startsWith("lab:")));paintLabBell()}
      else if(CHAT&&CHAT.meta)CHAT.meta.muted=!!h;
      toast(h?"Muted":"Unmuted");closeSheet();refreshBadges();
    }catch(e){toast(e.message)}});
}

async function sheetGo(){
  const s=CHATSHEET,names=s.picked.map(p=>p.username);
  const btn=$("#csgo");if(btn)btn.disabled=true;
  try{
    if(s.kind==="new"){
      if(names.length===1){CHATSHEET=null;paintLayer();return openDM(names[0])}
      const r=await capi.group(names,(s.title||"").trim());
      CHATSHEET=null;paintLayer();openChat(r.chatId);loadInbox();
    }else if(s.kind==="add"){
      await capi.add(CHAT.id,names);closeSheet();loadChat(CHAT.id);
    }else if(s.kind==="fwd"){
      const r=await capi.forward({messageId:s.messageId,postId:s.postId,chatIds:s.chats,usernames:names,note:(s.note||"").trim()});
      toast("Sent to "+(r.sent===1?"1 chat":r.sent+" chats"));closeSheet();
    }
  }catch(e){toast(e.message);if(btn)btn.disabled=false}
}

/* The Send button on any post — the same sheet, sending a card. */
function sendPostSheet(postId){
  if(guest())return needAccount("Join to send work to people.");
  openPeopleSheet("fwd",{postId});
}
