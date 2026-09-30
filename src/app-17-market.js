function wireMarket(){
  wireListing();wireSellVariants();wireBag();
  document.querySelectorAll("[data-mv]").forEach(b=>b.onclick=async()=>{
    if(guest()&&(b.dataset.mv==="sell"||b.dataset.mv==="orders"))
      return needAccount(b.dataset.mv==="sell"?"Join to sell. Everyone in the lab can — and your rate drops as people vouch for you.":"Join to see your orders.");
    /* Leaving the editor drops the draft. Otherwise the next "＋ Sell" opens
       prefilled with the listing just edited — photos and all — and the
       seller posts a duplicate without noticing. */
    if(MKTEDIT){MKTEDIT=null;SELLFORM=null;SELLIMGS=[];SELLAUDIO=null;SELLAUDIONAME=""}
    MKTVIEW=b.dataset.mv;
    if(MKTVIEW==="sell"&&!SELLFORM&&!sdRestore())SELLFORM={category:"Tops",condition:"Good",acceptsOffers:true};
    if(MKTVIEW==="bag")return bagLoad();
    if(MKTVIEW==="orders"){ORDERS=null;render();shopStatsLoad();try{ORDERS=await api.orders()}catch(e){toast(e.message)}}
    if(MKTVIEW==="saved"){
      if(guest()){MKTVIEW="browse";return needAccount("Join to save items you want.")}
      SAVED=null;render();try{SAVED=(await api.saved()).listings}catch(e){toast(e.message)}}
    render()});
  document.querySelectorAll("[data-ot]").forEach(b=>b.onclick=()=>{ORDTAB=b.dataset.ot;render()});
  const os=$("#openstudio");if(os)os.onclick=()=>{if(guest())return needAccount("Join to use the studio.");TAB="studio";render()};
  const rl=$("#rateladder");if(rl)rl.onclick=()=>{if(MKTVIEW==="sell"||MKTVIEW==="edit")stashSell();CLIMB=true;CLIMBOPENRUNG=levelFor(ME.rep).id;render()};
  const cx=$("#climbx");if(cx)cx.onclick=()=>{CLIMB=false;render()};
  const cfp=$("#climbfromprof");if(cfp)cfp.onclick=()=>{PROFILE=null;CLIMB=true;CLIMBOPENRUNG=levelFor(ME.rep).id;render()};
  const cg=$("#climbgo");if(cg)cg.onclick=()=>{CLIMB=false;TAB="showroom";render()};
  document.querySelectorAll("[data-crung]").forEach(b=>b.onclick=()=>{
    CLIMBOPENRUNG=CLIMBOPENRUNG===+b.dataset.crung?0:+b.dataset.crung;render()});
  ["#payconnect","#payconnect2"].forEach(id=>{const b=$(id);if(b)b.onclick=async()=>{
    try{toast("Opening Stripe…");const d=await api.connectStart();location.href=d.url}catch(e){toast(e.message)}}});

  const pd=$("#paydash");if(pd)pd.onclick=async()=>{
    try{const d=await api.connectDash();window.open(d.url,"_blank")}catch(e){toast(e.message)}};
  document.querySelectorAll("[data-mopen]").forEach(el=>el.onclick=async e=>{
    if(e.target.closest("[data-mlike]"))return;
    PROFILE=null;TAB="market";           // a shop card lives on profiles too — land in the market
    MKTVIEW="detail";MKTONE=null;LPICK={id:0,size:"",colour:""};render();
    try{const d=await api.mktOne(el.dataset.mopen);
      MKTONE=d.listing;MKTOFFERS=d.offers||[];MKTSELLER=d.seller||null;MKTSIMILAR=d.similar||[];
      pushView("listing",d.listing.id);render();
      const sc=document.querySelector("#mktscroll");if(sc)sc.scrollTop=0;
    }catch(x){toast(x.message)}});
  document.querySelectorAll("[data-mlike]").forEach(b=>b.onclick=async e=>{
    e.stopPropagation();
    if(guest())return needAccount("Join to save items.");
    /* On the listing page the heart answers at once and nothing else
       moves: no refetch (that counted a view) and no repaint. */
    const one=MKTVIEW==="detail"&&MKTONE&&String(MKTONE.id)===b.dataset.mlike&&MKTONE;
    if(one){
      if(b._busy)return;b._busy=true;
      const paint=()=>{b.classList.toggle("on",one.likedByMe);b.innerHTML=MK_HEART(one.likedByMe)+`<span>${one.likeCount||""}</span>`};
      one.likedByMe=!one.likedByMe;one.likeCount=Math.max(0,(one.likeCount||0)+(one.likedByMe?1:-1));paint();
      try{const r=await api.mktLike(one.id);
        if(r&&typeof r.liked==="boolean"&&r.liked!==one.likedByMe){one.likedByMe=r.liked;one.likeCount=Math.max(0,one.likeCount+(r.liked?1:-1));paint()}}
      catch(x){one.likedByMe=!one.likedByMe;one.likeCount=Math.max(0,one.likeCount+(one.likedByMe?1:-1));paint();toast(x.message)}
      b._busy=false;return;
    }
    try{await api.mktLike(b.dataset.mlike);
      if(MKTVIEW==="detail"){const d=await api.mktOne(b.dataset.mlike);MKTONE=d.listing;MKTOFFERS=d.offers||[]}
      else await loadMarket();
      render()}catch(x){toast(x.message)}});

  const mq=$("#mktq");if(mq){let t=null;mq.oninput=()=>{MKTFILT.q=mq.value;clearTimeout(t);t=setTimeout(loadMarket,300)}}
  const fb=$("#mktfiltbtn");if(fb)fb.onclick=()=>{MKTFILTOPEN=!MKTFILTOPEN;render()};
  document.querySelectorAll("[data-cat]").forEach(b=>b.onclick=()=>{MKTFILT.category=b.dataset.cat||undefined;loadMarket().then(render)});
  document.querySelectorAll("[data-size]").forEach(b=>b.onclick=()=>{MKTFILT.size=b.dataset.size||undefined;loadMarket().then(render)});
  document.querySelectorAll("[data-mkind]").forEach(b=>b.onclick=()=>{
    MKTFILT.kind=b.dataset.mkind||undefined;
    if(MKTFILT.kind!=="loop")MKTFILT.free=undefined;
    MKTFILT.category=undefined;   // the two category sets don't overlap
    loadMarket().then(render)});
  const mf=$("[data-mfree]");if(mf)mf.onclick=()=>{MKTFILT.free=MKTFILT.free?undefined:"1";loadMarket().then(render)};
  document.querySelectorAll("[data-cond]").forEach(b=>b.onclick=()=>{MKTFILT.condition=b.dataset.cond||undefined;loadMarket().then(render)});
  document.querySelectorAll("[data-range]").forEach(b=>b.onclick=()=>{
    const v=b.dataset.range;MKTFILT.range=v||undefined;
    if(v){const [lo,hi]=v.split("-");MKTFILT.min=lo||undefined;MKTFILT.max=hi||undefined}
    else{MKTFILT.min=undefined;MKTFILT.max=undefined}
    loadMarket().then(render)});
  const cf=$("#clearfilt");if(cf)cf.onclick=()=>{MKTFILT={};loadMarket().then(render)};
  document.querySelectorAll("[data-sort]").forEach(b=>b.onclick=()=>{MKTFILT.sort=b.dataset.sort;loadMarket().then(render)});

  // sell form
  document.querySelectorAll("[data-kind]").forEach(b=>b.onclick=()=>{
    stashSell();
    SELLKIND=b.dataset.kind;
    // categories don't overlap between the two — drop a stale one
    if(SELLFORM)SELLFORM.category=undefined;
    render();
  });
  const aadd=$("#s-aadd");if(aadd)aadd.onclick=()=>$("#s-audio").click();
  const adrop=$("#s-adrop");if(adrop)adrop.onclick=()=>{SELLAUDIO=null;SELLAUDIONAME="";render()};
  const aprev=$("#s-aprev");if(aprev)aprev.onclick=async()=>{
    try{const a=new Audio(SELLAUDIO);a.play().catch(()=>{})}catch(e){}
  };
  const ain=$("#s-audio");if(ain)ain.onchange=async()=>{
    const f=ain.files&&ain.files[0];if(!f)return;ain.value="";
    if(f.size>20*1024*1024)return toast("That's too big — 20MB max for a loop");
    stashSell();
    SELLUP=true;render();
    try{
      const up=await uploadStream(f);
      if(up.kind!=="audio")throw new Error("That's not an audio file");
      SELLAUDIO=up.url;SELLAUDIONAME=f.name;
      // a filename like "dark trap 140.wav" is doing half the work already
      const m=/(\d{2,3})\s*bpm|\b(\d{2,3})\b/i.exec(f.name);
      if(m){const b=+(m[1]||m[2]);if(b>=60&&b<=220){SELLFORM=SELLFORM||{};SELLFORM.bpm=String(b)}}
      if(!SELLFORM||!SELLFORM.title){SELLFORM=SELLFORM||{};SELLFORM.title=f.name.replace(/\.[^.]+$/,"").slice(0,120)}
    }catch(e){toast(e.message)}
    SELLUP=false;render();
  };
  const add=$("#saddimg");if(add)add.onclick=()=>$("#sfile").click();
  const sf=$("#sfile");if(sf)sf.onchange=async()=>{
    const files=[...(sf.files||[])];sf.value="";if(!files.length)return;
    stashSell();SELLUP=true;render();
    for(const f of files){
      if(SELLIMGS.length>=8){toast("8 photos max");break}
      if(!f.type.startsWith("image/")){toast("Photos only");continue}
      if(f.size>30*1024*1024){toast("That photo's too big — 30MB max");continue}
      try{const data=await compressImage(f,1800,.88);
        const up=await uploadStream(dataUrlToBlob(data));
        SELLIMGS=[...SELLIMGS,up.url]}catch(e){toast(e.message)}
    }
    SELLUP=false;render();
  };
  /* Tap a photo to make it the cover (Shopify's drag-to-first, one tap). */
  /* Save as you type, so a background render (SSE, badges) can't wipe the form. */
  document.querySelectorAll(".pf input:not([type=file]),.pf textarea,.pf select").forEach(el=>{
    el.addEventListener("input",stashSell);el.addEventListener("change",stashSell)});
  document.querySelectorAll("[data-scover]").forEach(b=>b.onclick=()=>{const i=+b.dataset.scover;if(!i)return;
    stashSell();SELLIMGS=[SELLIMGS[i],...SELLIMGS.filter((_,k)=>k!==i)];render()});
  document.querySelectorAll("[data-qty]").forEach(b=>b.onclick=()=>{const q=$("#s-qty");if(!q)return;
    q.value=Math.min(500,Math.max(1,(parseInt(q.value,10)||1)+(+b.dataset.qty)))});
  const fsh=$("#s-freeship");if(fsh)fsh.onchange=()=>{const w=$("#s-shipwrap"),i=$("#s-ship");
    if(w)w.hidden=fsh.checked;if(fsh.checked&&i)i.value="";if(!fsh.checked&&i)setTimeout(()=>i.focus(),0)};
  const spr=$("#s-price");if(spr)spr.oninput=()=>{SELLFORM=SELLFORM||{};SELLFORM.price=spr.value;
    const e=$("#s-earn");if(e){e.innerHTML=sellEarnHTML();const rl=$("#rateladder");
      if(rl)rl.onclick=()=>{stashSell();CLIMB=true;CLIMBOPENRUNG=levelFor(ME.rep).id;render()}}};
  document.querySelectorAll("[data-sstat]").forEach(b=>b.onclick=()=>{stashSell();SELLFORM.status=b.dataset.sstat.toLowerCase();render()});
  document.querySelectorAll("[data-simgx]").forEach(b=>b.onclick=()=>{stashSell();SELLIMGS=SELLIMGS.filter((_,i)=>i!==+b.dataset.simgx);render()});
  document.querySelectorAll("[data-scat]").forEach(b=>b.onclick=()=>{stashSell();SELLFORM.category=b.dataset.scat;render()});
  document.querySelectorAll("[data-scond]").forEach(b=>b.onclick=()=>{stashSell();SELLFORM.condition=b.dataset.scond;render()});
  const sp=$("#s-post");if(sp)sp.onclick=async()=>{
      if(sp._busy)return;                        // one submit at a time — no double-listings
      stashSell();
      const isLoop=SELLKIND==="loop";
      if(!SELLFORM||!SELLFORM.title)return toast("Add a title");
      if(isLoop){
        if(!SELLAUDIO)return toast("Upload the audio first");
        const pr=Number(SELLFORM.price||0);
        if(pr!==0&&pr<1)return toast("Either free, or at least $1");
      }else{
        if(!SELLIMGS.length)return toast("Add at least one photo");
        if(!(Number(SELLFORM.price)>=1))return toast("Price must be at least $1");
        if(SELLFORM.hasVariants){
          const vs=(SELLFORM.variants||[]).filter(v=>v.size||v.colour);
          if(!vs.length)return toast("Add a size or colour");
          if(!vs.some(v=>v.qty>0))return toast("Add stock to at least one size");
        }
      }
      sp._busy=true;sp.disabled=true;sp.textContent=MKTEDIT?"Saving…":"Publishing…";
      try{
        const body={...SELLFORM,images:SELLIMGS,kind:isLoop?"loop":"physical"};
        body.variants=!isLoop&&SELLFORM.hasVariants?(SELLFORM.variants||[]):[];
        delete body.hasVariants;
        if(isLoop){
          body.audioUrl=SELLAUDIO;
          body.bpm=SELLFORM.bpm?Number(SELLFORM.bpm):null;
          body.musicalKey=SELLFORM.musicalKey||"";
          body.stems=!!SELLFORM.stems;
          body.price=Number(SELLFORM.price||0);
        }
        if(MKTEDIT){
          /* PATCH takes a flat body and ignores kind and audio — what the
             item IS gets settled at creation. Everything a seller can get
             wrong about it is fixable here. */
          const id=MKTEDIT;
          const eb={title:body.title,description:body.description||"",price:Number(body.price||0),
            images:SELLIMGS,category:body.category,acceptsOffers:body.acceptsOffers!==false};
          if(SELLFORM.status==="sold"||SELLFORM.status==="active")eb.status=SELLFORM.status;
          if(isLoop){eb.bpm=body.bpm;eb.musicalKey=body.musicalKey;eb.stems=body.stems}
          else{eb.shipping=Number(body.shipping||0);eb.quantity=Number(body.quantity||1);
            eb.brand=body.brand||"";eb.size=body.size||"";eb.condition=body.condition;
            eb.colour=body.colour||"";eb.shipsFrom=body.shipsFrom||"";eb.variants=body.variants}
          await api.mktUpdate(id,eb);
          MKTEDIT=null;SELLFORM=null;SELLIMGS=[];SELLAUDIO=null;SELLAUDIONAME="";
          MKTVIEW="detail";MKTONE=null;render();
          const one=await api.mktOne(id);
          MKTONE=one.listing;MKTOFFERS=one.offers||[];MKTSELLER=one.seller||null;MKTSIMILAR=one.similar||[];
          toast("Saved");render();return;
        }
        const d=await api.mktCreate(body);
        const free=isLoop&&Number(SELLFORM.price||0)===0;
        SELLFORM=null;SELLIMGS=[];SELLAUDIO=null;SELLAUDIONAME="";sdClear();
        MKTVIEW="detail";MKTONE=null;render();
        const one=await api.mktOne(d.id);
        MKTONE=one.listing;MKTOFFERS=one.offers||[];MKTSELLER=one.seller||null;MKTSIMILAR=one.similar||[];
        toast(free?"Published — free for anyone to grab":"Published");render();
      }catch(e){
        sp._busy=false;sp.disabled=false;sp.textContent=MKTEDIT?"Save":"Publish";
        if(/payout/i.test(e.message)&&SELLKIND==="loop")
          await uiAlert("Can't sell a paid loop yet",e.message+"\n\nSet the price to 0 and you can give it away right now — no setup needed.");
        else toast(e.message);
      }};

  // detail actions
  document.querySelectorAll("[data-offer]").forEach(b=>b.onclick=async()=>{
    if(guest())return needAccount("Join to make an offer.");
    const ask=MKTONE?MKTONE.price:0;
    const v=await uiPrompt("Make an offer",{body:"Asking "+money(ask),placeholder:"Your offer in $",type:"number",inputmode:"decimal"});if(!v)return;
    try{await api.mktOffer(b.dataset.offer,Number(v));toast("Offer sent");
      const d=await api.mktOne(b.dataset.offer);MKTONE=d.listing;MKTOFFERS=d.offers||[];render()}catch(e){toast(e.message)}});
  document.querySelectorAll("[data-oa]").forEach(b=>b.onclick=async()=>{
    const [id,a]=b.dataset.oa.split(":");
    try{await api.offerAct(id,a);toast(a==="accept"?"Offer accepted":"Offer declined");
      const d=await api.mktOne(MKTONE.id);MKTONE=d.listing;MKTOFFERS=d.offers||[];render()}catch(e){toast(e.message)}});
  const lp=$("#loopplay");
  if(lp)lp.onclick=()=>{
    const a=$("#loopaudio");if(!a)return;
    if(a.paused){a.play().then(()=>{lp.innerHTML=DI.stop}).catch(()=>toast("Couldn't play that"));
      a.onended=()=>{lp.innerHTML=DI.play};}
    else{a.pause();lp.innerHTML=DI.play}
  };
  const wg=$("#whograbbed");if(wg)wg.onclick=async()=>{
    try{const d=await api.loopGrabs(MKTONE.id);
      openPicker({eyebrow:"YOUR LOOP",title:"Who's grabbed it",
        note:"Every one of these is someone who might build with you. Message them.",
        items:d.downloads.map(u=>({label:u.displayName,sub:"@"+u.username+" · "+u.role+" · "+timeAgo(u.at),avatar:u.avatarUrl,username:u.username})),
        empty:"Nobody yet.",
        onPick:(it)=>openDM(it.username)});
    }catch(e){toast(e.message)}
  };
  document.querySelectorAll("[data-grab]").forEach(b=>b.onclick=async()=>{
    if(guest())return needAccount("Join to grab loops — the producer gets told who took it.");
    try{
      const d=await api.grabLoop(b.dataset.grab);
      const a=document.createElement("a");
      a.href=d.url;a.download=(d.name||"loop")+(d.url.match(/\.[a-z0-9]+$/i)||[""])[0];
      document.body.appendChild(a);a.click();document.body.removeChild(a);
      toast("Grabbed — "+(MKTONE?MKTONE.seller.displayName:"the producer")+" knows you took it");
      const one=await api.mktOne(b.dataset.grab);MKTONE=one.listing;render();
    }catch(e){toast(e.message)}});
  document.querySelectorAll("[data-buy]").forEach(b=>b.onclick=async()=>{
    if(b._busy)return;                          // one buy at a time — no double-orders
    if(guest())return needAccount("Join to buy — you'll need an account to track the order.");
    const st=MKTONE&&String(MKTONE.id)===b.dataset.buy?lvState(MKTONE):null;
    if(st&&st.need){toast("Pick a "+st.need+" first");
      const p=$("#lvpick");if(p){p.scrollIntoView({block:"center",behavior:mvReduced()?"auto":"smooth"});p.classList.remove("lv-nudge");void p.offsetWidth;p.classList.add("lv-nudge")}
      return}
    b._busy=true;b.disabled=true;
    try{const d=await api.mktBuy(b.dataset.buy,st&&st.match?{variant:st.match.id}:{});   // Stripe Checkout collects shipping — no prompts
      if(d.checkoutUrl){location.href=d.checkoutUrl;return}
      // arrange mode — be blunt, they have NOT paid
      await uiAlert("Reserved — no payment taken", d.sellerNotConnected
        ? "This seller hasn't set up card payments yet, so you'll need to pay them directly. Message them to sort it out."
        : "Card payments aren't switched on yet. Message the seller to settle up directly.");
      MKTVIEW="orders";ORDERS=await api.orders();ORDTAB="buying";render();
    }catch(e){
      b._busy=false;b.disabled=false;
      if(/hasn't finished setting up payments/i.test(e.message))
        await uiAlert("Can't buy this yet",e.message+"\n\nWe've told the seller. Nothing's been charged.");
      else toast(e.message);
    }});
  document.querySelectorAll("[data-mshare]").forEach(b=>b.onclick=async()=>{
    /* Listings have had a working /m/ deep link since the SPA learned to
       read it — this is the first button that hands the link out. */
    const url=location.origin+"/m/"+b.dataset.mshare;
    const title=MKTONE?MKTONE.title:"TNL Market";
    if(typeof navigator!=="undefined"&&navigator.share){
      try{await navigator.share({title,url})}catch(e){}
    }else{
      try{await navigator.clipboard.writeText(url);toast("Link copied")}catch(e){toast(url)}
    }});
  /* data-medit used to toggle sold while wearing a button labelled Edit —
     the loop detail page has said Edit since 047 and never edited anything.
     It opens the editor now; the sold/relist toggle moved to data-msold. */
  document.querySelectorAll("[data-msold]").forEach(b=>b.onclick=async()=>{
    const now=MKTONE.status==="sold"?"active":"sold";
    try{await api.mktUpdate(b.dataset.msold,{status:now});
      const d=await api.mktOne(b.dataset.msold);MKTONE=d.listing;MKTOFFERS=d.offers||[];toast("Updated");render()}catch(e){toast(e.message)}});
  document.querySelectorAll("[data-medit]").forEach(b=>b.onclick=()=>{
    const l=MKTONE;if(!l||String(l.id)!==b.dataset.medit)return;
    MKTEDIT=l.id;
    SELLKIND=l.kind==="loop"?"loop":"physical";
    SELLIMGS=[...(l.images||[])];
    SELLAUDIO=l.audioUrl||null;SELLAUDIONAME="";
    /* Cents on the wire, dollars in the box — the form posts dollars back. */
    SELLFORM={title:l.title,description:l.description||"",
      price:((l.price||0)/100).toFixed(2),
      shipping:l.shipping?(l.shipping/100).toFixed(2):"",
      quantity:l.quantity||1,category:l.category,condition:l.condition,
      brand:l.brand||"",size:l.size||"",colour:l.colour||"",shipsFrom:l.shipsFrom||"",
      acceptsOffers:l.acceptsOffers!==false,status:l.status==="sold"?"sold":"active",
      bpm:l.bpm||"",musicalKey:l.musicalKey||"",stems:!!l.stems,
      hasVariants:!!(l.variants||[]).length,variants:(l.variants||[]).map(v=>({...v}))};
    MKTVIEW="edit";render()});
  document.querySelectorAll("[data-mdel]").forEach(b=>b.onclick=async()=>{
    if(!(await uiConfirm("Delete this listing?","",{okLabel:"Delete",danger:true})))return;
    try{await api.mktDelete(b.dataset.mdel);toast("Deleted");MKTEDIT=null;SELLFORM=null;SELLIMGS=[];MKTVIEW="browse";await loadMarket();render()}catch(e){toast(e.message)}});
  document.querySelectorAll("[data-dmseller]").forEach(b=>b.onclick=()=>{
    if(guest())return needAccount("Message people directly. Most collabs start with a DM.");
    openDM(b.dataset.dmseller)});
  document.querySelectorAll("[data-ship]").forEach(b=>b.onclick=async()=>{
    const t=(await uiPrompt("Mark as shipped",{placeholder:"Tracking number (optional)"}))||"";
    try{await api.shipOrder(b.dataset.ship,t);ORDERS=await api.orders();toast("Marked shipped");render()}catch(e){toast(e.message)}});
  document.querySelectorAll("[data-review]").forEach(b=>b.onclick=()=>{
    const o=(ORDERS?.buying||[]).find(x=>String(x.id)===b.dataset.review);
    if(!o)return; REVIEWING=o; REVSTARS=5; pushView("review"); render();});
  const rvx=$("#revx");if(rvx)rvx.onclick=()=>{REVIEWING=null;render()};
  const rvbg=$("#revbg");if(rvbg)rvbg.onclick=e=>{if(e.target===rvbg){REVIEWING=null;render()}};
  document.querySelectorAll("[data-star]").forEach(b=>b.onclick=()=>{REVSTARS=+b.dataset.star;render()});
  const rvs=$("#revsend");if(rvs)rvs.onclick=async()=>{
    const body=$("#revbody")?.value||"";
    try{await api.review(REVIEWING.id,REVSTARS,body);
      REVIEWING=null;ORDERS=await api.orders();toast("Review posted — thanks");render();
    }catch(e){toast(e.message)}};
  document.querySelectorAll("[data-recv]").forEach(b=>b.onclick=async()=>{
    try{await api.received(b.dataset.recv);ORDERS=await api.orders();toast("Confirmed — thanks");render()}catch(e){toast(e.message)}});
}
function stashSell(){
  const bpmEl=$("#s-bpm"), keyEl=$("#s-key"), stEl=$("#s-stems");
  if(bpmEl||keyEl||stEl){
    SELLFORM=SELLFORM||{};
    if(bpmEl)SELLFORM.bpm=bpmEl.value;
    if(keyEl)SELLFORM.musicalKey=keyEl.value;
    if(stEl)SELLFORM.stems=stEl.checked;
  }
  SELLFORM=SELLFORM||{};
  const g=id=>$(id)?.value;
  if($("#s-title"))SELLFORM.title=g("#s-title");
  if($("#s-price"))SELLFORM.price=g("#s-price");
  if($("#s-ship"))SELLFORM.shipping=($("#s-freeship")&&$("#s-freeship").checked)?"":g("#s-ship");
  if($("#s-qty"))SELLFORM.quantity=g("#s-qty");
  if($("#s-brand"))SELLFORM.brand=g("#s-brand");
  if($("#s-size"))SELLFORM.size=g("#s-size");
  if($("#s-colour"))SELLFORM.colour=g("#s-colour");
  if($("#s-from"))SELLFORM.shipsFrom=g("#s-from");
  if($("#s-desc"))SELLFORM.description=g("#s-desc");
  if($("#s-offers"))SELLFORM.acceptsOffers=$("#s-offers").checked;
  pvStash();sdSave();
}
async function loadMarket(){
  const qs=new URLSearchParams();
  for(const [k,v] of Object.entries(MKTFILT))if(v)qs.set(k,v);
  /* Recently viewed arrives with the first grid, so nothing moves later. */
  const rec=ME&&!MKTRECENT?api.recentlyViewed().then(d=>d.listings).catch(()=>[]):null;
  try{const d=await api.mkt(qs.toString());MKT=d.listings;if(rec)MKTRECENT=await rec;
    const g=$("#mktgrid"),r=$("#mktrecent");
    if(g&&MKTVIEW==="browse"){g.innerHTML=MKT.length?MKT.map(mktCardHTML).join(""):`<div class="empty">Nothing matches.</div>`;
      if(r&&rec)r.innerHTML=recentHTML();wireMarket()}
  }catch(e){}
}

