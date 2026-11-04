/* ================================================================
   KNOWLEDGE v1.0 — 2026-11-04. "LABS owns the memory, Claude only updates it."
   What LABS knows about itself, kept inside LABS (this database, on the
   Railway volume), not in anyone's chat: the creed, how LABS talks
   (voice), settled decisions, a glossary, notes, the blueprint sheets.
   Not the raw data — members, posts and orders already live here; this is
   the layer on top: what it means, what's decided, how LABS speaks.
   Any brain can read it: Claude through the connector today, an open-weight
   model of Jorge's later, through one plain export (JSON or text). Jorge
   sees and edits everything in Admin → Knowledge; every change is written
   down with who and when (admin_log via auditAdmin, plus the entry's own
   history, so an edit can be read back and undone).
   Nothing here ever reads messages (dm_messages, groups, the Instagram
   inbox): members wrote those to one person.
     GET    /api/admin/knowledge?kind=&q=          the entries (JSON)
     GET    /api/admin/knowledge/export?format=    json (default) | text — for any model
     GET    /api/admin/knowledge/:id/history       earlier versions
     POST   /api/admin/knowledge                   add  { kind, title, body, tags }
     PATCH  /api/admin/knowledge/:id               edit (the old version is kept) · { archived } puts it away
     POST   /api/admin/knowledge/:id/restore/:v    bring an earlier version back
   test/knowledge.test.mjs
================================================================ */
db.exec(`CREATE TABLE IF NOT EXISTS knowledge (
  id INTEGER PRIMARY KEY AUTOINCREMENT, key TEXT UNIQUE, kind TEXT NOT NULL, title TEXT NOT NULL, body TEXT NOT NULL,
  tags TEXT NOT NULL DEFAULT '', source TEXT NOT NULL DEFAULT 'admin', archived INTEGER NOT NULL DEFAULT 0,
  created_by INTEGER, updated_by INTEGER, created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL);
CREATE INDEX IF NOT EXISTS idx_knowledge_kind ON knowledge(kind, archived);
CREATE TABLE IF NOT EXISTS knowledge_history (
  id INTEGER PRIMARY KEY AUTOINCREMENT, entry_id INTEGER NOT NULL REFERENCES knowledge(id) ON DELETE CASCADE,
  kind TEXT NOT NULL, title TEXT NOT NULL, body TEXT NOT NULL, tags TEXT NOT NULL DEFAULT '',
  source TEXT NOT NULL DEFAULT 'admin', by_user INTEGER, at INTEGER NOT NULL);
CREATE INDEX IF NOT EXISTS idx_knowledge_history ON knowledge_history(entry_id, id)`);

const KNOW_KINDS = { creed: "Creed", voice: "Voice", decision: "Decisions", glossary: "Glossary", note: "Notes", sheet: "Sheets" };
const KNOW_SOURCES = ["admin", "claude", "built-in"];
/* The first entries: what's already settled in CLAUDE.md and the blueprint,
   keyed so an edit in /admin sticks (INSERT OR IGNORE) and a new build only
   adds what's missing. */
