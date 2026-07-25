/* Patch 053 — a video tile you can actually tap.
   030 reduced the profile tile to image-only but left the video branch
   rendering a real <video preload="none"> with no poster. Two failures from
   one element: it painted an empty box (nothing is loaded, so there is no
   frame to show), and on iOS the media element absorbed the tap rather than
   letting it bubble to .work[data-openpost] — so the post could not be
   opened from the profile at all. Photos were unaffected, which is why only
   the video looked broken.
   Now a styled placeholder div, plus a rule making every child of .work
   non-interactive so no future child can steal the tap the same way.
   Real poster frames generated at upload time are the proper fix and are
   deliberately NOT in this patch — that touches the upload path and writes
   new files to the volume. Client-only, two hunks. Runs after 052. */
const d = (s) => Buffer.from(s, "base64").toString("utf8");
export default [
  { file: "public/index.html", count: 1,
    find: d("ICAgICAgOiBwLnZpZGVvVXJsID8gYDx2aWRlbyBjbGFzcz0id29yay1pbWciIHNyYz0iJHtlc2MocC52aWRlb1VybCl9IiBtdXRlZCBwbGF5c2lubGluZSBwcmVsb2FkPSJub25lIj48L3ZpZGVvPmA="),
    replace: d("ICAgICAgLyogTk9UIGEgPHZpZGVvPi4gV2l0aCBwcmVsb2FkPSJub25lIiBhbmQgbm8gcG9zdGVyIHRoZSBlbGVtZW50IHJlbmRlcnMKICAgICAgICAgZW1wdHkgQU5ELCBvbiBpT1MsIHN3YWxsb3dzIHRoZSB0YXAgaW5zdGVhZCBvZiBsZXR0aW5nIGl0IGJ1YmJsZSB0bwogICAgICAgICAud29ya1tkYXRhLW9wZW5wb3N0XSDigJQgc28gdGhlIHRpbGUgbG9va2VkIGJsYW5rIGFuZCBjb3VsZCBub3QgYmUKICAgICAgICAgb3BlbmVkIGF0IGFsbC4gQSB0aWxlIG9ubHkgZXZlciBuZWVkcyB0byBsb29rIGxpa2Ugc29tZXRoaW5nIGFuZCBiZQogICAgICAgICB0YXBwYWJsZTsgdGhlIHJlYWwgcGxheWVyIGxpdmVzIGluIHRoZSBleHBhbmRlZCBwb3N0LiBSZXBsYWNlIHdpdGggYQogICAgICAgICBwbGFpbiBkaXYgdW50aWwgdmlkZW9zIGdldCByZWFsIHBvc3RlciBmcmFtZXMgZ2VuZXJhdGVkIGF0IHVwbG9hZC4gKi8KICAgICAgOiBwLnZpZGVvVXJsID8gYDxkaXYgY2xhc3M9IndvcmstdmlkIiBhcmlhLWxhYmVsPSJWaWRlbyI+PC9kaXY+YA==") },
  { file: "public/index.html", count: 1,
    find: d("LndvcmstaW5ke3Bvc2l0aW9uOmFic29sdXRlO3RvcDoxMXB4O3JpZ2h0OjExcHg7Y29sb3I6I2ZmZjtmb250LXNpemU6MTJweDtsaW5lLWhlaWdodDoxO3RleHQtc2hhZG93OjAgMXB4IDRweCByZ2JhKDAsMCwwLC42KTtwb2ludGVyLWV2ZW50czpub25lfQ=="),
    replace: d("LndvcmstaW5ke3Bvc2l0aW9uOmFic29sdXRlO3RvcDoxMXB4O3JpZ2h0OjExcHg7Y29sb3I6I2ZmZjtmb250LXNpemU6MTJweDtsaW5lLWhlaWdodDoxO3RleHQtc2hhZG93OjAgMXB4IDRweCByZ2JhKDAsMCwwLC42KTtwb2ludGVyLWV2ZW50czpub25lfQovKiBOb3RoaW5nIGluc2lkZSBhIHRpbGUgaXMgaW50ZXJhY3RpdmUg4oCUIHRoZSB0aWxlIGl0c2VsZiBpcyB0aGUgYnV0dG9uLiAqLwoud29yaz4qe3BvaW50ZXItZXZlbnRzOm5vbmV9Ci53b3JrLXZpZHt3aWR0aDoxMDAlO2FzcGVjdC1yYXRpbzoxO2JvcmRlci1yYWRpdXM6N3B4O2JhY2tncm91bmQ6bGluZWFyLWdyYWRpZW50KDE2MGRlZywjMmEyYTJlLCMxNDE0MTYpO2Rpc3BsYXk6YmxvY2t9") },
];
