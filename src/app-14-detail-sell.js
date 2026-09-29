function detailHTML(){
  if(!MKTONE)return `<div class="scroll"><div class="empty">Loading…</div></div>`;
  if(MKTONE.kind==="loop")return loopDetailHTML(MKTONE);   // a loop isn't a jacket
  const l=MKTONE, mine=l.seller.username===myName();
  return `<div class="scroll">
    <div class="dnav"><button class="backb2" data-mv="browse">${DI.back} Market</button>
      <button class="backb2" data-mshare="${l.id}">Share</button></div>
    <div class="dimgs">${l.images.map(i=>`<img src="${esc(i)}" data-zoom="${esc(i)}" loading="lazy">`).join("")}</div>
    <div class="dbody">
      <div class="dtop">
        <div><h2 class="dtitle">${esc(l.title)}</h2>
        <div class="dprice">${money(l.price)}${l.shipping?`<span class="mono dim"> + ${money(l.shipping)} shipping</span>`:`<span class="mono dim"> · free shipping</span>`}${l.quantity>1?`<span class="mono dim"> · ${l.quantity} left</span>`:""}</div></div>
        <button class="mlike big ${l.likedByMe?"on":""}" data-mlike="${l.id}">${MK_HEART(l.likedByMe)}${l.likeCount?" "+l.likeCount:""}</button>
      </div>
      ${l.status==="sold"?`<div class="soldbar">SOLD</div>`:""}
      <div class="dchips">${[l.condition,l.size,l.brand,l.category,l.colour,l.shipsFrom&&("Ships from "+l.shipsFrom)].filter(Boolean).map(v=>`<span class="dchip">${esc(v)}</span>`).join("")}</div>
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
        <span class="mono dim">${l.views} views</span>
      </div>
      ${MKTMETA.paymentsEnabled?`<div class="dtrust">${DI.lock} <span>Paid through TNL — your card never touches the seller, and you\u2019re covered until it ships.</span></div>`:""}
      ${mine?`
        <div class="mono dim" style="margin:16px 0 8px">OFFERS</div>
        ${MKTOFFERS.length?MKTOFFERS.map(o=>`<div class="orow">
          <div><b>${money(o.amount_cents)}</b> <span class="mono dim">from ${esc(o.display_name||o.username)}</span></div>
          <div class="obtns"><button class="btn sm green" data-oa="${o.id}:accept">Accept</button>
          <button class="btn sm ghost" data-oa="${o.id}:decline">Decline</button></div>
        </div>`).join(""):`<div class="mono dim">No offers yet.</div>`}
        <div class="dactions">
          <button class="btn ghost" data-medit="${l.id}">Edit</button>
          <button class="btn ghost" data-msold="${l.id}">${l.status==="sold"?"Relist":"Mark sold"}</button>
          <button class="btn ghost" data-mdel="${l.id}">Delete</button>
        </div>`
      :l.status==="active"?`
        <div class="dactions">
          <button class="btn green" data-buy="${l.id}">Buy — ${money(l.price+l.shipping)}</button>
          ${l.acceptsOffers?`<button class="btn ghost" data-offer="${l.id}">Make offer</button>`:""}
          <button class="btn ghost" data-dmseller="${esc(l.seller.username)}">Ask</button>
        </div>
        ${MKTOFFERS.filter(o=>o.status==="pending").length?`<div class="mono dim" style="margin-top:10px">YOUR OFFER: ${money(MKTOFFERS[0].amount_cents)} — pending</div>`:""}
        ${MKTOFFERS.filter(o=>o.status==="accepted").length?`<div class="acceptbar">${DI.check} Your offer of ${money(MKTOFFERS.find(o=>o.status==="accepted").amount_cents)} was accepted — buy now to lock it in</div>`:""}
        ${!MKTMETA.paymentsEnabled?`<div class="mono dim" style="margin-top:12px;line-height:1.6">Card payments aren't switched on yet — buying reserves the item and connects you with the seller to settle up directly.</div>`:""}
      `:`<div class="mono dim" style="margin-top:14px">This item is sold.</div>`}

      ${MKTSIMILAR.length?`<div class="simwrap">
        <div class="mono dim sim-h">MORE LIKE THIS</div>
        <div class="simrow">${MKTSIMILAR.map(x=>`<button class="simcard" data-mopen="${x.id}">
          <img src="${esc(x.images[0]||"")}" alt="" loading="lazy">
          <div class="simt">${esc(x.title)}</div>
          <div class="simp">${money(x.price)}</div>
        </button>`).join("")}</div>
      </div>`:""}
    </div>
  </div>`}

