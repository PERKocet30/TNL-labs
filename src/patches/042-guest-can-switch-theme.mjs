/* Patch 042 — the landing had no way to change theme.

   The landing page was never broken. I audited every CSS rule on it — .whatis,
   .wi, .wi-k, .wi-v, .gate, .gatecard, .wall, .wall-h, .wall-p, .brand, .bt —
   and not one uses a hardcoded colour. They all read var(--bg), var(--card),
   var(--line), var(--dim), var(--tx), and the light block overrides every one
   of those (--line and --line2 follow for free, being rgba(var(--fg-rgb))).
   applyTheme(THEME) also runs at load, before any account exists.

   The actual problem: the ONLY theme switch in the app is inside sheetHTML(),
   under Edit profile → APPEARANCE. That is three taps past a login wall. A
   visitor arriving from a DM gets whatever prefers-color-scheme says and can
   never change it — and anyone who has used the app signed in carries
   localStorage "tnl-theme":"dark" forever, which is why the landing looks
   permanently dark no matter what the phone is set to.

   So this adds the switch where a guest can reach it: a sun/moon button in
   the guest top bar, beside search. No new wiring — wire() already delegates
   every [data-theme-set] to setTheme(), which persists and re-renders.

   One hunk, guest top bar only. Runs after 041. */
const d = (s) => Buffer.from(s, "base64").toString("utf8");
export default [
  { file: "public/index.html", count: 1,
    find: d("ICAgICAgPGJ1dHRvbiBjbGFzcz0iaWIiIGlkPSJzZWFyY2hCdG4iIGFyaWEtbGFiZWw9IlNlYXJjaCI+JHtVSV9JQy5zZWFyY2h9PC9idXR0b24+CiAgICAgIDxidXR0b24gY2xhc3M9ImJ0biBzbSBnaG9zdCIgaWQ9ImxvZ2luQnRuIj5TaWduIGluPC9idXR0b24+"),
    replace: d("ICAgICAgPGJ1dHRvbiBjbGFzcz0iaWIiIGlkPSJzZWFyY2hCdG4iIGFyaWEtbGFiZWw9IlNlYXJjaCI+JHtVSV9JQy5zZWFyY2h9PC9idXR0b24+CiAgICAgICR7LyogVGhlIG9ubHkgdGhlbWUgc3dpdGNoIGxpdmVkIGluIEVkaXQgcHJvZmlsZSwgYmVoaW5kIGFuIGFjY291bnQuIEEKICAgICAgICAgICAgdmlzaXRvciBhcnJpdmluZyBmcm9tIGEgRE0gaGFkIG5vIHdheSB0byBjaGFuZ2UgaXQg4oCUIHRoZSBsYW5kaW5nCiAgICAgICAgICAgIGZvbGxvd2VkIHByZWZlcnMtY29sb3Itc2NoZW1lIGFuZCB0aGVuIHN0YXllZCBwdXQuIFRoZSBleGlzdGluZwogICAgICAgICAgICBbZGF0YS10aGVtZS1zZXRdIGRlbGVnYXRlIHdpcmVzIHRoaXMgZm9yIGZyZWUuICovIiJ9CiAgICAgIDxidXR0b24gY2xhc3M9ImliIiBkYXRhLXRoZW1lLXNldD0iJHtUSEVNRT09PSJsaWdodCI/ImRhcmsiOiJsaWdodCJ9IgogICAgICAgIGFyaWEtbGFiZWw9IiR7VEhFTUU9PT0ibGlnaHQiPyJTd2l0Y2ggdG8gbmlnaHQiOiJTd2l0Y2ggdG8gZGF5In0iPiR7VEhFTUU9PT0ibGlnaHQiPyLimL4iOiLimIAifTwvYnV0dG9uPgogICAgICA8YnV0dG9uIGNsYXNzPSJidG4gc20gZ2hvc3QiIGlkPSJsb2dpbkJ0biI+U2lnbiBpbjwvYnV0dG9uPg==") },
];
