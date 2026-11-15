// VISITS v1.0 — 2026-11-15: "improve the admin dashboard to meet Google level analytics — from the data collection…"
// One sitting is one visit: how many screens, how long, where it came from (the site, or the tag on the link), new or
// returning, and whether it ended in a Join. GET /api/admin/visits (any dates, filters) and /api/admin/now. Counts only.
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { rmSync, mkdirSync, readFileSync } from "node:fs";
const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const DATA = join(ROOT, "test/.tmp/visits");
rmSync(DATA, { recursive: true, force: true }); mkdirSync(DATA, { recursive: true });
process.env.TNL_DATA = DATA;
const { db } = await import(join(ROOT, "src/db.js"));
let pass = 0, fail = 0;
const t = (n, ok) => { ok ? pass++ : fail++; console.log("  " + (ok ? "✓" : "✗") + "  " + n); };
const now = Date.now(), D = 86400000;
const mk = (u, admin = 0, at = now - 40 * D) => { const id = Number(db.prepare(`INSERT INTO users (username, display_name, email, password_hash, created_at, email_verified, is_admin) VALUES (?,?,?,?,?,1,?)`)
  .run(u, u, u + "@x.test", "x", at, admin).lastInsertRowid); db.prepare(`INSERT INTO sessions (token, user_id, created_at) VALUES (?,?,?)`).run("tok-" + u, id, now); return id; };
mk("boss", 1); mk("ana"); const neo = mk("neo", 0, now - 2000);   // neo joined a moment ago
db.close();

const PORT = 8957, B = `http://localhost:${PORT}`;
const srv = spawn(process.execPath, ["--experimental-sqlite", "--no-warnings", "src/server.runtime.js"], {
  cwd: ROOT, stdio: "ignore", env: { ...process.env, TNL_DATA: DATA, PORT: String(PORT), TNL_NO_VIDEO_FIX: "1", TNL_NO_WATCH: "1", PUBLIC_URL: B, STRIPE_SECRET_KEY: "", RESEND_API_KEY: "" } });
const UA = "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148", IG = UA + " Instagram 300.0", MAC = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36";
const hex = (n) => n.toString(16).padStart(24, "0");
const ui = (visit, screens, { tok, dev, ua = UA, country = "" } = {}) => fetch(B + "/api/ui", { method: "POST",
  headers: { "Content-Type": "application/json", "User-Agent": ua, ...(tok ? { Authorization: "Bearer " + tok } : {}), ...(dev ? { "X-Device": dev } : {}), ...(country ? { "cf-ipcountry": country } : {}) },
  body: JSON.stringify({ events: screens.map((s, i) => ({ kind: "view", screen: s, prev: screens[i - 1] || "", ms: 900 })), visit }) }).then((r) => r.json());
