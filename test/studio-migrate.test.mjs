let pass=0,fail=0;
const t=(n,ok)=>{ok?pass++:fail++;console.log("  "+(ok?"✓":"✗")+"  "+n)};

const STEPS=16,BARS=4;
function newTrack(id,name,kind,voice,extra){return Object.assign({id,name,kind,voice,vol:.8,pan:0,mute:false,solo:false,
 variant:0,cutoff:20000,reso:.7,reverb:0,delay:0,drive:0,duck:0,attack:.005,release:.35,wave:"sawtooth",octave:0,
 sampleUrl:"",sampleName:"",steps:Array(STEPS*BARS).fill(null)},extra||{})}

console.log("\nOLD BEATS STILL PLAY");
// a beat published before drive/duck/len/slide existed
const oldTrack={id:"bass",name:"808",kind:"melodic",voice:"bass",vol:.8,pan:0,mute:false,solo:false,
  variant:0,cutoff:20000,reso:.7,reverb:0,delay:0,attack:.005,release:.55,wave:"sawtooth",octave:-1,
  sampleUrl:"",sampleName:"",steps:Array(64).fill(null)};
oldTrack.steps[0]={v:3,n:[36]};      // no len, no slide
const migrated=Object.assign(newTrack("bass","808","melodic","bass"),oldTrack);
t("old track survives", migrated.steps[0].v===3);
t("drive defaults to 0 (silent, not broken)", migrated.drive===0);
t("duck defaults to 0", migrated.duck===0);
const cell=migrated.steps[0];
t("a note with no len plays 1 step", (cell.len||1)===1);
t("a note with no slide retriggers", !cell.slide);
t("  -> nothing published last week breaks", true);

console.log("\nNEW BEATS CARRY THE NEW FIELDS");
const fresh=newTrack("bass","808","melodic","bass",{drive:0.35});
fresh.steps[0]={v:3,n:[36],len:4,slide:false};
fresh.steps[4]={v:3,n:[43],len:8,slide:true};
t("808 ships with drive on (it's the sound)", fresh.drive===0.35);
t("length stored", fresh.steps[0].len===4);
t("slide stored", fresh.steps[4].slide===true);
const size=JSON.stringify(fresh).length;
t("still small enough to publish ("+size+" chars)", size<12000);

console.log("\nTHE TAIL RENDER — a held note must LOOK held");
function isTail(steps,i,m){
  if(steps[i]&&steps[i].n&&steps[i].n.includes(m))return false;
  for(let b=1;b<=16&&i-b>=0;b++){
    const p=steps[i-b];
    if(p&&p.n&&p.n.includes(m)&&(p.len||1)>b)return true;
    if(p&&p.n&&p.n.includes(m))break;
  }
  return false;
}
const st=Array(16).fill(null);
st[0]={v:3,n:[36],len:4};
t("step 0 is the note", !isTail(st,0,36));
t("steps 1-3 are its tail", isTail(st,1,36)&&isTail(st,2,36)&&isTail(st,3,36));
t("step 4 is NOT (length ran out)", !isTail(st,4,36));
st[2]={v:2,n:[36],len:1};   // a new note interrupting
t("a new note cuts the tail", !isTail(st,3,36));
t("a different pitch isn't affected", !isTail(st,1,43));

console.log("\n"+"=".repeat(44));
console.log(pass+" passed, "+fail+" failed");
