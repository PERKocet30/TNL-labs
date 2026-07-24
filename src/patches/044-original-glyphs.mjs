/* Patch 044 — put the original like / comment / send glyphs back.

   028 redrew them and dropped .igact stroke 1.7 to 1.5. You prefer the
   originals, so this reverses exactly those two hunks — the payloads here
   are 028's own `find` strings, so this restores the previous artwork
   byte-for-byte rather than approximating it a second time.

   What is deliberately NOT reverted: 028's other two hunks, which have
   nothing to do with icons. Hunk 3 clears MUSAUTOID when playing from a
   MUSIC LAB row, and hunk 4 stops a post's sound when the post that owns it
   leaves the screen. Deleting 028 wholesale would have taken those with it.

   Note the original heart is a filled path with no stroke-linejoin, so it
   reads slightly heavier than the other two — that is how it was before, and
   restoring it faithfully means restoring that too.

   Untouched either way: the UI_IC nav map (home, hash, plus, bag, user,
   search, dm, bell, music, lock, cloud). Those glyphs have never been
   redrawn; they are still the originals at mixed 1.8 / 1.9 / 2.0 weights.

   Client-only, two hunks. Runs after 043. */
const d = (s) => Buffer.from(s, "base64").toString("utf8");
export default [
  { file: "public/index.html", count: 1,
    find: d("LyogT25lIHdlaWdodCwgcm91bmQgam9pbnMsIEluc3RhZ3JhbSBwcm9wb3J0aW9ucy4gVGhlIGhlYXJ0IGlzIHR3byBhcmNzIG1lZXRpbmcKICAgYXQgYSBwb2ludCwgdGhlIGJ1YmJsZSBrZWVwcyBpdHMgdGFpbCBpbnNpZGUgdGhlIG91dGxpbmUsIHRoZSBwbGFuZSBpcyBhCiAgIGtpdGUgd2l0aCBvbmUgZm9sZCBsaW5lIOKAlCBkcmF3biB0byByZWFkIGF0IDI1cHgsIG5vdCB6b29tZWQgaW4uICovCmNvbnN0IElHX0hFQVJUPWA8c3ZnIHZpZXdCb3g9IjAgMCAyNCAyNCIgYXJpYS1oaWRkZW49InRydWUiPjxwYXRoIGQ9Ik0xMiAyMC43QzYuNiAxNi45IDIuOCAxMy40IDIuOCA5LjIgMi44IDYuNCA1IDQuMiA3LjcgNC4yYzEuNyAwIDMuMy45IDQuMyAyLjMgMS0xLjQgMi42LTIuMyA0LjMtMi4zIDIuNyAwIDQuOSAyLjIgNC45IDUgMCA0LjItMy44IDcuNy05LjIgMTEuNXoiIHN0cm9rZS1saW5lam9pbj0icm91bmQiLz48L3N2Zz5gOwpjb25zdCBJR19DT01NRU5UPWA8c3ZnIHZpZXdCb3g9IjAgMCAyNCAyNCIgYXJpYS1oaWRkZW49InRydWUiPjxwYXRoIGQ9Ik0xMiAzLjRhOC42IDguNiAwIDAwLTcuNCAxMi45TDMuNCAyMC42bDQuMy0xLjJBOC42IDguNiAwIDEwMTIgMy40eiIgc3Ryb2tlLWxpbmVqb2luPSJyb3VuZCIvPjwvc3ZnPmA7CmNvbnN0IElHX1NFTkQ9YDxzdmcgdmlld0JveD0iMCAwIDI0IDI0IiBhcmlhLWhpZGRlbj0idHJ1ZSI+PHBhdGggZD0iTTIwLjggMy4yTDMuNCA5LjlsNi41IDMgLjIgNy45IDMuMi01LjQgNS0xLjYgMi41LTEwLjZ6TTkuOSAxMi45bDEwLjktOS43IiBzdHJva2UtbGluZWpvaW49InJvdW5kIiBzdHJva2UtbGluZWNhcD0icm91bmQiLz48L3N2Zz5gOw=="),
    replace: d("Y29uc3QgSUdfSEVBUlQ9YDxzdmcgdmlld0JveD0iMCAwIDI0IDI0IiBhcmlhLWhpZGRlbj0idHJ1ZSI+PHBhdGggZD0iTTEyIDIwLjNsLTEuNS0xLjM1QzUuMiAxNC4xIDIgMTEuMiAyIDcuNjUgMiA0LjkgNC4xNSAyLjggNi44NSAyLjhjMS41IDAgMi45NS43IDMuOSAxLjguOTUtMS4xIDIuNC0xLjggMy45LTEuOCAyLjcgMCA0Ljg1IDIuMSA0Ljg1IDQuODUgMCAzLjU1LTMuMiA2LjQ1LTguNSAxMS4zTDEyIDIwLjN6Ii8+PC9zdmc+YDsKY29uc3QgSUdfQ09NTUVOVD1gPHN2ZyB2aWV3Qm94PSIwIDAgMjQgMjQiIGFyaWEtaGlkZGVuPSJ0cnVlIj48cGF0aCBkPSJNMjAuNSAxMS41YTcuNSA3LjUgMCAwMS0xMC45IDYuN0wzLjUgMjBsMS45LTUuNGE3LjUgNy41IDAgMTExNS4xLTMuMXoiIHN0cm9rZS1saW5lam9pbj0icm91bmQiLz48L3N2Zz5gOwpjb25zdCBJR19TRU5EPWA8c3ZnIHZpZXdCb3g9IjAgMCAyNCAyNCIgYXJpYS1oaWRkZW49InRydWUiPjxwYXRoIGQ9Ik0yMS41IDMuNUwxMC41IDE0LjVNMjEuNSAzLjVsLTcgMTctNC03LjUtNy41LTQgMTguNS01LjV6IiBzdHJva2UtbGluZWpvaW49InJvdW5kIiBzdHJva2UtbGluZWNhcD0icm91bmQiLz48L3N2Zz5gOw==") },
  { file: "public/index.html", count: 1,
    find: d("LmlnYWN0IHN2Z3t3aWR0aDoyNXB4O2hlaWdodDoyNXB4O3N0cm9rZTpjdXJyZW50Q29sb3I7ZmlsbDpub25lO3N0cm9rZS13aWR0aDoxLjU7dHJhbnNpdGlvbjp0cmFuc2Zvcm0gLjEycyBlYXNlfQ=="),
    replace: d("LmlnYWN0IHN2Z3t3aWR0aDoyNXB4O2hlaWdodDoyNXB4O3N0cm9rZTpjdXJyZW50Q29sb3I7ZmlsbDpub25lO3N0cm9rZS13aWR0aDoxLjc7dHJhbnNpdGlvbjp0cmFuc2Zvcm0gLjEycyBlYXNlfQ==") },
];
