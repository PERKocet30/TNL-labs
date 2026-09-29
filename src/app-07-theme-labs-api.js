
/* ================================================================
   TNL LABS — one system, separate venues.
   Vanilla JS client talking to the real backend at the same origin.
================================================================ */
const API = location.origin;
/* Day/night. First visit follows the phone; after that the choice sticks.
   Applied before first paint so there's no white flash on a dark phone. */
function applyTheme(t){
  const light = t === "light";
  document.documentElement.setAttribute("data-theme", light ? "light" : "dark");
  const m = document.querySelector('meta[name="theme-color"]');
  if(m) m.setAttribute("content", light ? "#F7F1F1" : "#000000");
}
let THEME = localStorage.getItem("tnl-theme") || "light";
applyTheme(THEME);
function setTheme(t){ THEME=t; localStorage.setItem("tnl-theme",t); applyTheme(t); applyAccent(ACCENTHEX); }
let TOKEN = localStorage.getItem("tnl-token") || null;
let ME = null;
let LEVELS = [{id:1,name:"Entry",at:0},{id:2,name:"Verified",at:40},{id:3,name:"Collaborator",at:120},{id:4,name:"Core",at:280},{id:5,name:"Leadership",at:560}];
const ROLES = [
  // visual
  "Graphic Designer","Illustrator","3D Artist","Motion Designer","Animator","Art Director",
  "Painter","Sculptor","Tattoo Artist","Curator","Manga Artist","Character Designer",
  // lens
  "Photographer","Videographer","Video Editor","Cinematographer","AMV Editor",
  // fashion
  "Fashion Designer","Stylist","Model","Tailor","Sneaker Customizer","Cosplayer",
  // music
  "Producer","Beatmaker","Lyricist / Singer","Rapper","DJ","Audio Engineer","Musician",
  // word + screen
  "Writer","Copywriter","Journalist","Content Creator","Actor",
  // build
  "Web Designer","Web Developer","App Developer","UI/UX Designer","Product Designer",
  // business
  "Entrepreneur","Founder","Brand Strategist","Marketer","Manager","A&R","Photographer's Agent","Event Organizer",
];

/* Every profile shouldn't look the same. A producer's page and a fashion
   designer's page are different objects — different words, different shape.
   This maps a role to how their profile reads. Kind comes from their FIRST
   role, which is the one they picked first. */
/* One profile shape for everyone. There used to be eight KIND variants
   and a forty-entry role->kind table (with duplicate keys silently
   overriding each other — "Manga Artist" and "Cosplayer" each appeared
   twice). Role identity lives in the role chips the member already
   picked; the page frame is the same for all of them, which is one
   place to look when something breaks instead of eight. */
const KIND={tag:"PAGE",work:"POSTS",one:"post",collabLine:"With",empty:"No posts up yet.",
  blurb:"Their page — posts, collabs, standing.",grid:true};
function kindOf(){return KIND}
/* The header line still speaks the member's trade — "YOUR VISUAL",
   "YOUR SOUND" — because that little descriptor is identity, not
   behaviour. It's a flat role->word lookup and nothing else reads it. */
/* Each lab is a room, not a category. The glyph and the line under the name
   are what stop this being a list of hashtags — you should know what a place
   is FOR before you walk in. */
/* The labs are the ones that ALREADY EXIST — the Instagram group chats,
   with the names your people already know. //.JPEG PHARMACY has 226 members;
   "ART" has none, because I made it up.

   The community is the source of truth. If someone from the PHARMACY opens
   this and sees a lab called "ART", they're in a stranger's app. If they see
   //.JPEG PHARMACY, they're home.

   Channel IDs are unchanged on purpose — 18 posts live in them. */
