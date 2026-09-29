/* ── SIGN UP · LOG IN · v2 · 2026-09-28 ──────────────────────────────
   Instagram-shaped: one question per screen, Next under the field, a live
   username check, then photo → people → welcome once the account exists.
   State lives in GFLOW, not in the DOM, so a background render() (SSE,
   badges) redraws the same step with what was typed instead of resetting. */
let GFLOW=null, GXT=null;
const GX_MARK="data:image/png;base64,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";
const GX_STEPS=["email","password","name","username","roles"];
const GX_X=`<svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="square" stroke-linejoin="miter" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg>`;
const GX_BACK=`<svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="square" stroke-linejoin="miter" aria-hidden="true"><path d="M15 5l-7 7 7 7"/></svg>`;
const GX_OK=`<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2.25" stroke-linecap="square" stroke-linejoin="miter" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>`;
const GX_NO=`<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2.25" stroke-linecap="square" stroke-linejoin="miter" aria-hidden="true"><path d="M7 7l10 10M17 7L7 17"/></svg>`;
const GX_PERSON=`<svg viewBox="0 0 24 24" width="56" height="56" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="square" stroke-linejoin="miter" aria-hidden="true"><circle cx="12" cy="8.5" r="3.5"/><path d="M5 20c.8-3.6 3.6-5.5 7-5.5s6.2 1.9 7 5.5"/></svg>`;

function gxNew(){return {src:GATE,mode:GATE==="login"?"login":"register",step:"email",
  f:{displayName:"",username:"",email:"",password:"",roles:[]},
  err:"",un:{state:"",msg:"",sugg:[]},made:null,people:null,peopleP:null,following:{},
  sent:false,resetUrl:null,busy:false,showpw:false,focused:"",depth:0}}
/* Back inside the flow. true = handled here; false = close the gate. */
function gateBack(){const G=GFLOW;if(!G)return false;
  const done=()=>{G.err="";if(G.depth>0)G.depth--;return true};
  if(G.mode==="forgot"){G.mode="login";G.sent=false;G.resetUrl=null;return done()}
  if(G.mode==="register"&&!G.made){const i=GX_STEPS.indexOf(G.step);if(i>0){G.step=GX_STEPS[i-1];return done()}}
  return false}
/* Each forward move is a history entry, so the phone's back swipe walks the
   flow backwards the way it does on Instagram. */
function gxForward(){const G=GFLOW;if(!G||POPPING)return;
  try{history.pushState({kind:"gate",tab:TAB},"",location.pathname);G.depth++}catch(e){}}
function gateClose(){GATE=null;GATEWHY="";GFLOW=null}
function gxSlug(n){let s=String(n||"").toLowerCase().normalize("NFKD").replace(/[̀-ͯ]/g,"")
  .replace(/\s+/g,".").replace(/[^a-z0-9._]/g,"").replace(/[._]{2,}/g,".").replace(/^[._]+|[._]+$/g,"").slice(0,20);
  return s.length>=2?s:(s+"lab").slice(0,20)}
function gxField(id,label,o={}){
  return `<label class="gxf"><input class="gxf-in" id="${id}" type="${o.type||"text"}" value="${esc(o.value||"")}" placeholder=" " ${o.attrs||""}><span class="gxf-lb">${esc(label)}</span>${o.after||""}</label>`}
function gxUnStatus(G){const s=G.un.state;
  return s==="ok"?GX_OK:(s==="taken"||s==="bad")?GX_NO:s==="wait"?`<i class="gx-spin"></i>`:""}

