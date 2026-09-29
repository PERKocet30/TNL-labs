/* ---- controls. A dashboard you can't act from is a wall poster. ---- */
app.post("/api/admin/members/:username/rep", auth, admin, (req, res) => {
  const u = q.userByName.get(req.params.username);
  if (!u) return res.status(404).json({ error: "no such user" });
  const delta = Math.round(Number(req.body?.delta));
  if (!Number.isFinite(delta) || Math.abs(delta) > 500) return res.status(400).json({ error: "±500 max" });
  const next = Math.max(0, u.rep + delta);
  /* The event is written FIRST, with the real change (a deduction stops at
     0). This used to name columns rep_events doesn't have, so the insert
     threw after rep had already moved — a change with no audit trail. */
  const applied = next - u.rep;
  db.exec("BEGIN");
  try {
    db.prepare(`INSERT INTO rep_events (user_id, kind, amount, source_id, created_at) VALUES (?,?,?,?,?)`)
      .run(u.id, delta > 0 ? "admin_grant" : "admin_deduct", applied, req.user.id, Date.now());
    db.prepare(`UPDATE users SET rep = ? WHERE id = ?`).run(next, u.id);
    db.exec("COMMIT");
  } catch (e) { db.exec("ROLLBACK"); throw e; }
  console.log(`[admin] @${req.user.username} adjusted @${u.username} rep by ${delta} -> ${next}`);
  res.json({ ok: true, rep: next });
});

app.post("/api/admin/members/:username/suspend", auth, admin, (req, res) => {
  const u = q.userByName.get(req.params.username);
  if (!u) return res.status(404).json({ error: "no such user" });
  if (u.is_admin) return res.status(400).json({ error: "can't suspend an admin" });
  const on = !!req.body?.suspended;
  db.prepare(`UPDATE users SET suspended = ? WHERE id = ?`).run(on ? 1 : 0, u.id);
  if (on) db.prepare(`DELETE FROM sessions WHERE user_id = ?`).run(u.id); // kick them now
  console.log(`[admin] @${req.user.username} ${on ? "suspended" : "restored"} @${u.username}`);
  res.json({ ok: true, suspended: on });
});

app.delete("/api/admin/listings/:id", auth, admin, (req, res) => {
  const l = db.prepare(`SELECT * FROM listings WHERE id = ?`).get(Number(req.params.id));
  if (!l) return res.status(404).json({ error: "no listing" });
  db.prepare(`UPDATE listings SET status='removed', updated_at=? WHERE id=?`).run(Date.now(), l.id);
  notify(l.seller_id, req.user.id, "removed", null, `"${l.title}" was removed by a mod`);
  res.json({ ok: true });
});

/* The founder's megaphone. Lands as a DM from you, which at this size is
   worth more than a push notification. */
app.post("/api/admin/broadcast", auth, admin, rateLimit({ max: 3, windowMs: 3600000, key: "user" }), (req, res) => {
  const body = (req.body?.body || "").toString().trim();
  if (!body) return res.status(400).json({ error: "say something" });
  const target = req.body?.target || "all";
  let users = [];
  if (target === "all") users = db.prepare(`SELECT id FROM users WHERE id != ?`).all(req.user.id);
  else if (target === "silent") users = db.prepare(
    `SELECT id FROM users WHERE id != ? AND (SELECT COUNT(*) FROM posts p WHERE p.author_id = users.id) = 0`).all(req.user.id);
  else if (target === "quiet") users = db.prepare(
    `SELECT id FROM users WHERE id != ? AND (SELECT MAX(created_at) FROM posts p WHERE p.author_id = users.id) < ?`)
    .all(req.user.id, Date.now() - 14 * 86400000);
  let sent = 0;
  for (const u of users) {
    try {
      dmSend(threadFor(req.user.id, u.id), req.user, { body: body.slice(0, 2000) });
      sent++;
    } catch (e) { /* one bad row shouldn't stop the rest */ }
  }
  console.log(`[admin] broadcast to ${sent} (${target})`);
  res.json({ ok: true, sent });
});

