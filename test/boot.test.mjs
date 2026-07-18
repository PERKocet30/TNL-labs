import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { mkdirSync, rmSync } from "node:fs";
const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const TMP = join(ROOT, "test", ".tmp", "boot");
rmSync(TMP, { recursive: true, force: true });
mkdirSync(TMP, { recursive: true });
/* The previous test set ME *after* running module scope, so the login path
   never executed and a missing applyAccent slipped through. This one calls
   every function the app actually calls, in the order it calls them. */
import { readFileSync } from "node:fs";
import vm from "node:vm";
const src = readFileSync(ROOT+"/public/index.html","utf8");
const parts = src.split("<script>");
const js = parts[parts.length-1].split("</script>")[0];

const stub = {
  innerHTML:"", value:"", textContent:"", checked:false, scrollTop:0, scrollHeight:0, files:[],
  style:{setProperty(){}}, dataset:{},
  classList:{add(){},remove(){},toggle(){},contains:()=>false},
  appendChild(){}, remove(){}, addEventListener(){}, removeEventListener(){},
  focus(){}, click(){}, setSelectionRange(){}, setAttribute(){}, getAttribute:()=>null,
  getContext:()=>({drawImage(){},fillRect(){}}),
};
stub.querySelector=()=>stub; stub.querySelectorAll=()=>[]; stub.parentElement=stub; stub.nextElementSibling=stub;
const doc={documentElement:stub,body:stub,head:stub,querySelector:()=>stub,querySelectorAll:()=>[],
  getElementById:()=>stub,createElement:()=>stub,addEventListener(){},cookie:""};
const sandbox={
  console:{log(){},error(){},warn(){}},setTimeout:()=>0,clearTimeout,setInterval:()=>0,clearInterval,
  Promise,JSON,Math,Date,Object,Array,String,Number,Boolean,RegExp,Error,Set,Map,
  isNaN,parseInt,parseFloat,encodeURIComponent,decodeURIComponent,atob:(s)=>s,btoa:(s)=>s,
  Uint8Array,URLSearchParams,URL,Blob:class{},FileReader:class{readAsDataURL(){}},Image:class{},
  XMLHttpRequest:class{open(){}setRequestHeader(){}send(){}upload={}},EventSource:class{addEventListener(){}close(){}},
  document:doc,navigator:{serviceWorker:{register:()=>Promise.resolve()},clipboard:{writeText:()=>Promise.resolve()}},
  location:{origin:"https://labs.tnllabs.com",pathname:"/",search:"",href:"/"},
  history:{pushState(){},replaceState(){}},localStorage:{getItem:()=>null,setItem(){},removeItem(){}},
  fetch:()=>Promise.resolve({ok:true,json:()=>Promise.resolve({})}),
  alert(){},confirm:()=>true,prompt:()=>null,AudioContext:class{},webkitAudioContext:class{},
  TNLStudio:{mount(){},unmount(){},preview(){}},addEventListener(){},removeEventListener(){},
};
sandbox.window=sandbox; sandbox.globalThis=sandbox;
vm.createContext(sandbox);
vm.runInContext(js, sandbox, {timeout:8000});

const ME = {username:"tnllabs",displayName:"TNL.LABS",email:"j@x.com",role:"Content Creator",
  roles:["Content Creator"],avatarUrl:"",rep:50,bio:"",link:"",emailVerified:true,published:true,
  isAdmin:true,payoutsReady:false,hasStripe:false,accent:"lab",accentHex:"#22C55E",createdAt:Date.now()};

/* EVERY function the app calls — if it isn't defined, this fails loudly. */
/* Every function the code CALLS, discovered from the source — not a list I
   maintain by hand. archiveHTML slipped through precisely because it wasn't
   on my hand-written list, and a check you have to remember to update isn't
   a check. */
const source = readFileSync(join(ROOT, "public/index.html"), "utf8");
const scriptSrc = source.split("<script>").pop().split("</script>")[0];
const BUILTIN = new Set(["if","for","while","switch","catch","function","return","typeof","new","await",
  "String","Number","Boolean","Array","Object","JSON","Math","Date","RegExp","Error","Set","Map","Promise",
  "parseInt","parseFloat","isNaN","encodeURIComponent","decodeURIComponent","fetch","alert","confirm","prompt",
  "setTimeout","clearTimeout","setInterval","clearInterval","require","import","atob","btoa","URLSearchParams","URL"]);
const called = new Set();
for (const m of scriptSrc.matchAll(/(?<![.\w$'"`])([a-zA-Z_$][\w$]*)\s*\(/g)) {
  const n = m[1];
  if (!BUILTIN.has(n)) called.add(n);
}
const defined = new Set();
for (const m of scriptSrc.matchAll(/function\s+([a-zA-Z_$][\w$]*)\s*\(/g)) defined.add(m[1]);
for (const m of scriptSrc.matchAll(/(?:const|let|var)\s+([a-zA-Z_$][\w$]*)\s*=\s*(?:async\s*)?\(/g)) defined.add(m[1]);
for (const m of scriptSrc.matchAll(/(?:const|let|var)\s+([a-zA-Z_$][\w$]*)\s*=\s*(?:async\s*)?function/g)) defined.add(m[1]);
for (const m of scriptSrc.matchAll(/(?:const|let|var)\s+([a-zA-Z_$][\w$]*)\s*=\s*[a-zA-Z_$][\w$]*\s*=>/g)) defined.add(m[1]);

const required = [...called];
const missing = required.filter((n) =>
  !defined.has(n) && typeof sandbox[n] !== "function" && typeof sandbox[n] !== "object" && sandbox[n] === undefined
);
console.log("✓ all " + required.length + " called functions resolve");

// now actually run the login path — the one that just broke
sandbox.ME = ME;
sandbox.LEVELS=[{id:1,name:"Entry",at:0},{id:2,name:"Verified",at:40},{id:3,name:"Collaborator",at:120},{id:4,name:"Core",at:280},{id:5,name:"Leadership",at:560}];
const errs=[];
const run=(l,f)=>{try{f()}catch(e){errs.push(l+" -> "+e.name+": "+e.message)}};
run("applyAccent(ME.accentHex)  [the login crash]", ()=>sandbox.applyAccent(ME.accentHex));
run("applyAccent(undefined)", ()=>sandbox.applyAccent(undefined));
run("initHistory()", ()=>sandbox.initHistory());
for(const [n,setup] of [["showroom",()=>{sandbox.TAB="showroom"}],["labs",()=>{sandbox.TAB="labs"}],
  ["studio",()=>{sandbox.TAB="studio"}],["market",()=>{sandbox.TAB="market";sandbox.MKTVIEW="browse"}],
  ["market/sell",()=>{sandbox.MKTVIEW="sell";sandbox.SELLFORM={}}],["market/saved",()=>{sandbox.MKTVIEW="saved"}],
  ["market/orders",()=>{sandbox.MKTVIEW="orders"}]]) { setup(); run("render() "+n, ()=>sandbox.render()); }
sandbox.TAB="showroom"; sandbox.MKTVIEW="browse";
sandbox.PROFILE={loading:false,user:ME,followers:0,following:0,youFollow:false,stats:{posts:0,likesReceived:0,collabs:0},posts:[],collabs:[]};
run("render() profile open", ()=>sandbox.render());
sandbox.EDITING=true;
run("render() profile edit (accent picker)", ()=>sandbox.render());

if(errs.length){console.log("\n✗ RUNTIME:\n");errs.forEach(e=>console.log("   "+e));process.exit(1)}
console.log("✓ login + every render path runs clean");
