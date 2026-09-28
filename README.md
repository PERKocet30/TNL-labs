# TNL LABS

**v2.0 · 2026-09-28** · live at [labs.tnllabs.com](https://labs.tnllabs.com)

Social media by creatives, for creatives. TNL LABS is the venue: members post work, collaborate across labs, build standing through what other people confirm, and sell in one shared market. TNL NYC is one seller in that market, on the same terms as everyone else.

One Node server, one SQLite database, no framework and no external services required to run it.

---

## What's in the app

| Area | What it does |
|---|---|
| **The door** | "Enter the lab" landing with the vial loader. The first visit plays the intro film; after that it's one tap in. The tap also unlocks audio on iOS. |
| **Showroom** | The public front page: real work from across every lab, newest first. Anyone can browse; posting needs an account. |
| **Labs** | Members-only, one per genre: `// General`, `// Visual` (design, photo, film and the searchable Archive), `// Music` (Beat Lab, feedback, tracks and the Studio), `// Fashion`, `// Anime`, `// News` and `// Business`. Inside a lab, channels are pill tabs above the conversation. Names are display-only; lab and channel IDs never change, so renaming never moves a post. |
| **Posts** | Instagram-style cards: carousels of up to 10 images, video, a sound from the library, likes, comments, shares, send-to-DM, saves and collab invites. |
| **Profiles** | Instagram-style pages: posts / followers / collabs, level badge, roles, bio, link, and tabs for work, shop, collabs and standing. Every profile has a public URL. |
| **Collabs** | Two-sided: the author invites, the other person accepts, and only then does it count — for both of them. |
| **Market** | Depop-style listings with photos, sizes, quantity runs, offers, saves, checkout through Stripe Connect, shipping, delivery confirmation and reviews. Sound listings with downloads are still supported for existing listings. |
| **Music** | The Studio (beat maker, `public/studio.js`), a sound library, tracks extracted from video, and a sample library other members can build with. |
| **Boards & Archive** | Save anyone's work to your own moodboards; browse every image ever posted. |
| **DMs & notifications** | Direct messages, live notifications and unread badges over a Server-Sent Events stream. |
| **Admin** | `/admin` — the dashboard (see below). |

Design language: Helvetica, `//` marks the labs, paper (light) by default with a dark mode, reagent green `#98FC68` as the one accent, drawn 2px square-cap icons. See `TNL-Design-Language-v1.0` in the project files.

---

## How the code is laid out

The app and the API used to be two single files of 359KB and 216KB. They now live in `src/` as numbered parts of 24KB or less, which are small enough to review and push one at a time. On every boot, `src/assemble.mjs` joins them byte for byte, in filename order.

```
src/app-01…20-*.{html,css,js}   the app          → built into public/index.html
src/server-01…11-*.js           the API          → built into src/server.runtime.js
src/server.js                   entry point: assemble, then start
src/assemble.mjs                the joiner
src/db.js                       schema, migrations, rep engine, levels, fees
src/pay.js                      Stripe Connect
src/mail.js                     email via Resend
public/studio.js                the Studio (beat maker)
public/admin.html               the admin dashboard
public/door.js                  the door's vial loader and mark
public/sw.js                    service worker (installable app, offline shell)
scripts/scientist.mjs           daily read-only checks against the live site
test/                           21 test suites — run with npm test
```

**Edit the parts, never the built files.** `public/index.html` and `src/server.runtime.js` are regenerated on every boot and ignored by git.

| Part | Holds |
|---|---|
| `app-01-head` · `app-06-body` · `app-20-tail` | page markup, meta/OG tags, script tags |
| `app-02…05-styles-*` | styles: base, profile, studio/UI, media |
| `app-07-theme-labs-api` | theme, labs and channels, API client |
| `app-08-state-ui` · `app-09-render-nav` | app state, toasts/modals, routing, top bar |
| `app-10…19` | onboarding/DMs/search, sign-in gate/Showroom, archive/posts, player, listing detail/selling, profile, wiring, market/panels, composer/audio, feed/boot |
| `server-01-boot` | setup, compression, caching rules, Sentry, prepared queries |
| `server-02…11` | auth/feed, uploads/DMs/notifications, admin dashboard, admin controls/backups, settings/payouts/market, orders/sharing, trust/library, archive/boards, collabs/beats/Showroom, social/meta |

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
[assemble] public/index.html: 20 parts, …
[assemble] src/server.runtime.js: 11 parts, …
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
| `/` | the app; its link preview uses `og-cover-v3-2026-09-23.jpg` |

---

## Admin dashboard (`/admin`)

This is admin-only, and the check is enforced on the server.

- **Overview:** confirmed collabs (the number that proves the model), members, posting activity, work published, cross-lab shares, GMV and commission.
- **Funnel and retention:** where people drop off, and whether they come back.
- **Members:** search, verify, adjust rep, feature, suspend.
- **Reports:** reported content.
- **Content, listings and orders:** manage all three.
- **Other tools:** settings, backups, email log and test email, broadcast, error log, Studio telemetry, cleanup, and download the source of the live app.

---

## Health checks

- **Scientist**, a second Railway service, runs `scripts/scientist.mjs` every day at 18:45 UTC. It makes 8 read-only checks against the live site: the app shell, health, Showroom, levels, Market, builders, the 404 path and the verify page. A failure fails the run.
- **Sentry** receives server and browser errors.
- **Admin → Errors** shows the last 100 errors, with 24-hour counts.

---

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

# dm
GET    /api/dm   (auth)
GET    /api/dm/:username   (auth)
POST   /api/dm/:username   (auth)

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
GET    /api/market/checkout/done
GET    /api/market/saved   (auth)
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

# stream
GET    /api/stream

# levels
GET    /api/levels

# labs
GET    /api/labs   (auth)

# builders
GET    /api/builders

# health
GET    /api/health

# admin
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
