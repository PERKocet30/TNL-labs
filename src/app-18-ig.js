/* ── ALONGSIDE INSTAGRAM · v1.0 · 2026-10-09 ──────────────────────────
   Most people reach LABS from Instagram: a link sticker, a bio link, a DM.
   That opens LABS inside Instagram's own browser, which can't do two
   things the app relies on — the phone's share sheet (so "Share to
   Instagram" has nowhere to go) and downloads (so "Save" silently did
   nothing). This part makes that path work:
     · inApp()   which in-app browser we're in: Instagram, Facebook,
                 Threads, TikTok — or null in Safari / Chrome
     · a slim bar, once a week at most: "Open in Safari / Chrome", for
                 installing LABS and one-tap Story sharing. On Android it
                 opens Chrome directly; iOS has no way to, so it shows the
                 two taps (••• → Open in external browser)
     · igHoldHTML() the fallback for saving a Story card in there: the
                 picture, big — press and hold to save it — and the link
   Its own layer (#iabl): nothing behind it repaints or moves. */
const UA=typeof navigator!=="undefined"?navigator.userAgent||"":"";
function inApp(ua=UA){
  if(/Instagram/i.test(ua))return "Instagram";
  if(/Barcelona|Threads/i.test(ua))return "Threads";
  if(/FBAN|FBAV|FB_IAB|FBIOS/i.test(ua))return "Facebook";
  if(/musical_ly|BytedanceWebview|TikTok/i.test(ua))return "TikTok";
  return null;
}
const isAndroid=(ua=UA)=>/Android/i.test(ua);
/* Android: an intent link hands the page to Chrome (or the browser picker),
   falling back to the same page if that isn't possible. */
function outsideURL(href=location.href){
  const u=new URL(href);
  return `intent://${u.host}${u.pathname}${u.search}#Intent;scheme=https;package=com.android.chrome;S.browser_fallback_url=${encodeURIComponent(u.href)};end`;
}
let IAB=null;   // {open:true} while the steps sheet is showing
function iabHidden(){try{return Date.now()-Number(localStorage.getItem("tnl-iab-hide")||0)<7*864e5}catch(e){return false}}
function iabOpenOut(){
  if(isAndroid()){location.href=outsideURL();return}
  IAB={open:true};iabPaint();
}
/* The bar sits on the main screens only — never over a post, a profile,
   a sheet, or anything with its own bar at the bottom (a listing's Buy,
   a lab's message box, the creator). */
const iabSpot=()=>{try{return !ENTER&&!GATE&&!PCOMPOSE&&!POSTOPEN&&!PROFILE&&!OPENCOMMENTS&&!NOTIFOPEN&&!SEARCHOPEN&&!LIGHTBOX&&!DMOPENPANEL
  &&!(TAB==="market"&&MKTVIEW!=="browse")&&!(TAB==="labs"&&LAB&&LABVIEW==="talk")}catch(e){return false}};
function iabPaint(){
  let l=document.getElementById("iabl");
  if(!l){l=document.createElement("div");l.id="iabl";document.body.appendChild(l)}
  const app=inApp();
  const off=!app||(!IAB&&(iabHidden()||!iabSpot()));
  const browser=isAndroid()?"Chrome":"Safari";
  const html=off?"":IAB?`<div class="sheet" id="iabbg"><div class="sheetc iab-sheet" role="dialog" aria-label="Open in ${browser}">
      <div class="sheeth"><div><h2>Open LABS in ${browser}</h2></div><button class="x" id="iabx2" aria-label="Close">${DI.x}</button></div>
      <ol class="ev-howto iab-steps"><li>Tap <b>•••</b> at the top right of this screen.</li>
        <li>Tap <b>Open in external browser</b>.</li></ol>
      <p class="dim iab-why">In ${browser} you can add LABS to your Home Screen and share to your Story in one tap. You'll stay signed in once you sign in there.</p>
      <div class="ev-link"><span>${esc(location.host+location.pathname)}</span><button class="btn ghost" id="iabcopy">${DI.copy} Copy link</button></div>
    </div></div>`
    :`<div class="iab-bar" role="note"><span>You're in ${app}'s browser.</span>
      <button class="iab-go" id="iabgo">Open in ${browser}</button><button class="iab-x" id="iabx" aria-label="Hide for a week">${DI.x}</button></div>`;
  if(l.dataset.h===html)return;   // painted on every render: only touch it when it changes
  l.dataset.h=html;l.innerHTML=html;document.body.classList.toggle("has-iab",!!html&&!IAB);
  if(!html)return;
  const on=(id,fn)=>{const el=document.getElementById(id);if(el)el.onclick=fn};
  on("iabgo",iabOpenOut);
  on("iabx",()=>{try{localStorage.setItem("tnl-iab-hide",String(Date.now()))}catch(e){}iabPaint()});
  on("iabx2",()=>{IAB=null;iabPaint()});
  on("iabcopy",()=>copyText(location.href));
  const bg=document.getElementById("iabbg");if(bg)bg.onclick=e=>{if(e.target===bg){IAB=null;iabPaint()}};
}

/* Inside Instagram's browser there's no share sheet and no downloads:
   the picture itself, big, to press and hold. */
function igHoldHTML(img,link){
  const app=inApp()||"this browser", ios=!isAndroid();
  return `<div class="ig-hold"><img src="${esc(img)}" alt="Your Story picture — press and hold to save it"></div>
    <ol class="ev-howto"><li><b>Press and hold the picture</b>, then ${ios?"<b>Save to Photos</b>":"<b>Download image</b>"}.</li>
      <li>In Instagram, add it to your Story and put a <b>Link</b> sticker on it with your link.</li></ol>
    <div class="ev-link"><span>${esc(String(link).replace(/^https?:\/\//,""))}</span><button class="btn ghost" data-igholdcopy="${esc(link)}">${DI.copy} Copy link</button></div>
    <button class="btn ghost ev-cta" data-igholdout>Saving doesn't work in ${esc(app)}'s browser? Open in ${ios?"Safari":"Chrome"}</button>`;
}
document.addEventListener("click",e=>{
  const c=e.target.closest&&e.target.closest("[data-igholdcopy]");if(c){copyText(c.dataset.igholdcopy);return}
  const o=e.target.closest&&e.target.closest("[data-igholdout]");if(o)iabOpenOut();
});
