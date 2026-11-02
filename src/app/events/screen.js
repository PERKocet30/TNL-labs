/* v2026-10-20: the tournament's top and the Enter sheet's head come from the screen kit */
/* ================================================================
   EVENT SCREEN v1.2 — 2026-10-12 (state + what you see). v1.2: a ‹ back
   bar at the top that stays put as you scroll ("make sure the tournament
   is easily navigable because I had problems going back" — the home-screen
   app and Instagram's browser have no back button of their own).
   v1.2 also: "Invite people" — the link to send (tnllabs.com/
   tournament for the current one, else /e/:slug), shared or copied.
   v1.2 also: "Every entry is in // Visual" — the lab its entries post into,
   opened on its Tournament chip (app/labs/places.js).
   v1.1 — 2026-10-07. The tournament
   lives here: the brief, entering, the gallery, the vote, the bracket,
   the final and the results. The server decides everything; this only
   shows the phase you're in and sends your picks. Wiring:
   app/events/wire.js. The poll + scoreboard: app/events/poll.js.
   Engine: server/events/*.js.
================================================================ */
const evApi={
  list:()=>req("/api/events"),
  one:s=>req("/api/events/"+encodeURIComponent(s)),
  enter:(s,b)=>req("/api/events/"+encodeURIComponent(s)+"/enter",{method:"POST",body:b}),
  withdraw:s=>req("/api/events/"+encodeURIComponent(s)+"/entry",{method:"DELETE"}),
  vote:(s,entryId,on)=>req("/api/events/"+encodeURIComponent(s)+"/vote",{method:"POST",body:{entryId,on}}),
  score:(s,entryId,score)=>req("/api/events/"+encodeURIComponent(s)+"/score",{method:"POST",body:{entryId,score}}),
};

/* "3d 4h left", "52m left" */
function evLeft(end){
  if(!end)return "";
  let m=Math.max(0,Math.round((end-Date.now())/60000));
  const d=Math.floor(m/1440),h=Math.floor(m%1440/60);m=m%60;
  return (d?`${d}d ${h}h`:h?`${h}h ${m}m`:`${m}m`)+" left";
}
const evDay=t=>t?new Date(t).toLocaleDateString([], {month:"short",day:"numeric"}):"";
const EVPH={upcoming:"Coming up",submit:"Entries open",qualify:"Voting",round:"Round",final:"Final",results:"Results"};
function evPhaseLine(e){
  const p=e.phase;
  if(e.void)return "Called off — not enough entries";
  if(p.phase==="upcoming")return `Entries open ${evDay(p.end)}`;
  if(p.phase==="results")return "Results are in";
  const name=p.phase==="round"?`Round ${p.round}`:p.phase==="qualify"?"Voting is open":p.phase==="final"?"The final":"Entries are open";
  return `${name} · <span class="ev-left" data-end="${p.end}">${evLeft(p.end)}</span>`;
}

/* The Showroom's way in: one line, only while there's something to do. */
function eventBannerHTML(){
  const c=EVLIST&&EVLIST.current;if(!c)return "";
  const verb={upcoming:"Coming up",submit:"Enter now",qualify:"Vote now",round:"Vote now",final:"The final",results:"Results"}[c.phase]||"Open";
  return `<button class="ev-banner" data-evopen="${esc(c.slug)}">
    ${c.coverUrl?`<img src="${esc(c.coverUrl)}" alt="">`:""}
    <span class="ev-bt"><span class="ev-eye"><b>//</b> Event</span><b>${esc(c.title)}</b></span>
    <span class="ev-go">${verb}</span></button>`;
}

const evById=id=>EV&&EV.entries.find(e=>e.id===id);
function evThumb(e,opts={}){
  if(!e)return `<div class="ev-th ev-empty"></div>`;
  const mine=EV.me.entry&&EV.me.entry.id===e.id, picked=EV.me.myVotes.includes(e.id);
  return `<div class="ev-th ${picked?"on":""} ${opts.big?"big":""}">
    <img ${imgAttrs({url:e.imageUrl,thumb:e.thumbUrl,w:e.w,h:e.h,tw:e.tw,sm:e.sm,sw:e.sw},!!opts.big)} alt="" ${opts.big?`style="aspect-ratio:${e.w&&e.h?e.w+"/"+e.h:"4/5"}"`:`loading="lazy"`} data-evzoom="${esc(e.imageUrl)}">
    ${opts.pick&&!mine?`<button class="ev-pick${EVWAIT&&EVWAIT.id===e.id?" busy":""}" data-evpick="${e.id}" aria-label="${picked?"Take back":"Pick"}">${picked?DI.check:DI.plus}</button>`:""}
    ${mine?`<span class="ev-mine">Yours</span>`:""}
    ${opts.seed&&e.seed?`<span class="ev-seed">${e.seed}</span>`:`<button class="ev-shr" data-evshr="${e.id}" aria-label="Share @${esc(e.author.username)}'s piece">${DI.out}</button>`}
    <div class="ev-by" data-u="${esc(e.author.username)}">@${esc(e.author.username)}</div></div>`;
}

