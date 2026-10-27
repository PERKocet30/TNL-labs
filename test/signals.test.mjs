// REAL PEOPLE OR BOTS v1.0 — 2026-10-26: "I don't trust all these new
// accounts. I want to collect more data on them to make sure they're real
// accounts, not bots." Joining, signing in and voting note the network
// (hashed), country, device, how they joined and the first link; admins see
// it on a member's record and as a tournament's vote check. Runs the real
// server, with Cloudflare's headers standing in for the visitors' networks.
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { rmSync, mkdirSync, readFileSync } from "node:fs";
import bcrypt from "bcryptjs";
const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const DATA = join(ROOT, "test/.tmp/signals");
rmSync(DATA, { recursive: true, force: true }); mkdirSync(DATA, { recursive: true });
process.env.TNL_DATA = DATA;
const { db } = await import(join(ROOT, "src/db.js"));
let pass = 0, fail = 0;
const t = (n, ok) => { ok ? pass++ : fail++; console.log("  " + (ok ? "✓" : "✗") + "  " + n); };
const now = Date.now(), hash = bcrypt.hashSync("violet-kiln-27", 4);
const mk = (u, admin = 0, old = 0) => { const id = Number(db.prepare(`INSERT INTO users (username, display_name, email, password_hash, created_at, email_verified, is_admin) VALUES (?,?,?,?,?,1,?)`)
  .run(u, u, u + "@x.test", hash, now - old, admin).lastInsertRowid); db.prepare(`INSERT INTO sessions (token, user_id, created_at) VALUES (?,?,?)`).run("tok-" + u, id, now); return id; };
mk("boss", 1, 400 * 86400000); const ana = mk("ana", 0, 300 * 86400000), ben = mk("ben", 0, 300 * 86400000);
const post = (uid) => Number(db.prepare(`INSERT INTO posts (author_id, channel, body, image_url, is_work, created_at) VALUES (?,?,?,?,1,?)`).run(uid, "graphic-design", "piece", "/uploads/x.png", now).lastInsertRowid);
const postA = post(ana), postB = post(ben);
db.close();
const H = 3600000, sched = [{ phase: "submit", start: now - 48 * H, end: now - H }, { phase: "qualify", start: now - H, end: now + 72 * H }, { phase: "final", start: now + 72 * H, end: now + 96 * H }];
let evId, entA, entB;
/* the events tables belong to the server: they exist once it has started */
async function seedEvent() {
  const { DatabaseSync } = await import("node:sqlite"); const w = new DatabaseSync(join(DATA, "tnl.db"));
  evId = Number(w.prepare(`INSERT INTO events (slug, title, format, picks, min_account_days, require_verified, schedule, published, created_at, updated_at) VALUES ('art','Art','poll',1,0,1,?,1,?,?)`)
    .run(JSON.stringify(sched), now, now).lastInsertRowid);
  entA = Number(w.prepare(`INSERT INTO event_entries (event_id, user_id, post_id, created_at) VALUES (?,?,?,?)`).run(evId, ana, postA, now - 30 * H).lastInsertRowid);
  entB = Number(w.prepare(`INSERT INTO event_entries (event_id, user_id, post_id, created_at) VALUES (?,?,?,?)`).run(evId, ben, postB, now - 30 * H).lastInsertRowid);
  w.close();
}

const PORT = 8903, B = `http://localhost:${PORT}`;
const srv = spawn(process.execPath, ["--experimental-sqlite", "--no-warnings", "src/server.runtime.js"], {
  cwd: ROOT, stdio: "ignore", env: { ...process.env, TNL_DATA: DATA, PORT: String(PORT), STRIPE_SECRET_KEY: "", TNL_NO_VIDEO_FIX: "1", TNL_NO_WATCH: "1", PUBLIC_URL: B, RESEND_API_KEY: "" } });
