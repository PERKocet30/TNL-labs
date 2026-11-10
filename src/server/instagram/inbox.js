/* ================================================================
   INSTAGRAM INBOX v1.1 — 2026-11-10 ("fix the Instagram integration" — the inbox):
   · older conversations arrive. A check only ever read the newest page (15 on a
     busy inbox, 25 otherwise) and stopped at the first one it already had, so
     anything older than the day LABS connected never showed up. Now each check
     also reads the next IG_OLDER_STEP (5) older ones (ig_account.walk_after remembers where),
     until the inbox is whole or IG_KEEP_MAX (300) are in.
   · "new" means new. A message is read once you've answered after it in
     Instagram, and history brought in from before LABS connected isn't new.
   · an empty page isn't the end. Meta can answer a page with nothing on it and
     still a cursor to the next (a conversation it won't list); the read stopped
     there, with no error, and the inbox stayed empty ("No conversations yet" on
     a connected account, 2026-11-09). It now steps past up to IG_EMPTY_MAX (12).
   · the page says what Instagram answered (ig_account.last_listed), and when it
     lists nothing at all, the two switches on Instagram's side that cause it.
   v1.0 — 2026-10-26. "Can you access messages on
   Instagram now?" — read only, inside Admin → Instagram.

   How it gets in: Instagram API with Instagram Login (Meta's own door for
   a professional account, no Facebook Page needed). The admin presses
   Connect, signs in to Instagram, and LABS keeps a long-lived token for
   @tnl.labs (60 days, refreshed every day it's used, ig_account). The
   token never leaves the server and never appears in the admin's data.
   Set in Railway → Variables: IG_APP_ID and IG_APP_SECRET (the Meta app's
   ID and secret), optionally IG_VERIFY_TOKEN (any word; Meta's webhook
   handshake — otherwise one is derived from the secret and shown in Admin).

   How messages arrive, two ways, the same table (ig_messages):
   · polling — every IG_POLL_MS (3 minutes) while connected, and on
     Refresh: /me/conversations, then each conversation that moved since
     last time, its 20 newest messages (Meta won't detail older ones).
     Works on Standard Access, i.e. for the account that owns the app.
   · webhooks — /api/instagram/webhook, verified (hub.challenge) and
     signed (X-Hub-Signature-256 over the raw body with the app secret).
     Meta only sends these once the app is Live with Advanced Access, so
     this is the upgrade path, not the requirement.
   Nothing here sends a message: replies happen in the Instagram app
   (the admin links straight to the conversation, ig.me/m/<username>).
   Admin-only on the server. Reading someone's DMs is sensitive: nothing
   in the message table is ever shown to members or on a public page.
================================================================ */
db.exec(`CREATE TABLE IF NOT EXISTS ig_account (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  ig_id TEXT NOT NULL,
  username TEXT NOT NULL DEFAULT '',
  token TEXT NOT NULL,
  token_at INTEGER NOT NULL,
  expires_at INTEGER NOT NULL,
  connected_by INTEGER,
  connected_at INTEGER NOT NULL,
  synced_at INTEGER,
  last_error TEXT
);
CREATE TABLE IF NOT EXISTS ig_conversations (
  id TEXT PRIMARY KEY,
  with_id TEXT NOT NULL DEFAULT '',
  with_username TEXT NOT NULL DEFAULT '',
  updated_at INTEGER NOT NULL DEFAULT 0,
  synced_updated_at INTEGER NOT NULL DEFAULT 0
);
CREATE TABLE IF NOT EXISTS ig_messages (
  mid TEXT PRIMARY KEY,
  conv_id TEXT NOT NULL DEFAULT '',
  from_id TEXT NOT NULL DEFAULT '',
  from_username TEXT NOT NULL DEFAULT '',
  mine INTEGER NOT NULL DEFAULT 0,
  text TEXT NOT NULL DEFAULT '',
  attachments TEXT NOT NULL DEFAULT '[]',
  created_at INTEGER NOT NULL,
  seen INTEGER NOT NULL DEFAULT 0,
  via TEXT NOT NULL DEFAULT 'poll'
);
CREATE INDEX IF NOT EXISTS idx_ig_messages_conv ON ig_messages(conv_id, created_at);`);
for (const col of ["walk_after TEXT", "walk_done INTEGER NOT NULL DEFAULT 0", "last_listed INTEGER"]) { try { db.exec(`ALTER TABLE ig_account ADD COLUMN ${col}`); } catch {} }   // 2026-11-10: where the read of older conversations has got to

