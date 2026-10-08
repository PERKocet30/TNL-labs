# SoundCloud's product for artists and listeners (as of Oct 2026), and what TNL Labs' Music lab should take from it

Scope note: these notes come from web research done on 2026-10-08 and a read-only look at the TNL repo. Items marked **[historical]** describe past states. Some sources are secondary (press write-ups of SoundCloud announcements) and are flagged as such. Search-result summaries were not always confirmed with a page fetch; where a claim rests only on a search-result summary, it is marked "(search summary)".

**TNL baseline (repo, read-only, 2026-10-08):**
- `tracks` table: `id, user_id, title, url, artwork_url, description, duration_ms, bytes, plays, created_at`. There are no likes, comments, reposts, waveform, privacy or download columns (`src/db.js:306-319`).
- `POST /api/tracks/:id/play` adds 1 to `plays`. It does not deduplicate, does not exclude the owner, and does not measure listen-through. The client calls it as soon as the play button is pressed; post autoplay passes `silent` and is not counted (`src/app-13-player.js` `playTrack`; `src/server-08-trust-library.js:393-398`).
- Audio extraction already runs ffmpeg (`ffmpeg-static`), producing `-c:a aac -b:a 128k -movflags +faststart` behind a one-job lock (`src/server-08-trust-library.js:279-330`). Uploaded tracks are stored as uploaded, with no transcode step visible on that route (`POST /api/tracks` takes a `/uploads/` URL as-is).
- The player has one `<audio>` element, a queue (the list you pressed play from), prev/next, tap-to-seek, Media Session (lock-screen) controls, and lab-only playback (`src/app-13-player.js` header, v2.1, 2026-09-29).
- Rep kinds (`src/db.js:726-735`): `like_received 6, share_received 3, collab_accepted 20, sale_made 15, delivery_confirmed 10, feature 40, sound_used 4, pinned 3`. A post can carry a track via `posts.audio_track_id`. The earlier TikTok notes already proposed a sound page plus "Use this sound" with `sound_used` +4 (see `research_notes/TikTok lessons for TNL Labs/tiktok_features.md`). This file does not repeat that.

---

## 1. Core product: waveform player and timed comments, reposts, likes/playlists, sets, private links, downloads/buy, stats, embeds, upload limits and audio quality

### Takeaway
The core of SoundCloud's identity is still the waveform with timed comments. It began as a private feedback tool between collaborators and became a crowd "campfire". Around it sit two discovery mechanics: reposts, which push a track into every follower's stream, and secret links, for private sharing. Everything else (stats, sets, downloads, quality tiers) is standard. For a creatives-feedback app like TNL, timed comments are the feature most worth copying.

