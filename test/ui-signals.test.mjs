// UI SIGNALS v1.0 (2026-11-04): how people move through the app, as counts Echo and the
// connector read — never a word anyone typed. Runs the real server part (lifted from
// src/server/ui-signals/signals.js) against a throwaway database, then checks the wiring:
// the app's part, the tools, the paths the connector may open.
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { mkdirSync, rmSync, readFileSync } from "node:fs";
const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const DATA = join(ROOT, "test/.tmp/ui-signals");
rmSync(DATA, { recursive: true, force: true }); mkdirSync(DATA, { recursive: true });
process.env.TNL_DATA = DATA; process.env.TNL_NO_WATCH = "1";
let pass = 0, fail = 0;
const t = (n, ok) => { ok ? pass++ : fail++; console.log("  " + (ok ? "✓" : "✗") + "  " + n); };

const { db } = await import("../src/db.js");
db.exec(`CREATE TABLE IF NOT EXISTS glitch_events (id INTEGER PRIMARY KEY AUTOINCREMENT, kind TEXT NOT NULL, place TEXT NOT NULL DEFAULT '', detail TEXT NOT NULL DEFAULT '', device TEXT NOT NULL DEFAULT '', username TEXT NOT NULL DEFAULT '', created_at INTEGER NOT NULL)`);
const src = readFileSync(join(ROOT, "src/server/ui-signals/signals.js"), "utf8");
const routes = {};
const deviceOf = (req) => String(req.get?.("x-device") || "");
const S = new Function("db", "app", "auth", "admin", "maybeAuth", "rateLimit", "deviceOf", "process", src + "\nreturn { uiLog, uiPrune, uiScreens, uiPaths, uiTaps, uiFlows, uiEmpties, uiSpeed, uiDevices, uiFeatures, UI_KINDS };")(
  db, { post: (p, ...h) => routes[p] = h.at(-1), get: (p, ...h) => routes[p] = h.at(-1) }, null, null, null, () => null, deviceOf, { env: { TNL_NO_WATCH: "1" } });
const now = Date.now(), D = 86400000, H = 3600000;
const u = {};
for (const [n, age] of [["ana", 2], ["ben", 40], ["cam", 40]]) u[n] = Number(db.prepare(`INSERT INTO users (username, display_name, email, password_hash, created_at) VALUES (?,?,?,?,?)`).run(n, n, n + "@x.test", "x", now - age * D).lastInsertRowid);
const V = (n) => "u:" + u[n];
const log = (who, kind, screen, prev = "", ms = 0, at = now) => S.uiLog(who, { kind, screen, prev, ms }, at);
const post = (body, user, device) => { let out; routes["/api/ui"]({ body, user, get: (h) => (h === "x-device" ? device || "" : "") }, { status: (c) => ({ json: (j) => out = { c, j } }), json: (j) => out = { c: 200, j } }); return out; };

console.log("\nWHAT'S KEPT, AND WHAT NEVER IS");
t("a screen view is a row: the screen, the one before, the time on it", log(V("ana"), "view", "post", "showroom", 4200) && db.prepare(`SELECT screen, prev, ms FROM ui_events`).get().prev === "showroom");
t("a kind that isn't on the list is dropped", !log(V("ana"), "typed", "post", "hello there") && !log(V("ana"), "", "post"));
t("a search that found nothing keeps three counted words, never the sentence", (log(V("ana"), "search_miss", "search", "Where can I buy a VINTAGE denim jacket in Brooklyn?!"), db.prepare(`SELECT prev FROM ui_events WHERE kind = 'search_miss'`).get().prev === "where can buy"));
t("a tap's role is one of four words; anything else is blank", (log(V("ana"), "tap", "profile", "img"), log(V("ana"), "tap", "profile", "<script>"), db.prepare(`SELECT GROUP_CONCAT(prev, '|') p FROM ui_events WHERE kind = 'tap' ORDER BY id`).get().p === "img|"));
t("screen names are short plain names — no quotes, no titles, 40 characters at most", (log(V("ana"), "view", "Lab: Music / \"My Song Title\" with 'quotes' and a very long name that goes on", "post"), db.prepare(`SELECT screen FROM ui_events ORDER BY id DESC LIMIT 1`).get().screen === "lab: music / my song title with quotes a"));
t("time is capped at a minute, and never negative", (log(V("ana"), "back", "post", "", 999999), log(V("ana"), "back", "post", "", -5), ((r) => r.mx === 60000 && r.mn === 0)(db.prepare(`SELECT MAX(ms) mx, MIN(ms) mn FROM ui_events WHERE kind = 'back'`).get())));
t("the load time isn't kept any more: it read 0ms everywhere (2026-11-09)", !log(V("ana"), "load", "post", "", 400) && !S.UI_KINDS.includes("load"));
t("a feature's first use is one row a day, however often it's sent", log(V("ana"), "feature", "studio") && !log(V("ana"), "feature", "studio") && log(V("ana"), "feature", "studio", "", 0, now + D));
t("the table holds the viewer key, the kind, two names, a number and the time — nothing else", db.prepare(`PRAGMA table_info(ui_events)`).all().map((c) => c.name).join() === "id,viewer,kind,screen,prev,ms,day,created_at");
t("no viewer, no row: a guest without a device mark is ignored", post({ events: [{ kind: "view", screen: "showroom" }] }, null, "").j.n === 0);
t("a guest's device mark is a viewer; a batch is 60 at most", post({ events: Array.from({ length: 80 }, (_, i) => ({ kind: "view", screen: "s" + i })) }, null, "abcdef1234567890").j.n === 60);
t("the route drops the bad and keeps the good in one batch", post({ events: [{ kind: "view", screen: "labs" }, { kind: "nope" }, { kind: "exit", screen: "labs" }] }, { id: u.ben }).j.n === 2);

