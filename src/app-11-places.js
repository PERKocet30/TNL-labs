/* ================================================================
   PLACES v1.0 — 2026-10-08. A lab is a place — a genre — not a Discord
   server full of channels. Familiar like Instagram, ours in the details.
   Inside every lab, four tabs, one for each way to take part:
     Work   everything made here, a grid; tap a #tag to narrow it
     Talk   one conversation, like a group DM (the old room, merged)
     Open   what you can join right now: events, #collab calls, gigs
     Pulse  this week: what's rising, the tags, who's making
   The sub-channels are gone from the screen; people #tag their own work.
   Old channel ids still hold every post (they never change) — each lab
   just has a home channel new talk goes to. Music's Work is its tracks
   library; Visual keeps the archive and boards one tap from Work.
   Server: server-10-places.js. Styles: app-05-styles-places.css.
================================================================ */
const LAB_HOME={hq:"general",pharmacy:"creators",culture:"music-chat",fashion:"clothing-design",akatsuki:"anime-chat",casino:"news",tna:"opportunities"};
const labHome=l=>l?(l.channels.find(c=>c.id===LAB_HOME[l.id])||l.channels[0]):null;
const labOfCh=id=>LABS.find(l=>l.channels.some(c=>c.id===id))||null;
const labUnread=l=>l.channels.reduce((n,c)=>n+(UNREADS[c.id]||0),0);
let LABVIEW="work", LABTAG=null, PLACE={}, TAGVIEW=null;
const PLV=[["work","Work"],["talk","Talk"],["open","Open"],["pulse","Pulse"]];
const papi={
  feed:l=>req("/api/labs/"+l+"/feed"),
  work:(l,t)=>req("/api/labs/"+l+"/work"+(t?"?tag="+encodeURIComponent(t):"")),
  open:l=>req("/api/labs/"+l+"/open"),
  pulse:l=>req("/api/labs/"+l+"/pulse"),
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
  render();loadPlace();if(!LABACT)loadLabs();   // the header's "this week" numbers
}
function setLabView(v){if(!LAB)return;LABVIEW=v;if(v!=="work")LABTAG=null;placeCH();render();loadPlace()}
const placeKey=()=>LABVIEW+(LABVIEW==="work"?":"+(LABTAG||""):"");
async function loadPlace(){
  if(!LAB)return;const lab=LAB.id,v=LABVIEW,key=placeKey();
  if(v==="talk")return loadFeed(true);
  if(v==="archive"){loadArchive();if(!BOARDS)loadBoards();return}
  if(v==="work"&&CH&&CH.library)return;   // the tracks library loads itself
  const P=PLACE[lab]||(PLACE[lab]={});
  try{const d=v==="work"?await papi.work(lab,LABTAG):v==="open"?await papi.open(lab):await papi.pulse(lab);
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
function plHeroHTML(){
  const id=LAB_ID[LAB.id]||{for:"",ic:""}, A=LABACT||{byChannel:{},people:{}};
  let week=0;const ppl=new Set();
  for(const c of LAB.channels){const b=A.byChannel[c.id];if(b)week+=b.week||0;for(const p of (A.people[c.id]||[]))ppl.add(p.username)}
  return `<div class="pl-hero"><span class="pl-ic">${id.ic}</span><div class="pl-hb">
    <div class="pl-for">${esc(id.for)}</div><div class="pl-meta">${week?week+" posts this week":"Quiet this week"}${ppl.size?" · "+ppl.size+" making":""}</div></div></div>`;
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
    const tags=(d&&d.tags)||[];
    const chips=LABTAG&&!tags.some(t=>t.tag===LABTAG)?[{tag:LABTAG},...tags]:tags;
    return `${plHeroHTML()}
      ${chips.length?`<div class="pl-tags">${plChip("",!LABTAG)}${chips.map(t=>plChip(t.tag,LABTAG===t.tag)).join("")}</div>`:""}
      ${LAB.channels.some(c=>c.archive)?`<button class="pl-link" id="plarchive">Search the archive and your boards</button>`:""}
      ${!d?`<div class="pl-grid">${Array.from({length:9},()=>`<i class="pl-tile sk-img"></i>`).join("")}</div>`
        :d.error?plErr(d):d.posts.length?plGridHTML(d.posts)
        :LABTAG?plEmpty("Nothing tagged #"+LABTAG+" here yet.","Tag your work with #"+LABTAG+" when you post it.")
        :plEmpty("No work here yet.","Post a piece and share it to "+labMark(LAB.name)+". Tag it so people find it.")}`;
  }
  if(!d)return skel();
  if(d.error)return plErr(d);
  if(LABVIEW==="open")return `
    ${d.events.length?`<div class="pl-sec"><h3>Happening now</h3>${d.events.map(e=>`<button class="pl-ev" data-evopen="${esc(e.slug)}">
      ${e.coverUrl?`<img src="${esc(e.coverUrl)}" alt="">`:`<span class="pl-evi">//</span>`}
      <span class="pl-evb"><span class="ev-eye"><b>//</b> Event</span><b>${esc(e.title)}</b>
        <span class="dim">${esc(({upcoming:"Coming up",submit:"Entries open",qualify:"Voting",round:"Voting",final:"The final"})[e.phase]||"")}${e.end?" · "+evLeft(e.end):""}</span></span>
      <span class="ev-go">Open</span></button>`).join("")}</div>`:""}
    <div class="pl-sec"><h3>Looking for</h3>
      ${d.calls.length?d.calls.map(p=>`<button class="pl-call" data-plcall="${p.id}">${avHTML(p.author,"sm")}
        <span class="pl-cb"><b>${esc(p.author.displayName)}</b> <span class="dim">${esc(timeAgo(p.createdAt))}</span>
        <span class="pl-cs">${esc((p.body||"").slice(0,160))}</span></span></button>`).join("")
        :`<p class="dim pl-note">No open calls right now. Looking for someone to make something with? Post it with #collab, or #gig if it's paid.</p>`}
      <button class="btn green pl-cta" id="plcall">Post a call</button></div>`;
  /* pulse */
  const tw=d.thisWeek,lw=d.lastWeek,delta=(a,b)=>a===b?"":`<span class="pl-d ${a>b?"up":""}">${a>b?"↑":"↓"}${Math.abs(a-b)}</span>`;
  return `<div class="pl-stats">${[["pieces","Pieces"],["posts","Posts"],["people","People"]].map(([k,n])=>`<div class="pl-st"><b>${tw[k]}</b><span>${n} this week ${delta(tw[k],lw[k])}</span></div>`).join("")}</div>
    <div class="pl-sec"><h3>Rising this week</h3>${d.rising.length?plGridHTML(d.rising):`<p class="dim pl-note">Nothing new this week yet. Be the first.</p>`}</div>
    ${d.tags.length?`<div class="pl-sec"><h3>Tags this week</h3><div class="pl-tags wrap">${d.tags.map(t=>plChip(t.tag,false,t.count)).join("")}</div></div>`:""}
    ${d.people.length?`<div class="pl-sec"><h3>Most active</h3><div class="pl-ppl">${d.people.map(u=>`<button class="pl-pp" data-plu="${esc(u.username)}">${avHTML(u,"")}<span>@${esc(u.username)}</span><span class="dim">${u.posts} ${u.posts===1?"post":"posts"}</span></button>`).join("")}</div></div>`:""}`;
}

function wirePlace(){
  const on=(s,fn)=>{const el=$(s);if(el)el.onclick=fn};
  document.querySelectorAll("[data-pltab]").forEach(b=>b.onclick=()=>{if(b.dataset.pltab!==LABVIEW)setLabView(b.dataset.pltab)});
  document.querySelectorAll("[data-pltag]").forEach(b=>b.onclick=()=>{LABTAG=b.dataset.pltag||null;LABVIEW="work";placeCH();
    if(!$("#plbody"))return render(),loadPlace();
    document.querySelectorAll("[data-pltab]").forEach(t=>t.classList.toggle("on",t.dataset.pltab==="work"));paintPlace();loadPlace()});
  const all=()=>{const P=PLACE[LAB&&LAB.id]||{};return Object.values(P).flatMap(d=>d&&!d.error?[...(d.posts||[]),...(d.calls||[]),...(d.rising||[])]:[])};
  document.querySelectorAll("[data-plpost],[data-plcall]").forEach(b=>b.onclick=()=>{const id=Number(b.dataset.plpost||b.dataset.plcall);
    const p=all().find(x=>x.id===id)||(TAGVIEW&&TAGVIEW.d&&TAGVIEW.d.posts.find(x=>x.id===id));if(p)openPost(p)});
  document.querySelectorAll("[data-plu]").forEach(b=>b.onclick=()=>openProfile(b.dataset.plu));
  on("#plarchive",()=>setLabView("archive"));
  on("#plwork",()=>setLabView("work"));
  on("#plcall",()=>{LABDRAFT="#collab ";setLabView("talk");setTimeout(()=>{const d=$("#draft");if(d){d.value=LABDRAFT;d.focus()}},50)});
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
}
