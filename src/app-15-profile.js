function workCardHTML(p, collab, K) {
  K = K || KIND;
  const accepted = p.collaborators.filter(c => c.status === "accepted");
  const kind = p.beat ? "BEAT" : p.videoUrl ? "VIDEO" : p.imageUrl ? "IMAGE" : "POST";
  /* A tile is an index, not the work. Image plus an indicator that there is more
     inside — author, sound, actions, caption and comments all belong to the
     expanded card the tile opens (021's overlay). Keeps the profile a scannable
     grid instead of a second feed. */
  const many = p.images && p.images.length > 1;
  return `<div class="work" data-openpost="${p.id}">
    ${p.beat ? `<div class="work-beat"><button class="circle" style="width:28px;height:28px;font-size:12px" data-beatplay='${esc(JSON.stringify(p.beat))}' aria-label="Play">${DI.play}</button><span class="nm">${esc(p.beat.name || "untitled loop")}</span><span class="mono dim">${p.beat.bpm}BPM</span></div>`
      : (many || p.imageUrl) ? `<img class="work-img" src="${esc(many ? (p.images[0].thumb || p.images[0].url) : (p.thumbUrl || p.imageUrl))}" alt="work" loading="lazy" decoding="async">`
      /* NOT a <video>. With preload="none" and no poster the element renders
         empty AND, on iOS, swallows the tap instead of letting it bubble to
         .work[data-openpost] — so the tile looked blank and could not be
         opened at all. A tile only ever needs to look like something and be
         tappable; the real player lives in the expanded post. Replace with a
         plain div until videos get real poster frames generated at upload. */
      : p.videoUrl ? `<div class="work-vid" aria-label="Video"></div>`
      : `<div class="work-body">${esc(p.body || "—")}</div>`}
    ${many ? `<span class="work-ind" aria-label="${p.images.length} photos">${DI.stack}</span>`
      : p.videoUrl ? `<span class="work-ind" aria-label="Video">${DI.video}</span>` : ""}
  </div>`;
}

