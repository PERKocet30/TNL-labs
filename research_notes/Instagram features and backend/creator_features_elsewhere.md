# Creator features on non-Instagram platforms, and what fits TNL Labs (as of 2026-10-07)

What TNL already has, from `README.md` and a read-only grep of `src/` (2026-10-07):
- Two-sided collabs: they count only after the other person accepts, and give +20 rep to each.
- Reshares with credit, shown as "Remix" in `app-12-archive-posts.js` and `server-02-auth-feed.js`.
- Moodboards and the Archive, plus +4 rep when someone builds with a sound you shared.
- The Market: Stripe Connect, offers, sizes and colours, a bag, and commission by level from 10% down to 2%.
- Events: bracket and poll formats with Instagram vote links.
- The Music lab player, the Studio beat maker (off by default), DMs and lab channels. The Music lab channels include "feedback" and "process".

The grep found none of these in `src/`: timed comments, forks, licensing, pay-what-you-want, commissions or requests, an availability-for-hire flag, medium or tool tags, pinned profile posts, or pre-orders. A keyword grep can miss things, so treat this as "not obviously present", not as proof they are missing.

Source quality: closo.co, amraandelma.com, makerstack and similar SEO aggregators show up below. They are marked "(low-quality aggregator)" and their numbers should be treated as unverified.

## Collaboration features: what makes them actually used?

### Takeaway
Collab features get used when they give a concrete distribution or credit payoff to both sides, and when attribution is automatic and permanent. Examples: YouTube's collab videos reach every collaborator's subscribers, and BandLab forks always credit the original. TNL's accept-to-count collabs already follow the same consent model as YouTube and Instagram. The gaps are fork/remix-the-project and the distribution payoff.

