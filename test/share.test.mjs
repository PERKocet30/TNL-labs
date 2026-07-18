import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { mkdirSync, rmSync } from "node:fs";
const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const TMP = join(ROOT, "test", ".tmp", "share");
rmSync(TMP, { recursive: true, force: true });
mkdirSync(TMP, { recursive: true });
process.env.TNL_DATA = TMP;
const {db,awardRep,REP}=await import(ROOT+"/src/db.js");
const now=Date.now();
let pass=0,fail=0;
const t=(n,ok)=>{ok?pass++:fail++;console.log("  "+(ok?"✓":"✗")+"  "+n)};
const ins=db.prepare(`INSERT INTO users (username,display_name,email,role,password_hash,email_verified,created_at) VALUES (?,?,?,?,?,1,?)`);
const [maker,sharer]=["ecla","madz"].map(n=>Number(ins.run(n,n,n+"@x.com","Designer","h",now).lastInsertRowid));
const createPost=db.prepare(`INSERT INTO posts (author_id,channel,body,beat_json,image_url,video_url,thumb_url,media_w,media_h,is_work,shared_from,images,created_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)`);

console.log("\nSHARING PUBLISHED WORK INTO A LAB");
const gal=JSON.stringify([{url:"/uploads/a.jpg",thumb:"/uploads/a-t.jpg",w:1000,h:1000},{url:"/uploads/b.jpg",thumb:"/uploads/b-t.jpg",w:1000,h:1000}]);
const orig=Number(createPost.run(maker,"graphic-design","the series",null,"/uploads/a.jpg",null,"/uploads/a-t.jpg",1000,1000,1,null,gal,now).lastInsertRowid);
const o=db.prepare(`SELECT * FROM posts WHERE id=?`).get(orig);
t("published work has a gallery", JSON.parse(o.images).length===2);
t("created_at is a real timestamp", o.created_at===now);
t("  -> the arg-count bug would have put Date.now() in `images`", typeof o.created_at==="number");

// share it into another lab
const shared=Number(createPost.run(sharer,"anime-chat","this is sick",o.beat_json,o.image_url,o.video_url,o.thumb_url,o.media_w,o.media_h,0,o.id,o.images,now+1).lastInsertRowid);
const sh=db.prepare(`SELECT * FROM posts WHERE id=?`).get(shared);
t("lands in the target lab", sh.channel==="anime-chat");
t("remembers the original", sh.shared_from===orig);
t("carries the whole series", JSON.parse(sh.images).length===2);
t("  -> a shared series is still a series", true);
t("created_at intact", sh.created_at===now+1);
t("a share isn't published work", sh.is_work===0);
t("  -> it's a pointer, not a second portfolio piece", sh.is_work===0);

console.log("\nTHE MAKER EARNS");
awardRep(maker,"share_received",orig);
t("share_received = "+REP.share_received+" rep", db.prepare(`SELECT rep FROM users WHERE id=?`).get(maker).rep===REP.share_received);
t("  -> work travelling IS validation", REP.share_received>0);

console.log("\nSHARE COUNT");
const n=db.prepare(`SELECT COUNT(*) n FROM posts s WHERE s.shared_from=?`).get(orig).n;
t("counted on the original", n===1);

console.log("\nCHAT vs PUBLISHED");
const chat=Number(createPost.run(maker,"general","just talking",null,"/uploads/x.jpg",null,null,null,null,0,null,null,now).lastInsertRowid);
const c=db.prepare(`SELECT * FROM posts WHERE id=?`).get(chat);
t("a chat post isn't work", c.is_work===0);
t("  -> no public /p/ page, by design", c.is_work===0);
t("published work is", o.is_work===1);

console.log("\n"+"=".repeat(44));
console.log(pass+" passed, "+fail+" failed");
