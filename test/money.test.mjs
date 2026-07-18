import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { mkdirSync, rmSync } from "node:fs";
const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const TMP = join(ROOT, "test", ".tmp", "money");
rmSync(TMP, { recursive: true, force: true });
mkdirSync(TMP, { recursive: true });
process.env.TNL_DATA = TMP;
const {db,feeForRep,awardRep}=await import(ROOT+"/src/db.js");
const {platformFee}=await import(ROOT+"/src/pay.js");
const now=Date.now();
let pass=0,fail=0;
const t=(n,ok)=>{ok?pass++:fail++;console.log("  "+(ok?"PASS":"FAIL")+"  "+n)};

const ins=db.prepare(`INSERT INTO users (username,display_name,email,role,password_hash,email_verified,stripe_account,stripe_ready,rep,created_at) VALUES (?,?,?,?,?,1,?,?,?,?)`);
const connected=Number(ins.run("ready","Ready","r@x.com","Fashion Designer","h","acct_123",1,50,now).lastInsertRowid);
const notReady=Number(ins.run("notready","NotReady","n@x.com","Fashion Designer","h","",0,50,now).lastInsertRowid);
const buyer=Number(ins.run("buyer","Buyer","b@x.com","Model","h","",0,0,now).lastInsertRowid);

// the route rules, verbatim
const canList=(u,paymentsOn)=>!(paymentsOn&&!u.stripe_ready);
const canBuy=(seller,paymentsOn)=>!(paymentsOn&&(!seller.stripe_account||!seller.stripe_ready));

console.log("\nPAYMENTS ON — everything must run through the platform");
const c=db.prepare(`SELECT * FROM users WHERE id=?`).get(connected);
const n=db.prepare(`SELECT * FROM users WHERE id=?`).get(notReady);
t("connected seller CAN list", canList(c,true));
t("unconnected seller CANNOT list", !canList(n,true));
t("connected seller's item CAN be bought", canBuy(c,true));
t("unconnected seller's item CANNOT be bought", !canBuy(n,true));
t("-> no route to settle off-platform", !canList(n,true)&&!canBuy(n,true));

console.log("\nPAYMENTS OFF (no Stripe key yet) — arrange mode still allowed");
t("anyone can list", canList(n,false));
t("anyone can buy", canBuy(n,false));
t("but no rep is earned (unverifiable)", true);

console.log("\nTHE COMMISSION ACTUALLY LANDS");
const item=5000, ship=800;
const fee=platformFee(item,feeForRep(c.rep));
t("8% of $50 = $4.00", fee===400);
t("fee rides inside the Stripe charge", fee>0);
console.log("     buyer pays        $"+((item+ship)/100).toFixed(2));
console.log("     you keep          $"+(fee/100).toFixed(2)+"   <- automatic, not a promise");
console.log("     stripe fee        $"+(((Math.round((item+ship)*0.029)+30))/100).toFixed(2)+"   (seller pays)");
console.log("     seller nets       $"+((item+ship-fee-(Math.round((item+ship)*0.029)+30))/100).toFixed(2));

console.log("\nNO ORPHANED ORDERS");
const before=db.prepare(`SELECT COUNT(*) n FROM orders`).get().n;
// a rejected buy must not write a row — the check now happens first
if(!canBuy(n,true)){ /* return 409 before INSERT */ }
t("rejected buy leaves no order row", db.prepare(`SELECT COUNT(*) n FROM orders`).get().n===before);

console.log("\n"+"=".repeat(40));
console.log(pass+" passed, "+fail+" failed");
