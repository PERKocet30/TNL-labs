/* Patch 015 — an account is full access.
   Confirmation mail still sends and still works; it just no longer holds
   anyone at the door. Mail clients disable links in messages that land in
   spam, which stranded the first outside signup on their first minute.
   Money is unaffected — listing and buying require Stripe onboarding,
   which is real identity verification. Runs after 014. */
const d = (s) => Buffer.from(s, "base64").toString("utf8");
export default [
  { file: "src/server.js", count: 1,
    find: d("ZnVuY3Rpb24gdmVyaWZpZWQocmVxLCByZXMsIG5leHQpIHsKICBpZiAoIXJlcS51c2VyLmVtYWlsX3ZlcmlmaWVkKSB7CiAgICByZXR1cm4gcmVzLnN0YXR1cyg0MDMpLmpzb24oeyBlcnJvcjogInZlcmlmeSB5b3VyIGVtYWlsIGZpcnN0IiwgbmVlZHNWZXJpZnk6IHRydWUgfSk7CiAgfQogIG5leHQoKTsKfQ=="),
    replace: d("LyogQW4gYWNjb3VudCBpcyBmdWxsIGFjY2Vzcy4gQ29uZmlybWF0aW9uIG1haWwgc3RpbGwgZ29lcyBvdXQgYW5kIHN0aWxsCiAgIHdvcmtzLCBpdCBqdXN0IGRvZXNuJ3QgaG9sZCBhbnlvbmUgYXQgdGhlIGRvb3Ig4oCUIGxpbmtzIGdldCBkaXNhYmxlZCB3aGVuCiAgIGEgbWVzc2FnZSBsYW5kcyBpbiBzcGFtLCB3aGljaCBzdHJhbmRlZCB0aGUgZmlyc3Qgb3V0c2lkZSBzaWdudXAuCiAgIE1vbmV5IGlzIHVuYWZmZWN0ZWQ6IGxpc3RpbmcgYW5kIGJ1eWluZyBuZWVkIFN0cmlwZSBvbmJvYXJkaW5nLiAqLwpmdW5jdGlvbiB2ZXJpZmllZChyZXEsIHJlcywgbmV4dCkgewogIG5leHQoKTsKfQ==") },
  { file: "src/server.js", count: 1,
    find: d("ICBjb25zdCBvbiA9ICEhcmVxLmJvZHk/LnB1Ymxpc2hlZDsKICBpZiAob24gJiYgIXJlcS51c2VyLmVtYWlsX3ZlcmlmaWVkKSB7CiAgICByZXR1cm4gcmVzLnN0YXR1cyg0MDMpLmpzb24oeyBlcnJvcjogInZlcmlmeSB5b3VyIGVtYWlsIGJlZm9yZSBwdWJsaXNoaW5nIiwgbmVlZHNWZXJpZnk6IHRydWUgfSk7CiAgfQ=="),
    replace: d("ICBjb25zdCBvbiA9ICEhcmVxLmJvZHk/LnB1Ymxpc2hlZDs=") },
];