const KNOW_SEED = [
  { key: "creed", kind: "creed", title: "The creed", body: "We're not here to take part. We're here to take over.\nCultivators.", tags: "creed cultivators" },
  { key: "what-labs-is", kind: "creed", title: "What LABS is", body: "Social media by creatives, for creatives. Creatives post their work, find each other across scenes, make things together and sell what they make. Standing is earned only from what other people do with your work, so the people who build the most rise, not the people who post the most.", tags: "about" },
  { key: "voice-plain", kind: "voice", title: "Plain words", body: "LABS talks in plain words: what changed for members, not file names. Short sentences. Say what to do and where to tap. No jargon, no hype. Never \"Loading…\" — show the shape of what's coming.", tags: "voice writing" },
  { key: "voice-its-labs", kind: "voice", title: "It's LABS", body: "Everything members, buyers, link previews, emails and the admin read says LABS — never the three-letter parent brand, which is a separate brand of its own. Code names, the tnllabs.com domain and @handles stay as they are. Sellers' own names are theirs: Jorge's clothing shop sells on LABS under the parent brand's name.", tags: "voice naming brand" },
  { key: "voice-look", kind: "voice", title: "How LABS looks", body: "Helvetica. // marks the labs (// Music). White, black and green: true white by day, black by night, Reagent green #98FC68 as the one accent, each member in their own colour. Soft, not boxy: cards round to 16px; photo grids and an opened post stay square — a post is a post. Icons are drawn, 2px stroke, square caps. Mobile first.", tags: "design look" },
  { key: "decide-rep", kind: "decision", title: "Rep only comes from other people", body: "Rep is earned only from what other people do with your work — likes, shares, collabs both sides confirm, completed sales. Every point is written to the append-only rep_events log. Never self-awarded. Listing or posting earns nothing on its own.", tags: "rep standing levels" },
  { key: "decide-showroom", kind: "decision", title: "The Showroom ranking is not explained", body: "The Showroom ranking (RANK) is the one place feed order is decided. Nothing in the app explains it to members and nothing needs to. Views are a ranking signal only — never shown, never a count on a post. Your own taps never count; work made together gets a lift; a clique can't carry a piece.", tags: "showroom ranking views" },
  { key: "decide-collabs", kind: "decision", title: "Collabs count once accepted", body: "A collab counts only once the other person accepts — then it counts for both. An invite alone counts for nothing.", tags: "collabs" },
  { key: "decide-ids", kind: "decision", title: "Lab and channel IDs never change", body: "Lab and channel IDs never change; names are display-only. Labs are places, one per genre, each explained by its #tags: Work · Talk, no sub-channels on screen.", tags: "labs" },
  { key: "decide-instagram", kind: "decision", title: "Instagram is for reach, votes count in the app", body: "Instagram is where people find LABS; every share card and public page leads back into LABS, where they take part. Votes only count in the app. Most visitors arrive inside Instagram's in-app browser, so every share or save flow has to work there.", tags: "instagram tournament sharing" },
  { key: "decide-fees", kind: "decision", title: "Fees fall with standing; admins sell at 0%", body: "The platform fee is on the item price, never on shipping: 10% at Entry, 8% Verified, 6% Collaborator, 4% Core, 2% Leadership. An admin selling on the app pays 0% — a fee that goes back to Jorge makes no sense.", tags: "market fees levels" },
  { key: "decide-private", kind: "decision", title: "Messages are private, and never training data", body: "DMs and group chats are never read by any tool, never exported, never trained on: members wrote them to one person. Members' public work is not AI training data either (robots.txt turns the training crawlers away; every response says noai). Any future training on public LABS content needs the privacy page to say so, with an opt-out, first.", tags: "privacy ai messages" },
  { key: "decide-no-outside-ai", kind: "decision", title: "LABS owns the memory", body: "LABS's own AI starts as a chatbot (Echo) that keeps learning, admin-only while it's perfected. The knowledge lives inside LABS — this table — and Claude only updates it. If Claude goes away, the knowledge stays. Any brain can read it through the export; the same export becomes the fine-tuning set later. No new outside service without asking Jorge first.", tags: "ai echo knowledge" },
  { key: "g-lab", kind: "glossary", title: "Lab", body: "A place, one per genre: // General, // Visual, // Music, // Fashion, // Anime, // News, // Business. Inside: Work (everything made there, by #tag) and Talk (one conversation).", tags: "labs" },
  { key: "g-rep", kind: "glossary", title: "Rep", body: "Standing. Points earned only from what other people do with your work. Levels: Entry (0) → Verified (40) → Collaborator (120) → Core (280) → Leadership (560). Each level lowers your Market fee; at Core, LABS can cover your music's distribution.", tags: "rep levels standing" },
  { key: "g-showroom", kind: "glossary", title: "Showroom", body: "The front page: real work from every lab, ranked by what other people do with it. On a computer it's a gallery wall — one piece in the spotlight.", tags: "showroom" },
  { key: "g-cultivators", kind: "glossary", title: "Cultivators", body: "What LABS calls its people. Artists, designers, musicians, entrepreneurs. Creatives don't just meet here — they multiply.", tags: "creed cultivators" },
  { key: "g-collab", kind: "glossary", title: "Collab", body: "Work made together. Two-sided: the author invites, the other person accepts, and only then does it count — for both of them.", tags: "collabs" },
  { key: "g-market", kind: "glossary", title: "Market", body: "One shared market for what members make. Listings with photos, pricing, sizes and colours, inventory and shipping. Offers, saves, one checkout per seller through Stripe Connect, delivery confirmation and reviews.", tags: "market" },
  { key: "g-tournament", kind: "glossary", title: "The tournament", body: "One prompt, one entry each, fresh votes every day with a live scoreboard that goes dark for the last hours, then a final. tickEvent() is the only thing that moves an event forward.", tags: "tournament events" },
  { key: "g-echo", kind: "glossary", title: "Echo", body: "LABS's help, pinned at the top of Messages. Answers from what it's been taught, looks up the asking member's own account, learns from thumbs and from what the admin teaches it. No outside AI. Admins only until the switch.", tags: "echo ai help" },
  { key: "g-door", kind: "glossary", title: "The door", body: "\"Enter the lab\" — the landing with the vial loader. One tap in, every visit; it also unlocks audio on iOS. A link from outside lands on the exact thing it pointed at.", tags: "door landing" },
];
const knowSeed = db.prepare(`INSERT OR IGNORE INTO knowledge (key, kind, title, body, tags, source, created_at, updated_at) VALUES (?,?,?,?,?,'built-in',?,?)`);
for (const k of KNOW_SEED) knowSeed.run(k.key, k.kind, k.title, k.body, k.tags, Date.now(), Date.now());