function gateHTML(){
  if(!GFLOW||GFLOW.src!==GATE){GFLOW=gxNew();pushView("gate","open")}
  const G=GFLOW,f=G.f;
  const err=G.err?`<div class="gx-err" role="alert">${esc(G.err)}</div>`:"";
  const why=GATEWHY?`<p class="gx-why">${esc(GATEWHY)}</p>`:"";
  const pw=(id,ac)=>gxField(id,"Password",{type:G.showpw?"text":"password",value:f.password,attrs:`autocomplete="${ac}"`,
    after:`<button type="button" class="gxf-show" data-showpw>${G.showpw?"Hide":"Show"}</button>`});
  let top="",body="",foot="",center=false;

  if(G.mode==="login"){
    center=true;
    top=`<span></span><button class="gx-ic" id="gatex" aria-label="Close">${GX_X}</button>`;
    body=`<div class="gx-brand"><img class="mark gx-mark" src="${GX_MARK}" alt="TNL"><div class="gx-word"><span class="lg">//</span> LABS</div></div>
      ${why}
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
    const i=GX_STEPS.indexOf(G.step);
    top=`<button class="gx-ic" id="${i>0?"gxback":"gatex"}" aria-label="${i>0?"Back":"Close"}">${i>0?GX_BACK:GX_X}</button>
      <div class="gx-prog" aria-label="Step ${i+1} of ${GX_STEPS.length}">${GX_STEPS.map((_,k)=>`<i class="${k<=i?"on":""}"></i>`).join("")}</div>
      <span class="gx-sp"></span>`;
    const next=(label,ok)=>`<button class="gx-btn" id="gxnext"${ok&&!G.busy?"":" disabled"}>${G.busy?"One moment…":label}</button>`;
    if(G.step==="email"){
      body=`${why}<h1 class="gx-h">What's your email?</h1><p class="gx-p">You'll use it to log in and to reset your password.</p>
        ${gxField("em","Email",{type:"email",value:f.email,attrs:'autocomplete="email" autocapitalize="none" inputmode="email"'})}
        ${err}${next("Next",/^\S+@\S+\.\S+$/.test(f.email.trim()))}`;
      foot=`<button class="gx-link" id="gxlogin">I already have an account</button>`;
    }else if(G.step==="password"){
      body=`<h1 class="gx-h">Create a password</h1><p class="gx-p">At least 6 characters. Pick one you don't use anywhere else.</p>
        ${pw("pw","new-password")}${err}${next("Next",f.password.length>=6)}`;
    }else if(G.step==="name"){
      body=`<h1 class="gx-h">What's your name?</h1><p class="gx-p">This is how you'll show up. You can change it any time.</p>
        ${gxField("dn","Name",{value:f.displayName,attrs:'autocomplete="name" maxlength="28"'})}${err}${next("Next",!!f.displayName.trim())}`;
    }else if(G.step==="username"){
      body=`<h1 class="gx-h">Create a username</h1><p class="gx-p">Your page will be labs.tnllabs.com/u/<b id="unurl">${esc(f.username||"username")}</b></p>
        ${gxField("un","Username",{value:f.username,attrs:'autocomplete="username" autocapitalize="none" autocorrect="off" spellcheck="false" maxlength="20"',
          after:`<span class="gxf-st ${G.un.state}" id="unst">${gxUnStatus(G)}</span>`})}
        <div class="gx-hint ${G.un.state==="ok"?"":"bad"}" id="unmsg">${esc(G.un.msg||"")}</div>
        <div class="gx-sugg" id="unsugg">${(G.un.sugg||[]).map(s=>`<button class="chip" data-sugg="${esc(s)}">${esc(s)}</button>`).join("")}</div>
        ${err}${next("Next",G.un.state==="ok")}`;
    }else{
      body=`<h1 class="gx-h">What do you make?</h1><p class="gx-p">Pick up to 5. It's how collaborators find you.</p>
        <div class="gx-roles">${ROLES.map(r=>`<button class="chip ${f.roles.includes(r)?"on":""}" data-r="${esc(r)}">${esc(r)}</button>`).join("")}</div>
        <div class="gx-count" id="rcount">${f.roles.length} of 5 selected</div>
        ${err}<div class="gx-stick">${next("Create account",f.roles.length>0)}</div>`;
    }
  }else{
    const skip=G.step!=="welcome"?`<button class="gx-skip" id="gxskip">Skip</button>`:"<span></span>";
    top=`<span></span>${skip}`;
    const av=(cls)=>`<div class="gx-av ${cls||""}">${ME&&ME.avatarUrl?`<img src="${esc(ME.avatarUrl)}" alt="">`:GX_PERSON}</div>`;
    if(G.step==="photo"){
      const has=!!(ME&&ME.avatarUrl);
      body=`<div class="gx-mid">${av()}<h1 class="gx-h">Add a profile photo</h1>
        <p class="gx-p">So people know whose work they're looking at.</p></div>
        <input type="file" id="gxfile" accept="image/*" hidden>
        ${err}<button class="gx-btn" id="gxnext"${G.busy?" disabled":""}>${G.busy?"Uploading…":has?"Next":"Add a photo"}</button>
        ${has?`<button class="gx-link" id="gxchange">Change photo</button>`:""}`;
    }else if(G.step==="follow"){
      const ppl=G.people||[];
      body=`<h1 class="gx-h">People to follow</h1><p class="gx-p">Some of the people building here right now.</p>
        <div class="gx-people">${G.people===null?`<div class="gx-hint">Loading…</div>`:ppl.map(p=>`<div class="gx-person">
          ${avHTML({displayName:p.display_name,avatarUrl:p.avatar_url},"")}
          <div class="gx-person-b"><b>${esc(p.display_name)}</b><span>@${esc(p.username)}${p.role?" · "+esc(p.role):""}</span></div>
          <button class="gx-fbtn ${G.following[p.username]?"on":""}" data-fol="${esc(p.username)}">${G.following[p.username]?"Following":"Follow"}</button>
        </div>`).join("")}</div>
        <div class="gx-stick"><button class="gx-btn" id="gxnext">Next</button></div>`;
    }else{
      const first=(ME&&ME.displayName||"").split(" ")[0];
      center=true;
      body=`<div class="gx-mid">${av("sm")}<h1 class="gx-h">Welcome to TNL LABS${first?", "+esc(first):""}.</h1>
        <p class="gx-p">${G.made.mailSent?`We sent a link to <b>${esc(f.email)}</b> to confirm your email.`:"Your account is ready."}</p></div>
        <button class="gx-btn" id="gxdone">Start exploring</button>`;
    }
  }
  return `<div class="gate"><div class="gx">
    <header class="gx-top">${top}</header>
    <main class="gx-body${center?" center":""}">${body}</main>
    ${foot?`<footer class="gx-foot">${foot}</footer>`:""}
  </div></div>`;
}

