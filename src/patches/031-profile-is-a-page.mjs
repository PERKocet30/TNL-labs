/* Patch 031 — the profile stops being a modal. PROFILE has been a bottom-nav
   tab since the Profile stage, but it still rendered through sheetHTML as a
   fixed overlay with a scrim and an ✕ — tapping the tab opened a drawer over
   whatever you were in, which is why it read as somewhere you exit rather than
   somewhere you are. On TAB==="profile" the same markup now renders as a page
   in normal flow; everywhere else (tapping an avatar in a feed) it stays a
   sheet, which is what a peek should be. Presentation only — no routing,
   history or state change, so nothing about how the profile loads moves.
   Client-only. Runs after 030. */
const d = (s) => Buffer.from(s, "base64").toString("utf8");
export default [
  { file: "public/index.html", count: 1,
    find: d("ICByZXR1cm4gYDxkaXYgY2xhc3M9InNoZWV0IiBpZD0ic2hlZXRiZyI+PGRpdiBjbGFzcz0ic2hlZXRjIiBzdHlsZT0iLS1ncmVlbjoke2FjY30iPg=="),
    replace: d("ICAvKiBQUk9GSUxFIGlzIGEgbmF2IHRhYiwgc28gb24gdGhhdCB0YWIgaXQgcmVuZGVycyBhcyBhIHBhZ2UsIG5vdCBhIG1vZGFsCiAgICAgeW91IGVzY2FwZSBmcm9tLiBUaGUgc2hlZXQgaXMga2VwdCBmb3Igd2hhdCBpdCB3YXMgYnVpbHQgZm9yOiBwZWVraW5nIGF0CiAgICAgc29tZW9uZSBmcm9tIGEgZmVlZCB3aXRob3V0IGxlYXZpbmcgd2hlcmUgeW91IGFyZS4gKi8KICBjb25zdCBhc3RhYiA9IFRBQj09PSJwcm9maWxlIjsKICByZXR1cm4gYDxkaXYgY2xhc3M9InNoZWV0ICR7YXN0YWI/ImFzdGFiIjoiIn0iIGlkPSJzaGVldGJnIj48ZGl2IGNsYXNzPSJzaGVldGMiIHN0eWxlPSItLWdyZWVuOiR7YWNjfSI+") },
  { file: "public/index.html", count: 1,
    find: d("LnNoZWV0e3Bvc2l0aW9uOmZpeGVkO2luc2V0OjA7YmFja2dyb3VuZDpyZ2JhKDAsMCwwLC43KTtkaXNwbGF5OmZsZXg7anVzdGlmeS1jb250ZW50OmZsZXgtZW5kO3otaW5kZXg6NjB9"),
    replace: d("LnNoZWV0e3Bvc2l0aW9uOmZpeGVkO2luc2V0OjA7YmFja2dyb3VuZDpyZ2JhKDAsMCwwLC43KTtkaXNwbGF5OmZsZXg7anVzdGlmeS1jb250ZW50OmZsZXgtZW5kO3otaW5kZXg6NjB9Ci8qIE9uIHRoZSBQUk9GSUxFIHRhYiB0aGUgc2FtZSBtYXJrdXAgaXMgYSBwYWdlOiBubyBzY3JpbSwgbm8gZHJhd2VyLCBubyDinJUuICovCi5zaGVldC5hc3RhYntwb3NpdGlvbjpzdGF0aWM7aW5zZXQ6YXV0bztiYWNrZ3JvdW5kOm5vbmU7ZGlzcGxheTpibG9jazt6LWluZGV4OmF1dG99Ci5zaGVldC5hc3RhYiAuc2hlZXRje21heC13aWR0aDpub25lO2hlaWdodDphdXRvO2JvcmRlci1sZWZ0OjA7cGFkZGluZzoxNHB4IDE2cHggOTZweDtvdmVyZmxvdzp2aXNpYmxlfQouc2hlZXQuYXN0YWIgLnNoZWV0aCAueHtkaXNwbGF5Om5vbmV9") },
];