const UI_IC={
  link:`<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="square" stroke-linejoin="miter" aria-hidden="true"><path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1"/></svg>`,
  tabGrid:`<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="square" stroke-linejoin="miter" aria-hidden="true"><rect x="4" y="4" width="6.5" height="6.5"/><rect x="13.5" y="4" width="6.5" height="6.5"/><rect x="4" y="13.5" width="6.5" height="6.5"/><rect x="13.5" y="13.5" width="6.5" height="6.5"/></svg>`,
  tabShop:`<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="square" stroke-linejoin="miter" aria-hidden="true"><rect x="4.5" y="9" width="15" height="11"/><path d="M9 9V7a3 3 0 0 1 6 0v2"/></svg>`,
  tabCollab:`<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="square" stroke-linejoin="miter" aria-hidden="true"><circle cx="9" cy="12" r="5"/><circle cx="15" cy="12" r="5"/></svg>`,
  tabStanding:`<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="square" stroke-linejoin="miter" aria-hidden="true"><path d="M4 20h4v-5H4zM10 20h4V10h-4zM16 20h4V4h-4z"/></svg>`,
  plusSq:`<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="square" stroke-linejoin="miter" aria-hidden="true"><rect x="4" y="4" width="16" height="16"/><path d="M12 8v8M8 12h8"/></svg>`,
  arrow:`<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2.25" stroke-linecap="square" stroke-linejoin="miter" aria-hidden="true"><path d="M5 12h13M12 6l6 6-6 6"/></svg>`,
  moon:`<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="square" stroke-linejoin="miter" aria-hidden="true"><path d="M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5z"/></svg>`,
  sun:`<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="square" stroke-linejoin="miter" aria-hidden="true"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M2 12h2M20 12h2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/></svg>`,
  search:`<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="square" stroke-linejoin="miter"><circle cx="10.5" cy="10.5" r="6"/><path d="M15 15l5 5"/></svg>`,
  dm:`<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="square" stroke-linejoin="miter"><path d="M4 5h16v11H9l-5 4z"/></svg>`,
  bell:`<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="square" stroke-linejoin="miter"><path d="M6 16v-5a6 6 0 0 1 12 0v5l1.5 2h-15z"/><path d="M10 21h4"/></svg>`,
  home:`<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="square" stroke-linejoin="miter"><rect x="4" y="4" width="6.5" height="6.5"/><rect x="13.5" y="4" width="6.5" height="6.5"/><rect x="4" y="13.5" width="6.5" height="6.5"/><rect x="13.5" y="13.5" width="6.5" height="6.5"/></svg>`,
  hash:`<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="square" stroke-linejoin="miter" style="stroke-width:2.5"><path d="M6.5 19.5L11 4.5M13 19.5L17.5 4.5"/></svg>`,
  music:`<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="square" stroke-linejoin="miter"><path d="M5 10v4M9 7v10M13 4v16M17 8v8M21 11v2"/></svg>`,
  bag:`<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="square" stroke-linejoin="miter"><rect x="4.5" y="9" width="15" height="11"/><path d="M9 9V7a3 3 0 0 1 6 0v2"/></svg>`,
  lock:`<svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="square" stroke-linejoin="miter"><rect x="5" y="11" width="14" height="9"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/></svg>`,
  cloud:`<svg viewBox="0 0 24 24" width="19" height="19" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="square" stroke-linejoin="miter"><path d="M6.5 19.5L11 4.5M13 19.5L17.5 4.5"/></svg>`,
  user:`<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="square" stroke-linejoin="miter"><circle cx="12" cy="8" r="3.5"/><path d="M5 20a7 6 0 0 1 14 0"/></svg>`,
  plus:`<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="square" stroke-linejoin="miter"><path d="M12 5v14M5 12h14"/></svg>`,
  navShowroom:`<svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="square" stroke-linejoin="miter"><rect x="4" y="4" width="6.5" height="6.5"/><rect x="13.5" y="4" width="6.5" height="6.5"/><rect x="4" y="13.5" width="6.5" height="6.5"/><rect x="13.5" y="13.5" width="6.5" height="6.5"/></svg>`,
  navLabs:`<svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="square" stroke-linejoin="miter" style="stroke-width:2.5"><path d="M6.5 19.5L11 4.5M13 19.5L17.5 4.5"/></svg>`,
  navPost:`<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="square" stroke-linejoin="miter" style="stroke-width:2.5"><path d="M12 5v14M5 12h14"/></svg>`,
  navMarket:`<svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="square" stroke-linejoin="miter"><rect x="4.5" y="9" width="15" height="11"/><path d="M9 9V7a3 3 0 0 1 6 0v2"/></svg>`,
  navProfile:`<svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="square" stroke-linejoin="miter"><circle cx="12" cy="8" r="3.5"/><path d="M5 20a7 6 0 0 1 14 0"/></svg>`};
