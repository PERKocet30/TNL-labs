/* v2026-10-21: the intro film is gone; the Search head and field come from the screen kit */
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

/* dmPanelHTML → app-10-chat-2-dm.js (messaging v2) */
function searchPanelHTML(){return `<div class="sheet" id="sbg"><div class="sheetc">
  ${screenHead({back:{id:"sx",label:"Close"},title:"Search"})}
  ${searchHTML("sq","Name, username, or bio",SEARCHQ)}
  <div class="mono lbl">FILTER BY WHAT THEY MAKE</div>
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
  `:`<div class="empty">Search for people to make things with.</div>`}
</div></div>`}
/* Missing video, blocked playback, a stalled network — every one of those
   ends in done(), never in a locked screen. The 20s timer is the last resort. */
/* THE DOOR (2026-10-21: the intro film is gone). "Take the intro off —
   it was a nice homage to the community that helped build the app, but I
   need a professional app now." Every visit, first or hundredth, gets the
   same door: the mark, the button, one tap, straight in. The tap stays:
   it's the gesture that unlocks sound on iOS. tnl-intro-seen is still
   written — door.js reads it to pour the vial slowly once, then snap. */
function enterHTML(){
  return `<div class="enter quick" id="enterOv">
    <div class="enter-c" id="enterC">
      <img class="enter-m" src="/labs-wordmark.png" alt="LABS">
      <button class="enter-b" id="enterBtn">Enter the lab</button>
    </div>
  </div>`;
}

function wireEnter(){
  if(!ENTER)return;
  const ov=$("#enterOv"); if(!ov)return;
  let gone=false;
  const done=()=>{
    if(gone)return; gone=true;
    try{ localStorage.setItem("tnl-intro-seen","1"); sessionStorage.setItem("tnl-in","1") }catch(e){}
    ENTER=false; render();
  };
  /* Synchronous inside the gesture. An await here and iOS stops counting
     this as a tap, which is the whole reason the door exists. */
  const eb=$("#enterBtn"); if(eb)eb.onclick=()=>{ primeAudio(true); done(); };
}

function navHTML(){
  /* Identity gets the nav slot. The studio lives inside
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

