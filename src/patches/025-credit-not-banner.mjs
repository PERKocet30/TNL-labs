/* Patch 025 — the sound reads as a credit, not an attachment. Client-only.
   Instagram puts the track under the username in the post header; mine sat
   below the media as a bordered pill, which is why it read as a file even
   after restyling. Moved into the header of the feed post and the Showroom
   card, dropped entirely from profile grid tiles (Instagram tiles are just
   photos), and restyled from pill to a thin ♫ line at caption weight.
   Markup of the chip itself, the tap-to-toggle, the glyph flip and autoplay
   are all untouched — only placement and skin. The banner look now lives
   only in MUSIC LAB rows, where the file genuinely is the subject.
   No server hunk, no schema, no money path. Runs after 024. */
const d = (s) => Buffer.from(s, "base64").toString("utf8");
export default [
  { file: "public/index.html", count: 1,
    find: d("ICAke211c0NoaXBIVE1MKHApfQogICR7cC5jb2xsYWJvcmF0b3JzLmxlbmd0aD9gPGRpdiBjbGFzcz0iY29sbGFiLXJvdyI+"),
    replace: d("ICAke3AuY29sbGFib3JhdG9ycy5sZW5ndGg/YDxkaXYgY2xhc3M9ImNvbGxhYi1yb3ciPg==") },
  { file: "public/index.html", count: 1,
    find: d("ICAgIDxkaXYgY2xhc3M9InBvc3QtbWV0YSI+JHtlc2MocC5hdXRob3Iucm9sZS50b1VwcGVyQ2FzZSgpKX0gwrcgJHtuZXcgRGF0ZShwLmNyZWF0ZWRBdCkudG9Mb2NhbGVUaW1lU3RyaW5nKFtdLCB7aG91cjoibnVtZXJpYyIsbWludXRlOiIyLWRpZ2l0In0pfSR7cC5lZGl0ZWRBdD8iIMK3IEVESVRFRCI6IiJ9JHtwLmlzV29yaz9gIMK3IDxzcGFuIHN0eWxlPSJjb2xvcjp2YXIoLS1ncmVlbikiPlBPUlRGT0xJTzwvc3Bhbj5gOiIifTwvZGl2PjwvZGl2Pg=="),
    replace: d("ICAgIDxkaXYgY2xhc3M9InBvc3QtbWV0YSI+JHtlc2MocC5hdXRob3Iucm9sZS50b1VwcGVyQ2FzZSgpKX0gwrcgJHtuZXcgRGF0ZShwLmNyZWF0ZWRBdCkudG9Mb2NhbGVUaW1lU3RyaW5nKFtdLCB7aG91cjoibnVtZXJpYyIsbWludXRlOiIyLWRpZ2l0In0pfSR7cC5lZGl0ZWRBdD8iIMK3IEVESVRFRCI6IiJ9JHtwLmlzV29yaz9gIMK3IDxzcGFuIHN0eWxlPSJjb2xvcjp2YXIoLS1ncmVlbikiPlBPUlRGT0xJTzwvc3Bhbj5gOiIifTwvZGl2PiR7bXVzQ2hpcEhUTUwocCl9PC9kaXY+") },
  { file: "public/index.html", count: 1,
    find: d("ICAgICR7bXVzQ2hpcEhUTUwocCl9CiAgICA8ZGl2IGNsYXNzPSJzci1tZXRhIj4="),
    replace: d("ICAgIDxkaXYgY2xhc3M9InNyLW1ldGEiPg==") },
  { file: "public/index.html", count: 1,
    find: d("ICAgICAgICA8ZGl2IGNsYXNzPSJtb25vIGRpbSI+JHtlc2MocC5hdXRob3Iucm9sZS50b1VwcGVyQ2FzZSgpKX0gwrcgIyR7ZXNjKHAuY2hhbm5lbCl9PC9kaXY+PC9kaXY+"),
    replace: d("ICAgICAgICA8ZGl2IGNsYXNzPSJtb25vIGRpbSI+JHtlc2MocC5hdXRob3Iucm9sZS50b1VwcGVyQ2FzZSgpKX0gwrcgIyR7ZXNjKHAuY2hhbm5lbCl9PC9kaXY+JHttdXNDaGlwSFRNTChwKX08L2Rpdj4=") },
  { file: "public/index.html", count: 1,
    find: d("ICAgICR7bXVzQ2hpcEhUTUwocCl9CiAgICA8ZGl2IGNsYXNzPSJ3b3JrLWZvb3QgbW9ubyI+"),
    replace: d("ICAgIDxkaXYgY2xhc3M9IndvcmstZm9vdCBtb25vIj4=") },
  { file: "public/index.html", count: 1,
    find: d("Lm11c2NoaXB7ZGlzcGxheTppbmxpbmUtZmxleDthbGlnbi1pdGVtczpjZW50ZXI7Z2FwOjZweDttYXgtd2lkdGg6Y2FsYygxMDAlIC0gMjhweCk7bWFyZ2luOjhweCAxNHB4IDA7YmFja2dyb3VuZDp2YXIoLS1lbCk7Ym9yZGVyOjFweCBzb2xpZCB2YXIoLS1saW5lKTtib3JkZXItcmFkaXVzOjk5OXB4O3BhZGRpbmc6NXB4IDEycHg7Zm9udC1zaXplOjEycHg7Y29sb3I6dmFyKC0tdHgpO2N1cnNvcjpwb2ludGVyfQoubXVzY2hpcC10e2ZvbnQtd2VpZ2h0OjcwMDtvdmVyZmxvdzpoaWRkZW47dGV4dC1vdmVyZmxvdzplbGxpcHNpczt3aGl0ZS1zcGFjZTpub3dyYXA7bWF4LXdpZHRoOjE4MHB4fQ=="),
    replace: d("Lm11c2NoaXB7ZGlzcGxheTppbmxpbmUtZmxleDthbGlnbi1pdGVtczpjZW50ZXI7Z2FwOjVweDttYXgtd2lkdGg6MTAwJTttYXJnaW46MXB4IDAgMDtiYWNrZ3JvdW5kOm5vbmU7Ym9yZGVyOjA7Ym9yZGVyLXJhZGl1czowO3BhZGRpbmc6MDtmb250LXNpemU6MTEuNXB4O2xpbmUtaGVpZ2h0OjEuMzU7Y29sb3I6dmFyKC0tZGltKTtjdXJzb3I6cG9pbnRlcjtmb250LWZhbWlseTppbmhlcml0O3RleHQtYWxpZ246bGVmdH0KLm11c2NoaXA6YWN0aXZle29wYWNpdHk6LjU1fQoubXVzY2hpcC10e2ZvbnQtd2VpZ2h0OjYwMDtjb2xvcjp2YXIoLS10eCk7b3ZlcmZsb3c6aGlkZGVuO3RleHQtb3ZlcmZsb3c6ZWxsaXBzaXM7d2hpdGUtc3BhY2U6bm93cmFwO21heC13aWR0aDoxOTBweH0=") },
];
