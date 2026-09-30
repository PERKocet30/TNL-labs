/* ── POST CREATOR · v2 · 2026-09-28 ────────────────────────────────
   Instagram / Facebook grade, TNL look. One page: the work large at the
   top (swipe it, reorder it, see each upload land), the caption with
   @mentions, then three rows — invite collaborators, add music, share to a
   lab. Posts go to your profile (channel "profile"); picking a lab posts
   into that channel instead, so it shows in the room too. Collaborator
   invites go out the moment the post exists. */
const PC_CHEV=`<svg class="pc-chev" viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="square" stroke-linejoin="miter" aria-hidden="true"><path d="M9 5l7 7-7 7"/></svg>`;
const PC_X=`<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.25" stroke-linecap="square" stroke-linejoin="miter" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg>`;
const PC_PICK=`<svg viewBox="0 0 24 24" width="40" height="40" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="square" stroke-linejoin="miter" aria-hidden="true"><rect x="3.5" y="5" width="17" height="14"/><path d="M3.5 15.5l5-5 4 4 2.5-2.5 5.5 5.5"/><circle cx="15.5" cy="9.5" r="1.25"/></svg>`;
/* Frame timing with a fallback — boot.test renders in a DOM without it. */
const pcRaf=f=>(typeof requestAnimationFrame==="function"?requestAnimationFrame(f):setTimeout(f,16));
const pcCaf=h=>(typeof cancelAnimationFrame==="function"?cancelAnimationFrame(h):clearTimeout(h));
/* Share is ready as soon as there's something to post — photos still
   uploading finish in the background (app-18-post-queue.js). */
const pcCan=c=>!!((c.body||"").trim()||c.imgs.length||c.vid||c.upN||c.vidbusy)&&!c.busy;
const PC_EDIT=`<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="square" stroke-linejoin="miter" aria-hidden="true"><path d="M4 20h4L19 9l-4-4L4 16zM13.5 6.5l4 4"/></svg>`;
const PC_TAG=`<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="square" aria-hidden="true"><circle cx="12" cy="8" r="4"/><path d="M4 21c1-4 4.5-6 8-6s7 2 8 6"/></svg>`;
const PC_PIN=`<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="square" aria-hidden="true"><path d="M12 21s-7-6.2-7-12a7 7 0 0 1 14 0c0 5.8-7 12-7 12z"/><circle cx="12" cy="9" r="2.5"/></svg>`;