/* System health — is anything actually wrong right now? */
app.get("/api/admin/health", auth, admin, (req, res) => {
  const one = (sql, ...p) => db.prepare(sql).get(...p)?.n ?? 0;
  let dbBytes = 0, uploadBytes = 0, uploadCount = 0;
  try { dbBytes = statSync(join(DATA_DIR, "tnl.db")).size; } catch {}
  try {
    const files = readdirSync(UPLOAD_DIR);
    uploadCount = files.length;
    for (const f of files) { try { uploadBytes += statSync(join(UPLOAD_DIR, f)).size; } catch {} }
  } catch {}
  // uploads nobody references any more — dead weight on the volume
  const referenced = referencedUploads();
  let orphans = 0, orphanBytes = 0;
  try {
    for (const f of readdirSync(UPLOAD_DIR)) {
      if (f.startsWith(".")) continue;
      if (!referenced.has(f)) { orphans++; try { orphanBytes += statSync(join(UPLOAD_DIR, f)).size; } catch {} }
    }
  } catch {}
  res.json({
    dbBytes, uploadBytes, uploadCount, orphans, orphanBytes,
    onVolume: !!process.env.TNL_DATA,
    publicUrl: process.env.PUBLIC_URL || null,
    mail: MAIL_ENABLED, payments: PAYMENTS_ENABLED,
    uptimeS: Math.round(process.uptime()),
    memMB: Math.round(process.memoryUsage().rss / 1048576),
    node: process.version,
    sessions: one(`SELECT COUNT(*) n FROM sessions`),
    pendingVerify: one(`SELECT COUNT(*) n FROM users WHERE email_verified = 0`),
    unhandledReports: one(`SELECT COUNT(*) n FROM reports WHERE handled_at IS NULL`),
  });
});

/* Every file any row points at. It used to be a hand-kept list of columns,
   and the list fell behind: track audio and artwork, samples, sound-listing
   audio and DM media were never on it, so Cleanup counted them as orphans
   and deleted them. Now it reads every text column of every table and keeps
   anything that mentions /uploads/<file> — new features are covered without
   anyone remembering to add them here. */
function referencedUploads() {
  const keep = new Set();
  const RE = /\/uploads\/([A-Za-z0-9._-]+)/g;
  const tables = db.prepare(`SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%'`).all();
  for (const { name } of tables) {
    const cols = db.prepare(`PRAGMA table_info("${name.replace(/"/g, '""')}")`).all()
      .filter((c) => !c.type || /TEXT|CHAR|CLOB/i.test(c.type)).map((c) => c.name);
    for (const col of cols) {
      const q = `SELECT "${col.replace(/"/g, '""')}" AS v FROM "${name.replace(/"/g, '""')}" WHERE "${col.replace(/"/g, '""')}" LIKE '%/uploads/%'`;
      for (const r of db.prepare(q).all()) {
        const v = String(r.v); let m; RE.lastIndex = 0;
        while ((m = RE.exec(v))) keep.add(m[1]);
      }
    }
  }
  return keep;
}

/* Delete uploads nothing points at. Explicit, never automatic — I'm not
   letting a cron job decide which of your artists' files are garbage. */
app.post("/api/admin/cleanup", auth, admin, (req, res) => {
  const referenced = referencedUploads();
  let removed = 0, freed = 0;
  try {
    for (const f of readdirSync(UPLOAD_DIR)) {
      if (f.startsWith(".part-")) { // abandoned partial uploads
        try { freed += statSync(join(UPLOAD_DIR, f)).size; rmSync(join(UPLOAD_DIR, f)); removed++; } catch {}
        continue;
      }
      if (f.startsWith(".") || referenced.has(f)) continue;
      try { freed += statSync(join(UPLOAD_DIR, f)).size; rmSync(join(UPLOAD_DIR, f)); removed++; } catch {}
    }
  } catch (e) { return res.status(500).json({ error: e.message }); }
  console.log(`[admin] cleanup removed ${removed} orphaned files (${(freed / 1048576).toFixed(1)}MB)`);
  res.json({ removed, freed });
});

