/* Kind of member (2026-10-26): Collector, and onboarding shaped by roles. test/collector.test.mjs */
const COLLECTOR="Collector";
const KIND_MUSIC=["Producer","Beatmaker","Lyricist / Singer","Rapper","DJ","Audio Engineer","Musician"];
const KIND_FASHION=["Fashion Designer","Stylist","Tailor","Sneaker Customizer"];
function memberKind(roles){
  const r=(roles||[]).filter(Boolean);
  if(r.some(x=>KIND_MUSIC.includes(x)))return "music";
  if(r.some(x=>KIND_FASHION.includes(x)))return "fashion";
  if(r.length&&r.every(x=>x===COLLECTOR))return "collector";
  return "maker";
}
const myKind=()=>memberKind((GFLOW&&GFLOW.f&&GFLOW.f.roles&&GFLOW.f.roles.length)?GFLOW.f.roles:(ME&&ME.roles)||[]);
const KIND_COPY={
  collector:{photo:"So artists know who's behind the likes.",
    bioH:"What do you love?",bioP:"One line, under your name.",ph:"Collector. Posters, streetwear and late-night beats."},
  music:{photo:"So people know whose music this is.",
    bioH:"What do you make?",bioP:"One line, under your name.",ph:"Producer. Soul samples, 808s and late nights."},
  fashion:{photo:"So people know whose pieces these are.",
    bioH:"What do you make?",bioP:"One line, under your name.",ph:"Designer. Small runs, cut and sewn by hand."},
  maker:{photo:"So people know whose work this is.",
    bioH:"What do you make?",bioP:"One line, under your name.",ph:"Illustrator. Posters, zines and album art."},
};
const kindCopy=()=>KIND_COPY[myKind()]||KIND_COPY.maker;
function collectorCardHTML(on){
  return `<button class="gx-coll${on?" on":""}" data-collector aria-pressed="${on?"true":"false"}">
    <b>I'm here for the art</b><span>Collector</span></button>
    <div class="gx-or">or pick what you make</div>`;
}
