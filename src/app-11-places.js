/* ================================================================
   PLACES v1.9 — 2026-10-21 (the Work grid is the archive: month markers, Older; the archive is a chip, no search); v1.8 — 2026-10-20 (the #tag page's head from the screen kit); v1.7 — 2026-10-15 (v1.7: links name the lab — /l/visual, LAB_SLUG). v1.6: each lab says what to do there, and has
   a Share — LAB_PITCH, shareLab; a shared /l/ link lands in the lab).
   v1.5 — 2026-10-12 (v1.5: the tournament running in a lab is a
   chip in its Work — every entry, no #tag needed — and entries are marked).
   v1.4 — 2026-10-12 (painters, muralists, printmakers and
   mixed-media artists lead to Visual; v1.3: ‹ on a #tag walks the back trail). A lab is a place — a genre — not a
   server full of channels.
   v1.1, simpler: one list of genres, each explained by its #hashtags,
   and inside a lab just two tabs —
     Work   everything made here, a grid; tap a #tag to narrow it
     Talk   one conversation, like a group DM (the old rooms, merged)
   (Open and Pulse are gone for now.) People #tag their own work.
   Old channel ids still hold every post (they never change) — each lab
   just has a home channel new talk goes to. Music's Work is its tracks
   library; Visual keeps the archive and boards one tap from Work.
   v1.2: the labs that match what you make (the roles you picked at
   signup or in Edit profile) come first — on the labs list and in every
   "share to a lab" picker. ROLE_LABS maps each role in ROLES to its labs
   (test/places.test.mjs checks every role has one).
   Server: server-10-places.js. Styles: app-05-styles-places.css.
================================================================ */
const ROLE_LABS={
  "Collector":["pharmacy","culture","fashion"],
  "Graphic Designer":["pharmacy"],"Illustrator":["pharmacy","akatsuki"],"3D Artist":["pharmacy"],"Motion Designer":["pharmacy"],
  "Animator":["pharmacy","akatsuki"],"Art Director":["pharmacy","fashion"],"Painter":["pharmacy"],"Sculptor":["pharmacy"],
  "Artist":["pharmacy"],"Muralist":["pharmacy"],"Printmaker":["pharmacy"],"Mixed Media Artist":["pharmacy"],
  "Tattoo Artist":["pharmacy"],"Curator":["pharmacy","casino"],"Manga Artist":["akatsuki","pharmacy"],"Character Designer":["akatsuki","pharmacy"],
  "Photographer":["pharmacy","fashion"],"Videographer":["pharmacy"],"Video Editor":["pharmacy"],"Cinematographer":["pharmacy"],"AMV Editor":["akatsuki","pharmacy"],
  "Fashion Designer":["fashion"],"Stylist":["fashion"],"Model":["fashion"],"Tailor":["fashion"],"Sneaker Customizer":["fashion"],"Cosplayer":["akatsuki","fashion"],
  "Producer":["culture"],"Beatmaker":["culture"],"Lyricist / Singer":["culture"],"Rapper":["culture"],"DJ":["culture"],"Audio Engineer":["culture"],"Musician":["culture"],
  "Writer":["casino"],"Copywriter":["casino","tna"],"Journalist":["casino"],"Content Creator":["casino","pharmacy"],"Actor":["pharmacy"],
  "Web Designer":["pharmacy","tna"],"Web Developer":["tna"],"App Developer":["tna"],"UI/UX Designer":["pharmacy","tna"],"Product Designer":["pharmacy","tna"],
  "Entrepreneur":["tna"],"Founder":["tna"],"Brand Strategist":["tna","casino"],"Marketer":["tna","casino"],"Manager":["tna","culture"],"A&R":["culture","tna"],
  "Photographer's Agent":["tna","pharmacy"],"Event Organizer":["tna","hq"],
};
/* Your labs first: each role you picked counts for its labs — the first
   role you picked most, a role's second lab half. Then everything else,
   in the usual order. Signed out, or no roles: the usual order. */
function labsForMe(){
  const roles=ME?((ME.roles&&ME.roles.length?ME.roles:[ME.role])||[]).filter(Boolean):[];
  const score={};
  roles.slice(0,5).forEach((r,i)=>(ROLE_LABS[r]||[]).forEach((lab,j)=>{score[lab]=(score[lab]||0)+(5-i)*(j?0.5:1)}));
  const mine=LABS.filter(l=>score[l.id]).sort((a,b)=>score[b.id]-score[a.id]||LABS.indexOf(a)-LABS.indexOf(b));
  return {mine,rest:LABS.filter(l=>!score[l.id])};
}
const labsOrdered=()=>{const o=labsForMe();return [...o.mine,...o.rest]};
/* What to do in each lab, in a line (2026-10-15: "every lab to have a share
   button with captions that describe what to do inside each lab… a brief
   explanation I can send to people"). It heads the lab's Work and goes out
   with its Share. The same lines are on /l/:id (LAB_PITCH in
   server-12-lab-pages.js; test/lab-share.test.mjs checks they match). */
