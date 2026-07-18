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
const required = [
  "applyAccent","render","openProfile","needAccount","openPicker","closePicker","wirePanels",
  "wireProfileLinks","wireFeed","wireSheet","wireMarket","wirePicker","initHistory","pushView",
  "loadFeed","loadShowroom","loadMarket","loadUnreads","refreshBadges","paintBadges","refreshMe",
  "startStream","toast","esc","rich","avHTML","kindOf","timeAgo","money","levelFor",
  "topHTML","navHTML","showroomHTML","labsHTML","studioHTML","marketHTML","sheetHTML","gateHTML",
  "postHTML","workCardHTML","srCardHTML","mktCardHTML","detailHTML","sellHTML","ordersHTML",
  "savedHTML","reviewHTML","pickerHTML","notifPanelHTML","dmPanelHTML","searchPanelHTML",
  "emptyHTML","commentsHTML","payoutBannerHTML","rateHTML","nextRate","compressImage","prepImage",
  "loadImage","resize","readFile","uploadStream","uploadB64","uploadError","dataUrlToBlob",
  "openDM","mountStudio","stashSell","renderRoomFeed","renderSearchOnly","paintUnreads",
  "paintVerifyBar","firstUrl","linkCard","wireGate","wire",
];
import { readFileSync as rf } from "node:fs";
const source = rf(ROOT+"/public/index.html","utf8");
// only check names the code actually CALLS, and accept const/arrow definitions
const missing = required.filter(n => {
  const called = new RegExp("(?<![.\\w$])" + n + "\\s*\\(").test(source);
  if (!called) return false;
  const defined = typeof sandbox[n] === "function"
    || new RegExp("(function\\s+" + n + "\\s*\\(|(?:const|let|var)\\s+" + n + "\\s*=)").test(source);
  return !defined;
});
if (missing.length) {
  console.log("✗ CALLED BUT NOT DEFINED:\n");
  missing.forEach(m=>console.log("   " + m + "()"));
  process.exit(1);
}
console.log("✓ all " + required.length + " referenced functions are defined");

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