function savedHTML(){
  return `<div class="scroll">
    <div class="dnav"><button class="backb2" data-mv="browse">${DI.back} Market</button></div>
    <div class="page-head"><div class="mono dim">SAVED</div><h2 class="page-h">Your list</h2>
    <p class="page-sub">Everything you've hearted. Sold items stay so you can see what went.</p></div>
    <div class="mkt-grid">${!SAVED?`<div class="empty">Loading…</div>`
      :!SAVED.length?`<div class="empty">Nothing saved yet.<br><br>Tap the heart on anything in the Market.</div>`
      :SAVED.map(mktCardHTML).join("")}</div>
  </div>`}

function nextRate(){
  if(!ME)return null;
  const lad=MKTMETA.feeLadder||[];
  const lvl=levelFor(ME.rep).id;
  const nxt=lad.find(x=>x.level===lvl+1);
  if(!nxt)return null;
  return {need:nxt.at-ME.rep,fee:nxt.fee,name:nxt.name};
}
function rateHTML(){
  if(!ME)return "";
  const fee=MKTMETA.feePct??10, n=nextRate();
  return `<div class="ratebar">
    <div class="ratenow"><b>${fee}%</b><span>Your rate</span></div>
    <div class="rateinfo">${n?`${n.need} more rep → <b>${n.fee}%</b> at ${esc(n.name)}`:"Best rate in the network"}</div>
    <button class="ratelad" id="rateladder">Rates</button>
  </div>`}

function climbHTML(){
  const rep=ME?ME.rep:0, me=levelFor(rep), nx=LEVELS.find(x=>x.at>rep);
  const lad=(MKTMETA.feeLadder&&MKTMETA.feeLadder.length)?MKTMETA.feeLadder
    :LEVELS.map(l=>({level:l.id,name:l.name,at:l.at,fee:{1:10,2:8,3:6,4:4,5:2}[l.id]}));
  const fee=x=>lad.find(r=>r.level===x)?.fee??10;
  const pct=nx?Math.min(100,Math.round((rep-me.at)/(nx.at-me.at)*100)):100;
  const perks={
    1:["Post work and get seen","Back others — every like you give is someone's rep","Sell at "+fee(1)+"% — keep $"+(100-fee(1))+" of every $100"],
    2:["You read as real, not a throwaway account","Fee drops to "+fee(2)+"% — keep $"+(100-fee(2))],
    3:["The network reads you as proven — collabs come to you","Fee drops to "+fee(3)+"% — keep $"+(100-fee(3))],
    4:["Core of the network — your word carries","Fee drops to "+fee(4)+"% — keep $"+(100-fee(4))],
    5:["Best rate in the network — "+fee(5)+"%, keep $"+(100-fee(5)),"You shape where this goes"]};
  return `<div class="climb" id="climbbg">
    <div class="climbw">
      <button class="climb-x" id="climbx" aria-label="Close"><svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="square" stroke-linejoin="miter" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg></button>
      <div class="mono dim" style="letter-spacing:.02em">THE CLIMB</div>
      <h1 class="climb-h">STANDING<br>PAYS.</h1>
      <p class="climb-sub">Rep is earned when <b style="color:var(--tx)">other people back your work</b> — and every rung you climb, you keep more of every sale and more rooms open. It never resets, and no one can buy it.</p>
      <div class="cmoney">
        <div class="mono dim">ON EVERY $100 YOU SELL, YOU KEEP</div>
        <div class="cbars">${LEVELS.map(l=>`<div class="cbar ${me.id>=l.id?"on":""}">
          <b>$${100-fee(l.id)}</b><i style="height:${(100-fee(l.id))*0.9}px"></i><b>L${l.id}</b></div>`).join("")}</div>
        <div style="margin-top:12px;font-size:13px">You keep <b style="color:var(--green)">$${100-fee(me.id)}</b> today${nx?` — reach <b>${esc(nx.name)}</b> and keep <b>$${100-fee(nx.id)}</b>`:` — the best rate there is`}.</div>
      </div>
      <div class="cprog">
        <div style="display:flex;justify-content:space-between;align-items:center">
          <span><span class="pbadge">L${me.id}</span> <b style="margin-left:6px">${esc(me.name)}</b></span>
          <span class="mono dim">${rep} REP${nx?` · ${nx.at-rep} TO ${esc(nx.name.toUpperCase())}`:" · TOP"}</span>
        </div>
        <div class="ptrack" style="margin-top:8px"><div class="pfill" style="width:${pct}%"></div></div>
      </div>
      ${LEVELS.map(l=>`<div class="crung ${me.id>=l.id?"done":""} ${me.id===l.id?"here":""}">
        <button class="crung-t" data-crung="${l.id}">
          <span class="crung-n">${me.id>=l.id?DI.check:l.id}</span>
          <span style="flex:1"><b>${esc(l.name)}</b>${me.id===l.id?` <span class="mono" style="color:var(--green);font-size:11px;letter-spacing:.02em">YOU'RE HERE</span>`:""}<br><span class="mono dim" style="font-size:12px">${l.at} REP · KEEP ${100-fee(l.id)}%</span></span>
          <span class="dim">${CLIMBOPENRUNG===l.id?"–":"+"}</span>
        </button>
        ${CLIMBOPENRUNG===l.id?`<div class="crung-b">${perks[l.id].map(p=>`→ ${esc(p)}`).join("<br>")}</div>`:""}
      </div>`).join("")}
      <div class="crule">
        <div class="mono" style="color:var(--green);letter-spacing:.02em;font-size:12px">THE ONE RULE</div>
        <p style="margin-top:8px;font-size:14px;line-height:1.6">Rep only moves when <b>someone else acts</b> — likes ·6·, shares ·3·, accepted collabs ·20·, completed sales ·15·, delivered orders ·10·. Nothing you can do alone moves it. That's why it means something.</p>
      </div>
    </div>
    <div class="climb-cta"><button class="btn green" id="climbgo">Post your work — start climbing</button></div>
  </div>`}
