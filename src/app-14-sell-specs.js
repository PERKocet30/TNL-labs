/* ── CATEGORIES & DETAILS in the listing form · v1.0 — 2026-10-18 ──────
   "Professional options to categorize what people are selling so you can
   give them better options to describe and list what they're selling."
   The taxonomy lives on the server (server-06-market-taxonomy, sent as
   MKTMETA.taxonomy): departments → categories, each with its own size
   buttons and its own details — fit and measurements for clothes, size
   system for shoes, metal for jewellery, medium / edition / signed /
   framed for art. Picking a category reshapes Size & stock and Details;
   the listing page shows the details as a plain list. */
const TAX=()=>MKTMETA.taxonomy||{departments:[],categories:{},specs:{}};
const catLabel=c=>(TAX().categories[c]||{}).label||c;
const sellSizes=f=>{const c=TAX().categories[f.category];return c?c.sizes:PV_SIZES};
const sellDept=f=>((TAX().departments||[]).find(d=>d.categories.includes(f.category))||{}).name||"";

/* The category picker: one select, grouped by department (a phone shows its own wheel). */
function catPickHTML(f){
  const t=TAX();
  if(!t.departments.length)return `<select class="pf-in" id="s-cat">${(MKTMETA.categories||[]).map(c=>`<option${f.category===c?" selected":""}>${esc(c)}</option>`).join("")}</select>`;
  return `<div class="pf-sel"><select class="pf-in" id="s-cat">${t.departments.map(d=>`<optgroup label="${esc(d.name)}">${d.categories.map(c=>
    `<option value="${esc(c)}"${f.category===c?" selected":""}>${esc(catLabel(c))}</option>`).join("")}</optgroup>`).join("")}</select></div>`}

/* The category's own details: pickers and short fields two by two, yes/no as switches. */
function specFieldsHTML(f){
  const t=TAX(), c=t.categories[f.category];if(!c||!c.specs.length)return "";
  const v=f.specs||{};
  const field=k=>{const d=t.specs[k];if(!d||d.yes)return "";
    return `<div><label class="pf-lb" for="sp-${k}">${esc(d.label)}</label>${d.choice
      ?`<div class="pf-sel"><select class="pf-in" id="sp-${k}" data-spec="${k}"><option value="">—</option>${d.choice.map(o=>`<option${v[k]===o?" selected":""}>${esc(o)}</option>`).join("")}</select></div>`
      :`<input class="pf-in" id="sp-${k}" data-spec="${k}" value="${esc(v[k]||"")}" maxlength="80" placeholder="${esc(d.ph||"")}">`}</div>`};
  const fields=c.specs.map(field).filter(Boolean), yes=c.specs.filter(k=>t.specs[k]&&t.specs[k].yes);
  return `<div class="pf-2 sp-grid">${fields.join("")}</div>
    ${yes.map(k=>`<label class="pf-row"><span>${esc(t.specs[k].label)}</span><input type="checkbox" class="pf-sw" data-spec="${k}" ${v[k]==="Yes"?"checked":""}></label>`).join("")}`}

/* Read the details back (pvStash calls this). Only this category's keys travel. */
function specStash(){
  if(!SELLFORM)return;
  const els=[...document.querySelectorAll("[data-spec]")];if(!els.length)return;
  const s={};els.forEach(e=>{const k=e.dataset.spec;if(e.type==="checkbox"){if(e.checked)s[k]="Yes"}else if(e.value.trim())s[k]=e.value.trim()});
  SELLFORM.specs=s;
}

/* On the listing page: the details, as a list. */
const specListHTML=l=>(l.specList||[]).length?`<dl class="dspecs">${l.specList.map(([k,v])=>`<div><dt>${esc(k)}</dt><dd>${esc(v)}</dd></div>`).join("")}</dl>`:"";

function wireSellSpecs(){
  const c=$("#s-cat");
  if(c)c.addEventListener("change",()=>{stashSell();SELLFORM.category=c.value;
    if(SELLFORM.hasVariants)pvSync(SELLFORM);render()});   // new sizes and details for the new category
}
