/* ── SELL WALKTHROUGH · v1.0 — 2026-11-03 ─────────────────────────────
   "Instead of one selling format for everyone, walk them through with
   questions tailored to what they're trying to sell, until they list."
   A new listing is a run of short screens, one question each, and the
   answers shape the questions that follow: what it is (the department,
   then its category) → who's selling it (worded for that department) →
   photos → words → size & stock (only if that kind of thing has any) →
   details (what that category asks for; skippable) → price & shipping →
   a review of the listing as it will look, and Publish.
   Editing a listing keeps the full form (app/market/detail-sell.js): it
   already exists, so every field at once is what's wanted. Sounds keep
   their own form too. The steps reuse the form's own field ids, so the
   form's wiring, stashSell() and the draft work unchanged; the step is
   kept on the form (_step) so a draft picks up where it left off. */
const SW_STEPS=[["what","What are you selling?"],["who","Who's selling it?"],["photos","Photos"],["words","Tell people about it"],
  ["stock","Size & stock"],["details","Details"],["price","Price & shipping"],["review","Ready to list"]];
/* who's selling, worded for the department (same three answers underneath: brand · vintage · custom) */
const SW_WHO={
  Art:[["custom","An original","One piece, made by you. There's only one"],["brand","Prints or an edition","Copies you can make more of — sizes and stock"],["vintage","Pre-owned art","A piece by someone else that you're passing on"]],
  Other:[["custom","Made by me, one of one","There's only one"],["brand","Made by me, I have several","Options and stock"],["vintage","Pre-owned","Something you're passing on — its condition matters"]],
};
const swDept=f=>f._dept||sellDept(f);
/* the steps this listing needs — an original painting has no size or stock to ask about */
function swSteps(f){
  const skipStock=sellOne(f)&&sellDept(f)==="Art"&&!sellSizes(f).length;
  return SW_STEPS.filter(([k])=>!(k==="stock"&&skipStock));
}
const swStep=f=>{const ks=swSteps(f).map(([k])=>k);return ks.includes(f._step)?f._step:ks[0]};
function swGo(step){stashSell();SELLFORM._step=step;sdSave();render();const s=$(".pf");if(s)s.scrollTop=0}
function swNext(){
  const f=SELLFORM,ks=swSteps(f).map(([k])=>k),i=ks.indexOf(swStep(f));
  stashSell();
  const at=ks[i];
  if(at==="photos"&&!SELLIMGS.length)return toast("Add at least one photo");
  if(at==="words"&&!(f.title||"").trim())return toast("Give it a title");
  if(at==="stock"&&f.hasVariants){if(!(f.variants||[]).length)return toast("Pick a size or add a colour");if(!pvOut(f.variants).some(v=>v.qty>0))return toast("Add stock to at least one size")}
  if(at==="price"&&!(Number(f.price)>=1))return toast("Price must be at least $1");
  if(i<ks.length-1)swGo(ks[i+1]);
}
function swBack(){const f=SELLFORM,ks=swSteps(f).map(([k])=>k),i=ks.indexOf(swStep(f));if(i>0)swGo(ks[i-1])}