function pcomposeHTML(){
  const c=PCOMPOSE; c.collabs=c.collabs||[]; c.idx=Math.min(c.idx||0,Math.max(0,c.imgs.length-1));
  const file=`<input id="pcfile" type="file" accept="image/*,video/*" multiple hidden>`;
  let media;
  if(c.vidbusy)media=`<div class="pc-stage pc-busy"><span class="spin"></span>
      <div class="pc-prog"><i id="pcvidbar" style="width:${Math.round((c.vidprog||0)*100)}%"></i></div>
      <span class="dim" id="pcvidprog">Uploading video · ${Math.round((c.vidprog||0)*100)}%</span></div>`;
  else if(c.vid)media=`<div class="pc-stage"><video id="pcvid" src="${esc(c.vid.url)}"${c.cover?` poster="${esc(c.cover)}"`:""} playsinline muted ${c.coverPick?"":"controls "}preload="metadata" crossorigin="anonymous"></video>
      <button class="pc-rm" data-pcvidrm aria-label="Remove video">${PC_X}</button></div>
      ${c.coverPick?`<div class="pc-cover"><input type="range" min="0" max="1000" value="0" id="pccovr" aria-label="Pick a frame">
        <button class="pc-share" id="pccovok">Use this frame</button></div>`:""}`;
  else if(c.imgs.length||c.upN)media=`
    <div class="pc-stage">
      <div class="pc-track" id="pctrack">${c.imgs.map(im=>`<div class="pc-slide"><img src="${esc(im.url||im.thumb)}" alt=""></div>`).join("")}
        ${c.upN&&!c.imgs.length?`<div class="pc-slide pc-busy"><span class="spin"></span></div>`:""}</div>
      ${c.imgs.length>1?`<span class="pc-count" id="pccount">${c.idx+1}/${c.imgs.length}</span>`:""}
      ${c.imgs.length&&!(c.imgs[c.idx]||{}).gif?`<button class="pc-edit" data-pcedit aria-label="Edit photo">${PC_EDIT}<span>Edit</span></button>`:""}
    </div>
    <div class="pc-strip">
      ${c.imgs.map((im,i)=>`<div class="pc-th ${i===c.idx?"on":""}${im.busy?" pc-busy":""}" data-pci="${i}"><button class="pc-thb" data-pcgo="${i}" aria-label="Photo ${i+1}"><img src="${esc(im.thumb)}" alt="" draggable="false"></button>
        ${im.busy?`<span class="spin"></span>`:`<button class="pc-rm sm" data-pcrm="${i}" aria-label="Remove photo">${PC_X}</button>`}</div>`).join("")}
      ${Array.from({length:c.upN||0},()=>`<div class="pc-th pc-busy"><span class="spin"></span></div>`).join("")}
      ${c.imgs.length+(c.upN||0)<10?`<label class="pc-th pc-add" aria-label="Add photos">${UI_IC.plus}${file}</label>`:""}
    </div>`;
  else media=`${pdRowHTML(c)}<label class="pc-pick">${file}${PC_PICK}<b>Add photos or video</b><span>Up to 10 photos, or 1 video</span></label>`;
  const tags=c.tags||[];

  const lab=c.ch?`${esc(labMark(c.ch.lab))} · ${esc(c.ch.label)}`:"Profile only";
  return `<div class="pcmp-ov" id="pcov"><div class="pc" role="dialog" aria-label="New post">
    <header class="pc-top">
      <button class="pc-cancel" id="pccancel">Cancel</button>
      <div class="pc-ttl">New post</div>
      <button class="pc-share" id="pcgo" ${pcCan(c)?"":"disabled"}>${c.busy?"Sharing…":"Share"}</button>
    </header>
    <div class="pc-body">
      ${media}
      <div class="pc-cap">${avHTML(ME,"")}
        <textarea class="pc-ta" id="pcbody" rows="3" placeholder="Write a caption…">${esc(c.body||"")}</textarea></div>
      <div class="pc-ment" id="pcment" hidden></div>
      <div class="pc-opts">
        <button class="pc-opt" id="pccollab"><span class="pc-ic">${IG_COLLAB}</span><span class="pc-l">Invite collaborators</span>
          <span class="pc-v">${c.collabs.length?c.collabs.length+" invited":""}</span>${PC_CHEV}</button>
        ${c.collabs.length?`<div class="pc-chips">${c.collabs.map((u,i)=>`<span class="pc-chip">${avHTML(u,"")}@${esc(u.username)}
          <button data-pccrm="${i}" aria-label="Remove">${PC_X}</button></span>`).join("")}</div>`:""}
        ${c.track?`<div class="pc-opt pc-on"><button class="pc-ic pc-pp" data-pcmusplay aria-label="Play">${UI_IC.music}</button>
            <span class="pc-l"><b>${esc(c.track.title)}</b><span class="dim">@${esc(c.track.by.username)}</span></span>
            <button class="pc-x" data-pcmusrm aria-label="Remove music">${PC_X}</button></div>`
          :`<button class="pc-opt" data-pcmusadd><span class="pc-ic">${UI_IC.music}</span><span class="pc-l">Add music</span><span class="pc-v"></span>${PC_CHEV}</button>`}
        ${c.pick?`<div class="pc-mus"><input class="pc-q" id="pcmusq" placeholder="Search tracks or artists" value="${esc(c.q||"")}">
          <div class="pcmus-list">${pcmusRowsHTML(c.list,!!(c.q&&c.q.trim()))}</div></div>`:""}
        <button class="pc-opt" id="pclab"><span class="pc-ic lg">//</span><span class="pc-l">Share to a lab</span>
          <span class="pc-v">${lab}</span>${PC_CHEV}</button>
        <button class="pc-opt" id="pctag"><span class="pc-ic">${PC_TAG}</span><span class="pc-l">Tag people</span>
          <span class="pc-v">${tags.length?tags.length+" tagged":""}</span>${PC_CHEV}</button>
        ${tags.length?`<div class="pc-chips">${tags.map((u,i)=>`<span class="pc-chip">${avHTML(u,"")}@${esc(u.username)}
          <button data-pctrm="${i}" aria-label="Remove">${PC_X}</button></span>`).join("")}</div>`:""}
        <button class="pc-opt" id="pcshop"><span class="pc-ic">${UI_IC.navMarket}</span><span class="pc-l">Tag products</span>
          <span class="pc-v">${(c.products||[]).length?(c.products.length+" tagged"):"From your shop"}</span>${PC_CHEV}</button>
        ${(c.products||[]).length?`<div class="pc-chips">${c.products.map((l,i)=>`<span class="pc-chip pc-prod"><img src="${esc(l.images[0]||"")}" alt="">${esc(l.title)} · ${money(l.price)}
          <button data-pcprm="${i}" aria-label="Remove">${PC_X}</button></span>`).join("")}</div>`:""}
        <button class="pc-opt" id="pcloc"><span class="pc-ic">${PC_PIN}</span><span class="pc-l">${c.location?`<b>${esc(c.location)}</b>`:"Add location"}</span>
          ${c.location?`<span class="pc-x" data-pclocx aria-label="Remove location">${PC_X}</span>`:PC_CHEV}</button>
        ${c.vid?`<button class="pc-opt" id="pccov"><span class="pc-ic">${c.cover?`<img class="pc-covth" src="${esc(c.cover)}" alt="">`:PC_PICK.replace(/40/g,"22")}</span><span class="pc-l">Cover</span>
          <span class="pc-v">${c.cover?"Chosen":"First frame"}</span>${PC_CHEV}</button>`:""}
        <label class="pc-opt pc-sw-row"><span class="pc-ic">${IG_COMMENT}</span><span class="pc-l">Turn off commenting</span>
          <input type="checkbox" class="pf-sw" id="pccoff" ${c.commentsOff?"checked":""}></label>
      </div>
    </div>
  </div></div>`;
}

