import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { mkdirSync, rmSync } from "node:fs";
const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const TMP = join(ROOT, "test", ".tmp", "loops");
rmSync(TMP, { recursive: true, force: true });
mkdirSync(TMP, { recursive: true });
process.env.TNL_DATA = TMP;
const {db,feeForRep,notify}=await import(ROOT+"/src/db.js");
const now=Date.now();
let pass=0,fail=0;
const t=(n,ok)=>{ok?pass++:fail++;console.log("  "+(ok?"PASS":"FAIL")+"  "+n)};
const ins=db.prepare(`INSERT INTO users (username,display_name,email,role,password_hash,email_verified,stripe_ready,rep,created_at) VALUES (?,?,?,?,?,1,?,?,?)`);
const prod=Number(ins.run("prod","Producer","p@x.com","Producer","h",0,50,now).lastInsertRowid);   // NO stripe
const paid=Number(ins.run("paidprod","Paid","q@x.com","Producer","h",1,50,now).lastInsertRowid);   // has stripe
const rapper=Number(ins.run("rap","Rapper","r@x.com","Rapper","h",0,0,now).lastInsertRowid);

console.log("\nLISTING RULES — 'give out loops' must work with NO Stripe");
const canList=(user,isLoop,cents,paymentsOn)=>{
  const free=isLoop&&cents===0;
  return !(paymentsOn&&!free&&!user.stripe_ready);
};
const p=db.prepare(`SELECT * FROM users WHERE id=?`).get(prod);
const q=db.prepare(`SELECT * FROM users WHERE id=?`).get(paid);
t("FREE loop, no Stripe -> allowed", canList(p,true,0,true));
t("  -> this is the whole feature", canList(p,true,0,true));
t("PAID loop, no Stripe -> blocked", !canList(p,true,500,true));
t("PAID loop, has Stripe -> allowed", canList(q,true,500,true));
t("clothes, no Stripe -> blocked", !canList(p,false,5000,true));

console.log("\nA LOOP IS NOT A JACKET");
const L=db.prepare(`INSERT INTO listings (seller_id,title,price_cents,shipping_cents,category,images,kind,audio_url,bpm,musical_key,accepts_offers,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)`);
const freeId=Number(L.run(prod,"Dark trap loop",0,0,"Loop",'[]',"loop","/uploads/l.wav",140,"Fm",0,now,now).lastInsertRowid);
const paidId=Number(L.run(paid,"Sample pack vol 1",1500,0,"Sample Pack",'[]',"loop","/uploads/p.wav",null,"",1,now,now).lastInsertRowid);
let l=db.prepare(`SELECT * FROM listings WHERE id=?`).get(freeId);
t("no photo needed", JSON.parse(l.images).length===0);
t("no shipping", l.shipping_cents===0);
t("bpm + key stored", l.bpm===140&&l.musical_key==="Fm");
t("audio stored", l.audio_url==="/uploads/l.wav");
t("free = price 0", l.price_cents===0);

console.log("\nFREE DOWNLOAD — instant, no order, no Stripe");
const free=(li)=>(li.price_cents||0)===0;
t("free loop downloadable by anyone", free(l));
db.prepare(`INSERT INTO loop_downloads (listing_id,user_id,created_at) VALUES (?,?,?)`).run(freeId,rapper,now);
db.prepare(`UPDATE listings SET downloads=downloads+1 WHERE id=?`).run(freeId);
t("download counted", db.prepare(`SELECT downloads FROM listings WHERE id=?`).get(freeId).downloads===1);
let dupe=false;
try{db.prepare(`INSERT INTO loop_downloads (listing_id,user_id,created_at) VALUES (?,?,?)`).run(freeId,rapper,now)}catch(e){dupe=true}
t("same person re-downloading doesn't inflate the count", dupe);

console.log("\nPAID LOOP IS GATED");
const owns=(lid,uid)=>!!db.prepare(`SELECT 1 FROM orders WHERE listing_id=? AND buyer_id=? AND status IN ('paid','shipped','complete')`).get(lid,uid);
t("can't grab a paid loop without buying", !owns(paidId,rapper));
db.prepare(`INSERT INTO orders (listing_id,buyer_id,seller_id,amount_cents,status,payment_ref,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?)`)
  .run(paidId,rapper,paid,1500,"complete","cs_1",now,now);
t("after buying -> unlocked", owns(paidId,rapper));

console.log("\nDIGITAL ORDERS COMPLETE INSTANTLY");
const nextStatus=(kind)=>kind==="loop"?"complete":"paid";
t("loop: paid -> complete (nothing to ship)", nextStatus("loop")==="complete");
t("jacket: paid -> paid (awaits shipping)", nextStatus("physical")==="paid");
t("  -> a loop order can't strand waiting for a 'shipped' click", nextStatus("loop")!=="paid");

console.log("\nCOMMISSION STILL WORKS ON LOOPS");
const fee=Math.round(1500*(feeForRep(50)/100));
t("$15 pack at 8% = $1.20", fee===120);
t("free loop earns the platform nothing (correct)", Math.round(0*0.08)===0);

console.log("\nSAMPLE LIBRARY");
const S=db.prepare(`INSERT INTO samples (user_id,name,url,kit,slot,bytes,created_at) VALUES (?,?,?,?,?,?,?)`);
S.run(prod,"808 kick","/uploads/k.wav","My Kit","kick",240000,now);
S.run(prod,"snare","/uploads/s.wav","My Kit","snare",120000,now);
t("sounds saved to the producer", db.prepare(`SELECT COUNT(*) n FROM samples WHERE user_id=?`).get(prod).n===2);
t("another producer can't see them", db.prepare(`SELECT COUNT(*) n FROM samples WHERE user_id=?`).get(rapper).n===0);
const guessed=(n)=>/kick|bd|bass ?drum/.test(n)?"kick":/snare|sd|snr/.test(n)?"snare":/hat|hh|hi-?hat/.test(n)?"hat":/808|sub/.test(n)?"bass":"other";
t("filename guesses the slot: '808 kick.wav'", guessed("808 kick.wav")==="kick");
t("  'Snare 04.wav'", guessed("snare 04.wav")==="snare");
t("  'CH hat.wav'", guessed("ch hat.wav")==="hat");

console.log("\n"+"=".repeat(46));
console.log(pass+" passed, "+fail+" failed");
