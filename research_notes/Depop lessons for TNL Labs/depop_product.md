# Depop's marketplace product (as of October 2026): what TNL Labs' market should adopt

Scope note: researched 2026-10-08. Depop's own help centre and blog (depop.com/blog, blog.depop.com) returned HTTP 403 to the fetch tool, so official mechanics come from news.depop.com, the Depop Selling/Partner API docs, Depop's Top Seller Code of Conduct PDF, Etsy/SEC filings and trade press. Where only seller-tool vendor blogs (Closo, Vendoo, OneShop, Crosslist, Nifty) were available, that is flagged; those vendors sell tools and are lower reliability.

TNL baseline, from reading the repo (read-only): categories are fixed (`Tops, Bottoms, Outerwear, Footwear, Accessories, Headwear, Bags, Jewellery, Art / Prints, Other`) and conditions are `Deadstock, Like New, Good, Worn, Distressed` (`src/server-06-settings-payouts-market.js` lines 23–24). Market search is a SQL LIKE over title/description/brand, with filters for category, size, condition, brand and price, and sort options newest / low / high / most-liked (same file, ~lines 157–176). There is a "similar items" query (same category, 0.4x–2.2x price). Offers can be accepted or declined, with notifications (`offer_accepted` / `offer_declined`, ~lines 382–388). I found no counteroffer and no seller-initiated "send offer to likers". A price drop notifies people who saved the item, through `notify(..., "price_drop", ...)` in `src/server-06-market-stock.js` (~lines 68–77). I found no bundle discount, vacation mode, shop stats, saved search or style tags.

## Context: corporate and business state (affects how durable Depop's choices are)

### Takeaway
eBay bought Depop from Etsy (closed 30 July 2026). Depop keeps its own brand and product, and it is growing fast: about $1B GMS in 2025. Its 2024–2026 product direction is to remove seller fees and charge buyers instead, add AI listing, add paid Boost, and build social/styling tools such as Outfits.

