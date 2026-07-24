/* Patch 041 — the NETWORK line names labs that don't exist.

   It read: "Seven labs — music, art, fashion, anime, words, build." That is
   six descriptors for seven rooms, and two of them stopped being true. CASINO
   is not "words" — it became the magazine, news and promos room. TNΛ is not
   "build" — it is opportunities, coding and finance, the business arm. LABS
   HQ wasn't in the list at all. And "art" is a thin label for //.JPEG
   PHARMACY, which carries graphic design, photography, cinematography, video
   editing and the archive.

   The names now come from the LABS array itself, in its order, verified
   against it at build time: LABS HQ, //.JPEG PHARMACY, AKATSUKI, FASHION LAB,
   CASINO, MUSIC LAB, TNΛ.

   The second sentence is the part 038 earned: a lab is a chat with its tools
   inside — the archive, the beat studio, the boards. That is the thing a
   stranger cannot guess from the word "lab", and it is the difference between
   this and a feed with categories.

   Guest wall copy only, one hunk. Runs after 040. */
const d = (s) => Buffer.from(s, "base64").toString("utf8");
export default [
  { file: "public/index.html", count: 1,
    find: d("ICAgIDxkaXYgY2xhc3M9IndpIj48c3BhbiBjbGFzcz0id2ktayBtb25vIj5ORVRXT1JLPC9zcGFuPjxzcGFuIGNsYXNzPSJ3aS12Ij5TZXZlbiBsYWJzIOKAlCBtdXNpYywgYXJ0LCBmYXNoaW9uLCBhbmltZSwgd29yZHMsIGJ1aWxkLiBFbnRlciB0aHJvdWdoIHdoYXQgeW91IG1ha2UsIG1lZXQgZXZlcnlvbmUgZWxzZS48L3NwYW4+PC9kaXY+"),
    replace: d("ICAgIDxkaXYgY2xhc3M9IndpIj48c3BhbiBjbGFzcz0id2ktayBtb25vIj5ORVRXT1JLPC9zcGFuPjxzcGFuIGNsYXNzPSJ3aS12Ij5TZXZlbiByb29tcyDigJQgTEFCUyBIUSwgLy8uSlBFRyBQSEFSTUFDWSwgQUtBVFNVS0ksIEZBU0hJT04gTEFCLCBDQVNJTk8sIE1VU0lDIExBQiwgVE7Omy4gRWFjaCBvbmUgYSBjaGF0IHdpdGggaXRzIHRvb2xzIGluc2lkZTogdGhlIGFyY2hpdmUsIHRoZSBiZWF0IHN0dWRpbywgdGhlIGJvYXJkcy4gRW50ZXIgdGhyb3VnaCB3aGF0IHlvdSBtYWtlLCBtZWV0IGV2ZXJ5b25lIGVsc2UuPC9zcGFuPjwvZGl2Pg==") },
];
