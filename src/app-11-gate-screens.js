/* ── SIGN UP · LOG IN · v2.1 · 2026-10-09 (a line inside Instagram) ──────────────────────────────
   Instagram-shaped: one question per screen, Next under the field, a live
   username check, then photo → people → welcome once the account exists.
   State lives in GFLOW, not in the DOM, so a background render() (SSE,
   badges) redraws the same step with what was typed instead of resetting. */
let GFLOW=null, GXT=null;
const GX_MARK="data:image/svg+xml,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20viewBox%3D%220%200%2096%2096%22%3E%3Cpath%20d%3D%22M39.5%2014h10.8L37.4%2082H26.6zM58.6%2014h10.8L56.5%2082H45.7z%22%20fill%3D%22white%22%2F%3E%3C%2Fsvg%3E";
const GX_STEPS=["email","password","name","username","roles"];
const GX_X=`<svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="square" stroke-linejoin="miter" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg>`;
const GX_BACK=`<svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="square" stroke-linejoin="miter" aria-hidden="true"><path d="M15 5l-7 7 7 7"/></svg>`;
const GX_OK=`<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2.25" stroke-linecap="square" stroke-linejoin="miter" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>`;
const GX_NO=`<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2.25" stroke-linecap="square" stroke-linejoin="miter" aria-hidden="true"><path d="M7 7l10 10M17 7L7 17"/></svg>`;
const GX_PERSON=`<svg viewBox="0 0 24 24" width="56" height="56" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="square" stroke-linejoin="miter" aria-hidden="true"><circle cx="12" cy="8.5" r="3.5"/><path d="M5 20c.8-3.6 3.6-5.5 7-5.5s6.2 1.9 7 5.5"/></svg>`;

function gxNew(){const tour=GATE==="tour";   // ≡ → How LABS works: the walkthrough on its own (app-11-gate-tour)
  return {src:GATE,t0:Date.now(),mode:tour?"tour":GATE==="login"?"login":"register",step:tour?"tour":"email",ti:0,
  f:{displayName:"",username:"",email:"",password:"",roles:[],bio:"",ig:""},
  err:"",un:{state:"",msg:"",sugg:[]},made:null,people:null,peopleP:null,following:{},
  sent:false,resetUrl:null,busy:false,showpw:false,focused:"",depth:0}}
/* Back inside the flow. true = handled here; false = close the gate. */
function gateBack(){const G=GFLOW;if(!G)return false;
  const done=()=>{G.err="";if(G.depth>0)G.depth--;return true};
  if(G.mode==="forgot"){G.mode="login";G.sent=false;G.resetUrl=null;return done()}
  if(G.mode==="register"&&!G.made){const S=gxSteps(G),i=S.indexOf(G.step);if(i>0){G.step=S.at(i-1);return done()}}
  return false}
/* Each forward move is a history entry, so the phone's back swipe walks the
   flow backwards the way it does on Instagram. */
function gxForward(){const G=GFLOW;if(!G||POPPING)return;
  try{history.pushState({kind:"gate",tab:TAB},"",location.pathname);G.depth++}catch(e){}}
function gateClose(){GATE=null;GATEWHY="";GFLOW=null}
function gxSlug(n){let s=String(n||"").toLowerCase().normalize("NFKD").replace(/[̀-ͯ]/g,"")
  .replace(/\s+/g,".").replace(/[^a-z0-9._]/g,"").replace(/[._]{2,}/g,".").replace(/^[._]+|[._]+$/g,"").slice(0,20);
  return s.length>=2?s:(s+"lab").slice(0,20)}
/* A new password, live (2026-10-19, "passwords should be more complicated"); the server has the
   final say with the same rules (server-01-passwords.js). */
const PW_EASY=["password","password1","password12","password123","passw0rd","12345678","123456789","1234567890","qwerty123","qwertyuiop",
  "1q2w3e4r","1qaz2wsx","abc12345","abcd1234","iloveyou1","letmein1","welcome1","admin123","football1","baseball1","monkey123","dragon123",
  "sunshine1","princess1","trustno1","11111111","00000000","asdf1234","zaq12wsx","tnllabs1","tnllabs123","labs1234"];
