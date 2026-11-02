/* ── A PICTURE THAT WON'T LOAD · v1.0 · 2026-10-13 ──────────────────────
   One July carousel (8 pictures) lost 7 of its files on the server, so the
   Showroom showed blank slides you could swipe into (Railway logs, 35
   misses a day). Now a slide whose picture can't load leaves the carousel
   — the dots and "1/N" count only what's there, and with one left it's a
   plain picture. A single picture that can't load keeps its space and
   says so quietly, instead of a broken-image icon. Remembered per visit,
   so a repaint doesn't flash it back. */
const BADIMG=new Set();
/* A carousel's frame is its first picture's shape, kept between Instagram's
   limits (4:5 tall to 1.91:1 wide), so it has its size before anything loads. */
function caroRatio(imgs){const f=(imgs||[]).find(i=>i&&i.w&&i.h);if(!f)return "4/5";
  const r=Math.min(1.91,Math.max(0.8,f.w/f.h));return r.toFixed(4)+"/1"}
const imgPath=im=>{try{return new URL(im.currentSrc||im.src,location.href).pathname}catch(e){return ""}};
/* Take the dead slides out of one carousel; with none left, a quiet box. */
function caroPrune(c){
  const track=c.querySelector(".caro-t");if(!track)return;
  const slides=[...track.querySelectorAll(".caro-i")],dots=[...c.querySelectorAll(".caro-d span")];
  let gone=0;
  slides.forEach((im,i)=>{if(im.tagName==="IMG"&&BADIMG.has(imgPath(im))){im.remove();if(dots[i])dots[i].remove();gone++}});
  if(!gone)return;
  const left=track.querySelectorAll(".caro-i").length;
  if(!left){c.replaceWith(imgMissingBox(slides.find(x=>x.tagName==="IMG")));return}
  if(left===1){c.querySelector(".caro-d")?.remove();c.querySelector(".caro-n")?.remove()}
  const d=c.querySelectorAll(".caro-d span");d.forEach((s,i)=>s.classList.toggle("on",i===0));
  const n=c.querySelector(".caro-n");if(n)n.textContent="1/"+left;
  track.scrollLeft=0;delete c.dataset.caroBound;c.dataset.caroShown="";
}
function imgMissingBox(im){
  const b=document.createElement("div");b.className="img-gone";b.setAttribute("role","img");b.setAttribute("aria-label","Picture unavailable");
  b.textContent="Picture unavailable";
  const ar=im&&(im.style.aspectRatio||(im.getAttribute("width")&&im.getAttribute("height")?im.getAttribute("width")+"/"+im.getAttribute("height"):""));
  b.style.aspectRatio=ar||"4/5";return b;
}
/* Every failed picture in the app passes through here (error doesn't bubble — capture). */
document.addEventListener("error",e=>{
  const im=e.target;if(!im||im.tagName!=="IMG")return;
  const p=imgPath(im);if(!p.startsWith("/uploads/"))return;
  BADIMG.add(p);
  const c=im.closest(".caro");
  if(c&&im.classList.contains("caro-i")){caroPrune(c);if(typeof wireCaros==="function")wireCaros();return}
  if(im.classList.contains("post-img")||im.classList.contains("sr-img"))im.replaceWith(imgMissingBox(im));
},true);
