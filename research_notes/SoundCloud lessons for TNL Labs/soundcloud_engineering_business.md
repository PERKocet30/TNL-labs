# SoundCloud engineering and business, compared with TNL Labs (as of 2026-10-08)

Scope: SoundCloud's engineering history, audio pipeline, frontend and business, set against TNL Labs' Music lab and back end. The TNL baseline is in `research_notes/TNL Labs code vs Instagram code/tnl_codebase_audit.md` and is not repeated here. TNL facts below come from read-only inspection of repo paths. Web facts carry inline links. Items marked **[historical]** describe an earlier era and are not current practice.

Method note: about 20 searches and fetches. Primary sources are SoundCloud's Backstage blog, philcalcado.com, SoundCloud/PromCon slides, Music Business Worldwide (MBW) and contemporary press. Several aggregator "statistics" sites conflicted with each other, so they are flagged and not relied on.

## 1. Engineering history: from the mothership to microservices, BFF, Prometheus and the 2017 layoffs

### Takeaway
SoundCloud began as one Rails monolith ("the mothership"). From 2012 it extracted services, first in Clojure and JRuby, then standardised on Scala + Finagle. It invented the Backends-for-Frontends (BFF) pattern around 2013 and built Prometheus (from 2012) to monitor its dynamically scheduled services. Its own published lessons stress three things:
- the **fixed cost per service**;
- **ownership** matters more than architecture;
- a half-finished strangler migration sat "fallow" for six years.

As of 2022–2026 it still runs a Scala/Finagle microservice estate, plus Python for at least some ads/ML services.

