/* PICK FILES v1.0 — 2026-11-04. "My post composer isn't working": on an
   iPhone, two photos picked, the check tapped, the composer came back empty
   and nothing was uploaded. Safari (WebKit) drops what was chosen when the
   file input it was opened from is repainted away while the picker is up;
   Chrome keeps it. The composer's input lived inside the screen, and any
   repaint during the picker took it. So the picker opens from one input
   that lives outside the app — on <body>, never in a render — and hands the
   files back once they're chosen: pickFiles({accept, multiple}) → File[]
   ([] when cancelled). Each pick is counted as a flow ("pick": start → done
   or abandon, app/ui-signals) so a lost pick shows up in Echo's flows. */
function pickFiles({accept="",multiple=false,where="pick"}={}){
  return new Promise(resolve=>{
    let fi=document.getElementById("filepick");
    if(!fi){fi=document.createElement("input");fi.type="file";fi.id="filepick";fi.hidden=true;fi.setAttribute("aria-hidden","true");fi.tabIndex=-1;document.body.appendChild(fi)}
    let settled=false;
    const done=files=>{if(settled)return;settled=true;fi.onchange=null;fi.oncancel=null;
      try{uiPush("flow",where,files.length?"done":"abandon")}catch(e){}
      resolve(files)};
    fi.accept=accept;fi.multiple=!!multiple;fi.value="";
    fi.onchange=()=>{const files=[...(fi.files||[])];fi.value="";done(files)};   // copy first: clearing the input empties its live list
    fi.oncancel=()=>done([]);
    try{uiPush("flow",where,"start")}catch(e){}
    fi.click();
  });
}