### Cited Findings
- **BandLab forks.** Finished or work-in-progress projects posted to the BandLab feed can be listened to, commented on and forked. Marking a song "forkable" grants other users a licence to build on it. Anything published from a fork is always attributed to the original, with the creator's name and song shown at the top. — [BandLab Blog: Forking and collaboration explained](https://blog.bandlab.com/forking-and-collaboration-on-bandlab-explained/) (the direct fetch returned empty; this content comes from the search-result summary of that page)
- **BandLab scale.** More than 100 million registered users by early 2026, up from 60 million in January 2023. Users make about 16–17 million songs a month. — [Music Business Worldwide](https://www.musicbusinessworldwide.com/music-making-app-bandlab-surpasses-100-million-users/); [MBW, 60M](https://www.musicbusinessworldwide.com/spotify-wants-50-million-creators-bandlab-already-has-60-million/)
- **BandLab contests use forks as the entry.** In the July 2021 contests (#YouGoatThis, #CometMeBro, #ForkOfJuly), you entered by posting a track with the hashtag or by forking the contest's track. — [Music in Africa](https://www.musicinafrica.net/node/173063) (historical, 2021)
- **YouTube Collaborations** were announced on 1 Aug 2025 as a pilot. The uploader adds collaborator channels (up to five, according to one source) when uploading or editing a video. Each invite must be explicitly accepted before it goes live. Collaborator avatars sit next to the title, and the video is recommended to every collaborator's audience. — [PPC Land](https://ppc.land/youtube-launches-collaboration-feature-for-creator-partnerships/); [eMarketer](https://www.emarketer.com/content/youtube-collab-feature-reshape-influencer-strategy). PPC Land gives no maximum; the "up to five" figure comes from a search summary of other coverage.
- **Behance** will not feature agency projects that don't credit the individual artists, and it lists "collaborators credited" as part of a featured-ready project. — [Behance blog: How to get featured](https://www.behance.net/blog/how-to-get-featured-on-behance)
- **TikTok Duet and Stitch.** Duet puts your video side by side with another user's. Stitch clips part of someone's video and continues from it. — [Influencer Marketing Hub](https://influencermarketinghub.com/how-to-stitch-on-tiktok/)
- Claimed numbers: "75% of TikTok users engage with Duets", "Duets can lead to a 50% increase in views", "60% of creators report follower gains". — [amraandelma.com](https://www.amraandelma.com/duet-and-stitch-tiktok-stats) (low-quality aggregator with no primary data; treat as unverified)
- **pixiv Requests** (launched 30 Sep 2020). Fans pay for work they request. The creator sets a target price, chooses which requests to accept, and delivers the piece publicly or as a URL-restricted work. There are more than 390,000 requests in total. — [pixiv info](https://www.pixiv.net/info.php?id=6258); [pixivision](https://www.pixivision.net/ko/a/5847)
- **pixiv scale.** More than 128 million registered users at its 19th anniversary. — [Newswire](https://www.newswire.com/news/pixiv-celebrates-its-19th-anniversary-over-128-million-registered-22858525)

### Inferences
- What drives use is (a) automatic, permanent credit (BandLab fork headers, Behance collaborator credits) and (b) a reach payoff (YouTube pushes the video to every collaborator's audience). TNL already has consent and rep (+20 each). Showing an accepted collab in both people's followers' feeds would add the reach payoff without breaking any rule.
- A "fork this beat" button in the Studio, with permanent credit to the original, fits TNL's existing +4 "someone builds with a sound you shared" event. It turns the Studio from a solo tool into a collab engine, and rep still comes from someone else's action.
- Contests where you enter by forking a shared stem (BandLab) fit TNL's events system: the event brief could include a stem to build on.

### Gaps
- No primary data on how much fork or collab features lift engagement on BandLab, Behance or YouTube.
- I did not verify that YouTube Collaborations had fully rolled out by Oct 2026, or how many collaborators it allows.
- Behance's co-owner mechanics (whether consent is needed) were not confirmed from a primary source.

## Feedback and critique, including work-in-progress and process posts

### Takeaway
Feedback anchored to the work is the standout pattern: SoundCloud comments pinned to a timestamp, Discord forum posts with titles and tags. It keeps critique specific and visible. Behance shows a counterpoint: it curates finished projects only, so WIP needs its own home.

### Cited Findings
- **SoundCloud timed comments.** Fans comment at a specific timestamp, and the comments show along the waveform. SoundCloud credits social features like this with session length and retention, with about 140 million monthly users cited for 2025. — [LabelGrid help](https://help.labelgrid.com/en/platforms/soundcloud/). The 140M figure comes from a search summary of aggregator content; unverified.
- **SoundCloud fan-powered royalties** pay each subscriber's fee to the artists they actually listen to. A search summary says creator payouts reached $176M in FY2025, up 22%, but I could not open the primary source. — [MusicTech](https://www.musictech.net/news/industry/soundcloud-fan-powered-royalties/); [MBW](https://www.musicbusinessworldwide.com/as-soundcloud-overhauls-its-creator-subscription-model-ceo-eliah-seton-says-the-platform-is-building-musics-next-major-revenue-format1/)
- **Discord Forum Channels.** Each post is its own thread with a bold title and tags, so feedback can be sorted and revisited. — [Discord blog](https://discord.com/blog/forum-channels-space-for-organized-conversation)
- **Behance** curators review a project once, when it is first published. Drafts and WIP updates are not re-reviewed. The rules: complete projects only, at least 3 images (5–15 recommended), around 1400px wide. Thoughtful comments and appreciations help organic reach. — [Behance blog](https://www.behance.net/blog/how-to-get-featured-on-behance)
- **Bandcamp supporter comments.** Buyers can leave a short review that appears under the album, so the feedback is tied to a purchase. — [hi54.blog](https://hi54.blog/content/bandcamp-musicians-why-name-your-price-no-minimum-is-better-than-a-free-download)

### Inferences
- TNL's Music lab has a player and a "feedback" channel, but no comments pinned to the track. Timed comments on tracks (and possibly "pinned to a point on the image" for visual work) would make critique specific. Each comment is another person's action, so it could carry a small rep value or none.
- A "feedback wanted" or "WIP" flag on a post, shown in a lab's feedback channel and kept out of the Showroom, mirrors Discord forum posts with tags. It also respects Behance's lesson that finished and in-progress work should be shown differently.
- Bandcamp-style "supporter" comments, from people who bought or confirmed delivery, could appear on Market listings as trust signals.

### Gaps
- I found no primary data showing that timed comments increase retention. SoundCloud's claim comes through aggregators.
- Dribbble's feedback tools were not researched in depth. Dribbble retired its separate "rebound" and feedback features at various points, and their current state is unverified.

## Discovery and curation

### Takeaway
Two discovery models are proven for creatives. The first is human curation by medium: Behance runs more than 100 hand-picked galleries, and Bandcamp has Daily and fan collections. The second is structured metadata (field, medium, software) that powers filters, as on Cara, ArtStation and Behance. Are.na shows that collaborative, like-free collections can sustain a loyal paying base.

### Cited Findings
- **Behance curated galleries.** More than 100 galleries are hand-picked daily by expert curators, and featured work gets a boost in views and appreciations. Behance has more than 19 million monthly visitors. "Tools used" metadata feeds Adobe tool galleries. — [Behance blog](https://www.behance.net/blog/how-to-get-featured-on-behance); [Behance help](https://help.behance.net/hc/en-us/articles/17285130065179)
- **Cara portfolios.** Artists tag fields, mediums, project types, categories and software. Cara filters out AI images and has a jobs board. It gained 600,000 users in a week in June 2024, during the backlash over Meta's AI training (historical). — [Scribe / TechCrunch mirror](https://scribe.disroot.org/post/398459)
- **Bandcamp fan collections and Music Feed.** Fans' purchases show on their public collection pages and in followers' feeds. Artists get an email when someone buys from a friend's collection page. — [noobheavy](https://noobheavy.com/getting-the-most-out-of-bandcamp/); [hi54.blog](https://hi54.blog/content/bandcamp-musicians-why-name-your-price-no-minimum-is-better-than-a-free-download)
- **Are.na** is built around channels of "blocks" (links, images, text). Channels can be opened so other people add to them. There are no likes, favourites or shares, and no ads. 15,777 people pay for Premium. — [Adobe Express: how to use Are.na](https://www.adobe.com/express/learn/blog/how-use-arena); [Are.na about](https://www.are.na/about); [Are.na roadmap](https://are.na/roadmap)
- **Pinterest Lens** handles 600M visual queries a month (dated figure from Pinterest; historical). In an Adobe study, 73% said Pinterest visual search outperforms traditional search and 36% start searches on Pinterest. — [Pinterest Business](https://business.pinterest.com/vi/blog/the-future-of-search-is-visual/); [TechCrunch](https://techcrunch.com/?p=1567091)
- **TikTok Creator Search Insights** shows creators what people search for. Its "content gap" filter lists topics that are searched often but have few videos. — [Search Engine Land](https://searchengineland.com/?p=438398); [Lindsey Gamble](https://www.lindseygamble.com/blog/tiktok-provides-creators-with-insight-into-user-search-topics-through-creator-search-insights-tool)

### Inferences
- TNL has a "Founder feature" (+40 rep) and the Archive. A curated gallery per lab ("// Visual: Featured") is a natural next step: a staff or high-level-member pick that is visible and searchable, with rep coming from the curator's action.
- Optional medium, tool and role tags on posts (for example: medium = gouache / 35mm / Ableton; role = stylist / producer) would drive Archive filters and profile skill summaries at almost no cost, without adding rules.
- Collaborative boards (Are.na open channels, Pinterest group boards) extend TNL moodboards with consent: invite → accept, matching TNL's collab model. A "lab search gaps" panel (TikTok's content gap) could be a cheap admin or lab view built from TNL's own search queries.
- Pinterest-style visual search needs ML infrastructure or an outside service, which breaks the "no new dependencies or external services" rule. Low fit.

### Gaps
- Bandcamp Daily's effect on sales was not quantified.
- I found no current (2026) Pinterest Lens query count.
- Cara's user count after 2024 was not found.

## Commerce features for creatives

### Takeaway
The best-evidenced commerce mechanics are fee waivers on set days (Bandcamp Fridays: $154M paid out since 2020), pay-what-you-want with a floor of $0 (fans pay voluntarily about half the time, per one blog), standard licence tiers with an automatic contract (BeatStars: $325M+ paid out), and fan-initiated paid requests (pixiv: 390k+ requests).

### Cited Findings
- **Bandcamp Fridays.** Bandcamp waives its cut on set days; it normally takes 15% of digital and 10% of physical sales. The days have paid $154M since March 2020, including $19M in 2025. The Dec 2025 event made $3.8M in 24 hours, and the first Friday of 2026 (6 Feb) raised $3.6M. 2026 dates: 6 Feb, 6 Mar, 1 May, 7 Aug, 4 Sep, 2 Oct, 6 Nov, 4 Dec. — [Music Business Worldwide](https://www.musicbusinessworldwide.com/bandcamp-fridays-hit-154m-in-payouts-since-2020-with-19m-paid-in-2025-alone); [RouteNote](https://routenote.com/blog/first-bandcamp-friday-2026-raises-over-3m-for-artists/)
- **Bandcamp "Name Your Price, No Minimum."** A blogger reports fans pay above $0 "50% of the time". — [hi54.blog](https://hi54.blog/content/bandcamp-musicians-why-name-your-price-no-minimum-is-better-than-a-free-download) (one blog's claim, not Bandcamp data)
- **BeatStars licensing.** Basic, Premium, Exclusive and Unlimited licences can sit on the same beat, each delivering its own files, and every sale produces a licence contract PDF. BeatStars has paid creators more than $325M (up from $200M two years earlier) and reports 10M creators in 200+ territories. — [MBW](https://www.musicbusinessworldwide.com/beat-marketplace-beatstars-has-paid-out-325m-to-creators-to-date/); [Pause Play Repeat](https://www.pauseplayrepeat.com/features/beat-licensing)
- **pixiv Requests**: see Collaboration above (target price, the creator chooses, 390k+ requests). **VGen**, a commissions marketplace with a strict anti-AI policy, gives artists a verified badge, which requires among other things $100 in commission earnings in the last 30 days. — [VGen help](https://help.vgen.co/hc/en-us/articles/36331022994967)
- **Patreon** passed $10B paid to creators in Aug 2025, at more than $2B a year. It added free memberships and one-off digital product sales in June 2023 (historical). — [Axios](https://www.axios.com/2025/08/05/patreon-10-billion-creator-economy-ai); [Hypebot](https://www.hypebot.com/patreon-adds-free-fan-memberships-direct-to-fan-digital-sales)
- **Substack** passed 5M paid subscriptions in March 2025, with 50,000+ publications earning money. — [Tubefilter](https://www.tubefilter.com/2025/03/12/substack-five-million-paid-subscribers-journalist-reporter-newsletter/)
- **Depop** shipped Make an Offer, Depop Payments and Boosted Listings (paid placement), and seller adoption of Boosted Listings grew. — [FashionUnited](https://fashionunited.uk/news/business/depop-increases-sales-narrows-losses/2023092871823) (2023, historical). Claims of "20–30% sales lift" come from [closo.co](https://closo.co/blogs/platform-specific-guides/depop-boost) (low-quality aggregator; unverified).
- **Grailed** offers free digital authentication on high-value listings, done in hours, to fight counterfeits. — [OneShop](https://oneshop.com/blog/grailed-authentication) (third-party description)
- **ArtStation** lets artists sell prints and digital assets. Pro ($9.95/mo) members earn an extra 5% of the base price on print sales. — [ArtStation help](https://help.artstation.com/en/articles/16155231-printed-product-earnings); [ArtStation about](https://www.artstation.com/about?lang=us)

### Inferences
- **Fee-free day.** TNL's commission is already tied to level (10%→2%). A monthly "TNL Friday", with commission waived for everyone, is simple to build and has the strongest public evidence behind it. It does not touch rep.
- **Pay-what-you-want with a floor** on digital Market items (beats, presets, zines, wallpapers) fits Stripe Connect checkout directly.
- **Licence tiers with an auto-generated licence PDF** for beats and sounds turn the Studio and Music lab into income. Legal wording needs review, because this touches payments.
- **Commissions/Requests** (pixiv, VGen) fit TNL's two-sided model: the client requests → the creator accepts → payment is held → delivery. Seller rep is still earned only from the client's purchase and confirmation.
- **Paid boosts conflict with "no ads"** and with rep-only standing. Do not adopt. Depop's Offers already exist in TNL.

### Gaps
- No primary data on Depop's boost lift, or on VGen volume or fees.
- Limited drops and pre-orders were not researched in depth (no reliable source found within the time budget).

## Challenges and competition: what drives repeat participation

### Takeaway
Repeat participation comes from a predictable cadence with tiny prompts (Dribbble Weekly Warm-up, Inktober's daily list in October) more than from big prizes. Big-prize contests (BandLab, $6,000 pools) drive spikes rather than habits.

### Cited Findings
- **Dribbble Weekly Warm-up.** A recurring weekly prompt (for example "design a hot sauce label", "a mascot for a March Madness team"), posted with the #dribbbleweeklywarmup tag. Prompts are numbered past No. 58, and there are occasional "Playoff" editions. — [Dribbble official account](https://dribbble.com/Dribbble); [example shot](https://dribbble.com/nellalberto9789)
- **Inktober**, created by Jake Parker in 2009: one inked drawing a day through October from a published prompt list. Nearly 1.5M Instagram posts carried the tag (dated figure). — [University of Brighton blog](https://blogs.brighton.ac.uk/katiepiatt/2017/10/28/october-28th-2017-inktober-day-28-rain) (historical)
- **BandLab contests**: free to enter, up to $500 or a $6,000 prize pool, with prizes such as Tracklanta producer sessions. You enter by tagging a post or forking a track. — [MusicTech](https://musictech.com/news/bandlab-tracklanta-2020-virtual-remix/); [Music in Africa](https://www.musicinafrica.net/node/173063)
- **TikTok hashtag challenges**: see Duet/Stitch above. No primary participation data was found.

### Inferences
- TNL's events system is built for heavy tournaments: brackets, judges, Instagram cards. A lightweight "weekly prompt" event type would build the habit: one word or brief per lab each week, entry by tagging a post, no voting, results as a gallery. Posting earns no rep (TNL rule). Likes and saves on entries earn rep as usual.
- Running an Inktober-style monthly list (31 prompts) once a year per lab ("Anime-tober", "Fit-tober") is cheap and seasonal. It is October right now.

### Gaps
- No primary data on Dribbble Warm-up participation counts or retention.

## Portfolio and profile features

### Takeaway
Creative platforms turn profiles into portfolios with structured skills metadata, case-study projects (multi-image plus process), an availability or for-hire state, and verification badges tied to real activity.

### Cited Findings
- **Behance**: "edit your availability" lets visitors know you are open to opportunities. You can send proposals and get paid on-platform. The Featured Freelancers program gives a profile badge, priority on the Hire page and team support. — [Behance help](https://help.behance.net/hc/en-us/articles/17285130065179); [Adobe Behance community](https://www.adobe.com/kr/products/creativecloud/behance-community.html)
- **Behance projects** are multi-image case studies (5–15 images) crediting tools and collaborators. — [Behance blog](https://www.behance.net/blog/how-to-get-featured-on-behance)
- **Cara** portfolio tags cover field, medium, project type and software, and Cara has a jobs board. — [Scribe mirror](https://scribe.disroot.org/post/398459)
- **ArtStation** Pro adds a portfolio website builder, unlimited uploads and print sales. — [ArtStation website builder](https://www.artstation.com/about/artists/website-builder)
- **VGen** verification is earned from activity, for example $100 in commission earnings in 30 days. — [VGen help](https://help.vgen.co/hc/en-us/articles/36331022994967)

### Inferences
- TNL's level badges already verify standing through others' actions. Adding "verified by activity" chips ("12 confirmed collabs", "40 sales delivered") fits the rules exactly, because they come from existing logs.
- Pinned works (2–3 at the top of the profile), an "Open for: collabs / commissions / work" status, and skill tags from post metadata are low-cost portfolio upgrades.

### Gaps
- Dribbble "Hire me" and Pro profile specifics were not verified for 2026.
- I could not check whether TNL already pins posts on profiles; the grep found pin logic only in boards, chat and the admin.

## Prioritized shortlist: top 10 features TNL lacks that best fit its rules

### Takeaway
Ranked by fit with rep-only-from-others, accept-to-count collabs and no ads, the strength of the evidence, and build cost on one Node/SQLite app with no new services.

### Cited Findings
1. **Timed comments on tracks** (SoundCloud). Specific critique, from others' actions. — [LabelGrid](https://help.labelgrid.com/en/platforms/soundcloud/)
2. **Fork-a-beat / fork-a-project with permanent credit** (BandLab). Extends the +4 sound-reuse rep; the original creator earns when someone forks and publishes. — [BandLab blog](https://blog.bandlab.com/forking-and-collaboration-on-bandlab-explained/)
3. **Commissions/Requests: request → accept → pay → deliver** (pixiv 390k+ requests, VGen). Two-sided like collabs, runs on Stripe Connect. — [pixiv](https://www.pixivision.net/ko/a/5847)
4. **Monthly fee-free "TNL Friday"** (Bandcamp Fridays, $154M since 2020). — [MBW](https://www.musicbusinessworldwide.com/bandcamp-fridays-hit-154m-in-payouts-since-2020-with-19m-paid-in-2025-alone)
5. **Weekly prompt event type** (Dribbble Warm-up, Inktober): a cadence-driven habit, with no rep for posting. — [Dribbble](https://dribbble.com/Dribbble)
6. **Medium, tool and role tags plus Archive filters** (Cara, Behance "tools used"). — [Behance blog](https://www.behance.net/blog/how-to-get-featured-on-behance)
7. **Beat licence tiers with an auto contract PDF** (BeatStars, $325M paid). — [MBW](https://www.musicbusinessworldwide.com/beat-marketplace-beatstars-has-paid-out-325m-to-creators-to-date/)
8. **Collaborative moodboards, invite → accept** (Are.na open channels; no likes needed). — [Adobe on Are.na](https://www.adobe.com/express/learn/blog/how-use-arena)
9. **"Open for" availability, pinned works and activity-verified chips** (Behance availability and Featured Freelancers; VGen verification). — [Behance help](https://help.behance.net/hc/en-us/articles/17285130065179)
10. **Name-your-price on digital Market items, plus buyer "supporter" notes** (Bandcamp). — [hi54.blog](https://hi54.blog/content/bandcamp-musicians-why-name-your-price-no-minimum-is-better-than-a-free-download)

Honourable mentions:
- A per-lab curated "Featured" gallery (Behance's 100+ galleries).
- A WIP / "feedback wanted" post flag (Discord forums).
- Collab posts shown in both collaborators' followers' feeds (YouTube Collaborations).

### Inferences
- Rejected for TNL: paid boosting (Depop), because it breaks no-ads and rep-only standing. Visual search (Pinterest Lens) and AI tooling, because they need external ML services. Patreon/Substack-style subscriptions, as a larger build that would need a new recurring-billing flow; Stripe supports it, so revisit it later.
- Items 2, 3, 4, 7 and 10 touch payments or uploads. CLAUDE.md requires `/security-review` on them.

### Gaps
- Effort estimates are judgement calls, not measured.
- No user research from TNL members was available to weight demand.
