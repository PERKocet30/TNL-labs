/* ================================================================
   REAL PEOPLE OR BOTS — what the admin sees (2026-10-26; who voted for each piece 2026-10-30). The data is
   written by server-01-signals. Admin-only, on the server.
   · GET /api/admin/people/:username/signals — how they joined, where
     they've signed in and voted from, the accounts that share a network
     with them, and plain reasons to look twice.
   · GET /api/admin/events/:id/vote-check — for each entry: votes, how
     many from accounts under a week old, how many from voters who share
     a network with another voter for that same entry, and the countries;
     then every network with two or more voters, who they are and what
     they voted for.
   Networks are shown as "Network 3f9a…" (the start of the hash): the
   same label means the same address, nothing more.
================================================================ */
const SIG_THROWAWAY = new Set(["mailinator.com", "guerrillamail.com", "10minutemail.com", "tempmail.com", "temp-mail.org", "yopmail.com", "trashmail.com", "sharklasers.com",
  "getnada.com", "dispostable.com", "maildrop.cc", "throwawaymail.com", "fakeinbox.com", "mintemail.com", "emailondeck.com", "tempail.com", "mohmal.com", "moakt.com", "1secmail.com", "burnermail.io"]);
/* Where a network's country sits, by continent, to compare with the phone's clock (a VPN shows up as a mismatch). */
const SIG_ZONE = {};
for (const [z, cs] of Object.entries({ America: "US CA MX BR AR CO CL PE VE EC GT CU DO PR JM TT BO PY UY CR PA HN SV NI BS BB",
  Europe: "GB IE FR DE ES PT IT NL BE LU CH AT SE NO DK FI IS PL CZ SK HU RO BG GR HR SI RS BA ME MK AL UA BY LT LV EE MD RU MT CY",
  Asia: "IN PK BD LK NP PH ID MY SG TH VN KH JP KR CN HK TW MN AE SA QA KW BH OM IL JO LB IQ IR KZ UZ",
  Africa: "NG GH KE ZA EG MA DZ TN ET UG TZ SN CI CM ZW ZM RW", Australia: "AU" })) for (const c of cs.split(" ")) SIG_ZONE[c] = z;
const sigTzOff = (country, tz) => { const z = SIG_ZONE[country]; if (!z || !tz) return false;
  const head = tz.split("/")[0]; if (country === "TR") return head !== "Europe" && head !== "Asia";
  if (z === "Australia") return head !== "Australia" && head !== "Antarctica";
  if (z === "Europe" && tz === "Atlantic/Reykjavik") return false;
  if (country === "US" && tz === "Pacific/Honolulu") return false;
  return head !== z; };
const sigWhere = (r) => [r.city, r.region].filter(Boolean).join(", ");
const sigLabel = (net) => (net ? "Network " + net.slice(0, 4) : "Unknown network");
const SIG_FRESH_MS = 7 * 86400000;

