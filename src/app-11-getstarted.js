/* ── GET STARTED · v1.2 · 2026-10-26 ────────────────────────────────────
   v1.2: the list follows the member's kind (collector · music · fashion · maker), and
   anyone without a photo sees it again (gsNoPic), whenever they joined.
   v1.1: the weekly reminder email (server-11-nudge) lands here — /?start=
   photo|music|piece|bio|colour|follow|market opens that step (startGo) and
   shows the list this visit whatever its age (GSFORCE).
   Onboarding, part two: after the walkthrough (app-11-gate-tour) a new
   member finds a short list at the top of the Showroom: the seven things
   that make the app theirs. Each line is a shortcut to doing it, and it
   ticks itself off. Shown for a member's first 30 days until it's done or
   closed (✕), on the device they joined on ("new", set as the walkthrough
   ends). Its numbers (/api/me/start) arrive before the Showroom first
   paints (app-19-feed-boot), so it never appears under a reader. */
let GS=null, GSAT=0, GSFORCE=false;
const GS_DAYS=30;
const gsFlag=k=>{try{return !!localStorage.getItem("tnl-gs-"+k)}catch(e){return false}};
const gsMark=k=>{try{localStorage.setItem("tnl-gs-"+k,"1")}catch(e){}};
function gsItems(){
  const me=ME||{},k=memberKind(me.roles),coll=k==="collector";
  const it=[
    {k:"photo",t:"Add a profile photo",done:!!me.avatarUrl,go:gsEdit},
    {k:"colour",t:"Pick your colour",done:(me.accent&&me.accent!=="lab")||gsFlag("colour"),go:gsEdit},
    {k:"bio",t:coll?"Say what you love":"Say what you make",done:!!String(me.bio||"").trim(),go:gsEdit},
    {k:"follow",t:coll?"Follow 3 artists":"Follow 3 people",done:!!GS&&GS.following>=3,go:()=>{const b=$("#sr-builders");if(b)b.scrollIntoView({behavior:mvReduced()?"auto":"smooth",block:"center"})}},
  ];
  if(coll)it.push({k:"support",t:"Like 3 pieces you love",done:!!GS&&GS.likes>=3,go:()=>{TAB="showroom";render();const g=$("#sr-grid");if(g)g.scrollIntoView({behavior:mvReduced()?"auto":"smooth",block:"start"})}});
  if(k==="music")it.push({k:"music",t:"Upload your first track",done:!!GS&&GS.tracks>=1,go:()=>startGo("music")});
  if(k==="fashion")it.push({k:"market",t:"List a piece in the Market",done:!!GS&&GS.listings>=1,go:()=>startGo("market")});
  if(!coll)it.push({k:"post",t:"Post your first piece",done:!!GS&&GS.posts>=1,go:gsPost});
  it.push({k:"lab",t:"Step into a lab",done:gsFlag("lab"),go:()=>{TAB="labs";render()}});
  if(!coll)it.push({k:"share",t:"Share your page",done:gsFlag("share"),go:()=>shareProfile(myName())});
  return it;
}
const GS_NOPIC_MS=3*864e5;
const gsOffAt=()=>{try{return Number(localStorage.getItem("tnl-gs-offat"))||0}catch(e){return 0}};
const gsNoPic=()=>!!(ME&&!ME.avatarUrl&&Date.now()-gsOffAt()>GS_NOPIC_MS);
const gsWant=()=>gsFlag("new")||gsNoPic();   // load the numbers for these (feed boot, the Showroom)
const gsShow=()=>!!(ME&&GS&&(GSFORCE||gsNoPic()||(gsFlag("new")&&!gsFlag("off")&&ME.createdAt&&Date.now()-ME.createdAt<GS_DAYS*864e5))&&gsItems().some(i=>!i.done));
/* From the reminder email's button: straight to that step. */
async function startGo(k){
  if(!ME)return;GSFORCE=true;gsMark("new");
  if(k==="music"){await openProfile(myName());PTAB="music";render();return}
  if(k==="market"){TAB="market";MKTVIEW="sell";render();return}
  const i=gsItems().find(z=>z.k===(k==="piece"?"post":k==="love"?"bio":k));
  if(i)i.go();else{TAB="showroom";render()}   // done already? the step is still the right place to land
}
function gsHTML(){
  if(!gsShow())return "";
  const it=gsItems(),n=it.filter(i=>i.done).length;
  return `<section class="gs" id="gs" aria-label="Get started">
    <div class="gs-top"><div><b>Get started</b><span class="gs-n">${n} of ${it.length}</span></div>
      <button class="gs-x" id="gsx" aria-label="Close">${DI.x}</button></div>
    <div class="gs-bar"><i style="transform:scaleX(${n/it.length})"></i></div>
    <ul class="gs-list">${it.map(i=>`<li><button class="gs-i${i.done?" done":""}" data-gs="${i.k}"${i.done?" disabled":""}>
      <span class="gs-c">${i.done?DI.check:""}</span><span>${esc(i.t)}</span>${i.done?"":UI_IC.arrow}</button></li>`).join("")}</ul>
    <button class="gs-tour" id="gstour">How LABS works</button>
  </section>`;
}
async function gsEdit(){await openProfile(myName());if(PROFILE&&PROFILE.user){pfStart(PROFILE.user);EDITING=true;pushView("edit");render()}}
function gsPost(){if(PCOMPOSE)return;PCOMPOSE={body:"",imgs:[],vid:null,busy:false,ch:pcLabNow()};pushView("compose");render()}
/* the numbers, now and then; the card is painted in place, never shifting the work below it */
async function gsLoad(force){
  if(!ME||(!force&&GS&&Date.now()-GSAT<10000))return;
  GSAT=Date.now();
  try{GS=await req("/api/me/start")}catch(e){return}
  gsPaint();
}
function gsPaint(){
  const sr=$("#showroom"),slot=$("#gs-slot");if(!sr||!slot)return;
  const h=gsHTML();if(h===slot.dataset.gs&&slot.firstElementChild)return;slot.dataset.gs=h;   // nothing changed: leave it (a repaint can nudge the feed)
  const before=slot.offsetHeight;slot.innerHTML=h;gsWire();
  const d=slot.offsetHeight-before;if(d&&sr.scrollTop>0)sr.scrollTop+=d;   // reading further down: stay put
}
function gsWire(){
  const x=$("#gsx");if(x)x.onclick=()=>{gsMark("off");try{localStorage.setItem("tnl-gs-offat",String(Date.now()))}catch(e){}gsPaint()};
  const t=$("#gstour");if(t)t.onclick=openTour;
  document.querySelectorAll("[data-gs]").forEach(b=>b.onclick=()=>{const i=gsItems().find(z=>z.k===b.dataset.gs);if(i&&!i.done)i.go()});
}
