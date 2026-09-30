/* ── SIZES & COLOURS in the listing form · 2026-09-30 ──────────────────
   Off: one item with a quantity, as before. On: a row per size/colour
   with its own stock (S · Black · 3). Quick sizes add rows in one tap;
   the total is what the listing says is left. */
const PV_SIZES=["XS","S","M","L","XL","XXL"];
const pvX=`<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="square" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg>`;

function pvHTML(f){
  const on=!!f.hasVariants, vs=f.variants||[];
  const qty=`<div class="pf-row"><span>Quantity</span>
      <div class="pf-step"><button type="button" data-qty="-1" aria-label="Fewer">−</button>
        <input id="s-qty" type="number" inputmode="numeric" min="1" max="500" step="1" value="${f.quantity||1}" aria-label="Quantity">
        <button type="button" data-qty="1" aria-label="More">+</button></div></div>`;
  const have=new Set(vs.map(v=>(v.size||"").toUpperCase()));
  return `<section class="pf-card">
    <div class="pf-sec">Inventory</div>
    <label class="pf-row"><span>Different sizes or colours</span><input type="checkbox" class="pf-sw" id="s-hasvar" ${on?"checked":""}></label>
    ${!on?qty:`
      <div class="pv-quick">${PV_SIZES.map(s=>`<button type="button" class="chip${have.has(s)?" on":""}" data-pvq="${s}">${s}</button>`).join("")}</div>
      <div class="pv-rows" id="pvrows">${vs.map((v,i)=>`<div class="pv-row" data-pvi="${i}">
        <input class="pf-in" data-pvf="size" value="${esc(v.size||"")}" maxlength="20" placeholder="Size" aria-label="Size">
        <input class="pf-in" data-pvf="colour" value="${esc(v.colour||"")}" maxlength="30" placeholder="Colour" aria-label="Colour">
        <div class="pf-step"><button type="button" data-pvqty="-1" aria-label="Fewer">−</button>
          <input type="number" inputmode="numeric" min="0" max="500" data-pvf="qty" value="${Number(v.qty)||0}" aria-label="In stock">
          <button type="button" data-pvqty="1" aria-label="More">+</button></div>
        <button type="button" class="pv-x" data-pvx="${i}" aria-label="Remove">${pvX}</button></div>`).join("")}</div>
      <button type="button" class="pv-add" id="pvadd">+ Add a size or colour</button>
      <div class="pv-tot" id="pvtot">${pvTotal(vs)}</div>`}
  </section>`}
const pvTotal=vs=>{const n=vs.reduce((a,v)=>a+(Number(v.qty)||0),0);return n?`${n} in stock across ${vs.length} option${vs.length==1?"":"s"}`:"Add stock to at least one"};

/* Read the rows back into SELLFORM (called by stashSell). */
function pvStash(){
  if(!SELLFORM)return;
  const sw=$("#s-hasvar");if(sw)SELLFORM.hasVariants=sw.checked;
  const rows=[...document.querySelectorAll("#pvrows .pv-row")];
  if(!rows.length&&!$("#pvrows"))return;
  const old=SELLFORM.variants||[];
  SELLFORM.variants=rows.map(r=>{const g=k=>r.querySelector(`[data-pvf="${k}"]`).value;
    return {id:(old[+r.dataset.pvi]||{}).id||"",size:g("size").trim(),colour:g("colour").trim(),qty:Math.max(0,Math.min(500,parseInt(g("qty"),10)||0))}});
}

function wireSellVariants(){
  const sw=$("#s-hasvar");if(!sw)return;
  sw.onchange=()=>{stashSell();SELLFORM.hasVariants=sw.checked;
    if(sw.checked&&!(SELLFORM.variants||[]).length){
      const sz=(SELLFORM.size||"").trim();
      SELLFORM.variants=[{id:"",size:sz,colour:(SELLFORM.colour||"").trim(),qty:Number(SELLFORM.quantity)||1}];
    }
    render()};
  document.querySelectorAll("[data-pvq]").forEach(b=>b.onclick=()=>{stashSell();const s=b.dataset.pvq,vs=SELLFORM.variants||[];
    const i=vs.findIndex(v=>(v.size||"").toUpperCase()===s);
    if(i>=0&&!vs[i].colour)vs.splice(i,1);   // a quick size is a toggle
    else if(i<0){const blank=vs.findIndex(v=>!v.size&&!v.colour);const colour=vs.length?vs[vs.length-1].colour||"":"";
      if(blank>=0)vs[blank].size=s;
      else{   // in size order: S before M before L
        const rank=x=>{const k=PV_SIZES.indexOf((x.size||"").toUpperCase());return k<0?99:k};
        const at=vs.findIndex(v=>rank(v)>PV_SIZES.indexOf(s));
        vs.splice(at<0?vs.length:at,0,{id:"",size:s,colour,qty:1})}}
    else return toast(s+" is already there");
    SELLFORM.variants=vs;render()});
  const add=$("#pvadd");if(add)add.onclick=()=>{stashSell();(SELLFORM.variants=SELLFORM.variants||[]).push({id:"",size:"",colour:"",qty:1});render();
    const r=document.querySelectorAll("#pvrows .pv-row");const last=r[r.length-1];if(last)last.querySelector("input").focus()};
  document.querySelectorAll("[data-pvx]").forEach(b=>b.onclick=()=>{stashSell();SELLFORM.variants.splice(+b.dataset.pvx,1);render()});
  document.querySelectorAll("[data-pvqty]").forEach(b=>b.onclick=()=>{const i=b.parentNode.querySelector("input");
    i.value=Math.min(500,Math.max(0,(parseInt(i.value,10)||0)+(+b.dataset.pvqty)));stashSell();
    const t=$("#pvtot");if(t)t.textContent=pvTotal(SELLFORM.variants||[])});
  document.querySelectorAll("#pvrows input").forEach(i=>i.addEventListener("input",()=>{stashSell();
    const t=$("#pvtot");if(t)t.textContent=pvTotal(SELLFORM.variants||[])}));
}
