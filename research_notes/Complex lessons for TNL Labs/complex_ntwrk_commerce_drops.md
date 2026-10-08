# Complex / NTWRK commerce, drops, live shopping and lessons for TNL Labs (as of October 2026)

Scope note: research done 2026-10-08. Items marked **[historical]** describe a past state that may no longer hold. Repo context comes from read-only reads of `README.md`, `src/server-06-market-stock.js`, `src/server-07-cart.js`, plus `src/server-07-orders-sharing.js` and `src/server-01-boot.js` (also read-only, to confirm how stock and rate limits behave). Nothing in the repo was edited.

---

## 1. NTWRK: founding, model, funding, the Complex acquisition and the 2024–2026 combined strategy

### Takeaway
NTWRK (founded 2018) was a "QVC/HSN for Gen Z" live-shopping and drop app built around raffle-style drops. Backers included Live Nation, Foot Locker, Goldman Sachs and Kering. In February 2024 it bought Complex from BuzzFeed for $108.6M. The NTWRK brand was then folded into **Complex Shop**, and by August 2025 the strategy centred on one Complex app, with commerce (merchant of record) and events (ComplexCon) as the main revenue lines. Levant says commerce passed $100M and that revenue doubled after the sale. I found no reports of Complex NTWRK layoffs in 2025–2026.

