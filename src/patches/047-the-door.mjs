/* Patch 047 — the door. ENTER THE LAB.

   This is not decoration. iOS will not start audio without a deliberate user
   gesture, which is why music has never played on load and never could. The
   old tnllabs.com solved it years ago with an enter button: one tap plays the
   animation AND unlocks sound for the rest of the session. 023 already primes
   a silent WAV on "first tap anywhere" — this gives that a door to live on.

   Shown to guests only, once per browser session (sessionStorage). Members
   never see it.

   THE ONE RULE that makes it work: audioEl().play() is called SYNCHRONOUSLY
   inside the click handler. Put an await, a fetch or a fade before it and iOS
   stops counting it as a gesture — the unlock silently fails and you are back
   where you started.

   Every failure ends in done(), never in a locked screen:
     - video missing from the repo  -> onerror   -> done()
     - playback refused             -> play().catch -> done()
     - network stalls               -> onstalled -> done()
     - anything unforeseen          -> 20s setTimeout -> done()
     - SKIP button, always visible  -> done()
   done() is idempotent via a gone flag, so double-fires are harmless.

   NEEDS TWO FILES IN public/ THAT THIS PATCH CANNOT CARRY (binaries do not
   survive the text connector — upload them through GitHub web):
     public/tnl-enter.mp4         2.55MB, 720p, +faststart
     public/tnl-enter-poster.jpg  5KB
   Until they exist the splash still works — black ground, mark, ENTER, and
   onerror dismisses straight through to the app.

   TO REMOVE ENTIRELY: delete this file. Nothing else references it.

   Client-only, four hunks. Runs after 046. */
