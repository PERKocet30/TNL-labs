/* ── EDIT PROFILE v2 · 2026-10-07 ──────────────────────────────────────
   Instagram's edit page, TNL's look: Cancel · Edit profile · Done, your
   photo in the middle, then quiet rows — name, pronouns, bio, links, what
   you make, your colour. Links and roles open their own small screens
   instead of a wall of fields. Theme, levels, admin and log out live in ≡. */
let EDITPF=null, PROFTAGGED=null, PROFTAGLOAD=null, CLIMBUSER=null;
const PF_MENU=`<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="square" aria-hidden="true"><path d="M4 6h16M4 12h16M4 18h16"/></svg>`;
const PF_TAGGED=`<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="square" aria-hidden="true"><rect x="3.5" y="3.5" width="17" height="17"/><circle cx="12" cy="10" r="3"/><path d="M7 20c1-3 3-4.5 5-4.5s4 1.5 5 4.5"/></svg>`;
const PF_CHEV=`<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="square" aria-hidden="true"><path d="M9 5l7 7-7 7"/></svg>`;
const PF_IC=d=>`<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="square" aria-hidden="true"><path d="${d}"/></svg>`;
const PF_I={theme:PF_IC("M20 14a8 8 0 0 1-10-10 8 8 0 1 0 10 10z"),level:PF_IC("M5 20v-6M12 20V9M19 20V4"),share:PF_IC("M12 3v12M7 8l5-5 5 5M5 14v6h14v-6"),
  link:PF_IC("M10 14l4-4M8 12l-2 2a3 3 0 0 0 4 4l2-2M16 12l2-2a3 3 0 0 0-4-4l-2 2"),admin:PF_IC("M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z"),
  out:PF_IC("M15 4h4v16h-4M10 8l-4 4 4 4M6 12h10"),block:PF_IC("M5 5l14 14M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18z"),flag:PF_IC("M5 21V4h12l-2 4 2 4H5")};

