/* ================================================================
   EVENT BADGES v1.1 — 2026-11-05. "Finals badge is a good idea."
   Every member who took part in a tournament keeps a mark of it on
   their profile, once the results are in:
     champion — the winner
     finalist — made the final
     entrant  — entered (and wasn't disqualified)
   Nothing is stored: a badge is read from the event's own results
   (events.state → results, finalists), so it appears the moment
   tickEvent() locks the results and can never drift from them. A void
   event, an unpublished one or a disqualified entry gives no badge.
   Best place first (Champion, Finalist, Entrant), newest first within
   each; one badge per event (the best place reached).
   OG (v1.1 — 2026-11-05, "entrants need something too, it's the first
   tournament"): every badge from the first tournament LABS ever ran
   carries og: true — an OG ribbon on the emblem, whatever the place.
   Tapping a badge opens the event (data-evopen in the app).
================================================================ */
const BADGE_RANK = { champion: 3, finalist: 2, entrant: 1 };

function eventBadges(userId) {
  if (!userId) return [];
  const rows = db.prepare(`
    SELECT ev.id, ev.slug, ev.title, ev.state, e.id AS entry_id
    FROM event_entries e JOIN events ev ON ev.id = e.event_id
    WHERE e.user_id = ? AND e.dq_reason IS NULL AND ev.published = 1
    ORDER BY ev.id DESC, e.id`).all(userId);
  const firstId = db.prepare(`SELECT MIN(id) AS id FROM events WHERE published = 1`).get()?.id;   // the first tournament ever
  const byEvent = new Map();
  for (const r of rows) {
    const st = evJSON(r.state, {});
    if (!st.results || st.void) continue;           // only once the results are locked
    const tier = st.results.winner === r.entry_id ? "champion"
      : (st.finalists || []).includes(r.entry_id) ? "finalist" : "entrant";
    const had = byEvent.get(r.id);
    if (!had || BADGE_RANK[tier] > BADGE_RANK[had.tier]) byEvent.set(r.id, { tier, slug: r.slug, title: r.title, og: r.id === firstId });
  }
  // best place first (Champion leads), then newest — byEvent keeps newest-first order
  return [...byEvent.values()].sort((a, b) => BADGE_RANK[b.tier] - BADGE_RANK[a.tier]);
}