function sellWalkHTML(f){
  const ks=swSteps(f),step=swStep(f),i=ks.findIndex(([k])=>k===step),last=i===ks.length-1;
  const title=ks[i][1];
  const head=`<header class="kform sw-head">${i?`<button class="kf-b" id="sw-back">${DI.back}<span>Back</span></button>`:`<button class="kf-b" data-mv="browse">Cancel</button>`}<b>New listing</b><span class="sw-n mono">${i+1} / ${ks.length}</span></header>
    <div class="sw-prog" aria-hidden="true"><i style="width:${Math.round(((i+1)/ks.length)*100)}%"></i></div>`;
  const body={what:swWhatHTML,who:swWhoHTML,photos:swPhotosHTML,words:swWordsHTML,stock:swStockHTML,details:swDetailsHTML,price:swPriceHTML,review:swReviewHTML}[step](f);
  const auto=step==="what"||step==="who";   // a tap answers these
  return `<div class="scroll pf sw">${head}${f._restored&&i===0?`<div class="sdraft">Picked up where you left off<button type="button" id="sdraftx">Start over</button></div>`:""}
    <div class="pf-body"><h1 class="sw-q">${esc(title)}</h1>${body}</div>
    ${auto?"":`<div class="pf-bar">${last?`<div class="pf-keep" id="s-earn">${sellEarnHTML()}</div><button class="gx-btn" id="s-post">Publish</button>`
      :`${step==="details"?`<button type="button" class="sw-skip" id="sw-skip">Skip for now</button>`:""}<button class="gx-btn" id="sw-next">Next</button>`}</div>`}
  </div>`;
}
/* 1 · what: the department, then its categories (one category → picked for you) */
function swWhatHTML(f){
  const t=TAX(),dept=swDept(f);
  const hint={Clothing:"Tops, bottoms, outerwear, sets",Footwear:"Sneakers, boots, anything you wear on your feet",Accessories:"Hats, bags, jewellery",Art:"Prints, originals, photography, objects",Other:"Something that isn't on this list"};
  const d=t.departments.find(x=>x.name===dept);
  return `<div class="sw-opts">${t.departments.map(x=>`<button type="button" class="st-opt sw-opt${dept===x.name?" on":""}" data-swdept="${esc(x.name)}"><b>${esc(x.name)}</b><span>${esc(hint[x.name]||"")}</span></button>`).join("")}</div>
    ${d&&d.categories.length>1?`<div class="pf-lb">Which kind?</div><div class="pf-chips sw-cats">${d.categories.map(c=>`<button type="button" class="chip${f.category===c?" on":""}" data-swcat="${esc(c)}">${esc(catLabel(c))}</button>`).join("")}</div>`:""}`;
}
/* 2 · who: brand · vintage · one of one, in the department's words */
function swWhoHTML(f){
  const list=SW_WHO[sellDept(f)]||SELLTYPES.map(([k,t,,d])=>[k,t,d]);
  return `<div class="sw-opts">${list.map(([k,t,d])=>`<button type="button" class="st-opt sw-opt${f.sellType===k?" on":""}" data-stype="${k}"><b>${esc(t)}</b><span>${esc(d)}</span></button>`).join("")}</div>`;
}
/* 3 · photos: the form's own picker, so its wiring (upload, cover, remove) is the same */
function swPhotosHTML(f){
  const X=`<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="square" stroke-linejoin="miter" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg>`;
  return `<p class="sw-p">${sellOne(f)?"Show the piece as it is — front, back, any flaws. The first photo is the cover.":"The first photo is the cover. Add the back, the details, and it on someone."}</p>
    <section class="pf-card"><div class="pf-media">
      ${SELLIMGS.map((im,i)=>`<div class="pf-img"><button type="button" class="pf-imgbtn" data-scover="${i}" aria-label="${i?"Make cover":"Cover photo"}"><img src="${esc(im)}" alt=""></button>
        ${i===0?`<span class="pf-cover">Cover</span>`:""}<button type="button" class="pf-imgx" data-simgx="${i}" aria-label="Remove photo">${X}</button></div>`).join("")}
      ${SELLUP?`<div class="pf-add busy"><span class="spin"></span></div>`:SELLIMGS.length<8?`<button type="button" class="pf-add" id="saddimg">${UI_IC.plus}<span>${SELLIMGS.length?"Add":"Add photos"}</span></button>`:""}
    </div><div class="pf-hint">${SELLIMGS.length}/8${SELLIMGS.length>1?" · Tap a photo to make it the cover":""}</div>
    <input type="file" id="sfile" accept="image/*" multiple hidden></section>`;
}
/* 4 · words: title and description, with a prompt for this kind of thing */
function swWordsHTML(f){
  const st=f.sellType||"",dept=sellDept(f);
  const ph=dept==="Art"?(st==="custom"?"What it is, how you made it, what it means":"Paper, size, how it's printed and signed")
    :st==="brand"?"Fit, fabric, care":st==="vintage"?"Measurements (pit to pit, length), era, any flaws":st==="custom"?"Materials, how you made it, how it fits":"Fit, measurements, any flaws";
  return `<section class="pf-card">
    <label class="pf-lb" for="s-title">Title</label><input class="pf-in" id="s-title" value="${esc(f.title||"")}" maxlength="120" placeholder="Short, clear title" autofocus>
    <label class="pf-lb" for="s-desc">Description</label><textarea class="pf-in pf-ta" id="s-desc" rows="5" maxlength="2000" placeholder="${esc(ph)}">${esc(f.description||"")}</textarea>
  </section>`;
}
/* 5 · stock: the form's Size & stock card (sizes × colours for a brand; one size for one piece) */
function swStockHTML(f){
  if(f.sellType==="brand"&&!f.hasVariants){f.hasVariants=true;f.optSizes=f.optSizes||[];f.optColours=f.optColours||[]}
  return `<p class="sw-p">${f.sellType==="brand"?"Tap every size you have, add colours if there are any, then set how many of each.":"Its size, so the right person finds it."}</p><div class="sw-stock">${pvHTML(f)}</div>`;
}
/* 6 · details: condition and maker where they mean something, then what this category asks for — all optional */
function swDetailsHTML(f){
  const st=f.sellType||"",conds=(MKTMETA.conditions||[]).filter(c=>st!=="vintage"||c!=="New");
  const pick=(id,list,cur)=>`<div class="pf-sel"><select class="pf-in" id="${id}">${list.map(c=>`<option${cur===c?" selected":""}>${esc(c)}</option>`).join("")}</select></div>`;
  return `<p class="sw-p">Buyers ask these anyway. Answer what you can.</p><section class="pf-card">
    <div class="pf-2">
      ${st==="brand"||st==="custom"?"":`<div><label class="pf-lb" for="s-cond">Condition</label>${pick("s-cond",conds,f.condition)}</div>`}
      ${st==="custom"?"":`<div><label class="pf-lb" for="s-brand">${st==="vintage"?"Brand / maker":"Brand"}</label><input class="pf-in" id="s-brand" value="${esc(f.brand||"")}" maxlength="60" placeholder="${st==="vintage"?"Levi's, unbranded…":st==="brand"?"Your label":"Optional"}"></div>`}
    </div>${specFieldsHTML(f)}</section>`;
}
/* 7 · price: the price, a "was" price, offers, shipping — and what you'll get, above Next */
function swPriceHTML(f){
  const noShip=!Number(f.shipping);
  return `<section class="pf-card">
    <div class="pf-2"><div><label class="pf-lb" for="s-price">Price</label><div class="pf-money"><span>$</span><input class="pf-in" id="s-price" type="number" inputmode="decimal" min="1" step="0.01" value="${f.price??""}" placeholder="0.00"></div></div>${sellCompareHTML(f)}</div>
    <div id="s-cmphint">${sellCompareHint(f)}</div>
    <label class="pf-row"><span>Accept offers</span><input type="checkbox" class="pf-sw" id="s-offers" ${f.acceptsOffers!==false?"checked":""}></label>
  </section>
  <section class="pf-card"><div class="pf-sec">Shipping</div>
    <label class="pf-row"><span>Free shipping</span><input type="checkbox" class="pf-sw" id="s-freeship" ${noShip?"checked":""}></label>
    <div id="s-shipwrap"${noShip?" hidden":""}><label class="pf-lb" for="s-ship">Shipping price</label>
      <div class="pf-money"><span>$</span><input class="pf-in" id="s-ship" type="number" inputmode="decimal" min="0" step="0.01" value="${noShip?"":f.shipping}" placeholder="0.00"></div></div>
  </section>`;
}
/* 8 · review: the listing as it will look, each line a way back to its step */
function swReviewHTML(f){
  const st=f.sellType||"",one=sellOne(f);
  const stock=one?[f.size,f.colour].filter(Boolean).join(" · ")||(st==="custom"?"One of one":"One piece")
    :f.hasVariants?pvTotal(pvOut(f.variants||[])):`${f.quantity||1} in stock`;
  const specs=Object.entries(f.specs||{}).map(([k,v])=>`${(TAX().specs[k]||{}).label||k}: ${v}`);
  const row=(step,k,v)=>`<button type="button" class="sw-row" data-swgo="${step}"><span>${esc(k)}</span><b>${esc(v||"—")}</b>${DI.chev||""}</button>`;
  const tag=st==="vintage"?"Vintage":st==="custom"?"1 of 1":st==="brand"?(f.brand||"Brand"):"";
  return `<div class="sw-card"><img src="${esc(SELLIMGS[0]||"")}" alt=""><div><div class="sw-title">${esc(f.title||"")}</div>
      <div class="sw-price">${Number(f.price)>=1?money(Math.round(Number(f.price)*100)):""}${tag?` <span class="sw-tag">${esc(tag)}</span>`:""}</div>
      <div class="dim sw-sub">${esc(catLabel(f.category||""))}${Number(f.shipping)?` · ${money(Math.round(Number(f.shipping)*100))} shipping`:" · Free shipping"}</div></div></div>
    <div class="sw-rows">
      ${row("photos","Photos",`${SELLIMGS.length} photo${SELLIMGS.length===1?"":"s"}`)}
      ${row("words","Description",(f.description||"").trim()?f.description.trim().slice(0,60)+(f.description.trim().length>60?"…":""):"None yet")}
      ${swSteps(f).some(([k])=>k==="stock")?row("stock",one?"Size":"Stock",stock):""}
      ${row("details","Details",[st==="vintage"&&f.condition?f.condition:"",st!=="custom"&&f.brand?f.brand:"",...specs].filter(Boolean).join(" · ")||"Nothing added")}
      ${row("price","Price",Number(f.price)>=1?money(Math.round(Number(f.price)*100))+(f.acceptsOffers!==false?" · offers on":""):"")}
    </div>
    ${ME&&ME.isAdmin?"":`<section class="pf-card"><label class="pf-row"><span>Show in the LABS Instagram shop<small class="pf-hint">So it can be tagged in Instagram posts.</small></span><input type="checkbox" class="pf-sw" id="s-ig" ${f.igShop?"checked":""}></label></section>`}`;
}

function wireSellWalk(){
  if(!$(".sw"))return;
  const b=$("#sw-back");if(b)b.onclick=swBack;
  const n=$("#sw-next");if(n)n.onclick=swNext;
  const sk=$("#sw-skip");if(sk)sk.onclick=()=>{stashSell();SELLFORM.specs={};swNext()};
  document.querySelectorAll("[data-swdept]").forEach(x=>x.onclick=()=>{stashSell();const f=SELLFORM,t=TAX(),d=t.departments.find(y=>y.name===x.dataset.swdept);
    f._dept=x.dataset.swdept;f.category=d&&d.categories.length===1?d.categories[0]:(d&&d.categories.includes(f.category)?f.category:undefined);
    if(f.category){if(f.hasVariants)pvSync(f);f._step="who"}render()});
  document.querySelectorAll("[data-swcat]").forEach(x=>x.onclick=()=>{stashSell();SELLFORM.category=x.dataset.swcat;if(SELLFORM.hasVariants)pvSync(SELLFORM);swGo("who")});
  document.querySelectorAll(".sw [data-stype]").forEach(x=>x.onclick=()=>{SELLFORM._step="photos";sellTypeSet(x.dataset.stype)});   // sellTypeSet stashes and renders
  document.querySelectorAll("[data-swgo]").forEach(x=>x.onclick=()=>swGo(x.dataset.swgo));
  const ti=$("#s-title");if(ti&&!ti.value)setTimeout(()=>{try{ti.focus({preventScroll:true})}catch(e){}},50);
}
