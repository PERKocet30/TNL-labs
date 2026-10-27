/* ── HONEST ACCOUNTS · v1.0 · 2026-10-27 ──────────────────────────────
   "I don't want to hurt real people joining the app. But I need to stop
   fake accounts from being possible." Two rules that a real person never
   meets:
   1. No throwaway emails. An address at a disposable-mail service
      (mailinator, 10minutemail, the *.dpdns.org inboxes that showed up in
      last night's burst) can't make an account. TNL_BLOCK_EMAIL_DOMAINS
      adds more, comma-separated, without a deploy.
   2. One vote per phone. The app marks each phone once (X-Device, a random
      id kept in its storage, app-07-device.js); server-10-events-2-routes
      counts one vote per phone per piece per day, whatever the account.
   test/honest.test.mjs */
const THROWAWAY = new Set(("mailinator.com,guerrillamail.com,guerrillamail.net,guerrillamail.org,sharklasers.com,grr.la,10minutemail.com,10minutemail.net,"
  + "tempmail.com,temp-mail.org,temp-mail.io,tempmailo.com,tempail.com,yopmail.com,yopmail.fr,trashmail.com,trashmail.me,trash-mail.com,getnada.com,nada.email,"
  + "dispostable.com,maildrop.cc,mailnesia.com,mintemail.com,throwawaymail.com,fakeinbox.com,mohmal.com,emailondeck.com,burnermail.io,mytemp.email,"
  + "tempr.email,discard.email,spamgourmet.com,mailcatch.com,inboxkitten.com,harakirimail.com,33mail.com,mailsac.com,tmail.ws,tmpmail.net,tmpmail.org,"
  + "hilmail.com,hilmail.dpdns.org,dpdns.org,mail.tm,internxt.com,guerrillamailblock.com,spam4.me,1secmail.com,1secmail.net,1secmail.org,emailfake.com,"
  + "crazymailing.com,luxusmail.org,tempmailaddress.com,fakemail.net,mailtemp.net,eyepaste.com,tempinbox.com,"
  + (process.env.TNL_BLOCK_EMAIL_DOMAINS || "")).split(",").map((d) => d.trim().toLowerCase()).filter(Boolean));
/* true when the address is at a throwaway service — the domain itself or anything under it (x.y.dpdns.org) */
function emailThrowaway(email) {
  const dom = String(email || "").trim().toLowerCase().split("@")[1] || "";
  if (!dom) return false;
  const parts = dom.split(".");
  for (let i = 0; i < parts.length - 1; i++) if (THROWAWAY.has(parts.slice(i).join("."))) return true;
  return false;
}
/* the phone's mark, or "" when the app didn't send one (an old page, a script) */
const deviceOf = (req) => { const d = String(req.get("x-device") || "").trim().toLowerCase(); return /^[a-f0-9]{16,32}$/.test(d) ? d : ""; };
