/* Patch 026 — autoplay follows the post, not the credit line. Client-only.
   022 observed the [data-mustrack] chip itself. A chip is ~15px of text, and
   025 moved it into the header under the photo, so on a tall image it crossed
   the middle-fifth band almost instantly: music started and stopped, or never
   started if you settled with the chip outside the band. Now the observer
   watches the enclosing .post / .sr-card and reads the post id off a
   data-muspost stamped from the chip. Same band, same MUSMUTE and MUSAUTOID
   rules, same silent play. Runs after 025. */
const d = (s) => Buffer.from(s, "base64").toString("utf8");
export default [
  { file: "public/index.html", count: 1,
    find: d("ICBjb25zdCBjaGlwcz1bLi4uZG9jdW1lbnQucXVlcnlTZWxlY3RvckFsbCgiW2RhdGEtbXVzdHJhY2tdIildOwogIGlmKCFjaGlwcy5sZW5ndGgpcmV0dXJuOwogIE1PQlM9bmV3IEludGVyc2VjdGlvbk9ic2VydmVyKChlbnRyaWVzKT0+ewogICAgZm9yKGNvbnN0IGUgb2YgZW50cmllcyl7CiAgICAgIGNvbnN0IHA9cG9zdEJ5SWQoZS50YXJnZXQuZGF0YXNldC5tdXN0cmFjayk7"),
    replace: d("ICBjb25zdCBjaGlwcz1bLi4uZG9jdW1lbnQucXVlcnlTZWxlY3RvckFsbCgiW2RhdGEtbXVzdHJhY2tdIildOwogIGlmKCFjaGlwcy5sZW5ndGgpcmV0dXJuOwogIC8qIFdhdGNoIHRoZSBDQVJELCBub3QgdGhlIGNoaXAuIFRoZSBjaGlwIGlzIG9uZSBsaW5lIG9mIHRleHQgYW5kIDAyNSBtb3ZlZCBpdAogICAgIGludG8gdGhlIGhlYWRlciBiZWxvdyB0aGUgcGhvdG8sIHNvIGl0IGNyb3NzZWQgdGhlIGNlbnRyZSBiYW5kIGluIGEgZnJhY3Rpb24KICAgICBvZiB0aGUgdGltZSBhIHRhbGwgaW1hZ2UgdGFrZXMg4oCUIG11c2ljIGZpcmVkIGFuZCB1bi1maXJlZCwgb3IgbmV2ZXIgZmlyZWQgYXQKICAgICBhbGwuIFRoZSBjYXJkIG92ZXJsYXBwaW5nIHRoZSBtaWRkbGUgZmlmdGggaXMgd2hhdCAidGhlIHBvc3QgeW91IGFyZSBsb29raW5nCiAgICAgYXQiIGFjdHVhbGx5IG1lYW5zLiAqLwogIGNvbnN0IGNhcmRzPVtdOwogIGZvcihjb25zdCBjIG9mIGNoaXBzKXsKICAgIGNvbnN0IGNhcmQ9Yy5jbG9zZXN0KCIucG9zdCwuc3ItY2FyZCIpfHxjOwogICAgY2FyZC5kYXRhc2V0Lm11c3Bvc3Q9Yy5kYXRhc2V0Lm11c3RyYWNrOwogICAgY2FyZHMucHVzaChjYXJkKTsKICB9CiAgTU9CUz1uZXcgSW50ZXJzZWN0aW9uT2JzZXJ2ZXIoKGVudHJpZXMpPT57CiAgICBmb3IoY29uc3QgZSBvZiBlbnRyaWVzKXsKICAgICAgY29uc3QgcD1wb3N0QnlJZChlLnRhcmdldC5kYXRhc2V0Lm11c3Bvc3QpOw==") },
  { file: "public/index.html", count: 1,
    find: d("ICBjaGlwcy5mb3JFYWNoKGM9Pk1PQlMub2JzZXJ2ZShjKSk7"),
    replace: d("ICBjYXJkcy5mb3JFYWNoKGM9Pk1PQlMub2JzZXJ2ZShjKSk7") },
];
