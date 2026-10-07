/* ── PHOTO EDITOR · 2026-09-30 ─────────────────────────────────────────
   Instagram's edit step, on the phone, nothing new on the server: crop
   (original, square, 4:5, 16:9 — drag to position, zoom), filters, and
   brightness / contrast / saturation / warmth. It always works from the
   original upload, so edits can be changed or undone later. Lives on its
   own layer — sliding a slider never repaints the app. */
const PED_ASPECTS=[["orig","Original"],["1:1","Square"],["4:5","4:5"],["16:9","16:9"]];
const PED_ADJ=[["b","Brightness"],["c","Contrast"],["s","Saturation"],["w","Warmth"]];
const PED_FILTERS={none:{n:"Original"},mono:{n:"Mono",s:-100},noir:{n:"Noir",s:-100,c:35},fade:{n:"Fade",fade:60,c:-15,s:-15},
  warm:{n:"Warm",w:40,s:10},cool:{n:"Cool",w:-40,s:-5},punch:{n:"Punch",c:30,s:35},lab:{n:"Lab",g:18,c:10}};
const pedNew=()=>({aspect:"orig",zoom:1,px:0,py:0,filter:"none",b:0,c:0,s:0,w:0});
let PED=null;

/* The crop box, in source pixels. */
function pedBox(img,e){
  const W=img.naturalWidth||img.width,H=img.naturalHeight||img.height;
  const ar=e.aspect==="1:1"?1:e.aspect==="4:5"?.8:e.aspect==="16:9"?16/9:W/H;
  let cw,ch;if(W/H>ar){ch=H;cw=H*ar}else{cw=W;ch=W/ar}
  cw/=e.zoom;ch/=e.zoom;
  return {sx:(W-cw)/2*(1+e.px),sy:(H-ch)/2*(1+e.py),cw,ch,ar};
}
/* Brightness/contrast through a lookup table, then saturation, warmth,
   fade — plain pixel maths, so it looks the same on every phone. */
function pedTone(ctx,w,h,e){
  const f=PED_FILTERS[e.filter]||{};
  const b=((e.b||0)+(f.b||0))/100,c=((e.c||0)+(f.c||0))/100,s=((e.s||0)+(f.s||0))/100,
    wm=((e.w||0)+(f.w||0))/100,fade=(f.fade||0)/100,g=(f.g||0);
  if(!b&&!c&&!s&&!wm&&!fade&&!g)return;
  const k=Math.tan((Math.max(-.98,Math.min(.98,c))+1)*Math.PI/4),lut=new Uint8ClampedArray(256);
  for(let v=0;v<256;v++){let x=v+b*110;x=(x-128)*k+128;x=x*(1-fade*.22)+fade*48;lut[v]=x}
  const d=ctx.getImageData(0,0,w,h),p=d.data,sat=1+s,wr=wm*28;
  for(let i=0;i<p.length;i+=4){
    let r=lut[p[i]],gg=lut[p[i+1]],bb=lut[p[i+2]];
    if(sat!==1){const y=.299*r+.587*gg+.114*bb;r=y+(r-y)*sat;gg=y+(gg-y)*sat;bb=y+(bb-y)*sat}
    p[i]=r+wr;p[i+1]=gg+g;p[i+2]=bb-wr;
  }
  ctx.putImageData(d,0,0);
}
function pedRender(canvas,img,e,maxW){
  const bx=pedBox(img,e),w=Math.max(1,Math.round(Math.min(maxW,bx.cw))),h=Math.max(1,Math.round(w/bx.ar));
  canvas.width=w;canvas.height=h;
  const ctx=canvas.getContext("2d",{willReadFrequently:true});
  ctx.drawImage(img,bx.sx,bx.sy,bx.cw,bx.ch,0,0,w,h);
  pedTone(ctx,w,h,e);
  return canvas;
}

function pedHTML(){
  const e=PED.e,t=PED.tab;
  const panel=t==="crop"?`<div class="ped-row">${PED_ASPECTS.map(([k,l])=>`<button class="chip${e.aspect===k?" on":""}" data-peda="${k}">${l}</button>`).join("")}</div>
      <label class="ped-sl"><span>Zoom</span><input type="range" min="100" max="300" value="${Math.round(e.zoom*100)}" data-pedz></label>
      <div class="ped-hint">Drag the photo to position it</div>`
    :t==="filter"?`<div class="ped-filters">${Object.entries(PED_FILTERS).map(([k,f])=>`<button class="ped-f${e.filter===k?" on":""}" data-pedf="${k}"><canvas data-pedft="${k}" width="72" height="72"></canvas><span>${f.n}</span></button>`).join("")}</div>`
    :PED_ADJ.map(([k,l])=>`<label class="ped-sl"><span>${l}</span><input type="range" min="-100" max="100" value="${e[k]||0}" data-pedj="${k}"><b data-pedv="${k}">${e[k]||0}</b></label>`).join("");
  return `<div class="ped" role="dialog" aria-label="Edit photo">
    <header class="pc-top"><button class="pc-cancel" id="pedx">Cancel</button><div class="pc-ttl">Edit</div><button class="pc-share" id="pedok">Done</button></header>
    <div class="ped-stage" id="pedstage"><canvas id="pedc"></canvas></div>
    <div class="ped-tabs">${[["filter","Filters"],["crop","Crop"],["adjust","Adjust"]].map(([k,l])=>`<button class="ped-tab${t===k?" on":""}" data-pedt="${k}">${l}</button>`).join("")}</div>
    <div class="ped-panel">${panel}</div>
    <button class="ped-reset" id="pedreset">Reset</button>
  </div>`}

