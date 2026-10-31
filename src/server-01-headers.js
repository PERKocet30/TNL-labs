/* ================================================================
   BROWSER SAFETY HEADERS v1.0 — 2026-10-30 ("optimize Cloudflare" —
   Cloudflare passes these straight on to the browser).
   · HSTS: only over https (Cloudflare says so in X-Forwarded-Proto), a
     year, this host only — no subdomains, so nothing else under
     tnllabs.com is forced to https.
   · nosniff: a file is what its type says, never guessed.
   · strict-origin-when-cross-origin: a site someone leaves LABS for sees
     "tnllabs.com", never the page they were on (a profile, a post).
================================================================ */
function browserHeaders(req, res, next) {   // used first thing, in server-01-boot
  if (req.secure || req.get("x-forwarded-proto") === "https") res.set("Strict-Transport-Security", "max-age=31536000");
  res.set("X-Content-Type-Options", "nosniff");
  res.set("Referrer-Policy", "strict-origin-when-cross-origin");
  next();
}
