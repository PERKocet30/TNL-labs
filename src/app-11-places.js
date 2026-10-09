/* ================================================================
   PLACES v1.1 — 2026-10-09. A lab is a place — a genre — not a Discord
   server full of channels. Familiar like Instagram, ours in the details.
   v1.1, simpler: one list of genres, each explained by its #hashtags,
   and inside a lab just two tabs —
     Work   everything made here, a grid; tap a #tag to narrow it
     Talk   one conversation, like a group DM (the old rooms, merged)
   (Open and Pulse are gone for now.) People #tag their own work.
   Old channel ids still hold every post (they never change) — each lab
   just has a home channel new talk goes to. Music's Work is its tracks
   library; Visual keeps the archive and boards one tap from Work.
   Server: server-10-places.js. Styles: app-05-styles-places.css.
================================================================ */
const LAB_HOME={hq:"general",pharmacy:"creators",culture:"music-chat",fashion:"clothing-design",akatsuki:"anime-chat",casino:"news",tna:"opportunities"};
const labHome=l=>l?(l.channels.find(c=>c.id===LAB_HOME[l.id])||l.channels[0]):null;
const labOfCh=id=>LABS.find(l=>l.channels.some(c=>c.id===id))||null;
const labUnread=l=>l.channels.reduce((n,c)=>n+(UNREADS[c.id]||0),0);
let LABVIEW="work", LABTAG=null, PLACE={}, TAGVIEW=null, LABTAGS=null;
const PLV=[["work","Work"],["talk","Talk"]];
const papi={
  feed:l=>req("/api/labs/"+l+"/feed"),
  work:(l,t)=>req("/api/labs/"+l+"/work"+(t?"?tag="+encodeURIComponent(t):"")),
  labTags:()=>req("/api/labs/tags"),
  tag:t=>req("/api/tags/"+encodeURIComponent(t)),
  tags:(lab,q)=>req("/api/tags?lab="+encodeURIComponent(lab||"")+"&q="+encodeURIComponent(q||"")),
};

/* Which channel the open tab works on: Talk → the home channel; Music's
   Work → the tracks library; the archive → its own. */
function placeCH(){if(!LAB)return;
  CH=LABVIEW==="archive"?(LAB.channels.find(c=>c.archive)||labHome(LAB))
    :LABVIEW==="work"&&LAB.channels.some(c=>c.library)?LAB.channels.find(c=>c.library)
    :labHome(LAB)}
function openLab(id,view,tag){
  const l=LABS.find(x=>x.id===id);if(!l)return;
  if(guest())return needAccount("Join to step into the labs.");
  pushView("lab",l.id);
  TAB="labs";LAB=l;LABVIEW=view||"work";LABTAG=tag||null;TAGVIEW=null;ROOMOPEN=true;
  PROFILE=null;POSTOPEN=null;OPENCOMMENTS=null;placeCH();
  render();loadPlace();if(!LABTAGS)loadLabTags();
}
function setLabView(v){if(!LAB)return;LABVIEW=v;if(v!=="work")LABTAG=null;placeCH();render();loadPlace()}
const placeKey=()=>LABVIEW+(LABVIEW==="work"?":"+(LABTAG||""):"");
async function loadPlace(){
  if(!LAB)return;const lab=LAB.id,v=LABVIEW,key=placeKey();
  if(v==="talk")return loadFeed(true);
  if(v==="archive"){loadArchive();if(!BOARDS)loadBoards();return}
  if(v==="work"&&CH&&CH.library)return;   // the tracks library loads itself
  const P=PLACE[lab]||(PLACE[lab]={});
  try{const d=await papi.work(lab,LABTAG);
    P[key]=d}catch(e){P[key]=P[key]||{error:e.message||"Couldn't load this."}}
  if(LAB&&LAB.id===lab&&placeKey()===key)paintPlace();
}
/* Repaint just the tab's body: the header and your place stay put. */
function paintPlace(){const b=$("#plbody");if(b){b.innerHTML=placeBodyHTML();wirePlace()}else render()}

