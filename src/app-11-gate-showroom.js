function wireGate(){
  const gx=$("#gatex");if(gx)gx.onclick=()=>{GATE=null;GATEWHY="";render()};
  let mode=GATE==="login"?"login":"register",step=1,f={displayName:"",username:"",email:"",password:"",roles:[]},err="";
  const body=()=>$("#gatebody");
  function draw(){
    if(mode==="forgot"){body().innerHTML=`
      <h1>Reset password.</h1><p>We'll email you a link. It works for one hour.</p>
      <label class="mono lbl">EMAIL</label><input class="in" id="fe" type="email" placeholder="you@example.com">
      ${err?`<div class="err">${esc(err)}</div>`:""}
      <button class="btn wide" id="fgo">Send reset link</button>
      <p style="margin-top:14px;font-size:12px" class="dim"><span class="switch" id="fb">← Back to login</span></p>`;
      $("#fb").onclick=()=>{mode="login";err="";draw()};
      $("#fgo").onclick=async()=>{
        const em=$("#fe").value.trim();
        if(!/^\S+@\S+\.\S+$/.test(em)){err="Enter a valid email.";return draw()}
        try{const d=await api.forgot(em);
          if(d.resetUrl){body().innerHTML=`<h1>Mail not set up.</h1><p>Email isn't configured yet, so here's your link:</p>
            <a class="btn wide" style="text-decoration:none" href="${esc(d.resetUrl)}">Set new password</a>`;}
          else body().innerHTML=`<h1>Check your email.</h1><p>If that address has an account, a reset link is on the way.</p>`;
        }catch(e){err=e.message;draw()}};
      return}
    if(mode==="login"){body().innerHTML=`
      <h1>Log in.</h1><p>Back to the lab.</p>
      <label class="mono lbl">USERNAME OR EMAIL</label><input class="in" id="u" value="${esc(f.username)}" autocomplete="username" autocapitalize="none" autocorrect="off" spellcheck="false" inputmode="email">
      <label class="mono lbl">PASSWORD</label><input class="in" id="p" type="password" autocomplete="current-password">
      ${err?`<div class="err">${esc(err)}</div>`:""}
      <button class="btn wide" id="go">Enter</button>
      <p style="margin-top:12px;font-size:12px" class="dim"><span class="switch" id="fp">Forgot password?</span></p>
      <p style="margin-top:8px;font-size:12px" class="dim">New here? <span class="switch" id="sw">Create an account</span></p>`;
      $("#fp").onclick=()=>{mode="forgot";err="";draw()};
      $("#go").onclick=async()=>{try{const d=await api.login({identifier:$("#u").value.trim(),username:$("#u").value.trim().toLowerCase(),password:$("#p").value});
        TOKEN=d.token;localStorage.setItem("tnl-token",TOKEN);ME=d.user;GATE=null;GATEWHY="";
        applyAccent(ME.accentHex);startStream();refreshBadges();loadUnreads();render()}catch(e){err=e.message;draw()}};
      $("#sw").onclick=()=>{mode="register";step=1;err="";draw()};
      return}
    if(step===1){body().innerHTML=`
      <h1>Join the workshop.</h1><p>One account across every lab. Your work, your collaborators, and the standing you build — all in one place.</p>
      <label class="mono lbl">DISPLAY NAME</label><input class="in" id="dn" value="${esc(f.displayName)}" maxlength="28">
      <label class="mono lbl">USERNAME</label><input class="in" id="un" value="${esc(f.username)}" maxlength="20" placeholder="lowercase, unique">
      <label class="mono lbl">EMAIL</label><input class="in" id="em" value="${esc(f.email)}" type="email">
      <label class="mono lbl">PASSWORD</label><input class="in" id="pw" type="password" placeholder="6+ characters">
      ${err?`<div class="err">${esc(err)}</div>`:""}
      <button class="btn wide" id="next">Continue</button>
      <p style="margin-top:14px;font-size:12px" class="dim">Already in? <span class="switch" id="sw">Log in</span></p>`;
      $("#next").onclick=()=>{f.displayName=$("#dn").value;f.username=$("#un").value.toLowerCase();f.email=$("#em").value;f.password=$("#pw").value;
        if(!f.displayName.trim()){err="Add a display name.";return draw()}
        if(!/^[a-z0-9._]{2,20}$/.test(f.username)){err="Username: 2–20 chars, lowercase, numbers, . or _";return draw()}
        if(!/^\S+@\S+\.\S+$/.test(f.email)){err="Enter a valid email.";return draw()}
        if((f.password||"").length<6){err="Password: 6+ characters.";return draw()}
        err="";step=2;draw()};
      $("#sw").onclick=()=>{mode="login";err="";draw()};
      return}
    body().innerHTML=`
      <h1>What do you make?</h1><p>Pick everything that fits — most people here do more than one thing. This is how collaborators find you.</p>
      <div class="roles">${ROLES.map(r=>`<button class="chip ${f.roles.includes(r)?"on":""}" data-r="${esc(r)}">${esc(r)}</button>`).join("")}</div>
      ${f.roles.length?`<div class="mono dim" style="margin-top:10px">${f.roles.length} SELECTED</div>`:""}
      ${err?`<div class="err">${esc(err)}</div>`:""}
      <button class="btn wide" id="fin">Enter the Lab ↗</button>
      <button class="link" id="bk">← Back</button>`;
    document.querySelectorAll("[data-r]").forEach(b=>b.onclick=()=>{
      const r=b.dataset.r;
      if(f.roles.includes(r))f.roles=f.roles.filter(x=>x!==r);
      else if(f.roles.length<5)f.roles=[...f.roles,r];
      else{err="Up to 5 roles.";}
      err=f.roles.length?"":err;draw()});
    $("#bk").onclick=()=>{step=1;draw()};
    $("#fin").onclick=async()=>{if(!f.roles.length){err="Pick at least one.";return draw()}
      try{const d=await api.register({...f,roles:f.roles});TOKEN=d.token;localStorage.setItem("tnl-token",TOKEN);ME=d.user;
        if(d.verifyUrl)VERIFYURL=d.verifyUrl;
        GATE=null;GATEWHY="";ONBOARD=1;
        startStream();refreshBadges();render();
        toast(d.mailSent?"Check your email to confirm":"You're in");
      }catch(e){
        /* Once GATE=null and render() ran, #gatebody is gone. The old catch
           called draw() anyway, died on body().innerHTML of null, and buried
           whatever actually threw. If the gate's gone, surface the truth. */
        if(!body()){try{toast("Something broke — reload the page")}catch{}throw e}
        err=e.message;draw()}};
  }
  draw();
}

