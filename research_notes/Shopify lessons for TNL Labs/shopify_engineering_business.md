# Shopify engineering and business model vs TNL Labs (as of October 2026)

Scope: Shopify's core engineering (monolith, modularity, typing, runtime, data and pods, BFCM scale, resiliency, deploys, testing, AI), frontend platform, payments engineering, and business model, compared with TNL Labs. The TNL baseline audit (`research_notes/TNL Labs code vs Instagram code/tnl_codebase_audit.md`) is not repeated here. TNL facts below come from reading the repo on 2026-10-08 and cite file and line. Items older than 2025 are marked **[historical]**. Research date: 2026-10-08.

---

## 1. Engineering: monolith, modularity, typing, runtime, data, scale, resiliency, deploys, testing, AI

### Takeaway
Shopify still runs one very large Rails monolith with millions of lines of code. It has made that monolith work at a peak of 489M edge requests per minute (BFCM 2025) by doing six things:
- splitting the code into internal components, with boundaries enforced by static analysis (Packwerk, now used more narrowly than first intended);
- gradual typing (Sorbet);
- its own Ruby JIT (YJIT, about 10–15% faster in production);
- sharding by shop into isolated "pods";
- year-round load testing and chaos testing (Genghis, Toxiproxy, Game Days);
- trunk-based development: a merge queue (Shipit), feature flags and fast rollback instead of staging.

The main lesson for TNL is the philosophy, not the tools: stay a monolith, add boundaries and checks gradually, and contain the blast radius.

### Cited Findings

