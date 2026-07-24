/* Patch 034 — the profile page had no scroll container.

   031/032 turned your own profile from a fixed overlay into an in-flow
   page: `.sheet.astab{position:static}`. That removed it from the overlay
   layer, where `.sheetc` had been `height:100%;overflow-y:auto` and did its
   own scrolling, and made it a plain flex child of `.app`.

   `.app` is `height:100dvh` and `body` is `overflow:hidden`, so nothing
   above it scrolls. `.content` is `flex:1 1 0%`, so it collapses to nothing
   once the profile claims space — which is why the bottom nav appears at the
   TOP of the screen on your own profile. The profile then fills the column
   with `overflow:visible` and no scroller anywhere in the chain, so
   everything below the fold is unreachable.

   Fix is the missing pair: `min-height:0` so the flex item is allowed to
   shrink below its content height, and `overflow-y:auto` so it scrolls
   inside what's left. Sizing is untouched — the profile still wins the
   column exactly as it does now.

   CSS only, one hunk. Runs after 033. */
const d = (s) => Buffer.from(s, "base64").toString("utf8");
export default [
  { file: "public/index.html", count: 1,
    find: d("LnNoZWV0LmFzdGFie3Bvc2l0aW9uOnN0YXRpYztpbnNldDphdXRvO2JhY2tncm91bmQ6bm9uZTtkaXNwbGF5OmJsb2NrO3otaW5kZXg6YXV0b30="),
    replace: d("LnNoZWV0LmFzdGFie3Bvc2l0aW9uOnN0YXRpYztpbnNldDphdXRvO2JhY2tncm91bmQ6bm9uZTtkaXNwbGF5OmJsb2NrO3otaW5kZXg6YXV0bzttaW4taGVpZ2h0OjA7b3ZlcmZsb3cteTphdXRvOy13ZWJraXQtb3ZlcmZsb3ctc2Nyb2xsaW5nOnRvdWNofQ==") },
];
