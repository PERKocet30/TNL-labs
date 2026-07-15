# TNL Labs — The App (full stack)

Separate labs and one market, connected by one social layer and one system — exactly the architecture: accounts, a live feed, likes, shares, two-sided collaborations, follows, rep-based progression, a working Beat Lab, and a frontend served by the same server. **One install, one command, no external database, no build step.**

## What's here

```
public/index.html Complete frontend — landing, labs, market, studio, profiles, auth (no build step)
src/server.js     Express API — auth, feed, posts, likes, shares, collabs, follows, SSE realtime
src/db.js         SQLite schema + the rep engine (award/revoke + audit log + level ladder)
src/seed.js       Optional demo network so the feed isn't empty on first run
client-api.js     Standalone client module if you later wire a React/Vite frontend instead
```

## Run it

Requires **Node 22.5+** (for built-in SQLite).

```bash
npm install          # express, cors, bcryptjs — all pure JS, no native builds
npm run seed         # optional: 5 demo users (password: labs1234) + starter posts
npm start            # open http://localhost:8787 — the whole app is there
```

Open it on your phone on the same WiFi: `http://<your-computer-ip>:8787`.

## Try the full loop (two browser windows)

1. Window A: register as `producer1`, go to Labs → #beats, build a loop, Publish.
2. Window B: register as `singer1`, open #beats — the loop is there. Tap ▶ to hear it. Hit 🔥 — producer1 just earned +6 rep, live.
3. Window A: on your post, hit **+ collab**, invite `singer1`.
4. Window B: an **accept collab ✓** button appears on the post. Accept — **both** accounts earn +20.
5. Tap either avatar: the passport shows rep, level, and the ladder filling in.

That's the whole flywheel — create → validate → collaborate → rise — running on a real backend.

## Verify without a frontend

```bash
# health
curl localhost:8787/api/health

# register (returns a token)
curl -s -X POST localhost:8787/api/auth/register \
  -H 'content-type: application/json' \
  -d '{"username":"tester","displayName":"Tester","email":"t@x.com","role":"Producer","password":"labs1234"}'

# use the token
TOKEN=... 
# post
curl -s -X POST localhost:8787/api/posts -H "authorization: Bearer $TOKEN" \
  -H 'content-type: application/json' -d '{"channel":"beats","body":"first post"}'
# read the feed
curl -s localhost:8787/api/feed?channel=beats
```

## The rep model (why it's honest)

Rep is never created by posting. It is created only when **other people validate your work**, and every point is written to an append-only `rep_events` table, so the whole ladder is auditable and recomputable.

| Action | Who earns | Amount |
| --- | --- | --- |
| Your post gets liked | the author | +6 |
| Your post gets reshared | the original author | +3 |
| A collab invite is **accepted** | both people | +20 each |
| Founder/mod feature | the featured user | +40 |

Levels: Entry (0) · Verified (40) · Collaborator (120) · Core (280) · Leadership (560).

Because reactions and accepted collabs drive rep, volume alone gets you nowhere — which is exactly the "growth from real contribution, not empty performance" rule from the business model.

## The collaboration loop

Collab is two-sided on purpose. The author invites a user to a post; the invite sits `pending` until **that user accepts**. Only on acceptance does rep flow — to both of them. That prevents one person from farming rep by tagging others, and it makes every logged collaboration a real, consented one. This is the cross-lab engine in data form.

## Realtime

`GET /api/stream` is a Server-Sent Events channel. The client's `onFeedEvent()` subscribes and receives `post`, `like`, `collab-invite`, and `collab-accepted` events as they happen, so open feeds update live without polling.

## Wiring it to the app

1. Copy `client-api.js` into your React project (e.g. `client/src/lib/api.js`).
2. Set `VITE_API_URL` if the backend isn't on `localhost:8787`.
3. Replace the app's local-storage reads/writes with `api.*` calls:
   - onboarding form → `api.register(...)`
   - posting in a channel → `api.post({ channel, body })`
   - the 🔥 button → `api.like(postId)`
   - a new **Share** button → `api.share(postId, { channel })`
   - a new **Collab** action → `api.invite(postId, username)` / `api.acceptCollab(postId)`
   - profile view → `api.profile(username)` and `api.follow(username)`
4. Call `onFeedEvent(...)` once where the feed mounts to get live updates.

## Endpoint reference

```
POST /api/auth/register        {username, displayName, email, role, password} -> {token, user}
POST /api/auth/login           {username, password} -> {token, user}
POST /api/auth/logout          (auth)
GET  /api/me                   (auth) -> {user}

GET  /api/feed[?channel=]      -> {posts}          (viewer-aware likedByMe if token sent)
GET  /api/feed/following       (auth) -> {posts}
POST /api/posts                (auth) {channel, body, beat?, imageUrl?} -> {post}
POST /api/posts/:id/like       (auth) -> {liked}   (toggles; awards/revokes author rep)
POST /api/posts/:id/share      (auth) {channel?, comment?} -> {post}  (awards original author)
POST /api/posts/:id/collab     (auth) {username}   (author invites)
POST /api/posts/:id/collab/accept (auth)           (invitee accepts; both earn rep)

POST /api/users/:username/follow (auth) -> {following}
GET  /api/users/:username      -> {user, followers, youFollow, posts}

GET  /api/levels               -> {levels}
GET  /api/stream               Server-Sent Events: post | like | collab-invite | collab-accepted
```

## Production notes (before real users)

- **Sessions** are opaque tokens in a table — fine to start; swap for signed JWTs or httpOnly cookies when you deploy.
- **SQLite** is genuinely enough for a launch and thousands of users. When you outgrow it, the schema in `db.js` maps 1:1 to Postgres — move the table definitions over and point the queries at it (or migrate to Supabase, which gives you auth + realtime + row-level security out of the box).
- Add rate limiting and input length caps before opening registration publicly.
- The rep-event log means you can always **recompute** everyone's rep from scratch if rules change — `SELECT user_id, SUM(amount) FROM rep_events GROUP BY user_id`.
