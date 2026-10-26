// INSTAGRAM INBOX v1.0 — 2026-10-26: "Can you access messages on Instagram
// now?" Read only, in Admin → Instagram. Connect through Instagram's own
// sign-in, keep the key on the server, read conversations every few minutes
// (and by webhook once Meta allows it), never show the key or a message to
// anyone but an admin.
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { mkdirSync, rmSync, readFileSync } from "node:fs";
import { randomBytes, createHash, createHmac, timingSafeEqual } from "node:crypto";
const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const TMP = join(ROOT, "test", ".tmp", "instagram-inbox");
rmSync(TMP, { recursive: true, force: true }); mkdirSync(TMP, { recursive: true });
process.env.TNL_DATA = TMP; process.env.PUBLIC_URL = "https://labs.test";
process.env.IG_APP_ID = "123456"; process.env.IG_APP_SECRET = "shh-app-secret"; delete process.env.IG_VERIFY_TOKEN;
const { db } = await import(join(ROOT, "src/db.js"));
db.exec(`CREATE TABLE IF NOT EXISTS admin_log (id INTEGER PRIMARY KEY, admin_id INTEGER, action TEXT, target TEXT, detail TEXT, created_at INTEGER)`);
let pass = 0, fail = 0;
const t = (n, ok) => { ok ? pass++ : fail++; console.log("  " + (ok ? "✓" : "✗") + "  " + n); };

/* ---- Meta, faked: every call is written down ---- */
const CALLS = [];
let CONVS = [{ id: "c1", updated_time: "2026-10-26T10:00:00+0000" }];
let MSGS = { c1: [
  { id: "m2", created_time: "2026-10-26T10:00:00+0000", from: { id: "ME1", username: "tnl.labs" }, to: { data: [{ id: "U9", username: "ana.paints" }] }, message: "Thanks! Vote in the app." },
  { id: "m1", created_time: "2026-10-26T09:58:00+0000", from: { id: "U9", username: "ana.paints" }, to: { data: [{ id: "ME1", username: "tnl.labs" }] }, message: "Hey, is the tournament open?",
    attachments: { data: [{ image_data: { url: "https://cdn.test/a.jpg" } }] } },
] };
let REJECT_ATTACHMENTS = false, REFRESHED = 0, TOO_BIG = false;   // TOO_BIG: Meta says "reduce the amount of data" above 10 conversations / 5 messages
const json = (o, status = 200) => ({ ok: status < 300, status, json: async () => o });
globalThis.fetch = async (u, opts = {}) => {
  u = String(u); CALLS.push(u);
  const url = new URL(u), p = url.pathname.replace(/^\/v\d+\.\d+/, "");
  if (url.host === "api.instagram.com") return json({ access_token: "short", user_id: 777 });
  if (p === "/access_token") return json({ access_token: "long-lived-token", expires_in: 5184000 });
  if (p === "/refresh_access_token") { REFRESHED++; return json({ access_token: "refreshed-token", expires_in: 5184000 }); }
  if (p === "/me" && url.searchParams.get("fields") === "user_id,username") return json({ user_id: "ME1", username: "tnl.labs" });
  const big = { error: { message: "Please reduce the amount of data you're asking for, then retry your request", code: 1 } };
  if (p === "/me/conversations") return TOO_BIG && Number(url.searchParams.get("limit")) > 10 ? json(big, 500) : json({ data: CONVS });
  const m = p.match(/^\/(c\d+)$/);
  if (m) { const f = url.searchParams.get("fields");
    if (TOO_BIG && Number((/limit\((\d+)\)/.exec(f) || [])[1]) > 5) return json(big, 500);
    if (REJECT_ATTACHMENTS && /attachments/.test(f)) return json({ error: { message: "(#100) Tried accessing nonexisting field (attachments)", code: 100 } }, 400);
    return json({ id: m[1], messages: { data: MSGS[m[1]] || [] } }); }
  return json({ error: { message: "no such thing " + p, code: 803 } }, 400);
};

/* ---- the part, with the server's helpers stubbed ---- */
const src = readFileSync(join(ROOT, "src/server-12-instagram-inbox.js"), "utf8");
const routes = {};
const app = { get: (p, ...h) => { routes["GET " + p] = h; }, post: (p, ...h) => { routes["POST " + p] = h; } };
const audits = [];
new Function("app", "auth", "admin", "db", "rateLimit", "randomBytes", "createHash", "createHmac", "timingSafeEqual", "baseUrl", "auditAdmin", "setInterval", "setTimeout", src)(
  app, "AUTH", "ADMIN", db, () => "RL", randomBytes, createHash, createHmac, timingSafeEqual, () => "https://labs.test", (_r, a) => audits.push(a), () => ({ unref() {} }), () => ({ unref() {} }));
