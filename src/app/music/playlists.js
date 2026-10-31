/* ================================================================
   PLAYLISTS v1.2 — 2026-10-29 (a tap in Trending plays through Trending); v1.1 — 2026-10-20 (head from the screen kit); v1.0 — 2026-10-12. "Make the music lab function more like
   Spotify — you listen to music and build your own playlist while in the
   lab." The Music lab's Work tab is a library now:
   - Songs | Playlists along the top.
   - A song: tap it to play; ⊕ adds it to a playlist (✓ once it's in one);
     … for the rest. The bar at the bottom has the same ⊕, so whatever's
     playing goes into a playlist without stopping.
   - A playlist: its cover (the first song's, or four in a square), Play,
     Shuffle, Add songs (search the library, ⊕ each one), … to rename or
     delete. Each song's … takes it out.
   Yours only (server/music/playlists.js). Back walks it (app/nav/back: PLIST).
================================================================ */
const plapi={
  list:()=>req("/api/playlists"),
  one:id=>req("/api/playlists/"+id),
  make:b=>req("/api/playlists",{method:"POST",body:b}),
  rename:(id,name)=>req("/api/playlists/"+id,{method:"PATCH",body:{name}}),
  del:id=>req("/api/playlists/"+id,{method:"DELETE"}),
  add:(id,trackId)=>req("/api/playlists/"+id+"/tracks",{method:"POST",body:{trackId}}),
  rm:(id,tid)=>req("/api/playlists/"+id+"/tracks/"+tid,{method:"DELETE"})};
