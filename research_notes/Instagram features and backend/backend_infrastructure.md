# Instagram back-end infrastructure (2010 – Oct 2026) → a scaling path for TNL Labs

Research date: 2026-10-07. Items marked **[historical]** describe Instagram at a past date and are not a claim about Instagram today. Recommendations are tagged **[no new dep]**, **[new dep]** (npm package) or **[new service]** (external account/infra; needs owner approval per CLAUDE.md).

### Current TNL Labs setup (read from the repo, read-only, 2026-10-07)
- One Express process; `package.json` start script is `node --experimental-sqlite --max-old-space-size=768 src/server.js`; engines `node >=22.5.0`; four deps: `bcryptjs`, `cors`, `express`, **`ffmpeg-static`** (already a dependency — used to pull audio out of video; `src/server-01-boot.js` lines 12–20 load it in a try/catch so the server survives without it).
- `src/db.js`: one `new DatabaseSync(DB_PATH)` connection; pragmas `journal_mode = WAL`, `synchronous = NORMAL`, `foreign_keys = ON`. **No `busy_timeout`, no `mmap_size`, no `cache_size`, no `PRAGMA optimize`** set. Backups via `VACUUM INTO ?` (`backupTo()`), daily, keep 7, in `/app/data/backups` — same volume as the live DB. Logs (`error_log`, `studio_events`) are trimmed by `DELETE … NOT IN (… LIMIT N)`.
- Uploads: streamed upload route `/api/upload/stream` (limits: image 30MB, video 650MB, audio 100MB; type sniffed from first 16 bytes), plus a small base64 route (8MB). Served by `express.static` at `/uploads` with `Cache-Control: public, max-age=31536000, immutable` — filenames contain a hash. **Image variants (3000/1440/480px) are produced in the browser** (`src/app-08-images.js`, canvas), with EXIF/XMP stripped client-side, not server-side.
- Realtime: `src/server-10-live.js` — SSE at `/api/stream`, one-use 60s tickets (EventSource can't send headers), in-memory `Map` of clients, `broadcast()` iterates every connection, `sendTo()` iterates every connection and filters by user; 25s `: ping` comments; `X-Accel-Buffering: no` and `no-transform` for Cloudflare; per-minute sweep closes revoked sessions. No Web Push.
- Rate limiting: in-memory sliding window (`rateLimit()` in server-01-boot.js). Compression via `node:zlib` (skipped for SSE).
- Search: `LIKE '%term%'` queries on users and post bodies (server-03 lines ~350–365) — no FTS.
- Health: `/api/health` reports the commit; GitHub `after-deploy.yml` waits for it; a "Scientist" Railway service runs 8 read-only checks daily; Sentry for errors.

---

## 1. Historical Instagram stack (2010–2013): what they ran and why

### Takeaway
Early Instagram won by "keep it very simple, don't re-invent the wheel, use proven technology": one Django app, PostgreSQL (logically sharded, IDs minted inside Postgres), Redis + memcached, an async task queue for fan-out, S3/CloudFront for photos. Almost every idea except the multi-machine parts translates directly to a single SQLite box.

### Cited Findings
- **[historical, 2011]** Stated principles when choosing systems: keep it very simple, don't re-invent the wheel, go with proven and solid technologies. — [What Powers Instagram (Instagram Engineering)](https://instagram-engineering.com/what-powers-instagram-hundreds-of-instances-dozens-of-technologies-adf2e22da2ad)
- **[historical, 2011]** Stack: Ubuntu 11.04 on EC2; Amazon ELB in front of 3 nginx instances; PostgreSQL on 12 Quadruple-Extra-Large memory instances (users, photo metadata, tags); 6 memcached instances; several TB of photos on Amazon S3; Apache Solr for the geo-search API. — [What Powers Instagram](https://instagram-engineering.com/what-powers-instagram-hundreds-of-instances-dozens-of-technologies-adf2e22da2ad); [HighScalability summary](https://highscalability.com/instagram-architecture-14-million-users-terabytes-of-photos/)
- **[historical, 2011–12]** Redis on multiple instances in master–replica; Gearman used for async work — sharing photos to Twitter/Facebook, notifying real-time subscribers, and **feed fan-out**; ~200 Python workers consumed the Gearman queue; fan-out was async "so posting was as responsive for a new user as for a user with many followers". pyapns delivered >1 billion push notifications; Munin graphed custom metrics (signups/min, photos/sec). — [HighScalability](https://highscalability.com/instagram-architecture-14-million-users-terabytes-of-photos/)
- **[historical]** Launched Oct 2010 on a single PostgreSQL server on EC2; ~10M+ users by Sept 2011 with ~2.5 engineers (secondary source). — [DBEng substack (secondary)](https://haiderzdbre.substack.com/p/how-instagram-sharded-postgresql-with-2-engineers); 14M users with 3 engineers — [Engineer's Codex (secondary)](https://read.engineerscodex.com/p/how-instagram-scaled-to-14-million)
- **[historical, 2012] Sharding & IDs:** thousands of *logical* shards mapped onto few physical Postgres servers (as Postgres schemas), so shards could later be moved to new machines without re-bucketing. IDs: 64-bit = **41 bits ms since custom epoch + 13 bits logical shard ID (0–8191) + 10 bits per-shard sequence mod 1024**, generated by a PL/pgSQL function inside Postgres. Requirements: time-sortable (sort a list of IDs without fetching rows), 64-bit (smaller indexes, compact in Redis), "as few new moving parts as possible". — [Sharding & IDs at Instagram](https://instagram-engineering.com/1cf5a71e5a5c); [HN discussion](https://news.ycombinator.com/item?id=3058327)
- **[historical]** Insight behind sharding by user: almost every query is keyed by user, so one user → one shard (secondary). — [DBEng substack](https://haiderzdbre.substack.com/p/how-instagram-sharded-postgresql-with-2-engineers)

### Inferences
- The time-sortable ID trick is the single most portable idea: TNL Labs currently uses `INTEGER PRIMARY KEY AUTOINCREMENT`, which is already monotonic on one box. A Snowflake-style ID only becomes necessary if TNL ever writes from more than one database (sharding, multi-region, offline client-created IDs). Not needed now; worth designing so that IDs are never assumed to be small/dense (e.g., never use `id` as an array index).
- Instagram's "logical shards ≫ physical servers" pattern maps onto SQLite as "one file per tenant/shard, many files per box" — only relevant at the ~1M stage (see §7).
- The 2011 split (sync request → enqueue fan-out/notifications/email/push → workers) is the pattern TNL should copy inside one process with a SQLite-backed job table (§6).

### Gaps
- Could not retrieve the original "Storing hundreds of millions of simple key-value pairs in Redis" and pgbouncer/"Handling growth with Postgres" posts this session; details of pgbouncer usage and Celery/RabbitMQ (which replaced Gearman per later talks) are from memory and not cited here.
- Mike Krieger talk content (e.g., "Scaling Instagram", AirBnB tech talk 2012) not fetched.

---

## 2. Later Instagram (2013 – 2026): FB data centers, Cassandra/Rocksandra, TAO, Python at scale, media, feed, DMs, search, shipping

### Takeaway
After the Facebook acquisition Instagram moved into FB data centers (2013–14), added Cassandra (later with a RocksDB engine), TAO, Unicorn search, MQTT/Iris-style messaging, aggressive Python runtime work (GC tuning, Cinder) and fully continuous deployment. Most of this exists to solve problems of billions of users and many data centers; the transferable lessons for TNL are: async processing, snapshot+delta realtime sync, encode-once-repackage-many for video, small-commit continuous deploy with fast rollback.

### Cited Findings
- **[historical, 2013–14] Move to Facebook infra:** migration from AWS into FB data centers began April 2013; ~11 months preparation, data move over ~1 month, including ~20bn photos. — [DatacenterDynamics](https://www.datacenterdynamics.com/content-tracks/servers-storage/facebook-ditches-aws-to-bring-instagram-data-in-house/87619.fullarticle); [Data Center Knowledge](https://www.datacenterknowledge.com/cloud/instagram-migrates-from-amazon-s-cloud-into-facebook-data-centers); [Migrating From AWS to FB (Instagram Eng.)](https://instagram-engineering.com/migrating-from-aws-to-fb-86b16f6766e2)
- After the move Instagram used FB's TAO (distributed social-graph store) plus PostgreSQL and Cassandra; multi-region work gave "data locality" in stateful services Cassandra and TAO (secondary summaries). — [ByteByteGo](https://blog.bytebytego.com/p/how-instagram-scaled-its-infrastructure); [InfoQ: Instagram across continents (2018)](https://www.infoq.com/news/2018/11/instagram-across-continents/). Original "Instagration pt 2" post returned HTTP 503 when fetched: [link](https://instagram-engineering.com/instagration-pt-2-scaling-our-infrastructure-to-multiple-data-centers-5745cbad7834)
- **[historical, 2018] Rocksandra:** Cassandra used extensively for key-value storage; JVM GC caused P99 read latency of 25–60ms and GC stalls up to 2.5% at peak. Replacing the storage engine with a RocksDB-based C++ engine cut P99 read latency from 60ms to 20ms and GC stalls from 2.5% to 0.3%; 3–4× P99 reduction generally, >10× in some use cases. — [Instagram Eng.: Open-sourcing a 10x reduction in Cassandra tail latency](https://instagram-engineering.com/open-sourcing-a-10x-reduction-in-apache-cassandra-tail-latency-d64f86b43589); [The New Stack](https://thenewstack.io/instagram-supercharges-cassandra-pluggable-rocksdb-storage-engine/); [CASSANDRA-13474](https://jira.apache.org/jira/browse/CASSANDRA-13474)
- **[historical, 2017] Python GC:** disabling CPython's GC gave ~10% more capacity (less copy-on-write of pre-forked worker memory, better LLC hit ratio); gains eroded as code grew, leading to a follow-up "copy-on-write friendly" GC change (`gc.freeze` upstreamed). — [Dismissing Python Garbage Collection at Instagram](https://instagram-engineering.com/dismissing-python-garbage-collection-at-instagram-4dca40b29172); [Copy-on-write friendly Python GC](https://instagram-engineering.com/copy-on-write-friendly-python-garbage-collection-ad6ed5233ddf)
- **Cinder:** Meta's performance CPython fork used by Instagram — immortal objects, shadow bytecode/inline caches, JIT, strict modules, Static Python (type-annotation-driven bytecode, up to 7× faster on some benchmarks), lazy imports, async optimisations. — [desdelinux summary](https://blog.desdelinux.net/en/facebook-released-the-cinder-source-code-which-is-used-by-instagram/); [Static Python paper, ECOOP 2022 (PDF)](https://bernsteinbear.com/assets/img/ecoop2022.pdf)
- **[historical, 2016→2019] Continuous deployment:** backend deployed 30–50 times/day on every commit to master, mostly without humans; principles: high-quality test suite, quick identification of bad commits (blast radius of 1–3 commits), visibility at each stage, working rollback; built by iterating the existing process rather than a big-bang switch. By 2019: "Releasing the World's Largest Python Site Every 7 Minutes". — [Continuous Deployment at Instagram](https://instagram-engineering.com/continuous-deployment-at-instagram-1e18548f01d1); [InfoQ](https://www.infoq.com/news/2016/04/continuous-deployment-instagram); [SREcon19 Asia talk](https://www.usenix.org/conference/srecon19asia/presentation/randall)
- **[historical, 2022] Video pipeline:** Instagram produces "minimum functionality" encodings (basic ABR + legacy progressive, H.264-class, play everywhere) and "advanced" encodings (newer codecs, higher quality) driven by watch time. In early 2021 >80% of video compute went to minimum-functionality encodings and capacity was projected to run out within 12 months. Fix: reuse the progressive encoding's frames and **repackage (transmux) them into an ABR-capable structure** instead of re-transcoding — 86.17s CPU to transcode a 23s clip to 720p vs 0.36s to repackage; −94% compute for basic ABR; +33% watch-time coverage of advanced encodings. — [Meta Engineering, Nov 2022](https://engineering.fb.com/2022/11/04/video-engineering/instagram-video-processing-encoding-reduction/)
- **Messaging:** FB's Iris service and sync protocol (2014): clients fetch a snapshot, then subscribe to deltas pushed over MQTT and apply them locally; cut non-media data by 40% and send errors ~20%. Instagram Direct on web was Instagram web's first major real-time feature and first main MQTT use (2022). — [Building mobile-first infrastructure for Messenger (2014)](https://engineering.fb.com/2014/10/09/production-engineering/building-mobile-first-infrastructure-for-messenger/); [Launching Instagram messaging on desktop (2022)](https://engineering.fb.com/2022/07/26/web/launching-instagram-messaging-on-desktop/)
- **[historical, 2015] Search:** Instagram moved all search from Elasticsearch into FB's **Unicorn** (social-graph-aware, trillions of docs) in early 2015. Model: a denormalised store of "documents" (users, hashtags, places, media) grouped into term sets combined with AND/OR/NOT, then ranked with social features (second-order connections). Search traffic +65% afterwards; +12% in people searching per session. — [Instagram Eng. search post](https://instagram-engineering.com/eeb34a936d3a)

### Inferences
- The Iris "snapshot + delta" model is exactly what TNL's SSE does today in miniature; the missing piece is a **cursor**: SSE `id:` lines plus `Last-Event-ID` replay from a SQLite `events` table so a reconnecting client gets missed deltas instead of a full refetch (§5).
- The 2022 video lesson for TNL: don't transcode what you can **remux**. If the uploaded MP4 is already H.264/AAC, `ffmpeg -c copy` into HLS segments costs almost nothing; transcode only when the codec is unplayable or the bitrate is huge (§4).
- Continuous deployment at TNL already exists in spirit (merge to main → Railway in ~80s, after-deploy checks). The Instagram ingredients still missing: feature flags/dark launch (TNL has Admin → Settings switches, which are the cheap version), and one-click rollback (Railway supports redeploying a previous deployment).

### Gaps
- No primary source fetched on Instagram's current feed-ranking architecture (2020s ML ranking, "fan-out on read" vs write) beyond the 2012 Gearman fan-out-on-write fact. Treat claims of a later shift to ranked pull-based feeds as unverified here.
- No primary source fetched on Instagram's image format choices (e.g., AVIF/HEIC adoption), upload resumability ("segmented/resumable uploads") or push-notification infra post-2012.
- Nothing found about Instagram infrastructure changes specifically in 2025–2026.

---

## 3. SQLite at scale: settings, limits, examples, backups and replication

### Takeaway
A single SQLite file in WAL mode on local SSD comfortably serves sites far larger than TNL Labs today (sqlite.org guidance: <100K hits/day is conservative; 10× has been shown). The real limits are one writer at a time and one machine. TNL already has WAL + synchronous=NORMAL + VACUUM INTO; the cheap wins are `busy_timeout`, `PRAGMA optimize`, FTS5 for search, and getting backups off the volume. Note: `node:sqlite` is **synchronous**, so every long query (including `VACUUM INTO`) blocks the whole event loop.

### Cited Findings
- SQLite site guidance: fine for sites with <100K hits/day (conservative; 10× demonstrated). sqlite.org itself (2015) served 400–500K requests/day, 15–20% dynamic, ~200 SQL statements per dynamic page, on a shared VM at load average <0.1. Use client/server instead when write-intensive or needing multiple servers; unlimited readers but **one writer at any instant**; max DB 281 TB, consider client/server approaching TB range. — [sqlite.org: Appropriate Uses](https://www.sqlite.org/whentouse.html)
- **Expensify** runs on SQLite wrapped in its own distributed transaction layer **Bedrock** (open source) and reached 4M queries/sec on one server (192 physical cores, 3TB NVMe) — with modifications, not stock SQLite. — [Expensify: Scaling SQLite to 4M QPS on a single server](https://use.expensify.com/blog/scaling-sqlite-to-4m-qps-on-a-single-server)
- **Rails 8 (Nov 2024)** made SQLite a production default path: Solid Queue (jobs, uses `FOR UPDATE SKIP LOCKED` on PG/MySQL, works with SQLite), Solid Cache (disk-backed cache instead of Redis RAM), Solid Cable (pub/sub via fast polling of a DB table) — i.e., queue, cache and pub/sub all in SQLite, no Redis. — [Rails 8: No PaaS Required](https://rubyonrails.org/2024/11/7/rails-8-no-paas-required); [AppSignal](https://blog.appsignal.com/2024/10/07/whats-new-in-ruby-on-rails-8.html); [DevClass](https://devclass.com/2024/10/09/ruby-on-rails-8-0-first-beta-release-a-big-bet-on-sqlite-in-production/)
- **`node:sqlite` capabilities (Node docs, current v26.10.0; module is Stability 1.2 Release Candidate since v25.7; `--experimental-sqlite` flag no longer required from v23.4/v22.13):**
  - `DatabaseSync` option `timeout` (busy timeout, ms, default 0) — added v24.0.0 / v22.18.0.
  - `sqlite.backup(sourceDb, path)` — online backup API, added v23.8.0 / v22.16.0.
  - Sessions/changesets: `db.createSession()`, `session.changeset()/patchset()`, `db.applyChangeset()` — added v23.3.0 / v22.12.0.
  - `StatementSync.iterate()` — v23.4.0 / v22.13.0.
  — [Node.js sqlite docs](https://nodejs.org/api/sqlite.html)
- **VACUUM INTO** produces a consistent, compacted copy at a point in time without blocking other writers and is a recommended way to snapshot a DB before shipping it with any backup tool. — [DevClass on sqlite3_rsync / backups](https://devclass.com/2024/10/02/the-sqlite-team-is-preparing-an-efficient-remote-replication-tool/) (and summary snippets in search results)
- **sqlite3_rsync** (SQLite team, 2024): efficient remote replication of a live database (transfers only changed pages), suited to read replicas that may be slightly stale. — [DevClass](https://devclass.com/2024/10/02/the-sqlite-team-is-preparing-an-efficient-remote-replication-tool/)
- **Litestream (revamped, Fly.io):** sidecar process that takes over WAL checkpointing and continuously streams changes to S3-compatible storage; new LTX format (transaction-aware page ranges) enables compaction and efficient **point-in-time restore**; read replicas via a VFS that fetches pages from object storage; leases via S3 conditional writes (no Consul); can replicate many DBs (`/data/*.db`) from one process. — [Fly.io: Litestream Revamped](https://fly.io/blog/litestream-revamped/)

### Inferences (for TNL)
- **[no new dep] Now:** add `PRAGMA busy_timeout = 5000` (works on every Node version, unlike the `timeout` option which needs ≥22.18). TNL has one connection, so SQLITE_BUSY mostly arises from the backup or an admin tool opening a second connection — cheap insurance. Add `PRAGMA optimize` on a timer (SQLite recommends periodic runs) and consider `PRAGMA mmap_size` (e.g., 256MB) and a larger `cache_size` given the 768MB heap cap — measure first; mmap memory is outside the V8 heap but counts against the container.
- **Event-loop blocking:** `VACUUM INTO` and `DELETE … NOT IN (SELECT … LIMIT N)` trims run synchronously on the only thread. As the DB grows, a daily VACUUM INTO of a multi-GB file will freeze all requests and SSE for seconds. Options without deps: (a) run backups in a `worker_threads` Worker with its own read connection (WAL allows a concurrent reader); (b) use `sqlite.backup()` (if Node ≥22.16), which copies in steps. Recommend pinning Node in `engines` to a version ≥22.18 so `timeout`, `backup()` and flagless sqlite are available.
- **Search [no new dep]:** FTS5 is compiled into the SQLite that ships with Node (assumption — verify with `CREATE VIRTUAL TABLE t USING fts5(x)` in a test). Replace `LIKE '%term%'` (full table scan) with an FTS5 external-content table over users and post bodies kept in sync by triggers; rank with `bm25()` and blend with rep/follow signals — a tiny Unicorn.
- **Feed indexes:** ensure composite indexes match the feed queries' WHERE + ORDER BY (e.g., `posts(channel, created_at DESC)`, `posts(author_id, created_at DESC)`, `follows(follower_id, followee_id)`), and paginate by keyset (`WHERE created_at < ? ORDER BY created_at DESC LIMIT 50`) rather than OFFSET. Verify with `EXPLAIN QUERY PLAN` in a test.
- **Writes:** a single process with one connection is already the "single-writer" pattern. Batch multi-row writes in one `BEGIN IMMEDIATE … COMMIT`; keep transactions short; never await I/O inside a transaction.
- **How far one file goes for TNL:** with ~200 statements/page sqlite.org ran ~500K req/day on a shared VM; TNL's workload (likes, comments, DMs) is more write-heavy, but WAL + NORMAL commits are typically sub-millisecond on SSD. One box plausibly carries TNL to the ~100K-member range if media is off the box and heavy jobs (video) are off the request path. This is an estimate, not a measured number — benchmark with the e2e harness plus a synthetic load script.
- **Backups:** current backups live on the same Railway volume as the DB — a volume loss loses both. Highest-priority change is an off-platform copy (needs object storage → **[new service]**). Interim **[no new dep]**: admin download already exists; could also email/pull a backup, but that isn't a real DR plan.
- **Litestream** = **[new dep + new service]** (Go binary sidecar + object storage); it gives continuous, point-in-time backups (RPO of seconds instead of 24h). The no-new-binary alternative is a periodic `VACUUM INTO` / `backup()` + upload to S3-compatible storage using a hand-rolled SigV4 PUT on `node:crypto` + `fetch` (SigV4 is ~60 lines; R2/B2/S3 all accept it) — **[new service, no new dep]**.
- **LiteFS** (Fly.io FUSE replication) assumes Fly's platform/FUSE and is not a fit for Railway; Turso/libSQL would be **[new service + new dep]** and only worth it for multi-region read replicas.

### Gaps
- Did not fetch sqlite.org pages on WAL/`busy_timeout`/`mmap` directly this session; settings above reflect standard SQLite documentation but are not individually cited here.
- No source fetched on Pieter Levels' SQLite usage or Basecamp ONCE specifics; no reliable numbers to report.
- Whether Railway's Node image's bundled SQLite includes FTS5 and which Node version Railway currently resolves for `>=22.5.0` was not verified.

---

## 4. Media: object storage, migration from the volume, content addressing, video, image formats

### Takeaway
Media is TNL's biggest single-box risk (not backed up, ties the app to one volume, blocks zero-downtime deploys). Cloudflare R2 is the natural target because Cloudflare is already in front and R2 has free egress; migration can be done incrementally because filenames are already hash-based and immutable. Video should be remuxed to HLS with the `ffmpeg-static` binary TNL already ships, in a background job.

### Cited Findings
- **Cloudflare R2 pricing (Standard):** $0.015/GB-month storage, Class A (writes/lists) $4.50/M, Class B (reads) $0.36/M, **egress free**; free tier 10 GB-month, 1M Class A, 10M Class B per month. Infrequent Access: $0.01/GB-month, $9/M Class A, $0.90/M Class B, $0.01/GB retrieval, 30-day minimum. — [Cloudflare R2 pricing docs](https://developers.cloudflare.com/r2/pricing/)
- **Railway volumes:** one volume per service; replicas cannot be used with volumes; Railway won't run two deployments mounting the same volume, so redeploys of a volume-backed service have a short downtime even with a healthcheck. Suggested alternatives: S3-compatible buckets, or a separate service owning the volume. `RAILWAY_DEPLOYMENT_DRAINING_SECONDS` gives the old deployment time to exit cleanly; `RAILWAY_DEPLOYMENT_OVERLAP_SECONDS` controls overlap (overlap can't apply with a volume). — [Railway volumes reference](https://docs.railway.com/volumes/reference); [Railway Station thread](https://station.railway.com/questions/zero-down-time-not-working-51bccfca); [Railway deployments reference](https://docs.railway.com/deployments/reference)
- **[historical, 2022]** Instagram's encode-once / repackage approach for ABR (see §2): transmuxing existing frames into an ABR structure cost 0.36s vs 86.17s CPU for a transcode. — [Meta Engineering](https://engineering.fb.com/2022/11/04/video-engineering/instagram-video-processing-encoding-reduction/)

### Inferences (for TNL)
- **Content-addressed names are already in place** (hash in filename, `immutable` cache header). That makes migration safe: an object's URL never changes meaning, so you can copy files to a bucket in the background and flip `/uploads/*` per file.
- **Migration path [new service: R2 or B2 or S3; no new dep]:**
  1. Write-through: after a successful upload to the volume, enqueue a job that PUTs the file to the bucket (SigV4 via `node:crypto`; R2 is S3-API compatible). Record `stored_remote=1` in an `uploads` table.
  2. Backfill: a low-priority job walks existing files (throttled) and uploads them. This alone closes the "media not backed up" gap.
  3. Serve: point `media.tnllabs.com` (R2 custom domain behind Cloudflare) at the bucket; app emits that host for files marked remote; `/uploads/*` keeps working as a fallback/redirect.
  4. Later: stop keeping originals on the volume once remote-verified (keep DB + backups only on the volume). This removes the volume as the reason redeploys have downtime only if the DB also moves — it won't (SQLite stays local), so expect the ~seconds-long redeploy gap to remain; draining (`RAILWAY_DEPLOYMENT_DRAINING_SECONDS`) plus SSE auto-reconnect makes it invisible-ish.
  - Cost sanity check (from R2 pricing): 100 GB of media ≈ $1.35/month storage after the 10 GB free tier; reads served through Cloudflare's cache mostly never hit R2 Class B; uploads count as Class A.
  - Direct-to-bucket uploads (presigned PUT URLs) take 650MB video bodies off the Node process — but then server-side magic-byte sniffing (`server-03` checks first 16 bytes) has to happen after the fact in a job. Security-sensitive: run `/security-review`.
- **Video [no new dep — ffmpeg-static already a dependency]:** in a background job, `ffprobe`-equivalent check via `ffmpeg -i`; if H.264/AAC (most phone uploads), `-c copy -f hls -hls_time 4 -hls_playlist_type vod` (remux only, Instagram-style cheap path); else transcode one 720p H.264 rendition. Add a second lower rendition + master playlist only when watch data justifies it. Safari plays HLS natively; Chrome/Firefox desktop need MSE + an HLS player (hls.js would be **[new dep]**), so the zero-dep option is to keep serving progressive MP4 with `faststart` (`-movflags +faststart`, again a remux) and Range requests (express.static supports them) — that gets most of the UX win. Caveat: `ffmpeg-static` binaries' codec set (libx264, libaom, libwebp) not verified here.
- **Images:** variants are made client-side via canvas today, which costs the server nothing. Browsers can encode WebP with `canvas.toBlob(…, 'image/webp')` in Chromium/Firefox; Safari's WebP/AVIF *encoding* support via canvas is not confirmed here — fall back to JPEG. Node core has **no** image codec, so server-side AVIF/WebP needs either `sharp` (**[new dep]**) or shelling out to the existing ffmpeg binary (zero new dep, but CPU heavy and unverified codec support). Recommendation: keep client-side resizing; add WebP output where the browser supports it; serve via `<picture>` with JPEG fallback.
- Upload resumability: for 650MB videos on phones, a chunked upload protocol (client sends 5–8MB chunks with an upload id + offset; server appends; resume on reconnect) is implementable with Express alone **[no new dep]**; tus is the standard protocol but its server libs are a **[new dep]**.

### Gaps
- Backblaze B2 and AWS S3 current (Oct 2026) prices not fetched; only R2 verified.
- Railway's own object storage ("Buckets") product details/pricing not verified this session — check `docs.railway.com` before choosing between Railway buckets and R2.
- `ffmpeg-static` codec list and binary version not verified.

---

## 5. Realtime: SSE on one box, fan-out, and Web Push for PWAs

### Takeaway
SSE on one Node process scales to thousands of concurrent connections; the per-browser 6-connection limit only bites on HTTP/1.1, and Cloudflare serves browsers over HTTP/2+. TNL's main SSE inefficiency is O(all connections) iteration in `sendTo()`, and the main missing feature is replay on reconnect. Web Push works for installed iOS PWAs since 16.4 and can be implemented with `node:crypto` only, but it's fiddly; a dependency (`web-push`) would be a much smaller effort.

### Cited Findings
- **SSE connection limit:** over HTTP/1, browsers cap SSE at **6 connections per browser+domain across all tabs** (Chrome/Firefox "Won't fix"); over HTTP/2 the limit is negotiated (default ~100 streams). — [MDN EventSource](https://developer.mozilla.org/en-US/docs/Web/API/EventSource)
- **[historical, 2014]** FB Iris snapshot+delta over MQTT: −40% non-media data, ~−20% send errors. — [Meta Engineering](https://engineering.fb.com/2014/10/09/production-engineering/building-mobile-first-infrastructure-for-messenger/)
- **Web Push on iOS/iPadOS:** supported for Home Screen web apps from **iOS 16.4**; uses standard Push API + Notifications API + Service Worker; permission must be requested in response to a direct user gesture; app must be installed (standalone). — [WebKit blog](https://webkit.org/blog/13878/web-push-for-web-apps-on-ios-and-ipados/); [Apple docs](https://developer.apple.com/documentation/usernotifications/sending-web-push-notifications-in-web-apps-and-browsers)
- VAPID: server holds a private key to sign (JWT, ES256) push requests; the browser gets the public key at subscribe time; keys must stay stable across restarts or existing subscriptions break. — [Apple docs](https://developer.apple.com/documentation/usernotifications/sending-web-push-notifications-in-web-apps-and-browsers); [Self-hosted push series (DEV)](https://dev.to/bunty9/-self-hosted-push-notifications-part-8-f0g)
- Rails 8's Solid Cable shows DB-backed pub/sub (polling a table) is an accepted production design for a single DB. — [AppSignal](https://blog.appsignal.com/2024/10/07/whats-new-in-ruby-on-rails-8.html)

### Inferences (for TNL)
- **[no new dep] Index the client map:** add `byUser: Map<userId, Set<res>>` so `sendTo()` is O(recipients) not O(all connections). `broadcast()` of every like/post to every member is the real fan-out cost at scale — narrow it (only to members viewing that lab, or coalesce into a "new activity" ping every few seconds).
- **[no new dep] Replay:** write deliverable events to an `events(id INTEGER PRIMARY KEY, user_id, type, json, created_at)` table (TTL ~24h); send `id:` on each SSE message; on reconnect read `Last-Event-ID` and replay. Note EventSource sends `Last-Event-ID` automatically on its own reconnect, but TNL's ticket scheme means each reconnect needs a fresh ticket — accept `?last=` too.
- **Back-pressure:** check `res.write()` return value; drop/close slow clients whose buffers grow (prevents a few bad mobile connections from bloating the 768MB heap).
- **Capacity:** each idle SSE connection costs a socket + small buffers; one Node process typically holds thousands. Railway/Cloudflare proxy timeouts are covered by the 25s ping. (No verified numbers for Railway's per-service connection cap were found.)
- **Web Push:** dependency-free is feasible with Node ≥ 18: VAPID JWT via `crypto.sign('sha256', …, {dsaEncoding:'ieee-p1363'})` with a P-256 key; payload encryption per RFC 8291 (`aes128gcm`, ECDH P-256 + HKDF via `crypto.hkdfSync` + AES-128-GCM) — ~150 lines, and it must be tested against real Chrome/Firefox/Safari endpoints. Alternatively send **payload-less pushes** (no encryption needed: the service worker fetches `/api/notifications` on push) — simplest no-dep path, VAPID JWT only. Store subscriptions in a `push_subscriptions` table; delete on 404/410. The VAPID private key is a secret → Railway Variables. The push services (FCM, Mozilla autopush, Apple) are third-party endpoints the browser chooses; they are not services TNL signs up for, but the owner should still approve because data leaves to them. `web-push` npm would be **[new dep]**.
- Send push only when the user has no live SSE connection (`isOnline()` already exists) to avoid double notifications — mirrors Instagram's in-app vs push split.

### Gaps
- Did not fetch RFC 8291/8292 text directly; the crypto outline above is from general knowledge and should be validated against the RFCs and web.dev's push guide before implementation.
- No source on Railway HTTP proxy limits for long-lived connections (max duration, idle timeout).

---

## 6. Observability, reliability, jobs and deploys on one box

### Takeaway
Instagram's reliability came from small deploys, fast bad-commit detection and rollback; TNL already has CI, post-deploy checks, Sentry and a daily "Scientist". The gaps are an in-process durable job queue (so email/push/video/backfill survive restarts), SLO-style metrics, persistent rate-limit state, and graceful shutdown for Railway's no-overlap volume deploys.

### Cited Findings
- **[historical]** Instagram CD principles: high-quality tests, quick bad-commit identification, visibility at each stage, rollback plan; 30–50 deploys/day. — [Instagram Eng.](https://instagram-engineering.com/continuous-deployment-at-instagram-1e18548f01d1)
- **[historical, 2012]** Instagram graphed business metrics (signups/min, photos/sec) with custom Munin plugins, and ran fan-out/notifications as async jobs. — [HighScalability](https://highscalability.com/instagram-architecture-14-million-users-terabytes-of-photos/)
- Rails 8 Solid Queue: DB-backed jobs with concurrency control, retries, recurring jobs. — [AppSignal](https://blog.appsignal.com/2024/10/07/whats-new-in-ruby-on-rails-8.html)
- Railway: volume-backed services can't overlap deployments (brief downtime); `RAILWAY_DEPLOYMENT_DRAINING_SECONDS` lets the old process finish. — [Railway volumes reference](https://docs.railway.com/volumes/reference); [Railway deployments reference](https://docs.railway.com/deployments/reference)

### Inferences (for TNL) — all **[no new dep]** unless marked
- **SQLite job queue:** `jobs(id, kind, payload_json, run_at, attempts, locked_until, last_error, done_at)`; claim with `UPDATE jobs SET locked_until=? WHERE id=(SELECT id FROM jobs WHERE done_at IS NULL AND run_at<=? AND (locked_until IS NULL OR locked_until<?) ORDER BY run_at LIMIT 1) RETURNING *` (SQLite ≥3.35 supports RETURNING); exponential backoff; idempotent handlers. Run CPU-heavy kinds (ffmpeg, backups, R2 backfill) in `child_process`/`worker_threads` so the event loop stays free. Existing `setInterval` loops (events tick, watch, social-meta) can become recurring jobs.
- **Graceful shutdown:** on SIGTERM stop accepting, end SSE streams with a `retry:` hint, finish in-flight jobs or release their locks, `PRAGMA wal_checkpoint(TRUNCATE)`, `db.close()`. Set `RAILWAY_DEPLOYMENT_DRAINING_SECONDS` (e.g., 15).
- **Health checks:** keep `/api/health` cheap (`SELECT 1`, report commit, disk free on `/app/data`, WAL size, job backlog, SSE count). Configure it as Railway's healthcheck path so a bad build never takes traffic.
- **Error budget/SLO:** pick two SLOs (e.g., 99.5% of API requests < 500ms and non-5xx over 28 days; feed p95 < 300ms). Log per-request duration into a ring table (`req_metrics`, trimmed) and show p50/p95/p99 + 5xx rate on the admin Today page; freeze feature work when the budget is spent (Google SRE practice — not cited this session).
- **Rate limiting:** current in-memory windows reset on every deploy and don't survive restarts; fine at one process. Move abuse-critical ones (login, register, forgot) to a SQLite table; add Cloudflare rate-limiting rules at the edge (**[new service config]** on an existing service — owner approval).
- **Event-loop lag monitor:** `perf_hooks.monitorEventLoopDelay()` → alert when p99 > 100ms; this is the early-warning for "one synchronous SQLite query/VACUUM froze everything".
- **Feature flags / dark launch:** extend the existing settings switches to per-user % rollout (hash(user_id) % 100 < pct), as Instagram/FB gatekeepers do.

### Gaps
- No verified source fetched on Railway healthcheck timeout defaults or on Sentry/Cloudflare pricing tiers.

---

## 7. Staged roadmap for TNL Labs

### Takeaway
Stay on one Node + one SQLite file far longer than intuition says; move **media** off the box first (it's the backup gap and the scaling bottleneck), then move **slow work** off the request path, then add **read replicas/sharding** only if write load proves it. Mirror Instagram's 2011 ordering: simple core, async queue, object storage + CDN, measure everything.

### Cited Findings
- SQLite comfortable at <100K hits/day, 10× demonstrated; switch when write-heavy or multi-server. — [sqlite.org](https://www.sqlite.org/whentouse.html)
- Instagram reached 14M users on a stack whose key elements were Postgres, memcached/Redis, an async job queue, S3+CDN. — [What Powers Instagram](https://instagram-engineering.com/what-powers-instagram-hundreds-of-instances-dozens-of-technologies-adf2e22da2ad)
- R2 egress free; $0.015/GB-month. — [Cloudflare R2 pricing](https://developers.cloudflare.com/r2/pricing/)
- Litestream gives continuous S3 replication + point-in-time restore. — [Fly.io](https://fly.io/blog/litestream-revamped/)

### Inferences — the roadmap (user counts are rough planning bands, not measured thresholds)

**Now (no new deps; days of work each)**
1. `PRAGMA busy_timeout=5000`, periodic `PRAGMA optimize`, test `mmap_size`; pin Node ≥22.18 in `engines` (enables `timeout`, `backup()`, flagless sqlite). [no new dep]
2. Move `VACUUM INTO` backups and log trims off the main thread (worker with its own connection). [no new dep]
3. SQLite `jobs` table + worker loop; move email, notification fan-out, ffmpeg audio extraction into it. [no new dep]
4. FTS5 search replacing `LIKE '%…%'`. [no new dep]
5. SSE: per-user index, `id:`/replay table, back-pressure checks. [no new dep]
6. Video: `-movflags +faststart` remux in a job (ffmpeg-static already present). [no new dep]
7. Graceful SIGTERM + `RAILWAY_DEPLOYMENT_DRAINING_SECONDS`; event-loop-lag + p95 metrics on admin. [no new dep]
8. **Top open item — off-platform backups of DB + media:** needs a bucket. **[new service: R2 (preferred, same vendor as existing Cloudflare) / B2 / S3 / Railway bucket]**, implementable with zero new npm deps (SigV4 on `node:crypto`). Ask the owner now.

**~10k users**
- Media served from R2 behind Cloudflare (`media.` subdomain), backfill done, write-through on upload. [new service]
- Continuous DB backup: Litestream sidecar **[new dep (binary) + new service]**, or 15-minute `backup()`→R2 uploads [no new dep] for RPO ≤15 min.
- Web Push (payload-less first) for DMs/collab invites when not online. [no new dep; push endpoints are browser vendors' — owner sign-off]
- Chunked/resumable uploads for video. [no new dep]
- Keyset pagination + verified indexes on every feed; denormalised counters (already doing rep).

**~100k users**
- Direct-to-R2 presigned uploads; server validates in a job. [uses existing new service]
- HLS for video (remux by default, transcode only when needed); hls.js would be **[new dep]** for non-Safari browsers, or keep progressive MP4.
- Split the process: web server + a separate Railway worker service for jobs/ffmpeg. Because only one service can mount the volume, the worker must reach the DB through the web service's API or the DB must move (see next) — this is the point where single-file SQLite starts to constrain topology.
- Feed: precomputed per-user feed table (fan-out on write via jobs, like Instagram 2011) only if feed reads measurably dominate; cap fan-out for very large accounts and merge their posts at read time (hybrid).
- Edge caching of anonymous pages (`/u/:name`, `/p/:id`) with short `s-maxage` at Cloudflare. [existing service]

**~1M users**
- Re-evaluate the database: options are (a) Postgres (**[new service]**, Railway-hosted) with Instagram-style logical sharding by user id and 64-bit time-sortable IDs; (b) SQLite per shard/tenant with libSQL/Turso replicas (**[new service + new dep]**); (c) stay single SQLite if writes are still < a few hundred/sec and p99 latency holds — measure first. Prerequisite either way: IDs that don't assume one database (adopt a 41/13/10-bit scheme early if (a) or (b) is likely).
- Dedicated realtime tier (SSE fan-out via pub/sub between web replicas — requires Redis/NATS **[new service]** or Postgres LISTEN/NOTIFY).
- Multi-region read replicas only if audience is genuinely global.

### Gaps
- No load test of TNL itself exists in this research; every user-count threshold above is a planning estimate. A synthetic benchmark (writes/sec of likes/DMs, feed p95 at N posts) on a Railway replica of production hardware would turn these into real numbers.
- Current production DB size, media volume size and daily request counts were not available (the Railway MCP could provide metrics; not queried to stay read-only and in scope).