const IG_APP_ID = (process.env.IG_APP_ID || "").trim(), IG_APP_SECRET = (process.env.IG_APP_SECRET || "").trim();
const IG_GRAPH = "https://graph.instagram.com/v24.0";
const IG_WAIT_MS = Math.max(1000, Number(process.env.IG_WAIT_MS) || 30000);   // a busy inbox: Meta can take 15s+ to list it (2026-10-26)
const IG_SCOPE = "instagram_business_basic,instagram_business_manage_messages";
const IG_POLL_MS = Math.max(30000, Number(process.env.IG_POLL_MS) || 180000);
const IG_MSG_FIELDS = "id,created_time,from,to,message,attachments";
const igReady = () => !!(IG_APP_ID && IG_APP_SECRET);
const igVerifyToken = () => (process.env.IG_VERIFY_TOKEN || "").trim() || (IG_APP_SECRET ? createHash("sha256").update("labs-ig-verify:" + IG_APP_SECRET).digest("hex").slice(0, 32) : "");
const igAccount = () => db.prepare(`SELECT * FROM ig_account WHERE id = 1`).get() || null;
const igRedirect = (req) => `${baseUrl(req)}/api/instagram/callback`;
const igTime = (t) => { const n = typeof t === "number" ? t : Date.parse(t || ""); return Number.isFinite(n) ? n : Date.now(); };
const igErr = (e) => String(e?.message || e || "").slice(0, 300);
const igNote = (err) => db.prepare(`UPDATE ig_account SET last_error = ? WHERE id = 1`).run(err ? igErr(err) : null);

/* One call to Meta. Errors carry Meta's own words so the admin sees why. */
async function igGet(path, params, token) {
  const u = new URL(IG_GRAPH + path);
  for (const [k, v] of Object.entries(params || {})) if (v !== undefined && v !== null) u.searchParams.set(k, v);
  if (token) u.searchParams.set("access_token", token);
  const r = await fetch(u, { signal: AbortSignal.timeout(IG_WAIT_MS) });
  const d = await r.json().catch(() => ({}));
  if (!r.ok || d.error) { const e = new Error(d.error?.message || `Instagram said ${r.status}`); e.code = d.error?.code; e.status = r.status; throw e; }
  return d;
}

/* ── one message in, from either door ── */
const igPutMsg = db.prepare(`INSERT INTO ig_messages (mid, conv_id, from_id, from_username, mine, text, attachments, created_at, via)
  VALUES (?,?,?,?,?,?,?,?,?) ON CONFLICT(mid) DO UPDATE SET conv_id = CASE WHEN ig_messages.conv_id = '' THEN excluded.conv_id ELSE ig_messages.conv_id END,
  from_username = CASE WHEN excluded.from_username != '' THEN excluded.from_username ELSE ig_messages.from_username END`);
const igPutConv = db.prepare(`INSERT INTO ig_conversations (id, with_id, with_username, updated_at) VALUES (?,?,?,?)
  ON CONFLICT(id) DO UPDATE SET with_id = CASE WHEN excluded.with_id != '' THEN excluded.with_id ELSE ig_conversations.with_id END,
  with_username = CASE WHEN excluded.with_username != '' THEN excluded.with_username ELSE ig_conversations.with_username END,
  updated_at = MAX(ig_conversations.updated_at, excluded.updated_at)`);
