// Spam check v1.0 (2026-10-27): "Any account with multiple linked accounts needs
// to be deleted and their vote disregarded… I'll manually do. I don't like my
// member count being filled with bots." Linked groups of voters with reasons;
// Remove suspends and takes votes off; Undo brings both back. Real server.
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { mkdirSync, rmSync, writeFileSync, readFileSync } from "node:fs";
import { spawn } from "node:child_process";
const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const DATA = join(ROOT, "test/.tmp/spam");
rmSync(DATA, { recursive: true, force: true }); mkdirSync(join(DATA, "uploads"), { recursive: true });
process.env.TNL_DATA = DATA;
let pass = 0, fail = 0;
const t = (n, ok) => { ok ? pass++ : fail++; console.log("  " + (ok ? "✓" : "✗") + "  " + n); };
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const { db } = await import("../src/db.js");
const now = Date.now(), D = 86400000, M = 60000;
const mk = (u, { admin = 0, ago = 30 * D, photo = "" } = {}) => {
  const id = Number(db.prepare(`INSERT INTO users (username, display_name, email, password_hash, created_at, email_verified, avatar_url) VALUES (?,?,?,?,?,1,?)`).run(u, u, u + "@gmail.com", "x", now - ago, photo).lastInsertRowid);
  if (admin) db.prepare(`UPDATE users SET is_admin = 1 WHERE id = ?`).run(id);
  db.prepare(`INSERT INTO sessions (token, user_id, created_at) VALUES (?,?,?)`).run("tok-" + u, id, now);
  return id;
};
mk("boss", { admin: 1 }); mk("artist", { photo: "/uploads/a.jpg" }); mk("rival", { photo: "/uploads/b.jpg" });
// a burst: four accounts minutes apart, no photos, no posts
for (let i = 0; i < 4; i++) mk("burst" + i, { ago: 3 * 3600000 - i * 5 * M });
// a real family on one home network, joined weeks apart, with photos
mk("mum", { ago: 40 * D, photo: "/uploads/m.jpg" }); mk("son", { ago: 20 * D, photo: "/uploads/s.jpg" });
mk("loner", { ago: 10 * D });
writeFileSync(join(DATA, "uploads", "e0.jpg"), "x"); writeFileSync(join(DATA, "uploads", "e1.jpg"), "x");
db.close();
const PORT = 18920 + (process.pid % 40);
const srv = spawn(process.execPath, ["--experimental-sqlite", "src/server.js"], { cwd: ROOT, stdio: ["ignore", "pipe", "pipe"],
  env: { ...process.env, PORT: String(PORT), TNL_DATA: DATA, TNL_NO_WATCH: "1", RESEND_API_KEY: "", STRIPE_SECRET_KEY: "" } });
