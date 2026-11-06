/* ================================================================
   UPLOADS v1.3 — 2026-11-06 (a file over 8MB goes up in pieces and picks up where it stopped — uploadPieces, server/uploads/chunks.js; a piece with no progress for 30s is sent again). v1.2 — 2026-11-05 (videos up to 2GB: VID_MAX; one over VID_KEEP is made 1080p on the server — the screen says so after 100%; a too-big one says its size and what to do). v1.1 — 2026-10-08. Moved out of app/state/state-ui (24KB) when
   uploads learned to survive a dropped connection: a phone video over a
   weak signal, or a deploy restarting the server mid-upload, used to just
   fail. Now a dropped connection is retried twice (after 3s, then 10s —
   long enough for a restart), progress says so, and every failure is
   reported to Admin → Glitches with its size, how long it ran and why.
   IN PIECES (2026-11-06): "Now it's getting stuck at 5%. I've been trying
   to upload this video this whole week." One long request over a phone
   signal can stall with no error, and a retry began again at 0%. Like Meta
   and YouTube, a file over PIECE_FROM goes up in 4MB pieces: a piece with no
   progress for PIECE_STALL is dropped and sent again, a dropped signal waits
   and asks the server how much landed, and the upload carries on from there.
   It gives up only after a long run of failures in a row.
   STREAMS the raw file straight to the server — no base64, no giant string
   in memory, and real progress (XHR: fetch can't report upload progress).
   Falls back to the older base64 route if the server doesn't have the
   streaming one yet (frontend and backend deploy separately).
   VIDEOS (2026-11-05): up to 2GB; over 650MB the server keeps a 1080p copy
   (server/uploads/big-video.js).
================================================================ */
const VID_MAX=2048*1024*1024,VID_KEEP=650*1024*1024;
const vidMB=f=>(f.size/1073741824>=1?(f.size/1073741824).toFixed(1)+"GB":Math.round(f.size/1048576)+"MB");
const vidTooBig=f=>"That video is "+vidMB(f)+" — LABS takes up to 2GB. Trim it in Photos (Edit), or record at 1080p";
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
async function uploadB64(blob){
  const data=await new Promise((res,rej)=>{
    const fr=new FileReader();fr.onerror=()=>rej(new Error("Couldn't read that file"));
    fr.onload=()=>res(fr.result);fr.readAsDataURL(blob);
  });
  return req("/api/upload",{method:"POST",body:{data}});
}
function uploadError(status,d){
  if(d&&d.error){
    if(d.needsVerify)return "Confirm your email first — check your inbox, or hit Resend up top";
    return d.error;
  }
  if(status===401)return "You've been signed out — sign in and try again";
  if(status===403)return "Confirm your email first — check your inbox, or hit Resend up top";
  if(status===413)return "That file's too big";
  if(status===507)return "LABS is short on space for a video this big right now — try a shorter one";
  if(status===429)return "Too many uploads — give it a minute";
  return "Upload failed ("+status+")";
}

const PIECE_FROM=8*1024*1024,PIECE_STALL=30000;
function pieceXhr(method,path,body,{json=false,onUp=null}={}){
  return new Promise((resolve,reject)=>{
    const x=new XMLHttpRequest();let stall=0;
    const net=m=>{clearTimeout(stall);const e=new Error(m||"Upload failed — check your connection");e.net=true;reject(e)};
    const watch=()=>{clearTimeout(stall);stall=setTimeout(()=>{x.onabort=null;x.abort();net("stalled")},PIECE_STALL)};
    x.open(method,API+path);
    x.setRequestHeader("Content-Type",json?"application/json":"application/octet-stream");
    if(TOKEN)x.setRequestHeader("Authorization","Bearer "+TOKEN);
    if(body&&!json){x.upload.onprogress=e=>{watch();if(onUp)onUp(e.loaded)};watch()}
    x.onload=()=>{clearTimeout(stall);let d={};try{d=JSON.parse(x.responseText)}catch(e){}
      if(x.status>=502&&x.status<=504||x.status===0)return net();
      resolve({status:x.status,d})};
    x.onerror=()=>net();
    x.onabort=()=>{clearTimeout(stall);reject(new Error("Upload cancelled"))};
    UPLOADXHR=x;
    x.send(body||null);
  });
}
async function uploadPieces(file,onProgress){
  const size=file.size,prog=n=>{if(onProgress)onProgress(Math.min(1,n/size))};
  const fail=(st,d)=>new Error(uploadError(st,d));
  let r=await pieceXhr("POST","/api/upload/pieces",JSON.stringify({size}),{json:true});
  if(r.status===404)return null;
  if(r.status!==200)throw fail(r.status,r.d);
  const id=r.d.id,P=r.d.piece||4194304;let have=0,fails=0,said=false;
  while(have<size){
    try{
      r=await pieceXhr("PUT","/api/upload/pieces/"+id+"?at="+have,file.slice(have,Math.min(size,have+P)),{onUp:l=>prog(have+l)});
      if(r.status===200){have=r.d.have;fails=0;prog(have);if(said){said=false;toast("Back online — still uploading")}continue}
      if(r.status===409&&typeof r.d.have==="number"){have=r.d.have;continue}
      throw fail(r.status,r.d);
    }catch(e){
      if(!e.net)throw e;
      if(++fails>40)throw new Error("Upload failed — check your connection and try again");
      if(!said){said=true;toast("Connection dropped — it'll pick up where it stopped")}
      await new Promise(ok=>setTimeout(ok,Math.min(15000,1500*fails)));
      try{const g=await pieceXhr("GET","/api/upload/pieces/"+id,null,{json:true});
        if(g.status===200)have=g.d.have;else if(g.status===404)throw fail(404,g.d)}
      catch(e2){if(!e2.net)throw e2}
    }
  }
  r=await pieceXhr("POST","/api/upload/pieces/"+id+"/done","{}",{json:true});
  if(r.status>=200&&r.status<300)return r.d;
  throw fail(r.status,r.d);
}

function uploadStream(fileOrBlob,onProgress){
  const t0=Date.now(),mb=((fileOrBlob&&fileOrBlob.size)||0)/1048576;
  if(fileOrBlob&&fileOrBlob.size>PIECE_FROM&&typeof fileOrBlob.slice==="function")
    return uploadPieces(fileOrBlob,onProgress).then(d=>d||uploadStreamOne(fileOrBlob,onProgress,t0,mb)).catch(e=>{
      try{glitch("action_failed","upload "+mb.toFixed(1)+"MB in pieces → "+String(e.message).slice(0,70)+" after "+Math.round((Date.now()-t0)/1000)+"s")}catch(_){}
      throw e});
  return uploadStreamOne(fileOrBlob,onProgress,t0,mb);
}
function uploadStreamOne(fileOrBlob,onProgress,t0,mb){
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