app.get("/api/admin/people/:username/signals", auth, admin, (req, res) => {
  const u = q.userByName.get(String(req.params.username || "").toLowerCase());
  if (!u) return res.status(404).json({ error: "No such member." });
  const j = db.prepare(`SELECT * FROM join_signals WHERE user_id = ?`).get(u.id) || null;
  const seen = db.prepare(`SELECT s.kind, s.net, s.country, s.city, s.region, s.tz, s.device, s.at, s.entry_id, e.title event FROM member_signals s LEFT JOIN events e ON e.id = s.event_id
    WHERE s.user_id = ? ORDER BY s.at DESC LIMIT 40`).all(u.id);
  const nets = [...new Set([j?.net, ...seen.map((s) => s.net)].filter(Boolean))];
  const sharing = nets.length ? db.prepare(`SELECT u.username, u.display_name, u.created_at, COUNT(*) n, GROUP_CONCAT(DISTINCT s.kind) kinds FROM member_signals s JOIN users u ON u.id = s.user_id
    WHERE s.net IN (${nets.map(() => "?").join(",")}) AND s.user_id != ? GROUP BY s.user_id ORDER BY n DESC LIMIT 30`).all(...nets, u.id) : [];
  const domain = String(u.email || "").split("@")[1]?.toLowerCase() || "";
  const flags = [];
  if (j && j.join_secs != null && j.join_secs < 25) flags.push(`Joined in ${j.join_secs} seconds — faster than a person usually types.`);
  if (SIG_THROWAWAY.has(domain) || emailThrowaway(u.email)) flags.push(`Email from a throwaway inbox service (${domain}).`);
  if (/automated/.test(j?.device || "") || seen.some((s) => /automated/.test(s.device))) flags.push("Used an automated browser or a script, not a phone or a normal browser.");
  if (sharing.length) flags.push(`Shares a network with ${sharing.length} other account${sharing.length === 1 ? "" : "s"}.`);
  const off = [j, ...seen].find((r) => r && sigTzOff(r.country, r.tz));
  if (off) flags.push(`Their phone's clock is set to ${off.tz}, but the network is in ${off.country} — a VPN or proxy, or travelling.`);
  const places = new Set([j, ...seen].filter((r) => r && r.country).map((r) => r.country));
  if (places.size > 2) flags.push(`Seen from ${places.size} countries: ${[...places].join(", ")}.`);
  const fresh = Date.now() - u.created_at < SIG_FRESH_MS;
  if (fresh && seen.some((s) => s.kind === "vote")) flags.push("Voted within a week of joining.");
  res.json({
    joined: j ? { at: j.created_at, network: sigLabel(j.net), country: j.country, place: sigWhere(j), tz: j.tz, device: j.device, via: j.via, landing: j.landing, referrer: j.referrer,
      firstSeen: j.first_seen, joinSecs: j.join_secs } : null,
    seen: seen.map((s) => ({ kind: s.kind, network: sigLabel(s.net), country: s.country, place: sigWhere(s), tz: s.tz, device: s.device, at: s.at, event: s.event || null, entryId: s.entry_id })),
    sharing: sharing.map((s) => ({ username: s.username, displayName: s.display_name, joinedAt: s.created_at, times: s.n, kinds: String(s.kinds || "").split(",") })),
    emailDomain: domain, flags, recordedSince: "2026-10-26",
  });
});

app.get("/api/admin/events/:id/vote-check", auth, admin, (req, res) => {
  const ev = db.prepare(`SELECT id, title FROM events WHERE id = ?`).get(Number(req.params.id) || 0);
  if (!ev) return res.status(404).json({ error: "No such event." });
  const rows = db.prepare(`SELECT s.user_id, s.entry_id, s.net, s.country, s.city, s.region, s.tz, s.device, s.at, u.username, u.created_at FROM member_signals s JOIN users u ON u.id = s.user_id
    WHERE s.kind = 'vote' AND s.event_id = ?`).all(ev.id);
  const now = Date.now();
  /* networks with two or more different voters */
  const byNet = new Map();
  for (const r of rows) { if (!r.net) continue; const g = byNet.get(r.net) || { voters: new Map(), entries: new Map(), countries: new Set(), places: new Set(), votes: 0 };
    g.voters.set(r.user_id, r.username); g.entries.set(r.entry_id, (g.entries.get(r.entry_id) || 0) + 1); if (r.country) g.countries.add(r.country); if (sigWhere(r)) g.places.add(sigWhere(r)); g.votes++; byNet.set(r.net, g); }
  const shared = new Set([...byNet].filter(([, g]) => g.voters.size > 1).map(([n]) => n));
  const pair = new Map();   // network + entry → the voters who gave it a vote from there
  for (const r of rows) { const k = r.net + ":" + r.entry_id, s = pair.get(k) || new Set(); s.add(r.user_id); pair.set(k, s); }
  const entries = new Map();
  for (const r of rows) {
    const e = entries.get(r.entry_id) || { entryId: r.entry_id, votes: 0, voters: new Set(), fresh: 0, shared: 0, offClock: 0, countries: {}, places: {}, devices: {} };
    e.votes++; e.voters.add(r.user_id);
    if (now - r.created_at < SIG_FRESH_MS) e.fresh++;
    if (r.net && (pair.get(r.net + ":" + r.entry_id)?.size || 0) > 1) e.shared++;   // someone else voted for this same piece from the same network
    if (r.country) e.countries[r.country] = (e.countries[r.country] || 0) + 1;
    if (sigWhere(r)) e.places[sigWhere(r)] = (e.places[sigWhere(r)] || 0) + 1;
    if (sigTzOff(r.country, r.tz)) e.offClock++;
    const d = (r.device || "Unknown").split(" · ")[1] || r.device || "Unknown"; e.devices[d] = (e.devices[d] || 0) + 1;
    entries.set(r.entry_id, e);
  }
  const who = db.prepare(`SELECT e.id, u.username FROM event_entries e JOIN users u ON u.id = e.user_id WHERE e.event_id = ?`).all(ev.id);
  const author = new Map(who.map((w) => [w.id, w.username]));
  res.json({
    recordedSince: "2026-10-26", total: rows.length,
    entries: [...entries.values()].map((e) => ({ ...e, voters: e.voters.size, author: author.get(e.entryId) || null })).sort((a, b) => b.votes - a.votes),
    clusters: [...byNet].filter(([n]) => shared.has(n)).map(([n, g]) => ({ network: sigLabel(n), countries: [...g.countries], places: [...g.places], votes: g.votes,
      voters: [...g.voters.values()], entries: [...g.entries].map(([id, v]) => ({ entryId: id, author: author.get(id) || null, votes: v })).sort((a, b) => b.votes - a.votes) }))
      .sort((a, b) => b.voters.length - a.voters.length).slice(0, 40),
  });
});

