/* ================================================================
   ARE YOU A PERSON? (Cloudflare Turnstile) v1.0 — 2026-10-30
   "I like all the Cloudflare stuff, let's optimize Cloudflare." Bots made
   accounts to vote in the tournament (server/trust/signals, -spam). Joining
   with an email and password now carries a Turnstile token, checked with
   Cloudflare before the account is made. Most people never see it — the
   check only shows a box when Cloudflare isn't sure.
   · Off until both keys are in Railway → Variables: TURNSTILE_SITE_KEY
     and TURNSTILE_SECRET (Cloudflare → Turnstile → Add site, tnllabs.com).
   · Google, Apple and Facebook sign-ups skip it: they've proved a person.
   · If Cloudflare can't be reached, the join goes through (logged) —
     an outage there never closes the door here.
   The app asks for the token from public/human.js, loaded only at Join.
================================================================ */
const tsSecret = () => String(process.env.TURNSTILE_SECRET || "").trim();
function tsSiteKey() { const k = String(process.env.TURNSTILE_SITE_KEY || "").trim(); return k && tsSecret() ? k : ""; }
const TS_VERIFY = process.env.TURNSTILE_VERIFY_URL || "https://challenges.cloudflare.com/turnstile/v0/siteverify";   // a test points this elsewhere
app.use(async (req, res, next) => {
  if (req.method !== "POST" || req.path !== "/api/auth/register" || !tsSiteKey() || req.body?.oauth) return next();
  const token = String(req.body?.turnstile || "");
  if (!token || token.length > 2048) return res.status(400).json({ error: "Couldn't check you're a person — tap Join again.", human: true });
  try {
    const r = await fetch(TS_VERIFY, { method: "POST", body: new URLSearchParams({ secret: tsSecret(), response: token, remoteip: clientIp(req) || "" }), signal: AbortSignal.timeout(6000) });
    const d = await r.json();
    if (d.success) return next();
    console.log("[turnstile] refused a join:", (d["error-codes"] || []).join(",") || "no reason");
    return res.status(400).json({ error: "Couldn't check you're a person — tap Join again.", human: true });
  } catch (e) {
    console.error("[turnstile] Cloudflare unreachable, letting this join through:", e.message);
    next();
  }
});
