/* Patch 073 — the door is the unlock. The intro exists so that entering
   the app is a gesture, and a gesture is the only thing that lets a
   browser start audio. Two things were working against that:

   1. The door was suppressed after its first appearance in a tab
      (sessionStorage "tnl-entered"). But MUSOK/MUSPRIMED are in-memory and
      reset with every page load, so a reload needed a fresh gesture and
      got no door to provide one — music was armed nowhere. The door now
      stands on every page load. (The old !ME half of that test never did
      anything: ME is null that early because refreshMe() is async, so the
      condition read the same for members and guests.)

   2. The film played every time the door did. Now it plays once per device
      (localStorage "tnl-intro-seen"); after that the door is the mark, the
      button, and one tap straight through. wireEnter already treats a
      missing video as nothing to wait for and calls done() on the tap, so
      omitting the element is the whole fast path — no new timing code.

   Net behaviour: first ever visit = film, then in. Every visit after =
   one tap on ENTER THE LAB, then in, with audio armed. Combined with 072
   (which fixes the unlock aborting itself), that tap reliably arms sound
   for the session on Safari and on the home-screen app, logged in or out,
   and posts autoplay on scroll from then on.

   3 hunks, client. Runs after 072. */
const d = (s) => Buffer.from(s, "base64").toString("utf8");
export default [
  { file: "public/index.html", count: 1,
    find: d("dHJ5IHsgRU5URVIgPSAhTUUgJiYgIXNlc3Npb25TdG9yYWdlLmdldEl0ZW0oInRubC1lbnRlcmVkIik7IH0gY2F0Y2ggeyBFTlRFUiA9IGZhbHNlOyB9"),
    replace: d("LyogVGhlIGRvb3IgaXMgdGhlIGF1ZGlvIHVubG9jaywgc28gaXQgc3RhbmRzIG9uIEVWRVJZIHBhZ2UgbG9hZC4gTVVTT0sgYW5kCiAgIE1VU1BSSU1FRCBsaXZlIGluIG1lbW9yeSBhbmQgcmVzZXQgd2l0aCB0aGUgcGFnZSwgd2hpY2ggbWVhbnMgYSByZWxvYWQKICAgbmVlZHMgYSBmcmVzaCBnZXN0dXJlIOKAlCBhbmQgdGhlIG9sZCBzZXNzaW9uU3RvcmFnZSBzdXBwcmVzc2lvbiBoaWQgdGhlCiAgIGRvb3Igb24gZXhhY3RseSB0aG9zZSBsb2FkcywgbGVhdmluZyBtdXNpYyBhcm1lZCBub3doZXJlLiBUaGUgaW50cm8gVklERU8KICAgaXMgdGhlIHRoaW5nIHRoYXQgc2hvdWxkIG9ubHkgaGFwcGVuIG9uY2U7IHRoZSB0YXAgaXMgY2hlYXAgYW5kIGl0IGlzIHRoZQogICB3aG9sZSByZWFzb24gYXV0b3BsYXkgY2FuIHdvcmsgYXQgYWxsLiAoTm90ZSBNRSBpcyBzdGlsbCBudWxsIHRoaXMgZWFybHkg4oCUCiAgIHJlZnJlc2hNZSgpIGlzIGFzeW5jIOKAlCBzbyB0aGUgb2xkICFNRSB0ZXN0IG5ldmVyIGRpc3Rpbmd1aXNoZWQgYSBtZW1iZXIKICAgZnJvbSBhIGd1ZXN0IGFueXdheS4pICovCkVOVEVSID0gdHJ1ZTs=") },
  { file: "public/index.html", count: 1,
    find: d("ZnVuY3Rpb24gZW50ZXJIVE1MKCl7CiAgY29uc3QgbWFyayA9IChkb2N1bWVudC5xdWVyeVNlbGVjdG9yKCIubWFyayIpfHx7fSkuc3JjIHx8ICIiOwogIHJldHVybiBgPGRpdiBjbGFzcz0iZW50ZXIiIGlkPSJlbnRlck92Ij4KICAgIDx2aWRlbyBjbGFzcz0iZW50ZXItdiIgaWQ9ImVudGVyVmlkIiBwbGF5c2lubGluZSBwcmVsb2FkPSJtZXRhZGF0YSIKICAgICAgcG9zdGVyPSIvdG5sLWVudGVyLXBvc3Rlci5qcGciIHNyYz0iL3RubC1lbnRlci5tcDQiPjwvdmlkZW8+CiAgICA8ZGl2IGNsYXNzPSJlbnRlci1jIiBpZD0iZW50ZXJDIj4KICAgICAgJHttYXJrP2A8aW1nIGNsYXNzPSJlbnRlci1tIiBzcmM9IiR7bWFya30iIGFsdD0iVE5MIj5gOiIifQogICAgICA8YnV0dG9uIGNsYXNzPSJlbnRlci1iIiBpZD0iZW50ZXJCdG4iPkVOVEVSIFRIRSBMQUI8L2J1dHRvbj4KICAgIDwvZGl2PgogICAgPGJ1dHRvbiBjbGFzcz0iZW50ZXItcyIgaWQ9ImVudGVyU2tpcCIgc3R5bGU9InBvc2l0aW9uOmFic29sdXRlO3JpZ2h0OjE0cHg7Ym90dG9tOjE4cHg7ei1pbmRleDoyIj5TS0lQPC9idXR0b24+CiAgPC9kaXY+YDsKfQ=="),
    replace: d("ZnVuY3Rpb24gZW50ZXJIVE1MKCl7CiAgY29uc3QgbWFyayA9IChkb2N1bWVudC5xdWVyeVNlbGVjdG9yKCIubWFyayIpfHx7fSkuc3JjIHx8ICIiOwogIC8qIEZpcnN0IHZpc2l0IGdldHMgdGhlIGZpbG0uIEV2ZXJ5IHZpc2l0IGFmdGVyIHRoYXQgZ2V0cyB0aGUgc2FtZSBkb29yCiAgICAgd2l0aCBubyB2aWRlbyBiZWhpbmQgaXQ6IHRoZSBtYXJrLCB0aGUgYnV0dG9uLCBvbmUgdGFwLCBzdHJhaWdodCBpbi4KICAgICB3aXJlRW50ZXIgYWxyZWFkeSB0cmVhdHMgYSBtaXNzaW5nIHZpZGVvIGFzICJub3RoaW5nIHRvIHdhaXQgZm9yIiBhbmQKICAgICBnb2VzIG9uIHRoZSB0YXAsIHNvIG9taXR0aW5nIHRoZSBlbGVtZW50IElTIHRoZSBmYXN0IHBhdGguICovCiAgbGV0IHNlZW49ZmFsc2U7IHRyeXsgc2VlbiA9ICEhbG9jYWxTdG9yYWdlLmdldEl0ZW0oInRubC1pbnRyby1zZWVuIikgfWNhdGNoKGUpe30KICByZXR1cm4gYDxkaXYgY2xhc3M9ImVudGVyJHtzZWVuPyIgcXVpY2siOiIifSIgaWQ9ImVudGVyT3YiPgogICAgJHtzZWVuPyIiOmA8dmlkZW8gY2xhc3M9ImVudGVyLXYiIGlkPSJlbnRlclZpZCIgcGxheXNpbmxpbmUgcHJlbG9hZD0ibWV0YWRhdGEiCiAgICAgIHBvc3Rlcj0iL3RubC1lbnRlci1wb3N0ZXIuanBnIiBzcmM9Ii90bmwtZW50ZXIubXA0Ij48L3ZpZGVvPmB9CiAgICA8ZGl2IGNsYXNzPSJlbnRlci1jIiBpZD0iZW50ZXJDIj4KICAgICAgJHttYXJrP2A8aW1nIGNsYXNzPSJlbnRlci1tIiBzcmM9IiR7bWFya30iIGFsdD0iVE5MIj5gOiIifQogICAgICA8YnV0dG9uIGNsYXNzPSJlbnRlci1iIiBpZD0iZW50ZXJCdG4iPkVOVEVSIFRIRSBMQUI8L2J1dHRvbj4KICAgIDwvZGl2PgogICAgJHtzZWVuPyIiOmA8YnV0dG9uIGNsYXNzPSJlbnRlci1zIiBpZD0iZW50ZXJTa2lwIiBzdHlsZT0icG9zaXRpb246YWJzb2x1dGU7cmlnaHQ6MTRweDtib3R0b206MThweDt6LWluZGV4OjIiPlNLSVA8L2J1dHRvbj5gfQogIDwvZGl2PmA7Cn0=") },
  { file: "public/index.html", count: 1,
    find: d("ICAgIHRyeXsgc2Vzc2lvblN0b3JhZ2Uuc2V0SXRlbSgidG5sLWVudGVyZWQiLCIxIikgfWNhdGNoe30="),
    replace: d("ICAgIC8qIGxvY2FsU3RvcmFnZSwgbm90IHNlc3Npb25TdG9yYWdlOiB0aGUgZmlsbSBpcyBhIG9uY2UtcGVyLWRldmljZQogICAgICAgbW9tZW50LCB3aGlsZSB0aGUgZG9vciBpdHNlbGYgcmV0dXJucyBldmVyeSBsb2FkIHRvIGNhcnJ5IHRoZSB0YXAuICovCiAgICB0cnl7IGxvY2FsU3RvcmFnZS5zZXRJdGVtKCJ0bmwtaW50cm8tc2VlbiIsIjEiKSB9Y2F0Y2goZSl7fQ==") },
];
