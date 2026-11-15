// LABS connector (2026-10-27): Claude reads the admin dashboard through /mcp.
// "Full access to my admin dashboard, read only, besides members' messages and
// things that might violate member privacy." These checks pin that down: the
// sign-in only works for an admin and only for Claude's callback, a key opens
// GET on the allowed admin routes and nothing else, nothing personal comes out,
// and a key can be cut off from Admin → Systems.
import { spawn } from "node:child_process";
import { createHash } from "node:crypto";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { rmSync, mkdirSync } from "node:fs";
const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const DATA = join(ROOT, "test/.tmp/connector");
rmSync(DATA, { recursive: true, force: true }); mkdirSync(DATA, { recursive: true });
process.env.TNL_DATA = DATA;
const { db } = await import(join(ROOT, "src/db.js"));
const now = Date.now();
const U = (n, admin) => { const id = Number(db.prepare(`INSERT INTO users (username, display_name, email, password_hash, created_at, email_verified, is_admin) VALUES (?,?,?,?,?,1,?)`).run(n, n, n + "@secret.example", "h", now, admin ? 1 : 0).lastInsertRowid);
  db.prepare(`INSERT INTO sessions (token, user_id, created_at) VALUES (?,?,?)`).run("tok-" + n, id, now); return id; };
const boss = U("boss", true), ana = U("ana", false);
db.exec(`CREATE TABLE IF NOT EXISTS admin_notes (user_id INTEGER PRIMARY KEY, body TEXT NOT NULL DEFAULT '', updated_by INTEGER, updated_at INTEGER NOT NULL)`);
db.prepare(`INSERT INTO admin_notes (user_id, body, updated_by, updated_at) VALUES (?,?,?,?)`).run(ana, "PRIVATE NOTE about ana", boss, now);
const SONG = Number(db.prepare(`INSERT INTO tracks (user_id, title, url, artwork_url, duration_ms, created_at) VALUES (?,?,?,?,?,?)`).run(ana, "NOT IT vfinal", "/uploads/song-abc.m4a", "", 131000, now).lastInsertRowid);
db.close();
let pass = 0, fail = 0;
const t = (n, ok) => { ok ? pass++ : fail++; console.log("  " + (ok ? "✓" : "✗") + "  " + n); };

const PORT = 18900 + (process.pid % 200);
const srv = spawn(process.execPath, ["--experimental-sqlite", "src/server.js"], { cwd: ROOT, env: { ...process.env, PORT: String(PORT), TNL_DATA: DATA, PUBLIC_URL: `http://127.0.0.1:${PORT}` }, stdio: ["ignore", "pipe", "pipe"] });
let log = ""; srv.stdout.on("data", (d) => log += d); srv.stderr.on("data", (d) => log += d);
for (let i = 0; i < 100 && !/listening/.test(log); i++) await new Promise((r) => setTimeout(r, 100));
const B = `http://127.0.0.1:${PORT}`;
const call = (path, { method = "GET", token, body, form } = {}) => fetch(B + path, { method, redirect: "manual",
  headers: { ...(token ? { Authorization: "Bearer " + token } : {}), "Content-Type": form ? "application/x-www-form-urlencoded" : "application/json" },
  body: body ? (form ? new URLSearchParams(body).toString() : JSON.stringify(body)) : undefined });
const CB = "https://claude.ai/api/mcp/auth_callback";

