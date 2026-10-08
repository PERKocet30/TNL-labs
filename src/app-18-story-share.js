/* ── SHARE TO INSTAGRAM STORIES · 2026-10-08 ───────────────────────────
   From any share menu — a post, a profile, a listing, a track: its Story
   card (server-12-story — the work, who made it, in their colour, and the
   link), then one tap shares it
   through the phone's sheet (Instagram → Story) with the link
   already copied for a Link sticker. The card is fetched while the sheet
   is open, so the tap goes straight to navigator.share — iOS only allows
   the share sheet inside the tap itself, not after a download. Its own
   layer: nothing behind it repaints. */
let IGS=null;
/* img: the card's address (/p/1/story.jpg, /u/x/story.jpg, /m/1/…, /tr/1/…); link: what the sticker opens. */
function igStoryOpen(img,link){
  const id=img;
  IGS={id,link,img,file:null,failed:false};igsPaint();
  fetch(img).then(r=>{if(!r.ok)throw new Error(r.status);return r.blob()}).then(b=>{
    if(!IGS||IGS.id!==id)return;
    IGS.file=new File([b],"labs-story.jpg",{type:"image/jpeg"});const g=$("#igsgo");if(g){g.disabled=false;g.textContent="Share to Instagram"}
  }).catch(()=>{if(IGS&&IGS.id===id){IGS.failed=true;igsPaint()}});
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
    <div class="ev-shimg">${s.failed?`<div class="dim">Couldn't make the picture. Your link still works.</div>`:`<img src="${esc(s.img)}" alt="Your Story card">`}</div>
    <ol class="ev-howto"><li>Tap <b>Share to Instagram</b>, then pick <b>Instagram → Stories</b>.</li>
      <li>Your link is copied — add a <b>Link</b> sticker and paste it, so people can tap straight through.</li></ol>
    <div class="ev-link"><span>${esc(s.link.replace(/^https?:\/\//,""))}</span><button class="btn ghost" id="igscopy">${DI.copy} Copy</button></div>
    <button class="btn green ev-cta" id="igsgo"${s.file||s.failed?"":" disabled"}>${s.failed?"Share the link":s.file?"Share to Instagram":"Making your card…"}</button>
  </div></div>`}
function igsPaint(){
  let l=document.getElementById("igsl");
  if(!l){l=document.createElement("div");l.id="igsl";document.body.appendChild(l)}
  l.innerHTML=IGS?igsHTML():"";
  if(!IGS)return;
  const close=()=>{IGS=null;igsPaint()};
  $("#igsx").onclick=close;
  $("#igsbg").onclick=e=>{if(e.target.id==="igsbg")close()};
  $("#igscopy").onclick=()=>copyText(IGS.link);
  $("#igsgo").onclick=()=>{
    const s=IGS;if(!s)return;
    /* Both inside the tap: copy the link for the sticker, open the sheet. */
    try{navigator.clipboard&&navigator.clipboard.writeText(s.link).catch(()=>{})}catch(e){}
    if(s.file&&navigator.canShare&&navigator.canShare({files:[s.file]})){
      navigator.share({files:[s.file]}).then(()=>{toast("Link copied — paste it in a Link sticker")}).catch(e=>{
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
  setTimeout(()=>{URL.revokeObjectURL(a.href);a.remove()},1000);toast("Picture saved — the link is copied");
}
