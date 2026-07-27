/* Patch 070 — name every refusal. The plain "Couldn't play that one"
   after 069 came from the TOGGLE branch of playTrack (track already
   NOWPLAYING from an earlier attempt, second tap retried) — 068 only
   instrumented the fresh-play branch. And neither branch can see LOAD
   failures: a play() rejection says the request was refused, while the
   element's own error event says the file failed, with a MediaError
   code (1 aborted / 2 network / 3 decode / 4 src-not-supported).

   Two changes: the toggle catch names its error like the fresh path
   (suffixed "(retry)" so the branch is visible), and audioEl() gains an
   error listener that toasts the MediaError code — ignoring the silent
   data: primer. If the guest tap dies with "code 2" or "code 4", the
   problem is how the track file is served to a cookieless request and
   autoplay policy is exonerated.

   2 hunks, client. Runs after 069. */
const d = (s) => Buffer.from(s, "base64").toString("utf8");
export default [
  { file: "public/index.html", count: 1,
    find: d("ICAgIGlmKGEucGF1c2VkKXtjb25zdCBwcj1hLnBsYXkoKTtpZihwciYmcHIuY2F0Y2gpcHIuY2F0Y2goZXJyPT57aWYoIXNpbGVudCl0b2FzdChlcnImJmVyci5uYW1lPT09Ik5vdEFsbG93ZWRFcnJvciI/IlRhcCBvbmNlIG1vcmUgdG8gYWxsb3cgc291bmQiOiJDb3VsZG4ndCBwbGF5IHRoYXQgb25lIil9KX0="),
    replace: d("ICAgIGlmKGEucGF1c2VkKXtjb25zdCBwcj1hLnBsYXkoKTtpZihwciYmcHIuY2F0Y2gpcHIuY2F0Y2goZXJyPT57aWYoIXNpbGVudCl0b2FzdChlcnImJmVyci5uYW1lPT09Ik5vdEFsbG93ZWRFcnJvciI/IlRhcCBvbmNlIG1vcmUgdG8gYWxsb3cgc291bmQiOiJDb3VsZG4ndCBwbGF5IHRoYXQgb25lIOKAlCAiKyhlcnImJmVyci5uYW1lfHwidW5rbm93biIpKyIgKHJldHJ5KSIpfSl9") },
  { file: "public/index.html", count: 1,
    find: d("ICBjb25zdCBzeW5jPSgpPT57cGFpbnRQbGF5ZXIoKTtpZihUQUI9PT0ibGFicyImJkNILmxpYnJhcnkpcmVuZGVyKCl9OwogIEFVRElPLmFkZEV2ZW50TGlzdGVuZXIoInBsYXkiLHN5bmMpOwogIEFVRElPLmFkZEV2ZW50TGlzdGVuZXIoInBhdXNlIixzeW5jKTsKICBBVURJTy5hZGRFdmVudExpc3RlbmVyKCJlbmRlZCIsc3luYyk7CiAgcmV0dXJuIEFVRElPOw=="),
    replace: d("ICBBVURJTy5wcmVsb2FkPSJub25lIjsKICBjb25zdCBzeW5jPSgpPT57cGFpbnRQbGF5ZXIoKTtpZihUQUI9PT0ibGFicyImJkNILmxpYnJhcnkpcmVuZGVyKCl9OwogIEFVRElPLmFkZEV2ZW50TGlzdGVuZXIoInBsYXkiLHN5bmMpOwogIEFVRElPLmFkZEV2ZW50TGlzdGVuZXIoInBhdXNlIixzeW5jKTsKICBBVURJTy5hZGRFdmVudExpc3RlbmVyKCJlbmRlZCIsc3luYyk7CiAgLyogcGxheSgpIHJlamVjdGlvbnMgc2F5IHRoZSBSRVFVRVNUIHdhcyByZWZ1c2VkOyB0aGlzIHNheXMgdGhlIEZJTEUKICAgICBmYWlsZWQuIE1lZGlhRXJyb3IgY29kZXM6IDEgYWJvcnRlZCwgMiBuZXR3b3JrLCAzIGRlY29kZSwKICAgICA0IHNyYy1ub3Qtc3VwcG9ydGVkLiBJZiBhIGd1ZXN0IHRhcCBkaWVzIGhlcmUsIHRoZSBwcm9ibGVtIGlzIGhvdwogICAgIHRoZSB0cmFjayBpcyBzZXJ2ZWQgdG8gYSBjb29raWVsZXNzIHJlcXVlc3QsIG5vdCBhdXRvcGxheSBwb2xpY3kuICovCiAgQVVESU8uYWRkRXZlbnRMaXN0ZW5lcigiZXJyb3IiLCgpPT57CiAgICBjb25zdCBjPUFVRElPLmVycm9yJiZBVURJTy5lcnJvci5jb2RlOwogICAgaWYoKEFVRElPLmdldEF0dHJpYnV0ZSgic3JjIil8fCIiKS5zdGFydHNXaXRoKCJkYXRhOiIpKXJldHVybjsgLy8gdGhlIHNpbGVudCBwcmltZXIsIG5vdCBhIHRyYWNrCiAgICB0b2FzdCgiQXVkaW8gZmFpbGVkIHRvIGxvYWQg4oCUIGNvZGUgIisoY3x8Ij8iKSk7CiAgfSk7CiAgcmV0dXJuIEFVRElPOw==") },
];
