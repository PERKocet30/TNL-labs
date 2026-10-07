# Instagram / Meta ranking and recommendation systems, and how they scale down to TNL Labs

Scope note: current as of 2026-10-07. Items are dated; anything before 2025 is marked (historical) where Meta has since changed or extended it. TNL's current ranker (`src/server-10-rank.js`, v2.0 2026-09-29, read-only) was read for context: it scores Showroom posts by unique non-author responders (likes, comments, reactions, board pins, reshares) weighted by `standingWeight(rep) = min(2.5, 1 + 0.5*log2(1 + rep/40))`, +0.5 per commenter, +1.5 per accepted collaborator (max 3), +1 new-creator lift for a member's first 3 works, divided by `(ageHours + 3)^1.35`, x1.3 if followed, x0.45 if already responded to, x0.8 own work, and greedy per-author damping x0.55^k. Candidates: last 120 days, max 400. No impressions, negative feedback, completion or interest personalization.

## 1. Meta's published architecture (multi-stage pipeline, embeddings, two-tower, MTML, value models)

### Takeaway
Every Instagram recommendation surface is a funnel: many cheap candidate sources -> lightweight (distilled, two-tower) ranker -> heavy multi-task model that predicts the probability of each action -> a hand-weighted "value model" that sums those probabilities (negative actions subtracted) -> final re-ranking for integrity and diversity (e.g. no back-to-back same author). The weighted-sum value model and the final diversity pass are the parts that scale down directly to SQL/JS; the learned models do not.