function igStore(acc, m, convId, via) {
  const mid = String(m.mid || m.id || ""); if (!mid) return false;
  const fromId = String(m.from?.id || m.sender?.id || ""), mine = fromId && fromId === String(acc.ig_id) ? 1 : 0;
  const at = igTime(m.created_time ?? m.timestamp);
  const atts = [].concat(m.attachments?.data || m.attachments || []).map((a) => ({
    type: String(a.type || (a.image_data ? "image" : a.video_data ? "video" : a.file_url ? "file" : "attachment")).slice(0, 20),
    url: String(a.payload?.url || a.image_data?.url || a.video_data?.url || a.file_url || "").slice(0, 2000) })).filter((a) => a.url).slice(0, 10);
  const text = String(m.message ?? m.text ?? "").slice(0, 4000);
  const had = !!db.prepare(`SELECT 1 FROM ig_messages WHERE mid = ?`).get(mid);
  igPutMsg.run(mid, convId || "", fromId, String(m.from?.username || "").slice(0, 60), mine, text, JSON.stringify(atts), at, via);
  if (convId) {   // the other person in it: whoever isn't us
    const other = mine ? [].concat(m.to?.data || []).find((t) => String(t.id) !== String(acc.ig_id)) || {} : { id: fromId, username: m.from?.username };
    igPutConv.run(convId, String(other?.id || "").slice(0, 40), String(other?.username || "").slice(0, 60), at);
  }
  return !had;
}

/* "Please reduce the amount of data you're asking for" (2026-10-26, the first real connect): Meta caps
   how much one call returns, so ask again for less — 25, then 10, then 5 — before giving up. */
const igTooBig = (e) => /reduce the amount of data/i.test(e?.message || "") || e?.code === 1 || e?.name === "TimeoutError" || /aborted due to timeout/i.test(e?.message || "");   // too slow is too big too
async function igGetLess(path, paramsFor, token, sizes = [25, 10, 5]) {
  let last;
  for (const n of sizes) { try { return await igRetry(() => igGet(path, paramsFor(n), token), n === sizes.at(-1) ? 3 : 1); } catch (e) { last = e; if (!igTooBig(e)) throw e; } }
  throw last;
}
/* Meta's messaging reads are flaky: the same call fails, then works a second later. Twice more, briefly. */
async function igRetry(fn, tries = 3) {
  for (let i = 1; ; i++) { try { return await fn(); } catch (e) { if (i >= tries || !(igTooBig(e) || e?.code === 2)) throw e; await new Promise((ok) => globalThis.setTimeout(ok, IG_RETRY_MS * i)); } }
}
/* The conversation list, newest first. A busy inbox refuses any page bigger than one (Meta code 1 at every
   limit above 1 — github.com/Extra-Chill/data-machine-socials/issues/267), so it's walked one at a time,
   up to IG_WALK_MAX, stopping at the first conversation that hasn't moved since last time. */
