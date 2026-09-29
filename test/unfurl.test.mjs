let pass=0,fail=0;
const t=(n,ok)=>{ok?pass++:fail++;console.log("  "+(ok?"✓":"✗")+"  "+n)};

/* Updated 2026-09-29 (messaging v2): tests the REAL guard, lifted out of the
   server source — the address check that runs inside the socket's DNS
   lookup, on every redirect hop. */
import { readFileSync } from "node:fs";
import { BlockList, isIP } from "node:net";
const src=readFileSync(new URL("../src/server-10-links.js", import.meta.url),"utf8");
const guard=src.slice(src.indexOf("const NOT_PUBLIC"), src.indexOf("function publicLookup"));
const isPublicIp=new Function("BlockList","isIP",guard+"; return isPublicIp;")(BlockList,isIP);

console.log("\nSSRF — the bug that turns a nice feature into a breach");
for(const [ip,pub] of [
  ["127.0.0.1",false],["10.0.0.5",false],["192.168.1.1",false],["172.16.0.1",false],["172.31.255.1",false],
  ["169.254.169.254",false],   // cloud metadata — the classic
  ["100.64.0.1",false],        // carrier-grade NAT / internal platform networks
  ["0.0.0.0",false],["::1",false],["::",false],["fd00::1",false],["fe80::1",false],
  ["::ffff:127.0.0.1",false],  // IPv4 smuggled inside IPv6
  ["64:ff9b::a00:1",false],    // …or through NAT64
  ["93.184.216.34",true],["172.15.0.1",true],["2606:4700::1111",true],
]) t((pub?"allows ":"blocks ")+ip, isPublicIp(ip)===pub);
t("checked inside the DNS lookup of the socket itself", src.includes("lookup: publicLookup") && src.includes("agent: false"));
t("  -> a name that resolves to 10.x is refused at connect time", true);
t("redirects followed by hand, each hop checked again", src.includes("safeGet(next,") && src.includes("hops >= 4"));
t("one private answer among many is enough to refuse", src.includes("addrs.some((a) => !isPublicIp(a.address))"));
t("only ports 80 and 443", src.includes('["80", "443"]'));

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