function payoutBannerHTML(){
  if(guest())return "";
  if(!MKTMETA.paymentsEnabled)return `<div class="paybar off"><div><b>Card payments are off</b>
    <div class="dim">Buyers pay you directly for now.</div></div></div>`;
  if(ME.payoutsReady)return `${rateHTML()}<div class="paybar ok"><div><b>Payouts connected</b></div>
    <button class="btn sm ghost" id="paydash">Stripe dashboard</button></div>`;
  return `${rateHTML()}<div class="paybar"><div><b>Set up payouts</b>
    <div class="dim">Stripe pays you directly.</div></div>
    <button class="btn sm green" id="payconnect">${ME.hasStripe?"Finish setup":"Connect Stripe"}</button></div>`}

/* ── LISTING EDITOR · v2 · 2026-09-28 ──────────────────────────────
   Shaped like a Shopify product form: Media, Title & description, Pricing,
   Inventory, Shipping, Details — each a plain card — and one sticky
   Publish. No banners, no pitch: the fee shows up as the money you keep. */
function sellEarnHTML(){
  const f=SELLFORM||{}, fee=MKTMETA.feePct??10, p=Number(f.price||0);
  const rates=` · <button class="pf-link" id="rateladder" type="button">Rates</button>`;
  if(SELLKIND==="loop"&&p===0)return `Free — anyone can download it.`;
  if(!(p>=1))return `TNL fee ${fee}%${rates}`;
  return `You earn <b>${money(Math.round(p*100*(1-fee/100)))}</b> after the ${fee}% TNL fee, before card processing${rates}`;
}
function sellHTML(){const f=SELLFORM||{};const loop=SELLKIND==="loop";
  const X=w=>`<svg viewBox="0 0 24 24" width="${w}" height="${w}" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="square" stroke-linejoin="miter" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg>`;
  const chips=(list,attr,cur)=>`<div class="pf-chips">${list.map(c=>`<button type="button" class="chip ${cur===c?"on":""}" ${attr}="${esc(c)}">${esc(c)}</button>`).join("")}</div>`;
  const head=`<div class="pf-top">
    <button class="pf-x" data-mv="${MKTEDIT?"detail":"browse"}" aria-label="Close">${X(22)}</button>
    <div class="pf-title">${MKTEDIT?"Edit listing":"New listing"}</div><span class="pf-sp"></span></div>`;
  if(!MKTEDIT&&MKTMETA.paymentsEnabled&&ME&&!ME.payoutsReady)return `<div class="scroll pf">${head}
    <div class="pf-gate"><div class="pf-gate-ic">$</div>
      <h2 class="pf-h">Set up payouts to sell</h2>
      <p class="pf-p">Connect Stripe once — it pays you directly.</p>
      <button class="btn green" id="payconnect2">${ME.hasStripe?"Finish setup":"Connect Stripe"}</button></div></div>`;
  const noShip=!Number(f.shipping);
  return `<div class="scroll pf">${head}
  <div class="pf-body">
    <section class="pf-card">
      <div class="pf-sec">Media</div>
      <div class="pf-media">
        ${SELLIMGS.map((im,i)=>`<div class="pf-img">
          <button type="button" class="pf-imgbtn" data-scover="${i}" aria-label="${i?"Make cover":"Cover photo"}"><img src="${esc(im)}" alt=""></button>
          ${i===0?`<span class="pf-cover">Cover</span>`:""}
          <button type="button" class="pf-imgx" data-simgx="${i}" aria-label="Remove photo">${X(14)}</button></div>`).join("")}
        ${SELLUP?`<div class="pf-add busy"><span class="spin"></span></div>`
          :SELLIMGS.length<8?`<button type="button" class="pf-add" id="saddimg">${UI_IC.plus}<span>${SELLIMGS.length?"Add":"Add photos"}</span></button>`:""}
      </div>
      <div class="pf-hint">${SELLIMGS.length}/8${SELLIMGS.length>1?" · Tap a photo to make it the cover":loop?" · Optional artwork":""}</div>
      <input type="file" id="sfile" accept="image/*" multiple hidden>
    </section>

    <section class="pf-card">
      <label class="pf-lb" for="s-title">Title</label>
      <input class="pf-in" id="s-title" value="${esc(f.title||"")}" maxlength="120" placeholder="${loop?"Name the sound":"Short, clear title"}">
      <label class="pf-lb" for="s-desc">Description</label>
      <textarea class="pf-in pf-ta" id="s-desc" rows="4" maxlength="2000" placeholder="${loop?"Mood, gear, what it's for":"Fit, measurements, any flaws"}">${esc(f.description||"")}</textarea>
    </section>

    <section class="pf-card">
      <div class="pf-sec">Pricing</div>
      <label class="pf-lb" for="s-price">Price</label>
      <div class="pf-money"><span>$</span><input class="pf-in" id="s-price" type="number" inputmode="decimal" min="${loop?0:1}" step="0.01" value="${f.price??""}" placeholder="0.00"></div>
      <div class="pf-hint" id="s-earn">${sellEarnHTML()}</div>
      <label class="pf-row"><span>Accept offers</span><input type="checkbox" class="pf-sw" id="s-offers" ${f.acceptsOffers!==false?"checked":""}></label>
    </section>

    ${loop?`
    <section class="pf-card">
      <div class="pf-sec">Sound</div>
      <div class="pf-lb">Type</div>
      ${chips(MKTMETA.loopCategories||["Loop"],"data-scat",f.category)}
      <div class="pf-2">
        <div><label class="pf-lb" for="s-bpm">BPM</label><input class="pf-in" id="s-bpm" type="number" inputmode="numeric" min="40" max="300" value="${f.bpm||""}" placeholder="140"></div>
        <div><label class="pf-lb" for="s-key">Key</label><select class="pf-in" id="s-key"><option value="">—</option>
          ${(MKTMETA.keys||[]).map(k=>`<option ${f.musicalKey===k?"selected":""}>${esc(k)}</option>`).join("")}</select></div>
      </div>
      <label class="pf-row"><span>Stems included</span><input type="checkbox" class="pf-sw" id="s-stems" ${f.stems?"checked":""}></label>
    </section>`:`
    <section class="pf-card">
      <div class="pf-sec">Inventory</div>
      <div class="pf-row"><span>Quantity</span>
        <div class="pf-step"><button type="button" data-qty="-1" aria-label="Fewer">−</button>
          <input id="s-qty" type="number" inputmode="numeric" min="1" max="500" step="1" value="${f.quantity||1}" aria-label="Quantity">
          <button type="button" data-qty="1" aria-label="More">+</button></div></div>
    </section>

    <section class="pf-card">
      <div class="pf-sec">Shipping</div>
      <label class="pf-row"><span>Free shipping</span><input type="checkbox" class="pf-sw" id="s-freeship" ${noShip?"checked":""}></label>
      <div id="s-shipwrap"${noShip?" hidden":""}>
        <label class="pf-lb" for="s-ship">Shipping price</label>
        <div class="pf-money"><span>$</span><input class="pf-in" id="s-ship" type="number" inputmode="decimal" min="0" step="0.01" value="${noShip?"":f.shipping}" placeholder="0.00"></div>
      </div>
      <label class="pf-lb" for="s-from">Ships from</label>
      <input class="pf-in" id="s-from" value="${esc(f.shipsFrom||"")}" maxlength="60" placeholder="City">
    </section>

    <section class="pf-card">
      <div class="pf-sec">Details</div>
      <div class="pf-lb">Category</div>
      ${chips(MKTMETA.categories||[],"data-scat",f.category)}
      <div class="pf-lb">Condition</div>
      ${chips(MKTMETA.conditions||[],"data-scond",f.condition)}
      <div class="pf-2">
        <div><label class="pf-lb" for="s-brand">Brand</label><input class="pf-in" id="s-brand" value="${esc(f.brand||"")}" maxlength="60"></div>
        <div><label class="pf-lb" for="s-size">Size</label><input class="pf-in" id="s-size" value="${esc(f.size||"")}" maxlength="20" placeholder="M, 32, 10"></div>
      </div>
      <label class="pf-lb" for="s-colour">Colour</label>
      <input class="pf-in" id="s-colour" value="${esc(f.colour||"")}" maxlength="30">
    </section>`}

    ${MKTEDIT?`
    <section class="pf-card">
      <div class="pf-sec">Status</div>
      ${chips(["Active","Sold"],"data-sstat",(f.status||"active")==="sold"?"Sold":"Active")}
    </section>
    <button type="button" class="pf-del" data-mdel="${MKTEDIT}">Delete listing</button>`:""}
  </div>
  <div class="pf-bar"><button class="gx-btn" id="s-post">${MKTEDIT?"Save":"Publish"}</button></div>
  </div>`}