function pfStart(u){
  EDITPF={name:u.displayName||"",pronouns:u.pronouns||"",bio:u.bio||"",
    links:(u.links&&u.links.length?u.links:(u.link?[{title:"",url:u.link}]:[])).map(x=>({...x})),
    roles:(u.roles&&u.roles.length?[...u.roles]:[u.role]).filter(Boolean),accent:u.accent||"lab",sub:null,q:""};
}
function editProfileHTML(){
  const u=PROFILE.user,f=EDITPF||(pfStart(u),EDITPF);
  const top=(left,title,right)=>`<header class="pe-top">${left}<b>${title}</b>${right}</header>`;
  let body;
  if(f.sub==="links")body=`${top(`<button class="pe-b" id="pe-back">‹ Back</button>`,"Links",`<span class="pe-sp"></span>`)}
    <div class="pe-sub">${f.links.map((x,i)=>`<div class="pe-link">
      <input class="pe-in" data-pl="${i}" data-k="title" value="${esc(x.title||"")}" maxlength="40" placeholder="Title (optional)">
      <input class="pe-in" data-pl="${i}" data-k="url" value="${esc(x.url||"")}" maxlength="200" placeholder="URL" inputmode="url" autocapitalize="none">
      <button class="pe-x" data-plx="${i}" aria-label="Remove">×</button></div>`).join("")}
      ${f.links.length<5?`<button class="pe-add" id="pe-addlink">+ Add a link</button>`:""}
      <p class="pe-hint">Up to 5. The first shows on your profile; the rest sit behind “and more”.</p></div>`;
  else if(f.sub==="roles"){const q=f.q.toLowerCase();
    body=`${top(`<button class="pe-b" id="pe-back">‹ Back</button>`,"What you make",`<span class="pe-n">${f.roles.length}/5</span>`)}
    <div class="pe-sub"><input class="pe-in pe-q" id="pe-rq" value="${esc(f.q)}" placeholder="Search" autocapitalize="none">
      ${f.roles.length?`<div class="roles pe-sel">${f.roles.map(r=>`<button class="chip on" data-er="${esc(r)}">${esc(r)} ×</button>`).join("")}</div>`:""}
      <div class="roles" id="pe-rlist">${ROLES.filter(r=>!f.roles.includes(r)&&(!q||r.toLowerCase().includes(q))).map(r=>`<button class="chip" data-er="${esc(r)}">${esc(r)}</button>`).join("")}</div></div>`;}
  else body=`${top(`<button class="pe-b" id="ed-cancel">Cancel</button>`,"Edit profile",`<button class="pe-b pe-done" id="ed-save">Done</button>`)}
    <div class="pe-av">${u.avatarUrl?`<img class="pav" src="${esc(u.avatarUrl)}" alt="">`:`<div class="pav">${esc(u.displayName.slice(0,2).toUpperCase())}</div>`}
      <button class="pe-photo" id="avbtn">Change photo</button><input type="file" id="avin" accept="image/*" hidden></div>
    <div class="pe-rows">
      <label class="pe-row"><span>Name</span><input class="pe-in" id="ed-name" value="${esc(f.name)}" maxlength="40"></label>
      <label class="pe-row"><span>Pronouns</span><input class="pe-in" id="ed-pro" value="${esc(f.pronouns)}" maxlength="30" placeholder="Add pronouns"></label>
      <label class="pe-row pe-tall"><span>Bio</span><textarea class="pe-in" id="ed-bio" rows="3" maxlength="300" placeholder="What you make, who you build with, what you're after.">${esc(f.bio)}</textarea><i class="pe-cnt" id="ed-cnt">${f.bio.length}/300</i></label>
      <button class="pe-row" id="ed-links"><span>Links</span><em>${f.links.filter(x=>x.url).length?f.links.filter(x=>x.url).length+" link"+(f.links.filter(x=>x.url).length>1?"s":""):"Add links"}</em>${PF_CHEV}</button>
      <button class="pe-row" id="ed-roles"><span>What you make</span><em>${esc(f.roles.join(", ")||"Add")}</em>${PF_CHEV}</button>
      <div class="pe-row pe-col"><span>Colour</span><div class="pe-sw">${Object.entries(ACCENTS).map(([k,a])=>`<button class="pe-dot ${f.accent===k?"on":""}" data-accent="${esc(k)}" title="${esc(a.name)}" aria-label="${esc(a.name)}"><span style="background:${esc(a.hex)}"></span></button>`).join("")}</div></div>
    </div>`;
  return `<div class="sheet astab" id="sheetbg"><div class="sheetc pe">${body}</div></div>`;
}

/* Keep what's typed: a sub-screen or a repaint must never lose it. */
function pfStash(){const f=EDITPF;if(!f)return;
  const g=id=>{const e=$(id);return e?e.value:null};
  if(g("#ed-name")!==null)f.name=g("#ed-name");if(g("#ed-pro")!==null)f.pronouns=g("#ed-pro");if(g("#ed-bio")!==null)f.bio=g("#ed-bio");
  document.querySelectorAll("[data-pl]").forEach(i=>{const x=f.links[+i.dataset.pl];if(x)x[i.dataset.k]=i.value});
}
const pfGo=sub=>{pfStash();EDITPF.sub=sub;render();const s=document.querySelector(".sheetc");if(s)s.scrollTop=0};