let log = ""; srv.stdout.on("data", (d) => log += d); srv.stderr.on("data", (d) => log += d);
for (let i = 0; i < 100 && !/listening/.test(log); i++) await wait(100);
const B = `http://127.0.0.1:${PORT}`;
let IPN = 0;   // each call from its own address unless one is given: only the links the test makes should link anyone
const call = async (who, path, body, { device, ip } = {}) => {
  const r = await fetch(B + path, { method: body ? "POST" : "GET", headers: { "Content-Type": "application/json", "cf-connecting-ip": ip || "10.9." + (Math.floor(++IPN / 250)) + "." + (IPN % 250), ...(who ? { Authorization: "Bearer tok-" + who } : {}), ...(device ? { "X-Device": device } : {}) }, body: body ? JSON.stringify(body) : undefined });
  return { s: r.status, j: await r.json().catch(() => ({})) };
};
try {
  const ev = (await call("boss", "/api/admin/events", { slug: "art", title: "Art", brief: "x", format: "poll", picks: 1, minAccountDays: 0, opensAt: now - D, submitDays: 14, voteDays: 7, finalDays: 3, published: true, mailOnOpen: false })).j.event;
  const e1 = (await call("artist", "/api/events/art/enter", { imageUrl: "/uploads/e0.jpg", caption: "a", agree: true })).j;
  await call("rival", "/api/events/art/enter", { imageUrl: "/uploads/e1.jpg", caption: "b", agree: true });
  await call("boss", `/api/admin/events/${ev.id}/advance`, {});
  const view = (await call("loner", "/api/events/art")).j;
  const entries = view.entries || view.event?.entries || [];
  const idOf = (who) => entries.find((e) => (e.username || e.author?.username || e.user?.username) === who)?.id;
  const ART = idOf("artist") ?? entries[0]?.id, RIV = idOf("rival") ?? entries[1]?.id;
  t("two entries, voting open", !!ART && !!RIV);
  // the burst: burst0+1 on one phone (different days aren't needed — different pieces would be fine; same piece is blocked, so burst1 votes on a second phone)
  const v = (who, entryId, device) => call(who, "/api/events/art/vote", { entryId, on: true }, { device, ip: "10.200.0." + who.length + who.charCodeAt(who.length - 1) });   // one address per voter
  await v("burst0", ART, "aaaaaaaaaaaaaaaaaaaaaaaa");
  await v("burst1", ART, "bbbbbbbbbbbbbbbbbbbbbbbb");
  t("a second account on that phone can't vote for the same piece", (await v("burst2", ART, "bbbbbbbbbbbbbbbbbbbbbbbb")).s === 403);
  await v("burst2", RIV, "bbbbbbbbbbbbbbbbbbbbbbbb");   // the other piece, same phone: allowed, and it links them
  await v("burst3", ART, "dddddddddddddddddddddddd");
  await v("mum", RIV, "eeeeeeeeeeeeeeeeeeeeeeee"); await v("son", RIV, "ffffffffffffffffffffffff"); await v("loner", RIV, "0000000000000000aaaa0000");
  // networks: the burst shares one, the family another (as server-01-signals writes them)
  const { DatabaseSync } = await import("node:sqlite"); const w = new DatabaseSync(join(DATA, "tnl.db"));
  const uid = (u) => w.prepare(`SELECT id FROM users WHERE username = ?`).get(u).id;
  const cols = w.prepare(`PRAGMA table_info(member_signals)`).all().map((c) => c.name);
  const sig = (u, net) => { const row = { user_id: uid(u), kind: "join", net, at: now }; const ks = Object.keys(row).filter((k) => cols.includes(k)); w.prepare(`INSERT INTO member_signals (${ks.join(",")}) VALUES (${ks.map(() => "?").join(",")})`).run(...ks.map((k) => row[k])); };
  for (const u of ["burst0", "burst1", "burst2", "burst3"]) sig(u, "net-burst");
  sig("mum", "net-home"); sig("son", "net-home"); sig("loner", "net-alone");
  w.close();

  console.log("\nTHE GROUPS");
  let S = (await call("boss", `/api/admin/events/${ev.id}/spam`)).j;
  const burst = S.groups.find((g) => g.people.some((p) => p.username === "burst0")), fam = S.groups.find((g) => g.people.some((p) => p.username === "mum"));
  t("the burst is one group of 4, linked by phone and network", burst && burst.size === 4 && burst.reasons.includes("Same phone") && burst.reasons.includes("Same network"));
  t("…with the reasons a person would look at", burst.reasons.some((r) => /^Joined within \d+ min of each other$/.test(r)) && burst.reasons.includes("None of them has posted") && burst.reasons.includes("No photos"));
  t("…and who they voted for", burst.votedFor[0]?.author === "artist" && burst.votedFor[0].n === 3 && burst.votedFor[1]?.author === "rival");
  t("the family is a group too, but with fewer reasons (weeks apart, photos)", fam && fam.size === 2 && fam.reasons.includes("Same network") && !fam.reasons.some((r) => /phone|Joined within|No photos/.test(r)));
  t("strongest first", S.groups[0] === burst || S.groups[0].people.some((p) => p.username === "burst0"));
  t("someone on their own isn't listed", !S.groups.some((g) => g.people.some((p) => p.username === "loner")));
  t("a member can't see any of it", (await call("loner", `/api/admin/events/${ev.id}/spam`)).s === 403);

  console.log("\nREMOVE AS SPAM");
  const before = (await call("boss", "/api/admin/people?filter=all")).j.total;
  t("a member can't remove anyone", (await call("loner", "/api/admin/spam/remove", { usernames: ["burst0"] })).s === 403);
  const rm = (await call("boss", "/api/admin/spam/remove", { usernames: ["burst0", "burst1", "burst2", "burst3", "boss"] })).j;
  t("four removed, their four votes taken off; an admin is never removed", rm.accounts === 4 && rm.votes === 4 && rm.skipped.includes("boss"));
  t("they're signed out on the spot", (await call("burst0", "/api/me")).s === 401);
  const after = (await call("boss", "/api/admin/people?filter=all")).j;
  t("the member count drops by four, and they're gone from Everyone", after.total === before - 4 && !after.people.some((p) => /^burst/.test(p.username)));
  t("…and they're under Suspended", (await call("boss", "/api/admin/people?filter=suspended")).j.people.filter((p) => /^burst/.test(p.username)).length === 4);
  S = (await call("boss", `/api/admin/events/${ev.id}/spam`)).j;
  const b2 = S.groups.find((g) => g.people.some((p) => p.username === "burst0"));
  t("the group still shows, marked removed, so it can be undone", b2 && b2.removed === 4);
  const { DatabaseSync: R } = await import("node:sqlite"); let d = new R(join(DATA, "tnl.db"));
  t("the scoreboard no longer counts their votes", d.prepare(`SELECT COUNT(*) n FROM event_votes WHERE entry_id = ?`).get(ART).n === 0 && d.prepare(`SELECT COUNT(*) n FROM removed_votes`).get().n === 4);
  d.close();

  console.log("\nUNDO");
  const un = (await call("boss", "/api/admin/spam/restore", { usernames: ["burst2"] })).j;
  t("one taps back: the account and its vote return", un.accounts === 1 && un.votes === 1);
  d = new R(join(DATA, "tnl.db"));
  t("…counted again on the scoreboard; the rest stay off", d.prepare(`SELECT COUNT(*) n FROM event_votes WHERE entry_id = ?`).get(RIV).n === 4 && d.prepare(`SELECT COUNT(*) n FROM event_votes WHERE entry_id = ?`).get(ART).n === 0 && d.prepare(`SELECT suspended, spam_at FROM users WHERE username = 'burst2'`).get().suspended === 0);
  d.close();
  const src = readFileSync(join(ROOT, "src/server-11-spam.js"), "utf8");
  t("suspended, never deleted", !/DELETE FROM users/.test(src));
} finally { srv.kill(); }
console.log(`\n  ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
