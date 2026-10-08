# TikTok product features and creator tools (2016 – Oct 2026): catalogue for TNL Labs

*Research notes, 8 October 2026. Scope: what TikTok does differently from Instagram (Instagram findings are in `reports/` and are not repeated). Every fact has an inline source. Claims I could not source this session are in each section's Gaps. "Historical" = no longer current. Third-party guides are labelled as such; TikTok-commissioned data is labelled as such.*

**TNL code baseline (checked read-only, 2026-10-08):**
- `posts.audio_track_id` already links a post to a library track (`src/db.js:508-512`). The feed joins it (`src/server-01-boot.js:317`), and a reshare keeps the sound (`src/server-02-auth-feed.js:345`).
- There is **no route that lists every post using track X** (no "sound page"). There is no "use this sound" from a post, and no rep when someone puts *your track* on *their post*.
- The `sound_used` rep (+4) applies only to Studio samples, via `POST /api/library/:id/use` → `sample_uses` (`src/server-08-trust-library.js:239-250`). `sample_uses` records user and sample, not which post was built. The Studio is off by default.
- `posts.shared_from` exists (reshare), but there is no "remix-of / response-to" lineage that keeps the reply's own media.
- There is no scheduled publishing (no `publish_at`/`scheduled_at` in `src/`). There is no per-post analytics table (`src/server-10-rank.js` has no views/reach; the Instagram report already recommends `post_views`).

## Creation & remix (Sounds, Duet, Stitch, Green Screen, templates/CapCut, photo mode, long-form, Notes, text, AI tools, drafts, Add Yours)

### Takeaway
TikTok's core advantage is that **every post is a reusable ingredient**. A sound, a 5-second clip or a prompt can each be reused in one tap, and the reuse is attributed and linked back. That builds a public lineage graph. Its standalone side apps (Notes, Now) died. TNL already stores the sound link on posts but does not show or reward the lineage, which is its cheapest TikTok lesson.

