/* Patch 023 — make the player legible. Client-only.
   Tapping a sound chip was indistinguishable from a dead button: playTrack
   early-returns into a toggle when the same track is already loaded, nothing
   re-rendered so the glyph never flipped, and the now-playing bar sat at
   z-index 60 under the z-index 130 post overlay. Working and broken looked
   identical. Now a tap repaints, the bar is visible over the overlay, the
   toggle's play() promise is caught instead of dropped, and the audio element
   primes on the first tap anywhere so autoplay no longer depends on someone
   knowing to tap a chip. No server hunk, no schema, no money path.
   Runs after 022. */
const d = (s) => Buffer.from(s, "base64").toString("utf8");
export default [
  { file: "public/index.html", count: 1,
    find: d("ICBpZihOT1dQTEFZSU5HJiZOT1dQTEFZSU5HLmlkPT09dC5pZCl7YS5wYXVzZWQ/YS5wbGF5KCk6YS5wYXVzZSgpO3JldHVybn0="),
    replace: d("ICAvKiBTYW1lIHRyYWNrIGFscmVhZHkgbG9hZGVkOiB0aGlzIGlzIGEgdG9nZ2xlLCBub3QgYSBuZXcgcGxheS4gVGhlIHByb21pc2UKICAgICB1c2VkIHRvIGJlIGRyb3BwZWQgb24gdGhlIGZsb29yIGhlcmUsIHNvIGFuIGlPUyByZWZ1c2FsIGxvb2tlZCBpZGVudGljYWwKICAgICB0byBhIGRlYWQgYnV0dG9uLiAqLwogIGlmKE5PV1BMQVlJTkcmJk5PV1BMQVlJTkcuaWQ9PT10LmlkKXsKICAgIGlmKGEucGF1c2VkKXtjb25zdCBwcj1hLnBsYXkoKTtpZihwciYmcHIuY2F0Y2gpcHIuY2F0Y2goZXJyPT57aWYoIXNpbGVudCl0b2FzdChlcnImJmVyci5uYW1lPT09Ik5vdEFsbG93ZWRFcnJvciI/IlRhcCBvbmNlIG1vcmUgdG8gYWxsb3cgc291bmQiOiJDb3VsZG4ndCBwbGF5IHRoYXQgb25lIil9KX0KICAgIGVsc2UgYS5wYXVzZSgpOwogICAgcmV0dXJufQ==") },
  { file: "public/index.html", count: 1,
    find: d("ICAgICAgcGxheVRyYWNrKHAuYXVkaW9UcmFjayk7CiAgICAgIHdpcmVNdXNBdXRvKCk7CiAgICB9CiAgfSx0cnVlKTsKfSkoKTs="),
    replace: d("ICAgICAgcGxheVRyYWNrKHAuYXVkaW9UcmFjayk7CiAgICAgIC8qIFJlcGFpbnQgc28gdGhlIGdseXBoIGZsaXBzIOKAlCBhIHRhcCBtdXN0IGFsd2F5cyB2aXNpYmx5IGRvIHNvbWV0aGluZywKICAgICAgICAgb3RoZXJ3aXNlIHdvcmtpbmcgYW5kIGJyb2tlbiBsb29rIHRoZSBzYW1lLiByZW5kZXIoKSByZXdpcmVzLCB3aGljaAogICAgICAgICBjb3ZlcnMgd2lyZU11c0F1dG8oKS4gKi8KICAgICAgcmVuZGVyKCk7CiAgICB9CiAgfSx0cnVlKTsKCiAgLyogaU9TIG5lZWRzIG9uZSBnZXN0dXJlIGJlZm9yZSBpdCB3aWxsIGxldCBzY3JpcHQgc3RhcnQgYXVkaW8g4oCUIGJ1dCBpdCBkb2VzCiAgICAgbm90IG5lZWQgdGhhdCBnZXN0dXJlIHRvIGJlIG9uIGEgY2hpcC4gUHJpbWUgdGhlIGVsZW1lbnQgb24gdGhlIGZpcnN0IHRhcAogICAgIGFueXdoZXJlLCBzbyBzY3JvbGxpbmcgaW50byBhIHBvc3QganVzdCB3b3JrcyBpbnN0ZWFkIG9mIGRlcGVuZGluZyBvbgogICAgIHNvbWVvbmUgZGlzY292ZXJpbmcgdGhlIGNoaXAgZmlyc3QuICovCiAgZG9jdW1lbnQuYWRkRXZlbnRMaXN0ZW5lcigiY2xpY2siLCgpPT57CiAgICBpZihNVVNQUklNRUQpcmV0dXJuO01VU1BSSU1FRD10cnVlOwogICAgY29uc3QgYT1hdWRpb0VsKCk7CiAgICBpZighYS5nZXRBdHRyaWJ1dGUoInNyYyIpKXsKICAgICAgYS5zcmM9U0lMRU5UOwogICAgICBjb25zdCBwcj1hLnBsYXkoKTtpZihwciYmcHIuY2F0Y2gpcHIuY2F0Y2goKCk9Pnt9KTsKICAgICAgc2V0VGltZW91dCgoKT0+e2lmKChhLmdldEF0dHJpYnV0ZSgic3JjIil8fCIiKS5zdGFydHNXaXRoKCJkYXRhOiIpKXthLnBhdXNlKCk7YS5yZW1vdmVBdHRyaWJ1dGUoInNyYyIpfX0sMCk7CiAgICB9CiAgICBNVVNPSz10cnVlO3dpcmVNdXNBdXRvKCk7CiAgfSx0cnVlKTsKfSkoKTs=") },
  { file: "public/index.html", count: 1,
    find: d("bGV0IE1VU09LPWZhbHNlLCBNVVNNVVRFPWZhbHNlLCBNVVNBVVRPSUQ9bnVsbCwgTU9CUz1udWxsOw=="),
    replace: d("bGV0IE1VU09LPWZhbHNlLCBNVVNNVVRFPWZhbHNlLCBNVVNBVVRPSUQ9bnVsbCwgTU9CUz1udWxsOwpsZXQgTVVTUFJJTUVEPWZhbHNlOwovKiBBIHplcm8tbGVuZ3RoIFdBVi4gUGxheWluZyBpdCBpbnNpZGUgYSByZWFsIHRhcCBpcyB3aGF0IHVubG9ja3MgdGhlIGF1ZGlvCiAgIGVsZW1lbnQgb24gaU9TOyBub3RoaW5nIGlzIGF1ZGlibGUuICovCmNvbnN0IFNJTEVOVD0iZGF0YTphdWRpby93YXY7YmFzZTY0LFVrbEdSaVFBQUFCWFFWWkZabTEwSUJBQUFBQUJBQUVBUkt3QUFJaFlBUUFDQUJBQVpHRjBZUUFBQUFBPSI7") },
  { file: "public/index.html", count: 1,
    find: d("Lm5vd2Jhcntwb3NpdGlvbjpmaXhlZDtsZWZ0OjA7cmlnaHQ6MDtib3R0b206NjJweDt6LWluZGV4OjYwOw=="),
    replace: d("Lm5vd2Jhcntwb3NpdGlvbjpmaXhlZDtsZWZ0OjA7cmlnaHQ6MDtib3R0b206NjJweDt6LWluZGV4OjE0MDs=") },
];