console.log("\nWHAT THE ADMIN AND ECHO LEARN — counts only");
db.exec(`DELETE FROM ui_events`);
/* ana (new this week): showroom → post → profile → exit. ben: showroom → labs → lab → back → labs, then a dead tap and an empty screen he left.
   cam: showroom → market → sell (started, abandoned) → market → detail → buy → confirmed. A slow lab screen, a broken picture, a failed upload. */
const walk = (who, screens, start) => { let prev = "", at = start; for (const [s, ms] of screens) { log(who, "view", s, prev, ms, at); prev = s; at += Math.max(500, ms); } return at; };
let at = walk(V("ana"), [["showroom", 0], ["post", 8000], ["profile", 3000]], now - 2 * H); log(V("ana"), "exit", "profile", "", 5000, at);
at = walk(V("ben"), [["showroom", 0], ["labs", 2000], ["lab:music/work", 1500], ["labs", 900]], now - H); log(V("ben"), "back", "lab:music/work", "", 900, at); log(V("ben"), "tap", "labs", "img", 0, at); log(V("ben"), "empty", "labs", "left", 0, at); log(V("ben"), "tab", "labs", "", 0, at); log(V("ben"), "exit", "labs", "", 2000, at);
at = walk(V("cam"), [["showroom", 0], ["market", 1000], ["market:sell", 2000], ["market", 20000], ["market:detail", 1200], ["market:confirmed", 3000]], now - 3 * H);
log(V("cam"), "flow", "sell", "start"); log(V("cam"), "flow", "sell", "abandon"); log(V("cam"), "flow", "checkout", "start"); log(V("cam"), "flow", "checkout", "done");
log(V("cam"), "media_fail", "showroom", "img"); log(V("cam"), "upload_fail", "compose", "big"); log(V("cam"), "double", "compose");
log(V("cam"), "search_miss", "search", "neon sign"); log(V("ben"), "search_miss", "search", "Neon SIGN!"); log(V("cam"), "feature", "sell"); log(V("ben"), "feature", "dm");
log(V("ana"), "profile", "360-400", "dark rm"); log(V("ben"), "profile", ">430", "light"); log(V("cam"), "profile", "wide", "dark lt");
for (let i = 0; i < 25; i++) { log("d:dev" + i, "view", "tag", "labs", 100, now - H); if (i < 12) log("d:dev" + i, "exit", "tag", "", 100, now - H); }
db.prepare(`INSERT INTO glitch_events (kind, place, detail, username, created_at) VALUES ('rage_tap', 'labs', 'button Work', 'ben', ?), ('slow_screen', 'lab music', 'GET /api/place', 'cam', ?)`).run(now - H, now - H);

