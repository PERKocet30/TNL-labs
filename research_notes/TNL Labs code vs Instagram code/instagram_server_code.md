# Instagram's server-side code: language, structure, typing, tooling and practices (2010 – Oct 2026)

Scope note: Research done 2026-10-08. Most primary Instagram Engineering posts (instagram-engineering.com, Medium) returned 503/403 to direct fetches, so some figures come from search excerpts of those posts or from reliable coverage (InfoQ, Meta engineering blogs, pyrefly.org). Dates are given for every figure; anything before ~2023 is marked **[historical]**. For the comparison side, TNL Labs right now has 30 `src/server-NN-*.js` parts, about 8.2k lines of server JS (server parts + db/pay/mail), 41 `test/*.test.mjs` suites, and 4 runtime dependencies (express, cors, bcryptjs, ffmpeg-static) (local `package.json`, `src/`, `test/`).

## 1. Language & framework: Python/Django monolith, the Python 3 migration, codebase size

### Takeaway
Instagram's back end has been one Python/Django monolith ("Instagram Server", the "Instagram Django service") since 2010. Instagram describes it as the world's largest Django deployment. By 2019 it had several million lines and a few thousand Django endpoints, and Meta's 2025–26 tooling materials put it at about 20M lines. It moved from Python 2 to 3 in 2017 inside the main branch, with no downtime and no pause in feature work.