function showroomHTML(){return `<div class="scroll" id="showroom">
  ${guest()?`<section class="whatis"><p class="wi-tag">Social media by creatives, for creatives.</p></section>`:""}

  <div class="sr-builders" id="sr-builders"></div>

  <div class="sr-grid" id="sr-grid">${SRPOSTS.length?SRPOSTS.map(srCardHTML).join(""):`<div class="empty">Loading the work…</div>`}</div>
</div>`}

function srCardHTML(p){
  const accepted=p.collaborators.filter(c=>c.status==="accepted");
  return `<div class="sr-card">
    <div class="sr-head">
      <div class="sr-who" data-u="${esc(p.author.username)}">
        ${avHTML(p.author,"sm")}
        <div><div class="sr-name">${esc(p.author.displayName)}<span class="lvl">L${p.author.level}</span></div>
        <div class="dim sr-role">${esc(p.author.role.charAt(0).toUpperCase()+p.author.role.slice(1))}</div>${musChipHTML(p)}</div>
      </div>
    </div>
    ${(p.images&&p.images.length>1)?`<div class="caro" data-caro="s${p.id}">
      <div class="caro-t">${p.images.map(im=>`<img class="caro-i" src="${esc(im.thumb||im.url)}" data-u="${esc(p.author.username)}" alt="" loading="lazy" decoding="async">`).join("")}</div>
      <div class="caro-d">${p.images.map((_,i)=>`<span class="${i===0?"on":""}"></span>`).join("")}</div>
      <span class="caro-n mono">1/${p.images.length}</span>
    </div>`
    :p.imageUrl?`<img class="sr-img" src="${esc(p.thumbUrl||p.imageUrl)}" alt="work by ${esc(p.author.displayName)}" loading="lazy" decoding="async"
      ${p.mediaW?`width="${p.mediaW}" height="${p.mediaH}" style="aspect-ratio:${p.mediaW}/${p.mediaH}"`:""}
      data-u="${esc(p.author.username)}">`
      :p.videoUrl?`<div class="vwrap">
        <video class="sr-img" src="${esc(p.videoUrl)}" muted loop playsinline preload="none" data-auto></video>
        <button class="vmute" data-vmute aria-label="Sound">🔇</button>
      </div>`
      :`<div class="sr-beat"><button class="circle" style="width:34px;height:34px;font-size:12px" data-beatplay='${esc(JSON.stringify(p.beat))}'>▶︎</button>
         <div><div class="sr-beatname">${esc(p.beat?.name||"untitled loop")}</div><div class="mono dim">${p.beat?.bpm||120} BPM${p.beat?.remixOf?` · from @${esc(p.beat.remixOf.username||"?")}`:" · LOOP"}</div></div><button class="act" data-remix="${p.id}" style="margin-left:auto">${IC_REMIX_SM} Remix</button></div>`}
    <div class="sr-meta">
      <div class="sr-acts">
        <button class="igact ${p.likedByMe?"on":""}" data-like="${p.id}" aria-label="Like">${IG_HEART}<span class="igact-n">${p.likeCount||""}</span></button>
        <button class="igact" data-comments="${p.id}" aria-label="Comment">${IG_COMMENT}</button>
        <button class="igact" data-share="${p.id}" aria-label="Send">${IG_SEND}<span class="igact-n">${p.shareCount||""}</span></button>
        ${p.author.username===myName()?`<button class="igact" data-collab="${p.id}" aria-label="Invite a collaborator" title="Invite a collaborator">${IG_COLLAB}</button>`:""}
        ${p.collaborators.find(c=>c.username===myName()&&c.status==="pending")?`<button class="igpill" data-accept="${p.id}">Accept collab</button>`:""}
      </div>
      ${accepted.length?`<div class="sr-collab">${IG_COLLAB_SM} Built with ${accepted.map(c=>esc(c.display_name||c.username)).join(" + ")}</div>`:""}
      ${p.body?`<div class="sr-body"><b>${esc(p.author.username)}</b> ${rich(p.body)}</div>`:""}
      ${p.commentCount&&OPENCOMMENTS!==p.id?`<button class="ig-viewc" data-comments="${p.id}">View all ${p.commentCount} comment${p.commentCount==1?"":"s"}</button>`:""}
      ${OPENCOMMENTS===p.id?commentsHTML(p):""}
    </div>
  </div>`}

