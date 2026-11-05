// ECHO · the hands v1.0 (2026-11-04): Echo proposes, Jorge confirms. A stand-in for
// Claude plays a script; the real server runs against a throwaway database. Checks:
// the hands are offered to Claude as tools, each one proposing, never acting; a
// proposal changes nothing until Confirm; Confirm runs the real admin route as the
// admin and writes the admin log; Not now declines; a route that refuses (an admin
// can't be suspended) marks the card failed in plain words; a member can't touch a
// card; Claude is told on its next message what was confirmed, declined or failed;
// a bad argument is caught before a card exists; New conversation puts cards away.
// v1.1: piece three — a setting from the short list, void a test order, the weekly, a nudge preview.
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { mkdirSync, rmSync } from "node:fs";
import { spawn } from "node:child_process";
import { createServer } from "node:http";
import { createHash } from "node:crypto";
const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const DATA = join(ROOT, "test/.tmp/echo-hands");
rmSync(DATA, { recursive: true, force: true }); mkdirSync(DATA, { recursive: true });
process.env.TNL_DATA = DATA; process.env.TNL_NO_WATCH = "1";
let pass = 0, fail = 0;
const t = (n, ok) => { ok ? pass++ : fail++; console.log("  " + (ok ? "✓" : "✗") + "  " + n); };

const { db } = await import("../src/db.js");
const now = Date.now();
const ins = db.prepare("INSERT INTO users (username,display_name,email,role,roles,password_hash,email_verified,created_at,is_admin,rep) VALUES (?,?,?,?,?,?,?,?,?,?)");
const admin = Number(ins.run("jorge", "Jorge F", "jorge@x.test", "Designer", '["Designer"]', "x", 1, now, 1, 150).lastInsertRowid);
const ana = Number(ins.run("ana", "Ana", "ana@x.test", "Producer", '["Producer"]', "x", 1, now, 0, 20).lastInsertRowid);
const ben = Number(ins.run("ben", "Ben", "ben@x.test", "Producer", '["Producer"]', "x", 0, now, 0, 0).lastInsertRowid);
for (const [tok, id] of [["tok-admin", admin], ["tok-ana", ana], ["tok-ben", ben], ["tok-ben2", ben]]) db.prepare("INSERT INTO sessions (token,user_id,created_at) VALUES (?,?,?)").run(tok, id, now);
const reportId = Number(db.prepare("INSERT INTO reports (reporter_id, user_id, reason, created_at) VALUES (?,?,?,?)").run(ana, ben, "spam", now).lastInsertRowid);

/* ---- the stand-in for Claude ---- */
const seen = []; let script = [];
const seal = (j) => "sig:" + createHash("sha256").update(JSON.stringify(j.system) + JSON.stringify(j.tools)).digest("hex").slice(0, 16);
const claude = createServer((req, res) => {
  let body = ""; req.on("data", (d) => body += d); req.on("end", () => {
    const j = JSON.parse(body || "{}"); seen.push({ headers: req.headers, body: j });
    const next = script.shift() || { stop_reason: "end_turn", content: [{ type: "text", text: "(script ran out)" }] };
    res.writeHead(200, { "content-type": "text/event-stream" });
    const ev = (type, d) => res.write(`event: ${type}\ndata: ${JSON.stringify({ type, ...d })}\n\n`);
    ev("message_start", { message: { id: "m" + seen.length, usage: {} } });
    const content = [{ type: "thinking" }, ...next.content];
    content.forEach((b, index) => {
      if (b.type === "thinking") { ev("content_block_start", { index, content_block: { type: "thinking", thinking: "", signature: "" } }); ev("content_block_delta", { index, delta: { type: "signature_delta", signature: seal(j) } }); }
      else if (b.type === "text") { ev("content_block_start", { index, content_block: { type: "text", text: "" } }); ev("content_block_delta", { index, delta: { type: "text_delta", text: b.text } }); }
      else { ev("content_block_start", { index, content_block: { type: "tool_use", id: b.id, name: b.name, input: {} } }); ev("content_block_delta", { index, delta: { type: "input_json_delta", partial_json: JSON.stringify(b.input || {}) } }); }
      ev("content_block_stop", { index });
    });
    ev("message_delta", { delta: { stop_reason: next.stop_reason }, usage: { output_tokens: 5 } }); ev("message_stop", {}); res.end();
  });
});
await new Promise((r) => claude.listen(0, "127.0.0.1", r));
const PORT = 18400 + (process.pid % 200);
const srv = spawn(process.execPath, ["--experimental-sqlite", "src/server.js"], { cwd: ROOT, env: { ...process.env, PORT: String(PORT), TNL_DATA: DATA, TNL_NO_WATCH: "1", ECHO_AI_KEY: "sk-ant-test", ANTHROPIC_API_KEY: "", ANTHROPIC_API_BASE: `http://127.0.0.1:${claude.address().port}` }, stdio: ["ignore", "pipe", "pipe"] });
let log = ""; srv.stdout.on("data", (d) => log += d); srv.stderr.on("data", (d) => log += d);
for (let i = 0; i < 150 && !/listening/.test(log); i++) await new Promise((r) => setTimeout(r, 100));
const call = async (tok, method, path, body) => {
  const r = await fetch(`http://127.0.0.1:${PORT}${path}`, { method, headers: { "content-type": "application/json", ...(tok ? { authorization: "Bearer " + tok } : {}) }, body: body ? JSON.stringify(body) : undefined });
  return { s: r.status, j: await r.json().catch(() => ({})) };
};
const ask = async (q) => (await call("tok-admin", "POST", "/api/echo/ask", { q })).j.turn;
const lastToolResult = () => { const m = seen.at(-1).body.messages.at(-1); return m.content[0].type === "tool_result" ? JSON.parse(m.content[0].content) : null; };
const rep = (id) => db.prepare("SELECT rep FROM users WHERE id = ?").get(id).rep;

