/* ── POST CREATOR · THE INSTAGRAM-LEVEL PARTS · v1.0 — 2026-10-21 ─────────────
   "Make the post composer be to Instagram level standards." What the
   composer in app-18-composer.js hands to this part:
   · Tag people ON the picture: tap Tag people, tap the photo where they
     are, pick them — a pin with their name sits there (tap it to take it
     off). Pins travel with the post (extras.pins) and show on the card
     when someone taps the person icon.
   · Advanced settings, in one sheet: turn off commenting, hide the like
     count, alt text (read out to people who can't see the picture).
   · Also share to your Story: the Story sheet opens by itself the moment
     the post is up.
   · Preview: the post as the Showroom will show it, before you post.
   · A caption counter near the limit.
   Everything is drawn from the composer's own state (c); nothing new on the
   server beyond three fields in posts.extras. */
const PC_CAP_MAX=2200;

/* the pins over the current slide, drawn into the composer's media block */
function pcPinsHTML(c,i){
  const pins=(c.tags||[]).filter(u=>u.x!=null&&(u.i||0)===i);
  return `${c.tagMode?`<div class="pc-taghint">Tap the photo where they are</div>`:""}<div class="pc-pinbox">${pins.map(u=>`<button class="pc-pin" style="left:${(u.x*100).toFixed(1)}%;top:${(u.y*100).toFixed(1)}%" data-pcpin="${esc(u.username)}" aria-label="Remove ${esc(u.username)}">${esc(u.displayName||u.username)}<i>${PC_X}</i></button>`).join("")}</div>`;
}
/* the picture is drawn letterboxed (object-fit: contain): the box the pins live
   in is the drawn picture, not the slide — so a pin lands on the same spot on
   the card later */
function pcDrawn(img){
  const r=img.getBoundingClientRect(),nw=img.naturalWidth||1,nh=img.naturalHeight||1,s=Math.min(r.width/nw,r.height/nh),w=nw*s,h=nh*s;
  return {x:(r.width-w)/2,y:(r.height-h)/2,w,h,r};
}
function pcPinBoxes(){
  document.querySelectorAll("#pctrack .pc-slide").forEach(sl=>{const img=sl.querySelector("img"),box=sl.querySelector(".pc-pinbox");if(!img||!box)return;
    const place=()=>{const d=pcDrawn(img),sr=sl.getBoundingClientRect();box.style.cssText=`left:${d.r.left-sr.left+d.x}px;top:${d.r.top-sr.top+d.y}px;width:${d.w}px;height:${d.h}px`};
    if(img.complete&&img.naturalWidth)place();else img.onload=place});
}
/* Tag people: with pictures, place them; without, the plain list */
function pcTagStart(c){
  if((c.tags||[]).length>=20)return toast("Up to 20 people");
  if(c.imgs.length&&!(c.imgs[c.idx||0]||{}).gif){c.tagMode=!c.tagMode;render();return}
  pcTagPick(c,null);
}
function pcTagPick(c,at){
  const toTag=ppl=>ppl.filter(u=>u.username!==myName()&&!(c.tags||[]).find(x=>x.username===u.username))
    .map(u=>({label:u.displayName,sub:"@"+u.username+(u.role?" · "+u.role:""),avatar:u.avatarUrl,u}));
  openPicker({title:"Tag people",search:"Search people",loading:true,note:"They'll be told they're in it.",
    onSearch:async q=>toTag((await api.mentionable(q)).people||[]),
    onPick:it=>{if(PCOMPOSE===c&&it.u){(c.tags=c.tags||[]).push(at?{...it.u,x:at.x,y:at.y,i:c.idx||0}:it.u);c.tagMode=false;render()}}});
  api.mentionable("").then(d=>{if(PICKER){PICKER.items=toTag(d.people||[]);PICKER.loading=false;render()}}).catch(()=>{});
}
function pcTagWire(c){
  const tr=$("#pctrack");
  pcPinBoxes();
  if(tr&&c.tagMode)tr.onclick=e=>{
    const slide=e.target.closest(".pc-slide");if(!slide||e.target.closest(".pc-pin"))return;
    const img=slide.querySelector("img");if(!img)return;const d=pcDrawn(img);
    const x=(e.clientX-d.r.left-d.x)/d.w,y=(e.clientY-d.r.top-d.y)/d.h;
    if(x<0||x>1||y<0||y>1)return;   // tapped the letterbox, not the picture
    pcTagPick(c,{x:Math.round(x*1000)/1000,y:Math.round(y*1000)/1000});
  };
  document.querySelectorAll("[data-pcpin]").forEach(b=>b.onclick=e=>{e.stopPropagation();c.tags=(c.tags||[]).filter(u=>u.username!==b.dataset.pcpin);render()});
  const th=document.querySelector(".pc-taghint");if(th)th.onclick=()=>{c.tagMode=false;render()};
}
/* the rows the composer shows for this part */
function pcIgRowsHTML(c){
  const adv=[c.commentsOff?"Comments off":"",c.hideLikes?"Likes hidden":"",c.alt?"Alt text":""].filter(Boolean).join(" · ");
  return `<button class="pc-opt" id="pcprev"><span class="pc-ic">${PC_EYE}</span><span class="pc-l">Preview</span><span class="pc-v">As it'll look</span>${PC_CHEV}</button>
    <label class="pc-opt pc-sw-row"><span class="pc-ic">${IG_SEND}</span><span class="pc-l">Also share to your Story<span class="dim">Instagram opens right after it's posted</span></span>
      <input type="checkbox" class="pf-sw" id="pcstory" ${c.storyAfter?"checked":""}></label>
    <button class="pc-opt" id="pcadv"><span class="pc-ic">${PC_GEAR}</span><span class="pc-l">Advanced settings</span><span class="pc-v">${adv}</span>${PC_CHEV}</button>`;
}
const PC_EYE=`<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="square" stroke-linejoin="miter" aria-hidden="true"><path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/></svg>`;
const PC_GEAR=`<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="square" stroke-linejoin="miter" aria-hidden="true"><circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3M4.9 4.9l2.1 2.1M17 17l2.1 2.1M4.9 19.1L7 17M17 7l2.1-2.1"/></svg>`;
function pcCapCountHTML(c){const n=(c.body||"").length;return n>PC_CAP_MAX-300?`<div class="pc-capn ${n>PC_CAP_MAX?"over":""}" id="pccapn">${n.toLocaleString()}/${PC_CAP_MAX.toLocaleString()}</div>`:""}

