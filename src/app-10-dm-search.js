function wirePicker(){
  const bg=$("#pickbg");if(!bg)return;
  bg.onclick=e=>{if(e.target===bg)closePicker()};
  const x=$("#pickx");if(x)x.onclick=closePicker;
  document.querySelectorAll("[data-pick]").forEach(b=>b.onclick=()=>{
    const it=PICKER.items[+b.dataset.pick];
    const fn=PICKER.onPick;
    closePicker();
    if(fn)fn(it);
  });
  const q=$("#pickq");
  if(q){
    q.focus();
    let t=null;
    q.oninput=()=>{
      PICKER.q=q.value;
      if(!PICKER.onSearch)return;
      clearTimeout(t);
      t=setTimeout(async()=>{
        const mine=PICKER.q;
        PICKER.loading=true;render();
        const items=await PICKER.onSearch(mine);
        if(!PICKER||PICKER.q!==mine)return;
        PICKER.items=items;PICKER.loading=false;render();
      },200);
    };
  }
}

function timeAgo(t){const s=(Date.now()-t)/1000;
  if(s<60)return "JUST NOW";if(s<3600)return Math.floor(s/60)+"M AGO";
  if(s<86400)return Math.floor(s/3600)+"H AGO";if(s<604800)return Math.floor(s/86400)+"D AGO";
  return new Date(t).toLocaleDateString().toUpperCase()}

function dmPanelHTML(){
  if(DMOPEN&&DMDATA){const o=DMDATA.other;
    return `<div class="sheet" id="dmbg"><div class="sheetc dmc">
      <div class="sheeth"><button class="x" id="dmback" aria-label="Back"><svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="square" stroke-linejoin="miter" aria-hidden="true"><path d="M15 5l-7 7 7 7"/></svg></button>
        <div style="flex:1;display:flex;align-items:center;gap:9px;cursor:pointer" data-u="${esc(o.username)}">
          ${avHTML(o,"sm")}<div><div style="font-weight:900;font-size:14px">${esc(o.displayName)}</div>
          <div class="mono dim">@${esc(o.username)} · L${o.level}</div></div></div>
        <button class="x" id="dmx" aria-label="Close"><svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="square" stroke-linejoin="miter" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg></button></div>
      <div class="dmfeed" id="dmfeed">
        ${DMDATA.messages.length?DMDATA.messages.map(m=>`<div class="dmm ${m.mine?"mine":""}">
          ${m.imageUrl?`<img class="dmimg" src="${esc(m.imageUrl)}" data-zoom="${esc(m.imageUrl)}">`:""}
          ${m.body?`<div class="dmb">${rich(m.body)}</div>`:""}
          <div class="mono dim dmt">${new Date(m.createdAt).toLocaleTimeString([],{hour:"numeric",minute:"2-digit"})}</div>
        </div>`).join(""):`<div class="empty">No messages yet. Say something.</div>`}
      </div>
      <div class="composer">
        <input type="file" id="dmfile" accept="image/*" hidden>
        <button class="attach" id="dmattach">+</button>
        <input class="in" id="dmdraft" placeholder="Message ${esc(o.displayName)}">
        <button class="send" id="dmsend" aria-label="Send">${UI_IC.arrow}</button>
      </div>
    </div></div>`}
  return `<div class="sheet" id="dmbg"><div class="sheetc">
    <div class="sheeth"><div><h2>Messages</h2></div><button class="x" id="dmx" aria-label="Close"><svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="square" stroke-linejoin="miter" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg></button></div>
    ${!DMS?`<div class="empty">Loading…</div>`:!DMS.length?`<div class="empty">No conversations yet.<br>Open someone's profile and hit Message.</div>`:
      DMS.map(t=>`<div class="nrow" data-dm="${esc(t.other.username)}">
        ${avHTML(t.other,"sm")}
        <div class="nbody"><b>${esc(t.other.displayName)}</b>
        <div class="nsnip">${t.last?`${t.last.mine?"You: ":""}${esc(t.last.body||"")}`:"No messages"}</div></div>
        ${t.unread?`<span class="cbadge">${t.unread}</span>`:""}
      </div>`).join("")}
  </div></div>`}

function searchPanelHTML(){return `<div class="sheet" id="sbg"><div class="sheetc">
  <div class="sheeth"><div><h2>Search</h2></div><button class="x" id="sx" aria-label="Close"><svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="square" stroke-linejoin="miter" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg></button></div>
  <input class="in" id="sq" placeholder="Name, username, or bio" value="${esc(SEARCHQ)}">
  <div class="mono lbl">FILTER BY ROLE</div>
  <div class="roles">${ROLES.slice(0,12).map(r=>`<button class="chip ${SEARCHROLE===r?"on":""}" data-sr="${esc(r)}">${esc(r)}</button>`).join("")}</div>
  ${SEARCHING?`<div class="empty">Searching…</div>`:SEARCHRES?`
    ${SEARCHRES.people.length?`<div class="mono dim" style="margin:16px 0 8px">PEOPLE</div>
      ${SEARCHRES.people.map(u=>`<div class="nrow" data-u="${esc(u.username)}">
        ${avHTML(u,"sm")}<div class="nbody"><b>${esc(u.displayName)}</b>
        <div class="mono dim">@${esc(u.username)} · L${u.level}</div>
        ${u.roles.length?`<div class="nsnip">${u.roles.map(esc).join(" · ")}</div>`:""}</div></div>`).join("")}`:""}
    ${SEARCHRES.posts.length?`<div class="mono dim" style="margin:16px 0 8px">POSTS</div>
      <div class="worklist">${SEARCHRES.posts.map(p=>workCardHTML(p,false)).join("")}</div>`:""}
    ${!SEARCHRES.people.length&&!SEARCHRES.posts.length?`<div class="empty">Nothing found.</div>`:""}
  `:`<div class="empty">Search for people to build with.</div>`}
