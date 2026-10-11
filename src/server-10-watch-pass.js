
/* ================================================================
   ADMIN PASS v1.0 — 2026-10-11
   "If you're logged in already you shouldn't have to log in again."
   The watch emails' Open Admin opens in the phone's browser, which never
   shares the home-screen app's sign-in (iOS keeps them apart) — so every
   email's button carries a one-time pass for the admin it's sent to:
     · one use, 24 hours, only an admin account whose email it went to
     · stored as a SHA-256, never the pass itself
     · /admin/pass only shows a page; the page's own script redeems it
       (POST), so a mail scanner that "clicks" the link first can't use it up
     · redeemed: a normal session in that browser, then Admin — and the
       browser stays signed in, so later emails just open
================================================================ */
db.exec(`CREATE TABLE IF NOT EXISTS admin_passes (hash TEXT PRIMARY KEY, user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expires_at INTEGER NOT NULL, created_at INTEGER NOT NULL)`);
const PASS_TTL = 24 * 3600000;
const passHash = (t) => createHash("sha256").update(String(t)).digest("hex");
const passBase = () => (process.env.PUBLIC_URL || "https://labs.tnllabs.com").trim().replace(/\/+$/, "");

/* The button's address for an email to `to`: a fresh pass if `to` is an admin, else plain Admin. */
function adminPassLink(to, now = Date.now()) {
  const u = db.prepare(`SELECT id FROM users WHERE LOWER(email) = LOWER(?) AND is_admin = 1 AND COALESCE(suspended, 0) = 0`).get(String(to || "").trim());
  if (!u) return passBase() + "/admin#system";
  db.prepare(`DELETE FROM admin_passes WHERE expires_at < ?`).run(now);
  const t = randomBytes(24).toString("hex");
  db.prepare(`INSERT INTO admin_passes (hash, user_id, expires_at, created_at) VALUES (?, ?, ?, ?)`).run(passHash(t), u.id, now + PASS_TTL, now);
  return `${passBase()}/admin/pass?t=${t}#system`;
}

app.get("/admin/pass", (req, res) => {
  res.set("Cache-Control", "no-store");
  res.set("Referrer-Policy", "no-referrer");
  const t = String(req.query.t || "");
  res.send(lookPage({
    title: "Opening Admin — TNL LABS", center: true,
    body: `${lookEyebrow("Admin")}
<h1>Opening Admin…</h1>
<p class="p" id="m">One moment.</p>
<a class="btn block" id="in" href="/?login=1&next=%2Fadmin" hidden>Log in</a>
<script>
(async()=>{
  const m=document.getElementById("m"),tab=location.hash||"#system";
  try{
    const r=await fetch("/api/auth/admin-pass",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({t:${JSON.stringify(t).replace(/</g, "\\u003c")}})});
    const d=await r.json();
    if(r.ok&&d.token){localStorage.setItem("tnl-token",d.token);location.replace("/admin"+tab);return}
    /* used or old — fine if this browser is signed in already */
    if(localStorage.getItem("tnl-token")){location.replace("/admin"+tab);return}
    m.textContent=(d.error||"That link has been used.")+" Log in and you'll land on Admin.";
  }catch(e){m.textContent="Couldn't open it. Log in and you'll land on Admin."}
  const a=document.getElementById("in");a.href="/?login=1&next="+encodeURIComponent("/admin"+tab);a.hidden=false;
})();
</script>`,
  }));
});

app.post("/api/auth/admin-pass", rateLimit({ max: 10, windowMs: 900000 }), (req, res) => {
  const h = passHash(req.body?.t || ""), now = Date.now();
  const row = db.prepare(`SELECT * FROM admin_passes WHERE hash = ?`).get(h);
  if (!row) return res.status(400).json({ error: "That link has been used." });
  db.prepare(`DELETE FROM admin_passes WHERE hash = ?`).run(h);   // one use, whatever happens next
  if (row.expires_at < now) return res.status(400).json({ error: "That link is more than a day old." });
  const u = q.userById.get(row.user_id);
  if (!u || !u.is_admin || u.suspended) return res.status(403).json({ error: "admins only" });
  const token = randomBytes(24).toString("hex");
  q.createSession.run(token, u.id, now);
  res.json({ token });
});
