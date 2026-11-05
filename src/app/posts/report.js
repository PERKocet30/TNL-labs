/* REPORT v1.1 — 2026-11-04. "Make sure this feature is throughout the app anywhere problems might
   occur." One report sheet for everything that can go wrong: a post, a person (from their profile or
   a chat — the admin never sees the messages), a comment, a listing, a song — and the app itself,
   "Report a problem" (settings, a post that didn't send, anywhere a screen breaks). Like Instagram:
   why, in one tap; a few words where they help; then a thank-you that offers to block the person.
   POST /api/report { kind, id | postId | username, reason, detail } → Admin → Reports, which says
   what each one is about. One open report per person per thing; a second updates the reason.
   v1.0 — 2026-11-04: Report on every post, like Instagram. */
const REPORT_WHY={
  post:[["Spam","It's spam"],["Scam or fraud","Scam or fraud"],["Stolen work","Stolen work — someone posted it as theirs"],
    ["Nudity or sexual content","Nudity or sexual content"],["Hate or harassment","Hate speech, bullying or harassment"],
    ["Violence or threats","Violence or threats"],["Not allowed for sale","Selling something that isn't allowed"],
    ["False information","False information"],["Broken","Something's broken — it won't load, won't play or looks wrong"],["Something else","Something else"]],
  comment:[["Spam","It's spam"],["Hate or harassment","Hate speech, bullying or harassment"],["Violence or threats","Violence or threats"],
    ["Scam or fraud","Scam or fraud"],["Nudity or sexual content","Nudity or sexual content"],["Something else","Something else"]],
  user:[["Pretending to be someone","Pretending to be someone else"],["Spam","Spam or a fake account"],["Scam or fraud","Scam or fraud"],
    ["Hate or harassment","Hate speech, bullying or harassment"],["Stolen work","Posting other people's work"],["Something else","Something else"]],
  listing:[["Scam or fraud","Scam or fraud"],["Counterfeit","Counterfeit or fake"],["Stolen work","Stolen photos or someone else's design"],
    ["Not allowed for sale","Selling something that isn't allowed"],["Misleading","The price, photos or description are misleading"],
    ["Broken","Something's broken — photos, sizes or checkout"],["Something else","Something else"]],
  track:[["Stolen work","Someone else's song"],["Hate or harassment","Hateful or harassing"],["Spam","Spam"],
    ["Broken","Something's broken — it won't play or sounds wrong"],["Something else","Something else"]],
};
const REPORT_NOUN={post:"post",comment:"comment",user:"account",listing:"listing",track:"song"};
const REPORT_MORE=["Stolen work","Broken","Something else","Misleading","Pretending to be someone"];   // these ask for a few words (optional)
const REPORT_ASK={"Stolen work":["Whose work is it?","Their @name or a link to the original (optional)"],"Pretending to be someone":["Who are they pretending to be?","Their @name (optional)"],
  "Broken":["What's wrong with it?","A few words (optional)"],"Misleading":["What's misleading?","A few words (optional)"],"Something else":["Tell us what's wrong","A few words (optional)"]};
/* reportThing({kind, id, username}) — username is who it's about (for the block offer); the server checks it itself */
function reportThing({kind,id,username}){
  if(!ME)return toast("Sign in to report");
  if(username&&username===myName())return toast("That's yours");
  const list=REPORT_WHY[kind];if(!list)return;
  openPicker({eyebrow:"REPORT",title:"Why are you reporting this "+REPORT_NOUN[kind]+"?",
    items:list.map(([reason,label])=>({label,icon:DI.flag,reason})),
    onPick:async it=>{
      let reason=it.reason;
      if(REPORT_MORE.includes(reason)){
        const [q,ph]=REPORT_ASK[reason];
        const more=await uiPrompt(q,{placeholder:ph,okLabel:"Send"});
        if(more===null)return;   // Cancel: nothing sent
        if(more&&String(more).trim())reason+=": "+String(more).trim().slice(0,240);
      }
      try{await api.report({kind,id,postId:kind==="post"?id:undefined,username:kind==="user"?username:undefined,reason})}catch(e){return toast(e.message)}
      if(it.reason==="Broken"){toast("Thanks — we'll fix it");return}
      if(!username){toast("Reported — thank you");return}
      const block=await uiConfirm("Thanks for letting us know","We'll look at it. You can also block @"+username+" — you won't see their posts and they can't message you.",{okLabel:"Block @"+username,cancelLabel:"Done",danger:true});
      if(!block)return;
      try{const d=await api.block(username);toast(d.blocked?"Blocked @"+username:"Unblocked");if(PROFILE&&PROFILE.user&&PROFILE.user.username===username){PROFILE=null;render()}}catch(e){toast(e.message)}
    }});
}
function reportPost(p){if(p)reportThing({kind:"post",id:p.id,username:p.author&&p.author.username})}
/* "Report a problem" — the app itself. The screen it happened on goes with it (a plain name, app/ui-signals). */
async function reportProblem(what){
  if(!ME)return toast("Sign in to report a problem");
  const words=await uiPrompt("Report a problem",{body:what?"About: "+what:"What went wrong? A few words help us find it.",placeholder:"What happened?",okLabel:"Send"});
  if(words===null)return;
  const w=String(words||"").trim();
  if(!w&&!what)return toast("Say what went wrong");
  let screen="";try{screen=uiScreen()}catch(e){}
  try{await api.report({kind:"app",reason:("Broken: "+(what?what+(w?" — ":""):"")+w).slice(0,300),detail:screen});toast("Thanks — we'll look into it")}catch(e){toast(e.message)}
}