### Cited Findings
**Founding and model [historical, 2018–2021]**
- Aaron Levant co-founded NTWRK in 2018 with Jamie Iovine and Gaston Dominguez-Letelier and was CEO from the start. Levant had co-founded ComplexCon with Marc Ecko in 2016 — [Billboard](https://www.billboard.com/business/record-labels/complex-acquired-ntwrk-investment-universal-music-group-1235611880/); [CB Insights / Digital Music News, via search](https://www.digitalmusicnews.com/2024/02/21/ntwrk-complex-deal-universal-music-jimmy-iovine/)
- **The brief names "Elliot Kim" as a co-founder. I found no source for that.** Every source I found names Levant, Jamie Iovine and Gaston Dominguez-Letelier — [Billboard](https://www.billboard.com/business/record-labels/complex-acquired-ntwrk-investment-universal-music-group-1235611880/). Treat the Elliot Kim attribution as unverified.
- The press framed it as "the QVC for Gen Z" and "HSN for Gen Z" — [Hypebot](https://www.hypebot.com/?p=33593); [Hollywood Reporter headline](https://www.hollywoodreporter.com/news/new-venture-complexcon-founder-aims-be-hsn-gen-z-1116174) (article paywalled; only the headline was seen).
- Mechanic: at the end of an episode a random winner was picked and announced, and the winner could then buy the item. Drops were "typically raffle-style" — [eMarketer, citing Retail Dive (2021)](https://www.emarketer.com/content/livestreaming-ecommerce-takes-baby-steps-us)
- Scale [historical, 2021]: four "shopping festivals" each passed 10M views, with 250,000 active buyers in total — [eMarketer / Retail Dive](https://www.emarketer.com/content/livestreaming-ecommerce-takes-baby-steps-us); [Marketing Dive](https://www.marketingdive.com/news/ntwrks-live-shopping-festivals-highlight-the-power-of-mobile-commerce/602335/). A LeBron James sneaker drop sold out in 36 hours — [Hypebot citing Fast Company](https://www.hypebot.com/?p=33593)
- Artist drops [historical, 2020–2021]: a Takashi Murakami Black Lives Matter print drawing raised more than $1.3M in proceeds (company-reported) — [Shore Fire / NTWRK release](https://shorefire.com/releases/entry/ntwrk-second-anniversary). A FaZe Clan x Murakami merch drop ($50–$100) sold only in the app (June 2021) — [Tubefilter](https://tubefilter.com/2021/06/22/faze-clan-takashi-murakami-jerseys-mousepads/)

**Funding [historical]**
- Series A, about $10M (Sept 2019), included Live Nation and Foot Locker (Foot Locker put in $3M). Earlier backers included Main Street Advisors (whose investors include Jimmy Iovine, Drake and LeBron James) — [Global Venturing](https://globalventuring.com/corporate/ntwrk-links-to-corporates-in-50m)
- $50M (Sept 2021), led by Goldman Sachs Asset Management Growth Equity and Kering, with LionTree and Tenere Capital. A Goldman VP joined the board. The money was for team, marketing and new categories — [Tubefilter](https://tubefilter.com/2021/09/23/ntwrk-raises-50-million-goldman-sachs-kering/); [Axios](https://www.axios.com/2021/09/23/ntwrk-livestream-shopping-raises-50-million); [Retail Dive](https://www.retaildive.com/news/livestream-shopping-platform-ntwrk-raises-50m/607188/). Seedtable lists Foot Locker as lead, but those figures are estimates and conflict with the other reports — [Seedtable](https://seedtable.com/companies/ntwrk/funding-rounds/unknown-2021-09)
- Total raised: "over $100M" per a speaker bio — [SISO](https://siso.org/ceo/speakers/aaron-levant)

**Acquisition of Complex (Feb 2024)**
- NTWRK bought Complex from BuzzFeed for $108.6M in cash (announced 21 Feb 2024), less than half the roughly $300M BuzzFeed paid in 2021. Sources give $300M or $294M for the 2021 price — [Variety](https://variety.com/2024/digital/news/buzzfeed-sells-complex-ntwrk-layoffs-1235918498/); [Billboard](https://www.billboard.com/business/record-labels/complex-acquired-ntwrk-investment-universal-music-group-1235611880/); [Music Business Worldwide](https://www.musicbusinessworldwide.com/universal-music-group-acquiring-a-stake-in-complex-as-part-of-a-takeover-focused-on-superfans-and-e-commerce/)
- Investors in the deal: Main Street Advisors, Universal Music Group (strategic partner), Goldman Sachs and Jimmy Iovine. Interscope's John Janick joined the board. The stated rationale was a destination for "superfan" culture across commerce, digital media and music — [Billboard](https://www.billboard.com/business/record-labels/complex-acquired-ntwrk-investment-universal-music-group-1235611880/); [Retail TouchPoints](https://www.retailtouchpoints.com/topics/market-news/with-acquisition-of-complex-ntwrk-plans-to-create-a-next-gen-content-and-shopping-experience)
- The 16% layoffs announced with the sale were **BuzzFeed's**, not Complex's or NTWRK's — [Variety](https://variety.com/2024/digital/news/buzzfeed-sells-complex-ntwrk-layoffs-1235918498/); [Axios](https://www.axios.com/2024/02/21/buzzfeed-sells-complex)
- March 2024: NTWRK would fold into Complex over six months and anchor its commerce arm. The parent became "Complex NTWRK", and the NTWRK name would exist nowhere else. The company also bought Idea Generation, and Marc Ecko returned to the board — [Axios](https://www.axios.com/2024/03/05/ntwrk-folds-into-complex-original-execs-return)

**Combined strategy 2024–2026**
- Complex Shop launched with in-content shoppable commerce and a proprietary CMS, so shoppers buy without leaving the site. It captures shopping data, and the target was $100M in commerce. Levant: "The goal is to be a Spotify-esque experience for commerce" — [Adweek](https://www.adweek.com/media/complex-shop-commerce/). The NTWRK account said "NTWRK is now Complex Shop", offering exclusive drops and collabs with brands and artists (reported as Nov 2024; I could not confirm the date from a primary source) — [@NTWRKLIVE on X](https://x.com/NTWRKLIVE); [CB Insights listing](https://www.cbinsights.com/company/the-ntwrk). Inventory came from 100+ brands, artists and tastemakers (search summary of Adweek; the article was paywalled).
- Complex app (launched 5 Aug 2025) — [Digiday](https://digiday.com/media/inside-the-c-suite-complexs-new-app-is-the-future-of-its-business-ceo-says/):
  - It combines the site, social, Complex Shop, YouTube and event content into one app, with vertical video where you can buy what you see. Levant: "All our future-facing things will all be centered around this app."
  - Complex is merchant of record, not an affiliate. In-app average order value is 30–40% higher. Levant says the $100M commerce goal has been reached.
  - Revenue mix moved from 90% advertising and sponsorship plus 10% events to 60% events and commerce plus 40% advertising. Revenue has doubled year over year since the sale (no raw figures).
  - Planned: drops, memberships (free shipping, early access), ticketing, live shopping. Headcount was 250, of which 50 in tech. Complex has run 30+ LA pop-ups since May 2024 and opened an NYC flagship on 22 Aug 2025.
- ComplexCon Las Vegas: 70,000+ attendees (up from about 60,000), revenue above $25M (up from $22M), 360+ exhibitors. Adweek frames events as "the centerpiece" of an events + commerce + video model. The URL says 2025, but the text dates the acquisition to "last February", so the exact year is ambiguous — [Adweek](https://www.adweek.com/media/complexcon-complex-ntwrk-2025/)
- ComplexCon 2026 (10th edition) was held in LA on 3–4 Oct 2026 — [Complex](https://www.complex.com/music/a/don-steele/complexcon-2026-los-angeles-guide-what-to-know):
  - Exclusive drops came from Fragment, Wu Wear and Represent.
  - Attendees were told to use the Complex App for real-time drop notifications.
  - Playboi Carti x Mitchell & Ness jerseys were exclusive at the event and then "just dropped" on Complex online — [Complex](https://www.complex.com/style/a/oruny-choi/best-complexcon-2026-drops-fragment-playboi-carti-mitchell). This shows con exclusives moving to the owned storefront afterwards.

### Inferences
- The Complex NTWRK formula is **media (attention) → owned app (identity, notifications, data) → scarce drops and events (urgency) → merchant-of-record checkout (margin and data)**. The IRL event exclusive followed by an online drop on the owned shop is the pattern TNL can copy most directly: an event winner's piece first, then a market drop.
- NTWRK's early drops were mostly "random winner gets the right to buy". That is a draw, not first-come-first-served, and it is the same fairness device Nike later standardised.

### Gaps
- No 2026 revenue, app user counts, or Complex Shop GMV were found. The ComplexCon 2026 results were not yet published at the time of searching.
- I found no reports of Complex NTWRK layoffs in 2025–2026. That is the absence of evidence, not confirmation that none happened.
- I found no public NTWRK or Complex engineering blog. Their drop and queue tech is undocumented.
- The Elliot Kim co-founder claim is unverified, and the exact date of the Complex Shop rebrand is unconfirmed.

---

## 2. Drop mechanics, bot protection, reseller dynamics and fairness

### Takeaway
The industry moved from **first-come-first-served (FCFS)**, which bots and fast connections win, to **randomised draws and randomised queues**. The usual guards are a verified account and phone, a payment pre-authorised at entry, and one entry or one queue spot per person. The common lesson: randomise the *start* so speed stops mattering, then enforce identity limits on the server.

### Cited Findings
- **Nike SNKRS Draw:**
  - You need a Nike Member profile and a verified mobile number. Draws appear under "Upcoming" with push notifications, run for a limited window shown by a countdown, and you pick a size — [Nike help: How can I join a SNKRS Draw?](https://www.nike.com/help/a/nike-snkrs-draw); [Nike UK Draw terms](https://www.nike.com/gb/help/a/nike-launch-drawing)
  - Payment is pre-authorised at entry and charged only if you are selected. Selection is random, and results come by email within 24h — same sources.
  - Nike says the draw "was created to counter automated BOTS and ensure a level playing field". Winning does not form a contract of sale; the purchase is a separate agreement — [Nike UK terms](https://www.nike.com/gb/help/a/nike-launch-drawing)
  - Draw variants (third-party): "DAN" is a roughly 10-minute entry window; "LEO" notifies within 2–3 minutes — [Sole Retriever](https://www.soleretriever.com/news/articles/how-snkrs-draws-work)
  - SNKRS Pass (reserve to buy in-store) moved from FCFS to random selection with bot filtering — [Input](https://www.inputmag.com/style/nike-snkrs-pass-draw-raffle-updates-changes-bots-first-come-first-serve-lottery); [Nike: SNKRS Pass](https://www.nike.com/fi/help/a/nike-snkrs-pass)
- **END. Launches:** a bespoke raffle that is easy to enter. It needs individual accounts, which mostly stops mass entry, though people can still enter manually multiple times or with scripts (undated review) — [Sole Retriever](https://www.soleretriever.com/news/articles/end-raffle-review)
- **Supreme [historical, 2015]:** banned bots and blocked IPs based on how often they polled the site — [FashionNetwork](https://us.fashionnetwork.com/news/Supreme-bans-online-shopping-bots,546867.html). I found no current primary description of Supreme's web-drop mechanics.
- **Kith:** no primary source found (gap).
- **Why raffles:** they remove the race to get in line first, where bots and connection speed decide the outcome — [Queue-it blog](https://queue-it.com/blog/online-sneaker-raffle-issues/)
- **Queue-it scheduled waiting room** (vendor claims):
  - Early arrivals wait on a countdown page. At start they get a **random queue position**, and anyone arriving later is FIFO at the back. This "restricts the speed advantage bots have".
  - Supporting controls: one queue spot per visitor, IP binding, invite-only rooms with 2FA, and checking on the server (by API) before checkout that the visitor passed the queue. Queue-it warns that a client-side-only integration can be skipped by editing the JS.
  - In spike-triggered (safety-net) mode it is plain FIFO.
  - Sources: [Queue-it: Bots & abuse management](https://queue-it.com/developers/bots-abuse-management/); [Queue-it: Scheduled](https://queue-it.com/product/scheduled/); [Queue-it: How it works](https://www.queue-it.com/how-does-queue-it-work/)
  - Queue-it and Akamai launched "Hype Event Protection" in Oct 2025 — [Nasdaq press release](https://www.nasdaq.com/press-release/queue-it-akamai-launch-hype-event-protection-stop-bots-hijacking-high-demand-sales)
- **Shopify:**
  - Bot protection (Plus only) is scheduled for up to 60 minutes and covers the Online Store channel only. It blocks known bots and slows bot checkouts — [Shopify help, via search](https://help.shopify.com/c/technical-q-a/bd-p/technical-qa)
  - Shopify also offered merchant-set "skill testing" challenge questions at checkout via hCaptcha (vendor case study) — [hCaptcha](https://www.hcaptcha.com/post/why-ecommerce-leader-shopify-uses-hcaptcha)
  - Load-balancer bot detection: bots act as headless browsers, rotate user agents and mimic humans, and "misclassification isn't an option" — [O'Reilly Velocity 2017 abstract](https://conferences.oreilly.com/velocity/vl-ny-2017/public/schedule/detail/61655)
- **Waiting-room vendor practice:** cancel and refund orders that bypassed the queue — [CrowdHandler guide](https://www.crowdhandler.com/docs/80001187610-complete-guide-planning-and-executing-a-flash-sale-on-shopify-using-crowdhandler)
- **Law on bots:** the Stopping Grinch Bots Act would let the FTC treat retail purchase bots as unfair practices. It is modelled on the 2016 BOTS Act (tickets) and was reintroduced in 2021. I found no evidence it was enacted — [Sneaker Freaker](https://www.sneakerfreaker.com/news/stopping-grinch-bots-bill-law-sneakers); [SC Magazine](https://www.scmagazine.com/news/proposed-law-would-outlaw-grinch-bots-that-snatch-up-toys-for-resale)
- **Resale platforms:** Nike sued StockX in Feb 2022 (NFTs, then counterfeits). The court found StockX liable for 37 counterfeit pairs, and the parties settled and dismissed the case on 29 Aug 2025, before trial — [The Fashion Law](https://www.thefashionlaw.com/nike-v-stockx-a-timeline-behind-the-trademark-lawsuit/); [Bloomberg Law](https://news.bloomberglaw.com/ip-law/nike-stockx-settle-nft-counterfeiting-lawsuit-ahead-of-trial)
- **Inventory reservation (Stripe):**
  - Checkout `expires_at` must be between 30 minutes and 24h after creation (default 24h).
  - The `checkout.session.expired` webhook should return reserved stock.
  - Sessions can be expired early through the API.
  - One customer may abandon several sessions, each firing its own event, so the release must be idempotent.
  - Sources: [Stripe: Manage limited inventory](https://docs.stripe.com/payments/checkout/managing-limited-inventory); [Stripe API: expire a session](https://docs.stripe.com/api/checkout/sessions/expire?lang=node); [Stripe: abandoned carts](https://stripe.com/en-ee/docs/payments/checkout/abandoned-carts)

### Inferences
- Fairness *perception* depends on visible rules: a published entry window, random selection, one entry per person, and when results land. Nike states all of these in its help and terms. Pre-authorising payment at entry filters out non-serious and throwaway entries cheaply.
- Randomising entry order only works if identity is limited (one account = one human). Account-gated raffles such as END. still leak to multi-accounting, so account age, verified email or phone and payment-card dedupe are the real controls.
- I found no reliable figures on bot share or resale markups in this pass. Reseller dynamics are summarised here only through the lawsuit and law-on-bots items.

### Gaps
- No primary sources were found for Kith or Supreme's current mechanics, or for StockX/GOAT resale-premium data.
- The full Nike rules on per-person or per-address limits were not retrieved.

---

## 3. Live shopping in the US: NTWRK, Whatnot, TikTok Shop LIVE, mechanics and culture

### Takeaway
US live shopping is now dominated by **Whatnot**, which is auction-led: $8B+ GMV in 2025, a $20B valuation in Aug 2026, and an 8% headline commission. It grew from collectibles and cards. **TikTok Shop LIVE** is growing fast. Amazon Live still runs but draws weak audiences. NTWRK's QVC-style, editorial live-shopping model was absorbed into Complex rather than scaled on its own.

### Cited Findings
- **Whatnot funding:**
  - Series E: $265M at a $5B valuation (Jan 2025).
  - Series F: $225M at $11.5B (Oct 2025, DST Global and CapitalG).
  - Series G: **$545M at $20B** (7 Aug 2026; ICONIQ, Lightspeed, Avra).
  - It is not yet profitable, per CEO Grant LaFontaine.
  - Sources: [Business of Fashion](https://www.businessoffashion.com/news/retail/whatnot-secures-115-billion-valuation/); [Tubefilter (Aug 2026)](https://www.tubefilter.com/2026/08/07/whatnot-series-g-funding-round-545-million-live-shopping/); [Value Added Resource](https://www.valueaddedresource.net/whatnot-20-billion-valuation/)
- **Whatnot GMV:** more than $3B in 2024 and more than **$8B in 2025**, roughly double. 2025 growth by category: beauty +791%, electronics +444%, jewellery +259%, women's fashion +223% — [Value Added Resource](https://www.valueaddedresource.net/whatnot-3-billion-2024-gmv-raises-funding/); [Ebrun (company report)](https://english.ebrun.com/20260211/640428.shtml)
- **Whatnot fees:** 8% commission in most categories (5% electronics, 4% coins up to $1,500) plus processing of 2.9% + $0.30 — [Whatnot help: seller fees](https://help.whatnot.com/hc/en-us/articles/4847069165965-Whatnot-seller-fees); [Crosslist](https://crosslist.com/blog/whatnot-fees-for-sellers). Whatnot told the WSJ it takes about 6%. One analysis argues the effective take on small orders is 11–14% — [Business Model Analyst](https://businessmodelanalyst.com/whatnot-take-rate-live-shopping/). Sacra cites a 12.5% headline take including ads — [Sacra](https://sacra.com/c/whatnot/)
- **Mechanics:**
  - "Sudden death" auctions add no extra time for late bids: a bid before zero counts, and one after zero doesn't. Guides disagree on whether this applies only to the final 10 seconds; it is marked with a skull icon.
  - Live-extend adds seconds for late bids and is preferred for rare items.
  - Sources (third-party): [Racklify](https://racklify.com/encyclopedia/whatnot-sudden-death-vs-live-extend-auctions/); [Closo](https://closo.co/blogs/platform-specific-guides/inside-the-whatnot-seller-hub-a-survival-guide-for-live-auctions-in-2026)
  - Poshmark copied sudden death for Posh Shows — [Value Added Resource](https://valueaddedresource.net/poshmark-sudden-death-posh-shows)
  - Health commentary flags compulsive-bidding risk on fast auctions — [Birches Health](https://bircheshealth.com/resources/whatnot-auctions-addiction)
- **TikTok Shop LIVE:** US TikTok Shop sales were up 120% year over year in early 2025, and there were 8M+ hours of US LIVE shopping in 2024 (company figures) — [TikTok Newsroom](https://newsroom.tiktok.com/en-us/tiktok-shop-is-where-shoppers-come-to-discover). Sales from US small businesses rose 66% in 2025 — [Modern Retail](https://www.modernretail.co/operations/tiktok-shop-says-sales-from-u-s-small-businesses-climbed-66-in-2025/)
- **Amazon Live:**
  - [historical, ~2022] fewer than 1,000 active viewers on a typical day — [Marketplace Pulse](https://www.marketplacepulse.com/articles/amazon-live-is-embarrassing)
  - Oct 2026: Twitch launched a Shopping category with Amazon Live hosts during Prime Big Deal Days — [Tubefilter](https://tubefilter.com/2026/10/06/twitch-has-streaming-deals-in-its-new-shopping-category)
  - Day-one viewing was thin (six streamers, 65 viewers combined, a single social post) — [Zach Bussey on X](https://x.com/zachbussey/status/2107474518839091609)
- **NTWRK live [historical]:** shopping "festivals" with 10M+ views each and a random winner at the end of an episode — [eMarketer](https://www.emarketer.com/content/livestreaming-ecommerce-takes-baby-steps-us)

### Inferences
- Live shopping works where **items are unique or graded, price discovery is fun (auctions), and a host community already exists**: cards, collectibles, sneakers. In those categories the stream *is* the entertainment, and scarcity is real per item. QVC-style live selling of commodity goods (Amazon Live) lacks that tension. Whatnot's 2025 spread into beauty and fashion suggests the host-community model can travel once a buyer base exists.
- For a small creative app, the transferable parts are **timed scarcity, a host with a following, and a live chat or inventory counter**. Live video is not required.

### Gaps
- I found no primary data on why NTWRK's standalone live show format was retired, beyond the fold-in into Complex.
- No official Whatnot help page on sudden death was retrieved.

---

## 4. Engineering signals: handling spikes, queues, idempotent checkout, reservations, live counts

### Takeaway
Public engineering material is thin for Whatnot and NTWRK. Shopify's posts are the best documented. Flash sales produce write-heavy bursts of about 4–5x baseline. Shopify first throttled checkout in Nginx/Lua at the edge, found that "queue by random polling" was really a lottery, fixed fairness with first-attempt timestamps, and later moved the throttle into the application tier where it knows about stock. Stripe's documented pattern for limited stock is to reserve, expire the session, and release on the webhook.

### Cited Findings
- **Shopify:**
  - Flash sales produce write-heavy traffic of about 4x baseline. Always-on capacity for that was "not financially sound", so Shopify added queueing and page caching in its Nginx load balancers — [SREcon16 talk](https://usenix.org/conference/srecon16europe/program/presentation/stolarsky)
  - Checkout throttle written in Nginx + Lua (Part I) — [Shopify Engineering](https://engineering.shopify.com/surviving-flashes-of-high-write-traffic-using-scriptable-load-balancers-part-i)
  - Problem: shoppers waited up to 40 minutes in a 40-minute sale because "the queue" was random-interval polling, which is effectively a lottery — same source.
  - Fix: rank by the timestamp of each customer's first checkout attempt. Variance dropped and complaints stopped — [Part II](https://shopify.engineering/surviving-flashes-of-high-write-traffic-using-scriptable-load-balancers-part-ii)
  - 2022: the edge throttle handled bursts up to 5x but was hard to test, could throttle unevenly across load balancers, and could leave people waiting for carts that were already out of stock. Shopify moved it into the Rails application tier where business logic lives — [Strange Loop 2022 (abstract)](https://thestrangeloop.com/2022/a-commerce-centric-approach-to-queuing-fairly-at-high-throughput.html)
- **Whatnot:** Elixir powers its "real time auctions, chat, notification and other real-time features" — [Whatnot job post on ElixirForum](https://elixirforum.com/t/senior-elixir-engineer-whatnot-remote-usa-remote-europe/70232). There was a 2021 talk, "Running real-time auctions in Elixir" (Alex Loukissas) — [Elixir Wizards Conference](https://smartlogic.io/about/community/elixir-wizards-conference/); [ThinkingElixir 051](https://elixirforum.com/t/podcast-thinkingelixir-051-live-auctions-with-alex-loukissas/40303). I did not review the contents of either.
- **Queue-it:** validate on the server that the visitor passed the queue before checkout. Client-side integration can be bypassed. The waiting room sits alongside WAF, rate limiting and bot detection — [Queue-it developers](https://queue-it.com/developers/bots-abuse-management/)
- **Stripe:**
  - Reserve on session create, with `expires_at` between 30 minutes and 24h.
  - Release on `checkout.session.expired`, with an idempotent handler.
  - A shorter hold needs your own timer plus the expire endpoint. This is inferred from the docs, not stated in them.
  - A community guide suggests re-checking stock on `checkout.session.completed` and refunding if it is short.
  - Sources: [Stripe: Manage limited inventory](https://docs.stripe.com/payments/checkout/managing-limited-inventory); [Stripe API: expire](https://docs.stripe.com/api/checkout/sessions/expire?lang=node)

### Inferences
- The industry pattern is **pre-warm or cache the static pages, admit people at a controlled rate (queue or throttle), reserve stock atomically with a TTL, make checkout creation idempotent, and push live counts to clients** (websockets or SSE). Shopify's own lesson is that the throttle should know about stock, so people stop queuing for sold-out items.
- At TNL's scale (one Node process, SQLite), a *drop* is a small spike. The real risks are **oversell and unfairness, not capacity**. TNL already has the pieces: SSE, the `rateLimit` middleware and `BEGIN` transactions.

### Gaps
- I found no public Nike, NTWRK or Whatnot engineering posts with concrete reservation or queue architecture, and no public material on websocket-based live inventory counts from these companies.

---

## 5. Lessons for TNL Labs: Drop listings, live sessions, event tie-ins, anti-bot rules and fairness (with sketches)

### Takeaway
TNL's market already funnels every unit through `takeStock()`, but **stock is taken only when payment lands, not at checkout**. The code says so directly: "Stock isn't reserved at checkout, so two buyers can pay for the last unit" — `src/server-07-orders-sharing.js` `settlePaidOrder()`, which then sends the seller an "OVERSOLD … refund it" notice. For a hype drop that is the main thing to fix. A Drop listing type needs: reserve-on-checkout with a TTL, a per-person limit, a scheduled start with a randomised admission window, an optional free-entry draw mode for very scarce items, and SSE stock counts. All of this fits in SQLite and plain JS **[no new dep]**. Payment-path changes need `/security-review`. A paid-entry raffle is legally risky; a free-entry "right to buy" draw is the safer form.

### Cited Findings (repo facts, read-only)
- `takeStock(listingId, variantId)` decrements a variant or quantity and closes the listing at zero. Both the arrange path and the paid path call it (`src/server-06-market-stock.js`; the README describes `server-06-market-stock`).
- `/api/cart/checkout`:
  - is guarded by `auth`, `verified` and `rateLimit({max:20, windowMs:3600000, key:"user"})`;
  - allows one seller per checkout;
  - inserts `orders` rows in a `BEGIN/COMMIT`;
  - creates a Stripe Checkout session;
  - takes stock immediately only in the no-payments "arrange" path (`src/server-07-cart.js`).
- `rateLimit` is an in-memory sliding window keyed by route plus user or `cf-connecting-ip` (`src/server-01-boot.js`). That is fine for one process; it resets on deploy.
- Existing pieces to reuse:
  - SSE live updates, the price-drop tag and save notifications (`priceChanged()` notifies savers).
  - Events with `tickEvent()` as the only state mover (per-minute tick), Instagram Story cards, and `require_verified` voters.
  - The rule against adding dependencies without asking (CLAUDE.md, README).
- External basis for each lesson: Nike draw (verified member and phone, pre-auth, random selection, published rules), Queue-it (random position at start, then FIFO; server-side validation), Shopify (fairness by first-attempt timestamp; a throttle that knows stock), Stripe (reserve, expire, release idempotently) — sources in sections 2 and 4.

### Inferences and implementation sketches

**A. "Drop" listing type: schedule, countdown, per-person limit [no new dep]**
- Add columns to `listings` in a migration in `src/db.js`. The listing is hidden from buying until `drop_at`. The countdown is client-side from the server's `drop_at`, and the server clock is the judge.
- Notify savers ("Notify me") at T-15m and T-0, reusing the `listing_likes` and `notify()` path the price-drop feature already uses.

```sql
ALTER TABLE listings ADD COLUMN drop_at INTEGER;          -- ms epoch; NULL = normal listing
ALTER TABLE listings ADD COLUMN drop_mode TEXT;           -- 'fcfs' | 'draw'
ALTER TABLE listings ADD COLUMN per_person INTEGER DEFAULT 1;
ALTER TABLE listings ADD COLUMN draw_close_at INTEGER;    -- draw mode: entry window end
```

**B. Reserve-on-checkout with a TTL (fixes oversell for every listing, not just drops) [no new dep, payment path → /security-review]**

```sql
CREATE TABLE IF NOT EXISTS reservations (
  id INTEGER PRIMARY KEY, listing_id INTEGER NOT NULL, variant_id TEXT DEFAULT '',
  user_id INTEGER NOT NULL, cart_id INTEGER, qty INTEGER NOT NULL DEFAULT 1,
  expires_at INTEGER NOT NULL, state TEXT NOT NULL DEFAULT 'held'  -- held|done|released
);
CREATE INDEX IF NOT EXISTS res_live ON reservations(listing_id, variant_id, state, expires_at);
```

```js
// available = stock − live holds. Runs inside BEGIN IMMEDIATE so two checkouts serialise
// (node:sqlite is synchronous; one process → a write lock is enough).
function reserve(l, v, userId, cartId, ttlMs = 31 * 60e3) {   // ≥ Stripe's 30-min floor
  const now = Date.now();
  const held = db.prepare(`SELECT COALESCE(SUM(qty),0) n FROM reservations
    WHERE listing_id=? AND variant_id=? AND state='held' AND expires_at>?`).get(l.id, v?.id || "", now).n;
  const stock = v ? v.qty : (l.quantity ?? 1);
  if (stock - held < 1) return false;
  db.prepare(`INSERT INTO reservations (listing_id,variant_id,user_id,cart_id,expires_at) VALUES (?,?,?,?,?)`)
    .run(l.id, v?.id || "", userId, cartId, now + ttlMs);
  return true;
}
```

- Pass `expires_at: now + 31 min` to Stripe session creation.
- On `checkout.session.completed`, call `takeStock()` and mark the hold `done`.
- On `checkout.session.expired`, or the minute sweeper (`UPDATE … SET state='released' WHERE state='held' AND expires_at<?`), release it. `WHERE state='held'` makes the release idempotent, as Stripe advises.
- Keep the existing OVERSOLD notice as a last-resort backstop.

**C. Per-person limits and anti-bot rules feasible in SQLite/JS [no new dep]**
- **One per person per drop:** `UNIQUE(listing_id, user_id)` on a `drop_entries` table, plus a count of the user's paid orders and live holds against `per_person`.
- **Account gates:** a confirmed email (the existing `verified` middleware), a minimum account age (e.g. created ≥ 7 days before `drop_at`), and optionally minimum rep. Admin → Settings already has "minimum rep to sell", so a "minimum rep/age to enter drops" setting fits the same model.
- **Dedupe signals at settle:** the same shipping address or the same Stripe card fingerprint across accounts gets flagged for the seller or admin, not auto-cancelled. Card fingerprint needs the Stripe API, which is an existing service, not a new one; it touches payments → security review.
- **Rate limits:** wrap drop routes in `rateLimit({max:5, windowMs:60e3, key:"user"})` plus an IP limit. The limiter is in-memory, which is acceptable for one Railway instance.
- **Randomised admission (Queue-it style, server-side):**
  - Everyone who taps "In" between T-10m and T+60s gets a random rank (`crypto.randomInt`). After that, FIFO.
  - Checkout is admitted only to ranks ≤ an admitted counter that the minute tick (or a short interval) raises as holds clear.
  - Validate the admission on the server at `/api/cart/checkout`, as Queue-it warns.
- **No CAPTCHA vendor:** that would be a [new service]. A cheap substitute is a seller-set "skill question" like Shopify/hCaptcha's challenge question, but it is weak against scripted bots.

**D. Draw mode for scarce items (Nike-style "right to buy") [no new dep; legal review]**

```js
// At draw_close_at, inside tickEvent-like ticker: pick winners with a seeded, auditable shuffle.
const seed = randomBytes(16).toString("hex");            // stored, revealed after the draw
const entries = db.prepare(`SELECT user_id FROM drop_entries WHERE listing_id=? ORDER BY user_id`).all(id);
// Fisher–Yates with HMAC(seed, i) → winners = first `stock` entries; write seed + hash(entries) to the listing.
```

- Publish `sha256(seed)` when entry opens and reveal the seed after the draw (commit-reveal), so anyone can check the result. Winners get a reservation (B) with a 24h TTL; unclaimed units go to the next names on the list.
- **Legal:** a lottery is generally prize + chance + consideration. Keep entry **free**: no paid bonus entries, and free entry gives the same odds as paid. Publish official rules — [SC AG opinion](https://www.scag.gov/media/eh4am52z/03031855.pdf); [CA AG opinion 98-1101](https://www.oag.ca.gov/system/files/opinions/pdfs/98-1101.pdf); [Colorado Biz](https://coloradobiz.com/you-may-already-be-a-winner/)
- A draw for the *right to buy at a fair price* (Nike's model, "no contract of sale" on winning) is the common industry form, but I found no ruling confirming it falls outside lottery law. **Get a lawyer's review before launch.** Do not pre-authorise cards at entry: that adds payment complexity, and it could be argued to be consideration.

**E. Live listening/selling sessions in labs [no new dep]**
- A scheduled "session" with a host (an artist premiering a track, then dropping merch or beats), driven by the existing SSE stream: live chat, a live "N left" counter pushed on every reserve or release, and a "drop goes live now" moment.
- Whatnot-style sudden-death auctions should come later. They need bid ordering under contention, which SQLite plus a single process can serialise, but auctions on unique items also need careful dispute and payment-capture rules → security review.
- The host and community are the engine, so seed sessions with top-rep members.

**F. Tie drops to events [no new dep]**
- Complex's pattern: an event exclusive, then the online drop on the owned shop (ComplexCon 2026 → Complex).
- For TNL: when `tickEvent()` reaches `results`, offer the winner a one-tap "winner's drop" (a pre-filled Drop listing, admin-approved) announced in the results notification and on the Instagram results card, which leads back to `/m/:id`.
- Rep rules hold: sales already award `sale_made` from other people's purchases, so nothing is self-awarded.

**G. Fairness and transparency checklist**
- Show the rules on every drop: start time, mode (FCFS or draw), per-person limit, hold length, and how winners are picked.
- Show live "N left", and say "held" vs "sold".
- After the drop, show the number of entries or admissions, units sold, and the draw seed and hash.
- Name the oversell policy, and never ship "air".

**Tags summary:** Drop type, reservations, limits, random admission, draw, SSE counters, event tie-in → **[no new dep]**. CAPTCHA, waiting-room vendor, phone verification (SMS) → **[new service]**. Any change to checkout, webhooks or card data → `/security-review`. Raffles → legal review (no-purchase-necessary rules vary by state).

### Gaps
- I could not confirm whether TNL's Stripe webhook already handles `checkout.session.expired`. I read only the files listed above; check `src/pay.js` before building B.
- I found no legal source specific to "draw for the right to buy" sneaker raffles.
- I found no public data on the bot share of drop traffic for small platforms, so the anti-bot design above is proportionate guesswork for TNL's scale.
