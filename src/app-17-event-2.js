/* ================================================================
   EVENT SCREEN v1.1 — 2026-10-07 (wiring). Opening an event, the
   Showroom banner, picks, judging, entering and withdrawing. Every
   change goes to the server and the screen shows what it says back.
================================================================ */
function openEvent(slug){
  if(!slug)return;
  pushView("event",slug);
  TAB="event"; EVSLUG=slug; PROFILE=null; POSTOPEN=null; NOTIFOPEN=false; SEARCHOPEN=false; EVENTER=null; EVSHARE=null; EVFOCUS=null;
  render(); loadEvent();
}
async function loadEvent(){
  const want=EVSLUG;
  try{const d=await evApi.one(want);if(want!==EVSLUG)return;EV=d;if(TAB==="event")render()}
  catch(e){toast(e.message||"Couldn't open that event");if(TAB==="event"&&!EV){TAB="showroom";render()}}
}
/* The Showroom banner. Painted in place, so loading it never repaints the feed. */
async function loadEvents(){
  try{EVLIST=await evApi.list()}catch(e){return}
  const w=document.getElementById("ev-bannerwrap");if(w)w.innerHTML=eventBannerHTML();
}

let EVDELEG=false;
function wireEvent(){
  if(!EVDELEG){EVDELEG=true;
    // anywhere in the app: the banner, and event notifications
    document.addEventListener("click",e=>{
      const b=e.target.closest("[data-evopen]");if(b){e.preventDefault();openEvent(b.dataset.evopen);return}
      const n=e.target.closest("[data-nev]");if(n&&EVLIST&&EVLIST.current){e.preventDefault();openEvent(EVLIST.current.slug)}
    },true);
    // the countdown ticks; when a phase ends, the screen catches up
    setInterval(()=>{
      if(TAB!=="event"||!EV||document.hidden)return;
      document.querySelectorAll(".ev-left").forEach(el=>{el.textContent=evLeft(Number(el.dataset.end))});
      const end=EV.event.phase.end;if(end&&Date.now()>end+2000)loadEvent();
    },30000);
  }
  if(TAB!=="event")return;
  const on=(sel,fn)=>{const el=$(sel);if(el)el.onclick=fn};
  document.querySelectorAll("#evscroll [data-evzoom], #evscroll .ev-cover").forEach(el=>el.onclick=()=>{LIGHTBOX=el.dataset.evzoom;render()});
  document.querySelectorAll("#evscroll [data-u]").forEach(el=>el.onclick=ev=>{ev.stopPropagation();openProfile(el.dataset.u)});
  document.querySelectorAll("[data-evpick]").forEach(b=>b.onclick=ev=>{ev.stopPropagation();evPick(Number(b.dataset.evpick),b)});
  document.querySelectorAll("[data-evscore]").forEach(b=>b.onclick=()=>evScore(Number(b.dataset.evscore),Number(b.dataset.n)));
  on("#eventer",()=>{if(!ME)return needAccount("Join to enter the event.");EVENTER={caption:"",agree:false};render()});
  on("#evwithdraw",async()=>{
    if(!(await uiConfirm("Withdraw your entry?","Your post stays on your profile. You can enter again until entries close.",{okLabel:"Withdraw",danger:true})))return;
    try{EV=await evApi.withdraw(EVSLUG);toast("Withdrawn");render()}catch(e){toast(e.message)}
  });
  if(EVENTER)wireEvEnter();
  wireEvPoll();
}

async function evPick(id,btn){
  if(!ME){if(!EVFOCUS)EVFOCUS=id;evRemember();return needAccount("Join to vote.")}
  const on=!EV.me.myVotes.includes(id);
  if(btn)btn.classList.add("busy");
  try{const d=await evApi.vote(EVSLUG,id,on);EV.me.myVotes=d.myVotes;if(d.board)EV.board=d.board;render();if(on&&navigator.vibrate)navigator.vibrate(8)}
  catch(e){toast(e.message);if(/confirm your email/i.test(e.message||"")){if(!EVFOCUS)EVFOCUS=id;evRemember()}if(btn)btn.classList.remove("busy")}
}
async function evScore(id,n){
  try{await evApi.score(EVSLUG,id,n);EV.me.myScores[id]=n;render()}catch(e){toast(e.message)}
}

function wireEvEnter(){
  const s=EVENTER;
  const close=()=>{if(s.busy)return;EVENTER=null;render()};
  const x=$("#evx");if(x)x.onclick=close;
  const bg=$("#evsheet");if(bg)bg.onclick=e=>{if(e.target===bg)close()};
  const f=$("#evfile");if(f)f.onchange=async()=>{
    const file=f.files&&f.files[0];f.value="";if(!file)return;
    if(!/^image\//.test(file.type))return toast("Images only");
    try{s.prep=await prepImage(file,true);render()}catch(e){toast("Couldn't read that image")}
  };
  const cap=$("#evcap");if(cap)cap.oninput=()=>{s.caption=cap.value};
  const ag=$("#evagree");if(ag)ag.onchange=()=>{s.agree=ag.checked;const b=$("#evsend");if(b)b.disabled=!(s.prep&&s.agree&&!s.busy)};
  const go=$("#evsend");if(go)go.onclick=async()=>{
    if(!s.prep||!s.agree||s.busy)return;
    s.busy=true;s.pct=0;render();
    try{
      const up=await uploadStream(dataUrlToBlob(s.prep.full),p=>{s.pct=p*.9;const b=$("#evsend");if(b)b.textContent=`Uploading ${Math.round(s.pct*100)}%`});
      const th=await uploadStream(dataUrlToBlob(s.prep.thumb));
      EV=await evApi.enter(EVSLUG,{imageUrl:up.url,thumbUrl:th.url,w:s.prep.w,h:s.prep.h,caption:s.caption,agree:true});
      EVENTER=null;toast("You're in");render();
    }catch(e){s.busy=false;toast(e.message||"Couldn't enter");render()}
  };
}
