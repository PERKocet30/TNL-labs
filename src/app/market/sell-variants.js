/* ── SIZE & STOCK in the listing form · v2.0 — 2026-10-18 ─────────────
   v2.0 ("match Shopify standards, simplified and streamlined"): options,
   the Shopify way. One item: its size, colour and quantity. More than one:
   tap the sizes (XS–XXL, or add your own), add the colours, and every
   combination gets a row with its own stock — no typing "Black" on every
   row. New combinations start at 1; a combination left at 0 that was
   never sold is dropped on save (a sold-out one stays, crossed out).
   Also here, so the big parts stay small: the compare-at ("was") price,
   the category and condition pickers, and the take-home sum.
   v2.1 (same day): the size buttons come from the category (shoe sizes for
   footwear, waists for bottoms, print sizes for prints — app/market/sell-specs);
   art says "finish" where clothes say "colour".
   v1 (2026-09-30): a free-typed row per size/colour. */
const PV_SIZES=["XS","S","M","L","XL","XXL"];
const pvX=`<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="square" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg>`;
const pvKey=(s,c)=>(s||"").trim().toUpperCase()+"|"+(c||"").trim().toLowerCase();
const pvRank=(s,set)=>{const k=(set||PV_SIZES).findIndex(x=>x.toUpperCase()===(s||"").toUpperCase());return k<0?50:k};

/* The options → one row per combination, keeping stock (and ids) already set. */
function pvSync(f){
  const vs=f.variants||[];
  if(!f.optSizes)f.optSizes=[...new Set(vs.map(v=>(v.size||"").trim()).filter(Boolean))];
  if(!f.optColours)f.optColours=[...new Set(vs.map(v=>(v.colour||"").trim()).filter(Boolean))];
  const set=sellSizes(f);f.optSizes.sort((a,b)=>pvRank(a,set)-pvRank(b,set));
  const old=new Map(vs.map(v=>[pvKey(v.size,v.colour),v]));
  const S=f.optSizes.length?f.optSizes:[""], C=f.optColours.length?f.optColours:[""], out=[];
  if(f.optSizes.length||f.optColours.length)for(const s of S)for(const c of C){
    const o=old.get(pvKey(s,c));out.push({id:o?o.id:"",size:s,colour:c,qty:o?Math.max(0,Number(o.qty)||0):1})}
  f.variants=out;
}
const pvTotal=vs=>{const n=vs.reduce((a,v)=>a+(Number(v.qty)||0),0);return vs.length?(n?`${n} in stock across ${vs.length} option${vs.length==1?"":"s"}`:"Add stock to at least one"):"Pick a size or add a colour"};
/* What goes to the server: drop never-sold combinations left at 0. */
const pvOut=vs=>(vs||[]).filter(v=>(v.size||v.colour)&&(v.qty>0||v.id));