</div></div>`}
/* Missing video, blocked playback, a stalled network — every one of those
   ends in done(), never in a locked screen. The 20s timer is the last resort. */
function enterHTML(){
  const mark = (document.querySelector(".mark")||{}).src || "";
  /* First visit gets the film. Every visit after that gets the same door
     with no video behind it: the mark, the button, one tap, straight in.
     wireEnter already treats a missing video as "nothing to wait for" and
     goes on the tap, so omitting the element IS the fast path. */
  let seen=false; try{ seen = !!localStorage.getItem("tnl-intro-seen") }catch(e){}
  return `<div class="enter${seen?" quick":""}" id="enterOv">
    ${seen?"":`<video class="enter-v" id="enterVid" playsinline preload="metadata"
      poster="/tnl-enter-poster.jpg" src="/tnl-enter.mp4"></video>`}
    <div class="enter-c" id="enterC">
      ${mark?`<img class="enter-m" src="${mark}" alt="TNL">`:""}
      <button class="enter-b" id="enterBtn">Enter the lab</button>
    </div>
    ${seen?"":`<button class="enter-s" id="enterSkip" style="position:absolute;right:14px;bottom:18px;z-index:2">SKIP</button>`}
  </div>`;
}

function wireEnter(){
  if(!ENTER)return;
  const ov=$("#enterOv"); if(!ov)return;
  const v=$("#enterVid"), c=$("#enterC");
  let gone=false, started=false;
  const done=()=>{
    if(gone)return; gone=true;
    /* localStorage, not sessionStorage: the film is a once-per-device
       moment, while the door itself returns every load to carry the tap. */
    try{ localStorage.setItem("tnl-intro-seen","1") }catch(e){}
    ENTER=false; render();
  };
  const go=()=>{
    /* Synchronous inside the gesture. An await here and iOS stops counting
       this as a tap, which is the whole reason the door exists. */
    /* Synchronous inside the gesture — one shared unlock, no second copy to
       drift. skipWire: done() -> render() wires the observer once the
       overlay is gone, so nothing autoplays behind the intro. */
    primeAudio(true);
    if(v){
      v.muted=false;
      const p=v.play();
      if(p&&p.catch)p.catch(done);
      if(c)c.style.display="none";
    } else done();
    started=true;
  };
  const eb=$("#enterBtn"); if(eb)eb.onclick=go;
  /* 073 removed SKIP from the repeat-visit door but left this wiring
     unconditional — $("#enterSkip") was null on every visit after the
     first, and the resulting TypeError killed the whole boot. Both
     lookups are guarded now; a door element that isn't rendered is a
     door element that doesn't get wired. */
  const es=$("#enterSkip"); if(es)es.onclick=done;
  /* Before ENTER is pressed these must NOT dismiss. preload="metadata" fetches
     the file the moment this renders, so a video that is missing or slow fired
     onerror instantly and closed the door before anyone could touch it. Until
     the tap, a broken video just hides itself and the button stands. */
  if(v){
    v.onerror=()=>{ if(started)done(); else v.style.display="none"; };
    v.onstalled=()=>{ if(started)done(); };
    v.onended=done;
  }
  setTimeout(()=>{ if(started)done(); },20000);
}

function navHTML(){
  /* Instagram's frame: identity gets the nav slot. The studio lives inside
     the music lab now (and every ↻ Remix still jumps straight into it). */
  /* The nav speaks the same language as the lab list: geometric marks, not
     outline icons. LAB_ID already uses ◉ ⌗ ▣ ♠ Λ, so the bottom bar matching them
     makes the chrome read as one system — and it retires the mixed 1.8/1.9/2.0
     stroke weights that made these look borrowed. */
  const t=[["showroom",UI_IC.navShowroom,"Showroom"],["labs",UI_IC.navLabs,"Labs"],["post",UI_IC.navPost,"Post"]];
  if(SITE.marketOpen!==false)t.push(["market",UI_IC.navMarket,"Market"]);
  t.push(["profile",UI_IC.navProfile,"Profile"]);
  const myOpen=PROFILE&&ME&&PROFILE.user&&PROFILE.user.username===ME.username;
  return `<nav class="nav">${t.map(([id,ic,lb])=>
    `<button class="navb ${id==="post"?(PCOMPOSE?"on":""):id==="profile"?(myOpen&&!PCOMPOSE?"on":""):(TAB===id&&!PROFILE&&!PCOMPOSE?"on":"")}" data-tab="${id}" aria-label="${lb}"><i class="ic">${ic}</i></button>`).join("")}</nav>`}

