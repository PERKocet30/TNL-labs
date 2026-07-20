# Railway setup — running checklist

Everything TNL LABS needs, in the order that matters. The **values** are
secret; they live in Railway's Variables tab and never in this repo.

---

## 1. DATA — do this first or you lose everything

Without a volume, Railway wipes the filesystem on every redeploy. Accounts,
posts, images, beats — gone.

**Volume:** Settings → Volumes → mount path `/app/data`

| Variable | Value |
| --- | --- |
| `TNL_DATA` | `/app/data` |

Puts the database *and* uploads on the persistent disk.

**Verify:** the deploy log must say

```
[db] using /app/data/tnl.db
```

If it says anything else, your data is temporary. Stop and fix it.

---

## 2. YOUR ADMIN ACCOUNT

| Variable | Value |
| --- | --- |
| `ADMIN_EMAIL` | `Jorgemfuentes001@gmail.com` |

Promotes that account to admin automatically — on boot, or the moment it
registers. Case-insensitive.

Deliberately not a hardcoded password: a password in the source is a
password in your GitHub repo, and anyone reading it owns your admin.

**Verify:** log says `@tnllabs promoted to admin (ADMIN_EMAIL)`, and your
passport shows an **Admin dashboard** link. Or go straight to `/admin`.

---

## 3. PUBLIC URL

| Variable | Value |
| --- | --- |
| `PUBLIC_URL` | `https://tnl-labs.up.railway.app` |

Builds verification links, password resets, Stripe redirects and public
portfolio links. Wrong value = broken emails. Update it the day you point a
real domain at this.

---

## 4. EMAIL — before you invite anyone but yourself

Sign up at **resend.com** (free, 3,000/month) → API Keys → create.

| Variable | Value |
| --- | --- |
| `RESEND_API_KEY` | `re_xxxxxxxx` |
| `MAIL_FROM` | `TNL LABS <onboarding@resend.dev>` |

`onboarding@resend.dev` is Resend's test sender — works with no domain
setup, but **only delivers to the address you signed up to Resend with**.
Fine for testing on yourself, useless for your artists.

To email anyone else: verify `tnllabs.com` in Resend (they hand you DNS
records), then switch to `MAIL_FROM=TNL LABS <noreply@tnllabs.com>`.

**Without this the app still works** — it shows the verification link on
screen rather than pretending it sent mail.

---

## 5. STRIPE — before any real sale

**Test keys first.** Never point live keys at something you haven't bought
from yourself.

| Variable | Value |
| --- | --- |
| `STRIPE_SECRET_KEY` | `sk_test_xxxxx` |

Swap to `sk_live_…` once you've run a full purchase through.

Commission is **not** an env var — it's set by the seller's level in code
(10% at Entry → 2% at Leadership, see `FEE_BY_LEVEL` in `db.js`).

**Test flow:** Market → Sell → Connect Stripe → onboard → buy your own
listing from a second account with card `4242 4242 4242 4242`, any future
expiry, any CVC.

---

## Deploying — all 6 files together

The frontend and backend are one change, not six. `index.html` calls
endpoints that only exist in the newer `server.js`; deploy one without the
other and things fail in confusing ways (this is what broke image upload).

```
public/index.html      the app
public/studio.js       the beat maker
public/admin.html      your dashboard
src/server.js          the API
src/db.js              schema + rep engine (migrates itself on boot)
src/pay.js             Stripe Connect
```

Also in public/: `sw.js`, `manifest.webmanifest`, `icon.svg` (PWA).

## The whole list, to paste in

```
TNL_DATA=/app/data
ADMIN_EMAIL=Jorgemfuentes001@gmail.com
PUBLIC_URL=https://tnl-labs.up.railway.app
RESEND_API_KEY=re_xxxxxxxx
MAIL_FROM=TNL LABS <onboarding@resend.dev>
STRIPE_SECRET_KEY=sk_test_xxxxx
```

## Delete if present

```
PLATFORM_FEE_PCT     ← dead. Replaced by per-level rates.
```

---

## Priority

1. **`TNL_DATA` + the volume** — everything else is pointless if data vanishes
2. **`ADMIN_EMAIL`** — so you can see what's actually happening
3. **`PUBLIC_URL`** — so links work
4. **Resend** — before anyone but you signs up
5. **Stripe** — before anyone sells anything real

## Health check after every deploy

The boot log now prints exactly what's on. Look for this block:

```
┌─ TNL LABS ─────────────────────────────────
│ listening   :8080
│ data        /app/data
│ public url  https://tnl-labs.up.railway.app
│ email       on
│ payments    on
│ admin       @tnllabs
│ in the lab  7 members · 24 posts · 3 confirmed collabs
└────────────────────────────────────────────
```

Anything with a ⚠ next to it is not configured. If `data` shows a path
that isn't `/app/data`, **stop** — your database is temporary.

### Noise you can ignore

These always appear and are not errors:

- `npm warn config production Use --omit=dev instead`
- `ExperimentalWarning: SQLite is an experimental feature` — we use Node's
  built-in SQLite on purpose; this is just Node being loud about it.

`Removed` / `Stopping Container` on an old deployment is normal — that's the
previous version being retired after a new one takes over.
