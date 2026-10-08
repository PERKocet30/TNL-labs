# Instagram client-side code: web, iOS and Android (2010 – October 2026)

Research notes for a side-by-side comparison with TNL Labs (vanilla JS, no framework or bundler, numbered parts concatenated into one index.html, string-template `render()`, hand-written transform/opacity motion, canvas image resizing, service worker, palette module, phone layout plus a computer layout from 1024px; see /home/user/TNL-labs/README.md and CLAUDE.md).

Source caveat: instagram-engineering.com (Medium) returned HTTP 503 and medium.com mirrors returned 403 during this session (2026-10-08). Claims about those posts come from search-result excerpts of the posts, not full reads. Instagram's own blog says future engineering content moves to the Engineering at Meta blog ([about.instagram.com](https://about.instagram.com/blog/engineering/making-instagram-video-ads-performant)), so there are fewer Instagram-only client posts after about 2020.

## Web: instagram.com stack and performance

### Takeaway
The best-documented web work is the 2019 "Making instagram.com faster" series. It combined link preloads, early flushing/progressive HTML (pushing data with the HTML), cache-first rendering from IndexedDB, and smaller JS through inline requires. Together these cut feed page load time by about 50%. Meta's wider web stack (React + Relay/GraphQL, atomic CSS, later StyleX) is documented for facebook.com. I could not confirm from a primary source that instagram.com runs on the same stack.

