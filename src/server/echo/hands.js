/* ================================================================
   ECHO · the hands v1.0 — 2026-11-04. "Build a simplified admin dashboard
   integrated with Echo so it can help me manage everything." Jorge chose A:
   Echo gets hands, with his yes on each. Nothing here acts on its own —
   every hand is a PROPOSAL: Claude calls the tool, a row lands in
   echo_proposals, a card with one Confirm appears on the turn, and only
   Jorge's tap runs it, through the SAME admin route the dashboard uses, as
   Jorge (his session token), so every server check still applies. Each run
   is in admin_log as "echo <action>", confirmed by him. The next message
   tells Claude what was confirmed, declined or failed, so it never claims a
   thing happened before it did.
   The hands, piece one: people (feature, rep, suspend/restore, confirm an
   email, sign out, Mod, Lead), reports, the tournament (end the phase,
   disqualify, remove/restore spam votes), Echo (teach an answer, a handoff
   done). Not here on purpose: deleting a member, a post or an event,
   broadcasts, backups, keys — rare and irreversible; the dashboard, by hand.
     POST /api/echo/proposals/:id/confirm   (admin, the proposer's own)
     POST /api/echo/proposals/:id/decline
   test/echo-hands.test.mjs
================================================================ */
db.exec(`CREATE TABLE IF NOT EXISTS echo_proposals (
  id INTEGER PRIMARY KEY AUTOINCREMENT, user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  ask_id INTEGER NOT NULL, action TEXT NOT NULL, args TEXT NOT NULL, title TEXT NOT NULL, why TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'pending', result TEXT NOT NULL DEFAULT '', told INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL, decided_at INTEGER);
CREATE INDEX IF NOT EXISTS idx_echo_proposals_user ON echo_proposals(user_id, status, id)`);

const handName = (u) => { const s = String(u || "").trim().toLowerCase().replace(/^@/, ""); if (!/^[a-z0-9._]{2,20}$/.test(s)) throw new Error("That doesn't look like a username."); return s; };
const handInt = (v, what) => { const n = Math.round(Number(v)); if (!Number.isFinite(n) || n <= 0) throw new Error(`Which ${what}? (its number)`); return n; };
const handWhy = (a) => String((a && a.why) || (a && a.reason) || "").trim().slice(0, 300);
const handNames = (a) => [...new Set((Array.isArray(a.usernames) ? a.usernames : []).map((u) => handName(u)))].slice(0, 50);
const handLab = (lab) => { const l = String(lab || "").trim().toLowerCase(); if (!PLACES[l]) throw new Error("Which lab? One of: " + Object.keys(PLACES).join(", ")); return l; };
const whyProp = { why: { type: "string", description: "One line on why, in plain words — Jorge reads it on the card" } };
const userProp = { username: { type: "string", description: "@handle" } };
const DO = { propose: "This does not act: it sets up a card with Confirm for Jorge. Say in one line what you've set up and why; never say it's done until a later message tells you it was confirmed." };