function pvHTML(f){
  const on=!!f.hasVariants;
  const step=(attr,val,lbl)=>`<div class="pf-step"><button type="button" ${attr}="-1" aria-label="Fewer">−</button>
    <input type="number" inputmode="numeric" min="0" max="500" step="1" ${lbl} value="${val}">
    <button type="button" ${attr}="1" aria-label="More">+</button></div>`;
  const one=sellOne(f), SZ=sellSizes(f), art=sellDept(f)==="Art", noSz=!SZ.length;
  const colW=art?"finish":"colour", colL=art?"Finish":"Colour";
  const head=`<section class="pf-card"><div class="pf-sec">${one?"Size":"Size &amp; stock"}</div>
    ${one?"":`<label class="pf-row"><span>More than one ${noSz?"option":"size"} or ${colW}</span><input type="checkbox" class="pf-sw" id="s-hasvar" ${on?"checked":""}></label>`}`;
  if(one&&noSz&&art)return "";   // an original painting: its dimensions are in Details
  if(one)return `${head}
    <div class="${noSz||art?"":"pf-2"}">
      ${noSz?"":`<div><label class="pf-lb" for="s-size">Size</label><input class="pf-in" id="s-size" value="${esc(f.size||"")}" maxlength="20" placeholder="${esc(SZ.slice(1,4).join(", ")||"One size")}"></div>`}
      ${art?"":`<div><label class="pf-lb" for="s-colour">${colL}</label><input class="pf-in" id="s-colour" value="${esc(f.colour||"")}" maxlength="30" placeholder="Black"></div>`}
    </div>
    <div class="pf-hint">${f.sellType==="custom"?"One of one — it comes off the Market once it sells.":"One piece — it comes off the Market once it sells."}</div>
  </section>`;
  if(!on)return `${head}
    <div class="pf-2">
      <div><label class="pf-lb" for="s-size">Size</label><input class="pf-in" id="s-size" value="${esc(f.size||"")}" maxlength="20" placeholder="M, 32, 10"></div>
      <div><label class="pf-lb" for="s-colour">Colour</label><input class="pf-in" id="s-colour" value="${esc(f.colour||"")}" maxlength="30" placeholder="Black"></div>
    </div>
    <div class="pf-row pv-qrow"><span>Quantity</span>${step("data-qty",f.quantity||1,'id="s-qty" aria-label="Quantity"').replace('min="0"','min="1"')}</div>
  </section>`;
  pvSync(f);
  const sizes=[...SZ,...f.optSizes.filter(s=>!SZ.some(x=>x.toUpperCase()===s.toUpperCase()))];
  const have=new Set(f.optSizes.map(s=>s.toUpperCase()));
  const add=(id,ph,max)=>`<div class="pv-add"><input class="pf-in" id="${id}" maxlength="${max}" placeholder="${ph}" enterkeyhint="done"><button type="button" class="pv-addb" data-pvadd="${id}">Add</button></div>`;
  return `${head}
    <div class="pf-lb">Sizes${noSz?" (optional)":""}</div>
    <div class="pv-chips">${sizes.map(s=>`<button type="button" class="chip${have.has(s.toUpperCase())?" on":""}" data-pvsize="${esc(s)}">${esc(s)}</button>`).join("")}</div>
    ${add("pv-newsize",noSz?"Small, Large, 14 in…":"Add a size of your own",20)}
    <div class="pf-lb">${art?"Finishes":"Colours"}</div>
    ${f.optColours.length?`<div class="pv-chips">${f.optColours.map((c,i)=>`<span class="chip on pv-col">${esc(c)}<button type="button" data-pvcx="${i}" aria-label="Remove ${esc(c)}">${pvX}</button></span>`).join("")}</div>`:""}
    ${add("pv-newcol",f.optColours.length?`Add another ${colW}`:art?"Optional — Unframed, Black frame":"Optional — Black, Washed blue",30)}
    ${f.variants.length?`<div class="pf-lb">Stock</div><div class="pv-rows" id="pvrows">${f.variants.map((v,i)=>`<div class="pv-row" data-pvi="${i}">
      <span class="pv-name">${esc([v.size,v.colour].filter(Boolean).join(" · "))}</span>
      ${step("data-pvqty",Number(v.qty)||0,`data-pvf="qty" aria-label="In stock: ${esc([v.size,v.colour].filter(Boolean).join(" "))}"`)}</div>`).join("")}</div>`:""}
    <div class="pv-tot" id="pvtot">${pvTotal(f.variants)}</div>
  </section>`}

/* ── WHO'S SELLING · 2026-10-18 ──────────────────────────────────────
   "Different options for brands or vintage sellers… a brand can sell
   multiple new items with different variations, versus someone selling a
   custom piece." First question on a new listing; then a switch at the top.
     brand    new stock: sizes × colours on, condition New, offers off at first
     vintage  one pre-loved piece: its size, condition (not New) and maker
     custom   one of one: made by you, New, no stock to count (the server
              holds it at 1 — setSellType)
   The listing wears it: "Vintage", "1 of 1", or the brand's name. */
