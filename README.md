# TNL LABS

**v2.1 · 2026-09-29** · live at [labs.tnllabs.com](https://labs.tnllabs.com)

Social media by creatives, for creatives. TNL LABS is the venue: members post work, collaborate across labs, build standing through what other people confirm, and sell in one shared market. TNL NYC is one seller in that market, on the same terms as everyone else.

One Node server, one SQLite database, no framework and no external services required to run it.

---

## What's in the app

| Area | What it does |
|---|---|
| **The door** | "Enter the lab" landing with the vial loader. The first visit plays the intro film; after that it's one tap in. The tap also unlocks audio on iOS. |
| **Showroom** | The public front page: real work from across every lab, newest first. Anyone can browse; posting needs an account. |
| **Labs** | Members-only, one per genre: `// General`, `// Visual` (design, photo, film and the searchable Archive), `// Music` (tracks, feedback and chat), `// Fashion`, `// Anime`, `// News` and `// Business`. Inside a lab, channels are pill tabs above the conversation. Names are display-only; lab and channel IDs never change, so renaming never moves a post. |
| **Posts** | Instagram-style cards: carousels of up to 10 images, video, a sound from the library, likes, comments, shares, send-to-DM, saves and collab invites. The **post creator** shows the work large (swipe, reorder, per-photo upload progress), a caption with @mention suggestions, and three rows: invite collaborators (up to 5, invited as soon as the post exists), add music, and share to a lab (otherwise it goes to your profile only). |
| **Profiles** | Instagram-style pages: posts / followers / collabs, level badge, roles, bio, link, and tabs for work, shop, collabs and standing. Every profile has a public URL. |
| **Collabs** | Two-sided: the author invites, the other person accepts, and only then does it count — for both of them. |
| **Market** | Depop-style browsing; listing works like a Shopify product form — Media (up to 8, tap to set the cover), Title & description, Pricing (live "you earn"), Inventory, Shipping, Details, and Status when editing. Offers, saves, checkout through Stripe Connect, shipping, delivery confirmation and reviews. Sound listings with downloads are still supported for existing listings. |
| **Music** | The Music lab is a music player: members upload tracks (or pull the audio from a video they posted), anyone presses play. The player bar has cover, previous / next, tap-to-seek and time, moves on to the next track by itself, and works with lock-screen and headphone controls. It stays in the labs; a post's own sound plays only while you're on that post. The Studio beat maker (`public/studio.js`) is hidden unless Admin → Settings → Studio is on; beats already posted still play. |
| **Boards & Archive** | Save anyone's work to your own moodboards; browse every image ever posted. |
| **DMs & notifications** | Direct messages, live notifications and unread badges over a Server-Sent Events stream. |
| **Phone and computer** | Phones get the app as designed: top bar, bottom nav. From 1024px wide (laptops, monitors) the top bar and nav become one left sidebar with labels and a full-width Post button, pages sit at a reading width beside it, and a mouse gets hover states. Resizing a window switches layouts on the spot. |
| **Admin** | `/admin` — the dashboard (see below). |

Design language: Helvetica, `//` marks the labs, paper (light) by default with a dark mode, reagent green `#98FC68` as the one accent, drawn 2px square-cap icons. See `TNL-Design-Language-v1.0` in the project files.

---

## How the code is laid out

The app and the API used to be two single files of 359KB and 216KB. They now live in `src/` as numbered parts of 24KB or less, which are small enough to review and push one at a time. On every boot, `src/assemble.mjs` joins them byte for byte, in filename order.

```
src/app-NN-*.{html,css,js}      the app (37 parts) → built into public/index.html
src/server-NN-*.js              the API (18 parts) → built into src/server.runtime.js
src/server.js                   entry point: assemble, then start
src/assemble.mjs                the joiner
src/db.js                       schema, migrations, rep engine, levels, fees
src/pay.js                      Stripe Connect
src/mail.js                     email via Resend
public/studio.js                the Studio (beat maker; off by default, loads only when used)
public/admin.html               the admin dashboard (shell; app in public/admin-app/)
public/door.js                  the door's vial loader and mark
public/sw.js                    service worker (installable app, offline shell)
scripts/scientist.mjs           daily read-only checks against the live site
test/                           43 test suites — run with npm test
```

**Edit the parts, never the built files.** Parts join in filename order, so two parts can share a number (`app-11-gate-logic`, `app-11-gate-screens`, `app-11-showroom`). `public/index.html` and `src/server.runtime.js` are regenerated on every boot and ignored by git.

| Part | Holds |
|---|---|
| `app-01-head` · `app-06-body` · `app-20-tail` | page markup, meta/OG tags, script tags |
| `app-02…05-styles-*` | styles: base, profile, studio/UI, chat, post creator (`compose`), icons, media, listing editor (`sell`), the listing page (`listing`), and the computer layout (`wide`, loads last) |
| `app-07-theme-labs-api` | theme, labs and channels, API client |
| `app-08-images` | image quality (posts and tournament entries): the original kept up to 3000px (hidden data stripped), 1440px feed and 480px grid copies, `srcset` so screens get the sharp one |
| `app-08-state-ui` · `app-09-render-nav` | app state, toasts/modals, routing, top bar; `render()` picks the phone or computer frame and keeps your scroll place across repaints |
| `app-10-chat-1…6` | Messages v2 (2026-09-29): chat kit, inbox + chat screen, composer/voice notes, sheets (new chat, group, forward, mute), the signed-in live stream, lab rooms as chat |
| `app-10-dm-search` | search, the door |
| `app-11-gate-screens` · `app-11-gate-logic` | sign-up and log-in screens and their logic |
| `app-11-showroom` · `app-12…13` (`app-12-post-extras`: tags, place, comments off and "Shop this post" on a card) | Showroom, lab index, archive/posts; the Music lab (`app-13-tracks-player`) and the player bar and queue (`app-13-player`) |
| `app-14-detail-sell` · `app-14-listing` · `app-14-sell-variants` | orders and the listing editor; the listing page (photos, size/colour picker, the pinned Buy bar, the pinch-zoom photo viewer); the editor's sizes & colours |
| `app-15-profile` · `app-15-profile-edit` · `app-16` | profile v2 (≡ / ⋯ menus, followers/following, pinned, tagged), the Instagram-style edit page, wiring |
| `app-17-bag` | the bag (one checkout per seller), recently viewed, price-drop tags, listing drafts, Duplicate, your shop's numbers |
| `app-17-event-1` · `app-17-event-2` · `app-17-event-3-poll` | Events (2026-10-06, poll 2026-10-07): the tournament screen — brief, enter sheet, gallery, picks, bracket, judges' scores, results — the Showroom banner, and the poll's scoreboard, Instagram vote-link landing (`EVFOCUS`) and Share to Instagram sheet; styles in `app-05-styles-event` |
| `app-17-market` · `app-17-panels` | market wiring and the listing editor's logic; panels, DMs, Studio mount |
| `app-18-composer` · `app-18-media` · `app-18-photo-edit` · `app-18-post-queue` | the post creator; carousels, video autoplay, music and the audio unlock; the photo editor (crop, filters, adjust — on the phone); posting in the background, drafts, drag to reorder |
| `app-19-feed-boot` | feed, badges, boot |
| `server-01-boot` | setup, compression, caching rules, Sentry, prepared queries |
| `server-02…11` | auth/feed, uploads/notifications, admin dashboard, admin controls/backups, settings/payouts/market, orders/sharing, trust/library, archive/boards, collabs/beats/Showroom, social/meta |
| `server-11-profile` | profile v2: links, pronouns, pins (`/api/me/pins`), followers/following lists, the Tagged tab, "Followed by" |
| `server-02-post-extras` | a post's people tagged, place, comments on/off and products from your own shop (`posts.extras`) |
| `server-07-cart` | the bag checkout (several items from one seller, one payment, shipping combined — `sessionFits()` binds a paid session to its whole group), `/api/shop/stats` |
| `server-06-market-stock` | sizes and colours: every unit sold goes through `takeStock()` (the size picked, the listing closes at zero) |
| `server-10-dm-core` · `-dm-groups` · `-dm-routes` | Messages v2: schema migration (groups; backup first), requests, replies, reactions, edit/unsend, forward, mute |
| `server-10-links` · `server-10-live` | link previews behind a DNS-level SSRF guard; the signed-in live stream, typing, presence, lab reactions and pins |
| `server-10-events-1-core` · `-2-routes` · `-3-admin` · `-4-cards` · `-5-pages` | Events: the schema and state machine (`tickEvent()`: submit → vote → bracket rounds → judged final → results, idempotent, runs every minute), entering/voting/judging, the poll's scoreboard (`evBoard`), admin, the Instagram cards (entry Story, scoreboard post/Story) and the public `/e/:slug`, `/rules`, `/board` and `/e/:slug/:entry` pages |

---

## Working on it

Requires **Node 22.5+** (built-in SQLite).

```bash
npm install
npm start      # http://localhost:8787
npm test       # assembles, then runs every suite
```

**Deploying:** push to `main`. Railway rebuilds and restarts in about 80 seconds. The deploy log should show:

```
[assemble] public/index.html: 37 parts, …
[assemble] src/server.runtime.js: 18 parts, …
[db] using /app/data/tnl.db
│ in the lab  N members · N posts · N confirmed collabs
```

If the `[db]` line shows anything other than `/app/data`, the data is on temporary disk. Stop and fix the volume.

---

## Configuration

Set in Railway → Variables. Values are secret and never go in this repo.

| Variable | Needed for |
|---|---|
| `TNL_DATA` | `/app/data` — puts the database, uploads and backups on the persistent volume. **Required.** |
| `PUBLIC_URL` | `https://labs.tnllabs.com` — builds email links, Stripe redirects and share links |
| `ADMIN_EMAIL` | promotes that account to admin on boot |
| `RESEND_API_KEY`, `MAIL_FROM` | real email (verification, password reset). Without them, links show on screen instead. |
| `STRIPE_SECRET_KEY` | Market checkout and seller payouts |
| `SENTRY_DSN` | optional; overrides the built-in error-reporting address |

Things that change without a deploy live in **Admin → Settings**: signups open, auto-verify, guest access, market open, minimum rep to sell, loops/studio on or off, the distribution offer, the announcement banner, headline and tagline.

---

## Data and backups

Members' accounts, posts, uploads and rep live on the Railway volume at `/app/data`, never in git.

- The server writes a **daily backup** of the database to `/app/data/backups` and keeps the last 7. You can also make and download one from Admin → Backups.
- Uploaded media is on the same volume and is **not** in those backups yet. An off-platform copy (object storage) is the top open item.
- There is deliberately no seed or reset script. Nothing in the repo can wipe the lab.

---

## Rep and levels

Rep is never earned by posting. It comes only from what other people do with your work, and every point is written to an append-only `rep_events` log, so anyone's standing can be recomputed from scratch.

| Event | Who earns | Rep |
|---|---|---|
| Your work is liked | author | +6 |
| Your work is reshared | original author | +3 |
| Your work is saved to someone's board | author | +3 |
| Someone builds with a sound you shared | sound owner | +4 |
| A collab is accepted | both people | +20 each |
| Someone buys from you | seller | +15 |
| The buyer confirms delivery | seller | +10 |
| Founder feature | featured member | +40 |

| Level | Rep | Market commission |
|---|---|---|
| L1 Entry | 0 | 10% |
| L2 Verified | 40 | 8% |
| L3 Collaborator | 120 | 6% |
| L4 Core | 280 | 4% |
| L5 Leadership | 560 | 2% |

Rep values live in `REP`, levels in `LEVELS`, and commission in `FEE_BY_LEVEL`, all in `src/db.js`.

---

## Accounts

- **Sign-up** is one question per screen, Instagram-style: email → password → name → username (checked live, with suggestions when taken) → what you make. That creates the account; then profile photo → people to follow → welcome. The phone's back swipe steps back through it.
- Sign in with **username or email**. Both ignore capital letters, and a leading `@` on a username is fine.
- A new account has full access straight away. The confirmation email still goes out, but it doesn't block anyone. Admin → Settings → auto-verify controls this.
- Suspending a member from the dashboard ends their sessions on their next request.
- Forgot password sends a one-hour reset link.

---

## Public pages and sharing

| URL | What it is |
|---|---|
| `/u/:username` | a member's public page, rendered on the server so it previews properly |
| `/p/:id` | a single post, with its own link preview |
| `/m/:id` | a Market listing |
| `/e/:slug` · `/e/:slug/rules` | an event and its official rules (draft rules are generated until an admin writes their own) |
| `/e/:slug/board` · `/e/:slug/:entry` | a poll's public scoreboard, and one entry's vote link (its preview is the piece; Vote opens `/?e=slug&v=entry` in the app) |
| `/e/:slug/board.jpg` · `/e/:slug/:entry/story.jpg` | Instagram pictures: the scoreboard (1080×1350, `?size=story` 1080×1920) and an entrant's "Vote for my piece" Story |
| `/` | the app; its link preview uses `og-cover-v3-2026-09-23.jpg` |

---

## Admin dashboard (`/admin`) — v2.0, 2026-09-29

Admin-only; every route checks on the server. `public/admin.html` is the shell and styles, the app is `public/admin-app/1-core.js` … `8-events.js`, and the data comes from `src/server-10-admin.js` plus the older admin routes.

- **Today:** what needs you (reports, orders not shipped after 3 days, backups, errors, stale collab invites, new members to welcome), eight numbers against the previous period (7, 30 or 90 days), a daily chart, the collab loop with who stopped at each step, lab activity and the most active members.
- **People:** search, filter (new, never posted, gone quiet, sellers, unverified, suspended, admins) and sort. Each person opens with their stats, recent posts, rep history, a private admin note, and actions: message, confirm email, adjust rep (with a reason), feature, sign out everywhere, suspend. Message a group from the bottom.
- **Content:** open reports first, then every post, filterable by lab, kind and text; pin, delete. Studio stats live here.
- **Market:** sales, commission, orders by status, top sellers, stale listings.
- **System:** switches and landing text, backups, email test, unused files, errors, and the **admin log** — every change made from the dashboard, with who and when (`admin_log`, written by a hook on `/api/admin` writes).

---

## Health checks

Three layers: stop glitches before they ship, notice the ones that get through, and say so before a member has to.

**Before it ships** (`.github/workflows/tests.yml`, every PR and every push to `main`)
- `npm test`: every `test/*.test.mjs`.
- `npm run e2e`: `test/e2e/run.mjs` starts a throwaway app with test members, work and tracks. A real browser then walks it at phone size (390px, touch) and computer size (1440px):
  - the door, sign-up and the first landing
  - like (counts once, no repaint, no jump) and fast taps
  - share, from the feed and from an opened post
  - the post creator, Music playback and a DM
  - the sidebar and the admin Glitches panel
  - **the whole walk must record zero glitches**
  A red check means don't merge; failure screenshots are attached to the run.

**Once it's live**
- **After every merge** (`.github/workflows/after-deploy.yml`): it waits until `/api/health` reports the new commit, then runs the scientist against the live site. A failure (or a deploy that never lands) turns the run red, and GitHub emails whoever merged.
- **Scientist**, a second Railway service, also runs `scripts/scientist.mjs` every day at 18:45 UTC: 8 read-only checks covering the app shell, health, Showroom, levels, Market, builders, the 404 path and the verify page.
- **Sentry** receives server and browser errors. The alert *New or returning error in TNL LABS* emails on any first-seen, regressed or reappearing issue, at most every 30 minutes.
- **Glitch signals** (`src/app-19-glitch.js` → `src/server-10-glitch.js`): members' own screens report rage taps, screen jumps, slow screens (over 3s) and failed saves. Admin → System shows the 24-hour count and the week's hotspots.
- **Watch emails** (`src/server-10-watch.js`, to `ADMIN_EMAIL` via Resend): an email when something spikes within an hour (3 server errors, 10 app crashes, 3 failed saves, or 8 rage taps / screen jumps / slow screens), at most once per rule per 6 hours. There's also a morning digest at 13:00 UTC with yesterday's members, posts, errors, glitches and worst spots.
- **Admin → System** shows errors and glitches side by side.

---

## Events

The tournament runs on a general events system (`src/server-10-events-*.js`, screens in `src/app-17-event-*.js`, admin in `public/admin-app/8-events.js`). An admin creates an event in **Admin → Events**: title, brief, prize, which lab entries post into, the format, and the dates.

- **Phases.** Entries (one per person, posted as a real work post) → a vote (members pick up to N favourites; counts hidden) → **bracket** format: head-to-head rounds, one pick per pair, decided when each round closes (a tie goes to the higher seed) → the **final**, decided by judges' 1–10 scores and member votes (`judge_weight`, 50/50 by default) → results. The **simple** format skips the bracket: the top N from the vote go to the final.
- **The server decides everything.** `tickEvent()` closes phases on schedule, seeds the bracket (standard seeding; a bracket is the largest power of two that fits), and notifies entrants. "End this phase now" moves every later date earlier by the same amount.
- **Fair play.** No voting for yourself; voters' accounts must be `min_account_days` old; judges can't enter and score the final instead of voting in it. Admins see live tallies, including votes from accounts under 14 days old, and can disqualify.
- **Fewer than two entries** when entries close calls the event off.
- **Poll format** (2026-10-07, what the community asked for): `picks` votes a *day* that add up (stored with the day, yyyymmdd Eastern, in `event_votes.matchup`), a live public scoreboard with places moved in 24h, frozen for the last `freeze_hours` of each stage, then the top N go to a final (judges optional — `judge_weight` 0 means most votes wins). Voters need a confirmed email (`require_verified`).
- **Instagram leads back to the app.** Votes on Instagram never count. Each entry has a vote link (`/e/:slug/:entry`) and a Story card (`story.jpg`) the entrant shares from the app (Share to Instagram) with a link sticker; TNL posts the scoreboard pictures from Admin → Events → Instagram. Someone who signs up or confirms their email mid-vote is brought back to that piece (`tnl-evret`).

## API

135 routes, grouped by area. `(auth)` means a login token is needed; `(admin)` means admin only. This list was generated from the code on 2026-09-28.

```
# auth
GET    /api/auth/username
POST   /api/auth/register
GET    /api/auth/verify
POST   /api/auth/resend   (auth)
GET    /api/auth/status   (auth)
POST   /api/auth/login
POST   /api/auth/logout   (auth)
POST   /api/auth/forgot
POST   /api/auth/reset

# me
GET    /api/me   (auth)
POST   /api/me/avatar   (auth)
PATCH  /api/me   (auth)

# feed
GET    /api/feed   (auth)
GET    /api/feed/showroom

# posts
POST   /api/posts   (auth)
POST   /api/posts/:id/like   (auth)
POST   /api/posts/:id/share   (auth)
PATCH  /api/posts/:id   (auth)
DELETE /api/posts/:id   (auth)
GET    /api/posts/:id/comments
POST   /api/posts/:id/comments   (auth)
POST   /api/posts/:id/comments-off   (auth, author)
POST   /api/posts/:id/send   (auth)
GET    /api/posts/:id/saves   (auth)
POST   /api/posts/:id/collab   (auth)
POST   /api/posts/:id/collab/accept   (auth)

# comments
PATCH  /api/comments/:id   (auth)
DELETE /api/comments/:id   (auth)

# users
POST   /api/users/:username/block   (auth)
POST   /api/users/:username/follow   (auth)
GET    /api/users/:username

# messages (v2, 2026-09-29) — every route checks chat membership
GET    /api/chats            (auth)  inbox: chats, requests, unread (also /api/dm)
GET    /api/chats/with/:username  (auth)  existing 1:1 chat id, never creates one
POST   /api/chats/with/:username  (auth)  send 1:1 (also /api/dm/:username)
POST   /api/chats            (auth)  new group {usernames, title}
GET    /api/chats/:id        (auth)  ?before=<messageId> for older pages; marks read
POST   /api/chats/:id/messages   (auth)  {body, imageUrl|videoUrl|audioUrl (/uploads/ only), audioMs, replyTo}
POST   /api/chats/:id/read | /accept | /clear   (auth)
PATCH  /api/chats/:id        (auth)  rename group
POST   /api/chats/:id/members  ·  DELETE /api/chats/:id/members/:username   (auth)
PATCH  /api/chats/m/:mid  (edit, 15 min)  ·  DELETE /api/chats/m/:mid  (unsend)  ·  POST /api/chats/m/:mid/react
POST   /api/chats/forward  ·  /api/chats/mute  ·  /api/chats/activity   (auth)
POST   /api/typing  ·  /api/posts/:id/react  (auth)  ·  POST /api/posts/:id/pin  (admin)

# notifications
GET    /api/notifications   (auth)
POST   /api/notifications/read   (auth)

# unreads
GET    /api/unreads   (auth)

# search
GET    /api/search

# upload
POST   /api/upload/stream   (auth)
POST   /api/upload   (auth)

# market
GET    /api/market/meta
POST   /api/market/connect   (auth)
GET    /api/market/connect/status   (auth)
GET    /api/market/connect/dashboard   (auth)
GET    /api/market
GET    /api/market/:id
POST   /api/market   (auth)
PATCH  /api/market/:id   (auth)
DELETE /api/market/:id   (auth)
POST   /api/market/:id/like   (auth)
POST   /api/market/:id/offer   (auth)
POST   /api/market/:id/buy   (auth)
POST   /api/cart/checkout   (auth)
POST   /api/cart/check
GET    /api/shop/stats   (auth)
GET    /api/market/checkout/done
GET    /api/market/saved   (auth)
GET    /api/users/:username/followers
GET    /api/users/:username/following
GET    /api/users/:username/tagged
POST   /api/me/pins   (auth)
GET    /api/market/recent   (auth)
POST   /api/market/:id/download   (auth)
GET    /api/market/:id/downloads   (auth)

# offers
POST   /api/offers/:id/:action   (auth)

# orders
GET    /api/orders   (auth)
POST   /api/orders/:id/ship   (auth)
POST   /api/orders/:id/received   (auth)
POST   /api/orders/:id/review   (auth)

# sellers
GET    /api/sellers/:username

# library
GET    /api/library   (auth)
POST   /api/library/:id/use   (auth)

# tracks
POST   /api/tracks/extract   (auth)
GET    /api/tracks/videos   (auth)
GET    /api/tracks   (auth)
POST   /api/tracks   (auth)
POST   /api/tracks/:id/play   (auth)
PATCH  /api/tracks/:id   (auth)
DELETE /api/tracks/:id   (auth)

# samples
GET    /api/samples   (auth)
POST   /api/samples   (auth)
POST   /api/samples/:id/shape   (auth)
POST   /api/samples/:id/share   (auth)
GET    /api/samples/:id/uses   (auth)
PATCH  /api/samples/:id   (auth)
DELETE /api/samples/:id   (auth)

# beats
GET    /api/beats   (auth)
GET    /api/beats/:id   (auth)
POST   /api/beats   (auth)
DELETE /api/beats/:id   (auth)

# studio
POST   /api/studio/event   (auth)

# boards
GET    /api/boards   (auth)
POST   /api/boards   (auth)
GET    /api/boards/:id
DELETE /api/boards/:id   (auth)
POST   /api/boards/:id/pin   (auth)

# pins
DELETE /api/pins/:id   (auth)

# unfurl
POST   /api/unfurl   (auth)

# report
POST   /api/report   (auth)

# stream — signed in: trade the token for a one-use ticket first
POST   /api/stream/ticket   (auth)
GET    /api/stream?ticket=

# levels
GET    /api/levels

# labs
GET    /api/labs   (auth)

# builders
GET    /api/builders

# health
GET    /api/health

# admin
GET    /api/admin/pulse?days=&tz=   (admin)  Today: numbers, series, loop, labs, needs-you
GET    /api/admin/people · /api/admin/people/:username   (admin)
POST   /api/admin/people/:username/note · /signout   (admin)
GET    /api/admin/posts · /api/admin/log   (admin)
GET    /api/admin/overview   (admin)
GET    /api/admin/members   (admin)
POST   /api/admin/members/:username/feature   (admin)
POST   /api/admin/members/:username/verify   (admin)
GET    /api/admin/content   (admin)
GET    /api/admin/orders   (admin)
GET    /api/admin/reports   (admin)
POST   /api/admin/reports/:id/handle   (admin)
DELETE /api/admin/posts/:id   (admin)
GET    /api/admin/funnel   (admin)
GET    /api/admin/retention   (admin)
GET    /api/admin/market   (admin)
POST   /api/admin/members/:username/rep   (admin)
POST   /api/admin/members/:username/suspend   (admin)
DELETE /api/admin/listings/:id   (admin)
POST   /api/admin/broadcast   (admin)
GET    /api/admin/health   (admin)
POST   /api/admin/cleanup   (admin)
POST   /api/admin/test-email   (admin)
GET    /api/admin/mail-log   (admin)
GET    /api/admin/backups   (admin)
POST   /api/admin/backups   (admin)
GET    /api/admin/backups/:name   (admin)
DELETE /api/admin/backups/:name   (admin)
GET    /api/admin/source   (admin)
GET    /api/admin/errors   (admin)
DELETE /api/admin/errors   (admin)
GET    /api/admin/studio   (admin)
GET    /api/admin/settings   (admin)
PATCH  /api/admin/settings   (admin)

# archive
GET    /api/archive

# channels
POST   /api/channels/:channel/read   (auth)

# client-error
POST   /api/client-error

# mentionable
GET    /api/mentionable   (auth)

# pages
GET    /reset
GET    /admin   (admin)
GET    /m/:id
GET    /p/:id
GET    /u/:username

```
