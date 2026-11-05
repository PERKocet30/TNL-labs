// ECHO v1.0 (2026-11-04): LABS's help inside Messages, no outside AI. The real
// server against a throwaway database: who may ask (admins only until the
// switch), that a question lands on the right answer, that account lookups show
// only the asker's own rows, that Echo learns (thumbs, "I meant this one",
// teaching from Admin → Echo), and that a handoff reaches the admin.
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { mkdirSync, rmSync } from "node:fs";
import { spawn } from "node:child_process";
const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const DATA = join(ROOT, "test/.tmp/echo");
rmSync(DATA, { recursive: true, force: true }); mkdirSync(DATA, { recursive: true });
process.env.TNL_DATA = DATA; process.env.TNL_NO_WATCH = "1";
let pass = 0, fail = 0;
const t = (n, ok) => { ok ? pass++ : fail++; console.log("  " + (ok ? "✓" : "✗") + "  " + n); };

const { db } = await import("../src/db.js");
const now = Date.now();
const ins = db.prepare("INSERT INTO users (username,display_name,email,role,roles,password_hash,email_verified,created_at,is_admin,rep,stripe_account,stripe_ready,stripe_kind) VALUES (?,?,?,?,?,?,1,?,?,?,?,?,?)");
const admin = Number(ins.run("jorge", "Jorge F", "jorge@x.test", "Designer", '["Designer"]', "x", now, 1, 150, "acct_1", 1, "express_stripe").lastInsertRowid);
const ana = Number(ins.run("ana", "Ana", "ana@x.test", "Producer", '["Producer"]', "x", now, 0, 0, "", 0, "").lastInsertRowid);
const ben = Number(ins.run("ben", "Ben", "ben@x.test", "Producer", '["Producer"]', "x", now, 0, 10, "acct_2", 0, "express").lastInsertRowid);
for (const [tok, id] of [["tok-admin", admin], ["tok-ana", ana], ["tok-ben", ben]]) db.prepare("INSERT INTO sessions (token,user_id,created_at) VALUES (?,?,?)").run(tok, id, now);
const listing = (seller, title) => Number(db.prepare("INSERT INTO listings (seller_id,title,price_cents,category,status,kind,images,created_at,updated_at) VALUES (?,?,?,?,'active','item','[]',?,?)").run(seller, title, 3000, "Tops", now, now).lastInsertRowid);
const l1 = listing(admin, "Lab tee"), l2 = listing(ben, "Ben's hoodie");
const order = (l, buyer, seller, status, tracking = "") => db.prepare("INSERT INTO orders (listing_id,buyer_id,seller_id,amount_cents,shipping_cents,status,payment_ref,tracking,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?)").run(l, buyer, seller, 3000, 500, status, "cs_" + l, tracking, now, now);
order(l1, ana, admin, "shipped", "1Z999");   // ana bought from jorge
order(l2, ana, ben, "paid");                 // ana bought from ben; ben hasn't shipped
order(l1, ben, admin, "complete");           // ben bought from jorge

const PORT = 18800 + (process.pid % 200);
const srv = spawn(process.execPath, ["--experimental-sqlite", "src/server.js"], { cwd: ROOT, env: { ...process.env, PORT: String(PORT), TNL_DATA: DATA, TNL_NO_WATCH: "1", ECHO_AI_KEY: "", ANTHROPIC_API_KEY: "" }, stdio: ["ignore", "pipe", "pipe"] });
let log = ""; srv.stdout.on("data", (d) => log += d); srv.stderr.on("data", (d) => log += d);
for (let i = 0; i < 150 && !/listening/.test(log); i++) await new Promise((r) => setTimeout(r, 100));
const call = async (tok, method, path, body) => {
  const r = await fetch(`http://127.0.0.1:${PORT}${path}`, { method, headers: { "content-type": "application/json", ...(tok ? { authorization: "Bearer " + tok } : {}) }, body: body ? JSON.stringify(body) : undefined });
  return { s: r.status, j: await r.json().catch(() => ({})) };
};
const ask = async (tok, q) => (await call(tok, "POST", "/api/echo/ask", { q })).j.turn;

