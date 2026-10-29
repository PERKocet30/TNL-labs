/* EDIT INFO v1.0 — 2026-10-29. "Editing a post should bring up the post composer like Instagram."
   ⋯ → Edit opens the post maker on the post — the same page, headed "Edit info" with Done. Like
   Instagram, the pictures or video stay as posted (you see them, swipe them and tag people on them,
   but can't add, remove or reorder); the caption, the lab, the song and which part, people tagged,
   products, place and Advanced settings can all change, and new collaborators can be invited.
   Done saves it in place: PATCH /api/posts/:id with full: true (editPostFull, server-02-post-extras). */
function pceLab(ch){if(!ch||ch==="profile")return null;const l=LABS.find(x=>x.channels.some(k=>k.id===ch));return l?{id:ch,label:l.name,lab:l.name}:null}
function pceOpen(p){
  if(PCOMPOSE||!p)return;
  const imgs=(p.images&&p.images.length?p.images:p.imageUrl?[{url:p.imageUrl,thumb:p.thumbUrl||p.imageUrl,w:p.mediaW,h:p.mediaH}]:[]).map(i=>({...i,thumb:i.thumb||i.url}));
  const pins=new Map((p.pins||[]).map(q=>[q.username,q]));
  const c=PCOMPOSE={edit:p.id,body:p.body||"",imgs,vid:p.videoUrl?{url:p.videoPlayUrl||p.videoUrl}:null,cover:p.videoUrl?p.thumbUrl:null,busy:false,
    ch:pceLab(p.channel),track:p.audioTrack||null,musStart:p.audioStart||0,
    tags:(p.tags||[]).map(u=>{const q=pins.get(u);return q?{username:u,x:q.x,y:q.y,i:q.i||0}:{username:u}}),
    products:(p.products||[]).filter(l=>!l.sold).map(l=>({id:l.id,title:l.title,price:l.price,images:[l.image||""]})),
    location:p.location||"",alt:p.alt||"",hideLikes:!!p.hideLikes,commentsOff:!!p.commentsOff,collabs:[],idx:0};
  c.orig=pceSnap(c);
  pushView("compose");render();
}
const pceSnap=c=>JSON.stringify([c.body,c.ch&&c.ch.id,c.track&&c.track.id,c.musStart,(c.tags||[]).map(u=>[u.username,u.x,u.y,u.i]),
  (c.products||[]).map(l=>l.id),c.location,c.alt,!!c.hideLikes,!!c.commentsOff,(c.collabs||[]).length]);
/* the work as posted */
function pceMediaHTML(c){
  if(c.vid)return `<div class="pc-stage"><video id="pcvid" src="${esc(c.vid.url)}#t=0.1"${c.cover?` poster="${esc(c.cover)}"`:""} playsinline muted controls></video></div>`;
  if(!c.imgs.length)return "";
  return `<div class="pc-stage"><div class="pc-track ${c.tagMode?"tagging":""}" id="pctrack">${c.imgs.map((im,i)=>`<div class="pc-slide"><img src="${esc(im.url||im.thumb)}" alt="">${pcPinsHTML(c,i)}</div>`).join("")}</div>
    ${c.imgs.length>1?`<span class="pc-count" id="pccount">${c.idx+1}/${c.imgs.length}</span>`:""}</div>`;
}
async function pceSave(c){
  if(c.busy)return;
  if(!(c.body||"").trim()&&!c.imgs.length&&!c.vid){toast("Write something");return}
  c.busy=true;render();
  try{
    const d=await req("/api/posts/"+c.edit,{method:"PATCH",body:{full:true,body:(c.body||"").trim(),channel:c.ch?c.ch.id:"profile",
      audioTrackId:c.track?c.track.id:null,audioStart:c.track?(c.musStart||0):0,tags:(c.tags||[]).map(u=>u.username),location:c.location||"",
      commentsOff:!!c.commentsOff,products:(c.products||[]).map(l=>l.id),...pcIgExtras(c)}});
    for(const u of c.collabs||[]){try{await api.invite(c.edit,u.username)}catch(e){}}
    if(d&&d.post)for(const x of likeCopies(c.edit))Object.assign(x,d.post);
    c.dead=true;pedClose();PCOMPOSE=null;render();toast("Saved");
  }catch(e){c.busy=false;render();toast(e.message)}
}
/* Cancel / back: nothing changed closes; changes ask first */
async function pceLeave(c){
  if(c.busy)return false;
  if(pceSnap(c)!==c.orig&&!await uiConfirm("Discard your changes?","",{okLabel:"Discard",cancelLabel:"Keep editing",danger:true}))return false;
  if(PCOMPOSE!==c)return false;
  c.dead=true;pedClose();PCOMPOSE=null;return true;
}
