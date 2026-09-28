function wireGate(){
  const G=GFLOW;if(!G)return;const f=G.f;
  const on=(sel,fn)=>{const el=$(sel);if(el)el.onclick=fn};
  const nx=()=>$("#gxnext");
  const emailOk=()=>/^\S+@\S+\.\S+$/.test(f.email.trim());
  on("#gatex",()=>{gateClose();render()});
  on("#gxback",()=>{if(G.depth>0){history.back();return}gateBack();render()});
  on("#gxlogin",()=>{G.mode="login";G.err="";G.sent=false;G.resetUrl=null;GATE="login";G.src=GATE;render()});
  on("#sw",()=>{G.mode="register";G.step="email";G.err="";GATE="join";G.src=GATE;render()});
  on("#fp",()=>{G.mode="forgot";G.err="";G.sent=false;G.resetUrl=null;if(/@/.test(f.username))f.email=f.username;gxForward();render()});

  /* Typed values live in GFLOW, and Next lights up the moment the answer is valid. */
  const bind=(id,key,valid)=>{const el=$("#"+id);if(!el)return;
    el.oninput=()=>{f[key]=el.value;if(G.err){G.err="";const e=$(".gx-err");if(e)e.remove()}
      const b=nx();if(b&&valid)b.disabled=!valid()}};
  bind("u","username");bind("p","password");bind("fe","email");
  bind("em","email",emailOk);bind("pw","password",()=>f.password.length>=6);bind("dn","displayName",()=>!!f.displayName.trim());
  document.querySelectorAll("[data-showpw]").forEach(b=>b.onclick=()=>{G.showpw=!G.showpw;
    const i=$("#p")||$("#pw");if(i){i.type=G.showpw?"text":"password";b.textContent=G.showpw?"Hide":"Show";i.focus()}});
  document.querySelectorAll(".gxf-in").forEach(el=>el.onkeydown=e=>{
    if(e.key!=="Enter")return;e.preventDefault();const b=$("#go")||$("#fgo")||nx();if(b&&!b.disabled)b.click()});

  /* The first field of a new screen gets focus once — never on a background redraw. */
  const here=G.mode+":"+G.step;
  if(G.focused!==here){G.focused=here;const first=$(".gxf-in");if(first)setTimeout(()=>{try{first.focus()}catch(e){}},30)}

  /* ── log in ── */
  on("#go",async()=>{
    if(!f.username.trim()||!f.password){G.err="Enter your username or email and your password.";return render()}
    G.busy=true;G.err="";render();
    try{const d=await api.login({identifier:f.username.trim(),username:f.username.trim().toLowerCase(),password:f.password});
      TOKEN=d.token;localStorage.setItem("tnl-token",TOKEN);ME=d.user;gateClose();
      applyAccent(ME.accentHex);startStream();refreshBadges();loadUnreads();render()}
    catch(e){G.busy=false;G.err=e.message||"Couldn't log in. Try again.";render()}});

  /* ── forgot ── */
  on("#fgo",async()=>{
    if(!emailOk()){G.err="Enter the email on your account.";return render()}
    G.busy=true;G.err="";render();
    try{const d=await api.forgot(f.email.trim());G.busy=false;
      if(d.resetUrl)G.resetUrl=d.resetUrl;else G.sent=true;render()}
    catch(e){G.busy=false;G.err=e.message;render()}});

  /* ── username: lowercase as you type, checked live ── */
  const un=$("#un");
  if(un){un.oninput=()=>{const v=un.value.toLowerCase().replace(/\s+/g,"");if(v!==un.value)un.value=v;f.username=v;gxCheck()};
    if(f.username&&!G.un.state)gxCheck()}
  document.querySelectorAll("[data-sugg]").forEach(b=>b.onclick=()=>{f.username=b.dataset.sugg;if(un)un.value=f.username;gxCheck()});

  /* ── roles: toggled in place so the long list keeps its scroll ── */
  document.querySelectorAll("[data-r]").forEach(b=>b.onclick=()=>{const r=b.dataset.r;
    if(f.roles.includes(r))f.roles=f.roles.filter(x=>x!==r);
    else if(f.roles.length<5)f.roles=[...f.roles,r];
    else{toast("Up to 5");return}
    b.classList.toggle("on",f.roles.includes(r));
    const c=$("#rcount");if(c)c.textContent=f.roles.length+" of 5 selected";
    const n=nx();if(n)n.disabled=!f.roles.length});

  /* ── Next, per screen ── */
  on("#gxnext",async()=>{G.err="";
    if(G.step==="email"){if(!emailOk()){G.err="Enter a valid email address.";return render()}
      f.email=f.email.trim();G.step="password";gxForward();return render()}
    if(G.step==="password"){if(f.password.length<6){G.err="Use at least 6 characters.";return render()}
      G.step="name";gxForward();return render()}
    if(G.step==="name"){if(!f.displayName.trim()){G.err="Add your name.";return render()}
      f.displayName=f.displayName.trim();
      if(!f.username){f.username=gxSlug(f.displayName);G.un={state:"",msg:"",sugg:[]}}
      G.step="username";gxForward();render();return gxCheck()}
    if(G.step==="username"){if(G.un.state!=="ok"){G.err=G.un.msg||"Pick an available username.";return render()}
      G.step="roles";gxForward();return render()}
    if(G.step==="roles"){if(!f.roles.length){G.err="Pick at least one.";return render()}
      return gxCreate()}
    if(G.step==="photo"){if(!(ME&&ME.avatarUrl)){const fi=$("#gxfile");if(fi)fi.click();return}
      return gxAfterPhoto()}
    if(G.step==="follow"){G.step="welcome";return render()}
  });
  on("#gxchange",()=>{const fi=$("#gxfile");if(fi)fi.click()});
  const fi=$("#gxfile");
  if(fi)fi.onchange=async()=>{const file=fi.files[0];if(!file)return;
    G.busy=true;G.err="";render();
    try{const data=await compressImage(file,500,.85);const d=await api.avatar(data);
      ME.avatarUrl=d.avatarUrl||d.url||ME.avatarUrl}
    catch(e){G.err=e.message||"That photo didn't upload. Try another."}
    G.busy=false;render()};
  on("#gxskip",()=>{if(G.step==="photo")return gxAfterPhoto();G.step="welcome";render()});
  document.querySelectorAll("[data-fol]").forEach(b=>b.onclick=async()=>{const u=b.dataset.fol;
    const was=!!G.following[u];G.following[u]=!was;b.classList.toggle("on",!was);b.textContent=!was?"Following":"Follow";
    try{const d=await api.follow(u);G.following[u]=!!d.following}
    catch(e){G.following[u]=was;toast(e.message)}
    b.classList.toggle("on",!!G.following[u]);b.textContent=G.following[u]?"Following":"Follow"});
  on("#gxdone",()=>{gateClose();TAB="showroom";render();setTimeout(maybeOfferInstall,600)});
}