/* name → what Jorge reads on the card, and the admin route that runs when he confirms */
const ECHO_HANDS = [
  { name: "feature_member", description: `Feature a member's work: +40 rep, a notification to them. ${DO.propose}`, props: { ...userProp, ...whyProp }, required: ["username"],
    title: (a) => `Feature @${handName(a.username)} (+40 rep)`, route: (a) => ["POST", `/api/admin/members/${handName(a.username)}/feature`, {}], said: (r) => `now at ${r.rep} rep` },
  { name: "adjust_rep", description: `Add or take rep from a member with a reason (±500 at most). ${DO.propose}`, props: { ...userProp, delta: { type: "integer", description: "Positive adds, negative takes" }, reason: { type: "string" } }, required: ["username", "delta", "reason"],
    title: (a) => `${Number(a.delta) >= 0 ? "Give" : "Take"} ${Math.abs(Math.round(Number(a.delta)))} rep ${Number(a.delta) >= 0 ? "to" : "from"} @${handName(a.username)}`, route: (a) => { const d = Math.round(Number(a.delta)); if (!Number.isFinite(d) || !d || Math.abs(d) > 500) throw new Error("±500 at most, and not 0."); return ["POST", `/api/admin/members/${handName(a.username)}/rep`, { delta: d, reason: handWhy(a) }]; }, said: (r) => `now at ${r.rep} rep` },
  { name: "suspend_member", description: `Suspend a member (signs them out everywhere) or restore a suspended one. ${DO.propose}`, props: { ...userProp, suspended: { type: "boolean", description: "true suspends, false restores" }, ...whyProp }, required: ["username", "suspended"],
    title: (a) => `${a.suspended ? "Suspend" : "Restore"} @${handName(a.username)}`, route: (a) => ["POST", `/api/admin/members/${handName(a.username)}/suspend`, { suspended: !!a.suspended }], said: (r) => (r.suspended ? "suspended and signed out" : "restored") },
  { name: "confirm_email", description: `Mark a member's email as confirmed by hand (when the link never reached them). ${DO.propose}`, props: { ...userProp, ...whyProp }, required: ["username"],
    title: (a) => `Confirm @${handName(a.username)}'s email by hand`, route: (a) => ["POST", `/api/admin/members/${handName(a.username)}/verify`, {}], said: () => "email confirmed" },
  { name: "sign_out_member", description: `Sign a member out of every device (their password stays). ${DO.propose}`, props: { ...userProp, ...whyProp }, required: ["username"],
    title: (a) => `Sign @${handName(a.username)} out everywhere`, route: (a) => ["POST", `/api/admin/people/${handName(a.username)}/signout`, {}], said: (r) => `${r.sessions} session${r.sessions === 1 ? "" : "s"} ended` },
  { name: "make_mod", description: `Make a member a Mod (helps curate every lab), or take it back. ${DO.propose}`, props: { ...userProp, on: { type: "boolean" }, ...whyProp }, required: ["username", "on"],
    title: (a) => `${a.on ? "Make" : "Unmake"} @${handName(a.username)} a Mod`, route: (a) => ["POST", `/api/admin/members/${handName(a.username)}/mod`, { on: !!a.on }], said: (r) => (r.isMod || r.on ? "a Mod now" : "no longer a Mod") },
  { name: "name_lead", description: `Name a member the Lead of one lab (their name on the lab, "Lead · // Music" on their profile). Labs: ${Object.keys(PLACES).join(", ")}. ${DO.propose}`, props: { ...userProp, lab: { type: "string", description: "The lab's id" }, ...whyProp }, required: ["username", "lab"],
    title: (a) => `Name @${handName(a.username)} Lead of ${handLab(a.lab)}`, route: (a) => ["POST", `/api/admin/members/${handName(a.username)}/lead`, { lab: handLab(a.lab) }], said: () => "named Lead" },
  { name: "handle_report", description: `Mark a member report as handled (it leaves the work queue). ${DO.propose}`, props: { reportId: { type: "integer" }, ...whyProp }, required: ["reportId"],
    title: (a) => `Mark report #${handInt(a.reportId, "report")} handled`, route: (a) => ["POST", `/api/admin/reports/${handInt(a.reportId, "report")}/handle`, {}], said: () => "handled" },
  { name: "end_phase", description: `End the tournament's current phase now (entries, the vote, a round or the final close; later dates move up by the same amount). ${DO.propose}`, props: { eventId: { type: "integer" }, ...whyProp }, required: ["eventId"],
    title: (a) => `End the current phase of tournament #${handInt(a.eventId, "tournament")} now`, route: (a) => ["POST", `/api/admin/events/${handInt(a.eventId, "tournament")}/advance`, {}], said: (r) => (r.phase && r.phase.phase ? `now in ${r.phase.phase}` : "moved on") },
  { name: "disqualify_entry", description: `Remove an entry from a tournament, with a reason the entrant is told. ${DO.propose}`, props: { eventId: { type: "integer" }, entryId: { type: "integer" }, reason: { type: "string" } }, required: ["eventId", "entryId", "reason"],
    title: (a) => `Disqualify entry #${handInt(a.entryId, "entry")} from tournament #${handInt(a.eventId, "tournament")}`, route: (a) => ["POST", `/api/admin/events/${handInt(a.eventId, "tournament")}/entries/${handInt(a.entryId, "entry")}/dq`, { reason: handWhy(a) || "Removed by the organisers." }], said: () => "removed" },
  { name: "remove_spam_votes", description: `Remove the votes of accounts that aren't real (linked voters from the spam check), with undo. ${DO.propose}`, props: { usernames: { type: "array", items: { type: "string" } }, ...whyProp }, required: ["usernames"],
    title: (a) => { const n = handNames(a); return `Remove ${n.length} account${n.length === 1 ? "" : "s"}' votes as spam (${n.slice(0, 4).map((x) => "@" + x).join(", ")}${n.length > 4 ? "…" : ""})`; }, route: (a) => { const n = handNames(a); if (!n.length) throw new Error("Which accounts?"); return ["POST", "/api/admin/spam/remove", { usernames: n }]; }, said: (r) => `${r.votes ?? 0} vote${r.votes === 1 ? "" : "s"} from ${r.accounts ?? 0} account${r.accounts === 1 ? "" : "s"} removed` },
  { name: "restore_spam_votes", description: `Put back votes removed as spam. ${DO.propose}`, props: { usernames: { type: "array", items: { type: "string" } }, ...whyProp }, required: ["usernames"],
    title: (a) => { const n = handNames(a); return `Restore ${n.length} account${n.length === 1 ? "" : "s"}' votes`; }, route: (a) => { const n = handNames(a); if (!n.length) throw new Error("Which accounts?"); return ["POST", "/api/admin/spam/restore", { usernames: n }]; }, said: (r) => `${r.votes ?? 0} vote${r.votes === 1 ? "" : "s"} restored` },
  { name: "teach_echo", description: `Teach the members' Echo (the help) a question and its answer, in LABS's voice. ${DO.propose}`, props: { question: { type: "string", description: "As a member would ask it" }, answer: { type: "string", description: "Plain words: what to do and where to tap" }, keywords: { type: "string", description: "Other words people use for it" } }, required: ["question", "answer"],
    title: (a) => `Teach Echo: "${String(a.question || "").trim().slice(0, 80)}"`, route: (a) => ["POST", "/api/admin/echo/faq", { question: a.question, answer: a.answer, keywords: a.keywords || "" }], said: () => "taught" },
  { name: "mark_handoff_done", description: `Mark a member's handoff (a conversation sent to a person) as done. ${DO.propose}`, props: { handoffId: { type: "integer" }, ...whyProp }, required: ["handoffId"],
    title: (a) => `Mark handoff #${handInt(a.handoffId, "handoff")} done`, route: (a) => ["POST", `/api/admin/echo/handoffs/${handInt(a.handoffId, "handoff")}/done`, {}], said: () => "done" },
];
const handOf = (name) => ECHO_HANDS.find((h) => h.name === name) || null;
const echoHandTools = () => ECHO_HANDS.map((h) => ({ name: h.name, description: h.description, input_schema: { type: "object", properties: h.props, required: h.required, additionalProperties: false } }));
const echoIsHand = (name) => !!handOf(name);

