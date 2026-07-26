/* Patch 059 — live by default. The state the app is in right now was set
   by hand; this makes it the behaviour instead of a snapshot.

   1. A new member's profile is published on signup. users.published still
      defaulted to 0, and GET /u/:name hard-returns 404 when it's unset —
      so every person who joined after the manual pass would have been
      handed a share link to a dead page.
   2. The composer's "Publish to my portfolio" toggle starts ON, stays on
      after a send, and a post written on a profile counts as portfolio
      work whether or not it carries an image.

   What this does NOT do: flip posts.is_work's default server-side. That
   column gates three surfaces, not one — the portfolio, the Showroom
   feed, and the public archive — and a blanket default would sweep every
   photo dropped mid-conversation in a lab room into all three. The
   archive route says so in its own comment, and it's right: that's a
   consent problem, not a defaults problem. Chat that is meant as work
   still says so, now by default; chat that isn't stays chat.

   Note: ASWORK also selects full-quality image upload, so the default-on
   toggle means larger uploads by default.

   7 hunks: 2 db, 1 server, 4 client. Runs after 058. */
const d = (s) => Buffer.from(s, "base64").toString("utf8");
export default [
  { file: "src/db.js", count: 1,
    find: d("ICBwdWJsaXNoZWQgICAgSU5URUdFUiBOT1QgTlVMTCBERUZBVUxUIDAs"),
    replace: d("ICBwdWJsaXNoZWQgICAgSU5URUdFUiBOT1QgTlVMTCBERUZBVUxUIDEs") },
  { file: "src/db.js", count: 1,
    find: d("aWYgKCFjb2xzLmluY2x1ZGVzKCJwdWJsaXNoZWQiKSkgZGIuZXhlYyhgQUxURVIgVEFCTEUgdXNlcnMgQUREIENPTFVNTiBwdWJsaXNoZWQgSU5URUdFUiBOT1QgTlVMTCBERUZBVUxUIDBgKTs="),
    replace: d("aWYgKCFjb2xzLmluY2x1ZGVzKCJwdWJsaXNoZWQiKSkgZGIuZXhlYyhgQUxURVIgVEFCTEUgdXNlcnMgQUREIENPTFVNTiBwdWJsaXNoZWQgSU5URUdFUiBOT1QgTlVMTCBERUZBVUxUIDFgKTs=") },
  { count: 1,
    find: d("ICBjcmVhdGVVc2VyOiBkYi5wcmVwYXJlKAogICAgYElOU0VSVCBJTlRPIHVzZXJzICh1c2VybmFtZSwgZGlzcGxheV9uYW1lLCBlbWFpbCwgcm9sZSwgcGFzc3dvcmRfaGFzaCwgY3JlYXRlZF9hdCkKICAgICBWQUxVRVMgKD8sID8sID8sID8sID8sID8pYAogICks"),
    replace: d("ICBjcmVhdGVVc2VyOiBkYi5wcmVwYXJlKAogICAgLyogcHVibGlzaGVkID0gMSBleHBsaWNpdGx5LCBub3QgbGVmdCB0byB0aGUgY29sdW1uIGRlZmF1bHQ6IGRhdGFiYXNlcwogICAgICAgY3JlYXRlZCBiZWZvcmUgMDU5IGhhdmUgREVGQVVMVCAwIGJha2VkIGluIGFuZCBTUUxpdGUgaGFzIG5vIEFMVEVSCiAgICAgICBDT0xVTU4uIFdpdGhvdXQgdGhpcyBhIG5ldyBtZW1iZXIncyAvdS8gcGFnZSA0MDRzIG9uIHRoZSBzaGFyZSBsaW5rCiAgICAgICB0aGV5IHdlcmUganVzdCBoYW5kZWQg4oCUIHRoZSBvbmUgbW9tZW50IGl0IG1hdHRlcnMgbW9zdC4gKi8KICAgIGBJTlNFUlQgSU5UTyB1c2VycyAodXNlcm5hbWUsIGRpc3BsYXlfbmFtZSwgZW1haWwsIHJvbGUsIHBhc3N3b3JkX2hhc2gsIHB1Ymxpc2hlZCwgY3JlYXRlZF9hdCkKICAgICBWQUxVRVMgKD8sID8sID8sID8sID8sIDEsID8pYAogICks") },
  { file: "public/index.html", count: 1,
    find: d("bGV0IFBFTkRWSUQ9bnVsbCwgUEVOREtJTkQ9bnVsbCwgQVNXT1JLPWZhbHNlLCBFRElUSUQ9bnVsbCwgRURJVFJPTEVTPVtdOw=="),
    replace: d("bGV0IFBFTkRWSUQ9bnVsbCwgUEVOREtJTkQ9bnVsbCwgQVNXT1JLPXRydWUsIEVESVRJRD1udWxsLCBFRElUUk9MRVM9W107") },
  { file: "public/index.html", count: 1,
    find: d("ICAgIGNvbnN0IHF1ZXVlPVFVRVVFLnNsaWNlKCksIHdvcms9QVNXT1JLLCBkcmFmdFRleHQ9dDsKICAgICQoIiNkcmFmdCIpLnZhbHVlPSIiOwogICAgUVVFVUU9W107QVNXT1JLPWZhbHNlOw=="),
    replace: d("ICAgIGNvbnN0IHF1ZXVlPVFVRVVFLnNsaWNlKCksIHdvcms9QVNXT1JLLCBkcmFmdFRleHQ9dDsKICAgICQoIiNkcmFmdCIpLnZhbHVlPSIiOwogICAgUVVFVUU9W107QVNXT1JLPXRydWU7") },
  { file: "public/index.html", count: 1,
    find: d("ICBjb25zdCBkaT0kKCIjZHJvcGltZyIpO2lmKGRpKWRpLm9uY2xpY2s9KCk9PntRVUVVRT1bXTtBU1dPUks9ZmFsc2U7cmVuZGVyKCl9Ow=="),
    replace: d("ICBjb25zdCBkaT0kKCIjZHJvcGltZyIpO2lmKGRpKWRpLm9uY2xpY2s9KCk9PntRVUVVRT1bXTtBU1dPUks9dHJ1ZTtyZW5kZXIoKX07") },
  { file: "public/index.html", count: 1,
    find: d("ICAgICAgYXdhaXQgYXBpLnBvc3Qoe2NoYW5uZWw6InByb2ZpbGUiLGJvZHk6UENPTVBPU0UuYm9keS50cmltKCksaW1hZ2VzOlBDT01QT1NFLmltZ3MsaXNXb3JrOlBDT01QT1NFLmltZ3MubGVuZ3RoPjAsYXVkaW9UcmFja0lkOlBDT01QT1NFLnRyYWNrP1BDT01QT1NFLnRyYWNrLmlkOnVuZGVmaW5lZH0pOw=="),
    replace: d("ICAgICAgYXdhaXQgYXBpLnBvc3Qoe2NoYW5uZWw6InByb2ZpbGUiLGJvZHk6UENPTVBPU0UuYm9keS50cmltKCksaW1hZ2VzOlBDT01QT1NFLmltZ3MsaXNXb3JrOnRydWUsYXVkaW9UcmFja0lkOlBDT01QT1NFLnRyYWNrP1BDT01QT1NFLnRyYWNrLmlkOnVuZGVmaW5lZH0pOw==") },
];
