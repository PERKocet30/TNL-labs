/* ================================================================
   SIGN IN WITH GOOGLE OR APPLE v1.0 — 2026-10-20. "We should make it so
   you can sign up with Google or Apple like most apps." Each is off until
   Railway → Variables has its keys (RAILWAY.md):
     Google  GOOGLE_CLIENT_ID + GOOGLE_CLIENT_SECRET (a free OAuth client)
     Apple   APPLE_SERVICES_ID (a Services ID; needs the Apple Developer
             account). Sign-in only needs Apple's signed id_token, so no
             private key lives here.
   The flow:
     GET  /api/auth/oauth/:p/start     → the provider, with a one-use state + nonce
     …/google/callback (GET, ?code)    → we trade the code for Google's id_token
     …/apple/callback  (POST form)     → Apple posts its id_token straight back
   Every id_token is checked here: RS256 against the provider's published
   keys, issuer, audience (our id), expiry and our nonce.
   Then: a known identity → signed in. A verified email that already has
   an account → linked and signed in (if that account never confirmed its
   email, its password and sessions are wiped first, so nobody who
   pre-registered someone else's address keeps a way in). Anyone new →
   the join flow without the email and password screens: name, username,
   what you make (register takes the ticket instead of a password).
   The browser only ever carries one-use codes (?signin= / ?signup=),
   traded at POST /api/auth/oauth/claim — never a session token in a URL.
   Each code comes back with the browser's own random mark (?b=, sent to
   /start and kept in its storage), so a code in a link someone sends you
   can't sign you into their account or start an account they can enter.
   test/oauth.test.mjs runs the whole thing against a pretend provider.
================================================================ */
db.exec(`CREATE TABLE IF NOT EXISTS user_identities (
  provider TEXT NOT NULL, sub TEXT NOT NULL, user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  email TEXT, created_at INTEGER NOT NULL, PRIMARY KEY (provider, sub))`);
const env = (k, d) => (process.env[k] || "").trim() || d;
const OAUTH = {
  google: {
    id: env("GOOGLE_CLIENT_ID"), secret: env("GOOGLE_CLIENT_SECRET"), scope: "openid email profile",
    auth: env("GOOGLE_AUTH_URL", "https://accounts.google.com/o/oauth2/v2/auth"),
    token: env("GOOGLE_TOKEN_URL", "https://oauth2.googleapis.com/token"),
    jwks: env("GOOGLE_JWKS_URL", "https://www.googleapis.com/oauth2/v3/certs"),
    iss: [env("GOOGLE_ISSUER", "https://accounts.google.com"), "accounts.google.com"],
  },
  apple: {
    id: env("APPLE_SERVICES_ID"), scope: "name email",
    auth: env("APPLE_AUTH_URL", "https://appleid.apple.com/auth/authorize"),
    jwks: env("APPLE_JWKS_URL", "https://appleid.apple.com/auth/keys"),
    iss: [env("APPLE_ISSUER", "https://appleid.apple.com")],
  },
};
const oauthOn = (p) => !!(OAUTH[p] && OAUTH[p].id && (p !== "google" || OAUTH[p].secret));
const oauthSite = () => ({ google: oauthOn("google"), apple: oauthOn("apple") });   // /api/levels → site.oauth

/* Short-lived, one-use things, in memory (one server; a restart just means "try again"). */
const OA_STATES = new Map(), OA_CODES = new Map();
function oaPut(map, value, ms) {
  const now = Date.now();
  for (const [k, v] of map) if (v.exp < now) map.delete(k);
  if (map.size > 5000) map.delete(map.keys().next().value);
  const key = randomBytes(18).toString("hex");
  map.set(key, { ...value, exp: now + ms });
  return key;
}
function oaGet(map, key, take) {
  const v = map.get(String(key || ""));
  if (!v || v.exp < Date.now()) { map.delete(String(key || "")); return null; }
  if (take) map.delete(String(key));
  return v;
}
const oaRedirect = (req, p) => `${baseUrl(req)}/api/auth/oauth/${p}/callback`;
const oaFail = (res, why) => res.redirect(303, `/?oauth_error=${encodeURIComponent(why)}`);

