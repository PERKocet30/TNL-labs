/* Patch 068 — name the refusal. A guest on the Showroom tapped a music
   chip and got "Couldn't play that one": the tap reached the handler,
   playTrack ran, and Safari rejected play(). The fresh-play catch
   swallowed the error name, which leaves three very different causes
   indistinguishable — NotAllowedError (gesture/autoplay policy),
   NotSupportedError (the audio source itself failed to load), and
   AbortError (interrupted load). The toggle path has surfaced
   NotAllowedError since 023; the fresh-play path never did.

   This makes the fresh path do the same: NotAllowedError gets the "Tap
   once more to allow sound" retry copy, everything else names itself in
   the toast so the next screenshot is a diagnosis, not a symptom.

   1 hunk, client. Runs after 067 (a zero-hunk tombstone). */
const d = (s) => Buffer.from(s, "base64").toString("utf8");
export default [
  { file: "public/index.html", count: 1,
    find: d("ICBhLnBsYXkoKS5jYXRjaCgoKT0+e2lmKCFzaWxlbnQpdG9hc3QoIkNvdWxkbid0IHBsYXkgdGhhdCBvbmUiKX0pOw=="),
    replace: d("ICBhLnBsYXkoKS5jYXRjaChlcnI9PntpZihzaWxlbnQpcmV0dXJuOwogICAgLyogTmFtZSB0aGUgcmVmdXNhbC4gaU9TIHJlamVjdHMgcGxheSgpIGZvciBleGFjdGx5IHRocmVlIHJlYXNvbnMgYW5kCiAgICAgICB0aGV5IG5lZWQgdGhyZWUgZGlmZmVyZW50IGZpeGVzOiBOb3RBbGxvd2VkRXJyb3IgPSBnZXN0dXJlIGNyZWRpdAogICAgICAgKHRhcCBhZ2FpbiksIE5vdFN1cHBvcnRlZEVycm9yID0gdGhlIHNvdXJjZSBpdHNlbGYgZmFpbGVkIChhIHNlcnZlcgogICAgICAgb3IgVVJMIHByb2JsZW0pLCBBYm9ydEVycm9yID0gYSBuZXcgbG9hZCBpbnRlcnJ1cHRlZCB0aGlzIG9uZS4gQQogICAgICAgYmxhbmsgImNvdWxkbid0IHBsYXkiIGhpZGVzIHdoaWNoIG9uZSB3ZSdyZSBkZWJ1Z2dpbmcuICovCiAgICBjb25zdCBuPWVyciYmZXJyLm5hbWU7CiAgICB0b2FzdChuPT09Ik5vdEFsbG93ZWRFcnJvciI/IlRhcCBvbmNlIG1vcmUgdG8gYWxsb3cgc291bmQiCiAgICAgIDoiQ291bGRuJ3QgcGxheSB0aGF0IG9uZSDigJQgIisobnx8InVua25vd24iKSk7fSk7") },
];
