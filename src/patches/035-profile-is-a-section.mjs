/* Patch 035 — the nav belongs at the bottom, so the profile has to render
   above it.

   031/032 put your own profile in the flex column AFTER navHTML(). `.content`
   is `flex:1 1 0%`, so the moment the profile claims the column `.content`
   collapses to zero and the nav rides up to the top of the screen. 034 gave
   the profile a scroller, which fixed the freeze but not the order.

   The real correction is that your own profile is a SECTION of the app, not
   an overlay on top of one — so it renders in the `.content` slot, where
   showroom/labs/market/studio already render, and the nav stays where it
   has always been. Anyone else's profile is still a thing you peek at and
   dismiss, so it stays an overlay after the nav.

   MYPAGE() is the same test the nav already highlights itself with, and the
   same one sheetHTML() computes internally as `mine`.

   Client-only. No schema, no routes. Runs after 034. */
const d = (s) => Buffer.from(s, "base64").toString("utf8");
export default [
  { file: "public/index.html", count: 1,
    find: d("Y29uc3QgbXlOYW1lPSgpPT5NRT9NRS51c2VybmFtZTpudWxsOw=="),
    replace: d("Y29uc3QgbXlOYW1lPSgpPT5NRT9NRS51c2VybmFtZTpudWxsOwovKiBZb3VyIG93biBwcm9maWxlIGlzIGEgc2VjdGlvbiBvZiB0aGUgYXBwLCBzbyBpdCByZW5kZXJzIGluIHRoZSAuY29udGVudAogICBzbG90IEFCT1ZFIHRoZSBuYXYuIEFueW9uZSBlbHNlIHlvdSBwZWVrIGF0IHN0YXlzIGFuIG92ZXJsYXkgYWZ0ZXIgaXQuICovCmNvbnN0IE1ZUEFHRT0oKT0+ISEoUFJPRklMRSYmTUUmJlBST0ZJTEUudXNlciYmUFJPRklMRS51c2VyLnVzZXJuYW1lPT09TUUudXNlcm5hbWUpOw==") },
  { file: "public/index.html", count: 1,
    find: d("ICAgIDxkaXYgY2xhc3M9ImNvbnRlbnQiPiR7VEFCPT09InNob3dyb29tIj9zaG93cm9vbUhUTUwoKTpUQUI9PT0ibGFicyI/bGFic0hUTUwoKTpUQUI9PT0ibWFya2V0Ij9tYXJrZXRIVE1MKCk6c3R1ZGlvSFRNTCgpfTwvZGl2PgogICAgJHtuYXZIVE1MKCl9CiAgICAke1BST0ZJTEU/c2hlZXRIVE1MKCk6IiJ9"),
    replace: d("ICAgIDxkaXYgY2xhc3M9ImNvbnRlbnQiPiR7TVlQQUdFKCk/c2hlZXRIVE1MKCk6VEFCPT09InNob3dyb29tIj9zaG93cm9vbUhUTUwoKTpUQUI9PT0ibGFicyI/bGFic0hUTUwoKTpUQUI9PT0ibWFya2V0Ij9tYXJrZXRIVE1MKCk6c3R1ZGlvSFRNTCgpfTwvZGl2PgogICAgJHtuYXZIVE1MKCl9CiAgICAkeyhQUk9GSUxFJiYhTVlQQUdFKCkpP3NoZWV0SFRNTCgpOiIifQ==") },
];
