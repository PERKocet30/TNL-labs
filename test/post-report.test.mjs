// REPORT v1.1 (2026-11-04): "Post should have options to be able to report an issue like Instagram"
// → "make sure this feature is throughout the app anywhere problems might occur." One report sheet
// for a post, a person (profile or chat — never the messages), a comment, a listing, a song, and
// "Report a problem" for the app itself. The server keeps one open report per person per thing.
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
const a = dash.indexOf("for (const c of [\"kind TEXT"), z = dash.indexOf("\n});", dash.indexOf('app.post("/api/report"')) + 4;
const routes = {};
new Function("db", "app", "auth", "rateLimit", "q", dash.slice(a, z))(db, { post: (p, ...h) => routes[p] = h.at(-1) }, null, () => null, { userByName: db.prepare(`SELECT * FROM users WHERE username = ?`) });
const now = Date.now();
const u = {};
for (const n of ["ana", "ben"]) u[n] = Number(db.prepare(`INSERT INTO users (username, display_name, email, password_hash, created_at) VALUES (?,?,?,?,?)`).run(n, n, n + "@x.test", "x", now).lastInsertRowid);
const post = Number(db.prepare(`INSERT INTO posts (author_id, channel, body, created_at) VALUES (?, 'showroom', 'hi', ?)`).run(u.ben, now).lastInsertRowid);
const cmt = Number(db.prepare(`INSERT INTO comments (post_id, author_id, body, created_at) VALUES (?,?,?,?)`).run(post, u.ben, "rude words", now).lastInsertRowid);
const lst = Number(db.prepare(`INSERT INTO listings (seller_id, title, price_cents, status, kind, images, created_at, updated_at) VALUES (?,?,?,'active','item','[]',?,?)`).run(u.ben, "Fake tee", 1000, now, now).lastInsertRowid);
const trk = Number(db.prepare(`INSERT INTO tracks (user_id, title, url, created_at) VALUES (?,?,?,?)`).run(u.ben, "Not mine", "/uploads/x.mp3", now).lastInsertRowid);
const send = (who, body) => { let out; routes["/api/report"]({ user: { id: u[who] }, body }, { status: (c) => ({ json: (j) => out = { c, j } }), json: (j) => out = { c: 200, j } }); return out; };
const rows = () => db.prepare(`SELECT reason, handled_at FROM reports WHERE post_id = ? AND kind IN ('post', '') ORDER BY id`).all(post);
const last = () => db.prepare(`SELECT * FROM reports ORDER BY id DESC LIMIT 1`).get();

console.log("\nTHE SERVER — A POST");
t("a report on a post is kept with its reason, about its author", send("ana", { postId: post, reason: "Spam" }).c === 200 && rows().length === 1 && rows()[0].reason === "Spam" && last().user_id === u.ben && last().kind === "post");
t("reporting the same post again changes the reason — never a second row", send("ana", { postId: post, reason: "Stolen work: @realartist" }).c === 200 && rows().length === 1 && rows()[0].reason === "Stolen work: @realartist");
t("you can't report your own post", send("ben", { postId: post, reason: "Spam" }).c === 400);
db.prepare(`UPDATE reports SET handled_at = ? WHERE post_id = ?`).run(now, post);
t("once the admin has handled it, a new report is a new row", send("ana", { postId: post, reason: "Spam" }).c === 200 && rows().length === 2);
t("a post that doesn't exist is turned away", send("ana", { postId: 999999, reason: "Spam" }).c === 404);
t("nothing to report is turned away", send("ana", { reason: "Spam" }).c === 400);
t("the reason is cut to 300 characters", (send("ana", { postId: post, reason: "x".repeat(900) }), db.prepare(`SELECT MAX(LENGTH(reason)) n FROM reports`).get().n === 300));

