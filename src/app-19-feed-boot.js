function wireFeed(){
  wireVideos();   // autoplay in view — must run after every feed repaint
  /* The sound observer travels with the video one. Showroom and the room feed
     paint straight into #sr-grid / #feed and call wireFeed() WITHOUT going
     through render(), so wireMusAuto() in the wire() chain never saw those
     cards and autoplay only ever worked in surfaces render() repainted. */
  wireMusAuto();
  wireCaros();
  wireInstall();
  document.querySelectorAll("[data-like]").forEach(b=>b.onclick=async()=>{
    if(guest())return needAccount("Back someone's work. Likes are how people earn standing here — it's the whole point.");
    const id=b.dataset.like;
    const p=POSTS.find(x=>String(x.id)===id)||SRPOSTS.find(x=>String(x.id)===id)||(SEARCHRES&&SEARCHRES.posts.find(x=>String(x.id)===id))
      ||(PROFILE&&[...PROFILE.posts,...PROFILE.collabs].find(x=>String(x.id)===id));
    // flip it now, reconcile after. Repaint ONLY this button — a full
    // re-render here throws away your scroll position.
    const was=p?p.likedByMe:b.classList.contains("on");
    const now=!was;
    if(p){p.likedByMe=now;p.likeCount=Math.max(0,p.likeCount+(now?1:-1))}
    b.classList.toggle("on",now);
    const n=b.querySelector(".igact-n");
    if(n){n.textContent=p?(p.likeCount||""):"";}          // new IG icon button
    else{b.textContent=(now?"♥":"♡")+" "+(p?(p.likeCount||""):"");}  // legacy glyph cards
    try{
      const liked=await api.like(id);
      if(p&&liked!==now){ // server disagreed — trust it
        p.likedByMe=liked;p.likeCount=Math.max(0,p.likeCount+(liked?1:-1));
        b.classList.toggle("on",liked);
        /* textContent= used to wipe the icon AND the count span, leaving a bare
           text stub until the next full render. Repaint the count only. */
        const n2=b.querySelector(".igact-n");if(n2)n2.textContent=p.likeCount||"";
      }
    }catch(e){
      if(p){p.likedByMe=was;p.likeCount=Math.max(0,p.likeCount+(was?1:-1));
        b.classList.toggle("on",was);
        const n3=b.querySelector(".igact-n");if(n3)n3.textContent=p.likeCount||"";}
      toast(e.message);
    }});
  document.querySelectorAll("[data-share]").forEach(b=>b.onclick=()=>{
    if(guest())return needAccount("Join to carry work across the labs.");
    const id=b.dataset.share;
    const post=POSTS.find(x=>String(x.id)===id)
      ||SRPOSTS.find(x=>String(x.id)===id)
      ||(SEARCHRES&&SEARCHRES.posts.find(x=>String(x.id)===id))
      ||(PROFILE&&[...PROFILE.posts,...PROFILE.collabs].find(x=>String(x.id)===id));
    /* A share card in a lab carries the ORIGINAL's public page — the copy
       has isWork=0 by design, but the post it points at is public. */
    const pubId=post&&post.sharedFrom?post.sharedFrom:id;
    const link=location.origin+"/p/"+pubId;
    const shareable=!!(post&&(post.isWork||post.sharedFrom));

    /* Published work leads with "into a lab" — that's the Instagram move
       and the one that actually feeds the network. Chat leads with DM,
       because a message isn't something you broadcast. */
    /* Published work leads with "into a lab" — the move that feeds the
       network and earns the author rep. Right after it comes OFF the app:
       on a phone navigator.share opens the OS sheet (Messages, WhatsApp,
       AirDrop, Instagram — every app installed). On desktop there's no
       sheet, so copy-link IS the off-app share. Exactly one of each. */
    const canNative = shareable && typeof navigator!=="undefined" && !!navigator.share;
    const items=shareable?[
      {label:"Into a lab",sub:"Drop it in a room. The author earns rep when it travels.",icon:"//",act:"lab"},
      ...(canNative?[{label:"Send off the app",sub:"Messages, WhatsApp, AirDrop — anywhere on your phone",icon:DI.out,act:"native"}]:[]),
      {label:"Send inside TNL",sub:"Lands in their DMs here",icon:DI.mail,act:"dm"},
      {label:canNative?"Copy link":"Copy link to share",sub:link.replace(/^https?:\/\//,""),icon:DI.copy,act:"copy"},
    ]:[
      {label:"Send inside TNL",sub:"Lands in their DMs here",icon:DI.mail,act:"dm"},
      {label:"Into a lab",sub:"Carry it across",icon:"//",act:"lab"},
    ];

    openPicker({eyebrow:shareable?"PUBLISHED WORK":"CHAT",title:"Where to?",
      note:shareable
        ?"This one has a public page — anyone can open it, no account."
        :"This is a lab message, not published work. No public link, by design.",
      items,
      onPick:async(it)=>{
        if(it.act==="dm")return sendPostSheet(id);   // pick one or several people and chats
        if(it.act==="lab"){
          const chans=[];
          for(const l of LABS)for(const c of l.channels){
            if(c.beatlab||(c.gate&&levelFor(myRep()).id<c.gate))continue;
            chans.push({label:chName(c),sub:labMark(l.name),icon:"//",ch:c.id});
          }
          openPicker({title:"Share to a lab",
            note:"The original author earns rep when their work travels.",
            items:chans,onPick:async(c)=>{
              try{await api.share(id,{channel:c.ch});toast("Shared to "+c.label)}catch(e){toast(e.message)}}});
          return;
        }
        if(it.act==="native"){
          const data={title:post.author.displayName+" on TNL LABS",
            text:post.body?post.body.slice(0,140):"Made in the labs.",url:link};
          try{await navigator.share(data)}
          catch(e){/* they cancelled — not an error */}
          return;
        }
        if(it.act==="copy"){
          try{
            await navigator.clipboard.writeText(link);
            toast("Link copied — paste it anywhere");
          }catch(e){
            /* clipboard API needs a secure context and a real gesture; when
               it's blocked, the select-all prompt still lets them copy. */
            await uiPrompt("Copy this link",{value:link,okLabel:"Done"});
          }
        }
      }});
  });
  document.querySelectorAll("[data-collab]").forEach(b=>b.onclick=async()=>{
    const id=b.dataset.collab;
    const toItems=(people)=>people.map(u=>({label:u.displayName,sub:"@"+u.username+" · "+u.role,avatar:u.avatarUrl,username:u.username}));
    openPicker({eyebrow:"TWO-SIDED",title:"Invite a collaborator",
      note:"They have to accept. When they do, you both earn +20.",
      search:"Search people…",loading:true,
      onSearch:async(q)=>toItems((await api.mentionable(q)).people),
      onPick:async(it)=>{
        try{await api.invite(id,it.username);toast("Invite sent to "+it.label)}catch(e){toast(e.message)}}});
    try{const d=await api.mentionable("");
      if(PICKER){PICKER.items=toItems(d.people);PICKER.loading=false;render()}}catch(e){}
  });
  document.querySelectorAll("[data-accept]").forEach(b=>b.onclick=async()=>{try{await api.accept(b.dataset.accept);await refreshMe();toast("Collab confirmed — you both earned +20");render()}catch(e){toast(e.message)}});
  document.querySelectorAll("[data-remix]").forEach(b=>b.onclick=()=>{
    if(guest())return needAccount("Join to remix — open their loop in your studio and make it yours.");
    const id=b.dataset.remix;
    const p=POSTS.find(x=>String(x.id)===id)||SRPOSTS.find(x=>String(x.id)===id)
      ||(SEARCHRES&&SEARCHRES.posts.find(x=>String(x.id)===id))
      ||(PROFILE&&[...PROFILE.posts,...PROFILE.collabs].find(x=>String(x.id)===id));
    if(!p||!p.beat)return toast("Couldn't load that loop");
    PROFILE=null;TAB="studio";render();
    withStudio(()=>setTimeout(()=>{if(TNLStudio.loadRemix)TNLStudio.loadRemix(p.beat,{postId:p.id,username:p.author.username,name:p.beat.name})},120));
  });
  document.querySelectorAll("[data-beatplay]").forEach(b=>b.onclick=ev=>{ev.stopPropagation();const beat=JSON.parse(b.dataset.beatplay);withStudio(()=>TNLStudio.preview(beat))});
  document.querySelectorAll("[data-zoom]").forEach(el=>el.onclick=()=>{LIGHTBOX=el.dataset.zoom;render()});
  document.querySelectorAll("[data-discard]").forEach(b=>b.onclick=()=>{
    POSTS=POSTS.filter(x=>String(x.id)!==b.dataset.discard);renderRoomFeed()});
  document.querySelectorAll("[data-retry]").forEach(b=>b.onclick=async()=>{
    const p=POSTS.find(x=>String(x.id)===b.dataset.retry);if(!p||!p.retry)return;
    const r=p.retry;p.failed=false;p.pending=true;renderRoomFeed();
    try{
      const body={channel:CH.id,body:r.body,isWork:r.work};
      if(r.prep){const up=await uploadStream(dataUrlToBlob(r.prep.full));body.imageUrl=up.url;
        const th=await uploadStream(dataUrlToBlob(r.prep.thumb));body.thumbUrl=th.url;
        body.mediaW=r.prep.w;body.mediaH=r.prep.h}
      else if(r.vid){const up=await uploadStream(r.vid);
        if(up.kind==="video")body.videoUrl=up.url;else body.imageUrl=up.url}
      await api.post(body);
      POSTS=POSTS.filter(x=>x.id!==p.id);loadFeed(true);
    }catch(e){p.pending=false;p.failed=true;renderRoomFeed();toast(e.message)}});
  wireProfileLinks();   // covers .mention[data-u] too
  document.querySelectorAll("[data-pmore]").forEach(b=>b.onclick=e=>{e.stopPropagation();postMenu(b.dataset.pmore)});
  document.querySelectorAll("[data-edit]").forEach(b=>b.onclick=()=>{
    const p=POSTS.find(x=>String(x.id)===b.dataset.edit);if(!p)return;
    EDITID=p.id;render();const d=$("#draft");if(d){d.value=p.body||"";d.focus()}});
  document.querySelectorAll("[data-delpost]").forEach(b=>b.onclick=async()=>{
    if(!(await uiConfirm("Delete this post?","",{okLabel:"Delete",danger:true})))return;
    try{await api.delPost(b.dataset.delpost);toast("Deleted");loadFeed(true)}catch(e){toast(e.message)}});
  document.querySelectorAll("[data-comments]").forEach(b=>b.onclick=async()=>{
    const id=+b.dataset.comments;
    if(OPENCOMMENTS===id){OPENCOMMENTS=null;CEDIT=null;return render()}
    OPENCOMMENTS=id;CEDIT=null;COMMENTS=[];render();
    try{COMMENTS=(await api.comments(id)).comments;render();setTimeout(()=>$("#cdraft")?.focus(),80)}catch(e){toast(e.message)}});
  const cs=$("#csend");if(cs){const go=async()=>{
    const t=$("#cdraft").value.trim();if(!t)return;
    const id=OPENCOMMENTS, editing=CEDIT;
    $("#cdraft").value="";
    if(!editing){
      // show it immediately
      COMMENTS=[...COMMENTS,{id:"tmp"+Date.now(),body:t,createdAt:Date.now(),editedAt:null,pending:true,
        author:{username:ME.username,displayName:ME.displayName,avatarUrl:ME.avatarUrl,role:ME.role,level:levelFor(ME.rep).id}}];
      const p=POSTS.find(x=>x.id===id);if(p)p.commentCount=(p.commentCount||0)+1;
      render();setTimeout(()=>$("#cdraft")?.focus(),40);
    }
    try{
      if(editing){await api.editComment(editing,t);CEDIT=null}
      else await api.addComment(id,t);
      COMMENTS=(await api.comments(id)).comments;
      render();setTimeout(()=>$("#cdraft")?.focus(),40);
    }catch(e){
      COMMENTS=COMMENTS.filter(c=>!c.pending);
      const p=POSTS.find(x=>x.id===id);if(p)p.commentCount=Math.max(0,(p.commentCount||1)-1);
      toast(e.message);render();
    }};
    cs.onclick=go;$("#cdraft").onkeydown=e=>{if(e.key==="Enter")go()}}
  const cc=$("#ccancel");if(cc)cc.onclick=()=>{CEDIT=null;render()};
  const cj=$("#cjoinb");if(cj)cj.onclick=()=>needAccount("Give real feedback. It's where most collabs start.");
  document.querySelectorAll("[data-cedit]").forEach(b=>b.onclick=()=>{CEDIT=+b.dataset.cedit;render();setTimeout(()=>$("#cdraft")?.focus(),80)});
  document.querySelectorAll("[data-cdel]").forEach(b=>b.onclick=async()=>{
    if(!(await uiConfirm("Delete this comment?","",{okLabel:"Delete",danger:true})))return;
    try{await api.delComment(b.dataset.cdel);COMMENTS=(await api.comments(OPENCOMMENTS)).comments;loadFeed(true);render()}catch(e){toast(e.message)}});
  document.querySelectorAll("[data-report]").forEach(b=>b.onclick=()=>{
    const id=+b.dataset.report;
    openPicker({eyebrow:"REPORT",title:"What's wrong?",
      items:["Spam","Harassment","Stolen work","Nudity or gore","Something else"].map(r=>({label:r,icon:DI.flag,reason:r})),
      onPick:async(it)=>{try{await api.report({postId:id,reason:it.reason});toast("Reported — thank you")}catch(e){toast(e.message)}}});
  });
  wireProfileLinks();
}
function wireSheet(){
  const bg=$("#sheetbg");if(!bg)return;
  bg.onclick=e=>{if(e.target===bg){PROFILE=null;EDITING=false;render()}};
  $("#sheetx").onclick=()=>{PROFILE=null;EDITING=false;render()};
  const fb=$("#followb");if(fb)fb.onclick=async()=>{
    if(guest())return needAccount("Follow the people you want to build with.");
    const u=PROFILE.user.username;
    // optimistic — the button responds now, the server catches up
    PROFILE.youFollow=!PROFILE.youFollow;
    PROFILE.followers+=PROFILE.youFollow?1:-1;
    render();
    try{await api.follow(u);PROFCACHE.delete(u);const d=await api.profile(u);
      if(PROFILE&&PROFILE.user.username===u){PROFILE=d;PROFCACHE.set(u,d);render()}}
    catch(e){toast(e.message);PROFCACHE.delete(u)}};
  const spb=$("#shareprof");if(spb)spb.onclick=async()=>{
    const url=location.origin+"/u/"+spb.dataset.shareU;
    try{ if(navigator.share) await navigator.share({title:"@"+spb.dataset.shareU+" on LABS",url});
         else { await navigator.clipboard.writeText(url); toast("Profile link copied"); } }
    catch(e){ /* dismissed the share sheet -- nothing to do */ }
  };
  const lo=$("#logoutb");if(lo)lo.onclick=()=>{
    TOKEN=null;ME=null;PROFILE=null;UNREADS={};UNREAD=0;DMUNREAD=0;applyAccent((ACCENTS.lab||{}).hex);
    localStorage.removeItem("tnl-token");
    if(es)es.close();
    TAB="showroom";GATE=null;render();toast("Signed out")};
  const mb=$("#msgb");if(mb)mb.onclick=()=>{if(guest())return needAccount("Message people directly. Most collabs start with a DM.");openDM(PROFILE.user.username)};
  const bb=$("#blockb");if(bb)bb.onclick=async()=>{
    if(!(await uiConfirm("Block "+PROFILE.user.displayName+"?","You won't see each other's work.",{okLabel:"Block",danger:true})))return;
    try{const d=await api.block(PROFILE.user.username);toast(d.blocked?"Blocked":"Unblocked");PROFILE=null;render()}catch(e){toast(e.message)}};
  const ru=$("#reportu");if(ru)ru.onclick=()=>{
    const un=PROFILE.user.username;
    openPicker({eyebrow:"REPORT",title:"Why?",
      items:["Spam","Harassment","Stolen work","Impersonation","Something else"].map(r=>({label:r,icon:DI.flag,reason:r})),
      onPick:async(it)=>{try{await api.report({username:un,reason:it.reason});toast("Reported — thank you")}catch(e){toast(e.message)}}});
  };

  document.querySelectorAll("[data-ptab]").forEach(b=>b.onclick=async()=>{PTAB=b.dataset.ptab;render();
    if(PTAB==="shop"&&PROFLISTINGS===null&&PROFILE){try{const d=await api.mkt("seller="+encodeURIComponent(PROFILE.user.username));PROFLISTINGS=d.listings||[];render()}catch(e){PROFLISTINGS=[];render()}}});

  const pp=$("#profpost");if(pp)pp.onclick=()=>{PCOMPOSE={body:"",imgs:[],vid:null,busy:false};pushView("compose");render()};
  const eb=$("#editb");if(eb)eb.onclick=()=>{EDITING=true;EDITACCENT=PROFILE.user.accent||"lab";
    EDITROLES=(PROFILE.user.roles&&PROFILE.user.roles.length?[...PROFILE.user.roles]:[PROFILE.user.role]).filter(Boolean);render()};
  document.querySelectorAll("[data-accent]").forEach(b=>b.onclick=()=>{
    EDITACCENT=b.dataset.accent;
    applyAccent((ACCENTS[EDITACCENT]||{}).hex);   // see it immediately, not after saving
    render();
  });
  const avb=$("#avbtn");if(avb)avb.onclick=()=>$("#avin").click();
  const avi=$("#avin");if(avi)avi.onchange=async()=>{
    const f=avi.files&&avi.files[0];if(!f)return;avi.value="";
    try{const data=await compressImage(f,600,.85);const d=await api.avatar(data);
      ME=d.user;PROFCACHE.delete(ME.username);PROFILE=await api.profile(ME.username);toast("Photo updated");render()}catch(e){toast(e.message)}};
  /* pubtoggle removed in 064 — every page is public. */
  const ec=$("#ed-cancel");if(ec)ec.onclick=()=>{EDITING=false;applyAccent(ME.accentHex);render()};
  document.querySelectorAll("[data-er]").forEach(b=>b.onclick=()=>{
    const r=b.dataset.er;
    if(EDITROLES.includes(r))EDITROLES=EDITROLES.filter(x=>x!==r);
    else if(EDITROLES.length<5)EDITROLES=[...EDITROLES,r];
    else toast("Up to 5 roles");
    render()});
  const es_=$("#ed-save");if(es_)es_.onclick=async()=>{
    try{
      const d=await api.updateMe({displayName:$("#ed-name").value,bio:$("#ed-bio").value,link:$("#ed-link").value,roles:EDITROLES,accent:EDITACCENT});
      ME=d.user;EDITING=false;applyAccent(ME.accentHex);PROFCACHE.delete(ME.username);PROFILE=await api.profile(ME.username);toast("Profile updated");render();
    }catch(e){toast(e.message)}};

  // beat playback + opening a piece from the portfolio
  document.querySelectorAll("[data-beatplay]").forEach(b=>b.onclick=ev=>{ev.stopPropagation();const beat=JSON.parse(b.dataset.beatplay);withStudio(()=>TNLStudio.preview(beat))});
  document.querySelectorAll("[data-openpost]").forEach(el=>el.onclick=async(e)=>{
    if(e.target.closest("button,a,video,input,textarea"))return;   // let the card's own controls work
    const id=Number(el.dataset.openpost);
    /* A grid tile is a thumbnail, not the work. Open the whole post over the
       profile — every frame, the caption, the sound, the comments — and leave the
       profile underneath so closing puts you back where you were. */
    const p=(PROFILE&&[...PROFILE.posts,...PROFILE.collabs].find(x=>Number(x.id)===id))
      ||(SEARCHRES&&(SEARCHRES.posts||[]).find(x=>Number(x.id)===id))
      ||(POSTS||[]).find(x=>Number(x.id)===id)
      ||(SRPOSTS||[]).find(x=>Number(x.id)===id);
    if(!p)return;
    POSTOPEN=p;OPENCOMMENTS=id;COMMENTS=[];render();
    try{COMMENTS=(await api.comments(id)).comments;render()}catch(err){}
  });
}

/* ---- boot ---- */
/* Runs every 20s in the background. It must NEVER call render() — a full
   rebuild mid-action detaches the file input you just opened, wipes text
   you're typing, and jumps your scroll. That's what made image upload fail
   "the first few tries": a poll landing while the picker was open. Paints
   the two badges surgically instead. */
// Warm the Studio once the page is up, so beat play buttons respond instantly.
window.addEventListener("load",()=>setTimeout(()=>ensureStudio().catch(()=>{}),1500));

async function refreshBadges(){
  if(!ME)return;
  if(!ME.emailVerified){
    try{const st=await api.authStatus();
      if(st.verified){await refreshMe();toast("Email confirmed — you're in");paintVerifyBar()}
    }catch(e){}
  }
  try{const [n,d]=await Promise.all([api.notifs(),api.dmList()]);
    UNREAD=n.unread;DMUNREAD=d.unreadTotal;
    paintBadges();
    loadUnreads();
  }catch(e){/* offline */}
}
function paintBadges(){
  const set=(sel,count)=>{
    const b=$(sel);if(!b)return;
    let el=b.querySelector(".badge");
    if(count&&!el){el=document.createElement("span");el.className="badge";b.appendChild(el)}
    if(count&&el)el.textContent=count>9?"9+":count;
    else if(el)el.remove();
  };
  set("#notifBtn",UNREAD);
  set("#dmBtn",DMUNREAD);
}
function paintVerifyBar(){
  const bar=document.querySelector(".verifybar");
  if(bar&&ME&&ME.emailVerified)bar.remove();
}
(async()=>{
  try{const d=await api.levels();LEVELS=d.levels;if(d.accents)ACCENTS=d.accents;if(d.site)SITE=d.site}catch(e){/* offline default */}
  if(TOKEN)await refreshMe();          // invalid token just leaves ME null -> guest
  if(ME&&ME.accentHex)applyAccent(ME.accentHex);
  if(ME){
    startStream();refreshBadges();loadUnreads();
    // A tab in the background doesn't need badges; catch up the moment it's back.
    setInterval(()=>{if(!document.hidden)refreshBadges()},20000);
    document.addEventListener("visibilitychange",()=>{if(!document.hidden)refreshBadges()});
    const p=new URLSearchParams(location.search);
    if(p.get("connect")==="done"){try{await api.connectStatus();await refreshMe();
      toast(ME.payoutsReady?"Payouts connected":"Stripe needs a bit more info")}catch(e){}
      history.replaceState({},"","/")}
    if(p.get("checkout")==="paid"){toast("Paid — the seller's been told to ship");history.replaceState({},"","/")}
    if(p.get("checkout")==="failed"){toast("Payment didn't go through");history.replaceState({},"","/")}
    if(p.get("dm")){const who=p.get("dm");history.replaceState({},"","/");openDM(who)}   // admin Nudge lands here
  }
  try{MKTMETA=await api.mktMeta()}catch(e){}   // public — guests see the Market too
  // deep links — a shared /u/ or /m/ URL should land where it says
  const path=location.pathname;
  const mu=/^\/u\/([a-z0-9._]+)$/i.exec(path);
  const mm=/^\/m\/(\d+)$/.exec(path);
  if(mu){openProfile(mu[1])}
  else if(mm){TAB="market";MKTVIEW="detail";
    try{const d=await api.mktOne(mm[1]);MKTONE=d.listing;MKTOFFERS=d.offers||[]}catch(e){}}
  render();
  initHistory();
  if("serviceWorker" in navigator)navigator.serviceWorker.register("/sw.js").catch(()=>{});
})();
