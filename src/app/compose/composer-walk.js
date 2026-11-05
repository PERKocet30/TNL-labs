/* ── POST WALKTHROUGH · v1.1 — 2026-11-05 (your own #tag survives the suggestions landing while you type) · v1.0 ─────────────────────────────
   "Make the post composer walk you through the posting process like
   Instagram and the onboarding process or the product listing." And,
   minutes before: "if people don't send their work inside labs and use
   hashtags their work doesn't get featured in the showroom" — a strong
   lift for placed work (server/posts/rank.js v3.1), and this is the nudge.
   A new post is three short screens, Next at the bottom, Back at the top
   (and the phone's back goes back a step, app/nav/back.js):
     1 · media    Your work — photos, a video (the composer's own picker,
                  strip, edit and reorder). No picture? "Just words or a
                  song" skips ahead.
     2 · place    Where does it belong? — one tap picks its lab (your labs
                  first, each with what it's for); #tags people already use
                  there, one tap each, or your own. They go into the caption,
                  where #tags have always lived. Skippable: it stays on your
                  profile. Never says why — "so the right people find it".
     3 · details  The composer as it was: caption, people, music, products,
                  location, preview, advanced — and Post. On a phone the work
                  is a thumbnail beside the caption, like Instagram.
   Edit info (an existing post) keeps the one page (app/compose/post-edit).
   The step lives on the draft (PCOMPOSE.step); a restored draft opens on
   its details. */
