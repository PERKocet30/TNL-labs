function detailHTML(){
  if(!MKTONE)return `<div class="scroll"><div class="empty">Loading…</div></div>`;
  if(MKTONE.kind==="loop")return loopDetailHTML(MKTONE);   // a loop isn't a jacket
  const l=MKTONE, mine=l.seller.username===myName();
  return `<div class="scroll">
    <div class="dnav"><button class="backb2" data-mv="browse">← Market</button>
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
            ${MKTSELLER.rating!==null?`<span class="star">★ ${MKTSELLER.rating.toFixed(1)}</span> <span class="dim">(${MKTSELLER.reviews})</span>`:`<span class="dim">No reviews yet</span>`}
            ${MKTSELLER.sold?` · ${MKTSELLER.sold} sold`:""}
            ${MKTSELLER.shipRate!==null&&MKTSELLER.sold>2?` · ${MKTSELLER.shipRate}% shipped`:""}
          </div>`:""}
        </div>
        <span class="mono dim">${l.views} views</span>
      </div>
      ${MKTMETA.paymentsEnabled?`<div class="dtrust">🔒 <span>Paid through TNL — your card never touches the seller, and you\u2019re covered until it ships.</span></div>`:""}
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
        ${MKTOFFERS.filter(o=>o.status==="accepted").length?`<div class="acceptbar">✓ Your offer of ${money(MKTOFFERS.find(o=>o.status==="accepted").amount_cents)} was accepted — buy now to lock it in</div>`:""}
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
    <div class="dnav"><button class="backb2" data-mv="browse">← Market</button></div>
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
  const fee=MKTMETA.feePct??10;
  const n=nextRate();
  return `<div class="ratebar">
    <div class="ratenow"><b>${fee}%</b><span class="mono dim">YOUR RATE</span></div>
    <div class="rateinfo">
      <div class="mono dim">DEPOP TAKES 10% FOREVER. HERE IT DROPS AS PEOPLE VOUCH FOR YOU.</div>
      ${n?`<div class="ratenext">${n.need} more rep → <b>${n.fee}%</b> at ${esc(n.name)}</div>`
        :`<div class="ratenext">You're at the best rate in the network.</div>`}
    </div>
    <button class="ratelad mono" id="rateladder">SEE ALL →</button>
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
          <span class="crung-n">${me.id>=l.id?"✓":l.id}</span>
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
  if(!MKTMETA.paymentsEnabled)return `<div class="paybar off">
    <div><b>Card payments aren't switched on yet.</b>
    <div class="mono dim">You can still list — buyers reserve the item and you settle up directly.</div></div></div>`;
  if(ME.payoutsReady)return `${rateHTML()}<div class="paybar ok">
    <div><b>✓ Payouts connected</b>
    <div class="mono dim">Stripe pays you directly.</div></div>
    <button class="btn sm ghost" id="paydash">Stripe dashboard</button></div>`;
  return `${rateHTML()}<div class="paybar">
    <div><b>Set up payouts to get paid by card</b>
    <div class="mono dim">Connect your own Stripe account — it pays you directly, TNL never holds your money.</div></div>
    <button class="btn sm green" id="payconnect">${ME.hasStripe?"Finish setup":"Connect Stripe"}</button></div>`}