try {
  console.log("\nWHO MAY ASK — admins only until the switch");
  t("signed out → 401", (await call(null, "GET", "/api/echo")).s === 401);
  t("a member → 403 while Echo is admins-only", (await call("tok-ana", "GET", "/api/echo")).s === 403 && (await call("tok-ana", "POST", "/api/echo/ask", { q: "hi" })).s === 403);
  const hello = await call("tok-admin", "GET", "/api/echo");
  t("an admin gets Echo: a hello by first name, topics, starter questions, no turns yet", hello.s === 200 && /^Hi Jorge/.test(hello.j.hello) && hello.j.starters.length >= 3 && hello.j.turns.length === 0 && hello.j.preview === true);
  t("the app's site flags carry echoOpen (off)", (await call(null, "GET", "/api/levels")).j.site.echoOpen === false);
  t("…a member can't flip the switch", (await call("tok-ana", "PATCH", "/api/admin/settings", { echoOpen: "1" })).s === 403);
  t("…the admin opens it to everyone", (await call("tok-admin", "PATCH", "/api/admin/settings", { echoOpen: "1" })).s === 200 && (await call("tok-ana", "GET", "/api/echo")).s === 200 && (await call("tok-ana", "GET", "/api/echo")).j.preview === false);
  t("every answer says LABS, never the other brand", !db.prepare("SELECT COUNT(*) n FROM echo_faq WHERE answer LIKE '%TNL%' OR question LIKE '%TNL%'").get().n);

  console.log("\nANSWERS — a question in your own words lands on the right one");
  const faqOf = (key) => db.prepare("SELECT id FROM echo_faq WHERE key = ?").get(key).id;
  const lands = async (q, key) => { const r = await ask("tok-ana", q); return r.kind === "answer" && r.faqId === faqOf(key); };
  t("'how much do you take' → fees", await lands("how much do you take from a sale?", "fees"));
  t("'where's my order' → orders", await lands("where's my order", "orders"));
  t("'can I get a refund' → returns", await lands("can I get a refund, it came damaged", "returns"));
  t("'forgot my password' → password", await lands("I forgot my password and can't log in", "password"));
  t("'how do I set up stripe' → payouts setup", await lands("how do I set up stripe", "stripe"));
  t("'how does voting work' → tournament", await lands("how does voting work", "tournament"));
  t("'how do I change my color' (US spelling) → profile", await lands("how do I change my color", "colour"));
  const miss = await ask("tok-ana", "my cat is purple");
  t("something Echo doesn't know → an honest miss, no answer id, no made-up facts", miss.kind === "miss" && !miss.faqId && !miss.facts && /don't know/.test(miss.text));
  t("an empty question is refused", (await call("tok-ana", "POST", "/api/echo/ask", { q: "   " })).s === 400);
  t("a 2000-character question is kept to 500", (await ask("tok-ana", "x".repeat(2000))).asked.length === 500);

  console.log("\nOWN ACCOUNT ONLY — facts are the asker's rows, nobody else's");
  const o = await ask("tok-ana", "where is my order");
  t("ana sees her two orders, with the seller, state and tracking", o.facts && o.facts.lines.length === 2 && o.facts.lines.some((l) => /Lab tee from @jorge.*shipped.*1Z999/.test(l)) && o.facts.lines.some((l) => /Ben's hoodie from @ben.*waiting to ship/.test(l)));
  const ob = await ask("tok-ben", "where is my order");
  t("ben sees only his (not ana's)", ob.facts.lines.length === 1 && /Lab tee from @jorge.*delivered/.test(ob.facts.lines[0]) && !ob.facts.lines.some((l) => /hoodie/.test(l)));
  const pb = await ask("tok-ben", "when do I get paid");
  t("ben's payouts: Stripe not finished, one paid order waiting to ship, his fee", pb.facts && /Stripe still needs/.test(pb.facts.lines[0]) && pb.facts.lines.some((l) => /1 paid order .*\$30.* waiting for you to ship/.test(l)) && pb.facts.lines.some((l) => /Your fee: 10%/.test(l)));
  const pa = await ask("tok-ana", "when do I get paid");
  t("ana's payouts: not set up, nothing owed", /not set up/.test(pa.facts.lines[0]) && !pa.facts.lines.some((l) => /waiting for you to ship/.test(l)));
  const sj = await ask("tok-admin", "how are my sales doing");
  t("the admin's shop: 2 sales, $60, 1 listing live, nothing to ship", sj.facts && /2 sales all time · \$60/.test(sj.facts.lines[0]) && /1 listing live/.test(sj.facts.lines[2]) && /Nothing waiting/.test(sj.facts.lines[3]));
  const st = await ask("tok-admin", "how do I earn rep");
  t("standing: rep, level, what's next, the fee (0% for an admin)", st.facts && /150 rep · Collaborator/.test(st.facts.lines[0]) && /130 more to Core/.test(st.facts.lines[1]) && /0%/.test(st.facts.lines[2]));
  t("a fact card tells the app where to go", o.facts.go && o.facts.go.to === "orders" && pb.facts.go.to === "payouts");
  const back = (await call("tok-ana", "GET", "/api/echo")).j.turns;
  t("coming back, the conversation is there — with the facts refreshed, not stored", back.length >= 5 && back.find((x) => x.id === o.id).facts.lines.length === 2);
  t("nothing personal is stored in a turn but the question itself", db.prepare("PRAGMA table_info(echo_turns)").all().map((c) => c.name).join() === "id,user_id,asked,faq_id,kind,score,helpful,picked,created_at,know_id,picked_know");

  console.log("\nFROM KNOWLEDGE — the creed, decisions, glossary and every feature (2026-11-04)");
  const knowOf = (key) => db.prepare("SELECT id, title, body FROM knowledge WHERE key = ?").get(key);
  const cult = await ask("tok-ana", "what is a cultivator?");
  t("'what is a cultivator' → the glossary entry, as written, wearing its title", cult.kind === "answer" && cult.from === "know" && cult.knowId === knowOf("g-cultivators").id && cult.title === "Cultivators" && cult.text === knowOf("g-cultivators").body && !cult.faqId);
  const look = await ask("tok-ana", "what does LABS look like");
  t("'what does LABS look like' → the voice entry on how LABS looks", look.kind === "answer" && look.knowId === knowOf("voice-look").id);
  const creedQ = await ask("tok-ana", "what's the creed");
  t("'what's the creed' → the creed", creedQ.knowId === knowOf("creed").id && /take over/.test(creedQ.text));
  const feat = await ask("tok-ana", "how does the poll scoreboard freeze");
  t("a feature question → the feature entry (the poll)", feat.kind === "answer" && feat.knowId === knowOf("f-poll").id);
  t("the purpose-written Q&A still wins its own questions (orders, fees, password)", await lands("where's my order", "orders") && await lands("how much do you take from a sale?", "fees") && await lands("I forgot my password", "password"));
  t("a knowledge answer is stored by its own id, never as a Q&A id", db.prepare("SELECT faq_id, know_id FROM echo_turns WHERE id = ?").get(cult.id).faq_id === null && db.prepare("SELECT know_id FROM echo_turns WHERE id = ?").get(cult.id).know_id === knowOf("g-cultivators").id);
  t("thumbs on a knowledge answer is noted and moves no Q&A weight", (await call("tok-ana", "POST", `/api/echo/turns/${cult.id}/helpful`, { helpful: true })).s === 200 && db.prepare("SELECT helpful FROM echo_turns WHERE id = ?").get(cult.id).helpful === 1);
  const odd2 = await ask("tok-ana", "blorf the door");
  const pk = await call("tok-ana", "POST", `/api/echo/turns/${odd2.id}/pick`, { knowId: knowOf("f-door").id });
  t("'I meant this one' can pick a knowledge entry, and it learns the words", pk.s === 200 && pk.j.turn.knowId === knowOf("f-door").id && /blorf/.test(db.prepare("SELECT learned FROM knowledge WHERE key = 'f-door'").get().learned));
  t("…so the odd words now land straight on it", (await ask("tok-ana", "blorf")).knowId === knowOf("f-door").id);
  t("coming back, a knowledge answer is still there with its title", (await call("tok-ana", "GET", "/api/echo")).j.turns.find((x) => x.id === cult.id).title === "Cultivators");
  t("an entry put away in Knowledge is out of Echo's reach", (await call("tok-admin", "PATCH", `/api/admin/knowledge/${knowOf("g-cultivators").id}`, { archived: true })).s === 200 && (await ask("tok-ana", "what is a cultivator?")).knowId !== knowOf("g-cultivators").id && (await call("tok-admin", "PATCH", `/api/admin/knowledge/${knowOf("g-cultivators").id}`, { archived: false })).s === 200);
  const admK = (await call("tok-admin", "GET", "/api/admin/echo")).j;
  t("Admin → Echo counts answers from Knowledge and names the entries", admK.numbers.fromKnowledge >= 4 && admK.know.some((k) => k.title === "Cultivators" && k.liked === 1) && admK.knowledgeTotal >= 90);

  console.log("\nLEARNING — from thumbs, from 'I meant this one', from teaching");
  const w0 = db.prepare("SELECT weight FROM echo_faq WHERE id = ?").get(o.faqId).weight;
  t("thumbs up moves the answer's weight up", (await call("tok-ana", "POST", `/api/echo/turns/${o.id}/helpful`, { helpful: true })).s === 200 && db.prepare("SELECT weight FROM echo_faq WHERE id = ?").get(o.faqId).weight > w0);
  t("…rating twice doesn't count twice", (await call("tok-ana", "POST", `/api/echo/turns/${o.id}/helpful`, { helpful: true })).s === 200 && db.prepare("SELECT weight FROM echo_faq WHERE id = ?").get(o.faqId).weight === w0 + 0.02);
  t("thumbs down moves it down", (await call("tok-ben", "POST", `/api/echo/turns/${ob.id}/helpful`, { helpful: false })).s === 200 && db.prepare("SELECT weight FROM echo_faq WHERE id = ?").get(o.faqId).weight < w0 + 0.02);
  t("you can't rate someone else's turn", (await call("tok-ben", "POST", `/api/echo/turns/${o.id}/helpful`, { helpful: false })).s === 404);
  const odd = await ask("tok-ana", "zorp the parcel thing");
  const picked = await call("tok-ana", "POST", `/api/echo/turns/${odd.id}/pick`, { faqId: faqOf("shipping") });
  t("'I meant this one' shows that answer", picked.s === 200 && picked.j.turn.faqId === faqOf("shipping") && picked.j.turn.kind === "answer");
  t("…and Echo learns the words: the same odd question now lands straight on it", (await lands("zorp the parcel", "shipping")));
  t("learned words are kept on the answer", /zorp/.test(db.prepare("SELECT learned FROM echo_faq WHERE key = 'shipping'").get().learned));
  const adm = (await call("tok-admin", "GET", "/api/admin/echo")).j;
  t("Admin → Echo: counts, and 'my cat is purple' waiting to be taught", adm.numbers.asked >= 15 && adm.missed.some((m) => m.asked === "my cat is purple") && adm.faq.length >= 20);
  t("…a member can't read it", (await call("tok-ana", "GET", "/api/admin/echo")).s === 403 && (await call("tok-ana", "POST", "/api/admin/echo/faq", { question: "x", answer: "y" })).s === 403);
  const taught = await call("tok-admin", "POST", "/api/admin/echo/faq", { question: "Is my cat purple?", answer: "Only on LABS.", keywords: "cat purple", topic: "Labs", action: "nope" });
  t("the admin teaches an answer (a made-up lookup is dropped)", taught.s === 200 && db.prepare("SELECT action, source FROM echo_faq WHERE id = ?").get(taught.j.id).action === "" && db.prepare("SELECT source FROM echo_faq WHERE id = ?").get(taught.j.id).source === "taught");
  t("…and Echo answers with it right away", (await ask("tok-ana", "my cat is purple")).text === "Only on LABS.");
  t("a question and an answer are both needed", (await call("tok-admin", "POST", "/api/admin/echo/faq", { question: "x" })).s === 400);
  t("switching an answer off takes it out of play", (await call("tok-admin", "PATCH", `/api/admin/echo/faq/${taught.j.id}`, { enabled: false })).s === 200 && (await ask("tok-ana", "my cat is purple")).kind === "miss");
  t("'forget' clears learned words", (await call("tok-admin", "PATCH", `/api/admin/echo/faq/${faqOf("shipping")}`, { forget: true })).s === 200 && db.prepare("SELECT learned FROM echo_faq WHERE key = 'shipping'").get().learned === "");
  t("deleting a taught answer", (await call("tok-admin", "DELETE", `/api/admin/echo/faq/${taught.j.id}`)).j.ok === true && !db.prepare("SELECT 1 FROM echo_faq WHERE id = ?").get(taught.j.id));

  console.log("\nHANDOFF — a person");
  const h = await call("tok-ana", "POST", "/api/echo/handoff", { note: "The hoodie never came" });
  t("the conversation goes to a person: a row for the admin, a reply to the member", h.s === 200 && /will reply to ana@x.test/.test(h.j.text) && db.prepare("SELECT COUNT(*) n FROM echo_handoffs WHERE user_id = ? AND status = 'open'").get(ana).n === 1);
  const row = db.prepare("SELECT * FROM echo_handoffs WHERE user_id = ?").get(ana);
  t("…with the note and the last twelve turns of the conversation (asked, and what Echo answered with)", row.note === "The hoodie never came" && /@ana: my cat is purple\nEcho: \((didn't know|wasn't sure)\)/.test(row.transcript) && /\nEcho: How does shipping work\?/.test(row.transcript) && row.transcript.split("\n").length === 24);
  t("…the email went to the support inbox (mail not configured here → logged)", /NOT CONFIGURED[\s\S]*Echo handoff from @ana/.test(log));
  const A2 = (await call("tok-admin", "GET", "/api/admin/echo")).j;
  t("Admin → Echo lists it open, with who", A2.handoffs.some((x) => x.id === row.id && x.status === "open" && x.username === "ana"));
  t("…and marks it done", (await call("tok-admin", "POST", `/api/admin/echo/handoffs/${row.id}/done`)).j.ok === true && db.prepare("SELECT status FROM echo_handoffs WHERE id = ?").get(row.id).status === "done");
  t("handoffs are rate-limited (3 an hour)", (await call("tok-ana", "POST", "/api/echo/handoff", {})).s === 200 && (await call("tok-ana", "POST", "/api/echo/handoff", {})).s === 200 && (await call("tok-ana", "POST", "/api/echo/handoff", {})).s === 429);
} catch (e) {
  fail++; console.log("  ✗  threw: " + (e.stack || e.message)); console.log(log.slice(-1500));
} finally { srv.kill(); }
console.log(`\n  ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