function reviewHTML(){
  if(!REVIEWING)return "";
  const o=REVIEWING;
  return `<div class="sheet" id="revbg"><div class="sheetc" style="max-width:420px">
    <div class="sheeth"><div><h2>How did it go?</h2></div>
      <button class="x" id="revx" aria-label="Close"><svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="square" stroke-linejoin="miter" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg></button></div>
    <div class="revitem">
      <img class="ordimg" src="${esc(o.listing.images[0]||"")}" alt="">
      <div><div class="mtitle">${esc(o.listing.title)}</div>
      <div class="mono dim">from ${esc(o.other.displayName)}</div></div>
    </div>
    <div class="mono dim" style="margin:16px 0 8px">YOUR RATING</div>
    <div class="stars">${[1,2,3,4,5].map(n=>`<button class="star-btn ${n<=REVSTARS?"on":""}" data-star="${n}">${DI.star}</button>`).join("")}</div>
    <div class="mono dim" style="margin-top:6px">${["","Bad","Poor","Fine","Good","Perfect"][REVSTARS]}</div>
    <div class="mono lbl" style="margin-top:16px">A WORD (OPTIONAL)</div>
    <textarea class="in" id="revbody" rows="3" maxlength="500" placeholder="Did it arrive as described? Packed well? Quick?"></textarea>
    <button class="btn green wide" id="revsend">Post review</button>
    <div class="mono dim" style="margin-top:10px;line-height:1.6">Reviews are public and permanent. Only buyers who confirmed delivery can leave one — that's what makes them mean something.</div>
  </div></div>`}

