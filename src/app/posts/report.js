/* REPORT A POST v1.0 — 2026-11-04. "Post should have options to be able to
   report an issue like Instagram in app." Every post that isn't yours has
   Report in its ··· menu (the Showroom card, an opened post, a lab message)
   as well as the flag on an opened post. Like Instagram: why, in one tap;
   for "Stolen work" and "Something else" a few words if you want; then a
   thank-you that offers to block the person too. A broken post (won't
   load, won't play, looks wrong) can be reported from the same place and
   reaches the admin as a bug. Goes to POST /api/report (Admin → Reports);
   reporting the same post again updates the reason, never a second row. */
const REPORT_WHY=[
  ["Spam","It's spam"],
  ["Scam or fraud","Scam or fraud"],
  ["Stolen work","Stolen work — someone posted it as theirs"],
  ["Nudity or sexual content","Nudity or sexual content"],
  ["Hate or harassment","Hate speech, bullying or harassment"],
  ["Violence or threats","Violence or threats"],
  ["Not allowed for sale","Selling something that isn't allowed"],
  ["False information","False information"],
  ["Broken","Something's broken — it won't load, won't play or looks wrong"],
  ["Something else","Something else"],
];
const REPORT_MORE=["Stolen work","Broken","Something else"];   // these ask for a few words (optional)
function reportPost(p){
  if(!p||!ME)return;
  if(p.author&&p.author.username===myName())return toast("That's your post");
  openPicker({eyebrow:"REPORT",title:"Why are you reporting this post?",
    items:REPORT_WHY.map(([reason,label])=>({label,icon:DI.flag,reason})),
    onPick:async it=>{
      let reason=it.reason;
      if(REPORT_MORE.includes(reason)){
        const more=await uiPrompt(reason==="Stolen work"?"Whose work is it?":reason==="Broken"?"What's wrong with it?":"Tell us what's wrong",
          {placeholder:reason==="Stolen work"?"Their @name or a link to the original (optional)":"A few words (optional)",okLabel:"Send"});
        if(more===null)return;   // Cancel: nothing sent
        if(more&&String(more).trim())reason+=": "+String(more).trim().slice(0,240);
      }
      try{await api.report({postId:p.id,reason})}catch(e){return toast(e.message)}
      if(it.reason==="Broken"){toast("Thanks — we'll fix it");return}
      const who=p.author&&p.author.username;
      if(!who){toast("Reported — thank you");return}
      const block=await uiConfirm("Thanks for letting us know","We'll look at it. You can also block @"+who+" — you won't see their posts and they can't message you.",{okLabel:"Block @"+who,cancelLabel:"Done",danger:true});
      if(!block)return;
      try{const d=await api.block(who);toast(d.blocked?"Blocked @"+who:"Unblocked")}catch(e){toast(e.message)}
    }});
}
