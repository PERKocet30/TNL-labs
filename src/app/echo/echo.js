/* ECHO v1.3 — 2026-11-04 (modelled on Claude: your words in a quiet card, Echo's answer as plain text on the page, written in as it streams over the live stream, "Thinking" / "Looking at orders" while it works, light markdown, copy, a new conversation from the pen). v1.2 — 2026-11-04 (the brain: for an admin, when the server has a key, Echo is a model that reasons — the same screen, a turn of kind "brain" with what it looked at, Start fresh instead of Talk to a person). v1.1 — 2026-11-04 (answers from Knowledge wear the entry's title; a pick names which kind it was). v1.0 — 2026-11-04. Echo is LABS's help, pinned at the top of Messages:
   ask in your own words, get an answer from what Echo knows about LABS
   (and about your own orders, shop and standing — nobody else's), thumbs it
   up or down, pick "I meant…" when it wasn't sure, or hand the conversation
   to a person. It paints into the Messages layer like a chat (server/echo).
   Admins only until Admin → Settings → Echo is switched on for everyone. */
const echoOn=()=>!!(ME&&(ME.isAdmin||SITE.echoOpen));
const eapi={
  hello:()=>req("/api/echo"),
  ask:q=>req("/api/echo/ask",{method:"POST",body:{q}}),
  helpful:(id,helpful)=>req("/api/echo/turns/"+id+"/helpful",{method:"POST",body:{helpful}}),
  pick:(id,src,picked)=>req("/api/echo/turns/"+id+"/pick",{method:"POST",body:src==="know"?{knowId:picked}:{faqId:picked}}),
  handoff:note=>req("/api/echo/handoff",{method:"POST",body:{note}}),
  reset:()=>req("/api/echo/reset",{method:"POST",body:{}}),
};
const echoBrain=()=>!!(ECHO&&ECHO.brain);
const ECHO_IC={
  mark:`<svg viewBox="0 0 24 24" width="26" height="26" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="square" stroke-linejoin="miter" aria-hidden="true"><path d="M4 12h2M8 7v10M12 4v16M16 7v10M20 10v4"/></svg>`,
  up:`<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="square" stroke-linejoin="miter" aria-hidden="true"><path d="M7 11v9H4v-9zM7 11l4-7h1a2 2 0 0 1 2 2v4h5l-1 10H7"/></svg>`,
  down:`<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="square" stroke-linejoin="miter" aria-hidden="true"><path d="M17 13V4h3v9zM17 13l-4 7h-1a2 2 0 0 1-2-2v-4H5L6 4h11"/></svg>`,
};
const echoAvHTML=cls=>`<span class="echo-av ${cls||""}" aria-hidden="true">${ECHO_IC.mark}</span>`;

/* the pinned row at the top of the inbox */
function echoRowHTML(){
  const last=ECHO&&ECHO.turns&&ECHO.turns.length?ECHO.turns[ECHO.turns.length-1]:null;
  const line=last?(last.text||"").split("\n")[0]:echoBrain()?"What are we working on?":"Ask anything about LABS";
  return `<button class="cx-row echo-row ${ECHOOPEN?"sel":""}" id="echorow" data-q="echo help">
    <span class="cx-av">${echoAvHTML()}</span>
    <span class="cx-rb"><b>Echo ${echoBrain()?"":`<span class="echo-tag">help</span>`}</b><span class="cx-rs"><span>${esc(line)}</span></span></span>
  </button>`}

/* ---- opening and closing (inside the Messages layer) ---- */
async function openEcho(){
  if(guest())return needAccount("Join to ask Echo.");
  if(!echoOn())return;
  DMOPENPANEL=true;ECHOOPEN=true;CHAT=null;CHATSHEET=null;CMENU=null;
  if(!ECHO)ECHO={turns:null};
  paintLayer();
  try{const d=await eapi.hello();if(!ECHOOPEN)return;ECHO=d;ECHO.stick=true;paintLayer()}
  catch(e){toast(e.message);closeEcho()}
}
function closeEcho(){ECHOOPEN=false;ECHOBUSY=false;paintLayer();if(DMOPENPANEL)loadInbox()}

/* ---- the screen ---- */
function echoThreadHTML(){
  return `<header class="cx-h cx-th echo-th">
      <button class="cx-ib" id="echoback" aria-label="Back">${CI.back}</button>
      <span class="cx-who"><span class="cx-av">${echoAvHTML("sm")}</span>
        <span><b>Echo</b><span class="mono">${echoBrain()?esc(ECHO.sub||"LABS's own"):ECHO&&ECHO.preview?"LABS help · admin preview":"LABS help"}</span></span></span>
      ${echoBrain()?`<button class="cx-ib" id="echofresh" aria-label="New conversation">${DI.edit}</button>`:`<button class="cx-ib" id="echoperson" aria-label="Talk to a person">${CI.people}</button>`}
    </header>
    <div class="cx-feed echo-feed" id="echofeed">${echoFeedHTML()}</div>
    <div class="c-foot" id="echofoot">${echoComposerHTML()}</div>`}

