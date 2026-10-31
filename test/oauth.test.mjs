// Continue with Google or Apple (2026-10-20): "sign up with Google or Apple
// like most apps". The whole flow against a pretend provider: our own signing
// keys, token endpoint and key list stand in for Google's and Apple's.
import { spawn } from "node:child_process";
import { createServer } from "node:http";
import { generateKeyPairSync, sign, createHmac } from "node:crypto";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { rmSync, mkdirSync, readFileSync } from "node:fs";
import bcrypt from "bcryptjs";
const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const DATA = join(ROOT, "test/.tmp/oauth");
rmSync(DATA, { recursive: true, force: true }); mkdirSync(DATA, { recursive: true });
process.env.TNL_DATA = DATA;
const { db } = await import(join(ROOT, "src/db.js"));
let pass = 0, fail = 0;
const read = (f) => readFileSync(join(ROOT, f), "utf8");
const t = (n, ok) => { ok ? pass++ : fail++; console.log("  " + (ok ? "✓" : "✗") + "  " + n); };
const now = Date.now(), hash = bcrypt.hashSync("violet-kiln-27", 4);
const mk = (u, email, verified = 1, extra = "") => { const id = Number(db.prepare(`INSERT INTO users (username, display_name, email, password_hash, created_at, email_verified${extra ? ", suspended" : ""}) VALUES (?,?,?,?,?,?${extra ? ",1" : ""})`).run(u, u, email, hash, now, verified).lastInsertRowid);
  db.prepare(`INSERT INTO sessions (token, user_id, created_at) VALUES (?,?,?)`).run("tok-" + u, id, now); return id; };
mk("boss", "boss@x.test"); mk("ana", "ana@x.test"); mk("squatter", "victim@x.test", 0); mk("banned", "banned@x.test", 1, "s");
db.prepare(`INSERT INTO settings (key, value, updated_at) VALUES ('signinFacebook','1',?)`).run(Date.now());   // Facebook starts off in Settings (2026-10-26); this suite tests it on
db.close();

/* the pretend provider */
const { privateKey, publicKey } = generateKeyPairSync("rsa", { modulusLength: 2048 });
const other = generateKeyPairSync("rsa", { modulusLength: 2048 }).privateKey;
const jwk = { ...publicKey.export({ format: "jwk" }), kid: "k1", alg: "RS256", use: "sig" };
const jwt = (claims, key = privateKey, kid = "k1") => { const h = Buffer.from(JSON.stringify({ alg: "RS256", kid })).toString("base64url"), b = Buffer.from(JSON.stringify(claims)).toString("base64url");
  return `${h}.${b}.${sign("RSA-SHA256", Buffer.from(h + "." + b), key).toString("base64url")}`; };
const CODES = new Map();
const MP = 8901, MOCK = `http://localhost:${MP}`;
const mock = createServer((rq, rs) => {
  if (rq.url === "/jwks") { rs.setHeader("Content-Type", "application/json"); return rs.end(JSON.stringify({ keys: [jwk] })); }
  if (rq.url === "/token" && rq.method === "POST") { let s = ""; rq.on("data", (c) => (s += c)); rq.on("end", () => {
    const f = new URLSearchParams(s), c = CODES.get(f.get("code"));
    rs.setHeader("Content-Type", "application/json");
    if (!c || f.get("client_secret") !== "g-secret" || !/\/api\/auth\/oauth\/google\/callback$/.test(f.get("redirect_uri"))) { rs.statusCode = 400; return rs.end("{}"); }
    rs.end(JSON.stringify({ id_token: c })); }); return; }
  /* Facebook: a code → a token (GET, with our secret), then /me says who that token is */
  if (rq.url.startsWith("/fbtoken?")) { const f = new URL(rq.url, MOCK).searchParams, c = FB.get(f.get("code"));
    rs.setHeader("Content-Type", "application/json");
    if (!c || f.get("client_secret") !== "f-secret" || !/\/api\/auth\/oauth\/facebook\/callback$/.test(f.get("redirect_uri"))) { rs.statusCode = 400; return rs.end("{}"); }
    return rs.end(JSON.stringify({ access_token: "fbt-" + f.get("code"), token_type: "bearer", expires_in: 5000000 })); }
  if (rq.url.startsWith("/fbme?")) { const f = new URL(rq.url, MOCK).searchParams, c = FB.get(String(f.get("access_token")).slice(4));
    rs.setHeader("Content-Type", "application/json");
    const proof = createHmac("sha256", "f-secret").update(String(f.get("access_token"))).digest("hex");
    if (!c || f.get("appsecret_proof") !== proof || f.get("fields") !== "id,name,email") { rs.statusCode = 400; return rs.end("{}"); }
    return rs.end(JSON.stringify(c)); }
  rs.statusCode = 404; rs.end();
}).listen(MP);
const FB = new Map();

