/* ── MARKET SHARE · v1.0 · 2026-10-20 ─────────────────────────────────
   "The market should have a description like labs do as well and a share
   button." One line under the Market's name says what it's for (like each
   lab's LAB_PITCH), and Share sends that line with a link that opens the
   Market for anyone — /shop, whose link preview carries the same words
   (MARKET_PITCH in server-12-policies.js; test/market-share.test.mjs
   checks they match). No share sheet (Instagram's in-app browser, most
   computers): the message is copied, ready to paste. */
const MARKET_PITCH="Buy and sell what creatives make: clothing, art and prints.";
async function shareMarket(){
  const url=location.origin+"/shop",title="LABS Market",text=title+"\n"+MARKET_PITCH;
  if(navigator.share){try{await navigator.share({title,text,url});return}catch(e){if(e&&e.name==="AbortError")return}}
  const all=text+"\n"+url;
  try{await navigator.clipboard.writeText(all);toast("Copied: the caption and the link. Paste it anywhere.");return}catch(e){}
  await uiPrompt("Copy and send this",{value:all,okLabel:"Done"});
}
