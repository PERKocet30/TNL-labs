/* Patch 051 — the verify page is a page, not a download.
   The gzip wrapper (added with compression) intercepts res.send BEFORE
   Express assigns a default Content-Type. A raw HTML string >=1KB therefore
   got gzipped into a Buffer with no type, and Express labels a bare Buffer
   application/octet-stream — so Safari saved /api/auth/verify as a 1KB file
   named "verify" instead of rendering it. Same fate for the reset page and
   the public portfolio page. One guard in the wrapper fixes all of them.
   Server-only, one hunk. Runs after 050. */
const d = (s) => Buffer.from(s, "base64").toString("utf8");
export default [
  { file: "src/server.js", count: 1,
    find: d("ICAgICAgY29uc3QgY3QgPSByZXMuZ2V0KCJDb250ZW50LVR5cGUiKSB8fCAiIjsK"),
    replace: d("ICAgICAgLyogRXhwcmVzcyB0eXBlcyBhIHN0cmluZyBhcyB0ZXh0L2h0bWwgaW5zaWRlIHRoZSBSRUFMIHNlbmQg4oCUIHdoaWNoIG5vdwogICAgICAgICBydW5zIGFmdGVyIHVzLiBXZSBnemlwIGZpcnN0IGFuZCBwYXNzIGEgQnVmZmVyLCBhbmQgRXhwcmVzcyB0eXBlcyBhCiAgICAgICAgIGJhcmUgQnVmZmVyIGFzIGFwcGxpY2F0aW9uL29jdGV0LXN0cmVhbTogdGhlIHZlcmlmeSBwYWdlIChhbmQgZXZlcnkKICAgICAgICAgb3RoZXIgSFRNTCBzdHJpbmcg4omlMUtCKSBkb3dubG9hZGVkIGFzIGEgZmlsZSBuYW1lZCBhZnRlciB0aGUgcm91dGUuCiAgICAgICAgIFNldCB0aGUgdHlwZSBhIHN0cmluZyB3b3VsZCBoYXZlIGdvdHRlbiBiZWZvcmUgZGVjaWRpbmcgYW55dGhpbmcuICovCiAgICAgIGxldCBjdCA9IHJlcy5nZXQoIkNvbnRlbnQtVHlwZSIpIHx8ICIiOwogICAgICBpZiAoIWN0ICYmIHR5cGVvZiBib2R5ID09PSAic3RyaW5nIikgeyByZXMuc2V0KCJDb250ZW50LVR5cGUiLCAidGV4dC9odG1sOyBjaGFyc2V0PXV0Zi04Iik7IGN0ID0gInRleHQvaHRtbCI7IH0K") },
];