const PORT = 8902, B = `http://localhost:${PORT}`;
const srv = spawn(process.execPath, ["--experimental-sqlite", "--no-warnings", "src/server.runtime.js"], {
  cwd: ROOT, stdio: "ignore", env: { ...process.env, TNL_DATA: DATA, PORT: String(PORT), STRIPE_SECRET_KEY: "", TNL_NO_VIDEO_FIX: "1", TNL_NO_WATCH: "1", PUBLIC_URL: B,
    GOOGLE_CLIENT_ID: "g-client", GOOGLE_CLIENT_SECRET: "g-secret", GOOGLE_AUTH_URL: MOCK + "/auth", GOOGLE_TOKEN_URL: MOCK + "/token", GOOGLE_JWKS_URL: MOCK + "/jwks",
    APPLE_SERVICES_ID: "com.labs.test", APPLE_AUTH_URL: MOCK + "/apple", APPLE_JWKS_URL: MOCK + "/jwks",
    FACEBOOK_APP_ID: "f-app", FACEBOOK_APP_SECRET: "f-secret", FACEBOOK_AUTH_URL: MOCK + "/fbauth", FACEBOOK_TOKEN_URL: MOCK + "/fbtoken", FACEBOOK_ME_URL: MOCK + "/fbme" } });
const go = (path, o = {}) => fetch(B + path, { redirect: "manual", ...o });
const json = async (path, body, tok) => { const r = await fetch(B + path, { method: body ? "POST" : "GET", headers: { "Content-Type": "application/json", ...(tok ? { Authorization: "Bearer " + tok } : {}) }, body: body ? JSON.stringify(body) : undefined });
  return { s: r.status, j: await r.json().catch(() => ({})) }; };