const scr = S.uiScreens(7, now), S1 = (k) => scr.screens.find((s) => s.screen === k);
t("screens: views, people, newcomers (joined this week) per screen", S1("showroom").views === 3 && S1("showroom").people === 3 && S1("showroom").newcomers === 1 && S1("profile").newcomers === 1 && S1("labs").newcomers === 0);
t("…time on a screen comes from the view after it", S1("post").medianSeconds === 3 && S1("market:sell").medianSeconds === 20);
t("…exits, back-outs and dead taps sit beside the views", S1("profile").exits === 1 && S1("profile").exitRate === 100 && S1("lab:music/work").backOuts === 1 && S1("labs").deadTaps === 1);
const pth = S.uiPaths(7, now);
t("paths: the common next screen, and a three-step route in one sitting", pth.next.find((p) => p.from === "showroom" && p.to === "market").n === 1 && pth.next[0].n === 25 && pth.routes.some((r) => r.route === "showroom → market → market:sell"));
t("…dead ends need 20 views and 40% exits: the tag screen is one, the profile (1 view) isn't", pth.deadEnds.length === 1 && pth.deadEnds[0].screen === "tag" && pth.deadEnds[0].exitRate === 48);
t("…tabs tapped", pth.tabs[0].tab === "labs" && pth.tabs[0].taps === 1);
const tp = S.uiTaps(7, now);
t("taps: rage taps from the glitch watcher, dead taps by what was tapped, double sends", tp.rageTaps[0].screen === "labs" && tp.deadTaps[0].role === "img" && tp.doubleSends[0].screen === "compose");
const fl = S.uiFlows(7, now), F = (k) => fl.flows.find((f) => f.flow === k);
t("flows: started, done, abandoned, finish rate", F("sell").started === 1 && F("sell").abandoned === 1 && F("sell").finishRate === 0 && F("checkout").done === 1 && F("checkout").finishRate === 100);
const em = S.uiEmpties(7, now);
t("empties: the screen and what happened next; search misses fold the same words together", em.empties[0].screen === "labs" && em.empties[0].left === 1 && em.searchMisses.total === 2 && em.searchMisses.words[0].words === "neon sign" && em.searchMisses.words[0].n === 2);
const sp = S.uiSpeed(7, now);
t("speed: what didn't load and why, the watcher's slow screens — and no load time", !("loads" in sp) && sp.mediaFails[0].what === "img" && sp.uploadFails[0].why === "big" && sp.slowScreens[0].screen === "lab music");
/* dee hides the page three times on the post creator (the photo picker, twice) and carries on each time; then really goes. */
{ const dee = "d:dee", t0 = now - 5 * H;
  log(dee, "view", "compose", "showroom", 0, t0); log(dee, "exit", "compose", "", 0, t0 + 1000); log(dee, "tap", "compose", "text", 0, t0 + 20000); log(dee, "exit", "compose", "", 0, t0 + 30000);
  log(dee, "view", "showroom", "compose", 0, t0 + 60000); log(dee, "exit", "showroom", "", 0, t0 + 90000);
  const sc = S.uiScreens(7, now).screens, one = (k) => sc.find((x) => x.screen === k);
  t("an exit is a real leave: the page hiding for the photo picker, with more from them inside 30 minutes, isn't one", one("compose").exits === 0 && one("showroom").exits === 1);
  log(dee, "view", "showroom", "", 0, t0 + 90000 + 31 * 60000);
  t("…coming back after more than 30 minutes leaves it a leave", S.uiScreens(7, now).screens.find((x) => x.screen === "showroom").exits === 1);
  db.prepare(`DELETE FROM ui_events WHERE viewer = ?`).run(dee); }
const dv = S.uiDevices(7, now);
t("devices: width buckets and looks as shares of sessions", dv.sessions === 3 && dv.dark.n === 2 && dv.light.pct === 33 && dv.reducedMotion.n === 1 && dv.largerText.n === 1 && dv.widths.some((w) => w.width === "wide"));
const ft = S.uiFeatures(7, now), FT = (k) => ft.features.find((f) => f.feature === k);
t("features: members who used each, who never did, days from joining to first use", ft.members === 3 && FT("sell").members === 1 && FT("sell").never === 2 && FT("sell").pctOfMembers === 33 && FT("dm").medianDaysToFirstUse === 40);
t("counts only: no name, id or viewer key leaves any tool", [scr, pth, tp, fl, em, sp, dv, ft].every((o) => !/ana|ben|cam|"viewer"|user_id|u:\d/.test(JSON.stringify(o))));
t("the window holds", S.uiScreens(1, now + 3 * D).screens.length === 0);
db.prepare(`UPDATE ui_events SET created_at = ? WHERE viewer = ?`).run(now - 100 * D, V("ana"));
db.prepare(`INSERT INTO ui_events (viewer, kind, screen, prev, ms, day, created_at) VALUES ('u:1', 'load', 'showroom', '', 0, 0, ?)`).run(now);
t("rows older than 90 days are pruned — a signal, not an archive — and the old load rows go with them", S.uiPrune(now) >= 5 && !db.prepare(`SELECT 1 FROM ui_events WHERE kind = 'load'`).get() && S.uiScreens(90, now).screens.every((s) => s.screen !== "profile"));

