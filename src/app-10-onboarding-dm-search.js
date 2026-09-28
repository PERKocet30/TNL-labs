/* ── ONBOARDING ──────────────────────────────────────────────────
   Three screens, one minute, then out of the way forever. The goal is a
   member who knows the one rule (rep is earned) and has a face. */
function onboardHTML(){
  const dots=`<div class="onb-dots">${[1,2,3].map(i=>`<span class="${ONBOARD===i?"on":""}"></span>`).join("")}</div>`;
  if(ONBOARD===1)return `<div class="ui-ov"><div class="ui-card">
    <div class="mono dim" style="letter-spacing:.02em">WELCOME TO</div>
    <div class="ui-title" style="font-size:26px;margin-top:4px">LABS 🧪</div>
    <div class="ui-body">A workshop, not a feed.
Post the half-finished version — this is where it gets finished.
Work made together rises. That's the algorithm.
Rep is earned, not spent. Nothing here is for sale but the work.</div>
    ${dots}<div class="ui-btns"><button class="ui-btn ui-ok" data-onb="2">Next</button></div>
  </div></div>`;
  if(ONBOARD===2)return `<div class="ui-ov"><div class="ui-card">
    <div class="ui-title">Make it yours</div>
    <div class="ui-body">A face and a line — so when your work travels, people know whose it is.</div>
    <div style="display:flex;align-items:center;gap:14px;margin-top:14px">
      ${avHTML(ME,"")}<button class="btn ghost" id="onbavb">Add a photo</button>
      <input type="file" id="onbav" accept="image/*" hidden>
    </div>
    <input class="ui-in" id="onbbio" placeholder="What do you make? One line." value="${esc(ME&&ME.bio||"")}">
    ${dots}<div class="ui-btns">
      <button class="ui-btn ui-cancel" data-onb="3">Skip</button>
      <button class="ui-btn ui-ok" id="onbsave">Save &amp; continue</button>
    </div>
  </div></div>`;
  return `<div class="ui-ov"><div class="ui-card">
    <div class="ui-title">How you rise</div>
    <div class="ui-body">Standing moves only when others act on your work:
likes +6 · shares +3 · collabs +20 · sales +15 · delivered +10.
As you climb L1→L5, rooms unlock and your cut when you sell grows from 90% to 98%.</div>
    ${dots}<div class="ui-btns"><button class="ui-btn ui-ok" id="onbdone">Enter the Showroom</button></div>
  </div></div>`;
}
function wireOnboard(){
  document.querySelectorAll("[data-onb]").forEach(b=>b.onclick=()=>{ONBOARD=+b.dataset.onb;render()});
  const avb=$("#onbavb"),avf=$("#onbav");
  if(avb&&avf){avb.onclick=()=>avf.click();
    avf.onchange=async()=>{const file=avf.files[0];if(!file)return;
      try{const data=await compressImage(file,500,.85);const d=await api.avatar(data);ME.avatarUrl=d.avatarUrl||d.url||ME.avatarUrl;render()}
      catch(e){toast(e.message)}};}
  const sv=$("#onbsave");if(sv)sv.onclick=async()=>{
    const bio=($("#onbbio")||{}).value||"";
    try{if(bio.trim()&&bio!==(ME.bio||"")){await api.updateMe({bio:bio.trim()});ME.bio=bio.trim()}}catch(e){}
    ONBOARD=3;render();
  };
  document.querySelectorAll("[data-theme-set]").forEach(b=>b.onclick=()=>{setTheme(b.dataset.themeSet);render()});
  const dn=$("#onbdone");if(dn)dn.onclick=()=>{ONBOARD=0;TAB="showroom";render();setTimeout(maybeOfferInstall,600)};
}

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

function gateHTML(){return `
<div class="gate"><div class="gatecard" id="gate">
  <div class="gatetop">
    <div class="brand"><img class="mark" src="data:image/png;base64,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" alt="TNL"><span class="bt">LABS</span> <span class="fl">🧪</span></div>
    <button class="x" id="gatex" title="Keep looking around" aria-label="Close"><svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="square" stroke-linejoin="miter" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg></button>
  </div>
  ${GATEWHY?`<div class="gatewhy">${esc(GATEWHY)}</div>`:""}
  <div id="gatebody"></div>
</div></div>`}
