/* Patch 033 — the dark theme's --el token was defined as itself.

   :root carried `--el:var(--el)`, a cyclic custom property: invalid at
   computed-value time, so all 93 var(--el) consumers fell back to the
   property's initial value — transparent for a background. Every elevated
   surface in the default theme was rendering with no fill. The light theme
   two lines below already had the correct value (#F1F0ED), and admin.html
   has the dark one (#141414), which is what this restores.

   CSS only. No markup, no script, no schema. Runs after 032. */
const d = (s) => Buffer.from(s, "base64").toString("utf8");
export default [
  { file: "public/index.html", count: 1,
    find: d("LS1jYXJkOiMwQTBBMEE7LS1lbDp2YXIoLS1lbCk7"),
    replace: d("LS1jYXJkOiMwQTBBMEE7LS1lbDojMTQxNDE0Ow==") },
];