function ordersHTML(){
  const list=ORDERS?(ORDTAB==="buying"?ORDERS.buying:ORDERS.selling):[];
  return `<div class="scroll">
    <div class="dnav"><button class="backb2" data-mv="browse">${DI.back} Market</button></div>
    <div class="page-head"><div class="mono dim">ORDERS</div><h2 class="page-h">${ORDTAB==="buying"?"Bought":"Sold"}</h2></div>
    ${ORDTAB==="selling"?`<div style="padding:0 20px">${payoutBannerHTML()}</div>`:""}
    <div class="ptabs" style="margin:0 20px 12px">
      <button class="ptab ${ORDTAB==="buying"?"on":""}" data-ot="buying">BUYING ${ORDERS?ORDERS.buying.length:""}</button>
      <button class="ptab ${ORDTAB==="selling"?"on":""}" data-ot="selling">SELLING ${ORDERS?ORDERS.selling.length:""}</button>
    </div>
    <div style="padding:0 20px 30px">
      ${!ORDERS?`<div class="empty">Loading…</div>`:!list.length?`<div class="empty">Nothing here yet.</div>`
      :list.map(o=>`<div class="ordrow">
        <img class="ordimg" src="${esc(o.listing.images[0]||"")}" alt="">
        <div class="ordbody">
          <div class="mtitle">${esc(o.listing.title)}</div>
          <div class="mono dim">${money(o.amount+o.shipping)} · ${ORDTAB==="buying"?"from":"to"} ${esc(o.other.displayName)}</div>
          <div class="ordstatus st-${o.status}">${o.status.toUpperCase()}${o.tracking?` · ${esc(o.tracking)}`:""}</div>
          ${!o.paid&&o.status!=="complete"?`<div class="unpaid">⚠ No payment taken — ${ORDTAB==="buying"?"pay the seller directly":"collect from the buyer directly"}</div>`:""}
          ${ORDTAB==="selling"&&o.status!=="complete"?`<div class="mono dim ordaddr">${esc(o.shipName)} — ${esc(o.shipAddress)}</div>`:""}
        </div>
        <div class="obtns">
          ${ORDTAB==="selling"&&(o.status==="pending"||o.status==="paid")?`<button class="btn sm green" data-ship="${o.id}">Mark shipped</button>`:""}
          ${ORDTAB==="buying"&&o.status==="shipped"?`<button class="btn sm green" data-recv="${o.id}">Received</button>`:""}
          ${ORDTAB==="buying"&&o.status==="complete"&&!o.reviewed?`<button class="btn sm green" data-review="${o.id}">Leave a review</button>`:""}
          ${ORDTAB==="buying"&&o.reviewed?`<span class="mono dim">${DI.check} reviewed</span>`:""}
          <button class="btn sm ghost" data-dmseller="${esc(o.other.username)}">Message</button>
        </div>
      </div>`).join("")}
    </div>
  </div>`}

