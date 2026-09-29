# TNL LABS — notes for Claude

Social media by creatives, for creatives. One Node server (Express), one SQLite
database (Node's built-in `node:sqlite`), no frontend framework. Live at
https://labs.tnllabs.com. README.md is the full reference; this file is the rules.

## Hard rules

- **Pushing to `main` deploys to production** (Railway, ~80s). Work on a
  branch and open a PR. Never push to `main` directly.
- **Edit the parts, never the built files.** `src/assemble.mjs` joins
  `src/app-NN-*.{html,css,js}` → `public/index.html` and
  `src/server-NN-*.js` → `src/server.runtime.js` on every boot, byte for byte,
  in filename order. The built files are gitignored and overwritten.
- **Keep every part ≤ 24KB.** Several are already close. If a change would
  push one over, split it into a new part whose filename sorts in the right
  place (e.g. `app-11-gate-logic.js` / `app-11-gate-screens.js`). Parts are
  concatenated with nothing between them, so a split must break at a clean
  boundary.
- **Never touch member data.** The database, uploads and backups live on the
  Railway volume at `/app/data` (`TNL_DATA`), never in git. No seed, reset or
  wipe scripts — that is deliberate.
- **No secrets in the repo.** Keys live in Railway → Variables (see RAILWAY.md).
- **No new dependencies or external services** without asking. The app runs
  with four dependencies and nothing else required.

## Commands

```bash
npm install
npm start      # http://localhost:8787 (Node 22.5+, uses --experimental-sqlite)
npm test       # assembles, then runs every test/*.test.mjs
```

Run `npm test` before every push. It must end with `all green — safe to deploy`.
New behaviour gets a test in `test/` — suites are plain Node scripts that set
`TNL_DATA` to a folder under `test/.tmp/` and print `N passed, N failed`.

## Where things live

- `src/db.js` — schema, migrations, rep engine. `REP`, `LEVELS` and
  `FEE_BY_LEVEL` are the single source for rep points, levels and commission.
- `src/pay.js` — Stripe Connect. `src/mail.js` — email via Resend.
- `public/studio.js` — the Studio (beat maker), hidden unless Admin → Settings
  → Studio is on (`studioOn()`). `public/admin.html` + `public/admin-app/*.js` — `/admin` (keep each ≤ 24KB too).
- The README has a table of what each numbered part holds, and the API route list.

## Product rules to preserve

- Rep is only earned from what *other people* do with your work, and every
  point is written to the append-only `rep_events` log. Never self-awarded.
- Collabs count only once the other person accepts.
- Lab and channel IDs never change; names are display-only.
- Admin checks are enforced on the server, not just hidden in the UI.

## Design language

Helvetica. `//` marks the labs (`// Music`). Paper (light) by default with a
dark mode. Reagent green `#98FC68` is the **one** accent. Icons are drawn,
2px stroke, square caps. Mobile-first — check it at phone width, and at
1440px: from 1024px the app switches to the computer frame (left sidebar,
`src/app-05-styles-wide.css`, `isWide()` in `app-09-render-nav.js`).

## Careful areas

Auth, payments (Stripe Connect, fees, payouts), uploads and admin routes touch
real people and real money. Run `/security-review` on changes there.
