/* ── SHARE TO INSTAGRAM STORIES · v1.2 — 2026-10-11 (a post's song plays: the video card) ───────────────────────────
   From any share menu — a post, a profile, a listing, a track: its Story
   card (server-12-story — the work, who made it, in their colour, and the
   link), then one tap shares it
   through the phone's sheet (Instagram → Story) with the link
   already copied for a Link sticker. The card is fetched while the sheet
   is open, so the tap goes straight to navigator.share — iOS only allows
   the share sheet inside the tap itself, not after a download. Its own
   layer: nothing behind it repaints. */
let IGS=null;
/* img: the card's address (/p/1/story.jpg, /u/x/story.jpg, /m/1/…, /tr/1/…); link: what the sticker opens.
   video (2026-10-11): a post with a song also has /p/1/story.mp4 — the card with
   15 seconds of the song. That's what's shared; the picture stands in while it's
   made, and if it can't be made (or the phone can't share video) the picture goes. */
function igStoryOpen(img,link,video){
  const id=img,mine=()=>IGS&&IGS.id===id;
  IGS={id,link,img,video:video||null,file:null,pic:null,vurl:null,failed:false};igsPaint();
  const ready=()=>{const g=$("#igsgo");if(g){g.disabled=false;g.textContent="Share to Instagram"}};
  const get=(u)=>fetch(u).then(r=>{if(!r.ok)throw new Error(r.status);return r.blob()});
  get(img).then(b=>{if(!mine())return;const ty=b.type==="image/png"?"image/png":"image/jpeg";IGS.pic=new File([b],"labs-story."+(ty==="image/png"?"png":"jpg"),{type:ty});if(!IGS.video){IGS.file=IGS.pic;ready()}})
    .catch(()=>{if(mine()&&!IGS.video){IGS.failed=true;igsPaint()}});
  if(video)get(video).then(b=>{if(!mine())return;IGS.file=new File([b],"labs-story.mp4",{type:"video/mp4"});IGS.vurl=URL.createObjectURL(b);igsPaint()})
    .catch(()=>{if(!mine())return;IGS.video=null;IGS.file=IGS.pic;IGS.failed=!IGS.pic;igsPaint()});
}
/* The one share menu for anything (2026-10-08): a profile, a listing, a
   track. Instagram Story first; then the phone's own sheet; then the link. */
function shareMenu({title,link,story,note}){
  openPicker({eyebrow:"SHARE",title:title||"Share",note:note||"",items:[
    ...(story?[{label:"Instagram Story",sub:"A picture of it for your Story, with the link to paste",icon:DI.out,act:"story"}]:[]),
    ...(navigator.share?[{label:"Send off the app",sub:"Messages, WhatsApp, AirDrop — anywhere on your phone",icon:DI.out,act:"native"}]:[]),
    {label:"Copy link",sub:link.replace(/^https?:\/\//,""),icon:DI.copy,act:"copy"}],
    onPick:it=>{if(it.act==="story")return igStoryOpen(story,link);if(it.act==="native")return shareOut({title,url:link});copyText(link)}});
}
function igsHTML(){
  const s=IGS;
  return `<div class="sheet" id="igsbg"><div class="sheetc ev-share" role="dialog" aria-label="Share to Instagram">
    <div class="sheeth"><div><h2>Share to your Story</h2></div><button class="x" id="igsx" aria-label="Close">${DI.x}</button></div>
    <div class="ev-shimg">${s.failed?`<div class="dim">Couldn't make the picture. Your link still works.</div>`
      :s.vurl?`<video src="${s.vurl}" poster="${esc(s.img)}" autoplay muted loop playsinline aria-label="Your Story, with the song"></video>`:`<img src="${esc(s.img)}" alt="Your Story card">`}</div>
    ${s.video?`<p class="dim igs-song">${DI.music} ${s.vurl?"With the song — 15 seconds. It plays in your Story.":"Adding the song…"}</p>`:""}
    ${INAPP?`<ol class="ev-howto"><li>${esc(INAPP)}'s browser can't hand a picture to your Story. Open LABS in <b>${outBrowser()}</b> and share it from there.</li>
      <li>Or press and hold the picture to save it, and add it to your Story yourself.</li></ol>`
    :`<ol class="ev-howto"><li>Tap <b>Share to Instagram</b>, then pick <b>Instagram → Stories</b>.</li>
      <li>Your link is copied — add a <b>Link</b> sticker and paste it, so people can tap straight through.</li></ol>`}
    <div class="ev-link"><span>${esc(s.link.replace(/^https?:\/\//,""))}</span><button class="btn ghost" id="igscopy">${DI.copy} Copy</button></div>
    ${INAPP?`<button class="btn green ev-cta" data-outgo>Open in ${outBrowser()}</button>`
    :`<button class="btn green ev-cta" id="igsgo"${s.file||s.failed?"":" disabled"}>${s.failed?"Share the link":s.file?"Share to Instagram":s.video?"Adding the song…":"Making your card…"}</button>`}
  </div></div>`}
function igsPaint(){
  let l=document.getElementById("igsl");
  if(!l){l=document.createElement("div");l.id="igsl";document.body.appendChild(l)}
  l.innerHTML=IGS?igsHTML():"";
  if(!IGS)return;
  const close=()=>{if(IGS.vurl)URL.revokeObjectURL(IGS.vurl);IGS=null;igsPaint()};
  $("#igsx").onclick=close;
  $("#igsbg").onclick=e=>{if(e.target.id==="igsbg")close()};
  $("#igscopy").onclick=()=>copyText(IGS.link);
  if($("#igsgo"))$("#igsgo").onclick=()=>{
    const s=IGS;if(!s)return;
    /* Both inside the tap: copy the link for the sticker, open the sheet. */
    try{navigator.clipboard&&navigator.clipboard.writeText(s.link).catch(()=>{})}catch(e){}
    /* the video if the phone can share it, else the picture */
    const can=(f)=>f&&navigator.canShare&&navigator.canShare({files:[f]}),f=can(s.file)?s.file:can(s.pic)?s.pic:null;
    if(f){
      navigator.share({files:[f]}).then(()=>{toast("Link copied — paste it in a Link sticker")}).catch(e=>{
        if(e&&e.name==="AbortError")return;
        try{glitch("action_failed","story share → "+(e&&e.name||"error"))}catch(_){}
        igsSave(s)});
      return;
    }
    if(s.file)return igsSave(s);
    shareOut({title:"On LABS",url:s.link});
  };
}
/* No share sheet for files (a computer): save the picture instead. */
function igsSave(s){
  const a=document.createElement("a");a.href=URL.createObjectURL(s.file);a.download=s.file.name;document.body.appendChild(a);a.click();
  setTimeout(()=>{URL.revokeObjectURL(a.href);a.remove()},1000);toast((/video/.test(s.file.type)?"Video":"Picture")+" saved — the link is copied");
}