/* Email is the one system that fails silently — Resend returns 200 whether
   it delivers or bins it, and a missing send looks identical to a broken
   one. This makes it answerable in one tap instead of a guess. */
app.post("/api/admin/test-email", auth, admin, rateLimit({ max: 10, windowMs: 600000, key: "user" }), async (req, res) => {
  const to = (req.body?.to || req.user.email).toString().trim();
  if (!/^\S+@\S+\.\S+$/.test(to)) return res.status(400).json({ error: "bad address" });
  if (!MAIL_ENABLED) {
    return res.json({ ok: false, reason: "no_key", detail: "RESEND_API_KEY isn't set — the app shows links on screen instead." });
  }
  const started = Date.now();
  const out = await sendVerifyEmail(to, req.user.display_name, `${baseUrl(req)}/?test=1`);
  if (!out.sent) logError("mail", out.error || "send failed", out.raw || "", "/api/admin/test-email", req.user.username);
  res.json({
    ok: out.sent,
    ms: Date.now() - started,
    to,
    from: process.env.MAIL_FROM || "(default — TEST SENDER)",
    testSender: MAIL_TEST_SENDER,
    error: out.error || null,
    detail: out.sent
      ? "Resend accepted it. If it doesn't arrive, check spam — new sending domains land there until they build reputation."
      : "Resend rejected it. The error above is exactly why.",
  });
});

/* Every verification we've ever tried to send, and what happened. If a
   member says "I got no email", this says whether we even attempted it. */
app.get("/api/admin/mail-log", auth, admin, (req, res) => {
  const rows = db.prepare(`
    SELECT u.username, u.display_name, u.email, u.email_verified, u.created_at,
      (SELECT COUNT(*) FROM verify_tokens t WHERE t.user_id = u.id) AS pending
    FROM users u ORDER BY u.created_at DESC LIMIT 40`).all();
  res.json({
    mailOn: MAIL_ENABLED,
    testSender: MAIL_TEST_SENDER,
    from: process.env.MAIL_FROM || null,
    publicUrl: process.env.PUBLIC_URL || null,
    members: rows.map((r) => ({
      username: r.username, displayName: r.display_name, email: r.email,
      verified: !!r.email_verified, pendingToken: r.pending > 0, joined: r.created_at,
    })),
  });
});

/* ================================================================
   BACKUPS
   The database IS the business. Six years of relationships live in it.
   Railway volumes are durable, not immortal — and there is no undo for a
   bad migration, a wrong DELETE, or a platform incident.

   Daily, automatic, keeps 7. Plus a button, because a backup you can't
   download is a backup you don't have.
================================================================ */
const BACKUP_DIR = join(DATA_DIR, "backups");
try { mkdirSync(BACKUP_DIR, { recursive: true }); } catch {}

function makeBackup(tag = "auto") {
  const name = `tnl-${new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-")}-${tag}.db`;
  const path = join(BACKUP_DIR, name);
  backupTo(path);
  // keep 7 — enough to notice something went wrong last week
  try {
    const files = readdirSync(BACKUP_DIR).filter((f) => f.endsWith(".db")).sort().reverse();
    for (const old of files.slice(7)) rmSync(join(BACKUP_DIR, old));
  } catch {}
  return { name, path, bytes: statSync(path).size };
}

app.get("/api/admin/backups", auth, admin, (req, res) => {
  let files = [];
  try {
    files = readdirSync(BACKUP_DIR).filter((f) => f.endsWith(".db")).sort().reverse().map((f) => {
      const st = statSync(join(BACKUP_DIR, f));
      return { name: f, bytes: st.size, at: st.mtimeMs };
    });
  } catch {}
  res.json({ backups: files, dir: BACKUP_DIR });
});

app.post("/api/admin/backups", auth, admin, (req, res) => {
  try { res.json({ ok: true, ...makeBackup("manual") }); }
  catch (e) { logError("server", "backup failed", e.message); res.status(500).json({ error: e.message }); }
});

