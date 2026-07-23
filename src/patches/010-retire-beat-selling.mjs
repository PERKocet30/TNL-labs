/* Patch 010 — take beat/loop selling out of the market for now.
   SELLKIND defaults to "physical" and the kindpick buttons were the only
   thing that ever set it to "loop", so removing them retires the entire
   loop-listing path. The loop branch of sellHTML is left in place,
   unreachable — restoring it later is one hunk, not a rebuild.
   The Sounds and Free-only browse filters go with it. Sound listings that
   are already up still display and still sell; this only stops new ones.
   Client only — no server, no money, no schema. Runs after 009. */
const d = (s) => Buffer.from(s, "base64").toString("utf8");
export default [
  { file: "public/index.html", count: 1,
    find: d("ICAgIDxkaXYgY2xhc3M9ImtpbmRwaWNrIj4KICAgICAgPGJ1dHRvbiBjbGFzcz0ia2J0biAke1NFTExLSU5EIT09Imxvb3AiPyJvbiI6IiJ9IiBkYXRhLWtpbmQ9InBoeXNpY2FsIj7ilqMgUGh5c2ljYWw8c3Bhbj5jbG90aGVzLCBhcnQsIHByaW50czwvc3Bhbj48L2J1dHRvbj4KICAgICAgPGJ1dHRvbiBjbGFzcz0ia2J0biAke1NFTExLSU5EPT09Imxvb3AiPyJvbiI6IiJ9IiBkYXRhLWtpbmQ9Imxvb3AiPuKZqyBTb3VuZDxzcGFuPmxvb3BzLCBraXRzLCBzYW1wbGVzPC9zcGFuPjwvYnV0dG9uPgogICAgPC9kaXY+PC9kaXY+"),
    replace: d("ICAgIDwvZGl2Pg==") },
  { file: "public/index.html", count: 1,
    find: d("ICAgICAgICAgIDxidXR0b24gY2xhc3M9ImNoaXAgc20gJHtNS1RGSUxULmtpbmQ9PT0ibG9vcCI/Im9uIjoiIn0iIGRhdGEtbWtpbmQ9Imxvb3AiPuKZqyBTb3VuZHM8L2J1dHRvbj4KICAgICAgICAgICR7TUtURklMVC5raW5kPT09Imxvb3AiP2A8YnV0dG9uIGNsYXNzPSJjaGlwIHNtICR7TUtURklMVC5mcmVlPyJvbiI6IiJ9IiBkYXRhLW1mcmVlPkZyZWUgb25seTwvYnV0dG9uPmA6IiJ9Cg=="),
    replace: "" },
];
