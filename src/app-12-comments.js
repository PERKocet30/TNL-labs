/* COMMENTS IN PLACE — 2026-09-30. Tapping comment used to repaint the whole
   app twice (open, then when the comments arrived): every picture in the
   feed was rebuilt, carousels collapsed for a frame, the Showroom refreshed,
   and the focused box scrolled the page — the feed jumped. Now each post has
   a comment slot and only that slot changes; the rest of the screen isn't
   touched. */
/* While a post is open on top, its comments live in the opened post only —
   the same card behind it would otherwise carry a second, hidden #cdraft
   and a send could read the wrong box. */
let CSLOTPO=false;   // true while the opened post (#poov) is being drawn
function cslotHTML(p){
  const here=OPENCOMMENTS===p.id&&(!POSTOPEN||Number(POSTOPEN.id)!==Number(p.id)||CSLOTPO);
  return (p.commentCount&&!here?`<button class="ig-viewc" data-comments="${p.id}">View all ${p.commentCount} comment${p.commentCount==1?"":"s"}</button>`:"")
    +(here?commentsHTML(p):"");
}
/* Repaint every comment slot whose content changed. No slot on screen (a
   view without them) → the full repaint it always was. */
function paintComments(){
  const slots=[...document.querySelectorAll("[data-cslot]")];
  if(!slots.length)return render();
  for(const s of slots){
    const p=findAnyPost(+s.dataset.cslot);if(!p)continue;
    CSLOTPO=!!s.closest("#poov");const html=cslotHTML(p);CSLOTPO=false;
    if(s._html!==html){s.innerHTML=html;s._html=html}
  }
  wireFeed();
}
/* Focus the box without the browser yanking the page to it; if it's below
   the fold, glide it into view instead. */
function focusDraft(){
  const d=$("#cdraft");if(!d)return;
  try{d.focus({preventScroll:true})}catch(e){d.focus()}
  const r=d.getBoundingClientRect();
  if(r.bottom>innerHeight-80||r.top<0)d.scrollIntoView({block:"center",behavior:mvReduced()?"auto":"smooth"});
}
/* A post's comment count, on every copy of it (card, opened post, profile). */
function bumpComments(id,by){for(const p of likeCopies(id))p.commentCount=Math.max(0,(p.commentCount||0)+by)}
