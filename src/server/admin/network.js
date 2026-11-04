/* ================================================================
   ADMIN · THE NETWORK v1.0 — 2026-11-04. "I don't see the interactive admin
   dashboard network. Make the whole admin dashboard interactive" — "use the
   organization" of the LABS Blueprint (sheet A-0). The Network section
   (admin-app/2-network.js) reads this:
     GET /api/admin/network?days=30   (admins only)
   LABS as the Blueprint draws it: a member's path, left to right — Arrive,
   Join, See, Make, Respond, Earn, Trade, Talk — each stage with its live
   numbers for the window and the window before, and what needs you there
   (the same needs as Echo Home, inboxItems, sorted onto the stage they
   belong to); across the top, the outside world it leans on, and underneath,
   the foundations (both from sysMapNodes, the systems map).
   Counts only — never a name, an email, a word anyone wrote, or a key.
   Messages are counted as rows, never read.
================================================================ */
app.get("/api/admin/network", auth, admin, rateLimit({ max: 30, windowMs: 60000, key: "user" }), (req, res) => {
  const now = Date.now(), DAYMS = 86400000, days = Math.max(1, Math.min(365, Math.round(Number(req.query.days) || 30)));
  const a = now - days * DAYMS, b = a - days * DAYMS;   // this window [a, now); the one before [b, a)
  const n = (sql, ...p) => { try { return db.prepare(sql).get(...p)?.n ?? 0; } catch { return 0; } };
  const both = (sql, ...extra) => [n(sql, a, now, ...extra), n(sql, b, a, ...extra)];   // sql takes (from, to, …)
  const dayA = Math.floor(a / DAYMS), dayB = Math.floor(b / DAYMS), dayNow = Math.floor(now / DAYMS) + 1;
  const dboth = (sql) => [n(sql, dayA, dayNow), n(sql, dayB, dayA)];

  /* what needs you, onto the stage it belongs to */
  let inbox = []; try { inbox = inboxItems(now); } catch {}
  let tour = []; try { tour = tournamentNeeds(tournamentNow(now), now); } catch {}
  const STAGE_OF = { welcome: "join", unverified: "join", reports: "respond", collabs: "respond", tournament: "respond", unshipped: "trade", errors: "base", backup: "base" };
  const needs = {}; for (const it of [...inbox, ...tour]) (needs[STAGE_OF[it.kind] || "base"] ||= []).push({ text: it.text, level: it.level });

  const S = (id, name, says, [value, before], label, facts, go, goName) => ({ id, name, says, value, before, label, facts, go, goName, needs: needs[id] || [] });
  const strangers = dboth(`SELECT COUNT(DISTINCT viewer) n FROM post_views WHERE viewer LIKE 'd:%' AND day >= ? AND day < ?`);
  const joins = both(`SELECT COUNT(*) n FROM users WHERE created_at >= ? AND created_at < ?`);
  const active = dboth(`SELECT COUNT(DISTINCT user_id) n FROM member_days WHERE day >= ? AND day < ?`);
  const work = both(`SELECT COUNT(*) n FROM posts WHERE is_work = 1 AND created_at >= ? AND created_at < ?`);
  const responded = both(`SELECT (SELECT COUNT(*) FROM likes WHERE created_at >= ?1 AND created_at < ?2) + (SELECT COUNT(*) FROM comments WHERE created_at >= ?1 AND created_at < ?2) n`);
  const rep = both(`SELECT COALESCE(SUM(amount), 0) n FROM rep_events WHERE created_at >= ? AND created_at < ?`);
  const sales = both(`SELECT COALESCE(SUM(amount_cents), 0) n FROM orders WHERE status IN ('paid','shipped','complete') AND created_at >= ? AND created_at < ?`);
  const msgs = both(`SELECT COUNT(*) n FROM dm_messages WHERE created_at >= ? AND created_at < ?`);
  const W = [a, now];
  const stages = [
    S("arrive", "Arrive", "From Instagram, a link, a search", strangers, "visitors looked at work",
      [["Joined from Instagram", n(`SELECT COUNT(*) n FROM join_signals WHERE (referrer LIKE '%instagram%' OR landing LIKE '%utm_source=ig%') AND created_at >= ? AND created_at < ?`, ...W)],
       ["Came in on a shared link", n(`SELECT COUNT(*) n FROM join_signals WHERE (landing LIKE '/?u=%' OR landing LIKE '/?p=%' OR landing LIKE '/?e=%' OR landing LIKE '/?l=%') AND created_at >= ? AND created_at < ?`, ...W)]], "instagram", "Instagram"),
    S("join", "Join", "One question a screen", joins, "new members",
      [["With Google or Apple", n(`SELECT COUNT(*) n FROM join_signals WHERE via != 'email' AND created_at >= ? AND created_at < ?`, ...W)],
       ["Haven't confirmed email", n(`SELECT COUNT(*) n FROM users WHERE email_verified = 0 AND created_at >= ? AND created_at < ?`, ...W)],
       ["Members in all", n(`SELECT COUNT(*) n FROM users`)]], "people", "Members"),
    S("see", "See", "The Showroom, the labs, search", active, "members used the app",
      [["Pieces seen", n(`SELECT COUNT(*) n FROM post_views WHERE day >= ? AND day < ?`, dayA, dayNow)],
       ["In the app today", n(`SELECT COUNT(*) n FROM member_days WHERE day = ?`, dayNow - 1)]], "analytics", "Analytics"),
    S("make", "Make", "Work, songs, posts", work, "pieces of work posted",
      [["Songs uploaded", n(`SELECT COUNT(*) n FROM tracks WHERE created_at >= ? AND created_at < ?`, ...W)],
       ["People who posted", n(`SELECT COUNT(DISTINCT author_id) n FROM posts WHERE is_work = 1 AND created_at >= ? AND created_at < ?`, ...W)]], "content", "Content"),
    S("respond", "Respond", "What other people do with it", responded, "likes and comments",
      [["Collabs accepted", n(`SELECT COUNT(*) n FROM collaborators WHERE status = 'accepted' AND created_at >= ? AND created_at < ?`, ...W)],
       ["Tournament votes", n(`SELECT COUNT(*) n FROM event_votes WHERE created_at >= ? AND created_at < ?`, ...W)],
       ["Open reports", n(`SELECT COUNT(*) n FROM reports WHERE handled_at IS NULL`)]], "events", "Events"),
    S("earn", "Earn", "Standing, levels, fees", rep, "rep earned",
      [["Members who earned rep", n(`SELECT COUNT(DISTINCT user_id) n FROM rep_events WHERE amount > 0 AND created_at >= ? AND created_at < ?`, ...W)],
       ["Verified or higher (40+)", n(`SELECT COUNT(*) n FROM users WHERE rep >= 40`)]], "people", "Members"),
    S("trade", "Trade", "Sell what you make", sales, "in sales",
      [["Orders", n(`SELECT COUNT(*) n FROM orders WHERE status IN ('paid','shipped','complete') AND created_at >= ? AND created_at < ?`, ...W)],
       ["Started selling", n(`SELECT COUNT(DISTINCT walk) n FROM sell_walk WHERE step = 'what' AND created_at >= ? AND created_at < ?`, ...W)],
       ["…and listed", n(`SELECT COUNT(DISTINCT walk) n FROM sell_walk WHERE step = 'listed' AND created_at >= ? AND created_at < ?`, ...W)],
       ["Listings live", n(`SELECT COUNT(*) n FROM listings WHERE status = 'active'`)]], "market", "Market"),
    S("talk", "Talk", "And hear back", msgs, "messages sent",
      [["People messaging", n(`SELECT COUNT(DISTINCT sender_id) n FROM dm_messages WHERE created_at >= ? AND created_at < ?`, ...W)],
       ["Questions to Echo", n(`SELECT COUNT(*) n FROM echo_turns WHERE created_at >= ? AND created_at < ?`, ...W)],
       ["Handed to you", n(`SELECT COUNT(*) n FROM echo_handoffs WHERE status = 'open'`)]], "echo", "Help desk"),
  ];
  stages.find((s) => s.id === "trade").money = true;

  /* the outside world and the foundations, as the systems map reads them */
  let svc = []; try { svc = sysMapNodes(req); } catch {}
  const pick = (ids) => ids.map((id) => svc.find((s) => s.id === id)).filter(Boolean);
  const outside = pick(["meta", "cloudflare", "google", "stripe", "resend", "railway", "github", "claude", "connector"]);
  const base = pick(["labs", "data", "members"]).map((s) => (s.id === "labs" ? { ...s, name: "Server" } : s));
  base.push({ id: "trust", name: "Trust", does: "Proving people are real: the bot check, spam signals, reports", state: "on",
    line: `${n(`SELECT COUNT(*) n FROM users WHERE spam_at IS NOT NULL AND spam_at >= ?`, a)} flagged as spam · ${n(`SELECT COUNT(*) n FROM reports WHERE handled_at IS NULL`)} open reports`,
    facts: [["Flagged as spam", n(`SELECT COUNT(*) n FROM users WHERE spam_at IS NOT NULL AND spam_at >= ?`, a)], ["Suspended", n(`SELECT COUNT(*) n FROM users WHERE suspended = 1`)]], go: "content" });
  if ((needs.base || []).length) { const h = base.find((s) => s.id === "labs"); if (h) { h.state = h.state === "on" ? "warn" : h.state; h.line = needs.base[0].text; h.facts = [...h.facts, ...needs.base.slice(0, 2).map((x) => ["Needs you", x.text])]; } }
  /* the dashboard's sections, each with its live count and what needs you in it (by the page each need opens) — Echo
     Home's model, the to-do: "front of the admin dashboard like Echo's to-do" (2026-11-04) */
  const toPage = (it) => it.kind === "unverified" ? "people" : it.kind === "backup" || it.kind === "errors" ? "health" : ({ system: "health", orders: "market", listings: "market", sellers: "market", systems: "health" }[it.go] || it.go);
  const todo = {}; for (const it of [...inbox, ...tour]) (todo[toPage(it)] ||= []).push({ text: it.text, level: it.level });
  let live = 0; try { for (const e of db.prepare(`SELECT schedule FROM events WHERE published = 1`).all()) { if (JSON.parse(e.schedule || "[]").some((x) => x.end > now)) live++; } } catch {}
  const wk = now - 7 * DAYMS;
  const SEC = (id, name, does, value, label) => ({ id, name, does, value, label, needs: todo[id] || [] });
  const sections = [
    SEC("people", "Members", "Everyone on LABS — accounts, standing, the globe", n(`SELECT COUNT(*) n FROM users`), "members"),
    SEC("market", "Market", "Orders, listings and sellers", n(`SELECT COUNT(*) n FROM listings WHERE status = 'active'`), "listings live"),
    SEC("content", "Content", "Posts, comments and reports", n(`SELECT COUNT(*) n FROM posts WHERE created_at > ?`, wk), "posts this week"),
    SEC("events", "Events", "The tournament", live, "live now"),
    SEC("instagram", "Instagram", "@tnl.labs — reach and the inbox", n(`SELECT COUNT(*) n FROM ig_conversations WHERE updated_at > ?`, wk), "chats this week"),
    SEC("knowledge", "Knowledge", "What LABS knows about itself", n(`SELECT COUNT(*) n FROM knowledge WHERE archived = 0`), "entries"),
    SEC("echo", "Help desk", "Members' questions to Echo, and the ones it hands you", n(`SELECT COUNT(*) n FROM echo_handoffs WHERE status = 'open'`), "handed to you"),
    SEC("analytics", "Analytics", "How people use LABS", n(`SELECT COUNT(DISTINCT user_id) n FROM member_days WHERE day >= ?`, Math.floor(wk / DAYMS)), "active this week"),
    SEC("health", "Health", "Errors, backups, the systems", n(`SELECT COUNT(*) n FROM error_log WHERE created_at > ?`, now - DAYMS), "errors today"),
    SEC("settings", "Settings", "The switches", n(`SELECT COUNT(*) n FROM settings`), "switches set"),
  ];
  res.json({ at: now, days, stages, outside, base, sections });
});
