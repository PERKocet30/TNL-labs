# TikTok / ByteDance engineering stack vs TNL Labs

Research date: 8 October 2026. Method: web search plus page fetches (about 25 tool calls), and one direct inspection of the HTML that `https://www.tiktok.com/explore` served from a US egress on 2026-10-08, saved to the scratchpad and grepped. The TNL baseline comes from `research_notes/TNL Labs code vs Instagram code/tnl_codebase_audit.md` and `reports/TNL Labs code vs Instagram code.md`, which are not repeated here.

**Source caveats, read first:**
- Most ByteDance numbers are self-reported. They come from CloudWeGo, Lynx, BytePlus and Volcano Engine marketing and engineering blogs.
- Many are dated 2021–2022. They are marked [historical] where they appear.
- ByteDance's internal tooling (Bits, its monorepo, the "Libra" experiment platform, its service mesh, ByteVC codecs) is documented mainly in Chinese-language sources (InfoQ China, Juejin, Volcano Engine CN docs). I could not retrieve or verify those sources in this session, so those items sit under **Gaps** rather than being stated as fact.

---

## Back end: languages, CloudWeGo, microservices, data and ML infrastructure

### Takeaway
ByteDance runs a Go-first microservice estate in the tens of thousands of services, built on its own RPC and HTTP frameworks (Kitex, Hertz, and Netpoll for networking). Rust (Volo, Monoio) sits on top for hot paths. The data layer is purpose-built: ByteGraph for the social graph, BMQ for messaging, Flink for streams, and TOS for objects. Recommendation runs on Monolith, which trains online in real time. All of this is the opposite of TNL's one process plus one SQLite file. Almost none of it transfers to a one- or two-person team except the *ideas*: IDL-first contracts, a small number of well-instrumented hot paths, and feedback loops measured in minutes.