/* Advanced settings: one sheet */
function pcAdvOpen(c){PCADV=c;pcIgPaint()}
/* these sheets live on their own layer, like the Story sheet: nothing behind them repaints */
function pcIgPaint(){
  let l=document.getElementById("pcigl");
  if(!l){l=document.createElement("div");l.id="pcigl";document.body.appendChild(l)}
  l.innerHTML=pcAdvHTML()+pcPreviewHTML();
  pcAdvWire();pcPreviewWire();
}
let PCADV=null;
function pcAdvHTML(){
  const c=PCADV;if(!c)return "";
  return `<div class="sheet" id="pcadvbg"><div class="sheetc" style="max-width:440px">
    ${sheetHead("Advanced settings","pcadvx")}
    <label class="pc-opt pc-sw-row"><span class="pc-ic">${IG_COMMENT}</span><span class="pc-l">Turn off commenting<span class="dim">You can turn it back on from the post</span></span>
      <input type="checkbox" class="pf-sw" id="pccoff" ${c.commentsOff?"checked":""}></label>
    <label class="pc-opt pc-sw-row"><span class="pc-ic">${IG_HEART}</span><span class="pc-l">Hide like count<span class="dim">Only you see the number</span></span>
      <input type="checkbox" class="pf-sw" id="pchide" ${c.hideLikes?"checked":""}></label>
    <div class="pc-alt"><label for="pcalt"><b>Alt text</b><span class="dim">Describe the picture for people who can't see it. ${(c.alt||"").length}/200</span></label>
      <textarea class="pc-ta pc-ta-alt" id="pcalt" rows="3" maxlength="200" placeholder="A hand-painted jacket on a white wall…">${esc(c.alt||"")}</textarea></div>
    <button class="btn wide" id="pcadvdone">Done</button>
  </div></div>`;
}
function pcAdvWire(){
  const c=PCADV;if(!c)return;
  const x=()=>{PCADV=null;pcIgPaint();render()};
  const bg=$("#pcadvbg");if(bg)bg.onclick=e=>{if(e.target===bg)x()};
  const cl=$("#pcadvx");if(cl)cl.onclick=x;const dn=$("#pcadvdone");if(dn)dn.onclick=x;
  const co=$("#pccoff");if(co)co.onchange=()=>{c.commentsOff=co.checked};
  const hi=$("#pchide");if(hi)hi.onchange=()=>{c.hideLikes=hi.checked};
  const al=$("#pcalt");if(al)al.oninput=()=>{c.alt=al.value.slice(0,200);const s=al.previousElementSibling&&al.previousElementSibling.querySelector(".dim");if(s)s.textContent=s.textContent.replace(/\d+\/200/,c.alt.length+"/200")};
}
/* Preview: the post as the Showroom will show it */
let PCPREV=null;
function pcPreviewOpen(c){
  const now=Date.now(),imgs=c.imgs.map(im=>({url:im.url||im.thumb,thumb:im.thumb||im.url,w:im.w||800,h:im.h||1000}));
  PCPREV={id:-1,author:{...ME,level:levelFor(ME.rep).id},body:c.body||"",createdAt:now,images:imgs.length>1?imgs:null,imageUrl:imgs[0]?imgs[0].url:null,thumbUrl:imgs[0]?imgs[0].thumb:null,
    mediaW:imgs[0]?imgs[0].w:null,mediaH:imgs[0]?imgs[0].h:null,videoUrl:c.vid?c.vid.url:null,videoPlayUrl:c.vid?c.vid.url:null,audioTrack:c.track||null,
    isWork:true,likeCount:0,commentCount:0,likedByMe:false,collaborators:[],tags:(c.tags||[]).map(u=>u.username),location:c.location||"",products:[],channel:c.ch?c.ch.id:"profile",hideLikes:!!c.hideLikes};
  pcIgPaint();
}
function pcPreviewHTML(){
  if(!PCPREV)return "";let card="";
  try{card=srCardHTML(PCPREV,0)}catch(e){card=`<div class="empty">Couldn't draw the preview.</div>`}
  return `<div class="sheet" id="pcprevbg"><div class="sheetc pc-prevc">${sheetHead("Preview","pcprevx","How it'll look in the Showroom and on your profile")}<div class="pc-prev">${card}</div></div></div>`;
}
function pcPreviewWire(){
  const x=()=>{PCPREV=null;pcIgPaint()};
  const bg=$("#pcprevbg");if(bg){bg.onclick=e=>{if(e.target===bg)x()};bg.querySelectorAll(".pc-prev a,.pc-prev button").forEach(el=>{el.onclick=e=>{e.preventDefault();e.stopPropagation()}})}
  const cl=$("#pcprevx");if(cl)cl.onclick=x;
}
/* wired from wirePCompose */
function pcIgWire(c){
  pcTagWire(c);
  const pv=$("#pcprev");if(pv)pv.onclick=()=>pcPreviewOpen(c);
  const st=$("#pcstory");if(st)st.onchange=()=>{c.storyAfter=st.checked};
  const ad=$("#pcadv");if(ad)ad.onclick=()=>pcAdvOpen(c);
  const ta=$("#pcbody");if(ta)ta.addEventListener("input",()=>{const n=$("#pccapn");const h=pcCapCountHTML(c);if(n){if(h)n.outerHTML=h;else n.remove()}else if(h)ta.parentElement.insertAdjacentHTML("afterend",h)});
}
/* what the post carries, beyond the composer's own fields */
const pcIgExtras=c=>({pins:(c.tags||[]).filter(u=>u.x!=null).map(u=>({username:u.username,x:u.x,y:u.y,i:u.i||0})),alt:c.alt||"",hideLikes:!!c.hideLikes});
/* the moment it's up: the Story sheet, if asked */
function pcAfterPosted(c,pid){if(c.storyAfter&&pid)igStoryOpen(`/p/${pid}/story.jpg`,location.origin+"/p/"+pid,c.vid||c.track?`/p/${pid}/story.mp4`:null,c.vid?"clip":c.track?"song":"")}
