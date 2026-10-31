/* THE APP'S SHARED STATE — v1.0 · 2026-10-31 (the flatten).
   Every top-level `let` the app has, in one place. The parts share one script scope, so these
   are the variables any screen can read or change; this file is the register of them. A new
   piece of shared state goes HERE (test/state.test.mjs fails on a top-level `let` anywhere
   else), under the feature that owns it, with a word on what it holds and who resets it.
   Rules of thumb:
   · One owner. The feature named in the heading sets and clears it; other features only read.
   · Screens must not step on each other: opening a screen that sits over another (the post
     maker over an opened post, say) puts the other aside and brings it back after
     (pceOpen / pceLeave in app/compose/post-edit.js is the pattern).
   · Nothing here runs code at load except reading storage — this file is the first script,
     before app/core/theme-labs-api.js (which needs THEME on load) and before LABS exists. */

/* ── THE APP · session, theme, who you are ── */
// core/theme-labs-api.js
let THEME = localStorage.getItem("tnl-theme") || "light";
let TOKEN = localStorage.getItem("tnl-token") || null;
let ME = null;
let LEVELS = [{id:1,name:"Entry",at:0},{id:2,name:"Verified",at:40},{id:3,name:"Collaborator",at:120},{id:4,name:"Core",at:280},{id:5,name:"Leadership",at:560}];

/* ── SCREENS · which screen is up, what each one holds ── */
// state/state-ui.js
// LAB=null means you're standing outside looking at the labs, not in one
let TAB="showroom", LAB=null, CH=null, ROOMOPEN=false, POSTS=[], PROFILE=null, TOASTT=null;   // CH is set to LABS[0]'s first channel in app/core/theme-labs-api.js, where LABS is defined
let SRPOSTS=[];
let PTAB="work", EDITING=false, LIGHTBOX=null, VERIFYURL=null;
let PROFLISTINGS=null;
let PCOMPOSE=null;
let FEEDAT={}, SRAT=0;  // freshness stamps — render() must not hammer the network on every tap
let CLIMB=false, CLIMBOPENRUNG=0; // THE CLIMB — the one screen where the whole progression system is legible
/* Several files at once. Each posts separately. */
let QUEUE=[];
let INSTALLEVT=null, INSTALLCARD=false;
let SITE={};   // headline, tagline, announcement, feature switches — set by /api/levels
let ACCENTS={lab:{name:"Lab",hex:"#98FC68"}};
let ACCENTHEX = "#98FC68";
let EDITID=null;
let TRACKS=null, TRKQ="", TRKUP=false, NOWPLAYING=null;
let TRKEDIT=null;   // {id,title,artworkUrl,busy,fresh}
let POSTOPEN=null;
let TRKVIDS=null, TRKEXT=false;
let NOTIFS=null, UNREAD=0, DMUNREAD=0, SEARCHQ="", SEARCHROLE="", SEARCHRES=null;
let OPENCOMMENTS=null, COMMENTS=[], CEDIT=null;
let NOTIFOPEN=false, DMOPENPANEL=false, SEARCHOPEN=false;
let SEARCHING=false, UNREADS={}, PICKER=null, MENTIONS=null, MENTIONQ="";
let LABACT=null;   // per-lab life: what got made, who was in, what's unread
let ARCHIVE=null, ARCHFILT={}, ARCHT=null;
let GATE=null;                       // null = browsing, "join"/"login" = the door
let ENTER = false;
let GATEWHY="";
let MKT=null, MKTMETA={categories:[],conditions:[],paymentsEnabled:false}, MKTFILT={}, MKTVIEW="browse";
let MKTONE=null, MKTOFFERS=[], SELLFORM=null, SELLIMGS=[], ORDERS=null, ORDTAB="buying", SELLUP=false, MKTFILTOPEN=false;
let MKTEDIT=null;
let MKTSELLER=null, MKTSIMILAR=[], SAVED=null, REVIEWING=null, REVSTARS=5;
let SELLKIND="physical", SELLAUDIO=null, SELLAUDIONAME="";
let TOASTH=0;

/* ── BACK AND MOTION · the trail of screens, swipes ── */
// nav/motion.js
let MVDT={card:null,t:0,timer:null};
// nav/back.js
let HISTINIT=false, POPPING=false;
let NAVS=[], NAVD=0, NAVPREV=null, NAVSWALLOW=0;
let NAVGO=0, NAVBUSY=false, NAVWAIT=[];
let PFTOP=false, NAVPF="", NAVPO=null;

/* ── MESSAGES · inbox, a chat, voice notes, live stream ── */
// messages/kit.js
let INBOX=null, INBOXTAB="chats", CHAT=null, CHATSHEET=null, CMENU=null, TYPING={}, LABREPLY=null, LABPINS=[], LABMUTED=new Set(), RECORD=null, CHATZOOM=null;
/* ---- one shared audio element for voice notes ---- */
let VNAUDIO=null, VNURL=null;
let CXWIDE=null;   // phone ↔ computer: the shape the Messages screen was last drawn for (app/messages/kit.js listens for resize)
let CHATHIST=false, CHATSWALLOW=false;
// messages/wire.js
let CHATSTICK=true;   // reading the newest message? then late-loading media keeps you there
/* searching your chats (2026-10-14): rows hide in place, nothing repaints */
let CXQ="";
/* ---- composer ---- */
let TYPINGSENT=0;
// messages/sheets.js
let PSEQ=0;
// messages/live.js
let es=null, ESTRY=0, ESTIMER=null;
let SRSOON=null;
// messages/labs.js
let LABDRAFT="", POSTSCH=null, PINIDX=0, ROOMSTICK=true, ROOMSEEN=null, LABUNSEEN=0;

