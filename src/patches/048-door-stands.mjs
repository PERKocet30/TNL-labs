/* Patch 048 — the door closed itself before anyone could open it.

   047 wired every escape hatch at render time:

     if(v){ v.onended=done; v.onerror=done; v.onstalled=done; }

   The video carries preload="metadata", so the browser fetches
   /tnl-enter.mp4 the instant the splash renders. That file is not in the repo
   yet, so it 404s, onerror fires within milliseconds, and done() dismissed the
   door before it could be touched. The guards I added so nobody could get
   trapped fired before there was anything to escape from.

   Fixed with a `started` flag, set at the end of go():

     - before ENTER: a broken video hides itself, the button stands
     - after ENTER:  onerror / onstalled / the 20s timer all dismiss as intended
     - SKIP:         works at any time, unconditionally

   So the door now stands whether or not the video exists, which is what 047
   claimed to do and didn't.

   Also drops a stray undeclared ENTERTIMER global from the draft — nothing
   cleared it, so it bought nothing.

   Still wants public/tnl-enter.mp4 and public/tnl-enter-poster.jpg uploaded
   through GitHub web; until then you get black ground, mark, ENTER, and the
   tap takes you straight in with audio unlocked.

   Client-only, three hunks. Runs after 047. */
const d = (s) => Buffer.from(s, "base64").toString("utf8");
export default [
  { file: "public/index.html", count: 1,
    find: d("ICBsZXQgZ29uZT1mYWxzZTs="),
    replace: d("ICBsZXQgZ29uZT1mYWxzZSwgc3RhcnRlZD1mYWxzZTs=") },
  { file: "public/index.html", count: 1,
    find: d("ICAgIH0gZWxzZSBkb25lKCk7CiAgfTs="),
    replace: d("ICAgIH0gZWxzZSBkb25lKCk7CiAgICBzdGFydGVkPXRydWU7CiAgfTs=") },
  { file: "public/index.html", count: 1,
    find: d("ICAkKCIjZW50ZXJCdG4iKS5vbmNsaWNrPWdvOwogICQoIiNlbnRlclNraXAiKS5vbmNsaWNrPWRvbmU7CiAgaWYodil7IHYub25lbmRlZD1kb25lOyB2Lm9uZXJyb3I9ZG9uZTsgdi5vbnN0YWxsZWQ9ZG9uZTsgfQogIHNldFRpbWVvdXQoZG9uZSwyMDAwMCk7"),
    replace: d("ICAkKCIjZW50ZXJCdG4iKS5vbmNsaWNrPWdvOwogICQoIiNlbnRlclNraXAiKS5vbmNsaWNrPWRvbmU7CiAgLyogQmVmb3JlIEVOVEVSIGlzIHByZXNzZWQgdGhlc2UgbXVzdCBOT1QgZGlzbWlzcy4gcHJlbG9hZD0ibWV0YWRhdGEiIGZldGNoZXMKICAgICB0aGUgZmlsZSB0aGUgbW9tZW50IHRoaXMgcmVuZGVycywgc28gYSB2aWRlbyB0aGF0IGlzIG1pc3Npbmcgb3Igc2xvdyBmaXJlZAogICAgIG9uZXJyb3IgaW5zdGFudGx5IGFuZCBjbG9zZWQgdGhlIGRvb3IgYmVmb3JlIGFueW9uZSBjb3VsZCB0b3VjaCBpdC4gVW50aWwKICAgICB0aGUgdGFwLCBhIGJyb2tlbiB2aWRlbyBqdXN0IGhpZGVzIGl0c2VsZiBhbmQgdGhlIGJ1dHRvbiBzdGFuZHMuICovCiAgaWYodil7CiAgICB2Lm9uZXJyb3I9KCk9PnsgaWYoc3RhcnRlZClkb25lKCk7IGVsc2Ugdi5zdHlsZS5kaXNwbGF5PSJub25lIjsgfTsKICAgIHYub25zdGFsbGVkPSgpPT57IGlmKHN0YXJ0ZWQpZG9uZSgpOyB9OwogICAgdi5vbmVuZGVkPWRvbmU7CiAgfQogIHNldFRpbWVvdXQoKCk9PnsgaWYoc3RhcnRlZClkb25lKCk7IH0sMjAwMDApOw==") },
];
