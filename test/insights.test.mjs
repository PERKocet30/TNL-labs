// Connector insights (2026-10-29). Grok, reading the connector: "The gaps are
// mainly the drop-off points, marketplace behaviour, and what happens after
// someone votes or posts once." Invented members with known stories, read back
// through /mcp: each insight tells their story, admins only, nothing private.
import { spawn } from "node:child_process";
import { createHash } from "node:crypto";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { rmSync, mkdirSync } from "node:fs";
import { DatabaseSync } from "node:sqlite";
const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const DATA = join(ROOT, "test/.tmp/insights");
rmSync(DATA, { recursive: true, force: true }); mkdirSync(DATA, { recursive: true });
let pass = 0, fail = 0;
const t = (n, ok) => { ok ? pass++ : fail++; console.log("  " + (ok ? "✓" : "✗") + "  " + n); };

const PORT = 19100 + (process.pid % 200);
const srv = spawn(process.execPath, ["--experimental-sqlite", "src/server.js"], { cwd: ROOT, env: { ...process.env, PORT: String(PORT), TNL_DATA: DATA, PUBLIC_URL: `http://127.0.0.1:${PORT}` }, stdio: ["ignore", "pipe", "pipe"] });
let log = ""; srv.stdout.on("data", (d) => log += d); srv.stderr.on("data", (d) => log += d);
for (let i = 0; i < 100 && !/listening/.test(log); i++) await new Promise((r) => setTimeout(r, 100));
const B = `http://127.0.0.1:${PORT}`;

/* the server has made every table; now the stories */
const db = new DatabaseSync(join(DATA, "tnl.db"));
const now = Date.now(), D = 86400000, H = 3600000;
const U = (n, joinedDaysAgo, extra = {}) => { const id = Number(db.prepare(`INSERT INTO users (username, display_name, email, password_hash, created_at, email_verified, is_admin, stripe_account, stripe_ready) VALUES (?,?,?,?,?,1,?,?,?)`)
  .run(n, n, n + "@secret.example", "h", now - joinedDaysAgo * D, extra.admin ? 1 : 0, extra.acct || "", extra.ready ? 1 : 0).lastInsertRowid);
  db.prepare(`INSERT INTO sessions (token, user_id, created_at) VALUES (?,?,?)`).run("tok-" + n, id, now); return id; };
