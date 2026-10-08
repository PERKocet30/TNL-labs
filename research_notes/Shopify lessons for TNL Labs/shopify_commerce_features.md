# Shopify commerce features: what TNL Labs' marketplace should adopt (as of October 2026)

Scope note: research done 2026-10-08. Shopify's own figures are **company claims** unless stated otherwise. Repo facts were checked read-only in `/home/user/TNL-labs` (README.md "Market" row and route list; `src/app-14-*`, `src/app-17-bag.js`, `src/app-17-market.js`, `src/server-06-*`, `src/server-07-*`, `src/pay.js`). TNL rules that frame every recommendation: no new dependencies or external services without owner approval; payments, auth, uploads and admin changes need `/security-review`; every part file stays at or under 24KB (`app-17-market.js` is 22.4KB, `server-06-settings-payouts-market.js` is 21.8KB, `server-07-orders-sharing.js` is 20.0KB, so most market additions will need a new part file).

**What TNL already has (baseline, from repo):**
- Listing editor modeled on Shopify's product form: up to 8 media, title/description, pricing with live "you earn", inventory, shipping, details, status — README.md "Market" row (`/home/user/TNL-labs/README.md` line 21).
- Sizes/colours variants; every unit sold goes through `takeStock()`, and the listing closes at zero — README.md (`server-06-market-stock`); `src/server-06-market-stock.js`.
- Price-drop notifications sent to people who saved the listing (`notify(..., "price_drop", ...)`) — `src/server-06-market-stock.js` line 75.
- Restock = editing quantity ("quantity edits are how a brand adds a second run") — `src/server-06-settings-payouts-market.js` line 298.
- Bag: several items from one seller, one payment, shipping combined; `sessionFits()` binds a paid session to its group; `/api/shop/stats` — README.md (`server-07-cart`); `src/server-07-cart.js`.
- Order states: `pending → paid → shipped → complete` (plus `cancelled` for stale pending). Ship = free-text tracking string (≤80 chars) + notification; buyer confirms "received"; review after — `src/server-07-orders-sharing.js` lines 105, 149, 158-195.
- Oversold handling: the seller is told to "refund it from your Stripe dashboard" — there is no in-app refund/return flow — `src/server-07-orders-sharing.js` lines 113-116.
- Offers (accept/decline, then "go buy it"), likes/saves, recently viewed, drafts, Duplicate, sound downloads — README.md route list (lines 308-337); `src/server-06-settings-payouts-market.js` lines 348-388.
- No code hits for discount/coupon, gift card, pre-order, back-in-stock waitlist, pickup, tax, bundle, or abandoned-checkout recovery in the market files (grep across the files listed above, 2026-10-08).

---

## Seller-side: product/variant model, inventory, collections, discounts, gift cards, pre-orders, digital, bundles, draft orders, abandoned checkout, shipping, pickup, taxes, returns, order timeline, analytics, AI

### Takeaway
TNL already has the core of Shopify's product form. What it lacks are the **post-purchase operations** (returns and refunds in the app, a structured order timeline, carrier-aware tracking), **demand capture when stock is zero** (back-in-stock and pre-order), and **seller promotions** (codes and automatic discounts). Shopify itself ships only basic discount types natively and leaves tiered, bundle and pre-order logic to apps. So TNL can match the useful core with small native features and needs no new services.

### Cited Findings

