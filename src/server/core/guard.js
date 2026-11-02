/* ── GUARDS · v1.1 · 2026-10-28 (loops are gone: no cleanBeat, no preview) · v1.0 · 2026-10-27 ───────────────────────────────────────
   Checks several routes share, from the security review of 2026-10-27.
   1. clientIp      who is really asking (rate limits, signals)
   2. rateLimitBy   a limit on the account being tried, not the address
   3. (cleanBeat — removed 2026-10-28 with loops)
   4. mailLinkOk    when a reset / confirm link may be shown on screen
   5. canShip /     an order only moves forward once it's paid
      canReceive
   6. loopAudio     a loop listing's file never leaves the server
   BlockList and isIP come from the import in server/posts/links (one module). */

/* 1 ── Cloudflare's published ranges (cloudflare.com/ips). CF-Connecting-IP
   is only true when Cloudflare sent it; anyone reaching Railway directly
   can type that header themselves. Railway's X-Real-IP is the address that
   actually connected to it, so: from Cloudflare → believe the CF header;
   from anywhere else → that address is the visitor. Loopback (tests, a
   laptop) is trusted so the suites can play different visitors. */
const CF_NETS = new BlockList();
for (const n of ["173.245.48.0/20", "103.21.244.0/22", "103.22.200.0/22", "103.31.4.0/22", "141.101.64.0/18",
  "108.162.192.0/18", "190.93.240.0/20", "188.114.96.0/20", "197.234.240.0/22", "198.41.128.0/17",
  "162.158.0.0/15", "104.16.0.0/13", "104.24.0.0/14", "172.64.0.0/13", "131.0.72.0/22"]) {
  const [a, p] = n.split("/"); CF_NETS.addSubnet(a, Number(p), "ipv4");
}
for (const n of ["2400:cb00::/32", "2606:4700::/32", "2803:f800::/32", "2405:b500::/32", "2405:8100::/32",
  "2a06:98c0::/29", "2c0f:f248::/32"]) {
  const [a, p] = n.split("/"); CF_NETS.addSubnet(a, Number(p), "ipv6");
}
const bareIp = (s) => String(s || "").trim().replace(/^::ffff:(?=\d+\.\d+\.\d+\.\d+$)/, "");
const ipKind = (ip) => { const v = isIP(ip); return v === 4 ? "ipv4" : v === 6 ? "ipv6" : null; };
function clientIp(req) {
  const hops = String(req.get("x-forwarded-for") || "").split(",").map(bareIp).filter(Boolean);
  const edge = bareIp(req.get("x-real-ip")) || hops[hops.length - 1] || bareIp(req.socket?.remoteAddress);
  const cf = bareIp(req.get("cf-connecting-ip")).slice(0, 64);   // only ever a bucket / hash key
  const viaCf = ipKind(edge) && (CF_NETS.check(edge, ipKind(edge)) || edge === "127.0.0.1" || edge === "::1");
  return cf && viaCf ? cf : edge || "?";
}

/* 2 ── Same sliding window as rateLimit (server/core/boot), keyed on what the
   request is about. Login: 10 tries per account per 15 min whatever address
   they come from, so a rotating IP can't guess a password forever. */
function rateLimitBy(pick, { max, windowMs }) {
  return (req, res, next) => {
    const what = String(pick(req) || "").trim().toLowerCase().slice(0, 200);
    if (!what) return next();
    const id = `by:${req.route?.path || req.path}:${what}`, now = Date.now();
    const hits = (buckets.get(id) || []).filter((t) => now - t < windowMs);
    if (hits.length >= max) {
      const retry = Math.ceil((windowMs - (now - hits[0])) / 1000);
      res.set("Retry-After", String(retry));
      return res.status(429).json({ error: `Too many tries — wait ${retry}s` });
    }
    hits.push(now); buckets.set(id, hits); next();
  };
}

/* 4 ── A reset or confirm link on screen is a shortcut for testing on a
   laptop with no mail set up. Anywhere else, a failed send (quota, outage)
   must not hand the link to whoever asked — that's anyone's account. */
const ON_RAILWAY = !!(process.env.RAILWAY_ENVIRONMENT_NAME || process.env.RAILWAY_PROJECT_ID);
const mailLinkOk = (result) => !ON_RAILWAY && !!result && !result.sent && result.reason === "no_key";

/* 5 ── Paid, or arrange-mode (no Stripe session) waiting on the seller.
   A Stripe order still waiting for its money can't be shipped or received:
   both count as "paid" everywhere else (stats, rep, loop downloads). */
const canShip = (o) => o.status === "paid" || (o.status === "pending" && !o.payment_ref);
const canReceive = (o) => o.status === "paid" || o.status === "shipped";

/* 6 ── Loops are gone from LABS (2026-10-28): none can be listed and none
   are shown. If an old loop row ever surfaces, its file stays put. */
function loopAudio(r) {
  return { audioUrl: r.kind === "loop" ? null : r.audio_url || null };
}
