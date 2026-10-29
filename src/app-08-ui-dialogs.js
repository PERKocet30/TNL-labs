/* DIALOGS v2.0 — 2026-10-29. "Get rid of any text or edit bubbles — UI should feel more modern, like
   Instagram or Spotify." No native prompt()/confirm()/alert() anywhere; each of these resolves a Promise.
   • Typing something (uiPrompt) opens an edit screen the way Instagram does: Cancel · title · Done
     across the top, a plain full-width field under it, no pill box. Full screen on a phone (so the
     keyboard never covers it), a centred panel from 620px.
   • Asking (uiConfirm / uiAlert) is never a pop-up in the middle: a sheet rises from the bottom with
     the choices stacked as full-width rows (v2.1 — "those pop-ups shouldn't exist"). Centred only on a computer.
   Classes .ui-ov / .ui-card / .ui-in / .ui-ok / .ui-cancel stay — the tap-through and other parts use them.
   Styles: app-05-styles-dialogs.css. Moved here from app-08-state-ui.js (v1). */
function uiModal({title,body,fields,okLabel="Confirm",cancelLabel="Cancel",danger=false,okOnly=false}){
  return new Promise(resolve=>{
    const edit=!!(fields&&fields.length);
    const ov=document.createElement("div");ov.className="ui-ov"+(edit?" ui-editov":" ui-alertov");
    const ins=(fields||[]).map((f,i)=>`<input class="ui-in" data-uif="${i}" type="${f.type||"text"}" inputmode="${f.inputmode||"text"}" placeholder="${esc(f.placeholder||"")}" value="${esc(f.value||"")}" autocomplete="off" enterkeyhint="done">`).join("");
    const cancel=okOnly?"":`<button class="ui-btn ui-cancel">${esc(cancelLabel)}</button>`;
    const ok=`<button class="ui-btn ui-ok ${danger?"ui-danger":""}">${esc(okLabel)}</button>`;
    ov.innerHTML=edit
      ?`<div class="ui-card ui-edit" role="dialog" aria-modal="true" aria-label="${esc(title||"")}">
          <div class="ui-ehead">${cancel||"<span></span>"}<div class="ui-title">${esc(title||"")}</div>${ok}</div>
          <div class="ui-ebody">${ins}${body?`<div class="ui-body">${esc(body)}</div>`:""}</div></div>`
      :`<div class="ui-card ui-alert" role="dialog" aria-modal="true">
          <div class="ui-atext"><div class="ui-title">${esc(title||"")}</div>${body?`<div class="ui-body">${esc(body)}</div>`:""}</div>
          <div class="ui-btns">${ok}${cancel}</div></div>`;
    document.body.appendChild(ov);
    const inEls=[...ov.querySelectorAll("[data-uif]")];
    /* Focus lands inside, so Escape / Enter work on a computer even with no field. */
    setTimeout(()=>{if(inEls[0]){inEls[0].focus();inEls[0].select&&inEls[0].select()}else ov.querySelector(".ui-ok").focus({preventScroll:true})},50);
    const done=v=>{ov.remove();resolve(v)};
    ov.querySelector(".ui-cancel")?.addEventListener("click",()=>done(okOnly?true:null));
    ov.querySelector(".ui-ok").addEventListener("click",()=>done(inEls.length?inEls.map(i=>i.value):true));
    ov.addEventListener("click",e=>{if(e.target===ov)done(okOnly?true:null)});
    ov.addEventListener("keydown",e=>{if(e.key==="Escape")done(okOnly?true:null);if(e.key==="Enter"&&inEls.length<=1){e.preventDefault();ov.querySelector(".ui-ok").click()}});
  });
}
const uiConfirm=(title,body,o={})=>uiModal({title,body,okLabel:o.okLabel||"Confirm",cancelLabel:o.cancelLabel||"Cancel",danger:!!o.danger}).then(v=>v===true);
const uiAlert=(title,body)=>uiModal({title,body,okOnly:true,okLabel:"OK"});
const uiPrompt=(title,o={})=>uiModal({title,body:o.body,fields:[{placeholder:o.placeholder,value:o.value,type:o.type,inputmode:o.inputmode}],okLabel:o.okLabel||"Done",cancelLabel:o.cancelLabel||"Cancel"}).then(v=>Array.isArray(v)?v[0]:null);