const PCW_STEPS=["media","place","details"];
const pcwStep=c=>c&&!c.edit&&PCW_STEPS.includes(c.step)?c.step:"media";
const pcwHasMedia=c=>!!(c.imgs.length||c.upN||c.vid||c.vidbusy);
/* #tags in a caption, the way the labs read them (bodyTags, server/labs/places.js) */
const PCW_TAG_RE=/(^|[^\w&#/])#([a-z0-9_]{2,30})(?![\w])/gi;
const pcwTags=b=>{const s=new Set();for(const m of String(b||"").matchAll(PCW_TAG_RE))s.add(m[2].toLowerCase());return [...s]};
const pcwLabId=c=>c.ch?((labOfCh(c.ch.id)||{}).id||""):"";

function pcwGo(c,step){if(PCOMPOSE!==c||!PCW_STEPS.includes(step))return;c.step=step;if(step==="place")pcwSuggest(c);render();
  const b=document.querySelector("#pcov .pc-body");if(b)b.scrollTop=0}
/* the phone's back (app/nav/back.js): a step back, if there is one */
function pcwBack(){const c=PCOMPOSE;if(!c||c.edit)return false;const i=PCW_STEPS.indexOf(pcwStep(c));if(i<1)return false;pcwGo(c,PCW_STEPS[i-1]);return true}

/* #tags people already use in the lab you picked (or across LABS), for one-tap adding */
async function pcwSuggest(c){
  const lab=pcwLabId(c);if(c.pcwSugFor===lab&&c.pcwSug)return;
  c.pcwSugFor=lab;c.pcwSug=null;
  let tg=[];try{tg=(await papi.tags(lab,"")).tags||[]}catch(e){}
  if(PCOMPOSE!==c||c.pcwSugFor!==lab)return;
  c.pcwSug=tg.slice(0,12).map(t=>t.tag);if(pcwStep(c)!=="place")return;
  /* landing mid-word keeps the keyboard up and the caret where it was */
  const typing=document.activeElement&&document.activeElement.id==="pcwtagq";render();
  if(typing){const q=$("#pcwtagq");if(q){q.focus();try{q.setSelectionRange(q.value.length,q.value.length)}catch(e){}}}
}
function pcwToggleTag(c,raw){
  const t=String(raw||"").toLowerCase().replace(/^#+/,"").replace(/[^a-z0-9_]/g,"").slice(0,30);
  if(t.length<2)return toast("A #tag is 2–30 letters or numbers");
  const b=c.body||"";
  if(pcwTags(b).includes(t)){c.body=b.replace(new RegExp("(^|[^\\w&#/])#"+t+"(?![\\w])","gi"),"$1").replace(/[ \t]{2,}/g," ").replace(/[ \t]+\n/g,"\n").replace(/\n{3,}/g,"\n\n").trim();return}
  if(pcwTags(b).length>=10)return toast("Up to 10 #tags");
  const s=b.replace(/\s+$/,"");
  c.body=(s+(s?(/(^|\s)#[a-z0-9_]{2,30}$/i.test(s)?" ":"\n\n"):"")+"#"+t).slice(0,PC_CAP_MAX);
}

function pcwHead(c){
  const i=PCW_STEPS.indexOf(pcwStep(c)),last=i===PCW_STEPS.length-1;
  const left=i?{id:"pcwback",back:true}:{id:"pccancel",label:"Cancel"};
  const right=last?{id:"pcgo",label:c.busy?"Posting…":"Post",disabled:!pcCan(c)}:`<span class="sw-n">${i+1} / ${PCW_STEPS.length}</span>`;
  return formHead(left,"New post",right)+`<div class="sw-prog pcw-prog" aria-label="Step ${i+1} of ${PCW_STEPS.length}"><i style="width:${Math.round(((i+1)/PCW_STEPS.length)*100)}%"></i></div>`;
}
/* steps 1 and 2; step 3 is pcomposeHTML's own page */
function pcwHTML(c,media){
  const st=pcwStep(c);
  let body,bar;
  if(st==="media"){
    const has=pcwHasMedia(c)||!!pcCover(c);
    body=`<div class="pcw-in"><h1 class="sw-q">Your work</h1><p class="sw-p">Up to 10 photos and videos. Drag to reorder, tap Edit to crop or adjust.</p></div><div class="pc-media">${media}</div>`;
    bar=`${has?"":`<button type="button" class="sw-skip" id="pcwwords">No picture — just words or a song</button>`}<button class="gx-btn" id="pcwnext" ${has?"":"disabled"}>Next</button>`;
  }else{
    const on=pcwLabId(c),mine=pcwTags(c.body),sug=c.pcwSug;
    const all=[...mine,...(sug||[]).filter(t=>!mine.includes(t))];
    body=`<div class="pcw-in"><h1 class="sw-q">Where does it belong?</h1>
      <p class="sw-p">It's on your profile either way. Pick the lab it fits and a #tag or two — that's how the right people find it.</p>
      <h2 class="pcw-h">Lab</h2>
      <div class="sw-opts sw-grid pcw-labs">${labsOrdered().map(l=>`<button type="button" class="st-opt sw-opt${on===l.id?" on":""}" data-pcwlab="${esc(l.id)}" aria-pressed="${on===l.id}"><b><i class="lg">//</i> ${esc(l.name)}</b><span>${esc((LAB_ID[l.id]||{}).for||"")}</span></button>`).join("")}</div>
      <h2 class="pcw-h">#Tags</h2>
      <div class="pcw-tags">${sug===null&&!mine.length?`<span class="pcw-sk"></span><span class="pcw-sk"></span><span class="pcw-sk"></span>`
        :all.map(t=>`<button type="button" class="chip pcw-tag${mine.includes(t)?" on":""}" data-pcwtag="${esc(t)}" aria-pressed="${mine.includes(t)}">#${esc(t)}</button>`).join("")}</div>
      <form class="pcw-add" id="pcwtagf"><span class="pc-hash">#</span><input id="pcwtagq" value="${esc(c.pcwQ||"")}" placeholder="Add your own" autocomplete="off" autocapitalize="off" maxlength="31" enterkeyhint="done"><button class="btn sm ghost" type="submit">Add</button></form>
    </div>`;
    bar=`${!on&&!mine.length?`<button type="button" class="sw-skip" id="pcwskip">Skip — just my profile</button>`:""}<button class="gx-btn" id="pcwnext">Next</button>`;
  }
  return `<div class="pcmp-ov" id="pcov"><div class="pc pcw pcw-${st}" role="dialog" aria-label="New post">
    ${pcwHead(c)}
    <div class="pc-body"><div class="pcw-step">${body}</div></div>
    <div class="pf-bar pcw-bar">${bar}</div>
  </div></div>`;
}

function pcwWire(c){
  if(!c||c.edit)return;
  const st=pcwStep(c),i=PCW_STEPS.indexOf(st);
  const bk=$("#pcwback");if(bk)bk.onclick=()=>pcwGo(c,PCW_STEPS[i-1]);
  const nx=$("#pcwnext");if(nx)nx.onclick=()=>{if(st==="media"&&!pcwHasMedia(c)&&!pcCover(c))return;pcwGo(c,PCW_STEPS[i+1])};
  const wd=$("#pcwwords");if(wd)wd.onclick=()=>pcwGo(c,"place");
  const sk=$("#pcwskip");if(sk)sk.onclick=()=>pcwGo(c,"details");
  document.querySelectorAll("[data-pcwlab]").forEach(b=>b.onclick=()=>{
    const l=labsOrdered().find(x=>x.id===b.dataset.pcwlab);if(!l)return;
    if(pcwLabId(c)===l.id)c.ch=null;   // tap again: take it out
    else{const h=labHome(l);c.ch={id:h.id,label:l.name,lab:l.name}}
    pcwSuggest(c);render()});
  document.querySelectorAll("[data-pcwtag]").forEach(b=>b.onclick=()=>{pcwToggleTag(c,b.dataset.pcwtag);render()});
  /* what you're typing survives a repaint (the suggestions landing mid-word used to wipe it) */
  const tq=$("#pcwtagq");if(tq)tq.oninput=()=>{c.pcwQ=tq.value};
  const f=$("#pcwtagf");if(f)f.onsubmit=e=>{e.preventDefault();const q=$("#pcwtagq");if(!q||!q.value.trim())return;c.pcwQ="";
    const t=q.value.trim().toLowerCase().replace(/^#+/,"").replace(/[^a-z0-9_]/g,"");
    if(!pcwTags(c.body).includes(t)){pcwToggleTag(c,t);if(!pcwTags(c.body).includes(t))return}
    render();const q2=$("#pcwtagq");if(q2)q2.focus()};
}
