// Watch (2026-09-29): spike emails with a 6-hour quiet period, and one
// morning digest a day. Fake clock, fake mailer, in-memory database.
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { readFileSync } from "node:fs";
import { DatabaseSync } from "node:sqlite";
const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
let pass = 0, fail = 0;
const t = (n, ok) => { ok ? pass++ : fail++; console.log("  " + (ok ? "✓" : "✗") + "  " + n); };
const db = new DatabaseSync(":memory:");
db.exec(`CREATE TABLE error_log (kind TEXT, message TEXT, detail TEXT, path TEXT, username TEXT, created_at INTEGER);
  CREATE TABLE glitch_events (kind TEXT, place TEXT, detail TEXT, device TEXT, username TEXT, created_at INTEGER);
  CREATE TABLE users (created_at INTEGER); CREATE TABLE posts (created_at INTEGER);`);
const src = readFileSync(join(ROOT, "src/server/admin/watch.js"), "utf8");
delete process.env.ADMIN_EMAIL;
const watchTick = new Function("db", "sendAlertEmail", "logError", src + "\nreturn watchTick;")(db, null, () => {});
const sent = [];
const mail = async (subject, heading, lines) => { sent.push({ subject, lines }); };
const at = (iso) => Date.parse(iso);
const glitch = (kind, place, detail, when, n = 1) => { for (let i = 0; i < n; i++) db.prepare("INSERT INTO glitch_events VALUES (?,?,?,?,?,?)").run(kind, place, detail, "phone", "", when); };
const err = (kind, message, when, n = 1) => { for (let i = 0; i < n; i++) db.prepare("INSERT INTO error_log VALUES (?,?,?,?,?,?)").run(kind, message, "", "/api/x", "", when); };

console.log("\nWATCH");
let now = at("2026-09-30T01:00:00Z");   // well before the digest hour
t("quiet day, before 13:00 UTC → nothing", (await watchTick(now, mail)).length === 0 && sent.length === 0);
glitch("action_failed", "showroom", "POST /api/posts/:id/like → 500", now - 60000, 2);
t("2 failed saves is under the line → nothing", (await watchTick(now, mail)).length === 0);
glitch("action_failed", "showroom", "POST /api/posts/:id/like → 500", now - 30000, 1);
let r = await watchTick(now, mail);
t("3 failed saves in an hour → one email", r.join() === "failed_saves" && sent.length === 1);
t("it says how many, what it means, and where", /3 failed saves/.test(sent[0].subject) && sent[0].lines.some((l) => /3× at showroom — POST \/api\/posts\/:id\/like → 500/.test(l)));
glitch("action_failed", "chat", "POST /api/dm/:name → no answer", now, 5);
t("more of the same within 6 hours → no second email", (await watchTick(now + 3600000 / 2, mail)).length === 0 && sent.length === 1);
err("server", "SQLITE_BUSY", now, 3);
r = await watchTick(now + 60000, mail);
t("a different rule still fires (3 server errors)", r.join() === "server_errors" && /SQLITE_BUSY/.test(sent.at(-1).lines.join()));
glitch("action_failed", "chat", "POST /api/dm/:name → no answer", now + 7 * 3600000 - 60000, 3);
t("after 6 hours it can fire again", (await watchTick(now + 7 * 3600000, mail)).includes("failed_saves"));
glitch("rage_tap", "showroom", "[like]", now, 7);
t("7 rage taps is under the line (8)", !(await watchTick(now + 7 * 3600000 + 1000, mail)).includes("rage_taps"));

console.log("\nMORNING DIGEST");
db.prepare("INSERT INTO users VALUES (?)").run(at("2026-09-30T12:00:00Z"));
now = at("2026-09-30T13:05:00Z");
const before = sent.length;
r = await watchTick(now, mail);
t("at 13:00 UTC the digest goes out", r.includes("digest"));
const dg = sent.at(-1);
t("it counts members, errors, glitches and the worst spot", /1 new member ·/.test(dg.lines[0]) && /Errors: 3 server/.test(dg.lines.join("|"))
  && /Glitches: \d+ failed saves/.test(dg.lines.join("|")) && dg.lines.some((l) => /^Worst spot:/.test(l)));
t("only once that day", !(await watchTick(now + 3600000, mail)).includes("digest") && !(await watchTick(at("2026-09-30T23:59:00Z"), mail)).includes("digest"));
t("and again the next day", (await watchTick(at("2026-10-01T13:01:00Z"), mail)).includes("digest"));
t("a calm day says so", sent.at(-1).subject.endsWith("all smooth") || /errors, \d+ glitches/.test(sent.at(-1).subject));

console.log("\nONE PROBLEM, ONE LINE (2026-10-19)");
// The 19 Oct digest spent all three "worst spot" lines on one jump, split by how far it moved.
const d3 = at("2026-10-03T08:00:00Z");
glitch("layout_jump", "showroom", "#sr-grid moved 0.17", d3, 3);
glitch("layout_jump", "showroom", "#sr-grid moved 0.23", d3, 2);
glitch("layout_jump", "showroom", "#sr-grid moved 0.12", d3, 1);
glitch("slow_screen", "my profile", "/api/dm 3.9s", d3, 1);
glitch("slow_screen", "my profile", "/api/dm 5.3s", d3, 1);
glitch("action_failed", "chat", "POST /api/dm/:name → 500", d3, 1);
glitch("action_failed", "chat", "POST /api/dm/:name → 502", d3, 1);
err("client", "TypeError: x is undefined", d3, 4);
err("client", "Script error.", d3, 1);
r = await watchTick(at("2026-10-03T13:02:00Z"), mail);
const d3l = sent.at(-1).lines;
const spots = d3l.filter((l) => /^Worst spot:/.test(l));
t("the same jump is one line, with how far it moved as a range", spots[0] === "Worst spot: 6× screen jumps at showroom — #sr-grid moved 0.12–0.23");
t("slow calls to the same place are one line too", spots.includes("Worst spot: 2× slow screens at my profile — /api/dm 3.9–5.3s"));
t("a status code isn't a measurement: → 500 and → 502 stay apart", !spots.some((l) => /→ 50\d–/.test(l)));
t("the digest names the errors, not just the count", d3l.some((l) => l === "Most often: 4× TypeError: x is undefined"));
console.log(`\n  ${pass} passed, ${fail} failed`);
