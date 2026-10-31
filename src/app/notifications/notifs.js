/* v2026-10-20: the head comes from the screen kit */
/* ── NOTIFICATIONS v2.1 · 2026-10-12 (back from a post lands here again) ─────────────────────────────────────
   Sections — New, Today, This
   week, This month, Earlier. A row is the person's picture, one line
   ("**name** liked your post. 3h") and, on the right, the post or the
   item it's about — or Follow back for a new follower. Likes on one post
   are one row: "A, B and 3 others liked your post." Tap the row and you
   land on the thing itself: the post (with its comments), the listing,
   the chat, your orders; tap the name or picture for their profile.
   Server: /api/notifications sends thumb, listingId, actor.youFollow. */
const NF_SAY={like:"liked your post.",comment:"commented:",reply:"replied:",mention:"mentioned you:",tag:"tagged you in a post.",
  follow:"started following you.",collab_invite:"wants to collab on your post.",collab_accept:"accepted your collab.",
  feature:"featured your work.",dm:"sent you a message."};
/* Shop rows with no listing to open land on your orders, on the right side. */
const NF_ORDERS={sale:"selling",order_complete:"selling",review:"selling",download:"selling",shipped:"buying",offer_accepted:"buying",offer_declined:"buying"};
function nfText(n){
  const s=NF_SAY[n.kind];
  if(n.kind==="comment"||n.kind==="reply"||n.kind==="mention")return s+(n.body?` ${esc(n.body)}`:"");
  if(s)return s;
  const b=String(n.body||"").trim();
  return esc(b?b.replace(/[^.!?]$/,"$&."):n.kind.replace(/_/g," ")+".");
}
function nfAgo(t){const s=Math.max(0,(Date.now()-t)/1000);
  return s<60?"now":s<3600?Math.floor(s/60)+"m":s<86400?Math.floor(s/3600)+"h":s<604800?Math.floor(s/86400)+"d":Math.floor(s/604800)+"w"}
function nfSection(n){
  if(!n.read)return "New";
  const d=new Date(n.createdAt),now=new Date(),day=86400000;
  if(d.toDateString()===now.toDateString())return "Today";
  const age=now-d;return age<7*day?"This week":age<30*day?"This month":"Earlier";
}
/* Rows: likes on the same post, in the same section, become one. */
function nfRows(list){
  const out=[],byPost=new Map();
  for(const n of list){
    const sec=nfSection(n),key=n.kind==="like"&&n.postId?sec+":"+n.postId:null;
    const g=key&&byPost.get(key);
    if(g){if(n.actor&&!g.people.some(p=>p.username===n.actor.username))g.people.push(n.actor);g.unread=g.unread||!n.read;continue}
    const row={n,sec,people:n.actor?[n.actor]:[],unread:!n.read};
    if(key)byPost.set(key,row);out.push(row);
  }
  return out;
}
function nfRowHTML(r,i){
  const n=r.n,P=r.people,a=P[0];
  const who=!a?`<b>${n.kind==="event"?"// Event":"LABS"}</b>`
    :P.length===1?`<b data-u="${esc(a.username)}">${esc(a.displayName)}</b>`
    :`<b data-u="${esc(a.username)}">${esc(a.displayName)}</b>${P.length===2?" and ":", "}<b data-u="${esc(P[1].username)}">${esc(P[1].displayName)}</b>${P.length>2?` and ${P.length-2} other${P.length>3?"s":""}`:""}`;
  const pic=P.length>1?`<span class="nf-av two">${avHTML(P[1],"")}${avHTML(a,"")}</span>`
    :`<span class="nf-av"${a?` data-u="${esc(a.username)}"`:""}>${a?avHTML(a,""):`<img class="av nf-sys" src="/icon-512.png?v=2" alt="">`}</span>`;
  const side=n.kind==="follow"&&a?(a.youFollow?`<button class="btn sm ghost nf-follow" disabled>Following</button>`:`<button class="btn sm nf-follow" data-nffollow="${esc(a.username)}">Follow back</button>`)
    :n.thumb?`<img class="nf-th" src="${esc(n.thumb)}" alt="" loading="lazy">`:"";
  return `<div class="nf-row${r.unread?" unread":""}" role="button" tabindex="0" data-nf="${i}"${n.kind==="event"&&!n.postId?` data-nev="1"`:""}>
    ${pic}<div class="nf-t">${who} ${nfText(n)} <span class="nf-ago">${nfAgo(n.createdAt)}</span></div>${side}</div>`;
}
function notifPanelHTML(){
  NFROWS=NOTIFS?nfRows(NOTIFS):[];
  let last="";
  return `<div class="sheet" id="npbg"><div class="sheetc nf">
    ${screenHead({back:{id:"npx",label:"Close"},title:"Notifications"})}
    ${!NOTIFS?`${skel()}`:!NOTIFS.length?`<div class="empty">Nothing yet.<br>Post work and it starts here.</div>`
      :NFROWS.map((r,i)=>{const h=r.sec!==last?`<div class="nf-sec">${r.sec}</div>`:"";last=r.sec;return h+nfRowHTML(r,i)}).join("")}
  </div></div>`;
}
/* Where a tap lands. */
async function nfOpen(n){
  NOTIFOPEN=false;
  if(n.kind==="event"&&!n.postId)return render();   // the [data-nev] listener opens the event
  if(n.kind==="dm"&&n.actor){render();return openDM(n.actor.username)}
  if(n.postId)return openPostById(n.postId);   // one paint: back from the post lands on these notifications again
  if(n.listingId)return pxOpenListing(n.listingId);
  if(NF_ORDERS[n.kind]||n.kind==="offer"){
    PROFILE=null;POSTOPEN=null;TAB="market";MKTVIEW="orders";ORDTAB=NF_ORDERS[n.kind]||"selling";render();
    try{ORDERS=await api.orders();render()}catch(e){}return;
  }
  if(n.actor)return openProfile(n.actor.username);
  render();
}
function wireNotifs(){
  const box=$("#npbg");if(!box)return;
  box.querySelectorAll("[data-nf]").forEach(el=>el.onclick=e=>{
    if(e.target.closest("[data-u],[data-nffollow]"))return;
    const r=NFROWS[+el.dataset.nf];if(r)nfOpen(r.n)});
  box.querySelectorAll("[data-nffollow]").forEach(b=>b.onclick=async e=>{
    e.stopPropagation();const u=b.dataset.nffollow;b.disabled=true;
    try{const d=await api.follow(u);
      for(const n of NOTIFS||[])if(n.actor&&n.actor.username===u)n.actor.youFollow=!!d.following;
      b.textContent=d.following?"Following":"Follow back";b.classList.toggle("ghost",!!d.following);b.disabled=!!d.following}
    catch(err){b.disabled=false;toast(err.message)}});
}