/* The labs are genres. Display names only — every lab and channel id below
   is what posts are stored under, so ids never change when names do.
   v2 · 2026-09-28: LABS HQ, //.JPEG PHARMACY, AKATSUKI, FASHION LAB, CASINO,
   MUSIC LAB, TNΛ became General, Visual, Anime, Fashion, News, Music, Business. */
const labMark = n => /^\/\//.test(String(n||"")) ? String(n) : "// " + n;
/* "graphic-design" → "Graphic design" */
const chName = c => { const t=String((c&&c.label)||"").replace(/-/g," "); return t.charAt(0).toUpperCase()+t.slice(1); };
const LAB_ID = {
  hq:       {for:"Everything starts here.",          ic:`<svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="square" stroke-linejoin="miter" aria-hidden="true"><path d="M10 4L6 20M18 4l-4 16"/></svg>`},
  pharmacy: {for:"Design, photo and film.",          ic:`<svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="square" stroke-linejoin="miter" aria-hidden="true"><rect x="3.5" y="5" width="17" height="14"/><path d="M3.5 15.5l5-5 4 4 2.5-2.5 5.5 5.5"/><circle cx="15.5" cy="9.5" r="1.25"/></svg>`},
  culture:  {for:"Upload music. Press play. Get ears.", ic:`<svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="square" stroke-linejoin="miter" aria-hidden="true"><path d="M9 17.5V5.5l10-2v12"/><circle cx="6.5" cy="17.5" r="2.5"/><circle cx="16.5" cy="15.5" r="2.5"/></svg>`},
  fashion:  {for:"Garments, styling and drops.",     ic:`<svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="square" stroke-linejoin="miter" aria-hidden="true"><path d="M12 7.5a2 2 0 1 0-2-2"/><path d="M12 7.5V9L3 16.5h18L12 9"/></svg>`},
  akatsuki: {for:"Anime, manga and ideas.",          ic:`<svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="square" stroke-linejoin="miter" aria-hidden="true"><path d="M12 3l2 7 7 2-7 2-2 7-2-7-7-2 7-2z"/></svg>`},
  casino:   {for:"News, features and promos.",       ic:`<svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="square" stroke-linejoin="miter" aria-hidden="true"><rect x="4" y="4" width="16" height="16"/><path d="M8 8.5h8M8 12h8M8 15.5h5"/></svg>`},
  tna:      {for:"Opportunities, code and money.",   ic:`<svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="square" stroke-linejoin="miter" aria-hidden="true"><rect x="3.5" y="7.5" width="17" height="12"/><path d="M9 7.5V4.5h6v3M3.5 12.5h17"/></svg>`},
};
const LABS = [
  {id:"hq",name:"General",channels:[
    {id:"general",label:"general",desc:"The main floor."},
    {id:"collab-posts",label:"collab-posts",desc:"Looking for a collaborator? Post here."}]},
  {id:"pharmacy",name:"Visual",channels:[
    {id:"creators",label:"creators",desc:"Who's here and what they make. Start here."},
    {id:"graphic-design",label:"graphic-design",desc:"Graphic work, feedback, process."},
    {id:"photography",label:"photography",desc:"Shots and edits."},
    {id:"cinematography",label:"cinematography",desc:"Moving image. Frames, grades, gear."},
    {id:"video-editing",label:"video-editing",desc:"Cuts, transitions, the work after the shoot."},
    {id:"archive",label:"archive",desc:"Every image ever posted. Searchable. Collectable.",archive:true}]},
  {id:"culture",name:"Music",channels:[
    {id:"tracks",label:"tracks",desc:"Upload your music. Press play on everyone's.",library:true},
    {id:"feedback",label:"feedback",desc:"Post your work in progress, get ears. Help someone finish."},
    {id:"beats",label:"beats",desc:"The Beat Lab. Loops become collabs.",beatlab:true}]},
  {id:"fashion",name:"Fashion",channels:[
    {id:"clothing-design",label:"clothing-design",desc:"Design work and concepts."},
    {id:"clothing-drops",label:"clothing-drops",desc:"What's releasing."}]},
  {id:"akatsuki",name:"Anime",channels:[
    {id:"anime-chat",label:"anime-chat",desc:"Anime discourse that feeds the design language."},
    {id:"manga",label:"manga",desc:"Panels, arcs, and the art of the page."},
    {id:"anime-news",label:"anime-news",desc:"Seasons, releases, and what's worth your time."},
    {id:"anime-ideas",label:"ideas",desc:"Half-formed concepts welcome."}]},
  {id:"casino",name:"News",channels:[
    {id:"magazine",label:"magazine",desc:"Longer reads, features, and coverage of the scene."},
    {id:"news",label:"news",desc:"What's happening in and around the network."},
    {id:"promos",label:"promos",desc:"Drops, releases, and rollouts — promote what's coming."}]},
  {id:"tna",name:"Business",channels:[
    {id:"opportunities",label:"opportunities",desc:"Gigs, briefs, and open calls inside the network."},
    {id:"coding",label:"coding",desc:"Sites, apps, and the interfaces the culture runs on."},
    {id:"finance",label:"finance",desc:"Money, rates, and not getting taken advantage of."}]},
];
const PRODUCTS=[
  {n:'"Free Me" Tee',p:"$54.99",w:"$65.00",u:"https://tnllabs.com/products/free-me-tee"},
  {n:"TNL x XSTART JDM Tee",p:"$50.00",w:null,u:"https://tnllabs.com/products/tnl-x-xstart-jdm-tee"}];