const IG_RETRY_MS = Math.max(0, Number(process.env.IG_RETRY_MS ?? 1200));
const IG_WALK_MAX = Math.max(1, Number(process.env.IG_WALK_MAX) || 15);
const IG_KEEP_MAX = Math.max(1, Number(process.env.IG_KEEP_MAX) || 300);
const IG_EMPTY_MAX = Math.max(1, Number(process.env.IG_EMPTY_MAX) || 12);   // empty pages stepped past in one check before calling it the end
const IG_OLDER_STEP = Math.max(1, Number(process.env.IG_OLDER_STEP) || 5);   // older conversations a check: small, so a full read stays well inside Meta's hourly limit
/* Returns the newest conversations, and `next`: the cursor just past them (null = that was the end), where the older ones start. */
async function igListConvs(token, moved) {
  let one = false, after = null;
  try { const d = await igRetry(() => igGet("/me/conversations", { platform: "instagram", fields: "id,updated_time", limit: 25 }, token), 1);
    if ((d.data || []).length || !d.paging?.cursors?.after) return { list: d.data || [], next: (d.data || []).length ? d.paging?.cursors?.after || null : null, one: false };
    after = d.paging.cursors.after; }   // nothing on the page but a way on: step past it below
  catch (e) { if (!igTooBig(e)) throw e; one = true; }
  const out = []; let next = null, empty = 0;
  while (out.length < IG_WALK_MAX) {
    const d = await igRetry(() => igGet("/me/conversations", { platform: "instagram", fields: "id,updated_time", limit: one ? 1 : 25, after }, token), one ? 3 : 1);
    if (!one) { out.push(...(d.data || [])); next = d.paging?.cursors?.after || null; if ((d.data || []).length || !next || ++empty >= IG_EMPTY_MAX) break; after = next; continue; }
    const c = (d.data || [])[0];
    if (!c) { next = d.paging?.cursors?.after || null; if (!next || ++empty >= IG_EMPTY_MAX) { next = null; break; } after = next; continue; }   // an empty page with a way on isn't the end (2026-11-10)
    empty = 0;
    out.push(c);
    next = after = d.paging?.cursors?.after || null;
    if (!moved(c)) break;   // everything after this is older and already read
    if (!after) break;
  }
  return { list: out, next, one };
}
/* The older ones (2026-11-10): from where the last check stopped, a few more each time, until the inbox is whole. */
async function igOlderConvs(acc, head) {
  if (acc.walk_done) return [];
  const have = db.prepare(`SELECT COUNT(*) n FROM ig_conversations`).get().n;
  let after = acc.walk_after || head.next;
  const done = () => db.prepare(`UPDATE ig_account SET walk_done = 1, walk_after = NULL WHERE id = 1`).run();
  if (!after || have >= IG_KEEP_MAX) { done(); return []; }
  const out = []; let empty = 0;
  try {
    if (head.one) { while (out.length < IG_OLDER_STEP) {
      const d = await igRetry(() => igGet("/me/conversations", { platform: "instagram", fields: "id,updated_time", limit: 1, after }, acc.token));
      const c = (d.data || [])[0]; if (c) out.push(c); else if (++empty >= IG_EMPTY_MAX) { after = null; break; }
      after = d.paging?.cursors?.after || null; if (!after) break; } }
    else { const d = await igRetry(() => igGet("/me/conversations", { platform: "instagram", fields: "id,updated_time", limit: IG_OLDER_STEP, after }, acc.token), 1);
      out.push(...(d.data || [])); after = d.paging?.cursors?.after || null; }
  } catch (e) { console.error("[instagram] older conversations:", e.message); if (!igTooBig(e)) after = null; else { db.prepare(`UPDATE ig_account SET walk_after = ? WHERE id = 1`).run(after); return out; } }   // a stale cursor ends it; too busy tries again next check
  if (after) db.prepare(`UPDATE ig_account SET walk_after = ? WHERE id = 1`).run(after); else done();
  return out;
}
/* "New" means new (2026-11-10): what you've answered after in Instagram is read; history from before LABS connected isn't news. */
function igSettle(acc, convId, history) {
  db.prepare(`UPDATE ig_messages SET seen = 1 WHERE conv_id = ?1 AND mine = 0 AND seen = 0 AND created_at < COALESCE((SELECT MAX(created_at) FROM ig_messages WHERE conv_id = ?1 AND mine = 1), 0)`).run(convId);
  if (history) db.prepare(`UPDATE ig_messages SET seen = 1 WHERE conv_id = ? AND mine = 0 AND seen = 0 AND created_at < ?`).run(convId, acc.connected_at);
}
/* ── polling: what moved since last time ── */
let IG_SYNCING = false;
async function igSync(reason = "tick") {
  const acc = igAccount(); if (!acc || IG_SYNCING) return { ok: false, skipped: true };
  IG_SYNCING = true; let fresh = 0, convs = 0;
  try {
    const moved = (c) => { const k = db.prepare(`SELECT synced_updated_at FROM ig_conversations WHERE id = ?`).get(String(c.id)); return !k || k.synced_updated_at < igTime(c.updated_time); };
    const head = await igListConvs(acc.token, moved);
    const olderList = await igOlderConvs(acc, head), older = new Set(olderList.map((c) => String(c.id)));
    const list = [...head.list, ...olderList.filter((c) => !head.list.some((h) => String(h.id) === String(c.id)))];
    db.prepare(`UPDATE ig_account SET last_listed = ? WHERE id = 1`).run(list.length);   // what Instagram answered, for the page
    let skipped = 0;
    for (const c of list) {
      const id = String(c.id), up = igTime(c.updated_time);
      if (!moved(c)) continue;
      convs++;
      let d;
      try {
        try { d = await igGetLess("/" + id, (n) => ({ fields: `messages.limit(${n}){${IG_MSG_FIELDS}}` }), acc.token, [20, 10, 5, 1]); }
        catch (e) { if (e.code === 100 || igTooBig(e)) d = await igGetLess("/" + id, (n) => ({ fields: `messages.limit(${n}){id,created_time,from,to,message}` }), acc.token, [20, 10, 5, 1]); else throw e; }   // plain text only: attachments are what makes it too big
      } catch (e) { if (!igTooBig(e)) throw e; skipped++; console.error("[instagram] conversation skipped:", e.message); continue; }   // one heavy conversation doesn't stop the rest
      igPutConv.run(id, "", "", up);
      for (const m of d.messages?.data || []) if (igStore(acc, m, id, "poll")) fresh++;
      db.prepare(`UPDATE ig_conversations SET synced_updated_at = ? WHERE id = ?`).run(up, id);
      igSettle(acc, id, older.has(id));
    }
    db.prepare(`UPDATE ig_account SET synced_at = ?, last_error = ? WHERE id = 1`).run(Date.now(), skipped ? `${skipped} conversation${skipped === 1 ? "" : "s"} too big for Instagram to send — tried again next check.` : null);
    return { ok: true, fresh, conversations: convs, skipped };
  } catch (e) { igNote(e); console.error("[instagram]", reason, e.message); return { ok: false, error: igErr(e) }; }
  finally { IG_SYNCING = false; }
}

