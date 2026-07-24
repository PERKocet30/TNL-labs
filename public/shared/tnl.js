/* ================================================================
   TNL LABS — the shared file.            repo path: public/shared/tnl.js

   One file. Both runtimes. No build step.

     server   import { LEVELS, ERR, ok, fail, wire } from "../public/shared/tnl.js";
     browser  <script type="module">
                import * as TNL from "/shared/tnl.js";
                TNL.configure({ getToken: () => TOKEN });
                Object.assign(window, TNL);
              </script>
              <script src="/studio.js"></script>
              <script> ...existing inline app... </script>

   It ships as a static file out of public/, so it is already served and
   already deployed. Node 22 loads it as ESM; every phone browser loads it
   as a module. Nothing is compiled.

   THE RULE: keys travel, labels live here. If a word reaches a screen, it
   is defined in this file and nowhere else. Retyping any constant below
   somewhere else in the codebase is the bug this file exists to prevent —
   it is how /api/tracks came to be called by a frontend against a server
   that had renamed it to beats, samples and library.

   ISOMORPHIC CONSTRAINT: nothing in here may touch `window`,
   `localStorage`, `import.meta.env`, or `node:*`. That constraint is why
   client-api.js at the repo root cannot be the shared file — it reads
   import.meta.env and localStorage at module scope, so Node cannot load
   it. Configuration is injected via configure() instead.
================================================================ */

/* ------------------------------------------------------------------
   1. THE LADDER
   Replaces: db.js:744 LEVELS · db.js:751 levelFor · db.js:763 FEE_BY_LEVEL
             index.html:1142 LEVELS · :1268 levelFor · :3019 fee literal
             admin.html:612,614 level names typed as text
------------------------------------------------------------------ */
export const LEVELS = [
  { id: 1, name: "Entry",        at: 0   },
  { id: 2, name: "Verified",     at: 40  },
  { id: 3, name: "Collaborator", at: 120 },
  { id: 4, name: "Core",         at: 280 },
  { id: 5, name: "Leadership",   at: 560 },
];

export const levelFor  = (rep) => LEVELS.reduce((a, l) => (rep >= l.at ? l : a), LEVELS[0]);
export const nextLevel = (rep) => LEVELS.find((l) => l.at > rep) || null;

/* Commission by level. Depop takes 10% forever; here it falls as the
   community vouches for you. Deliberately in code, not settings — a rate
   you can retune at 2am isn't a promise. Which is exactly why it must not
   also exist as a hand-typed literal in the marketing ladder. */
export const FEE_BY_LEVEL = { 1: 10, 2: 8, 3: 6, 4: 4, 5: 2 };
export const feeForRep = (rep) => FEE_BY_LEVEL[levelFor(rep).id] ?? 10;
export const feeLadder = () =>
  LEVELS.map((l) => ({ level: l.id, name: l.name, at: l.at, fee: FEE_BY_LEVEL[l.id] }));

/* ------------------------------------------------------------------
   2. NOTIFICATIONS
   The server emits 20 kinds. index.html:1878 translated 7 and fell
   through to `||n.kind`, so members read "order_complete" and
   "offer_declined" in their own feed — the commerce moments, where the
   product should sound most human.

   Voice: second person, present tense, no full stop. It is a feed row.
------------------------------------------------------------------ */
export const NOTIF_COPY = {
  like:           "liked your work",
  listing_like:   "saved your listing",
  comment:        "commented",
  share:          "shared your work",
  follow:         "followed you",
  dm:             "messaged you",
  pin:            "pinned your work",
  collab_invite:  "wants to collab",
  collab_accept:  "accepted your collab",
  sound:          "used your sound",
  download:       "downloaded your loop",
  offer:          "made an offer",
  offer_accepted: "accepted your offer",
  offer_declined: "passed on your offer",
  sale:           "bought your listing",
  shipped:        "shipped your order",
  order_complete: "confirmed delivery",
  review:         "left you a review",
  feature:        "featured your work",
  removed:        "removed your post",
};
export const NOTIF_KINDS = Object.keys(NOTIF_COPY);
export const notifLine = (kind) => NOTIF_COPY[kind] || "did something";

/* ------------------------------------------------------------------
   3. ERRORS
   Was: 109 distinct strings in server.js, 56 frontend sites doing
   `catch(e){ toast(e.message) }`. Four voices — "no", "gone", "empty"
   sitting beside full sentences. Six phrasings of one auth failure.

   Codes are stable and switchable. The message is the product's voice
   and lives here, once.

     server:  return fail(res, ERR.NOT_YOURS);
     client:  catch (e) { toast(e.message) }   // already correct copy
              if (e.code === "NEEDS_VERIFY") openVerifySheet();
------------------------------------------------------------------ */
const E = (code, status, message) => ({ code, status, message });

