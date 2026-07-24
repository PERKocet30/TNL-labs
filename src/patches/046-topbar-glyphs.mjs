/* Patch 046 — message and notification icons become glyphs too.

   Same move as 045: the top bar was outline SVGs (dm at stroke 1.8, bell at
   1.8, search at 1.9) while the rest of the app speaks in marks.

   ONE DELIBERATE DIFFERENCE from the nav. These two are SEMANTIC glyphs, not
   abstract geometric ones, because the top bar has no text labels under it.
   The nav can carry ◈ and ▤ because SHOWROOM and MARKET are written
   underneath; an abstract mark up here would just be an unlabelled button.

     ✉  messages
     ⚑  notifications

   Both carry \uFE0E, the text variation selector, so iOS renders them as type
   in the current colour rather than as colour emoji.

   ⚑ is the weaker of the two — a bell is the more conventional symbol for
   alerts, and this is a flag. It is one character to change if it does not
   read. ✉ and ⚑ were both checked against every mark already in use
   (◉ ⌗ ▣ ♠ Λ from LAB_ID, ◈ ⌗ ＋ ▤ ◎ from the nav) — no collisions.

   Unread badges are untouched: both buttons keep .ib so .badge still
   positions against position:relative, and the count logic is unchanged.

   Search is left as an SVG on purpose — a magnifier has no good type
   equivalent, and it is the one icon nobody misreads.

   Client-only, two hunks. Runs after 045. */
const d = (s) => Buffer.from(s, "base64").toString("utf8");
export default [
  { file: "public/index.html", count: 1,
    find: d("ICAgICAgPGJ1dHRvbiBjbGFzcz0iaWIiIGlkPSJkbUJ0biIgYXJpYS1sYWJlbD0iTWVzc2FnZXMiPiR7VUlfSUMuZG19JHtETVVOUkVBRD9gPHNwYW4gY2xhc3M9ImJhZGdlIj4ke0RNVU5SRUFEPjk/IjkrIjpETVVOUkVBRH08L3NwYW4+YDoiIn08L2J1dHRvbj4KICAgICAgPGJ1dHRvbiBjbGFzcz0iaWIiIGlkPSJub3RpZkJ0biIgYXJpYS1sYWJlbD0iTm90aWZpY2F0aW9ucyI+JHtVSV9JQy5iZWxsfSR7VU5SRUFEP2A8c3BhbiBjbGFzcz0iYmFkZ2UiPiR7VU5SRUFEPjk/IjkrIjpVTlJFQUR9PC9zcGFuPmA6IiJ9PC9idXR0b24+"),
    replace: d("ICAgICAgJHsvKiBHbHlwaHMsIG1hdGNoaW5nIHRoZSBuYXYgYW5kIHRoZSBsYWIgbGlzdC4gS2VwdCBTRU1BTlRJQyByYXRoZXIgdGhhbgogICAgICAgICAgICBwdXJlbHkgZ2VvbWV0cmljOiB0aGUgdG9wIGJhciBoYXMgbm8gdGV4dCBsYWJlbHMgdW5kZXIgaXQsIHNvIGFuCiAgICAgICAgICAgIGFic3RyYWN0IG1hcmsgaGVyZSB3b3VsZCBiZSBhbiB1bmxhYmVsbGVkIG15c3RlcnkgYnV0dG9uLiBcdUZFMEUgZm9yY2VzCiAgICAgICAgICAgIHRleHQgcHJlc2VudGF0aW9uIHNvIGlPUyBkcmF3cyB0aGVtIGFzIHR5cGUsIG5vdCBjb2xvdXIgZW1vamkuICovIiJ9CiAgICAgIDxidXR0b24gY2xhc3M9ImliIGdseSIgaWQ9ImRtQnRuIiBhcmlhLWxhYmVsPSJNZXNzYWdlcyI+4pyJ77iOJHtETVVOUkVBRD9gPHNwYW4gY2xhc3M9ImJhZGdlIj4ke0RNVU5SRUFEPjk/IjkrIjpETVVOUkVBRH08L3NwYW4+YDoiIn08L2J1dHRvbj4KICAgICAgPGJ1dHRvbiBjbGFzcz0iaWIgZ2x5IiBpZD0ibm90aWZCdG4iIGFyaWEtbGFiZWw9Ik5vdGlmaWNhdGlvbnMiPuKake+4jiR7VU5SRUFEP2A8c3BhbiBjbGFzcz0iYmFkZ2UiPiR7VU5SRUFEPjk/IjkrIjpVTlJFQUR9PC9zcGFuPmA6IiJ9PC9idXR0b24+") },
  { file: "public/index.html", count: 1,
    find: d("Lmlie3Bvc2l0aW9uOnJlbGF0aXZlO2JhY2tncm91bmQ6dmFyKC0tZWwpO2JvcmRlcjoxcHggc29saWQgdmFyKC0tbGluZSk7Y29sb3I6dmFyKC0tdHgpO3dpZHRoOjMycHg7aGVpZ2h0OjMycHg7Ym9yZGVyLXJhZGl1czo5cHg7Zm9udC1zaXplOjE0cHg7bGluZS1oZWlnaHQ6MTtkaXNwbGF5OmlubGluZS1mbGV4O2FsaWduLWl0ZW1zOmNlbnRlcjtqdXN0aWZ5LWNvbnRlbnQ6Y2VudGVyfQ=="),
    replace: d("Lmlie3Bvc2l0aW9uOnJlbGF0aXZlO2JhY2tncm91bmQ6dmFyKC0tZWwpO2JvcmRlcjoxcHggc29saWQgdmFyKC0tbGluZSk7Y29sb3I6dmFyKC0tdHgpO3dpZHRoOjMycHg7aGVpZ2h0OjMycHg7Ym9yZGVyLXJhZGl1czo5cHg7Zm9udC1zaXplOjE0cHg7bGluZS1oZWlnaHQ6MTtkaXNwbGF5OmlubGluZS1mbGV4O2FsaWduLWl0ZW1zOmNlbnRlcjtqdXN0aWZ5LWNvbnRlbnQ6Y2VudGVyfQovKiBHbHlwaCBidXR0b25zIGNhcnJ5IHR5cGUgd2hlcmUgYW4gMThweCBzdmcgdXNlZCB0byBzaXQuICovCi5pYi5nbHl7Zm9udC1zaXplOjE3cHh9") },
];