console.log("\nWIRED IN");
{ const a = readFileSync(join(ROOT, "src/app/ui-signals/signals.js"), "utf8");
  t("a post Share sent on its way isn't an abandoned one: it waits, and is done when the post lands", a.includes('if(UI.flow==="post"&&!UI.flowDone&&uiPostQueued())UI.postWait++') && a.includes('else if(UI.postWait>0){UI.postWait--;uiPush("flow","post","done")}') && !/uiLoad|"load"/.test(a)); }
const app = readFileSync(join(ROOT, "src/app/ui-signals/signals.js"), "utf8"), tools = readFileSync(join(ROOT, "src/server/ui-signals/tools.js"), "utf8"), oauth = readFileSync(join(ROOT, "src/server/connector/oauth.js"), "utf8"), conn = readFileSync(join(ROOT, "src/server/connector/tools.js"), "utf8");
t("render() and paintLayer() end with uiTick(); every back tells uiBack()", readFileSync(join(ROOT, "src/app/nav/render-nav.js"), "utf8").includes("  uiTick();") && readFileSync(join(ROOT, "src/app/messages/kit.js"), "utf8").includes("  uiTick();") && (readFileSync(join(ROOT, "src/app/nav/back.js"), "utf8").match(/uiBack\(\);/g) || []).length === 3);
const appCode = app.replace(/\/\*[\s\S]*?\*\//g, "");
t("the app sends only a kind, two short names and a number — never a title, a message or a price", app.includes("UI.q.push({kind,screen:String(screen||\"\").slice(0,40),prev:String(prev||\"\").slice(0,60),ms:Math.round(ms||0)})") && !/\b(title|caption|price|message|body\.text)\b/.test(appCode));
t("…batched every 10s, 40 at a time, and when the page goes away with keepalive — no new screens, no prompts", app.includes("setTimeout(uiFlush,10000)") && app.includes("keepalive:!!now") && app.includes('addEventListener("pagehide",uiExit)') && !/innerHTML|toast\(|render\(\)/.test(appCode));
t("every signal kind the app can send is one the server accepts", [...app.matchAll(/uiPush\("([a-z_]+)"/g)].map((m) => m[1]).every((k) => S.UI_KINDS.includes(k)));
t("Echo and the connector get a tool for each read, and the settings, Echo and spam pages", ["screens", "paths", "taps", "flows", "empties", "speed", "devices", "features_use", "settings", "echo_stats", "event_spam"].every((n) => tools.includes(`["${n}", `)) && tools.includes("MCP_TOOLS.push("));
t("…and the connector may open those paths, and no other new ones", ["ui/screens", "ui/paths", "ui/taps", "ui/flows", "ui/empties", "ui/speed", "ui/devices", "ui/features", "settings", "echo"].every((p) => tools.includes(`"${p}"`)) && oauth.includes("(\\/spam)?$") && !tools.includes("mail-log") && !tools.includes("backups") && !tools.includes("connectors"));
t("Echo's help stats never carry a handoff's conversation", conn.includes('name === "echo_stats"') && conn.includes("({ transcript, ...rest }) => rest"));
t("the parts are in order: signals after views on the server, tools after the connector; the app part after the glitch watcher", (() => { const so = readFileSync(join(ROOT, "src/server/order.mjs"), "utf8"), ao = readFileSync(join(ROOT, "src/app/order.mjs"), "utf8"); return so.indexOf("ui-signals/signals.js") > so.indexOf("posts/views.js") && so.indexOf("ui-signals/tools.js") > so.indexOf("connector/tools.js") && ao.indexOf("ui-signals/signals.js") > ao.indexOf("core/glitch.js"); })());

console.log("\nON THE DASHBOARD (2026-11-09) — what's useful is on the page, what wasn't is gone");
{ const an = readFileSync(join(ROOT, "public/admin-app/9-analytics.js"), "utf8").replace(/\/\*[\s\S]*?\*\//g, ""), st = readFileSync(join(ROOT, "public/admin-app/6-settings.js"), "utf8");
  t("Analytics reads who came back and where new members stop", an.includes('"/api/admin/insights/retention?days="') && an.includes('"/api/admin/insights/conversion?days="') && an.includes("Back after a week") && an.includes("Where new members stop") && an.includes('card("Ways in"'));
  t("…and no longer says sign-ups aren't tracked, counts who's still posting as staying, or makes up \"Posted first work\"", !an.includes("Not tracked yet") && !an.includes("stillPosting") && !an.includes("Math.min(n.signups, n.work)") && !an.includes("R.silent.length"));
  t("Health shows storage against the volume's size; reminders say who came back", st.includes("h.disk.totalBytes") && st.includes("% full") && st.includes("came back after one")); }

console.log(`\n  ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