let pedRaf=0;
function pedDraw(){cancelAnimationFrame(pedRaf);pedRaf=requestAnimationFrame(()=>{
  const cv=$("#pedc"),st=$("#pedstage");if(!cv||!PED)return;
  pedRender(cv,PED.img,PED.e,Math.min(1200,st.clientWidth*(devicePixelRatio||1)))})}
function pedPaint(){
  let l=document.getElementById("pedl");
  if(!l){l=document.createElement("div");l.id="pedl";document.body.appendChild(l)}
  l.innerHTML=PED?pedHTML():"";
  document.body.classList.toggle("ped-on",!!PED);
  if(!PED)return;
  pedDraw();pedWire();
  if(PED.tab==="filter"){   // each tile shows the photo in that filter
    const sm=document.createElement("canvas");pedRender(sm,PED.img,{...PED.e,filter:"none",b:0,c:0,s:0,w:0},144);
    document.querySelectorAll("[data-pedft]").forEach(cv=>{const x=cv.getContext("2d",{willReadFrequently:true}),m=Math.min(sm.width,sm.height);
      x.drawImage(sm,(sm.width-m)/2,(sm.height-m)/2,m,m,0,0,72,72);pedTone(x,72,72,{filter:cv.dataset.pedft})});
  }
}
function pedWire(){
  const e=PED.e;
  $("#pedx").onclick=()=>pedClose();
  $("#pedok").onclick=pedDone;
  $("#pedreset").onclick=()=>{PED.e=pedNew();pedPaint()};
  document.querySelectorAll("[data-pedt]").forEach(b=>b.onclick=()=>{PED.tab=b.dataset.pedt;pedPaint()});
  document.querySelectorAll("[data-peda]").forEach(b=>b.onclick=()=>{e.aspect=b.dataset.peda;e.px=0;e.py=0;
    document.querySelectorAll("[data-peda]").forEach(x=>x.classList.toggle("on",x===b));pedDraw()});
  document.querySelectorAll("[data-pedf]").forEach(b=>b.onclick=()=>{e.filter=b.dataset.pedf;
    document.querySelectorAll("[data-pedf]").forEach(x=>x.classList.toggle("on",x===b));pedDraw()});
  const z=document.querySelector("[data-pedz]");if(z)z.oninput=()=>{e.zoom=+z.value/100;pedDraw()};
  document.querySelectorAll("[data-pedj]").forEach(s=>s.oninput=()=>{const k=s.dataset.pedj;e[k]=+s.value;
    const v=document.querySelector(`[data-pedv="${k}"]`);if(v)v.textContent=s.value;pedDraw()});
  /* Drag to position the crop. */
  const st=$("#pedstage");let d=null;
  st.onpointerdown=ev=>{d={x:ev.clientX,y:ev.clientY,px:e.px,py:e.py};st.setPointerCapture(ev.pointerId)};
  st.onpointermove=ev=>{if(!d)return;const cv=$("#pedc"),r=cv.getBoundingClientRect(),bx=pedBox(PED.img,e),
      W=PED.img.naturalWidth,H=PED.img.naturalHeight,sw=(W-bx.cw)/2,sh=(H-bx.ch)/2;
    if(sw>0)e.px=Math.max(-1,Math.min(1,d.px-(ev.clientX-d.x)*(bx.cw/r.width)/sw));
    if(sh>0)e.py=Math.max(-1,Math.min(1,d.py-(ev.clientY-d.y)*(bx.ch/r.height)/sh));
    pedDraw()};
  st.onpointerup=st.onpointercancel=()=>{d=null};
}

async function pedOpen(c,i){
  const im=c.imgs[i];if(!im||im.gif)return;
  const img=new Image();img.decoding="async";
  try{await new Promise((ok,no)=>{img.onload=ok;img.onerror=no;img.src=im.orig||im.url})}
  catch(e){return toast("Couldn't open that photo")}
  PED={c,i,im,img,e:{...pedNew(),...(im.edit||{})},tab:"filter"};pedPaint();
}
function pedClose(){if(!PED&&!document.getElementById("pedl"))return;PED=null;pedPaint()}

/* Done: render at full size from the original, upload it and its thumb,
   and swap them in. The post can't be shared until they land. */
async function pedDone(){
  const {c,im,img,e}=PED;pedClose();
  const same=JSON.stringify(e)===JSON.stringify(im.edit||pedNew());if(same)return;
  im.orig=im.orig||im.url;im.edit={...e};
  const clean=JSON.stringify(e)===JSON.stringify(pedNew());
  c.upN=(c.upN||0)+1;im.busy=true;pcRepaint(c);
  try{
    /* Back to the untouched original, or a new render at up to 3000px —
       with the same feed and grid copies as any upload. */
    const src=clean?img:pedRender(document.createElement("canvas"),img,e,FULL_MAX);
    const tc=drawFit(src,1440,2400),sc=drawFit(src,480,800);
    const [url,thumb,sm]=await Promise.all([clean?im.orig:upImg(await canvasBlob(src,"image/jpeg",.92)),
      upImg(await canvasBlob(tc,"image/jpeg",.86)),upImg(await canvasBlob(sc,"image/jpeg",.8))]);
    Object.assign(im,{url,thumb,sm,w:src.naturalWidth||src.width,h:src.naturalHeight||src.height,tw:tc.width,sw:sc.width});
  }catch(x){if(!c.dead)toast(x.message)}
  im.busy=false;c.upN--;pcRepaint(c);
}
