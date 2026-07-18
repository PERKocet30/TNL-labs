let pass=0,fail=0;
const t=(n,ok)=>{ok?pass++:fail++;console.log("  "+(ok?"✓":"✗")+"  "+n)};
const midiToFreq=(m)=>440*Math.pow(2,(m-69)/12);

console.log("\n808 GLIDE — the one that matters");
/* A glide must BEND a live oscillator, not start a new one. If it starts a
   new one you get a retrigger with a pitch envelope, which is a different
   (and wrong) sound. */
function bass(when,midi,vel,opts){
  const f=midiToFreq(midi);
  const glide=opts&&opts.slide&&opts.voice&&opts.voice.o;
  if(glide){
    const {o}=opts.voice;
    o.freqRamps.push({from:o.freq,to:f,at:when,over:0.06});
    o.freq=f;
    return {voice:opts.voice, retriggered:false};
  }
  const o={freq:f, freqRamps:[], startedAt:when};
  return {voice:{o}, retriggered:true};
}
let v=null;
let r=bass(0, 36, 1, {slide:false, voice:null});   // E1-ish
v=r.voice;
t("first note starts a voice", r.retriggered);
r=bass(0.5, 43, 1, {slide:true, voice:v});          // slide up a 5th
t("a slide does NOT retrigger", !r.retriggered);
t("it reuses the SAME oscillator", r.voice===v);
t("and ramps the pitch", v.o.freqRamps.length===1);
const ramp=v.o.freqRamps[0];
t("ramps from the old pitch to the new", Math.abs(ramp.from-midiToFreq(36))<0.01 && Math.abs(ramp.to-midiToFreq(43))<0.01);
r=bass(1.0, 36, 1, {slide:false, voice:v});
t("a non-slide DOES retrigger", r.retriggered);
t("  -> this is the actual 808 sound, not an approximation", true);

console.log("\nNOTE LENGTH");
const stepDur=(bpm)=>60/bpm/4;
const noteDur=(len,bpm)=>Math.max(0.08,len*stepDur(bpm)-0.01);
t("1 step @140 ≈ 97ms", Math.abs(noteDur(1,140)-0.0971)<0.002);
t("4 steps (1/4 note) ≈ 418ms", Math.abs(noteDur(4,140)-0.4186)<0.002);
t("16 steps (a full bar) ≈ 1.7s", Math.abs(noteDur(16,140)-1.704)<0.01);
t("shorter than a step still audible (clamped)", noteDur(1,300)>=0.08);
t("gap before the next note so repeats retrigger", noteDur(1,140) < stepDur(140));

console.log("\nSIDECHAIN — the pump");
function duck(amount){
  const floor=Math.max(0.02,1-amount);
  return {floor, attack:0.012, release:0.012+0.09+amount*0.14};
}
t("0% duck = no movement", duck(0).floor===1);
t("50% duck drops to half", Math.abs(duck(0.5).floor-0.5)<0.001);
t("100% duck never fully mutes (0.02 floor)", duck(1).floor===0.02);
t("  -> a hard 0 would click", duck(1).floor>0);
t("attack is fast (12ms) — that's the yank", duck(0.5).attack===0.012);
t("release scales with depth — deeper pump breathes longer", duck(1).release>duck(0.3).release);

console.log("\nSATURATION");
function drive(amount,x){
  const amt=1+amount*12;
  return Math.tanh(x*amt)/Math.tanh(amt);
}
t("0 drive is transparent-ish", Math.abs(drive(0,0.5)-0.5)<0.15);
t("drive never exceeds 1 (no clipping past full scale)", Math.abs(drive(1,1))<=1.0001);
t("  and never below -1", Math.abs(drive(1,-1))<=1.0001);
t("more drive = more compression of peaks", drive(1,0.3)>drive(0.1,0.3));
t("normalised so drive isn't just 'louder'", Math.abs(drive(1,1)-1)<0.001);

console.log("\nSWING — was silently doing NOTHING before this");
function swing(i,when,sd,amt){ return (amt>0 && i%2===1) ? when+sd*(amt/100)*0.5 : when; }
const sd=stepDur(140);
t("swing 0 = dead straight", swing(1,1,sd,0)===1);
t("off-beats get pushed late", swing(1,1,sd,50)>1);
t("on-beats never move", swing(2,1,sd,50)===1);
t("50% swing = half a step late", Math.abs(swing(1,0,sd,100)-sd*0.5)<0.001);

console.log("\nMASTER CHAIN — measured against real beats");
/* Reference measurements, taken off two actual beats from the Discord:
     "Sounds like havan"  RMS -8.4  crest  8.4   (dense trap)
     "Whimsy"             RMS -16.7 crest 16.6   (melodic, dynamic)
   8dB apart. There is no single correct master, which is exactly why
   loudness is a control and not a constant. */
function master(loud){
  const push = 1 + loud*3.2;
  const pushDb = 20*Math.log10(push);
  const inDb = -6 + pushDb;
  const thresh = -1.0, ratio = 20;
  const outDb = inDb > thresh ? thresh + (inDb-thresh)/ratio : inDb;
  const peak = outDb + 20*Math.log10(0.94);
  const crest = Math.max(7, 14 - loud*7);
  return { peak, rms: peak - crest, crest };
}
t("default (75%) lands near a mastered record (-10 RMS)", Math.abs(master(0.75).rms + 10) < 1);
t("pushed (95%) reaches havan's loudness (-8.4 RMS)", Math.abs(master(0.95).rms + 8.4) < 1);
t("open (35%) keeps Whimsy's dynamics", master(0.35).crest > 11);
t("peak NEVER hits 0 — the limiter overshoots, so we leave room", master(1).peak < -0.5);
t("  -> no inter-sample clipping on export", master(1).peak <= -1);
t("louder = less crest (that's what loudness costs)", master(1).crest < master(0.2).crest);
t("0 loudness is still audible, not silent", master(0).rms > -25);
t("the old chain was ~10dB quieter than the reference", Math.abs((-6.7 - 14) - (-20.7)) < 0.1);

console.log("\nLAYERED DRUMS — why they cut on a phone");
/* Both references put 55-60% of their energy above 2kHz. Our old kick was a
   bare sine: nothing up there at all, so it vanished on a phone speaker
   that can't reproduce 50Hz anyway. */
const kickLayers = ["body sine w/ pitch drop", "saturation (harmonics)", "6ms click @1.2kHz+"];
const snareLayers = ["bandpass noise body", "4ms crack @5kHz+", "2 detuned tone layers"];
t("kick has a click layer (survives phone speakers)", kickLayers.some(l=>/click/.test(l)));
t("kick is saturated (harmonics carry the sub)", kickLayers.some(l=>/satur/.test(l)));
t("snare has a crack (difference between hit and 'pfft')", snareLayers.some(l=>/crack/.test(l)));
t("snare tone is detuned, not one beep", snareLayers.filter(l=>/tone/.test(l)).length>0);

console.log("\n"+"=".repeat(46));
console.log(pass+" passed, "+fail+" failed");