/* The provider's signing keys, kept an hour (fetched again for a key we haven't seen). */
const OA_KEYS = new Map();
async function oaKey(url, kid) {
  let c = OA_KEYS.get(url);
  if (!c || Date.now() - c.at > 3600000 || !c.keys.some((k) => k.kid === kid)) {
    const r = await fetch(url, { signal: AbortSignal.timeout(8000) });
    if (!r.ok) throw new Error("keys " + r.status);
    c = { at: Date.now(), keys: ((await r.json()) || {}).keys || [] };
    OA_KEYS.set(url, c);
  }
  return c.keys.find((k) => k.kid === kid) || null;
}
const b64u = (s) => Buffer.from(String(s), "base64url");
async function oaVerify(p, jwt, nonce) {
  const cfg = OAUTH[p], [h, b, s] = String(jwt || "").split(".");
  if (!h || !b || !s) throw new Error("not a token");
  const head = JSON.parse(b64u(h)), c = JSON.parse(b64u(b));
  if (head.alg !== "RS256") throw new Error("unexpected alg");
  const jwk = await oaKey(cfg.jwks, head.kid);
  if (!jwk) throw new Error("unknown key");
  if (!cryptoVerify("RSA-SHA256", Buffer.from(h + "." + b), createPublicKey({ key: jwk, format: "jwk" }), b64u(s))) throw new Error("bad signature");
  const now = Date.now() / 1000;
  if (!cfg.iss.includes(c.iss)) throw new Error("wrong issuer");
  if ((Array.isArray(c.aud) ? !c.aud.includes(cfg.id) : c.aud !== cfg.id)) throw new Error("wrong audience");
  if (!(c.exp > now - 60) || (c.iat && c.iat > now + 300)) throw new Error("expired");
  if (!nonce || c.nonce !== nonce) throw new Error("wrong nonce");
  return c;
}

function oaLink(user, p, sub, email) {
  db.prepare(`INSERT OR IGNORE INTO user_identities (provider, sub, user_id, email, created_at) VALUES (?, ?, ?, ?, ?)`).run(p, sub, user.id, email || null, Date.now());
  if (!user.email_verified) {
    /* Never confirmed: whoever typed this address in may not own it. The owner just proved they do. */
    db.prepare(`DELETE FROM sessions WHERE user_id = ?`).run(user.id);
    db.prepare(`UPDATE users SET password_hash = ? WHERE id = ?`).run(bcrypt.hashSync(randomBytes(24).toString("hex"), 10), user.id);
    q.markVerified.run(user.id);
  }
}
function oaFinish(res, p, c, nameHint, b) {
  const sub = String(c.sub || ""), email = String(c.email || "").trim();
  const verified = c.email_verified === true || c.email_verified === "true";
  if (!sub) return oaFail(res, "failed");
  let user = null;
  const idn = db.prepare(`SELECT user_id FROM user_identities WHERE provider = ? AND sub = ?`).get(p, sub);
  if (idn) user = q.userById.get(idn.user_id);
  if (!user && email && verified) {
    user = usersByEmail(email)[0] || null;
    if (user && !user.suspended) { oaLink(user, p, sub, email); user = q.userById.get(user.id); }   // a suspended account is left as it is
  }
  if (user) {
    if (user.suspended) return oaFail(res, "suspended");
    const token = randomBytes(24).toString("hex");
    q.createSession.run(token, user.id, Date.now());
    console.log(`[auth] @${user.username} signed in with ${p}`);
    return res.redirect(303, `/?signin=${oaPut(OA_CODES, { token, userId: user.id }, 120000)}&b=${b}`);
  }
  if (!email || !verified) return oaFail(res, "noemail");
  if (!settingBool("signupsOpen")) return oaFail(res, "closed");
  const name = String(nameHint || c.name || c.given_name || "").replace(/\s+/g, " ").trim().slice(0, 28);
  res.redirect(303, `/?signup=${oaPut(OA_CODES, { signup: { p, sub, email, name } }, 1800000)}&b=${b}`);
}

