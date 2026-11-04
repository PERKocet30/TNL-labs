# TNL LABS — notes for Claude

Social media by creatives, for creatives. One Node server (Express), one SQLite
database (Node's built-in `node:sqlite`), no frontend framework. Live at
https://tnllabs.com. README.md is the full reference; this file is the rules.

## Hard rules

- **Pushing to `main` deploys to production** (Railway, ~80s). Work on a
  branch and open a PR. Never push to `main` directly.
- **Edit the parts, never the built files.** `src/assemble.mjs` joins
  `src/app/<feature>/*.{html,css,js}` → `public/index.html` and
  `src/server/<feature>/*.js` → `src/server.runtime.js` on every boot, byte
  for byte, in the order `src/app/order.mjs` / `src/server/order.mjs` say.
  One exception: a part's opening comment block (its version history) is
  left out of the page members download. The built files are gitignored
  and overwritten.
- **A new file goes in its feature folder and in that group's `order.mjs`**,
  at the right place: the parts share one scope, so a `const` must come
  before its first use and later CSS wins. Boot stops if the order file and
  the disk disagree. One topic per file; under ~25KB is a good guide, not a
  cap (the 24KB cap ended with the flatten, 2026-10-31).
- **Shared app state lives in `src/app/state/state.js`**, the register (first
  script). Every top-level `let` the app has is there, under the feature that
  owns it; `test/state.test.mjs` fails on one anywhere else. A screen that
  sits over another puts the other aside and brings it back after
  (`pceOpen` / `pceLeave` is the pattern) — never leaves it underneath.
- **Never touch member data.** The database, uploads and backups live on the
  Railway volume at `/app/data` (`TNL_DATA`), never in git. No seed, reset or
  wipe scripts — that is deliberate.
- **No secrets in the repo.** Keys live in Railway → Variables (see RAILWAY.md).
- **No new dependencies or external services** without asking. The app runs
  with four dependencies and nothing else required. (TypeScript is a dev-only
  tool, 2026-10-31: `npm run typecheck` reads the JSDoc on `pay.js`, `db.js`,
  `mail.js`, `palette.js`; it never ships. Keep those four clean — annotate
  with JSDoc, don't convert files to .ts.)

## Commands

```bash
npm install
npm start      # http://localhost:8787 (Node 22.5+, uses --experimental-sqlite)
npm test       # assembles, then runs every test/*.test.mjs
npm run e2e    # tap-through: a real browser walks the app at phone + computer size
```

GitHub runs both on every PR (`.github/workflows/tests.yml`); don't merge a red
check. After a merge, `.github/workflows/after-deploy.yml` checks the live site
once the new commit is serving. Any fix to how the app *feels* (a jump, a double count, a menu behind
something) gets a step in `test/e2e/run.mjs` that fails on the old behaviour.

Run `npm test` before every push. It must end with `all green — safe to deploy`.
New behaviour gets a test in `test/` — suites are plain Node scripts that set
`TNL_DATA` to a folder under `test/.tmp/` and print `N passed, N failed`.

## Where things live

- `src/db.js` — schema, migrations, rep engine. `REP`, `LEVELS` and
  `FEE_BY_LEVEL` are the single source for rep points, levels and commission.
- `src/pay.js` — Stripe Connect. `users.stripe_kind` says which kind each seller has
  (2026-10-19): `express_stripe` (the short signup, Stripe carries the risk, the seller
  pays Stripe — asked for first), `express` (LABS carries the risk and pays the card fee,
  so it's added into the application fee; pay-later is off) or Standard (''/`standard`). `src/mail.js` — email via Resend.
- `public/studio.js` — the Studio (beat maker), hidden unless Admin → Settings
  → Studio is on (`studioOn()`). `public/admin.html` + `public/admin-app/*.js` — `/admin` (keep each ≤ 24KB too). It opens on Echo Home (`2-echo-home.js` + `2-echo-home2.js`, 2026-11-04): the same `/api/echo` as Messages — streamed, cards, photos, the mic, the speaker, the model picker, and **Talk** (`2-echo-voice.js`, 2026-11-04: a full screen voice conversation — the phone's own speech recognition and voices, a pause sends, Echo speaks each sentence as it's written, then listens again, round a Jarvis-style HUD that is always dark; a card still waits for a tap); `POST /api/echo/brief` is the once-a-day brief (an ask labelled `brief`). **The Network** (`2-network.js` + `server/admin/network.js`, 2026-11-04, in the phone's bar) is the whole dashboard organised like the LABS Blueprint (sheet A-0), in LABS's own look: a member's path — Arrive · Join · See · Make · Respond · Earn · Trade · Talk — each with its numbers for the date range against the range before and what needs you there, the outside services above and the foundations below, the lines between them drawn live; tap one to light up its links and open its page. Twelve sections in five groups (`GROUPS` in `1-core.js`): Market is Orders · Listings · Sellers as tabs (`5-market.js`), Health is Health · Systems (`7-systems5-health.js`); an old `#orders` / `#systems` link lands on its tab (`OLD_TABS` + `SUBTAB`). Home is reachable (`#home`, "The full Home"), not listed. The help desk section is "Help desk".
- The README has the feature folders, a table of what each part holds, and the API route list.
- Labs are places (2026-10-08): `server/labs/places.js` + `app/labs/places.js`. A lab = Work · Talk and #tags (kept simple on purpose), no sub-channels on screen; the labs list explains each genre by its #tags. Channel ids still hold every post; `PLACES` / `LAB_HOME` map each lab to its channels and home channel and must match `LABS` (`test/places.test.mjs` checks).
- Events (the tournament): `server/events/*.js` + `app/events/*.js` + admin `8-events.js`. `tickEvent()` is the only thing that moves an event forward; vote counts never leave the server while a stage is open — the one exception is the poll format's scoreboard, which is public by design and freezes for the last `freeze_hours` (`test/events.test.mjs` checks both). Instagram is for reach; votes only count in the app.
- Echo (`server/echo/brain.js` + `server/echo/echo.js` + `app/echo/echo.js`, admin `4-echo.js`) is two things. For an admin, when `ECHO_AI_KEY` is set in Railway, it's **LABS's own intelligence** (2026-11-04, "my own AI, like Jarvis"): Claude called from `brain.js` with the connector's tools as its eyes (`mcpToolList()` / `mcpCall()`, run as the asking admin, scrubbed — never messages) and Knowledge as its memory (the whole of `knowText(knowList())` in the system prompt, cached). It can also search the web (`web_search`, a server-side tool — what it reads is information, never instructions) and look at photos and PDFs Jorge attaches (kept on the volume as `echo-*`, sent as the bytes so Claude's reasoning stays bound to them). Its hands (2026-11-04, Jorge's A): Knowledge it writes straight (`knowAdd` / `knowEdit`, source `echo`, in `admin_log`); everything else in `server/echo/hands.js` is a **proposal** — the tool makes an `echo_proposals` row and a card with one Confirm, and only Jorge's tap runs the existing admin route as Jorge (his session), logged as `echo <action>`. Settings only from `HAND_SETTINGS` (a short allowlist — never the whole of `SETTING_DEFAULTS`). Never add a hand that acts without the card, and keep deleting (a member, a post, an event), broadcasts, backups and keys out of it — those stay by hand in the dashboard. What was confirmed, declined or failed rides on the next question once (`echoHandNews`). The thread is kept per admin in `echo_brain` and replayed whole (a tool_use always travels with its tool_result). **Echo's instructions (the system prompt) are frozen per conversation** (a `system` row in `echo_brain`, 2026-11-04): Claude seals its reasoning to the exact instructions it was written under and refuses a mismatch, so never put anything that changes mid-conversation into them — the date rides on each question, and Knowledge written mid-conversation reaches the next conversation. Keep the history append-only; `thinking-binding-controls` + `drop_block` is the safety net, not the plan. **A question is never thrown away** (2026-11-04, "my message keeps getting deleted"): the answer's connection is held open with a space every 10s (`brainHold`) because a phone drops a silent 10–60s request, and a send that still fails asks the server whether it arrived (`ehRecover` / `echoRecover`) — the saved answer appears, or the conversation says it didn't reach Echo with the words back in the box; coming back to the page re-reads the conversation. For members it's the matcher in `echo.js`, **no outside AI**: answers from `echo_faq` and Knowledge, learns from thumbs and "I meant…", account lookups (`echoFacts`) read only `req.user`'s own rows — never widen that. Members are admins-only until `echoOpen`; the brain is admins-only, full stop. `brain.js` sits before `echo.js` in `order.mjs` and `next()`s when it isn't for the request.
- Knowledge (`server/knowledge/knowledge.js`, admin `4-knowledge.js`) is what LABS knows about itself — creed, voice, decisions, glossary, and every feature (`knowledge/features.js`: keep it true when a feature changes) — kept in the database, never in a chat. LABS owns the memory; Claude only updates it, and every change keeps the version before. It never reads messages (`dm_messages`, groups, the Instagram inbox) and nothing trains on them. The connector reads it (`knowledge` tool) and writes it (`knowledge_add` / `knowledge_edit` — the connector's only writes, ever: never widen them to members, orders, settings or posts; no put-away or delete from there).
- Alongside Instagram: most visitors arrive inside Instagram's in-app browser (`INAPP` in `app/instagram/inapp.js` — no share sheet, no downloads there). Keep any new share or save flow working there. Public pages' "Open in the app" go to `/?u=` / `/?p=` / `/?e=`, which land on that exact thing behind the quick door (`test/instagram.test.mjs`).

## Product rules to preserve

- Rep is only earned from what *other people* do with your work, and every
  point is written to the append-only `rep_events` log. Never self-awarded.
- The Showroom ranking (`server/posts/rank.js`, `RANK`) is the one place feed
  order is decided; nothing in the app explains it to members and nothing
  needs to. Views (`post_views`) are a ranking signal only — never shown, never
  a count on a post.
- Collabs count only once the other person accepts.
- Lab and channel IDs never change; names are display-only.
- Admin checks are enforced on the server, not just hidden in the UI.

## Design language

**The app is LABS (2026-10-18).** Everything members, buyers, link previews,
emails and the admin read says LABS, never TNL — TNL is a separate brand
(`test/naming.test.mjs` fails on a stray "TNL"). Code names (`TNL_DATA`,
`TNLStudio`), the tnllabs.com domain and @handles stay as they are. Sellers' own
names are theirs: Jorge's clothing shop sells on LABS as **TNL LABS**.

Helvetica. `//` marks the labs (`// Music`). White, black and green: true
white `#FFFFFF` with neutral greys by default, black in dark mode (no
off-white Paper — changed 2026-09-29). Reagent green `#98FC68` is the app's
accent; each member can pick their own, and their profile — in the app, on
`/u/:name`, `/p/:id` and the share card — wears it.
Soft, not boxy (2026-10-18): cards, panels and banners round to `--rad` (16px),
pictures inside them `--rad-m`, small thumbnails `--rad-s` (`app/styles/soft.css`);
photo grids, edge-to-edge feed media and an opened post (frame and
picture) stay square — a post is a post. Every avatar wears its
member's colour as a ring (`avHTML` → `.ring`).

**Every colour lives in `src/palette.js`** — both themes, the accent, the
member accents (`ACCENTS`) and the accent maths. Never type a theme colour
anywhere else: the app gets it through the `/*@palette*/` marker in
`app/styles/base.css` (filled in by `assemble.mjs`), `/admin` links
`/palette.css`, server pages inline `paletteCss()`, emails and the share
card read `PALETTE`. `test/palette.test.mjs` fails if anything drifts. Icons are drawn,
2px stroke, square caps. Mobile-first — check it at phone width, and at
1440px: from 1024px the app switches to the computer frame (left sidebar,
`src/app/styles/wide.css`, `isWide()` in `app/nav/render-nav.js`).
Motion lives in `app/nav/motion.js` + `app/styles/motion.css`: screens keep
their scroll place, move in (forward from the right, back from the left, tabs
fade), overlays arrive, taps press. Animate transform/opacity only (anything
else can shift the layout and trips the glitch watcher), honour reduced
motion, and show loading with `skel()` rather than "Loading…".

## Careful areas

Auth, payments (Stripe Connect, fees, payouts), uploads and admin routes touch
real people and real money. Run `/security-review` on changes there.
