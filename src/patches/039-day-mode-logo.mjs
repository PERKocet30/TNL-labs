/* Patch 039 — the logo is invisible in day mode.

   Not a CSS bug and not a loading bug. The mark is a 96x96 PNG on
   transparency whose opaque pixels have an average luminance of 255.0/255 —
   it is pure white artwork. On the day theme's white ground there is nothing
   to see. It renders in all three places it is used (the top bar and both
   gate headers); it just matches the background exactly.

   Because every opaque pixel is exactly 255,255,255, invert(1) maps it to
   exactly 0,0,0 and leaves the alpha channel alone, so the day-mode mark is
   clean black on white with no halo. If a coloured logo ever replaces this
   one, swap the filter for a second asset instead — invert only stays
   correct while the artwork is pure white.

   CSS only, one hunk, appended to the existing light-theme block. Runs
   after 038. */
const d = (s) => Buffer.from(s, "base64").toString("utf8");
export default [
  { file: "public/index.html", count: 1,
    find: d("W2RhdGEtdGhlbWU9ImxpZ2h0Il0gaW1nLnBhdixbZGF0YS10aGVtZT0ibGlnaHQiXSAubWluaWF2e2ZpbHRlcjpub25lfQ=="),
    replace: d("W2RhdGEtdGhlbWU9ImxpZ2h0Il0gaW1nLnBhdixbZGF0YS10aGVtZT0ibGlnaHQiXSAubWluaWF2e2ZpbHRlcjpub25lfQovKiBUaGUgbWFyayBpcyBwdXJlIHdoaXRlIGFydHdvcmsgKGV2ZXJ5IG9wYXF1ZSBwaXhlbCAyNTUsMjU1LDI1NSksIHNvIG9uIHRoZQogICBkYXkgZ3JvdW5kIGl0IHZhbmlzaGVkLiBpbnZlcnQoMSkgdGFrZXMgaXQgdG8gZXhhY3RseSBibGFjaywgYWxwaGEgdW50b3VjaGVkLiAqLwpbZGF0YS10aGVtZT0ibGlnaHQiXSAubWFya3tmaWx0ZXI6aW52ZXJ0KDEpfQ==") },
];
