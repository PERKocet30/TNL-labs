/* Patch 074 — wire what rendered. 073's repeat-visit door omits the SKIP
   button (the film is once-per-device; afterwards the door is just ENTER),
   but wireEnter still ran $("#enterSkip").onclick=done unconditionally.
   On every load after the intro had been seen, that lookup returned null,
   the assignment threw, and the boot died on the error screen:

     null is not an object (evaluating '$("#enterSkip").onclick=done')

   First visits worked, which is why it passed the first-run check and
   failed the second. Both button lookups are now null-guarded. This is
   the entire patch — one wiring block, no behaviour change for anyone
   who sees the buttons.

   1 hunk, client. Runs after 073. */
const d = (s) => Buffer.from(s, "base64").toString("utf8");
export default [
  { file: "public/index.html", count: 1,
    find: d("ICAkKCIjZW50ZXJCdG4iKS5vbmNsaWNrPWdvOwogICQoIiNlbnRlclNraXAiKS5vbmNsaWNrPWRvbmU7"),
    replace: d("ICBjb25zdCBlYj0kKCIjZW50ZXJCdG4iKTsgaWYoZWIpZWIub25jbGljaz1nbzsKICAvKiAwNzMgcmVtb3ZlZCBTS0lQIGZyb20gdGhlIHJlcGVhdC12aXNpdCBkb29yIGJ1dCBsZWZ0IHRoaXMgd2lyaW5nCiAgICAgdW5jb25kaXRpb25hbCDigJQgJCgiI2VudGVyU2tpcCIpIHdhcyBudWxsIG9uIGV2ZXJ5IHZpc2l0IGFmdGVyIHRoZQogICAgIGZpcnN0LCBhbmQgdGhlIHJlc3VsdGluZyBUeXBlRXJyb3Iga2lsbGVkIHRoZSB3aG9sZSBib290LiBCb3RoCiAgICAgbG9va3VwcyBhcmUgZ3VhcmRlZCBub3c7IGEgZG9vciBlbGVtZW50IHRoYXQgaXNuJ3QgcmVuZGVyZWQgaXMgYQogICAgIGRvb3IgZWxlbWVudCB0aGF0IGRvZXNuJ3QgZ2V0IHdpcmVkLiAqLwogIGNvbnN0IGVzPSQoIiNlbnRlclNraXAiKTsgaWYoZXMpZXMub25jbGljaz1kb25lOw==") },
];
