/* ── POST EXTRAS on the card · v1.1 2026-10-21 (pins on the picture) · 2026-09-30 ── people tagged ("with …"), the
   video's chosen cover, comments switched off. */
/* Shoppable posts: the pieces in the work, under it — tap to buy. */
function pxShopHTML(p){
  const ps=p.products||[];if(!ps.length)return "";
  return `<div class="px-shop"><div class="px-shop-h">${UI_IC.navMarket}<span>Shop this post</span></div>
    <div class="px-shop-r">${ps.map(l=>`<button class="px-prod${l.sold?" sold":""}" data-pxshop="${l.id}">
      <img src="${esc(l.image)}" alt="" loading="lazy"><span class="px-pt">${esc(l.title)}</span><span class="px-pp">${l.sold?"Sold":money(l.price)}</span></button>`).join("")}</div></div>`;
}
/* A video shows its cover until it plays — never a black box. */
const pxPoster=p=>p.videoUrl&&p.thumbUrl&&p.thumbUrl!==p.imageUrl?` poster="${esc(p.thumbUrl)}"`:"";
/* A posted video as its author edited it (2026-10-08): the frame shape
   (filled), the trim (wireVideos loops inside it) and the
   original sound off — no sound button then. One template for every feed. */
const VRATIO={"1:1":"1/1","4:5":"4/5","9:16":"9/16","16:9":"16/9"};
function pxVideo(p,cls){
  const v=p.video||{},r=VRATIO[v.ratio],ar=r||(p.mediaW?p.mediaW+"/"+p.mediaH:"");
  return `<video class="${cls}${r?" vfill":""}" src="${esc(p.videoPlayUrl||p.videoUrl)}#t=${((v.start||0)/1000||.1).toFixed(2)}"${pxPoster(p)}${ar?` style="aspect-ratio:${ar}"`:""} muted loop playsinline preload="none" data-auto${v.start?` data-vs="${v.start}"`:""}${v.end?` data-ve="${v.end}"`:""}${v.muted?" data-vsilent":""}></video>
    ${v.muted?"":`<button class="vmute" data-vmute aria-label="Sound">${DI.soundOff}</button>`}`}
/* Comments switched on/off: show or hide the button in place. */
function pxPaintActs(id){
  const p=findAnyPost(id);if(!p)return;
  document.querySelectorAll(`.igact[data-comments="${id}"]`).forEach(b=>b.hidden=!!p.commentsOff);
}
/* A product on a post opens its listing — from any feed, however it was
   painted (the Showroom repaints cards without the Market's wiring). */
async function pxOpenListing(id){
  PROFILE=null;POSTOPEN=null;OPENCOMMENTS=null;TAB="market";MKTVIEW="detail";MKTONE=null;LPICK={id:0,size:"",colour:""};render();
  try{const d=await api.mktOne(id);MKTONE=d.listing;MKTOFFERS=d.offers||[];MKTSELLER=d.seller||null;MKTSIMILAR=d.similar||[];
    pushView("listing",d.listing.id);render()}catch(x){toast(x.message)}
}
document.addEventListener("click",e=>{const b=e.target.closest("[data-pxshop]");if(!b)return;e.stopPropagation();pxOpenListing(+b.dataset.pxshop)},true);
/* "and 3 others" lists everyone tagged. */
/* 2026-10-21: people tagged ON the picture (extras.pins) show where they are —
   the person icon toggles the pins; a pin opens the profile. A post with no
   pins keeps the list. Pins sit on the first picture (image 0) of the card. */
