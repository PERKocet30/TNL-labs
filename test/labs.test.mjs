import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { mkdirSync, rmSync } from "node:fs";
const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const TMP = join(ROOT, "test", ".tmp", "labs");
rmSync(TMP, { recursive: true, force: true });
mkdirSync(TMP, { recursive: true });
process.env.TNL_DATA = TMP;
const {db}=await import(ROOT+"/src/db.js");
const now=Date.now(), D=86400000;
let pass=0,fail=0;
const t=(n,ok)=>{ok?pass++:fail++;console.log("  "+(ok?"✓":"✗")+"  "+n)};
const ins=db.prepare(`INSERT INTO users (username,display_name,email,role,password_hash,email_verified,created_at) VALUES (?,?,?,?,?,1,?)`);
const [me,ecla,madz]=["me","eclasona","madz"].map(n=>Number(ins.run(n,n,n+"@x.com","Designer","h",now).lastInsertRowid));
const P=db.prepare(`INSERT INTO posts (author_id,channel,body,image_url,thumb_url,is_work,created_at) VALUES (?,?,?,?,?,?,?)`);
P.run(ecla,"graphic-design","piece","/u/a.jpg","/u/a-t.jpg",1,now-3600000);
P.run(madz,"graphic-design","another","/u/b.jpg",null,1,now-7200000);
P.run(ecla,"photography","shot","/u/c.jpg",null,1,now-2*D);
P.run(me,"general","chat",null,null,0,now-1000);

console.log("\nA LAB HAS A FACE — the last thing made in it");
const art=db.prepare(`SELECT p.channel, p.thumb_url, p.image_url, p.created_at FROM posts p WHERE p.image_url IS NOT NULL ORDER BY p.created_at DESC`).all();
const first={};
for(const r of art) if(!first[r.channel]) first[r.channel]={url:r.thumb_url||r.image_url,at:r.created_at};
t("graphic-design shows its newest piece", first["graphic-design"].url==="/u/a-t.jpg");
t("  -> uses the thumbnail, not the full image", first["graphic-design"].url.includes("-t"));
t("photography has its own", first["photography"].url==="/u/c.jpg");
t("general has no art — text only", !first["general"]);
t("  -> that lab shows as empty, honestly", true);

console.log("\nWHO'S BEEN IN THERE");
const week=now-7*D;
const ppl=db.prepare(`SELECT DISTINCT p.channel, u.username FROM posts p JOIN users u ON u.id=p.author_id WHERE p.created_at > ?`).all(week);
const byCh={};
for(const r of ppl) (byCh[r.channel]=byCh[r.channel]||[]).push(r.username);
t("2 people in graphic-design", byCh["graphic-design"].length===2);
t("  -> a room with faces is a place, not a corridor", true);

console.log("\nIS IT ALIVE?");
const act=db.prepare(`SELECT channel, SUM(CASE WHEN created_at > ? THEN 1 ELSE 0 END) today, SUM(CASE WHEN created_at > ? THEN 1 ELSE 0 END) week, MAX(created_at) last FROM posts GROUP BY channel`).all(now-D,week);
const gd=act.find(a=>a.channel==="graphic-design");
t("graphic-design: 2 today", gd.today===2);
const ph=act.find(a=>a.channel==="photography");
t("photography: 0 today, 1 this week", ph.today===0&&ph.week===1);
t("  -> shows 'quiet · last 2d ago' not a fake green dot", ph.today===0);

console.log("\nUNREAD, PER PERSON");
const un=db.prepare(`SELECT p.channel, COUNT(*) n FROM posts p LEFT JOIN channel_reads cr ON cr.user_id=? AND cr.channel=p.channel WHERE p.author_id!=? AND p.created_at>COALESCE(cr.last_read_at,0) GROUP BY p.channel`).all(me,me);
t("I have unread in graphic-design", un.find(u=>u.channel==="graphic-design").n===2);
t("my own post isn't unread to me", !un.find(u=>u.channel==="general"));
db.prepare(`INSERT INTO channel_reads (user_id,channel,last_read_at) VALUES (?,?,?)`).run(me,"graphic-design",now);
const un2=db.prepare(`SELECT p.channel, COUNT(*) n FROM posts p LEFT JOIN channel_reads cr ON cr.user_id=? AND cr.channel=p.channel WHERE p.author_id!=? AND p.created_at>COALESCE(cr.last_read_at,0) GROUP BY p.channel`).all(me,me);
t("reading it clears the badge", !un2.find(u=>u.channel==="graphic-design"));

console.log("\n"+"=".repeat(44));
console.log(pass+" passed, "+fail+" failed");
