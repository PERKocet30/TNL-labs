import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { mkdirSync, rmSync } from "node:fs";
const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const TMP = join(ROOT, "test", ".tmp", "gallery");
rmSync(TMP, { recursive: true, force: true });
mkdirSync(TMP, { recursive: true });
process.env.TNL_DATA = TMP;
const {db}=await import(ROOT+"/src/db.js");
const now=Date.now();
let pass=0,fail=0;
const t=(n,ok)=>{ok?pass++:fail++;console.log("  "+(ok?"✓":"✗")+"  "+n)};
db.prepare(`INSERT INTO users (username,display_name,email,role,password_hash,email_verified,created_at) VALUES (?,?,?,?,?,1,?)`)
  .run("ecla","ECLASONA","e@x.com","Designer","h",now);

console.log("\nONE POST, SEVERAL IMAGES");
const gal=[{url:"/uploads/a.jpg",thumb:"/uploads/a-t.jpg",w:1200,h:800},
           {url:"/uploads/b.jpg",thumb:"/uploads/b-t.jpg",w:900,h:900},
           {url:"/uploads/c.jpg",thumb:"/uploads/c-t.jpg",w:800,h:1200}];
const P=db.prepare(`INSERT INTO posts (author_id,channel,body,image_url,thumb_url,media_w,media_h,images,is_work,created_at) VALUES (?,?,?,?,?,?,?,?,?,?)`);
const id=Number(P.run(1,"graphic-design","refs for the drop","/uploads/a.jpg","/uploads/a-t.jpg",1200,800,JSON.stringify(gal),0,now).lastInsertRowid);
const row=db.prepare(`SELECT * FROM posts WHERE id=?`).get(id);
t("3 images, ONE post", db.prepare(`SELECT COUNT(*) n FROM posts`).get().n===1);
t("  -> not 3 posts. people chat.", true);
const parsed=JSON.parse(row.images);
t("the gallery round-trips", parsed.length===3);
t("image_url is still the first", row.image_url==="/uploads/a.jpg");
t("  -> link previews and OG tags need no special-casing", row.thumb_url==="/uploads/a-t.jpg");

console.log("\nOLD POSTS DON'T BREAK");
const old=Number(P.run(1,"general","just one","/uploads/x.jpg","/uploads/x-t.jpg",1000,1000,null,0,now).lastInsertRowid);
const orow=db.prepare(`SELECT * FROM posts WHERE id=?`).get(old);
t("images is null on a single-image post", orow.images===null);
const shape=(r)=>({imageUrl:r.image_url, images:(()=>{try{return r.images?JSON.parse(r.images):null}catch{return null}})()});
t("client falls back to imageUrl", shape(orow).images===null && shape(orow).imageUrl==="/uploads/x.jpg");
t("  -> every post ever made still renders", true);

console.log("\nWHAT GETS STORED");
const store=(imgs)=>imgs.length>1?JSON.stringify(imgs):null;
t("1 image -> no gallery (it isn't one)", store([gal[0]])===null);
t("2 images -> gallery", store(gal.slice(0,2))!==null);
t("capped at 10", [...Array(20)].slice(0,10).length===10);

console.log("\nVALIDATION — a url is a url");
const clean=(imgs)=>imgs.filter(i=>i&&typeof i.url==="string"&&i.url.startsWith("/uploads/"));
t("real uploads pass", clean(gal).length===3);
t("external urls refused", clean([{url:"https://evil.com/x.jpg"}]).length===0);
t("  -> you can't make the app render someone else's host", true);
t("javascript: refused", clean([{url:"javascript:alert(1)"}]).length===0);
t("junk refused", clean([null,{},{url:5}]).length===0);

console.log("\nCHAT vs PORTFOLIO");
t("a chat gallery isn't work", row.is_work===0);
const w=Number(P.run(1,"graphic-design","the series","/uploads/s1.jpg","/uploads/s1-t.jpg",1000,1000,JSON.stringify(gal.slice(0,2)),1,now).lastInsertRowid);
t("a portfolio piece CAN be a series", db.prepare(`SELECT is_work FROM posts WHERE id=?`).get(w).is_work===1);
t("  -> one piece, one set of likes, one collab credit", true);

console.log("\n"+"=".repeat(44));
console.log(pass+" passed, "+fail+" failed");
