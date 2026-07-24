/* Patch 040 — the link preview says what the app now is.

   These tags are what Meta and iMessage read when labs.tnllabs.com gets
   pasted into a chat — the crawler never runs the app, so the static head
   is the whole pitch. The old description predates the room/showroom split:
   labs are community chats with tools inside (038), the Showroom is the
   feed, and collabs ranking highest is the algorithm. The preview now says
   that in the Showroom wall's own words.

   Pairs with a new og-cover.png (uploaded separately — the image is a
   binary asset, not patchable; it is NOT a patch-owned file, so a manual
   GitHub upload is safe). Text-only here: og/twitter descriptions, the
   search description, and the image alt. Title stays Cultivators.

   Client-only, head only. Runs after 039. */
const d = (s) => Buffer.from(s, "base64").toString("utf8");
export default [
  { file: "public/index.html", count: 1, find: d("PG1ldGEgcHJvcGVydHk9Im9nOmRlc2NyaXB0aW9uIiBjb250ZW50PSJBcnRpc3RzLCBkZXNpZ25lcnMsIG11c2ljaWFucywgZW50cmVwcmVuZXVycy4gQ3JlYXRpdmVzIGRvbid0IGp1c3QgbWVldCBoZXJlIOKAlCB0aGV5IG11bHRpcGx5LiI+"), replace: d("PG1ldGEgcHJvcGVydHk9Im9nOmRlc2NyaXB0aW9uIiBjb250ZW50PSJTZXZlbiByb29tcywgb25lIHNob3dyb29tLiBUYWxrIGluIHRoZSBsYWJzLCBwdWJsaXNoIHRoZSB3b3JrLCBhbmQgY29sbGFicyByYW5rIGhpZ2hlc3Qg4oCUIHRoYXQncyB0aGUgYWxnb3JpdGhtLCBub3QgYSBzbG9nYW4uIj4=") },
  { file: "public/index.html", count: 1, find: d("PG1ldGEgbmFtZT0idHdpdHRlcjpkZXNjcmlwdGlvbiIgY29udGVudD0iQXJ0aXN0cywgZGVzaWduZXJzLCBtdXNpY2lhbnMsIGVudHJlcHJlbmV1cnMuIENyZWF0aXZlcyBkb24ndCBqdXN0IG1lZXQgaGVyZSDigJQgdGhleSBtdWx0aXBseS4iPg=="), replace: d("PG1ldGEgbmFtZT0idHdpdHRlcjpkZXNjcmlwdGlvbiIgY29udGVudD0iU2V2ZW4gcm9vbXMsIG9uZSBzaG93cm9vbS4gVGFsayBpbiB0aGUgbGFicywgcHVibGlzaCB0aGUgd29yaywgYW5kIGNvbGxhYnMgcmFuayBoaWdoZXN0IOKAlCB0aGF0J3MgdGhlIGFsZ29yaXRobSwgbm90IGEgc2xvZ2FuLiI+") },
  { file: "public/index.html", count: 1, find: d("PG1ldGEgbmFtZT0iZGVzY3JpcHRpb24iIGNvbnRlbnQ9IkEgd29ya3Nob3AgZm9yIGFydGlzdHMsIGRlc2lnbmVycywgbXVzaWNpYW5zIGFuZCBlbnRyZXByZW5ldXJzLiBQb3N0IHdvcmssIGNvbGxhYm9yYXRlLCBhbmQgc2VsbCDigJQgY29sbGFib3JhdGlvbiBpcyB0aGUgcHJvZHVjdC4iPg=="), replace: d("PG1ldGEgbmFtZT0iZGVzY3JpcHRpb24iIGNvbnRlbnQ9IkEgd29ya3Nob3AgZm9yIGFydGlzdHMsIGRlc2lnbmVycywgbXVzaWNpYW5zIGFuZCBlbnRyZXByZW5ldXJzLiBTZXZlbiBsYWIgcm9vbXMgd2l0aCB0b29scyBpbnNpZGUsIGEgU2hvd3Jvb20gd2hlcmUgY29sbGFicyByYW5rIGhpZ2hlc3QsIGFuZCBhIG1hcmtldCB3aGVyZSB5b3VyIHJhdGUgZmFsbHMgYXMgdGhlIGNvbW11bml0eSBiYWNrcyB5b3UuIj4=") },
  { file: "public/index.html", count: 1, find: d("PG1ldGEgcHJvcGVydHk9Im9nOmltYWdlOmFsdCIgY29udGVudD0iTEFCUyDwn6eqIOKAlCBhIHdvcmtzaG9wIGZvciBhcnRpc3RzLCBkZXNpZ25lcnMgYW5kIG11c2ljaWFucyI+"), replace: d("PG1ldGEgcHJvcGVydHk9Im9nOmltYWdlOmFsdCIgY29udGVudD0iTEFCUyDwn6eqIOKAlCBzZXZlbiBsYWIgcm9vbXMgYW5kIGEgc2hvd3Jvb20gd2hlcmUgY29sbGFicyByYW5rIGhpZ2hlc3QiPg==") },
];
