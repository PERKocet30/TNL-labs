/* ── THE BAG, RECENTLY VIEWED, PRICE DROPS, SELLER TOOLS · 2026-09-30 ──
   The bag lives on this phone (like any shop before you sign in) and is
   checked against the Market when you open it. Checkout is per seller:
   one payment, shipping combined (server-07-cart.js). */
let MKTBAG=null, MKTRECENT=null, SHOPSTATS=null;
const bagKey=()=>"tnl-bag:"+(myName()||"guest");
function bagList(){try{const a=JSON.parse(localStorage.getItem(bagKey())||"[]");return Array.isArray(a)?a:[]}catch(e){return []}}
function bagPut(a){try{localStorage.setItem(bagKey(),JSON.stringify(a.slice(0,40)))}catch(e){}paintBagCount()}
function bagAdd(l,v){
  const a=bagList(),vid=v?v.id:"";
  if(a.some(x=>x.id===l.id&&(x.v||"")===vid))return toast("Already in your bag");
  bagPut([{id:l.id,v:vid,at:Date.now()},...a]);toast("Added to bag");
}
const bagDrop=keys=>bagPut(bagList().filter(x=>!keys.includes(x.id+":"+(x.v||""))));
function paintBagCount(){const n=bagList().length;document.querySelectorAll("[data-bagn]").forEach(e=>{e.textContent=n||"";e.hidden=!n})}
function bagBtnHTML(){const n=bagList().length;
  return `<button class="shop-bag" data-mv="bag" aria-label="Bag">${UI_IC.navMarket}<span data-bagn${n?"":" hidden"}>${n||""}</span></button>`}

function bagHTML(){
  const items=bagList();
  const head=`<div class="dnav"><button class="backb2" data-mv="browse">${DI.back} Market</button></div>
    <div class="page-head"><div class="mono dim">BAG</div><h2 class="page-h">Your bag</h2></div>`;
  if(!items.length)return `<div class="scroll">${head}<div class="empty">Your bag is empty.<br><br>Tap the bag on anything in the Market.</div></div>`;
  if(!MKTBAG)return `<div class="scroll">${head}${skel()}</div>`;
  const byId=new Map(MKTBAG.map(l=>[l.id,l])),groups=new Map();
  for(const it of items){const l=byId.get(it.id);if(!l)continue;
    const vs=l.variants||[],v=vs.find(x=>x.id===it.v)||null;
    const why=l.status!=="active"?"Sold":vs.length&&!v?"Pick a size":v&&v.qty<1?"Sold out in "+[v.size,v.colour].filter(Boolean).join(" / "):"";
    const k=l.seller.username;if(!groups.has(k))groups.set(k,{seller:l.seller,rows:[]});
    groups.get(k).rows.push({it,l,v,why})}
  return `<div class="scroll">${head}<div class="bag">${[...groups.values()].map(g=>{
    const ok=g.rows.filter(r=>!r.why),sub=ok.reduce((n,r)=>n+r.l.price,0),ship=ok.length?Math.max(...ok.map(r=>r.l.shipping||0)):0;
    return `<section class="bag-g">
      <div class="bag-s" data-u="${esc(g.seller.username)}">${avHTML(g.seller,"sm")}<b>${esc(g.seller.displayName)}</b><span class="dim">@${esc(g.seller.username)}</span></div>
      ${g.rows.map(r=>`<div class="bag-r${r.why?" out":""}">
        <button class="bag-img" data-mopen="${r.l.id}"><img src="${esc(r.l.images[0]||"")}" alt="" loading="lazy"></button>
        <div class="bag-m"><div class="bag-t">${esc(r.l.title)}</div>
          ${r.v?`<div class="dim">${esc([r.v.size,r.v.colour].filter(Boolean).join(" / "))}</div>`:""}
          ${r.why?`<div class="bag-why">${esc(r.why)}</div>`:""}
          <div class="bag-p">${money(r.l.price)}</div></div>
        <button class="bag-x" data-bagrm="${r.l.id}:${esc(r.it.v||"")}" aria-label="Remove">×</button></div>`).join("")}
      <div class="bag-sum"><div><span>Items</span><b>${money(sub)}</b></div>
        <div><span>Shipping${ok.length>1?" (combined)":""}</span><b>${ship?money(ship):"Free"}</b></div>
        <div class="bag-tot"><span>Total</span><b>${money(sub+ship)}</b></div></div>
      <button class="btn green bag-co" data-bagco="${esc(g.seller.username)}"${ok.length?"":" disabled"}>Check out ${ok.length} item${ok.length==1?"":"s"}</button>
    </section>`}).join("")}</div></div>`}

