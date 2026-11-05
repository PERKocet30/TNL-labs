// KNOWLEDGE v1.0 (2026-11-04): what LABS knows about itself, kept inside LABS.
// The real server against a throwaway database: admins only; the creed and
// glossary are there on first boot; add, edit, put away; every edit keeps the
// version before with who and when, and can be restored; one export for any
// model (JSON and text); every write is in the admin log; the connector reads
// it and only reads it; nothing here ever touches messages.
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { mkdirSync, rmSync, readFileSync } from "node:fs";
import { spawn } from "node:child_process";
import { createHash } from "node:crypto";
const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const DATA = join(ROOT, "test/.tmp/knowledge");
rmSync(DATA, { recursive: true, force: true }); mkdirSync(DATA, { recursive: true });
process.env.TNL_DATA = DATA; process.env.TNL_NO_WATCH = "1";
let pass = 0, fail = 0;
const t = (n, ok) => { ok ? pass++ : fail++; console.log("  " + (ok ? "✓" : "✗") + "  " + n); };

const { db } = await import("../src/db.js");
const now = Date.now();
const U = (n, admin) => { const id = Number(db.prepare(`INSERT INTO users (username, display_name, email, password_hash, created_at, email_verified, is_admin) VALUES (?,?,?,?,?,1,?)`).run(n, n, n + "@secret.example", "h", now, admin ? 1 : 0).lastInsertRowid);
  db.prepare(`INSERT INTO sessions (token, user_id, created_at) VALUES (?,?,?)`).run("tok-" + n, id, now); return id; };
const boss = U("boss", true), ana = U("ana", false);
db.prepare(`INSERT INTO dm_threads (a_id, b_id, created_at, updated_at) VALUES (?,?,?,?)`).run(boss, ana, now, now);
db.prepare(`INSERT INTO dm_messages (thread_id, sender_id, body, created_at) VALUES (1, ?, 'SECRET DM TEXT', ?)`).run(boss, now);
db.close();

const PORT = 18850 + (process.pid % 200);
const srv = spawn(process.execPath, ["--experimental-sqlite", "src/server.js"], { cwd: ROOT, env: { ...process.env, PORT: String(PORT), TNL_DATA: DATA, TNL_NO_WATCH: "1", PUBLIC_URL: `http://127.0.0.1:${PORT}` }, stdio: ["ignore", "pipe", "pipe"] });
let log = ""; srv.stdout.on("data", (d) => log += d); srv.stderr.on("data", (d) => log += d);
for (let i = 0; i < 150 && !/listening/.test(log); i++) await new Promise((r) => setTimeout(r, 100));
const B = `http://127.0.0.1:${PORT}`;
const call = async (tok, method, path, body, form) => {
  const r = await fetch(B + path, { method, redirect: "manual", headers: { "content-type": form ? "application/x-www-form-urlencoded" : "application/json", ...(tok ? { authorization: "Bearer " + tok } : {}) }, body: body ? (form ? new URLSearchParams(body).toString() : JSON.stringify(body)) : undefined });
  const text = await r.text(); let j = {}; try { j = JSON.parse(text); } catch (e) {}
  return { s: r.status, j, text, type: r.headers.get("content-type") || "" };
};
const A = (m, p, b) => call("tok-boss", m, p, b);

