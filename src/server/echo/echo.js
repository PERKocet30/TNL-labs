/* ================================================================
   ECHO v1.0 — 2026-11-04. "A chat bot for my app, for customer service and
   selling questions, trained on my app." Echo is LABS's help desk inside
   Messages: a member asks in their own words, Echo answers from what it
   knows about LABS, looks up the asking member's own account when the
   question is about it, and hands the conversation to a person when it
   can't help. No outside AI: Echo matches a question to what it has been
   taught (the built-in answers below plus what the admin teaches it) and
   learns from every conversation —
     · a thumbs up or down on an answer moves that answer's weight
     · a question Echo didn't get, answered by picking a suggestion, teaches
       Echo that phrasing (echo_faq.learned), so next time it just answers
     · every question Echo missed waits in Admin → Echo to be taught
   Admin-only while it's perfected: the `echoOpen` switch (Admin →
   Settings) opens it to every member. Account lookups read only the signed-in
   member's own rows and say nothing about anyone else.
     GET   /api/echo                       hello, topics, this member's past turns
     POST  /api/echo/ask { q }             one question → one answer (rate-limited)
     POST  /api/echo/turns/:id/helpful     { helpful: true|false }
     POST  /api/echo/turns/:id/pick        { faqId } — "I meant this one"
     POST  /api/echo/handoff { note }      email SUPPORT_EMAIL the conversation; a row for the admin
     GET   /api/admin/echo                 numbers, what Echo missed, every answer, open handoffs
     POST  /api/admin/echo/faq             teach an answer   PATCH /:id edit · DELETE /:id forget
     POST  /api/admin/echo/handoffs/:id/done
   test/echo.test.mjs
================================================================ */
db.exec(`CREATE TABLE IF NOT EXISTS echo_faq (
  id INTEGER PRIMARY KEY AUTOINCREMENT, key TEXT UNIQUE, question TEXT NOT NULL, answer TEXT NOT NULL,
  keywords TEXT NOT NULL DEFAULT '', learned TEXT NOT NULL DEFAULT '', action TEXT NOT NULL DEFAULT '',
  topic TEXT NOT NULL DEFAULT '', weight REAL NOT NULL DEFAULT 0, enabled INTEGER NOT NULL DEFAULT 1,
  source TEXT NOT NULL DEFAULT 'taught', created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL);
CREATE TABLE IF NOT EXISTS echo_turns (
  id INTEGER PRIMARY KEY AUTOINCREMENT, user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  asked TEXT NOT NULL, faq_id INTEGER, kind TEXT NOT NULL DEFAULT 'miss', score REAL NOT NULL DEFAULT 0,
  helpful INTEGER, picked INTEGER, created_at INTEGER NOT NULL);
CREATE INDEX IF NOT EXISTS idx_echo_turns_user ON echo_turns(user_id, created_at);
CREATE INDEX IF NOT EXISTS idx_echo_turns_at ON echo_turns(created_at);
CREATE TABLE IF NOT EXISTS echo_handoffs (
  id INTEGER PRIMARY KEY AUTOINCREMENT, user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  note TEXT NOT NULL DEFAULT '', transcript TEXT NOT NULL DEFAULT '', status TEXT NOT NULL DEFAULT 'open',
  created_at INTEGER NOT NULL, done_at INTEGER)`);

/* What Echo knows on day one. Keyed, so a built-in answer the admin edits
   stays edited (INSERT OR IGNORE) and a new build can add more. `action`
   names an own-account lookup that is added under the answer. */