/* Picker rows, extracted so the search box can repaint just the list without
   a full render() stealing the keyboard mid-word. */
function pcmusRowsHTML(list,searching){
  if(!list)return `${skel()}`;
  if(!list.length)return searching
    ?`<div class="empty">No tracks match that.</div>`
    :`<div class="empty">No tracks in the library yet.<br>Upload one in // Music → Tracks.</div>`;
  return list.map(t=>`<div class="pcmus-row" data-pcmuspick="${t.id}"><div class="trk-art">${t.artworkUrl?`<img src="${esc(t.artworkUrl)}" alt="">`:DI.music}</div><div class="pcmus-meta"><div class="pcmus-t">${esc(t.title)}</div><div class="dim">@${esc(t.by.username)}${t.durationMs?" · "+mmss(t.durationMs):""}</div></div></div>`).join("");
}

function wirePCompose(){
  const ov=$("#pcov");if(!ov){if(PED&&!PCOMPOSE)pedClose();return}const c=PCOMPOSE;
  const syncGo=()=>{const g=$("#pcgo");if(g)g.disabled=!pcCan(c)};

  /* ── media ── */
  const fi=$("#pcfile");if(fi)fi.onchange=async()=>{
    const files=[...fi.files];fi.value="";
    /* iPadOS Files picks can arrive with an empty type — fall back to the
       extension; the server sniffs magic bytes either way. */
    const isVid=f=>f.type.startsWith("video/")||(!f.type&&/\.(mp4|m4v|mov|webm)$/i.test(f.name));
    const vids=files.filter(isVid), rest=files.filter(f=>!isVid(f));
    if(vids.length){
      const f=vids[0];
      if(vids.length>1)toast("One video per post");
      if(f.size>650*1024*1024){toast(f.name+" is over 650MB");return}
      if(c.imgs.length){c.imgs=[];toast("Video posts stand alone — photos cleared")}
      c.vid=null;c.cover=null;c.vidbusy=true;c.vidprog=0;render();
      /* Its size, so the feed can hold the space before it loads. */
      try{const v=document.createElement("video");v.preload="metadata";v.muted=true;const u=URL.createObjectURL(f);
        v.onloadedmetadata=()=>{c.vw=v.videoWidth||undefined;c.vh=v.videoHeight||undefined;URL.revokeObjectURL(u)};v.src=u}catch(e){}
      try{
        const up=await uploadStream(f,pr=>{if(c.dead)return;c.vidprog=pr;
          const t=$("#pcvidprog"),b=$("#pcvidbar");if(t)t.textContent="Uploading video · "+Math.round(pr*100)+"%";if(b)b.style.width=Math.round(pr*100)+"%";
          if(c.queued)pqPaint()});
        if(c.dead)return;   // discarded mid-upload
        if(up.kind!=="video")throw new Error("That file isn't a video");
        c.vid={url:up.url};
      }catch(e){if(c.dead)return;toast(e.message)}
      c.vidbusy=false;pcRepaint(c);return;
    }
    if(c.vid||c.vidbusy){toast("Video posts stand alone");return}
    const room=10-c.imgs.length-(c.upN||0);
    if(rest.length>room)toast("10 photos max");
    const take=rest.slice(0,Math.max(0,room));if(!take.length)return;
    c.upN=(c.upN||0)+take.length;render();
    for(const file of take){
      try{const p=await prepImage(file,true);
        const up=await api.upload(p.full);const th=await api.upload(p.thumb);
        if(c.dead)return;
        c.imgs.push({url:up.url,thumb:th.url,w:p.w,h:p.h,...(p.gif?{gif:true}:{})});}
      catch(e){if(c.dead)return;toast(e.message)}
      c.upN--;pcRepaint(c);
    }
  };
  const tr=$("#pctrack");
  if(tr){
    pcRaf(()=>{tr.scrollLeft=(c.idx||0)*tr.clientWidth});
    let raf=0;tr.onscroll=()=>{pcCaf(raf);raf=pcRaf(()=>{
      const i=Math.round(tr.scrollLeft/Math.max(1,tr.clientWidth));if(i===c.idx||i>=c.imgs.length)return;c.idx=i;
      const n=$("#pccount");if(n)n.textContent=(i+1)+"/"+c.imgs.length;
      document.querySelectorAll(".pc-th").forEach((t,k)=>t.classList.toggle("on",k===i));
      const l=$('[data-pcmv="-1"]'),r=$('[data-pcmv="1"]');if(l)l.disabled=!i;if(r)r.disabled=i>=c.imgs.length-1})};
  }
  document.querySelectorAll("[data-pcgo]").forEach(b=>b.onclick=()=>{c.idx=+b.dataset.pcgo;
    if(tr)tr.scrollTo({left:c.idx*tr.clientWidth,behavior:"smooth"})});
  pcDragWire(c);
  const ed=document.querySelector("[data-pcedit]");if(ed)ed.onclick=()=>pedOpen(c,c.idx||0);
  document.querySelectorAll("[data-pcrm]").forEach(b=>b.onclick=()=>{c.imgs.splice(+b.dataset.pcrm,1);c.idx=Math.min(c.idx||0,Math.max(0,c.imgs.length-1));render()});
  const vr=document.querySelector("[data-pcvidrm]");if(vr)vr.onclick=()=>{c.vid=null;c.cover=null;c.coverPick=false;render()};
  const dr=$("#pcdrafts");if(dr)dr.onclick=()=>pdOpen(c);

  /* ── video cover: scrub to a frame, keep it ── */
  const cv=$("#pccov");if(cv)cv.onclick=()=>{c.coverPick=!c.coverPick;render()};
  const vid=$("#pcvid"),rng=$("#pccovr");
  if(vid&&rng)rng.oninput=()=>{if(vid.duration)vid.currentTime=vid.duration*(+rng.value/1000)};
  const cok=$("#pccovok");if(cok)cok.onclick=async()=>{
    if(!vid||!vid.videoWidth)return toast("Give the video a moment to load");
    cok.disabled=true;
    try{const cn=document.createElement("canvas"),s=Math.min(1,1600/Math.max(vid.videoWidth,vid.videoHeight));
      cn.width=Math.round(vid.videoWidth*s);cn.height=Math.round(vid.videoHeight*s);
      cn.getContext("2d").drawImage(vid,0,0,cn.width,cn.height);
      c.vw=vid.videoWidth;c.vh=vid.videoHeight;c.coverPick=false;
      const up=await api.upload(cn.toDataURL("image/jpeg",.85));if(c.dead)return;c.cover=up.url;toast("Cover set")}
    catch(e){toast(e.message)}
    pcRepaint(c)};

  /* ── tag people, location, comments ── */
  const toTag=ppl=>ppl.filter(u=>u.username!==myName()&&!(c.tags||[]).find(x=>x.username===u.username))
    .map(u=>({label:u.displayName,sub:"@"+u.username+(u.role?" · "+u.role:""),avatar:u.avatarUrl,u}));
  const tg=$("#pctag");if(tg)tg.onclick=async()=>{
    if((c.tags||[]).length>=20)return toast("Up to 20 people");
    openPicker({title:"Tag people",search:"Search people",loading:true,note:"They'll be told they're in it.",
      onSearch:async q=>toTag((await api.mentionable(q)).people||[]),
      onPick:it=>{if(PCOMPOSE===c&&it.u){(c.tags=c.tags||[]).push(it.u);render()}}});
    try{const d=await api.mentionable("");if(PICKER){PICKER.items=toTag(d.people||[]);PICKER.loading=false;render()}}catch(e){}
  };
  document.querySelectorAll("[data-pctrm]").forEach(b=>b.onclick=()=>{c.tags.splice(+b.dataset.pctrm,1);render()});
  const lc=$("#pcloc");if(lc)lc.onclick=async e=>{
    if(e.target.closest("[data-pclocx]")){c.location="";return render()}
    const v=await uiPrompt("Add location",{placeholder:"City, venue or studio",value:c.location||"",okLabel:"Add"});
    if(v!=null&&PCOMPOSE===c){c.location=v.replace(/\s+/g," ").trim().slice(0,60);render()}};
  const co=$("#pccoff");if(co)co.onchange=()=>{c.commentsOff=co.checked};
  /* ── products from your own shop (shoppable posts) ── */
  const sh=$("#pcshop");if(sh)sh.onclick=async()=>{
    if((c.products||[]).length>=5)return toast("Up to 5 products");
    openPicker({title:"Tag products",loading:true,note:"From your shop. People tap them to buy.",empty:"Nothing for sale yet — list something in the Market first.",
      onPick:it=>{if(PCOMPOSE===c&&it.l){(c.products=c.products||[]).push(it.l);render()}}});
    try{const d=await api.mkt("seller="+encodeURIComponent(myName()));
      if(PICKER){PICKER.items=(d.listings||[]).filter(l=>l.kind!=="loop"&&!(c.products||[]).some(x=>x.id===l.id))
        .map(l=>({label:l.title,sub:money(l.price),avatar:l.images[0]||"",l}));PICKER.loading=false;render()}}catch(e){if(PICKER){PICKER.loading=false;render()}}
  };
  document.querySelectorAll("[data-pcprm]").forEach(b=>b.onclick=()=>{c.products.splice(+b.dataset.pcprm,1);render()});

  /* ── caption: grows as you type, @ suggests people ── */
  const ta=$("#pcbody"),mb=$("#pcment");
  const grow=()=>{if(!ta)return;ta.style.height="auto";ta.style.height=Math.min(ta.scrollHeight,360)+"px"};
  let mt=null;
  if(ta){grow();ta.oninput=()=>{c.body=ta.value;grow();syncGo();
    const m=/(^|\s)@([a-z0-9._]{0,20})$/i.exec(ta.value.slice(0,ta.selectionStart));
    clearTimeout(mt);
    if(!m){if(mb){mb.hidden=true;mb.innerHTML=""}return}
    mt=setTimeout(async()=>{let ppl=[];try{ppl=(await api.mentionable(m[2])).people||[]}catch(e){}
      if(!mb||PCOMPOSE!==c)return;
      mb.innerHTML=ppl.slice(0,6).map(u=>`<button class="pc-mrow" data-pcment="${esc(u.username)}">${avHTML(u,"")}<span><b>${esc(u.displayName)}</b><span class="dim">@${esc(u.username)}</span></span></button>`).join("");
      mb.hidden=!ppl.length;
      mb.querySelectorAll("[data-pcment]").forEach(x=>x.onmousedown=e=>{e.preventDefault();
        const pos=ta.selectionStart,before=ta.value.slice(0,pos).replace(/@([a-z0-9._]{0,20})$/i,"@"+x.dataset.pcment+" ");
        ta.value=before+ta.value.slice(pos);c.body=ta.value;ta.setSelectionRange(before.length,before.length);
        mb.hidden=true;mb.innerHTML="";grow();syncGo();ta.focus()})},200)}}

  /* ── rows ── */
  const toPeople=ppl=>ppl.filter(u=>!c.collabs.find(x=>x.username===u.username))
    .map(u=>({label:u.displayName,sub:"@"+u.username+(u.role?" · "+u.role:""),avatar:u.avatarUrl,u}));
  const cb=$("#pccollab");if(cb)cb.onclick=async()=>{
    if(c.collabs.length>=5)return toast("Up to 5 collaborators");
    openPicker({title:"Invite collaborators",search:"Search people",loading:true,
      note:"They're added once they accept.",
      onSearch:async q=>toPeople((await api.mentionable(q)).people||[]),
      onPick:it=>{if(PCOMPOSE===c&&it.u&&!c.collabs.find(x=>x.username===it.u.username)){c.collabs.push(it.u);render()}}});
    try{const d=await api.mentionable("");if(PICKER){PICKER.items=toPeople(d.people||[]);PICKER.loading=false;render()}}catch(e){}
  };
  document.querySelectorAll("[data-pccrm]").forEach(b=>b.onclick=()=>{c.collabs.splice(+b.dataset.pccrm,1);render()});
  const lb=$("#pclab");if(lb)lb.onclick=()=>{
    const items=[{label:"Profile only",sub:"Not in a lab",icon:DI.check,ch:null}];
    for(const l of LABS)for(const ch of l.channels){
      if(ch.beatlab||ch.archive||ch.library||(ch.gate&&levelFor(myRep()).id<ch.gate))continue;
      items.push({label:chName(ch),sub:labMark(l.name),icon:"//",ch:{id:ch.id,label:chName(ch),lab:l.name}})}
    openPicker({title:"Share to a lab",items,onPick:it=>{if(PCOMPOSE===c){c.ch=it.ch;render()}}});
  };
  const ma=document.querySelector("[data-pcmusadd]");if(ma)ma.onclick=async()=>{
    c.pick=!c.pick;render();
    if(c.pick&&!c.list){try{c.list=(await api.tracks("")).tracks}catch(e){c.list=[]}render()}};
  const pickTrack=el=>el.onclick=()=>{c.track=(c.list||[]).find(t=>String(t.id)===el.dataset.pcmuspick)||null;c.pick=false;render()};
  document.querySelectorAll("[data-pcmuspick]").forEach(pickTrack);
  const mq=$("#pcmusq");if(mq){let dq=null;mq.oninput=()=>{c.q=mq.value;clearTimeout(dq);
    dq=setTimeout(async()=>{try{c.list=(await api.tracks(c.q)).tracks}catch(e){c.list=[]}
      const box=document.querySelector(".pcmus-list");   // repaint rows only — keeps the keyboard up
      if(box){box.innerHTML=pcmusRowsHTML(c.list,!!c.q.trim());box.querySelectorAll("[data-pcmuspick]").forEach(pickTrack)}},300)}}
  const mr=document.querySelector("[data-pcmusrm]");if(mr)mr.onclick=()=>{c.track=null;render()};
  const mp=document.querySelector("[data-pcmusplay]");if(mp)mp.onclick=()=>{if(c.track)playTrack(c.track)};

  /* No scrim dismiss — Cancel is the way out, and it asks before binning a draft. */
  const cc=$("#pccancel");if(cc)cc.onclick=async()=>{if(await pcLeave())render()};

  /* ── share ── */
  const go=$("#pcgo");if(go)go.onclick=async()=>{
    if(!pcCan(c)){if(!c.busy)toast("Add a photo, a video, or write something");return}
    pqSubmit(c);   // closes now; posts in the background (app-18-post-queue.js)
  };
}
