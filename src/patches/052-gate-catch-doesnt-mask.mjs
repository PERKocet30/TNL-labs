/* Patch 052 — the gate catch can't draw on a body that's gone.
   Register success sets GATE=null and calls render(); #gatebody no longer
   exists. If anything in that block throws AFTER that point, the catch
   called draw(), draw() did body().innerHTML on null, and the second crash
   buried the first (Sentry TNL-LABS-APP-2 is the mask, not the cause).
   Now: if the gate is gone, toast and RE-THROW so Sentry gets the real
   error on the next occurrence. Client-only, one hunk. Runs after 051. */
const d = (s) => Buffer.from(s, "base64").toString("utf8");
export default [
  { file: "public/index.html", count: 1,
    find: d("ICAgICAgfWNhdGNoKGUpe2Vycj1lLm1lc3NhZ2U7ZHJhdygpfX07CiAgfQogIGRyYXcoKTsKfQ=="),
    replace: d("ICAgICAgfWNhdGNoKGUpewogICAgICAgIC8qIE9uY2UgR0FURT1udWxsIGFuZCByZW5kZXIoKSByYW4sICNnYXRlYm9keSBpcyBnb25lLiBUaGUgb2xkIGNhdGNoCiAgICAgICAgICAgY2FsbGVkIGRyYXcoKSBhbnl3YXksIGRpZWQgb24gYm9keSgpLmlubmVySFRNTCBvZiBudWxsLCBhbmQgYnVyaWVkCiAgICAgICAgICAgd2hhdGV2ZXIgYWN0dWFsbHkgdGhyZXcuIElmIHRoZSBnYXRlJ3MgZ29uZSwgc3VyZmFjZSB0aGUgdHJ1dGguICovCiAgICAgICAgaWYoIWJvZHkoKSl7dHJ5e3RvYXN0KCJTb21ldGhpbmcgYnJva2Ug4oCUIHJlbG9hZCB0aGUgcGFnZSIpfWNhdGNoe310aHJvdyBlfQogICAgICAgIGVycj1lLm1lc3NhZ2U7ZHJhdygpfX07CiAgfQogIGRyYXcoKTsKfQ==") },
];
