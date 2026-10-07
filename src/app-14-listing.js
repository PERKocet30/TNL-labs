/* ── LISTING PAGE · v2 · 2026-09-30 ────────────────────────────────────
   Depop / Shopify grade. The photos full width (swipe, dots, tap to zoom,
   pinch in the viewer), title and price, size and colour picked like a
   shop (sold-out ones crossed through), the seller, and a Buy bar pinned
   to the bottom so the price and the button are always in reach. */
let LPICK={id:0,size:"",colour:""}, LGIDX={};

/* The buyer's pick against the listing's variants. match is the variant
   they've chosen (or null); need says what's still missing. */
function lvState(l){
  if(LPICK.id!==l.id)LPICK={id:l.id,size:"",colour:""};
  const vs=l.variants||[];
  const sizes=[...new Set(vs.map(v=>v.size).filter(Boolean))], colours=[...new Set(vs.map(v=>v.colour).filter(Boolean))];
  if(sizes.length===1)LPICK.size=sizes[0];
  if(colours.length===1)LPICK.colour=colours[0];
  const fits=(v,s,c)=>(!sizes.length||v.size===s)&&(!colours.length||v.colour===c);
  const match=vs.length?vs.find(v=>fits(v,LPICK.size,LPICK.colour))||null:null;
  const need=!vs.length?"":sizes.length&&!LPICK.size?"size":colours.length&&!LPICK.colour?"colour":!match?"size":"";
  const open=(key,val)=>vs.some(v=>v[key]===val&&v.qty>0&&(key==="size"?(!LPICK.colour||!colours.length||v.colour===LPICK.colour):(!LPICK.size||!sizes.length||v.size===LPICK.size)));
  return {vs,sizes,colours,match,need,open};
}

function lvPickHTML(l){
  const st=lvState(l);if(!st.vs.length)return "";
  const row=(label,key,list,cur)=>list.length?`<div class="lv-h">${label}${cur?` <b>${esc(cur)}</b>`:""}</div>
    <div class="lv-row">${list.map(x=>{const ok=st.open(key,x);
      return `<button type="button" class="lv-o${cur===x?" on":""}${ok?"":" out"}" data-lv${key==="size"?"s":"c"}="${esc(x)}"${ok?"":` aria-disabled="true"`}>${esc(x)}</button>`}).join("")}</div>`:"";
  const m=st.match;
  return `<div class="lv" id="lvpick">
    ${row("Size","size",st.sizes,LPICK.size)}${row("Colour","colour",st.colours,LPICK.colour)}
    ${m?`<div class="lv-left">${m.qty<1?"Sold out in this one":m.qty<=3?`Only ${m.qty} left`:`${m.qty} in stock`}</div>`:""}
  </div>`}

function lgHTML(l){
  const imgs=l.images||[], i=Math.min(LGIDX[l.id]||0,Math.max(0,imgs.length-1));
  if(!imgs.length)return "";
  return `<div class="lg">
    <div class="lg-track" id="lgtrack">${imgs.map((src,k)=>`<div class="lg-s"><img src="${esc(src)}" data-zoom="${esc(src)}" alt="${esc(l.title)} ${k+1}"${k?` loading="lazy"`:""}></div>`).join("")}</div>
    ${imgs.length>1?`<span class="lg-n" id="lgn">${i+1}/${imgs.length}</span>
      <div class="lg-dots" id="lgdots">${imgs.map((_,k)=>`<i${k===i?` class="on"`:""}></i>`).join("")}</div>`:""}
  </div>`}

function lbarHTML(l,mine){
  const st=lvState(l);
  const price=`<div class="lbar-p"><b>${money(l.price)}</b><span>${l.shipping?"+ "+money(l.shipping)+" shipping":"Free shipping"}</span></div>`;
  if(mine)return `<div class="lbar">${price}
    <button class="btn ghost" data-msold="${l.id}">${l.status==="sold"?"Relist":"Mark sold"}</button>
    <button class="btn" data-medit="${l.id}">Edit</button></div>`;
  if(l.status!=="active")return `<div class="lbar">${price}<button class="btn lbar-buy" disabled>Sold</button></div>`;
  const out=st.match&&st.match.qty<1;
  return `<div class="lbar">${price}
    ${l.acceptsOffers?`<button class="btn ghost" data-offer="${l.id}">Offer</button>`:""}
    <button class="btn ghost lbar-bag" data-bagadd="${l.id}" aria-label="Add to bag"${out?" disabled":""}>${UI_IC.navMarket}</button>
    <button class="btn green lbar-buy" data-buy="${l.id}"${out?" disabled":""}>${out?"Sold out":st.need?"Pick "+st.need:"Buy now"}</button></div>`}

