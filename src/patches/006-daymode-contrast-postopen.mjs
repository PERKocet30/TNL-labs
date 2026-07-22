/* Patch 006 — day-mode contrast fixes and profile post behaviour.
   Found by looking at day mode on a real phone, which is the one check
   contrast maths can't do for you.
   - Every selected state was background:var(--tx) with a hardcoded black
     label. Night: white pill, black text. Day: --tx IS black, so pill and
     label were both black — role chips, the WORK tab and Unpublish were
     unreadable. var(--bg) is the partner that inverts with var(--tx).
   - Same fault on accent fills, where day deepens the accent.
   - SOLD sits on a dark scrim in both themes, so it's pinned to white.
   - The profile sheet re-injected the raw accent as an inline --green,
     overriding applyAccent's contrast correction. Now goes through inkFor.
   - Tapping your own work threw you into the lab channel and closed the
     profile. It now expands in place, the way the feed and Showroom do.
   Hunks are base64 (emoji + template literals travel safely). */
const d = (s) => Buffer.from(s, "base64").toString("utf8");
export default [
  { file: "public/index.html", count: 12,
    find: d("YmFja2dyb3VuZDp2YXIoLS10eCk7Y29sb3I6IzAwMA=="),
    replace: d("YmFja2dyb3VuZDp2YXIoLS10eCk7Y29sb3I6dmFyKC0tYmcp") },
  { file: "public/index.html", count: 18,
    find: d("YmFja2dyb3VuZDp2YXIoLS1ncmVlbik7Y29sb3I6IzAwMA=="),
    replace: d("YmFja2dyb3VuZDp2YXIoLS1ncmVlbik7Y29sb3I6dmFyKC0tYmcp") },
  { file: "public/index.html", count: 1,
    find: d("LnNvbGR0YWd7cG9zaXRpb246YWJzb2x1dGU7aW5zZXQ6MDtiYWNrZ3JvdW5kOnJnYmEoMCwwLDAsLjcyKTtkaXNwbGF5OmZsZXg7YWxpZ24taXRlbXM6Y2VudGVyO2p1c3RpZnktY29udGVudDpjZW50ZXI7Zm9udC1mYW1pbHk6J0lCTSBQbGV4IE1vbm8nLG1vbm9zcGFjZTtmb250LXNpemU6MTJweDtsZXR0ZXItc3BhY2luZzouMmVtfQ=="),
    replace: d("LnNvbGR0YWd7cG9zaXRpb246YWJzb2x1dGU7aW5zZXQ6MDtiYWNrZ3JvdW5kOnJnYmEoMCwwLDAsLjcyKTtjb2xvcjojZmZmO2Rpc3BsYXk6ZmxleDthbGlnbi1pdGVtczpjZW50ZXI7anVzdGlmeS1jb250ZW50OmNlbnRlcjtmb250LWZhbWlseTonSUJNIFBsZXggTW9ubycsbW9ub3NwYWNlO2ZvbnQtc2l6ZToxMnB4O2xldHRlci1zcGFjaW5nOi4yZW19") },
  { file: "public/index.html", count: 1,
    find: d("ICBjb25zdCBhY2M9dS5hY2NlbnRIZXh8fCIjMjJDNTVFIjs="),
    replace: d("ICBjb25zdCBhY2M9aW5rRm9yKHUuYWNjZW50SGV4fHwiIzIyQzU1RSIpOyAgIC8vIG5ldmVyIGJ5cGFzcyB0aGUgdGhlbWUgY29ycmVjdGlvbg==") },
  { file: "public/index.html", count: 1,
    find: d("ICAgICAgPHNwYW4gY2xhc3M9ImRpbSIgc3R5bGU9Im1hcmdpbi1sZWZ0OmF1dG8iPiR7bmV3IERhdGUocC5jcmVhdGVkQXQpLnRvTG9jYWxlRGF0ZVN0cmluZygpfTwvc3Bhbj4KICAgICAgPGJ1dHRvbiBjbGFzcz0id29yay1zaGFyZSIgZGF0YS1zaGFyZT0iJHtwLmlkfSIgdGl0bGU9IlNoYXJlIj7ihpc8L2J1dHRvbj48L2Rpdj4KICA8L2Rpdj5gOwp9"),
    replace: d("ICAgICAgPHNwYW4gY2xhc3M9ImRpbSIgc3R5bGU9Im1hcmdpbi1sZWZ0OmF1dG8iPiR7bmV3IERhdGUocC5jcmVhdGVkQXQpLnRvTG9jYWxlRGF0ZVN0cmluZygpfTwvc3Bhbj4KICAgICAgPGJ1dHRvbiBjbGFzcz0id29yay1zaGFyZSIgZGF0YS1zaGFyZT0iJHtwLmlkfSIgdGl0bGU9IlNoYXJlIj7ihpc8L2J1dHRvbj48L2Rpdj4KICAgICR7T1BFTkNPTU1FTlRTPT09cC5pZD9jb21tZW50c0hUTUwocCk6IiJ9CiAgPC9kaXY+YDsKfQ==") },
  { file: "public/index.html", count: 1,
    find: d("ICBkb2N1bWVudC5xdWVyeVNlbGVjdG9yQWxsKCJbZGF0YS1vcGVucG9zdF0iKS5mb3JFYWNoKGVsPT5lbC5vbmNsaWNrPSgpPT57CiAgICBjb25zdCBwPVsuLi5QUk9GSUxFLnBvc3RzLC4uLlBST0ZJTEUuY29sbGFic10uZmluZCh4PT5TdHJpbmcoeC5pZCk9PT1lbC5kYXRhc2V0Lm9wZW5wb3N0KTsKICAgIGlmKCFwKXJldHVybjsKICAgIGZvcihjb25zdCBsIG9mIExBQlMpe2NvbnN0IGM9bC5jaGFubmVscy5maW5kKHg9PnguaWQ9PT1wLmNoYW5uZWwpO2lmKGMpe0xBQj1sO0NIPWM7VEFCPSJsYWJzIjtST09NT1BFTj10cnVlO1BST0ZJTEU9bnVsbDtyZW5kZXIoKTtyZXR1cm59fQogICAgdG9hc3QoIlRoYXQgY2hhbm5lbCBpc24ndCBpbiB5b3VyIGxhYnMgbGlzdCIpOwogIH0pOw=="),
    replace: d("ICBkb2N1bWVudC5xdWVyeVNlbGVjdG9yQWxsKCJbZGF0YS1vcGVucG9zdF0iKS5mb3JFYWNoKGVsPT5lbC5vbmNsaWNrPWFzeW5jKGUpPT57CiAgICBpZihlLnRhcmdldC5jbG9zZXN0KCJidXR0b24sYSx2aWRlbyxpbnB1dCx0ZXh0YXJlYSIpKXJldHVybjsgICAvLyBsZXQgdGhlIGNhcmQncyBvd24gY29udHJvbHMgd29yawogICAgY29uc3QgaWQ9TnVtYmVyKGVsLmRhdGFzZXQub3BlbnBvc3QpOwogICAgaWYoT1BFTkNPTU1FTlRTPT09aWQpe09QRU5DT01NRU5UUz1udWxsO3JlbmRlcigpO3JldHVybn0gICAgICAgIC8vIHRhcCBhZ2FpbiB0byBjbG9zZQogICAgT1BFTkNPTU1FTlRTPWlkO0NPTU1FTlRTPVtdO3JlbmRlcigpOwogICAgdHJ5e0NPTU1FTlRTPShhd2FpdCBhcGkuY29tbWVudHMoaWQpKS5jb21tZW50cztyZW5kZXIoKX1jYXRjaChlcnIpe30KICB9KTs=") },
];
