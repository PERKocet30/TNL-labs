/* Patch 054 — the download tells the truth about the server.
   /api/admin/source shipped a hardcoded include list written before the
   patch system existed. It exported src/server.js — the pristine monolith —
   while the process actually answering requests was src/server.runtime.js,
   built at boot from that monolith plus src/patches/*.mjs. So every download
   was ~10KB short of the running server and contained none of the applied
   server hunks, under a comment claiming the deployed app is always the
   source of truth. index.html and db.js were unaffected: those are patched
   in place, so the live file and the exported file are the same object.

   Now the zip carries build.mjs, server.runtime.js, and every patch, which
   means a download can be rebuilt and byte-compared rather than trusted.
   readdirSync is already imported (see the node:fs line) and join is already
   in scope in this handler. Server-only, one hunk. Runs after 053. */
const d = (s) => Buffer.from(s, "base64").toString("utf8");
export default [
  { file: "src/server.js", count: 1,
    find: d("ICBjb25zdCBpbmNsdWRlID0gWwogICAgInNyYy9zZXJ2ZXIuanMiLCAic3JjL2RiLmpzIiwgInNyYy9wYXkuanMiLCAic3JjL21haWwuanMiLCAic3JjL3NlZWQuanMiLAogICAgInB1YmxpYy9pbmRleC5odG1sIiwgInB1YmxpYy9zdHVkaW8uanMiLCAicHVibGljL2FkbWluLmh0bWwiLCAicHVibGljL3N3LmpzIiwKICAgICJwdWJsaWMvbWFuaWZlc3Qud2VibWFuaWZlc3QiLAogICAgInBhY2thZ2UuanNvbiIsICJIQU5ET1ZFUi5tZCIsICJSQUlMV0FZLm1kIiwKICBdLmZpbHRlcigoZikgPT4gZXhpc3RzU3luYyhqb2luKHJvb3QsIGYpKSk7"),
    replace: d("ICAvKiBUaGUgcGF0Y2ggc3lzdGVtIG1vdmVkIHRoZSB0cnV0aCBhbmQgdGhpcyBsaXN0IG5ldmVyIGZvbGxvd2VkLiBzcmMvc2VydmVyLmpzCiAgICAgaXMgdGhlIFBSSVNUSU5FIG1vbm9saXRoOyB3aGF0IGFjdHVhbGx5IHNlcnZlcyByZXF1ZXN0cyBpcyBzZXJ2ZXIucnVudGltZS5qcywKICAgICBidWlsdCBhdCBib290IGJ5IGJ1aWxkLm1qcyBmcm9tIHNlcnZlci5qcyArIHNyYy9wYXRjaGVzLyoubWpzLiBFeHBvcnRpbmcKICAgICBzZXJ2ZXIuanMgYWxvbmUgaGFuZGVkIGJhY2sgYSBmaWxlIH4xMEtCIHNob3J0IG9mIHRoZSBydW5uaW5nIHNlcnZlciwgd2l0aAogICAgIG5vbmUgb2YgdGhlIGFwcGxpZWQgaHVua3MgaW4gaXQsIHVuZGVyIGEgY29tbWVudCBwcm9taXNpbmcgdGhlIGxpdmUgYXBwLgogICAgIFNoaXAgdGhlIGJ1aWxkZXIsIHRoZSBidWlsdCBydW50aW1lLCBhbmQgZXZlcnkgcGF0Y2gsIHNvIGEgZG93bmxvYWQgY2FuIGJlCiAgICAgUkVCVUlMVCBhbmQgYnl0ZS1jaGVja2VkIGluc3RlYWQgb2YgdHJ1c3RlZC4gKi8KICBjb25zdCBwYXRjaGVzID0gZXhpc3RzU3luYyhqb2luKHJvb3QsICJzcmMvcGF0Y2hlcyIpKQogICAgPyByZWFkZGlyU3luYyhqb2luKHJvb3QsICJzcmMvcGF0Y2hlcyIpKS5maWx0ZXIoKGYpID0+IGYuZW5kc1dpdGgoIi5tanMiKSkuc29ydCgpCiAgICAgICAgLm1hcCgoZikgPT4gInNyYy9wYXRjaGVzLyIgKyBmKQogICAgOiBbXTsKICBjb25zdCBpbmNsdWRlID0gWwogICAgInNyYy9zZXJ2ZXIuanMiLCAic3JjL3NlcnZlci5ydW50aW1lLmpzIiwgInNyYy9idWlsZC5tanMiLAogICAgInNyYy9kYi5qcyIsICJzcmMvcGF5LmpzIiwgInNyYy9tYWlsLmpzIiwgInNyYy9zZWVkLmpzIiwKICAgIC4uLnBhdGNoZXMsCiAgICAicHVibGljL2luZGV4Lmh0bWwiLCAicHVibGljL3N0dWRpby5qcyIsICJwdWJsaWMvYWRtaW4uaHRtbCIsICJwdWJsaWMvc3cuanMiLAogICAgInB1YmxpYy9tYW5pZmVzdC53ZWJtYW5pZmVzdCIsCiAgICAicGFja2FnZS5qc29uIiwgIkhBTkRPVkVSLm1kIiwgIlJBSUxXQVkubWQiLAogIF0uZmlsdGVyKChmKSA9PiBleGlzdHNTeW5jKGpvaW4ocm9vdCwgZikpKTs=") },
];
