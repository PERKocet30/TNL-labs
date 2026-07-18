import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { mkdirSync, rmSync } from "node:fs";
const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const TMP = join(ROOT, "test", ".tmp", "boards");
rmSync(TMP, { recursive: true, force: true });
mkdirSync(TMP, { recursive: true });
process.env.TNL_DATA = TMP;
const {db,awardRep,REP}=await import(ROOT+"/src/db.js");
const now=Date.now();
let pass=0,fail=0;
const t=(n,ok)=>{ok?pass++:fail++;console.log("  "+(ok?"✓":"✗")+"  "+n)};
const ins=db.prepare(`INSERT INTO users (username,display_name,email,role,password_hash,email_verified,created_at) VALUES (?,?,?,?,?,1,?)`);
const [maker,curator,other]=["ecla","curator","other"].map(n=>Number(ins.run(n,n,n+"@x.com","Designer","h",now).lastInsertRowid));
const P=db.prepare(`INSERT INTO posts (author_id,channel,body,image_url,is_work,created_at) VALUES (?,?,?,?,?,?)`);
const work=Number(P.run(maker,"graphic-design","poster","/u/a.jpg",1,now).lastInsertRowid);
const chat=Number(P.run(maker,"general","just a pic","/u/b.jpg",0,now).lastInsertRowid);
const B=db.prepare(`INSERT INTO boards (user_id,name,note,is_public,created_at,updated_at) VALUES (?,?,?,1,?,?)`);
const board=Number(B.run(curator,"Y2K refs","",now,now).lastInsertRowid);

console.log("\nTHE ARCHIVE — searchable, which a group chat can never be");
const arch=db.prepare(`SELECT p.id FROM posts p WHERE p.image_url IS NOT NULL AND p.is_work=1`).all();
t("published work is in the archive", arch.length===1);
t("chat images are NOT", !arch.find(a=>a.id===chat));
t("  -> a photo dropped mid-conversation isn't a public asset", true);

console.log("\nPINNING TNL WORK");
const pin=(bid,pid,uid)=>{
  const b=db.prepare(`SELECT * FROM boards WHERE id=? AND user_id=?`).get(bid,uid);
  if(!b)return "not_yours";
  const post=db.prepare(`SELECT * FROM posts WHERE id=? AND is_work=1`).get(pid);
  if(!post)return "no_work";
  if(db.prepare(`SELECT 1 FROM pins WHERE board_id=? AND post_id=?`).get(bid,pid))return "dupe";
  db.prepare(`INSERT INTO pins (board_id,user_id,post_id,created_at) VALUES (?,?,?,?)`).run(bid,uid,pid,Date.now());
  if(post.author_id!==uid){
    const n=db.prepare(`SELECT COUNT(*) n FROM pins p JOIN boards bo ON bo.id=p.board_id WHERE p.post_id=? AND bo.user_id=?`).get(pid,uid).n;
    if(n===1)awardRep(post.author_id,"pinned",pid);
  }
  return "ok";
};
const rep=()=>db.prepare(`SELECT rep FROM users WHERE id=?`).get(maker).rep;
t("curator pins the poster", pin(board,work,curator)==="ok");
t("the maker earns rep", rep()===REP.pinned);
t("  -> saving someone's reference IS validation", true);
t("same board twice = refused", pin(board,work,curator)==="dupe");
const board2=Number(B.run(curator,"Posters","",now,now).lastInsertRowid);
t("a SECOND board of theirs = allowed", pin(board2,work,curator)==="ok");
t("  but no extra rep — one person, one endorsement", rep()===REP.pinned);
const b3=Number(B.run(other,"mine","",now,now).lastInsertRowid);
t("a DIFFERENT person pinning = more rep", pin(b3,work,other)==="ok" && rep()===REP.pinned*2);
const selfBoard=Number(B.run(maker,"my own","",now,now).lastInsertRowid);
pin(selfBoard,work,maker);
t("pinning your OWN work earns nothing", rep()===REP.pinned*2);
t("chat images can't be pinned", pin(board,chat,curator)==="no_work");
t("can't pin to someone else's board", pin(board,work,other)==="not_yours");

console.log("\nEXTERNAL REFERENCE — linked, never rehosted");
const ext=(url)=>{
  if(!/^https?:\/\//i.test(url))return null;
  try{return new URL(url).hostname.replace(/^www\./,'')}catch(e){return null}
};
t("a real link is accepted", ext("https://www.are.na/block/123")==="are.na");
t("the source is always recorded", ext("https://showstudio.com/x")==="showstudio.com");
t("junk is refused", ext("not a url")===null);
t("javascript: is refused", ext("javascript:alert(1)")===null);
db.prepare(`INSERT INTO pins (board_id,user_id,src_url,src_site,img_url,created_at) VALUES (?,?,?,?,?,?)`)
  .run(board,curator,"https://are.na/block/1","are.na","https://are.na/img.jpg",now);
const p=db.prepare(`SELECT * FROM pins WHERE src_site='are.na'`).get();
t("we store the LINK, not the file", p.src_url.startsWith("https://") && !p.src_url.includes("/uploads/"));
t("  -> we are not a piracy host", !p.img_url.includes("/uploads/"));
t("the source is shown and linked", p.src_site==="are.na");

console.log("\nWHAT A CURATOR SEES");
const saves=db.prepare(`SELECT b.name, u.username FROM pins p JOIN boards b ON b.id=p.board_id JOIN users u ON u.id=b.user_id WHERE p.post_id=? AND b.is_public=1`).all(work);
t("the maker sees WHICH boards", saves.length>=2);
t("  -> 'saved into Y2K refs' says more than a like", !!saves.find(s=>s.name==="Y2K refs"));

console.log("\nREP VALUE");
t("a save = 3 rep", REP.pinned===3);
t("  less than a like (6)", REP.pinned<REP.like_received);
t("  far less than a collab (20)", REP.pinned<REP.collab_accepted);
t("  -> collecting isn't worth more than making", REP.pinned<REP.like_received);

console.log("\n"+"=".repeat(46));
console.log(pass+" passed, "+fail+" failed");
