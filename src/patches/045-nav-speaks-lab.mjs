/* Patch 045 — the nav speaks the labs glyph language.

   LAB_ID already renders each lab as a geometric mark: ◉ hq, ⌗ pharmacy,
   ▣ fashion, ♠ casino, Λ tnΛ. The bottom nav was outline SVGs from a
   different vocabulary entirely — and at mixed 1.8 / 1.9 / 2.0 stroke
   weights, which is what made them read as borrowed rather than drawn.

   Nav now uses the same kind of marks, chosen not to collide with any lab:

     ◈  SHOWROOM   the work, set out
     ⌗  LABS       the rooms, and the # language of channels
     ＋ POST
     ▤  MARKET
     ◎  PROFILE

   No strokes, so nothing to keep consistent. .ic already had font-size and
   font-style:normal — it was built to hold type — it just needed more size
   for a glyph than a 22px svg needed, hence .navb .ic{font-size:21px},
   scoped so the lab list keeps its own sizing.

   UI_IC.home / hash / plus / bag / user stay defined; other surfaces still
   call them. Swapping any pick is one character in the t[] array.

   Client-only, two hunks. Runs after 044. */
const d = (s) => Buffer.from(s, "base64").toString("utf8");
export default [
  { file: "public/index.html", count: 1,
    find: d("ICBjb25zdCB0PVtbInNob3dyb29tIixVSV9JQy5ob21lLCJTSE9XUk9PTSJdLFsibGFicyIsVUlfSUMuaGFzaCwiTEFCUyJdLFsicG9zdCIsVUlfSUMucGx1cywiUE9TVCJdXTsKICBpZihTSVRFLm1hcmtldE9wZW4hPT1mYWxzZSl0LnB1c2goWyJtYXJrZXQiLFVJX0lDLmJhZywiTUFSS0VUIl0pOwogIHQucHVzaChbInByb2ZpbGUiLFVJX0lDLnVzZXIsIlBST0ZJTEUiXSk7"),
    replace: d("ICAvKiBUaGUgbmF2IHNwZWFrcyB0aGUgc2FtZSBsYW5ndWFnZSBhcyB0aGUgbGFiIGxpc3Q6IGdlb21ldHJpYyBtYXJrcywgbm90CiAgICAgb3V0bGluZSBpY29ucy4gTEFCX0lEIGFscmVhZHkgdXNlcyDil4kg4oyXIOKWoyDimaAgzpssIHNvIHRoZSBib3R0b20gYmFyIG1hdGNoaW5nIHRoZW0KICAgICBtYWtlcyB0aGUgY2hyb21lIHJlYWQgYXMgb25lIHN5c3RlbSDigJQgYW5kIGl0IHJldGlyZXMgdGhlIG1peGVkIDEuOC8xLjkvMi4wCiAgICAgc3Ryb2tlIHdlaWdodHMgdGhhdCBtYWRlIHRoZXNlIGxvb2sgYm9ycm93ZWQuICovCiAgY29uc3QgdD1bWyJzaG93cm9vbSIsIuKXiCIsIlNIT1dST09NIl0sWyJsYWJzIiwi4oyXIiwiTEFCUyJdLFsicG9zdCIsIu+8iyIsIlBPU1QiXV07CiAgaWYoU0lURS5tYXJrZXRPcGVuIT09ZmFsc2UpdC5wdXNoKFsibWFya2V0Iiwi4pakIiwiTUFSS0VUIl0pOwogIHQucHVzaChbInByb2ZpbGUiLCLil44iLCJQUk9GSUxFIl0pOw==") },
  { file: "public/index.html", count: 1,
    find: d("Lmlje2ZvbnQtc2l6ZToxN3B4O2xpbmUtaGVpZ2h0OjE7Zm9udC1zdHlsZTpub3JtYWw7ZGlzcGxheTpmbGV4O2FsaWduLWl0ZW1zOmNlbnRlcjtqdXN0aWZ5LWNvbnRlbnQ6Y2VudGVyfQ=="),
    replace: d("Lmlje2ZvbnQtc2l6ZToxN3B4O2xpbmUtaGVpZ2h0OjE7Zm9udC1zdHlsZTpub3JtYWw7ZGlzcGxheTpmbGV4O2FsaWduLWl0ZW1zOmNlbnRlcjtqdXN0aWZ5LWNvbnRlbnQ6Y2VudGVyfQovKiBOYXYgZ2x5cGhzIGFyZSB0eXBlLCBub3QgYXJ0d29yayDigJQgdGhleSBuZWVkIG1vcmUgc2l6ZSB0aGFuIGEgMjJweCBzdmcgZGlkLiAqLwoubmF2YiAuaWN7Zm9udC1zaXplOjIxcHh9") },
];