function placeTabsHTML(){
  return `<div class="pl-tabs" role="tablist">${PLV.map(([k,n])=>{const on=LABVIEW===k||(k==="work"&&LABVIEW==="archive");
    return `<button class="pl-tab ${on?"on":""}" role="tab" aria-selected="${on}" data-pltab="${k}">${n}${k==="talk"&&!on&&labUnread(LAB)?`<i class="lr-dot" aria-label="new"></i>`:""}</button>`}).join("")}</div>`;
}
const plThumb=p=>{const im=(p.images&&p.images[0])||null;return p.thumbUrl||(im&&(im.thumb||im.url))||p.imageUrl||""};
function plTileHTML(p){const src=plThumb(p);
  return `<button class="pl-tile" data-plpost="${p.id}" aria-label="Open">${src?`<img src="${esc(src)}" alt="" loading="lazy" decoding="async">`
    :`<span class="pl-txt">${esc((p.body||"").slice(0,90))}</span>`}
    ${p.images&&p.images.length>1?`<i class="pl-multi" aria-hidden="true"></i>`:""}${p.videoUrl?`<i class="pl-vid" aria-hidden="true">${DI.play}</i>`:""}</button>`}
const plGridHTML=list=>`<div class="pl-grid">${list.map(plTileHTML).join("")}</div>`;
const plChip=(t,on,n)=>`<button class="pl-chip ${on?"on":""}" data-pltag="${esc(t)}">${t?"#"+esc(t):"All"}${n?`<span>${n}</span>`:""}</button>`;
const plEmpty=(h,p)=>`<div class="empty estate"><div class="eh">${esc(h)}</div><div class="ep">${esc(p)}</div></div>`;
const plErr=d=>d&&d.error?plEmpty("Couldn't load this.",d.error):"";
/* A genre's tags: its own (the ones that explain it) first, then
   whatever else people tag their work with here. */
let LABTAGSBUSY=false;
async function loadLabTags(){if(LABTAGSBUSY)return;LABTAGSBUSY=true;
  try{LABTAGS=(await papi.labTags()).tags;if($("#lxlist")&&TAB==="labs"&&!LAB)render()}catch(e){}finally{LABTAGSBUSY=false}}
function labTagList(lab,used){
  const out=[...((LABTAGS&&LABTAGS[lab])||[])];
  for(const t of (used||[]))if(!out.includes(t.tag))out.push(t.tag);
  return out.slice(0,12);
}

/* The archive and the tracks library bring their own scroller; the rest
   scroll in one of ours. */
function placeBodyHTML(){
  if(LABVIEW==="archive")return `<button class="pl-link pl-back" id="plwork">${DI.back||"←"} Back to the work</button>${archiveHTML()}`;
  if(LABVIEW==="work"&&CH&&CH.library)return tracksHTML();
  return `<div class="scroll pl-scroll" id="plscroll">${plInnerHTML()}</div>`;
}
function plInnerHTML(){
  const P=PLACE[LAB.id]||{}, d=P[placeKey()];
  if(LABVIEW==="work"){
    const chips=labTagList(LAB.id,d&&d.tags);
    if(LABTAG&&!chips.includes(LABTAG))chips.unshift(LABTAG);
    return `<p class="pl-for">${esc((LAB_ID[LAB.id]||{}).for||"")}</p>
      ${chips.length?`<div class="pl-tags">${plChip("",!LABTAG)}${chips.map(t=>plChip(t,LABTAG===t)).join("")}</div>`:""}
      ${LAB.channels.some(c=>c.archive)?`<button class="pl-link" id="plarchive">Search the archive and your boards</button>`:""}
      ${!d?`<div class="pl-grid">${Array.from({length:9},()=>`<i class="pl-tile sk-img"></i>`).join("")}</div>`
        :d.error?plErr(d):d.posts.length?plGridHTML(d.posts)
        :LABTAG?plEmpty("Nothing tagged #"+LABTAG+" here yet.","Tag your work with #"+LABTAG+" when you post it.")
        :plEmpty("No work here yet.","Post a piece and share it to "+labMark(LAB.name)+". Tag it so people find it.")}`;
  }
  return "";
}

