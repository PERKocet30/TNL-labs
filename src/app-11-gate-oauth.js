/* Continue with Google, Apple or Facebook (v1.1, 2026-10-26) — the whole flow is described in server-11-oauth.js.
   ?signin= → signed in · ?signup= → Join on your name · ?oauth_error= → a line. Each start carries this
   browser's own mark (?b=), so a code in someone else's link is refused. Google refuses Instagram's
   browser, so there its button opens Safari first (?oauth=google). */
const OA_G=`<svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true"><path fill="#4285F4" d="M22.6 12.2c0-.8-.1-1.4-.2-2H12v3.9h6c-.1 1-.8 2.5-2.3 3.5v2.9h3.7c2.2-2 3.2-5 3.2-8.3z"/><path fill="#34A853" d="M12 23c3 0 5.6-1 7.4-2.7l-3.7-2.9c-1 .7-2.3 1.2-3.7 1.2-2.9 0-5.3-1.9-6.2-4.5H2v3C3.8 20.7 7.6 23 12 23z"/><path fill="#FBBC05" d="M5.8 14.1c-.2-.7-.4-1.4-.4-2.1s.1-1.4.4-2.1v-3H2C1.2 8.5.8 10.2.8 12s.4 3.5 1.2 5l3.8-2.9z"/><path fill="#EA4335" d="M12 5.4c1.6 0 3.1.6 4.2 1.7l3.2-3.2C17.6 2.1 15 1 12 1 7.6 1 3.8 3.3 2 7l3.8 2.9C6.7 7.3 9.1 5.4 12 5.4z"/></svg>`;
const OA_A=`<svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor" aria-hidden="true"><path d="M16.4 12.7c0-2.6 2.1-3.8 2.2-3.9-1.2-1.8-3.1-2-3.7-2-1.6-.2-3.1.9-3.9.9-.8 0-2.1-.9-3.4-.9-1.7 0-3.3 1-4.2 2.6-1.8 3.1-.5 7.7 1.3 10.2.9 1.2 1.9 2.6 3.2 2.6 1.3-.1 1.8-.8 3.3-.8 1.6 0 2 .8 3.4.8 1.4 0 2.3-1.3 3.1-2.5 1-1.4 1.4-2.8 1.4-2.9-.1 0-2.7-1-2.7-4.1zM13.9 5.1c.7-.9 1.2-2 1.1-3.1-1 0-2.2.7-2.9 1.5-.6.7-1.2 1.9-1.1 3 1.1.1 2.2-.6 2.9-1.4z"/></svg>`;
const OA_F=`<svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor" aria-hidden="true"><path d="M13.5 22v-8h2.7l.4-3.2h-3.1V8.8c0-.9.3-1.6 1.6-1.6h1.7V4.4c-.3 0-1.3-.1-2.5-.1-2.5 0-4.2 1.5-4.2 4.3v2.2H7.3V14h2.8v8h3.4z"/></svg>`;
const oaOn=()=>SITE&&SITE.oauth||{};
function oauthHTML(mode){
  const o=oaOn();if(!o.google&&!o.apple&&!o.facebook)return "";
  return `<div class="gx-oauth">${o.apple?`<button type="button" class="gx-btn ghost gx-oa" data-oauth="apple" data-oamode="${mode}">${OA_A}<span>Continue with Apple</span></button>`:""}
    ${o.google?`<button type="button" class="gx-btn ghost gx-oa" data-oauth="google" data-oamode="${mode}">${OA_G}<span>Continue with Google</span></button>`:""}
    ${o.facebook?`<button type="button" class="gx-btn ghost gx-oa" data-oauth="facebook" data-oamode="${mode}">${OA_F}<span>Continue with Facebook</span></button>`:""}
    <div class="gx-or"><span>or</span></div></div>`}
/* The join steps: with a ticket, no email or password to ask for. */
const gxSteps=G=>G&&G.oauth?["name","username","roles"]:GX_STEPS;
function oauthStart(p,mode){
  const mark=[...crypto.getRandomValues(new Uint8Array(16))].map(x=>x.toString(16).padStart(2,"0")).join("");
  try{localStorage.setItem("tnl-oa-b",mark)}catch(e){}
  goOut(location.origin+"/api/auth/oauth/"+encodeURIComponent(p)+"/start?mode="+encodeURIComponent(mode||"login")+"&b="+mark);
}
document.addEventListener("click",e=>{
  const b=e.target.closest("[data-oauth]");if(!b)return;
  const p=b.dataset.oauth,mode=b.dataset.oamode||"login";
  if(p==="google"&&INAPP){   // Google refuses embedded browsers: go out first (app-18-instagram)
    uiConfirm("Continue in "+outBrowser(),`Google doesn't allow signing in inside ${INAPP}. We'll open LABS in ${outBrowser()} to finish.`,{okLabel:"Open "+outBrowser()})
      .then(y=>{if(y)openOutside(location.origin+"/?oauth=google&mode="+encodeURIComponent(mode))});return}
  oauthStart(p,mode);
});
const OA_WHY={off:"That sign-in isn't switched on yet.",cancelled:"Sign-in was cancelled.",expired:"That took too long. Try again.",
  closed:"LABS is invite-only right now.",suspended:"This account can't sign in.",noemail:"We need a confirmed email from that account to sign you in.",
  failed:"That didn't work. Try again, or use your email."};
/* At boot, before anyone is fetched (app-19-feed-boot). */
async function oauthLanding(){
  const q=new URLSearchParams(location.search),inn=q.get("signin"),up=q.get("signup"),bad=q.get("oauth_error"),go=q.get("oauth"),mark=q.get("b");
  if(go==="google"&&!TOKEN){oauthStart("google",q.get("mode")==="join"?"join":"login");return true}   // sent here from Instagram's browser
  if(!inn&&!up&&!bad&&!go)return;
  ["signin","signup","oauth_error","oauth","mode","b"].forEach(k=>q.delete(k));
  history.replaceState({},"",location.pathname+(q.toString()?"?"+q:"")+location.hash);
  if(bad){setTimeout(()=>toast(OA_WHY[bad]||OA_WHY.failed),400);return}
  if(go)return;
  let mine="";try{mine=localStorage.getItem("tnl-oa-b")||"";localStorage.removeItem("tnl-oa-b")}catch(e){}
  if(!mark||mark!==mine){setTimeout(()=>toast("That sign-in link wasn't started on this device."),400);return}
  try{const d=await req("/api/auth/oauth/claim",{method:"POST",body:{code:inn||up}});
    if(d.token){TOKEN=d.token;localStorage.setItem("tnl-token",TOKEN);return}
    if(d.signup){GATE="join";GFLOW=gxNew();pushView("gate","open");
      Object.assign(GFLOW,{oauth:up,step:"name"});Object.assign(GFLOW.f,{email:d.signup.email,displayName:d.signup.name||""})}}
  catch(e){setTimeout(()=>toast(e.message||OA_WHY.failed),400)}
}