/* Debounced availability check; paints only the username bits so the field keeps focus. */
function gxCheck(){
  const G=GFLOW;if(!G)return;const u=G.f.username;
  const paint=()=>{if(GFLOW!==G)return;
    const st=$("#unst"),msg=$("#unmsg"),sg=$("#unsugg"),url=$("#unurl"),b=$("#gxnext");
    if(url)url.textContent=u||"username";
    if(st){st.className="gxf-st "+G.un.state;st.innerHTML=gxUnStatus(G)}
    if(msg){msg.textContent=G.un.msg||"";msg.className="gx-hint"+(G.un.state==="ok"?"":" bad")}
    if(sg){sg.innerHTML=(G.un.sugg||[]).map(s=>`<button class="chip" data-sugg="${esc(s)}">${esc(s)}</button>`).join("");
      sg.querySelectorAll("[data-sugg]").forEach(x=>x.onclick=()=>{G.f.username=x.dataset.sugg;const i=$("#un");if(i)i.value=G.f.username;gxCheck()})}
    if(b)b.disabled=G.un.state!=="ok"};
  clearTimeout(GXT);
  if(!u){G.un={state:"",msg:"",sugg:[]};return paint()}
  if(!/^[a-z0-9._]{2,20}$/.test(u)){G.un={state:"bad",msg:"2–20 characters: lowercase letters, numbers, . and _",sugg:[]};return paint()}
  G.un={state:"wait",msg:"",sugg:[]};paint();
  GXT=setTimeout(async()=>{
    try{const d=await api.usernameCheck(u);if(GFLOW!==G||G.f.username!==u)return;
      G.un=d.available?{state:"ok",msg:"",sugg:[]}:{state:"taken",msg:"That username isn't available.",sugg:d.suggestions||[]}}
    catch(e){if(GFLOW!==G||G.f.username!==u)return;G.un={state:"ok",msg:"",sugg:[]}} // the server has the final say on create
    paint()},350);
}

async function gxCreate(){
  const G=GFLOW,f=G.f;G.busy=true;G.err="";render();
  try{const d=await api.register({displayName:f.displayName,username:f.username,email:f.email,password:f.password,roles:f.roles});
    TOKEN=d.token;localStorage.setItem("tnl-token",TOKEN);ME=d.user;if(d.verifyUrl)VERIFYURL=d.verifyUrl;
    G.made={mailSent:!!d.mailSent};G.busy=false;G.step="photo";
    try{applyAccent(ME.accentHex)}catch(e){}
    G.peopleP=api.builders().then(b=>{G.people=((b&&b.builders)||[]).filter(x=>x.username!==ME.username).slice(0,8)})
      .catch(()=>{G.people=[]});
    startStream();refreshBadges();render();
  }catch(e){
    G.busy=false;const m=String(e.message||"");
    if(GFLOW!==G){try{toast("Something broke — reload the page")}catch(x){}throw e}
    if(/username/i.test(m)){G.step="username";G.un={state:"taken",msg:"That username was just taken.",sugg:[]};render();return gxCheck()}
    if(/email/i.test(m)){G.step="email";G.err=/already/i.test(m)?"There's already an account with this email. Log in instead.":"Enter a valid email address."}
    else if(/password/i.test(m)){G.step="password";G.err="Use at least 6 characters."}
    else if(/name/i.test(m)){G.step="name";G.err="Add your name."}
    else G.err=m||"Something went wrong. Try again.";
    render();
  }
}
async function gxAfterPhoto(){
  const G=GFLOW;if(!G)return;
  if(G.people===null&&G.peopleP){try{await G.peopleP}catch(e){}}
  G.step=(G.people&&G.people.length)?"follow":"welcome";render();
}