const ECHO_ACTIONS = ["", "orders", "sales", "listings", "payouts", "standing"];
const ECHO_TOPICS = ["Buying", "Selling", "Getting paid", "Standing", "Posting", "Account", "Labs", "Tournament"];
const ECHO_KNOWLEDGE = [
  { key: "what-is-labs", topic: "Labs", question: "What is LABS?", keywords: "about app creatives social",
    answer: "LABS is social media by creatives, for creatives: post your work, find people across scenes, make things together, and sell what you make. Your standing is earned only from what other people do with your work." },
  { key: "labs", topic: "Labs", question: "What are the labs?", keywords: "genre place visual music fashion anime news business general tags",
    answer: "Labs are places, one per genre — // General, // Visual, // Music, // Fashion, // Anime, // News and // Business. Each has Work (everything made there, by #tag) and Talk (one conversation). Tag your own work with #tags and the labs that match what you make come first." },
  { key: "post", topic: "Posting", question: "How do I post my work?", keywords: "upload share picture photo video song create new piece",
    answer: "Tap Post in the nav. Put the work first — up to 10 images or a video — then the caption with #tags and @mentions, then collaborators, music, the lab, people and products. Posting needs an account." },
  { key: "collab", topic: "Posting", question: "How do collabs work?", keywords: "collaborator credit invite accept together",
    answer: "Credit a collaborator on your post. A collab only counts once the other person accepts — then it counts for both of you. Nothing is counted from an invite alone." },
  { key: "standing", topic: "Standing", question: "How do I earn rep and levels?", keywords: "reputation points level up core leadership verified entry climb", action: "standing",
    answer: "Rep is earned only from what other people do with your work: likes, shares, collabs both sides confirm, and completed sales. You can't award it to yourself and nothing is earned from posting alone. Levels go Entry → Verified → Collaborator → Core → Leadership, and each one lowers your Market fee." },
  { key: "fees", topic: "Selling", question: "What are the fees for selling?", keywords: "commission cut percent take fee cost charge",
    answer: "LABS takes a platform fee of the item price, never on shipping: 10% at Entry, 8% at Verified, 6% at Collaborator, 4% at Core and 2% at Leadership. The sell form shows exactly what you receive before you list. Card processing is Stripe's — either taken by Stripe or included in our fee, depending on your account type." },
  { key: "sell", topic: "Selling", question: "How do I sell something?", keywords: "list listing market shop item product put up for sale", action: "listings",
    answer: "Open the Market and tap Sell. The walkthrough asks one question a screen — what it is, who's selling, photos, words, size & stock, details, price & shipping — then you review and publish. You need a confirmed email and a Stripe account to get paid." },
  { key: "stripe", topic: "Getting paid", question: "How do I set up payouts?", keywords: "stripe connect bank account get paid money payout setup", action: "payouts",
    answer: "Payouts go through Stripe. Open your Shop from your profile and tap Set up payouts — Stripe asks a few questions and sends the money to your bank. Until it's done, your listings can't be bought." },
  { key: "payout-when", topic: "Getting paid", question: "When do I get paid?", keywords: "where is my payout money late waiting bank arrive get paid", action: "payouts",
    answer: "Card payments go straight to your own Stripe account the moment the buyer pays. Stripe pays out to your bank on its schedule — usually two business days after each sale on a new account, and daily once it's established. Your Stripe dashboard (Shop → Payouts) shows every payout and its date." },
  { key: "orders", topic: "Buying", question: "Where is my order?", keywords: "track tracking shipped delivery arrive bought purchase status", action: "orders",
    answer: "Your orders live under your profile → Orders. A seller marks it shipped and adds tracking; you'll see both there. If it hasn't shipped after a few days, message the seller — their name is on the order." },
  { key: "shipping", topic: "Buying", question: "How does shipping work?", keywords: "ship cost postage international combine",
    answer: "Shipping cost is on the listing before you buy. Several items from one seller in one checkout ship together for one shipping price. Sellers ship with tracking within a few days of the order." },
  { key: "returns", topic: "Buying", question: "Can I return something or get a refund?", keywords: "refund return damaged not as described never arrived broken wrong size dispute",
    answer: "Not as described, damaged or never arrived: tell the seller within 14 days of delivery and you get a full refund including shipping. If they want the item back, they pay return postage. Changed your mind? That's up to the seller. If a seller doesn't respond, Echo can hand this to a person." },
  { key: "sales", topic: "Selling", question: "How are my sales doing?", keywords: "sold revenue earnings numbers stats my shop", action: "sales",
    answer: "Your shop's numbers are under your profile → Shop. Here's what's on your account right now:" },
  { key: "ship-order", topic: "Selling", question: "Someone bought my item — what now?", keywords: "sold ship order buyer mark shipped tracking pack",
    answer: "Open the order under your profile → Shop → Orders. Pack it, ship it with tracking, and tap Mark shipped with the tracking number — the buyer sees it right away. Answer buyers within two days." },
  { key: "offers", topic: "Selling", question: "How do offers work?", keywords: "offer accept decline counter price lower bargain",
    answer: "A buyer can make an offer on a listing that accepts them. You get a notification and can accept or decline from the listing. An accepted offer holds that price for the buyer's checkout." },
  { key: "account-email", topic: "Account", question: "I didn't get the confirmation email", keywords: "verify verification confirm email link spam resend not received",
    answer: "Check your spam folder first. From the app, open your profile and tap Resend confirmation — a fresh 24-hour link goes out. Still nothing? Tell Echo to hand this to a person and we'll confirm it by hand." },
  { key: "password", topic: "Account", question: "I forgot my password", keywords: "reset login log in can't sign in locked",
    answer: "On the Log in screen tap Forgot password and we email you a reset link. A new password needs 8+ characters with a letter and a number." },
  { key: "colour", topic: "Account", question: "How do I change my colour or profile?", keywords: "accent color edit profile photo bio name username pronouns link",
    answer: "Open your profile and tap Edit. Your colour, photo, bio, pronouns, links and what you make are all there — your profile, posts and share cards wear your colour." },
  { key: "delete", topic: "Account", question: "How do I delete my account?", keywords: "remove close deactivate leave quit",
    answer: "Profile → Edit → Delete account. It removes your posts, listings and messages. Orders in progress finish first. This can't be undone." },
  { key: "tournament", topic: "Tournament", question: "How does the tournament work?", keywords: "event vote enter entry poll bracket prize final scoreboard",
    answer: "One prompt, one entry each. Votes open fresh every day; the scoreboard goes dark for the last hours, then a final. Votes only count in the app — share your Story card and vote link to bring your people in." },
  { key: "showroom", topic: "Posting", question: "How does the Showroom order work?", keywords: "ranking feed front page featured algorithm first why",
    answer: "The Showroom shows real work from every lab, ranked by what other people do with it. Your own taps never count and work made together gets a lift. There's no way to buy a spot." },
  { key: "instagram", topic: "Posting", question: "Can I share to Instagram?", keywords: "story share card link sticker ig",
    answer: "Yes — any post, profile, listing or song has Share → Instagram Story: one tap shares the card and copies the link for a Link sticker. Links open LABS on the exact thing." },
  { key: "person", topic: "Account", question: "Can I talk to a person?", keywords: "human support help contact someone real staff email",
    answer: "Of course. Tap Talk to a person below and this conversation goes to the LABS team — they reply by email." },
];
const echoFaqIns = db.prepare(`INSERT OR IGNORE INTO echo_faq (key, question, answer, keywords, action, topic, source, created_at, updated_at) VALUES (?,?,?,?,?,?,'built-in',?,?)`);
for (const k of ECHO_KNOWLEDGE) echoFaqIns.run(k.key, k.question, k.answer, k.keywords || "", k.action || "", k.topic || "", Date.now(), Date.now());

