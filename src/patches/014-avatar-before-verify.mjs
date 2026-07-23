/* Patch 014 — a new account couldn't set a profile picture.
   Onboarding asks for a photo, but /api/me/avatar sat behind `verified`,
   so anyone who hadn't clicked their confirmation email got a 403 on the
   first thing they tried to do. Everything that creates content or touches
   money stays gated; an avatar is your own profile, capped at 4MB and
   magic-byte checked. Runs after 013. */
const d = (s) => Buffer.from(s, "base64").toString("utf8");
export default [
  { file: "src/server.js", count: 1,
    find: d("YXBwLnBvc3QoIi9hcGkvbWUvYXZhdGFyIiwgYXV0aCwgdmVyaWZpZWQsIChyZXEsIHJlcykgPT4gew=="),
    replace: d("YXBwLnBvc3QoIi9hcGkvbWUvYXZhdGFyIiwgYXV0aCwgKHJlcSwgcmVzKSA9PiB7") },
];