### Cited Findings
- **Series overview (2019, historical):** a four-part series by Glenn Conner (@mr_sharpoblunto). It reports "almost 50% cumulative improvement to our feed page load time." The trigger was that "as the product grew… our web performance began to suffer." — [Part 2](https://instagram-engineering.com/making-instagram-com-faster-part-2-f350c8fba0d4); [author page](https://instagram-engineering.com/@mr_sharpoblunto)
- **Part 1, preloading:** link preloads start dynamic (data) queries earlier in the page load. Part 2 summarizes it this way. — [Part 1/2 link](https://instagram-engineering.com/making-instagram-com-faster-part-1-f350c8fba0d4)
- **Part 2, push-based data / early flushing:** even a preloaded query cannot start until 2 network roundtrips have completed. Instagram used early flushing and progressive HTML (not HTTP/2 push) to stream data down with the page, a technique the post says has universal browser support. Page display completion time improved 14% on desktop and 23% on mobile, where network latency is higher. — [Part 2](https://instagram-engineering.com/making-instagram-com-faster-part-2-f350c8fba0d4)
- **Part 3, cache-first (published Oct 11, 2019):** on load, the page shows a cached copy of the previous feed and stories tray right away, then swaps in fresh data when it arrives. The accepted tradeoff is that users briefly see stale data. Implementation: Redux for state, with a subset of the Redux store persisted to an IndexedDB table and rehydrated on first page load. — [Part 3](https://instagram-engineering.com/making-instagram-com-faster-part-3-cache-first-6f3f130b9669)
- **Part 4, code size and execution:** "inline requires" mean that unless a module's code is actually used, the module is never required and so never executed. The main risk is modules with side effects. — [Part 4](https://instagram-engineering.com/making-instagram-com-faster-code-size-and-execution-optimizations-part-4-57668be796a8)
- **Meta web stack, facebook.com 2019–2020 (sibling product, not confirmed for instagram.com):** a complete rewrite on React plus Relay (a GraphQL client). The old homepage loaded more than 400 KB of compressed CSS, of which only about 10% was used for the first render. Changing how styles are written and built (atomic CSS) cut homepage CSS by 80%. — [Engineering at Meta, 2020](https://engineering.fb.com/2020/05/08/web/facebook-redesign/); [F8 2019 talk "Building the new facebook.com with React, GraphQL and Relay"](https://developers.facebook.com/videos/2019/building-the-new-facebookcom-with-react-graphql-and-relay/)
- **StyleX:** a styling syntax and compiler. Styles are written with `stylex.create()` / `stylex.props()` and compiled to "collision-free atomic CSS," with a static CSS file generated at compile time and "no runtime style injection." The docs page does not name which Meta products use it. — [stylexjs.com](https://stylexjs.com/docs/learn/). Meta separately says StyleX and React Strict DOM are used for code sharing in Facebook for Meta Quest and the Horizon Store. — [Engineering at Meta, Oct 2024](https://engineering.fb.com/2024/10/02/android/react-at-meta-connect-2024/)
- **Relay:** "declare what data each component needs via GraphQL… aggregate these dependencies and efficiently fetch the data in fewer round trips." — [relay.dev](https://relay.dev/docs/v18.0.0/getting-started/step-by-step-guide/)
- **Instagram Lite (Android, see also below):** the first Instagram Lite was a Progressive Web App. It was pulled in spring 2020 and rebuilt on Meta's internal server-driven framework **Bloks**. It relaunched in March 2021 in 170 countries at about 2 MB, against roughly 30 MB for the full app. Much of the logic was moved to the server, and heavy animations and AR effects were dropped. — [TechCrunch, Mar 2021](https://techcrunch.com/2021/03/10/facebook-targets-emerging-markets-with-instagram-lite-a-new-android-app-that-takes-up-just-2mb-in-170-countries); [Android Police, Sep 2020](https://www.androidpolice.com/2020/09/16/instagram-lite-is-back-and-barely-changed-after-a-4-month-hiatus-apk-download) (skeptical that the guts really changed)
- **Threads web (sibling, 2023):** CSS Grid lays out posts, and the avatar connector line is an SVG path (Ahmad Shadeed's analysis). — [mjtsai summary](https://mjtsai.com/blog/2023/07/10/how-the-threads-app-was-built)

### Inferences
- Of Instagram's four web techniques, three need no framework: preload hints, flushing the HTML shell early with data inlined, and painting cached state first and then revalidating. A server-rendered one-page app can copy them directly. For TNL, that means `<link rel=preload>` for the first feed API call, inlining the first page of feed JSON into index.html at request time, and painting the last feed from IndexedDB or the service worker cache before the network answers.
- "Inline requires" is a bundler-era fix for paying to execute code nobody uses. A concatenated vanilla app pays that cost too. The equivalent there is wrapping rarely used screens (Studio, admin-like panels, event screens) in functions that only run when the screen opens, or loading them with a lazy `<script>`.
- Atomic CSS/StyleX fixed a problem of 400 KB+ of CSS written by thousands of engineers. That does not apply to a one-person app whose CSS parts are each 24 KB or less. Its palette-token discipline already covers the theming goal.

### Gaps
- I found no primary source dating instagram.com's move from server-rendered Django pages to a React SPA. Popular history says React was first used on Instagram web around 2012–2013, but this is unverified here.
- I found no primary source confirming that instagram.com today (2024–2026) uses Comet, React 18 streaming SSR, Relay or StyleX. Only facebook.com is documented. The "Comet" name for the facebook.com rebuild was not confirmed in the sources found.
- No published instagram.com bundle sizes were found. The full text of Parts 1 and 4 (exact KB savings, ES2017 bundles, service worker details) could not be retrieved because the site returned 503.
- Official documentation of an instagram.com PWA, service worker or offline mode was not found. Only listicles name Instagram as a PWA.
- No Instagram-specific description of web performance measurement was found. The series uses "page display completion time" and feed page load time as its metrics.

## iOS: language, architecture, build, size, startup

### Takeaway
Instagram iOS was mostly Objective-C as late as 2020. It is built with Buck and split into frameworks so that links can run incrementally and in parallel (31 product frameworks). Its signature open-source contribution is IGListKit, a data-driven, diffing UICollectionView framework. Threads (2023), built largely from Instagram code, was about 95% Swift for new code, mostly UIKit with little SwiftUI.

### Cited Findings
- **IGListKit:** Instagram's open-source, data-driven `UICollectionView` framework. It removes manual `performBatchUpdates`/`reloadData()` calls, supports multiple data types in one list, and has a "decoupled diffing algorithm" with custom model diffing. It is written in Objective-C with Swift interop, requires iOS 11+ and Swift 5.1+, and is MIT licensed. Latest pinned version is 5.2.0, with about 13.1k stars. "The Instagram app uses the open source version main branch," which the team syncs daily. — [GitHub Instagram/IGListKit](https://github.com/Instagram/IGListKit)
- **IGListKit's architecture purpose (2016):** Ryan Nystrom said it avoids "massive view controllers" by splitting responsibilities across view controller, list adapter, section controller and cell. — [Open Source For You](https://www.opensourceforu.com/?p=25589)
- **Language mix:** "In 2020, most of our code and ongoing development was still in Objective-C, with only a limited amount of Swift code." — [Nate Stedman, @Scale, Oct 2023](https://atscaleconference.com/improving-instagram-ios-build-speeds/)
- **Build system and modularization:** Instagram iOS builds with Buck, using incremental builds and a remote cache for pre-built artifacts, across "millions of source files." A clean Xcode build took 20 s in 2017. By 2020 a one-line change took about 2 minutes. Compiling took about 1 s of that; linking and bundling were the bottleneck. The fix was to split code into frameworks, assigned automatically by file prefix, plus a build-time dependency-injection framework so features don't import each other. There are now 31 product frameworks linked in parallel. Direct's incremental build dropped to 19 s. "Fast Link" builds are 40% faster and make up 35% of local builds. — [@Scale, Oct 2023](https://atscaleconference.com/improving-instagram-ios-build-speeds/)
- **Threads iOS (2023, built from Instagram code):** "99% native," "95% of the new code we wrote was Swift," mostly UIKit with a dash of SwiftUI, and a homegrown cross-platform layer for a few lightweight flows. Existing Instagram Objective-C/Objective-C++ was reused. Emerge Tools found 0 dynamic libraries and an 81 MB share extension. — [mjtsai roundup](https://mjtsai.com/blog/2023/07/10/how-the-threads-app-was-built). The Threads team said the app launched with a large binary that shrank each release as unused inherited dependencies were pruned: "Inheriting all of what Instagram did meant there was a lot of stuff we had to undo." — [@Scale, "Making Threads for iOS"](https://atscaleconference.com/making-threads-for-ios-unraveling-our-journey-from-0-to-1/)
- **React Native (2016–2017, historical):** Instagram started exploring React Native in early 2016 to ship faster through code sharing. The first port was the simplest view, Push Notification settings, and its crash/OOM metrics came out neutral. — [Instagram Engineering, Feb 2017](https://instagram-engineering.com/react-native-at-instagram-dd828a9a90c7). The per-feature code-sharing figures commonly quoted (Post Promote 99%, SMS Captcha 97%, Comment Moderation 85%, Lead Gen Ads 87%, Push Notification Settings 92%) appear only in secondary sources. I could not verify them in the primary post. — [skcript](https://www.skcript.com/blog/these-large-scale-apps-were-built-using-react-native)
- **ComponentKit:** a recruiting blog (secondary, undated) says Meta's declarative ComponentKit is used in the Facebook and Instagram codebases. — [resumegeni](https://resumegeni.com/blog/ios-engineer/at-meta)
- **Startup (Meta iOS, sibling):** Facebook iOS focused on cold start because it initializes the app and fetches feed, while warm start only fetches feed. — [Engineering at Meta, 2015](https://engineering.fb.com/2015/11/20/ios/optimizing-facebook-for-ios-start-time/)

### Inferences
- The IGListKit idea is that a list is a pure function of an array of models, and the framework diffs old and new models by identity and equality and applies the minimal changes. It can be copied without UIKit. A vanilla `render()` that replaces a list's innerHTML wholesale loses scroll position, focus and in-flight animations. Keying list items by ID (`data-id`) and patching only changed or added nodes gives the same benefit.
- Instagram's build-speed problem (linking millions of files) has no TNL equivalent. TNL's numbered parts are an analogue of Instagram's per-prefix frameworks: both are mechanical, convention-based modularization rather than a curated graph.
- The Threads quote ("a lot of stuff we had to undo") is a warning about inheriting a large codebase. A small app's advantage is that it doesn't carry that weight.

### Gaps
- No first-party percentage of Swift vs Objective-C in Instagram iOS for 2021–2026 was found. A claim that it is "one of the largest Swift codebases" could not be verified. The primary 2023 source says it was mostly Objective-C in 2020.
- No primary source was found on Buck to Buck2 migration timing for Instagram iOS, Instagram iOS app-size numbers, or Instagram-specific iOS startup work.
- No primary source on ComponentKit's history at Instagram, or on whether React Native is still used in Instagram in 2026.

## Android: Kotlin, UI frameworks, images, bytecode, startup, Lite

### Takeaway
Instagram Android is a codebase of about 8M lines of code. It moved from Java to Kotlin starting in 2019 (over 50% Kotlin in 2023, with "Kotlin Everywhere" as the goal) and is moving from XML views to declarative UI (Jetpack Compose). Startup speed comes from Meta's Redex dex ordering plus, since about 2025, custom Baseline Profiles built from real-user class-load traces (up to 40% gains). Instagram Lite is a 2 MB, server-driven (Bloks) app.

### Cited Findings
- **Kotlin migration timeline:** A/B experiments in 2019 showed no change in engagement or bugs. January 2020: 7,000 lines of Kotlin. End of 2020: 160,000 lines, with 17 opt-in teams. H1 2021: open adoption with IDE parity. August 2021: "Kotlin-first" at about 30% of lines. 40% at end of 2022. Over 50% in 2023. The codebase is about 8M lines, and "Instagram was the first out of Meta's family of apps to embrace" Kotlin. Conversion is helped by a script that converts a Java file and submits a diff. — [Kotlin @ Instagram, @Scale, Oct 2023](https://atscaleconference.com/kotlin-instagram/)
- **Kotlin build cost:** at the end of 2021 Android build speed regressed by 100%, which opened an internal SEV. Kosabi, compiler plugins that generate source-only ABIs for Kotlin Buck targets, cut Kotlin build times by 55% and was integrated into 87% of the codebase by the end of 2022. K2 showed a 55% compiler throughput gain. Buck has supported Kotlin since 2019. — [@Scale, Oct 2023](https://atscaleconference.com/kotlin-instagram/)
- **Declarative UI:** Instagram is "actively moving away from writing UI code with XML and embracing Declarative UI," using Jetpack Compose. — [@Scale, Oct 2023](https://atscaleconference.com/kotlin-instagram/)
- **Litho (Meta's declarative Android UI):** it does the heavy rendering computation (layout) before frame time on a background thread, leaving minimal synchronous work on the UI thread. It was originally aimed at Facebook News Feed scrolling. — [Engineering at Meta](https://engineering.fb.com/android/multithreaded-rendering-on-android-with-litho-and-infer/)
- **Redex (2016):** Meta traces the classes loaded during cold start on test devices and places them first in the dex, which minimizes flash reads at startup. Older devices with slow storage suffer most from unordered classes. — [Engineering at Meta, Apr 2016](https://engineering.fb.com/2016/04/12/android/open-sourcing-redex-making-android-apps-smaller-and-faster/)
- **Baseline Profiles (Oct 2025):** Facebook and Instagram each load more than 20,000 classes at startup plus thousands more during feed scroll. Meta builds profiles from real-user class-load logs (a custom ClassLoader at a very low sample rate) plus method-cluster telemetry. Inputs are aggregated into a "Human Readable Profile" and passed to profgen. Lab benchmarks are not representative enough for FB/IG. Google Play Cloud Profiles are not the main source because ART treats startup as complete after 5 s. Profiles include classes or methods found in at least 20% of cold-start traces. Optimized journeys include Instagram feed scroll and DM inbox navigation. Results ranged from 3% to 40% across startup, scroll and navigation latency. The motivation is weekly shipping, which wipes compiled code on each update. — [Engineering at Meta, Oct 2025](https://engineering.fb.com/2025/10/01/android/accelerating-our-android-apps-with-baseline-profiles/)
- **Cold start, 2014 (historical):** Instagram's Android flat-design rewrite cut cold start by 120 ms. The team profiled, removed or rewrote slow items on the cold-start path, and deferred work to background threads. — [InfoQ, Nov 2014](https://www.infoq.com/news/2014/11/facebook-instagram-android). Reported start times were 1.5 s on a low-end Galaxy Y and 400 ms on a Galaxy S5. — [High Scalability](https://highscalability.com/instagram-improved-their-apps-performance-heres-how/). The original Instagram post is "Building a better Instagram app for Android" — [Instagram Engineering](https://instagram-engineering.com/building-a-better-instagram-app-for-android-c08f973662b) (could not be fetched, 503).
- **Startup metrics (Meta + Google, 2021):** Time-To-Initial-Display (TTID) and Time-To-Full-Display (TTFD). — [Android Developers Blog, Nov 2021](https://android-developers.googleblog.com/2021/11/improving-app-startup-facebook-app.html?m=0)
- **Facebook Android 2014 (sibling, historical):** start times dropped more than 50% in six months, partly by fetching stories earlier and showing cached content on poor networks. — [Engineering at Meta, 2014](https://engineering.fb.com/2014/06/19/android/improving-facebook-on-android/)
- **Instagram Lite (Android):** about 2 MB against roughly 30 MB for the full app. It is server-driven (Bloks), following Facebook Lite's approach of offloading code to the cloud, with extra server-side compression and AR/heavy animations removed. — [TechCrunch, Mar 2021](https://techcrunch.com/2021/03/10/facebook-targets-emerging-markets-with-instagram-lite-a-new-android-app-that-takes-up-just-2mb-in-170-countries); [netzwelt](https://www.netzwelt.de/news/186995-instagram-lite-schlanke-app-alte-handys-schlechte-netze-erscheint-weltweit.html)

### Inferences
- Meta's startup method is to measure what real users load at startup and prioritize exactly that. In a web app, the matching moves are: inline only the critical CSS/JS for the first screen, run less during boot, and use the service worker to precache the shell. The 20%-of-traces cutoff shows they optimize for the common path, not every path.
- Instagram Lite shows that thin, server-driven clients win on low-end devices and poor networks. TNL's server-rendered pages (`/u/:name`, `/p/:id`) are already partly in this style.

### Gaps
- Fresco (Meta's Android image library) and its use inside Instagram were not checked against a primary source this session.
- No primary source on Instagram Android's current share of Compose vs Litho, or on Kotlin share after 2023.
- No primary source on Instagram Lite's internal architecture beyond "Bloks / server-side." No source mentions Hermes or React Native in Lite.

## Cross-cutting client practices (design system, theming, a11y, images, video, offline, flags, monitoring)

### Takeaway
The best-documented cross-cutting practice is the 2019 iOS dark mode: thin wrappers over UIKit dynamic colors, a semantic colour palette owned by the design-systems team, and a deliberately small API. That is the same idea as TNL's `palette.js`. Public, primary detail on Instagram's image pipeline, accessibility engineering, localization, and client experimentation was not found.

### Cited Findings
- **Dark mode, iOS 13 (2019):** started during WWDC 2019 by iOS engineers and designers from Instagram's design systems team. They built thin wrappers around UIKit APIs that stayed compatible with Xcode 10/iOS 12, and kept the API surface small because "it's harder to misunderstand or misuse APIs if there are fewer of them." The first APIs were wrappers around dynamic colors and "a semantic color palette that our design systems team created." Dynamic colors respond to light/dark, "elevation" and accessibility settings, and dynamic images work the same way. Adoption was driven by an internal dark-mode working group and a wiki. — [Instagram Engineering, "Implementing Dark Mode in iOS 13"](https://instagram-engineering.com/instagram-darkmode-58802b43c0f2). It shipped about three weeks after iOS 13's public release. — [9to5Mac](https://9to5mac.com/?p=614231)
- **Video ads pipeline:** Instagram redesigned video-ad processing to be asynchronous. — [about.instagram.com](https://about.instagram.com/blog/engineering/making-instagram-video-ads-performant)
- **Progressive JPEG for social images (academic, not Instagram):** progressive JPEG with dynamic resizing saves 2.5x read data against baseline JPEG at 32 dB PSNR. — [USENIX HotStorage 2017](https://www.usenix.org/conference/hotstorage17/program/presentation/yan)
- **Cache-first on clients:** the web (IndexedDB-rehydrated Redux, see Part 3) and Facebook Android 2014 (cached stories on bad networks) both paint cached content first. — [Part 3](https://instagram-engineering.com/making-instagram-com-faster-part-3-cache-first-6f3f130b9669); [Engineering at Meta 2014](https://engineering.fb.com/2014/06/19/android/improving-facebook-on-android/)
- **Experimentation:** Kotlin was introduced through A/B tests that checked engagement and bug metrics. — [@Scale 2023](https://atscaleconference.com/kotlin-instagram/). React Native was introduced in the same way, through the Push Notification Settings experiment, auditing crashes and OOMs. — [Instagram Engineering 2017](https://instagram-engineering.com/react-native-at-instagram-dd828a9a90c7)

### Inferences
- TNL already follows the dark-mode lesson: one module owns semantic tokens, there are few APIs, and a test fails on drift. That is closer to Instagram's practice than to a typical small app.
- Instagram treats even a language switch as an experiment with guardrail metrics (crashes, OOMs, engagement). A one-person app can borrow the idea cheaply with a server-side setting toggle plus error logging before and after.

### Gaps
- No primary source on Instagram's client-side image resizing before upload, upload resumability/segmented upload, or progressive JPEG in delivery.
- No primary source on Instagram accessibility engineering (alt text generation, VoiceOver/TalkBack work), localization or RTL infrastructure, video player architecture, or client crash reporting. Meta-wide tools exist but were not verified for Instagram this session.
- No primary source on Instagram's client feature-flag system (Meta's QE/Gatekeeper/MobileConfig were not verified this session).

## Testing, performance regression detection, release cadence

### Takeaway
Meta's mobile performance testing moved from CT-Scan (field sampling plus a device lab of thousands of phones) to MobileLab (deterministic A/B builds on real devices that catch regressions of about 1%). Meta Android apps ship weekly. No Instagram-specific write-up of snapshot or screenshot testing was found.

### Cited Findings
- **CT-Scan (2015):** predicts a change's effect on speed, data, battery and memory, and samples performance counters from a small share of users at near-zero overhead. Testing went from desk-side devices to a data-center lab of thousands of phones, using real devices instead of simulators for performance. — [Engineering at Meta, Apr 2015](https://engineering.fb.com/2015/04/10/developer-tools/mobile-performance-tooling-infrastructure-at-facebook/)
- **MobileLab (2018):** compares a control build against a treatment build. It catches regressions as small as about 1% for many metrics, with 7x better confidence intervals and 75% fewer false positives than before. It is validated with A/A runs and injected regressions of known size. — [Engineering at Meta, Oct 2018](https://engineering.fb.com/2018/10/19/android/mobilelab/). Sources do not explicitly say Instagram uses it.
- **Release cadence:** Meta's Android apps ship weekly, and each update wipes ART-compiled code. — [Engineering at Meta, Oct 2025](https://engineering.fb.com/2025/10/01/android/accelerating-our-android-apps-with-baseline-profiles/)
- **Open-source testing at the source:** Instagram syncs IGListKit's open-source main branch daily, so the app is always testing the latest changes. — [GitHub](https://github.com/Instagram/IGListKit)

### Inferences
- MobileLab's main idea is to compare before and after on the same device, validate the detector with A/A runs, and only flag differences that beat measured noise. TNL can borrow this cheaply. Its `npm run e2e` and glitch watcher could time key flows (boot to first feed paint, open post) on the base branch against the PR branch and fail only beyond a noise band measured from repeated runs.

### Gaps
- No Instagram-specific primary sources on snapshot/screenshot tests (e.g. iOS snapshot testing), UI test frameworks, or its iOS release train cadence.

## What a one-person vanilla-JS web app can borrow vs. what is scale-only

### Takeaway
Most of Instagram's *performance ideas* need no framework: preload, early flush with data, cache first, defer unused code, diff keyed lists, measure the real startup path, and A/B performance with noise control. Most of its *tooling* exists to coordinate thousands of engineers and millions of files: Buck/Buck2, Kosabi, Relay/GraphQL, StyleX, Bloks, MobileLab, Redex. That tooling isn't justified for TNL.

### Cited Findings
- **Borrowable, with evidence:** preloads and early flushing (+14% desktop, +23% mobile), cache-first rendering with IndexedDB, and executing modules only when used. — [Part 2](https://instagram-engineering.com/making-instagram-com-faster-part-2-f350c8fba0d4); [Part 3](https://instagram-engineering.com/making-instagram-com-faster-part-3-cache-first-6f3f130b9669); [Part 4](https://instagram-engineering.com/making-instagram-com-faster-code-size-and-execution-optimizations-part-4-57668be796a8). Also: a small semantic colour API — [dark mode](https://instagram-engineering.com/instagram-darkmode-58802b43c0f2); diffed, data-driven lists — [IGListKit](https://github.com/Instagram/IGListKit); and prioritizing what real users load at startup — [Baseline Profiles 2025](https://engineering.fb.com/2025/10/01/android/accelerating-our-android-apps-with-baseline-profiles/).
- **Scale-justified, with evidence:** framework splitting and remote caches for builds over "millions of source files" — [@Scale iOS builds](https://atscaleconference.com/improving-instagram-ios-build-speeds/); Kosabi for an 8M-line Kotlin codebase — [@Scale Kotlin](https://atscaleconference.com/kotlin-instagram/); atomic CSS because a homepage loaded 400 KB+ of CSS, about 90% unused — [facebook.com rewrite](https://engineering.fb.com/2020/05/08/web/facebook-redesign/); device labs of thousands of phones — [CT-Scan](https://engineering.fb.com/2015/04/10/developer-tools/mobile-performance-tooling-infrastructure-at-facebook/).

### Inferences
- **Concrete borrow list for TNL:**
  1. Inline the first feed JSON (or preload its API call) in the index.html response.
  2. Paint the last-seen feed from cache, then revalidate. The service worker or IndexedDB already exists, and `skel()` covers the very first visit.
  3. Lazy-run heavy, rarely used parts (Studio, events, editors).
  4. Key `render()` output by IDs and patch lists instead of replacing them, to keep scroll position and motion. This is IGListKit's lesson.
  5. Keep the palette API tiny and semantic. TNL already does this.
  6. Build a before/after timing check in e2e with an A/A noise baseline. This is MobileLab's lesson.
  7. Ship risky changes behind an admin setting and compare error rates. This is how Instagram rolled out Kotlin and React Native.
- **Where TNL's choices already match Instagram's direction:** server-driven thinness (Lite/Bloks), cache-first, transform/opacity-only animation (Litho's reason for existing is also keeping the UI thread's frame work minimal), and mechanical modularization (file-prefix frameworks ≈ numbered parts).
- **Where TNL diverges by design:** no bundler means no tree-shaking or code-splitting. The 24 KB-per-part rule plus lazy execution is the practical substitute. No GraphQL means each screen's data needs are implicit in the REST routes, which is fine at one developer but would not scale to many teams. That scaling problem is what Relay's per-component data declarations address.

### Gaps
- No public Instagram figure for web JS bundle size or Core Web Vitals to benchmark TNL against.