/* ---- words. Echo reads a question as a bag of stems; the rare ones say the most. ---- */
const ECHO_STOP = new Set("a an the and or of to in on at for is are was be been do does did i my me we you your it its this that can how what when where why which who with about from get got have has had will would should could just please thanks there here into up out if so not no yes any some one am want need know like work works mean use labs".split(" "));
const ECHO_SYN = { pay: "paid", payment: "paid", payout: "paid", payouts: "paid", money: "paid", cash: "paid", earnings: "sales", revenue: "sales",
  buy: "bought", purchase: "bought", purchased: "bought", order: "bought", orders: "bought", bought: "bought",
  sell: "sell", selling: "sell", sold: "sell", sale: "sell", sales: "sell", listing: "sell", listings: "sell", list: "sell", shop: "sell", market: "sell", store: "sell",
  pic: "photo", picture: "photo", image: "photo", photos: "photo", pics: "photo", upload: "post", posting: "post", posts: "post", post: "post",
  colour: "color", colours: "color", color: "color", colors: "color", rep: "rep", reputation: "rep", points: "rep", level: "rep", levels: "rep", standing: "rep",
  refund: "refund", refunded: "refund", return: "refund", returns: "refund", money_back: "refund", "sign": "login", signin: "login", login: "login", "log": "login",
  password: "password", pw: "password", pass: "password", email: "email", mail: "email", emails: "email",
  ship: "ship", shipping: "ship", shipped: "ship", deliver: "ship", delivery: "ship", delivered: "ship", track: "ship", tracking: "ship", postage: "ship",
  tournament: "tournament", event: "tournament", vote: "tournament", votes: "tournament", voting: "tournament", contest: "tournament", competition: "tournament",
  collab: "collab", collabs: "collab", collaboration: "collab", collaborator: "collab", collaborators: "collab", collaborate: "collab",
  fee: "fee", fees: "fee", commission: "fee", cut: "fee", percent: "fee", percentage: "fee", stripe: "stripe", bank: "stripe",
  account: "account", profile: "account", delete: "delete", remove: "delete", close: "delete", deactivate: "delete", human: "person", someone: "person", staff: "person", support: "person", help: "person" };