const oaLimit = rateLimit({ max: 30, windowMs: 600000 });
app.get("/api/auth/oauth/:p/start", oaLimit, (req, res) => {
  const p = req.params.p, cfg = OAUTH[p];
  if (!oauthOn(p)) return oaFail(res, "off");
  const b = String(req.query.b || "");
  if (!/^[a-f0-9]{16,64}$/.test(b)) return oaFail(res, "failed");   // the browser's mark (see above)
  const nonce = randomBytes(18).toString("hex"), state = oaPut(OA_STATES, { p, nonce, b }, 600000);
  const qs = new URLSearchParams({ client_id: cfg.id, redirect_uri: oaRedirect(req, p), scope: cfg.scope, state, nonce,
    ...(p === "apple" ? { response_type: "code id_token", response_mode: "form_post" } : { response_type: "code", prompt: "select_account" }) });
  res.redirect(302, `${cfg.auth}?${qs}`);
});
app.get("/api/auth/oauth/google/callback", oaLimit, async (req, res) => {
  const st = oaGet(OA_STATES, req.query.state, true);
  if (!st || st.p !== "google" || !oauthOn("google")) return oaFail(res, "expired");
  if (req.query.error || !req.query.code) return oaFail(res, "cancelled");
  try {
    const cfg = OAUTH.google;
    const r = await fetch(cfg.token, { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, signal: AbortSignal.timeout(10000),
      body: new URLSearchParams({ code: String(req.query.code), client_id: cfg.id, client_secret: cfg.secret, redirect_uri: oaRedirect(req, "google"), grant_type: "authorization_code" }) });
    const j = await r.json().catch(() => ({}));
    if (!r.ok || !j.id_token) throw new Error("token " + r.status);
    oaFinish(res, "google", await oaVerify("google", j.id_token, st.nonce), "", st.b);
  } catch (e) { logError("auth", "google sign-in: " + e.message, "", req.path, ""); oaFail(res, "failed"); }
});
app.post("/api/auth/oauth/apple/callback", oaLimit, express.urlencoded({ extended: false, limit: "20kb" }), async (req, res) => {
  const b = req.body || {}, st = oaGet(OA_STATES, b.state, true);
  if (!st || st.p !== "apple" || !oauthOn("apple")) return oaFail(res, "expired");
  if (b.error || !b.id_token) return oaFail(res, "cancelled");
  try {
    const c = await oaVerify("apple", b.id_token, st.nonce);
    let name = "";   // Apple sends the name once, the first time, beside the token
    try { const n = JSON.parse(b.user || "{}").name || {}; name = [n.firstName, n.lastName].filter(Boolean).join(" "); } catch {}
    oaFinish(res, "apple", c, name, st.b);
  } catch (e) { logError("auth", "apple sign-in: " + e.message, "", req.path, ""); oaFail(res, "failed"); }
});

/* The app trades the code from the address bar: a session, or the start of joining. */
app.post("/api/auth/oauth/claim", oaLimit, (req, res) => {
  const code = String(req.body?.code || ""), v = oaGet(OA_CODES, code, false);
  if (!v) return res.status(410).json({ error: "That sign-in expired. Try again." });
  if (v.token) {
    OA_CODES.delete(code);
    const u = q.userById.get(v.userId);
    if (!u || u.suspended) return res.status(403).json({ error: "This account can't sign in." });
    return res.json({ token: v.token, user: publicUser(u) });
  }
  res.json({ signup: { email: v.signup.email, name: v.signup.name, provider: v.signup.p } });
});
/* register (server-02) takes the ticket in place of an email and password. */
const oauthTicket = (code) => { const v = oaGet(OA_CODES, code, false); return v && v.signup ? v.signup : null; };
function oauthJoined(userId, code) {
  const t = oauthTicket(code);
  if (!t) return;
  OA_CODES.delete(String(code));
  db.prepare(`INSERT OR IGNORE INTO user_identities (provider, sub, user_id, email, created_at) VALUES (?, ?, ?, ?, ?)`).run(t.p, t.sub, userId, t.email, Date.now());
  q.markVerified.run(userId);
}