const SELLTYPES=[["brand","My brand","Brand","New pieces in sizes and colours, with stock"],
  ["vintage","Vintage / pre-loved","Vintage","One second-hand piece — its size, maker and condition"],
  ["custom","One of one","One of one","A custom piece you made. There's only one"]];
const sellOne=f=>f.sellType==="vintage"||f.sellType==="custom";
function sellTypeHTML(f){
  const cur=f.sellType||"";
  if(!cur&&!MKTEDIT)return `<section class="pf-card st-pick"><div class="pf-sec">What are you selling?</div>
    ${SELLTYPES.map(([k,t,,d])=>`<button type="button" class="st-opt" data-stype="${k}"><b>${t}</b><span>${d}</span></button>`).join("")}</section>`;
  return `<div class="st-seg" role="radiogroup" aria-label="What you're selling">${SELLTYPES.map(([k,,s])=>
    `<button type="button" role="radio" aria-checked="${cur===k}" class="${cur===k?"on":""}" data-stype="${k}">${s}</button>`).join("")}</div>`}
function sellTypeSet(t){stashSell();const f=SELLFORM=SELLFORM||{},first=!f.sellType;f.sellType=t;
  if(t==="brand"){f.condition="New";
    if(!f.hasVariants){const sz=(f.size||"").trim(),c=(f.colour||"").trim();f.hasVariants=true;
      f.optSizes=sz?[sz]:[];f.optColours=c?[c]:[];f.variants=sz||c?[{id:"",size:sz,colour:c,qty:Number(f.quantity)||1}]:[]}
    if(first)f.acceptsOffers=false;if(!f.brand&&ME)f.brand=ME.displayName||""}
  else{if(f.hasVariants){const v=(f.variants||[])[0]||{};f.size=v.size||f.size||"";f.colour=v.colour||f.colour||""}
    f.hasVariants=false;f.quantity=1;
    if(t==="custom"){f.condition="New";f.brand=""}else if(!f.condition||f.condition==="New")f.condition="Good";
    if(first)f.acceptsOffers=true}
  render()}
/* What a listing is, in a word — on its card and its page. */
const sellTypeTag=l=>l.sellType==="vintage"?"Vintage":l.sellType==="custom"?"1 of 1":"";

/* Read the form back into SELLFORM (called by stashSell). */
function pvStash(){
  if(!SELLFORM)return;
  const sw=$("#s-hasvar");if(sw)SELLFORM.hasVariants=sw.checked;
  document.querySelectorAll("#pvrows .pv-row").forEach(r=>{const v=(SELLFORM.variants||[])[+r.dataset.pvi];
    if(v)v.qty=Math.max(0,Math.min(500,parseInt(r.querySelector('[data-pvf="qty"]').value,10)||0))});
  const cmp=$("#s-compare");if(cmp)SELLFORM.compareAt=cmp.value;
  specStash();
  const cat=$("#s-cat");if(cat)SELLFORM.category=cat.value;
  const cond=$("#s-cond");if(cond)SELLFORM.condition=cond.value;
}

/* Pricing: the "was" price, and what the seller actually keeps. */
function sellCompareHTML(f){
  return `<div><label class="pf-lb" for="s-compare">Compare-at price</label>
    <div class="pf-money"><span>$</span><input class="pf-in" id="s-compare" type="number" inputmode="decimal" min="0" step="0.01" value="${esc(f.compareAt??"")}" placeholder="Optional"></div></div>`}
function sellCompareHint(f){
  const c=Number(f.compareAt||0), p=Number(f.price||0);
  if(!c)return "";
  if(!(c>p))return `<div class="pf-hint pv-warn">The compare-at price has to be above the price to show as a sale.</div>`;
  return `<div class="pf-hint">Shows as <s>${money(Math.round(c*100))}</s> <b>${money(Math.round(p*100))}</b> — ${Math.round((1-p/c)*100)}% off</div>`}
/* Card fee: Stripe's standard US rate on what the buyer pays (item + postage).
   The TNL fee is on the item only. "About", because some cards cost more. */
