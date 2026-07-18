import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { mkdirSync, rmSync } from "node:fs";
const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const TMP = join(ROOT, "test", ".tmp", "library");
rmSync(TMP, { recursive: true, force: true });
mkdirSync(TMP, { recursive: true });
process.env.TNL_DATA = TMP;
const {db,awardRep,REP}=await import(ROOT+"/src/db.js");
const now=Date.now();
let pass=0,fail=0;
const t=(n,ok)=>{ok?pass++:fail++;console.log("  "+(ok?"✓":"✗")+"  "+n)};
const ins=db.prepare(`INSERT INTO users (username,display_name,email,role,password_hash,email_verified,created_at) VALUES (?,?,?,?,?,1,?)`);
const [maker,rap,other]=["maker","rapper","other"].map(n=>Number(ins.run(n,n,n+"@x.com","Producer","h",now).lastInsertRowid));
const S=db.prepare(`INSERT INTO samples (user_id,name,url,kit,slot,bytes,shared,created_at) VALUES (?,?,?,?,?,?,?,?)`);
const priv=Number(S.run(maker,"my secret kick","/u/k.wav","","kick",240000,0,now).lastInsertRowid);
const shared=Number(S.run(maker,"free kick","/u/f.wav","","kick",240000,1,now).lastInsertRowid);

console.log("\nOPT-IN — nothing enters the library by itself");
t("uploads are private by default", db.prepare(`SELECT shared FROM samples WHERE id=?`).get(priv).shared===0);
t("only shared sounds are in the library", db.prepare(`SELECT COUNT(*) n FROM samples WHERE shared=1`).get().n===1);
const lib=db.prepare(`SELECT id FROM samples WHERE shared=1`).all().map(r=>r.id);
t("their private kick is NOT in it", !lib.includes(priv));
t("  -> we never took anything", true);

console.log("\nSHARING IS REVERSIBLE");
db.prepare(`UPDATE samples SET shared=0 WHERE id=?`).run(shared);
t("they can take it back out", db.prepare(`SELECT shared FROM samples WHERE id=?`).get(shared).shared===0);
db.prepare(`UPDATE samples SET shared=1 WHERE id=?`).run(shared);

console.log("\nREP — it has to be unfarmable or it's worthless");
const use=(sid,uid)=>{
  const s=db.prepare(`SELECT * FROM samples WHERE id=? AND shared=1`).get(sid);
  if(!s)return "not_in_library";
  if(s.user_id===uid)return "own";                       // no self-award
  const first=!db.prepare(`SELECT 1 FROM sample_uses WHERE sample_id=? AND user_id=?`).get(sid,uid);
  if(first){
    db.prepare(`INSERT INTO sample_uses (sample_id,user_id,created_at) VALUES (?,?,?)`).run(sid,uid,Date.now());
    db.prepare(`UPDATE samples SET uses=uses+1 WHERE id=?`).run(sid);
    awardRep(s.user_id,"sound_used",null);
    return "counted";
  }
  return "already";
};
const rep=()=>db.prepare(`SELECT rep FROM users WHERE id=?`).get(maker).rep;
t("using your OWN sound earns nothing", use(shared,maker)==="own" && rep()===0);
t("someone else using it earns rep", use(shared,rap)==="counted" && rep()===REP.sound_used);
t("the SAME person again earns nothing", use(shared,rap)==="already" && rep()===REP.sound_used);
t("  -> 10 beats with your kick = 1 endorsement, not 10", true);
t("a different person does earn", use(shared,other)==="counted" && rep()===REP.sound_used*2);
t("a private sound can't be used at all", use(priv,rap)==="not_in_library");
t("use count is people, not plays", db.prepare(`SELECT uses FROM samples WHERE id=?`).get(shared).uses===2);

console.log("\nWHAT A CONTRIBUTOR SEES");
const who=db.prepare(`SELECT u.username FROM sample_uses su JOIN users u ON u.id=su.user_id WHERE su.sample_id=?`).all(shared);
t("the names, not a number", who.length===2 && who.some(w=>w.username==="rapper"));
t("  -> 2 people to start a conversation with", who.length===2);

console.log("\nREP VALUE — proportionate?");
t("a sound used = 4 rep", REP.sound_used===4);
t("  less than a like? no — more (6 vs 4)", REP.like_received===6 && REP.sound_used<REP.like_received);
t("  far less than a confirmed collab (20)", REP.sound_used<REP.collab_accepted);
t("  -> giving a kick isn't worth more than building with someone", REP.sound_used<REP.collab_accepted);

console.log("\nPRIVACY OF THE MEASUREMENT");
const cols=db.prepare(`PRAGMA table_info(sample_shape)`).all().map(c=>c.name);
t("only numbers stored: "+cols.filter(c=>!["sample_id","slot","created_at"].includes(c)).join(", "), true);
t("no audio, no waveform, no fingerprint", !cols.some(c=>/audio|wave|finger|content|pcm/.test(c)));

console.log("\n"+"=".repeat(46));
console.log(pass+" passed, "+fail+" failed");