/* Claude called a hand: a card, not an act. The title is built now, so a bad argument is caught here and told to Claude. */
function echoHandPropose(user, askId, name, args) {
  const h = handOf(name); if (!h) return { text: `No hand called ${name}.`, isError: true };
  const a = args && typeof args === "object" ? args : {};
  let title; try { title = h.title(a); h.route(a); } catch (e) { return { text: e.message, isError: true }; }
  const pending = db.prepare(`SELECT COUNT(*) n FROM echo_proposals WHERE user_id = ? AND status = 'pending'`).get(user.id).n;
  if (pending >= 8) return { text: "There are already 8 cards waiting for Jorge. Ask him to decide those first.", isError: true };
  const id = Number(db.prepare(`INSERT INTO echo_proposals (user_id, ask_id, action, args, title, why, created_at) VALUES (?,?,?,?,?,?,?)`).run(user.id, askId, name, JSON.stringify(a), title, handWhy(a), Date.now()).lastInsertRowid);
  return { text: JSON.stringify({ proposed: true, id, title, note: "Not done. Jorge sees a card with Confirm; tell him in one line what you've set up and why." }) };
}
const echoProposalRow = (p) => ({ id: p.id, action: p.action, title: p.title, why: p.why, status: p.status, result: p.result, createdAt: p.created_at, decidedAt: p.decided_at });
function echoProposalsFor(userId) {
  const by = new Map();
  for (const p of db.prepare(`SELECT * FROM echo_proposals WHERE user_id = ? ORDER BY id`).all(userId)) { if (!by.has(p.ask_id)) by.set(p.ask_id, []); by.get(p.ask_id).push(echoProposalRow(p)); }
  return by;
}
/* What happened to the cards since Claude last heard — told once, on the next message. */
function echoHandNews(userId) {
  const rows = db.prepare(`SELECT * FROM echo_proposals WHERE user_id = ? AND told = 0 AND status != 'pending' ORDER BY id`).all(userId);
  if (!rows.length) return "";
  db.prepare(`UPDATE echo_proposals SET told = 1 WHERE user_id = ? AND told = 0 AND status != 'pending'`).run(userId);
  return "(Since your last message, on the cards you set up: " + rows.map((p) => `"${p.title}" — ${p.status === "confirmed" ? "Jorge confirmed it; " + (p.result || "done") : p.status === "declined" ? "Jorge said not now" : "it failed: " + p.result}`).join("; ") + ".)";
}
/* A new conversation puts its waiting cards away too. */
function echoHandsReset(userId) { db.prepare(`UPDATE echo_proposals SET status = 'declined', result = 'put away with the conversation', decided_at = ?, told = 1 WHERE user_id = ? AND status = 'pending'`).run(Date.now(), userId); }