const knowClean = (b) => ({
  kind: KNOW_KINDS[b.kind] ? b.kind : "",
  title: String(b.title || "").trim().slice(0, 160),
  body: String(b.body || "").trim().slice(0, 20000),
  tags: String(b.tags || "").toLowerCase().replace(/[^a-z0-9#\s,-]/g, " ").split(/[\s,]+/).filter(Boolean).slice(0, 20).join(" "),
});
const knowRow = (r) => ({ id: r.id, key: r.key, kind: r.kind, title: r.title, body: r.body, tags: r.tags, source: r.source, archived: !!r.archived,
  createdBy: r.created_by_name || "", updatedBy: r.updated_by_name || (r.source === "built-in" && !r.updated_by ? "LABS" : ""), createdAt: r.created_at, updatedAt: r.updated_at });
const knowSelect = `SELECT k.*, c.username created_by_name, u.username updated_by_name FROM knowledge k LEFT JOIN users c ON c.id = k.created_by LEFT JOIN users u ON u.id = k.updated_by`;
function knowList({ kind = "", q = "", archived = false } = {}) {
  const where = [archived ? "k.archived = 1" : "k.archived = 0"], p = [];
  if (KNOW_KINDS[kind]) { where.push("k.kind = ?"); p.push(kind); }
  if (q) { where.push("(k.title LIKE ? OR k.body LIKE ? OR k.tags LIKE ?)"); const like = "%" + q.replace(/[%_]/g, "") + "%"; p.push(like, like, like); }
  return db.prepare(`${knowSelect} WHERE ${where.join(" AND ")} ORDER BY k.kind, k.id`).all(...p).map(knowRow);
}
/* One plain text for any model: the kinds in order, each entry as a heading
   and its body. Same shape every time, so it can be diffed and fed as-is. */
function knowText(rows) {
  const out = ["# LABS — what it knows about itself", `Exported ${new Date().toISOString().slice(0, 10)} · ${rows.length} entries`, ""];
  for (const [kind, name] of Object.entries(KNOW_KINDS)) {
    const here = rows.filter((r) => r.kind === kind); if (!here.length) continue;
    out.push(`## ${name}`, "");
    for (const r of here) out.push(`### ${r.title}`, r.body, r.tags ? `(${r.tags})` : "", "");
  }
  return out.join("\n");
}
/* Every change keeps the version before it: what it said, who wrote that, when. */
function knowRemember(entry, byUser) {
  db.prepare(`INSERT INTO knowledge_history (entry_id, kind, title, body, tags, source, by_user, at) VALUES (?,?,?,?,?,?,?,?)`)
    .run(entry.id, entry.kind, entry.title, entry.body, entry.tags, entry.source, entry.updated_by ?? entry.created_by ?? null, entry.updated_at);
}
function knowAdd(b, byUser, source = "admin") {
  const f = knowClean(b);
  if (!f.kind || !f.title || !f.body) return { error: "A kind, a title and the words, please" };
  const id = Number(db.prepare(`INSERT INTO knowledge (kind, title, body, tags, source, created_by, updated_by, created_at, updated_at) VALUES (?,?,?,?,?,?,?,?,?)`)
    .run(f.kind, f.title, f.body, f.tags, KNOW_SOURCES.includes(source) ? source : "admin", byUser, byUser, Date.now(), Date.now()).lastInsertRowid);
  return { id };
}
function knowEdit(id, b, byUser, source = "admin") {
  const cur = db.prepare(`SELECT * FROM knowledge WHERE id = ?`).get(id); if (!cur) return { error: "No such entry" };
  const f = knowClean({ ...cur, ...b });
  if (!f.kind || !f.title || !f.body) return { error: "A kind, a title and the words, please" };
  const archived = "archived" in b ? (b.archived ? 1 : 0) : cur.archived;
  const changed = f.kind !== cur.kind || f.title !== cur.title || f.body !== cur.body || f.tags !== cur.tags;
  if (changed) knowRemember(cur, byUser);
  if (changed || archived !== cur.archived) db.prepare(`UPDATE knowledge SET kind = ?, title = ?, body = ?, tags = ?, archived = ?, source = ?, updated_by = ?, updated_at = ? WHERE id = ?`)
    .run(f.kind, f.title, f.body, f.tags, archived, changed && KNOW_SOURCES.includes(source) ? source : cur.source, byUser, Date.now(), id);
  return { ok: true, changed };
}

app.get("/api/admin/knowledge", auth, admin, (req, res) => {
  res.json({ kinds: KNOW_KINDS, entries: knowList({ kind: String(req.query.kind || ""), q: String(req.query.q || "").slice(0, 80), archived: req.query.archived === "1" }) });
});
app.get("/api/admin/knowledge/export", auth, admin, (req, res) => {
  const rows = knowList();
  res.set("Cache-Control", "private, no-store");
  if (req.query.format === "text") { res.type("text/plain; charset=utf-8"); return res.send(knowText(rows)); }
  res.json({ app: "LABS", exportedAt: Date.now(), kinds: KNOW_KINDS, entries: rows.map(({ id, kind, title, body, tags, updatedAt }) => ({ id, kind, title, body, tags, updatedAt })) });
});
app.get("/api/admin/knowledge/:id/history", auth, admin, (req, res) => {
  const rows = db.prepare(`SELECT h.*, u.username by_name FROM knowledge_history h LEFT JOIN users u ON u.id = h.by_user WHERE h.entry_id = ? ORDER BY h.id DESC LIMIT 50`).all(+req.params.id);
  res.json({ history: rows.map((h) => ({ version: h.id, kind: h.kind, title: h.title, body: h.body, tags: h.tags, source: h.source, by: h.by_name || (h.source === "built-in" ? "LABS" : ""), at: h.at })) });
});
app.post("/api/admin/knowledge", auth, admin, (req, res) => {
  const r = knowAdd(req.body || {}, req.user.id);
  if (r.error) return res.status(400).json(r);
  res.json({ ok: true, id: r.id });
});
app.patch("/api/admin/knowledge/:id", auth, admin, (req, res) => {
  const r = knowEdit(+req.params.id, req.body || {}, req.user.id);
  if (r.error) return res.status(404).json(r);
  res.json(r);
});
app.post("/api/admin/knowledge/:id/restore/:v", auth, admin, (req, res) => {
  const h = db.prepare(`SELECT * FROM knowledge_history WHERE id = ? AND entry_id = ?`).get(+req.params.v, +req.params.id);
  if (!h) return res.status(404).json({ error: "No such version" });
  res.json(knowEdit(h.entry_id, { kind: h.kind, title: h.title, body: h.body, tags: h.tags }, req.user.id));
});
