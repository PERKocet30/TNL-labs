/* ── HOW TNL LABS WORKS · v1.0 · 2026-10-18 ─────────────────────────────
   "A better onboarding process for new members. Walk through all of the
   app's features and profile creation." After joining (photo → colour →
   bio → people) a new member swipes through what's here, one card per
   part of the app, and lands in the Showroom with the Get started list
   (app-11-getstarted.js). ≡ on your profile → How TNL LABS works opens
   the same cards any time (GATE="tour"). Swipe, tap Next, or ← →. */
const TOUR=[
  {ic:()=>UI_IC.tabGrid,h:"The Showroom",p:()=>"Work from every lab, picked fresh for you. Like it, comment, share it to your Story. A song plays when its post reaches the middle of the screen."},
  {ic:()=>UI_IC.hash,h:"The labs",p:()=>`${LABS.map(l=>labMark(l.name)).join(" · ")}. Each lab has Work for finished pieces and Talk for everything else, and #tags help people find you.`},
  {ic:()=>UI_IC.plusSq,h:"Post your work",p:()=>"Tap + to post a picture, a carousel, a video or a song. Pick the lab it belongs in, add #tags, put a song under a picture, and tag who you made it with."},
  {ic:()=>UI_IC.tabStanding,h:"Rep and levels",p:()=>"You earn rep only from what other people do with your work: likes, shares, saves, collabs and sales. Rep raises your level, and every level lowers your Market fee."},
  {ic:()=>UI_IC.tabCollab,h:"Collabs and messages",p:()=>"Made something together? Tag your collaborators. It counts for both of you once they accept. Message anyone from their page."},
  {ic:()=>UI_IC.tabShop,h:"The Market",p:()=>"Sell prints, merch, beats and more. Buyers pay by card and you're paid out through Stripe."},
  {ic:()=>DI.star,h:"Tournaments",p:()=>"Enter LABS tournaments with your best piece. Votes only count in the app, so send people here to vote for you."},
  {ic:()=>UI_IC.home,h:"Your page",p:()=>`It lives at ${location.host}/u/${esc(ME?ME.username:"you")} and wears your colour. Share it from ≡ on your profile, straight to your Instagram Story.`},
];
function tourHTML(G){
  const n=TOUR.length,i=Math.max(0,Math.min(n,G.ti||0)),last=i===n;
  const first=(ME&&ME.displayName||"").split(" ")[0];
  const card=last
    ?`<div class="tour-ic tour-me">${ME&&ME.avatarUrl?`<img src="${esc(ME.avatarUrl)}" alt="">`:GX_PERSON}</div>
      <h1 class="gx-h">${G.made?`Welcome to TNL LABS${first?", "+esc(first):""}.`:"That's TNL LABS."}</h1>
      <p class="gx-p">${G.made&&G.made.mailSent?`We sent a link to <b>${esc(G.f.email)}</b> to confirm your email. `:""}${G.made?"Your Get started list is waiting in the Showroom.":"Open this again any time from ≡ on your profile."}</p>`
    :`<div class="tour-ic">${TOUR[i].ic()}</div><h1 class="gx-h">${esc(TOUR[i].h)}</h1><p class="gx-p">${TOUR[i].p()}</p>`;
  return `<div class="gate"><div class="gx gx-tour">
    <header class="gx-top">${i>0?`<button class="gx-ic" id="tourback" aria-label="Back">${GX_BACK}</button>`:"<span></span>"}
      ${last?"<span></span>":`<button class="gx-skip" id="tourskip">Skip</button>`}</header>
    <main class="gx-body center"><div class="tour-card" id="tourcard">${card}</div></main>
    <footer class="gx-foot tour-foot"><div class="tour-dots" aria-hidden="true">${TOUR.map((_,k)=>`<i class="${k===i?"on":""}"></i>`).join("")}<i class="${last?"on":""}"></i></div>
      <button class="gx-btn" id="tournext">${last?(G.made?"Start exploring":"Done"):"Next"}</button></footer>
  </div></div>`;
}
function tourDone(G){
  try{localStorage.setItem("tnl-toured","1")}catch(e){}
  if(G.made){gsMark("new");   // their Get started list's numbers first, so it's there as the Showroom opens
    gsLoad(true).finally(()=>{gateClose();if(!labNext()){TAB="showroom";render()}setTimeout(maybeOfferInstall,600)});return}
  gateClose();render();
}
function wireTour(G){
  const go=d=>{const k=(G.ti||0)+d;if(k<0)return;if(k>TOUR.length)return tourDone(G);G.ti=k;render()};
  const on=(s,fn)=>{const el=$(s);if(el)el.onclick=fn};
  on("#tournext",()=>go(1));on("#tourback",()=>go(-1));
  on("#tourskip",()=>{G.ti=TOUR.length;render()});
  const c=$("#tourcard");
  if(c){let x0=null;c.ontouchstart=e=>{x0=e.touches[0].clientX};
    c.ontouchend=e=>{if(x0==null)return;const dx=e.changedTouches[0].clientX-x0;x0=null;if(Math.abs(dx)>50)go(dx<0?1:-1)}}
  if(!TOURKEYS){TOURKEYS=true;document.addEventListener("keydown",e=>{const g=GFLOW;
    if(!g||g.step!=="tour"||!GATE)return;
    if(e.key==="ArrowRight"){e.preventDefault();$("#tournext")&&$("#tournext").click()}
    else if(e.key==="ArrowLeft"&&(g.ti||0)>0){e.preventDefault();g.ti--;render()}})}
}
let TOURKEYS=false;
const openTour=()=>{GATE="tour";render()};