const boss = U("boss", 200, { admin: true });
const ana = U("ana", 40, { acct: "acct_ana", ready: true });   // posted on day one, still around a month later
const ben = U("ben", 40, { acct: "acct_ben" });                 // posted once, went quiet; Stripe connected, nothing listed
const fay = U("fay", 12);                                         // voted, followed the artist she voted for
const cat = U("cat", 9);                                         // came from an Instagram tournament link, only voted
const dan = U("dan", 5);                                         // joined, only looked
const ed = U("ed", 30);                                          // entered; listed without Stripe
const J = (id) => db.prepare(`SELECT created_at c FROM users WHERE id = ?`).get(id).c;
const post = (u, at, ch = "photography", img = "/uploads/x.jpg") => Number(db.prepare(`INSERT INTO posts (author_id, channel, body, image_url, created_at) VALUES (?,?,?,?,?)`).run(u, ch, "work", img, at).lastInsertRowid);
const anaPost = post(ana, J(ana) + H), benPost = post(ben, J(ben) + H, "tracks", null), edPost = post(ed, J(ed) + 2 * H);
db.prepare(`INSERT INTO likes (post_id, user_id, created_at) VALUES (?,?,?)`).run(edPost, ana, J(ana) + 31 * D);
db.prepare(`INSERT INTO join_signals (user_id, net, country, device, via, landing, referrer, created_at) VALUES (?,?,?,?,?,?,?,?)`).run(cat, "n1", "US", "iPhone · Instagram app", "email", "/?e=cup", "", J(cat));
/* the tournament: ana and ed entered; cat voted on two days, fay on one; fay followed ana after */
const ev = Number(db.prepare(`INSERT INTO events (slug, title, published, format, created_at, updated_at) VALUES ('cup','Cup',1,'poll',?,?)`).run(now - 10 * D, now).lastInsertRowid);
const eA = Number(db.prepare(`INSERT INTO event_entries (event_id, user_id, post_id, created_at) VALUES (?,?,?,?)`).run(ev, ana, anaPost, now - 9 * D).lastInsertRowid);
const eE = Number(db.prepare(`INSERT INTO event_entries (event_id, user_id, post_id, created_at) VALUES (?,?,?,?)`).run(ev, ed, edPost, now - 9 * D).lastInsertRowid);
const vote = (u, day, entry, at) => db.prepare(`INSERT INTO event_votes (event_id, stage, matchup, entry_id, voter_id, created_at) VALUES (?,?,?,?,?,?)`).run(ev, "vote", day, entry, u, at);
vote(cat, 20261020, eA, J(cat) + 3 * H); vote(fay, 20261020, eA, J(cat) + 4 * H); vote(cat, 20261021, eE, J(cat) + 27 * H);
db.prepare(`INSERT INTO follows (follower_id, followee_id, created_at) VALUES (?,?,?)`).run(fay, ana, J(cat) + 5 * H);
/* the shop: ana's listing looked at by cat and fay, saved by cat, a checkout cat never paid; ed listed with no Stripe */
const L = (u, title) => Number(db.prepare(`INSERT INTO listings (seller_id, title, price_cents, status, views, created_at, updated_at) VALUES (?,?,?,'active',?,?,?)`).run(u, title, 5000, 9, now - 8 * D, now).lastInsertRowid);
const la = L(ana, "Hoodie"); L(ed, "Print");
for (const u of [cat, fay]) db.prepare(`INSERT INTO listing_views (listing_id, user_id, viewed_at) VALUES (?,?,?)`).run(la, u, now - 2 * D);
db.prepare(`INSERT INTO listing_likes (listing_id, user_id, created_at) VALUES (?,?,?)`).run(la, cat, now - 2 * D);
db.prepare(`INSERT INTO orders (listing_id, buyer_id, seller_id, amount_cents, status, created_at, updated_at) VALUES (?,?,?,?,'pending',?,?)`).run(la, cat, ana, 5000, now - D, now - D);
/* collabs: ben said yes to ana 35 days ago (6 hours later); dan has ignored ed's invite for 4 days, ana ignored ed's for 9 */
const collabPost = post(ana, now - 36 * D);
db.prepare(`INSERT INTO collaborators (post_id, user_id, status, created_at) VALUES (?,?,'accepted',?)`).run(collabPost, ben, now - 36 * D);
db.prepare(`INSERT INTO rep_events (user_id, kind, amount, source_id, created_at) VALUES (?,?,?,?,?)`).run(ben, "collab_accepted", 10, collabPost, now - 36 * D + 6 * H);
db.prepare(`INSERT INTO collaborators (post_id, user_id, status, created_at) VALUES (?,?,'pending',?)`).run(edPost, dan, now - 4 * D);
db.prepare(`INSERT INTO collaborators (post_id, user_id, status, created_at) VALUES (?,?,'pending',?)`).run(edPost, ana, now - 9 * D);
/* tech: one error from Instagram's browser, one of ours; a slow request */
db.prepare(`INSERT INTO error_log (kind, message, detail, path, username, created_at) VALUES ('client',?,?,'/','',?)`).run("Uncaught Error: Error invoking postMessage: Java object is gone", "at sendDataToNative (iabjs://navigation_performance_logger_android:1:1)", now - H);
db.prepare(`INSERT INTO error_log (kind, message, detail, path, username, created_at) VALUES ('client',?,?,'/','cat',?)`).run("TypeError: evPick is not a function", "app:1:2", now - 2 * H);
db.prepare(`INSERT INTO slow_requests (route, method, ms, status, at) VALUES ('/api/feed','GET',2400,200,?)`).run(now - H);
/* a connector key for the admin */
const KEY = "labs_mcp_" + "a".repeat(64);
db.prepare(`INSERT INTO mcp_tokens (hash, refresh_hash, user_id, client_id, name, created_at, expires_at) VALUES (?,?,?,?,?,?,?)`).run(createHash("sha256").update(KEY).digest("hex"), "r1", boss, "c1", "Grok", now, now + 30 * D);

const call = (path, { method = "GET", token, body } = {}) => fetch(B + path, { method, headers: { ...(token ? { Authorization: "Bearer " + token } : {}), "Content-Type": "application/json" }, body: body ? JSON.stringify(body) : undefined });
const tool = async (name, args = {}) => { const r = await (await call("/mcp", { method: "POST", token: KEY, body: { jsonrpc: "2.0", id: 1, method: "tools/call", params: { name, arguments: args } } })).json();
  const text = r.result?.content?.[0]?.text || ""; try { return { text, j: JSON.parse(text) }; } catch { return { text, j: {} }; } };