### Cited Findings
- eBay closed the Depop acquisition on 30 July 2026 for about $1.4B cash ($1.2B price plus about $200M adjustments and interest). Depop keeps its brand, platform, customer experience and culture, and CEO Peter Semple stays — [FashionUnited](https://fashionunited.com/news/business/ebay-completes-1-4-billion-dollar-depop-acquisition/2026073073828); [Etsy 8-K exhibit](https://www.sec.gov/Archives/edgar/data/0001370637/000137063726000071/exhibit99173026.htm); [Shopifreaks](https://www.shopifreaks.com/ebay-closes-its-1-4b-depop-acquisition-and-says-the-resale-marketplace-will-keep-its-own-brand-platform-and-culture/)
- Depop did about $1B GMS in 2025, and US sales grew 60% YoY — [FashionUnited](https://fashionunited.com/news/business/ebay-completes-1-4-billion-dollar-depop-acquisition/2026073073828)
- Q2 2025 GMS grew 34.7% YoY currency-neutral (Etsy earnings) — [TechCrunch](https://techcrunch.com/2025/09/24/depop-launches-a-fashion-collaging-tool-to-style-pinterest-worthy-outfits/)
- After the deal, eBay is reported to give Depop prime placement and to send fashion buyers to Depop (Aug 2026 headlines; no details) — [fluf.io news index](https://fluf.io/seller-news/category/depop)
- In Sept 2026 a proposed class action alleged "drip pricing", meaning the buyer marketplace fee is added at checkout (headline only) — [fluf.io news index](https://fluf.io/seller-news/category/depop)

### Inferences
- The buyer-fee model now carries legal risk if the fee is not shown upfront. TNL already shows a live "you earn" to sellers, and should also show the buyer the all-in price on the listing card.

### Gaps
- No primary detail on the eBay-era roadmap, or on whether Depop ranking or fees changed after the deal.

## 1. Listing: photos/video, AI listing, attributes, pricing, drafts, bulk, cross-listing

### Takeaway
Depop's listing flow has three parts. A photo-first AI auto-fill (Sept 2024) drafts the description, category, sub-category, colour and brand from one photo. In-flow photo editing (Photoroom, June 2025) cleans up backgrounds and lighting. Free-text hashtags plus backend "style" attributes feed aesthetic search. Depop also added web/CSV bulk listing for professional sellers (2025), and from 2026 its Terms explicitly accept cross-listing. For TNL, the parts worth copying are style tags and photo guidance (cheap). AI auto-fill and background removal need an external service, which needs owner approval.

### Cited Findings
- **AI listing from one photo** (12 Sept 2024): the seller uploads one photo and taps "Generate Description". The AI fills the description plus category, sub-category, colour and brand. The seller can keep, edit or delete it. Output is written in Depop's casual community voice and includes hashtags. Available in the US, UK, AU, CA and IE — [Depop newsroom](https://news.depop.com/depop-launches-ai-powered-listing-from-one-photo/)
- Impact: "almost half of listers" tried it during testing — [Depop newsroom](https://news.depop.com/depop-launches-ai-powered-listing-from-one-photo/); [Retail Dive](https://www.retaildive.com/news/depop-generative-artificial-intelligence-product-descriptions-photo/727860/)
- Same announcement: Depop already used fine-tuned language/vision models for "predictive recommendations and pricing guidance" for sellers, and for better search and personalised recommendations for buyers — [Depop newsroom](https://news.depop.com/depop-launches-ai-powered-listing-from-one-photo/)
- **Photo editing in the listing flow** (June 2025), powered by Photoroom: adjust lighting, change backgrounds, keep images consistent without leaving the app — [Value Added Resource](https://www.valueaddedresource.net/depop-product-release-june-2025/)
- **Web bulk listing** (June 2025): CSV bulk upload or direct desktop listing, with the web flow improved for larger inventories — [Value Added Resource](https://www.valueaddedresource.net/depop-product-release-june-2025/)
- The **Depop Selling API** lets professional sellers sync stock, manage orders and integrate inventory, including programmatic boosting and offers — [Depop Partner API: boosting](https://partnerapi.depop.com/api-docs/concepts/boosting/); [Depop Partner API: offers](https://partnerapi.depop.com/api-docs/how-to-guides/managing-offers/)
- **Style attributes and hashtags**: sellers add hashtags such as #y2k, #grunge or #streetwear, plus "backend style attribute fields" at listing time. Gender (menswear/womenswear) changes where items appear in filtered search (vendor guide) — [OneShop style tags](https://tools.oneshop.com/blog/style-tags-depop); [List Perfectly](https://listperfectly.com/?p=11184)
- **Cross-listing**: the March 2026 Terms update acknowledges third-party cross-listing tools. Sellers must remove an item from Depop once it sells elsewhere, are responsible for double sales, and must refund if the item is unavailable. Scraping and bots are banned — [List Perfectly summary of 2026 ToS](https://listperfectly.com/selling/depop-terms-of-service-update-2026/)
- **Scheduled listings**: one seller blog reports an unannounced rollout. This is unofficial and undated — [Restitched (Substack)](https://restitched.substack.com/p/depop-now-allows-you-to-schedule)

### Inferences (adopt / adapt / skip for TNL)
- **Style tags (ADOPT, S, about 1–2 days).** Add a `styles` field to listings: a free-text tag list capped at about 5, or a curated list per lab. Add it to the search WHERE clause and to a "browse by style" chip row. It fits TNL's creative crowd, needs no dependency, and IDs stay stable.
- **Photo guidance (ADOPT, S, under 1 day).** An inline checklist in the Media step: cover on a plain background, one modelled or worn shot, flaws close up, a label/tag shot. This is free, and it is how Depop's community norm of styled and modelled covers spreads.
- **AI auto-fill from photo (ADAPT, M–L, needs owner approval).** It needs a vision LLM API, which is a new external service and is blocked by CLAUDE.md without approval. A no-dependency stand-in: pre-fill category, brand, size and condition from the seller's last listing, plus the "duplicate" TNL already has.
- **Background removal (SKIP for now).** It needs Photoroom or a similar service. Revisit only with owner approval.
- **CSV bulk upload (SKIP / later).** TNL's sellers are individual creatives, not bulk resellers. Duplicate and drafts already cover most of the need.
- **Video**: Depop supports video in listings (my training knowledge; not verified in a 2026 source). TNL's upload pipeline already handles post media, so a short clip as one of the 8 media slots is plausible (M). Verify upload size limits first.

### Gaps
- Depop's exact current photo/video limits and help-centre guidance (help centre blocked). Depop has historically allowed 4 photos plus 1 video per listing; I could not confirm this for 2026.
- Whether Depop's AI now also suggests price (2026). The 2024 post mentions "pricing guidance" without detail.
- No public impact numbers for the Photoroom editor or CSV upload.

## 2. Discovery: feed, search/filters, styles, following, saved searches, Picks, Boost, ranking

### Takeaway
Depop discovery is feed- and aesthetic-led. Shoppers browse a personalised home feed and search by vibe (#y2k), not only by category. Search has autosuggest, filters (category, size, price, condition, location, gender) and backend style attributes. Since 2023 there is paid Boost: an extra labelled placement, charged 8% (US/AU) or 12% (UK, per some sources) only if a buyer who interacted with the boost buys within 28 days. June 2025 added Boost Shop. Depop has published no ranking formula. Sellers believe recency (edits and relists) matters, which drives a bump/refresh-bot culture.

### Cited Findings
- **Boost mechanics** (official API docs): a boosted product gets an *additional* placement in search and "Suggested for you" while keeping its organic slot, and carries a "boosted" label. The fee applies only if a buyer interacts (views, clicks or likes) with the boosted placement and that same buyer buys within 28 days. Organic purchases don't trigger it. Boost Shop boosts all current and future items, and unboosting one item turns Boost Shop off. Sellers may get a free boost trial — [Depop Partner API: boosting](https://partnerapi.depop.com/api-docs/concepts/boosting/)
- Boost fee is 8% for US/AU and 12% for UK (Crosslist), on total sale price including shipping if the seller uses their own label. A UK guide says 8%, so sources conflict. New shops can boost only 28 days after opening — [Crosslist](https://crosslist.com/blog/boost-items-on-depop); contradicted on UK rate by [Vendoo UK](https://uk.blog.vendoo.co/guide-to-depop-fees-for-uk-sellers-buyers)
- Boost Shop (June 2025) shows visibility stats (clicks, views). Depop-sourced claim: boosting "can increase selling chances by 25%" — [Value Added Resource](https://www.valueaddedresource.net/depop-product-release-june-2025/)
- **Aesthetic browsing**: Depop shoppers often browse their feed or search aesthetics rather than brand/category. Search autosuggests popular terms from real buyer searches (vendor guide) — [List Perfectly](https://listperfectly.com/?p=11184); [OneShop](https://tools.oneshop.com/blog/style-tags-depop)
- **Filters**: location, price range, condition and gender/category affect filtered results (third-party) — [List Perfectly](https://listperfectly.com/?p=11184); [Sagedatum](https://sagedatum.com/blogs/apps/how-do-i-find-items-to-buy-on-depop)
- **Saved searches/alerts**: only a third-party guide says users can save searches and turn on notifications for saved searches or favourite sellers. Not officially confirmed — [Sagedatum](https://sagedatum.com/blogs/apps/how-do-i-find-items-to-buy-on-depop)
- **Ranking**: I found no official ranking documentation (Depop's "How search works" blog post exists but returned 403). Seller lore says freshness (recently edited or listed), early engagement and seller reliability matter. One small seller test found manual edits beat bot refreshes by about 25% in impressions. Sources warn that over-refreshing may be flagged — [Closo](https://closo.co/blogs/beginner-guides-how-tos/how-to-boost-listing-on-depop-2025-seller-s-guide-from-real-experience); [Nifty: relist](https://www.nifty.ai/post/relist-depop); bump bots exist, e.g. [Resellify Bump extension](https://chromeboard.com/extension/depop-bot-resellify-bump-noigpihfhadeeakhllpgnfomabmghbpd)
- **Editorial/curation**: curated shops and partnerships carry discovery, e.g. a Gabriella Karefa-Johnson curated shop (Sept 2026), Spotify artist-curated shops (Aug 2026) and an official Coachtopia shop (June 2026) — [fluf.io index](https://fluf.io/seller-news/category/depop)
- 2024 announcement: Depop improved search and personalised recommendations using fine-tuned models — [Depop newsroom](https://news.depop.com/depop-launches-ai-powered-listing-from-one-photo/)

### Inferences (adopt / adapt / skip for TNL)
- **Boost (SKIP).** It is paid reach, which conflicts with TNL's "no paid reach/ads" rule. It also creates a two-tier feed that disadvantages small creatives. The attribution model (pay only on attributed sale) is clever, but it is still pay-to-rank. The useful lesson is how it is presented: a clearly labelled, *additional* slot that never replaces organic results. TNL's equivalent is earned: a rep-weighted "From levels 4+" or "Picked by members" shelf.
- **Bump/refresh culture (SKIP, and design against it).** Depop's recency-heavy ranking creates busywork and bots. TNL sorts by `created_at` (newest). Do not let edits reset recency. Instead, add a "fresh price" signal: TNL's price-drop tags already surface changes honestly.
- **Saved searches with alerts (ADOPT, M, about 2–3 days).** Store a `saved_searches` row (query params JSON). On listing create, match it and send through the existing `notify()`. No new service. Matches Depop users' "notify me for new items" habit.
- **Browse by style / Picks shelf (ADOPT, S–M).** A row of style chips plus an admin- or member-curated "Picks" shelf (editor picks via Admin, IDs stable). Depop's curated-shop partnerships show curation drives discovery. TNL's Showroom/labs are the natural home.
- **Following-shops feed (ADAPT, S).** TNL already has follows. Add a "From people you follow" filter to the market (`seller IN follows`).
- **Ranking (ADAPT).** Publish TNL's ranking rule in plain words, for example newest first, with a "most-liked" sort. Depop's opacity breeds bot culture, so transparency is a differentiator.

### Gaps
- Official Depop ranking signals; whether saved-search alerts exist natively in 2026; current status of Depop's editorial "Picks"/Explore (historically there was a "Discover/Explore" tab with staff picks; not verified for 2026).

## 3. Transactions: offers, counteroffers, send-to-likers, bundles, price drops, payments, shipping, protection, returns, disputes, holds

### Takeaway
Offers are central to Depop. In the last reported year (as of Jan 2024), over 40% of items sold via offers, at an average 23% discount, from 62M offers. Sellers also send about 2M targeted "Send Offer" discounts a week to people who liked or bagged an item, and the buyer has 24h to buy or counter. Bundles are mainly a shipping saving (one label, a seller setting) and possibly a seller-set percentage off, which is unconfirmed. Payments go through Depop Payments (Stripe) or PayPal. Depop sells prepaid USPS labels with tracking. Protection covers not-received, not-as-described, damaged and counterfeit items, and requires on-app chat and a claim within about 30 days. The 2026 Terms add auto-cancel for unshipped orders.

### Cited Findings
- **Offers timeline**: Make Offer launched in 2022. Send Offer (seller to likers) launched on iOS in 2023, then web and Android by 9 Jan 2024 — [Depop newsroom](https://news.depop.com/depop-community-embraces-offers-as-suite-of-negotiation-tools-expands/)
- **Offer impact**: buyers averaged a 23% discount on offer purchases. Over 40% of items were bought via offers. 62M offers were made. About 2M seller-sent offers per week. Sundays and Mondays are the peak days for accepting offers — [Depop newsroom](https://news.depop.com/depop-community-embraces-offers-as-suite-of-negotiation-tools-expands/)
- **Counteroffers / expiry**: a buyer has 24 hours to buy or counter a seller's offer before it expires — [Depop newsroom](https://news.depop.com/depop-community-embraces-offers-as-suite-of-negotiation-tools-expands/)
- **Who receives Send Offer**: only users who liked the item or added it to their bag (vendor guide). The Selling API supports auto-sending offers to likers and baggers — [Vendoo](https://blog.vendoo.co/how-to-send-offers-on-depop-or-cancel-them); [Depop Partner API: offers](https://partnerapi.depop.com/api-docs/how-to-guides/managing-offers/)
- **Bundles**: multiple items from one shop in one checkout. Shipping savings are enabled in shop settings and apply automatically to same-address domestic checkouts. With Depop shipping there is one prepaid label sized to the bundle. Sellers can also make a custom bundle listing held for one buyer for a seller-chosen time. Fees are still per item — [OneShop](https://tools.oneshop.com/blog/bundles-in-depop)
- **Bundle percentage discount**: one vendor guide says sellers can set a threshold-based percentage off (e.g. 10% for 2+ items). No official confirmation found — [Closo](https://closo.co/blogs/platform-specific-guides/how-do-bundles-work-on-depop)
- **Fees (historical and current)**: the US 10% seller fee was removed for new listings from 15 July 2024. A buyer "marketplace fee" of up to 5% plus up to $1 was added from 18 July 2024, and payment processing still applies. The UK did the same in March 2024. Australia removes selling fees from 22 July (2026 per search summary) — [Depop newsroom](https://news.depop.com/depop-removes-selling-fees-in-the-united-states-evolves-fee-structure/); [Depop blog](https://blog.depop.com/articles/us-depop-fee-change); AU: [fluf.io/press summary](https://fluf.io/seller-news/category/depop) (AU date unverified against a primary source)
- **Payments and wallet**: all payments must stay on-platform (Depop Payments via Stripe, or PayPal), and off-platform payment can mean suspension. The new US **Depop Balance** wallet holds earnings to spend on Depop, with bank withdrawal still available and possible Stripe ID checks — [List Perfectly 2026 ToS summary](https://listperfectly.com/selling/depop-terms-of-service-update-2026/)
- **Shipping**: Depop prepaid labels (USPS Ground Advantage / Priority) with print or QR at the post office, and tracking starts automatically. A single source says insurance is up to $200. Prices are weight-tiered, and sources conflict on rates — [Vendoo](https://blog.vendoo.co/depop-shipping-how-does-shipping-work-on-depop); [atoship](https://atoship.com/blog/how-to-ship-on-depop-2026). In Sept 2026, Vinted and Depop were reported to be stepping up US shipping competition — [fluf.io index](https://fluf.io/seller-news/category/depop)
- **Shipping deadline / auto-cancel**: sellers must ship within their stated shop-policy timeframe with valid tracking where required. Orders not shipped in a "reasonable timeframe" may be auto-cancelled and refunded (2026 ToS) — [List Perfectly](https://listperfectly.com/selling/depop-terms-of-service-update-2026/)
- **Buyer protection**: applies to in-app Depop Payments purchases that are not received, not as described, damaged or not authentic. It is voided if the parties talked off-app. The claim window is about 30 days. Sellers must respond quickly (24–48h per conflicting sources) or the claim auto-resolves for the buyer. Resolution takes 7–14 days (conflicting) — [Vendoo returns](https://blog.vendoo.co/how-to-handle-depop-returns-and-refunds); [Crosslist](https://crosslist.com/blog/depop-return-policy); [OneShop](https://oneshop.com/blog/depop-returns)
- **Returns**: private sellers need not accept change-of-mind returns. Business sellers face 30-day return claims (UK/EU consumer law context) — [Crosslist](https://crosslist.com/blog/depop-return-policy)

### Inferences (adopt / adapt / skip for TNL)
- **Counteroffers (ADOPT, M, about 2–3 days).** TNL offers are accept/decline only. Add `counter` (the seller proposes a price, the buyer accepts, counters or lets it lapse), a max of about 3 rounds, and a 24h expiry. The accepted price must lock the checkout price server-side. This touches payments, so run `/security-review`. Highest-leverage item given Depop's 40%-via-offers figure.
- **Send offer to savers (ADOPT, S–M, about 1–2 days).** TNL already has saves and price-drop notifications to savers. Add "Offer to savers": the seller sets X% off (minimum 10%), every current saver gets a private 24h offer through `notify()`, and it is one per listing per X days to avoid spam. Fits the rep rule, since it involves no rep.
- **Offer expiry (ADOPT, S).** A 24h expiry on accepted offers ("go buy it") stops stale holds.
- **Bundle discount (ADOPT, M, about 2–3 days).** TNL already has a bag with one checkout per seller, which is Depop's bundle structure. Add a seller setting: "X% off 2+ items" and/or "combined shipping = max(shipping) + Y". Compute it in `server-07-cart.js` at checkout, server-side. Depop's version is mostly shipping; TNL can do both.
- **Bundle hold / reserved listing (ADAPT, S).** Let the seller reserve a listing for one buyer for N hours (status `reserved`). Cheap, and it mirrors Depop's custom bundle listing culture.
- **Prepaid labels (SKIP for now).** They need a shipping API (e.g. Shippo/EasyPost), which is a new service and needs approval. Keep the seller's own shipping plus a tracking-number field, and make tracking required for any order over a threshold.
- **Ship-by deadline plus auto-cancel (ADOPT, M).** A seller-stated handling time (e.g. 3 days), reminders at 48h, and auto-refund through Stripe if unshipped by day N. Matches Depop's 2026 ToS and protects buyers. Payments area, so security-review.
- **Buyer protection rules (ADOPT, S, policy plus UI).** State them on checkout: not received / not as described, claim within 30 days, keep chat in TNL DMs. Use existing delivery confirmation as the trigger for the claim window.
- **Fee model (SKIP buyer fee).** Depop moved fees to buyers and now faces a drip-pricing class action. TNL's rep-based seller commission (10% down to 2%) is simpler and aligns with "rep from others". Keep it, and show all-in prices.
- **Wallet/balance (SKIP).** Money transmission complexity; TNL never holds seller money (comment in `server-06-settings-payouts-market.js`).

### Gaps
- Official current Depop help-centre numbers for the claim window, seller response window and label prices (help centre was 403).
- Whether Depop natively supports percentage bundle discounts in 2026 (vendor-only claim).
- Depop's "hold"/reserve mechanics (only custom-listing workaround found).

## 4. Seller tools: Shop Stats, Top Seller / Pro, vacation mode, repeat-buyer tools

### Takeaway
Depop added a Shop Stats dashboard (sales, potential earnings, total listings) in June 2025, plus view/click stats for boosts. Top Seller is a criteria-gated badge that is re-checked monthly. Criteria: $1,000/mo in sales (US), 50 new listings/mo, a 4.5+ rating and disputes under 3% for 3 months. Benefits: a verified badge, faster payouts, visibility, priority support and a forum. Vacation mode exists, with thin official docs.

### Cited Findings
- **Shop Stats** (June 2025): sales, potential earnings and total listings in one view, to spot trends and plan restocks — [Value Added Resource](https://www.valueaddedresource.net/depop-product-release-june-2025/)
- **Top Seller criteria** (official Code of Conduct v2): for 3 consecutive months, monthly sales of US $1,000 / UK £1,000 / AU $2,000, 50 new listings/month, a lifetime rating of 4.5 or higher, disputes under 3% of lifetime sales, and ToS compliance. Status is removed if the monthly standards are missed — [Depop TSP Code of Conduct v2 (PDF)](https://assets.depop.com/sellers/assets/TSP-Code-of-Conduct-v2.pdf)
- **Top Seller benefits**: verified badge, faster payouts, more visibility, priority support, Top Seller forum — [Depop Top Seller Program page](https://www.depop.com/gb/sellers/top-seller-program)
- Conflicting third-party criteria: 4 consecutive months (Depop blog), $2,600/4 months, or 50+ items at a $20 average, plus ship within 3 days. These are likely older versions — [Depop blog](https://blog.depop.com/articles/how-to-become-a-top-seller); [Vendoo](https://blog.vendoo.co/make-more-sales-on-depop-and-become-a-depop-top-seller); [Nifty](https://www.nifty.ai/post/depop-top-seller-requirements)
- **Vacation mode**: temporarily pauses sales without deactivating the account (third-party; no official 2026 doc found) — [Closo](https://closo.co/blogs/platform-specific-guides/depop-vacation-mode)
- Boost stats show clicks and views — [Value Added Resource](https://www.valueaddedresource.net/depop-product-release-june-2025/)

### Inferences (adopt / adapt / skip for TNL)
- **Shop stats (ADOPT, S–M, about 2 days).** Per-listing views, saves, offers and sales, plus totals: "potential earnings" = sum of active listings' "you earn". TNL already computes "you earn" live and has admin market stats. Expose a member-side version. Needs a cheap `listing_views` counter, or reuse the existing recently-viewed data.
- **Top Seller badge (ADAPT, small).** TNL already has levels and rep, earned from others' actions. Do not add a second badge system. Instead, feed market reliability (on-time shipping %, review average, disputes) into what rep can unlock, or show "ships in ~N days · 4.8★ (32)" on the shop. Depop's monthly listing-volume requirement (50/mo) rewards volume resellers, so skip it for creatives.
- **Vacation mode (ADOPT, S, under 1 day).** A profile toggle that hides "Buy" and "Add to bag" (listings stay visible, labelled "Away until <date>") and auto-replies in DMs. Prevents unshipped-order disputes.
- **Repeat-buyer tools (ADAPT, S).** Via "Offer to savers" plus a "past buyers" audience, e.g. notify past buyers of new drops, opt-in. TNL's follow graph already does most of this.

### Gaps
- Depop Shop Stats depth (per-listing views? traffic sources?). Depop has no public "Depop Pro" subscription that I found. A "Pro" plan was not evidenced in 2025–2026 sources; only the Selling API and Top Seller exist.

## 5. Social: messaging, likes vs saves, reviews, badges, guidelines, styling/modelling culture

### Takeaway
Depop's social layer is lighter than TNL's, but its styling culture is the brand. In Sept 2025 Depop launched **Outfits**, a shoppable collage/mood-board tool whose images share to Pinterest and Instagram. Likes double as the "interest list" that Send Offer targets. Ratings (4.5+) and dispute rate gate badges. Messaging must stay on-app for protection to apply.

### Cited Findings
- **Outfits** (24 Sept 2025): select an item, tap the scissors icon, and build a mood-board collage with backgrounds, resizing and templates. Every item is shoppable, and if one sells out the app suggests similar items. Static images share to Pinterest and Instagram. Available to all users and pitched at Gen Z collage culture — [TechCrunch](https://techcrunch.com/2025/09/24/depop-launches-a-fashion-collaging-tool-to-style-pinterest-worthy-outfits/)
- **Likes as purchase-intent signal**: Send Offer targets users who liked or bagged an item — [Depop newsroom](https://news.depop.com/depop-community-embraces-offers-as-suite-of-negotiation-tools-expands/); [Vendoo](https://blog.vendoo.co/how-to-send-offers-on-depop-or-cancel-them)
- **On-app messaging rule**: protection is lost if the parties communicated off-app. Off-platform payment requests risk suspension — [Vendoo](https://blog.vendoo.co/how-to-handle-depop-returns-and-refunds); [List Perfectly](https://listperfectly.com/selling/depop-terms-of-service-update-2026/)
- **Ratings in badges**: Top Seller requires a 4.5+ lifetime rating and disputes under 3% — [Depop TSP Code of Conduct v2](https://assets.depop.com/sellers/assets/TSP-Code-of-Conduct-v2.pdf)
- **Culture and marketing**: 2026 campaigns (Depoponomics with Kelis in Feb, Zara Larsson in July), a Spotify partnership (Aug) and a Governors Ball pop-up with AI virtual try-on (June) — [Roastbrief](https://roastbrief.us/depop-launches-depoponomics-a-national-campaign-reframing-resale-as-a-personal-economy/); [Yahoo/Governors Ball](https://shopping.yahoo.com/style/clothing/articles/depop-hold-pop-2026-governors-203624154.html); [fluf.io index](https://fluf.io/seller-news/category/depop)

### Inferences (adopt / adapt / skip for TNL)
- **Outfits → "Shop this post", extended (ADAPT, M, about 3–4 days).** TNL already has "Shop this post", which ties a post to listings. The Depop lesson is *multi-item, cross-seller* styled boards. Let a post or board tag up to about 6 listings from any seller. When one sells, show "sold, see similar" using the existing similar-items query. Sharing works through TNL's existing share card. Strong fit for a creative-first app, and creators styling other people's items gives sellers reach from what others do.
- **Likes vs saves (KEEP TNL's single "save").** Depop's like is both social applause and wishlist. TNL already merged that into saves, which feed price-drop alerts. Use saves as the audience for "Offer to savers", no new concept needed.
- **Review display (ADOPT, S).** Show the average plus count and the latest 3 reviews on the shop header and the listing page, e.g. "4.9★ · 27 sales". Reviews only count from buyers, which fits the "rep from others" rule.
- **Keep-it-in-DMs nudge (ADOPT, S).** Detect phone numbers, emails, "venmo", "cashapp" or "paypal f&f" in market DMs and show a warning chip, as Depop's rules imply. No dependency.
- **Modelling culture (ADOPT, S).** In the Media step, prompt "add a worn/styled shot". Optionally badge a listing's cover as "styled" when the seller ticks it.

### Gaps
- Official community-guidelines text (help centre blocked). Depop's public review UI details (star display, buyer-to-seller only?) were not verified for 2026.
- No published impact stats for Outfits.

## Summary priority list for TNL (effort: S ≤2d, M 2–5d, L >5d)

| # | Feature | Verdict | Effort | Why (evidence) |
|---|---|---|---|---|
| 1 | Counteroffers + 24h offer expiry | Adopt | M | 40%+ of Depop items sell via offers ([newsroom](https://news.depop.com/depop-community-embraces-offers-as-suite-of-negotiation-tools-expands/)) |
| 2 | Send offer to savers | Adopt | S–M | about 2M seller offers per week ([newsroom](https://news.depop.com/depop-community-embraces-offers-as-suite-of-negotiation-tools-expands/)) |
| 3 | Bundle discount in bag (X% off 2+ items / combined shipping) | Adopt | M | Depop shipping-based bundles ([OneShop](https://tools.oneshop.com/blog/bundles-in-depop)) |
| 4 | Style tags + browse-by-style | Adopt | S | Depop shoppers browse by aesthetic ([List Perfectly](https://listperfectly.com/?p=11184)) |
| 5 | Saved searches with alerts | Adopt | M | third-party evidence only |
| 6 | Shop stats for members | Adopt | S–M | Depop Shop Stats June 2025 ([VAR](https://www.valueaddedresource.net/depop-product-release-june-2025/)) |
| 7 | Vacation mode | Adopt | S | common resale feature ([Closo](https://closo.co/blogs/platform-specific-guides/depop-vacation-mode)) |
| 8 | Ship-by deadline + auto-cancel/refund | Adopt | M | Depop 2026 ToS ([List Perfectly](https://listperfectly.com/selling/depop-terms-of-service-update-2026/)) |
| 9 | Multi-item styled boards ("Outfits") | Adapt | M | Outfits Sept 2025 ([TechCrunch](https://techcrunch.com/2025/09/24/depop-launches-a-fashion-collaging-tool-to-style-pinterest-worthy-outfits/)) |
| 10 | AI auto-fill from photo | Adapt (needs owner approval: external AI service) | M–L | about half of listers tried it ([newsroom](https://news.depop.com/depop-launches-ai-powered-listing-from-one-photo/)) |
| 11 | Reserve/hold for one buyer | Adapt | S | custom bundle listing ([OneShop](https://tools.oneshop.com/blog/bundles-in-depop)) |
| — | Boost / Boost Shop | Skip (paid reach) | — | 8–12% attributed fee ([API](https://partnerapi.depop.com/api-docs/concepts/boosting/)) |
| — | Buyer marketplace fee | Skip | — | drip-pricing suit (Sept 2026) |
| — | Prepaid labels, wallet, Photoroom, CSV bulk | Skip / later | — | need new services or aren't relevant to TNL's sellers |