console.log("\nTHE SERVER — EVERYTHING ELSE");
t("a person (from their profile or a chat): about them, never a message", send("ana", { kind: "user", username: "ben", reason: "Spam" }).c === 200 && last().kind === "user" && last().user_id === u.ben && last().post_id === null);
t("…the old way (just a username) still works and lands on the same report", send("ana", { username: "ben", reason: "Scam or fraud" }).c === 200 && db.prepare(`SELECT COUNT(*) n FROM reports WHERE kind = 'user'`).get().n === 1 && last().reason === "Scam or fraud");
t("a comment: about its author, with its post", send("ana", { kind: "comment", id: cmt, reason: "Hate or harassment" }).c === 200 && last().kind === "comment" && last().target_id === cmt && last().user_id === u.ben && last().post_id === post);
t("a listing: about its seller", send("ana", { kind: "listing", id: lst, reason: "Counterfeit" }).c === 200 && last().kind === "listing" && last().user_id === u.ben);
t("a song: about whoever uploaded it", send("ana", { kind: "track", id: trk, reason: "Stolen work" }).c === 200 && last().kind === "track" && last().user_id === u.ben);
t("the same comment again is the same report", send("ana", { kind: "comment", id: cmt, reason: "Spam" }).c === 200 && db.prepare(`SELECT COUNT(*) n FROM reports WHERE kind = 'comment'`).get().n === 1);
t("something that's gone is turned away; so is your own", send("ana", { kind: "listing", id: 99999, reason: "x" }).c === 404 && send("ben", { kind: "track", id: trk, reason: "x" }).c === 400);
t("'Report a problem' (the app): needs words, keeps the screen name, never stacks into one", send("ana", { kind: "app", reason: "" }).c === 400 && send("ana", { kind: "app", reason: "Broken: the cart is empty", detail: "market:bag" }).c === 200 && last().kind === "app" && last().detail === "market:bag" && last().user_id === null
  && send("ana", { kind: "app", reason: "Broken: again", detail: "market" }).c === 200 && db.prepare(`SELECT COUNT(*) n FROM reports WHERE kind = 'app'`).get().n === 2);
t("the screen name is a plain name — nothing else gets through", (send("ana", { kind: "app", reason: "Broken", detail: "<img src=x onerror=alert(1)> and more" }), !/[<>()=]/.test(last().detail)));
t("the admin list says what each report is about", dash.includes("WHEN 'comment' THEN (SELECT body FROM comments WHERE id = r.target_id)") && readFileSync(join(ROOT, "public/admin-app/4-content.js"), "utf8").includes('const REPORT_KIND = { post: "Post", user: "Person", comment: "Comment", listing: "Listing", track: "Song", app: "Problem" }'));

console.log("\nTHE APP");
const page = readFileSync(join(ROOT, "public/index.html"), "utf8");
const fn = (name) => { const a = page.indexOf("function " + name + "("); return a < 0 ? "" : page.slice(a, page.indexOf("\nfunction ", a + 1)); };
const rep = readFileSync(join(ROOT, "src/app/posts/report.js"), "utf8");
t("every post menu that isn't yours has Report: the ··· on a post and on a lab message", fn("postMenu").includes('if(!mine)acts.push({icon:DI.flag,label:"Report",danger:true,run:()=>reportPost(p)})') && fn("labMenu").includes('label:"Report"'));
t("every Showroom card has a ··· (signed in)", fn("srCardHTML").includes('data-pmore="${p.id}"') && fn("srCardHTML").includes("${ME?"));
t("the flag on an opened post opens the same report", page.includes('b.onclick=()=>reportPost(findAnyPost(b.dataset.report))'));
t("Instagram's kind of reasons, plus 'something's broken', and reasons that fit each thing", ["Spam", "Scam or fraud", "Stolen work", "Nudity or sexual content", "Hate or harassment", "Violence or threats", "Not allowed for sale", "False information", "Broken", "Something else", "Counterfeit", "Misleading", "Pretending to be someone"].every((r) => rep.includes(`["${r}",`)) && ["post:", "comment:", "user:", "listing:", "track:"].every((k) => rep.includes(k + "[[")));
t("everywhere: a comment's flag, a profile's Report, a chat's Report @name, a listing's Report listing, a song's Report", page.includes('data-crep="${c.id}"') && page.includes('reportThing({kind:"user",username:u.username})') && page.includes('id="csreport"') && page.includes('on("csreport"') && page.includes('data-mrep="${l.id}"') && page.includes('reportThing({kind:"track",id:t.id'));
t("'Report a problem' in your settings and on a post that didn't send, with the screen it happened on", page.includes('label:"Report a problem",run:()=>reportProblem()') && page.includes('data-repfail=') && rep.includes("screen=uiScreen()") && rep.includes('kind:"app"'));
t("a chat is reported as the person — no message goes with it", !/(message|text|body)/.test(page.slice(page.indexOf('on("csreport"'), page.indexOf("\n", page.indexOf('on("csreport"'))).split("//")[0]));
t("stolen work, broken, misleading, impersonation and something else ask for a few words (optional; Cancel sends nothing)", rep.includes('const REPORT_MORE=["Stolen work","Broken","Something else","Misleading","Pretending to be someone"]') && rep.includes("if(more===null)return;"));
t("after a report, a thank-you that offers to block (but a bug just says thanks)", rep.includes('"Thanks for letting us know"') && rep.includes("api.block(username)") && rep.includes('if(it.reason==="Broken"){toast("Thanks — we\'ll fix it");return}'));
t("you can't report your own thing", rep.includes(`return toast("That's yours")`));

console.log(`\n  ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
