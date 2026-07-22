/* Patch 007 — market card modernization. Client CSS + markup only; no
   server, no money, no schema.
   - The item title was var(--dim) weight 500 — the quietest thing on a
     shopping card. Now readable (var(--tx), 600), with the price still the
     loudest element.
   - Cards get a card background, hairline border and radius so they read
     as tappable objects, matching the profile work cards. The image radius
     moves to the card so the border wraps cleanly; the loop-card art is
     flattened the same way.
   - Scrollbar hidden on the filter chip rail.
   - Seller trust row lifted from 9px to 10px — it's the standing signal,
     it shouldn't be the smallest text on the card.
   Runs after 006. Hunks are base64. */
const d = (s) => Buffer.from(s, "base64").toString("utf8");
export default [
  { file: "public/index.html", count: 1,
    find: d("Lm1jYXJke2JhY2tncm91bmQ6dHJhbnNwYXJlbnQ7Ym9yZGVyOjA7Y3Vyc29yOnBvaW50ZXJ9"),
    replace: d("Lm1jYXJke2JhY2tncm91bmQ6dmFyKC0tY2FyZCk7Ym9yZGVyOjFweCBzb2xpZCB2YXIoLS1saW5lKTtib3JkZXItcmFkaXVzOjE2cHg7b3ZlcmZsb3c6aGlkZGVuO2N1cnNvcjpwb2ludGVyO3RyYW5zaXRpb246Ym9yZGVyLWNvbG9yIC4xNXN9Ci5tY2FyZDphY3RpdmV7Ym9yZGVyLWNvbG9yOnZhcigtLWxpbmUyKX0=") },
  { file: "public/index.html", count: 1,
    find: d("Lm1pbWd3cmFwe3Bvc2l0aW9uOnJlbGF0aXZlO2FzcGVjdC1yYXRpbzoxLzE7YmFja2dyb3VuZDp2YXIoLS1lbCk7Ym9yZGVyLXJhZGl1czoxNHB4O292ZXJmbG93OmhpZGRlbn0="),
    replace: d("Lm1pbWd3cmFwe3Bvc2l0aW9uOnJlbGF0aXZlO2FzcGVjdC1yYXRpbzoxLzE7YmFja2dyb3VuZDp2YXIoLS1lbCk7b3ZlcmZsb3c6aGlkZGVufQ==") },
  { file: "public/index.html", count: 1,
    find: d("Lm1ib2R5e3BhZGRpbmc6OXB4IDNweCA0cHh9"),
    replace: d("Lm1ib2R5e3BhZGRpbmc6MTBweCAxMXB4IDEycHh9") },
  { file: "public/index.html", count: 1,
    find: d("Lm10aXRsZXtmb250LXNpemU6MTIuNXB4O2ZvbnQtd2VpZ2h0OjUwMDtjb2xvcjp2YXIoLS1kaW0pO292ZXJmbG93OmhpZGRlbjt0ZXh0LW92ZXJmbG93OmVsbGlwc2lzO3doaXRlLXNwYWNlOm5vd3JhcDttYXJnaW4tdG9wOjJweH0="),
    replace: d("Lm10aXRsZXtmb250LXNpemU6MTIuNXB4O2ZvbnQtd2VpZ2h0OjYwMDtjb2xvcjp2YXIoLS10eCk7b3ZlcmZsb3c6aGlkZGVuO3RleHQtb3ZlcmZsb3c6ZWxsaXBzaXM7d2hpdGUtc3BhY2U6bm93cmFwO21hcmdpbi10b3A6M3B4O2xldHRlci1zcGFjaW5nOi0uMDFlbX0=") },
  { file: "public/index.html", count: 1,
    find: d("Lm1wcmljZXtmb250LXdlaWdodDo4MDA7Zm9udC1zaXplOjE1cHh9"),
    replace: d("Lm1wcmljZXtmb250LXdlaWdodDo4MDA7Zm9udC1zaXplOjE2cHg7bGV0dGVyLXNwYWNpbmc6LS4wMmVtfQ==") },
  { file: "public/index.html", count: 1,
    find: d("Lm1sb29we3Bvc2l0aW9uOnJlbGF0aXZlO2FzcGVjdC1yYXRpbzoxLzE7Ym9yZGVyLXJhZGl1czoxNHB4O292ZXJmbG93OmhpZGRlbjtiYWNrZ3JvdW5kOmxpbmVhci1ncmFkaWVudCgxNDVkZWcsY29sb3ItbWl4KGluIHNyZ2IsIHZhcigtLWdyZWVuKSAxOCUsIHRyYW5zcGFyZW50KSx2YXIoLS1lbCkpO2Rpc3BsYXk6ZmxleDthbGlnbi1pdGVtczpjZW50ZXI7anVzdGlmeS1jb250ZW50OmNlbnRlcn0="),
    replace: d("Lm1sb29we3Bvc2l0aW9uOnJlbGF0aXZlO2FzcGVjdC1yYXRpbzoxLzE7b3ZlcmZsb3c6aGlkZGVuO2JhY2tncm91bmQ6bGluZWFyLWdyYWRpZW50KDE0NWRlZyxjb2xvci1taXgoaW4gc3JnYiwgdmFyKC0tZ3JlZW4pIDE4JSwgdHJhbnNwYXJlbnQpLHZhcigtLWVsKSk7ZGlzcGxheTpmbGV4O2FsaWduLWl0ZW1zOmNlbnRlcjtqdXN0aWZ5LWNvbnRlbnQ6Y2VudGVyfQ==") },
  { file: "public/index.html", count: 1,
    find: d("LmZjaGlwc3tkaXNwbGF5OmZsZXg7Z2FwOjZweDtvdmVyZmxvdy14OmF1dG87cGFkZGluZy1ib3R0b206M3B4fQ=="),
    replace: d("LmZjaGlwc3tkaXNwbGF5OmZsZXg7Z2FwOjZweDtvdmVyZmxvdy14OmF1dG87cGFkZGluZy1ib3R0b206M3B4O3Njcm9sbGJhci13aWR0aDpub25lfQouZmNoaXBzOjotd2Via2l0LXNjcm9sbGJhcntkaXNwbGF5Om5vbmV9") },
  { file: "public/index.html", count: 1,
    find: d("Lm1rdC1ieXtkaXNwbGF5OmZsZXg7YWxpZ24taXRlbXM6Y2VudGVyO2dhcDo2cHg7bWFyZ2luLXRvcDo1cHg7Zm9udC1zaXplOjlweH0="),
    replace: d("Lm1rdC1ieXtkaXNwbGF5OmZsZXg7YWxpZ24taXRlbXM6Y2VudGVyO2dhcDo2cHg7bWFyZ2luLXRvcDo3cHg7Zm9udC1zaXplOjEwcHh9") },
];
