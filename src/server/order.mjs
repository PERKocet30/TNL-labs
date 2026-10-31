/* THE SERVER, IN ORDER — v1.0 · 2026-10-31 (the flatten).
   src/server.runtime.js is these files joined top to bottom with nothing between
   them (src/assemble.mjs). Order matters: one module scope, so a const must come
   before its first use and routes register in this order. New file → add it here
   under its feature. Nothing else decides the order. */
export const SERVER = [

  // core
  "core/boot.js",
  "core/guard.js",
  "core/headers.js",

  // trust
  "trust/honest.js",

  // core
  "core/json.js",
  "core/look.js",
  "core/move.js",

  // auth
  "auth/passwords.js",

  // trust
  "trust/signals.js",
  "trust/turnstile.js",
  "trust/visits.js",

  // auth
  "auth/auth-feed.js",

  // posts
  "posts/extras.js",

  // uploads
  "uploads/upload-dm-notifications.js",

  // admin
  "admin/mods.js",
  "admin/dashboard.js",
  "admin/controls-backups.js",
  "admin/verify-nudge.js",

  // market
  "market/stock.js",
  "market/taxonomy.js",

  // admin
  "admin/settings-payouts-market.js",

  // orders
  "orders/cart.js",
  "orders/orders-sharing.js",
  "orders/void.js",

  // trust
  "trust/trust-library.js",

  // labs
  "labs/archive-boards.js",

  // admin
  "admin/systems.js",
  "admin/systems-google.js",
  "admin/systems-meta.js",
  "admin/v4.js",
  "admin/admin.js",
  "admin/members.js",

  // posts
  "posts/collabs-showroom.js",

  // messages
  "messages/core.js",
  "messages/groups.js",
  "messages/routes.js",

  // events
  "events/core.js",
  "events/routes.js",
  "events/admin.js",
  "events/cards.js",
  "events/showcase.js",
  "events/pages.js",
  "events/mail.js",
  "events/votemail.js",

  // core
  "core/glitch.js",

  // labs
  "labs/leads.js",

  // posts
  "posts/links.js",

  // core
  "core/live.js",

  // labs
  "labs/places.js",

  // profile
  "profile/card.js",

  // admin
  "admin/pulse-labs.js",

  // posts
  "posts/rank.js",

  // admin
  "admin/watch.js",
  "admin/weekly.js",

  // auth
  "auth/delete-account.js",

  // mail
  "mail/nudge.js",

  // auth
  "auth/oauth.js",

  // profile
  "profile/profile.js",

  // trust
  "trust/signals-admin.js",

  // profile
  "profile/social-meta.js",

  // trust
  "trust/spam.js",

  // auth
  "auth/start.js",

  // instagram
  "instagram/inbox.js",
  "instagram/alongside.js",

  // labs
  "labs/pages.js",

  // connector
  "connector/oauth.js",
  "connector/tools.js",
  "connector/songs.js",
  "connector/insights-people.js",
  "connector/insights-shop.js",

  // shop-feeds
  "shop-feeds/google.js",
  "shop-feeds/meta.js",

  // music
  "music/music.js",
  "music/playlists.js",

  // pages
  "pages/policies.js",

  // admin
  "admin/report.js",

  // pages
  "pages/seo.js",

  // instagram
  "instagram/story.js",

  // uploads
  "uploads/video.js",
];
