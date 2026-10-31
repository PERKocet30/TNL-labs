/* v2026-10-20: a kit head with the way back to the Market */
/* ── ORDER CONFIRMED v1.0 — 2026-10-18 ─────────────────────────────────
   "Seamless payments": after Stripe, the buyer lands on the order they
   just paid for, the way a shop's thank-you page works: what they bought,
   what it cost, where it's going, and what happens next. A payment that's
   still clearing (some banks) says so instead of "failed".
   ?checkout=paid&o=<order or bag id> → MKTVIEW "confirmed" (boot, app-19). */
let DONEID=null, DONESTATE="paid";
async function orderDoneOpen(id,state){
  DONEID=Number(id)||null;DONESTATE=state==="processing"?"processing":"paid";
  TAB="market";MKTVIEW="confirmed";ORDERS=null;render();
  try{ORDERS=await api.orders()}catch(e){ORDERS={buying:[],selling:[]}}
  render();
}
function orderDoneHTML(){
  const rows=ORDERS?(ORDERS.buying||[]).filter(o=>o.cart===DONEID||o.id===DONEID).sort((a,b)=>a.id-b.id):null;
  const wait=DONESTATE==="processing";
  const ic=`<svg viewBox="0 0 24 24" width="30" height="30" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="square" aria-hidden="true">${wait?'<circle cx="12" cy="12" r="8"/><path d="M12 8v4l3 2"/>':'<path d="M5 12.5l4.5 4.5L19 7.5"/>'}</svg>`;
  const top=`${screenHead({back:{attrs:'data-mv="browse"',label:"Market"},title:wait?"Payment":"Your order"})}<div class="od-top"><div class="od-ic${wait?" wait":""}">${ic}</div>
    <h2 class="od-h">${wait?"Payment processing":"Order confirmed"}</h2>
    <p class="od-p">${wait?"Your bank is still clearing it. We'll tell you and the seller the moment it lands — nothing to do.":
      rows&&rows.length?`Thanks — <b>${esc(rows[0].other.displayName)}</b> has been told to ship it.`:"Thanks — the seller has been told to ship it."}</p></div>`;
  if(!rows)return `<div class="scroll od">${top}<div class="od-card">${skel()}</div></div>`;
  const items=rows.reduce((n,o)=>n+o.amount,0), ship=rows.reduce((n,o)=>n+o.shipping,0), o0=rows[0]||{};
  const steps=[["Ships","The seller packs it and adds tracking — it shows in your notifications."],
    ["Arrives","Tap Received in your orders when it's with you."],["Review","Tell people how it went. Only buyers can."]];
  return `<div class="scroll od">${top}
    ${rows.length?`<div class="od-card">
      ${rows.map(o=>`<div class="od-item"><img class="ordimg" src="${esc(o.listing.images[0]||"")}" alt="">
        <div class="od-it"><div class="mtitle">${esc(o.listing.title)}</div>${o.variant?`<div class="ordvar">${esc(o.variant)}</div>`:""}</div>
        <div class="od-amt">${money(o.amount)}</div></div>`).join("")}
      <div class="od-sum"><span>Subtotal</span><span>${money(items)}</span></div>
      <div class="od-sum"><span>Shipping</span><span>${ship?money(ship):"Free"}</span></div>
      <div class="od-sum od-tot"><span>Total</span><span>${money(items+ship)}</span></div>
    </div>
    ${o0.shipName||o0.shipAddress?`<div class="od-card"><div class="od-lb">Shipping to</div>
      <div class="od-addr">${[o0.shipName,o0.shipAddress].filter(Boolean).map(esc).join("<br>")}</div></div>`:""}`:""}
    ${wait?"":`<div class="od-card"><div class="od-lb">What happens next</div>
      ${steps.map((s,i)=>`<div class="od-step"><span class="od-n">${i+1}</span><div><b>${s[0]}</b><div class="od-s">${s[1]}</div></div></div>`).join("")}</div>`}
    <div class="od-btns">
      <button class="gx-btn" data-mv="orders">View order</button>
      ${o0.other?`<button class="btn ghost od-msg" data-dmseller="${esc(o0.other.username)}">Message ${esc(o0.other.displayName)}</button>`:""}
      <button class="btn ghost od-msg" data-mv="browse">Keep shopping</button>
    </div>
  </div>`}
