/* ================================================================
   AN OPENED POST LEADS ON · v1.0 — 2026-11-15
   The fix list's number 3: "Every piece leads on — swipe to the next piece,
   'More from @artist', the lab tag opens the lab. Opened posts and pictures
   were backed out of almost every time." Under an opened post:
     · its lab (// Visual), one tap into the lab
     · More from @artist — their other work, three across; a tap opens it here
     · Next piece — the one after it in the list it came from (the Showroom,
       a profile, a feed); a sideways swipe on the post goes next / back
   Nothing here decides an order: the next piece is simply the next one on the
   screen it was opened from (the Showroom's order is rank.js's).
================================================================ */

const PO_CHEV=`<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="square" aria-hidden="true"><path d="M9 5l7 7-7 7"/></svg>`;
/* The list the opened post came from, and where it sits in it. */
function poList(p){
  const id=String(p.id);
  const lists=[PROFILE&&PROFILE.posts,TAB==="showroom"||!PROFILE?SRPOSTS:null,POSTS,SRPOSTS];
  for(const l of lists){if(!l||!l.length)continue;const i=l.findIndex(x=>String(x.id)===id);if(i>=0)return {l,i}}
  return null;
}
const poHasPic=p=>!!(pxImgs(p)[0]||p.videoUrl);
/* the next (or previous) piece with something to look at */
function poStep(p,dir){
  const w=poList(p);if(!w)return null;
  for(let i=w.i+dir;i>=0&&i<w.l.length;i+=dir){const q=w.l[i];if(q&&!q.pending&&!q.failed)return q}
  return null;
}
/* their other work: the profile on screen if it's theirs, else asked once and kept */
function poMore(p){
  const u=p.author.username,mine=x=>String(x.id)!==String(p.id)&&poHasPic(x);
  if(PROFILE&&PROFILE.user&&PROFILE.user.username===u)return (PROFILE.posts||[]).filter(mine).slice(0,6);
  const c=POMORE[u];
  if(c===undefined){POMORE[u]=null;api.profile(u).then(d=>{POMORE[u]=(d.posts||[]);if(POSTOPEN&&POSTOPEN.author&&POSTOPEN.author.username===u)poPaint()}).catch(()=>{POMORE[u]=[]})}
  return c?c.filter(mine).slice(0,6):c;
}
const poThumb=q=>{const im=pxImgs(q)[0];return im?im.thumb||im.url:q.thumbUrl||q.cover||""};
function poNextHTML(p){
  if(!p||p.pending||p.failed)return "";
  const lab=p.channel&&p.channel!=="profile"?labOfCh(p.channel):null;
  const more=poMore(p),nx=poStep(p,1);
  return `<div class="po-next" id="ponext">
    ${lab?`<button class="po-lab" data-polab="${esc(lab.id)}"><i class="lg">//</i> ${esc(lab.name)}<span class="dim">See the lab</span></button>`:""}
    ${more===null?`<div class="po-moreh"><b>More from @${esc(p.author.username)}</b></div><div class="po-more">${[0,1,2].map(()=>`<i class="sk-img po-mt"></i>`).join("")}</div>`
      :more&&more.length?`<div class="po-moreh"><b>More from @${esc(p.author.username)}</b><button class="po-see" data-u="${esc(p.author.username)}">See profile</button></div>
      <div class="po-more">${more.map(q=>`<button class="po-mt" data-popen="${q.id}" aria-label="Open @${esc(p.author.username)}'s post">${poThumb(q)?`<img src="${esc(poThumb(q))}" alt="" loading="lazy" decoding="async">`:""}</button>`).join("")}</div>`:""}
    ${nx?`<button class="po-nx" data-popen="${nx.id}">${poThumb(nx)?`<img src="${esc(poThumb(nx))}" alt="">`:""}<span><b>Next piece</b><span class="dim">@${esc(nx.author.username)}</span></span>${PO_CHEV}</button>`:""}
  </div>`;
}
/* repaint just this part (their work landing), never the whole screen under a reader */
function poPaint(){const el=document.getElementById("ponext");if(!el||!POSTOPEN)return;const p=postById(POSTOPEN.id)||POSTOPEN;el.outerHTML=poNextHTML(p);poWire()}
function poGo(q){if(!q)return;openPost(q);const b=document.querySelector("#poov .po-body");if(b)b.scrollTop=0}
function poWire(){
  const ov=document.getElementById("poov");if(!ov)return;
  ov.querySelectorAll("[data-popen]").forEach(b=>b.onclick=()=>{const id=b.dataset.popen;
    const q=postById(id)||(POMORE[(POSTOPEN&&POSTOPEN.author||{}).username]||[]).find(x=>String(x.id)===String(id));poGo(q)});
  ov.querySelectorAll("[data-polab]").forEach(b=>b.onclick=()=>{POSTOPEN=null;OPENCOMMENTS=null;PROFILE=null;openLab(b.dataset.polab)});
  /* a sideways swipe on the post: next / back. Not on a carousel or a video (those swipe and scrub themselves). */
  const body=ov.querySelector(".po-body");if(!body||body.dataset.swipe)return;body.dataset.swipe="1";
  let s=null;
  body.addEventListener("touchstart",e=>{const t=e.touches[0];s=e.touches.length===1&&!e.target.closest(".caro,.vwrap,video,input,textarea")?{x:t.clientX,y:t.clientY,at:Date.now()}:null},{passive:true});
  body.addEventListener("touchend",e=>{if(!s||!POSTOPEN)return;const t=e.changedTouches[0],dx=t.clientX-s.x,dy=t.clientY-s.y;
    const ok=Math.abs(dx)>70&&Math.abs(dx)>2*Math.abs(dy)&&Date.now()-s.at<600;s=null;if(!ok)return;
    const p=postById(POSTOPEN.id)||POSTOPEN,q=poStep(p,dx<0?1:-1);if(q)poGo(q)},{passive:true});
}
