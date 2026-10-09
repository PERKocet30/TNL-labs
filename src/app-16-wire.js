function wire(){
  document.querySelectorAll("[data-tab]").forEach(b=>b.onclick=async()=>{
    if(PCOMPOSE&&b.dataset.tab!=="post"&&!await pcLeave())return;
    if(b.dataset.tab==="post"){
      if(PCOMPOSE)return;   // already here — tapping ＋ again must not wipe the draft
      /* ＋ means POST, on every tab — the Market included. It used to flip
         to the sell form there, which read as the app changing its mind
         about what the button is. Selling keeps its own ＋ Sell button in
         the Market header; the nav ＋ does one thing everywhere. */
      if(guest())return needAccount("Join to post — it lands on your profile and the Showroom.");
      PCOMPOSE={body:"",imgs:[],vid:null,busy:false,ch:pcLabNow()};pushView("compose");render();return;
    }
    if(b.dataset.tab==="profile"){
      if(guest())return needAccount("Join to make your profile — your work and your shop.");
      openProfile(myName());return;
    }
    /* Labs again while inside a lab (or a #tag page) → back to the index. */
    if(TAB==="labs"&&b.dataset.tab==="labs"){LAB=null;ROOMOPEN=false;TAGVIEW=null;LABVIEW="work";LABTAG=null}
    TAB=b.dataset.tab;PROFILE=null;if(window.TNLStudio)TNLStudio.unmount();if(TAB==="market"){MKTVIEW="browse";loadMarket()}if(TAB==="labs")loadLabs();render()});
  document.querySelectorAll("[data-goto]").forEach(b=>b.onclick=()=>{TAB=b.dataset.goto;PROFILE=null;render()});
  const srp=$("#sr-post");if(srp)srp.onclick=()=>{
    /* Used to route into "the room your trade lives in" — but a lab send
       is chat now, so that button led away from the one place a post can
       be made. Same destination as the nav ＋: the post composer. */
    if(guest())return needAccount("Join to post — it lands on your profile and the Showroom.");
    PCOMPOSE={body:"",imgs:[],vid:null,busy:false,ch:pcLabNow()};pushView("compose");render();
  };
  /* ---- the archive + moodboards ---- */
  const pgo=$("#pastego"), pin_=$("#pastein");
  const doPaste=async()=>{
    const url=(pin_?.value||"").trim();
    if(!url)return;
    PASTING=true;PASTEERR=null;PASTED=null;render();
    try{
      PASTED=await api.unfurl(url);
      /* Keep the link. The image is theirs and lives at their URL — we're
         a moodboard, not a mirror. */
      PASTED.url=url;
    }catch(e){
      let detail="";
      try{const j=JSON.parse(e.detail||"{}");detail=j.detail||""}catch(x){}
      PASTEERR={error:e.message, detail:/instagram/i.test(e.message)
        ? "Their image URLs are signed and expire, and they serve crawlers a login wall. Screenshot it and upload instead — or use the are.na/Pinterest source if there is one."
        : detail};
    }
    PASTING=false;render();
  };
  if(pgo)pgo.onclick=doPaste;
  if(pin_)pin_.onkeydown=e=>{if(e.key==="Enter")doPaste()};
  const px=$("#pastex");if(px)px.onclick=()=>{PASTED=null;PASTEERR=null;render()};
  const psave=$("#pastesave");if(psave)psave.onclick=async()=>{
    if(!BOARDS)await loadBoards();
    if(!BOARDS.length){BOARDSOPEN=true;render();return toast("Make a moodboard first")}
    openPicker({eyebrow:"PULL INTO",title:"Which moodboard?",
      note:"The link and the source are kept. We never rehost the file.",
      items:BOARDS.map(b=>({label:b.name,sub:b.count+(b.count===1?" image":" images"),icon:DI.board,bid:b.id})),
      onPick:async(it)=>{
        try{
          await api.pin(it.bid,{srcUrl:PASTED.url,imgUrl:PASTED.image,note:PASTED.title||""});
          PASTED=null;if(pin_)pin_.value="";BOARDS=null;
          toast("Pulled into "+it.label);render();
        }catch(e){toast(e.message)}}});
  };

  const arq=$("#archq");
  if(arq)arq.oninput=()=>{
    /* Debounced by hand — the app has no debounce helper, and inventing one
       that doesn't exist is exactly what blanked the screen last week. */
    clearTimeout(ARCHT);
    ARCHT=setTimeout(()=>{ARCHFILT.q=arq.value.trim()||undefined;loadArchive()},260);
  };
  document.querySelectorAll("[data-asrc]").forEach(b=>b.onclick=()=>{
    ARCHSRC=b.dataset.asrc;render();
    /* Pinterest's widget script only runs once per load. Re-inject it when
       the tab opens or the board renders as a dead link. */
    if(ARCHSRC==="pin"){
      const old=document.getElementById("pinjs"); if(old)old.remove();
      const sc=document.createElement("script");
      sc.id="pinjs"; sc.async=true; sc.defer=true; sc.src="https://assets.pinterest.com/js/pinit.js";
      document.body.appendChild(sc);
    }
  });
  document.querySelectorAll("[data-asort]").forEach(b=>b.onclick=()=>{ARCHFILT.sort=b.dataset.asort||undefined;loadArchive()});
  document.querySelectorAll("[data-ach]").forEach(b=>b.onclick=()=>{
    ARCHFILT.channel=ARCHFILT.channel===b.dataset.ach?undefined:b.dataset.ach;loadArchive()});
  const ac=$("#archclear");if(ac)ac.onclick=()=>{ARCHFILT={};loadArchive()};
  document.querySelectorAll("[data-aopen]").forEach(b=>b.onclick=(e)=>{
    if(e.target.closest("[data-asave]"))return;   // the ＋ is its own button
    const x=(ARCHIVE?.images||[]).find(i=>String(i.id)===b.dataset.aopen);
    if(x)LIGHTBOX=x.full||x.url; render();
  });
  document.querySelectorAll("[data-asave]").forEach(b=>b.onclick=async(e)=>{
    e.stopPropagation();
    if(guest())return needAccount("Join to pull reference into a moodboard.");
    const id=+b.dataset.asave;
    if(!BOARDS)await loadBoards();
    if(!BOARDS.length){BOARDSOPEN=true;render();return toast("Make a moodboard first")}
    openPicker({eyebrow:"PULL INTO",title:"Which moodboard?",
      note:"Whoever made this gets told you took it.",
      items:BOARDS.map(b2=>({label:b2.name,sub:b2.count+(b2.count===1?" image":" images"),icon:DI.board,bid:b2.id})),
      onPick:async(it)=>{
        try{await api.pin(it.bid,{postId:id});
          const x=(ARCHIVE?.images||[]).find(i=>i.id===id);
          if(x){x.savedByMe=true;x.saves=(x.saves||0)+1}
          BOARDS=null;toast("Pulled into "+it.label);render();
        }catch(e2){toast(e2.message)}}});
  });
  const mb=$("#myboards");if(mb)mb.onclick=async()=>{
    if(guest())return needAccount("Join to keep moodboards.");
    BOARDSOPEN=true;BOARDONE=null;render();if(!BOARDS)await loadBoards();
  };
  const bx=$("#bx");if(bx)bx.onclick=()=>{BOARDSOPEN=false;BOARDONE=null;render()};
  const bbg=$("#bbg");if(bbg)bbg.onclick=e=>{if(e.target===bbg){BOARDSOPEN=false;BOARDONE=null;render()}};
  const bback=$("#bback");if(bback)bback.onclick=()=>{BOARDONE=null;render()};
  const bmake=$("#bmake");if(bmake)bmake.onclick=async()=>{
    const name=$("#bnew")?.value.trim();
    if(!name)return toast("Name it");
    try{await api.newBoard({name});BOARDS=null;await loadBoards();toast("Made")}catch(e){toast(e.message)}};
  document.querySelectorAll("[data-bopen]").forEach(b=>b.onclick=async()=>{
    try{BOARDONE=await api.board(b.dataset.bopen);render()}catch(e){toast(e.message)}});
  document.querySelectorAll("[data-unpin]").forEach(b=>b.onclick=async()=>{
    try{await api.unpin(b.dataset.unpin);BOARDONE=await api.board(BOARDONE.board.id);BOARDS=null;render()}
    catch(e){toast(e.message)}});
  const bdel=$("#bdel");if(bdel)bdel.onclick=async()=>{
    if(!(await uiConfirm("Delete \""+BOARDONE.board.name+"\"?","The images stay in the archive — only your moodboard goes.",{okLabel:"Delete",danger:true})))return;
    try{await api.delBoard(BOARDONE.board.id);BOARDONE=null;BOARDS=null;await loadBoards();toast("Deleted")}
    catch(e){toast(e.message)}};

  const nb=$("#notifBtn");if(nb)nb.onclick=async()=>{
    NOTIFOPEN=true;NOTIFS=null;render();
    try{const d=await api.notifs();NOTIFS=d.notifications;render();
      if(d.unread){await api.readNotifs();UNREAD=0;render()}}catch(e){toast(e.message)}};
  const db_=$("#dmBtn");if(db_)db_.onclick=()=>openMessages();
  const sb_=$("#searchBtn");if(sb_)sb_.onclick=()=>{SEARCHOPEN=true;render();setTimeout(()=>$("#sq")?.focus(),100)};
  ["#joinBtn","#joinBtn2","#joinBtn3"].forEach(id=>{const b=$(id);if(b)b.onclick=()=>{GATE="join";GATEWHY="";render()}});
  ["#loginBtn","#loginBtn2","#loginBtn3"].forEach(id=>{const b=$(id);if(b)b.onclick=()=>{GATE="login";GATEWHY="";render()}});
  wirePanels();
  const rs=$("#resendb");if(rs)rs.onclick=async()=>{
    try{const d=await api.resend();
      if(d.already){await refreshMe();toast("Already verified — you're good");return render()}
      if(d.verifyUrl){VERIFYURL=d.verifyUrl;toast("Email isn't set up — tap Open link");render()}
      else toast("Sent to "+(d.email||"your inbox")+" — check spam too");
    }catch(e){toast(e.message)}};
  /* Labs are places (app-11-places.js): a lab opens on its Work tab. */
  document.querySelectorAll("[data-lab]").forEach(b=>b.onclick=()=>openLab(b.dataset.lab));
  const lbk=$("#labback");if(lbk)lbk.onclick=()=>{
    LAB=null; ROOMOPEN=false; LABVIEW="work"; LABTAG=null;
    render(); loadLabs();
  };
  wirePlacesGlobal();
  if(TAB==="labs"&&(LAB||TAGVIEW))wirePlace();
  const bb=$("#backb");if(bb)bb.onclick=()=>{ROOMOPEN=false;render()};
  const sendb=$("#sendb");if(sendb){const go=async()=>{
    const t=$("#draft").value.trim();
    if(EDITID){
      const id=EDITID;
      try{await api.editPost(id,t);EDITID=null;$("#draft").value="";LABDRAFT="";loadFeed(true);render()}catch(e){toast(e.message)}
      return;
    }
    if(!t&&!QUEUE.length)return;

    /* Discord sends one message with N attachments. We send N posts — in a
       portfolio each piece needs its own likes and its own collab credits,
       and you can't credit a collaborator on "attachment 3 of 5".
       The text rides on the first one. */
    const queue=QUEUE.slice(), work=false, draftText=t;
    $("#draft").value="";LABDRAFT="";
    const RT=LABREPLY&&LABREPLY.channel===CH.id?LABREPLY:null;LABREPLY=null;paintLabBar();
    QUEUE=[];

    if(!queue.length){
      // plain text — the fast path, unchanged
      const temp={id:"tmp"+Date.now(),channel:CH.id,body:draftText,beat:null,
        imageUrl:null,thumbUrl:null,mediaW:null,mediaH:null,videoUrl:null,isWork:false,
        editedAt:null,sharedFrom:null,createdAt:Date.now(),
        author:{username:ME.username,displayName:ME.displayName,role:ME.role,avatarUrl:ME.avatarUrl,rep:ME.rep,level:levelFor(ME.rep).id},
        likeCount:0,shareCount:0,commentCount:0,likedByMe:false,collaborators:[],pending:true,replyTo:replyOf(RT),reactions:[]};
      POSTS=[...POSTS,temp];ROOMSTICK=true;renderRoomFeed();
      const feed=$("#feed");if(feed)feed.scrollTop=feed.scrollHeight;
      try{await api.post({channel:CH.id,body:draftText,isWork:false,replyTo:RT?RT.id:undefined});
        POSTS=POSTS.filter(p=>p.id!==temp.id);loadFeed(true);
        setTimeout(maybeOfferInstall,1400);   // they just posted — good moment to ask
      }catch(e){
        const p=POSTS.find(x=>x.id===temp.id);
        if(p){p.pending=false;p.failed=true;p.retry={body:draftText};renderRoomFeed()}
        toast(e.message);
      }
      return;
    }

    /* ONE post, however many images. People chat — someone drops four refs
       mid-sentence and it's one thought. I had this backwards: I was making
       5 images into 5 posts, which forces a formality nobody talks in.
       Videos are the exception; they stay one per post. */
    const vids=queue.filter(q=>q.kind==="video");
    const imgs=queue.filter(q=>q.kind==="image"&&q.prep);

    if(imgs.length){
      const temp={id:"tmp"+Date.now(),channel:CH.id,body:draftText,beat:null,
        imageUrl:imgs[0].prep.full,thumbUrl:imgs[0].prep.thumb,
        mediaW:imgs[0].prep.w,mediaH:imgs[0].prep.h,
        images:imgs.length>1?imgs.map(q=>({url:q.prep.full,thumb:q.prep.thumb,w:q.prep.w,h:q.prep.h})):null,
        videoUrl:null,isWork:work,editedAt:null,sharedFrom:null,createdAt:Date.now(),
        author:{username:ME.username,displayName:ME.displayName,role:ME.role,avatarUrl:ME.avatarUrl,rep:ME.rep,level:levelFor(ME.rep).id},
        likeCount:0,shareCount:0,commentCount:0,likedByMe:false,collaborators:[],pending:true};
      POSTS=[...POSTS,temp];renderRoomFeed();
      const feed=$("#feed");if(feed)feed.scrollTop=feed.scrollHeight;
      try{
        const uploaded=[];
        for(let i=0;i<imgs.length;i++){
          const q=imgs[i];
          const bump=(f)=>{UPPROG=(i+f)/imgs.length;const el=$("#upbar");if(el)el.style.width=Math.round(UPPROG*100)+"%"};
          UPPROG=i/imgs.length;renderRoomFeed();
          const up=await uploadStream(dataUrlToBlob(q.prep.full),bump);
          const th=await uploadStream(dataUrlToBlob(q.prep.thumb));
          uploaded.push({url:up.url,thumb:th.url,w:q.prep.w,h:q.prep.h});
        }
        UPPROG=null;
        await api.post({channel:CH.id,body:draftText,isWork:work,
          imageUrl:uploaded[0].url,thumbUrl:uploaded[0].thumb,
          mediaW:uploaded[0].w,mediaH:uploaded[0].h,
          images:uploaded.length>1?uploaded:undefined,replyTo:RT?RT.id:undefined});
        POSTS=POSTS.filter(p=>p.id!==temp.id);
      }catch(e){
        const p=POSTS.find(x=>x.id===temp.id);
        if(p){p.pending=false;p.failed=true;p.retry={body:draftText,imgs,work};renderRoomFeed()}
        UPPROG=null;toast(e.message);
      }
    }

    // videos get their own post each — a 600MB file isn't a thumbnail in a grid
    for(const q of vids){
      const temp={id:"tmp"+Date.now()+"_v",channel:CH.id,body:imgs.length?"":draftText,beat:null,
        imageUrl:null,thumbUrl:null,mediaW:null,mediaH:null,images:null,
        videoUrl:null,isWork:work,editedAt:null,sharedFrom:null,createdAt:Date.now(),
        author:{username:ME.username,displayName:ME.displayName,role:ME.role,avatarUrl:ME.avatarUrl,rep:ME.rep,level:levelFor(ME.rep).id},
        likeCount:0,shareCount:0,commentCount:0,likedByMe:false,collaborators:[],pending:true};
      POSTS=[...POSTS,temp];renderRoomFeed();
      try{
        const bump=(f)=>{UPPROG=f;const el=$("#upbar");if(el)el.style.width=Math.round(f*100)+"%"};
        UPPROG=0;renderRoomFeed();
        const up=await uploadStream(q.file,bump);
        UPPROG=null;
        const b={channel:CH.id,body:imgs.length?"":draftText,isWork:work,replyTo:!imgs.length&&RT?RT.id:undefined};
        if(up.kind==="video")b.videoUrl=up.url;else b.imageUrl=up.url;
        await api.post(b);
        POSTS=POSTS.filter(p=>p.id!==temp.id);
      }catch(e){
        const p=POSTS.find(x=>x.id===temp.id);
        if(p){p.pending=false;p.failed=true;renderRoomFeed()}
        UPPROG=null;toast(q.name+": "+e.message);
      }
    }
    loadFeed(true);
  };
  sendb.onclick=go;
    const dr=$("#draft");
    dr.onkeydown=e=>{if(e.key==="Enter"&&!MENTIONS)go()};
    let mt=null;
    dr.oninput=async()=>{
      const upto=dr.value.slice(0,dr.selectionStart||dr.value.length);
      const m=/@([a-z0-9._]*)$/i.exec(upto);
      if(!m){if(MENTIONS){MENTIONS=null;render()}return}
      MENTIONQ=m[1];
      clearTimeout(mt);
      mt=setTimeout(async()=>{
        try{const d=await api.mentionable(MENTIONQ);
          MENTIONS=d.people.length?d.people:null;render();
          const f=$("#draft");if(f){f.focus();f.setSelectionRange(f.value.length,f.value.length)}
        }catch(e){}
      },160);
    };}
  const ce=$("#canceledit");if(ce)ce.onclick=()=>{EDITID=null;LABDRAFT="";render()};
  document.querySelectorAll("[data-mpick]").forEach(b=>b.onclick=()=>{
    const u=MENTIONS[+b.dataset.mpick];
    const dr=$("#draft");
    dr.value=dr.value.replace(/@([a-z0-9._]*)$/i,"@"+u.username+" ");
    MENTIONS=null;render();
    const f=$("#draft");if(f){f.focus();f.setSelectionRange(f.value.length,f.value.length)}
  });

  if(TAB==="labs"&&CH.library)wireTracks();
  const ab=$("#attachb");if(ab)ab.onclick=()=>$("#filein").click();
  /* Discord's flow: pick several, see them all, drop any, send once.
     Each still becomes its own post — in a portfolio a piece needs its own
     likes and its own collab credits, which a grouped attachment can't have. */
  const fi=$("#filein");if(fi)fi.onchange=async()=>{
    const files=[...(fi.files||[])];fi.value="";
    for(const f of files){
      if(QUEUE.length>=10){toast("10 at a time");break}
      if(f.type.startsWith("video/")){
        if(f.size>650*1024*1024){toast(f.name+" is over 650MB");continue}
        QUEUE.push({file:f,kind:"video",name:f.name,state:"ok",preview:null});
        continue;
      }
      if(f.size>30*1024*1024){toast(f.name+" is over 30MB");continue}
      QUEUE.push({file:f,kind:"image",name:f.name,state:"prep",preview:null});
    }
    render();
    // prep previews after painting, so the grid appears instantly
    for(const q of QUEUE){
      if(q.kind!=="image"||q.prep)continue;
      try{q.prep=await prepImage(q.file,false);q.preview=q.prep.thumb;q.state="ok"}
      catch(e){q.state="err";q.error=e.message}
      render();
    }
  };
  const qm=$("#qmore");if(qm)qm.onclick=()=>$("#filein").click();
  document.querySelectorAll("[data-qdrop]").forEach(b=>b.onclick=()=>{
    QUEUE.splice(+b.dataset.qdrop,1);render();
  });
  const di=$("#dropimg");if(di)di.onclick=()=>{QUEUE=[];render()};
  wireFeed();wireSheet();wireEvent();wireMarket();wirePicker();wirePCompose();wireTrkEdit();wirePostOpen();wireMusAuto();paintPlayer();
  wireLightbox();
}