const call = async (key, { query = {}, body, params = {}, headers = {}, rawBody, user = { id: 1 } } = {}) => {
  const out = { code: 200, body: null, redirect: null, text: null };
  const res = { status: (c) => { out.code = c; return res; }, json: (x) => { out.body = x; return res; }, redirect: (c, u) => { out.code = c; out.redirect = u; return res; },
    type: () => res, send: (x) => { out.text = x; return res; }, end: () => res };
  await routes[key].at(-1)({ query, body, params, rawBody, user, get: (h) => headers[h.toLowerCase()], originalUrl: key.split(" ")[1], method: key.split(" ")[0] }, res);
  return out;
};
const settle = () => new Promise((r) => setTimeout(r, 40));
const sinceCalls = (f) => { const n = CALLS.length; return f().then((r) => ({ r, calls: CALLS.slice(n) })); };

console.log("\nADMIN ONLY, ON THE SERVER");
const adminRoutes = ["GET /api/admin/instagram", "GET /api/admin/instagram/thread/:id", "GET /api/admin/instagram/connect", "POST /api/admin/instagram/sync", "POST /api/admin/instagram/seen", "POST /api/admin/instagram/disconnect"];
t("every admin route sits behind a signed-in admin", adminRoutes.every((k) => routes[k] && routes[k][0] === "AUTH" && routes[k][1] === "ADMIN"));
t("the Instagram-facing routes (callback, webhook) exist and aren't behind a member's token", routes["GET /api/instagram/callback"] && routes["GET /api/instagram/webhook"] && routes["POST /api/instagram/webhook"] && routes["POST /api/instagram/webhook"][0] !== "AUTH");

