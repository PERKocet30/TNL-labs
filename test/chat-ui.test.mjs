// Messaging v2.0 (2026-09-29): the chat screens' markup and rules, run for
// real in a sandbox — grouping, Seen, reactions, quotes, the composer, and
// that message text can never become markup.
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { readFileSync } from "node:fs";
import vm from "node:vm";
const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
let pass = 0, fail = 0;
const t = (n, ok) => { ok ? pass++ : fail++; console.log("  " + (ok ? "✓" : "✗") + "  " + n); };
const part = (f) => readFileSync(join(ROOT, "src", f), "utf8");
const api = part("app-07-theme-labs-api.js");
const escSrc = api.match(/^const esc=.*$/m)[0];
const richSrc = api.slice(api.indexOf("function rich(t){"), api.indexOf("\n}\n", api.indexOf("function rich(t){")) + 3);
const ctx = vm.createContext({ console, Date, Math, JSON, Object, Array, Set, Map, String, Number, CSS: { escape: (s) => s } });
vm.runInContext(`
  var ME={username:"ana",displayName:"Ana Ruiz"}; var UI_IC={arrow:"<svg/>",bell:"<svg/>"};
  var myName=()=>ME.username; var mmss=ms=>{const s=Math.round((ms||0)/1000);return s?Math.floor(s/60)+":"+String(s%60).padStart(2,"0"):""};
  var avHTML=(u,c)=>'<i class="av '+(c||"")+'"></i>'; var req=()=>null; var toast=()=>{}; var DMOPENPANEL=false;
  ${escSrc}
  ${richSrc}
`, ctx);
vm.runInContext(part("app-10-chat-1-kit.js") + part("app-10-chat-2-dm.js"), ctx);
const run = (js) => vm.runInContext(js, ctx);

const m = (id, from, body, at, extra = {}) => ({ id, kind: "msg", from: { username: from, displayName: from }, body, reactions: [], createdAt: at, ...extra });
const T = new Date(2026, 8, 29, 14, 0).getTime();

console.log("\nGROUPING — runs of one person read as one block");
ctx.A = m(1, "ben", "a", T); ctx.B = m(2, "ben", "b", T + 60000); ctx.C = m(3, "ben", "c", T + 5 * 60000); ctx.D = m(4, "ana", "d", T + 5 * 60000 + 1);
t("same person inside 3 minutes → one run", run("sameRun(A,B)"));
t("a gap over 3 minutes starts a new run", !run("sameRun(B,C)"));
t("a different person starts a new run", !run("sameRun(C,D)"));
t("system lines never join a run", !run(`sameRun(A,{...B,kind:"system"})`));
t("a time header after an hour's gap", run("bigGap(A,{...A,createdAt:A.createdAt+3600001})") && !run("bigGap(A,B)"));

console.log("\nSEEN");
run(`CHAT={id:9,messages:[],meta:{isGroup:false,people:[{username:"ana"},{username:"ben",readAt:${T + 1000}}]}}`);
t("1:1 — read after it was sent → Seen", run(`seenLine({createdAt:${T}})`) === "Seen");
t("1:1 — not yet read → Sent", run(`seenLine({createdAt:${T + 5000}})`) === "Sent");
t("pending → Sending…", run(`seenLine({pending:true})`) === "Sending…");
t("failed → a Retry button", run(`seenLine({failed:true,id:"t1"})`).includes('data-cretry="t1"'));
run(`CHAT.meta={isGroup:true,people:[{username:"ana"},{username:"ben",displayName:"Ben Okafor",readAt:${T + 1}},{username:"cam",displayName:"Cam Lee",readAt:${T + 1}},{username:"dee",readAt:0}]}`);
t("group — names who's read it", run(`seenLine({createdAt:${T}})`) === "Seen by Ben, Cam");
t("…no 'Seen' leaks from a request (server sends readAt null)", run(`(CHAT.meta.people[1].readAt=null,CHAT.meta.people[2].readAt=null,seenLine({createdAt:${T}}))`) === "Sent");

