/* Patch 067 — the rooms read free. A logged-out visitor entering a lab
   got an empty room: loadFeed() bailed on guest(), loadLabs() bailed on
   !ME, and the server's /api/feed and /api/labs both demanded auth. No
   posts meant no images and no music chips — the guest half of the
   symptom 066 fixed for members.

   Labs are now readable without an account, in line with everything
   else being public: /api/feed and /api/labs go maybeAuth (the feed
   handler was already null-safe; the labs route skips the per-user
   unread query for guests), the client gates come off, and read
   markers stay account-only. Talking is still members-only — a guest
   hitting send gets the join door instead of a 401 toast, and the
   server would refuse anyway.

   Music for guests just works from there: the chip delegate and
   autoplay have no account gate, and the play-counter call fails
   silently for guests by design — a guest listen plays audio without
   counting a play.

   7 hunks: 4 client, 3 server. Runs after 066. */
const d = (s) => Buffer.from(s, "base64").toString("utf8");
export default [
  { count: 1,
    find: d("YXBwLmdldCgiL2FwaS9mZWVkIiwgYXV0aCwgKHJlcSwgcmVzKSA9PiB7"),
    replace: d("YXBwLmdldCgiL2FwaS9mZWVkIiwgbWF5YmVBdXRoLCAocmVxLCByZXMpID0+IHs=") },
  { count: 1,
    find: d("YXBwLmdldCgiL2FwaS9sYWJzIiwgYXV0aCwgKHJlcSwgcmVzKSA9PiB7"),
    replace: d("YXBwLmdldCgiL2FwaS9sYWJzIiwgbWF5YmVBdXRoLCAocmVxLCByZXMpID0+IHs=") },
  { count: 1,
    find: d("ICAvLyB1bnJlYWQsIHBlciBjaGFubmVsLCBmb3IgdGhpcyBwZXJzb24KICBjb25zdCB1bnJlYWQgPSB7fTsKICBmb3IgKGNvbnN0IHIgb2YgZGIucHJlcGFyZShgCiAgICBTRUxFQ1QgcC5jaGFubmVsLCBDT1VOVCgqKSBuIEZST00gcG9zdHMgcAogICAgTEVGVCBKT0lOIGNoYW5uZWxfcmVhZHMgY3IgT04gY3IudXNlcl9pZCA9ID8gQU5EIGNyLmNoYW5uZWwgPSBwLmNoYW5uZWwKICAgIFdIRVJFIHAuYXV0aG9yX2lkICE9ID8gQU5EIHAuY3JlYXRlZF9hdCA+IENPQUxFU0NFKGNyLmxhc3RfcmVhZF9hdCwgMCkKICAgIEdST1VQIEJZIHAuY2hhbm5lbGApLmFsbChyZXEudXNlci5pZCwgcmVxLnVzZXIuaWQpKSB1bnJlYWRbci5jaGFubmVsXSA9IHIubjs="),
    replace: d("ICAvLyB1bnJlYWQsIHBlciBjaGFubmVsLCBmb3IgdGhpcyBwZXJzb24g4oCUIGd1ZXN0cyBoYXZlIG5vIHJlYWQgc3RhdGUKICBjb25zdCB1bnJlYWQgPSB7fTsKICBpZiAocmVxLnVzZXIpIGZvciAoY29uc3QgciBvZiBkYi5wcmVwYXJlKGAKICAgIFNFTEVDVCBwLmNoYW5uZWwsIENPVU5UKCopIG4gRlJPTSBwb3N0cyBwCiAgICBMRUZUIEpPSU4gY2hhbm5lbF9yZWFkcyBjciBPTiBjci51c2VyX2lkID0gPyBBTkQgY3IuY2hhbm5lbCA9IHAuY2hhbm5lbAogICAgV0hFUkUgcC5hdXRob3JfaWQgIT0gPyBBTkQgcC5jcmVhdGVkX2F0ID4gQ09BTEVTQ0UoY3IubGFzdF9yZWFkX2F0LCAwKQogICAgR1JPVVAgQlkgcC5jaGFubmVsYCkuYWxsKHJlcS51c2VyLmlkLCByZXEudXNlci5pZCkpIHVucmVhZFtyLmNoYW5uZWxdID0gci5uOw==") },
  { file: "public/index.html", count: 1,
    find: d("ICBpZihndWVzdCgpKXJldHVybjs="),
    replace: d("ICAvKiBHdWVzdHMgcmVhZCB0aGUgcm9vbXMgdG9vIOKAlCB0aGUgd2hvbGUgYXBwIGlzIHB1YmxpYyBub3cuIFJlYWQgc3RhdGUKICAgICBpcyB0aGUgb25seSB0aGluZyB0aGF0IG5lZWRzIGFuIGFjY291bnQsIGFuZCBpdCdzIHNraXBwZWQgYmVsb3cuICov") },
  { file: "public/index.html", count: 1,
    find: d("ICBpZihVTlJFQURTW0NILmlkXSl7ZGVsZXRlIFVOUkVBRFNbQ0guaWRdO3BhaW50VW5yZWFkcygpfQogIHRyeXthd2FpdCBhcGkucmVhZENoYW5uZWwoQ0guaWQpfWNhdGNoKGUpe30="),
    replace: d("ICBpZihndWVzdCgpKXJldHVybjsgICAvLyByZWFkIG1hcmtlcnMgYXJlIHBlci1hY2NvdW50CiAgLy8gb3BlbmluZyBhIGNoYW5uZWwgY2xlYXJzIGl0cyBkb3QKICBpZihVTlJFQURTW0NILmlkXSl7ZGVsZXRlIFVOUkVBRFNbQ0guaWRdO3BhaW50VW5yZWFkcygpfQogIHRyeXthd2FpdCBhcGkucmVhZENoYW5uZWwoQ0guaWQpfWNhdGNoKGUpe30=") },
  { file: "public/index.html", count: 1,
    find: d("YXN5bmMgZnVuY3Rpb24gbG9hZExhYnMoKXsKICBpZighTUUpcmV0dXJuOw=="),
    replace: d("YXN5bmMgZnVuY3Rpb24gbG9hZExhYnMoKXs=") },
  { file: "public/index.html", count: 1,
    find: d("ICBjb25zdCBzZW5kYj0kKCIjc2VuZGIiKTtpZihzZW5kYil7Y29uc3QgZ289YXN5bmMoKT0+ewogICAgY29uc3QgdD0kKCIjZHJhZnQiKS52YWx1ZS50cmltKCk7"),
    replace: d("ICBjb25zdCBzZW5kYj0kKCIjc2VuZGIiKTtpZihzZW5kYil7Y29uc3QgZ289YXN5bmMoKT0+ewogICAgaWYoZ3Vlc3QoKSlyZXR1cm4gbmVlZEFjY291bnQoIkpvaW4gdG8gdGFsayBpbiB0aGUgcm9vbXMg4oCUIHJlYWRpbmcgaXMgZnJlZS4iKTsKICAgIGNvbnN0IHQ9JCgiI2RyYWZ0IikudmFsdWUudHJpbSgpOw==") },
];