function sellHTML(){const f=SELLFORM||{};
  return `<div class="scroll">
    <div class="dnav"><button class="backb2" data-mv="${MKTEDIT?"detail":"browse"}">← ${MKTEDIT?"Cancel":"Market"}</button></div>
    <div class="page-head"><div class="mono dim">${MKTEDIT?"EDIT LISTING":"NEW LISTING"}</div>
    <h2 class="page-h">${MKTEDIT?"Edit listing":SELLKIND==="loop"?"Sell a loop":"Sell an item"}</h2>
    <p class="page-sub">${MKTEDIT
      ?"Saved changes go live straight away. Offers already made stay on the table."
      :SELLKIND==="loop"
      ?"Upload it, name a price — or set it to 0 and give it away. Free loops need no payout setup."
      :"Photos first — that's what sells it."}</p>
    </div>
    ${(ME&&!ME.emailVerified)?`<div class="paybar off" style="margin:0 20px 14px">
      <div><b>Confirm your email to list.</b>
      <div class="mono dim">Check your inbox — or hit Resend on the banner at the top.</div></div></div>`:""}
    ${(!MKTEDIT&&MKTMETA.paymentsEnabled&&ME&&!ME.payoutsReady)?`
      <div class="paywall">
        <div class="paywall-ic">$</div>
        <h3 class="paywall-h">Set up payouts to list</h3>
        <p class="paywall-p">Every sale runs through the platform — that's how you get paid safely and how the buyer's protected. Connect your own Stripe account: it pays you directly, TNL never holds your money.</p>
        <div class="mono dim paywall-rate">YOUR RATE: ${MKTMETA.feePct??10}% · DROPS TO ${(MKTMETA.feeLadder||[]).slice(-1)[0]?.fee??2}% AS PEOPLE VOUCH FOR YOU</div>
        <button class="btn green" id="payconnect2">${ME.hasStripe?"Finish setup":"Connect Stripe"}</button>
      </div>
    `:`
    ${payoutBannerHTML()}
    <div class="sellform">
      <div class="mono lbl">PHOTOS (UP TO 8)</div>
      <div class="simgs">
        ${SELLIMGS.map((im,i)=>`<div class="simg"><img src="${im}"><button class="simgx" data-simgx="${i}" aria-label="Close"><svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="square" stroke-linejoin="miter" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg></button></div>`).join("")}
        ${SELLUP?`<div class="simgadd busy"><span class="spin"></span></div>`:SELLIMGS.length<8?`<button class="simgadd" id="saddimg">＋</button>`:""}
      </div>
      <input type="file" id="sfile" accept="image/*" hidden>
      <label class="mono lbl">TITLE</label><input class="in" id="s-title" value="${esc(f.title||"")}" maxlength="120" placeholder="e.g. Vintage Carhartt Detroit Jacket">
      ${SELLKIND==="loop"?`
      <label class="mono lbl">PRICE ($) — 0 GIVES IT AWAY</label>
      <input class="in" id="s-price" type="number" inputmode="decimal" min="0" step="0.01" value="${f.price??""}" placeholder="0">
      ${Number(f.price||0)===0?`<div class="freenote mono">
        ↳ FREE. NO PAYOUT SETUP NEEDED. THEY GRAB IT, YOU GET TOLD WHO — THAT'S HOW A COLLAB STARTS.
      </div>`:`<div class="mono dim" style="margin:5px 0 12px;line-height:1.5">You keep ${100-(MKTMETA.feePct??10)}% — TNL takes ${MKTMETA.feePct??10}%, and that drops as people vouch for you.</div>`}
      <label class="mono lbl">TYPE</label>
      <div class="fchips">${(MKTMETA.loopCategories||["Loop"]).map(c=>`<button class="chip sm ${f.category===c?"on":""}" data-scat="${esc(c)}">${esc(c)}</button>`).join("")}</div>
      <div class="srow">
        <div><label class="mono lbl">BPM</label><input class="in" id="s-bpm" type="number" inputmode="numeric" min="40" max="300" value="${f.bpm||""}" placeholder="140"></div>
        <div><label class="mono lbl">KEY</label>
          <select class="in" id="s-key"><option value="">—</option>
          ${(MKTMETA.keys||[]).map(k=>`<option ${f.musicalKey===k?"selected":""}>${esc(k)}</option>`).join("")}</select></div>
      </div>
      <label class="swrap"><input type="checkbox" id="s-stems" ${f.stems?"checked":""}> <span>Stems included</span></label>
      `:`
      <div class="srow">
        <div><label class="mono lbl">PRICE ($)</label><input class="in" id="s-price" type="number" inputmode="decimal" min="1" step="0.01" value="${f.price||""}" placeholder="45.00"></div>
        <div><label class="mono lbl">SHIPPING ($)</label><input class="in" id="s-ship" type="number" inputmode="decimal" min="0" step="0.01" value="${f.shipping||""}" placeholder="0 = free"></div>
      </div>
      <label class="mono lbl">QUANTITY</label>
      <input class="in" id="s-qty" type="number" inputmode="numeric" min="1" max="500" step="1" value="${f.quantity||1}">
      <label class="mono lbl">CATEGORY</label>
      <div class="fchips">${MKTMETA.categories.map(c=>`<button class="chip sm ${f.category===c?"on":""}" data-scat="${esc(c)}">${esc(c)}</button>`).join("")}</div>
      <label class="mono lbl">CONDITION</label>
      <div class="fchips">${MKTMETA.conditions.map(c=>`<button class="chip sm ${f.condition===c?"on":""}" data-scond="${esc(c)}">${esc(c)}</button>`).join("")}</div>
      <div class="srow">
        <div><label class="mono lbl">BRAND</label><input class="in" id="s-brand" value="${esc(f.brand||"")}" maxlength="60"></div>
        <div><label class="mono lbl">SIZE</label><input class="in" id="s-size" value="${esc(f.size||"")}" maxlength="20" placeholder="M / 32 / 10"></div>
      </div>
      <div class="srow">
        <div><label class="mono lbl">COLOUR</label><input class="in" id="s-colour" value="${esc(f.colour||"")}" maxlength="30"></div>
        <div><label class="mono lbl">SHIPS FROM</label><input class="in" id="s-from" value="${esc(f.shipsFrom||"")}" maxlength="60" placeholder="NYC"></div>
      </div>`}
      <label class="mono lbl">DESCRIPTION</label>
      <textarea class="in" id="s-desc" rows="4" maxlength="2000" placeholder="Fit, flaws, measurements, story.">${esc(f.description||"")}</textarea>
      <label class="workcheck" style="margin-top:12px"><input type="checkbox" id="s-offers" ${f.acceptsOffers!==false?"checked":""}> <span>Accept offers</span></label>
      <button class="btn green wide" id="s-post">${MKTEDIT?"Save changes":"List it"}</button>
    </div>`}
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
    <div class="stars">${[1,2,3,4,5].map(n=>`<button class="star-btn ${n<=REVSTARS?"on":""}" data-star="${n}">★</button>`).join("")}</div>
    <div class="mono dim" style="margin-top:6px">${["","Bad","Poor","Fine","Good","Perfect"][REVSTARS]}</div>
    <div class="mono lbl" style="margin-top:16px">A WORD (OPTIONAL)</div>
    <textarea class="in" id="revbody" rows="3" maxlength="500" placeholder="Did it arrive as described? Packed well? Quick?"></textarea>
    <button class="btn green wide" id="revsend">Post review</button>
    <div class="mono dim" style="margin-top:10px;line-height:1.6">Reviews are public and permanent. Only buyers who confirmed delivery can leave one — that's what makes them mean something.</div>
  </div></div>`}