/* WHO VOTED FOR EACH PIECE (2026-10-30): "see who voted for you specifically, and who keeps voting."
   Admin only, never members, never the connector. From the votes themselves (every vote, not just since
   Oct 26): each piece's voters, how many days they voted for it, and whether they've come back every day
   since their first vote — the regulars. */
app.get("/api/admin/events/:id/voters", auth, admin, (req, res) => {
  const ev = db.prepare(`SELECT id, format FROM events WHERE id = ?`).get(Number(req.params.id) || 0);
  if (!ev) return res.status(404).json({ error: "No such event." });
  const rounds = db.prepare(`SELECT stage || ':' || matchup k, MIN(created_at) at FROM event_votes WHERE event_id = ? GROUP BY k ORDER BY at`).all(ev.id).map((r) => r.k);
  const rows = db.prepare(`SELECT v.entry_id, u.username, u.avatar_url, u.created_at joined, COUNT(*) votes, GROUP_CONCAT(DISTINCT v.stage || ':' || v.matchup) ks, MIN(v.created_at) first, MAX(v.created_at) last
    FROM event_votes v JOIN users u ON u.id = v.voter_id WHERE v.event_id = ? GROUP BY v.entry_id, v.voter_id`).all(ev.id);
  const entries = new Map(db.prepare(`SELECT e.id, e.post_id, u.username FROM event_entries e JOIN users u ON u.id = e.user_id WHERE e.event_id = ?`).all(ev.id)
    .map((e) => [e.id, { entryId: e.id, postId: e.post_id, author: e.username, voters: [] }]));
  for (const r of rows) {
    const e = entries.get(r.entry_id); if (!e) continue;
    const ks = String(r.ks || "").split(","), from = Math.min(...ks.map((k) => rounds.indexOf(k)).filter((i) => i >= 0));
    e.voters.push({ username: r.username, photo: !!r.avatar_url, joinedAt: r.joined, votes: r.votes, rounds: ks.length, firstAt: r.first, lastAt: r.last,
      regular: ks.length > 1 && ks.length >= rounds.length - from });
  }
  const list = [...entries.values()].map((e) => ({ ...e, votes: e.voters.reduce((s, v) => s + v.votes, 0), regulars: e.voters.filter((v) => v.regular).length,
    voters: e.voters.sort((a, b) => b.rounds - a.rounds || b.lastAt - a.lastAt) })).sort((a, b) => b.votes - a.votes);
  res.json({ rounds: rounds.length, entries: list });
});