export const ERR = {
  /* auth + identity */
  NO_TOKEN:         E("NO_TOKEN",         401, "You'll need to sign in first."),
  BAD_TOKEN:        E("BAD_TOKEN",        401, "That link's expired — request a new one."),
  WRONG_PASSWORD:   E("WRONG_PASSWORD",   401, "That password doesn't match."),
  PASSWORD_SHORT:   E("PASSWORD_SHORT",   400, "Passwords need to be a bit longer."),
  NEEDS_VERIFY:     E("NEEDS_VERIFY",     403, "Verify your email first — check your inbox."),
  SUSPENDED:        E("SUSPENDED",        403, "This account is suspended."),
  ADMIN_ONLY:       E("ADMIN_ONLY",       403, "Admins only."),
  INVITE_ONLY:      E("INVITE_ONLY",      403, "TNL LABS is invite-only right now."),
  USERNAME_TAKEN:   E("USERNAME_TAKEN",   409, "That username's taken."),
  EMAIL_TAKEN:      E("EMAIL_TAKEN",      409, "That email's already registered."),
  BAD_USERNAME:     E("BAD_USERNAME",     400, "Letters, numbers and underscores only."),
  BAD_EMAIL:        E("BAD_EMAIL",        400, "That doesn't look like an email address."),
  NAME_REQUIRED:    E("NAME_REQUIRED",    400, "You'll need a display name."),

  /* the six "not your post / listing / order / board / sale" → one */
  NOT_YOURS:        E("NOT_YOURS",        403, "That's not yours to change."),
  /* the six "no post / no listing / no comment / gone / not found" → one */
  NOT_FOUND:        E("NOT_FOUND",        404, "That's gone."),
  PRIVATE:          E("PRIVATE",          403, "That's private."),

  /* self-directed actions — one shape, one voice */
  SELF_FOLLOW:      E("SELF_FOLLOW",      400, "You can't follow yourself."),
  SELF_COLLAB:      E("SELF_COLLAB",      400, "You can't collab with yourself."),
  SELF_DM:          E("SELF_DM",          400, "You can't message yourself."),
  SELF_BLOCK:       E("SELF_BLOCK",       400, "You can't block yourself."),
  SELF_BUY:         E("SELF_BUY",         400, "You can't buy your own listing."),
  SELF_OFFER:       E("SELF_OFFER",       400, "You can't make an offer on your own listing."),

  /* content */
  EMPTY:            E("EMPTY",            400, "Say something first."),
  TOO_LONG:         E("TOO_LONG",         400, "That's too long."),
  TITLE_REQUIRED:   E("TITLE_REQUIRED",   400, "Give it a title."),
  NEEDS_MEDIA:      E("NEEDS_MEDIA",      400, "Add at least one photo."),
  WORK_NEEDS_MEDIA: E("WORK_NEEDS_MEDIA", 400, "Only work with media can go on your portfolio."),
  BAD_LINK:         E("BAD_LINK",         400, "That doesn't look like a real link."),
  LINK_BLOCKED:     E("LINK_BLOCKED",     422, "Instagram blocks this one."),

  /* uploads */
  FILE_TOO_BIG:     E("FILE_TOO_BIG",     413, "That file's too big — 25MB for video, 8MB for images."),
  AVATAR_TOO_BIG:   E("AVATAR_TOO_BIG",   413, "Avatars max out at 4MB."),
  BAD_FILE_TYPE:    E("BAD_FILE_TYPE",    422, "That file type isn't supported."),
  USE_STREAM:       E("USE_STREAM",       413, "Too big for this route — use the streaming upload."),
  NO_FILE:          E("NO_FILE",          400, "Upload the file first."),
  LIBRARY_FULL:     E("LIBRARY_FULL",     409, "200 sounds max — delete some first."),

  /* market */
  MARKET_CLOSED:    E("MARKET_CLOSED",    403, "The market's closed right now."),
  PAYMENTS_OFF:     E("PAYMENTS_OFF",     503, "Payments aren't switched on yet."),
  SELLER_NOT_READY: E("SELLER_NOT_READY", 409, "This seller hasn't finished setting up payments yet. We've let them know — check back shortly."),
  NOT_CONNECTED:    E("NOT_CONNECTED",    402, "Connect payouts before you list."),
  ALREADY_SOLD:     E("ALREADY_SOLD",     409, "Someone got there first."),
  PRICE_TOO_LOW:    E("PRICE_TOO_LOW",    400, "Either free, or at least $1."),
  PRICE_TOO_HIGH:   E("PRICE_TOO_HIGH",   400, "That's above the price ceiling."),
  OFFER_TOO_LOW:    E("OFFER_TOO_LOW",    400, "That offer's too low."),
  OFFER_TOO_HIGH:   E("OFFER_TOO_HIGH",   400, "That's above asking — just buy it."),
  OFFERS_CLOSED:    E("OFFERS_CLOSED",    403, "This seller isn't taking offers."),
  ALREADY_REVIEWED: E("ALREADY_REVIEWED", 409, "You've already reviewed this."),
  BAD_RATING:       E("BAD_RATING",       400, "Ratings run 1 to 5."),
  NEEDS_DELIVERY:   E("NEEDS_DELIVERY",   409, "Confirm delivery first."),
  BUY_FIRST:        E("BUY_FIRST",        403, "Buy it first."),
  BAD_ADDRESS:      E("BAD_ADDRESS",      400, "That address doesn't look complete."),

  /* us, not them */
  SERVER:           E("SERVER",           500, "Something broke on our end. It's been logged."),
  UPSTREAM:         E("UPSTREAM",         502, "That service isn't answering. Try again shortly."),
  RATE_LIMITED:     E("RATE_LIMITED",     429, "Slow down a second."),
};