function ordersHTML(){
  const list=ORDERS?(ORDTAB==="buying"?ORDERS.buying:ORDERS.selling):[];
  return `<div class="scroll">
    <div class="dnav"><button class="backb2" data-mv="browse">← Market</button></div>
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
          ${ORDTAB==="buying"&&o.reviewed?`<span class="mono dim">✓ reviewed</span>`:""}
          <button class="btn sm ghost" data-dmseller="${esc(o.other.username)}">Message</button>
        </div>
      </div>`).join("")}
    </div>
  </div>`}

function studioHTML(){
  const d=SITE.distro;
  /* The distribution offer. It sits here, above the tools, because that's
     where a producer is when they're deciding whether this place is worth
     their time. It shows YOUR standing — a generic banner is an advert; a
     number you're 186 rep away from is a reason. */
  const distro=()=>{
    if(!d)return "";
    if(guest())return `<div class="distro">
      <div class="distro-h"><span class="distro-ic">↗</span>
        <b>Reach ${esc(d.levelName)} and we put your music on Spotify.</b></div>
      <p>${esc(d.blurb)} You get there by making things people back — not by paying, not by knowing anyone.</p>
    </div>`;
    const me=levelFor(myRep());
    const done=me.id>=d.level;
    const away=Math.max(0,d.at-myRep());
    return `<div class="distro ${done?"earned":""}">
      <div class="distro-h"><span class="distro-ic">${done?"✓":"↗"}</span>
        <b>${done
          ? "You're "+esc(d.levelName)+". Your music gets distributed."
          : "At "+esc(d.levelName)+", TNL puts your music on Spotify, Apple Music and the rest."}</b></div>
      <p>${esc(d.blurb)}</p>
      ${done
        ? `<div class="mono distro-go">↗ MESSAGE @TNLLABS WITH A FINISHED TRACK AND IT GOES OUT</div>`
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