async function loadShowroom(force){
  if(!force && SRAT && Date.now()-SRAT<8000 && SRPOSTS.length) return; // grid paints from cache
  SRAT=Date.now();
  try{
    const [d,b]=await Promise.all([api.showroom(),api.builders()]);
    SRPOSTS=d.posts||[];
    const g=$("#sr-grid");
    if(g)g.innerHTML=d.posts.length?d.posts.map(srCardHTML).join("")
      :`<div class="empty">No work posted yet.<br><br>Be the first — post a piece and it lands here.</div>`;
    const bb=$("#sr-builders");
    if(bb&&b.builders.length)bb.innerHTML=`<div class="mono sr-feedhead" style="padding-left:0"><span>WHO'S BUILDING</span></div>
      <div class="brow">${b.builders.map(x=>`<button class="bcard" data-u="${esc(x.username)}">
        ${x.avatar_url?`<img class="av" src="${esc(x.avatar_url)}" alt="">`:`<div class="av">${esc(x.display_name.slice(0,2).toUpperCase())}</div>`}
        <div class="bname">${esc(x.display_name)}</div>
        <div class="mono dim">${esc(x.role.toUpperCase())}</div>
        <div class="bstat">L${x.level} <span aria-label="backed">${MK_HEART(false)} ${x.validations}</span> <span aria-label="collabs">${IG_COLLAB_SM} ${x.collabs}</span></div>
      </button>`).join("")}</div>`;
    wireFeed();
  }catch(e){/* offline */}
}

/* The building. Each tile is a room you can see into: the last piece made
   there, who's been in this week, what's unread. That's what makes it a
   place rather than a nav menu. */
function labsGridHTML(){
  const A=LABACT||{byChannel:{},art:{},people:{},unread:{}};
  const labStats=(l)=>{
    let today=0,week=0,unread=0,last=0,art=null,people=[];
    for(const c of l.channels){
      const b=A.byChannel[c.id];
      if(b){today+=b.today||0;week+=b.week||0;if(b.last_at>last)last=b.last_at}
      unread+=A.unread[c.id]||0;
      const a=A.art[c.id];
      if(a&&(!art||a.at>art.at))art=a;
      for(const p of (A.people[c.id]||[])) if(!people.find(x=>x.username===p.username))people.push(p);
    }
    return {today,week,unread,last,art,people};
  };
  return `<div class="scroll">
    <div class="page-head">
      <div class="mono dim">THE LABS</div>
      <h2 class="page-h">Seven rooms.</h2>
      <p class="page-sub">Enter through what you make — meet everyone else.</p>
    </div>
    <div class="labgrid">${LABS.map(l=>{
      const id=LAB_ID[l.id]||{glyph:"//",for:""};
      const st=labStats(l);
      const live=st.today>0;
      return `<button class="labtile ${st.unread?"hasnew":""} ${live?"live":""}" data-lab="${l.id}">
        ${st.art?`<img class="labart" src="${esc(st.art.url)}" alt="" loading="lazy">`:""}
        <div class="labshade"></div>
        <div class="labtop">
          <span class="labglyph">${id.glyph}</span>
          ${st.unread?`<span class="labnew mono">${st.unread>9?"9+":st.unread} NEW</span>`
            :live?`<span class="labdot" title="active today"></span>`:""}
        </div>
        <div class="labbody">
          <div class="labname">${esc(l.name)}</div>
          <div class="labfor">${esc(id.for)}</div>
          <div class="labrooms mono">${l.channels.map(c=>"#"+c.label).join("  ")}</div>
        </div>
        <div class="labfoot">
          ${st.people.length?`<div class="labppl">${st.people.slice(0,4).map(p=>
            p.avatarUrl?`<img src="${esc(p.avatarUrl)}" alt="">`
              :`<span>${esc(p.displayName.slice(0,1).toUpperCase())}</span>`).join("")}
            ${st.people.length>4?`<em>+${st.people.length-4}</em>`:""}</div>`:""}
          <span class="mono labmeta">${st.week
            ? st.week+" this week"
            : st.last ? "quiet · last "+timeAgo(st.last)
            : "empty — be first"}</span>
        </div>
      </button>`}).join("")}</div>
    <div class="mono dim labhint">TAP A LAB TO GO IN</div>
  </div>`;
}