/* start → (the provider) → our callback; returns where we sent the browser */
async function google(claims, tweak = {}) {
  const st = new URL((await go("/api/auth/oauth/google/start?mode=join&b=" + MARK)).headers.get("location"));
  const p = st.searchParams, code = "c" + Math.random();
  CODES.set(code, jwt({ iss: "https://accounts.google.com", aud: "g-client", exp: Math.floor(Date.now() / 1000) + 600, nonce: p.get("nonce"), ...claims, ...tweak.claims }, tweak.key, tweak.kid));
  return { st, loc: (await go(`/api/auth/oauth/google/callback?code=${code}&state=${tweak.state || p.get("state")}`)).headers.get("location") || "" };
}
async function apple(claims, user) {
  const st = new URL((await go("/api/auth/oauth/apple/start?mode=join&b=" + MARK)).headers.get("location")), p = st.searchParams;
  const body = new URLSearchParams({ state: p.get("state"), code: "x", id_token: jwt({ iss: "https://appleid.apple.com", aud: "com.labs.test", exp: Math.floor(Date.now() / 1000) + 600, nonce: p.get("nonce"), ...claims }), ...(user ? { user: JSON.stringify(user) } : {}) });
  return { st, loc: (await go("/api/auth/oauth/apple/callback", { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body })).headers.get("location") || "" };
}
async function facebook(me, tweak = {}) {
  const st = new URL((await go("/api/auth/oauth/facebook/start?mode=join&b=" + MARK)).headers.get("location")), p = st.searchParams, code = "f" + Math.random();
  FB.set(code, me);
  return { st, loc: (await go(`/api/auth/oauth/facebook/callback?code=${tweak.code || code}&state=${tweak.state || p.get("state")}${tweak.q || ""}`)).headers.get("location") || "" };
}
const MARK = "0123456789abcdef0123456789abcdef";   // the browser's own mark (app/gate/oauth)
const code = (loc, k) => new URL(loc, B).searchParams.get(k);
try {
  for (let i = 0; i < 100; i++) { try { if ((await fetch(B + "/api/health")).ok) break; } catch {} await new Promise((r) => setTimeout(r, 100)); }
  console.log("\nSWITCHED ON BY ITS KEYS");
  t("the app is told which buttons to show", JSON.stringify((await json("/api/levels")).j.site.oauth) === '{"google":true,"apple":true,"facebook":true}');
  t("an unknown provider is off", /oauth_error=off/.test((await go("/api/auth/oauth/myspace/start")).headers.get("location")));
  t("a start without this browser's mark goes nowhere", /oauth_error=failed/.test((await go("/api/auth/oauth/google/start")).headers.get("location")));
  const g0 = new URL((await go("/api/auth/oauth/google/start?b=" + MARK)).headers.get("location"));
  t("Google: our client, our callback, a state and a nonce", g0.origin + g0.pathname === MOCK + "/auth" && g0.searchParams.get("client_id") === "g-client" && g0.searchParams.get("redirect_uri") === B + "/api/auth/oauth/google/callback" && g0.searchParams.get("state").length > 20 && g0.searchParams.get("nonce").length > 20);

  console.log("\nSOMEONE NEW (GOOGLE)");
  const a = await google({ sub: "g-111", email: "new@x.test", email_verified: true, name: "Nova Maker" });
  const up = code(a.loc, "signup");
  t("lands on Join with a one-use code, no token in the address", !!up && !/token/i.test(a.loc));
  t("…and the browser's own mark comes back with it, so a code in someone else's link is refused in the app", code(a.loc, "b") === MARK && read("src/app/gate/oauth.js").includes("if(!mark||mark!==mine)"));
  const cl = await json("/api/auth/oauth/claim", { code: up });
  t("the code says who they are (confirmed email, their name)", cl.j.signup && cl.j.signup.email === "new@x.test" && cl.j.signup.name === "Nova Maker");
  const r1 = await json("/api/auth/register", { oauth: up, username: "nova", displayName: "Nova Maker", roles: ["Painter"], email: "evil@x.test", password: "x" });
  t("joining with it: no password needed, email already confirmed", r1.s === 200 && r1.j.user.username === "nova" && r1.j.user.emailVerified === true && r1.j.mailSent === false);
  t("…with the email Google confirmed, not one typed in", (await json("/api/me", null, r1.j.token)).j.user && !JSON.stringify(r1.j).includes("evil@"));
  t("the ticket works once", (await json("/api/auth/register", { oauth: up, username: "nova2", displayName: "N", roles: ["Painter"] })).s === 410);

  console.log("\nCOMING BACK");
  const b = await google({ sub: "g-111", email: "new@x.test", email_verified: true });
  const inn = code(b.loc, "signin");
  const c1 = await json("/api/auth/oauth/claim", { code: inn });
  t("signed straight in as the same account", c1.s === 200 && c1.j.user.username === "nova" && (await json("/api/me", null, c1.j.token)).s === 200);
  t("the sign-in code works once", (await json("/api/auth/oauth/claim", { code: inn })).s === 410);
  const an = await google({ sub: "g-ana", email: "ANA@x.test", email_verified: true });
  t("an existing account with that (confirmed) email is linked and signed in", (await json("/api/auth/oauth/claim", { code: code(an.loc, "signin") })).j.user.username === "ana"
    && (await json("/api/auth/login", { identifier: "ana", password: "violet-kiln-27" })).s === 200);

  console.log("\nNOBODY GETS IN SIDEWAYS");
  const v = await google({ sub: "g-victim", email: "victim@x.test", email_verified: true });
  t("someone who pre-registered your unconfirmed email: linked to you…", (await json("/api/auth/oauth/claim", { code: code(v.loc, "signin") })).j.user.username === "squatter");
  t("…and their password and sessions are wiped", (await json("/api/me", null, "tok-squatter")).s === 401 && (await json("/api/auth/login", { identifier: "squatter", password: "violet-kiln-27" })).s === 401);
  t("an unconfirmed email from the provider doesn't link to anything", /oauth_error=noemail/.test((await google({ sub: "g-x", email: "ana@x.test", email_verified: false })).loc));
  t("a token signed by someone else's key", /oauth_error=failed/.test((await google({ sub: "g-y", email: "y@x.test", email_verified: true }, { key: other })).loc));
  t("a token for another app (wrong audience)", /oauth_error=failed/.test((await google({ sub: "g-y", email: "y@x.test", email_verified: true }, { claims: { aud: "someone-else" } })).loc));
  t("a token from another issuer", /oauth_error=failed/.test((await google({ sub: "g-y", email: "y@x.test", email_verified: true }, { claims: { iss: "https://evil.test" } })).loc));
  t("an expired token", /oauth_error=failed/.test((await google({ sub: "g-y", email: "y@x.test", email_verified: true }, { claims: { exp: 1000 } })).loc));
  t("a replayed token (wrong nonce)", /oauth_error=failed/.test((await google({ sub: "g-y", email: "y@x.test", email_verified: true }, { claims: { nonce: "old" } })).loc));
  t("a made-up state", /oauth_error=expired/.test((await google({ sub: "g-y", email: "y@x.test", email_verified: true }, { state: "nope" })).loc));
  const once = await google({ sub: "g-111", email: "new@x.test", email_verified: true });
  t("a state can't be used twice", /oauth_error=expired/.test((await go(`/api/auth/oauth/google/callback?code=zz&state=${once.st.searchParams.get("state")}`)).headers.get("location")));
  t("a suspended account stays out", /oauth_error=suspended/.test((await google({ sub: "g-b", email: "banned@x.test", email_verified: true })).loc));
  const { DatabaseSync } = await import("node:sqlite"); const w = new DatabaseSync(join(DATA, "tnl.db"));
  w.prepare(`INSERT INTO settings (key, value, updated_at) VALUES ('signupsOpen','0',?) ON CONFLICT(key) DO UPDATE SET value='0'`).run(Date.now());
  t("invite-only: no new accounts this way either", /oauth_error=closed/.test((await google({ sub: "g-z", email: "z@x.test", email_verified: true })).loc));
  w.prepare(`UPDATE settings SET value='1' WHERE key='signupsOpen'`).run(); w.close();

  console.log("\nAPPLE");
  const ap = await apple({ sub: "a-1", email: "ada@privaterelay.appleid.com", email_verified: "true" }, { name: { firstName: "Ada", lastName: "Lovelace" } });
  t("Apple posts back; its first-time name comes through", (await json("/api/auth/oauth/claim", { code: code(ap.loc, "signup") })).j.signup?.name === "Ada Lovelace");
  t("Apple's start asks for a form post", new URL(ap.st).searchParams.get("response_mode") === "form_post" && new URL(ap.st).searchParams.get("client_id") === "com.labs.test");

  console.log("\nFACEBOOK");
  const f0 = await facebook({ id: "fb-1", name: "Mia Weaver", email: "mia@x.test" });
  t("Facebook's start: our app id, our callback, a state, a code asked for", f0.st.origin + f0.st.pathname === MOCK + "/fbauth" && f0.st.searchParams.get("client_id") === "f-app" && f0.st.searchParams.get("redirect_uri") === B + "/api/auth/oauth/facebook/callback"
    && f0.st.searchParams.get("response_type") === "code" && f0.st.searchParams.get("scope") === "public_profile,email" && !!f0.st.searchParams.get("state"));
  const fup = code(f0.loc, "signup");
  t("someone new: the code is traded with our secret, /me (with appsecret_proof) says who, Join opens on their name", !!fup && (await json("/api/auth/oauth/claim", { code: fup })).j.signup?.name === "Mia Weaver");
  const fr = await json("/api/auth/register", { oauth: fup, username: "mia", displayName: "Mia Weaver", roles: ["Painter"] });
  t("joined with the email Facebook confirmed, no password", fr.s === 200 && fr.j.user.emailVerified === true && fr.j.mailSent === false);
  t("coming back: signed straight in", (await json("/api/auth/oauth/claim", { code: code((await facebook({ id: "fb-1", name: "Mia Weaver", email: "mia@x.test" })).loc, "signin") })).j.user?.username === "mia");
  t("an existing account with that email is linked and signed in", (await json("/api/auth/oauth/claim", { code: code((await facebook({ id: "fb-ana", name: "Ana", email: "ana@x.test" })).loc, "signin") })).j.user?.username === "ana");
  t("a Facebook account with no email (phone-only, or declined) can't come in this way", /oauth_error=noemail/.test((await facebook({ id: "fb-2", name: "No Mail" })).loc));
  t("cancelled at Facebook", /oauth_error=cancelled/.test((await facebook({ id: "fb-3" }, { q: "&error=access_denied&error_reason=user_denied" })).loc));
  t("a code Facebook doesn't know", /oauth_error=failed/.test((await facebook({ id: "fb-3", email: "c@x.test" }, { code: "made-up" })).loc));
  t("a made-up state", /oauth_error=expired/.test((await facebook({ id: "fb-3", email: "c@x.test" }, { state: "nope" })).loc));
  t("a suspended account stays out", /oauth_error=suspended/.test((await facebook({ id: "fb-b", email: "banned@x.test" })).loc));
} finally { srv.kill(); mock.close(); }
const { DatabaseSync } = await import("node:sqlite");
const d2 = new DatabaseSync(join(DATA, "tnl.db"));
console.log("\nTHE DATABASE");
t("each account remembers who it is at Google / Apple / Facebook", d2.prepare(`SELECT COUNT(*) n FROM user_identities WHERE provider='google'`).get().n === 3 && d2.prepare(`SELECT COUNT(*) n FROM user_identities WHERE provider='facebook'`).get().n === 2);
t("no passwords stored for Google-made accounts (an unusable random one)", d2.prepare(`SELECT password_hash FROM users WHERE username='nova'`).get().password_hash.startsWith("$2"));
console.log(`\n  ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
