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
const pcCan=c=>!!((c.body||"").trim()||c.imgs.length||c.vid)&&!c.busy&&!c.vidbusy&&!c.upN;

function pcomposeHTML(){
  const c=PCOMPOSE; c.collabs=c.collabs||[]; c.idx=Math.min(c.idx||0,Math.max(0,c.imgs.length-1));
  const file=`<input id="pcfile" type="file" accept="image/*,video/*" multiple hidden>`;
  let media;
  if(c.vidbusy)media=`<div class="pc-stage pc-busy"><span class="spin"></span>
      <div class="pc-prog"><i id="pcvidbar" style="width:${Math.round((c.vidprog||0)*100)}%"></i></div>
      <span class="dim" id="pcvidprog">Uploading video · ${Math.round((c.vidprog||0)*100)}%</span></div>`;
  else if(c.vid)media=`<div class="pc-stage"><video src="${esc(c.vid.url)}" playsinline muted controls preload="metadata"></video>
      <button class="pc-rm" data-pcvidrm aria-label="Remove video">${PC_X}</button></div>`;
  else if(c.imgs.length||c.upN)media=`
    <div class="pc-stage">
      <div class="pc-track" id="pctrack">${c.imgs.map(im=>`<div class="pc-slide"><img src="${esc(im.url||im.thumb)}" alt=""></div>`).join("")}
        ${c.upN&&!c.imgs.length?`<div class="pc-slide pc-busy"><span class="spin"></span></div>`:""}</div>
      ${c.imgs.length>1?`<span class="pc-count" id="pccount">${c.idx+1}/${c.imgs.length}</span>
        <button class="pc-mv l" data-pcmv="-1" aria-label="Move left"${c.idx?"":" disabled"}>‹</button>
        <button class="pc-mv r" data-pcmv="1" aria-label="Move right"${c.idx<c.imgs.length-1?"":" disabled"}>›</button>`:""}
    </div>
    <div class="pc-strip">
      ${c.imgs.map((im,i)=>`<div class="pc-th ${i===c.idx?"on":""}"><button class="pc-thb" data-pcgo="${i}" aria-label="Photo ${i+1}"><img src="${esc(im.thumb)}" alt=""></button>
        <button class="pc-rm sm" data-pcrm="${i}" aria-label="Remove photo">${PC_X}</button></div>`).join("")}
      ${Array.from({length:c.upN||0},()=>`<div class="pc-th pc-busy"><span class="spin"></span></div>`).join("")}
      ${c.imgs.length+(c.upN||0)<10?`<label class="pc-th pc-add" aria-label="Add photos">${UI_IC.plus}${file}</label>`:""}
    </div>`;
  else media=`<label class="pc-pick">${file}${PC_PICK}<b>Add photos or video</b><span>Up to 10 photos, or 1 video</span></label>`;

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
      </div>
    </div>
  </div></div>`;
}

/* Picker rows, extracted so the search box can repaint just the list without
   a full render() stealing the keyboard mid-word. */
function pcmusRowsHTML(list,searching){
  if(!list)return `<div class="empty">Loading…</div>`;
  if(!list.length)return searching
    ?`<div class="empty">No tracks match that.</div>`
    :`<div class="empty">No tracks in the library yet.<br>Upload one in // Music → Tracks.</div>`;
  return list.map(t=>`<div class="pcmus-row" data-pcmuspick="${t.id}"><div class="trk-art">${t.artworkUrl?`<img src="${esc(t.artworkUrl)}" alt="">`:DI.music}</div><div class="pcmus-meta"><div class="pcmus-t">${esc(t.title)}</div><div class="dim">@${esc(t.by.username)}${t.durationMs?" · "+mmss(t.durationMs):""}</div></div></div>`).join("");
}

function wirePCompose(){
  const ov=$("#pcov");if(!ov)return;const c=PCOMPOSE;
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
      c.vid=null;c.vidbusy=true;c.vidprog=0;render();
      try{
        const up=await uploadStream(f,pr=>{if(PCOMPOSE!==c)return;c.vidprog=pr;
          const t=$("#pcvidprog"),b=$("#pcvidbar");if(t)t.textContent="Uploading video · "+Math.round(pr*100)+"%";if(b)b.style.width=Math.round(pr*100)+"%"});
        if(PCOMPOSE!==c)return;   // discarded mid-upload
        if(up.kind!=="video")throw new Error("That file isn't a video");
        c.vid={url:up.url};
      }catch(e){if(PCOMPOSE!==c)return;toast(e.message)}
      c.vidbusy=false;render();return;
    }
    if(c.vid||c.vidbusy){toast("Video posts stand alone");return}
    const room=10-c.imgs.length-(c.upN||0);
    if(rest.length>room)toast("10 photos max");
    const take=rest.slice(0,Math.max(0,room));if(!take.length)return;
    c.upN=(c.upN||0)+take.length;render();
    for(const file of take){
      try{const p=await prepImage(file,true);
        const up=await api.upload(p.full);const th=await api.upload(p.thumb);
        if(PCOMPOSE!==c)return;
        c.imgs.push({url:up.url,thumb:th.url,w:p.w,h:p.h});}
      catch(e){if(PCOMPOSE!==c)return;toast(e.message)}
      c.upN--;render();
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
  document.querySelectorAll("[data-pcmv]").forEach(b=>b.onclick=()=>{const i=c.idx||0,j=i+(+b.dataset.pcmv);
    if(j<0||j>=c.imgs.length)return;[c.imgs[i],c.imgs[j]]=[c.imgs[j],c.imgs[i]];c.idx=j;render()});
  document.querySelectorAll("[data-pcrm]").forEach(b=>b.onclick=()=>{c.imgs.splice(+b.dataset.pcrm,1);c.idx=Math.min(c.idx||0,Math.max(0,c.imgs.length-1));render()});
  const vr=document.querySelector("[data-pcvidrm]");if(vr)vr.onclick=()=>{c.vid=null;render()};

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
    c.busy=true;render();
    try{
      const d=await api.post({channel:c.ch?c.ch.id:"profile",body:c.body.trim(),images:c.imgs,
        videoUrl:c.vid?c.vid.url:undefined,isWork:true,audioTrackId:c.track?c.track.id:undefined});
      let sent=0;const pid=d&&d.post&&d.post.id;
      if(pid)for(const u of c.collabs){try{await api.invite(pid,u.username);sent++}catch(e){}}
      PCOMPOSE=null;
      toast("Shared"+(sent?` · ${sent} invite${sent>1?"s":""} sent`:"")+(c.ch?" · also in "+c.ch.label:""));
      openProfile(myName());
    }catch(e){c.busy=false;toast(e.message);render()}
  };
}
