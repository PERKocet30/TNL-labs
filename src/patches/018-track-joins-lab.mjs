/* Patch 018 — a track shows up on the MUSIC LAB card. The lab grid
   (faces, "N this week", the dot) is derived entirely from post rows per
   channel; tracks lived only in their own table, so MUSIC LAB said
   "empty — be first" while the library had music in it. Now adding a
   track also writes one plain post row to #tracks. The room renders the
   library, not the feed, so the row is presence on the card, not a
   duplicate surface. Applies inside 011's POST /api/tracks, which both
   upload and video-extraction (017) go through — one change covers both.
   Runs after 017. */
const d = (s) => Buffer.from(s, "base64").toString("utf8");
export default [
  { file: "src/server.js", count: 1,
    find: d("ICAgIE1hdGgubWF4KDAsIE51bWJlcihkdXJhdGlvbk1zKSB8fCAwKSwgTWF0aC5tYXgoMCwgTnVtYmVyKGJ5dGVzKSB8fCAwKSwgRGF0ZS5ub3coKSk7"),
    replace: d("ICAgIE1hdGgubWF4KDAsIE51bWJlcihkdXJhdGlvbk1zKSB8fCAwKSwgTWF0aC5tYXgoMCwgTnVtYmVyKGJ5dGVzKSB8fCAwKSwgRGF0ZS5ub3coKSk7CgogIC8qIEEgdHJhY2sgaXMgYWN0aXZpdHkgaW4gI3RyYWNrcyB0aGUgd2F5IGEgcG9zdCBpcyBhbnl3aGVyZSBlbHNlLiBUaGlzCiAgICAgcm93IGlzIHdoYXQgcHV0cyB5b3VyIGZhY2Ugb24gdGhlIE1VU0lDIExBQiBjYXJkIOKAlCB0aGUgbGFiIGdyaWQgaXMKICAgICBidWlsdCBlbnRpcmVseSBmcm9tIHBvc3RzLCBhbmQgdW50aWwgbm93IHVwbG9hZGluZyBtdXNpYyBsZWZ0IG5vCiAgICAgdHJhY2UgdGhlcmUuIFRoZSByb29tIGl0c2VsZiByZW5kZXJzIHRoZSBsaWJyYXJ5LCBub3QgdGhpcyBmZWVkLCBzbwogICAgIHRoZSByb3cncyBqb2IgaXMgcHJlc2VuY2UsIG5vdCBkaXNwbGF5LiBObyByZXA6IHJlcCBuZXZlciBjb21lcyBmcm9tCiAgICAgeW91ciBvd24gYWN0aW9ucy4gKi8KICBkYi5wcmVwYXJlKGBJTlNFUlQgSU5UTyBwb3N0cyAoYXV0aG9yX2lkLCBjaGFubmVsLCBib2R5LCBpc193b3JrLCBjcmVhdGVkX2F0KQogICAgVkFMVUVTICg/LCAndHJhY2tzJywgPywgMCwgPylgKS5ydW4ocmVxLnVzZXIuaWQsICLimasgIiArIHQuc2xpY2UoMCwgMTIwKSwgRGF0ZS5ub3coKSk7") },
];
