/* ── VIDEO EDITOR · 2026-10-08 ─────────────────────────────────────────
   Instagram's video edit step, kept simple: Trim (drag the two handles on
   a strip of frames), Cover (scrub to a frame, or pick a photo from the
   camera roll), Sound (the original sound on or off) and Frame (original,
   square, 4:5, 9:16, 16:9 — filled, like the feed shows it). Nothing is
   re-encoded: the choices ride on the post (posts.extras.video) and every
   player honours them, so the upload stays the full-quality original and
   Done is instant. Same layer and look as the photo editor. */
const VED_RATIOS=[["orig","Original"],["1:1","Square"],["4:5","4:5"],["9:16","9:16"],["16:9","16:9"]];
const VED_STRIP=8;
const vedNew=()=>({start:0,end:0,muted:false,ratio:"orig"});
let VED=null;
const vedT=ms=>{const s=Math.max(0,Math.round(ms/1000));return Math.floor(s/60)+":"+String(s%60).padStart(2,"0")};

function vedHTML(){
  const e=VED.e,t=VED.tab,d=VED.dur||0,end=e.end||d,r=VRATIO[e.ratio];
  const strip=(inputs)=>`<div class="ved-strip" id="vedstrip"><div class="ved-thumbs">${(VED.thumbs||[]).map(u=>`<img src="${u}" alt="">`).join("")}</div>${inputs}</div>`;
  const panel=t==="trim"?`${strip(`<i class="ved-shade" style="left:0;width:${d?e.start/d*100:0}%"></i><i class="ved-shade" style="right:0;width:${d?(d-end)/d*100:0}%"></i>
        <input type="range" class="ved-h" data-vedh="start" min="0" max="${d}" step="100" value="${e.start}" aria-label="Start">
        <input type="range" class="ved-h" data-vedh="end" min="0" max="${d}" step="100" value="${end}" aria-label="End">`)}
      <div class="ved-times"><span id="vedts">${vedT(e.start)}</span><b id="vedlen">${vedT(end-e.start)}</b><span id="vedte">${vedT(end)}</span></div>
      <div class="ped-hint">Drag the ends to trim. Nothing is cut from your file.</div>`
    :t==="cover"?`${strip(`<input type="range" class="ved-h ved-one" id="vedc" min="0" max="${d}" step="50" value="${VED.at||0}" aria-label="Pick a frame">`)}
      <div class="ved-cov">${VED.c.cover?`<img class="ved-covth" src="${esc(VED.c.cover)}" alt="Current cover">`:""}
        <button class="pc-share" id="vedcok"${VED.busy?" disabled":""}>${VED.busy?"Saving…":"Use this frame"}</button>
        <label class="chip ved-roll">From camera roll<input type="file" accept="image/*" id="vedcf" hidden></label></div>`
    :t==="sound"?`<label class="pc-opt pc-sw-row"><span class="pc-l">Original sound</span><input type="checkbox" class="pf-sw" id="vedsnd" ${e.muted?"":"checked"}></label>
      <div class="ped-hint">${VED.c.track?`Your music, “${esc(VED.c.track.title)}”, plays with it${e.muted?" on its own":""}.`:"Off: the video plays silent, and there's no sound button on it."}</div>`
    :`<div class="ped-row">${VED_RATIOS.map(([k,l])=>`<button class="chip${e.ratio===k?" on":""}" data-vedr="${k}">${l}</button>`).join("")}</div>
      <div class="ped-hint">How it's framed in the feed. The full video is kept.</div>`;
  return `<div class="ped ved" role="dialog" aria-label="Edit video">
    <header class="pc-top"><button class="pc-cancel" id="vedx">Cancel</button><div class="pc-ttl">Edit video</div><button class="pc-share" id="vedok">Done</button></header>
    <div class="ped-stage ved-stage" id="vedstage"><div class="ved-frame${r?" vfill":""}" style="${r?`aspect-ratio:${r}`:VED.ar?`aspect-ratio:${VED.ar}`:""}">
      <video id="vedv" src="${esc(VED.c.vid.url)}" playsinline preload="auto" crossorigin="anonymous"${VED.c.cover?` poster="${esc(VED.c.cover)}"`:""}></video>
      <span class="ved-play" id="vedplay" aria-hidden="true">${DI.play}</span></div></div>
    <div class="ped-tabs">${[["trim","Trim"],["cover","Cover"],["sound","Sound"],["frame","Frame"]].map(([k,l])=>`<button class="ped-tab${t===k?" on":""}" data-vedt="${k}">${l}</button>`).join("")}</div>
    <div class="ped-panel">${panel}</div>
    <button class="ped-reset" id="vedreset">Reset</button>
  </div>`}

