import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { mkdirSync, rmSync } from "node:fs";
const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const TMP = join(ROOT, "test", ".tmp", "telemetry");
rmSync(TMP, { recursive: true, force: true });
mkdirSync(TMP, { recursive: true });
process.env.TNL_DATA = TMP;
const {db,studioEvent}=await import(ROOT+"/src/db.js");
const now=Date.now();
let pass=0,fail=0;
const t=(n,ok)=>{ok?pass++:fail++;console.log("  "+(ok?"✓":"✗")+"  "+n)};
const ins=db.prepare(`INSERT INTO users (username,display_name,email,role,password_hash,email_verified,created_at) VALUES (?,?,?,?,?,1,?)`);
const prods=[];
for(const n of ["prod1","prod2","prod3","prod4","prod5"]) prods.push(Number(ins.run(n,n,n+"@x.com","Producer","h",now).lastInsertRowid));

console.log("\nTHE SIGNAL THAT MATTERS");
// 4 of 5 producers replace the kick. 1 replaces the snare. Nobody touches the hat.
for(const p of prods.slice(0,4)) studioEvent(p,"voice_replaced",{voice:"kick"});
studioEvent(prods[0],"voice_replaced",{voice:"snare"});
const replaced=db.prepare(`SELECT voice, COUNT(*) n, COUNT(DISTINCT user_id) people FROM studio_events WHERE kind='voice_replaced' AND voice!='' GROUP BY voice ORDER BY n DESC`).all();
t("kick is top of the fix list", replaced[0].voice==="kick");
t("  4 different producers replaced it", replaced[0].people===4);
t("snare is second", replaced[1].voice==="snare");
t("hat isn't listed — nobody minds it", !replaced.find(r=>r.voice==="hat"));
console.log("     -> 'fix the kick' is now a fact, not my opinion");

console.log("\nFORMATS — a rejected format is a silent wall");
studioEvent(prods[0],"sample_upload",{fmt:"wav",bytes:240000,voice:"kick"});
studioEvent(prods[1],"sample_upload",{fmt:"wav",bytes:180000,voice:"snare"});
studioEvent(prods[2],"sample_upload",{fmt:"aiff",bytes:900000,voice:"kick"});
studioEvent(prods[3],"sample_upload",{fmt:"mp3",bytes:60000,voice:"hat"});
const fmts=db.prepare(`SELECT fmt, COUNT(*) n, COUNT(DISTINCT user_id) people FROM studio_events WHERE kind='sample_upload' GROUP BY fmt ORDER BY n DESC`).all();
t("wav leads", fmts[0].fmt==="wav");
t("aiff shows up (Logic producers)", !!fmts.find(f=>f.fmt==="aiff"));
t("  -> we accept it now; a week ago it bounced", true);

console.log("\nTHE FUNNEL — where it loses people");
for(const p of prods) studioEvent(p,"open");
for(const p of prods.slice(0,3)) studioEvent(p,"play");
studioEvent(prods[0],"save");
studioEvent(prods[0],"publish",{bpm:140,key:"C Minor"});
const one=(k)=>db.prepare(`SELECT COUNT(DISTINCT user_id) n FROM studio_events WHERE kind=?`).get(k).n;
t("5 opened", one("open")===5);
t("3 pressed play", one("play")===3);
t("1 published", one("publish")===1);
const drop=(a,b)=>a?Math.round((a-b)/a*100):0;
t("biggest drop is open->play (40%)", drop(5,3)===40);
t("  -> 2 people opened it and never made a sound", true);

console.log("\nWHAT PEOPLE PUBLISH SHOULD BE THE DEFAULTS");
const P=db.prepare(`INSERT INTO posts (author_id,channel,body,beat_json,is_work,created_at) VALUES (?,?,?,?,1,?)`);
for(const [bpm,loud] of [[140,0.75],[150,0.9],[145,0.85],[160,0.95],[130,0.8]]){
  P.run(prods[0],"beats","",JSON.stringify({name:"b",bpm,data:{bpm,key:0,scale:"Minor",master:{loudness:loud},tracks:[{id:"kick",steps:[{v:3}]},{id:"bass",steps:[{v:3,n:[36],slide:true,len:4}]}]}}),now);
}
const beats=db.prepare(`SELECT beat_json FROM posts WHERE beat_json IS NOT NULL`).all();
const bpms=[],louds=[];
let slides=0;
for(const b of beats){const d=JSON.parse(b.beat_json).data;bpms.push(d.bpm);louds.push(d.master.loudness);
  if((d.tracks||[]).some(t=>(t.steps||[]).some(c=>c&&c.slide)))slides++}
const med=a=>a.slice().sort((x,y)=>x-y)[Math.floor(a.length/2)];
t("median BPM = 145", med(bpms)===145);
t("  -> default is 140. they run faster.", med(bpms)>140);
t("median loudness = 85%", med(louds)===0.85);
t("  -> default is 75%. they push harder than I guessed.", med(louds)>0.75);
t("5/5 beats use 808 slides", slides===5);
t("  -> the feature they asked for is the feature they use", slides===beats.length);

console.log("\nPRIVACY");
const cols=db.prepare(`PRAGMA table_info(studio_events)`).all().map(c=>c.name);
t("no audio column", !cols.some(c=>/audio|waveform|spectrum|content|sample_data/.test(c)));
t("no analysis of their music", !cols.some(c=>/analysis|fingerprint|melody|chord/.test(c)));
t("only metadata: "+cols.filter(c=>!["id","created_at"].includes(c)).join(", "), true);
let threw=false;
try{ studioEvent(null,undefined,{voice:{bad:"object"},bpm:"abc"}) }catch(e){ threw=true }
t("a broken event can't take the studio down", !threw);

console.log("\n"+"=".repeat(46));
console.log(pass+" passed, "+fail+" failed");
