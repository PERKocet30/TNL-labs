/* ================================================================
   ADMIN · THE NETWORK v1.0 — 2026-11-04. "I don't see the interactive admin
   dashboard network. Make the whole admin dashboard interactive." The
   Network section (admin-app/2-network.js) reads this:
     GET /api/admin/network   (admins only)
   The whole dashboard as one model: LABS in the middle; round it every
   section of the admin (Members, Market, Content, Events, Instagram,
   Knowledge, Help desk, Settings, Analytics, Health) with its live number,
   and what needs you in it — the same needs as Echo Home (inboxItems) — and
   round those, every service LABS runs on (sysMapNodes, the systems map).
   Counts only, never a name, an email or a message; never a key.
================================================================ */
app.get("/api/admin/network", auth, admin, rateLimit({ max: 30, windowMs: 60000, key: "user" }), (req, res) => {
  const now = Date.now(), DAYMS = 86400000, wk = now - 7 * DAYMS;
  const n = (sql, ...p) => { try { return db.prepare(sql).get(...p)?.n ?? 0; } catch { return 0; } };
  /* what needs you, by the section it opens (old targets land where the dashboard sends them) */
  let inbox = []; try { inbox = inboxItems(now); } catch {}
  const home = (go) => ({ system: "health", backup: "health", orders: "market", listings: "market", sellers: "market", systems: "health" }[go] || go);
  const needs = {}; for (const it of inbox) { const k = it.kind === "unverified" ? "people" : it.kind === "backup" || it.kind === "errors" ? "health" : home(it.go); (needs[k] ||= []).push({ text: it.text, level: it.level }); }
  let live = 0; try { for (const e of db.prepare(`SELECT schedule FROM events WHERE published = 1`).all()) { const s = JSON.parse(e.schedule || "[]"); if (s.some((x) => x.end > now)) live++; } } catch {}
  let ig = null; try { ig = igAccount(); } catch {}
  const S = (id, name, does, value, label, facts) => ({ id, name, does, value, label, facts, needs: needs[id] || [] });
  const sections = [
    S("people", "Members", "Everyone on LABS — accounts, standing, the globe", n(`SELECT COUNT(*) n FROM users`), "members",
      [["New this week", n(`SELECT COUNT(*) n FROM users WHERE created_at > ?`, wk)], ["In the app today", n(`SELECT COUNT(*) n FROM member_days WHERE day = ?`, Math.floor(now / DAYMS))]]),
    S("market", "Market", "Orders, listings and sellers", n(`SELECT COUNT(*) n FROM listings WHERE status = 'active'`), "listings",
      [["Orders · 7 days", n(`SELECT COUNT(*) n FROM orders WHERE created_at > ? AND status IN ('paid','shipped','complete')`, wk)], ["Sellers paid out", n(`SELECT COUNT(*) n FROM users WHERE stripe_ready = 1`)]]),
    S("content", "Content", "Posts, comments and reports", n(`SELECT COUNT(*) n FROM posts WHERE created_at > ?`, wk), "posts this week",
      [["Open reports", n(`SELECT COUNT(*) n FROM reports WHERE handled_at IS NULL`)], ["Posts in all", n(`SELECT COUNT(*) n FROM posts`)]]),
    S("events", "Events", "The tournament", live, "live now",
      [["Entries", n(`SELECT COUNT(*) n FROM event_entries`)], ["Votes", n(`SELECT COUNT(*) n FROM event_votes`)]]),
    S("instagram", "Instagram", "@tnl.labs — reach and the inbox", n(`SELECT COUNT(*) n FROM ig_conversations WHERE updated_at > ?`, wk), "chats this week",
      [["Inbox", ig ? "connected" : "not connected"]]),
    S("knowledge", "Knowledge", "What LABS knows about itself", n(`SELECT COUNT(*) n FROM knowledge WHERE archived = 0`), "entries",
      [["Changed this week", n(`SELECT COUNT(*) n FROM knowledge_history WHERE at > ?`, wk)]]),
    S("echo", "Help desk", "Members' questions to Echo, and the ones it hands you", n(`SELECT COUNT(*) n FROM echo_handoffs WHERE status = 'open'`), "handed to you",
      [["Questions · 7 days", n(`SELECT COUNT(*) n FROM echo_turns WHERE created_at > ?`, wk)]]),
    S("settings", "Settings", "The switches", n(`SELECT COUNT(*) n FROM settings`), "switches set", []),
    S("analytics", "Analytics", "How people use LABS", n(`SELECT COUNT(DISTINCT user_id) n FROM member_days WHERE day >= ?`, Math.floor(wk / DAYMS)), "active this week", []),
    S("health", "Health", "Errors, backups, the systems", n(`SELECT COUNT(*) n FROM error_log WHERE created_at > ?`, now - DAYMS), "errors today",
      [["Slow or failed · 24h", n(`SELECT COUNT(*) n FROM slow_requests WHERE at >= ?`, now - DAYMS)]]),
  ];
  let services = []; try { services = sysMapNodes(req); } catch {}
  res.json({ at: now, sections, services });
});