function vedPaint(){
  let l=document.getElementById("vedl");
  if(!l){l=document.createElement("div");l.id="vedl";document.body.appendChild(l)}
  const was=l.querySelector("#vedv"),at=was?was.currentTime:null,playing=was&&!was.paused;
  l.innerHTML=VED?vedHTML():"";
  document.body.classList.toggle("ped-on",!!VED);
  if(!VED)return;
  const v=$("#vedv");
  v.muted=VED.e.muted;
  v.onloadedmetadata=()=>{
    if(!VED)return;
    const first=!VED.dur;VED.dur=Math.round(v.duration*1000)||0;VED.ar=v.videoWidth?v.videoWidth+"/"+v.videoHeight:"";
    VED.c.vw=v.videoWidth||VED.c.vw;VED.c.vh=v.videoHeight||VED.c.vh;
    if(first){vedPaint();vedThumbs()}else v.currentTime=at!=null?at:VED.e.start/1000;
  };
  if(at!=null&&v.readyState>=1)v.currentTime=at;
  if(playing)v.play().catch(()=>{});
  vedWire();
}
/* The strip of frames under Trim and Cover — drawn once from a second,
   hidden copy of the video, so the preview keeps playing. */
async function vedThumbs(){
  if(!VED||VED.thumbs||!VED.dur)return;
  const v=document.createElement("video");v.muted=true;v.playsInline=true;v.preload="auto";v.crossOrigin="anonymous";v.src=VED.c.vid.url;
  const seek=t=>new Promise(ok=>{const done=()=>{v.onseeked=null;ok()};v.onseeked=done;v.currentTime=t;setTimeout(done,1500)});
  try{
    await new Promise((ok,no)=>{v.onloadeddata=ok;v.onerror=no;setTimeout(ok,4000)});
    const cn=document.createElement("canvas"),h=56,w=Math.round(h*(v.videoWidth||16)/(v.videoHeight||9));cn.width=w;cn.height=h;
    const out=[];
    for(let i=0;i<VED_STRIP;i++){if(!VED)return;await seek((i+.5)/VED_STRIP*v.duration);
      cn.getContext("2d").drawImage(v,0,0,w,h);out.push(cn.toDataURL("image/jpeg",.6))}
    if(VED){VED.thumbs=out;const s=document.querySelector(".ved-thumbs");if(s)s.innerHTML=out.map(u=>`<img src="${u}" alt="">`).join("")}
  }catch(e){}
  v.removeAttribute("src");v.load();
}
function vedWire(){
  const e=VED.e,v=$("#vedv"),d=()=>VED.dur||0;
  $("#vedx").onclick=()=>vedClose();
  $("#vedok").onclick=vedDone;
  $("#vedreset").onclick=()=>{VED.e=vedNew();vedPaint()};
  document.querySelectorAll("[data-vedt]").forEach(b=>b.onclick=()=>{VED.tab=b.dataset.vedt;vedPaint()});
  /* Tap the picture: play / pause, inside the trim. */
  const st=$("#vedstage"),pl=$("#vedplay");
  const sync=()=>{if(pl)pl.style.opacity=v.paused?"1":"0"};
  st.onclick=()=>{if(v.paused){if(v.currentTime<e.start/1000||(e.end&&v.currentTime>=e.end/1000))v.currentTime=e.start/1000;v.play().catch(()=>{})}else v.pause()};
  v.onplay=v.onpause=sync;sync();
  v.ontimeupdate=()=>{if(e.end&&v.currentTime>=e.end/1000){v.pause();v.currentTime=e.start/1000}};
  v.onended=()=>{v.currentTime=e.start/1000};
  /* Trim: two handles; they can't cross, and keep at least a second. */
  document.querySelectorAll("[data-vedh]").forEach(h=>h.oninput=()=>{
    const k=h.dataset.vedh,val=+h.value,end=e.end||d();
    if(k==="start"){e.start=Math.min(val,end-1000);h.value=e.start}
    else{const x=Math.max(val,e.start+1000);e.end=x>=d()?0:x;h.value=x}
    const en=e.end||d(),sh=document.querySelectorAll(".ved-shade");
    if(sh[0])sh[0].style.width=(d()?e.start/d()*100:0)+"%";if(sh[1])sh[1].style.width=(d()?(d()-en)/d()*100:0)+"%";
    $("#vedts").textContent=vedT(e.start);$("#vedte").textContent=vedT(en);$("#vedlen").textContent=vedT(en-e.start);
    v.pause();v.currentTime=(k==="start"?e.start:en)/1000});
  /* Cover: scrub, then keep that frame — or a photo from the camera roll. */
  const cr=$("#vedc");if(cr)cr.oninput=()=>{VED.at=+cr.value;v.pause();v.currentTime=VED.at/1000};
  const ok=$("#vedcok");if(ok)ok.onclick=async()=>{
    if(!v.videoWidth)return toast("Give the video a moment to load");
    VED.busy=true;vedPaint();
    try{const cn=document.createElement("canvas"),s=Math.min(1,1600/Math.max(v.videoWidth,v.videoHeight));
      cn.width=Math.round(v.videoWidth*s);cn.height=Math.round(v.videoHeight*s);
      cn.getContext("2d").drawImage(v,0,0,cn.width,cn.height);
      const up=await api.upload(cn.toDataURL("image/jpeg",.85));if(VED){VED.c.cover=up.url;toast("Cover set")}}
    catch(x){toast(x.message)}
    if(VED){VED.busy=false;vedPaint()}};
  const cf=$("#vedcf");if(cf)cf.onchange=async()=>{
    const f=cf.files&&cf.files[0];if(!f)return;VED.busy=true;vedPaint();
    try{const up=await uploadStream(f);if(up.kind!=="image")throw new Error("Pick a photo for the cover");if(VED){VED.c.cover=up.url;toast("Cover set")}}
    catch(x){toast(x.message)}
    if(VED){VED.busy=false;vedPaint()}};
  const snd=$("#vedsnd");if(snd)snd.onchange=()=>{e.muted=!snd.checked;v.muted=e.muted;vedPaint()};
  document.querySelectorAll("[data-vedr]").forEach(b=>b.onclick=()=>{e.ratio=b.dataset.vedr;vedPaint()});
}

/* "Trimmed · Sound off · 4:5" on the creator's row. */
function vedSummary(e){if(!e)return "Trim, sound, frame";
  return [e.start||e.end?"Trimmed":"",e.muted?"Sound off":"",e.ratio?(VED_RATIOS.find(r=>r[0]===e.ratio)||[])[1]:""].filter(Boolean).join(" · ")}
function vedOpen(c,tab){
  if(!c.vid)return;
  VED={c,e:{...vedNew(),...(c.vedit||{})},tab:tab||"trim",dur:0,thumbs:null};vedPaint();
}
function vedClose(){if(!VED&&!document.getElementById("vedl"))return;
  const v=$("#vedv");if(v){try{v.pause()}catch(e){}}VED=null;vedPaint()}
/* Done: keep only what differs from the untouched video. */
function vedDone(){
  const {c,e}=VED,out={};
  if(e.start)out.start=e.start;if(e.end)out.end=e.end;if(e.muted)out.muted=true;if(e.ratio!=="orig")out.ratio=e.ratio;
  c.vedit=Object.keys(out).length?out:null;vedClose();pcRepaint(c);
}