async function bagLoad(){
  MKTBAG=null;render();
  try{MKTBAG=(await req("/api/cart/check",{method:"POST",body:{ids:bagList().map(x=>x.id)}})).listings}catch(e){MKTBAG=[]}
  render();
}
async function bagCheckout(seller,btn){
  if(guest())return needAccount("Join to check out — you'll need an account to track the order.");
  const byId=new Map((MKTBAG||[]).map(l=>[l.id,l]));
  const rows=bagList().filter(x=>{const l=byId.get(x.id);if(!l||l.seller.username!==seller||l.status!=="active")return false;
    const vs=l.variants||[],v=vs.find(y=>y.id===x.v);return vs.length?!!(v&&v.qty>0):true});
  if(!rows.length)return;
  btn.disabled=true;btn.textContent="Opening checkout…";
  try{
    const d=await req("/api/cart/checkout",{method:"POST",body:{items:rows.map(x=>({listingId:x.id,variant:x.v||undefined}))}});
    const keys=rows.map(x=>x.id+":"+(x.v||""));
    if(d.checkoutUrl){try{sessionStorage.setItem("tnl-bag-paying",JSON.stringify(keys))}catch(e){}location.href=d.checkoutUrl;return}
    bagDrop(keys);
    await uiAlert("Reserved — no payment taken","Card payments aren't switched on yet. Message the seller to settle up directly.");
    MKTVIEW="orders";ORDTAB="buying";ORDERS=await api.orders();render();
  }catch(e){btn.disabled=false;btn.textContent="Check out";toast(e.message);bagLoad()}
}
/* Back from a paid checkout: those items leave the bag. */
function bagPaid(){try{const k=JSON.parse(sessionStorage.getItem("tnl-bag-paying")||"[]");if(k.length)bagDrop(k);sessionStorage.removeItem("tnl-bag-paying")}catch(e){}}

/* ── recently viewed, under the Market's grid (above it, arriving late, it pushed the grid down) ── */
function recentHTML(){
  if(!MKTRECENT||!MKTRECENT.length)return "";
  return `<div class="mrec"><div class="mono dim mrec-h">RECENTLY VIEWED</div><div class="simrow">${MKTRECENT.map(x=>`<button class="simcard" data-mopen="${x.id}">
    <img src="${esc(x.images[0]||"")}" alt="" loading="lazy"><div class="simt">${esc(x.title)}</div><div class="simp">${money(x.price)}</div></button>`).join("")}</div></div>`}
const priceHTML=l=>l.wasPrice?`<s class="mwas">${money(l.wasPrice)}</s>`:"";

/* ── seller: listing drafts, duplicate, the shop at a glance ── */
const sdKey=()=>"tnl-selldraft:"+(myName()||"");
function sdSave(){if(MKTEDIT||MKTVIEW!=="sell"||!SELLFORM)return;
  try{localStorage.setItem(sdKey(),JSON.stringify({f:SELLFORM,imgs:SELLIMGS,kind:SELLKIND,at:Date.now()}))}catch(e){}}
function sdRestore(){try{const d=JSON.parse(localStorage.getItem(sdKey())||"null");
  if(!d||!d.f||(!d.f.title&&!(d.imgs||[]).length))return false;
  SELLFORM=d.f;SELLIMGS=d.imgs||[];SELLKIND=d.kind||"physical";SELLFORM._restored=true;return true}catch(e){return false}}
function sdClear(){try{localStorage.removeItem(sdKey())}catch(e){}}
function shopStatsHTML(){
  const s=SHOPSTATS,tile=(n,l)=>`<div class="sst"><b>${n}</b><span>${l}</span></div>`;
  return `<div class="sstats" id="shopstats">${s?tile(s.toShip,"to ship")+tile(money(s.month),"last 30 days")+tile(money(s.net),"you've made")
    +tile(s.active,"live")+tile(s.views,"views")+tile(s.saves,"saves")
    :Array.from({length:6},()=>`<div class="sst sk-shim"><b>&nbsp;</b><span>&nbsp;</span></div>`).join("")}</div>`}
async function shopStatsLoad(){SHOPSTATS=null;try{SHOPSTATS=await req("/api/shop/stats")}catch(e){return}
  const el=$("#shopstats");if(el)el.outerHTML=shopStatsHTML()}

function wireBag(){
  paintBagCount();
  if(MKTVIEW==="sell")sdSave();   // photos land after the last keystroke
  document.querySelectorAll("[data-bagrm]").forEach(b=>b.onclick=()=>{bagDrop([b.dataset.bagrm]);render()});
  document.querySelectorAll("[data-bagco]").forEach(b=>b.onclick=()=>bagCheckout(b.dataset.bagco,b));
  document.querySelectorAll("[data-bagadd]").forEach(b=>b.onclick=()=>{
    const l=MKTONE;if(!l||String(l.id)!==b.dataset.bagadd)return;
    const st=lvState(l);
    if(st.need){toast("Pick a "+st.need+" first");const p=$("#lvpick");if(p)p.scrollIntoView({block:"center",behavior:mvReduced()?"auto":"smooth"});return}
    bagAdd(l,st.match)});
  document.querySelectorAll("[data-mdup]").forEach(b=>b.onclick=()=>{
    const l=MKTONE;if(!l)return;
    MKTEDIT=null;SELLKIND=l.kind==="loop"?"loop":"physical";SELLIMGS=[...(l.images||[])];SELLAUDIO=l.audioUrl||null;
    SELLFORM={title:l.title,description:l.description||"",price:((l.price||0)/100).toFixed(2),shipping:l.shipping?(l.shipping/100).toFixed(2):"",
      quantity:1,category:l.category,condition:l.condition,brand:l.brand||"",size:l.size||"",colour:l.colour||"",shipsFrom:l.shipsFrom||"",
      acceptsOffers:l.acceptsOffers!==false,bpm:l.bpm||"",musicalKey:l.musicalKey||"",stems:!!l.stems,
      hasVariants:!!(l.variants||[]).length,variants:(l.variants||[]).map(v=>({size:v.size,colour:v.colour,qty:v.qty}))};
    MKTVIEW="sell";render();toast("Copied — change what's different")});
  const sx=$("#sdraftx");if(sx)sx.onclick=()=>{sdClear();SELLFORM={category:"Tops",condition:"Good",acceptsOffers:true};SELLIMGS=[];render()};
}