### Cited Findings
- **Go is the main business language.** "From 2014 to 2020, Golang has served as the primary programming language for business development within ByteDance." The framework supports "tens of thousands of Golang microservices." — [CloudWeGo, Kitex unifying open-source practice (2022)](https://www.cloudwego.io/blog/2022/09/30/kitex-unifying-open-source-practice-for-a-high-performance-rpc-framework/); [CloudWeGo open-source announcement (13 Sep 2021)](https://cloudwego.io/blog/2021/09/13/cloudwego-open-source-announcement)
- **Microservice count grew about 7x in three years** [historical]. There were roughly 7,000–8,000 online microservices in 2018 and more than 50,000 by May 2021. — [CloudWeGo 2022 blog](https://www.cloudwego.io/blog/2022/09/30/kitex-unifying-open-source-practice-for-a-high-performance-rpc-framework/)
- **Kitex adoption** [historical]. Kitex was released internally in early 2020 and had more than 10,000 services by the end of that year. By August 2021 it carried more than 60,000 services (as stated by ByteDance) at "hundreds of millions" of peak QPS. By September 2021 it served more than 50% of Go microservices. — [CloudWeGo 2022 blog](https://www.cloudwego.io/blog/2022/09/30/kitex-unifying-open-source-practice-for-a-high-performance-rpc-framework/); [CloudWeGo announcement 2021](https://cloudwego.io/blog/2021/09/13/cloudwego-open-source-announcement). *These two figures conflict slightly: 60k services against a total of 50k. Both are self-reported, and the gap is probably a difference in counting.* I found no 2025–26 service count.
- **Why ByteDance wrote its own networking.** Kitex's predecessor, Kite, was "tightly coupled to Thrift", which made network and codec optimisation hard. ByteDance replaced Go's `net` with **Netpoll**, a non-blocking I/O framework modelled on evio and Netty, for two reasons. First, `net` forces one goroutine per connection, which costs context switches under high concurrency. Second, `net.Conn` cannot detect dead connections, which breaks connection pooling. — [CloudWeGo announcement 2021](https://cloudwego.io/blog/2021/09/13/cloudwego-open-source-announcement)
- **IDL-first, code-generated contracts.** Kitex speaks Thrift (Buffered/Framed), "Kitex Protobuf" and gRPC, over the TTHeader or HTTP2 transports. **Thriftgo**, a Go Thrift compiler with plugins, generates the code. Service governance is built in: registry and discovery, load balancing, circuit breaking, rate limiting, retry, monitoring, tracing and logging. — [CloudWeGo announcement 2021](https://cloudwego.io/blog/2021/09/13/cloudwego-open-source-announcement)
- **Rust for the hottest paths.** Volo, a Rust RPC framework, was founded by Kitex team members after "deep performance optimizations in Go" hit limits. ByteDance says it is "extensively used" and outperforms the Go version (self-reported, no published benchmark found). Monoio is a thread-per-core Rust runtime on io_uring, epoll and kqueue, with about 5.1k GitHub stars. — [CloudWeGo, Volo open-source (30 Aug 2022)](https://www.cloudwego.io/blog/2022/08/30/chinas-first-rust-based-rpc-framework-volo-is-officially-open-source/); [CloudWeGo enterprise middleware (2023)](https://www.cloudwego.io/blog/2023/06/15/cloudwego-a-leading-practice-for-building-enterprise-cloud-native-middleware/); [gittrend monoio](https://gittrend.io/repo/bytedance/monoio). *I found no ByteDance-specific Go→Rust cost-savings figure. The often-quoted "70% cost cut" is from Grab, not ByteDance* ([ByteByteGo](https://blog.bytebytego.com/p/how-grabs-migration-from-go-to-rust)).
- **ByteGraph** (VLDB 2022) is ByteDance's distributed graph database. It serves graph data across TikTok, Douyin and Toutiao at "tens of billions of vertices and trillions of edges." Its design uses edge-trees for adjacency lists, adaptive thread pools and indexes, and geographic replication. It splits workloads into online analytical, transactional and serving processing. — [Li et al., PVLDB 15(12):3306–3318](https://vldb.org/pvldb/vol15/p3306-li.pdf)
- **ByteGraph 2.0 and BG3** [historical for 2.0]. ByteGraph 2.0 was deployed across about 1,000 clusters, 1M CPU cores and 100PB of storage. Its stated weaknesses were "inefficient graph access" and high operational cost from its LSM key-value store, which motivated BG3 (SIGMOD 2024). — [LDBC TUC talk, BG3](https://datasets.ldbcouncil.org/event/eighteenth-tuc-meeting/day1/13.%20bg3-ldbc24.pdf); [BG3 paper listing](https://rmarcus.info/dbscholar/papers/h90e210c3333e79f3)
- **BMQ, Flink and TOS.** These are productised on BytePlus: BMQ is a "cloud native message engine", consumed with Flink SQL and written into TOS object storage. — [BytePlus Flink docs](https://docs.byteplus.com/en/docs/flink/Reading_native_cloud_message_engine_BMQ_data_and_writing_into_object_storage_TOS). These are the external versions. I did not verify the internal architecture.
- **Monolith is the real-time recommendation training system** (arXiv 2209.07663, RecSys 2022 workshop). It has two parts:
  - a *collisionless* embedding table, with expirable embeddings and frequency filtering to bound memory;
  - an online training architecture that feeds serving feedback back into training in real time, instead of retraining in batches.

  It "landed in the BytePlus Recommend product." — [Monolith paper (ar5iv)](https://ar5iv.labs.arxiv.org/html/2209.07663); [CEUR-WS copy](https://ceur-ws.org/Vol-3303/paper8.pdf)

### Inferences
- ByteDance's progression is the reverse of Instagram's. Instagram kept one Django monolith and hardened it. ByteDance went Go microservices first and then had to build an RPC framework, a networking layer, a mesh and governance just to make 50k+ services survivable. For TNL, the lesson is that microservices create the very infrastructure that ByteDance had to open-source. TNL's single process is the right shape.
- The transferable idea in Kitex is the **IDL-first contract**: one schema file generates client and server stubs. TNL's equivalent, which needs no new dependency, would be a single route-manifest object (method, path, auth level, request and response shape) that the server registers from and a test checks against the client's `api()` calls.
- Monolith's core idea is that the feedback loop from user action to model update takes minutes. That maps onto TNL's rep engine and feed ranking: score from the `rep_events` log in near real time rather than batch-recomputing.

### Gaps
- No 2025–26 microservice or Kitex service count found. The Hertz HTTP framework adoption figures were not retrieved.
- **Service mesh** (ByteMesh) details: not found in English primary sources. The 2021 announcement mentions a mesh only generically.
- **Abase** (KV store), **ByteKV**, **ByteHouse** (ClickHouse fork), caching tier: no source retrieved this session. Treat any claims about them as unverified. Chinese-language sources (InfoQ CN, Volcano Engine CN) likely exist.
- Python and C++ share of ByteDance code: no source found. C++ is widely assumed for inference and media, but this is unverified here.

---

## Media pipeline: upload, transcoding, codecs, CDN, preloading, instant swipes

### Takeaway
TikTok makes swipes feel instant mainly on the **client**. It preloads the next videos (sized adaptively, at the head of the file) and pre-renders the first frame, with its own player SDK and H.265 to cut bytes. On the server side it invests at chip level, building in-house video codec silicon. Of these, TNL can copy the *client* half with no new dependency: prefetch the next item's head bytes and poster frame, and keep one decoded element warm.

### Cited Findings
- **Player SDK, preloading and pre-rendering.** ByteDance's commercial Player SDK is "proven in high-traffic applications like TikTok". Its first-frame speed comes from "flexible playback strategies… pre-loading and pre-rendering strategies". It supports H.265 decoding and "precise flow control" that "significantly reduce bandwidth consumption" (vendor claim). — [BytePlus VOD Player SDK overview](https://docs.byteplus.com/byteplus-vod/docs/player-sdk-overview)
- **Academic study of TikTok preloading** [historical, 2022]. A Peking University paper on real TikTok traces says early TikTok preloading "can only preload short videos when the current playing video is downloaded completely." Its adaptive scheme cut the stall ratio by 81% against no preloading and 12% against fixed preloading, and bandwidth waste by 11% and 31% respectively. — [PKU ICST paper](https://www.icst.pku.edu.cn/NetVideo/docs/20220826143529921247.pdf)
- **In-house codec chips.** In July 2022 ByteDance confirmed it is developing its own video codec chips for its video and recommendation services, with "no plans" for CPU or GPU chips. — [TechNode, 21 Jul 2022](https://technode.com/2022/07/21/bytedance-confirms-development-of-video-codec-chips)
- **Codec cost on low-end devices.** Modern codecs such as AV1 and HEVC can lag on low-end Android and older iPhones, causing slow startup and dropped frames. This is general industry background, not TikTok-specific. — [FastPix blog](https://fastpix.com/blog/strategies-to-optimize-performance-of-short-video-apps)
- **US CDN separation is visible in production.** tiktok.com's US page loads every asset from `lf16-tiktok-web.tiktokcdn-us.com` and `lf16-cdn-tos.tiktokcdn-us.com`, meaning TOS objects behind a US-specific CDN domain, and it issues `<link rel="preconnect">` and `rel="preload"` for its critical scripts. — direct inspection of [tiktok.com/explore](https://www.tiktok.com/explore) HTML, 2026-10-08

### Inferences
- What TNL can copy without a new dependency:
  - ffmpeg-static is already a dependency, so TNL can produce a poster JPEG and a "fast-start" MP4 (`-movflags +faststart`) at upload time.
  - Once the current item starts, the client can issue a `fetch` with a `Range: bytes=0-N` header for the next one or two items, plus `<link rel=preload as=image>` for their posters.
  - TNL's service worker already skips ranged requests, so those requests would go straight to the network and still warm the HTTP cache.
- Server-side ABR ladders (multi-bitrate HLS/DASH), custom codecs and codec silicon only make sense at a bandwidth bill TNL does not have.

### Gaps
- **ByteVC1 / ByteVC2** (ByteDance's HEVC- and VVC-class encoders) and the "BVC" naming: no English primary source retrieved. They are likely documented in Volcano Engine CN docs and MSU codec-comparison reports, but this session did not verify them.
- TikTok's upload path (client-side compression, chunked or resumable upload, transcode ladder) and its CDN vendor mix: no primary source found.

---

## Client code: Lynx, native apps, tiktok.com web stack, app size, mobile DevOps

### Takeaway
TikTok's apps are native shells with growing **Lynx** surfaces. Lynx is ByteDance's web-skills-to-native UI engine, open-sourced on 5 March 2025. It has a dual-thread runtime: PrimJS on the main thread, with user code in a background thread. tiktok.com itself is a React 18 SSR app, observed directly in its HTML, built with ByteDance's own toolchain (Modern.js/Rsbuild "builder-runtime" chunks) with Emotion CSS-in-JS, RxJS, ByteDance's Sigi state library, and in-house analytics (TEA) and monitoring (Slardar) SDKs. TNL's string-template `render()` with no framework or bundler is the extreme opposite. The Lynx ideas that do transfer are IFR (never paint a blank first frame) and keeping heavy work off the input path.

### Cited Findings
- **Lynx origin, date and authorship.** Lynx was announced 5 March 2025 by Xuan Huang (Lynx architect, formerly on the React core team) and was originally built by a full-time ByteDance team that still drives it. — [Lynx blog, "Unlock Native for More"](https://lynxjs.org/blog/lynx-unlock-native-for-more.html); [InfoQ, Mar 2025](https://www.infoq.com/news/2025/03/tiktok-lynx-cross-platform-apps)
- **Dual-thread design.** User scripting is "statically divided" into two runtimes:
  - a **main-thread runtime on PrimJS**, a custom JS engine, for privileged synchronous work such as launch and high-priority events;
  - a **background runtime**, the default for user code, which keeps the main thread non-blocking.

  On top of this sit two features:
  - **Instant First-Frame Rendering (IFR)** briefly blocks the main thread until the first frame is fully rendered, so the user never sees a blank screen;
  - **Main-Thread Scripting (MTS)** is small, statically scheduled code that handles gestures and high-priority events.

  — [Lynx blog](https://lynxjs.org/blog/lynx-unlock-native-for-more.html)
- **Frameworks, tooling and CSS.** **ReactLynx** is the first framework, but "other frameworks already account for roughly half of Lynx usage" internally. **Rspeedy** is the toolchain, built on Rspack (Rust), with Module Federation for micro-frontends. Lynx supports real CSS: animations, transitions, variables, gradients, clipping and masking. It positions itself as an "alternative Web tailored for app development". It has a framework- and host-agnostic core with a custom-renderer option, and a "Lynx for Web" target. — [Lynx blog](https://lynxjs.org/blog/lynx-unlock-native-for-more.html)
- **Lynx compared with React Native and Flutter.** Lynx's own framing is that React Native (2015) bridges native UI with declarative React, while Flutter uses a custom renderer. Lynx keeps web markup and CSS and adds the dual-thread split. — [Lynx blog](https://lynxjs.org/blog/lynx-unlock-native-for-more.html); third-party comparison: [Appwrite, Lynx vs React Native](https://appwrite.io/blog/post/bytedance-lynx-vs-react-native)
- **Where TikTok uses Lynx.** It powers the Search panel, the TikTok Studio app, Shop/e-commerce, LIVE, and campaigns such as Disney100 and the Met Gala. — [TikTok for Developers blog](https://developers.tiktok.com/blog/lynx-opensource-introduction); [Lynx blog](https://lynxjs.org/blog/lynx-unlock-native-for-more.html)
- **Lynx performance claim (internal).** Surfaces moved from Web to Lynx "often see a 2–4× reduction in launch times." No independent benchmark was found. — [Lynx blog](https://lynxjs.org/blog/lynx-unlock-native-for-more.html)
- **Is Lynx production-ready?** Opinions conflict. A podcast claim that Lynx powers "all" ByteDance app UI is disputed by other commentators ([InfoQ](https://www.infoq.com/news/2025/03/tiktok-lynx-cross-platform-apps)). One 2025 guide calls the ecosystem early-stage and suited for experimentation ([OpenReplay](https://blog.openreplay.com/lynxjs-beginners-guide/)).
- **tiktok.com web stack, observed directly** (HTML of `/explore`, 2026-10-08):
  - Script paths contain `/tiktok/webapp/main/react-v18/webapp-desktop/`, so the app is React 18.
  - Data is server-rendered into a `__UNIVERSAL_DATA_FOR_REHYDRATION__` blob, so it is SSR plus hydration. There is no `__NEXT_DATA__` and no `_next/static`, so it is **not Next.js**.
  - Chunks include `builder-runtime.*.js`, which suggests Modern.js Builder/Rsbuild (an inference from the chunk name only), plus `npm-react`, `npm-rxjs`, `npm-sigi`, `emotion.init` and `player.init`.
  - SDK chunks are `npm-dp-byted-tea-sdk-oversea` (TEA, an in-house analytics SDK) and `slardar.*.js`/`slardar.web.pre.js` (Slardar, an in-house front-end monitoring SDK).
  - A `tiktok_privacy_protection_framework/loader` script loads before everything else.
  - Route-level chunks are named per route (e.g. `explore-prefetch`), and region build names include `webapp-useastred` and `webapp-prime`.

  — [tiktok.com/explore](https://www.tiktok.com/explore) (raw HTML, inspected via curl)
- **ByteDance web tooling.** Modern.js (React meta-framework), Rspack (Rust bundler, webpack-compatible, 1.0 in August 2024, 5–10x faster than webpack), Rsbuild (the renamed Modern.js Builder) and Garfish (micro-frontends) all come from ByteDance's Web Infra team. — [web-infra-dev working group](https://github.com/web-infra-dev/wg); [@IT, Rspack 1.0](https://atmarkit.itmedia.co.jp/ait/articles/2409/18/news072.html). *I found no source confirming that tiktok.com uses Garfish.*

### Inferences
- Lynx's split is "the main thread does only first frame and gestures; everything else runs in the background." TNL can approximate it without a new dependency:
  - Ship a server-rendered or skeleton first frame in `index.html` so the user never sees a blank `#app` (TNL already has `skel()`).
  - Move non-urgent work (analytics beacons, prefetch, waveform decode in the Studio) into `requestIdleCallback` or a Web Worker, so taps and swipes are never blocked.
- tiktok.com chose SSR plus hydration and per-route chunks. TNL's single 600KB `index.html` is all first-party code with no runtime framework. That is a defensible choice at TNL's size, but splitting rarely used screens (admin, Studio, market) out of the critical path is the TikTok-style lesson. TNL already does this for Studio (`public/studio.js`).
- The privacy framework loads *first* and the monitoring SDK is *preloaded*. Both are platform concerns installed ahead of product code, and TNL could mirror the ordering with a tiny inline error and timing beacon.

### Gaps
- **Native app architecture** (Swift/ObjC and Kotlin/Java mix, modularisation, component counts), **app size** and **startup-time** figures, and **"Sparkling"**: no primary English source found this session.
- **Mobile DevOps.** **Bits** (ByteDance's internal DevOps and release platform) and the monorepo layout (Codebase) are described mainly in Chinese-language sources (InfoQ CN, Juejin, Volcano Engine CN) and were not verified.

---

## Engineering process: release cadence, A/B testing, flags, observability, review, AI coding tools

### Takeaway
ByteDance's defining process trait is the A/B-test-everything culture, productised externally as **DataTester** (Volcano Engine/BytePlus). DataTester uses layered hash-bucket traffic splits, next-day confidence intervals, bandit "intelligent tuning" and **backtest holdbacks** after launch. On AI tooling, ByteDance builds its own: the Trae IDE on Doubao models replaced MarsCode, and a 2025 report says Cursor and Windsurf were disabled internally. TNL can adopt a ten-line hash-bucket experiment helper and holdbacks without a new dependency. A full experiment platform needs traffic TNL does not have.

### Cited Findings
- **Traffic splitting.** DataTester splits traffic with layered hash buckets: "the traffic of each layer [is distributed] evenly into a fixed number of copies, such as 100 copies, each… called a 'hash bucket'." Results show live, and "metric confidence will be produced the next day." — [BytePlus DataTester FAQs](https://docs.byteplus.com/docs/DataTester/FAQs); [BytePlus Experimental Report Overview](https://docs.byteplus.com/ko/docs/data-intelligence/Experimental_Report_Overview)
- **Experiment types.** DataTester offers classic A/B tests, multi-armed-bandit "intelligent tuning", pre-split experiments for offline cases such as push campaigns (capped at 10M users), and **backtest experiments**: "When an experimental group… wins and goes online… a part of the traffic will be drawn into the control group" to measure long-term effects. — [BytePlus DataTester docs](https://docs.byteplus.com/docs/DataTester/Backtest-Experiment); [Pre-split experiments](https://docs.byteplus.com/docs/DataTester/Programming-Experiment-Pre-Distribution-Experiment)
- **SDK integration.** Server SDKs exist for Go, PHP and others, keyed by an app key. — [BytePlus Go SDK](https://docs.byteplus.com/en/docs/data-intelligence/Go_SDK); [PHP SDK](https://docs.byteplus.com/en/docs/data-intelligence/PHP_SDK)
- **Observability and analytics SDKs in production.** tiktok.com loads Slardar (front-end monitoring) as a preloaded pre-script and the TEA analytics SDK as a dedicated chunk. — [tiktok.com/explore](https://www.tiktok.com/explore) HTML, 2026-10-08
- **AI coding tools:**
  - **Trae IDE** launched in January 2025, with Doubao-1.5-pro and switchable DeepSeek R1/V3 models ([Visual Studio Magazine](https://visualstudiomagazine.com/articles/2025/01/27/ai-powered-trae-ide-ships.aspx); [The Standard HK](https://www.thestandard.com.hk/finance/article/228995/ByteDance-debuts-AI-software-development-tool-in-China)).
  - **MarsCode** launched in June 2024. Its assistant was renamed "Trae Plugin" in April 2025 ([yespress](https://yespress.io/marscode)).
  - A May 2025 report says ByteDance security planned to **disable Cursor and Windsurf internally from 30 June 2025** over data-leak concerns, with Trae as the replacement. This is a secondary report relaying IT Home and Yicai ([taibo](https://en.taibo.cn/p/26045790)).
  - Per a Bloomberg-sourced report, Trae and Coze are being folded into Doubao ([AI Weekly](https://aiweekly.co/node/10741)).
  - The claims that "92% of ByteDance engineers use Trae" and "43% of Douyin Life Services code" come from a single unreliable page and are **unverified** ([source](https://forntend-test-5sqwmq-3a22a9-107-172-80-230.traefik.me/tiktok-s-new-ai-coding-tool-aims-to-revolutionize-enterprise-development-1766099297682)).

### Inferences
- TNL can do hash-bucket A/B testing without a new dependency:
  - **Assignment.** Compute `bucket = hash(userId + experimentKey) % 100` and keep a `flags` table of experiment key, layer, bucket ranges and a kill switch.
  - **Exposure log.** Write exposures to an append-only table, in the same spirit as `rep_events`.
  - **Holdback.** Keep a 5–10% holdback after a launch. This is the DataTester "backtest" idea, and it matters more for a small community than significance testing, which TNL's user count cannot power.
- With low traffic, bandit or "intelligent tuning" and next-day confidence intervals are not meaningful. A small team should use flags mainly for **safe rollout and kill switches**, not inference.
- ByteDance's ban on outside AI IDEs was a data-governance decision. TNL's equivalent is the existing CLAUDE.md rule set (no secrets, never touch member data).

### Gaps
- **Libra** (the reported internal name of ByteDance's experimentation platform) and the widely repeated figures for experiments per day or cumulative experiments: **no primary source found**. Do not cite numbers.
- **Release cadence** of the TikTok iOS/Android apps (weekly trains?), **feature-flag system** name, **code-review** practice and **testing approach**: no primary sources found this session. These are likely in Chinese-language ByteDance tech blogs.

---

## Data and regulatory architecture: Project Texas → TikTok USDS Joint Venture

### Takeaway
Regulation turned TikTok's US operation into a technically separated deployment:
- US data sits in Oracle Cloud;
- source code is reviewed by Oracle in dedicated transparency centres (Project Texas, 2022–23 [historical]);
- since late January 2026, a majority-American **TikTok USDS Joint Venture** retrains the recommendation algorithm "exclusively on U.S. user data" inside Oracle's cloud, with Oracle as the "trusted security partner" validating source code.

The production web app visibly runs on US-specific CDN domains with a US-East-region build. Public technical detail on how retraining and code review actually work is thin; in May 2026 Senator Markey's letter complained of exactly that.

### Cited Findings
- **Project Texas structure** [historical]. A separate entity, USDS, was set up with a board independent of ByteDance. US user data, recommendation systems and moderation were to be hosted in Oracle Cloud. Trusted third parties (Oracle and independent inspectors) would review the source code in a Dedicated Transparency Center in Columbia, Maryland, live from January 2023. Estimated cost was $700M–$1B per year. — [Engadget](https://www.engadget.com/can-tiktok-convince-the-us-its-not-a-national-security-threat-173030115.html); [BNN Bloomberg](https://www.bnnbloomberg.ca/tiktok-will-soon-grant-oracle-full-access-to-code-algorithm-1.1923502); [CyberScoop](https://cyberscoop.com/tiktok-national-security-cfius/)
- **How much code Oracle could see.** Bloomberg (2023) said TikTok would "soon" grant Oracle full access to source code, the algorithm and moderation material. Engadget said Oracle and a separate auditor would review the entire source code. Journalists touring the LA centre in February 2023 were not allowed into the server room holding source code for auditors. — [BNN Bloomberg](https://www.bnnbloomberg.ca/tiktok-will-soon-grant-oracle-full-access-to-code-algorithm-1.1923502); [Platformer](https://platformer.news/a-visit-to-tiktoks-transparency-center); [Slashdot/The Verge](https://tech.slashdot.org/story/23/02/05/238213/tiktok-unveils-new-us-based-transparency-and-accountability-center)
- **JV closed in late January 2026:**
  - **Ownership.** Oracle, Silver Lake and MGX hold 15% each as managing investors. American and global investors hold 80.1% and ByteDance 19.9%.
  - **Leadership.** CEO Adam Presser (formerly head of operations and trust & safety). There is a seven-member majority-American board including Shou Chew, and Will Farrell is CSO.

  — [Reuters via NST](https://www.nst.com.my/amp/business/corporate/2026/01/1362641/tiktok-clinches-deal-new-us-joint-venture-avoid-american-ban); [Variety](https://au.variety.com/2026/digital/global/tiktok-us-joint-venture-deal-closes-adam-presser-ceo-32240); [The Register](https://www.theregister.com/2026/01/23/jv_announces_tiktok_us_acquisition/)
- **Algorithm.** The recommendation algorithm will be "retrained exclusively on U.S. user data" and stored in Oracle's cloud. Oracle, as trusted security partner, assists with "ongoing review and validation of source code." The direction of the licence is reported inconsistently, but the majority reading is that ByteDance licenses the algorithm *to* the JV. ByteDance-owned entities continue to run some US commercial activity (e-commerce and advertising). — [Thurrott](https://www.thurrott.com/cloud/331974/tiktok-finalizes-deal-to-form-new-us-joint-venture) (internally inconsistent on direction); [The Register](https://www.theregister.com/2026/01/23/jv_announces_tiktok_us_acquisition/); [Reuters-syndicated report, Sep 2025](https://www.adaderana.lk/technology/112805/tiktok-algorithm-to-be-retrained-on-us-user-data-under-trump-deal)
- **Oversight critique (May 2026).** Sen. Markey wrote that more than four months after closing, TikTok USDS "has disclosed little information" about how retraining works or how it prevents manipulation. He asked whether source-code review could catch malicious code "hidden within an urgent security patch". — [Markey letter to Oracle (PDF)](https://www.markey.senate.gov/imo/media/doc/letter_to_oracle_on_tiktok_usds.pdf)
- **Visible technical separation.** The US web build loads from `*.tiktokcdn-us.com` (assets path `tiktok-web-tx`, `static-tx`, where "tx" is presumably Texas). The page also references region builds `webapp-useastred` and `webapp-prime`, and runs a "privacy protection framework" loader before any app code. — [tiktok.com/explore](https://www.tiktok.com/explore) HTML, 2026-10-08. *Reading "tx" as Texas and "red" as an isolated US environment is my own interpretation, unconfirmed by TikTok.*

### Inferences
- In engineering terms the JV means:
  - **(a)** a forked deployment and data plane (separate CDN domains, Oracle-hosted storage, a region-specific build);
  - **(b)** a code-provenance pipeline in which code flowing from ByteDance is reviewed and rebuilt by a third party before it ships;
  - **(c)** a separately trained model on a separate data set.

  The Markey letter's "urgent patch" worry is the classic supply-chain problem: review is only as good as the build-from-reviewed-source guarantee.
- The TNL-scale lesson is **data-residency and provenance hygiene**:
  - member data already lives only on the Railway volume (CLAUDE.md);
  - the deploy SHA is checked after deploy (`after-deploy.yml`);
  - the next small step would be a reproducible-build hash, which `assemble.mjs` could emit as an output digest the post-deploy probe compares.

### Gaps
- No technical documentation from TikTok USDS or Oracle on retraining cadence, model-weight custody, build reproducibility or code-review tooling. The October 2026 status of retraining is unknown, and no source confirms it has been completed.

---

## Side-by-side comparison and lessons for a one-to-two-person team

### Takeaway
TikTok differs from Instagram in three ways that matter for TNL:
1. It is a Go/Rust microservice estate with home-grown RPC, not a Python monolith.
2. Its client invests in **first-frame and next-item latency**: Lynx IFR, preloading, pre-rendering.
3. It has an industrialised **experimentation** culture.

The TikTok practices TNL can adopt are almost all client-latency and experimentation patterns that need no new dependency.

### Cited Findings
The comparison table is drawn from the sources cited above and from the Instagram and TNL notes.

| Dimension | TikTok / ByteDance | Instagram (see prior report) | TNL Labs (Oct 2026) |
|---|---|---|---|
| Architecture | Tens of thousands of Go microservices (50k+ by May 2021) on Kitex/Hertz/Netpoll, plus service governance ([CloudWeGo](https://www.cloudwego.io/blog/2022/09/30/kitex-unifying-open-source-practice-for-a-high-performance-rpc-framework/)) | One Django monolith | One Express process, numbered parts concatenated at boot |
| Languages | Go (primary 2014–2020+), Rust for hot paths (Volo, Monoio), JS/TS for web and Lynx | Python, Obj-C/Swift, Kotlin | Plain JS (Node 22) |
| Data store | ByteGraph (trillions of edges), BMQ, Flink, TOS ([VLDB](https://vldb.org/pvldb/vol15/p3306-li.pdf); [BytePlus](https://docs.byteplus.com/en/docs/flink/Reading_native_cloud_message_engine_BMQ_data_and_writing_into_object_storage_TOS)) | Sharded Postgres, Cassandra, TAO | One SQLite file (`node:sqlite`, WAL) |
| ML / ranking | Monolith real-time online training ([arXiv](https://ar5iv.labs.arxiv.org/html/2209.07663)) | Meta ranking stack | Rule-based rep points from `rep_events` |
| Media | Own player SDK with preload and pre-render, H.265, in-house codec chips ([BytePlus](https://docs.byteplus.com/byteplus-vod/docs/player-sdk-overview); [TechNode](https://technode.com/2022/07/21/bytedance-confirms-development-of-video-codec-chips)) | Meta video infra | ffmpeg-static on upload, files on volume, SW caches `/uploads/` |
| Client | Native apps plus Lynx surfaces (dual thread, IFR); web is React 18 SSR with Emotion, RxJS and Sigi ([Lynx](https://lynxjs.org/blog/lynx-unlock-native-for-more.html); tiktok.com HTML) | Native plus React web | Vanilla JS string-template `render()`, no bundler |
| Build tooling | Rspack/Rsbuild/Modern.js (Rust bundler) | Buck, Metro | 60-line concatenation script |
| Experimentation | DataTester/"Libra": layered hash buckets, bandits, backtest holdbacks ([BytePlus](https://docs.byteplus.com/docs/DataTester/FAQs)) | Meta's experimentation platform | None (admin toggles only) |
| Observability | Slardar RUM/APM and TEA analytics SDKs on every page (tiktok.com HTML) | Meta Scuba and related | Logs plus after-deploy probe |
| Deploy / regulatory | Region-separated builds and CDNs, Oracle-hosted US data, third-party code review ([Markey](https://www.markey.senate.gov/imo/media/doc/letter_to_oracle_on_tiktok_usds.pdf)) | Continuous deployment of the monolith | Merge to `main` → Railway (~80s), CI gate |
| AI coding | Own IDE (Trae) on own models; outside AI IDEs reportedly banned ([taibo](https://en.taibo.cn/p/26045790)) | Meta internal tools | Claude Code with CLAUDE.md rules |

**Practices a tiny team can adopt:**

| # | Practice | Tag | Notes |
|---|---|---|---|
| 1 | **Never paint a blank first frame** (Lynx IFR idea) | [no new dep] | Inline a skeleton or last-known feed snapshot in `index.html` before JS boots. |
| 2 | **Prefetch the next one or two media items** | [no new dep] | Range-request the head bytes and preload the poster once the current item plays. The PKU study shows adaptive beats fixed preloading. |
| 3 | **Fast-start MP4 and poster frame at upload** | [no new dep] | `ffmpeg -movflags +faststart`, using the existing ffmpeg-static. |
| 4 | **Keep the input path free** (MTS / background-thread idea) | [no new dep] | Move beacons, analytics and heavy decode into `requestIdleCallback` or a Worker. |
| 5 | **Hash-bucket flags with kill switch and holdback** (DataTester) | [no new dep] | One SQLite table, `hash % 100`, exposure log. Use for safe rollout, not significance tests. |
| 6 | **IDL-style route manifest** (Kitex/Thriftgo idea) | [no new dep] | One object defines routes, auth and shapes. A test diffs it against server registrations and client `api()` calls. |
| 7 | **Front-end RUM beacon** (Slardar idea) | [no new dep] | Inline `PerformanceObserver` reporting LCP, long tasks and JS errors to a `/api/rum` table, preloaded before app code. |
| 8 | **Platform code loads first** | [no new dep] | Load error and timing capture before product parts, as tiktok.com does with its privacy and monitoring loaders. |
| 9 | **Real-time scoring from the event log** (Monolith idea) | [no new dep] | Recompute feed and rep scores incrementally on `rep_events` insert instead of in batches. |
| 10 | **Build provenance hash** (USDS idea) | [no new dep] | `assemble.mjs` emits a digest, and the after-deploy probe verifies it. |
| 11 | **Per-route code splitting** (tiktok.com chunks) | [no new dep] | Partial: Studio is already split out, and admin is separate. |
| 12 | **CDN in front of `/uploads`** | [new service] | Only when bandwidth or latency outside one region hurts. |

**Practices justified only at scale:** microservices with a custom RPC framework and service mesh; Rust rewrites of hot paths; a graph database; a message queue and Flink; real-time online training with embedding tables; a custom codec or codec silicon and ABR ladders; Lynx or other cross-platform native engines; an experiment platform with bandits and next-day CIs; region-separated deployments, third-party code review and an in-house AI IDE.

### Inferences
- TikTok's advantage that a tiny team *can* copy is perceived speed: first frame, next item and input responsiveness. TNL's string-template SPA with no framework is already light. The remaining wins are prefetch, a skeleton first frame and off-thread work.
- Experimentation culture copies cheaply as **rollout discipline** (flag, holdback, kill switch) even when statistics are not possible.

### Gaps
- No primary source for TikTok release cadence, native app size or startup-time numbers. Comparisons on those axes are not possible from this research.
- Instagram-column entries are summarised from the prior report rather than re-cited here.