const PL_ADD=di('<circle cx="12" cy="12" r="9"/><path d="M12 8v8M8 12h8"/>',20);
const PL_DONE=di('<circle cx="12" cy="12" r="9" fill="currentColor"/><path d="M8 12l3 3 5-6" stroke="var(--on-accent)"/>',20);
const PL_SHUF=di('<path d="M3 7h4l10 10h4M3 17h4l3-3M14 10l3-3h4M18 4l3 3-3 3M18 14l3 3-3 3"/>',20);
const plCount=n=>n+(n===1?" song":" songs");
const plLen=ms=>{const m=Math.round((ms||0)/60000);return !m?"":m<60?m+" min":Math.floor(m/60)+" hr "+(m%60)+" min"};
const inAnyPl=id=>(PLISTS||[]).some(p=>p.trackIds.includes(id));
async function loadPlaylists(){
  PLLOADING=true;
  try{PLISTS=(await plapi.list()).playlists}catch(e){PLISTS=PLISTS||[]}
  PLLOADING=false;
  if(TAB==="labs"&&CH.library)render();paintPlayer();
}
/* One song in, one song out — the list, the open playlist and the bar follow. */
function plKeep(p){
  if(!PLISTS)PLISTS=[];
  const i=PLISTS.findIndex(x=>x.id===p.id);
  if(i<0)PLISTS.unshift(p);else PLISTS[i]=Object.assign({},PLISTS[i],p);
  PLISTS.sort((a,b)=>b.updatedAt-a.updatedAt);
}
async function plRefresh(id){
  if(!PLIST||PLIST.id!==id)return;
  try{const d=(await plapi.one(id)).playlist;if(PLIST&&PLIST.id===id){PLIST.d=d;plKeep(d)}}catch(e){}
}
function plCoverHTML(p,cls){
  const c=p.covers||[];
  return `<span class="pl-cov${cls?" "+cls:""}${c.length>=4?" four":""}">${c.length>=4?c.slice(0,4).map(u=>`<img src="${esc(u)}" alt="">`).join("")
    :c[0]?`<img src="${esc(c[0])}" alt="">`:DI.music}</span>`;
}
function musTabsHTML(){
  return `<div class="mus-tabs fchips"><button class="chip ${MUSVIEW==="songs"?"on":""}" data-musv="songs">Songs</button>
    <button class="chip ${MUSVIEW==="playlists"?"on":""}" data-musv="playlists">Playlists</button></div>`;
}
function playlistsHTML(){
  return `<div class="pl-list">
    <button class="pl-row" id="plnew"><span class="pl-cov new">${DI.plus}</span><span class="pl-meta"><b>New playlist</b><span>Build one while you listen</span></span></button>
    ${!PLISTS?skel():PLISTS.map(p=>`<button class="pl-row" data-plopen="${p.id}">${plCoverHTML(p)}
      <span class="pl-meta"><b>${esc(p.name)}</b><span>Playlist · ${plCount(p.count)}</span></span></button>`).join("")}
  </div>`;
}
function playlistHTML(){
  const P=PLIST,d=P.d,head=screenHead({back:{id:"plback",label:"Back"},title:"",actions:[d?`<button class="ib pl-more" id="plmore" aria-label="Rename or delete">${DI.more}</button>`:""]});
  if(!d)return `<div class="scroll" id="plscroll">${head}${skel()}</div>`;
  const songs=d.tracks||[],here=PLQID===d.id&&NOWPLAYING&&d.trackIds.includes(NOWPLAYING.id),live=here&&AUDIO&&!AUDIO.paused;
  const len=plLen(d.durationMs);
  return `<div class="scroll" id="plscroll">${head}
    <div class="pl-hero">${plCoverHTML(d,"big")}</div>
    <div class="pl-info"><h2 class="pl-name">${esc(d.name)}</h2>
      <div class="pl-sub">@${esc(myName())} · ${plCount(d.count)}${len?", "+len:""}</div></div>
    <div class="pl-acts">
      <button class="pl-pill${PLADD?" on":""}" id="pladd">${PLADD?DI.check+" Done":DI.plus+" Add songs"}</button>
      <span class="pl-sp"></span>
      <button class="pl-ic${PLSHUF?" on":""}" id="plshuf" aria-label="Shuffle${PLSHUF?" is on":""}" aria-pressed="${PLSHUF}">${PL_SHUF}</button>
      <button class="pl-play" id="plplay" aria-label="${live?"Pause":"Play"}"${songs.length?"":" disabled"}>${live?DI.pause:DI.play}</button>
    </div>
    ${PLADD?plAddHTML():""}
    <div class="trk-list">${songs.length?songs.map(t=>trackRowHTML(t,"pl")).join("")
      :PLADD?"":`<div class="empty">Nothing in it yet.<br>Tap <b>Add songs</b>, or ⊕ on any song while it plays.</div>`}</div>
  </div>`;
}
/* Add songs: the library, searchable, ⊕ on each — it stays open while you add. */
function plAddHTML(){
  const A=PLADD;
  return `<div class="pl-addbox">
    <input class="in trk-q" id="pladdq" placeholder="Search songs or artists…" value="${esc(A.q)}" aria-label="Search songs to add">
    <div class="pl-addlist">${!A.res?skel():!A.res.length?`<div class="dim pl-none">No songs match.</div>`
      :A.res.slice(0,40).map(t=>trackRowHTML(t,"add")).join("")}</div></div>`;
}
async function plAddSearch(q){
  const want=q;
  try{const r=(await api.tracks(q)).tracks;if(PLADD&&PLADD.q===want){PLADD.res=r;render()}}catch(e){if(PLADD){PLADD.res=[];render()}}
}
function openPlaylist(id){
  id=Number(id);const have=(PLISTS||[]).find(p=>p.id===id);
  PLIST={id,d:null,name:have?have.name:""};PLADD=null;render();
  plapi.one(id).then(r=>{if(PLIST&&PLIST.id===id){PLIST.d=r.playlist;plKeep(r.playlist);render()}})
    .catch(e=>{if(PLIST&&PLIST.id===id){PLIST=null;render();toast(e.message)}});
}
async function newPlaylist(trackId){
  const name=await uiPrompt("New playlist",{value:"My playlist #"+((PLISTS||[]).length+1),okLabel:"Create"});
  if(name==null||!name.trim())return null;
  try{const p=(await plapi.make({name:name.trim(),trackId})).playlist;plKeep(p);return p}catch(e){toast(e.message);return null}
}
/* ⊕ on a song (a row, its …, or the bar): pick a playlist, or start one. In
   one already? It says so, and tapping it takes the song out. */
