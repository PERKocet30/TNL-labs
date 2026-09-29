// Messaging v2.0 (2026-09-29): boots the real server on a throwaway database
// built with the OLD message schema, then drives it over HTTP — migration,
// privacy, requests, groups, edit/unsend, reactions, lab replies and pins,
// the private live stream, link-preview guard, and admin Cleanup.
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { mkdirSync, rmSync, writeFileSync, existsSync, readdirSync } from "node:fs";
import { spawn } from "node:child_process";
const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const DATA = join(ROOT, "test/.tmp/messaging");
rmSync(DATA, { recursive: true, force: true }); mkdirSync(join(DATA, "uploads"), { recursive: true });
process.env.TNL_DATA = DATA;
let pass = 0, fail = 0;
const t = (n, ok) => { ok ? pass++ : fail++; console.log("  " + (ok ? "✓" : "✗") + "  " + n); };

/* ---- a database as it was before v2 ---- */
const { db } = await import("../src/db.js");
const now = Date.now(), H = 3600000;
const mk = (u, admin = 0) => {
  const id = Number(db.prepare(`INSERT INTO users (username, display_name, email, password_hash, created_at) VALUES (?,?,?,?,?)`)
    .run(u, u[0].toUpperCase() + u.slice(1), u + "@x.test", "x", now).lastInsertRowid);
  if (admin) db.prepare(`UPDATE users SET is_admin = 1 WHERE id = ?`).run(id);
  db.prepare(`INSERT INTO sessions (token, user_id, created_at) VALUES (?,?,?)`).run("tok-" + u, id, now);
  return id;
};
const U = { ana: mk("ana", 1), ben: mk("ben"), cam: mk("cam"), dee: mk("dee"), eve: mk("eve") };
const follow = (a, b) => db.prepare(`INSERT INTO follows (follower_id, followee_id, created_at) VALUES (?,?,?)`).run(U[a], U[b], now);
follow("ben", "ana"); follow("ana", "ben"); follow("eve", "ana");
const [lo, hi] = U.ana < U.ben ? [U.ana, U.ben] : [U.ben, U.ana];
const oldThread = Number(db.prepare(`INSERT INTO dm_threads (a_id, b_id, updated_at, created_at) VALUES (?,?,?,?)`).run(lo, hi, now - H, now - 3 * H).lastInsertRowid);
const om = db.prepare(`INSERT INTO dm_messages (thread_id, sender_id, body, image_url, read_at, created_at) VALUES (?,?,?,?,?,?)`);
om.run(oldThread, U.ana, "old hello", null, now - 2 * H, now - 3 * H);
om.run(oldThread, U.ben, "old reply", "/uploads/old-photo.jpg", null, now - 2 * H);   // ana hasn't read this
om.run(oldThread, U.ana, "still there?", null, null, now - H);                       // ben hasn't read this
db.prepare(`INSERT INTO tracks (user_id, title, url, created_at) VALUES (?,?,?,?)`).run(U.cam, "Keys", "/uploads/track-keys.mp3", now);
for (const f of ["old-photo.jpg", "unsent.jpg", "track-keys.mp3", "orphan.bin"]) writeFileSync(join(DATA, "uploads", f), "x");
db.close();

