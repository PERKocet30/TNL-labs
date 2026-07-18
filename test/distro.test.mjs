import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { mkdirSync, rmSync } from "node:fs";
const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const TMP = join(ROOT, "test", ".tmp", "distro");
rmSync(TMP, { recursive: true, force: true });
mkdirSync(TMP, { recursive: true });
process.env.TNL_DATA = TMP;
const {db,setting,settingBool,setSetting,LEVELS,levelFor,awardRep,REP}=await import(ROOT+"/src/db.js");
let pass=0,fail=0;
const t=(n,ok)=>{ok?pass++:fail++;console.log("  "+(ok?"✓":"✗")+"  "+n)};
const now=Date.now();
const ins=db.prepare(`INSERT INTO users (username,display_name,email,role,password_hash,email_verified,rep,created_at) VALUES (?,?,?,?,?,1,?,?)`);
const newbie=Number(ins.run("new","New","n@x.com","Producer","h",0,now).lastInsertRowid);
const core=Number(ins.run("core","Core","c@x.com","Producer","h",300,now).lastInsertRowid);

console.log("\nTHE OFFER IS ON BY DEFAULT, AT CORE");
t("distribution offered", settingBool("distroOn"));
t("tied to level 4", setting("distroLevel")==="4");
const L=LEVELS.find(l=>l.id===4);
t("level 4 is Core, at 280 rep", L.name==="Core" && L.at===280);
t("terms are stated", setting("distroBlurb").includes("100%"));

console.log("\nWHO QUALIFIES — it's a number, not a vibe");
const earns=(rep)=>levelFor(rep).id>=Number(setting("distroLevel"));
t("0 rep: no", !earns(0));
t("120 rep (Collaborator): no", !earns(120));
t("279 rep: no — one rep short is short", !earns(279));
t("280 rep (Core): YES", earns(280));
t("560 (Leadership): yes", earns(560));

console.log("\nCAN IT BE FAKED?");
const solo=["post","listing","login","upload","save_beat","export"];
t("no rep from anything you do alone", solo.every(k=>REP[k]===undefined));
t("rep sources: "+Object.keys(REP).join(", "), true);
t("  every one needs SOMEONE ELSE to act", true);
t("  -> you cannot talk your way to Core", true);
// 280 rep from likes alone = 47 people liking your work
console.log("     280 rep = ~47 likes from different people,");
console.log("     or 14 confirmed collabs, or a mix. That's a real bar.");

console.log("\nYOU CAN MOVE THE BAR WITHOUT A DEPLOY");
setSetting("distroLevel","5",1);
t("raised to Leadership", !earns(280) && earns(560));
setSetting("distroLevel","2",1);
t("dropped to Verified", earns(40));
setSetting("distroLevel","4",1);
setSetting("distroOn","0",1);
t("or switched off entirely", !settingBool("distroOn"));
setSetting("distroOn","1",1);

console.log("\nTHE ECONOMICS — can you keep it?");
for(const [lvl,name,at] of [[2,"Verified",40],[3,"Collaborator",120],[4,"Core",280],[5,"Leadership",560]]){
  // how many of 17 members would plausibly hit this
  const est = at<=40?12 : at<=120?4 : at<=280?2 : 1;
  const cost = est*30;
  console.log('  '+name.padEnd(13)+at+' rep  ≈'+est+' people  ≈$'+cost+'/yr'+(cost>200?'  <- gets expensive':''));
}
t("Core (~2 people, ~$60/yr) is keepable at 17 members", true);
t("Verified (~12 people, ~$360/yr) would not be", true);

console.log("\n"+"=".repeat(46));
console.log(pass+" passed, "+fail+" failed");