/* Jorge's tap: run the admin route as Jorge, with Jorge's own session, and write it down. */
async function echoHandRun(p, user, token) {
  const h = handOf(p.action); if (!h) throw new Error("That hand is gone.");
  const [method, path, body] = h.route(JSON.parse(p.args));
  const r = await fetch(`http://127.0.0.1:${PORT}${path}`, { method, headers: { Authorization: "Bearer " + token, "content-type": "application/json", Accept: "application/json" }, body: JSON.stringify(body || {}), signal: AbortSignal.timeout(25000) });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(j.error || `LABS said ${r.status}`);
  let said = ""; try { said = h.said(j) || ""; } catch { said = "done"; }
  return said;
}
const echoProposalOf = (req) => db.prepare(`SELECT * FROM echo_proposals WHERE id = ? AND user_id = ?`).get(+req.params.id, req.user.id);
app.post("/api/echo/proposals/:id/confirm", auth, admin, rateLimit({ max: 30, windowMs: 60000, key: "user" }), async (req, res) => {
  const p = echoProposalOf(req); if (!p) return res.status(404).json({ error: "No such card" });
  if (p.status !== "pending") return res.status(409).json({ error: "That card was already decided", proposal: echoProposalRow(p) });
  let status = "confirmed", result = "";
  try { result = await echoHandRun(p, req.user, req.token); } catch (e) { status = "failed"; result = String(e.message || "").slice(0, 300); }
  db.prepare(`UPDATE echo_proposals SET status = ?, result = ?, decided_at = ? WHERE id = ?`).run(status, result, Date.now(), p.id);
  db.prepare(`INSERT INTO admin_log (admin_id, action, target, detail, created_at) VALUES (?,?,?,?,?)`).run(req.user.id, `echo ${p.action}`, String(p.id), JSON.stringify({ title: p.title, by: "echo", confirmed: status === "confirmed", result }).slice(0, 400), Date.now());
  console.log(`[echo] @${req.user.username} ${status === "confirmed" ? "confirmed" : "tried"}: ${p.title}${result ? " — " + result : ""}`);
  const row = echoProposalRow(db.prepare(`SELECT * FROM echo_proposals WHERE id = ?`).get(p.id));
  brainTell(req.user.id, { kind: "proposal", askId: p.ask_id, proposal: row });
  res.json({ ok: status === "confirmed", proposal: row });
});
app.post("/api/echo/proposals/:id/decline", auth, admin, (req, res) => {
  const p = echoProposalOf(req); if (!p) return res.status(404).json({ error: "No such card" });
  if (p.status === "pending") db.prepare(`UPDATE echo_proposals SET status = 'declined', decided_at = ? WHERE id = ?`).run(Date.now(), p.id);
  const row = echoProposalRow(db.prepare(`SELECT * FROM echo_proposals WHERE id = ?`).get(p.id));
  brainTell(req.user.id, { kind: "proposal", askId: p.ask_id, proposal: row });
  res.json({ ok: true, proposal: row });
});
