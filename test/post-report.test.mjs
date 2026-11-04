// REPORT A POST v1.0 (2026-11-04): "Post should have options to be able to report an issue like
// Instagram." Report sits in every post's ··· menu (Showroom card, opened post, lab message) for
// posts that aren't yours, with Instagram's kind of reasons, a few words for stolen work / broken /
// something else, and an offer to block after. The server keeps one open report per person per post.
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { mkdirSync, rmSync, readFileSync } from "node:fs";
const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const DATA = join(ROOT, "test/.tmp/post-report");
rmSync(DATA, { recursive: true, force: true }); mkdirSync(DATA, { recursive: true });
process.env.TNL_DATA = DATA; process.env.TNL_NO_WATCH = "1";
let pass = 0, fail = 0;
const t = (n, ok) => { ok ? pass++ : fail++; console.log("  " + (ok ? "✓" : "✗") + "  " + n); };

const { db } = await import("../src/db.js");
const dash = readFileSync(join(ROOT, "src/server/admin/dashboard.js"), "utf8");
const i = dash.indexOf('app.post("/api/report"'), j = dash.indexOf("\n});", i) + 4;
const routes = {};
new Function("db", "app", "auth", "rateLimit", "q", dash.slice(i, j))(db, { post: (p, ...h) => routes[p] = h.at(-1) }, null, () => null, { userByName: db.prepare(`SELECT * FROM users WHERE username = ?`) });
const now = Date.now();
const u = {};
for (const n of ["ana", "ben"]) u[n] = Number(db.prepare(`INSERT INTO users (username, display_name, email, password_hash, created_at) VALUES (?,?,?,?,?)`).run(n, n, n + "@x.test", "x", now).lastInsertRowid);
const post = Number(db.prepare(`INSERT INTO posts (author_id, channel, body, created_at) VALUES (?, 'showroom', 'hi', ?)`).run(u.ben, now).lastInsertRowid);
const send = (who, body) => { let out; routes["/api/report"]({ user: { id: u[who] }, body }, { status: (c) => ({ json: (j) => out = { c, j } }), json: (j) => out = { c: 200, j } }); return out; };
const rows = () => db.prepare(`SELECT reason, handled_at FROM reports WHERE post_id = ? ORDER BY id`).all(post);

console.log("\nTHE SERVER");
t("a report on a post is kept with its reason", send("ana", { postId: post, reason: "Spam" }).c === 200 && rows().length === 1 && rows()[0].reason === "Spam");
t("reporting the same post again changes the reason — never a second row", send("ana", { postId: post, reason: "Stolen work: @realartist" }).c === 200 && rows().length === 1 && rows()[0].reason === "Stolen work: @realartist");
t("someone else reporting it is a second report", send("ben", { postId: post, reason: "Broken: won't play" }).c === 200 && rows().length === 2);
db.prepare(`UPDATE reports SET handled_at = ? WHERE post_id = ?`).run(now, post);
t("once the admin has handled it, a new report is a new row", send("ana", { postId: post, reason: "Spam" }).c === 200 && rows().length === 3);
t("a post that doesn't exist is turned away", send("ana", { postId: 999999, reason: "Spam" }).c === 404);
t("nothing to report is turned away", send("ana", { reason: "Spam" }).c === 400);
t("a profile report (by username) still works", send("ana", { username: "ben", reason: "Spam" }).c === 200);
t("the reason is cut to 300 characters", (send("ben", { postId: post, reason: "x".repeat(900) }), db.prepare(`SELECT MAX(LENGTH(reason)) n FROM reports`).get().n === 300));

console.log("\nTHE APP");
const page = readFileSync(join(ROOT, "public/index.html"), "utf8");
const fn = (name) => { const a = page.indexOf("function " + name + "("); return a < 0 ? "" : page.slice(a, page.indexOf("\nfunction ", a + 1)); };
const rep = readFileSync(join(ROOT, "src/app/posts/report.js"), "utf8");
t("every post menu that isn't yours has Report: the ··· on a post and on a lab message", fn("postMenu").includes('if(!mine)acts.push({icon:DI.flag,label:"Report",danger:true,run:()=>reportPost(p)})') && fn("labMenu").includes('label:"Report"'));
t("every Showroom card has a ··· (signed in)", fn("srCardHTML").includes('data-pmore="${p.id}"') && fn("srCardHTML").includes("${ME?"));
t("the flag on an opened post opens the same report", page.includes('b.onclick=()=>reportPost(findAnyPost(b.dataset.report))'));
t("Instagram's kind of reasons, plus 'something's broken'", ["Spam", "Scam or fraud", "Stolen work", "Nudity or sexual content", "Hate or harassment", "Violence or threats", "Not allowed for sale", "False information", "Broken", "Something else"].every((r) => rep.includes(`["${r}",`)));
t("stolen work, broken and something else ask for a few words (optional; Cancel sends nothing)", rep.includes('const REPORT_MORE=["Stolen work","Broken","Something else"]') && rep.includes("if(more===null)return;"));
t("after a report, a thank-you that offers to block (but a bug just says thanks)", rep.includes('"Thanks for letting us know"') && rep.includes("api.block(who)") && rep.includes('if(it.reason==="Broken"){toast("Thanks — we\'ll fix it");return}'));
t("you can't report your own post", rep.includes(`return toast("That's your post")`));

console.log(`\n  ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
