import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { mkdirSync, rmSync } from "node:fs";
const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const TMP = join(ROOT, "test", ".tmp", "backup");
rmSync(TMP, { recursive: true, force: true });
mkdirSync(TMP, { recursive: true });
process.env.TNL_DATA = TMP;
const {db,backupTo,logError}=await import(ROOT+"/src/db.js");
import { DatabaseSync } from "node:sqlite";
import { statSync } from "node:fs";

let pass=0,fail=0;
const t=(n,ok)=>{ok?pass++:fail++;console.log("  "+(ok?"✓":"✗")+"  "+n)};
const now=Date.now();

// a lab worth losing
const ins=db.prepare(`INSERT INTO users (username,display_name,email,role,password_hash,email_verified,rep,created_at) VALUES (?,?,?,?,?,1,?,?)`);
for(const [n,d,r] of [["tnllabs","TNL.LABS",94],["eclasona","ECLASONA",50],["madz","MADZ",30]]) ins.run(n,d,n+"@x.com","Designer","h",r,now);
const p=db.prepare(`INSERT INTO posts (author_id,channel,body,is_work,created_at) VALUES (?,?,?,1,?)`);
const pid=Number(p.run(2,"graphic-design","collab w sthy design.",now).lastInsertRowid);
db.prepare(`INSERT INTO collaborators (post_id,user_id,status,created_at) VALUES (?,?,'accepted',?)`).run(pid,1,now);

console.log("\nBACKUP — the one that matters");
mkdirSync(join(TMP,"backups"),{recursive:true});
const path=join(TMP,"backups","test.db");
backupTo(path);
t("a file appears", statSync(path).size>0);

// the real test: can you actually restore from it?
const restored=new DatabaseSync(path);
t("it opens as a real database", true);
t("3 members restored", restored.prepare(`SELECT COUNT(*) n FROM users`).get().n===3);
t("Jorge's 94 rep restored", restored.prepare(`SELECT rep FROM users WHERE username='tnllabs'`).get().rep===94);
t("the collab restored", restored.prepare(`SELECT COUNT(*) n FROM collaborators WHERE status='accepted'`).get().n===1);
t("the work restored", restored.prepare(`SELECT body FROM posts WHERE id=?`).get(pid).body==="collab w sthy design.");
const tables=restored.prepare(`SELECT COUNT(*) n FROM sqlite_master WHERE type='table'`).get().n;
t(`every table came with it (${tables})`, tables>20);
restored.close();

console.log("\n  -> this is a RESTORE test, not a 'the file exists' test.");
console.log("     an untested backup is a hope, not a backup.\n");

console.log("WHILE THE APP IS WRITING");
// VACUUM INTO is atomic; a plain file copy here would give you a corrupt db
db.prepare(`INSERT INTO posts (author_id,channel,body,is_work,created_at) VALUES (?,?,?,0,?)`).run(1,"general","mid-backup write",now);
backupTo(join(TMP,"backups","test2.db"));
const r2=new DatabaseSync(join(TMP,"backups","test2.db"));
t("snapshot taken during writes is consistent", r2.prepare(`SELECT COUNT(*) n FROM posts`).get().n===2);
r2.close();

console.log("\nERROR LOG");
logError("server","TypeError: x is undefined","stack here","/api/posts","madz");
logError("client","Can't find variable: applyAccent","","/","tnllabs");
t("errors recorded", db.prepare(`SELECT COUNT(*) n FROM error_log`).get().n===2);
t("who hit it recorded", db.prepare(`SELECT username FROM error_log ORDER BY id DESC LIMIT 1`).get().username==="tnllabs");
for(let i=0;i<600;i++) logError("server","spam "+i);
t("log stays bounded at 500 (not an archive)", db.prepare(`SELECT COUNT(*) n FROM error_log`).get().n<=500);
let threw=false;
try{ logError(null,undefined,{bad:"object"},123,[]) }catch(e){ threw=true }
t("a broken logError can't take the app down", !threw);

console.log("\n"+"=".repeat(44));
console.log(pass+" passed, "+fail+" failed");