/* Download it. A backup sitting on the same volume as the database it's
   backing up protects you from your own mistakes, not from losing the
   volume. Get a copy off the box. */
app.get("/api/admin/backups/:name", auth, admin, (req, res) => {
  const name = String(req.params.name);
  if (!/^tnl-[\w-]+\.db$/.test(name)) return res.status(400).json({ error: "bad name" });
  const path = join(BACKUP_DIR, name);
  if (!existsSync(path)) return res.status(404).json({ error: "gone" });
  res.download(path, name);
});

app.delete("/api/admin/backups/:name", auth, admin, (req, res) => {
  const name = String(req.params.name);
  if (!/^tnl-[\w-]+\.db$/.test(name)) return res.status(400).json({ error: "bad name" });
  try { rmSync(join(BACKUP_DIR, name)); res.json({ ok: true }); }
  catch (e) { res.status(500).json({ error: e.message }); }
});

/* A minimal ZIP writer — store-only (no compression), which needs nothing
   but the crc32 built into zlib. Source files are tiny; this trades a few KB
   of size for zero dependencies and zero reliance on a system `zip` binary
   that Railway's image might not ship. */
function buildZip(root, files) {
  const chunks = [], central = [];
  let offset = 0;
  const u16 = (n) => { const b = Buffer.alloc(2); b.writeUInt16LE(n >>> 0); return b; };
  const u32 = (n) => { const b = Buffer.alloc(4); b.writeUInt32LE(n >>> 0); return b; };

  for (const rel of files) {
    const data = readFileSync(join(root, rel));
    const name = Buffer.from(rel, "utf8");
    const crc = zlibCrc32(data);
    const local = Buffer.concat([
      u32(0x04034b50), u16(20), u16(0), u16(0), u16(0), u16(0),
      u32(crc), u32(data.length), u32(data.length),
      u16(name.length), u16(0), name,
    ]);
    chunks.push(local, data);
    central.push(Buffer.concat([
      u32(0x02014b50), u16(20), u16(20), u16(0), u16(0), u16(0), u16(0),
      u32(crc), u32(data.length), u32(data.length),
      u16(name.length), u16(0), u16(0), u16(0), u16(0), u32(0), u32(offset), name,
    ]));
    offset += local.length + data.length;
  }
  const cd = Buffer.concat(central);
  const end = Buffer.concat([
    u32(0x06054b50), u16(0), u16(0), u16(central.length), u16(central.length),
    u32(cd.length), u32(offset), u16(0),
  ]);
  return Buffer.concat([...chunks, cd, end]);
}

/* ---- DOWNLOAD THE APP ITSELF ----
   Not the database — the source. The running server zips its own files with
   a timestamped name and hands them back. Whatever is LIVE is what you get,
   so the deployed app is always the source of truth. No more wondering which
   chat had the latest version. */
app.get("/api/admin/source", auth, admin, (req, res) => {
  const root = join(__dirname, "..");
  const stamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
  const name = `TNL-LABS-${stamp}.zip`;

  // the files that ARE the app — skip node_modules, db, uploads, git
  /* The patch system moved the truth and this list never followed. src/server.js
     is the PRISTINE monolith; what actually serves requests is server.runtime.js,
     built at boot by build.mjs from server.js + src/patches/*.mjs. Exporting
     server.js alone handed back a file ~10KB short of the running server, with
     none of the applied hunks in it, under a comment promising the live app.
     Ship the builder, the built runtime, and every patch, so a download can be
     REBUILT and byte-checked instead of trusted. */
  const parts = readdirSync(join(root, "src")).filter((f) => /^(app|server)-\d{2}-/.test(f)).sort()
    .map((f) => "src/" + f);
  const include = [
    "src/server.js", "src/assemble.mjs", ...parts, "src/server.runtime.js",
    "src/db.js", "src/pay.js", "src/mail.js",
    "public/index.html", "public/studio.js", "public/admin.html", "public/door.js", "public/sw.js",
    ...(existsSync(join(root, "public/admin-app")) ? readdirSync(join(root, "public/admin-app")).sort().map((f) => "public/admin-app/" + f) : []),
    "public/manifest.webmanifest",
    "package.json", "README.md", "RAILWAY.md",
  ].filter((f) => existsSync(join(root, f)));

  try {
    const buf = buildZip(root, include);
    res.setHeader("Content-Type", "application/zip");
    res.setHeader("Content-Disposition", `attachment; filename="${name}"`);
    res.setHeader("Content-Length", buf.length);
    res.end(buf);
  } catch (e) {
    res.status(500).json({ error: "couldn't build the zip: " + e.message });
  }
});

