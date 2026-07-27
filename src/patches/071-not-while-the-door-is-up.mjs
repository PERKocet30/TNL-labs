/* Patch 071 — not while the door is up. Tapping ENTER THE LAB made the
   intro stutter: the document-level audio primer runs before the
   button's own handler (capture phase), sets MUSOK=true, and calls
   wireMusAuto() — attaching the autoplay observer to the Showroom feed
   behind the intro overlay. Its initial pass found a centred post with
   a track and started it UNDER the intro video the same tap had just
   unmuted; two streams fighting for the iOS audio session stalls the
   video. wireMusAuto now no-ops while ENTER is up; when done() drops
   the overlay, render() rewires it and autoplay begins in the feed,
   where it belongs.

   1 hunk, client. Runs after 070. */
const d = (s) => Buffer.from(s, "base64").toString("utf8");
export default [
  { file: "public/index.html", count: 1,
    find: d("ZnVuY3Rpb24gd2lyZU11c0F1dG8oKXsKICBpZihNT0JTKXtNT0JTLmRpc2Nvbm5lY3QoKTtNT0JTPW51bGx9"),
    replace: d("ZnVuY3Rpb24gd2lyZU11c0F1dG8oKXsKICAvKiBOb3Qgd2hpbGUgdGhlIGRvb3IgaXMgdXAuIFRoZSBFTlRFUiB0YXAgcHJpbWVzIGF1ZGlvIChNVVNPSz10cnVlKSBhbmQKICAgICB0aGUgcHJpbWVyIGNhbGxzIHRoaXMg4oCUIHdoaWNoIHVzZWQgdG8gYXR0YWNoIHRoZSBvYnNlcnZlciB0byB0aGUgZmVlZAogICAgIEJFSElORCB0aGUgaW50cm8gb3ZlcmxheSwgYXV0b3BsYXkgYSB0cmFjayB1bmRlciB0aGUgaW50cm8gdmlkZW8sIGFuZAogICAgIGxlYXZlIHRoZSB0d28gZmlnaHRpbmcgZm9yIHRoZSBhdWRpbyBzZXNzaW9uIChvbiBpT1MgdGhhdCBzdGFsbHMgdGhlCiAgICAgdmlkZW86IHRoZSAiZ2xpdGNoaW5nIGludHJvIikuIFdoZW4gZG9uZSgpIGRyb3BzIHRoZSBvdmVybGF5LCByZW5kZXIoKQogICAgIHdpcmVzIHRoaXMgYWdhaW4gYW5kIGF1dG9wbGF5IGJlZ2lucyB3aGVyZSBpdCBzaG91bGQg4oCUIGluIHRoZSBmZWVkLiAqLwogIGlmKHR5cGVvZiBFTlRFUiE9PSJ1bmRlZmluZWQiJiZFTlRFUilyZXR1cm47CiAgaWYoTU9CUyl7TU9CUy5kaXNjb25uZWN0KCk7TU9CUz1udWxsfQ==") },
];
