# TNL LABS — how this works

Written for whoever touches this next: a developer you hire, or you in six
months. It explains the decisions, not just the code — the code you can read.

---

## The one-paragraph version

A creative collective. People post work, collaborate, and sell. It's a
Node server, SQLite, and vanilla JS — no framework, no build step. You edit
a file, push it, Railway deploys it. That's the whole loop.

The point of the product is **collaboration**, and every technical decision
follows from that. If a change makes collaboration easier, it's probably
right. If it makes vanity metrics go up, be suspicious.

---

## Run it

```bash
npm install
npm run dev          # http://localhost:8787
npm test             # every test. run before you deploy.
```

No database to set up. SQLite creates itself.

---

## The files

```
src/server.js   every API route. Big, but flat and searchable.
src/db.js       schema, migrations, the rep engine, settings
src/pay.js      Stripe Connect
src/mail.js     Resend
public/index.html   the entire frontend, one file
public/studio.js    the beat maker
public/admin.html   the dashboard
test/           run `npm test`
```

**Yes, `index.html` is ~200KB and that's a real cost.** It was the right
call at the start — no build step means deploying from a phone works, and
that mattered when the founder had no computer. It's now the main thing
that would make a new developer wince. Splitting it is a reasonable first
project; don't let anyone tell you it *must* be React.

---

## Decisions that look wrong but aren't

**Rep can only be earned from other people's actions.**
Likes, shares, accepted collabs, completed sales. Never from posting,
listing, or logging in. Anything you can do alone is farmable, and a
farmable reputation system is worse than none — it runs on fake fuel and
the whole network degrades. If someone asks for "+5 rep per post", the
answer is no, and this is why.

**Commission is tiered by level (10% → 2%) and is NOT a setting.**
Depop takes 10% forever. Here it falls as the community vouches for you.
It's in code, not the dashboard, on purpose: a rate you can retune at 2am
isn't a promise.

**Free loops skip the payouts wall.**
Everything else requires connected Stripe before you can list. Free loops
don't — making a producer hand over bank details to give something away
would kill the exact behaviour the network wants. This is deliberate; don't
"fix" it.

**Sale rep requires a verified Stripe payment.**
Arrange-mode sales earn nothing. Two friends clicking buy/confirm is free
to fake; a real charge costs money to fake.

**The labs are members-only, everything else is public.**
Showroom, Market, profiles, comments, the Studio — all open to strangers.
That's the storefront. The labs are where people actually talk, and that's
not a marketing surface. Enforced server-side (`/api/feed` requires auth),
not by hiding tabs.

**Media streams to disk, never through memory.**
`/api/upload/stream` pipes the raw body to a file. The old base64-in-JSON
route held ~1.5GB in RAM for a 650MB video and would OOM the container.
Don't reintroduce base64 for large files.

---

## Things that will bite you

**Migrations run on every boot.** `cols` is read once at the top of
`db.js` — if you add two `ALTER TABLE` for the same column, the second one
crashes the server on *every* boot. This has happened. `npm test` catches
it.

**`node --check` only parses.** It cannot catch an undeclared variable,
which is exactly what blanked the screen once. `test/boot.test.mjs`
actually *executes* the frontend against a fake DOM. Use it.

**The service worker can serve a stale broken page.** Navigations are
network-first now, but if you ever cache the shell, one bad deploy lives on
someone's phone forever. Bump `CACHE` in `sw.js` when the shell changes.

**Email fails silently.** Resend returns 200 whether it delivers or bins
it. `/admin → HEALTH → Send test email` is the only honest check.

---

## When something breaks

1. **`/admin` → HEALTH.** Errors, backups, email test, disk. The app
   reports its own breakage now — you shouldn't be finding out from members.
2. **Railway deploy log.** The boot banner says what's actually on:
   ```
   │ data        /app/data        ← if this isn't /app/data, DATA IS TEMPORARY
   │ email       on
   │ payments    on
   ```
3. **The red crash screen** in the app names the error and the line, with a
   "Clear cache & reload" button.

---

## Backups — read this bit

The database **is** the business. Six years of relationships are in it.

- Automatic daily, keeps 7, in `/app/data/backups`
- `/admin → HEALTH → Back up now` for a manual one
- **Download one periodically.** A backup on the same volume as the
  database protects you from your own mistakes, not from losing the volume.
- Restore = replace `tnl.db` with the backup file and restart. That's it.

Backups are verified by `test/backup.test.mjs` — it restores one and checks
the data actually comes back, not just that a file exists.

---

## The dashboard

`/admin`, gated by `ADMIN_EMAIL`. Nine views. The one that matters is
**Confirmed Collabs** on Overview — it's first for a reason. Members and
posts are vanity; two people building together is the only number that
proves the model works.

**Settings** lets you change the landing copy, close signups, gate selling
behind rep, and skip email verification if mail breaks — all without a
deploy.

---

## The studio's categories

16 sample slots, because a producer's kit folder has 16 folders and seven
meant half of it landed in "other". An open hat is a different sound from a
closed one; a riser is not percussion.

`guessSlot()` in studio.js reads the filename so nobody sorts 40 files by
hand. It handles the traps: **"808 Mafia Kick" is a kick BY 808 Mafia**, not
an 808 — brand names get stripped before matching, or the next rule catches
the "808" and files it wrong. `test/studio-slots.test.mjs` has 45 real
filenames; if you touch the guesser, that's what tells you.

`SLOT_TRACK` routes each slot to where it belongs — an open hat lands on the
hat track, a melody on keys. Guessing right is the difference between a tool
and a form.

## The distribution promise

The Studio tells producers that reaching **Core** (L4, 280 rep) gets their
music distributed to Spotify/Apple, paid for by TNL.

This is a **promise with a real cost**, so it's a setting — `/admin →
SETTINGS → DISTRIBUTION`. Move the level, change the terms, or switch it
off, without a deploy.

Why Core and not something lower: distribution runs ~$20–80/yr per artist.
At Core there'll be two or three people. At Verified it'd be everyone, and
a promise you can't keep costs more trust than one you never made.

Why a level and not a judgement call: 280 rep is ~47 different people
backing your work, or 14 confirmed collabs. Every rep source requires
someone *else* to act — nobody talks their way into it, and nobody can
accuse you of favouritism.

## What I'd do next

1. **Split `index.html`.** It works, but it's the barrier to anyone else
   helping.
2. **Object storage for uploads** (Cloudflare R2 — free egress). The volume
   will fill up.
3. **Video transcoding.** Right now a 650MB upload means viewers download
   650MB. Fine at 17 members, not at 200.
4. **Push notifications.** Deliberately skipped — at this size a text from
   the founder works better.

None of these are urgent. The app is ahead of the community; the bottleneck
is people posting, not code.
