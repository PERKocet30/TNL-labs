/* v2026-10-29: Edit opens this page on the post — "Edit info" · Done (app/compose/post-edit).
/* v2026-10-25: pick which part of the song plays — the bar under the picked song (pcPartHTML/pcPartWire, app/compose/preview).
/* v2026-10-25: a photo takes its place in the strip the moment it's picked and uploads land into it, two at a time (pcAddPhotos, app/compose/queue); a drag the phone turns into a scroll reorders nothing.
/* v2026-10-21 (later the same day): tag people on the picture, Preview, Also share to your Story, Advanced settings — app/compose/composer-ig.js. Posting to · Your profile · + Add a lab (one post, one place list; Share is for sending out). v2026-10-20: the bar is the kit's formHead */
/* ── POST CREATOR · v2.4 · 2026-10-13 (v2.4: ▶ to listen before you pick a song; v2.3: your songs first in Add music; v2 2026-09-28; v2.1: your labs first in Share to a lab; v2.2: upload a song from here, and its cover is the post's picture when there are no photos) ────────────────────────────────
   One page: the work large at the
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
   uploading finish in the background (app/compose/queue.js). */
const pcCan=c=>!!((c.body||"").trim()||c.imgs.length||c.vid||c.upN||c.vidbusy||pcCover(c))&&!c.busy&&!c.musup;
/* A song with a cover and no photos or video: the cover is the picture. */
const pcCover=c=>!c.imgs.length&&!c.upN&&!c.vid&&!c.vidbusy&&c.track&&c.track.artworkUrl||"";
const PC_EDIT=`<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="square" stroke-linejoin="miter" aria-hidden="true"><path d="M4 20h4L19 9l-4-4L4 16zM13.5 6.5l4 4"/></svg>`;
const PC_TAG=`<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="square" aria-hidden="true"><circle cx="12" cy="8" r="4"/><path d="M4 21c1-4 4.5-6 8-6s7 2 8 6"/></svg>`;
const PC_PIN=`<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="square" aria-hidden="true"><path d="M12 21s-7-6.2-7-12a7 7 0 0 1 14 0c0 5.8-7 12-7 12z"/><circle cx="12" cy="9" r="2.5"/></svg>`;

