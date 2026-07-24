/* Patch 037 — pausing one track killed autoplay for the whole session.

   MUSMUTE was a global boolean. Tapping a chip on a track that was already
   playing means "stop", and that set MUSMUTE=true — after which
   wireMusAuto()'s first line, `if(!MUSOK||MUSMUTE)return`, bailed out on
   EVERY subsequent render. No observer was ever created again, so scrolling
   never started anything until a full reload.

   Which is exactly what testing looks like: tap a chip to hear it, tap again
   to stop, and autoplay is dead from then on.

   The intent in the original comment was narrower — "without it, the next
   scroll would restart the track they just silenced." That is about ONE post,
   not the feed. So MUSMUTE now holds the post id you silenced: that post
   stays quiet, every other post autoplays as normal, and centring any other
   post clears it.

   Note MUSMUTE's initial value moves false -> null, because `false != null`
   is true and would have suppressed the very first post on a fresh load.

   Client-only. Runs after 036. */
const d = (s) => Buffer.from(s, "base64").toString("utf8");
export default [
  { file: "public/index.html", count: 1,
    find: d("bGV0IE1VU09LPWZhbHNlLCBNVVNNVVRFPWZhbHNlLCBNVVNBVVRPSUQ9bnVsbCwgTU9CUz1udWxsOw=="),
    replace: d("bGV0IE1VU09LPWZhbHNlLCBNVVNNVVRFPW51bGwsIE1VU0FVVE9JRD1udWxsLCBNT0JTPW51bGw7") },
  { file: "public/index.html", count: 1,
    find: d("ICAgICAgTVVTTVVURT1zdG9wcGluZzsgICAgICAgICAgICAgIC8vIHRhcHBpbmcgYSBwbGF5aW5nIGNoaXAgbWVhbnMgInN0b3Ai"),
    replace: d("ICAgICAgTVVTTVVURT1zdG9wcGluZz9wLmlkOm51bGw7ICAgIC8vIHRoYXQgUE9TVCBzdGF5cyBzaWxlbnQ7IG90aGVycyBzdGlsbCBhdXRvcGxheQ==") },
  { file: "public/index.html", count: 1,
    find: d("ICBpZighTVVTT0t8fE1VU01VVEUpcmV0dXJuOw=="),
    replace: d("ICBpZighTVVTT0spcmV0dXJuOw==") },
  { file: "public/index.html", count: 1,
    find: d("ICAgICAgaWYoZS5pc0ludGVyc2VjdGluZyl7CiAgICAgICAgaWYoTVVTQVVUT0lEPT09cC5pZCYmTk9XUExBWUlORyYmTk9XUExBWUlORy5pZD09PXAuYXVkaW9UcmFjay5pZCYmIWEucGF1c2VkKWNvbnRpbnVlOw=="),
    replace: d("ICAgICAgaWYoZS5pc0ludGVyc2VjdGluZyl7CiAgICAgICAgLyogWW91IHNpbGVuY2VkIFRISVMgcG9zdCDigJQgbGVhdmUgaXQgc2lsZW50LCBidXQgYW55IG90aGVyIHBvc3QgY2xlYXJzIGl0LiAqLwogICAgICAgIGlmKE1VU01VVEUhPW51bGwmJlN0cmluZyhNVVNNVVRFKT09PVN0cmluZyhwLmlkKSljb250aW51ZTsKICAgICAgICBNVVNNVVRFPW51bGw7CiAgICAgICAgaWYoTVVTQVVUT0lEPT09cC5pZCYmTk9XUExBWUlORyYmTk9XUExBWUlORy5pZD09PXAuYXVkaW9UcmFjay5pZCYmIWEucGF1c2VkKWNvbnRpbnVlOw==") },
];
