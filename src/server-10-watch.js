/* ================================================================
   WATCH v1.0 — 2026-09-29
   Emails the admin (ADMIN_EMAIL) when something spikes, before members
   have to say so, and once a morning with yesterday in five lines.
   Reads error_log and glitch_events (server-10-glitch.js). Each rule mails
   at most once per 6 hours; the digest once a day. Needs RESEND_API_KEY —
   without it the would-be email is logged instead, like every other mail.
================================================================ */
db.exec(`CREATE TABLE IF NOT EXISTS alert_log (rule TEXT PRIMARY KEY, last_at INTEGER NOT NULL)`);
const WATCH_RULES = [
  // [rule, count query over the last hour, threshold, what it means]
  ["server_errors", "SELECT COUNT(*) n FROM error_log WHERE kind = 'server' AND created_at >= ?", 3, "server errors", "the server hit errors — some requests failed"],
  ["client_errors", "SELECT COUNT(*) n FROM error_log WHERE kind = 'client' AND created_at >= ?", 10, "app crashes on members' screens", "the app crashed on people's phones or computers"],
  ["failed_saves", "SELECT COUNT(*) n FROM glitch_events WHERE kind = 'action_failed' AND created_at >= ?", 3, "failed saves", "likes, posts or messages that didn't save"],
  ["rage_taps", "SELECT COUNT(*) n FROM glitch_events WHERE kind = 'rage_tap' AND created_at >= ?", 8, "rage taps", "people hammering a button that didn't seem to respond"],
  ["screen_jumps", "SELECT COUNT(*) n FROM glitch_events WHERE kind = 'layout_jump' AND created_at >= ?", 8, "screen jumps", "the screen moving while people read"],
  ["slow_screens", "SELECT COUNT(*) n FROM glitch_events WHERE kind = 'slow_screen' AND created_at >= ?", 8, "slow screens", "screens taking over 3 seconds to load"],
];
const GLITCH_OF = { failed_saves: "action_failed", rage_taps: "rage_tap", screen_jumps: "layout_jump", slow_screens: "slow_screen" };
const lastSent = db.prepare(`SELECT last_at FROM alert_log WHERE rule = ?`);
const markSent = db.prepare(`INSERT INTO alert_log (rule, last_at) VALUES (?, ?) ON CONFLICT(rule) DO UPDATE SET last_at = excluded.last_at`);
/* "#sr-grid moved 0.17", "…0.23" and "…0.12" are one problem, not three
   (the 2026-10-19 digest spent all three "worst spot" lines on it). The
   measurement comes off before counting and comes back as a range. Only a
   decimal at the end is a measurement — "→ 500" is a status, and stays. */
const MEASURE = /\s(\d+\.\d+)(s?)$/;
function worstSpots(since, kind, limit) {
  const rows = db.prepare(`SELECT kind, place, detail, COUNT(*) n FROM glitch_events WHERE created_at >= ?${kind ? " AND kind = ?" : ""}
    GROUP BY kind, place, detail`).all(...(kind ? [since, kind] : [since]));
  const spots = new Map();
  for (const r of rows) {
    const m = MEASURE.exec(r.detail || ""), what = m ? r.detail.slice(0, m.index) : r.detail || "";
    const k = r.kind + "|" + r.place + "|" + what;
    const s = spots.get(k) || { kind: r.kind, place: r.place, what, n: 0, lo: null, hi: null, unit: m ? m[2] : "" };
    s.n += r.n;
    if (m) { if (s.lo === null || +m[1] < +s.lo) s.lo = m[1]; if (s.hi === null || +m[1] > +s.hi) s.hi = m[1]; }
    spots.set(k, s);
  }
  return [...spots.values()].sort((a, b) => b.n - a.n).slice(0, limit).map((s) => ({ kind: s.kind, place: s.place, n: s.n,
    detail: s.what + (s.lo === null ? "" : " " + (s.lo === s.hi ? s.lo : s.lo + "–" + s.hi) + s.unit) }));
}
const adminLink = () => (process.env.PUBLIC_URL || "https://tnllabs.com").trim().replace(/\/+$/, "") + "/admin#system";   // trimmed: a stray newline in the variable broke the alert's button

/* One pass. Returns what it sent, so tests can call it with their own clock
   and mailer: send(subject, heading, lines) → promise. */