const echoStem = (w) => { if (ECHO_SYN[w]) return ECHO_SYN[w]; let s = w; for (const e of ["ing", "ers", "er", "ies", "es", "ed", "s"]) if (s.length > 4 && s.endsWith(e)) { s = s.slice(0, -e.length); break; } return ECHO_SYN[s] || s; };
function echoWords(text) {
  const out = new Set();
  for (const raw of String(text || "").toLowerCase().replace(/[^a-z0-9#@\s]/g, " ").split(/\s+/)) {
    const w = raw.replace(/^[#@]/, ""); if (!w || w.length < 2 || ECHO_STOP.has(w)) continue; out.add(echoStem(w));
  }
  return out;
}
const echoLive = () => db.prepare(`SELECT * FROM echo_faq WHERE enabled = 1 ORDER BY id`).all();
/* One pass over the knowledge: each answer's words, and how rare each word is
   (a word in one answer out of twenty says a lot; "sell" in half of them says less). */
function echoIndex(faqs) {
  const docs = faqs.map((f) => ({ f, words: echoWords(f.question + " " + f.keywords + " " + f.learned + " " + f.topic) }));
  const df = new Map(); for (const d of docs) for (const w of d.words) df.set(w, (df.get(w) || 0) + 1);
  const idf = (w) => (df.get(w) ? Math.log(1 + docs.length / df.get(w)) : 1);   // a word nothing knows is noise, not a heavy miss
  return { docs, idf };
}
function echoMatch(q, faqs = echoLive()) {
  const words = echoWords(q); if (!words.size) return { best: null, score: 0, alts: [] };
  const { docs, idf } = echoIndex(faqs);
  const qTotal = [...words].reduce((s, w) => s + idf(w), 0) || 1;
  const scored = docs.map((d) => {
    let hit = 0, n = 0; for (const w of words) if (d.words.has(w)) { hit += idf(w); n++; }
    const cover = hit / qTotal;                                  // how much of the question the answer speaks to
    const focus = n / Math.max(3, d.words.size * 0.35);          // and how much of the answer's own words it hit (so a long entry can't win on bulk)
    return { f: d.f, score: Math.min(1, cover * 0.75 + Math.min(1, focus) * 0.25 + (d.f.weight || 0)) };
  }).filter((x) => x.score > 0.08).sort((a, b) => b.score - a.score);
  const best = scored[0] || null;
  return { best: best && best.f, score: best ? best.score : 0, alts: scored.slice(best && best.score >= 0.45 ? 1 : 0, 4).map((x) => x.f) };
}
const ECHO_SURE = 0.45, ECHO_MAYBE = 0.18;

/* ---- own-account lookups: the signed-in member's rows, nothing else ---- */
const echoMoney = (c) => "$" + ((c || 0) / 100).toFixed((c || 0) % 100 ? 2 : 0);
const echoWhen = (t) => new Date(t).toLocaleDateString("en-US", { month: "short", day: "numeric" });
const ECHO_ORDER_WORDS = { pending: "waiting for payment", paid: "paid — waiting to ship", shipped: "shipped", complete: "delivered", cancelled: "cancelled" };
function echoFacts(action, user) {
  const u = db.prepare(`SELECT * FROM users WHERE id = ?`).get(user.id); if (!u) return null;
  if (action === "orders") {
    const rows = db.prepare(`SELECT o.id, o.status, o.amount_cents, o.shipping_cents, o.tracking, o.created_at, l.title, s.username seller FROM orders o JOIN listings l ON l.id = o.listing_id JOIN users s ON s.id = o.seller_id WHERE o.buyer_id = ? AND o.status != 'pending' ORDER BY o.created_at DESC LIMIT 5`).all(u.id);
    if (!rows.length) return { title: "Your orders", lines: ["You haven't bought anything yet."] };
    return { title: "Your last " + (rows.length === 1 ? "order" : rows.length + " orders"), lines: rows.map((o) => `${o.title} from @${o.seller} · ${echoMoney(o.amount_cents + o.shipping_cents)} · ${ECHO_ORDER_WORDS[o.status] || o.status}${o.tracking ? " · tracking " + o.tracking : ""} · ${echoWhen(o.created_at)}`), go: { label: "Open my orders", to: "orders" } };
  }
  if (action === "sales") {
    const paid = `('paid','shipped','complete')`;
    const t = db.prepare(`SELECT COUNT(*) n, COALESCE(SUM(amount_cents),0) c FROM orders WHERE seller_id = ? AND status IN ${paid}`).get(u.id);
    const toShip = db.prepare(`SELECT COUNT(*) n FROM orders WHERE seller_id = ? AND status = 'paid'`).get(u.id).n;
    const month = db.prepare(`SELECT COUNT(*) n, COALESCE(SUM(amount_cents),0) c FROM orders WHERE seller_id = ? AND status IN ${paid} AND created_at > ?`).get(u.id, Date.now() - 30 * 86400000);
    const live = db.prepare(`SELECT COUNT(*) n FROM listings WHERE seller_id = ? AND status = 'active'`).get(u.id).n;
    return { title: "Your shop", lines: [`${t.n} sale${t.n === 1 ? "" : "s"} all time · ${echoMoney(t.c)}`, `${month.n} in the last 30 days · ${echoMoney(month.c)}`, `${live} listing${live === 1 ? "" : "s"} live`, toShip ? `${toShip} order${toShip === 1 ? "" : "s"} paid and waiting for you to ship` : "Nothing waiting to ship"], go: { label: "Open my shop", to: "shop" } };
  }
  if (action === "listings") {
    const r = db.prepare(`SELECT status, COUNT(*) n FROM listings WHERE seller_id = ? GROUP BY status`).all(u.id);
    const n = Object.fromEntries(r.map((x) => [x.status, x.n]));
    const lines = [`${n.active || 0} live, ${n.sold || 0} sold`];
    if (!u.email_verified) lines.push("Your email isn't confirmed yet — that's needed before a listing goes live.");
    if (!u.stripe_account) lines.push("Payouts aren't set up yet — buyers can't check out until they are.");
    else if (!u.stripe_ready) lines.push("Stripe still needs something from you before payouts work — open Shop → Payouts.");
    return { title: "Your listings", lines, go: { label: n.active ? "Open my shop" : "Start selling", to: "shop" } };
  }
  if (action === "payouts") {
    const fee = feeFor(u);
    const lines = [];
    if (!u.stripe_account) lines.push("Payouts: not set up. Open Shop → Set up payouts to start.");
    else if (!u.stripe_ready) lines.push("Payouts: Stripe still needs something from you (ID or bank details). Open Shop → Payouts to finish.");
    else lines.push(`Payouts: ready${u.stripe_kind === "express_stripe" ? " · Stripe pays you out and takes the card fee" : u.stripe_kind === "express" ? " · LABS carries the card fee" : " · your own Stripe account"}.`);
    const owed = db.prepare(`SELECT COUNT(*) n, COALESCE(SUM(amount_cents),0) c FROM orders WHERE seller_id = ? AND status = 'paid'`).get(u.id);
    if (owed.n) lines.push(`${owed.n} paid order${owed.n === 1 ? "" : "s"} (${echoMoney(owed.c)}) waiting for you to ship.`);
    lines.push(`Your fee: ${fee}% of the item price (${levelFor(u.rep).name}).`);
    return { title: "Getting paid", lines, go: { label: u.stripe_ready ? "Open payouts" : "Set up payouts", to: "payouts" } };
  }
  if (action === "standing") {
    const lv = levelFor(u.rep), next = LEVELS.find((l) => l.at > u.rep);
    return { title: "Your standing", lines: [`${u.rep} rep · ${lv.name}`, next ? `${next.at - u.rep} more to ${next.name}` : "You're at the top level", `Market fee at your level: ${feeFor(u)}%`], go: { label: "See the climb", to: "climb" } };
  }
  return null;
}

/* ---- one answer ---- */
const echoAllowed = (u) => !!(u && (u.is_admin || settingBool("echoOpen")));
function echoAnswer(faq, user) {
  return { faqId: faq.id, text: faq.answer, facts: faq.action ? echoFacts(faq.action, user) : null };
}
function echoAsk(user, q) {
  const asked = String(q || "").trim().slice(0, 500);
  if (!asked) return null;
  const m = echoMatch(asked);
  const kind = m.score >= ECHO_SURE ? "answer" : m.score >= ECHO_MAYBE ? "maybe" : "miss";
  const id = Number(db.prepare(`INSERT INTO echo_turns (user_id, asked, faq_id, kind, score, created_at) VALUES (?,?,?,?,?,?)`).run(user.id, asked, kind === "answer" ? m.best.id : null, kind, m.score, Date.now()).lastInsertRowid);
  const turn = { id, asked, kind, createdAt: Date.now() };
  if (kind === "answer") Object.assign(turn, echoAnswer(m.best, user), { suggestions: m.alts.slice(0, 2).map((f) => ({ id: f.id, question: f.question })) });
  else if (kind === "maybe") Object.assign(turn, { text: "I'm not sure I got that. Did you mean one of these?", suggestions: [m.best, ...m.alts].filter(Boolean).slice(0, 3).map((f) => ({ id: f.id, question: f.question })) });
  else Object.assign(turn, { text: "I don't know that one yet — I'm still learning. Try asking another way, pick a topic, or hand this to a person and the LABS team will reply by email.", suggestions: [] });
  return turn;
}
const echoTurnOf = (id, userId) => db.prepare(`SELECT * FROM echo_turns WHERE id = ? AND user_id = ?`).get(id, userId);
const echoTopics = () => db.prepare(`SELECT id, question, topic FROM echo_faq WHERE enabled = 1 ORDER BY weight DESC, id`).all();

app.get("/api/echo", auth, (req, res) => {
  if (!echoAllowed(req.user)) return res.status(403).json({ error: "Echo isn't open yet" });
  const faqs = new Map(echoLive().map((f) => [f.id, f]));
  const turns = db.prepare(`SELECT * FROM echo_turns WHERE user_id = ? ORDER BY id DESC LIMIT 40`).all(req.user.id).reverse().map((t) => {
    const shown = t.picked ? faqs.get(t.picked) : t.faq_id ? faqs.get(t.faq_id) : null;
    const base = { id: t.id, asked: t.asked, kind: shown ? "answer" : t.kind, helpful: t.helpful, createdAt: t.created_at, suggestions: [] };
    return shown ? { ...base, ...echoAnswer(shown, req.user) } : { ...base, text: t.kind === "maybe" ? "I wasn't sure what you meant." : "I didn't know that one." };
  });
  const starters = echoTopics().filter((f) => ["post", "sell", "stripe", "orders", "standing", "returns"].some((k) => f.question.toLowerCase().includes(k === "stripe" ? "payout" : k === "standing" ? "rep" : k === "orders" ? "order" : k))).slice(0, 5);
  res.json({ name: "Echo", hello: `Hi${req.user.display_name ? " " + req.user.display_name.split(" ")[0] : ""} — I'm Echo, LABS's help. Ask me anything about posting, selling, getting paid or your account. I can see your own orders and shop, nobody else's.`,
    preview: !settingBool("echoOpen"), topics: ECHO_TOPICS, starters: starters.map((f) => ({ id: f.id, question: f.question })), turns });
});
app.post("/api/echo/ask", auth, rateLimit({ max: 30, windowMs: 60000, key: "user" }), (req, res) => {
  if (!echoAllowed(req.user)) return res.status(403).json({ error: "Echo isn't open yet" });
  const turn = echoAsk(req.user, (req.body || {}).q);
  if (!turn) return res.status(400).json({ error: "Ask something" });
  res.json({ turn });
});
app.post("/api/echo/turns/:id/helpful", auth, (req, res) => {
  const t = echoTurnOf(+req.params.id, req.user.id); if (!t) return res.status(404).json({ error: "no such turn" });
  const yes = !!(req.body || {}).helpful, faqId = t.picked || t.faq_id;
  db.prepare(`UPDATE echo_turns SET helpful = ? WHERE id = ?`).run(yes ? 1 : 0, t.id);
  if (faqId && t.helpful == null) db.prepare(`UPDATE echo_faq SET weight = MAX(-0.3, MIN(0.3, weight + ?)), updated_at = ? WHERE id = ?`).run(yes ? 0.02 : -0.03, Date.now(), faqId);
  res.json({ ok: true });
});
/* "I meant this one": the answer is shown, and the asked words join that
   answer's learned phrasings — next time the same words land straight on it. */
function echoLearn(faqId, asked) {
  const f = db.prepare(`SELECT learned FROM echo_faq WHERE id = ?`).get(faqId); if (!f) return;
  const have = echoWords(f.learned), add = [...echoWords(asked)].filter((w) => !have.has(w));
  if (!add.length) return;
  const learned = (f.learned + " " + add.join(" ")).trim().slice(-600);
  db.prepare(`UPDATE echo_faq SET learned = ?, updated_at = ? WHERE id = ?`).run(learned, Date.now(), faqId);
}
app.post("/api/echo/turns/:id/pick", auth, (req, res) => {
  const t = echoTurnOf(+req.params.id, req.user.id); if (!t) return res.status(404).json({ error: "no such turn" });
  const faq = db.prepare(`SELECT * FROM echo_faq WHERE id = ? AND enabled = 1`).get(+(req.body || {}).faqId); if (!faq) return res.status(404).json({ error: "no such answer" });
  db.prepare(`UPDATE echo_turns SET picked = ? WHERE id = ?`).run(faq.id, t.id);
  if (t.kind !== "answer" || t.faq_id !== faq.id) echoLearn(faq.id, t.asked);
  res.json({ turn: { id: t.id, asked: t.asked, kind: "answer", createdAt: t.created_at, suggestions: [], ...echoAnswer(faq, req.user) } });
});
app.post("/api/echo/handoff", auth, rateLimit({ max: 3, windowMs: 3600000, key: "user" }), async (req, res) => {
  if (!echoAllowed(req.user)) return res.status(403).json({ error: "Echo isn't open yet" });
  const note = String((req.body || {}).note || "").trim().slice(0, 1000);
  const turns = db.prepare(`SELECT asked, kind, faq_id, picked FROM echo_turns WHERE user_id = ? ORDER BY id DESC LIMIT 12`).all(req.user.id).reverse();
  const names = new Map(db.prepare(`SELECT id, question FROM echo_faq`).all().map((f) => [f.id, f.question]));
  const transcript = turns.map((t) => `@${req.user.username}: ${t.asked}\nEcho: ${names.get(t.picked || t.faq_id) || (t.kind === "maybe" ? "(wasn't sure)" : "(didn't know)")}`).join("\n");
  const id = Number(db.prepare(`INSERT INTO echo_handoffs (user_id, note, transcript, created_at) VALUES (?,?,?,?)`).run(req.user.id, note, transcript, Date.now()).lastInsertRowid);
  const lines = [`From @${req.user.username} (${req.user.email})`, note ? `They say: ${note}` : "No note — see the conversation.", ...transcript.split("\n")];
  try { await sendAlertEmail(SUPPORT_EMAIL, `Echo handoff from @${req.user.username}`, "Someone needs a person", lines, (process.env.PUBLIC_URL || "https://tnllabs.com").trim().replace(/\/+$/, "") + "/admin#echo"); } catch (e) {}
  res.json({ ok: true, id, text: "Done — the LABS team has this conversation and will reply to " + req.user.email + "." });
});

/* ---- Admin → Echo: what it's asked, what it missed, what it knows ---- */
app.get("/api/admin/echo", auth, admin, (req, res) => {
  const days = Math.min(365, Math.max(1, +req.query.days || 30)), since = Date.now() - days * 86400000;
  const n = (sql, ...p) => Number(db.prepare(sql).get(...p).n) || 0;
  const asked = n(`SELECT COUNT(*) n FROM echo_turns WHERE created_at > ?`, since);
  const answered = n(`SELECT COUNT(*) n FROM echo_turns WHERE created_at > ? AND (kind = 'answer' OR picked IS NOT NULL)`, since);
  const rated = n(`SELECT COUNT(*) n FROM echo_turns WHERE created_at > ? AND helpful IS NOT NULL`, since);
  const liked = n(`SELECT COUNT(*) n FROM echo_turns WHERE created_at > ? AND helpful = 1`, since);
  const people = n(`SELECT COUNT(DISTINCT user_id) n FROM echo_turns WHERE created_at > ?`, since);
  /* what it missed: the same words asked by several people fold into one line */
  const missRows = db.prepare(`SELECT asked, kind, helpful, created_at FROM echo_turns WHERE created_at > ? AND ((kind != 'answer' AND picked IS NULL) OR helpful = 0) ORDER BY id DESC LIMIT 400`).all(since);
  const groups = new Map();
  for (const r of missRows) { const k = [...echoWords(r.asked)].sort().join(" ") || r.asked.toLowerCase(); const g = groups.get(k) || { asked: r.asked, n: 0, last: 0, why: r.helpful === 0 ? "unhelpful" : r.kind }; g.n++; g.last = Math.max(g.last, r.created_at); groups.set(k, g); }
  const missed = [...groups.values()].sort((a, b) => b.n - a.n || b.last - a.last).slice(0, 60);
  const faq = db.prepare(`SELECT f.*, (SELECT COUNT(*) FROM echo_turns t WHERE (t.faq_id = f.id OR t.picked = f.id) AND t.created_at > ?) asked, (SELECT COUNT(*) FROM echo_turns t WHERE (t.faq_id = f.id OR t.picked = f.id) AND t.helpful = 1 AND t.created_at > ?) liked, (SELECT COUNT(*) FROM echo_turns t WHERE (t.faq_id = f.id OR t.picked = f.id) AND t.helpful = 0 AND t.created_at > ?) disliked FROM echo_faq f ORDER BY asked DESC, f.id`).all(since, since, since);
  const handoffs = db.prepare(`SELECT h.*, u.username, u.email FROM echo_handoffs h JOIN users u ON u.id = h.user_id ORDER BY (h.status = 'open') DESC, h.id DESC LIMIT 50`).all();
  res.json({ days, open: settingBool("echoOpen"), topics: ECHO_TOPICS, actions: ECHO_ACTIONS, numbers: { asked, answered, rated, liked, people }, missed, faq, handoffs });
});
function echoFaqBody(b) {
  const question = String(b.question || "").trim().slice(0, 200), answer = String(b.answer || "").trim().slice(0, 2000);
  const keywords = String(b.keywords || "").trim().slice(0, 400), topic = ECHO_TOPICS.includes(b.topic) ? b.topic : "", action = ECHO_ACTIONS.includes(b.action) ? b.action : "";
  return { question, answer, keywords, topic, action };
}
app.post("/api/admin/echo/faq", auth, admin, (req, res) => {
  const f = echoFaqBody(req.body || {});
  if (!f.question || !f.answer) return res.status(400).json({ error: "A question and an answer, please" });
  const id = Number(db.prepare(`INSERT INTO echo_faq (question, answer, keywords, topic, action, created_at, updated_at) VALUES (?,?,?,?,?,?,?)`).run(f.question, f.answer, f.keywords, f.topic, f.action, Date.now(), Date.now()).lastInsertRowid);
  console.log(`[echo] @${req.user.username} taught: ${f.question}`);
  res.json({ ok: true, id });
});
app.patch("/api/admin/echo/faq/:id", auth, admin, (req, res) => {
  const cur = db.prepare(`SELECT * FROM echo_faq WHERE id = ?`).get(+req.params.id); if (!cur) return res.status(404).json({ error: "no such answer" });
  const b = req.body || {}, f = echoFaqBody({ ...cur, ...b });
  if (!f.question || !f.answer) return res.status(400).json({ error: "A question and an answer, please" });
  db.prepare(`UPDATE echo_faq SET question = ?, answer = ?, keywords = ?, topic = ?, action = ?, enabled = ?, learned = ?, updated_at = ? WHERE id = ?`)
    .run(f.question, f.answer, f.keywords, f.topic, f.action, "enabled" in b ? (b.enabled ? 1 : 0) : cur.enabled, b.forget ? "" : cur.learned, Date.now(), cur.id);
  res.json({ ok: true });
});
app.delete("/api/admin/echo/faq/:id", auth, admin, (req, res) => {
  res.json({ ok: db.prepare(`DELETE FROM echo_faq WHERE id = ?`).run(+req.params.id).changes > 0 });
});
app.post("/api/admin/echo/handoffs/:id/done", auth, admin, (req, res) => {
  res.json({ ok: db.prepare(`UPDATE echo_handoffs SET status = 'done', done_at = ? WHERE id = ? AND status = 'open'`).run(Date.now(), +req.params.id).changes > 0 });
});