### Cited Findings
- (historical, 2019) Explore candidate generation used "ig2vec, a word2vec-like embedding framework": the account IDs a user interacts with in a session are treated as a sequence of words, giving account embeddings; nearest-neighbour search (FAISS) finds accounts similar to "seed accounts" the user engaged with — [Meta AI, "Powered by AI: Instagram's Explore recommender system" (2019)](https://ai.meta.com/blog/powered-by-ai-instagrams-explore-recommender-system/)
- (historical, 2019) Three-pass ranking: distillation model 500 -> 150 candidates, lightweight neural net 150 -> 50, deep neural net -> 25 for the first page; IGQL, a C++-optimized DSL for candidate retrieval; system extracted 65 billion features and made 90 million model predictions per second — [Meta AI 2019](https://ai.meta.com/blog/powered-by-ai-instagrams-explore-recommender-system/)
- (historical, 2019) Value model: `w_like * P(Like) + w_save * P(Save) - w_negative_action * P(Negative Action)`; posts from the same author are downranked to keep diversity — [Meta AI 2019](https://ai.meta.com/blog/powered-by-ai-instagrams-explore-recommender-system/)
- (2023, still the canonical public description) Explore has four stages: retrieval (hundreds of candidates from billions), first-stage ranking (lightweight model over thousands), second-stage ranking (heavy model down to ~100), final re-ranking with business rules and integrity filters — [Meta Engineering, "Scaling the Instagram Explore recommendations system" (Aug 2023)](https://engineering.fb.com/2023/08/09/ml-applications/scaling-instagram-explore-recommendations-system/)
- Retrieval sources are mixed: heuristic (e.g. trending posts), real-time ML (recent interactions), and pre-generated (long-term interests); one source retrieves items similar to ones the user engaged with, followed by rule-based filtering of low-quality items — [Meta Engineering 2023](https://engineering.fb.com/2023/08/09/ml-applications/scaling-instagram-explore-recommendations-system/)
- Two Tower model: separate user and item networks each produce an embedding; "user and item embeddings can be cached, making inference for the Two Tower model extremely efficient." First-stage ranker is a two-tower model trained (distillation) to predict the second-stage model's output — [Meta Engineering 2023](https://engineering.fb.com/2023/08/09/ml-applications/scaling-instagram-explore-recommendations-system/)
- Second stage is an MTML (multi-task multi-label) network predicting P(click), P(like), P(see less) etc.; combined as "Expected Value = W_click * P(click) + W_like * P(like) – W_see_less * P(see less) + etc." Weights tuned by online Bayesian optimization (weeks to converge) or offline tuning mapped to online results (hours) — [Meta Engineering 2023](https://engineering.fb.com/2023/08/09/ml-applications/scaling-instagram-explore-recommendations-system/)
- Final re-rank applies integrity scoring and diversity rules such as not showing consecutive items from the same author — [Meta Engineering 2023](https://engineering.fb.com/2023/08/09/ml-applications/scaling-instagram-explore-recommendations-system/)
- Meta published 22 AI system cards (June 29, 2023) for Facebook and Instagram; Instagram's include Feed, Feed Recommendations, Stories, Explore, Reels Chaining, Search, Suggested Accounts and Notifications. Systems use "a wide variety of predictions in combination", e.g. predicting you'll share a post, and signals from behaviour plus survey feedback — [Meta Newsroom, "How AI Influences What You See" (Jun 2023)](https://about.fb.com/news/2023/06/how-ai-ranks-content-on-facebook-and-instagram/); [Transparency Center index](https://transparency.meta.com/features/explaining-ranking/)
- Engagement signals alone are noisy; Facebook Reels added the User True Interest Survey (UTIS) model — randomized in-feed surveys "How well does this video match your interests?" on a 5-point scale — because interest heuristics achieved only 48.3% precision in identifying true interests — [Meta Engineering, "Adapting the Facebook Reels RecSys AI model based on user feedback" (Jan 14, 2026)](https://engineering.fb.com/2026/01/14/ml-applications/adapting-the-facebook-reels-recsys-ai-model-based-on-user-feedback/) (search-snippet level; Facebook Reels, not Instagram)

### Inferences
- TNL's current score is already a one-stage "value model" with implicit equal weights for every action type (a like = a pin = a reshare, + 0.5 for comments). The cheapest Meta-style upgrade is to make it an explicit weighted sum per action type, with a negative term:
  `V(post) = Σ_actions w_a * rate_a(post) - w_neg * rate_neg(post)`, where `rate_a = smoothed count_a / smoothed reach`.
  Suggested starting weights for a creative community (mirroring Mosseri's "sends matter most for unconnected reach"): reshare/DM send 3.0, board save 2.0, comment 1.5, reaction 1.0, like 1.0, profile visit/follow-from-post 2.5, listen/watch completion 1.5 (per completed play rate), "not interested"/hide -6.0, report -20.
- The funnel shape maps onto a single SQLite server: (1) retrieval = several SQL candidate queries unioned (followed authors last 14 days; top-by-rate last 7 days per lab; newest 50 posts as exploration; posts from authors similar to ones you engaged with), each capped ~100–200; (2) score in JS; (3) re-rank greedily for author/lab diversity (already done for authors). At TNL's scale the "first-stage" model is unnecessary.
- ig2vec scales down as "co-engagement": two authors are similar if the same people respond to both. In SQL: `SELECT a.author, b.author, COUNT(DISTINCT user) FROM responses a JOIN responses b USING(user)` over 90 days, normalized by `sqrt(n_a * n_b)` (cosine on binary vectors). Precompute nightly into an `author_sim` table (top 20 neighbours per author).

### Gaps
- Could not fetch the "Journey to 1000 models" post or the individual Instagram system-card pages (the Reels card URL tried returned 404); exact per-surface prediction lists from the system cards are therefore not quoted here.
- Meta has never published actual value-model weights; the weights above are my suggested defaults, not Meta's.

## 2. Mosseri's public explanations and recent product mechanics (signals per surface, originality, small creators, Trial Reels, controls)

### Takeaway
Instagram ranks each surface differently: Feed/Stories lean on relationship and post info, Explore leans on post popularity, Reels on your own recent activity. Mosseri's 2025 framing names three top signals — watch time, likes per reach, sends per reach — with likes mattering more for connected (follower) reach and sends for unconnected reach. Since 2024 Instagram explicitly favours original work and smaller creators via staged audience expansion, removes aggregators, and gives users topic controls ("Your Algorithm", 2025–2026) and a full recommendation reset.

### Cited Findings
- (historical, June 8, 2021) Signals by surface, in order of importance. Feed & Stories: information about the post, information about the poster, your activity, your history with the poster. Explore: post info (popularity matters more), your history with the poster, your activity, info about the poster. Reels: your activity, your history with the poster, info about the reel (audio, visuals, popularity), info about the poster — [Instagram, "Shedding More Light on How Instagram Works" (Jun 2021)](https://about.instagram.com/blog/announcements/shedding-more-light-on-how-instagram-works)
- (historical, 2021) Feed predicted five interactions: time spent, comment, like, reshare, tap on profile photo; misinformation and Recommendation Guidelines violations (e.g. low-resolution/watermarked reels, tobacco/vaping) are demoted or not recommended; most people look at less than half their Feed — [Instagram 2021](https://about.instagram.com/blog/announcements/shedding-more-light-on-how-instagram-works)
- (2025) Mosseri: the three most important signals are watch time, likes and sends; creators should watch average watch time, likes per reach and sends per reach. Likes weigh more for connected content, sends more for unconnected — [Social Media Today (2025)](https://www.socialmediatoday.com/news/instagram-shares-algorithm-insights-2025/738034/); [Social Samosa](https://www.socialsamosa.com/news-2/instagram-reveals-key-factors-for-boosting-reach-8646916) (secondary sources reporting Mosseri's video)
- (Apr 30, 2024) New recommendation ranking shows eligible content first to a small audience predicted to enjoy it; the top performers are shown to a slightly wider audience, then the best of those wider again — intended to give smaller creators more distribution. If two or more identical pieces exist, only the original is recommended; accounts that repost others' content more than 10 times in 30 days are removed from recommendations; reposts get labels — [TechCrunch (Apr 30, 2024)](https://techcrunch.com/2024/04/30/instagram-is-updating-its-ranking-systems-to-surface-more-content-from-smaller-original-creators)
- (Dec 2024) Trial Reels: a toggle shows a reel to non-followers first; after 24 hours the creator sees views, likes, comments and shares; reels that perform well can be auto-shared to followers after 72 hours — [Meta Newsroom, Trial Reels (Dec 2024)](https://about.fb.com/news/2024/12/trial-reels-try-content-non-followers-first/)
- (Nov 19, 2024) Reset suggested content: Settings -> Content preferences -> "Reset suggested content" clears personalization across Explore, Reels and Feed; the system rebuilds from subsequent interactions — [Business Today (Nov 2024)](https://www.businesstoday.in/amp/technology/news/story/dont-like-what-you-see-on-your-instagram-new-reset-recommendations-feature-announced-heres-how-it-works-454347-2024-11-20); [UK Safer Internet Centre](https://saferinternet.org.uk/blog/instagram-announces-new-ways-to-reset-post-recommendations)
- (Dec 10, 2025 Reels; Apr 15, 2026 Explore; Jun 10, 2026 all of Instagram) "Your Algorithm": an AI-generated summary of the topics Instagram thinks you care about; users type topics to see more or less of, adjust topic pills on Explore, see labels on posts showing which interest drove a recommendation; one unified system across Feed, Reels and Explore, changes sync across all three; interests shareable to Story — [Instagram, "Reels algorithm control" (updated 2026)](https://about.instagram.com/blog/announcements/reels-algorithm-control)
- Topic summary is based on what people watch, like, share, or quickly scroll past — [Search Engine Land](https://searchengineland.com/instagram-your-algorithm-465987)
- "Not Interested" has existed since 2021; "Interested" tested for Reels (2023); Following and Favorites feeds offer chronological alternatives — [Meta Newsroom (Jun 2023)](https://about.fb.com/news/2023/06/how-ai-ranks-content-on-facebook-and-instagram/)

### Inferences
- "Per reach" is the key idea TNL lacks: Instagram normalizes engagement by how many people actually saw the post. Without impressions, TNL's score rewards posts shown more (rich-get-richer: the top of the Showroom collects more likes because it is at the top). Logging impressions lets TNL score `responders / viewers` instead of raw `responders`.
- Connected vs unconnected: compute rates separately for viewers who follow the author vs not. Use follower-rate for ranking in followers' feeds; use non-follower rate (especially reshares/saves per non-follower reach) for deciding whether to push to everyone (Explore-equivalent).
- Staged expansion (Apr 2024) is an exploration bandit in disguise and fits TNL: every new work gets a guaranteed "test audience" (e.g. first 15–30 impressions to random active members in its lab), then promotion to the next tier only if its smoothed rate beats the lab median. Trial Reels is the same mechanism exposed to creators.
- Originality rules map to TNL's product rules: reshares already excluded from candidates (`shared_from IS NULL`); add a duplicate-media hash (sha256 of upload) so re-uploads of another member's file are not recommended, and keep only the earliest.
- "Your Algorithm" maps neatly onto TNL labs: a per-viewer lab-affinity vector the user can see and edit ("more // Music, less // Film").

### Gaps
- Mosseri's 2025 signals statement is quoted via secondary press (original is an Instagram video/Threads post I did not fetch).
- No public numbers on test-audience size or promotion thresholds for the staged expansion.

## 3. Notification ranking, batching and fatigue control

### Takeaway
Meta moved notifications from "maximize CTR" to "maximize incremental value of sending" under a fixed volume budget, and (2025) added a multiplicative diversity demotion so repeated notifications about the same author/type/surface are pushed down. Both reduced volume without losing engagement.

### Cited Findings
- (Oct 2022) Utility per notification `u_i = P(active | send) - P(active | drop)`, learned via an uplift model trained on a randomized holdout where each notification was sent or dropped with 50% probability; a fixed send budget is enforced by comparing uplift to a threshold that targets send rate r (0<r<1), using an online quantile service that maps raw scores to a uniform distribution; notifications are scored online. Result: "reduced the sending volume substantially compared to using the CTR model" with "no decline in user engagement" — highly active users who'd see the content anyway get fewer — [Meta Engineering, Instagram notification management (Oct 31, 2022)](https://engineering.fb.com/2022/10/31/ml-applications/instagram-notification-management-machine-learning/)
- (Sep 2, 2025) Diversity-aware notification ranking: `Score(c) = R(c) × D(c)`, `D(c) = Π_i (1 − w_i · p_i(c))`, where p_i(c) is a binary similarity signal (1 if MMR-style similarity to recent notification history H exceeds threshold τ_i) along dimensions content, author, notification type and product surface, and w_i ∈ [0,1]; stronger penalties for tightly spaced deliveries. "Significantly reduced daily notification volume while improving CTR" (no exact numbers) — [Meta Engineering, "A new ranking framework for better notification quality on Instagram" (Sep 2025)](https://engineering.fb.com/2025/09/02/ml-applications/a-new-ranking-framework-for-better-notification-quality-on-instagram/); [InfoQ (Sep 2025)](https://www.infoq.com/news/2025/09/instagram-notification-ranking)
- The problem it addressed: too many notifications from the same creator and overemphasis on one surface (Stories) — [Social Media Today](https://www.socialmediatoday.com/news/instagram-updates-notification-ranking-avoid-fatigue/759187/)

### Inferences (recipe for TNL)
- Classify notifications: transactional (payment, collab invite, DM, admin) always send; social (like, reaction, follow, comment) go through a ranker; never rank away money or collab events.
- Batch social ones: coalesce same-type-same-target events within a window into one ("Ana and 4 others liked …"). Default window: 15 min for likes/reactions, immediate for first comment on a work, then 15 min.
- Port D(c) directly: for each candidate push, look at the viewer's last 24 h of sent pushes; `D = (1 − 0.5·[same author in last 6h]) · (1 − 0.4·[same type in last 2h]) · (1 − 0.3·[same post in last 24h])`. Send if `R·D ≥ θ`.
- Budget: cap social pushes at e.g. 6/day/user and 1 per 20 min; quiet hours 22:00–08:00 local (defer, digest). Base relevance R: 1.0 baseline, ×1.5 if actor is followed by the recipient or is a mutual, ×1.3 if actor standing high, ×0.5 if recipient was active in the last 10 min (they'll see it in-app — the uplift insight).
- Fatigue feedback: if a user ignores N≥10 consecutive pushes of a type or turns off a type, halve that type's R for 14 days. Log `notif_sent(id,user,type,author,post,sent_at,opened_at)` to measure open rate per type.

### Gaps
- Meta's weights w_i and thresholds τ_i are not disclosed; the constants above are suggestions.

## 4. Cold start (new posts, new users, small sparse networks) and exploration

### Takeaway
Meta's own public answer for new/small creators is staged audience testing (show to a small predicted-interested group, widen on success) plus mixed candidate sources (trending, real-time, long-term). For a small network the practical equivalents are: an explicit exploration slot share, Bayesian-smoothed rates so new posts are neither buried nor over-promoted, and onboarding lab selection as the user's initial interest vector.

### Cited Findings
- Staged expansion for recommendations, explicitly to give smaller creators distribution — [TechCrunch (Apr 2024)](https://techcrunch.com/2024/04/30/instagram-is-updating-its-ranking-systems-to-surface-more-content-from-smaller-original-creators)
- Retrieval mixes heuristic trending, real-time recent-interaction and pre-generated long-term-interest sources — [Meta Engineering 2023](https://engineering.fb.com/2023/08/09/ml-applications/scaling-instagram-explore-recommendations-system/)
- After a reset, personalization rebuilds from subsequent interactions (i.e. falls back to non-personalized popular content) — [Business Today (Nov 2024)](https://www.businesstoday.in/amp/technology/news/story/dont-like-what-you-see-on-your-instagram-new-reset-recommendations-feature-announced-heres-how-it-works-454347-2024-11-20)
- Wilson lower bound: `(p̂ + z²/2n − z·sqrt((p̂(1−p̂) + z²/4n)/n)) / (1 + z²/n)`, z=1.96 for 95%; SQL form `((pos + 1.9208)/(pos+neg) − 1.96*SQRT((pos*neg)/(pos+neg) + 0.9604)/(pos+neg)) / (1 + 3.8416/(pos+neg))`. It balances the positive proportion against the uncertainty of few observations — [Evan Miller, "How Not To Sort By Average Rating"](https://www.evanmiller.org/how-not-to-sort-by-average-rating.html)

### Inferences
- Wilson LB is pessimistic and therefore buries new posts — good for "best of all time" lists, bad for a feed that must explore. For the feed use a beta-prior posterior mean (optimistic-neutral) plus explicit exploration:
  `rate = (responders + α) / (reach + α + β)` with prior mean `α/(α+β)` = the lab's trailing 30-day median responder rate, prior strength `α+β = 20` impressions. Example: lab median 8% -> α=1.6, β=18.4. A post with 0 impressions scores exactly the lab median; 3 responders in 10 views -> (3+1.6)/(10+20)=15.3%.
- Thompson-sampling variant (cheap in JS): sample `rate ~ Beta(responders+α, reach−responders+β)` per request per candidate for the exploration slots only. Without a beta sampler dependency, approximate with normal: `mean + randn()·sqrt(mean(1−mean)/(reach+α+β+1))`.
- Exploration share ε: reserve ~15% of Showroom slots (every ~7th card, deterministic positions so layout is stable) for posts with reach < 30 impressions, drawn round-robin by lab. Decay ε to 10% once the site has >500 weekly active members. Each new work guaranteed ≥ 30 impressions in its first 48 h (test audience: active members whose top-3 labs include the post's lab; fall back to anyone).
- Promotion tiers (staged expansion): tier 0 = 30 impressions; promote to tier 1 (eligible in general Showroom ranking for all) if smoothed rate ≥ lab median; tier 2 ("Who's building"/feature slots) if ≥ 75th percentile after ≥ 100 impressions. Followers always see it in their followed stream regardless (connected reach is not gated).
- New users: initial interest vector = labs picked at onboarding (weight 1.0 each) + follows; until a viewer has ≥ 20 logged impressions, rank by global smoothed rate × freshness, diversified by lab.
- TNL's existing newCreatorLift (+1 for first 3 works) is a crude version of this; with impressions it can be replaced by the guaranteed test audience, which is fairer and resistant to "delete and repost to stay new".

### Gaps
- No primary Meta source found on bandit/exploration budgets specifically; ε, prior strength and tier sizes above are engineering suggestions.

## 5. Practical recipes for a small SQLite app (impressions, smoothing, interests, negative feedback, completion, freshness, anti-gaming)

### Takeaway
Everything Instagram does that matters at TNL's scale can be done with three new append-only tables (impressions, plays, negative feedback), one nightly rollup, and a scoring function that is a weighted sum of smoothed per-reach rates × freshness × personal affinity, followed by the existing greedy diversity pass.

### Cited Findings
- Per-reach normalization (likes per reach, sends per reach) and watch time are Instagram's stated top signals — [Social Media Today (2025)](https://www.socialmediatoday.com/news/instagram-shares-algorithm-insights-2025/738034/)
- Quickly scrolling past is a negative interest signal used in topic inference — [Search Engine Land](https://searchengineland.com/instagram-your-algorithm-465987)
- Value model subtracts predicted "see less"/negative actions — [Meta Engineering 2023](https://engineering.fb.com/2023/08/09/ml-applications/scaling-instagram-explore-recommendations-system/); [Meta AI 2019](https://ai.meta.com/blog/powered-by-ai-instagrams-explore-recommender-system/)
- Low-resolution/watermarked content is not recommended; aggregators (>10 reposts/30 days) removed from recommendations; originals replace duplicates — [Instagram 2021](https://about.instagram.com/blog/announcements/shedding-more-light-on-how-instagram-works); [TechCrunch 2024](https://techcrunch.com/2024/04/30/instagram-is-updating-its-ranking-systems-to-surface-more-content-from-smaller-original-creators)
- Engagement-only models chase short-term value; surveys correct for it — [Meta Engineering (Jan 2026)](https://engineering.fb.com/2026/01/14/ml-applications/adapting-the-facebook-reels-recsys-ai-model-based-on-user-feedback/)

### Inferences (concrete design; all constants are suggested defaults)

**Impression logging**
- Client: IntersectionObserver; count an impression when ≥50% of a card is visible for ≥1 s (dwell). Buffer post ids in memory; flush via `navigator.sendBeacon('/api/seen', JSON)` every 10 s, on `visibilitychange=hidden`, or at 20 ids. Also record dwell ms bucket (1–3 s, 3–10 s, >10 s) — a cheap watch-time proxy for images.
- Server: `CREATE TABLE impressions (post_id INT, user_id INT, day INT, surface TEXT, dwell_ms INT, PRIMARY KEY(post_id,user_id,day)) WITHOUT ROWID;` with `INSERT ... ON CONFLICT DO UPDATE SET dwell_ms = MAX(dwell_ms, excluded.dwell_ms)` — dedupes per viewer per day. Signed-out views keyed by a hashed session id, or ignored for ranking. Exclude the author's own views. Wrap each beacon in one transaction; cap 100 ids/beacon and rate-limit per user.
- Maintain `posts.reach` (distinct viewers, ever) via a nightly or hourly rollup `SELECT post_id, COUNT(DISTINCT user_id)` rather than per-insert counters (avoids write amplification). Retain raw rows 90 days, then aggregate into `post_reach_daily`.

**Listen/watch completion (tracks, video)**
- `plays(post_id, user_id, day, max_pct, ms_listened, PK(post_id,user_id,day))`; client posts progress at 25/50/75/95% milestones and on pause/unload. Signals: `qualified_play = ms_listened ≥ min(30 s, 0.5·duration)`; `completion = max_pct ≥ 0.9`; `skip = ms_listened < 5 s` (negative, like Instagram's scroll-past). Per-post: `completion_rate = (completions + α)/(plays + α+β)` with prior = lab median, strength 10. Replays by same user same day count once.

**Score (replacing the current numerator)**
```
eng(p)   = Σ_a w_a · (uniq_responders_a(p) weighted by standingWeight)   // existing machinery, per action
rate(p)  = (eng(p) + m·μ_lab) / (reach(p) + m)                           // beta/Bayesian smoothing, m = 20, μ_lab = lab median eng/reach
play(p)  = 1 + 0.5 · (completion_rate(p) − μ_completion_lab)/μ_completion_lab   (clamp 0.5..1.5; =1 for non-audio)
neg(p)   = (hides(p) + 2·reports(p) + 0.2·skips(p)) / (reach(p) + 50)
fresh(p) = 1 / (ageHours + 3)^1.35   // keep TNL's gravity; or exp(−ageHours/72) for a gentler half-life (~50 h)
base(p)  = (rate(p) · play(p) − 6·neg(p)) · fresh(p)
```
Personal multipliers: follow ×1.3 (existing); lab affinity `×(0.7 + 0.6·aff_viewer[lab])` with aff normalized 0..1; author affinity `×(1 + 0.3·min(1, viewer_responses_to_author_90d/5))`; already-seen-today ×0.3 (from impressions — stronger than the current responded-to damp); author hidden by viewer ×0 (filter); "not interested" in post ×0.

**Per-lab interest vectors**
- `aff_viewer[lab] = Σ events · w · 0.5^(age_days/30)` over the viewer's likes (1), comments (2), saves (2), reshares (3), qualified plays (1), completions (1.5), dwell>3 s (0.3), minus hides (−4), skips (−0.5); plus onboarding/explicit picks (+5, pinned). Normalize by max; floor at 0.05 so no lab disappears (keeps exploration). Store in `user_lab_affinity(user_id, lab_id, score, updated_at)`, recomputed incrementally or nightly. Expose and let users edit it ("Your Algorithm" analogue); a reset clears the table except explicit picks.
- Author similarity (ig2vec analogue) via co-engagement cosine nightly, used as an extra retrieval source: authors similar to the viewer's top-5 engaged authors.

**Negative feedback**
- `feedback(user_id, post_id, author_id, kind CHECK(kind IN ('not_interested','hide_author','report')), created_at)`. Effects: filter that post for the viewer; `hide_author` filters the author everywhere for 90 days; aggregate `neg(p)` above; authors whose posts accumulate hide-rate > 5% of reach over ≥ 200 impressions get ×0.7 in non-follower distribution (followers unaffected).

**Freshness**
- Keep gravity 1.35 for Showroom. For a "following" view use pure reverse-chronological (Instagram keeps chronological Following/Favorites). Candidate window can shrink from 120 to ~30 days once impressions exist, because evergreen items can come back via explicit "rediscovery" slots (1 in 20) drawn from the all-time Wilson-LB top list per lab.

**Anti-gaming**
- Already strong: author's own actions excluded, unique responders, capped standing, suspended users excluded. Add: (1) responders must have account age ≥ 24 h and ≥ 1 impression of the post before liking (like-without-impression = API scripting) — count but weight ×0.3; (2) reciprocity damping: if A and B have both responded to >50% of each other's last 20 works, weight each other's responses ×0.5 (like rings); (3) per-responder daily cap: a user's responses beyond 100/day weigh ×0.2; (4) burst detection: >10 responders in 10 min from accounts created < 7 days → hold the post at tier 0 for review; (5) aggregator rule port: accounts with >10 reshares of others' work in 30 days are excluded from recommendations of their reshares (TNL already excludes reshares from candidates); (6) duplicate-media hash keeps only the original; (7) never show counts that drive ranking during exploration (TNL already hides numbers in "Who's building").

**Performance on one server**
- Candidate set ≤ 600 per request; precompute `post_stats(post_id, reach, eng, completions, plays, hides, updated_at)` every 5 min with one aggregate query each, so the request path is one indexed SELECT plus JS math. Cache the global (non-personal) base score per post for 60 s; apply personal multipliers per request. Indexes: `impressions(user_id, day)`, `feedback(user_id)`, `plays(post_id)`.

**Evaluation**
- Track per-surface: responders per impression, completion rate, hide rate, distinct authors shown per session, share of impressions going to authors with < 5 works (small-creator reach). Run A/B by `user_id % 2` with a config flag in `RANK`, mirroring Meta's online-tuning approach in miniature.

### Gaps
- No Meta source gives impression dwell thresholds; the 50%/1 s rule is the IAB display viewability convention, not sourced here.
- No primary source found on Meta's anti-gaming specifics (like-ring detection etc.); the anti-gaming items are suggestions.
- Search ranking (Instagram search system card) was not researched in depth: I found no fetched primary source detailing its signals beyond it being one of the 22 system cards.
