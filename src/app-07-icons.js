/* ================================================================
   DRAWN ICONS v1.0 — 2026-09-29
   Every control draws its icon: 2px stroke, square caps, mitred joins,
   currentColor — the same geometry as the nav. No emoji or glyphs as
   icons (✎ 🗑 🔇 ▶︎ ♫ ★ …): iOS paints those as colour emoji that ignore
   the theme, and they never sat right next to the drawn set.
================================================================ */
const di=(d,s=18,fill="none")=>`<svg class="di" viewBox="0 0 24 24" width="${s}" height="${s}" fill="${fill}" stroke="currentColor" stroke-width="2" stroke-linecap="square" stroke-linejoin="miter" aria-hidden="true">${d}</svg>`;
const DI={
  more:di('<path d="M5 12h.01M12 12h.01M19 12h.01" stroke-width="3"/>',20),
  edit:di('<path d="M4 20h4L19 9l-4-4L4 16zM13 7l4 4"/>',16),
  trash:di('<path d="M5 7h14M10 7V4h4v3M7 7l1 13h8l1-13"/>',16),
  play:di('<path d="M8 5v14l11-7z"/>',16,"currentColor"),
  pause:di('<path d="M8 5v14M16 5v14"/>',16),
  stop:di('<rect x="6" y="6" width="12" height="12"/>',16,"currentColor"),
  soundOff:di('<path d="M4 9h4l5-4v14l-5-4H4zM16 9l5 6M21 9l-5 6"/>',16),
  soundOn:di('<path d="M4 9h4l5-4v14l-5-4H4zM16.5 9a4 4 0 0 1 0 6M19 6.5a7.5 7.5 0 0 1 0 11"/>',16),
  music:di('<path d="M5 10v4M9 7v10M13 4v16M17 8v8M21 11v2"/>',18),
  stack:di('<rect x="8" y="8" width="12" height="12"/><path d="M16 4H4v12"/>',14),
  video:di('<path d="M8 5v14l11-7z"/>',14,"currentColor"),
  check:di('<path d="M5 12l5 5 9-10"/>',14),
  x:di('<path d="M6 6l12 12M18 6L6 18"/>',14),
  plus:di('<path d="M12 5v14M5 12h14"/>',16),
  back:di('<path d="M15 5l-7 7 7 7"/>',14),
  out:di('<path d="M8 16L16 8M9.5 8H16v6.5"/>',14),
  star:di('<path d="M12 3.5l2.6 5.6 6.1.7-4.5 4.2 1.2 6-5.4-3.1-5.4 3.1 1.2-6L3.3 9.8l6.1-.7z"/>',14,"currentColor"),
  mail:di('<rect x="3.5" y="5.5" width="17" height="13"/><path d="M4 6l8 7 8-7"/>',18),
  copy:di('<rect x="8" y="8" width="12" height="12"/><path d="M16 8V4H4v12h4"/>',18),
  flag:di('<path d="M6 21V4h11l-2 4 2 4H6"/>',18),
  board:di('<rect x="4" y="4" width="16" height="16"/><path d="M12 4v16M4 12h8"/>',18),
  lock:di('<rect x="5" y="11" width="14" height="9"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/>',14),
};