function pwRules(p,f){const low=p.toLowerCase(),nm=String(f.email||"").split("@")[0].toLowerCase(),un=String(f.username||"").toLowerCase();
  return [{t:"8 or more characters",ok:p.length>=8},{t:"A letter and a number",ok:/[a-z]/i.test(p)&&/[0-9]/.test(p)},
    {t:"Not easy to guess",ok:p.length>=8&&!PW_EASY.includes(low)&&!(nm.length>=4&&low.includes(nm))&&!(un&&low.includes(un))}]}
const pwOk=f=>pwRules(f.password,f).every(r=>r.ok);
const pwRulesHTML=f=>pwRules(f.password,f).map(r=>`<li class="${r.ok?"ok":""}">${r.ok?GX_OK:"<i></i>"}${esc(r.t)}</li>`).join("");
function gxField(id,label,o={}){
  return `<label class="gxf"><input class="gxf-in" id="${id}" type="${o.type||"text"}" value="${esc(o.value||"")}" placeholder=" " ${o.attrs||""}><span class="gxf-lb">${esc(label)}</span>${o.after||""}</label>`}
function gxUnStatus(G){const s=G.un.state;
  return s==="ok"?GX_OK:(s==="taken"||s==="bad")?GX_NO:s==="wait"?`<i class="gx-spin"></i>`:""}

