/* ================================================================
   EVENT POLL v1.0 — 2026-10-07. What the community asked for: a plain
   poll and a scoreboard. Instagram brings people in, the vote happens
   here.
     · the board: every piece, ranked, with its votes and how far it moved
       in the last 24 hours. Frozen for the last hours of each stage.
     · one tap to vote (or `picks` a day), resets at midnight ET
     · EVFOCUS — the piece someone tapped through to from Instagram
       (/e/:slug/:id → /?e=slug&v=id), shown first, big, with Vote
     · EVSHARE — "Share to Instagram": the entrant's Story card from the
       server, shared straight to Instagram where the phone allows it
     · after confirming your email in another tab, the app brings you
       back to the piece you were voting for (tnl-evret)
================================================================ */
let EVFOCUS=null, EVSHARE=null;

const evVoteUrl=id=>`${location.origin}/e/${EVSLUG}/${id}`;
/* places moved in the last 24 hours — arrows, so it never reads as "+2 votes" */
const evMove=m=>m>0?`<span class="ev-mv up" title="Up ${m} today">↑${m}</span>`:m<0?`<span class="ev-mv" title="Down ${-m} today">↓${-m}</span>`:"";
function evVoteBtn(e){
  const me=EV.me, mine=me.entry&&me.entry.id===e.id, picked=me.myVotes.includes(e.id);
  if(mine)return `<span class="ev-mine-s">Yours</span>`;
  if(me.isJudge&&EV.event.stage==="final")return "";
  return `<button class="ev-vote ${picked?"on":""}" data-evpick="${e.id}">${picked?DI.check+" Voted":"Vote"}</button>`;
}
function evPollNote(){
  const me=EV.me, B=EV.board, n=EV.event.picks, left=Math.max(0,n-me.myVotes.length);
  if(me.voteBlock)return esc(me.voteBlock);
  const day=left?(n===1?"You have <b>1 vote</b> today.":`<b>${left} of ${n}</b> votes left today.`):(n===1?"You've voted today.":"You've used today's votes.");
  return `${day} Votes reset at midnight ET.${B&&B.frozen?` <b>The board froze for the last ${EV.event.freezeHours} hours</b> — votes still count, the rest is a surprise.`:""}`;
}
/* The piece someone came from Instagram to see. */
function evFocusHTML(){
  const e=EVFOCUS&&evById(EVFOCUS);if(!e)return "";
  const r=EV.board&&EV.board.rows.find(x=>x.entryId===e.id), voting=!!EV.board&&EV.inPlay.includes(e.id);
  return `<div class="ev-focus">${evThumb(e,{big:true})}
    <div class="ev-fbar"><div><b data-u="${esc(e.author.username)}">@${esc(e.author.username)}</b>
      ${r?`<div class="dim ev-small">#${r.rank} · ${r.votes} ${r.votes===1?"vote":"votes"}</div>`:""}</div>
      ${voting?evVoteBtn(e):""}</div></div>`;
}
function evPollHTML(){
  const B=EV.board, me=EV.me;if(!B)return evQualifyHTML();
  const you=me.entry&&B.rows.find(x=>x.entryId===me.entry.id);
  return `<div class="ev-note">${evPollNote()}</div>
    ${you?`<div class="ev-you"><span>You're <b>#${you.rank}</b> with ${you.votes} ${you.votes===1?"vote":"votes"}</span>
      <button class="btn ghost" id="evshare">${DI.out} Share to Instagram</button></div>`:""}
    <div class="ev-sec"><h3>${EV.event.stage==="final"?"The final":"Scoreboard"} · ${B.total} ${B.total===1?"vote":"votes"}${B.frozen?" · frozen":""}</h3>
    <div class="ev-board">${B.rows.map(r=>{const e=evById(r.entryId);if(!e)return "";
      return `<div class="ev-row ${me.myVotes.includes(e.id)?"on":""}">
        <span class="ev-rk">${r.rank}</span>
        <img ${imgAttrs({url:e.imageUrl,thumb:e.thumbUrl,w:e.w,h:e.h,tw:e.tw,sm:e.sm,sw:e.sw})} alt="" loading="lazy" data-evzoom="${esc(e.imageUrl)}">
        <div class="ev-rwho"><b data-u="${esc(e.author.username)}">@${esc(e.author.username)}</b>
          <span class="dim">${r.votes} ${r.votes===1?"vote":"votes"} ${evMove(r.move)}</span></div>
        ${evVoteBtn(e)}</div>`}).join("")}</div></div>
    <a class="ev-boardlink" href="/e/${esc(EV.event.slug)}/board" target="_blank" rel="noopener">Open the public scoreboard</a>`;
}

/* ---- Share to Instagram ---- */
function evShareHTML(){
  const s=EVSHARE, url=evVoteUrl(s.id);
  return `<div class="sheet" id="evshsheet"><div class="sheetc ev-share">
    <div class="sheeth"><div><h2>Share to Instagram</h2></div><button class="x" id="evshx" aria-label="Close">${DI.x}</button></div>
    <div class="ev-shimg">${s.failed?`<div class="dim">Couldn't make the picture. Your link still works.</div>`:`<img src="${esc(s.img)}" alt="Your Story card" id="evshpic">`}</div>
    ${INAPP?`<ol class="ev-howto"><li>${esc(INAPP)}'s browser can't hand a picture to your Story. Open LABS in <b>${outBrowser()}</b> and share it from there.</li>
      <li>Or press and hold the picture to save it, add it to your Story, and put a <b>Link</b> sticker on it with your vote link.</li></ol>`
    :`<ol class="ev-howto"><li>Share the picture to your Story (or save it).</li>
      <li>Add a <b>Link</b> sticker with your vote link.</li>
      <li>Only votes in the app count — the link takes people straight to your piece.</li></ol>`}
    <div class="ev-link"><span>${esc(url.replace(/^https?:\/\//,""))}</span><button class="btn ghost" id="evshcopy">${DI.copy} Copy</button></div>
    ${INAPP?`<button class="btn green ev-cta" data-outgo>Open in ${outBrowser()}</button>`:`<button class="btn green ev-cta" id="evshgo">Share picture</button>`}
  </div></div>`;
}
function evOpenShare(id){
  EVSHARE={id,img:`/e/${encodeURIComponent(EVSLUG)}/${id}/story.jpg?t=${Math.floor(Date.now()/60000)}`};render();
}
async function evSharePic(){
  const s=EVSHARE, name=`tnl-${EVSLUG}-${s.id}.jpg`;
  try{
    const blob=await (await fetch(s.img)).blob();
    const file=new File([blob],name,{type:"image/jpeg"});
    if(navigator.canShare&&navigator.canShare({files:[file]})){await navigator.share({files:[file]});return}
    const a=document.createElement("a");a.href=URL.createObjectURL(blob);a.download=name;document.body.appendChild(a);a.click();
    setTimeout(()=>{URL.revokeObjectURL(a.href);a.remove()},1000);toast("Saved");
  }catch(e){if(e&&e.name!=="AbortError")toast("Couldn't share it — long-press the picture to save")}
}
function wireEvPoll(){
  const on=(sel,fn)=>{const el=$(sel);if(el)el.onclick=fn};
  on("#evshare",()=>evOpenShare(EV.me.entry.id));
  if(!EVSHARE)return;
  const close=()=>{EVSHARE=null;render()};
  on("#evshx",close);
  const bg=$("#evshsheet");if(bg)bg.onclick=e=>{if(e.target===bg)close()};
  const pic=$("#evshpic");if(pic)pic.onerror=()=>{EVSHARE.failed=true;render()};
  on("#evshgo",evSharePic);
  on("#evshcopy",async()=>{try{await navigator.clipboard.writeText(evVoteUrl(EVSHARE.id));toast("Link copied")}catch(e){toast("Couldn't copy")}});
}

/* Back to the piece after signing up / confirming email somewhere else. */
function evRemember(){try{localStorage.setItem("tnl-evret",JSON.stringify({slug:EVSLUG,v:EVFOCUS,t:Date.now()}))}catch(e){}}
function evReturn(){
  try{const r=JSON.parse(localStorage.getItem("tnl-evret")||"null");if(!r)return null;
    if(!ME||!ME.emailVerified)return null;localStorage.removeItem("tnl-evret");
    return Date.now()-r.t<3*864e5&&r.slug?r:null}catch(e){return null}
}