/* A long-lived token lasts 60 days and can be refreshed once a day; refreshed, it starts again at 60. */
async function igRefresh() {
  const acc = igAccount(); if (!acc) return;
  const age = Date.now() - acc.token_at;
  if (age < 86400000 || Date.now() > acc.expires_at) return;
  try {
    const d = await igGet("/refresh_access_token", { grant_type: "ig_refresh_token", access_token: acc.token });
    if (d.access_token) db.prepare(`UPDATE ig_account SET token = ?, token_at = ?, expires_at = ?, last_error = NULL WHERE id = 1`)
      .run(d.access_token, Date.now(), Date.now() + Math.max(3600, Number(d.expires_in) || 5184000) * 1000);
  } catch (e) { igNote(e); console.error("[instagram] refresh", e.message); }
}
setInterval(() => { igSync("tick"); igRefresh(); }, IG_POLL_MS).unref?.();
setTimeout(() => { igSync("boot"); igRefresh(); }, 20000).unref?.();

/* ── connecting: the admin goes to Instagram and comes back with a code ── */
const IG_STATES = new Map();   // state → { by, at }
app.get("/api/admin/instagram/connect", auth, admin, (req, res) => {
  if (!igReady()) return res.status(400).json({ error: "Set IG_APP_ID and IG_APP_SECRET in Railway → Variables first." });
  for (const [k, v] of IG_STATES) if (Date.now() - v.at > 600000) IG_STATES.delete(k);
  const state = randomBytes(18).toString("hex"); IG_STATES.set(state, { by: req.user.id, at: Date.now() });
  const qs = new URLSearchParams({ client_id: IG_APP_ID, redirect_uri: igRedirect(req), response_type: "code", scope: IG_SCOPE, state, force_reauth: "true" });
  res.json({ url: "https://www.instagram.com/oauth/authorize?" + qs });
});
app.get("/api/instagram/callback", rateLimit({ max: 20, windowMs: 600000 }), async (req, res) => {
  const back = (q) => res.redirect(302, "/admin?ig=" + encodeURIComponent(q) + "#instagram");
  const st = IG_STATES.get(String(req.query.state || "")); IG_STATES.delete(String(req.query.state || ""));
  if (!st || Date.now() - st.at > 600000) return back("That link is stale — press Connect again.");
  if (req.query.error || !req.query.code) return back(String(req.query.error_description || req.query.error_reason || "Instagram didn't allow it.").slice(0, 200));
  try {
    const form = new URLSearchParams({ client_id: IG_APP_ID, client_secret: IG_APP_SECRET, grant_type: "authorization_code", redirect_uri: igRedirect(req), code: String(req.query.code).replace(/#_$/, "") });
    const r1 = await fetch("https://api.instagram.com/oauth/access_token", { method: "POST", body: form, signal: AbortSignal.timeout(12000) });
    const d1 = await r1.json().catch(() => ({}));
    if (!r1.ok || !d1.access_token) throw new Error(d1.error_message || d1.error?.message || "Instagram didn't give a token.");
    const d2 = await igGet("/access_token", { grant_type: "ig_exchange_token", client_secret: IG_APP_SECRET, access_token: d1.access_token });
    const token = d2.access_token || d1.access_token, ttl = Math.max(3600, Number(d2.expires_in) || 5184000) * 1000;
    const me = await igGet("/me", { fields: "user_id,username" }, token);
    const igId = String(me.user_id || me.id || d1.user_id || "");
    if (!igId) throw new Error("Instagram didn't say which account that is.");
    db.prepare(`INSERT INTO ig_account (id, ig_id, username, token, token_at, expires_at, connected_by, connected_at) VALUES (1,?,?,?,?,?,?,?)
      ON CONFLICT(id) DO UPDATE SET ig_id = excluded.ig_id, username = excluded.username, token = excluded.token, token_at = excluded.token_at,
      expires_at = excluded.expires_at, connected_by = excluded.connected_by, connected_at = excluded.connected_at, last_error = NULL, walk_after = NULL, walk_done = 0`)
      .run(igId, String(me.username || "").slice(0, 60), token, Date.now(), Date.now() + ttl, st.by, Date.now());
    try { db.prepare(`INSERT INTO admin_log (admin_id, action, target, detail, created_at) VALUES (?,?,?,?,?)`).run(st.by, "instagram connect", "@" + (me.username || igId), "", Date.now()); } catch {}
    igSync("connect");
    back("ok");
  } catch (e) { console.error("[instagram] connect", e.message); back(igErr(e)); }
});
app.post("/api/admin/instagram/disconnect", auth, admin, (req, res) => {
  db.exec(`DELETE FROM ig_account; DELETE FROM ig_messages; DELETE FROM ig_conversations`);
  auditAdmin(req, "instagram disconnect");
  res.json({ ok: true });
});

/* ── what the admin sees ── */
function igStatus(req) {
  const a = igAccount();
  return { ready: igReady(), connected: !!a, username: a?.username || "", igId: a?.ig_id || "", connectedAt: a?.connected_at || null, syncedAt: a?.synced_at || null,
    expiresAt: a?.expires_at || null, lastError: a?.last_error || null, readingOlder: !!a && !a.walk_done, listed: a?.last_listed ?? null, pollMinutes: Math.round(IG_POLL_MS / 60000),
    webhook: { url: `${baseUrl(req)}/api/instagram/webhook`, verifyToken: igVerifyToken(), redirect: igRedirect(req) },
    unread: db.prepare(`SELECT COUNT(*) n FROM ig_messages WHERE seen = 0 AND mine = 0`).get().n };
}
app.get("/api/admin/instagram", auth, admin, (req, res) => {
  const convs = db.prepare(`SELECT c.*, (SELECT COUNT(*) FROM ig_messages m WHERE m.conv_id = c.id AND m.seen = 0 AND m.mine = 0) unread,
      (SELECT COUNT(*) FROM ig_messages m WHERE m.conv_id = c.id) count
    FROM ig_conversations c ORDER BY c.updated_at DESC LIMIT 300`).all().map((c) => {
    const last = db.prepare(`SELECT mid, mine, text, attachments, created_at, from_username FROM ig_messages WHERE conv_id = ? ORDER BY created_at DESC LIMIT 1`).get(c.id);
    const name = c.with_username || last?.from_username && !last.mine && last.from_username || "";
    return { id: c.id, username: name, withId: c.with_id, updatedAt: Math.max(c.updated_at, last?.created_at || 0), unread: c.unread, count: c.count,
      last: last ? { mine: !!last.mine, text: last.text, attachments: JSON.parse(last.attachments || "[]").length, at: last.created_at } : null };
  });
  res.json({ ...igStatus(req), conversations: convs });
});
app.get("/api/admin/instagram/thread/:id", auth, admin, (req, res) => {
  const c = db.prepare(`SELECT * FROM ig_conversations WHERE id = ?`).get(String(req.params.id));
  if (!c) return res.status(404).json({ error: "No such conversation." });
  const messages = db.prepare(`SELECT mid, from_id, from_username, mine, text, attachments, created_at, seen FROM ig_messages WHERE conv_id = ? ORDER BY created_at ASC LIMIT 200`).all(c.id)
    .map((m) => ({ ...m, mine: !!m.mine, seen: !!m.seen, attachments: JSON.parse(m.attachments || "[]") }));
  db.prepare(`UPDATE ig_messages SET seen = 1 WHERE conv_id = ? AND seen = 0`).run(c.id);   // opened = read
  res.json({ id: c.id, username: c.with_username || messages.find((m) => !m.mine)?.from_username || "", withId: c.with_id, messages });
});
app.post("/api/admin/instagram/seen", auth, admin, (req, res) => { db.prepare(`UPDATE ig_messages SET seen = 1 WHERE seen = 0`).run(); res.json({ ok: true }); });
app.post("/api/admin/instagram/sync", auth, admin, rateLimit({ max: 12, windowMs: 600000, key: "user" }), async (req, res) => {
  if (!igAccount()) return res.status(400).json({ error: "Instagram isn't connected." });
  const r = await igSync("refresh");
  if (!r.ok && !r.skipped) return res.status(502).json({ error: r.error || "Instagram didn't answer." });
  res.json({ ok: true, fresh: r.fresh || 0 });
});

/* ── webhooks: Meta's handshake, then signed deliveries ── */
app.get("/api/instagram/webhook", (req, res) => {
  const vt = igVerifyToken();
  if (req.query["hub.mode"] === "subscribe" && vt && req.query["hub.verify_token"] === vt) return res.type("text/plain").send(String(req.query["hub.challenge"] || ""));
  res.status(403).end();
});
function igSigned(req) {
  const sig = String(req.get("x-hub-signature-256") || "");
  if (!IG_APP_SECRET || !sig.startsWith("sha256=") || !req.rawBody) return false;
  const want = Buffer.from(createHmac("sha256", IG_APP_SECRET).update(req.rawBody).digest("hex")), got = Buffer.from(sig.slice(7));
  return want.length === got.length && timingSafeEqual(want, got);
}
app.post("/api/instagram/webhook", rateLimit({ max: 600, windowMs: 60000 }), (req, res) => {
  if (!igSigned(req)) return res.status(403).end();
  res.status(200).end();   // answer first; Meta retries anything slow
  try {
    const acc = igAccount(); if (!acc || req.body?.object !== "instagram") return;
    let fresh = 0;
    for (const en of req.body.entry || []) for (const ev of en.messaging || []) {
      const m = ev.message; if (!m || !m.mid) continue;
      const mine = m.is_echo ? 1 : 0, other = mine ? ev.recipient?.id : ev.sender?.id;
      const conv = db.prepare(`SELECT id FROM ig_conversations WHERE with_id = ?`).get(String(other || ""))?.id || "";   // polling names the conversation; a new person's first message waits (counted, unread) until the sync just below files it
      const row = { mid: m.mid, created_time: ev.timestamp, from: { id: mine ? acc.ig_id : ev.sender?.id }, to: { data: [{ id: mine ? other : acc.ig_id }] },
        message: m.text || "", attachments: m.attachments || [] };
      if (igStore(acc, row, conv, "webhook")) fresh++;
    }
    if (fresh) igSync("webhook");   // and pick up the proper conversation ids
  } catch (e) { console.error("[instagram] webhook", e.message); }
});