const LAB_PITCH={
  hq:"Say hi, show what you're working on and find people to make things with.",
  pharmacy:"Upload your art: painting, drawing, design, photography, film and edits. Get seen and get feedback.",
  culture:"Upload your songs and beats, build playlists, and get ears on your works in progress.",
  fashion:"Post your designs and drops: concepts, finished pieces and what's releasing next.",
  akatsuki:"Share your anime and manga art, panels and ideas, and talk about what you're watching.",
  casino:"Post what's happening: news, features, and promos for your next release.",
  tna:"Find gigs and open calls, talk rates and money, and show the sites and apps you build."};
/* Share a lab: its name, what to do there, and a link that opens it
   (/l/:id — a page with a Join button for people who aren't members yet).
   No share sheet (Instagram's in-app browser, most computers): the whole
   message is copied, ready to paste. */
/* The lab's address says what it is (/l/visual, /l/music — 2026-10-15,
   "rename links to match the direction of the app"). Ids never change;
   these are only the names in links. The old /l/<id> links still open
   (the server forwards them). LAB_SLUG in server-12-labs.js matches. */
const LAB_SLUG={hq:"general",pharmacy:"visual",culture:"music",fashion:"fashion",akatsuki:"anime",casino:"news",tna:"business"};
const labBySlug=s=>LABS.find(l=>LAB_SLUG[l.id]===s||l.id===s)||null;
async function shareLab(l){
  if(!l)return;
  const url=location.origin+"/l/"+(LAB_SLUG[l.id]||l.id),title="// "+l.name+" on LABS",text=title+"\n"+(LAB_PITCH[l.id]||"");
  if(navigator.share){try{await navigator.share({title,text,url});return}catch(e){if(e&&e.name==="AbortError")return}}
  const all=text+"\n"+url;
  try{await navigator.clipboard.writeText(all);toast("Copied: the caption and the link. Paste it anywhere.");return}catch(e){}
  await uiPrompt("Copy and send this",{value:all,okLabel:"Done"});
}
let LABNEXT=null;   // a shared /l/ link opened before joining: step into that lab once you're in
function labNext(){if(!LABNEXT||!ME)return false;const id=LABNEXT;LABNEXT=null;openLab(id);return true}
const LAB_HOME={hq:"general",pharmacy:"creators",culture:"music-chat",fashion:"clothing-design",akatsuki:"anime-chat",casino:"news",tna:"opportunities"};
const labHome=l=>l?(l.channels.find(c=>c.id===LAB_HOME[l.id])||l.channels[0]):null;
const labOfCh=id=>LABS.find(l=>l.channels.some(c=>c.id===id))||null;
const labUnread=l=>l.channels.reduce((n,c)=>n+(UNREADS[c.id]||0),0);
let LABVIEW="work", LABTAG=null, PLACE={}, TAGVIEW=null, LABTAGS=null;
const PLV=[["work","Work"],["talk","Talk"]];
const papi={
  feed:l=>req("/api/labs/"+l+"/feed"),
  work:(l,t,before)=>req("/api/labs/"+l+"/work?"+(!t?"":/^event:/.test(t)?"event="+encodeURIComponent(t.slice(6)):"tag="+encodeURIComponent(t))+(before?"&before="+before:"")),
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
  gsMark("lab");   // Get started: step into a lab (app-11-getstarted)
  pushView("lab",l.id);
  TAB="labs";LAB=l;LABVIEW=view||"work";LABTAG=tag||null;TAGVIEW=null;ROOMOPEN=true;PLIST=null;PLADD=null;NOWFULL=false;
  PROFILE=null;POSTOPEN=null;OPENCOMMENTS=null;placeCH();
  render();loadPlace();if(!LABTAGS)loadLabTags();
}
function setLabView(v){if(!LAB)return;LABVIEW=v;if(v!=="work")LABTAG=null;placeCH();render();loadPlace()}
const placeKey=()=>LABVIEW+(LABVIEW==="work"?":"+(LABTAG||""):"");
async function loadPlace(){
  if(!LAB)return;const lab=LAB.id,v=LABVIEW,key=placeKey();
  if(v==="talk")return loadFeed(true);
  if(v==="archive")return loadArchive();
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
    ${p.images&&p.images.length>1?`<i class="pl-multi" aria-hidden="true"></i>`:""}${p.videoUrl?`<i class="pl-vid" aria-hidden="true">${DI.play}</i>`:""}${p.entry?`<i class="pl-entry" title="${esc(p.entry.title)}">Entry</i>`:""}</button>`}
/* The grid scrolls back in time (2026-10-21): a month marker where the month
   changes (not for this month), and the next page of older pieces loads as you
   near the end. */
const plMonth=t=>new Date(t).toLocaleDateString(undefined,{month:"long",year:"numeric"});
function plGridHTML(list,more){
  let last=plMonth(Date.now()),out="";
  for(const p of list){const m=p.createdAt?plMonth(p.createdAt):last;
    if(m!==last){out+=`<div class="pl-month">${esc(m)}</div>`;last=m}
    out+=plTileHTML(p)}
  return `<div class="pl-grid">${out}</div>${more?`<button class="pl-link pl-older" id="plolder">Older</button>`:""}`;
}
/* LABTAG "event:<slug>" = the tournament running here (every entry, no #tag). */
const plEvChip=(ev,on)=>`<button class="pl-chip ev ${on?"on":""}" data-pltag="event:${esc(ev.slug)}" aria-label="${esc(ev.title)}">Tournament<span>${ev.n}</span></button>`;
const plChip=(t,on,n)=>`<button class="pl-chip ${on?"on":""}" data-pltag="${esc(t)}">${t?"#"+esc(t):"All"}${n?`<span>${n}</span>`:""}</button>`;
const plEmpty=(h,p)=>`<div class="empty estate"><div class="eh">${esc(h)}</div><div class="ep">${esc(p)}</div></div>`;
const plErr=d=>d&&d.error?plEmpty("Couldn't load this.",d.error):"";
/* A genre's tags: its own (the ones that explain it) first, then
   whatever else people tag their work with here. */
let LABTAGSBUSY=false;
async function loadLabTags(){if(LABTAGSBUSY)return;LABTAGSBUSY=true;
  try{LABTAGS=(await papi.labTags()).tags;
    if(TAB==="labs"&&!LAB&&$("#lxlist"))render();
    else if(TAB==="labs"&&LAB&&LABVIEW==="work"&&$("#plbody"))paintPlace();   // a lab opened straight from elsewhere gets its chips too
  }catch(e){}finally{LABTAGSBUSY=false}}
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
    const chips=labTagList(LAB.id,d&&d.tags),evOn=!!LABTAG&&LABTAG.startsWith("event:");
    const ev=(d&&d.event)||(P["work:"]||{}).event||null;
    if(LABTAG&&!evOn&&!chips.includes(LABTAG))chips.unshift(LABTAG);
    return `<p class="pl-for">${esc(LAB_PITCH[LAB.id]||(LAB_ID[LAB.id]||{}).for||"")}</p>
      ${chips.length||ev?`<div class="pl-tags">${plChip("",!LABTAG)}${ev?plEvChip(ev,evOn):""}${chips.map(t=>plChip(t,LABTAG===t)).join("")}${LAB.channels.some(c=>c.archive)?`<button class="pl-chip" id="plarchive">Archive</button>`:""}</div>`:""}
      ${!d?`<div class="pl-grid">${Array.from({length:9},()=>`<i class="pl-tile sk-img"></i>`).join("")}</div>`
        :d.error?plErr(d):d.posts.length?plGridHTML(d.posts,d.more)
        :evOn?plEmpty("No entries yet.","Enter from the tournament page — your piece shows up here.")
        :LABTAG?plEmpty("Nothing tagged #"+LABTAG+" here yet.","Tag your work with #"+LABTAG+" when you post it.")
        :plEmpty("No work here yet.","Post a piece with "+labMark(LAB.name)+" added. Tag it so people find it.")}`;
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
  on("#plolder",()=>plOlder());
  on("#plwork",()=>setLabView("work"));
  if(TAGVIEW){on("#tagback",()=>navBack(closeTag));
    document.querySelectorAll("[data-taglab]").forEach(b=>b.onclick=()=>openLab(b.dataset.taglab,"work",TAGVIEW.tag))}
}

/* The next page of older pieces, appended to what's shown (2026-10-21). */
let PLOLDERBUSY=false;
async function plOlder(){
  if(PLOLDERBUSY||!LAB||LABVIEW!=="work")return;const lab=LAB.id,key=placeKey(),P=PLACE[lab]||{},d=P[key];
  if(!d||!d.more||!d.posts.length)return;
  const b=$("#plolder");if(b){b.disabled=true;b.textContent="Loading…"}
  PLOLDERBUSY=true;
  try{const last=d.posts[d.posts.length-1],n=await papi.work(lab,LABTAG,last.createdAt);
    const seen=new Set(d.posts.map(p=>p.id));d.posts.push(...n.posts.filter(p=>!seen.has(p.id)));d.more=n.more}
  catch(e){d.more=false}
  finally{PLOLDERBUSY=false}
  if(LAB&&LAB.id===lab&&placeKey()===key)paintPlace();
}
/* Posting from inside a lab adds that lab by default. */
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
  return `<div class="scroll pl-tagpage" id="tagscroll">${screenHead({back:{id:"tagback",label:"Back"},title:"#"+T.tag})}
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
