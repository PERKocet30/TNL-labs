/* Patch 029 — Showroom card follows Instagram's order: the author block
   (avatar, name, level, role/channel and the sound credit) moves above the
   media; the caption, actions and comments stay below it. Nothing else in the
   card changes — same markup for the who-block, so avatar tap, profile
   navigation, the music chip and its delegate all keep working. First brick of
   the standard post template. Client-only. Runs after 028. */
const d = (s) => Buffer.from(s, "base64").toString("utf8");
export default [
  { file: "public/index.html", count: 1,
    find: d("ICByZXR1cm4gYDxkaXYgY2xhc3M9InNyLWNhcmQiPgogICAgJHsocC5pbWFnZXMmJnAuaW1hZ2VzLmxlbmd0aD4xKT9gPGRpdiBjbGFzcz0iY2FybyIgZGF0YS1jYXJvPSJzJHtwLmlkfSI+"),
    replace: d("ICByZXR1cm4gYDxkaXYgY2xhc3M9InNyLWNhcmQiPgogICAgPGRpdiBjbGFzcz0ic3ItaGVhZCI+CiAgICAgIDxkaXYgY2xhc3M9InNyLXdobyIgZGF0YS11PSIke2VzYyhwLmF1dGhvci51c2VybmFtZSl9Ij4KICAgICAgICAke2F2SFRNTChwLmF1dGhvciwic20iKX0KICAgICAgICA8ZGl2PjxkaXYgY2xhc3M9InNyLW5hbWUiPiR7ZXNjKHAuYXV0aG9yLmRpc3BsYXlOYW1lKX08c3BhbiBjbGFzcz0ibHZsIj5MJHtwLmF1dGhvci5sZXZlbH08L3NwYW4+PC9kaXY+CiAgICAgICAgPGRpdiBjbGFzcz0ibW9ubyBkaW0iPiR7ZXNjKHAuYXV0aG9yLnJvbGUudG9VcHBlckNhc2UoKSl9IMK3ICMke2VzYyhwLmNoYW5uZWwpfTwvZGl2PiR7bXVzQ2hpcEhUTUwocCl9PC9kaXY+CiAgICAgIDwvZGl2PgogICAgPC9kaXY+CiAgICAkeyhwLmltYWdlcyYmcC5pbWFnZXMubGVuZ3RoPjEpP2A8ZGl2IGNsYXNzPSJjYXJvIiBkYXRhLWNhcm89InMke3AuaWR9Ij4=") },
  { file: "public/index.html", count: 1,
    find: d("ICAgIDxkaXYgY2xhc3M9InNyLW1ldGEiPgogICAgICA8ZGl2IGNsYXNzPSJzci13aG8iIGRhdGEtdT0iJHtlc2MocC5hdXRob3IudXNlcm5hbWUpfSI+CiAgICAgICAgJHthdkhUTUwocC5hdXRob3IsInNtIil9CiAgICAgICAgPGRpdj48ZGl2IGNsYXNzPSJzci1uYW1lIj4ke2VzYyhwLmF1dGhvci5kaXNwbGF5TmFtZSl9PHNwYW4gY2xhc3M9Imx2bCI+TCR7cC5hdXRob3IubGV2ZWx9PC9zcGFuPjwvZGl2PgogICAgICAgIDxkaXYgY2xhc3M9Im1vbm8gZGltIj4ke2VzYyhwLmF1dGhvci5yb2xlLnRvVXBwZXJDYXNlKCkpfSDCtyAjJHtlc2MocC5jaGFubmVsKX08L2Rpdj4ke211c0NoaXBIVE1MKHApfTwvZGl2PgogICAgICA8L2Rpdj4K"),
    replace: d("ICAgIDxkaXYgY2xhc3M9InNyLW1ldGEiPgo=") },
  { file: "public/index.html", count: 1,
    find: d("LnNyLW1ldGF7cGFkZGluZzoxMXB4fQ=="),
    replace: d("LyogSW5zdGFncmFtIG9yZGVyOiB3aG8gaXQgaXMgb24gdG9wLCBtZWRpYSwgdGhlbiB3aGF0IHRoZXkgc2FpZC4gKi8KLnNyLWhlYWR7cGFkZGluZzoxMXB4IDExcHggOXB4fQouc3ItbWV0YXtwYWRkaW5nOjlweCAxMXB4IDExcHh9") },
];