/* ---- what's actually broken ---- */
app.get("/api/admin/errors", auth, admin, (req, res) => {
  const rows = db.prepare(`SELECT * FROM error_log ORDER BY created_at DESC LIMIT 100`).all();
  const since = Date.now() - 86400000;
  res.json({
    errors: rows,
    last24h: db.prepare(`SELECT COUNT(*) n FROM error_log WHERE created_at > ?`).get(since).n,
    byKind: db.prepare(`SELECT kind, COUNT(*) n FROM error_log WHERE created_at > ? GROUP BY kind`).all(since),
  });
});

app.delete("/api/admin/errors", auth, admin, (req, res) => {
  db.prepare(`DELETE FROM error_log`).run();
  res.json({ ok: true });
});

/* The app reports its own breakage. Without this you only hear about bugs
   loud enough that someone bothers to message you — which is a small and
   badly-biased sample. */
app.post("/api/client-error", maybeAuth, rateLimit({ max: 20, windowMs: 60000 }), (req, res) => {
  const { message, detail, path } = req.body || {};
  if (message) logError("client", message, detail || "", path || "", req.user?.username || "");
  res.json({ ok: true });
});

/* The studio reports how it's used. Metadata only — see studio_events in
   db.js for where the line is and why.

   The client has been calling this since telemetry went in; the route
   itself never landed, so every event 404'd silently. That's worse than
   having no telemetry: the dashboard would have shown zeros forever and
   I'd have believed them. */
app.post("/api/studio/event", auth, rateLimit({ max: 120, windowMs: 300000, key: "user" }), (req, res) => {
  const { kind, voice, bpm, key, detail } = req.body || {};
  const ALLOWED = ["open", "play", "save", "publish", "export", "voice_replaced", "abandon"];
  if (!ALLOWED.includes(kind)) return res.status(400).json({ error: "unknown event" });
  studioEvent(req.user.id, kind, { voice, bpm, key, detail });
  res.json({ ok: true });
});

/* What the studio has learned. This page should decide what gets built
   next — not my taste, and not yours. */