function wirePlace(){
  const on=(s,fn)=>{const el=$(s);if(el)el.onclick=fn};
  document.querySelectorAll("[data-pltab]").forEach(b=>b.onclick=()=>{if(b.dataset.pltab!==LABVIEW)setLabView(b.dataset.pltab)});
  document.querySelectorAll("[data-pltag]").forEach(b=>b.onclick=()=>{LABTAG=b.dataset.pltag||null;LABVIEW="work";placeCH();
    if(!$("#plbody"))return render(),loadPlace();
    document.querySelectorAll("[data-pltab]").forEach(t=>t.classList.toggle("on",t.dataset.pltab==="work"));paintPlace();loadPlace()});
  const all=()=>{const P=PLACE[LAB&&LAB.id]||{};return Object.values(P).flatMap(d=>d&&!d.error?(d.posts||[]):[])};
  document.querySelectorAll("[data-plpost]").forEach(b=>b.onclick=()=>{const id=Number(b.dataset.plpost);
    const p=all().find(x=>x.id===id)||(TAGVIEW&&TAGVIEW.d&&TAGVIEW.d.posts.find(x=>x.id===id));if(p)openPost(p)});
  on("#plarchive",()=>setLabView("archive"));
  on("#plwork",()=>setLabView("work"));
  if(TAGVIEW){on("#tagback",()=>history.back());
    document.querySelectorAll("[data-taglab]").forEach(b=>b.onclick=()=>openLab(b.dataset.taglab,"work",TAGVIEW.tag))}
}

/* Posting from inside a lab shares to that lab by default. */
function pcLabNow(){if(TAB!=="labs"||!LAB)return null;const h=labHome(LAB);return {id:h.id,label:LAB.name,lab:LAB.name,auto:true}}   // auto: not a draft by itself

/* ---- a #tag across every lab, like a hashtag page ---- */
function openTag(t){
  t=String(t||"").toLowerCase().replace(/^#/,"");if(!t)return;
  if(guest())return needAccount("Join to explore #"+t+".");
  pushView("tag",t);
  const from={tab:TAB,lab:TAB==="labs"&&LAB?LAB.id:null,view:LABVIEW,tag:LABTAG};
  TAB="labs";LAB=null;ROOMOPEN=false;TAGVIEW={tag:t,d:null,from};PROFILE=null;POSTOPEN=null;OPENCOMMENTS=null;render();
  papi.tag(t).then(d=>{if(TAGVIEW&&TAGVIEW.tag===t){TAGVIEW.d=d;render()}}).catch(e=>{if(TAGVIEW&&TAGVIEW.tag===t){TAGVIEW.d={error:e.message};render()}});
}
/* Back from a tag page lands where you came from — the lab and tab, or
   the Showroom. */
function closeTag(){const f=TAGVIEW&&TAGVIEW.from;TAGVIEW=null;if(!f)return;TAB=f.tab;
  if(f.lab){LAB=LABS.find(l=>l.id===f.lab)||null;if(LAB){LABVIEW=f.view;LABTAG=f.tag;ROOMOPEN=true;placeCH();setTimeout(loadPlace,0)}}}
function tagHTML(){
  const T=TAGVIEW,d=T.d;
  return `<div class="scroll pl-tagpage" id="tagscroll"><div class="lr-head"><button class="lr-back" id="tagback" aria-label="Back">${DI.back||"←"}</button>
    <div class="lr-title">#${esc(T.tag)}</div></div>
    ${!d?skel():d.error?plErr(d):`<div class="pl-tagh"><b>${d.count}</b> ${d.count===1?"post":"posts"}
      <div class="pl-tags wrap">${Object.entries(d.labs).sort((a,b)=>b[1]-a[1]).map(([id,n])=>{const l=LABS.find(x=>x.id===id);
        return l?`<button class="pl-chip" data-taglab="${id}">${esc(labMark(l.name))}<span>${n}</span></button>`:""}).join("")}</div></div>
      ${d.posts.length?plGridHTML(d.posts):plEmpty("Nothing tagged #"+T.tag+" yet.","Be the first — add #"+T.tag+" to your caption.")}`}</div>`;
}
/* Any #tag anywhere opens its page. */
let PLDELEG=false;
function wirePlacesGlobal(){
  if(PLDELEG)return;PLDELEG=true;
  document.addEventListener("click",e=>{const t=e.target.closest&&e.target.closest("[data-tag]");if(!t)return;
    e.preventDefault();e.stopPropagation();openTag(t.dataset.tag)},true);
  /* a genre's #tag on the labs list: that lab's work, narrowed to it */
  document.addEventListener("click",e=>{const t=e.target.closest&&e.target.closest("[data-labtag]");if(!t)return;
    e.preventDefault();e.stopPropagation();openLab(t.dataset.labtag,"work",t.dataset.t)},true);
  document.addEventListener("keydown",e=>{if(e.key!=="Enter")return;const l=e.target.closest&&e.target.closest("div.lx[data-lab]");if(l)openLab(l.dataset.lab)});
}
