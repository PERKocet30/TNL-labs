/* ── INSIDE INSTAGRAM · v1.0 — 2026-10-09 ─────────────────────────────
   Most people reach LABS by tapping a link in Instagram — a bio, a Story
   sticker, a DM — and Instagram opens it in its own browser. LABS works
   there, but a few things can't: Add to Home Screen, sharing a picture to
   your Story, your saved passwords and Apple Pay, and an account signed in
   there stays inside Instagram. So, there and only there:
     · the "keep it on your phone" card becomes "Open in Safari" (one tap:
       iOS's x-safari- link, Android's intent; if Instagram swallows it,
       the two taps that always work — ••• → Open in external browser)
     · Log in / Join say so, with the same button
     · the Story sheet's button opens Safari, where the share sheet exists
   Facebook's and TikTok's browsers are the same story. */
const INAPP=(()=>{const u=navigator.userAgent||"";return /Instagram/.test(u)?"Instagram":/FBAN|FBAV|FB_IAB/.test(u)?"Facebook":/musical_ly|BytedanceWebview|TikTok/.test(u)?"TikTok":""})();
const outBrowser=()=>onIOS()?"Safari":"your browser";
function goOut(u){location.href=u}   // the jump itself (the tap-through swaps it to see where it went)
function openOutside(url){
  url=url||location.href;
  let gone=false;const seen=()=>{if(document.hidden)gone=true};
  document.addEventListener("visibilitychange",seen);
  try{
    if(onIOS())goOut("x-safari-"+url);
    else if(/Android/i.test(navigator.userAgent))goOut("intent://"+url.replace(/^https?:\/\//,"")+"#Intent;scheme=https;S.browser_fallback_url="+encodeURIComponent(url)+";end");
  }catch(e){}
  /* Still here a moment later: the app didn't let the link through. */
  setTimeout(()=>{document.removeEventListener("visibilitychange",seen);if(!gone)outHelp(url)},1200);
}
function outHelp(url){
  /* A modal, not the picker: it has to show over Log in / Join and the Story sheet too. */
  uiConfirm("Open in "+outBrowser(),`${INAPP||"This app"} kept LABS in its own browser. Tap ${onIOS()?"•••":"⋮"} at the top right, then Open in ${onIOS()?"external browser":"Chrome"} — or copy the link and paste it in ${outBrowser()}.`,
    {okLabel:"Copy link",cancelLabel:"Close"}).then(y=>{if(y)copyText(url)});
}
/* The card that offers Add to Home Screen, inside Instagram. */
function inappCardHTML(){
  return `<div class="installc"><div class="installc-in">
    <button class="installc-x" data-installx aria-label="Close">${DI.x}</button>
    <div class="installc-h"><img src="/icon-white-512.png" alt=""><div>
      <b>You're in ${esc(INAPP)}'s browser</b>
      <span>Open LABS in ${outBrowser()} to stay signed in, share to your Story and keep it on your home screen.</span>
    </div></div>
    <button class="btn green wide" data-outgo>Open in ${outBrowser()}</button>
  </div></div>`}
/* One line on Log in / Join. */
function inappGateHTML(){
  return INAPP?`<div class="gx-out"><span>You're in ${esc(INAPP)}'s browser — your saved passwords and sign-in live in ${outBrowser()}.</span><button type="button" class="gx-link" data-outgo>Open in ${outBrowser()}</button></div>`:""}
document.addEventListener("click",e=>{
  const b=e.target.closest("[data-outgo]");if(!b)return;
  e.preventDefault();e.stopPropagation();openOutside(location.href);
},true);
