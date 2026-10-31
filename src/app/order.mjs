/* THE APP, IN ORDER — v1.0 · 2026-10-31 (the flatten).
   public/index.html is these files joined top to bottom with nothing between them
   (src/assemble.mjs). Order matters: the parts share one page and one script scope,
   so a const must come before its first use and later CSS wins. New file → add it
   here where it belongs, under its feature. Nothing else decides the order. */
export const APP = [

  // shell
  "shell/head.html",

  // styles
  "styles/base.css",
  "styles/profile.css",
  "styles/studio-ui.css",
  "styles/chat.css",
  "styles/compose.css",
  "styles/dialogs.css",
  "styles/editor.css",
  "styles/event.css",
  "styles/icons.css",
  "styles/kit.css",
  "styles/listing.css",
  "styles/media.css",
  "styles/motion.css",
  "styles/music.css",
  "styles/notifs.css",
  "styles/nowplaying.css",
  "styles/onboard.css",
  "styles/places.css",
  "styles/playlists.css",
  "styles/post.css",
  "styles/profile2.css",
  "styles/sell.css",
  "styles/shop.css",
  "styles/sizes.css",
  "styles/soft.css",
  "styles/updating.css",
  "styles/wide.css",

  // shell
  "shell/body.html",

  // core
  "core/device.js",
  "core/icons.js",
  "core/theme-labs-api.js",
  "core/updating.js",

  // media
  "media/images.js",

  // core
  "core/kit.js",
  "core/landed.js",

  // state
  "state/state-ui.js",

  // core
  "core/dialogs.js",

  // media
  "media/upload.js",

  // nav
  "nav/motion.js",
  "nav/back.js",
  "nav/render-nav.js",

  // messages
  "messages/kit.js",
  "messages/inbox.js",
  "messages/wire.js",
  "messages/sheets.js",
  "messages/live.js",
  "messages/labs.js",
  "messages/search.js",

  // showroom
  "showroom/gallery.js",

  // gate
  "gate/logic.js",
  "gate/oauth.js",
  "gate/screens.js",
  "gate/tour.js",
  "gate/getstarted.js",

  // labs
  "labs/places.js",

  // showroom
  "showroom/showroom.js",

  // posts
  "posts/archive-posts.js",
  "posts/comments.js",
  "posts/extras.js",

  // music
  "music/nowplaying.js",
  "music/player.js",
  "music/playlists.js",
  "music/tracks.js",

  // market
  "market/detail-sell.js",
  "market/listing.js",
  "market/sell-specs.js",
  "market/sell-variants.js",

  // profile
  "profile/edit.js",
  "profile/profile.js",

  // core
  "core/wire.js",

  // market
  "market/bag.js",

  // events
  "events/screen.js",
  "events/wire.js",
  "events/poll.js",

  // market
  "market/share.js",
  "market/market.js",

  // notifications
  "notifications/notifs.js",

  // market
  "market/order-done.js",

  // core
  "core/panels.js",

  // compose
  "compose/composer-ig.js",
  "compose/composer.js",

  // media
  "media/img-fallback.js",

  // instagram
  "instagram/inapp.js",

  // media
  "media/media.js",

  // compose
  "compose/preview.js",
  "compose/photo-edit.js",
  "compose/post-edit.js",
  "compose/post-mixed.js",
  "compose/queue.js",

  // instagram
  "instagram/story-share.js",

  // compose
  "compose/video-edit.js",

  // core
  "core/address.js",

  // feed
  "feed/feed-boot.js",

  // core
  "core/glitch.js",

  // shell
  "shell/tail.html",
];