try {
  /* visit days: opening the app signed in is noted once a day */
  await call("/api/me", { token: "tok-dan" }); await call("/api/me", { token: "tok-dan" });
  t("opening the app signed in notes the day once", db.prepare(`SELECT COUNT(*) n FROM member_days WHERE user_id = ?`).get(dan).n === 1);
  await tool("overview");
  t("a connector's own reads don't count as the admin visiting", db.prepare(`SELECT COUNT(*) n FROM member_days WHERE user_id = ?`).get(boss).n === 0);

  const list = await (await call("/mcp", { method: "POST", token: KEY, body: { jsonrpc: "2.0", id: 1, method: "tools/list" } })).json();
  const names = (list.result?.tools || []).map((x) => x.name);
  t("the six insights are connector tools", ["insights_conversion", "insights_retention", "insights_market", "insights_collabs", "insights_tournament", "insights_tech"].every((n) => names.includes(n)));
  t("members can't open them", (await call("/api/admin/insights/market", { token: "tok-ana" })).status === 403);

  const conv = await tool("insights_conversion", { days: 90 });
  const dp = conv.j.dropOffs || {};
  t("conversion: dan joined and only looked", dp.joinedAndOnlyLooked?.recent?.includes("dan"));
  t("conversion: ben posted once and went quiet", dp.postedOnceThenQuiet?.recent?.includes("ben") && !dp.postedOnceThenQuiet.recent.includes("ana"));
  t("conversion: cat voted but never entered or posted", dp.votedButNeverEntered?.members === 2 && dp.votedButNeverPosted?.recent?.includes("cat"));
  t("conversion: a median time to first post and first collab", conv.j.timeToFirst?.post?.medianHours >= 1 && conv.j.timeToFirst?.collab?.members === 1);
  const way = (conv.j.waysIn || []).find((w) => /Instagram → a tournament link/.test(w.wayIn));
  t("conversion: cat's way in is Instagram → a tournament link, voted", way && way.joined === 1 && way.voted === 1 && way.posted === 0);

  const ret = await tool("insights_retention", { days: 90 });
  t("retention: ana is back after 30 days, dan after 1 (a visit day)", ret.j.cameBack?.after30Days?.cameBack === 1 && ret.j.cameBack?.after1Day?.cameBack >= 2);
  t("retention: first-day habits split by who stayed a week", typeof ret.j.firstDay?.stayedAWeek?.did?.post === "number" && ret.j.firstDay.didnt.members >= 1);
  t("retention: first post's lab and kind, and who stayed", (ret.j.byFirstPostLab || []).some((g) => g.group === "Music" && g.stayed === 0) && (ret.j.byFirstPostKind || []).some((g) => g.group === "picture" && g.stayed >= 1));

  const mk = await tool("insights_market");
  t("market: viewers, saves and an unpaid checkout, not sold", mk.j.totals?.viewers === 2 && mk.j.totals?.saves === 1 && mk.j.totals?.checkoutsNotPaid === 1 && mk.j.totals?.sold === 0);
  t("market: the hoodie is looked at but not bought", mk.j.lookedAtNotBought?.[0]?.title === "Hoodie");
  t("market: ben connected Stripe but never listed; ed listed but can't be paid", mk.j.sellers?.connectedNeverListed?.who?.includes("ben") && mk.j.sellers?.listedButCantBePaid?.who?.includes("ed"));

  const co = await tool("insights_collabs");
  t("collabs: 3 sent, 1 accepted in 6 hours, 1 ignored over a week", co.j.invites?.sent === 3 && co.j.invites?.accepted === 1 && co.j.invites?.medianHoursToYes === 6 && co.j.invites?.ignoredOver7Days === 1);
  t("collabs: where it died — ed → ana", co.j.whereInvitesDie?.[0]?.from === "ed" && co.j.whereInvitesDie[0].to === "ana");

  const tn = await tool("insights_tournament");
  const e = tn.j.events?.[0] || {};
  t("tournament: 2 voters, both only voted, cat voted on 2 days", e.voters === 2 && e.onlyVoted === 2 && e.votedInMoreThanOneRound === 1);
  t("tournament: of day one's 2 voters, 1 came back the next day", e.rounds?.[0]?.voters === 2 && e.rounds[0].votedAgainLater === 1);
  t("tournament: ana got a follow from a voter; ed's votes brought no one", e.entries?.find((x) => x.artist === "ana")?.followersFromVoters === 1 && e.votesButNoOneReachedOut?.some((x) => x.artist === "ed"));

  const te = await tool("insights_tech");
  const errs = te.j.errorsLast24h || [];
  t("tech: two errors today, Instagram's marked not ours, ours marked ours", errs.length === 2 && errs.find((x) => /Java object/.test(x.message))?.ours === false && errs.find((x) => /evPick/.test(x.message))?.ours === true);
  t("tech: the slow request is there", te.j.slowOrFailedLast7Days?.[0]?.route === "/api/feed");

  const everything = [conv, ret, mk, co, tn, te].map((x) => x.text).join(" ");
  t("nothing private comes out (no emails, no Stripe account ids)", !/secret\.example|acct_/.test(everything));
  t("explanations survive the privacy filter", /readMe/.test(conv.text) && /readMe/.test(te.text));
} catch (e) { t("threw: " + e.message, false); }
srv.kill();
console.log(`\n${pass} passed, ${fail} failed`);
if (fail) { console.log(log.slice(-2000)); process.exit(1); }
