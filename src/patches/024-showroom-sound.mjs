/* Patch 024 — the Showroom carries the sound. Server-only, one hunk.
   019 threaded audio_track_id through feedRows, and profile/search ride that
   query — but /api/feed/showroom has its own SELECT for the collab-weighted
   ranking, so its rows never had track_url and shapePost correctly emitted
   audioTrack:null. Every chip on a Showroom card was missing, not broken.
   Same LEFT JOINs and aliases as feedRows; p.* already includes
   audio_track_id. No schema, no money path. Runs after 023. */
const d = (s) => Buffer.from(s, "base64").toString("utf8");
export default [
  { file: "src/server.js", count: 1,
    find: d("ICAgICAgKFNFTEVDVCBDT1VOVCgqKSBGUk9NIGNvbGxhYm9yYXRvcnMgYyBXSEVSRSBjLnBvc3RfaWQgPSBwLmlkIEFORCBjLnN0YXR1cz0nYWNjZXB0ZWQnKSBBUyBjb2xsYWJfY291bnQKICAgIEZST00gcG9zdHMgcAogICAgSk9JTiB1c2VycyB1IE9OIHUuaWQgPSBwLmF1dGhvcl9pZAogICAgV0hFUkUgcC5pc193b3JrID0gMSBBTkQgcC5zaGFyZWRfZnJvbSBJUyBOVUxM"),
    replace: d("ICAgICAgKFNFTEVDVCBDT1VOVCgqKSBGUk9NIGNvbGxhYm9yYXRvcnMgYyBXSEVSRSBjLnBvc3RfaWQgPSBwLmlkIEFORCBjLnN0YXR1cz0nYWNjZXB0ZWQnKSBBUyBjb2xsYWJfY291bnQsCiAgICAgIHRyLnRpdGxlIEFTIHRyYWNrX3RpdGxlLCB0ci51cmwgQVMgdHJhY2tfdXJsLCB0ci5hcnR3b3JrX3VybCBBUyB0cmFja19hcnQsIHRyLmR1cmF0aW9uX21zIEFTIHRyYWNrX2R1ciwgdHUudXNlcm5hbWUgQVMgdHJhY2tfYnkKICAgIEZST00gcG9zdHMgcAogICAgSk9JTiB1c2VycyB1IE9OIHUuaWQgPSBwLmF1dGhvcl9pZAogICAgTEVGVCBKT0lOIHRyYWNrcyB0ciBPTiB0ci5pZCA9IHAuYXVkaW9fdHJhY2tfaWQKICAgIExFRlQgSk9JTiB1c2VycyB0dSBPTiB0dS5pZCA9IHRyLnVzZXJfaWQKICAgIFdIRVJFIHAuaXNfd29yayA9IDEgQU5EIHAuc2hhcmVkX2Zyb20gSVMgTlVMTA==") },
];
