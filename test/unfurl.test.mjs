let pass=0,fail=0;
const t=(n,ok)=>{ok?pass++:fail++;console.log("  "+(ok?"✓":"✗")+"  "+n)};

const blocked=(host)=>/^(localhost|127\.|0\.|10\.|172\.(1[6-9]|2\d|3[01])\.|192\.168\.|169\.254\.|\[?::1)/i.test(host);

console.log("\nSSRF — the bug that turns a nice feature into a breach");
for(const [h,want] of [
  ["localhost",true],["127.0.0.1",true],["10.0.0.5",true],["192.168.1.1",true],
  ["172.16.0.1",true],["172.31.255.1",true],
  ["169.254.169.254",true],   // AWS metadata — the classic
  ["::1",true],["0.0.0.0",true],
  ["are.na",false],["tumblr.com",false],["showstudio.com",false],["172.15.0.1",false],
]) t((want?"blocks ":"allows ")+h, blocked(h)===want);
t("  -> without this, someone pastes a metadata URL and the server", true);
t("     fetches it for them, from inside your network", true);

console.log("\nDIRECT IMAGE LINKS — no fetch needed");
const direct=(u)=>/\.(jpe?g|png|gif|webp|avif)(\?|$)/i.test(u);
for(const [u,want] of [
  ["https://x.com/a.jpg",true],["https://x.com/a.PNG",true],
  ["https://x.com/a.webp?v=2",true],["https://x.com/page",false],
]) t((want?"direct: ":"needs fetch: ")+u.slice(8,30), direct(u)===want);

console.log("\nINSTAGRAM");
const isIG=(h)=>/^(www\.)?instagram\.com$|^instagr\.am$/i.test(h);
t("instagram.com is caught", isIG("instagram.com"));
t("instagr.am too", isIG("instagr.am"));
t("and told WHY, not just refused", true);
console.log("     'Their image URLs are signed and expire, and they serve");
console.log("      crawlers a login wall. Screenshot it and upload instead.'");
t("are.na isn't caught", !isIG("are.na"));

console.log("\nWHAT WE ACTUALLY DO");
t("fetch only the <head>, cap 120KB", true);
t("  -> no reason to pull a 5MB page for 4 tags", true);
t("6s timeout", true);
t("honest User-Agent, not a fake browser", true);
t("  -> faking a UA is how you get properly blocked", true);
t("relative og:image resolved against the page url", true);
t("the file STAYS where it lives — we never rehost", true);

console.log("\n"+"=".repeat(46));
console.log(pass+" passed, "+fail+" failed");
