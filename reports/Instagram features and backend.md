# Close the rep faucets, then measure reach

*Research synthesis, 7 October 2026. It builds on the earlier "Instagram lessons" report and the five research notes in `research_notes/Instagram features and backend/`. Repo facts come from reading the code read-only. Already shipped, so not recommended again: DM sends in the Showroom ranking (PR #36, `sendExtra` 0.75), and the `robots.txt` and `noai` opt-out of AI training.*

The most valuable thing TNL can learn from Instagram right now is a back-end lesson, not a feature. Every Instagram system that matters (ranking, insights, integrity) sits on two pieces of data: **who did what**, and **how many people actually saw the work**. TNL records neither, and that is a money problem as well as a ranking one. Rep sets the seller's commission (10% at level 1 down to 2% at level 5, reached at 560 rep), yet three things are confirmed in the code. **`POST /api/posts/:id/share` gives the original author +3 rep on every share**, with no once-per-person check and no rate limit (`src/server-02-auth-feed.js` ~336–348). **The `verified` middleware is a no-op**, so brand-new accounts can give rep at once (`:205`). **`rep_events` has no giver column**, so no ring or serial-voting detector can be written. The build order follows from that:

1. Fix the rep ledger first: record the giver, close the open faucets, and add capped awards in the style of Stack Overflow.
2. Log impressions so ranking and creator insights can work per reach, the way Instagram's do.
3. Ship the cheap creator features that reuse data TNL already holds.
4. Put the infrastructure work (off-box backups, a job queue, FTS5 search, SSE replay) where one Node and SQLite server can carry TNL for a long time.

Everything here except off-platform storage needs no new dependency.

## Rep is money, and three faucets are open today

Instagram learned in 2018 that the fix for fake engagement is to remove its *effect*, not just ban accounts. When it went after growth apps, it **deleted the inauthentic likes, follows and comments** and told the affected accounts ([Instagram](https://about.instagram.com/blog/announcements/reducing-inauthentic-activity-on-instagram/)). Meta's large detectors all work on *who acted, on what, and when*:

- **CopyCatch** finds groups of users who like the same pages within the same short time window ([WWW'13](https://archives.iw3c2.org/www2013/program/copycatch-stopping-group-attacks-by-spotting-lockstep-behavior-in-social-networks)).
- **SynchroTrap** clusters accounts whose actions stay loosely in step over time. It reported **over 99% precision and 2M+ malicious accounts in one month** ([CCS'14](https://cse.sc.edu/~huangct/CSCE813F15/SynchroTrap-ccs14.pdf)).
- **Deep Entity Classification** judges an account by the accounts around it, for example the average age of its friends, because that neighbourhood is "fundamentally difficult for attackers to replicate". It removed an estimated **27% more abusive accounts** than Meta's other systems ([USENIX Sec '21](https://faculty.cc.gatech.edu/~frankli/papers/fb_dec_usenix2021.pdf)).

All three need the giver on every edge. TNL's `rep_events(user_id, kind, amount, source_id, created_at)` never stores one (`src/db.js:97`), so none of these patterns can run.

**The audit found more faucets.** It was done by reading code, not by running exploits, so each needs a failing test before the fix:

- **Pin/unpin cycling.** The +3 `pinned` award checks the *current* pins table, and unpinning doesn't revoke it, so pin → unpin → pin pays again (`server-09-archive-boards.js:174–222`).
- **Collab farming.** Accepting a collab pays **+20 to both sides** per post, with no cap per pair (`server-10-collabs-beats-showroom.js:26–27`).
- **Refund-proof sales.** `sale_made` (+15) and `delivery_confirmed` (+10) survive refunds. The code has no Stripe webhook and no refund or dispute handling.

Charges are direct charges on the seller's connected account (`src/pay.js:49,144`). Under Stripe's rules that means **the connected account's Radar settings screen them, not the platform's** ([Stripe](https://docs.stripe.com/connect/radar)). Stripe has its own rejection reason for "the business is both the buyer and the seller" ([Stripe](https://docs.stripe.com/radar/radar-for-platforms)), but it knows nothing about TNL's rep economy. A seller with one sockpuppet buyer can buy a $1 item, confirm delivery and refund it from the dashboard. That gains 25 rep per cycle for little more than Stripe's processing fees. **About 23 cycles reach level 5** and a permanent 2% fee.

Stack Overflow shows how to build rep that holds up against this. It caps vote rep at **+200 per day**, gives a partial award that lands exactly on the cap, and exempts accepted answers and bounties. Without the cap, one top user would have had about 60,000 rep more than they had earned ([Stack Overflow blog](https://stackoverflow.blog/2008/12/31/daily-dose-of-daily-reputation-ca/)). A daily script reverses serial votes and shows them openly as **"voting corrected"** ([Stack Overflow](https://stackoverflowteams.com/help/serial-voting-reversed)). Stack Overflow also keeps its detection details private so users can't optimise around them.

That maps directly onto TNL's append-only rule:

- **Correct with new events, never delete.** Fix bad rep by writing compensating negative `rep_events`.
- **Cap the vote-like kinds**: `like_received`, `share_received`, `pinned`, `sound_used` and `collab_accepted`, per receiver per day and per giver→receiver pair.
- **Leave money-backed kinds uncapped**, but hold them as *pending* for about 14 days until the charge is confirmed not refunded. The existing `stripe()` helper can re-check this, so no new dependency is needed.

One trap matters here. Once awards can be partial or weighted, **`revokeRep` must revoke the amount that was actually awarded**, not `REP[kind]`. Otherwise like/unlike under a cap becomes a rep drain, or with weights a faucet.

Event votes need the same care, adapted. TNL already hides tallies while a stage is open, gates on account age, and blocks self-votes (`server-10-events-2-routes.js:28–40`). Reddit fuzzes counts because accurate ones "would make it trivial to figure out a lot of our anti-cheating mechanisms" ([Daily Dot](https://dailydot.com/news/reddit-vote-count-percent-like/)). TNL gets the same protection from hiding counts.

The missing piece is **shadow-weighting**. Accept a suspicious vote with a normal response, but store `weight = 0` so the voter can't tell which signal fired. Then audit after the stage closes and before the reveal, inside `tickEvent()`. Score a vote 0 when the voter's account is younger than the stage, uses a disposable email, or shares a hashed IP with the entrant. Votes from fresh accounts during an Instagram-driven event are mostly real fans, so weighting them to zero keeps them as members where a ban would drive them off.

## Instagram ranks on rates per reach, and TNL has no denominator

Every Instagram recommendation surface works as a funnel ([Meta Engineering, 2023](https://engineering.fb.com/2023/08/09/ml-applications/scaling-instagram-explore-recommendations-system/)):

1. Cheap candidate sources pull in posts: trending, recent interactions, long-term interests.
2. A light model narrows them down, then a heavy model predicts the chance of each action.
3. A hand-weighted value model sums those chances: `W_like·P(like) + … − W_see_less·P(see less)`.
4. A final pass applies integrity filters and diversity rules, such as never showing the same author twice in a row.

The learned models don't scale down to TNL, but **the weighted value model with a negative term, and the diversity pass, both do**. TNL's `server-10-rank.js` already has the diversity pass (author damping ×0.55^k) and a sound numerator: unique responders, weighted by standing.

**What TNL lacks is reach.** Mosseri names likes-per-reach and sends-per-reach, alongside watch time, as Instagram's top signals ([Social Media Today](https://www.socialmediatoday.com/news/instagram-shares-algorithm-insights-2025/738034/)). Without impressions, a post at the top of the Showroom collects more responses simply because it sits at the top, and the score feeds on itself.

A small schema fixes this. Count an impression when a card is at least 50% visible for at least one second, using an IntersectionObserver. Batch the post IDs and send them through `navigator.sendBeacon('/api/seen')`. Store them as one row per (post, viewer, day) in a `WITHOUT ROWID` table, upserting the longest dwell time. Then smooth each rate toward the lab's median with a beta prior, `(eng + 20·μ_lab) / (reach + 20)`. A brand-new post then scores exactly at its lab's median, so it is neither buried nor over-promoted. Wilson lower bounds do the opposite: they are pessimistic and push new work down, which suits "best of all time" lists but not a feed ([Evan Miller](https://www.evanmiller.org/how-not-to-sort-by-average-rating.html)).

**Reach also unlocks Instagram's best small-creator mechanism.** Since April 2024, Instagram shows eligible content first to a small audience predicted to like it, then widens step by step if the work does well. It only recommends the original when duplicates exist, and it drops accounts that repost more than 10 times in 30 days ([TechCrunch](https://techcrunch.com/2024/04/30/instagram-is-updating-its-ranking-systems-to-surface-more-content-from-smaller-original-creators)). Trial Reels hand the same mechanism to creators: a non-followers-first test that, if it flops, doesn't count against the account ([Meta](https://about.fb.com/news/2024/12/trial-reels-try-content-non-followers-first/)).

For TNL that becomes a **guaranteed test audience**: about 30 impressions in the post's lab within 48 hours. The work is promoted only if its smoothed rate beats the lab median. That should replace `newCreatorLift`, the +1 for a member's first three works, which can be gamed by deleting and reposting. An exploration share of about 15% of Showroom slots, at fixed positions, keeps discovery alive. These constants are engineering suggestions; Meta publishes no test-audience sizes or weights.

**Negative signals and controls come next.** Instagram's "Not interested" and "Reset suggested content" ([Business Today](https://www.businesstoday.in/amp/technology/news/story/dont-like-what-you-see-on-your-instagram-new-reset-recommendations-feature-announced-heres-how-it-works-454347-2024-11-20)) grew into "Your Algorithm". It shows the topics Instagram thinks you like and lets you type more or less of them, with one setting shared across Feed, Reels and Explore since June 2026 ([Instagram](https://about.instagram.com/blog/announcements/reels-algorithm-control)). TNL's labs already work as topics, so a per-viewer `user_lab_affinity` table that the viewer can see and edit is the whole feature.

Meta also found that engagement alone is a poor guide. Its interest heuristics reached only **48.3% precision** until it added in-feed surveys ([Meta Engineering, Jan 2026](https://engineering.fb.com/2026/01/14/ml-applications/adapting-the-facebook-reels-recsys-ai-model-based-on-user-feedback/)). A rare "Was this worth your time?" prompt is a cheap TNL version.

For tracks, Instagram's watch time becomes **plays and completion**: a qualified play is at least 30 seconds or half the track. Musicians understand that better than a skip rate.

**Notifications deserve the same discipline.** Instagram stopped ranking notifications by click-through rate and started asking what each one *adds*. It sends only if `P(active|send) − P(active|drop)` clears a fixed budget, which cut volume "substantially" with "no decline in user engagement" ([Meta Engineering, 2022](https://engineering.fb.com/2022/10/31/ml-applications/instagram-notification-management-machine-learning/)). In 2025 it multiplied each score by a diversity term, `D = Π(1 − wᵢ·pᵢ)`, that pushes down repeats of the same author, type or surface ([Meta Engineering, 2025](https://engineering.fb.com/2025/09/02/ml-applications/a-new-ranking-framework-for-better-notification-quality-on-instagram/)).

TNL can port that formula directly, with three rules:

- **Always send transactional notifications**: money, collab invites, DMs.
- **Batch social ones**: "Ana and 4 others liked…".
- **Damp a notification for someone active in the app in the last 10 minutes**, since they will see the activity anyway. This is Instagram's uplift insight in miniature.

## Instagram's 2025–26 features that reuse data TNL already holds

Instagram's record shows which features last. Those built inside existing loops stuck: Reels in the feed, sends in DMs, reposts on profiles. Separate destinations died: IGTV, the Shop tab removed in 2023, and Guides ([TechCrunch](https://techcrunch.com/2023/02/14/instagram-is-killing-live-shopping-in-march-will-focus-on-ads-instead); [9to5Mac](https://9to5mac.com/guides/igtv/)). Every recommendation below lives inside a screen TNL already has.

**Creator insights are the biggest product gap, and they depend on the impression log.** In April 2025 Instagram made **Views** the main metric across formats. Its insights now split out reach (unique accounts), sends, profile visits, follows from a post, and where views came from ([SocialPilot](https://www.socialpilot.co/instagram-marketing/instagram-views-metrics-changes); [Inro](https://www.inro.social/blog/instagram-reels-insights)).

Creators optimise for whatever is visible, so TNL should show the metrics it wants more of. The insights panel on a member's own post should show:

- reach;
- saves to boards;
- sends;
- collabs;
- rep earned;
- track completion;
- which surface the views came from: Showroom, lab, profile, DM or `/p/:id`.

Leave out competitive comparisons, which Instagram added and which breed anxiety in a small network.

**Several cheap wins reuse rows TNL already owns.** Instagram's 2025 Reposts tab credits the original and shows it to the reposter's followers ([About Meta](https://about.fb.com/news/2025/08/new-instagram-features-help-you-connect/)). TNL's reshares make that a profile query. Rep still goes to the original author, and only once per person after the share fix.

Instagram's Friends tab ("public content your friends have interacted with", with an opt-out) is also just a query over likes, comments and collabs ([About Meta](https://about.fb.com/news/2025/08/new-instagram-features-help-you-connect/)).

Instagram's other recent creator wins share one idea: **edit after publish without losing engagement**. That covers scheduling up to 75 days ahead, inviting a collaborator to an already-published post, swapping audio on a live post, and reordering the grid ([Metricool](https://metricool.com/instagram-news/); [NapoleonCat](https://napoleoncat.com/blog/instagram-new-features-and-updates/)). TNL already has drafts, a background post queue, a sound library and collab invites. Each of these is a column plus a route, and scheduling runs on a server tick like `tickEvent()`.

TNL should skip Map (privacy backlash), Instants, Blend ("mixed reception"), AI generation in the style of Edits, and DM translation, which would need a new service.

**Other creative platforms show what a creative-first network should add on top.** The pattern across them is credit and consent wired into the product:

- **BandLab** passed **100M users** ([MBW](https://www.musicbusinessworldwide.com/music-making-app-bandlab-surpasses-100-million-users/)). Its forks always credit the original at the top, and contests can be entered by forking a shared track ([BandLab](https://blog.bandlab.com/forking-and-collaboration-on-bandlab-explained/); [Music in Africa](https://www.musicinafrica.net/node/173063)). A "fork this beat" button in the Studio extends TNL's existing +4 `sound_used` rep, which already comes from someone else's action.
- **SoundCloud** pins comments to a timestamp on the waveform ([LabelGrid](https://help.labelgrid.com/en/platforms/soundcloud/)). Timed comments would turn TNL's Music lab feedback channel into critique tied to the track.
- **YouTube Collaborations** (Aug 2025) recommend an accepted collab to **every collaborator's audience** ([PPC Land](https://ppc.land/youtube-launches-collaboration-feature-for-creator-partnerships/)). That is the reach payoff TNL's collabs lack: show accepted collabs in both members' followers' Showroom.
- **Bandcamp Fridays** waive the platform's cut on set days. They have paid out **$154M since 2020**, $19M of it in 2025 ([MBW](https://www.musicbusinessworldwide.com/bandcamp-fridays-hit-154m-in-payouts-since-2020-with-19m-paid-in-2025-alone)). That is the best-evidenced commerce mechanic found, and a monthly "TNL Friday" is close to a one-line fee override.
- **pixiv Requests** (a fan proposes, the creator accepts, the fan pays, the creator delivers) has carried **390k+ requests** ([pixivision](https://www.pixivision.net/ko/a/5847)). It mirrors TNL's accept-to-count collab model on Stripe Connect.
- **Dribbble's numbered Weekly Warm-up** ([Dribbble](https://dribbble.com/Dribbble)) and Inktober show that a fixed cadence with small prompts builds habit better than big prizes. A lightweight "weekly prompt" event type with no voting is the TNL version.

Paid boosts (Depop) are ruled out by the no-ads rule. Anything that touches checkout, licences or uploads needs `/security-review`.

## One SQLite box goes far once media and slow work move off it

Early Instagram's rule was "keep it very simple, don't re-invent the wheel" ([Instagram Engineering](https://instagram-engineering.com/what-powers-instagram-hundreds-of-instances-dozens-of-technologies-adf2e22da2ad)). It reached 14M users on Postgres, Redis and memcached, S3 with CloudFront, and an async queue that handled feed fan-out "so posting was as responsive for a new user as for a user with many followers" ([HighScalability](https://highscalability.com/instagram-architecture-14-million-users-terabytes-of-photos/)).

SQLite's own guidance calls under 100K hits a day conservative, with 10× demonstrated. The real limits are **one writer at a time and one machine** ([sqlite.org](https://www.sqlite.org/whentouse.html)). Rails 8 now ships its job queue, cache and pub/sub on a single database with no Redis ([Rails](https://rubyonrails.org/2024/11/7/rails-8-no-paas-required)). TNL's architecture is therefore sound. Its risks are specific.

**The top risk is still storage.** Both the database backups (`VACUUM INTO`, keeping 7) and the media live on the same Railway volume, and Railway allows one volume per service with no overlapping deploys ([Railway](https://docs.railway.com/volumes/reference)). If the volume is lost, everything goes with it.

Cloudflare R2 fits best because Cloudflare already sits in front of TNL. It costs **$0.015/GB-month with free egress** ([Cloudflare](https://developers.cloudflare.com/r2/pricing/)), so 100 GB is about $1.35 a month. Upload filenames are already content-hashed and served `immutable`, so the move can be gradual: write each new upload through to the bucket, backfill old files in a background job, then serve from a `media.` subdomain. SigV4 signing is about 60 lines on `node:crypto`, so **no new npm dependency** is needed. R2 itself is a new service, though, so the owner must approve it.

**Note that `node:sqlite` is synchronous.** A daily `VACUUM INTO` of a large file freezes every request and SSE stream. Move backups into a `worker_threads` worker with its own connection, or use `sqlite.backup()`. Pinning Node to at least 22.18 enables both the `timeout` option and `backup()` ([Node docs](https://nodejs.org/api/sqlite.html)). `src/db.js` sets WAL and `synchronous=NORMAL` but **no `busy_timeout`**; add it along with a periodic `PRAGMA optimize`.

**A SQLite `jobs` table copies Instagram's 2011 split between the request and the work behind it.** It is the Solid Queue pattern: claim jobs with `UPDATE … RETURNING`, retry with backoff, and keep handlers idempotent. Email, notification batching, the impression rollups, integrity reports, the R2 backfill and ffmpeg work should all move into it, so they survive restarts and stay off the event loop.

**Media processing and realtime have cheap fixes too:**

- **Video.** Instagram's 2022 lesson was not to transcode what you can repackage. Repackaging a 23-second clip took **0.36 s of CPU against 86.17 s** for a transcode ([Meta Engineering](https://engineering.fb.com/2022/11/04/video-engineering/instagram-video-processing-encoding-reduction/)). TNL already ships `ffmpeg-static`, so a `-movflags +faststart` remux in a job is free.
- **Search.** Replace `LIKE '%term%'` with an FTS5 table ranked by `bm25()` and blended with follow and rep signals. Confirm first, in a test, that Node's bundled SQLite includes FTS5.
- **SSE, today.** `sendTo()` loops over every connection.
- **SSE, fix.** Index connections per user, add `id:` lines with a 24-hour `events` table for replay on reconnect (the snapshot-plus-delta model from Facebook's Iris ([Meta Engineering](https://engineering.fb.com/2014/10/09/production-engineering/building-mobile-first-infrastructure-for-messenger/))), and drop slow clients so they can't bloat the 768MB heap.
- **Web Push.** It works for installed iOS web apps from 16.4 ([WebKit](https://webkit.org/blog/13878/web-push-for-web-apps-on-ios-and-ipados/)). Payload-less pushes need only a VAPID signature on `node:crypto`. Send one only when the member has no live SSE connection.

**Scaling stages.** Media on R2 and continuous backups at about 10k members. A separate worker service and edge caching of public pages at about 100k. Revisit the database only near 1M, and only if write rates prove it. These bands are planning estimates: no load test of TNL exists, and a synthetic benchmark is the way to get real numbers.

## The prioritized build list

| # | Build | Maps to | Why | Effort / deps |
|---|---|---|---|---|
| P0-1 | Add `actor_id` to `rep_events` and pass `req.user.id` at every `awardRep`/`revokeRep` call site; index `(actor_id, user_id, created_at)` | `src/db.js` migration and `awardRep`; call sites in `server-02`, `-07`, `-08`, `-09`, `-10-collabs` | Every integrity check needs to know who gave the rep (CopyCatch, DEC) | ½ day, no dep |
| P0-2 | Share: award rep once per (actor, original post), and add `rateLimit` to the share route; same rule for remix credit | `server-02-auth-feed.js` ~299–348 | Confirmed +3 per share with no limit | Hours, no dep |
| P0-3 | Pin: award once per (actor, post) ever, checked against `rep_events`, not current pins | `server-09-archive-boards.js:174–222` | Pin/unpin cycling | Hours |
| P0-4 | Collab rep once per unordered pair per 30 days | `server-10-collabs-beats-showroom.js:26` | +40 per post between two accounts, uncapped | Hours |
| P0-5 | Sale rep: minimum price, first sale per buyer→seller per 30 days, held pending for 14 days and re-checked for refunds or disputes through `stripe()` | `server-07-orders-sharing.js:118,193`, `pay.js` | Rep from refunded sales leads to a permanent fee cut | 1–2 days; `/security-review` |
| P0-6 | Restore a real `verified` gate for *giving* rep, or weight unverified givers to 0 | `server-02-auth-feed.js:205` | No-op today | Hours |
| P1-1 | Caps in `awardRep` (receiver per day, pair per day and per 30 days) with partial awards and zero-amount audit rows; make `revokeRep` revoke the amount actually awarded | `src/db.js` | Stack Overflow +200/day model | 1 day; test like/unlike under the cap |
| P1-2 | `giverWeight()`: 0 under 72h or no activity; 0.5 under 14 days or a disposable domain (vendored list); salted IP hash on signup and sessions | `db.js`, `server-01-boot.js` `rateLimit` already reads `CF-Connecting-IP` | DEC-style weighting by the giver's own record | 1 day, no dep (salt in Railway Variables) |
| P1-3 | Impression beacon, `impressions` table, and `post_stats` rollup every 5 minutes | new `/api/seen` route, client observer in the feed parts, job | The reach denominator | 2–3 days |
| P1-4 | Ranking v3: weighted per-action rates smoothed per reach, a negative term, play completion, exploration slots and a test audience in place of `newCreatorLift`; A/B by `user_id % 2` | `server-10-rank.js` (7.7KB, has room) | Instagram's value model and staged expansion | 3–4 days |
| P1-5 | Creator insights on your own post | new insights route plus a panel in the post view | Biggest feature gap | 2 days after P1-3 |
| P1-6 | `jobs` table and worker; move backups off the main thread; `busy_timeout`; pin Node ≥22.18 | `db.js`, `server-05-admin-controls-backups.js` | Event-loop safety | 2 days, no dep |
| P1-7 | Off-platform backups of the DB and media to R2 | new upload job (SigV4) | Losing the volume loses everything | 2 days; **new service, ask owner** |
| P2-1 | Nightly integrity report (reciprocal pairs, concentration, lockstep, fresh givers, shared IP, pair sales) feeding an `integrity_flags` table into the admin queue; "rep corrected" compensating events | `server-10-admin.js` items, admin Today | Stack Overflow's "voting corrected" | 2–3 days |
| P2-2 | Event votes: `weight` column, shadow-weighting, and an audit before the reveal in `tickEvent()` | `server-10-events-1-core.js`, `-2-routes.js`, `test/events.test.mjs` | Sockpuppet votes | 1–2 days |
| P2-3 | "Not interested" and hide-author, editable lab affinity, "Reset" | ranking plus a card menu | Your Algorithm | 2 days |
| P2-4 | Notification batching, diversity damp and daily budget | notify path, `jobs` | Instagram 2022 and 2025 | 2 days |
| P2-5 | Reposts tab, Friends activity, scheduled publish, collab-on-published-post, accepted collabs in both followers' feeds | profile, Showroom, drafts queue, collab routes | Reuses existing rows | ~1 day each |
| P2-6 | FTS5 search; SSE per-user index, replay and back-pressure; faststart remux | `server-03` search, `server-10-live.js` | Scaling on one box | 1–2 days each |
| P3 | Timed track comments, fork-a-beat, weekly prompt event, TNL Friday, Requests, Limits and Hidden Words | Music player, Studio, events, `pay.js` | SoundCloud, BandLab, Dribbble, Bandcamp, pixiv, Instagram | Varies; money items need `/security-review` |

Each P0 and P1 item gets a `test/integrity.test.mjs` case that fails on today's behaviour, for example: share twice → rep once; pin, unpin, pin → rep once; refunded order → sale rep reversed. Watch the file sizes: `server-02-auth-feed.js` is already 18.9KB against the 24KB limit per part, and the integrity routes and ranking v3 may need new parts.

## Conclusion

Under both Instagram's ranking and its integrity work lies one design choice: treat every interaction as a **logged edge, with an actor, a target, a time and an exposure**. TNL's append-only `rep_events` is already halfway there and is better designed than most small apps'. Adding the actor and the impression turns it into the substrate for fair ranking, honest creator insights and fraud detection at once. TNL needs no machine learning to get there: SQL reports, partial-award caps and smoothed rates reproduce most of what Meta's models do, at a scale Meta never had to design for.

The less obvious implication is strategic. Because TNL ties commission to rep, its reputation system is a **pricing system**, and whatever integrity work it skips is paid for in fees. That raises the bar above Instagram's, where fake likes mostly cost vanity. The cap values, weights and thresholds proposed here are untuned starting points: Meta publishes none of its own, and TNL's member data was deliberately not inspected. The first two weeks after P0 and P1 ship should therefore be spent reading the new zero-amount audit rows and impression counts before any number is treated as settled.
