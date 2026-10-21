/* ================================================================
   SCREEN KIT v1.2 — 2026-10-20 (searchHTML, part 4; formHead, part 3)
   One set of parts for every screen, so the app reads as one thing
   (the admin got the same treatment the same day). Styles:
   app-05-styles-kit.css.

   screenHead  — the one line under the top bar: back · title · actions,
                 with an optional sentence under it. No screen stacks a
                 second bar or replaces the top bar.
   shareBtnHTML — the one Share: an outlined pill with the send icon.
   tabsHTML    — underline tabs for the sections of a screen. Filters
                 inside a section stay chips (.chip); never pills for
                 sections.
   rowHTML     — icon · label · value · chevron: menus, options, settings.
   searchHTML  — the one search field (grey, rounded, the search glyph).
   formHead    — a form's bar: quiet Cancel/‹ Back · title · the one action as a
                 small black pill (Edit profile, New post, New listing).
   Buttons:    .btn (the one main action per screen) · .btn.ghost
               (secondary, outlined) · .btn.quiet (text). Green is the
               nav's Post and the member's accent, not a button colour.
================================================================ */
function screenHead(o){
  const back=o.back?`<button class="sh-back" ${o.back.id?`id="${o.back.id}"`:""} ${o.back.attrs||""} aria-label="${esc(o.back.label||"Back")}">${DI.back}</button>`:"";
  const acts=(o.actions||[]).filter(Boolean);
  return `<div class="sh${o.back?" has-back":""}${o.cls?" "+o.cls:""}">
    <div class="sh-row">${back}
      <h2 class="sh-h">${o.mark?`<span class="lg">//</span> `:""}${o.raw?o.title:esc(o.title||"")}</h2>
      ${acts.length?`<div class="sh-acts">${acts.join("")}</div>`:""}
    </div>
    ${o.sub?`<p class="sh-sub">${o.rawSub?o.sub:esc(o.sub)}</p>`:""}
  </div>`;
}
const shareBtnHTML=(attrs="",label="Share")=>`<button class="btn ghost sm sh-share" ${attrs}>${IG_SEND}<span>${label}</span></button>`;
function tabsHTML(items,on,attr,cls=""){
  return `<div class="ktabs ${cls}" role="tablist">${items.map(([k,n,extra])=>`<button class="ktab ${on===k?"on":""}" role="tab" aria-selected="${on===k}" ${attr}="${k}">${n}${extra||""}</button>`).join("")}</div>`;
}
function rowHTML(r){
  const tag=r.href?"a":"button",at=r.href?`href="${esc(r.href)}" ${/^https?:/.test(r.href)?'target="_blank" rel="noopener"':""}`:'type="button"';
  return `<${tag} class="krow${r.cls?" "+r.cls:""}" ${at} ${r.attrs||""}>${r.icon?`<span class="krow-ic">${r.icon}</span>`:""}<span class="krow-b"><b>${esc(r.label)}</b>${r.sub?`<span>${esc(r.sub)}</span>`:""}</span>${r.value?`<span class="krow-v">${esc(r.value)}</span>`:""}${r.chev===false?"":`<span class="krow-go">${DI.chev}</span>`}</${tag}>`;
}
function formHead(left,title,right){
  const L=left?typeof left==="string"?left:`<button class="kf-b" ${left.id?`id="${left.id}"`:""} ${left.attrs||""}>${left.back?`${DI.back}<span>Back</span>`:esc(left.label||"Cancel")}</button>`:"<span></span>";
  const R=right?typeof right==="string"?right:`<button class="btn sm" ${right.id?`id="${right.id}"`:""} ${right.attrs||""} ${right.disabled?"disabled":""}>${esc(right.label)}</button>`:"<span></span>";
  return `<header class="kform">${L}<b>${esc(title)}</b>${R}</header>`;
}
const searchHTML=(id,placeholder,value="",attrs="")=>`<label class="ksearch">${UI_IC.search}<input id="${id}" type="search" placeholder="${esc(placeholder)}" value="${esc(value||"")}" autocomplete="off" aria-label="${esc(placeholder)}" ${attrs}></label>`;