const IPHONE_IG = "Mozilla/5.0 (iPhone; CPU iPhone OS 18_7 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/22H374 Instagram 452.0.1.39.54 (iPhone11,8; iOS 18_7_10; en_US)";
const ANDROID = "Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) SamsungBrowser/30.0 Chrome/143.0.0.0 Mobile Safari/537.36";
const HEADLESS = "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) HeadlessChrome/120.0.0.0 Safari/537.36";
const call = async (path, { body, tok, ip = "1.1.1.1", country = "US", ua = ANDROID, city = "", region = "", tz = "" } = {}) => {
  const r = await fetch(B + path, { method: body ? "POST" : "GET", headers: { "Content-Type": "application/json", "cf-connecting-ip": ip, "cf-ipcountry": country, "user-agent": ua,
    ...(city ? { "cf-ipcity": city } : {}), ...(region ? { "cf-region": region } : {}), ...(tz ? { "x-tz": tz } : {}),
    ...(tok ? { Authorization: "Bearer " + tok } : {}) }, body: body ? JSON.stringify(body) : undefined });
  return { s: r.status, j: await r.json().catch(() => ({})) };
};
const join_ = (u, o = {}) => call("/api/auth/register", { ...o, body: { username: u, displayName: u, email: u + "@" + (o.domain || "gmail.com"), password: "violet-kiln-27-q" + u.length, roles: ["Painter"],
  src: { landing: "/?e=art&v=" + entA + "&signup=SECRET&b=abc", referrer: "https://l.instagram.com/?u=https%3A%2F%2Ftnllabs.com&e=AT0", firstSeen: now - 600000, joinSecs: o.secs ?? 95 } } });