async function watchTick(now, send) {
  const out = [], hour = now - 3600000;
  for (const [rule, sql, limit, name, why] of WATCH_RULES) {
    const n = db.prepare(sql).get(hour).n;
    if (n < limit) continue;
    const prev = lastSent.get(rule);
    if (prev && now - prev.last_at < 6 * 3600000) continue;
    const lines = [`${n} ${name} in the last hour — ${why}.`];
    if (GLITCH_OF[rule]) {
      for (const h of worstSpots(hour, GLITCH_OF[rule], 3))
        lines.push(`${h.n}× at ${h.place}${h.detail ? " — " + h.detail : ""}`);
    } else {
      for (const e of db.prepare(`SELECT message, path, COUNT(*) n FROM error_log WHERE kind = ? AND created_at >= ?
          GROUP BY message, path ORDER BY n DESC LIMIT 3`).all(rule === "server_errors" ? "server" : "client", hour))
        lines.push(`${e.n}× ${e.message}${e.path ? " (" + e.path + ")" : ""}`);
    }
    lines.push("You won't get this one again for 6 hours.");
    markSent.run(rule, now);
    await send(`LABS: ${n} ${name} in the last hour`, `${n} ${name} in the last hour`, lines);
    out.push(rule);
  }
  /* the morning digest: 13:00 UTC (9am New York in summer, 8am in winter) */
  const d = new Date(now), today = d.toISOString().slice(0, 10);
  const dig = lastSent.get("digest");
  if (d.getUTCHours() >= 13 && (!dig || new Date(dig.last_at).toISOString().slice(0, 10) !== today)) {
    const day = now - 86400000;
    const errs = db.prepare(`SELECT kind, COUNT(*) n FROM error_log WHERE created_at >= ? GROUP BY kind ORDER BY n DESC`).all(day);
    const gl = db.prepare(`SELECT kind, COUNT(*) n FROM glitch_events WHERE created_at >= ? GROUP BY kind ORDER BY n DESC`).all(day);
    const hot = worstSpots(day, null, 3);
    /* which errors, not just how many — so a day of noise reads as noise */
    const topErr = db.prepare(`SELECT message, COUNT(*) n FROM error_log WHERE created_at >= ? GROUP BY message ORDER BY n DESC LIMIT 2`).all(day);
    const joined = db.prepare(`SELECT COUNT(*) n FROM users WHERE created_at >= ?`).get(day).n;
    const posted = db.prepare(`SELECT COUNT(*) n FROM posts WHERE created_at >= ?`).get(day).n;
    const NAME = { rage_tap: "rage taps", layout_jump: "screen jumps", slow_screen: "slow screens", action_failed: "failed saves" };
    const lines = [
      `${joined} new member${joined === 1 ? "" : "s"} · ${posted} post${posted === 1 ? "" : "s"}.`,
      errs.length ? `Errors: ${errs.map((e) => e.n + " " + e.kind).join(", ")}.` : "Errors: none.",
      ...topErr.map((e) => `Most often: ${e.n}× ${String(e.message || "").slice(0, 120)}`),
      gl.length ? `Glitches: ${gl.map((g) => g.n + " " + (NAME[g.kind] || g.kind)).join(", ")}.` : "Glitches: none — it felt smooth.",
      ...hot.map((h) => `Worst spot: ${h.n}× ${NAME[h.kind] || h.kind} at ${h.place}${h.detail ? " — " + h.detail : ""}`),
    ];
    markSent.run("digest", now);
    const calm = !errs.length && !gl.length;
    await send(`LABS: yesterday — ${calm ? "all smooth" : (errs.reduce((s, e) => s + e.n, 0) + " errors, " + gl.reduce((s, g) => s + g.n, 0) + " glitches")}`,
      "Yesterday on LABS", lines);
    out.push("digest");
  }
  return out;
}
const watchTo = (process.env.ADMIN_EMAIL || "").trim();
if (watchTo && !process.env.TNL_NO_WATCH) {
  const mail = (subject, heading, lines) => sendAlertEmail(watchTo, subject, heading, lines, adminLink())
    .then((r) => { if (!r.sent && r.reason !== "no_key") logError("mail", "alert not sent: " + (r.error || "?"), subject, "watch", ""); });
  const tick = () => watchTick(Date.now(), mail).catch((e) => console.error("[watch]", e.message));
  setTimeout(tick, 60000).unref?.();
  setInterval(tick, 10 * 60000).unref?.();
}
