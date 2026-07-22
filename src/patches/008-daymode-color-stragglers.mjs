/* Patch 008 — the last day-mode colour stragglers. Client CSS only.
   004 tokenised colour ~90%; these three were the theme-blind leftovers
   that only show once you're actually in day mode:
   - the ACTIVE carousel dot stayed hardcoded #fff while the inactive dots
     were tokenised, so in day the active dot was the invisible one;
   - the ✕ that removes a photo in the sell form was a black circle with a
     var(--tx) glyph — black-on-black in day;
   - work-image placeholder was a hard #000 band during load.
   Runs after 007. Hunks are base64. */
const d = (s) => Buffer.from(s, "base64").toString("utf8");
export default [
  { file: "public/index.html", count: 1,
    find: d("LmNhcm8tZCBzcGFuLm9ue2JhY2tncm91bmQ6I2ZmZjt3aWR0aDoxNHB4O2JvcmRlci1yYWRpdXM6M3B4fQ=="),
    replace: d("LmNhcm8tZCBzcGFuLm9ue2JhY2tncm91bmQ6dmFyKC0tdHgpO3dpZHRoOjE0cHg7Ym9yZGVyLXJhZGl1czozcHh9") },
  { file: "public/index.html", count: 1,
    find: d("LnNpbWd4e3Bvc2l0aW9uOmFic29sdXRlO3RvcDotNXB4O3JpZ2h0Oi01cHg7d2lkdGg6MTlweDtoZWlnaHQ6MTlweDtib3JkZXItcmFkaXVzOjUwJTtiYWNrZ3JvdW5kOiMwMDA7Ym9yZGVyOjFweCBzb2xpZCB2YXIoLS1saW5lMik7Y29sb3I6dmFyKC0tdHgpO2ZvbnQtc2l6ZTo5cHg7cGFkZGluZzowfQ=="),
    replace: d("LnNpbWd4e3Bvc2l0aW9uOmFic29sdXRlO3RvcDotNXB4O3JpZ2h0Oi01cHg7d2lkdGg6MTlweDtoZWlnaHQ6MTlweDtib3JkZXItcmFkaXVzOjUwJTtiYWNrZ3JvdW5kOnZhcigtLXR4KTtib3JkZXI6MXB4IHNvbGlkIHZhcigtLWxpbmUyKTtjb2xvcjp2YXIoLS1iZyk7Zm9udC1zaXplOjlweDtwYWRkaW5nOjB9") },
  { file: "public/index.html", count: 1,
    find: d("LndvcmstaW1ne3dpZHRoOjEwMCU7bWF4LWhlaWdodDoxODBweDtib3JkZXItcmFkaXVzOjdweDtiYWNrZ3JvdW5kOiMwMDB9"),
    replace: d("LndvcmstaW1ne3dpZHRoOjEwMCU7bWF4LWhlaWdodDoxODBweDtib3JkZXItcmFkaXVzOjdweDtiYWNrZ3JvdW5kOnZhcigtLWVsKX0=") },
];
