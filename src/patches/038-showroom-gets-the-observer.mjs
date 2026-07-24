/* Patch 038 — autoplay only ever worked where render() repainted.

   wireMusAuto() lives in the wire() chain, which runs after render(). But the
   Showroom and the lab room feed do not repaint through render(): both fetch,
   write cards straight into #sr-grid / #feed with innerHTML, and then call
   wireFeed(). See loadShowroom() and renderRoomFeed().

   wireFeed() already carries wireVideos() — the video autoplay observer —
   precisely because it "must run after every feed repaint". wireMusAuto() is
   the same kind of thing and was missing, so after those surfaces painted, the
   IntersectionObserver was still holding the previous, now-detached cards. The
   new .sr-card elements were never observed and no sound ever started.

   That is why autoplay behaved in the feed and not in the Showroom.

   Fix is one line: the sound observer travels with the video one. wire() still
   calls wireMusAuto() afterwards; it disconnects and rebuilds at the top, so
   the second call is a no-op rather than a conflict.

   Client-only. Runs after 037. */
const d = (s) => Buffer.from(s, "base64").toString("utf8");
export default [
  { file: "public/index.html", count: 1,
    find: d("ZnVuY3Rpb24gd2lyZUZlZWQoKXsKICB3aXJlVmlkZW9zKCk7ICAgLy8gYXV0b3BsYXkgaW4gdmlldyDigJQgbXVzdCBydW4gYWZ0ZXIgZXZlcnkgZmVlZCByZXBhaW50CiAgd2lyZUNhcm9zKCk7"),
    replace: d("ZnVuY3Rpb24gd2lyZUZlZWQoKXsKICB3aXJlVmlkZW9zKCk7ICAgLy8gYXV0b3BsYXkgaW4gdmlldyDigJQgbXVzdCBydW4gYWZ0ZXIgZXZlcnkgZmVlZCByZXBhaW50CiAgLyogVGhlIHNvdW5kIG9ic2VydmVyIHRyYXZlbHMgd2l0aCB0aGUgdmlkZW8gb25lLiBTaG93cm9vbSBhbmQgdGhlIHJvb20gZmVlZAogICAgIHBhaW50IHN0cmFpZ2h0IGludG8gI3NyLWdyaWQgLyAjZmVlZCBhbmQgY2FsbCB3aXJlRmVlZCgpIFdJVEhPVVQgZ29pbmcKICAgICB0aHJvdWdoIHJlbmRlcigpLCBzbyB3aXJlTXVzQXV0bygpIGluIHRoZSB3aXJlKCkgY2hhaW4gbmV2ZXIgc2F3IHRob3NlCiAgICAgY2FyZHMgYW5kIGF1dG9wbGF5IG9ubHkgZXZlciB3b3JrZWQgaW4gc3VyZmFjZXMgcmVuZGVyKCkgcmVwYWludGVkLiAqLwogIHdpcmVNdXNBdXRvKCk7CiAgd2lyZUNhcm9zKCk7") },
];
