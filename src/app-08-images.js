/* ── IMAGE QUALITY v2 · 2026-10-07 ─────────────────────────────────────
   For an art tournament the work has to look like the work.
   · Full size is the artist's ORIGINAL file whenever we can keep it —
     their colour profile, transparency and every pixel — with the hidden
     data (GPS location, camera, editing history) stripped first.
   · The feed shows a 1440px copy (it was 700 on the long side, stretched
     2× on a phone), and the browser picks the original on screens that
     need more. A 480px copy keeps profile grids light.
   · Designs with transparency stay transparent (PNG), never black. */
const IMG_SIZES="(min-width:1024px) 640px, 100vw";

/* A post's pictures as one list, old posts (one image, no list) too. */
const pxImgs=p=>(p.images&&p.images.length)?p.images
  :(p.imageUrl?[{url:p.imageUrl,thumb:p.thumbUrl||p.imageUrl,w:p.mediaW,h:p.mediaH}]:[]);
/* src + srcset for a picture. Before 2026-10-07 the copy was 700px on its
   long side, so old posts are described honestly and phones fetch the
   original instead of stretching it. full=true: just the original. */
function imgAttrs(im,full){
  if(full||!im.thumb)return `src="${esc(im.url)}"`;
  const th=im.thumb;
  if(!im.w||!im.h||th===im.url)return `src="${esc(th)}"`;
  const tw=im.tw||Math.round(700*im.w/Math.max(im.w,im.h));
  const set=[im.sm&&im.sw?`${esc(im.sm)} ${im.sw}w`:"",tw<im.w?`${esc(th)} ${tw}w`:"",`${esc(im.url)} ${im.w}w`].filter(Boolean);
  return `src="${esc(th)}" srcset="${set.join(", ")}" sizes="${IMG_SIZES}"`;
}
/* The small copy, for grids and chips. */
const imgSmall=im=>im.sm||im.thumb||im.url;

/* ── stripping the hidden data, keeping the picture ── */
/* JPEG: drop APP1 (EXIF + XMP: GPS, camera, edits), APP13 (Photoshop) and
   comments; keep APP2 (the colour profile) and everything that draws the
   image. A photo turned by its EXIF tag would lie down without it, so
   those go through the canvas instead (null). */
function jpegOrientation(b,i,len){
  if(String.fromCharCode(b[i],b[i+1],b[i+2],b[i+3])!=="Exif")return 1;
  const t=i+6,le=b[t]===0x49,u16=o=>le?b[o]|b[o+1]<<8:b[o]<<8|b[o+1];
  const u32=o=>le?(b[o]|b[o+1]<<8|b[o+2]<<16|b[o+3]<<24)>>>0:(b[o]<<24|b[o+1]<<16|b[o+2]<<8|b[o+3])>>>0;
  const ifd=t+u32(t+4),n=u16(ifd);
  for(let k=0;k<n;k++){const e=ifd+2+k*12;if(e+12>i+len)break;if(u16(e)===0x0112)return u16(e+8)}
  return 1;
}
/* An allowlist, not a blocklist: of the APPn blocks only JFIF (APP0), the
   colour profile (APP2 ICC_PROFILE) and Adobe's colour flag (APP14) stay —
   cameras hide GPS in others (GoPro's APP6, MPF previews). And it stops at
   the picture's real end (FFD9): phones tack whole files on after it
   (motion-photo videos, gain maps) that carry their own location. Anything
   it can't read goes through the canvas instead (null). */
