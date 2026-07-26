/* Patch 055 — the money check actually checks the money.
   Two fixes from the pay.js verification pass (2026-07-26):
   1) /api/market/checkout/done verified only that a session was PAID —
      never that it was paid FOR THE ORDER in the query string, nor that
      the amount matched. verifySession already returns both; now they
      are asserted. Wrong order or wrong total = treated as unpaid.
   2) paid: !!r.payment_ref was wrong everywhere it appeared — the ref is
      written when checkout is CREATED, before any payment, so abandoned
      checkouts displayed as paid. Now keyed on order status. Both
      occurrences (orders list + sales shape) fixed by one count-2 hunk.
   Server-only, no schema. */
const d = (s) => Buffer.from(s, "base64").toString("utf8");
export default [
  { count: 1,
    find: d("ICBjb25zdCBvdXQgPSBhd2FpdCB2ZXJpZnlTZXNzaW9uKHNpZCwgc2VsbGVyPy5zdHJpcGVfYWNjb3VudCk7CiAgaWYgKCFvdXQucGFpZCkgcmV0dXJuIHJlcy5yZWRpcmVjdCgiLz9jaGVja291dD1mYWlsZWQiKTsKICBpZiAob3JkZXIuc3RhdHVzID09PSAicGVuZGluZyIpIHs="),
    replace: d("ICBjb25zdCBvdXQgPSBhd2FpdCB2ZXJpZnlTZXNzaW9uKHNpZCwgc2VsbGVyPy5zdHJpcGVfYWNjb3VudCk7CiAgaWYgKCFvdXQucGFpZCkgcmV0dXJuIHJlcy5yZWRpcmVjdCgiLz9jaGVja291dD1mYWlsZWQiKTsKICAvKiBCaW5kIHRoZSBzZXNzaW9uIHRvIFRISVMgb3JkZXIuICJQYWlkIiBvbmx5IHByb3ZlcyBtb25leSBtb3ZlZCBvbiB0aGUKICAgICBzZWxsZXIncyBhY2NvdW50IOKAlCBub3QgdGhhdCBpdCBtb3ZlZCBmb3IgdGhlIG9yZGVyIG5hbWVkIGluIHRoZSBxdWVyeQogICAgIHN0cmluZy4gVGhpcyByb3V0ZSBpcyB1bmF1dGhlbnRpY2F0ZWQgYW5kIG9yZGVyIGlkcyBhcmUgc2VxdWVudGlhbCwKICAgICBzbyB3aXRob3V0IHRoZXNlIGNoZWNrcyBvbmUgY2hlYXAgcGFpZCBzZXNzaW9uIGNvdWxkIGNvbmZpcm0gYW55CiAgICAgcGVuZGluZyBvcmRlciBvbiB0aGUgc2FtZSBzZWxsZXI6IGl0IGZsaXBzIHRvIHBhaWQsIHJlcCBpcyBhd2FyZGVkLAogICAgIHRoZSBsaXN0aW5nIG1hcmtzIHNvbGQsIGFuZCBubyBtYXRjaGluZyBtb25leSBleGlzdHMuIFRoZSBzZXNzaW9uCiAgICAgY2FycmllcyB0aGUgb3JkZXIgaWQgaXQgd2FzIGNyZWF0ZWQgZm9yIGFuZCB0aGUgdG90YWwgYWN0dWFsbHkKICAgICBjaGFyZ2VkIOKAlCBhc3NlcnQgYm90aCBiZWZvcmUgdG91Y2hpbmcgYW55dGhpbmcuICovCiAgaWYgKFN0cmluZyhvdXQub3JkZXJJZCB8fCAiIikgIT09IFN0cmluZyhvcmRlci5pZCkpIHJldHVybiByZXMucmVkaXJlY3QoIi8/Y2hlY2tvdXQ9ZmFpbGVkIik7CiAgY29uc3QgZXhwZWN0ZWRDZW50cyA9IG9yZGVyLmFtb3VudF9jZW50cyArIChvcmRlci5zaGlwcGluZ19jZW50cyB8fCAwKTsKICBpZiAoTnVtYmVyKG91dC5hbW91bnQpICE9PSBleHBlY3RlZENlbnRzKSByZXR1cm4gcmVzLnJlZGlyZWN0KCIvP2NoZWNrb3V0PWZhaWxlZCIpOwogIGlmIChvcmRlci5zdGF0dXMgPT09ICJwZW5kaW5nIikgew==") },
  { count: 2,
    find: d("cGFpZDogISFyLnBheW1lbnRfcmVm"),
    replace: d("cGFpZDogWyJwYWlkIiwic2hpcHBlZCIsImNvbXBsZXRlIl0uaW5jbHVkZXMoci5zdGF0dXMp") },
];