console.log("\nREACTIONS");
const rx = run(`reactsHTML([{emoji:"🔥",username:"ben"},{emoji:"🔥",username:"ana"},{emoji:"❤️",username:"cam"}],"dm:5")`);
t("grouped by emoji with a count", (rx.match(/class="c-rxp/g) || []).length === 2 && rx.includes("🔥<b>2</b>"));
t("yours is marked on", /c-rxp on" data-rx="🔥"/.test(rx) && !/c-rxp on" data-rx="❤️"/.test(rx));
t("nothing when there are none", run(`reactsHTML([],"dm:1")`) === "");
t("six fixed reactions — same set the server allows", run("REACTS.join('')") === "❤️😂😮😢🔥👏" && /EMOJI = \["❤️", "😂", "😮", "😢", "🔥", "👏"\]/.test(part("server-10-dm-core.js")));

console.log("\nQUOTES");
t("quoting yourself says You", run(`quoteHTML({id:1,from:"ana",text:"x"})`).includes("<b>You</b>"));
t("quoting someone uses their name", run(`quoteHTML({id:1,from:"ben",displayName:"Ben",text:"x"})`).includes("<b>Ben</b>"));
t("an unsent original says so", run(`quoteHTML({id:1,deleted:true,text:"Unsent"})`).includes("gone"));

console.log("\nSAFETY — text is text");
run(`CHAT={id:9,messages:[],meta:{isGroup:true,people:[{username:"ana"},{username:"ben"}]}}`);
const evil = run(`bubbleHTML({id:7,kind:"msg",from:{username:"ben",displayName:"<img src=x onerror=alert(1)>"},body:"<script>alert(1)</script>",reactions:[],createdAt:${T},
  link:{url:"javascript:alert(1)",title:"<b>t</b>",site:"s"},replyTo:{id:1,from:"ben",text:"<svg onload=1>"}},null,null,false)`);
t("message body escaped", !evil.includes("<script>") && evil.includes("&lt;script&gt;"));
t("display name escaped", !evil.includes("<img src=x"));
t("quote escaped", !evil.includes("<svg onload"));
t("a javascript: link never becomes a card", !evil.includes("javascript:"));
t("a web link does, title escaped", run(`linkPrevHTML({url:"https://x.test/a",title:"<b>t</b>",site:"x"})`).includes("&lt;b&gt;t&lt;/b&gt;"));
t("server only stores https preview images", /if \(!\/\^https:\\\/\\\/\/i\.test\(image\)\) image = "";/.test(part("server-10-links.js")));

console.log("\nCOMPOSER");
run(`RECORD=null;CHAT={id:9,draft:"",messages:[]}`);
let c = run("chatComposerHTML()");
t("empty → mic shown, send hidden", /id="cxsend"[^>]*hidden/.test(c) && !/id="cxmic"[^>]*hidden/.test(c));
run(`CHAT.draft="hi"`); c = run("chatComposerHTML()");
t("text → send shown, mic hidden", !/id="cxsend"[^>]*hidden/.test(c) && /id="cxmic"[^>]*hidden/.test(c));
run(`CHAT.reply={id:3,from:{username:"ben",displayName:"Ben Okafor"},body:"can you?"}`); c = run("chatComposerHTML()");
t("reply bar names who and what", c.includes("Replying to Ben Okafor") && c.includes("can you?"));
run(`CHAT.reply=null;CHAT.edit={id:3,body:"old"}`); c = run("chatComposerHTML()");
t("editing: no attach, a check to save", c.includes("Editing message") && !c.includes('id="cxatt"') && !c.includes('id="cxmic"'));
run(`CHAT.edit=null;RECORD={ms:4200}`); c = run("chatComposerHTML()");
t("recording: timer, delete and send", c.includes("0:04") && c.includes('id="recx"') && c.includes('id="recsend"'));
run("RECORD=null");

console.log("\nINBOX");
const row = run(`inboxRowHTML({id:1,isGroup:false,other:{username:"ben",displayName:"Ben",active:true},people:[],unread:2,muted:true,
  last:{body:"yo",mine:true,kind:"msg",createdAt:Date.now()}})`);
t("unread row, active dot, muted mark", row.includes("cx-row unread") && row.includes("cx-on") && row.includes("cx-mu"));
t("your last message reads 'You: …'", row.includes("You: yo"));
const g = run(`inboxRowHTML({id:2,isGroup:true,title:"",people:[{username:"ben",displayName:"Ben Okafor"},{username:"cam",displayName:"Cam Lee"}],unread:0,
  last:{body:"call at 3",mine:false,kind:"msg",from:"Cam Lee",createdAt:Date.now()}})`);
t("an unnamed group is titled by its people", g.includes("<b>Ben, Cam</b>"));
t("group previews say who spoke", g.includes("Cam: call at 3"));

console.log("\nLIVE STREAM — signed in, re-ticketed");
const live = part("app-10-chat-5-live.js");
t("asks for a ticket before connecting", /capi\.ticket\(\)/.test(live) && /api\/stream\?ticket=/.test(live));
t("never the old open stream", !/new EventSource\(API\+"\/api\/stream"\)/.test(live));
t("reconnects with a fresh ticket, backing off to 30s", /retryStream\(\)/.test(live) && /Math\.min\(30000/.test(live));

console.log(`\n  ${pass} passed, ${fail} failed`);