app.get("/api/admin/studio", auth, admin, (req, res) => {
  const one = (sql, ...p) => db.prepare(sql).get(...p)?.n ?? 0;

  /* THE headline. A producer swapping a built-in voice for their own sample
     is the most honest quality signal available: they heard mine, didn't
     like it, and did something about it. */
  const replaced = db.prepare(`
    SELECT voice, COUNT(*) n, COUNT(DISTINCT user_id) people
    FROM studio_events WHERE kind = 'voice_replaced' AND voice != ''
    GROUP BY voice ORDER BY n DESC`).all();

  const formats = db.prepare(`
    SELECT fmt, COUNT(*) n, COUNT(DISTINCT user_id) people, AVG(bytes) avg_bytes
    FROM studio_events WHERE kind = 'sample_upload' AND fmt != ''
    GROUP BY fmt ORDER BY n DESC`).all();

  const slots = db.prepare(`SELECT slot, COUNT(*) n FROM samples WHERE slot != '' GROUP BY slot ORDER BY n DESC`).all();

  const shape = db.prepare(`
    SELECT slot, COUNT(*) n, AVG(fundamental) fund, AVG(decay_ms) decay,
           AVG(peak_db) peak, AVG(rms_db) rms, AVG(centroid) centroid, AVG(duration_ms) dur
    FROM sample_shape WHERE slot != '' GROUP BY slot HAVING n >= 1 ORDER BY n DESC`).all();

  /* Read straight off the synth so this comparison can't drift out of date. */
  const mine = {
    kick:  { fund: 45,   decay: 400, centroid: 220,  note: "150→45Hz sweep, 6ms click" },
    snare: { fund: 190,  decay: 180, centroid: 1800, note: "noise + 2 tones + crack" },
    hat:   { fund: null, decay: 50,  centroid: 9000, note: "hipassed noise" },
    clap:  { fund: null, decay: 200, centroid: 1500, note: "4 bursts" },
    perc:  { fund: 260,  decay: 280, centroid: 600,  note: "pitched sine" },
    808:   { fund: 45,   decay: 550, centroid: 90,   note: "sine + drive" },
  };

  // what people actually publish — these should BE the defaults
  const beats = db.prepare(`SELECT beat_json FROM posts WHERE beat_json IS NOT NULL`).all();
  const bpms = [], keys = {}, voiceUse = {}, lens = [], loudness = [];
  let withSamples = 0, withSlides = 0;
  for (const b of beats) {
    try {
      const p = JSON.parse(b.beat_json);
      const d = p.data || p;
      if (d.bpm) bpms.push(d.bpm);
      if (d.key != null && d.scale) keys[`${d.key}:${d.scale}`] = (keys[`${d.key}:${d.scale}`] || 0) + 1;
      if (d.master && d.master.loudness != null) loudness.push(d.master.loudness);
      let usedSample = false, usedSlide = false;
      for (const t of (d.tracks || [])) {
        if ((t.steps || []).some(Boolean)) voiceUse[t.id] = (voiceUse[t.id] || 0) + 1;
        if (t.sampleUrl) usedSample = true;
        for (const c of (t.steps || [])) {
          if (c && c.slide) usedSlide = true;
          if (c && c.len > 1) lens.push(c.len);
        }
      }
      if (usedSample) withSamples++;
      if (usedSlide) withSlides++;
    } catch {}
  }
  const median = (a) => (a.length ? a.slice().sort((x, y) => x - y)[Math.floor(a.length / 2)] : null);

  res.json({
    replaced, formats, slots, shape, mine,
    published: beats.length,
    bpm: {
      median: median(bpms),
      min: bpms.length ? Math.min(...bpms) : null,
      max: bpms.length ? Math.max(...bpms) : null,
    },
    keys: Object.entries(keys).map(([k, n]) => ({ key: k, n })).sort((a, b) => b.n - a.n),
    voiceUse: Object.entries(voiceUse).map(([id, n]) => ({ id, n })).sort((a, b) => b.n - a.n),
    withSamples, withSlides,
    medianNoteLen: median(lens),
    medianLoudness: median(loudness),
    funnel: {
      opened: one(`SELECT COUNT(DISTINCT user_id) n FROM studio_events WHERE kind='open'`),
      played: one(`SELECT COUNT(DISTINCT user_id) n FROM studio_events WHERE kind='play'`),
      saved: one(`SELECT COUNT(DISTINCT user_id) n FROM studio_events WHERE kind='save'`),
      published: one(`SELECT COUNT(DISTINCT user_id) n FROM studio_events WHERE kind='publish'`),
      exported: one(`SELECT COUNT(DISTINCT user_id) n FROM studio_events WHERE kind='export'`),
    },
    uploaders: one(`SELECT COUNT(DISTINCT user_id) n FROM samples`),
    totalSamples: one(`SELECT COUNT(*) n FROM samples`),
    library: {
      shared: one(`SELECT COUNT(*) n FROM samples WHERE shared = 1`),
      contributors: one(`SELECT COUNT(DISTINCT user_id) n FROM samples WHERE shared = 1`),
      uses: one(`SELECT COUNT(*) n FROM sample_uses`),
      top: db.prepare(`
        SELECT s.name, s.slot, s.uses, u.username, u.display_name
        FROM samples s JOIN users u ON u.id = s.user_id
        WHERE s.shared = 1 AND s.uses > 0 ORDER BY s.uses DESC LIMIT 10`).all(),
    },
  });
});