document.addEventListener("click",e=>{
  const b=e.target.closest("[data-pxtags]");if(!b)return;
  e.stopPropagation();const p=findAnyPost(+b.dataset.pxtags);if(!p)return;
  const pins=(p.pins||[]).filter(q=>!q.i),media=b.closest(".post-media");
  if(pins.length&&media){
    const had=media.querySelector(".px-pins");if(had){had.remove();return}
    const img=media.querySelector("img, video"),r=img?img.getBoundingClientRect():null,m=media.getBoundingClientRect();
    const box=r?`left:${r.left-m.left}px;top:${r.top-m.top}px;width:${r.width}px;height:${r.height}px`:"inset:0";
    media.insertAdjacentHTML("beforeend",`<div class="px-pins" style="${box}">${pins.map(q=>`<button class="px-pin" style="left:${(q.x*100).toFixed(1)}%;top:${(q.y*100).toFixed(1)}%" data-u="${esc(q.username)}">${esc(q.username)}</button>`).join("")}</div>`);
    media.querySelectorAll(".px-pin").forEach(pin=>pin.onclick=ev=>{ev.stopPropagation();openProfile(pin.dataset.u)});
    return;
  }
  openPicker({title:"Tagged",items:p.tags.map(u=>({label:"@"+u,username:u})),onPick:it=>openProfile(it.username)});
},true);
/* ── HOW A POST READS · 2026-10-12 ──────────────────────────────────────
   The header is who made it — "tnl.labs
   and xstart22" when it's a collab — and under the name the song, or the
   place. The caption moves under the buttons, after the name in bold; the
   time ("6 days ago") goes under that. People tagged are a person icon on
   the picture. */
function pxNames(p){
  const acc=(p.collaborators||[]).filter(c=>c.status==="accepted");
  const one=(u,n)=>`<b class="post-by" data-u="${esc(u)}">${esc(n)}</b>`;
  return one(p.author.username,p.author.displayName)+`<span class="lvl">L${p.author.level}</span>`
    +(!acc.length?"":" and "+(acc.length===1?one(acc[0].username,acc[0].display_name||acc[0].username)
      :`<b class="post-by" data-pxcollabs="${p.id}">${acc.length} others</b>`));
}
/* The line under the name: the song if there is one, else the place. */
const pxSub=p=>musChipHTML(p)||(p.location?`<div class="post-loc">${esc(p.location)}</div>`:"");
/* the like count, unless the maker hid it (they still see it) */
const pxLikeN=p=>(p.hideLikes&&p.author&&p.author.username!==myName())?"":(p.likeCount||"");
const PX_PERSON=`<svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor" aria-hidden="true"><circle cx="12" cy="8" r="4"/><path d="M4 21c0-4.4 3.6-7 8-7s8 2.6 8 7z"/></svg>`;
const pxTagBtn=p=>(p.tags&&p.tags.length)?`<button class="px-tagbtn" data-pxtags="${p.id}" aria-label="Tagged: ${esc(p.tags.map(u=>"@"+u).join(", "))}">${PX_PERSON}</button>`:"";
/* The time under a post: "Just now", "5 minutes ago", "6 days ago", "October 3". */
function igAgo(t){
  const s=Math.max(0,(Date.now()-t)/1000),n=(v,w)=>v+" "+w+(v===1?"":"s")+" ago";
  if(s<60)return "Just now";if(s<3600)return n(Math.floor(s/60),"minute");if(s<86400)return n(Math.floor(s/3600),"hour");
  if(s<604800)return n(Math.floor(s/86400),"day");
  const d=new Date(t);return d.toLocaleDateString([],{month:"long",day:"numeric",...(d.getFullYear()!==new Date().getFullYear()?{year:"numeric"}:{})});
}
/* "and 3 others" in the name line lists everyone the work is built with. */
document.addEventListener("click",e=>{
  const b=e.target.closest("[data-pxcollabs]");if(!b)return;
  e.stopPropagation();const p=findAnyPost(+b.dataset.pxcollabs);if(!p)return;
  openPicker({title:"Built with",items:p.collaborators.filter(c=>c.status==="accepted").map(c=>({label:c.display_name||c.username,sub:"@"+c.username,username:c.username})),onPick:it=>openProfile(it.username)});
},true);