const admin = async (path, tok = "tok-boss") => { const r = await fetch(B + "/api/admin/" + path, { headers: tok ? { Authorization: "Bearer " + tok } : {} }); return { s: r.status, j: await r.json().catch(() => ({})) }; };
try {
  for (let i = 0; i < 100; i++) { try { if ((await fetch(B + "/api/health")).ok) break; } catch {} await new Promise((r) => setTimeout(r, 100)); }
  const d1 = "a".repeat(24), d2 = "b".repeat(24), d3 = "c".repeat(24);
  /* 1 · a guest from Instagram's browser lands on a tournament link, sees three screens */
  await ui({ id: hex(1), ref: "", land: "/?e=art-1&token=SECRET", wide: 0 }, ["sign-up", "event", "showroom"], { dev: d1, ua: IG, country: "AR" });
  /* 2 · a guest from Google sees one screen and goes */
  await ui({ id: hex(2), ref: "https://www.google.com/search?q=private+words", land: "/", wide: 1 }, ["showroom"], { dev: d2, ua: MAC, country: "US" });
  /* 3 · a tagged link from a Story, a guest who then signs in as neo (who just joined) and carries on */
  await ui({ id: hex(3), ref: "", land: "/?utm_source=ig&utm_medium=story&utm_campaign=music-open", wide: 0 }, ["sign-up"], { dev: d3, country: "IN" });
  await ui({ id: hex(3), ref: "", land: "/", wide: 0 }, ["showroom", "event"], { tok: "tok-neo", dev: d3, country: "IN" });
  /* 4 · ana, a member, direct, two batches */
  await ui({ id: hex(4), ref: "https://tnllabs.com/p/9", land: "/?p=9", wide: 0 }, ["post"], { tok: "tok-ana", dev: "d".repeat(24) });
  await ui({ id: hex(4), ref: "", land: "/", wide: 0 }, ["profile", "showroom"], { tok: "tok-ana", dev: "d".repeat(24) });
  /* not visits: a script, a made-up id, someone else's id */
  await ui({ id: hex(5), ref: "", land: "/", wide: 1 }, ["showroom"], { dev: "e".repeat(24), ua: "python-requests/2.31" });
  await ui({ id: "nope", ref: "", land: "/", wide: 1 }, ["showroom"], { dev: "f".repeat(24) });
  await ui({ id: hex(1), ref: "", land: "/", wide: 0 }, ["labs", "labs", "labs"], { dev: "9".repeat(24) });

  console.log("\nWHO MAY SEE IT");
  t("signed out: 401 · a member: 403 — visits and now", (await admin("visits", "")).s === 401 && (await admin("visits", "tok-ana")).s === 403 && (await admin("now", "tok-ana")).s === 403);

  console.log("\nA VISIT");
  const v = (await admin("visits?days=7&tz=0")).j, S = Object.fromEntries(v.bySource.map((s) => [s.name, s]));
  t("four sittings, four visitors — a script, a made-up id and a borrowed id aren't visits", v.now.visits === 4 && v.now.visitors === 4);
  t("screens add up across a sitting's batches: 3 + 1 + 3 + 3", Math.round(v.now.screens * 4) === 10);
  t("one screen and gone is left straight away: 1 of 4", v.now.bounce === 25);
  t("the one before is there to compare, and a day-by-day series", v.before.visits === 0 && v.series.visits.length === 7 && v.series.visits.at(-1) === 4 && v.series.visitors.at(-1) === 4 && v.prev.visits.length === 7);
  t("a visit that ended in a Join is counted — the guest who signed in as the new member", v.now.joined === 1 && S.Instagram.joined === 1);

  console.log("\nWHERE FROM");
  t("Instagram's own browser is Instagram, without a referrer", S.Instagram && S.Instagram.visits === 2);
  t("a tag on the link names the source, the medium and the campaign", v.bySource.find((s) => s.name === "Instagram").medium && v.byCampaign.length === 1 && v.byCampaign[0].name === "music-open" && v.byCampaign[0].visits === 1);
  t("Google is search; our own pages are Direct", S.Google && S.Google.medium === "search" && S.Direct && S.Direct.visits === 1);
  t("the kind of link, never the link", v.byLanding.map((l) => l.name).sort().join("|") === "a post link|a tournament link|the front door");
  t("phone or computer, with the family", v.byDevice.some((d) => d.name === "Phone · iPhone") && v.byDevice.some((d) => d.name === "Computer · Mac"));
  t("by country, when Cloudflare says", v.byCountry.map((c) => c.name).sort().join(",") === "AR,IN,US");

  console.log("\nFILTERS AND DATES");
  t("by source", (await admin("visits?days=7&source=Google")).j.now.visits === 1);
  t("phone or computer", (await admin("visits?days=7&device=computer")).j.now.visits === 1 && (await admin("visits?days=7&device=phone")).j.now.visits === 3);
  t("new or returning: a member seen today for the first time is new; nobody is back yet", (await admin("visits?days=7&who=new")).j.now.visits === 4 && (await admin("visits?days=7&who=back")).j.now.visits === 0);
  const iso = (ms) => new Date(ms).toISOString().slice(0, 10);
  const past = (await admin(`visits?from=${iso(now - 20 * D)}&to=${iso(now - 10 * D)}&tz=0`)).j;
  t("any dates: eleven days last month hold nothing, and say which days", past.days === 11 && past.now.visits === 0 && past.end < now - 9 * D);
  const pulse = (await admin(`pulse?from=${iso(now - 20 * D)}&to=${iso(now - 10 * D)}&tz=0`)).j, today = (await admin(`pulse?from=${iso(now)}&to=${iso(now)}&tz=0`)).j;
  t("the pulse takes the same dates: neo joined today, not last month", pulse.days === 11 && pulse.now.signups === 0 && pulse.series.signups.length === 11 && today.days === 1 && today.now.signups === 1);
  t("a backwards or made-up date falls back to the usual 30 days", (await admin("pulse?from=2026-13-40&to=nope")).j.days === 30 && (await admin(`pulse?from=${iso(now)}&to=${iso(now - 5 * D)}`)).j.days === 30);

  console.log("\nNOW");
  const n = (await admin("now?tz=0")).j;
  t("who's here in the last five minutes, and how many are members", n.here === 4 && n.members === 2);
  t("the half hour by the minute, the screens they're on in plain words, where they came from", n.minutes.length === 30 && n.minutes.at(-1) >= 4 && n.screens[0].name === "The Showroom" && n.sources.some((s) => s.name === "Instagram"));
  t("today so far", n.today.visits === 4 && n.today.joined === 1);

  console.log("\nWHAT IS NOT KEPT");
  const { DatabaseSync } = await import("node:sqlite"); const d = new DatabaseSync(join(DATA, "tnl.db"), { readOnly: true });
  const dump = JSON.stringify(d.prepare(`SELECT * FROM visits`).all()), cols = d.prepare(`PRAGMA table_info(visits)`).all().map((c) => c.name).join(","); d.close();
  t("no search words, no one-use code, no page on the other site, no address", !/private|SECRET|search\?|art-1|\/p\/9/.test(dump) && !/\bip\b|net|ua|referrer/.test(cols));
} finally { srv.kill(); }

console.log("\nWHEN AN ACCOUNT IS DELETED");
t("their visits and screen signals go with them", /DELETE FROM visits WHERE user_id = \? OR viewer = \?/.test(readFileSync(join(ROOT, "src/server/auth/delete-account.js"), "utf8")) && /DELETE FROM ui_events WHERE viewer = \?/.test(readFileSync(join(ROOT, "src/server/auth/delete-account.js"), "utf8")));

console.log("\nONE READING OF A LINK");
const src = (p) => readFileSync(join(ROOT, p), "utf8").replace(/\/\*[\s\S]*?\*\//g, "");
t("Ways in reads a join with the same reading visits use", /srcOf\(\{ referrer: j\.referrer/.test(src("src/server/connector/insights-people.js")) && /landingKind\(/.test(src("src/server/connector/insights-people.js")));
t("the app sends its visit with every batch, and keeps it for the tab only", /visit:uiVisit\(\)/.test(src("src/app/ui-signals/signals.js")) && /sessionStorage\.setItem\("tnl-visit"/.test(src("src/app/ui-signals/signals.js")));
t("the dictionary has the words", ["visits", "visitors", "newVisitors", "bounce", "source"].every((k) => src("src/server/admin/measures.js").includes(`id: "${k}"`)));

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