function wireProfileV2(){
  /* ── the edit page ── */
  const eb=$("#editb");if(eb)eb.onclick=()=>{pfStart(PROFILE.user);EDITING=true;pushView("edit");render()};
  if(EDITING&&EDITPF){
    const f=EDITPF;
    document.querySelectorAll("#ed-name,#ed-pro,#ed-bio,[data-pl]").forEach(i=>i.addEventListener("input",()=>{pfStash();
      const c=$("#ed-cnt");if(c&&i.id==="ed-bio")c.textContent=i.value.length+"/300"}));
    const ec=$("#ed-cancel");if(ec)ec.onclick=()=>{EDITING=false;EDITPF=null;applyAccent(ME.accentHex);render()};
    const bk=$("#pe-back");if(bk)bk.onclick=()=>{pfStash();f.links=f.links.filter(x=>(x.url||"").trim());pfGo(null)};
    const el=$("#ed-links");if(el)el.onclick=()=>{if(!f.links.length)f.links.push({title:"",url:""});pfGo("links")};
    const er=$("#ed-roles");if(er)er.onclick=()=>{f.q="";pfGo("roles")};
    const al=$("#pe-addlink");if(al)al.onclick=()=>{pfStash();f.links.push({title:"",url:""});render();
      const ins=document.querySelectorAll('[data-k="url"]');if(ins.length)ins[ins.length-1].focus()};
    document.querySelectorAll("[data-plx]").forEach(b=>b.onclick=()=>{pfStash();f.links.splice(+b.dataset.plx,1);render()});
    document.querySelectorAll("[data-er]").forEach(b=>b.onclick=()=>{const r=b.dataset.er;
      if(f.roles.includes(r))f.roles=f.roles.filter(x=>x!==r);else if(f.roles.length<5)f.roles=[...f.roles,r];else return toast("Up to 5");
      render();const q=$("#pe-rq");if(q&&f.q){q.focus();q.setSelectionRange(q.value.length,q.value.length)}});
    const rq=$("#pe-rq");if(rq)rq.oninput=()=>{f.q=rq.value;const box=$("#pe-rlist");if(!box)return;const q=f.q.toLowerCase();
      box.innerHTML=ROLES.filter(r=>!f.roles.includes(r)&&(!q||r.toLowerCase().includes(q))).map(r=>`<button class="chip" data-er="${esc(r)}">${esc(r)}</button>`).join("");
      wireProfileV2()};
    document.querySelectorAll("[data-accent]").forEach(b=>b.onclick=()=>{pfStash();f.accent=b.dataset.accent;
      applyAccent((ACCENTS[f.accent]||{}).hex);   // see it at once
      document.querySelectorAll(".pe-dot").forEach(x=>x.classList.toggle("on",x===b))});
    const sv=$("#ed-save");if(sv)sv.onclick=async()=>{
      if(sv._busy)return;pfStash();sv._busy=true;sv.textContent="Saving…";
      try{const d=await api.updateMe({displayName:f.name,pronouns:f.pronouns,bio:f.bio,roles:f.roles,accent:f.accent,
          links:f.links.filter(x=>(x.url||"").trim())});
        ME=d.user;EDITING=false;EDITPF=null;applyAccent(ME.accentHex);PROFCACHE.delete(ME.username);
        PROFILE=await api.profile(ME.username);toast("Profile updated");render();
      }catch(e){sv._busy=false;sv.textContent="Done";toast(e.message)}};
    return;
  }
  /* ── ≡ your settings, ⋯ someone else's ── */
  const pm=$("#profmenu");if(pm)pm.onclick=()=>openMenu({react:false,actions:[
    {icon:PF_I.theme,label:THEME==="dark"?"Day mode":"Night mode",run:()=>{setTheme(THEME==="dark"?"light":"dark");render()}},
    {icon:PF_I.level,label:"Level and rates",run:()=>{CLIMB=true;render()}},
    {icon:PF_I.theme,label:liteOn()?"Data saver: on":"Data saver: off",run:()=>{setLite(!liteOn());
      toast(liteOn()?"Data saver on — videos and music wait for a tap":"Data saver off");render()}},
    {icon:PF_I.share,label:"Share profile",run:()=>shareProfile(myName())},
    ...(ME&&ME.isAdmin?[{icon:PF_I.admin,label:"Admin dashboard",run:()=>{location.href="/admin"}}]:[]),
    {icon:PF_I.link,label:"Terms, privacy & help",run:()=>window.open("/contact","_blank","noopener")},
    {icon:PF_I.out,label:"Log out",danger:true,run:logOut}]});
  const mo=$("#profmore");if(mo)mo.onclick=()=>{const u=PROFILE.user;openMenu({react:false,preview:"@"+u.username,actions:[
    {icon:PF_I.share,label:"Share profile",run:()=>shareProfile(u.username)},
    {icon:PF_I.link,label:"Copy profile link",run:()=>copyText(profileLink(u.username))},
    ...(ME?[{icon:PF_I.block,label:"Block",danger:true,run:async()=>{
      if(!(await uiConfirm("Block "+u.displayName+"?","You won't see each other's work.",{okLabel:"Block",danger:true})))return;
      try{const d=await api.block(u.username);toast(d.blocked?"Blocked":"Unblocked");PROFILE=null;render()}catch(e){toast(e.message)}}},
    {icon:PF_I.flag,label:"Report",danger:true,run:()=>openPicker({eyebrow:"REPORT",title:"Why?",
      items:["Spam","Harassment","Stolen work","Impersonation","Something else"].map(r=>({label:r,icon:DI.flag,reason:r})),
      onPick:async it=>{try{await api.report({username:u.username,reason:it.reason});toast("Reported — thank you")}catch(e){toast(e.message)}}})}]:[])]})};
  const lp=$("#lvlpill");if(lp)lp.onclick=()=>{CLIMB=true;CLIMBUSER=PROFILE.user;render()};
  /* followers / following, open lists */
  document.querySelectorAll("[data-flist]").forEach(b=>b.onclick=async()=>{
    const kind=b.dataset.flist,un=PROFILE.user.username;
    openPicker({title:kind==="followers"?"Followers":"Following",loading:true,empty:kind==="followers"?"No followers yet.":"Not following anyone yet.",
      onPick:it=>openProfile(it.username)});
    try{const d=await req(`/api/users/${encodeURIComponent(un)}/${kind}`);
      if(PICKER){PICKER.items=d.people.map(x=>({label:x.displayName,sub:"@"+x.username+(x.youFollow?" · following":"")+(x.isYou?" · you":""),avatar:x.avatarUrl,username:x.username}));PICKER.loading=false;render()}}
    catch(e){if(PICKER){PICKER.loading=false;render()}toast(e.message)}});
  const pl=$("#pflinks");if(pl)pl.onclick=()=>openPicker({title:"Links",items:(PROFILE.user.links||[]).map(x=>({label:x.title||x.url.replace(/^https?:\/\/(www\.)?/,""),sub:x.url,icon:DI.out,url:x.url})),
    onPick:it=>window.open(it.url,"_blank","noopener")});
  /* the Tagged tab loads when you open it */
  if(PTAB==="tagged"&&PROFTAGGED===null&&PROFILE&&!PROFILE.loading&&PROFTAGLOAD!==PROFILE.user.username){
    const un=PROFTAGLOAD=PROFILE.user.username;
    req(`/api/users/${encodeURIComponent(un)}/tagged`).then(d=>{if(PROFILE&&PROFILE.user.username===un){PROFTAGGED=d.posts;render()}})
      .catch(()=>{if(PROFILE&&PROFILE.user.username===un){PROFTAGGED=[];render()}})}
}
async function shareProfile(un){
  shareMenu({title:"@"+un+" on LABS",link:profileLink(un),story:"/u/"+encodeURIComponent(un)+"/story.jpg"});
}
function logOut(){
  TOKEN=null;ME=null;PROFILE=null;UNREADS={};UNREAD=0;DMUNREAD=0;applyAccent((ACCENTS.lab||{}).hex);
  localStorage.removeItem("tnl-token");if(typeof es!=="undefined"&&es)es.close();
  TAB="showroom";GATE=null;render();toast("Signed out");
}