function detailHTML(){
  if(!MKTONE)return `<div class="scroll">${skel()}</div>`;
  if(MKTONE.kind==="loop")return loopDetailHTML(MKTONE);   // a loop isn't a jacket
  const l=MKTONE, mine=l.seller.username===myName(), hasV=(l.variants||[]).length;
  const acc=MKTOFFERS.find(o=>o.status==="accepted"), pend=MKTOFFERS.find(o=>o.status==="pending");
  return `<div class="scroll lpage" id="mktscroll">
    <div class="dnav"><button class="backb2" data-mv="browse">${DI.back} Market</button>
      <button class="backb2" data-mshare="${l.id}">Share</button></div>
    ${lgHTML(l)}
    <div class="dbody">
      <div class="dtop">
        <div style="min-width:0"><h2 class="dtitle">${esc(l.title)}</h2>
        <div class="dprice">${money(l.price)}${priceHTML(l)}<span class="mono dim">${l.shipping?` + ${money(l.shipping)} shipping`:" · free shipping"}${!hasV&&l.quantity>1&&l.quantity<=10?` · ${l.quantity} left`:""}</span></div></div>
        <button class="mlike big ${l.likedByMe?"on":""}" data-mlike="${l.id}" aria-label="${l.likedByMe?"Saved":"Save"}">${MK_HEART(l.likedByMe)}<span>${l.likeCount||""}</span></button>
      </div>
      ${l.status==="sold"?`<div class="soldbar">SOLD</div>`:""}
      ${lvPickHTML(l)}
      <div class="dchips">${[l.condition,!hasV&&l.size,l.brand,l.category,!hasV&&l.colour,l.shipsFrom&&("Ships from "+l.shipsFrom)].filter(Boolean).map(v=>`<span class="dchip">${esc(v)}</span>`).join("")}</div>
      ${l.description?`<p class="ddesc">${esc(l.description)}</p>`:""}
      <div class="dseller" data-u="${esc(l.seller.username)}">
        ${avHTML(l.seller,"sm")}
        <div style="flex:1;min-width:0">
          <div style="font-weight:900;font-size:13px">${esc(l.seller.displayName)}</div>
          <div class="mono dim">@${esc(l.seller.username)} · L${l.seller.level}</div>
          ${MKTSELLER?`<div class="trust mono">
            ${MKTSELLER.rating!==null?`<span class="star">${DI.star} ${MKTSELLER.rating.toFixed(1)}</span> <span class="dim">(${MKTSELLER.reviews})</span>`:`<span class="dim">No reviews yet</span>`}
            ${MKTSELLER.sold?` · ${MKTSELLER.sold} sold`:""}
            ${MKTSELLER.shipRate!==null&&MKTSELLER.sold>2?` · ${MKTSELLER.shipRate}% shipped`:""}
          </div>`:""}
        </div>
        ${mine?`<span class="mono dim">${l.views} views</span>`:`<button class="btn sm ghost" data-dmseller="${esc(l.seller.username)}">Message</button>`}
      </div>
      ${mine?"":`<div class="lpol mono dim">Sold by @${esc(l.seller.username)}${MKTMETA.paymentsEnabled?" · Checkout by Stripe":""} · <a href="/policies" target="_blank" rel="noopener">Shipping &amp; returns</a> · <a href="/terms" target="_blank" rel="noopener">Terms</a></div>`}
      ${mine?`
        <div class="lsec">Offers</div>
        ${MKTOFFERS.length?MKTOFFERS.map(o=>`<div class="orow">
          <div><b>${money(o.amount_cents)}</b> <span class="mono dim">from ${esc(o.display_name||o.username)}</span></div>
          <div class="obtns"><button class="btn sm green" data-oa="${o.id}:accept">Accept</button>
          <button class="btn sm ghost" data-oa="${o.id}:decline">Decline</button></div>
        </div>`).join(""):`<div class="mono dim">No offers yet.</div>`}
        <div class="lown"><button type="button" class="ldel" data-mdup="${l.id}">Duplicate</button><button type="button" class="ldel" data-mdel="${l.id}">Delete listing</button></div>`
      :l.status==="active"?`
        ${pend?`<div class="mono dim" style="margin-top:10px">YOUR OFFER: ${money(pend.amount_cents)} — pending</div>`:""}
        ${acc?`<div class="acceptbar">${DI.check} Your offer of ${money(acc.amount_cents)} was accepted — buy now to lock it in</div>`:""}
        ${!MKTMETA.paymentsEnabled?`<div class="mono dim" style="margin-top:12px;line-height:1.6">Card payments aren't switched on yet — buying reserves the item and connects you with the seller to settle up directly.</div>`:""}`:""}
      ${MKTSIMILAR.length?`<div class="simwrap">
        <div class="lsec">More like this</div>
        <div class="simrow">${MKTSIMILAR.map(x=>`<button class="simcard" data-mopen="${x.id}">
          <img src="${esc(x.images[0]||"")}" alt="" loading="lazy">
          <div class="simt">${esc(x.title)}</div>
          <div class="simp">${money(x.price)}</div>
        </button>`).join("")}</div>
      </div>`:""}
    </div>
    ${lbarHTML(l,mine)}
  </div>`}