### Cited Findings
- **[historical] The mothership, c. 2011–12.** Calçado joined the back-end "App team" that owned a Rails monolith called "the mothership". The "Next" single-page web app consumed the monolith's public API. Web and App teams sat in separate buildings and talked through issue trackers and IRC. — [Calçado, How we ended up with microservices (2015)](https://philcalcado.com/2015/09/08/how_we_ended_up_with_microservices.html)
- **[historical] Cycle time.** Value-stream mapping found a feature took about 2 months to go live: "out of the 47 days spent in engineering, only 11 days are doing actual work". The rest was queueing. Pairing back-end with front-end engineers cut this, and the monolith got a daily release train. — [Calçado 2015](https://philcalcado.com/2015/09/08/how_we_ended_up_with_microservices.html)
- **[historical] First services.** The first services came in 2012 (the first monetisation project, built by two teams of two engineers). "Microservice" first appeared internally in 2013. Quote: "Our first services were built using Clojure and JRuby, eventually moving to Scala and Finagle." — [Calçado 2015](https://philcalcado.com/2015/09/08/how_we_ended_up_with_microservices.html)
- **[historical] Team structure.** The App pool was split into teams of 3–4 that owned modules and their outages. Messages (Jan 2014), Stats (Mar 2014) and the iOS app's features (Jun 2014) were extracted. The team that owned core objects (track metadata, social graph) stayed stuck firefighting.
- **[historical] Calçado's lessons.** "As organisations grow, they need to be mindful about the fixed cost of each service." And: "what's everybody's responsibility is nobody's responsibility." By Sept 2015 the monolith was no longer internet-facing but still alive. — [Calçado 2015](https://philcalcado.com/2015/09/08/how_we_ended_up_with_microservices.html)
- **[historical] Why BFF.** Dogfooding the public API caused three problems:
  - chatty clients: one screen, such as a profile, needed several HTTP calls, which hurt mobile users;
  - official-app-only features had to be gated through OAuth scopes;
  - changing shared endpoints had to avoid breaking third parties, which blocked A/B tests.

  Nick Fisher coined "BFF". Each BFF aggregated (e.g. `GET /user-profile/123.json`) and shaped responses: "The BFF was part of the application." About five BFFs ran in production at one point. — [Calçado, The BFF pattern (2015)](https://philcalcado.com/2015/09/18/the_back_end_for_front_end_pattern_bff.html)
- **BFF follow-on.** The same profile aggregation got duplicated across BFFs. Calçado called this "a bad smell indicating that we were missing an object in our domain model", and it was fixed with a `UserProfileService`. — [Calçado BFF](https://philcalcado.com/2015/09/18/the_back_end_for_front_end_pattern_bff.html)
- **BFF date.** SoundCloud's blog dates its BFF pioneering to 2013 — [SoundCloud Backstage: Service Architecture Part 1](https://developers.soundcloud.com/blog/service-architecture-1). The BFF also served as the strangler for the monolith's public API — [ThoughtWorks: BFF @ SoundCloud](https://www.thoughtworks.com/insights/blog/bff-soundcloud).
- **The public-API strangler, 2014–2022.**
  - In 2014 SoundCloud built a Scala/Finagle proxy that "somewhat loosely" strangled the Rails public API.
  - The proxy was then left largely unmaintained. Results: duplicated code paths, inconsistencies, security issues from deprecated Rails versions, and lost knowledge.
  - Work to finish started in Jan 2020, after "a six-year period in which modest progress was made".
  - The method: telemetry to find which endpoints were used; diffing ported GET responses against the proxy; rollout flags; deleting unused routes. Hyrum's Law bit them.
  - Lesson: "make sure to have a plan to complete the migration before the knowledge is lost."
  - In 2022 the public API codebase was deleted, and Scala is described as the default language. — [SoundCloud Backstage, The End of the Public API Strangler (14 Mar 2022)](https://developers.soundcloud.com/blog/end-of-the-strangler)
- **[historical] Prometheus.**
  - Research began Feb 2012; the oldest repo (a client library) is from March 2012; the public server repo appeared Nov 2012.
  - Started by Matt T. Proud; Julius Volz joined Oct 2012.
  - Motivation: OpenTSDB was too complex and RRD tools too weak.
  - Before Prometheus, SoundCloud ran "Bazooka", an in-house Heroku-style container PaaS. — [History of Prometheus at SoundCloud (slides)](https://www.slideshare.net/slideshow/the-history-of-prometheus-at-soundcloud/65464158)
- **[historical] Bazooka's limits.** Bazooka ran only 12-factor stateless apps, had limited isolation and no sidecars. Kubernetes was evaluated as its successor. — [Monitoring a Kubernetes-backed microservice architecture with Prometheus (slides)](https://www.slideshare.net/slideshow/monitoring-a-kubernetes-backed-microservice-architecture-with-prometheus/61457511)
- **[historical] Kubernetes trials, late 2015.** By late 2015 SoundCloud was experimenting with Kubernetes on GCP and on bare metal. — [Habr/Flant](https://habr.com/en/companies/flant/articles/339724)
- **[historical] Prometheus to CNCF.** Prometheus went to the CNCF in 2016 as its second project after Kubernetes. — [The Next Platform (2016)](https://www.nextplatform.com/cloud/2016/05/10/google-and-friends-add-prometheus-to-kubernetes-platform/1638818)
- **[historical] 2017 layoffs.**
  - July 2017: 173 jobs cut (about 40% of 420 staff).
  - San Francisco and London offices closed; operations consolidated into Berlin HQ and New York.
  - CEO Ljung had warned the company could "run out of cash" before end-2017.
  - The company had raised $70m in debt in March.
  - Earlier acquisition talks with Twitter and Spotify had failed. — [CNBC](https://www.cnbc.com/2017/07/06/soundcloud-cuts-40-percent-of-staff.html); [FACT](https://factmag.com/2017/07/06/soundcloud-lays-off-40-percent-of-staff); [Mixmag](https://mixmag.net/read/soundcloud-lays-off-40-percent-of-staff-and-ditches-plans-for-acquisition-news)
- **2022 blog activity.** The 2022 Backstage posts include:
  - "SoundCloud Echo" (a developer portal built on Spotify's Backstage);
  - "Learning Scala at SoundCloud";
  - "What is new with Periskop in 2022" (Periskop is SoundCloud's exception-aggregation tool);
  - the OAuth 2.1 migration (Apr 2024) and access-token changes (Dec 2024). — [Backstage blog index](https://developers.soundcloud.com/blog/category/engineering)
- **Current stack signal (Aug 2026).**
  - The ad-decisioning service is **Python** with structlog, synchronous stdout logging shipped to a collector, per-pod deployments and labelled metric counters.
  - A one-line guard fix stopped a warning log plus 4 metric increments on 100% of fixed-policy traffic.
  - Results: p99 fell from ~48ms to ~18ms; CPU fell from 8–10 to 2–4.
  - Quote: "Per-request work on a hot path shows up mainly in the tail." — [Backstage, One line of Python, and a 3× drop in p99 (11 Aug 2026)](https://developers.soundcloud.com/blog/one-line-of-python-and-a-3x-drop-in-p99)

### Inferences
- I found no SoundCloud source saying "we went too far" in so many words. The documented regrets are narrower:
  - the per-service fixed cost (Calçado);
  - BFF duplication that pointed to a missing domain object;
  - a strangler left half-done for six years.

  The "too many microservices" story is a fair reading of those posts, not a quote.
- A company with about 250 engineers after 2017 inherited a JVM microservice estate built by a much larger org. The 2022 strangler post is partly about paying down that inheritance. This is my inference; I found no source linking the layoffs to architecture.
- Pods plus labelled counters on dashboards strongly suggest Prometheus on Kubernetes today, but the 2026 post does not name either.

### Gaps
- No primary source gives a completion date for the Bazooka→Kubernetes migration, or the current total number of services.
- No source quantifies the 2017 layoffs' impact on engineering specifically.
- The 2023–2026 stack beyond Scala/Finagle and Python is undocumented publicly: no post on languages, cloud vendor or data stores was found.

## 2. Audio pipeline: ingest, transcodes, HLS, waveforms, CDN, fingerprinting, play counting

### Takeaway
As of the end of 2025, SoundCloud's public API retired progressive MP3, HLS MP3 and HLS Opus in favour of **AAC over HLS**, at 160 kbps (preferred) and 96 kbps (fallback). In June 2026 it switched its AAC encoder to Fraunhofer **libfdk_aac**, the first encoder change in over a decade, with a ~17 kHz low-pass at 256 kbps.

Waveforms are precomputed per track, served from `wave.sndcdn.com` as PNG or JSON (`width`, `height`, `samples[]`), and drawn by clients.

Fraud detection and Content ID internals are not publicly documented. Fan-Powered Royalties (FPR) is itself partly a fraud defence, because a bot's plays only reallocate that bot account's own revenue.

### Cited Findings
- **AAC HLS transition (15 Sep 2025, "Deadline Extended").**
  - New: `hls_aac_160_url` ("standard quality and the preferred format") and `hls_aac_96_url` (fallback, where available).
  - Removed on **31 Dec 2025**: `http_mp3_128_url`, `hls_mp3_128_url`, `hls_opus_64_url`. `preview_mp3_128_url` stays.
  - Stated reason: "more consistent playback, and better support across devices." — [Backstage, Moving to Modern Streaming: AAC HLS (15 Sep 2025)](https://developers.soundcloud.com/blog/api-streaming-urls)
- **Rollout lag.** A developer reported in a GitHub issue that the API still returned the old format for recent tracks. This is a user report, not official. — [soundcloud/api#466](https://github.com/soundcloud/api/issues/466)
- **[historical] Opus 64 (2018).** SoundCloud was reported to stream Opus at 64 kbps instead of MP3 128 and described it as testing. It also said transcoding setups vary by what was uploaded. — [Slashdot/Billboard 2018](https://tech.slashdot.org/story/18/01/05/2140239/soundcloud-refutes-decreasing-audio-quality-cites-standard-testing); [MusicTech](https://musictech.com/news/industry/soundcloud-quality-audio-codec-nasko-critcism)
- **Encoder change (18 Jun 2026, Joe Reid).**
  - Uploads, including lossless WAV/FLAC, are compressed to AAC; the new encoder is libfdk_aac.
  - At 256 kbps it applies a gentle roll-off around **17 kHz**, which shows as a shelf in spectrograms. The filter's benefit grows at lower bitrates.
  - Error by frequency band was lower in the mid bands with the filter on.
  - The post includes a blind ABX-style listening test. — [Backstage, Less Is More: Why Audio on SoundCloud Looks Different (18 Jun 2026)](https://developers.soundcloud.com/blog/less-is-more-why-soundcloud-low-passes-its-aac-transcodings)
  - The 256 kbps example implies a high-quality AAC tier, which matches Go+'s "high quality" audio. I found no fetched page that explicitly says "Go+ = AAC 256" in 2026; see Gaps.
- **Waveforms.**
  - Each track's `waveform_url` points at `wave.sndcdn.com`. Swapping `.png` for `.json` returns `{width, height, samples[]}`. — [freeCodeCamp: realtime SoundCloud waveforms](https://www.freecodecamp.org/news/how-to-make-realtime-soundcloud-waveforms-in-react-native-4df0f4c6b3cc/)
  - One example has a fixed height of 100, with sample count tied to track length. — [ExpertBeacon guide](https://expertbeacon.com/building-soundcloud-style-waveform-visualizers-in-react-native-the-complete-guide/)
  - A 2026 track's `waveform_url` ends in `.json`. — [ScrapeCreators tutorial](https://scrapecreators.com/tutorials/how-to-scrape-soundcloud-track-with-python)

  These are third-party observations of public API output. SoundCloud has not documented how the waveforms are computed.
- **FPR mechanics.**
  - FPR replaced the pooled pro-rata model on 1 Apr 2021.
  - Payouts depend on a fan's listening time for an artist relative to that fan's total monthly listening, the ads that fan saw, and the fan's subscription tier (Go / Go+ / DJ).
  - The help page has a section "How do fan-powered royalties address fraud?", but its text was not retrievable (403 on fetch). — [SoundCloud Help: Fan-Powered Royalties](https://help.soundcloud.com/hc/articles/1260801306810) (via search snippet)
- **Content ID.** I found no source confirming an Audible Magic contract with SoundCloud. Audible Magic's documented partners are distributors (Orchard, CD Baby, DistroKid). — [Audible Magic](https://audiblemagic.com/2019/06/18)
- **Fraud vendors.** Industry anti-fraud vendors such as Beatdapp are used by peers (e.g. Audiomack). There is no confirmed SoundCloud deal. — [Platform & Stream](https://platformstream.substack.com/p/audiomack-taps-beatdapp-to-tackle)

### Inferences
- SoundCloud's direction is fewer formats served the same way: AAC everywhere, HLS everywhere. HLS gives adaptive bitrate, CDN-friendly segments and one code path across web, iOS and Android.
- Under FPR, fraud is mostly self-limiting: a bot's plays only reallocate that bot's own subscription or ad revenue. That is a design-level defence, not detection.
- TNL's rep economy has the same shape. It is driven by others' actions, so per-actor caps are the analogue.

### Gaps
- No public detail was found on:
  - the ingest/transcode orchestration (queues, workers);
  - loudness normalisation (whether SoundCloud applies a LUFS target);
  - the CDN vendor (`sndcdn.com` is SoundCloud's CDN hostname; the underlying provider was not confirmed);
  - the minimum-seconds rule for a counted play;
  - Content ID vendor or in-house fingerprinting.
- The Go+ 256 kbps AAC figure comes from training knowledge and was not verified by a fetched page in this session.

## 3. Frontend: web app and the persistent player

### Takeaway
**[historical]** SoundCloud's 2012 "Next" web app was a Backbone.js + Handlebars single-page app, built so playback continues while you navigate. It used CommonJS modules concatenated into packages, and a per-id model instance store shared across views. I found no primary source on the current (2023–2026) web stack.

### Cited Findings
- **[historical] Next (Jun 2012, Nick Fisher).**
  - Continuous playback "allows users to start listening to a sound and continue exploring without ever breaking the experience". This is why it is a single-page app, with rendering and navigation in the browser and data from the public API.
  - Backbone + precompiled Handlebars; CommonJS modules converted to AMD; "concatenated into several packages" loaded with AlmondJS.
  - Each model constructor returns the same instance per id (an instance store), purged on a timer. — [Backstage, Building The Next SoundCloud (14 Jun 2012)](https://developers.soundcloud.com/blog/building-the-next-soundcloud)
- **[historical] Mobile web.** The mobile site was also a Backbone SPA acting as a direct API client. — [Backstage, Building the SoundCloud mobile site using Backbone.js](https://developers.soundcloud.com/blog//building-the-soundcloud-mobile-site-using-backbone.js)
- **TNL for comparison.**
  - TNL already uses the same pattern: one module-level `AUDIO=new Audio()` singleton (`src/app-13-player.js:16-25`) that lives outside re-rendered DOM, with a `PLAYQ` queue and an `ended` handler that advances the queue.
  - Voice notes use a separate `VNAUDIO` (`src/app-10-chat-1-kit.js:109`).
  - The voice-note waveform is "decoration seeded from the file name" (`src/app-10-chat-1-kit.js:90`), not real audio data.

### Inferences
- TNL's concatenated parts plus a singleton player are structurally close to SoundCloud's 2012 Next design, which also concatenated modules and kept a global player. There is nothing to adopt architecturally here.
- The gaps are in data: real waveform peaks, and an adaptive or low-bitrate stream.

### Gaps
- The current SoundCloud web framework is not confirmed by a primary source (React is widely assumed, but this is unverified).
- The mobile app stacks (Kotlin/Swift) are not confirmed in this session.

## 4. Business: revenue, profitability, subscriptions, distribution, FPR, investors, sale talk, scale

### Takeaway
SoundCloud is private, Berlin-registered (SoundCloud GmbH) and reports in euros.
- **2023 was its first EBITDA-positive year:** guidance of €288m revenue (+7.5%) and €2m EBITDA, against −€29m in 2022.
- No audited 2024 or 2025 figures were found.
- Owners Raine and Temasek explored a sale in Jan 2024 at a reported valuation above $1B. No completed sale has been reported through Oct 2026.

Strategy since late 2025 is creator monetisation beyond streaming:
- distribution became 0% revenue share (end Nov 2025);
- zero-commission fan support, storefronts, merch and vinyl;
- direct track sales in beta (2026);
- the Nina Protocol assets were acquired (July 2026).

### Cited Findings
- **2023 guidance, as reported by MBW.**
  - Revenue €288m (+7.5% YoY); EBITDA +€2m vs −€29m in 2022.
  - Gross profit €104m (from €94m), a gross margin of 36.1%.
  - Fan subscription revenue (subscriptions plus ads) +30% YoY; creator business +4%.
  - The company cut about 8% of staff (about 40 people).
  - Caveat: these are company-chosen disclosures, not full accounts. — [Music Ally, 14 Dec 2023](https://musically.com/2023/12/14/soundcloud-says-it-will-be-profitable-in-latest-financial-year/); [MBW, Spotify is chasing annual profitability. SoundCloud's already there.](https://www.musicbusinessworldwide.com/spotify-chasing-annual-profitability-soundclouds-already-there/); [MBW data page 2020–2023 (EUR, chart only)](https://www.musicbusinessworldwide.com/data/soundcloud-annual-revenues-and-profitability/)
- **EBITDA caveat.** Positive EBITDA ≠ net profit; capitalised development salaries may be excluded. This is commentary. — [Torstensson](https://torstensson.com/2023/12/14/soundcloud-reaches-ebitda-profitability-in-2023/)
- **2024 app-store revenue (estimate).** Appfigures estimated about $77M net app-store revenue through about Sept 2024, vs $72M for all of 2023. This covers app stores only. — [Appfigures](https://appfigures.com/resources/insights/20240927?f=5)
- **Unverified revenue figures.** Aggregator figures conflict: $312m for 2024 vs about $485m for 2025 (Chartlex citing SQ Magazine). Treat both as unverified. — [Chartlex](https://www.chartlex.com/blog/streaming/is-soundcloud-worth-it-for-artists-2026); [Prioridata](https://prioridata.com/data/soundcloud-revenue/)
- **Sale exploration (Jan 2024).**
  - Sky News (7 Jan 2024) reported that Raine Group and Temasek were interviewing banks for an auction valuing SoundCloud above $1B. — [EDM.com](https://edm.com/news/soundcloud-on-sale-1-billion/); [Mixmag](https://mixmag.net/read/soundcloud-reportedly-going-on-sale-for-over-1billion-news)
  - **[historical]** The 2017 rescue put the valuation at about $300m (Raine and Temasek majority). — [MBW](https://www.musicbusinessworldwide.com/soundcloud-valued-300m-books-uncertain-future-major-label-rescued/)
  - **SiriusXM:** in training knowledge, SiriusXM/Pandora invested $75m in 2020. It was not re-verified this session.
- **Creator overhaul (MBW, 18 Nov 2025, CEO Eliah Seton).**
  - The "All-in-One Artist Subscription" was announced.
  - From end Nov 2025, the 20% distribution revenue share is removed: artists keep 100% of royalties from Spotify, Apple Music, YouTube Music, TikTok and 50+ others. This applies to existing Artist and Artist Pro subscribers with no price increase.
  - Artists keep 100% of on-platform earnings.
  - Zero-commission fan support, storefronts, merch, and on-demand vinyl (summer 2025).
  - Scale: 400M+ tracks; 40M+ artists; 193 countries.
  - UGC outnumbers label content about 4:1; about 85% of listening time is on UGC; >50% of listening is on new music; >50% of fans are "superfans".
  - MAU is not published, only "record" growth claimed.
  - Seton quotes: "Streaming is not enough for artists"; "Distribution has a commoditized nature to it"; "The marginal cost is zero." — [MBW, 18 Nov 2025](https://www.musicbusinessworldwide.com/as-soundcloud-overhauls-its-creator-subscription-model-ceo-eliah-seton-says-the-platform-is-building-musics-next-major-revenue-format1/)
- **Creator pricing.** Artist Pro is $8.25/mo ($99/yr). Artist is $3.25/mo ($39/yr) and can monetise up to 2 tracks per month. — [Chartlex](https://www.chartlex.com/blog/streaming/is-soundcloud-worth-it-for-artists-2026) (secondary); [SoundCloud: How to make money on SoundCloud](https://soundcloud.com/topic/category/how-to-make-money-on-soundcloud)
- **FPR outcome.** A MIDiA study cited by SoundCloud found more than 56% of FPR artists earn more than under pro-rata. Typical estimated per-stream rate: $0.0025–0.004 (secondary). — [Chartlex](https://www.chartlex.com/blog/streaming/is-soundcloud-worth-it-for-artists-2026)
- **Direct sales and Nina Protocol (2026).**
  - Direct track sales from Artist Pro profiles, zero commission, in beta (Sept 2026). — [WeRaveYou, Sept 2026](https://weraveyou.com/2026/09/soundcloud-direct-music-purchases-zero-commission/); [Mixdown](https://mixdownmag.com.au/news/soundcloud-opens-direct-music-sales-with-zero-commission/)
  - Acquired Nina Protocol assets, July 2026. — [Making A Scene](https://www.makingascene.org/soundcloud-put-the-sale-next-to-discovery-that-could-change-the-indie-music-business/) (secondary)
- **Catalogue size.** 440M tracks as of Oct 2025 per Seton (secondary). The user figure of about 180M registered / about 76M monthly listeners is aggregator-only and unverified. — [Chartlex](https://www.chartlex.com/blog/streaming/is-soundcloud-worth-it-for-artists-2026)

### Inferences
- SoundCloud's 2025–26 playbook converges on TNL's own model:
  - monetise creators via subscription, not take-rate;
  - zero commission on fan-to-artist money;
  - storefronts and merch next to discovery.

  TNL charges commission by level (`FEE_BY_LEVEL` in `src/db.js`). SoundCloud now competes at 0% on sales and support. That is a pricing-pressure signal for TNL's market.
- A gross margin of about 36% shows streaming royalty costs dominate. TNL pays no royalties on its own content, so its unit economics are not comparable.

### Gaps
- No audited 2024 or 2025 revenue or EBITDA was found. Neither MBW nor a filing was retrievable; the German Bundesanzeiger was not checked.
- The current ownership split and the outcome of the 2024 sale process are unknown.
- No official MAU figure.
- The 140M+ users claim is unverified.

## 5. SoundCloud vs TNL comparison and concrete practices for TNL's Music lab

### Takeaway
TNL already matches SoundCloud on several points:
- immutable uploads cached at the edge;
- `express.static` honours HTTP Range by default, so seeking already works;
- a global singleton player that survives navigation;
- Prometheus-like counters could be added for free.

The real gaps are in Music-lab data quality:
- no waveform peaks: the voice-note waveform is fake;
- duration is trusted from the client;
- play counts are naive: +1 per POST, up to 300/hr per user, no dedupe, self-plays count;
- one format: whatever was uploaded, or AAC 128 for extracted audio;
- no loudness normalisation.

All of these can be fixed with the ffmpeg TNL already ships.

### Cited Findings (TNL side, from repo)
- **Tracks schema.** `tracks` stores `url`, `duration_ms` (client-supplied), `bytes` and `plays` (`src/db.js:306+`; `src/server-08-trust-library.js` POST `/api/tracks`).
- **Play endpoint.** `POST /api/tracks/:id/play`:
  - requires auth;
  - is rate-limited to 300/hour/user;
  - runs `UPDATE tracks SET plays = plays + 1` with no dedupe and no minimum-listen threshold;
  - does not exclude the owner (`src/server-08-trust-library.js` around line 392).
- **Audio extraction.** `/api/tracks/extract` runs ffmpeg `-c:a aac -b:a 128k -movflags +faststart`, one job at a time behind an `EXTRACTING` lock with a 120s timeout. Duration is taken from the client, because "ffprobe is a separate package" (same file, lines 270–330).
- **Static uploads.** `/uploads` is served with `express.static` using `maxAge 365d, immutable` and CORS `*`. Filenames are hashed, so URLs are immutable and Cloudflare-cacheable (`src/server-01-boot.js:188-199`).
- **ffmpeg already in use.** `ffmpeg-static` is already resolved at boot (`src/server-01-boot.js:12-20`) and used for profile and event cards.

### Comparison table

| Dimension | SoundCloud (2025–26) | TNL Labs (Oct 2026) |
|---|---|---|
| Architecture | Scala/Finagle microservices; per-client BFFs since ~2013; Python for ads/ML ([strangler](https://developers.soundcloud.com/blog/end-of-the-strangler), [p99 post](https://developers.soundcloud.com/blog/one-line-of-python-and-a-3x-drop-in-p99)) | One Express process from concatenated numbered parts |
| Data | Not public | One SQLite file on the Railway volume |
| Ingest | WAV/FLAC/lossy uploads → AAC via libfdk_aac ([Jun 2026](https://developers.soundcloud.com/blog/less-is-more-why-soundcloud-low-passes-its-aac-transcodings)) | Stores the uploaded file as-is; extracting from video → AAC 128k |
| Delivery | AAC HLS 160/96 kbps; progressive MP3/Opus retired 31 Dec 2025 ([Sep 2025](https://developers.soundcloud.com/blog/api-streaming-urls)) | Progressive file over HTTP Range from `/uploads` behind Cloudflare |
| Waveform | Precomputed per track; PNG/JSON on wave.sndcdn.com ([fCC](https://www.freecodecamp.org/news/how-to-make-realtime-soundcloud-waveforms-in-react-native-4df0f4c6b3cc/)) | None for tracks; voice notes use a seeded fake |
| Play count / payout | FPR: per-listener allocation, which limits fraud by design ([help](https://help.soundcloud.com/hc/articles/1260801306810)) | +1 per POST, 300/hr cap, no dedupe |
| Player | [historical] SPA with continuous playback ([2012](https://developers.soundcloud.com/blog/building-the-next-soundcloud)) | Global `Audio` singleton + queue (`app-13-player.js`) |
| Observability | Created Prometheus; labelled counters per pod ([slides](https://www.slideshare.net/slideshow/the-history-of-prometheus-at-soundcloud/65464158)) | Sentry via raw fetch; logs; after-deploy smoke check |
| Deploy | Many services and teams; Kubernetes trials from 2015 ([Habr](https://habr.com/en/companies/flant/articles/339724)) | Push-to-main → Railway in ~80s; CI tests + Playwright |
| Monetisation | Fan subs (Go/Go+), ads, Artist/Artist Pro subs; 0% distribution share and 0% on fan support/sales from late 2025 ([MBW](https://www.musicbusinessworldwide.com/as-soundcloud-overhauls-its-creator-subscription-model-ceo-eliah-seton-says-the-platform-is-building-musics-next-major-revenue-format1/)) | Commission on market sales by rep level (`FEE_BY_LEVEL`); Stripe Connect |

### Recommended practices for TNL (tagged)
1. **Server-side waveform peaks — [no new dep].**
   - On track create, run ffmpeg to decode to mono 8 kHz s16le on stdout: `ffmpeg -i in -ac 1 -ar 8000 -f s16le -`.
   - Bucket into about 200 peaks (max abs per bucket) and normalise to 0–255.
   - Store as a TEXT/BLOB column (`tracks.peaks`), shipped in the `shapeTrack` JSON at about 200 bytes.
   - This mirrors SoundCloud's precomputed `samples[]` ([fCC](https://www.freecodecamp.org/news/how-to-make-realtime-soundcloud-waveforms-in-react-native-4df0f4c6b3cc/)).
   - Reuse the same queue/lock as extraction. Backfill existing tracks lazily.
   - Use the same output to replace the fake voice-note waveform.
2. **Server-measured duration — [no new dep].** Parse `Duration:` from `ffmpeg -i` stderr, or count decoded samples in step 1. Stop trusting the client-supplied `durationMs`.
3. **Loudness analysis — [no new dep].**
   - Run `-af loudnorm=print_format=json` (or `ebur128`) in the same pass and store integrated LUFS.
   - Apply per-track gain client-side (`audio.volume` or a WebAudio GainNode), not by re-encoding. Keep originals untouched.
   - Unverified: whether SoundCloud normalises at all; Spotify/Apple use about −14/−16 LUFS. Gap: no SoundCloud source found.
4. **One normalised streaming rendition — [no new dep, CPU/disk cost].**
   - Transcode every upload once to AAC-LC (`-c:a aac -b:a 160k -movflags +faststart`), matching SoundCloud's 160k default ([Sep 2025](https://developers.soundcloud.com/blog/api-streaming-urls)).
   - Optionally add a 96k fallback for weak mobile networks.
   - Skip Opus: SoundCloud dropped it from its API, and Safari's Opus support is the historical reason.
   - libfdk_aac is not in ffmpeg-static (it has licensing constraints), so use the native `aac` encoder. Consider `-cutoff 17000` at ≥160k, following SoundCloud's low-pass finding ([Jun 2026](https://developers.soundcloud.com/blog/less-is-more-why-soundcloud-low-passes-its-aac-transcodings)).
   - Keep the original for downloads and market sales.
5. **Range and caching — [no new dep], mostly already done.** `express.static` serves `Accept-Ranges` and 206 by default, and hashed immutable URLs cache at Cloudflare. Add an e2e step that seeks mid-track and asserts a 206 response, so this never regresses. HLS is **not** worth it at TNL scale: progressive + Range + CDN covers seeking.
6. **Play-count rules — [no new dep].** Replace +1-per-POST with a `track_plays` table holding (track_id, user_id, day, ms_listened). A play counts once per user per track per window (e.g. 24h). Rules:
   - require ≥30s or ≥50% listened (the client reports at a threshold; the server checks elapsed time since a `start` call);
   - exclude the owner;
   - cap per-account daily counted plays;
   - flag accounts with abnormal plays/day or zero other activity.

   If plays ever feed rep or payouts, model it on FPR: allocate each listener's weight across what they played, so a bot only moves its own weight ([FPR help](https://help.soundcloud.com/hc/articles/1260801306810)). This also keeps the "rep only from others" rule honest.
7. **BFF-style shaping inside the monolith — [no new dep].** Keep one endpoint per screen that returns everything that screen needs (e.g. `/api/music/home` with tracks, peaks, artists and plays in one response), instead of chatty calls. This is the BFF benefit (aggregation and shaping for the client; [Calçado](https://philcalcado.com/2015/09/18/the_back_end_for_front_end_pattern_bff.html)) without a separate service. When two screens duplicate the same shaping, extract a function (the `UserProfileService` lesson), not a service.
8. **Prometheus-style metrics — [no new dep] / [new service] to scrape.** Expose a plain-text `/metrics`, admin-gated or token-gated, with counters: transcode jobs, queue depth, ffmpeg failures, plays counted vs rejected, p99 per route. A scraper (Grafana Cloud or Prometheus) would be a [new service], so ask first. SoundCloud's 2026 lesson is that per-request logging on hot paths costs tail latency ([p99 post](https://developers.soundcloud.com/blog/one-line-of-python-and-a-3x-drop-in-p99)); keep play-endpoint logging off the hot path.
9. **Background job queue — [no new dep].** Replace the boolean `EXTRACTING` lock with a SQLite `jobs` table (status, attempts) drained by one in-process worker. Peaks, loudness and transcodes then survive restarts and do not block requests.
10. **Content ID / fingerprinting — [new service].** Audible Magic or similar is paid and contract-based. At TNL scale, rely on reports and takedowns. A Chromaprint/AcoustID duplicate-upload check would need a binary not in ffmpeg-static, so it is [new dep].

### The cautionary microservices lesson for a tiny team
SoundCloud split its monolith to unblock many teams. Even so:
- it paid a fixed cost per service (Calçado);
- it needed a custom PaaS (Bazooka), then Kubernetes, then a new monitoring system (Prometheus) just to see the system;
- it left a strangler half-finished for six years, with security debt ([2022](https://developers.soundcloud.com/blog/end-of-the-strangler)).

Those costs were justified by organisational scale, roughly 400+ staff before 2017. TNL has one deployable and a handful of contributors, so the right move is the opposite:
- keep the monolith;
- get BFF benefits through per-screen endpoints;
- get isolation through an in-process job queue, not a transcoding service;
- only split out a worker if ffmpeg CPU measurably hurts request latency, and even then as a second Railway process reading the same jobs table.

### Inferences
- Recommendations 1–3 and 6 are the highest value per line of code: they make the Music lab look and count like SoundCloud using only the existing ffmpeg.
- Each new ffmpeg pass adds CPU on the same container that serves requests, which is why the queue (item 9) comes first.

### Gaps
- The exact ffmpeg-static build's encoder list (native `aac` presence; libfdk absence) was not verified in this session. Check with `ffmpeg -encoders` before relying on it.
- How the TNL client currently calls `trackPlay` (at start vs after N seconds) was not traced. See `src/app-07-theme-labs-api.js:214` and its callers.
