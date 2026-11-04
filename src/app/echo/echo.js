/* ECHO v1.6 — 2026-11-04 (the hands: a card under an answer — what Echo set up and why, Confirm · Not now; done, declined or failed after; live when decided). v1.5 — 2026-11-04 (what Claude's app has: photos and PDFs on a message (the photo button, thumbnails over the composer), dictation (the mic — the phone's own speech recognition, no outside service), answers read aloud (the speaker in the header, remembered on this phone), "Searched the web" under an answer). v1.4 — 2026-11-04 (pick the model: tap its name under the composer — a sheet of the three, a line on each; every answer says which one wrote it). v1.3 — 2026-11-04 (modelled on Claude: your words in a quiet card, Echo's answer as plain text on the page, written in as it streams over the live stream, "Thinking" / "Looking at orders" while it works, light markdown, copy, a new conversation from the pen). v1.2 — 2026-11-04 (the brain: for an admin, when the server has a key, Echo is a model that reasons — the same screen, a turn of kind "brain" with what it looked at, Start fresh instead of Talk to a person). v1.1 — 2026-11-04 (answers from Knowledge wear the entry's title; a pick names which kind it was). v1.0 — 2026-11-04. Echo is LABS's help, pinned at the top of Messages:
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
  model:model=>req("/api/echo/model",{method:"POST",body:{model}}),
  attach:(data,name)=>req("/api/echo/attach",{method:"POST",body:{data,name}}),
  confirm:id=>req("/api/echo/proposals/"+id+"/confirm",{method:"POST",body:{}}),
  decline:id=>req("/api/echo/proposals/"+id+"/decline",{method:"POST",body:{}}),
};
const echoCanDictate=()=>!!(window.SpeechRecognition||window.webkitSpeechRecognition);
const echoVoiceOn=()=>{try{return localStorage.getItem("tnl-echo-voice")==="1"}catch(e){return false}};
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
      ${echoBrain()?`${"speechSynthesis" in window?`<button class="cx-ib ${echoVoiceOn()?"on":""}" id="echovoice" aria-label="${echoVoiceOn()?"Stop reading answers aloud":"Read answers aloud"}" aria-pressed="${echoVoiceOn()}">${echoVoiceOn()?DI.soundOn:DI.soundOff}</button>`:""}<button class="cx-ib" id="echofresh" aria-label="New conversation">${DI.edit}</button>`:`<button class="cx-ib" id="echoperson" aria-label="Talk to a person">${CI.people}</button>`}
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
  const saw=(t.tools||[]).filter(x=>!/^knowledge_(add|edit)$|^web_search$/.test(x)),wrote=(t.tools||[]).some(x=>/^knowledge_(add|edit)$/.test(x)),web=(t.tools||[]).includes("web_search");
  const bits=[saw.length?"Looked at "+saw.map(x=>esc(x.replace(/_/g," "))).join(", "):"",web?"Searched the web":"",wrote?"Wrote to Knowledge":""].filter(Boolean);
  const looked=bits.length?`<span class="echo-looked">${bits.join(" · ")}</span>`:"";
  const files=(t.files||[]).length?`<div class="echo-qf">${t.files.map(f=>f.kind==="pdf"?`<a class="echo-pdf" href="${esc(f.url)}" target="_blank" rel="noreferrer">${DI.stack}<span>${esc(f.name||"PDF")}</span></a>`:`<img src="${esc(f.url)}" alt="" loading="lazy">`).join("")}</div>`:"";
  const foot=t.pending?`<div class="echo-work" aria-live="polite"><i></i><span>${esc(t.status||"Thinking")}</span></div>`
    :`<div class="echo-foot">${looked}${t.model&&!t.failed?`<span class="echo-by">${looked?" · ":""}${esc(t.model)}</span>`:""}${t.text&&!t.failed?`<button class="echo-copy" data-echocopy="${t.id}" aria-label="Copy">${DI.copy}</button>`:""}</div>`;
  const cards=(t.proposals||[]).map(echoCardHTML).join("");
  return `<div class="echo-q"><div class="echo-qb">${files}${t.asked?rich(t.asked):""}</div></div>
    <div class="echo-a ${t.failed?"echo-failed":""} ${t.pending?"pending":""}" data-echoturn="${t.id}">${echoAvHTML("xs")}<div class="echo-ab"><div class="echo-text">${echoMd(t.text||"")}</div><div class="echo-cards">${cards}</div>${foot}</div></div>`;
}
/* a hand's card: what Echo set up, why, and the one button that runs it */
function echoCardHTML(p){
  const st=p.status;
  const tail=st==="pending"?`<div class="echo-cb"><button class="btn sm" data-echook="${p.id}">Confirm</button><button class="btn ghost sm" data-echono-card="${p.id}">Not now</button></div>`
    :`<div class="echo-cs ${st}">${st==="confirmed"?"Done":st==="declined"?"Not now":"Didn\u2019t work"}${p.result?` · ${esc(p.result)}`:""}</div>`;
  return `<div class="echo-card ${st}" data-echocard="${p.id}"><b>${esc(p.title)}</b>${p.why?`<span>${esc(p.why)}</span>`:""}${tail}</div>`;
}
async function echoDecide(id,yes){
  const card=$(`[data-echocard="${id}"]`);if(card)card.classList.add("busy");
  try{const r=yes?await eapi.confirm(id):await eapi.decline(id);echoCardUpdate(r.proposal);if(yes)toast(r.ok?"Done":"Didn\u2019t work")}
  catch(e){if(card)card.classList.remove("busy");toast(e.message)}
}
function echoCardUpdate(p){
  if(!p||!ECHO||!ECHO.turns)return;
  for(const t of ECHO.turns){const i=(t.proposals||[]).findIndex(x=>x.id===p.id);if(i>=0){t.proposals[i]=p;break}}
  const card=$(`[data-echocard="${p.id}"]`);if(card){card.outerHTML=echoCardHTML(p);const f=$("#echofeed");if(f)wireEchoFeed(f)}
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
  if(d.kind==="proposal"){echoCardUpdate(d.proposal);return}
  const t=ECHO.turns.find(x=>x.pending&&x.kind==="brain");if(!t)return;
  const w=$(`[data-echoturn="${t.id}"] .echo-work span`);
  if(d.kind==="text"){t.text=(t.text||"")+d.text;t.status="Writing";const n=$(`[data-echoturn="${t.id}"] .echo-text`);if(n)n.innerHTML=echoMd(t.text);if(w)w.textContent="Writing"}
  else if(d.kind==="status"){t.status=d.text;if(w)w.textContent=d.text}
  else if(d.kind==="proposal"){echoCardUpdate(d.proposal);return}
  const f=$("#echofeed");if(f&&f.scrollHeight-f.scrollTop-f.clientHeight<160)f.scrollTop=f.scrollHeight;
}
const echoModelName=m=>{const p=String(m||"").replace(/^claude-/,"").split("-");if(!p[0])return"";return"Claude "+p[0][0].toUpperCase()+p[0].slice(1)+(p.length>1?" "+p.slice(1).join("."):"")};
function echoComposerHTML(){
  const has=(ECHODRAFT||"").trim();
  if(echoBrain()){const att=ECHO.att||[];
    const thumbs=att.length?`<div class="echo-att">${att.map((a,i)=>`<span class="echo-atti ${a.url?"":"up"}">${a.kind==="pdf"?`<i>${DI.stack}</i>`:`<img src="${esc(a.preview||a.url)}" alt="">`}<button class="echo-attx" data-echoattx="${i}" aria-label="Remove">${CI.x}</button></span>`).join("")}</div>`:"";
    const ready=(has||att.some(a=>a.url))&&!att.some(a=>!a.url&&!a.failed)&&!ECHOBUSY;
    return `<div class="echo-box ${ECHOBUSY?"busy":""}">${thumbs}
      <textarea class="echo-in" id="echodraft" rows="1" placeholder="${ECHO.listening?"Listening…":"Talk to Echo"}" enterkeyhint="send">${esc(ECHODRAFT||"")}</textarea>
      <div class="echo-boxr"><span class="echo-boxl"><input type="file" id="echofile" accept="image/*,application/pdf" multiple hidden><button class="echo-ib" id="echophoto" aria-label="Add a photo or PDF">${CI.img}</button>${echoCanDictate()?`<button class="echo-ib ${ECHO.listening?"live":""}" id="echomic" aria-label="${ECHO.listening?"Stop listening":"Speak"}">${CI.mic}</button>`:""}<button class="echo-pick mono" id="echomodel" aria-label="Pick the model">${esc(echoModelName(ECHO&&ECHO.model))}${DI.chev}</button></span><button class="echo-send" id="echosend" aria-label="Send" ${ready?"":"disabled"}>${DI.chev}</button></div>
    </div>`}
  return `<div class="composer c-comp">
      <textarea class="in c-in" id="echodraft" rows="1" placeholder="Ask Echo…" enterkeyhint="send" ${ECHOBUSY?"disabled":""}>${esc(ECHODRAFT||"")}</textarea>
      <button class="send" id="echosend" aria-label="Send" ${has&&!ECHOBUSY?"":"hidden"}>${CI.send}</button>
    </div>`}

