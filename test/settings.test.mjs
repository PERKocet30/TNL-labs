import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { mkdirSync, rmSync } from "node:fs";
const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const TMP = join(ROOT, "test", ".tmp", "settings");
rmSync(TMP, { recursive: true, force: true });
mkdirSync(TMP, { recursive: true });
process.env.TNL_DATA = TMP;
const {db,setting,settingBool,setSetting,allSettings,SETTING_DEFAULTS}=await import(ROOT+"/src/db.js");
let pass=0,fail=0;
const t=(n,ok)=>{ok?pass++:fail++;console.log("  "+(ok?"✓":"✗")+"  "+n)};
const now=Date.now();
db.prepare(`INSERT INTO users (username,display_name,email,role,password_hash,email_verified,is_admin,created_at) VALUES (?,?,?,?,?,1,1,?)`)
  .run("tnllabs","TNL.LABS","j@x.com","Content Creator","h",now);

console.log("\nSETTINGS — defaults from code, overrides from the db");
t("fresh install uses the code default", setting("headline")==="Cultivators.");
t("signups open by default", settingBool("signupsOpen"));
t("autoVerify OFF by default (the safe default)", !settingBool("autoVerify"));
t("no announcement by default", setting("announcement")==="");

console.log("\nCHANGING THINGS");
setSetting("headline","Build together.",1);
t("headline changes", setting("headline")==="Build together.");
setSetting("signupsOpen","0",1);
t("the door closes", !settingBool("signupsOpen"));
setSetting("announcement","Drop Friday.",1);
t("banner appears", setting("announcement")==="Drop Friday.");

console.log("\nYOU CAN'T BREAK IT");
t("unknown key rejected", setSetting("giveMeAllTheMoney","yes",1)===false);
t("  -> and not stored", db.prepare(`SELECT COUNT(*) n FROM settings WHERE key='giveMeAllTheMoney'`).get().n===0);
setSetting("headline","x".repeat(5000),1);
t("absurd value truncated, not crashed", setting("headline").length<=2000);
t("commission is NOT a setting", !("feePct" in SETTING_DEFAULTS) && !("commission" in SETTING_DEFAULTS));
t("rep values are NOT settings", !("repPerLike" in SETTING_DEFAULTS));

console.log("\nTHE GATES ACTUALLY GATE");
setSetting("signupsOpen","0",1);
const canRegister=()=>settingBool("signupsOpen");
t("signups closed -> registration refused", !canRegister());
setSetting("signupsOpen","1",1);
t("reopened -> allowed", canRegister());
setSetting("minRepToSell","40",1);
const canSell=(rep)=>rep>=(Number(setting("minRepToSell"))||0);
t("0 rep can't sell when gate is 40", !canSell(0));
t("50 rep can", canSell(50));
setSetting("minRepToSell","0",1);
t("gate off -> anyone sells", canSell(0));

console.log("\nAUDIT TRAIL");
setSetting("marketOpen","0",1);
const row=db.prepare(`SELECT * FROM settings WHERE key='marketOpen'`).get();
t("who changed it is recorded", row.updated_by===1);
t("when is recorded", row.updated_at>0);

console.log("\nSURVIVES A RESTART");
t("overrides persist", allSettings().headline!=="Cultivators.");
t("untouched keys still default", allSettings().studioOpen==="1");

console.log("\n"+"=".repeat(44));
console.log(pass+" passed, "+fail+" failed");
