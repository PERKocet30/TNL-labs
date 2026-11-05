/* PICK FILES v1.2 — 2026-11-05 (later). "Still isn't working — if it needs time to load the
   video from my camera roll let it load up like Instagram": a 20s video picked, the check tapped,
   and the composer sat there empty while iOS got it ready, so it looked broken. On an iPhone the
   screen now says it's waiting from the moment the picker opens (onWait — behind the picker, so
   it's what you come back to), and the files land when iOS hands them over. A cancel there is
   still a maybe, for PICK_CANCEL_MS (the waiting screen goes back to the empty box after it);
   pickStop() ends a wait you give up on — the screen's Stop.
   v1.1 — 2026-11-05. "My upload isn't working": on an iPhone, a
   1:59 video picked from Photos, the check tapped, the composer came back
   empty. iOS gets a video ready (it copies and converts it) after the
   picker closes, and Safari can say "cancel" before the files arrive. v1.0
   took that cancel as the end and stopped listening, so the video landed
   on nobody. Now a cancel is only a maybe: the pick stays open, and files
   that turn up after it (a late change, or the input filling while the
   phone gets them ready) still come back. A pick ends with files, or when
   the next pick starts, or after PICK_WAIT_MS with nothing.
   v1.0 — 2026-11-04. "My post composer isn't working": on an iPhone, two
   photos picked, the check tapped, the composer came back empty and nothing
   was uploaded. Safari (WebKit) drops what was chosen when the file input it
   was opened from is repainted away while the picker is up; Chrome keeps it.
   So the picker opens from one input that lives outside the app — on
   <body>, never in a render — and hands the files back once they're chosen:
   pickFiles({accept, multiple}) → File[] ([] when cancelled). Each pick is
   counted as a flow ("pick": start → done or abandon, app/ui-signals) so a
   lost pick shows up in Echo's flows. */
const PICK_WAIT_MS=90000;     // a long video can take a while to get ready on a phone
const PICK_CANCEL_MS=30000;   // after iOS says "cancel" with nothing: how long a video may still turn up
const pickIOS=()=>/iP(hone|ad|od)/.test(navigator.userAgent)||(/Macintosh/.test(navigator.userAgent)&&navigator.maxTouchPoints>1);
/* pickOpen (app/state): the pick still waiting, so the next one can end it */
function pickFiles({accept="",multiple=false,where="pick",onWait=null}={}){
  if(pickOpen)pickOpen([]);   // a new pick ends the one before it
  return new Promise(resolve=>{
    let fi=document.getElementById("filepick");
    if(!fi){fi=document.createElement("input");fi.type="file";fi.id="filepick";fi.hidden=true;fi.setAttribute("aria-hidden","true");fi.tabIndex=-1;document.body.appendChild(fi)}
    let settled=false,poll=0,wait=0;
    const done=files=>{if(settled)return;settled=true;clearInterval(poll);clearTimeout(wait);
      fi.onchange=null;fi.oncancel=null;fi.oninput=null;if(pickOpen===done)pickOpen=null;
      try{uiPush("flow",where,files.length?"done":"abandon")}catch(e){}
      resolve(files)};
    const take=()=>{const files=[...(fi.files||[])];if(!files.length)return false;fi.value="";done(files);return true};   // copy first: clearing the input empties its live list
    fi.accept=accept;fi.multiple=!!multiple;fi.value="";
    fi.onchange=fi.oninput=()=>{take()};
    /* a cancel is a maybe (iOS getting a video ready): keep listening, and look for files the phone fills in */
    const ios=pickIOS();
    fi.oncancel=()=>{if(settled||take())return;
      clearInterval(poll);poll=setInterval(take,500);
      clearTimeout(wait);wait=setTimeout(()=>done([]),ios?PICK_CANCEL_MS:PICK_WAIT_MS)};
    pickOpen=done;
    try{uiPush("flow",where,"start")}catch(e){}
    fi.click();
    if(ios){   // iPhone: the screen waits from now on (it's behind the picker), and we look for files until they come
      if(onWait)setTimeout(()=>{if(!settled)try{onWait()}catch(e){}},250);
      poll=setInterval(take,500);wait=setTimeout(()=>done([]),PICK_WAIT_MS);
    }
  });
}
/* give up on the pick that's waiting (the screen's Stop) */
function pickStop(){if(pickOpen)pickOpen([])}