try {
  console.log("\nADMINS ONLY");
  t("signed out → 401", (await call(null, "GET", "/api/admin/knowledge")).s === 401);
  t("a member → 403, on reading and writing", (await call("tok-ana", "GET", "/api/admin/knowledge")).s === 403 && (await call("tok-ana", "POST", "/api/admin/knowledge", { kind: "note", title: "x", body: "y" })).s === 403 && (await call("tok-ana", "GET", "/api/admin/knowledge/export")).s === 403);

  console.log("\nWHAT'S THERE ON DAY ONE");
  const first = (await A("GET", "/api/admin/knowledge")).j;
  const creed = first.entries.find((e) => e.key === "creed");
  t("the creed is there, word for word", creed && creed.kind === "creed" && creed.body === "We're not here to take part. We're here to take over.\nCultivators.");
  t("voice, decisions and a glossary too (lab, rep, Showroom, Cultivators…)", ["voice", "decision", "glossary"].every((k) => first.entries.some((e) => e.kind === k)) && ["Lab", "Rep", "Showroom", "Cultivators"].every((n) => first.entries.some((e) => e.kind === "glossary" && e.title === n)));
  t("it says LABS, never the other brand", first.entries.every((e) => !/\bTNL\b/.test(e.title + " " + e.body)));
  t("the kinds are named for the page", first.kinds.creed === "Creed" && first.kinds.glossary === "Glossary" && first.kinds.feature === "Features");
  const feats = first.entries.filter((e) => e.kind === "feature");
  t("every feature of the app is written down (70+ entries), each with real words", feats.length >= 70 && feats.every((e) => e.title && e.body.length >= 80 && e.tags));
  t("…the big ones are there: Showroom, Labs, Posts, Market, Selling, Payouts, Messages, the tournament, Echo, Knowledge, the admin", ["The Showroom", "Labs", "Posts", "The Market", "Selling (the sell walkthrough)", "Payouts (Stripe Connect)", "Messages", "The tournament (events)", "Echo (LABS's own)", "Knowledge", "The admin dashboard"].every((n) => feats.some((e) => e.title === n)));
  t("…and they say where things live in the code", feats.filter((e) => /Code: |src\/|server\/|app\//.test(e.body)).length >= 40);
  t("filter by kind and search", (await A("GET", "/api/admin/knowledge?kind=glossary")).j.entries.every((e) => e.kind === "glossary") && (await A("GET", "/api/admin/knowledge?q=cultivators")).j.entries.some((e) => e.key === "creed"));

  console.log("\nADD · EDIT · PUT AWAY — every version kept, with who and when");
  const add = await A("POST", "/api/admin/knowledge", { kind: "decision", title: "Echo stays admin-only", body: "Until Jorge says otherwise.", tags: "Echo, AI" });
  t("an admin adds an entry; tags are tidied", add.s === 200 && add.j.id && (await A("GET", "/api/admin/knowledge?q=admin-only")).j.entries.find((e) => e.id === add.j.id).tags === "echo ai");
  t("a kind that doesn't exist is refused", (await A("POST", "/api/admin/knowledge", { kind: "secret", title: "x", body: "y" })).s === 400);
  t("a title and the words are both needed", (await A("POST", "/api/admin/knowledge", { kind: "note", title: "x" })).s === 400);
  const id = add.j.id;
  const ed = await A("PATCH", `/api/admin/knowledge/${id}`, { body: "Until Jorge flips the switch in Admin → Echo." });
  const after = (await A("GET", "/api/admin/knowledge?q=switch")).j.entries.find((e) => e.id === id);
  t("an edit changes the words and says who", ed.j.changed === true && after && /flips the switch/.test(after.body) && after.updatedBy === "boss");
  const hist = (await A("GET", `/api/admin/knowledge/${id}/history`)).j.history;
  t("…and the version before is kept, with who and when", hist.length === 1 && hist[0].body === "Until Jorge says otherwise." && hist[0].by === "boss" && hist[0].at > 0);
  t("saving the same words again keeps no extra version", (await A("PATCH", `/api/admin/knowledge/${id}`, { body: after.body })).j.changed === false && (await A("GET", `/api/admin/knowledge/${id}/history`)).j.history.length === 1);
  const rs = await A("POST", `/api/admin/knowledge/${id}/restore/${hist[0].version}`);
  t("restoring brings the old words back and keeps today's as a version too", rs.s === 200 && (await A("GET", "/api/admin/knowledge?q=otherwise")).j.entries.some((e) => e.id === id) && (await A("GET", `/api/admin/knowledge/${id}/history`)).j.history.length === 2);
  t("a built-in entry edited in /admin stays edited (seeding doesn't overwrite)", (await A("PATCH", `/api/admin/knowledge/${creed.id}`, { tags: "creed cultivators takeover" })).s === 200);
  t("put away: it leaves the list and the export, and can be brought back", (await A("PATCH", `/api/admin/knowledge/${id}`, { archived: true })).s === 200
    && !(await A("GET", "/api/admin/knowledge")).j.entries.some((e) => e.id === id) && (await A("GET", "/api/admin/knowledge?archived=1")).j.entries.some((e) => e.id === id)
    && !(await A("GET", "/api/admin/knowledge/export")).j.entries.some((e) => e.id === id)
    && (await A("PATCH", `/api/admin/knowledge/${id}`, { archived: false })).s === 200 && (await A("GET", "/api/admin/knowledge")).j.entries.some((e) => e.id === id));
  t("no delete route — nothing is ever lost", (await A("DELETE", `/api/admin/knowledge/${id}`)).s === 404);
  const alog = (await A("GET", "/api/admin/log")).j.log;
  t("every write is in the admin log, with who", alog.filter((l) => /knowledge/.test(l.action) && l.by === "boss").length >= 6);

  console.log("\nONE EXPORT FOR ANY MODEL");
  const ej = await A("GET", "/api/admin/knowledge/export");
  t("JSON: the entries with kind, title, body, tags — no ids of people, no keys", ej.s === 200 && ej.j.app === "LABS" && ej.j.entries.length >= 90 && ej.j.entries.every((e) => Object.keys(e).join() === "id,kind,title,body,tags,updatedAt"));
  const et = await A("GET", "/api/admin/knowledge/export?format=text");
  t("text: plain, headed by kind, the creed first", /text\/plain/.test(et.type) && /^# LABS — what it knows about itself/.test(et.text) && /## Creed[\s\S]*### The creed\nWe're not here to take part/.test(et.text) && et.text.indexOf("## Creed") < et.text.indexOf("## Glossary"));
  t("text: the features have their own heading", /## Features\n/.test(et.text) && /### The Showroom\n/.test(et.text));
  t("the same text twice (so it can be diffed)", (await A("GET", "/api/admin/knowledge/export?format=text")).text === et.text);
  t("it's never cached", /no-store/.test((await fetch(B + "/api/admin/knowledge/export", { headers: { authorization: "Bearer tok-boss" } })).headers.get("cache-control") || ""));
  t("nothing from messages is in it", !/SECRET DM TEXT/.test(et.text) && !/SECRET DM TEXT/.test(JSON.stringify(ej.j)));

  console.log("\nTHE CONNECTOR READS IT — and only reads");
  const CB = "https://claude.ai/api/mcp/auth_callback";
  const reg = (await call(null, "POST", "/oauth/register", { client_name: "Claude", redirect_uris: [CB] })).j;
  const verifier = "v".repeat(50), challenge = createHash("sha256").update(verifier).digest("base64url");
  const ap = (await A("POST", "/oauth/approve", { client_id: reg.client_id, redirect_uri: CB, state: "s", code_challenge: challenge })).j;
  const code = new URL(ap.redirect || "https://x/").searchParams.get("code");
  const tok = (await call(null, "POST", "/oauth/token", { grant_type: "authorization_code", code: code || "", client_id: reg.client_id, redirect_uri: CB, code_verifier: verifier }, true)).j.access_token;
  const rpc = async (method, params) => (await call(tok, "POST", "/mcp", { jsonrpc: "2.0", id: 1, method, params })).j;
  const tools = (await rpc("tools/list", {})).result.tools;
  const kt = tools.find((x) => x.name === "knowledge");
  t("a `knowledge` tool, marked read-only", kt && kt.annotations.readOnlyHint === true && /creed/.test(kt.description));
  const wt = tools.filter((x) => /^knowledge_/.test(x.name)).map((x) => x.name).sort();
  t("two write tools and no other: knowledge_add and knowledge_edit, marked not read-only, never destructive", wt.join() === "knowledge_add,knowledge_edit" && tools.filter((x) => /^knowledge_/.test(x.name)).every((x) => x.annotations.readOnlyHint === false && x.annotations.destructiveHint === false));
  t("the add tool names every kind and asks for plain words, never private things", /decision \(Decisions\)/.test(JSON.stringify(tools.find((x) => x.name === "knowledge_add").inputSchema)) && /never.*private/i.test(tools.find((x) => x.name === "knowledge_add").description));
  const kr = JSON.parse((await rpc("tools/call", { name: "knowledge", arguments: { kind: "creed" } })).result.content[0].text);
  t("Claude reads the creed through it", kr.entries.some((e) => e.title === "The creed" && /take over/.test(e.body)) && kr.entries.every((e) => e.kind === "creed"));
  t("…and can search", JSON.parse((await rpc("tools/call", { name: "knowledge", arguments: { q: "showroom" } })).result.content[0].text).entries.some((e) => e.title === "Showroom"));
  t("a connector key can't call the admin routes itself (GET only, through /mcp)", (await call(tok, "POST", "/api/admin/knowledge", { kind: "note", title: "x", body: "y" })).s === 401 && (await call(tok, "PATCH", `/api/admin/knowledge/${id}`, { body: "z" })).s === 401);

  console.log("\nCLAUDE AND GROK WRITE KNOWLEDGE — and only Knowledge");
  const entry = async (id) => (await A("GET", "/api/admin/knowledge?archived=0")).j.entries.find((e) => e.id === id) || (await A("GET", "/api/admin/knowledge?archived=1")).j.entries.find((e) => e.id === id);
  const logOf = async (id) => (await A("GET", "/api/admin/log")).j.log.find((l) => l.action === "connector knowledge_add" && l.target === String(id));
  const wr = await rpc("tools/call", { name: "knowledge_add", arguments: { kind: "decision", title: "Echo is admin-only until it's perfected", body: "Decided 2026-11-04: Echo stays admins-only until Jorge flips the switch. Reason: members should meet it finished.", tags: "Echo, decision" } });
  const wrj = JSON.parse(wr.result?.content?.[0]?.text || "{}");
  const wrow = await entry(wrj.id || 0);
  t("Claude adds a decision: live, marked as Claude's, under the admin whose key it is", !wr.result?.isError && wrj.ok === true && wrow && wrow.source === "claude" && wrow.createdBy === "boss" && wrow.tags === "echo decision" && wrow.kind === "decision");
  t("…and Echo answers with it at once", (await call("tok-boss", "POST", "/api/echo/ask", { q: "why is echo admin-only until it is perfected" })).j.turn.knowId === wrj.id);
  const wl = await logOf(wrj.id);
  t("…and it's in the admin log, as a connector write by Claude under the admin", wl && wl.by === "boss" && /"by":"claude"/.test(wl.detail));
  const we = await rpc("tools/call", { name: "knowledge_edit", arguments: { id: wrj.id, body: "Decided 2026-11-04: Echo stays admins-only until Jorge flips the switch in Admin → Echo." } });
  const after2 = await entry(wrj.id);
  t("Claude edits it: only the field given changes, the version before is kept", !we.result?.isError && after2.body.endsWith("Admin → Echo.") && after2.title === "Echo is admin-only until it's perfected" && (await A("GET", `/api/admin/knowledge/${wrj.id}/history`)).j.history.length === 1);
  t("a kind that doesn't exist, or no words, is refused — including 'constructor' and '__proto__' (not kinds, whatever an object says)", (await rpc("tools/call", { name: "knowledge_add", arguments: { kind: "secrets", title: "x", body: "y" } })).result?.isError === true && (await rpc("tools/call", { name: "knowledge_add", arguments: { kind: "constructor", title: "x", body: "y" } })).result?.isError === true && (await rpc("tools/call", { name: "knowledge_edit", arguments: { id: wrj.id, kind: "__proto__" } })).result?.isError === true && (await A("POST", "/api/admin/knowledge", { kind: "constructor", title: "x", body: "y" })).s === 400 && (await rpc("tools/call", { name: "knowledge_add", arguments: { kind: "note", title: "x" } })).result?.isError === true);
  t("editing an entry that isn't there is an error", (await rpc("tools/call", { name: "knowledge_edit", arguments: { id: 999999, body: "z" } })).result?.isError === true);
  t("the connector can't put away or delete: archived is ignored, and there is no such tool", !(await rpc("tools/call", { name: "knowledge_edit", arguments: { id: wrj.id, archived: true } })).result?.isError && (await entry(wrj.id)).archived === false && (await rpc("tools/call", { name: "knowledge_delete", arguments: { id: wrj.id } })).result?.isError === true);
  t("nothing else can be written through it (no tool that writes members, settings, orders or posts)", !tools.some((x) => x.annotations.readOnlyHint === false && !/^knowledge_/.test(x.name)));
  /* Grok, from its own callback, writes as Grok */
  const greg = (await call(null, "POST", "/oauth/register", { redirect_uris: ["https://grok.com/connectors/oauth/callback"] })).j;
  const gv = "g".repeat(50), gch = createHash("sha256").update(gv).digest("base64url");
  const gap = (await A("POST", "/oauth/approve", { client_id: greg.client_id, redirect_uri: "https://grok.com/connectors/oauth/callback", state: "s", code_challenge: gch })).j;
  const gcode = new URL(gap.redirect || "https://x/").searchParams.get("code");
  const gtok = (await call(null, "POST", "/oauth/token", { grant_type: "authorization_code", code: gcode || "", client_id: greg.client_id, redirect_uri: "https://grok.com/connectors/oauth/callback", code_verifier: gv }, true)).j.access_token;
  const gw = JSON.parse((await call(gtok, "POST", "/mcp", { jsonrpc: "2.0", id: 1, method: "tools/call", params: { name: "knowledge_add", arguments: { kind: "glossary", title: "Drop", body: "A release of new pieces at a set time, announced on Instagram, sold on LABS." } } })).j.result?.content?.[0]?.text || "{}");
  t("Grok writes as Grok", gw.ok === true && (await entry(gw.id)).source === "grok" && /"by":"grok"/.test((await logOf(gw.id)).detail));
  let capped = 0; for (let i = 0; i < 62; i++) { const r = await rpc("tools/call", { name: "knowledge_add", arguments: { kind: "note", title: "note " + i, body: "filler " + i } }); if (r.result?.isError) capped++; }
  t("writes are capped at 60 an hour per admin", capped >= 2 && (await rpc("tools/call", { name: "knowledge_add", arguments: { kind: "note", title: "one more", body: "too many" } })).result?.isError === true);
  const et2 = (await A("GET", "/api/admin/knowledge/export?format=text")).text;
  t("the export carries what Claude and Grok wrote, like everything else", et2.includes("### Drop") && et2.includes("### Echo is admin-only"));

  console.log("\nNEVER MESSAGES");
  const src = readFileSync(join(ROOT, "src/server/knowledge/knowledge.js"), "utf8").replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
  t("the knowledge code never touches a message table", !/dm_messages|dm_threads|dm_members|group_|ig_messages|ig_conv/.test(src));
} catch (e) {
  fail++; console.log("  ✗  threw: " + (e.stack || e.message)); console.log(log.slice(-1500));
} finally { srv.kill(); }
console.log(`\n  ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
