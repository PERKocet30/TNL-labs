/* Patch 050 - post action glyphs.

   The nav and the lab list already speak in geometric marks. The post action
   row was the last surface still using drawn icons, so like/comment/send now
   match: the heart pairs with the spade CASINO already uses, and the other two
   follow.

   Two things worth knowing:

     - U+FE0E on the filled heart. Bare U+2665 renders as a colour emoji on
       iOS, which ignores `color` and would have shown fixed red on every one
       of the nine accents. The topbar hit this already and solved it the same
       way. The unfilled heart U+2661 has no emoji form and needs nothing.

     - The nav's `.ic` class was NOT reused, despite being the obvious fit:
       there is a bare `.ic{color:var(--green)}` rule, so every unliked heart
       would have rendered accent-coloured. `.igi` is its own class for that
       reason alone.

   Also repairs a live bug found while reading the like button. Both recovery
   paths - server-disagreed and request-failed - still ran `b.textContent=`
   from before the icons were elements. That wipes the button's children, so a
   failed like degraded it to a bare text stub, losing the icon and the count
   span until the next full render. The optimistic path was migrated when the
   icons changed; these two were missed. They now repaint `.igact-n` like it
   does. This would have destroyed the new glyph too.

   Client-only. No schema, no server, no money path. 4 hunks. */
