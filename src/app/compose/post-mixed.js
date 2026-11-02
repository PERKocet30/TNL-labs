/* ── PHOTOS AND VIDEOS IN ONE POST · v1.0 · 2026-10-30 ── "a carousel with a video in the middle didn't work":
   up to 10 of either, in picked order. A video slide carries a still (url/thumb); caroSlide plays it. */
const pcIsVid=f=>f.type.startsWith("video/")||(!f.type&&/\.(mp4|m4v|mov|webm)$/i.test(f.name));
const PC_BLANK="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg'/%3E";
function pcPick(c,files){
  if(!files.length)return;
  if(c.vidbusy){toast("Wait for the video to finish uploading");return}
  const vids=files.filter(pcIsVid);
  if(!c.imgs.length&&!c.upN&&!c.vid&&vids.length===1&&files.length===1)return pcPickVideo(c,vids[0]);
  if(c.vid){
    if(!c.cover){toast("That video has no cover yet — remove it and add it again");return}
    c.imgs.unshift({video:c.vid.url,url:c.cover,thumb:c.cover,w:c.vw,h:c.vh});c.vid=null;c.vedit=null;c.cover=null;c.idx=0;
    if(c.imgs.length>=10){toast("10 photos and videos max");render();return}
  }
  pcAddMixed(c,files);
}
async function pcPickVideo(c,f){
  if(f.size>650*1024*1024){toast(f.name+" is over 650MB");return}
  c.vid=null;c.cover=null;c.vedit=null;c.vidbusy=true;c.vidprog=0;render();
  try{const v=document.createElement("video");v.preload="metadata";v.muted=true;const u=URL.createObjectURL(f);
    v.onloadedmetadata=()=>{c.vw=v.videoWidth||undefined;c.vh=v.videoHeight||undefined;URL.revokeObjectURL(u)};v.src=u}catch(e){}
  try{
    const up=await uploadStream(f,pr=>{if(c.dead)return;c.vidprog=pr;
      const t=$("#pcvidprog"),b=$("#pcvidbar");if(t)t.textContent="Uploading video · "+Math.round(pr*100)+"%";if(b)b.style.width=Math.round(pr*100)+"%";
      if(c.queued)pqPaint()});
    if(c.dead)return;   // discarded mid-upload
    if(up.kind!=="video")throw new Error("That file isn't a video");
    c.vid={url:up.url};if(!c.cover&&up.poster)c.cover=up.poster;
  }catch(e){if(c.dead)return;toast(e.message)}
  c.vidbusy=false;pcRepaint(c);
}
function pcFrame(file){
  return new Promise(res=>{
    let done=false,u="";const end=r=>{if(done)return;done=true;try{URL.revokeObjectURL(u)}catch(e){}res(r)};
    try{
      const v=document.createElement("video");v.muted=true;v.playsInline=true;v.preload="auto";u=URL.createObjectURL(file);
      v.onloadeddata=()=>{try{v.currentTime=Math.min(1,(v.duration||2)/2)}catch(e){end(null)}};
      v.onseeked=()=>{try{
        const w=v.videoWidth,h=v.videoHeight;if(!w||!h)return end(null);
        const k=Math.min(1,1080/Math.max(w,h)),cv=document.createElement("canvas");cv.width=Math.round(w*k);cv.height=Math.round(h*k);
        cv.getContext("2d").drawImage(v,0,0,cv.width,cv.height);
        cv.toBlob(b=>end(b?{blob:b,w,h}:null),"image/jpeg",.85)}catch(e){end(null)}};
      v.onerror=()=>end(null);setTimeout(()=>end(null),10000);v.src=u;
    }catch(e){end(null)}
  });
}
function pcAddMixed(c,files){
  const room=10-c.imgs.length;
  if(files.length>room)toast("10 photos and videos max");
  const take=files.slice(0,Math.max(0,room));if(!take.length)return;
  const slots=take.map(file=>{const vid=pcIsVid(file);let local="";if(!vid)try{local=URL.createObjectURL(file)}catch(e){}
    const im=vid?{busy:true,isv:true,thumb:PC_BLANK,url:PC_BLANK}:{busy:true,thumb:local,url:local,local};c.imgs.push(im);return {im,file,vid}});
  c.upN=(c.upN||0)+slots.length;render();
  let next=0;
  const run=async()=>{
    while(next<slots.length){
      const {im,file,vid}=slots[next++];
      try{
        if(!vid){const up=await uploadWork(file);if(c.dead)return;delete im.busy;Object.assign(im,up)}
        else{
          if(file.size>650*1024*1024)throw new Error(file.name+" is over 650MB");
          const fr=pcFrame(file);
          fr.then(f=>{if(f&&im.busy&&!c.dead){try{im.local=URL.createObjectURL(f.blob);im.thumb=im.url=im.local}catch(e){}pcRepaint(c)}});
          const up=await uploadStream(file,()=>{});if(c.dead)return;
          if(up.kind!=="video")throw new Error("That file isn't a video");
          const f=await fr;let still=up.poster?{url:up.poster,thumb:up.poster}:null;
          if(!still&&f)still=await uploadWork(new File([f.blob],"frame.jpg",{type:"image/jpeg"}));
          if(!still)throw new Error("Couldn't take a picture from "+file.name);
          if(c.dead)return;
          delete im.busy;Object.assign(im,{video:up.url,url:still.url,thumb:still.thumb||still.url,w:f?f.w:still.w,h:f?f.h:still.h});
        }
      }
      catch(e){if(c.dead)return;const k=c.imgs.indexOf(im);if(k>=0){c.imgs.splice(k,1);c.idx=Math.min(c.idx||0,Math.max(0,c.imgs.length-1))}toast(e.message)}
      try{if(im.local)URL.revokeObjectURL(im.local)}catch(e){}delete im.local;
      c.upN--;pcRepaint(c);
    }
  };
  for(let k=0;k<Math.min(PC_UP_AT_ONCE,slots.length);k++)run();
}
const pcVidMark=im=>im&&(im.video||im.isv)?`<span class="pc-vmark" aria-hidden="true">${DI.play}</span>`:"";