export const errByCode = (code) =>
  Object.values(ERR).find((e) => e.code === code) || ERR.SERVER;

/* ------------------------------------------------------------------
   4. THE ENVELOPE
   Was: 140 res.json() calls, 52 shaped {ok:true,...} and 88 bare. Errors
   were a bare string, so there was no code to switch on — which is why
   the frontend printed the server's internal wording verbatim.

   `error` is kept as a plain string alongside the object for one
   release, so nothing that reads e.message breaks during the migration.
------------------------------------------------------------------ */
export const ok = (res, data = {}) => res.json({ ok: true, ...data });

export const fail = (res, err = ERR.SERVER, extra = {}) =>
  res.status(err.status).json({
    ok: false,
    error: err.message,                                   // legacy: keep one release
    err: { code: err.code, message: err.message, ...extra },
  });

/* ------------------------------------------------------------------
   5. THE WIRE FORMAT
   SQL is snake_case, JSON is camelCase, and today some handlers return
   raw rows so display_name, avatar_url, amount_cents, price_cents,
   shipping_cents and created_at all leak through — which is why the
   frontend carries `c.display_name||c.username` defenses.

   One field currently has three spellings across three files:
     db.js      shipping_cents
     pay.js     shippingCents
     server.js  shipping_cents, shipCents, shippingCents

   Call wire(row) on anything leaving the server. Then delete the defenses.
------------------------------------------------------------------ */
const camel = (k) => k.replace(/_([a-z0-9])/g, (_, c) => c.toUpperCase());

export function wire(row) {
  if (row == null || typeof row !== "object") return row;
  if (Array.isArray(row)) return row.map(wire);
  const out = {};
  for (const [k, v] of Object.entries(row)) {
    out[camel(k)] = v && typeof v === "object" && !Array.isArray(v) ? wire(v) : v;
  }
  return out;
}

/* Money is cents on the wire, formatted in exactly one place. */
export const money = (cents) => "$" + ((cents || 0) / 100).toFixed(2);

/* ------------------------------------------------------------------
   6. THE NOUNS
   One concept, one word. Today: the server says "channel" (48), the UI
   says "lab" (127), and "room" (18) exists only in index.html — same
   object, three names.

   `track` is the worst case: a row in the tracks table, an uploaded song
   in index.html, and a sequencer lane in studio.js (77 uses). That
   homonym is why renaming the routes to beats/samples could break the
   frontend without anyone noticing for weeks.

   Decide once, here, then rename toward it. `was` is the migration list.
------------------------------------------------------------------ */
export const NOUN = {
  lab:     { one: "lab",     many: "labs",     was: ["channel", "room"] },
  beat:    { one: "beat",    many: "beats",    was: ["project", "beat_project"] },
  sound:   { one: "sound",   many: "sounds",   was: ["sample"] },
  loop:    { one: "loop",    many: "loops",    was: [] },
  listing: { one: "listing", many: "listings", was: ["item"] },
  collab:  { one: "collab",  many: "collabs",  was: ["collaboration"] },
  work:    { one: "work",    many: "work",     was: [] },
  /* `track` is RESERVED for the studio sequencer lane. Nothing else. */
};

