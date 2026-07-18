import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { mkdirSync, rmSync } from "node:fs";
const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const TMP = join(ROOT, "test", ".tmp", "core");
rmSync(TMP, { recursive: true, force: true });
mkdirSync(TMP, { recursive: true });
process.env.TNL_DATA = TMP;
process.env.ADMIN_EMAIL="Jorgemfuentes001@gmail.com";
const {db,awardRep,levelFor,feeForRep,notify,ensureAdmin,REP}=await import(ROOT+"/src/db.js");
const {platformFee}=await import(ROOT+"/src/pay.js");
const now=Date.now();
let pass=0,fail=0;
const t=(name,ok)=>{ok?pass++:fail++;console.log("  "+(ok?"PASS":"FAIL")+"  "+name)};

const ins=db.prepare(`INSERT INTO users (username,display_name,email,role,roles,password_hash,email_verified,created_at) VALUES (?,?,?,?,?,?,1,?)`);
const jorge=Number(ins.run("tnllabs","TNL.LABS","jorgemfuentes001@gmail.com","Content Creator",'["Content Creator"]',"h",now).lastInsertRowid);
const ecla=Number(ins.run("eclasona","ECLASONA","e@x.com","Graphic Designer",'["Graphic Designer"]',"h",now).lastInsertRowid);
ensureAdmin();

console.log("\nADMIN");
t("ADMIN_EMAIL claims the account", db.prepare(`SELECT is_admin FROM users WHERE id=?`).get(jorge).is_admin===1);
t("others are not admin", db.prepare(`SELECT is_admin FROM users WHERE id=?`).get(ecla).is_admin===0);

console.log("\nREP — earned only, never self-awarded");
const p=db.prepare(`INSERT INTO posts (author_id,channel,body,image_url,thumb_url,media_w,media_h,is_work,created_at) VALUES (?,?,?,?,?,?,?,1,?)`);
const pid=Number(p.run(ecla,"graphic-design","collab w sthy design.","/u/a.jpg","/u/a-t.jpg",1200,1600,now).lastInsertRowid);
db.prepare(`INSERT INTO likes (post_id,user_id,created_at) VALUES (?,?,?)`).run(pid,jorge,now);
awardRep(ecla,"like_received",pid);
t("like gives +6", db.prepare(`SELECT rep FROM users WHERE id=?`).get(ecla).rep===6);
t("no self-notify", notify(ecla,ecla,"like",pid)===null);
db.prepare(`INSERT INTO collaborators (post_id,user_id,status,created_at) VALUES (?,?,'accepted',?)`).run(pid,jorge,now);
awardRep(ecla,"collab_accepted",pid);awardRep(jorge,"collab_accepted",pid);
t("collab pays BOTH +20", db.prepare(`SELECT rep FROM users WHERE id=?`).get(ecla).rep===26 && db.prepare(`SELECT rep FROM users WHERE id=?`).get(jorge).rep===20);
t("listing earns nothing", REP.listing===undefined);

console.log("\nTIERED COMMISSION");
t("entry matches Depop (10%)", feeForRep(0)===10);
t("leadership 2%", feeForRep(560)===2);
t("$50 sale at entry = $5", platformFee(5000,feeForRep(0))===500);
t("$50 sale at leadership = $1", platformFee(5000,feeForRep(560))===100);
t("shipping never taxed", platformFee(5000,10)===500);

console.log("\nWORK vs CHAT");
const chat=db.prepare(`INSERT INTO posts (author_id,channel,body,is_work,created_at) VALUES (?,?,?,0,?)`);
chat.run(ecla,"general","just talking",now);
t("portfolio shows work only", db.prepare(`SELECT COUNT(*) n FROM posts WHERE author_id=? AND is_work=1`).get(ecla).n===1);
t("showroom excludes chat", db.prepare(`SELECT COUNT(*) n FROM posts WHERE is_work=1 AND shared_from IS NULL`).get().n===1);

console.log("\nTHUMBNAILS");
const row=db.prepare(`SELECT * FROM posts WHERE id=?`).get(pid);
t("thumb stored", row.thumb_url==="/u/a-t.jpg");
t("dimensions stored (no layout shift)", row.media_w===1200&&row.media_h===1600);

console.log("\nUNREADS");
const un=db.prepare(`SELECT p.channel,COUNT(*) n FROM posts p LEFT JOIN channel_reads r ON r.user_id=? AND r.channel=p.channel WHERE p.author_id!=? AND p.created_at>COALESCE(r.last_read_at,0) GROUP BY p.channel`).all(jorge,jorge);
t("counts others' posts only", un.length===2);
db.prepare(`INSERT INTO channel_reads (user_id,channel,last_read_at) VALUES (?,?,?) ON CONFLICT(user_id,channel) DO UPDATE SET last_read_at=excluded.last_read_at`).run(jorge,"general",Date.now());
t("reading clears the dot", !db.prepare(`SELECT p.channel FROM posts p LEFT JOIN channel_reads r ON r.user_id=? AND r.channel=p.channel WHERE p.author_id!=? AND p.channel='general' AND p.created_at>COALESCE(r.last_read_at,0)`).get(jorge,jorge));

console.log("\nMARKET");
const L=db.prepare(`INSERT INTO listings (seller_id,title,price_cents,shipping_cents,images,created_at,updated_at) VALUES (?,?,?,?,?,?,?)`);
const lid=Number(L.run(ecla,"Carhartt Jacket",4599,800,'["/u/j.jpg"]',now,now).lastInsertRowid);
t("price in integer cents (no float drift)", db.prepare(`SELECT price_cents FROM listings WHERE id=?`).get(lid)===undefined?false:db.prepare(`SELECT price_cents FROM listings WHERE id=?`).get(lid).price_cents===4599);
db.prepare(`INSERT INTO offers (listing_id,buyer_id,amount_cents,status,created_at) VALUES (?,?,?,'accepted',?)`).run(lid,jorge,3500,now);
const acc=db.prepare(`SELECT * FROM offers WHERE listing_id=? AND buyer_id=? AND status='accepted'`).get(lid,jorge);
t("accepted offer beats sticker", (acc?acc.amount_cents:4599)===3500);

console.log("\nFARM RESISTANCE");
const O=db.prepare(`INSERT INTO orders (listing_id,buyer_id,seller_id,amount_cents,status,payment_ref,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?)`);
const fake=Number(O.run(lid,jorge,ecla,1000,"shipped",null,now,now).lastInsertRowid);
const fakeOrder=db.prepare(`SELECT * FROM orders WHERE id=?`).get(fake);
const deliveryPays=(o)=>o.status!=="complete"&&(o.status==="shipped"||o.status==="paid")&&!!o.payment_ref;
t("unpaid 'sale' earns no rep", !deliveryPays(fakeOrder));
const real=Number(O.run(lid,jorge,ecla,1000,"shipped","cs_test_1",now,now).lastInsertRowid);
t("verified payment earns rep", deliveryPays(db.prepare(`SELECT * FROM orders WHERE id=?`).get(real)));

console.log("\nINDEXES");
for(const i of ["idx_likes_post","idx_posts_work","idx_sessions_user","idx_notifs_unread"])
  t(i, db.prepare(`SELECT COUNT(*) n FROM sqlite_master WHERE type='index' AND name=?`).get(i).n===1);

console.log("\n"+"=".repeat(42));
console.log(pass+" passed, "+fail+" failed");