async function addToPlaylist(t){
  if(!PLISTS)await loadPlaylists();
  openPicker({eyebrow:"ADD TO PLAYLIST",title:t.title,items:[
    {label:"New playlist",sub:"Starts with this song",icon:DI.plus,act:"new"},
    ...(PLISTS||[]).map(p=>{const inIt=p.trackIds.includes(t.id);
      return {label:p.name,sub:inIt?"In it — tap to take it out":plCount(p.count),icon:inIt?DI.check:DI.music,p,inIt}})],
    onPick:async it=>{
      try{
        if(it.act==="new"){const p=await newPlaylist(t.id);if(p)toast("Added to "+p.name)}
        else if(it.inIt){plKeep((await plapi.rm(it.p.id,t.id)).playlist);toast("Taken out of "+it.p.name)}
        else{const r=await plapi.add(it.p.id,t.id);plKeep(r.playlist);toast("Added to "+it.p.name)}
        if(PLIST&&it.p&&PLIST.id===it.p.id)await plRefresh(PLIST.id);
      }catch(e){toast(e.message)}
      render();paintPlayer();
    }});
}
const plShuffle=a=>{a=a.slice();for(let i=a.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[a[i],a[j]]=[a[j],a[i]]}return a};
function plPlay(){
  const d=PLIST&&PLIST.d;if(!d||!d.tracks.length)return;
  if(PLQID===d.id&&NOWPLAYING&&d.trackIds.includes(NOWPLAYING.id)){const a=audioEl();a.paused?a.play().catch(()=>{}):a.pause();return}
  const q=PLSHUF?plShuffle(d.tracks):d.tracks.slice();
  MUSAUTOID=null;PLQORIG=PLSHUF?d.tracks.slice():null;PLAYQ=q;PLQID=d.id;playTrack(q[0]);openNowFull();
}
/* Which list a tap plays through: the library, this playlist, or the search. */
function plQueue(ctx){
  if(ctx==="pl"&&PLIST&&PLIST.d){PLQID=PLIST.d.id;return PLIST.d.tracks.slice()}
  PLQID=null;return ctx==="add"&&PLADD&&PLADD.res?PLADD.res.slice():ctx==="trend"&&TRENDING?TRENDING.slice():(TRACKS||[]).slice();   // Trending plays through Trending
}
function trkFind(id){
  return [...(TRACKS||[]),...(TRENDING||[]),...((PLIST&&PLIST.d&&PLIST.d.tracks)||[]),...((PLADD&&PLADD.res)||[]),...(NOWPLAYING?[NOWPLAYING]:[])]
    .find(x=>String(x.id)===String(id));
}
const plOn=(sel,fn)=>{const el=$(sel);if(el)el.onclick=fn};
function wirePlaylists(){
  if(!PLISTS&&!PLLOADING)loadPlaylists();
  document.querySelectorAll("[data-musv]").forEach(b=>b.onclick=()=>{MUSVIEW=b.dataset.musv;render()});
  plOn("#plnew",async()=>{const p=await newPlaylist(null);if(p)openPlaylist(p.id)});
  document.querySelectorAll("[data-plopen]").forEach(b=>b.onclick=()=>openPlaylist(b.dataset.plopen));
  plOn("#plback",()=>{PLIST=null;PLADD=null;render()});
  plOn("#plplay",plPlay);
  plOn("#plshuf",npfShuffle);   // one shuffle, the same as the full-screen player's
  plOn("#pladd",()=>{if(PLADD){PLADD=null;render();return}PLADD={q:"",res:TRACKS?TRACKS.slice():null};render();if(!TRACKS)plAddSearch("")});
  const aq=$("#pladdq");if(aq){let t=null;aq.oninput=()=>{PLADD.q=aq.value;clearTimeout(t);t=setTimeout(()=>plAddSearch(PLADD.q),280)}}
  plOn("#plmore",()=>{const d=PLIST&&PLIST.d;if(!d)return;
    openMenu({react:false,preview:d.name,actions:[
      {icon:DI.edit,label:"Rename",run:async()=>{const n=await uiPrompt("Rename playlist",{value:d.name,okLabel:"Save"});if(n==null||!n.trim())return;
        try{const p=(await plapi.rename(d.id,n.trim())).playlist;PLIST.d=p;plKeep(p);render()}catch(e){toast(e.message)}}},
      {icon:DI.trash,label:"Delete playlist",danger:true,run:async()=>{
        if(!(await uiConfirm("Delete "+d.name+"?","The songs stay in the library.",{okLabel:"Delete",danger:true})))return;
        try{await plapi.del(d.id);PLISTS=(PLISTS||[]).filter(p=>p.id!==d.id);if(PLQID===d.id)PLQID=null;PLIST=null;PLADD=null;render();toast("Deleted")}catch(e){toast(e.message)}}}]})});
  document.querySelectorAll("[data-trkadd]").forEach(b=>b.onclick=async ev=>{
    ev.stopPropagation();const t=trkFind(b.dataset.trkadd);if(!t)return;
    if(b.closest("[data-ctx]")?.dataset.ctx!=="add")return addToPlaylist(t);
    /* in Add songs: straight into (or out of) the open playlist */
    const d=PLIST&&PLIST.d;if(!d)return;b.disabled=true;
    try{const inIt=d.trackIds.includes(t.id);plKeep((inIt?await plapi.rm(d.id,t.id):await plapi.add(d.id,t.id)).playlist);
      await plRefresh(d.id);render();paintPlayer()}catch(e){b.disabled=false;toast(e.message)}});
}