async function cleanJpeg(file){
  const b=new Uint8Array(await file.arrayBuffer()),n=b.length;
  if(b[0]!==0xFF||b[1]!==0xD8)return null;
  const keep=[b.subarray(0,2)],tag=(i,s)=>String.fromCharCode(...b.subarray(i,i+s.length))===s;
  let i=2;
  while(i+1<n){
    if(b[i]!==0xFF)return null;
    const m=b[i+1];
    if(m===0xFF){i++;continue}                                  // fill byte
    if(m===0xD9){keep.push(b.subarray(i,i+2));return new Blob(keep,{type:"image/jpeg"})}   // the end — nothing after it
    if(m===0x01||(m>=0xD0&&m<=0xD7)){keep.push(b.subarray(i,i+2));i+=2;continue}
    if(i+4>n)return null;
    const len=b[i+2]<<8|b[i+3];if(len<2||i+2+len>n)return null;
    if(m>=0xE0&&m<=0xEF){
      if(m===0xE1&&jpegOrientation(b,i+4,len)>1)return null;
      if(m===0xE0||m===0xEE||(m===0xE2&&tag(i+4,"ICC_PROFILE\0")))keep.push(b.subarray(i,i+2+len));
    }else if(m!==0xFE)keep.push(b.subarray(i,i+2+len));        // tables, frame, scan header (COM dropped)
    i+=2+len;
    if(m===0xDA){                                               // the picture data, up to the next real marker
      let j=i;while(j+1<n&&!(b[j]===0xFF&&b[j+1]!==0x00&&!(b[j+1]>=0xD0&&b[j+1]<=0xD7)))j++;
      keep.push(b.subarray(i,j));i=j;
    }
  }
  return null;                                                  // no end marker: don't trust it
}
/* PNG: drop text and EXIF chunks; keep the colour profile and the pixels. */
async function cleanPng(file){
  const b=new Uint8Array(await file.arrayBuffer()),dv=new DataView(b.buffer);
  if(dv.getUint32(0)!==0x89504E47)return null;
  const keep=[b.subarray(0,8)],drop=new Set(["eXIf","tEXt","iTXt","zTXt","tIME"]);let i=8;
  while(i+12<=b.length){
    const len=dv.getUint32(i),type=String.fromCharCode(b[i+4],b[i+5],b[i+6],b[i+7]);
    if(!drop.has(type))keep.push(b.subarray(i,i+12+len));
    i+=12+len;if(type==="IEND")break;
  }
  return new Blob(keep,{type:"image/png"});
}

/* Does it have see-through parts? (sampled small — fast on any size) */
function hasAlpha(img){
  try{const c=document.createElement("canvas");c.width=c.height=96;const x=c.getContext("2d",{willReadFrequently:true});
    x.drawImage(img,0,0,96,96);const d=x.getImageData(0,0,96,96).data;
    for(let i=3;i<d.length;i+=4)if(d[i]<250)return true}catch(e){}
  return false;
}
/* Draw to a canvas no wider than maxW (and no taller than maxH). */
function drawFit(img,maxW,maxH){
  let w=img.naturalWidth||img.width,h=img.naturalHeight||img.height;
  const s=Math.min(1,maxW/w,(maxH||Infinity)/h);w=Math.max(1,Math.round(w*s));h=Math.max(1,Math.round(h*s));
  const c=document.createElement("canvas");c.width=w;c.height=h;
  const x=c.getContext("2d");x.imageSmoothingQuality="high";x.drawImage(img,0,0,w,h);
  return c;
}
const canvasBlob=(c,type,q)=>new Promise((ok,no)=>c.toBlob(b=>b?ok(b):no(new Error("Couldn't prepare that image")),type,q));
async function upImg(blob){const r=await uploadStream(blob);if(r.kind&&r.kind!=="image")throw new Error("That isn't an image");return r.url}

/* A piece of work: the original (or a 4096px copy when it can't be kept),
   a 1440px feed copy and a 480px grid copy. */
async function uploadWork(file){
  const {img}=await loadImage(file);
  const W=img.naturalWidth||img.width,H=img.naturalHeight||img.height;
  if(file.type==="image/gif"&&file.size<8*1024*1024){const u=await upImg(file);return {url:u,thumb:u,w:W,h:H,gif:true}}
  const alpha=(file.type==="image/png"||file.type==="image/webp")&&hasAlpha(img);
  const copyType=alpha?"image/png":"image/jpeg";
  let full=null,fw=W,fh=H;
  if(Math.max(W,H)<=6000&&file.size<=28*1024*1024){
    if(file.type==="image/jpeg")full=await cleanJpeg(file).catch(()=>null);
    else if(file.type==="image/png")full=await cleanPng(file).catch(()=>null);
  }
  if(!full){const c=drawFit(img,4096,4096);full=await canvasBlob(c,copyType,.95);fw=c.width;fh=c.height}
  const tc=drawFit(img,1440,2400),sc=drawFit(img,480,800);
  const [url,thumb,sm]=await Promise.all([upImg(full),upImg(await canvasBlob(tc,copyType,.86)),upImg(await canvasBlob(sc,copyType,.8))]);
  return {url,thumb,sm,w:fw,h:fh,tw:tc.width,sw:sc.width};
}