console.log("\nBEFORE IT'S CONNECTED");
let r = await call("GET /api/admin/instagram");
t("status says: set up (keys in Railway), not connected, nothing to read", r.body.ready === true && r.body.connected === false && r.body.conversations.length === 0 && r.body.unread === 0);
t("it shows the three values to paste into Meta: redirect, callback, verify token", r.body.webhook.redirect === "https://labs.test/api/instagram/callback" && r.body.webhook.url === "https://labs.test/api/instagram/webhook" && /^[0-9a-f]{32}$/.test(r.body.webhook.verifyToken));
r = await call("POST /api/admin/instagram/sync");
t("Check now before connecting is a plain no", r.code === 400 && /isn't connected/.test(r.body.error));

console.log("\nCONNECTING");
r = await call("GET /api/admin/instagram/connect", { user: { id: 7 } });
const au = new URL(r.body.url);
t("Connect goes to Instagram's own sign-in with our app id, the messages scope and a one-use state", au.host === "www.instagram.com" && au.pathname === "/oauth/authorize" && au.searchParams.get("client_id") === "123456"
  && /instagram_business_manage_messages/.test(au.searchParams.get("scope")) && au.searchParams.get("redirect_uri") === "https://labs.test/api/instagram/callback" && /^[0-9a-f]{36}$/.test(au.searchParams.get("state")));
let cb = await call("GET /api/instagram/callback", { query: { code: "abc", state: "made-up" } });
t("coming back with a state we never issued is refused (stale), nothing stored", cb.code === 302 && /stale/.test(decodeURIComponent(cb.redirect)) && !db.prepare(`SELECT 1 FROM ig_account`).get());
cb = await call("GET /api/instagram/callback", { query: { error: "access_denied", error_description: "The user denied it", state: au.searchParams.get("state") } });
t("Instagram saying no comes back to Admin with its words", cb.code === 302 && /denied/.test(decodeURIComponent(cb.redirect)) && cb.redirect.endsWith("#instagram"));
r = await call("GET /api/admin/instagram/connect", { user: { id: 7 } });
const state2 = new URL(r.body.url).searchParams.get("state");
cb = await call("GET /api/instagram/callback", { query: { code: "abc#_", state: state2 } }); await settle();
const acc = db.prepare(`SELECT * FROM ig_account`).get();
t("with a real code: short token → long-lived token, who we are, saved once, back to Admin → Instagram", cb.redirect === "/admin?ig=ok#instagram" && acc && acc.token === "long-lived-token" && acc.ig_id === "ME1" && acc.username === "tnl.labs" && acc.connected_by === 7);
t("the key never goes to the browser", !JSON.stringify((await call("GET /api/admin/instagram")).body).includes("long-lived-token"));
t("connecting is written in the admin log", db.prepare(`SELECT COUNT(*) n FROM admin_log WHERE action = 'instagram connect'`).get().n === 1);
cb = await call("GET /api/instagram/callback", { query: { code: "abc", state: state2 } });
t("a state can't be used twice", /stale/.test(decodeURIComponent(cb.redirect)));

console.log("\nREADING (POLLING)");
r = await call("GET /api/admin/instagram");
t("connecting read the inbox straight away: one conversation, with @ana.paints, newest last message first", r.body.connected && r.body.conversations.length === 1 && r.body.conversations[0].username === "ana.paints" && r.body.conversations[0].last.mine === true && r.body.conversations[0].count === 2);
t("one new message (hers), ours doesn't count as new", r.body.unread === 1 && r.body.conversations[0].unread === 1);
let { calls } = await sinceCalls(() => call("POST /api/admin/instagram/sync"));
t("Check now again: Instagram asked for the list, but not a conversation that hasn't moved", calls.some((u) => /me\/conversations/.test(u)) && !calls.some((u) => /\/c1\?/.test(u)));
CONVS = [{ id: "c1", updated_time: "2026-10-26T10:05:00+0000" }];
MSGS.c1.unshift({ id: "m3", created_time: "2026-10-26T10:05:00+0000", from: { id: "U9", username: "ana.paints" }, to: { data: [{ id: "ME1" }] }, message: "Voted 🧪" });
r = await call("POST /api/admin/instagram/sync");
t("a conversation that moved is read again; only the new message is new", r.body.fresh === 1 && db.prepare(`SELECT COUNT(*) n FROM ig_messages`).get().n === 3);
r = await call("GET /api/admin/instagram/thread/:id", { params: { id: "c1" } });
t("the thread: oldest first, hers and ours told apart, the picture kept as an attachment", r.body.username === "ana.paints" && r.body.messages.map((m) => m.mid).join() === "m1,m2,m3" && r.body.messages[0].mine === false && r.body.messages[1].mine === true
  && r.body.messages[0].attachments[0].type === "image" && r.body.messages[0].attachments[0].url === "https://cdn.test/a.jpg");
t("opening the thread marks it read", (await call("GET /api/admin/instagram")).body.unread === 0);
t("a thread that doesn't exist is a 404", (await call("GET /api/admin/instagram/thread/:id", { params: { id: "nope" } })).code === 404);
REJECT_ATTACHMENTS = true; CONVS = [{ id: "c1", updated_time: "2026-10-26T10:06:00+0000" }];
({ r, calls } = await sinceCalls(() => call("POST /api/admin/instagram/sync")));
t("if Meta rejects the attachments field, the same conversation is asked for again without it", r.code === 200 && calls.filter((u) => /\/c1\?/.test(u)).length === 2 && !/attachments/.test(calls.at(-1)));
REJECT_ATTACHMENTS = false;
TOO_BIG = true; CONVS = [{ id: "c1", updated_time: "2026-10-26T10:07:00+0000" }];
({ r, calls } = await sinceCalls(() => call("POST /api/admin/instagram/sync")));
t("\"reduce the amount of data\": it asks again for less (10 conversations, 5 messages) and the check goes through", r.code === 200 && r.body.ok !== false
  && calls.some((u) => /conversations.*limit=10/.test(u)) && calls.some((u) => /limit%285%29|limit\(5\)/.test(u)) && !(await call("GET /api/admin/instagram")).body.lastError);
TOO_BIG = false;

console.log("\nWEBHOOKS");
const vt = (await call("GET /api/admin/instagram")).body.webhook.verifyToken;
r = await call("GET /api/instagram/webhook", { query: { "hub.mode": "subscribe", "hub.verify_token": vt, "hub.challenge": "12345" } });
t("Meta's handshake: the right verify token gets the challenge back", r.text === "12345");
r = await call("GET /api/instagram/webhook", { query: { "hub.mode": "subscribe", "hub.verify_token": "wrong", "hub.challenge": "12345" } });
t("the wrong one gets nothing", r.code === 403 && r.text === null);
const payload = { object: "instagram", entry: [{ id: "ME1", time: 1792924800000, messaging: [
  { sender: { id: "U9" }, recipient: { id: "ME1" }, timestamp: 1792924800000, message: { mid: "w1", text: "Sent you my entry" } },
  { sender: { id: "ME1" }, recipient: { id: "U9" }, timestamp: 1792924801000, message: { mid: "w2", text: "Got it", is_echo: true } },
  { sender: { id: "U9" }, recipient: { id: "ME1" }, timestamp: 1792924802000, message: { mid: "w3", attachments: [{ type: "image", payload: { url: "https://cdn.test/b.jpg" } }] } },
] }] };
const raw = Buffer.from(JSON.stringify(payload));
const sign = (buf, secret = "shh-app-secret") => "sha256=" + createHmac("sha256", secret).update(buf).digest("hex");
r = await call("POST /api/instagram/webhook", { body: payload, rawBody: raw, headers: {} });
t("a delivery with no signature is refused", r.code === 403 && db.prepare(`SELECT COUNT(*) n FROM ig_messages WHERE via = 'webhook'`).get().n === 0);
r = await call("POST /api/instagram/webhook", { body: payload, rawBody: raw, headers: { "x-hub-signature-256": sign(raw, "someone-else") } });
t("a delivery signed with another secret is refused", r.code === 403 && db.prepare(`SELECT COUNT(*) n FROM ig_messages WHERE via = 'webhook'`).get().n === 0);
r = await call("POST /api/instagram/webhook", { body: payload, rawBody: raw, headers: { "x-hub-signature-256": sign(raw) } }); await settle();
const w = db.prepare(`SELECT mid, conv_id, mine, text, attachments FROM ig_messages WHERE via = 'webhook' ORDER BY mid`).all();
t("signed: the three messages land, ours marked ours (is_echo), the picture kept", r.code === 200 && w.length === 3 && w.map((x) => x.mine).join() === "0,1,0" && JSON.parse(w[2].attachments)[0].url === "https://cdn.test/b.jpg");
t("they're filed under the conversation we already know with that person", w.every((x) => x.conv_id === "c1"));
r = await call("POST /api/instagram/webhook", { body: payload, rawBody: raw, headers: { "x-hub-signature-256": sign(raw) } }); await settle();
t("Meta sending the same delivery again adds nothing", db.prepare(`SELECT COUNT(*) n FROM ig_messages`).get().n === 6);
t("the two from her are new; ours isn't", (await call("GET /api/admin/instagram")).body.unread === 2);
await call("POST /api/admin/instagram/seen");
t("Mark all read clears the count", (await call("GET /api/admin/instagram")).body.unread === 0);

console.log("\nTHE KEY STAYS GOOD");
db.prepare(`UPDATE ig_account SET token_at = ?`).run(Date.now() - 2 * 86400000);
await call("POST /api/admin/instagram/sync");   // the refresh rides the same tick; reach it through the part's own timer body
const tickSrc = src.match(/setInterval\(\(\) => \{ ([^}]*) \}/)[1];
t("the refresh runs on the same timer as the check", /igRefresh\(\)/.test(tickSrc) && /igSync\(/.test(tickSrc));
const igRefresh = new Function("db", "fetch", "igAccount", "igGet", "igNote", "igErr", "console", src.match(/async function igRefresh\(\) \{[\s\S]*?\n\}/)[0] + "; return igRefresh;")(
  db, globalThis.fetch, () => db.prepare(`SELECT * FROM ig_account`).get(), async (p, q) => { const u = new URL("https://graph.instagram.com/v24.0" + p); for (const [k, v] of Object.entries(q)) u.searchParams.set(k, v); return (await fetch(u)).json(); }, () => {}, String, console);
await igRefresh();
t("a key a day old or more is refreshed and starts its 60 days again", REFRESHED === 1 && db.prepare(`SELECT token FROM ig_account`).get().token === "refreshed-token" && db.prepare(`SELECT expires_at FROM ig_account`).get().expires_at > Date.now() + 59 * 86400000);
await igRefresh();
t("a fresh key is left alone (Meta refuses one under a day old)", REFRESHED === 1);

console.log("\nDISCONNECTING");
r = await call("POST /api/admin/instagram/disconnect");
t("forgets the key and every message, and is written down", r.body.ok && !db.prepare(`SELECT 1 FROM ig_account`).get() && db.prepare(`SELECT COUNT(*) n FROM ig_messages`).get().n === 0 && audits.includes("instagram disconnect"));
t("status is back to not connected", (await call("GET /api/admin/instagram")).body.connected === false);

console.log("\nTHE ADMIN PAGE");
const core = readFileSync(join(ROOT, "public/admin-app/1-core.js"), "utf8"), html = readFileSync(join(ROOT, "public/admin.html"), "utf8"), tab = readFileSync(join(ROOT, "public/admin-app/7-instagram.js"), "utf8");
t("Instagram is a section, under People & content, with its own icon", /\["instagram", "Instagram"\]/.test(core) && /\["people", "content", "events", "instagram"\]/.test(core) && /instagram: di\(/.test(core));
t("the admin page loads it", /admin-app\/7-instagram\.js\?v=/.test(html));
t("read only: it never posts a message, and sends you to Instagram to reply", !/\/messages["']/.test(src) && /ig\.me\/m\//.test(tab) && /Reply in Instagram/.test(tab));
t("the Meta setup values are on the page with Copy", /data-igcopy/.test(tab) && /Verify token/.test(tab) && /Callback URL/.test(tab) && /Redirect URI/.test(tab));
t("the JSON parser keeps the raw bytes for the webhook only", /req\.path === "\/api\/instagram\/webhook"\) req\.rawBody = buf/.test(readFileSync(join(ROOT, "src/server-01-json.js"), "utf8")));

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