const levelFor=r=>LEVELS.reduce((a,l)=>r>=l.at?l:a,LEVELS[0]);
const avHTML=(u,cls)=>u&&u.avatarUrl?`<img class="av ${cls||""}" src="${esc(u.avatarUrl)}" alt="">`:`<div class="av ${cls||""}">${esc((u&&u.displayName||"?").slice(0,2).toUpperCase())}</div>`;
// Turn a raw body into safe HTML: escape first, THEN linkify. Never the
// other way round, or you've built an XSS hole.
function rich(t){
  let h=esc(t);
  h=h.replace(/(https?:\/\/[^\s<]+)/g,(u)=>`<a class="lnk" href="${u}" target="_blank" rel="noreferrer nofollow">${u.replace(/^https?:\/\//,"").slice(0,42)}${u.length>50?"…":""}</a>`);
  h=h.replace(/@([a-z0-9._]{2,20})/gi,(m,u)=>`<span class="mention" data-u="${esc(u.toLowerCase())}">@${esc(u)}</span>`);
  return h;
}
function firstUrl(t){const m=/(https?:\/\/[^\s<]+)/.exec(t||"");return m?m[1]:null}
function linkCard(url){
  try{
    const u=new URL(url);
    const host=u.hostname.replace(/^www\./,"");
    const yt=/(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/shorts\/)([\w-]{11})/.exec(url);
    if(yt)return `<a class="lcard yt" href="${esc(url)}" target="_blank" rel="noreferrer nofollow">
      <img src="https://img.youtube.com/vi/${esc(yt[1])}/hqdefault.jpg" alt="" loading="lazy">
      <div class="lcard-play">${DI.play}</div><div class="lcard-host mono">YOUTUBE</div></a>`;
    return `<a class="lcard" href="${esc(url)}" target="_blank" rel="noreferrer nofollow">
      <img class="lfav" src="https://www.google.com/s2/favicons?domain=${esc(host)}&sz=64" alt="" loading="lazy">
      <div><div class="lcard-t">${esc(host)}</div><div class="mono dim">${esc(u.pathname.slice(0,38))}</div></div>
      <span class="lcard-go">${DI.out}</span></a>`;
  }catch(e){return ""}
}
const esc=s=>String(s??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));