function sellKeepCents(f,fee){
  const p=Math.round(Number(f.price||0)*100), s=Math.round(Number(f.shipping||0)*100);
  if(!(p>=100))return null;
  return Math.max(0,Math.round(p*(1-fee/100)+s-((p+s)*0.029+30)));
}

function pvRefreshEarn(){const e=$("#s-earn");if(e){e.innerHTML=sellEarnHTML();const rl=$("#rateladder");
  if(rl)rl.onclick=()=>{stashSell();CLIMB=true;CLIMBOPENRUNG=levelFor(ME.rep).id;render()}}
  const h=$("#s-cmphint");if(h)h.innerHTML=sellCompareHint(SELLFORM||{})}

function wireSellVariants(){
  wireSellSpecs();   // app/market/sell-specs
  document.querySelectorAll("[data-stype]").forEach(b=>b.onclick=()=>sellTypeSet(b.dataset.stype));
  ["#s-ship","#s-compare","#s-price"].forEach(id=>{const i=$(id);if(i)i.addEventListener("input",()=>{stashSell();pvRefreshEarn()})});
  const fs=$("#s-freeship");if(fs)fs.addEventListener("change",()=>{stashSell();pvRefreshEarn()});
  const sw=$("#s-hasvar");if(!sw)return;
  sw.onchange=()=>{stashSell();SELLFORM.hasVariants=sw.checked;
    if(sw.checked&&!(SELLFORM.variants||[]).length){   // start from the single item's size and colour
      const sz=(SELLFORM.size||"").trim(), c=(SELLFORM.colour||"").trim();
      SELLFORM.optSizes=sz?[sz]:[];SELLFORM.optColours=c?[c]:[];
      SELLFORM.variants=sz||c?[{id:"",size:sz,colour:c,qty:Number(SELLFORM.quantity)||1}]:[];
    }
    render()};
  const again=()=>{pvSync(SELLFORM);render()};
  document.querySelectorAll("[data-pvsize]").forEach(b=>b.onclick=()=>{stashSell();const s=b.dataset.pvsize,o=SELLFORM.optSizes||[];
    const i=o.findIndex(x=>x.toUpperCase()===s.toUpperCase());if(i>=0)o.splice(i,1);else o.push(s);SELLFORM.optSizes=o;again()});
  document.querySelectorAll("[data-pvcx]").forEach(b=>b.onclick=()=>{stashSell();SELLFORM.optColours.splice(+b.dataset.pvcx,1);again()});
  const addOne=(id)=>{const i=$("#"+id);if(!i)return;const v=i.value.trim();if(!v)return i.focus();stashSell();
    const list=id==="pv-newsize"?(SELLFORM.optSizes=SELLFORM.optSizes||[]):(SELLFORM.optColours=SELLFORM.optColours||[]);
    if(list.some(x=>x.toLowerCase()===v.toLowerCase()))return toast(v+" is already there");
    list.push(v);again();const n=$("#"+id);if(n)n.focus()};
  document.querySelectorAll("[data-pvadd]").forEach(b=>b.onclick=()=>addOne(b.dataset.pvadd));
  ["pv-newsize","pv-newcol"].forEach(id=>{const i=$("#"+id);if(i)i.onkeydown=e=>{if(e.key==="Enter"){e.preventDefault();addOne(id)}}});
  document.querySelectorAll("[data-pvqty]").forEach(b=>b.onclick=()=>{const i=b.parentNode.querySelector("input");
    i.value=Math.min(500,Math.max(0,(parseInt(i.value,10)||0)+(+b.dataset.pvqty)));stashSell();
    const t=$("#pvtot");if(t)t.textContent=pvTotal(SELLFORM.variants||[])});
  document.querySelectorAll("#pvrows input").forEach(i=>i.addEventListener("input",()=>{stashSell();
    const t=$("#pvtot");if(t)t.textContent=pvTotal(SELLFORM.variants||[])}));
}
