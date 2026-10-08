# Depop: business model, trust & safety, engineering, and lessons for TNL Labs (as of 8 Oct 2026)

> Scope note: the fee comparison table and rep-integrity ideas in `reports/Instagram lessons for TNL Labs.md` and `research_notes/Instagram features and backend/integrity_antiabuse.md` are not repeated here. **The biggest change since that research: Etsy sold Depop to eBay. The deal was agreed 15 Feb 2026 and closed 30 Jul 2026.** Depop is now an eBay business and is reported as discontinued operations in Etsy's 2026 filings.

## 1. Business: history, scale, money, fee change, Vinted, owner plans

### Takeaway
Depop grew fast in 2024–26: GMS went from about $789M (2024) to $1.07B (2025), and Q2 2026 GMS was +83% year on year. Most of that came after Depop **moved its 10% seller fee to a buyer "marketplace fee" (up to 5% + $1/£1)** and put heavy brand spend into the US. But it lost money ($196M pre-tax loss in H1 2026, mostly from brand investment). Etsy sold it to eBay for $1.2B list price, about $1.4B after adjustments, against the ~$1.6B it paid in 2021. Vinted shows the buyer-fee model can be profitable at scale: €1.1B revenue and €62M net profit in 2025.

### Cited Findings
**History and ownership**
- Simon Beckerman founded Depop in 2011 at the Italian incubator H-Farm. It grew out of PIG, the fashion magazine he co-founded, and was pitched as an online flea market. HQ moved to London in 2012. Funding: $8M from Balderton/HV Capital (2015), then a $62M Series C led by General Atlantic (June 2019). 2020 GMS was $650M and revenue $70M, both more than double 2019 — [Wikipedia: Depop](https://en.wikipedia.org/wiki/Depop); [General Atlantic](https://www.generalatlantic.com/media-article/depop-raises-62-million-series-c-to-meet-rising-demand-from-us-gen-z/)
- Etsy bought Depop in June 2021 for about $1.6B in cash. CEOs: Maria Raga (2016–22), Kruti Patel Goyal (2022–25, previously Etsy CPO), then Peter Semple (former CMO) from 1 Aug 2025 — [Wikipedia](https://en.wikipedia.org/wiki/Depop); [Glossy](https://www.glossy.co/podcasts/ceo-kruti-patel-goyal-on-bringing-depop-to-a-bigger-broader-audience-in-more-places/)
- On 15 Feb 2026, Etsy agreed to sell Depop to eBay "for $1.2 billion in cash, subject to certain adjustments". Proceeds go to buybacks and the core Etsy marketplace — [Etsy FY2025 10-K](https://www.sec.gov/Archives/edgar/data/1370637/000137063726000019/etsy-20251231.htm)
- The sale closed on 30 Jul 2026 for about $1.4B in cash ($1.2B plus about $200M of net price adjustments and interest). Etsy says Depop investments made before closing were recovered through those adjustments. The proceeds "further accelerate our stock buyback program" — [Etsy Q2 2026 shareholder letter (8-K)](https://www.sec.gov/Archives/edgar/data/0001370637/000137063726000079/q226shareholderletter.htm); [FashionUnited](https://fashionunited.com/news/business/ebay-completes-1-4-billion-dollar-depop-acquisition/2026073073828)
- The UK CMA approved the deal before it closed — [Wikipedia](https://en.wikipedia.org/wiki/Depop)
- eBay's plan: Depop "will run as a separate business" and keep its brand, platform and culture. eBay will look for synergies in shipping, compliance, personalization and "trusted services". eBay fashion already does more than $10B GMV a year — [Shopifreaks](https://www.shopifreaks.com/ebay-closes-its-1-4b-depop-acquisition-and-says-the-resale-marketplace-will-keep-its-own-brand-platform-and-culture/)

**Users and GMS**
- At 31 Dec 2025: about 55.6M registered users, 7.0M active buyers (+37.7%) and 3.2M active sellers (+41.1%). US active sellers grew 60%, global sign-ups grew 46%, 93% of GMS was apparel, 74% came from US buyers, 92% was transacted in the app, and 87% of buyers were under 34. **About 59% of sellers who made a sale in 2025 also bought something.** Depop had about 475 employees (about 400 in 2024) — [Etsy FY2025 10-K](https://www.sec.gov/Archives/edgar/data/1370637/000137063726000019/etsy-20251231.htm); [Etsy Q4 2025 release](https://investors.etsy.com/_assets/_fea57334fe81a735b34cf3bf4bdcb553/etsy/db/938/10062/earnings_release/Exhibit+99.1+12.31.2025.pdf)
- 35M users in 2023, up 17% — [Glossy](https://www.glossy.co/podcasts/ceo-kruti-patel-goyal-on-bringing-depop-to-a-bigger-broader-audience-in-more-places/)
- GMS by year:
  - 2024: about $788.9M (+32%). US GMS grew about 60%, and Q4 2024 was Depop's strongest growth quarter under Etsy — [Digital Commerce 360](https://www.digitalcommerce360.com/2025/02/21/etsy-gms-sales-q4-2024/)
  - 2025: $1,074.9M (+36.3%, 9% of Etsy's consolidated GMS). Q4 2025: $299.7M (+37.2% currency-neutral), with US buyer GMS +60.2% on Depop's "largest-ever brand marketing campaign" in the US — [Etsy FY2025 10-K](https://www.sec.gov/Archives/edgar/data/1370637/000137063726000019/etsy-20251231.htm); [Etsy Q4 2025 release](https://investors.etsy.com/_assets/_fea57334fe81a735b34cf3bf4bdcb553/etsy/db/938/10062/earnings_release/Exhibit+99.1+12.31.2025.pdf)
  - Q2 2026: $455.7M vs $249.6M in Q2 2025 (+83%). H1 2026: $804.6M vs $483.1M. Q2 2026 revenue was +76% year on year (dollar figure not given in the letter) — [Etsy Q2 2026 letter](https://www.sec.gov/Archives/edgar/data/0001370637/000137063726000079/q226shareholderletter.htm)
- 2023 GMS is about $598M (**estimate**: 2024's $788.9M ÷ 1.32).

**Losses**
- Pre-tax loss from Depop as discontinued operations:
  - Q2 2026: $160.8M (Q2 2025: $17.8M)
  - H1 2026: $196.6M (H1 2025: $36.5M)
  - H1 2026 operating cash burn: $147.1M (H1 2025: $11.5M)
  - Source: [Etsy Q2 2026 letter](https://www.sec.gov/Archives/edgar/data/0001370637/000137063726000079/q226shareholderletter.htm)
- Etsy started an "incremental brand investment" in Depop in H2 2025 to grow its US audience — [Etsy FY2025 10-K](https://www.sec.gov/Archives/edgar/data/1370637/000137063726000019/etsy-20251231.htm)

**Fees: before and after**
- **Before 2024:** every Depop seller paid a 10% transaction fee. In 2024, Depop removed seller transaction fees in the UK and US and introduced a buyer fee — [Etsy FY2024 10-K](https://www.sec.gov/Archives/edgar/data/1370637/000137063725000017/etsy-20241231.htm)
- **UK:** from 20 Mar 2024, new UK listings pay no 10% selling fee. From 15 Apr 2024, buyers pay up to 5% of the item price plus up to £1. Processing is 2.9% + 30p on the total — [Depop newsroom (UK)](https://news.depop.com/evolving-our-fee-structure-with-zero-selling-fees-on-depop/); [Value Added Resource](https://www.valueaddedresource.net/depop-drops-seller-fee-in-uk-shifts-fee-burden-to-buyers/)
- **US:** the change was announced 15 Jul 2024, and the buyer fee started 18 Jul 2024. Buyers pay up to 5% of the item price plus up to $1, excluding tax and postage. Depop's stated reasons: sellers keep more, buyers get better value, and more people try selling. The fee "will support continued investment… including in Depop Protection, customer support". Goyal: "We want to invite as many people as possible into Depop's circular fashion community" — [Depop newsroom (US)](https://news.depop.com/depop-removes-selling-fees-in-the-united-states-evolves-fee-structure/); [Depop blog](https://blog.depop.com/articles/us-depop-fee-change)
- US processing is 3.3% + $0.45 on the total including shipping and tax. The fixed buyer fee is charged once per seller bundle — [Vendoo](https://blog.vendoo.co/how-much-does-depop-take-depop-fees-guide-for-sellers); [Money](https://money.com/depop-seller-fee-eliminated/?amp=true)
- **Australia:** seller fees removed 22 Jul 2026, with a buyer fee of up to 5% + A$1. **Depop Payments is "powered by Stripe"** at 2.6% + A$0.30 — [Value Added Resource](https://www.valueaddedresource.net/depop-drops-seller-fees-australia/)
- **Result Depop claims:** removing selling fees in the UK and US led to "a 30% to 45% increase in listings in the 28 days after those changes" — [Value Added Resource](https://www.valueaddedresource.net/depop-drops-seller-fees-australia/)
- **Boosted listings:** sellers pay only when a boosted item sells. Reported rates are 8% (US/AU) and 12% (UK), but sources disagree on the UK rate — [Closo 2026 guide](https://closo.co/blogs/fees/the-real-cost-of-business-breaking-down-depop-selling-fees-in-2025); [Vendoo UK](https://uk.blog.vendoo.co/guide-to-depop-fees-for-uk-sellers-buyers)
- **Seller pushback:** commentators warned that a visible buyer fee could push list prices down and squeeze seller margins — [Money](https://money.com/depop-seller-fee-eliminated/?amp=true)
- In 2024, Depop's GMS growth partly offset Etsy's fall in transaction revenue. Etsy's shipping-label revenue rose 14.8%, "primarily due to" Depop — [Etsy FY2024 10-K via DC360](https://www.digitalcommerce360.com/2025/02/21/etsy-gms-sales-q4-2024/)
- Mercari had made a similar seller-fee-to-buyer move in the US earlier in 2024 — [Depop/ChannelX coverage](https://channelx.world/2024/07/depop-removes-selling-fees-in-the-united-states/)

**Vinted**
- 2025: revenue about €1.1B (+38%), GMV €10.8B (+47%), net profit €62M (down from €77M), adjusted EBITDA €151M (−5%), free cash flow €137M (+36%) — [FashionUnited](https://fashionunited.com/news/business/vinted-reaches-1-1-billion-euros-in-revenue-for-2025-accepting-a-strategic-drop-in-profits/2026040971654); [HL/Sharecast](https://www.hl.co.uk/shares/stock-market-news/company--news/vinted-reports-strong-revenue-growth,-profits-decline)
- Profit fell because of deliberate investment: the Germany turnaround, new categories, in-house shipping in Spain and Portugal, and Vinted Pay. — same sources
- Business model: no seller commission. Buyers pay a buyer-protection fee of about 3–8% of the price plus a fixed part (about $0.70 in the US; £0.30–0.80 plus 3–8% in the UK; varies by market). The fee is non-refundable even on returns. Other revenue: paid "bumps", wardrobe spotlight, Pro subscriptions, shipping (Vinted Go) and ads. Fee levels come from secondary blogs — [Vendoo](https://blog.vendoo.co/vinted-fees-learn-everything-theres-to-know); [Sharetribe](https://www.sharetribe.com/how-to-build/how-does-vinted-make-money/)

### Inferences
- **Take rate (estimate):** a buyer fee of up to 5% + $1 on an average item of about $25–40 works out to roughly 7.5–9% of item value. Boosts add about 8% on some sales, and processing is mostly passed through to Stripe. Depop's take rate is therefore probably about 8–11% of GMS, similar to the old 10% seller fee. **The fee change mostly moved who sees the fee rather than cutting it.** Unverified: Depop's revenue in dollars is not public in what I found.
- Depop's growth in 2025–26 was "bought". GMS rose 83%, but losses grew about 9× in the same quarter. That gap probably shaped Etsy's decision to sell at a $200–400M write-down and to stop funding a loss-making second marketplace.
- Vinted, ten times Depop's GMV, shows a buyer-protection-fee model can be profitable. The fee is framed as *paying for protection*, not as a commission.

### Gaps
- Depop revenue in dollars for 2022–2025 and its exact take rate were not found. They should be in the discontinued-operations note of the 10-K (Item 8) and in the Q2 2026 10-Q, which I could not read in full.
- No public data on how much of Depop revenue comes from Boost.
- No 2022–2023 Depop GMS from a primary source.
- eBay's post-close plans for Depop fees are unknown, as is whether eBay's authenticity guarantee will be extended to Depop.

## 2. Trust & safety

### Takeaway
Depop's protection is simple: **buyers are protected only if they pay through Depop Payments.** Buyers get a full refund (item, shipping, fees and tax) for items that don't arrive, arrive damaged, or are significantly not as described, if reported within 30 days. Sellers are protected when they use tracked shipping. Depop has no formal authentication step. It relies on ML (a "Trust Detection" team) plus community reports for fakes, phishing and prohibited items. Its well-known failures were off-platform payment scams and a 2020 credential/phishing episode.

### Cited Findings
**Buyer and seller protection**
- **Depop Protection (UK/US/AU) requires** buying in the Depop app or website, paying with Depop Payments (card, Apple Pay, Google Pay, Klarna), and checking out on Depop. Buyers get a full refund for items that are not received, damaged, or "significantly not as described" if they report within **30 days of purchase**. Coverage includes shipping, fees, tax and duties — [Depop Help: Protection for buyers](https://depophelp.zendesk.com/hc/en-gb/articles/360038461713-Depop-Protection-for-buyers)
- **Exclusions:** PayPal/Venmo/bank transfer payments and in-person meetups are not covered. Protection is "not an insurance policy" and is decided at Depop's sole discretion, but statutory rights still apply — [Depop Help](https://depophelp.zendesk.com/hc/en-gb/articles/360038461713-Depop-Protection-for-buyers); [Buying safely](https://depophelp.zendesk.com/hc/en-gb/articles/360001772568-Buying-safely-on-Depop)
- **Refunds** cover lost, damaged, wrong size/colour, counterfeit, or undisclosed wear. Sellers don't have to refund a change of mind — [Depop Help: refunds](https://depophelp.zendesk.com/hc/en-gb/articles/360001772468-How-do-I-get-a-refund)
- **Seller side:** sellers are protected when they upload valid tracking. Sellers report losing disputes when tracking was uploaded late or didn't show delivery — [Depop Help: Protection for sellers](https://depophelp.zendesk.com/hc/en-gb/articles/360001845367-Depop-Protection-for-sellers); [Closo seller review (secondary)](https://closo.co/blogs/casestudies/is-depop-safe-in-2025-a-honest-review-after-500-transactions)

**Scams and account security**
- **Common scams:**
  - Sellers asking for off-app payment (Venmo, CashApp, bank transfer), which voids protection.
  - Fake "payment sent" screenshots and emails.
  - Phishing links.
  - Sources: [NordProtect](https://nordprotect.com/blog/depop-scams); [Bitdefender](https://www.bitdefender.com/en-us/blog/hotforsecurity/depop-scams)
- **History:**
  - Feb 2020: reports of widespread scammers asking for bank transfers.
  - Oct 2020: buyers were tricked into paying sellers directly and their data was reportedly sold on the dark web. Depop responded with forced password resets and multi-factor authentication.
  - Source: [Wikipedia](https://en.wikipedia.org/wiki/Depop)

**Counterfeits and moderation**
- **ML in T&S:** Depop's Trust Detection team covers phishing prevention, counterfeit detection, and prohibited/restricted listings. It uses deep learning, LLMs and multimodal (image + text) models — [Depop job post via Built In London](https://builtinlondon.uk/job/senior-machine-learning-scientist/11079419)
- **Counterfeit rules:** counterfeits, replicas and IP-infringing items (including unlicensed digital goods) are banned and can lead to immediate suspension. Buyers report via the item's ⋯ menu → counterfeit/IP. Seller guides say "the algorithm flags first, human reviews later", and appeals need receipts or third-party authentication. All of this is from secondary sources — [Red Points](https://redpoints.com/?p=20279); [List Perfectly](https://listperfectly.com/tips/depop-prohibited-items-guide/); [Vendoo suspension guide](https://blog.vendoo.co/depop-account-suspended-what-you-need-to-know)
- **Authentication:** I found no formal Depop authentication service for sneakers or luxury. Commentators say Depop relies on community reporting plus disputes after the sale. eBay runs a physical Authenticity Guarantee, which may now come to Depop through eBay's "trusted services" synergies (my inference) — [Sacra](https://sacra.com/chat/h/a97bb06c-9fbd-4510-b8cd-d1b6f96f9a4b/); [Shopifreaks](https://www.shopifreaks.com/ebay-closes-its-1-4b-depop-acquisition-and-says-the-resale-marketplace-will-keep-its-own-brand-platform-and-culture/)
- After its 2019 Series C, Depop said it would spend most of the round on engineering and data, including image-detection algorithms — [Red Points](https://redpoints.com/?p=20279)

### Inferences
- Depop's core trust design is **"protection only inside our payment rail"**. That one rule makes off-platform payment the main scam, and it gives users a strong reason to keep money on-platform. The 30-day window, plus tracking as proof for the seller, is the whole dispute model.
- Counterfeit control is reactive (reports and ML flags) rather than authenticating items before sale. That suits low-value vintage but is weak for hype items.

### Gaps
- **No public fraud-rate, dispute-rate, chargeback-rate or counterfeit-takedown data** from Depop or Etsy. Etsy's transparency reports may cover Depop but were not checked. Figures on third-party blogs (e.g. "70% flag rate") are unsourced and left out.
- Payout timing and holds for new sellers were not confirmed (the help pages returned 403).
- How Depop verifies seller identity is not confirmed (likely Stripe KYC through Depop Payments).
- Account-takeover controls beyond the 2020 MFA rollout were not documented.
- Fake-review controls were not found.

## 3. Engineering

### Takeaway
Little is public, and the engineering blog (engineering.depop.com, on Medium) blocked fetching. From one blog post and many job ads, the stack looks like this:
- **Services:** Kubernetes services, with a Scala backend alongside Python.
- **Data and ML:** Airflow + Spark on AWS EMR for batch recommendations, then a move toward real-time model serving (KServe, Seldon or SageMaker were evaluated). Kafka/Flink streaming.
- **Teams:** dedicated Search & Retrieval, "Better Matching" (search, recommendations, personalisation), Experimentation, Data Platform and Trust Detection ML teams. Depop had about 475 staff in total at end-2025.

### Cited Findings
- **Blog post "Show the people what they want! (without breaking the bank)":** Depop rebuilt its recommendation pipelines for cost and scale after rapid growth. The old system ran batch Spark jobs on Amazon EMR, started by Airflow every morning. Services typically run on Kubernetes. KServe, Seldon and SageMaker were evaluated for model serving — [Depop Engineering (via search summary; page 403 to fetch)](https://engineering.depop.com/show-the-people-what-they-want-without-breaking-the-bank-e953b79da84d)
- **Teams:**
  - Search & Retrieval: maintains and scales the search system and the infrastructure that serves search and recommendations (distributed systems, retrieval, message queues, ML) — [Built In London job](https://builtinlondon.uk/job/backend-engineer-search-and-retrieval/10762845)
  - Better Matching Experiences: builds the search, recommendations and personalisation platform — [Octopus Ventures job](https://talent.octopusventures.com/companies/depop/jobs/75483396-senior-backend-engineer-better-matching-experience)
- **Infrastructure:** Data Platform asks for Kafka/Flink/Confluent. Staff Backend asks for event-driven architecture with Kafka. There is an Experimentation backend team. Platform team owns "core APIs and services"; its job tags include Python and SQL — [Octopus Ventures data platform job](https://talent.octopusventures.com/companies/depop/jobs/76552319-senior-data-platform-engineer); [Jobgether](https://jobgether.com/offer/6a262bacf4c10b4493237401-staff-backend-engineer); [Flexa](https://flexa.careers/jobs/depop-experimentation-backend-engineer-6425bfac54723bf66d33a2f6); [IT Job Board](https://www.itjobboard.co.uk/job/16786751/backend-engineer-platform/)
- **Languages:** Scala is described as central to Depop backend work. This comes from a third-party interview guide — [Dataford](https://dataford.io/interview-guides/depop/software-engineer)
- **Payments:** Depop Payments is built on Stripe — [Value Added Resource](https://www.valueaddedresource.net/depop-drops-seller-fees-australia/)
- **Social signal:** each month, community members like, follow and message one another 85M times (2019) — [General Atlantic](https://www.generalatlantic.com/media-article/depop-raises-62-million-series-c-to-meet-rising-demand-from-us-gen-z/)

### Inferences
- Depop's engineering spend goes to discovery (search and recs), experimentation and trust ML, not to novel infrastructure. Its recs went batch-first and were made real-time later. For a small app, nightly batch ranking is a valid first stage.
- Whether Depop moved from a monolith to microservices is not documented in what I found (likely Scala microservices on Kubernetes, unconfirmed).

### Gaps
- The full engineering.depop.com archive could not be fetched (403/404 from Medium). Not found: post list, image-processing pipeline, mobile stack, payments architecture, and how the engineering team splits within the ~475 staff.

## 4. Community & culture

### Takeaway
Depop's moat is a **Gen Z social marketplace**:
- **Audience:** 87% of buyers are under 34.
- **Social activity:** follows, likes and DMs (85M/month as early as 2019).
- **Flywheel:** 59% of 2025 sellers also bought.
- **In-person:** workshops and events such as Depop LIVE.
- **Positioning:** sustainability ("circular fashion").
- **Brand spend:** heavy since 2025.

### Cited Findings
- 87% of buyers are under 34, and 59% of sellers who sold in 2025 also bought — [Etsy FY2025 10-K](https://www.sec.gov/Archives/edgar/data/1370637/000137063726000019/etsy-20251231.htm)
- **In-person:** Depop regularly runs in-person seller workshops (selling tips, meeting other users). Depop LIVE in New York was a free public retail event for buyers, sellers, stylists and creatives. The "I Got It On Depop" campaign used influencers, audio and a music-plus-marketplace community event — [Ptengine (secondary)](https://www.ptengine.com/blog/noset/the-secrets-behind-depop-gen-z-marketing-ugc-identity-and-community/); [Glossy](https://www.glossy.co/platform-effect/how-depop-is-catering-to-gen-z-and-millennials-to-get-an-edge-over-resale-competitors)
- Goyal: this generation "cares more than any generation before them about the impact of their choices", and that drives resale. Depop's appeal mixes style, sustainability and value in a peer-to-peer model "that improves as it grows" — [Glossy podcast](https://www.glossy.co/podcasts/ceo-kruti-patel-goyal-on-bringing-depop-to-a-bigger-broader-audience-in-more-places/)
- Depop pitched itself as an online flea market born from a fashion magazine (PIG) — [Wikipedia](https://en.wikipedia.org/wiki/Depop)

### Gaps
- Not found: specifics of any formal ambassador programme, "Depop Drop" events, or live shopping, or data on how much social features (follows, DMs) lift conversion.

## 5. Lessons for TNL Labs (fee model, trust mechanics, anti-counterfeit, what to avoid)

### Takeaway
TNL's rep-scaled seller commission (10%→2%) is the opposite of Depop's buyer-fee move. Depop shows that **showing sellers "0%" grows listings 30–45% in a month, but the platform's take barely changes, and buyer-paid growth can still lose money.** TNL's bigger gap is trust plumbing. The current design is:
- **Stripe Standard Connect with direct charges.** The seller is merchant of record, money goes straight to the seller, and TNL can't hold funds or refund on its own.
- **No webhooks.**
- **Refunds handled by the seller in the Stripe dashboard.**
- **Rep (+15 sale, +10 delivery) that is never clawed back when a sale is refunded.**

Depop's lesson is that protection lives where the money flows, so TNL's choices are bounded by its Connect model.

### Cited Findings (TNL code, read-only inspection)
- `src/pay.js` uses Stripe **Standard Connect, direct charges on the seller's account**, with commission taken as `application_fee_amount` on the item only, not shipping. The seller pays processing. Stripe owns KYC and payouts — /home/user/TNL-labs/src/pay.js (header comment and `createCheckout`)
- Oversold orders tell the seller to "refund it from your Stripe dashboard". `sale_made` rep is awarded when the order settles as paid — /home/user/TNL-labs/src/server-07-orders-sharing.js `settlePaidOrder`
- `POST /api/orders/:id/received` (buyer only) awards `delivery_confirmed` +10 on paid orders and marks the order complete. There is no time window, dispute state or tracking check — /home/user/TNL-labs/src/server-07-orders-sharing.js
- `revokeRep` exists (`src/db.js:753`) but is only used for un-likes. No refund or dispute path reverses `sale_made` / `delivery_confirmed`. A grep for `webhook`, `constructEvent`, `dispute` and `charge.refunded` across `src/` returns nothing — /home/user/TNL-labs/src/db.js
- `FEE_BY_LEVEL = {1:10, 2:8, 3:6, 4:4, 5:2}` — /home/user/TNL-labs/src/db.js:782

### Inferences / suggestions (all payment changes need `/security-review`)
1. **Fee model: keep seller-side and rep-scaled, but show it like Depop/Vinted.** Depop's switch was about visible "0%" to sellers, not a lower take (§1). TNL's rep-for-lower-fees loop is a distinctive story. Show "You keep 90%→98%" in the sell flow, and show buyers an all-in price up front. Avoid a surprise buyer fee: Depop's US buyer fee drew "smaller margins" worries, and Vinted's fee is non-refundable, which annoys buyers. If TNL ever adds a buyer fee, call it **protection** (like Vinted) and make it pay for something real. [no new dep]
2. **Protection only on-platform, and say so.** Copy Depop's rule: only TNL checkout is covered, and DMs warn when someone mentions Venmo, CashApp, PayPal or bank details (simple regex in `server-10-dm-core.js` → inline warning). That is the #1 Depop scam vector. [no new dep]
3. **Order states and a dispute window.**
   - Add `delivered → complete` auto-close after N days (Depop: 30 days from purchase).
   - Add an `issue_open` state the buyer can raise within that window, with reasons: not received, damaged, not as described, counterfeit.
   - Add an admin queue that shows the chat, listing photos and tracking.
   - Payment cases are decided by admin. Under Standard Connect, the refund must be made by the seller or through the API on the connected account. TNL can call `POST /v1/refunds` with `Stripe-Account` (and `refund_application_fee=true` so TNL returns its cut).
   - [no new dep]; touches payments → security review.
4. **Webhooks (the most important missing piece).** Add `/api/stripe/webhook` with signature verification using the HMAC-SHA256 `Stripe-Signature` check via `node:crypto` (no SDK needed). Subscribe on Connect for `checkout.session.completed`, `charge.refunded`, `charge.dispute.created` and `charge.dispute.closed`. Today the redirect/poll is the only confirmation path. [no new dep]; needs a webhook secret in Railway Variables; security review.
5. **Rep integrity tied to money outcomes.**
   - On refund or lost dispute: `revokeRep(seller, "sale_made", orderId)` and `revokeRep(seller, "delivery_confirmed", orderId)`.
   - Award `delivery_confirmed` only after tracking shows delivery or after N days with no issue opened. That stops self-buy rings from "minting" +25 rep and a lower fee tier by buying and confirming their own items. A refund currently leaves rep intact.
   - [no new dep]
6. **Tracking as seller protection.** Depop protects sellers who upload valid tracking. Add a tracking-number field on `shipped`, and require it before the dispute window favours the seller. Carrier lookups need an aggregator API. [new service] if automated; a manual "tracking link" field is [no new dep].
7. **Payout holds.** Depop/Vinted-style holds aren't possible with direct charges on Standard accounts, because funds settle to the seller. Options:
   - (a) Accept this, and lean on Stripe's own dispute handling plus the seller's reserve. [no new dep]
   - (b) Move to destination charges or separate charges and transfers with Express accounts, which allow `transfer` after delivery confirmation (an escrow-like hold). That is a big payments and legal change: platform liability for disputes, Connect fees per active account, possibly money-transmission questions. [new service tier/cost]; full security and legal review. **Recommendation:** stay on Standard and use (a) until volume justifies (b).
8. **Anti-counterfeit for the fashion lab** (Depop has no formal authentication either):
   - Listing rules banning replicas and "inspired by" items that use brand logos.
   - A "counterfeit / IP" report reason with an admin queue.
   - A brand/IP takedown email route.
   - A required "proof" photo slot (tag, label, receipt) for listings above a price threshold or in hype categories.
   - Keyword flags in listing text ("rep", "1:1", "UA", "replica", "dupe") that route to review.
   - Repeat-offender suspension.
   - All [no new dep]. Image ML or third-party authentication would be [new service]; skip for now.
9. **Seller-buyer flywheel.** 59% of Depop sellers also buy. TNL's labs and creator profiles are the same kind of social layer. Measure seller→buyer conversion as a health metric (admin stat). [no new dep]
10. **What to avoid:**
    - Growth bought with brand spend before unit economics work (Depop's Q2 2026 pre-tax loss was $161M).
    - Protection terms written as "sole discretion, no legal claim" fine print, which conflicts with TNL's transparency pitch.
    - Fee changes made without clear notice: Depop applied its change to *new* listings only and announced it days ahead. Do the same if `FEE_BY_LEVEL` ever changes.
    - Non-refundable buyer fees.

### Gaps
- I did not check Stripe's current Connect pricing or the exact refund semantics for Standard direct charges (`refund_application_fee` behaviour) during this research. Verify both in the Stripe docs before building.
- No data on dispute or fraud rates to size how much protection TNL needs.
