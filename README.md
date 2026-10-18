# TNL LABS

**v2.2 · 2026-10-12** · live at [tnllabs.com](https://tnllabs.com)

Social media by creatives, for creatives. TNL LABS is where creatives post their work, find each other across scenes, make things together and sell what they make. Standing here is earned only from what other people do with your work — likes, shares, collabs both sides confirm, sales — so the people who build the most rise, not the people who post the most.

Labs are places, one per genre, each explained by its #tags. The tournament, the Market and the rep system all run on the same rule: what counts happens inside LABS. Instagram is where people find it; every share card and public page leads back into LABS, where they take part. TNL NYC sells in the Market on the same terms as everyone else.

One Node server, one SQLite database, no framework and no external services required to run it.

---

## What's in the app

| Area | What it does |
|---|---|
| **The door** | "Enter the lab" landing with the vial loader. The first visit plays the intro film; after that it's one tap in. The tap also unlocks audio on iOS. A link from outside gets the quick door and lands on the exact thing it pointed at. |
| **Showroom** | The front page: real work from every lab, ranked by what other people do with it — your own taps never count, and work made together gets a lift. Anyone can browse; posting needs an account. |
| **Labs** | Places, one per genre: `// General`, `// Visual` (every visual art — painting, drawing, illustration, sculpture, design, photo, film), `// Music`, `// Fashion`, `// Anime`, `// News` and `// Business`. Each genre is explained by its #tags. Inside: **Work** (everything made there, narrowed by #tag) and **Talk** (one conversation). Members tag their own work; the labs that match what you make come first. Names are display-only — lab and channel IDs never change. |
| **Posts** | A post is a piece of work: up to 10 images or a video, a song from the library, credits for collaborators (counted once they accept), feedback, shares and saves. The post creator puts the work first, then the caption with #tags and @mentions, then collaborators, music (pick a song or upload one), the lab, people and products. With no photos, a song's cover becomes the picture. |
| **Profiles** | A member's body of work, worn in their own colour: level and what they make up top, then **Work**, **Music** (their songs, the pinned one first), **Shop**, **Collabs** and **Tagged**. Every profile, post and song has a public page. |
| **Collabs** | Two-sided: the author invites, the other person accepts, and only then does it count — for both of them. |
| **Standing** | Rep comes only from what other people do with your work, and every point is logged. Levels (Entry → Leadership) lower your Market fees, and at Core TNL can cover your music's distribution (an admin setting). |
| **Market** | One shared market for what members make: browse by category, list with photos, pricing (a live "you earn"), sizes and colours, inventory and shipping. Offers, saves, one checkout per seller through Stripe Connect, delivery confirmation and reviews. |
| **Music** | The `// Music` lab is TNL's player: Songs and Playlists, a full-screen song with its queue, repeat and shuffle, a bar that carries on as you move through the lab, and lock-screen controls. Members upload songs from the lab or the post creator, each with its own cover. The lab wears the cover of the week's most-played song. A post's own sound plays only while you're on that post. The Studio beat maker is hidden unless Admin → Settings → Studio is on. |
| **The tournament** | One prompt, one entry each, fresh votes every day with a live scoreboard that goes dark for the last hours, then a final. Votes only count in the app; entrants share their own Story card and vote link to bring their people in. |
| **Archive** | Search every image ever posted, in `// Visual`. |
| **Messages & notifications** | Direct and group messages, live notifications and unread badges over a Server-Sent Events stream. A notification opens the thing it's about. Messages is a screen of its own: on a computer your chats sit beside the open conversation, next to the side menu; on a phone it fills the screen. Search your chats once there are more than three. |
| **Sharing** | Share cards for Stories (a post, a profile, a tournament entry), public pages that preview properly in DMs, and links that open the app on the exact thing. |
| **Phone and computer** | Phones get the app as designed: top bar, bottom nav. From 1024px wide the top bar and nav become one left sidebar, pages sit at a reading width beside it, and a mouse gets hover states. Resizing a window switches layouts on the spot. |
| **Admin** | `/admin` — the dashboard (see below). |

Design language: Helvetica, `//` marks the labs, true white by day and black by night, Reagent green `#98FC68` as the one accent, each member in their own colour (nine to choose from in Edit profile; the ring and highlights are the colour itself, text a deeper shade of it that reads at 4.5:1), drawn 2px square-cap icons. Every screen and rule is in the LABS Blueprint (v1.2, 2026-10-11) in the project files.

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
scripts/scientist.mjs           read-only checks against the live site (after each merge + daily)
test/                           51 test suites — run with npm test
```

**Edit the parts, never the built files.** Parts join in filename order, so two parts can share a number (`app-11-gate-logic`, `app-11-gate-screens`, `app-11-showroom`). `public/index.html` and `src/server.runtime.js` are regenerated on every boot and ignored by git.

| Part | Holds |
|---|---|
| `app-01-head` · `app-06-body` · `app-20-tail` | page markup, meta/OG tags, script tags |
| `app-02…05-styles-*` | styles: base, profile, studio/UI, chat, post creator (`compose`), icons, media, listing editor (`sell`), the listing page (`listing`), and the computer layout (`wide`, loads last) |
| `app-07-theme-labs-api` | theme, labs and channels, API client |
| `app-08-images` | image quality (posts and tournament entries): the original kept up to 3000px (hidden data stripped), 1440px feed and 480px grid copies, `srcset` so screens get the sharp one |
| `app-08-state-ui` · `app-09-render-nav` | app state, toasts/modals, routing, top bar; `render()` picks the phone or computer frame and keeps your scroll place across repaints |
| `server-12-report` | `/api/report/daily` — the morning check's locked summary (key: `TNL_REPORT_KEY` in Railway; counts only, nothing personal; `test/report.test.mjs`) |
| `server-12-labs` | `/l/:slug`, a lab's shareable page (`LAB_SLUG`: links name the lab), and `LAB_PITCH` — the line on what to do in each lab (the same lines head each lab in the app, `app-11-places.js`; `test/lab-share.test.mjs` checks) |
| `server-12-seo` | search: `/sitemap.xml` (every public page, nothing private) and `ldJson()` — schema.org structured data on the public pages (profile, post, song, listing, event) |
| `app-09-nav` | back: one trail of screens — every screen change joins it, and the phone's back, swipe-back, ‹ and ✕ all walk it |
| `app-08-upload` | uploads: the streaming upload, retried twice when the connection drops or the server is restarting (502–504), failures reported to Glitches with size, time and reason |
| `app-10-chat-1…6` | Messages v2.1 (2026-10-14: a screen of its own — two columns on a computer, chat search): chat kit, inbox + chat screen, composer/voice notes, sheets (new chat, group, forward, mute), the signed-in live stream, lab rooms as chat |
| `app-10-dm-search` | search, the door |
| `app-11-gate-screens` · `app-11-gate-logic` | sign-up and log-in screens and their logic |
| `app-11-places` | Labs as places (2026-10-08; v1.1 2026-10-09: one list of genres with their #tags, Work · Talk only): a lab's tabs, its home channel (`LAB_HOME`), the #tag page, tag suggestions; styles in `app-05-styles-places` |
| `app-11-gallery` | The Showroom on a computer as a gallery wall (2026-10-18): one piece in the spotlight, ← → / ‹ › / wheel / a click walk along it, only the spotlit piece's song plays (`musBand()`, used by the music observer in `app-18-media`), one swipe or wheel flick = one step; the computer's only Showroom (no grid); styles in `app-05-styles-wide` |
| `app-11-showroom` · `app-12…13` (`app-12-post-extras`: tags, place, comments off and "Shop this post" on a card) | Showroom, lab index, archive/posts; the Music lab (`app-13-tracks-player`), its playlists (`app-13-playlists`: Songs · Playlists, ⊕ on every song and on the bar), the full-screen song (`app-13-nowplaying`: tap a song or the bar) and the player bar and queue (`app-13-player`) |
| `app-14-detail-sell` · `app-14-listing` · `app-14-sell-variants` | orders and the listing editor; the listing page (photos, size/colour picker, the pinned Buy bar, the pinch-zoom photo viewer); the editor's sizes & colours |
| `app-15-profile` · `app-15-profile-edit` · `app-16` | profile v2 (≡ / ⋯ menus, followers/following, pinned, tagged), the edit page (one quiet row per field), wiring |
| `app-17-bag` | the bag (one checkout per seller), recently viewed, price-drop tags, listing drafts, Duplicate, your shop's numbers |
| `app-17-order-done` · `app-05-styles-shop` | "Order confirmed" — back from Stripe the buyer lands on that order (`?checkout=paid&o=`): items, total, where it's going, what happens next; a payment still clearing says "Payment processing" |
| `app-17-event-1` · `app-17-event-2` · `app-17-event-3-poll` | Events (2026-10-06, poll 2026-10-07): the tournament screen — brief, enter sheet, gallery, picks, bracket, judges' scores, results — the Showroom banner, and the poll's scoreboard, Instagram vote-link landing (`EVFOCUS`) and Share to Instagram sheet; styles in `app-05-styles-event` |
| `app-17-market` · `app-17-panels` | market wiring and the listing editor's logic; panels, DMs, Studio mount |
| `app-18-composer` · `app-18-media` · `app-18-photo-edit` · `app-18-post-queue` · `app-18-video-edit` | the post creator; carousels, video autoplay, music and the audio unlock; the photo editor (crop, filters, adjust — on the phone); posting in the background, drafts, drag to reorder; the video editor (trim, cover from a frame or the camera roll, sound on/off, frame shape — kept as instructions on the post in `extras.video`, never re-encoded) |
| `app-19-feed-boot` | feed, badges, boot |
| `server-01-boot` | setup, compression, caching rules, Sentry, prepared queries |
| `server-02…11` | auth/feed, uploads/notifications, admin dashboard, admin controls/backups, settings/payouts/market, orders/sharing, trust/library, archive/boards, collabs/beats/Showroom, social/meta |
| `server-11-profile` | profile v2: links, pronouns, pins (`/api/me/pins`), followers/following lists, the Tagged tab, "Followed by" |
| `server-12-policies` | the public policy pages Stripe reviews: `/terms`, `/privacy`, `/policies` (shipping, returns, disputes, prohibited items), `/contact`, `/shop`, and `lookFoot()` — the footer on every server-built page. `SUPPORT_EMAIL` sets the inbox |
| `server-12-video` | old videos fixed on boot (index-first copy, a cover where none); and the light copies made in the background one at a time: for video, 720p/30fps/~1.3 Mbps (`video_feed` → `videoPlayUrl`; the original stays `videoUrl`); for music, 128 kbps AAC (`audio_play` → a track's `url`; the upload stays `fileUrl`) |
| `server-12-story` · `app-18-story-share` | anything on LABS as an Instagram Story: 1080×1920 cards for a post (`/p/:id/story.jpg`, a text post as a quote), a profile (`/u/:name/story.jpg`), a listing (`/m/:id/story.jpg`) and a track (`/tr/:id/story.jpg`); `shareMenu()` — Instagram Story, Send off the app, Copy link — on profiles, listings and tracks, and the post menu's "Instagram Story" sheet: one tap shares the picture and copies the link for a Link sticker |
| `server-12-instagram` · `app-18-instagram` | LABS alongside Instagram: `/m/:id` hands over the app with the listing's own preview (photo, title, price, seller) for Instagram DMs and link stickers (`listingPage()`); inside Instagram's, Facebook's or TikTok's browser (`INAPP`) the home-screen card becomes "Open in Safari", Log in / Join say so, and the Story sheet opens Safari — `openOutside()` tries `x-safari-` / Android `intent://`, then shows ••• → Open in external browser |
| `server-02-post-extras` | a post's people tagged, place, comments on/off and products from your own shop (`posts.extras`) |
| `server-07-cart` | the bag checkout (several items from one seller, one payment, shipping combined — `sessionFits()` binds a paid session to its whole group), `/api/shop/stats` |
| `server-07-orders-sharing` (orders) | buying one item, the checkout return, and settling: `settlePaidOrder()` is the one path; `reconcileAll()` re-checks pending checkouts every 5 minutes, so a buyer who pays and closes the tab still gets their order settled. Checkout (`pay.js` v2.0) offers the seller's own payment methods — Apple Pay, Google Pay, Cash App Pay, Klarna, Link — minus slow bank debits, with cards as the fallback |
| `server-06-market-stock` | sizes and colours: every unit sold goes through `takeStock()` (the size picked, the listing closes at zero) |
| `server-10-dm-core` · `-dm-groups` · `-dm-routes` | Messages v2: schema migration (groups; backup first), requests, replies, reactions, edit/unsend, forward, mute |
| `server-10-links` · `server-10-live` | link previews behind a DNS-level SSRF guard; the signed-in live stream, typing, presence, lab reactions and pins |
| `server-10-places` | Labs as places: `PLACES` (each lab's channels and home), #tags read from captions plus the old channel's tag for posts from before the cutover, and the lab feed / work / tags and #tag routes; pins from any of the lab's channels |
| `server-10-pulse-labs` | Admin · the direction: `/api/admin/direction` — each lab's work, talk and #tags, trending #tags, the tournament and what needs you about it, how people take part. `LAB_NAME` must match `LABS` |
| `server-10-events-1-core` · `-2-routes` · `-3-admin` · `-4-cards` · `-5-pages` · `-6-mail` | Events: the schema and state machine (`tickEvent()`: submit → vote → bracket rounds → judged final → results, idempotent, runs every minute), entering/voting/judging, the poll's scoreboard (`evBoard`), admin, the Instagram cards (entry Story, scoreboard post/Story) and the public `/e/:slug`, `/rules`, `/board` and `/e/:slug/:entry` pages; `-6-mail`: the "entries are open" email to every member, and `/mail/off` |

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
| `PUBLIC_URL` | `https://tnllabs.com` — builds email links, Stripe redirects and share links |
| `ADMIN_EMAIL` | promotes that account to admin on boot |
| `RESEND_API_KEY`, `MAIL_FROM` | real email (verification, password reset). Without them, links show on screen instead. |
| `STRIPE_SECRET_KEY` | Market checkout and seller payouts |
| `SENTRY_DSN` | optional; overrides the built-in error-reporting address |

Things that change without a deploy live in **Admin → System → Settings**: signups open, auto-verify, guest access, market open, minimum rep to sell, loops/studio on or off, the distribution offer and the announcement banner.

---

## Data and backups

Members' accounts, posts, uploads and rep live on the Railway volume at `/app/data`, never in git.

- The server writes a **daily backup** of the database to `/app/data/backups` and keeps the last 7. You can also make and download one from Admin → Backups.
- Uploaded media is on the same volume and is **not** in those backups yet. An off-platform copy (object storage) is the top open item.
- There is deliberately no seed or reset script. Nothing in the repo can wipe the lab.
- **Members' work is not AI training data.** `public/robots.txt` turns AI training crawlers away (search engines and link previews still get in), and every response carries `X-Robots-Tag: noai, noimageai` and `tdm-reservation: 1`. `test/no-ai.test.mjs` checks both.

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

- **Sign-up** is one question per screen: email → password → name → username (checked live, with suggestions when taken) → what you make. That creates the account; then profile photo → people to follow → welcome. The phone's back swipe steps back through it.
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
| `/l/:slug/card.jpg` | a lab's link preview (1080×1080): `// VISUAL`, what to do there, its #tags and "Join at …/l/visual", over the lab's latest work blurred (Music: the newest song cover) |
| `/l/:slug` | a lab, by name — `/l/general`, `/l/visual`, `/l/music`, `/l/fashion`, `/l/anime`, `/l/news`, `/l/business` (`LAB_SLUG`; an old `/l/<id>` link forwards): its name, what to do there (`LAB_PITCH`), its #tags, recent work and "Join and step in" → `/?l=slug` (members land in the lab; everyone else joins first, then lands in it). What a lab's **Share** sends (`server-12-labs.js`) |
| `/e/:slug` · `/e/:slug/rules` | an event and its official rules (draft rules are generated until an admin writes their own) |
| `/e/:slug/board` · `/e/:slug/:entry` | a poll's public scoreboard, and one entry's vote link (its preview is the piece; Vote opens `/?e=slug&v=entry` in the app) |
| `/e/:slug/card.jpg` | the tournament's link preview (1080×1080, square for Instagram's previews): its name, prize and stage over the latest entry, redrawn as the stage changes. `/e/:slug` uses it unless an admin chose a **Cover picture** in Admin → Tournament |
| `/e/:slug/board.jpg` · `/e/:slug/:entry/story.jpg` | Instagram pictures: the scoreboard (1080×1350, `?size=story` 1080×1920) and an entrant's "Vote for my piece" Story |
| `/` | the app; its link preview uses `og-cover-v3-2026-09-23.jpg` |

---

## Admin dashboard (`/admin`) — v3.1, 2026-10-14

Admin-only; every route checks on the server. `public/admin.html` is the shell and base styles, `public/admin-app/ui.css` the shell, People and card styles, and the app is `public/admin-app/1-core.js` … `8-events.js` (People is `3-people.js`, one member's record `3-person.js`). The data comes from `src/server-10-admin.js`, `src/server-10-admin2-members.js`, `src/server-10-pulse-labs.js` plus the older admin routes. Each file stays under 24KB.

- **Every page:** on a computer a side menu (Today, People, Labs, Tournament, Market, System; who's signed in, day/night, Open the app); on a phone the tabs along the top. A search bar finds any member by name, @username or email and opens their record (People has its own search instead). Each page starts with its title, one line on what it's for and its main buttons, then its sections as titled cards (`pageHead`, `card`, `subTabs` in `1-core.js`; any `h2.sec` followed by a panel, list or chart is drawn as one card).
- **Today:** what needs you (reports, orders not shipped after 3 days, backups, errors, stale collab invites, new members to welcome, and the tournament — a draft, entries or voting ending within 48h), the tournament (stage, entries, voters, votes), eight numbers against the previous 7, 30 or 90 days, a daily chart, how people take part, the labs and the #tags people use.
- **People — the member directory:** summary numbers for whatever is filtered or searched (members, active in 30 days, email confirmed, have posted, selling, sales, suspended); **Table** (choose from 18 columns, Compact rows, sticky header and name column, sort by any heading) or **Cards**, remembered per screen size — a phone starts in Cards, a computer in Table; pages of 25, 50 or 100; search as you type; filters (new, never posted, gone quiet, in the tournament, sellers, unverified, suspended, admins); one status word (Active, New, Inactive, Suspended); **Export CSV** of every member (`/api/admin/members.csv` — never a password, session or Stripe id; formula-safe cells; each download in the admin log). Message a group from the bottom.
- **A member's record:** name, member number, status and badges, then Message, Confirm email, Adjust rep (with a reason), Feature +40, Copy email; tabs **Overview** (grouped numbers and "Needs a look"), **Account** (Profile, Contact & sign-in, Payments, Access; sign out everywhere and suspend kept apart at the bottom), **Activity** (recent posts, the rep log with dates) and **Notes** (the private admin note).
- **Labs:** open reports first, then every post, filterable by lab, #tag, work or talk, and text; pin, delete. Tap a lab or a #tag on Today to land here filtered.
- **Tournament:** set up and run events, with the Instagram kit.
- **Market:** sales, commission, orders by status, top sellers, stale listings.
- **System,** in tabs: **Settings** (who can get in, what's open, what people see first), **Health** (database, uploads, errors, glitches, server, unused files), **Backups & email**, and the **Admin log** — every change made from the dashboard, with who and when (`admin_log`, written by a hook on `/api/admin` writes).

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
- **Daily at 18:45 UTC**, the same workflow runs the scientist again (GitHub emails a red run to whoever last edited its cron line). About 27 read-only checks: the shell loads and its scripts compile; `/api/health` reports the database answering, members present (not a fresh empty volume), `TNL_DATA` set, uploads there and a backup in the last 36 hours (yes/no only); `/api/me` and `/api/admin/*` refuse a stranger and `/api` is never cached; the Showroom has work in it; a real profile and post preview with their images, and the profile card renders; missing things 404; the service worker, manifest, palette, door script and icon; each answer under 8s; the certificate has 14+ days left. `test/scientist.test.mjs` runs it against a local copy, full (green) and empty (red).
- **Sentry** receives server and browser errors. The alert *New or returning error in TNL LABS* emails on any first-seen, regressed or reappearing issue, at most every 30 minutes.
- **Glitch signals** (`src/app-19-glitch.js` → `src/server-10-glitch.js`): members' own screens report rage taps, screen jumps, slow screens (over 3s) and failed saves. Admin → System shows the 24-hour count and the week's hotspots.
- **Watch emails** (`src/server-10-watch.js`, to `ADMIN_EMAIL` via Resend): an email when something spikes within an hour (3 server errors, 10 app crashes, 3 failed saves, or 8 rage taps / screen jumps / slow screens), at most once per rule per 6 hours. There's also a morning digest at 13:00 UTC with yesterday's members, posts, errors, glitches and worst spots.
- **Admin → System** shows errors and glitches side by side.

---

## Labs as places

Since 2026-10-08 a lab is a place, one per genre (General, Visual, Music, Fashion, Anime, News, Business), not a server of sub-channels. The labs list shows each genre once, explained by its #tags (`GENRE_TAGS` first, then the tags people use there — `/api/labs/tags`); tapping a tag opens that lab's work narrowed to it. Inside: **Work** (a grid of everything made there, narrowed by #tag) and **Talk** (one conversation). (Open and Pulse were cut on 2026-10-09 to keep it simple.) People #tag their own work in the caption; any #tag opens its page across every lab.

- **No data moved.** Every channel id still holds its posts. Each lab has a home channel (`PLACES` in `server-10-places.js`, `LAB_HOME` in `app-11-places.js`) where new talk and lab posts go; Talk and Work read all of the lab's channels.
- **Old channels became tags.** Posts from before the cutover (`place_meta.cutover`, set on first boot) carry their channel's tag (#photography, #feedback…), worked out when read. Captions are never rewritten.
- **Tools stay:** Music's Work is the tracks library; Visual's archive and boards are one tap from Work; the Studio button is in Music's header.
- `test/places.test.mjs` checks the app and server agree on the map, the tag rules and every route.

## Events

The tournament runs on a general events system (`src/server-10-events-*.js`, screens in `src/app-17-event-*.js`, admin in `public/admin-app/8-events.js`). An admin creates an event in **Admin → Events**: title, brief, prize, which lab entries post into, the format, and the dates.

- **Phases.** Entries (one per person, posted as a real work post) → a vote (members pick up to N favourites; counts hidden) → **bracket** format: head-to-head rounds, one pick per pair, decided when each round closes (a tie goes to the higher seed) → the **final**, decided by judges' 1–10 scores and member votes (`judge_weight`, 50/50 by default) → results. The **simple** format skips the bracket: the top N from the vote go to the final.
- **The server decides everything.** `tickEvent()` closes phases on schedule, seeds the bracket (standard seeding; a bracket is the largest power of two that fits), and notifies entrants. "End this phase now" moves every later date earlier by the same amount.
- **Fair play.** No voting for yourself; voters' accounts must be `min_account_days` old; judges can't enter and score the final instead of voting in it. Admins see live tallies, including votes from accounts under 14 days old, and can disqualify.
- **Fewer than two entries** when entries close calls the event off.
- **Poll format** (2026-10-07, what the community asked for): `picks` votes a *day* that add up (stored with the day, yyyymmdd Eastern, in `event_votes.matchup`), a live public scoreboard with places moved in 24h, frozen for the last `freeze_hours` of each stage, then the top N go to a final (judges optional — `judge_weight` 0 means most votes wins). Voters need a confirmed email (`require_verified`).
- **Everyone hears when it opens.** When a published event's entries open, every member with a confirmed email (not suspended, not unsubscribed) gets one email, once. It sends at most `EVENT_MAIL_PER_DAY` (default 80) a UTC day, because Resend's free plan stops at 100 and account emails share that, and it picks up where it stopped after a restart. Admin → Tournament shows who it will reach and how far it has got, sends you a preview, and has a switch to turn it off per event. Each email has an unsubscribe link (`/mail/off`, with a button, so link checkers can't unsubscribe anyone) and one-click List-Unsubscribe headers. Nothing goes out on Resend's test sender.
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
GET    /api/posts/:id
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
GET    /api/playlists   (auth — yours only, server-12-playlists)
POST   /api/playlists   (auth)
GET    /api/playlists/:id   (auth)
PATCH  /api/playlists/:id   (auth)
DELETE /api/playlists/:id   (auth)
POST   /api/playlists/:id/tracks   (auth)
DELETE /api/playlists/:id/tracks/:tid   (auth)
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
GET    /api/places
GET    /api/labs/:lab/feed   (auth)
GET    /api/labs/:lab/work   (auth)
GET    /api/labs/tags   (auth)
GET    /api/tags   (auth)
GET    /api/tags/:tag   (auth)

# builders
GET    /api/builders

# health
GET    /api/health
GET    /api/report/daily      (Bearer TNL_REPORT_KEY; off without it — the morning check's summary, counts only: server-12-report.js)

# admin
GET    /api/admin/pulse?days=&tz=   (admin)  Today: numbers, series, needs-you
GET    /api/admin/direction?days=&tz=   (admin)  Today: labs + #tags, the tournament, taking part, tournament needs
GET    /api/admin/posts?lab=&tag=&kind=&q=   (admin)  moderation by lab and #tag
GET    /api/admin/people · /api/admin/people/:username   (admin)
GET    /api/admin/members.csv   (admin — every member as a spreadsheet; logged)
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
