/* ================================================================
   MODS v1.2 — 2026-10-28 (a new Mod is emailed — mailRole). v1.1 — 2026-10-28 (Mods appoint Lab Leads). v1.0 — 2026-10-28. "A level below me … see data but not the
   highest level of security." Two kinds of admin now:
   - Owner (users.is_admin) — everything, as before.
   - Mod (users.is_mod) — only the routes listed in MOD_MAY. Anything not
     listed (backups, settings, systems and keys, connectors, the
     Instagram inbox, private notes, broadcasts, deleting accounts,
     voiding orders, the admin log, making Mods) stays owner-only, and so
     does every admin route added later unless someone lists it here.
   Mod is its own switch, flipped by the owner one person at a time. It is
   not tied to a role, a level or leading a lab.
   A Mod can never act on the owner or another Mod, can't take down their
   posts or listings, and can't publish an event (publishing emails every
   member). Mods sell at the normal fee and don't get the Claude connector.
   admin() (server-04-admin-dashboard.js) asks modMay(); every Mod change
   goes in the admin log with their name, same as the owner's.
================================================================ */
const MOD_MAY = new Set([
  // look
  "GET /api/admin/me", "GET /api/admin/overview", "GET /api/admin/pulse", "GET /api/admin/funnel", "GET /api/admin/retention",
  "GET /api/admin/audience", "GET /api/admin/content", "GET /api/admin/direction", "GET /api/admin/topwork", "GET /api/admin/songs",
  "GET /api/admin/series", "GET /api/admin/studio", "GET /api/admin/market", "GET /api/admin/listings", "GET /api/admin/orders",
  "GET /api/admin/sellers", "GET /api/admin/members", "GET /api/admin/people", "GET /api/admin/people/:username",
  "GET /api/admin/people/:username/signals", "GET /api/admin/posts", "GET /api/admin/reports", "GET /api/admin/health",
  "GET /api/admin/errors", "GET /api/admin/glitches", "GET /api/admin/weekly", "GET /api/admin/nudge",
  "GET /api/admin/events", "GET /api/admin/events/:id", "GET /api/admin/events/:id/spam", "GET /api/admin/events/:id/vote-check",
  "GET /api/admin/events/:id/vote-mail",
  // moderate
  "POST /api/admin/reports/:id/handle", "DELETE /api/admin/posts/:id", "DELETE /api/admin/listings/:id",
  "POST /api/admin/spam/remove", "POST /api/admin/spam/restore",
  // run events (publishing stays with the owner — see modMay)
  "POST /api/admin/events", "PATCH /api/admin/events/:id", "POST /api/admin/events/:id/advance",
  "POST /api/admin/events/:id/entries/:entryId/dq", "POST /api/admin/events/:id/judges",
  "POST /api/admin/events/:id/mail-preview", "POST /api/admin/events/:id/vote-mail-preview",
  // members
  "POST /api/admin/members/:username/rep", "POST /api/admin/members/:username/feature",
  "POST /api/admin/members/:username/verify", "POST /api/admin/members/:username/suspend",
  // lab leads (server-10-leads.js) — Mods staff the labs
  "POST /api/admin/members/:username/lead",
]);

const isMod = (u) => !!(u && u.is_mod && !u.is_admin);
const isStaff = (u) => !!(u && (u.is_admin || u.is_mod));

/* null = allowed; otherwise the reason to refuse */
function modMay(req) {
  const route = req.route && req.route.path;
  if (!route || !MOD_MAY.has(`${req.method} ${route}`)) return "That's for the owner only.";
  const body = req.body && typeof req.body === "object" ? req.body : {};
  if (req.params.username && route.startsWith("/api/admin/members/")) {
    const t = q.userByName.get(req.params.username);
    if (t && isStaff(t)) return "Mods can't change the owner or another Mod.";
  }
  if (route === "/api/admin/posts/:id") {
    const p = db.prepare(`SELECT u.is_admin, u.is_mod FROM posts p JOIN users u ON u.id = p.author_id WHERE p.id = ?`).get(Number(req.params.id));
    if (isStaff(p)) return "Mods can't take down the owner's or another Mod's posts.";
  }
  if (route === "/api/admin/listings/:id") {
    const l = db.prepare(`SELECT u.is_admin, u.is_mod FROM listings l JOIN users u ON u.id = l.seller_id WHERE l.id = ?`).get(Number(req.params.id));
    if (isStaff(l)) return "Mods can't take down the owner's or another Mod's listings.";
  }
  if (route === "/api/admin/events" && body.published) return "Only the owner can publish an event — it emails every member.";
  if (route === "/api/admin/events/:id" && body.published !== undefined) {
    const ev = db.prepare(`SELECT published FROM events WHERE id = ?`).get(Number(req.params.id));
    if (ev && !!body.published !== !!ev.published) return "Only the owner can publish or unpublish an event — publishing emails every member.";
  }
  return null;
}

/* Mod changes go in the admin log too (the owner's are logged in server-01-boot). */
app.use("/api/admin", (req, res, next) => {
  if (req.method !== "GET") res.on("finish", () => { if (res.statusCode < 400 && isMod(req.user)) auditAdmin(req); });
  next();
});

/* who's looking — the admin page asks this to know which sections to show */
app.get("/api/admin/me", auth, admin, (req, res) => {
  res.json({ username: req.user.username, displayName: req.user.display_name, avatarUrl: req.user.avatar_url || "", access: req.user.is_admin ? "owner" : "mod" });
});

/* "Anytime someone is made an admin or lab leader they're emailed" (2026-10-28).
   Only when the role is new to them — never on removal, never twice. Sent in the
   background: the change doesn't wait on, or fail because of, email. */
async function mailRole(req, t, role, lab) {
  if (!t || !t.email || (typeof emailThrowaway === "function" && emailThrowaway(t.email))) return;
  try {
    const { roleEmail, roleSubject, sendRoleEmail } = await import("./mail.js");   // boot's mail import line is full (24KB)
    const base = baseUrl(req), name = LAB_NAME[lab] || lab;
    const r = await sendRoleEmail(t.email, roleSubject(role, name), roleEmail({ name: t.display_name || t.username, role, lab: name, by: req.user && req.user.username,
      url: role === "mod" ? base + "/admin" : base + "/?l=" + encodeURIComponent(lab) }));
    if (!r.sent && r.reason !== "no_key") console.warn(`[mail] role email to @${t.username} didn't send: ${r.error || "unknown"}`);
  } catch (e) { console.warn("[mail] role email failed: " + e.message); }
}

/* the owner makes or removes a Mod. Never listed in MOD_MAY. */
app.post("/api/admin/members/:username/mod", auth, admin, (req, res) => {
  const t = q.userByName.get(req.params.username);
  if (!t) return res.status(404).json({ error: "no such user" });
  if (t.is_admin) return res.status(400).json({ error: "The owner already has every permission." });
  const on = !!(req.body && req.body.on);
  if (on && t.suspended) return res.status(400).json({ error: "Restore their account before making them a Mod." });
  db.prepare(`UPDATE users SET is_mod = ? WHERE id = ?`).run(on ? 1 : 0, t.id);
  if (on && !t.is_mod) mailRole(req, t, "mod");
  res.json({ ok: true, isMod: on });
});
