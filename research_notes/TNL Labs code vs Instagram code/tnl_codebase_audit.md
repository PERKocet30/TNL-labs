# TNL Labs codebase: engineering audit (for comparison with Instagram)

Method: read-only inspection of `/home/user/TNL-labs` on branch `research/instagram-lessons` (HEAD 7b6412c, 2026-10-07), plus `git diff main..origin/improve/sends-and-no-ai`. All metrics were measured with `wc`, `grep -c`, `stat` and `ls`. `npm test` was run once and passed. Sources are repo paths with line numbers; for `src/server.runtime.js` (the built, gitignored concatenation of `src/server-NN-*.js`) line numbers are from the file as assembled on this date. No web sources were needed.

## Architecture & stack

### Takeaway
TNL Labs is a single-process monolith: one Express 4 server and one SQLite file (Node's built-in `node:sqlite`). The client is a hand-written, framework-free SPA. There is no bundler: a 60-line script (`src/assemble.mjs`) joins numbered source "parts" into one ~600KB `index.html` and one ~393KB `server.runtime.js` on every boot. In total it is about 26k lines of first-party JS/CSS/HTML across about 130 files.

### Cited Findings
- **Runtime and dependencies.** The app needs Node >=22.5 and starts with `node --experimental-sqlite --max-old-space-size=768 src/server.js`. It has exactly four runtime dependencies: `bcryptjs ^2.4.3`, `cors ^2.8.5`, `express ^4.19.2` and `ffmpeg-static ^5.2.0`. There are no devDependencies. Playwright is installed only in CI with `--no-save`. — [package.json](package.json); [.github/workflows/tests.yml](.github/workflows/tests.yml)
- **Build = concatenation.** `src/server.js` (464 bytes) runs `assemble()` and then `await import("./server.runtime.js")`. `assemble.mjs` matches `^app-\d{2}-[\w.-]+\.(html|css|js)$` → `public/index.html` and `^server-\d{2}-[\w.-]+\.js$` → `src/server.runtime.js`, sorts by filename and does `.join("")`. Its only transformation is replacing the `/*@palette*/` marker with `paletteCss()`, and it throws if the marker is missing. — [src/assemble.mjs:27-56](src/assemble.mjs); [src/server.js](src/server.js)
- **Built files are gitignored.** `public/index.html`, `src/server.runtime.js` and `public/*.gz` are all ignored. — [.gitignore:2-5](.gitignore)
- **Part counts.** There are 54 client parts: 38 JS, 13 CSS and 3 HTML. There are 30 server parts.
- **The 24KB rule.** No part is over 24,576 bytes. Seven parts are over 22,000 bytes:
  - `app-07-theme-labs-api.js` 23,794
  - `server-08-trust-library.js` 23,302
  - `app-08-state-ui.js` 23,295
  - `server-01-boot.js` 22,448
  - `app-17-market.js` 22,441
  - `app-12-archive-posts.js` 22,406
  - `app-09-render-nav.js` 22,388

  The rule exists because the original single files were "350KB and 215KB — too big to edit or push in one piece". — [src/assemble.mjs:4-9](src/assemble.mjs); [CLAUDE.md](CLAUDE.md)
- **Size by area** (lines / bytes / files):

  | Area | Lines | Bytes | Files |
  |---|---|---|---|
  | Client JS parts | 6,794 | 449,183 | 38 |
  | Client CSS parts | 1,815 | 144,682 | 13 |
  | Client HTML parts | 96 | 6,354 | 3 |
  | Server parts | 7,024 | 392,372 | 30 |
  | Core modules (`db.js`, `pay.js`, `mail.js`, `palette.js`, `assemble.mjs`, `server.js`) | 1,331 | 65,919 | 6 |
  | `public/studio.js` + `sw.js` + `door.js` | 1,959 | 96,066 | 3 |
  | Admin SPA (`public/admin-app/*.js` + `admin.html`) | 1,076 | 91,198 | 9 |
  | Tests (`test/*.mjs`, `e2e/run.mjs`, `run.sh`) | 3,840 | 274,880 | 43 |
  | `scripts/scientist.mjs` | 101 | — | 1 |

  The built `public/index.html` is 601,080 bytes and `src/server.runtime.js` is 393,393 bytes. (Measured with `wc` over the globs.)
- **Biggest single files.** `src/db.js` is 38,613 bytes and `public/studio.js` is 83,237 bytes. Both are outside the parts system, so the 24KB rule does not apply to them. The admin-app files run from 4.5KB to 16KB (`8-events.js` 16,004). — `stat`
- **API surface.** The assembled server registers 190 Express routes: 83 `app.get`, 81 `app.post`, 10 `app.patch` and 16 `app.delete`. Of these, 46 are `/api/admin/*` and 47 lines chain `auth, admin`. — grep over [src/server.runtime.js](src/server.runtime.js)
- **Schema size.** There are 47 `CREATE TABLE IF NOT EXISTS` statements (33 in `db.js`, the rest in server parts such as events, DMs and glitch) and 45 `CREATE [UNIQUE] INDEX` statements. — grep over [src/db.js](src/db.js) and src/server-*.js
- **Realtime.** Realtime uses Server-Sent Events, not WebSockets:
  - `POST /api/stream/ticket` swaps the bearer token for a one-use, 60-second ticket.
  - `GET /api/stream?ticket=` opens `text/event-stream` with `X-Accel-Buffering: no` and a `: ping` every 25 seconds.
  - Clients are held in an in-process `Map`, and presence is counted per user.

  — [src/server.runtime.js:6303-6345](src/server.runtime.js) (server-10-live.js)
- **Service worker.** `public/sw.js` (2,763 bytes) caches only the shell (`/`, the manifest) and `/uploads/` media. API calls are never cached. Navigations go network-first ("NEVER serve a cached page shell"). Ranged audio/video requests skip the worker. The cache version `tnl-shell-v9` is bumped by hand. — [public/sw.js:1-60](public/sw.js)
- **Video.** `ffmpeg-static` is used only to pull audio out of video, through a dynamic import inside try/catch. If it fails, the route answers 503 and the server stays up. — [src/server-01-boot.js:12-19](src/server-01-boot.js)
- **Third parties.** Stripe and Resend are called with raw `fetch` (`api.stripe.com/v1/...`, `api.resend.com/emails`). No SDKs are used. — [src/pay.js:51](src/pay.js); [src/mail.js:164](src/mail.js)

### Inferences
- In Instagram terms this is the opposite end of the spectrum. There is no build graph, module system or code splitting on the client: the whole app ships as one HTML document (~600KB raw, gzipped once at boot). The deliberate minimalism (4 dependencies, no SDKs) keeps the supply chain and ops surface tiny, at the cost of tooling.
- Because the server is assembled from parts, all 30 server parts share one ES module scope. A `const` in one part is visible to every later part, so file boundaries are an editing convenience, not module boundaries.

### Gaps
- I did not measure runtime performance: cold-start time, request latency, or the gzipped size of index.html served (the server gzips it at level 9 at boot, [src/server.runtime.js:148-171](src/server.runtime.js)).

## Code style & conventions

### Takeaway
The code is plain modern JS (ES modules on the server, browser globals on the client). It has no types, no linter, no formatter and no JSDoc types. In place of tooling it leans on very heavy narrative "why" comments, and on a single shared global namespace of UPPERCASE state variables that a monolithic `render()` reads.

### Cited Findings
- **No tooling config.** There is no `.eslintrc`, `.prettierrc`, `tsconfig` or `.editorconfig` in the repo root. `@param` appears 0 times and `@ts-check` appears 0 times. — `ls -a`, grep
- **Comment density.** About 954 of 7,024 server-part lines (≈14%) and about 1,178 of 6,794 client-JS lines (≈17%) are comment lines. Comments are versioned and dated, and explain the reason behind a choice. For example: "PALETTE v1.0 — 2026-09-29", "MOTION v1.0", "IMAGE QUALITY v2 · 2026-10-07", "RANKING v2.0". — [src/palette.js:1-20](src/palette.js); [src/app-09-motion.js:1-20](src/app-09-motion.js); [src/app-08-images.js:1-10](src/app-08-images.js); [src/server-10-rank.js:1-22](src/server-10-rank.js)
- **Example "why" comment** (on `PRAGMA synchronous = NORMAL`): "In WAL mode NORMAL can't corrupt the database; it only skips a disk sync on every commit. The default (FULL) waited on the disk for every like." — [src/db.js:25-28](src/db.js)
- **Two writing styles.**
  - Client JS is dense and semi-minified: `const`/`let` one-liners and no spaces after braces. 131 of 6,794 client lines are longer than 200 characters, and 4 are longer than 500 (one is an inline base64 PNG in `topHTML()`).
  - Server code is conventionally formatted: 28 of 7,024 lines are longer than 200 characters.

  — awk over parts; [src/app-09-render-nav.js:~97](src/app-09-render-nav.js)
- **Global client state.** There are about 535 top-level `let`/`const`/`function` declarations across the client parts, and the app state is UPPERCASE globals. For example: `let TAB="showroom", LAB=null, CH=..., ROOMOPEN=false, POSTS=[], PROFILE=null`, and `NOTIFOPEN`, `SEARCHOPEN`, `PICKER`, `BOARDSOPEN`, `MKT`, `GATE`, `TOKEN`, `ME`, `SITE`. — [src/app-08-state-ui.js:3-150](src/app-08-state-ui.js)
- **Shared scope.** All client parts end up in one `<script>` in index.html. `boot.test.mjs` extracts the last `<script>` block and runs it in a `node:vm` sandbox with a stub DOM. — [test/boot.test.mjs:12-15](test/boot.test.mjs)
- **Server prepared statements.**
  - A central `const q = {...}` holds about 50 named `db.prepare` statements (for example `sessionByToken`, `userById`, `createSession`).
  - Many routes also call `db.prepare(...)` inline. There are about 460 `prepare(` occurrences across `server.runtime.js` and `db.js`.
  - Bound parameters (`?`) are used throughout.

  — [src/server.runtime.js:251](src/server.runtime.js)
- **Input validation is hand-written per route.** It relies on clamps and slices. For example: `(reason || "").toString().slice(0, 300)` for reports; `String(value).slice(0, 2000)` and allowlisted keys for settings; and a password-length check (`password.length < 6`). — [src/server.runtime.js:1366](src/server.runtime.js); [src/db.js:656-659](src/db.js); [src/server.runtime.js:624,1297](src/server.runtime.js)
- **Error handling.**
  - Side effects are written so they cannot fail the main action. For example, `notify()` "Never throws: a notification is a side effect" and catches FK failures.
  - The boot banner is wrapped in try/catch "killing the app to print a banner is a terrible trade".
  - There are 24 empty `catch {}` / `catch(e){}` blocks in the server and 59 in the built client.

  — [src/db.js:701-716](src/db.js); [src/server.runtime.js:~6995](src/server.runtime.js)
- **Feature switches.** Defaults live in code (`SETTING_DEFAULTS`), and overrides are rows in a `settings` table changed from Admin → Settings. Examples are `signupsOpen`, `guestAccess`, `marketOpen`, `studioOpen`, `autoVerify`, `distroOn` and `announcement`. — [src/db.js:619-675](src/db.js)

### Inferences
- With no linter and no type checker, the only guard against a name collision across concatenated parts (or a missing function, like the "missing applyAccent" bug that `boot.test.mjs` was written for) is the test suite. — [test/boot.test.mjs:8-10](test/boot.test.mjs)
- The comments act as design docs and a changelog. That suits a solo or AI-assisted team, but it is not machine-checked.

### Gaps
- I did not find a written naming convention beyond what the code shows: UPPERCASE for client state, `fooHTML()` for render functions, and `wireX()` for event binding.

## Data layer

### Takeaway
There is one SQLite database file on a Railway volume, opened synchronously with `DatabaseSync` in WAL mode with foreign keys on. The schema is created with `CREATE TABLE IF NOT EXISTS`, and migrations are idempotent boot-time `PRAGMA table_info` checks followed by `ALTER TABLE ADD COLUMN`. Rep is an append-only ledger (`rep_events`), denormalized onto `users.rep`. Backups are daily `VACUUM INTO` snapshots on the same volume, keeping 7.

### Cited Findings
- **Opening the database.** `new DatabaseSync(DB_PATH)` opens `TNL_DATA/tnl.db`, then runs `PRAGMA journal_mode = WAL; synchronous = NORMAL; foreign_keys = ON`. — [src/db.js:1-30](src/db.js)
- **Migrations.** There are 37 `ALTER TABLE ... ADD COLUMN` statements, each guarded by `if (!cols.includes(...))` against `PRAGMA table_info(<table>)`. For example, `if (!pcols.includes("images")) db.exec(\`ALTER TABLE posts ADD COLUMN images TEXT\`)`. There is no migration version table and no down-migrations. — [src/db.js:471-568](src/db.js)
- **One one-off data migration.** A DM threads migration runs inside `BEGIN IMMEDIATE ... COMMIT` with a pre-migration backup. — [src/server.runtime.js:4375-4406](src/server.runtime.js)
- **Rep ledger.**
  - `rep_events (id, user_id, kind, amount, source_id, created_at)` with index `idx_rep_user (user_id, created_at)`.
  - `awardRep()` inserts an event and runs `UPDATE users SET rep = rep + ?`.
  - `revokeRep()` inserts a negative event rather than deleting, so the log stays append-only.
  - Point values come from `REP` (like 6, share 3, collab 20, sale 15, delivery 10, feature 40, sound used 4, pinned 3). Levels: Entry 0, Verified 40, Collaborator 120, Core 280, Leadership 560. Fees: `FEE_BY_LEVEL {1:10,2:8,3:6,4:4,5:2}` percent.

  — [src/db.js:97-104, 462, 726-785](src/db.js)
- **Weak transaction coverage.** The two rep writes in `awardRep` are not wrapped in a transaction. Only 4 explicit `BEGIN`/`COMMIT` blocks exist in the whole server (lines ~1665, ~2634, ~4385, ~5506). — [src/db.js:743-751](src/db.js); grep [src/server.runtime.js](src/server.runtime.js)
- **Denormalized JSON in TEXT columns.** Examples: `users.roles TEXT DEFAULT '[]'`, `posts.images TEXT`, `posts.extras TEXT`, `listings.variants TEXT DEFAULT '[]'`, `posts.beat_json`. — [src/db.js:36, 502, 515, 557](src/db.js)
- **Sessions do not expire.** The `sessions` table is `(token PRIMARY KEY, user_id, created_at)` with no expiry column. Sessions are deleted only on logout, password reset, suspension or admin action. — [src/db.js:55-59](src/db.js); grep `DELETE FROM sessions` in [src/server.runtime.js](src/server.runtime.js) (lines 269, 565, 1307, 1682, 4069)
- **Backups.**
  - `backupTo(path)` runs `VACUUM INTO ?` ("the only safe way to do this on a live database").
  - `makeBackup()` writes to `DATA_DIR/backups` and keeps 7.
  - The first backup runs one hour after boot ("not at boot, because a crash-loop would otherwise spend your disk"), then every 24 hours.
  - The admin can download a backup.
  - The README admits uploads are "not in those backups yet. An off-platform copy (object storage) is the top open item."

  — [src/db.js:605-611](src/db.js); [src/server.runtime.js:1835-1856, 6984-6993](src/server.runtime.js); [README.md:123-130](README.md)
- **Error log.** `error_log` is capped at 500 rows ("a black box, not an archive"). — [src/db.js:600-601](src/db.js)
- **No seed, reset or wipe scripts.** This is deliberate. — [README.md:130](README.md); [CLAUDE.md](CLAUDE.md)

### Inferences
- The approach is simple and durable for one box, but there is no schema version, no rollback path for a migration, and no replica. The backups live on the same volume as the data they protect.

### Gaps
- I did not inspect every table's indexes against the queries that use them, so index coverage and query plans were not verified.

## Frontend engineering

### Takeaway
Rendering is string templates assigned to `innerHTML`. One central `render()` repaints the whole `#app` from global state and then re-binds events (`wire()`). Routing is `history.pushState` with a `popstate` handler. A custom motion layer saves and restores scroll position around each repaint and animates only transform and opacity. Image variants (1440px feed copy, 480px small copy, metadata stripped) are produced in the browser. Theming is CSS variables injected from `src/palette.js`.

### Cited Findings
- **`render()`.**
  - It sets `app.innerHTML` to a single template literal holding the sidebar or top bar, the announcement, the content switch (`TAB==="showroom"?showroomHTML():TAB==="labs"?labsHTML():...`), the bottom nav and 11 conditional overlays.
  - It then calls `mvAfter()`, `wire()` and `wireEnter()`, and lazy-loads data per tab.
  - Its comment says: "A repaint rebuilds every scroller."

  — [src/app-09-render-nav.js:61-98](src/app-09-render-nav.js)
- **Escaping.** `innerHTML` appears 44 times in the client parts. XSS protection relies on a hand-rolled `esc()` (`&<>"'` → entities), used 411 times. — [src/app-07-theme-labs-api.js:186](src/app-07-theme-labs-api.js)
- **Routing.** `history.pushState(st, "", kind==="profile"?"/u/"+val:kind==="listing"?"/m/"+val:location.pathname)` plus a `popstate` listener. Chat and the gate push their own history entries. — [src/app-09-render-nav.js:12-18](src/app-09-render-nav.js); [src/app-10-chat-1-kit.js:149](src/app-10-chat-1-kit.js); [src/app-11-gate-screens.js:28](src/app-11-gate-screens.js)
- **Phone and computer frames.** `WIDEQ = matchMedia("(min-width:1024px)")`. `isWide()` toggles `body.wide` and moves the nav into a left `<aside class="side">`, and the layout repaints on change. — [src/app-09-render-nav.js:55-60](src/app-09-render-nav.js); `src/app-05-styles-wide.css`
- **Motion.**
  - State lives in `MV={key,depth,tab,scrolls,over,...}` and `MV_MS=400`.
  - Deeper screens slide in from the right, back slides from the left, tabs fade.
  - It honours `prefers-reduced-motion`.
  - "Only transform and opacity move, so nothing here can shift the layout (the glitch watcher would call that a screen jump)."

  — [src/app-09-motion.js:1-40](src/app-09-motion.js)
- **Client-side image pipeline.**
  - `imgAttrs()` emits `src` + `srcset` + `sizes="(min-width:1024px) 640px, 100vw"`.
  - `cleanJpeg()` walks JPEG segments with an allowlist (keeping APP0, APP2 ICC and APP14), drops EXIF/XMP/GPS, and truncates at FFD9.
  - A rotated JPEG goes through a canvas instead.

  — [src/app-08-images.js:1-60](src/app-08-images.js)
- **Accessibility.** The client parts contain 205 `aria-*` attributes, 23 `role=` and 61 `alt=` (counts). Icons are drawn as SVG. — grep over `src/app-*`
- **Theming.** `assemble.mjs` replaces `/*@palette*/` in `app-02-styles-base.css` with `paletteCss()`. `palette.js` is the single colour source for the app, `/admin` (`/palette.css`), server pages, emails and the share card. `test/palette.test.mjs` (16 assertions) guards against drift. — [src/palette.js:1-20](src/palette.js); [src/assemble.mjs:28-31](src/assemble.mjs)
- **Performance techniques.**
  - The static shell is pre-gzipped at level 9 once at boot.
  - API responses of 1KB or more are gzipped at level 6 per response with `zlib.gzipSync`.
  - Freshness stamps (`FEEDAT`, `SRAT`) stop `render()` from "hammer[ing] the network on every tap".
  - Media is cached by the service worker.
  - Loading uses `skel()` shimmer placeholders.

  — [src/server.runtime.js:120-171](src/server.runtime.js); [src/app-08-state-ui.js:11](src/app-08-state-ui.js)
- **Client error reporting.** Errors go straight to Sentry's envelope endpoint through `navigator.sendBeacon`, with a hand-built envelope and no SDK, capped at 8 distinct messages per page. They are mirrored to `/api/client-error` for the admin Health tab. — [src/app-08-state-ui.js:12-38](src/app-08-state-ui.js)
- **The Studio (beat maker)** is a separate 83KB `public/studio.js` mounted on demand and gated by the `studioOpen` setting. — [src/db.js:625](src/db.js); `public/studio.js`

### Inferences
- A full `innerHTML` repaint on every state change is the main architectural difference from a React-style virtual DOM like Instagram web's. It is why a dedicated motion and scroll-restore layer and a "glitch watcher" were needed to hide repaint jumps.
- XSS safety depends on 411 manual `esc()` calls being applied everywhere. There is no Content-Security-Policy header (grep found none) to limit the damage if one is missed.

### Gaps
- I did not audit keyboard navigation or screen-reader behaviour at runtime; the counts above are static only.

## Testing & quality

### Takeaway
There are 41 plain-Node test suites with 999 assertions, all green on this run, plus a 761-line Playwright tap-through at 390×844 (phone) and 1440×900 (computer). The suites are a mix of behavioural tests (importing `db.js` against a temp `TNL_DATA`, a few booting the server) and source-regex checks over the built HTML and server. Production adds a read-only "scientist" probe after each deploy, an in-app glitch watcher, and client Sentry.

### Cited Findings
- **Unit suites.** `npm test` runs `test/run.sh`, which assembles and then runs every `test/*.test.mjs` with `--experimental-sqlite`. A suite fails if its output has "N failed" with N>0, or contains `Error:`/`✗`. The run must end with "all green — safe to deploy". On this run: 41 PASS, 999 assertions total. The largest suites are messaging (81), events (71), icons (42) and admin (40). — [test/run.sh](test/run.sh); `npm test` output
- **Test style.**
  - Each suite has a hand-rolled `t(name, ok)` counter and isolates its data with `process.env.TNL_DATA = test/.tmp/<suite>`.
  - Example: `core.test.mjs` inserts users and posts directly and asserts rep and fee maths (`feeForRep(560)===2`, `platformFee(5000, feeForRep(0))===500`).

  — [test/core.test.mjs:1-40](test/core.test.mjs)
- **Mix of approaches.**
  - About 22 suites import `src/db.js` / `pay.js` / `mail.js` / `palette.js` directly.
  - About 4 (admin, events, messaging, unfurl) start an HTTP server or use localhost.
  - Many suites `readFileSync` the source or built files and regex them. Examples: mail has ~17 such reads, cart ~12, profile-card ~12, cloudflare ~10, chat-ui ~9.
  - `boot.test.mjs` executes the whole client script in `node:vm` with a stubbed DOM to catch missing functions on the login path.

  — grep heuristics over `test/*.test.mjs`; [test/boot.test.mjs](test/boot.test.mjs)
- **E2E.** `test/e2e/run.mjs` (761 lines):
  - Seeds a throwaway database, generates its own PNG and WAV fixtures in code ("no fixtures to keep in git"), and starts the app on a random port.
  - Drives Chromium at `{width:390,height:844, hasTouch, isMobile}` and `{width:1440,height:900}`.
  - Has about 41 named steps and fails on "a feed that repaints under your thumb, a count that moves twice, a menu that opens behind something, a screen that takes too long".
  - In CI, failure screenshots are uploaded as artifacts.

  — [test/e2e/run.mjs:1-60, 134, 183, 724](test/e2e/run.mjs); [.github/workflows/tests.yml](.github/workflows/tests.yml)
- **Glitch watcher.** `app-19-glitch.js` (88 lines) reports `rage_tap` (3+ taps in about 1s), `layout_jump`, `slow_screen` (an API GET over 3s) and `action_failed` (5xx or network). Reports are batched and deduped every 30s, and post or message content is never sent. They go to `/api/glitch`, which `server-10-glitch.js` (59 lines) stores for admin. — [src/app-19-glitch.js:1-35](src/app-19-glitch.js)
- **CI.** `tests.yml` runs `unit` (`npm test`, 10-minute timeout) and `tap-through` (Playwright 1.56.1 + Chromium, 15-minute timeout) on every PR and on every push to main. — [.github/workflows/tests.yml](.github/workflows/tests.yml)
- **Scientist.** `after-deploy.yml`, on push to main:
  - Polls `/api/health` (`commit` is the first 7 characters of `RAILWAY_GIT_COMMIT_SHA`) every 15s for up to 15 minutes until the new SHA is live.
  - Then runs `scripts/scientist.mjs`: read-only GETs checking status, content-type and body. Examples: the shell is text/html, the verify page is not a download, and showroom/levels/market/builders return JSON.
  - It was born from "Patch 051 … /api/auth/verify was answering with application/octet-stream".
  - The CLAUDE.md "daily scientist" is not a cron in the workflows; the only triggers are push to main and `workflow_dispatch`.

  — [.github/workflows/after-deploy.yml](.github/workflows/after-deploy.yml); [scripts/scientist.mjs:1-91](scripts/scientist.mjs)
- **Open branch.** `improve/sends-and-no-ai` adds `test/no-ai.test.mjs` (54 lines) and extends `rank.test.mjs`. It changes 7 files, +127/−11. — `git diff --stat main..origin/improve/sends-and-no-ai`

### Inferences
- Test density is high for the codebase size (about 275KB of tests against about 1.1MB of source). However, a meaningful share of assertions check source text rather than behaviour. Such tests pass while the behaviour is wrong if the code still matches the regex, and fail on harmless refactors.
- There is no coverage measurement, no load testing and no staging environment. The live-site probe runs after production is already serving.

### Gaps
- I did not run `npm run e2e` (it needs Chromium). I did not count the exact split of regex and behavioural assertions per suite; the numbers above are grep heuristics.
- I found no workflow file for a daily scheduled scientist run. It may exist outside the repo (for example a Railway cron) — not verified.

## Delivery

### Takeaway
A merge to `main` deploys to production on Railway (about 80s, per CLAUDE.md) with no staging. Changes arrive as PRs from short-lived `claude/*` branches, and CI must be green. Cadence is very high: 109 commits in the visible history between 2026-09-23 and 2026-10-07, with a peak of 47 commits on 2026-09-29. Rollback means redeploying a previous commit in Railway; there is no schema rollback.

### Cited Findings
- **Rules.** "Pushing to `main` deploys to production (Railway, ~80s). Work on a branch and open a PR. Never push to `main` directly." and "don't merge a red check". — [CLAUDE.md](CLAUDE.md)
- **History is shallow.** `git rev-parse --is-shallow-repository` returns `true`, so totals reflect only the fetched history.
  - Commits per day: 09-23: 10, 09-24: 2, 09-28: 13, 09-29: 47, 09-30: 23, 10-06: 3, 10-07: 11.
  - 35 merge commits. PRs up to #32 (`Merge pull request #32 from PERKocet30/claude/image-quality`).
  - Branch names (`claude/fluid`, `claude/night-mode`, `claude/market-cart`, ...) show AI-assisted development through PRs.

  — `git log`
- **Repo origin.** The earliest visible commits are "Add files via upload" and "Delete public/index.html" (2026-09-23), so the repo began as web uploads before the parts system. — `git log`
- **Feature launches are big single commits.** Examples: "Events: the tournament system — enter, vote, bracket, judged final, results" and "Shop v2 part 4: shoppable posts". — `git log --oneline`
- **Runtime switches.** Features are switched without a deploy through `settings` rows (`marketOpen`, `studioOpen`, `signupsOpen`, `guestAccess`, `autoVerify`, `distroOn`), "so you can change your mind at 2am without asking me for a deploy". — [src/db.js:614-645](src/db.js)
- **Deploy verification.** `/api/health` exposes the running commit SHA, which `after-deploy.yml` uses to confirm the deploy landed. — [src/server.runtime.js:6981](src/server.runtime.js)
- **Cache busting.** The service-worker cache name is bumped by hand ("Bump this on every deploy that changes the shell"). — [public/sw.js:4-6](public/sw.js)

### Inferences
- The process is effectively continuous deployment to a single production instance. Safety comes from PR CI and a post-deploy smoke probe, not from staged rollouts, canaries, percentage rollouts or per-user experiment gating.

### Gaps
- I did not verify the actual Railway deploy duration or how a rollback is done in practice (RAILWAY.md does not mention rollback; grep found only volume and backup guidance).

## Security posture

### Takeaway
The basics are deliberate and well commented:
- bcrypt password hashes
- random 48-hex bearer tokens
- server-side admin middleware plus an admin audit log
- 43 rate-limited routes
- Cloudflare-aware client-IP handling
- magic-byte upload sniffing
- an SSRF-guarded link unfurler
- Stripe Standard Connect direct charges with no stored card data
- secrets only in environment variables

Gaps: tokens in `localStorage` with no CSP, sessions that never expire, a 6-character minimum password, `cors()` open to every origin, an in-memory rate limiter, and no Stripe webhook (payment is confirmed by polling `verifySession`).

### Cited Findings
- **Passwords and sessions.**
  - `bcrypt.hash(password, 10)` and `bcrypt.compare`.
  - The session token is `randomBytes(24).toString("hex")`, stored in `sessions`.
  - It is sent as `Authorization: Bearer` and kept client-side in `localStorage("tnl-token")`.

  — [src/server.runtime.js:634, 730-733](src/server.runtime.js); built [public/index.html:1977, 4292](public/index.html)
- **Suspension.** `auth()` checks suspension on every request and deletes the user's sessions ("A suspension that only kills existing sessions is undone the moment they sign back in"). — [src/server.runtime.js:553-568](src/server.runtime.js)
- **Admin checks.**
  - `function admin(req,res,next){ if (!req.user.is_admin) return res.status(403)... }` is chained after `auth` on admin routes ("Hiding a button in the UI is not access control").
  - An `/api/admin` middleware writes every successful non-GET admin call to `admin_log`.
  - Admin bootstrap is through the `ADMIN_EMAIL` env var or the first account, "deliberately not a hardcoded password".

  — [src/server.runtime.js:85-89, 1370-1381](src/server.runtime.js); [src/db.js:671-698](src/db.js)
- **Rate limiting.** It is an in-memory sliding window `Map` keyed by `route:ip` or `route:user`. The IP comes from `CF-Connecting-IP` with `trust proxy` set to 2. It "Resets on restart … move to Redis if you outgrow one box". There are 43 `rateLimit({...})` call sites. — [src/server-01-boot.js:33-62](src/server-01-boot.js); [src/server.runtime.js:83](src/server.runtime.js)
- **Caching and AI crawlers.** Every `/api` response is `Cache-Control: private, no-store`, to protect against a Cloudflare "Cache Everything" rule leaking `/api/me`. All responses carry `X-Robots-Tag: noai, noimageai` and `tdm-reservation: 1`. — [src/server.runtime.js:91-109](src/server.runtime.js)
- **Missing headers.** No Content-Security-Policy, X-Frame-Options, HSTS or X-Content-Type-Options headers are set (grep found none). `app.use(cors())` allows every origin. — [src/server.runtime.js:104](src/server.runtime.js)
- **Uploads.** The magic bytes of the first streamed chunk are sniffed ("A liar gets one chunk, not a whole file"). Allowed types are JPEG, PNG, GIF, WEBP, WAV, AIFF, FLAC and others. Avatars are capped at 4MB, and `express.json` at 12MB. — [src/server.runtime.js:975-1000, 1111, 114](src/server.runtime.js)
- **SSRF guard.**
  - `server-10-links.js` resolves DNS and refuses if any answer is in a private range (0/8, 10/8, 100.64/10, 127/8, 169.254/16, …): "one private record is enough to refuse".
  - `safeGet` caps reads at 120KB with a 6s timeout and re-checks each redirect hop.

  — [src/server-10-links.js:18-31](src/server-10-links.js); [src/server.runtime.js:6135-6162](src/server.runtime.js)
- **Payments.**
  - Stripe Standard Connect with direct charges and `application_fee_amount`. The platform fee is clamped to 0–30%.
  - Without `STRIPE_SECRET_KEY`, "Nothing pretends to charge anyone".
  - There is no webhook handler (grep for `webhook`/`stripe-signature` found none); checkout is confirmed through `verifySession(sessionId, sellerAccount)`.

  — [src/pay.js:1-31, 111-152](src/pay.js)
- **Login lookup.** Login loops `bcrypt.compare` over candidate accounts that match the username or email. — [src/server.runtime.js:722-728](src/server.runtime.js)
- **Secrets.** Secrets live only in Railway Variables. The client Sentry DSN is in source, which is normal: DSNs are public. — [CLAUDE.md](CLAUDE.md); [src/app-08-state-ui.js:15](src/app-08-state-ui.js)

### Inferences
- The biggest structural risks are:
  - **(a)** A bearer token in `localStorage`, combined with a manual-escaping `innerHTML` renderer and no CSP. One missed `esc()` leads to account takeover.
  - **(b)** Non-expiring sessions.
  - **(c)** Payment state that depends on a client-triggered verify call rather than signed webhooks.

### Gaps
- I did not run `/security-review` or test the endpoints dynamically. I did not check password-reset token TTLs or CSRF on any cookie-based flows (the API appears to be bearer-only).

## Strengths and weaknesses/risks

### Takeaway
The codebase is unusually disciplined for its size. Its strengths are a tiny dependency surface, a single colour source, an append-only rep ledger, safe live backups, about 1,000 assertions plus real-browser tests at two sizes, post-deploy probes, and thorough "why" comments. Its risks all stem from the one-box, one-scope, no-types design.

### Cited Findings
- **Strengths.**
  - 4 dependencies ([package.json](package.json)).
  - Palette single source with a drift test ([src/palette.js](src/palette.js), `test/palette.test.mjs`).
  - Append-only `rep_events` ([src/db.js:97-104](src/db.js)).
  - `VACUUM INTO` backups ([src/db.js:605-611](src/db.js)).
  - 999 unit assertions plus Playwright at 390px and 1440px ([test/e2e/run.mjs](test/e2e/run.mjs)).
  - Glitch telemetry ([src/app-19-glitch.js](src/app-19-glitch.js)).
  - Deploy-landed check ([.github/workflows/after-deploy.yml](.github/workflows/after-deploy.yml)).
  - EXIF/GPS stripping on the client ([src/app-08-images.js](src/app-08-images.js)).
  - SSRF guard ([src/server-10-links.js](src/server-10-links.js)).
- **Weakness: shared global scope.** One scope across 54 concatenated client parts (about 535 top-level declarations) and 30 server parts. There are no module boundaries and no tree-shaking. — [src/assemble.mjs:47](src/assemble.mjs)
- **Weakness: no static checks.** No type checking, linting or formatting is configured. — repo root
- **Weakness: source-regex tests.** Many tests regex source text (for example mail, cart, profile-card, cloudflare). — `test/*.test.mjs`
- **Weakness: synchronous work on the event loop.**
  - `DatabaseSync` blocks the event loop on every query.
  - So does `zlib.gzipSync` per API response of 1KB or more.
  - Ranking scores up to 400 candidates in JS per request (`RANK.candidates: 400`, `windowDays: 120`).

  — [src/db.js:15](src/db.js); [src/server.runtime.js:138](src/server.runtime.js); [src/server-10-rank.js:23-31](src/server-10-rank.js)
- **Weakness: everything on one box.** One process, one volume. Rate limits, SSE clients, presence and stream tickets live in process memory, so the app cannot scale horizontally without rework. Backups are on the same volume, and uploads are not backed up at all. — [src/server-01-boot.js:38](src/server-01-boot.js); [README.md:127-128](README.md)
- **Weakness: migrations.** There is no schema version and no rollback, and rep award plus the user update are not atomic. — [src/db.js:471-568, 743-751](src/db.js)
- **Weakness: auth hardening.** See Security posture: localStorage tokens, no CSP, open CORS, no session expiry, 6-character minimum password.

### Inferences
- Against Instagram's architecture (typed Python/Django plus a typed React/Relay client, many services, sharded stores, async fan-out, staged rollouts with experiment gating), TNL deliberately makes the opposite trade: it optimises for one person shipping many small changes a day with AI help, and for zero operations. The places it would hit limits first are the synchronous SQLite and gzip on the event loop, the in-memory state that blocks a second instance, and the single-volume data and media durability.

### Gaps
- There is no production load data (requests/sec, database size, member count) in the repo to judge how close these limits are.