const settle = () => new Promise((r) => setTimeout(r, 80));
const sig = async (u) => (await call(`/api/admin/people/${u}/signals`, { tok: "tok-boss" })).j;
try {
  for (let i = 0; i < 100; i++) { try { if ((await fetch(B + "/api/health")).ok) break; } catch {} await new Promise((r) => setTimeout(r, 100)); }
  await seedEvent();

  console.log("\nJOINING");
  const k1 = await join_("kat", { ip: "86.19.105.225", country: "GB", ua: IPHONE_IG, city: "Leeds", region: "England", tz: "Europe/London" });
  const k2 = await join_("tracy", { ip: "86.19.105.225", country: "GB", ua: ANDROID });
  const k3 = await join_("zed", { ip: "203.0.113.9", country: "DE", ua: HEADLESS, secs: 6, domain: "protonmail.com", city: "Frankfurt am Main", region: "Hesse", tz: "America/New_York" });
  await settle();
  t("three people join (the routes behave as before)", k1.s === 200 && k2.s === 200 && k3.s === 200);
  let s = await sig("kat");
  t("their record says when, which country, which phone, and how", s.joined && s.joined.country === "GB" && s.joined.device === "iPhone · Instagram app" && s.joined.via === "email");
  t("the first link is kept without its one-use codes (the entry it named stays)", s.joined.landing === "/?e=art&v=" + entA && !/SECRET|signup|b=/.test(JSON.stringify(s)));
  t("where they came from: the site and path, not its query", s.joined.referrer === "l.instagram.com/");
  t("and how long Join took", s.joined.joinSecs === 95 && s.joined.firstSeen === now - 600000);
  t("the address itself is never shown — a network label instead", /^Network [0-9a-f]{4}$/.test(s.joined.network) && !JSON.stringify(s).includes("86.19.105.225"));
  t("someone on the same network is listed, and it's a reason to look", s.sharing.length === 1 && s.sharing[0].username === "tracy" && s.flags.some((f) => /Shares a network with 1 other account/.test(f)));
  // 2026-10-27: a throwaway inbox can't join any more (server-01-honest); one from before the rule is still flagged
  t("a throwaway inbox is refused at Join", (await join_("zed2", { ip: "203.0.113.10", domain: "mailinator.com" })).s === 400);
  { const { DatabaseSync } = await import("node:sqlite"); const w2 = new DatabaseSync(join(DATA, "tnl.db")); w2.prepare(`UPDATE users SET email = 'zed@mailinator.com' WHERE username = 'zed'`).run(); w2.close(); }
  const z = await sig("zed");
  t("a bot-shaped join is called out: seconds on Join, a throwaway inbox, an automated browser", z.flags.some((f) => /Joined in 6 seconds/.test(f)) && z.flags.some((f) => /throwaway/.test(f)) && z.flags.some((f) => /automated/.test(f)) && z.joined.device === "Linux · Chrome · automated");
  { const { DatabaseSync } = await import("node:sqlite"); const w2 = new DatabaseSync(join(DATA, "tnl.db")); w2.prepare(`UPDATE users SET email = 'zed@protonmail.com' WHERE username = 'zed'`).run(); w2.prepare(`UPDATE users SET created_at = created_at - 600000 WHERE username IN ('kat','tracy','zed')`).run(); w2.close(); }   // …and ten minutes on: new accounts wait 5 to vote (2026-10-27)   // back to a real one: a throwaway can't vote (server-01-honest)
  t("someone different stands alone", z.sharing.length === 0);
  t("location: the city and region Cloudflare names, and the phone's own time zone", s.joined.place === "Leeds, England" && s.joined.tz === "Europe/London" && z.joined.place === "Frankfurt am Main, Hesse");
  t("a phone clock on another continent from its network is called out (VPN or proxy)", z.flags.some((f) => /America\/New_York.*network is in DE/.test(f)) && !s.flags.some((f) => /clock/.test(f)));
  const odd = await join_("odd", { ip: "198.51.100.7", country: "FR", tz: "not a zone<script>", city: "<b>Paris</b>" }); await settle();
  const o = await sig("odd");
  t("a made-up time zone or odd city text isn't stored as given", odd.s === 200 && o.joined.tz === "" && o.joined.place === "bParisb");
  const raw = (await import("node:sqlite")).DatabaseSync; let d = new raw(join(DATA, "tnl.db"));
  t("the database holds a hash, not the address", !JSON.stringify(d.prepare(`SELECT * FROM join_signals`).all()).includes("86.19.105.225") && d.prepare(`SELECT COUNT(DISTINCT net) n FROM join_signals`).get().n === 3);
  t("a refused join (bad email) records nothing", (await call("/api/auth/register", { body: { username: "nope", displayName: "n", email: "x", password: "p" } })).s === 400 && !d.prepare(`SELECT 1 FROM join_signals js JOIN users u ON u.id = js.user_id WHERE u.username = 'nope'`).get());
  d.close();

  console.log("\nSIGNING IN");
  const L = await call("/api/auth/login", { body: { identifier: "ana", password: "violet-kiln-27" }, ip: "86.19.105.225", country: "GB", ua: ANDROID });
  await settle();
  t("a sign-in is noted with its network and device", L.s === 200 && (await sig("ana")).seen.some((x) => x.kind === "login" && x.country === "GB" && x.device === "Android · Samsung Internet"));
  t("…and a long-time member on that network now shows up beside the new ones", (await sig("kat")).sharing.some((x) => x.username === "ana"));
  await call("/api/auth/login", { body: { identifier: "ana", password: "violet-kiln-27" }, ip: "86.19.105.225", country: "GB" }); await settle();
  t("signing in again on the same network soon after adds no second line", (await sig("ana")).seen.filter((x) => x.kind === "login").length === 1);
  await call("/api/auth/login", { body: { identifier: "ana", password: "wrong" }, ip: "9.9.9.9" }); await settle();
  t("a failed sign-in records nothing", !(await sig("ana")).seen.some((x) => x.network && x.kind === "login" && x.country === "US"));

  console.log("\nVOTING");
  d = new raw(join(DATA, "tnl.db")); d.prepare(`UPDATE users SET email_verified = 1`).run(); d.close();   // they confirmed their emails
  const v1 = await call("/api/events/art/vote", { body: { entryId: entA }, tok: k1.j.token, ip: "86.19.105.225", country: "GB", ua: IPHONE_IG, city: "Leeds", region: "England", tz: "Europe/London" });
  const v2 = await call("/api/events/art/vote", { body: { entryId: entA }, tok: k2.j.token, ip: "86.19.105.225", country: "GB" });
  const v3 = await call("/api/events/art/vote", { body: { entryId: entB }, tok: "tok-boss", ip: "5.5.5.5", country: "US" });
  const v4 = await call("/api/events/art/vote", { body: { entryId: entB }, tok: k3.j.token, ip: "203.0.113.9", country: "DE", tz: "America/New_York" });
  await settle();
  t("votes go through as before", [v1, v2, v3, v4].every((v) => v.s === 200));
  const again = await call("/api/events/art/vote", { body: { entryId: entB }, tok: k1.j.token, ip: "86.19.105.225", country: "GB" }); await settle();
  t("a vote the rules refuse (second today) records nothing", again.s === 400);
  const c = (await call(`/api/admin/events/${evId}/vote-check`, { tok: "tok-boss" })).j;
  const ea = c.entries.find((e) => e.entryId === entA), eb = c.entries.find((e) => e.entryId === entB);
  t("each piece: its votes, voters, new accounts and countries", ea.votes === 2 && ea.voters === 2 && ea.fresh === 2 && ea.countries.GB === 2 && ea.author === "ana" && eb.votes === 2 && eb.fresh === 1);
  t("two voters for one piece from one network are counted", ea.shared === 2 && eb.shared === 0);
  t("…the towns its votes came from, and a VPN-looking vote", ea.places["Leeds, England"] === 1 && eb.offClock === 1 && ea.offClock === 0);
  t("the network is listed with who, where and what for", c.clusters.length === 1 && c.clusters[0].voters.sort().join() === "kat,tracy" && c.clusters[0].entries[0].author === "ana" && c.clusters[0].countries[0] === "GB" && c.clusters[0].places[0] === "Leeds, England");
  t("a voter's record shows the vote and that they voted within a week of joining", (await sig("kat")).seen.some((x) => x.kind === "vote" && x.event === "Art") && (await sig("kat")).flags.some((f) => /Voted within a week/.test(f)));
  await call("/api/events/art/vote", { body: { entryId: entA, on: false }, tok: k1.j.token, ip: "86.19.105.225" }); await settle();
  t("taking a vote back isn't noted as a vote", (await call(`/api/admin/events/${evId}/vote-check`, { tok: "tok-boss" })).j.total === 4);

  console.log("\nADMINS ONLY");
  t("a member can't read anyone's record", (await call("/api/admin/people/kat/signals", { tok: "tok-ana" })).s === 403 && (await call(`/api/admin/events/${evId}/vote-check`, { tok: "tok-ana" })).s === 403);
  t("nor can someone signed out", (await call("/api/admin/people/kat/signals")).s === 401);
  t("an unknown member or event is a 404", (await call("/api/admin/people/nobody/signals", { tok: "tok-boss" })).s === 404 && (await call("/api/admin/events/999/vote-check", { tok: "tok-boss" })).s === 404);
  const pub = JSON.stringify((await call("/api/users/kat", { tok: "tok-ana" })).j) + JSON.stringify((await call("/api/events/art", { tok: "tok-ana" })).j);
  t("nothing of it in what members can see", !/Network [0-9a-f]{4}|join_secs|joinSecs|Instagram app/.test(pub));
} finally { srv.kill(); }

console.log("\nTHE APP AND THE PAGES");
const read = (f) => readFileSync(join(ROOT, f), "utf8");
t("every request from the app carries the phone's time zone", /h\["X-TZ"\]=Intl\.DateTimeFormat\(\)\.resolvedOptions\(\)\.timeZone/.test(read("src/app-07-theme-labs-api.js")));
t("the app keeps the first link once and sends it with Join", /localStorage\.getItem\("tnl-landed"\)/.test(read("src/app-08-landed.js")) && /src:landedSrc\(G\)/.test(read("src/app-11-gate-logic.js")) && /t0:Date\.now\(\)/.test(read("src/app-11-gate-screens.js")));
t("the privacy policy says so", /Keeping accounts real/.test(read("src/server-12-policies.js")));
t("admin loads the record card and the vote check", /3-person-signals\.js\?v=/.test(read("public/admin.html")) && /sigCard\(\)/.test(read("public/admin-app/3-person.js")) && /evCheckHTML\(\)/.test(read("public/admin-app/8-events.js")));
console.log(`\n  ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