function echoFeedHTML(){
  const E=ECHO;
  if(!E||!E.turns)return `${skel()}`;
  let h=`<div class="cx-hello echo-hello">${echoAvHTML("lg")}<b>Echo</b><span class="mono">${echoBrain()?esc(E.sub||"LABS's own"):"LABS help"}</span></div>`;
  h+=echoBubble(E.hello,"first last");
  if(!E.turns.length&&E.starters&&E.starters.length)h+=`<div class="echo-chips">${E.starters.map(s=>`<button class="chip" data-echoask="${esc(s.question)}">${esc(s.question)}</button>`).join("")}</div>`;
  for(const t of E.turns)h+=echoTurnHTML(t);
  if(ECHOBUSY&&!echoBrain())h+=`<div class="c-m them first last echo-typing"><div class="c-col"><div class="c-bw"><div class="c-b"><i></i><i></i><i></i></div></div></div></div>`;
  return h;
}
const echoBubble=(text,cls)=>`<div class="c-m them ${cls||""}"><div class="c-col"><div class="c-bw"><div class="c-b">${rich(text||"")}</div></div></div></div>`;
function echoTurnHTML(t){
  let h=`<div class="c-m me first last"><div class="c-col"><div class="c-bw"><div class="c-b">${rich(t.asked)}</div></div></div></div>`;
  if(t.kind==="brain")return echoBrainTurnHTML(t);
  const f=t.facts;
  let facts="";
  if(f){const go=f.go?`<button class="btn ghost sm" data-echogo="${esc(f.go.to)}">${esc(f.go.label)}</button>`:"";
    facts=`<div class="echo-facts"><b>${esc(f.title)}</b>${(f.lines||[]).map(l=>`<span>${esc(l)}</span>`).join("")}${go}</div>`}
  let sug="";
  if(t.suggestions&&t.suggestions.length){const lbl=t.kind==="answer"?`<span class="mono">Related</span>`:"";
    sug=`<div class="echo-sug">${lbl}${t.suggestions.map(s=>`<button class="chip" data-echopick="${s.id}" data-echosrc="${esc(s.src||"faq")}" data-turn="${t.id}">${esc(s.question)}</button>`).join("")}</div>`}
  const person=`<button class="link echo-person" data-echoperson>Talk to a person</button>`;
  let rate="";
  if(t.kind==="answer"){
    if(t.helpful==null)rate=`<div class="echo-rate"><span class="mono">Did that help?</span><button class="echo-rb" data-echoyes="${t.id}" aria-label="Yes, that helped">${ECHO_IC.up}</button><button class="echo-rb" data-echono="${t.id}" aria-label="No">${ECHO_IC.down}</button></div>`;
    else rate=`<div class="echo-rate"><span class="mono">${t.helpful?"Glad it helped":"Noted — I\u2019ll learn from that"}</span>${t.helpful?"":person}</div>`;
  } else if(t.kind==="miss")rate=`<div class="echo-rate">${person}</div>`;
  const title=t.from==="know"&&t.title?`<b class="echo-kt">${esc(t.title)}</b>`:"";
  h+=`<div class="c-m them first last" data-echoturn="${t.id}"><div class="c-col"><div class="c-bw"><div class="c-b">${title}${rich(t.text||"")}</div>${facts}</div>${sug}${rate}</div></div>`;
  if(t.handoff)h+=`<div class="c-sys">${esc(t.handoff)}</div>`;
  return h;
}
/* ---- the brain's turn, modelled on Claude: your words in a quiet card, Echo's answer as text on the page ---- */
function echoBrainTurnHTML(t){
  const saw=(t.tools||[]).filter(x=>!/^knowledge_(add|edit)$/.test(x)),wrote=(t.tools||[]).some(x=>/^knowledge_(add|edit)$/.test(x));
  const looked=saw.length||wrote?`<span class="echo-looked">${saw.length?"Looked at "+saw.map(x=>esc(x.replace(/_/g," "))).join(", "):""}${saw.length&&wrote?" · ":""}${wrote?"Wrote to Knowledge":""}</span>`:"";
  const foot=t.pending?`<div class="echo-work" aria-live="polite"><i></i><span>${esc(t.status||"Thinking")}</span></div>`
    :`<div class="echo-foot">${looked}${t.text&&!t.failed?`<button class="echo-copy" data-echocopy="${t.id}" aria-label="Copy">${DI.copy}</button>`:""}</div>`;
  return `<div class="echo-q"><div class="echo-qb">${rich(t.asked)}</div></div>
    <div class="echo-a ${t.failed?"echo-failed":""} ${t.pending?"pending":""}" data-echoturn="${t.id}">${echoAvHTML("xs")}<div class="echo-ab"><div class="echo-text">${echoMd(t.text||"")}</div>${foot}</div></div>`;
}
/* Light markdown, the way Claude writes for a screen: paragraphs, bullets, numbers, **bold**, `code`. Escaped first, always. */
function echoMd(t){
  const lines=String(t||"").replace(/\r/g,"").split("\n");
  let h="",list=null,para=[];
  const inline=x=>rich(x).replace(/\*\*([^*]+)\*\*/g,"<b>$1</b>").replace(/`([^`]+)`/g,"<code>$1</code>");
  const flushP=()=>{if(para.length){h+=`<p>${inline(para.join(" "))}</p>`;para=[]}};
  const flushL=()=>{if(list){h+=`</${list}>`;list=null}};
  for(const raw of lines){
    const l=raw.trimEnd();
    const b=/^\s*[-*•]\s+(.*)$/.exec(l),n=/^\s*\d+[.)]\s+(.*)$/.exec(l),hd=/^#{1,4}\s+(.*)$/.exec(l);
    if(b||n){flushP();const want=b?"ul":"ol";if(list!==want){flushL();list=want;h+=`<${want}>`}h+=`<li>${inline((b||n)[1])}</li>`;continue}
    flushL();
    if(!l.trim()){flushP();continue}
    if(hd){flushP();h+=`<p><b>${inline(hd[1])}</b></p>`;continue}
    para.push(l.trim());
  }
  flushP();flushL();
  return h;
}
/* Live from the server while Echo works (app/messages/live.js → "echo"): text as it's written, what it's looking at. */
function onEchoLive(d){
  if(!echoBrain()||!ECHO.turns||!d)return;
  const t=ECHO.turns.find(x=>x.pending&&x.kind==="brain");if(!t)return;
  const w=$(`[data-echoturn="${t.id}"] .echo-work span`);
  if(d.kind==="text"){t.text=(t.text||"")+d.text;t.status="Writing";const n=$(`[data-echoturn="${t.id}"] .echo-text`);if(n)n.innerHTML=echoMd(t.text);if(w)w.textContent="Writing"}
  else if(d.kind==="status"){t.status=d.text;if(w)w.textContent=d.text}
  const f=$("#echofeed");if(f&&f.scrollHeight-f.scrollTop-f.clientHeight<160)f.scrollTop=f.scrollHeight;
}
const echoModelName=m=>{const p=String(m||"").replace(/^claude-/,"").split("-");if(!p[0])return"";return"Claude "+p[0][0].toUpperCase()+p[0].slice(1)+(p.length>1?" "+p.slice(1).join("."):"")};
function echoComposerHTML(){
  const has=(ECHODRAFT||"").trim();
  if(echoBrain())return `<div class="echo-box ${ECHOBUSY?"busy":""}">
      <textarea class="echo-in" id="echodraft" rows="1" placeholder="Talk to Echo" enterkeyhint="send">${esc(ECHODRAFT||"")}</textarea>
      <div class="echo-boxr"><span class="mono">${esc(echoModelName(ECHO&&ECHO.model))}</span><button class="echo-send" id="echosend" aria-label="Send" ${has&&!ECHOBUSY?"":"disabled"}>${DI.chev}</button></div>
    </div>`;
  return `<div class="composer c-comp">
      <textarea class="in c-in" id="echodraft" rows="1" placeholder="Ask Echo…" enterkeyhint="send" ${ECHOBUSY?"disabled":""}>${esc(ECHODRAFT||"")}</textarea>
      <button class="send" id="echosend" aria-label="Send" ${has&&!ECHOBUSY?"":"hidden"}>${CI.send}</button>
    </div>`}

/* ---- doing ---- */
function echoPaintFeed(){const f=$("#echofeed");if(!f)return;f.innerHTML=echoFeedHTML();wireEchoFeed(f);f.scrollTop=f.scrollHeight}
async function echoAsk(q){
  q=(q||"").trim();if(!q||ECHOBUSY||!ECHO||!ECHO.turns)return;
  ECHODRAFT="";ECHOBUSY=true;
  const d=$("#echodraft");if(d){d.value="";fitDraft(d)}
  ECHO.turns.push(echoBrain()?{id:"p"+Date.now(),asked:q,kind:"brain",pending:true,status:"Thinking",text:"",tools:[]}:{id:"p"+Date.now(),asked:q,kind:"pending",text:"",suggestions:[]});
  echoPaintFeed();const s=$("#echosend");if(s){if(echoBrain())s.disabled=true;else s.hidden=true}
  const drop=()=>{const i=ECHO.turns.findIndex(x=>x.pending||x.kind==="pending");if(i>=0)ECHO.turns.splice(i,1)};
  try{const r=await eapi.ask(q);drop();ECHO.turns.push(r.turn)}
  catch(e){drop();toast(e.message)}
  ECHOBUSY=false;const d2=$("#echodraft");if(d2){d2.disabled=false}
  echoPaintFeed();
}
async function echoPick(turnId,src,picked){
  try{const r=await eapi.pick(turnId,src,picked);const i=ECHO.turns.findIndex(t=>String(t.id)===String(turnId));if(i>=0)ECHO.turns[i]=r.turn;echoPaintFeed()}
  catch(e){toast(e.message)}
}
async function echoRate(turnId,yes){
  const t=ECHO.turns.find(x=>String(x.id)===String(turnId));if(!t)return;
  t.helpful=yes?1:0;echoPaintFeed();
  try{await eapi.helpful(turnId,yes)}catch(e){}
}
async function echoHandoff(){
  if(!ECHO||!ECHO.turns)return;
  const ok=await uiConfirm("Talk to a person?","This conversation goes to the LABS team. They reply by email.",{okLabel:"Send it"});
  if(!ok)return;
  try{const r=await eapi.handoff("");const last=ECHO.turns[ECHO.turns.length-1];
    if(last)last.handoff=r.text;else ECHO.turns.push({id:"h"+Date.now(),asked:"Talk to a person",kind:"answer",text:r.text,helpful:1,suggestions:[]});
    echoPaintFeed();toast("Sent to the LABS team")}
  catch(e){toast(e.message)}
}
async function echoFresh(){
  if(!ECHO||!ECHO.turns||ECHOBUSY)return;
  const ok=await uiConfirm("New conversation?","This one is put away. Echo keeps everything it wrote in Knowledge.",{okLabel:"New conversation"});
  if(!ok)return;
  try{await eapi.reset();ECHO.turns=[];echoPaintFeed()}catch(e){toast(e.message)}
}
/* a fact card's button lands on the thing it's about */
function echoGo(to){
  closeMessages();
  if(to==="climb"){CLIMB=true;CLIMBOPENRUNG=levelFor(ME.rep).id;render();return}
  TAB="market";MKTVIEW="orders";ORDTAB=to==="orders"?"buying":"selling";render();
  api.orders().then(o=>{ORDERS=o;render()}).catch(()=>{});
}

/* ---- wiring (called from the Messages layer's wireLayer) ---- */
function wireEcho(L){
  const on=(id,fn)=>{const el=L.querySelector("#"+id);if(el)el.onclick=fn};
  on("echorow",()=>openEcho());
  on("echoback",()=>closeEcho());
  on("echoperson",()=>echoHandoff());
  on("echofresh",()=>echoFresh());
  const f=L.querySelector("#echofeed");if(f){wireEchoFeed(f);if(ECHO&&ECHO.stick){f.scrollTop=f.scrollHeight;ECHO.stick=false}}
  const d=L.querySelector("#echodraft");
  if(d){fitDraft(d);
    d.oninput=()=>{ECHODRAFT=d.value;fitDraft(d);const s=$("#echosend");if(s){if(echoBrain())s.disabled=!d.value.trim()||ECHOBUSY;else s.hidden=!d.value.trim()||ECHOBUSY}};
    d.onkeydown=e=>{if(e.key==="Enter"&&!e.shiftKey){e.preventDefault();echoAsk(d.value)}}}
  on("echosend",()=>{const d2=$("#echodraft");echoAsk(d2?d2.value:ECHODRAFT)});
}
function wireEchoFeed(f){
  f.querySelectorAll("[data-echoask]").forEach(b=>b.onclick=()=>echoAsk(b.dataset.echoask));
  f.querySelectorAll("[data-echopick]").forEach(b=>b.onclick=()=>echoPick(b.dataset.turn,b.dataset.echosrc,+b.dataset.echopick));
  f.querySelectorAll("[data-echoyes]").forEach(b=>b.onclick=()=>echoRate(b.dataset.echoyes,true));
  f.querySelectorAll("[data-echono]").forEach(b=>b.onclick=()=>echoRate(b.dataset.echono,false));
  f.querySelectorAll("[data-echoperson]").forEach(b=>b.onclick=()=>echoHandoff());
  f.querySelectorAll("[data-echogo]").forEach(b=>b.onclick=()=>echoGo(b.dataset.echogo));
  f.querySelectorAll("[data-echocopy]").forEach(b=>b.onclick=()=>{const t=ECHO.turns.find(x=>String(x.id)===String(b.dataset.echocopy));if(!t)return;navigator.clipboard&&navigator.clipboard.writeText(t.text||"").then(()=>toast("Copied"),()=>toast("Couldn\u2019t copy"))});
}