const d = (s) => Buffer.from(s, "base64").toString("utf8");
export default [
  { file: "public/index.html", count: 1,
    find: d("LyogSW5zdGFncmFtJ3MgYWN0aW9uIGdyYW1tYXI6IGNsZWFuIGxpbmUgaWNvbnMsIG5vdCBlbW9qaS4gSGVhcnQgZmlsbHMgZ3JlZW4KICAgd2hlbiBsaWtlZCAodmlhIC5pZ2FjdC5vbiBpbiBDU1MpLiBTYW1lIHRocmVlIGdlc3R1cmVzIElHIHRyYWluZWQgZXZlcnlvbmUKICAgb24g4oCUIGxpa2UsIGNvbW1lbnQsIHNlbmQg4oCUIHNvIHRoZSBmZWVkIG5lZWRzIHplcm8gaW5zdHJ1Y3Rpb24uICovCmNvbnN0IElHX0hFQVJUPWA8c3ZnIHZpZXdCb3g9IjAgMCAyNCAyNCIgYXJpYS1oaWRkZW49InRydWUiPjxwYXRoIGQ9Ik0xMiAyMC4zbC0xLjUtMS4zNUM1LjIgMTQuMSAyIDExLjIgMiA3LjY1IDIgNC45IDQuMTUgMi44IDYuODUgMi44YzEuNSAwIDIuOTUuNyAzLjkgMS44Ljk1LTEuMSAyLjQtMS44IDMuOS0xLjggMi43IDAgNC44NSAyLjEgNC44NSA0Ljg1IDAgMy41NS0zLjIgNi40NS04LjUgMTEuM0wxMiAyMC4zeiIvPjwvc3ZnPmA7CmNvbnN0IElHX0NPTU1FTlQ9YDxzdmcgdmlld0JveD0iMCAwIDI0IDI0IiBhcmlhLWhpZGRlbj0idHJ1ZSI+PHBhdGggZD0iTTIwLjUgMTEuNWE3LjUgNy41IDAgMDEtMTAuOSA2LjdMMy41IDIwbDEuOS01LjRhNy41IDcuNSAwIDExMTUuMS0zLjF6IiBzdHJva2UtbGluZWpvaW49InJvdW5kIi8+PC9zdmc+YDsKY29uc3QgSUdfU0VORD1gPHN2ZyB2aWV3Qm94PSIwIDAgMjQgMjQiIGFyaWEtaGlkZGVuPSJ0cnVlIj48cGF0aCBkPSJNMjEuNSAzLjVMMTAuNSAxNC41TTIxLjUgMy41bC03IDE3LTQtNy41LTcuNS00IDE4LjUtNS41eiIgc3Ryb2tlLWxpbmVqb2luPSJyb3VuZCIgc3Ryb2tlLWxpbmVjYXA9InJvdW5kIi8+PC9zdmc+YDs="),
    replace: d("LyogVGhlIHBvc3Qgcm93IHNwZWFrcyB0aGUgc2FtZSBsYW5ndWFnZSBhcyB0aGUgbmF2IGFuZCB0aGUgbGFiIGxpc3Q6IGdlb21ldHJpYwogICBtYXJrcywgbm90IGRyYXduIGljb25zLiDimaUgaXMgbGl0ZXJhbGx5IHRoZSBmYW1pbHkg4pmgIGFscmVhZHkgYmVsb25ncyB0byBpbgogICBDQVNJTk8sIHNvIGxpa2UvY29tbWVudC9zZW5kIG5vdyByZWFkIGFzIGhvdXNlIHR5cGUgcmF0aGVyIHRoYW4gYm9ycm93ZWQgVUkuCgogICDimaUgY2FycmllcyBhbiBlbW9qaSBwcmVzZW50YXRpb24gb24gaU9TLCB3aGljaCB3b3VsZCBwYWludCBpdCBhIGZpeGVkIHJlZCBhbmQKICAgaWdub3JlIGBjb2xvcmAg4oCUIGJyZWFraW5nIHRoZSBhY2NlbnQgdGhlbWVzLiBVK0ZFMEUgcGlucyBpdCB0byB0ZXh0LCB0aGUgc2FtZQogICBmaXggdGhlIHRvcGJhciBhbHJlYWR5IHVzZXMgb24g4pyJ77iOIGFuZCDimpHvuI4uCgogICBUaGUgaGVhcnQncyB0d28gc3RhdGVzIGxpdmUgaW4gQ1NTICguaWdpLWg6OmJlZm9yZSksIHNvIC5pZ2FjdC5vbiBzdGlsbCBkb2VzCiAgIGFsbCB0aGUgd29yayBhbmQgbmVpdGhlciByZW5kZXIgc2l0ZSBoYWQgdG8gY2hhbmdlLiAqLwpjb25zdCBJR19IRUFSVD1gPGkgY2xhc3M9ImlnaSBpZ2ktaCIgYXJpYS1oaWRkZW49InRydWUiPjwvaT5gOwpjb25zdCBJR19DT01NRU5UPWA8aSBjbGFzcz0iaWdpIiBhcmlhLWhpZGRlbj0idHJ1ZSI+4p2PPC9pPmA7CmNvbnN0IElHX1NFTkQ9YDxpIGNsYXNzPSJpZ2kiIGFyaWEtaGlkZGVuPSJ0cnVlIj7ih7E8L2k+YDs=") },
  { file: "public/index.html", count: 1,
    find: d("LmlnYWN0IHN2Z3t3aWR0aDoyNXB4O2hlaWdodDoyNXB4O3N0cm9rZTpjdXJyZW50Q29sb3I7ZmlsbDpub25lO3N0cm9rZS13aWR0aDoxLjc7dHJhbnNpdGlvbjp0cmFuc2Zvcm0gLjEycyBlYXNlfQouaWdhY3Q6YWN0aXZlIHN2Z3t0cmFuc2Zvcm06c2NhbGUoLjg1KX0KLmlnYWN0Lm9ue2NvbG9yOnZhcigtLWdyZWVuKX0KLmlnYWN0Lm9uIHN2Z3tmaWxsOnZhcigtLWdyZWVuKTtzdHJva2U6dmFyKC0tZ3JlZW4pfQ=="),
    replace: d("LmlnYWN0IC5pZ2l7Zm9udC1zaXplOjIzcHg7bGluZS1oZWlnaHQ6MTtmb250LXN0eWxlOm5vcm1hbDtkaXNwbGF5OmZsZXg7YWxpZ24taXRlbXM6Y2VudGVyO2p1c3RpZnktY29udGVudDpjZW50ZXI7dHJhbnNpdGlvbjp0cmFuc2Zvcm0gLjEycyBlYXNlfQouaWdhY3Q6YWN0aXZlIC5pZ2l7dHJhbnNmb3JtOnNjYWxlKC44NSl9Ci5pZ2FjdC5vbntjb2xvcjp2YXIoLS1ncmVlbil9Ci5pZ2ktaDo6YmVmb3Jle2NvbnRlbnQ6IuKZoSJ9Ci5pZ2FjdC5vbiAuaWdpLWg6OmJlZm9yZXtjb250ZW50OiLimaXvuI4ifQ==") },
  { file: "public/index.html", count: 1,
    find: d("ICAgICAgICBiLmNsYXNzTGlzdC50b2dnbGUoIm9uIixsaWtlZCk7CiAgICAgICAgYi50ZXh0Q29udGVudD0obGlrZWQ/IuKZpSI6IuKZoSIpKyIgIisocC5saWtlQ291bnR8fCIiKTs="),
    replace: d("ICAgICAgICBiLmNsYXNzTGlzdC50b2dnbGUoIm9uIixsaWtlZCk7CiAgICAgICAgLyogdGV4dENvbnRlbnQ9IHVzZWQgdG8gd2lwZSB0aGUgaWNvbiBBTkQgdGhlIGNvdW50IHNwYW4sIGxlYXZpbmcgYSBiYXJlCiAgICAgICAgICAgdGV4dCBzdHViIHVudGlsIHRoZSBuZXh0IGZ1bGwgcmVuZGVyLiBSZXBhaW50IHRoZSBjb3VudCBvbmx5LiAqLwogICAgICAgIGNvbnN0IG4yPWIucXVlcnlTZWxlY3RvcigiLmlnYWN0LW4iKTtpZihuMiluMi50ZXh0Q29udGVudD1wLmxpa2VDb3VudHx8IiI7") },
  { file: "public/index.html", count: 1,
    find: d("ICAgICAgICBiLmNsYXNzTGlzdC50b2dnbGUoIm9uIix3YXMpO2IudGV4dENvbnRlbnQ9KHdhcz8i4pmlIjoi4pmhIikrIiAiKyhwLmxpa2VDb3VudHx8IiIpfQ=="),
    replace: d("ICAgICAgICBiLmNsYXNzTGlzdC50b2dnbGUoIm9uIix3YXMpOwogICAgICAgIGNvbnN0IG4zPWIucXVlcnlTZWxlY3RvcigiLmlnYWN0LW4iKTtpZihuMyluMy50ZXh0Q29udGVudD1wLmxpa2VDb3VudHx8IiI7fQ==") },
];