### Cited Findings
**Waveform and timed comments (origin and why they worked)**
- The founders, Alexander Ljung (sound design for TV and film) and Eric Wahlforss (a musician), first built the waveform to share music privately and get feedback — [VentureBeat](https://venturebeat.com/business/why-sound-will-be-bigger-than-video-online) (search summary).
- The two met in 2006 at KTH in Stockholm. They swapped the iTunes-style progress bar for a waveform that let people comment on specific moments. Ljung called the audio a "social object, almost like a campfire that people gather around" — [The Ringer, Jan 2017](https://www.theringer.com/2017/01/04/tech/soundcloud-comments-are-the-only-good-comments-4bc787ee2092).
- **Why they work:** comments appear in sync with the moment that prompted them, so they cluster on drops, choruses and intros. Each one flashes and fades, so short, emotive comments ("damn", "yesss") are easy to absorb and long or spammy ones easy to ignore. The thread ends when the song ends. The Ringer calls it "probably the only collective listening experience that scales." The downside is spam: follower begging, porn bots, trolling — [The Ringer](https://www.theringer.com/2017/01/04/tech/soundcloud-comments-are-the-only-good-comments-4bc787ee2092).
- **[historical, 2008]** In a July 2008 blog comment, Wahlforss said timed comments worked "not only for discussing details of a track, but also for highlighting interesting music on the site", and that almost 40% of content was shared privately — via [Signal v. Noise post 1143](https://signalvnoise.com/posts/1143-soundcloud-expands-the-audio-player) (search summary; I did not fetch the comment itself).
- **[historical, 2010]** A timed comment shown along a track's timeline, with community observations — [Disquiet, Nov 2010](https://disquiet.com/2010/11/28/soundcloud-comments-warchalking-ui-community/) (search summary).
- **2024 comment upgrades:** "Like comments, share to follow" (March 2024), and "Tips to grow your community with Comments" (30 May 2024) — [SoundCloud Newsroom index](https://soundcloud.com/company/newsroom). A "Comments hub" is an Artist Pro-only feature — [SoundCloud pricing](https://soundcloud.com/getstarted/pricing).

**Reposts**
- A repost pushes a track, or a whole playlist, onto the reposter's profile and into every follower's stream — [Hypebot](https://www.hypebot.com/?p=8024) (search summary).
- **[historical]** Fortune (2017) said a design flaw in reposting "opened the floodgates for promoters to manipulate listeners' feeds", and SoundCloud did not try to fix it until 2015 — [Fortune, Jul 2017](https://fortune.com/2017/07/23/soundcloud-music-streaming-troubles). Repost chains (mutual repost trades), accounts that exist only to repost, and paid repost services grew up around it. Writers complained that reposts crowd original uploads out of the stream — [Hypebot](https://www.hypebot.com/?p=8024); [Medium, "Why SoundCloud sucks"](https://medium.com/@deadsunproject/why-soundcloud-sucks-291d4b118d8d) (opinion; search summaries).
- Reposts can carry a caption (reported as up to 100 characters), and the desktop site later added "context" on reposts — [Magnetic Mag, Mar 2024](https://magneticmag.com/2024/03/soundclouds-second-wind/) (sponsored by a repost-trading service; treat with caution; search summary).

**Private and secret links**
- A private track gets a secret link. Resetting it creates a new URL, permanently kills the old one, and cannot be undone. On mobile: Library → Your Uploads → … → Copy link — [SoundCloud Help: Resetting a secret link](https://help.soundcloud.com/hc/en-us/articles/115003449467-Resetting-a-secret-link); private tracks and playlists can also be shared to specific users inside SoundCloud — [Help: Sharing a private track](https://help.soundcloud.com/hc/en-us/articles/115003450427) (search summaries).
- **Follower Exclusive Releases (30–31 Mar 2026):** Artist Pro users can gate a track behind a follow, temporarily or permanently, for early demos, surprise drops or previews. The launch example was Chris Stussy's single, released to followers before his album. SoundCloud says it hosts more than 500 million tracks — [Music Business Worldwide](https://www.musicbusinessworldwide.com/soundcloud-launches-superfan-feature-that-lets-artists-release-music-exclusively-to-followers-before-wider-release/); [Newsroom](https://soundcloud.com/company/newsroom).

**Downloads and buying**
- When the uploader enables downloads, listeners get the original uploaded file with no transcoding — [Help: Upload requirements](https://help.soundcloud.com/hc/en-us/articles/46020588217499-Uploading-Requirements) (search summary).
- **Direct Music Purchases (beta, 26 Aug 2026):** about 200 US Artist Pro creators who have Fan Support switched on can sell tracks from their profile. They set the price and choose MP3 or WAV. Checkout is native, and SoundCloud takes zero commission, though payment-processing fees and taxes still come off. Rationale given: more than 250,000 artists had linked over 2.4 million tracks to outside stores, and SoundCloud was sending more than 500,000 users a year off-platform to buy music. Reported timing for a wider rollout varies: "November 2026" in one source, "later this fall" in another — [Music Business Worldwide](https://www.musicbusinessworldwide.com/soundcloud-starts-letting-artists-sell-downloads-direct-from-their-profiles-and-says-its-taking-zero-commission/); [Music Week](https://www.musicweek.com/digital/read/soundcloud-launches-direct-to-fan-sales-with-zero-commission/094833); [NotNoise](https://notnoise.co/blog/soundcloud-direct-music-purchases) (search summaries).

**Upload limits and audio quality**
- Current limits: 4 GB per uncompressed file and at most 24 hours per upload. Older help pages said 5 GB and 6h45m, which conflicts — [Help: Uploading Requirements](https://help.soundcloud.com/hc/en-us/articles/46020588217499-Uploading-Requirements) (search summary).
- The upload-hours quota depends on plan: Basic (free) 2 hours, Artist 3 hours, Artist Pro unlimited — [SoundCloud pricing](https://soundcloud.com/getstarted/pricing). A third-party guide still cites a "20 upload hours/month" technical cap — [SoundCloud topic page](https://soundcloud.com/topic/category/is-soundcloud-artist-pro-worth-it) (conflicts with the official pricing page).
- **Streaming formats (current):** AAC, transcoded into up to three tiers (256k, 160k, 96k) depending on source quality. Free listeners get 96k/160k; Go+ adds 256k. Lossless stereo uploads (WAV, FLAC, AIFF, ALAC) qualify for 256k AAC. Legacy MP3 streams are being migrated to AAC — [Help: Audio Streaming Formats](https://help.soundcloud.com/hc/en-us/articles/53385714099611-Audio-Streaming-Formats) (search summary).
- **[historical]** The older scheme was 128 kbps MP3 and 64 kbps Opus for everyone, plus 256 kbps AAC for eligible Go+ files — [Help article 115003452847](https://help.soundcloud.com/hc/articles/115003452847) (search summary). In 2018 Magnetic reported that lossy or low-bitrate uploads never get the high-quality stream — [Magnetic Mag, Jan 2018](https://www.magneticmag.com/2018/01/soundcloud-lowers-sound-quality-uploads-half/).
- Uploading guidance: lossless masters, 16-bit at 44.1 or 48 kHz (pages disagree), and -0.5 to -1 dBFS of headroom to avoid clipping when transcoding — [Help: Uploading Requirements](https://help.soundcloud.com/hc/en-us/articles/46020588217499-Uploading-Requirements) (search summary).
- On 13 Nov 2024 SoundCloud announced "the best damn upload experience on the Internet" — [Newsroom](https://soundcloud.com/company/newsroom) (headline only; details not retrieved).

**Stats and insights**
- Artist Pro insights show the top 50 listeners for a chosen period (signed-in listeners only), the top 50 countries and cities (pitched for tour and release planning), and play sources: app, a specific playlist, or an external embed or website — [Help: Your advanced Insights](https://help.soundcloud.com/hc/en-us/articles/45787456969115-Your-advanced-Insights); [Help: Insights](https://help.soundcloud.com/hc/en-us/articles/115003564988) (search summaries). The Artist tier only "shows how fans found you" — [pricing](https://soundcloud.com/getstarted/pricing).

### Inferences
- Timed comments do best as a short reaction layer, not a discussion forum. TNL should cap their length, show them as fading markers on the waveform, and keep threaded discussion in the normal comment list.
- SoundCloud's repost history is a warning: once reposts are cheap, followers' feeds become a promotional channel (repost chains, paid repost services). TNL's "no paid reach" rule, plus a small fixed rep award once per person (as `share_received` +3 already works), avoids most of this.
- SoundCloud now gates almost every artist control behind a subscription: scheduling, replace track, comments hub, deep stats. TNL can give the same controls to everyone, which suits a small, creatives-first app.

### Gaps
- I did not retrieve official engagement data on timed comments, such as the share of plays with comments or the effect on retention. None was found.
- I could not confirm the exact repost-caption limit or the 2015 repost changes from a primary source.
- I did not research embed/widget docs (`w.soundcloud.com/player`, oEmbed) this session. Background knowledge (unverified) is that SoundCloud offers an iframe widget with a JS API and an oEmbed endpoint.
- Not researched: playlist/set/album mechanics (album type, release date, buy link field) and like limits.

---

## 2. Discovery: home feed, Buzzing / First Fans, moods, charts, scenes, curated playlists, related tracks / stations

### Takeaway
Since 2023 SoundCloud's discovery has run on three ideas. First Fans: test a new upload on a small, taste-matched audience, then widen it if it lands. Social proof: "Liked by" your crew, and a 2025 homepage built on friends' likes. Scenes: a local or community trending wall, and research positioned around "where scenes form". The quiet 2024 version of the "zero plays" fix is the most relevant to TNL.

### Cited Findings
- **First Fans** (opt-in, for Next Pro, now Artist plans): an ML system recommends a new upload to up to 100 listeners most likely to enjoy it, based on past listening. Top performers go on to up to 1,000. SoundCloud stresses these are "real listeners, not bots." Context: "45.6 million tracks across services received zero plays" the previous year. SoundCloud claims more than 3.5 million (later 4.8 million) tracks were analysed and recommended, and a roughly 400% average increase in listens for Next Pro artists. These are company figures — [Music Business Worldwide](https://www.musicbusinessworldwide.com/soundcloud-launches-fan-powered-buzzing-playlists-to-spotlight-up-and-coming-artists); [SoundCloud Playbook: Introducing Buzzing Playlists](https://community.soundcloud.com/playbook-articles/introducing-buzzing-playlists-from-first-fans-to-fan-powered-playlists); [RouteNote](https://routenote.com/blog/soundclouds-new-secret-for-blowing-up-small-artists/) (search summaries).
- **Buzzing Playlists (2 May 2024):** weekly playlists of First Fans tracks that drew the most likes, comments, reposts, replays and playlist adds. They launched in pop, hip hop, R&B and electronic, and later added metal, rock and indie. They are pitched as an A&R "cheat-sheet" — same sources; [MusicTech](https://musictech.com/news/music/soundcloud-buzzing-playlists-new-feature/). On 24 Jul 2024 SoundCloud said artists featured on Buzzing "see big increase in plays" — [Newsroom](https://soundcloud.com/company/newsroom) (headline only).
- **"Liked By" indicators (25 Jun 2025)** and **"SoundCloud just got more social" (9 Oct 2025)**: a revamped homepage with "Liked by your crew" (a daily list of tracks recently liked by friends and favourite artists), "Liked by" playlists built from your network's likes, and a "Trending Trackwall" of rising tracks you can filter by local scene/community or platform-wide (iOS, Android, web). Mobile also gets "Hot For You" (one daily pick from trends plus your habits) and a Suggested Follows carousel — [RouteNote](https://routenote.com/blog/soundclouds-new-social-discovery-features/); [Newsroom](https://soundcloud.com/company/newsroom). Some features may not reach every account or region — [DocumentaryTube](https://www.documentarytube.com/blog/soundclouds-social-discovery-update-makes-friends-and-artists-likes-part-of-music-discovery/) (search summary).
- **Mood & Genre Filters** (24 Sep 2024) and **new-release notifications** for followed artists (17 Sep 2024); SoundCloud also sells **mood targeting for ads** (23 Feb 2024) — [Newsroom](https://soundcloud.com/company/newsroom) (headlines only; details not retrieved).
- **Scene framing:** the "2026 Music Intelligence Report: Where Music Scenes Form Before They're Named" (11 Feb 2026) — [Newsroom](https://soundcloud.com/company/newsroom). It reports that 43% of US listening time on SoundCloud goes to current music — [Magnetic](https://magneticmag.com/2026/02/soundcloud-2026-music-intelligence-report/) — and that streams of "eclectic new indie" grew more than 250%, with 89% of those listeners Gen Z — [Music Ally, Feb 2026](https://musically.com/2026/02/12/soundcloud-trends-for-2026-eclectic-indie-and-hip-hop-evolution/) (search summaries). In Feb 2024 Viberate said early music discovery happens on SoundCloud — [Newsroom](https://soundcloud.com/company/newsroom) (headline).
- **Discovery Mode** is a Spotify product (artists accept a lower royalty in return for algorithmic boost). I found no SoundCloud equivalent; SoundCloud's paid boosting sits in the "Promote tracks" plan feature (below).

### Inferences
- First Fans maps onto TNL directly, and without paid reach. Give every new track a guaranteed small "first ears" slot: for its first 48h, show it in the Music lab's ranked lane to a capped number of members who have played that genre or tag. Then widen it if listen-through and likes are good. Making it free and universal (not a paid tier) keeps TNL's rules.
- "Liked by your crew" needs only data TNL already has (likes, follows). It is a cheap, high-trust module for the Music lab's top.
- The scene/local filter on the Trackwall resembles TNL's labs and channels. TNL's equivalent of a "scene" is a channel or a tag, not geography.

### Gaps
- I found no source on the SoundCloud home-feed ranking, Charts (Top 50 / New & Hot), or a "Your Moods" feature by that name. Charts history and status were not verified this session.
- Not researched: related tracks, autoplay, "stations". Background knowledge (unverified): SoundCloud autoplays related tracks after the queue ends ("Autoplay"/stations).
- I found no independent (non-SoundCloud) measurement of First Fans or Buzzing effectiveness.

---

## 3. Artist tools: plans and prices, promote, Fan-Powered Royalties, distribution, insights, fan support, profile, 2024–26 features, AI

### Takeaway
SoundCloud has rebuilt itself as an artist-services business. Plans run from Free to Artist ($39/yr) to Artist Pro ($99/yr). They bundle distribution with 100% royalties (since end-Nov 2025), promotion, stats, scheduling and spotlight. It is layering fan-money tools on top: zero-fee Support (Oct 2025), Follower Exclusive releases (Mar 2026), and zero-commission direct sales (Aug 2026 beta). Fan-Powered Royalties (2021) is the conceptual cousin of TNL's "rep only from what others do". Its outcomes are disputed.

### Cited Findings
**Plans (official pricing page, fetched 2026-10-08)** — [soundcloud.com/getstarted/pricing](https://soundcloud.com/getstarted/pricing):
- Basic (free): 2 hours of upload, no promote, distribution or monetisation.
- Artist, $3.25/mo or $39/yr: promote 2 tracks/mo; "Get playlisted" 2/mo; distribute and monetise 2/mo to 50+ platforms; stats that show "how fans found you"; 3 hours of upload; 1 mastering credit/mo; replace 3 tracks/mo; Spotlight 1 track; YouTube Content ID; Artist badge; partial partner savings.
- Artist Pro, $8.25/mo or $99/yr: all of the above unlimited; Comments hub; Quiet mode; scheduled releases; 3 mastering credits/mo; Spotlight 5 tracks; split royalties; priority support; 50% off Go+; Pro badge.
- The Artist plan was introduced 16 Dec 2024 at $3.25/mo — [Newsroom](https://soundcloud.com/company/newsroom). Third-party sources disagree about which territories it covers and about EU pricing (€6.99/mo cited) — [search results incl. checkout.soundcloud.com/artist](https://checkout.soundcloud.com/artist).
- **[historical]** "Next Pro" was the earlier $99/yr name, required for First Fans and Buzzing — [MBW Buzzing article](https://www.musicbusinessworldwide.com/soundcloud-launches-fan-powered-buzzing-playlists-to-spotlight-up-and-coming-artists). The pricing page does not mention Amplify or First Fans by name; promotion appears as "Promote tracks".

**All-in-one subscription, 100% royalties, Fan Support (30 Oct 2025)**
- SoundCloud dropped its distribution revenue share (previously 20%) from the end-of-November 2025 payout cycle. Artists keep 100% from Spotify, Apple Music, YouTube Music, TikTok and others. SoundCloud-side monetisation was always 100% — [DJ Mag](https://djmag.com/news/soundcloud-launches-all-one-artist-subscription-plan-including-100-distribution-royalties); [Music Week](https://www.musicweek.com/digital/read/soundcloud-now-enables-artists-to-keep-100-of-distribution-royalties-across-streaming-platforms/092964); [SoundCloud Playbook](https://community.soundcloud.com/playbook-articles/soundcloud-unveils-all-in-one-artist-subscription-more-ways-to-earn-all-in-one-place) (search summaries).
- A profile **Support** button lets fans pay artists directly with no SoundCloud commission (US-first, "at least for now"). The plan also includes on-demand vinyl (via the elasticStage partnership, 10 Jul 2025) and merch storefronts — same sources; [Newsroom](https://soundcloud.com/company/newsroom).

**Fan-Powered Royalties (FPR, launched March/April 2021)**
- Each listener's subscription or ad revenue is split among the artists that listener actually played, instead of one pro-rata pool. It applies to independent artists monetising directly through SoundCloud — [Digital Music News, 2 Mar 2021](https://www.digitalmusicnews.com/2021/03/02/soundcloud-fan-powered-royalties/); [MusicTech](https://musictech.com/news/industry/soundcloud-fan-powered-royalties/).
- SoundCloud's claims: emerging artists could earn up to 25% more — [Juno Daily](https://www.juno.co.uk/junodaily/2021/03/03/artists-could-earn-25-more-in-royalties-from-new-soundcloud-model/). "Up to 500%" increases, and Portishead's "SOS" cover earning about 6× the pro-rata payout, based on under a month of data — [DJ Mag](https://djmag.com/news/soundcloud-says-some-artists-have-seen-500-increase-royalty-payments-its-new-plan); [mxdwn, Sep 2021](https://music.mxdwn.com/2021/09/16/news/soundcloud-claims-its-new-royalty-distribution-model-allowed-portishead-to-earn-500-more/).
- Warner Music Group became the first major label to sign onto FPR — [Far Out](https://faroutmagazine.co.uk/warner-adopts-fan-powered-royalties-system/).
- A counter-claim: a "Media Research" survey of 118,000 FPR artists reportedly found 56% earned more under pro-rata — [RouteNote](https://routenote.com/blog/soundcloud-fan-powered-royalties-increase-artist-payments/) (search summary; I could not identify or verify the original study, and a survey of 118k artists is an unusual figure; treat as unverified).

**Fan relationship tools**
- **Fan Recognition (21 Feb 2025):** a web-only module on the track page. "First Fans" lists who played and liked the track most during its first week, ordered by plays; "Top Fans" lists who played it most over time. Eligibility: 18+, liked the track and followed the artist, has a username, avatar and verified email. Fans can opt out — [SoundCloud press](https://press.soundcloud.com/247205-introducing-fan-recognition-celebrate-the-fans-who-fuel-your-music); [MusicTech](https://musictech.com/news/industry/soundcloud-fan-recognition/) (search summaries).
- **Follower Exclusive Releases** (Mar 2026; see §1) and **new-release notifications** (Sep 2024) — [MBW](https://www.musicbusinessworldwide.com/soundcloud-launches-superfan-feature-that-lets-artists-release-music-exclusively-to-followers-before-wider-release/); [Newsroom](https://soundcloud.com/company/newsroom).
- Other 2024–26 items, headlines only from the [Newsroom](https://soundcloud.com/company/newsroom): Ticketmaster/Universe event ticketing on profiles (24 Feb 2025); TikTok "Add to Music App" partnership (21 May 2025); Resident Advisor partnership (Jul 2024); "Ascending" breakthrough-artist programme (5 Sep 2024); SoundCloud Store merch (Aug 2024); Twitch "SoundCloud Sessions" (25 Jun 2026); acquisition of Nina Protocol "to preserve and amplify independent music culture" (22 Jul 2026); Imogen Heap / Auracles partnership (Dec 2025).

**AI tools and AI policy**
- Jan 2024: integrations with Fadr, Soundful and Voice-Swap. 18 Nov 2024: six more AI partner tools (Tuney, Tuttii, AIBeatz, TwoShot, Starmony, ACE Studio) with in-tool upload to SoundCloud. Tracks made with them are tagged. Audible Magic and Pex content-ID is offered to the AI partners, and SoundCloud joined the "Principles for Music Creation With AI" (Roland/UMG) — [SoundCloud Playbook](https://community.soundcloud.com/playbook-articles/soundcloud-unveils-six-new-ai-powered-tools-to-democratize-music-creation-for-all-artists); [Digital Music News](https://www.digitalmusicnews.com/2024/11/19/soundcloud-ai-tools-november-2024/) (search summaries).
- **The 2025 terms-of-use controversy:** a clause added in February 2024 allowed uploaded content to be used for AI. It surfaced publicly in May 2025, and Ed Newton-Rex (Fairly Trained) and others criticised it. On 14 May 2025 CEO Eliah Seton admitted the wording "was too broad and wasn't clear enough". He said SoundCloud has never trained generative AI on artist content and does not let third parties scrape it for that. He committed that SoundCloud "will not" train genAI models that "replicate or synthesize your voice, music, or likeness", and that any future training would be opt-in "with explicit consent". This was a change from an earlier spokesperson statement that promised only opt-out — [Music Business Worldwide](https://www.musicbusinessworldwide.com/soundcloud-fixes-ai-policy-following-backlash-ceo-eliah-seton-says-ai-should-support-artists-not-replace-them); [Digital Music News, 12 May 2025](https://www.digitalmusicnews.com/2025/05/12/soundcloud-ai-training-response/); [Music in Africa](https://www.musicinafrica.net/node/362754) (search summaries). DMN argued that parts of the language still left room for non-generative training.

### Inferences
- FPR is a money system, and TNL has no streaming revenue to split. Its principle still transfers: value should follow what real listeners actually do. TNL's rep already works this way, since it is awarded only from others' actions. The lesson is to make "a play" mean a real listen (see §5) before any rep or ranking depends on it.
- Fan Recognition ("First Fans" / "Top Fans" on a track page) is cheap for TNL. It rewards the listener (status), not the artist, so no rep rule is involved. It needs per-user play events, which TNL does not record yet.
- SoundCloud's AI controversy shows that terms of use are product surface. TNL's Studio sound library, and any future "use this sound", should state plainly what TNL may do with uploads.

### Gaps
- I did not research Amplify (SoundCloud's in-app ad promotion product) or "Repost by SoundCloud" (the 2017-era distribution and services arm) in depth. Search returned no reliable primary page for "Repost by SoundCloud". Background knowledge (unverified): Repost launched in 2017 and was later folded into SoundCloud's artist plans.
- I did not verify whether SoundCloud has a fan-messaging tool or a paid fan-club/subscription tier (beyond the Support button). No source found.
- Not covered: DJ/tracklist features (e.g. any 2025–26 "tracklist" on mixes), and profile customisation detail beyond badges and Spotlight.
- Outcome data for Oct 2025 Support / Fan Support and the Aug 2026 direct sales: none published yet.

---

## 4. Culture: SoundCloud rap, bedroom producers and DJs, remix/bootleg norms and copyright friction, the 2025 AI terms episode

### Takeaway
SoundCloud became culturally important because it had no gatekeepers: anyone could upload a raw, lo-fi track and it could spread through reposts and comments. That produced the 2016–18 "SoundCloud rap" wave and made it the default home for DJ mixes and bootleg remixes. The same openness produced constant copyright friction (automated ID since 2010, account deletions), which licensing deals only partly resolved.

### Cited Findings
- **[historical]** The SoundCloud rap peak was 2016–17, with Playboi Carti, XXXTentacion, Post Malone, Lil Uzi Vert, Lil Yachty and others. The sound grew out of cheap mics, Audacity and a laptop, and the distortion became an aesthetic — [The Dowsers](https://the-dowsers.com/the-dowser-posts/brief-history-soundcloud-rap); [Grinnell subcultures project](https://oldsitecopy.haenfler.sites.grinnell.edu/subcultures-and-scenes/music-cultures/soundcloud-rap/) (search summaries).
- **[historical]** XXXTentacion's breakout "Look at Me" was uploaded to SoundCloud by producer Rojas. His album "?" debuted at No. 1 (2018), billed as the first "SoundCloud rap" No. 1 album — same sources plus the Billboard-syndicated "SoundCloud Rap Has Its First No. 1 Album" (search summary, mirror URL only).
- Electronic music fans are "the most engaged worldwide" on SoundCloud, per an Oct 2024 press release. There are partnerships with ADE (Sep 2024) and Resident Advisor (Jul 2024) — [Newsroom](https://soundcloud.com/company/newsroom).
- **[historical] Copyright:** SoundCloud has used automated content identification since 2010 and was known for strict takedowns and account deletions. In Dec 2016 it said it would stop removing DJ mixes after licensing deals (including GEMA), and Wahlforss said no ads would go into mixes — [The FADER, Dec 2016](https://www.thefader.com/2016/12/12/soundcloud-no-longer-remove-dj-mixes-for-copyright-infringement); [VICE](https://www.vice.com/en/article/soundcloud-dj-mixes-licensing) (search summaries). Dubset's MixSCAN/MixBank identified the tracks inside mixes and split royalties, and Apple Music and Spotify signed with Dubset for remixes and mixes. Dubset said YouTube and SoundCloud would keep running under UGC licences, which give cover in exchange for takedown rights — [NPR/WNYC, Apr 2016](https://wnyc.org/story/with-new-deals-apple-and-soundcloud-remix-the-dance-music-marketplace); [The Music Network](https://themusicnetwork.com/news/legal-remixes-mixtapes-coming-spotify-apple-music) (search summaries).
- Today the Artist and Artist Pro plans include YouTube Content ID for the artist's own tracks — [pricing](https://soundcloud.com/getstarted/pricing). In Dec 2025 SoundCloud posted "Protecting Our Users and Our Service", and in Aug 2025 joined GIFCT and the Tech Coalition — [Newsroom](https://soundcloud.com/company/newsroom) (headlines only).
- **2025 AI terms episode:** see §3. The arc ran from a quiet ToS edit, to public outcry, to a CEO letter within days, to an opt-in commitment.

### Inferences
- What made SoundCloud the home of bedroom producers was low friction to post, immediate social feedback (timed comments, reposts) and tolerance of rough work. TNL's labs already welcome unfinished work ("Half-formed is fine"). Timed comments would give producers the feedback loop they actually go to SoundCloud for.
- Remix and bootleg culture is where copyright risk arises. TNL should keep "Use this sound" and remixes within TNL-owned content (Studio samples, members' own tracks) and require the owner's consent. That matches the existing extract rule ("Your own video for now… a different consent question") in `server-08-trust-library.js`.

### Gaps
- I found no academic paper on SoundCloud communities this session. None was retrieved.
- Not verified: whether the 2016 no-takedown stance for DJ mixes still holds in 2026, or what the Dec 2025 "Protecting our users" post covers.

---

## 5. Shortlist for TNL Labs: adopt / adapt / skip, effort, fit with TNL rules, and concrete designs

### Takeaway
Adopt five things: a precomputed waveform, timed comments, track likes, honest listen-through plays, and a First-Fans-style free "first ears" slot. Adapt reposts into a one-tap "Reshare to my profile" that reuses `share_received`, with no feed flooding. Adapt secret links and follower-first drops. Skip anything that is paid reach, subscriptions, distribution, or new external services.

### Cited Findings
(Source facts for each row are cited in §1–4. The design detail below is inference grounded in the TNL code cited at the top of this file.)
- Peaks.js/audiowaveform docs: decoding audio in the browser with Web Audio is CPU-heavy and means downloading the whole file, so precomputing peaks server-side and serving a small JSON/binary file is better for long audio — [bbc/peaks.js](https://redirect.github.com/bbc/peaks.js); [bbc/waveform-data.js](https://github.com/bbc/waveform-data.js) (search summaries).
- TNL's extract route already uses a one-job ffmpeg lock and produces 128k AAC (`src/server-08-trust-library.js:279-330`). Plays are counted on press, with no dedup and no owner exclusion (`src/server-08-trust-library.js:393-398`; `src/app-13-player.js` `playTrack`).

### Inferences
**Shortlist (effort: S < 1 day, M 1–3 days, L > 3 days)**

| # | Feature | Verdict | Effort | Fit with TNL rules / notes |
|---|---|---|---|---|
| 1 | **Waveform on every track** (precomputed peaks, drawn in vanilla canvas/SVG, tap to seek) | Adopt | M | No new dependency: uses `ffmpeg-static`, which is already installed. Peaks stored as JSON next to the file. |
| 2 | **Timed comments** (short comments pinned to a moment, shown as markers on the waveform, fading in during playback) | Adopt | M | Feedback is TNL's core ("tracks, feedback and chat"). No rep for commenting itself, so it can't be farmed. Owner gets a notification. |
| 3 | **Track likes** (heart on track rows and in the player bar) | Adopt | S | Reuse `like_received` +6 for the *owner*, once per liker per track, through `awardRep`. Never self-awarded. |
| 4 | **Honest plays + listen-through stats** (count a play at ≥30s or ≥50%, deduped per listener per track per 24h, owner excluded; owner sees plays, unique listeners, average % listened, a drop-off curve) | Adopt | M | Plays earn no rep (keeps "rep only from others' actions" unfarmable). Stats are visible to the owner only, matching SoundCloud's insights but free. |
| 5 | **"First ears" slot** (First Fans without the paywall: each new track shown to up to N members who play that tag/genre in the first 48h, widened if listen-through and likes are good) | Adapt | M | Free and universal, so not paid reach. One slot per member per day to avoid flooding. Fits `server-10-rank.js`. |
| 6 | **"Liked by people you follow"** row at the top of Music | Adopt | S | Pure SQL over likes + follows; social proof. |
| 7 | **Reshare a track** (SoundCloud repost → TNL reshare to your profile, optional 100-char note) | Adapt | S–M | Reuse `share_received` +3 for the owner, once per resharer per track. No repost chains: a reshare can't be reshared, and reshares are capped in followers' feeds (e.g. at most 1 in 5 items). |
| 8 | **First / Top listeners** on a track page (Fan Recognition) | Adopt (after #4) | S | Status for listeners, not the artist, so no rep. Opt-out toggle in settings. Requires per-user play rows from #4. |
| 9 | **Private link / members-only drop** (unlisted track with a resettable secret token; "followers first for 48h") | Adapt | S–M | IDs never change, so the secret is a separate `share_token` column that can be reset. Fits "work in progress" sharing. |
| 10 | **Download toggle / sell a track** | Adapt via existing Market sound listings | S | TNL already has sound listings with downloads and Stripe Connect. Add a "Buy / download" link from the track to its listing. No new payment path. |
| 11 | **Lossless upload → AAC 256k + 128k transcode** | Adapt (optional) | M | Same ffmpeg. Keep the original for downloads. Queued behind the existing one-job lock; watch CPU and volume space. |
| 12 | Sets / albums | Later | M | Useful for EPs. Low priority for a small network. |
| 13 | Embeds / widget for outside sites | Later | M | `/t/:id` server page with player + OG tags, like `/p/:id`. |
| 14 | Paid promotion (Amplify/"Promote"), subscriptions, distribution to DSPs, mastering credits, AI generation tools | **Skip** | – | Paid reach, new services and new dependencies are all against TNL rules. |
| 15 | Fan-Powered royalties | Skip (no revenue pool) | – | Keep the principle: value follows real listeners. |

**Concrete designs**

*Waveform peaks (server, no new dependency).*
- Run this after `POST /api/tracks` (and after extract), using the existing `FFMPEG` and the same one-job lock or a tiny queue:
  `ffmpeg -nostdin -i <file> -ac 1 -ar 8000 -f s16le -` → read stdout in Node.
- Split the samples into a fixed **200 buckets** (enough for a 390px phone at ~2px bars, scaled up on wide screens). Take max |sample| per bucket and normalise to 0–100.
- Store it as `tracks.peaks TEXT` (JSON array, ~600 bytes) and also `duration_ms` measured from the sample count. That fixes the current "duration comes from the client" trust gap.
- Backfill existing tracks lazily: compute on the first `GET` that finds `peaks IS NULL`, one at a time.
- Memory: at 8 kHz mono s16 a 10-minute track is about 9.6 MB of PCM. Stream it and fold into buckets on the fly rather than buffering. That needs total samples up front, which can be estimated from `duration_ms`, or use two passes or reservoir-free running buckets with a known sample count.

*Waveform drawing (client, vanilla).*
- Use one `<canvas>` (or inline SVG `<rect>`s) per visible track. Draw bars in `--fg-dim` and the played portion in the member's accent from `palette.js`. Never hard-code colours.
- Repaint progress in `paintProgress` (already on `timeupdate`) with a clip rect. Change only the canvas paint, not the layout, which respects the "transform/opacity only" motion rule.
- Tap or drag to seek replaces the current bar in the player.

*Timed comments.*
- Table: `track_comments(id, track_id, user_id, at_ms, body ≤ 140, created_at)`, index `(track_id, at_ms)`.
- Routes: `GET/POST /api/tracks/:id/comments`, with `DELETE` for the author, the track owner and admins.
- UI: avatar dots on the waveform at `at_ms`. During playback, the comment within ±1.5 s fades in above the bar for about 3 s, using opacity only. Tapping a dot seeks there. Composing pre-fills `at_ms` with the current time ("comment at 1:42").
- Limits: rate-limit like other comment routes and include them in reports/moderation. No rep for writing; the owner gets a notification.
- Test: an e2e step that posts a comment at 0:05, plays, and asserts it appears without layout shift.

*Listen-through stats.*
- Replace the press-time `api.trackPlay` with a heartbeat. The client sends `POST /api/tracks/:id/listen {ms_listened, max_pos_ms}` on pause, ended, track change or `pagehide` (`sendBeacon`).
- Server: an upsert into `track_listens(track_id, user_id, day, ms, max_pos)`.
- `plays` increments only when (ms ≥ 30 000 or ms ≥ 0.5·duration) and user ≠ owner and it is the first qualifying listen today.
- Owner view: plays, unique listeners, average completion = avg(max_pos/duration), and a 20-bucket drop-off histogram of max_pos.
- No rep from plays. Keep the existing rate limit.

### Gaps
- Bucket count, the thresholds (30 s / 50%) and the "first ears" N are design choices, not SoundCloud facts. SoundCloud does not publish its play-counting rule; I found no source for it.
- I did not test whether `ffmpeg-static` on Railway's CPU can produce peaks quickly for long uploads. This should be measured before shipping, together with the one-job lock already used by extract.