### Cited Findings
- **[historical, 2011]** The early stack was Django on AWS (25+ High-CPU Extra-Large instances, stateless app servers), Gunicorn as the WSGI server (chosen over Apache/mod_wsgi because it was easier to configure and used less CPU), sharded PostgreSQL behind PgBouncer, Redis (feeds, sessions), Gearman with about 200 Python workers for async tasks (fan-out, sharing), memcached, Solr for geo-search, S3/CloudFront for photos, and Munin for metrics. — [What Powers Instagram (Instagram Engineering, 2011)](https://instagram-engineering.com/what-powers-instagram-hundreds-of-instances-dozens-of-technologies-adf2e22da2ad); [High Scalability summary](https://highscalability.com/instagram-architecture-14-million-users-terabytes-of-photos/)
- **[historical]** Instagram reached 14M users with 3 engineers on this stack of proven, off-the-shelf tools. — [Engineer's Codex (secondary)](https://read.engineerscodex.com/p/how-instagram-scaled-to-14-million); [High Scalability](https://highscalability.com/instagram-architecture-14-million-users-terabytes-of-photos/)
- **[historical, 2013+]** After Facebook acquired Instagram, its infrastructure moved from AWS into Facebook data centers. — [InfoQ, 2016](https://www.infoq.com/news/2016/04/continuous-deployment-instagram)
- **[historical, 2017]** Lisa Guo and Hui Ding's PyCon 2017 keynote "Python@Instagram" covered the upgrades from Django 1.3 to 1.8 and from Python 2 to 3. It was described as "the world's largest deployment of Django" and the first large-scale service on Python 3 (3.5). — [PyCon 2017 recap, Mouse vs Python](https://www.blog.pythonlibrary.org/2017/05/21/python-2017-second-day/); [OSCON 2018 abstract](https://conferences.oreilly.com/oscon/oscon-or-2018/public/schedule/detail/67756); [slides](https://speakerdeck.com/pycon2017/keynote-lisa-guo-and-hui-ding-python-at-instagram?slide=22)
- **[historical, 2017]** Migration method: the conversion happened in the main branch. Code was made compatible with both Python 2 and 3 while product kept shipping continuously, with no downtime and no slowdown of the feature pipeline. — [Caktus Group recap](https://caktusgroup.com/blog/2017/06/12/python-instagram); [PyCon recap](https://www.blog.pythonlibrary.org/2017/05/21/python-2017-second-day/)
- **[historical, 2017]** Reported results were about 12% CPU savings on uWSGI/Django and about 30% memory savings on Celery, roughly four months after rollout. The engineers said performance had not been the goal. — [The New Stack](https://thenewstack.io/instagram-makes-smooth-move-python-3/) (via search excerpt; the full page did not load)
- **[2017]** MonkeyType announcement: "hundreds of engineers working on well over a million lines of Python 3." — [Instagram Engineering, MonkeyType](https://instagram-engineering.com/let-your-code-type-hint-itself-introducing-open-source-monkeytype-a855c7284881)
- **[2019]** "Static Analysis at Scale" (Instagram Engineering) describes the server as several million lines with a few thousand Django endpoints, all loaded and served together. Hundreds of engineers ship hundreds of commits a day, and it deploys about 100 times a day. — [Static Analysis at Scale: An Instagram Story](https://instagram-engineering.com/8f498ab71a0c) (search excerpt)
- **[2019]** Carl Meyer's "Python at Scale: Strict Modules" calls Instagram Server "a several-million-line Python monolith" with hundreds of commits a day, deployed to production every few minutes. — [Instagram Engineering, Strict Modules](https://instagram-engineering.com/python-at-scale-strict-modules-c0bb9245c834)
- **[2022]** Instagram Server startup imports about 28,000 modules. — [Meta, Python Lazy Imports with Cinder (2022-06-15)](https://developers.facebook.com/blog/post/2022/06/15/python-lazy-imports-with-cinder)
- **[2025–2026]** Pyrefly reportedly type-checks the whole Instagram codebase in 13.4 s, against more than 100 s for Pyre. A 2026 handbook entry says Meta runs Pyrefly on Instagram's "~20M LOC" codebase. — [SSOJet news (secondary)](https://ssojet.com/news/meta-open-sources-pyrefly-a-high-performance-python-type-checker); [pydevtools handbook](https://pydevtools.com/handbook/reference/pyrefly/)
- **[2022–2026]** The Django service still runs in production on Meta's runtime: CinderX is "used in production at Meta for use-cases like the Instagram Django service." — [PyPI cinderx](https://pypi.org/pypi/cinderx/)

### Inferences
- The language and framework never changed. Instagram kept Python and Django from 2010 to 2026 and added rigor around them: types, linters, its own runtime. It did not rewrite. The closest TNL parallel is keeping Node/Express and growing the guardrails.
- The Python 3 move worked because the code was kept runnable under both versions in a single trunk, with tests as the gate and continuous deploys. It was not a big-bang branch.
- Rough scale: TNL's about 8k server lines is around 0.04% of Instagram's about 20M.

### Gaps
- I found no current (2025–26) primary figure for the number of Django endpoints or engineers committing. The 2019 "few thousand endpoints / hundreds of engineers" is the latest primary figure.
- I could not retrieve the details of the Python 3 unit-test strategy (for example, the test-coverage push before the switch) from the keynote text. Video and slides exist but were not read.
- The ~20M LOC figure is secondary (a handbook citing Meta) and was not verified against a Meta primary source.

## 2. Performance work in code: GC, copy-on-write, uWSGI, Cinder, lazy imports, async

### Takeaway
Instagram ran Django under uWSGI's pre-fork model and repeatedly changed CPython itself for it. In 2017 it disabled GC and later added `gc.freeze()` upstream. It built Cinder, a CPython fork with a JIT, Static Python, Strict Modules, immortal objects and lazy imports. Lazy imports became PEP 690 (withdrawn) and then explicit lazy imports in PEP 810, which is in Python 3.15.

### Cited Findings
- **[historical, 2017]** Django ran under uWSGI pre-fork, where workers share memory with the master through copy-on-write. Reference counting and the GC touching object headers turned shared pages private: a new worker's about 250MB of shared memory dropped to about 140MB within seconds. Disabling GC recovered about 10% capacity. — [Dismissing Python Garbage Collection at Instagram](https://instagram-engineering.com/dismissing-python-garbage-collection-at-instagram-4dca40b29172) (search excerpt)
- **[historical, 2017]** Fully disabling GC let memory grow from reference cycles. The follow-up was a copy-on-write-friendly fix: `gc.freeze()` was added to CPython (3.7), called in the parent before forking, so pre-fork objects are never scanned. — [Copy-on-write friendly Python garbage collection](https://instagram-engineering.com/copy-on-write-friendly-python-garbage-collection-ad6ed5233ddf); [bugs.python.org](https://bugs.python.org/msg302780)
- **[2021–2022]** Cinder is "Instagram's internal production version of CPython 3.8", open-sourced in 2021. Its features include a method-at-a-time C++ JIT (reported 1.5–4x on many benchmarks), shadowcode (inline caching and quickening), immortal objects, Static Python (a type-specialized bytecode compiler, up to 7x with the JIT in some tests), and Strict Modules. Meta says it is not supported for outside users. — [Meta Engineering, Cinder JITs Instagram (2022-05-02)](https://engineering.fb.com/2022/05/02/open-source/cinder-jits-instagram/); [i-programmer](https://www.i-programmer.info/news/216-python/14575-instagram-cinder-python-accelerator-open-sourced-.html)
- **[2022]** The Cinder JIT compiles functions "prefork", before uWSGI forks workers, which fits the copy-on-write model. — [Meta Engineering, Cinder JITs Instagram](https://engineering.fb.com/2022/05/02/open-source/cinder-jits-instagram/)
- **[2019]** Strict Modules: a static analyzer checks that a module's top-level code has no side effects outside the module, and a loader creates StrictModule objects for modules that opt in. The goal is reliability and, later, safe hot-reload. — [Python at Scale: Strict Modules](https://instagram-engineering.com/python-at-scale-strict-modules-c0bb9245c834); [Cinder description via i-programmer](https://www.i-programmer.info/news/216-python/14575-instagram-cinder-python-accelerator-open-sourced-.html)
- **[2022]** Lazy imports on Instagram Server: the developer reload after any change averaged about 50 s, with some reaching 1.5 min. Before this, engineers had made subsystems lazy by hand (Django URLs, notifications, observers, regexes), which was fragile. Cinder Lazy Imports was rolled out in January 2022 to thousands of hosts and enabled in tens of thousands of modules. Results: about 12x fewer modules loaded, p50 reload down about 70%, p90 down about 60%, other tools 50–70% faster, memory down 20–40%, and daily circular-import errors down from about 80 to 0. Next step: upstream via PEP 690. — [Meta, Python Lazy Imports with Cinder (Germán Méndez Bravo, 2022-06-15)](https://developers.facebook.com/blog/post/2022/06/15/python-lazy-imports-with-cinder)
- **[2022]** Circular imports were "the biggest obstacle to refactoring" and had caused several outages. A dependency visualization of the server took about 3 hours to run and came out as a "large, black ball." — [same source](https://developers.facebook.com/blog/post/2022/06/15/python-lazy-imports-with-cinder)
- **[2023–2026]** PEP 690 (implicit lazy imports) was withdrawn in 2023. PEP 810 (explicit `lazy import`) was accepted unanimously by the Steering Council on 2025-11-03 for Python 3.15, and 3.15 beta 1 shipped it on 2026-05-07. — [pydevtools: What is PEP 810](https://pydevtools.com/handbook/explanation/what-is-pep-810/); [JetBrains blog, 2026-06](https://blog.jetbrains.com/pycharm/2026/06/explicit-lazy-imports-are-coming-to-python-3-15/); [discuss.python.org](https://discuss.python.org/t/pep-810-explicit-lazy-imports/104131/176)
- **[2023–2026]** Cinder was repackaged as the CinderX extension, starting from 3.10. Python 3.14 is the first stock CPython that CinderX supports; earlier versions need Meta's fork. It is still experimental for outside users. — [PyPI cinderx](https://pypi.org/pypi/cinderx/)
- **[historical, 2018]** Asyncio: Jimmy Lai's PyCon Taiwan 2018 talk describes moving the "Instagram Django Service" (500M+ DAU) to asyncio. The team built shared helpers for asyncio testing, debugging and profiling, static analysis tools, and asyncio bug fixes (nested loops, orphan-future loop-close bug). — [PyCon TW 2018 abstract](https://tw.pycon.org/2018/en-us/events/talk/577560200077115539/)

### Inferences
- Instagram tuned the runtime only after the product and team were huge, around 2017 onward. The early stack (2011) was stock Django on Gunicorn. For a small app, the parallel is to measure before optimizing. TNL's one Node process with built-in `node:sqlite` is the 2011-Instagram equivalent of "stock and simple."
- Circular imports and import-time side effects in a monolith cost Instagram outages and ~50 s reloads. TNL's concatenated-parts design avoids imports entirely, but order dependence between parts is a related "load-order" risk.

### Gaps
- I could not confirm whether Instagram still runs uWSGI in 2026 or has moved to another server. No primary source was found.
- I found no primary figures on how much of Instagram Server is async today, or on Django version history after 1.8.
- I found no primary 2025–26 Instagram-specific Static Python adoption numbers.

## 3. Type safety & static analysis: Pyre/Pyrefly, MonkeyType, Pysa, LibCST, Fixit, Flake8

### Takeaway
Typing was rolled out incrementally, starting in 2017. MonkeyType recorded types at runtime and generated annotations, and Pyre, built in 2017 for Instagram's typed code, enforced them. Pyrefly (Rust, 2025, 1.0 in May 2026) has since replaced Pyre. On top of types: Pysa taint analysis for security (44% of Instagram server security bugs in H1 2020), and LibCST-based lint and codemods (Fixit) to keep hundreds of engineers consistent.

### Cited Findings
- **[2017]** MonkeyType was open-sourced to add annotations by tracing types seen at runtime, so that "well over a million lines" of Python 3 would become more amenable to static analysis. — [Instagram Engineering, MonkeyType](https://instagram-engineering.com/let-your-code-type-hint-itself-introducing-open-source-monkeytype-a855c7284881)
- **[2017–2025]** In 2017 Meta built Pyre for "Instagram's massive codebase of typed Python". It was written in OCaml and inspired by Hack and Flow. The team later rebuilt from scratch as Pyrefly because they needed an IDE-responsive, extensible checker; they had been using Pyright for navigation. Pyrefly was announced as an MIT-licensed alpha on 2025-05-15. — [pyrefly.org, Introducing Pyrefly](https://pyrefly.org/blog/introducing-pyrefly/); [pyrefly.org, Lessons from Pyre](https://pyrefly.org/blog/lessons-from-pyre/)
- **[2025–2026]** Pyrefly is written in Rust with a new inference engine and incremental model. It checks Instagram in 13.4 s against more than 100 s for Pyre (2025 report); another source says about 30 s for about 20M LOC. Pyrefly 1.0.0 shipped in May 2026 with monthly releases. — [SSOJet (secondary)](https://ssojet.com/news/meta-open-sources-pyrefly-a-high-performance-python-type-checker); [pydevtools handbook](https://pydevtools.com/handbook/reference/pyrefly/). The timings conflict between sources, likely because they were measured at different dates and codebase sizes.
- **[2020]** Pysa is a taint-analysis tool built on Pyre: you define sources and sinks, and it runs on proposed diffs before merge, returning results in about an hour. It found 44% of all security bugs in Instagram's server-side Python in H1 2020. Of the issues it reported, 49 (15%) were significant and 131 (40%) were real but mitigated, and false positives were capped at 150 (45%). It is modeled on Zoncolan, Facebook's analyzer for Hack. — [Meta Engineering, Pysa](https://engineering.fb.com/security/pysa/); [Duo Decipher](https://duo.com/decipher/facebook-releases-static-code-analysis-tool-for-python)
- **[2021]** Pyre/Pysa and Zoncolan authors received the IEEE Computer Society Cybersecurity Award for static analysis tools. — [Meta Engineering, 2021-10-20](https://engineering.fb.com/2021/10/20/security/static-analysis-award/)
- **[2019]** LibCST is "the heart of many of our internal linting and automated refactoring tools" at Instagram. It is a concrete syntax tree that keeps comments and whitespace, so codemods can rewrite code safely. — [Static Analysis at Scale](https://instagram-engineering.com/8f498ab71a0c) (excerpt); [Meta Engineering, Fixit 2 (2023-08-07)](https://engineering.fb.com/2023/08/07/developer-tools/fixit-2-linter-meta/)
- **[2016–2023]** Meta has used Flake8 internally since 2016, with many team-built plugins (flake8-bugbear came from Łukasz Langa at Facebook). Flake8's limits: no autofixes, a shared error-code namespace, and the stdlib `ast` lags new syntax. Instagram built Fixit, an autofixing linter on LibCST, which complements Flake8. Fixit 2 (2023) added hierarchical TOML config and local in-repo rules for the monorepo. A rule can be under a dozen lines with inline test cases, and `fixit fix --automatic` applies fixes. — [Meta Engineering, Fixit 2](https://engineering.fb.com/2023/08/07/developer-tools/fixit-2-linter-meta/); [PyCon TW 2020, Jimmy Lai (Instagram Infra)](https://pyvideo.org/pycon-taiwan-2020/fixit-a-lint-framework-writes-better-python-code-for-you-pycon-taiwan-2020.html); [GitHub Instagram/Fixit](https://github.com/instagram/fixit)
- **[2019]** Strict Modules also act as static enforcement: they reject module top-level code with side effects. — [Python at Scale: Strict Modules](https://instagram-engineering.com/python-at-scale-strict-modules-c0bb9245c834)

### Inferences
- The order of adoption was: lint (Flake8, 2016) → runtime-generated types plus a type checker (2017) → codemod and autofix infrastructure (LibCST/Fixit, about 2019) → security taint analysis on every diff (Pysa, about 2020) → faster IDE-grade checking (Pyrefly, 2025–26). Each step came after the codebase or team grew past what review alone could catch.
- The JS equivalents for TNL would be gradual JSDoc/`// @ts-check` (MonkeyType-style incremental typing without a build step), a linter with autofix, and a few custom rules encoding TNL's own invariants. Some of those are already checked by custom tests, for example `palette.test.mjs`, which plays a role like Fixit's "local rules." Any such tool counts as a new dependency, which CLAUDE.md says needs approval.

### Gaps
- I found no primary figure for what percentage of Instagram's code is typed or strict-typed today.
- No details were found on whether Pyre/Pyrefly or Fixit blocks landing versus only warns in Instagram's diff workflow, beyond Pysa running on diffs before merge.

## 4. Code organization: monorepo, monolith vs services, Meta infra, API, flags, config

### Takeaway
Instagram Server remains a single Django monolith (all endpoints loaded and served together) inside Meta's monorepo. It sits on Meta infrastructure that grew around it after 2013. Primary sources reachable here confirm the monolith shape, the monorepo, and feature toggles. They did not confirm, in this session, specific Instagram usage of TAO, Cassandra/Rocksandra, Thrift, GraphQL, Gatekeeper, QuickExperiment or Configerator.

### Cited Findings
- **[2019]** All of the server's few thousand Django endpoints are "loaded up and served together", which is a monolith. — [Static Analysis at Scale](https://instagram-engineering.com/8f498ab71a0c) (excerpt); [Strict Modules](https://instagram-engineering.com/python-at-scale-strict-modules-c0bb9245c834)
- **[2023]** Meta's monorepo contains thousands of projects, many with their own lint and CI needs, which is why Fixit 2 added hierarchical, per-directory config. — [Meta Engineering, Fixit 2](https://engineering.fb.com/2023/08/07/developer-tools/fixit-2-linter-meta/)
- **[historical, 2016]** Feature toggles were used for data changes. Shard migration: copy repeatedly until the delta is small, disable via a toggle, do a final copy, re-enable at the new location. Schema change: deploy code that reads and writes both schemas, change the DB, enable new writes, backfill, then enable new reads, keeping old writes as a safety net. — [InfoQ, 2016](https://www.infoq.com/news/2016/04/continuous-deployment-instagram)
- **[historical, 2011]** Data was sharded PostgreSQL plus Redis and memcached, with Gearman for async work. — [What Powers Instagram](https://instagram-engineering.com/what-powers-instagram-hundreds-of-instances-dozens-of-technologies-adf2e22da2ad)

### Inferences
- The structure maps closely: TNL has one process with all routes loaded together, which is the same "monolith first" shape Instagram never abandoned. Instagram's problems came from scale inside the monolith (import graph, reload time, side effects), not from the monolith choice itself.
- Instagram's expand-then-contract schema migrations behind toggles (2016) map directly to TNL's `src/db.js` migrations on a live member DB: add a column, dual-write, then switch reads.

### Gaps
- Not verified this session with primary sources: Instagram's use of TAO, Cassandra/Rocksandra, Thrift services, its REST versus GraphQL API split, Gatekeeper/QuickExperiment for gating, and Configerator for config. These are widely reported but I did not fetch sources, so the report writer should not state them as cited facts from these notes.

## 5. Testing & delivery: tests, continuous deployment, canaries, rollback, review

### Takeaway
By 2016 Instagram deployed backend code automatically on every commit to master, 30–50 times a day to thousands of machines. Each change went through test gating (Jenkins), a canary subset, and auto-push or rollback. By 2019 it was about 100 deploys a day, "every few minutes." The prerequisites were a fast, non-flaky test suite and the ability to pin a breakage to 1–3 commits.

### Cited Findings
- **[historical, 2016]** Before continuous deployment, rollouts were "a mish-mash of manual steps and scripts": Fabric over SSH, a sanity deploy to one machine first, and Sauron, a release-tracking UI/DB. — [InfoQ, 2016](https://www.infoq.com/news/2016/04/continuous-deployment-instagram)
- **[historical, 2016]** Continuous deployment: 30–50 deploys a day across thousands of machines, triggered by commits to master, usually with no human involved. Jenkins marks commits good or bad from test results. A canary subset gets the change first, then it is either pushed fleet-wide or rolled back. Logic picks the next commit to push. Authors are notified by chat, email and SMS, and deploys are logged to an ops-event DB and overlaid on graphs. — [InfoQ, 2016](https://www.infoq.com/news/2016/04/continuous-deployment-instagram); [Continuous Deployment at Instagram](https://instagram-engineering.com/continuous-deployment-at-instagram-1e18548f01d1)
- **[historical, 2016]** The stated principles were a high-quality test suite, quick identification of bad commits, visibility at every stage, and a working rollback plan. The early obstacles were a flaky, slow test suite and a backlog of commits after failed deploys. — [InfoQ, 2016](https://www.infoq.com/news/2016/04/continuous-deployment-instagram); [O'Reilly, 5 principles](https://www.oreilly.com/content/instagrams-5-principles-for-implementing-and-scaling-continuous-deployment/)
- **[historical, 2016–17]** Changes reached the fleet in as little as about 10 minutes. Per-commit deploys narrow a bad change to "one, or at most two or three" commits. A rollout pauses for a human if more than 1% of hosts fail (secondary summary). — [O'Reilly](https://www.oreilly.com/content/instagrams-5-principles-for-implementing-and-scaling-continuous-deployment/); [OfferZen (secondary)](https://www.offerzen.com/blog/how-instagram-does-40-daily-deployments); [SREcon16 talk, Michael Gorven](https://usenix.org/conference/srecon16/program/presentation/gorven)
- **[2019]** About 100 deploys a day ("every few minutes"), with hundreds of commits a day. — [Static Analysis at Scale](https://instagram-engineering.com/8f498ab71a0c) (excerpt); [Strict Modules](https://instagram-engineering.com/python-at-scale-strict-modules-c0bb9245c834)
- **[2020]** Static analysis (Pysa) runs on proposed code changes before merge, which makes analysis part of code review. — [Meta Engineering, Pysa](https://engineering.fb.com/security/pysa/)
- **[2022]** Lazy imports rollout required fixing "many tests" and removing some libraries, which shows the test suite acting as the safety net for runtime changes. — [Meta, Lazy Imports](https://developers.facebook.com/blog/post/2022/06/15/python-lazy-imports-with-cinder)

### Inferences
- TNL already has the 2016-Instagram shape at small scale. Push to main auto-deploys (Railway, about 80 s), CI tests gate PRs (`tests.yml`), and a post-deploy live check runs (`after-deploy.yml`). What TNL lacks compared with Instagram is a canary (a partial-traffic stage) and one-click automated rollback. With one instance, Railway's redeploy-previous is the practical rollback.
- Instagram's "flaky, slow test suite" was the main obstacle to continuous deployment. TNL's plain-Node suites printing `N passed, N failed` are fast. Keeping them fast and deterministic matters more than adding a framework.

### Gaps
- No primary 2023–26 numbers were found for current Instagram deploy frequency, test counts, or test selection (for example, Meta's predictive test selection as applied to Instagram).
- Phabricator/diff-based review and on-call practices for Instagram were not confirmed this session with primary sources.

## 6. What carried over from the 3-engineer era, and when each layer of rigor arrived

### Takeaway
The early principles carried through every later layer: proven, boring tech (Django, Postgres, Redis), stateless app servers, and keeping things simple. Rigor was added in steps, each when scale forced it. Instagram never rewrote the app; it built tools that made the existing Python monolith safer and faster.

### Cited Findings
- **[2010–2012]** 3 engineers and 14M users on stock components: Django, Gunicorn, Postgres, Redis, memcached and Gearman, with stateless app servers that "scale out easily." — [What Powers Instagram](https://instagram-engineering.com/what-powers-instagram-hundreds-of-instances-dozens-of-technologies-adf2e22da2ad); [High Scalability](https://highscalability.com/instagram-architecture-14-million-users-terabytes-of-photos/)
- **Timeline of added rigor (each item cited above):**
  - 2013: moved into Facebook data centers ([InfoQ](https://www.infoq.com/news/2016/04/continuous-deployment-instagram))
  - about 2015–16: automated continuous deployment with test gating and canary, replacing Fabric scripts ([InfoQ](https://www.infoq.com/news/2016/04/continuous-deployment-instagram))
  - 2016: Flake8 linting ([Fixit 2](https://engineering.fb.com/2023/08/07/developer-tools/fixit-2-linter-meta/))
  - 2017: GC/copy-on-write runtime tuning ([GC post](https://instagram-engineering.com/dismissing-python-garbage-collection-at-instagram-4dca40b29172)), Python 3 plus Django upgrade ([PyCon recap](https://www.blog.pythonlibrary.org/2017/05/21/python-2017-second-day/)), MonkeyType and Pyre for typing ([MonkeyType](https://instagram-engineering.com/let-your-code-type-hint-itself-introducing-open-source-monkeytype-a855c7284881); [Pyrefly blog](https://pyrefly.org/blog/introducing-pyrefly/))
  - 2018: asyncio adoption ([PyCon TW](https://tw.pycon.org/2018/en-us/events/talk/577560200077115539/))
  - 2019: LibCST codemods and Strict Modules ([Strict Modules](https://instagram-engineering.com/python-at-scale-strict-modules-c0bb9245c834))
  - 2020: Pysa security analysis on diffs ([Pysa](https://engineering.fb.com/security/pysa/))
  - 2021: Cinder open-sourced ([i-programmer](https://www.i-programmer.info/news/216-python/14575-instagram-cinder-python-accelerator-open-sourced-.html))
  - 2022: lazy imports in production ([Meta](https://developers.facebook.com/blog/post/2022/06/15/python-lazy-imports-with-cinder))
  - 2023: Fixit 2 ([Meta](https://engineering.fb.com/2023/08/07/developer-tools/fixit-2-linter-meta/))
  - 2025–26: Pyrefly, CinderX on stock CPython 3.14, and PEP 810 lazy imports in Python 3.15 ([pyrefly.org](https://pyrefly.org/blog/introducing-pyrefly/); [PyPI cinderx](https://pypi.org/pypi/cinderx/); [pydevtools PEP 810](https://pydevtools.com/handbook/explanation/what-is-pep-810/))

### Inferences
- Mapping TNL Labs onto Instagram's timeline:
  - TNL looks like Instagram around 2011 in architecture: one framework app, one database, stateless-ish server, few dependencies.
  - It looks like Instagram around 2016 in delivery: CI-gated automatic deploys from main, a post-deploy check, and a test per behavior.
  - The next rungs Instagram climbed were a linter (2016), then gradual typing (2017), then custom autofix rules (2019). The JS equivalents are ESLint, JSDoc plus `// @ts-check`, and custom rules. Each is incremental and can be done file by file, the way MonkeyType and Pyre were rolled out, but each needs owner approval under TNL's no-new-dependencies rule.
- Instagram's guardrails are mostly bespoke tooling built by dedicated infra teams with hundreds of engineers behind them. The lesson that transfers is the order and the incrementalism, not the tools. TNL's custom invariant tests (palette drift, part ≤24KB, event vote secrecy) are the small-team analogue of Instagram's "local lint rules."
- TNL's numbered parts concatenated at boot have no counterpart at Instagram. The closest concern is Instagram's fight against import-order side effects (Strict Modules, lazy imports): both are about making load order safe in one big process.

### Gaps
- I could not find the exact "do the simple thing first" wording in a primary Instagram source this session. The principle is reflected in the 2011 stack post and widely attributed to early Instagram engineering talks, but it is not quoted here.
- I found no primary source on headcount at each stage (for example, when Instagram created a dedicated infra or developer-tools team).
