# Instagram lessons for TNL Labs

*Research and code review, 7 October 2026. Each recommendation is checked against what TNL already ships, so nothing here re-proposes a feature that exists.*

## The short version

TNL already copies most of what made Instagram good: carousels, collab posts, saves/boards, DMs, a ranked Showroom that lifts new creators, link-preview pages and Instagram share cards. The useful lessons now come from the places where **Instagram has let creatives down**: falling reach, ads, AI training on their work, a feed that pays off aggregators, and money that is hard to earn. TNL's advantage is being the opposite of those things. That only counts if it is visible in the product and measured.

Top 8, in priority order:

| # | Do this | Why (Instagram evidence) | Effort |
|---|---|---|---|
| 1 | **Count "sends" (DM shares) in ranking** | Mosseri: watch time, likes-per-reach and **sends-per-reach** are the top 3 signals, and sends matter most for reaching new people. TNL already stores `dm_messages.post_id` but `responseQuality()` in `src/server-10-rank.js` ignores it. | Small: one more `UNION ALL` |
| 2 | **Track reach (unique viewers per post)** and rank on response ÷ reach | Without reach, a post that 200 people scrolled past ranks the same as one that 5 people saw and all loved. Instagram normalises every signal by reach. | Medium: a `post_views` table, a batched beacon from the client |
| 3 | **Creator insights on your own post**: reach, saves, sends, rep earned, and where it was seen | Instagram opened Insights to all public accounts in March 2026, and creators call it the most-used pro tool. TNL tracks listing views but not post views. | Medium (needs #2) |
| 4 | **Public "No AI training" promise + `robots.txt`/`noai` headers + an optional "AI-assisted" label** | Meta's AI-training policy pushed Cara from ~40k to 650k+ users in one week (June 2024), then past 1M. TNL has no `robots.txt` and no AI policy. That is the cheapest way to show what TNL stands for. | Small |
| 5 | **Originality rule in ranking**: reshares never outrank the original, and repeat reposters get damped | Instagram (Apr 2024) swaps reposts for the original in recommendations and drops aggregator accounts (10+ reposts in 30 days). TNL already excludes `shared_from` from candidates. Next steps: damp near-duplicate uploads (same image hash) and credit the original author. | Small–medium |
| 6 | **A Reposts tab on profiles** (credit always visible) | Instagram added this in Aug 2025. TNL already has reshares, so a tab on the profile is cheap. Each reshare also earns the original author +3 rep, so it feeds the loop TNL already has. | Small |
| 7 | **"Your Showroom" topic controls**: pick labs and mediums, plus a reset button | Instagram's "Your Algorithm" (Reels Dec 2025, then Explore, then Feed in Jun 2026) responds to "the feed doesn't get me" complaints. TNL's labs already work as topics, so this is a weight per lab in `rankShowroom`. | Small–medium |
| 8 | **A lab broadcast / "studio notes" channel** that creators can post to their followers | Broadcast channels report 30%+ engagement compared with 1–3% for feed posts. TNL's chat already does lab rooms, so a one-to-many room per creator reuses that code. | Medium |

---

## 1. Features and product

**What Instagram did right early (2010–2012, historical).** The founders asked one question, *what problem are we solving*, and solved it in the simplest way. Filters made bad phone photos look good. Cross-posting to Twitter and Facebook was the growth engine. The first users were designers and photographers, which set the look of the whole network. **TNL lesson:** the Instagram share cards (event Story/board cards, `/p/:id` previews) are TNL's version of cross-posting, so every piece of work should have a one-tap card. Keep seeding each lab with a few strong creators before opening it wide.

**Recent Instagram features, rated for TNL:**

| Instagram feature | Status in TNL | Recommendation |
|---|---|---|
| Collab posts | ✅ Better (two-sided, counts only once accepted) | Keep. Show both names on the card the way Instagram does. |
| Carousels (10 → **20** in 2025–26) | 10 images | Raise to 20 for Visual and Fashion, where process shots matter. |
| Reposts tab (Aug 2025) | Reshares exist, no tab | Add the tab (#6). |
| Friends tab: what people you follow liked (Aug 2025) | — | "Liked by people you follow" line on Showroom cards. Cheap, and it drives sends. |
| Trial Reels (shown to non-followers first) | — | "Test in the lab": show a piece to one lab before your profile. Good for nervous new members. |
| Close Friends / Broadcast channels | DM groups, lab rooms | Creator broadcast (#8). Close-friends-only posts later. |
| Notes (short status in the inbox) | — | "Working on…" note above the DM inbox. Fits a lab culture of work in progress. |
| Scheduling (75 days ahead, 2026) | Drafts + background queue | Add "post at" to drafts. The queue already exists. |
| Insights for everyone (Mar 2026) | Shop stats only | #3. |
| Map / location (Aug 2025) | Posts have a place | A city filter for the Archive. Skip live location: it brought privacy backlash. |
| Affiliate links in Reels (Apr 2026) | "Shop this post" (own shop) | Allow tagging **another member's** listing with a small referral share of the commission. That earns them money and links work to the market. |

**Instagram features that failed or drew backlash, to avoid:** IGTV (a separate app and format; shut down 2022), Guides (removed), the Shop tab (removed 2023), the full-screen TikTok-style feed test (rolled back after "Make Instagram Instagram again", 2022), and the 4:5 profile grid (Jan 2025), which broke grids that creators had planned carefully. **Lesson:** don't force a format change on work people have already posted. Give creators control over how their grid is cropped. TNL could let each piece set its own grid crop, which Instagram still doesn't do well.

## 2. Look and feel (aesthetic + front end)

- **Instagram's own design direction is "content-forward"** (2022 refresh: Instagram Sans, a design system built to recede). TNL's strict white/black/green with Helvetica already does this better. Keep the accent rare so the work carries the colour.
- **Grid ratio:** Instagram moved to 4:5 because "most of what's uploaded is vertical". TNL makes a 480px grid copy, so check that the profile grid crop matches 4:5 for Visual/Fashion. Keep 1:1 as an option for album art (Music).
- **Image loading:** Instagram's web team found that **telling the browser early what it will need** (preload/prefetch) was the biggest performance win. For TNL:
  - store a tiny placeholder per image (dominant colour or a 16px blur as a data URI) at upload in `app-08-images.js`, and paint it before the 1440px copy arrives. This beats a grey skeleton for visual work.
  - `<link rel="preload">` the first Showroom image. Prefetch the next carousel slide and the next track in the player queue.
  - serve AVIF/WebP variants if the upload step can encode them without a new dependency (check first, because that would need sharp/libvips).
- **Interaction patterns to check you have:** double-tap to like on the image (there is a `dblclick` path; make sure it works with touch too), haptic feedback through `navigator.vibrate` on like/vote (Android), and optimistic UI on like, save and follow.
- **Accessibility:** Instagram has offered alt text since 2018. TNL renders `alt=` but has no member-written alt text field. Add an optional "Describe this piece" field in the post creator. It also helps search in the Archive.

## 3. Back end, ranking and safety

**Scale (historical, 2011–12):** 3 engineers ran 14M users on Django + PostgreSQL, Redis for feeds and sessions, S3 + CloudFront for photos, with "do the simplest thing" as the rule. Their time-sortable 64-bit IDs (41 bits time, 13 bits shard, 10 bits sequence) are a well-known pattern. **TNL lesson:** one Node + SQLite server is fine for a long time. The real risks are the ones the README already names:
1. **Uploaded media isn't in the backups.** Instagram put media in object storage from day one. This is the top open item, so do it before growth (needs approval, because it's a new service).
2. Put a CDN in front of `/uploads` (Railway or Cloudflare) when traffic grows. Images are most of the bytes.
3. SQLite: make sure WAL mode is on and the ranking query stays indexed. `rankShowroom` runs a `COUNT(*)` subquery for every candidate (`nth`), which will get slow at tens of thousands of posts. Cache the `nth` value on the post or the user.

**Ranking:** TNL's `src/server-10-rank.js` is already well thought out. It counts unique responders instead of raw counts, weights responders by standing with a cap, lifts new creators, uses gravity decay, follow boost and author variety. That is close to Instagram's 2024 "smaller creators" change. Gaps found against Instagram's stated signals:
- **Sends are missing** (#1). `dm_messages.post_id` is right there.
- **No reach denominator** (#2).
- **No time spent on the work.** For tracks and video, count plays past ~30% as a response (Instagram's #1 signal is watch time).
- **No negative signal.** Instagram uses "not interested" and hides. Add "Show less like this" on a card, as a damp on that author or lab for that viewer.

**Trust and safety for the rep system:** Instagram fights fake engagement by detecting rings and new accounts that act in bursts. TNL is exposed in the same way, because rep turns into lower fees, which is real money. Suggestions:
- Damp rep from accounts younger than N days, or with no posts of their own (the events code already uses `min_account_days`, so reuse it).
- Flag **reciprocal like rings**: A and B like nearly everything of each other's within minutes. Surface this in Admin → Today instead of auto-punishing.
- Rate-limit likes, follows and comments per minute per account.
- Instagram's "Hidden words" and "Restrict" tools are cheap to copy for comments and DMs.

## 4. Business model and creator money

**Instagram's numbers:** about $69.7B global ad revenue in 2025 (estimate), and more than 50% of Meta's US ad revenue for the first time ($32B, eMarketer). Reels ads were about $15B. Creators get subscriptions ($0.99–$99.99/month), Gifts ($0.01 per star), affiliate links (relaunched Mar 2026) and brand deals. Bonus programmes have repeatedly been started and cancelled. **Creators distrust Instagram's money because it changes all the time. TNL's pitch should be fees you can predict.**

**How TNL's commission (10% → 2% as rep grows) compares:**

| Platform | Seller take |
|---|---|
| Etsy | 6.5% + 3% + $0.25 processing + $0.20 listing ≈ 9.5–13%, plus mandatory offsite ads (12–15%) above $10k |
| Depop | 0% seller fee since 2024 (US/UK), but 3.3% + $0.45 processing; boosted listings 8–12% |
| BeatStars | 0% commission on subscription plans ($19.99/yr–$39.99/mo), but adds 12% to the buyer's total on marketplace sales |
| BandLab distribution | 15% free tier, 10% Pro ($12.99/mo) |
| **TNL** | 10% (L1) → 2% (L5), Stripe fees on top |

TNL's L1 rate is the same as Etsy's, and from L3 it beats Etsy. **Say so in the sell flow:** "You keep 94% at Collaborator. Etsy keeps up to 13%." The rep-for-lower-fees loop is TNL's best business idea, because no one else ties fees to standing in the community.

**New revenue ideas that keep TNL ad-free:**
1. **TNL Pro membership** (around $5–8/mo): insights (#3), scheduling, custom profile accent/theme, extra carousel slots, priority in event judging queues. No ranking boost: selling reach is what creators hate about Instagram.
2. **Briefs / commissions market:** brands or members post a paid brief (cover art, a beat, a lookbook) and creators pitch. TNL takes the normal commission. This reuses events + market.
3. **Sponsored events:** a brand pays for a tournament's prize and its name on the event. TNL already has the whole tournament engine and Instagram cards. *Note: paid-entry contests with prizes can count as lotteries or gambling in some US states. Keep entry free (or offer a free way to enter) and keep the rules page (`/e/:slug/rules`) up to date. Get legal advice before taking entry fees.*
4. **Tips on posts** through Stripe Connect (direct to creator, small fixed fee). Instagram Gifts show that demand exists.
5. **Referral share on affiliate tags** (see the features table): the market grows without ads.

## 5. Where creatives are leaving Instagram, and how TNL wins them

Main complaints: falling reach, ad saturation, the shift to video, **AI training on art without consent**, the grid crop change, and burnout from chasing the algorithm. Where they went: **Cara** (anti-AI; 40k → 650k users in a week, 1M+ after), **BandLab** (40M+ users; collab tools and beat battles), Behance/Dribbble (curation, featured work, Dribbble's invite system and "Debuts" for first shots), Depop/Grailed for fashion.

TNL already answers most of this: rep only from others, two-sided collabs, events with in-app voting, no ads. What's missing is **saying it and proving it**:
- **A one-screen "How TNL is different" page**: no ads, no AI training, how ranking works (in plain words), what fees you'll pay. Instagram had to bolt transparency on later. TNL can launch with it.
- **"Debut" treatment:** a member's first piece gets a badge and a guaranteed slot in its lab's Showroom (the ranking already has `newCreatorLift`; show it).
- **Staff curation:** "Founder feature" (+40 rep) exists. Make it a weekly public "Lab Picks" post plus an Instagram card. Behance and Dribbble grew on being featured.
- **Recurring events:** one fixed weekly beat battle in // Music and one theme a month in // Visual, the BandLab/Inktober rhythm. A fixed schedule builds habit better than one-off tournaments.
- **Use Instagram as the funnel, not the competition:** every post, profile and event already has a share card. Add a "link in bio" card for each member's `/u/:name` and treat Instagram traffic as acquisition. Votes and rep stay in the app (the CLAUDE.md rule).

---

## What I'd build first

1. **Sends in ranking** (#1): an hour of work, with a test in `test/`.
2. **No-AI-training promise + `robots.txt`** (#4): a day, mostly the wording.
3. **Post reach + insights** (#2 → #3): the base for ranking quality, for Pro, and for proving to creators that TNL gives them reach.
4. **Lab Picks + weekly events cadence**: content and operations, almost no code.

## Sources

- Instagram ranking signals: [Social Media Today](https://www.socialmediatoday.com/news/instagram-shares-algorithm-insights-2025/738034/), [dataslayer](https://www.dataslayer.ai/blog/instagram-algorithm-2025-complete-guide-for-marketers)
- Originality / small creators: [TechCrunch, Apr 2024](https://techcrunch.com/2024/04/30/instagram-is-updating-its-ranking-systems-to-surface-more-content-from-smaller-original-creators)
- Your Algorithm controls: [inro.social](https://www.inro.social/blog/your-algorithm-instagram), [TechWyse](https://www.techwyse.com/news/platform-updates/instagram-feed-algorithm-your-algorithm-controls)
- 2026 features: [HeyOrca](https://www.heyorca.com/blog/instagram-social-news), [EmbedSocial](https://embedsocial.com/blog/new-instagram-features-2026/), [Mentionlytics](https://www.mentionlytics.com/blog/instagram-new-features/)
- Reposts / Map / Friends: [PetaPixel](https://petapixel.com/2025/08/06/instagram-adds-a-reposts-tab-to-users-profiles-similar-to-tiktok/), [ABC7](https://abc7ny.com/post/what-know-instagrams-new-features-including-map-reposts-friends-reels-tab/17470707/)
- 4:5 grid: [RouteNote](https://routenote.com/blog/instagrams-new-profile-grid-layout-from-squares-to-rectangles/), [exchange4media](https://www.exchange4media.com/digital-news/instagrams-grid-update-leaves-users-brands-frustrated-140242.html)
- Brand refresh: [Instagram](https://about.instagram.com/blog/announcements/instagram-visual-refresh), [Design at Meta](https://www.meta.com/design-at-meta/blog/behind-instagrams-brand-evolution-movement-inclusivity-and-a-new-purpose/)
- Web performance: [Instagram Engineering](https://instagram-engineering.com/making-instagram-com-faster-part-1-62cc0c327538)
- Early architecture: [What Powers Instagram](https://instagram-engineering.com/what-powers-instagram-hundreds-of-instances-dozens-of-technologies-adf2e22da2ad), [Sharding & IDs](https://instagram-engineering.com/1cf5a71e5a5c), [High Scalability](https://highscalability.com/instagram-architecture-14-million-users-terabytes-of-photos/)
- Early product lessons: [Built In](https://builtin.com/articles/former-ceo-kevin-systrom-instagram-growth), [Masters of Scale](https://mastersofscale.com/kevin-systrom-how-to-keep-it-simple-while-scaling-big/)
- Revenue: [eMarketer](https://www.emarketer.com/press-releases/instagram-will-make-up-more-than-half-of-metas-us-ad-revenues-in-2025), [voxbooster](https://voxbooster.com/blog/instagram-statistics-2026)
- Creator monetization: [Buffer](https://buffer.com/resources/how-to-make-money-on-instagram)
- Broadcast / Close Friends: [PetaPixel](https://petapixel.com/2023/06/15/instagrams-one-way-broadcast-channels-roll-out-globally), [socialk.it](https://socialk.it/en/blog/instagram-broadcast-channels-guide)
- Fees: [Etsy (Marmalead)](https://blog.marmalead.com/etsy-fees-explained-2025/), [Depop (Vendoo)](https://blog.vendoo.co/how-much-does-depop-take-depop-fees-guide-for-sellers), [BeatStars (Cartmango)](https://cartmango.com/how-to-sell-beats-online/), [BandLab (productmint)](https://productmint.com/bandlab-business-model-how-does-bandlab-make-money)
- Artists vs AI / Cara: [Creative Bloq](https://www.creativebloq.com/news/instagram-ai-training), [adamlevin.com](https://adamlevin.com/2024/10/17/are-creatives-fleeing-instagram-due-to-ai/), [Statista](https://www.statista.com/statistics/1472019/cara-app-downloads/)
- Dribbble/Behance curation: [Webdesigner Depot](https://webdesignerdepot.com/the-ultimate-guide-to-everything-dribbble), [Dribbble](https://dribbble.com/stories/2021/04/29/a-bigger-more-inclusive-dribbble)

*Note: some 2026 figures (Instagram global ad revenue, broadcast-channel engagement rates) come from industry blogs rather than Meta filings. Treat them as estimates.*