function gateHTML(){
  if(!GFLOW||GFLOW.src!==GATE){GFLOW=gxNew();pushView("gate","open")}
  const G=GFLOW,f=G.f;
  if(G.step==="tour")return tourHTML(G);
  const err=G.err?`<div class="gx-err" role="alert">${esc(G.err)}</div>`:"";
  const why=GATEWHY?`<p class="gx-why">${esc(GATEWHY)}</p>`:"";
  const pw=(id,ac)=>gxField(id,"Password",{type:G.showpw?"text":"password",value:f.password,attrs:`autocomplete="${ac}"`,
    after:`<button type="button" class="gxf-show" data-showpw>${G.showpw?"Hide":"Show"}</button>`});
  let top="",body="",foot="",center=false;

  if(G.mode==="login"){
    center=true;
    top=`<span></span><button class="gx-ic" id="gatex" aria-label="Close">${GX_X}</button>`;
    body=`<div class="gx-brand"><div class="gx-word"><span class="lg">//</span> LABS</div></div>
      ${why}${inappGateHTML()}${oauthHTML("login")}
      ${gxField("u","Username or email",{value:f.username,attrs:'autocomplete="username" autocapitalize="none" autocorrect="off" spellcheck="false"'})}
      ${pw("p","current-password")}
      ${err}
      <button class="gx-btn" id="go"${G.busy?" disabled":""}>${G.busy?"Logging in…":"Log in"}</button>
      <button class="gx-link" id="fp">Forgot password?</button>`;
    foot=`<button class="gx-btn ghost" id="sw">Create new account</button>`;
  }else if(G.mode==="forgot"){
    top=`<button class="gx-ic" id="gxback" aria-label="Back">${GX_BACK}</button><span></span>`;
    body=G.sent?`<h1 class="gx-h">Check your email</h1><p class="gx-p">If <b>${esc(f.email)}</b> has an account, a link to reset your password is on the way. It works for one hour.</p>`
      :G.resetUrl?`<h1 class="gx-h">Email isn't set up yet</h1><p class="gx-p">Here's your reset link instead.</p><a class="gx-btn" href="${esc(G.resetUrl)}">Set a new password</a>`
      :`<h1 class="gx-h">Trouble logging in?</h1><p class="gx-p">Enter your email and we'll send you a link to get back into your account.</p>
        ${gxField("fe","Email",{type:"email",value:f.email,attrs:'autocomplete="email" autocapitalize="none" inputmode="email"'})}
        ${err}<button class="gx-btn" id="fgo"${G.busy?" disabled":""}>${G.busy?"Sending…":"Send link"}</button>`;
    foot=`<button class="gx-link" id="gxlogin">Back to log in</button>`;
  }else if(!G.made){
    const S=gxSteps(G),i=S.indexOf(G.step);   // with Google / Apple / Facebook: no email or password steps (app-11-gate-oauth)
    top=`<button class="gx-ic" id="${i>0?"gxback":"gatex"}" aria-label="${i>0?"Back":"Close"}">${i>0?GX_BACK:GX_X}</button>
      <div class="gx-prog" aria-label="Step ${i+1} of ${S.length}">${S.map((_,k)=>`<i class="${k<=i?"on":""}"></i>`).join("")}</div>
      <span class="gx-sp"></span>`;
    const next=(label,ok)=>`<button class="gx-btn" id="gxnext"${ok&&!G.busy?"":" disabled"}>${G.busy?"One moment…":label}</button>`;
    const mk=`<img class="mark gx-mk" src="${GX_MARK}" alt="">`;   // the mark atop every Join step (2026-10-20, Google's shape)
    center=G.step!=="roles";
    if(G.step==="email"){
      const oa=oauthHTML("join");   // with Google / Apple / Facebook on, the first screen reads like theirs: who you're joining, then the choices
      body=`${mk}<h1 class="gx-h">${oa?"Create your account":"What's your email?"}</h1><p class="gx-p">${oa?"Join the people making things on LABS.":"You'll use it to log in and to reset your password."}</p>${why}${inappGateHTML()}${oa}
        ${gxField("em","Email",{type:"email",value:f.email,attrs:'autocomplete="email" autocapitalize="none" inputmode="email"'})}
        ${err}${next("Next",/^\S+@\S+\.\S+$/.test(f.email.trim()))}`;
      foot=`<button class="gx-link" id="gxlogin">I already have an account</button>`;
    }else if(G.step==="password"){
      body=`${mk}<h1 class="gx-h">Create a password</h1><p class="gx-p">Pick one you don't use anywhere else.</p>
        ${pw("pw","new-password")}<ul class="gx-pwr" id="pwr">${pwRulesHTML(f)}</ul>${err}${next("Next",pwOk(f))}`;
    }else if(G.step==="name"){
      body=`${mk}<h1 class="gx-h">What's your name?</h1><p class="gx-p">This is how you'll show up. You can change it any time.</p>
        ${gxField("dn","Name",{value:f.displayName,attrs:'autocomplete="name" maxlength="28"'})}${err}${next("Next",!!f.displayName.trim())}`;
    }else if(G.step==="username"){
      body=`${mk}<h1 class="gx-h">Create a username</h1><p class="gx-p">Your page will be ${location.host}/u/<b id="unurl">${esc(f.username||"username")}</b></p>
        ${gxField("un","Username",{value:f.username,attrs:'autocomplete="username" autocapitalize="none" autocorrect="off" spellcheck="false" maxlength="20"',
          after:`<span class="gxf-st ${G.un.state}" id="unst">${gxUnStatus(G)}</span>`})}
        <div class="gx-hint ${G.un.state==="ok"?"":"bad"}" id="unmsg">${esc(G.un.msg||"")}</div>
        <div class="gx-sugg" id="unsugg">${(G.un.sugg||[]).map(s=>`<button class="chip" data-sugg="${esc(s)}">${esc(s)}</button>`).join("")}</div>
        ${err}${next("Next",G.un.state==="ok")}`;
    }else{
      body=`<h1 class="gx-h">What do you make?</h1><p class="gx-p">Pick up to 5. It's how people find you.</p>
        <div class="gx-roles">${ROLES.map(r=>`<button class="chip ${f.roles.includes(r)?"on":""}" data-r="${esc(r)}">${esc(r)}</button>`).join("")}</div>
        <div class="gx-count" id="rcount">${f.roles.length} of 5 selected</div>
        ${err}<div class="gx-stick"><p class="gx-legal">By creating an account you agree to the <a href="/terms" target="_blank" rel="noopener">Terms</a> and <a href="/privacy" target="_blank" rel="noopener">Privacy policy</a>.</p>${next("Create account",f.roles.length>0)}</div>`;
    }
  }else{
    const skip=G.step!=="welcome"?`<button class="gx-skip" id="gxskip">Skip</button>`:"<span></span>";
    center=G.step!=="follow";
    top=`<span></span>${skip}`;
    const av=(cls)=>`<div class="gx-av ${cls||""}">${ME&&ME.avatarUrl?`<img src="${esc(ME.avatarUrl)}" alt="">`:GX_PERSON}</div>`;
    if(G.step==="verify"){   // 2026-10-19: "accounts should be prompted to verify their email"
      body=`<div class="gx-mid"><div class="gx-av gx-mail">${DI.mail}</div><h1 class="gx-h">Confirm your email</h1>
        <p class="gx-p">We sent a link to <b>${esc(f.email)}</b>. Tap it, then come back here.</p></div>
        ${err}${G.note?`<div class="gx-hint">${esc(G.note)}</div>`:""}
        <div class="gx-stick"><button class="gx-btn" id="gxnext">I've confirmed it</button><button class="gx-link" id="gxresend">Resend the email</button></div>`;
    }else if(G.step==="photo"){
      const has=!!(ME&&ME.avatarUrl);
      body=`<div class="gx-mid">${av()}<h1 class="gx-h">Add a profile photo</h1>
        <p class="gx-p">So people know whose work they're looking at.</p></div>
        <input type="file" id="gxfile" accept="image/*" hidden>
        ${err}<button class="gx-btn" id="gxnext"${G.busy?" disabled":""}>${G.busy?"Uploading…":has?"Next":"Add a photo"}</button>
        ${has?`<button class="gx-link" id="gxchange">Change photo</button>`:""}`;
    }else if(G.step==="colour"){   // 2026-10-18 onboarding: your colour, then a line about you
      const cur=(ME&&ME.accent)||"lab",hex=(ACCENTS[cur]||{}).hex||"";
      body=`<div class="gx-mid"><div class="gx-tint" style="--ring:${esc(accFill(hex))}">${av()}</div><h1 class="gx-h">Pick your colour</h1>
        <p class="gx-p">Your profile, your page and your share card wear it. You can change it any time.</p></div>
        <div class="gx-sw">${Object.entries(ACCENTS).filter(([k,a])=>!a.legacy||cur===k).map(([k,a])=>`<button class="pe-dot ${cur===k?"on":""}" data-gxacc="${esc(k)}" title="${esc(a.name)}" aria-label="${esc(a.name)}"><span style="background:${esc(a.hex)}"></span></button>`).join("")}</div>
        ${err}<div class="gx-stick"><button class="gx-btn" id="gxnext">Next</button></div>`;
    }else if(G.step==="bio"){
      body=`<h1 class="gx-h">Tell people what you make</h1><p class="gx-p">A line or two. It sits under your name on your page.</p>
        <textarea class="gxf-ta" id="gxbio" maxlength="150" rows="3" placeholder="Illustrator. Posters, zines and album art.">${esc(f.bio)}</textarea>
        <div class="gx-count" id="biocount">${f.bio.length} / 150</div>
        ${gxField("gxig","Instagram username (optional)",{value:f.ig,attrs:'autocapitalize="none" autocorrect="off" spellcheck="false" maxlength="31"'})}
        ${err}<div class="gx-stick"><button class="gx-btn" id="gxnext"${G.busy?" disabled":""}>${G.busy?"Saving…":"Next"}</button></div>`;
    }else if(G.step==="follow"){
      const ppl=G.people||[];
      body=`<h1 class="gx-h">People to follow</h1><p class="gx-p">Some of the people making things here right now.</p>
        <div class="gx-people">${G.people===null?`<div class="gx-hint">Loading…</div>`:ppl.map(p=>`<div class="gx-person">
          ${avHTML({displayName:p.display_name,avatarUrl:p.avatar_url},"")}
          <div class="gx-person-b"><b>${esc(p.display_name)}</b><span>@${esc(p.username)}${p.role?" · "+esc(p.role):""}</span></div>
          <button class="gx-fbtn ${G.following[p.username]?"on":""}" data-fol="${esc(p.username)}">${G.following[p.username]?"Following":"Follow"}</button>
        </div>`).join("")}</div>
        <div class="gx-stick"><button class="gx-btn" id="gxnext">Next</button></div>`;
    }else{
      const first=(ME&&ME.displayName||"").split(" ")[0];
      center=true;
      body=`<div class="gx-mid">${av("sm")}<h1 class="gx-h">Welcome to LABS${first?", "+esc(first):""}.</h1>
        <p class="gx-p">${G.made.mailSent?`We sent a link to <b>${esc(f.email)}</b> to confirm your email.`:"Your account is ready."}</p></div>
        <button class="gx-btn" id="gxdone">Start exploring</button>`;
    }
  }
  return `<div class="gate"><div class="gx">
    <header class="gx-top">${top}</header>
    <main class="gx-body${center?" center":" long"}">${body}</main>
    ${foot?`<footer class="gx-foot">${foot}</footer>`:""}
  </div></div>`;
}

