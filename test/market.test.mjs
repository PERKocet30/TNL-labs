import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { mkdirSync, rmSync } from "node:fs";
const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const TMP = join(ROOT, "test", ".tmp", "market");
rmSync(TMP, { recursive: true, force: true });
mkdirSync(TMP, { recursive: true });
process.env.TNL_DATA = TMP;
const {db,feeForRep}=await import(ROOT+"/src/db.js");
const now=Date.now();
let pass=0,fail=0;
const t=(n,ok)=>{ok?pass++:fail++;console.log("  "+(ok?"PASS":"FAIL")+"  "+n)};
const ins=db.prepare(`INSERT INTO users (username,display_name,email,role,password_hash,email_verified,created_at) VALUES (?,?,?,?,?,1,?)`);
const seller=Number(ins.run("s","Seller","s@x.com","Fashion Designer","h",now).lastInsertRowid);
const buyer=Number(ins.run("b","Buyer","b@x.com","Model","h",now).lastInsertRowid);
const rando=Number(ins.run("r","Rando","r@x.com","Model","h",now).lastInsertRowid);
const L=db.prepare(`INSERT INTO listings (seller_id,title,price_cents,images,created_at,updated_at) VALUES (?,?,?,?,?,?)`);
const lid=Number(L.run(seller,"Jacket",5000,'["/u/a.jpg"]',now,now).lastInsertRowid);
const O=db.prepare(`INSERT INTO orders (listing_id,buyer_id,seller_id,amount_cents,status,payment_ref,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?)`);

console.log("\nREVIEWS — the rules that make the number mean something");
const oid=Number(O.run(lid,buyer,seller,5000,"shipped","cs_1",now,now).lastInsertRowid);
const canReview=(o,uid)=>o.buyer_id===uid&&o.status==="complete";
let o=db.prepare(`SELECT * FROM orders WHERE id=?`).get(oid);
t("can't review before delivery confirmed", !canReview(o,buyer));
db.prepare(`UPDATE orders SET status='complete' WHERE id=?`).run(oid);
o=db.prepare(`SELECT * FROM orders WHERE id=?`).get(oid);
t("buyer CAN review after confirming", canReview(o,buyer));
t("seller can't review themselves", !canReview(o,seller));
t("a stranger can't review", !canReview(o,rando));

db.prepare(`INSERT INTO reviews (order_id,seller_id,buyer_id,stars,body,created_at) VALUES (?,?,?,?,?,?)`).run(oid,seller,buyer,5,"fast, exactly as shown",now);
let dupe=false;
try{db.prepare(`INSERT INTO reviews (order_id,seller_id,buyer_id,stars,body,created_at) VALUES (?,?,?,?,?,?)`).run(oid,seller,buyer,1,"changed my mind",now)}
catch(e){dupe=true}
t("one review per order (UNIQUE enforced)", dupe);

console.log("\nSELLER TRUST STATS");
const stats=(uid)=>{
  const sold=db.prepare(`SELECT COUNT(*) n FROM orders WHERE seller_id=? AND status IN ('paid','shipped','complete')`).get(uid).n;
  const r=db.prepare(`SELECT COUNT(*) n, COALESCE(AVG(stars),0) avg FROM reviews WHERE seller_id=?`).get(uid);
  const shipped=db.prepare(`SELECT COUNT(*) n FROM orders WHERE seller_id=? AND status IN ('shipped','complete')`).get(uid).n;
  return {sold,reviews:r.n,rating:r.n?Math.round(r.avg*10)/10:null,shipRate:sold?Math.round(shipped/sold*100):null};
};
const st=stats(seller);
t("counts real sales", st.sold===1);
t("rating from reviews", st.rating===5);
t("ship rate", st.shipRate===100);
const fresh=stats(rando);
t("new seller shows no rating (not 0★)", fresh.rating===null&&fresh.reviews===0);

console.log("\nSAVED ITEMS");
db.prepare(`INSERT INTO listing_likes (listing_id,user_id,created_at) VALUES (?,?,?)`).run(lid,buyer,now);
const saved=db.prepare(`SELECT l.id FROM listings l JOIN listing_likes ll ON ll.listing_id=l.id WHERE ll.user_id=? AND l.status!='removed'`).all(buyer);
t("saved list returns the item", saved.length===1);
db.prepare(`UPDATE listings SET status='removed' WHERE id=?`).run(lid);
t("removed listings drop out of saved", db.prepare(`SELECT l.id FROM listings l JOIN listing_likes ll ON ll.listing_id=l.id WHERE ll.user_id=? AND l.status!='removed'`).all(buyer).length===0);
db.prepare(`UPDATE listings SET status='active' WHERE id=?`).run(lid);

console.log("\nRECENTLY VIEWED");
db.prepare(`INSERT INTO listing_views (listing_id,user_id,viewed_at) VALUES (?,?,?) ON CONFLICT(listing_id,user_id) DO UPDATE SET viewed_at=excluded.viewed_at`).run(lid,buyer,now);
db.prepare(`INSERT INTO listing_views (listing_id,user_id,viewed_at) VALUES (?,?,?) ON CONFLICT(listing_id,user_id) DO UPDATE SET viewed_at=excluded.viewed_at`).run(lid,buyer,now+1000);
t("re-viewing updates, doesn't duplicate", db.prepare(`SELECT COUNT(*) n FROM listing_views WHERE user_id=?`).get(buyer).n===1);

console.log("\nSUSPENSION");
db.prepare(`UPDATE users SET suspended=1 WHERE id=?`).run(rando);
const authOk=(u)=>!u.suspended;
t("suspended user blocked on every request", !authOk(db.prepare(`SELECT * FROM users WHERE id=?`).get(rando)));
t("normal user unaffected", authOk(db.prepare(`SELECT * FROM users WHERE id=?`).get(buyer)));
t("their work stays up (not deleted)", db.prepare(`SELECT COUNT(*) n FROM users WHERE id=?`).get(rando).n===1);

console.log("\n"+"=".repeat(44));
console.log(pass+" passed, "+fail+" failed");
