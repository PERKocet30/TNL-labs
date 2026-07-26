/* Patch 061 — the default kind says POSTS. 060 renamed the Showroom and
   search headings but the profile stat and tab pull their label from the
   KINDS map, and the visual kind — which is also the fallback for every
   role that maps nowhere — still said WORK. That is the label on the
   founder's own profile, and on any Curator, Illustrator, or unmatched
   role. Visual/fallback now reads POSTS ("4 POSTS", tab "POSTS 4",
   empty state "No posts up yet.").

   The role-flavoured kinds keep their names on purpose — SHOTS for a
   photographer, TRACKS for a producer, PIECES for fashion. Those aren't
   the word being retired; WORK was.

   1 hunk, client. Runs after 060. */
const d = (s) => Buffer.from(s, "base64").toString("utf8");
export default [
  { file: "public/index.html", count: 1,
    find: d("ICB2aXN1YWw6e3RhZzoiVklTVUFMIix3b3JrOiJXT1JLIixvbmU6InBpZWNlIixjb2xsYWJMaW5lOiJEZXNpZ25lZCB3aXRoIixlbXB0eToiTm8gd29yayB1cCB5ZXQuIiwKICAgIGJsdXJiOiJWaXN1YWwgd29yayDigJQgcG9zdGVycywgZ3JhcGhpY3MsIGFuZCB0aGUgYXJjaGl2ZSBiZWhpbmQgdGhlbS4iLGdyaWQ6dHJ1ZSxob21lOiJncmFwaGljLWRlc2lnbiJ9LA=="),
    replace: d("ICB2aXN1YWw6e3RhZzoiVklTVUFMIix3b3JrOiJQT1NUUyIsb25lOiJwb3N0Iixjb2xsYWJMaW5lOiJEZXNpZ25lZCB3aXRoIixlbXB0eToiTm8gcG9zdHMgdXAgeWV0LiIsCiAgICBibHVyYjoiVmlzdWFsIHdvcmsg4oCUIHBvc3RlcnMsIGdyYXBoaWNzLCBhbmQgdGhlIGFyY2hpdmUgYmVoaW5kIHRoZW0uIixncmlkOnRydWUsaG9tZToiZ3JhcGhpYy1kZXNpZ24ifSw=") },
];