/* ---- doing ---- */
function echoPaintFeed(){const f=$("#echofeed");if(!f)return;f.innerHTML=echoFeedHTML();wireEchoFeed(f);f.scrollTop=f.scrollHeight}
async function echoAsk(q){
  q=(q||"").trim();if(ECHOBUSY||!ECHO||!ECHO.turns)return;
  const att=(ECHO.att||[]).filter(a=>a.url);if(!q&&!att.length)return;
  if((ECHO.att||[]).some(a=>!a.url&&!a.failed))return toast("Still uploading…");
  if(ECHO.rec){try{ECHO.rec.stop()}catch(e){}}
  ECHO.att=[];ECHODRAFT="";ECHOBUSY=true;echoPaintFoot();
  const d=$("#echodraft");if(d){d.value="";fitDraft(d)}
  ECHO.turns.push(echoBrain()?{id:"p"+Date.now(),asked:q,files:att.map(a=>({url:a.url,kind:a.kind,name:a.name})),kind:"brain",pending:true,status:"Thinking",text:"",tools:[]}:{id:"p"+Date.now(),asked:q,kind:"pending",text:"",suggestions:[]});
  echoPaintFeed();const s=$("#echosend");if(s){if(echoBrain())s.disabled=true;else s.hidden=true}
  const drop=()=>{const i=ECHO.turns.findIndex(x=>x.pending||x.kind==="pending");if(i>=0)ECHO.turns.splice(i,1)};
  try{const r=echoBrain()?await req("/api/echo/ask",{method:"POST",body:{q,files:att.map(a=>({url:a.url,name:a.name}))}}):await eapi.ask(q);drop();ECHO.turns.push(r.turn);if(echoBrain()&&r.turn&&r.turn.text&&!r.turn.failed)echoSay(r.turn.text)}
  catch(e){drop();toast(e.message)}
  ECHOBUSY=false;const d2=$("#echodraft");if(d2){d2.disabled=false}
  echoPaintFeed();if(echoBrain())echoPaintFoot();
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
/* ---- photos and PDFs on a message: shrunk on the phone, kept on the volume, shown as thumbnails until sent ---- */
async function echoAttach(fileList){
  if(!ECHO)return;ECHO.att=ECHO.att||[];
  for(const file of [...fileList].slice(0,4-ECHO.att.length)){
    const pdf=file.type==="application/pdf"||/\.pdf$/i.test(file.name);
    if(!pdf&&!/^image\//.test(file.type)){toast("A photo or a PDF");continue}
    if(file.size>8*1024*1024&&pdf){toast("That PDF is over 8MB");continue}
    const a={kind:pdf?"pdf":"image",name:file.name,preview:"",url:""};ECHO.att.push(a);echoPaintFoot();
    try{
      const data=pdf?await new Promise((ok,no)=>{const fr=new FileReader();fr.onload=()=>ok(fr.result);fr.onerror=no;fr.readAsDataURL(file)}):await compressImage(file,1568,.85);
      if(!pdf)a.preview=data;echoPaintFoot();
      const up=await eapi.attach(data,file.name);a.url=up.url;a.kind=up.kind==="pdf"?"pdf":"image";
    }catch(e){a.failed=true;ECHO.att=ECHO.att.filter(x=>x!==a);toast(e.message||"Couldn\u2019t attach that")}
    echoPaintFoot();
  }
}
function echoPaintFoot(){const f=$("#echofoot");if(!f)return;const d=$("#echodraft");const sel=d?[d.selectionStart,d.selectionEnd]:null;f.innerHTML=echoComposerHTML();wireEchoFoot(f);const d2=$("#echodraft");if(d2&&sel&&document.activeElement!==d2&&ECHO.keepFocus){d2.focus();try{d2.setSelectionRange(sel[0],sel[1])}catch(e){}}}
/* ---- dictation: the phone's own speech recognition fills the box; nothing leaves the phone but the words you then send ---- */
function echoDictate(){
  const SR=window.SpeechRecognition||window.webkitSpeechRecognition;if(!SR||!ECHO)return;
  if(ECHO.rec){try{ECHO.rec.stop()}catch(e){}return}
  const rec=new SR();rec.lang=navigator.language||"en-US";rec.interimResults=true;rec.continuous=true;
  const base=ECHODRAFT?ECHODRAFT.replace(/\s+$/,"")+" ":"";let finals="";
  rec.onresult=e=>{let interim="";for(let i=e.resultIndex;i<e.results.length;i++){const r=e.results[i];if(r.isFinal)finals+=r[0].transcript+" ";else interim+=r[0].transcript}
    ECHODRAFT=(base+finals+interim).replace(/\s+/g," ").trimStart();const d=$("#echodraft");if(d){d.value=ECHODRAFT;fitDraft(d)}const s=$("#echosend");if(s)s.disabled=!ECHODRAFT.trim()||ECHOBUSY};
  rec.onerror=e=>{if(e.error==="not-allowed")toast("Allow the microphone in your phone\u2019s settings")};
  rec.onend=()=>{ECHO.rec=null;ECHO.listening=false;echoPaintFoot()};
  try{rec.start();ECHO.rec=rec;ECHO.listening=true;echoPaintFoot()}catch(e){toast("Can\u2019t listen right now")}
}
/* ---- answers read aloud, when the speaker is on: markdown stripped, the phone's own voice ---- */
function echoSay(text){
  if(!echoVoiceOn()||!("speechSynthesis" in window))return;
  const plain=String(text||"").replace(/\*\*|`|^#+\s*/gm,"").replace(/^\s*[-*•]\s+/gm,"").replace(/https?:\/\/\S+/g,"a link").trim();if(!plain)return;
  try{speechSynthesis.cancel();const u=new SpeechSynthesisUtterance(plain.slice(0,3000));u.lang=navigator.language||"en-US";u.rate=1.02;speechSynthesis.speak(u)}catch(e){}
}
function echoVoiceToggle(){
  const on=!echoVoiceOn();try{localStorage.setItem("tnl-echo-voice",on?"1":"0")}catch(e){}
  if(!on){try{speechSynthesis.cancel()}catch(e){}}
  const b=$("#echovoice");if(b){b.classList.toggle("on",on);b.innerHTML=on?DI.soundOn:DI.soundOff;b.setAttribute("aria-pressed",String(on));b.setAttribute("aria-label",on?"Stop reading answers aloud":"Read answers aloud")}
  toast(on?"Echo will read answers aloud":"Echo is quiet");
  if(on){const last=[...ECHO.turns].reverse().find(t=>t.kind==="brain"&&t.text&&!t.failed);if(last)echoSay(last.text)}
}
/* Pick which Claude answers: a sheet of the three, a line on each, the current one marked. The next message uses it. */
function echoPickModel(){
  if(!ECHO||!ECHO.models||ECHOBUSY)return;
  const ov=document.createElement("div");ov.className="ui-ov ui-alertov";
  ov.innerHTML=`<div class="ui-card ui-alert echo-models" role="dialog" aria-modal="true" aria-label="Pick the model">
      <div class="ui-atext"><div class="ui-title">Which Claude answers</div><div class="ui-body">Takes effect on your next message.</div></div>
      <div class="ui-btns">${ECHO.models.map(m=>`<button class="ui-btn echo-mrow ${m.id===ECHO.model?"on":""}" data-model="${esc(m.id)}"><b>${esc(m.name)}</b><span>${esc(m.line)}</span></button>`).join("")}<button class="ui-btn ui-cancel">Cancel</button></div></div>`;
  document.body.appendChild(ov);
  const done=()=>ov.remove();
  ov.querySelector(".ui-cancel").onclick=done;ov.onclick=e=>{if(e.target===ov)done()};
  ov.querySelectorAll("[data-model]").forEach(b=>b.onclick=async()=>{const id=b.dataset.model;done();if(id===ECHO.model)return;
    try{const r=await eapi.model(id);ECHO.model=r.model;const l=$("#echomodel");if(l)l.innerHTML=esc(echoModelName(r.model))+DI.chev;toast(r.name+" from your next message")}catch(e){toast(e.message)}});
}
async function echoFresh(){
  if(!ECHO||!ECHO.turns||ECHOBUSY)return;
  const ok=await uiConfirm("New conversation?","This one is put away. Echo keeps everything it wrote in Knowledge.",{okLabel:"New conversation"});
  if(!ok)return;
  try{speechSynthesis.cancel()}catch(e){}ECHO.att=[];
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
  on("echovoice",()=>echoVoiceToggle());
  const f=L.querySelector("#echofeed");if(f){wireEchoFeed(f);if(ECHO&&ECHO.stick){f.scrollTop=f.scrollHeight;ECHO.stick=false}}
  const foot=L.querySelector("#echofoot");if(foot)wireEchoFoot(foot);
}
/* the composer is repainted on its own (attachments, the mic), so it has its own wiring */
function wireEchoFoot(F){
  const on=(id,fn)=>{const el=F.querySelector("#"+id);if(el)el.onclick=fn};
  const d=F.querySelector("#echodraft");
  if(d){fitDraft(d);
    d.oninput=()=>{ECHODRAFT=d.value;fitDraft(d);const s=$("#echosend");if(s){if(echoBrain())s.disabled=(!d.value.trim()&&!(ECHO.att||[]).some(a=>a.url))||ECHOBUSY;else s.hidden=!d.value.trim()||ECHOBUSY}};
    d.onkeydown=e=>{if(e.key==="Enter"&&!e.shiftKey){e.preventDefault();echoAsk(d.value)}};
    d.onfocus=()=>{if(ECHO)ECHO.keepFocus=true};d.onblur=()=>{if(ECHO)ECHO.keepFocus=false}}
  on("echosend",()=>{const d2=$("#echodraft");echoAsk(d2?d2.value:ECHODRAFT)});
  on("echomodel",()=>echoPickModel());
  on("echomic",()=>echoDictate());
  const fi=F.querySelector("#echofile");
  on("echophoto",()=>{if(fi)fi.click()});
  if(fi)fi.onchange=()=>{const files=[...(fi.files||[])];fi.value="";if(files.length)echoAttach(files)};   // copy first: clearing the input empties its live list
  F.querySelectorAll("[data-echoattx]").forEach(b=>b.onclick=()=>{ECHO.att.splice(+b.dataset.echoattx,1);echoPaintFoot()});
}
function wireEchoFeed(f){
  f.querySelectorAll("[data-echoask]").forEach(b=>b.onclick=()=>echoAsk(b.dataset.echoask));
  f.querySelectorAll("[data-echopick]").forEach(b=>b.onclick=()=>echoPick(b.dataset.turn,b.dataset.echosrc,+b.dataset.echopick));
  f.querySelectorAll("[data-echoyes]").forEach(b=>b.onclick=()=>echoRate(b.dataset.echoyes,true));
  f.querySelectorAll("[data-echono]").forEach(b=>b.onclick=()=>echoRate(b.dataset.echono,false));
  f.querySelectorAll("[data-echoperson]").forEach(b=>b.onclick=()=>echoHandoff());
  f.querySelectorAll("[data-echogo]").forEach(b=>b.onclick=()=>echoGo(b.dataset.echogo));
  f.querySelectorAll("[data-echook]").forEach(b=>b.onclick=()=>echoDecide(+b.dataset.echook,true));
  f.querySelectorAll("[data-echono-card]").forEach(b=>b.onclick=()=>echoDecide(+b.dataset.echonoCard,false));
  f.querySelectorAll("[data-echocopy]").forEach(b=>b.onclick=()=>{const t=ECHO.turns.find(x=>String(x.id)===String(b.dataset.echocopy));if(!t)return;navigator.clipboard&&navigator.clipboard.writeText(t.text||"").then(()=>toast("Copied"),()=>toast("Couldn\u2019t copy"))});
}
