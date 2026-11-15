/* ================================================================
   EVENT SCREEN v1.3 — 2026-11-15 (the vote wait, to the brief: no held votes — "Vote soon" round a ring that fills,
   the pieces to look at meanwhile, Vote by hand when it's over; a refusal that's the member's to fix opens with the
   fix; a used-up day answers on the phone; a scoreboard row and a name in the results open the piece and the artist).
   v1.2 — 2026-10-12 (wiring; v1.2: the ‹ back bar, and "Every entry is in // Visual"). Opening an event, the
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
  const want=EVSLUG,pre=EVPRE&&EVPRE.slug===want?EVPRE.p:null;EVPRE=null;
  try{const d=await(pre||evApi.one(want));if(want!==EVSLUG)return;EV=d;if(TAB==="event")render();evWaitWatch()}
  catch(e){toast(e.message||"Couldn't open that event");if(TAB==="event"&&!EV){TAB="showroom";render()}}
}
/* The Showroom banner. Painted in place, so loading it never repaints the feed. */
async function loadEvents(){
  try{EVLIST=await evApi.list()}catch(e){return}
  const w=document.getElementById("ev-bannerwrap");if(w)w.innerHTML=eventBannerHTML();
}

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
  on("#evaddphoto",()=>{evRemember();gsEdit()});   // no photo yet: straight to Edit profile, and back to the piece after (2026-10-28)
  // nothing to step back to (the app was opened right here): the Showroom, where the banner is
  on("#evinvite",()=>{const e=EV.event;shareOut({title:e.title,text:e.title+" — enter and vote on LABS",url:evLink(e)})});
  on("#evback",()=>navBack(()=>{TAB="showroom";EVENTER=null;EVSHARE=null;EVFOCUS=null}));
  // every entry, in the lab it posts into, on its Tournament chip (a step on the back trail)
  on("[data-evlab]",e=>{e.preventDefault();if(!ME)return needAccount("Join to step into the labs.");EVENTER=null;EVSHARE=null;openLab(e.currentTarget.dataset.evlab,"work","event:"+EVSLUG)});
  document.querySelectorAll("#evscroll [data-evzoom], #evscroll .ev-cover").forEach(el=>el.onclick=()=>{LIGHTBOX=el.dataset.evzoom;render()});
  document.querySelectorAll("#evscroll [data-u]").forEach(el=>el.onclick=ev=>{ev.stopPropagation();openProfile(el.dataset.u)});
  document.querySelectorAll("[data-evpick]").forEach(b=>b.onclick=ev=>{ev.stopPropagation();evPick(Number(b.dataset.evpick),b)});
  // a scoreboard row or a line of the results opens the piece itself (2026-11-15: 140 taps on a row's words in a month opened nothing)
  document.querySelectorAll("#evscroll [data-evpost]").forEach(el=>el.onclick=ev=>{if(ev.target.closest("button,a,[data-u],[data-evzoom]"))return;openPostById(Number(el.dataset.evpost))});
  // the note's own way out of what blocks a vote: the pieces to look at while the wait runs, the confirm link again
  on("#evseeall",()=>{const l=evLab(EV.event);if(l){EVENTER=null;EVSHARE=null;openLab(l.id,"work","event:"+EVSLUG)}else{const g=document.querySelector("#evscroll .ev-board, #evscroll .ev-grid");if(g)g.scrollIntoView({block:"start"})}});
  on("#evresend",()=>evMailAsk(0));
  document.querySelectorAll("[data-evscore]").forEach(b=>b.onclick=()=>evScore(Number(b.dataset.evscore),Number(b.dataset.n)));
  on("#eventer",()=>{if(!ME)return needAccount("Join to enter the event.");EVENTER={caption:"",agree:false};render()});
  on("#evwithdraw",async()=>{
    if(!(await uiConfirm("Withdraw your entry?","Your post stays on your profile. You can enter again until entries close.",{okLabel:"Withdraw",danger:true})))return;
    try{EV=await evApi.withdraw(EVSLUG);toast("Withdrawn");render()}catch(e){toast(e.message)}
  });
  if(EVENTER)wireEvEnter();
  wireEvPoll();
}

/* THE VOTE WAIT (2026-11-15, to the brief of 2026-11-04). A new account waits a little before its first vote, and
   nothing is held for it — "No held votes" (decided 2026-11-04): the member votes by hand once the wait is over.
   Before this the vote was held and sent later, and its message sat behind a comment on the same line, so the button
   only dimmed: 125 rage taps and 247 double sends on this screen in a month. Now the button reads "Vote soon" round a
   ring that fills (EV.me.wait, a share — never minutes), a tap says so and sends nothing, the note offers the pieces
   to look at, and the screen looks again by itself until the button turns into Vote. */