### Cited Findings
**Sounds / "use this sound" / sound pages**
- Tapping the audio link at the bottom of a video opens the sound page, which shows the Duets and Stitches that reused it. Source: third-party guide — [SocialBee](https://socialbee.com/blog/how-to-duet-and-stitch-on-tiktok).
- The recommender deliberately avoids showing "two videos in a row made with the same sound or by the same creator". Sounds are also one of the "video information" signals (with captions and hashtags) — [TikTok Newsroom, "How TikTok recommends videos", 18 Jun 2020](https://newsroom.tiktok.com/how-tiktok-recommends-videos-for-you?lang=en).
- Users can hide a *sound* as well as a creator, and that affects future recommendations — [TikTok Newsroom 2020](https://newsroom.tiktok.com/how-tiktok-recommends-videos-for-you?lang=en).
- Business accounts are restricted to the pre-cleared Commercial Music Library (over 1M tracks) and cannot use the general sound library. Source: third-party — [Dynamoi](https://dynamoi.com/learn/tiktok-music-promotion/tiktok-music-licensing).
- One blog claims that if a sound is not cleared for business use, a Duet keeps your audio and drops the original creator's. Unofficial — [SocialBee](https://socialbee.com/blog/how-to-duet-and-stitch-on-tiktok).

**Duet**
- Plays both videos at once. Layouts are split screen (vertical or horizontal), picture-in-picture ("React") and green screen. A Duet generally keeps or adds to the original audio. Creators can turn Duet off in privacy settings. A posted Duet cannot be edited. Third-party — [SocialBee](https://socialbee.com/blog/how-to-duet-and-stitch-on-tiktok).

**Stitch (launched 3 Sep 2020)**
- Mechanics: "Select up to five seconds from the video", trim it, and the clip plays *before* your own video.
- Attribution: the stitched video credits the original creator in the caption, and "the caption attribution links directly to the original, clipped video".
- Control: Settings → Privacy, on or off for all videos, plus a toggle on each upload. The default is not stated.
- Source for all three — [TikTok Newsroom, "Introducing Stitch", 3 Sep 2020](https://newsroom.tiktok.com/new-on-tiktok-introducing-stitch?lang=en).
- A third-party guide claims 15 seconds, which conflicts with TikTok's own 5 seconds — [summary of search results incl. Kapwing](https://www.kapwing.com/resources/tiktok-stitch-vs-duet-what-is-the-difference/). Treat 5s as the official figure.

**Reply to a comment with a video**
- You can reply to any comment on your videos with a video. The comment is attached as a sticker, and the reply shows in the comments and on your page — [TikTok Newsroom tutorial (undated)](https://newsroom.tiktok.com/product-tutorial-reply-to-comments-with-video?lang=en).

**Add Yours**
- A prompt sticker added in the editor. Others respond by adding to their own posts. The profile lists prompts you started or answered — [TikTok Support](https://support.tiktok.com/en/using-tiktok/creating-videos/add-yours); [creator video describing the profile button, 2023](https://www.tiktok.com/@honeybeesocial/video/7259693982672833800?lang=en). Launch date not found.

**Photo mode / carousels**
- Up to 35 images, a 9:16 swipeable post with background music. Reported minimums vary: 4 for organic posts, 2 for carousel ads. All third-party — [Kapwing](https://www.kapwing.com/resources/how-to-post-photos-and-carousels-on-tiktok-with-photo-mode/), [postfa.st](https://postfa.st/sizes/tiktok/carousel).
- 2026: photo uploads on the web and voice typing for photo posts — [Metricool timeline](https://metricool.com/tiktok-news/) (aggregator, undated items).

**Long-form**
- May 2024: TikTok confirmed it was testing 60-minute uploads with a limited group in select markets, with "no immediate plans" for wide rollout — [TechCrunch, 16 May 2024](https://techcrunch.com/2024/05/16/tiktok-upload-60-minute-videos/embed/); [Search Engine Land](https://searchengineland.com/tiktok-testing-60-minute-video-uploads-440588). I found no source for a general rollout.

**Text posts**
- The camera page gained a photo / video / text choice — [PhoneArena](https://www.phonearena.com/news/tiktok-update-text-only-posts_id149169) (date not shown in the snippet).

**TikTok Notes (photo app) — historical, killed**
- Tested in Canada, Australia and Vietnam (2024). Shut down 8 May 2025. Users were told to export their data and move to Lemon8, and TikTok gave no reason — [RouteNote](https://routenote.com/blog/tiktok-notes-is-shutting-down-tiktok-pulls-the-plug-on-its-instagram-competitor/); [TechCrunch](https://techcrunch.com/?p=2988014).

**AI tools**
- **AI Alive** (13 May 2025): turns a still photo into a short animated video, *only* inside the Stories camera. It carries an "AI-generated" label and C2PA metadata — [TikTok Newsroom](https://newsroom.tiktok.com/en-us/introducing-tiktok-ai-alive); [TechCrunch](https://techcrunch.com/2025/05/13/tiktok-launches-tiktok-ai-alive-a-new-image-to-video-tool).
- **Symphony** (advertiser suite, 2024–26):
  - Image-to-video makes 5-second clips from an image plus a prompt, also inside Adobe Express — [TikTok Newsroom](https://newsroom.tiktok.com/en-us/tiktok-symphony-updates); [TikTok for Business](https://ads.tiktok.com/business/en-US/blog/tiktok-symphony-ai-creative-suite).
  - 2026: Symphony Agent generates whole campaigns, and Seedance 2.5 makes AI video ads up to 30s — [Metricool](https://metricool.com/tiktok-news/).
  - Commentators question what this means for creators' brand deals — [RouteNote](https://routenote.com/blog/tiktok-joins-in-on-the-ai-generated-video-expansion/).
- **Other 2026 AI items** (aggregator, undated) — [Metricool](https://metricool.com/tiktok-news/):
  - AI dubbing into 15+ languages.
  - An AI meme generator.
  - AI LIVE intros.
  - AI video summaries, scrapped after inaccurate results.
  - Over 3B videos labelled AI-generated.
  - A test control to *reduce* (not remove) AI content in the feed; see also [Digital Music News, Nov 2025](https://www.digitalmusicnews.com/2025/11/21/tiktok-ai-toggle-how-to-use/).

**Effect House (AR effects by creators)**
- Out of beta August 2023 — [TechCrunch](https://techcrunch.com/2023/08/31/tiktoks-effect-house-ar-development-platform-exits-beta/).
- Effect Creator Rewards pays effect makers. It expanded to 14 more countries in October 2023 — [TechCrunch](https://techcrunch.com/2023/10/11/tiktok-updates-effect-creator-rewards-lower-eligibility-requirements-new-payout-model-and-more).
- Payouts moved to the Rewards Center in October 2024 — [Effect House FAQ](https://effecthouse.tiktok.com/learn/guides/support/faq-effect-creator-rewards).
- Latest release noted is v5.6.1, 19 Jan 2026 — [Effect House release notes](https://effecthouse.tiktok.com/latest/release-notes-latest).

**CapCut templates**
- CapCut hosts a large free template library aimed at TikTok, with "make the same video" style reuse. Sources are promotional or creator-posted only — [CapCut](https://www.capcut.com/explore/templates-for-tiktok/7497637012615792641).

### Inferences
- The shared pattern behind Duet, Stitch, sounds, Add Yours and video replies:
  - a one-tap reuse entry point on any post;
  - automatic, linked attribution to the source;
  - a **public page that aggregates every derivative** (sound page, prompt page);
  - per-creator permission toggles.

  TNL already has the data for the sound case (`posts.audio_track_id`). It lacks the aggregate page, the reuse button and the rep event.
- **Verdicts** (Adopt / Adapt / Skip):
  - **Sound page + "Use this sound"** → *Adopt.* `GET /api/tracks/:id/posts`, and a "Use this sound" button on the post's sound chip that opens the composer with the track preloaded. Award `sound_used` (+4, once per user per track) to the track owner when *someone else's* post uses it. This keeps the "others' actions only" rule.
  - **Stitch** → *Adapt as "Build on this".* A new post that references a parent post (`remix_of`), shows the parent as a linked chip, and gives the parent author a small rep event. A creator opt-out toggle on each post. TNL is image/audio-first, so skip video splicing.
  - **Duet** → *Adapt for Music only.* "Add a layer": record or upload a stem over someone's track. Both credited, both linked. Implementation is heavier (client-side audio mix); later.
  - **Reply with a post** (to a comment) → *Adopt (cheap).* A comment can be answered with a new post that carries the comment as a quote.
  - **Add Yours** → *Adapt.* It overlaps with TNL tournaments and polls. A lightweight "prompt" post that others answer could feed the Events pipeline.
  - **Photo mode with music** → *Already have* (carousels up to 10, plus a sound). Skip raising to 35.
  - **60-min long-form / text posts / Notes app** → *Skip* (Notes failed; scope creep).
  - **AI Alive / Symphony** → *Skip.* This conflicts with a creative-first, human-made positioning; if anything, label AI.
  - **Effect House / CapCut templates** → *Skip* (heavy platform investment). A "template" idea is covered by the Build-on-this lineage.

### Gaps
- Launch dates I could not verify this session: Duet, the original-sound page, Green Screen, Add Yours, text posts, Q&A, drafts, scheduling (TikTok web/Studio), and photo mode. Background knowledge (unverified): Duet dates from Musical.ly/TikTok around 2017–18, and photo mode from around 2022.
- The exact defaults for Duet and Stitch permissions (on or off for new and adult accounts) were not found in official docs.
- I found no engagement data on what share of TikTok videos use a reused sound, or Duet/Stitch volume.
- "Footnotes" is a fact-checking feature, not a creation tool (see Community).

## Discovery (For You / Following / Friends / STEM / Local, search, controls)

### Takeaway
TikTok made **the interest graph, not the follow graph, the default**. Follower count is explicitly not a direct ranking factor, and the feed forces diversity, so a new creator can be seen. It then layered user controls on top: topic sliders, keyword filters, refresh, and AI-content dials. Search became a creator tool through Creator Search Insights' "content gap".

### Cited Findings
**Ranking principles**
- Signals are interactions (likes, shares, follows, comments, content created), video info (captions, sounds, hashtags) and device/account settings, which get "lower weight".
- Finishing a longer video is a strong signal. "Neither follower count nor whether the account has had previous high-performing videos are direct factors."
- "Not Interested", hiding a creator or sound, and reports all down-weight content.
- Source for all three — [TikTok Newsroom, 18 Jun 2020](https://newsroom.tiktok.com/how-tiktok-recommends-videos-for-you?lang=en).
- 2025 "Meaningful Engagement" update (aggregator): saves and shares are weighted above likes, and videos sent to friends or saved to collections are prioritised — [Metricool](https://metricool.com/tiktok-news/). Not confirmed by a TikTok primary source.

**Feeds**
- **Friends tab** replaced the Discover tab in the bottom bar from May 2022. It shows mutual follows — [TechCrunch, 9 May 2022](https://techcrunch.com/2022/05/09/tiktok-friends-tab-replacing-discover-tab/).
- In 2023 TikTok tested an Explore page replacing Friends in some regions — [MediaPost](https://www.mediapost.com/publications/article/384262/tiktok-tests-new-explore-page-to-replace-friends.html). The current Friends/Discover state varies by account and is unconfirmed.
- **STEM feed** was announced March 2023 (Pi Day) beside Following and For You. Content is vetted with Common Sense Networks and Poynter. It later expanded to the UK, Ireland and Australia — [TechCrunch, 14 Mar 2023](https://techcrunch.com/2023/03/14/tiktok-is-adding-a-dedicated-feed-for-stem-content); [TikTok Newsroom AU](https://newsroom.tiktok.com/en-au/tiktoks-dedicated-stem-feed-launches-in-australia-to-inspire-next-generation-of-engineers-scientists-and-doctors).
- **Local Feed / Nearby** (US, 2026): an optional tab ranking by location, relevance and recency. Precise location is opt-in and off by default — [Metricool](https://metricool.com/tiktok-news/).

**User controls**
- **Manage Topics**: Settings → Content preferences → Manage topics, with a slider per topic, e.g. "Creative arts" covers graphic design, painting, drawing and art tutorials. Sliders "won't eliminate topics entirely". Piloted in the US, then global in August 2024 — [TechCrunch, 30 Aug 2024](https://techcrunch.com/2024/08/30/tiktoks-new-manage-topics-tool-gives-you-more-control-over-your-for-you-feed-heres-how-to-use-it).
- **Keyword filters**: apply to For You and Following.
  - June 2025 added AI "Smart Keyword Filters": filtering "remodeling" also hides "renovation".
  - TikTok announced the cap would double from 100 to 200, but the support page still says 100.
  - Sources — [TechCrunch, 3 Jun 2025](https://techcrunch.com/2025/06/03/tiktok-rolls-out-ai-powered-smart-keyword-filters-to-limit-content-you-dont-want-to-see); [TikTok Support](https://support.tiktok.com/en/safety-hc/account-and-user-safety/user-safety).
- **Refresh your For You feed** (2023): resets recommendations without touching Following, profile or inbox. Path: Settings → Content preferences — [ContentStudio](https://contentstudio.io/blog/tiktok-refresh); [TechCrunch](https://techcrunch.com/?p=2501043).

**Search as a creator tool**
- **Creator Search Insights**: search "Creator Search Insights" in the app.
  - A **Content Gap** tab lists searches with high demand and little supply, each with a % popularity change.
  - Eligibility claims vary (1,000+ followers, or Creator Rewards users).
  - All third-party — [Soup Agency](https://soupagency.com.au/blog/how-to-use-tiktoks-creator-search-insights-tool-to-leverage-your-tiktok-seo/); [Reachism](https://reachism.com/blog/tiktok-creator-search-insights-content-gaps).
- 2026 additions (aggregator):
  - "AI Canvas" in Creator Search Insights drafts text and carousel layouts.
  - Search keyword management: creators add or block keywords, with TikTok oversight against stuffing.
  - "Smart Search" AI summaries.
  - Source — [Metricool](https://metricool.com/tiktok-news/).

### Inferences
- TNL's ranked Showroom is already discovery-first. The TikTok lessons are: **never use follower count as a ranking input**, **interleave so no two consecutive items share a creator or sound**, and give members **lab sliders** (more or less `// Fashion`) rather than hard filters.
- **Verdicts:**
  - **Diversity rule** (no same creator or sound back to back) → *Adopt* in `server-10-rank.js`.
  - **Per-lab "more/less" sliders** → *Adapt.* TNL's labs are the natural topic list.
  - **Keyword mute** → *Adopt (small).*
  - **Content Gap** → *Adapt as a small "what people search for and can't find" list per lab.* It needs search logging first.
  - **Friends feed** → *Skip for now.* TNL's Following plus collabs covers it at this scale.
  - **STEM-style vetted feed** → *Skip.*
  - **Local feed** → *Skip*, unless TNL runs city events.
  - **Refresh feed** → *Skip* (little personalisation to reset at TNL's size).

### Gaps
- I found no primary TikTok document on 2024–26 ranking weights. The "saves and shares over likes" claim comes from an aggregator.
- Status of Trending/Discover page and hashtag challenge pages in 2026 not verified.

## Music (SoundOn, Commercial Music Library, Add to Music App, song pages, how songs break, artist tools)

### Takeaway
TikTok turned the sound page into a music-industry funnel. Songs go viral on TikTok first, then convert off-platform via "Add to Music App" and, from 2026, Apple Music "Play Full Song". TikTok also owns distribution through SoundOn. TNL's equivalent is to make every track a page that shows who built with it, and to reward the owner.

### Cited Findings
**Luminate/TikTok Music Impact Report (Feb 2025)** — TikTok-commissioned data, US unless noted ([TikTok Newsroom](https://newsroom.tiktok.com/tiktok-and-luminate-release-latest-music-impact-report?lang=en)):
- 84% of songs entering the Billboard Global 200 in 2024 went viral on TikTok first (global).
- TikTok users are 74% more likely than the average short-form user to discover and share new music.
- They are 68% more likely to pay for streaming, and spend 46% more on music a month.
- Music superfans are "almost twice" as likely to be on TikTok.
- Artists correlated with TikTok grew streams 11% week over week, versus 3% for others.
- For 96% of analysed artists, TikTok views were significantly related to streaming volume.
- Add to Music App had passed "over a billion track saves".
- A claim of 6B saves in the 12 months to April 2026 appears only on a stats aggregator — **unverified** ([SQ Magazine](https://sqmagazine.co.uk/tiktok-music-statistics/)).
- Luminate Q2 2025 (cited secondhand): about a third of US social users use TikTok to discover or engage with music — [RouteNote](https://routenote.com/blog/what-could-tiktoks-us-ban-mean-for-music-discovery/).

**Add to Music App** (Nov 2023, US/UK)
- An "Add Song" button beside the track name on videos and on the Sound page.
- The first service you pick becomes the default. Saves go to a default playlist (Spotify "Liked Songs") or one you choose.
- Amazon requires Prime or Unlimited.
- "No money is changing hands" per a source familiar with it.
- Sources — [MusicRadar](https://musicradar.com/news/tiktok-add-to-music-app); [Mixmag](https://mixmag.net/read/new-tiktok-feature-save-songs-streaming-platforms-apple-spotify-amazon-news).

**Apple Music "Play Full Song" + Listening Party** (11 Mar 2026)
- Full tracks inside TikTok for Apple Music subscribers.
- Listening Party is beta, for verified artists on iOS: real-time release listening with chat.
- It came alongside a new multi-year UMG licensing deal.
- Source — [Metricool](https://metricool.com/tiktok-news/) (aggregator).

**SoundOn** (launched 9 Mar 2022)
- Free distribution and marketing.
- Pays 100% of royalties on ByteDance platforms indefinitely. On other DSPs, 100% in year one, then 90%.
- Includes artist verification, a song tab on profiles, editorial placement on Resso and CapCut, and pre-save/pre-release tools.
- Sources — [TikTok Newsroom](https://newsroom.tiktok.com/en-us/sound-on-the-new-platform-for-tiktok-music-marketing-and-global-track-distribution); [TechCrunch](https://techcrunch.com/2022/03/09/tiktok-launches-a-music-distribution-platform-soundon/); pre-release detail is third-party ([Audora](https://audora.music/guides/how-to-promote-music-on-tiktok/)).
- Third-party sources say it is available in the US, UK, Brazil and Indonesia — [Dynamoi](https://dynamoi.com/learn/tiktok-music-promotion/tiktok-music-licensing).

**Commercial Music Library**
- Over 1M pre-cleared tracks for business accounts.
- Sources conflict on whether SoundOn artists can opt in for revenue — [Dynamoi](https://dynamoi.com/learn/tiktok-music-promotion/tiktok-music-licensing).

### Inferences
- The music funnel is: song in a video → tap the sound chip → **sound page (play + every video using it + "Use this sound" + "Add Song")** → others build on it → off-platform save. TNL has the first step and the player, but not the sound page, the reuse button, or the "save off-platform" bridge.
- **Verdicts:**
  - **Track page with "Built with this" grid + "Use this sound"** → *Adopt, top priority* for the Music lab.
  - **Rep to the track owner when another member posts with their track** → *Adopt* (extends `sound_used`, once per user per track; it is others' action, so it fits the product rule).
  - **"Add to Music App"** → *Adapt* as an optional external link field on a track (Spotify/Apple/Bandcamp URL). No integration and no new dependency.
  - **Listening Party** → *Adapt.* TNL already has an SSE live stream and lab rooms, so a scheduled "first play" in `// Music` chat is cheap.
  - **Pre-release / pre-save** → *Adapt* as a "drops on <date>" track with a notify-me list.
  - **SoundOn-style distribution / CML** → *Skip* (licensing, money, out of scope).

### Gaps
- I did not retrieve a Billboard or MBW piece with independent (non-TikTok-commissioned) data on how songs break. The 84% figure is TikTok-commissioned.
- I found no source for a "New Music" tab under that name.
- I could not verify a 2026 Luminate/TikTok report.

## Community (comments, Q&A, LIVE, Communities/Groups, Series, Now, Stories, favourites, reposts, Footnotes)

### Takeaway
TikTok's comment section *is* a content surface. It has video replies, and from September 2026 voice, poll and photo comments, with about 1.7B comments a day. LIVE monetises through gifts, battles and subscriptions. Its clones (Now, Notes) died fast; Series (paywalled collections) survived quietly.

### Cited Findings
**Comments**
- September 2026 additions:
  - voice comments up to 60s;
  - polls in comments with up to 5 options (testing);
  - photo carousel comments up to 9 images;
  - Live Photo comments.
- About 1.7B comments are posted daily.
- Source — [Metricool](https://metricool.com/tiktok-news/) (aggregator; also in the [releasebot summary](https://releasebot.io/updates/tiktok)).
- A Socialinsider study (from a vendor that sells analytics) measured 54 average comments per TikTok, versus 35 on Reels and 20 on Shorts — [Socialinsider](https://www.socialinsider.io/blog/tiktok-vs-reels-vs-shorts/).

**Reposts**
- The button rolled out in 2022, initially only on For You videos. It is not offered on friends-only videos — [iMore](https://www.imore.com/tiktok-continues-its-repost-button-rollout-limits-it-you-feed); [Dexerto](https://www.dexerto.com/entertainment/what-is-repost-on-tiktok-how-to-use-new-repost-feature-1729778/).

**LIVE**
- Battles are split-screen gift contests. A third-party estimate says they bring 3–5x the gift revenue of a normal LIVE (unverified). A BBC investigation reportedly found TikTok took up to 70% of battle gift revenue, which conflicts with a guide's 50% — [search summary incl. The Youth Lab](https://www.theyouthlab.com/insights/cash-for-drama-tiktoks-battle-royale), [ttcalculator](https://ttcalculator.net/learn/tiktok-live-battles/).
- LIVE Subscriptions give eligible creators recurring revenue — [tiktokstats guide](https://tiktokstats.com/guides/tiktok-live-monetization-how-much-can-creators-earn).
- 2026 additions:
  - LIVE replay playlists;
  - AI intro summaries;
  - recreate-and-tag LIVE highlights;
  - a ban on AI voices, prerecorded audio and static images in LIVE shopping streams.
  - Source — [Metricool](https://metricool.com/tiktok-news/).

**Series** (2023)
- Paywalled collections of up to 80 videos, each up to 20 minutes, for select creators — [NBC News](https://www.nbcnews.com/tech/tech-news/tiktok-creators-premium-content-feature-rcna73778).
- Still listed among monetisation tools in later TechCrunch coverage. No shutdown found — [TechCrunch](https://techcrunch.com/?p=2625845).

**TikTok Now** (BeReal clone) — historical, killed
- Shut down June 2023, about 9 months after launch. Old posts are viewable under Profile → Private → Now Memories — [TechCrunch, 27 Jun 2023](https://techcrunch.com/2023/06/27/tiktok-kills-bereal-clone-tiktok-now-after-less-than-a-year).

**Stories**
- Not killed. Story Highlights were rolling out in 2026 — [Metricool](https://metricool.com/tiktok-news/). AI Alive lives in the Stories camera (May 2025) — [TikTok Newsroom](https://newsroom.tiktok.com/en-us/introducing-tiktok-ai-alive).

**Footnotes** (community notes)
- Announced April 2025, rolled out in the US from late July 2025.
- About 80,000 qualified contributors: US, 18+, account at least 6 months old, no recent violations.
- A "bridging" consensus model; notes must cite a source.
- No effect on For You ranking. Professional fact-checkers are kept.
- Sources — [RouteNote](https://routenote.com/blog/tiktok-launches-community-fact-checking-footnotes-feature-in-the-us/); [MobileSyrup](https://mobilesyrup.com/2025/07/30/tiktok-testing-new-footnotes-feature/); [TheWrap](https://www.thewrap.com/tiktok-footnotes-explained-community-notes/).

**DMs** (2026)
- TikTok Chat relaunches Whee as messaging. Emoji games in DMs are in test.
- DMs are not end-to-end encrypted.
- TikTok Pay via DM was reportedly being explored in the US.
- Source — [Metricool](https://metricool.com/tiktok-news/).

### Inferences
- **Verdicts:**
  - **Poll / voice / photo comments** → *Adapt.* Photo comments ("here's my take") fit creatives. Voice comments are already possible (TNL has voice notes in DMs). Comment polls overlap with event polls.
  - **Reposts** → *Already have* (reshares, +3 rep).
  - **LIVE / battles / gifts** → *Skip.* It is heavy infrastructure and money handling, and battles have a reputation for extractive cuts. TNL's tournaments are the asynchronous, fairer analogue.
  - **Series (paywalled collections)** → *Adapt later* via the existing market and Stripe Connect: a board or collection sold as a listing.
  - **Now / Notes clones** → *Skip* (both failed within a year).
  - **Footnotes** → *Skip* at TNL's scale.
  - **Story Highlights** → *Skip* (no Stories).

### Gaps
- Q&A feature status and dates, and Communities/Groups on TikTok, were not found this session.
- I found no official LIVE revenue-share numbers; all figures are third-party and conflicting.
- The favourites/collections mechanics (folders, private by default) were not verified this session.

## Creator tools (analytics definitions, Creator Center/Academy, Promote, Effect House)

### Takeaway
TikTok's analytics teach creators *retention*: average watch time, % watched to the end, retention curve, and traffic source split (For You vs Following vs search vs sound). Even TikTok's own definitions are inconsistently reported. TNL has no per-post analytics, so a small, honest "who saw / built with / saved this" panel is the useful takeaway.

### Cited Findings
- **Official Creator Academy definitions** — [TikTok Creator Academy](https://www.tiktok.com/creator-academy/en/article/tool-analytics-intro):
  - Average watch time = "the average duration viewers spent watching your content".
  - Retention = % of the video watched, used to find drop-off points.
  - Watched full video = % of viewers who watched "until the last few seconds".
- Third-party guides define these differently (average watch time as a %; full watch as a count) — [Hootsuite](https://blog.hootsuite.com/tiktok-analytics/), [BrandGhost](https://blog.brandghost.ai/posts/tiktok-analytics-guide-creators/).
- **Traffic sources** cover the For You feed, profile, Following, sounds, search and DMs. A high search share implies long-tail views — [Hootsuite](https://blog.hootsuite.com/tiktok-analytics/).
- The often-quoted "8.4s average watch time" has no primary source — unverified.
- **Effect House and Effect Creator Rewards** (see Creation section): TikTok pays creators of *tools* (effects), not just videos — [TechCrunch](https://techcrunch.com/2023/10/11/tiktok-updates-effect-creator-rewards-lower-eligibility-requirements-new-payout-model-and-more).
- **2026 creator protection**: an opt-in AI likeness-detection pilot for a small group of US creators (Jumio ID and selfie; TikTok says it does not keep IDs) — [Metricool](https://metricool.com/tiktok-news/).

### Inferences
- "Sounds" as a traffic source is the key idea for TNL: show "N plays came from people opening this track's page" and "N members built with it".
- TikTok paying tool-makers (Effect House) maps onto TNL rewarding sound and loop sharers, which already exists.
- **Verdicts:**
  - **Per-post insights** (reach, saves, sends, built-with, source split) → *Adopt.* This aligns with the Instagram report's `post_views` recommendation; don't duplicate it.
  - **Retention curves** → *Skip* (TNL is mostly images and audio).
  - **Promote (paid boost)** → *Skip.* It contradicts rep-only standing.
  - **Creator Academy** → *Skip.* A short "how the Showroom ranks" page is enough.

### Gaps
- I did not retrieve TikTok Promote mechanics or pricing, or Creator Center/TikTok Studio scheduling limits (background: TikTok web/Studio scheduling up to about 10 days ahead — **unverified**).
- I found no follower-activity heatmap definition from an official source.

## What made TikTok win vs Reels/Shorts; what flopped

### Takeaway
The evidence supports **discovery for non-followers** and a **standalone, single-purpose app** as TikTok's edge, plus higher conversation per video. Reels has not "flopped": it leads on watch time, sales and reach. TikTok's flops are its clones of other apps (Now, Notes) and inaccurate AI summaries.

### Cited Findings
- TikTok is seen as better at pushing content to non-followers, so viral spread is easier. Reels suits an existing community — [Socialinsider study](https://www.socialinsider.io/blog/tiktok-vs-reels-vs-shorts/) (vendor).
- The Shorts finding is from the same study: Shorts often beat both on views for small and mid accounts, while TikTok leads for large accounts.
- Reels leads on watch time and on advertiser-reported sales; one source puts Reels' potential reach at 2.4B versus TikTok's 2.05B — [Benzinga analyst note](https://benzinga.com/z/39991984); [Search Engine Journal](https://www.searchenginejournal.com/tiktok-dominates-short-form-content-instagram-reels-not-far-behind/488042/).
- The official design principle of ignoring follower count and diversifying sounds and creators — [TikTok Newsroom 2020](https://newsroom.tiktok.com/how-tiktok-recommends-videos-for-you?lang=en).
- **Flops:**
  - TikTok Now (about 9 months) — [TechCrunch](https://techcrunch.com/2023/06/27/tiktok-kills-bereal-clone-tiktok-now-after-less-than-a-year).
  - TikTok Notes (closed May 2025, likely low adoption) — [RouteNote](https://routenote.com/blog/tiktok-notes-is-shutting-down-tiktok-pulls-the-plug-on-its-instagram-competitor/).
  - AI video summaries (scrapped) — [Metricool](https://metricool.com/tiktok-news/).
- **Regulatory headwind:** in February 2026 the European Commission found TikTok's infinite scroll may breach the DSA for teens — [Metricool](https://metricool.com/tiktok-news/).
- **US ownership** now sits with TikTok USDS Joint Venture LLC (ByteDance 19.9%; Oracle, Silver Lake and MGX majority). Creator tools are reported as unchanged — [Metricool](https://metricool.com/tiktok-news/).

### Inferences
- For TNL, the transferable wins are the remix and sound lineage (creation) and follower-blind discovery (distribution), not the infinite-scroll mechanics. Those are under regulatory attack and clash with TNL's creative-first tone.
- Cloning another app's core loop (BeReal, Instagram photos) inside or beside the main app repeatedly failed for TikTok. TNL should deepen its own loops (collabs, sounds, tournaments) rather than add Stories, LIVE or a Now clone.

### Gaps
- I found no rigorous independent study of *why* TikTok won. Available comparisons come from analytics vendors and analysts.
- The "creation tools" explanation (Duet/Stitch/sounds) is my inference from mechanics, not a measured finding.

## Prioritised shortlist for TNL (remix/sound focus)

### Takeaway
Build the **sound page and remix lineage** first. TNL already stores `posts.audio_track_id` and has a `sound_used` rep event, so this is mostly one route, one screen and one rep hook. The result is TikTok's most distinctive loop, kept consistent with "rep only from others' actions".

### Cited Findings
- Mechanics to copy:
  - attribution that links to the source and a per-post permission toggle ([Stitch launch](https://newsroom.tiktok.com/new-on-tiktok-introducing-stitch?lang=en));
  - a sound page listing derivatives ([SocialBee](https://socialbee.com/blog/how-to-duet-and-stitch-on-tiktok));
  - no consecutive same creator or sound, and follower count not a direct factor ([TikTok Newsroom 2020](https://newsroom.tiktok.com/how-tiktok-recommends-videos-for-you?lang=en));
  - an off-platform save bridge driving over 1B saves ([TikTok/Luminate](https://newsroom.tiktok.com/tiktok-and-luminate-release-latest-music-impact-report?lang=en));
  - topic sliders ([TechCrunch](https://techcrunch.com/2024/08/30/tiktoks-new-manage-topics-tool-gives-you-more-control-over-your-for-you-feed-heres-how-to-use-it)).

### Inferences (ordered; effort is my estimate)
1. **Track/sound page** — S. It lists the track (play, owner, external link) and a grid of every post with `audio_track_id = X`, newest or ranked. Entry is by tapping the sound chip on any post.
2. **"Use this sound"** — S. A button on the sound chip and the track page opens the composer with the track attached. **Award `sound_used` to the track owner** when a *different* member's post uses it, once per user per track, logged in `rep_events`.
3. **"Build on this" lineage (Stitch analogue)** — M. Add a `posts.built_on` column, show a "built on @x's post" chip that links to the parent and a "builds" count on the parent, and give the parent author an opt-out on each post. Rep for being built on is small, once per user, to stay unfarmable. This differs from a reshare because the new post has its own media.
4. **Reply to a comment with a post** — S. It reuses step 3 with a quoted comment.
5. **Ranking diversity and no follower weighting** in `server-10-rank.js` — S.
6. **Per-lab more/less sliders + keyword mute** — S–M.
7. **Track "external link" (Spotify/Apple/Bandcamp) + "drops on" pre-release with notify** — S.
8. **Listening Party** in `// Music` (scheduled premiere over the existing live stream/chat) — M.
9. **"Add a layer" (Duet analogue for Music)**: record or upload a stem over someone's track, both credited — L. Do it after 1–3 prove usage.
10. **Skip:** LIVE/battles/gifts, Now/Notes-style side apps, Stories, AI generators, Promote, 60-min video, Footnotes, paid distribution.

### Gaps
- No usage data from TNL itself (how often tracks are attached to posts) was checked. That needs a read-only query on the live database, which is out of scope here.
