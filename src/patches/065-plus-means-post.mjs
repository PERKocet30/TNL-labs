/* Patch 065 — ＋ means post, everywhere. The nav ＋ used to mean "sell"
   while the Market tab was open, so tapping it dropped you into the
   sell-an-item form. One button, one meaning: it opens the post
   composer on every tab. The Market keeps its own ＋ Sell button in the
   shop header, so selling is still one tap from where selling lives.

   1 hunk, client. Runs after 064. */
const d = (s) => Buffer.from(s, "base64").toString("utf8");
export default [
  { file: "public/index.html", count: 1,
    find: d("ICAgICAgLyogT25lIO+8iyBmb3IgdGhlIHdob2xlIGFwcC4gSW4gdGhlIE1hcmtldCBpdCBtZWFucyBzZWxsOyBldmVyeXdoZXJlCiAgICAgICAgIGVsc2UgaXQgbWVhbnMgcG9zdCDigJQgc2FtZSBpbnN0aW5jdCBhcyBJbnN0YWdyYW0ncyBjZW50ZXIgYnV0dG9uLiAqLwogICAgICBpZihndWVzdCgpKXJldHVybiBuZWVkQWNjb3VudCgiSm9pbiB0byBwb3N0IHlvdXIgd29yayDigJQgaXQgbGFuZHMgb24geW91ciBwcm9maWxlIGFuZCB0aGUgU2hvd3Jvb20uIik7CiAgICAgIGlmKFRBQj09PSJtYXJrZXQiKXtNS1RWSUVXPSJzZWxsIjtTRUxMRk9STT1udWxsO3JlbmRlcigpO3JldHVybn0KICAgICAgUENPTVBPU0U9e2JvZHk6IiIsaW1nczpbXSxidXN5OmZhbHNlfTtwdXNoVmlldygiY29tcG9zZSIpO3JlbmRlcigpO3JldHVybjs="),
    replace: d("ICAgICAgLyog77yLIG1lYW5zIFBPU1QsIG9uIGV2ZXJ5IHRhYiDigJQgdGhlIE1hcmtldCBpbmNsdWRlZC4gSXQgdXNlZCB0byBmbGlwCiAgICAgICAgIHRvIHRoZSBzZWxsIGZvcm0gdGhlcmUsIHdoaWNoIHJlYWQgYXMgdGhlIGFwcCBjaGFuZ2luZyBpdHMgbWluZAogICAgICAgICBhYm91dCB3aGF0IHRoZSBidXR0b24gaXMuIFNlbGxpbmcga2VlcHMgaXRzIG93biDvvIsgU2VsbCBidXR0b24gaW4KICAgICAgICAgdGhlIE1hcmtldCBoZWFkZXI7IHRoZSBuYXYg77yLIGRvZXMgb25lIHRoaW5nIGV2ZXJ5d2hlcmUuICovCiAgICAgIGlmKGd1ZXN0KCkpcmV0dXJuIG5lZWRBY2NvdW50KCJKb2luIHRvIHBvc3Qg4oCUIGl0IGxhbmRzIG9uIHlvdXIgcHJvZmlsZSBhbmQgdGhlIFNob3dyb29tLiIpOwogICAgICBQQ09NUE9TRT17Ym9keToiIixpbWdzOltdLGJ1c3k6ZmFsc2V9O3B1c2hWaWV3KCJjb21wb3NlIik7cmVuZGVyKCk7cmV0dXJuOw==") },
];
