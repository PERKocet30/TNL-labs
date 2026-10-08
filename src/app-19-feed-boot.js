/* LIKES v2 — 2026-09-29. One state per post however many buttons show it (a
   card and the opened post). A tap flips it at once; the server is told the
   state you want, one request per post at a time, and its answer wins. */
const LIKING={};
function likeCopies(id){id=String(id);
  const all=[...(POSTS||[]),...(SRPOSTS||[]),...(POSTOPEN?[POSTOPEN]:[]),...(PROFILE?[...(PROFILE.posts||[]),...(PROFILE.collabs||[])]:[]),...(SEARCHRES?SEARCHRES.posts||[]:[])];
  return all.filter(x=>String(x.id)===id)}
function setLike(id,liked,count){
  for(const p of likeCopies(id)){if(liked!=null)p.likedByMe=liked;p.likeCount=count}
  document.querySelectorAll('[data-like="'+id+'"]').forEach(b=>{
    if(liked!=null)b.classList.toggle("on",liked);
    const n=b.querySelector(".igact-n");if(n)n.textContent=count||"";});
}
async function sendLike(id){
  const s=LIKING[id];if(!s||s.busy)return;
  s.busy=true;
  try{
    let r,sent;
    do{sent=s.want;r=await api.like(id,sent)}while(s.want!==sent);   // tapped again meanwhile: send the latest
    delete LIKING[id];
    setLike(id,!!r.liked,Number(r.likeCount)||0);
  }catch(e){
    delete LIKING[id];
    setLike(id,s.base.liked,s.base.count);
    toast(e.message);
  }
}
function wireFeed(){
  wireVideos();   // autoplay in view — must run after every feed repaint
  /* The sound observer travels with the video one. Showroom and the room feed
     paint straight into #sr-grid / #feed and call wireFeed() WITHOUT going
     through render(), so wireMusAuto() in the wire() chain never saw those
     cards and autoplay only ever worked in surfaces render() repainted. */
  wireMusAuto();
  wireCaros();
  wireInstall();
  document.querySelectorAll("[data-like]").forEach(b=>b.onclick=()=>{
    if(guest())return needAccount("Join to like work.");
    const id=b.dataset.like, p=findAnyPost(id);
    const was=p?!!p.likedByMe:b.classList.contains("on"), now=!was;
    const had=p?(p.likeCount||0):(Number((b.querySelector(".igact-n")||{}).textContent)||0);
    // flip it now, on every copy of this post on screen; the server is told after
    if(!LIKING[id])LIKING[id]={base:{liked:was,count:had}};
    setLike(id,now,Math.max(0,had+(now?1:-1)));
    LIKING[id].want=now;sendLike(id);
  });
  document.querySelectorAll("[data-share]").forEach(b=>b.onclick=()=>{
    if(guest())return needAccount("Join to carry work across the labs.");
    const id=b.dataset.share;
    // findAnyPost also covers an opened post, which this list used to miss
    const post=findAnyPost(id);
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
      {label:"Into a lab",sub:"Share it in a room.",icon:"//",act:"lab"},
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
            note:"",
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
    openPicker({title:"Invite a collaborator",
      note:"They'll get an invite to accept.",
      search:"Search people…",loading:true,
      onSearch:async(q)=>toItems((await api.mentionable(q)).people),
      onPick:async(it)=>{
        try{await api.invite(id,it.username);toast("Invite sent to "+it.label)}catch(e){toast(e.message)}}});
    try{const d=await api.mentionable("");
      if(PICKER){PICKER.items=toItems(d.people);PICKER.loading=false;render()}}catch(e){}
  });
  document.querySelectorAll("[data-accept]").forEach(b=>b.onclick=async()=>{try{await api.accept(b.dataset.accept);await refreshMe();toast("Collab confirmed");render()}catch(e){toast(e.message)}});
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
    if(OPENCOMMENTS===id){OPENCOMMENTS=null;CEDIT=null;return paintComments()}
    OPENCOMMENTS=id;CEDIT=null;COMMENTS=[];paintComments();   // opens in place (app-12-comments.js)
    try{COMMENTS=(await api.comments(id)).comments;if(OPENCOMMENTS===id){paintComments();setTimeout(focusDraft,60)}}catch(e){toast(e.message)}});
  const cs=$("#csend");if(cs){const go=async()=>{
    const t=$("#cdraft").value.trim();if(!t)return;
    const id=OPENCOMMENTS, editing=CEDIT;
    $("#cdraft").value="";
    if(!editing){
      // show it immediately
      COMMENTS=[...COMMENTS,{id:"tmp"+Date.now(),body:t,createdAt:Date.now(),editedAt:null,pending:true,
        author:{username:ME.username,displayName:ME.displayName,avatarUrl:ME.avatarUrl,role:ME.role,level:levelFor(ME.rep).id}}];
      bumpComments(id,1);
      paintComments();setTimeout(focusDraft,40);
    }
    try{
      if(editing){await api.editComment(editing,t);CEDIT=null}
      else await api.addComment(id,t);
      COMMENTS=(await api.comments(id)).comments;
      paintComments();setTimeout(focusDraft,40);
    }catch(e){
      COMMENTS=COMMENTS.filter(c=>!c.pending);
      if(!editing)bumpComments(id,-1);
      toast(e.message);paintComments();
    }};
    cs.onclick=go;$("#cdraft").onkeydown=e=>{if(e.key==="Enter")go()}}
  const cc=$("#ccancel");if(cc)cc.onclick=()=>{CEDIT=null;paintComments()};
  const cj=$("#cjoinb");if(cj)cj.onclick=()=>needAccount("Join to comment.");
  document.querySelectorAll("[data-cedit]").forEach(b=>b.onclick=()=>{CEDIT=+b.dataset.cedit;paintComments();setTimeout(focusDraft,60)});
  document.querySelectorAll("[data-cdel]").forEach(b=>b.onclick=async()=>{
    if(!(await uiConfirm("Delete this comment?","",{okLabel:"Delete",danger:true})))return;
    try{await api.delComment(b.dataset.cdel);bumpComments(OPENCOMMENTS,-1);COMMENTS=(await api.comments(OPENCOMMENTS)).comments;paintComments()}catch(e){toast(e.message)}});
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
  bg.onclick=e=>{if(e.target===bg&&!EDITING){PROFILE=null;render()}};
  const sx=$("#sheetx");if(sx)sx.onclick=()=>{PROFILE=null;EDITING=false;render()};
  wireProfileV2();   // profile v2: edit page, ≡ / ⋯ menus, follower lists, tagged (app-15-profile-edit.js)
  const fb=$("#followb");if(fb)fb.onclick=async()=>{
    if(guest())return needAccount("Join to follow people.");
    const u=PROFILE.user.username;
    // optimistic — the button responds now, the server catches up
    PROFILE.youFollow=!PROFILE.youFollow;
    PROFILE.followers+=PROFILE.youFollow?1:-1;
    render();
    try{await api.follow(u);PROFCACHE.delete(u);const d=await api.profile(u);
      if(PROFILE&&PROFILE.user.username===u){PROFILE=d;PROFCACHE.set(u,d);render()}}
    catch(e){toast(e.message);PROFCACHE.delete(u)}};
  const spb=$("#shareprof");if(spb)spb.onclick=async()=>{
    const url=profileLink(spb.dataset.shareU);
    try{ if(navigator.share) await navigator.share({title:"@"+spb.dataset.shareU+" on LABS",url});
         else { await navigator.clipboard.writeText(url); toast("Profile link copied"); } }
    catch(e){ /* dismissed the share sheet -- nothing to do */ }
  };
  const mb=$("#msgb");if(mb)mb.onclick=()=>{if(guest())return needAccount("Join to message people.");openDM(PROFILE.user.username)};

  document.querySelectorAll("[data-ptab]").forEach(b=>b.onclick=async()=>{PTAB=b.dataset.ptab;render();
    if(PTAB==="shop"&&PROFLISTINGS===null&&PROFILE){try{const d=await api.mkt("seller="+encodeURIComponent(PROFILE.user.username));PROFLISTINGS=d.listings||[];render()}catch(e){PROFLISTINGS=[];render()}}});

  const pp=$("#profpost");if(pp)pp.onclick=()=>{PCOMPOSE={body:"",imgs:[],vid:null,busy:false};pushView("compose");render()};
  const avb=$("#avbtn");if(avb)avb.onclick=()=>$("#avin").click();
  const avi=$("#avin");if(avi)avi.onchange=async()=>{
    const f=avi.files&&avi.files[0];if(!f)return;avi.value="";
    try{const data=await compressImage(f,600,.85);const d=await api.avatar(data);
      ME=d.user;PROFCACHE.delete(ME.username);PROFILE=await api.profile(ME.username);toast("Photo updated");render()}catch(e){toast(e.message)}};
  /* pubtoggle removed in 064 — every page is public. */

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
window.addEventListener("load",()=>setTimeout(()=>{if(studioOn())ensureStudio().catch(()=>{})},1500));

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
  if(!studioOn()){const m=LABS.find(l=>l.id==="culture");if(m)m.channels=m.channels.filter(c=>!c.beatlab)}
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
    if(p.get("checkout")==="paid"){bagPaid();toast("Paid — the seller's been told to ship");history.replaceState({},"","/")}
    if(p.get("checkout")==="failed"){toast("Payment didn't go through");history.replaceState({},"","/")}
    if(p.get("dm")){const who=p.get("dm");history.replaceState({},"","/");openDM(who)}   // admin Nudge lands here
  }
  try{MKTMETA=await api.mktMeta()}catch(e){}   // public — guests see the Market too
  // deep links — a shared /u/ or /m/ URL should land where it says
  let path=location.pathname;try{path=decodeURIComponent(path)}catch(e){}   // /u/xstart%2E → /u/xstart.
  const mu=/^\/u\/([a-z0-9._]+)$/i.exec(path);
  const mm=/^\/m\/(\d+)$/.exec(path);
  const me=new URLSearchParams(location.search).get("e");   // /e/:slug pages send people here
  const mv=Number(new URLSearchParams(location.search).get("v"))||null;   // …and /e/:slug/:entry, to that piece
  const back=!me&&!mu&&!mm?evReturn():null;   // confirmed your email elsewhere: back to the vote
  loadEvents();
  if(me||back){history.replaceState({},"","/");TAB="event";EVSLUG=me||back.slug;EVFOCUS=me?mv:back.v||null;loadEvent()}
  else if(mu){openProfile(mu[1])}
  else if(path==="/shop"){TAB="market";MKTVIEW="browse"}
  else if(mm){TAB="market";MKTVIEW="detail";
    try{const d=await api.mktOne(mm[1]);MKTONE=d.listing;MKTOFFERS=d.offers||[]}catch(e){}}
  render();
  initHistory();
  if("serviceWorker" in navigator)navigator.serviceWorker.register("/sw.js").catch(()=>{});
})();
