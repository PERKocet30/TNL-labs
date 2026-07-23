/* Patch 032 — fixes 031, which was a no-op. 031 gated the page layout on
   TAB==="profile", but nothing in the app ever sets TAB to that: the nav's
   profile button calls openProfile(myName()) and leaves TAB wherever it was,
   and the nav highlights itself off PROFILE.user.username===ME.username
   instead. sheetHTML already computes exactly that as `mine`, so the page
   layout now keys on it: your own profile is a page, anyone else's is still a
   sheet you peek into and dismiss. Client-only. Runs after 031. */
const d = (s) => Buffer.from(s, "base64").toString("utf8");
export default [
  { file: "public/index.html", count: 1,
    find: d("ICBjb25zdCBhc3RhYiA9IFRBQj09PSJwcm9maWxlIjs="),
    replace: d("ICAvKiBDb3JyZWN0ZWQgaW4gMDMyOiBUQUIgaXMgbmV2ZXIgc2V0IHRvICJwcm9maWxlIiDigJQgdGhlIG5hdiBidXR0b24gY2FsbHMKICAgICBvcGVuUHJvZmlsZShteU5hbWUoKSkgYW5kIGxlYXZlcyBUQUIgYWxvbmUsIHNvIHRoZSBvbGQgdGVzdCB3YXMgYWx3YXlzCiAgICAgZmFsc2UuIFlvdXIgb3duIHByb2ZpbGUgaXMgdGhlIHBhZ2U7IGFueW9uZSBlbHNlJ3Mgc3RheXMgYSBwZWVrLiAqLwogIGNvbnN0IGFzdGFiID0gbWluZTs=") },
];
