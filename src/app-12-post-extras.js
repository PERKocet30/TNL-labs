/* ── POST EXTRAS on the card · 2026-09-30 ── people tagged ("with …"), the
   video's chosen cover, comments switched off. */
function pxWithHTML(p){
  const t=p.tags||[];if(!t.length)return "";
  const who=u=>`<b class="px-u" data-u="${esc(u)}">@${esc(u)}</b>`;
  return `<div class="px-with">with ${t.length<=2?t.map(who).join(" and "):who(t[0])+` and <b class="px-u" data-pxtags="${p.id}">${t.length-1} others</b>`}</div>`;
}
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
   (filled, like Instagram), the trim (wireVideos loops inside it) and the
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
document.addEventListener("click",e=>{
  const b=e.target.closest("[data-pxtags]");if(!b)return;
  e.stopPropagation();const p=findAnyPost(+b.dataset.pxtags);if(!p)return;
  openPicker({title:"Tagged",items:p.tags.map(u=>({label:"@"+u,username:u})),onPick:it=>openProfile(it.username)});
},true);