const d = (s) => Buffer.from(s, "base64").toString("utf8");
export default [
  { file: "public/index.html", count: 1,
    find: d("Y29uc3QgZ3Vlc3Q9KCk9PiFNRTs="),
    replace: d("Y29uc3QgZ3Vlc3Q9KCk9PiFNRTsKLyogVGhlIGRvb3IuIEl0cyByZWFsIGpvYiBpcyBub3QgZGVjb3JhdGlvbjogYSBkZWxpYmVyYXRlIHRhcCBpcyB0aGUgT05MWQogICB0aGluZyBpT1MgYWNjZXB0cyBhcyBwZXJtaXNzaW9uIHRvIHN0YXJ0IGF1ZGlvLCBzbyBFTlRFUiBpcyB3aGVyZSBzb3VuZAogICBnZXRzIHVubG9ja2VkIGZvciB0aGUgc2Vzc2lvbi4gMDIzIHByaW1lcyBhIHNpbGVudCBXQVYgb24gImZpcnN0IHRhcAogICBhbnl3aGVyZSIgcHJlY2lzZWx5IGJlY2F1c2UgdGhlcmUgd2FzIG5vIGRvb3IgdG8gaGFuZyB0aGlzIG9uLgogICBHdWVzdHMgb25seSwgb25jZSBwZXIgYnJvd3NlciBzZXNzaW9uLCBhbmQgZXZlcnkgZXhpdCBwYXRoIGlzIGd1YXJkZWQuICovCmxldCBFTlRFUiA9IGZhbHNlOwp0cnkgeyBFTlRFUiA9ICFNRSAmJiAhc2Vzc2lvblN0b3JhZ2UuZ2V0SXRlbSgidG5sLWVudGVyZWQiKTsgfSBjYXRjaCB7IEVOVEVSID0gZmFsc2U7IH0=") },
  { file: "public/index.html", count: 1,
    find: d("LmxpZ2h0Ym94ew=="),
    replace: d("LmVudGVye3Bvc2l0aW9uOmZpeGVkO2luc2V0OjA7ei1pbmRleDo0MDA7YmFja2dyb3VuZDojMDAwO2Rpc3BsYXk6ZmxleDthbGlnbi1pdGVtczpjZW50ZXI7anVzdGlmeS1jb250ZW50OmNlbnRlcn0KLmVudGVyLXZ7cG9zaXRpb246YWJzb2x1dGU7aW5zZXQ6MDt3aWR0aDoxMDAlO2hlaWdodDoxMDAlO29iamVjdC1maXQ6Y292ZXJ9Ci5lbnRlci1je3Bvc2l0aW9uOnJlbGF0aXZlO3otaW5kZXg6MTtkaXNwbGF5OmZsZXg7ZmxleC1kaXJlY3Rpb246Y29sdW1uO2FsaWduLWl0ZW1zOmNlbnRlcjtnYXA6MjBweDtwYWRkaW5nOjAgMjRweDt0ZXh0LWFsaWduOmNlbnRlcn0KLmVudGVyLW17aGVpZ2h0OjUycHg7d2lkdGg6YXV0b30KLmVudGVyLWJ7YmFja2dyb3VuZDojZmZmO2NvbG9yOiMwMDA7Ym9yZGVyOjA7Ym9yZGVyLXJhZGl1czo5OTlweDtwYWRkaW5nOjE1cHggMzJweDtmb250LXdlaWdodDo5MDA7Zm9udC1zaXplOjE1cHg7bGV0dGVyLXNwYWNpbmc6LjA1ZW07Y3Vyc29yOnBvaW50ZXJ9Ci5lbnRlci1iOmFjdGl2ZXt0cmFuc2Zvcm06c2NhbGUoLjk3KX0KLmVudGVyLXN7YmFja2dyb3VuZDpub25lO2JvcmRlcjowO2NvbG9yOnJnYmEoMjU1LDI1NSwyNTUsLjU1KTtmb250LWZhbWlseTonSUJNIFBsZXggTW9ubycsbW9ub3NwYWNlO2ZvbnQtc2l6ZToxMC41cHg7bGV0dGVyLXNwYWNpbmc6LjFlbTtwYWRkaW5nOjhweCAxMnB4O2N1cnNvcjpwb2ludGVyfQoubGlnaHRib3h7") },
  { file: "public/index.html", count: 1,
    find: d("ZnVuY3Rpb24gbmF2SFRNTCgpew=="),
    replace: d("LyogTWlzc2luZyB2aWRlbywgYmxvY2tlZCBwbGF5YmFjaywgYSBzdGFsbGVkIG5ldHdvcmsg4oCUIGV2ZXJ5IG9uZSBvZiB0aG9zZQogICBlbmRzIGluIGRvbmUoKSwgbmV2ZXIgaW4gYSBsb2NrZWQgc2NyZWVuLiBUaGUgMjBzIHRpbWVyIGlzIHRoZSBsYXN0IHJlc29ydC4gKi8KZnVuY3Rpb24gZW50ZXJIVE1MKCl7CiAgY29uc3QgbWFyayA9IChkb2N1bWVudC5xdWVyeVNlbGVjdG9yKCIubWFyayIpfHx7fSkuc3JjIHx8ICIiOwogIHJldHVybiBgPGRpdiBjbGFzcz0iZW50ZXIiIGlkPSJlbnRlck92Ij4KICAgIDx2aWRlbyBjbGFzcz0iZW50ZXItdiIgaWQ9ImVudGVyVmlkIiBwbGF5c2lubGluZSBwcmVsb2FkPSJtZXRhZGF0YSIKICAgICAgcG9zdGVyPSIvdG5sLWVudGVyLXBvc3Rlci5qcGciIHNyYz0iL3RubC1lbnRlci5tcDQiPjwvdmlkZW8+CiAgICA8ZGl2IGNsYXNzPSJlbnRlci1jIiBpZD0iZW50ZXJDIj4KICAgICAgJHttYXJrP2A8aW1nIGNsYXNzPSJlbnRlci1tIiBzcmM9IiR7bWFya30iIGFsdD0iVE5MIj5gOiIifQogICAgICA8YnV0dG9uIGNsYXNzPSJlbnRlci1iIiBpZD0iZW50ZXJCdG4iPkVOVEVSIFRIRSBMQUI8L2J1dHRvbj4KICAgIDwvZGl2PgogICAgPGJ1dHRvbiBjbGFzcz0iZW50ZXItcyIgaWQ9ImVudGVyU2tpcCIgc3R5bGU9InBvc2l0aW9uOmFic29sdXRlO3JpZ2h0OjE0cHg7Ym90dG9tOjE4cHg7ei1pbmRleDoyIj5TS0lQPC9idXR0b24+CiAgPC9kaXY+YDsKfQoKZnVuY3Rpb24gd2lyZUVudGVyKCl7CiAgaWYoIUVOVEVSKXJldHVybjsKICBjb25zdCBvdj0kKCIjZW50ZXJPdiIpOyBpZighb3YpcmV0dXJuOwogIGNvbnN0IHY9JCgiI2VudGVyVmlkIiksIGM9JCgiI2VudGVyQyIpOwogIGxldCBnb25lPWZhbHNlOwogIGNvbnN0IGRvbmU9KCk9PnsKICAgIGlmKGdvbmUpcmV0dXJuOyBnb25lPXRydWU7CiAgICB0cnl7IHNlc3Npb25TdG9yYWdlLnNldEl0ZW0oInRubC1lbnRlcmVkIiwiMSIpIH1jYXRjaHt9CiAgICBFTlRFUj1mYWxzZTsgcmVuZGVyKCk7CiAgfTsKICBjb25zdCBnbz0oKT0+ewogICAgLyogU3luY2hyb25vdXMgaW5zaWRlIHRoZSBnZXN0dXJlLiBBbiBhd2FpdCBoZXJlIGFuZCBpT1Mgc3RvcHMgY291bnRpbmcKICAgICAgIHRoaXMgYXMgYSB0YXAsIHdoaWNoIGlzIHRoZSB3aG9sZSByZWFzb24gdGhlIGRvb3IgZXhpc3RzLiAqLwogICAgdHJ5ewogICAgICBjb25zdCBhPWF1ZGlvRWwoKTsKICAgICAgYS5zcmM9ImRhdGE6YXVkaW8vd2F2O2Jhc2U2NCxVa2xHUmlRQUFBQlhRVlpGWm0xMElCQUFBQUFCQUFFQWdENEFBQUI5QUFBQ0FCQUFaR0YwWVFBQUFBQT0iOwogICAgICBhLnBsYXkoKS5jYXRjaCgoKT0+e30pOwogICAgICBNVVNPSz10cnVlOyBNVVNQUklNRUQ9dHJ1ZTsKICAgIH1jYXRjaHt9CiAgICBpZih2KXsKICAgICAgdi5tdXRlZD1mYWxzZTsKICAgICAgY29uc3QgcD12LnBsYXkoKTsKICAgICAgaWYocCYmcC5jYXRjaClwLmNhdGNoKGRvbmUpOwogICAgICBpZihjKWMuc3R5bGUuZGlzcGxheT0ibm9uZSI7CiAgICB9IGVsc2UgZG9uZSgpOwogIH07CiAgJCgiI2VudGVyQnRuIikub25jbGljaz1nbzsKICAkKCIjZW50ZXJTa2lwIikub25jbGljaz1kb25lOwogIGlmKHYpeyB2Lm9uZW5kZWQ9ZG9uZTsgdi5vbmVycm9yPWRvbmU7IHYub25zdGFsbGVkPWRvbmU7IH0KICBzZXRUaW1lb3V0KGRvbmUsMjAwMDApOwp9CgpmdW5jdGlvbiBuYXZIVE1MKCl7") },
  { file: "public/index.html", count: 1,
    find: d("ICAgICR7VE9BU1RUP2A8ZGl2IGNsYXNzPSJ0b2FzdCI+JHtlc2MoVE9BU1RUKX08L2Rpdj5gOiIifWA7CiAgd2lyZSgpOw=="),
    replace: d("ICAgICR7VE9BU1RUP2A8ZGl2IGNsYXNzPSJ0b2FzdCI+JHtlc2MoVE9BU1RUKX08L2Rpdj5gOiIifQogICAgJHtFTlRFUj9lbnRlckhUTUwoKToiIn1gOwogIHdpcmUoKTsKICB3aXJlRW50ZXIoKTs=") },
];
