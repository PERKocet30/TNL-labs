/* Patch 066 — a music post is a card. 060's isCard() tested
   p.audioTrackId, which is the REQUEST field the composer sends the
   server; shapePost answers with p.audioTrack (the full object). The
   two never met, so a post carrying a track and no photo classified as
   chat and rendered as a bare row: no artwork, no ♫ chip — which reads
   on-device as "images missing" AND "music not playing", one bug wearing
   both symptoms. isCard now accepts audioTrack (server shape) and keeps
   audioTrackId for any client-built object that carries it.

   1 hunk, client. Runs after 065. */
const d = (s) => Buffer.from(s, "base64").toString("utf8");
export default [
  { file: "public/index.html", count: 1,
    find: d("Y29uc3QgaXNDYXJkPXA9PiEhKHAmJihwLmltYWdlVXJsfHxwLnZpZGVvVXJsfHwocC5pbWFnZXMmJnAuaW1hZ2VzLmxlbmd0aCl8fHAuYmVhdHx8cC5hdWRpb1RyYWNrSWR8fHAuc2hhcmVkRnJvbSkpOw=="),
    replace: d("Y29uc3QgaXNDYXJkPXA9PiEhKHAmJihwLmltYWdlVXJsfHxwLnZpZGVvVXJsfHwocC5pbWFnZXMmJnAuaW1hZ2VzLmxlbmd0aCl8fHAuYmVhdHx8cC5hdWRpb1RyYWNrfHxwLmF1ZGlvVHJhY2tJZHx8cC5zaGFyZWRGcm9tKSk7") },
];
