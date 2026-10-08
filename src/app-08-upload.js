/* ================================================================
   UPLOADS v1.1 — 2026-10-08. Moved out of app-08-state-ui (24KB) when
   uploads learned to survive a dropped connection: a phone video over a
   weak signal, or a deploy restarting the server mid-upload, used to just
   fail. Now a dropped connection is retried twice (after 3s, then 10s —
   long enough for a restart), progress says so, and every failure is
   reported to Admin → Glitches with its size, how long it ran and why.
================================================================ */
/* Streams the raw file straight to the server — no base64, no giant string
   in memory, and we get real progress. XHR rather than fetch because fetch
   still can't report UPLOAD progress, and a 600MB upload with no feedback
   is indistinguishable from a hang.

   Falls back to the older base64 route if the server doesn't have the
   streaming one yet. Frontend and backend get deployed separately and
   sometimes drift; a photo upload shouldn't just die because of that. */
function uploadOnce(fileOrBlob,onProgress){
  return new Promise((resolve,reject)=>{
    const x=new XMLHttpRequest();
    x.open("POST",API+"/api/upload/stream");
    x.setRequestHeader("Content-Type","application/octet-stream");
    if(TOKEN)x.setRequestHeader("Authorization","Bearer "+TOKEN);
    x.upload.onprogress=e=>{if(e.lengthComputable&&onProgress)onProgress(e.loaded/e.total)};
    x.onload=async()=>{
      let d={};try{d=JSON.parse(x.responseText)}catch(e){}
      if(x.status>=200&&x.status<300)return resolve(d);
      if(x.status===404){                     // server predates streaming
        try{return resolve(await uploadB64(fileOrBlob))}catch(e){return reject(e)}
      }
      const e=new Error(uploadError(x.status,d));e.net=x.status>=502&&x.status<=504;reject(e);   // 502–504: the server's restarting
    };
    x.onerror=()=>{const e=new Error("Upload failed — check your connection");e.net=true;reject(e)};
    x.onabort=()=>reject(new Error("Upload cancelled"));
    UPLOADXHR=x;
    x.send(fileOrBlob);
  });
}
/* The old route. Kept only as a safety net for a stale server. */
async function uploadB64(blob){
  const data=await new Promise((res,rej)=>{
    const fr=new FileReader();fr.onerror=()=>rej(new Error("Couldn't read that file"));
    fr.onload=()=>res(fr.result);fr.readAsDataURL(blob);
  });
  return req("/api/upload",{method:"POST",body:{data}});
}
/* Say what actually went wrong. "Upload failed" helps nobody. */
function uploadError(status,d){
  if(d&&d.error){
    if(d.needsVerify)return "Confirm your email first — check your inbox, or hit Resend up top";
    return d.error;
  }
  if(status===401)return "You've been signed out — sign in and try again";
  if(status===403)return "Confirm your email first — check your inbox, or hit Resend up top";
  if(status===413)return "That file's too big";
  if(status===429)return "Too many uploads — give it a minute";
  return "Upload failed ("+status+")";
}

function uploadStream(fileOrBlob,onProgress){
  const t0=Date.now(),mb=((fileOrBlob&&fileOrBlob.size)||0)/1048576;
  const run=async(tries)=>{
    try{return await uploadOnce(fileOrBlob,onProgress)}
    catch(e){
      if(e.net&&tries<2&&navigator.onLine!==false){
        const wait=tries?10000:3000;
        toast("Connection dropped — retrying the upload…");
        await new Promise(r=>setTimeout(r,wait));
        if(onProgress)onProgress(0);
        return run(tries+1);
      }
      try{glitch("action_failed","upload "+mb.toFixed(1)+"MB → "+e.message.slice(0,70)+" after "+Math.round((Date.now()-t0)/1000)+"s"+(tries?" ("+(tries+1)+" tries)":""))}catch(_){}
      throw e;
    }
  };
  return run(0);
}
