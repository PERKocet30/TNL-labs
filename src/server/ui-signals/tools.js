/* ================================================================
   UI SIGNALS · tools v1.1 — 2026-11-09 (speed says what it holds now the load time is gone; an exit is a real leave). v1.0 — 2026-11-04. "I want access to the full admin
   dashboard, not to change things, to see everything and learn how to make
   the UI better." Echo's eyes for how people move (ui-signals/signals.js),
   plus the admin pages that had no tool until now: Settings (the switches,
   never a key), Echo's own help numbers (never a transcript), the
   tournament's spam check (voters stay out: the connector never carries
   who voted for whom, 2026-10-27 — insights_tournament has the counts). Every one is read-only and goes
   through the connector's scrub (connector/tools.js), so Echo and the
   connector see exactly the same thing. Sits after connector/tools.js.
================================================================ */
const uiDaysArg = { type: "integer", description: "Window in days, 1–90. Default 7." };
const uiD = (a) => Math.min(90, Math.max(1, Number(a.days) || 7));
for (const p of ["ui/screens", "ui/paths", "ui/taps", "ui/flows", "ui/empties", "ui/speed", "ui/devices", "ui/features", "settings", "echo", "events/:id/spam"]) MCP_PATHS.add(p);
MCP_TOOLS.push(
  ["screens", "How the app's screens are used: views per screen, how many people, how many of them new (joined this week), median seconds on the screen, exits from it (the person left there — nothing more from them for 30 minutes; a photo picker or a locked phone isn't a leave), back-outs (opened and left straight away) and dead taps (tapped something that did nothing). A screen with many views and short time is a pass-through; many exits or back-outs means people didn't find what they came for.", { days: uiDaysArg }, (a) => `ui/screens?days=${uiD(a)}`],
  ["paths", "Where people go next: the most common screen-to-screen moves, the top three-step routes in one sitting, dead ends (screens where 40%+ of visits end with the person leaving for 30 minutes or more) and which tabs get tapped. Shows the routes members actually take, against the ones the design assumes.", { days: uiDaysArg }, (a) => `ui/paths?days=${uiD(a)}`],
  ["taps", "Taps that went wrong: rage taps (the same control hit three times in a second, from the glitch watcher), dead taps by screen and what was tapped (a picture, a name, text, a card — things people expected to open), and double sends (the same change sent twice because the first felt like nothing happened).", { days: uiDaysArg }, (a) => `ui/taps?days=${uiD(a)}`],
  ["flows", "Things people start and don't finish: a post, a listing, a checkout, a tournament entry, an offer, a collab invite, a group chat — started, done, abandoned, finish rate. The sign-up funnel is the funnel tool; the sell walkthrough's steps are in sellers.", { days: uiDaysArg }, (a) => `ui/flows?days=${uiD(a)}`],
  ["empties", "Empty screens people land on (no posts yet, no results, nothing here) and what they did next — left, acted, or stayed — plus searches that found nothing, as counted words (never the sentence). What people look for and can't find.", { days: uiDaysArg }, (a) => `ui/empties?days=${uiD(a)}`],
  ["speed", "What doesn't load on members' real phones: pictures and sounds that failed to load by screen, uploads that failed and why (too big, wrong type, network), and the screens the glitch watcher saw waiting more than 3 seconds on the server.", { days: uiDaysArg }, (a) => `ui/speed?days=${uiD(a)}`],
  ["devices", "What the app is being looked at on: screen-width buckets (small phones squeeze layouts), dark vs light mode, reduced motion, larger text — as shares of sessions. Browser and the Instagram in-app share are in the audience tool.", { days: uiDaysArg }, (a) => `ui/devices?days=${uiD(a)}`],
  ["features_use", "Which features members actually use: for each (Studio, collabs, offers, group chats, tournament entries, selling, messages, playlists) how many members have used it in the window, what share of all members, how many never have, and the median days from joining to first use. A feature almost nobody finds usually has an interface problem.", { days: uiDaysArg }, (a) => `ui/features?days=${uiD(a)}`],
  ["settings", "Admin → Settings as it stands: every switch and its value (sign-ups open, guest access, market, Studio, Echo open to members, sign-in buttons, the announcement, the distribution offer…) with the defaults beside them. Never a key or secret — those live in Railway, not here.", {}, "settings"],
  ["echo_stats", "Admin → Echo, the members' help: how many asked, answered, rated, liked; what it missed (the same words asked by several people fold into one line); every taught answer with how often it was used and rated; which Knowledge entries answered; open handoffs (who and when, never the conversation).", { days: { type: "integer", description: "Window in days. Default 30." } }, (a) => `echo?days=${Math.min(365, Math.max(1, Number(a.days) || 30))}`],
  ["event_spam", "One tournament's spam check: groups of accounts that look like one person (same phone, same network, same minute), their size and what links them. Counts and usernames, never the network itself.", { id: { type: "integer" } }, (a) => `events/${Math.max(0, Number(a.id) || 0)}/spam`],
);