/* ------------------------------------------------------------------
   7. ENUMS
   Already correct in spirit — /api/market/meta ships these as the single
   source of truth. This makes them importable too, so the frontend's
   offline fallbacks stop being hand-typed second copies.
------------------------------------------------------------------ */
export const CATEGORIES = ["Tops", "Bottoms", "Outerwear", "Footwear", "Accessories",
  "Headwear", "Bags", "Jewellery", "Art / Prints", "Other"];

export const CONDITIONS = ["Deadstock", "Like New", "Good", "Worn", "Distressed"];

export const LOOP_CATEGORIES = ["Loop", "Drum Kit", "One Shot", "Sample Pack",
  "808 Pack", "Melody Loop", "Acapella", "Stem", "MIDI", "Preset"];

export const KEYS = ["C","C#","D","D#","E","F","F#","G","G#","A","A#","B",
  "Cm","C#m","Dm","D#m","Em","Fm","F#m","Gm","G#m","Am","A#m","Bm"];

export const SLOTS = ["kick", "808", "snare", "clap", "snap",
  "hat", "openhat", "perc", "rim", "tom", "crash",
  "bass", "melody", "vocal", "fx", "other"];

/* server.js:2655 already had the principle exactly right:
   "openhat" is a key, "Open Hat" is a label. This generalises it.
   VERIFY against SLOT_LABELS at server.js:2656 before deleting that map —
   these are reconstructed, not copied. */
export const SLOT_LABELS = {
  kick: "Kick", "808": "808", snare: "Snare", clap: "Clap", snap: "Snap",
  hat: "Hat", openhat: "Open Hat", perc: "Perc", rim: "Rim", tom: "Tom",
  crash: "Crash", bass: "Bass", melody: "Melody", vocal: "Vocal",
  fx: "FX", other: "Other",
};

/* ------------------------------------------------------------------
   8. THE HTTP CLIENT
   Was four implementations: index.html:1296, admin.html:139, six bare
   fetch() calls in studio.js, and client-api.js at the repo root — the
   last written against a React app that doesn't exist, knowing 15 of
   ~130 endpoints.

   Configuration is injected rather than read from the environment, which
   is what keeps this loadable in Node.
------------------------------------------------------------------ */
const CFG = { base: "", getToken: () => null };

export function configure(opts = {}) { Object.assign(CFG, opts); }

export async function req(path, { method = "GET", body, headers = {} } = {}) {
  const h = { "Content-Type": "application/json", ...headers };
  const token = CFG.getToken();
  if (token) h.Authorization = "Bearer " + token;

  const res = await fetch(CFG.base + path, {
    method,
    headers: h,
    body: body === undefined ? undefined : JSON.stringify(body),
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const info = data.err || errByCode(null);
    const e = new Error(data.error || info.message || `HTTP ${res.status}`);
    e.code = data.err?.code || null;
    e.status = res.status;
    throw e;
  }
  return data;
}

/* ------------------------------------------------------------------
   HOW TO ADOPT — smallest safe order, one commit each

   1. Commit this file at public/shared/tnl.js. Nothing imports it yet.
      Zero risk: it is an unreferenced static asset.

   2. db.js — delete LEVELS, levelFor, FEE_BY_LEVEL, feeForRep and import
      them from here. Re-export so server.js's existing import line at
      line 10 keeps working untouched.

   3. index.html — add the module script tag before the inline script,
      then delete LEVELS at :1142, levelFor at :1268, and the fee literal
      at :3019. Replace the notif label map at :1878 with notifLine.
      This alone fixes thirteen notifications reading as enum strings.

   4. server.js — convert handlers to ok()/fail() a section at a time.
      The legacy `error` string means the frontend needs no coordination.

   5. Wrap raw-row responses in wire(), then delete the
      `x.display_name||x.username` defenses in index.html.

   6. Delete client-api.js. It is a public, drifted fourth copy.

   THE TEST THAT KEEPS THIS TRUE — ~30 lines in test/, in the spirit of
   boot.test.mjs:
     · every req("...") path in index.html and admin.html resolves to a
       real app.<verb>() route in server.js
     · every notify() kind has a key in NOTIF_COPY
     · no fee or level literal appears outside this file
   That test would have caught the dead /api/tracks routes and the
   thirteen untranslated notifications on the day they landed.
================================================================ */