try {
  console.log("\nTHE HANDS ARE OFFERED — as tools that propose, never act");
  script = [{ stop_reason: "end_turn", content: [{ type: "text", text: "Hi." }] }];
  await ask("hello");
  const tools = seen[0].body.tools.map((x) => x.name);
  t("Claude is offered the hands beside the eyes: feature, rep, suspend, confirm email, sign out, Mod, Lead, reports, the tournament, spam votes, teach, handoffs", ["feature_member", "adjust_rep", "suspend_member", "confirm_email", "sign_out_member", "make_mod", "name_lead", "handle_report", "end_phase", "disqualify_entry", "remove_spam_votes", "restore_spam_votes", "teach_echo", "mark_handoff_done"].every((n) => tools.includes(n)));
  t("every hand's description says it sets up a card, not an act; the instructions say the same", seen[0].body.tools.filter((x) => /_member$|_rep$|_phase$|_votes$|_echo$|_done$|_report$|_lead$|_mod$|_email$|_entry$/.test(x.name)).every((x) => /card with Confirm/.test(x.description)) && /Never say it was done until/.test(seen[0].body.system[0].text));
  t("no hand deletes: nothing named delete, remove_member, broadcast, backup or key", !tools.some((n) => /delete|remove_member|broadcast|backup|key/.test(n)));

  console.log("\nA PROPOSAL CHANGES NOTHING");
  script = [
    { stop_reason: "tool_use", content: [{ type: "tool_use", id: "tu_f", name: "feature_member", input: { username: "@Ana", why: "Her poster carried the week." } }] },
    { stop_reason: "end_turn", content: [{ type: "text", text: "I've set up a feature for @ana — her poster carried the week. Confirm below." }] },
  ];
  const a1 = await ask("feature ana");
  t("Claude's tool result says proposed, not done, with the card's id and title", lastToolResult().proposed === true && lastToolResult().title === "Feature @ana (+40 rep)" && /Not done/.test(lastToolResult().note));
  t("ana's rep hasn't moved; no notification, no admin log yet", rep(ana) === 20 && !db.prepare("SELECT 1 FROM admin_log WHERE action LIKE 'echo feature%'").get());
  t("the turn carries the card: pending, the title, the why", a1.proposals.length === 1 && a1.proposals[0].status === "pending" && a1.proposals[0].title === "Feature @ana (+40 rep)" && a1.proposals[0].why === "Her poster carried the week.");
  const card = a1.proposals[0].id;
  t("a member can't confirm or decline it; a stranger gets nothing", (await call("tok-ana", "POST", `/api/echo/proposals/${card}/confirm`)).s === 403 && (await call(null, "POST", `/api/echo/proposals/${card}/confirm`)).s === 401 && (await call("tok-admin", "POST", `/api/echo/proposals/999/confirm`)).s === 404);
  t("coming back, the card is still on the turn", (await call("tok-admin", "GET", "/api/echo")).j.turns.at(-1).proposals[0].id === card);

  console.log("\nCONFIRM RUNS IT — the real route, as Jorge, written down");
  const ok1 = await call("tok-admin", "POST", `/api/echo/proposals/${card}/confirm`);
  t("confirmed: ana has +40 rep, the card says done with the new total", ok1.s === 200 && ok1.j.ok && rep(ana) === 60 && ok1.j.proposal.status === "confirmed" && /now at 60 rep/.test(ok1.j.proposal.result));
  t("ana was told, the way the dashboard tells her", !!db.prepare("SELECT 1 FROM notifications WHERE user_id = ? AND kind = 'feature'").get(ana));
  const logRow = db.prepare("SELECT * FROM admin_log WHERE action = 'echo feature_member' AND admin_id = ?").get(admin);
  t("the admin log has it: echo feature_member, confirmed by Jorge, the title", !!logRow && /"by":"echo"/.test(logRow.detail) && /"confirmed":true/.test(logRow.detail) && /Feature @ana/.test(logRow.detail));
  t("a second tap does nothing twice", (await call("tok-admin", "POST", `/api/echo/proposals/${card}/confirm`)).s === 409 && rep(ana) === 60);

  console.log("\nNOT NOW, AND A ROUTE THAT REFUSES");
  script = [
    { stop_reason: "tool_use", content: [{ type: "tool_use", id: "tu_s", name: "suspend_member", input: { username: "ben", suspended: true, why: "Spam reports." } }, { type: "tool_use", id: "tu_j", name: "suspend_member", input: { username: "jorge", suspended: true, why: "testing" } }, { type: "tool_use", id: "tu_r", name: "handle_report", input: { reportId } }] },
    { stop_reason: "end_turn", content: [{ type: "text", text: "Three cards." }] },
  ];
  const a2 = await ask("deal with ben");
  const [pBen, pJorge, pRep] = a2.proposals;
  t("that question already carried the news of ana's card: confirmed, now at 60 rep", seen.at(-2).body.messages.at(-1).content.some((b) => b.type === "text" && /"Feature @ana \(\+40 rep\)" — Jorge confirmed it; now at 60 rep/.test(b.text)));
  t("three cards on one turn, all pending", a2.proposals.length === 3 && a2.proposals.every((p) => p.status === "pending") && pBen.title === "Suspend @ben" && pRep.title === `Mark report #${reportId} handled`);
  const no = await call("tok-admin", "POST", `/api/echo/proposals/${pBen.id}/decline`);
  t("Not now declines: ben untouched, the card says so", no.j.proposal.status === "declined" && !db.prepare("SELECT suspended FROM users WHERE id = ?").get(ben).suspended);
  const bad = await call("tok-admin", "POST", `/api/echo/proposals/${pJorge.id}/confirm`);
  t("confirming 'suspend the admin' fails the way the route refuses it, in plain words, and nothing changed", bad.s === 200 && bad.j.ok === false && bad.j.proposal.status === "failed" && /can't suspend an admin/.test(bad.j.proposal.result) && !db.prepare("SELECT suspended FROM users WHERE id = ?").get(admin).suspended);
  t("…and the failed try is in the log too, marked not confirmed", /"confirmed":false/.test(db.prepare("SELECT detail FROM admin_log WHERE action = 'echo suspend_member' ORDER BY id DESC").get().detail));
  const okRep = await call("tok-admin", "POST", `/api/echo/proposals/${pRep.id}/confirm`);
  t("the report is handled", okRep.j.ok && db.prepare("SELECT handled_at FROM reports WHERE id = ?").get(reportId).handled_at);

  console.log("\nCLAUDE IS TOLD — once, on the next message");
  script = [{ stop_reason: "end_turn", content: [{ type: "text", text: "Noted." }] }];
  await ask("ok what now");
  const askContent = seen.at(-1).body.messages.at(-1).content;
  const newsBlock = askContent.find((b) => b.type === "text" && /Since your last message/.test(b.text));
  t("the next question carries what happened to every card since", !!newsBlock && !/Feature @ana/.test(newsBlock.text) && /"Suspend @ben" — Jorge said not now/.test(newsBlock.text) && /"Suspend @jorge" — it failed: can't suspend an admin/.test(newsBlock.text) && /handled/.test(newsBlock.text));
  script = [{ stop_reason: "end_turn", content: [{ type: "text", text: "Yes." }] }];
  await ask("anything else?");
  t("…and only once", !seen.at(-1).body.messages.at(-1).content.some((b) => b.type === "text" && /Since your last message/.test(b.text)));
  t("the question still shows as asked, without the news", (await call("tok-admin", "GET", "/api/echo")).j.turns.at(-2).asked === "ok what now");

  console.log("\nBAD ARGUMENTS NEVER BECOME CARDS");
  script = [
    { stop_reason: "tool_use", content: [{ type: "tool_use", id: "tu_b1", name: "adjust_rep", input: { username: "ana", delta: 9000, reason: "lots" } }, { type: "tool_use", id: "tu_b2", name: "name_lead", input: { username: "ana", lab: "mars" } }, { type: "tool_use", id: "tu_b3", name: "feature_member", input: { username: "not a name!" } }] },
    { stop_reason: "end_turn", content: [{ type: "text", text: "Hm." }] },
  ];
  const a3 = await ask("give ana 9000 rep and make her lead of mars");
  const results = seen.at(-1).body.messages.at(-1).content;
  t("±500, a real lab, a real username — each refused to Claude as an error, no card made", results.every((r) => r.is_error) && /±500/.test(results[0].content) && /Which lab/.test(results[1].content) && /username/.test(results[2].content) && a3.proposals.length === 0);

  console.log("\nTHE REST OF THE HANDS — each builds its route");
  script = [
    { stop_reason: "tool_use", content: [
      { type: "tool_use", id: "h1", name: "adjust_rep", input: { username: "ana", delta: -10, reason: "a test order" } },
      { type: "tool_use", id: "h2", name: "confirm_email", input: { username: "ben" } },
      { type: "tool_use", id: "h3", name: "sign_out_member", input: { username: "ben" } },
      { type: "tool_use", id: "h4", name: "make_mod", input: { username: "ana", on: true } },
      { type: "tool_use", id: "h5", name: "teach_echo", input: { question: "How do I pin a song?", answer: "Profile → Music → ⋯ → Pin.", keywords: "pin song" } },
    ] },
    { stop_reason: "end_turn", content: [{ type: "text", text: "Five cards." }] },
  ];
  const a4 = await ask("housekeeping");
  t("five cards with readable titles", a4.proposals.map((p) => p.title).join(" | ") === "Take 10 rep from @ana | Confirm @ben's email by hand | Sign @ben out everywhere | Make @ana a Mod | Teach Echo: \"How do I pin a song?\"");
  for (const p of a4.proposals) await call("tok-admin", "POST", `/api/echo/proposals/${p.id}/confirm`);
  const u = (id) => db.prepare("SELECT * FROM users WHERE id = ?").get(id);
  t("all five ran as the dashboard would: rep 50, ben confirmed and signed out (2 sessions), ana a Mod, Echo taught", rep(ana) === 50 && u(ben).email_verified === 1 && !db.prepare("SELECT 1 FROM sessions WHERE user_id = ?").get(ben) && u(ana).is_mod === 1 && !!db.prepare("SELECT 1 FROM echo_faq WHERE question = 'How do I pin a song?'").get());
  t("the rep change is in the rep log, by the admin, like any admin change", !!db.prepare("SELECT 1 FROM rep_events WHERE user_id = ? AND kind = 'admin_deduct' AND amount = -10").get(ana));

  console.log("\nPIECE THREE — settings, a test order, mail");
  const listing = Number(db.prepare("INSERT INTO listings (seller_id,title,price_cents,category,status,kind,images,created_at,updated_at) VALUES (?,?,?,?,'active','item','[]',?,?)").run(ana, "Lab tee", 3000, "Tops", now, now).lastInsertRowid);
  const orderId = Number(db.prepare("INSERT INTO orders (listing_id,buyer_id,seller_id,amount_cents,shipping_cents,status,payment_ref,tracking,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?)").run(listing, admin, ana, 3000, 500, "paid", "cs_test", "", now, now).lastInsertRowid);
  script = [
    { stop_reason: "tool_use", content: [
      { type: "tool_use", id: "s1", name: "set_setting", input: { key: "announcement", value: "The tournament closes at 3pm." } },
      { type: "tool_use", id: "s2", name: "set_setting", input: { key: "echoModel", value: "claude-sonnet-5-5" } },
      { type: "tool_use", id: "s3", name: "set_setting", input: { key: "signupsOpen", value: "maybe" } },
      { type: "tool_use", id: "s4", name: "set_setting", input: { key: "stripeKey", value: "x" } },
      { type: "tool_use", id: "s5", name: "void_order", input: { orderId } },
      { type: "tool_use", id: "s6", name: "send_weekly", input: {} },
      { type: "tool_use", id: "s7", name: "nudge_preview", input: {} },
    ] },
    { stop_reason: "end_turn", content: [{ type: "text", text: "Cards." }] },
  ];
  const a6 = await ask("tidy up");
  const res6 = seen.at(-1).body.messages.at(-1).content;
  t("a setting outside the short list, or a value that isn't 1/0, never becomes a card", res6[2].is_error === true && /is 1 or 0/.test(res6[2].content) && res6[3].is_error === true && /Not a setting I can change/.test(res6[3].content));
  t("five cards with readable titles", a6.proposals.map((p) => p.title).join(" | ") === `Put up the banner: "The tournament closes at 3pm." | Switch Echo to Sonnet 5.5 | Mark order #${orderId} a test (void it) | Email me this week's report now | Send me a preview of the nudge email`);
  const out = {}; for (const p of a6.proposals) out[p.action] = (await call("tok-admin", "POST", `/api/echo/proposals/${p.id}/confirm`)).j;
  t("the banner is up and Echo answers from Sonnet next — through the settings route, logged as any settings change", db.prepare("SELECT value FROM settings WHERE key = 'announcement'").get().value === "The tournament closes at 3pm." && db.prepare("SELECT value FROM settings WHERE key = 'echoModel'").get().value === "claude-sonnet-5-5" && out.set_setting.ok);
  t("the order is void: gone from the numbers, the card says so", out.void_order.ok && db.prepare("SELECT status FROM orders WHERE id = ?").get(orderId).status !== "paid" && /voided/.test(out.void_order.proposal.result));
  t("mail isn't set up here, so the weekly says not sent and the nudge preview fails in the route's own words — honestly, on the card", /not sent/.test(out.send_weekly.proposal.result) && out.nudge_preview.ok === false && /Email isn't set up/.test(out.nudge_preview.proposal.result));
  await call("tok-admin", "POST", "/api/echo/model", { model: "claude-opus-5-5" });

  console.log("\nNEW CONVERSATION PUTS WAITING CARDS AWAY");
  script = [{ stop_reason: "tool_use", content: [{ type: "tool_use", id: "h9", name: "feature_member", input: { username: "ben" } }] }, { stop_reason: "end_turn", content: [{ type: "text", text: "Card." }] }];
  const a5 = await ask("feature ben");
  await call("tok-admin", "POST", "/api/echo/reset");
  t("a pending card is declined by the reset; ben's rep unchanged; the conversation is clean", db.prepare("SELECT status FROM echo_proposals WHERE id = ?").get(a5.proposals[0].id).status === "declined" && rep(ben) === 0 && (await call("tok-admin", "GET", "/api/echo")).j.turns.length === 0);
  t("too many waiting cards is refused to Claude (8 at most)", (() => { for (let i = 0; i < 8; i++) db.prepare("INSERT INTO echo_proposals (user_id, ask_id, action, args, title, created_at) VALUES (?,?,?,?,?,?)").run(admin, 1, "feature_member", "{}", "x", now); return true; })() && (async () => true)());
  script = [{ stop_reason: "tool_use", content: [{ type: "tool_use", id: "h10", name: "feature_member", input: { username: "ben" } }] }, { stop_reason: "end_turn", content: [{ type: "text", text: "." }] }];
  await ask("one more");
  t("…the ninth is turned away with a reason", /8 cards waiting/.test(seen.at(-1).body.messages.at(-1).content[0].content) && seen.at(-1).body.messages.at(-1).content[0].is_error === true);
} finally { srv.kill(); claude.close(); }

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
