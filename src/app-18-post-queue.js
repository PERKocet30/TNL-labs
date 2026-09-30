/* ── POSTING IN THE BACKGROUND + DRAFTS · 2026-09-30 ───────────────────
   Share closes the creator straight away, like Instagram: a strip at the
   top says Posting… (it waits for any photos still uploading), then
   Posted · View. If it fails nothing is lost — it's kept as a draft.
   Cancel asks Save draft / Discard / Keep editing; drafts live on this
   phone (the photos are already uploaded, so a draft is just the list). */
let PQ=[];

/* A choice sheet on its own layer: resolves the picked value, or null. */
function uiChoose(title,body,opts){
  return new Promise(resolve=>{
    const ov=document.createElement("div");ov.className="ui-ov";
    ov.innerHTML=`<div class="ui-card ui-choose" role="dialog" aria-modal="true"><div class="ui-title">${esc(title)}</div>
      ${body?`<div class="ui-body">${esc(body)}</div>`:""}
      <div class="ui-col">${opts.map((o,i)=>`<button class="ui-btn${o.danger?" ui-danger":""}${o.strong?" ui-ok":""}" data-uic="${i}">${esc(o.label)}</button>`).join("")}</div></div>`;
    document.body.appendChild(ov);
    const done=v=>{ov.remove();resolve(v)};
    ov.querySelectorAll("[data-uic]").forEach(b=>b.onclick=()=>done(opts[+b.dataset.uic].v??null));
    ov.addEventListener("click",e=>{if(e.target===ov)done(null)});
  });
}

/* ── drafts ── */
const pdKey=()=>"tnl-drafts:"+(myName()||"");
function pdList(){try{const a=JSON.parse(localStorage.getItem(pdKey())||"[]");return Array.isArray(a)?a:[]}catch(e){return []}}
function pdPut(a){try{localStorage.setItem(pdKey(),JSON.stringify(a.slice(0,20)));return true}catch(e){return false}}
const PD_KEEP=["body","imgs","vid","cover","vw","vh","track","ch","collabs","tags","location","commentsOff","products"];
function pdSave(c){
  if(c.upN||c.vidbusy){toast("Wait for the upload to finish, then save");return false}
  const d={id:c.draftId||("d"+Date.now()),at:Date.now()};
  for(const k of PD_KEEP)if(c[k]!==undefined)d[k]=c[k];
  d.imgs=(d.imgs||[]).map(({busy,...im})=>im);
  const ok=pdPut([d,...pdList().filter(x=>x.id!==d.id)]);
  toast(ok?"Saved to drafts":"Couldn't save the draft");return ok;
}
function pdDelete(id){if(id)pdPut(pdList().filter(x=>x.id!==id))}
function pdRowHTML(c){
  const n=pdList().length;
  if(!n||(c.body||"").trim()||c.imgs.length||c.vid||c.upN||c.vidbusy)return "";
  return `<button class="pc-drafts" id="pcdrafts">Drafts <span>${n}</span></button>`;
}
function pdOpen(c){
  const ds=pdList();
  openPicker({title:"Drafts",items:ds.map(d=>({label:(d.body||"").trim().slice(0,60)||"Untitled",
      sub:timeAgo(d.at)+(d.imgs&&d.imgs.length?` · ${d.imgs.length} photo${d.imgs.length>1?"s":""}`:d.vid?" · video":""),
      avatar:d.imgs&&d.imgs[0]?d.imgs[0].thumb:(d.cover||""),d})),
    onPick:it=>{if(PCOMPOSE!==c)return;Object.assign(c,JSON.parse(JSON.stringify(it.d)),{draftId:it.d.id,idx:0});render()}});
}

/* Cancel / back: save, discard, or keep going. */
async function pcLeave(){
  const c=PCOMPOSE;if(!c)return true;
  if(c.busy)return false;
  if(pcDirty()){
    const v=await uiChoose(c.draftId?"Save changes to this draft?":"Save this post as a draft?","",[
      {v:"save",label:"Save draft",strong:true},{v:"discard",label:"Discard",danger:true},{v:null,label:"Keep editing"}]);
    if(!v||PCOMPOSE!==c)return false;
    if(v==="save"&&!pdSave(c))return false;
    if(v==="discard"&&c.draftId&&await uiConfirm("Delete this draft too?","",{okLabel:"Delete draft",cancelLabel:"Keep draft",danger:true}))pdDelete(c.draftId);
  }
  c.dead=true;pedClose();PCOMPOSE=null;return true;
}