**Discounts**
- Shopify's built-in discount types: Amount off (a percentage or fixed amount off a product, a collection or the whole order), Buy X get Y, and Free shipping (which can exclude rates above a set cost) — [Shopify Help: Discount types](https://help.shopify.com/en/manual/discounts/discount-types).
- BXGY can be a code or an automatic discount applied to the cart when its requirements are met — [Shopify Help: Discount types](https://help.shopify.com/en/manual/discounts/discount-types).
- Tiered, multi-step and custom-eligibility discounts need App Store apps (or Checkout Blocks on Plus). Stacking several savings in one discount (e.g. 10% plus free shipping) needs a third-party or custom app — [Shopify Help: Discount types](https://help.shopify.com/en/manual/discounts/discount-types).
- Legacy Shopify Scripts stopped running at the end of June 2026, so discount, shipping and payment customizations must move to Shopify Functions. Secondary sources disagree on whether the cutoff was June 30 or July 1 — [Fudge.ai June 2026 update](https://www.fudge.ai/blog/shopify-updates-june-2026/); [Novadata Summer '26](https://novadata.io/resources/news/shopify-summer-2026-editions-preview-june-2026).
- Summer '26 Storefront API 2026-07 restructured cart discount allocations to line-item and delivery-group level (secondary source) — [Shopify Community: Summer '26 Editions thread](https://community.shopify.com/t/shopify-summer-26-editions-just-dropped-heres-what-actually-matters-for-your-store/637080).

**Abandoned-checkout recovery**
- Shopify counts a checkout as abandoned when it stays incomplete for more than 10 minutes **after the buyer has entered an email**. Without an email it doesn't qualify — [Shopify Help: Abandoned checkouts](https://help.shopify.com/en/manual/orders/abandoned-checkouts).
- Automatic recovery emails are turned on in the Shopify Messaging app. The merchant picks who gets them and how long to wait, and each email links back to the checkout. They are suppressed if the buyer completed the sale, payment errored, shipping isn't supported, no products are available, or Shopify Payments blocked the payment as high risk — [Shopify Help: Abandoned checkouts](https://help.shopify.com/en/manual/orders/abandoned-checkouts).
- A checkout counts as "recovered" when the order is completed, whether through the email link or not. Abandoned checkouts are deleted after 3 months. A merchant can manually send a single buyer their checkout link, and anyone with the link can continue it — [Shopify Help: Abandoned checkouts](https://help.shopify.com/en/manual/orders/abandoned-checkouts).
- Recovery covers the Online Store and Buy Button channels only, not POS or third-party channels — [Shopify Help: Abandoned checkouts](https://help.shopify.com/en/manual/orders/abandoned-checkouts).

**Pre-orders / back-in-stock**
- Shopify's native building blocks are the Flow triggers "product variant out of stock" and "product variant back in stock", plus the variant setting "continue selling when out of stock". Full pre-order (deposits, charge later, dispatch dates) comes from apps such as PreProduct, StockFlow (from $49/mo) and Enterprise Pre-Order Manager — [PreProduct: Flow pre-order triggers](https://preproduct.io/docs/pre-order-shopify-flow-actions-and-triggers.md); [StockFlow app listing](https://apps.shopify.com/stockflow); [Enterprise Pre-Order Manager listing](https://apps.shopify.com/enterprise-pre-order-manager).

**Returns / exchanges (self-serve)**
- Buyers request returns of delivered items, or cancellation of unshipped items, from the **order status page**. Merchant rules set eligibility, the return window and who pays return shipping. The request form can collect a reason and the item's condition — [Shopify Help: Self-serve returns](https://help.shopify.com/en/manual/fulfillment/managing-orders/returns/self-serve-returns).
- The merchant is notified and approves or declines in the admin. On approval they can send shipping instructions and a return label, and add exchange items. Cancellations resolve through the standard refund flow — [Shopify Help: Self-serve returns](https://help.shopify.com/en/manual/fulfillment/managing-orders/returns/self-serve-returns).
- Baymard: 13% of US shoppers who abandoned a checkout cited an "unsatisfactory returns policy" — [Baymard: Cart abandonment rate](https://baymard.com/lists/cart-abandonment-rate).

**Fulfillment / shipping / pickup (2026)**
- Summer '26 brought multi-location pickup and mixed ship-and-pickup orders (POS/retail context; secondary source) — [Shopify Community: Summer '26 Editions thread](https://community.shopify.com/t/shopify-summer-26-editions-just-dropped-heres-what-actually-matters-for-your-store/637080).

**Analytics, testing, AI (Sidekick/Magic)**
- Summer '26 (June 17, 2026; "150+ updates") added native A/B testing. Merchants can schedule changes, roll them out gradually, and split-test themes, checkout configurations and customer-account changes — [Fudge.ai](https://www.fudge.ai/blog/shopify-updates-june-2026/); [Codilar Summer 2026](https://www.codilar.com/blog/shopify-summer-2026-edition/).
- Winter '26 introduced "Rollouts" (scheduled changes and A/B tests) and "SimGym" (testing site changes on simulated AI shoppers). A commentator cautions that simulated data shouldn't drive major decisions — [Tenten: Winter '26](https://tenten.co/shopify/shopify-winter-26-edition-ai-features/); [Influencer Marketing Hub](https://influencermarketinghub.com/shopify-renaissance-ai-commerce/).
- Sidekick has moved from a chatbot to an assistant that carries out multi-step admin tasks from plain-language requests ("show me last week's sales", "set up free shipping"). It drafts product descriptions, promotion ideas and support replies. One secondary source says a late-2025 update put Anthropic's Claude behind it — [Presta: Sidekick 2026](https://wearepresta.com/shopify-sidekick-features-2026-the-merchants-guide-to-agentic-commerce); [Tenten](https://tenten.co/shopify/shopify-winter-26-edition-ai-features/).
- Summer '26 "AI merchandising": AI Collection Sort, predictive cross-sell blocks and a merchandising insights panel — [Shopappy: Summer '26 AI merchandising](https://shopappy.com/platforms/shopify/shopify-summer-26-editions-ai-merchandising).

### Inferences
- **Discount codes per seller: ADAPT, small–medium (about 1–2 days).** Use a seller-scoped `discounts` table (percent or fixed amount, optional minimum, expiry, max uses), applied server-side when the bag checkout session is created. Skip BXGY and stacking: Shopify itself pushes those to apps, and TNL sellers are individuals. This touches the amount sent to Stripe, so it needs a security review. Commission should be computed on the discounted price.
- **Automatic "free shipping over $X" per seller: ADOPT, small.** It fits the existing combined-shipping bag (`server-07-cart.js`) and targets the #1 abandonment reason in Baymard's list (40% extra costs). Check that `sessionFits()` still binds totals correctly.
- **Back-in-stock waitlist: ADOPT, small (about 1 day).** TNL already has the pattern: price-drop notifications go to savers (`server-06-market-stock.js`). Add "Notify me" on a sold-out listing or variant and fire it on the quantity edit that already handles restocks (`server-06-settings-payouts-market.js` line 298). No new service is needed: in-app notify plus existing Resend email.
- **Pre-orders / drops with a ship date: ADAPT, medium.** Allow "sell before stock" with a seller-set ship-by date shown on the listing and order. Avoid deposits or charging later, which would need saved payment methods, Stripe SetupIntents and a security review. Charging in full with a clear date is simpler.
- **Self-serve returns + in-app refunds: ADOPT, medium–large (about 3–5 days).** This is TNL's biggest operational gap. Today refunds happen only in the seller's Stripe dashboard, and the oversold path tells sellers to refund manually (`server-07-orders-sharing.js` line 116). Proposed flow: buyer requests from the order (reason plus photo, within N days of `received`), seller approves or declines, then the refund runs through the Stripe Refunds API on the connected account. Commission reversal needs a policy decision. This is payments code, so it needs a security review.
- **Order timeline: ADOPT, small.** Store timestamped events (paid, shipped with tracking, delivered or received, review, refund) and render them on both buyer and seller order views. `orders` today keeps only `status` and `updated_at`.
- **Abandoned-bag nudge: ADAPT, small.** TNL has logged-in users, so it doesn't need email capture. Send one in-app or email nudge N hours after a checkout session expires with items still in the bag, suppressed if the items sold. Shopify's suppression rules make a good checklist.
- **Collections: ADAPT, small.** Let sellers group their own listings ("Drop 02", "Prints") on their shop. This is display-only and needs a new part file.
- **Gift cards: SKIP.** Stored value raises money-transmission and liability questions that don't suit a peer marketplace on Stripe direct charges.
- **Bundles: SKIP for now.** Combined-shipping bag checkout already covers most multi-item buying.
- **Draft orders / custom invoices: ADAPT later (via Offers).** The existing accepted-offer-then-buy flow already acts as a draft order. It could be extended so a seller sends a custom price and shipping to one buyer.
- **Shipping labels / carrier rates: SKIP (needs an external service, e.g. EasyPost or Shippo, which needs owner approval).** Cheap win instead: carrier dropdown plus a validated tracking number that renders as a link to the carrier's page.
- **Taxes: SKIP to seller.** Stripe Tax would be a new paid service. Under Standard Connect direct charges the seller is the merchant of record, but get legal advice on marketplace-facilitator rules if GMV grows.
- **Analytics: ADAPT, small.** Extend `/api/shop/stats` with views → saves → bag adds → purchases (a funnel), plus AOV and conversion per listing. Skip "live view".
- **AI (Sidekick/Magic): SKIP for now.** A listing-description helper would need an LLM API, which is a new external service and needs owner approval.

### Gaps
- I didn't fetch Shopify's current help pages for Shopify Shipping labels, local pickup, Shopify Tax, gift cards, Shopify Bundles, Shopify Digital Downloads or native analytics (sessions, conversion funnel, live view), so no cited specifics are given for those. The Bundles/Digital Downloads search returned only third-party pre-order apps.
- I found no Shopify-published data on the conversion impact of discounts, back-in-stock or self-serve returns.
- I couldn't reach the official Summer '26 Editions page (shopify.com/editions/summer2026 returned 404; the /editions index listed names only). Summer '26 details come from secondary coverage.

---

## Buyer-side: Shopify Checkout, one-page checkout, Shop Pay, Installments, Shop app, Shop Campaigns, post-purchase, order status page

### Takeaway
Shopify's headline checkout numbers (up to 36% better than competitors on average 15%, and Shop Pay up to 50% over guest) are **company-commissioned claims from an unnamed consultancy with no published methodology**. Independent and named data are much smaller (wallet lift of about 8–19% per Baymard via a third party; Princess Polly at 1–4%). For TNL the lessons are structural: show all costs early, keep checkout short, use stored identity, and give buyers an order status page that also handles returns.

### Cited Findings
- Shopify claims its checkout converts up to 36% better, and on average 15% (15.2%) better, than competitors, from "like-for-like samples" studied by an unnamed "Big Three" consulting firm. No sample size or date is given (page updated May 18, 2023). **Company claim; historical** — [Shopify Enterprise: Shopify Checkout](https://www.shopify.com/enterprise/blog/shopify-checkout).
- Same source: Shop Pay can lift conversion "as much as 50%" over guest checkout, beats other accelerated checkouts by "at least 10%", raises lower-funnel conversion 5% just by being present, and is "4x faster" than guest checkout. Over 100 million buyers are "pre-opted into one-click checkout". **Company claims** — [Shopify Enterprise: Shopify Checkout](https://www.shopify.com/enterprise/blog/shopify-checkout).
- Skeptical analysis: CleanCommit could not locate the study behind the 50% figure. It cites Shopify's own Princess Polly case (+4.1% for shoppers with an existing Shop Pay session, about 1–1.6% store-wide) and Baymard-cited wallet-button lift of about 8–19% — [CleanCommit: Shop Pay conversion rate](https://cleancommit.io/blog/shop-pay-conversion-rate/).
- Shop Pay GMV grew 53% year over year in Q2 2026. Total GMV was about $115.6B (+32%), revenue about $3.58B (+34%), and payments penetration 68% of GMV. Reported August 5, 2026; secondary coverage, not the press release — [EcomCrew: Shopify Q2 2026](https://www.ecomcrew.com/shopify-q2-2026-earnings/); [Platform Aeronaut 2Q26 summary](https://transcripts.platformaeronaut.com/summaries/SHOP-2Q26-AI-Summary).
- One-page checkout was announced in Winter '23 Editions (historical). Merchants can choose one-page or three-page checkout. Conversion evidence is mixed: vendor blogs estimate +2–7% or "1–3 percentage points", while merchant forum reports include sharp drops, partly from "reached checkout" being measured differently. One-page can show shipping before contact entry, which reduces emails captured for recovery — [Shopify Community: one-page or three-page option](https://community.shopify.com/t/updated-all-merchants-now-have-the-option-to-choose-one-page-or-three-page-checkout/267328/2); [Shopify Community: revert thread](https://community.shopify.com/t/revert-one-page-checkout-back-to-3-step-checkout-and-abandoned-email-flows-for-one-page-checkout/256197/132); [CartyLabs](https://cartylabs.com/blog/one-page-vs-multi-step-checkout/).
- Baymard (independent): average documented cart abandonment is 70.22% (50 studies; updated September 2025). Checkout abandonment reasons among US shoppers: extra costs too high 40%, delivery too slow 20%, distrust with card info 19%, forced account creation 18%, too long/complicated 17%, errors/crashes 17%, returns policy 13%, total cost not visible up front 12%, card declined 10%, not enough payment methods 9%. Baymard claims an average large site could gain 35.26% conversion through better checkout design — [Baymard: Cart abandonment rate](https://baymard.com/lists/cart-abandonment-rate).
- Shop Campaigns: a pay-per-conversion new-customer acquisition program in the Shop app. Merchants set a maximum CPA and are never charged more. Offers multiply buyers' Shop Cash. Eligibility conflicts across sources: US only, US/CA Plus only, or later expanded to UK — [Shopify Enterprise: Shop Campaigns](https://www.shopify.com/enterprise/blog/shop-campaigns); [Shopify Blog: Holiday sales on Shop](https://www.shopify.com/blog/holiday-sales-on-shop); [Shopifreaks](https://www.shopifreaks.com/?p=21033).
- Summer '26: products auto-syndicate to ChatGPT, Microsoft Copilot, Google AI Mode, Gemini and the Shop app through the Universal Commerce Protocol (co-developed with Google). Checkout Components reached GA for Plus (secondary sources) — [Fudge.ai](https://www.fudge.ai/blog/shopify-updates-june-2026/); [Shopappy: what Shopify actually announced](https://shopappy.com/ecommerce/shopify-editions-summer-26-what-shopify-actually-announced).
- Agentic Storefronts (January 2026) put merchant products inside ChatGPT, Perplexity and Copilot conversations. Agentic Checkout supports Visa TAP and Mastercard Agent Pay (secondary) — [Presta: Sidekick 2026](https://wearepresta.com/shopify-sidekick-features-2026-the-merchants-guide-to-agentic-commerce).
- The order status page is where self-serve returns and cancellations are requested — [Shopify Help: Self-serve returns](https://help.shopify.com/en/manual/fulfillment/managing-orders/returns/self-serve-returns).

### Inferences
- **Show total cost (item + shipping) on the listing and in the bag before Stripe: ADOPT, small.** Baymard's top reason (40%) plus "total not visible up front" (12%) argue for this. Check whether TNL's listing Buy bar already shows a shipping-inclusive total; if not, it is cheap.
- **Accelerated checkout (Shop Pay equivalent): ADAPT, low effort, needs owner and security review.** TNL already has identity (logged-in members). Stripe Checkout/Link can offer saved cards and Apple/Google Pay, which is wallet-button lift without a new vendor, since Stripe is already a dependency. Confirm which payment-method types are on for connected accounts. Treat Shopify's 50% figure as marketing; plan for single-digit lift.
- **Order status page per order: ADOPT, medium.** It would show the timeline, tracking link, "received" button, review, and a "request return / cancel before ship" button, and pairs with the seller-side returns recommendation.
- **Installments (Shop Pay Installments / Affirm / Klarna): SKIP.** It is unnecessary at TNL price points, and Klarna/Affirm through Stripe would still need owner approval and a security review.
- **Shop app / Shop Campaigns / agentic syndication: SKIP.** These are network-scale features. TNL's analogue is its own feed and "Shop this post".
- **Post-purchase upsell: ADAPT, small.** On checkout-done, show "more from this seller" (same seller, so it fits the one-checkout-per-seller model) rather than a one-click charge, which would need saved payment methods.

### Gaps
- I didn't fetch a primary Shopify source for Shop Pay Installments terms, Shop app tracking/following features, or Shop Minis. The search returned nothing on Minis.
- There is no independent, audited Shop Pay lift study. The only named-merchant data point (Princess Polly) comes via a third-party blog.
- Shopify's official Q2 2026 press release wasn't retrieved; the figures are secondary.

---

## Social/creator commerce: Collabs, Linkpop, social channels, creators/artists, Audiences

### Takeaway
Shopify's creator tooling has narrowed. **Linkpop shut down July 7, 2025 (historical)**. Collabs remains as an affiliate system (links and codes, a commission holding period, automatic payouts). The Collabs pattern maps naturally onto TNL's existing collab and rep model, but **paying affiliates is a payments change**. A no-money version (credit and rep for the referrer) is the safe first step.

### Cited Findings
- Collabs: creators with an active collab get an affiliate link or discount code, and each purchase with it can earn commission. Payouts are automatic on a schedule set by the merchant once the creator enables auto-payouts. If a merchant requested a W-9 and none is filed, payouts are capped at $599.99/yr. Analytics show visits, sales and earnings, and commissions adjust for refunds — [Shopify Help: Getting paid on Collabs](https://help.shopify.com/en/manual/promoting-marketing/collabs/creators/payments?r_done=1).
- Merchant side: commissions are billed on the Shopify bill as "Shopify Collabs Commission". They have a holding period (default 30 days, configurable 1–90) during which cancelled or refunded orders void the commission, plus a 2.9% processing fee on automatic payments — [Shopify Help: Pay creators on Collabs](https://help.shopify.com/cs/manual/promoting-marketing/collabs/merchants/payments).
- Collabs Network lets verified creators generate affiliate links without approval. Merchant eligibility per a changelog: a completed profile, not dropshipping, automatic payments, and $10K in sales over 365 days (may be outdated) — [Shopify Help: Collabs Network](https://help.shopify.com/en/manual/promoting-marketing/collabs/merchants/collabs-network?r=ecm-bfs); [Shopify Changelog](https://changelog.shopify.com/posts/fast-track-affiliate-sales-on-shopify-collabs-by-joining-collabs-network).
- Linkpop (link-in-bio) shut down July 7, 2025: no new pages or edits, and selling Shopify products from Linkpop pages ended. One source says the app was removed from the App Store in June 2026 (single source) — [FirstPier: What happened to Linkpop](https://www.firstpier.com/resources/linkpop); [Taplink](https://taplink.at/en/blog/linkpop-over.html); [brandID](https://brandid.app/reviews/linkpop/).
- Shopify Protect covers Shop Pay transactions made on Facebook, Instagram and Google (see Trust section) — [Shopify Protect](https://www.shopify.com/protect).

### Inferences
- **Referral links on listings (no-money version): ADOPT, small.** A member shares `/m/:id?ref=name`, and the sale records the referrer. Credit them visibly ("sold via @x") and, if the owner agrees, as a rep event, since a referral is "what other people do with your work", consistent with the rep rules.
- **Paid affiliate commission (true Collabs): ADAPT later, large, needs a security review.** Copy Shopify's safeguards: a holding period of at least the return window, voiding on refund, and a cap or tax-form threshold. With Standard Connect direct charges, paying a third party means a separate transfer from TNL's application fee, so model it as "seller shares part of their earnings" funded from the seller's payout.
- **Shop this post: already present; extend.** Allow tagging a listing in a collab post so both collaborators' audiences see it.
- **Link-in-bio (Linkpop clone): SKIP.** Shopify itself retired it. A member's `/u/:name` profile with shop tab already does this job.
- **Instagram/TikTok catalog channels: SKIP.** They need Meta/TikTok integrations (new services). TNL's CLAUDE.md already treats Instagram as reach-only.

### Gaps
- I couldn't confirm whether **Shopify Audiences** was sunset; the search returned nothing on it.
- The shopify.com/collabs landing page gave no stats or pricing; there are no Shopify-published Collabs conversion figures.
- I didn't verify the current state of Shopify's TikTok, YouTube or Instagram channel apps.

---

## Drops and hype launches: queues, throttling, bot protection, flash-sale tooling

### Takeaway
Shopify's native drop tooling is **bot protection for Plus stores only**: a scheduled event of up to 60 minutes with a CAPTCHA checkpoint. Waiting rooms and cart-hold inventory reservations come from third-party apps. TNL's `takeStock()` single-writer SQLite model already prevents most overselling. What's missing is a scheduled go-live, a per-user purchase limit, and a fair, bot-resistant gate.

### Cited Findings
- Shopify bot protection: Plus only, activated through Plus Support. It blocks known bots from checkout, slows bot activity, and by default blocks bots from auto-completing checkouts. It is explicitly "not meant to combat bot-related fraud" and covers the Online Store channel only — [Shopify Help: Bot protection](https://help.shopify.com/en/manual/checkout-settings/bot-protection).
- Events run up to 60 minutes, one scheduled at a time, can't be edited once active, and cover all published products or up to 500 selected products (not whole collections). They require reCAPTCHA or hCaptcha (image select, draw a box, or custom skill-testing questions). The checkpoint page is styleable via `checkpoint.liquid` — [Shopify Help: Bot protection](https://help.shopify.com/en/manual/checkout-settings/bot-protection).
- There is no native Shopify waiting room or queue. CrowdHandler (a third-party waiting room) blocks add-to-cart for queue bypassers and cancels or refunds orders that get through. Its anti-cheat is incompatible with accelerated checkout buttons on product pages — [CrowdHandler: Flash sale on Shopify guide](https://www.crowdhandler.com/docs/80001187610-complete-guide-planning-and-executing-a-flash-sale-on-shopify-using-crowdhandler).
- Cart Reserve (third-party) holds inventory on add-to-cart and auto-releases expired holds — [PickYourApp: Cart Reserve](https://pickyourapp.com/collections/store-management-security-fraud/products/cart-reserve).
- Scale context: Shopify says one brand had 40,000+ buyers checking out simultaneously, and its 2022 peak holiday event processed $3.5M/minute. **Company claim; historical** — [Shopify Enterprise: Shopify Checkout](https://www.shopify.com/enterprise/blog/shopify-checkout).

### Inferences
- **Scheduled drops: ADOPT, small–medium.** Add a listing `goes_live_at` with a countdown on the listing and profile, plus "remind me" using the back-in-stock notify mechanism. This is the creator-native version of Shopify's flash-sale scheduling.
- **Per-buyer limit per drop: ADOPT, small.** Enforce it server-side in `/api/market/:id/buy` and `/api/cart/checkout`, keyed by user id. TNL's verified-account requirement (`verified` middleware on cart checkout) and existing rate limits (`rateLimit({max:20/hour})`) already do much of what Shopify needs CAPTCHAs for.
- **Short stock reservation during checkout: ADAPT, medium, needs a security review.** Hold units for the life of the Stripe session (e.g. 15–30 min) so a sold-out drop doesn't produce the existing "OVERSOLD … refund it" path (`server-07-orders-sharing.js` line 116). Release on session expiry; the stale-pending sweeper at line 138-149 is the natural hook.
- **CAPTCHA / waiting room: SKIP.** It needs an external service. Login, verification and rate limits are a stronger gate on a members-only app than Shopify's anonymous storefront has.

### Gaps
- I found no primary source on the Kylie Cosmetics or Supreme launch mechanics on Shopify, or on any current Shopify-native checkout queue/throttle (Shopify's old "checkout queue" for Plus flash sales is not described on the current bot-protection page). No "Shopify Flash Sale" product was found.

---

## Trust: Shopify Protect, fraud analysis, buyer protection

### Takeaway
Shopify Protect is free but narrow: US stores, Shop Pay through Shopify Payments, **fraud** chargebacks only, and it requires fulfillment plus tracking within 7 days through approved carriers. It excludes digital goods and pickup. The transferable lesson for TNL is the **condition**: protection depends on timely shipping with real tracking. TNL can ask sellers to meet the same bar, using its existing admin "orders not shipped after 3 days" signal.

### Cited Findings
- Shopify Protect is Shop Pay's free, built-in chargeback protection on eligible Shop Pay transactions through Shopify Payments. On protected fraud chargebacks Shopify covers the order cost and chargeback fee and handles the dispute. Orders marked "protection active" are safe to fulfill. It also covers Shop Pay transactions on Facebook, Instagram and Google — [Shopify Protect](https://www.shopify.com/protect).
- Conditions: US stores only, fulfillment and a tracking number within 7 days of order receipt, and an approved carrier. "Terms and conditions apply" — [Shopify Protect](https://www.shopify.com/protect).
- Digital products and in-store pickups are excluded. Only true-fraud (or Shopify-error) chargebacks are covered, not "not as described" disputes (third-party guide) — [Chargeback.io](https://www.chargeback.io/blog/shopify-chargeback-protection); [ClearSale](https://www.clear.sale/blog/does-shopify-fraud-protect-really-help-merchants).
- One third-party guide says Shopify's older Fraud Protect tool was sunset January 31, 2025, with Shopify Protect (through Shop Pay) as the default. **Historical; secondary** — [Chargeback.io](https://www.chargeback.io/blog/shopify-chargeback-protection).
- Abandoned-checkout views separate checkouts blocked as high risk, and some card-testing or bot checkouts are filtered out (not all) — [Shopify Help: Abandoned checkouts](https://help.shopify.com/en/manual/orders/abandoned-checkouts).
- Baymard: 19% of abandoners distrust the site with card info — [Baymard](https://baymard.com/lists/cart-abandonment-rate).

### Inferences
- **"Ship within N days with tracking" seller standard: ADOPT, small.** Show "Ships in N days" on listings. Auto-flag late orders to the buyer and seller, not only the admin, and let the buyer cancel for a refund after N + grace days (pairs with in-app refunds).
- **Fraud signals: ADAPT, nothing new to build.** With Standard Connect direct charges, Stripe Radar runs on the seller's account and disputes land with the seller. Make sure sellers can see the Stripe risk outcome or dispute status from the order view (read-only, via existing Stripe calls). This touches `pay.js`, so it needs a security review.
- **TNL buyer guarantee (platform-funded): SKIP for now.** Shopify funds Protect at network scale. TNL could instead give a clear policy: refund if not shipped or tracked within N days, or if it arrives not as described, enforced through the returns flow.
- **Trust badges at checkout: ADOPT, trivial.** Show "Secure checkout by Stripe", the seller's review count and rating, and the returns policy on the bag. These target Baymard's 19% distrust and 13% returns-policy reasons.

### Gaps
- I didn't fetch the full Shopify Protect terms page (fee pass-through amounts and the approved-carrier list). The "$10–30 issuer fee pass-through" appears in only one secondary source and is omitted above.
- I found no Shopify data on Protect's effect on fraud rates or merchant losses.
