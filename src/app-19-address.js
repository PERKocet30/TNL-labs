/* ================================================================
   THE ADDRESS v1.0 — 2026-10-18: the app moves to tnllabs.com
   (server-01-move.js). On an old address the app asks where home is and
   goes there, carrying the sign-in across with a one-use code; on arrival
   it trades the code for a session and takes it out of the address bar.
   Until Railway has CANONICAL_HOST, the old address just stays put.
================================================================ */
const OLD_HOSTS=["labs.tnllabs.com","www.tnllabs.com"];
async function addressMove(){
  const q=new URLSearchParams(location.search),code=q.get("handoff");
  if(code){
    q.delete("handoff");history.replaceState({},"",location.pathname+(q.toString()?"?"+q:"")+location.hash);
    /* only a move from the old address counts: a code in a link someone sent you
       must not sign you into their account */
    let from="";try{from=new URL(document.referrer).hostname}catch(e){}
    if(!TOKEN&&OLD_HOSTS.includes(from)){try{const d=await req("/api/auth/handoff/claim",{method:"POST",body:{code}});
      if(d&&d.token){TOKEN=d.token;localStorage.setItem("tnl-token",TOKEN)}}catch(e){/* expired: they log in */}}
    return false;
  }
  if(!OLD_HOSTS.includes(location.hostname))return false;
  try{const d=await req("/api/auth/handoff",{method:"POST",body:{next:location.pathname+location.search+location.hash}});
    if(d&&d.url){location.replace(d.url);return true}}catch(e){}
  return false;
}
