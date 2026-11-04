/* ================================================================
   ADMIN · THE SYSTEMS MAP v1.0 — 2026-11-04. "Can we do the same type of
   interactive model for the system networks… all the networks that run the
   app." The model on Health → Systems (admin-app/7-systems6-map.js) reads this:
     GET /api/admin/systems/map   (admins only)
   Every service LABS runs on, each with a state — on (working), warn (a
   problem to look at), wait (something in motion), off (not connected) —
   one plain line, a few facts and the admin page to open. Read from what
   LABS already knows on its own (keys set or not, its own logs and tables),
   so it never calls Stripe, Resend, Google or Meta and costs nothing.
   Railway and GitHub come from the Systems page's own read (/api/admin/systems,
   cached) — the page merges them. Never a key, a name or a message: counts.
================================================================ */
app.get("/api/admin/systems/map", auth, admin, rateLimit({ max: 30, windowMs: 60000, key: "user" }), (req, res) => {
  const now = Date.now(), H = 3600000, DAYMS = 86400000;
  const n = (sql, ...p) => { try { return db.prepare(sql).get(...p)?.n ?? 0; } catch { return 0; } };
  const errs = (kind, since) => n(`SELECT COUNT(*) n FROM error_log WHERE kind = ? AND created_at >= ?`, kind, since);
  const ago = (t) => { if (!t) return "never"; const m = Math.round((now - t) / 60000); return m < 1 ? "just now" : m < 60 ? `${m} min ago` : m < 1440 ? `${Math.round(m / 60)}h ago` : `${Math.round(m / 1440)}d ago`; };
  const mb = (b) => (b >= 1073741824 ? (b / 1073741824).toFixed(1) + " GB" : Math.round(b / 1048576) + " MB");
  let dbBytes = 0; try { dbBytes = statSync(join(DATA_DIR, "tnl.db")).size; } catch {}

  /* LABS itself: the server */
  const srvH = errs("server", now - H), srvD = errs("server", now - DAYMS), slow = n(`SELECT COUNT(*) n FROM slow_requests WHERE at >= ?`, now - DAYMS);
  const server = { id: "labs", name: "LABS", does: "The app's server — every page and request", state: srvH >= 3 ? "warn" : "on",
    line: srvH >= 3 ? `${srvH} server errors in the last hour` : `Up ${Math.floor(process.uptime() / 3600)}h, ${srvD ? `${srvD} errors today` : "no errors today"}`,
    facts: [["Up for", `${Math.floor(process.uptime() / 3600)}h ${Math.floor((process.uptime() % 3600) / 60)}m`], ["Memory", Math.round(process.memoryUsage().rss / 1048576) + " MB"],
      ["Server errors · 24h", srvD], ["Slow or failed requests · 24h", slow], ["Node", process.version]], go: "health" };

  /* members' phones and computers */
  const cliD = errs("client", now - DAYMS), glitch = n(`SELECT COUNT(*) n FROM glitch_events WHERE created_at >= ?`, now - DAYMS);
  const today = n(`SELECT COUNT(*) n FROM member_days WHERE day = ?`, Math.floor(now / DAYMS));
  const phones = { id: "members", name: "Members' phones", does: "The app on members' screens", state: cliD >= 10 ? "warn" : "on",
    line: `${today} member${today === 1 ? "" : "s"} in the app today${cliD ? ` · ${cliD} crashes on screens` : ""}`,
    facts: [["In the app today", today], ["Crashes on screens · 24h", cliD], ["Glitches · 24h", glitch]], go: "health" };

  /* Cloudflare: in front of everything */
  const viaCf = !!req.get("cf-ray"), cities = n(`SELECT COUNT(*) n FROM member_signals WHERE city != '' AND at >= ?`, now - 7 * DAYMS), ts = !!tsSiteKey();
  const cloudflare = { id: "cloudflare", name: "Cloudflare", does: "In front of tnllabs.com — the address, the shield, where visitors are",
    state: viaCf ? "on" : "off", line: viaCf ? `Traffic comes through it${ts ? " · bot check on" : ""}` : "This request didn't come through Cloudflare",
    facts: [["Traffic through it", viaCf ? "yes" : "no"], ["Bot check (Turnstile)", ts ? "on" : "off"], ["City of visitors", cities ? "on" : "off — Rules → Managed Transforms"]], go: "settings" };

  /* Railway: hosting, and the volume the database lives on */
  const onVol = !!process.env.TNL_DATA;
  const railway = { id: "railway", name: "Railway", does: "Runs the server; deploys every Push", state: "on", line: "Hosting LABS", facts: [], go: "systems" };
  const volume = { id: "data", name: "Database", does: "Members, posts, orders — on Railway's volume", state: onVol ? "on" : "warn",
    line: onVol ? `${mb(dbBytes)} on the volume` : "Not on the volume — data would be lost on a deploy",
    facts: [["Size", mb(dbBytes)], ["On the volume", onVol ? "yes" : "no"], ["Members", n(`SELECT COUNT(*) n FROM users`)]], go: "health" };
  const github = { id: "github", name: "GitHub", does: "The code; tests every change before a Push", state: "on", line: "The code", facts: [], go: "systems" };

  /* Stripe: payments */
  const payD = errs("pay", now - DAYMS), paid7 = n(`SELECT COUNT(*) n FROM orders WHERE created_at >= ? AND status IN ('paid','shipped','complete')`, now - 7 * DAYMS);
  const lastOrder = n(`SELECT MAX(created_at) n FROM orders`);
  const stripe = { id: "stripe", name: "Stripe", does: "Payments and sellers' payouts", state: !PAYMENTS_ENABLED ? "off" : payD ? "warn" : "on",
    line: !PAYMENTS_ENABLED ? "No key — STRIPE_SECRET_KEY in Railway" : payD ? `${payD} payment error${payD === 1 ? "" : "s"} today` : `${paid7} order${paid7 === 1 ? "" : "s"} this week`,
    facts: [["Orders · 7 days", paid7], ["Last order", ago(lastOrder)], ["Payment errors · 24h", payD]], go: "market" };

  /* Resend: email */
  const mailD = errs("mail", now - DAYMS), lastMail = n(`SELECT MAX(last_at) n FROM nudge_mail`);
  const resend = { id: "resend", name: "Resend", does: "Email — sign-up codes, resets, nudges, the Monday email", state: !MAIL_ENABLED ? "off" : mailD ? "warn" : "on",
    line: !MAIL_ENABLED ? "No key — RESEND_API_KEY in Railway" : mailD ? `${mailD} email${mailD === 1 ? "" : "s"} failed today` : "Sending",
    facts: [["Failed · 24h", mailD], ["Last nudge sent", ago(lastMail)]], go: "health" };

  /* Claude: Echo's brain */
  const brainOn = !!BRAIN_KEY, answers = n(`SELECT COUNT(*) n FROM echo_brain WHERE role = 'assistant' AND created_at >= ?`, now - DAYMS);
  const lastAnswer = n(`SELECT MAX(created_at) n FROM echo_brain WHERE role = 'assistant'`);
  const claude = { id: "claude", name: "Claude", does: "Echo's brain", state: brainOn ? "on" : "off",
    line: brainOn ? `${answers} answer${answers === 1 ? "" : "s"} today` : "No key — ECHO_AI_KEY in Railway",
    facts: [["Answers · 24h", answers], ["Last answer", ago(lastAnswer)]], go: "echohome" };

  /* the connector: Claude, Grok and other apps reading the dashboard */
  const keys = n(`SELECT COUNT(*) n FROM mcp_tokens WHERE revoked = 0 AND expires_at > ?`, now), lastUse = n(`SELECT MAX(last_used_at) n FROM mcp_tokens WHERE revoked = 0`);
  const connector = { id: "connector", name: "Connected apps", does: "Claude and Grok reading the dashboard, writing Knowledge", state: keys ? "on" : "off",
    line: keys ? `${keys} app${keys === 1 ? "" : "s"} connected · used ${ago(lastUse)}` : "None connected", facts: [["Connected", keys], ["Last used", ago(lastUse)]], go: "systems" };

  /* Google and Meta (Instagram) */
  const ggOn = !!GG_ENV("GOOGLE_SERVICE_ACCOUNT"), mtOn = !!MT.token();
  let ig = null; try { ig = igAccount(); } catch {}
  const google = { id: "google", name: "Google", does: "Search — how LABS shows up, and free shopping listings", state: ggOn ? "on" : "off",
    line: ggOn ? "Search Console connected" : "No key — GOOGLE_SERVICE_ACCOUNT in Railway", facts: [["Connected", ggOn ? "yes" : "no"]], go: "systems" };
  const meta = { id: "meta", name: "Instagram", does: "@tnl.labs — reach, the inbox, the shop", state: mtOn || ig ? "on" : "off",
    line: mtOn || ig ? `${ig?.username ? "@" + ig.username : "Connected"}` : "Not connected", facts: [["Insights (Meta key)", mtOn ? "on" : "off"], ["Inbox", ig ? "connected" : "off"]], go: "instagram" };

  res.json({ at: now, nodes: [server, phones, cloudflare, railway, volume, github, stripe, resend, claude, connector, google, meta] });
});
