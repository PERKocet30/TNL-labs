/* ── POST EXTRAS on the card · 2026-09-30 ── people tagged ("with …"), the
   video's chosen cover, comments switched off. */
function pxWithHTML(p){
  const t=p.tags||[];if(!t.length)return "";
  const who=u=>`<b class="px-u" data-u="${esc(u)}">@${esc(u)}</b>`;
  return `<div class="px-with">with ${t.length<=2?t.map(who).join(" and "):who(t[0])+` and <b class="px-u" data-pxtags="${p.id}">${t.length-1} others</b>`}</div>`;
}
/* A video shows its cover until it plays — never a black box. */
const pxPoster=p=>p.videoUrl&&p.thumbUrl&&p.thumbUrl!==p.imageUrl?` poster="${esc(p.thumbUrl)}"`:"";
/* Comments switched on/off: show or hide the button in place. */
function pxPaintActs(id){
  const p=findAnyPost(id);if(!p)return;
  document.querySelectorAll(`.igact[data-comments="${id}"]`).forEach(b=>b.hidden=!!p.commentsOff);
}
/* "and 3 others" lists everyone tagged. */
document.addEventListener("click",e=>{
  const b=e.target.closest("[data-pxtags]");if(!b)return;
  e.stopPropagation();const p=findAnyPost(+b.dataset.pxtags);if(!p)return;
  openPicker({title:"Tagged",items:p.tags.map(u=>({label:"@"+u,username:u})),onPick:it=>openProfile(it.username)});
},true);