function sheetHTML(){const u=PROFILE.user,l=levelFor(u.rep),nx=LEVELS.find(x=>x.at>u.rep);
  const pct=nx?Math.round((u.rep-l.at)/(nx.at-l.at)*100):100;
  const mine=u.username===myName();
  const st=PROFILE.stats||{posts:0,likesReceived:0,collabs:0};
  const list=PTAB==="collabs"?PROFILE.collabs:PROFILE.posts;

  if(EDITING&&mine){return `<div class="sheet" id="sheetbg"><div class="sheetc">
    <div class="sheeth"><div><h2>Your portfolio</h2></div><button class="x" id="sheetx" aria-label="Close"><svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="square" stroke-linejoin="miter" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg></button></div>
    <div class="avedit">
      ${u.avatarUrl?`<img class="pav" src="${esc(u.avatarUrl)}" alt="">`:`<div class="pav">${esc(u.displayName.slice(0,2).toUpperCase())}</div>`}
      <div><button class="btn ghost" id="avbtn">Change photo</button>
      <input type="file" id="avin" accept="image/*" hidden></div>
    </div>
    <label class="mono lbl">DISPLAY NAME</label><input class="in" id="ed-name" value="${esc(u.displayName)}" maxlength="40">
    <label class="mono lbl">WHAT YOU MAKE (UP TO 5)</label>
    <div class="roles">${ROLES.map(r=>`<button class="chip ${EDITROLES.includes(r)?"on":""}" data-er="${esc(r)}">${esc(r)}</button>`).join("")}</div>
    <label class="mono lbl">BIO</label><textarea class="in" id="ed-bio" rows="4" maxlength="300" placeholder="What you make, who you build with, what you're looking for.">${esc(u.bio)}</textarea>
    <label class="mono lbl">LINK</label><input class="in" id="ed-link" value="${esc(u.link)}" placeholder="instagram.com/yourhandle">
    <label class="mono lbl">APPEARANCE</label>
    <div class="pig-theme">
      <button class="pig-th ${THEME==="dark"?"on":""}" data-theme-set="dark">Night</button>
      <button class="pig-th ${THEME==="light"?"on":""}" data-theme-set="light">Day</button>
    </div>
    <label class="mono lbl">YOUR COLOUR</label>
    <div class="mono dim" style="margin:-2px 0 8px;line-height:1.5">The accent is yours — it themes your app and your profile, day or night.</div>
    <div class="swatches">${Object.entries(ACCENTS).map(([k,a])=>`
      <button class="swatch ${(EDITACCENT||u.accent||"lab")===k?"on":""}" data-accent="${esc(k)}" title="${esc(a.name)}">
        <span style="background:${esc(a.hex)}"></span><i class="mono">${esc(a.name)}</i>
      </button>`).join("")}</div>
    <button class="btn wide" id="ed-save">Save</button>
    <button class="link" id="ed-cancel">Cancel</button>
  </div></div>`}

  const K=kindOf(u);
  const acc=inkFor(u.accentHex||"#98FC68");   // never bypass the theme correction
  /* PROFILE is a nav tab, so on that tab it renders as a page, not a modal
     you escape from. The sheet is kept for what it was built for: peeking at
     someone from a feed without leaving where you are. */
  /* Corrected in 032: TAB is never set to "profile" — the nav button calls
     openProfile(myName()) and leaves TAB alone, so the old test was always
     false. Your own profile is the page; anyone else's stays a peek. */
  const astab = mine;
  return `<div class="sheet ${astab?"astab":""}" id="sheetbg"><div class="sheetc pig" style="--green:${acc}">
  <div class="sheeth pig-top"><div class="pig-user">${esc(u.username)}</div>
    <div class="pig-topr">${mine&&!PROFILE.loading?`<button class="pig-plus" id="profpost" aria-label="New post">${UI_IC.plusSq}</button>`:""}<button class="x" id="sheetx" aria-label="Close"><svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="square" stroke-linejoin="miter" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg></button></div></div>

  <div class="pig-head">
    ${u.avatarUrl?`<img class="pav pig-av" src="${esc(u.avatarUrl)}" alt="">`:`<div class="pav pig-av">${esc(u.displayName.slice(0,2).toUpperCase())}</div>`}
    <div class="pstats pig-stats ${PROFILE.loading?"sk":""}">
      <div class="pstat"><b>${PROFILE.loading?"—":st.posts}</b><span>${esc(K.work.toLowerCase())}</span></div>
      <div class="pstat"><b>${PROFILE.loading?"—":PROFILE.followers}</b><span>followers</span></div>
      <div class="pstat"><b>${PROFILE.loading?"—":st.collabs}</b><span>collabs</span></div>
    </div>
  </div>

  <div class="pig-name"><span class="pname">${esc(u.displayName)}</span><span class="pig-lvl" title="${esc(l.name)}">L${l.id}</span></div>
  <div class="pig-cat">${(u.roles&&u.roles.length?u.roles:[u.role]).filter(Boolean).map(r=>esc(r)).join(" · ")}</div>
  ${u.bio?`<div class="pbio">${esc(u.bio)}</div>`:mine?`<div class="pbio dim">No bio yet — tell people what you make.</div>`:""}
  ${u.link?`<a class="plink" href="${/^https?:\/\//.test(u.link)?esc(u.link):"https://"+esc(u.link)}" target="_blank" rel="noreferrer">${UI_IC.link}${esc(u.link.replace(/^https?:\/\//,""))}</a>`:""}

  <div class="pactions">
    ${PROFILE.loading?`<div class="skelbtn"></div>`:mine?`<button class="btn ghost" id="editb">Edit profile</button>
      <button class="btn ghost" id="shareprof" data-share-u="${esc(u.username)}">Share profile</button>`
      :`<button class="btn ${PROFILE.youFollow?"ghost":"green"}" id="followb">${PROFILE.youFollow?"Following":"Follow"}</button>
        <button class="btn ghost" id="msgb">Message</button>`}
  </div>

  <button class="plvl" data-ptab="ladder" aria-label="Standing">
    <div class="plr"><span class="pbadge">L${l.id}</span><span class="plname">${esc(l.name)}</span>
      <span class="plmeta">${u.rep} rep${nx?` · ${nx.at-u.rep} to ${esc(nx.name)}`:" · top level"}</span></div>
    <div class="ptrack"><div class="pfill" style="width:${pct}%"></div></div>
  </button>
  ${!mine?`<div class="modrow"><button class="modlink" id="blockb">Block</button><button class="modlink" id="reportu">Report</button></div>`:""}

  <div class="ptabs" role="tablist">
    <button class="ptab ${PTAB==="work"?"on":""}" data-ptab="work" role="tab" aria-selected="${PTAB==="work"}" aria-label="${esc(K.work.charAt(0)+K.work.slice(1).toLowerCase())} ${st.posts}">${UI_IC.tabGrid}</button>
    <button class="ptab ${PTAB==="shop"?"on":""}" data-ptab="shop" role="tab" aria-selected="${PTAB==="shop"}" aria-label="Shop">${UI_IC.tabShop}</button>
    <button class="ptab ${PTAB==="collabs"?"on":""}" data-ptab="collabs" role="tab" aria-selected="${PTAB==="collabs"}" aria-label="Collabs ${PROFILE.collabs.length}">${UI_IC.tabCollab}</button>
    <button class="ptab ${PTAB==="ladder"?"on":""}" data-ptab="ladder" role="tab" aria-selected="${PTAB==="ladder"}" aria-label="Standing">${UI_IC.tabStanding}</button>
  </div>

  ${PTAB==="shop"?`<div class="mkt-grid" style="padding:14px 0 30px">${PROFLISTINGS===null?`<div class="empty">Loading…</div>`:PROFLISTINGS.length?PROFLISTINGS.map(mktCardHTML).join(""):`<div class="empty">${mine?"Nothing listed yet. Head to Market \u2192 Sell to put something up.":"Not selling anything right now."}</div>`}</div>`
  :PTAB==="ladder"?`
    <div class="mono dim" style="margin:12px 0">REP IS EARNED, NOT SPENT — LIKES +6 · SHARES +3 · COLLABS +20 EACH · SALES +15 · DELIVERED +10</div>
    <div class="mono dim" style="margin:-4px 0 12px;line-height:1.6">Every point comes from someone else acting. Nothing you can do alone moves it.</div>
    <div class="ladder">${LEVELS.map(x=>`<div class="lstep ${u.rep>=x.at?"done":""}"><span class="ldot"></span><span class="mono">${x.at}</span><span>${x.name}</span>${u.rep>=x.at?DI.check:""}</div>`).join("")}</div>
    <div class="mono dim" style="margin-top:14px">MEMBER SINCE ${new Date(u.createdAt).toLocaleDateString()}</div>
    ${mine?`<button class="btn ghost" id="climbfromprof" style="width:100%;margin-top:14px">See the full climb — what each level pays →</button>`:""}`
  :PROFILE.loading?`<div class="worklist">${[0,1,2].map(()=>`<div class="work skel"><div class="skelbar"></div><div class="skelbar sh"></div></div>`).join("")}</div>`
  :list.length?`<div class="worklist ${K.grid?"asgrid":""}">${list.map(p=>workCardHTML(p,PTAB==="collabs",K)).join("")}</div>`
  :`<div class="empty">${PTAB==="collabs"?"No confirmed collabs yet. Invite someone onto a "+K.one+" — you both rise.":mine?K.empty+" Hit + Post and it lands here.":esc(K.empty)}</div>`}

  ${mine&&ME.isAdmin?`<a class="btn ghost" href="/admin" style="display:flex;justify-content:center;margin-top:16px;text-decoration:none">Admin dashboard ${DI.out}</a>`:""}
  ${mine?`<button class="link" id="logoutb">Log out</button>`:""}
</div></div>`}

/* ---- wiring ---- */
