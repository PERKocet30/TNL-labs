/* Patch 040 — the link preview now describes the app that exists.

   These tags are what Meta, iMessage and Discord read when
   labs.tnllabs.com gets pasted into a chat — the comment above them in the
   file says it plainly: the link itself is the pitch, and a crawler doesn't
   run JavaScript. The old copy ("Creatives don't just meet here — they
   multiply") predates the rep system, the market, the labs restructure and
   the studio; it described a mood, not the product.

   Title and identity are untouched: LABS 🧪 — Cultivators stays exactly as
   it is, in og:title, twitter:title and the <title>. Only the three
   descriptions change, and each now leads with the constitution — rep is
   only earned when someone else backs you — because that is the one
   sentence that makes this not-Instagram in a preview card.

   Ships alongside a new og-cover.png (pushed separately, same change-set):
   black ground, the mark + LABS wordmark + CULTIVATORS, the rep line as the
   headline, and the five nav sections as the footer — drawn from the app's
   own tokens (#22C55E, the dim grey, the mono caption style) so the card
   and the app are recognisably the same object.

   Meta caches previews per-URL: after deploy, re-scrape at
   developers.facebook.com/tools/debug (or just append ?v=2 when sharing)
   to see the new card immediately.

   HTML meta only, three hunks. Runs after 039. */
const d = (s) => Buffer.from(s, "base64").toString("utf8");
export default [
  { file: "public/index.html", count: 1,
    find: d("PG1ldGEgcHJvcGVydHk9Im9nOmRlc2NyaXB0aW9uIiBjb250ZW50PSJBcnRpc3RzLCBkZXNpZ25lcnMsIG11c2ljaWFucywgZW50cmVwcmVuZXVycy4gQ3JlYXRpdmVzIGRvbid0IGp1c3QgbWVldCBoZXJlIOKAlCB0aGV5IG11bHRpcGx5LiI+"),
    replace: d("PG1ldGEgcHJvcGVydHk9Im9nOmRlc2NyaXB0aW9uIiBjb250ZW50PSJQb3N0IHdvcmssIGNvbGxhYm9yYXRlLCBzZWxsLiBSZXAgaXMgb25seSBlYXJuZWQgd2hlbiBzb21lb25lIGVsc2UgYmFja3MgeW91IOKAlCBsaWtlcywgY29sbGFicywgc2FsZXMuIE5ldmVyIGZyb20gcG9zdGluZyBhbG9uZS4iPg==") },
  { file: "public/index.html", count: 1,
    find: d("PG1ldGEgbmFtZT0idHdpdHRlcjpkZXNjcmlwdGlvbiIgY29udGVudD0iQXJ0aXN0cywgZGVzaWduZXJzLCBtdXNpY2lhbnMsIGVudHJlcHJlbmV1cnMuIENyZWF0aXZlcyBkb24ndCBqdXN0IG1lZXQgaGVyZSDigJQgdGhleSBtdWx0aXBseS4iPg=="),
    replace: d("PG1ldGEgbmFtZT0idHdpdHRlcjpkZXNjcmlwdGlvbiIgY29udGVudD0iUG9zdCB3b3JrLCBjb2xsYWJvcmF0ZSwgc2VsbC4gUmVwIGlzIG9ubHkgZWFybmVkIHdoZW4gc29tZW9uZSBlbHNlIGJhY2tzIHlvdSDigJQgbGlrZXMsIGNvbGxhYnMsIHNhbGVzLiBOZXZlciBmcm9tIHBvc3RpbmcgYWxvbmUuIj4=") },
  { file: "public/index.html", count: 1,
    find: d("PG1ldGEgbmFtZT0iZGVzY3JpcHRpb24iIGNvbnRlbnQ9IkEgd29ya3Nob3AgZm9yIGFydGlzdHMsIGRlc2lnbmVycywgbXVzaWNpYW5zIGFuZCBlbnRyZXByZW5ldXJzLiBQb3N0IHdvcmssIGNvbGxhYm9yYXRlLCBhbmQgc2VsbCDigJQgY29sbGFib3JhdGlvbiBpcyB0aGUgcHJvZHVjdC4iPg=="),
    replace: d("PG1ldGEgbmFtZT0iZGVzY3JpcHRpb24iIGNvbnRlbnQ9IkEgY3JlYXRpdmUgbmV0d29yayB3aXRoIHNldmVuIGxhYnMsIGEgcHVibGljIFNob3dyb29tLCBhIG1hcmtldCB3aXRoIGNvbW1pc3Npb24gdGhhdCBmYWxscyBhcyB0aGUgY29tbXVuaXR5IHZvdWNoZXMgZm9yIHlvdSwgYW5kIGEgYmVhdCBzdHVkaW8gaW4gdGhlIG11c2ljIGxhYi4gQ29sbGFib3JhdGlvbiBpcyB0aGUgcHJvZHVjdC4iPg==") },
];