function studioHTML(){
  const d=SITE.distro;
  /* The distribution offer, above the tools: it shows YOUR standing — a
     number you're 186 rep away from is a reason, a banner is an advert. */
  const distro=()=>{
    if(!d)return "";
    if(guest())return `<div class="distro">
      <div class="distro-h"><span class="distro-ic">${DI.out}</span>
        <b>Reach ${esc(d.levelName)} and we put your music on Spotify.</b></div>
      <p>${esc(d.blurb)} You get there by making things people back — not by paying, not by knowing anyone.</p>
    </div>`;
    const me=levelFor(myRep());
    const done=me.id>=d.level;
    const away=Math.max(0,d.at-myRep());
    return `<div class="distro ${done?"earned":""}">
      <div class="distro-h"><span class="distro-ic">${done?DI.check:DI.out}</span>
        <b>${done
          ? "You're "+esc(d.levelName)+". Your music gets distributed."
          : "At "+esc(d.levelName)+", TNL puts your music on Spotify, Apple Music and the rest."}</b></div>
      <p>${esc(d.blurb)}</p>
      ${done
        ? `<div class="mono distro-go">${DI.out} MESSAGE @TNLLABS WITH A FINISHED TRACK AND IT GOES OUT</div>`
        : `<div class="distro-bar"><div class="distro-fill" style="width:${Math.min(100,(myRep()/d.at)*100)}%"></div></div>
           <div class="mono dim distro-meta">${myRep()} / ${d.at} REP · ${away} TO GO — EARNED WHEN OTHERS BACK YOUR WORK, NEVER BY POSTING MORE</div>`}
    </div>`;
  };
  return `<div class="scroll">
  <div class="page-head"><h2>Studio</h2>
  <p class="page-sub">${guest()
    ?"A full beat maker in the app — drums, a tuned 808, synths with a scale-locked piano roll. Have a play. Joining lets you save it, export a WAV, or publish it to #beats for someone to write to."
    :"Make it here — publish straight to #beats."}</p>
  ${guest()?`<div class="tryline mono">TRY IT — NOTHING SAVES UNTIL YOU JOIN</div>`:""}
  ${distro()}</div>
  <div id="studiomount"></div>
</div>`}

/* Renders one piece of work on a profile. Takes the account's KIND so the
   collab credit reads in their language — "Designed with" vs "Made with". */