async function evPick(id,btn){
  if(!ME){if(!EVFOCUS)EVFOCUS=id;evRemember();return needAccount("Join to vote.")}
  const mine=EV.me.myVotes.includes(id);
  if(!mine&&EV.event.requireVerified&&!ME.emailVerified)return evMailAsk(id);   // said at the tap, with a way to fix it (2026-11-15)
  if(!mine&&EV.event.requireAvatar&&!ME.avatarUrl)return evPhotoAsk(id);   // 2026-10-29: the reminder, at the tap
  if(!mine&&EV.me.wait!=null)return evSoon();
  if(evSpent(id))return toast(EV.event.picks===1?"You've voted today. Take it back to pick another, or come back tomorrow.":"You've used today's votes. Take one back to pick another.");   // no call that can only be refused
  if(btn&&btn.classList.contains("busy"))return;   // on its way: it can't send twice
  const on=!mine;
  if(btn)btn.classList.add("busy");
  try{const d=await evApi.vote(EVSLUG,id,on);EV.me.myVotes=d.myVotes;if(d.board)EV.board=d.board;render();
    if(on){if(navigator.vibrate)navigator.vibrate(8);evCounted()}}
  catch(e){
    const m=e.message||"";if(btn)btn.classList.remove("busy");
    if(/finish setting up/i.test(m)){EV.me.voteBlock=m;if(EV.me.wait==null)EV.me.wait=.95;render();evWaitWatch();return evSoon()}   // the server knows best: show the wait
    if(/profile photo/i.test(m))return evPhotoAsk(id);
    if(/confirm your email/i.test(m))return evMailAsk(id);
    toast(m)}
}
const evSoon=()=>toast("You can vote soon. While you wait, see all the pieces.");
/* "Your vote counted" — once on this phone, the first time a vote goes in. */
function evCounted(){try{if(localStorage.getItem("tnl-voted"))return;localStorage.setItem("tnl-voted","1")}catch(e){return}toast("Your vote counted")}
/* Today's votes are all used and this isn't one of them (a scoreboard only: its votes are by the day). */
const evSpent=id=>!!(EV&&EV.board&&EV.event.format==="poll"&&!EV.me.myVotes.includes(id)&&EV.me.myVotes.length>=EV.event.picks);
/* While the wait runs the screen looks again by itself: the rings fill in place (no repaint), and when the wait is
   over the buttons turn into Vote and it says so. */
function evWaitWatch(){
  clearTimeout(EVWAITT);if(!EV||EV.me.wait==null)return;
  const slug=EV.event.slug;
  EVWAITT=setTimeout(async()=>{
    if(TAB!=="event"||!EV||EVSLUG!==slug||EV.event.slug!==slug)return;
    if(document.hidden)return evWaitWatch();
    try{const d=await evApi.one(slug);if(TAB!=="event"||EVSLUG!==slug)return;
      if(d.me.wait!=null){EV.me.wait=d.me.wait;EV.me.voteBlock=d.me.voteBlock;document.querySelectorAll("#evscroll .ev-ring .fg").forEach(c=>c.setAttribute("stroke-dasharray",evRingDash(d.me.wait)))}
      else{EV=d;render();if(!d.me.voteBlock)toast("You can vote now")}
    }catch(e){}
    evWaitWatch()},EV_WAIT_MS);
}
/* The email isn't confirmed: say so at the tap, send the link again from there, and come back to this piece after. */
async function evMailAsk(id){
  if(id&&!EVFOCUS)EVFOCUS=id;evRemember();
  if(await uiConfirm("Confirm your email to vote","We sent you a link. Open it, then come back — this piece will be waiting.",{okLabel:"Send it again",cancelLabel:"OK"})){
    try{await api.resend();toast("Sent — check your inbox")}catch(e){toast(e.message)}}
}
/* "Remind people they need to upload a profile pic in order to vote when they try to vote" (2026-10-29) */
async function evPhotoAsk(id){
  if(!EVFOCUS)EVFOCUS=id;evRemember();   // back to this piece once the photo is in
  if(await uiConfirm("Add a profile photo to vote","Every vote on LABS has a face behind it. Add a photo, then come back to vote for this piece.",{okLabel:"Add a photo",cancelLabel:"Not now"}))gsEdit();
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
    /* A preview straight away; the real upload (the original + sharp
       copies, app/media/images.js) happens on Enter. */
    if(s.prep&&s.prep.local)URL.revokeObjectURL(s.prep.thumb);
    s.file=file;s.prep={thumb:URL.createObjectURL(file),local:true};render()
  };
  const cap=$("#evcap");if(cap)cap.oninput=()=>{s.caption=cap.value};
  const ag=$("#evagree");if(ag)ag.onchange=()=>{s.agree=ag.checked;const b=$("#evsend");if(b)b.disabled=!(s.prep&&s.agree&&!s.busy)};
  const go=$("#evsend");if(go)go.onclick=async()=>{
    if(!s.prep||!s.agree||s.busy)return;
    s.busy=true;s.pct=0;render();
    try{
      const im=await uploadWork(s.file);
      EV=await evApi.enter(EVSLUG,{imageUrl:im.url,thumbUrl:im.thumb,w:im.w,h:im.h,tw:im.tw,sm:im.sm,sw:im.sw,caption:s.caption,agree:true});
      EVENTER=null;toast("You're in");render();
    }catch(e){s.busy=false;toast(e.message||"Couldn't enter");render()}
  };
}