/* ── posting ── */
function pcRepaint(c){if(PCOMPOSE===c)render();else if(c.queued){pqPaint();pqKick(c)}}
function pqSubmit(c){
  pedClose();c.queued=true;c.state="waiting";PQ.push(c);PCOMPOSE=null;
  render();pqPaint();pqKick(c);
}
async function pqKick(c){
  if(!c.queued||c.state==="posting"||c.state==="done"||c.dead)return;
  if(c.upN||c.vidbusy){c.state="waiting";pqPaint();return}   // the upload finishing calls back here
  c.state="posting";pqPaint();
  try{
    const d=await api.post({channel:c.ch?c.ch.id:"profile",body:(c.body||"").trim(),images:c.imgs.map(({busy,orig,edit,...im})=>im),
      videoUrl:c.vid?c.vid.url:undefined,thumbUrl:c.vid&&c.cover?c.cover:undefined,mediaW:c.vid?c.vw:undefined,mediaH:c.vid?c.vh:undefined,
      isWork:true,audioTrackId:c.track?c.track.id:undefined,
      tags:(c.tags||[]).map(u=>u.username),location:c.location||"",commentsOff:!!c.commentsOff,products:(c.products||[]).map(l=>l.id)});
    let sent=0;const pid=d&&d.post&&d.post.id;
    if(pid)for(const u of c.collabs||[]){try{await api.invite(pid,u.username);sent++}catch(e){}}
    c.state="done";c.sent=sent;pdDelete(c.draftId);
    if(d&&d.post&&PROFILE&&PROFILE.user&&PROFILE.user.username===myName()&&PROFILE.posts){PROFILE.posts.unshift(d.post);render()}
    pqPaint();setTimeout(()=>{PQ=PQ.filter(x=>x!==c);pqPaint()},5000);
  }catch(e){
    /* Nothing lost: it stays on the strip to retry, and in drafts. */
    c.state="failed";c.err=e.message;c.draftId=c.draftId||("d"+Date.now());pdSave(c);pqPaint();
  }
}
function pqProg(c){
  if(c.state==="done")return 1;if(c.state==="posting")return .92;
  if(c.vidbusy)return .9*(c.vidprog||0);
  const n=c.imgs.length+(c.upN||0);return n?.9*c.imgs.filter(i=>!i.busy).length/n:.1;
}
function pqHTML(c,i){
  const th=c.imgs[0]?c.imgs[0].thumb:c.cover||"";
  const label=c.state==="done"?"Posted"+(c.sent?` · ${c.sent} invite${c.sent>1?"s":""} sent`:"")
    :c.state==="failed"?"Couldn't post — saved to drafts":"Posting…";
  return `<div class="pq pq-${c.state}" role="status">
    ${th?`<img src="${esc(th)}" alt="">`:`<span class="pq-t">Aa</span>`}
    <div class="pq-m"><b>${esc(label)}</b>${c.state==="done"||c.state==="failed"?"":`<i><u style="transform:scaleX(${pqProg(c).toFixed(3)})"></u></i>`}</div>
    ${c.state==="done"?`<button class="pq-b" data-pqview>View</button>`:c.state==="failed"?`<button class="pq-b" data-pqretry="${i}">Retry</button><button class="pq-x" data-pqx="${i}" aria-label="Dismiss">×</button>`:""}
  </div>`;
}
function pqPaint(){
  let l=document.getElementById("pql");
  if(!l){l=document.createElement("div");l.id="pql";document.body.appendChild(l)}
  /* Only the bar moves while it's uploading — no flicker, no rebuild. */
  const same=l._n===PQ.length&&PQ.every((c,i)=>l._s&&l._s[i]===c.state);
  if(same){l.querySelectorAll(".pq u").forEach((u,i)=>{if(PQ[i])u.style.transform=`scaleX(${pqProg(PQ[i]).toFixed(3)})`});return}
  l.innerHTML=PQ.map(pqHTML).join("");l._n=PQ.length;l._s=PQ.map(c=>c.state);
  l.querySelectorAll("[data-pqview]").forEach(b=>b.onclick=()=>{PQ=PQ.filter(c=>c.state!=="done");pqPaint();openProfile(myName())});
  l.querySelectorAll("[data-pqretry]").forEach(b=>b.onclick=()=>{const c=PQ[+b.dataset.pqretry];if(!c)return;c.state="waiting";pqPaint();pqKick(c)});
  l.querySelectorAll("[data-pqx]").forEach(b=>b.onclick=()=>{PQ.splice(+b.dataset.pqx,1);pqPaint()});
}
/* Closing the tab mid-post would lose it — ask first. */
addEventListener("beforeunload",e=>{if(PQ.some(c=>c.state==="waiting"||c.state==="posting")){e.preventDefault();e.returnValue=""}});

/* ── drag a thumbnail to reorder (hold on a phone, drag with a mouse) ── */
function pcDragWire(c){
  const strip=document.querySelector(".pc-strip");if(!strip)return;
  strip.querySelectorAll(".pc-th[data-pci]").forEach(th=>{
    let d=null,hold=0;
    const start=e=>{if(e.target.closest(".pc-rm"))return;const i=+th.dataset.pci;
      d={i,x:e.clientX,y:e.clientY,on:false,id:e.pointerId};
      hold=setTimeout(()=>{if(d)lift()},e.pointerType==="mouse"?0:220)};
    const lift=()=>{d.on=true;th.classList.add("pc-lift");try{th.setPointerCapture(d.id)}catch(e){}};
    th.onpointerdown=start;
    th.onpointermove=e=>{if(!d)return;const dx=e.clientX-d.x;
      if(!d.on){if(Math.abs(e.clientY-d.y)>8||(e.pointerType!=="mouse"&&Math.abs(dx)>8)){clearTimeout(hold);d=null}else if(e.pointerType==="mouse"&&Math.abs(dx)>6)lift();return}
      e.preventDefault();th.style.transform=`translate3d(${dx}px,0,0) scale(1.06)`};
    th.onpointerup=th.onpointercancel=e=>{clearTimeout(hold);if(!d)return;const was=d;d=null;
      if(!was.on)return;th.classList.remove("pc-lift");th.style.transform="";
      const step=th.getBoundingClientRect().width+6,to=Math.max(0,Math.min(c.imgs.length-1,was.i+Math.round((e.clientX-was.x)/step)));
      th._moved=true;setTimeout(()=>{th._moved=false},0);
      if(to===was.i)return;
      const [m]=c.imgs.splice(was.i,1);c.imgs.splice(to,0,m);c.idx=to;render()};
    th.addEventListener("click",e=>{if(th._moved){e.stopPropagation();e.preventDefault()}},true);
  });
}