function evHeadHTML(){
  const e=EV.event, J=e.judges;
  return `<div class="ev-head">
    <div class="ev-eye"><b>//</b> Event</div>
    <h1 class="ev-h">${esc(e.title)}</h1>
    <div class="ev-ph">${evPhaseLine(e)}</div>
    ${e.prize?`<div class="ev-prize">${esc(e.prize)}</div>`:""}
    ${e.coverUrl?`<img class="ev-cover" src="${esc(e.coverUrl)}" alt="" data-evzoom="${esc(e.coverUrl)}">`:""}
    ${e.brief?`<p class="ev-brief">${rich(e.brief)}</p>`:""}
    <div class="ev-meta">
      <span>${e.format==="bracket"?"Bracket":e.format==="poll"?`Open vote · live scoreboard · ${e.picks===1?"1 vote":e.picks+" votes"} a day`:"Open vote"} · final ${e.judgeWeight?`${e.judgeWeight}% judges, ${100-e.judgeWeight}% votes`:"most votes wins"}</span>
      ${J.length?`<span>Judges: ${J.map(j=>`<a data-u="${esc(j.username)}">@${esc(j.username)}</a>`).join(", ")}</span>`:""}
      <a href="/e/${esc(e.slug)}/rules" target="_blank" rel="noopener">Official rules</a>
      ${evLab(e)?`<a href="#" data-evlab="${evLab(e).id}">Every entry is in ${esc(labMark(evLab(e).name))}</a>`:""}
    </div>
    ${evStepsHTML()}
    ${e.phase.phase==="results"?"":`<div class="ev-invite"><div class="ev-inv-t"><b>Invite people</b><span>${esc(evLink(e).replace(/^https?:\/\//,""))}</span></div>
      <button class="btn ghost ev-inv-b" id="evinvite">${DI.out} Share link</button></div>`}
  </div>`;
}
/* The link to send people: /tournament while this is the one on now. */
const evLink=e=>location.origin+(e.current?"/tournament":"/e/"+encodeURIComponent(e.slug));
/* The road: where we are, what's next, with dates. */
function evStepsHTML(){
  const s=EV.event.schedule, cur=EV.event.phase;
  return `<ol class="ev-steps">${s.map(p=>{
    const on=p.phase===cur.phase&&(p.round||0)===(cur.round||0), past=p.end!=null&&p.end<=Date.now();
    return `<li class="${on?"on":""} ${past?"past":""}"><b>${p.phase==="round"?"Round "+p.round:EVPH[p.phase]}</b><span>${evDay(p.start)}</span></li>`}).join("")}</ol>`;
}

function evSubmitHTML(){
  const me=EV.me, n=EV.entries.length;
  let mine="";
  if(me.isJudge)mine=`<div class="ev-note">You're judging this one. You'll score the finalists in the final.</div>`;
  else if(me.entry)mine=`<div class="ev-sec"><h3>Your entry</h3><div class="ev-yours">${evThumb(me.entry)}
      <div><p>${esc(me.entry.caption||"")}</p><button class="btn green" id="evshare">${DI.out} Share to Instagram</button> <button class="btn ghost" id="evwithdraw">Withdraw</button>
      <div class="dim ev-small">You can withdraw and enter something else until entries close.</div></div></div></div>`;
  else mine=`<button class="btn green ev-cta" id="eventer">${me.signedIn?"Enter your piece":"Sign in to enter"}</button>
    <div class="dim ev-small">One piece per person, your own original work.</div>`;
  return `${mine}<div class="ev-sec"><h3>${n} ${n===1?"entry":"entries"} so far</h3>
    ${n?`<div class="ev-grid">${EV.entries.map(e=>evThumb(e)).join("")}</div>`:`<div class="dim">Be the first.</div>`}</div>`;
}

/* The reason you can't vote, and the one that's yours to fix gets a button (2026-10-28: a profile photo). */
const evBlockHTML=b=>esc(b)+(/profile photo/i.test(b)?` <button class="btn ghost ev-fix" id="evaddphoto">Add a photo</button>`:"");
function evQualifyHTML(){
  const me=EV.me, left=EV.event.picks-me.myVotes.length;
  return `<div class="ev-note">${me.voteBlock?evBlockHTML(me.voteBlock):`Pick your favourites — <b>${left} of ${EV.event.picks}</b> picks left. Counts stay hidden until voting closes.`}</div>
    <div class="ev-grid">${EV.entries.map(e=>evThumb(e,{pick:!me.voteBlock})).join("")}</div>`;
}

function evMatchupsHTML(round,live){
  return round.matchups.map(m=>{
    const a=evById(m.a),b=evById(m.b);
    const side=(e,pct,win)=>`<div class="ev-side ${win?"win":""} ${m.winner&&!win?"lost":""}">${evThumb(e,{pick:live&&!EV.me.voteBlock,seed:true})}
      ${pct!=null?`<div class="ev-pct">${pct}%</div>`:""}</div>`;
    return `<div class="ev-match">${side(a,m.aPct,m.winner&&m.winner===m.a)}<span class="ev-vs">vs</span>${side(b,m.bPct,m.winner&&m.winner===m.b)}</div>`;
  }).join("");
}
function evBracketHTML(){
  const B=EV.bracket;if(!B)return "";
  const cur=EV.event.phase, liveR=cur.phase==="round"?cur.round:0;
  const done=B.rounds.filter(r=>r.matchups.length&&r.round!==liveR).reverse();
  return `${liveR?`<div class="ev-note">${EV.me.voteBlock?evBlockHTML(EV.me.voteBlock):"Pick one from each pair. Results show when the round closes."}</div>
    ${evMatchupsHTML(B.rounds[liveR-1],true)}`:""}
    ${done.map(r=>`<div class="ev-sec"><h3>Round ${r.round}</h3>${evMatchupsHTML(r,false)}</div>`).join("")}`;
}

function evFinalHTML(){
  const me=EV.me, F=(EV.finalists||[]).map(evById).filter(Boolean);
  return `<div class="ev-note">${me.isJudge?"Score each finalist from 1 to 10.":me.voteBlock?evBlockHTML(me.voteBlock):"Pick your winner. Judges score the finalists too."}</div>
    <div class="ev-final ${F.length===2?"two":""}">${F.map(e=>`<div class="ev-fin">${evThumb(e,{big:true,pick:!me.isJudge&&!me.voteBlock})}
      ${me.isJudge?`<div class="ev-score">${[1,2,3,4,5,6,7,8,9,10].map(n=>`<button class="${me.myScores[e.id]===n?"on":""}" data-evscore="${e.id}" data-n="${n}">${n}</button>`).join("")}</div>`:""}
    </div>`).join("")}</div>${evBracketHTML()}`;
}

function evResultsHTML(){
  const R=EV.results;if(!R||!R.winner)return `<div class="ev-note">No winner this time.</div>`;
  const w=evById(R.winner);
  return `<div class="ev-win">${evThumb(w,{big:true})}<div class="ev-eye"><b>//</b> Winner</div>
      <h2>${esc(w?w.author.displayName:"")}</h2></div>
    <div class="ev-sec"><h3>The final</h3>${R.ranking.map((r,i)=>{const e=evById(r.entryId);return e?`<div class="ev-rank">
      <span class="ev-n">${i+1}</span>${evThumb(e)}<div><b>${esc(e.author.displayName)}</b>
      <div class="dim ev-small">${EV.event.judgeWeight?`Judges ${r.judgePct}% · Votes ${r.votePct}% · Score ${r.score}`:`${r.votePct}% of the votes`}</div></div></div>`:""}).join("")}</div>
    ${evBracketHTML()}`;
}

/* The lab an event's entries post into (Visual, for the art tournament). */
const evLab=e=>LABS.find(l=>l.channels.some(c=>c.id===e.channel))||null;
/* The ‹ bar: walks back the same trail as the phone's back (app/nav/back.js). */
const evTopHTML=()=>screenHead({back:{id:"evback",label:"Back"},title:"Tournament"});   // the kit's head, kept at the top as you scroll (.ev>.sh)
function eventHTML(){
  if(!EV||EV.event.slug!==EVSLUG)return `<div class="scroll ev" id="evscroll">${evTopHTML()}${skel("cards")}</div>`;
  const p=EV.event.phase.phase;
  const body=EV.event.void?`<div class="ev-note">This one was called off — not enough entries came in.</div>`
    :p==="upcoming"?`<div class="ev-note">Entries open ${evDay(EV.event.phase.end)}. Start thinking.</div>`
    :p==="submit"?evSubmitHTML():EV.board&&!(p==="final"&&EV.me.isJudge)?evPollHTML():p==="qualify"?evQualifyHTML():p==="round"?evBracketHTML():p==="final"?evFinalHTML():evResultsHTML();
  return `<div class="scroll ev" id="evscroll">${evTopHTML()}${evFocusHTML()}${evHeadHTML()}${body}</div>${EVENTER?evEnterHTML():""}${EVSHARE?evShareHTML():""}`;
}

function evEnterHTML(){
  const s=EVENTER;
  return `<div class="sheet" id="evsheet"><div class="sheetc ev-enter">
    ${sheetHead("Enter "+EV.event.title,"evx")}
    <label class="ev-drop">${s.prep?`<img src="${s.prep.thumb}" alt="">`:`<span>${DI.plus}<br>Choose your piece</span>`}
      <input type="file" id="evfile" accept="image/*" hidden></label>
    <textarea class="in ev-cap" id="evcap" maxlength="500" placeholder="Say something about it (optional)">${esc(s.caption||"")}</textarea>
    <label class="ev-agree"><input type="checkbox" id="evagree" ${s.agree?"checked":""}>
      <span>This is my own original work, and I agree to the <a href="/e/${esc(EV.event.slug)}/rules" target="_blank" rel="noopener">official rules</a>.</span></label>
    <button class="btn green ev-cta" id="evsend" ${s.prep&&s.agree&&!s.busy?"":"disabled"}>${s.busy?"Uploading…":"Enter"}</button>
  </div></div>`;
}