try {
  /* discovery */
  const meta = await (await call("/.well-known/oauth-authorization-server")).json();
  t("discovery names the sign-in, token and registration doors", meta.authorization_endpoint === B + "/oauth/authorize" && meta.token_endpoint === B + "/oauth/token" && meta.registration_endpoint === B + "/oauth/register");
  t("discovery asks for PKCE S256", (meta.code_challenge_methods_supported || []).includes("S256"));
  const pr = await (await call("/.well-known/oauth-protected-resource/mcp")).json();
  t("the resource points back at this server", pr.resource === B + "/mcp" && pr.authorization_servers[0] === B);

  /* registration */
  const bad = await call("/oauth/register", { method: "POST", body: { client_name: "Evil", redirect_uris: ["https://evil.example/cb"] } });
  t("a client with a non-Claude callback is refused", bad.status === 400);
  const reg = await (await call("/oauth/register", { method: "POST", body: { client_name: "Claude", redirect_uris: [CB] } })).json();
  t("Claude's callback registers", /^labs_client_/.test(reg.client_id || ""));
  /* 2026-10-29: "build a connector for Grok" — Grok's custom connector signs in the same way, from its exact callback */
  for (const g of ["https://grok.com/connectors-oauth-exchange-code/", "https://grok.com/connectors/oauth/callback"]) {
    const gr = await (await call("/oauth/register", { method: "POST", body: { client_name: "Totally Claude", redirect_uris: [g] } })).json();
    t("Grok's callback registers (" + g.slice(17) + "), named Grok whatever it calls itself", /^labs_client_/.test(gr.client_id || "") && gr.client_name === "Grok");
  }
  const lookalikes = ["https://grok.com/connectors-oauth-exchange-code", "https://grok.com/connectors-oauth-exchange-code/evil", "http://grok.com/connectors/oauth/callback",
    "https://grok.com.evil.example/connectors/oauth/callback", "https://evil.grok.com/connectors/oauth/callback", "https://grok.com/connectors/oauth/callback?x=1"];
  let lk = 0; for (const u of lookalikes) if ((await call("/oauth/register", { method: "POST", body: { redirect_uris: [u] } })).status === 400) lk++;
  t("near-misses of Grok's callback are refused (no slash, another path, http, other hosts, a query)", lk === lookalikes.length);
  t("one registration can't mix Claude's and Grok's callbacks", (await call("/oauth/register", { method: "POST", body: { redirect_uris: [CB, "https://grok.com/connectors/oauth/callback"] } })).status === 400);
  const greg = await (await call("/oauth/register", { method: "POST", body: { redirect_uris: ["https://grok.com/connectors-oauth-exchange-code/"] } })).json();
  const gv = "g".repeat(50), gch = createHash("sha256").update(gv).digest("base64url");
  const gpage = await (await call(`/oauth/authorize?client_id=${greg.client_id}&redirect_uri=${encodeURIComponent("https://grok.com/connectors-oauth-exchange-code/")}&state=s&code_challenge=${gch}&code_challenge_method=S256&response_type=code`)).text();
  t("the allow page names Grok and says to allow only if you pressed Connect in your own Grok", /Let Grok read the admin dashboard/.test(gpage) && /your own Grok/.test(gpage));
  const gap = await (await call("/oauth/approve", { method: "POST", token: "tok-boss", body: { client_id: greg.client_id, redirect_uri: "https://grok.com/connectors-oauth-exchange-code/", state: "s", code_challenge: gch } })).json();
  const gcode = new URL(gap.redirect || "https://x/").searchParams.get("code");
  const gtok = await (await call("/oauth/token", { method: "POST", form: true, body: { grant_type: "authorization_code", code: gcode || "", client_id: greg.client_id, redirect_uri: "https://grok.com/connectors-oauth-exchange-code/", code_verifier: gv } })).json();
  t("Grok gets a read-only key the same way, back on its own callback", gap.redirect && gap.redirect.startsWith("https://grok.com/connectors-oauth-exchange-code/?code=") && /^labs_mcp_/.test(gtok.access_token || ""));
  const gtools = await (await call("/mcp", { method: "POST", token: gtok.access_token, body: { jsonrpc: "2.0", id: 1, method: "tools/list" } })).json();
  t("…and sees the same tools", (gtools.result?.tools || []).length > 5);

  /* authorize + approve */
  const verifier = "v".repeat(50), challenge = createHash("sha256").update(verifier).digest("base64url");
  const authQ = `client_id=${reg.client_id}&redirect_uri=${encodeURIComponent(CB)}&state=xyz&code_challenge=${challenge}&code_challenge_method=S256&response_type=code`;
  const page = await call("/oauth/authorize?" + authQ);
  t("the allow page opens for a known client", page.status === 200 && /Allow/.test(await page.text()));
  t("the allow page refuses a client with the wrong callback", (await call(`/oauth/authorize?client_id=${reg.client_id}&redirect_uri=${encodeURIComponent("https://evil.example/cb")}&code_challenge=${challenge}&code_challenge_method=S256&response_type=code`)).status === 400);
  const approveBody = { client_id: reg.client_id, redirect_uri: CB, state: "xyz", code_challenge: challenge };
  t("a member can't approve", (await call("/oauth/approve", { method: "POST", token: "tok-ana", body: approveBody })).status === 403);
  t("nobody signed in can't approve", (await call("/oauth/approve", { method: "POST", body: approveBody })).status === 401);
  const ap = await (await call("/oauth/approve", { method: "POST", token: "tok-boss", body: approveBody })).json();
  const red = new URL(ap.redirect || "https://x/");
  t("the admin's approval sends Claude back with a code and the state", red.origin + red.pathname === CB && /^labs_code_/.test(red.searchParams.get("code") || "") && red.searchParams.get("state") === "xyz");

  /* token */
  const code = red.searchParams.get("code");
  const wrong = await call("/oauth/token", { method: "POST", form: true, body: { grant_type: "authorization_code", code, client_id: reg.client_id, redirect_uri: CB, code_verifier: "not-the-verifier" } });
  t("the wrong PKCE verifier gets no key", wrong.status === 400);
  t("…and burns the code", (await call("/oauth/token", { method: "POST", form: true, body: { grant_type: "authorization_code", code, client_id: reg.client_id, redirect_uri: CB, code_verifier: verifier } })).status === 400);
  const ap2 = await (await call("/oauth/approve", { method: "POST", token: "tok-boss", body: approveBody })).json();
  const code2 = new URL(ap2.redirect).searchParams.get("code");
  const tok = await (await call("/oauth/token", { method: "POST", form: true, body: { grant_type: "authorization_code", code: code2, client_id: reg.client_id, redirect_uri: CB, code_verifier: verifier } })).json();
  t("the right verifier gets a key and a refresh key", /^labs_mcp_[0-9a-f]{64}$/.test(tok.access_token || "") && /^labs_refresh_/.test(tok.refresh_token || ""));
  const KEY = tok.access_token;

  /* /mcp */
  const noauth = await call("/mcp", { method: "POST", body: { jsonrpc: "2.0", id: 1, method: "initialize", params: {} } });
  t("/mcp without a key says 401 and where to sign in", noauth.status === 401 && /resource_metadata=/.test(noauth.headers.get("www-authenticate") || ""));
  const rpc = async (method, params, id = 1) => (await (await call("/mcp", { method: "POST", token: KEY, body: { jsonrpc: "2.0", id, method, params } })).json());
  const init = await rpc("initialize", { protocolVersion: "2025-06-18", capabilities: {}, clientInfo: { name: "test", version: "0" } });
  t("initialize answers with the protocol version and the LABS name", init.result?.protocolVersion === "2025-06-18" && init.result?.serverInfo?.name === "LABS");
  t("a notification gets 202 and no body", (await call("/mcp", { method: "POST", token: KEY, body: { jsonrpc: "2.0", method: "notifications/initialized" } })).status === 202);
  const tools = (await rpc("tools/list", {})).result?.tools || [];
  const names = tools.map((x) => x.name);
  t("tools cover the dashboard (overview, members, orders, reports, events, systems…)", ["overview", "members", "member", "orders", "reports", "events", "systems", "systems_meta", "health"].every((n) => names.includes(n)));
  t("no tool reads messages, mail, backups, keys or the source (settings — the switches, never a key — joined on 2026-11-04)", !names.some((n) => /message|(^|_)dms?(_|$)|inbox|thread|mail|backup|connector|source|csv|vote/i.test(n)) && names.includes("settings"));
  t("every tool says it is read only — except the two that write Knowledge (2026-11-04)", tools.every((x) => x.annotations?.readOnlyHint === !/^knowledge_(add|edit)$/.test(x.name)) && tools.filter((x) => x.annotations?.readOnlyHint === false).length === 2);
  const ov = await rpc("tools/call", { name: "overview", arguments: {} });
  const ovj = JSON.parse(ov.result?.content?.[0]?.text || "{}");
  t("overview reads live numbers", !ov.result?.isError && Object.keys(ovj).length > 3);
  const mem = await rpc("tools/call", { name: "member", arguments: { username: "@ana" } });
  const memText = mem.result?.content?.[0]?.text || "";
  t("member returns ana's public stats", !mem.result?.isError && /"username":"ana"/.test(memText));
  t("…without her email", !/secret\.example|"email"/.test(memText));
  t("…or the admin's note about her", !/PRIVATE NOTE/.test(memText));
  /* 2026-10-28: a member's song, to cut into a LABS reel */
  const sg = await rpc("tools/call", { name: "songs", arguments: { id: SONG } });
  const sgj = JSON.parse(sg.result?.content?.[0]?.text || "{}").songs || [];
  t("songs: one song by its number, with its audio link and who made it", !sg.result?.isError && sgj.length === 1 && sgj[0].title === "NOT IT vfinal" && sgj[0].by === "ana"
    && sgj[0].audio === B + "/uploads/song-abc.m4a" && sgj[0].page === B + "/s/" + SONG);
  t("…and by search", (JSON.parse((await rpc("tools/call", { name: "songs", arguments: { q: "not it" } })).result?.content?.[0]?.text || "{}").songs || []).length === 1);
  t("…without anyone's email", !/secret\.example/.test(sg.result?.content?.[0]?.text || ""));
  t("a member can't list the songs' files", (await call("/api/admin/songs", { token: "tok-ana" })).status === 403);
  const people = await rpc("tools/call", { name: "members", arguments: { q: "ana" } });
  t("members list never carries an email", !/secret\.example|"email"/.test(people.result?.content?.[0]?.text || ""));
  const dm = await rpc("tools/call", { name: "instagram", arguments: {} });
  t("asking for a tool that doesn't exist is an error, not a leak", dm.result?.isError === true);
  const badName = await rpc("tools/call", { name: "member", arguments: { username: "../../etc" } });
  t("a username that isn't one is refused", badName.result?.isError === true);
  const alog = await rpc("tools/call", { name: "admin_log", arguments: {} });
  t("the admin log comes without what was typed", !/"detail"/.test(alog.result?.content?.[0]?.text || ""));
  t("GET /mcp doesn't stream", (await call("/mcp", { token: KEY })).status === 405);

  /* the key is not a session */
  t("a key can't read /api/me", (await call("/api/me", { token: KEY })).status === 401);
  t("a key can't open a member's messages", (await call("/api/admin/instagram", { token: KEY })).status === 401);
  t("a key can't read the mail log, backups, the connector keys or the CSV", (await Promise.all(["/api/admin/mail-log", "/api/admin/backups", "/api/admin/connectors", "/api/admin/members.csv"].map((p) => call(p, { token: KEY })))).every((r) => r.status === 401));
  t("a key can't change anything", (await call("/api/admin/connectors/1", { method: "DELETE", token: KEY })).status === 401 && (await call("/api/admin/members/ana/suspend", { method: "POST", token: KEY })).status === 401);
  t("a key used straight from outside opens nothing, not even an allowed route", (await call("/api/admin/overview", { token: KEY })).status === 401 && (await call("/api/admin/people?q=ana", { token: KEY })).status === 401);
  const evil = await call(`/oauth/authorize?client_id=${reg.client_id}&redirect_uri=${encodeURIComponent(CB)}&state=${encodeURIComponent("</script><script>alert(1)</script>")}&code_challenge=${challenge}&code_challenge_method=S256&response_type=code`);
  const evilHtml = await evil.text();
  t("a hostile state can't break out of the allow page's script", !evilHtml.includes("</script><script>alert(1)"));
  t("the allow page can't be framed", evil.headers.get("x-frame-options") === "DENY");

  /* refresh rotates; revoke cuts off */
  const re = await (await call("/oauth/token", { method: "POST", form: true, body: { grant_type: "refresh_token", refresh_token: tok.refresh_token, client_id: reg.client_id } })).json();
  t("refresh hands out a new key", /^labs_mcp_/.test(re.access_token || "") && re.access_token !== KEY);
  t("…and the old key stops working", (await call("/mcp", { method: "POST", token: KEY, body: { jsonrpc: "2.0", id: 9, method: "ping" } })).status === 401);
  t("…and the old refresh key is spent", (await call("/oauth/token", { method: "POST", form: true, body: { grant_type: "refresh_token", refresh_token: tok.refresh_token } })).status === 400);
  const list = await (await call("/api/admin/connectors", { token: "tok-boss" })).json();
  t("Admin → Systems lists the connected keys (Claude's and Grok's, each by name) with the address to paste", list.url === B + "/mcp" && list.keys.length === 2 && list.keys.every((k) => k.by === "boss") && list.keys.some((k) => k.name === "Grok") && list.keys.some((k) => k.name === "Claude"));
  t("a member can't see the keys", (await call("/api/admin/connectors", { token: "tok-ana" })).status === 403);
  const rv = await (await call("/api/admin/connectors/" + list.keys[0].id, { method: "DELETE", token: "tok-boss" })).json();
  t("the admin can disconnect it", rv.ok === true);
  t("…and the new key is dead too", (await call("/mcp", { method: "POST", token: re.access_token, body: { jsonrpc: "2.0", id: 10, method: "ping" } })).status === 401);

  { console.log("\nGEMINI (2026-11-14) — the same access as Claude and Grok, let in only when the owner says so");
  const G1 = "https://oauth-redirect.googleusercontent.com/r/labs-project-123", G2 = "https://oauth-redirect.googleusercontent.com/r/someone-elses-project";
  const greg0 = await call("/oauth/register", { method: "POST", body: { client_name: "Gemini", redirect_uris: [G1] } });
  t("Google's address alone opens nothing: Gemini isn't expected until the door is opened", greg0.status === 400 && /isn't expected right now/.test((await greg0.json()).error_description || ""));
  t("only the owner opens the door: signed out 401, a member 403", (await call("/api/admin/connectors/gemini/open", { method: "POST" })).status === 401 && (await call("/api/admin/connectors/gemini/open", { method: "POST", token: "tok-ana" })).status === 403);
  const door = await (await call("/api/admin/connectors/gemini/open", { method: "POST", token: "tok-boss" })).json();
  t("the owner opens it for ten minutes", door.ok === true && door.openUntil > Date.now() + 9 * 60000 && door.openUntil <= Date.now() + 10 * 60000 + 2000);
  const fakes = ["http://oauth-redirect.googleusercontent.com/r/labs-project-123", "https://oauth-redirect.googleusercontent.com.evil.example/r/x", "https://oauth-redirect-sandbox.googleusercontent.com/r/x", "https://oauth-redirect.googleusercontent.com/x/abc",
    "https://oauth-redirect.googleusercontent.com/r/abc?next=https://evil.example", "https://user@oauth-redirect.googleusercontent.com/r/abc"];   // few on purpose: the registration door allows 30 tries in ten minutes and this suite shares it
  let fk = 0; for (const u of fakes) if ((await call("/oauth/register", { method: "POST", body: { redirect_uris: [u] } })).status === 400) fk++;
  t(`with the door open, ${fakes.length} lookalikes are still refused (http, another host, Google's test host, another path, a query, a name in front)`, fk === fakes.length);
  t("…and Gemini's address can't ride in with Claude's", (await call("/oauth/register", { method: "POST", body: { redirect_uris: [G1, CB] } })).status === 400);
  t("…and the door is still open after them", (await (await call("/api/admin/connectors", { token: "tok-boss" })).json()).gemini.openUntil === door.openUntil);
  const gmr = await call("/oauth/register", { method: "POST", body: { client_name: "Whatever it calls itself", redirect_uris: [G1] } }), gm = await gmr.json();
  t("the first Gemini to register is let in, and named Gemini by LABS — not by what it calls itself", gmr.status === 201 && gm.client_name === "Gemini" && /^labs_client_/.test(gm.client_id));
  const st1 = (await (await call("/api/admin/connectors", { token: "tok-boss" })).json()).gemini;
  t("…the door shuts behind it; its address is held, but isn't Gemini's for good until the owner allows it", st1.pinned === 0 && st1.openUntil === null);
  t("a different Google project that tries afterwards is refused", (await call("/oauth/register", { method: "POST", body: { redirect_uris: [G2] } })).status === 400);
  t("the pinned Gemini can register again (it does, each time it reconnects)", (await call("/oauth/register", { method: "POST", body: { redirect_uris: [G1] } })).status === 201);
  const gv = "g".repeat(60), gc = createHash("sha256").update(gv).digest("base64url");
  const gpg = await (await call(`/oauth/authorize?client_id=${gm.client_id}&redirect_uri=${encodeURIComponent(G1)}&state=s1&code_challenge=${gc}&code_challenge_method=S256&response_type=code`)).text();
  t("the allow page names Gemini, and still needs the admin's own tap", /Let Gemini read the admin dashboard/.test(gpg) && /just pressed Connect in your own Gemini/.test(gpg)
    && (await call("/oauth/approve", { method: "POST", token: "tok-ana", body: { client_id: gm.client_id, redirect_uri: G1, state: "s1", code_challenge: gc } })).status === 403);
  const gapp = await (await call("/oauth/approve", { method: "POST", token: "tok-boss", body: { client_id: gm.client_id, redirect_uri: G1, state: "s1", code_challenge: gc } })).json();
  const gtok = await (await call("/oauth/token", { method: "POST", form: true, body: { grant_type: "authorization_code", code: new URL(gapp.redirect).searchParams.get("code"), client_id: gm.client_id, redirect_uri: G1, code_verifier: gv } })).json();
  t("approved, with PKCE, Gemini gets a key", new URL(gapp.redirect).origin + new URL(gapp.redirect).pathname === G1 && /^labs_mcp_[0-9a-f]{64}$/.test(gtok.access_token || "") && /^labs_refresh_/.test(gtok.refresh_token || ""));
  const grpc = async (key, method, params) => { const r = await call("/mcp", { method: "POST", token: key, body: { jsonrpc: "2.0", id: 7, method, params } }); return { s: r.status, j: await r.json().catch(() => ({})) }; };
  const gtools = ((await grpc(gtok.access_token, "tools/list", {})).j.result?.tools || []).map((x) => x.name), other = await (await call("/api/admin/connectors/key", { method: "POST", token: "tok-boss", body: { name: "Another app" } })).json(),
    ctools = ((await grpc(other.key, "tools/list", {})).j.result?.tools || []).map((x) => x.name);   // a key that "reads exactly what Claude does"
  t("the same tools as Claude and Grok — every one, and no more", gtools.length > 20 && gtools.join() === ctools.join());
  t("…reading works, and messages still have no tool", /members/.test(JSON.stringify((await grpc(gtok.access_token, "tools/call", { name: "overview", arguments: {} })).j)) && !gtools.some((n) => /^(messages?|inbox|dms?|chats?|instagram_inbox)$/i.test(n)));
  const gw = await grpc(gtok.access_token, "tools/call", { name: "knowledge_add", arguments: { kind: "decision", title: "Gemini wrote this one", body: "A decision saved from Gemini." } });
  const gk = ((await (await call("/api/admin/knowledge?kind=decision", { token: "tok-boss" })).json()).entries || []).find((e) => e.title === "Gemini wrote this one");
  t("it can write Knowledge, and the entry says Gemini wrote it", gw.s === 200 && !gw.j.result?.isError && gk && gk.source === "gemini");
  t("the owner's Allow is what makes the address Gemini's for good", (await (await call("/api/admin/connectors", { token: "tok-boss" })).json()).gemini.pinned === 1);
  const gr1 = await (await call("/oauth/token", { method: "POST", form: true, body: { grant_type: "refresh_token", refresh_token: gtok.refresh_token, client_id: gm.client_id } })).json();
  t("renewing: a new key and the SAME refresh key, as Google asks (Claude's and Grok's are still swapped)", /^labs_mcp_/.test(gr1.access_token || "") && gr1.access_token !== gtok.access_token && gr1.refresh_token === gtok.refresh_token);
  t("…the old key is dead, the new one works, and it can renew again", (await grpc(gtok.access_token, "ping", {})).s === 401 && (await grpc(gr1.access_token, "ping", {})).s === 200
    && (await call("/oauth/token", { method: "POST", form: true, body: { grant_type: "refresh_token", refresh_token: gtok.refresh_token, client_id: gm.client_id } })).status === 200);
  t("a pasted key that merely calls itself Gemini isn't Gemini: what it writes is from \"an app\"", await (async () => {
    const pk = await (await call("/api/admin/connectors/key", { method: "POST", token: "tok-boss", body: { name: "Gemini" } })).json();
    await grpc(pk.key, "tools/call", { name: "knowledge_add", arguments: { kind: "decision", title: "From a pasted key", body: "Not from the signed-in Gemini." } });
    const e = ((await (await call("/api/admin/knowledge?kind=decision", { token: "tok-boss" })).json()).entries || []).find((x) => x.title === "From a pasted key"); return !!e && e.source === "connector"; })());
  t("only the owner can forget Gemini", (await call("/api/admin/connectors/gemini", { method: "DELETE", token: "tok-ana" })).status === 403);
  const live = (await (await call("/oauth/token", { method: "POST", form: true, body: { grant_type: "refresh_token", refresh_token: gtok.refresh_token, client_id: gm.client_id } })).json()).access_token;
  const lateAp = await (await call("/oauth/approve", { method: "POST", token: "tok-boss", body: { client_id: gm.client_id, redirect_uri: G1, state: "s2", code_challenge: gc } })).json(), lateCode = new URL(lateAp.redirect).searchParams.get("code");
  const fg = await (await call("/api/admin/connectors/gemini", { method: "DELETE", token: "tok-boss" })).json();
  t("a code allowed just before Forget buys nothing afterwards (security review)", (await call("/oauth/token", { method: "POST", form: true, body: { grant_type: "authorization_code", code: lateCode, client_id: gm.client_id, redirect_uri: G1, code_verifier: gv } })).status === 400);
  t("Forget Gemini: its keys stop at once and its address is no longer known", fg.ok === true && fg.disconnected >= 1 && (await grpc(live, "ping", {})).s === 401
    && (await call("/oauth/token", { method: "POST", form: true, body: { grant_type: "refresh_token", refresh_token: gtok.refresh_token, client_id: gm.client_id } })).status === 400
    && (await call("/oauth/register", { method: "POST", body: { redirect_uris: [G1] } })).status === 400);
  const gone = await call(`/oauth/authorize?client_id=${gm.client_id}&redirect_uri=${encodeURIComponent(G1)}&state=s1&code_challenge=${gc}&code_challenge_method=S256&response_type=code`);
  t("…and the old Gemini client can't come back through the allow page or an approval", gone.status === 400 && /forgotten/.test(await gone.text())
    && (await call("/oauth/approve", { method: "POST", token: "tok-boss", body: { client_id: gm.client_id, redirect_uri: G1, state: "s1", code_challenge: gc } })).status === 400);
  /* someone else takes the window before the owner's Gemini does (security review): held, never allowed */
  await call("/api/admin/connectors/gemini/open", { method: "POST", token: "tok-boss" });
  const snipe = await (await call("/oauth/register", { method: "POST", body: { redirect_uris: [G2] } })).json();
  t("a stranger who takes the window is only held: not counted as Gemini, and the owner's Gemini is told to try again", /^labs_client_/.test(snipe.client_id || "") && (await (await call("/api/admin/connectors", { token: "tok-boss" })).json()).gemini.pinned === 0 && (await call("/oauth/register", { method: "POST", body: { redirect_uris: [G1] } })).status === 400);
  await call("/api/admin/connectors/gemini/open", { method: "POST", token: "tok-boss" });
  const sq = `client_id=${snipe.client_id}&redirect_uri=${encodeURIComponent(G2)}&state=x&code_challenge=${gc}&code_challenge_method=S256&response_type=code`;
  t("…and opening the door again throws the stranger out: no allow page, no approval, and the owner's Gemini gets in", (await call("/oauth/authorize?" + sq)).status === 400
    && (await call("/oauth/approve", { method: "POST", token: "tok-boss", body: { client_id: snipe.client_id, redirect_uri: G2, state: "x", code_challenge: gc } })).status === 400
    && (await call("/oauth/register", { method: "POST", body: { redirect_uris: [G1] } })).status === 201);
  { const { DatabaseSync } = await import("node:sqlite"); const d3 = new DatabaseSync(join(DATA, "tnl.db")); d3.prepare(`UPDATE mcp_gemini SET pinned_at = ? WHERE approved = 0`).run(Date.now() - 16 * 60000); d3.close(); }
  t("an address nobody allowed within fifteen minutes stops being held", (await call("/oauth/register", { method: "POST", body: { redirect_uris: [G1] } })).status === 400);
  await call("/api/admin/connectors/gemini/open", { method: "POST", token: "tok-boss" });
  { const { DatabaseSync } = await import("node:sqlite"); const d2 = new DatabaseSync(join(DATA, "tnl.db")); d2.prepare(`UPDATE mcp_door SET until = ? WHERE app = 'gemini'`).run(Date.now() - 1000); d2.close(); }
  t("a door left open closes itself: after ten minutes Gemini isn't expected any more", (await call("/oauth/register", { method: "POST", body: { redirect_uris: [G1] } })).status === 400 && (await (await call("/api/admin/connectors", { token: "tok-boss" })).json()).gemini.openUntil === null);
  const glog = ((await (await call("/api/admin/log", { token: "tok-boss" })).json()).log || []).map((l) => l.action);
  t("opening the door, the pin and forgetting are all in the admin log", ["connector gemini door opened", "connector gemini pinned", "connector gemini forgotten"].every((x) => glog.includes(x)));
  const src = (await import("node:fs")).readFileSync(join(ROOT, "src/server/connector/oauth.js"), "utf8");
  t("Claude and Grok are untouched by all of it: their callbacks are still matched exactly, and their refresh keys still swapped", src.includes('["claude.ai", "claude.com"].includes(x.hostname) && x.pathname === "/api/mcp/auth_callback"') && src.includes('const MCP_GROK = new Set(["https://grok.com/connectors-oauth-exchange-code/", "https://grok.com/connectors/oauth/callback"]);')
    && /if \(old\.name === "Gemini"\) \{[\s\S]{0,600}?\}\n    db\.prepare\(`UPDATE mcp_tokens SET revoked = 1 WHERE id = \?`\)\.run\(old\.id\);\n    return res\.json\(mcpIssue\(old\.user_id, old\.client_id, old\.name\)\);/.test(src));
  t("the address's shape is strict: one segment under /r/ or /a/, no port, no name, no query — whatever the door says", ["https://oauth-redirect.googleusercontent.com:8443/r/abc", "https://oauth-redirect.googleusercontent.com/r/a/b", "https://evil.example/r/abc", "https://oauth-redirect.googleusercontent.com/r/", "https://oauth-redirect.googleusercontent.com/r/abc#x"]
    .every((u) => { try { const x = new URL(u); return !(x.protocol === "https:" && x.hostname === "oauth-redirect.googleusercontent.com" && !x.username && !x.password && !x.port && !x.search && !x.hash && /^\/(r|a)\/[A-Za-z0-9._~-]{1,200}$/.test(x.pathname)); } catch (e) { return true; } })
    && src.includes('x.hostname === "oauth-redirect.googleusercontent.com" && !x.username && !x.password && !x.port && !x.search && !x.hash && /^\\/(r|a)\\/[A-Za-z0-9._~-]{1,200}$/.test(x.pathname)'));
  }
} catch (e) { t("no exception: " + e.message, false); console.log(log.slice(-800)); }
srv.kill();
console.log(`\n${pass} passed, ${fail} failed`);