/* ── SHOWROOM · the feed, the builders row, the gallery on a computer ── */
// showroom/gallery.js
let GALI=0, GALRAF=0, GALCLICK=false, GALSTEER=0, GALLAST=0, GALACC=0, GALLOCK=false;

/* ── THE DOOR · join, log in, onboarding ── */
// gate/logic.js
/* Confirm your email: "I've confirmed it" asks; the timer asks quietly every few seconds. */
let GXPOLL=0;
let GNEXT=null;
// gate/screens.js
let GFLOW=null, GXT=null;
// gate/tour.js
let TOURKEYS=false;
// gate/getstarted.js
let GS=null, GSAT=0, GSFORCE=false;

/* ── LABS · places, #tags, the lab you're standing in ── */
// labs/places.js
let LABNEXT=null;   // a shared /l/ link opened before joining: step into that lab once you're in
let LABVIEW="work", LABTAG=null, PLACE={}, TAGVIEW=null, LABTAGS=null;
let LABTAGSBUSY=false;
/* The next page of older pieces, appended to what's shown (2026-10-21). */
let PLOLDERBUSY=false;
/* Any #tag anywhere opens its page. */
let PLDELEG=false;

/* ── SHOWROOM · the feed, the builders row, the gallery on a computer ── */
// showroom/showroom.js
let SRB=[], SRBLOADED=false;
let SRNEW=null, SRBNEXT=null;

/* ── POSTS · comments in place ── */
// posts/comments.js
let CSLOTPO=false;   // true while the opened post (#poov) is being drawn

/* ── MUSIC · the player, now playing, playlists, trending ── */
// music/nowplaying.js
let NOWFULL=false, NPFEL=null, REPEAT="off", PLQORIG=null;   // REPEAT: off → all → one
// music/player.js
let AUDIO=null, PLAYERBAR=null, PLAYQ=[];
// music/playlists.js
let MUSVIEW="songs", PLISTS=null, PLLOADING=false, PLIST=null, PLADD=null, PLSHUF=false, PLQID=null;
// music/tracks.js
let TRENDING=null;   // songs used in posts lately (GET /api/tracks/trending, server/music/music.js)

/* ── MARKET · a listing, the bag, order done ── */
// market/listing.js
let LPICK={id:0,size:"",colour:""}, LGIDX={};

/* ── PROFILE · edit, the song on a profile ── */
// profile/edit.js
let EDITPF=null, CLIMBUSER=null;
// profile/profile.js
let PFSONG=null;

/* ── MARKET · a listing, the bag, order done ── */
// market/bag.js
let MKTBAG=null, MKTRECENT=null, SHOPSTATS=null;

/* ── EVENTS · the tournament screen, voting, the poll ── */
// events/screen.js
let EVLIST=null;          // {current, events} — for the Showroom banner
let EV=null, EVSLUG=null; // the open event, as the server shapes it
let EVENTER=null;         // the enter sheet: {prep, caption, agree, busy, pct}
// events/wire.js
let EVPRE=null;   // the tournament asked for at boot, before the rest (app/feed/feed-boot)
let EVDELEG=false;
let EVWAIT=null;
let EV_HOLD_MS=30000;   // let: the tap-through shortens it
// events/poll.js
let EVFOCUS=null, EVSHARE=null;

/* ── NOTIFICATIONS ── */
// notifications/notifs.js
let NFROWS=[];

/* ── MARKET · a listing, the bag, order done ── */
// market/order-done.js
let DONEID=null, DONESTATE="paid";

/* ── THE APP · session, theme, who you are ── */
// core/panels.js
/* openDM → app/messages/wire.js (messaging v2) */
let UPPROG=null, UPLOADXHR=null;
let STUDIOLOAD=null;
let VOBS=null;

/* ── THE POST MAKER · editors, preview, the posting queue ── */
// compose/composer-ig.js
let PCADV=null;
/* Preview: the post as the Showroom will show it */
let PCPREV=null;

/* ── MEDIA · carousels, video sound, post sound ── */
// media/media.js
let CAROVIEW="";
let VFAR=null;
let VSOUND=(()=>{try{return sessionStorage.getItem("tnl-vsound")==="1"}catch(e){return false}})();
let MUSOK=false, MUSMUTE=null, MUSAUTOID=null, MOBS=null, MUSDWELL=0;
let MUSBAND=new Set();
let MUSPRIMED=false;
let MUSDELEG=false;

/* ── THE POST MAKER · editors, preview, the posting queue ── */
// compose/preview.js
let PCPV=null;   // {id, a: Audio}
// compose/photo-edit.js
let PED=null;
let pedRaf=0;
// compose/queue.js
let PQ=[];

/* ── INSTAGRAM · the Story sheet ── */
// instagram/story-share.js
let IGS=null;

/* ── THE POST MAKER · editors, preview, the posting queue ── */
// compose/video-edit.js
let VED=null;

/* ── THE APP · session, theme, who you are ── */
// core/glitch.js
let GLHID=0,GLSHOW=0;
let GLRT={el:null,n:0,t0:0};