function pcomposeHTML(){
  const c=PCOMPOSE; c.collabs=c.collabs||[]; c.idx=Math.min(c.idx||0,Math.max(0,c.imgs.length-1));
  const file=`<input id="pcfile" type="file" accept="image/*,video/*" multiple hidden>`;
  let media;
  if(c.edit)media=pceMediaHTML(c);   // Edit info: the work as posted (app/compose/post-edit)
  else if(c.vidbusy)media=`<div class="pc-stage pc-busy"><span class="spin"></span>
      <div class="pc-prog"><i id="pcvidbar" style="width:${Math.round((c.vidprog||0)*100)}%"></i></div>
      <span class="dim" id="pcvidprog">Uploading video · ${Math.round((c.vidprog||0)*100)}%</span>
      <span class="dim pc-keep">Keep LABS open until it's done</span></div>`;
  else if(c.vid){const ve=c.vedit||{},r=VRATIO[ve.ratio];
    media=`<div class="pc-stage"><video id="pcvid" class="${r?"vfill":""}" src="${esc(c.vid.url)}#t=${((ve.start||0)/1000||.1).toFixed(2)}"${c.cover?` poster="${esc(c.cover)}"`:""}${r?` style="aspect-ratio:${r}"`:""} playsinline ${ve.muted?"muted ":""}controls preload="metadata"></video>
      <button class="pc-rm" data-pcvidrm aria-label="Remove video">${PC_X}</button>
      <button class="pc-edit pc-edit-top" data-pcvedit aria-label="Edit video">${PC_EDIT}<span>Edit</span></button></div>`}
  else if(c.imgs.length||c.upN)media=`
    <div class="pc-stage">
      <div class="pc-track ${c.tagMode?"tagging":""}" id="pctrack">${c.imgs.map((im,i)=>`<div class="pc-slide"><img src="${esc(im.url||im.thumb)}" alt="">${pcVidMark(im)}${pcPinsHTML(c,i)}</div>`).join("")}
        ${c.upN&&!c.imgs.length?`<div class="pc-slide pc-busy"><span class="spin"></span></div>`:""}</div>
      ${c.imgs.length>1?`<span class="pc-count" id="pccount">${c.idx+1}/${c.imgs.length}</span>`:""}
      ${c.imgs.length&&!(c.imgs[c.idx]||{}).gif&&!(c.imgs[c.idx]||{}).busy&&!(c.imgs[c.idx]||{}).video?`<button class="pc-edit" data-pcedit aria-label="Edit photo">${PC_EDIT}<span>Edit</span></button>`:""}
    </div>
    <div class="pc-strip">
      ${c.imgs.map((im,i)=>`<div class="pc-th ${i===c.idx?"on":""}${im.busy?" pc-busy":""}" data-pci="${i}"><button class="pc-thb" data-pcgo="${i}" aria-label="${im.video||im.isv?"Video":"Photo"} ${i+1}"><img src="${esc(im.thumb)}" alt="" draggable="false">${pcVidMark(im)}</button>
        ${im.busy?`<span class="spin"></span>`:`<button class="pc-rm sm" data-pcrm="${i}" aria-label="Remove photo">${PC_X}</button>`}</div>`).join("")}
      ${c.imgs.length<10?`<label class="pc-th pc-add" aria-label="Add photos or videos">${UI_IC.plus}${file}</label>`:""}
    </div>`;
  else if(pcCover(c))media=`<div class="pc-stage"><img class="pc-cov" src="${esc(pcCover(c))}" alt="${esc(c.track.title)} — cover"><span class="pc-covtag">${UI_IC.music} Song cover</span></div>
    <label class="pc-pick pc-pick-sm">${file}<b>Add photos or video instead</b></label>`;
  else media=`${pdRowHTML(c)}<label class="pc-pick">${file}${PC_PICK}<b>Add photos or video</b><span>Up to 10 photos and videos</span></label>`;
  const tags=c.tags||[];

  /* Where people see it (2026-10-21, "make sharing into labs and posting on profiles
     cohesive"): every post lives on your profile; a lab is where you also show it.
     Your profile is fixed; one lab can be added (the one you're standing in comes
     already added). "Share" is for sending things out, never for this. */
  const to=`<div class="pc-to" id="pcto"><span class="pc-to-l">Posting to</span>
      <span class="pc-chip pc-me">${avHTML(ME,"")}Your profile</span>
      ${c.ch?`<span class="pc-chip pc-labchip"><i class="lg">//</i>${esc(c.ch.lab)}<button data-pclabrm aria-label="Take it out of ${esc(c.ch.lab)}">${PC_X}</button></span><button class="pc-chip pc-add2" id="pclab" aria-label="Change lab">${DI.edit}</button>`
        :`<button class="pc-chip pc-add2" id="pclab">${DI.plus}<span>Add a lab</span></button>`}
    </div>`;
  return `<div class="pcmp-ov" id="pcov"><div class="pc${c.edit?" pce"+(c.tagMode?" pce-tag":""):""}" role="dialog" aria-label="${c.edit?"Edit info":"New post"}">
    ${c.edit?pceHead(c):formHead({id:"pccancel",label:"Cancel"},"New post",{id:"pcgo",label:c.busy?"Posting…":"Post",disabled:!pcCan(c)})}
    <div class="pc-body"><div class="pc-media">${media}</div><div class="pc-side">
      ${to}
      <div class="pc-cap">${c.edit?pceThumb(c):avHTML(ME,"")}
        <textarea class="pc-ta" id="pcbody" rows="3" maxlength="${PC_CAP_MAX}" placeholder="Write a caption… #tag it so people find it">${esc(c.body||"")}</textarea></div>${pcCapCountHTML(c)}
      <div class="pc-ment" id="pcment" hidden></div>
      <div class="pc-opts">
        <button class="pc-opt" id="pccollab"><span class="pc-ic">${IG_COLLAB}</span><span class="pc-l">Invite collaborators</span>
          <span class="pc-v">${c.collabs.length?c.collabs.length+" invited":""}</span>${PC_CHEV}</button>
        ${c.collabs.length?`<div class="pc-chips">${c.collabs.map((u,i)=>`<span class="pc-chip">${avHTML(u,"")}@${esc(u.username)}
          <button data-pccrm="${i}" aria-label="Remove">${PC_X}</button></span>`).join("")}</div>`:""}
        ${c.track?`<div class="pc-opt pc-on"><button class="pc-ic pc-pp" data-pcmusplay aria-label="${pcPvOn(c.track.id)?"Pause":"Play"}">${pcPvOn(c.track.id)?DI.pause:DI.play}</button>
            <span class="pc-l"><b>${esc(c.track.title)}</b><span class="dim">@${esc(c.track.by.username)}</span></span>
            <button class="pc-x" data-pcmusrm aria-label="Remove music">${PC_X}</button></div>${pcPartHTML(c)}`
          :`<button class="pc-opt" data-pcmusadd><span class="pc-ic">${UI_IC.music}</span><span class="pc-l">Add music</span><span class="pc-v"></span>${PC_CHEV}</button>`}
        ${c.musup?`<div class="pc-mus"><div class="pcmus-up busy"><span class="spin"></span><b>Uploading your song…</b></div></div>`:""}
        ${c.pick&&!c.musup?`<div class="pc-mus"><label class="pcmus-up"><span class="pc-ic">${UI_IC.plus}</span><span class="pc-l"><b>Upload a song</b><span class="dim">Then name it and add a cover</span></span><input type="file" id="pcmusfile" accept="${TRACK_ACCEPT}" hidden></label>
          <input class="pc-q" id="pcmusq" placeholder="Search tracks or artists" value="${esc(c.q||"")}">
          <div class="pcmus-list">${pcmusRowsHTML(c.list,!!(c.q&&c.q.trim()))}</div></div>`:""}
        <button class="pc-opt" id="pctag"><span class="pc-ic">${PC_TAG}</span><span class="pc-l">Tag people</span>
          <span class="pc-v">${tags.length?tags.length+" tagged":""}</span>${PC_CHEV}</button>
        ${tags.length?`<div class="pc-chips">${tags.map((u,i)=>`<span class="pc-chip">${avHTML(u,"")}@${esc(u.username)}${u.x!=null?` <span class="dim">· on the photo</span>`:""}
          <button data-pctrm="${i}" aria-label="Remove">${PC_X}</button></span>`).join("")}</div>`:""}
        <button class="pc-opt" id="pcshop"><span class="pc-ic">${UI_IC.navMarket}</span><span class="pc-l">Tag products</span>
          <span class="pc-v">${(c.products||[]).length?(c.products.length+" tagged"):"From your shop"}</span>${PC_CHEV}</button>
        ${(c.products||[]).length?`<div class="pc-chips">${c.products.map((l,i)=>`<span class="pc-chip pc-prod"><img src="${esc(l.images[0]||"")}" alt="">${esc(l.title)} · ${money(l.price)}
          <button data-pcprm="${i}" aria-label="Remove">${PC_X}</button></span>`).join("")}</div>`:""}
        <button class="pc-opt" id="pcloc"><span class="pc-ic">${PC_PIN}</span><span class="pc-l">${c.location?`<b>${esc(c.location)}</b>`:"Add location"}</span>
          ${c.location?`<span class="pc-x" data-pclocx aria-label="Remove location">${PC_X}</span>`:PC_CHEV}</button>
        ${c.vid&&!c.edit?`<button class="pc-opt" id="pccov"><span class="pc-ic">${c.cover?`<img class="pc-covth" src="${esc(c.cover)}" alt="">`:PC_PICK.replace(/40/g,"22")}</span><span class="pc-l">Cover</span>
          <span class="pc-v">${c.cover?"Change":"First frame"}</span>${PC_CHEV}</button>
          <button class="pc-opt" id="pcved"><span class="pc-ic">${PC_EDIT}</span><span class="pc-l">Edit video</span>
          <span class="pc-v">${vedSummary(c.vedit)}</span>${PC_CHEV}</button>`:""}
        ${pcIgRowsHTML(c)}
      </div>
    </div></div>
  </div></div>`;
}

/* Picker rows, extracted so the search box can repaint just the list without
   a full render() stealing the keyboard mid-word. */
function pcmusRowsHTML(list,searching){
  if(!list)return `${skel()}`;
  if(!list.length)return searching
    ?`<div class="empty">No tracks match that.</div>`
    :`<div class="empty">No tracks in the library yet.<br>Upload yours above.</div>`;
  if(!searching)list=[...list].sort((a,b)=>(b.by.username===myName())-(a.by.username===myName()));   // your songs first (2026-10-11)
  return list.map(t=>`<div class="pcmus-row" data-pcmuspick="${t.id}"><div class="trk-art">${t.artworkUrl?`<img src="${esc(t.artworkUrl)}" alt="">`:DI.music}</div><div class="pcmus-meta"><div class="pcmus-t">${esc(t.title)}</div><div class="dim">@${esc(t.by.username)}${t.durationMs?" · "+mmss(t.durationMs):""}</div></div>${pcPrevBtn(t)}</div>`).join("");   // ▶ listens first (app/compose/preview.js)
}

function wirePCompose(){
  const ov=$("#pcov");if(!ov){if(PED&&!PCOMPOSE)pedClose();pcPrevStop();return}const c=PCOMPOSE;
  const syncGo=()=>{const g=$("#pcgo");if(g)g.disabled=!pcCan(c)};

  /* ── media ── */
  /* photos, a video, or both in one carousel (app/compose/post-mixed) */
  const fi=$("#pcfile");if(fi)fi.onchange=()=>{const files=[...fi.files];fi.value="";pcPick(c,files)};
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
  const vr=document.querySelector("[data-pcvidrm]");if(vr)vr.onclick=()=>{c.vid=null;c.cover=null;c.vedit=null;render()};
  const dr=$("#pcdrafts");if(dr)dr.onclick=()=>pdOpen(c);

  /* ── video cover: scrub to a frame, keep it ── */
  /* Trim, cover, sound, frame — the video editor (app/compose/video-edit). */
  const cv=$("#pccov");if(cv)cv.onclick=()=>vedOpen(c,"cover");
  const vd=$("#pcved");if(vd)vd.onclick=()=>vedOpen(c,"trim");
  const ve=document.querySelector("[data-pcvedit]");if(ve)ve.onclick=()=>vedOpen(c,"trim");

  /* ── tag people, location, comments ── */
    const tg=$("#pctag");if(tg)tg.onclick=()=>pcTagStart(c);   // on the picture when there is one (app/compose/composer-ig)
  document.querySelectorAll("[data-pctrm]").forEach(b=>b.onclick=()=>{c.tags.splice(+b.dataset.pctrm,1);render()});
  const lc=$("#pcloc");if(lc)lc.onclick=async e=>{
    if(e.target.closest("[data-pclocx]")){c.location="";return render()}
    const v=await uiPrompt("Add location",{placeholder:"City, venue or studio",value:c.location||"",okLabel:"Add"});
    if(v!=null&&PCOMPOSE===c){c.location=v.replace(/\s+/g," ").trim().slice(0,60);render()}};
  pcIgWire(c);   // preview, Story after, advanced settings, pins (app/compose/composer-ig)
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
    const h=/(^|\s)#([a-z0-9_]{0,30})$/i.exec(ta.value.slice(0,ta.selectionStart));
    clearTimeout(mt);
    /* # suggests the tags people already use (in the lab you're sharing to) */
    if(h){mt=setTimeout(async()=>{let tg=[];try{tg=(await papi.tags(c.ch?(labOfCh(c.ch.id)||{}).id:"",h[2])).tags||[]}catch(e){}
      if(!mb||PCOMPOSE!==c)return;
      mb.innerHTML=tg.slice(0,6).map(t=>`<button class="pc-mrow pc-trow" data-pctag="${esc(t.tag)}"><span class="pc-hash">#</span><span><b>#${esc(t.tag)}</b><span class="dim">${t.count} ${t.count===1?"post":"posts"}</span></span></button>`).join("");
      mb.hidden=!tg.length;
      mb.querySelectorAll("[data-pctag]").forEach(x=>x.onmousedown=e=>{e.preventDefault();
        const pos=ta.selectionStart,before=ta.value.slice(0,pos).replace(/#([a-z0-9_]{0,30})$/i,"#"+x.dataset.pctag+" ");
        ta.value=before+ta.value.slice(pos);c.body=ta.value;ta.setSelectionRange(before.length,before.length);
        mb.hidden=true;mb.innerHTML="";grow();syncGo();ta.focus()})},200);return}
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
    /* Labs are places: pick the genre, tag the rest with #hashtags. Your labs first. */
    const items=[];
    for(const l of labsOrdered()){const ch=labHome(l);
      items.push({label:labMark(l.name),sub:(LAB_ID[l.id]||{}).for||"",icon:"//",ch:{id:ch.id,label:l.name,lab:l.name}})}
    openPicker({eyebrow:"POSTING TO",title:"Add a lab",note:"It stays on your profile either way — a lab is where people also see it.",items,onPick:it=>{if(PCOMPOSE===c){c.ch=it.ch;render()}}});
  };
  const lrm=document.querySelector("[data-pclabrm]");if(lrm)lrm.onclick=()=>{c.ch=null;render()};
  const ma=document.querySelector("[data-pcmusadd]");if(ma)ma.onclick=async()=>{
    c.pick=!c.pick;render();
    if(c.pick&&!c.list){try{c.list=(await api.tracks("")).tracks}catch(e){c.list=[]}render()}};
  const pickTrack=el=>el.onclick=()=>{c.track=(c.list||[]).find(t=>String(t.id)===el.dataset.pcmuspick)||null;c.pick=false;c.musStart=0;
    if(PCPV&&(!c.track||PCPV.id!==c.track.id))pcPrevStop();   // the one you were hearing carries on if it's the one you picked
    render()};
  document.querySelectorAll("[data-pcmuspick]").forEach(pickTrack);
  const mq=$("#pcmusq");if(mq){let dq=null;mq.oninput=()=>{c.q=mq.value;clearTimeout(dq);
    dq=setTimeout(async()=>{try{c.list=(await api.tracks(c.q)).tracks}catch(e){c.list=[]}
      const box=document.querySelector(".pcmus-list");   // repaint rows only — keeps the keyboard up
      if(box){box.innerHTML=pcmusRowsHTML(c.list,!!c.q.trim());box.querySelectorAll("[data-pcmuspick]").forEach(pickTrack)}},300)}}
  const mf=$("#pcmusfile");if(mf)mf.onchange=async()=>{
    const file=mf.files&&mf.files[0];mf.value="";
    if(!file||!trackFileOk(file))return;
    c.musup=true;c.pick=false;render();
    try{
      const t=await uploadTrackFile(file);
      c.musup=false;c.list=null;
      if(t){c.track=t;if(PCOMPOSE===c&&!t.existing)TRKEDIT={id:t.id,title:t.title,artworkUrl:"",busy:false,fresh:true}}
      render();
    }catch(e){c.musup=false;render();toast(e.message||"Upload failed")}
  };
  const mr=document.querySelector("[data-pcmusrm]");if(mr)mr.onclick=()=>{c.track=null;c.musStart=0;pcPrevStop();render()};
  const mp=document.querySelector("[data-pcmusplay]");if(mp)mp.onclick=()=>pcPrevToggle(c.track,c.musStart||0);
  pcPartWire(c);   // which part of the song (app/compose/preview)

  /* No scrim dismiss — Cancel is the way out, and it asks before binning a draft. */
  const cc=$("#pccancel");if(cc)cc.onclick=async()=>{if(await pcLeave())render()};

  /* ── share ── */
  const go=$("#pcgo");if(go)go.onclick=async()=>{
    if(c.edit)return pceSave(c);   // saves in place (app/compose/post-edit)
    if(!pcCan(c)){if(!c.busy)toast("Add a photo, a video, or write something");return}
    pqSubmit(c);   // closes now; posts in the background (app/compose/queue.js)
  };
}