/* ---- boot ---- */
const PORT = 18700 + (process.pid % 200);
const srv = spawn(process.execPath, ["--experimental-sqlite", "src/server.js"], { cwd: ROOT, env: { ...process.env, PORT: String(PORT), TNL_DATA: DATA }, stdio: ["ignore", "pipe", "pipe"] });
let log = ""; srv.stdout.on("data", (d) => log += d); srv.stderr.on("data", (d) => log += d);
const B = `http://127.0.0.1:${PORT}`;
for (let i = 0; i < 100 && !/listening/.test(log); i++) await new Promise((r) => setTimeout(r, 100));
const call = async (who, method, path, body) => {
  const r = await fetch(B + path, { method, headers: { "Content-Type": "application/json", ...(who ? { Authorization: "Bearer tok-" + who } : {}) }, body: body ? JSON.stringify(body) : undefined });
  let j = null; try { j = await r.json(); } catch {}
  return { s: r.status, j: j || {} };
};
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
try {
  const { DatabaseSync } = await import("node:sqlite");
  const peek = new DatabaseSync(join(DATA, "tnl.db"));

  console.log("\nMIGRATION — nobody's old chat is lost");
  t("server booted", /listening/.test(log));
  t("a backup was taken first", existsSync(join(DATA, "backups")) && readdirSync(join(DATA, "backups")).some((f) => f.includes("pre-messaging-v2")));
  const th = peek.prepare(`SELECT * FROM dm_threads WHERE id = ?`).get(oldThread);
  t("the old thread keeps its id and both people", th && th.a_id === lo && th.b_id === hi && th.is_group === 0);
  t("all 3 messages still point at it", peek.prepare(`SELECT COUNT(*) n FROM dm_messages WHERE thread_id = ?`).get(oldThread).n === 3);
  t("foreign keys intact", peek.prepare(`PRAGMA foreign_key_check`).all().length === 0);
  t("both people are members, both accepted", peek.prepare(`SELECT COUNT(*) n FROM dm_members WHERE thread_id = ? AND accepted = 1`).get(oldThread).n === 2);
  let ib = await call("ana", "GET", "/api/chats");
  t("ana's inbox: the chat, 1 unread (ben's reply)", ib.j.threads?.length === 1 && ib.j.threads[0].unread === 1 && ib.j.unreadTotal === 1);
  ib = await call("ben", "GET", "/api/chats");
  t("ben's inbox: 1 unread", ib.j.threads?.[0]?.unread === 1);
  t("old API address still answers", (await call("ben", "GET", "/api/dm")).j.threads?.length === 1);

  console.log("\nPRIVACY — a chat is its members");
  t("a stranger gets 404 for someone else's chat", (await call("cam", "GET", `/api/chats/${oldThread}`)).s === 404);
  t("…and can't post into it", (await call("cam", "POST", `/api/chats/${oldThread}/messages`, { body: "hi" })).s === 404);
  t("stream refuses without a ticket", (await fetch(B + "/api/stream")).status === 401);
  t("ticket needs a session", (await call(null, "POST", "/api/stream/ticket")).s === 401);
  const listen = async (who) => {
    const tk = (await call(who, "POST", "/api/stream/ticket")).j.ticket;
    const ctrl = new AbortController();
    const r = await fetch(B + "/api/stream?ticket=" + tk, { signal: ctrl.signal });
    const got = []; const dec = new TextDecoder();
    (async () => { try { for await (const c of r.body) got.push(dec.decode(c)); } catch {} })();
    return { tk, status: r.status, got, text: () => got.join(""), close: () => ctrl.abort() };
  };
  const sBen = await listen("ben"), sCam = await listen("cam");
  t("a ticket opens the stream", sBen.status === 200);
  t("a ticket works once", (await fetch(B + "/api/stream?ticket=" + sBen.tk)).status === 401);
  const sent = await call("ana", "POST", `/api/chats/${oldThread}/messages`, { body: "secret plans" });
  await wait(300);
  t("ben receives ana's message live", sBen.text().includes("secret plans"));
  t("cam receives nothing of it", !sCam.text().includes("secret plans") && !sCam.text().includes("event: chat"));
  t("media must be uploaded here", (await call("ana", "POST", `/api/chats/${oldThread}/messages`, { imageUrl: "https://evil.test/x.png" })).s === 400
    && (await call("ana", "POST", `/api/chats/${oldThread}/messages`, { audioUrl: "/uploads/../tnl.db" })).s === 400);

  console.log("\nREPLIES, EDIT, UNSEND, REACTIONS");
  const mid = sent.j.message.id;
  const rep = await call("ben", "POST", `/api/chats/${oldThread}/messages`, { body: "count me in", replyTo: mid });
  t("a reply quotes the message", rep.j.message?.replyTo?.id === mid && rep.j.message.replyTo.text === "secret plans");
  const cross = await call("cam", "POST", "/api/chats/with/eve", { body: "yo", replyTo: mid });
  t("can't quote a message from another chat", cross.s === 200 && cross.j.message.replyTo === null);
  t("edit your own", (await call("ana", "PATCH", `/api/chats/m/${mid}`, { body: "secret plans v2" })).j.message?.editedAt > 0);
  t("not someone else's", (await call("ben", "PATCH", `/api/chats/m/${mid}`, { body: "hacked" })).s === 403);
  peek.prepare(`UPDATE dm_messages SET created_at = ? WHERE id = ?`).run(Date.now() - 16 * 60000, mid);
  t("15 minutes to edit", (await call("ana", "PATCH", `/api/chats/m/${mid}`, { body: "late" })).s === 403);
  t("unknown reaction refused", (await call("ben", "POST", `/api/chats/m/${mid}/react`, { emoji: "💩" })).s === 400);
  let rx = await call("ben", "POST", `/api/chats/m/${mid}/react`, { emoji: "🔥" });
  t("react", rx.j.reactions?.length === 1 && rx.j.reactions[0].username === "ben");
  rx = await call("ben", "POST", `/api/chats/m/${mid}/react`, { emoji: "❤️" });
  t("one reaction per person — a new one replaces it", rx.j.reactions.length === 1 && rx.j.reactions[0].emoji === "❤️");
  t("a stranger can't react", (await call("cam", "POST", `/api/chats/m/${mid}/react`, { emoji: "🔥" })).s === 404);
  const ph = await call("ben", "POST", `/api/chats/${oldThread}/messages`, { imageUrl: "/uploads/unsent.jpg" });
  t("unsend someone else's: no", (await call("ana", "DELETE", `/api/chats/m/${ph.j.message.id}`)).s === 403);
  t("unsend your own", (await call("ben", "DELETE", `/api/chats/m/${ph.j.message.id}`)).j.ok === true);
  const gone = peek.prepare(`SELECT * FROM dm_messages WHERE id = ?`).get(ph.j.message.id);
  t("unsent = wiped from the row, not hidden", gone.deleted_at > 0 && !gone.body && !gone.image_url);
  const page = await call("ana", "GET", `/api/chats/${oldThread}`);
  t("and gone from the chat", !page.j.messages.some((m) => m.id === ph.j.message.id));
  t("the reply to an edited message shows the edit", page.j.messages.find((m) => m.id === rep.j.message.id)?.replyTo.text === "secret plans v2");
  t("Seen: ana sees when ben read", page.j.chat.people.find((p) => p.username === "ben").readAt >= rep.j.message.createdAt);
  sBen.close(); sCam.close();

  console.log("\nREQUESTS — people you don't follow knock first");
  const knock = await call("cam", "POST", "/api/chats/with/dee", { body: "hey, love your work" });
  let dee = await call("dee", "GET", "/api/chats");
  t("lands in dee's Requests, not Chats", dee.j.requests?.length === 1 && dee.j.threads.length === 0 && dee.j.requestCount === 1);
  t("no badge, no notification", dee.j.unreadTotal === 0 && peek.prepare(`SELECT COUNT(*) n FROM notifications WHERE user_id = ? AND kind = 'dm'`).get(U.dee).n === 0);
  await call("dee", "GET", `/api/chats/${knock.j.chatId}`);
  const camView = await call("cam", "GET", `/api/chats/${knock.j.chatId}`);
  t("no 'Seen' leaks from a request", camView.j.chat.people.find((p) => p.username === "dee").readAt === null);
  await call("dee", "POST", `/api/chats/${knock.j.chatId}/accept`);
  dee = await call("dee", "GET", "/api/chats");
  t("accept moves it to Chats", dee.j.threads.length === 1 && dee.j.requests.length === 0);
  const e2 = await call("ben", "POST", "/api/chats/with/eve", { body: "hi eve" });
  await call("eve", "POST", `/api/chats/${e2.j.chatId}/clear`);
  t("delete a request: gone for eve", !(await call("eve", "GET", "/api/chats")).j.requests.some((r) => r.id === e2.j.chatId));
  await call("ben", "POST", "/api/chats/with/eve", { body: "sorry, one more" });
  const ev = await call("eve", "GET", `/api/chats/${e2.j.chatId}`);
  t("…a new message knocks again, without the old history", ev.j.messages.length === 1 && ev.j.messages[0].body === "sorry, one more");
  const fromAdmin = await call("ana", "POST", "/api/chats/with/cam", { body: "welcome to TNL" });
  t("the team's messages always arrive", (await call("cam", "GET", "/api/chats")).j.threads.some((c) => c.id === fromAdmin.j.chatId));

  console.log("\nMUTE & BLOCK");
  await call("ben", "POST", "/api/chats/mute", { chat: `dm:${oldThread}`, hours: 8 });
  const nb = peek.prepare(`SELECT COUNT(*) n FROM notifications WHERE user_id = ? AND kind = 'dm'`).get(U.ben).n;
  await call("ana", "POST", `/api/chats/${oldThread}/messages`, { body: "ping" });
  t("muted: no notification", peek.prepare(`SELECT COUNT(*) n FROM notifications WHERE user_id = ? AND kind = 'dm'`).get(U.ben).n === nb);
  ib = await call("ben", "GET", "/api/chats");
  t("muted: marked, and left out of the badge", ib.j.threads.find((c) => c.id === oldThread).muted && ib.j.unreadTotal === 0);
  t("can't mute a chat you're not in", (await call("cam", "POST", "/api/chats/mute", { chat: `dm:${oldThread}`, hours: 1 })).s === 400);
  await call("dee", "POST", "/api/users/cam/block");
  t("blocked: can't message", (await call("cam", "POST", "/api/chats/with/dee", { body: "?" })).s === 403);
  t("blocked: chat disappears from the inbox", !(await call("dee", "GET", "/api/chats")).j.threads.some((c) => c.id === knock.j.chatId));

  console.log("\nGROUPS");
  t("needs two other people", (await call("ana", "POST", "/api/chats", { usernames: ["ben"] })).s === 400);
  const g = await call("ana", "POST", "/api/chats", { usernames: ["ben", "eve"], title: "Poster run" });
  t("made", g.j.chatId > 0);
  let gv = await call("ben", "GET", `/api/chats/${g.j.chatId}`);
  t("title, 3 people, a system line", gv.j.chat.title === "Poster run" && gv.j.chat.people.length === 3 && gv.j.messages[0].kind === "system");
  await call("ben", "POST", `/api/chats/${g.j.chatId}/messages`, { body: "before cam" });
  t("any member can add", (await call("ben", "POST", `/api/chats/${g.j.chatId}/members`, { usernames: ["cam"] })).j.added === 1);
  gv = await call("cam", "GET", `/api/chats/${g.j.chatId}`);
  t("a new member doesn't get the history from before", !gv.j.messages.some((m) => m.body === "before cam") && gv.j.messages.some((m) => m.body.includes("added Cam")));
  t("only the maker removes people", (await call("ben", "DELETE", `/api/chats/${g.j.chatId}/members/eve`)).s === 403);
  t("the maker can", (await call("ana", "DELETE", `/api/chats/${g.j.chatId}/members/eve`)).j.ok);
  t("removed = locked out", (await call("eve", "GET", `/api/chats/${g.j.chatId}`)).s === 404);
  await call("ana", "DELETE", `/api/chats/${g.j.chatId}/members/ana`);
  gv = await call("ben", "GET", `/api/chats/${g.j.chatId}`);
  t("when the maker leaves, someone takes over", gv.j.chat.createdBy === "ben" && gv.j.messages.some((m) => m.body === "Ana left"));
  t("rename, and it says so", (await call("ben", "PATCH", `/api/chats/${g.j.chatId}`, { title: "Poster run II" })).j.ok
    && (await call("ben", "GET", `/api/chats/${g.j.chatId}`)).j.messages.some((m) => m.body.includes("Poster run II")));

  console.log("\nFORWARD");
  const fw = await call("ben", "POST", "/api/chats/forward", { messageId: rep.j.message.id, usernames: ["cam"], chatIds: [g.j.chatId] });
  t("to a person and a group at once", fw.j.sent === 2);
  t("marked as forwarded", (await call("cam", "GET", `/api/chats/${g.j.chatId}`)).j.messages.some((m) => m.forwarded && m.body === "count me in"));
  t("can't forward what you can't see", (await call("eve", "POST", "/api/chats/forward", { messageId: mid, usernames: ["cam"] })).s === 404);

  console.log("\nLABS — replies, reactions, pins");
  const p1 = await call("ben", "POST", "/api/posts", { channel: "music", body: "who's got drums?" });
  const p2 = await call("cam", "POST", "/api/posts", { channel: "music", body: "me", replyTo: p1.j.post.id });
  t("a lab reply quotes the message", p2.j.post.replyTo?.id === p1.j.post.id && p2.j.post.replyTo.text === "who's got drums?");
  t("…and notifies them", peek.prepare(`SELECT COUNT(*) n FROM notifications WHERE user_id = ? AND kind = 'reply'`).get(U.ben).n === 1);
  const p3 = await call("cam", "POST", "/api/posts", { channel: "photography", body: "x", replyTo: p1.j.post.id });
  t("no quoting across labs", p3.j.post.replyTo === null);
  const p4 = await call("cam", "POST", "/api/posts", { channel: "music", body: "", imageUrl: "https://evil.test/track.png" });
  t("a post's media must be uploaded here", p4.s === 400);
  await call("eve", "POST", `/api/posts/${p1.j.post.id}/react`, { emoji: "🔥" });
  let feed = await call("ana", "GET", "/api/feed?channel=music");
  t("reactions ride on the feed", feed.j.posts.find((p) => p.id === p1.j.post.id)?.reactions[0]?.emoji === "🔥");
  t("pins: admins only", (await call("ben", "POST", `/api/posts/${p1.j.post.id}/pin`, {})).s === 403);
  await call("ana", "POST", `/api/posts/${p1.j.post.id}/pin`, {});
  feed = await call("ben", "GET", "/api/feed?channel=music");
  t("pinned post comes with the lab", feed.j.pins?.[0]?.id === p1.j.post.id);
  await call("ana", "POST", `/api/posts/${p1.j.post.id}/pin`, { pinned: false });
  t("unpin", (await call("ben", "GET", "/api/feed?channel=music")).j.pins.length === 0);
  const gal = await call("ben", "POST", "/api/posts", { channel: "profile", body: "",
    images: [{ url: "/uploads/g1.jpg" }, { url: "/uploads/g2.jpg" }, { url: "/uploads/g3.jpg" }] });
  feed = await call("ben", "GET", "/api/feed?channel=profile");
  t("multi-photo posts come back with every photo", feed.j.posts.find((p) => p.id === gal.j.post.id)?.images?.length === 3);
  const sendP = await call("ben", "POST", `/api/posts/${p1.j.post.id}/send`, { username: "ana", note: "look" });
  const card = (await call("ana", "GET", `/api/chats/${sendP.j.chatId}`)).j.messages.find((m) => m.post);
  t("sending a post drops a card in the chat", card?.post.id === p1.j.post.id && card.post.author.username === "ben");

  console.log("\nLINK PREVIEWS — never fetch the inside of our network");
  for (const u of ["http://127.0.0.1:" + PORT + "/api/admin/health", "http://localhost/", "http://[::1]/", "http://169.254.169.254/latest/meta-data",
    "http://0x7f000001/", "http://2130706433/", "http://10.0.0.1/", "http://metadata.google.internal/"])
    t("refuses " + u.slice(0, 44), (await call("ben", "POST", "/api/unfurl", { url: u })).s === 400);

  console.log("\nCLEANUP — every file a member uses is kept");
  peek.prepare(`UPDATE dm_messages SET audio_url = '/uploads/voice-note.m4a' WHERE id = ?`).run(rep.j.message.id);
  writeFileSync(join(DATA, "uploads", "voice-note.m4a"), "x");
  const cl = await call("ana", "POST", "/api/admin/cleanup");
  const left = readdirSync(join(DATA, "uploads"));
  t("the orphan goes", cl.j.removed >= 1 && !left.includes("orphan.bin"));
  t("a track's audio stays (the old list missed tracks)", left.includes("track-keys.mp3"));
  t("a voice note stays", left.includes("voice-note.m4a"));
  t("a photo from a pre-v2 message stays", left.includes("old-photo.jpg"));
  t("a photo from an unsent message goes with it", !left.includes("unsent.jpg"));
  peek.close();
} catch (e) {
  fail++; console.log("  ✗  threw: " + e.message); console.log(log.slice(-1500));
} finally { srv.kill(); }
console.log(`\n  ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