/* Repaint just the picker and the bar — picking a size mustn't rebuild the
   photos or move the page. */
function paintListingPick(){
  const l=MKTONE;if(!l)return;
  const p=$("#lvpick"),b=document.querySelector(".lbar");
  if(p)p.outerHTML=lvPickHTML(l);
  if(b)b.outerHTML=lbarHTML(l,l.seller.username===myName());
  wireMarket();
}

function wireListing(){
  document.querySelectorAll("[data-lvs],[data-lvc]").forEach(b=>b.onclick=()=>{
    if(b.getAttribute("aria-disabled")&&!b.classList.contains("on"))return toast("Sold out");
    if(b.dataset.lvs!==undefined)LPICK.size=LPICK.size===b.dataset.lvs&&lvState(MKTONE).sizes.length>1?"":b.dataset.lvs;
    else LPICK.colour=LPICK.colour===b.dataset.lvc&&lvState(MKTONE).colours.length>1?"":b.dataset.lvc;
    paintListingPick()});
  const tr=$("#lgtrack");
  if(tr&&MKTONE){
    const id=MKTONE.id,n=tr.children.length;
    if(LGIDX[id])pcRaf(()=>{tr.scrollLeft=LGIDX[id]*tr.clientWidth});
    let raf=0;tr.onscroll=()=>{pcCaf(raf);raf=pcRaf(()=>{
      const i=Math.max(0,Math.min(n-1,Math.round(tr.scrollLeft/Math.max(1,tr.clientWidth))));if(i===(LGIDX[id]||0))return;LGIDX[id]=i;
      const c=$("#lgn");if(c)c.textContent=(i+1)+"/"+n;
      document.querySelectorAll("#lgdots i").forEach((d,k)=>d.classList.toggle("on",k===i))})};
  }
}

/* The photo viewer: pinch or double-tap to zoom, drag to look around,
   a tap (not zoomed) closes it. */
function wireLightbox(){
  const lb=$("#lb"),img=lb&&lb.querySelector("img");if(!lb||!img)return;
  let s=1,x=0,y=0,pts=new Map(),start=null,moved=false,lastTap=0;
  const apply=()=>{img.style.transform=s>1?`translate3d(${x}px,${y}px,0) scale(${s})`:""};
  const dist=()=>{const [a,b]=[...pts.values()];return Math.hypot(a.x-b.x,a.y-b.y)};
  lb.onpointerdown=e=>{pts.set(e.pointerId,{x:e.clientX,y:e.clientY});moved=false;
    start={s,x,y,d:pts.size===2?dist():0,px:e.clientX,py:e.clientY}};
  lb.onpointermove=e=>{if(!pts.has(e.pointerId))return;pts.set(e.pointerId,{x:e.clientX,y:e.clientY});
    if(pts.size===2&&start.d){s=Math.min(4,Math.max(1,start.s*dist()/start.d));if(s===1){x=0;y=0}moved=true;apply()}
    else if(pts.size===1&&s>1){x=start.x+e.clientX-start.px;y=start.y+e.clientY-start.py;moved=true;apply()}
    else if(Math.abs(e.clientX-start.px)+Math.abs(e.clientY-start.py)>8)moved=true};
  lb.onpointerup=lb.onpointercancel=e=>{pts.delete(e.pointerId);if(pts.size)start={s,x,y,d:0,px:[...pts.values()][0].x,py:[...pts.values()][0].y}};
  lb.onclick=e=>{
    if(moved)return;
    const now=Date.now();
    if(now-lastTap<300){lastTap=0;clearTimeout(lb._t);s=s>1?1:2.5;x=0;y=0;apply();return}
    lastTap=now;
    if(s>1)return;
    clearTimeout(lb._t);lb._t=setTimeout(()=>{if(s===1&&lastTap===now){LIGHTBOX=null;render()}},300)};
}