**Monolith and modularity (Packwerk)**
- Shopify chose a "modular monolith" over microservices: it componentized the Rails monolith instead of splitting it into services **[historical, 2019]** — [InfoQ 2019](https://www.infoq.com/news/2019/07/shopify-modular-monolith); [Shopify Eng: Deconstructing the monolith](https://shopify.engineering/deconstructing-monolith-designing-software-maximizes-developer-productivity)
- Shopify released Packwerk in Sept 2020. It is a static analysis gem that enforces package boundaries and the dependency graph in Rails apps **[historical]** — [Shopify Eng: Enforcing modularity with Packwerk](https://shopify.engineering/enforcing-modularity-rails-apps-packwerk)
- In a Feb 2024 retrospective, Gannon McGibbon and Chris Salzberg called Packwerk "a sharp knife" that "must be wielded with care." Their points:
  - The monolith has "millions of lines of code"; its "thousands of files" were sorted into "a couple dozen" components.
  - Packwerk cannot see dynamically generated constants, `require`/`autoload` loading, routes, initializers or fixtures, so a package with zero violations can still fail at runtime.
  - **Privacy checks were removed in Packwerk 3.0.** They pushed developers toward API design rather than dependency management, and the authors say their debt is "far from paid off."
  - Isolating a zero-violation base package ("Platform Essentials") took many months.
  - The authors recommend measuring progress by whether code *runs in isolation*, not by violation counts.
  - Source: [Shopify Eng: A Packwerk retrospective](https://shopify.engineering/a-packwerk-retrospective)
- The earlier lesson: componentization alone was "a great first step," but "we need walls." Cross-component calls and shared Active Record models continued — [Shopify Eng: Enforcing modularity](https://shopify.engineering/enforcing-modularity-rails-apps-packwerk)
- Kirsten Westeinde's guidance was to restructure only once the "design payoff line" is crossed, meaning bad design is actively slowing features — cited via [Shopify Eng: Deconstructing the monolith](https://shopify.engineering/deconstructing-monolith-designing-software-maximizes-developer-productivity) (secondary summary in search results)

**Gradual typing (Sorbet)**
- Shopify adopted Sorbet in 2019 on a monolith of about 37,000 Ruby files, with about 400 commits merged daily **[historical]**:
  - 80% of files (including tests) are `typed: true` or stricter.
  - Every file must be at least `typed: false`.
  - CI runs Sorbet on every PR and fails the build on type errors.
  - About 60 other internal projects also use Sorbet.
  - Source: [Shopify Eng: The state of Ruby static typing at Shopify](https://shopify.engineering/the-state-of-ruby-static-typing-at-shopify)
- Adoption needed tooling:
  - per-file strictness "sigils" (`ignore` < `false` < `true` < `strict`);
  - RuboCop-Sorbet cops that flag unsupported constructs such as `const_get` metaprogramming and non-constant superclasses, and enforce minimum sigils;
  - Tapioca to generate RBI type files for gems and Rails DSLs.
  - Sources: [Shopify Eng: Adopting Sorbet](https://shopify.engineering/adopting-sorbet); [Shopify Eng: Static typing Ruby](https://shopify.engineering/static-typing-ruby)

**Runtime (YJIT)**
- YJIT is Shopify's JIT, upstreamed into CRuby. Reported production gains on Shopify's Storefront Renderer **[historical, 2021–2023]**:
  - about 6% on a canary in 2021 — [Shopify Eng: YJIT](https://shopify.engineering/yjit-faster-rubying)
  - about 10% on average with Ruby 3.2 — [Rails at Scale: Monitoring YJIT](https://railsatscale.com/2023-06-05-monitoring-yjit-in-production/)
  - Ruby 3.3 YJIT about 13% faster than 3.2 YJIT and about 15% faster than the interpreter — [Rails at Scale: Ruby 3.3's YJIT 15% faster](https://railsatscale.com/2023-09-18-ruby-3-3-s-yjit-runs-shopify-s-production-code-15-faster/)
- Measurement method: production traffic is split between YJIT-on and YJIT-off clusters at the same time, rather than comparing before and after a deploy — [Rails at Scale](https://railsatscale.com/2023-09-18-ruby-3-3-s-yjit-runs-shopify-s-production-code-15-faster/)

**Data and pods**
- Shopify's runtime is "podded." Each pod is an isolated Shopify instance with its own MySQL shard plus Redis and Memcached. Every shop-owned table carries `shop_id` as the shard key, and a routing layer maps each shop to its pod — [Shopify Eng: MySQL shard balancing at terabyte scale](https://shopify.engineering/mysql-database-shard-balancing-terabyte-scale)
- Shops are moved between shards online to rebalance hot shards, with near-zero downtime — [same](https://shopify.engineering/mysql-database-shard-balancing-terabyte-scale)
- Pods came after a single shared Redis caused a company-wide outage; an outage now affects one pod or region **[historical, Kir Shatrov]** — via [Ruby Weekly link to Shatrov](https://rubyweekly.com/link/49443/web) (secondary summary in search results)
- Not everything is podded: search is shared, and web/worker capacity is largely shared so spare capacity can absorb flash-sale spikes — [Datadog talk: Move to the cloud, double in size…](https://datadoghq.com/videos/move-to-the-cloud-double-size-or-automate-mysql-scaling-pick-three) (secondary summary in search results)
- Shopify relies on third parties for cloud hosting and uses "Google Cloud for most platform operations." It had about 7,600 employees at 31 Dec 2025 — [Shopify FY2025 10-K](https://www.sec.gov/Archives/edgar/data/1594805/000159480526000007/shop-20251231.htm)

**BFCM scale (actual production numbers)**

| Metric | BFCM 2024 | BFCM 2025 |
|---|---|---|
| Peak edge requests/min | 284M | 489M |
| Peak app-server requests/min | 80M | >117M |
| Peak API requests/min | — | 31.8M |
| Edge requests (weekend) | 1.19T | 2.2T |
| DB queries | 10.5T | 14.8T |
| DB writes | 1.17T | 1.75T |
| Data served | 57.3 PB | 90 PB |
| Sales (GMV) | — | $14.6B (+27% YoY) |
| Peak sales/min | — | $5.1M (12:01pm EST Black Friday) |
| Shoppers | — | 81M+ |

- 2025 figures: [Shopify BFCM 2025 press release (SEC EX-99.1, 2 Dec 2025)](https://sec.gov/Archives/edgar/data/1594805/000159480525000090/a2025bfcmpressrelease.htm). 2024 figures (plus 12 TB/min on Black Friday): [Shopify Eng: How we prepare Shopify for BFCM (2025)](https://shopify.engineering/bfcm-readiness-2025)
- Peak checkouts per minute in *production* for 2023–2025 were not found. The only checkout-rate figure is a test number: 80,000+ checkouts/min in scale test 4 (2025) — [Shopify Eng BFCM 2025](https://shopify.engineering/bfcm-readiness-2025)

**Load testing and resiliency**
- 2025 preparation, by Kyle Petroski and Matthew Frail (20 Nov 2025) — [Shopify Eng BFCM 2025](https://shopify.engineering/bfcm-readiness-2025):
  - Five scale tests ran April–October at forecast p90. Test 4 hit 146M RPM and 80k+ checkouts/min. The final test targeted p99 (200M RPM). Test 5 was a full dress rehearsal, the only one run in NA business hours.
  - **Genghis**, the in-house load generator, runs scripted browse → add-to-cart → checkout flows with flash-sale bursts on top of baseline load. It runs against *production* from three GCP regions (us-central, us-east, europe-west4).
  - **Toxiproxy** injects network faults and partitions. **Game Days** run chaos tests on critical journeys: checkout, payment processing, order creation, fulfillment.
  - A **Resiliency Matrix** documents failure scenarios, RTOs/runbooks and PagerDuty escalation paths. Teams ran region-evacuation drills.
- **Semian** (Shopify OSS) adds circuit breakers and bulkheads for Ruby `Net::HTTP`, MySQL, Redis and gRPC. For Shopify Payments card transactions, the breaker key includes the merchant's country, so one region's processor outage doesn't trip the others **[historical, 2022]** — [Shopify Eng: 10 tips for building resilient payment systems (Bart de Water, 28 Jul 2022)](https://shopify.engineering/building-resilient-payment-systems)
- Benchmark stores use a special payment gateway that mimics production latency and capacity, because partner test environments don't behave like production. Scriptable load balancers queue excess buyers during flash sales — [same](https://shopify.engineering/building-resilient-payment-systems)

**Deploys, CI, testing, observability**
- **[historical]** Trunk-based development, about 400 commits merged to master daily. The **merge queue** was built into **Shipit**, Shopify's deploy orchestrator: it runs CI before merging, removes PRs that fail, and keeps master green and deployable — [Shopify Eng: Successfully merging the work of 1000+ developers](https://shopify.engineering/successfully-merging-work-1000-developers); [Shopify Eng: Introducing the merge queue](https://shopify.engineering/introducing-the-merge-queue)
- **[historical]** About 100k unit tests in the monolith. CI on Buildkite with hundreds of parallel workers keeps a build to 15–20 minutes. Deploys go out in batches of 5–10 commits. "We don't practice staging or canary deploys, instead we rely on feature flags and fast rollbacks" — [Shopify Eng: E‑commerce at scale: inside Shopify's tech stack (StackShare repost)](https://shopify.engineering/e-commerce-at-scale-inside-shopifys-tech-stack)
- Automatic deployment: deploys trigger automatically after a green build — [Shopify Eng: Automatic deployment at Shopify](https://shopify.engineering/automatic-deployment-at-shopify)
- A newly introduced flaky test is a named failure mode of the merge queue — [Shopify Eng: Successfully merging…](https://shopify.engineering/successfully-merging-work-1000-developers). Florian Weingarten's talk: binary-search to isolate leaky or flaky tests, and "shitlist-driven development" (an allow-list of existing violations that may only shrink) — [RubyEvents talk](https://www.rubyevents.org/talks/shitlist-driven-development-and-other-tricks-for-working-on-large-codebases)
- Observability practice for payments — [Shopify Eng: 10 tips](https://shopify.engineering/building-resilient-payment-systems):
  - the four golden signals;
  - separate business *failures* (e.g. insufficient funds) from *errors* (HTTP 500s from partners);
  - track latency separately for successes and failures, because fast breaker failures skew the graph;
  - structured key=value or JSON logs;
  - a `correlation_id` created at request start and carried through jobs, API params and SQL comments.
- Incident practice: the Slack bot "spy" opens incidents. Three roles: IMOC, Support Response Manager, service owners. The bot auto-generates a Service Disruption record, and a retrospective follows within a week — [same](https://shopify.engineering/building-resilient-payment-systems)

**AI usage**
- Tobi Lütke's internal memo (dated late March 2025, posted publicly 7 Apr 2025): "Reflexive AI usage is now a baseline expectation at Shopify."
  - AI-use questions are added to performance and peer reviews.
  - Prototyping should start with AI.
  - Teams must show why AI can't do the work before asking for more headcount.
  - Sources: [The Logic](https://thelogic.co/briefing/shopify-staff-must-use-ai-lutke-says/); [Workplace Journal](https://workplacejournal.co.uk/2025/04/shopify-ceo-calls-for-reflexive-ai-use-as-baseline-expectation-no-headcount-growth-until-options-explored/); [American Bazaar](https://americanbazaaronline.com/2025/04/08/shopify-ceo-issues-ultimatum-for-employees/) (news paraphrases; the original is Lütke's X post)

### Inferences
- Shopify's architecture path was: monolith → components → enforced boundaries → pods. Each step came when pain was measurable, not ahead of it. TNL's numbered-parts monolith is an early, file-level version of the "componentized monolith." The Packwerk lesson is that boundaries enforced by static checks are only useful if the code actually runs in isolation. For TNL that argues for *runtime* tests over naming conventions.
- Sorbet's sigil model maps directly onto TNL's plain JS: `// @ts-check` plus JSDoc types, checked by `tsc --noEmit`, gives gradual per-file typing. It needs `typescript` as a *dev* dependency, or a one-off `npx` in CI, so tag it [new dep (dev only)]. TNL has no such check today.
- Pods are shard-by-tenant for blast-radius isolation. TNL has no tenants and one SQLite file; the transferable idea is that payment calls get a circuit breaker and timeout so a Stripe outage doesn't block the whole Node event loop.
- Shopify skips staging and canaries and relies on flags plus fast rollback. That is close to TNL's push-to-main deploy, except Shopify gates it with a merge queue and 100k tests. TNL has the CI gate and an admin Settings toggle pattern (e.g. Studio on/off), but should treat the toggle as a deliberate kill switch for money paths.

### Gaps
- No 2025–2026 Shopify post found with current monolith size, commits/day, deploys/day or test count. The 400 commits/day, 100k tests and 5–10 commit batches are **historical** (circa 2019–2021).
- No primary source found on Shopify's current test-selection system or flaky-test quarantine tooling.
- Production peak checkouts/min for BFCM 2023–2025 and full BFCM 2023 engineering numbers were not retrieved.
- Current pod count and Shopify's background-job framework (the Sidekiq-like system, job-iteration) were not researched in this pass.
- No source checked whether Shopify publicly reports how much code is now AI-written.

---

## 2. Frontend: Liquid, Online Store 2.0, Hydrogen/Oxygen, Polaris, checkout extensibility, Functions

### Takeaway
Shopify's frontend strategy, as of October 2026, is moving toward framework-agnostic, sandboxed, size-limited extension points:
- Polaris rebuilt as web components (stable October 2025);
- checkout extensibility replacing `checkout.liquid` (fully sunset August 2025);
- Shopify Functions compiled to Wasm with hard instruction budgets;
- Hydrogen now on React Router 7.

Shopify standardizing on web components and no-framework UI is an outside endorsement of TNL's no-framework approach.

### Cited Findings
- **Polaris web components:**
  - Early access in May 2025. Stable on 1 Oct 2025 for extensions on API version `2025-10`.
  - Served from Shopify's CDN, "framework-agnostic," and covering Admin, Checkout, Customer Accounts, POS and App Home.
  - 14 new App Home components were added since early access.
  - Sources: [shopify.dev changelog: Polaris unified web components stable](https://shopify.dev/changelog/polaris-unified-web-components-are-now-stable); [Shopify Partners blog: Polaris unified and for the web](https://www.shopify.com/partners/blog/polaris-unified-and-for-the-web)
- Third-party reports on Polaris/extensions **[secondary]** — [Gadget: API 2025-10 web components + Preact](https://gadget.dev/blog/shopify-api-2025-10-web-components-preact):
  - extensions on 2025-10 move to Preact;
  - extensions have a 64 KB bundle-size limit;
  - Polaris React is effectively in maintenance mode.
- **Checkout extensibility and `checkout.liquid` sunset:**
  - `checkout.liquid` is unsupported for the Information, Shipping and Payment steps (deadline 13 Aug 2024).
  - `checkout.liquid`, additional scripts and script tags on Thank-you and Order-status pages were sunset on 28 Aug 2025.
  - Shopify Scripts ran alongside until 28 Aug 2025.
  - Sources: [The Atlas Insider: Goodbye checkout.liquid](https://theatlasinsider.beehiiv.com/p/goodbye-checkoutliquid); [Impression Digital](https://www.impressiondigital.com/blog/shopify-checkout-extensibility) (secondary; dates should be confirmed in the shopify.dev changelog)
- **Shopify Functions:**
  - Functions run as WebAssembly. Any language that compiles to Wasm works (Rust, Zig, TinyGo, or JS via an embedded engine).
  - Shopify recommends Rust for public apps, large carts or heavy computation.
  - The budget is 11 million instructions for carts up to 200 lines, scaling with cart size. Going over raises `InstructionCountLimitExceededError`.
  - JS costs "many more" Wasm instructions per line because it is interpreted.
  - Sources: [shopify.dev: Functions language considerations](https://shopify.dev/docs/apps/build/functions/programming-languages); [shopify.dev: Optimize instruction counts](https://shopify.dev/docs/apps/build/functions/optimize-instruction-counts)
  - Reported Wasm module size cap: 256 KB (developer report) vs 200 KB (blog). These conflict — [community.shopify.dev](https://community.shopify.dev/t/javascript-function-wasm-size-doubles-on-shopify-cli-4-4-0-exceeds-256kb-deploy-fails-with-version-couldnt-be-created/36487)
- **Hydrogen/Oxygen:**
  - Hydrogen moved onto React Router 7 in May 2025 (successor to Remix). Future Hydrogen versions support only RR7. Migration requires enabling Remix future flags, Vite, and a codemod — [Hydrogen update May 2025](https://hydrogen.shopify.dev/update/may-2025)
  - Oxygen is Shopify's edge hosting for Hydrogen — [same](https://hydrogen.shopify.dev/update/may-2025)
  - A partner guide references `@shopify/hydrogen ^2026.1.0` with `react-router 7.12.0` — [Pack Digital RR7 migration](https://docs.packdigital.com/implementation-guides/react-router-7-migration) (secondary)

### Inferences
- Shopify keeps a hard *budget* on every extension point (64 KB bundles, an 11M-instruction Wasm cap, a 5-second webhook response window per §3). TNL's ≤24KB-per-part rule is the same idea applied to its own source. Asserting a gzipped size budget for `public/index.html` in `npm test` would extend it [no new dep].
- Polaris moving from React to CDN-served web components backs TNL's decision to avoid a framework. TNL doesn't need Hydrogen-style headless architecture; that solves a multi-storefront problem TNL doesn't have.

### Gaps
- No primary-source detail found on Liquid's runtime (Storefront Renderer) or Online Store 2.0 (sections everywhere, JSON templates, app blocks) beyond general knowledge. Not cited here, so the report writer should not assert specifics.
- Oxygen pricing and limits as of 2026 were not found.

---

## 3. Payments engineering: Shopify Payments on Stripe, idempotency, webhooks, state, reconciliation, money

### Takeaway
Shopify's published payments practice comes down to a few rules:
- every money-moving request carries an idempotency key, stored server-side with a lock and step-wise recovery points;
- every external call has a short timeout and a circuit breaker;
- every record is reconciled against the processor, with anomalies auto-fixed where possible;
- webhooks are treated as at-least-once, unordered and lossy, so they are deduplicated and backed by a periodic reconciliation job.

TNL already has two of these: a status-guarded settle and a lazy reconciler. It lacks Stripe idempotency keys, a signed webhook, refund/dispute state, a stored fee per order, and timeouts on Stripe calls.

### Cited Findings

**Shopify Payments and Stripe**
- Shopify Payments card processing is done by Stripe ("Shopify Payments, powered by Stripe") — [The Logic: Shopify's secret growth weapon, Stripe](https://thelogic.co/news/shopifys-secret-growth-weapon-stripe/); [FreshBooks](https://www.freshbooks.com/hub/payments/how-to-add-stripe-to-shopify) (secondary)
- Stripe also powers Shopify Balance. More than 100k US businesses opened accounts in its first four months — [Stripe customer story: Shopify](https://stripe.com/customers/shopify)
- Shopify's 10-K lists reliance on third parties "for … Shopify Payments" as a risk — [FY2025 10-K](https://www.sec.gov/Archives/edgar/data/1594805/000159480526000007/shop-20251231.htm)
- Launch year is uncertain: one guide says Shopify Payments launched in 2013 via a Stripe partnership — [Tevello](https://tevello.com/blogs/shopify-guides/understanding-the-relationship-between-shopify-payments-and-stripe) (secondary; unverified)

**Idempotency (Shopify's Payment Service)** **[historical, 2019, still the canonical reference]** — [Shopify Eng: Building resilient GraphQL APIs using idempotency (Todd Jefferson, 27 Aug 2019)](https://shopify.engineering/building-resilient-graphql-apis-using-idempotency)
- The Payment Service is owned by the Money Infrastructure team. Every mutation requires an idempotency key as a GraphQL *input field*, not a header.
- Requests are stored as an `IncomingRequest` row, unique on (client, key):
  - created → new request;
  - loaded → retry;
  - completed → the stored response is returned.
- A lock on (client, key) stops concurrent duplicates. A concurrent duplicate gets HTTP 409, meaning retry shortly.
- Each mutation is split into ordered **recovery points**, each with `run`, an optional `recover`, and a transactional flag. Steps are grouped as no side effects, local DB side effects (in a transaction), or remote side effects (provider calls). The last completed step is saved after each one, and a retry resumes at the first incomplete step.
- Trade-offs Shopify noted: an extra DB write per call, an unfamiliar style for new developers, recovery-point changes must stay compatible with stored in-flight requests, and every handler needs tests for every step and recovery path.
- Shopify chose API-level idempotency over automatic reconciliation for that service, because reconciliation needs per-provider work. A non-idempotent remote provider makes true idempotency "very hard."

**Shopify's 10 resilience tips for payments** **[historical, 2022]** — [Shopify Eng: 10 tips for building resilient payment systems](https://shopify.engineering/building-resilient-payment-systems)
- **Timeouts:** Ruby `Net::HTTP` defaults to 60s. Start with about 1s to connect and about 5s for read, write or query. Use MySQL `MAX_EXECUTION_TIME` and `pt-kill`.
- **Circuit breakers:** Semian, keyed by host+port (plus country for card payments). Test fallbacks with Toxiproxy.
- **Capacity:** Little's Law. Queues grow sharply at 70–80% utilization. Use rate limiting and load shedding.
- **Idempotency keys:** unique for the retry window (≤24h is typical). Prefer **ULIDs** over UUIDv4 for b-tree locality; one system saw about 50% lower INSERT time.
- **Reconciliation:** check per record (charges, refunds) and in aggregate (unpaid balance) against partners. Log typed anomalies (e.g. `MismatchCaptureStatusAnomaly`), auto-remediate first, and focus on preventing anomalies.
- **Monitoring and logging:** see §1. Separate failures from errors, and use correlation IDs.

**Webhooks (Shopify's guidance to app developers)**
- Shopify's guidance — [shopify.dev: Webhook best practices](https://shopify.dev/docs/apps/build/webhooks/best-practices):
  - verify `X-Shopify-Hmac-Sha256`;
  - deduplicate with `X-Shopify-Webhook-Id`;
  - ordering is **not** guaranteed, so order events with `X-Shopify-Triggered-At` or the payload's `updated_at`;
  - "shouldn't rely on" webhooks alone: run **reconciliation jobs** that fetch objects changed since the last run (`updated_at` filters), in the background or from a manual "reconcile" button.
- Dedup header conflict: Hookdeck names `X-Shopify-Event-Id` as the stable-across-retries dedupe key, while Shopify's page names `X-Shopify-Webhook-Id` — [Hookdeck](https://hookdeck.com/webhooks/platforms/how-to-handle-duplicate-shopify-webhook-events)
- Delivery is at-least-once, and endpoints must answer 200 within about 5 seconds — [Hookdeck](https://hookdeck.com/webhooks/platforms/how-to-handle-duplicate-shopify-webhook-events) (secondary)
- Retry figures conflict: 8 retries over 4 hours (Hookdeck) vs up to 48 hours with removal after 19 consecutive failures (ecosire). Not confirmed on shopify.dev — [Hookdeck](https://hookdeck.com/webhooks/platforms/how-to-handle-duplicate-shopify-webhook-events); [Ecosire](https://ecosire.com/hi/blog/shopify-webhooks-hmac-verification-retries)

**Stripe's own rules (directly applicable to TNL's integration)**
- Idempotency — [Stripe API: Idempotent requests](https://docs.stripe.com/api/idempotent_requests):
  - send the `Idempotency-Key` header on POST (no effect on GET/DELETE), up to 255 characters, V4 UUID or similar suggested;
  - Stripe stores the first result, *including 500s*, and replays it;
  - keys may be pruned after ≥24h;
  - reusing a key with different parameters is an error;
  - results aren't saved if validation fails or a concurrent request with the same key is executing, so those can be retried.
- Fulfillment — [Stripe docs: Fulfill orders (hosted Checkout)](https://docs.stripe.com/checkout/fulfillment.md?payment-ui=stripe-hosted):
  - "Webhooks are required for fulfillment." The landing page alone is insufficient because buyers may never return.
  - `fulfill_checkout(session_id)` must handle being called "multiple times, possibly concurrently," re-retrieve the session, check `payment_status`, and record fulfillment status.
  - Listen to `checkout.session.completed` and `checkout.session.async_payment_succeeded`, optionally `async_payment_failed`. Verify the `Stripe-Signature` header.
  - With a webhook endpoint registered, Checkout waits up to 10 seconds for the webhook response before redirecting.
  - Also trigger fulfillment from the landing page for speed.

**TNL's current money code** (read 2026-10-08)
- `src/pay.js` calls Stripe through raw `fetch`:
  - no `Idempotency-Key` header;
  - no timeout or `AbortSignal`;
  - non-2xx responses are logged and returned as `{error}`.
  - Source: [src/pay.js:47-60](src/pay.js)
- Checkout is a direct charge on the seller's account with `application_fee_amount = platformFee(amount, feePct)`. The fee is clamped to 0–30% and computed on items only, not shipping — [src/pay.js:26-29, 102-149](src/pay.js)
- The fee ladder is `FEE_BY_LEVEL = {1:10, 2:8, 3:6, 4:4, 5:2}`, applied from `feeForRep(seller.rep)` at checkout time — [src/db.js:782-785](src/db.js); [src/server-07-cart.js:64-72](src/server-07-cart.js)
- The `orders` table has `status` (pending | paid | shipped | complete | cancelled) and `payment_ref` (session id). There is **no column recording the fee or rate charged**, and no refunded or disputed state — [src/db.js:223-237](src/db.js); grep for `fee_cents|refund|dispute` finds only the oversold notice telling sellers to "refund it from your Stripe dashboard" — [src/server-07-orders-sharing.js:113-116](src/server-07-orders-sharing.js)
- Confirmation works two ways:
  - the unauthenticated redirect `/api/market/checkout/done` calls `verifySession`, then `sessionFits` checks that the session's `metadata.order_id` matches the lead order and `amount_total` equals the group total — [src/server-07-orders-sharing.js:75-96](src/server-07-orders-sharing.js); [src/server-07-cart.js:14-19](src/server-07-cart.js)
  - a **lazy reconciler** (`reconcileOrders`) re-verifies up to 5 stale pending orders (older than 5 min, re-checked at most every 5 min) whenever the buyer or seller loads `/api/orders`. It cancels unpaid ones after 25h — [src/server-07-orders-sharing.js:125-150](src/server-07-orders-sharing.js)
- `settlePaidOrder` re-reads status and only acts on `pending`. Because `node:sqlite` is synchronous and there is no `await` between the read and the `UPDATE`, this works as a compare-and-set within the single-threaded event loop. It awards `sale_made` rep and decrements stock — [src/server-07-orders-sharing.js:98-121](src/server-07-orders-sharing.js)
- No Stripe webhook handler exists (confirmed by the baseline audit; not repeated in detail here).

### Inferences
- **TNL is already closer to Shopify and Stripe practice than the audit's "no webhook" note suggests.** The settle function is idempotent, one function serves both the redirect and the reconciler (Stripe's recommended "call from both" pattern), and the session is bound to order id and amount. The remaining gaps:
  1. The reconciler only runs when an involved user opens their orders. A sale where neither party opens the app stays `pending`, and stock stays unreserved, until they do. A periodic in-process sweep or a webhook closes this.
  2. No idempotency key on `POST checkout/sessions`. Today a retry just creates a second session (low harm, because orders are bound to the session in `payment_ref`). Once TNL adds refunds or any server-initiated POST that moves money, the key becomes essential.
  3. No timeout on `fetch` to Stripe. A hung Stripe call holds the request (and the redirect) indefinitely; Shopify's "1s connect / 5s read" rule applies.
  4. No record of the fee rate charged. Because the rate depends on rep *at checkout time*, a later level change makes historical commission unreconstructable without Stripe. That breaks aggregate reconciliation (Shopify tip 7) and admin GMV-vs-commission reporting.
  5. No `refunded`/`disputed` states. Seller-initiated refunds in the Stripe dashboard (which TNL's own oversold notice tells sellers to do) never reach TNL, so the order stays `paid` and the `sale_made` rep stays awarded. That conflicts with the rule that rep is only earned from real external validation. Under Stripe's Connect docs, events on connected accounts (`charge.refunded`, `charge.dispute.created`) arrive at a *Connect* webhook endpoint with an `account` field. This is general Stripe knowledge, not fetched in this pass; the writer should confirm at docs.stripe.com/connect/webhooks.
- A per-step "recovery point" system like Shopify's is overkill for TNL. TNL has one remote side effect (create session) and one local transaction (settle). The minimum viable version: an `idempotency_key` column on orders sent as `Idempotency-Key`, plus a status guard (already present).

### Gaps
- No Shopify engineering post found specifically on "money" value handling (e.g. a Money type, rounding, currency subunits). It may exist; it was not retrieved. TNL's integer-cents-everywhere approach matches Stripe's model.
- No public Shopify source found describing Shopify Payments' internal payment state machine (authorized/captured/refunded transitions) or how Shopify reconciles against Stripe specifically.
- Stripe Connect webhook mechanics for Standard direct charges were not fetched (see the inference above).

---

## 4. Business model: revenue split, take rate, GMV, payments penetration, App Store share, Shop Pay, incentive alignment

### Takeaway
Shopify is mainly a payments company with a subscription front door. In FY2025, merchant solutions (mostly Shopify Payments fees) were about 76% of $11.56B revenue, and Shopify Payments carried 65.6% of $378.4B GMV. By Q2 2026, penetration was 68%. Subscription fees are kept low while monetization rides on GMV. That is the same "earn when the seller earns" alignment TNL's commission ladder targets, though Shopify *lowers effective cost for small developers* rather than rewarding seller reputation.

### Cited Findings
- **Revenue model:**
  - Two components — [FY2025 10-K](https://www.sec.gov/Archives/edgar/data/1594805/000159480526000007/shop-20251231.htm):
    - *Subscription solutions*: plans including variable platform fees, POS Pro, app sales, domains, themes.
    - *Merchant solutions*: mainly Shopify Payments processing and FX fees, plus lending (Capital), partner referral fees, shipping labels, POS hardware, App Store ads, Shop Campaigns.
  - No single merchant has exceeded 5% of revenue. Merchants are in 175+ countries: 44% US, 31% EMEA, 16% APAC, 5% Canada, 5% LatAm — [same](https://www.sec.gov/Archives/edgar/data/1594805/000159480526000007/shop-20251231.htm)

| | FY2024 | FY2025 | Q2 2026 |
|---|---|---|---|
| Total revenue | $8.88B | ~$11.56B (+30%) | ~$3.58B (+34%; +33% cc) |
| Subscription solutions | $2.35B | $2.75B | ~$802M (+22%) |
| Merchant solutions | $6.53B | $8.80B | ~$2.78B (+37%) |
| GMV | $292.3B | $378.4B (+29%) | ~$115.6B (+32%) |
| Shopify Payments GMV / penetration | $181.0B / 61.9% | $248.1B / 65.6% | ~$78.1B / 68% |
| Operating income | $1.07B | $1.46B | — |
| Free cash flow | $1.59B | ~$2.0B (17% margin) | $654M (18% margin) |
| MRR | — | — | $221M (vs $185M) |

  - Sources: [FY2025 10-K](https://www.sec.gov/Archives/edgar/data/1594805/000159480526000007/shop-20251231.htm) (GMV 2023: $235.9B); [Retail Insight Network](https://www.retail-insight-network.com/newsletters/shopify-posts-30-revenue-growth); [Digital Commerce 360](https://www.digitalcommerce360.com/2026/02/17/shopify-revenue-gmv-q4-2025/) (secondary for the revenue split); payments penetration from 10-K excerpts in [search of the 10-K](https://www.sec.gov/Archives/edgar/data/1594805/000159480526000007/shop-20251231.htm)
  - Q2 2026: [Shopify newsroom Q2 2026 (5 Aug 2026)](https://www.shopify.com/news/shopify-q2-2026-financial-results) confirms 34% growth and the 18% FCF margin. Dollar figures are from secondary coverage: [Beancount analysis](https://beancount.io/blog/2026/08/24/shopify-q2-2026-earnings-analysis), [EcomCrew](https://www.ecomcrew.com/shopify-q2-2026-earnings/), [Quartr](https://quartr.com/events/shopify-inc-shop-q2-2026_3eya9uq8). MRR growth is reported as 19% (Zacks) vs 20% (Yonhap). Net income conflicts ($420M vs $1.5B) and is not used.
  - Q1 2026: MRR $212M; merchant solutions 76% of revenue — [10-Q Q1 2026](https://www.sec.gov/Archives/edgar/data/0001594805/000159480526000019/shop-20260331.htm)
  - Net income FY2025 was $1.23B (vs $2.01B in 2024, driven by equity-investment swings) — [Retail Insight Network](https://www.retail-insight-network.com/newsletters/shopify-posts-30-revenue-growth)
- **Q3 2026 guidance:** revenue growth in the low-30s %, gross profit growth in the mid-to-high 20s %, opex 33–34% of revenue, FCF margin high-teens to low-20s — [Shopify newsroom](https://www.shopify.com/news/shopify-q2-2026-financial-results)
- **Take rate:** Shopify does not publish one. Merchant solutions ÷ GMV ≈ **2.33% (2025)** vs ≈2.23% (2024); total revenue ÷ GMV ≈ 3.05% (2025). These are calculated from the figures above, not a company-reported metric.
- **Other Q2 2026 metrics** **[secondary]** — [Quartr](https://quartr.com/events/shopify-inc-shop-q2-2026_3eya9uq8); [Platform Aeronaut summary](https://transcripts.platformaeronaut.com/summaries/SHOP-2Q26-AI-Summary):
  - Shop Pay GMV +53% YoY;
  - international GMV +37%, North America GMV +28%;
  - offline POS GMV +32%, B2B GMV +76%.
- Q1 2025 Shop Pay GMV was $22B (+57%) — [Zacks](https://www.zacks.com/stock/news/2554913/shopify-s-e-commerce-growth-picks-up-a-sign-for-more-upside)
- **App Store:**
  - More than 21,000 apps at 31 Dec 2025 — [10-K](https://www.sec.gov/Archives/edgar/data/1594805/000159480526000007/shop-20251231.htm)
  - Revenue share **[changed June 2025]** — [shopify.dev changelog: Update to app developer revenue share](https://shopify.dev/changelog/update-to-shopifys-app-developer-revenue-share); [Business Insider](https://www.businessinsider.nl/shopify-rolled-back-a-lifeline-it-extended-to-app-developers-during-the-pandemic); [Coast Reporter/Canadian Press](https://www.coastreporter.net/the-mix/shopify-developers-lose-annual-revenue-share-break-as-program-moves-to-lifetime-model-10604867):
    - 0% on the first **$1M lifetime** (previously reset annually), 15% above that;
    - effective 16 June 2025; earnings before 1 Jan 2025 don't count; earnings are aggregated at partner level;
    - before 2021 the share was 20% on all revenue;
    - developers earning over $1M/year lose about $150k/year.
- **"Arm the rebels":**
  - Lütke's framing: give independent merchants the tools to own their brand and customer relationship, against Amazon. The phrase is sometimes credited to DHH **[historical, 2020–2021]** — [Quartz](https://qz.com/1954108/shopify-is-arming-the-rebels-against-amazon); [Bloomberg 2020](https://www.bloomberg.com/view/articles/2020-05-08/coronavirus-amazon-is-challenged-by-shopify-costco-target)
  - The alignment mechanism is visible in the numbers: most revenue comes from merchant solutions tied to merchant GMV, so Shopify earns more only when merchants sell more (see the table above).

### Inferences
- Shopify's monetization is a ~2.3% GMV-linked take with low fixed subscription fees, and it rises as more GMV flows through its own rails. TNL's 10%→2% ladder is a marketplace commission on top of Stripe processing, which the seller pays on Standard. At level 5 (2%) TNL's take matches Shopify's blended merchant-solutions rate. At level 1 (10%) it is closer to Depop- or Etsy-style marketplaces.
- Shopify's App Store change (annual → lifetime $1M exemption) shows that a generous threshold is easy to grant and costly to take back: it drew press backlash. TNL's ladder rewards *rep*, which only goes up. If TNL ever adjusts `FEE_BY_LEVEL`, it should record the rate per order (see §3) and grandfather explicitly.
- Shopify keeps payments penetration high by making its own rails the default and charging extra for third-party gateways. That is general knowledge, not fetched in this pass. TNL achieves the equivalent by making Stripe Connect the only card path.

### Gaps
- Official Q2 2026 dollar figures were not read from the GlobeNewswire release or 10-Q; the dollar figures are from consistent secondary sources.
- A full-year 2025 Shop Pay GMV figure and the current Shop Pay user count were not found.
- The exact wording of the 10-K's FY2025 payments-penetration commentary was not verified. A search summary claimed "adoption decreased … as Shopify Payments expanded," which is inconsistent with penetration rising from 61.9% to 65.6%; treat it as unreliable.
- Partner-ecosystem size (number of partners, partner revenue multiple) was not found in this pass.

---

## 5. Side-by-side comparison and practices for a one-to-two-person team

### Takeaway
On architecture, TNL is a miniature, deliberately simpler Shopify: one monolith, one datastore, CI-gated trunk deploys, a no-framework UI. The gaps that matter at TNL's scale are almost all in the money path, and nearly all can be closed without a new dependency:
- Stripe idempotency keys;
- fetch timeouts;
- a signed Connect webhook that feeds the existing `settlePaidOrder`;
- a stored fee per order;
- refunded/disputed states that reverse rep;
- a scheduled reconciler.

Pods, Packwerk, YJIT-scale runtime work, Genghis and a merge queue are justified only at Shopify's scale.

### Cited Findings (comparison table)

| Dimension | Shopify (as of Oct 2026 unless marked) | TNL Labs (repo, 2026-10-08) |
|---|---|---|
| Architecture | One Rails monolith, "millions of lines," a couple dozen components, Packwerk dependency checks ([retrospective](https://shopify.engineering/a-packwerk-retrospective)) | One Express server built from numbered `src/server-NN-*.js` parts concatenated at boot; parts ≤24KB (CLAUDE.md) |
| Boundaries | Static dependency checks; privacy checks dropped in Packwerk 3.0 ([retrospective](https://shopify.engineering/a-packwerk-retrospective)) | Filename order and convention only; no automated cross-part checks (baseline audit) |
| Data | MySQL sharded by `shop_id` into isolated pods with Redis/Memcached; online shard rebalancing ([Shopify Eng](https://shopify.engineering/mysql-database-shard-balancing-terabyte-scale)) | One `node:sqlite` file in WAL mode on a Railway volume; daily `VACUUM INTO` backups (baseline audit) |
| Typing | Sorbet gradual typing, ≥`typed: false` everywhere, 80% `true`+, CI-enforced **[historical figures]** ([Shopify Eng](https://shopify.engineering/the-state-of-ruby-static-typing-at-shopify)) | Plain JS, no type checking |
| Runtime | YJIT, +10–15% on storefront **[historical]** ([Rails at Scale](https://railsatscale.com/2023-09-18-ruby-3-3-s-yjit-runs-shopify-s-production-code-15-faster/)) | Node 22.5+ (V8 JIT) |
| Testing | ~100k tests, hundreds of parallel CI workers, 15–20 min builds **[historical]** ([StackShare repost](https://shopify.engineering/e-commerce-at-scale-inside-shopifys-tech-stack)); Genghis load tests and Game Days ([BFCM 2025](https://shopify.engineering/bfcm-readiness-2025)) | Plain Node test scripts plus Playwright e2e at phone and desktop sizes; GitHub Actions on PRs; after-deploy live check (CLAUDE.md) |
| Deploy | Merge queue in Shipit, ~400 commits/day, batches of 5–10, no staging/canary, feature flags plus fast rollback **[historical]** ([Shopify Eng](https://shopify.engineering/successfully-merging-work-1000-developers)) | PR → green CI → merge to main → Railway deploy (~80s); admin toggles act as feature flags |
| Resiliency | Semian circuit breakers, Toxiproxy, tight timeouts, region evacuation ([10 tips](https://shopify.engineering/building-resilient-payment-systems); [BFCM 2025](https://shopify.engineering/bfcm-readiness-2025)) | No timeouts or breakers on Stripe/Resend `fetch` ([src/pay.js:47-60](src/pay.js)); single instance |
| Payments | Shopify Payments on Stripe; idempotency keys plus recovery points; per-record and aggregate reconciliation with typed anomalies ([Shopify Eng 2019](https://shopify.engineering/building-resilient-graphql-apis-using-idempotency); [2022](https://shopify.engineering/building-resilient-payment-systems)) | Stripe Connect Standard direct charges via raw fetch; status-guarded settle; session bound to order and amount; lazy reconciler on orders load; no webhook, no idempotency key, no stored fee, no refund/dispute states ([src/server-07-orders-sharing.js](src/server-07-orders-sharing.js)) |
| Frontend | Liquid/OS 2.0 themes; Hydrogen on React Router 7 plus Oxygen; Polaris web components; checkout UI extensions (Preact, 64KB); Functions in Wasm with an 11M-instruction cap ([shopify.dev](https://shopify.dev/changelog/polaris-unified-web-components-are-now-stable); [Functions](https://shopify.dev/docs/apps/build/functions/optimize-instruction-counts)) | No framework; `app-NN-*.{html,css,js}` assembled into one `public/index.html`; palette tokens in `src/palette.js` |
| Observability | Golden signals, failures vs errors, structured logs, correlation IDs, incident bot and retros ([10 tips](https://shopify.engineering/building-resilient-payment-systems)) | `console.error` logging (e.g. `[stripe]` lines in [src/pay.js:56](src/pay.js)); Railway logs |
| AI | "Reflexive AI usage is a baseline expectation" (Apr 2025) ([The Logic](https://thelogic.co/briefing/shopify-staff-must-use-ai-lutke-says/)) | Built with Claude Code; CLAUDE.md encodes the rules |
| Business | ~76% of revenue from merchant solutions; ~2.3% merchant-solutions/GMV; 65.6% payments penetration (2025) ([10-K](https://www.sec.gov/Archives/edgar/data/1594805/000159480526000007/shop-20251231.htm)) | `application_fee_amount` at 10/8/6/4/2% by rep level, on items only ([src/db.js:782](src/db.js); [src/pay.js:144](src/pay.js)) |

### Inferences — practices to adopt, prioritized

**A. Money code (do these first)**
1. **Idempotency key on every Stripe POST** [no new dep]
   - Add `orders.idempotency_key TEXT` (UUID from `crypto.randomUUID()`, created in the same transaction as the order rows).
   - Pass it as the `Idempotency-Key` header in `stripe()` for `checkout/sessions` and any future refund or transfer.
   - Reuse the same key on retry, and never reuse it with different params, since Stripe errors on a mismatch.
   - Basis: [Stripe idempotency](https://docs.stripe.com/api/idempotent_requests); [Shopify 10 tips #6](https://shopify.engineering/building-resilient-payment-systems)
   - ULIDs are unnecessary at TNL's insert rate.
2. **Timeouts on every outbound `fetch`** [no new dep]
   - Use `signal: AbortSignal.timeout(5000)` (Node 18+) for Stripe and Resend. Map an abort to `{error: "stripe timeout"}`.
   - Basis: [Shopify 10 tips #1](https://shopify.engineering/building-resilient-payment-systems)
   - A ~10-line in-memory circuit breaker (open after N consecutive failures for 30s) is optional [no new dep]. Semian-grade bulkheads are Shopify-scale only.
3. **Signed Stripe Connect webhook feeding the existing `settlePaidOrder`** [no new dep, Stripe-side config only]
   - Verify `Stripe-Signature` with `node:crypto` HMAC-SHA256 over `t.payload`, with a timestamp tolerance. This needs the raw body (`express.raw` on that route).
   - Store `event.id` in a `stripe_events(id PRIMARY KEY, type, account, received_at)` table to drop duplicates.
   - Handle `checkout.session.completed` and `async_payment_succeeded` by calling the same `sessionFits` + `settlePaidOrder` path.
   - Return 2xx fast.
   - The redirect and the lazy reconciler stay as backups, which is exactly the both-paths pattern Stripe recommends ([Stripe fulfillment](https://docs.stripe.com/checkout/fulfillment.md?payment-ui=stripe-hosted)). Webhook dedupe and unordered handling: [shopify.dev webhook best practices](https://shopify.dev/docs/apps/build/webhooks/best-practices).
   - Requires a new Railway variable `STRIPE_WEBHOOK_SECRET`, not a new service.
4. **Explicit order state machine** [no new dep]
   - Encode allowed transitions in one table-driven function, for example `pending→paid|cancelled`, `paid→shipped|refunded|disputed`, `shipped→complete|refunded|disputed`.
   - Write every transition with a conditional `UPDATE … WHERE id=? AND status=?` and check `changes===1`, instead of read-then-write. This stays correct even if an `await` later sneaks in between.
   - Add an append-only `order_events` log, mirroring `rep_events`.
   - Basis: the recovery-point and last-step tracking in [Shopify's idempotency post](https://shopify.engineering/building-resilient-graphql-apis-using-idempotency); TNL's existing append-only `rep_events` rule (CLAUDE.md).
5. **Refunds and disputes reverse rep** [no new dep]
   - On `charge.refunded` or `charge.dispute.created` (Connect events), move the order to `refunded`/`disputed`.
   - Write a *negative* `rep_events` row for `sale_made`, since rep must reflect real external validation (CLAUDE.md product rule), and restock where appropriate.
   - Today TNL's own oversold notice sends sellers to refund in the Stripe dashboard, and that refund never reaches TNL ([src/server-07-orders-sharing.js:116](src/server-07-orders-sharing.js)).
6. **Record the commission per order** [no new dep]
   - Add `orders.fee_pct` and `orders.fee_cents`, set at checkout from `feeForRep()`/`platformFee()`.
   - This makes the 10%→2% ladder auditable and enables aggregate reconciliation against Stripe's application-fee list. It also protects past orders if `FEE_BY_LEVEL` changes, the grandfathering lesson from Shopify's App Store change ([shopify.dev changelog](https://shopify.dev/changelog/update-to-shopifys-app-developer-revenue-share)).
7. **Scheduled reconciler plus anomaly log** [no new dep]
   - Run the existing `reconcileOrders` logic on a `setInterval` (e.g. every 15 min, bounded batch) across all stale pending orders, not only on page load.
   - Add a nightly pass comparing `fee_cents` totals to Stripe `application_fees` for the day.
   - Write mismatches to an `anomalies` table shown in `/admin`, auto-fixing what is safe (e.g. a paid session with a pending order → settle).
   - Basis: [Shopify 10 tips #7](https://shopify.engineering/building-resilient-payment-systems); [shopify.dev reconciliation jobs](https://shopify.dev/docs/apps/build/webhooks/best-practices)
8. **Money tests** [no new dep]
   - Add `test/payments.test.mjs` with a fake `stripe()` (inject `fetch`) covering:
     - duplicate webhook delivery;
     - concurrent redirect plus webhook;
     - wrong amount or wrong order id;
     - timeout;
     - refund after paid (rep reversed);
     - fee recorded per level.
   - Mirrors Shopify's "test every step and recovery scenario" ([idempotency post](https://shopify.engineering/building-resilient-graphql-apis-using-idempotency)) and Stripe's local `stripe listen` flow ([Stripe fulfillment](https://docs.stripe.com/checkout/fulfillment.md?payment-ui=stripe-hosted)). The Stripe CLI is a dev tool, not a runtime dependency.
9. **Correlation id and structured log lines on money paths** [no new dep]
   - Log `{"evt":"checkout.settle","order":…,"session":…,"cid":…}` as JSON lines, and keep failures (declines) separate from errors (5xx or timeouts).
   - Basis: [Shopify 10 tips #4–5](https://shopify.engineering/building-resilient-payment-systems)

**B. General engineering**

10. **Gradual typing, Sorbet-style** [new dep: `typescript` as devDependency only, or no dep if run via `npx` in CI]
    - Add `// @ts-check` and JSDoc to `src/pay.js`, `db.js` and the order parts first.
    - Run `tsc --noEmit --allowJs --checkJs` in CI on files that opt in, ratcheting like Shopify's sigils ([Shopify Eng](https://shopify.engineering/the-state-of-ruby-static-typing-at-shopify)).
    - Needs owner approval per CLAUDE.md's dependency rule.
11. **Ratcheting allow-lists ("shitlist-driven development")** [no new dep]
    - For rules TNL already enforces (24KB parts, palette drift), keep a checked-in list of existing exceptions that tests only allow to shrink.
    - Basis: [Weingarten talk](https://www.rubyevents.org/talks/shitlist-driven-development-and-other-tricks-for-working-on-large-codebases); Packwerk's todo-file model ([retrospective](https://shopify.engineering/a-packwerk-retrospective))
12. **Boundary check between parts** [no new dep]
    - A small test asserting that, for example, only `server-07-*` and `pay.js` call `createCheckout`/`verifySession`, and that only `db.js` writes `rep_events`.
    - This is Packwerk's dependency check in about 30 lines. Per Shopify's retrospective, prefer *runtime* tests over static rules where possible.
13. **Kill switches over staging** [no new dep]
    - Shopify skips staging and relies on flags plus fast rollback ([StackShare repost](https://shopify.engineering/e-commerce-at-scale-inside-shopifys-tech-stack)).
    - Add an admin "Payments paused" toggle that makes checkout return "temporarily unavailable" without a deploy, and document Railway's one-click rollback in RAILWAY.md.
14. **Fault injection in tests** [no new dep]
    - The Toxiproxy idea at TNL scale: make the injected `fetch` return slow, 500 or dropped responses in `test/payments.test.mjs`. No proxy is needed.
15. **Lightweight load check before launches** [no new dep]
    - Genghis is Shopify-scale only. A one-off `autocannon` run (would be [new dep], dev-only) or a plain Node script hammering `/api/feed` and checkout creation against a local server will show SQLite write contention early.
    - For an event or drop (the tournament), run it once at about 10× expected traffic.
16. **Size budget on the built page** [no new dep]
    - Assert that gzipped `public/index.html` stays under a set budget in `npm test`, mirroring Shopify's 64KB extension and Wasm limits ([Gadget](https://gadget.dev/blog/shopify-api-2025-10-web-components-preact); [shopify.dev Functions](https://shopify.dev/docs/apps/build/functions/optimize-instruction-counts)).

**C. Justified only at Shopify's scale (do not adopt)**
- Pods and sharding, online shard moves [new service]
- Packwerk-style package systems
- A custom JIT
- A merge queue (one or two committers don't create merge races)
- Multi-region failover and region evacuation drills [new service]
- Semian-grade bulkheads
- Genghis-class production load generation
- Recovery-point DSLs for multi-step payment mutations
- A dedicated incident bot and roles
- Hydrogen/Oxygen-style headless storefronts
- Wasm extension sandboxes. TNL has no third-party code to sandbox.

**D. Business lessons**
- Keep fees tied to seller success (Shopify: ~76% of revenue tied to GMV), which TNL's ladder already does.
- Record the rate charged on every order.
- Announce any fee change with grandfathering. Shopify's 2025 App Store rollback drew press backlash ([Business Insider](https://www.businessinsider.nl/shopify-rolled-back-a-lifeline-it-extended-to-app-developers-during-the-pandemic)).
- Make the platform's own payment rail the default path, which is how Shopify grew payments penetration from 61.9% to 68% ([10-K](https://www.sec.gov/Archives/edgar/data/1594805/000159480526000007/shop-20251231.htm)).

### Gaps
- Whether Railway's rollback is truly "one click" for this project, and how Railway handles in-process `setInterval` jobs across restarts, was not verified. The Railway docs/MCP should be checked before relying on recommendation 7 or 13.
- Stripe Connect webhook specifics for Standard direct charges (a Connect endpoint is required; events carry `account`) are stated from general Stripe knowledge and were not fetched in this pass.
- No measurement of TNL's actual checkout volume, so the urgency of each recommendation is not ranked by observed incidents.