/* ---- api ---- */
async function req(path,opts={}){
  const h={"Content-Type":"application/json"};
  if(TOKEN)h.Authorization="Bearer "+TOKEN;
  const r=await fetch(API+path,{method:opts.method||"GET",headers:h,body:opts.body?JSON.stringify(opts.body):undefined});
  const d=await r.json().catch(()=>({}));
  if(!r.ok)throw new Error(d.error||("HTTP "+r.status));
  return d;
}
const api={
  register:b=>req("/api/auth/register",{method:"POST",body:b}),
  usernameCheck:u=>req("/api/auth/username?u="+encodeURIComponent(u)),
  login:b=>req("/api/auth/login",{method:"POST",body:b}),
  me:()=>req("/api/me"),
  updateMe:b=>req("/api/me",{method:"PATCH",body:b}),
  resend:()=>req("/api/auth/resend",{method:"POST"}),
  authStatus:()=>req("/api/auth/status"),

  feed:ch=>req("/api/feed"+(ch?("?channel="+encodeURIComponent(ch)):"")),
  showroom:()=>req("/api/feed/showroom"),
  builders:()=>req("/api/builders"),
  post:b=>req("/api/posts",{method:"POST",body:b}),
  tracks:q=>req("/api/tracks"+(q?"?q="+encodeURIComponent(q):"")),
  addTrack:b=>req("/api/tracks",{method:"POST",body:b}),
  myVideos:()=>req("/api/tracks/videos"),
  extractAudio:b=>req("/api/tracks/extract",{method:"POST",body:b}),
  trackPlay:id=>req("/api/tracks/"+id+"/play",{method:"POST"}),
  delTrack:id=>req("/api/tracks/"+id,{method:"DELETE"}),
  updateTrack:(id,b)=>req("/api/tracks/"+id,{method:"PATCH",body:b}),
  upload:data=>req("/api/upload",{method:"POST",body:{data}}),
  avatar:data=>req("/api/me/avatar",{method:"POST",body:{data}}),
  editPost:(id,body)=>req("/api/posts/"+id,{method:"PATCH",body:{body}}),
  delPost:id=>req("/api/posts/"+id,{method:"DELETE"}),

  comments:id=>req("/api/posts/"+id+"/comments"),
  addComment:(id,body)=>req("/api/posts/"+id+"/comments",{method:"POST",body:{body}}),
  editComment:(id,body)=>req("/api/comments/"+id,{method:"PATCH",body:{body}}),
  delComment:id=>req("/api/comments/"+id,{method:"DELETE"}),
  notifs:()=>req("/api/notifications"),
  readNotifs:()=>req("/api/notifications/read",{method:"POST"}),
  dmList:()=>req("/api/dm"),
  forgot:email=>req("/api/auth/forgot",{method:"POST",body:{email}}),
  search:(q,role)=>req("/api/search?q="+encodeURIComponent(q||"")+"&role="+encodeURIComponent(role||"")),
  unreads:()=>req("/api/unreads"),
  labs:()=>req("/api/labs"),
  archive:q=>req("/api/archive"+(q?"?"+q:"")),
  boards:()=>req("/api/boards"),
  board:id=>req("/api/boards/"+id),
  newBoard:b=>req("/api/boards",{method:"POST",body:b}),
  delBoard:id=>req("/api/boards/"+id,{method:"DELETE"}),
  pin:(bid,body)=>req("/api/boards/"+bid+"/pin",{method:"POST",body}),
  unpin:id=>req("/api/pins/"+id,{method:"DELETE"}),
  saves:id=>req("/api/posts/"+id+"/saves"),
  unfurl:url=>req("/api/unfurl",{method:"POST",body:{url}}),
  readChannel:ch=>req("/api/channels/"+encodeURIComponent(ch)+"/read",{method:"POST"}),
  mentionable:q=>req("/api/mentionable?q="+encodeURIComponent(q||"")),
  block:u=>req("/api/users/"+encodeURIComponent(u)+"/block",{method:"POST"}),
  report:b=>req("/api/report",{method:"POST",body:b}),
  mktMeta:()=>req("/api/market/meta"),
  connectStart:()=>req("/api/market/connect",{method:"POST"}),
  connectStatus:()=>req("/api/market/connect/status"),
  connectDash:()=>req("/api/market/connect/dashboard"),
  mkt:qs=>req("/api/market"+(qs?"?"+qs:"")),
  mktOne:id=>req("/api/market/"+id),
  mktCreate:b=>req("/api/market",{method:"POST",body:b}),
  mktUpdate:(id,b)=>req("/api/market/"+id,{method:"PATCH",body:b}),
  mktDelete:id=>req("/api/market/"+id,{method:"DELETE"}),
  mktLike:id=>req("/api/market/"+id+"/like",{method:"POST"}),
  mktOffer:(id,amount)=>req("/api/market/"+id+"/offer",{method:"POST",body:{amount}}),
  offerAct:(id,a)=>req("/api/offers/"+id+"/"+a,{method:"POST"}),
  mktBuy:(id,b)=>req("/api/market/"+id+"/buy",{method:"POST",body:b}),
  orders:()=>req("/api/orders"),
  sellerCard:u=>req("/api/sellers/"+encodeURIComponent(u)),
  review:(id,stars,body)=>req("/api/orders/"+id+"/review",{method:"POST",body:{stars,body}}),
  saved:()=>req("/api/market/saved"),
  grabLoop:id=>req("/api/market/"+id+"/download",{method:"POST"}),
  loopGrabs:id=>req("/api/market/"+id+"/downloads"),
  recentlyViewed:()=>req("/api/market/recent"),
  shipOrder:(id,tracking)=>req("/api/orders/"+id+"/ship",{method:"POST",body:{tracking}}),
  received:id=>req("/api/orders/"+id+"/received",{method:"POST"}),
  beats:()=>req("/api/beats"),
  samples:()=>req("/api/samples"),
  addSample:b=>req("/api/samples",{method:"POST",body:b}),
  delSample:id=>req("/api/samples/"+id,{method:"DELETE"}),
  sampleShape:(id,shape)=>req("/api/samples/"+id+"/shape",{method:"POST",body:shape}),
  library:slot=>req("/api/library"+(slot?"?slot="+encodeURIComponent(slot):"")),
  shareSample:(id,shared)=>req("/api/samples/"+id+"/share",{method:"POST",body:{shared}}),
  useLibrary:id=>req("/api/library/"+id+"/use",{method:"POST"}),
  sampleUses:id=>req("/api/samples/"+id+"/uses"),
  beat:id=>req("/api/beats/"+id),
  saveBeat:b=>req("/api/beats",{method:"POST",body:b}),
  delBeat:id=>req("/api/beats/"+id,{method:"DELETE"}),
  like:id=>req("/api/posts/"+id+"/like",{method:"POST"}),
  share:(id,b)=>req("/api/posts/"+id+"/share",{method:"POST",body:b||{}}),
  invite:(id,username)=>req("/api/posts/"+id+"/collab",{method:"POST",body:{username}}),
  accept:id=>req("/api/posts/"+id+"/collab/accept",{method:"POST"}),
  profile:u=>req("/api/users/"+encodeURIComponent(u)),
  follow:u=>req("/api/users/"+encodeURIComponent(u)+"/follow",{method:"POST"}),
  levels:()=>req("/api/levels"),
};

